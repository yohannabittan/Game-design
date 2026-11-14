// Arena: The foe AI: his cover, his mind, his moves and the pair's second foe.
// Split from game.js by tools/arena-split.mjs (ADR-0024). Only tuning.js and data.js may be read while modules load.

import { clamp } from './engine.js';
import { TUNING } from './tuning.js';
import { PARTS, ARM_LEN, SHOULDER, ZONES, ZONE, ZONE_POSE, MOVE_ZONE, REST_TH } from './data.js';
import { lay, beastOf, drawK, pairScale, edgeX, youF, walls, gMin, bodyPos, inReach, foeF, toScreen, partCenter, zoneScreenY, openNow, raised,
  poseFoe, beastRest, fakeShowing, slowFx, resolveSwing, dust, sand, ring, pop, windSound, beastSound, thud, clangSound, swooshSound } from './fight.js';
import { C_, famN, growth, dropBlow, stunFoe, netMul, addBleed } from './cards.js';
import { hudRow } from './draw-fight.js';
import { arenaT, bout, trait, state, ZERO, has, pickW, statMul, shake, nextGap } from './game.js';

// ====== FOE AI: his cover, memory, move building, exchanges and the swing clock ======
// ----- his cover: the guard he slides over the spot you just hit -----
export function guardUp() { return !state.sw && state.open <= 0 && state.stun <= 0 && state.stagger <= 0 && state.fallT <= 0 && state.winded <= 0; }
// The foe's cover: after a blow lands he slides his guard (or shield) over that spot for a few seconds. It is down while he swings, is open, winded or stunned.
export const hesitating = () => !!state.sw && !!state.sw.fake && state.sw.hesOn && !state.sw.switched && state.sw.fin <= 0;
export const covering = () => !!state.cover && state.cover.t > 0 && guardUp() && !(state.gbreak > 0);
const guarded = (p) => covering() && Math.hypot(p.cx - state.cover.x, p.cy - state.cover.y) <= state.cover.r;
export const covered = (p) => p.armour || p.guard || (guarded(p) && !(p.slot && (state.openAll > 0 || openNow(p))));
// a piece of his gear that acts for him (TUNING.foeGear)
export const foeHas = (id) => !!state.foe.gear && state.foe.gear.includes(id);
// a limb of his lamed for the rest of the bout: armF (sword arm), armB (shield arm), legs
export const LIMB = { armF: 'SWORD ARM', armB: 'SHIELD ARM', legs: 'LEGS', legF: 'FORELEG' };
export const limbName = (id) => (state.foe.beast && id === 'legs' ? 'HIND LEGS' : LIMB[id]);
export const lamed = (id) => !!state.foe.parts && state.foe.parts.some((p) => p.d.id === id && !p.slot && p.cut);
export function setCover(p) {
  if (state.gbreak > 0) return;
  const c = state.cover, f = state.foe, r = f.shield ? TUNING.foe.coverShield : f.dual ? TUNING.dual.cover : TUNING.foe.coverGuard;
  state.cover = { x: p.cx, y: p.cy, r, t: TUNING.cover.dur, max: TUNING.cover.dur, dx: c ? c.dx : 0.28, dy: c ? c.dy : -0.67 };
}

// ----- the foe's mind: each exchange is planned with the fight RNG when it starts, then played out exactly, so every tell is honest -----
// What he remembers of you.
// his memory: from bout 3 on, or from his first bout in the Eye Amulet
export const memoryOn = () => !!bout().memory || foeHas('mindreader');
export function blockRun() {
  const R = TUNING.read, b = state.mem.blocks;
  if (!memoryOn() || b.length < R.blockRun || state.m - b[b.length - 1].t > R.memWin) return null;
  const last = b.slice(-R.blockRun);
  return last.every((q) => q.z === last[0].z) ? last[0].z : null;
}
// Step 23: from bout 2 on he learns a jab that keeps coming. After TUNING.foe.jabRun of your jabs in a row met his guard, his guard is over the next
// jab's mark TUNING.foe.jabRead s after it starts; a slash, an overhead, a lunge or a jab that lands clears it.
const jabsRead = () => state.mem.jabs >= TUNING.foe.jabRun && (memoryOn() || !bout().spar);
export function readJab(E) {
  if (!jabsRead()) return;
  if (state.mem.jabs === TUNING.foe.jabRun) readPop(E, 'READS YOUR JAB');
  state.jabGuard = TUNING.foe.jabRead;
}
// his guard goes to the part nearest where the jab's point is heading
export function guardJab(E) {
  if (!guardUp()) return;
  const h = state.hand, F = foeF(E), f = state.foe, t = TUNING.foe.jabRead, x = h.ux + h.vx * t, y = h.uy + h.vy * t;
  const d = (p) => { const [px, py] = partCenter(F, f, p); return Math.hypot(px - x, py - y); };
  const p = f.parts.filter((q) => !q.armour && !q.guard && !q.cut).sort((a, b) => d(a) - d(b))[0];
  if (p) setCover(p);
}
export const lungeRead = () => memoryOn() && state.mem.lunges.filter((t) => state.m - t < TUNING.read.lungeWin).length >= TUNING.read.lunges;
const turtling = () => memoryOn() && state.mem.turtle >= TUNING.read.turtle;
const pressing = () => memoryOn() && state.stamina < state.staMax * TUNING.read.lowSta;
export function readPop(E, s) { const Ff = foeF(E); pop(Ff.x, Ff.y - 1.12 * Ff.H, s, '#c4b5fd', 14); }
const pickZone = (rng, avoid, not) => pickW(rng, ZONES.filter((z) => z.id !== not).map((z) => [z.id, z.id === avoid ? TUNING.read.avoid : 1]));
// half hearts one blow takes: the move, weapon, size and Strength
function blowDmg(k) {
  const f = state.foe, S = TUNING.stat.strDmg;
  return k <= 0 ? 0 : clamp(Math.round(k * f.weapon.dmg * f.size.dmg * (S[0] + S[1] * f.str)), 1, TUNING.foe.dmgCap);
}

