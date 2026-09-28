// Gravity Golf v0.2: planets, suns, rotating bars and orbiting moons on the v0.1 mechanic, juice and scenes.
// Slingshot aim, fixed-step ball physics, strokes against per-hole star thresholds, the hole card, hole select.

import { makeRng, ease, clamp, lerp, dist } from './engine.js';

// Design-space units unless stated. Names match PRD v0.1 section 16 and v0.2 section E; the rest are marked.
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
  wallBounce: 0.85,      // Fraction of speed kept on a wall, planet or sun bounce
  planetGravity: 4500000, // Acceleration toward a planet is this times mass over distance squared (never under the radius)
  planetMinR: 24,        // Smallest planet radius (bumper-planets)
  sunPenalty: 1,         // Strokes added per sun touch
  landSpeed: 60,         // Below this speed, a ball touching a planet comes to rest on it
  moonMassMax: 0.5,      // Cap on moon mass
  barAngularSpeed: 1.2,  // Radians per second for a rotating bar (clockwise on screen)
  previewFullHoles: 3,   // Holes 1 to this show the full preview
  previewFullSeconds: 2.0,   // Length of the full preview in simulated seconds
  previewShortSeconds: 0.4,  // Length of the preview after the full-preview holes
  previewDotEvery: 0.05, // Simulated seconds between preview dots
  physicsStep: 1 / 120,  // Fixed physics timestep in seconds
  maxFlightSeconds: 12,  // Safety: a ball still moving after this is stopped where it is
  moverPeriod: 2.4,      // Seconds for a sliding wall to complete one sweep and return (unless the mover sets `period`)
  trailLength: 18,       // Points kept in the ball's trail
  particleCap: 200,      // Max live particles
  speedMax: 1400,        // Ball speed is clamped here so a slingshot cannot cause tunnelling
  keyPowerStart: 0.5,    // Starting power fraction for the keyboard fallback

  // Builder additions, not in the PRD tables.
  barW: 8,               // Rotating bar thickness
  sunRearm: 9,           // A sun touch counts again only once the ball has left its surface by this much
  bg: '#070b19',         // Letterbox colour (the engine reads this name)
  fieldColor: '#0e1631',
  green: '#22c55e',      // Goal
  purple: '#a855f7',     // Gravity: planets and moons
  orange: '#f97316',     // Hazard: suns, and full power
  slate: '#475569',      // Walls, bars and bumpers
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

  // Juice. Cosmetic only; nothing here is read by the physics. Durations in seconds, sizes in design units,
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
    // Wall, bar and planet bounce
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
    // Planets
    planetNearR: 80,       // Within this distance of a planet's surface the ball trails and the planet's pull ring speeds up
    ringRate: 0.5,         // Pull ring cycles per second when the ball is far
    ringBoost: 2.4,        // Extra cycles per second when the ball is on the surface
    pullRing: 22,          // The pull ring drifts in from this far outside the surface, times the planet's mass
    atmosphere: 9,         // Width of the soft atmosphere ring
    planetLight: '#e9d5ff',
    planetDark: '#3b0764',
    bossPlanet: '#e879f9', // Boss holes: planet colour
    bossLight: '#fae8ff',
    bossDark: '#581c87',
    orbitAlpha: 0.22,      // Moon orbit path
    trailEvery: 2,         // Physics steps between trail samples
    trailDecay: 0.03,      // Seconds per trail point when the trail drains at rest
    trailWidth: 4,
    trailAlpha: 0.5,
    // Suns
    sunCore: '#fffbeb',
    sunMid: '#fde047',
    corona: 1.7,           // Corona radius in sun radii
    coronaAlpha: 0.45,
    flareTime: 0.55,
    flareGrow: 0.8,        // Extra corona radius at the start of a flare, in sun radii
    flareCount: 12,
    flareSpeed: 170,
    flareLife: 0.4,
    flareSize: 3,
    sunHaptic: 30,
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

