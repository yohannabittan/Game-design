// Arena: Feature: Trials (steps 27 and 27b). Short drills with a goal, a medal and a best, between runs. Hooks: the menu's Trials button (scenes.js,
// the `trials` scene here), play.enter (startTrial for params.trial), play.update (updateTrial, beside the yard's), play.render (drawTrial), play.onTap
// (trialTap), foe.js sigOf (a trial's own signature numbers), game.js noShield and saveRun (a trial saves no run), draw-fight.js (his fists draw no weapon).
import { clamp, makeRng, hashString } from '../engine.js';
import { TUNING } from '../tuning.js';
import { ZONES } from '../data.js';
import { startMove } from '../foe.js';
import { shieldBtns, raised } from '../fight.js';
import { rrect, weaponArt } from '../draw-fight.js';
import { fitSize } from '../screens.js';
import { initHand, beginBout, portrait, rotateCard } from '../scenes.js';
import { state, rollMe, kitMe, newRound, newRack, sizeOf, artImg } from '../game.js';
import { startRange, updateRange, rangeCount } from './range.js';

// ====== TRIALS ======
// Each trial: its tab, name, goal (eight words at most), what its best is (label) and how it is scored (time: seconds, less is better; else a count).
// soon: shown on the grid, not yet playable (the range, T2).
export const TABS = [['range', 'Range'], ['blades', 'Blades'], ['fists', 'Fists'], ['champions', 'Champions']];
export const TRIALS = [
  { id: 'shrinkKnives', tab: 'range', name: 'Shrinking Target: knives', goal: 'Hit shrinking targets. 3 misses end it.', label: 'TARGETS', icon: 'knives' },
  { id: 'shrinkBow', tab: 'range', name: 'Shrinking Target: bow', goal: 'The same, with the bow.', label: 'TARGETS', icon: 'bow' },
  { id: 'knifeWork', tab: 'range', name: 'Knife Work', goal: 'Fell him with knives alone.', label: 'KNIVES LEFT', icon: 'knives' },
  { id: 'apple', tab: 'range', name: 'The Apple Shot', goal: 'Shoot the fruit, not the man.', label: 'FRUITS', icon: 'bow', seller: 'Fruits from a land past the edge of the world! Mind the man.' },
  { id: 'board', tab: 'range', name: 'The Knife Board', goal: 'Burst the pots, not the man.', label: 'POTS', icon: 'knives' },
  { id: 'wheel', tab: 'range', name: 'The Wheel', goal: 'Burst the pots as he spins.', label: 'POTS', icon: 'knives' },
  { id: 'ironwall', tab: 'blades', name: 'Iron Wall', goal: 'Perfect blocks in a row.', label: 'STREAK', icon: 'gladius' },
  { id: 'gaphunter', tab: 'blades', name: 'Gap Hunter', goal: '5 gap stabs before time runs out.', label: 'BEST TIME', time: true, icon: 'dagger' },
  { id: 'breaker', tab: 'blades', name: 'Breaker', goal: 'Break all his plates.', label: 'BEST TIME', time: true, icon: 'mace' },
  { id: 'knuckles', tab: 'fists', name: 'Bare Knuckles', goal: 'Fell him with your fists.', label: 'HEARTS LEFT', icon: 'fist' },
  { id: 'stagger', tab: 'fists', name: 'Stagger Him', goal: '5 staggers before time runs out.', label: 'BEST TIME', time: true, icon: 'fist' },
  { id: 'brawl', tab: 'fists', name: 'Brawl', goal: 'Fell two in a row.', label: 'HEARTS LEFT', icon: 'fist' },
  { id: 'capuan', tab: 'champions', name: 'The Capuan Feint', goal: "Read Varro's feint three times.", label: 'READS', of: 5, icon: 'champ-varro' },
  { id: 'rage', tab: 'champions', name: 'Weather the Rage', goal: 'Survive Red Rage three times.', label: 'HEARTS LEFT', icon: 'champ-marcus' },
];
export const TRIAL = Object.fromEntries(TRIALS.map((t) => [t.id, t]));