// A move is a list of blows, each with its zone, windup, damage and pose; a feint's one blow carries the fake zone it shows first.
export function buildMove(rng, kind, ctx) {
  const f = state.foe, M = TUNING.moves, W = f.weapon, avoid = ctx.avoid, spd = f.size.wind * statMul('spdWind', f.spd);
  const base = TUNING.swing.windup * W.speed * spd * ctx.wind * (bout().tell || 1), wind = (k) => ctx.fixed || base * k;
  const blow = (zone, w, dmg, pose) => ({ zone, wind: w, dmg: blowDmg(dmg), pose });
  const mv = { kind, cost: M[kind].cost, hits: [] };
  if (kind === 'chop') mv.hits.push(blow('high', wind(M.chop.wind), M.chop.dmg, 'chop'));
  else if (kind === 'sweep') mv.hits.push(blow('low', wind(M.sweep.wind), M.sweep.dmg, 'sweep'));
  else if (kind === 'thrust') {
    const z = avoid === 'mid' || (avoid !== 'high' && W.id === 'spear' && rng.chance(M.thrust.high)) ? 'high' : 'mid';
    mv.hits.push(blow(z, wind(M.thrust.wind), M.thrust.dmg, 'thrust'));
  } else if (kind === 'combo') {
    const n = rng.int(W.combo[0], W.combo[1]);
    let z = pickZone(rng, avoid);
    for (let i = 0; i < n; i++) {
      if (i) z = pickZone(rng, avoid, z);
      const b = blow(z, base * M.combo.wind * (i ? M.combo.next : 1) * (f.twin ? TUNING.champs.aquila.fast : 1), M.combo.dmg, W.id === 'spear' && z !== 'low' ? 'thrust' : ZONE_POSE[z]);
      // Aquila with two blades: each blow comes at a second height too, from his other hand
      if (f.twin) { b.zone2 = pickZone(rng, null, z); b.pose2 = ZONE_POSE[b.zone2]; b.dmg2 = b.dmg; }
      mv.hits.push(b);
    }
    mv.cost = M.combo.cost * n;
  } else if (kind === 'feint') {
    // the zone you have been blocking is the best lie
    // the real tell after the jump: his size and Speed shorten it, but never below min; Keen Eye adds to it
    const fake = avoid || pickZone(rng, null), real = pickZone(rng, avoid, fake), show = base * M.feint.show, hes = TUNING.lesson.hes;
    const after = Math.max(M.feint.min, M.feint.after * spd);
    mv.hits.push({ ...blow(real, show + hes + after, M.feint.dmg, ZONE_POSE[real]), fake, fakePose: ZONE_POSE[fake], switchAt: show, hes });
  } else if (kind === 'bash') mv.hits.push(blow('mid', wind(M.bash.wind), 0, 'bash'));
  else if (kind === 'net') mv.hits.push(blow('mid', wind(M.net.wind), 0, 'net'));
  // a beast's: the pounce lands MID, the swipe HIGH or MID, the maul LOW or MID, the shove MID (away from the zone you keep blocking)
  else if (kind === 'pounce') mv.hits.push(blow('mid', wind(M.pounce.wind), M.pounce.dmg, 'pounce'));
  else if (kind === 'swipe') mv.hits.push(blow(beastZone(rng, avoid, 'high', 'mid'), wind(M.swipe.wind), M.swipe.dmg, 'swipe'));
  else if (kind === 'maul') mv.hits.push(blow(beastZone(rng, avoid, 'low', 'mid'), wind(M.maul.wind), M.maul.dmg, 'maul'));
  else if (kind === 'shove') mv.hits.push(blow('mid', wind(M.shove.wind), 0, 'shove'));
  return mv;
}

function beastZone(rng, avoid, a, b) { return avoid === a ? b : avoid === b ? a : rng.chance(beastOf(state.foe).zone) ? a : b; }
// his move weights: his weapon's (a beast's own), and the Huntress's net besides her spear; two blades hold no net, and Aquila's lean to combos
function movesOf(f) {
  const C = TUNING.champs[f.ck], m = C && C.net ? { ...f.weapon.moves, net: C.net } : f.weapon.moves;
  if (!f.dual) return m;
  const out = { ...m }; delete out.net;
  if (f.twin) out.combo = (out.combo || 1) * TUNING.champs.aquila.combo;
  return out;
}
// how much further than his striking distance a move may start from: the pounce's leap (shorter on a lamed leg), the Blink's dash, the Throw's range
const leapOf = () => TUNING.moves.pounce.leap * (lamed('legs') || lamed('legF') ? TUNING.lame.legs : 1);
const reachOf = (mv) => (!mv ? 0 : mv.kind === 'pounce' ? leapOf() : mv.kind === 'blink' ? TUNING.champs.hermes.leap : mv.kind === 'throw' ? Infinity : 0);
// the moves planned as he gets ready, so his feet know he strikes from where he stands
export const RANGED = { pounce: true, blink: true, throw: true };

