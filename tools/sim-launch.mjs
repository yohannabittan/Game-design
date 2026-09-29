#!/usr/bin/env node
// sim-launch: fly Launch's real physics (games/launch/src/game.js, via game.sim) headlessly.
//
//   node tools/sim-launch.mjs --clean                  the naked 500 m proof: a clean launch on the fixed first chunk, its launch window
//   node tools/sim-launch.mjs --expert [--up band=1,fuel=1] [--seeds 200]
//                                                     expert bot: a searched launch, then each arc planned on its rising half
//                                                     (pulses or a Rocket hold that land it on a spring or a ramp), mud saves
//   node tools/sim-launch.mjs --upgrades [--seeds 200] the expert bot with no upgrades, each single upgrade at level 1 and 2, and every
//                                                     pair at level 1: milestone reach per set, and whether each milestone is reachable
//                                                     with at most two upgrade levels in total
//   node tools/sim-launch.mjs --naive [--seeds 200]    random pull angles 20 to 70 degrees, random powers, random boost taps;
//                                                     then the same at full pull every time,
//                                                     and the review's sloppy human (3 degrees of aim noise, a 5-tap burst)
//   node tools/sim-launch.mjs --camera [--seeds 200] [--up ...]
//                                                     the game's camera over the expert's flights at 844x390 and 640x360: share of frames
//                                                     the critter is off screen, share of arcs whose landing is on screen at the arc's top,
//                                                     the zoom floor that would show 90 percent, and on-screen speed in px per frame
//   node tools/sim-launch.mjs --buys [--seeds 40] [--cache FILE] [--limit N]
//                                                     the expert's median in every upgrade state and the best next buy (median metres per
//                                                     coin) from each; every upgrade must be the best buy somewhere
//   node tools/sim-launch.mjs --pacing [--flights 300] the sloppy human from a fresh save buying the cheapest next level: flights to each
//   node tools/sim-launch.mjs --fps [--seeds 20]       the same seed and inputs at 30, 60 and 120 fps (and jittery frames) give the same distance
//   node tools/sim-launch.mjs --check [--seeds 500]    field fairness: a spring before every mud, none further apart than 150 m, no overlaps
//   node tools/sim-launch.mjs --fly ANGLE,POWER [--seed N] [--pulses T1,T2,...] [--up ...]   one flight with its event log
//   node tools/sim-launch.mjs --why SEED [--up ...]    the expert's best flight on one seed, contact by contact
//
// Upgrade sets are band, fuel, aero, rocket levels (their effects are TUNING.bandStep and the rest). Reachable means the
// expert reaches the milestone on at least a quarter of the seeds. Seeds are 1..N. Exit code 0 when every check run
// passes, 1 when one fails, 2 on a usage error.

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
const parseUp = (s) => {
  const up = { band: 0, fuel: 0, aero: 0, rocket: 0 };
  if (!s) return up;
  for (const kv of String(s).split(',')) { const [k, v] = kv.split('='); if (!(k in up) || !(Number(v) >= 0)) die(`bad upgrade "${kv}"`); up[k] = Number(v); }
  return up;
};
const upText = (up) => Object.entries(up).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(' + ') || 'none';
const U = T.unitsPerMetre;

// ---------- Flights ----------

// Fly one flight. `ctl(r)` runs before every step and may queue inputs at the current flight time. Returns the run.
function fly(seed, launch, up, ctl = null, maxSteps = Math.round(T.maxFlight / STEP) + 10) {
  const r = sim.newRun(seed, launch, up);
  while (!r.ended && r.steps < maxSteps) { if (ctl) ctl(r); sim.stepRun(r); }
  return r;
}

// Where the critter next comes down if it gets these inputs (times in flight seconds from now): pulses, and a hold of the
// Rocket from `hold[0]` to `hold[1]`. Flies with gravity and drag only (birds are ignored) until it meets the ground or a ramp.
// Returns { x, g } with g the ground object there (null: plain ground).
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
    if (y <= sh && (vy < 0 || (g && g.kind === 'ramp'))) return { x, g, fuelLeft: fuel };
  }
  return { x, g: null, fuelLeft: fuel };
}
const landKind = (g) => (!g ? 'ground' : g.kind === 'spring' ? (g.spent ? 'ground' : 'spring') : g.kind);

