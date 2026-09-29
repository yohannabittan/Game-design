#!/usr/bin/env node
// sim-checkpoint: proofs for Checkpoint's mechanic, run through the game's real generation, tap resolution and scoring
// (games/checkpoint/src/game.js, via game.sim and the play scene).
//
//   node tools/sim-checkpoint.mjs [--bags 1000] [--seeds 20]
//
// 1. Item table: 30 items, 10 contraband, every item at least 44 units across at 360x640, contraband centre inside its shape.
// 2. Packing, per shift row 1..10, over --bags seeded bags: item counts, contraband per bag, clean share, confusables from shift 4,
//    every item at least minVisible visible (measured on a finer grid than packing used), items inside the bag.
// 3. Bots through the play scene: taps each contraband centre in the top half (clears every row with three stars), taps every
//    item (fails), never taps (fails).
// 4. Determinism: the same seed and tap times score the same at 30, 60 and 120 fps.
// Exit code 0 when every check passes, 1 otherwise.

import { game } from '../games/checkpoint/src/game.js';
import { makeRng, hashString } from '../games/checkpoint/src/engine.js';

const T = game.TUNING, sim = game.sim, play = game.scenes.play;
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? Number(args[i + 1]) : d; };
const BAGS = opt('--bags', 1000), SEEDS = opt('--seeds', 20), FAILSEEDS = opt('--fail-seeds', 5), SHIFTS = T.beltSpeed.length;
let failed = 0;
const check = (ok, msg) => { if (!ok) { failed++; console.log(`  FAIL ${msg}`); } return ok; };
const f2 = (x) => x.toFixed(2), f3 = (x) => x.toFixed(3);
const pad = (v, n) => String(v).padStart(n);

// ---------- 1. items ----------
console.log('Items');
const items = sim.ITEMS, contra = items.filter((i) => i.contraband);
check(items.length === 30 && contra.length === 10, `expected 30 items with 10 contraband, got ${items.length} and ${contra.length}`);
const smallest = items.reduce((a, b) => (a.size < b.size ? a : b));
const thinnest = items.reduce((a, b) => (a.thin < b.thin ? a : b));
check(items.every((i) => i.size >= 44), `an item is under 44 units across: ${smallest.name} ${smallest.size.toFixed(1)}`);
console.log(`  smallest longest-extent ${smallest.name} ${smallest.size.toFixed(1)} units (44 needed at 360x640, scale 1)`);
console.log(`  thinnest ${thinnest.name} ${thinnest.thin.toFixed(1)} units, its hit shape is ${(thinnest.thin + 2 * T.hitMargin).toFixed(1)} across`);
// The bot taps an item's centre: for contraband the item's own origin must sit inside its shape.
const inPoly = (px, py, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c; } return c; };
for (const i of contra) check(i.shape.some((p) => inPoly(0, 0, p)), `${i.name}: centre is outside its outline`);
for (const i of items) if (i.confusable) check(items.some((o) => o.name === i.confusable && o.contraband), `${i.name}: confusable ${i.confusable} is not contraband`);

