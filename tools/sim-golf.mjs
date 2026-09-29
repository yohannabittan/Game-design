#!/usr/bin/env node
// sim-golf: run shots through Gravity Golf's real physics (games/gravity-golf/src/game.js, via game.sim).
//
//   node tools/sim-golf.mjs <hole.json> --drag DX,DY [--clock T] [--fps 60]   one shot from the tee (swallows and comet hits too)
//   node tools/sim-golf.mjs <hole.json> --sweep [--drag DX,DY] [--clock T]     no-straight-ace sweep (PRD v0.2 C), aim window,
//                                                                              any-bounce sinks and the widest aim cluster
//   node tools/sim-golf.mjs <hole.json> --escape                               escape sweep and 1500 chained random shots (PRD v0.2 D);
//                                                                              black holes have no surface: swallows are counted
//   node tools/sim-golf.mjs <hole.json> --three DX,DY[,CLOCK][/DX,DY[,CLOCK]...]  verify a three-star route (30/60/144 fps, jitter)
//   node tools/sim-golf.mjs --index N ...                                      use hole N (0-based) from game.js instead of a file
//   node tools/sim-golf.mjs --list                                             holes with star thresholds and boss flags
//
// hole.json is exactly one entry of the LEVELS array in game.js (see docs/games/gravity-golf/README.md).
// Drags are screen px as the finger moves (dx right, dy down); the ball flies the opposite way. Clocks are hole-clock
// seconds at release. Exit code 0 when every check run passes, 1 when one fails, 2 on a usage error.

import { readFileSync } from 'node:fs';
import { game } from '../games/gravity-golf/src/game.js';
import { makeRng, hashString } from '../games/gravity-golf/src/engine.js';

const T = game.TUNING, sim = game.sim, STEP = T.physicsStep;
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const value = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const valueFlags = new Set(['--drag', '--clock', '--fps', '--index', '--three']);
const positional = args.filter((a, i) => !a.startsWith('--') && !valueFlags.has(args[i - 1]));
const die = (msg) => { console.error(`sim-golf: ${msg}`); process.exit(2); };
const nums = (s, name, n) => { const v = String(s).split(',').map(Number); if (v.length < n || v.some((x) => !Number.isFinite(x))) die(`${name} needs ${n} numbers, comma separated`); return v; };
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '-');

if (flag('--list')) {
  sim.levels.forEach((lv, i) => console.log(`${i}  hole ${i + 1}  ${lv.name}  three ${lv.stars.three} / two ${lv.stars.two}${lv.boss ? '  boss' : ''}`));
  process.exit(0);
}

// ---------- The hole ----------

let lv;
if (flag('--index')) {
  const i = Number(value('--index'));
  if (!Number.isInteger(i) || i < 0 || i >= sim.levels.length) die(`--index must be 0 to ${sim.levels.length - 1}`);
  lv = sim.levels[i];
} else {
  if (!positional[0]) die('give a hole.json file or --index N (or --list)');
  try { lv = JSON.parse(readFileSync(positional[0], 'utf8')); } catch (e) { die(`cannot read ${positional[0]}: ${e.message}`); }
  for (const k of ['walls', 'planets', 'suns', 'movers', 'blackholes']) lv[k] = lv[k] || [];
  for (const k of ['name', 'ball', 'hole', 'stars']) if (lv[k] === undefined) die(`hole.json is missing "${k}"`);
  for (const m of lv.movers) if (!['slide', 'bar', 'moon', 'comet'].includes(m.type)) die(`unknown mover type "${m.type}"`);
  for (const m of lv.movers) if (m.type === 'moon' && !lv.planets[m.parent]) die(`moon parent ${m.parent} is not a planet index`);
  for (const m of lv.movers) if (m.type === 'comet' && !(m.a && m.b && Number.isFinite(m.a.x + m.a.y + m.b.x + m.b.y) && m.period > 0)) die('a comet needs a: {x, y}, b: {x, y} and period > 0');
  for (const h of lv.blackholes) if (!Number.isFinite(h.x + h.y)) die('a black hole needs x and y');
  sim.prepareLevel(lv);
}

