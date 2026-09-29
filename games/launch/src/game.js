// Launch, layer 1: the mechanic in grey box.
// Pull the slingshot from anywhere, release, tap to boost, bounce off springs and birds, stop or stick in mud; a card.
// World units: x to the right from the slingshot fork, y is height above the ground (10 units = 1 m). The critter's
// y is the bottom of its body. Physics runs in fixed steps with inputs stamped in flight time, so the same seed,
// launch and input times give the same flight at any frame rate (ADR-0008). tools/sim-launch.mjs drives game.sim.

import { makeRng, clamp } from './engine.js';

const TUNING = {
  bg: '#1f2736',
  designW: 640,            // landscape design space (ADR-0013); the world fills the width, the ground sits at groundY
  designH: 360,
  groundY: 300,            // design y of the ground line
  physicsStep: 1 / 120,

  // PRD section 16
  pullMax: 140,            // drag distance (screen px) for full pull
  dragDead: 14,            // shorter drags cancel
  launchSpeedMax: 700,     // launch speed at full pull, base Band (units/s)
  gravity: 520,            // units/s²
  airDrag: 0.025,          // fraction of speed lost per second in air, base Aero (PRD 0.035: see the changelog)
  groundFriction: 0.35,    // fraction of horizontal speed lost per ground touch
  groundBounce: 0.35,      // vertical speed kept on a plain ground touch
  springBounce: 1.25,      // vertical speed multiplier on a spring
  springMin: 380,          // a spring always launches at least this fast
  birdLift: 320,           // upward speed given by a bird bounce
  boostPulse: 110,         // speed added per tap along the flight direction
  fuelMax: 5,              // pulses in a full tank, base Fuel
  stopSpeed: 25,           // below this for stopTime ends the flight
  stopTime: 0.5,
  unitsPerMetre: 10,
  coinPer10m: 1,
  chainSteps: [1, 1.5, 2, 3], // coin multiplier by consecutive springs or birds
  birdCoins: 5,
  milestones: [500, 1000, 2000, 3500, 5000], // metres
  milestoneBonus: [25, 50, 100, 200, 400],   // one-time coins, first time each milestone is passed

  // The layer 4 shop's upgrade model. Nothing in layer 1 can change a level (every flight runs at level 0); it is here so
  // tools/sim-launch.mjs can fly each upgrade set through the real physics, and the shop will set `upgrades` from the save.
  upgradePrices: [50, 150, 400], // per level, per upgrade (PRD section 16)
  upgrades: { band: 0, fuel: 0, aero: 0, rocket: 0 },
  bandStep: 0.12,          // launchSpeedMax x (1 + 0.12 per level)
  fuelStep: 2,             // pulses per level
  aeroStep: 0.2,           // airDrag x (1 - 0.2 per level)
  rocketThrust: 330,       // hold-to-boost acceleration at Rocket 1 (units/s²); 3 pulses of fuel per second = the pulse's efficiency
  rocketStep: 0.25,        // thrust x (1 + 0.25 per level above 1)
  holdFuelRate: 3,         // pulses of fuel burned per second of hold
  holdDelay: 0.15,         // a press held this long becomes a hold (the press itself already fired a pulse)

  // Flight rules the PRD states in words
  slingH: 36,              // launch height of the critter's bottom
  launchAngleMin: 5,       // degrees
  launchAngleMax: 80,
  critterR: 12,
  settleSpeed: 60,         // a ground bounce slower than this becomes a slide
  slideFriction: 1.4,      // sliding speed decays as exp(-slideFriction x seconds)
  groundBoostAngle: 35,    // a pulse fired on the ground hops at this angle
  rampKeep: 1,             // speed kept when a ramp redirects the critter along its slope
  birdR: 15,
  birdSwing: 50,           // birds glide back and forth this far either side of their spot
  birdPeriod: 3.2,         // seconds for one glide there and back
  maxFlight: 150,          // seconds: a safety stop only

  // Field
  chunkLen: 3000,          // 300 m
  chunkJitter: 60,         // each object's x moves up to this far (seeded); templates keep 2 x jitter clear
  birdJitterY: 20,
  tierFrom: [0, 1000, 2000, 3500], // metres where chunk tiers 0 to 3 start; past 2000 m more mud, fewer springs, more ramps
  lookahead: 4000,         // field generated this far ahead of the critter

  // Presentation
  previewTime: 0.6,        // seconds of flight in the dotted arc
  pullVisual: 40,          // how far the critter moves back in the pocket at full pull (units)
  slingScreen: 0.2,        // slingshot at this fraction of the view width before launch
  followX: 0.3,            // the camera keeps the critter at this fraction of the view width
  followXMin: 0.1,         // ... or as far left as this when the arc's landing is too far ahead for zoomMin
  zoomMin: 0.45,           // the camera zooms out to this at most (PRD amendment after layer 1)
  zoomLook: 1.0,           // seconds of horizontal travel kept in view ahead of the critter
  zoomOutTime: 0.35,       // smoothing time constants (s): zooming out is quicker than zooming back in
  zoomInTime: 0.9,
  landMargin: 30,          // design px kept between the predicted landing and the right edge
  skyTop: 50,              // design px at the top kept clear for the HUD
  skyFill: 0.8,            // share of the sky (ground line to skyTop) the critter climbs into before the view zooms or pans
  spriteMin: 0.65,         // the critter and birds never draw smaller than this zoom
  endDelay: 0.9,           // seconds from the stop to the card
  cardGrace: 0.4,          // seconds the card ignores taps after it appears
  nudgeLife: 1.2,          // seconds "Pull further" stays after a too-short drag
  calloutLife: 1.4,

  color: {
    sky: '#1f2736', ground: '#394150', groundTop: '#4d5667', tick: '#5b6577',
    critter: '#ff8a1a', eye: '#1f2736', teal: '#2ec4b6', tealDim: '#1c6f69', mud: '#4a2c17', mudRim: '#d39a62',
    ramp: '#6b7280', rampTop: '#8b93a1', sling: '#8b8f98', band: '#94a3b8', bandTaut: '#ffffff', text: '#e6e6e6', dim: '#9aa4b2', panel: '#141a24',
  },
};
const T = TUNING;
const STEP = T.physicsStep;
const DEG = Math.PI / 180;