// Each trial's set-up: your weapon and kit (no shield: fists only), and his (or their) record: name, band, weapon, armour set, stats, shield, champion.
// immortal: he never falls (his health stays full and is not shown); calm: he never swings on his own.
const SETUP = {
  ironwall: { me: ['gladius', ['helmet']], foe: { name: 'Sparring partner', band: 'medium', weapon: 'gladius', set: 'light', stats: [3, 3, 3] }, immortal: true, calm: true },
  gaphunter: { me: ['dagger', ['helmet']], foe: { name: 'Iron Gaius', band: 'big', weapon: 'gladius', set: 'heavy', stats: [3, 2, 3], shield: true }, immortal: true },
  breaker: { me: ['mace', ['helmet']], foe: { name: 'The Anvil', band: 'big', weapon: 'gladius', set: 'heavy', stats: [2, 2, 4], shield: true }, immortal: true, calm: true },
  knuckles: { me: ['fist', []], bare: true, foe: { name: 'Lucius the Quick', band: 'lean', weapon: 'fist', set: 'light', stats: [2, 3, 2] } },
  stagger: { me: ['fist', []], bare: true, foe: { name: 'Big Brennus', band: 'big', weapon: 'gladius', set: 'medium', stats: [3, 2, 4], shield: true }, immortal: true },
  brawl: { me: ['fist', []], bare: true, foe: { name: 'Titus', band: 'medium', weapon: 'fist', set: 'light', stats: [2, 3, 2] }, pair: { name: 'Quintus', band: 'medium', weapon: 'fist', set: 'light', stats: [3, 2, 2] } },
  capuan: { me: ['gladius', ['helmet']], foe: { name: 'Varro of Capua', band: 'medium', weapon: 'gladius', set: 'medium', stats: [3, 4, 3], shield: false, champion: true }, immortal: true, sig: 'varro' },
  rage: { me: ['gladius', ['helmet']], foe: { name: 'Marcus the Red', band: 'big', weapon: 'gladius', set: 'medium', stats: [4, 3, 3], shield: false, champion: true }, immortal: true, sig: 'marcus' },
  // step 27b, the range (features/range.js): knives only; the range's man is a sparring foe, parked and unarmoured
  knifeWork: { me: ['fist', []], bare: true, foe: { name: 'Sextus the Swift', band: 'lean', weapon: 'gladius', set: 'light', stats: [2, 3, 2] } },
  shrinkKnives: { me: ['gladius', []], bare: true, range: true, foe: { name: 'The man', band: 'medium', weapon: 'fist', set: 'light', stats: [1, 1, 1] }, immortal: true, calm: true },
  board: { me: ['gladius', []], bare: true, range: true, foe: { name: 'The man', band: 'medium', weapon: 'fist', set: 'light', stats: [1, 1, 1] }, immortal: true, calm: true },
  wheel: { me: ['gladius', []], bare: true, range: true, foe: { name: 'The man', band: 'medium', weapon: 'fist', set: 'light', stats: [1, 1, 1] }, immortal: true, calm: true },
  // 2026-11-21, the bow on the range: the bow in hand (range.js)
  shrinkBow: { me: ['gladius', []], bare: true, range: true, foe: { name: 'The man', band: 'medium', weapon: 'fist', set: 'light', stats: [1, 1, 1] }, immortal: true, calm: true },
  apple: { me: ['gladius', []], bare: true, range: true, foe: { name: 'The man', band: 'medium', weapon: 'fist', set: 'light', stats: [1, 1, 1] }, immortal: true, calm: true },
};

const SAVE = 'trials';
export const trialRec = (E, id) => (E.save.get(SAVE, {}) || {})[id] || null;
// the medal a score earns: 0 none, 1 bronze, 2 silver, 3 gold
export function medalOf(id, score) {
  const M = TUNING.trials[id].medals, t = TRIAL[id].time;
  if (score == null) return 0;
  let m = 0;
  M.forEach((v, i) => { if (t ? score <= v : score >= v) m = i + 1; });
  return m;
}
const better = (id, a, b) => (b == null ? true : TRIAL[id].time ? a < b : a > b);
export const fmtScore = (id, v) => (v == null ? '—' : TRIAL[id].time ? `${v.toFixed(1)}s` : TRIAL[id].of ? `${v} / ${TRIAL[id].of}` : `${v}`);

// a foe's record, as rollFighter makes one, from a SETUP row (seeded parts, no gear, no guards)
function trialFoe(q, rng) {
  const T = TUNING, weapon = q.weapon === 'fist' ? T.trials.fist : T.weapons.find((w) => w.id === q.weapon), set = T.armourSets.find((z) => z.id === q.set);
  return { tier: 0, at: 0, name: q.name, ck: null, title: null, pair: null, champion: !!q.champion, size: sizeOf(q.band, 0), prof: 'balanced', weapon, set,
    str: q.stats[0], spd: q.stats[1], sta: q.stats[2], shield: !!q.shield, mace: false, dual: false, partSeed: (rng() * 2 ** 32) >>> 0, plus: 0, gear: [], guards: [], gaps: {} };
}
// the stock fighter: one band, every stat the same, a fixed origin and reason, bought the trial's weapon and kit
function trialMe(S) {
  const C = TUNING.trials.me, W = TUNING.me.wheels, me = rollMe(TUNING.trials.seed), idx = me.idx.slice(), at = (list, v) => list.findIndex((e) => e[0] === v);
  idx[0] = at(W.size, C.size); idx[1] = idx[2] = idx[3] = at(W.stat, C.stat); idx[6] = at(W.origin, C.origin); idx[7] = at(W.reason, C.reason);
  return kitMe({ ...me, idx }, S.me[0], S.me[1]);
}

