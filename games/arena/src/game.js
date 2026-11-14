// Arena v2: a two-thumb gladiator duel, side view, in landscape (ADR-0013). You roll a fighter on eight seeded wheels (size, Strength, Speed,
// Stamina, armour, weapon, origin and reason), with one token per run for a Respin there or a Reroll of a draft, then fight a gauntlet of five
// rolled opponents, a sparring partner first and a named champion last; a champion who cuts you down is saved and returns as your rival. The right
// thumb is the weapon arm, moved like a trackpad from wherever it lands: a push is a jab (a jab along a joint slot's slit goes in for the weapon's
// slot multiplier), a sweep is a slash, up then down is an overhead, a long push lunges, and plates and his guard clang and recoil. The left thumb
// raises the shield High, Mid or Low (only the matching zone blocks, a block at the last moment is perfect) and works one big DODGE (tap a backstep, hold to back off).
// The foe plans each exchange with the seeded fight RNG and plays it out with honest tells (chops, thrusts, sweeps, combos, feints, bashes, nets),
// keeps his weapon's range, remembers your habits, and is winded and open when his stamina runs out. After each fell the bout is graded, the crowd's gold counted, and you
// pick one of three seeded cards (four families of rule cards that make and spend Momentum and Bleed; the third is priced in gold), with the armourer's tent once after bout 3.
// One run is one arena, picked on a ladder that opens as each arena's champion falls: the Pit's tight ring, the City's pairs (a second foe waits at the edge
// and steps in when the first is winded or felled), the Colosseum's men and beasts (a lion that crouches and pounces, a bear that rears and mauls, read
// by their bodies), the Grand Games ending on the Emperor's thumb; a crowd meter fills with style and drains on turtling,
// throws the gold as coins, drives Glory's chant and decides the thumb. H is the fighter body unit (screen height x fighter.height, scaled by size); body units have x forward, y down,
// origin at the feet. Particles are the game's own, so a hit-stop freezes them. The section map is docs/games/arena/CODEMAP.md.
// The modules (ADR-0024): tuning.js, data.js, fight.js, foe.js, cards.js, draw-fight.js, screens.js, scenes.js, game.js, features/yard.js, features/ranged.js. Only tuning.js and data.js may be read while they load.

import { makeRng, clamp } from './engine.js';
import { TUNING } from './tuning.js';
import { GAUNTLET, PROFILES, NAMES, NEW_CHAMPS, BEASTS, ARENAS, ARENA, ORIGINS, START_FAM, START_ALT, MY_NAMES, herName, PROMISE_WON, brutus,
  BRUTUS_BG, REVENGE, denarii, bandOf, endingOf, LUDUS, LUDUS_LOCK, TAILOR, famOpen, cardOpen, DECK, CARD, cardNums, gearOf, PARTS, SLOTS, BEAST_BODY,
  beastParts, ZONES, ZONE, REST_TH, PLATES, playerParts, mkPart, lenN } from './data.js';
import { lay, youF, walls, gapNow, inReach, myH, myBlade, foeF, toScreen, partCenter, guardPt, driving, fakeOut, openNow, overReach, solveArm, raised,
  shieldMax, poseFoe, pushFoe, shieldBtns, raiseShield, dodge, zoneAt, strikeOf, checkHits, land, bounce, gapHit, disable, fell, resolveSwing,
  foeStrike, tellDodge, feintRead, updateOff, chant } from './fight.js';
import { lamed, memoryOn, blockRun, buildMove, champKey, sigOf, buildSig, planExchange, startMove, startBlow, endBlow, windFoe, stepIn, updatePair,
  edgeF, settleFeint } from './foe.js';
import { HOOKS, famN, perfectWin, gildedFree, finCost, finList, finReady, finBtn, fireFinisher, updateFinisher, emit, castNet, favour, crowdDrain,
  baitDrop, thumbFav, gainMom, addBleed, updateBleed } from './cards.js';
import { artLabel, kitTier, lookFor, manArt, myLook, foeLook, canSprite } from './draw-fight.js';
import { boutTally, gradeBout, heldFams, dealable, priceOf, boutLvl, dealDraft, boutGold, openDraft, spoilOf, wield, swapSpoil, applyCard,
  colossusHearts, openTent, buyWare, leaveTent, bandageDue, openBandage, buyBandage, pickCard, skipPay, skipDraft, rerollDraft, tapCard, purseCost,
  fameOf, fameFromLedger, carveChampion, vetArenas } from './screens.js';
import { menu, story, pickArena, ludus, champs, roll, beginBout, introReady, play, over } from './scenes.js';
import { YARD, nextYard, endYard, yardFields, tipFor, ghostPath } from './features/yard.js';
import { bowShown, armsBtns, startSwap, startAim, aimAt, knifeAt, aimSnap, swapBow, bowDown, bowRelease, plainGap, arrowLands, knifeLands, knifeBuy,
  startLesson } from './features/ranged.js';

// ====== DATA TABLES (continued) ======
export const arena = () => ARENA[state.arena] || ARENAS[0];
export const arenaT = () => TUNING.arenas[arena().id];
export const bout = () => GAUNTLET[arena().rows[state.rack]] || GAUNTLET[GAUNTLET.length - 1];
export const bg = () => ORIGINS[state.me.origin].noun;
// your trait (by origin) or drive (by reason), when it is this one
export const trait = (k) => !!state.me && state.me.origin === k;
export const drives = (k) => !!state.me && state.me.reason === k;
export const debtLeft = () => Math.max(0, TUNING.story.debt - TUNING.story.debtPer * state.felled);
// Old Brutus before a bout: the arena's opening line first (your reason's thread folds in after it on the card, threadShort), your background's line before bout 2,
// the champion line last, his reason's line between (revenge climbs)
export function brutusIntro() {
  const me = state.me, r = state.rack, champ = state.foe.champion;
  if (r === 0) return arena().brutus;
  if (r === 1) return BRUTUS_BG[bg()];
  if (me.reason === 'revenge') return REVENGE.intro[champ ? 4 : r];
  return brutus(me, r === 0 ? 'first' : champ ? 'champ' : 'intro');
}
// after a fell: the reason's thread
export function brutusWon() {
  const me = state.me, n = state.felled;
  if (me.reason === 'revenge') return REVENGE.won[Math.min(n, 4) - 1];
  if (me.reason === 'debt') return `That's ${denarii(TUNING.story.debtPer)} off. ${denarii(debtLeft())} denarii to go.`;
  if (me.reason === 'freedom') return `Another notch on the wooden sword. ${n} now.`;
  if (me.reason === 'promise') return PROMISE_WON[Math.min(n, 4) - 1];
  return `Hear them? They chant ${me.name.toUpperCase()} louder now.`;
}
export const wornGear = () => gearOf(state.picks);
// the piece a card would replace: the one now worn in its slot
export const replaces = (c) => (c.slot ? wornGear()[c.slot] || null : null);
// ====== RUN STATE AND SMALL HELPERS ======
export const state = {};
export const easeOut = (u) => 1 - (1 - u) * (1 - u);
export const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
export const ZERO = { ox: 0, oy: 0, rot: 0 };
export const pidx = (id) => PARTS.findIndex((q) => q.id === id);
export const has = (id) => (!!state.picks && state.picks.includes(id)) || (!!state.wares && state.wares.includes(id));
export const count = (id) => (state.picks ? state.picks.filter((q) => q === id).length : 0) + (state.wares ? state.wares.filter((q) => q === id).length : 0);
// what the keystones take away
export const noDodge = () => has('ironwall') || has('titan');
export const noShield = () => has('untouch');
// step 22: swapping to your sidearm or aiming a knife leaves you open: no block, no swing; step 24: so does the bow, all the while it is out
export const busy = () => state.swapT > 0 || !!state.aim || !!state.bowOut;
export function pickW(rng, list) { let tot = 0; for (const e of list) tot += e[1]; let r = rng() * tot; for (const e of list) { r -= e[1]; if (r < 0) return e[0]; } return list[list.length - 1][0]; }
export const statMul = (k, v) => TUNING.stat[k][0] - TUNING.stat[k][1] * v;
// every shake goes through here: small (TUNING.juice.shake) and switchable
export function shake(E, px, sec) { const J = TUNING.juice; if (J.shakeOn) E.shake(px * J.shake, sec); }