// ----- step 18, the champions' signature moves -----
// his key in TUNING.champs: a later champion's own, a Pit champion's first name
export const champKey = (f) => (!f || f.beast ? null : f.ck || (f.champion ? f.name.split(' ')[0].toLowerCase() : null));
export const sigOf = (f) => { const C = TUNING.champs[champKey(f)]; return C && C.sig ? C : null; };
export const SIG_NAME = { rage: 'RED RAGE', capuan: 'CAPUAN FEINT', blink: 'BLINK', throw: "HUNTRESS'S THROW", twin: 'TWO BLADES' };
// a champion whose move strikes from where he stands plans each exchange as he gets ready
const plansEarly = (f) => { const C = sigOf(f); return !!C && (C.sig === 'blink' || C.sig === 'throw'); };
// His signature takes this exchange when it is ready: its wait over (every exchanges), his health under its mark, the Huntress far enough out with her
// spear in hand, and its chance on the fight RNG, or for sure once sure exchanges have passed (a Huntress too close then backs off to make room).
// Aquila's switch is not an exchange (twinCheck); once he has two blades, his signature is a combo at two heights.
function sigMove(rng) {
  const f = state.foe, C = sigOf(f);
  if (!C || (C.sig === 'twin' && !f.twin)) return null;
  if (++state.sigN <= C.every) return null;
  const sure = state.sigN > C.sure;
  if (C.below && f.hp > f.maxHp * C.below) return null;
  if (C.sig === 'throw' && (state.spearT > 0 || state.step.x - bodyPos() < C.range)) { if (sure && state.spearT <= 0) state.retreat = Math.max(state.retreat, TUNING.retreat.dur); return null; }
  if (!sure && !rng.chance(C.chance)) return null;
  state.sigN = 0;
  return buildSig(rng, C.sig, C);
}
export function buildSig(rng, sig, C) {
  const f = state.foe, base = TUNING.swing.windup * f.weapon.speed * f.size.wind * statMul('spdWind', f.spd) * (bout().tell || 1), M = TUNING.moves;
  const mv = { kind: sig, sig, cost: 0, hits: [], chain: sig === 'rage', blocked: 0 };
  const blow = (zone, wind, dmg, pose, o = {}) => ({ zone, wind, dmg: blowDmg(dmg), pose, ...o });
  if (sig === 'rage') {
    // HIGH, MID, LOW in that order, each shown by his arm; the first after the roar
    ['high', 'mid', 'low'].forEach((z, i) => mv.hits.push(blow(z, base * C.wind + (i ? 0 : C.roar), M.combo.dmg, ZONE_POSE[z], i ? {} : { pre: C.roar })));
    mv.cost = M.combo.cost * 3;
  } else if (sig === 'capuan') {
    // two fakes, the second quicker, then the real blow: each fake winds as a feint's fake does and ends in its violet hesitation
    const a = pickZone(rng, null), b = pickZone(rng, null, a), c = pickZone(rng, blockRun(), b);
    mv.hits.push(blow(a, base * C.fakes[0], 0, ZONE_POSE[a], { dud: true }), blow(b, base * C.fakes[1], 0, ZONE_POSE[b], { dud: true }), blow(c, base * C.real, M.chop.dmg, ZONE_POSE[c]));
    mv.cost = M.feint.cost * 2;
  } else if (sig === 'blink') {
    const z = pickZone(rng, blockRun(), 'low');
    mv.hits.push(blow(z, base * C.wind, M.chop.dmg, ZONE_POSE[z], { spring: C.crouch, leap: C.leap, close: C.close }));
    mv.cost = M.thrust.cost;
  } else if (sig === 'throw') {
    const z = pickZone(rng, blockRun(), 'low');
    mv.hits.push(blow(z, base * C.wind, C.dmg, 'throw'));
    mv.cost = M.thrust.cost;
  } else if (sig === 'twin') {
    // his two-blade combo, each blow at two heights (buildMove adds the second while he is twin)
    return { ...buildMove(rng, 'combo', { avoid: blockRun(), wind: 1 }), sig, blocked: 0 };
  }
  return mv;
}
// Step 20: the move's name across the arena every time it comes, its tell's slow beat, its own sound and flash, and its count for the export
function sigStart(E, sig) {
  const X = TUNING.sigFx, n = state.specials[sig] || (state.specials[sig] = [0, 0]);
  n[0]++;
  state.banner = { s: `${SIG_NAME[sig]}!`, t: TUNING.juice.banner * 1.3, max: TUNING.juice.banner * 1.3, sig: true };
  slowFx(X.beat, X.mul);
  if (sig === 'rage') { E.audio.noise({ dur: 0.55, gain: 0.16 }); E.audio.beep({ freq: 150, dur: 0.55, type: 'sawtooth', slide: 0.55, gain: 0.1 }); }
  else if (sig === 'capuan') whisper(E);
  else if (sig === 'blink') { E.audio.noise({ dur: 0.3, gain: 0.12 }); E.audio.beep({ freq: 380, dur: 0.3, type: 'sine', slide: 2.6, gain: 0.07 }); }
  else if (sig === 'throw') E.audio.beep({ freq: 1250, dur: 0.18, type: 'sine', slide: 1.3, gain: 0.05 });
  else if (sig === 'twin') { E.flash('#ffd24a', X.flash * 0.6); E.audio.beep({ freq: 990, dur: 0.25, type: 'triangle', gain: 0.07 }); E.audio.beep({ freq: 1480, dur: 0.3, type: 'triangle', gain: 0.05, delay: 0.06 }); }
}
// the Capuan fake's whisper: a breath of noise and a falling hiss
function whisper(E) { E.audio.noise({ dur: 0.32, gain: 0.05 }); E.audio.beep({ freq: 2400, dur: 0.28, type: 'sine', slide: 0.55, gain: 0.025 }); }
// An answer: READ!, a chime, and the punish window lit in gold for dur s (play.render: readGlow). Its count goes to the export.
function sigRead(E, sig, dur) {
  const n = state.specials[sig] || (state.specials[sig] = [0, 0]), Ff = foeF(E);
  n[1]++; state.readT = dur; state.readMax = dur;
  pop(Ff.x, Ff.y - 1.42 * Ff.H, 'READ!', '#ffd24a', TUNING.sigFx.read, 10 + E.safe.top + hudRow().shield + 40, 1.1, 20);
  ring(Ff.x, Ff.y - 0.55 * Ff.H, 0.6 * Ff.H, '#ffd24a');
  E.audio.beep({ freq: 880, dur: 0.12, type: 'triangle', gain: 0.12 }); E.audio.beep({ freq: 1320, dur: 0.22, type: 'sine', gain: 0.1, delay: 0.09 }); E.haptic(25);
}
// Aquila at half health: he stops, the Emperor signals from his box, the shield is thrown aside and a second gladius drawn (twinTick)
function twinCheck(E) {
  const f = state.foe, C = sigOf(f);
  if (!C || C.sig !== 'twin' || f.twin || state.switchT > 0 || f.hp <= 0 || f.hp > f.maxHp * C.at || state.fallT > 0) return;
  dropBlow(); state.winded = 0; state.open = 0; state.stun = 0; state.stagger = 0;
  state.switchT = C.signal; state.swingIn = Math.max(state.swingIn, 0.8);
  sigStart(E, 'twin'); E.audio.beep({ freq: 330, dur: 0.5, type: 'sawtooth', slide: 1.5, gain: 0.08 }); E.audio.beep({ freq: 495, dur: 0.6, type: 'triangle', gain: 0.08, delay: 0.25 });
}
function twinTick(E, dt) {
  const f = state.foe, C = TUNING.champs.aquila;
  state.switchT -= dt;
  if (!f.twin && state.switchT <= C.signal * (1 - C.toss)) {
    // the shield flies aside; every guard and his shield arm's plate come off with it
    f.twin = true; f.dual = true; f.shield = false; state.flyS = 0.9; state.cover = null;
    for (const p of f.parts) { if (p.guard) p.guard = false; if (p.d.id === 'armB') p.armour = false; }
    sigPop(E, 'GAPS OPEN'); clangSound(E, 0); swooshSound(E, 0.16); shake(E, 5, 0.15); E.flash('#ffd24a', TUNING.sigFx.flash);
  }
  if (state.switchT <= 0) { state.switchT = 0; state.swingIn = Math.min(state.swingIn, 0.6); }
}
// Step 22: a foe with a sidearm draws it when you close inside near (H past his reach) and goes back to his long weapon past far, only between
// exchanges; for TUNING.sidearm.foe.swap s after it he holds off his next blow
function foeSidearm(E, dt) {
  const f = state.foe, SF = TUNING.sidearm.foe;
  state.foeSwapT = Math.max(0, state.foeSwapT - dt);
  if (!f.sideW || state.sw || state.plan || state.foeSwapT > 0 || state.disarm > 0 || state.stagger > 0) return;
  const d = state.step.x - bodyPos() - f.size.reach, long = f.weapon === f.mainW;
  if (long ? d > SF.near : d < SF.far) return;
  setWeapon(f, long ? f.sideW : f.mainW);
  state.foeSwapT = SF.swap; state.swingIn = Math.max(state.swingIn, SF.swap); state.foeSwaps++;
  const Ff = foeF(E); pop(Ff.x, Ff.y - 1.15 * Ff.H, f.wname, '#fde68a', 16); swooshSound(E);
}
// the Huntress's spear thrown: she fights with her dagger (unarmed a while if it missed you) until she picks it up again
export function spearOut(E, missed) {
  const f = state.foe, C = TUNING.champs.mevia;
  state.spearT = C.pick; state.spearAt = bodyPos() + 0.2;
  setWeapon(f, TUNING.weapons.find((w) => w.id === 'dagger'));
  if (missed) { state.disarm = Math.max(state.disarm, C.unarmed); sigPop(E, 'UNARMED!'); }
}
// Step 19: your trait's (green) or drive's (gold) tag over you as it fires, as PLATE TOOK IT does; the same one at most once each TUNING.tag.gap s.
// state.tagN counts each firing.
export function tagPop(E, key, t, isDrive = false) {
  state.tagN[key] = (state.tagN[key] || 0) + 1;
  if (state.m - (state.tagM[key] ?? -99) < TUNING.tag.gap) return;
  state.tagM[key] = state.m;
  const Fy = youF(E); pop(Fy.x + 0.1 * Fy.H, Fy.y - 1.32 * Fy.H, t, isDrive ? '#fbbf24' : '#86efac', TUNING.tag.size);
}
// a word over him, kept under the right HUD's rows
function sigPop(E, t) { const Ff = foeF(E); pop(Ff.x - 0.2 * Ff.H, Ff.y - 1.15 * Ff.H, t, '#ffd24a', 22, 10 + E.safe.top + hudRow().shield + 40); }
function setWeapon(f, w) { f.weapon = w; f.wname = w.name; f.home = w.range + f.size.reach; f.strike = w.strike + f.size.reach; }
// the stamp that ends the Red Rage's roar
function rageStamp(E) {
  const Ff = foeF(E); dust(Ff.x + 0.05 * Ff.H, Ff.y, 12); thud(E, 1.4); shake(E, 5, 0.15); E.haptic(20);
}
// An exchange: a rhythm (flurry, probe or pause), one to three moves weighted by his weapon and by what he has read of you, his mood if hurt, the pause after.
export function planExchange(E) {
  const rng = state.rng, f = state.foe, R = TUNING.read;
  // a champion's signature move, when it is ready, is the whole exchange
  const sig = sigMove(rng);
  if (sig) return { q: [sig], gap: 0, after: nextGap(), rhythm: 'sig', avoid: null };
  const avoid = blockRun(), turtle = turtling(), press = pressing();
  const rh = pickW(rng, TUNING.rhythm.map((r) => [r, r.w * (press && r.id === 'flurry' ? R.pressMul : 1)]));
  const n = rng.int(rh.n[0], rh.n[1]), wind = rh.wind * (press ? R.pressWind : 1), q = [];
  for (let i = 0; i < n; i++) {
    const w = Object.entries(movesOf(f)).filter(([k]) => k !== 'feint' || bout().feints).map(([k, v]) => [k, v * (k === 'feint' ? rh.feint * arenaT().feint * (turtle ? R.turtleFeint : 1) * (foeHas('myfeint') ? TUNING.foeGear.hood : 1) : k === 'shove' && turtle ? R.turtleBash : 1) * (avoid && MOVE_ZONE[k] === avoid ? R.avoid : 1)]);
    if (f.shield) w.push(['bash', TUNING.moves.bash.w * (turtle ? R.turtleBash : 1)]);
    const kind = pickW(rng, w);
    q.push(buildMove(rng, kind, { avoid, wind }));
    // a combo ends the exchange: he is winded after it
    if (kind === 'combo') break;
  }
  state.mood.retreat = rng.chance(TUNING.retreat.chance);
  if (avoid) { state.zoneReads++; readPop(E, `READS YOUR ${ZONE[avoid].label} GUARD`); }
  else if (turtle) { state.turtleReads++; readPop(E, 'READS YOUR SHIELD'); }
  else if (press) { state.presses++; readPop(E, 'PRESSES YOU'); }
  return { q, gap: rh.gap, after: nextGap() * rh.after, rhythm: rh.id, avoid };
}

