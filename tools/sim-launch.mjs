#!/usr/bin/env node
// sim-launch: fly Launch's real physics (games/launch/src/game.js, via game.sim) headlessly.
//
// v0.3 is a feel build (PRD v0.3, "feel first"): this harness proves only section F's must-holds. v0.2's rank, pacing,
// ladder and buy checks are retired with the needle and the teaching chunk; they come back with the balance pass.
//
// The launch has two beats (PRD v0.3 A): a tap `t1` seconds after the machine is ready locks the barrel at aimAngle(t1); a tap
// `t2` seconds after the lock fires with the zone the gauge (seeded per flight) reads. In flight there are three actions
// (B): boost (held, or a quick tap's burst), parachute (held), condense. Profiles:
//   careless  t1 and t2 uniform over a sweep; three to five random actions in the first ten seconds (taps, holds of 0.2 to
//             1 s, sails of 0.3 to 1.5 s, drops), as a first-timer mashes
//   good      a chosen barrel band; the gauge off the gold by Perfect to Good's half-width (Great or Good); at each rise and
//             each apex it reads the range finder for nothing, a drop, a sail or a boost (as the real arc would show them),
//             and takes the one that lands on a jelly, a geyser or a wafer, or else clears caramel, or else goes furthest;
//             it reacts 0.1 to 0.25 s late and holds 20 percent off
//
//   node tools/sim-launch.mjs --must [--seeds 200]      every F must-hold below that runs headlessly, in one table
//   node tools/sim-launch.mjs --fps [--seeds 20]        F1: two tap times and every gesture replayed at 30, 60, 120 fps and
//                                                     jittery frames: the same distance, steps and events
//   node tools/sim-launch.mjs --careless [--seeds 400]  F2: the careless profile reaches 500 m on at least 40 percent at base
//   node tools/sim-launch.mjs --stuck [--seeds 200]     F3: every flight of every profile, and of the stubborn ones (sail held
//                                                     to the end, boost held, a drop every arc, nothing), ends by stop speed
//                                                     or caramel before maxFlight
//   node tools/sim-launch.mjs --skim [--seeds 200]      F5: the good profile from under 30 degrees against over 50 on the same
//                                                     seeds and gauge: neither band wins more than about 60 percent
//   node tools/sim-launch.mjs --check [--seeds 500]     field fairness: a jelly before every caramel, none further apart than
//                                                     150 m; geysers from 2000 m, clouds from 3500 m, clear of birds
//   node tools/sim-launch.mjs --contrast                hero, jellies, caramel, birds, geysers, clouds against every place
//   node tools/sim-launch.mjs --fly ANGLE [--gauge V] [--seed N] [--profile good|careless|none]   one flight's event log
//   node tools/sim-launch.mjs --feel [--seeds 200]      information: distance, flight time, bounces, jellies per profile
//
// --set KEY=VALUE (repeatable, VALUE is JSON) tries a TUNING value; --preset Floaty|Punchy applies a TUNE preset first.
// Seeds are 1..N. Exit code 0 when every check run passes, 1 when one fails, 2 on a usage error.

import { makeRng } from '../games/launch/src/engine.js';
import { game } from '../games/launch/src/game.js';

const T = game.TUNING, sim = game.sim, STEP = sim.STEP, U = T.unitsPerMetre;
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const value = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const die = (msg) => { console.error(`sim-launch: ${msg}`); process.exit(2); };
const nSeeds = (def) => { const n = Number(value('--seeds') ?? def); if (!(n >= 1)) die('--seeds must be 1 or more'); return Math.round(n); };
const seedList = (n) => Array.from({ length: n }, (_, i) => i + 1);
if (value('--preset')) { const p = game.presets.find((x) => x.label === value('--preset')); if (!p) die('no such preset'); Object.assign(T, p.values); }
args.forEach((a, i) => {
  if (a !== '--set') return;
  const [k, v] = String(args[i + 1]).split('=');
  if (!(k in T)) die(`no key "${k}"`);
  T[k] = JSON.parse(v);
});
const BASE = { ...T.upgrades };
const pct = (xs, q) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const share = (xs, f) => xs.filter(f).length;
let failed = false, ran = false;
const rows = [];
const result = (id, what, got, ok) => { rows.push({ id, what, got, ok }); if (!ok) failed = true; };