// ====== ROLLS: your fighter, the gauntlet, and each run and bout set up from the seed ======
// Your fighter, rolled once at setup on six weighted wheels (size, three stats, origin, reason). Each wheel's landing is decided here; the wheels only show it.
// idx keeps a place for the armour and the weapon (4 and 5), which the starting purse buys (kitMe): until then no plates and fists.
export const ME_WHEEL = ['size', 'stat', 'stat', 'stat', 'armour', 'weapon', 'origin', 'reason'];
// open: what the ludus has opened (save key `ludus`), kept on the fighter so its wheels and its deal stay as rolled
export function rollMe(seed, open = []) {
  const rng = makeRng(seed ^ 0x2545f491), W = TUNING.me.wheels;
  const spin = (list) => pickW(rng, list.map((e, i) => [i, e[1]]));
  // each stat wheel is shaped by your band and the stat before it (wheelList), so they are spun in order
  const idx = [spin(W.size)];
  for (let k = 1; k <= 3; k++) idx.push(spin(wheelList(k, idx)));
  const origin = spin(wheelList(6, idx, open)), reason = spin(wheelList(7, idx, open)), pick = rng.pick(MY_NAMES);
  const [name, sex] = ORIGINS[W.origin[origin][0]].female && pick[1] !== 'f' ? herName(pick) : pick;
  // the draw that once made an axe a mace (the purse chooses now), kept so the rolls after it land as before; then your height inside your band
  rng();
  const cardRoll = rng.int(0, 9999), vary = rng.range(-1, 1);
  idx.push(kitIdx('armour', 'none'), kitIdx('weapon', 'fist'), origin, reason);
  return deriveMe({ idx, plates: [], kit: [], name, female: sex === 'f', mace: false, cardRoll, vary, open: open.slice() });
}
const kitIdx = (key, id) => TUNING.me.wheels[key].findIndex((e) => e[0] === id);
// The purse's buy (step 11): your weapon (the mace is an axe that is a mace) and the plates bought by the slot (kit), which plate their parts; the
// plates' count is your stamina's band, in its place in idx. Step 18: dual, the same weapon again in your off hand, in place of the shield
export function kitMe(me, weapon, kit, dual = false) {
  const idx = me.idx.slice(), mace = weapon === 'mace', S = TUNING.me.plateSets;
  idx[4] = kitIdx('armour', S[Math.min(kit.length, S.length - 1)]); idx[5] = kitIdx('weapon', mace ? 'axe' : weapon);
  return deriveMe({ ...me, idx, mace, kit: kit.slice(), plates: kit.flatMap((k) => PLATES[k].parts), dual: !!dual && weapon !== 'fist' });
}
// Wheel k's slices for a fighter whose earlier wheels landed at idx: a stat wheel takes its tier's weights (TUNING.me.statTiers); a slice the ludus has
// not opened weighs nothing (open: the fighter's `open`, or null for the plain wheel).
export function wheelList(k, idx, open = null) {
  const W = TUNING.me.wheels, key = ME_WHEEL[k];
  if (key !== 'stat') return open ? W[key].map((e) => (LUDUS_LOCK.has(e[0]) && !open.includes(e[0]) ? [e[0], 0, e[2], e[3]] : e)) : W[key];
  const w = TUNING.me.statTiers[statTier(k, idx).tier];
  return W.stat.map((e, i) => [e[0], w[i], e[2]]);
}
// A stat wheel's tier (L8): B, tilted by your band and shifted by the stat wheel before it, within D to S; with its causes, which the roll scene shows.
export function statTier(k, idx) {
  const M = TUNING.me, O = M.tierOrder, band = M.wheels.size[idx[0]][0], tilt = M.tilt[band][k - 1];
  const prev = k > 1 && idx[k - 1] != null ? M.chain[M.wheels.stat[idx[k - 1]][0] - 1] : 0;
  return { tier: O[clamp(O.indexOf('B') + tilt + prev, 0, O.length - 1)], tilt, prev, band };
}
// everything that follows from the wheels' landings
// `halves` is the saved name for the whole-heart count (the save shape did not change in 5b), at the bout-length setting
export function deriveMe(me) {
  const M = TUNING.me, v = (k) => wheelList(k, me.idx)[me.idx[k]][0];
  const size = v(0), str = v(1), spd = v(2), sta = v(3), set = v(4);
  const score = str + spd + sta + M.sizes[size].score;
  const tier = M.tiers.find((t) => score >= t[1])[0], underdog = score < M.underdog;
  return { ...me, size, str, spd, sta, set, weapon: v(5), origin: v(6), reason: v(7), score, tier, underdog, halves: lenN(M.sizes[size].hearts * M.heartsPerBase + (underdog ? M.underdogHalves : 0)) };
}
// The respin: body wheel k (size or a stat) rolled again with its own seeded stream, by its odds but never landing where it was
export function respinMe(me, k, seed) {
  const rng = makeRng((seed ^ 0x6c8e9cf5) + k * 7919), list = wheelList(k, me.idx, me.open || []);
  const idx = me.idx.slice();
  idx[k] = pickW(rng, list.map((e, j) => [j, j === me.idx[k] ? 0 : e[1]]));
  return deriveMe({ ...me, idx, plates: me.plates.slice() });
}
// A veteran from the Wall of Champions: the rolls they cleared their arena with, plus one point on the stat chosen when they were carved (TUNING.ludus.vetUp),
// with their scar line; never more, however often they win again
export function vetMe(c, open = [], extra = '') {
  const idx = c.me.idx.slice();
  if (c.up) idx[c.up] = Math.min(TUNING.ludus.vetCap, idx[c.up] + TUNING.ludus.vetUp);
  return deriveMe({ ...c.me, idx, plates: c.me.plates.slice(), open: open.slice(), extra, vid: c.id, up: c.up || 0, scar: c.scar });
}
// A fighter's size: his band's row at his scale (the band's, varied by vary x TUNING.sizeVary), with every effect read off the bands' rows at that
// scale, a straight line between the two rows either side (and past the end rows). Your arm reach and hand lag follow the same way; hearts are by band.
const BAND = (id) => TUNING.sizes.find((z) => z.id === id);
export function sizeOf(id, vary = 0) {
  const Z = TUNING.sizes, M = TUNING.me.sizes, b = BAND(id) || BAND('medium'), s = b.scale * (1 + clamp(vary, -1, 1) * TUNING.sizeVary);
  let i = 0;
  while (i < Z.length - 2 && s > Z[i + 1].scale) i++;
  const a = Z[i], c = Z[i + 1], u = (s - a.scale) / (c.scale - a.scale), at = (A, C, k) => A[k] + (C[k] - A[k]) * u;
  return { id: b.id, name: b.name, band: Z.indexOf(b), vary, scale: s, hp: at(a, c, 'hp'), reach: at(a, c, 'reach'), dmg: at(a, c, 'dmg'), wind: at(a, c, 'wind'), step: at(a, c, 'step'),
    arm: at(M[a.id], M[c.id], 'arm'), lag: at(M[a.id], M[c.id], 'lag') };
}
// your size (cached on your band and height), weapon and stat multipliers
let meSz = null;
export function meSize() {
  const me = state.me, key = `${me.size}:${me.vary || 0}`;
  if (!meSz || meSz.key !== key) meSz = { ...sizeOf(me.size, me.vary || 0), key };
  return meSz;
}
export const meWeapon = () => TUNING.me.weapons[state.me.weapon];
export const meLag = () => meSize().lag * TUNING.me.spdLag[state.me.spd - 1] / meWeapon().speed;
export const weaponName = (me) => { const W = TUNING.me.weapons[me.weapon]; return W.alt && me.mace ? W.alt : W.name; };

// The foe's plates follow his set: light 1, medium 2 or 3 (never chest and belly both, legs bare), heavy a helmet and 4 of chest, belly, arms and legs;
// plus: plates his arena adds (TUNING.arenas.*.plates). The set also decides how many joint slots are open between the pieces.
export function foeParts(rng, set, plus = 0, gaps = 0) {
  let on;
  if (set.helmet) on = new Set(['head', ...rng.shuffle(['chest', 'belly', 'armF', 'armB', 'legs']).slice(0, set.plates[0] + plus)]);
  else {
    const n = rng.int(set.plates[0], set.plates[1]);
    for (let k = 0; k < 30; k++) { on = new Set(rng.shuffle(n === 1 ? ['chest', 'belly', 'armF', 'armB'] : ['head', 'chest', 'belly', 'armF', 'armB']).slice(0, n + plus)); if (!(on.has('chest') && on.has('belly'))) break; }
    if (on.has('chest') && on.has('belly')) on.delete('belly');
  }
  const out = PARTS.map((d) => mkPart(d, on.has(d.id)));
  for (const d of rng.shuffle(SLOTS).slice(0, set.slots + gaps)) { const q = mkPart(d, false); q.slot = true; out.push(q); }
  return out;
}

