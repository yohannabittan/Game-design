#!/usr/bin/env node
// sim-checkpoint: proofs for Checkpoint v0.2 through the game's real generation, lane, tap resolution, scoring and render calls
// (games/checkpoint/src/game.js, via game.sim and the play scene). The H section of PRD v0.2 and J4 (the detector amendment) are the
// gate; the run ends with one table.
//
//   node tools/sim-checkpoint.mjs [--bags 300] [--seeds 8] [--human-seeds 40] [--fail-seeds 4] [--workers N] [--skip-human]
//
// 1. Items: the item and body tables, hit shapes at 360x640 and 390x844 (H6), tells, tiers, look-alikes sharing a material.
// 2. Packing per day over --bags seeded bags: counts, visibility by area and outline, every contraband tell readable (H2), occlusion.
// 3. The lane: every body scan shows at least scanShow, with the lever down and through SWAT slow-motion (H2); travellers' flavour is
//    independent of what they carry; the cast and Vic's script.
// 4. Bots through the play scene: a fast reader clears every day with three stars with and without the lever (the lever pays more), the
//    never-tap, tap-all and pulse-waiting bots fail; a missed gun ends the day at once; a caught gun calls SWAT.
// 5. Human models (expert, good, average, novice) with a split-attention lane model: a first-timer (average reader) clears day 1 (H3),
//    and days 2 to 10 stay clearable.
// 6. Render: no red before a strike, materials alone decide a part's colour, text 14 px and up on every screen (H6).
// 7. Determinism at 30, 60 and 120 fps with lever pulls, body taps and SWAT (H1); save migration v1, v2 and v3 to v4 (H5); misc.
// 8. Amendment J: whom the arch beeps for (share by day, mostly harmless metal), sound plus light on every beep and no scan without one (J4),
//    bests only on cleared days, the SWAT cap, a missed body critical ending the day at the arch, the lighter, the banner clear of the belt.
//    The human table also prints each day's clear and breach rates for the average and novice readers against v0.2 on the same seeds.
// Exit code 0 when every check passes, 1 otherwise.

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { game } from '../games/checkpoint/src/game.js';
import { makeRng, hashString } from '../games/checkpoint/src/engine.js';

const T = game.TUNING, sim = game.sim, play = game.scenes.play;
const args = process.argv.slice(2);
// --set path=value (repeatable): try a TUNING value without editing the game, e.g. --set tune.belt=0.9 --set scanShow=1.6
for (let i = 0; i < args.length; i++) if (args[i] === '--set') {
  const [path, v] = args[i + 1].split('='), keys = path.split('.'), last = keys.pop();
  let o = T; for (const k of keys) o = o[k];
  o[last] = JSON.parse(v);
}
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? Number(args[i + 1]) : d; };
const BAGS = opt('--bags', 300), SEEDS = opt('--seeds', 12), FAILSEEDS = opt('--fail-seeds', 4), HUMANSEEDS = opt('--human-seeds', 40), SHIFTS = T.beltSpeed.length;
let failed = 0;
const H = {};   // the H table: id -> { what, result, ok }
const gate = (id, what, result, ok) => { H[id] = H[id] ? { what, result: `${H[id].result}; ${result}`, ok: H[id].ok && ok } : { what, result, ok }; if (!ok) { failed++; console.log(`  FAIL ${id}: ${result}`); } };
const check = (ok, msg) => { if (!ok) { failed++; console.log(`  FAIL ${msg}`); } return ok; };
const f1 = (x) => x.toFixed(1), f2 = (x) => x.toFixed(2), f3 = (x) => x.toFixed(3);
const pad = (v, n) => String(v).padStart(n);
const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const seedOf = (tag, shift, k) => hashString(`checkpoint-${tag}-${shift}-${k}`);
const gauss = (rng) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());

// ---------- the play scene on a stand-in engine ----------
const makeE = (w = 360, h = 640) => {
  const e = {
    w, h, time: 0, safe: { top: 0, bottom: 0, left: 0, right: 0 }, scene: null, params: null, haptics: [], sounds: [], beeps: [], shakes: 0, dpr: 1, toasts: [],
    ledger: { entries: [], add(k, d) { e.ledger.entries.push({ k, d }); return e.ledger.entries.length; } },
    toast(m) { e.toasts.push(m); },
    rng: makeRng(1),
    save: { d: {}, get(k, d) { return k in this.d ? this.d[k] : d; }, set(k, v) { this.d[k] = v; return v; }, update(k, fn, d) { return this.set(k, fn(this.get(k, d))); } },
    audio: { muted: false, play(n) { e.sounds.push(n); }, beep(o) { e.beeps.push(o); }, noise() {}, toggleMute() {} },
    particles: { list: [], emit(o) { this.list.push(...Array.from({ length: o.count || 0 }, () => ({ life: o.life || 0.5 }))); } },
    shake() { e.shakes++; }, flash() {}, haptic(ms) { e.haptics.push(ms); },
    tween(d, fn, ease, done) { fn(1); if (done) done(); },
    setScene(n, p) { this.scene = n; this.params = p; },
    hit: (r, p) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h,
    button: (label, cx, cy, o = {}) => { const w = o.w || Math.min(280, e.w * 0.7), h = o.h || 56; return { x: cx - w / 2, y: cy - h / 2, w, h }; },
    roundRect() {}, text() {},
  };
  return e;
};
let E = makeE();

// Runs one shift. policy(E, t) returns taps [{x, y}] for the end of a frame; `script` replays recorded taps instead.
function run(shift, seed, fps, policy, script, e = makeE(), watch = null) {
  E = e; E.scene = null; E.params = null;
  play.enter(E, { shift, seed });
  const S = sim.state(), dt = 1 / fps, taps = [];
  let frame = 0, ti = 0;
  while (!E.scene && frame < fps * 400) {
    play.update(dt, E); frame++; E.time = frame * dt;
    if (watch) watch(S, E);
    const t = Math.round(frame * dt * 1200) / 1200;
    const list = script ? [] : policy(E, t);
    if (script) while (ti < script.length && script[ti].t <= t + 1e-9) list.push(script[ti++]);
    for (const p of list) { taps.push({ t, x: p.x, y: p.y }); play.onPointerDown({ x: p.x, y: p.y }, E); }
  }
  return { r: E.params, taps, S: { score: S.score, strikes: S.strikes, streak: S.streak, log: S.log.map((x) => JSON.stringify(x)).join('|') }, time: S.time, E, state: S };
}

// Fast reader: taps each bag contraband centre the first frame it is below the hood, and each body contraband on the scan the first frame it
// shows. `lever`: pulls the rush lever at the start.
const fastBot = (lever = false, laneDelay = 0) => {
  const done = new Set();
  let pulled = !lever;
  return (E) => {
    const L = sim.layout(E), out = [];
    if (!pulled) { pulled = true; const lv = sim.lever(E); out.push({ x: lv.x, y: lv.y }); }
    for (const it of sim.onScreen(E)) if (it.contraband && it.state === 0 && !done.has(it.id) && it.y >= L.top + 8) { done.add(it.id); out.push({ x: it.x, y: it.y }); }
    for (const tr of sim.lane(E)) if (tr.items && tr.pending > 0 && !tr.stopped && !tr.swat && tr.scanT >= laneDelay && !done.has(`t${tr.idx}`)) { done.add(`t${tr.idx}`); const c = tr.items.find((i) => i.contraband); out.push({ x: c.x, y: c.y }); }
    return out;
  };
};
const tapAllBot = () => {
  const done = new Set();
  return (E) => {
    const L = sim.layout(E), out = [];
    for (const it of sim.onScreen(E)) if (it.state === 0 && !done.has(it.id) && it.y >= L.top + 8 && it.cy <= L.H / 2) { done.add(it.id); out.push({ x: it.x, y: it.y }); }
    for (const tr of sim.lane(E)) if (tr.items && !done.has(`t${tr.idx}`)) { done.add(`t${tr.idx}`); for (const i of tr.items) out.push({ x: i.x, y: i.y }); }
    return out;
  };
};