// ---------- 2. packing ----------
console.log(`\nPacking, ${BAGS} bags per shift (${Math.ceil(BAGS / T.bagsPerShift)} seeds of ${T.bagsPerShift})`);
console.log(' shift  items   minVis(exact)  minVis(pack)  clean  clean/shift  two-contra  confusable-bags');
const packSeed = (shift, k) => hashString(`checkpoint-pack-${shift}-${k}`);
for (let shift = 1; shift <= SHIFTS; shift++) {
  const [lo, hi] = T.itemsPerBag[shift - 1], pool = new Set(T.newContraband.slice(0, shift).flat());
  const rot = T.rotMax[shift - 1], maxC = T.maxContraband[shift - 1];
  let n = 0, minExact = 1, minPack = 1, clean = 0, two = 0, conf = 0, itemsSum = 0, minC = 99, maxCl = 0, minCl = 99, contraBags = 0;
  for (let k = 0; n < BAGS; k++) {
    const g = sim.genShift(packSeed(shift, k), shift);
    let cl = 0;
    check(g.bags.length === T.bagsPerShift, `shift ${shift}: ${g.bags.length} bags`);
    g.bags.forEach((bag, bi) => {
      n++;
      const cs = bag.items.filter((it) => it.contraband), names = bag.items.map((it) => it.name);
      itemsSum += bag.items.length; minC = Math.min(minC, bag.items.length);
      check(bag.items.length >= lo && bag.items.length <= hi, `shift ${shift} seed ${k} bag ${bi}: ${bag.items.length} items, row says ${lo}-${hi}`);
      check(new Set(names).size === names.length, `shift ${shift} seed ${k} bag ${bi}: repeated item`);
      check(cs.length <= maxC, `shift ${shift} seed ${k} bag ${bi}: ${cs.length} contraband, row allows ${maxC}`);
      check(cs.every((it) => pool.has(it.name)), `shift ${shift} seed ${k} bag ${bi}: contraband outside the shift's pool`);
      check((bag.kind === 'clean') === (cs.length === 0), `shift ${shift} seed ${k} bag ${bi}: kind ${bag.kind} with ${cs.length} contraband`);
      if (bag.kind === 'clean') { clean++; cl++; } else contraBags++;
      if (cs.length === 2) two++;
      const hasConf = bag.items.some((it) => it.def.confusable);
      if (hasConf) conf++;
      if (shift < T.confusableFrom) check(!hasConf, `shift ${shift} seed ${k} bag ${bi}: confusable before shift ${T.confusableFrom}`);
      const vis = sim.visibility(bag, 0.75, 0.31);
      const m = Math.min(...vis);
      minExact = Math.min(minExact, m);
      minPack = Math.min(minPack, ...bag.items.map((it) => it.vis));
      check(m >= T.minVisible, `shift ${shift} seed ${k} bag ${bi}: an item is ${f3(m)} visible`);
      for (const it of bag.items) {
        check(it.bb.x0 >= 0 && it.bb.x1 <= T.bagW && it.bb.y0 >= 0 && it.bb.y1 <= T.bagH, `shift ${shift} seed ${k} bag ${bi}: ${it.name} leaves the bag`);
        check(Math.abs(it.rot) <= rot + 1e-9, `shift ${shift} seed ${k} bag ${bi}: rotation ${it.rot.toFixed(0)}`);
      }
    });
    minCl = Math.min(minCl, cl); maxCl = Math.max(maxCl, cl);
    if (shift === T.opener.shift) {
      const b0 = g.bags[0], b1 = g.bags[1];
      check(b0.kind === 'contra' && b0.items.map((i) => i.name).sort().join() === [...T.opener.contraband, ...T.opener.harmless].sort().join(), `shift ${shift} seed ${k}: opener bag is wrong`);
      check(b1.kind === 'clean', `shift ${shift} seed ${k}: second bag is not clean`);
    }
  }
  const share = clean / n;
  check(share >= 0.4 && share <= 0.55, `shift ${shift}: clean share ${f3(share)} outside 0.40-0.55`);
  console.log(`${pad(shift, 6)} ${pad(f2(itemsSum / n), 6)}  ${pad(f3(minExact), 12)}  ${pad(f3(minPack), 12)}  ${pad(f3(share), 5)}  ${pad(`${minCl}-${maxCl}`, 11)}  ${pad(f2(two / Math.max(1, contraBags)), 10)}  ${pad(f2(conf / n), 15)}`);
}

// ---------- 3 and 4. bots and determinism ----------
const makeE = (w = 360, h = 640) => ({
  w, h, time: 0, safe: { top: 0, bottom: 0, left: 0, right: 0 }, scenes: [], sounds: [], scene: null, params: null,
  rng: makeRng(1),
  save: { d: {}, get(k, d) { return k in this.d ? this.d[k] : d; }, set(k, v) { this.d[k] = v; return v; }, update(k, fn, d) { return this.set(k, fn(this.get(k, d))); } },
  audio: { muted: false, play(n) { E.sounds.push(n); }, toggleMute() {} },
  setScene(n, p) { this.scene = n; this.params = p; },
});
let E = makeE();

// Runs one shift. `policy(E, frameTime)` returns taps [{x, y}] to deliver at the end of this frame; `script` replays recorded taps.
function run(shift, seed, fps, policy, script) {
  E = makeE();
  play.enter(E, { shift, seed });
  const S = sim.state(), dt = 1 / fps, taps = [];
  let frame = 0, ti = 0;
  while (!E.scene && frame < fps * 400) {
    play.update(dt, E); frame++; E.time = frame * dt;
    const t = Math.round(frame * dt * 1200) / 1200;
    const list = script ? [] : policy(E, t);
    if (script) while (ti < script.length && script[ti].t <= t + 1e-9) list.push(script[ti++]);
    for (const p of list) { taps.push({ t, x: p.x, y: p.y }); play.onPointerDown({ x: p.x, y: p.y }, E); }
  }
  const r = E.params;
  return { r, taps, S: { score: S.score, strikes: S.strikes, streak: S.streak, log: S.log.map((e) => JSON.stringify(e)).join('|') }, time: S.time };
}

// Bot: tap each contraband item's centre the first frame it is below the HUD and in the top half. One tap per item.
const centreBot = () => {
  const done = new Set();
  return (E) => {
    const L = sim.layout(E), out = [];
    for (const it of sim.onScreen(E)) {
      if (it.contraband && it.state === 0 && !done.has(it.id) && it.y >= L.hud + 8 && it.cy <= L.H / 2) { done.add(it.id); out.push({ x: it.x, y: it.y }); }
    }
    return out;
  };
};
const tapAllBot = () => {
  const done = new Set();
  return (E) => {
    const L = sim.layout(E), out = [];
    for (const it of sim.onScreen(E)) if (it.state === 0 && !done.has(it.id) && it.y >= L.hud + 8 && it.cy <= L.H / 2) { done.add(it.id); out.push({ x: it.x, y: it.y }); }
    return out;
  };
};

