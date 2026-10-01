#!/usr/bin/env node
// sim-launch: fly Launch's real physics (games/launch/src/game.js, via game.sim) headlessly.
//
// v0.4 Build A is a feel build (PRD v0.4, feel first as v0.3): this harness proves section G's must-holds. v0.2's rank,
// pacing, ladder and buy checks stay retired until the balance pass.
//
// The launch has two beats (PRD v0.3 A): a tap `t1` seconds after the machine is ready locks the barrel at aimAngle(t1); a tap
// `t2` seconds after the lock fires with the zone the gauge (seeded per flight) reads. In flight there are three actions
// (PRD v0.4 A): boost (held, or a quick tap's burst), glide (held), slam. Profiles:
//   careless  t1 and t2 uniform over a sweep; three to five random actions in the first ten seconds (taps, holds of 0.2 to
//             1 s, glides of 0.3 to 1.5 s, slams), as a first-timer mashes
//   good      a chosen barrel band; the gauge off the gold by Perfect to Good's half-width (Great or Good); it reads the
//             range finder: at each apex and every 0.25 s on the way down it tries its plans on a copy of the flight to the
//             next touch and takes the best (see planner); it acts 0.1 to 0.25 s late and holds 10 percent off. Policies:
//             glide and slam (every plan), never slam, and hold boost from the launch
//
//   node tools/sim-launch.mjs --must                    every G must-hold below that runs headlessly, in one table
//   node tools/sim-launch.mjs --fps [--seeds 20]        G1: two tap times and every gesture replayed at 30, 60, 120 fps and
//                                                     jittery frames (good, careless, a slam with boost every arc): the same
//                                                     distance, steps and events, every new object and action met
//   node tools/sim-launch.mjs --careless [--seeds 400]  G2: the careless profile reaches 500 m on at least 40 percent at base
//   node tools/sim-launch.mjs --stuck [--seeds 100]     G3: every flight of every profile, and of the stubborn ones (glide held,
//                                                     boost held, a slam every arc, a slam with boost every arc, nothing),
//                                                     ends before maxFlight, and no slam leaves faster than maxSpeed
//   node tools/sim-launch.mjs --steer [--seeds 100]     G4: glide and slam against hold boost and against never slam, one
//                                                     table; then where the good player's flights end and what they meet
//   node tools/sim-launch.mjs --check [--seeds 500]     field fairness: a jelly before every caramel, none further apart than
//                                                     150 m; thermals and freezers by 300 m, hills and marshmallow from 500 m
//                                                     and by 800 m, geysers and clouds in their places, clear of birds
//   node tools/sim-launch.mjs --contrast                every object against every place
//   node tools/sim-launch.mjs --highest [--seeds 100]   G5's input: the seed, taps and inputs of the highest flight flown
//   node tools/sim-launch.mjs --fly ANGLE [--gauge V] [--seed N] [--profile good|noslam|hold|careless|none] [--inputs]
//                                                     one flight's event log (and its inputs as JSON)
//   node tools/sim-launch.mjs --feel [--seeds 100]      information: distance, flight time, bounces, jellies per profile
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

// ---------- Controllers ----------
// A controller is called before every step with the run; it queues inputs at the current flight time or later and records
// them (for the frame-rate replay).
//
// The good player reads the range finder: at the top of each arc and every `every` seconds on the way down (when no action
// is running) it tries each plan on a copy of the flight (the real step, the field's used flags put back after) to the next
// ground touch, and takes the one that leaves it furthest on with the most energy (x + impact x valueE, caramel -1000 m,
// fizz worth fizzValue m a pip). It plans for its usual lag and then acts 0.1 to 0.25 s late, holding 10 percent off.
// Policies: 'slam' every plan (glide, slam, glide then slam, short boosts), 'noslam' without slams, 'hold' holds the boost
// from the launch and does nothing else.