// A recording canvas: every stroke and fill with its style, and every text with its size.
class Path2D { constructor() { this.n = 0; } moveTo() { this.n++; } lineTo() {} closePath() {} }
globalThis.Path2D = Path2D;
function recordRender(e, scene = play) {
  const log = [];
  const ctx = new Proxy({}, {
    get: (t, k) => (k === 'stroke' || k === 'fill' || k === 'fillRect' || k === 'strokeRect' ? () => log.push({ c: String(k.startsWith('stroke') ? t.strokeStyle : t.fillStyle), op: t.globalCompositeOperation || 'source-over', kind: k }) : k in t ? t[k] : k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 100 }) : () => {}),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  const re = { ...e, ctx, text: (str, x, y, o = {}) => log.push({ c: String(o.color || ''), text: str, size: o.size ?? 16 }), roundRect: (x, y, w, h, r, fill, stroke) => { if (fill) log.push({ c: String(fill) }); if (stroke) log.push({ c: String(stroke) }); }, button: (label, cx, cy, o = {}) => { log.push({ c: String(o.fill || ''), text: label, size: o.size ?? 20 }); return e.button(label, cx, cy, o); } };
  scene.render(ctx, re);
  if (re.titleArea) e.titleArea = re.titleArea;
  return log;
}
const RED = new RegExp(`${T.palette.catch}|${parseInt(T.palette.catch.slice(1, 3), 16)},\\s*${parseInt(T.palette.catch.slice(3, 5), 16)},\\s*${parseInt(T.palette.catch.slice(5, 7), 16)}`, 'i');
const pulseBot = () => {
  const done = new Set();
  return (E) => {
    if (!recordRender(E).some((r) => RED.test(r.c))) return [];
    const out = [];
    for (const it of sim.onScreen(E)) if (it.state === 0 && !done.has(it.id)) { done.add(it.id); out.push({ x: it.x, y: it.y }); }
    return out;
  };
};

// ---------- the human models ----------
// A bag is read once it is fully below the hood and the reader is free: (base + perItem x items) x lognormal(0.3) + pair x overlaps +
// look x look-alikes; then the contraband found is tapped `gap` s apart with Gaussian noise, mistaking each look-alike with probability pConf.
// The lane interrupts: when a beeper's scan opens the reader glances after `react` s (unless absorbed, pMissScan) and finds each contraband item after
// (scanBase + scanPer x its rank in a random reading order) x lognormal(0.3), a clean traveller after reading every item; a lone dense
// (black) items pop out and are read first. A find inside the
// scan window is tapped on the scan; one that comes too late is not seen at all (the scan has faded). A normal item is mistaken with pConfBody.
// The glance (and its tap) pushes every bag tap still to come later by the time it took: split attention.
const MODELS = {
  expert: { base: 0.28, perItem: 0.065, gap: 0.18, noise: 8, pConf: 0.02, pair: 0.03, look: 0.10, react: 0.2, scanBase: 0.18, scanPer: 0.1, pConfBody: 0.002, pMissScan: 0 },
  good: { base: 0.35, perItem: 0.09, gap: 0.22, noise: 8, pConf: 0.04, pair: 0.06, look: 0.17, react: 0.25, scanBase: 0.22, scanPer: 0.13, pConfBody: 0.005, pMissScan: 0.01 },
  average: { base: 0.45, perItem: 0.12, gap: 0.30, noise: 9, pConf: 0.08, pair: 0.09, look: 0.26, react: 0.32, scanBase: 0.28, scanPer: 0.16, pConfBody: 0.01, pMissScan: 0.03 },
  novice: { base: 0.60, perItem: 0.16, gap: 0.38, noise: 10, pConf: 0.12, pair: 0.12, look: 0.35, react: 0.42, scanBase: 0.36, scanPer: 0.2, pConfBody: 0.02, pMissScan: 0.06 },
};
const isDense = (b) => b.def.parts.some(([m]) => m === 'dense');
const humanBot = (seed, prm) => {
  const rng = makeRng(seed ^ 0x5bd1e995);
  let free = 0;
  const plan = new Map(), scans = new Map(), pending = [];
  const delay = (from, d) => { for (const p of plan.values()) for (const tp of p.taps) if (!tp.done && tp.at >= from) tp.at += d; free = Math.max(free, from) + d; };
  return (E, t) => {
    const S = sim.state(), L = sim.layout(E), out = [];
    for (const tr of S.travellers) {
      if (tr.state !== 'scan' || !tr.beeps || scans.has(tr.idx)) continue;   // a scan shows only for a traveller who beeped, so only those are read
      const order = rng.shuffle(tr.body.slice()), normal = order.filter((b) => !b.contraband), conf = normal.length && rng() < prm.pConfBody ? [rng.pick(normal)] : [];
      const absorbed = rng() < prm.pMissScan, ln = Math.exp(0.3 * gauss(rng));
      // dense (black) items pop out among blue metal: they are read first
      order.sort((a, b) => isDense(b) - isDense(a));
      const k = order.findIndex((b) => b.contraband), find = (prm.scanBase + prm.scanPer * (k < 0 ? order.length : k + 1)) * ln;
      const seen = !absorbed && prm.react + find <= T.scanShow;
      const s = { tr, at: t + prm.react + find, tap: seen && (k >= 0 || conf.length), item: k >= 0 ? order[k] : conf[0] };
      scans.set(tr.idx, s);
      if (!absorbed) delay(t, Math.min(T.scanShow, prm.react + find) + (s.tap ? prm.gap : 0));
      if (s.tap) pending.push(s);
    }
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
    for (let i = pending.length - 1; i >= 0; i--) {
      const s = pending[i];
      if (t < s.at) continue;
      pending.splice(i, 1);
      const tr = sim.lane(E).find((x) => x.idx === s.tr.idx);
      if (!tr || !tr.items) continue;
      const it = tr.items[s.tr.body.indexOf(s.item)];
      out.push({ x: it.x + 4 * gauss(rng), y: it.y + 4 * gauss(rng) });
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
  const h = { n, three: 0, clear: 0, breach: 0, strikes: 0, miss: 0, fa: 0, time: [], swat: 0 };
  for (let k = 0; k < n; k++) {
    const seed = seedOf(`human-${model}`, shift, k), r = run(shift, seed, 60, humanBot(seed, MODELS[model]));
    if (r.r.stars === 3) h.three++;
    if (r.r.result === 'clear') h.clear++;
    if (r.r.result === 'breach') h.breach++;
    h.strikes += r.r.strikes; h.miss += r.r.misses; h.fa += r.r.falseAlarms; h.time.push(r.time); h.swat += r.r.swats;
  }
  return h;
};
if (!isMainThread) {
  parentPort.postMessage(humanRuns(workerData.model, workerData.shift, workerData.n));
  process.exit(0);
}
async function humanTable(n) {
  const jobs = [];
  const only = args.includes('--models') ? args[args.indexOf('--models') + 1].split(',') : Object.keys(MODELS), days = args.includes('--days') ? args[args.indexOf('--days') + 1].split(',').map(Number) : Array.from({ length: SHIFTS }, (_, i) => i + 1);
  for (const model of only) for (const shift of days) jobs.push({ model, shift, n });
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
if (args.includes('--debug')) {   // --debug <model> <day> <seeds>: what each run of one human model missed and false-alarmed
  const [m, d, n] = args.slice(args.indexOf('--debug') + 1);
  for (let k = 0; k < Number(n); k++) {
    const seed = seedOf(`human-${m}`, Number(d), k), r = run(Number(d), seed, 60, humanBot(seed, MODELS[m]));
    console.log(r.r.result, r.r.strikes, r.state.log.filter((x) => x.e === 'false' || x.e === 'miss').map((x) => `${x.e}:${x.item}@${x.t.toFixed(1)}`).join(' '));
  }
  process.exit(0);
}
const humanPromise = args.includes('--skip-human') ? null : humanTable(HUMANSEEDS);

// ---------- 1. items ----------
console.log('Items');
const items = sim.ITEMS, contra = items.filter((i) => i.contraband);
check(items.length >= 44 && contra.length >= 14, `expected about 45 items (30 + ~15 new), got ${items.length} with ${contra.length} contraband`);
console.log(`  ${items.length} items, ${contra.length} contraband: ${[1, 2, 3].map((t) => `${T.tierName[t]} ${contra.filter((i) => i.tier === t).map((i) => i.name).join(', ')}`).join('; ')}`);
const inPoly = (px, py, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c; } return c; };
const s360 = sim.layout(makeE(360, 640)).s, s390 = sim.layout(makeE(390, 844)).s;
const hitPx = (i, s) => (i.thin + 2 * T.hitMargin) * s;
const thinnest = items.slice().sort((a, b) => a.thin - b.thin)[0];
let hitOk = items.every((i) => hitPx(i, s360) >= 44 && hitPx(i, s390) >= 44);
for (const i of contra) check(i.shape.some((p) => inPoly(0, 0, p)), `${i.name}: centre is outside its outline`);
for (const i of contra) check(i.tell.length > 0 && i.tellPts.length > 0, `${i.name}: no tell part`);
for (const i of items) if (i.confusable) {
  const c = items.find((o) => o.name === i.confusable);
  check(c && c.contraband, `${i.name}: look-alike link ${i.confusable} is not contraband`);
  check(c && i.mats.some((m) => c.mats.includes(m)), `${i.name} and its look-alike ${i.confusable} share no material`);
}
console.log(`  look-alikes: ${items.filter((i) => i.confusable).map((i) => `${i.name}>${i.confusable}`).join(', ')}`);
console.log(`  materials: ${['organic', 'plastic', 'metal', 'dense'].map((m) => `${m} ${items.filter((i) => i.mats.includes(m)).length}`).join(', ')} items carry each`);
// body items on the scan, travellers and the lever
const L360 = sim.layout(makeE(360, 640)), L390 = sim.layout(makeE(390, 844));
const bodyThin = Math.min(...sim.BODY.map((b) => { const xs = b.parts.flatMap(([, p]) => p.map((q) => q[0])), ys = b.parts.flatMap(([, p]) => p.map((q) => q[1])); return Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)); }));
const bodyPx = (L) => (bodyThin * L.scan.k + 2 * T.bodyHit) * L.s, figPx = (L) => (T.lane.figW + 2 * T.figureHit) * L.s, leverPx = (L) => Math.min(L.lever.w, L.lever.h) * L.s;
hitOk = hitOk && [L360, L390].every((L) => bodyPx(L) >= 44 && figPx(L) >= 44 && leverPx(L) >= 44);
console.log(`  hit shapes, narrowest: bag item ${thinnest.name} ${f1(hitPx(thinnest, s360))} px at 360x640, ${f1(hitPx(thinnest, s390))} at 390x844; body item ${f1(bodyPx(L360))}/${f1(bodyPx(L390))}; traveller ${f1(figPx(L360))}/${f1(figPx(L390))}; lever ${f1(leverPx(L360))}/${f1(leverPx(L390))}`);

