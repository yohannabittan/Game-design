// Launch, layer 1: the mechanic in grey box.
// Pull the slingshot from anywhere, release, tap to boost, bounce off springs and birds, stop or stick in mud; a card.
// World units: x to the right from the slingshot fork, y is height above the ground (10 units = 1 m). The critter's
// y is the bottom of its body. Physics runs in fixed steps with inputs stamped in flight time, so the same seed,
// launch and input times give the same flight at any frame rate (ADR-0008). tools/sim-launch.mjs drives game.sim.

import { makeRng, clamp, ease } from './engine.js';

const TUNING = {
  bg: '#2d2238',
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

  // The shop (PRD section 8): four upgrades, three levels each, bought with coins between flights. The play scene flies at
  // the saved levels; `upgrades` is the harness's default set (tools/sim-launch.mjs flies every set through the real physics).
  upgradePrices: {         // coins for levels 1, 2, 3 of each upgrade (PRD 50, 150, 400 for all: see the changelog)
    band: [300, 450, 650],
    fuel: [1100, 1300, 1500], // Fuel is the strongest buy per level: priced so it is not always the first one
    aero: [300, 500, 700],
    rocket: [380, 550, 750],
  },
  upgradeMax: 3,
  upgrades: { band: 0, fuel: 0, aero: 0, rocket: 0 },
  bandStep: 0.12,          // launchSpeedMax x (1 + 0.12 per level)
  fuelStep: 2,             // pulses per level
  aeroStep: 0.2,           // airDrag x (1 - 0.2 per level)
  rocketThrust: 330,       // hold-to-boost acceleration at Rocket 1 (units/s²)
  rocketStep: 0.25,        // thrust x (1 + 0.25 per level above 1)
  holdFuelRate: 1.5,       // pulses of fuel burned per second of hold: 330 / 1.5 = 220 of push per fuel, twice a tap's 110
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
  cardGrace: 0.4,          // seconds the card ignores taps after it appears (the card has slid in by then)
  nudgeLife: 1.2,          // seconds "Pull further" stays after a too-short drag

  // Art (layer 5; docs/games/launch/style.md): "flat round shapes, warm sky, soft shadows, one orange hero".
  // The critter is the only orange; teal is good (springs, birds); dark brown with a light rim is danger (mud).
  // Every play object has an ink outline so it reads on the light day sky, and a fill that reads on the night sky.
  palette: {
    skyDay: ['#fff1dc', '#f5c1c6'],   // horizon (at the ground band), top of the view
    skyDusk: ['#f3a9b8', '#8f6fb0'],
    skyNight: ['#4a3a78', '#1d1a3a'],
    hillFar: '#ecc0c4', hillNear: '#dca5b3',
    grass: '#7fae6a', soil: '#5f8a58',
    ink: '#2d2238',                    // outlines, ticks, text on light ground
    critter: '#ff8a1a', critterLight: '#ffb366', eye: '#ffffff',
    teal: '#1ea896', tealLight: '#7fe0d2', tealSpent: '#8fb3ad', coil: '#d8d2e4',
    mud: '#3d2414', mudRim: '#f0d2ae',
    ramp: '#b3a7c9', rampPlank: '#8e82a8',
    wood: '#b98b5e', rubber: '#6b3a6e', rubberTaut: '#d6336c',
    star: '#fff6e0', coin: '#ffd84d',  // accent one: coins, stars, beaks
    button: '#6b5aa6', buttonOff: '#4a3f5e', // accent two: buttons
    panel: 'rgba(45,34,56,0.84)', panelSolid: '#2d2238', panelEdge: '#5a4a72',
    text: '#fff6ec', textDim: '#cbbfdc', textOff: '#8f84a3',
    shadow: 'rgba(45,34,56,0.28)', dust: '#efe2cf', flame: '#fff2b0', white: '#ffffff', halo: '#fff6ec',
  },
  duskAt: 120,             // metres of altitude at the top of the view where the sky is dusk ...
  nightAt: 300,            // ... and night, with stars
  hillFadeLift: 40,        // metres the sky has panned up by when the hills are gone
  style: { line: 2, radius: 14 }, // outline width (design px at zoom 1) and panel corner radius (CSS px)
  type: { sm: 14, md: 18, lg: 28, xl: 44 }, // one weight rule: numbers and titles '800', words '600'

  // Juice (layer 3): all cosmetic, never read by the physics.
  juice: {
    particleCap: 160,
    pullSquash: 0.22,      // critter stretch along the pull at full power
    creakStep: 0.1,        // power change between creak ticks while pulling
    snapTime: 0.22, kick: 3, kickTime: 0.12, dust: 10,
    flame: 7, flameLife: 0.35, gaugePop: 0.25,
    landSquash: 0.35, squashTime: 0.28,
    springPop: 0.3, speedLines: 0.45, boingLife: 0.8,
    feathers: 12, tumbleTime: 1.3,
    chainPop: 0.35, chainLife: 1.0, coins: [0, 3, 5, 8],
    splat: 16, mudShake: 6, mudShakeTime: 0.25,
    bannerTime: 1.8, countUp: 0.6, cardSlide: 0.35,
    holdHint: 3,           // seconds "Hold to boost" shows on the first flight after buying Rocket 1
    stars: 90,
    haptic: { launch: 12, boost: 6, spring: 10, bird: 8, mud: 30, milestone: 20 },
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
    { kind: 'spring', x: 1500, y: 0, w: 820 },
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
function previewArc(launch, st) {
  const sp = launch.power * st.launchSpeed, a = launch.angle * DEG, pts = [];
  let x = 0, y = T.slingH, vx = sp * Math.cos(a), vy = sp * Math.sin(a);
  const n = Math.round(T.previewTime / STEP);
  for (let i = 1; i <= n; i++) {
    vy -= T.gravity * STEP; vx *= st.dragK; vy *= st.dragK; x += vx * STEP; y += vy * STEP;
    if (i % 6 === 0) pts.push([x, Math.max(0, y)]);
  }
  return pts;
}

// ---------- Save ----------
// v4: { best: metres, coins, ms: [milestone metres ever passed], flights, up: { band, fuel, aero, rocket }, holdTaught }

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
  const up = r.up;
  E.ledger.add('flight', { m, why: r.ended, coins: earned, bonus, chain: r.chainMax, ms: r.stars.join('/') || 'none', springs: r.springs, birds: r.birds, pulses: r.pulses,
    angle: +r.launch.angle.toFixed(1), power: +r.launch.power.toFixed(2), up: `b${up.band}f${up.fuel}a${up.aero}r${up.rocket}`, seed: r.seed });
  return { m, best: Math.max(best, m), isNew: m > best, coins: earned, bonus, chainMax: r.chainMax, stars: r.stars.slice(), firsts, seed: r.seed, why: r.ended };
}

// ---------- Shop ----------
// Save: `up` holds the bought level of each upgrade (0 to upgradeMax); coins are spent from `coins`.

const UPGRADES = [{ id: 'band', name: 'Band' }, { id: 'fuel', name: 'Fuel' }, { id: 'rocket', name: 'Rocket' }, { id: 'aero', name: 'Aero' }];
const levelsOf = (E) => ({ ...T.upgrades, ...E.save.get('up', {}) });

// What buying level `lvl` (1 to upgradeMax) of an upgrade does, in plain words.
function effectText(id, lvl) {
  if (id === 'band') return `+${Math.round(T.bandStep * 100)}% launch speed`;
  if (id === 'fuel') return `+${T.fuelStep} fuel pulses`;
  if (id === 'aero') return `${Math.round(T.aeroStep * 100)}% less air drag`;
  const k = T.rocketThrust / T.holdFuelRate / T.boostPulse;
  return lvl === 1 ? (Math.abs(k - 2) < 0.01 ? 'Hold to boost: twice the push per fuel' : `Hold to boost: +${Math.round((k - 1) * 100)}% push per fuel`) : `+${Math.round(T.rocketStep * 100)}% hold thrust`;
}

function buy(E, id) {
  const up = levelsOf(E), lvl = up[id], price = T.upgradePrices[id][lvl], coins = E.save.get('coins', 0);
  if (lvl >= T.upgradeMax || coins < price) return false;
  E.save.set('coins', coins - price);
  E.save.set('up', { ...up, [id]: lvl + 1 });
  E.ledger.add('buy', { up: id, level: lvl + 1, price, coins: coins - price });
  return true;
}

const shop = {
  enter(E, p = {}) { this.from = p.from || 'menu'; this.card = p.card || null; this.cells = []; },
  render(ctx, E) {
    const sf = E.safe, left = sf.left + 16, right = E.w - sf.right - 16, top = sf.top + 8;
    const grad = ctx.createLinearGradient(0, 0, 0, E.h); grad.addColorStop(0, P.skyDusk[1]); grad.addColorStop(1, P.skyNight[1]);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, E.w, E.h);
    this.btnBack = btn(E, 'Back', left + 40, top + 22, { w: 80, h: 44, size: 15, fill: P.buttonOff });
    E.text('Shop', E.w / 2, top + 22, { size: TY.lg, weight: '800', color: P.text });
    const coins = E.save.get('coins', 0), up = levelsOf(E);
    E.text(`${coins} coins`, right, top + 22, { size: TY.md, align: 'right', color: P.coin, weight: '800' });
    const gy = top + 56, gap = 12, cw = (right - left - gap) / 2, ch = (E.h - sf.bottom - 12 - gy - gap) / 2;
    this.cells = UPGRADES.map((u, i) => {
      const x = left + (i % 2) * (cw + gap), y = gy + Math.floor(i / 2) * (ch + gap), lvl = up[u.id], max = lvl >= T.upgradeMax;
      const price = max ? 0 : T.upgradePrices[u.id][lvl], can = !max && coins >= price;
      E.roundRect(x, y, cw, ch, T.style.radius, P.panel, P.panelEdge);
      E.text(u.name, x + 14, y + 22, { size: TY.md, weight: '800', align: 'left', color: P.text });
      for (let k = 0; k < T.upgradeMax; k++) E.roundRect(x + cw - 16 - (T.upgradeMax - k) * 22, y + 14, 16, 16, 4, k < lvl ? P.teal : P.panelSolid, P.panelEdge);
      E.text(max ? 'Fully upgraded' : `Level ${lvl + 1}: ${effectText(u.id, lvl + 1)}`, x + 14, y + 50, { size: TY.sm, align: 'left', color: max ? P.textDim : P.text, weight: '600' });
      if (max) return { u, btn: null };
      E.text(`${price} coins`, x + 14, y + ch - 26, { size: 16, align: 'left', color: can ? P.coin : P.textOff, weight: '800' });
      const b = btn(E, 'Buy', x + cw - 14 - 48, y + ch - 26, { w: 96, h: 44, size: 16, fill: can ? P.button : P.buttonOff, color: can ? P.text : P.textOff });
      return { u, btn: b };
    });
  },
  onTap(p, E) {
    if (this.btnBack && E.hit(this.btnBack, p)) { E.setScene(this.from, this.card ? { ...this.card, again: true } : {}); return; }
    for (const c of this.cells) if (c.btn && E.hit(c.btn, p)) { if (buy(E, c.u.id)) E.audio.play('coin'); else E.audio.play('miss', 0.3); }
  },
  onKey(k, E) { if (k === 'Escape') E.setScene(this.from, this.card ? { ...this.card, again: true } : {}); },
};

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

