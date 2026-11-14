// Arena: The card engine: the hooks, finishers, hints, the crowd, Momentum and Bleed.
// Split from game.js by tools/arena-split.mjs (ADR-0024). Only tuning.js and data.js may be read while modules load.

import { clamp } from './engine.js';
import { TUNING } from './tuning.js';
import { DECK, lenN } from './data.js';
import { lay, youF, walls, myH, foeF, toScreen, partCenter, fakeOut, pushFoe, disable, fell, heartsPop, slowFx, ring, pop, roar, clangSound, ooh,
  swooshSound } from './fight.js';
import { tagPop, spendFoe, windFoe, settleFeint } from './foe.js';
import { hudRow } from './draw-fight.js';
import { heldFams } from './screens.js';
import { portrait } from './scenes.js';
import { trait, drives, state, wrap, has, shake, meWeapon } from './game.js';
import { armsW } from './features/ranged.js';

// ====== CARD ENGINE: the events a bout makes, Momentum, Bleed ======
// Cards hook events: start (the bout begins), perfect, block, read (a feint read), dodge (a dodge in his tell), slot (a slot hit), hit (a bare hit),
// over (an overhead that connects), break (a plate broken), lame, tick (a bleed tick), feint (your own feint fooled him), fell. Each hook is (E, ctx) => void;
// the rule lives in its card.
export const C_ = () => TUNING.cards;
export const HOOKS = {
  shove: { perfect: (E) => { for (let i = 0; i < C_().shove; i++) pushFoe(E); if (state.step.x >= walls(E).fore - 0.005) stunFoe(E, C_().shoveStun, 'STUNNED AT THE WALL'); } },
  braced: { block: (E, c) => { if (!c.perfect) gainMom(E, C_().braced); } },
  thorns: { block: (E, c) => {
    if (state.disarm > 0) return;
    state.dents++; const Ff = foeF(E);
    if (state.dents >= C_().thorns) { state.dents = 0; disarmFoe(E, C_().thornsDur); } else pop(Ff.x, Ff.y - 1.15 * Ff.H, `${state.foe.beast ? 'THORNS' : 'WEAPON DENTED'} ${state.dents}/${C_().thorns}`, '#cbd5e1', 15);
  } },
  serrated: { slot: (E) => addBleed(E, C_().serrated) },
  rend: { hit: (E, c) => { if (c.cut) addBleed(E, C_().rend); } },
  bloodlust: { tick: (E, c) => { state.stamina = Math.min(state.staMax, state.stamina + C_().bloodlust * c.n); } },
  haem: { fell: () => { state.carry = state.bleed.length; } },
  sidestep: { dodge: (E) => { const Ff = foeF(E); pop(Ff.x, Ff.y - 1.3 * Ff.H, 'OVERCOMMITTED', '#86efac', 18); windFoe(E, C_().sidestep); } },
  lightfeet: { dodge: (E) => { state.stamina = Math.min(state.staMax, state.stamina + TUNING.dodge.cost); } },
  matador: { dodge: (E, c) => { if (['thrust', 'bash', 'pounce', 'shove'].includes(c.sw.pose)) stunFoe(E, C_().matador, 'STUMBLES!'); } },
  untouch: { dodge: (E) => { state.openAll = C_().untouch; } },
  brawler: { break: (E) => gainMom(E, C_().brawler) },
  cape: { perfect: (E) => capeStep(E), dodge: (E) => capeStep(E) },
  butcher: { break: (E) => addBleed(E, C_().butcher) },
  spiked: { perfect: (E) => addBleed(E, C_().spiked) },
  hamstring: { hit: (E) => hamstring(E), slot: (E) => hamstring(E) },
  mindreader: { read: (E) => gainMom(E, C_().mind) },
  bluff: { feint: (E, c) => { if (c.gap <= C_().bluffWin) { state.openAll = C_().bluff; const Ff = foeF(E); pop(Ff.x, Ff.y - 1.3 * Ff.H, 'DOUBLE BLUFF: ALL OPEN', '#ffd24a', 20); } } },
  playcrowd: { read: (E) => favour(E, TUNING.crowd.read * (C_().play - 1)), perfect: (E) => favour(E, TUNING.crowd.perfect * (C_().play - 1)) },
  sucker: { over: (E) => { if (state.m - state.ownT <= C_().sucker && state.foe.hp > 0) staggerFoe(E); } },
  bloodsport: { tick: (E, c) => favour(E, C_().bloodSport * c.n) },
  falsestep: { dodge: (E, c) => fakeOut(E, c.sw.zone) },
  salute: { perfect: (E) => { if (topThird()) { state.openAll = C_().salute; const Ff = foeF(E); pop(Ff.x, Ff.y - 1.3 * Ff.H, 'SALUTE: ALL OPEN', '#ffd24a', 20); } } },
  // Step 9, the vault (Bloodletter, Phalanx Master, Wind Dancer, Colossus, Grand Deceiver, Idol of Rome, Crusher, Gilded Moment and Counterstep act where
  // their rule lives: addBleed, perfectWin, dodge and endBlow, applyCard and gapHit, startBlow and fakeOut, favour and boutGold, bounce, finCost, dodge)
  bulwark: { block: (E) => {
    const b = state.bulw;
    if (b.taken !== state.taken) { b.n = 0; b.taken = state.taken; }
    if (++b.n < C_().bulwark) return;
    b.n = 0; const Ff = foeF(E); pop(Ff.x, Ff.y - 1.3 * Ff.H, 'BULWARK', '#7dd3fc', 20); windFoe(E, C_().bulwarkWind);
  } },
  tide: { fell: (E) => {
    const n = Math.min(C_().tide, state.bleed.length), was = state.hp;
    state.hp = Math.min(state.maxHp, state.hp + n);
    if (state.hp > was) { const Fy = youF(E); pop(Fy.x, Fy.y - 1.25 * Fy.H, `CRIMSON TIDE: ${heartsPop(state.hp - was)}`, '#f87171', 20); }
  } },
  shadow: { dodge: () => { state.shadowM = state.m; } },
  smoke: { feint: (E) => { const f = state.foe, Ff = foeF(E); pop(Ff.x, Ff.y - 1.2 * Ff.H, 'SMOKE: STAMINA DRAINED', '#c4b5fd', 16); spendFoe(E, C_().smoke * f.staMax); } },
  counterstep: { block: () => { state.blockM = state.m; } },
  anvil: { perfect: () => { state.anvilM = state.m; }, over: () => { state.anvilM = -9; } },
  cuts: { hit: (E, c) => { if (c.cut && state.m - state.dodgeM <= C_().cutsWin) addBleed(E, C_().cuts); } },
  lie: { feint: (E) => addBleed(E, C_().lie) },
  acrobat: { dodge: (E) => favour(E, C_().acrobat) },
  spectacle: { break: (E) => favour(E, C_().spectacle) },
  illusion: { read: (E) => {
    favour(E, TUNING.crowd.read * (C_().illusion - 1));
    const n = C_().illusionGold; state.gold += n; state.goldEarned += n; coins(E, 1);
    const Ff = foeF(E); pop(Ff.x, Ff.y - 1.35 * Ff.H, `+${n} GOLD`, '#fbbf24', 16);
  } },
};
// the cards you wear of one family (a vault legendary grows with them), and each legendary's growth: 1 + its share per card
export const famN = (f) => heldFams()[f] || 0;
export const growth = (id, fam, k) => (has(id) ? 1 + k * famN(fam) : 1);
// the crowd in the top third of its meter (Encore, Crowd Pleaser, Salute)
export const topThird = () => state.fav >= TUNING.crowd.max * TUNING.crowd.bands[1];
function capeStep(E) { if (++state.cape % C_().cape === 0) stunFoe(E, C_().capeStun, 'CAPED!'); }
function hamstring(E) {
  if (state.m - state.lastTellDodge > C_().hamWin) return;
  const legs = state.foe.parts.find((q) => q.d.id === 'legs');
  if (!legs || legs.cut) return;
  const [x, y] = partCenter(foeF(E), state.foe, legs);
  disable(E, legs, { x, y }, 0);
}
// He is stunned (any blow in the making is dropped, so a feint settles as neither), staggered (the same, shorter, and pushed back) or disarmed (fists only).
export function dropBlow() { if (state.sw) { if (state.sw.fin <= 0) settleFeint('none'); state.sw = null; state.move = null; } state.plan = null; }
export function stunFoe(E, dur, label) {
  if (state.fallT > 0) return;
  dropBlow(); state.stun = Math.max(state.stun, dur); state.swingIn = Math.max(state.swingIn, 0.6);
  const Ff = foeF(E); pop(Ff.x, Ff.y - 1.25 * Ff.H, label, '#a5b4fc', 20); E.haptic(20);
}
export function staggerFoe(E, quiet = false) {
  if (state.fallT > 0 || state.stagger > 0) return;
  dropBlow(); state.stagger = TUNING.shield.stagger; state.swingIn = Math.max(state.swingIn, 0.6); pushFoe(E);
  const Ff = foeF(E); if (!quiet) pop(Ff.x, Ff.y - 1.25 * Ff.H, 'STAGGERED!', '#fbbf24', 20);
}
function disarmFoe(E, dur) {
  if (state.fallT > 0) return;
  // a beast has no weapon to lose: it is stunned a moment instead
  if (state.foe.beast) { stunFoe(E, TUNING.fin.beastStun, 'STUNNED'); return; }
  state.disarm = dur; state.flyW = 0.9;
  const Ff = foeF(E); pop(Ff.x, Ff.y - 1.3 * Ff.H, 'DISARMED!', '#e879f9', 26); shake(E, 6, 0.2); E.haptic(30); clangSound(E, 0);
}
// the perfect-block window, doubled by Iron Wall
export const perfectWin = () => TUNING.shield.perfect * (has('ironwall') ? 2 : 1) * growth('phalanx', 'wall', C_().phalanx) * (trait('sparta') ? TUNING.origins.sparta.perfect : 1);
export const atWall = (E) => state.foot.pos <= walls(E).back + 0.01;