// One fighter of the gauntlet, rolled from the bout's tables: a size band by its weight (x his arena's lean) and his height in it, weapon, armour set, and three 1-5 stats
// from his points and profile (rollStats). tier is his gauntlet row, at his place in the arena's run; a champion is picked from the arena's pool (or
// from pool, the Grand Games' champion of that bout).
function rollFighter(rng, tier, weapon, used, A = ARENAS[0], at = tier, pool = null) {
  const G = GAUNTLET[tier], T = TUNING, champ = !!G.champion || !!pool;
  let band, set;
  for (let k = 0; k < 20; k++) {
    band = pickW(rng, G.sizes.map(([id, w]) => [id, w * TUNING.arenas[A.id].size[TUNING.sizes.indexOf(BAND(id))]]));
    const ai = rng.pick(G.armour);
    set = T.armourSets.find((z) => z.id === ai);
    if (!used.has(`${band}${weapon.id}${set.id}`)) break;
  }
  used.add(`${band}${weapon.id}${set.id}`);
  const size = sizeOf(band, rng.range(-1, 1)), st = rollStats(rng, tier, size, A, null, champ);
  const pick = champ ? rng.pick(pool || A.champs) : rng.pick(NAMES), C = NEW_CHAMPS[pick];
  if (C && C.weapon) weapon = TUNING.weapons.find((z) => z.id === C.weapon);
  return { tier, at, name: C ? C.name : pick, ck: C ? pick : null, title: C ? C.title || null : null, pair: null, champion: champ, size, prof: st.prof, weapon, set, str: st.v[0], spd: st.v[1], sta: st.v[2],
    shield: rng.chance(weapon.shield), mace: rng.chance(0.5), partSeed: (rng() * 2 ** 32) >>> 0, plus: TUNING.arenas[A.id].plates };
}
// His stats (TUNING.foeStats): the row's points (plus a champion's, plus the arena's shift for each stat), split by a profile rolled with his band's
// weights (a beast's own, w), a little seeded jitter, each 1 to 5. His weakest stat (on a tie, the one his profile gives least) is held to the weakness cap,
// and its spare points go to the others while they have room, so every foe has an opening to read.
function rollStats(rng, tier, size, A, w = null, champ = !!GAUNTLET[tier].champion) {
  const F = TUNING.foeStats, P = TUNING.profiles, cap = champ ? F.champWeak : F.weak;
  const prof = pickW(rng, Object.keys(P).map((id) => [id, w ? w[id] : P[id].w[size.band]])), sh = P[prof].share;
  const budget = clamp(F.budget[tier] + (champ ? F.champ : 0) + Math.round(3 * TUNING.arenas[A.id].shift), 3, 10 + cap);
  const raw = sh.map((q) => budget * q + rng.range(-F.jitter, F.jitter)), v = raw.map((r) => clamp(Math.floor(r), 1, 5)), I = [0, 1, 2];
  const sum = () => v[0] + v[1] + v[2], left = (i) => raw[i] - v[i];
  while (sum() < budget) { const up = I.filter((i) => v[i] < 5).sort((a, b) => left(b) - left(a)); if (!up.length) break; v[up[0]]++; }
  while (sum() > budget) v[I.filter((i) => v[i] > 1).sort((a, b) => left(a) - left(b))[0]]--;
  const weak = I.slice().sort((a, b) => v[a] - v[b] || sh[a] - sh[b] || raw[a] - raw[b])[0];
  if (v[weak] > cap) {
    let spare = v[weak] - cap;
    v[weak] = cap;
    for (const i of I.filter((j) => j !== weak).sort((a, b) => sh[b] - sh[a] || raw[b] - raw[a])) { const add = Math.min(spare, 5 - v[i]); v[i] += add; spare -= add; }
  }
  return { prof, v };
}
// the profile whose shares sit nearest these stats (a rival saved before profiles)
function profileOf(d) {
  const P = TUNING.profiles, t = d.str + d.spd + d.sta, err = (id) => P[id].share.reduce((e, q, i) => e + (q - [d.str, d.spd, d.sta][i] / t) ** 2, 0);
  return Object.keys(P).sort((a, b) => err(a) - err(b))[0];
}
// A beast of the gauntlet: its kind's band at a seeded height in it, its stats from the row's points split by a profile its kind leans to (the weakness
// rule holds), a seeded epithet. Its "weapon" is its kind's numbers (TUNING.beasts) and it has no shield, gear or guard; its plates are its barding
// (step 16) when it wears one, else none.
const beastWeapon = (kind) => ({ ...TUNING.beasts[kind], id: kind, name: 'CLAWS', len: 0, combo: [1, 1], shield: 0, drain: 0 });
const beastSet = (kind) => ({ id: 'beast', name: 'HIDE', plates: [0, 0], helmet: false, slots: BEAST_BODY[kind].slots.length });
function rollBeast(rng, tier, kind, A, at, young = false, armour = false) {
  const B = TUNING.beasts[kind], band = young ? TUNING.sizes[Math.max(0, TUNING.sizes.indexOf(BAND(B.band)) - TUNING.beastYoung)].id : B.band;
  const size = sizeOf(band, rng.range(-1, 1)), st = rollStats(rng, tier, size, A, B.prof);
  return { tier, at, name: young ? `Young ${BEASTS[kind].name.toLowerCase()}` : BEASTS[kind].name, young, armour, ck: null, title: null, pair: null, champion: false, beast: kind, epithet: rng.pick(BEASTS[kind].epithets), size, prof: st.prof,
    weapon: beastWeapon(kind), set: beastSet(kind), str: st.v[0], spd: st.v[1], sta: st.v[2], shield: false, mace: false, partSeed: (rng() * 2 ** 32) >>> 0 };
}
// a fighter from a saved rival record, on the rolled one's place (a beast, the Beastmaster's lion, from its own)
function fromRival(c, rv) {
  if (rv.beast && BEASTS[rv.beast] && BAND(rv.size)) {
    return { ...c, name: BEASTS[rv.beast].name, ck: null, title: null, champion: false, beast: rv.beast, armour: !!rv.armour, epithet: rv.epithet || BEASTS[rv.beast].epithets[0], size: sizeOf(rv.size, rv.vary || 0), prof: rv.prof || profileOf(rv),
      weapon: beastWeapon(rv.beast), set: beastSet(rv.beast), str: rv.str, spd: rv.spd, sta: rv.sta, shield: false, mace: false, partSeed: rv.partSeed >>> 0, gaps: {} };
  }
  const T = TUNING, weapon = T.weapons.find((z) => z.id === rv.weapon), set = T.armourSets.find((z) => z.id === rv.set);
  if (!BAND(rv.size) || !weapon || !set) return null;
  return { ...c, name: rv.name, ck: rv.ck || null, title: rv.title || null, rival: true, champion: rv.champion != null ? rv.champion : c.champion, size: sizeOf(rv.size, rv.vary || 0), prof: rv.prof || profileOf(rv), weapon, set, str: rv.str, spd: rv.spd, sta: rv.sta, shield: !!rv.shield && !rv.dual, dual: !!rv.dual, mace: !!rv.mace, partSeed: rv.partSeed >>> 0, gaps: rv.gaps || {} };
}

// is bout i (0-based) of arena A a pair: from its pairs bout on, or one of the bouts it lists
const pairAt = (A, i) => { const P = TUNING.arenas[A.id].pairs; return Array.isArray(P) ? P.includes(i) : i >= P; };
// The arena's gauntlet. A saved rival takes the champion's place: the same man, look and weapon as the one who cut you down (and his partner, in a pair).
// From the arena's pairs bout on, each bout has a second foe waiting, rolled from the same row on his own stream; the Twins' second is Pollux, a champion
// too (the Twins always fight as a pair), and Hermes's partner is an ordinary man from the row below. The Grand Games (step 18): each bout a champion
// from its pool, the first your rival from the Pit (first) when one waits.
function rollGauntlet(seed, rival, A = ARENAS[0], first = null) {
  const rng = makeRng(seed ^ 0x51ed270b), used = new Set(), W = TUNING.weapons, rows = A.rows;
  const order = rng.shuffle(W.map((_, i) => i));
  const g = rows.map((row, i) => rollFighter(rng, row, W[i < order.length ? order[i] : rng.int(0, W.length - 1)], used, A, i, A.pools ? A.pools[i] : null));
  const pr = makeRng(seed ^ 0x6a09e667);
  g.forEach((d, i) => {
    const twin = d.ck === 'twins';
    if (!pairAt(A, i) && !twin) return;
    const row = d.champion && !twin ? d.tier - 1 : d.tier;
    let q;
    for (let k = 0; k < 6 && (!q || g.some((o) => o.name === q.name || (o.pair && o.pair.name === q.name))); k++) q = rollFighter(pr, row, pr.pick(W), used, A, i);
    d.pair = twin ? { ...q, name: NEW_CHAMPS.twins.pair, ck: null, title: null, champion: true } : { ...q, champion: false, ck: null, title: null };
  });
  // the Colosseum: its beast bouts are a lion or a bear (on their own stream), and the Beastmaster's lion waits at the edge as his partner
  const br = makeRng(seed ^ 0x1f83d9ab), AT = TUNING.arenas[A.id];
  for (const i of AT.beasts || []) if (g[i]) g[i] = rollBeast(br, g[i].tier, br.pick(Object.keys(BEASTS)), A, i, (AT.young || []).includes(i), (AT.armour || []).includes(i));
  g.forEach((d, i) => { const C = NEW_CHAMPS[d.ck]; if (C && C.beast) { d.pair = rollBeast(pr, d.tier, C.beast, A, i); d.sends = true; } });
  // a rival keeps his own partner; one who sends no beast never borrows the rolled Beastmaster's lion
  const asRival = (i, rec, from) => {
    const c = g[i], rv = rec && fromRival(c, rec);
    if (!rv) return;
    const C = NEW_CHAMPS[rv.ck], cp = c.pair && c.pair.beast && !(C && C.beast) ? null : c.pair;
    g[i] = rv; rv.sends = !!(C && C.beast); rv.from = from; rv.pair = rec.pair ? fromRival({ ...(c.pair || c), pair: null }, rec.pair) || cp : cp;
  };
  asRival(g.length - 1, rival, A.id);
  if (A.firstRival) asRival(0, first, A.firstRival);
  // Step 18: two blades, on their own stream: a share of the men from the City on (never a champion or a rival, only with a blade), with no shield
  const dr = makeRng(seed ^ 0x7a3d51c9), DS = TUNING.arenas[A.id].dual;
  if (DS) for (const d of g.flatMap((q) => [q, q.pair]).filter(Boolean)) if (!d.beast && !d.champion && !d.rival && TUNING.dual.weapons.includes(d.weapon.id) && dr.chance(DS)) { d.dual = true; d.shield = false; }
  // Step 22: a sidearm, on its own stream: a share of the men from the City on whose weapon carries one (never a champion, a rival or two blades)
  const sr = makeRng(seed ^ 0x51ed27a3), SF = TUNING.sidearm.foe, SC = SF.chance[A.id] || 0;
  if (SC) for (const d of g.flatMap((q) => [q, q.pair]).filter(Boolean)) if (!d.beast && !d.champion && !d.rival && !d.dual && SF.carry[d.weapon.id] && sr.chance(SC)) d.side = SF.carry[d.weapon.id];
  // his gear and gap guards, on their own stream so the fighters above roll as they always did (a pair's second on another); a rival keeps the gear he wore
  const gr = makeRng(seed ^ 0x2f6b9a17), gp = makeRng(seed ^ 0x3c6ef373);
  const kit = (d, src, rec) => { const gear = rollGear(src, d, d.tier, A), guards = rollGuards(src, d, d.tier, A); d.gear = d.rival && rec && rec.gear ? rec.gear.slice() : gear; d.guards = guards; };
  g.forEach((d) => kit(d, gr, rival));
  g.forEach((d) => { if (d.pair) kit(d.pair, gp, rival && rival.pair); });
  return g;
}
export const rivalOf = (d) => ({ name: d.name, ck: d.ck || null, title: d.title || null, champion: !!d.champion, size: d.size.id, vary: d.size.vary, prof: d.prof, weapon: d.weapon.id, set: d.set.id, str: d.str, spd: d.spd, sta: d.sta, shield: d.shield, dual: !!d.dual, mace: d.mace, partSeed: d.partSeed,
  gear: (d.gear || []).slice(), gaps: { ...(d.gaps || {}) }, pair: d.pair ? rivalOf(d.pair) : null, ...(d.beast ? { beast: d.beast, epithet: d.epithet, armour: !!d.armour } : {}) });