// Hole data. Coordinates are design space; the four field edges are walls added by the physics.
//   stars: { three, two }: three is the fewest strokes proved in the harness; two is par, shown on the card.
//   walls: axis-aligned rectangles { x, y, w, h }.
//   planets: { x, y, r, mass }; mass 1.0 is standard, up to 1.5 on bosses if the escape rule holds; mass 0 is a bumper.
//   suns: { x, y, r }: a touch costs sunPenalty strokes and the ball bounces on.
//   movers, all on the hole clock (restarts at 0 whenever the ball comes to rest):
//     { type: 'slide', w, h, a: { x, y }, b: { x, y }, period? }: a wall easing from a to b and back (period defaults to moverPeriod).
//     { type: 'bar', x, y, len, phase }: a bar of length len spinning about its centre at barAngularSpeed; phase is its angle (radians) at clock 0.
//     { type: 'moon', parent, orbitR, period, r, mass, phase }: a small planet circling planets[parent] clockwise; phase is its angle at clock 0.
//   A ball never comes to rest where a mover would sweep it (a bar's disc, a moon's orbit band, a slide's path); it waits
//   there until the part knocks it on. A ball that lands on a moon rides it. So keep tees, cups and other objects clear of
//   those zones, keep orbitR at least parent r + moon r + 2 ball radii, and keep moon orbits clear of walls and suns.
// Drag vectors in the comments are screen px (finger moves dx right, dy down); the ball flies the opposite way.
// Entries are pasted from the content shards' JSON (docs/games/gravity-golf/README.md); tools/sim-golf.mjs verifies each one.
const LEVELS = [
  {
    // Teaches drag, power and release, and that a planet bends the flight: a straight shot curves into it, so aim off the line.
    // three: drag (14, 119), one shot, passing 38 units from the surface; sinks over 11 degrees of aim and 113 to 142 px of drag.
    name: 'First Light', boss: false, stars: { three: 1, two: 2 },
    ball: { x: 180, y: 530 }, hole: { x: 180, y: 200 },
    walls: [], planets: [{ x: 240, y: 360, r: 34, mass: 0.8 }], suns: [], movers: [],
  },
  {
    // Teaches the bank: the wall blocks every straight line, so bounce off the left edge through the gap.
    // three: drag (79, 120), one bank, one shot; sinks over 9 degrees of aim and 101 px of drag up to full power.
    name: 'Bank Shot', boss: false, stars: { three: 1, two: 2 },
    ball: { x: 120, y: 500 }, hole: { x: 110, y: 160 },
    walls: [{ x: 35, y: 320, w: 165, h: 22 }], planets: [], suns: [], movers: [],
  },
  {
    // Teaches the slingshot: the wall blocks the straight line, so pass close up the planet's right side and let it
    // whip the ball over its top and across to the cup on the left.
    // three: drag (-2, 124), one shot, passing 21 units from the surface and turning 144 degrees; sinks over 4 degrees of aim
    // and 115 to 134 px of drag. No-straight sweep (0.5 degrees, 5 px, zero bounces, no pass within 80 of the centre): 0 sink.
    name: 'Slingshot', boss: false, stars: { three: 1, two: 3 },
    ball: { x: 300, y: 560 }, hole: { x: 125, y: 225 },
    walls: [{ x: 0, y: 330, w: 200, h: 22 }], planets: [{ x: 220, y: 300, r: 48, mass: 1 }], suns: [], movers: [],
  },
  // PLACEHOLDERS, holes 4 to 10: walls and a cup only, so the game stays playable until the content shards replace them.
  {
    // PLACEHOLDER for hole 4, Landing.
    name: 'Landing', boss: false, stars: { three: 1, two: 2 },
    ball: { x: 180, y: 540 }, hole: { x: 180, y: 150 },
    walls: [{ x: 60, y: 330, w: 90, h: 22 }], planets: [], suns: [], movers: [],
  },
  {
    // PLACEHOLDER for hole 5, Binary (boss).
    name: 'Binary', boss: true, stars: { three: 1, two: 2 },
    ball: { x: 180, y: 540 }, hole: { x: 180, y: 120 },
    walls: [{ x: 0, y: 300, w: 110, h: 22 }, { x: 250, y: 300, w: 110, h: 22 }], planets: [], suns: [], movers: [],
  },
  {
    // PLACEHOLDER for hole 6, Solar Flare.
    name: 'Solar Flare', boss: false, stars: { three: 1, two: 2 },
    ball: { x: 120, y: 540 }, hole: { x: 240, y: 150 },
    walls: [{ x: 200, y: 360, w: 160, h: 22 }], planets: [], suns: [], movers: [],
  },
  {
    // PLACEHOLDER for hole 7, Pinball.
    name: 'Pinball', boss: false, stars: { three: 1, two: 2 },
    ball: { x: 240, y: 540 }, hole: { x: 120, y: 150 },
    walls: [{ x: 0, y: 360, w: 160, h: 22 }], planets: [], suns: [], movers: [],
  },
  {
    // PLACEHOLDER for hole 8, Tide.
    name: 'Tide', boss: false, stars: { three: 1, two: 2 },
    ball: { x: 180, y: 540 }, hole: { x: 180, y: 150 },
    walls: [{ x: 0, y: 330, w: 130, h: 22 }, { x: 230, y: 330, w: 130, h: 22 }], planets: [], suns: [], movers: [],
  },
  {
    // PLACEHOLDER for hole 9, Windmill.
    name: 'Windmill', boss: false, stars: { three: 1, two: 2 },
    ball: { x: 100, y: 540 }, hole: { x: 260, y: 150 },
    walls: [{ x: 150, y: 250, w: 22, h: 200 }], planets: [], suns: [], movers: [],
  },
  {
    // PLACEHOLDER for hole 10, Eclipse (boss).
    name: 'Eclipse', boss: true, stars: { three: 1, two: 2 },
    ball: { x: 180, y: 560 }, hole: { x: 180, y: 100 },
    walls: [{ x: 0, y: 330, w: 140, h: 22 }, { x: 220, y: 330, w: 140, h: 22 }], planets: [], suns: [], movers: [],
  },
];
// Clamps a hole to the size and mass limits; also applied by tools/sim-golf.mjs to a shard's JSON.
function prepareLevel(lv) {
  for (const p of lv.planets) p.r = Math.max(p.r, T.planetMinR);
  for (const m of lv.movers) if (m.type === 'moon') m.mass = Math.min(m.mass, T.moonMassMax);
  return lv;
}
LEVELS.forEach(prepareLevel);