// ----- finishers: the button at the bottom right spends Momentum on the costliest one you hold and can use now (an arrow on it cycles to the other) -----
const FIN_OK = {
  exec: () => !state.armed.exec && state.foe.hp < state.foe.maxHp * TUNING.fin.below,
  whirl: () => !state.armed.whirl,
  breath: () => state.stamina < state.staMax || state.exhaust > 0,
  disarm: () => (state.foe.beast ? state.stun <= 0 : state.disarm <= 0),
  falseop: () => !state.armed.falseop,
  showstop: () => state.stun <= 0,
};
// a finisher's cost in pips now: Encore takes one off with the crowd in its top third
// Gilded Moment: with the crowd full, the bout's first finisher costs nothing
export const gildedFree = () => has('gilded') && !state.bout.gilded && state.fav >= C_().gildedAt;
export const finCost = (c) => (gildedFree() ? 0 : Math.max(1, TUNING.fin[c.id] - (has('encore') && topThird() ? C_().encore : 0)));
export const finList = () => DECK.filter((c) => c.fam === 'fin' && has(c.id) && finCost(c) <= state.mom && FIN_OK[c.id]()).sort((a, b) => finCost(b) - finCost(a));
// the one the button shows: the costliest ready, unless the arrow picked the other
export function finReady() { const l = finList(); return l.find((c) => c.id === state.finSel) || l[0] || null; }
export function finLive(E) { return !state.intro && !state.draft && !state.tent && state.fallT <= 0 && state.endT <= 0 && !portrait(E); }
// the button's rect (with the arrow chip's width when two are ready, `arrow` its left part), or null when nothing is ready
export function finBtn(E) {
  const c = finLive(E) && finReady();
  if (!c) return null;
  const B = TUNING.finBtn, two = finList().length > 1, w = B.w + (two ? B.arrow : 0);
  return { c, two, x: E.w - 16 - E.safe.right - armsW(E) - w, y: E.h - 10 - E.safe.bottom - B.h, w, h: B.h, arrow: two ? B.arrow : 0 };
}
export function fireFinisher(E, c) {
  const Fy = youF(E);
  const cost = finCost(c);
  if (gildedFree()) { state.bout.gilded = true; pop(Fy.x + 0.4 * Fy.H, Fy.y - 1.4 * Fy.H, 'GILDED MOMENT: FREE', '#ffd24a', 18); }
  state.mom -= cost; state.momSpent += cost; state.fins.push(c.id); state.finSel = ''; state.finHintT = 0;
  if (c.id === 'exec' || c.id === 'whirl' || c.id === 'falseop') state.armed[c.id] = true;
  else if (c.id === 'breath') { state.stamina = state.staMax; state.exhaust = 0; }
  else if (c.id === 'disarm') disarmFoe(E, TUNING.fin.disarmDur);
  else if (c.id === 'showstop') { favour(E, TUNING.fin.showFav); stunFoe(E, TUNING.fin.showAwe, 'IN AWE'); roar(E); coins(E, TUNING.crowd.coins); }
  pop(Fy.x + 0.4 * Fy.H, Fy.y - 1.15 * Fy.H, c.name.toUpperCase() + (state.armed[c.id] ? ' ARMED' : '!'), '#e879f9', 24);
  favour(E, TUNING.crowd.fin);
  E.flash('#e879f9', 0.1); E.haptic(30);
  // the war paint glows, a beat of slow motion, and the finisher's name on a banner
  const J = TUNING.juice; state.paintT = J.paint; slowFx(J.finSlow, J.finMul); state.banner = { s: `${c.name.toUpperCase()}!`, t: J.banner };
  E.audio.beep({ freq: 330, dur: 0.18, type: 'sawtooth', slide: 2, gain: 0.1 }); E.audio.beep({ freq: 990, dur: 0.2, type: 'sine', gain: 0.08, delay: 0.1 });
}
// the button's first appearance ever shows a one-line hint, once (stored in the save)
export function updateFinisher(E, dt) {
  state.finHintT = Math.max(0, state.finHintT - dt);
  state.hintT = Math.max(0, state.hintT - dt);
  if (state.train || state.kLesson || !finBtn(E) || E.save.get('finHint', 0) || state.hintT > 0 || (state.hint && state.m - state.boutT0 < TUNING.hint.dur)) return;
  E.save.set('finHint', 1); state.finHintT = TUNING.finBtn.hintDur;
}
// The first run is every run until the first one ends (finish sets firstRunDone): the HUD names its bars and the DODGE button says how to back off.
// An old save from before the flag counts as done when it already records a finished run (a best, a fallen name, a champion, fame or an arena opened).
export const firstRun = (E) => !(E.save.get('firstRunDone', 0) || E.save.get('best2', 0) > 0 || E.save.get('wall', []).length || E.save.get('champs', []).length || E.save.get('fame', 0) > 0 || E.save.get('arenas', 0) > 0);
// runs finished (step 23); a save from before the count with a run behind it counts as past the jab nudge's runs
export const runsDone = (E) => E.save.get('runsDone', firstRun(E) ? 0 : TUNING.train.spamRuns);
// first-time hints, each shown once ever (stored in the save), one at a time, eight words at most: Brutus's nudge off jab spam (state.jabRun, in the
// first runs), then, never in the first run's bout 1 (the training yard covers it), the HUD's bars (first run only), the crowd's first third, a full
// Momentum with no war paint, the hearts after your first fell, and the drive after your first lunge that met nothing (state.lungeMiss, set in endLunge)
export function updateHints(E) {
  if (state.train || state.kLesson || state.hintT > 0 || state.finHintT > 0 || !finLive(E) || (state.hint && state.m - state.boutT0 < TUNING.hint.dur)) return;
  const C = TUNING.crowd, M = TUNING.mom, TR = TUNING.train;
  if (state.jabRun >= TR.spam && !E.save.get('jabHint', 0) && runsDone(E) < TR.spamRuns) {
    E.save.set('jabHint', 1); state.hintT = TUNING.hint.spamDur; state.hintS = "Old Brutus: “He's seen that jab. Slash, or lunge.”";
  } else if (firstRun(E) && state.rack === 0) return;
  else if (firstRun(E) && !E.save.get('hudHint', 0)) {
    E.save.set('hudHint', 1); state.hintT = TUNING.hint.hudDur; state.hintS = 'Gold: Momentum. Green: stamina. Tan: shield.';
  } else if (state.fav >= C.bands[0] * C.max && !E.save.get('crowdHint', 0)) {
    E.save.set('crowdHint', 1); state.hintT = C.hintDur; state.hintS = 'Style fills the crowd. Crowds pay.';
  } else if (state.mom >= M.max && !E.save.get('momHint', 0) && !DECK.some((c) => c.fam === 'fin' && has(c.id))) {
    E.save.set('momHint', 1); state.hintT = M.hintDur; state.hintS = 'Momentum full. War paint spends it.';
  } else if (state.felled > 0 && !E.save.get('heartHint', 0)) {
    E.save.set('heartHint', 1); state.hintT = TUNING.hint.heartDur; state.hintS = `Each fell heals +${TUNING.heal} heart${TUNING.heal === 1 ? '' : 's'}.`;
  } else if (state.lungeMiss && !E.save.get('driveHint', 0)) {
    E.save.set('driveHint', 1); state.lungeMiss = false; state.hintT = TUNING.hint.driveDur; state.hintS = 'Hold a lunge to drive further.';
  }
}
// a touch on the button: the arrow chip cycles to the other ready finisher, anywhere else on it fires the one shown
export function finTouch(E, p) {
  const b = finBtn(E), r = TUNING.finBtn.reach;
  if (!b || p.x < b.x - r || p.x > b.x + b.w + r || p.y < b.y - r || p.y > b.y + b.h + r) return false;
  if (b.two && p.x < b.x + b.arrow) {
    const l = finList(); state.finSel = l[(l.findIndex((q) => q.id === b.c.id) + 1) % l.length].id;
    E.audio.play('tap'); E.haptic(8);
  } else fireFinisher(E, b.c);
  return true;
}
export function emit(E, ev, ctx = {}) {
  crowdEvent(E, ev);
  if (ev === 'perfect' && meWeapon().net && !state.bout.net) castNet(E);
  for (const id of new Set(state.picks)) { const h = HOOKS[id] && HOOKS[id][ev]; if (h) h(E, ctx); }
}