console.log(`\nBots through the play scene at 60 fps: centre-tap bot ${SEEDS} seeds per shift, the two failing bots ${Math.min(SEEDS, FAILSEEDS)}`);
console.log(' shift  centre-tap bot (stars / mean score / catches)   tap-everything bot        never-tap bot');
for (let shift = 1; shift <= SHIFTS; shift++) {
  let scoreSum = 0, catches = 0, minStars = 3, allOver = 0, allStrikes = 0, noneOver = 0, noneStrikes = 0;
  for (let k = 0; k < SEEDS; k++) {
    const seed = hashString(`checkpoint-bot-${shift}-${k}`);
    const a = run(shift, seed, 60, centreBot());
    check(a.r && a.r.result === 'clear' && a.r.stars === 3, `shift ${shift} seed ${seed}: centre-tap bot got ${a.r && a.r.result} ${a.r && a.r.stars} stars, ${a.r && a.r.strikes} strikes`);
    minStars = Math.min(minStars, a.r.stars); scoreSum += a.r.score; catches += a.r.catches;
    if (k >= FAILSEEDS) continue;
    const b = run(shift, seed, 60, tapAllBot());
    if (b.r.result === 'over') allOver++;
    allStrikes += b.r.strikes;
    const c = run(shift, seed, 60, () => []);
    if (c.r.result === 'over') noneOver++;
    noneStrikes += c.r.strikes;
  }
  const nf = Math.min(SEEDS, FAILSEEDS);
  check(allOver === nf, `shift ${shift}: the tap-everything bot cleared ${nf - allOver} of ${nf} shifts`);
  check(noneOver === nf, `shift ${shift}: the never-tap bot cleared ${nf - noneOver} of ${nf} shifts`);
  console.log(`${pad(shift, 6)}  ${minStars}-star min, ${pad(Math.round(scoreSum / SEEDS), 6)} mean, ${pad(Math.round(catches / SEEDS), 2)} catches      over ${pad(allOver, 2)}/${nf} (strikes ${f2(allStrikes / nf)})     over ${pad(noneOver, 2)}/${nf} (strikes ${f2(noneStrikes / nf)})`);
}

console.log('\nDeterminism: same seed and tap times at 30, 60 and 120 fps');
for (const shift of [1, 5, 10]) {
  const seed = hashString(`checkpoint-det-${shift}`);
  // Recorded at 30 fps with the centre bot plus seeded stray taps, on multiples of 1/30 s so every frame rate has a frame boundary there.
  const stray = makeRng(seed ^ 0x9e3779b9);
  const bot = centreBot();
  const base = run(shift, seed, 30, (E, t) => {
    const taps = bot(E);
    if (stray.chance(0.004)) taps.push({ x: stray.range(20, E.w - 20), y: stray.range(80, E.h - 20) });
    return taps;
  });
  const script = base.taps;
  const rows = [30, 60, 120].map((fps) => ({ fps, ...run(shift, seed, fps, null, script) }));
  const ref = rows[0];
  for (const row of rows) check(row.S.score === ref.S.score && row.S.strikes === ref.S.strikes && row.S.log === ref.S.log && row.r.result === ref.r.result, `shift ${shift}: ${row.fps} fps differs from 30 fps (score ${row.S.score} vs ${ref.S.score})`);
  console.log(`  shift ${shift}: ${script.length} taps  ${rows.map((r) => `${r.fps} fps score ${r.S.score} strikes ${r.S.strikes} ${r.r.result}`).join('  |  ')}`);
}

// Overlapping hit shapes resolve to contraband (PRD 15): a harmless item laid across a knife, tapped where both hit shapes cover.
{
  E = makeE();
  play.enter(E, { shift: 3, seed: 7 });
  const S = sim.state(), bag = S.bags.find((b) => b.kind === 'contra');
  bag.y0 = 100 - S.dist; bag.y = 100;
  const k = bag.items.find((i) => i.contraband), h = bag.items.find((i) => !i.contraband);
  h.parts = k.parts.map((poly) => poly.map(([x, y]) => [x + 3, y + 2]));
  h.bb = { ...k.bb };
  const px = 30 + k.x, py = 100 + k.y;
  play.onPointerDown({ x: px, y: py }, E);
  check(k.state === 1 && h.state === 0 && S.strikes === 0 && S.catches === 1, `overlap tap did not resolve to the contraband item (states ${k.state}/${h.state})`);
  play.onPointerDown({ x: px, y: py }, E);
  check(S.strikes === 0, 'a second tap on a caught item must not cost a strike');
  console.log(`\nOverlap: tap on a knife with a harmless item on top of it -> knife state ${k.state}, harmless ${h.state}, strikes ${S.strikes}`);
}

console.log(failed ? `\n${failed} check${failed > 1 ? 's' : ''} FAILED` : '\nall checks passed');
process.exit(failed ? 1 : 0);