// ---------- Field ----------
// A chunk is 300 m of objects: { kind, x, y, w?, h? } with x from the chunk start. Ground objects (spring, mud, ramp)
// have y 0; a spring is w wide, mud is w wide, a ramp rises h over w toward the right. A bird is a spot in the air.
// Fairness rules every template keeps (tools/sim-launch.mjs --check proves them over many seeds): a spring comes before
// the first mud of a chunk, no two mud patches without a spring between, and no stretch of 150 m without a spring.

// The fixed first chunk teaches: a spring where a clean full-pull launch first lands, a bird on the way down from it (the
// bounce carries the critter over a spring to the next one), then the first mud with that spring before it. A launch that
// misses the bird comes down on the middle spring instead.
const FIRST_CHUNK = {
  name: 'First flight',
  objects: [
    { kind: 'spring', x: 670, y: 0, w: 320 },
    { kind: 'bird', x: 1853, y: 192 },
    { kind: 'spring', x: 1500, y: 0, w: 640 },
    { kind: 'spring', x: 2600, y: 0, w: 180 },
    { kind: 'mud', x: 2850, y: 0, w: 120 },
  ],
};

// tiers: which distance tiers (TUNING.tierFrom) may draw the template.
const CHUNKS = [
  { name: 'Meadow', tiers: [0], objects: [
    { kind: 'spring', x: 300, y: 0, w: 80 }, { kind: 'bird', x: 700, y: 140 }, { kind: 'spring', x: 1000, y: 0, w: 80 },
    { kind: 'mud', x: 1350, y: 0, w: 120 }, { kind: 'spring', x: 1700, y: 0, w: 80 }, { kind: 'bird', x: 2100, y: 170 },
    { kind: 'spring', x: 2450, y: 0, w: 80 },
  ] },
  { name: 'Hop line', tiers: [0, 1], objects: [
    { kind: 'spring', x: 350, y: 0, w: 70 }, { kind: 'spring', x: 1050, y: 0, w: 70 }, { kind: 'ramp', x: 1450, y: 0, w: 240, h: 65 },
    { kind: 'spring', x: 1950, y: 0, w: 70 }, { kind: 'mud', x: 2200, y: 0, w: 110 }, { kind: 'spring', x: 2550, y: 0, w: 70 },
  ] },
  { name: 'Ramp run', tiers: [0, 1], objects: [
    { kind: 'spring', x: 350, y: 0, w: 70 }, { kind: 'spring', x: 1100, y: 0, w: 70 }, { kind: 'ramp', x: 1500, y: 0, w: 240, h: 65 },
    { kind: 'bird', x: 2000, y: 200 }, { kind: 'spring', x: 2250, y: 0, w: 70 }, { kind: 'mud', x: 2500, y: 0, w: 140 },
  ] },
  { name: 'Launch pad', tiers: [1], objects: [
    { kind: 'spring', x: 350, y: 0, w: 70 }, { kind: 'ramp', x: 800, y: 0, w: 300, h: 80 }, { kind: 'spring', x: 1350, y: 0, w: 70 },
    { kind: 'ramp', x: 1700, y: 0, w: 300, h: 80 }, { kind: 'bird', x: 2150, y: 180 }, { kind: 'spring', x: 2400, y: 0, w: 70 },
    { kind: 'ramp', x: 2650, y: 0, w: 240, h: 65 },
  ] },
  { name: 'Flock', tiers: [1], objects: [
    { kind: 'spring', x: 450, y: 0, w: 70 }, { kind: 'bird', x: 900, y: 110 }, { kind: 'bird', x: 1350, y: 190 },
    { kind: 'mud', x: 1530, y: 0, w: 150 }, { kind: 'spring', x: 1850, y: 0, w: 70 }, { kind: 'bird', x: 2300, y: 150 },
    { kind: 'spring', x: 2500, y: 0, w: 70 }, { kind: 'mud', x: 2720, y: 0, w: 120 },
  ] },
  { name: 'Bog', tiers: [2], objects: [
    { kind: 'spring', x: 400, y: 0, w: 60 }, { kind: 'mud', x: 650, y: 0, w: 200 }, { kind: 'ramp', x: 1000, y: 0, w: 320, h: 85 },
    { kind: 'spring', x: 1520, y: 0, w: 60 }, { kind: 'mud', x: 1750, y: 0, w: 200 }, { kind: 'ramp', x: 2100, y: 0, w: 320, h: 85 },
    { kind: 'spring', x: 2600, y: 0, w: 60 },
  ] },
  { name: 'Ski jump', tiers: [2], objects: [
    { kind: 'spring', x: 400, y: 0, w: 60 }, { kind: 'ramp', x: 650, y: 0, w: 320, h: 85 }, { kind: 'mud', x: 1150, y: 0, w: 180 },
    { kind: 'spring', x: 1500, y: 0, w: 60 }, { kind: 'ramp', x: 1750, y: 0, w: 320, h: 85 }, { kind: 'bird', x: 2250, y: 160 },
    { kind: 'spring', x: 2450, y: 0, w: 60 }, { kind: 'mud', x: 2700, y: 0, w: 160 },
  ] },
  { name: 'Long jump', tiers: [2, 3], objects: [
    { kind: 'spring', x: 400, y: 0, w: 60 }, { kind: 'ramp', x: 650, y: 0, w: 320, h: 85 }, { kind: 'spring', x: 1300, y: 0, w: 60 },
    { kind: 'mud', x: 1530, y: 0, w: 170 }, { kind: 'ramp', x: 1850, y: 0, w: 320, h: 85 }, { kind: 'spring', x: 2400, y: 0, w: 60 },
    { kind: 'mud', x: 2650, y: 0, w: 150 },
  ] },
  { name: 'Ramp field', tiers: [2, 3], objects: [
    { kind: 'spring', x: 350, y: 0, w: 60 }, { kind: 'ramp', x: 600, y: 0, w: 320, h: 85 }, { kind: 'mud', x: 1100, y: 0, w: 200 },
    { kind: 'spring', x: 1450, y: 0, w: 60 }, { kind: 'ramp', x: 1700, y: 0, w: 320, h: 85 }, { kind: 'ramp', x: 2200, y: 0, w: 320, h: 85 },
    { kind: 'spring', x: 2700, y: 0, w: 60 },
  ] },
  { name: 'Ski slope', tiers: [3], objects: [
    { kind: 'spring', x: 350, y: 0, w: 60 }, { kind: 'ramp', x: 580, y: 0, w: 320, h: 85 }, { kind: 'ramp', x: 1060, y: 0, w: 320, h: 85 },
    { kind: 'spring', x: 1530, y: 0, w: 60 }, { kind: 'mud', x: 1760, y: 0, w: 160 }, { kind: 'ramp', x: 2080, y: 0, w: 320, h: 85 },
    { kind: 'spring', x: 2550, y: 0, w: 60 }, { kind: 'mud', x: 2780, y: 0, w: 120 },
  ] },
];