// ---------- Launches ----------

// The tap time that locks the barrel at `deg` on its first up-stroke.
const t1For = (deg) => ((deg - T.aimMin) / (T.aimMax - T.aimMin)) * (T.aimPeriod / 2);
// The tap time after the lock at which the gauge first reads `v` (on its next rising stroke).
function t2For(v, g) {
  const want = (v / 2) * g.period, now = (g.phase % 1) * g.period;
  let t = want - now; while (t < T.gaugeGrace) t += g.period;
  return t;
}
const goodGauge = (rng, g) => T.gaugeSweet + (rng() < 0.5 ? -1 : 1) * rng.range(g.half[0], g.half[2] * 0.98);
function goodLaunch(seed, band, rng, up = BASE) {
  const g = sim.gaugeOf(seed, 0, up), deg = rng.range(band[0], band[1]), v = goodGauge(rng, g);
  return sim.launchOf(seed, t1For(deg), t2For(v, g), 0, up);
}
function carelessLaunch(seed, rng, up = BASE) {
  const g = sim.gaugeOf(seed, 0, up);
  return sim.launchOf(seed, T.readyGrace + rng.range(0, T.aimPeriod), T.gaugeGrace + rng.range(0, g.period), 0, up);
}

// ---------- The range finder's reading for a plan ----------
// From the run's state, fly the shared air step with a plan of actions (times in seconds from now): boost over [b0, b1],
// sail over [c0, c1], a drop at d. To the first ground touch (or 12 s). Returns the landing x and what is there.
function predict(r, plan = {}) {
  const s = { x: r.x, y: r.y, vx: r.vx, vy: r.vy, boost: r.boost, chute: r.chute, ball: r.ball, fuel: r.fuel }, st = r.st;
  for (let i = 0, t = 0; i < 12 / (2 * STEP); i++, t += 2 * STEP) {
    if (plan.b) s.boost = t >= plan.b[0] && t < plan.b[1];
    if (plan.c) s.chute = t >= plan.c[0] && t < plan.c[1];
    if (plan.d !== undefined && t >= plan.d && !s.ball) { s.ball = true; s.chute = false; s.vy = Math.min(s.vy, -T.condenseDrop); }
    sim.airStep(s, st, 2 * STEP, st.dragK * st.dragK, st.chuteK * st.chuteK);
    if (s.y <= 0 && s.vy < 0) {
      const g = sim.groundAt(r.field, s.x);
      const kind = !g ? 'ground' : g.kind === 'spring' ? (g.spent ? 'ground' : 'spring') : g.kind === 'ramp' ? 'ramp' : g.kind === 'geyser' ? 'ground' : g.kind;
      const steep = -s.vy / (Math.hypot(s.vx, s.vy) || 1), keep = s.ball ? T.condenseKeep : kind === 'spring' || kind === 'ramp' ? 1 : T.skimKeep + (T.groundKeep - T.skimKeep) * steep;
      return { x: s.x, kind, fuel: s.fuel, vx: s.vx * keep };
    }
    if (s.y <= T.geyserH) { const g = sim.groundAt(r.field, s.x); if (g && g.kind === 'geyser' && !g.spent && sim.geyserOn(g, sim.flightTime(r) + t)) return { x: s.x, kind: 'geyser', fuel: s.fuel, vx: s.vx }; }
  }
  return { x: s.x, kind: 'ground', fuel: s.fuel, vx: s.vx };
}

// ---------- Controllers ----------
// A controller is called before every step with the run; it queues inputs at the current flight time or later and records
// them (for the frame-rate replay).