export function startMove(E, mv, isCounter) {
  const f = state.foe;
  // Puppeteer: every third move of his (never a counter, never a beast's) is a feint, and it shows from its first tell
  if (has('puppet') && !isCounter && !f.beast && ++state.puppetN % C_().puppet === 0) { if (mv.kind !== 'feint') mv = buildMove(state.rng, 'feint', { avoid: blockRun(), wind: 1 }); mv.puppet = true; }
  state.move = mv; mv.idx = 0; mv.counter = !!isCounter;
  f.sta -= mv.cost; f.staT = 0;
  state.moveCount[mv.kind] = (state.moveCount[mv.kind] || 0) + 1;
  if (mv.kind === 'feint') state.feints++; else if (mv.kind === 'combo') state.combos++; else if (mv.kind === 'bash') state.bashes++; else if (mv.kind === 'net') state.nets++;
  startBlow(E);
}
export function startBlow(E) {
  const mv = state.move, h = mv.hits[mv.idx], f = state.foe;
  settleFeint('none');
  if (f.beast) beastSound(E, f.beast, h.pose); else windSound(E, f.weapon.id);
  state.feintLive = !!h.fake;
  // a lamed sword arm (a beast's foreleg) slows every wind-up; a beast's lamed leg slows its pounce or charge
  const charge = f.beast && (h.pose === 'pounce' || h.pose === 'shove') && (lamed('legs') || lamed('legF'));
  // Bait: the first blow he starts after you drop a held shield has twice the tell (never a counter)
  // Feigned Guard: the first blow he starts after you lower your shield is open to a riposte when it is done (endBlow)
  const bait = state.baitT > 0 && !mv.counter, feigned = state.feign && !mv.counter;
  if (bait) { state.baitT = 0; const Ff = foeF(E); pop(Ff.x, Ff.y - 1.25 * Ff.H, 'TAKES THE BAIT', '#c4b5fd', 18); }
  if (feigned) state.feign = false;
  const k = (1 + (lamed(f.beast ? 'legF' : 'armF') ? TUNING.lame.arm : 0) + (charge ? TUNING.lame.pounce : 0)) * (has('vein') && state.bleed.length ? TUNING.cards.vein : 1) * (bait ? C_().bait : 1) * netMul(1 + TUNING.me.net.wind);
  state.sw = {
    zone: ZONE[h.fake || h.zone], real: ZONE[h.zone], fake: h.fake ? ZONE[h.fake] : null, fakePose: h.fakePose, switchAt: (h.switchAt || 0) * k, switched: false,
    t: 0, wind: h.wind * k, dmg: h.dmg, pose: h.pose, kind: mv.kind, idx: mv.idx, n: mv.hits.length, counter: mv.counter, fin: 0, outcome: null, th0: f.th,
    hes: (h.hes || 0) * k, hesOn: false, realAt: 0, lesson: null, body0: bodyPos(), m0: state.m,
    springAt: h.pose === 'pounce' ? h.wind * k * TUNING.moves.pounce.at : h.spring ? h.wind * k * h.spring : 0, spring: false, from: 0, land: 0, leap: h.leap || 0, close: h.close, puppet: !!mv.puppet, feigned,
    // step 18: the Red Rage's roar before the first blow, a Capuan fake, Aquila's second height
    pre: (h.pre || 0) * k, dud: !!h.dud, zone2: h.zone2 ? ZONE[h.zone2] : null, pose2: h.pose2 || null, dmg2: h.dmg2 || 0,
  };
  // a Capuan fake shows as a feint's fake to its end, and never jumps
  if (h.dud) { const s0 = state.sw; s0.fake = s0.zone; s0.fakePose = h.pose; s0.switchAt = s0.wind - TUNING.champs.varro.hes * k; s0.hes = Infinity; }
  if (mv.sig && mv.idx === 0) sigStart(E, mv.sig);
  else if (h.dud) whisper(E);
  if (h.pre) E.audio.beep({ freq: 95, dur: 0.6, type: 'sawtooth', slide: 0.7, gain: 0.14 });
  // Grand Deceiver: his fake's hesitation starts sooner, and the switch comes when it would have
  const sw = state.sw;
  if (sw.fake && has('deceiver')) { const e = sw.switchAt * Math.min(C_().deceiveMax, C_().deceiveFake * famN('trick')); sw.switchAt -= e; sw.hes += e; }
  // Reads the Scroll: the same, from your background
  if (sw.fake && trait('alexandria')) { const e = sw.switchAt * TUNING.origins.alexandria.sooner; sw.switchAt -= e; sw.hes += e; sw.scroll = true; }
  // the first feint ever is a slow-motion lesson, the second a short reminder (counted in the save)
  if (h.fake && state.lessons < 2) {
    state.sw.lesson = state.lessons === 0 ? 'slow' : 'remind';
    state.lessons++; E.save.set('feintLesson', state.lessons);
  }
}
// the fake ends in a violet hesitation; then the glow jumps to the real zone
function feintHesitate(E) {
  const sw = state.sw, L = TUNING.lesson;
  sw.hesOn = true;
  if (sw.scroll) tagPop(E, 'alexandria', 'READS THE SCROLL');
  E.audio.beep({ freq: 620, dur: 0.12, type: 'sine', slide: 0.7, gain: 0.08 });
  if (sw.lesson === 'slow') state.caption = { lines: [`FEINT! He faked ${sw.fake.label}.`, 'Wait for the glow to settle, then block where it lands.'], t: L.cap, max: L.cap };
  else if (sw.lesson === 'remind') state.caption = { lines: ['Feint: wait for the glow to settle.'], t: L.remind, max: L.remind };
}
// the jump: a crisp snap, and the real zone's button flashes under the thumb
export function feintSwitch(E) {
  const sw = state.sw;
  sw.switched = true; sw.th0 = state.foe.th; sw.zone = sw.real; sw.realAt = sw.t; state.snapT = TUNING.moves.feint.snap;
  const Ff = foeF(E); pop(Ff.x - 0.3 * Ff.H, zoneScreenY(lay(E), sw.real) + 0.16 * lay(E).H, 'FEINT!', '#c4b5fd', 20);
  E.audio.noise({ dur: 0.025, gain: 0.3 });
  E.audio.beep({ freq: 2200, dur: 0.03, type: 'square', slide: 0.5, gain: 0.08 });
  E.audio.beep({ freq: 1100, dur: 0.05, type: 'triangle', gain: 0.1, delay: 0.01 });
  E.haptic(12);
}
// the pounce's spring: from where it crouched to its striking distance from you (at most its leap), spraying sand from its hind feet
function spring(E, sw) {
  const f = state.foe, from = state.step.x, lo = state.foot.pos + gMin(E);
  sw.spring = true; sw.from = from; sw.land = clamp(Math.max(bodyPos() + (sw.close != null ? sw.close : f.strike), from - (sw.leap || leapOf())), lo, from);
  const Ff = foeF(E), [hx, hy] = toScreen(Ff, f.beast ? -0.27 : -0.1, 0);
  sand(hx, hy, 1, TUNING.juice.sand); swooshSound(E, 0.16);
}
// a Capuan fake winds to its end and is pulled back: the next wind-up starts at once
function dudEnd(E) {
  const mv = state.move; state.sw = null;
  E.audio.beep({ freq: 520, dur: 0.06, type: 'triangle', slide: 0.6, gain: 0.07 });
  if (mv && mv.idx + 1 < mv.hits.length) { mv.idx++; startBlow(E); } else endBlow(E);
}
// a blow is done: the next blow of a combo, the next move of the exchange, or a pause; winded after a combo or at zero stamina, open otherwise
export function endBlow(E) {
  const mv = state.move, sw = state.sw; state.sw = null;
  // Feigned Guard: the blow he started after you lowered your shield leaves him open to a riposte
  if (sw && sw.feigned && state.fallT <= 0) { state.riposte = TUNING.shield.riposte; const Ff = foeF(E); pop(Ff.x, Ff.y - 1.25 * Ff.H, 'OPEN TO A RIPOSTE', '#7dd3fc', 18); }
  if (mv && !mv.broken && mv.idx + 1 < mv.hits.length) { mv.idx++; startBlow(E); return; }
  state.move = null;
  const plan = state.plan;
  if (plan && plan.q.length) state.swingIn = plan.gap; else { state.swingIn = plan ? plan.after : nextGap(); state.plan = null; }
  // a signature answered opens him: all three of the Red Rage blocked, the Capuan Feint's real blow blocked, the Blink's dash met well-timed
  // (step 20: the Huntress's throw answered leaves her unarmed, Aquila's two-height combo answered when none of it lands; each answer is READ!)
  if (mv && mv.sig && state.fallT <= 0) {
    const C = sigOf(state.foe), won = mv.sig === 'rage' ? mv.blocked >= mv.hits.length : mv.sig === 'twin' ? !mv.hit : mv.won;
    if (mv.sig === 'blink' && !won) { state.retreat = C.back; state.swingIn = Math.max(state.swingIn, C.back); }
    if (won && mv.sig === 'throw') sigRead(E, 'throw', state.disarm);
    if (won && mv.sig !== 'throw') { const dur = mv.sig === 'blink' ? C.off : C.winded; windFoe(E, dur); sigRead(E, mv.sig, dur); return; }
  }
  if (state.foe.sta <= 0) windFoe(E, TUNING.foeSta.winded);
  else if (mv && mv.kind === 'combo' && !mv.broken) windFoe(E, TUNING.foeSta.combo);
  else state.open = TUNING.open.dur * (sw && (sw.outcome === 'dodge' || sw.outcome === 'whiff') ? growth('winddancer', 'dancer', C_().windOpen) : 1);
}
export function spendFoe(E, n) {
  const f = state.foe; f.sta -= n; f.staT = 0;
  if (f.sta <= 0 && !state.sw && state.winded <= 0) windFoe(E, TUNING.foeSta.winded);
}
// winded is the open window: a brief slow, OPEN!, and his slots glow until he recovers
export function windFoe(E, dur) {
  if (state.fallT > 0) return;
  state.winded = dur; state.windedMax = dur; state.windeds++; state.slowT = TUNING.openWin.dur;
  const Ff = foeF(E); pop(Ff.x, Ff.y - 1.2 * Ff.H, 'OPEN!', '#ffd24a', 34); E.flash('#ffd24a', 0.06);
  state.sw = null; state.move = null; state.plan = null; state.open = 0; state.retreat = 0; state.swingIn = Math.max(state.swingIn, 0.6);
  state.foe.sta = Math.max(0, state.foe.sta);
  E.audio.beep({ freq: 180, dur: 0.3, type: 'sine', slide: 0.5, gain: 0.16 });
}