// ---------- 2. packing ----------
console.log(`\nPacking, ${BAGS} bags per day; visibility on finer grids than packing used (occlusion knob ${T.tune.occlusion})`);
console.log(' day  items  minArea(c/h)   minOutline(c/h)  minTell  clean  two-contra  look-alike  mean hidden area  pairs/bag  tells under metal/dense (mean)');
const packSeed = (shift, k) => hashString(`checkpoint-pack-${shift}-${k}`);
let tellMin = 1, critTellMin = 1, critN = 0, tellN = 0;
const hiddenByDay = [];
for (let shift = 1; shift <= (BAGS > 0 ? SHIFTS : 0); shift++) {
  const [lo, hi] = T.itemsPerBag[shift - 1], pool = new Set([...T.newContraband.slice(0, shift).flat(), 'snow globe', ...T.smuggler.flatMap((s) => s.bag || [])]);
  const rule = sim.packRule(shift);
  let n = 0, itemsSum = 0, minA = [1, 1], minL = [1, 1], minT = 1, clean = 0, two = 0, conf = 0, hid = 0, hidN = 0, pairs = 0, contraBags = 0, tellHid = 0, tellCnt = 0;
  for (let k = 0; n < BAGS; k++) {
    const g = sim.genShift(packSeed(shift, k), shift);
    check(g.bags.length === T.bagsPerShift && g.travellers.length === T.bagsPerShift, `day ${shift}: ${g.bags.length} bags, ${g.travellers.length} travellers`);
    g.bags.forEach((bag, bi) => {
      n++; itemsSum += bag.items.length;
      const where = `day ${shift} seed ${k} bag ${bi}`, cs = bag.items.filter((it) => it.contraband);
      check(bag.items.length >= Math.min(lo, 3) && bag.items.length <= hi, `${where}: ${bag.items.length} items, row says ${lo}-${hi}`);
      check(cs.length <= Math.max(1, T.maxContraband[shift - 1]), `${where}: ${cs.length} contraband`);
      check(cs.every((it) => pool.has(it.name)), `${where}: contraband outside the day's pool (${cs.map((c) => c.name)})`);
      check((bag.kind === 'clean') === (cs.length === 0), `${where}: kind ${bag.kind} with ${cs.length} contraband`);
      if (bag.kind === 'clean') clean++; else contraBags++;
      if (cs.length === 2) two++;
      if (bag.items.some((it) => it.def.confusable)) conf++;
      pairs += sim.overlaps(bag);
      const area = sim.visibility(bag, 0.75, 0.31), line = sim.outlineVisibility(bag, 0.7, 0.3), tell = sim.tellVisibility(bag, 0.6, 0.27);
      bag.items.forEach((it, i) => {
        const c = it.contraband ? 0 : 1, need = rule.overlap ? (it.contraband ? rule.needC : rule.needH) - rule.slack : 1;
        minA[c] = Math.min(minA[c], area[i]); minL[c] = Math.min(minL[c], line[i]); hid += 1 - area[i]; hidN++;
        check(area[i] >= need - 0.02 && line[i] >= need - 0.02, `${where}: ${it.name} is ${f3(area[i])} visible by area, ${f3(line[i])} by outline (needs ${f2(need)})`);
        if (it.contraband) {
          minT = Math.min(minT, tell[i]); tellMin = Math.min(tellMin, tell[i]); tellN++; tellHid += 1 - tell[i]; tellCnt++;
          if (it.tier === 3) { critTellMin = Math.min(critTellMin, tell[i]); critN++; }
          check(tell[i] >= T.tellVis - 0.02, `${where}: ${it.name}'s tell is only ${f3(tell[i])} readable`);
        }
        check(it.bb.x0 >= 0 && it.bb.x1 <= T.bagW && it.bb.y0 >= 0 && it.bb.y1 <= T.bagH, `${where}: ${it.name} leaves the bag`);
      });
    });
  }
  hiddenByDay.push(hid / hidN);
  console.log(`${pad(shift, 4)}  ${pad(f2(itemsSum / n), 5)}  ${pad(`${f2(minA[0])}/${f2(minA[1])}`, 12)}   ${pad(`${f2(minL[0])}/${f2(minL[1])}`, 13)}   ${pad(f2(minT), 6)}  ${pad(f2(clean / n), 5)}  ${pad(f2(two / Math.max(1, contraBags)), 10)}  ${pad(f2(conf / n), 10)}  ${pad(f3(hid / hidN), 16)}  ${pad(f2(pairs / n), 9)}  ${pad(f3(tellHid / Math.max(1, tellCnt)), 8)}`);
}
if (BAGS > 0) gate('H2', 'Fair: tells readable, body items shown for scanShow, no critical item without a readable tell', `bag contraband tells at least ${f3(tellMin)} readable (needs ${T.tellVis}) over ${tellN} items; criticals ${f3(critTellMin)} over ${critN}`, tellMin >= T.tellVis - 0.02 && critTellMin >= T.tellVis - 0.02);

// ---------- 3. the lane ----------
console.log('\nThe lane');
{
  // Every body scan shows at least scanShow: normal speed, lever down, and through a SWAT slow-motion.
  let minShow = Infinity, scans = 0, under = 0;
  for (const [shift, lever] of [[1, false], [5, true], [7, false], [7, true], [10, true]]) for (let k = 0; k < 3; k++) {
    const r = run(shift, seedOf('scan', shift, k), 60, fastBot(lever, 0.2));
    for (const tr of r.state.travellers) {
      if (tr.shownFor === undefined) continue;   // tackled on the scan, or the day ended first
      scans++; minShow = Math.min(minShow, tr.shownFor);
      if (tr.shownFor < T.scanShow - 1e-6) under++;
    }
  }
  const bodyAll = [];
  for (let shift = 1; shift <= SHIFTS; shift++) for (let k = 0; k < 20; k++) bodyAll.push(...sim.genShift(seedOf('cast', shift, k), shift).travellers.map((t) => ({ ...t, shift })));
  const critTells = bodyAll.flatMap((t) => t.body.filter((b) => b.tier === 3));
  const slots = bodyAll.every((t) => new Set(t.body.map((b) => b.def.slot)).size === t.body.length);
  check(slots, 'two body items share a slot (they would overlap on the scan)');
  gate('H2', 'Fair', `every body scan showed at least ${f2(minShow)} s (scanShow ${T.scanShow}) over ${scans} scans with the lever down and SWAT slow-motion, ${under} short; body items never share a slot (${critTells.length} body guns, each drawn alone in its slot)`, under === 0 && minShow >= T.scanShow - 1e-6 && slots);
  // Flavour is never the tell: sweating, glancing and sunglasses are as common on carriers as on clean travellers.
  const ord = bodyAll.filter((t) => !t.who), carriers = ord.filter((t) => t.body.some((b) => b.contraband)), cleanT = ord.filter((t) => !t.body.some((b) => b.contraband));
  const rate = (list, k) => list.filter((t) => t.look[k]).length / Math.max(1, list.length);
  const flav = ['sweat', 'glance', 'shades'].map((k) => [k, rate(carriers, k), rate(cleanT, k)]);
  check(flav.every(([, a, b]) => Math.abs(a - b) < 0.08), `flavour depends on contraband: ${flav.map(([k, a, b]) => `${k} ${f2(a)} vs ${f2(b)}`).join(', ')}`);
  console.log(`  flavour on carriers vs clean travellers (${carriers.length} / ${cleanT.length}): ${flav.map(([k, a, b]) => `${k} ${f2(a)}/${f2(b)}`).join(', ')}`);
  // The cast: who appears, and Vic's hiding place each day.
  const vic = [];
  for (let shift = 1; shift <= SHIFTS; shift++) {
    const g = sim.genShift(seedOf('cast', shift, 0), shift), who = Object.values(g.cast), v = g.travellers.find((t) => t.who === 'smuggler');
    check(who.includes('smuggler') && v && (v.body.some((b) => b.contraband) || g.bags[v.idx].kind === 'contra'), `day ${shift}: Vic is missing or carries nothing`);
    check(g.travellers.filter((t) => t.who === 'businessman').every((t) => !t.body.some((b) => b.contraband) && g.bags[t.idx].kind === 'clean'), `day ${shift}: Mr. Pike must always be clean`);
    check(g.travellers.filter((t) => t.who === 'grandma').every((t) => g.bags[t.idx].items.some((i) => i.name === 'knitting needles') && g.bags[t.idx].kind === 'clean'), `day ${shift}: Grandma Rose carries her knitting needles, allowed`);
    const s = T.smuggler[shift - 1];
    vic.push(s.bag ? `${s.bag.join('+')} under the ${s.under}` : s.body.join('+'));
  }
  console.log(`  Vic's hiding places, days 1 to 10: ${vic.join('; ')}`);
}

