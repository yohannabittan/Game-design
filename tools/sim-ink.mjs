#!/usr/bin/env node
// sim-ink: run a scripted needle path through Ink's real coverage and slip code (games/ink/src/game.js).
//
//   node tools/sim-ink.mjs <stencil.json> <path.json> [--speed 300] [--events HZ] [--timer-from-path] [--preset NAME]
//   node tools/sim-ink.mjs --index N <path.json> [--speed 300] [--events HZ] [--timer-from-path] [--preset NAME]
//   node tools/sim-ink.mjs --list
//
// stencil.json: one stencil entry exactly as in the STENCILS array of game.js, so it can be pasted there unchanged.
//   { "name": "Square", "timer": 30, "boss": false, "comment": "teaching goal and intended path",
//     "shape": [ [[x,y],[x,y],...], [[x,y],...] ] }
//   `shape` is a list of closed polygons in the 360x640 design space (do not repeat the first point at the end);
//   a polygon inside another is a hole (even-odd). `polygons` is accepted as an alias for `shape`.
//   A stencil in parts (PRD v0.6 section D) has `parts` instead: a list of parts, each a list of polygons like `shape` (`shape` is then made from them, so it can be left out).
//   Inking a part to 99 percent completes it, the piece is done when every part is, and a touch-down is a landing: clean inside a part's line (or within TUNING.landTolerance
//   of it), a blot (a slip) on skin outside every line. Only stencils with `parts` score landings.
//
// path.json: an array of needle positions in DESIGN units (not finger positions; the needle offset is irrelevant to
//   scoring). Consecutive points are joined by straight segments. A `null` entry is a lift: the finger comes up, and the
//   next point is a new touch down (with the needle wherever that point is).
//   [ [180,320], [190,320], null, [50,60], [70,60] ]  (a lift is free, and the finger is assumed to cross it at --speed, so it counts in the time)
//   A point may carry a third element, the finger speed in units per second for the segment ENDING at that point:
//   [x, y, speed]. Missing speed uses --speed. Speed only matters to the dynamic needle (it sets the ink radius) and to the clock.
//
// The ink radius follows the finger speed with inertia (dynamic needle, Flowy values; PRD v0.2 and v0.3, the only needle since v0.4): it is integrated
//   over every path sample from the time the sample would have had on its segment, so [x, y, speed] paths give the same result at any event rate.
//   The old --needle flag was removed in v0.4 and stops with an error. --preset NAME (v0.5) applies a timer preset of the game (Relaxed, Standard, Tight; default Standard)
//   to the multipliers before the run, so the timer the stencil gets, the pass check and the --timer-from-path rows all use the multipliers that are active.
// { "hold": seconds } in the path keeps the finger still for that long (the game's own update runs, the radius swells, the timer runs).
// --events HZ cuts the finger movement into events HZ times per second of path time (default: events of sampleSpacing units). The score
//   must not depend on it; use it to check frame-rate independence.
//
// Output: percentage, slips, path length, time at --speed (default 300 units/s), and whether 99 percent is reached
// within the stencil's timer. Time to 99 is measured to the moment 99 percent is first reached, and the finger is
// assumed to travel at --speed during lifts too. Exit code 0 if 99 percent is reached within the timer without a
// third slip, 1 otherwise. --timer-from-path prints the timer that leaves the PRD section 9 spare fraction
// (TUNING.timerMultEarly / Mid / Boss / Final) as a multiple of the time this path takes to reach 99 percent.

import { readFileSync } from 'node:fs';
import { game } from '../games/ink/src/game.js';

const T = game.TUNING, sim = game.sim, play = game.scenes.play;
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const value = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const valueFlags = new Set(['--speed', '--index', '--events', '--preset']);
const positional = args.filter((a, i) => !a.startsWith('--') && !valueFlags.has(args[i - 1]));
const die = (msg) => { console.error(`sim-ink: ${msg}`); process.exit(2); };
const readJson = (f) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch (e) { die(`cannot read ${f}: ${e.message}`); } };

if (flag('--list')) {
  sim.stencils.forEach((s, i) => console.log(`${i}  ${s.name}  timer ${s.timer}s${s.boss ? '  boss' : ''}`));
  process.exit(0);
}

