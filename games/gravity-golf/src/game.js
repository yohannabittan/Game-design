// Gravity Golf, layers 1 and 2: the mechanic and the ten holes. Slingshot aim, fixed-step ball physics,
// wells, bumpers, a mover, strokes and par, the hole card, hole select. Grey box: shapes and three colours only.

import { makeRng, clamp, lerp, dist } from './engine.js';

// Design-space units unless stated. Names match PRD section 16; the rest are marked.
const TUNING = {
  designW: 360,          // Design space width
  designH: 640,          // Design space height
  ballR: 9,              // Ball radius
  holeR: 18,             // Hole radius, ball centre must be inside
  sinkSpeed: 380,        // Max speed (units per second) at which the ball can sink
  captureR: 44,          // Within this distance of the hole centre the cup pulls the ball
  captureStrength: 900,  // Constant acceleration toward the hole centre inside captureR
  friction: 0.28,        // Fraction of speed kept per second on the open field
  stopSpeed: 50,         // Below this speed the ball is at rest
  dragMax: 150,          // Drag distance (screen px) that gives full power
  dragDead: 12,          // Drag shorter than this cancels the shot
  powerMax: 820,         // Launch speed at full drag
  wallBounce: 0.85,      // Fraction of speed kept on a wall or bumper bounce
  wellStrength: 5200000, // Acceleration toward a well is strength divided by distance squared
  wellMinDist: 28,       // Distance below which the pull stops growing
  wellR: 22,             // Visual radius of a well disc
  previewFullHoles: 3,   // Holes 1 to this show the full preview
  previewFullSeconds: 2.0,   // Length of the full preview in simulated seconds
  previewShortSeconds: 0.4,  // Length of the preview after the full-preview holes
  previewDotEvery: 0.05, // Simulated seconds between preview dots
  physicsStep: 1 / 120,  // Fixed physics timestep in seconds
  maxFlightSeconds: 12,  // Safety: a ball still moving after this is stopped where it is
  moverPeriod: 2.4,      // Seconds for a mover wall to complete one sweep and return
  trailLength: 18,       // Reserved for layer 3 (trail)
  particleCap: 200,      // Reserved for layer 3 (particles)
  speedMax: 1400,        // Ball speed is clamped here so wells cannot cause tunnelling
  keyPowerStart: 0.5,    // Starting power fraction for the keyboard fallback

  // Layer 1 additions, not in the PRD table.
  holdAccel: 250,        // A slow ball only rests where the wells pull with less than this (units per s squared)
  bg: '#070b19',         // Letterbox colour (the engine reads this name)
  fieldColor: '#0e1631',
  green: '#22c55e',      // Goal
  purple: '#a855f7',     // Wells
  orange: '#f97316',     // Repulsors and full power
  slate: '#475569',      // Walls and bumpers
  slateEdge: '#64748b',
  ballGrabR: 14,         // A touch that starts this close to the ball does not aim
  bounceEventSpeed: 40,  // Impact speed below this is a slide, not a hit (no sound)
  sinkTime: 0.45,        // Seconds the ball takes to drop into the hole before the card
  gridCols: 5,           // Hole select tiles per row
  tileGap: 8,            // Gap between hole select tiles (screen px)
  tileH: 68,             // Hole select tile height (screen px)
  keyAngleStep: 0.04,    // Keyboard fallback: radians per arrow press
  keyPowerStep: 0.05,    // Keyboard fallback: fraction of full power per arrow press
};
const T = TUNING;
const STEP = T.physicsStep;
const FRIC_STEP = Math.pow(T.friction, STEP);


