#!/usr/bin/env node
// sim-checkpoint: proofs for Checkpoint v0.2 through the game's real generation, lane, tap resolution, scoring and render calls
// (games/checkpoint/src/game.js, via game.sim and the play scene). The H section of PRD v0.2 is the gate; it ends with one table.
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
// 7. Determinism at 30, 60 and 120 fps with lever pulls, body taps and SWAT (H1); save migration v1 and v2 to v3 (H5); misc.
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
const BAGS = opt('--bags', 300), SEEDS = opt('--seeds', 8), FAILSEEDS = opt('--fail-seeds', 4), HUMANSEEDS = opt('--human-seeds', 40), SHIFTS = T.beltSpeed.length;
let failed = 0;
const H = {};   // the H table: id -> { what, result, ok }
const gate = (id, what, result, ok) => { H[id] = H[id] ? { what, result: `${H[id].result}; ${result}`, ok: H[id].ok && ok } : { what, result, ok }; if (!ok) { failed++; console.log(`  FAIL H${id}: ${result}`); } };
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
// The lane interrupts: when a scan opens the reader glances after `react` s (unless absorbed, pMissScan) and finds each contraband item after
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
      if (tr.state !== 'scan' || scans.has(tr.idx)) continue;
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
if (BAGS > 0) gate(2, 'Fair: tells readable, body items shown for scanShow, no critical item without a readable tell', `bag contraband tells at least ${f3(tellMin)} readable (needs ${T.tellVis}) over ${tellN} items; criticals ${f3(critTellMin)} over ${critN}`, tellMin >= T.tellVis - 0.02 && critTellMin >= T.tellVis - 0.02);

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
  gate(2, 'Fair', `every body scan showed at least ${f2(minShow)} s (scanShow ${T.scanShow}) over ${scans} scans with the lever down and SWAT slow-motion, ${under} short; body items never share a slot (${critTells.length} body guns, each drawn alone in its slot)`, under === 0 && minShow >= T.scanShow - 1e-6 && slots);
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
const fastScores = [], leverScores = [];
for (let shift = 1; shift <= SHIFTS; shift++) {
  let three = 0, threeL = 0, sc = [], scL = [], swats = 0;
  const fails = { none: 0, all: 0, pulse: 0 }, breaches = { none: 0 };
  for (let k = 0; k < SEEDS; k++) {
    const seed = seedOf('bot', shift, k);
    const a = run(shift, seed, 60, fastBot(false)), b = run(shift, seed, 60, fastBot(true));
    if (a.r.result === 'clear' && a.r.stars === 3) three++;
    if (b.r.result === 'clear' && b.r.stars === 3) threeL++;
    check(a.r.result === 'clear' && a.r.stars === 3, `day ${shift} seed ${seed}: the fast reader got ${a.r.result} ${a.r.stars} stars (${a.r.misses} missed, ${a.r.falseAlarms} false)`);
    check(b.r.result === 'clear', `day ${shift} seed ${seed}: the fast reader with the lever got ${b.r.result}`);
    sc.push(a.r.score); scL.push(b.r.score); swats += a.r.swats;
    if (k >= FAILSEEDS) continue;
    const none = run(shift, seed, 60, () => []);
    if (none.r.result !== 'clear') fails.none++;
    if (none.r.result === 'breach') breaches.none++;
    if (run(shift, seed, 60, tapAllBot()).r.result !== 'clear') fails.all++;
    if (run(shift, seed, 60, pulseBot()).r.result !== 'clear') fails.pulse++;
  }
  const nf = Math.min(SEEDS, FAILSEEDS);
  for (const [name, v] of Object.entries(fails)) check(v === nf, `day ${shift}: the ${name} bot cleared ${nf - v} of ${nf}`);
  fastScores.push(mean(sc)); leverScores.push(mean(scL));
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
let table = null;
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
  if (args.includes('--curve-only')) { console.log(`average clears: ${Array.from({ length: SHIFTS }, (_, i) => Math.round(100 * rate('average', i + 1, 'clear'))).join(' ')}`); process.exit(0); }
  gate(3, 'A first-timer clears day 1 (average reader, at least 60 percent)', `average reader clears day 1 ${Math.round(100 * rate('average', 1, 'clear'))} percent, novice ${Math.round(100 * rate('novice', 1, 'clear'))}`, rate('average', 1, 'clear') >= 0.6);
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
  gate(6, 'Text 14 px, targets 44 px, smoke passes', `smallest text ${minS.s} px ("${minS.t}") over ${sizes.length} draws on play, menu, ten day cards and three front pages; ${hitOk ? 'every' : 'NOT every'} hit target at least 44 px at 360x640 and 390x844`, minS.s >= 14 && hitOk);
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
  gate(1, 'Deterministic at 30, 60 and 120 fps; setup randomness only', `${rows.filter((r) => r.same).length} of ${rows.length} days identical at all three rates (score, strikes, event log), with ${rows.reduce((a, r) => a + r.lever, 0)} lever pulls, ${rows.reduce((a, r) => a + r.body, 0)} body catches and ${rows.reduce((a, r) => a + r.swat, 0)} SWAT calls`, rows.every((r) => r.same) && rows.some((r) => r.swat > 0) && rows.some((r) => r.lever > 0));
}
{
  // Saves: v1 and v2 saves migrate to v3, keeping stars, best scores and unlocked days; malformed records read as empty.
  const v2 = { shifts: { 1: { best: 4200, stars: 3 }, 2: { best: 900, stars: 1 }, 3: { best: 50, stars: 0 } }, unlocked: 3 };
  const m2 = game.migrate(JSON.parse(JSON.stringify(v2)), 2), m1 = game.migrate({ shifts: { 1: { best: 10, stars: 2 }, 4: { best: 77, stars: 1 } }, unlocked: 999 }, 1);
  const e = makeE(); e.save.d = m2;
  const sh = sim.readShifts(e);
  const ok = game.saveVersion === 3 && sh[1].best === 4200 && sh[1].stars === 3 && sh[2].best === 900 && sh[2].stars === 1 && m2.unlocked === 3 && m2.career && m2.career.swats === 0 && m1.unlocked === 5 && m1.shifts[4].best === 77 && m1.career.vic === 0;
  const menu = game.scenes.menu; menu.enter(e); recordRender(e, menu);
  const open = menu.cells.filter((c) => c.open).map((c) => c.shift).join(',');
  const bad = [null, 'x', 7, [], { a: 1 }, { 1: null }, { 2: { best: 'a', stars: 9 } }];
  const hardened = bad.every((v) => { try { const c = sim.cleanShifts(v); return Object.values(c).every((r) => Number.isFinite(r.best) && r.stars >= 0 && r.stars <= 3); } catch { return false; } }) && sim.cleanCareer('x').swats === 0;
  gate(5, 'Saves migrate (stars, best scores, unlocked kept)', `saveVersion 3; a v2 save keeps day 1 4200/3 stars, day 2 900/1 star, unlocked 3 (menu opens days ${open}) and gains a career record; a v1 save unlocks one past its highest starred day; malformed saves read as empty`, ok && open === '1,2,3' && hardened);
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

// ---------- the H table ----------
console.log('\nH must-holds (PRD v0.2 H)');
console.log(' H  holds  result');
for (const id of [1, 2, 3, 4, 5, 6]) { const h = H[id]; console.log(` ${id}  ${h ? (h.ok ? 'yes  ' : 'NO   ') : '-    '}  ${h ? `${h.what}: ${h.result}` : id === 4 ? 'Frame time at 4x throttle: measured in Chromium against the release copy, not here (see the changelog)' : 'not run'}`); }
console.log(failed ? `\n${failed} check${failed > 1 ? 's' : ''} FAILED` : '\nall checks passed');
process.exit(failed ? 1 : 0);