function tierAt(metres) { let t = 0; T.tierFrom.forEach((m, i) => { if (metres >= m) t = i; }); return t; }

function makeField(seed) {
  const f = { seed, rng: makeRng(seed), ground: [], birds: [], end: 0, chunks: 0 };
  addChunk(f, FIRST_CHUNK, false);
  return f;
}

function addChunk(f, tpl, jitter) {
  const x0 = f.end, rng = f.rng;
  for (const o of tpl.objects) {
    const x = x0 + o.x + (jitter ? Math.round(rng.range(-T.chunkJitter, T.chunkJitter)) : 0);
    if (o.kind === 'bird') {
      f.birds.push({ x0: x, y: o.y + (jitter ? Math.round(rng.range(-T.birdJitterY, T.birdJitterY)) : 0), phase: jitter ? rng.range(0, Math.PI * 2) : 0, hit: false });
    } else {
      const g = { kind: o.kind, x0: x, x1: x + o.w, w: o.w, h: o.h || 0, spent: false };
      if (o.kind === 'ramp') g.a = Math.atan2(o.h, o.w);
      f.ground.push(g);
    }
  }
  f.ground.sort((a, b) => a.x0 - b.x0);
  f.end += T.chunkLen; f.chunks++;
}

function ensureField(f, x) {
  while (f.end < x + T.lookahead) {
    const tier = tierAt(f.end / T.unitsPerMetre);
    addChunk(f, f.rng.pick(CHUNKS.filter((c) => c.tiers.includes(tier))), true);
  }
}

// The ground object under x, or null for plain ground.
function groundAt(f, x) {
  const g = f.ground;
  let lo = 0, hi = g.length - 1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (g[m].x1 < x) lo = m + 1; else if (g[m].x0 > x) hi = m - 1; else return g[m];
  }
  return null;
}
const surfaceH = (g, x) => (g && g.kind === 'ramp' ? (g.h * (x - g.x0)) / g.w : 0);
const birdX = (b, t) => b.x0 + T.birdSwing * Math.sin((t / T.birdPeriod) * Math.PI * 2 + b.phase);

// ---------- Flight ----------

// A flight's numbers at a set of upgrade levels (the layer 4 shop's model, see TUNING.upgrades).
function stats(up = T.upgrades) {
  const band = up.band || 0, fuel = up.fuel || 0, aero = up.aero || 0, rocket = up.rocket || 0;
  const airDrag = T.airDrag * Math.max(0, 1 - T.aeroStep * aero);
  return {
    launchSpeed: T.launchSpeedMax * (1 + T.bandStep * band),
    fuelMax: T.fuelMax + T.fuelStep * fuel,
    airDrag,
    dragK: Math.pow(1 - airDrag, STEP),
    slideK: Math.exp(-T.slideFriction * STEP),
    hold: rocket >= 1,
    thrust: rocket >= 1 ? T.rocketThrust * (1 + T.rocketStep * (rocket - 1)) : 0,
  };
}

// Drag in screen px (finger movement: dx right, dy down) to a launch; null inside the dead zone.
function launchFromDrag(dx, dy) {
  const L = Math.hypot(dx, dy);
  if (L < T.dragDead) return null;
  const ang = clamp(Math.atan2(dy, -dx) / DEG, T.launchAngleMin, T.launchAngleMax);
  return { angle: ang, power: Math.min(1, L / T.pullMax) };
}

function newRun(seed, launch, up = T.upgrades) {
  const st = stats(up), sp = launch.power * st.launchSpeed, a = launch.angle * DEG;
  const field = makeField(seed);
  ensureField(field, 0);
  return {
    seed, launch, up: { ...up }, st, field,
    x: 0, y: T.slingH, vx: sp * Math.cos(a), vy: sp * Math.sin(a), mode: 'air', ramp: null, u: 0,
    fuel: st.fuelMax, holding: false, steps: 0, acc: 0, q: [], ev: [],
    chain: 0, chainMax: 0, birds: 0, springs: 0, pulses: 0, coinAcc: 0, nextMark: 10 * T.unitsPerMetre, maxX: 0,
    msIdx: 0, stars: [], slowT: 0, ended: null,
  };
}

const flightTime = (r) => r.steps * STEP;
const mult = (r) => T.chainSteps[Math.min(r.chain, T.chainSteps.length - 1)];

// Queue an input at flight time `at` (seconds); it applies on the step that contains that time.
function queueInput(r, at, kind) {
  if (kind === 'holdOff') { // a release before the hold began cancels the pending hold
    const i = r.q.findIndex((e) => e.kind === 'holdOn' && e.at >= at);
    if (i >= 0) { r.q.splice(i, 1); return; }
  }
  r.q.push({ at, kind });
  r.q.sort((a, b) => a.at - b.at);
}

function boostDir(r) {
  if (r.mode === 'air') { const s = Math.hypot(r.vx, r.vy); if (s > 1) return [r.vx / s, r.vy / s]; }
  return [Math.cos(T.groundBoostAngle * DEG), Math.sin(T.groundBoostAngle * DEG)];
}

function push(r, dv) {
  if (r.mode === 'ramp') { r.u += dv; return; }
  const [ux, uy] = boostDir(r);
  r.vx += ux * dv; r.vy += uy * dv;
  if (r.mode === 'ground' && r.vy > 0) r.mode = 'air';
}

function applyInput(r, e) {
  if (e.kind === 'pulse') {
    if (r.fuel <= 0) return;
    const k = Math.min(1, r.fuel);
    r.fuel -= k; r.pulses++;
    push(r, T.boostPulse * k);
    r.ev.push({ k: 'boost' });
  } else if (e.kind === 'holdOn') r.holding = r.st.hold;
  else if (e.kind === 'holdOff') r.holding = false;
}