// Hole data. Coordinates are design space; the four field edges are walls added by the physics.
// well.strength multiplies wellStrength (negative pushes). `boss` holes are named on the card and the select grid.
// Drag vectors in the comments are screen px (finger moves dx right, dy down); the ball flies the opposite way.
// Each was verified to sink in the harness, and all neighbouring whole-pixel drags sink too.
const LEVELS = [
  {
    // Teaches: drag, power, release, and that a well bends the flight, so aim off the line and let it curve.
    // Solution: drag (21, 98), one shot; about 12 degrees of aim sink it.
    name: 'First Light', par: 2, boss: false,
    ball: { x: 180, y: 520 }, hole: { x: 180, y: 190 },
    walls: [], bumpers: [], wells: [{ x: 265, y: 360, strength: 0.6 }],
  },
  {
    // Teaches tip 2, the bank: the wall blocks the straight line, so bounce off the left edge.
    // Solution: drag (57, 94), one shot; about 14 degrees of aim sink it and no shot without a bounce does.
    name: 'Bank Shot', par: 2, boss: false,
    ball: { x: 100, y: 470 }, hole: { x: 100, y: 170 },
    walls: [{ x: 60, y: 310, w: 80, h: 22 }], bumpers: [], wells: [],
  },
  {
    // Teaches tip 3: the well sits on the line, so aim to one side and let it bend the path around.
    // Solution: drag (52, 97), one shot, about 80 units clear of the well; about 18 degrees of aim sink it.
    name: 'Around the Bend', par: 2, boss: false,
    ball: { x: 165, y: 480 }, hole: { x: 165, y: 170 },
    walls: [], bumpers: [], wells: [{ x: 180, y: 310, strength: 1.1 }],
  },
  {
    // Teaches tip 1, use only the power you need: a corridor is a precision hole, not a power hole.
    // Solution: drag (-16, 109), straight up the corridor, one shot; about 3 degrees of aim sink it.
    name: 'Corridor', par: 2, boss: false,
    ball: { x: 90, y: 520 }, hole: { x: 180, y: 150 },
    walls: [{ x: 140, y: 290, w: 22, h: 170 }, { x: 200, y: 290, w: 22, h: 170 }], bumpers: [], wells: [],
  },
  {
    // BOSS. Introduces tip 4, the slingshot: the big well dead centre eats slow shots, so pass it fast and let it whip the ball round.
    // Solution: drag (69, 133) (full power), passing about 110 units from the well, one shot; about 9 degrees of aim sink it.
    name: 'Event Horizon', par: 3, boss: true,
    ball: { x: 160, y: 560 }, hole: { x: 160, y: 90 },
    walls: [], bumpers: [], wells: [{ x: 180, y: 320, strength: 2.5 }],
  },
  {
    // Introduces tip 6: the repulsor beside the hole pushes a fast ball into it, so aim at its flank.
    // Solution: drag (-22, 148) (full power), one shot; about 8 degrees of aim sink it and nothing straight at the hole does.
    name: 'Push Back', par: 3, boss: false,
    ball: { x: 180, y: 500 }, hole: { x: 200, y: 140 },
    walls: [], bumpers: [], wells: [{ x: 285, y: 178, strength: -0.92 }],
  },
  {
    // Bumper field: tip 2 again, off a bumper. The centre bumper blocks the line.
    // Solution: drag (93, 111), one bounce off the left bumper, one shot; about 9 degrees of aim sink it.
    name: 'Pinball', par: 3, boss: false,
    ball: { x: 180, y: 540 }, hole: { x: 180, y: 140 },
    walls: [], bumpers: [{ x: 180, y: 400, r: 26 }, { x: 110, y: 310, r: 24 }, { x: 250, y: 310, r: 24 }], wells: [],
  },
  {
    // Needs tips 3 and 4: whip round the first well close in (about 40 units), then let the second bend the path wide (about 95).
    // Solution: drag (85, 124) (full power), one shot; about 10 degrees of aim sink it.
    name: 'Figure Eight', par: 3, boss: false,
    ball: { x: 180, y: 540 }, hole: { x: 180, y: 110 },
    walls: [], bumpers: [], wells: [{ x: 150, y: 390, strength: 1.1 }, { x: 245, y: 210, strength: 1.1 }],
  },
  {
    // Needs tip 5, the brake: the well below the gap speeds the ball past sink speed, so graze the gap's left wall to bleed it.
    // Solution: drag (3, 150) (full power), one graze, one shot; about 3 degrees of aim sink it and none without a bounce does.
    name: 'The Needle', par: 3, boss: false,
    ball: { x: 211, y: 497 }, hole: { x: 184, y: 120 },
    walls: [{ x: 0, y: 190, w: 156, h: 22 }, { x: 212, y: 190, w: 148, h: 22 }], bumpers: [],
    wells: [{ x: 120, y: 251, strength: 2.38 }],
  },
  {
    // BOSS. Timing plus everything before: the wall sweeps the gate; the well and bumper bend the rest of the way.
    // Solution: drag (20, 139), released 0.5 to 1.1 s after the ball stops (wall swinging to its right end), one shot through the left gap.
    name: 'Gatekeeper', par: 3, boss: true,
    ball: { x: 180, y: 560 }, hole: { x: 180, y: 100 },
    walls: [{ x: 0, y: 330, w: 100, h: 22 }, { x: 260, y: 330, w: 100, h: 22 }],
    bumpers: [{ x: 95, y: 200, r: 24 }],
    wells: [{ x: 280, y: 210, strength: 1.2 }],
    mover: { w: 90, h: 22, a: { x: 100, y: 286 }, b: { x: 170, y: 286 } },
  },
];