const P = T.palette, J = T.juice, TY = T.type;

function view(E) {
  const s = Math.min(E.w / T.designW, E.h / T.designH);
  return { s, oy: (E.h - T.designH * s) / 2, vw: E.w / s };
}

// S: the play scene's state; S.fx: cosmetic effects in world units (particles, tumbling birds, words), capped.
const S = { run: null, cam: null, seed: 0, fx: [], sq: { amt: 0, t: 0 } };

function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(a, b, t) { const x = hexRgb(a), y = hexRgb(b); return `rgb(${Math.round(x[0] + (y[0] - x[0]) * t)},${Math.round(x[1] + (y[1] - x[1]) * t)},${Math.round(x[2] + (y[2] - x[2]) * t)})`; }
// The sky at an altitude (metres at the top of the view): horizon and top colours, and how far into the night it is.
function skyAt(alt) {
  const d = clamp((alt - 30) / (T.duskAt - 30), 0, 1), n = clamp((alt - T.duskAt) / (T.nightAt - T.duskAt), 0, 1);
  if (n > 0) return { h: mix(P.skyDusk[0], P.skyNight[0], n), t: mix(P.skyDusk[1], P.skyNight[1], n), night: n };
  return { h: mix(P.skyDay[0], P.skyDusk[0], d), t: mix(P.skyDay[1], P.skyDusk[1], d), night: 0 };
}