function end(r, why) { r.ended = why; r.vx = r.vy = 0; r.ev.push({ k: why }); }

function hitSpring(r, g, vyIn) {
  g.spent = true;
  r.vy = Math.max(T.springMin, -vyIn * T.springBounce);
  r.y = 0; r.mode = 'air';
  r.springs++; r.chain++; r.chainMax = Math.max(r.chainMax, r.chain);
  r.ev.push({ k: 'spring', x: r.x, chain: r.chain });
}

function enterRamp(r, g, speed) {
  if (r.vx <= 0) { r.vx = 0; r.vy = 0; r.mode = 'ground'; r.y = 0; return; } // bumped the ramp's back
  r.mode = 'ramp'; r.ramp = g; r.u = speed * T.rampKeep;
  r.y = surfaceH(g, r.x); r.vx = r.u * Math.cos(g.a); r.vy = r.u * Math.sin(g.a);
  r.ev.push({ k: 'ramp' });
}

function plainTouch(r) {
  r.chain = 0;
  r.y = 0;
  r.vx *= 1 - T.groundFriction;
  if (-r.vy * T.groundBounce >= T.settleSpeed) { r.vy = -r.vy * T.groundBounce; r.ev.push({ k: 'bounce' }); }
  else { r.vy = 0; r.mode = 'ground'; }
}

// One fixed physics step.
function stepRun(r) {
  if (r.ended) return;
  const f = r.field, st = r.st, t1 = (r.steps + 1) * STEP;
  while (r.q.length && r.q[0].at < t1) applyInput(r, r.q.shift());
  if (r.holding && r.fuel > 0) {
    const k = Math.min(1, r.fuel / (T.holdFuelRate * STEP));
    r.fuel = Math.max(0, r.fuel - T.holdFuelRate * STEP);
    push(r, st.thrust * STEP * k);
  }

  if (r.mode === 'air') {
    r.vy -= T.gravity * STEP;
    r.vx *= st.dragK; r.vy *= st.dragK;
    r.x += r.vx * STEP; r.y += r.vy * STEP;
    const t = t1, cy = r.y + T.critterR;
    for (const b of f.birds) {
      if (b.hit || Math.abs(b.x0 - r.x) > T.birdSwing + 40) continue;
      if (Math.hypot(birdX(b, t) - r.x, b.y - cy) < T.critterR + T.birdR) {
        b.hit = true;
        r.vy = Math.max(r.vy, T.birdLift);
        r.birds++; r.chain++; r.chainMax = Math.max(r.chainMax, r.chain);
        r.ev.push({ k: 'bird', x: r.x, chain: r.chain });
      }
    }
    const g = groundAt(f, r.x);
    if (r.y <= surfaceH(g, r.x) && (r.vy <= 0 || (g && g.kind === 'ramp'))) {
      const vyIn = r.vy;
      if (g && g.kind === 'mud') { r.y = 0; end(r, 'mud'); }
      else if (g && g.kind === 'spring' && !g.spent) hitSpring(r, g, vyIn);
      else if (g && g.kind === 'ramp') enterRamp(r, g, Math.hypot(r.vx, r.vy));
      else plainTouch(r);
    }
  } else if (r.mode === 'ground') {
    r.vx *= st.slideK;
    r.x += r.vx * STEP;
    const g = groundAt(f, r.x);
    if (g && g.kind === 'mud') end(r, 'mud');
    else if (g && g.kind === 'spring' && !g.spent) hitSpring(r, g, 0);
    else if (g && g.kind === 'ramp') enterRamp(r, g, Math.abs(r.vx));
    else r.chain = 0;
  } else if (r.mode === 'ramp') {
    const g = r.ramp;
    r.u = r.u * st.dragK - T.gravity * Math.sin(g.a) * STEP;
    r.x += r.u * Math.cos(g.a) * STEP;
    r.vx = r.u * Math.cos(g.a); r.vy = r.u * Math.sin(g.a);
    if (r.x >= g.x1) { r.mode = 'air'; r.y = g.h; r.ramp = null; }
    else if (r.x <= g.x0) { r.mode = 'ground'; r.y = 0; r.vy = 0; r.ramp = null; }
    else r.y = surfaceH(g, r.x);
  }

  r.steps++;
  if (r.x > r.maxX) {
    r.maxX = r.x;
    while (r.maxX >= r.nextMark) { r.coinAcc += T.coinPer10m * mult(r); r.nextMark += 10 * T.unitsPerMetre; }
    while (r.msIdx < T.milestones.length && r.maxX >= T.milestones[r.msIdx] * T.unitsPerMetre) {
      r.stars.push(T.milestones[r.msIdx]); r.ev.push({ k: 'milestone', m: T.milestones[r.msIdx] }); r.msIdx++;
    }
    ensureField(f, r.maxX);
  }
  if (r.ended) return;
  if (Math.hypot(r.vx, r.vy) < T.stopSpeed) { r.slowT += STEP; if (r.slowT >= T.stopTime) end(r, 'stop'); }
  else r.slowT = 0;
  if (flightTime(r) >= T.maxFlight) end(r, 'stop');
}

// Frame-rate independent advance: whole steps only, the remainder carried.
function advance(r, dt) {
  r.acc += dt;
  while (r.acc >= STEP && !r.ended) { stepRun(r); r.acc -= STEP; }
}

const metres = (r) => Math.floor(r.maxX / T.unitsPerMetre);
const coinsOf = (r) => Math.floor(r.coinAcc) + r.birds * T.birdCoins;

// The first previewTime seconds of flight, ignoring the field (the dotted arc).
function previewArc(launch) {
  const st = stats(), sp = launch.power * st.launchSpeed, a = launch.angle * DEG, pts = [];
  let x = 0, y = T.slingH, vx = sp * Math.cos(a), vy = sp * Math.sin(a);
  const n = Math.round(T.previewTime / STEP);
  for (let i = 1; i <= n; i++) {
    vy -= T.gravity * STEP; vx *= st.dragK; vy *= st.dragK; x += vx * STEP; y += vy * STEP;
    if (i % 6 === 0) pts.push([x, Math.max(0, y)]);
  }
  return pts;
}

// ---------- Save ----------
// { best: metres, coins, ms: [milestone metres ever passed], flights }