// ---------- Physics (one function drives the flight and the preview) ----------

// Reused scratch objects: callers read them immediately.
const PART = { x: 0, y: 0, w: 0, h: 0, vx: 0, vy: 0 };
const N = { x: 0, y: 0 };
const ACC = { x: 0, y: 0 };

function slideAt(m, clock) {
  const w = (2 * Math.PI) / (m.period || T.moverPeriod), k = 0.5 - 0.5 * Math.cos(w * clock), dk = 0.5 * w * Math.sin(w * clock);
  PART.x = lerp(m.a.x, m.b.x, k); PART.y = lerp(m.a.y, m.b.y, k); PART.w = m.w; PART.h = m.h;
  PART.vx = (m.b.x - m.a.x) * dk; PART.vy = (m.b.y - m.a.y) * dk;
  return PART;
}

// A moon's centre and velocity; its orbit is clockwise on screen.
function moonAt(lv, m, clock) {
  const p = lv.planets[m.parent], w = (2 * Math.PI) / m.period, a = m.phase + w * clock;
  const c = Math.cos(a), s = Math.sin(a);
  PART.x = p.x + c * m.orbitR; PART.y = p.y + s * m.orbitR;
  PART.vx = -s * m.orbitR * w; PART.vy = c * m.orbitR * w;
  return PART;
}

// Half of the bar as a vector from its pivot.
function barAt(m, clock) {
  const a = m.phase + T.barAngularSpeed * clock;
  PART.x = Math.cos(a) * m.len / 2; PART.y = Math.sin(a) * m.len / 2;
  return PART;
}

// Reflects the ball off a surface with outward normal n moving at (sx, sy). Returns the impact speed along n.
function reflect(b, nx, ny, sx, sy) {
  b.touch = true;
  const rx = b.vx - sx, ry = b.vy - sy, vn = rx * nx + ry * ny;
  if (vn >= 0) return 0;
  b.vx = sx + (rx - 2 * vn * nx) * T.wallBounce;
  b.vy = sy + (ry - 2 * vn * ny) * T.wallBounce;
  b.nx = nx; b.ny = ny;
  return -vn;
}

function hit(b, nx, ny, sx, sy) {
  if (reflect(b, nx, ny, sx, sy) >= T.bounceEventSpeed) b.hits++;
}

// Pushes the ball out of a circle of radius cr; the contact normal goes to N. False when not touching.
function circleOut(b, cx, cy, cr) {
  const dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy), min = T.ballR + cr;
  if (d >= min) return false;
  if (d > 0) { N.x = dx / d; N.y = dy / d; } else { N.x = 0; N.y = -1; }
  b.x = cx + N.x * min; b.y = cy + N.y * min;
  return true;
}

function bounceRect(b, r, sx, sy) {
  const cx = clamp(b.x, r.x, r.x + r.w), cy = clamp(b.y, r.y, r.y + r.h);
  let nx = b.x - cx, ny = b.y - cy;
  const d = Math.hypot(nx, ny);
  if (d >= T.ballR) return;
  if (d > 0) {
    nx /= d; ny /= d;
    b.x = cx + nx * T.ballR; b.y = cy + ny * T.ballR;
  } else {
    // Centre is inside the rectangle: leave by the nearest face.
    const g0 = b.x - r.x, g1 = r.x + r.w - b.x, g2 = b.y - r.y, g3 = r.y + r.h - b.y, g = Math.min(g0, g1, g2, g3);
    nx = g === g0 ? -1 : g === g1 ? 1 : 0;
    ny = nx !== 0 ? 0 : g === g2 ? -1 : 1;
    if (nx < 0) b.x = r.x - T.ballR; else if (nx > 0) b.x = r.x + r.w + T.ballR;
    else if (ny < 0) b.y = r.y - T.ballR; else b.y = r.y + r.h + T.ballR;
  }
  hit(b, nx, ny, sx, sy);
}

// The bar is a capsule: the ball bounces off the nearest point of the segment, which moves with the spin.
function bounceBar(b, m, clock) {
  const u = barAt(m, clock), ux = u.x, uy = u.y;
  const t = clamp(((b.x - m.x) * ux + (b.y - m.y) * uy) / (ux * ux + uy * uy), -1, 1);
  const cx = m.x + ux * t, cy = m.y + uy * t;
  if (!circleOut(b, cx, cy, T.barW / 2)) return;
  hit(b, N.x, N.y, -T.barAngularSpeed * (cy - m.y), T.barAngularSpeed * (cx - m.x));
}

function pull(b, x, y, r, mass) {
  const dx = x - b.x, dy = y - b.y, d = Math.hypot(dx, dy) || 1e-6, dd = Math.max(d, r);
  const a = (T.planetGravity * mass) / (dd * dd);
  ACC.x += (dx / d) * a; ACC.y += (dy / d) * a;
}