// ---------- 4. bots ----------
console.log(`\nBots at 60 fps (${SEEDS} seeds per day; the failing bots ${Math.min(SEEDS, FAILSEEDS)})`);
console.log(' day  fast: 3-star, score  with lever: 3-star, score, x  never-tap  tap-all  pulse-waiting  swat calls');
const fastScores = [], leverScores = [], swatShare = [];
const swatPts = (st) => st.log.filter((x) => x.e === 'swat').reduce((a, x) => a + x.pts, 0);
for (let shift = 1; shift <= SHIFTS; shift++) {
  let three = 0, threeL = 0, sc = [], scL = [], swats = 0, shareMax = 0, shareSum = 0, goodMax = 0;
  const fails = { none: 0, all: 0, pulse: 0 }, breaches = { none: 0 };
  for (let k = 0; k < SEEDS; k++) {
    const seed = seedOf('bot', shift, k);
    const a = run(shift, seed, 60, fastBot(false)), b = run(shift, seed, 60, fastBot(true));
    if (a.r.result === 'clear' && a.r.stars === 3) three++;
    if (b.r.result === 'clear' && b.r.stars === 3) threeL++;
    check(a.r.result === 'clear' && a.r.stars === 3, `day ${shift} seed ${seed}: the fast reader got ${a.r.result} ${a.r.stars} stars (${a.r.misses} missed, ${a.r.falseAlarms} false)`);
    check(b.r.result === 'clear', `day ${shift} seed ${seed}: the fast reader with the lever got ${b.r.result}`);
    sc.push(a.r.score); scL.push(b.r.score); swats += a.r.swats;
    shareMax = Math.max(shareMax, swatPts(a.state) / a.r.score, swatPts(b.state) / b.r.score); shareSum += swatPts(a.state) / a.r.score;
    goodMax = Math.max(goodMax, swatPts(a.state) / T.goodDay[shift - 1], swatPts(b.state) / T.goodDay[shift - 1]);
    if (k >= FAILSEEDS) continue;
    const none = run(shift, seed, 60, () => []);
    if (none.r.result !== 'clear') fails.none++;
    if (none.r.result === 'breach') breaches.none++;
    if (run(shift, seed, 60, tapAllBot()).r.result !== 'clear') fails.all++;
    if (run(shift, seed, 60, pulseBot()).r.result !== 'clear') fails.pulse++;
  }
  const nf = Math.min(SEEDS, FAILSEEDS);
  for (const [name, v] of Object.entries(fails)) check(v === nf, `day ${shift}: the ${name} bot cleared ${nf - v} of ${nf}`);
  fastScores.push(mean(sc)); leverScores.push(mean(scL)); swatShare.push({ mean: shareSum / SEEDS, max: shareMax, good: goodMax });
  check(mean(scL) > mean(sc) * 1.2, `day ${shift}: the lever should pay (${Math.round(mean(scL))} against ${Math.round(mean(sc))})`);
  console.log(`${pad(shift, 4)}  ${pad(`${three}/${SEEDS}`, 6)}, ${pad(Math.round(mean(sc)), 6)}   ${pad(`${threeL}/${SEEDS}`, 6)}, ${pad(Math.round(mean(scL)), 6)}, ${f2(mean(scL) / mean(sc))}   fails ${fails.none}/${nf} (${breaches.none} breach)  fails ${fails.all}/${nf}  fails ${fails.pulse}/${nf}       ${f1(swats / SEEDS)}`);
}
{
  // A missed gun ends the day at once; a caught one calls SWAT on its traveller, slows the belt, sounds the siren and pays a bonus.
  let breachOk = false, swatOk = false;
  for (let k = 0; k < 20 && !(breachOk && swatOk); k++) {
    const seed = seedOf('gun', 1, k), g = sim.genShift(seed, 1), gi = g.bags.findIndex((b) => b.items.some((i) => i.name === 'gun'));
    if (gi < 0) continue;
    const skip = fastBot(false), r = run(1, seed, 60, (E, t) => skip(E, t).filter((p) => !sim.onScreen(E).some((i) => i.name === 'gun' && Math.abs(i.x - p.x) < 1 && Math.abs(i.y - p.y) < 1)));
    const S = r.state, missT = S.log.find((x) => x.e === 'miss' && x.item === 'gun');
    breachOk = r.r.result === 'breach' && r.r.breachItem === 'gun' && missT && S.log.at(-1).e === 'breach' && Math.abs(S.log.at(-1).t - missT.t) < 1e-9 && S.stamp.text === 'BREACH';
    const c = run(1, seed, 60, fastBot(false)), C = c.state, tr = C.travellers[gi];
    const sw = C.log.find((x) => x.e === 'swat');
    swatOk = !!sw && sw.who === gi && !!tr.swat && c.r.swats >= 1 && c.E.beeps.filter((b) => b.type === T.juice.tones.siren.type && (b.freq === T.juice.tones.siren.lo || b.freq === T.juice.tones.siren.hi)).length >= T.juice.tones.siren.n && c.E.sounds.includes('boom');
  }
  check(breachOk, 'a missed bag gun should end the day at once with BREACH');
  check(swatOk, 'a caught bag gun should call SWAT on its traveller, with siren and boom');
  // Slow-motion: the belt crawls right after a SWAT call on a body gun caught on the scan.
  let shown = false;
  for (let k = 0; k < 20 && !shown; k++) {
    E = makeE(); play.enter(E, { shift: 7, seed: seedOf('slow', 7, k) });
    const S = sim.state(), tr = S.travellers.find((t) => t.body.some((b) => b.tier === 3));
    if (!tr) continue;
    const bot = fastBot(false, 0.5);
    for (let f = 0; f < 60 * 200 && tr.state !== 'scan' && !E.scene; f++) { play.update(1 / 60, E); for (const p of bot(E)) play.onPointerDown(p, E); }
    if (tr.state !== 'scan' || E.scene) continue;
    const it = sim.lane(E).find((x) => x.idx === tr.idx).items.find((i) => i.contraband);
    play.onPointerDown(it, E);
    const a = S.dist; play.update(0.25, E); const slowV = (S.dist - a) / 0.25, v = T.beltSpeed[6] * T.tune.belt;
    check(tr.swat && slowV < v * 0.5, `the SWAT beat should slow the belt (${f1(slowV)} against ${f1(v)} units/s)`);
    console.log(`SWAT: a body gun caught on the scan calls SWAT (bonus ${tr.swat && tr.swat.pts}); belt ${f1(slowV)} units/s in the beat against ${f1(v)}; a missed bag gun ends the day at once: ${breachOk}`);
    shown = true;
  }
  check(shown, 'no body-gun traveller reached the scan on day 7');
}

