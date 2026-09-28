// Gravity Golf, layers 1 to 3: the mechanic, the ten holes and the juice. Slingshot aim, fixed-step ball physics,
// wells, bumpers, a mover, strokes and par, the hole card, hole select. Shapes and three colours; effects are cosmetic only.

import { makeRng, ease, clamp, lerp, dist } from './engine.js';

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
  wellStrength: 7000000, // Acceleration toward a well is strength divided by distance squared
  wellMinDist: 44,       // Inside this distance the pull falls off linearly to zero at the centre
  wellR: 22,             // Visual radius of a well disc
  previewFullHoles: 3,   // Holes 1 to this show the full preview
  previewFullSeconds: 2.0,   // Length of the full preview in simulated seconds
  previewShortSeconds: 0.4,  // Length of the preview after the full-preview holes
  previewDotEvery: 0.05, // Simulated seconds between preview dots
  physicsStep: 1 / 120,  // Fixed physics timestep in seconds
  maxFlightSeconds: 12,  // Safety: a ball still moving after this is stopped where it is
  moverPeriod: 2.4,      // Seconds for a mover wall to complete one sweep and return
  trailLength: 18,       // Points kept in the ball's trail
  particleCap: 200,      // Max live particles
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
  borderW: 8,            // Drawn thickness of the edge walls, kept on screen by view()
  retryW: 64,            // Retry button size (screen px)
  retryH: 44,
  ballGrabR: 14,         // A touch that starts this close to the ball does not aim
  bounceEventSpeed: 40,  // Impact speed below this is a slide, not a hit (no sound)
  sinkTime: 0.45,        // Seconds the ball takes to drop into the hole before the card
  gridCols: 5,           // Hole select tiles per row
  tileGap: 8,            // Gap between hole select tiles (screen px)
  tileH: 68,             // Hole select tile height (screen px)
  keyAngleStep: 0.04,    // Keyboard fallback: radians per arrow press
  keyPowerStep: 0.05,    // Keyboard fallback: fraction of full power per arrow press

  // Layer 3: juice. Cosmetic only; nothing here is read by the physics. Durations in seconds, sizes in design units,
  // speeds in design units per second, particle drag is per frame.
  juice: {
    particleDrag: 0.93,
    // Drag start
    glowStart: 0.6,        // Glow strength on the very first frame of a touch (0 to 1)
    glowInTime: 0.08,      // Seconds to reach full glow while aiming
    glowOutTime: 0.18,     // Seconds to fade after release or cancel
    glowR: 12,             // Glow radius beyond the ball at zero power
    glowRPower: 10,        // Extra glow radius at full power
    glowAlpha: 0.75,
    dragPopFrom: 0.72,     // Ball scale at touch, springs to 1 with outBack
    dragPopTime: 0.2,
    aimWidth: 3,           // Aim line width at zero power
    aimWidthPower: 2.5,    // Extra width at full power
    // Release
    flashTime: 0.22,       // Ball flash ring and glow
    flashRing: 2.8,        // Flash ring radius at the end, in ball radii
    puffCount: 7,
    puffSpeed: 90,
    puffLife: 0.35,
    puffSize: 3.5,
    puffSpread: 1.1,
    puffColor: '#cbd5e1',
    releaseHaptic: 8,
    // Wall and bumper bounce
    hitVol: 0.3,
    bigHitVol: 0.5,
    bigHitSpeed: 560,      // Impact speed above which a hit is a big hit (burst, shake, louder)
    sparkCount: 5,
    sparkBigCount: 13,
    sparkSpeed: 120,
    sparkBigSpeed: 210,
    sparkLife: 0.28,
    sparkBigLife: 0.42,
    sparkSize: 2.4,
    sparkBigSize: 3.2,
    sparkSpread: 1.9,
    sparkColor: '#94a3b8', // Slate, one step lighter than the walls so it reads on the navy field
    sparkBigColor: '#cbd5e1',
    bigShake: 3,           // Screen px
    bigShakeTime: 0.12,
    // Wells
    wellNearR: 120,        // Within this distance of a well the ball trails and the well's rings speed up
    ringRate: 0.5,         // Ring cycles per second when the ball is far
    ringBoost: 2.4,        // Extra cycles per second when the ball is on top of the well
    trailEvery: 2,         // Physics steps between trail samples
    trailDecay: 0.03,      // Seconds per trail point when the trail drains at rest
    trailWidth: 4,
    trailAlpha: 0.5,
    bossWell: '#e879f9',   // Boss holes: ring and disc colour for pulling wells
    // Boss banner
    bannerTime: 1.5,
    bannerIn: 0.25,
    bannerOut: 0.25,
    bannerH: 68,
    bannerY: 0.3,          // Fraction of screen height
    // Sink
    burstCount: 22,
    burstBigCount: 46,
    burstSpeed: 230,
    burstLife: 0.55,
    burstSize: 3.6,
    burstColor: '#22c55e',
    burstLight: '#bbf7d0',
    sinkHaptic: 30,
    sinkRingTime: 0.4,
    sinkRingR: 34,
    coinLead: 0.14,        // Three stars: coin, then win after this long
    threeStarFlash: 0.1,
    // Hole card
    cardSlide: 0.42,
    cardSlideFrac: 0.35,   // Slide distance as a fraction of screen height
    numDelay: 0.12,
    numPop: 0.35,
    starDelay: 0.3,
    starStagger: 0.16,
    starPop: 0.32,
    lineFade: 0.2,
    buttonGap: 0.15,       // Pause after the last star before the buttons appear
    buttonPop: 0.22,
    // HUD and retry
    shotsPopFrom: 0.55,    // Strokes number scale on change, springs to 1 with outBack
    shotsPopTime: 0.3,
    retryTapVol: 0.4,
    retryFade: 0.35,
    // Resting far from the hole
    farRestShots: 3,       // More shots than this on the hole
    farRestDist: 100,      // and resting farther than this from the hole gives the pulse
    restPulseTime: 0.6,
    restPulseR: 3.2,       // In ball radii
    restPulseColor: '#94a3b8',
    // Menu
    menuPopFrom: 0.7,      // Tile scale when the menu opens after a clear
    menuPopTime: 0.45,
    menuStarDelay: 0.15,
    menuStarStagger: 0.12,
    menuStarPop: 0.3,
  },
};
const T = TUNING;
const J = T.juice;
const STEP = T.physicsStep;
const FRIC_STEP = Math.pow(T.friction, STEP);
const WELL_CORE3 = T.wellMinDist ** 3;


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
    walls: [], bumpers: [], wells: [{ x: 265, y: 360, strength: 0.45 }],
  },
  {
    // Teaches tip 2, the bank: the wall blocks the straight line, so bounce off the left edge.
    // Solution: drag (57, 94), one shot; about 14 degrees of aim sink it and no shot without a bounce does.
    name: 'Bank Shot', par: 2, boss: false,
    ball: { x: 100, y: 470 }, hole: { x: 100, y: 170 },
    walls: [{ x: 60, y: 310, w: 80, h: 22 }], bumpers: [], wells: [],
  },
  {
    // Teaches tip 3: the well sits beside the line, so aim to the far side and let it bend the path around.
    // Solution: drag (49, 87), one shot, about 100 units clear of the well; about 19 degrees of aim sink it.
    name: 'Around the Bend', par: 2, boss: false,
    ball: { x: 145, y: 480 }, hole: { x: 145, y: 170 },
    walls: [], bumpers: [], wells: [{ x: 180, y: 310, strength: 0.82 }],
  },
  {
    // Teaches precision: the ball has to run the corridor straight, and the walls punish a crooked aim.
    // Solution: drag (0, 100), straight up the corridor, one shot; about 11 degrees of aim sink it.
    name: 'Corridor', par: 2, boss: false,
    ball: { x: 180, y: 540 }, hole: { x: 180, y: 150 },
    walls: [{ x: 133, y: 290, w: 22, h: 170 }, { x: 205, y: 290, w: 22, h: 170 }], bumpers: [], wells: [],
  },
  {
    // BOSS. Introduces tip 4, the slingshot: the well dead centre eats slow shots, so pass it fast and let it whip the ball round.
    // Solution: drag (44, 133), passing about 100 units from the well, one shot; about 7 degrees of aim sink it.
    name: 'Event Horizon', par: 3, boss: true,
    ball: { x: 140, y: 560 }, hole: { x: 140, y: 90 },
    walls: [], bumpers: [], wells: [{ x: 180, y: 320, strength: 1.0 }],
  },
  {
    // Introduces tip 6: the repulsor beside the hole pushes a fast ball into it, so aim at its flank.
    // Solution: drag (-22, 148) (full power), one shot; about 8 degrees of aim sink it and nothing straight at the hole does.
    name: 'Push Back', par: 3, boss: false,
    ball: { x: 180, y: 500 }, hole: { x: 200, y: 140 },
    walls: [], bumpers: [], wells: [{ x: 285, y: 178, strength: -0.68 }],
  },
  {
    // Bumper field: tip 2 again, off a bumper. The centre bumper blocks the line.
    // Solution: drag (93, 111), one bounce off the left bumper, one shot; about 9 degrees of aim sink it.
    name: 'Pinball', par: 3, boss: false,
    ball: { x: 180, y: 540 }, hole: { x: 180, y: 140 },
    walls: [], bumpers: [{ x: 180, y: 400, r: 26 }, { x: 110, y: 310, r: 24 }, { x: 250, y: 310, r: 24 }], wells: [],
  },
  {
    // Needs tips 3 and 4: sweep past the first well close in (about 55 units), then let the second bend the path wide (about 90).
    // Solution: drag (-15, 139), one shot; about 9 degrees of aim sink it.
    name: 'Figure Eight', par: 3, boss: false,
    ball: { x: 180, y: 540 }, hole: { x: 180, y: 110 },
    walls: [], bumpers: [], wells: [{ x: 130, y: 438, strength: 0.78 }, { x: 264, y: 217, strength: 0.84 }],
  },
  {
    // Needs tip 5, the brake: the well below the gap speeds the ball past sink speed, so graze the gap's wall to bleed it.
    // Solution: drag (-2, 150) (full power), one graze, one shot; about 6 degrees of aim sink it and none without a bounce does.
    name: 'The Needle', par: 3, boss: false,
    ball: { x: 125, y: 490 }, hole: { x: 140, y: 120 },
    walls: [{ x: 0, y: 190, w: 112, h: 22 }, { x: 168, y: 190, w: 192, h: 22 }], bumpers: [],
    wells: [{ x: 165, y: 253, strength: 0.91 }],
  },
  {
    // BOSS. Timing plus everything before: the wall sweeps the gate; the well and bumper bend the rest of the way.
    // Solution: drag (20, 139), released 0.5 to 1.1 s after the ball stops (wall swinging to its right end), one shot through the left gap.
    name: 'Gatekeeper', par: 3, boss: true,
    ball: { x: 180, y: 560 }, hole: { x: 180, y: 100 },
    walls: [{ x: 0, y: 330, w: 100, h: 22 }, { x: 260, y: 330, w: 100, h: 22 }],
    bumpers: [{ x: 95, y: 200, r: 24 }],
    wells: [{ x: 280, y: 210, strength: 0.9 }],
    mover: { w: 90, h: 22, a: { x: 100, y: 286 }, b: { x: 170, y: 286 } },
  },
];