const LAG = [0.1, 0.25], PLAN_LAG = 0.17, valueE = 1.5, fizzValue = 6;
function snapshot(f, x) {
  const keep = [];
  for (const g of f.ground) if (g.x1 > x - 3000) keep.push([g, g.spent]);
  for (const b of f.birds) if (b.x0 > x - 3000) keep.push([b, b.hit]);
  for (const c of f.clouds) if (c.x > x - 3000) keep.push([c, c.used]);
  const n = [f.ground.length, f.birds.length, f.clouds.length];
  return () => {
    for (const [o, v] of keep) { if ('spent' in o && o.kind) o.spent = v; else if ('hit' in o) o.hit = v; else o.used = v; }
    for (let i = n[0]; i < f.ground.length; i++) f.ground[i].spent = false;
    for (let i = n[1]; i < f.birds.length; i++) f.birds[i].hit = false;
    for (let i = n[2]; i < f.clouds.length; i++) f.clouds[i].used = false;
  };
}
const CONTACT = new Set(['spring', 'slam', 'bounce', 'land', 'mud', 'stop', 'ramp', 'geyser', 'marsh', 'launch']);
// Fly a copy of `r` with `acts` ([at, kind] in flight time) to its next ground touch; returns the copy.
function tryPlan(r, acts) {
  const restore = snapshot(r.field, r.x), c = { ...r, q: r.q.slice(), ev: [], stars: r.stars.slice() };
  for (const [at, kind] of acts) sim.queueInput(c, at, kind);
  const last = acts.length ? acts[acts.length - 1][0] : 0, max = c.steps + Math.round(10 / STEP);
  let touched = false;
  while (!c.ended && c.steps < max && !touched) {
    sim.stepRun(c);
    if (sim.flightTime(c) >= last) for (const e of c.ev) if (CONTACT.has(e.k)) touched = true;
    c.ev.length = 0;
  }
  restore();
  return c;
}
// Energy is worth what it flies: an arc's range goes with the speed squared over gravity, and the bounces after it add half again.
const scoreOf = (c) => (c.ended === 'mud' ? -1000 : 0) + c.x / U + (c.ended ? 0 : (valueE * sim.impactOf(c) ** 2) / T.gravity / U) + c.fuel * fizzValue;