export function updateFoe(dt, E) {
  const f = state.foe, FS = TUNING.foeSta;
  if (state.fallT > 0 || state.intro) return;
  // the Huntress picks her spear up again
  if (state.spearT > 0 && (state.spearT -= dt) <= 0) { setWeapon(f, TUNING.weapons.find((w) => w.id === 'spear')); state.spearAt = null; swooshSound(E, 0.1); }
  twinCheck(E);
  if (state.switchT > 0) { twinTick(E, dt); return; }
  f.staT += dt;
  if (!state.sw && f.staT > FS.delay) f.sta = Math.min(f.staMax, f.sta + FS.regen * (state.winded > 0 ? FS.windedRegen : 1) * dt);
  state.retreat = Math.max(0, state.retreat - dt);
  if (state.winded > 0) { state.winded = Math.max(0, state.winded - dt); return; }
  if (state.stun > 0) { state.stun -= dt; return; }
  foeSidearm(E, dt);
  const sw = state.sw;
  if (sw) {
    if (sw.fin > 0) { sw.fin -= dt; if (sw.fin <= 0) endBlow(E); return; }
    sw.t += dt;
    if (sw.fake && raised() && state.sh.zone === sw.fake) sw.sawFake = true;
    if (fakeShowing() && bodyPos() < sw.body0 - TUNING.foot.give) sw.gaveFake = true;
    if (sw.fake && !sw.switched) {
      if (!sw.hesOn && sw.t >= sw.switchAt) feintHesitate(E);
      if (sw.t >= sw.switchAt + sw.hes) feintSwitch(E);
    }
    if (sw.springAt > 0 && !sw.spring && sw.t >= sw.springAt) spring(E, sw);
    if (sw.pre && !sw.stamped && sw.t >= sw.pre) { sw.stamped = true; rageStamp(E); }
    if (sw.kind === 'throw' && !sw.thrown && sw.t >= sw.wind - TUNING.champs.mevia.flight) {
      const fr = f.fr.armF, Fy = youF(E);
      sw.thrown = true; sw.rel = toScreen(foeF(E), fr.ox - Math.sin(fr.rot) * ARM_LEN, fr.oy + Math.cos(fr.rot) * ARM_LEN); sw.aim = [Fy.x + 0.12 * Fy.H, zoneScreenY(lay(E), sw.zone)];
      swooshSound(E, 0.22); E.audio.beep({ freq: 1500, dur: TUNING.champs.mevia.flight + 0.12, type: 'sine', slide: 1.9, gain: 0.06 });
    }
    if (sw.t >= sw.wind) { if (sw.dud) dudEnd(E); else resolveSwing(E); }
    return;
  }
  if (state.stagger > 0) return;
  state.swingIn -= dt;
  // a beast (and a champion whose move strikes from where he stands) plans its exchange as it gets ready, so its feet know whether it springs from
  // where it stands (a pounce) or walks in
  if ((f.beast || plansEarly(f)) && !state.plan && state.swingIn < TUNING.step.lead && state.endT <= 0) state.plan = planExchange(E);
  // he commits only once you are inside his reach (a pounce's, from further); until then his footwork closes in
  if (state.swingIn <= 0 && state.endT <= 0 && inReach(state.plan ? reachOf(state.plan.q[0]) : 0)) {
    if (!state.plan && awed(E)) return;
    if (!state.plan) state.plan = planExchange(E);
    startMove(E, state.plan.q.shift(), false);
  }
}