// ----- the runner: the play scene with state.trial set (and state.drill, so no run is saved, no yard and no lesson) -----
export function startTrial(E, id) {
  const S = SETUP[id], T = TUNING.trials, rng = makeRng(T.seed ^ hashString(id));
  state.drill = true; state.train = null;
  newRound(E, T.seed, trialMe(S), null, 'pit', null);
  const d = trialFoe(S.foe, rng);
  if (S.pair) d.pair = trialFoe(S.pair, rng);
  state.gauntlet = [d];
  const C = S.sig ? { ...TUNING.champs[S.sig], ...T[id] } : null;
  // his blows' heights for Iron Wall, set here so every attempt meets the same run of them
  const zones = Array.from({ length: 60 }, () => ZONES[rng.int(0, ZONES.length - 1)].id);
  state.trial = { id, t: 0, score: 0, done: null, endT: 0, immortal: !!S.immortal, calm: !!S.calm, bare: !!S.bare, champs: C ? { [S.sig]: C } : null,
    zones, n: 0, sw: null, wait: T.intro, p0: 0, plates: 0, st0: 0, quit: null, stabs: 0, r0: 0, a0: 0, cm: null, dealt: 0, set: 0, note: null };
  newRack(E); initHand(E);
  // a brawler goes bareheaded (the pugil's drawn cap carries no crest colour for its plume)
  for (const f of [state.foe, state.edge]) if (f && f.weapon.id === 'fist' && f.look) f.look = { ...f.look, bare: 'hair' };
  state.intro = false;
  beginBout(E);
  state.hint = false; state.swingIn = Math.max(state.swingIn, T.intro);
  state.trial.plates = state.foe.parts.filter((p) => p.armour).length;
  delete state.range;
  if (S.range) startRange(E, id);
  if (id === 'knifeWork') { state.knives = T.knifeWork.knives; state.foe.maxHp = state.foe.hp = state.foe.shown = T.knifeWork.hp; }
}