// True where a moving part will sweep the ball: it must not come to rest there.
function inSweep(lv, b) {
  for (const m of lv.movers) {
    if (m.type === 'bar') {
      if (dist(b.x, b.y, m.x, m.y) < m.len / 2 + T.barW / 2 + T.ballR) return true;
    } else if (m.type === 'moon') {
      const p = lv.planets[m.parent];
      if (Math.abs(dist(b.x, b.y, p.x, p.y) - m.orbitR) < m.r + T.ballR) return true;
    } else if (b.x > Math.min(m.a.x, m.b.x) - T.ballR && b.x < Math.max(m.a.x, m.b.x) + m.w + T.ballR &&
               b.y > Math.min(m.a.y, m.b.y) - T.ballR && b.y < Math.max(m.a.y, m.b.y) + m.h + T.ballR) return true;
  }
  return false;
}

// A ball resting on a moon rides it: it sits on the surface at a fixed angle from the moon's centre.
function carry(lv, b, clock) {
  if (b.on < 0) return;
  const m = lv.movers[b.on], c = moonAt(lv, m, clock), R = m.r + T.ballR;
  b.x = c.x + Math.cos(b.onA) * R; b.y = c.y + Math.sin(b.onA) * R;
}

function newBall(x, y) {
  return { x, y, vx: 0, vy: 0, hits: 0, sunHits: 0, sunLast: -1, sunIn: 0, on: -1, onA: 0, nx: 0, ny: -1, touch: false, land: false, moon: -1 };
}

function restPull() { return T.stopSpeed * -Math.log(T.friction); }

// Advances the ball one fixed step. Returns null while it is still rolling, otherwise 'sink' | 'rest'.
// `clock` is the hole clock in seconds at the end of the step.
function stepBall(lv, b, clock) {
  b.touch = false; b.land = false; b.moon = -1;
  ACC.x = 0; ACC.y = 0;
  for (const p of lv.planets) if (p.mass > 0) pull(b, p.x, p.y, p.r, p.mass);
  for (const m of lv.movers) if (m.type === 'moon') { const c = moonAt(lv, m, clock); pull(b, c.x, c.y, m.r, m.mass); }
  const gx = ACC.x, gy = ACC.y;
  b.vx += gx * STEP; b.vy += gy * STEP;
  const hx = lv.hole.x - b.x, hy = lv.hole.y - b.y, hd = Math.hypot(hx, hy);
  if (hd < T.captureR && hd > 0) { // the cup pulls a slow ball in like a real cup
    b.vx += (hx / hd) * T.captureStrength * STEP;
    b.vy += (hy / hd) * T.captureStrength * STEP;
  }
  // Friction is read from TUNING every step so the tune panel applies on the next shot.
  const fric = Math.pow(T.friction, STEP);
  b.vx *= fric; b.vy *= fric;
  const sp = Math.hypot(b.vx, b.vy);
  if (sp > T.speedMax) { b.vx *= T.speedMax / sp; b.vy *= T.speedMax / sp; }
  b.x += b.vx * STEP; b.y += b.vy * STEP;

  // At speedMax the ball moves under 12 units a step, less than any surface is deep, so it cannot skip one.
  for (const r of lv.walls) bounceRect(b, r, 0, 0);
  for (let i = 0; i < lv.movers.length; i++) {
    const m = lv.movers[i];
    if (m.type === 'slide') { const r = slideAt(m, clock); bounceRect(b, r, r.vx, r.vy); }
    else if (m.type === 'bar') bounceBar(b, m, clock);
    else {
      const c = moonAt(lv, m, clock);
      if (circleOut(b, c.x, c.y, m.r)) { hit(b, N.x, N.y, c.vx, c.vy); b.moon = i; b.mvx = c.vx; b.mvy = c.vy; }
    }
  }
  for (const p of lv.planets) if (circleOut(b, p.x, p.y, p.r)) { hit(b, N.x, N.y, 0, 0); b.land = true; }
  for (let i = 0; i < lv.suns.length; i++) {
    const s = lv.suns[i], bit = 1 << i;
    if (circleOut(b, s.x, s.y, s.r)) {
      reflect(b, N.x, N.y, 0, 0);
      if (!(b.sunIn & bit)) { b.sunIn |= bit; b.sunHits++; b.sunLast = i; }
    } else if (b.sunIn & bit && dist(b.x, b.y, s.x, s.y) > s.r + T.ballR + T.sunRearm) b.sunIn &= ~bit;
  }

  // Every hole is walled on all four edges of the design space.
  if (b.x < T.ballR) { b.x = T.ballR; hit(b, 1, 0, 0, 0); }
  else if (b.x > T.designW - T.ballR) { b.x = T.designW - T.ballR; hit(b, -1, 0, 0, 0); }
  if (b.y < T.ballR) { b.y = T.ballR; hit(b, 0, 1, 0, 0); }
  else if (b.y > T.designH - T.ballR) { b.y = T.designH - T.ballR; hit(b, 0, -1, 0, 0); }

  const speed = Math.hypot(b.vx, b.vy);
  if (speed < T.sinkSpeed && dist(b.x, b.y, lv.hole.x, lv.hole.y) < T.holeR) return 'sink';
  if (hd < T.captureR) return null; // inside the cup's pull the ball always runs on and drops
  if (b.moon >= 0 && Math.hypot(b.vx - b.mvx, b.vy - b.mvy) < T.landSpeed) {
    const c = moonAt(lv, lv.movers[b.moon], clock);
    b.on = b.moon; b.onA = Math.atan2(b.y - c.y, b.x - c.x);
    return 'rest';
  }
  if (inSweep(lv, b)) return null;
  if (b.land && speed < T.landSpeed) return 'rest';
  // Pressed against a wall, or where the pull could not roll it faster than stopSpeed against friction, a slow ball
  // rests; so it never freezes at the top of an arc near a planet.
  if (speed < T.stopSpeed && (b.touch || Math.hypot(gx, gy) < restPull())) return 'rest';
  return null;
}