// The expert. The launch is searched (angle and power). Every arc, at the first step it is rising, the bot plans that arc:
// it tries firing nothing, or 1 to 3 pulses (with the Rocket: a press held for a while) starting at one of five points of the
// rising half, predicts each landing, and takes the cheapest plan that lands on a fresh spring or a ramp (a spring first),
// or failing that one that avoids mud. With nothing to aim at and more fuel than `plan.keep`, it spends up to `plan.spend`
// pulses at the start of the rise for distance. Falling, it still fires a pulse if that turns a mud or plain landing into a
// spring or ramp, and on the ground it hops before sliding into mud.
function expertCtl(plan) {
  let arcPlanned = false, queued = [], lastLook = -1, holdEnd = -1;
  return (r) => {
    const t = r.steps * STEP;
    for (const e of r.ev) if (e.k === 'spring' || e.k === 'bird' || e.k === 'bounce' || e.k === 'ramp') arcPlanned = false;
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
        const out = predict(r, c.p, c.hold), kind = landKind(out.g);
        if (!c.cost) base = kind;
        const score = (kind === 'spring' ? 10 : kind === 'ramp' ? 8 : kind === 'mud' ? -10 : 0) - c.cost - (c.p[0] || 0) * 0.01;
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
      const now = landKind(predict(r).g);
      if (now === 'spring' || now === 'ramp') return;
      const k2 = landKind(predict(r, [0]).g);
      if (k2 === 'spring' || k2 === 'ramp' || (now === 'mud' && k2 !== 'mud')) sim.queueInput(r, t, 'pulse');
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
  const tried = [];
  const run = (angle, power, plan) => { const r = fly(seed, { angle, power }, up, expertCtl(plan)); const res = { angle, power, plan, m: sim.metres(r), r }; tried.push(res); return res; };
  for (let a = 24; a <= 56; a += 2) for (let p = 0.7; p <= 1.0001; p += 0.05) run(a, +p.toFixed(2), PLANS[1]);
  tried.sort((x, y) => y.m - x.m);
  const top = tried.slice(0, 5);
  for (const t of top) {
    for (const plan of PLANS) run(t.angle, t.power, plan);
    for (const da of [-1, 1]) for (const dp of [-0.025, 0, 0.025]) run(t.angle + da, Math.min(1, +(t.power + dp).toFixed(3)), t.plan);
  }
  return tried.reduce((b, t) => (t.m > b.m ? t : b));
}

// Phone sizes for --camera: CSS size, design scale s, view width in design px (the engine fits 640 x 360 by height here).
const CAM_SIZES = [{ name: '844x390', w: 844, h: 390 }, { name: '640x360', w: 640, h: 360 }].map((z) => ({ ...z, s: Math.min(z.w / T.designW, z.h / T.designH), vw: z.w / Math.min(z.w / T.designW, z.h / T.designH) }));

function cameraFlight(seed, up) {
  const b = expertBest(seed, up), R = T.critterR;
  const r = sim.newRun(seed, { angle: b.angle, power: b.power }, up), ctl = expertCtl(b.plan);
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

// The review's sloppy human: aims 40 degrees with 3 degrees of noise (normal), always pulls fully (a full pull is a full pull,
// whatever the Band level), and fires a burst of every
// pulse 0.15 to 0.4 s apart, starting 0.15 to 0.4 s after the second spring (or after the first plain-ground touch, if that
// comes first: the player sees the chain is broken). With the Rocket the burst is one press, held until the arc tops out.
function sloppyFlight(seed, up) {
  const rng = makeRng(seed * 104729 + 7);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
  const angle = 40 + 3 * gauss(), gaps = Array.from({ length: 12 }, () => rng.range(0.15, 0.4));
  const r = sim.newRun(seed, { angle, power: 1 }, up);
  let springs = 0, fired = false, holding = false;
  while (!r.ended) {
    if (holding && r.mode === 'air' && r.vy <= 0) { sim.queueInput(r, r.steps * STEP, 'holdOff'); holding = false; }
    for (const e of r.ev) {
      if (e.k === 'spring') springs++;
      if (!fired && (springs >= 2 || e.k === 'bounce')) {
        fired = true;
        let t = r.steps * STEP + gaps[0];
        if (r.st.hold) { sim.queueInput(r, t, 'pulse'); sim.queueInput(r, t + T.holdDelay, 'holdOn'); holding = true; } // with the Rocket: one long press
        else for (let i = 0; i < Math.ceil(r.fuel); i++) { sim.queueInput(r, t, 'pulse'); t += gaps[i + 1]; }
      }
    }
    r.ev.length = 0;
    sim.stepRun(r);
  }
  return { m: sim.metres(r), angle, coins: sim.coinsOf(r) };
}

// The release-gate reviewer's careless player: a pull of 90 plus or minus 40 px (so rarely full), 40 plus or minus 15 degrees,
// and two taps somewhere in the first three seconds of the flight.
function carelessFlight(seed, up) {
  const rng = makeRng(seed * 7727 + 3);
  const L = 90 + (rng() * 2 - 1) * 40, angle = 40 + (rng() * 2 - 1) * 15, taps = [rng.range(0.2, 3), rng.range(0.2, 3)].sort((a, b) => a - b);
  const r = sim.newRun(seed, { angle, power: Math.min(1, L / T.pullMax) }, up);
  for (const t of taps) sim.queueInput(r, t, 'pulse');
  while (!r.ended) { r.ev.length = 0; sim.stepRun(r); }
  return { m: sim.metres(r), angle, coins: sim.coinsOf(r) };
}

function naiveFlight(seed, up, full = false) {
  const rng = makeRng(seed * 7919 + 13);
  const angle = rng.range(20, 70), power = full ? 1 : rng.range(0.3, 1);
  const fuel = sim.stats(up).fuelMax, taps = Array.from({ length: fuel }, () => rng.range(0, 12)).sort((a, b) => a - b);
  const r = sim.newRun(seed, { angle, power }, up);
  for (const t of taps) sim.queueInput(r, t, 'pulse');
  while (!r.ended) sim.stepRun(r);
  return { m: sim.metres(r), angle, power };
}

// ---------- Workers ----------

if (!isMainThread) {
  const { kind, seeds, up } = workerData;
  const out = seeds.map((s) => {
    if (kind === 'expert') { const b = expertBest(s, up); return { seed: s, m: b.m, angle: b.angle, power: b.power, plan: b.plan.name, springs: b.r.springs, birds: b.r.birds, why: b.r.ended, secs: +(b.r.steps * STEP).toFixed(1) }; }
    if (kind === 'sloppy') return { seed: s, ...sloppyFlight(s, up) };
    if (kind === 'camera') return { seed: s, ...cameraFlight(s, up) };
    return { seed: s, ...naiveFlight(s, up, kind === 'naive-full') };
  });
  parentPort.postMessage(out);
  process.exit(0);
}

const W = Math.max(1, Math.round(Number(value('--workers') ?? availableParallelism())));
async function parallel(kind, seeds, up) {
  const parts = Array.from({ length: W }, (_, k) => seeds.filter((s, i) => i % W === k)).filter((p) => p.length);
  const res = await Promise.all(parts.map((p) => new Promise((ok, no) => {
    const w = new Worker(new URL(import.meta.url), { workerData: { kind, seeds: p, up, argv: args } });
    w.once('message', ok); w.once('error', no);
  })));
  return res.flat().sort((a, b) => a.seed - b.seed);
}

// ---------- Reporting ----------

const pct = (xs, q) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const dist = (ms) => `min ${Math.min(...ms)}, p10 ${pct(ms, 0.1)}, p25 ${pct(ms, 0.25)}, median ${pct(ms, 0.5)}, p75 ${pct(ms, 0.75)}, p90 ${pct(ms, 0.9)}, max ${Math.max(...ms)}, mean ${Math.round(ms.reduce((a, b) => a + b, 0) / ms.length)}`;
const reach = (ms) => T.milestones.map((m) => `${m} m ${ms.filter((x) => x >= m).length}`).join(', ');
let failed = false;
const fail = (msg) => { failed = true; console.log(`FAIL ${msg}`); };
let ran = false;

if (flag('--fly')) {
  ran = true;
  const [angle, power] = String(value('--fly')).split(',').map(Number);
  if (!Number.isFinite(angle) || !Number.isFinite(power)) die('--fly needs ANGLE,POWER');
  const up = parseUp(value('--up')), seed = Number(value('--seed') ?? 1);
  const r = sim.newRun(seed, { angle, power }, up);
  for (const t of String(value('--pulses') || '').split(',').filter(Boolean).map(Number)) sim.queueInput(r, t, 'pulse');
  while (!r.ended) {
    sim.stepRun(r);
    for (const e of r.ev) console.log(`  ${(r.steps * STEP).toFixed(2)} s  ${e.k.padEnd(9)} at ${(r.x / U).toFixed(1)} m, height ${(r.y / U).toFixed(1)} m, vx ${r.vx.toFixed(0)}, vy ${r.vy.toFixed(0)}, fuel ${r.fuel.toFixed(2)}`);
    r.ev.length = 0;
  }
  console.log(`flight ${angle} deg, power ${power}, seed ${seed}, upgrades ${upText(up)}: ${sim.metres(r)} m (${r.ended}) in ${(r.steps * STEP).toFixed(1)} s; springs ${r.springs}, birds ${r.birds}, best chain ${r.chainMax}, coins ${sim.coinsOf(r)}`);
}

if (flag('--why')) {
  ran = true;
  // The expert's best flight on one seed, contact by contact.
  const up = parseUp(value('--up')), seed = Number(value('--why')), b = expertBest(seed, up);
  const r = sim.newRun(seed, { angle: b.angle, power: b.power }, up), ctl = expertCtl(b.plan);
  while (!r.ended) {
    const evs = r.ev.slice(); ctl(r);
    for (const e of evs) console.log(`  ${(r.steps * STEP).toFixed(2)} s  ${e.k.padEnd(9)} at ${(r.x / U).toFixed(1)} m, height ${(r.y / U).toFixed(1)} m, vx ${r.vx.toFixed(0)}, vy ${r.vy.toFixed(0)}, fuel ${r.fuel.toFixed(2)}`);
    sim.stepRun(r);
  }
  console.log(`expert on seed ${seed}, upgrades ${upText(up)}: launch ${b.angle} deg ${b.power}, plan ${b.plan.name}: ${sim.metres(r)} m (${r.ended}) in ${(r.steps * STEP).toFixed(1)} s`);
}

if (flag('--clean')) {
  ran = true;
  // A clean launch: no boost until two springs, then every pulse on the rising half of the next arc, fired as soon as it
  // rises. The field past the teaching chunk is seeded, so the proof is run on every seed; then again at every Band and
  // Aero level (PRD amendment 1 after the v4 gate: no purchase may make a habitual full pull worse).
  const seeds = Array.from({ length: nSeeds(200) }, (_, i) => i + 1), none = parseUp('');
  const cleanCtl = () => { let springs = 0, last = -1; return (r) => {
    for (const e of r.ev) if (e.k === 'spring') springs++;
    const armed = springs >= 2;
    r.ev.length = 0;
    const t = r.steps * STEP;
    if (armed && r.mode === 'air' && r.vy > 0 && r.fuel >= 1 && t - last >= 0.08) { sim.queueInput(r, t, 'pulse'); last = t; }
  }; };
  const flyClean = (a, p, s) => fly(s, { angle: a, power: p }, none, cleanCtl());
  const minOver = (a, p) => { let m = Infinity; for (const s of seeds) { m = Math.min(m, sim.metres(flyClean(a, p, s))); if (m < 500) break; } return m; };
  const ref = flyClean(40, 1, 1);
  const log = [];
  { const r = sim.newRun(1, { angle: 40, power: 1 }, none), ctl = cleanCtl(); while (!r.ended) { const evs = r.ev.slice(); ctl(r); for (const e of evs) if (e.k !== 'boost') log.push(`${e.k} at ${(r.x / U).toFixed(0)} m`); sim.stepRun(r); } }
  let mins = Infinity; for (const s of seeds) mins = Math.min(mins, sim.metres(flyClean(40, 1, s)));
  console.log(`clean launch 40 deg, full power, no upgrades, all ${T.fuelMax} pulses on the rise after the second spring: seed 1 ${sim.metres(ref)} m (${ref.ended}), springs ${ref.springs}, birds ${ref.birds}; lowest over ${seeds.length} seeds ${mins} m`);
  console.log(`  seed 1 contacts: ${log.join(', ')}`);
  if (mins < 500) fail('the clean launch does not reach 500 m on every seed');
  // The window: angles (0.5 deg) at full power, and powers (0.01) at 40 deg, that still reach 500 m on every seed.
  const angles = []; for (let a = 20; a <= 70; a += 0.5) if (minOver(a, 1) >= 500) angles.push(a);
  const powers = []; for (let p = 0.5; p <= 1.0001; p += 0.01) if (minOver(40, +p.toFixed(2)) >= 500) powers.push(+p.toFixed(2));
  const runs = (xs, st) => { const out = []; let s = null, prev = null; for (const x of xs) { if (s === null || x - prev > st + 1e-9) { if (s !== null) out.push([s, prev]); s = x; } prev = x; } if (s !== null) out.push([s, prev]); return out.map(([a, b]) => (a === b ? `${a}` : `${a} to ${b}`)).join(', ') || 'none'; };
  console.log(`  window at full power (angles reaching 500 m on all ${seeds.length} seeds): ${runs(angles, 0.5)} deg`);
  console.log(`  window at 40 deg (powers reaching 500 m on all ${seeds.length} seeds): ${runs(powers, 0.01)}`);
  const count = (a, p) => seeds.filter((s) => sim.metres(flyClean(a, p, s)) >= 500).length;
  const rows = []; for (let p = 0.8; p <= 1.0001; p += 0.01) rows.push(`${p.toFixed(2)} ${count(40, +p.toFixed(2))}`);
  console.log(`  seeds of ${seeds.length} reaching 500 m at 40 deg, by power: ${rows.join(', ')}`);
  const first = []; for (let p = 0.7; p <= 1.0001; p += 0.01) { const r = sim.newRun(1, { angle: 40, power: +p.toFixed(2) }); while (!r.ended && !r.ev.some((e) => e.k === 'spring' || e.k === 'bounce')) sim.stepRun(r); if (r.ev.some((e) => e.k === 'spring')) first.push(+p.toFixed(2)); }
  console.log(`  powers at 40 deg whose first landing is the teaching spring: ${runs(first, 0.01)}`);
  const grid = []; for (let a = 30; a <= 50; a += 1) for (let p = 0.8; p <= 1.0001; p += 0.02) if (minOver(a, +p.toFixed(2)) >= 500) grid.push(1);
  console.log(`  of the 21 x 11 grid 30 to 50 deg by power 0.80 to 1.00: ${grid.length} cells reach 500 m on every seed`);
  console.log(`  at every Band and Aero level (40 deg, all pulses after the second spring): lowest distance at full pull over ${seeds.length} seeds; powers reaching 500 m on every seed`);
  for (let b = 0; b <= T.upgradeMax; b++) for (let a = 0; a <= T.upgradeMax; a++) {
    const up = parseUp(`band=${b},aero=${a}`), flyU = (p, s) => fly(s, { angle: 40, power: p }, up, cleanCtl());
    let low = Infinity; for (const s of seeds) low = Math.min(low, sim.metres(flyU(1, s)));
    const ok = []; for (let p = 0.84; p <= 1.0001; p += 0.02) { let m = Infinity; for (const s of seeds) { m = Math.min(m, sim.metres(flyU(+p.toFixed(2), s))); if (m < 500) break; } if (m >= 500) ok.push(+p.toFixed(2)); }
    console.log(`    band ${b} aero ${a}: lowest ${low} m at full pull; powers ${runs(ok, 0.02)}`);
    if (low < 500) fail(`band ${b} aero ${a}: a clean full pull does not reach 500 m on every seed`);
  }
}

if (flag('--expert')) {
  ran = true;
  const up = parseUp(value('--up')), seeds = Array.from({ length: nSeeds(200) }, (_, i) => i + 1);
  const res = await parallel('expert', seeds, up), ms = res.map((x) => x.m);
  console.log(`expert bot, upgrades ${upText(up)}, ${seeds.length} seeds: ${dist(ms)}`);
  console.log(`  seeds reaching each milestone: ${reach(ms)}`);
  const plans = {}; for (const x of res) plans[x.plan] = (plans[x.plan] || 0) + 1;
  console.log(`  chosen launches: angle ${dist(res.map((x) => x.angle))}; power median ${pct(res.map((x) => x.power), 0.5)}; flight seconds ${dist(res.map((x) => x.secs))}`);
  console.log(`  ends: mud ${res.filter((x) => x.why === 'mud').length}, stop ${res.filter((x) => x.why === 'stop').length}; springs median ${pct(res.map((x) => x.springs), 0.5)}, birds median ${pct(res.map((x) => x.birds), 0.5)}`);
}

if (flag('--upgrades')) {
  ran = true;
  const seeds = Array.from({ length: nSeeds(200) }, (_, i) => i + 1), keys = ['band', 'fuel', 'aero', 'rocket'];
  const sets = [parseUp('')];
  for (const k of keys) for (const l of [1, 2]) sets.push(parseUp(`${k}=${l}`));
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) sets.push(parseUp(`${keys[i]}=1,${keys[j]}=1`));
  const best = {};
  console.log(`expert bot over ${seeds.length} seeds: distance percentiles and seeds reaching each milestone`);
  console.log(`| upgrades | levels | p10 | median | p90 | max | ${T.milestones.map((m) => `${m} m`).join(' | ')} |`);
  console.log(`| --- | --- | --- | --- | --- | --- | ${T.milestones.map(() => '---').join(' | ')} |`);
  for (const up of sets) {
    const ms = (await parallel('expert', seeds, up)).map((x) => x.m), lv = Object.values(up).reduce((a, b) => a + b, 0);
    console.log(`| ${upText(up)} | ${lv} | ${pct(ms, 0.1)} | ${pct(ms, 0.5)} | ${pct(ms, 0.9)} | ${Math.max(...ms)} | ${T.milestones.map((m) => ms.filter((x) => x >= m).length).join(' | ')} |`);
    for (const m of T.milestones) { const n = ms.filter((x) => x >= m).length; if (!best[m] || n > best[m].n) best[m] = { n, up }; }
  }
  // Reachable: the bot reaches it on at least a quarter of the seeds with some set of at most two levels.
  const need = Math.ceil(seeds.length / 4);
  for (const m of T.milestones) {
    const b = best[m], ok = b.n >= need;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${m} m: best ${upText(b.up)}, ${b.n} of ${seeds.length} seeds (reachable means at least ${need})`);
    if (!ok) failed = true;
  }
}

if (flag('--naive')) {
  ran = true;
  const up = parseUp(value('--up')), seeds = Array.from({ length: nSeeds(200) }, (_, i) => i + 1);
  const ms = (await parallel('naive', seeds, up)).map((x) => x.m);
  console.log(`naive player (angle 20 to 70 deg, power 0.3 to 1, ${sim.stats(up).fuelMax} taps at random times in the first 12 s), upgrades ${upText(up)}, ${seeds.length} seeds: ${dist(ms)}`);
  console.log(`  seeds reaching each milestone: ${reach(ms)}`);
  const full = (await parallel('naive-full', seeds, up)).map((x) => x.m);
  console.log(`the same at full pull every time: ${dist(full)}`);
  console.log(`  seeds reaching each milestone: ${reach(full)}`);
  const sl = (await parallel('sloppy', seeds, up)).map((x) => x.m);
  console.log(`sloppy human (40 deg with 3 deg of noise, full pull at base Band, a burst of every pulse 0.15 to 0.4 s apart after the second spring): ${dist(sl)}`);
  console.log(`  seeds reaching each milestone: ${reach(sl)}`);
}

if (flag('--buys')) {
  ran = true;
  // Every upgrade state (each upgrade 0 to upgradeMax): the expert's median over the seeds, then for each state the next
  // single level that adds the most median distance per coin.
  const seeds = Array.from({ length: nSeeds(40) }, (_, i) => i + 1), keys = ['band', 'fuel', 'aero', 'rocket'], M = T.upgradeMax;
  const states = [];
  for (let b = 0; b <= M; b++) for (let f = 0; f <= M; f++) for (let a = 0; a <= M; a++) for (let r = 0; r <= M; r++) states.push({ band: b, fuel: f, aero: a, rocket: r });
  const key = (u) => keys.map((k) => u[k]).join(''), med = new Map(), cache = value('--cache');
  // --cache FILE keeps the medians (they depend on the physics and the field, not on prices), so prices can be retuned quickly.
  // The cache is written after every state, so an interrupted run resumes where it stopped.
  let saved = null;
  if (cache) { try { saved = JSON.parse(readFileSync(cache, 'utf8')); } catch {} }
  if (saved && saved.seeds === seeds.length) for (const [k, v] of Object.entries(saved.med)) med.set(k, v);
  let budget = Number(value('--limit') ?? Infinity); // --limit N: compute at most N new states this run (the cache keeps them)
  for (const u of states) {
    if (med.has(key(u))) continue;
    if (budget-- <= 0) { console.log(`partial: ${med.size} of ${states.length} states cached; run again to continue`); process.exit(0); }
    const ms = (await parallel('expert', seeds, u)).map((x) => x.m).sort((x, y) => x - y);
    med.set(key(u), ms[Math.floor(ms.length / 2)]);
    if (cache) writeFileSync(cache, JSON.stringify({ seeds: seeds.length, med: Object.fromEntries(med) }));
  }
  const bestCount = Object.fromEntries(keys.map((k) => [k, 0])), lines = [];
  const bestBuy = (u) => {
    let best = null;
    for (const k of keys) {
      if (u[k] >= M) continue;
      const nu = { ...u, [k]: u[k] + 1 }, price = T.upgradePrices[k][u[k]], gain = med.get(key(nu)) - med.get(key(u));
      const per = (100 * gain) / price;
      if (!best || per > best.per) best = { k, per, gain, price, nu };
    }
    return best;
  };
  for (const u of states) {
    const b = bestBuy(u);
    if (!b) continue;
    bestCount[b.k]++;
    lines.push(`${keys.map((k) => `${k[0]}${u[k]}`).join(' ')}  median ${med.get(key(u))} m  best next: ${b.k} ${b.nu[b.k]} (${b.price} coins, ${b.gain >= 0 ? '+' : ''}${b.gain} m, ${b.per.toFixed(1)} m per 100 coins)`);
  }
  console.log(`expert medians over ${seeds.length} seeds for all ${states.length} upgrade states; the best next buy per coin from each:`);
  for (const l of lines) console.log(`  ${l}`);
  console.log(`best next buy, count of states: ${keys.map((k) => `${k} ${bestCount[k]}`).join(', ')}`);
  let u = { band: 0, fuel: 0, aero: 0, rocket: 0 }, path = [];
  for (let b = bestBuy(u); b; b = bestBuy(u)) { path.push(`${b.k} ${b.nu[b.k]} (${med.get(key(b.nu))} m)`); u = b.nu; }
  console.log(`the expert's greedy buy order from a fresh save: ${path.join(', ')}`);
  for (const k of keys) if (!bestCount[k]) fail(`${k} is never the best next buy`);
}

if (flag('--pacing')) {
  ran = true;
  // A fresh save flown by one player model, one seed per flight (1, 2, ...), buying the cheapest next level as soon as it is
  // affordable; coins are the flight's coins plus the one-time milestone bonuses. Two models: the review's sloppy human (full
  // pull, noisy aim, a burst of taps) and the release-gate reviewer's careless player (short pulls, wide aim, two taps).
  const keys = ['band', 'fuel', 'aero', 'rocket'], M = T.upgradeMax, maxFlights = Number(value('--flights') ?? 300);
  const pace = (name, flightFn) => {
    let u = { band: 0, fuel: 0, aero: 0, rocket: 0 }, coins = 0, flights = 0, earned = 0;
    const reached = new Set(), rows = [], dists = [];
    const next = () => keys.filter((k) => u[k] < M).map((k) => ({ k, price: T.upgradePrices[k][u[k]] })).sort((a, b) => a.price - b.price)[0];
    while (next() && flights < maxFlights) {
      const f = flightFn(++flights, u);
      let bonus = 0; T.milestones.forEach((m, i) => { if (f.m >= m && !reached.has(m)) { reached.add(m); bonus += T.milestoneBonus[i]; } });
      coins += f.coins + bonus; earned += f.coins + bonus; dists.push(f.m);
      for (let n = next(); n && coins >= n.price; n = next()) {
        coins -= n.price; u = { ...u, [n.k]: u[n.k] + 1 };
        const recent = dists.slice(-10).sort((a, b) => a - b);
        rows.push({ flight: flights, text: `| ${rows.length + 1} | ${n.k} ${u[n.k]} | ${n.price} | ${flights} | ${earned} | ${recent[Math.floor(recent.length / 2)]} |` });
      }
    }
    console.log(`${name} from a fresh save, cheapest next level first (coins per flight so far: ${(earned / flights).toFixed(0)}):`);
    console.log('| buy | upgrade | price | after flight | coins earned so far | median of the last 10 flights (m) |');
    console.log('| --- | --- | --- | --- | --- | --- |');
    for (const r of rows) console.log(r.text);
    if (next()) console.log(`not finished after ${maxFlights} flights`);
    return rows;
  };
  const sloppy = pace('sloppy human', sloppyFlight);
  const careless = pace('careless player', carelessFlight);
  if (!sloppy.length || sloppy[0].flight > 5) fail('the sloppy human\'s first purchase comes after flight 5');
  if (!careless.length || careless[0].flight > 10) fail('the careless player\'s first purchase comes after flight 10');
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
  // The expert's own inputs (launch and pulse times) replayed through advance() at several frame rates: whole physics steps only,
  // inputs stamped in flight time, as the play scene does.
  const seeds = Array.from({ length: nSeeds(20) }, (_, i) => i + 1), none = parseUp('');
  let bad = 0;
  for (const s of seeds) {
    const b = expertBest(s, none), times = [];
    const rec = sim.newRun(s, { angle: b.angle, power: b.power }, none), ctl = expertCtl(b.plan);
    while (!rec.ended) { const n = rec.q.length; ctl(rec); for (const e of rec.q.slice(n)) times.push(e.at); sim.stepRun(rec); }
    const jit = makeRng(s);
    const modes = [['30', () => 1 / 30], ['60', () => 1 / 60], ['120', () => 1 / 120], ['jitter', () => 1 / 144 + jit() * (1 / 20 - 1 / 144)]];
    const out = modes.map(([name, dt]) => {
      const r = sim.newRun(s, { angle: b.angle, power: b.power }, none);
      let clock = 0, i = 0, frames = 0;
      while (!r.ended && frames < 100000) {
        const d = Math.min(dt(), 1 / 20);
        while (i < times.length && times[i] < clock + d) sim.queueInput(r, times[i++], 'pulse'); // a tap during this frame, stamped with its time
        sim.advance(r, d); clock += d; frames++;
      }
      return { name, m: sim.metres(r), x: r.maxX, steps: r.steps };
    });
    const same = out.every((o) => o.x === out[0].x && o.steps === out[0].steps) && out[0].m === sim.metres(rec);
    if (!same) bad++;
    console.log(`seed ${s}: launch ${b.angle} deg ${b.power}, ${times.length} pulses; ${out.map((o) => `${o.name} fps ${o.m} m (${o.steps} steps)`).join(', ')}${same ? '' : '  DIFFERENT'}`);
  }
  if (bad) fail(`${bad} seeds give different distances at different frame rates`);
  else console.log(`identical distance (to the unit) and step count at 30, 60, 120 fps and jittery frames on all ${seeds.length} seeds`);
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
}

if (!ran) die('nothing to do: give --clean, --expert, --upgrades, --naive, --fps, --check or --fly');
console.log(failed ? 'RESULT: FAIL' : 'RESULT: PASS');
process.exit(failed ? 1 : 0);