// ---------- 5. human models ----------
// v0.2 (checkpoint-v8, before amendment J) on the same seeds and models: cleared and breach percent per day, 40 seeds a cell.
const V02 = {
  average: { clear: [95, 98, 98, 90, 78, 83, 78, 73, 83, 70], breach: [0, 0, 0, 0, 0, 0, 10, 3, 0, 0] },
  novice: { clear: [75, 73, 78, 60, 10, 33, 23, 5, 10, 15], breach: [0, 0, 0, 3, 0, 0, 10, 8, 10, 18] },
};
let table = null, ba = null;
if (humanPromise) {
  table = await humanPromise;
  console.log(`\nHuman models, ${HUMANSEEDS} seeds per cell. Cleared / three stars / breach, percent (mean strikes: missed + false alarms)`);
  for (const m of Object.keys(table)) {
    const p = MODELS[m];
    console.log(` ${m} (read ${p.base} + ${p.perItem}/item, gap ${p.gap}; lane: react ${p.react}, find ${p.scanBase} + ${p.scanPer}/item, body mistake ${p.pConfBody})`);
    console.log('   day   cleared  three stars  breach  strikes (missed + false)  swat  mean length');
    table[m].forEach((c, i) => c && console.log(`   ${pad(i + 1, 3)}   ${pad(Math.round((100 * c.clear) / c.n) + '%', 6)}   ${pad(Math.round((100 * c.three) / c.n) + '%', 10)}  ${pad(Math.round((100 * c.breach) / c.n) + '%', 6)}   ${pad(f2(c.strikes / c.n), 6)} (${f2(c.miss / c.n)} + ${f2(c.fa / c.n)})          ${pad(f1(c.swat / c.n), 4)}  ${pad(f1(mean(c.time)) + ' s', 7)}`));
  }
  const rate = (m, shift, k) => (table[m] && table[m][shift - 1] ? table[m][shift - 1][k] / table[m][shift - 1].n : NaN);
  if (table.average && table.novice) {
    const pct = (m, i, k) => Math.round((100 * table[m][i][k]) / table[m][i].n), sg = (v) => (v > 0 ? `+${v}` : String(v));
    console.log('\nClear and breach rates by day, v0.2 (checkpoint-v8) before amendment J and now, same seeds, percent');
    console.log('       average reader                              novice reader');
    console.log('  day  clear before  now  change  breach before  now   clear before  now  change  breach before  now');
    const sums = { average: [0, 0], novice: [0, 0] };
    for (let i = 0; i < SHIFTS; i++) {
      const row = ['average', 'novice'].map((m) => { const c = pct(m, i, 'clear'), b = pct(m, i, 'breach'); sums[m][0] += c - V02[m].clear[i]; sums[m][1] += b - V02[m].breach[i]; return `${pad(V02[m].clear[i], 11)} ${pad(c, 4)}  ${pad(sg(c - V02[m].clear[i]), 5)}  ${pad(V02[m].breach[i], 12)} ${pad(b, 4)}`; });
      console.log(`  ${pad(i + 1, 3)}  ${row.join('   ')}`);
    }
    const dm = (m) => sums[m][0] / SHIFTS, db = (m) => sums[m][1] / SHIFTS;
    console.log(`  mean change over the ten days: average clear ${sg(+f1(dm('average')))} points, breach ${sg(+f1(db('average')))}; novice clear ${sg(+f1(dm('novice')))}, breach ${sg(+f1(db('novice')))}`);
    check(dm('average') >= 5 && dm('novice') >= 5, `the detector should make the days visibly easier than v0.2 (mean clear change average ${f1(dm('average'))}, novice ${f1(dm('novice'))}; needs at least 5)`);
    const worse = Array.from({ length: SHIFTS }, (_, i) => [i + 1, pct('average', i, 'clear') - V02.average.clear[i]]).filter(([, d]) => d < -5);
    check(!worse.length, `no day should get clearly harder for the average reader: ${worse.map(([d, v]) => `day ${d} ${v}`).join(', ')}`);
    ba = { avg: dm('average'), nov: dm('novice'), avgBreach: db('average'), novBreach: db('novice') };
  }
  if (args.includes('--curve-only')) { console.log(`average clears: ${Array.from({ length: SHIFTS }, (_, i) => Math.round(100 * rate('average', i + 1, 'clear'))).join(' ')}`); process.exit(0); }
  gate('H3', 'A first-timer clears day 1 (average reader, at least 60 percent)', `average reader clears day 1 ${Math.round(100 * rate('average', 1, 'clear'))} percent, novice ${Math.round(100 * rate('novice', 1, 'clear'))}`, rate('average', 1, 'clear') >= 0.6);
  const low = [];
  for (let shift = 2; shift <= SHIFTS; shift++) if (rate('average', shift, 'clear') < 0.6) low.push(`${shift}: ${Math.round(100 * rate('average', shift, 'clear'))}%`);
  check(!low.length, `days 2 to 10 should stay clearable by the average reader (60 percent): ${low.join(', ')}`);
  console.log(`  days 2 to 10, average reader clears: ${Array.from({ length: SHIFTS - 1 }, (_, i) => Math.round(100 * rate('average', i + 2, 'clear')) + '%').join(' ')}`);
}

// ---------- 6. render ----------
console.log('\nRender');
{
  // No red before the first strike in a never-tap shift.
  E = makeE(); play.enter(E, { shift: 4, seed: hashString('checkpoint-cue') });
  const S = sim.state();
  let redBefore = 0, frames = 0;
  while (!E.scene && frames < 60 * 200 && S.misses === 0) { play.update(1 / 60, E); frames++; E.time += 1 / 60; if (S.misses === 0 && frames % 3 === 0 && recordRender(E).some((r) => RED.test(r.c))) redBefore++; }
  check(S.misses >= 1 && redBefore === 0, `red was drawn ${redBefore} frames before the first strike`);
  // Materials alone decide a part's look: paint every item and check each part's fill and edge.
  const fills = new Set(Object.values(T.mats).map((m) => m.fill)), bad = [];
  for (const i of sim.ITEMS) for (const [m] of i.parts) if (!T.mats[m]) bad.push(`${i.name}:${m}`);
  check(!bad.length && fills.size === Object.keys(T.mats).length, `unknown materials: ${bad.join(', ')}`);
  // Text sizes on every screen (H6): play mid-shift with a scan, a SWAT and a ghost; the menu; every day card; each end card.
  const sizes = [];
  const grab = (log) => { for (const r of log) if (r.text !== undefined) sizes.push({ s: r.size, t: r.text }); };
  const r1 = run(7, 5, 60, fastBot(true, 0.3), null, makeE(), (St, e) => { if (Math.round(St.time * 60) % 30 === 0) grab(recordRender(e)); });
  const m = game.scenes.menu, br = game.scenes.brief, ov = game.scenes.over, e2 = makeE();
  m.enter(e2); grab(recordRender(e2, m));
  for (let d = 1; d <= SHIFTS; d++) { br.enter(e2, { shift: d }); for (let i = 0; i < 300 && !(sim.prepare(d, br.seed).ready); i++) br.update(1 / 60, e2); grab(recordRender(e2, br)); }
  for (const res of ['clear', 'over', 'breach']) { e2.time = 0; ov.enter(e2, { ...r1.r, result: res, breachItem: 'gun', swats: res === 'clear' ? 1 : 0 }); e2.time = 3; grab(recordRender(e2, ov)); }
  const minS = sizes.reduce((a, b) => (a.s <= b.s ? a : b));
  gate('H6', 'Text 14 px, targets 44 px, smoke passes', `smallest text ${minS.s} px ("${minS.t}") over ${sizes.length} draws on play, menu, ten day cards and three front pages; ${hitOk ? 'every' : 'NOT every'} hit target at least 44 px at 360x640 and 390x844`, minS.s >= 14 && hitOk);
  const heads = ['clear', 'over', 'breach'].map((res) => sim.headline({ ...r1.r, result: res, breachItem: 'gun', swats: 0, vic: false, stars: 3 }).lines.join(' '));
  console.log(`  no red before the first strike (${frames} frames); materials ${Object.keys(T.mats).join('/')}; headlines: ${heads.join(' | ')}`);
}