function planner(policy, rng, every = 0.25) {
  let prevVy = 0, prevMode = 'air', next = 0, busyTill = -1;
  return (r, log) => {
    const t = sim.flightTime(r), apex = r.mode === 'air' && prevVy > 0 && r.vy <= 0;
    prevVy = r.vy; prevMode = r.mode;
    if (policy === 'hold') { if (r.steps === 0) { sim.queueInput(r, 0, 'boostOn'); log && log.push({ at: 0, kind: 'boostOn', qt: 0 }); } return; }
    if (r.mode !== 'air' || r.ball || t < busyTill || r.q.length) return;
    if (r.chute || r.boost) return;
    if (!(apex || (r.vy < 0 && t >= next))) return;
    next = t + every;
    const t0 = t + PLAN_LAG, plans = [[]];
    if (policy !== 'noslam') for (let j = 0; j <= 10; j++) plans.push([[t0 + j * every / 10, 'condense']]); // waits for the moment
    for (const d of [0.4, 0.8, 1.5, 3]) {
      plans.push([[t0, 'chuteOn'], [t0 + d, 'chuteOff']]);
      if (policy !== 'noslam') for (const k of [0, 0.06, 0.12, 0.18]) plans.push([[t0, 'chuteOn'], [t0 + d + k, 'chuteOff'], [t0 + d + k + 0.01, 'condense']]);
    }
    const tc = sim.flightTime(tryPlan(r, [[t0, 'chuteOn']])); // a glide held to the touch, let go just before it
    if (tc > t0 + 0.1) plans.push([[t0, 'chuteOn'], [tc - 0.03, 'chuteOff']]);
    if (r.fuel > 0.4) for (const d of [0.3, 0.7]) plans.push([[t0, 'boostOn'], [t0 + d, 'boostOff']]);
    let best = null;
    for (const p of plans) { const sc = scoreOf(tryPlan(r, p)); if (!best || sc > best.sc) best = { p, sc }; }
    if (!best.p.length) return;
    const shift = rng.range(LAG[0], LAG[1]) - PLAN_LAG, stretch = rng.range(0.9, 1.1), a0 = best.p[0][0];
    let lastAt = t;
    for (const [at, kind] of best.p) {
      const fin = t + PLAN_LAG + shift + (at - a0) * stretch;
      sim.queueInput(r, fin, kind); log && log.push({ at: fin, kind, qt: t }); lastAt = Math.max(lastAt, fin);
    }
    busyTill = lastAt;
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
  glide: () => { let on = false; return (r) => { if (!on) { on = true; sim.queueInput(r, 0, 'chuteOn'); } }; },
  boost: () => { let on = false; return (r) => { if (!on) { on = true; sim.queueInput(r, 0, 'boostOn'); } }; },
  drop: () => { let pv = 0; return (r) => { if (r.mode === 'air' && pv > 0 && r.vy <= 0) sim.queueInput(r, sim.flightTime(r), 'condense'); pv = r.vy; }; },
  slamBoost: () => { let pv = 0; return (r) => { if (r.mode === 'air' && pv > 0 && r.vy <= 0) { const t = sim.flightTime(r); sim.queueInput(r, t, 'condense'); sim.queueInput(r, t, 'boostOn'); } pv = r.vy; }; },
};

function fly(seed, launch, ctl = null, up = BASE, log = null) {
  const r = sim.newRun(seed, launch, up);
  const max = Math.round(T.maxFlight / STEP) + 10;
  while (!r.ended && r.steps < max) { if (ctl) ctl(r, log); r.ev.length = 0; sim.stepRun(r); }
  return r;
}
const goodFlight = (seed, band, up = BASE, log = null, policy = 'slam') => { const rng = makeRng(seed * 7727 + 3); return fly(seed, goodLaunch(seed, band, rng, up), planner(policy, rng), up, log); };
const carelessFlight = (seed, up = BASE, log = null) => { const rng = makeRng(seed * 131 + 17); return fly(seed, carelessLaunch(seed, rng, up), carelessCtl(rng), up, log); };
const LOW = [T.aimMin, 30], MID = [30, 50], HIGH = [50, T.aimMax], ANY = [T.aimMin, T.aimMax];

// ---------- Checks ----------

function checkFps(n) {
  // G1: each flight's inputs are recorded with the flight time they were decided at (qt) and replayed through frames at
  // several rates: an input is queued in the frame whose flight time passes qt, at its own time `at`, as the play scene
  // stamps a gesture; the launch comes from the two tap times (sampled at the tap, never at the frame). Flown with every
  // object and action: the glide-and-slam player, the careless one, and a slam with a held boost every arc.
  let bad = 0, flights = 0, inputs = 0;
  const met = { slams: 0, centred: 0, rockets: 0, crashes: 0, marshes: 0, thermals: 0, freezers: 0, geysers: 0, clouds: 0 };
  for (const seed of seedList(n)) for (const kind of ['good', 'careless', 'slamBoost']) {
    const log = [];
    const rec = kind === 'good' ? goodFlight(seed, ANY, BASE, log) : kind === 'careless' ? carelessFlight(seed, BASE, log) : (() => {
      const l = sim.launchOf(seed, t1For(45), t2For(T.gaugeSweet, sim.gaugeOf(seed, 0, BASE)), 0, BASE), r = sim.newRun(seed, l, BASE);
      let pv = 0; while (!r.ended && r.steps < 20000) { if (r.mode === 'air' && pv > 0 && r.vy <= 0) { const t = sim.flightTime(r); for (const k of ['condense', 'boostOn']) { sim.queueInput(r, t, k); log.push({ at: t, kind: k, qt: t }); } } pv = r.vy; sim.stepRun(r); r.ev.length = 0; }
      return r;
    })();
    for (const k of Object.keys(met)) met[k] += rec[k];
    const jit = makeRng(seed);
    const modes = [() => 1 / 30, () => 1 / 60, () => 1 / 120, () => 1 / 144 + jit() * (1 / 20 - 1 / 144)];
    const outs = modes.map((dt) => {
      const r = sim.newRun(seed, sim.launchOf(seed, rec.launch.t1, rec.launch.t2, 0, BASE), BASE), ev = [];
      let i = 0, frames = 0;
      while (!r.ended && frames < 100000) {
        const d = Math.min(dt(), 1 / 20), ft = sim.flightTime(r) + r.acc + d;
        while (i < log.length && log[i].qt < ft) { sim.queueInput(r, Math.max(log[i].at, sim.flightTime(r)), log[i].kind); i++; }
        sim.advance(r, d); for (const e of r.ev) ev.push(e.k + (e.on || '')); r.ev.length = 0; frames++;
      }
      return { x: r.maxX, steps: r.steps, ev: ev.join() };
    });
    flights++; inputs += log.length;
    if (!outs.every((o) => o.x === outs[0].x && o.steps === outs[0].steps && o.ev === outs[0].ev) || outs[0].x !== rec.maxX) bad++;
  }
  const seen = Object.entries(met).map(([k, v]) => `${v} ${k}`).join(', ');
  result('G1', `same seed, taps and gestures give the same flight at 30, 60, 120 fps and jittery frames (${flights} flights, ${inputs} gestures; met ${seen})`, `${flights - bad} of ${flights} identical`, bad === 0);
}

function checkCareless(n) {
  const ms = seedList(n).map((s) => sim.metres(carelessFlight(s)));
  const k = share(ms, (m) => m >= 500) / n;
  result('G2', 'a first-timer reaches 500 m: the careless profile at base, at least 40 percent', `${Math.round(k * 100)} % (median ${pct(ms, 0.5)} m)`, k >= 0.4);
}

function checkStuck(n) {
  let total = 0, timeouts = 0, endless = 0, longest = 0, top = 0, chain = 0, high = 0;
  const why = { stop: 0, mud: 0 };
  const go = (r) => { total++; if (r.timeout) timeouts++; if (!r.ended) endless++; else why[r.ended] = (why[r.ended] || 0) + 1; longest = Math.max(longest, sim.flightTime(r)); top = Math.max(top, r.topSpeed || 0); chain = Math.max(chain, r.chainMax); high = Math.max(high, r.topY); };
  for (const s of seedList(n)) {
    go(carelessFlight(s)); go(goodFlight(s, ANY));
    const rng = makeRng(s * 31 + 5);
    for (const k of Object.keys(stubborn)) { const l = sim.launchOf(s, t1For(rng.range(T.aimMin, T.aimMax)), t2For(T.gaugeSweet, sim.gaugeOf(s, 0, BASE)), 0, BASE); go(fly(s, l, stubborn[k]())); }
  }
  result('G3', `every flight ends by stop speed or caramel before maxFlight ${T.maxFlight} s; the slam never leaves faster than maxSpeed ${T.maxSpeed} (${total} flights: careless, good, glide held, boost held, a slam every arc, a slam with boost every arc, nothing)`, `${why.stop} stop, ${why.mud} caramel, ${timeouts} at maxFlight, ${endless} unended; longest ${longest.toFixed(1)} s; fastest slam ${Math.round(top)}; longest chain ${chain}; highest ${(high / U).toFixed(0)} m`, timeouts === 0 && endless === 0 && top <= T.maxSpeed + 1e-6);
}

// G4: the same seeds, launches and reactions under three policies: glide-and-slam, hold boost from the launch, and the
// good player who never slams.
function checkSteer(n) {
  const rows = { slam: [], hold: [], noslam: [] }, runs = { slam: [], hold: [], noslam: [] };
  for (const s of seedList(n)) for (const p of Object.keys(rows)) { const r = goodFlight(s, ANY, BASE, null, p); rows[p].push(sim.metres(r)); runs[p].push(r); }
  const wins = (a, b) => rows[a].filter((m, i) => m > rows[b][i]).length;
  const w1 = wins('slam', 'hold'), w2 = wins('slam', 'noslam');
  console.log('slams to boost s are means per flight');
  console.log('| policy | median m | p10 | p90 | 500 m | median s | slams | centred | rockets | crashes | glide s | boost s |');
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const [p, name] of [['slam', 'glide and slam'], ['hold', 'hold boost from launch'], ['noslam', 'never slam']]) {
    const rs = runs[p], ms = rows[p], md = (k) => pct(rs.map(k), 0.5), mn = (k) => mean(rs.map(k)).toFixed(1);
    console.log(`| ${name} | ${pct(ms, 0.5)} | ${pct(ms, 0.1)} | ${pct(ms, 0.9)} | ${Math.round((100 * share(ms, (m) => m >= 500)) / n)} % | ${md((r) => sim.flightTime(r)).toFixed(1)} | ${mn((r) => r.slams)} | ${mn((r) => r.centred)} | ${mn((r) => r.rockets)} | ${mn((r) => r.crashes)} | ${mn((r) => r.glideT)} | ${mn((r) => r.boostT)} |`);
  }
  result('G4', `steering beats holding: glide-and-slam against hold boost from launch, and against never slam, same ${n} seeds`, `beats hold on ${Math.round((100 * w1) / n)} %, beats never-slam on ${Math.round((100 * w2) / n)} % (medians ${pct(rows.slam, 0.5)}, ${pct(rows.hold, 0.5)}, ${pct(rows.noslam, 0.5)} m)`, w1 > n / 2 && w2 > n / 2);
  return runs.slam;
}