// ---------- Physics (one function drives the flight and the preview) ----------

function moverRect(lv, clock) {
  const m = lv.mover;
  const k = 0.5 - 0.5 * Math.cos((2 * Math.PI * clock) / T.moverPeriod);
  return { x: lerp(m.a.x, m.b.x, k), y: lerp(m.a.y, m.b.y, k), w: m.w, h: m.h };
}

function reflect(b, nx, ny) {
  const vn = b.vx * nx + b.vy * ny;
  if (vn >= 0) return;
  b.vx = (b.vx - 2 * vn * nx) * T.wallBounce;
  b.vy = (b.vy - 2 * vn * ny) * T.wallBounce;
  if (-vn >= T.bounceEventSpeed) b.hits++;
}

function bounceRect(b, r) {
  const cx = clamp(b.x, r.x, r.x + r.w), cy = clamp(b.y, r.y, r.y + r.h);
  let nx = b.x - cx, ny = b.y - cy;
  const d = Math.hypot(nx, ny);
  if (d >= T.ballR) return;
  if (d > 0) {
    nx /= d; ny /= d;
    b.x = cx + nx * T.ballR; b.y = cy + ny * T.ballR;
  } else {
    // Centre is inside the rectangle: leave by the nearest face.
    const gaps = [b.x - r.x, r.x + r.w - b.x, b.y - r.y, r.y + r.h - b.y];
    const i = gaps.indexOf(Math.min(...gaps));
    nx = i === 0 ? -1 : i === 1 ? 1 : 0;
    ny = i === 2 ? -1 : i === 3 ? 1 : 0;
    if (i === 0) b.x = r.x - T.ballR; else if (i === 1) b.x = r.x + r.w + T.ballR;
    else if (i === 2) b.y = r.y - T.ballR; else b.y = r.y + r.h + T.ballR;
  }
  reflect(b, nx, ny);
}

function bounceCircle(b, c) {
  const dx = b.x - c.x, dy = b.y - c.y, d = Math.hypot(dx, dy), min = T.ballR + c.r;
  if (d >= min || d === 0) return;
  const nx = dx / d, ny = dy / d;
  b.x = c.x + nx * min; b.y = c.y + ny * min;
  reflect(b, nx, ny);
}

