#!/usr/bin/env node
// sim-checkpoint: proofs for Checkpoint through the game's real generation, tap resolution, scoring and render calls
// (games/checkpoint/src/game.js, via game.sim and the play scene).
//
//   node tools/sim-checkpoint.mjs [--bags 1000] [--seeds 20] [--human-seeds 40] [--fail-seeds 5] [--curve-only] [--workers N]
//
// 1. Items: 30 items, 10 contraband, longest extent at least 44 units, hit shape (narrowest width + 2 x hitMargin) at least 44 at 360x640,
//    contraband centre inside its outline, look-alike pairs share a tint.
// 2. Packing, per shift row 1 to 10 over --bags seeded bags: item counts, contraband per bag, clean share, look-alikes, every item at least
//    minVisible visible by area AND by outline perimeter (finer grids than packing used), items inside the bag, tangles rarely metal on metal.
// 3. Bots through the play scene: a fast centre-tap bot, a late one-strike bot (score ratio), a pulse-waiting bot, a late blind bot, tap-everything
//    and never-tap bots, and four human models (expert, good, average, novice: serial reading, per-item, per-overlap and per-look-alike costs,
//    tap noise, look-alike mistakes) whose clear and three-star rates per shift are the difficulty slope.
// 4. Render: no red before a strike, the ghost after it; an unflagged contraband item and a harmless one of the same tint draw identically.
// 5. Save migration and clamp, retry seed, rush bursts, tray, determinism (30, 60, 120 fps), overlap resolution, unlock, shift lengths.
// Exit code 0 when every check passes, 1 otherwise.

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
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
const seedOf = (tag, shift, k) => hashString(`checkpoint-${tag}-${shift}-${k}`);

// ---------- the play scene on a stand-in engine ----------
const makeE = (w = 360, h = 640) => {
  const e = {
    w, h, time: 0, safe: { top: 0, bottom: 0, left: 0, right: 0 }, scene: null, params: null, haptics: [], sounds: [], beeps: [], shakes: 0,
    rng: makeRng(1),
    save: { d: {}, get(k, d) { return k in this.d ? this.d[k] : d; }, set(k, v) { this.d[k] = v; return v; }, update(k, fn, d) { return this.set(k, fn(this.get(k, d))); } },
    audio: { muted: false, play(n) { e.sounds.push(n); }, beep(o) { e.beeps.push(o); }, noise() {}, toggleMute() {} },
    particles: { list: [], emit(o) { this.list.push(...Array.from({ length: o.count || 0 }, () => ({ life: o.life || 0.5 }))); } },
    shake() { e.shakes++; }, flash() {}, haptic(ms) { e.haptics.push(ms); },
    tween(d, fn, ease, done) { fn(1); if (done) done(); },
    setScene(n, p) { this.scene = n; this.params = p; },
    hit: (r, p) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h,
    button: (label, cx, cy, o = {}) => { const w = o.w || Math.min(280, e.w * 0.7), h = o.h || 56; return { x: cx - w / 2, y: cy - h / 2, w, h }; },
  };
  return e;
};
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