function goodCtl(rng) {
  let last = 'none', prevVy = 0, prevMode = 'air';
  return (r, log) => {
    const t = sim.flightTime(r);
    const rising = r.mode === 'air' && r.vy > 0 && ((prevMode !== 'air' || prevVy <= 0) && t > 0.05 || Math.abs(t - 0.3) < STEP / 2);
    const apex = r.mode === 'air' && prevVy > 0 && r.vy <= 0;
    prevVy = r.vy; prevMode = r.mode;
    if (!(rising || apex) || r.q.length || r.boost || r.chute) return;
    const plans = [{ n: 'none' }, { n: 'drop', d: 0 }];
    for (const d of [0.8, 1.6, 3, 6]) plans.push({ n: 'sail', c: [0, d] });
    if (r.fuel > 0.2) for (const d of [0.25, 0.6, 1.2]) plans.push({ n: 'boost', b: [0, d], cost: d * T.boostDrain });
    let best = null;
    for (const p of plans) {
      const out = predict(r, p), score = (out.kind === 'spring' ? 20 : out.kind === 'geyser' ? 14 : out.kind === 'ramp' ? 8 : out.kind === 'mud' ? -50 : 0) + out.x / 400 + out.vx / 60 - (p.cost || 0) * 0.6;
      if (!best || score > best.score) best = { p, score };
    }
    const p = best.p, late = rng.range(0.1, 0.25), stretch = rng.range(0.8, 1.2), q = (at, kind) => { sim.queueInput(r, at, kind); log && log.push({ at, kind, qt: t }); };
    last = p.n;
    if (p.n === 'drop') q(t + late, 'condense');
    else if (p.n === 'sail') { q(t + late, 'chuteOn'); q(t + late + (p.c[1] - p.c[0]) * stretch, 'chuteOff'); }
    else if (p.n === 'boost') { q(t + late, 'boostOn'); q(t + late + (p.b[1] - p.b[0]) * stretch, 'boostOff'); }
  };
}

function carelessCtl(rng) {
  const n = 3 + Math.floor(rng() * 3), acts = [];
  for (let i = 0; i < n; i++) {
    const at = rng.range(0.3, 10), kind = Math.floor(rng() * 4), d = kind === 1 ? rng.range(0.2, 1) : rng.range(0.3, 1.5);
    acts.push({ at, kind, d });
  }
  let queued = false;
  return (r, log) => {
    if (queued) return; queued = true;
    const q = (at, kind) => { sim.queueInput(r, at, kind); log && log.push({ at, kind, qt: 0 }); };
    for (const a of acts) {
      if (a.kind === 0) q(a.at, 'burst');
      else if (a.kind === 1) { q(a.at, 'boostOn'); q(a.at + a.d, 'boostOff'); }
      else if (a.kind === 2) { q(a.at, 'chuteOn'); q(a.at + a.d, 'chuteOff'); }
      else q(a.at, 'condense');
    }
  };
}

const stubborn = {
  none: () => () => {},
  sail: () => { let on = false; return (r) => { if (!on) { on = true; sim.queueInput(r, 0, 'chuteOn'); } }; },
  boost: () => { let on = false; return (r) => { if (!on) { on = true; sim.queueInput(r, 0, 'boostOn'); } }; },
  drop: () => { let pv = 0; return (r) => { if (r.mode === 'air' && pv > 0 && r.vy <= 0) sim.queueInput(r, sim.flightTime(r), 'condense'); pv = r.vy; }; },
};

function fly(seed, launch, ctl = null, up = BASE, log = null) {
  const r = sim.newRun(seed, launch, up);
  const max = Math.round(T.maxFlight / STEP) + 10;
  while (!r.ended && r.steps < max) { if (ctl) ctl(r, log); r.ev.length = 0; sim.stepRun(r); }
  return r;
}
const goodFlight = (seed, band, up = BASE, log = null) => { const rng = makeRng(seed * 7727 + 3); return fly(seed, goodLaunch(seed, band, rng, up), goodCtl(rng), up, log); };
const carelessFlight = (seed, up = BASE, log = null) => { const rng = makeRng(seed * 131 + 17); return fly(seed, carelessLaunch(seed, rng, up), carelessCtl(rng), up, log); };
const LOW = [T.aimMin, 30], MID = [30, 50], HIGH = [50, T.aimMax], ANY = [T.aimMin, T.aimMax];

// ---------- Checks ----------

