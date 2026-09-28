// Gravity Golf, layer 1: the mechanic. Slingshot aim, fixed-step ball physics,
// hole 1, strokes and par, the hole card. Grey box: shapes and three colours only.

import { makeRng, clamp, lerp, dist } from './engine.js';

// Design-space units unless stated. Names match PRD section 16; the rest are marked.
const TUNING = {
  designW: 360,          // Design space width
  designH: 640,          // Design space height
  ballR: 9,              // Ball radius
  holeR: 16,             // Hole radius, ball centre must be inside
  sinkSpeed: 260,        // Max speed (units per second) at which the ball can sink
  friction: 0.6,         // Fraction of speed kept per second on the open field
  stopSpeed: 6,          // Below this speed the ball is at rest
  dragMax: 150,          // Drag distance (screen px) that gives full power
  dragDead: 12,          // Drag shorter than this cancels the shot
  powerMax: 820,         // Launch speed at full drag
  wallBounce: 0.85,      // Fraction of speed kept on a wall or bumper bounce
  wellStrength: 90000,   // Acceleration toward a well is strength divided by distance squared
  wellMinDist: 28,       // Distance below which the pull stops growing
  wellR: 22,             // Visual radius of a well disc
  previewFullHoles: 3,   // Holes 1 to this show the full preview
  previewFullSeconds: 2.0,   // Length of the full preview in simulated seconds
  previewShortSeconds: 0.4,  // Length of the preview after the full-preview holes
  previewDotEvery: 0.05, // Simulated seconds between preview dots
  physicsStep: 1 / 120,  // Fixed physics timestep in seconds
  maxFlightSeconds: 12,  // Safety: a ball still moving after this is stopped where it is
  oobPenalty: 1,         // Strokes added for out of bounds (on top of the shot's own stroke)
  moverPeriod: 2.4,      // Seconds for a mover wall to complete one sweep and return
  trailLength: 18,       // Reserved for layer 3 (trail)
  particleCap: 200,      // Reserved for layer 3 (particles)

  // Layer 1 additions, not in the PRD table.
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
  oobNoteTime: 1.5,      // Seconds the out-of-bounds note stays up
  keyAngleStep: 0.04,    // Keyboard fallback: radians per arrow press
  keyPowerStep: 0.05,    // Keyboard fallback: fraction of full power per arrow press
};
const T = TUNING;
const STEP = T.physicsStep;
const FRIC_STEP = Math.pow(T.friction, STEP);

