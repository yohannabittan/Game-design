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
//                                                     then the same at full pull every time
//   node tools/sim-launch.mjs --fps [--seeds 20]       the same seed and inputs at 30, 60 and 120 fps (and jittery frames) give the same distance
//   node tools/sim-launch.mjs --check [--seeds 500]    field fairness: a spring before every mud, none further apart than 150 m, no overlaps
//   node tools/sim-launch.mjs --fly ANGLE,POWER [--seed N] [--pulses T1,T2,...] [--up ...]   one flight with its event log
//   node tools/sim-launch.mjs --why SEED [--up ...]    the expert's best flight on one seed, contact by contact
//
// Upgrade sets are band, fuel, aero, rocket levels (their effects are TUNING.bandStep and the rest). Reachable means the
// expert reaches the milestone on at least a quarter of the seeds. Seeds are 1..N. Exit code 0 when every check run
// passes, 1 when one fails, 2 on a usage error.

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
        if (r.st.hold) {
          for (const d of [0, 0.15, 0.3, 0.5, 0.8, 1.2]) {
            const cost = 1 + d * T.holdFuelRate;
            if (cost <= r.fuel + 1e-9) cands.push({ n: cost, p: [t0], hold: d ? [t0 + T.holdDelay, t0 + T.holdDelay + d] : null, cost });
          }
        } else for (let n = 1; n <= Math.min(3, Math.floor(r.fuel)); n++) cands.push({ n, p: Array.from({ length: n }, (_, i) => t0 + i * 0.08), hold: null, cost: n });
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
  // A clean launch: no boost on the way to the first spring, then every pulse on the rising half of the arc the first spring
  // gives, fired as soon as it rises. The field past the first chunk is seeded, so the proof holds on every seed tried.
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
  const grid = []; for (let a = 30; a <= 50; a += 1) for (let p = 0.8; p <= 1.0001; p += 0.02) if (minOver(a, +p.toFixed(2)) >= 500) grid.push(1);
  console.log(`  of the 21 x 11 grid 30 to 50 deg by power 0.80 to 1.00: ${grid.length} cells reach 500 m on every seed`);
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