// One frame of the trial: keep his health (immortal) or his blows (calm) in hand, count toward the goal, and end it when it is decided.
export function updateTrial(E, dt) {
  const tr = state.trial, T = TUNING.trials, C = T[tr.id], f = state.foe;
  if (tr.done) { if ((tr.endT += dt) >= T.end) showEnd(E); return; }
  tr.t += dt;
  if (tr.id === 'rage') rageWounds(tr, C, f, dt); else if (tr.immortal) f.hp = f.shown = f.maxHp;
  if (tr.note && (tr.note.t -= dt) <= 0) tr.note = null;
  if (tr.calm) state.swingIn = Math.max(state.swingIn, 1);
  if (state.stagger > tr.st0 + 0.01) tr.staggers = (tr.staggers || 0) + 1;
  tr.st0 = state.stagger;
  const lost = state.hp <= 0, timeUp = C.limit && tr.t >= C.limit;
  switch (tr.id) {
    case 'ironwall': ironWall(E, tr, C, dt); break;
    case 'gaphunter': if (tr.stabs >= C.need) win(E, tr.t); else if (lost || timeUp) fail(E, timeUp); break;
    case 'breaker': if (!f.parts.some((p) => p.armour)) win(E, tr.t); else if (lost || timeUp) fail(E, timeUp); break;
    case 'stagger': if ((tr.staggers || 0) >= C.need) win(E, tr.t); else if (lost || timeUp) fail(E, timeUp); break;
    case 'shrinkKnives': case 'board': case 'wheel': case 'shrinkBow': case 'apple': { const n = updateRange(E, dt); if (n != null) win(E, n); break; }
    case 'knifeWork': knifeWork(E, tr, f); break;
    case 'knuckles': case 'brawl': if (state.felled > 0) win(E, Math.max(0, Math.ceil(state.hp))); else if (lost) fail(E); break;
    case 'capuan': {
      const n = state.specials.capuan || [0, 0];
      capuanRead(tr, n);
      if (lost || (n[0] >= C.feints && !state.move && !state.sw)) win(E, tr.score);
      break;
    }
    case 'rage': {
      const n = state.specials.rage || [0, 0];
      tr.score = n[0];
      if (lost || timeUp) fail(E, !lost); else if (n[0] >= C.rages && !state.move && !state.sw) win(E, Math.ceil(state.hp));
      break;
    }
  }
}
// Knife Work: only knives wear him down (a punch's harm is taken back); felled, it scores the knives left; out of knives with him standing, it fails
function knifeWork(E, tr, f) {
  const K = TUNING.knives, cut = state.knifeGaps * K.dmg + state.knifeSkin * K.skin;
  if (state.fallT <= 0 && f.hp > 0) f.hp = Math.max(f.hp, f.maxHp - cut);
  if (state.felled > 0) win(E, state.knives);
  else if (state.hp <= 0 || (state.knives <= 0 && !state.aim && !state.whip && !state.knife)) fail(E);
}
// Iron Wall: he swings at a set run of heights, each wound up a little faster than the last; anything but a perfect block ends it
function ironWall(E, tr, C, dt) {
  state.swingIn = Math.max(state.swingIn, 1);
  if (tr.sw && (tr.sw.outcome || state.sw !== tr.sw)) {
    if (state.perfects > tr.p0) { tr.score++; tr.sw = null; tr.wait = C.gap; } else { win(E, tr.score); return; }
  }
  if (!tr.sw && !state.sw && state.winded <= 0 && state.stun <= 0 && state.stagger <= 0 && (tr.wait -= dt) <= 0) {
    const z = tr.zones[tr.n++ % tr.zones.length], pose = { high: 'chop', mid: 'thrust', low: 'sweep' }[z];
    const wind = Math.max(C.min, C.wind * C.faster ** tr.score);
    startMove(E, { kind: pose, cost: 0, hits: [{ zone: z, wind, dmg: 1, pose }] }, false);
    tr.sw = state.sw; tr.p0 = state.perfects;
  }
}
// The Capuan Feint read: his fakes let pass (no shield raised and no dodge while a fake shows), then his real blow perfect-blocked. A block that is
// late, or a shield that bit on a fake, answers the move but is no read here.
function capuanRead(tr, n) {
  const mv = state.move, sw = state.sw, sh = state.sh;
  if (mv && mv.sig === 'capuan') {
    if (tr.cm !== mv) { tr.cm = mv; mv.p0 = state.perfects; mv.b0 = state.baited; }
    if (sw && sw.dud && raised() && (sh.held ? sh.heldAt >= state.m - sw.t : sh.t <= sw.t)) mv.bit = true;
  }
  if (n[1] > tr.a0) {
    tr.a0 = n[1];
    const m = tr.cm, bit = !m || m.bit || state.baited > m.b0, read = !bit && state.perfects > m.p0;
    if (read) tr.score++;
    tr.note = { s: read ? 'READ' : bit ? 'BIT THE FAKE' : 'NOT PERFECT', t: TUNING.trials.note, ok: read };
  }
}
// Red Rage comes as it does in a run, when he is wounded: once your blows since his last rage reach wound, his health dips under below (he can't
// fall; his health bar stays hidden), and each rage that starts spends them. After anyway s without one he rages regardless.
function rageWounds(tr, C, f, dt) {
  const n = state.specials.rage || [0, 0];
  if (n[0] > tr.r0) { tr.r0 = n[0]; tr.dealt = 0; tr.calmT = 0; }
  tr.calmT = (tr.calmT || 0) + dt;
  tr.dealt += Math.max(0, (tr.set || f.maxHp) - f.hp);
  f.hp = f.shown = tr.dealt >= C.wound || tr.calmT >= C.anyway ? f.maxHp * C.below * 0.99 : f.maxHp;
  tr.set = f.hp;
}
function win(E, score) { finish(E, score, true); }
function fail(E, late) { finish(E, null, false, late); }
function finish(E, score, pass, late = false) {
  const tr = state.trial;
  tr.done = { score, pass, time: tr.t, late };
  if (pass) { E.audio.play('coin'); } else E.audio.beep({ freq: 180, dur: 0.35, type: 'triangle', slide: 0.6, gain: 0.1 });
}
// The attempt is recorded (the save's best and medal, a first gold's fame, the export's line) and the end card shown.
function showEnd(E) {
  const tr = state.trial, { score, pass, time, late } = tr.done, id = tr.id, medal = pass ? medalOf(id, score) : 0;
  const all = { ...(E.save.get(SAVE, {}) || {}) }, rec = { ...(all[id] || { best: null, medal: 0, gold: 0 }) }, isBest = pass && score != null && better(id, score, rec.best);
  if (isBest) rec.best = score;
  rec.medal = Math.max(rec.medal || 0, medal);
  let fame = 0;
  if (medal === 3 && !rec.gold) { rec.gold = 1; fame = TUNING.trials.fame; E.save.set('fame', E.save.get('fame', 0) + fame); }
  all[id] = rec; E.save.set(SAVE, all);
  E.ledger.add('trial', { id, score: pass ? score : -1, time, medal });
  state.trial = null; state.drill = false; delete state.range;
  E.setScene('trials', { end: { id, score, pass, late, medal, fame, isBest, best: rec.best } });
}