const speed = Number(value('--speed') ?? 300);
if (!(speed > 0)) die('--speed must be a positive number');
if (flag('--needle')) die('--needle was removed in v0.4: dynamic needle with Flowy inertia is the only needle');
const presetName = value('--preset') ?? 'Standard', preset = (game.presets || []).find((p) => p.label.toLowerCase() === presetName.toLowerCase());
if (!preset) die(`--preset must be one of ${(game.presets || []).map((p) => p.label).join(', ')}`);
Object.assign(T, preset.values);
const eventsHz = value('--events') === undefined ? null : Number(value('--events'));
if (eventsHz !== null && !(eventsHz > 0)) die('--events must be a positive number');

let idx, pathFile;
if (flag('--index')) {
  idx = Number(value('--index'));
  if (!Number.isInteger(idx) || idx < 0 || idx >= sim.stencils.length) die(`--index must be 0 to ${sim.stencils.length - 1}`);
  pathFile = positional[0];
} else {
  if (positional.length < 2) die('usage: sim-ink.mjs <stencil.json> <path.json> | --index N <path.json> | --list');
  const st = readJson(positional[0]);
  if (st.polygons && !st.shape) st.shape = st.polygons;
  if (st.parts) sim.prep(st);
  if (typeof st.name !== 'string' || !(st.timer > 0) || !Array.isArray(st.shape) || !st.shape.length) die('stencil needs name, timer > 0, and shape (list of polygons)');
  for (const poly of st.shape) {
    if (!Array.isArray(poly) || poly.length < 3 || !poly.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))) die('each polygon needs at least 3 [x, y] points');
    for (const [x, y] of poly) if (x < 0 || x > T.designW || y < 0 || y > T.designH) console.log(`warning: point [${x}, ${y}] is outside the ${T.designW}x${T.designH} design space`);
  }
  sim.stencils.push(st);
  idx = sim.stencils.length - 1;
  pathFile = positional[1];
}
if (!pathFile) die('missing path.json');
const path = readJson(pathFile);
if (!Array.isArray(path) || !path.every((p) => p === null || (p && typeof p === 'object' && !Array.isArray(p) && p.hold > 0) || (Array.isArray(p) && (p.length === 2 || p.length === 3) && p.every(Number.isFinite) && (p.length === 2 || p[2] > 0)))) die('path must be an array of [x, y], [x, y, speed] (speed > 0), { hold: seconds } or null');
const st = sim.stencils[idx], st0 = st;

// A stand-in engine: only what the play scene touches.
const E = {
  w: T.designW, h: T.designH, time: 0, safe: { top: 0, bottom: 0 }, pointers: new Map(), sounds: [], scene: null,
  save: { d: {}, get(k, d) { return k in this.d ? this.d[k] : d; }, set(k, v) { this.d[k] = v; } },
  audio: { muted: false, play(n) { E.sounds.push(n); }, beep() {}, toggleMute() {} },
  setScene(n, p) { E.scene = n; },
};
// At 360x640 the view scale is 1 with no offset, so a design point is a screen point; the finger sits needleOffset below the needle.
const finger = (x, y) => ({ id: 1, x, y: y + T.needleOffset });

play.enter(E, { stencil: idx });