// Bodies that pull: planets with mass, moons and black holes. Distances are from the ball centre to the body's surface
// (a black hole's horizon). The escape sweep skips black holes: they have no surface to rest on.
const bodies = [
  ...lv.planets.map((p, i) => ({ label: `planet ${i}`, r: p.r, at: () => p, planet: i })).filter((b, i) => lv.planets[i].mass > 0),
  ...lv.movers.map((m, i) => ({ m, i })).filter((o) => o.m.type === 'moon').map(({ m, i }) => ({ label: `moon (mover ${i})`, r: m.r, at: (c) => sim.moonAt(lv, m, c), mover: i })),
  ...lv.blackholes.map((h, i) => ({ label: `black hole ${i}`, r: h.r, at: () => h, bh: i })),
];

// ---------- One flight, exactly as the play scene runs it ----------

// dts(i) gives the i-th frame's dt (null: one physics step per frame). Returns the outcome; the ball is left where it rests,
// or, after a swallow, back where the shot started (its last rest), as the game does.
function flight(b, l, clock0, dts) {
  const v = sim.launchVel(lv, b, l, clock0), from = { x: b.x, y: b.y, on: b.on, onA: b.onA };
  b.vx = v.vx; b.vy = v.vy; b.on = -1; b.sunIn = 0; b.cometIn = 0;
  const minSurf = bodies.map(() => Infinity), hits0 = b.hits, sun0 = b.sunHits, comet0 = b.cometHits;
  let acc = 0, steps = 0, res = null, frame = 0;
  while (!res) {
    acc += dts ? Math.min(dts(frame++), 1 / 20) : STEP;
    while (acc >= STEP && !res) {
      acc -= STEP; steps++;
      const clock = clock0 + steps * STEP;
      res = sim.stepBall(lv, b, clock);
      bodies.forEach((o, k) => { const c = o.at(clock), d = Math.hypot(b.x - c.x, b.y - c.y) - o.r; if (d < minSurf[k]) minSurf[k] = d; });
      if (!res && steps * STEP >= T.maxFlightSeconds) res = 'timeout';
    }
  }
  const swallowed = res === 'swallow' ? 1 : 0, bh = b.bh, sx = b.x, sy = b.y;
  if (swallowed) { b.x = from.x; b.y = from.y; b.on = from.on; b.onA = from.onA; b.bh = -1; }
  if (res !== 'sink') { b.vx = b.vy = 0; sim.carry(lv, b, 0); }
  const sunPen = (b.sunHits - sun0) * T.sunPenalty;
  return { res, steps, seconds: steps * STEP, hits: b.hits - hits0, comets: b.cometHits - comet0, swallowed, bh, sx, sy, sunPen,
    penalties: sunPen + swallowed * T.bhPenalty, minSurf, x: b.x, y: b.y };
}

function teeShot(dx, dy, clock0 = 0, dts = null) {
  const l = sim.launchFromDrag(dx, dy);
  if (!l) return null;
  return flight(sim.newBall(lv.ball.x, lv.ball.y), l, clock0, dts);
}
const sinks = (dx, dy, clock0 = 0, dts = null) => { const r = teeShot(dx, dy, clock0, dts); return !!r && r.res === 'sink'; };

// ---------- Geometry checks for resting balls ----------

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
const rectDist = (x, y, r) => Math.hypot(x - Math.max(r.x, Math.min(x, r.x + r.w)), y - Math.max(r.y, Math.min(y, r.y + r.h)));
const EPS = 0.01;