// ---------- Physics (one function drives the flight and the preview) ----------

const MOVER = { x: 0, y: 0, w: 0, h: 0 }; // reused: callers use it immediately
function moverRect(lv, clock) {
  const m = lv.mover;
  const k = 0.5 - 0.5 * Math.cos((2 * Math.PI * clock) / T.moverPeriod);
  MOVER.x = lerp(m.a.x, m.b.x, k); MOVER.y = lerp(m.a.y, m.b.y, k); MOVER.w = m.w; MOVER.h = m.h;
  return MOVER;
}

function reflect(b, nx, ny) {
  b.touch = true;
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
  b.touch = false;
  for (const w of lv.wells) {
    const dx = w.x - b.x, dy = w.y - b.y;
    const d = Math.hypot(dx, dy) || 1e-6;
    // Inside wellMinDist the pull falls off linearly to zero at the centre: no pit, no chatter, and a ball can rest there.
    const a = d >= T.wellMinDist ? (w.strength * T.wellStrength) / (d * d) : (w.strength * T.wellStrength * d) / WELL_CORE3;
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
  // at the top of its arc. In a well's core, or pressed against a wall, it rests.
  if (speed < T.stopSpeed && hd >= T.captureR && (core || b.touch || Math.hypot(wax, way) < T.holdAccel)) return 'rest';
  return null;
}

// Drag in screen px (finger minus touch start) to launch velocity. Null inside the dead zone.
function launchFromDrag(dx, dy) {
  const len = Math.hypot(dx, dy);
  if (len < T.dragDead) return null;
  const power = Math.min(1, len / T.dragMax);
  return { vx: (-dx / len) * power * T.powerMax, vy: (-dy / len) * power * T.powerMax, power };
}

// Same physics as the flight, sampled every previewDotEvery simulated seconds into PV; returns the dot count.
const PV = Array.from({ length: Math.ceil(Math.max(T.previewFullSeconds, T.previewShortSeconds) / T.previewDotEvery) + 2 }, () => ({ x: 0, y: 0 }));
const PB = { x: 0, y: 0, vx: 0, vy: 0, hits: 0 };
function previewPoints(lv, x, y, vx, vy, clock, seconds) {
  PB.x = x; PB.y = y; PB.vx = vx; PB.vy = vy; PB.hits = 0;
  const every = Math.round(T.previewDotEvery / STEP);
  const steps = Math.round(seconds / STEP);
  let n = 0;
  for (let i = 1; i <= steps && n < PV.length; i++) {
    const r = stepBall(lv, PB, clock + i * STEP);
    if (r === 'sink') { PV[n].x = PB.x; PV[n++].y = PB.y; break; }
    if (r === 'rest') break;
    if (i % every === 0) { PV[n].x = PB.x; PV[n++].y = PB.y; }
  }
  return n;
}

// ---------- Helpers ----------

const STARS = (() => {
  const r = makeRng(20260928);
  return Array.from({ length: 45 }, () => ({ x: r.range(0, T.designW), y: r.range(0, T.designH), r: r.range(0.6, 1.4), a: r.range(0.15, 0.5) }));
})();

// The design space plus its edge walls is fitted to the screen, so all four walls are always visible.
function view(E) {
  const s = Math.min(E.w / (T.designW + 2 * T.borderW), E.h / (T.designH + 2 * T.borderW));
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
  const bw = T.borderW;
  ctx.strokeStyle = T.slate; ctx.lineWidth = bw;
  ctx.strokeRect(-bw / 2, -bw / 2, T.designW + bw, T.designH + bw);
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

const WELL_GRAD = new WeakMap();

// Purple disc with rings drifting in (pull); orange with rings drifting out (repulsor). Boss holes use the boss colour.
// `phase` is the ring cycle (0 to 1), advanced by the play scene so the rings run faster when the ball is near.
function drawWell(ctx, w, phase, boss) {
  const push = w.strength < 0;
  const col = push ? T.orange : boss ? J.bossWell : T.purple;
  const r = T.wellR * Math.sqrt(Math.abs(w.strength));
  let g = WELL_GRAD.get(w);
  if (!g) {
    g = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, r);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    WELL_GRAD.set(w, g);
  }
  ctx.globalAlpha = 0.95; ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(w.x, w.y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 1.5;
  for (let i = 0; i < 2; i++) {
    const k = (phase + i * 0.5) % 1;
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

// ---------- Juice (cosmetic only: reads the physics state, never writes it) ----------

const FX = { glow: 0, power: 0, pop: 1, flash: 1, rest: 1, sink: 1, retry: 1, shots: 1, banner: 1, bannerTok: null, ring: null, trailT: 0, ghost: false, gx: 0, gy: 0 };
const TRAIL = { xy: new Float32Array(2 * T.trailLength), n: 0, col: T.purple }; // oldest point first
const NOOP = () => {};
let GLOW_G = null;   // unit-radius gradient, drawn scaled and translated so it is built once
let CHANGED = null;  // { hole, from, to }: the hole whose stars just went up, consumed by the menu

function resetFx() {
  FX.glow = 0; FX.power = 0; FX.pop = 1; FX.flash = 1; FX.rest = 1; FX.sink = 1; FX.retry = 1; FX.shots = 1;
  FX.ghost = false; FX.trailT = 0;
  FX.ring = new Float32Array(S.lv.wells.length);
  TRAIL.n = 0;
}

function later(E, sec, fn) { E.tween(sec, NOOP, ease.linear, fn); }

// Engine particles live in screen space, so a design-space point goes through the view. Capped by particleCap.
function burst(E, x, y, o) {
  const room = T.particleCap - E.particles.list.length;
  if (room <= 0) return;
  const v = view(E);
  E.particles.emit({
    x: v.ox + x * v.s, y: v.oy + y * v.s, count: Math.min(o.count, room), color: o.color,
    speed: o.speed * v.s, life: o.life, size: o.size * v.s, angle: o.angle || 0,
    spread: o.spread === undefined ? Math.PI * 2 : o.spread, drag: J.particleDrag,
  });
}

function trailPush(x, y, col) {
  if (TRAIL.n === T.trailLength) { TRAIL.xy.copyWithin(0, 2, 2 * TRAIL.n); TRAIL.n--; }
  TRAIL.xy[2 * TRAIL.n] = x; TRAIL.xy[2 * TRAIL.n + 1] = y; TRAIL.n++; TRAIL.col = col;
}
function trailDrop() {
  if (TRAIL.n > 0) { TRAIL.xy.copyWithin(0, 2, 2 * TRAIL.n); TRAIL.n--; }
}

// Nearest well within wellNearR of the ball, or null.
function wellNear(lv, b) {
  let best = null, bd = J.wellNearR;
  for (const w of lv.wells) { const d = dist(b.x, b.y, w.x, w.y); if (d < bd) { bd = d; best = w; } }
  return best;
}
function wellColor(lv, w) { return w.strength < 0 ? T.orange : lv.boss ? J.bossWell : T.purple; }

function drawTrail(ctx, bx, by) {
  const n = TRAIL.n;
  if (n < 1) return;
  ctx.strokeStyle = TRAIL.col; ctx.lineCap = 'round';
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    const x1 = i < n ? TRAIL.xy[2 * i] : bx, y1 = i < n ? TRAIL.xy[2 * i + 1] : by;
    ctx.globalAlpha = J.trailAlpha * k; ctx.lineWidth = J.trailWidth * (0.3 + 0.7 * k);
    ctx.beginPath(); ctx.moveTo(TRAIL.xy[2 * i - 2], TRAIL.xy[2 * i - 1]); ctx.lineTo(x1, y1); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawGlow(ctx, x, y, r, a) {
  if (!GLOW_G) {
    GLOW_G = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    GLOW_G.addColorStop(0, 'rgba(255,255,255,0.9)'); GLOW_G.addColorStop(0.55, 'rgba(255,255,255,0.3)'); GLOW_G.addColorStop(1, 'rgba(255,255,255,0)');
  }
  ctx.save(); ctx.translate(x, y); ctx.scale(r, r);
  ctx.globalAlpha = a; ctx.fillStyle = GLOW_G;
  ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawRing(ctx, x, y, r, w, col, a) {
  ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = w;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1;
}

// Per frame: glow follows the touch, well rings speed up near the ball, the trail drains when the ball is not flying.
function fxUpdate(dt) {
  const b = S.ball, wells = S.lv.wells;
  FX.glow = clamp(FX.glow + (S.aim || S.key.on ? dt / J.glowInTime : -dt / J.glowOutTime), 0, 1);
  for (let i = 0; i < wells.length; i++) {
    const near = clamp(1 - dist(b.x, b.y, wells[i].x, wells[i].y) / J.wellNearR, 0, 1);
    FX.ring[i] = (FX.ring[i] + dt * (J.ringRate + J.ringBoost * near)) % 1;
  }
  if (S.phase !== 'fly' && TRAIL.n > 0) {
    FX.trailT += dt;
    while (FX.trailT >= J.trailDecay && TRAIL.n > 0) { FX.trailT -= J.trailDecay; trailDrop(); }
  }
}

function dragStartFx(E) {
  FX.glow = Math.max(FX.glow, J.glowStart); FX.power = 0;
  FX.pop = J.dragPopFrom;
  E.tween(J.dragPopTime, (k) => { FX.pop = lerp(J.dragPopFrom, 1, k); }, ease.outBack);
}

function popShots(E) {
  FX.shots = J.shotsPopFrom;
  E.tween(J.shotsPopTime, (k) => { FX.shots = lerp(J.shotsPopFrom, 1, k); }, ease.outBack);
}

function releaseFx(E, l) {
  const b = S.ball, len = Math.hypot(l.vx, l.vy), ux = l.vx / len, uy = l.vy / len;
  E.audio.play('tap'); E.haptic(J.releaseHaptic);
  burst(E, b.x - ux * T.ballR, b.y - uy * T.ballR, { count: J.puffCount, color: J.puffColor, speed: J.puffSpeed, life: J.puffLife, size: J.puffSize, angle: Math.atan2(-uy, -ux), spread: J.puffSpread });
  FX.flash = 0;
  E.tween(J.flashTime, (k) => { FX.flash = k; }, ease.linear);
  popShots(E);
}

// The ball's velocity before and after the step gives the contact normal: post / wallBounce minus pre points off the surface.
function bounceFx(E, pvx, pvy) {
  const b = S.ball, speed = Math.hypot(pvx, pvy), big = speed > J.bigHitSpeed;
  let nx = b.vx / T.wallBounce - pvx, ny = b.vy / T.wallBounce - pvy, d = Math.hypot(nx, ny);
  if (d < 1e-6) { nx = -pvx; ny = -pvy; d = speed || 1; }
  nx /= d; ny /= d;
  E.audio.play('hit', big ? J.bigHitVol : J.hitVol);
  burst(E, b.x - nx * T.ballR, b.y - ny * T.ballR, {
    count: big ? J.sparkBigCount : J.sparkCount, color: big ? J.sparkBigColor : J.sparkColor,
    speed: big ? J.sparkBigSpeed : J.sparkSpeed, life: big ? J.sparkBigLife : J.sparkLife,
    size: big ? J.sparkBigSize : J.sparkSize, angle: Math.atan2(ny, nx), spread: J.sparkSpread,
  });
  if (big) E.shake(J.bigShake, J.bigShakeTime);
}

function restFx(E) {
  if (S.strokes <= J.farRestShots || dist(S.ball.x, S.ball.y, S.lv.hole.x, S.lv.hole.y) <= J.farRestDist) return;
  FX.rest = 0;
  E.tween(J.restPulseTime, (k) => { FX.rest = k; }, ease.outQuad);
}

function sinkFx(E) {
  const lv = S.lv, stars = starsFor(S.strokes, lv.par), three = stars === 3;
  const prev = E.save.get('best', {})[S.idx];
  const from = prev === undefined ? 0 : starsFor(prev, lv.par);
  CHANGED = stars > from ? { hole: S.idx, from, to: stars } : null;
  burst(E, lv.hole.x, lv.hole.y, { count: three ? J.burstBigCount : J.burstCount, color: J.burstColor, speed: J.burstSpeed * (three ? 1.3 : 1), life: J.burstLife, size: J.burstSize });
  burst(E, lv.hole.x, lv.hole.y, { count: three ? J.burstBigCount / 2 : J.burstCount / 2, color: J.burstLight, speed: J.burstSpeed * 0.6, life: J.burstLife, size: J.burstSize * 0.7 });
  E.haptic(J.sinkHaptic);
  if (three) {
    E.audio.play('coin'); later(E, J.coinLead, () => E.audio.play('win'));
    E.flash(T.green, J.threeStarFlash);
  } else E.audio.play('win');
  FX.sink = 0;
  E.tween(J.sinkRingTime, (k) => { FX.sink = k; }, ease.outCubic);
}

// Retry is instant for the game; only the picture fades: the old ball dissolves where it lay, the ball at the tee fades in.
function retry(E) {
  const gx = S.ball.x, gy = S.ball.y, had = S.strokes > 0;
  const moved = dist(gx, gy, S.lv.ball.x, S.lv.ball.y) > T.ballR;
  loadHole(S.idx); resetFx();
  E.audio.play('tap', J.retryTapVol);
  if (moved) {
    FX.ghost = true; FX.gx = gx; FX.gy = gy; FX.retry = 0;
    E.tween(J.retryFade, (k) => { FX.retry = k; }, ease.outQuad, () => { FX.ghost = false; });
  }
  if (had) popShots(E);
}

// Banner for boss holes: slides in, holds, slides out. Position from the tween's linear 0..1.
function drawBanner(ctx, E) {
  const tt = FX.banner * J.bannerTime, outAt = J.bannerTime - J.bannerOut;
  const off = tt < J.bannerIn ? -(1 - ease.outCubic(tt / J.bannerIn)) : tt > outAt ? ease.inQuad((tt - outAt) / J.bannerOut) : 0;
  const y = E.h * J.bannerY, h = J.bannerH, x = off * E.w;
  ctx.globalAlpha = 0.92; ctx.fillStyle = '#1a0d2e'; ctx.fillRect(x, y - h / 2, E.w, h);
  ctx.globalAlpha = 1; ctx.fillStyle = J.bossWell;
  ctx.fillRect(x, y - h / 2, E.w, 3); ctx.fillRect(x, y + h / 2 - 3, E.w, 3);
  E.text('BOSS', x + E.w / 2, y - 8, { size: 32, weight: '800', color: J.bossWell });
  E.text(S.lv.name, x + E.w / 2, y + 20, { size: 14, color: '#cbd5e1' });
}

// ---------- Scenes ----------

const menu = {
  enter() { this.btnPlay = null; this.btnMute = null; this.tiles = []; this.pop = CHANGED; CHANGED = null; this.t = 0; },
  update(dt) { if (this.pop) this.t += dt; },
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
      // Only the tile whose stars just went up pops.
      const pop = this.pop && this.pop.hole === i ? this.pop : null;
      const ts = pop ? lerp(J.menuPopFrom, 1, ease.outBack(clamp(this.t / J.menuPopTime, 0, 1))) : 1;
      if (ts !== 1) { ctx.save(); ctx.translate(x + tw / 2, y + th / 2); ctx.scale(ts, ts); ctx.translate(-(x + tw / 2), -(y + th / 2)); }
      E.roundRect(x, y, tw, th, 10, locked ? '#0a1024' : '#16203d', cleared ? T.green : locked ? '#1b2440' : T.slate);
      E.text(`${i + 1}`, x + tw / 2, y + 19, { size: 20, weight: '800', color: locked ? '#475569' : '#e6e6e6' });
      if (locked) drawLock(ctx, x + tw / 2, y + th - 24);
      else {
        if (lv.boss) E.text('Boss', x + tw / 2, y + 40, { size: 14, color: '#cbd5e1' });
        for (let s = 0; s < 3; s++) {
          const sx = x + tw / 2 + (s - 1) * 15, sy = y + th - 13, earned = s < p.stars[i];
          const k = pop && earned && s >= pop.from ? ease.outBack(clamp((this.t - J.menuStarDelay - (s - pop.from) * J.menuStarStagger) / J.menuStarPop, 0, 1)) : 1;
          if (!earned || k < 1) drawStar(ctx, sx, sy, 6.5, null, '#334155');
          if (earned && k > 0) drawStar(ctx, sx, sy, 6.5 * k, T.green);
        }
      }
      if (ts !== 1) ctx.restore();
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

// Launch, with the release juice. Both the touch and the keyboard fallback go through here.
function shoot(E, l) { launch(l); releaseFx(E, l); }

const play = {
  enter(E, params) {
    loadHole(clamp((params && params.hole) || 0, 0, LEVELS.length - 1));
    resetFx();
    FX.banner = 1; FX.bannerTok = null;
    if (S.lv.boss) {
      const tok = FX.bannerTok = {};
      FX.banner = 0;
      E.tween(J.bannerTime, (k) => { if (FX.bannerTok === tok) FX.banner = k; }, ease.linear);
    }
  },

  update(dt, E) {
    fxUpdate(dt);
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
      const hitsBefore = S.ball.hits, pvx = S.ball.vx, pvy = S.ball.vy;
      let r = stepBall(S.lv, S.ball, S.clock0 + S.steps * STEP);
      if (S.ball.hits !== hitsBefore) bounceFx(E, pvx, pvy);
      if (S.steps % J.trailEvery === 0) {
        const w = wellNear(S.lv, S.ball);
        if (w) trailPush(S.ball.x, S.ball.y, wellColor(S.lv, w)); else trailDrop();
      }
      if (!r && S.steps * STEP >= T.maxFlightSeconds) r = 'rest';
      if (r === 'sink') { S.phase = 'sink'; S.sinkT = 0; S.sinkFrom = { x: S.ball.x, y: S.ball.y }; sinkFx(E); }
      else if (r === 'rest') { comeToRest(); restFx(E); }
    }
  },

  render(ctx, E) {
    const v = view(E), lv = S.lv, b = S.ball;
    ctx.save();
    ctx.translate(v.ox, v.oy); ctx.scale(v.s, v.s);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, T.designW, T.designH); ctx.clip();
    drawField(ctx);
    for (let i = 0; i < lv.wells.length; i++) drawWell(ctx, lv.wells[i], FX.ring[i], lv.boss);
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
    if (FX.sink < 1) drawRing(ctx, lv.hole.x, lv.hole.y, T.holeR + J.sinkRingR * FX.sink, 4, T.green, 1 - FX.sink);

    drawTrail(ctx, b.x, b.y);

    const aiming = S.phase === 'aim' ? currentLaunch() : null;
    if (aiming) {
      FX.power = aiming.power;
      const seconds = S.idx < T.previewFullHoles ? T.previewFullSeconds : T.previewShortSeconds;
      const n = previewPoints(lv, b.x, b.y, aiming.vx, aiming.vy, S.clock, seconds);
      const col = mixToOrange(aiming.power);
      const ux = aiming.vx / (aiming.power * T.powerMax), uy = aiming.vy / (aiming.power * T.powerMax);
      const len = 20 + 60 * aiming.power; // line length shows power
      ctx.strokeStyle = col; ctx.lineWidth = J.aimWidth + J.aimWidthPower * aiming.power; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(b.x + ux * (T.ballR + 3), b.y + uy * (T.ballR + 3)); ctx.lineTo(b.x + ux * (T.ballR + 3 + len), b.y + uy * (T.ballR + 3 + len)); ctx.stroke();
      ctx.fillStyle = col;
      for (let i = 0; i < n; i++) { ctx.globalAlpha = 1 - 0.6 * (i / n); ctx.beginPath(); ctx.arc(PV[i].x, PV[i].y, 2.2, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
    }

    let bx = b.x, by = b.y, br = T.ballR, ba = 1;
    if (S.phase === 'sink') {
      const k = clamp(S.sinkT / T.sinkTime, 0, 1);
      bx = lerp(S.sinkFrom.x, lv.hole.x, k); by = lerp(S.sinkFrom.y, lv.hole.y, k); br = T.ballR * (1 - k);
    } else {
      br = T.ballR * FX.pop; ba = FX.retry;
      if (FX.glow > 0.01) drawGlow(ctx, bx, by, T.ballR + J.glowR + J.glowRPower * FX.power, FX.glow * J.glowAlpha);
    }
    if (FX.ghost && FX.retry < 1) {
      ctx.globalAlpha = 1 - FX.retry; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(FX.gx, FX.gy, T.ballR, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    }
    if (br > 0.1) {
      ctx.globalAlpha = ba;
      ctx.fillStyle = 'rgba(2,4,12,0.55)'; ctx.beginPath(); ctx.arc(bx + 2, by + 3, br, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (FX.flash < 1) {
      drawGlow(ctx, bx, by, T.ballR * (1.8 + FX.flash), 1 - FX.flash);
      drawRing(ctx, bx, by, T.ballR * (1 + (J.flashRing - 1) * FX.flash), 3 * (1 - FX.flash) + 0.5, '#fff', 1 - FX.flash);
    }
    if (FX.rest < 1) drawRing(ctx, bx, by, T.ballR * (1 + (J.restPulseR - 1) * FX.rest), 3, J.restPulseColor, 0.8 * (1 - FX.rest));
    ctx.restore();
    drawBorder(ctx);
    ctx.restore();

    const top = E.safe.top + 26;
    ctx.save(); ctx.translate(16, top); ctx.scale(FX.shots, FX.shots);
    E.text(`Shots ${S.strokes}`, 0, 0, { size: 18, align: 'left' });
    ctx.restore();
    E.text(lv.boss ? `Hole ${S.idx + 1} Boss` : `Hole ${S.idx + 1}`, E.w / 2, top, { size: 16, color: '#9aa4b2' });
    E.text(`Par ${lv.par}`, E.w - 16, top, { size: 18, align: 'right', color: T.green });
    const live = S.phase === 'aim';
    S.retryRect = E.button('Retry', E.w - 16 - T.retryW / 2, top + 20 + T.retryH / 2, { w: T.retryW, h: T.retryH, size: 16, fill: live ? T.slate : '#141c33', color: live ? '#e6e6e6' : '#475569' });
    if (FX.banner < 1) drawBanner(ctx, E);
  },

  onPointerDown(p, E) {
    if (S.phase !== 'aim' || S.aim) return;
    if (S.retryRect && E.hit(S.retryRect, p)) return; // a touch on Retry never starts an aim
    const v = view(E);
    const gx = (p.x - v.ox) / v.s, gy = (p.y - v.oy) / v.s;
    if (dist(gx, gy, S.ball.x, S.ball.y) <= T.ballGrabR) return;
    S.aim = { id: p.id, sx: p.x, sy: p.y, x: p.x, y: p.y };
    dragStartFx(E);
  },
  onTap(p, E) {
    if (S.phase === 'aim' && S.retryRect && E.hit(S.retryRect, p)) retry(E);
  },
  onPointerMove(p) {
    if (S.aim && S.aim.id === p.id) { S.aim.x = p.x; S.aim.y = p.y; }
  },
  onPointerUp(p, E) {
    if (!S.aim || S.aim.id !== p.id) return;
    if (p.cancelled) { S.aim = null; return; }
    S.aim.x = p.x; S.aim.y = p.y;
    const l = currentLaunch();
    if (l) shoot(E, l); else S.aim = null; // inside the dead zone: cancel, no stroke
  },
  onKey(key, E) {
    if (S.phase !== 'aim') return;
    if (key === 'ArrowLeft') { S.key.on = true; S.key.angle -= T.keyAngleStep; }
    else if (key === 'ArrowRight') { S.key.on = true; S.key.angle += T.keyAngleStep; }
    else if (key === 'ArrowUp') { S.key.on = true; S.key.power = Math.min(1, S.key.power + T.keyPowerStep); }
    else if (key === 'ArrowDown') { S.key.on = true; S.key.power = Math.max(T.dragDead / T.dragMax, S.key.power - T.keyPowerStep); }
    else if (key === ' ') { S.key.on = true; const l = currentLaunch(); if (l) shoot(E, l); }
  },
};

// The card slides up, the shot count pops, each star pops in turn with a coin, and only after that beat do the
// buttons appear. Until then a tap does nothing, and neither does a press that started before the buttons existed.
const over = {
  enter(E, params) {
    const p = this.p = params;
    this.t = 0; this.t0 = E.time; this.slide = 0; this.ready = false;
    this.starK = [0, 0, 0]; this.starDone = [false, false, false];
    this.beat = J.starDelay + Math.max(0, p.stars - 1) * J.starStagger + J.starPop * 0.6 + J.buttonGap;
    this.btnNext = null; this.btnMenu = null;
    E.tween(J.cardSlide, (k) => { this.slide = k; }, ease.outBack);
  },
  update(dt, E) {
    this.t += dt;
    for (let i = 0; i < this.p.stars; i++) {
      if (!this.starDone[i] && this.t >= J.starDelay + i * J.starStagger) {
        this.starDone[i] = true; E.audio.play('coin');
        E.tween(J.starPop, (k) => { this.starK[i] = k; }, ease.outBack);
      }
    }
    this.ready = this.t >= this.beat;
  },
  render(ctx, E) {
    const p = this.p, cx = E.w / 2, t = this.t, v = view(E);
    ctx.save(); ctx.translate(v.ox, v.oy); ctx.scale(v.s, v.s); drawField(ctx); ctx.restore();
    ctx.save(); ctx.translate(0, (1 - this.slide) * E.h * J.cardSlideFrac);
    const pw = Math.min(E.w - 32, 340), py = E.h * 0.085;
    E.roundRect(cx - pw / 2, py, pw, E.h * 0.68 + (p.hasNext ? 80 : 0) + 44 - py, 18, '#0c1330', p.boss ? J.bossWell : T.slateEdge);
    if (p.boss) E.text('Boss', cx, E.h * 0.12, { size: 18, color: '#cbd5e1' });
    E.text(p.name, cx, E.h * 0.16, { size: 18, color: '#9aa4b2' });
    const nk = ease.outBack(clamp((t - J.numDelay) / J.numPop, 0, 1));
    ctx.save(); ctx.translate(cx, E.h * 0.24); ctx.scale(nk, nk);
    E.text(`${p.strokes} ${p.strokes === 1 ? 'shot' : 'shots'}`, 0, 0, { size: 44, weight: '800' });
    ctx.restore();
    E.text(`Par ${p.par}`, cx, E.h * 0.24 + 44, { size: 20, color: '#9aa4b2' });
    for (let i = 0; i < 3; i++) {
      const sx = cx + (i - 1) * 64, sy = E.h * 0.24 + 120;
      drawStar(ctx, sx, sy, 26, null, '#334155');
      if (i < p.stars && this.starDone[i]) drawStar(ctx, sx, sy, 26 * this.starK[i], T.green);
    }
    const line = p.stars === 3 ? (p.strokes === 1 ? 'Hole in one' : 'Under par') : '';
    if (line) E.text(line, cx, E.h * 0.24 + 178, { size: 20, color: T.green, alpha: clamp((t - J.starDelay - (p.stars - 1) * J.starStagger) / J.lineFade, 0, 1) });
    E.text(`Best ${p.best}`, cx, E.h * 0.24 + 214, { size: 18, color: '#9aa4b2' });
    if (this.ready) {
      const bk = ease.outBack(clamp((t - this.beat) / J.buttonPop, 0, 1)), by = E.h * 0.68;
      ctx.save(); ctx.translate(cx, by); ctx.scale(bk, bk); ctx.translate(-cx, -by);
      this.btnNext = E.button(p.hasNext ? 'Next' : 'Menu', cx, by, { fill: T.green, color: '#04110a', h: 64, size: 24 });
      ctx.restore();
      if (p.hasNext) {
        ctx.save(); ctx.translate(cx, by + 80); ctx.scale(bk, bk); ctx.translate(-cx, -(by + 80));
        this.btnMenu = E.button('Menu', cx, by + 80, { fill: T.slate, w: 150, h: 48, size: 16 });
        ctx.restore();
      }
    }
    ctx.restore();
  },
  onTap(p, E) {
    if (!this.ready || !this.btnNext || p.startT < this.t0 + this.beat) return;
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