// the trident's net: your first perfect block each bout throws it over him; for TUNING.me.net.dur s his wind-ups and his footwork slow
export function castNet(E) {
  const N = TUNING.me.net, Ff = foeF(E);
  state.bout.net = true; state.foeNet = N.dur; state.netsCast++;
  // under the right HUD plate when he stands beneath it (the pop also drifts up 34 px)
  const r = 16 + E.safe.right, under = Ff.x > E.w - r - 176 - 60, hudBot = 10 + E.safe.top + hudRow().shield + 12 + 34 + 14;
  pop(Ff.x, Ff.y - 1.2 * Ff.H, 'NETTED!', '#e2e8f0', 22, under ? hudBot : 0); swooshSound(E); E.haptic(14);
}
export const netMul = (k) => (state.foeNet > 0 ? k : 1);

// ----- the crowd: favour for style (TUNING.crowd), carried through the run; coins arc in the first time it passes each step (favStep is the run's high-water) -----
export function favour(E, n) {
  const C = TUNING.crowd;
  if (n > 0) n *= growth('idol', 'show', C_().idolFav);
  if (n > 0 && drives('glory')) { n *= TUNING.reasons.glory.fav; tagPop(E, 'glory', 'LOUDER', true); }
  state.fav = clamp(state.fav + n, 0, C.max);
  if (n > 0) { state.favT = 0.5; state.favM = state.m; }
  const step = Math.floor(state.fav / C.step);
  if (step > state.favStep) { coins(E, C.coins * (step - state.favStep)); state.favStep = step; }
}
// the events that please them: a feint read, a perfect block, a slot hit, a laming, and two of your hits close together
export function crowdEvent(E, ev) {
  const C = TUNING.crowd;
  if (ev === 'read' || ev === 'perfect' || ev === 'slot' || ev === 'lame') favour(E, C[ev]);
  if (ev === 'slot' || ev === 'hit') { if (state.m - state.lastHitM <= C.comboWin) favour(E, C.combo); state.lastHitM = state.m; }
}
// what bores them, each frame of play: turtling (the measure his turtle read uses), backing off with no blow of his coming, and any stretch of idle s
// with nothing stylish (a fill resets it) that drains drain of what is held, a second
// (Showboat halves the drains, Darling of Rome stops them); Bread and Circuses heals you once a bout near the top
export function crowdDrain(E, dt) {
  const C = TUNING.crowd, sw = state.sw, k = has('showboat') ? C_().showboat : 1;
  if (state.fallT > 0 || state.endT > 0) return;
  state.favSum += state.fav * dt; state.favDur += dt;
  if (has('bread') && !state.bout.bread && state.fav >= C_().breadAt && state.hp < state.maxHp) {
    const was = state.hp; state.bout.bread = true; state.hp = Math.min(state.maxHp, state.hp + lenN(C_().bread)); coins(E, C_().breadCoins);
    const Fy = youF(E); pop(Fy.x, Fy.y - 1.1 * Fy.H, `THE CROWD THROWS BREAD: ${heartsPop(state.hp - was)}`, '#fde68a', 18); E.haptic(15);
  }
  if (state.winded > 0 || has('darling')) return;
  if (state.mem.turtle >= TUNING.read.turtle) favour(E, -C.turtle * k * dt);
  if (state.dg.down && state.dg.t > TUNING.dodge.dur && !(sw && sw.fin <= 0)) favour(E, -C.back * k * dt);
  if (state.m - state.favM > C.idle) favour(E, -C.drain * k * state.fav * dt);
}
// A Flourish (the Flourish card): the sword thumb drawing a fast circle (its heading turning one way through a full turn at speed, within flourish.win s),
// once each cool s. The thumb, not the hand: the arm's reach would flatten the hand's loop.
export function twirl(E, dt) {
  const T = TUNING.flourish, h = state.hand, fl = state.fl, vx = (h.fx - fl.fx) / Math.max(dt, 0.001), vy = (h.fy - fl.fy) / Math.max(dt, 0.001);
  fl.fx = h.fx; fl.fy = h.fy;
  if (!has('flourish') || !h.down || h.lock > 0 || Math.hypot(vx, vy) < T.speed) { fl.acc = 0; fl.ang = null; return; }
  const a = Math.atan2(vy, vx), d = fl.ang == null ? 0 : wrap(a - fl.ang);
  fl.ang = a;
  if (d * fl.acc < 0 || state.m - fl.t > T.win) { fl.acc = 0; fl.t = state.m; }
  fl.acc += d;
  if (Math.abs(fl.acc) < T.turn || state.m - fl.at < T.cool) return;
  fl.acc = 0; fl.at = state.m; state.flourishes++;
  favour(E, C_().flourish); ring(h.ux, h.uy, 60, '#f472b6'); ring(h.hx, h.hy, 36, '#fde68a');
  pop(h.hx, h.hy - 0.16 * myH(E), 'FLOURISH!', '#f9a8d4', 22); ooh(E, 0.6); E.haptic(10);
}
// Bait (the Bait card): dropping a shield you held for baitHold s, with no blow of his coming, baits his next blow
export function baitDrop(E) {
  const s = state.sh;
  if (!(has('bait') || has('feigned')) || state.m - s.heldAt < C_().baitHold || (state.sw && state.sw.fin <= 0)) return;
  if (has('bait')) state.baitT = C_().baitWin;
  // Feigned Guard: his next blow leaves him open to a riposte (endBlow)
  if (has('feigned')) state.feign = true;
  const Fy = youF(E); pop(Fy.x + 0.3 * Fy.H, Fy.y - 0.95 * Fy.H, 'GUARD DOWN...', '#c4b5fd', 16);
}
// what the Emperor reads: the meter's average over the champion's bout (this bout's, as it ends), not where it stands at the end
export const thumbFav = () => (state.favDur > 0 ? state.favSum / state.favDur : state.fav);
// a few coins thrown from the stands, arcing into the sand between the fighters (cosmetic)
function coins(E, n) {
  const L = lay(E), y0 = E.h * 0.12;
  let live = 0;
  for (const f of state.fx) if (f.k === 'c') live++;
  n = Math.min(n, Math.max(0, TUNING.crowd.coinCap - live));
  for (let i = 0; i < n; i++) {
    const x = Math.random() * E.w, tx = L.x0 + Math.random() * (L.x1 - L.x0), T = 0.8 + Math.random() * 0.4, g = 900, fl = L.floor - 2 - Math.random() * 8;
    state.fx.push({ k: 'c', x, y: y0, vx: (tx - x) / T, vy: (fl - y0 - 0.5 * g * T * T) / T, g, floor: fl, rot: Math.random() * 6.28, vr: 9 + Math.random() * 6, life: T + 0.9, max: T + 0.9 });
  }
  E.audio.play('coin');
}
export function gainMom(E, n) {
  const was = state.mom;
  state.mom = Math.min(TUNING.mom.max, state.mom + n);
  if (state.mom > was) { state.momGained += state.mom - was; state.momT = 0.4; E.audio.beep({ freq: 880 + 110 * state.mom, dur: 0.06, type: 'triangle', gain: 0.07 }); }
}
// stacks on him, each with its own end time; the oldest falls off when a new one would pass the cap
export function addBleed(E, n) {
  const B = TUNING.bleed, f = state.foe;
  if (n <= 0 || state.fallT > 0 || f.hp <= 0) return;
  const dur = B.dur * (has('letter') ? C_().letter : 1);
  for (let i = 0; i < n; i++) { state.bleed.push(state.m + dur); state.bleeds++; }
  state.bleed.sort((a, b) => a - b);
  while (state.bleed.length > B.max) state.bleed.shift();
  const Ff = foeF(E); pop(Ff.x + 0.1 * Ff.H, Ff.y - 0.9 * Ff.H, n > 1 ? `BLEED x${n}` : 'BLEED', '#f87171', 16);
}
export function updateBleed(E, dt) {
  const B = TUNING.bleed, f = state.foe;
  state.bleed = state.bleed.filter((t) => t > state.m);
  if (!state.bleed.length || state.fallT > 0 || state.endT > 0) { state.bleedT = 0; return; }
  state.bleedT += dt;
  if (state.bleedT < B.tick) return;
  state.bleedT -= B.tick;
  const n = state.bleed.length, Ff = foeF(E), [x, y] = toScreen(Ff, 0, -0.5);
  f.hp -= n * B.dmg; state.bleedDmg += n * B.dmg;
  for (let i = 0; i < 2 + n; i++) state.fx.push({ k: 'd', x: x + (Math.random() - 0.5) * 0.2 * Ff.H, y: y + (Math.random() - 0.5) * 0.3 * Ff.H, vx: 0, vy: 60 + Math.random() * 60, r: 3 + Math.random() * 2, life: 0.5, max: 0.5, c: '#b91c1c' });
  emit(E, 'tick', { n });
  if (f.hp <= 0) fell(E);
}