function finishFlight(E, r) {
  const m = metres(r), best = E.save.get('best', 0);
  const reached = E.save.get('ms', []);
  let bonus = 0;
  const firsts = [];
  T.milestones.forEach((ms, i) => { if (m >= ms && !reached.includes(ms)) { bonus += T.milestoneBonus[i]; firsts.push(ms); } });
  const earned = coinsOf(r) + bonus;
  E.save.set('coins', E.save.get('coins', 0) + earned);
  if (firsts.length) E.save.set('ms', reached.concat(firsts));
  if (m > best) E.save.set('best', m);
  E.save.update('flights', (n) => n + 1, 0);
  E.ledger.add('flight', { m, why: r.ended, coins: earned, chain: r.chainMax, springs: r.springs, birds: r.birds, pulses: r.pulses, angle: r.launch.angle, power: r.launch.power, seed: r.seed });
  return { m, best: Math.max(best, m), isNew: m > best, coins: earned, bonus, chainMax: r.chainMax, stars: r.stars.slice(), firsts, seed: r.seed, why: r.ended };
}

// ---------- Camera ----------
// The camera zooms out with height, speed and the predicted landing of the current arc, down to zoomMin, so the landing
// is in view by the top of the arc. The ground band keeps its screen size and position: when even zoomMin cannot fit the
// critter's height, the sky pans up with the critter and the band stays pinned at the bottom (a drop line and a height
// label show how far up it is). Everything here is in design px at zoom 1; `vw` is the view width in design px.

// Where the critter comes down if nothing else touches it: gravity and drag only, onto the ground or a ramp.
function predictLanding(r) {
  if (r.mode !== 'air') return r.x;
  let vx = r.vx, vy = r.vy, x = r.x, y = r.y;
  const h = STEP * 4, k = Math.pow(1 - r.st.airDrag, h);
  for (let i = 0; i < 6000; i++) {
    vy -= T.gravity * h; vx *= k; vy *= k; x += vx * h; y += vy * h;
    if (vy < 0 && y <= surfaceH(groundAt(r.field, x), x)) return x;
  }
  return x;
}

const newCamera = (vw) => ({ x: -vw * T.slingScreen, y: 0, z: 1, a: T.followX });
const skyRoom = () => (T.groundY - T.skyTop) * T.skyFill; // design px of sky the critter may climb into before the view moves

function cameraStep(c, r, vw, dt) {
  let zt = 1, at = T.followX;
  const ahead = vw * (1 - T.followX) - T.landMargin;
  if (r && !r.ended) {
    zt = Math.min(zt, skyRoom() / (r.y + 2 * T.critterR));
    if (r.mode === 'air') {
      const d = predictLanding(r) - r.x;
      if (d > 0) {
        zt = Math.min(zt, ahead / d);
        // A landing too far for zoomMin: slide the critter toward the left edge to make room ahead.
        at = clamp(1 - (d * T.zoomMin + T.landMargin) / vw, T.followXMin, T.followX);
      }
    }
    if (r.vx > 1) zt = Math.min(zt, ahead / (r.vx * T.zoomLook));
  }
  zt = clamp(zt, T.zoomMin, 1);
  const k = (tau) => 1 - Math.exp(-dt / tau);
  c.z += (zt - c.z) * k(zt < c.z ? T.zoomOutTime : T.zoomInTime);
  c.a += (at - c.a) * k(T.zoomOutTime);
  const start = -vw * T.slingScreen;
  c.x = r ? Math.max(start, r.x - (vw * c.a) / c.z) : start;
  c.y = r ? Math.max(0, r.y + 2 * T.critterR - skyRoom() / c.z) : 0;
  return c;
}

// A world point in design px at zoom 1 (the ground band pinned at groundY).
const toView = (c, wx, wy) => [(wx - c.x) * c.z, T.groundY - (wy - c.y) * c.z];

// ---------- View ----------

function view(E) {
  const s = Math.min(E.w / T.designW, E.h / T.designH);
  return { s, oy: (E.h - T.designH * s) / 2, vw: E.w / s };
}

const S = { run: null, cam: null, seed: 0 };