function checkFps(n) {
  // F1: each flight's inputs are recorded with the flight time they were decided at (qt) and replayed through frames at
  // several rates: an input is queued in the frame whose flight time passes qt, at its own time `at`, as the play scene
  // stamps a gesture; the launch comes from the two tap times (sampled at the tap, never at the frame).
  let bad = 0, flights = 0, inputs = 0;
  for (const seed of seedList(n)) for (const kind of ['good', 'careless']) {
    const log = [], rec = kind === 'good' ? goodFlight(seed, ANY, BASE, log) : carelessFlight(seed, BASE, log);
    const evs = [];
    { const r = sim.newRun(seed, rec.launch, BASE); const sorted = log.slice(); let i = 0; while (!r.ended && r.steps < 20000) { while (i < sorted.length && sorted[i].qt <= sim.flightTime(r)) { sim.queueInput(r, sorted[i].at, sorted[i].kind); i++; } sim.stepRun(r); for (const e of r.ev) evs.push(e.k); r.ev.length = 0; } }
    const jit = makeRng(seed);
    const modes = [() => 1 / 30, () => 1 / 60, () => 1 / 120, () => 1 / 144 + jit() * (1 / 20 - 1 / 144)];
    const outs = modes.map((dt) => {
      const r = sim.newRun(seed, sim.launchOf(seed, rec.launch.t1, rec.launch.t2, 0, BASE), BASE), ev = [];
      let i = 0, frames = 0;
      while (!r.ended && frames < 100000) {
        const d = Math.min(dt(), 1 / 20), ft = sim.flightTime(r) + r.acc + d;
        while (i < log.length && log[i].qt < ft) { sim.queueInput(r, Math.max(log[i].at, sim.flightTime(r)), log[i].kind); i++; }
        sim.advance(r, d); for (const e of r.ev) ev.push(e.k); r.ev.length = 0; frames++;
      }
      return { x: r.maxX, steps: r.steps, ev: ev.join() };
    });
    flights++; inputs += log.length;
    if (!outs.every((o) => o.x === outs[0].x && o.steps === outs[0].steps && o.ev === outs[0].ev) || outs[0].ev !== evs.join()) bad++;
  }
  result('F1', `same seed, taps and gestures give the same flight at 30, 60, 120 fps and jittery frames (${flights} flights, ${inputs} gestures)`, `${flights - bad} of ${flights} identical`, bad === 0);
}

function checkCareless(n) {
  const ms = seedList(n).map((s) => sim.metres(carelessFlight(s)));
  const k = share(ms, (m) => m >= 500) / n;
  result('F2', 'a first-timer reaches 500 m: the careless profile at base, at least 40 percent', `${Math.round(k * 100)} % (median ${pct(ms, 0.5)} m)`, k >= 0.4);
}

function checkStuck(n) {
  let total = 0, timeouts = 0, endless = 0, longest = 0;
  const why = { stop: 0, mud: 0 };
  const go = (r) => { total++; if (r.timeout) timeouts++; if (!r.ended) endless++; else why[r.ended] = (why[r.ended] || 0) + 1; longest = Math.max(longest, sim.flightTime(r)); };
  for (const s of seedList(n)) {
    go(carelessFlight(s)); go(goodFlight(s, ANY));
    const rng = makeRng(s * 31 + 5);
    for (const k of Object.keys(stubborn)) { const l = sim.launchOf(s, t1For(rng.range(T.aimMin, T.aimMax)), t2For(T.gaugeSweet, sim.gaugeOf(s, 0, BASE)), 0, BASE); go(fly(s, l, stubborn[k]())); }
  }
  result('F3', `every flight ends by stop speed or caramel before maxFlight ${T.maxFlight} s (${total} flights: careless, good, sail held, boost held, a drop every arc, nothing)`, `${why.stop} stop, ${why.mud} caramel, ${timeouts} at maxFlight, ${endless} unended; longest ${longest.toFixed(1)} s`, timeouts === 0 && endless === 0);
}

function checkSkim(n) {
  // The same seed, gauge error and reactions from under 30 degrees and from over 50: who flies further.
  let low = 0, high = 0, tie = 0; const lm = [], hm = [];
  for (const s of seedList(n)) {
    const rl = goodFlight(s, LOW), rh = goodFlight(s, HIGH), a = sim.metres(rl), b = sim.metres(rh);
    lm.push(a); hm.push(b);
    if (a > b) low++; else if (b > a) high++; else tie++;
  }
  const worst = Math.max(low, high) / n;
  result('F5', 'skim versus lob: the good profile under 30 degrees against over 50 on the same seeds; neither wins more than about 60 percent', `low wins ${Math.round((100 * low) / n)} %, high ${Math.round((100 * high) / n)} % (medians ${pct(lm, 0.5)} and ${pct(hm, 0.5)} m)`, worst <= 0.62);
}