// What a ball at (x, y) overlaps at `clock`, or null. `skipPlanet` / `skipMover` ignore the body it sits on.
function overlap(x, y, clock = 0, skipPlanet = -1, skipMover = -1) {
  const R = T.ballR - EPS;
  if (x < R || y < R || x > T.designW - R || y > T.designH - R) return 'border';
  for (const w of lv.walls) if (rectDist(x, y, w) < R) return 'wall';
  for (let i = 0; i < lv.planets.length; i++) { const p = lv.planets[i]; if (i !== skipPlanet && Math.hypot(x - p.x, y - p.y) < p.r + R) return `planet ${i}`; }
  for (const s of lv.suns) if (Math.hypot(x - s.x, y - s.y) < s.r + R) return 'sun';
  for (let i = 0; i < lv.blackholes.length; i++) { const h = lv.blackholes[i]; if (Math.hypot(x - h.x, y - h.y) < h.r) return `black hole ${i}`; }
  for (let i = 0; i < lv.movers.length; i++) if (i !== skipMover && moverTouches(lv.movers[i], x, y, clock)) return `mover ${i} (${lv.movers[i].type})`;
  return null;
}
function moverTouches(m, x, y, clock) {
  if (m.type === 'slide') return rectDist(x, y, sim.slideAt(m, clock)) < T.ballR - EPS;
  if (m.type === 'bar') { const u = sim.barAt(m, clock); return segDist(x, y, m.x - u.x, m.y - u.y, m.x + u.x, m.y + u.y) < T.ballR + T.barW / 2 - EPS; }
  if (m.type === 'comet') { const c = sim.cometAt(m, clock); return Math.hypot(x - c.x, y - c.y) < m.r + T.ballR - EPS; }
  const c = sim.moonAt(lv, m, clock); return Math.hypot(x - c.x, y - c.y) < m.r + T.ballR - EPS;
}
// First mover to touch a ball resting at (x, y) while the player aims for `seconds` from clock 0, or null.
function hitWhileAiming(x, y, seconds = 10, skipMover = -1) {
  for (let t = 0; t <= seconds; t += 1 / 240) for (let i = 0; i < lv.movers.length; i++) if (i !== skipMover && moverTouches(lv.movers[i], x, y, t)) return `mover ${i} (${lv.movers[i].type}) at clock ${t.toFixed(2)}`;
  return null;
}

// ---------- Commands ----------

let failed = false;
const fail = (msg) => { failed = true; console.log(`FAIL ${msg}`); };
const fpsModes = () => { const rng = makeRng(hashString(lv.name) + 1); return [['30 fps', () => 1 / 30], ['60 fps', () => 1 / 60], ['144 fps', () => 1 / 144], ['jitter', () => 1 / 144 + rng() * (1 / 20 - 1 / 144)]]; };
const clockArg = Number(value('--clock') ?? 0);
if (!Number.isFinite(clockArg) || clockArg < 0) die('--clock must be a number of seconds, 0 or more');

const nComets = lv.movers.filter((m) => m.type === 'comet').length;
console.log(`${lv.name}: tee (${lv.ball.x},${lv.ball.y}), cup (${lv.hole.x},${lv.hole.y}), three ${lv.stars.three} / two ${lv.stars.two}${lv.boss ? ', boss' : ''}; ` +
  `${lv.walls.length} walls, ${lv.planets.length} planets, ${lv.suns.length} suns, ${lv.movers.length} movers` +
  `${nComets || lv.blackholes.length ? ` (${nComets} comets), ${lv.blackholes.length} black holes` : ''}`);
const teeBad = overlap(lv.ball.x, lv.ball.y) || (sim.inSweep(lv, sim.newBall(lv.ball.x, lv.ball.y)) && 'a mover sweep zone');
if (teeBad) fail(`the tee overlaps ${teeBad}`);
// PRD v0.3 A shard rules: no black hole on an unblocked straight tee-to-cup line; comet paths 18 clear of the tee and the cup.
{
  const tx = lv.ball.x, ty = lv.ball.y, cx = lv.hole.x, cy = lv.hole.y, len = Math.hypot(cx - tx, cy - ty);
  let blocked = false;
  for (let s = 0; s <= len && !blocked; s += 1) { const x = tx + ((cx - tx) * s) / len, y = ty + ((cy - ty) * s) / len; blocked = lv.walls.some((w) => rectDist(x, y, w) < T.ballR); }
  lv.blackholes.forEach((h, i) => { if (!blocked && segDist(h.x, h.y, tx, ty, cx, cy) < h.r + T.ballR) fail(`black hole ${i} is on the straight tee-to-cup line and no wall blocks it`); });
  lv.movers.forEach((m, i) => {
    if (m.type !== 'comet') return;
    if (segDist(tx, ty, m.a.x, m.a.y, m.b.x, m.b.y) < m.r + T.ballR + 18) fail(`comet (mover ${i}) passes within 18 of the ball on the tee`);
    if (segDist(cx, cy, m.a.x, m.a.y, m.b.x, m.b.y) < m.r + T.holeR + 18) fail(`comet (mover ${i}) passes within 18 of the cup`);
  });
}

const ran = { any: false };
const drag = value('--drag') !== undefined ? nums(value('--drag'), '--drag', 2) : null;