function drawWorld(ctx, E, v, c, r, pull, hint) {
  const C = T.color, s = v.s, z = c.z;
  const X = (wx) => (wx - c.x) * z * s, Y = (wy) => v.oy + (T.groundY - (wy - c.y) * z) * s;
  const gy = v.oy + T.groundY * s, lift = c.y * z * s; // lift: how far the sky is panned above the pinned band
  const sprite = Math.max(z, T.spriteMin); // critter and birds shrink less than the world so they still read
  ctx.fillStyle = C.sky; ctx.fillRect(0, 0, E.w, E.h);
  ctx.fillStyle = C.ground; ctx.fillRect(0, gy, E.w, E.h - gy);
  ctx.fillStyle = C.groundTop; ctx.fillRect(0, gy, E.w, 3 * s);

  // Distance ticks every 10 m, labels every 50 m.
  const u10 = 10 * T.unitsPerMetre, span = v.vw / z;
  for (let wx = Math.floor(c.x / u10) * u10; wx < c.x + span + u10; wx += u10) {
    if (wx < 0) continue;
    const big = wx % (5 * u10) === 0;
    ctx.fillStyle = C.tick; ctx.fillRect(X(wx) - 1, gy + 4 * s, 2, (big ? 12 : 6) * s);
    if (big && wx > 0) E.text(`${wx / T.unitsPerMetre} m`, X(wx), gy + 28 * s, { size: 14, color: C.dim, weight: '600' });
  }

  // Slingshot fork (on the band).
  const fx = X(0), fy = (h) => gy - h * z * s, top = fy(T.slingH + 14);
  ctx.strokeStyle = C.sling; ctx.lineWidth = 5 * s * z; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(fx, gy); ctx.lineTo(fx, fy(T.slingH - 6));
  ctx.moveTo(fx, fy(T.slingH - 6)); ctx.lineTo(fx - 9 * s * z, top); ctx.moveTo(fx, fy(T.slingH - 6)); ctx.lineTo(fx + 9 * s * z, top); ctx.stroke();

  if (r) {
    const f = r.field, t = flightTime(r), x0 = c.x - 400, x1 = c.x + span + 400;
    for (const g of f.ground) {
      if (g.x1 < x0 || g.x0 > x1) continue;
      if (g.kind === 'spring') drawSpring(ctx, X(g.x0), gy, g.w * z * s, s, g.spent);
      else if (g.kind === 'mud') {
        ctx.fillStyle = C.mud; roundBlob(ctx, X(g.x0), gy - 5 * s, g.w * z * s, 12 * s);
        ctx.fillStyle = C.mudRim; roundBlob(ctx, X(g.x0), gy - 6 * s, g.w * z * s, 4 * s); // the light top edge: 3:1 or better on sky and ground
      } else if (g.kind === 'ramp') {
        ctx.fillStyle = C.ramp; ctx.beginPath(); ctx.moveTo(X(g.x0), gy); ctx.lineTo(X(g.x1), gy - g.h * z * s); ctx.lineTo(X(g.x1), gy); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = C.rampTop; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(X(g.x0), gy); ctx.lineTo(X(g.x1), gy - g.h * z * s); ctx.stroke();
      }
    }
    for (const b of f.birds) {
      if (b.hit || b.x0 < x0 || b.x0 > x1) continue;
      const by = Y(b.y);
      if (by < gy - 4 * s) drawBird(ctx, X(birdX(b, t)), by, s * sprite, Math.cos((t / T.birdPeriod) * Math.PI * 2 + b.phase) >= 0);
    }
  }

  if (hint) { // first launch: a ghost thumb pulling back and down, behind the critter
    const k = (E.time % 1.6) / 1.2;
    if (k <= 1) {
      const hx = X(0) + (90 - 80 * k) * s, hy = gy - (T.slingH + 60) * s + 60 * k * s;
      ctx.globalAlpha = 0.28 * Math.sin(Math.PI * k); ctx.fillStyle = C.text;
      ctx.beginPath(); ctx.arc(hx, hy, 16 * s, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    }
  }

  // The critter: in the pocket while pulling, else where the run has it.
  let cx, cy;
  if (pull) { cx = pull.px; cy = T.slingH + pull.py; }
  else if (r) { cx = r.x; cy = r.y; }
  else { cx = 0; cy = T.slingH; }
  const rr = T.critterR * s * sprite, sx = X(cx), sy = Y(cy) - rr;
  if (pull || !r) {
    const taut = pull && pull.full;
    ctx.strokeStyle = taut ? C.bandTaut : C.band; ctx.lineWidth = (taut ? 3.5 : 2.5) * s;
    ctx.beginPath(); ctx.moveTo(fx - 9 * s, top); ctx.lineTo(sx, sy); ctx.lineTo(fx + 9 * s, top); ctx.stroke();
  }
  if (pull && pull.arc) {
    ctx.fillStyle = C.text;
    for (const [px, py] of pull.arc) { ctx.beginPath(); ctx.arc(X(px), Y(py + T.critterR), 2.4 * s, 0, Math.PI * 2); ctx.fill(); }
  }
  if (lift > 0) { // panned sky: a dotted drop line from the critter to the band
    ctx.strokeStyle = C.dim; ctx.lineWidth = 1.5; ctx.setLineDash([3, 6]);
    ctx.beginPath(); ctx.moveTo(sx, sy + rr + 4); ctx.lineTo(sx, gy); ctx.stroke(); ctx.setLineDash([]);
  }
  drawCritter(ctx, sx, sy, rr, r && !pull ? Math.atan2(-r.vy, r.vx) : 0);
  return { sx, sy, rr, height: cy, lifted: lift > 0 };
}

function roundBlob(ctx, x, y, w, h) {
  const rr = Math.min(h / 2, w / 2);
  ctx.beginPath(); ctx.moveTo(x + rr, y); ctx.lineTo(x + w - rr, y); ctx.arc(x + w - rr, y + rr, rr, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + rr, y + h); ctx.arc(x + rr, y + rr, rr, Math.PI / 2, Math.PI * 1.5); ctx.fill();
}

function drawSpring(ctx, x, gy, w, s, spent) {
  const C = T.color, hgt = (spent ? 3 : 8) * s, col = spent ? C.tealDim : C.teal;
  ctx.strokeStyle = col; ctx.lineWidth = 2 * s;
  ctx.beginPath();
  const n = 5;
  for (let i = 0; i <= n; i++) { const yy = gy - (hgt * i) / n; const xx = x + w * 0.25 + (i % 2 ? w * 0.5 : 0); if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); }
  ctx.stroke();
  ctx.fillStyle = col; ctx.fillRect(x, gy - hgt - 4 * s, w, 4 * s);
}

function drawBird(ctx, x, y, s, up) {
  const C = T.color, r = T.birdR * s;
  ctx.fillStyle = C.teal;
  ctx.beginPath(); ctx.arc(x, y, r * 0.75, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - r * 0.1, y); ctx.lineTo(x + r * 0.9, y); ctx.lineTo(x + r * 0.5, y + (up ? -r * 1.3 : r * 1.1)); ctx.fill();
  ctx.fillStyle = C.tealDim; ctx.beginPath(); ctx.moveTo(x - r * 0.9, y - r * 0.15); ctx.lineTo(x - r * 1.35, y); ctx.lineTo(x - r * 0.9, y + r * 0.15); ctx.fill();
  ctx.fillStyle = C.eye; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.2, 1.8 * s, 0, Math.PI * 2); ctx.fill();
}

function drawCritter(ctx, x, y, r, a) {
  const C = T.color;
  ctx.fillStyle = C.critter; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  const ex = Math.cos(a) * r * 0.35, ey = Math.sin(a) * r * 0.35;
  ctx.fillStyle = C.eye;
  ctx.beginPath(); ctx.arc(x + ex - r * 0.18, y + ey - r * 0.25, r * 0.16, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + ex + r * 0.3, y + ey - r * 0.25, r * 0.16, 0, Math.PI * 2); ctx.fill();
}

