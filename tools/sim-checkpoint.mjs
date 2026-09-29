#!/usr/bin/env node
// sim-checkpoint: proofs for Checkpoint through the game's real generation, tap resolution and scoring
// (games/checkpoint/src/game.js, via game.sim and the play scene).
//
//   node tools/sim-checkpoint.mjs [--bags 1000] [--seeds 20] [--human-seeds 40] [--fail-seeds 5]
//
// 1. Items: 30 items, 10 contraband, longest extent at least 44 units, hit shape (narrowest width + 2 x hitMargin) at least 44 at 360x640,
//    contraband centre inside its outline, look-alike links point at contraband.
// 2. Packing, per shift row 1 to 10 over --bags seeded bags: item counts, contraband per bag, clean share, look-alikes from shift 4,
//    every item at least minVisible visible by area AND by outline perimeter (both measured on grids finer than packing used), items inside the bag.
// 3. Bots through the play scene: a fast centre-tap bot (three stars on every row), a late one-strike bot (the score ratio), a pulse-waiting bot
//    (taps only what shows a red tell, so it must fail from shift 1), a late blind bot, tap-everything and never-tap bots (all must fail), and a
//    human-model bot (serial scanning with reaction time, 8 px tap noise, look-alike mistakes) that gives the difficulty curve.
// 4. The miss cue: no red on screen before a strike, the missed item's ghost after it.
// 5. Determinism (same seed and tap times at 30, 60 and 120 fps), overlap resolution, unlock on clear, shift lengths.
// Exit code 0 when every check passes, 1 otherwise.

import { game } from '../games/checkpoint/src/game.js';
import { makeRng, hashString } from '../games/checkpoint/src/engine.js';

const T = game.TUNING, sim = game.sim, play = game.scenes.play;
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? Number(args[i + 1]) : d; };
const BAGS = opt('--bags', 1000), SEEDS = opt('--seeds', 20), FAILSEEDS = opt('--fail-seeds', 5), HUMANSEEDS = opt('--human-seeds', 40), SHIFTS = T.beltSpeed.length;
let failed = 0;
const check = (ok, msg) => { if (!ok) { failed++; console.log(`  FAIL ${msg}`); } return ok; };
const f1 = (x) => x.toFixed(1), f2 = (x) => x.toFixed(2), f3 = (x) => x.toFixed(3);
const pad = (v, n) => String(v).padStart(n);
const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const median = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0; };

// ---------- 1. items ----------
console.log('Items');
const items = sim.ITEMS, contra = items.filter((i) => i.contraband);
check(items.length === 30 && contra.length === 10, `expected 30 items with 10 contraband, got ${items.length} and ${contra.length}`);
const smallest = items.reduce((a, b) => (a.size < b.size ? a : b));
check(items.every((i) => i.size >= 44), `an item is under 44 units across: ${smallest.name} ${smallest.size.toFixed(1)}`);
console.log(`  smallest longest extent: ${smallest.name} ${f1(smallest.size)} units (44 needed at 360x640, scale 1)`);
const byThin = items.slice().sort((a, b) => a.thin - b.thin);
console.log(`  hit shape widths at 360x640 (narrowest width + 2 x ${T.hitMargin}), narrowest six: ${byThin.slice(0, 6).map((i) => `${i.name} ${f1(i.thin)}+${2 * T.hitMargin}=${f1(i.thin + 2 * T.hitMargin)}`).join(', ')}`);
for (const i of items) check(i.thin >= 16 && i.thin + 2 * T.hitMargin >= 44, `${i.name}: narrowest width ${f1(i.thin)}, hit shape ${f1(i.thin + 2 * T.hitMargin)} (needs 16 and 44)`);
const inPoly = (px, py, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c; } return c; };
for (const i of contra) check(i.shape.some((p) => inPoly(0, 0, p)), `${i.name}: centre is outside its outline`);
for (const i of items) if (i.confusable) check(items.some((o) => o.name === i.confusable && o.contraband), `${i.name}: look-alike link ${i.confusable} is not contraband`);
console.log(`  look-alikes: ${items.filter((i) => i.confusable).map((i) => `${i.name}>${i.confusable}`).join(', ')}`);