// Advances the ball one fixed step. Returns null while it is still rolling,
// otherwise 'sink' | 'rest'. `clock` is the mover clock in seconds.
function stepBall(lv, b, clock) {
  let wax = 0, way = 0, core = false;
  for (const w of lv.wells) {
    const dx = w.x - b.x, dy = w.y - b.y;
    const d = Math.hypot(dx, dy) || 1e-6;
    const dd = Math.max(d, T.wellMinDist); // pull stops growing inside wellMinDist
    const a = (w.strength * T.wellStrength) / (dd * dd);
    b.vx += (dx / d) * a * STEP;
    b.vy += (dy / d) * a * STEP;
    wax += (dx / d) * a; way += (dy / d) * a;
    if (w.strength > 0 && d < T.wellMinDist) core = true;
  }
  const hx = lv.hole.x - b.x, hy = lv.hole.y - b.y, hd = Math.hypot(hx, hy);
  if (hd < T.captureR && hd > 0) { // the cup pulls a slow ball in like a real cup
    b.vx += (hx / hd) * T.captureStrength * STEP;
    b.vy += (hy / hd) * T.captureStrength * STEP;
  }
  b.vx *= FRIC_STEP; b.vy *= FRIC_STEP;
  const sp = Math.hypot(b.vx, b.vy);
  if (sp > T.speedMax) { b.vx *= T.speedMax / sp; b.vy *= T.speedMax / sp; }
  b.x += b.vx * STEP; b.y += b.vy * STEP;

  // Speed is under one radius per step at full power, so a ball cannot skip a wall.
  for (const r of lv.walls) bounceRect(b, r);
  if (lv.mover) bounceRect(b, moverRect(lv, clock));
  for (const c of lv.bumpers) bounceCircle(b, c);

  // Every hole is walled on all four edges of the design space.
  if (b.x < T.ballR) { b.x = T.ballR; reflect(b, 1, 0); }
  else if (b.x > T.designW - T.ballR) { b.x = T.designW - T.ballR; reflect(b, -1, 0); }
  if (b.y < T.ballR) { b.y = T.ballR; reflect(b, 0, 1); }
  else if (b.y > T.designH - T.ballR) { b.y = T.designH - T.ballR; reflect(b, 0, -1); }

  const speed = Math.hypot(b.vx, b.vy);
  if (speed < T.sinkSpeed && dist(b.x, b.y, lv.hole.x, lv.hole.y) < T.holeR) return 'sink';
  // A slow ball rests unless the cup or a well is pulling it: it turns around and falls in instead of freezing
  // at the top of its arc. Deep inside a well's core it parks.
  if (speed < T.stopSpeed && hd >= T.captureR && (core || Math.hypot(wax, way) < T.holdAccel)) return 'rest';
  return null;
}

// Drag in screen px (finger minus touch start) to launch velocity. Null inside the dead zone.
function launchFromDrag(dx, dy) {
  const len = Math.hypot(dx, dy);
  if (len < T.dragDead) return null;
  const power = Math.min(1, len / T.dragMax);
  return { vx: (-dx / len) * power * T.powerMax, vy: (-dy / len) * power * T.powerMax, power };
}

// Same physics as the flight, sampled every previewDotEvery simulated seconds.
function previewPoints(lv, x, y, vx, vy, clock, seconds) {
  const b = { x, y, vx, vy, hits: 0 };
  const every = Math.round(T.previewDotEvery / STEP);
  const steps = Math.round(seconds / STEP);
  const pts = [];
  for (let i = 1; i <= steps; i++) {
    const r = stepBall(lv, b, clock + i * STEP);
    if (r === 'sink') { pts.push({ x: b.x, y: b.y }); break; }
    if (r === 'rest') break;
    if (i % every === 0) pts.push({ x: b.x, y: b.y });
  }
  return pts;
}

// ---------- Helpers ----------

const STARS = (() => {
  const r = makeRng(20260928);
  return Array.from({ length: 45 }, () => ({ x: r.range(0, T.designW), y: r.range(0, T.designH), r: r.range(0.6, 1.4), a: r.range(0.15, 0.5) }));
})();

function view(E) {
  const s = Math.min(E.w / T.designW, E.h / T.designH);
  return { s, ox: (E.w - T.designW * s) / 2, oy: (E.h - T.designH * s) / 2 };
}

function starsFor(strokes, par) { return strokes <= par - 1 ? 3 : strokes <= par ? 2 : 1; }

function progress(E) {
  const best = E.save.get('best', {});
  const stars = LEVELS.map((lv, i) => (best[i] === undefined ? 0 : starsFor(best[i], lv.par)));
  return { best, stars, total: stars.reduce((a, b) => a + b, 0), unlocked: clamp(E.save.get('unlocked', 0), 0, LEVELS.length - 1) };
}

function mixToOrange(t) {
  const c = (a, b) => Math.round(lerp(a, b, t));
  return `rgb(${c(255, 249)},${c(255, 115)},${c(255, 22)})`;
}