// HUD in CSS px, inside all four safe insets. The fuel gauge sits top left, clear of the sling pocket.
function drawHud(E, r, fuel, fuelMax, info, callout) {
  const C = T.color, sf = E.safe, right = E.w - sf.right - 16, top = sf.top + 12;
  E.text(`${r ? metres(r) : 0} m`, right, top + 16, { size: 28, weight: '800', align: 'right', color: C.text });
  if (r && r.chain > 0) E.text(`Chain x${mult(r)}`, right, top + 46, { size: 16, align: 'right', color: C.teal });
  const x0 = sf.left + 16, y0 = top + 30;
  E.roundRect(x0 - 8, top - 4, Math.max(58, fuelMax * 18 + 12), 50, 10, C.panel);
  E.text('Fuel', x0, top + 10, { size: 14, align: 'left', color: C.dim });
  for (let i = 0; i < fuelMax; i++) {
    const k = clamp(fuel - i, 0, 1);
    E.roundRect(x0 + i * 18, y0 - 6, 14, 14, 4, '#2a3342', '#4b5567');
    if (k > 0) E.roundRect(x0 + i * 18 + 2, y0 - 4 + 10 * (1 - k), 10, 10 * k, 3, C.text);
  }
  if (info && info.lifted) E.text(`${Math.round(info.height / T.unitsPerMetre)} m up`, info.sx + info.rr + 8, info.sy, { size: 14, align: 'left', color: C.text });
  if (callout) E.text(callout.text, E.w / 2, sf.top + 60, { size: 24, weight: '800', color: C.text, alpha: clamp(callout.t / 0.3, 0, 1) });
}

// ---------- Scenes ----------

const newSeed = () => (Math.random() * 2 ** 32) >>> 0; // the seed is setup; the flight itself never draws randomness

const menu = {
  render(ctx, E) {
    const C = T.color, v = view(E);
    drawWorld(ctx, E, v, newCamera(v.vw), null, null, false);
    const cy = E.h * 0.26;
    E.text('LAUNCH', E.w / 2, cy, { size: 44, weight: '800', color: C.text });
    E.text(`Best ${E.save.get('best', 0)} m    Coins ${E.save.get('coins', 0)}`, E.w / 2, cy + 40, { size: 16, color: C.dim });
    this.btnPlay = E.button('Play', E.w / 2, E.h * 0.58, { w: 220, h: 56 });
    this.btnMute = E.button(E.audio.muted ? 'Sound: off' : 'Sound: on', E.w / 2, E.h * 0.58 + 64, { fill: '#334155', w: 160, h: 44, size: 16 });
  },
  onTap(p, E) {
    if (this.btnPlay && E.hit(this.btnPlay, p)) { E.audio.play('tap'); E.setScene('play'); }
    else if (this.btnMute && E.hit(this.btnMute, p)) { E.audio.toggleMute(); E.audio.play('tap'); }
  },
  onKey(k, E) { if (k === ' ' || k === 'Enter') E.setScene('play'); },
};

const play = {
  enter(E, params = {}) {
    S.seed = params.seed ?? newSeed();
    S.run = null; S.pull = null; S.key = null; S.endT = 0; S.callout = null; S.frameReal = performance.now(); S.pid = null; S.spaceDown = false;
    S.st = stats(); S.cam = newCamera(view(E).vw); S.nudge = 0;
    S.hint = E.save.get('flights', 0) === 0 && !S.pulled; // a fresh save's first launch, until the first pull begins
  },
  stamp(r) { return flightTime(r) + r.acc + Math.min(0.05, Math.max(0, (performance.now() - S.frameReal) / 1000)); },
  launch(E, l) {
    S.run = newRun(S.seed, l);
    S.pull = null; S.key = null;
    E.audio.play('hit', 0.4);
  },
  update(dt, E) {
    S.frameReal = performance.now();
    const r = S.run;
    if (S.callout) { S.callout.t -= dt; if (S.callout.t <= 0) S.callout = null; }
    if (S.nudge > 0) S.nudge -= dt;
    cameraStep(S.cam, r, view(E).vw, dt);
    if (!r) return;
    if (S.spaceDown && !E.keys.has(' ')) { // key repeat is ignored: one pulse per press, a held key is the Rocket's hold
      S.spaceDown = false;
      if (r.st.hold && !r.ended) queueInput(r, this.stamp(r), 'holdOff');
    }
    advance(r, dt);
    for (const e of r.ev) this.onEvent(e, E);
    r.ev.length = 0;
    if (r.ended) { S.endT += dt; if (S.endT >= T.endDelay) E.setScene('over', finishFlight(E, r)); }
  },
  onEvent(e, E) {
    if (e.k === 'spring') E.audio.play('hit');
    else if (e.k === 'bird') E.audio.play('coin', 0.6);
    else if (e.k === 'boost') E.audio.play('tap', 0.3);
    else if (e.k === 'mud') E.audio.play('miss');
    else if (e.k === 'milestone') { E.audio.play('win'); S.callout = { text: `${e.m} m!`, t: T.calloutLife }; }
    else if (e.k === 'stop' && !S.run.stars.length) E.audio.play('lose', 0.3);
    if ((e.k === 'spring' || e.k === 'bird') && e.chain >= 2) S.callout = { text: `Chain x${T.chainSteps[Math.min(e.chain, T.chainSteps.length - 1)]}`, t: 0.8 };
  },
  onPointerDown(p, E) {
    const r = S.run;
    if (!r) { if (S.pid === null) { S.pid = p.id; S.pull = { sx: p.x, sy: p.y, dx: 0, dy: 0 }; S.hint = false; S.pulled = true; } return; }
    if (r.ended) return;
    const at = this.stamp(r);
    queueInput(r, at, 'pulse');
    if (r.st.hold) { S.pid = p.id; queueInput(r, at + T.holdDelay, 'holdOn'); }
  },
  onPointerMove(p) {
    if (S.run || !S.pull || p.id !== S.pid) return;
    S.pull.dx = p.x - S.pull.sx; S.pull.dy = p.y - S.pull.sy;
  },
  onPointerUp(p, E) {
    if (p.id !== S.pid) return;
    S.pid = null;
    const r = S.run;
    if (r) { if (!r.ended) queueInput(r, this.stamp(r), 'holdOff'); return; }
    const pull = S.pull; S.pull = null;
    if (!pull || p.cancelled) return;
    const l = launchFromDrag(p.x - pull.sx, p.y - pull.sy);
    if (l) this.launch(E, l);
    else S.nudge = T.nudgeLife;
  },
  onKey(k, E) {
    const r = S.run;
    if (!r) {
      S.key = S.key || { angle: 40, power: 1 };
      S.hint = false;
      if (k === 'ArrowUp') S.key.angle = Math.min(T.launchAngleMax, S.key.angle + 1);
      else if (k === 'ArrowDown') S.key.angle = Math.max(T.launchAngleMin, S.key.angle - 1);
      else if (k === 'ArrowRight') S.key.power = Math.min(1, +(S.key.power + 0.05).toFixed(2));
      else if (k === 'ArrowLeft') S.key.power = Math.max(0.2, +(S.key.power - 0.05).toFixed(2));
      else if (k === ' ') { S.spaceDown = true; this.launch(E, S.key); }
      return;
    }
    if (k === ' ' && !r.ended && !S.spaceDown) {
      S.spaceDown = true;
      const at = this.stamp(r);
      queueInput(r, at, 'pulse');
      if (r.st.hold) queueInput(r, at + T.holdDelay, 'holdOn');
    }
  },
  render(ctx, E) {
    const v = view(E), r = S.run;
    let pull = null, short = false;
    const l = S.pull ? launchFromDrag(S.pull.dx, S.pull.dy) : S.key;
    if (!r && (S.pull || S.key)) {
      const raw = S.pull ? Math.hypot(S.pull.dx, S.pull.dy) : S.key.power * T.pullMax;
      const L = Math.min(raw, T.pullMax) / T.pullMax, a = l ? l.angle * DEG : 0;
      short = !!S.pull && raw < T.dragDead;
      pull = { px: -Math.cos(a) * L * T.pullVisual, py: Math.max(4 - T.slingH, -Math.sin(a) * L * T.pullVisual), arc: l ? previewArc(l) : null, full: raw >= T.pullMax };
    }
    const info = drawWorld(ctx, E, v, S.cam, r, pull, S.hint && !r && !S.pull);
    drawHud(E, r, r ? r.fuel : S.st.fuelMax, r ? r.st.fuelMax : S.st.fuelMax, r ? info : null, S.callout);
    if (!r && (short || S.nudge > 0)) E.text('Pull further', info.sx, info.sy - 34, { size: 16, color: T.color.text, alpha: short ? 1 : clamp(S.nudge / 0.3, 0, 1) });
  },
  onPause() { /* a flight is short: closing mid-flight discards it (PRD section 3) */ },
};