// Fast bot: taps each contraband centre the first frame it is below the hood (the first bag is fully in view at t=0, so some items start below the middle).
const centreBot = () => {
  const done = new Set();
  return (E) => {
    const L = sim.layout(E), out = [];
    for (const it of sim.onScreen(E)) if (it.contraband && it.state === 0 && !done.has(it.id) && it.y >= L.top + 8) { done.add(it.id); out.push({ x: it.x, y: it.y }); }
    return out;
  };
};
// Late bot: taps contraband once it is `at` (60 or 70) percent down the screen, and lets exactly one contraband item through (one strike) from bag 7 on.
const lateBot = (at) => {
  const done = new Set();
  let skipped = null;
  return (E) => {
    const L = sim.layout(E), out = [];
    for (const it of sim.onScreen(E)) {
      if (!it.contraband || it.state !== 0 || done.has(it.id) || it.y < L.top + 8 || it.cy < at * L.H) continue;
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
    for (const it of sim.onScreen(E)) if (it.state === 0 && !done.has(it.id) && it.y >= L.top + 8 && it.cy >= 0.85 * L.H) { done.add(it.id); out.push({ x: it.x, y: it.y }); }
    return out;
  };
};
const tapAllBot = () => {
  const done = new Set();
  return (E) => {
    const L = sim.layout(E), out = [];
    for (const it of sim.onScreen(E)) if (it.state === 0 && !done.has(it.id) && it.y >= L.top + 8 && it.cy <= L.H / 2) { done.add(it.id); out.push({ x: it.x, y: it.y }); }
    return out;
  };
};

// A recording canvas, so the bots and the render checks can see what the play scene draws: every stroke and fill with its style and the
// outline it was drawn for (identified by the outline's first point), and every text and rounded box colour.
class Path2D { constructor() { this.sig = null; } moveTo(x, y) { if (!this.sig) this.sig = `${x},${y}`; } lineTo(x, y) { if (this.sig && !this.sig.includes('|')) this.sig += `|${x},${y}`; } closePath() {} }
globalThis.Path2D = Path2D;
const sigOf = Object.fromEntries(sim.ITEMS.map((i) => [`${i.shape[0][0][0]},${i.shape[0][0][1]}|${i.shape[0][1][0]},${i.shape[0][1][1]}`, i.name]));
function recordRender(e, scene = play) {
  const log = [];
  const style = (t, k) => `${k}:${k === 'stroke' ? t.strokeStyle : t.fillStyle}|w${t.lineWidth}|a${t.globalAlpha}|${t.globalCompositeOperation}`;
  const ctx = new Proxy({}, {
    get: (t, k) => (k === 'stroke' || k === 'fill' ? (p) => log.push({ c: String(k === 'stroke' ? t.strokeStyle : t.fillStyle), style: style(t, k), item: p && p.sig ? sigOf[p.sig] : null }) : k in t ? t[k] : k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 100 }) : () => {}),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  const re = { ...e, ctx, text: (str, x, y, o = {}) => log.push({ c: String(o.color || ''), text: str }), roundRect: (x, y, w, h, r, fill, stroke) => { if (fill) log.push({ c: String(fill) }); if (stroke) log.push({ c: String(stroke) }); }, button: (label, cx, cy, o = {}) => { log.push({ c: String(o.fill || ''), text: label }); return e.button(label, cx, cy, o); } };
  scene.render(ctx, re);
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
    for (const it of sim.onScreen(E)) if (red.has(it.name) && it.state === 0 && !done.has(it.id) && it.y >= L.top + 8) { done.add(it.id); out.push({ x: it.x, y: it.y }); }
    return out;
  };
};