// Darling of Rome: with the meter at its top he stands in awe a moment before each exchange (a beast, which plans as it gets ready, is never awed)
function awed(E) {
  if (state.awed || !has('darling') || state.fav < C_().aweAt) { state.awed = false; return false; }
  state.awed = true; stunFoe(E, C_().awe, 'IN AWE');
  return true;
}

// ----- the City's pairs: one foe fights, the other waits at the edge -----
// When the one fighting is winded, his partner taunts from the edge in the window's last half second and they swap as it closes; when he is felled, the
// partner taunts and takes over. The one who leaves keeps his health, cuts, lamings and bleed, and gets his breath back at the edge.
// The Colosseum's Beastmaster is the same machinery with his lion: it roars from the edge and steps in once his health falls to half (never on a winding),
// and he comes back if it falls first.
const TAUNT = { winded: 'Now, brother!', fell: 'For my brother!', beast: 'RRROAR!', master: 'My lion! Now you pay.' };
export function taunt(E, why) {
  const e = state.edge, sends = !!state.gauntlet[state.rack].sends;
  state.tauntT = TUNING.pairs.taunt; state.taunt = TAUNT[e && e.beast ? 'beast' : sends ? 'master' : why];
  if (e && e.beast) { beastSound(E, e.beast, 'pounce'); return; }
  E.audio.beep({ freq: 300, dur: 0.12, type: 'sawtooth', slide: 1.3, gain: 0.08 }); E.audio.beep({ freq: 420, dur: 0.14, type: 'sawtooth', slide: 0.8, gain: 0.07, delay: 0.12 });
}
export function stepIn(E) {
  const out = state.foe, inn = state.edge, fellOut = state.fallT > 0;
  out.bleed = state.bleed; out.dents = state.dents; out.shrug = state.bout.foeShrug; out.down = fellOut; out.sta = out.staMax;
  state.foe = inn; state.edge = out;
  state.bleed = inn.bleed; state.dents = inn.dents; state.bout.foeShrug = inn.shrug;
  state.fallT = 0; state.sw = null; state.move = null; state.plan = null; state.stun = 0; state.stagger = 0; state.winded = 0; state.open = 0; state.retreat = 0; state.chase = 0;
  state.cover = null; state.disarm = 0; state.flyW = 0; state.kickA = 0; state.kickV = 0; state.pop = 1; state.swapping = false; state.tauntT = 0; state.sendT = 0;
  Object.assign(state, { sigN: 0, switchT: 0, gbreak: 0, coverHits: 0, offHit: null });
  state.step = { x: walls(E).fore, tgt: 0, t: 1, dodgeT: 0, dodgeCool: 0 };
  state.swingIn = Math.max(state.swingIn, TUNING.pairs.enter);
  inn.th = REST_TH;
  poseFoe(E, 0.016);
  if (fellOut && state.carry) { addBleed(E, state.carry); state.carry = 0; }
  const Ff = foeF(E); pop(Ff.x, Ff.y - (inn.beast ? 0.8 : 1.2) * Ff.H, `${inn.name.split(' ')[0].toUpperCase()} STEPS IN`, '#fca5a5', 22);
  dust(Ff.x, Ff.y, 10); shake(E, 4, 0.15); swooshSound(E, 0.14);
  if (inn.beast) { const [hx, hy] = toScreen(Ff, -0.27, 0); sand(hx, hy, 1, TUNING.juice.sand >> 1); }
}
// the swap clock, after his AI each frame (the fell's is in the play scene's fall clock)
export function updatePair(E, dt) {
  state.tauntT = Math.max(0, state.tauntT - dt);
  const e = state.edge, P = TUNING.pairs, f = state.foe;
  if (!e || e.down || state.fallT > 0) return;
  if (state.gauntlet[state.rack].sends) {
    if (!state.sent && !f.beast && f.hp <= f.maxHp * TUNING.champs.carpophorus.send) { state.sent = true; state.sendT = P.taunt; taunt(E, 'winded'); dropBlow(); state.swingIn = Math.max(state.swingIn, P.taunt + 0.2); }
    if (state.sendT > 0 && (state.sendT -= dt) <= 0) stepIn(E);
    return;
  }
  if (state.swapping && state.winded > P.taunt) state.swapping = false;
  if (!state.swapping && state.winded > 0 && state.winded <= P.taunt) { state.swapping = true; taunt(E, 'winded'); }
  if (state.swapping && state.winded <= 0) stepIn(E);
}
// the waiting foe at the edge: smaller, dimmer, standing at rest
export function edgeF(E, f = state.edge) {
  const L = lay(E), H = L.H * drawK(f) * pairScale();
  return { x: E.w - E.safe.right - edgeX(f) * H, y: L.floor, a: 0, dir: -1, H };
}
export function poseEdge(f) {
  if (f.beast) { beastRest(f); return; }
  f.fr = { armF: { ox: SHOULDER[0], oy: SHOULDER[1], rot: REST_TH - Math.PI / 2 }, armB: { ox: PARTS[4].joint[0], oy: PARTS[4].joint[1], rot: f.dual ? TUNING.dual.rest : 0.14 } };
  for (const p of f.parts) {
    const fr = f.fr[p.d.frame || p.d.id] || ZERO, c = Math.cos(fr.rot), sn = Math.sin(fr.rot);
    p.cx = fr.ox + p.d.x * c - p.d.y * sn; p.cy = fr.oy + p.d.x * sn + p.d.y * c;
  }
}

// A counter is a fresh one-move exchange: a quick thrust or chop, planned now with the fight RNG, its zone glowing like any tell.
export function counter(E, kind) {
  if (!bout().counters || state.sw || state.fallT > 0 || state.stun > 0 || state.endT > 0 || state.stagger > 0 || state.winded > 0 || state.intro || !inReach()) return;
  const B = beastOf(state.foe), k = B ? B.counter : kind || (state.rng.chance(0.5) ? 'thrust' : 'chop');
  state.plan = null;
  startMove(E, buildMove(state.rng, k, { avoid: blockRun(), wind: 1, fixed: TUNING.counter.windup * statMul('spdWind', state.foe.spd) }), true);
  state.counters++;
  const Ff = foeF(E); pop(Ff.x, Ff.y - 1.0 * Ff.H, 'COUNTER!', '#ff8a7a', 20);
}
// Every feint ends as exactly one of read, bitten or neither (dodged, out of reach, or cut short by a stun, a winding or a fell).
export function settleFeint(how) {
  if (!state.feintLive) return;
  state.feintLive = false;
  if (how === 'none') state.feintsNone++;
}