const over = {
  enter(E, p) {
    this.p = p; this.t0 = E.time;
    if (p.stars.length) E.audio.play('coin', 0.5);
  },
  ready(E) { return E.time - this.t0 >= T.cardGrace; }, // boost taps still landing must not dismiss the card
  render(ctx, E) {
    const C = T.color, v = view(E), p = this.p, sf = E.safe;
    if (S.run) drawWorld(ctx, E, v, S.cam, S.run, null, false);
    ctx.fillStyle = 'rgba(15,17,21,0.55)'; ctx.fillRect(0, 0, E.w, E.h);
    const aw = E.w - sf.left - sf.right, ah = E.h - sf.top - sf.bottom;
    const pw = Math.min(440, aw - 32), ph = Math.min(310, ah - 24), px = sf.left + (aw - pw) / 2, py = sf.top + (ah - ph) / 2;
    E.roundRect(px, py, pw, ph, 18, C.panel, '#334155');
    const cx = px + pw / 2;
    E.text(p.why === 'mud' ? 'Stuck in mud' : 'Flight over', cx, py + 30, { size: 16, color: C.dim });
    E.text(`${p.m} m`, cx, py + 70, { size: 44, weight: '800', color: C.text });
    E.text(p.isNew ? 'New best!' : `Best ${p.best} m`, cx, py + 108, { size: 16, color: p.isNew ? C.teal : C.dim });
    E.text(`+${p.coins} coins${p.chainMax ? `   best chain x${T.chainSteps[Math.min(p.chainMax, T.chainSteps.length - 1)]}` : ''}`, cx, py + 136, { size: 18, color: C.text });
    const n = T.milestones.length, gap = Math.min(76, (pw - 40) / n);
    T.milestones.forEach((ms, i) => {
      const x = cx + (i - (n - 1) / 2) * gap, got = p.stars.includes(ms);
      E.text(got ? '★' : '☆', x, py + 170, { size: 20, color: got ? C.text : '#4b5567' });
      E.text(ms >= 1000 ? `${ms / 1000}k` : `${ms}`, x, py + 192, { size: 14, color: got ? C.text : '#4b5567' });
    });
    E.text(`Seed ${p.seed}`, px + pw - 14, py + 20, { size: 14, align: 'right', color: '#6b7587' });
    this.btnMenu = E.button('Menu', px + 14 + 40, py + 26, { w: 80, h: 44, size: 15, fill: '#334155' });
    this.btnAgain = E.button('Launch Again', cx, py + ph - 42, { w: Math.min(260, pw - 40), h: 56 });
  },
  onTap(p, E) {
    if (!this.ready(E)) return;
    if (this.btnAgain && E.hit(this.btnAgain, p)) { E.audio.play('tap'); E.setScene('play'); }
    else if (this.btnMenu && E.hit(this.btnMenu, p)) E.setScene('menu');
  },
  onKey(k, E) { if ((k === ' ' || k === 'Enter') && this.ready(E)) E.setScene('play'); },
};

export const game = {
  slug: 'launch',
  title: 'Launch',
  saveVersion: 2,
  // v1 was the skeleton demo (Tap Rush): its score-based best and runs mean nothing here.
  migrate(data, fromVersion) {
    if (fromVersion < 2) { delete data.best; delete data.runs; }
    return data;
  },
  TUNING,
  experiments: [
    { key: 'launchSpeedMax', label: 'Launch speed', min: 500, max: 900, step: 10 },
    { key: 'springBounce', label: 'Spring bounce', min: 1, max: 1.6, step: 0.05 },
    { key: 'boostPulse', label: 'Boost pulse', min: 60, max: 180, step: 5 },
    { key: 'airDrag', label: 'Air drag', min: 0, max: 0.1, step: 0.005 },
  ],
  // Read by tools/sim-launch.mjs so the harness runs the real physics.
  sim: { STEP, FIRST_CHUNK, CHUNKS, tierAt, makeField, ensureField, groundAt, birdX, stats, launchFromDrag, newRun, stepRun, advance, queueInput, metres, coinsOf, predictLanding, newCamera, cameraStep, toView },
  start: 'menu',
  scenes: { menu, play, over },
};