function checkField(n) {
  const toM = 8000;
  let worstGap = 0, mudNoSpring = 0, overlaps = 0, early = 0, nearBird = 0, geysers = 0, clouds = 0, muds = 0, firstMud = Infinity;
  for (let s = 1; s <= n; s++) {
    const f = sim.makeField(s); sim.ensureField(f, toM * U);
    const g = f.ground.filter((o) => o.x0 < toM * U);
    for (let i = 1; i < g.length; i++) if (g[i].x0 < g[i - 1].x1 + 2 * T.critterR) overlaps++;
    let lastSpring = 0, springSince = false;
    for (const o of g) {
      if (o.kind === 'spring') { worstGap = Math.max(worstGap, o.x0 - lastSpring); lastSpring = o.x1; springSince = true; }
      if (o.kind === 'mud') { muds++; firstMud = Math.min(firstMud, o.x0); if (!springSince) mudNoSpring++; springSince = false; }
      if (o.kind === 'geyser') { geysers++; if (o.x0 < sim.FIELD.geyserFrom * U) early++; }
    }
    for (const c of f.clouds) { clouds++; if (c.x < sim.FIELD.cloudFrom * U) early++; for (const b of f.birds) if (Math.abs(b.x0 - c.x) < T.birdSwing + T.cloudRX + T.birdR + T.critterR && Math.abs(b.y - c.y) < T.cloudRY + T.birdR + 2 * T.critterR) nearBird++; }
  }
  console.log(`field over ${n} seeds to ${toM} m: widest jelly gap ${(worstGap / U).toFixed(1)} m, caramel ${muds} (first at ${(firstMud / U).toFixed(0)} m), geysers ${geysers}, clouds ${clouds}`);
  const ok = worstGap <= 150 * U && !mudNoSpring && !overlaps && !early && !nearBird;
  result('field', 'a jelly before every caramel, at most 150 m between jellies, no overlaps, geysers and clouds in their places, clouds clear of birds', `gap ${(worstGap / U).toFixed(0)} m, ${mudNoSpring} caramel without a jelly, ${overlaps} overlaps, ${early} early, ${nearBird} near birds`, ok);
}

function feel(n) {
  console.log('| profile | median m | p10 | p90 | 500 m | median s | bounces | jellies | sails | drops | boost s |');
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  const row = (name, f) => {
    const rs = seedList(n).map(f), ms = rs.map((r) => sim.metres(r)), md = (k) => pct(rs.map(k), 0.5);
    console.log(`| ${name} | ${pct(ms, 0.5)} | ${pct(ms, 0.1)} | ${pct(ms, 0.9)} | ${Math.round((100 * share(ms, (m) => m >= 500)) / n)} % | ${md((r) => sim.flightTime(r)).toFixed(1)} | ${md((r) => r.bounces)} | ${md((r) => r.springs)} | ${md((r) => r.chutes)} | ${md((r) => r.drops)} | ${md((r) => r.boostT).toFixed(1)} |`);
  };
  row('careless', (s) => carelessFlight(s));
  row('good, any angle', (s) => goodFlight(s, ANY));
  row('good, low', (s) => goodFlight(s, LOW));
  row('good, mid', (s) => goodFlight(s, MID));
  row('good, high', (s) => goodFlight(s, HIGH));
  row('no input, Perfect 45 deg', (s) => fly(s, { angle: 45, power: T.zonePower[0], zone: 0 }));
  row('no input, Good 45 deg', (s) => fly(s, { angle: 45, power: T.zonePower[2], zone: 2 }));
}

// ---------- Commands ----------