if (drag && !flag('--sweep')) {
  ran.any = true;
  const fps = Number(value('--fps') ?? 0);
  if (value('--fps') !== undefined && !(fps > 0)) die('--fps must be a positive number');
  const r = teeShot(drag[0], drag[1], clockArg, fps ? () => 1 / fps : null);
  if (!r) die('the drag is inside the dead zone (shorter than dragDead)');
  const where = r.res === 'sink' ? 'SINK' : r.swallowed ? `SWALLOWED by black hole ${r.bh} at (${f1(r.sx)}, ${f1(r.sy)}), back at its last rest (${f1(r.x)}, ${f1(r.y)})`
    : `${r.res === 'timeout' ? 'TIMEOUT (forced rest)' : 'rests'} at (${f1(r.x)}, ${f1(r.y)})`;
  const pass = bodies.map((o, k) => `${o.label} ${f1(r.minSurf[k])}`).join(', ') || 'no pulling bodies';
  console.log(`shot drag (${drag}) at clock ${clockArg}${fps ? ` at ${fps} fps` : ''}: ${where}; strokes charged ${1 + r.penalties} (sun penalties ${r.sunPen}` +
    `${lv.blackholes.length ? `, swallows ${r.swallowed}` : ''}); bounces ${r.hits}${nComets ? `, comet hits ${r.comets}` : ''}; closest pass to a surface: ${pass}; flight ${r.seconds.toFixed(2)} s`);
  if (r.res === 'timeout') fail('the flight timed out');
}

if (flag('--sweep')) {
  ran.any = true;
  let straight = 0, strictCentre = 0, total = 0, anySink = 0; const examples = [], grid = new Map();
  for (let a = 0; a < 360; a += 0.5) for (let L = 15; L <= 150; L += 5) {
    const rad = (a * Math.PI) / 180, dx = L * Math.cos(rad), dy = L * Math.sin(rad);
    const r = teeShot(dx, dy, clockArg); total++;
    if (r.res === 'sink' && r.penalties === 0) { anySink++; grid.set(`${a},${L}`, r.hits); }
    if (r.res !== 'sink' || r.hits !== 0) continue;
    if (bodies.every((o, k) => r.minSurf[k] >= 80)) { straight++; if (examples.length < 5) examples.push(`${a} deg ${L} px`); }
    if (bodies.every((o, k) => r.minSurf[k] + o.r >= 80)) strictCentre++;
  }
  console.log(`no-straight sweep at clock ${clockArg}: ${total} shots (every 0.5 deg, 15 to 150 px every 5 px); straight sinks (zero bounces, no pass within 80 of a surface): ${straight}` +
    `${examples.length ? ` e.g. ${examples.join(', ')}` : ''}; stricter count (within 80 of a centre): ${strictCentre}`);
  if (straight) fail('a straight-line ace exists (must be 0 for holes 4 to 10)');
  // Every one-shot sink, bounces or not (information): the widest run of sinking aims at one drag length is the
  // low-skill cluster a player finds by feel.
  let wide = { n: 0, L: 0, a: 0 };
  for (let L = 15; L <= 150; L += 5) {
    let run = 0;
    for (let i = 0; i < 1440; i++) { // twice round, so a run that crosses 0 degrees is whole
      const a = (i % 720) * 0.5;
      run = grid.has(`${a},${L}`) ? Math.min(run + 1, 720) : 0;
      if (run > wide.n) wide = { n: run, L, a: a - (run - 1) * 0.25 };
    }
  }
  const wr = (wide.a * Math.PI) / 180;
  console.log(`any-bounce one-shot sinks (no penalty strokes) at clock ${clockArg}: ${anySink} of ${total}` +
    (wide.n ? `; widest aim cluster ${(wide.n * 0.5).toFixed(1)} deg (${wide.n} steps) at ${wide.L} px, centred on drag (${f1(wide.L * Math.cos(wr))}, ${f1(wide.L * Math.sin(wr))})` : ''));
  if (drag) {
    if (!sinks(drag[0], drag[1], clockArg)) fail(`drag (${drag}) does not sink at clock ${clockArg}, so it has no window`);
    else {
      const L = Math.hypot(drag[0], drag[1]), a0 = Math.atan2(drag[1], drag[0]), st = (0.05 * Math.PI) / 180;
      const at = (k) => sinks(L * Math.cos(a0 + k * st), L * Math.sin(a0 + k * st), clockArg);
      let lo = 0, hi = 0; while (lo < 3600 && at(-(lo + 1))) lo++; while (hi < 3600 && at(hi + 1)) hi++;
      const ux = drag[0] / L, uy = drag[1] / L, len = (l) => sinks(l * ux, l * uy, clockArg);
      let a = L, b = L; while (a > T.dragDead && len(a - 0.5)) a -= 0.5; while (b < 200 && len(b + 0.5)) b += 0.5;
      console.log(`aim window around (${drag}) at clock ${clockArg}: ${((lo + hi) * 0.05).toFixed(2)} deg (-${(lo * 0.05).toFixed(2)} / +${(hi * 0.05).toFixed(2)}); ` +
        `drag length ${a.toFixed(1)} to ${b >= 200 ? `full power (150+)` : b.toFixed(1)} px (the drag is ${L.toFixed(1)} px)`);
    }
  }
}