// The four human models. A bag is read once it is fully below the hood and the previous bag is done. Reading takes
// (base + perItem x items) x lognormal(0.3) + pair x overlapping pairs + look x look-alikes; then the bot taps what it found, `gap` s apart, with
// Gaussian tap noise (px), mistaking each look-alike for contraband with probability pConf, and repeating a tap that flagged nothing.
const MODELS = {
  expert: { base: 0.28, perItem: 0.065, gap: 0.18, noise: 8, pConf: 0.02, pair: 0.03, look: 0.10 },
  good: { base: 0.35, perItem: 0.09, gap: 0.22, noise: 8, pConf: 0.04, pair: 0.06, look: 0.17 },
  average: { base: 0.45, perItem: 0.12, gap: 0.30, noise: 9, pConf: 0.08, pair: 0.09, look: 0.26 },
  novice: { base: 0.60, perItem: 0.16, gap: 0.38, noise: 10, pConf: 0.12, pair: 0.12, look: 0.35 },
};
const humanBot = (seed, prm) => {
  const rng = makeRng(seed ^ 0x5bd1e995);
  let free = 0;
  const plan = new Map();
  return (E, t) => {
    const S = sim.state(), L = sim.layout(E), out = [];
    for (const b of S.bags) {
      if (b.gone || plan.has(b.idx) || b.y < L.top / L.s - 2) continue;
      const contraband = b.items.filter((i) => i.contraband), looks = b.items.filter((i) => i.def.confusable);
      const scan = (prm.base + prm.perItem * b.items.length) * Math.exp(0.3 * gauss(rng)) + prm.pair * sim.overlaps(b) + prm.look * looks.length;
      const start = Math.max(t, free), taps = [];
      let k = 0;
      for (const it of looks) if (rng() < prm.pConf) taps.push({ it, at: start + scan + k++ * prm.gap });
      for (const it of contraband) taps.push({ it, at: start + scan + k++ * prm.gap });
      free = start + scan + Math.max(0, k - 1) * prm.gap;
      plan.set(b.idx, { taps, b });
    }
    const on = new Map(sim.onScreen(E).map((i) => [i.id, i]));
    for (const { taps, b } of plan.values()) for (const tp of taps) {
      if (tp.done || t < tp.at) continue;
      const id = `${b.idx}:${b.items.indexOf(tp.it)}`, s = on.get(id);
      if (tp.it.state !== 0 || b.gone) { tp.done = true; continue; }
      if (s && s.y >= L.top + 4) { tp.tries = (tp.tries || 0) + 1; tp.at = t + 0.3; if (tp.tries >= 4) tp.done = true; out.push({ x: s.x + prm.noise * gauss(rng), y: s.y + prm.noise * gauss(rng) }); }
    }
    return out;
  };
};
const humanRuns = (model, shift, n) => {
  const h = { n, three: 0, clear: 0, strikes: 0, miss: 0, fa: 0, time: [] };
  for (let k = 0; k < n; k++) {
    const seed = seedOf(`human-${model}`, shift, k), r = run(shift, seed, 60, humanBot(seed, MODELS[model]));
    if (r.r.stars === 3) h.three++;
    if (r.r.result === 'clear') h.clear++;
    h.strikes += r.r.strikes; h.miss += r.r.misses; h.fa += r.r.falseAlarms; h.time.push(r.time);
  }
  return h;
};

// Worker threads run the human-model table in parallel.
if (!isMainThread) {
  parentPort.postMessage(humanRuns(workerData.model, workerData.shift, workerData.n));
  process.exit(0);
}
async function humanTable(n) {
  const jobs = [];
  for (const model of Object.keys(MODELS)) for (let shift = 1; shift <= SHIFTS; shift++) jobs.push({ model, shift, n });
  const out = {}, workers = opt('--workers', Math.max(1, availableParallelism()));
  let next = 0;
  await Promise.all(Array.from({ length: workers }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      const res = await new Promise((resolve, reject) => { const w = new Worker(new URL(import.meta.url), { workerData: job, argv: process.argv.slice(2) }); w.on('message', resolve); w.on('error', reject); });
      (out[job.model] = out[job.model] || [])[job.shift - 1] = res;
    }
  }));
  return out;
}

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
for (const i of items) if (i.confusable) {
  const c = items.find((o) => o.name === i.confusable);
  check(c && c.contraband, `${i.name}: look-alike link ${i.confusable} is not contraband`);
  check(c && c.tint === i.tint, `${i.name} (${i.tint}) and its look-alike ${i.confusable} (${c && c.tint}) do not share a tint`);
}
console.log(`  look-alikes: ${items.filter((i) => i.confusable).map((i) => `${i.name}>${i.confusable}`).join(', ')}`);