if (flag('--must') || flag('--fps')) { ran = true; checkFps(nSeeds(20) > 40 && !flag('--fps') ? 20 : nSeeds(20)); }
if (flag('--must') || flag('--careless')) { ran = true; checkCareless(nSeeds(400)); }
if (flag('--must') || flag('--stuck')) { ran = true; checkStuck(nSeeds(200)); }
if (flag('--must') || flag('--skim')) { ran = true; checkSkim(nSeeds(200)); }
if (flag('--must') || flag('--check')) { ran = true; checkField(nSeeds(500)); }
if (flag('--feel')) { ran = true; feel(nSeeds(200)); }

if (flag('--fly')) {
  ran = true;
  const angle = Number(value('--fly')), seed = Number(value('--seed') ?? 1), prof = value('--profile') || 'none';
  if (!Number.isFinite(angle)) die('--fly needs ANGLE');
  const v = Number(value('--gauge') ?? T.gaugeSweet), g = sim.gaugeOf(seed, 0, BASE), l = sim.launchOf(seed, t1For(angle), t2For(v, g), 0, BASE);
  const rng = makeRng(seed * 7727 + 3), ctl = prof === 'good' ? goodCtl(rng) : prof === 'careless' ? carelessCtl(rng) : null;
  const r = sim.newRun(seed, l, BASE), log = [];
  while (!r.ended && r.steps < 20000) {
    if (ctl) ctl(r, log);
    sim.stepRun(r);
    for (const e of r.ev) if (e.k !== 'milestone') console.log(`  ${(r.steps * STEP).toFixed(2)} s  ${e.k.padEnd(9)} at ${(r.x / U).toFixed(1)} m, height ${(r.y / U).toFixed(1)} m, vx ${r.vx.toFixed(0)}, vy ${r.vy.toFixed(0)}, fuel ${r.fuel.toFixed(2)}`);
    r.ev.length = 0;
  }
  console.log(`barrel ${l.angle.toFixed(1)} deg, gauge ${l.gauge.toFixed(3)} (${sim.ZONES[l.zone]}, power ${l.power.toFixed(2)}), seed ${seed}, ${prof}: ${sim.metres(r)} m (${r.ended}) in ${(r.steps * STEP).toFixed(1)} s; bounces ${r.bounces}, jellies ${r.springs}, birds ${r.birds}`);
}

if (flag('--contrast')) {
  ran = true;
  const P = sim.palette, lum = (h) => { const n = parseInt(h.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const OBJ = [
    { name: 'hero', layers: [P.critter, P.ink, P.halo], on: ['sky', 'hills', 'top'] },
    { name: 'jellies', layers: [P.teal, P.ink, P.halo], on: ['sky', 'hills', 'top'] },
    { name: 'caramel', layers: [P.mud], on: ['top', 'soil'] },
    { name: 'birds', layers: [P.bird, P.ink, P.birdRim], on: ['sky', 'hills'] },
    { name: 'geysers', layers: [P.column, P.ink, P.halo], on: ['sky', 'hills', 'top'] },
    { name: 'clouds', layers: [P.cloud, P.ink, P.halo], on: ['sky', 'hills'] },
  ];
  let worst = Infinity;
  for (const pl of sim.PLACES) {
    const bg = { sky: [...pl.sky, ...P.skyDusk, ...P.skyNight], hills: [pl.hills.far, pl.hills.near], top: [pl.top], soil: [pl.soil] };
    const cells = OBJ.map((o) => { const cols = o.on.flatMap((k) => bg[k]), edge = Math.min(...cols.map((c) => Math.max(...o.layers.map((l) => cr(l, c))))); worst = Math.min(worst, edge); return `${o.name} ${edge.toFixed(1)}`; });
    console.log(`${pl.name}: ${cells.join(', ')}`);
  }
  result('contrast', 'every object\'s edge at least 3:1 against every place', `lowest ${worst.toFixed(2)}`, worst >= 3);
}

if (!ran) die('nothing to do: give --must, --fps, --careless, --stuck, --skim, --check, --contrast, --feel or --fly');
if (rows.length) {
  console.log('| F | must-hold | result | |');
  console.log('| --- | --- | --- | --- |');
  for (const r of rows) console.log(`| ${r.id} | ${r.what} | ${r.got} | ${r.ok ? 'ok' : 'FAIL'} |`);
}
console.log(failed ? 'RESULT: FAIL' : 'RESULT: PASS');
process.exit(failed ? 1 : 0);