// ---------- 2. packing ----------
console.log(`\nPacking, ${BAGS} bags per shift (${Math.ceil(BAGS / T.bagsPerShift)} seeds of ${T.bagsPerShift}); visibility measured on finer grids than packing used`);
console.log(' shift  items  minArea  minOutline  clean  clean/shift  two-contra  look-alike bags  overlap (mean hidden area)');
const packSeed = (shift, k) => hashString(`checkpoint-pack-${shift}-${k}`);
for (let shift = 1; shift <= (BAGS > 0 ? SHIFTS : 0); shift++) {
  const [lo, hi] = T.itemsPerBag[shift - 1], pool = new Set(T.newContraband.slice(0, shift).flat());
  const rot = T.rotMax[shift - 1], maxC = T.maxContraband[shift - 1];
  let n = 0, minArea = 1, minLine = 1, clean = 0, two = 0, conf = 0, itemsSum = 0, maxCl = 0, minCl = 99, contraBags = 0, hidSum = 0, hidN = 0;
  for (let k = 0; n < BAGS; k++) {
    const g = sim.genShift(packSeed(shift, k), shift);
    let cl = 0;
    check(g.bags.length === T.bagsPerShift, `shift ${shift}: ${g.bags.length} bags`);
    g.bags.forEach((bag, bi) => {
      n++;
      const where = `shift ${shift} seed ${k} bag ${bi}`;
      const cs = bag.items.filter((it) => it.contraband), names = bag.items.map((it) => it.name);
      itemsSum += bag.items.length;
      check(bag.items.length >= lo && bag.items.length <= hi, `${where}: ${bag.items.length} items, row says ${lo}-${hi}`);
      check(new Set(names).size === names.length, `${where}: repeated item`);
      check(cs.length <= maxC, `${where}: ${cs.length} contraband, row allows ${maxC}`);
      check(cs.every((it) => pool.has(it.name)), `${where}: contraband outside the shift's pool`);
      check((bag.kind === 'clean') === (cs.length === 0), `${where}: kind ${bag.kind} with ${cs.length} contraband`);
      if (bag.kind === 'clean') { clean++; cl++; } else contraBags++;
      if (cs.length === 2) two++;
      const hasConf = bag.items.some((it) => it.def.confusable);
      if (hasConf) conf++;
      const opener = shift === T.opener.shift && bi === 0;
      if (T.confusableShare[shift - 1] === 0 && !opener) check(!hasConf, `${where}: look-alike in a shift that has none`);
      const area = sim.visibility(bag, 0.75, 0.31), line = sim.outlineVisibility(bag, 0.7, 0.3);
      minArea = Math.min(minArea, ...area); minLine = Math.min(minLine, ...line);
      for (const v of area) { hidSum += 1 - v; hidN++; }
      check(Math.min(...area) >= T.minVisible, `${where}: an item is ${f3(Math.min(...area))} visible by area`);
      check(Math.min(...line) >= T.minVisible, `${where}: an item is ${f3(Math.min(...line))} visible by outline`);
      for (const it of bag.items) {
        check(it.bb.x0 >= 0 && it.bb.x1 <= T.bagW && it.bb.y0 >= 0 && it.bb.y1 <= T.bagH, `${where}: ${it.name} leaves the bag`);
        check(Math.abs(it.rot) <= rot + 1e-9, `${where}: rotation ${it.rot.toFixed(0)}`);
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
  console.log(`${pad(shift, 6)}  ${pad(f2(itemsSum / n), 5)}  ${pad(f3(minArea), 7)}  ${pad(f3(minLine), 10)}  ${pad(f3(share), 5)}  ${pad(`${minCl}-${maxCl}`, 11)}  ${pad(f2(two / Math.max(1, contraBags)), 10)}  ${pad(f2(conf / n), 15)}  ${pad(f3(hidSum / hidN), 8)}`);
}

// ---------- bots ----------
const makeE = (w = 360, h = 640) => ({
  w, h, time: 0, safe: { top: 0, bottom: 0, left: 0, right: 0 }, sounds: [], scene: null, params: null,
  rng: makeRng(1),
  save: { d: {}, get(k, d) { return k in this.d ? this.d[k] : d; }, set(k, v) { this.d[k] = v; return v; }, update(k, fn, d) { return this.set(k, fn(this.get(k, d))); } },
  audio: { muted: false, play(n) { E.sounds.push(n); }, toggleMute() {} },
  setScene(n, p) { this.scene = n; this.params = p; },
});
let E = makeE();

// Runs one shift. policy(E, t) returns the taps [{x, y}] to deliver at the end of a frame; `script` replays recorded taps instead.
function run(shift, seed, fps, policy, script, e = makeE()) {
  E = e; E.scene = null; E.params = null;
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
  return { r: E.params, taps, S: { score: S.score, strikes: S.strikes, streak: S.streak, log: S.log.map((e) => JSON.stringify(e)).join('|') }, time: S.time, E };
}
const gauss = (rng) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());

// Fast bot: taps each contraband centre the first frame it is below the HUD and in the top half.
const centreBot = () => {
  const done = new Set();
  return (E) => {
    const L = sim.layout(E), out = [];
    for (const it of sim.onScreen(E)) if (it.contraband && it.state === 0 && !done.has(it.id) && it.y >= L.hud + 8 && it.cy <= L.H / 2) { done.add(it.id); out.push({ x: it.x, y: it.y }); }
    return out;
  };
};
// Late bot: taps contraband once it is `at` (60 or 70) percent down the screen, and lets exactly one contraband item through (one strike) from bag 7 on.
const lateBot = (at) => {
  const done = new Set();
  let skipped = null;
  return (E) => {
    const L = sim.layout(E), S = sim.state(), out = [];
    for (const it of sim.onScreen(E)) {
      if (!it.contraband || it.state !== 0 || done.has(it.id) || it.y < L.hud + 8 || it.cy < at * L.H) continue;
      if (skipped === null && Number(it.id.split(':')[0]) >= 6) { skipped = it.id; done.add(it.id); continue; }
      done.add(it.id); out.push({ x: it.x, y: it.y });
    }
    return out;
  };
};
const blindLateBot = () => {
  const done = new Set();
  return (E) => {
    const L = sim.layout(E), out = [];
    for (const it of sim.onScreen(E)) if (it.state === 0 && !done.has(it.id) && it.y >= L.hud + 8 && it.cy >= 0.85 * L.H) { done.add(it.id); out.push({ x: it.x, y: it.y }); }
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

// A recording canvas, so the bots and the miss-cue test can see what the play scene draws: every stroke and fill with its colour and the
// outline it was drawn for (identified by the outline's first point), and every text and rounded box colour.
class Path2D { constructor() { this.sig = null; } moveTo(x, y) { if (!this.sig) this.sig = `${x},${y}`; } lineTo() {} closePath() {} }
globalThis.Path2D = Path2D;
const sigOf = Object.fromEntries(sim.ITEMS.map((i) => [`${i.shape[0][0][0]},${i.shape[0][0][1]}`, i.name]));
function recordRender(e) {
  const log = [];
  const ctx = new Proxy({}, {
    get: (t, k) => (k === 'stroke' || k === 'fill' ? (p) => log.push({ c: String(k === 'stroke' ? t.strokeStyle : t.fillStyle), item: p && p.sig ? sigOf[p.sig] : null }) : k in t ? t[k] : () => {}),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  const re = { ...e, ctx, text: (str, x, y, o = {}) => log.push({ c: String(o.color || ''), text: str }), roundRect: (x, y, w, h, r, fill, stroke) => { if (fill) log.push({ c: String(fill) }); if (stroke) log.push({ c: String(stroke) }); }, button() { return {}; } };
  play.render(ctx, re);
  return log;
}
const RED = /255,\s*59,\s*71|#ff3b47/i;
// Pulse-waiting bot: never reads a shape. It taps only items the screen draws with a red tell before they are flagged, once they are low on the screen.
const pulseBot = () => {
  const done = new Set();
  return (E) => {
    const red = new Set(recordRender(E).filter((r) => RED.test(r.c) && r.item).map((r) => r.item));
    if (!red.size) return [];
    const L = sim.layout(E), out = [];
    for (const it of sim.onScreen(E)) if (red.has(it.name) && it.state === 0 && !done.has(it.id) && it.y >= L.hud + 8) { done.add(it.id); out.push({ x: it.x, y: it.y }); }
    return out;
  };
};

// Human-model bot. Serial scanning: a bag is read once it is fully below the HUD and the last bag is done; reading takes
// (base + perItem x items) x lognormal noise + occlusion and look-alike penalties; then the bot taps what it found, tapGap apart, with
// 8 px Gaussian tap noise, mistakes each look-alike for contraband with probability pConf, and overlooks a partly hidden contraband item
// on the first pass with probability overlook x hidden share (finding it lag seconds later).
const HUMAN = { base: opt('--h-base', 0.45), perItem: opt('--h-item', 0.1), overlook: opt('--h-over', 0.4), lag: opt('--h-lag', 1.4), occl: opt('--h-occl', 0.8), conf: opt('--h-conf', 0.15), sigma: opt('--h-sigma', 0.3), tapGap: 0.3, pConf: opt('--h-pconf', 0.05), noise: 8 };
const humanBot = (seed, prm = HUMAN) => {
  const rng = makeRng(seed ^ 0x5bd1e995);
  let free = 0;
  const plan = new Map();
  return (E, t) => {
    const S = sim.state(), L = sim.layout(E), out = [];
    for (const b of S.bags) {
      if (b.gone || plan.has(b.idx) || b.y < L.hud / L.s - 2) continue;
      const contraband = b.items.filter((i) => i.contraband), looks = b.items.filter((i) => i.def.confusable);
      const occ = contraband.length ? Math.max(...contraband.map((i) => 1 - i.vis)) : 0;
      const scan = (prm.base + prm.perItem * b.items.length) * Math.exp(prm.sigma * gauss(rng)) + prm.occl * occ + prm.conf * looks.length;
      const start = Math.max(t, free), taps = [];
      let k = 0;
      for (const it of looks) if (rng() < prm.pConf) taps.push({ it, at: start + scan + k++ * prm.tapGap });
      // a contraband item partly hidden may be overlooked on the first pass and found on a second look
      for (const it of contraband) taps.push({ it, at: start + scan + k++ * prm.tapGap + (rng() < prm.overlook * (1 - it.vis) ? prm.lag * Math.exp(prm.sigma * gauss(rng)) : 0) });
      free = start + scan + Math.max(0, k - 1) * prm.tapGap;
      plan.set(b.idx, { taps, b });
    }
    const on = new Map(sim.onScreen(E).map((i) => [i.id, i]));
    for (const { taps, b } of plan.values()) for (const tp of taps) {
      if (tp.done || t < tp.at) continue;
      const id = `${b.idx}:${b.items.indexOf(tp.it)}`, s = on.get(id);
      if (tp.it.state !== 0 || b.gone) { tp.done = true; continue; }
      if (s && s.y >= L.hud + 4) { tp.tries = (tp.tries || 0) + 1; tp.at = t + 0.3; if (tp.tries >= 4) tp.done = true; out.push({ x: s.x + prm.noise * gauss(rng), y: s.y + prm.noise * gauss(rng) }); } // a tap that flagged nothing is repeated
    }
    return out;
  };
};

const seedOf = (tag, shift, k) => hashString(`checkpoint-${tag}-${shift}-${k}`);
console.log(`\nBots through the play scene at 60 fps (fast, late, human: ${SEEDS}/${SEEDS}/${HUMANSEEDS} seeds per shift; the four failing bots ${Math.min(SEEDS, FAILSEEDS)})`);
console.log(' shift  fast bot   late one-strike at 70%: score, ratio fast/late (mean, median)   at 60%: score, ratio   pulse-waiting  late-blind  tap-all  never');
const curve = [];
for (let shift = 1; shift <= SHIFTS; shift++) {
  const F = [], L = [], ratios = [], L6 = [], ratios6 = [];
  const over = { pulse: 0, blind: 0, all: 0, none: 0 };
  for (let k = 0; k < SEEDS; k++) {
    const seed = seedOf('bot', shift, k);
    const a = run(shift, seed, 60, centreBot());
    check(a.r && a.r.result === 'clear' && a.r.stars === 3, `shift ${shift} seed ${seed}: the fast bot got ${a.r && a.r.result} ${a.r && a.r.stars} stars, ${a.r && a.r.strikes} strikes`);
    const l = run(shift, seed, 60, lateBot(0.7)), l6 = run(shift, seed, 60, lateBot(0.6));
    for (const x of [l, l6]) check(x.r && x.r.result === 'clear' && x.r.strikes === 1, `shift ${shift} seed ${seed}: a late bot got ${x.r && x.r.result} with ${x.r && x.r.strikes} strikes`);
    F.push(a.r.score); L.push(l.r.score); ratios.push(a.r.score / Math.max(1, l.r.score)); L6.push(l6.r.score); ratios6.push(a.r.score / Math.max(1, l6.r.score));
    if (k >= FAILSEEDS) continue;
    if (run(shift, seed, 60, pulseBot()).r.result === 'over') over.pulse++;
    if (run(shift, seed, 60, blindLateBot()).r.result === 'over') over.blind++;
    if (run(shift, seed, 60, tapAllBot()).r.result === 'over') over.all++;
    if (run(shift, seed, 60, () => []).r.result === 'over') over.none++;
  }
  const nf = Math.min(SEEDS, FAILSEEDS);
  for (const [name, v] of Object.entries(over)) check(v === nf, `shift ${shift}: the ${name} bot cleared ${nf - v} of ${nf} shifts`);
  console.log(`${pad(shift, 6)}  ${pad(Math.round(mean(F)), 6)}     ${pad(Math.round(mean(L)), 6)}, ${f2(mean(ratios))} (${f2(median(ratios))})                                    ${pad(Math.round(mean(L6)), 6)}, ${f2(mean(ratios6))}          fails ${over.pulse}/${nf}    fails ${over.blind}/${nf}  fails ${over.all}/${nf}  fails ${over.none}/${nf}`);
  const h = { three: 0, two: 0, clear: 0, strikes: 0, miss: 0, fa: 0, time: [] };
  for (let k = 0; k < HUMANSEEDS; k++) {
    if (args.includes('--shift') && Number(args[args.indexOf('--shift') + 1]) !== shift) break;
    const seed = seedOf('human', shift, k), r = run(shift, seed, 60, humanBot(seed));
    if (r.r.stars === 3) h.three++;
    if (r.r.stars >= 2) h.two++;
    if (r.r.result === 'clear') h.clear++;
    h.strikes += r.r.strikes; h.miss += r.r.misses; h.fa += r.r.falseAlarms; h.time.push(r.time);
  }
  curve.push({ shift, ...h });
}
console.log(`\nHuman-model bot (scan ${HUMAN.base} s + ${HUMAN.perItem} s per item, lognormal ${HUMAN.sigma}, ${HUMAN.noise} px tap noise, ${HUMAN.pConf} look-alike mistake, overlook ${HUMAN.overlook} x hidden share then ${HUMAN.lag} s), ${HUMANSEEDS} seeds per shift`);
console.log(' shift  three stars  two+ stars  cleared  mean strikes (missed / false alarms)  mean length');
for (const c of curve) console.log(`${pad(c.shift, 6)}  ${pad(Math.round((100 * c.three) / HUMANSEEDS) + '%', 11)}  ${pad(Math.round((100 * c.two) / HUMANSEEDS) + '%', 10)}  ${pad(Math.round((100 * c.clear) / HUMANSEEDS) + '%', 7)}  ${pad(f2(c.strikes / HUMANSEEDS), 12)} (${f2(c.miss / HUMANSEEDS)} / ${f2(c.fa / HUMANSEEDS)})  ${pad(f1(mean(c.time)) + ' s', 10)}`);
for (const c of curve.filter((c) => c.shift <= 3)) check(c.three / HUMANSEEDS >= 0.8, `shift ${c.shift}: the human-model bot got three stars only ${c.three} of ${HUMANSEEDS} times`);
{
  const c10 = curve[SHIFTS - 1], p = c10.three / HUMANSEEDS;
  check(p >= 0.25 && p <= 0.7, `shift 10: the human-model bot got three stars ${Math.round(p * 100)} percent of the time, target about half`);
}

if (args.includes('--curve-only')) process.exit(0);
// ---------- the miss cue ----------
console.log('\nMiss cue');
{
  E = makeE();
  play.enter(E, { shift: 5, seed: hashString('checkpoint-cue') });
  const S = sim.state();
  let redBefore = 0, redAfter = 0, frames = 0, ghost = 0, label = false;
  while (!E.scene && frames < 60 * 200 && S.misses === 0) {
    play.update(1 / 60, E); frames++; E.time += 1 / 60;
    if (S.misses === 0 && recordRender(E).some((r) => RED.test(r.c))) redBefore++;
  }
  check(S.misses === 1, 'no miss happened in the never-tap run');
  for (let i = 0; i < 90 && !E.scene; i++) {
    play.update(1 / 60, E); E.time += 1 / 60;
    const log = recordRender(E);
    if (log.some((r) => RED.test(r.c))) redAfter++;
    if (log.some((r) => r.text === 'Missed')) label = true;
    ghost = Math.max(ghost, S.ghosts.length);
  }
  check(redBefore === 0, `red was drawn ${redBefore} frames before the first strike`);
  check(ghost === 1 && label && redAfter >= 30, `the ghost cue after the strike is missing (ghosts ${ghost}, label ${label}, red frames ${redAfter})`);
  console.log(`  frames drawn with red before the first strike: ${redBefore}; after it: ${redAfter} of 90, ghost outline ${ghost ? 'yes' : 'no'}, "Missed" label ${label ? 'yes' : 'no'}`);
}

// ---------- determinism ----------
console.log('\nDeterminism: same seed and tap times at 30, 60 and 120 fps');
for (const shift of [1, 5, 10]) {
  const seed = hashString(`checkpoint-det-${shift}`);
  // Recorded at 30 fps: the fast bot plus seeded stray taps, on multiples of 1/30 s so every frame rate has a frame boundary there.
  const stray = makeRng(seed ^ 0x9e3779b9), bot = centreBot();
  const base = run(shift, seed, 30, (E, t) => {
    const taps = bot(E, t);
    if (stray.chance(0.004)) taps.push({ x: stray.range(20, E.w - 20), y: stray.range(80, E.h - 20) });
    return taps;
  });
  const rows = [30, 60, 120].map((fps) => ({ fps, ...run(shift, seed, fps, null, base.taps) }));
  const ref = rows[0];
  for (const row of rows) check(row.S.score === ref.S.score && row.S.strikes === ref.S.strikes && row.S.log === ref.S.log && row.r.result === ref.r.result, `shift ${shift}: ${row.fps} fps differs from 30 fps (score ${row.S.score} vs ${ref.S.score})`);
  console.log(`  shift ${shift}: ${base.taps.length} taps  ${rows.map((r) => `${r.fps} fps score ${r.S.score} strikes ${r.S.strikes} ${r.r.result}`).join('  |  ')}`);
}

// ---------- overlap, unlock, length ----------
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
  console.log(`\nOverlap: a tap on a knife with a harmless item on top of it -> knife state ${k.state}, harmless ${h.state}, strikes ${S.strikes}`);
}
{
  const e = makeE();
  const r1 = run(2, 11, 60, centreBot(), null, e);
  check(r1.r.result === 'clear' && e.save.get('unlocked', 1) === 3, `clearing shift 2 should unlock shift 3, unlocked is ${e.save.get('unlocked', 1)}`);
  const r2 = run(9, 11, 60, () => [], null, e);
  check(r2.r.result === 'over' && e.save.get('unlocked', 1) === 3, 'failing a shift must not unlock anything');
  const e2 = makeE(); e2.save.set('unlocked', 10);
  const r3 = run(10, 12, 60, centreBot(), null, e2);
  check(r3.r.result === 'clear' && e2.save.get('unlocked', 1) === 10, 'unlocked must stay at 10 after clearing shift 10');
  console.log(`Unlock: clear shift 2 -> unlocked ${e.save.get('unlocked', 1)}; failed shift 9 leaves it there; clear shift 10 keeps ${e2.save.get('unlocked', 1)}`);
}
{
  console.log('\nShift lengths (belt seconds until the last bag reaches the belt end, at 360x640 and at 390x844; fast bot clear time at 360x640)');
  console.log(' shift  speed  belt 640  belt 844  fast bot');
  for (let shift = 1; shift <= SHIFTS; shift++) {
    const seed = seedOf('len', shift, 0), belt = (h) => { const e = makeE(390, h); play.enter(e, { shift, seed }); const S = sim.state(), L = sim.layout(e); return (L.H - T.bagH - S.bags[S.bags.length - 1].y0) / T.beltSpeed[shift - 1]; };
    const b640 = belt(640), b844 = belt(844), r = run(shift, seed, 60, centreBot());
    check(b640 >= 40 && b640 <= 120 && b844 <= 120, `shift ${shift}: belt length ${f1(b640)} s at 640 and ${f1(b844)} s at 844 (target 40 to 120)`);
    console.log(`${pad(shift, 6)}  ${pad(T.beltSpeed[shift - 1], 5)}  ${pad(f1(b640) + ' s', 8)}  ${pad(f1(b844) + ' s', 8)}  ${pad(f1(r.time) + ' s', 8)}`);
  }
}

console.log(failed ? `\n${failed} check${failed > 1 ? 's' : ''} FAILED` : '\nall checks passed');
process.exit(failed ? 1 : 0);