// His gear from the deck: more pieces in later bouts, one a slot, up to the bout's rarity; a champion also wears a legendary. A shield piece only on a
// shield-bearer, and the cape that bans the shield only on a man without one.
function rollGear(rng, d, i, A = ARENAS[0]) {
  if (d.beast) return [];
  const F = TUNING.foeGear, out = [], fams = ['wall', 'blood', 'dancer', 'brute', 'trick', 'show', 'rare'], n = F.n[i] + TUNING.arenas[A.id].gear;
  const ok = (c) => c.slot && !c.vault && !out.some((id) => CARD[id].slot === c.slot) && (c.slot !== 'shield' || d.shield) && !(c.bans === 'shield' && d.shield);
  if (d.champion) { const L = DECK.filter((c) => c.key && ok(c)); out.push(rng.pick(L).id); }
  for (let k = 0; k < 30 && out.length < n; k++) {
    const fam = rng.pick(fams), list = DECK.filter((c) => c.fam === fam && !c.key && c.tier <= F.rar[i] && ok(c));
    if (list.length) out.push(rng.pick(list).id);
  }
  return out;
}
// His gap guards: never in bout 1, at least TUNING.guard.open gaps left open, a chance of one (and then of a second) rising by bout, the champion always one,
// the gorget the most common. A rival first guards the gap you hit most against him.
function rollGuards(rng, d, i, A = ARENAS[0]) {
  if (d.beast) return [];
  const G = TUNING.guard, S = TUNING.arenas[A.id].guard, open = foeParts(makeRng(d.partSeed), d.set, d.plus || 0, dualGaps(d)).filter((q) => q.slot).map((q) => q.d.id), room = Math.max(0, open.length - G.open), out = [];
  let n = rng.chance(Math.min(1, G.one[i] + S[0])) ? (rng.chance(Math.min(1, G.two[i] + S[1])) ? 2 : 1) : 0;
  if (d.champion) n = Math.max(n, 1);
  if (GAUNTLET[i].spar) n = 0;
  const gaps = d.rival && d.gaps, best = gaps && open.filter((id) => gaps[id] > 0).sort((a, b) => gaps[b] - gaps[a])[0];
  if (best && n > 0) out.push(best);
  while (out.length < Math.min(n, room)) out.push(pickW(rng, open.filter((id) => !out.includes(id)).map((id) => [id, G.w[id]])));
  return out;
}
// the gaps a man with two blades has besides his set's, and all he has
export const dualGaps = (d) => (d.dual ? TUNING.dual.gaps : 0);
const gapsOf = (d) => Math.min(SLOTS.length, d.set.slots + dualGaps(d));
// the guarded gaps are shut: drawn as their guard, and hit as a guard
export function guardParts(parts, guards) { for (const q of parts) if (q.slot && (guards || []).includes(q.d.id)) q.guard = true; return parts; }

// one foe as he stands at the bout's start, from his gauntlet record (a pair's foes each have their own health, stamina, parts and gear)
function makeFoe(d, pair) {
  const FT = TUNING.foe, f = { ...d };
  f.wname = (d.weapon.alt && d.mace ? d.weapon.alt : d.weapon.name) + (d.dual ? ' x2' : '');
  f.parts = d.beast ? beastParts(d.beast, !!d.armour) : guardParts(foeParts(makeRng(d.partSeed), d.set, d.plus || 0, dualGaps(d)), d.guards); f.look = d.beast ? null : foeLook(d); f.cloak = null; f.bp = null;
  f.maxHp = Math.round(FT.hp * d.size.hp * (1 + FT.tierHp * d.tier) * (d.champion ? FT.champHp : 1) * (pair ? TUNING.pairs.hp : 1) * TUNING.arenaHp[arena().id] * TUNING.boutLength); f.hp = f.maxHp; f.shown = f.hp;
  f.staMax = TUNING.foeSta.base + TUNING.foeSta.per * d.sta; f.sta = f.staMax; f.staT = 9; f.staShown = 1;
  f.home = d.weapon.range + d.size.reach; f.strike = d.weapon.strike + d.size.reach;
  f.th = REST_TH; f.dx = 0; f.dy = 0; f.a = 0; f.fr = {}; f.down = false; f.bleed = []; f.dents = 0; f.shrug = false;
  // step 22: his long weapon and his sidearm, each a TUNING.weapons row (swapped by range in foeSidearm)
  f.mainW = d.weapon; f.sideW = d.side ? TUNING.weapons.find((w) => w.id === d.side) : null;
  return f;
}
export function newRack(E) {
  const d = state.gauntlet[state.rack];
  state.foe = makeFoe(d, !!d.pair); state.edge = d.pair ? makeFoe(d.pair, true) : null;
  state.cam = null;
  state.swapping = false; state.tauntT = 0; state.taunt = ''; state.sent = false; state.sendT = 0;
  state.rng = makeRng(state.seed + state.rack * 7919);
  state.cover = null; state.step = { x: state.foe.home, tgt: 0, t: 1, dodgeT: 0, dodgeCool: 0 };
  state.pop = 1; state.fallT = 0; state.sw = null; state.move = null; state.plan = null; state.stun = 0; state.stagger = 0; state.kickA = 0; state.kickV = 0;
  state.winded = 0; state.windedMax = 1; state.retreat = 0; state.chase = 0; state.mood = { retreat: false };
  state.mem = { blocks: [], lunges: [], turtle: 0, feints: [], jabs: 0 }; state.jabGuard = 0;
  state.gapOpen = null; state.ownT = -9; state.recT = -9; state.baitT = 0; state.puppetN = 0; state.awed = false; state.lng = null; state.foeNet = 0; state.you.drive = 0; state.you.dk = 0; state.burnT = 0;
  state.crushN = 0; state.cutAcc = 0; state.zfx = null;
  state.swingIn = 1.2; state.intro = true; state.introT = 0; state.introGo = -1; state.warm = false; state.introHelp = false;
  if (state.me.reason === 'glory') chant(E);
  saveRun(E);
  settleFeint('none');
  state.bout = { felled: false, shrugged: false, foeShrug: false, bread: false, net: false, gaps: {}, perf: state.perfects, slot: state.slotHits, read: state.feintsRead, pun: state.punishes, taken: state.taken, dodge: state.dodged, lame: state.lamings, bash: state.bashHits };
  state.open = 0; state.riposte = 0; state.slowT = 0; state.snapT = 0;
  Object.assign(state, { slowFx: 0, slowMul: 1, zoomT: 0, dropT: 0, ghostT: 0, ghostAt: -9, ghosts: [], paintT: 0, banner: null, shatter: null, steps: { foe: null, me: null } });
  // step 18: his signature's wait, Aquila's switch, the Huntress's spear, the crossed blades' guard, your off hand
  Object.assign(state, { sigN: 0, switchT: 0, flyS: 0, spearT: 0, spearAt: null, gbreak: 0, coverHits: 0, offT: 0, offHit: null });
  // step 22: your swap, your aim, a knife in flight and one spent in the sand, his swap; step 22b: the first-knife lesson
  Object.assign(state, { swapT: 0, aim: null, knife: null, knifeFall: null, foeSwapT: 0, kLesson: null });
  // step 24: each bout starts with the blade in hand and the shield on the arm
  Object.assign(state, { bowOut: false, bowSwap: false, arrow: null, arrowFall: null, follow: null });
  state.sh.hits = shieldMax(); state.sh.broken = false; state.sh.cool = 0; state.sh.blocked = false;
  // both fighters start each bout back on their marks
  Object.assign(state.foot, { pos: 0, tgt: 0, v: 1, wallT: -9, foeWallT: -9 });
  state.mom = 0; state.momT = 0; state.bleed = []; state.bleedT = 0; state.lastTellDodge = -9;
  state.favM = state.m; state.favSum = 0; state.favDur = 0; state.finSel = '';
  state.armed = {}; state.openAll = 0; state.disarm = 0; state.flyW = 0; state.dents = 0; state.cape = 0;
  // the vault's clocks and counts: Bulwark's blocks in a row, Shadow Step's dodge, Hammer and Anvil's block, Counterstep's block, Feigned Guard's lowered shield
  state.bulw = { n: 0, taken: state.taken }; state.shadowM = -9; state.anvilM = -9; state.blockM = -9; state.feign = false;
  emit(E, 'start');
}

export function nextGap() { const S = TUNING.swing; return S.gap * 0.6 + state.rng.range(0, S.gapSpread); }