// ---------- 7. determinism, saves, misc ----------
console.log('\nDeterminism: same seed and tap times at 30, 60 and 120 fps (lever pulls, body taps, SWAT, stray taps)');
{
  const rows = [];
  for (const shift of [1, 5, 7, 10]) {
    const seed = hashString(`checkpoint-det-${shift}`), stray = makeRng(seed ^ 0x9e3779b9), bot = fastBot(false, 0.25);
    const base = run(shift, seed, 30, (E, t) => {
      const taps = bot(E, t);
      if (stray.chance(0.004)) taps.push({ x: stray.range(20, E.w - 20), y: stray.range(80, E.h - 20) });
      if (stray.chance(0.006)) { const lv = sim.lever(E); taps.push({ x: lv.x, y: lv.y }); }
      return taps;
    });
    const res = [30, 60, 120].map((fps) => ({ fps, ...run(shift, seed, fps, null, base.taps) }));
    const ref = res[0], same = res.every((r) => r.S.score === ref.S.score && r.S.strikes === ref.S.strikes && r.S.log === ref.S.log && r.r.result === ref.r.result);
    const lever = (ref.S.log.match(/lever/g) || []).length, swat = (ref.S.log.match(/"swat"/g) || []).length, body = (ref.S.log.match(/"body":true/g) || []).length;
    rows.push({ shift, same, lever, swat, body, res });
    console.log(`  day ${shift}: ${base.taps.length} taps (${lever} lever pulls, ${body} body catches, ${swat} SWAT)  ${res.map((r) => `${r.fps} fps ${r.S.score}/${r.S.strikes} ${r.r.result}`).join('  |  ')}`);
  }
  gate('H1', 'Deterministic at 30, 60 and 120 fps; setup randomness only', `${rows.filter((r) => r.same).length} of ${rows.length} days identical at all three rates (score, strikes, event log), with ${rows.reduce((a, r) => a + r.lever, 0)} lever pulls, ${rows.reduce((a, r) => a + r.body, 0)} body catches and ${rows.reduce((a, r) => a + r.swat, 0)} SWAT calls`, rows.every((r) => r.same) && rows.some((r) => r.swat > 0) && rows.some((r) => r.lever > 0));
}
{
  // Saves: v1, v2 and v3 saves migrate to v4, keeping stars, best scores of cleared days and unlocked days; a best on a day never cleared
  // (saved by a breach or three strikes) is cleaned; malformed records read as empty.
  const v2 = { shifts: { 1: { best: 4200, stars: 3 }, 2: { best: 900, stars: 1 }, 3: { best: 50, stars: 0 } }, unlocked: 3 };
  const v3 = { shifts: { 1: { best: 4200, stars: 3 }, 2: { best: 1500, stars: 2 }, 4: { best: 6100, stars: 0 } }, unlocked: 3, career: { swats: 2, vic: 1, breaches: 3 } };
  const m2 = game.migrate(JSON.parse(JSON.stringify(v2)), 2), m3 = game.migrate(JSON.parse(JSON.stringify(v3)), 3), m1 = game.migrate({ shifts: { 1: { best: 10, stars: 2 }, 4: { best: 77, stars: 1 } }, unlocked: 999 }, 1);
  const e = makeE(); e.save.d = m3;
  const sh = sim.readShifts(e);
  const kept = sh[1].best === 4200 && sh[1].stars === 3 && sh[2].best === 1500 && sh[2].stars === 2 && m3.unlocked === 3 && m3.career.swats === 2 && m3.career.breaches === 3;
  const cleaned = m3.shifts[4].best === 0 && m3.shifts[4].stars === 0 && m2.shifts[3].best === 0 && m2.shifts[1].best === 4200 && m2.shifts[2].best === 900;
  const ok = game.saveVersion === 4 && kept && cleaned && m2.unlocked === 3 && m2.career && m2.career.swats === 0 && m1.unlocked === 5 && m1.shifts[4].best === 77 && m1.career.vic === 0;
  const menu = game.scenes.menu; menu.enter(e); recordRender(e, menu);
  const open = menu.cells.filter((c) => c.open).map((c) => c.shift).join(',');
  const bad = [null, 'x', 7, [], { a: 1 }, { 1: null }, { 2: { best: 'a', stars: 9 } }];
  const hardened = bad.every((v) => { try { const c = sim.cleanShifts(v); return Object.values(c).every((r) => Number.isFinite(r.best) && r.stars >= 0 && r.stars <= 3); } catch { return false; } }) && sim.cleanCareer('x').swats === 0;
  gate('H5', 'Saves migrate (stars, best scores, unlocked kept)', `saveVersion 4; a v3 save keeps day 1 4200/3 stars, day 2 1500/2 stars, unlocked 3 (menu opens days ${open}) and its career, and loses only the best of a day never cleared (day 4: 6100 with no stars becomes none); a v2 save likewise gains a career record; a v1 save unlocks one past its highest starred day; malformed saves read as empty`, ok && open === '1,2,3' && hardened);
  // Recording a result keeps the best, unlocks the next day and counts SWAT calls in the career.
  const e3 = makeE(); e3.save.d = game.migrate(JSON.parse(JSON.stringify(v2)), 2);
  const r = run(3, seedOf('save', 3, 0), 60, fastBot(false), null, e3);
  check(r.r.result === 'clear' && e3.save.get('unlocked') === 4 && sim.readShifts(e3)[1].best === 4200 && e3.save.get('career').swats === r.r.swats, 'clearing day 3 on a migrated save should unlock day 4 and keep day 1');
}
{
  // Rush bursts, retry seed, ledger, lever toggling.
  for (const shift of [4, 5, 10]) {
    E = makeE(); play.enter(E, { shift, seed: 3 });
    const S = sim.state(), gaps = S.bags.slice(1).map((b, i) => S.bags[i].y0 - b.y0 - T.bagH);
    check(Math.abs(mean(gaps) - T.bagGap) < 4, `day ${shift}: average gap ${f1(mean(gaps))}`);
  }
  const e = makeE(), r = run(4, seedOf('ledger', 4, 0), 60, fastBot(true), null, e), rec = e.ledger.entries.find((x) => x.k === 'shift');
  const need = ['shift', 'seed', 'result', 'score', 'strikes', 'missed', 'falseAlarms', 'stars', 'catches', 'swats', 'bodyCatches', 'bodyMisses', 'lever', 'breach', 'missedItems', 'falseItems', 'occlusion'];
  check(rec && need.every((f) => f in rec.d), `the shift ledger entry needs ${need.join(', ')}`);
  check(rec.d.lever > 0.9, `a lever-down shift should log its lever share (${rec.d.lever})`);
  E = makeE(); play.enter(E, { shift: 3, seed: 5 }); const lv = sim.lever(E); play.onPointerDown(lv, E); const on = sim.state().lever; play.onPointerDown(lv, E);
  check(on && !sim.state().lever, 'the lever toggles on a tap');
  const ex = game.experiments, ps = game.presets;
  check(ex.length <= 4 && ps.length === 2 && ps.map((p) => p.label).join() === 'Calm,Rush hour', 'TUNE: at most four sliders and the Calm and Rush hour presets');
  console.log(`Misc: rush gaps average ${T.bagGap}; ledger shift entry has ${Object.keys(rec.d).length} fields (lever share ${rec.d.lever}); TUNE ${ex.map((x) => x.label).join(', ')}; presets ${ps.map((p) => `${p.label} ${JSON.stringify(p.values)}`).join(' ')}`);
  // Shift lengths at both sizes.
  const lens = [];
  for (let shift = 1; shift <= SHIFTS; shift++) { const rr = run(shift, seedOf('len', shift, 0), 60, fastBot(false), null, makeE(390, 844)); lens.push(rr.time); }
  check(lens.every((t) => t >= 40 && t <= 150), `day lengths ${lens.map((t) => f1(t)).join(', ')} s`);
  console.log(`Day lengths at 390x844 (fast reader): ${lens.map((t) => Math.round(t) + ' s').join(', ')}`);
}