// ---------- 2. packing ----------
console.log(`\nPacking, ${BAGS} bags per shift (${Math.ceil(BAGS / T.bagsPerShift)} seeds of ${T.bagsPerShift}); visibility measured on finer grids than packing used`);
console.log(' shift  items  minArea  minOutline  clean  clean/shift  two-contra  look-alike bags  overlap (mean hidden area)  overlapping pairs/bag  metal-on-metal share');
const packSeed = (shift, k) => hashString(`checkpoint-pack-${shift}-${k}`);
for (let shift = 1; shift <= (BAGS > 0 ? SHIFTS : 0); shift++) {
  const [lo, hi] = T.itemsPerBag[shift - 1], pool = new Set(T.newContraband.slice(0, shift).flat());
  const rot = T.rotMax[shift - 1], maxC = T.maxContraband[shift - 1];
  let n = 0, minArea = 1, minLine = 1, clean = 0, two = 0, conf = 0, itemsSum = 0, maxCl = 0, minCl = 99, contraBags = 0, hidSum = 0, hidN = 0, pairs = 0, mm = 0;
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
      for (const [a, b] of sim.overlapPairs(bag)) { pairs++; if (a.def.tint === 'metal' && b.def.tint === 'metal') mm++; }
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
  console.log(`${pad(shift, 6)}  ${pad(f2(itemsSum / n), 5)}  ${pad(f3(minArea), 7)}  ${pad(f3(minLine), 10)}  ${pad(f3(share), 5)}  ${pad(`${minCl}-${maxCl}`, 11)}  ${pad(f2(two / Math.max(1, contraBags)), 10)}  ${pad(f2(conf / n), 15)}  ${pad(f3(hidSum / hidN), 8)}                     ${pad(f2(pairs / n), 5)}                 ${pad(pairs ? f2(mm / pairs) : '-', 5)}`);
  if (pairs > 200) check(mm / pairs <= 0.2, `shift ${shift}: ${f2(mm / pairs)} of overlapping pairs are metal on metal (tangle bias should keep this rare)`);
}


console.log(`\nBots through the play scene at 60 fps (fast, late: ${SEEDS} seeds per shift; the four failing bots ${Math.min(SEEDS, FAILSEEDS)})`);
console.log(' shift  fast bot   late one-strike at 70%: score, ratio fast/late (mean, median)   at 60%: score, ratio   pulse-waiting  late-blind  tap-all  never');
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
}

// ---------- the human models ----------
const table = await humanTable(HUMANSEEDS);
console.log(`\nHuman models, ${HUMANSEEDS} seeds per cell. Cleared / three stars, percent (mean strikes: missed + false alarms)`);
for (const m of Object.keys(MODELS)) {
  const p = MODELS[m];
  console.log(` ${m} (read ${p.base} + ${p.perItem}/item, tap gap ${p.gap}, noise ${p.noise} px, look-alike mistake ${p.pConf}, +${p.pair}/overlap +${p.look}/look-alike)`);
  console.log('   shift   cleared  three stars  strikes (missed + false)  mean length');
  table[m].forEach((c, i) => console.log(`   ${pad(i + 1, 5)}   ${pad(Math.round((100 * c.clear) / c.n) + '%', 6)}   ${pad(Math.round((100 * c.three) / c.n) + '%', 10)}   ${pad(f2(c.strikes / c.n), 6)} (${f2(c.miss / c.n)} + ${f2(c.fa / c.n)})           ${pad(f1(mean(c.time)) + ' s', 7)}`));
}
const rate = (m, shift, k) => table[m][shift - 1][k] / table[m][shift - 1].n;
for (let shift = 1; shift <= SHIFTS; shift++) check(rate('average', shift, 'clear') >= 0.6, `shift ${shift}: the average reader clears only ${Math.round(100 * rate('average', shift, 'clear'))} percent (needs 60)`);
check(rate('average', SHIFTS, 'three') >= 0.2, `shift 10: the average reader three-stars only ${Math.round(100 * rate('average', SHIFTS, 'three'))} percent (needs 20)`);
for (let shift = 1; shift <= 6; shift++) check(rate('novice', shift, 'clear') >= 0.6, `shift ${shift}: the novice clears only ${Math.round(100 * rate('novice', shift, 'clear'))} percent (needs 60)`);
for (const rush of T.rush) {
  const neigh = [rush - 1, rush + 1].filter((n) => n >= 1 && n <= SHIFTS).map((n) => rate('good', n, 'three'));
  const dip = 100 * (mean(neigh) - rate('good', rush, 'three'));
  console.log(`Rush shift ${rush}: the good reader three-stars ${Math.round(100 * rate('good', rush, 'three'))} percent, ${f1(dip)} points below its neighbours' ${Math.round(100 * mean(neigh))} (target 10 to 20)`);
  check(dip >= 6 && dip <= 30, `rush shift ${rush}: the good reader's three-star dip is ${f1(dip)} points (target 10 to 20)`);
}
if (args.includes('--curve-only')) process.exit(failed ? 1 : 0);
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