export function newRound(E, seed, me0, rv, arenaId = 'pit', fr) {
  const M = TUNING.me, me = { ...me0, plates: me0.plates.slice() }, A = ARENA[arenaId] || ARENAS[0], rival = rv !== undefined ? rv : E.save.get('rivals', {})[A.id] || null;
  const first = !A.firstRival ? null : fr !== undefined ? fr : E.save.get('rivals', {})[A.firstRival] || null;
  Object.assign(state, {
    me,
    maxHp: me.halves,
    staMax: M.staMax[me.sta - 1],
    lessons: E.save.get('feintLesson', 0),
    caption: null,
    slowT: 0,
    picks: [],
    grades: [],
    goods: [],
    draft: null,
    token: TUNING.token,
    tokenUsed: '',
    epicsSeen: 0,
    switchReads: 0,
    hint: false,
    boutT0: 0,
    stepsIn: 0,
    stepsOut: 0,
    wallHits: 0,
    foeWall: 0,
    outReach: 0,
    dodged: 0,
    chases: 0,
    shrugs: 0,
    rivalBeaten: 0,
    foot: { pos: 0, tgt: 0, v: 1, wallT: -9, foeWallT: -9 },
    seed,
    arena: A.id,
    rng: makeRng(seed ^ 0x9e3779b9),
    gauntlet: rollGauntlet(seed, rival, A, first),
    results: [],
    rack: 0,
    m: 0,
    stop: 0,
    kickA: 0,
    kickV: 0,
    hp: me.halves,
    endT: 0,
    dodgeT: 0,
    dodgeMax: TUNING.dodge.dur,
    dodgeCool: 0,
    away: false,
    dodgeM: -9,
    hurt: 0,
    done: false,
    exhaust: 0,
    exMsg: -9,
    lunging: false,
    lunges: 0,
    lungeMiss: false,
    slotHits: 0,
    dg: { down: false, id: -1, t: 0 },
    stamina: M.staMax[me.sta - 1],
    lastAtk: -9,
    riposte: 0,
    open: 0,
    netT: 0,
    pushT: 0,
    gapHits: 0,
    clangs: 0,
    thuds: 0,
    thudsOn: 0,
    broken: 0,
    overheads: 0,
    jabs: 0,
    slashes: 0,
    blocks: 0,
    perfects: 0,
    dodges: 0,
    staOuts: 0,
    counters: 0,
    counterHits: 0,
    taken: 0,
    felled: 0,
    feints: 0,
    feintsRead: 0,
    feintsBit: 0,
    feintsNone: 0,
    baited: 0,
    bitT: 0,
    feintLive: false,
    plateSaves: 0,
    combos: 0,
    windeds: 0,
    punishes: 0,
    bashes: 0,
    bashHits: 0,
    nets: 0,
    netted: 0,
    zoneReads: 0,
    lungeReads: 0,
    turtleReads: 0,
    presses: 0,
    retreats: 0,
    moveCount: {},
    fx: [],
    pops: [],
    streaks: [],
    trail: [],
    mom: 0,
    momT: 0,
    momGained: 0,
    momSpent: 0,
    lamings: 0,
    gold: 0,
    goldEarned: 0,
    lastGold: null,
    bought: [],
    rerolls: 0,
    tent: null,
    tentDone: false,
    lab: null,
    labMom: false,
    labUsed: 0,
    fins: [],
    wares: [],
    carry: 0,
    capCut: 0,
    ownFeints: 0,
    feintsLearned: 0,
    flourishes: 0,
    netsCast: 0,
    foeNet: 0,
    fl: { acc: 0, t: 0, ang: null, at: -9, fx: 0, fy: 0 },
    armed: {},
    openAll: 0,
    disarm: 0,
    flyW: 0,
    dents: 0,
    cape: 0,
    bleed: [],
    bleedT: 0,
    bleeds: 0,
    bleedDmg: 0,
    you: { lunge: 0, lungeK: 0, drive: 0, dk: 0, a: 0, back: 0, hopY: 0, push: 0, parts: playerParts(me), fr: {} },
    drives: 0,
    driveDist: 0,
    burn: 0,
    burnT: 0,
    spoils: 0,
    landM: -9,
    buy: '',
    purseLeft: null,
    foe: {},
    edge: null,
    swapping: false,
    tauntT: 0,
    taunt: '',
    fav: 0,
    favStep: 0,
    favT: 0,
    favShown: 0,
    favM: 0,
    favSum: 0,
    favDur: 0,
    lastHitM: -9,
    opened: null,
    finSel: '',
    finHintT: 0,
    hintT: 0,
    hintS: '',
    crowd: [],
    // step 19: Broken Chains spent, drafts skipped, the tags' counts and clocks; step 20: each signature's uses and answers ({ rage: [2, 1] })
    // step 22: the knives you carry, thrown, and in a gap (22b: on plate, on skin, missed); your swaps and his
    knives: 0,
    knivesThrown: 0,
    knifeGaps: 0,
    knifePlate: 0,
    knifeSkin: 0,
    knifeMiss: 0,
    mySwaps: 0,
    foeSwaps: 0,
    // step 24: arrows loosed, and where they went; the seconds the bow was out
    arrows: 0,
    arrowGaps: 0,
    arrowSkin: 0,
    arrowPlate: 0,
    arrowMiss: 0,
    bowTime: 0,
    // step 23b: the training yard's steps for the export (each one's seconds and failed attempts), and the step it was skipped at
    yard: '',
    yardSkip: '',
    chains: 0,
    skips: 0,
    jabRun: 0,
    jabGuard: 0,
    tagN: {},
    tagM: {},
    drillN: 0,
    kneadN: 0,
    kneadM: -9,
    oxLow: false,
    specials: {},
    readT: 0,
    hpSeen: null,
    heartFx: null,
    introHelp: false,
    sh: { t: -1, cool: 0, up: 0, hits: TUNING.shield.hits, broken: false, flash: 0, zone: ZONES[1], held: false, hid: -1, heldAt: -9, zy: -0.58, arm: 0, blocked: false, pressT: -9 },
    hand: { down: false, id: -1, fx: 0, fy: 0, tgx: 0, tgy: 0, ux: 0, uy: 0, pux: 0, puy: 0, hx: 0, hy: 0, phx: 0, phy: 0, ptgy: 0, ex: 0, ey: 0, sx: 0, sy: 0, bx: 1, by: 0, ang: 0, pang: 0, ph: 0, vx: 0, vy: 0, along: 0, hvx: 0, hvy: 0, lock: 0, grip: 0, sp: 0, raisedT: -9, atk: null },
  });
  for (const c of startCards(me)) applyCard(c);
  // the ludus: the fourth card in the first draft (training ground), and the tailor's looks on you
  const L = E.save.get('ludus', []);
  state.fourth = L.includes('fourth'); state.tailor = tailorOf(E);
  const cr = makeRng(seed ^ 0x1234567);
  for (let i = 0; i < 70; i++) state.crowd.push({ x: cr.range(0, 1), y: cr.range(0, 1), r: cr.range(2, 4), c: cr.int(0, 3) });
}
// your background's start card: a common of its family (or START_ALT's while the ludus shuts it), picked by the roll
function startCard(me) {
  const f0 = START_FAM[ORIGINS[me.origin].noun], fam = famOpen(me, f0) ? f0 : START_ALT[f0], list = DECK.filter((c) => c.fam === fam && c.tier === 0);
  return list[(me.cardRoll || 0) % list.length];
}
// every card a run starts with: the background's, then the training ground's slot (me.extra, a card picked before), which takes its slot if both need it
export function startCards(me) {
  const sc = startCard(me), x = me.extra && CARD[me.extra];
  if (!x || x.id === sc.id) return [sc];
  return x.slot && x.slot === sc.slot ? [x] : [sc, x];
}
// the tailor's looks you wear: each one bought and switched on, its style's colour
function tailorOf(E) {
  const L = E.save.get('ludus', []), T = E.save.get('tailor', {}), out = {};
  for (const k of Object.keys(TAILOR)) if (L.includes(k) && T[k] != null && T[k] >= 0 && TAILOR[k][T[k]]) out[k] = { i: T[k], col: TAILOR[k][T[k]][1] };
  return out;
}
// The run is saved at the start of each bout (the run's counts, your fighter and the bout reached) and resumed there; the bout itself replays from its seed.
export const RUN_KEYS = [
  'hp',
  'maxHp',
  'staMax',
  'picks',
  'grades',
  'results',
  'token',
  'tokenUsed',
  'epicsSeen',
  'switchReads',
  'stepsIn',
  'stepsOut',
  'wallHits',
  'foeWall',
  'outReach',
  'dodged',
  'chases',
  'capCut',
  'shrugs',
  'gapHits',
  'slotHits',
  'lunges',
  'clangs',
  'broken',
  'overheads',
  'jabs',
  'slashes',
  'blocks',
  'perfects',
  'dodges',
  'staOuts',
  'counters',
  'counterHits',
  'taken',
  'felled',
  'feints',
  'feintsRead',
  'feintsBit',
  'feintsNone',
  'baited',
  'combos',
  'windeds',
  'punishes',
  'bashes',
  'bashHits',
  'nets',
  'netted',
  'zoneReads',
  'lungeReads',
  'turtleReads',
  'presses',
  'retreats',
  'plateSaves',
  'moveCount',
  'gold',
  'goldEarned',
  'wares',
  'tentDone',
  'bought',
  'rerolls',
  'momGained',
  'momSpent',
  'lamings',
  'bleeds',
  'bleedDmg',
  'ownFeints',
  'feintsLearned',
  'flourishes',
  'fins',
  'carry',
  'labUsed',
  'fav',
  'favStep',
  'fourth',
  'netsCast',
  'drives',
  'driveDist',
  'spoils',
  'buy',
  'purseLeft',
  'chains',
  'skips',
  'specials',
  'knives',
  'knivesThrown',
  'knifeGaps',
  'knifePlate',
  'knifeSkin',
  'knifeMiss',
  'mySwaps',
  'yard',
  'yardSkip',
  'arrows',
  'arrowGaps',
  'arrowSkin',
  'arrowPlate',
  'arrowMiss',
  'bowTime'
];
// A deep copy, since the engine flushes the save whenever the page is hidden, long after the live objects have moved on. `rack` is the bout to resume at;
// an open draft is saved too (its card ids), and resumes at the bout just felled with the same cards.
export function saveRun(E, rack = state.rack) {
  if (state.drill) return;
  const c = state.gauntlet[state.gauntlet.length - 1];
  const d = state.draft, draft = d ? { grade: d.grade, tally: d.tally, gold: d.gold, ids: d.cards.map((q) => q.id), priced: d.priced, odds: d.odds, spoil: d.spoil || null } : null;
  const f0 = state.gauntlet[0], first = f0.rival && f0.from !== state.arena ? rivalOf(f0) : null;
  E.save.set('run', JSON.parse(JSON.stringify({ seed: state.seed, arena: state.arena, rack, me: state.me, rival: c.rival ? rivalOf(c) : null, first, draft, ...Object.fromEntries(RUN_KEYS.map((k) => [k, state[k]])) })));
  // the menu's fighter and backdrop (step 12): the last fighter you sent out, and where
  E.save.set('last', JSON.parse(JSON.stringify({ arena: state.arena, me: state.me })));
}
export function resumeRun(E, run) {
  newRound(E, run.seed, run.me, run.rival, run.arena, run.first || null);
  for (const k of RUN_KEYS) if (k in run) state[k] = run[k];
  state.results = (run.results || []).map((q) => q || undefined);
  // a run saved before whole hearts can hold a half: round it up so no part-heart is drawn
  state.hp = Math.ceil(state.hp); state.maxHp = Math.ceil(state.maxHp);
  state.rack = run.rack; state.you.parts = playerParts(state.me); state.stamina = state.staMax; state.favShown = state.fav;
  const d = run.draft;
  if (d) state.draft = { grade: d.grade, tally: d.tally, gold: d.gold, cards: d.ids.map((id) => CARD[id]), priced: d.priced, odds: d.odds || [], t: 0, btns: [], reroll: null, help: null, helpOn: 0, view: false, wear: null, spoil: d.spoil || null, fly: null, press: null, shake: null, need: -1 };
}