// the trial's line at the top left (where BOUT sits in a bout), with its quit button and live count
export function drawTrial(ctx, E) {
  const tr = state.trial, top = E.safe.top, L = 16 + E.safe.left, t = TRIAL[tr.id], C = TUNING.trials[tr.id];
  tr.quit = { x: L, y: top + 6, w: 44, h: 44 };
  E.roundRect(L, top + 6, 44, 44, 12, 'rgba(31,41,55,0.9)', '#c4b99a');
  ctx.strokeStyle = '#f0e6cc'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(L + 15, top + 21); ctx.lineTo(L + 29, top + 35); ctx.moveTo(L + 29, top + 21); ctx.lineTo(L + 15, top + 35); ctx.stroke();
  const x = L + 56, live = liveCount(tr, C);
  E.text(t.name.toUpperCase(), x, top + 18, { size: 15, align: 'left', weight: '800', color: '#ffd24a' });
  if (live) E.text(live, x, top + 40, { size: 20, align: 'left', weight: '800', color: '#f0e6cc' });
  if (tr.note) { ctx.globalAlpha = clamp(tr.note.t / 0.4, 0, 1); E.text(tr.note.s, x, top + 64, { size: 17, align: 'left', weight: '900', color: tr.note.ok ? '#ffd24a' : '#f87171' }); ctx.globalAlpha = 1; }
  // the goal, large in the middle, as he holds his first blow
  const k = 1 - clamp((tr.t - TUNING.trials.intro + 0.4) / 0.4, 0, 1);
  if (k > 0 && !tr.done) {
    ctx.globalAlpha = k;
    // (low in the middle, over the sand: clear of the shield column, the HUD and both fighters' heads)
    const col = shieldBtns(E)[0], x0 = col.x + col.w + 12, x1 = E.w - 16 - E.safe.right, w = Math.min(x1 - x0, 480), cx = (x0 + x1) / 2, y = E.h - E.safe.bottom - 42;
    E.roundRect(cx - w / 2, y - 26, w, 52, 14, 'rgba(18,12,10,0.85)', '#c9a43a');
    // (the Apple Shot's is the fruit seller's, his bust at the box's left)
    const im = t.seller && artImg('fruit-seller'), bw = im ? 78 : 0, line = t.seller || t.goal;
    if (im) ctx.drawImage(im, cx - w / 2 + 4, y + 26 - bw, bw, bw);
    E.text(line, cx + bw / 2, y, { size: fitSize(ctx, line, 24, w - 24 - bw), weight: '800', color: '#f0e6cc' });
    ctx.globalAlpha = 1;
  }
}
function liveCount(tr, C) {
  const t = TRIAL[tr.id], left = C.limit ? Math.max(0, C.limit - tr.t) : 0;
  switch (tr.id) {
    case 'ironwall': return `STREAK ${tr.score}`;
    case 'gaphunter': return `STABS ${Math.min(tr.stabs, C.need)}/${C.need}  ·  ${left.toFixed(0)}s`;
    case 'breaker': return `PLATES ${tr.plates - state.foe.parts.filter((p) => p.armour).length}/${tr.plates}  ·  ${left.toFixed(0)}s`;
    case 'stagger': return `STAGGERS ${Math.min(tr.staggers || 0, C.need)}/${C.need}  ·  ${left.toFixed(0)}s`;
    case 'capuan': return `READS ${tr.score}/${t.of}`;
    case 'rage': return `RAGES ${Math.min(tr.score, C.rages)}/${C.rages}  ·  ${left.toFixed(0)}s`;
    case 'shrinkKnives': case 'board': case 'wheel': case 'shrinkBow': case 'apple': return rangeCount();
    case 'knifeWork': return `KNIVES ${state.knives}`;
    case 'brawl': return state.edge && !state.edge.down ? 'FOE 1/2' : 'FOE 2/2';
    default: return '';
  }
}
export function trialTap(E, p) {
  const tr = state.trial;
  if (!tr || !tr.quit || !E.hit(tr.quit, p)) return false;
  E.audio.play('tap'); state.trial = null; state.drill = false; delete state.range; E.setScene('trials', { tab: TRIAL[tr.id].tab });
  return true;
}