// Drag in screen px (finger minus touch start) to launch velocity. Null inside the dead zone.
function launchFromDrag(dx, dy) {
  const len = Math.hypot(dx, dy);
  if (len < T.dragDead) return null;
  const power = Math.min(1, len / T.dragMax);
  return { vx: (-dx / len) * power * T.powerMax, vy: (-dy / len) * power * T.powerMax, power };
}

// The velocity the ball actually leaves with: the shot plus the moon it rides, if any.
const LV = { vx: 0, vy: 0 };
function launchVel(lv, b, l, clock) {
  LV.vx = l.vx; LV.vy = l.vy;
  if (b.on >= 0) { const c = moonAt(lv, lv.movers[b.on], clock); LV.vx += c.vx; LV.vy += c.vy; }
  return LV;
}

// Same physics as the flight, sampled every previewDotEvery simulated seconds into PV; returns the dot count.
const PV = Array.from({ length: Math.ceil(Math.max(T.previewFullSeconds, T.previewShortSeconds) / T.previewDotEvery) + 2 }, () => ({ x: 0, y: 0 }));
const PB = newBall(0, 0);
function previewPoints(lv, b, l, clock, seconds) {
  const v = launchVel(lv, b, l, clock);
  Object.assign(PB, b); PB.vx = v.vx; PB.vy = v.vy; PB.on = -1;
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

function starsFor(strokes, st) { return strokes <= st.three ? 3 : strokes <= st.two ? 2 : 1; }
function shots(n) { return `${n} ${n === 1 ? 'shot' : 'shots'}`; }

function progress(E) {
  const best = E.save.get('best', {}), won = E.save.get('stars', {});
  const stars = LEVELS.map((lv, i) => won[i] || 0);
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

function drawBumper(ctx, x, y, r) {
  ctx.fillStyle = T.slate; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = T.slateEdge; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r - 1, 0, Math.PI * 2); ctx.stroke();
}

function drawBar(ctx, m, clock) {
  const u = barAt(m, clock);
  ctx.lineCap = 'round';
  ctx.strokeStyle = T.slate; ctx.lineWidth = T.barW;
  ctx.beginPath(); ctx.moveTo(m.x - u.x, m.y - u.y); ctx.lineTo(m.x + u.x, m.y + u.y); ctx.stroke();
  ctx.strokeStyle = T.slateEdge; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(m.x - u.x, m.y - u.y); ctx.lineTo(m.x + u.x, m.y + u.y); ctx.stroke();
  ctx.fillStyle = '#cbd5e1'; ctx.beginPath(); ctx.arc(m.x, m.y, 3, 0, Math.PI * 2); ctx.fill();
}

// Gradients are built once per size and colour around the origin, then drawn translated, so moons can reuse them.
const GRAD = new Map();
function grad(ctx, key, make) {
  let g = GRAD.get(key);
  if (!g) { g = make(); GRAD.set(key, g); }
  return g;
}

// A planet: soft atmosphere, a disc lit from the upper left, and a faint ring drifting in to show the pull.
// `phase` is the ring cycle (0 to 1), advanced by the play scene so it runs faster when the ball is near.
function drawPlanet(ctx, x, y, r, mass, boss, phase) {
  if (mass <= 0) { drawBumper(ctx, x, y, r); return; }
  const col = boss ? J.bossPlanet : T.purple, light = boss ? J.bossLight : J.planetLight, dark = boss ? J.bossDark : J.planetDark;
  const atm = grad(ctx, `a${r}${col}`, () => {
    const g = ctx.createRadialGradient(0, 0, r, 0, 0, r + J.atmosphere);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); return g;
  });
  const body = grad(ctx, `b${r}${col}`, () => {
    const g = ctx.createRadialGradient(-r * 0.4, -r * 0.4, r * 0.1, 0, 0, r * 1.05);
    g.addColorStop(0, light); g.addColorStop(0.45, col); g.addColorStop(1, dark); return g;
  });
  ctx.save(); ctx.translate(x, y);
  ctx.globalAlpha = 0.45; ctx.fillStyle = atm;
  ctx.beginPath(); ctx.arc(0, 0, r + J.atmosphere, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1; ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  if (phase !== undefined) {
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.5 * phase;
    ctx.beginPath(); ctx.arc(0, 0, r + J.atmosphere * 0.5 + J.pullRing * mass * (1 - phase), 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

// A sun: bright disc with a corona; `flare` runs 0 to 1 after a touch and swells the corona.
function drawSun(ctx, s, flare) {
  const f = 1 - flare, R = s.r * (J.corona + J.flareGrow * f);
  const cor = grad(ctx, 'corona', () => { // unit radius, drawn scaled
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, T.orange); g.addColorStop(1, 'rgba(249,115,22,0)'); return g;
  });
  const body = grad(ctx, `s${s.r}`, () => {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s.r);
    g.addColorStop(0, J.sunCore); g.addColorStop(0.55, J.sunMid); g.addColorStop(1, T.orange); return g;
  });
  ctx.save(); ctx.translate(s.x, s.y);
  ctx.save(); ctx.scale(R, R); ctx.globalAlpha = Math.min(1, J.coronaAlpha + 0.5 * f); ctx.fillStyle = cor;
  ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.fillStyle = body; ctx.beginPath(); ctx.arc(0, 0, s.r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
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
  S.ball = newBall(lv.ball.x, lv.ball.y);
  S.strokes = 0;
  S.phase = 'aim';       // aim | fly | sink
  S.acc = 0; S.steps = 0;
  S.clock = 0;           // hole clock: runs while aiming, restarts when the ball comes to rest
  S.clock0 = 0;
  S.aim = null;          // active pointer aim: { id, sx, sy, x, y }
  S.key = { on: false, angle: Math.atan2(lv.hole.y - lv.ball.y, lv.hole.x - lv.ball.x), power: T.keyPowerStart };
  S.sinkT = 0; S.sinkFrom = null;
}

// The clock the moving parts are drawn at: the flight's own clock while it runs, the aiming clock otherwise.
function partClock() { return S.phase === 'aim' ? S.clock : S.clock0 + S.steps * STEP; }

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
  const v = launchVel(S.lv, S.ball, l, S.clock);
  S.ball.vx = v.vx; S.ball.vy = v.vy; S.ball.on = -1;
  S.ball.sunIn = 0; // a shot from rest against a sun is charged if it goes back into it
  S.clock0 = S.clock;
  S.acc = 0; S.steps = 0;
  S.phase = 'fly';
  S.aim = null; S.key.on = false;
}

function comeToRest() {
  S.ball.vx = S.ball.vy = 0;
  S.phase = 'aim';
  S.clock = 0;
  carry(S.lv, S.ball, 0);
}

function finishHole(E) {
  const strokes = S.strokes, lv = S.lv, id = String(S.idx), stars = starsFor(strokes, lv.stars);
  const prev = E.save.get('best', {})[id];
  const best = prev === undefined ? strokes : Math.min(prev, strokes);
  E.save.update('best', (b) => ({ ...b, [id]: best }), {});
  E.save.update('stars', (s) => ({ ...s, [id]: Math.max(s[id] || 0, stars) }), {});
  const hasNext = S.idx + 1 < LEVELS.length;
  if (hasNext) E.save.update('unlocked', (u) => Math.max(u, S.idx + 1), 0);
  E.setScene('over', { hole: S.idx, name: lv.name, boss: lv.boss, strokes, three: lv.stars.three, par: lv.stars.two, stars, best, hasNext });
}

// ---------- Juice (cosmetic only: reads the physics state, never writes it) ----------

const FX = { glow: 0, power: 0, pop: 1, flash: 1, rest: 1, sink: 1, retry: 1, shots: 1, banner: 1, bannerTok: null, ring: null, flare: null, trailT: 0, ghost: false, gx: 0, gy: 0 };
const TRAIL = { xy: new Float32Array(2 * T.trailLength), n: 0, col: T.purple }; // oldest point first
const NOOP = () => {};
let GLOW_G = null;   // unit-radius gradient, drawn scaled and translated so it is built once
let CHANGED = null;  // { hole, from, to }: the hole whose stars just went up, consumed by the menu

function resetFx() {
  FX.glow = 0; FX.power = 0; FX.pop = 1; FX.flash = 1; FX.rest = 1; FX.sink = 1; FX.retry = 1; FX.shots = 1;
  FX.ghost = false; FX.trailT = 0;
  FX.ring = new Float32Array(S.lv.planets.length);
  FX.flare = new Float32Array(S.lv.suns.length).fill(1);
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

// True when the ball is within planetNearR of the surface of a planet or moon that pulls.
function planetNear(lv, b, clock) {
  for (const p of lv.planets) if (p.mass > 0 && dist(b.x, b.y, p.x, p.y) - p.r < J.planetNearR) return true;
  for (const m of lv.movers) if (m.type === 'moon') { const c = moonAt(lv, m, clock); if (dist(b.x, b.y, c.x, c.y) - m.r < J.planetNearR) return true; }
  return false;
}
function planetColor(lv) { return lv.boss ? J.bossPlanet : T.purple; }

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

// Per frame: glow follows the touch, pull rings speed up near the ball, the trail drains when the ball is not flying.
function fxUpdate(dt) {
  const b = S.ball, planets = S.lv.planets;
  FX.glow = clamp(FX.glow + (S.aim || S.key.on ? dt / J.glowInTime : -dt / J.glowOutTime), 0, 1);
  for (let i = 0; i < planets.length; i++) {
    const p = planets[i], near = clamp(1 - (dist(b.x, b.y, p.x, p.y) - p.r) / J.planetNearR, 0, 1);
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

function releaseFx(E) {
  const b = S.ball, len = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / len, uy = b.vy / len;
  E.audio.play('tap'); E.haptic(J.releaseHaptic);
  burst(E, b.x - ux * T.ballR, b.y - uy * T.ballR, { count: J.puffCount, color: J.puffColor, speed: J.puffSpeed, life: J.puffLife, size: J.puffSize, angle: Math.atan2(-uy, -ux), spread: J.puffSpread });
  FX.flash = 0;
  E.tween(J.flashTime, (k) => { FX.flash = k; }, ease.linear);
  popShots(E);
}

// The physics leaves the contact normal of the latest hit on the ball.
function bounceFx(E, pvx, pvy) {
  const b = S.ball, big = Math.hypot(pvx, pvy) > J.bigHitSpeed, nx = b.nx, ny = b.ny;
  E.audio.play('hit', big ? J.bigHitVol : J.hitVol);
  burst(E, b.x - nx * T.ballR, b.y - ny * T.ballR, {
    count: big ? J.sparkBigCount : J.sparkCount, color: big ? J.sparkBigColor : J.sparkColor,
    speed: big ? J.sparkBigSpeed : J.sparkSpeed, life: big ? J.sparkBigLife : J.sparkLife,
    size: big ? J.sparkBigSize : J.sparkSize, angle: Math.atan2(ny, nx), spread: J.sparkSpread,
  });
  if (big) E.shake(J.bigShake, J.bigShakeTime);
}

// A sun touch: the penalty stroke pops on the HUD, the sun flares, a hazard sound and buzz.
function sunFx(E, i) {
  const b = S.ball, s = S.lv.suns[i], flare = FX.flare;
  E.audio.play('miss'); E.haptic(J.sunHaptic);
  popShots(E);
  flare[i] = 0;
  E.tween(J.flareTime, (k) => { flare[i] = k; }, ease.outCubic);
  const nx = (b.x - s.x) / (s.r + T.ballR), ny = (b.y - s.y) / (s.r + T.ballR);
  burst(E, s.x + nx * s.r, s.y + ny * s.r, { count: J.flareCount, color: T.orange, speed: J.flareSpeed, life: J.flareLife, size: J.flareSize, angle: Math.atan2(ny, nx), spread: 2.4 });
}

function restFx(E) {
  if (S.strokes <= J.farRestShots || dist(S.ball.x, S.ball.y, S.lv.hole.x, S.lv.hole.y) <= J.farRestDist) return;
  FX.rest = 0;
  E.tween(J.restPulseTime, (k) => { FX.rest = k; }, ease.outQuad);
}

function sinkFx(E) {
  const lv = S.lv, stars = starsFor(S.strokes, lv.stars), three = stars === 3;
  const from = E.save.get('stars', {})[S.idx] || 0;
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
  ctx.globalAlpha = 1; ctx.fillStyle = J.bossPlanet;
  ctx.fillRect(x, y - h / 2, E.w, 3); ctx.fillRect(x, y + h / 2 - 3, E.w, 3);
  E.text('BOSS', x + E.w / 2, y - 8, { size: 32, weight: '800', color: J.bossPlanet });
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
function shoot(E, l) { launch(l); releaseFx(E); }

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
    if (S.phase === 'aim') { S.clock += dt; carry(S.lv, S.ball, S.clock); return; }
    if (S.phase === 'sink') {
      S.sinkT += dt;
      if (S.sinkT >= T.sinkTime) finishHole(E);
      return;
    }
    // Fixed-step accumulator: outcomes depend on the drag and the release clock, never on the frame rate.
    S.acc += dt;
    while (S.acc >= STEP && S.phase === 'fly') {
      S.acc -= STEP; S.steps++;
      const b = S.ball, hitsBefore = b.hits, sunsBefore = b.sunHits, pvx = b.vx, pvy = b.vy;
      let r = stepBall(S.lv, b, S.clock0 + S.steps * STEP);
      if (b.hits !== hitsBefore) bounceFx(E, pvx, pvy);
      if (b.sunHits !== sunsBefore) { S.strokes += T.sunPenalty * (b.sunHits - sunsBefore); sunFx(E, b.sunLast); }
      if (S.steps % J.trailEvery === 0) {
        if (planetNear(S.lv, b, S.clock0 + S.steps * STEP)) trailPush(b.x, b.y, planetColor(S.lv)); else trailDrop();
      }
      if (!r && S.steps * STEP >= T.maxFlightSeconds) r = 'rest';
      if (r === 'sink') { S.phase = 'sink'; S.sinkT = 0; S.sinkFrom = { x: b.x, y: b.y }; sinkFx(E); }
      else if (r === 'rest') { comeToRest(); restFx(E); }
    }
  },

  render(ctx, E) {
    const v = view(E), lv = S.lv, b = S.ball, clock = partClock();
    ctx.save();
    ctx.translate(v.ox, v.oy); ctx.scale(v.s, v.s);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, T.designW, T.designH); ctx.clip();
    drawField(ctx);
    for (const m of lv.movers) {
      if (m.type !== 'moon') continue;
      const p = lv.planets[m.parent];
      ctx.setLineDash([3, 7]); drawRing(ctx, p.x, p.y, m.orbitR, 1.5, planetColor(lv), J.orbitAlpha); ctx.setLineDash([]);
    }
    for (let i = 0; i < lv.suns.length; i++) drawSun(ctx, lv.suns[i], FX.flare[i]);
    for (let i = 0; i < lv.planets.length; i++) { const p = lv.planets[i]; drawPlanet(ctx, p.x, p.y, p.r, p.mass, lv.boss, FX.ring[i]); }
    for (const r of lv.walls) drawWall(ctx, r);
    for (const m of lv.movers) {
      if (m.type === 'slide') drawWall(ctx, slideAt(m, clock));
      else if (m.type === 'bar') drawBar(ctx, m, clock);
      else { const c = moonAt(lv, m, clock); drawPlanet(ctx, c.x, c.y, m.r, m.mass, lv.boss); }
    }

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
      const n = previewPoints(lv, b, aiming, S.clock, seconds);
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
    E.text(`Par ${lv.stars.two}`, E.w - 16, top, { size: 18, align: 'right', color: T.green });
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
    E.roundRect(cx - pw / 2, py, pw, E.h * 0.68 + (p.hasNext ? 80 : 0) + 44 - py, 18, '#0c1330', p.boss ? J.bossPlanet : T.slateEdge);
    if (p.boss) E.text('Boss', cx, E.h * 0.12, { size: 18, color: '#cbd5e1' });
    E.text(p.name, cx, E.h * 0.16, { size: 18, color: '#9aa4b2' });
    const nk = ease.outBack(clamp((t - J.numDelay) / J.numPop, 0, 1));
    ctx.save(); ctx.translate(cx, E.h * 0.24); ctx.scale(nk, nk);
    E.text(shots(p.strokes), 0, 0, { size: 44, weight: '800' });
    ctx.restore();
    E.text(`Par ${p.par}`, cx, E.h * 0.24 + 40, { size: 20, color: '#9aa4b2' });
    E.text(`3 stars: ${shots(p.three)}   2 stars: ${shots(p.par)}`, cx, E.h * 0.24 + 68, { size: 14, color: '#9aa4b2' });
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

// v0.1 pars, used once to carry stars earned under the v0.1 rule into the v0.2 save.
const V01_PAR = [2, 2, 2, 2, 3, 3, 3, 3, 3, 3];

export const game = {
  slug: 'gravity-golf',
  title: 'Gravity Golf',
  saveVersion: 4,
  // v1 was the skeleton demo, where `best` was a number; v2 keeps best strokes per hole in a map;
  // v3 adds `unlocked`, rebuilt from the holes already cleared; v4 stores stars per hole, because v0.2 judges stars
  // by per-hole thresholds on re-authored holes: stars won under v0.1 pars are kept as they were.
  migrate(data, fromVersion) {
    if (typeof data.best !== 'object' || data.best === null) delete data.best;
    if (data.unlocked === undefined) {
      const cleared = Object.keys(data.best || {}).map(Number);
      data.unlocked = Math.min(cleared.length ? Math.max(...cleared) + 1 : 0, LEVELS.length - 1);
    }
    if (fromVersion < 4 && data.stars === undefined) {
      data.stars = {};
      for (const [k, s] of Object.entries(data.best || {})) {
        const par = V01_PAR[k];
        if (par !== undefined) data.stars[k] = s <= par - 1 ? 3 : s <= par ? 2 : 1;
      }
    }
    return data;
  },
  TUNING,
  // Playtest ranges for the engine's tune panel; values apply from the next shot.
  experiments: [
    { key: 'planetGravity', label: 'Planet gravity', min: 1500000, max: 13500000, step: 100000 },
    { key: 'landSpeed', label: 'Land speed', min: 20, max: 150, step: 5 },
    { key: 'friction', label: 'Friction (speed kept per s)', min: 0.15, max: 0.5, step: 0.01 },
    { key: 'powerMax', label: 'Max power', min: 500, max: 1100, step: 10 },
    { key: 'sunPenalty', label: 'Sun penalty', min: 0, max: 3, step: 1 },
  ],
  // Read by tools/sim-golf.mjs so the simulator runs the real physics.
  sim: { levels: LEVELS, prepareLevel, stepBall, launchFromDrag, launchVel, newBall, carry, inSweep, moonAt, barAt, slideAt },
  start: 'menu',
  scenes: { menu, play, over },
};