const multi = !!st0.parts;
let length = 0, lifted = 0, clock = 0, t99 = null, down = false, last = null, ptr = null;
const step = T.sampleSpacing; // events are cut to this length (or to speed/HZ with --events); the score does not depend on it
const event = (x, y) => {
  E.time = clock;
  if (!down) { ptr = finger(x, y); ptr.t = clock; E.pointers.set(1, ptr); play.onPointerDown(ptr, E); down = true; }
  else { const f = finger(x, y); ptr.x = f.x; ptr.y = f.y; ptr.t = clock; play.onPointerMove(ptr, E); }
  if (t99 === null && (multi ? sim.ended() === 'full' : sim.percent() >= 99)) t99 = clock;
};
for (const pt of path) {
  if (sim.ended()) break;
  if (pt && !Array.isArray(pt)) { // hold still: run the game's own update in frames of 1/60 s (or 1/HZ with --events)
    const fdt = eventsHz ? 1 / eventsHz : 1 / 60, n = Math.round(pt.hold / fdt);
    for (let i = 0; i < n && !sim.ended(); i++) { clock += fdt; E.time = clock; play.update(fdt, E); if (t99 === null && (multi ? sim.ended() === 'full' : sim.percent() >= 99)) t99 = clock; }
    continue;
  }
  if (pt === null) { if (down) { E.pointers.delete(1); play.onPointerUp({ id: 1 }, E); down = false; } continue; }
  const v = pt[2] ?? speed;
  if (last) {
    const d = Math.hypot(pt[0] - last[0], pt[1] - last[1]);
    length += d;
    if (!down) lifted += d;
  }
  if (last && down) {
    const d = Math.hypot(pt[0] - last[0], pt[1] - last[1]);
    const n = Math.max(1, Math.ceil(d / (eventsHz ? v / eventsHz : step)));
    for (let i = 1; i <= n && !sim.ended(); i++) {
      clock += d / n / v;
      event(last[0] + ((pt[0] - last[0]) * i) / n, last[1] + ((pt[1] - last[1]) * i) / n);
    }
  } else {
    if (last) clock += Math.hypot(pt[0] - last[0], pt[1] - last[1]) / speed; // the finger travels during a lift at --speed
    event(pt[0], pt[1]);
  }
  last = pt;
}

const pct = sim.percent(), slips = sim.slips(), ruined = sim.ended() === 'ruined';
const time = clock, time99 = t99;
const timer = sim.timerFor(st), ok = time99 !== null && time99 <= timer && !ruined;
const f1 = (v) => v.toFixed(1);
console.log(`stencil   ${st.name}  (timer ${timer}s, ${preset.label})  needle dynamic (Flowy)`);
console.log(`percent   ${pct}%${sim.ended() === 'full' ? '  (100%, ended)' : ''}`);
console.log(`slips     ${slips}/${T.maxSlips}${ruined ? '  RUINED, stencil ended at the third slip' : ''}`);
console.log(`length    ${length.toFixed(0)} units${lifted ? ` (${lifted.toFixed(0)} while lifted)` : ''}`);
console.log(`time      ${f1(time)}s at ${speed} units/s unless a point gives its own speed`);
console.log(time99 === null ? `${multi ? 'done' : '99%'}       not reached` : `${multi ? 'done     ' : '99%      '} reached at ${f1(time99)}s, ${f1(timer - time99)}s before the timer (${Math.round(((timer - time99) / timer) * 100)}% spare)`);
if (multi) {
  const pd = sim.parts(), n = sim.landings(), c = sim.cleanLand();
  console.log(`landings  ${c} clean of ${n}${n - c ? `, ${n - c} blot${n - c > 1 ? 's' : ''}` : ''}   parts done ${pd.reduce((a, b) => a + b, 0)}/${pd.length} (${pd.join('')})  per part ${sim.partPct().map((v) => v.toFixed(1)).join(' ')}%`);
}
if (slips > 0) console.log('warning   the intended path should be clean: it slips');
console.log(ok ? `result    OK: 99 percent within the ${timer}s timer` : `result    FAIL: 99 percent not reached within the ${timer}s timer`);

if (flag('--timer-from-path')) {
  if (time99 === null) console.log('timer     cannot be set: this path never reaches 99 percent');
  else console.log(`perfect   ${time99.toFixed(2)}s to ${multi ? 'the last part done (99 percent of every part), lifts included' : '99 percent'} (the stencil's perfect time is this)`);
  if (time99 !== null) for (const [label, mult] of [['Circle, Diamond, Heart, Star', T.timerMultEarly], ['Bolt, Halo, Clover, Key, Dagger, Anchor, Rose, Swallow', T.timerMultMid], ['boss Crescent', T.timerMultBoss], ['boss Snake', T.timerMultFinal], ['final boss Skull', T.timerMultSkull]]) {
    const m = mult * T.timerGlobalMult, t = time99 * m;
    console.log(`timer     ${label}: ${f1(t)}s at ${+m.toFixed(3)}x the perfect path (round up: ${Math.ceil(t)})  [${preset.label}]`);
  }
}
process.exit(ok ? 0 : 1);