// ---------- the render is item-neutral ----------
console.log('\nRender neutrality');
{
  check(Object.keys(sigOf).length === sim.ITEMS.length, `outline signatures are not unique (${Object.keys(sigOf).length} of ${sim.ITEMS.length})`);
  const seen = new Map(), tints = { contra: new Set(), harmless: new Set() };
  for (const shift of [3, 8]) {
    E = makeE(); play.enter(E, { shift, seed: hashString(`checkpoint-neutral-${shift}`) });
    for (let f = 0; f < 60 * 4; f++) {
      play.update(1 / 60, E); E.time += 1 / 60;
      if (f % 20) continue;
      const runs = []; let cur = null;
      for (const r of recordRender(E)) { if (!r.item) { cur = null; continue; } if (!cur || cur.item !== r.item) { cur = { item: r.item, styles: [] }; runs.push(cur); } cur.styles.push(r.style); }
      for (const run1 of runs) {
        const def = sim.ITEMS.find((i) => i.name === run1.item), key = def.tint, sig = run1.styles.join(';');
        if (!seen.has(key)) seen.set(key, new Map());
        seen.get(key).set(sig, (seen.get(key).get(sig) || 0) + 1);
        (def.contraband ? tints.contra : tints.harmless).add(key);
      }
    }
  }
  for (const [tint, sigs] of seen) check(sigs.size === 1, `${tint}: ${sigs.size} different draw styles for unflagged items (a contraband and a harmless item must draw the same)`);
  check(tints.contra.size > 0 && tints.harmless.size > 0 && [...tints.contra].some((t) => tints.harmless.has(t)), 'the neutrality test never saw a contraband and a harmless item of one tint');
  console.log(`  unflagged items draw with one style per tint (${[...seen].map(([t, m]) => `${t}: ${[...m.values()][0]} draws`).join(', ')}); contraband tints seen ${[...tints.contra].join('/')}, harmless ${[...tints.harmless].join('/')}`);
}

