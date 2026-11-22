// The stretchy catch (step 2026-11-22, Decided 4): the first caramel touch of a flight holds him catchHold seconds, then slings
// him on at catchAngle with catchKeep of his speed (at least catchMin); a second caramel touch ends the flight as before.
// Headless, on the game's own physics (game.sim): catches staged over real caramel pits from a fall, a glide, a slam, a held
// boost and a slide along the ground; and the same flights replayed at 30, 60, 120 fps and jittery frames.
import { makeRng } from '../../../games/launch/src/engine.js';
import { game } from '../../../games/launch/src/game.js';

const T = game.TUNING, sim = game.sim, STEP = sim.STEP, U = T.unitsPerMetre;
const HOLD = Math.round(T.catchHold / STEP);
const BASE = { band: 0, fuel: 0, aero: 0, rocket: 0, steady: 0, scope: 0 };

function fresh(f) { for (const o of f.ground) o.spent = false; for (const b of f.birds) b.hit = false; for (const c of f.clouds) c.used = false; }

// A run placed over pit g: how ('fall', 'glide', 'slam', 'boost', 'slide', 'slow'), from rng. Returns the run.
function staged(seed, f, g, how, rng) {
  fresh(f);
  const r = sim.newRun(seed, { angle: 45, power: 1, zone: 2 }, BASE, f);
  if (how === 'slide' || how === 'slow') {
    r.mode = 'ground'; r.y = 0; r.vy = 0; r.vx = how === 'slow' ? rng.range(26, 60) : rng.range(200, 900);
    r.x = g.x0 - (how === 'slow' ? 2 : rng.range(2, 20));
  } else {
    r.mode = 'air'; r.vx = rng.range(40, 1300); r.vy = -rng.range(60, 900); r.y = rng.range(20, 200);
    r.x = g.x0 + g.w * 0.5 - r.vx * (r.y / -r.vy); // aimed at about the middle of the pit
  }
  r.maxX = r.x;
  if (how === 'slam') sim.condense(r);
  if (how === 'glide') sim.queueInput(r, 0, 'chuteOn');
  if (how === 'boost') { r.fuel = r.fuelCap; sim.queueInput(r, 0, 'boostOn'); }
  return r;
}

// Steps to the end; the log of events (with step numbers) and what went wrong.
function run(r, ctl = null) {
  const log = [], bad = [];
  const max = Math.round(T.maxFlight / STEP) + 10;
  let px = r.x;
  while (!r.ended && r.steps < max) {
    if (ctl) ctl(r);
    r.ev.length = 0; const was = r.mode, fuel = r.fuel, x = r.x;
    sim.stepRun(r);
    for (const e of r.ev) log.push({ ...e, step: r.steps, mode: was });
    if (r.vx < -1e-9) bad.push(`vx ${r.vx.toFixed(1)} at step ${r.steps}`);
    if (r.x < px - 1e-6) bad.push(`went back ${(px - r.x).toFixed(2)} at step ${r.steps}`);
    if (was === 'caught' && r.mode === 'caught' && (r.x !== x || r.fuel !== fuel)) bad.push(`moved or burned fizz while caught at ${r.steps}`);
    px = r.x;
  }
  return { log, bad, steps: r.steps, ended: r.ended };
}

const summary = (r) => `${r.ended}|${r.steps}|${r.x.toFixed(6)}|${r.catches}|${r.springs}|${r.bounces}|${r.fuel.toFixed(6)}`;

