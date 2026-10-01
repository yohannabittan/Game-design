#!/usr/bin/env node
// sim-launch: fly Launch's real physics (games/launch/src/game.js, via game.sim) headlessly.
//
// The launch is the needle (PRD v0.2 A): a tap `t` seconds after the launcher is ready launches at needleAngle(t) with its zone's
// power. Player profiles are distributions of tap times (PRD v0.2 G):
//   expert    the planner: any stop in the Perfect or Great zones, the best one searched, then each arc planned (as v0.1)
//   good      aims at the gold and taps off by 3 to 15 degrees' worth of time at base Steady (Great or Good), then a burst of
//             every pulse after the second spring (or the first plain bounce); with the Rocket, one long press
//   careless  a tap time uniform over the sweep (so an angle uniform over the wedge), plus two random boosts in the first 3 s
//
//   node tools/sim-launch.mjs --targets [--seeds 200]   the v0.2 G targets: Good and Weak launches to 500 m, the careless profile
//                                                     to 500 m, and the zone mix each profile gets
//   node tools/sim-launch.mjs --sweet [--seeds 200]    the angle that flies furthest at base equipment: each candidate sweetAngle
//                                                     (its own teaching chunk) flown as a Perfect stop by the good profile's boosts
//   node tools/sim-launch.mjs --clean [--seeds 200]    the fixed first chunk's promise: every Good or better stop at every Band, Aero
//                                                     and Steady level lands first on spring A; Good launches to 500 m at each level
//   node tools/sim-launch.mjs --expert [--up band=1,fuel=1] [--seeds 200]
//   node tools/sim-launch.mjs --upgrades [--seeds 200] the expert with no upgrades, each single upgrade at level 1 and 2, and every
//                                                     pair at level 1: milestone reach per set; each milestone reachable with at most
//                                                     two upgrade levels in total
//   node tools/sim-launch.mjs --camera [--seeds 200] [--up ...]
//   node tools/sim-launch.mjs --buys [--seeds 40] [--cache FILE] [--limit N]
//                                                     every upgrade state (1024), each profile's median, the best next buy per sugar
//                                                     from each; every upgrade must be some profile's best next buy somewhere
//   node tools/sim-launch.mjs --pacing [--flights 300] the good and careless profiles from a fresh save with goals, buying the cheapest
//                                                     next level: flights to each purchase, and the share of sugar from goals
//   node tools/sim-launch.mjs --fps [--seeds 20] [--up ...] [--objects]
//                                                     needle tap times, boosts and holds replayed at 30, 60, 120 fps and jittery
//                                                     frames; the same geyser and cloud events in the same order (--objects: fail
//                                                     unless the flights meet both)
//   node tools/sim-launch.mjs --check [--seeds 500]    field fairness: a spring before every mud, none further apart than 150 m;
//                                                     geysers from Soda Springs and clouds from Gingerbread Town, three templates
//                                                     each per place; the geyser and cloud rules flown through the real step
//   node tools/sim-launch.mjs --contrast               hero, jellies, caramel, birds, geysers, clouds against every place's colours
//   node tools/sim-launch.mjs --fly ANGLE [--seed N] [--pulses T1,T2,...] [--up ...]   one needle stop with its event log
//   node tools/sim-launch.mjs --why SEED [--up ...]    the expert's best flight on one seed, contact by contact
//
// Upgrade sets are band, fuel, aero, rocket, steady levels. Reachable means the expert reaches the milestone on at least a
// quarter of the seeds. Seeds are 1..N. Exit code 0 when every check run passes, 1 when one fails, 2 on a usage error.

import { readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { makeRng } from '../games/launch/src/engine.js';
import { game } from '../games/launch/src/game.js';

const T = game.TUNING, sim = game.sim, STEP = sim.STEP;
const args = isMainThread ? process.argv.slice(2) : workerData.argv;
const flag = (n) => args.includes(n);
const value = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const die = (msg) => { console.error(`sim-launch: ${msg}`); process.exit(2); };
const nSeeds = (def) => { const n = Number(value('--seeds') ?? def); if (!(n >= 1)) die('--seeds must be 1 or more'); return Math.round(n); };
const KEYS = ['band', 'fuel', 'aero', 'rocket', 'steady'];
const parseUp = (s) => {
  const up = Object.fromEntries(KEYS.map((k) => [k, 0]));
  if (!s) return up;
  for (const kv of String(s).split(',')) { const [k, v] = kv.split('='); if (!(k in up) || !(Number(v) >= 0)) die(`bad upgrade "${kv}"`); up[k] = Number(v); }
  return up;
};
const upText = (up) => Object.entries(up).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(' + ') || 'none';
const U = T.unitsPerMetre;
// --set KEY=VALUE (repeatable; VALUE is JSON): try a TUNING value without editing the game (workers read the same argv).
args.forEach((a, i) => {
  if (a !== '--set') return;
  const [k, v] = String(args[i + 1]).split('='), [o, key] = k.startsWith('FIRST_CHUNK.') ? [sim.FIRST_CHUNK, k.slice(12)] : [T, k];
  if (!(key in o)) die(`no key "${k}"`);
  o[key] = JSON.parse(v);
});
if (!isMainThread && workerData.sweet) T.sweetAngle = workerData.sweet;

// ---------- Flights ----------

// Fly one flight. `ctl(r)` runs before every step and may queue inputs at the current flight time. Returns the run.
function fly(seed, launch, up, ctl = null, maxSteps = Math.round(T.maxFlight / STEP) + 10) {
  const r = sim.newRun(seed, launch, up);
  while (!r.ended && r.steps < maxSteps) { if (ctl) ctl(r); sim.stepRun(r); if (!r.t500 && r.maxX >= 500 * U) r.t500 = r.steps * STEP; }
  return r;
}

// Where the critter next comes down if it gets these inputs (times in flight seconds from now): pulses, and a hold of the
// Rocket from `hold[0]` to `hold[1]`. Flies with gravity and drag only (birds and clouds are ignored) until it meets the ground,
// a ramp, or a geyser's column while it erupts (on the flight clock). Returns { x, g, lift } with g the ground object there
// (null: plain ground) and lift true for an erupting geyser.
function predict(r, pulses = [], hold = null) {
  let vx = r.vx, vy = r.vy, x = r.x, y = r.y, fuel = r.fuel, t = 0, pi = 0;
  const h = STEP * 2, k = Math.pow(1 - r.st.airDrag, h);
  for (let i = 0; i < 20000; i++) {
    while (pi < pulses.length && pulses[pi] < t + h) {
      pi++;
      if (fuel > 0) { const a = Math.min(1, fuel), s = Math.hypot(vx, vy) || 1; fuel -= a; vx += (vx / s) * T.boostPulse * a; vy += (vy / s) * T.boostPulse * a; }
    }
    if (hold && t >= hold[0] && t < hold[1] && fuel > 0) {
      const a = Math.min(1, fuel / (T.holdFuelRate * h)), s = Math.hypot(vx, vy) || 1, dv = r.st.thrust * h * a;
      fuel = Math.max(0, fuel - T.holdFuelRate * h); vx += (vx / s) * dv; vy += (vy / s) * dv;
    }
    vy -= T.gravity * h; vx *= k; vy *= k; x += vx * h; y += vy * h; t += h;
    const g = sim.groundAt(r.field, x), sh = g && g.kind === 'ramp' ? (g.h * (x - g.x0)) / g.w : 0;
    if (g && g.kind === 'geyser' && !g.spent && y < T.geyserH && sim.geyserOn(g, r.steps * STEP + t)) return { x, g, lift: true, fuelLeft: fuel };
    if (y <= sh && (vy < 0 || (g && g.kind === 'ramp'))) return { x, g, fuelLeft: fuel };
  }
  return { x, g: null, fuelLeft: fuel };
}
const landKind = (g, lift) => (!g ? 'ground' : g.kind === 'spring' ? (g.spent ? 'ground' : 'spring') : g.kind === 'geyser' ? (lift ? 'geyser' : 'ground') : g.kind);

// The expert. The launch is searched: any needle stop in the Perfect or Great zone (the expert profile hits those every time). Every arc, at the first step it is rising, the bot plans that arc:
// it tries firing nothing, or 1 to 3 pulses (with the Rocket: a press held for a while) starting at one of five points of the
// rising half, predicts each landing, and takes the cheapest plan that lands on a fresh spring or a ramp (a spring first),
// or failing that one that avoids mud. With nothing to aim at and more fuel than `plan.keep`, it spends up to `plan.spend`
// pulses at the start of the rise for distance. Falling, it still fires a pulse if that turns a mud or plain landing into a
// spring or ramp, and on the ground it hops before sliding into mud.
function expertCtl(plan) {
  let arcPlanned = false, queued = [], lastLook = -1, holdEnd = -1;
  return (r) => {
    const t = r.steps * STEP;
    for (const e of r.ev) if (e.k === 'spring' || e.k === 'bird' || e.k === 'bounce' || e.k === 'ramp' || e.k === 'geyser') arcPlanned = false;
    r.ev.length = 0;
    if (holdEnd >= 0 && t >= holdEnd) { sim.queueInput(r, t, 'holdOff'); holdEnd = -1; }
    if (r.mode !== 'air') { arcPlanned = false; }
    if (r.mode === 'air' && r.vy > 0 && !arcPlanned && r.fuel > 0) {
      arcPlanned = true;
      const rise = r.vy / T.gravity, cands = [{ n: 0, p: [], hold: null, cost: 0 }];
      for (const f of [0, 0.2, 0.4, 0.6, 0.8]) {
        const t0 = f * rise;
        if (r.st.hold) { // with the Rocket a press can be held; taps still work too
          for (const d of [0.15, 0.3, 0.5, 0.8, 1.2, 1.8]) {
            const cost = 1 + d * T.holdFuelRate;
            if (cost <= r.fuel + 1e-9) cands.push({ n: cost, p: [t0], hold: [t0 + T.holdDelay, t0 + T.holdDelay + d], cost });
          }
        }
        for (let n = 1; n <= Math.min(3, Math.floor(r.fuel)); n++) cands.push({ n, p: Array.from({ length: n }, (_, i) => t0 + i * 0.08), hold: null, cost: n });
      }
      let best = null, bestScore = -Infinity, base = null;
      for (const c of cands) {
        const out = predict(r, c.p, c.hold), kind = landKind(out.g, out.lift);
        if (!c.cost) base = kind;
        const score = (kind === 'spring' ? 10 : kind === 'geyser' ? 9 : kind === 'ramp' ? 8 : kind === 'mud' ? -10 : 0) - c.cost - (c.p[0] || 0) * 0.01;
        if (score > bestScore) { bestScore = score; best = c; }
      }
      if (bestScore < 5 && base !== 'mud' && r.fuel > plan.keep) { // nothing to aim at: spend some for distance now
        const n = Math.min(plan.spend, Math.floor(r.fuel - plan.keep));
        best = n > 0 ? (r.st.hold ? { p: [0], hold: n > 1 ? [T.holdDelay, T.holdDelay + (n - 1) / T.holdFuelRate] : null } : { p: Array.from({ length: n }, (_, i) => i * 0.08), hold: null }) : best;
      }
      for (const pt of best.p) sim.queueInput(r, t + pt, 'pulse');
      if (best.hold) { sim.queueInput(r, t + best.hold[0], 'holdOn'); holdEnd = t + best.hold[1]; }
      return;
    }
    if (r.fuel < 1 || t - lastLook < 0.05 || r.q.length || holdEnd >= 0) return;
    lastLook = t;
    if (r.mode === 'air' && r.vy < 0) {
      const p0 = predict(r), now = landKind(p0.g, p0.lift);
      if (now === 'spring' || now === 'ramp' || now === 'geyser') return;
      const p1 = predict(r, [0]), k2 = landKind(p1.g, p1.lift);
      if (k2 === 'spring' || k2 === 'ramp' || k2 === 'geyser' || (now === 'mud' && k2 !== 'mud')) sim.queueInput(r, t, 'pulse');
    } else if (r.mode === 'ground') {
      for (let x = r.x; x < r.x + Math.max(0, r.vx) * 0.6; x += 10) {
        const g = sim.groundAt(r.field, x), k = landKind(g);
        if (k === 'spring' || k === 'ramp') break;
        if (k === 'mud') { sim.queueInput(r, t, 'pulse'); break; }
      }
    }
  };
}

const PLANS = [{ keep: 0, spend: 1, name: 'keep 0 spend 1' }, { keep: 1, spend: 1, name: 'keep 1 spend 1' }, { keep: 2, spend: 2, name: 'keep 2 spend 2' },
  { keep: 0, spend: 3, name: 'keep 0 spend 3' }, { keep: 99, spend: 0, name: 'aim only' }];

function expertBest(seed, up) {
  const tried = [], half = sim.needleOf(up).half[1];
  const run = (angle, plan) => { const l = sim.launchAt(angle, up), r = fly(seed, l, up, expertCtl(plan)); const res = { angle, power: l.power, zone: l.zone, plan, m: sim.metres(r), r }; tried.push(res); return res; };
  for (let a = Math.ceil(T.sweetAngle - half); a <= T.sweetAngle + half; a += 1) run(a, PLANS[1]);
  tried.sort((x, y) => y.m - x.m);
  const top = tried.slice(0, 5);
  for (const t of top) {
    for (const plan of PLANS) if (plan !== t.plan) run(t.angle, plan);
    for (const da of [-0.5, 0.5]) if (Math.abs(t.angle + da - T.sweetAngle) <= half) run(t.angle + da, t.plan);
  }
  return tried.reduce((b, t) => (t.m > b.m ? t : b));
}

// Phone sizes for --camera: CSS size, design scale s, view width in design px (the engine fits 640 x 360 by height here).
const CAM_SIZES = [{ name: '844x390', w: 844, h: 390 }, { name: '640x360', w: 640, h: 360 }].map((z) => ({ ...z, s: Math.min(z.w / T.designW, z.h / T.designH), vw: z.w / Math.min(z.w / T.designW, z.h / T.designH) }));

function cameraFlight(seed, up) {
  const b = expertBest(seed, up), R = T.critterR;
  const r = sim.newRun(seed, sim.launchAt(b.angle, up), up), ctl = expertCtl(b.plan);
  const cams = CAM_SIZES.map((sz) => ({ sz, c: sim.newCamera(sz.vw), frames: 0, off: 0, lowFrames: 0, offLow: 0, lifted: 0, arcs: 0, seen: 0, need: [], px: [], apex: null }));
  let prevVy = r.vy, prevMode = r.mode;
  while (!r.ended) {
    ctl(r);
    sim.stepRun(r);
    const landed = r.ev.some((e) => ['spring', 'bounce', 'ramp', 'mud'].includes(e.k)) || (prevMode === 'air' && r.mode === 'ground');
    const bird = r.ev.some((e) => e.k === 'bird');
    for (const k of cams) {
      if (k.apex && (landed || bird)) {
        if (landed) {
          k.arcs++;
          const [lx] = sim.toView(k.apex, r.x, 0);
          if (lx >= 0 && lx <= k.sz.vw) k.seen++;
          k.need.push(Math.min(1, (k.sz.vw * (1 - T.followXMin) - T.landMargin) / Math.max(1, r.x - k.apex.ax)));
        }
        k.apex = null;
      }
    }
    if (r.steps % 2 === 0) for (const k of cams) {
      sim.cameraStep(k.c, r, k.sz.vw, 1 / 60);
      const [vx, vy] = sim.toView(k.c, r.x, r.y + R);
      const out = vx < -R || vx > k.sz.vw + R || vy < -R || vy > T.designH + R;
      k.frames++; if (out) k.off++;
      if (r.y < 600 * U) { k.lowFrames++; if (out) k.offLow++; }
      if (k.c.y > 0) k.lifted++;
      k.px.push((Math.hypot(r.vx, r.vy) * k.c.z * k.sz.s) / 60);
    }
    if (r.mode === 'air' && prevVy > 0 && r.vy <= 0) for (const k of cams) k.apex = { ...k.c, ax: r.x };
    prevVy = r.vy; prevMode = r.mode;
  }
  return { m: sim.metres(r), cams: cams.map(({ sz, c, apex, ...rest }) => rest) };
}

// ---------- Player profiles (PRD v0.2 G) ----------
// A profile is a distribution of needle tap times. `aimAt(e, up)` is a tap `e` seconds off the moment the needle crosses
// sweetAngle on its way up (one sweep in, so any e in +-0.3 s is on the same stroke); a slower needle (Steady) turns the
// same timing error into a smaller angle error, and Steady's wider zones catch more of it.
const baseSpeed = (2 * (T.needleMax - T.needleMin)) / T.needlePeriod; // degrees per second at base Steady
function aimAt(e, up) {
  const n = sim.needleOf(up), tSweet = ((T.sweetAngle - T.needleMin) / (T.needleMax - T.needleMin)) * (n.period / 2);
  return sim.needleLaunch(n.period + tSweet + e, up);
}
const PROFILES = {
  // Off by 0 to zoneGreat degrees' worth of time at base speed: Perfect or Great every time.
  expert: (rng, up) => aimAt(rng.range(-1, 1) * (T.zoneGreat / baseSpeed) * 0.98, up),
  // Off by zonePerfect to zoneGood degrees' worth: Great or Good at base.
  good: (rng, up) => aimAt((rng() < 0.5 ? -1 : 1) * rng.range(T.zonePerfect, T.zoneGood * 0.98) / baseSpeed, up),
  // A tap at any time of the sweep: an angle uniform over the wedge.
  careless: (rng, up) => sim.needleLaunch(T.readyGrace + rng.range(0, sim.needleOf(up).period), up), // taps before readyGrace are ignored
};

// The good profile's boosts: a burst of every pulse 0.15 to 0.4 s apart, from 0.15 to 0.4 s after the second spring (or the
// first plain bounce, when the chain is broken); with the Rocket the burst is one press held until the tank is empty (a hold
// pushes twice as far per fuel as taps).
function burstFlight(seed, launch, up, rng) {
  const gaps = Array.from({ length: 16 }, () => rng.range(0.15, 0.4));
  const r = sim.newRun(seed, launch, up);
  let springs = 0, fired = false, holding = false;
  while (!r.ended) {
    if (holding && r.fuel <= 0) { sim.queueInput(r, r.steps * STEP, 'holdOff'); holding = false; }
    for (const e of r.ev) {
      if (e.k === 'spring') springs++;
      if (!fired && (springs >= 2 || e.k === 'bounce')) {
        fired = true;
        let t = r.steps * STEP + gaps[0];
        if (r.st.hold) { sim.queueInput(r, t, 'pulse'); sim.queueInput(r, t + T.holdDelay, 'holdOn'); holding = true; }
        else for (let i = 0; i < Math.ceil(r.fuel); i++) { sim.queueInput(r, t, 'pulse'); t += gaps[i + 1]; }
      }
    }
    r.ev.length = 0;
    sim.stepRun(r);
  }
  return r;
}
// The careless profile's boosts: two taps somewhere in the first three seconds.
function twoTapFlight(seed, launch, up, rng) {
  const taps = [rng.range(0.2, 3), rng.range(0.2, 3)].sort((a, b) => a - b);
  const r = sim.newRun(seed, launch, up);
  for (const t of taps) sim.queueInput(r, t, 'pulse');
  while (!r.ended) { r.ev.length = 0; sim.stepRun(r); }
  return r;
}
// One flight of a profile on a seed: its own tap time and boosts, from a stream seeded by the seed.
function profileFlight(name, seed, up) {
  const rng = makeRng(seed * 7727 + name.length * 131 + 3), launch = PROFILES[name](rng, up);
  const r = name === 'careless' ? twoTapFlight(seed, launch, up, rng) : burstFlight(seed, launch, up, rng);
  return { m: sim.metres(r), r, launch };
}
// A launch from a zone: an angle uniform over that zone's band (both sides), seeded.
function zoneLaunch(zone, rng, up = parseUp('')) {
  const h = sim.needleOf(up).half, c = T.sweetAngle;
  const bands = zone === 3 ? [[T.needleMin, c - h[2]], [c + h[2], T.needleMax]] : zone === 0 ? [[c - h[0], c + h[0]]] : [[c - h[zone], c - h[zone - 1]], [c + h[zone - 1], c + h[zone]]];
  const total = bands.reduce((a, [x, y]) => a + Math.max(0, y - x), 0);
  let u = rng() * total;
  for (const [x, y] of bands) { const w = Math.max(0, y - x); if (u <= w) { const l = sim.launchAt(x + u, up); return l.zone === zone ? l : sim.launchAt(x + w / 2, up); } u -= w; }
  return sim.launchAt(c, up);
}

// ---------- Workers ----------

const stateKey = (u) => KEYS.map((k) => u[k]).join('');
function zoneFlight(kind, s, up) { // kind "zone:Z:BOOSTS": a launch uniform over zone Z's band, then burst, taps or none
  const [, z, boosts] = kind.split(':'), rng = makeRng(s * 31 + 7), l = zoneLaunch(Number(z), rng, up);
  if (boosts === 'expert') { let best = 0; for (const plan of PLANS) best = Math.max(best, sim.metres(fly(s, l, up, expertCtl(plan)))); return { seed: s, m: best, angle: l.angle, zone: l.zone }; }
  const r = boosts === 'burst' ? burstFlight(s, l, up, rng) : boosts === 'taps' ? twoTapFlight(s, l, up, rng) : fly(s, l, up);
  return { seed: s, m: sim.metres(r), angle: l.angle, zone: l.zone };
}

if (!isMainThread) {
  const { kind, seeds, up, states } = workerData;
  if (states) { // one profile's median over the seeds in each upgrade state
    const out = states.map((u) => {
      const ms = seeds.map((s) => (kind === 'expert' ? expertBest(s, u).m : profileFlight(kind, s, u).m)).sort((a, b) => a - b);
      return { key: stateKey(u), med: ms[Math.floor(ms.length / 2)] };
    });
    parentPort.postMessage(out);
    process.exit(0);
  }
  const out = seeds.map((s) => {
    if (kind.startsWith('zone:')) return zoneFlight(kind, s, up);
    if (kind === 'perfect-expert') { // the Perfect stop at sweetAngle, the expert planning in flight (its best plan)
      let best = null;
      for (const plan of PLANS) { const r = fly(s, sim.launchAt(T.sweetAngle, up), up, expertCtl(plan)); if (!best || sim.metres(r) > best) best = sim.metres(r); }
      return { seed: s, m: best };
    }
    if (kind === 'expert') { const b = expertBest(s, up); return { seed: s, m: b.m, angle: b.angle, power: b.power, zone: b.zone, plan: b.plan.name, springs: b.r.springs, birds: b.r.birds, why: b.r.ended, secs: +(b.r.steps * STEP).toFixed(1), t500: +(b.r.t500 || 0).toFixed(1) }; }
    if (kind === 'camera') return { seed: s, ...cameraFlight(s, up) };
    const f = profileFlight(kind, s, up);
    return { seed: s, m: f.m, zone: f.launch.zone, angle: f.launch.angle };
  });
  parentPort.postMessage(out);
  process.exit(0);
}

const W = Math.max(1, Math.round(Number(value('--workers') ?? availableParallelism())));
async function parallel(kind, seeds, up) {
  const parts = Array.from({ length: W }, (_, k) => seeds.filter((s, i) => i % W === k)).filter((p) => p.length);
  const res = await Promise.all(parts.map((p) => new Promise((ok, no) => {
    const w = new Worker(new URL(import.meta.url), { workerData: { kind, seeds: p, up, argv: args, sweet: T.sweetAngle } });
    w.once('message', ok); w.once('error', no);
  })));
  return res.flat().sort((a, b) => a.seed - b.seed);
}
async function parallelStates(kind, states, seeds) {
  const parts = Array.from({ length: W }, (_, k) => states.filter((s, i) => i % W === k)).filter((p) => p.length);
  const res = await Promise.all(parts.map((p) => new Promise((ok, no) => {
    const w = new Worker(new URL(import.meta.url), { workerData: { kind, seeds, states: p, argv: args, sweet: T.sweetAngle } });
    w.once('message', ok); w.once('error', no);
  })));
  return res.flat();
}

// ---------- Reporting ----------

const pct = (xs, q) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const dist = (ms) => `min ${Math.min(...ms)}, p10 ${pct(ms, 0.1)}, p25 ${pct(ms, 0.25)}, median ${pct(ms, 0.5)}, p75 ${pct(ms, 0.75)}, p90 ${pct(ms, 0.9)}, max ${Math.max(...ms)}, mean ${Math.round(ms.reduce((a, b) => a + b, 0) / ms.length)}`;
const reach = (ms) => T.milestones.map((m) => `${m} m ${ms.filter((x) => x >= m).length}`).join(', ');
let failed = false;
const fail = (msg) => { failed = true; console.log(`FAIL ${msg}`); };
let ran = false;

const seedList = (n) => Array.from({ length: n }, (_, i) => i + 1);
const zoneName = (z) => sim.ZONES[z].replace('!', '');
const share = (xs, f) => xs.filter(f).length;

if (flag('--fly')) {
  ran = true;
  const angle = Number(value('--fly'));
  if (!Number.isFinite(angle)) die('--fly needs ANGLE');
  const up = parseUp(value('--up')), seed = Number(value('--seed') ?? 1), l = sim.launchAt(angle, up);
  const r = sim.newRun(seed, l, up);
  for (const t of String(value('--pulses') || '').split(',').filter(Boolean).map(Number)) sim.queueInput(r, t, 'pulse');
  while (!r.ended) {
    sim.stepRun(r);
    for (const e of r.ev) console.log(`  ${(r.steps * STEP).toFixed(2)} s  ${e.k.padEnd(9)} at ${(r.x / U).toFixed(1)} m, height ${(r.y / U).toFixed(1)} m, vx ${r.vx.toFixed(0)}, vy ${r.vy.toFixed(0)}, fuel ${r.fuel.toFixed(2)}`);
    r.ev.length = 0;
  }
  console.log(`needle stop ${angle} deg (${zoneName(l.zone)}, power ${l.power}), seed ${seed}, upgrades ${upText(up)}: ${sim.metres(r)} m (${r.ended}) in ${(r.steps * STEP).toFixed(1)} s; springs ${r.springs}, birds ${r.birds}, best chain ${r.chainMax}, sugar ${sim.coinsOf(r)}`);
}

if (flag('--contrast')) {
  ran = true;
  // PRD v0.2 E and F, design principle 7: the hero, jellies, caramel, birds, geysers and clouds stay at least 3:1 against every
  // place's backdrop: its day sky (horizon and top), the shared dusk and night skies, its two hill colours and its ground top
  // (the soil too for caramel, which is sunk into the band). An object's edge is its best layer against that colour (its fill,
  // its ink outline or its light halo, each drawn all round it); caramel has no outline, so its body alone must hold 3:1.
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
  console.log(`| place | ${OBJ.map((o) => `${o.name} edge (fill)`).join(' | ')} |`);
  console.log(`| --- | ${OBJ.map(() => '---').join(' | ')} |`);
  let worst = Infinity;
  for (const pl of sim.PLACES) {
    const bg = { sky: [...pl.sky, ...P.skyDusk, ...P.skyNight], hills: [pl.hills.far, pl.hills.near], top: [pl.top], soil: [pl.soil] };
    const cells = OBJ.map((o) => {
      const cols = o.on.flatMap((k) => bg[k]), edge = Math.min(...cols.map((c) => Math.max(...o.layers.map((l) => cr(l, c))))), fill = Math.min(...cols.map((c) => cr(o.layers[0], c)));
      worst = Math.min(worst, edge);
      return `${edge.toFixed(1)} (${fill.toFixed(1)})`;
    });
    console.log(`| ${pl.name} | ${cells.join(' | ')} |`);
  }
  const lab = Math.min(...sim.PLACES.map((pl) => cr(P.text, pl.soil)));
  console.log(`ground labels (light text on each place's soil): at least ${lab.toFixed(1)}:1`);
  console.log(`${worst >= 3 ? 'ok  ' : 'FAIL'} every object's edge is at least 3:1 against every place's sky, hills and ground (lowest ${worst.toFixed(2)})`);
  if (worst < 3) failed = true;
}

if (flag('--why')) {
  ran = true;
  const up = parseUp(value('--up')), seed = Number(value('--why')), b = expertBest(seed, up);
  const r = sim.newRun(seed, sim.launchAt(b.angle, up), up), ctl = expertCtl(b.plan);
  while (!r.ended) {
    const evs = r.ev.slice(); ctl(r);
    for (const e of evs) console.log(`  ${(r.steps * STEP).toFixed(2)} s  ${e.k.padEnd(9)} at ${(r.x / U).toFixed(1)} m, height ${(r.y / U).toFixed(1)} m, vx ${r.vx.toFixed(0)}, vy ${r.vy.toFixed(0)}, fuel ${r.fuel.toFixed(2)}`);
    sim.stepRun(r);
  }
  console.log(`expert on seed ${seed}, upgrades ${upText(up)}: stop ${b.angle} deg (${zoneName(b.zone)}), plan ${b.plan.name}: ${sim.metres(r)} m (${r.ended}) in ${(r.steps * STEP).toFixed(1)} s`);
}

if (flag('--sweet')) {
  ran = true;
  // The angle that flies furthest at base equipment: a Perfect stop's flight on open ground (no field, no input) to its first
  // landing, at every angle 30 to 50 degrees in 0.1 degree steps; sweetAngle is the furthest, to the nearest half degree.
  // For information, each whole candidate is also flown on the seeded fields with its own teaching chunk (the good profile's
  // burst and the expert's in-flight planning): those means move with how the candidate's layout meets the seeded chunks
  // (the expert's best angle moved between 40 and 44 as the layout was tuned), so they do not pick the angle.
  const none = parseUp(''), open = () => ({ seed: 0, rng: null, ground: [], birds: [], clouds: [], end: 1e12, chunks: 1 });
  const range = (a) => { const r = sim.newRun(0, { angle: a, power: T.zonePower[0], zone: 0 }, none, open()); while (!r.ended && !r.ev.some((e) => e.k === 'bounce') && r.mode === 'air' && r.steps < 20000) sim.stepRun(r); return r.x / U; };
  let best = null;
  for (let a = 30; a <= 50.0001; a += 0.1) { const x = range(+a.toFixed(1)); if (!best || x > best.x + 1e-9) best = { a: +a.toFixed(1), x }; }
  const pick = Math.round(best.a * 2) / 2;
  console.log(`open-ground range of a Perfect stop at base: ${[30, 34, 38, 40, 42, 43, 44, 45, 46, 48, 50].map((a) => `${a} deg ${range(a).toFixed(1)} m`).join(', ')}`);
  console.log(`furthest at ${best.a} deg (${best.x.toFixed(2)} m), to the half degree ${pick} deg`);
  const seeds = seedList(nSeeds(200)), was = T.sweetAngle;
  console.log('| candidate sweetAngle | burst: median | burst: mean | expert in flight: median | expert: mean |');
  console.log('| --- | --- | --- | --- | --- |');
  for (let a = 36; a <= 46; a += 2) {
    T.sweetAngle = a;
    const l = sim.launchAt(a, none), burst = seeds.map((s) => sim.metres(burstFlight(s, l, none, makeRng(s * 31 + 7))));
    const exp = (await parallel('perfect-expert', seeds, none)).map((x) => x.m), mean = (xs) => Math.round(xs.reduce((x, y) => x + y, 0) / xs.length);
    console.log(`| ${a} | ${pct(burst, 0.5)} | ${mean(burst)} | ${pct(exp, 0.5)} | ${mean(exp)} |`);
  }
  T.sweetAngle = was;
  console.log(`the open-ground furthest angle is ${pick} deg; TUNING.sweetAngle is ${T.sweetAngle}, set on the real field (--rank: the decision after Build 1 round 2)`);
}

if (flag('--ladder')) {
  ran = true;
  // Amendment 6 after the Build 1 review: no dead or harmful purchase. Each upgrade on its own, levels 0 to 3, flown by the
  // good profile (and the careless one, for information): every level must raise the good profile's median distance.
  const seeds = seedList(nSeeds(200));
  console.log('| upgrade | good: median m by level 0, 1, 2, 3 | careless: median m by level |');
  console.log('| --- | --- | --- |');
  let bad = 0;
  for (const k of KEYS) {
    const g = [], c = [];
    for (let l = 0; l <= T.upgradeMax; l++) {
      const up = parseUp(l ? `${k}=${l}` : '');
      g.push(pct((await parallel('good', seeds, up)).map((x) => x.m), 0.5));
      c.push(pct((await parallel('careless', seeds, up)).map((x) => x.m), 0.5));
    }
    const ok = g.every((m, i) => !i || m > g[i - 1]);
    if (!ok) bad++;
    console.log(`| ${k} | ${g.join(', ')}${ok ? '' : '  (FAIL)'} | ${c.join(', ')} |`);
  }
  console.log(`${bad ? 'FAIL' : 'ok  '} every level of every upgrade raises the good profile's median (${bad} upgrades fail)`);
  if (bad) failed = true;
}

if (flag('--mark')) {
  ran = true;
  // The landing marker's cost (amendment 10): a call every 0.1 s of the expert's flights with the most upgrades (the highest
  // arcs), each timed as the fastest of three identical calls so a garbage collection elsewhere is not charged to it.
  const up = parseUp(value('--up') || 'band=3,fuel=3,aero=3,rocket=3,steady=3'), times = [];
  for (const s of seedList(nSeeds(10))) {
    const b = expertBest(s, up), r = sim.newRun(s, sim.launchAt(b.angle, up), up), ctl = expertCtl(b.plan);
    while (!r.ended) { ctl(r); sim.stepRun(r); if (r.steps % 12 === 0 && r.mode === 'air') { let best = Infinity; for (let k = 0; k < 3; k++) { const t0 = performance.now(); sim.landingMark(r); best = Math.min(best, performance.now() - t0); } times.push({ ms: best, h: r.y / U }); } }
  }
  console.log(`  the five slowest calls (call number, ms): ${times.map((t, i) => [i, t.ms]).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([i, m]) => `#${i} ${m.toFixed(2)}`).join(', ')}`);
  times.splice(0, 50); // the first calls include compiling the function
  const ms = times.map((t) => t.ms).sort((a, b) => a - b), hi = times.filter((t) => t.h > 200).map((t) => t.ms);
  console.log(`landingMark over ${times.length} calls (upgrades ${upText(up)}): median ${ms[ms.length >> 1].toFixed(3)} ms, p99 ${ms[Math.floor(ms.length * 0.99)].toFixed(3)} ms, max ${ms[ms.length - 1].toFixed(3)} ms; above 200 m up: ${hi.length} calls, max ${Math.max(0, ...hi).toFixed(3)} ms`);
  if (ms[ms.length - 1] > 2) fail('a landingMark call took over 2 ms');
}

if (flag('--rank')) {
  ran = true;
  // Amendments 1, 3 and 4 after the Build 1 review, at base equipment. Each zone's stops (an angle uniform over the zone's
  // band, seeded) flown with no input, two random taps, the good profile's burst, and the expert's in-flight planning (its
  // best plan): the medians must rank Perfect > Great > Good > Weak for every profile, Perfect at least 15 percent over Great
  // for no input and the burst. No unboosted Perfect stop (every 0.1 degree) ends in the first mud. The Weak-to-Good curve:
  // the no-input and burst medians by degree from the wedge's ends to the Good edges, with no step that more than doubles.
  // An unboosted Good stop reaches 500 m on at most 60 percent of seeds, with the burst on at least 90. Skill goals: a
  // zero-input Good or better stop (every 0.5 degree, 20 seeds) meets each on at most 20 percent.
  const seeds = seedList(nSeeds(200)), none = parseUp(''), n = seeds.length, mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const med = {};
  console.log('| zone | no input | two taps | burst | expert | no input 500 m | burst 500 m |');
  console.log('| --- | --- | --- | --- | --- | --- | --- |');
  for (const z of [0, 1, 2, 3]) {
    med[z] = {};
    const shares = {};
    for (const b of ['none', 'taps', 'burst', 'expert']) {
      const ms = (await parallel(`zone:${z}:${b}`, seeds, none)).map((x) => x.m);
      med[z][b] = pct(ms, 0.5); shares[b] = share(ms, (m) => m >= 500);
    }
    console.log(`| ${zoneName(z)} | ${med[z].none} | ${med[z].taps} | ${med[z].burst} | ${med[z].expert} | ${Math.round((100 * shares.none) / n)} % | ${Math.round((100 * shares.burst) / n)} % |`);
    if (z === 2) { med.goodNone = shares.none / n; med.goodBurst = shares.burst / n; }
  }
  let bad = 0;
  for (const b of ['none', 'taps', 'burst', 'expert']) {
    const ok = med[0][b] > med[1][b] && med[1][b] > med[2][b] && med[2][b] > med[3][b], lead = med[0][b] / med[1][b];
    const need = b === 'none' || b === 'burst';
    console.log(`${ok && (!need || lead >= 1.15) ? 'ok  ' : 'FAIL'} ${b}: Perfect ${med[0][b]} > Great ${med[1][b]} > Good ${med[2][b]} > Weak ${med[3][b]}; Perfect over Great x${lead.toFixed(2)}${need ? ' (at least 1.15)' : ''}`);
    if (!ok || (need && lead < 1.15)) bad++;
  }
  let inMud = 0, count = 0;
  const mud = sim.teachingChunk(none).ground.find((g) => g.kind === 'mud');
  for (let k = 0; k <= T.upgradeMax; k++) {
    const u = parseUp(`steady=${k}`), h = sim.needleOf(u).half[0];
    for (let a = T.sweetAngle - h; a <= T.sweetAngle + h + 1e-9; a += 0.1) for (const s of [1, 2, 3]) { const r = fly(s, sim.launchAt(+a.toFixed(2), u), u); count++; if (r.ended === 'mud' && r.x >= mud.x0 && r.x <= mud.x1) inMud++; }
  }
  console.log(`${inMud ? 'FAIL' : 'ok  '} unboosted Perfect stops ending in the first mud (${(mud.x0 / U).toFixed(0)} m): ${inMud} of ${count}`);
  if (inMud) bad++;
  const h2 = sim.needleOf(none).half[2], curve = [];
  const curveSeeds = seedList(40);
  for (const side of [-1, 1]) {
    const edge = T.sweetAngle + side * h2, far = side < 0 ? T.needleMin : T.needleMax, row = [];
    for (let a = far; side < 0 ? a <= edge + 2 : a >= edge - 2; a -= side) {
      const l = sim.launchAt(a, none);
      const nm = pct(curveSeeds.map((s) => sim.metres(fly(s, l, none))), 0.5), bm = pct(curveSeeds.map((s) => sim.metres(burstFlight(s, l, none, makeRng(s * 31 + 7)))), 0.5);
      row.push({ a, z: l.zone, nm, bm });
    }
    curve.push(row);
    console.log(`Weak to Good, ${side < 0 ? 'low' : 'high'} side (deg zone: no input / burst medians): ${row.map((r) => `${r.a}${'PGgW'[r.z]} ${r.nm}/${r.bm}`).join(', ')}`);
  }
  let worst = 0;
  for (const row of curve) for (let i = 1; i < row.length; i++) for (const k of ['nm', 'bm']) worst = Math.max(worst, row[i][k] / Math.max(1, row[i - 1][k]));
  console.log(`${worst <= 2 ? 'ok  ' : 'FAIL'} the largest step between neighbouring degrees on the way to Good: x${worst.toFixed(2)} (at most x2)`);
  if (worst > 2) bad++;
  console.log(`${med.goodNone <= 0.6 ? 'ok  ' : 'FAIL'} an unboosted Good stop reaches 500 m on ${Math.round(med.goodNone * 100)} % (at most 60)`);
  console.log(`${med.goodBurst >= 0.9 ? 'ok  ' : 'FAIL'} a Good stop with the burst reaches 500 m on ${Math.round(med.goodBurst * 100)} % (at least 90)`);
  if (med.goodNone > 0.6 || med.goodBurst < 0.9) bad++;
  const skill = sim.GOALS.filter((g) => ['springs', 'chain', 'boostSprings', 'birds'].includes(g.stat) && !(g.stat === 'birds' && g.need === 1));
  const hits = Object.fromEntries(skill.map((g) => [g.id, 0])); let tot = 0;
  for (let a = T.sweetAngle - h2; a <= T.sweetAngle + h2 + 1e-9; a += 0.5) for (const s of seedList(20)) {
    const r = fly(s, sim.launchAt(+a.toFixed(2), none), none), st = sim.goalStats(r, 1, 0); tot++;
    for (const g of skill) if (st[g.stat] >= g.need) hits[g.id]++;
  }
  const worstGoal = Math.max(...Object.values(hits)) / tot;
  console.log(`${worstGoal <= 0.2 ? 'ok  ' : 'FAIL'} skill goals met by a zero-input Good or better stop: ${skill.map((g) => `${g.id} ${Math.round((100 * hits[g.id]) / tot)} %`).join(', ')} (each at most 20)`);
  if (worstGoal > 0.2) bad++;
  if (bad) failed = true;
}

if (flag('--targets')) {
  ran = true;
  // PRD v0.2 G at base equipment: a Good launch (an angle uniform over the Good band, both sides) reaches 500 m on at least 90
  // percent of seeds and a Weak launch on under 30, both with the good profile's burst of boosts; the careless profile reaches
  // 500 m on 40 to 70 percent. Also: each zone with no boosts and with two taps, and each profile's zone mix and milestones.
  const seeds = seedList(nSeeds(200)), none = parseUp(''), n = seeds.length;
  console.log(`base equipment, ${n} seeds; sweetAngle ${T.sweetAngle}, zones +-${T.zonePerfect}/${T.zoneGreat}/${T.zoneGood} deg, powers ${T.zonePower.join('/')}, needle ${T.needleMin} to ${T.needleMax} deg in ${T.needlePeriod} s`);
  console.log('| launch | boosts | 500 m | 1000 m | median m | p10 | p90 |');
  console.log('| --- | --- | --- | --- | --- | --- | --- |');
  const res = {};
  for (const z of [0, 1, 2, 3]) for (const b of ['burst', 'taps', 'none']) {
    const ms = (await parallel(`zone:${z}:${b}`, seeds, none)).map((x) => x.m);
    res[`${z}:${b}`] = ms;
    console.log(`| ${zoneName(z)} | ${b === 'burst' ? 'burst after 2 springs' : b === 'taps' ? 'two random taps' : 'none'} | ${share(ms, (m) => m >= 500)} (${Math.round((100 * share(ms, (m) => m >= 500)) / n)} %) | ${share(ms, (m) => m >= 1000)} | ${pct(ms, 0.5)} | ${pct(ms, 0.1)} | ${pct(ms, 0.9)} |`);
  }
  console.log('| profile | zones P/G/Gd/W | 500 m | 1000 m | 2000 m | median m | p10 | p90 |');
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- |');
  const prof = {};
  for (const name of ['expert', 'good', 'careless']) {
    const out = await parallel(name, seeds, none), ms = out.map((x) => x.m);
    prof[name] = ms;
    console.log(`| ${name} | ${[0, 1, 2, 3].map((z) => share(out, (x) => x.zone === z)).join('/')} | ${share(ms, (m) => m >= 500)} (${Math.round((100 * share(ms, (m) => m >= 500)) / n)} %) | ${share(ms, (m) => m >= 1000)} | ${share(ms, (m) => m >= 2000)} | ${pct(ms, 0.5)} | ${pct(ms, 0.1)} | ${pct(ms, 0.9)} |`);
  }
  const good = share(res['2:burst'], (m) => m >= 500) / n, weak = share(res['3:burst'], (m) => m >= 500) / n, care = share(prof.careless, (m) => m >= 500) / n;
  console.log(`${good >= 0.9 ? 'ok  ' : 'FAIL'} a Good launch reaches 500 m on ${Math.round(good * 100)} % of seeds (target at least 90)`);
  console.log(`${weak < 0.3 ? 'ok  ' : 'FAIL'} a Weak launch reaches 500 m on ${Math.round(weak * 100)} % of seeds (target under 30)`);
  console.log(`${care >= 0.4 && care <= 0.7 ? 'ok  ' : 'FAIL'} the careless profile reaches 500 m on ${Math.round(care * 100)} % of flights (target 40 to 70)`);
  if (good < 0.9 || weak >= 0.3 || care < 0.4 || care > 0.7) failed = true;
}

if (flag('--clean')) {
  ran = true;
  // The fixed first chunk's promise (PRD v0.2 C and D; amendment 1 after the v4 gate): at every Band, Aero and Steady level,
  // every Good or better needle stop (0.5 degree steps) lands first on spring A, with no input; and Good launches with the
  // good profile's burst reach 500 m on at least 90 percent of seeds at every level (no purchase makes the same stop worse).
  const seeds = seedList(nSeeds(200)), M = T.upgradeMax;
  const t0 = sim.teachingChunk(parseUp(''));
  console.log(`teaching chunk at base: ${t0.ground.map((g) => `${g.kind} ${(g.x0 / U).toFixed(0)} to ${(g.x1 / U).toFixed(0)} m`).join(', ')}; bird at ${(t0.bird.x0 / U).toFixed(0)} m, ${(t0.bird.y / U).toFixed(0)} m up`);
  console.log('| band | aero | steady | spring A (m) | springs to (m) | Good+ stops | first contact on A | Good launch 500 m (burst) |');
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- |');
  let misses = 0, low = 1;
  for (let b = 0; b <= M; b++) for (let a = 0; a <= M; a++) for (let k = 0; k <= M; k++) {
    const up = parseUp(`band=${b},aero=${a},steady=${k}`), sA = sim.teachingChunk(up).ground[0], h = sim.needleOf(up).half[2];
    let n = 0, onA = 0;
    for (let ang = T.sweetAngle - h; ang <= T.sweetAngle + h + 1e-9; ang += 0.5) {
      const r = sim.newRun(1, sim.launchAt(ang, up), up); n++;
      while (!r.ended && !r.ev.some((e) => e.k !== 'boost' && e.k !== 'milestone') && r.mode === 'air') sim.stepRun(r);
      if (r.ev.some((e) => e.k === 'spring') && r.x >= sA.x0 && r.x <= sA.x1) onA++;
    }
    misses += n - onA;
    const good = (await parallel('zone:2:burst', seeds, up)).map((x) => x.m), gs = share(good, (m) => m >= 500) / seeds.length;
    low = Math.min(low, gs);
    const sp = sim.teachingChunk(up).ground.filter((g) => g.kind === 'spring');
    console.log(`| ${b} | ${a} | ${k} | ${(sA.x0 / U).toFixed(0)} to ${(sA.x1 / U).toFixed(0)} | ${(sp[sp.length - 1].x1 / U).toFixed(0)} (${sp.length} springs) | ${n} | ${onA} | ${Math.round(gs * 100)} % |`);
  }
  console.log(`${misses ? 'FAIL' : 'ok  '} every Good or better stop at every level lands first on spring A (${misses} misses)`);
  console.log(`Good launches with the burst reach 500 m on at least ${Math.round(low * 100)} % of seeds at every level (information; no-harm is --ladder)`);
  if (misses) failed = true;
}

if (flag('--expert')) {
  ran = true;
  const up = parseUp(value('--up')), seeds = seedList(nSeeds(200));
  const res = await parallel('expert', seeds, up), ms = res.map((x) => x.m);
  console.log(`expert bot, upgrades ${upText(up)}, ${seeds.length} seeds: ${dist(ms)}`);
  console.log(`  seeds reaching each milestone: ${reach(ms)}`);
  const plans = {}; for (const x of res) plans[x.plan] = (plans[x.plan] || 0) + 1;
  console.log(`  chosen stops: angle ${dist(res.map((x) => x.angle))}; Perfect ${share(res, (x) => x.zone === 0)}, Great ${share(res, (x) => x.zone === 1)}; flight seconds ${dist(res.map((x) => x.secs))}`);
  console.log(`  ends: mud ${share(res, (x) => x.why === 'mud')}, stop ${share(res, (x) => x.why === 'stop')}; springs median ${pct(res.map((x) => x.springs), 0.5)}, birds median ${pct(res.map((x) => x.birds), 0.5)}`);
  console.log(`  seconds to pass 500 m: ${dist(res.filter((x) => x.t500).map((x) => x.t500))}`);
  const p90 = pct(res.map((x) => x.secs), 0.9);
  console.log(`${p90 < 75 ? 'ok  ' : 'FAIL'} 90 percent of expert flights last under 75 s (p90 ${p90} s; the decision after Build 1 round 2)`);
  if (p90 >= 75) failed = true;
}

if (flag('--upgrades')) {
  ran = true;
  const seeds = seedList(nSeeds(200));
  const sets = [parseUp('')];
  for (const k of KEYS) for (const l of [1, 2]) sets.push(parseUp(`${k}=${l}`));
  for (let i = 0; i < KEYS.length; i++) for (let j = i + 1; j < KEYS.length; j++) sets.push(parseUp(`${KEYS[i]}=1,${KEYS[j]}=1`));
  const best = {};
  console.log(`expert bot over ${seeds.length} seeds: distance percentiles and seeds reaching each milestone`);
  console.log(`| upgrades | levels | p10 | median | p90 | max | flight s p90 | ${T.milestones.map((m) => `${m} m`).join(' | ')} |`);
  console.log(`| --- | --- | --- | --- | --- | --- | --- | ${T.milestones.map(() => '---').join(' | ')} |`);
  let longest = 0;
  for (const up of sets) {
    const res = await parallel('expert', seeds, up), ms = res.map((x) => x.m), lv = Object.values(up).reduce((a, b) => a + b, 0), secs = pct(res.map((x) => x.secs), 0.9);
    longest = Math.max(longest, secs);
    console.log(`| ${upText(up)} | ${lv} | ${pct(ms, 0.1)} | ${pct(ms, 0.5)} | ${pct(ms, 0.9)} | ${Math.max(...ms)} | ${secs} | ${T.milestones.map((m) => ms.filter((x) => x >= m).length).join(' | ')} |`);
    for (const m of T.milestones) { const n = ms.filter((x) => x >= m).length; if (!best[m] || n > best[m].n) best[m] = { n, up }; }
  }
  // Reachable: the bot reaches it on at least a quarter of the seeds with some set of at most two levels.
  const need = Math.ceil(seeds.length / 4);
  for (const m of T.milestones) {
    const b = best[m], ok = b.n >= need;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${m} m: best ${upText(b.up)}, ${b.n} of ${seeds.length} seeds (reachable means at least ${need})`);
    if (!ok) failed = true;
  }
  console.log(`the longest expert p90 flight over these sets: ${longest} s (information; the rule is the base set, --expert)`);
}

if (flag('--buys')) {
  ran = true;
  // Every upgrade state (each of the five upgrades 0 to upgradeMax): each profile's median distance, then from each state the
  // next single level that adds the most median distance per sugar. Every upgrade must be the best next buy for some profile
  // somewhere (PRD v0.2 D, the v0.1 rule). The expert is the planner over --seeds (40); the good and careless profiles fly
  // one flight per seed over --pseeds (200).
  const eSeeds = seedList(nSeeds(40)), pSeeds = seedList(Number(value('--pseeds') ?? 200)), M = T.upgradeMax, cache = value('--cache');
  const states = [];
  const rec = (i, u) => { if (i === KEYS.length) { states.push({ ...u }); return; } for (let l = 0; l <= M; l++) rec(i + 1, { ...u, [KEYS[i]]: l }); };
  rec(0, {});
  let saved = {};
  if (cache) { try { saved = JSON.parse(readFileSync(cache, 'utf8')); } catch {} }
  const meds = {};
  for (const name of ['expert', 'good', 'careless']) {
    const n = name === 'expert' ? eSeeds : pSeeds, ck = `${name}:${n.length}:${T.sweetAngle}`;
    const med = new Map(Object.entries(saved[ck] || {}));
    const todo = states.filter((u) => !med.has(stateKey(u)));
    for (let i = 0; i < todo.length; i += 16) { // saved every 16 states, so a cut-off run loses little
      for (const x of await parallelStates(name, todo.slice(i, i + 16), n)) med.set(x.key, x.med);
      if (cache) { saved[ck] = Object.fromEntries(med); writeFileSync(cache, JSON.stringify(saved)); }
    }
    meds[name] = med;
  }
  const bestBuy = (med, u) => {
    let best = null;
    for (const k of KEYS) {
      if (u[k] >= M) continue;
      const nu = { ...u, [k]: u[k] + 1 }, price = T.upgradePrices[k][u[k]], gain = med.get(stateKey(nu)) - med.get(stateKey(u));
      const per = (100 * gain) / price;
      if (!best || per > best.per) best = { k, per, gain, price, nu };
    }
    return best;
  };
  const anyBest = Object.fromEntries(KEYS.map((k) => [k, 0]));
  console.log(`best next buy per sugar, count of the ${states.length - 1} states that can buy, per profile (expert ${eSeeds.length} seeds, others ${pSeeds.length}):`);
  console.log(`| profile | ${KEYS.join(' | ')} | greedy order from a fresh save (median m after each) |`);
  console.log(`| --- | ${KEYS.map(() => '---').join(' | ')} | --- |`);
  for (const [name, med] of Object.entries(meds)) {
    const count = Object.fromEntries(KEYS.map((k) => [k, 0]));
    for (const u of states) { const b = bestBuy(med, u); if (b) { count[b.k]++; anyBest[b.k]++; } }
    let u = parseUp(''), path = [];
    for (let b = bestBuy(med, u); b; b = bestBuy(med, u)) { path.push(`${b.k} ${b.nu[b.k]} (${med.get(stateKey(b.nu))})`); u = b.nu; }
    console.log(`| ${name} (fresh ${med.get(stateKey(parseUp('')))} m) | ${KEYS.map((k) => count[k]).join(' | ')} | ${path.slice(0, 8).join(', ')}${path.length > 8 ? ', ...' : ''} |`);
  }
  if (flag('--detail')) for (const [name, med] of Object.entries(meds)) for (const u of states) { const b = bestBuy(med, u); if (b && b.k === 'steady') console.log(`  ${name}: ${KEYS.map((k) => `${k[0]}${u[k]}`).join(' ')} median ${med.get(stateKey(u))} m: steady ${b.nu.steady} for ${b.price}, +${b.gain} m (${b.per.toFixed(1)} m per 100 sugar)`); }
  for (const k of KEYS) if (!anyBest[k]) fail(`${k} is never any profile's best next buy`);
  if (anyBest.steady) console.log(`ok   every upgrade is some profile's best next buy somewhere; Steady in ${anyBest.steady} profile-states`);
}

if (flag('--pacing')) {
  ran = true;
  // A fresh save flown by one profile, one seed per flight (1, 2, ...), buying the cheapest next level as soon as it is
  // affordable; sugar is the flight's plus the one-time milestone bonuses plus the goals it pays (PRD v0.2 B).
  const M = T.upgradeMax, maxFlights = Number(value('--flights') ?? 300);
  const pace = (name) => {
    let u = parseUp(''), sugar = 0, flights = 0, earned = 0, fromGoals = 0, done = [], perfectRow = 0, firstGoalsSugar = null, goalFlight = null;
    const reached = new Set(), rows = [], dists = [], goalsAt = [];
    const next = () => KEYS.filter((k) => u[k] < M).map((k) => ({ k, price: T.upgradePrices[k][u[k]] })).sort((a, b) => a.price - b.price)[0];
    while (next() && flights < maxFlights) {
      const f = profileFlight(name, ++flights, u);
      let bonus = 0; T.milestones.forEach((m, i) => { if (f.m >= m && !reached.has(m)) { reached.add(m); bonus += T.milestoneBonus[i]; } });
      perfectRow = f.launch.zone === 0 ? perfectRow + 1 : 0;
      const gs = sim.settleGoals(done, sim.goalStats(f.r, flights, perfectRow));
      done = gs.done; for (const g of gs.paid) goalsAt.push(`${g.id} ${flights}`);
      if (gs.paid.length && done.length === sim.GOALS.length) goalFlight = flights;
      const got = sim.coinsOf(f.r) + bonus + gs.sugar;
      sugar += got; earned += got; fromGoals += gs.sugar; dists.push(f.m);
      for (let n = next(); n && sugar >= n.price; n = next()) {
        sugar -= n.price; u = { ...u, [n.k]: u[n.k] + 1 };
        if (firstGoalsSugar === null) firstGoalsSugar = [fromGoals, earned];
        const recent = dists.slice(-10).sort((a, b) => a - b);
        rows.push({ flight: flights, text: `| ${rows.length + 1} | ${n.k} ${u[n.k]} | ${n.price} | ${flights} | ${earned} | ${fromGoals} | ${recent[Math.floor(recent.length / 2)]} |` });
      }
    }
    console.log(`${name} profile from a fresh save, cheapest next level first (sugar per flight so far: ${(earned / flights).toFixed(0)}; ${Math.round((100 * fromGoals) / earned)} % of it from goals):`);
    console.log('| buy | upgrade | price | after flight | sugar earned so far | of which goals | median of the last 10 flights (m) |');
    console.log('| --- | --- | --- | --- | --- | --- | --- |');
    for (const r of rows) console.log(r.text);
    if (next()) console.log(`not finished after ${maxFlights} flights`);
    if (firstGoalsSugar) console.log(`  by the first purchase: ${firstGoalsSugar[1]} sugar earned, ${firstGoalsSugar[0]} of it from goals`);
    console.log(`  goals paid (id, flight): ${goalsAt.join(', ')}`);
    if (name === 'good') goodGoalsDone = done.length === sim.GOALS.length ? goalFlight : null;
    return rows;
  };
  let goodGoalsDone = null;
  const good = pace('good');
  const careless = pace('careless');
  if (!good.length || good[0].flight > 5) fail('the good profile\'s first purchase comes after flight 5');
  const lastBuy = good.length ? good[good.length - 1].flight : Infinity;
  console.log(`${lastBuy >= 40 ? 'ok  ' : 'FAIL'} the good profile clears the shop after flight ${lastBuy} (amendment 5: no sooner than 40); every goal: ${goodGoalsDone ?? 'not within the run'}`);
  if (lastBuy < 40 || (goodGoalsDone !== null && goodGoalsDone < 35)) failed = true;
  if (!careless.length || careless[0].flight > 10) fail('the careless profile\'s first purchase comes after flight 10');
  else console.log(`ok   the careless profile's first purchase comes after flight ${careless[0].flight} (target within ten)`);
}

if (flag('--camera')) {
  ran = true;
  // The expert's best flight per seed replayed with the game's camera at 60 frames a second, for each phone size.
  const up = parseUp(value('--up')), seeds = Array.from({ length: nSeeds(200) }, (_, i) => i + 1);
  const res = await parallel('camera', seeds, up);
  for (const [k, name] of CAM_SIZES.map((sz, i) => [i, sz.name])) {
    const rows = res.map((x) => x.cams[k]), sum = (f) => rows.reduce((a, b) => a + f(b), 0);
    const frames = sum((c) => c.frames), off = sum((c) => c.off), low = sum((c) => c.lowFrames), offLow = sum((c) => c.offLow);
    const arcs = sum((c) => c.arcs), seen = sum((c) => c.seen), need = rows.flatMap((c) => c.need).sort((a, b) => a - b);
    const px = rows.flatMap((c) => c.px).sort((a, b) => a - b), lifted = sum((c) => c.lifted);
    console.log(`${name}: frames ${frames}; critter off screen ${off} (${((100 * off) / frames).toFixed(2)} %), off screen while under 600 m up ${offLow} of ${low}; ` +
      `sky panned (critter above what zoom ${T.zoomMin} fits, band pinned) ${((100 * lifted) / frames).toFixed(1)} % of frames`);
    console.log(`  arcs ${arcs}: landing on screen at the top of the arc ${seen} (${((100 * seen) / arcs).toFixed(1)} %); zoom floor that would show 90 % of them (critter at the left limit) ${need[Math.floor(0.1 * need.length)].toFixed(3)}, 75 %: ${need[Math.floor(0.25 * need.length)].toFixed(3)}`);
    console.log(`  critter speed on screen (CSS px per 60 Hz frame at the zoom in effect): median ${px[Math.floor(px.length / 2)].toFixed(1)}, p99 ${px[Math.floor(0.99 * px.length)].toFixed(1)}, max ${px[px.length - 1].toFixed(1)}`);
  }
}

if (flag('--fps')) {
  ran = true;
  // The expert's needle stop becomes a tap time on the needle's second up-stroke; the tap and the expert's own inputs (pulses,
  // and with the Rocket holds and releases, each queued when the expert decided it, as a press arrives) are replayed through
  // frames at several rates: before the launch the needle is drawn once a frame, and a tap that arrives
  // during a frame launches at the needle's angle at the tap's own time (as the play scene samples it at the event), then the
  // flight advances in whole physics steps with the pulses stamped in flight time. The angle a frame-sampled needle would
  // have given is shown too (what the stamp avoids).
  const seeds = seedList(nSeeds(20)), up = parseUp(value('--up')), n = sim.needleOf(up), seen = { geyser: 0, cloud: 0 };
  let bad = 0, worstFrame = 0;
  for (const s of seeds) {
    const b = expertBest(s, up), times = [];
    const tap = n.period + ((b.angle - T.needleMin) / (T.needleMax - T.needleMin)) * (n.period / 2);
    const rec = sim.newRun(s, sim.needleLaunch(tap, up), up), ctl = expertCtl(b.plan);
    const evRec = [];
    while (!rec.ended) { for (const e of rec.ev) evRec.push(e.k); const k = rec.q.length; ctl(rec); for (const e of rec.q.slice(k)) times.push({ ...e, qt: rec.steps * STEP }); sim.stepRun(rec); }
    for (const e of rec.ev) evRec.push(e.k);
    const jit = makeRng(s);
    const modes = [['30', () => 1 / 30], ['60', () => 1 / 60], ['120', () => 1 / 120], ['jitter', () => 1 / 144 + jit() * (1 / 20 - 1 / 144)]];
    const out = modes.map(([name, dt]) => {
      let clock = 0, r = null, fc = 0, i = 0, frames = 0, frameAngle = null;
      while ((!r || !r.ended) && frames < 200000) {
        const d = Math.min(dt(), 1 / 20);
        if (!r) {
          if (tap < clock + d) { // the tap arrives during this frame
            r = sim.newRun(s, sim.needleLaunch(tap, up), up); frameAngle = sim.needleAngle(clock, up);
            fc = 0; const rest = clock + d - tap;
            while (i < times.length && times[i].qt < fc + rest) { sim.queueInput(r, times[i].at, times[i].kind); i++; }
            sim.advance(r, rest); fc += rest;
          }
        } else {
          while (i < times.length && times[i].qt < fc + d) { sim.queueInput(r, times[i].at, times[i].kind); i++; }
          sim.advance(r, d); fc += d;
        }
        clock += d; frames++;
      }
      return { name, m: sim.metres(r), x: r.maxX, steps: r.steps, angle: r.launch.angle, frameAngle, ev: r.ev.map((e) => e.k).join() };
    });
    const same = out.every((o) => o.x === out[0].x && o.steps === out[0].steps && o.angle === out[0].angle && o.ev === evRec.join()) && out[0].m === sim.metres(rec);
    const ng = evRec.filter((k) => k === 'geyser').length, nc = evRec.filter((k) => k === 'cloud').length;
    seen.geyser += ng; seen.cloud += nc;
    if (!same) bad++;
    worstFrame = Math.max(worstFrame, ...out.map((o) => Math.abs(o.frameAngle - o.angle)));
    console.log(`seed ${s}: tap at ${tap.toFixed(4)} s, needle ${out[0].angle.toFixed(2)} deg (${zoneName(rec.launch.zone)}), ${times.filter((e) => e.kind === 'pulse').length} pulses${times.some((e) => e.kind === 'holdOn') ? ` and ${times.filter((e) => e.kind === 'holdOn').length} holds` : ''}, ${ng} geysers, ${nc} clouds; ${out.map((o) => `${o.name} fps ${o.m} m (${o.steps} steps)`).join(', ')}${same ? '' : '  DIFFERENT'}`);
  }
  console.log(`geyser lifts ${seen.geyser}, cloud passes ${seen.cloud} over these flights (the same events in the same order at every rate)`);
  if (flag('--objects') && (!seen.geyser || !seen.cloud)) fail('--objects: no geyser or no cloud met; fly with more upgrades');
  console.log(`a needle sampled at the frame instead of the tap would have been off by up to ${worstFrame.toFixed(1)} deg`);
  if (bad) fail(`${bad} seeds give different flights at different frame rates`);
  else console.log(`ok   identical needle angle, distance (to the unit) and step count at 30, 60, 120 fps and jittery frames on all ${seeds.length} seeds`);
}

if (flag('--check')) {
  ran = true;
  const seeds = nSeeds(500), toM = 8000;
  let worstGap = 0, mudNoSpring = 0, overlaps = 0, springBeforeMud = 0;
  const tierCount = {};
  for (let s = 1; s <= seeds; s++) {
    const f = sim.makeField(s); sim.ensureField(f, toM * U);
    const g = f.ground.filter((o) => o.x0 < toM * U);
    for (let i = 1; i < g.length; i++) if (g[i].x0 < g[i - 1].x1 + 2 * T.critterR) overlaps++;
    let lastSpring = 0, springSince = true, first = true;
    for (const o of g) {
      if (o.kind === 'spring') { worstGap = Math.max(worstGap, o.x0 - lastSpring); lastSpring = o.x1; springSince = true; }
      if (o.kind === 'mud') { if (!springSince) mudNoSpring++; if (first) springBeforeMud++; springSince = false; first = false; }
    }
    worstGap = Math.max(worstGap, toM * U - lastSpring - T.chunkLen); // the tail may end mid-chunk
    for (let c = 1; c < f.chunks; c++) { const t = sim.tierAt((c * T.chunkLen) / U); tierCount[t] = (tierCount[t] || 0) + 1; }
  }
  console.log(`field check over ${seeds} seeds to ${toM} m: widest gap between springs ${(worstGap / U).toFixed(1)} m (rule 150), mud without a spring since the last mud ${mudNoSpring}, overlapping ground objects ${overlaps}; chunks per tier ${JSON.stringify(tierCount)}`);
  if (worstGap > 150 * U) fail('a stretch longer than 150 m has no spring');
  if (mudNoSpring) fail('two mud patches with no spring between');
  if (overlaps) fail('ground objects overlap');

  // PRD v0.2 F: geysers from Soda Springs (tier 2, 2000 m) on, clouds from Gingerbread Town (tier 3, 3500 m) on, each with at
  // least three templates per place that use it; nothing else changed in tiers 0 and 1. In the seeded fields: no geyser before
  // 2000 m, no cloud before 3500 m, and every cloud clear of every bird's glide.
  const uses = (c, k) => c.objects.some((o) => o.kind === k);
  const per = (tier, k) => sim.CHUNKS.filter((c) => c.tiers.includes(tier) && uses(c, k)).length;
  const counts = [0, 1, 2, 3].map((t) => ({ t, all: sim.CHUNKS.filter((c) => c.tiers.includes(t)).length, geyser: per(t, 'geyser'), cloud: per(t, 'cloud') }));
  console.log(`templates per tier (all / with geysers / with clouds): ${counts.map((c) => `tier ${c.t} ${c.all}/${c.geyser}/${c.cloud}`).join(', ')}; places by tier: Bakery and Candy Meadow 0, Chocolate River 1, Soda Springs 2, Gingerbread Town and Home 3`);
  if (counts[0].geyser + counts[1].geyser + counts[0].cloud + counts[1].cloud + counts[2].cloud) fail('a new object in a place before its own');
  if (counts[2].geyser < 3 || counts[3].geyser < 3 || counts[3].cloud < 3) fail('a place has fewer than three templates using its new objects');
  let early = 0, nearBird = 0, geysers = 0, clouds = 0;
  for (let sd = 1; sd <= seeds; sd++) {
    const f = sim.makeField(sd); sim.ensureField(f, toM * U);
    for (const g of f.ground) if (g.kind === 'geyser') { geysers++; if (g.x0 < T.tierFrom[2] * U) early++; }
    for (const c of f.clouds) { clouds++; if (c.x < T.tierFrom[3] * U) early++; for (const b of f.birds) if (Math.abs(b.x0 - c.x) < T.birdSwing + T.cloudRX + T.birdR + T.critterR && Math.abs(b.y - c.y) < T.cloudRY + T.birdR + 2 * T.critterR) nearBird++; }
  }
  console.log(`seeded fields: ${geysers} geysers, ${clouds} clouds; before their place ${early}; clouds within a bird's glide ${nearBird}`);
  if (early) fail('a geyser or cloud before its place');
  if (nearBird) fail('a cloud in a bird\'s glide');

  // The new objects' rules, flown through the real step: a geyser lifts at geyserLift keeping vx only while it erupts on the
  // flight clock, once; a dormant vent is plain ground; a cloud takes cloudDrag of the speed and refills cloudFuel, once.
  const none = parseUp(''), vent = (phase) => ({ seed: 0, rng: null, ground: [{ kind: 'geyser', x0: 1000, x1: 1040, w: 40, h: 0, spent: false, phase }], birds: [], clouds: [], end: 1e12, chunks: 1 });
  const drop = (field, t0) => { const r = sim.newRun(0, { angle: 0, power: 0, zone: 3 }, none, field); Object.assign(r, { x: 1020, y: 40, vx: 60, vy: -300, steps: Math.round(t0 / STEP) }); const vx0 = r.vx; while (!r.ended && !r.ev.some((e) => e.k !== 'boost')) sim.stepRun(r); return { k: r.ev[0].k, vy: r.vy, keep: r.vx / vx0, r }; };
  const on = drop(vent(0), 0.1), off = drop(vent(0), 1.5), phased = drop(vent(1.0), 1.5);
  const again = (() => { const r = on.r; r.ev.length = 0; Object.assign(r, { x: 1020, y: 40, vx: 60, vy: -300, mode: 'air', steps: Math.round((T.geyserPeriod + 0.1) / STEP) }); while (!r.ended && !r.ev.length) sim.stepRun(r); return r.ev[0] ? r.ev[0].k : r.ended; })();
  const cl = { seed: 0, rng: null, ground: [], birds: [], clouds: [{ x: 1000, y: 300, used: false }], end: 1e12, chunks: 1 };
  const rc = sim.newRun(0, { angle: 0, power: 0, zone: 3 }, none, cl); Object.assign(rc, { x: 900, y: 300 - T.critterR, vx: 400, vy: 0, fuel: 2 });
  let sp0 = 0, sp1 = 0;
  while (!rc.ev.some((e) => e.k === 'cloud')) { sp0 = Math.hypot(rc.vx * rc.st.dragK, (rc.vy - T.gravity * STEP) * rc.st.dragK); sim.stepRun(rc); }
  sp1 = Math.hypot(rc.vx, rc.vy); const fuelAfter = rc.fuel;
  rc.ev.length = 0; Object.assign(rc, { x: 900, y: 300 - T.critterR, vx: 400, vy: 0 }); for (let i = 0; i < 60; i++) sim.stepRun(rc);
  const twice = rc.ev.some((e) => e.k === 'cloud');
  console.log(`geyser: erupting ${on.k} (vy ${on.vy.toFixed(0)}, vx kept x${on.keep.toFixed(3)}), dormant ${off.k}, its own phase (on at 1.5 s) ${phased.k}, the same vent erupting again ${again}`);
  console.log(`cloud: speed x${(sp1 / sp0).toFixed(3)} (1 - cloudDrag ${1 - T.cloudDrag}), fuel 2 to ${fuelAfter}, a second pass ${twice ? 'counted again' : 'ignored'}`);
  if (on.k !== 'geyser' || Math.abs(on.vy - T.geyserLift) > 1e-6 || on.keep < 0.99 || off.k === 'geyser' || phased.k !== 'geyser' || again === 'geyser') fail('the geyser rule');
  if (Math.abs(sp1 / sp0 - (1 - T.cloudDrag)) > 0.01 || fuelAfter !== 2 + T.cloudFuel || twice) fail('the cloud rule');
}

if (!ran) die('nothing to do: give --targets, --sweet, --rank, --ladder, --mark, --clean, --expert, --upgrades, --buys, --pacing, --camera, --fps, --check, --contrast, --fly or --why');
console.log(failed ? 'RESULT: FAIL' : 'RESULT: PASS');
process.exit(failed ? 1 : 0);