let STARS = null; // cosmetic star field, made once
function stars() {
  if (!STARS) STARS = Array.from({ length: J.stars }, () => ({ x: Math.random(), y: Math.random() * 0.8, r: 0.6 + Math.random() * 1.2, tw: Math.random() * 6 }));
  return STARS;
}

// Rolling hills: a sum of two sines, scrolled at `par` of the camera; heights in design px.
function hillY(x, seed) { return Math.sin(x * 0.006 + seed) * 0.5 + Math.sin(x * 0.0137 + seed * 2.1) * 0.35 + 0.5; }

function drawWorld(ctx, E, v, c, r, pull, hint) {
  const s = v.s, z = c.z, lw = T.style.line * s;
  const X = (wx) => (wx - c.x) * z * s, Y = (wy) => v.oy + (T.groundY - (wy - c.y) * z) * s;
  const gy = v.oy + T.groundY * s, lift = c.y * z * s, liftM = c.y / T.unitsPerMetre;
  const sprite = Math.max(z, T.spriteMin);
  const alt = (c.y + T.groundY / z) / T.unitsPerMetre, sky = skyAt(alt);

  // Sky, stars, hills.
  const grad = ctx.createLinearGradient(0, 0, 0, gy);
  grad.addColorStop(0, sky.t); grad.addColorStop(1, sky.h);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, E.w, gy);
  if (sky.night > 0) {
    ctx.fillStyle = P.star;
    for (const st of stars()) {
      ctx.globalAlpha = sky.night * (0.6 + 0.4 * Math.sin(E.time * 2 + st.tw));
      const sx = (((st.x * E.w - c.x * z * s * 0.02) % E.w) + E.w) % E.w;
      ctx.fillRect(sx, st.y * gy, st.r * s, st.r * s);
    }
    ctx.globalAlpha = 1;
  }
  const hillA = (1 - clamp(liftM / T.hillFadeLift, 0, 1)) * (1 - sky.night);
  if (hillA > 0.01) {
    for (const [par, amp, base, col, seed] of [[0.15, 46, 70, P.hillFar, 1.3], [0.35, 34, 40, P.hillNear, 4.1]]) {
      ctx.globalAlpha = hillA; ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(0, gy);
      const off = c.x * z * par, drop = lift * 0.6;
      for (let px = 0; px <= E.w + 24 * s; px += 24 * s) ctx.lineTo(px, gy + drop - (base + amp * hillY((px / s + off), seed)) * s);
      ctx.lineTo(E.w, gy); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // The ground band: grass edge, soil, distance ticks every 10 m and labels every 50 m.
  ctx.fillStyle = P.soil; ctx.fillRect(0, gy, E.w, E.h - gy);
  ctx.fillStyle = P.grass; ctx.fillRect(0, gy, E.w, 12 * s);
  const u10 = 10 * T.unitsPerMetre, span = v.vw / z;
  ctx.fillStyle = P.ink; ctx.globalAlpha = 0.45;
  for (let wx = Math.floor(c.x / u10) * u10; wx < c.x + span + u10; wx += u10) {
    if (wx < 0) continue;
    const big = wx % (5 * u10) === 0;
    ctx.fillRect(X(wx) - 1, gy + 12 * s, 2, (big ? 10 : 5) * s);
  }
  ctx.globalAlpha = 1;
  for (let wx = Math.ceil(c.x / (5 * u10)) * 5 * u10; wx < c.x + span + u10; wx += 5 * u10) if (wx > 0) E.text(`${wx / T.unitsPerMetre} m`, X(wx), gy + 34 * s, { size: TY.sm, color: P.text, weight: '600' });

  // The slingshot: a wooden fork with a rubber band (drawn behind the critter, band in front).
  const fx = X(0), fy = (h) => gy - h * z * s, forkTop = fy(T.slingH + 14), forkMid = fy(T.slingH - 6), fw = 9 * s * z;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [w, col] of [[7 * s * z + 2 * lw, P.ink], [7 * s * z, P.wood]]) {
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(fx, gy + 2 * s); ctx.lineTo(fx, forkMid); ctx.lineTo(fx - fw, forkTop); ctx.moveTo(fx, forkMid); ctx.lineTo(fx + fw, forkTop); ctx.stroke();
  }

  if (r) {
    const f = r.field, t = flightTime(r), x0 = c.x - 400, x1 = c.x + span + 400;
    for (const g of f.ground) {
      if (g.x1 < x0 || g.x0 > x1) continue;
      if (g.kind === 'spring') drawSpring(ctx, X(g.x0), gy, g.w * z * s, s, g.spent, S.pops.get(g));
      else if (g.kind === 'mud') drawMud(ctx, X(g.x0), gy, g.w * z * s, s, E.time);
      else if (g.kind === 'ramp') drawRamp(ctx, X(g.x0), gy, g.w * z * s, g.h * z * s, s, lw);
    }
    for (const b of f.birds) {
      if (b.hit || b.x0 < x0 || b.x0 > x1) continue;
      const by = Y(b.y);
      if (by < gy - 4 * s) drawBird(ctx, X(birdX(b, t)), by, s * sprite, E.time + b.phase, Math.cos((t / T.birdPeriod) * Math.PI * 2 + b.phase) >= 0 ? -1 : 1, 0);
    }
  }

  if (hint) { // a fresh save's first launch: a ghost thumb pulling back and down, behind the critter
    const k = (E.time % 1.6) / 1.2;
    if (k <= 1) {
      const hx = X(0) + (90 - 80 * k) * s, hy = gy - (T.slingH + 60) * s + 60 * k * s;
      ctx.globalAlpha = 0.55 * Math.sin(Math.PI * k);
      ctx.fillStyle = P.white; ctx.strokeStyle = P.ink; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.arc(hx, hy, 16 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }

  // The critter: in the pocket while pulling, else where the run has it.
  let cx, cy;
  if (pull) { cx = pull.px; cy = T.slingH + pull.py; }
  else if (r) { cx = r.x; cy = r.y; }
  else { cx = 0; cy = T.slingH; }
  const rr = T.critterR * s * sprite, sx = X(cx), sy = Y(cy) - rr;
  // Soft shadow on the band while low.
  const hgt = cy * z * s;
  if (lift === 0 && hgt < 160 * s) { ctx.globalAlpha = 1 - hgt / (160 * s); ctx.fillStyle = P.shadow; ctx.beginPath(); ctx.ellipse(sx, gy + 2 * s, rr * 1.1, rr * 0.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  for (const e of S.fx) drawFx(ctx, E, e, X, Y, s, sprite, lw, true);
  if (pull && pull.arc) {
    ctx.fillStyle = P.white; ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5;
    for (const [px, py] of pull.arc) { ctx.beginPath(); ctx.arc(X(px), Y(py + T.critterR), 2.6 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  }
  if (lift > 0) { // panned sky: a dotted drop line from the critter to the band
    ctx.strokeStyle = sky.night > 0.5 ? P.star : P.ink; ctx.globalAlpha = 0.6; ctx.lineWidth = 1.5; ctx.setLineDash([3, 6]);
    ctx.beginPath(); ctx.moveTo(sx, sy + rr + 4); ctx.lineTo(sx, gy); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  // Speed lines after a spring.
  if (r && S.speedT > 0) {
    const sp = Math.hypot(r.vx, r.vy) || 1, ux = r.vx / sp, uy = -r.vy / sp;
    ctx.strokeStyle = P.white; ctx.lineWidth = 2 * s; ctx.globalAlpha = S.speedT / J.speedLines;
    for (let i = -1; i <= 1; i++) {
      const ox = -uy * i * rr * 0.7, oy = ux * i * rr * 0.7;
      ctx.beginPath(); ctx.moveTo(sx - ux * rr * 1.4 + ox, sy - uy * rr * 1.4 + oy); ctx.lineTo(sx - ux * rr * (2.6 + (i & 1)) + ox, sy - uy * rr * (2.6 + (i & 1)) + oy); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  // The band: plum rubber, red-pink and thicker when taut at full power; it twangs for a moment after the launch.
  if (pull || !r || S.snapT > 0) {
    const taut = pull && pull.full, snap = !pull && r ? S.snapT / J.snapTime : 0;
    const bx = pull || !r ? sx : fx + Math.sin(E.time * 60) * 10 * s * snap, by = pull || !r ? sy : forkTop + 4 * s;
    ctx.strokeStyle = taut ? P.rubberTaut : P.rubber; ctx.lineWidth = (taut ? 4 : 2.5) * s * Math.max(z, 0.7);
    ctx.beginPath(); ctx.moveTo(fx - fw, forkTop); ctx.lineTo(bx, by); ctx.lineTo(fx + fw, forkTop); ctx.stroke();
  }
  // Squash: stretched along the pull while aiming, flattened on a landing and wobbling back.
  let ang = 0, sqx = 1, sqy = 1;
  if (pull) { const p = pull.power || 0; ang = Math.atan2(-pull.py, -pull.px) || 0; sqx = 1 + J.pullSquash * p; sqy = 1 - J.pullSquash * 0.6 * p; }
  else if (S.sq.t > 0) { const k = S.sq.t / J.squashTime, w = S.sq.amt * k * Math.cos((1 - k) * Math.PI * 1.5); sqx = 1 + w; sqy = 1 - w; }
  else if (r && r.ended === 'mud') { sqx = 1 + J.landSquash; sqy = 1 - J.landSquash; }
  const look = r && !pull ? Math.atan2(-r.vy, r.vx) : pull ? Math.atan2(pull.py, -pull.px) * -1 : 0;
  drawCritter(ctx, sx, sy + (1 - sqy) * rr, rr, look, ang, sqx, sqy, lw);
  return { sx, sy, rr, height: cy, lifted: lift > 0, night: sky.night };
}

function drawSpring(ctx, x, gy, w, s, spent, pop) {
  const k = pop ? pop.t / J.springPop : 0; // 1 at the hit: compressed, then pops past rest
  const rest = (spent ? 4 : 10) * s, hgt = pop ? rest * (k > 0.6 ? 0.35 : 1 + 0.5 * Math.sin((1 - k / 0.6) * Math.PI)) : rest;
  ctx.strokeStyle = P.coil; ctx.lineWidth = 2.2 * s; ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i <= 5; i++) { const yy = gy - (hgt * i) / 5, xx = x + w * 0.3 + (i % 2 ? w * 0.4 : 0); if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); }
  ctx.stroke();
  const ph = 5 * s;
  roundRectPath(ctx, x, gy - hgt - ph, w, ph, ph / 2);
  ctx.fillStyle = spent ? P.tealSpent : P.teal; ctx.fill();
  ctx.strokeStyle = P.ink; ctx.lineWidth = T.style.line * s * 0.8; ctx.stroke();
  if (!spent) { ctx.fillStyle = P.tealLight; ctx.fillRect(x + ph, gy - hgt - ph + 1.2 * s, Math.max(0, w - 2 * ph), 1.4 * s); }
}

// Mud: a dark puddle (it reads on the light skies) with a light glossy rim (it reads on the night sky and on the grass).
function drawMud(ctx, x, gy, w, s, time) {
  roundRectPath(ctx, x, gy - 5 * s, w, 13 * s, 6 * s);
  ctx.fillStyle = P.mud; ctx.fill();
  ctx.strokeStyle = P.mudRim; ctx.lineWidth = 2.4 * s; ctx.beginPath(); ctx.moveTo(x + 5 * s, gy - 4.5 * s); ctx.lineTo(x + w - 5 * s, gy - 4.5 * s); ctx.stroke();
  ctx.fillStyle = P.mudRim;
  for (let i = 0; i < 2; i++) { const bx = x + w * (0.3 + 0.4 * i), br = (1.5 + Math.sin(time * 2 + i * 2) * 0.6) * s; ctx.beginPath(); ctx.arc(bx, gy + 2 * s, br, 0, Math.PI * 2); ctx.fill(); }
}

function drawRamp(ctx, x, gy, w, h, s, lw) {
  ctx.fillStyle = P.ramp; ctx.strokeStyle = P.ink; ctx.lineWidth = lw; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy - h); ctx.lineTo(x + w, gy); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = P.rampPlank; ctx.lineWidth = 1.5 * s;
  for (let i = 1; i < 4; i++) { const px = x + (w * i) / 4; ctx.beginPath(); ctx.moveTo(px, gy - 2 * s); ctx.lineTo(px, gy - (h * i) / 4 + 3 * s); ctx.stroke(); }
}

// A bird: a round teal body with an ink outline, a flapping wing, a yellow beak toward `dir` (-1 left, 1 right).
function drawBird(ctx, x, y, s, time, dir, rot) {
  const r = T.birdR * s * 0.75, flap = Math.sin(time * 14) * 0.9;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(dir, 1);
  ctx.lineJoin = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = T.style.line * s * 0.8;
  ctx.fillStyle = P.coin; ctx.beginPath(); ctx.moveTo(r * 0.8, -r * 0.2); ctx.lineTo(r * 1.6, 0); ctx.lineTo(r * 0.8, r * 0.25); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.strokeStyle = P.halo; ctx.lineWidth = T.style.line * s * 2.4; ctx.stroke();
  ctx.fillStyle = P.teal; ctx.strokeStyle = P.ink; ctx.lineWidth = T.style.line * s * 0.8; ctx.fill(); ctx.stroke();
  ctx.fillStyle = P.tealLight; ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.1); ctx.lineTo(r * 0.3, -r * 0.1); ctx.lineTo(-r * 0.3, -r * 0.1 - r * 1.3 * flap); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = P.eye; ctx.beginPath(); ctx.arc(r * 0.4, -r * 0.3, r * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(r * 0.5, -r * 0.3, r * 0.14, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// The hero: a round orange critter with an ink outline, a light cheek, and eyes that look where it is going.
function drawCritter(ctx, x, y, r, look, ang, sx, sy, lw) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(sx, sy); ctx.rotate(-ang);
  // A light halo outside the ink outline keeps the edge readable where the dusk sky is neither light nor dark.
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.strokeStyle = P.halo; ctx.lineWidth = (3 * lw) / Math.max(sx, sy); ctx.stroke();
  ctx.fillStyle = P.critter; ctx.strokeStyle = P.ink; ctx.lineWidth = lw / Math.max(sx, sy); ctx.fill(); ctx.stroke();
  ctx.fillStyle = P.critterLight; ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.4, r * 0.28, 0, Math.PI * 2); ctx.fill();
  const ex = Math.cos(look) * r * 0.3, ey = Math.sin(look) * r * 0.3;
  for (const ox of [-0.05, 0.42]) {
    ctx.fillStyle = P.eye; ctx.beginPath(); ctx.arc(ox * r + ex * 0.4, -r * 0.12 + ey * 0.4, r * 0.24, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(ox * r + ex * 0.7, -r * 0.12 + ey * 0.7, r * 0.12, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function roundRectPath(ctx, x, y, w, h, rad) {
  const r = Math.min(rad, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ---------- Effects ----------
// World-space and cosmetic only: particles (dust, flame, feathers, splat, coins), a tumbling bird, a floating word.

function emit(kind, x, y, n, o) {
  for (let i = 0; i < n; i++) {
    if (S.fx.length >= J.particleCap) S.fx.shift();
    const a = (o.angle ?? Math.PI / 2) + (Math.random() - 0.5) * (o.spread ?? Math.PI * 2), sp = (o.speed ?? 120) * (0.4 + Math.random() * 0.8);
    S.fx.push({ k: kind, x, y, vx: Math.cos(a) * sp + (o.vx || 0), vy: Math.sin(a) * sp + (o.vy || 0), g: o.g ?? -300, t: o.life ?? 0.5, max: o.life ?? 0.5, size: (o.size ?? 3) * (0.6 + Math.random() * 0.8), color: o.color });
  }
}
function word(text, x, y, size, life) { S.fx.push({ k: 'word', text, x, y, vx: 0, vy: 60, g: 0, t: life, max: life, size, color: P.text }); }

function updateFx(dt) {
  for (let i = S.fx.length - 1; i >= 0; i--) {
    const e = S.fx[i];
    e.t -= dt;
    if (e.t <= 0) { S.fx[i] = S.fx[S.fx.length - 1]; S.fx.pop(); continue; }
    e.vy += e.g * dt; e.x += e.vx * dt; e.y += e.vy * dt;
    if (e.k === 'tumble') e.rot += e.spin * dt;
  }
  for (const [g, p] of S.pops) { p.t -= dt; if (p.t <= 0) S.pops.delete(g); }
}

function drawFx(ctx, E, e, X, Y, s, sprite, lw) {
  const x = X(e.x), y = Y(e.y), k = e.t / e.max;
  if (e.k === 'tumble') { ctx.globalAlpha = Math.min(1, k * 2); drawBird(ctx, x, y, s * sprite, 0, 1, e.rot); ctx.globalAlpha = 1; return; }
  if (e.k === 'word') {
    const pop = k > 0.8 ? ease.outBack((1 - k) / 0.2) : 1;
    ctx.globalAlpha = Math.min(1, k * 3);
    ctx.fillStyle = P.panel; const w = e.text.length * e.size * 0.62 + 16; roundRectPath(ctx, x - w / 2, y - e.size * 0.8 * pop, w, e.size * 1.6 * pop, 10); ctx.fill();
    E.text(e.text, x, y, { size: Math.max(TY.sm, e.size * pop), weight: '800', color: e.color });
    ctx.globalAlpha = 1; return;
  }
  ctx.globalAlpha = Math.min(1, k * 1.5); ctx.fillStyle = e.color;
  const r = e.size * s * Math.max(0.5, k);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  if (e.k === 'coin') { ctx.strokeStyle = P.ink; ctx.lineWidth = 1.2; ctx.stroke(); }
  ctx.globalAlpha = 1;
}

// ---------- Sounds ----------
// Engine synth only (PRD section 12), through E.audio so the mute flag holds.
const SFX = {
  creak: (E, p) => E.audio.beep({ freq: 160 + 260 * p, dur: 0.05, type: 'triangle', gain: 0.05 }),
  launch: (E) => { E.audio.beep({ freq: 300, dur: 0.1, slide: 1.5, gain: 0.15 }); E.audio.noise({ dur: 0.06, gain: 0.1 }); },
  boost: (E) => { E.audio.noise({ dur: 0.12, gain: 0.1 }); E.audio.beep({ freq: 220, dur: 0.12, type: 'sine', slide: 2, gain: 0.06 }); },
  spring: (E) => { E.audio.beep({ freq: 1250, dur: 0.1, slide: 1.5 }); E.audio.beep({ freq: 420, dur: 0.18, type: 'sine', slide: 2.2, gain: 0.1 }); },
  bird: (E) => { E.audio.beep({ freq: 900, dur: 0.07, type: 'sawtooth', slide: 0.6, gain: 0.08 }); E.audio.beep({ freq: 1000, dur: 0.07, type: 'sawtooth', slide: 0.6, gain: 0.07, delay: 0.09 }); },
  chain: (E, n) => E.audio.beep({ freq: 520 * Math.pow(1.26, n), dur: 0.14, type: 'triangle', gain: 0.12 }),
};

// ---------- HUD ----------
// CSS px, inside all four safe insets; light text on ink pills so it reads on every sky.

function pill(E, text, x, y, size, align = 'center', color = P.text) {
  const ctx = E.ctx; ctx.font = `800 ${size}px system-ui, sans-serif`;
  const w = ctx.measureText(text).width + 20, h = size + 14, lx = align === 'right' ? x - w : align === 'left' ? x : x - w / 2;
  E.roundRect(lx, y - h / 2, w, h, h / 2, P.panel);
  E.text(text, lx + w / 2, y, { size, weight: '800', color });
  return { x: lx, y: y - h / 2, w, h };
}

function drawHud(E, r, fuel, fuelMax, info) {
  const sf = E.safe, right = E.w - sf.right - 12, top = sf.top + 10;
  const pop = S.distPop > 0 ? 1 + 0.3 * (S.distPop / 0.3) : 1;
  pill(E, `${r ? metres(r) : 0} m`, right, top + 20, Math.round(TY.lg * pop), 'right');
  if (r && r.chain > 0) {
    const k = S.chainT > 0 ? ease.outBack(clamp(1 - (S.chainT - (J.chainLife - J.chainPop)) / J.chainPop, 0, 1)) : 1;
    pill(E, `Chain x${mult(r)}`, right, top + 60, Math.max(TY.sm, Math.round((TY.sm + 3 * r.chain) * k)), 'right', P.tealLight);
  }
  const x0 = sf.left + 16, y0 = top + 32;
  E.roundRect(x0 - 8, top - 4, Math.max(64, fuelMax * 18 + 14), 54, T.style.radius, P.panel);
  E.text('Fuel', x0, top + 10, { size: TY.sm, align: 'left', color: P.textDim, weight: '600' });
  for (let i = 0; i < fuelMax; i++) {
    const k = clamp(fuel - i, 0, 1), popping = S.gaugePop > 0 && i === Math.floor(fuel + 1e-6);
    const g = popping ? 1 + 0.5 * (S.gaugePop / J.gaugePop) : 1, cx = x0 + i * 18 + 7, cy = y0 + 1;
    E.roundRect(cx - 7 * g, cy - 7 * g, 14 * g, 14 * g, 4, P.panelSolid, P.panelEdge);
    if (k > 0) E.roundRect(cx - 5, cy + 5 - 10 * k, 10, 10 * k, 3, P.coin);
  }
  if (info && info.lifted) pill(E, `${Math.round(info.height / T.unitsPerMetre)} m up`, info.sx + info.rr + 8, info.sy, TY.sm, 'left');
  if (S.banner) {
    const k = S.banner.t / J.bannerTime, inK = ease.outBack(clamp((1 - k) / 0.2, 0, 1)), a = clamp(k / 0.15, 0, 1);
    E.ctx.globalAlpha = a;
    pill(E, `★ ${S.banner.text}`, E.w / 2, sf.top + 22 + 40 * inK, TY.lg, 'center', P.coin);
    E.ctx.globalAlpha = 1;
  }
  if (S.holdT > 0) { E.ctx.globalAlpha = clamp(S.holdT / 0.3, 0, 1); pill(E, 'Hold to boost', E.w / 2, sf.top + 100, TY.md); E.ctx.globalAlpha = 1; }
}

// ---------- Scenes ----------

const newSeed = () => (Math.random() * 2 ** 32) >>> 0; // the seed is setup; the flight itself never draws randomness
const btn = (E, label, cx, cy, o = {}) => E.button(label, cx, cy, { fill: P.button, color: P.text, ...o });

const menu = {
  render(ctx, E) {
    const v = view(E);
    drawWorld(ctx, E, v, newCamera(v.vw), null, null, false);
    const cy = E.h * 0.26;
    E.text('LAUNCH', E.w / 2, cy, { size: TY.xl, weight: '800', color: P.ink });
    E.titleArea = { x: E.w / 2 - 110, y: cy - 30, w: 220, h: 60 }; // release: five taps on the title show TUNE
    pill(E, `Best ${E.save.get('best', 0)} m    Coins ${E.save.get('coins', 0)}`, E.w / 2, cy + 44, TY.sm);
    this.btnPlay = btn(E, 'Play', E.w / 2, E.h * 0.58, { w: 220, h: 56 });
    this.btnShop = btn(E, 'Shop', E.w / 2 - 58, E.h * 0.58 + 64, { fill: P.panelSolid, w: 104, h: 44, size: 16 });
    this.btnMute = btn(E, E.audio.muted ? 'Sound: off' : 'Sound: on', E.w / 2 + 58, E.h * 0.58 + 64, { fill: P.panelSolid, w: 104, h: 44, size: 15 });
  },
  onTap(p, E) {
    if (this.btnPlay && E.hit(this.btnPlay, p)) { E.audio.play('tap'); E.setScene('play'); }
    else if (this.btnShop && E.hit(this.btnShop, p)) { E.audio.play('tap'); E.setScene('shop', { from: 'menu' }); }
    else if (this.btnMute && E.hit(this.btnMute, p)) { E.audio.toggleMute(); E.audio.play('tap'); }
  },
  onKey(k, E) { if (k === ' ' || k === 'Enter') E.setScene('play'); },
};

const play = {
  enter(E, params = {}) {
    S.seed = params.seed ?? newSeed();
    S.run = null; S.pull = null; S.key = null; S.endT = 0; S.frameReal = performance.now(); S.pid = null; S.spaceDown = false;
    S.up = levelsOf(E); S.st = stats(S.up); S.cam = newCamera(view(E).vw); S.nudge = 0;
    S.hint = E.save.get('flights', 0) === 0 && !S.pulled; // a fresh save's first launch, until the first pull begins
    S.fx.length = 0; S.pops = new Map(); S.sq = { amt: 0, t: 0 }; S.creak = 0;
    S.snapT = 0; S.speedT = 0; S.gaugePop = 0; S.distPop = 0; S.chainT = 0; S.banner = null; S.holdT = 0;
    S.teachHold = S.up.rocket >= 1 && !E.save.get('holdTaught', false);
  },
  stamp(r) { return flightTime(r) + r.acc + Math.min(0.05, Math.max(0, (performance.now() - S.frameReal) / 1000)); },
  launch(E, l) {
    S.run = newRun(S.seed, l, S.up);
    S.pull = null; S.key = null;
    SFX.launch(E); E.haptic(J.haptic.launch); E.shake(J.kick, J.kickTime);
    S.snapT = J.snapTime;
    emit('dust', 0, 0, J.dust, { angle: Math.PI / 2, spread: Math.PI * 0.9, speed: 90, g: -200, life: 0.5, size: 3, color: P.dust });
    if (S.teachHold) { S.holdT = J.holdHint; E.save.set('holdTaught', true); }
  },
  update(dt, E) {
    S.frameReal = performance.now();
    const r = S.run;
    for (const k of ['nudge', 'snapT', 'speedT', 'gaugePop', 'distPop', 'chainT', 'holdT']) if (S[k] > 0) S[k] -= dt;
    if (S.sq.t > 0) S.sq.t -= dt;
    if (S.banner) { S.banner.t -= dt; if (S.banner.t <= 0) S.banner = null; }
    updateFx(dt);
    cameraStep(S.cam, r, view(E).vw, dt);
    if (!r) return;
    if (S.spaceDown && !E.keys.has(' ')) { // key repeat is ignored: one pulse per press, a held key is the Rocket's hold
      S.spaceDown = false;
      if (r.st.hold && !r.ended) queueInput(r, this.stamp(r), 'holdOff');
    }
    advance(r, dt);
    for (const e of r.ev) this.onEvent(e, E);
    r.ev.length = 0;
    if (r.holding && Math.random() < 0.5) emit('flame', r.x, r.y + T.critterR, 1, { angle: Math.atan2(-r.vy, -r.vx), spread: 0.6, speed: 120, g: 0, life: J.flameLife, size: 3, color: P.flame });
    if (r.ended) { S.endT += dt; if (S.endT >= T.endDelay) E.setScene('over', finishFlight(E, r)); }
  },
  squash(amt) { S.sq = { amt: Math.min(J.landSquash, amt), t: J.squashTime }; },
  onEvent(e, E) {
    const r = S.run, cx = r.x, cy = r.y + T.critterR;
    if (e.k === 'spring') {
      SFX.spring(E); E.haptic(J.haptic.spring); this.squash(0.12 + r.vy / 2500); S.speedT = J.speedLines;
      const g = groundAt(r.field, r.x); if (g) S.pops.set(g, { t: J.springPop });
      word('Boing', r.x - 40, 70, TY.md, J.boingLife); // above the pad, behind the critter flying off
    } else if (e.k === 'bird') {
      SFX.bird(E); E.haptic(J.haptic.bird);
      emit('feather', cx, cy, J.feathers, { speed: 140, g: -120, life: 0.7, size: 2.6, color: P.tealLight });
      let b = null, d = Infinity; // the bird just hit, for its tumble
      for (const q of r.field.birds) if (q.hit && !q.tumbled && Math.abs(q.x0 - r.x) < d) { d = Math.abs(q.x0 - r.x); b = q; }
      if (b) { b.tumbled = true; S.fx.push({ k: 'tumble', x: birdX(b, flightTime(r)), y: b.y, vx: r.vx * 0.3, vy: -80, g: -500, t: J.tumbleTime, max: J.tumbleTime, rot: 0, spin: 9, size: 0 }); }
    } else if (e.k === 'boost') {
      SFX.boost(E); E.haptic(J.haptic.boost); S.gaugePop = J.gaugePop;
      emit('flame', r.x, r.y + T.critterR, J.flame, { angle: Math.atan2(-r.vy, -r.vx), spread: 0.7, speed: 160, g: 0, life: J.flameLife, size: 3.4, color: P.flame });
    } else if (e.k === 'bounce' || e.k === 'ramp') this.squash(0.1);
    else if (e.k === 'mud') {
      E.audio.play('miss'); E.haptic(J.haptic.mud); E.shake(J.mudShake, J.mudShakeTime);
      emit('splat', cx, 0, J.splat, { angle: Math.PI / 2, spread: Math.PI * 0.8, speed: 150, g: -400, life: 0.6, size: 3, color: P.mud });
    } else if (e.k === 'milestone') {
      E.audio.play('win'); E.haptic(J.haptic.milestone); S.banner = { text: `${e.m} m!`, t: J.bannerTime }; S.distPop = 0.3;
    } else if (e.k === 'stop') {
      this.squash(0.18);
      if (!r.stars.length) E.audio.play('lose', 0.3);
    }
    if ((e.k === 'spring' || e.k === 'bird') && e.chain >= 1) {
      S.chainT = J.chainLife;
      if (e.chain >= 2) SFX.chain(E, e.chain);
      emit('coin', cx, cy, J.coins[Math.min(e.chain, J.coins.length - 1)], { angle: Math.PI / 2, spread: 1.2, speed: 200, g: -500, life: 0.7, size: 3.2, color: P.coin });
    }
  },
  onPointerDown(p, E) {
    const r = S.run;
    if (!r) { if (S.pid === null) { S.pid = p.id; S.pull = { sx: p.x, sy: p.y, dx: 0, dy: 0 }; S.hint = false; S.pulled = true; S.creak = 0; } return; }
    if (r.ended) return;
    const at = this.stamp(r);
    queueInput(r, at, 'pulse');
    if (r.st.hold) { S.pid = p.id; queueInput(r, at + T.holdDelay, 'holdOn'); }
  },
  onPointerMove(p, E) {
    if (S.run || !S.pull || p.id !== S.pid) return;
    S.pull.dx = p.x - S.pull.sx; S.pull.dy = p.y - S.pull.sy;
    const pw = Math.min(1, Math.hypot(S.pull.dx, S.pull.dy) / T.pullMax);
    if (Math.abs(pw - S.creak) >= J.creakStep) { S.creak = pw; SFX.creak(E, pw); } // the band creaks as it stretches
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
      pull = { px: -Math.cos(a) * L * T.pullVisual, py: Math.max(4 - T.slingH, -Math.sin(a) * L * T.pullVisual), arc: l ? previewArc(l, S.st) : null, full: raw >= T.pullMax, power: l ? L : 0 };
    }
    const info = drawWorld(ctx, E, v, S.cam, r, pull, S.hint && !r && !S.pull);
    drawHud(E, r, r ? r.fuel : S.st.fuelMax, r ? r.st.fuelMax : S.st.fuelMax, r ? info : null);
    if (!r && (short || S.nudge > 0)) { E.ctx.globalAlpha = short ? 1 : clamp(S.nudge / 0.3, 0, 1); pill(E, 'Pull further', info.sx, info.sy - 40, TY.md); E.ctx.globalAlpha = 1; }
  },
  onPause(E) { // closing mid-flight discards it (PRD section 3); the ledger notes the quit
    const r = S.run;
    if (r && !r.ended) E.ledger.add('quit', { m: metres(r), t: +flightTime(r).toFixed(1), seed: r.seed });
  },
};

const over = {
  enter(E, p) {
    this.p = p; this.k = p.again ? 1 : 0; this.t0 = p.again ? -Infinity : E.time;
    if (!p.again) E.tween(J.cardSlide, (t) => { this.k = t; }, ease.outBack); // the card slides up; the buttons come after it
  },
  ready(E) { return this.k >= 1 && E.time - this.t0 >= T.cardGrace; }, // boost taps still landing must not dismiss the card
  render(ctx, E) {
    const v = view(E), p = this.p, sf = E.safe;
    if (S.run) drawWorld(ctx, E, v, S.cam, S.run, null, false);
    ctx.fillStyle = P.shadow; ctx.fillRect(0, 0, E.w, E.h);
    const aw = E.w - sf.left - sf.right, ah = E.h - sf.top - sf.bottom;
    const pw = Math.min(440, aw - 32), ph = Math.min(310, ah - 24), px = sf.left + (aw - pw) / 2;
    const py = sf.top + (ah - ph) / 2 + (1 - this.k) * (E.h - sf.top);
    E.roundRect(px, py, pw, ph, 18, P.panelSolid, P.panelEdge);
    const cx = px + pw / 2, count = clamp((E.time - this.t0 - J.cardSlide) / J.countUp, 0, 1);
    E.text(p.why === 'mud' ? 'Stuck in mud' : 'Flight over', cx, py + 30, { size: TY.sm + 2, color: P.textDim, weight: '600' });
    E.text(`${p.m} m`, cx, py + 70, { size: TY.xl, weight: '800', color: P.text });
    E.text(p.isNew ? 'New best!' : `Best ${p.best} m`, cx, py + 108, { size: TY.sm + 2, color: p.isNew ? P.tealLight : P.textDim, weight: '600' });
    E.text(`+${Math.round(p.coins * count)} coins${p.chainMax ? `   best chain x${T.chainSteps[Math.min(p.chainMax, T.chainSteps.length - 1)]}` : ''}`, cx, py + 136, { size: TY.md, color: P.coin, weight: '800' });
    const n = T.milestones.length, gap = Math.min(76, (pw - 40) / n);
    T.milestones.forEach((ms, i) => {
      const x = cx + (i - (n - 1) / 2) * gap, got = p.stars.includes(ms);
      E.text(got ? '★' : '☆', x, py + 170, { size: 20, color: got ? P.coin : P.textOff });
      E.text(ms >= 1000 ? `${ms / 1000}k` : `${ms}`, x, py + 192, { size: TY.sm, color: got ? P.text : P.textOff, weight: '600' });
    });
    E.text(`Seed ${p.seed}`, px + pw - 14, py + 20, { size: TY.sm, align: 'right', color: P.textOff, weight: '600' });
    if (!this.ready(E)) { this.btnMenu = this.btnAgain = this.btnShop = null; return; }
    this.btnMenu = btn(E, 'Menu', px + 14 + 40, py + 26, { w: 80, h: 44, size: 15, fill: P.buttonOff });
    const bw = Math.min(230, pw - 150);
    this.btnAgain = btn(E, 'Launch Again', px + 20 + bw / 2, py + ph - 42, { w: bw, h: 56 });
    this.btnShop = btn(E, `Shop (${E.save.get('coins', 0)})`, px + pw - 20 - 55, py + ph - 42, { w: 110, h: 56, size: 16, fill: P.buttonOff });
  },
  onTap(p, E) {
    if (!this.ready(E)) return;
    if (this.btnAgain && E.hit(this.btnAgain, p)) { E.audio.play('tap'); E.ledger.add('retry', { m: this.p.m, seed: this.p.seed }); E.setScene('play'); }
    else if (this.btnMenu && E.hit(this.btnMenu, p)) E.setScene('menu');
    else if (this.btnShop && E.hit(this.btnShop, p)) { E.audio.play('tap'); E.setScene('shop', { from: 'over', card: this.p }); }
  },
  onKey(k, E) { if ((k === ' ' || k === 'Enter') && this.ready(E)) { E.ledger.add('retry', { m: this.p.m, seed: this.p.seed }); E.setScene('play'); } },
};

export const game = {
  slug: 'launch',
  title: 'Launch',
  saveVersion: 4,
  // v1 was the skeleton demo (Tap Rush): its score-based best and runs mean nothing here. v2 is { best, coins, ms, flights }.
  // v3 adds `up`, the bought upgrade levels, all 0 for an older save (coins carry over to spend). v4 adds `holdTaught`,
  // false until the first flight with Rocket 1 has shown "Hold to boost" (an older save with Rocket 1 sees it once).
  migrate(data, fromVersion) {
    if (fromVersion < 2) { delete data.best; delete data.runs; }
    if (fromVersion < 3) data.up = { band: 0, fuel: 0, aero: 0, rocket: 0 };
    if (fromVersion < 4) data.holdTaught = false;
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
  sim: { STEP, FIRST_CHUNK, CHUNKS, tierAt, makeField, ensureField, groundAt, birdX, stats, launchFromDrag, newRun, stepRun, advance, queueInput, metres, coinsOf, previewArc, UPGRADES, effectText, predictLanding, newCamera, cameraStep, toView },
  start: 'menu',
  scenes: { menu, play, over, shop },
};