// Hole data. Coordinates are design space. Layer 2 adds entries.
const LEVELS = [
  {
    // Teaches: drag, power, release. The wall's corner sits on the straight line to the hole, so a shot
    // aimed dead centre clips it and drifts wide; the preview shows this before release.
    // Solution: aim a hair right of the hole centre to clear the corner, any drag from about 30 to 75 px: hole in one.
    name: 'First Light',
    par: 2,
    ball: { x: 180, y: 480 },
    hole: { x: 196, y: 190 },
    walls: [{ x: 60, y: 300, w: 120, h: 22 }],
    bumpers: [],
    wells: [],
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
// otherwise 'sink' | 'oob' | 'rest'. `clock` is the mover clock in seconds.
function stepBall(lv, b, clock) {
  for (const w of lv.wells) {
    const dx = w.x - b.x, dy = w.y - b.y;
    const d = Math.hypot(dx, dy) || 1e-6;
    const dd = Math.max(d, T.wellMinDist); // pull stops growing inside wellMinDist
    const a = (w.strength * T.wellStrength) / (dd * dd);
    b.vx += (dx / d) * a * STEP;
    b.vy += (dy / d) * a * STEP;
  }
  b.vx *= FRIC_STEP; b.vy *= FRIC_STEP;
  b.x += b.vx * STEP; b.y += b.vy * STEP;

  // Speed is under one radius per step at full power, so a ball cannot skip a wall.
  for (const r of lv.walls) bounceRect(b, r);
  if (lv.mover) bounceRect(b, moverRect(lv, clock));
  for (const c of lv.bumpers) bounceCircle(b, c);

  const speed = Math.hypot(b.vx, b.vy);
  if (speed < T.sinkSpeed && dist(b.x, b.y, lv.hole.x, lv.hole.y) < T.holeR) return 'sink';
  if (b.x < 0 || b.x > T.designW || b.y < 0 || b.y > T.designH) return 'oob';
  if (speed < T.stopSpeed) return 'rest';
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
    if (r === 'sink' || r === 'oob') { pts.push({ x: b.x, y: b.y }); break; }
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
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}

function drawField(ctx) {
  ctx.fillStyle = T.fieldColor;
  ctx.fillRect(0, 0, T.designW, T.designH);
  ctx.fillStyle = '#fff';
  for (const s of STARS) { ctx.globalAlpha = s.a; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
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
  ctx.globalAlpha = 0.7; ctx.fillStyle = g;
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

// ---------- Play state ----------

const S = {};

function loadHole(idx) {
  const lv = LEVELS[idx];
  S.idx = idx; S.lv = lv;
  S.ball = { x: lv.ball.x, y: lv.ball.y, vx: 0, vy: 0, hits: 0 };
  S.start = { x: lv.ball.x, y: lv.ball.y };
  S.strokes = 0;
  S.phase = 'aim';       // aim | fly | sink
  S.acc = 0; S.steps = 0;
  S.clock = 0;           // mover clock: runs while aiming, resets when the ball comes to rest
  S.clock0 = 0;
  S.aim = null;          // active pointer aim: { id, sx, sy, x, y }
  S.key = { on: false, angle: Math.atan2(lv.hole.y - lv.ball.y, lv.hole.x - lv.ball.x), power: 0.5 };
  S.sinkT = 0; S.sinkFrom = null;
  S.oobT = 0;
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
  S.start = { x: S.ball.x, y: S.ball.y };
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
  const strokes = S.strokes, par = S.lv.par, id = String(S.idx);
  const prev = E.save.get('best', {})[id];
  const best = prev === undefined ? strokes : Math.min(prev, strokes);
  E.save.update('best', (b) => ({ ...b, [id]: best }), {});
  E.setScene('over', { hole: S.idx, name: S.lv.name, strokes, par, stars: starsFor(strokes, par), best, hasNext: S.idx + 1 < LEVELS.length });
}

// ---------- Scenes ----------

const menu = {
  enter() { this.btnPlay = null; this.btnMute = null; },
  render(ctx, E) {
    const v = view(E);
    ctx.save(); ctx.translate(v.ox, v.oy); ctx.scale(v.s, v.s); drawField(ctx); ctx.restore();
    E.text('GRAVITY', E.w / 2, E.h * 0.24, { size: 46, weight: '800' });
    E.text('GOLF', E.w / 2, E.h * 0.24 + 50, { size: 46, weight: '800', color: T.green });
    this.btnPlay = E.button('Play', E.w / 2, E.h * 0.58, { fill: T.green, color: '#04110a', h: 64, size: 24 });
    this.btnMute = E.button(E.audio.muted ? 'Sound: off' : 'Sound: on', E.w / 2, E.h * 0.58 + 84, { fill: T.slate, w: 170, h: 48, size: 16 });
  },
  onTap(p, E) {
    if (E.hit(this.btnPlay, p)) E.setScene('play', { hole: 0 });
    else if (E.hit(this.btnMute, p)) E.audio.toggleMute();
  },
};

const play = {
  enter(E, params) { loadHole((params && params.hole) || 0); },

  update(dt, E) {
    if (S.oobT > 0) S.oobT -= dt;
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
      if (S.ball.hits !== hitsBefore) E.audio.play('hit');
      if (!r && S.steps * STEP >= T.maxFlightSeconds) r = 'rest';
      if (r === 'sink') { S.phase = 'sink'; S.sinkT = 0; S.sinkFrom = { x: S.ball.x, y: S.ball.y }; }
      else if (r === 'oob') {
        E.audio.play('miss');
        S.strokes += T.oobPenalty;
        S.ball.x = S.start.x; S.ball.y = S.start.y;
        S.oobT = T.oobNoteTime;
        comeToRest();
      } else if (r === 'rest') comeToRest();
    }
  },

  render(ctx, E) {
    const v = view(E), lv = S.lv, b = S.ball;
    ctx.save();
    ctx.translate(v.ox, v.oy); ctx.scale(v.s, v.s);
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

    const top = E.safe.top + 26;
    E.text(`Shots ${S.strokes}`, 16, top, { size: 18, align: 'left' });
    E.text(lv.name, E.w / 2, top, { size: 16, color: '#9aa4b2' });
    E.text(`Par ${lv.par}`, E.w - 16, top, { size: 18, align: 'right', color: T.green });
    if (S.oobT > 0) E.text(`Out of bounds +${T.oobPenalty}`, E.w / 2, top + 34, { size: 18, color: T.orange });
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
    else if (key === ' ') { S.key.on = true; launch(currentLaunch()); }
  },
};

const over = {
  enter(E, params) { this.p = params; this.btnNext = null; this.btnMenu = null; },
  render(ctx, E) {
    const p = this.p, cx = E.w / 2;
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
    this.btnNext = E.button(p.hasNext ? 'Next' : 'Again', cx, E.h * 0.68, { fill: T.green, color: '#04110a', h: 64, size: 24 });
    this.btnMenu = E.button('Menu', cx, E.h * 0.68 + 80, { fill: T.slate, w: 150, h: 48, size: 16 });
  },
  onTap(p, E) {
    if (E.hit(this.btnNext, p)) E.setScene('play', { hole: this.p.hasNext ? this.p.hole + 1 : this.p.hole });
    else if (E.hit(this.btnMenu, p)) E.setScene('menu');
  },
};

export const game = {
  slug: 'gravity-golf',
  title: 'Gravity Golf',
  saveVersion: 1,
  migrate(data, fromVersion) { return data; },
  TUNING,
  start: 'menu',
  scenes: { menu, play, over },
};