// ----- the Trials screen: the grid with its tabs, and the end card -----
const MEDAL = [null, ['#e3a36b', '#8a4f22'], ['#e8edf2', '#8c97a3'], ['#ffe08a', '#b5852a']];
const MEDAL_NAME = ['', 'BRONZE', 'SILVER', 'GOLD'];
function drawMedal(ctx, x, y, r, m) {
  if (!m) {
    ctx.save(); ctx.setLineDash([r * 0.32, r * 0.24]); ctx.strokeStyle = 'rgba(120,128,140,0.7)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); return;
  }
  const [lite, dark] = MEDAL[m];
  ctx.fillStyle = '#9b2226'; ctx.beginPath(); ctx.moveTo(x - r * 0.55, y - r * 1.55); ctx.lineTo(x - r * 0.15, y - r * 1.55); ctx.lineTo(x + r * 0.2, y - r * 0.6); ctx.lineTo(x - r * 0.2, y - r * 0.6); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + r * 0.55, y - r * 1.55); ctx.lineTo(x + r * 0.15, y - r * 1.55); ctx.lineTo(x - r * 0.2, y - r * 0.6); ctx.lineTo(x + r * 0.2, y - r * 0.6); ctx.closePath(); ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); g.addColorStop(0, lite); g.addColorStop(1, dark);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1.5, r * 0.08); ctx.beginPath(); ctx.arc(x, y, r * 0.72, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1, r * 0.06); ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.22 : r * 0.48; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
}
// the card's picture: the champion's portrait or the weapon's painting, drawn simply when it has not loaded
function drawIcon(ctx, icon, x, y, w, h) {
  const champ = icon.startsWith('champ-'), names = champ ? [icon] : icon === 'knives' ? [weaponArt('dagger'), weaponArt('dagger'), weaponArt('dagger')] : icon === 'fist' ? [] : [weaponArt(icon === 'bow' ? 'bow' : icon)];
  const imgs = names.map((n) => artImg(n));
  if (champ && imgs[0]) { const im = imgs[0], s = h / im.height, iw = im.width * s; ctx.drawImage(im, x + w / 2 - iw / 2, y, iw, h); return; }
  if (!champ && imgs.length && imgs.every(Boolean)) {
    imgs.forEach((im, i) => {
      const n = imgs.length, s = (h * 0.95) / Math.max(im.width, im.height), a = n === 1 ? 0.6 : (i - (n - 1) / 2) * 0.45;
      ctx.save(); ctx.translate(x + w / 2 + (i - (n - 1) / 2) * h * 0.28, y + h / 2); ctx.rotate(a); ctx.drawImage(im, -im.width * s / 2, -im.height * s / 2, im.width * s, im.height * s); ctx.restore();
    });
    return;
  }
  // a fist (or a weapon not yet painted): a clenched hand in the kit's skin tone
  ctx.save(); ctx.translate(x + w / 2, y + h / 2); const r = h * 0.3;
  ctx.fillStyle = '#b9835a'; ctx.strokeStyle = '#3a2414'; ctx.lineWidth = 2;
  rrect(ctx, -r, -r * 0.7, r * 2, r * 1.5, r * 0.35); ctx.fill(); ctx.stroke();
  for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-r + i * r * 0.5, -r * 0.7); ctx.lineTo(-r + i * r * 0.5, -r * 0.1); ctx.stroke(); }
  rrect(ctx, -r * 1.25, -r * 0.2, r * 0.6, r * 0.9, r * 0.25); ctx.fill(); ctx.stroke();
  ctx.restore();
}
// a line of text broken into lines no wider than w px at size px
function wrapText(ctx, s, w, size) {
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  const out = [];
  for (const word of s.split(' ')) { const ln = out.length ? `${out[out.length - 1]} ${word}` : word; if (out.length && ctx.measureText(ln).width <= w) out[out.length - 1] = ln; else out.push(word); }
  return out;
}
function gridLay(E, n) {
  const G = TUNING.trials.grid, T = E.safe.top, B = E.h - E.safe.bottom, L = 16 + E.safe.left, R = E.w - 16 - E.safe.right;
  const head = { back: { x: L, y: T + 8, w: 92, h: 44 } }, ty = T + 60;
  const tw = (R - L - 3 * G.gap) / 4;
  head.tabs = TABS.map(([id], i) => ({ id, x: L + i * (tw + G.gap), y: ty, w: tw, h: G.tab }));
  const rows = Math.max(1, Math.ceil(n / G.cols)), y0 = ty + G.tab + G.gap, ch = Math.min(G.max, (B - 8 - y0 - (rows - 1) * G.gap) / rows), cw = (R - L - (G.cols - 1) * G.gap) / G.cols;
  return { ...head, L, R, y0, cw, ch, gap: G.gap };
}
function endLay(E) {
  const [w0, h0] = TUNING.trials.grid.card, w = Math.min(w0, E.w - 32 - E.safe.left - E.safe.right), h = Math.min(h0, E.h - 24 - E.safe.top - E.safe.bottom);
  const x = (E.w - w) / 2, y = (E.h - h) / 2, bh = 52;
  return { x, y, w, h, retry: { x: x + 18, y: y + h - bh - 16, w: w * 0.6 - 24, h: bh }, back: { x: x + w * 0.6 + 6, y: y + h - bh - 16, w: w * 0.4 - 24, h: bh } };
}
export const trials = {
  enter(E, params = {}) {
    this.end = params.end || null; this.t = 0;
    this.tab = params.tab || (this.end ? TRIAL[this.end.id].tab : this.tab || 'blades');
    this.cards = []; this.press = null;
  },
  update(dt) { this.t += dt; },
  render(ctx, E) {
    if (portrait(E)) { this.cards = []; rotateCard(ctx, E); return; }
    // the Pit's sand behind, darkened (plain dark until it has loaded)
    const bd = artImg('arena-pit');
    ctx.fillStyle = '#12100e'; ctx.fillRect(0, 0, E.w, E.h);
    if (bd) { const k = Math.max(E.w / bd.width, E.h / bd.height); ctx.drawImage(bd, (E.w - bd.width * k) / 2, (E.h - bd.height * k) / 2, bd.width * k, bd.height * k); ctx.fillStyle = 'rgba(14,11,9,0.78)'; ctx.fillRect(0, 0, E.w, E.h); }
    if (this.end) { this.drawEnd(ctx, E); return; }
    const Ly = gridLay(E, TRIALS.filter((t) => t.tab === this.tab).length), all = E.save.get(SAVE, {}) || {}, live = TRIALS.filter((t) => !t.soon), medals = live.filter((t) => all[t.id] && all[t.id].medal).length;
    E.roundRect(Ly.back.x, Ly.back.y, Ly.back.w, Ly.back.h, 12, '#1f2937', '#475569');
    E.text('Back', Ly.back.x + Ly.back.w / 2, Ly.back.y + 22, { size: 18, weight: '800', color: '#f0e6cc' });
    E.text('TRIALS', E.w / 2, Ly.back.y + 22, { size: 28, weight: '900', color: '#e7c35a' });
    E.text(`${live.length} trials · ${medals} medals`, Ly.R, Ly.back.y + 22, { size: 15, align: 'right', weight: '800', color: '#c9b98f' });
    for (const tb of Ly.tabs) {
      const on = tb.id === this.tab, label = TABS.find((q) => q[0] === tb.id)[1];
      E.roundRect(tb.x, tb.y, tb.w, tb.h, 10, on ? '#3a2c14' : '#1c1f26', on ? '#e7c35a' : '#3b4250');
      E.text(label, tb.x + tb.w / 2, tb.y + tb.h / 2, { size: 17, weight: '800', color: on ? '#ffd24a' : '#aab2bf' });
    }
    this.cards = [];
    TRIALS.filter((t) => t.tab === this.tab).forEach((t, i) => {
      const c = i % TUNING.trials.grid.cols, r = Math.floor(i / TUNING.trials.grid.cols), x = Ly.L + c * (Ly.cw + Ly.gap), y = Ly.y0 + r * (Ly.ch + Ly.gap);
      this.cards.push({ id: t.id, x, y, w: Ly.cw, h: Ly.ch });
      this.drawCard(ctx, E, t, all[t.id], x, y, Ly.cw, Ly.ch);
    });
  },
  drawCard(ctx, E, t, rec, x, y, w, h) {
    const m = rec ? rec.medal : 0, gold = m === 3, band = Math.round(clamp(h * 0.3, 30, 64)), pad = 12;
    ctx.save();
    if (gold) { ctx.shadowColor = 'rgba(255,200,80,0.55)'; ctx.shadowBlur = 14; }
    E.roundRect(x, y, w, h, 14, '#1a1d24', gold ? '#e7c35a' : '#4a505c');
    ctx.restore();
    ctx.save(); rrect(ctx, x + 3, y + 3, w - 6, band, 11); ctx.clip();
    const g = ctx.createLinearGradient(0, y, 0, y + band); g.addColorStop(0, t.soon ? '#5a4a36' : '#c98a3a'); g.addColorStop(1, t.soon ? '#2e2a26' : '#6e4a20');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, band + 4);
    if (t.soon) ctx.globalAlpha = 0.45;
    drawIcon(ctx, t.icon, x, y + 4, w, band - 2);
    ctx.restore();
    // name, the goal on up to two lines, and at the foot the best (or SOON) with the medal at the right
    const r = Math.min(19, h * 0.13), tx = x + pad, tw = w - 2 * pad, ny = y + band + 16, gw = tw - (t.soon ? 0 : 2 * r + 6);
    E.text(t.name, tx, ny, { size: fitSize(ctx, t.name, 18, tw), align: 'left', weight: '800', color: t.soon ? '#8f949c' : '#f3ead6' });
    const gs = h < 140 ? 13 : 15;
    wrapText(ctx, t.goal, h < 140 ? tw : gw, gs).slice(0, 2).forEach((ln, i) => E.text(ln, tx, ny + 20 + i * (gs + 3), { size: gs, align: 'left', weight: '600', color: t.soon ? '#6f747c' : '#c9c2b0' }));
    const fy = y + h - pad - 8;
    if (t.soon) { E.text('SOON', tx, fy, { size: 14, align: 'left', weight: '900', color: '#a3895a' }); return; }
    ctx.font = '800 11px system-ui, sans-serif';
    const lw = ctx.measureText(t.label).width;
    E.text(t.label, tx, fy + 1, { size: 11, align: 'left', weight: '800', color: '#9aa3ae' });
    E.text(fmtScore(t.id, rec ? rec.best : null), tx + lw + 8, fy, { size: 17, align: 'left', weight: '800', color: '#ffd24a' });
    drawMedal(ctx, x + w - pad - r, y + h - pad - r, r, m);
  },
  drawEnd(ctx, E) {
    const e = this.end, t = TRIAL[e.id], Ly = endLay(E), M = TUNING.trials[e.id].medals, { x, y, w, h } = Ly;
    E.roundRect(x, y, w, h, 18, '#161a21', '#c9a43a');
    const mx = x + Math.min(120, w * 0.2), my = y + (h - 80) / 2 + 6, r = Math.min(48, h * 0.17);
    if (e.medal) {
      ctx.save(); ctx.translate(mx, my); ctx.rotate(this.t * 0.25);
      const rg = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 2.2); rg.addColorStop(0, 'rgba(255,224,140,0.35)'); rg.addColorStop(1, 'rgba(255,224,140,0)');
      ctx.fillStyle = rg;
      for (let i = 0; i < 16; i++) { ctx.rotate(Math.PI / 8); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-r * 0.14, -r * 2.2); ctx.lineTo(r * 0.14, -r * 2.2); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }
    drawMedal(ctx, mx, my, r, e.medal);
    const tx = mx + r * 1.9, tw = x + w - 16 - tx;
    E.text(e.medal ? 'TRIAL COMPLETE' : 'TRIAL FAILED', tx, y + 28, { size: 13, align: 'left', weight: '800', color: '#bfb59a' });
    E.text(t.name.toUpperCase(), tx, y + 52, { size: fitSize(ctx, t.name.toUpperCase(), 24, tw), align: 'left', weight: '900', color: '#e7c35a' });
    const res = e.pass ? `${t.label === 'BEST TIME' ? 'Time' : t.label.charAt(0) + t.label.slice(1).toLowerCase()}: ${fmtScore(e.id, e.score)}` : e.late ? 'Out of time' : 'You fell';
    E.text(res, tx, y + 92, { size: fitSize(ctx, res, 36, tw), align: 'left', weight: '900', color: '#ffffff' });
    const sub = e.medal ? `${MEDAL_NAME[e.medal]} MEDAL` : e.pass ? `Short of bronze (${t.time ? `${M[0]}s` : M[0]})` : '';
    if (sub) E.text(sub, tx, y + 128, { size: 20, align: 'left', weight: '900', color: e.medal ? MEDAL[e.medal][0] : '#9aa3ae' });
    let py = y + 150;
    if (e.fame) { const s = `+${e.fame} fame, first gold`; E.roundRect(tx, py, Math.min(tw, 210), 30, 15, '#2a2210', '#e7c35a'); E.text(s, tx + Math.min(tw, 210) / 2, py + 15, { size: 15, weight: '800', color: '#ffe08a' }); py += 38; }
    else if (e.isBest && e.pass) { E.text('New best!', tx, py + 14, { size: 17, align: 'left', weight: '800', color: '#ffd24a' }); py += 30; }
    else if (e.best != null) { E.text(`Best: ${fmtScore(e.id, e.best)}`, tx, py + 14, { size: 16, align: 'left', weight: '800', color: '#c9c2b0' }); py += 30; }
    // the three thresholds, the one reached lit
    const chips = M.map((v, i) => `${['Bronze', 'Silver', 'Gold'][i]} ${t.time ? `${v}s` : v}`);
    let cx = x + 18;
    const cy = Ly.retry.y - 40;
    ctx.font = '700 14px system-ui, sans-serif';
    chips.forEach((s, i) => {
      const cw = ctx.measureText(s).width + 22, on = e.medal === i + 1;
      E.roundRect(cx, cy, cw, 28, 14, on ? '#2a2210' : '#1d2129', on ? '#e7c35a' : '#3b4250');
      E.text(s, cx + cw / 2, cy + 14, { size: 14, weight: '700', color: on ? '#ffe08a' : '#9aa3ae' });
      cx += cw + 8;
    });
    E.roundRect(Ly.retry.x, Ly.retry.y, Ly.retry.w, Ly.retry.h, 14, '#c9913f', '#7a4f1a');
    E.text('Retry', Ly.retry.x + Ly.retry.w / 2, Ly.retry.y + Ly.retry.h / 2, { size: 24, weight: '900', color: '#2a1806' });
    E.roundRect(Ly.back.x, Ly.back.y, Ly.back.w, Ly.back.h, 14, '#1f2937', '#475569');
    E.text('Trials', Ly.back.x + Ly.back.w / 2, Ly.back.y + Ly.back.h / 2, { size: 20, weight: '800', color: '#f0e6cc' });
  },
  onTap(p, E) {
    if (portrait(E)) return;
    if (this.end) {
      const Ly = endLay(E);
      if (E.hit(Ly.retry, p)) { E.audio.play('tap'); E.setScene('play', { trial: this.end.id }); }
      else if (E.hit(Ly.back, p)) { E.audio.play('tap'); this.end = null; }
      return;
    }
    const Ly = gridLay(E, TRIALS.filter((t) => t.tab === this.tab).length);
    if (E.hit(Ly.back, p)) { E.audio.play('tap'); E.setScene('menu'); return; }
    const tb = Ly.tabs.find((q) => E.hit(q, p));
    if (tb) { E.audio.play('tap'); this.tab = tb.id; return; }
    const c = this.cards.find((q) => E.hit(q, p));
    if (c && !TRIAL[c.id].soon) { E.audio.play('tap'); E.setScene('play', { trial: c.id }); }
  },
};
