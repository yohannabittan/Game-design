// Launch: a needle launch, then tap to boost, bounce off springs and birds, stop or stick in mud; a card with goals that pay.
// Before launch a needle sweeps a wedge at the launcher; a tap stops it and launches at its angle, with the power of the zone
// it stopped in (PRD v0.2 A). World units: x to the right from the slingshot fork, y is height above the ground (10 units =
// 1 m). The critter's y is the bottom of its body. Physics runs in fixed steps with inputs stamped in flight time, and the
// needle's angle is a function of the time since the launcher was ready, so the same seed, tap time and boost times give the
// same flight at any frame rate (ADR-0008). tools/sim-launch.mjs drives game.sim.

import { makeRng, clamp, ease } from './engine.js';

const TUNING = {
  bg: '#2d2238',
  designW: 640,            // landscape design space (ADR-0013); the world fills the width, the ground sits at groundY
  designH: 360,
  groundY: 300,            // design y of the ground line
  physicsStep: 1 / 120,

  // The needle launch (PRD v0.2 A): a triangle wave from needleMin up to needleMax and back in needlePeriod, starting at
  // the bottom. Zones are graded around sweetAngle; each zone launches at its share of launchSpeedMax (Band applied).
  needleMin: 10,           // degrees
  needleMax: 80,
  needlePeriod: 1.6,       // seconds for one sweep up and back, base Steady
  sweetAngle: 38,          // the gold, set on the real field (tools/sim-launch.mjs --rank): the ranking and the first-timer targets hold here
  zonePerfect: 3,          // degrees either side of sweetAngle
  zoneGreat: 8,
  zoneGood: 15,
  zoneScale: 1,            // every zone's width x this (the TUNE panel's one zone slider)
  zonePower: [1.2, 1.05, 0.8, 0.8], // Perfect, Great, Good, Weak at the Good edge (x launchSpeedMax, Band applied): above 1 launches
                           // past full power, so the launch carries the ranking (decision after Build 1 round 2)
  weakPowerMin: 0.55,      // Weak's power at the wedge's ends (it ramps up to zonePower Weak at the Good edge)
  perfectFuel: 2,          // free boost pulses for the flight after a Perfect launch (PRD 1: its payoff with boosts, amendment 1)
  readyGrace: 0.3,
  goalSlots: 3,            // goals active at a time (PRD v0.2 B)
  ticketCap: 3,            // reward tickets on the card before "+n more" (principle 11, rule 6)         // seconds after the launcher is ready when taps are ignored (a double tap on Launch Again)
  steadySlow: 0.12,        // Steady: needle speed x (1 - 0.12 per level)
  steadyWiden: 1,          // ... and every zone 1 degree wider each side per level

  // PRD section 16
  launchSpeedMax: 700,     // launch speed of a Perfect launch, base Band (units/s)
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
  milestoneBonus: [25, 50, 100, 200, 400],   // one-time sugar, first time each milestone is passed (coins are sugar since v0.2)

  // The shop (PRD section 8, v0.2 D): five upgrades, three levels each, bought with sugar between flights. The play scene flies
  // at the saved levels; `upgrades` is the harness's default set (tools/sim-launch.mjs flies every set through the real physics).
  upgradePrices: {         // sugar for levels 1, 2, 3 of each upgrade (PRD 50, 150, 400 for all: see the changelog)
    band: [450, 700, 1000],   // v0.2: half as much again, so the good profile clears the shop no sooner than flight 40 (amendment 5)
    fuel: [1650, 1950, 2250], // Fuel is the strongest buy per level: priced so it is not always the first one
    aero: [450, 750, 1050],
    rocket: [550, 850, 1100],
    steady: [400, 600, 900],
  },
  upgradeMax: 3,
  upgrades: { band: 0, fuel: 0, aero: 0, rocket: 0, steady: 0 },
  bandStep: 0.12,          // launchSpeedMax x (1 + 0.12 per level)
  fuelStep: 2,             // pulses per level
  aeroStep: 0.2,           // airDrag x (1 - 0.2 per level)
  rocketThrust: 330,       // hold-to-boost acceleration at Rocket 1 (units/s²)
  rocketStep: 0.25,        // thrust x (1 + 0.25 per level above 1)
  holdFuelRate: 1.5,       // pulses of fuel burned per second of hold: 330 / 1.5 = 220 of push per fuel, twice a tap's 110
  holdDelay: 0.15,         // a press held this long becomes a hold (the press itself already fired a pulse)

  // Flight rules the PRD states in words
  slingH: 36,              // launch height of the critter's bottom
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
  wedgeR: 104,             // the needle wedge's radius from the critter's centre (design px), and its hole
  wedgeHole: 22,
  wedgeFade: 0.3,          // seconds the wedge fades after the launch
  markEvery: 0.1,          // the landing marker is recomputed at most this often (seconds)
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
  endDelayTaught: 2.4,     // ... when the stop shows the mud call-out, so it can be read
  cardGrace: 0.4,          // seconds the card ignores taps after it appears (the card has slid in by then)

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
    mud: '#3d2414', mudDeep: '#23130a', mudRim: '#f0d2ae', // a sunk pit: dark body, deeper middle, light glossy streaks
    zones: ['#ffd84d', '#f59bc2', '#4a7fd4', '#584a70'], // Perfect gold, Great light rose, Good blue, Weak dark slate: never orange; a lightness ramp, so any two stay apart (CIE76 22 or more) under protan, deutan and tritan simulation
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
    snapTime: 0.22, kick: 3, kickTime: 0.12, dust: 10,
    flame: 7, flameLife: 0.35, gaugePop: 0.25,
    landSquash: 0.35, squashTime: 0.28,
    springPop: 0.3, speedLines: 0.45, boingLife: 0.8,
    feathers: 12, tumbleTime: 1.3,
    chainPop: 0.35, chainLife: 1.0, coins: [0, 3, 5, 8],
    splat: 16, mudShake: 6, mudShakeTime: 0.25,
    bannerTime: 1.8, countUp: 0.6, cardSlide: 0.35,
    holdHint: 3,           // seconds "Hold to boost" shows on the first flight after buying Rocket 1
    tapHint: 2.5,          // seconds "Tap to boost" shows from the top of a fresh save's first arc
    pipPulse: 0.6,         // the fuel pips pulse once with it
    zonePop: 1.1,          // seconds the zone's name shows by the launcher
    zoneFreq: [1320, 990, 740, 330], // the launch chime's pitch per zone
    zoneHaptic: [24, 16, 10, 6],
    sparks: 18,            // the Perfect launch's spark ring
    callout: 2.6,          // seconds a first-time call-out (bird, mud) shows
    springWobble: 0.3,     // an unspent spring's idle bob, as a share of its height (3 design px: visible at arm's length)
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

// The first chunk teaches, and it is laid out for this flight's launch range (Band and Aero change it), so no purchase can
// make the same needle stop worse (PRD v0.2 C and D; amendment 1 after the v4 release gate). It is a run of springs that
// pays the better stop more (amendment 1 after the Build 1 review), then the first mud:
//   spring A catches the first landing of every Good or better needle stop at every Steady level (a stop Steady lifts into
//   Good is caught too), and of the Weak stops next to Good;
//   a bird sits on the Perfect stop's way down after the last spring, where the critter is `birdHeight` up (its bounce
//   carries the gold on);
//   each spring catches the next landing, past the last spring, of the stops whose quality is within its `tier` (quality:
//   Perfect 0, Great 1, Good 2, Weak from 2 up by a tenth of the Good half-width per 1; the tiers tighten spring by spring,
//   so the better the stop, the longer the ride, and Weak next to Good rides a little: no cliff), never wider than `wMax`
//   (no stop lands twice on one spring), until `until`, then for Perfect stops only until `goldUntil`;
//   the first mud comes past `mudFrom`, where no unboosted Perfect stop touches the ground.
// The layout is found by flying the real physics (setup only: the same levels always give the same chunk).
// tools/sim-launch.mjs --clean proves it at every Band, Aero and Steady level, --rank ranks the zones on it.
const FIRST_CHUNK = {
  name: 'First flight',
  angleStep: 0.5,          // the needle stops (degrees apart) the layout is flown for
  tiers: [8, 4, 2],        // by spring (A first; the last repeats): the worst stop quality laid out for (2: every Good or better stop)
  taps: [],                // boost times (seconds): every stop is also flown with each of these sets of boosts ...
  tapExtra: 0,             // ... laid out as if this much better in quality (a boost carries a stop further)
  padA: [30, 40],          // units of spring A before the shortest and after the longest first landing
  pad: [30, 40],           // units of every later spring before and after the landings it catches
  gap: 60,                 // units of plain ground between springs, at least ...
  maxGap: 200,             // ... and at most (a longer stretch mid-run catches boosted flights short of the first place)
  wMax: 550,               // the widest a spring after A may be (units)
  until: 4500,             // springs are laid until one ends past this (units, scaled by the gold's throw): short of the first place ...
  goldUntil: 4500,         // ... then Perfect-only springs until one ends past this: the gold's longer ride
  birdHeight: 180,         // the critter's height on the way down where the bird meets it (units)
  mudW: 120,               // the first mud patch ...
  mudFrom: 7000,           // ... never before this (units): past where most good flights end, so it does not decide their distance
  exitW: 60,               // small springs (units wide): every `fillEvery` from the run's end to the mud, and one just past the mud
  fillEvery: 1200,
  mudClear: 60,            // ... and this far from any ground touch of an unboosted Perfect stop (units)
  tail: 250,               // units after the mud to the chunk's end (at least chunkLen in all)
};

// ---------- The needle ----------
// Zones by index: 0 Perfect, 1 Great, 2 Good, 3 Weak.
const ZONES = ['Perfect!', 'Great', 'Good', 'Weak'];

// The needle's speed factor and zone half-widths at a Steady level.
function needleOf(up = T.upgrades) {
  const k = up.steady || 0, w = T.steadyWiden * k, z = T.zoneScale;
  return { period: T.needlePeriod / Math.max(0.05, 1 - T.steadySlow * k), half: [(T.zonePerfect + w) * z, (T.zoneGreat + w) * z, (T.zoneGood + w) * z] };
}
// The needle's angle `t` seconds after the launcher was ready: a triangle wave, bottom at t = 0.
function needleAngle(t, up = T.upgrades) {
  const ph = (((t / needleOf(up).period) % 1) + 1) % 1, tri = ph < 0.5 ? ph * 2 : 2 - ph * 2;
  return T.needleMin + (T.needleMax - T.needleMin) * tri;
}
function zoneAt(angle, up = T.upgrades) {
  const d = Math.abs(angle - T.sweetAngle), h = needleOf(up).half;
  return d <= h[0] ? 0 : d <= h[1] ? 1 : d <= h[2] ? 2 : 3;
}
// A stop's launch. Weak's power ramps from zonePower Weak at the Good edge down to weakPowerMin at the wedge's end, so a stop
// just outside Good is only a little weaker (no cliff).
function launchAt(angle, up = T.upgrades) {
  const zone = zoneAt(angle, up);
  if (zone < 3) return { angle, zone, power: T.zonePower[zone] };
  const edge = needleOf(up).half[2], end = angle < T.sweetAngle ? T.sweetAngle - T.needleMin : T.needleMax - T.sweetAngle;
  const k = clamp((Math.abs(angle - T.sweetAngle) - edge) / Math.max(1e-6, end - edge), 0, 1);
  return { angle, zone, power: T.zonePower[3] + (T.weakPowerMin - T.zonePower[3]) * k };
}
// A tap `t` seconds after the launcher was ready.
const needleLaunch = (t, up = T.upgrades) => ({ ...launchAt(needleAngle(t, up), up), t });

// Every Good or better needle stop at every Steady level, with the Band and Aero of `up` (the teaching chunk's launches).
function goodStops(up) {
  const out = new Map();
  for (let k = 0; k <= T.upgradeMax; k++) {
    const F = FIRST_CHUNK, u = { ...up, steady: k }, g = needleOf(u).half[2], h = g * (1 + Math.max(0, Math.max(...F.tiers) + F.tapExtra - 2) / 10);
    for (let a = T.sweetAngle - h; a <= T.sweetAngle + h + 1e-9; a += F.angleStep) {
      const ang = +clamp(a, T.needleMin, T.needleMax).toFixed(2), l = launchAt(ang, u), key = `${ang},${l.power}`;
      const q = l.zone < 3 ? l.zone : 2 + (Math.abs(ang - T.sweetAngle) / g - 1) * 10;
      if (!out.has(key) || out.get(key).q > q) out.set(key, { angle: ang, power: l.power, zone: l.zone, q });
    }
  }
  return [...out.values()];
}

// A probe flight of `launch` over `field` with no input, to its first contact after `after` contacts (or, with `past`, its
// first contact beyond x = past).
function probe(up, launch, field, after = 0, past = null) {
  const r = newRun(0, launch, up, field);
  for (const t of launch.taps || []) queueInput(r, t, 'pulse');
  let n = 0, path = [];
  while (!r.ended && r.steps < 20000) {
    const mode = r.mode;
    stepRun(r);
    const hit = r.ev.some((e) => e.k !== 'boost' && e.k !== 'milestone') || (mode === 'air' && r.mode === 'ground');
    r.ev.length = 0;
    if (n === after && r.mode === 'air') path.push([r.x, r.y, r.vy, flightTime(r)]);
    if (hit && (past === null ? n++ === after : r.x > past)) return { x: r.x, path, ok: true };
  }
  return { x: r.x, path, ok: false };
}

const TEACH = new Map(); // layouts by the numbers that change the unboosted paths (the TUNE panel can change some)
function teachingChunk(up) {
  const key = JSON.stringify([up.band || 0, up.aero || 0, T.sweetAngle, T.zonePerfect, T.zoneGreat, T.zoneGood, T.zoneScale, T.zonePower, T.steadyWiden, T.launchSpeedMax, T.airDrag, T.gravity, T.needleMin, T.needleMax, FIRST_CHUNK]);
  if (TEACH.has(key)) return TEACH.get(key);
  const F = FIRST_CHUNK, plain = goodStops(up), perfect = { angle: T.sweetAngle, power: T.zonePower[0], zone: 0 };
  const spring = (x0, x1) => ({ kind: 'spring', x0: Math.round(x0), x1: Math.round(x1), w: Math.round(x1) - Math.round(x0), h: 0, spent: false });
  // A spring over landings `xs` (from x = `from` when that is given), never wider than `wMax` (spring A takes every first landing).
  const cover = (xs, from, pad, cap = F.wMax) => {
    const x0 = from > 0 ? clamp(Math.min(...xs) - pad[0], from, from + F.maxGap - F.gap) : Math.min(...xs) - pad[0]; // no long plain stretch mid-run
    return spring(x0, Math.min(x0 + cap, Math.max(...xs) + pad[1]));
  };
  const tier = (k) => F.tiers[Math.min(k, F.tiers.length - 1)] + 1e-9;
  const stops = plain.concat(...F.taps.map((t) => plain.map((l) => ({ ...l, taps: t, q: l.q - F.tapExtra }))));
  const ground = [];
  let bird = null;
  const field = () => ({ seed: 0, rng: null, ground: ground.map((g) => ({ ...g })), birds: bird ? [{ ...bird }] : [], end: 1e12, chunks: 1 });
  // A: the first landings.
  const first = stops.filter((l) => l.q <= tier(0)).map((l) => probe(up, l, field()).x);
  ground.push(cover(first, 0, F.padA, Infinity));
  // The run of springs.
  // A stronger Band or Aero gets a longer run, never a shorter one: `until` scales with the Perfect stop's open-ground throw.
  const open = () => ({ seed: 0, rng: null, ground: [], birds: [], end: 1e12, chunks: 1 });
  const until = F.until * (probe(up, perfect, open()).x / probe({ band: 0, aero: 0 }, perfect, open()).x);
  while (ground[ground.length - 1].x1 < Math.max(until, F.goldUntil)) {
    const last = ground[ground.length - 1].x1, tk = last < until ? tier(ground.length) : 1e-9;
    const xs = stops.filter((l) => l.q <= tk).map((l) => probe(up, l, field(), 0, last + F.gap)).filter((p) => p.ok).map((p) => p.x);
    if (!xs.length) break;
    ground.push(cover(xs, last + F.gap, F.pad));
  }
  // The bird: on the Perfect stop's way down after the last spring, so its bounce carries the gold on past the run.
  {
    const r = newRun(0, perfect, up, field()), end = ground[ground.length - 1].x1;
    while (!r.ended && r.steps < 40000) {
      stepRun(r); r.ev.length = 0;
      if (r.x > end && r.mode === 'air' && r.vy < 0 && r.y <= F.birdHeight) { bird = { x0: Math.round(r.x - T.birdSwing * Math.sin((flightTime(r) / T.birdPeriod) * Math.PI * 2)), y: Math.round(F.birdHeight + T.critterR), phase: 0, hit: false }; break; }
    }
  }
  // Small springs every `fillEvery` from the run's end up to the mud (no stretch of 150 m without a spring), and the mud past
  // mudFrom, clear of every ground touch of the unboosted Perfect stops; filling moves the touches, so the two are settled
  // together (filler springs added after a spring change nothing before it, so this ends).
  let m0 = F.mudFrom;
  for (let round = 0; round < 6; round++) {
    for (let x = ground[ground.length - 1].x1 + F.fillEvery; x + F.exitW + F.gap < m0; x += F.fillEvery) ground.push(spring(x, x + F.exitW));
    const touches = [];
    for (const l of plain.filter((q) => q.zone === 0)) {
      const r = newRun(0, l, up, field());
      while (!r.ended && r.x < m0 + 4000 && r.steps < 40000) { stepRun(r); r.ev.length = 0; if (r.mode !== 'air' || r.y <= 1) touches.push(r.x); }
    }
    let next = Math.max(m0, ground[ground.length - 1].x1 + F.gap);
    for (let moved = true; moved;) { moved = false; for (const x of touches) if (x > next - F.mudClear && x < next + F.mudW + F.mudClear) { next = Math.ceil(x + F.mudClear); moved = true; } }
    const settled = next - ground[ground.length - 1].x1 <= F.fillEvery + F.gap;
    m0 = next;
    if (settled) break;
  }
  ground.push({ kind: 'mud', x0: m0, x1: m0 + F.mudW, w: F.mudW, h: 0, spent: false });
  ground.push(spring(m0 + F.mudW + F.gap, m0 + F.mudW + F.gap + F.exitW)); // no stretch of 150 m without a spring
  const out = { ground, bird, len: Math.max(T.chunkLen, Math.ceil((m0 + F.mudW + F.gap + F.exitW + F.tail) / 100) * 100) };
  TEACH.set(key, out);
  return out;
}

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

function makeField(seed, up = T.upgrades) {
  const f = { seed, rng: makeRng(seed), ground: [], birds: [], end: 0, chunks: 0 };
  const t = teachingChunk(up);
  for (const g of t.ground) f.ground.push({ ...g });
  if (t.bird) f.birds.push({ ...t.bird });
  f.end = t.len; f.chunks = 1;
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

// A launch is { angle, power } and, from the needle, its `zone` (a Perfect launch carries perfectFuel extra pulses).
function newRun(seed, launch, up = T.upgrades, field = null) {
  const st = stats(up), sp = launch.power * st.launchSpeed, a = launch.angle * DEG;
  if (!field) { field = makeField(seed, up); ensureField(field, 0); }
  const fuel = st.fuelMax + (launch.zone === 0 ? T.perfectFuel : 0);
  return {
    seed, launch, up: { ...up }, st, field,
    x: 0, y: T.slingH, vx: sp * Math.cos(a), vy: sp * Math.sin(a), mode: 'air', ramp: null, u: 0,
    fuel, fuelCap: fuel, holding: false, steps: 0, acc: 0, q: [], ev: [],
    chain: 0, chainMax: 0, birds: 0, springs: 0, pulses: 0, coinAcc: 0, nextMark: 10 * T.unitsPerMetre, maxX: 0,
    msIdx: 0, stars: [], slowT: 0, ended: null, boosted: false, boostSprings: 0,
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
    r.fuel -= k; r.pulses++; r.boosted = true;
    push(r, T.boostPulse * k);
    r.ev.push({ k: 'boost' });
  } else if (e.kind === 'holdOn') r.holding = r.st.hold;
  else if (e.kind === 'holdOff') r.holding = false;
}

function end(r, why) { r.ended = why; r.vx = r.vy = 0; r.ev.push({ k: why }); }

// `boosted`: a boost was fired since the last contact (a spring hit after one counts for the goals).
function hitSpring(r, g, vyIn) {
  g.spent = true;
  if (r.boosted) r.boostSprings++;
  r.boosted = false;
  r.vy = Math.max(T.springMin, -vyIn * T.springBounce);
  r.y = 0; r.mode = 'air';
  r.springs++; r.chain++; r.chainMax = Math.max(r.chainMax, r.chain);
  r.ev.push({ k: 'spring', x: r.x, chain: r.chain });
}

function enterRamp(r, g, speed) {
  r.boosted = false;
  if (r.vx <= 0) { r.vx = 0; r.vy = 0; r.mode = 'ground'; r.y = 0; return; } // bumped the ramp's back
  r.mode = 'ramp'; r.ramp = g; r.u = speed * T.rampKeep;
  r.y = surfaceH(g, r.x); r.vx = r.u * Math.cos(g.a); r.vy = r.u * Math.sin(g.a);
  r.ev.push({ k: 'ramp' });
}

function plainTouch(r) {
  r.chain = 0; r.boosted = false;
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
    push(r, st.thrust * STEP * k); r.boosted = true;
  }

  if (r.mode === 'air') {
    r.vy -= T.gravity * STEP;
    r.vx *= st.dragK; r.vy *= st.dragK;
    r.x += r.vx * STEP; r.y += r.vy * STEP;
    const t = t1, cy = r.y + T.critterR;
    for (const b of f.birds) {
      if (b.hit || Math.abs(b.x0 - r.x) > T.birdSwing + 40) continue;
      if (Math.hypot(birdX(b, t) - r.x, b.y - cy) < T.critterR + T.birdR) {
        b.hit = true; r.boosted = false;
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

// ---------- Goals (PRD v0.2 B, G2) ----------
// In order of difficulty; three are active at a time (the first three not done). A flight pays every active goal it meets,
// on the card, and the next in the list takes its place. Each is a name in the candy kitchen's trade and a short plain
// condition; `stat` is a number from the flight's summary (goalStats), met at `need`; `count` goals show "have/need". A goal
// named for a skill is met by a zero-input Good or better launch on at most 20 percent of stops (tools/sim-launch.mjs --rank).
const GOALS = [
  { id: 'reach300', name: 'Warm Oven', text: 'Reach 300 m', stat: 'm', need: 300, reward: 80 },
  { id: 'great', name: 'Good Knead', text: 'Launch Great or better', stat: 'great', need: 1, reward: 80 },
  { id: 'bird', name: 'Feather Whisk', text: 'Bounce off a bird', stat: 'birds', need: 1, reward: 100 },
  { id: 'reach500', name: 'Rising Dough', text: 'Reach 500 m', stat: 'm', need: 500, reward: 120 },
  { id: 'springs5', name: 'Jelly Hopper', text: 'Hit 5 springs in one flight', stat: 'springs', need: 5, reward: 120, count: true },
  { id: 'fly5', name: 'Five Batches', text: 'Fly 5 times', stat: 'flights', need: 5, reward: 100, count: true },
  { id: 'perfect', name: 'Golden Crust', text: 'Launch Perfect', stat: 'perfect', need: 1, reward: 150 },
  { id: 'boostSpring', name: 'Fizz Drop', text: 'Boost onto a spring', stat: 'boostSprings', need: 1, reward: 150 },
  { id: 'reach750', name: 'Long Taffy', text: 'Reach 750 m', stat: 'm', need: 750, reward: 200 },
  { id: 'chain5', name: 'Layer Cake', text: 'Chain 5 in a row', stat: 'chain', need: 5, reward: 180, count: true },
  { id: 'fly10', name: 'Ten Trays', text: 'Fly 10 times', stat: 'flights', need: 10, reward: 180, count: true },
  { id: 'birds3', name: 'Meringue Flock', text: 'Hit 3 birds in one flight', stat: 'birds', need: 3, reward: 250, count: true },
  { id: 'reach1000', name: 'Sugar Rush', text: 'Reach 1000 m', stat: 'm', need: 1000, reward: 300 },
  { id: 'perfect2', name: 'Twin Glaze', text: 'Two Perfect launches in a row', stat: 'perfectRow', need: 2, reward: 300, count: true },
  { id: 'chain7', name: 'Tiered Tower', text: 'Chain 7 in a row', stat: 'chain', need: 7, reward: 350, count: true },
  { id: 'reach1500', name: 'Candy Road', text: 'Reach 1500 m', stat: 'm', need: 1500, reward: 400 },
  { id: 'springs8', name: 'Jelly Jumper', text: 'Hit 8 springs in one flight', stat: 'springs', need: 8, reward: 400, count: true },
  { id: 'reach2000', name: 'Sweet Horizon', text: 'Reach 2000 m', stat: 'm', need: 2000, reward: 600 },
];
const activeGoals = (done) => GOALS.filter((g) => !done.includes(g.id)).slice(0, T.goalSlots);
// A flight's numbers for the goals; `flights` and `perfectRow` count this flight in.
function goalStats(r, flights, perfectRow) {
  const z = r.launch.zone ?? 3;
  return { m: metres(r), great: z <= 1 ? 1 : 0, perfect: z === 0 ? 1 : 0, birds: r.birds, springs: r.springs, chain: r.chainMax, boostSprings: r.boostSprings, flights, perfectRow };
}
// Pays the active goals the flight meets. Returns the goals paid, their sugar, and the new done list.
function settleGoals(done, st) {
  const paid = activeGoals(done).filter((g) => st[g.stat] >= g.need);
  return { paid, sugar: paid.reduce((a, g) => a + g.reward, 0), done: done.concat(paid.map((g) => g.id)) };
}
// A goal's condition, with its counter when it counts something and a count is known.
const goalLine = (g, have) => (g.count && have !== undefined ? `${g.text}  ${Math.min(have, g.need)}/${g.need}` : g.text);

// ---------- Save ----------
// v5: { best: metres, sugar, ms: [milestone metres ever passed], flights, up: { band, fuel, aero, rocket, steady }, holdTaught,
//       goalsDone: [goal ids], perfectRow: Perfect launches in a row up to the last flight, birdTaught, mudTaught }

function finishFlight(E, r) {
  const m = metres(r), best = E.save.get('best', 0);
  const reached = E.save.get('ms', []);
  let bonus = 0;
  const firsts = [];
  T.milestones.forEach((ms, i) => { if (m >= ms && !reached.includes(ms)) { bonus += T.milestoneBonus[i]; firsts.push(ms); } });
  const flights = E.save.get('flights', 0) + 1, perfectRow = r.launch.zone === 0 ? E.save.get('perfectRow', 0) + 1 : 0;
  const st = goalStats(r, flights, perfectRow), before = activeGoals(E.save.get('goalsDone', [])).map((g) => g.id);
  const gs = settleGoals(E.save.get('goalsDone', []), st);
  const earned = coinsOf(r) + bonus + gs.sugar;
  E.save.set('sugar', E.save.get('sugar', 0) + earned);
  if (firsts.length) E.save.set('ms', reached.concat(firsts));
  if (m > best) E.save.set('best', m);
  E.save.set('flights', flights);
  E.save.set('perfectRow', perfectRow);
  if (gs.paid.length) E.save.set('goalsDone', gs.done);
  const up = r.up;
  E.ledger.add('flight', { m, why: r.ended, sugar: earned, bonus, goals: gs.paid.map((g) => g.id).join('/') || 'none', chain: r.chainMax, ms: r.stars.join('/') || 'none', springs: r.springs, birds: r.birds, pulses: r.pulses,
    angle: +r.launch.angle.toFixed(1), zone: ZONES[r.launch.zone ?? 3].replace('!', ''), up: `b${up.band}f${up.fuel}a${up.aero}r${up.rocket}s${up.steady || 0}`, seed: r.seed });
  // The card: rewards as tickets (the goals paid and the new places, largest first), then the three goals now active (a
  // counter for those this flight counted toward, "new" for the ones that just took a slot).
  const tickets = gs.paid.map((g) => ({ name: g.name, cond: g.text, sugar: g.reward })).concat(firsts.map((ms) => ({ name: 'New place reached', short: 'New place', cond: `Past ${ms} m`, sugar: T.milestoneBonus[T.milestones.indexOf(ms)] })))
    .sort((a, b) => b.sugar - a.sugar);
  const active = activeGoals(gs.done).map((g) => ({ g, have: before.includes(g.id) ? st[g.stat] : undefined, isNew: !before.includes(g.id) }));
  return { m, best: Math.max(best, m), isNew: m > best, sugar: coinsOf(r), bonus, earned, chainMax: r.chainMax, tickets, active, seed: r.seed, why: r.ended, zone: r.launch.zone ?? 3 };
}

// ---------- Shop ----------
// Save: `up` holds the bought level of each upgrade (0 to upgradeMax); sugar is spent from `sugar`.

const UPGRADES = [{ id: 'band', name: 'Band' }, { id: 'fuel', name: 'Fuel' }, { id: 'rocket', name: 'Rocket' }, { id: 'aero', name: 'Aero' }, { id: 'steady', name: 'Steady' }];
const levelsOf = (E) => ({ ...T.upgrades, ...E.save.get('up', {}) });

// What buying level `lvl` (1 to upgradeMax) of an upgrade does, in plain words.
function effectText(id, lvl) {
  if (id === 'band') return `+${Math.round(T.bandStep * 100)}% launch speed`;
  if (id === 'fuel') return `+${T.fuelStep} fuel pulses`;
  if (id === 'aero') return `${Math.round(T.aeroStep * 100)}% less air drag`;
  if (id === 'steady') return `Needle ${Math.round(T.steadySlow * 100)}% slower, zones ${T.steadyWiden}° wider each side`;
  const k = T.rocketThrust / T.holdFuelRate / T.boostPulse;
  return lvl === 1 ? `Hold to boost, ${+k.toFixed(1)}x push per fuel` : `+${Math.round(T.rocketStep * 100)}% hold thrust`;
}

// Greedy word wrap to `maxW` px at a text size and weight (system font, as E.text draws it).
function wrap(E, text, maxW, size, weight) {
  const ctx = E.ctx; ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  const out = []; let line = '';
  for (const w of text.split(' ')) {
    const next = line ? `${line} ${w}` : w;
    if (line && ctx.measureText(next).width > maxW) { out.push(line); line = w; } else line = next;
  }
  if (line) out.push(line);
  return out;
}

function buy(E, id) {
  const up = levelsOf(E), lvl = up[id], price = T.upgradePrices[id][lvl], sugar = E.save.get('sugar', 0);
  if (lvl >= T.upgradeMax || sugar < price) return false;
  E.save.set('sugar', sugar - price);
  E.save.set('up', { ...up, [id]: lvl + 1 });
  E.ledger.add('buy', { up: id, level: lvl + 1, price, sugar: sugar - price });
  return true;
}

const shop = {
  enter(E, p = {}) { this.from = p.from || 'menu'; this.card = p.card || null; this.cells = []; },
  // Each card: name and level pips, the next level's effect wrapped to the card's width, and a Buy button carrying the price.
  render(ctx, E) {
    const sf = E.safe, left = sf.left + 16, right = E.w - sf.right - 16, top = sf.top + 8;
    const grad = ctx.createLinearGradient(0, 0, 0, E.h); grad.addColorStop(0, P.skyDusk[1]); grad.addColorStop(1, P.skyNight[1]);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, E.w, E.h);
    this.btnBack = btn(E, 'Back', left + 40, top + 22, { w: 80, h: 44, size: TY.md, fill: P.buttonOff });
    E.text('Shop', E.w / 2, top + 22, { size: TY.lg, weight: '800', color: P.text });
    const sugar = E.save.get('sugar', 0), up = levelsOf(E);
    E.text(`${sugar} sugar`, right, top + 22, { size: TY.md, align: 'right', color: P.coin, weight: '800' });
    const cols = 3, gy = top + 52, gap = 10, cw = (right - left - gap * (cols - 1)) / cols, ch = (E.h - sf.bottom - 10 - gy - gap) / 2, pad = 12;
    this.cells = UPGRADES.map((u, i) => {
      const x = left + (i % cols) * (cw + gap), y = gy + Math.floor(i / cols) * (ch + gap), lvl = up[u.id], max = lvl >= T.upgradeMax;
      const price = max ? 0 : T.upgradePrices[u.id][lvl], can = !max && sugar >= price;
      E.roundRect(x, y, cw, ch, T.style.radius, P.panel, P.panelEdge);
      E.text(u.name, x + pad, y + 20, { size: TY.md, weight: '800', align: 'left', color: P.text });
      for (let k = 0; k < T.upgradeMax; k++) E.roundRect(x + cw - pad - (T.upgradeMax - k) * 20 + 4, y + 12, 16, 16, 4, k < lvl ? P.teal : P.panelSolid, P.panelEdge);
      const words = wrap(E, max ? 'Fully upgraded' : `Level ${lvl + 1}: ${effectText(u.id, lvl + 1)}`, cw - 2 * pad, TY.sm, '600');
      words.forEach((line, n) => E.text(line, x + pad, y + 44 + n * 17, { size: TY.sm, align: 'left', color: max ? P.textDim : P.text, weight: '600' }));
      if (max) return { u, btn: null, rect: { x, y, w: cw, h: ch } };
      const bw = Math.min(cw - 2 * pad, 170);
      const label = `Buy for ${price}`, size = fit(E, label, bw - 12, TY.md, '600') === label ? TY.md : TY.sm;
      const b = btn(E, label, x + pad + bw / 2, y + ch - 28, { w: bw, h: 44, size, fill: can ? P.button : P.buttonOff, color: can ? P.text : P.textOff });
      return { u, btn: b, rect: { x, y, w: cw, h: ch } };
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

// The landing marker (PRD v0.2 C): where the critter first touches the ground or a ramp if no more boost is fired, by the
// flight's own air step run forward on a copy of its state (the field is only read). Null when a bird comes first, or when
// the critter is not in the air: the marker never shows beyond the first contact.
function landingMark(r, maxT = 30) {
  if (r.mode !== 'air' || r.ended) return null;
  const f = r.field, st = r.st;
  let x = r.x, y = r.y, vx = r.vx, vy = r.vy, n = r.steps;
  const near = f.birds.filter((b) => !b.hit && b.x0 > x - T.birdSwing - 40), R = T.critterR + T.birdR;
  const birdTop = near.reduce((m, b) => Math.max(m, b.y), -Infinity) + R, groundTop = f.ground.reduce((m, g) => Math.max(m, g.h), 0);
  for (let i = 0; i < maxT / STEP; i++) {
    n++;
    vy -= T.gravity * STEP; vx *= st.dragK; vy *= st.dragK; x += vx * STEP; y += vy * STEP;
    const cy = y + T.critterR;
    if (cy <= birdTop) for (const b of near) if (Math.abs(b.x0 - x) <= T.birdSwing + 40 && Math.hypot(birdX(b, n * STEP) - x, b.y - cy) < R) return null;
    if (y > groundTop) continue; // high up: nothing to touch yet
    const g = groundAt(f, x);
    if (y <= surfaceH(g, x) && (vy <= 0 || (g && g.kind === 'ramp'))) return { x, g };
  }
  return null;
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

// `pre`: the launcher's state, { needle: angle or null, wedge: alpha, mark: landing x or null }.
function drawWorld(ctx, E, v, c, r, pre = null) {
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
  for (let wx = Math.ceil(c.x / (5 * u10)) * 5 * u10; wx < c.x + span + u10; wx += 5 * u10) if (wx > 0) E.text(`${wx / T.unitsPerMetre} m`, X(wx), Math.min(gy + 34 * s, E.h - E.safe.bottom - 10), { size: TY.sm, color: P.text, weight: '600' });

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
      if (g.kind === 'spring') drawSpring(ctx, X(g.x0), gy, g.w * z * s, s, g.spent, S.pops.get(g), E.time + g.x0 * 0.01);
      else if (g.kind === 'mud') drawMud(ctx, X(g.x0), gy, g.w * z * s, s, E.time + g.x0 * 0.013);
      else if (g.kind === 'ramp') drawRamp(ctx, X(g.x0), gy, g.w * z * s, g.h * z * s, s, lw);
    }
    for (const b of f.birds) {
      if (b.hit || b.x0 < x0 || b.x0 > x1) continue;
      const by = Y(b.y);
      if (by < gy - 4 * s) drawBird(ctx, X(birdX(b, t)), by, s * sprite, E.time + b.phase, Math.cos((t / T.birdPeriod) * Math.PI * 2 + b.phase) >= 0 ? -1 : 1, 0);
    }
  }

  if (pre && pre.mark !== null && pre.mark !== undefined && X(pre.mark) <= E.w - 6 * s) drawMark(ctx, X(pre.mark), gy, s, E.time);
  const px = X(0), py = Y(T.slingH + T.critterR);
  if (pre && pre.needle !== null && pre.wedge > 0) drawWedge(ctx, px, py, s, pre.needle, pre.wedge, S.up || T.upgrades, lw);

  // The critter: in the pocket until the launch, then where the run has it.
  const cx = r ? r.x : 0, cy = r ? r.y : T.slingH;
  const rr = T.critterR * s * sprite, sx = X(cx), sy = Y(cy) - rr;
  // Soft shadow on the band while low.
  const hgt = cy * z * s;
  if (lift === 0 && hgt < 160 * s) { ctx.globalAlpha = 1 - hgt / (160 * s); ctx.fillStyle = P.shadow; ctx.beginPath(); ctx.ellipse(sx, gy + 2 * s, rr * 1.1, rr * 0.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  for (const e of S.fx) drawFx(ctx, E, e, X, Y, s, sprite, lw, true);
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
  // The band: plum rubber holding the critter in the pocket; it twangs for a moment after the launch.
  if (!r || S.snapT > 0) {
    const snap = r ? S.snapT / J.snapTime : 0;
    const bx = !r ? sx : fx + Math.sin(E.time * 60) * 10 * s * snap, by = !r ? sy + rr * 0.4 : forkTop + 4 * s;
    ctx.strokeStyle = P.rubber; ctx.lineWidth = 2.5 * s * Math.max(z, 0.7);
    ctx.beginPath(); ctx.moveTo(fx - fw, forkTop); ctx.lineTo(bx, by); ctx.lineTo(fx + fw, forkTop); ctx.stroke();
  }
  // Squash: flattened on a landing and wobbling back.
  let sqx = 1, sqy = 1;
  if (S.sq.t > 0) { const k = S.sq.t / J.squashTime, w = S.sq.amt * k * Math.cos((1 - k) * Math.PI * 1.5); sqx = 1 + w; sqy = 1 - w; }
  else if (r && r.ended === 'mud') { sqx = 1 + J.landSquash; sqy = 1 - J.landSquash; }
  const look = r ? Math.atan2(-r.vy, r.vx) : pre && pre.needle !== null ? -pre.needle * DEG : 0; // before launch the eyes follow the needle
  drawCritter(ctx, sx, sy + (1 - sqy) * rr, rr, look, 0, sqx, sqy, lw);
  return { sx, sy, rr, height: cy, lifted: lift > 0, night: sky.night };
}

// An unspent spring bobs on its coil at rest (it looks bouncy before it is ever touched).
function drawSpring(ctx, x, gy, w, s, spent, pop, time) {
  const k = pop ? pop.t / J.springPop : 0; // 1 at the hit: compressed, then pops past rest
  const rest = (spent ? 4 : 10 * (1 + J.springWobble * Math.sin(time * 6))) * s, hgt = pop ? rest * (k > 0.6 ? 0.35 : 1 + 0.5 * Math.sin((1 - k / 0.6) * Math.PI)) : rest;
  ctx.strokeStyle = P.coil; ctx.lineWidth = 2.2 * s; ctx.lineJoin = 'round';
  const n = Math.max(1, Math.round(w / (40 * s))), cw = Math.min(w * 0.4, 16 * s); // a coil every 40 px along a wide spring
  ctx.beginPath();
  for (let c = 0; c < n; c++) {
    const cx = x + (w * (c + 0.5)) / n - cw / 2;
    for (let i = 0; i <= 5; i++) { const yy = gy - (hgt * i) / 5, xx = cx + (i % 2 ? cw : 0); if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); }
  }
  ctx.stroke();
  const ph = 5 * s;
  roundRectPath(ctx, x, gy - hgt - ph, w, ph, ph / 2);
  ctx.strokeStyle = P.halo; ctx.lineWidth = T.style.line * s * 2.4; ctx.stroke(); // the light halo keeps 3:1 on the dusk sky
  ctx.fillStyle = spent ? P.tealSpent : P.teal; ctx.fill();
  ctx.strokeStyle = P.ink; ctx.lineWidth = T.style.line * s * 0.8; ctx.stroke();
  if (!spent) { ctx.fillStyle = P.tealLight; ctx.fillRect(x + ph, gy - hgt - ph + 1.2 * s, Math.max(0, w - 2 * ph), 1.4 * s); }
}

// Mud: a sticky pit sunk into the grass, never a pad (PRD v0.2 C): a dark glossy body with a slowly rippling top and a
// deeper middle, short light sheen streaks, slow bubbles that swell and pop, and goo strands hanging from both rims.
// It reads as a dark hole in the bright grass band (5.6:1), with nothing raised above the ground line.
function drawMud(ctx, x, gy, w, s, time) {
  const d = 15 * s, top = (u) => gy + (1.2 + 0.8 * Math.sin(time * 1.3 + u * 9)) * s;
  ctx.beginPath(); ctx.moveTo(x, gy);
  for (let i = 1; i <= 8; i++) ctx.lineTo(x + (w * i) / 8, top(i / 8));
  ctx.lineTo(x + w, gy + d - 5 * s); ctx.quadraticCurveTo(x + w, gy + d, x + w - 6 * s, gy + d);
  ctx.lineTo(x + 6 * s, gy + d); ctx.quadraticCurveTo(x, gy + d, x, gy + d - 5 * s); ctx.closePath();
  ctx.fillStyle = P.mud; ctx.fill();
  ctx.fillStyle = P.mudDeep; ctx.beginPath(); ctx.ellipse(x + w / 2, gy + d * 0.62, w * 0.4, d * 0.26, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = P.mudRim; ctx.lineCap = 'round'; ctx.lineWidth = 1.4 * s; ctx.globalAlpha = 0.55; // glossy streaks, short
  for (const u of [0.22, 0.64]) { ctx.beginPath(); ctx.moveTo(x + w * u, gy + 4 * s); ctx.lineTo(x + w * u + Math.min(10 * s, w * 0.1), gy + 3.4 * s); ctx.stroke(); }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 3; i++) { // bubbles rise, swell and pop on a slow cycle
    const ph = (time * 0.45 + i * 0.37) % 1, bx = x + w * (0.2 + 0.3 * i);
    if (ph < 0.85) { const k = ph / 0.85, br = (0.8 + 2 * k) * s; ctx.fillStyle = '#5a3620'; ctx.strokeStyle = P.mudRim; ctx.lineWidth = 0.9 * s; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(bx, gy + (11 - 7 * k) * s, br, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    else { ctx.strokeStyle = P.mudRim; ctx.lineWidth = 0.9 * s; ctx.globalAlpha = 1 - (ph - 0.85) / 0.15; ctx.beginPath(); ctx.arc(bx, gy + 3.5 * s, (3 + 20 * (ph - 0.85)) * s, Math.PI, 0); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = P.mud; ctx.lineWidth = 1.6 * s; // strands stretched from the grass at both rims down into the goo
  for (const [ex, dir] of [[x, 1], [x + w, -1]]) for (const [dx, dy] of [[5, 9], [10, 6]]) {
    const sag = Math.sin(time * 1.1 + dx) * 0.8 * s;
    ctx.beginPath(); ctx.moveTo(ex - dir * 1.5 * s, gy); ctx.quadraticCurveTo(ex + dir * dx * 0.3 * s, gy + (dy + 2) * s + sag, ex + dir * dx * s, gy + 2 * s); ctx.stroke();
    ctx.fillStyle = P.mud; ctx.beginPath(); ctx.arc(ex + dir * dx * 0.35 * s, gy + (dy * 0.75 + 1) * s + sag, 1.4 * s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.lineCap = 'butt';
}

// The needle wedge at the launcher: graded zones (drawn widest first), the needle over them.
function drawWedge(ctx, px, py, s, needle, alpha, up, lw) {
  const R = T.wedgeR * s, r0 = T.wedgeHole * s, h = needleOf(up).half, c = T.sweetAngle, lo = T.needleMin, hi = T.needleMax;
  const sector = (rOut, rIn, a0, a1, fill, stroke) => {
    ctx.beginPath(); ctx.arc(px, py, rOut, -a1 * DEG, -a0 * DEG); ctx.arc(px, py, rIn, -a0 * DEG, -a1 * DEG, true); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw * 0.7; ctx.stroke(); }
  };
  ctx.save(); ctx.globalAlpha = alpha; ctx.lineJoin = 'round';
  sector(R + 4 * s, r0 - 3 * s, lo - 1.5, hi + 1.5, P.halo);
  sector(R, r0, lo, hi, P.zones[3], P.ink);
  for (let z = 2; z >= 0; z--) sector(R, r0, Math.max(lo, c - h[z]), Math.min(hi, c + h[z]), P.zones[z], P.ink);
  const a = needle * DEG, ux = Math.cos(a), uy = -Math.sin(a);
  ctx.lineCap = 'round';
  // A thin needle, so the gold shows beside it.
  for (const [w, col] of [[3.6 * s, P.halo], [1.6 * s, P.ink]]) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(px + ux * r0 * 0.7, py + uy * r0 * 0.7); ctx.lineTo(px + ux * (R + 8 * s), py + uy * (R + 8 * s)); ctx.stroke(); }
  ctx.fillStyle = P.halo; ctx.strokeStyle = P.ink; ctx.lineWidth = lw;
  ctx.lineWidth = lw * 0.7; ctx.beginPath(); ctx.arc(px + ux * (R + 8 * s), py + uy * (R + 8 * s), 3.5 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}

// The landing marker: a small white chevron on the grass line, bobbing, with a shadow on the band.
function drawMark(ctx, x, gy, s, time) {
  const b = Math.sin(time * 7) * 1.5 * s, tip = gy - 2 * s + b;
  ctx.fillStyle = P.shadow; ctx.beginPath(); ctx.ellipse(x, gy + 2 * s, 7 * s, 2 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = P.white; ctx.strokeStyle = P.ink; ctx.lineWidth = 1.6 * s; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x, tip); ctx.lineTo(x - 6 * s, tip - 9 * s); ctx.lineTo(x + 6 * s, tip - 9 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
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
    if (e.k === 'tumble') { e.rot += e.spin * dt; if (e.y < T.birdR) { e.y = T.birdR; e.vx = e.vy = e.g = e.spin = 0; } } // it lands on the band
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
  launch: (E) => { E.audio.beep({ freq: 300, dur: 0.1, slide: 1.5, gain: 0.15 }); E.audio.noise({ dur: 0.06, gain: 0.1 }); },
  boost: (E) => { E.audio.noise({ dur: 0.12, gain: 0.1 }); E.audio.beep({ freq: 220, dur: 0.12, type: 'sine', slide: 2, gain: 0.06 }); },
  spring: (E) => { E.audio.beep({ freq: 1250, dur: 0.1, slide: 1.5 }); E.audio.beep({ freq: 420, dur: 0.18, type: 'sine', slide: 2.2, gain: 0.1 }); },
  bird: (E) => { E.audio.beep({ freq: 900, dur: 0.07, type: 'sawtooth', slide: 0.6, gain: 0.08 }); E.audio.beep({ freq: 1000, dur: 0.07, type: 'sawtooth', slide: 0.6, gain: 0.07, delay: 0.09 }); },
  chain: (E, n) => E.audio.beep({ freq: 520 * Math.pow(1.26, n), dur: 0.14, type: 'triangle', gain: 0.12 }),
  zone: (E, z) => { // the launch chime: higher for a better zone, a falling note for Weak, a second chime for Perfect
    E.audio.beep({ freq: J.zoneFreq[z], dur: 0.16, type: 'triangle', slide: z === 3 ? 0.7 : 1.15, gain: 0.14 });
    if (z === 0) E.audio.beep({ freq: J.zoneFreq[0] * 1.5, dur: 0.2, type: 'triangle', gain: 0.1, delay: 0.08 });
  },
};

// ---------- HUD ----------
// CSS px, inside all four safe insets; light text on ink pills so it reads on every sky.

function pill(E, text, x, y, size, align = 'center', color = P.text) {
  const ctx = E.ctx; ctx.font = `800 ${size}px system-ui, sans-serif`;
  const w = ctx.measureText(text).width + 20, h = size + 14, sf = E.safe;
  const lx = clamp(align === 'right' ? x - w : align === 'left' ? x : x - w / 2, sf.left + 4, E.w - sf.right - 4 - w); // never past a safe inset
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
    const pulse = S.pipT > 0 ? 0.35 * Math.sin(Math.PI * (1 - S.pipT / J.pipPulse)) : 0; // every pip pulses once with "Tap to boost"
    const g = (popping ? 1 + 0.5 * (S.gaugePop / J.gaugePop) : 1) + pulse, cx = x0 + i * 18 + 7, cy = y0 + 1;
    E.roundRect(cx - 7 * g, cy - 7 * g, 14 * g, 14 * g, 4, P.panelSolid, P.panelEdge);
    if (k > 0) E.roundRect(cx - 5, cy + 5 - 10 * k, 10, 10 * k, 3, P.coin);
  }
  if (info && info.lifted) pill(E, `${Math.round(info.height / T.unitsPerMetre)} m up`, info.sx + info.rr + 8, info.sy, TY.sm, 'left');
  if (S.banner) {
    const k = S.banner.t / J.bannerTime, inK = ease.outBack(clamp((1 - k) / 0.2, 0, 1)), a = clamp(k / 0.15, 0, 1);
    E.ctx.globalAlpha = a;
    pill(E, `★ ${S.banner.text}`, E.w / 2, sf.top + 56 + 40 * inK, TY.lg, 'center', P.coin); // below the fuel panel's row
    E.ctx.globalAlpha = 1;
  }
  if (S.holdT > 0) { E.ctx.globalAlpha = clamp(S.holdT / 0.3, 0, 1); pill(E, 'Hold to boost', E.w / 2, sf.top + 150, TY.md); E.ctx.globalAlpha = 1; }
  else if (S.tapT > 0) { E.ctx.globalAlpha = clamp(S.tapT / 0.3, 0, 1); pill(E, 'Tap to boost', E.w / 2, sf.top + 150, TY.md); E.ctx.globalAlpha = 1; }
}

// ---------- Scenes ----------

const newSeed = () => (Math.random() * 2 ** 32) >>> 0; // the seed is setup; the flight itself never draws randomness
const btn = (E, label, cx, cy, o = {}) => E.button(label, cx, cy, { fill: P.button, color: P.text, ...o });

// The menu (principle 11): the title, one headline number (the best distance), the three active goals under it, then Play,
// Shop and Sound.
const menu = {
  render(ctx, E) {
    const v = view(E), sf = E.safe;
    drawWorld(ctx, E, v, newCamera(v.vw), null, null);
    const cy = sf.top + Math.max(40, E.h * 0.12);
    E.text('LAUNCH', E.w / 2, cy, { size: TY.xl, weight: '800', color: P.ink });
    E.titleArea = { x: E.w / 2 - 110, y: cy - 30, w: 220, h: 60 }; // release: five taps on the title show TUNE
    pill(E, `Best ${E.save.get('best', 0)} m`, E.w / 2, cy + 42, TY.md);
    const goals = activeGoals(E.save.get('goalsDone', [])), have = { flights: E.save.get('flights', 0), perfectRow: E.save.get('perfectRow', 0) };
    const gw = Math.min(E.w - sf.left - sf.right - 40, 420);
    let gy = cy + 66;
    for (const g of goals) gy += goalRow(E, E.w / 2 - gw / 2, gy, gw, g, goalLine(g, have[g.stat]), false) + 6;
    const bottom = E.h - sf.bottom - 8;
    if (gy + 8 + 56 + 8 + 44 <= bottom) { // Play above Shop and Sound
      const py = Math.min(gy + 8 + 28, bottom - 44 - 8 - 28);
      this.btnPlay = btn(E, 'Play', E.w / 2, py, { w: 220, h: 56, size: TY.md });
      this.btnShop = btn(E, 'Shop', E.w / 2 - 58, py + 58, { fill: P.panelSolid, w: 104, h: 44, size: TY.md });
      this.btnMute = btn(E, E.audio.muted ? 'Sound off' : 'Sound on', E.w / 2 + 58, py + 58, { fill: P.panelSolid, w: 104, h: 44, size: TY.sm });
    } else { // short screens: one row
      const py = Math.min(gy + 8 + 28, bottom - 28);
      this.btnPlay = btn(E, 'Play', E.w / 2, py, { w: 180, h: 56, size: TY.md });
      this.btnShop = btn(E, 'Shop', E.w / 2 - 90 - 12 - 50, py, { fill: P.panelSolid, w: 100, h: 48, size: TY.md });
      this.btnMute = btn(E, E.audio.muted ? 'Sound off' : 'Sound on', E.w / 2 + 90 + 12 + 50, py, { fill: P.panelSolid, w: 100, h: 48, size: TY.sm });
    }
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
    S.run = null; S.endT = 0; S.frameReal = performance.now(); S.readyReal = S.frameReal; S.pid = null; S.launchPid = null; S.spaceDown = false;
    S.up = levelsOf(E); S.st = stats(S.up); S.cam = newCamera(view(E).vw);
    S.hint = E.save.get('flights', 0) === 0; // a fresh save's first launch: "Tap when the needle is in the gold"
    S.fx.length = 0; S.pops = new Map(); S.sq = { amt: 0, t: 0 };
    S.snapT = 0; S.speedT = 0; S.gaugePop = 0; S.distPop = 0; S.chainT = 0; S.banner = null; S.holdT = 0;
    S.wedgeT = 0; S.zonePop = null; S.needle = T.needleMin; S.mark = null; S.markT = 0; S.callouts = []; S.endWait = T.endDelay;
    S.teachHold = S.up.rocket >= 1 && !E.save.get('holdTaught', false);
    S.teachBird = !E.save.get('birdTaught', false); S.teachMud = !E.save.get('mudTaught', false);
    S.teachTap = E.save.get('flights', 0) === 0; S.tapT = 0; S.pipT = 0; S.prevVy = 0; S.quit = false;
  },
  stamp(r) { return flightTime(r) + r.acc + Math.min(0.05, Math.max(0, (performance.now() - S.frameReal) / 1000)); },
  // Seconds since the launcher was ready, at this moment (a tap's handler runs when the tap arrives).
  needleT() { return Math.max(0, (performance.now() - S.readyReal) / 1000); },
  launch(E) {
    const l = needleLaunch(this.needleT(), S.up), v = view(E);
    S.run = newRun(S.seed, l, S.up);
    S.needle = l.angle; S.hint = false; S.wedgeT = T.wedgeFade;
    SFX.launch(E); SFX.zone(E, l.zone); E.haptic(J.zoneHaptic[l.zone]); E.shake(J.kick, J.kickTime);
    S.snapT = J.snapTime;
    emit('dust', 0, 0, J.dust, { angle: Math.PI / 2, spread: Math.PI * 0.9, speed: 90, g: -200, life: 0.5, size: 3, color: P.dust });
    const [dx, dy] = toView(S.cam, 0, T.slingH + T.critterR + T.wedgeR + 30); // above the launcher, clear of the first arc's hints
    S.zonePop = { z: l.zone, t: J.zonePop, x: dx * v.s, y: v.oy + dy * v.s };
    if (l.zone === 0) { // Perfect: a gold flash and a ring of sparks
      E.flash(P.zones[0], 0.18);
      for (let i = 0; i < J.sparks; i++) { const t = (i / J.sparks) * Math.PI * 2; S.fx.push({ k: 'spark', x: 0, y: T.slingH + T.critterR, vx: Math.cos(t) * 150, vy: Math.sin(t) * 150, g: 0, t: 0.5, max: 0.5, size: 2.6, color: P.zones[0] }); }
    }
    if (S.teachHold) { S.holdT = J.holdHint; E.save.set('holdTaught', true); }
  },
  update(dt, E) {
    S.frameReal = performance.now();
    const r = S.run;
    for (const k of ['snapT', 'speedT', 'gaugePop', 'distPop', 'chainT', 'holdT', 'tapT', 'pipT', 'wedgeT']) if (S[k] > 0) S[k] -= dt;
    if (S.sq.t > 0) S.sq.t -= dt;
    if (S.banner) { S.banner.t -= dt; if (S.banner.t <= 0) S.banner = null; }
    if (S.zonePop) { S.zonePop.t -= dt; if (S.zonePop.t <= 0) S.zonePop = null; }
    for (const c of S.callouts) c.t -= dt;
    S.callouts = S.callouts.filter((c) => c.t > 0);
    updateFx(dt);
    cameraStep(S.cam, r, view(E).vw, dt);
    if (!r) return;
    if (S.spaceDown && !E.keys.has(' ')) { // key repeat is ignored: one pulse per press, a held key is the Rocket's hold
      S.spaceDown = false;
      if (r.st.hold && !r.ended) queueInput(r, this.stamp(r), 'holdOff');
    }
    advance(r, dt);
    if (S.teachTap && r.mode === 'air' && S.prevVy > 0 && r.vy <= 0) { S.teachTap = false; S.tapT = J.tapHint; S.pipT = J.pipPulse; } // the top of the first arc
    if (r.ev.some((e) => e.k !== 'boost' && e.k !== 'milestone')) S.teachTap = false; // only the first arc teaches
    S.prevVy = r.vy;
    const contact = r.ev.some((e) => e.k !== 'boost' && e.k !== 'milestone');
    for (const e of r.ev) this.onEvent(e, E);
    r.ev.length = 0;
    S.markT -= dt;
    if (contact || S.markT <= 0) { S.mark = landingMark(r); S.markT = T.markEvery; } // a contact ends the old prediction at once
    if (r.holding && Math.random() < 0.5) emit('flame', r.x, r.y + T.critterR, 1, { angle: Math.atan2(-r.vy, -r.vx), spread: 0.6, speed: 120, g: 0, life: J.flameLife, size: 3, color: P.flame });
    if (r.ended) { S.endT += dt; if (S.endT >= S.endWait) E.setScene('over', finishFlight(E, r)); }
  },
  squash(amt) { S.sq = { amt: Math.min(J.landSquash, amt), t: J.squashTime }; },
  onEvent(e, E) {
    const r = S.run, cx = r.x, cy = r.y + T.critterR;
    if (e.k === 'spring') {
      SFX.spring(E); E.haptic(J.haptic.spring); this.squash(0.12 + r.vy / 2500); S.speedT = J.speedLines;
      const g = groundAt(r.field, r.x); if (g) S.pops.set(g, { t: J.springPop });
      word('Boing', r.x - 40, 90, TY.md, J.boingLife); // above the pad, behind the critter flying off
      word(`↑ ${Math.round((r.vy * r.vy) / (2 * T.gravity) / T.unitsPerMetre)} m`, r.x - 40, 50, TY.sm, J.boingLife); // the height it gives
    } else if (e.k === 'bird') {
      SFX.bird(E); E.haptic(J.haptic.bird);
      emit('feather', cx, cy, J.feathers, { speed: 140, g: -120, life: 0.7, size: 2.6, color: P.tealLight });
      let b = null, d = Infinity; // the bird just hit, for its tumble
      for (const q of r.field.birds) if (q.hit && !q.tumbled && Math.abs(q.x0 - r.x) < d) { d = Math.abs(q.x0 - r.x); b = q; }
      if (b) { b.tumbled = true; S.fx.push({ k: 'tumble', x: birdX(b, flightTime(r)), y: b.y, vx: r.vx * 0.3, vy: -80, g: -500, t: J.tumbleTime, max: J.tumbleTime, rot: 0, spin: 9, size: 0 }); }
      if (S.teachBird) { S.teachBird = false; E.save.set('birdTaught', true); S.callouts.push({ text: 'Bird bounce: up and onward!', arrow: true, wx: cx, wy: cy, t: J.callout }); }
    } else if (e.k === 'boost') {
      SFX.boost(E); E.haptic(J.haptic.boost); S.gaugePop = J.gaugePop;
      emit('flame', r.x, r.y + T.critterR, J.flame, { angle: Math.atan2(-r.vy, -r.vx), spread: 0.7, speed: 160, g: 0, life: J.flameLife, size: 3.4, color: P.flame });
    } else if (e.k === 'bounce' || e.k === 'ramp') this.squash(0.1);
    else if (e.k === 'mud') {
      E.audio.play('miss'); E.haptic(J.haptic.mud); E.shake(J.mudShake, J.mudShakeTime);
      emit('splat', cx, 0, J.splat, { angle: Math.PI / 2, spread: Math.PI * 0.8, speed: 150, g: -400, life: 0.6, size: 3, color: P.mud });
      if (S.teachMud) { S.teachMud = false; E.save.set('mudTaught', true); S.endWait = T.endDelayTaught; S.callouts.push({ text: 'Stuck! Jump mud with a boost', arrow: false, wx: cx, wy: cy + 50, t: T.endDelayTaught + 0.2 }); }
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
  // Before launch a press anywhere stops the needle and launches at once; that press never also boosts.
  onPointerDown(p, E) {
    const r = S.run;
    if (!r) { if (this.needleT() < T.readyGrace) return; S.launchPid = p.id; this.launch(E); return; } // a double tap on Launch Again cannot launch
    if (r.ended || p.id === S.launchPid) return;
    const at = this.stamp(r);
    queueInput(r, at, 'pulse');
    if (r.st.hold) { S.pid = p.id; queueInput(r, at + T.holdDelay, 'holdOn'); }
  },
  onPointerUp(p, E) {
    if (p.id === S.launchPid) { S.launchPid = null; return; }
    if (p.id !== S.pid) return;
    S.pid = null;
    const r = S.run;
    if (r && !r.ended) queueInput(r, this.stamp(r), 'holdOff');
  },
  onKey(k, E) {
    if (k !== ' ') return;
    const r = S.run;
    if (!r) { if (this.needleT() < T.readyGrace) return; S.spaceDown = true; this.launch(E); return; }
    if (!r.ended && !S.spaceDown) {
      S.spaceDown = true;
      const at = this.stamp(r);
      queueInput(r, at, 'pulse');
      if (r.st.hold) queueInput(r, at + T.holdDelay, 'holdOn');
    }
  },
  render(ctx, E) {
    const v = view(E), r = S.run, sf = E.safe, gy = v.oy + T.groundY * v.s;
    if (!r) S.needle = needleAngle(this.needleT(), S.up);
    const pre = { needle: S.needle, wedge: r ? clamp(S.wedgeT / T.wedgeFade, 0, 1) : 1, mark: r && S.mark ? S.mark.x : null };
    const info = drawWorld(ctx, E, v, S.cam, r, pre);
    drawHud(E, r, r ? r.fuel : S.st.fuelMax, r ? r.fuelCap : S.st.fuelMax, r ? info : null);
    if (!r && S.hint) { // under the wedge, pulsing, until the first launch of a fresh save
      E.ctx.globalAlpha = 0.7 + 0.3 * Math.sin(E.time * 5);
      pill(E, 'Tap when the needle is in the gold', info.sx + T.wedgeR * v.s * 0.6, Math.min(gy + 30 * v.s, E.h - sf.bottom - 20), TY.md, 'center', P.zones[0]);
      E.ctx.globalAlpha = 1;
    }
    if (S.zonePop) {
      const z = S.zonePop, k = 1 - z.t / J.zonePop, pop = k < 0.2 ? ease.outBack(k / 0.2) : 1;
      E.ctx.globalAlpha = clamp(z.t / 0.25, 0, 1);
      pill(E, ZONES[z.z], z.x, z.y - 16 * k, Math.max(TY.sm, Math.round(TY.lg * pop)), 'center', zoneText(z.z));
      E.ctx.globalAlpha = 1;
    }
    for (const c of S.callouts) {
      if (c.sx === undefined) { // pinned to the screen where it happened, so it can be read while the camera moves on
        const [dx, dy] = toView(S.cam, c.wx, c.wy);
        c.sx = dx * v.s + 48; c.sy = clamp(v.oy + dy * v.s, sf.top + 110, gy - 30); // right of it, at its height: the critter rises out of that column and the bird drifts left as the camera follows
      }
      const age = (c.max ??= c.t) - c.t, y = c.sy - Math.min(age, 1) * 10;
      E.ctx.globalAlpha = clamp(c.t / 0.3, 0, 1) * clamp(age / 0.15, 0, 1);
      const b = pill(E, c.arrow ? `      ${c.text}` : c.text, c.sx, y, TY.md, c.arrow ? 'left' : 'center', P.text); // room for the arrow inside the pill
      if (c.arrow) drawUpArrow(E.ctx, b.x + 24, b.y + b.h - 5 - 2 * Math.sin(E.time * 6), 1);
      E.ctx.globalAlpha = 1;
    }
  },
  onPause(E) { // backgrounding mid-flight ends it (PRD section 3, amendment 6 after the v4 gate): logged once as a quit; back to the menu
    const r = S.run;
    if (!r || S.quit) return;
    S.quit = true;
    if (!r.ended) E.ledger.add('quit', { m: metres(r), t: +flightTime(r).toFixed(1), seed: r.seed });
    else finishFlight(E, r); // it had already stopped: keep its sugar
    E.setScene('menu');
  },
};

// A zone's colour for text on an ink panel (Weak's slate is too dark there).
const zoneText = (z) => (z === 3 ? P.textDim : P.zones[z]);

// An up arrow (the bird call-out's): white with an ink outline, its tip at y - 22 s.
function drawUpArrow(ctx, x, y, s) {
  ctx.fillStyle = P.white; ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x, y - 22 * s); ctx.lineTo(x + 11 * s, y - 10 * s); ctx.lineTo(x + 4 * s, y - 10 * s); ctx.lineTo(x + 4 * s, y);
  ctx.lineTo(x - 4 * s, y); ctx.lineTo(x - 4 * s, y - 10 * s); ctx.lineTo(x - 11 * s, y - 10 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
}

// The card (principle 11): the flight on the left (distance, best, sugar earned, the launch), on the right the rewards as
// tickets (at most three, largest first, then "+n") and the three active goals as rows of name and condition. Text sizes
// 14, 18 and 44 only.
const over = {
  enter(E, p) {
    this.p = p; this.k = p.again ? 1 : 0; this.t0 = p.again ? -Infinity : E.time;
    if (!p.again) E.tween(J.cardSlide, (t) => { this.k = t; }, ease.outBack); // the card slides up; the buttons come after it
  },
  ready(E) { return this.k >= 1 && E.time - this.t0 >= T.cardGrace; }, // boost taps still landing must not dismiss the card
  render(ctx, E) {
    const v = view(E), p = this.p, sf = E.safe;
    if (S.run) drawWorld(ctx, E, v, S.cam, S.run, null);
    ctx.fillStyle = P.shadow; ctx.fillRect(0, 0, E.w, E.h);
    const aw = E.w - sf.left - sf.right, ah = E.h - sf.top - sf.bottom;
    const pw = Math.min(700, aw - 32), ph = Math.min(334, ah - 24), px = sf.left + (aw - pw) / 2;
    const py = Math.max(sf.top + 4, sf.top + (ah - ph) / 2 + (1 - this.k) * (E.h - sf.top)); // the slide's overshoot never passes the top
    E.roundRect(px, py, pw, ph, 18, P.panelSolid, P.panelEdge);
    const lw = Math.round(pw * 0.38), cx = px + lw / 2, count = clamp((E.time - this.t0 - J.cardSlide) / J.countUp, 0, 1);
    E.text(p.why === 'mud' ? 'Stuck in mud' : 'Flight over', cx, py + 26, { size: TY.sm, color: P.textDim, weight: '600' });
    E.text(`${p.m} m`, cx, py + 68, { size: TY.xl, weight: '800', color: P.text });
    E.text(p.isNew ? 'New best!' : `Best ${p.best} m`, cx, py + 108, { size: TY.md, color: p.isNew ? P.tealLight : P.textDim, weight: '600' });
    E.text(`+${Math.round(p.earned * count)} sugar`, cx, py + 138, { size: TY.md, color: P.coin, weight: '800' });
    const zc = zoneText(p.zone);
    E.text(`${ZONES[p.zone].replace('!', '')} launch${p.chainMax ? `, chain x${T.chainSteps[Math.min(p.chainMax, T.chainSteps.length - 1)]}` : ''}`, cx, py + 166, { size: TY.sm, color: zc, weight: '600' });
    E.text(`Seed ${p.seed}`, cx, py + ph - 84, { size: TY.sm, color: P.textOff, weight: '600' });
    // Tickets.
    const rx = px + lw, rw = pw - lw - 16;
    ctx.fillStyle = P.panelEdge; ctx.fillRect(rx - 4, py + 16, 1.5, ph - 92);
    let gy = py + 14;
    if (p.tickets.length) {
      const cap = T.ticketCap, shown = p.tickets.length > cap ? p.tickets.slice(0, cap - 1) : p.tickets, more = p.tickets.length - shown.length;
      const n = shown.length + (more ? 1 : 0), tw = (rw - 12 - (n - 1) * 8) / n;
      shown.forEach((tk, i) => {
        const x = rx + 12 + i * (tw + 8);
        E.roundRect(x, gy, tw, 86, 12, P.panel, P.coin); // name, condition (two lines at most), reward
        E.text(fit(E, fit(E, tk.name, tw - 12, TY.sm, '800') === tk.name ? tk.name : tk.short || tk.name, tw - 12, TY.sm, '800'), x + tw / 2, gy + 16, { size: TY.sm, color: P.text, weight: '800' });
        const cl = wrap(E, tk.cond, tw - 12, TY.sm, '600');
        cl.slice(0, 2).forEach((l, n) => E.text(n === 1 && cl.length > 2 ? fit(E, `${l} ${cl.slice(2).join(' ')}`, tw - 12, TY.sm, '600') : l, x + tw / 2, gy + 35 + n * 17 + (cl.length === 1 ? 8 : 0), { size: TY.sm, color: P.textDim, weight: '600' }));
        E.text(`+${tk.sugar} sugar`, x + tw / 2, gy + 72, { size: TY.sm, color: P.coin, weight: '800' });
      });
      if (more) {
        const x = rx + 12 + shown.length * (tw + 8), rest = p.tickets.slice(shown.length).reduce((a, t) => a + t.sugar, 0);
        E.roundRect(x, gy, tw, 86, 12, P.panel, P.coin);
        E.text(`+${more} more`, x + tw / 2, gy + 34, { size: TY.sm, color: P.text, weight: '800' });
        E.text(`+${rest} sugar`, x + tw / 2, gy + 54, { size: TY.sm, color: P.coin, weight: '800' });
      }
      gy += 96;
    }
    // Goals.
    E.text(p.active.length ? 'Goals' : 'Every goal done!', rx + 12, gy + 4, { size: TY.sm, align: 'left', color: P.textDim, weight: '600' });
    gy += 16;
    for (const a of p.active) gy += goalRow(E, rx + 12, gy, rw - 12, a.g, goalLine(a.g, a.have), a.isNew) + 6;
    if (!this.ready(E)) { this.btnMenu = this.btnAgain = this.btnShop = null; return; }
    const by = py + ph - 38, bw = Math.min(230, pw - 240);
    this.btnMenu = btn(E, 'Menu', px + 16 + 42, by, { w: 84, h: 52, size: TY.md, fill: P.buttonOff });
    this.btnAgain = btn(E, 'Launch Again', px + pw / 2 + 2, by, { w: bw, h: 52, size: TY.md });
    this.btnShop = btn(E, 'Shop', px + pw - 16 - 50, by, { w: 100, h: 52, size: TY.md, fill: P.buttonOff });
  },
  onTap(p, E) {
    if (!this.ready(E)) return;
    if (this.btnAgain && E.hit(this.btnAgain, p)) { E.audio.play('tap'); E.ledger.add('retry', { m: this.p.m, seed: this.p.seed }); E.setScene('play'); }
    else if (this.btnMenu && E.hit(this.btnMenu, p)) E.setScene('menu');
    else if (this.btnShop && E.hit(this.btnShop, p)) { E.audio.play('tap'); E.setScene('shop', { from: 'over', card: this.p }); }
  },
  onKey(k, E) { if ((k === ' ' || k === 'Enter') && this.ready(E)) { E.ledger.add('retry', { m: this.p.m, seed: this.p.seed }); E.setScene('play'); } },
};

// Shortens a string with an ellipsis until it fits `maxW` px.
function fit(E, text, maxW, size, weight) {
  const ctx = E.ctx; ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text; while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t}…`;
}

// A goal as a row card: an empty box, its name, its condition (beside the name when both fit, else under it), and a "NEW"
// tag on one that just took a slot. Returns its height.
function goalRow(E, x, y, w, g, cond, isNew) {
  const ctx = E.ctx, tagW = isNew ? 44 : 0;
  ctx.font = `800 ${TY.sm}px system-ui, sans-serif`; const nw = ctx.measureText(g.name).width;
  ctx.font = `600 ${TY.sm}px system-ui, sans-serif`; const cw = ctx.measureText(cond).width;
  const one = 38 + nw + 12 + cw + tagW <= w, h = one ? 34 : 52;
  E.roundRect(x, y, w, h, 10, P.panel);
  E.roundRect(x + 10, y + h / 2 - 8, 16, 16, 4, P.panelSolid, P.textDim);
  E.text(g.name, x + 36, one ? y + h / 2 : y + 16, { size: TY.sm, align: 'left', color: P.text, weight: '800' });
  E.text(one ? cond : fit(E, cond, w - 44 - tagW, TY.sm, '600'), one ? x + 36 + nw + 12 : x + 36, one ? y + h / 2 : y + 36, { size: TY.sm, align: 'left', color: P.textDim, weight: '600' });
  if (isNew) E.text('NEW', x + w - 10, y + (one ? h / 2 : 16), { size: TY.sm, align: 'right', color: P.tealLight, weight: '800' });
  return h;
}

// ---------- Portrait ----------
// Launch is landscape (ADR-0013). While the phone is held upright the game pauses under a dimmed prompt and takes no input.
const upright = (E) => E.h > E.w;
function landscapeOnly(scene) {
  const out = { ...scene };
  for (const k of ['update', 'onPointerDown', 'onPointerMove', 'onPointerUp', 'onTap', 'onSwipe', 'onKey']) {
    if (scene[k]) out[k] = function (a, E) { if (!upright(E)) return scene[k].call(this, a, E); };
  }
  out.render = function (ctx, E) {
    if (scene.render) scene.render.call(this, ctx, E);
    if (!upright(E)) return;
    ctx.fillStyle = P.panel; ctx.fillRect(0, 0, E.w, E.h);
    const lines = wrap(E, 'Turn your phone sideways', E.w - 64, TY.lg, '800');
    lines.forEach((l, n) => E.text(l, E.w / 2, E.h / 2 + (n - (lines.length - 1) / 2) * (TY.lg + 8), { size: TY.lg, weight: '800', color: P.text }));
  };
  return out;
}

export const game = {
  slug: 'launch',
  title: 'Launch',
  saveVersion: 5,
  // v1 was the skeleton demo (Tap Rush): its score-based best and runs mean nothing here. v2 is { best, coins, ms, flights }.
  // v3 adds `up`, the bought upgrade levels, all 0 for an older save (coins carry over to spend). v4 adds `holdTaught`,
  // false until the first flight with Rocket 1 has shown "Hold to boost" (an older save with Rocket 1 sees it once).
  // v5 (PRD v0.2 B): coins become sugar one for one; `up.steady` at 0; goals start at the top of the list with every distance
  // goal the best already meets done silently (paying nothing); `perfectRow` 0; the bird and mud call-outs not yet shown.
  migrate(data, fromVersion) {
    if (fromVersion < 2) { delete data.best; delete data.runs; }
    if (fromVersion < 3) data.up = { band: 0, fuel: 0, aero: 0, rocket: 0 };
    if (fromVersion < 4) data.holdTaught = false;
    if (fromVersion < 5) {
      data.sugar = data.coins || 0; delete data.coins;
      data.up = { ...data.up, steady: 0 };
      data.goalsDone = GOALS.filter((g) => g.stat === 'm' && (data.best || 0) >= g.need).map((g) => g.id);
      data.perfectRow = 0; data.birdTaught = false; data.mudTaught = false;
    }
    return data;
  },
  TUNING,
  experiments: [
    { key: 'needlePeriod', label: 'Needle period (s)', min: 0.8, max: 3, step: 0.05 },
    { key: 'sweetAngle', label: 'Sweet angle', min: 30, max: 50, step: 0.5 },
    { key: 'zoneScale', label: 'Zone widths (x)', min: 0.5, max: 2, step: 0.05 },
    { key: 'launchSpeedMax', label: 'Launch speed', min: 500, max: 900, step: 10 },
  ],
  // Read by tools/sim-launch.mjs so the harness runs the real physics (S, the play scene's state, lets a browser check set up the HUD).
  sim: { STEP, FIRST_CHUNK, teachingChunk, goodStops, CHUNKS, tierAt, makeField, ensureField, groundAt, birdX, stats, newRun, stepRun, advance, queueInput, metres, coinsOf,
    needleOf, needleAngle, zoneAt, launchAt, needleLaunch, ZONES, GOALS, activeGoals, goalStats, settleGoals, landingMark,
    UPGRADES, effectText, S, predictLanding, newCamera, cameraStep, toView },
  start: 'menu',
  scenes: { menu: landscapeOnly(menu), play: landscapeOnly(play), over: landscapeOnly(over), shop: landscapeOnly(shop) },
};