// Where the good player's flights end, and what they meet on the way (information for the designer).
function where(runs) {
  const ms = runs.map((r) => sim.metres(r)), med = pct(ms, 0.5), place = (m) => sim.PLACES[sim.placeIndex(m * U)].name;
  console.log(`good profile (glide and slam): median ${med} m in ${place(med)}; p10 ${pct(ms, 0.1)} m, p90 ${pct(ms, 0.9)} m (${place(pct(ms, 0.9))})`);
  console.log(`  flights reaching each place: ${sim.PLACES.map((p, i) => `${p.name} ${Math.round((100 * share(ms, (m) => m * U >= sim.placeFrom(i))) / ms.length)} %`).join(', ')}`);
  const kinds = ['springs', 'centred', 'rockets', 'crashes', 'marshes', 'thermals', 'freezers', 'birds', 'geysers', 'clouds'];
  console.log(`  share of flights meeting each: ${kinds.map((k) => `${k} ${Math.round((100 * share(runs, (r) => r[k] > 0)) / runs.length)} %`).join(', ')}`);
  console.log(`  per flight (mean): ${kinds.map((k) => `${k} ${mean(runs.map((r) => r[k])).toFixed(1)}`).join(', ')}`);
}

function checkField(n) {
  const toM = 8000, first = {};
  let worstGap = 0, mudNoSpring = 0, overlaps = 0, early = 0, nearBird = 0, muds = 0, firstMud = Infinity;
  const count = {};
  for (let s = 1; s <= n; s++) {
    const f = sim.makeField(s); sim.ensureField(f, toM * U);
    const g = f.ground.filter((o) => o.x0 < toM * U);
    for (let i = 1; i < g.length; i++) if (g[i].x0 < g[i - 1].x1 + 2 * T.critterR) overlaps++;
    let lastSpring = 0, springSince = false;
    const firstHere = {};
    for (const o of g) {
      count[o.kind] = (count[o.kind] || 0) + 1;
      if (!(o.kind in firstHere)) firstHere[o.kind] = o.x0 / U;
      if (o.kind === 'spring') { worstGap = Math.max(worstGap, o.x0 - lastSpring); lastSpring = o.x1; springSince = true; }
      if (o.kind === 'mud') { muds++; firstMud = Math.min(firstMud, o.x0); if (!springSince) mudNoSpring++; springSince = false; }
      if (o.kind === 'geyser' && o.x0 < sim.FIELD.geyserFrom * U) early++;
      if ((o.kind === 'hill' || o.kind === 'marsh') && o.x0 < sim.FIELD.hillFrom * U) early++;
    }
    for (const [k, v] of Object.entries(firstHere)) first[k] = Math.max(first[k] || 0, v);
    for (const c of f.clouds) { if (c.x < sim.FIELD.cloudFrom * U) early++; for (const b of f.birds) if (Math.abs(b.x0 - c.x) < T.birdSwing + T.cloudRX + T.birdR + T.critterR && Math.abs(b.y - c.y) < T.cloudRY + T.birdR + 2 * T.critterR) nearBird++; }
  }
  console.log(`field over ${n} seeds to ${toM} m: widest jelly gap ${(worstGap / U).toFixed(1)} m, first caramel at ${(firstMud / U).toFixed(0)} m; per seed ${Object.entries(count).map(([k, v]) => `${k} ${(v / n).toFixed(0)}`).join(', ')}`);
  console.log(`  latest first appearance over the seeds: ${Object.entries(first).map(([k, v]) => `${k} ${v.toFixed(0)} m`).join(', ')}`);
  const lateVent = Math.max(first.thermal || Infinity, first.freezer || Infinity) > 300, lateHill = Math.max(first.hill || Infinity, first.marsh || Infinity) > 800;
  const ok = worstGap <= 150 * U && !mudNoSpring && !overlaps && !early && !nearBird && !lateVent && !lateHill;
  result('field', 'a jelly before every caramel, at most 150 m between jellies, no overlaps, every seed has a thermal and a freezer by 300 m and a hill and marshmallow by 800 m (none before 500), geysers and clouds in their places, clouds clear of birds', `gap ${(worstGap / U).toFixed(0)} m, ${mudNoSpring} caramel without a jelly, ${overlaps} overlaps, ${early} early, ${nearBird} near birds; latest first thermal ${first.thermal?.toFixed(0)} m, freezer ${first.freezer?.toFixed(0)} m, hill ${first.hill?.toFixed(0)} m, marshmallow ${first.marsh?.toFixed(0)} m`, ok);
}