// ---------- juice: every event answers the way the PRD says ----------
console.log('\nJuice');
{
  const J = T.juice;
  const fast = run(5, seedOf('juice', 5, 0), 60, centreBot()), e = fast.E, S0 = sim.state();
  const catches = S0.log.filter((x) => x.e === 'catch'), bigs = catches.filter((x) => x.pts >= J.bigCatch).length;
  check(fast.r.result === 'clear', 'the juice run did not clear');
  check(e.haptics.filter((h) => h === J.haptic.catch).length === catches.length && e.haptics.includes(J.haptic.clear) && e.haptics.every((h) => h === J.haptic.catch || h === J.haptic.clear), `haptics on a clean run should be ${J.haptic.catch} ms per catch and ${J.haptic.clear} ms at the clear only (got ${[...new Set(e.haptics)]})`);
  check(e.sounds.filter((x) => x === 'hit').length === catches.length && e.sounds.filter((x) => x === 'win').length === 1 && !e.sounds.includes('lose') && !e.sounds.includes('miss'), 'sounds on a clean run should be hit per catch and one win');
  check(e.shakes === bigs, `small hits must not shake: ${e.shakes} shakes for ${bigs} big catches`);
  const steps = e.beeps.filter((b) => b.type === J.tones.step.type && b.dur === J.tones.step.dur);
  check(steps.length === T.streakSteps.length && steps.every((b, i) => i === 0 || b.freq > steps[i - 1].freq), `the streak steps should give ${T.streakSteps.length} rising tones (got ${steps.map((b) => Math.round(b.freq))})`);
  check(e.beeps.filter((b) => b.dur === J.tones.pass[0].dur && b.freq === J.tones.pass[0].freq).length === S0.passes, 'a soft chime per clean pass');
  const hum = e.beeps.filter((b) => b.dur === J.hum.every * 1.6);
  const hz = hum.map((b) => b.freq);
  check(hum.length > 100 && hz.every((f, i) => i === 0 || f >= hz[i - 1]) && hz[hz.length - 1] > hz[0], `the belt hum should rise with the streak (${hum.length} pulses, ${Math.round(hz[0])} to ${Math.round(hz[hz.length - 1])} Hz)`);
  check(e.particles.list.length <= J.particleCap, `particle cap exceeded: ${e.particles.list.length}`);
  check(S0.stamp && S0.stamp.text === 'CLEARED' && S0.bags.filter((b) => b.shown).length === Math.ceil(T.bagsPerShift / T.burst.size), `the CLEARED stamp and one RUSH banner per burst (${S0.bags.filter((b) => b.shown).length} bursts shown)`);
  console.log(`  clean run, shift 5: ${catches.length} catches (${bigs} big, ${e.shakes} shakes), haptics ${[...new Set(e.haptics)].join('/')} ms, hum ${Math.round(hz[0])} to ${Math.round(hz[hz.length - 1])} Hz over ${hum.length} pulses, ${steps.length} streak tones, stamp ${S0.stamp.text}`);

  const none = run(3, seedOf('juice', 3, 1), 60, () => []), en = none.E, Sn = sim.state();
  check(en.haptics.length === 3 && en.haptics.every((h) => h === J.haptic.miss) && en.sounds.filter((x) => x === 'lose').length === 1 && !en.sounds.includes('win'), `three misses should give three ${J.haptic.miss} ms buzzes and one lose (got ${en.haptics}, ${en.sounds})`);
  check(en.beeps.filter((b) => b.freq === J.tones.miss.freq).length === 3 && Sn.stamp.text === 'SHIFT OVER' && en.shakes === 4, `misses: low buzz x3, SHIFT OVER stamp, 3 miss shakes and one for the stamp (got ${en.shakes} shakes)`);
  const all = run(3, seedOf('juice', 3, 2), 60, tapAllBot()), ea = all.E, Sa = sim.state();
  check(Sa.falseAlarms > 0 && ea.haptics.filter((h) => h === J.haptic.falseAlarm).length === Sa.falseAlarms && ea.sounds.filter((x) => x === 'miss').length === Sa.falseAlarms, 'each false alarm gives the buzzer and 30 ms');
  console.log(`  never-tap run: haptics ${en.haptics.join('/')} ms, low buzz x3, lose, ${en.shakes} shakes; tap-all run: ${Sa.falseAlarms} false alarms with buzzer and ${J.haptic.falseAlarm} ms each`);
}
{
  // Catching the last contraband slides the bag into the tray; it takes no taps after that.
  E = makeE(); play.enter(E, { shift: 3, seed: 7 });
  const S = sim.state(), bag = S.bags.find((b) => b.kind === 'contra');
  bag.y0 = 100 - S.dist; bag.y = 100;
  const k = bag.items.find((i) => i.contraband), h = bag.items.find((i) => !i.contraband);
  play.onPointerDown({ x: 30 + k.x, y: 100 + k.y }, E);
  check(bag.trayT === 0 && k.state === 1, 'the last catch should start the tray slide');
  play.onPointerDown({ x: 30 + h.x, y: 100 + h.y }, E);
  check(h.state === 0 && S.strikes === 0, 'a bag in the tray must take no taps');
  for (let i = 0; i < 60; i++) { play.update(1 / 60, E); E.time += 1 / 60; }
  check(bag.trayT >= T.juice.tray, 'the tray slide should finish');
  console.log(`Tray: last catch starts the slide (trayT ${bag.trayT.toFixed(2)} s after a second), later taps on the bag do nothing`);
}
{
  // The card: no buttons during the beat, then Retry reuses the seed and Next does not.
  const e = makeE(); e.time = 5;
  const r = { shift: 4, seed: 12345, result: 'clear', score: 999, strikes: 0, stars: 3, best: 999, isNew: true };
  game.scenes.over.enter(e, r);
  recordRender(e, game.scenes.over);
  game.scenes.over.onTap({ x: e.w / 2, y: e.h * 0.6 }, e);
  check(!e.scene, 'a tap during the card beat must not press a button');
  e.time = 5 + T.juice.cardButtons + 0.5; recordRender(e, game.scenes.over);
  game.scenes.over.onTap({ x: e.w / 2, y: e.h * 0.6 + 68 }, e);
  check(e.scene === 'play' && e.params.seed === 12345 && e.params.shift === 4, `Retry should replay shift 4 with seed 12345 (got ${e.scene} ${JSON.stringify(e.params)})`);
  e.scene = null; game.scenes.over.onTap({ x: e.w / 2, y: e.h * 0.6 }, e);
  check(e.scene === 'play' && e.params.shift === 5 && e.params.seed === undefined, 'Next should start shift 5 with a fresh seed');
  console.log('Card: buttons appear after the beat; Retry reuses the seed, Next starts fresh');
}
{
  // Save v2: unlocked derives from the stars, and is clamped.
  const m = (d) => game.migrate(d, 1).unlocked;
  check(m({ shifts: { 1: { stars: 3 }, 2: { stars: 1 }, 4: { stars: 2 } }, unlocked: 999 }) === 5, 'migrate should unlock one past the highest starred shift');
  check(m({ unlocked: 999 }) === 1 && m({}) === 1 && m({ shifts: { 10: { stars: 1 } } }) === 10, 'migrate with no stars unlocks shift 1; a starred shift 10 stays at 10');
  const cl = [['x', 1], [0, 1], [-3, 1], [99, 10], [4.7, 4], [NaN, 1], ['3', 3], [undefined, 1]];
  for (const [v, want] of cl) check(sim.clampUnlocked(v) === want, `clampUnlocked(${v}) should be ${want}`);
  check(game.saveVersion === 2, 'saveVersion should be 2');
  const e = makeE(); e.save.set('unlocked', 'garbage');
  const rr = run(1, 5, 60, () => [], null, e);
  check(rr.r.unlocked === 1, `a garbage unlocked value should read as 1 (result says ${rr.r.unlocked})`);
  console.log('Save: v1 saves migrate (unlocked = highest starred shift + 1), unlocked is clamped to 1 to 10 on read');
}
{
  // Rush hour comes in bursts at the normal average rate.
  for (const shift of [4, 5, 10]) {
    E = makeE(); play.enter(E, { shift, seed: 3 });
    const S = sim.state(), gaps = S.bags.slice(1).map((b, i) => S.bags[i].y0 - b.y0 - T.bagH);
    const avg = mean(gaps), rush = T.rush.includes(shift);
    const pattern = gaps.map((g, i) => ((i + 1) % T.burst.size === 0 ? 'L' : 's') + (Math.abs(g - (rush ? ((i + 1) % T.burst.size === 0 ? T.burst.size * T.bagGap - (T.burst.size - 1) * T.burst.gapIn : T.burst.gapIn) : T.bagGap)) < 1e-6 ? '' : '!')).join('');
    check(!pattern.includes('!'), `shift ${shift}: bag gaps are wrong (${gaps.map(Math.round)})`);
    check(Math.abs(avg - T.bagGap) < 4, `shift ${shift}: average gap ${f1(avg)} should stay near ${T.bagGap}`);
    console.log(`  shift ${shift}${rush ? ' (rush)' : ''}: gaps ${gaps.slice(0, 7).map(Math.round).join(' ')} ..., average ${f1(avg)}`);
  }
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