// ====== DRAWING (continued) ======
// ----- the art: images by name through E.art (ADR-0020), with the drawn look as every image's fallback; the kit pilot's switch on the ART screen -----
// An image loads when E.art has a candidate for its name (dev channel) or, in the release channel, when its name is in SHIPPED; otherwise the drawn look
// stays. Step 12: every name starts loading in the background at boot (artPreload, TUNING.load.par at a time) and is decoded before it is first drawn.
// Only a landing that something has asked for (artImg) bumps artV, which the backdrop's and the sprites' cache keys carry, so they repaint once, and
// fades the screen from the frame before it (artFade). A failed image keeps the drawn look; it is not asked for again.
export let ART = null, artV = 0, ENG = null;
const KIT = { on: false };
export const IMGS = new Map();
function artEntry(name, src) {
  const e = { src, im: new Image(), ok: false, bad: false, v: artV, asked: false, then: [] };
  const done = (ok) => {
    e.ok = ok; e.bad = !ok;
    if (IMGS.get(name) === e && e.asked) { artFade(); artV++; }
    for (const f of e.then.splice(0)) f();
  };
  e.im.decoding = 'async';
  e.im.onload = () => { (e.im.decode ? e.im.decode() : Promise.resolve()).then(() => done(true), () => done(true)); };
  e.im.onerror = () => done(false);
  e.im.src = src; IMGS.set(name, e);
  return e;
}
// the name's entry, its load started (src re-read only when a load or a pick has bumped artV: images are asked for many times a frame); null when the
// art has no such name
function artGet(name) {
  if (!ART || !ART.has(name)) return null;
  let e = IMGS.get(name);
  if (e && e.v === artV) return e;
  const raw = artSrc(name), src = raw ? decodeURIComponent(raw) : raw; // E.art.src encodes the whole manifest value, slashes too: decode it so a subfolder loads
  if (!e || e.src !== src) e = artEntry(name, src);
  e.v = artV;
  return e;
}
// a name asked for while it loads holds the background queue back until it lands, so the screen's own paintings come first
const ASKED = new Set();
function artAsk(e) {
  e.asked = true;
  if (!e.ok && !e.bad && !ASKED.has(e)) { ASKED.add(e); e.then.push(() => { ASKED.delete(e); artPump(); }); }
}
export function artImg(name) {
  const e = artGet(name);
  if (!e) return null;
  if (!e.asked || !e.ok) artAsk(e);
  return e.ok ? e.im : null;
}
// 'ok' (loaded), 'bad' (failed, or not in the art) or '' (still loading); asking counts as drawing it
export function artState(name) { const e = artGet(name); if (!e) return 'bad'; if (!e.asked || !e.ok) artAsk(e); return e.ok ? 'ok' : e.bad ? 'bad' : ''; }
// (each name is asked for, none skipped, so all of them jump the background queue at once)
export function artSettled(names) { let ok = true; for (const n of names) if (artState(n) === '') ok = false; return ok; }
// a figure's paint (step 12): its body parts all loaded, and every piece it may wear loaded or failed; never half and half
export function artReady(A) { let ok = artSettled(A.extra); for (const n of A.body) if (artState(n) !== 'ok') ok = false; return ok; }
// Every name the game can ask for, loaded a few at a time from boot, so later screens find their paintings ready (a pick reloads its own)
const LOADQ = { list: [], busy: 0 };
function artPreload() {
  if (!ART) return;
  LOADQ.list = (ART === shippedArt ? [...SHIPPED] : ART.names).filter((n) => n && !RETIRED.test(n));
  artPump();
}
function artPump() {
  while (!ASKED.size && LOADQ.busy < TUNING.load.par && LOADQ.list.length) {
    const e = artGet(LOADQ.list.shift());
    if (!e || e.ok || e.bad) continue;
    LOADQ.busy++; e.then.push(() => { LOADQ.busy--; artPump(); });
  }
}
// A painting landing on screen fades in: the frame before it is kept and drawn over the new ones, fading out over TUNING.load.fade (every scene's
// render ends with artFadeOver; a scene change drops it).
const FADE = { cv: null, at: -1 };
export function artFade() {
  if (!ENG || !canSprite) return;
  const c = ENG.canvas;
  if (!c.width || !c.height) return;
  if (!FADE.cv || FADE.cv.width !== c.width || FADE.cv.height !== c.height) FADE.cv = new OffscreenCanvas(c.width, c.height);
  const x = FADE.cv.getContext('2d');
  x.globalCompositeOperation = 'copy'; x.drawImage(c, 0, 0);
  FADE.at = ENG.time;
}
function artFadeOver(ctx, E) {
  if (FADE.at < 0) return;
  const k = 1 - (E.time - FADE.at) / TUNING.load.fade;
  if (k <= 0 || !FADE.cv || FADE.cv.width !== E.canvas.width) { FADE.at = -1; return; }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = k; ctx.drawImage(FADE.cv, 0, 0); ctx.restore();
}
// Step 6d: a limb's two halves are one painting, so a lower half (kit-arm-lo-lean, beast-lion-fore-lo-young) loads the letter its upper half is
// picked at; the ART screen lists only the upper half, and none of the parts the halves and torsos retired.
const LO_HALF = /^(kit-(arm|leg)|beast-(lion|bear)-(fore|hind))-lo(-|$)/;
const upHalf = (n) => n.replace(/-lo(?=-|$)/, '-up');
// The painted art the release channel ships (the A pick of each, docs/art/final/arena/<name>), one games/arena/assets/<name>.webp each. The release channel
// has no candidates (ADR-0020), so this stands in for E.art there; the retired parts (see RETIRED) are left out. A name added here needs its file and an
// entry in sw.js.
const SHIPPED = new Set([
  // backdrops, faces and portraits
  'arena-pit arena-city arena-colosseum arena-grand brutus brutus-proud champ-marcus champ-aurelius champ-flamma champ-varro champ-twins ',
  'champ-hermes champ-carpophorus champ-mevia champ-aquila emperor ',
  // the men: the muscular torso, limb halves of every tier, helmets, shields, plates, the net
  'kit-base-head kit-base-torso kit-helmet-gallic kit-shield-round kit-base-torso-lean kit-base-torso-avg ',
  'kit-helmet-murmillo kit-helmet-thraex kit-helmet-secutor kit-galerus kit-shield-scutum kit-shield-parma kit-plate-chest kit-plate-manica ',
  'kit-plate-greave kit-wrap-trousers kit-net-draped kit-arm-up-musc kit-arm-lo-musc kit-leg-up-musc kit-leg-lo-musc kit-arm-up-lean kit-arm-lo-lean kit-leg-up-lean ',
  'kit-leg-lo-lean kit-arm-up-avg kit-arm-lo-avg kit-leg-up-avg kit-leg-lo-avg ',
  // the beasts
  'beast-lion-head beast-bear-head beast-lion-tail beast-lion-fore-up beast-lion-fore-lo beast-lion-hind-up beast-lion-hind-lo ',
  'beast-lion-fore-up-young beast-lion-fore-lo-young beast-lion-hind-up-young beast-lion-hind-lo-young beast-bear-fore-up beast-bear-fore-lo ',
  'beast-bear-hind-up beast-bear-hind-lo beast-bear-fore-up-young beast-bear-fore-lo-young beast-bear-hind-up-young beast-bear-hind-lo-young ',
  'beast-lion-torso beast-lion-torso-young beast-bear-torso beast-bear-torso-young ',
  // the card gear
  'gear-bronze-bracers gear-barbed-bracers gear-matador-ribbons gear-iron-pauldrons gear-knife-bracers gear-gilt-armlets gear-bronze-crest ',
  'gear-blood-band gear-ribbon-band gear-horned-cap gear-dark-hood gear-plumed-helm gear-bronze-phalerae gear-ghost-silk gear-black-plate ',
  'gear-eye-amulet gear-gilded-harness gear-bronze-boots gear-dancers-sandals gear-spiked-boots gear-soft-boots gear-gilded-greaves ',
  'gear-hook-belt gear-ribbon-sash gear-chain-belt gear-coin-belt gear-wolf-pelt gear-flowing-cape gear-puppeteers-mantle gear-purple-cloak ',
  'gear-lion-pelt gear-spiked-shield gear-tower-shield gear-spiral-shield ',
  // the vault's gear and the tailor's looks (Pack 22), the weapons and the title (Pack 23)
  'gear-bossed-shield gear-phalanx-helm gear-bloodletters-belt gear-crimson-cloak gear-shadow-sandals gear-wind-ribbons gear-crusher-gauntlets ',
  'gear-colossus-plate gear-smoke-pouch-belt gear-mirror-cloak gear-laurel-wreath gear-idols-torc tailor-crest-bronze tailor-crest-silver ',
  'tailor-crest-gold tailor-plume-red tailor-plume-white tailor-plume-black tailor-paint-wings tailor-paint-bolt tailor-paint-sun tailor-cloak-red ',
  'tailor-cloak-blue tailor-cloak-green weapon-gladius weapon-spear weapon-dagger weapon-sica weapon-axe weapon-mace weapon-trident ',
  'weapon-wooden-sword logo-arena ',
  // the beasts' barding (Pack 26b) and the laurel ring (Pack 26)
  'beast-lion-armour-head beast-lion-armour-chest beast-lion-armour-back beast-lion-armour-leg beast-bear-armour-head beast-bear-armour-chest ',
  'beast-bear-armour-back beast-bear-armour-leg laurel-ring ',
  // the bow at rest and drawn, and its arrow (Pack 29)
  'weapon-bow weapon-bow-drawn arrow'
].join('').split(' '));
// Pack 27: the helmets and head gear painted onto the head ship as <name>-worn.webp; their old pieces' files are retired
const WORN = new Set(['kit-helmet-gallic', 'kit-helmet-murmillo', 'kit-helmet-thraex', 'kit-helmet-secutor', 'gear-bronze-crest', 'gear-plumed-helm', 'gear-phalanx-helm',
  'gear-horned-cap', 'gear-dark-hood', 'gear-blood-band', 'gear-ribbon-band', 'gear-laurel-wreath']);