function feel(n) {
  console.log('| profile | median m | p10 | p90 | 500 m | median s | bounces | jellies | glides | slams | boost s |');
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  const row = (name, f) => {
    const rs = seedList(n).map(f), ms = rs.map((r) => sim.metres(r)), md = (k) => pct(rs.map(k), 0.5);
    console.log(`| ${name} | ${pct(ms, 0.5)} | ${pct(ms, 0.1)} | ${pct(ms, 0.9)} | ${Math.round((100 * share(ms, (m) => m >= 500)) / n)} % | ${md((r) => sim.flightTime(r)).toFixed(1)} | ${md((r) => r.bounces)} | ${md((r) => r.springs)} | ${md((r) => r.chutes)} | ${md((r) => r.slams)} | ${md((r) => r.boostT).toFixed(1)} |`);
  };
  row('careless', (s) => carelessFlight(s));
  row('good, any angle', (s) => goodFlight(s, ANY));
  row('good, low', (s) => goodFlight(s, LOW));
  row('good, high', (s) => goodFlight(s, HIGH));
  row('no input, Perfect 45 deg', (s) => fly(s, { angle: 45, power: T.zonePower[0], zone: 0 }));
  row('no input, Good 45 deg', (s) => fly(s, { angle: 45, power: T.zonePower[2], zone: 2 }));
}