export default async function (t) {
  const rng = makeRng(20261122);
  let cases = 0, catches = 0, slings = 0, ends = 0, wrongHold = [], wrongSling = [], bad = [], unended = 0, endFirst = [], backIn = 0, landed = {}, secondMud = 0, keepBoost = 0, boostCases = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const f = sim.makeField(seed); sim.ensureField(f, 8000 * U);
    const pits = f.ground.filter((g) => g.kind === 'mud' && g.x0 < 8000 * U).slice(0, 4);
    for (const g of pits) for (const how of ['fall', 'glide', 'slam', 'boost', 'slide', 'slow']) {
      const r = staged(seed, f, g, how, rng);
      cases++;
      let inSp = null;
      const res = run(r, (q) => { if (inSp === null && q.mode !== 'caught') inSp = Math.hypot(q.vx, q.vy); });
      bad.push(...res.bad.map((b) => `${seed}/${how}: ${b}`));
      if (!res.ended) unended++;
      const c = res.log.find((e) => e.k === 'catch'), s = res.log.find((e) => e.k === 'sling');
      const firstMud = res.log.findIndex((e) => e.k === 'mud'), firstCatch = res.log.findIndex((e) => e.k === 'catch');
      if (firstMud >= 0 && (firstCatch < 0 || firstCatch > firstMud)) endFirst.push(`${seed}/${how}`);
      if (!c) continue;
      catches++;
      if (!s) { wrongSling.push(`${seed}/${how}: no sling`); continue; }
      slings++;
      if (s.step - c.step !== HOLD) wrongHold.push(`${seed}/${how}: held ${s.step - c.step} steps, want ${HOLD}`);
      const want = Math.min(T.maxSpeed, Math.max(T.catchMin, c.v * T.catchKeep));
      if (Math.abs(s.v - want) > 1e-6) wrongSling.push(`${seed}/${how}: sling ${s.v.toFixed(1)} want ${want.toFixed(1)}`);
      // what the sling met next
      const after = res.log.filter((e) => e.step > s.step && ['spring', 'bounce', 'land', 'mud', 'catch', 'slam', 'bird', 'geyser', 'ramp', 'stop'].includes(e.k));
      const nx = after[0];
      if (nx) landed[nx.k] = (landed[nx.k] || 0) + 1;
      if (nx && nx.k === 'mud') { secondMud++; if (sim.groundAt(f, nx.x ?? -1) === g) backIn++; }
      if (res.log.filter((e) => e.k === 'catch').length > T.catchMax) wrongSling.push(`${seed}/${how}: more than catchMax catches`);
      if (res.ended === 'mud') ends++;
      if (how === 'boost') { boostCases++; if (res.log.some((e) => e.k === 'sling') && r.boostT > 0) keepBoost++; }
    }
  }
  t.ok(`every first caramel touch catches him, never ends the flight (${cases} staged: fall, glide, slam, held boost, slide, slow slide; ${catches} reached caramel)`, endFirst.length === 0 && catches > cases * 0.6, endFirst.slice(0, 5).join(', '));
  t.ok(`every catch holds exactly catchHold (${HOLD} steps), then slings at max(catchMin, catchKeep x speed in)`, wrongHold.length === 0 && wrongSling.length === 0 && slings === catches, [...wrongHold, ...wrongSling].slice(0, 5).join(' | '));
  t.ok('no step moves him backwards, and he neither moves nor burns fizz while caught', bad.length === 0, bad.slice(0, 5).join(' | '));
  t.ok(`every staged flight ends before maxFlight (next contact after the sling: ${JSON.stringify(landed)})`, unended === 0, `${unended} unended`);
  t.ok(`a sling never drops him back into the pit that caught him (${secondMud} slings met caramel next, ${backIn} the same pit)`, backIn === 0);

  // A second caramel touch ends the flight on the spot.
  {
    const f = sim.makeField(3); sim.ensureField(f, 8000 * U);
    const g = f.ground.find((q) => q.kind === 'mud');
    const r = staged(3, f, g, 'fall', makeRng(5)); r.catches = T.catchMax;
    const res = run(r);
    t.ok('a caramel touch after catchMax catches ends the flight (why=mud), no catch', res.ended === 'mud' && !res.log.some((e) => e.k === 'catch'), JSON.stringify(res.log.slice(0, 3)));
  }

  // Inputs while caught: a held boost and a glide carry on after the sling; a slam swipe while caught does nothing (he is not in the air);
  // a quick tap while caught is a burst that can run out inside the hold.
  {
    const f = sim.makeField(7); sim.ensureField(f, 8000 * U);
    const g = f.ground.find((q) => q.kind === 'mud');
    const mk = () => { const r = staged(7, f, g, 'fall', makeRng(11)); r.fuel = r.fuelCap; return r; };
    const catchAt = (r) => { while (!r.ended && r.mode !== 'caught') { r.ev.length = 0; sim.stepRun(r); } return sim.flightTime(r); };
    let r = mk(); let t0 = catchAt(r);
    sim.queueInput(r, t0 + 0.1, 'boostOn');
    for (let i = 0; i < HOLD + 6; i++) { r.ev.length = 0; sim.stepRun(r); }
    t.ok('a boost pressed while caught is held, burns nothing until the sling, then thrusts', r.mode === 'air' && r.boost && r.boostT > 0 && r.boostT <= 7 * STEP + 1e-9, `mode ${r.mode} boost ${r.boost} boostT ${r.boostT}`);
    r = mk(); t0 = catchAt(r);
    sim.queueInput(r, t0 + 0.1, 'chuteOn');
    for (let i = 0; i < HOLD + 6; i++) { r.ev.length = 0; sim.stepRun(r); }
    t.ok('a glide swiped while caught is open once he is slung', r.mode === 'air' && r.chute, `mode ${r.mode} chute ${r.chute}`);
    r = mk(); t0 = catchAt(r);
    sim.queueInput(r, t0 + 0.1, 'condense');
    for (let i = 0; i < HOLD + 6; i++) { r.ev.length = 0; sim.stepRun(r); }
    t.ok('a slam swiped while caught does not condense him (he is sunk, not in the air)', r.mode === 'air' && !r.ball && r.drops === 0, `ball ${r.ball} drops ${r.drops}`);
    r = mk(); t0 = catchAt(r);
    sim.queueInput(r, t0 + 0.05, 'burst');
    for (let i = 0; i < HOLD + 6; i++) { r.ev.length = 0; sim.stepRun(r); }
    t.ok('a quick tap while caught is not eaten: its burst waits for the sling', r.boostT > 0, `boostT after the sling ${r.boostT} (tapBurst ${T.tapBurst} s < catchHold ${T.catchHold} s)`);
  }

  // Frame-rate independence: flights with a catch, and inputs before, during and after it, the same at 30, 60, 120 fps and jitter.
  {
    let same = 0, n = 0, diffs = [];
    for (let seed = 1; seed <= 12; seed++) {
      const f0 = sim.makeField(seed); sim.ensureField(f0, 8000 * U);
      const g = f0.ground.find((q) => q.kind === 'mud');
      if (!g) continue;
      const outs = [];
      for (const fps of [30, 60, 120, 'jitter']) {
        const f = sim.makeField(seed); sim.ensureField(f, 8000 * U);
        const gg = f.ground.find((q) => q.kind === 'mud');
        const r = staged(seed, f, gg, seed % 2 ? 'fall' : 'boost', makeRng(seed));
        // inputs at flight times spread over the catch: boost on and off, a glide, a slam, more boost
        const ins = [[0.05, 'chuteOn'], [0.3, 'chuteOff'], [0.42, 'boostOn'], [0.6, 'condense'], [0.75, 'boostOff'], [0.9, 'chuteOn'], [1.6, 'chuteOff'], [2.2, 'condense']];
        for (const [at, k] of ins) sim.queueInput(r, at, k);
        const jr = makeRng(seed * 97);
        let guard = 0;
        while (!r.ended && guard++ < 100000) { const dt = fps === 'jitter' ? jr.range(0.004, 0.05) : 1 / fps; r.ev.length = 0; sim.advance(r, dt); }
        outs.push(summary(r));
      }
      n++;
      if (outs.every((o) => o === outs[0])) same++; else diffs.push(`${seed}: ${outs.join(' / ')}`);
    }
    t.ok(`flights through a catch are the same at 30, 60, 120 fps and jittery frames (${same} of ${n})`, same === n && n > 5, diffs.slice(0, 3).join(' | '));
  }
}