if (flag('--escape')) {
  ran.any = true;
  if (!bodies.some((b) => b.bh === undefined)) console.log('escape sweep: no planets or moons with mass on this hole');
  for (const o of bodies.filter((b) => b.bh === undefined)) {
    const row = []; let worst = Infinity;
    for (let k = 0; k < 8; k++) {
      const ang = (k * Math.PI) / 4, c0 = o.at(0), R = o.r + T.ballR;
      const b0 = sim.newBall(c0.x + Math.cos(ang) * R, c0.y + Math.sin(ang) * R);
      if (o.mover !== undefined) { b0.on = o.mover; b0.onA = ang; }
      const bad = overlap(b0.x, b0.y, 0, o.planet ?? -1, o.mover ?? -1);
      if (bad) { row.push(`${k * 45}: blocked (${bad})`); continue; }
      let best = 0, n = 0;
      for (let deg = 0; deg < 360; deg++) {
        const b = { ...b0 }, rad = (deg * Math.PI) / 180;
        const l = { vx: Math.cos(rad) * T.powerMax, vy: Math.sin(rad) * T.powerMax, power: 1 };
        const v = sim.launchVel(lv, b, l, 0); b.vx = v.vx; b.vy = v.vy; b.on = -1; b.sunIn = 0;
        let far = 0, res = null;
        for (let s = 1; !res && s * STEP <= T.maxFlightSeconds; s++) {
          res = sim.stepBall(lv, b, s * STEP);
          const c = o.at(s * STEP); far = Math.max(far, Math.hypot(b.x - c.x, b.y - c.y));
        }
        best = Math.max(best, far); if (far >= 250) n++;
      }
      worst = Math.min(worst, best);
      row.push(`${k * 45}: ${best.toFixed(0)} (${n} of 360 directions reach 250)`);
    }
    console.log(`escape from ${o.label}, best full-power reach from each surface point (degrees clockwise from east): ${row.join('; ')}`);
    if (worst < 250) fail(`${o.label}: a surface point cannot reach 250 units`);
  }
  const rng = makeRng(hashString(lv.name));
  let b = sim.newBall(lv.ball.x, lv.ball.y), sunk = 0, timeouts = 0, stuck = 0, swept = 0, hit = 0, landed = 0, riding = 0, longest = 0, swallowed = 0, cometHits = 0;
  for (let s = 0; s < 1500; s++) {
    const ang = rng() * Math.PI * 2, len = T.dragDead + rng() * (T.dragMax - T.dragDead), clock = lv.movers.length ? rng() * 6 : 0;
    sim.carry(lv, b, clock);
    const r = flight(b, sim.launchFromDrag(Math.cos(ang) * len, Math.sin(ang) * len), clock, null);
    longest = Math.max(longest, r.seconds); cometHits += r.comets;
    if (r.res === 'timeout') timeouts++;
    if (r.res === 'sink') { sunk++; b = sim.newBall(lv.ball.x, lv.ball.y); continue; }
    if (r.swallowed) { swallowed++; continue; } // back at its last rest, which was already checked
    if (b.on >= 0) { riding++; continue; }
    const onPlanet = lv.planets.findIndex((p) => Math.hypot(b.x - p.x, b.y - p.y) < p.r + T.ballR + 0.5);
    if (onPlanet >= 0) landed++;
    if (overlap(b.x, b.y, 0, onPlanet)) stuck++;
    if (sim.inSweep(lv, b)) swept++;
    if (lv.movers.length && hitWhileAiming(b.x, b.y)) hit++;
  }
  console.log(`1500 chained random shots${lv.movers.length ? ' at random release clocks' : ''}: sinks ${sunk}, timeouts ${timeouts}, rests overlapping something ${stuck}, ` +
    `rests in a mover sweep zone ${swept}, rests a mover touches within 10 s of aiming ${hit}, landed on a planet ${landed}, riding a moon ${riding}` +
    `${lv.blackholes.length ? `, swallowed by a black hole ${swallowed}` : ''}${nComets ? `, comet hits ${cometHits}` : ''}, longest flight ${longest.toFixed(2)} s`);
  if (timeouts || stuck || swept || hit) fail('random shots found a timeout or a stuck ball');
}