// G5 needs the highest flight the harness can make: over the good player from a high barrel and a slam with a held boost
// at every apex from every barrel band, the seed, taps and inputs of the one that climbs highest (for the Chromium check).
function highest(n) {
  let best = null;
  const keep = (s, r, log) => { if (!best || r.topY > best.top) best = { seed: s, top: r.topY, t1: r.launch.t1, t2: r.launch.t2, log }; };
  for (const s of seedList(n)) {
    const log = []; keep(s, goodFlight(s, HIGH, BASE, log), log);
    const rng = makeRng(s * 31 + 5);
    for (const k of Object.keys(stubborn)) { // the same flights as G3's stubborn ones, their inputs read back off the queue
      const l = sim.launchOf(s, t1For(rng.range(T.aimMin, T.aimMax)), t2For(T.gaugeSweet, sim.gaugeOf(s, 0, BASE)), 0, BASE), lg = [], c = stubborn[k]();
      keep(s, fly(s, l, (r) => { const n = r.q.length; c(r); for (const e of r.q.slice(n)) lg.push({ at: e.at, kind: e.kind }); }), lg);
    }
    for (const deg of [30, 45, 60, 70]) {
      const l = sim.launchOf(s, t1For(deg), t2For(T.gaugeSweet, sim.gaugeOf(s, 0, BASE)), 0, BASE), lg = [];
      let pv = 0;
      keep(s, fly(s, l, (r) => { if (r.mode === 'air' && pv > 0 && r.vy <= 0) { const t = sim.flightTime(r); for (const k of ['condense', 'boostOn']) { sim.queueInput(r, t, k); lg.push({ at: t, kind: k, qt: t }); } } pv = r.vy; }), lg);
    }
  }
  console.log(JSON.stringify({ seed: best.seed, topM: +(best.top / U).toFixed(1), t1: best.t1, t2: best.t2, inputs: best.log.map((e) => [e.at, e.kind]) }));
}