const shippedSrc = (name) => `assets/${name}${WORN.has(name) ? '-worn' : ''}.webp`;
// the art the game asks: E.art in the dev channel (candidates and the designer's picks), the shipped A picks in release
export const shippedArt = { enabled: true, has: (n) => SHIPPED.has(n), choice: () => 0, url: shippedSrc, src: shippedSrc, on() {} };
const RETIRED = /^(kit-base-(upperarm|forearm|thigh|shin)(-(lean|avg))?(-seg)?|beast-(lion|bear)-(body|upperleg|lowerleg)(-young)?(-seg)?|beast-(lion|bear)-upperleg-young-seg)$/;
function artSrc(name) {
  const u = LO_HALF.test(name) && ART.has(upHalf(name)) ? upHalf(name) : null;
  return (u && ART.url(name, ART.choice(u))) || ART.src(name, shippedSrc(name));
}
function artTabNames(E) {
  const A = E.art, all = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(A), 'names').get;
  Object.defineProperty(A, 'names', { configurable: true, get() { return all.call(A).filter((n) => !RETIRED.test(n) && !(LO_HALF.test(n) && A.has(upHalf(n)))); } });
}
export const BACKDROP = { pit: 'arena-pit', city: 'arena-city', rome: 'arena-colosseum', games: 'arena-grand' };
export const champPic = (d) => (d && d.champion && !d.beast ? `champ-${d.ck || d.name.split(' ')[0].toLowerCase()}` : null);
export const kitOn = () => KIT.on && !!ART && ART.has('kit-base-torso');
// The ART screen is the engine's; the game adds one 44 px switch in its footer row, right of "Copy picks", for the kit pilot (default on, kept in the save as kitPilot).
// It is not drawn, and not tapped, while a thumbnail is held enlarged.
function kitSwitch(E) {
  const sc = E.game.scenes.__art;
  if (!sc || sc.kitSwitch) return;
  const R = sc.render, T = sc.onTap, [bw, bh] = TUNING.kit.sw;
  const btn = () => { const c = sc.copyBtn, cy = c ? c.y + c.h / 2 : E.h - E.safe.bottom - 28; return { x: E.w - E.safe.right - 16 - bw, y: cy - bh / 2, w: bw, h: bh }; };
  sc.kitSwitch = true;
  sc.render = function (ctx) {
    R.call(this, ctx);
    if (this.hold) return;
    const b = btn();
    E.roundRect(b.x, b.y, b.w, b.h, 10, KIT.on ? '#3b82f6' : '#1f2937', KIT.on ? null : '#475569');
    E.text(`KIT ${KIT.on ? 'ON' : 'OFF'}`, b.x + b.w / 2, b.y + b.h / 2, { size: 14, weight: '800', color: KIT.on ? '#fff' : '#cbd5e1' });
  };
  sc.onTap = function (p) {
    if (!this.hold && E.hit(btn(), p)) { KIT.on = !KIT.on; E.save.set('kitPilot', KIT.on); artV++; E.audio.play('tap'); return; }
    T.call(this, p);
  };
}
// The play scene's names, for the scripted checks (window.__engine.game.scenes.play). They are read from every module, so they are put on play
// here, in the entry module, which loads last (ADR-0024: only tuning.js and data.js may be read while modules load).
Object.assign(play, {
  state, lay, foeF, beginBout, youF, toScreen, cardNums, newRack, raiseShield, dodge, fell, blockRun, ZONE, TUNING, rollMe, respinMe, solveArm, windFoe, gapHit, bout,
  walls, gapNow, dealDraft, openDraft, pickCard, rerollDraft, skipDraft, skipPay, pushFoe, CARD, buildMove, startMove, shieldBtns, myBlade, bounce,
  emit, gainMom, addBleed, tellDodge, resolveSwing, strikeOf, zoneAt, foeStrike, HOOKS, openBandage, buyBandage, bandageDue, boutLvl, colossusHearts, famN, baitDrop, endBlow, startBlow, gildedFree, cardOpen, lamed, applyCard, finReady, finList, finBtn, thumbFav, updateFinisher, checkHits, disable, noDodge, noShield, perfectWin, DECK, partCenter, updateBleed, ZONES, heldFams, dealable, boutGold, openTent, buyWare, leaveTent, priceOf,
  sizeOf, rollFighter, rollStats, wheelList, statTier, PROFILES, GAUNTLET, meSize, kitMe, PLATES, armsBtns, startSwap, startAim, knifeLands, swapBow, bowDown, bowRelease, arrowLands, bowShown, shieldMax, plainGap, overReach, inReach, aimAt, knifeAt, startLesson, nextYard, aimSnap, raised, busy, purseCost, knifeBuy, partCenter,
  ARENAS, rollGauntlet, gradeBout, boutTally, openDraft, newRound, stepIn, updatePair, favour, bandOf, endingOf, edgeF, land, fakeOut, openNow, finCost, fireFinisher, crowdDrain, planExchange, rollGear, memoryOn, feintRead, startCard, foeLook, startCards, castNet, fameOf, carveChampion, vetMe, vetArenas, fameFromLedger, tailorOf, myLook, LUDUS, swapSpoil, spoilOf, wield, driving, saveRun, lookFor, manArt, kitTier, artState, introReady, buildSig, sigOf, champKey, purseCost, updateOff, YARD, endYard, tapCard, ghostPath, tipFor, guardPt, myH, yardFields, sizeOf, newRackAt: (E, i) => { state.rack = i; newRack(E); poseFoe(E, 0.016); },
});
// ====== GAME OBJECT: save, migrate, TUNE presets ======
const STD = { 'hit.minSpeed': 450, 'stamina.regen': 32, 'attack.over.cost': 28, 'shield.perfect': 0.15, 'shield.hits': 4, 'shield.drain': 6, 'open.dur': 0.8, 'swing.windup': 0.7, 'swing.gap': 2.0, 'counter.windup': 0.55, 'dodge.cost': 18 };