if (flag('--three')) {
  ran.any = true;
  // A route is one or more shots separated by '/', each DX,DY[,CLOCK], each played from where the previous one rests.
  const route = String(value('--three')).split('/').map((sh) => { const [dx, dy, c = 0] = nums(sh, '--three shot', 2); return { dx, dy, c }; });
  const play = (shots, dts) => {
    let b = sim.newBall(lv.ball.x, lv.ball.y), strokes = 0, last = null;
    for (const sh of shots) {
      const l = sim.launchFromDrag(sh.dx, sh.dy);
      if (!l) return { res: 'dead zone', strokes };
      sim.carry(lv, b, sh.c);
      last = flight(b, l, sh.c, dts); strokes += 1 + last.penalties;
      if (last.res === 'sink' || last.res === 'timeout') break; // a swallowed shot plays on from its last rest
    }
    return { res: last.res, strokes, last, ball: b };
  };
  const good = (r) => r.res === 'sink' && r.strokes <= lv.stars.three;
  const text = route.map((sh) => `(${sh.dx},${sh.dy})${sh.c ? ` at clock ${sh.c}` : ''}`).join(' then ');
  let ok = 0, tot = 0; const misses = [];
  const nudged = (k, i, j) => route.map((sh, n) => (n === k ? { ...sh, dx: sh.dx + i, dy: sh.dy + j } : sh));
  const k = route.length - 1;
  for (const [name, dts] of fpsModes()) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const r = play(nudged(k, i, j), dts); tot++;
    if (good(r)) ok++; else misses.push(`${name}, last shot (${route[k].dx + i},${route[k].dy + j}): ${r.res}${r.res === 'sink' ? ` in ${r.strokes} strokes` : ''}`);
  }
  const ref = play(route, null);
  console.log(`three-star route ${text}: ${ok} of ${tot} sink within ${lv.stars.three} stroke${lv.stars.three > 1 ? 's' : ''} ` +
    `(the ${route.length > 1 ? 'last shot' : 'drag'} and its 8 whole-pixel neighbours at 30, 60, 144 fps and jittery frames); ` +
    `reference: ${ref.res} in ${ref.strokes} strokes${ref.last ? `, last flight ${ref.last.seconds.toFixed(2)} s, ${ref.last.hits} bounces, closest pass ${bodies.map((o, n) => `${o.label} ${f1(ref.last.minSurf[n])}`).join(', ') || '-'}` : ''}`);
  for (let n = 0; n < route.length - 1; n++) {
    let fin = 0; const r0 = play(route.slice(0, n + 1), null);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if (good(play(nudged(n, i, j), null))) fin++;
    console.log(`  shot ${n + 1} ${r0.last && r0.last.swallowed ? 'is swallowed and returns to' : 'rests at'} (${f1(r0.ball.x)}, ${f1(r0.ball.y)})${r0.ball.on >= 0 ? ' riding a moon' : ''}; ` +
      `with this shot nudged by a pixel, ${fin} of 9 routes still finish within ${lv.stars.three} (information)`);
  }
  for (const m of misses) console.log(`  miss ${m}`);
  if (ok !== tot) fail('the three-star route is not robust');
}

if (!ran.any) die('nothing to do: give --drag, --sweep, --escape, --three or --list');
console.log(failed ? 'RESULT: FAIL' : 'RESULT: PASS');
process.exit(failed ? 1 : 0);