// ---------- Commands ----------

if (flag('--must') || flag('--fps')) { ran = true; checkFps(flag('--fps') ? nSeeds(20) : 20); }
if (flag('--must') || flag('--careless')) { ran = true; checkCareless(flag('--careless') ? nSeeds(400) : 400); }
if (flag('--must') || flag('--stuck')) { ran = true; checkStuck(flag('--stuck') ? nSeeds(100) : 100); }
if (flag('--must') || flag('--steer')) { ran = true; where(checkSteer(flag('--steer') ? nSeeds(100) : 100)); }
if (flag('--must') || flag('--check')) { ran = true; checkField(flag('--check') ? nSeeds(500) : 500); }
if (flag('--feel')) { ran = true; feel(nSeeds(100)); }
if (flag('--highest')) { ran = true; highest(nSeeds(100)); }

if (flag('--fly')) {
  ran = true;
  const angle = Number(value('--fly')), seed = Number(value('--seed') ?? 1), prof = value('--profile') || 'none';
  if (!Number.isFinite(angle)) die('--fly needs ANGLE');
  const v = Number(value('--gauge') ?? T.gaugeSweet), g = sim.gaugeOf(seed, 0, BASE), l = sim.launchOf(seed, t1For(angle), t2For(v, g), 0, BASE);
  const rng = makeRng(seed * 7727 + 3), ctl = prof === 'good' || prof === 'noslam' || prof === 'hold' ? planner(prof === 'good' ? 'slam' : prof, rng) : prof === 'careless' ? carelessCtl(rng) : null;
  const r = sim.newRun(seed, l, BASE), log = [];
  while (!r.ended && r.steps < 20000) {
    if (ctl) ctl(r, log);
    sim.stepRun(r);
    for (const e of r.ev) if (e.k !== 'milestone') console.log(`  ${(r.steps * STEP).toFixed(2)} s  ${(e.k + (e.on ? ` ${e.on}` : '')).padEnd(13)} at ${(r.x / U).toFixed(1)} m, height ${(r.y / U).toFixed(1)} m, vx ${r.vx.toFixed(0)}, vy ${r.vy.toFixed(0)}, fuel ${r.fuel.toFixed(2)}`);
    r.ev.length = 0;
  }
  if (flag('--inputs')) console.log(JSON.stringify({ seed, t1: l.t1, t2: l.t2, inputs: log.map((e) => [e.at, e.kind]) }));
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
    { name: 'candy hills', layers: [P.berry, P.white, P.ink, P.halo], on: ['sky', 'hills', 'top'] },
    { name: 'marshmallow', layers: [P.marsh, P.ink, P.halo], on: ['sky', 'hills', 'top'] },
    { name: 'oven vents', layers: [P.ovenBrick, P.ink, P.halo], on: ['sky', 'hills', 'top'] },
    { name: 'freezer vents', layers: [P.freezerBody, P.ink, P.halo], on: ['sky', 'hills', 'top'] },
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