export const game = {
  slug: 'arena',
  title: 'Arena',
  saveVersion: 19,
  // v2 adds the rival champion and the pit wall of fallen names; v3 counts the bouts begun, for the hint, and a player who has fought before has seen it;
  // v4 (v1) adds the run saved at each bout's start and drops the prototypes' old keys (best, runs). The rival, the wall, the feint lesson and boutsSeen carry over.
  // v5 (v2, the new deck): a run saved mid-gauntlet restarts at bout 1 with the same fighter (its picks came from the old deck, and the old perks are gone).
  migrate(data, fromVersion) {
    if (fromVersion < 2) { data.rival = data.rival && data.rival.name ? data.rival : null; data.wall = Array.isArray(data.wall) ? data.wall.slice(0, 8) : []; }
    if (fromVersion < 3) data.boutsSeen = data.best2 > 0 || (data.wall && data.wall.length) || data.feintLesson ? TUNING.hint.bouts : 0;
    if (fromVersion < 4) { delete data.best; delete data.runs; data.run = null; }
    if (fromVersion < 5) {
      const r = data.run;
      if (r && r.me && r.me.idx) {
        // the rolled plates come first; plates bought as old cards (Iron Greaves, Bronze Helm) were pushed after them
        const A = TUNING.me.armour[TUNING.me.wheels.armour[r.me.idx[4]][0]];
        data.run = { seed: r.seed, rack: 0, me: deriveMe({ ...r.me, plates: r.me.plates.slice(0, A.n + (A.arm ? 1 : 0)) }), rival: r.rival || null };
      } else data.run = null;
    }
    // v6 (v2 step 2, gear): the picks keep their card ids, so a saved run goes on as it was and its gear is derived from them (two pieces saved for one
    // slot both stay until a new piece takes that slot); the rival starts with no gear of his own and no gaps counted
    if (fromVersion < 6) {
      for (const rv of [data.rival, data.run && data.run.rival]) if (rv) { rv.gaps = rv.gaps || {}; rv.gear = rv.gear || null; }
      if (data.run && data.run.draft) data.run.draft.odds = data.run.draft.odds || [];
    }
    // v7 (v2 step 3, the arenas): the highest arena open (a won run opens the City; menu.enter reads the ledger once for it), the rival per arena (the
    // Pit's is the old one), and a saved run is a Pit run
    if (fromVersion < 7) {
      data.rivals = data.rival ? { pit: data.rival } : {}; delete data.rival;
      data.arenas = 0; data.arenasCheck = 1;
      if (data.run) data.run.arena = 'pit';
    }
    // v8 (v2 step 3.5, five sizes): the old three sizes map S to Lean, M to Medium and L to Big, for your saved fighter (his size wheel's landing moves up
    // one slice) and every rival and his partner, who gain the profile nearest their stats; both stand at their band's own height
    if (fromVersion < 8) {
      const MAP = { S: 'lean', M: 'medium', L: 'big' }, fix = (rv) => { if (!rv) return; rv.size = MAP[rv.size] || rv.size; rv.vary = rv.vary || 0; rv.prof = rv.prof || profileOf(rv); fix(rv.pair); };
      for (const rv of Object.values(data.rivals || {})) fix(rv);
      const r = data.run;
      if (r && r.me && MAP[r.me.size]) { r.me.idx = r.me.idx.slice(); r.me.idx[0] += 1; r.me.vary = 0; r.me = deriveMe(r.me); }
      if (r) fix(r.rival);
    }
    // v9 (v2 step 3.6, the finisher button): `finHint` is set once the button's first-time hint has been shown
    if (fromVersion < 9) data.finHint = 0;
    // v10 (v2 step 4b, the meta): fame, the ludus's unlocks (a save from before keeps the Trickster and the Showman open), the tailor's styles, the
    // start-card pick and the cards ever picked, the Wall of Champions; menu.enter reads the ledger once (fameCheck) for the fame of past wins and cleared
    // arenas, their fighters on the Wall and their picks. A saved run's fighter has every family open, as before.
    if (fromVersion < 10) Object.assign(data, { fame: 0, ludus: ['trick', 'show'], tailor: {}, startPick: '', picked: [], champs: [], fameCheck: 1 });
    // v11 (v2 step 9a, the starting purse): a saved run keeps the weapon and armour its wheels rolled, so it bought nothing (buy '', no purse left);
    // purseHint counts the purses that showed the first-run hint
    if (fromVersion < 11) { if (data.run) Object.assign(data.run, { buy: '', purseLeft: null }); data.purseHint = 0; }
    // v12 (v2 step 10, biting his feint): a saved run has bitten none; baitHint is set once the first bite's hint has shown
    if (fromVersion < 12) { if (data.run) data.run.baited = 0; data.baitHint = 0; }
    // v13 (v2 step 11, kit by the slot): a saved run keeps its rolled set, read as the plates it put on (kit: the head a helmet, the chest a chest plate,
    // the shield arm a manica, the legs greaves; the tent's plate after them left off), so its plates and its stamina stay as rolled; the new purse's
    // first-run hint shows once more
    if (fromVersion < 13) {
      const me = data.run && data.run.me;
      if (me && me.idx) {
        const A = TUNING.me.armour[TUNING.me.wheels.armour[me.idx[4]][0]], rolled = me.plates.slice(0, A.n + (A.arm ? 1 : 0));
        me.kit = Object.keys(PLATES).filter((k) => rolled.includes(PLATES[k].parts[0]));
      }
      data.purseHint = 0;
    }
    // v14 (v2 step 12, the menu remade): the last fighter sent out and their arena, for the menu (a saved run's, else none)
    if (fromVersion < 14) data.last = data.run && data.run.me ? { arena: data.run.arena || 'pit', me: data.run.me } : null;
    // v15 (v2 step 18, two blades and the Grand Games' champions): every saved fighter carries a shield (no second blade), every rival a shield or
    // none as rolled (never two blades); a Grand Games run saved mid-gauntlet starts again at its first bout, a champion now, with the same fighter,
    // purse and token, and no Pit rival waiting in it
    if (fromVersion < 15) {
      for (const me of [data.run && data.run.me, data.last && data.last.me]) if (me) me.dual = false;
      const rv = (q) => { if (q) { q.dual = false; rv(q.pair); } };
      for (const q of Object.values(data.rivals || {})) rv(q);
      const r = data.run;
      if (r) { rv(r.rival); r.first = null; }
      if (r && r.arena === 'games' && r.rack > 0) data.run = { seed: r.seed, arena: r.arena, rack: 0, me: r.me, rival: r.rival || null, first: null, token: r.token, tokenUsed: r.tokenUsed, buy: r.buy || '', purseLeft: r.purseLeft, gold: r.purseLeft || 0 };
    }
    // v16 (v2 step 17, the story): a save from before has seen Old Brutus's story, so only a fresh save opens on it
    if (fromVersion < 16) data.storySeen = 1;
    // v17 (v2 steps 19 and 20): a saved run gains Broken Chains unspent, no drafts skipped and no signatures counted
    if (fromVersion < 17 && data.run) Object.assign(data.run, { chains: data.run.chains || 0, skips: data.run.skips || 0, specials: data.run.specials || {} });
    // v18 (v2 step 22, the sidearm and throwing knives): every saved fighter carries no sidearm, and a saved run no knives
    if (fromVersion < 18) {
      for (const me of [data.run && data.run.me, data.last && data.last.me]) if (me) me.side = null;
      if (data.run) Object.assign(data.run, { knives: 0, knivesThrown: 0, knifeGaps: 0, mySwaps: 0 });
    }
    // v19 (v2 step 24, the bow): a saved run has loosed no arrows and had no bow out
    if (fromVersion < 19 && data.run) Object.assign(data.run, { arrows: 0, arrowGaps: 0, arrowSkin: 0, arrowPlate: 0, arrowMiss: 0, bowTime: 0 });
    return data;
  },
  TUNING,
  experiments: [
    { key: 'hit.minSpeed', label: 'Min hit speed (px/s)', min: 200, max: 1200, step: 25 },
    { key: 'stamina.regen', label: 'Stamina regen (/s)', min: 10, max: 80, step: 2 },
    { key: 'attack.over.cost', label: 'Smash cost', min: 5, max: 60, step: 1 },
    { key: 'shield.perfect', label: 'Well-timed block window (s)', min: 0.05, max: 0.4, step: 0.01 },
    { key: 'shield.hits', label: 'Shield blocks to break', min: 1, max: 8, step: 1 },
    { key: 'shield.drain', label: 'Shield hold drain (/s)', min: 0, max: 30, step: 1 },
    { key: 'open.dur', label: 'Foe opening (s)', min: 0.3, max: 1.6, step: 0.1 },
    { key: 'swing.windup', label: 'Wind-up (s)', min: 0.4, max: 1.2, step: 0.05 },
    { key: 'counter.windup', label: 'Counter wind-up (s)', min: 0.25, max: 1.0, step: 0.05 },
    { key: 'swing.gap', label: 'Swing interval (s)', min: 0.8, max: 4, step: 0.1 },
    { key: 'dodge.cost', label: 'Dodge cost', min: 5, max: 70, step: 1 },
  ],
  presets: [
    { label: 'Forgiving', values: { ...STD, 'stamina.regen': 45, 'attack.over.cost': 20, 'shield.perfect': 0.25, 'shield.hits': 6, 'shield.drain': 3, 'open.dur': 1.1, 'swing.windup': 0.95, 'swing.gap': 3.2, 'counter.windup': 0.55, 'hit.minSpeed': 400, 'dodge.cost': 12 } },
    { label: 'Standard', values: { ...STD } },
    { label: 'Brutal', values: { ...STD, 'stamina.regen': 22, 'attack.over.cost': 34, 'shield.perfect': 0.1, 'shield.hits': 3, 'shield.drain': 12, 'open.dur': 0.6, 'swing.windup': 0.55, 'swing.gap': 1.3, 'counter.windup': 0.35, 'hit.minSpeed': 600, 'dodge.cost': 28 } },
    // step 9a: the bout length, on its own (a new run takes it)
    { label: 'Bouts 1x', values: { boutLength: 1 } },
    { label: 'Bouts 1.5x', values: { boutLength: 1.5 } },
    { label: 'Bouts 2x', values: { boutLength: 2 } },
  ],
  start: 'menu',
  // a fresh save opens on the story (step 17); the art (step 6): E.art where the engine has it (ADR-0020); without it every image keeps its drawn fallback
  init(E) {
    ENG = E;
    game.start = E.save.get('storySeen', 0) ? 'menu' : 'story';
    // every screen's render ends with a landing painting's fade; a new screen drops it
    for (const sc of Object.values(game.scenes)) {
      const R = sc.render, N = sc.enter;
      sc.render = function (ctx, E2) { R.call(this, ctx, E2); artFadeOver(ctx, E2); };
      sc.enter = function (E2, params) { FADE.at = -1; if (N) N.call(this, E2, params); };
    }
    ART = E.art ? (E.art.enabled ? E.art : shippedArt) : null;
    if (!ART) return;
    KIT.on = E.art.enabled ? !!E.save.get('kitPilot', true) : true;
    ART.on(() => { artV++; artPreload(); });
    artPreload();
    E.art.label = artLabel;
    artTabNames(E);
    kitSwitch(E);
  },
  scenes: { menu, story, arenas: pickArena, ludus, champs, roll, play, over },
};