function drawStar(ctx, cx, cy, R, fill, stroke) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? R * 0.45 : R;
    ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
}

function drawField(ctx) {
  ctx.fillStyle = T.fieldColor;
  ctx.fillRect(0, 0, T.designW, T.designH);
  ctx.fillStyle = '#fff';
  for (const s of STARS) { ctx.globalAlpha = s.a; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
}

// The edge walls sit just outside the field so the ball never overlaps them.
function drawBorder(ctx) {
  ctx.strokeStyle = T.slate; ctx.lineWidth = 8;
  ctx.strokeRect(-4, -4, T.designW + 8, T.designH + 8);
  ctx.strokeStyle = T.slateEdge; ctx.lineWidth = 1.5;
  ctx.strokeRect(-0.75, -0.75, T.designW + 1.5, T.designH + 1.5);
}

function drawWall(ctx, r) {
  ctx.fillStyle = T.slate; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = T.slateEdge; ctx.lineWidth = 2; ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
}

function drawBumper(ctx, c) {
  ctx.fillStyle = T.slate; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = T.slateEdge; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c.x, c.y, c.r - 1, 0, Math.PI * 2); ctx.stroke();
}

// Purple disc with rings drifting in (pull); orange with rings drifting out (repulsor).
function drawWell(ctx, w, time) {
  const push = w.strength < 0;
  const col = push ? T.orange : T.purple;
  const r = T.wellR * Math.sqrt(Math.abs(w.strength));
  const g = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, r);
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.95; ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(w.x, w.y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 1.5;
  for (let i = 0; i < 2; i++) {
    const k = (time * 0.5 + i * 0.5) % 1;
    const rr = r * (1 + 1.2 * (push ? k : 1 - k));
    ctx.globalAlpha = 0.6 * (1 - Math.abs(k * 2 - 1) * 0.6);
    ctx.beginPath(); ctx.arc(w.x, w.y, rr, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawLock(ctx, cx, cy) {
  ctx.strokeStyle = '#64748b'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy - 3, 5, Math.PI, 0); ctx.stroke();
  ctx.fillStyle = '#64748b'; ctx.fillRect(cx - 7, cy - 3, 14, 11);
}

// ---------- Play state ----------

const S = {};

function loadHole(idx) {
  const lv = LEVELS[idx];
  S.idx = idx; S.lv = lv;
  S.ball = { x: lv.ball.x, y: lv.ball.y, vx: 0, vy: 0, hits: 0 };
  S.strokes = 0;
  S.phase = 'aim';       // aim | fly | sink
  S.acc = 0; S.steps = 0;
  S.clock = 0;           // mover clock: runs while aiming, restarts when the ball comes to rest
  S.clock0 = 0;
  S.aim = null;          // active pointer aim: { id, sx, sy, x, y }
  S.key = { on: false, angle: Math.atan2(lv.hole.y - lv.ball.y, lv.hole.x - lv.ball.x), power: T.keyPowerStart };
  S.sinkT = 0; S.sinkFrom = null;
}

// Current aim as a launch, from the pointer drag or the keyboard fallback.
function currentLaunch() {
  if (S.aim) return launchFromDrag(S.aim.x - S.aim.sx, S.aim.y - S.aim.sy);
  if (S.key.on) {
    const power = clamp(S.key.power, T.dragDead / T.dragMax, 1);
    return { vx: Math.cos(S.key.angle) * power * T.powerMax, vy: Math.sin(S.key.angle) * power * T.powerMax, power };
  }
  return null;
}

function launch(l) {
  S.strokes++;
  S.ball.vx = l.vx; S.ball.vy = l.vy;
  S.clock0 = S.clock;
  S.acc = 0; S.steps = 0;
  S.phase = 'fly';
  S.aim = null; S.key.on = false;
}

function comeToRest() {
  S.ball.vx = S.ball.vy = 0;
  S.phase = 'aim';
  S.clock = 0;
}

function finishHole(E) {
  const strokes = S.strokes, lv = S.lv, id = String(S.idx);
  const prev = E.save.get('best', {})[id];
  const best = prev === undefined ? strokes : Math.min(prev, strokes);
  E.save.update('best', (b) => ({ ...b, [id]: best }), {});
  const hasNext = S.idx + 1 < LEVELS.length;
  if (hasNext) E.save.update('unlocked', (u) => Math.max(u, S.idx + 1), 0);
  E.setScene('over', { hole: S.idx, name: lv.name, boss: lv.boss, strokes, par: lv.par, stars: starsFor(strokes, lv.par), best, hasNext });
}

// ---------- Scenes ----------

const menu = {
  enter() { this.btnPlay = null; this.btnMute = null; this.tiles = []; },
  render(ctx, E) {
    const v = view(E), p = progress(E), cx = E.w / 2;
    ctx.save(); ctx.translate(v.ox, v.oy); ctx.scale(v.s, v.s); drawField(ctx); ctx.restore();
    E.text('GRAVITY GOLF', cx, E.h * 0.09, { size: 34, weight: '800' });
    E.text(`Stars ${p.total} / ${LEVELS.length * 3}`, cx, E.h * 0.09 + 40, { size: 18, color: T.green });

    const m = 16, gap = T.tileGap, cols = T.gridCols;
    const tw = (E.w - 2 * m - (cols - 1) * gap) / cols, th = T.tileH, top = E.h * 0.2;
    this.tiles = [];
    LEVELS.forEach((lv, i) => {
      const x = m + (i % cols) * (tw + gap), y = top + Math.floor(i / cols) * (th + gap);
      const locked = i > p.unlocked, cleared = p.best[i] !== undefined;
      E.roundRect(x, y, tw, th, 10, locked ? '#0a1024' : '#16203d', cleared ? T.green : locked ? '#1b2440' : T.slate);
      E.text(`${i + 1}`, x + tw / 2, y + 19, { size: 20, weight: '800', color: locked ? '#475569' : '#e6e6e6' });
      if (locked) drawLock(ctx, x + tw / 2, y + th - 24);
      else {
        if (lv.boss) E.text('Boss', x + tw / 2, y + 40, { size: 14, color: '#cbd5e1' });
        for (let s = 0; s < 3; s++) drawStar(ctx, x + tw / 2 + (s - 1) * 15, y + th - 13, 6.5, s < p.stars[i] ? T.green : null, s < p.stars[i] ? null : '#334155');
      }
      this.tiles.push({ x, y, w: tw, h: th, hole: i, locked });
    });

    this.btnPlay = E.button(p.total > 0 || p.unlocked > 0 ? `Play hole ${p.unlocked + 1}` : 'Play', cx, E.h * 0.58, { fill: T.green, color: '#04110a', h: 64, size: 22 });
    this.btnMute = E.button(E.audio.muted ? 'Sound: off' : 'Sound: on', cx, E.h * 0.58 + 84, { fill: T.slate, w: 170, h: 48, size: 16 });
  },
  onTap(p, E) {
    if (E.hit(this.btnPlay, p)) { E.setScene('play', { hole: progress(E).unlocked }); return; }
    if (E.hit(this.btnMute, p)) { E.audio.toggleMute(); return; }
    for (const t of this.tiles) if (!t.locked && E.hit(t, p)) { E.setScene('play', { hole: t.hole }); return; }
  },
};

const play = {
  enter(E, params) { loadHole(clamp((params && params.hole) || 0, 0, LEVELS.length - 1)); },

  update(dt, E) {
    if (S.phase === 'aim') { S.clock += dt; return; }
    if (S.phase === 'sink') {
      S.sinkT += dt;
      if (S.sinkT >= T.sinkTime) finishHole(E);
      return;
    }
    // Fixed-step accumulator: outcomes depend on the drag, never on the frame rate.
    S.acc += dt;
    while (S.acc >= STEP && S.phase === 'fly') {
      S.acc -= STEP; S.steps++;
      const hitsBefore = S.ball.hits;
      let r = stepBall(S.lv, S.ball, S.clock0 + S.steps * STEP);
      if (S.ball.hits !== hitsBefore) E.audio.play('hit', 0.3);
      if (!r && S.steps * STEP >= T.maxFlightSeconds) r = 'rest';
      if (r === 'sink') { S.phase = 'sink'; S.sinkT = 0; S.sinkFrom = { x: S.ball.x, y: S.ball.y }; E.audio.play('win'); }
      else if (r === 'rest') comeToRest();
    }
  },

  render(ctx, E) {
    const v = view(E), lv = S.lv, b = S.ball;
    ctx.save();
    ctx.translate(v.ox, v.oy); ctx.scale(v.s, v.s);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, T.designW, T.designH); ctx.clip();
    drawField(ctx);
    for (const w of lv.wells) drawWell(ctx, w, E.time);
    for (const r of lv.walls) drawWall(ctx, r);
    if (lv.mover) drawWall(ctx, moverRect(lv, S.phase === 'fly' ? S.clock0 + S.steps * STEP : S.clock));
    for (const c of lv.bumpers) drawBumper(ctx, c);

    // Hole: the ring brightens while the ball is moving slowly enough to sink.
    const sinkable = S.phase === 'fly' && Math.hypot(b.vx, b.vy) < T.sinkSpeed;
    ctx.fillStyle = '#04110a';
    ctx.beginPath(); ctx.arc(lv.hole.x, lv.hole.y, T.holeR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = T.green;
    ctx.globalAlpha = sinkable ? 1 : 0.55; ctx.lineWidth = sinkable ? 5 : 3;
    ctx.beginPath(); ctx.arc(lv.hole.x, lv.hole.y, T.holeR, 0, Math.PI * 2); ctx.stroke();
    if (sinkable) { ctx.globalAlpha = 0.35; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(lv.hole.x, lv.hole.y, T.holeR + 6, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1;

    const aiming = S.phase === 'aim' ? currentLaunch() : null;
    if (aiming) {
      const seconds = S.idx < T.previewFullHoles ? T.previewFullSeconds : T.previewShortSeconds;
      const pts = previewPoints(lv, b.x, b.y, aiming.vx, aiming.vy, S.clock, seconds);
      const col = mixToOrange(aiming.power);
      const ux = aiming.vx / (aiming.power * T.powerMax), uy = aiming.vy / (aiming.power * T.powerMax);
      const len = 20 + 60 * aiming.power; // line length shows power
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(b.x + ux * (T.ballR + 3), b.y + uy * (T.ballR + 3)); ctx.lineTo(b.x + ux * (T.ballR + 3 + len), b.y + uy * (T.ballR + 3 + len)); ctx.stroke();
      ctx.fillStyle = col;
      pts.forEach((p, i) => { ctx.globalAlpha = 1 - 0.6 * (i / pts.length); ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2); ctx.fill(); });
      ctx.globalAlpha = 0.3; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(b.x, b.y, T.ballR + 5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    let bx = b.x, by = b.y, br = T.ballR;
    if (S.phase === 'sink') {
      const k = clamp(S.sinkT / T.sinkTime, 0, 1);
      bx = lerp(S.sinkFrom.x, lv.hole.x, k); by = lerp(S.sinkFrom.y, lv.hole.y, k); br = T.ballR * (1 - k);
    }
    if (br > 0.1) {
      ctx.fillStyle = 'rgba(2,4,12,0.55)'; ctx.beginPath(); ctx.arc(bx + 2, by + 3, br, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    drawBorder(ctx);
    ctx.restore();

    const top = E.safe.top + 26;
    E.text(`Shots ${S.strokes}`, 16, top, { size: 18, align: 'left' });
    E.text(lv.boss ? `Hole ${S.idx + 1} Boss` : `Hole ${S.idx + 1}`, E.w / 2, top, { size: 16, color: '#9aa4b2' });
    E.text(`Par ${lv.par}`, E.w - 16, top, { size: 18, align: 'right', color: T.green });
  },

  onPointerDown(p, E) {
    if (S.phase !== 'aim' || S.aim) return;
    const v = view(E);
    const gx = (p.x - v.ox) / v.s, gy = (p.y - v.oy) / v.s;
    if (dist(gx, gy, S.ball.x, S.ball.y) <= T.ballGrabR) return;
    S.aim = { id: p.id, sx: p.x, sy: p.y, x: p.x, y: p.y };
  },
  onPointerMove(p) {
    if (S.aim && S.aim.id === p.id) { S.aim.x = p.x; S.aim.y = p.y; }
  },
  onPointerUp(p) {
    if (!S.aim || S.aim.id !== p.id) return;
    if (p.cancelled) { S.aim = null; return; }
    S.aim.x = p.x; S.aim.y = p.y;
    const l = currentLaunch();
    if (l) launch(l); else S.aim = null; // inside the dead zone: cancel, no stroke
  },
  onKey(key) {
    if (S.phase !== 'aim') return;
    if (key === 'ArrowLeft') { S.key.on = true; S.key.angle -= T.keyAngleStep; }
    else if (key === 'ArrowRight') { S.key.on = true; S.key.angle += T.keyAngleStep; }
    else if (key === 'ArrowUp') { S.key.on = true; S.key.power = Math.min(1, S.key.power + T.keyPowerStep); }
    else if (key === 'ArrowDown') { S.key.on = true; S.key.power = Math.max(T.dragDead / T.dragMax, S.key.power - T.keyPowerStep); }
    else if (key === ' ') { S.key.on = true; const l = currentLaunch(); if (l) launch(l); }
  },
};

const over = {
  enter(E, params) { this.p = params; this.btnNext = null; this.btnMenu = null; },
  render(ctx, E) {
    const p = this.p, cx = E.w / 2;
    if (p.boss) E.text('Boss', cx, E.h * 0.12, { size: 18, color: '#cbd5e1' });
    E.text(p.name, cx, E.h * 0.16, { size: 18, color: '#9aa4b2' });
    E.text(`${p.strokes} ${p.strokes === 1 ? 'shot' : 'shots'}`, cx, E.h * 0.24, { size: 44, weight: '800' });
    E.text(`Par ${p.par}`, cx, E.h * 0.24 + 44, { size: 20, color: '#9aa4b2' });
    for (let i = 0; i < 3; i++) {
      const sx = cx + (i - 1) * 64, sy = E.h * 0.24 + 120;
      if (i < p.stars) drawStar(ctx, sx, sy, 26, T.green); else drawStar(ctx, sx, sy, 26, null, '#334155');
    }
    const line = p.stars === 3 ? (p.strokes === 1 ? 'Hole in one' : 'Under par') : '';
    if (line) E.text(line, cx, E.h * 0.24 + 178, { size: 20, color: T.green });
    E.text(`Best ${p.best}`, cx, E.h * 0.24 + 214, { size: 18, color: '#9aa4b2' });
    this.btnNext = E.button(p.hasNext ? 'Next' : 'Menu', cx, E.h * 0.68, { fill: T.green, color: '#04110a', h: 64, size: 24 });
    this.btnMenu = p.hasNext ? E.button('Menu', cx, E.h * 0.68 + 80, { fill: T.slate, w: 150, h: 48, size: 16 }) : null;
  },
  onTap(p, E) {
    if (E.hit(this.btnNext, p)) E.setScene(this.p.hasNext ? 'play' : 'menu', { hole: this.p.hole + 1 });
    else if (this.btnMenu && E.hit(this.btnMenu, p)) E.setScene('menu');
  },
};

export const game = {
  slug: 'gravity-golf',
  title: 'Gravity Golf',
  saveVersion: 3,
  // v1 was the skeleton demo, where `best` was a number; v2 keeps best strokes per hole in a map;
  // v3 adds `unlocked`, the highest unlocked hole, rebuilt from the holes already cleared.
  migrate(data, fromVersion) {
    if (typeof data.best !== 'object' || data.best === null) delete data.best;
    if (data.unlocked === undefined) {
      const cleared = Object.keys(data.best || {}).map(Number);
      data.unlocked = Math.min(cleared.length ? Math.max(...cleared) + 1 : 0, LEVELS.length - 1);
    }
    return data;
  },
  TUNING,
  start: 'menu',
  scenes: { menu, play, over },
};