// ---------- 8. amendment J: the detector decides whom to check ----------
console.log('\nAmendment J: the detector decides whom to check');
{
  // J1/J2: who beeps, by day, from the real generator (40 seeds a day).
  console.log(' day  beepShare  beepers/day  harmless-metal beepers  body contraband/day  carriers who beep');
  let exact = true, consistent = true, carriersBeep = true, mostHarmless = true;
  const shares = [];
  for (let shift = 1; shift <= SHIFTS; shift++) {
    let beepers = 0, harmless = 0, carriers = 0, carrierBeeps = 0;
    const K = 40;
    for (let k = 0; k < K; k++) {
      const g = sim.genShift(seedOf('beep', shift, k), shift);
      const day = g.travellers.filter((t) => t.beeps).length, castBeep = g.travellers.filter((t) => t.who && t.beeps).length;
      exact = exact && day === Math.max(Math.round(T.beepShare[shift - 1] * T.bagsPerShift), castBeep);
      for (const t of g.travellers) {
        const metal = t.body.some((b) => b.def.metal), con = t.body.some((b) => b.contraband);
        consistent = consistent && t.beeps === metal && (t.beeps || t.body.length === 0) && (!t.beeps || t.body.some((b) => b.def.metal));
        if (t.beeps) { beepers++; if (!con) harmless++; }
        if (con) { carriers++; if (t.beeps) carrierBeeps++; }
      }
    }
    carriersBeep = carriersBeep && carrierBeeps === carriers;
    mostHarmless = mostHarmless && harmless / beepers >= 0.6;
    shares.push(beepers / (K * T.bagsPerShift));
    console.log(`${pad(shift, 4)}  ${pad(f2(beepers / (K * T.bagsPerShift)), 9)}  ${pad(f1(beepers / K), 11)}  ${pad(f2(harmless / beepers), 22)}  ${pad(f1(carriers / K), 19)}  ${pad(`${carrierBeeps}/${carriers}`, 8)}`);
  }
  check(exact, 'each day should have exactly beepShare x travellers beepers (or the cast beepers, if more)');
  check(consistent, 'a traveller beeps exactly when they carry metal on the body, and carries no body items otherwise');
  check(carriersBeep, 'every traveller with body contraband must beep (body contraband is always metal)');
  check(mostHarmless, 'most beepers should carry only harmless metal (at least 60 percent each day)');
  const rising = shares.every((v, i) => i === 0 || v >= shares[i - 1] - 0.005) && shares[SHIFTS - 1] > shares[0] + 0.1;
  check(shares[0] >= 0.3 && shares[0] <= 0.37 && rising, `beepShare should be about a third on day 1 and rise (${shares.map(f2).join(' ')})`);
  gate('J1', 'Only metal sets off the arch: a beep and an amber flash, then the scan; the rest pass on green, unscanned (J1, J2)', `day 1 ${f2(shares[0])} of travellers beep, rising to ${f2(shares[SHIFTS - 1])} on day 10; beepers are exactly the travellers with metal on the body; body contraband always beeps; at least 60 percent of beepers carry only harmless metal each day`, exact && consistent && carriersBeep && mostHarmless && shares[0] >= 0.3 && shares[0] <= 0.37 && rising);
}
{
  // J4: every beep has both the sound and the arch light; no scan is drawn for a traveller who did not beep. Real shifts, frame by frame, with
  // the play scene rendered on a recording canvas while somebody stands in the arch.
  const BEEP = T.juice.tones.beep, st = { beepers: 0, clean: 0, sound: 0, lightAmber: 0, scanDrawn: 0, cleanQuiet: 0, cleanGreen: 0, cleanNoScan: 0, leak: 0, stray: 0, checked: 0 };
  for (const [shift, k] of [[1, 0], [1, 1], [3, 0], [5, 0], [7, 0], [7, 1], [10, 0]]) {
    let prevN = 0;
    const seen = new Map();
    run(shift, seedOf('arch', shift, k), 60, fastBot(false, 0.2), null, makeE(), (S, e) => {
      const fresh = e.beeps.slice(prevN).filter((b) => b.type === 'square' && BEEP.some((t) => t.freq === b.freq)); prevN = e.beeps.length;
      for (const t of S.travellers) if (!t.beeps && sim.scanAlpha(t) > 0) st.leak++;
      const entering = S.travellers.filter((t) => t.state === 'scan' && !seen.has(t.idx));
      if (!entering.length) st.stray += fresh.length;
      for (const t of entering) {
        seen.set(t.idx, { beeps: t.beeps, amber: 0, screen: 0, green: 0, n: 0 });
        if (t.beeps) { st.beepers++; if (fresh.length === BEEP.length && fresh.every((b, i) => b.freq === BEEP[i].freq) && S.lamp.kind === 'beep') st.sound++; }
        else { st.clean++; if (fresh.length === 0 && S.lamp.kind === 'clear') st.cleanQuiet++; }
      }
      const inArch = S.travellers.find((t) => t.state === 'scan' && !t.swat);
      if (!inArch || Math.round(S.time * 60) % 3 !== 0) return;
      const rec = seen.get(inArch.idx), log = recordRender(e);
      rec.n++;
      if (log.some((r) => r.c === T.palette.lampAmber)) rec.amber++;
      if (log.some((r) => r.c === T.palette.lampGreen)) rec.green++;
      if (log.some((r) => r.kind === 'fillRect' && r.c === T.palette.screen)) rec.screen++;
      if (!inArch.beeps && S.travellers.every((t) => sim.scanAlpha(t) === 0) && log.some((r) => r.kind === 'fillRect' && r.c === T.palette.screen)) st.leak++;
      st.checked++;
      rec.done = true;
    });
    for (const rec of seen.values()) {
      if (rec.n < 3) continue;
      if (rec.beeps) { if (rec.amber > 0) st.lightAmber++; if (rec.screen > 0) st.scanDrawn++; if (rec.green) st.leak++; }
      else { if (rec.green > 0) st.cleanGreen++; if (!rec.amber && !rec.screen) st.cleanNoScan++; }
    }
  }
  const okJ4 = st.beepers > 0 && st.clean > 0 && st.sound === st.beepers && st.lightAmber >= st.beepers - 2 && st.scanDrawn >= st.beepers - 2 && st.cleanQuiet === st.clean && st.cleanGreen >= st.clean - 2 && st.cleanNoScan >= st.clean - 2 && st.leak === 0 && st.stray === 0;
  console.log(`  arch, ${st.beepers} beepers and ${st.clean} others over 7 shifts: two-tone beep on ${st.sound}/${st.beepers} beepers, amber flash on ${st.lightAmber}, body scan drawn for ${st.scanDrawn}; green light and no scan, no sound for the others on ${st.cleanGreen}/${st.cleanNoScan}/${st.cleanQuiet} of ${st.clean}; ${st.leak} scan or light leaks, ${st.stray} stray beeps (${st.checked} frames rendered)`);
  gate('J4', 'No body scan for a traveller who did not beep; every beep has the sound and the arch light', `${st.beepers} beepers each got both beep tones on arrival (${st.sound}) and an amber arch light with the scan (${st.lightAmber}, ${st.scanDrawn}); ${st.clean} others walked through on green with no scan and no sound (${st.cleanGreen}, ${st.cleanNoScan}, ${st.cleanQuiet}); ${st.leak} leaks over ${st.checked} rendered frames`, okJ4);
}
{
  // J3: the queued fixes.
  const skipGun = () => { const base = fastBot(false); return (E, t) => base(E, t).filter((p) => !sim.onScreen(E).some((i) => i.name === 'gun' && Math.abs(i.x - p.x) < 1 && Math.abs(i.y - p.y) < 1)); };
  const ov = game.scenes.over, texts = (r, e) => { ov.enter(e, r); e.time = 3; return recordRender(e, ov).filter((x) => x.text !== undefined).map((x) => x.text); };
  const res = { breach: null, over: null };
  for (let k = 0; k < 30 && !(res.breach && res.over); k++) {
    const seed = seedOf('best', 1, k);
    if (!res.breach && sim.genShift(seed, 1).bags.some((b) => b.items.some((i) => i.name === 'gun'))) { const e = makeE(); e.save.d = { shifts: { 1: { best: 500, stars: 2 } } }; const r = run(1, seed, 60, skipGun(), null, e); if (r.r.result === 'breach') res.breach = { r, e, seed }; }
    if (!res.over) { const e = makeE(); e.save.d = { shifts: { 1: { best: 500, stars: 2 } } }; const r = run(1, seed, 60, tapAllBot(), null, e); if (r.r.result === 'over') res.over = { r, e }; }
  }
  // (a) bests count only on a cleared day
  const fresh = makeE(), clear = run(1, seedOf('best', 1, 0), 60, fastBot(false), null, fresh), clearTexts = texts(clear.r, makeE());
  let bestOk = !!(res.breach && res.over);
  const detail = [];
  for (const [name, x] of Object.entries(res)) if (x) {
    const t = texts(x.r.r, makeE()), saved = sim.readShifts(x.e)[1];
    const good = x.r.r.isNew === false && x.r.r.best === 500 && saved.best === 500 && saved.stars === 2 && !t.includes('New best') && t.includes('Best 500');
    detail.push(`${name} ${x.r.r.score} points: best stays ${saved.best}, card "${t.find((s) => /best/i.test(s))}"`);
    bestOk = bestOk && good;
  }
  const noBest = makeE(); noBest.save.d = {};
  const b0 = res.breach && run(1, res.breach.seed, 60, skipGun(), null, noBest);
  const t0 = b0 ? texts(b0.r, makeE()) : [];
  bestOk = bestOk && !!b0 && b0.r.isNew === false && sim.readShifts(noBest)[1].best === 0 && t0.includes('No best yet') && !t0.includes('New best') && clear.r.isNew === true && clearTexts.includes('New best') && sim.readShifts(fresh)[1].best === clear.r.score;
  check(bestOk, `bests count only on cleared days: ${detail.join('; ')}; a clear shows "${clearTexts.find((s) => /best/i.test(s))}", a day never cleared "${t0.find((s) => /best/i.test(s))}"`);
  console.log(`  bests: ${detail.join('; ')}; first-ever breach shows "${t0.find((s) => /best/i.test(s))}", a clear shows "${clearTexts.find((s) => /best/i.test(s))}"`);

  // (b) the SWAT cap: a day's SWAT bonuses together stay near a third of a good day's score, and the table is the measured good day
  console.log(' day  good day (table / measured)  SWAT share of its own day (mean, max)  of the good day (max)  cap per day');
  let capOk = true;
  for (let i = 0; i < SHIFTS; i++) {
    const cap = Math.round(T.swat.capShare * T.goodDay[i]), off = Math.abs(T.goodDay[i] - fastScores[i]) / fastScores[i];
    const row = swatShare[i];
    capOk = capOk && off <= 0.15 && row.good <= T.swat.capShare + 0.04 && row.mean <= T.swat.capShare + 0.03;
    console.log(`${pad(i + 1, 4)}  ${pad(T.goodDay[i], 8)} / ${pad(Math.round(fastScores[i]), 6)}${pad(`${Math.round(100 * off)}%`, 6)}  ${pad(f2(row.mean), 22)}, ${f2(row.max)}  ${pad(f2(row.good), 21)}  ${pad(cap, 6)}`);
  }
  check(capOk, 'the SWAT cap: the goodDay table should match the measured fast-reader day within 15 percent, and a day\'s SWAT bonuses stay within a third (plus slack) of a good day');

  // (c) a missed body critical ends the day as the traveller leaves the arch area, seconds before they would leave the lane
  let arch = null;
  for (let k = 0; k < 40 && !arch; k++) {
    const seed = seedOf('arch-gun', 7, k), g = sim.genShift(seed, 7), gi = g.travellers.findIndex((t) => t.body.some((b) => b.tier === 3));
    if (gi < 0) continue;
    const policy = () => { const base = fastBot(false, 0.2); return (E, t) => base(E, t).filter((p) => !sim.lane(E).some((o) => o.idx === gi && o.items && o.items.some((i) => i.tier === 3 && Math.abs(i.x - p.x) < 1 && Math.abs(i.y - p.y) < 1))); };
    let at = null;
    const watch = (S) => { if (S.ended === 'breach' && !at) { const tr = S.travellers[gi]; at = { state: tr.state, y: tr.y, t: S.time, archDone: tr.archDone, tr }; } };
    const r = run(7, seed, 60, policy(), null, makeE(), watch);
    if (r.r.result !== 'breach' || !at || !at.archDone || r.state.bodyMisses < 1) continue;
    const keep = T.travel.archExit; T.travel.archExit = 1e9;
    const old = run(7, seed, 60, policy(), null, makeE());
    T.travel.archExit = keep;
    arch = { at, laneT: old.time, state: at.state, y: at.y, past: at.y - sim.layout(makeE()).boothBot, sooner: old.time - at.t, item: r.r.breachItem, oldResult: old.r.result };
  }
  const archOk = !!arch && arch.state === 'walkOut' && arch.past >= T.travel.archExit - 1e-6 && arch.past < T.travel.archExit + 3 && arch.sooner >= 0.5 && arch.oldResult === 'breach';
  check(archOk, `a missed body critical should end the day when the traveller leaves the arch area (${arch ? `${arch.state}, ${f1(arch.past)} units past the arch, ${f1(arch.sooner)} s sooner than at the lane exit` : 'no seed found'})`);
  if (arch) console.log(`  a missed body gun ended the day with the traveller ${f1(arch.past)} units past the arch, still walking out, at ${f1(arch.at.t)} s: ${f1(arch.sooner)} s before the lane exit would have`);

  // (d) the lighter: a body, a metal hood and jet, and a big toothed flint wheel that stands proud of the body (a gear on a stick, not a bottle)
  const lt = sim.ITEMS.find((i) => i.name === 'lighter'), wheel = lt.shape[3], body = lt.shape[0], xs = (poly) => poly.map((q) => q[0]);
  const raster = (item) => { const cells = new Set(), pts = item.shape.flat(), x0 = Math.min(...pts.map((q) => q[0])), x1 = Math.max(...pts.map((q) => q[0])), y0 = Math.min(...pts.map((q) => q[1])), y1 = Math.max(...pts.map((q) => q[1])), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) if (item.shape.some((p) => inPoly(x, y, p))) cells.add(`${Math.round(x - cx)},${Math.round(y - cy)}`); return cells; };
  const apart = (a, b) => { let n = 0; for (const c of a) if (b.has(c)) n++; return 1 - n / a.size; };   // share of the lighter's silhouette that the look-alike does not cover
  const rl = raster(lt), looks = sim.ITEMS.filter((i) => i.confusable === 'lighter').map((i) => [i.name, apart(rl, raster(i))]);
  const lighterOk = wheel.length >= 14 && Math.max(...xs(wheel)) > Math.max(...xs(body)) + 2 && lt.tell.includes(2) && lt.tell.includes(3) && lt.size >= 50 && looks.every(([, v]) => v >= 0.2) && lt.mats.includes('organic');
  const pl = sim.BODY.find((b) => b.name === 'pocket lighter');
  check(lighterOk && pl.parts.some(([, poly]) => poly.length >= 12), `the lighter should have a toothed wheel standing proud of its body and differ from its look-alikes (silhouette not covered by ${looks.map(([n, v]) => `${n} ${f2(v)}`).join(', ')})`);
  console.log(`  lighter: wheel with ${wheel.length / 2} teeth standing ${f1(Math.max(...xs(wheel)) - Math.max(...xs(body)))} units proud of the body, hood and wheel are the tell, fuel shows in the body, ${f1(lt.size)} units tall; silhouette not covered by the look-alikes: ${looks.map(([n, v]) => `${n} ${f2(v)}`).join(', ')}`);

  // (e) the banner stays in the hood strip, clear of the belt's top band, at several phone sizes, at its largest
  const sizes = [[360, 640], [390, 844], [412, 915], [320, 568]], bad = [];
  for (const [w, h] of sizes) {
    const e = makeE(w, h); e.safe = { top: 47, bottom: 34, left: 0, right: 0 };
    const L = sim.layout(e), b = sim.bannerSpot(L), top = b.y - b.size / 2 - 6, bot = b.y + b.size / 2 + 6;
    if (top < L.hud - 1e-6 || bot > L.top + 1e-6) bad.push(`${w}x${h}: ${f1(top)} to ${f1(bot)} against hood ${f1(L.hud)} to ${f1(L.top)}`);
  }
  check(!bad.length, `the banner should sit inside the hood strip: ${bad.join('; ')}`);
  console.log(`  banner: inside the ${T.hoodH} px hood strip above the belt at ${sizes.map(([w, h]) => `${w}x${h}`).join(', ')}, never over the top band where bags enter`);
  gate('J3', 'Queued fixes: bests only on cleared days, SWAT cap, body critical ends the day at the arch, lighter redrawn, banner off the belt', `bests ${bestOk ? 'only count on a clear (a breach and three strikes keep the old best and show no "New best")' : 'WRONG'}; SWAT per day at most ${f2(Math.max(...swatShare.map((x) => x.good)))} of a good day (cap ${T.swat.capShare}); a missed body gun ends the day ${arch ? f1(arch.sooner) : '?'} s sooner, at the arch; lighter wheel ${wheel.length / 2} teeth proud of the body; banner in the hood at four phone sizes`, bestOk && capOk && archOk && lighterOk && !bad.length);
}

// ---------- the table: H plus J ----------
console.log('\nMust-holds: PRD v0.2 section H and amendment J (J4 gate)');
console.log(' id  holds  result');
// H4 needs a browser, so it is measured outside this script (Playwright, Chromium, 4x CPU throttle, DPR 3, 390x844, day 10 with no taps, 4 runs of 8 s,
// dev build against release/games/checkpoint, 2026-10-02) and recorded here.
const H4 = 'Frame time at 4x throttle within 10 percent of v0.1 (measured in Chromium, not by this script): day 10, 4 runs of 8 s against the release copy of v0.1: mean -1.4 percent, median -0.1, p95 0.0 (frames land on 16.7 or 33.3 ms steps); fewer scans are drawn than in v0.2';
for (const id of ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'J1', 'J3', 'J4']) { const h = H[id]; console.log(` ${id}  ${h ? (h.ok ? 'yes  ' : 'NO   ') : id === 'H4' ? 'yes  ' : '-    '}  ${h ? `${h.what}: ${h.result}` : id === 'H4' ? H4 : 'not run'}`); }
console.log(failed ? `\n${failed} check${failed > 1 ? 's' : ''} FAILED` : '\nall checks passed');
process.exit(failed ? 1 : 0);
