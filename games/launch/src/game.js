// Launch: an apricot mochi fired from the Mochi Maker 3000, a steampunk machine at the bakery, toward his love, the daifuku,
// at 5000 m (PRD v0.3). Two beats launch him: the barrel sweeps and a tap locks its angle, then a pressure gauge swings and
// a tap fires with the power of the zone it stopped in. In flight one thumb has three actions, decided by the first
// gestureWindow of a press: hold to boost (cola thrust along the flight, drains fizz), swipe up to open a dough parachute
// (slow fall, bleeds horizontal speed), swipe down to condense (drop fast; a hard landing bounces big). The mochi bounces
// and skims off plain ground; jellies, birds, geysers, wafers and clouds as in v0.2; caramel stops him. The code keeps the
// v0.1 names for the physics objects: a `spring` is a mint jelly, `mud` is a caramel pit, a `ramp` is a wafer, coins are
// sugar. World units: x to the right from the machine's pivot, y is height above the ground (10 units = 1 m); the critter's
// y is the bottom of its body. Physics runs in fixed steps with inputs stamped in flight time; the barrel's angle is a
// function of the time from ready to the first tap, the gauge's reading of the time from the lock to the second tap and
// the flight's seed, so the same seed, tap times and gestures give the same flight at any frame rate (ADR-0008).
// tools/sim-launch.mjs drives game.sim.

import { makeRng, clamp, ease } from './engine.js';

const TUNING = {
  bg: '#2d2238',
  designW: 640,            // landscape design space (ADR-0013); the world fills the width, the ground sits at groundY
  designH: 360,
  groundY: 300,            // design y of the ground line
  physicsStep: 1 / 120,

  // The Mochi Maker 3000 (PRD v0.3 A). Beat 1: the barrel sweeps from aimMin up to aimMax and back at a constant angular
  // speed (period aimPeriod), from aimMin when the machine is ready; a tap locks it. Beat 2: the gauge swings 0 to 1 and back
  // in gaugePeriod; its start phase and a small change of speed (gaugeJitter) are seeded per flight, so the fire tap is read,
  // never a memorised rhythm. Zones are half-widths around gaugeSweet in gauge units: Perfect, Great, Good; Weak elsewhere.
  aimMin: 12,              // degrees
  aimMax: 70,
  aimPeriod: 2.4,          // seconds for one sweep up and back
  gaugePeriod: 0.9,
  gaugeJitter: 0.12,       // the gauge's period x (1 +- this), seeded per flight
  gaugeSweet: 0.78,
  zoneHalf: [0.03, 0.09, 0.19],
  zoneScale: 1,
  zonePower: [1.2, 1.05, 0.88, 0.78], // Perfect, Great, Good, Weak at the Good edge (x launchSpeedMax, Spring Coil applied)
  weakPowerMin: 0.55,      // Weak's power at the gauge's ends (it ramps up to zonePower Weak at the Good edge)
  perfectFuel: 1,          // a Perfect launch tops the tank up by this many pips
  streakSpeedup: 0.08,     // each Perfect in a row: the gauge this much faster ...
  streakPower: 0.04,       // ... and a Perfect launch this much stronger,
  streakCap: 5,            // up to this many steps; any other zone resets the streak
  readyGrace: 0.3,         // seconds after the machine is ready when taps are ignored (a double tap on Launch Again)
  gaugeGrace: 0.15,        // ... and after the barrel locks (a double tap must not fire at once)
  steadySlow: 0.12,        // Steady Gauge: gauge period / (1 - 0.12 per level) ...
  steadyWiden: 0.012,      // ... and every zone this much wider each side per level
  pivotH: 78,              // the barrel's pivot above the ground (units) ...
  barrelLen: 44,           // ... and its length: the mochi leaves from its mouth
  goalSlots: 3,            // goals active at a time (PRD v0.2 B)
  ticketCap: 3,            // reward tickets on the card before "+n more" (principle 11, rule 6)

  launchSpeedMax: 720,     // launch speed of a Perfect launch at base (units/s)
  gravity: 440,            // units/s²
  airDrag: 0.015,           // fraction of speed lost per second in air, base Glaze

  // Bounce (PRD v0.3 C): a plain-ground touch keeps groundBounce of the fall speed and, of the horizontal speed, skimKeep for
  // a grazing touch down to groundKeep for a straight-down one; a grazing touch also hops on skimLift of its horizontal
  // speed, so a fast flat mochi skips like a stone. Under settleSpeed it slides.
  groundBounce: 0.66,
  groundKeep: 0.82,
  skimKeep: 0.95,
  skimLift: 0.12,
  settleSpeed: 45,
  slideFriction: 0.8,      // sliding speed decays as exp(-slideFriction x seconds)
  springBounce: 1.2,       // a jelly gives this times the fall speed back ...
  springMin: 420,          // ... and always at least this
  maxBounce: 1000,         // no bounce leaves faster than this
  birdLift: 340,           // upward speed given by a bird bounce
  stopSpeed: 25,           // horizontal speed under this for stopTime ends the flight (on the ground, or at the next touch)
  stopTime: 0.5,
  maxFlight: 150,          // seconds: a safety stop only (tools/sim-launch.mjs --stuck: no flight reaches it)

  // Three flight actions (PRD v0.3 B). A press is decided by its first gestureWindow: a swipe up or down of swipeMin CSS px
  // opens the parachute or condenses, otherwise it boosts (held: until release; a quick tap: tapBurst seconds).
  gestureWindow: 0.1,
  swipeMin: 22,
  tapBurst: 0.2,
  boostThrust: 1000,       // units/s² along the flight while boosting (never pointing below boostFloor degrees), fading
  boostTop: 1100,          // to nothing at this speed: fizz bends a slow arc hard and adds little to a fast one
  boostFloor: 0,
  boostDrain: 2.5,         // pips of fizz per second of boost
  fuelMax: 5,              // pips in a full tank, base Fizz Tank
  chuteFall: 80,           // the parachute caps the fall at this (units/s), reaching it at chuteGrip per second ...
  chuteGrip: 6,
  chuteBleed: 0.5,         // ... and bleeds this fraction of horizontal speed per second (control, not distance)
  condenseDrop: 620,       // a condense drops at least this fast at once and falls under gravity x condenseGrav; its
  condenseGrav: 1.4,       // touch bounces back up to condenseLift x the height it dropped from (plain ground keeps far
  condenseLift: 0.92,      // less), a jelly x condenseJelly more: the hard landing's big bounce, never an endless pump
  condenseJelly: 1.6,
  condenseKeep: 0.75,      // horizontal speed kept by a condensed touch (ground or jelly): a drop every arc runs down
  groundBoostAngle: 35,    // a boost on the ground hops at this angle

  // The range finder (PRD v0.3 D): a dotted arc of the real physics with the current action, rangeLook seconds ahead.
  rangeLook: 1.5,
  rangeDot: 5,             // physics steps between dots

  // The shop (PRD v0.3 A, D): six upgrades, three levels each, bought with sugar between flights; each bolts a part onto
  // the machine. `upgrades` is the harness's default set.
  upgradePrices: {
    band: [450, 700, 1000],
    fuel: [1650, 1950, 2250],
    aero: [450, 750, 1050],
    rocket: [550, 850, 1100],
    steady: [400, 600, 900],
    scope: [400, 650, 950],
  },
  upgradeMax: 3,
  upgrades: { band: 0, fuel: 0, aero: 0, rocket: 0, steady: 0, scope: 0 },
  bandStep: 0.12,          // Spring Coil: launchSpeedMax x (1 + 0.12 per level)
  fuelStep: 2,             // Fizz Tank: pips per level
  aeroStep: 0.2,           // Sugar Glaze: airDrag x (1 - 0.2 per level)
  rocketStep: 0.25,        // Cola Rocket: boost thrust x (1 + 0.25 per level)
  scopeStep: 0.6,          // Brass Telescope: rangeLook + 0.6 s per level

  critterR: 12,
  rampKeep: 1,             // speed kept when a ramp redirects the critter along its slope
  birdR: 15,
  birdSwing: 50,           // birds glide back and forth this far either side of their spot
  birdPeriod: 3.2,         // seconds for one glide there and back
  unitsPerMetre: 10,
  coinPer10m: 1,
  chainSteps: [1, 1.5, 2, 3], // coin multiplier by consecutive springs or birds
  birdCoins: 5,
  milestones: [500, 1000, 2000, 3500, 5000], // metres
  milestoneBonus: [25, 50, 100, 200, 400],

  // A soda geyser (Soda Springs on) erupts for geyserOn every geyserPeriod on the flight clock (phase seeded at setup);
  // its column lifts at geyserLift keeping vx, once per vent per flight. A cotton-candy cloud (Gingerbread Town on) takes
  // cloudDrag of the speed and refills cloudFuel pips, once per cloud.
  geyserOn: 0.8,
  geyserPeriod: 2.4,
  geyserLift: 520,
  geyserH: 200,
  cloudDrag: 0.15,
  cloudFuel: 1,
  cloudRX: 50,
  cloudRY: 28,
  lookahead: 4000,         // field generated this far ahead of the critter

  // Presentation
  placeBlend: 400,         // units over which the sky and hills of one place blend into the next (the ground changes at the line)
  homeAhead: 120,          // the daifuku waits this far past the Home line (units)
  jellyCube: 34,           // design px per jelly cube along a jelly (a long jelly is a row of cubes, never a rail)
  menuTitleMinH: 344,      // CSS px of safe height the menu needs to show its title above the strip, the best and three goals
  slingScreen: 0.26,       // the machine's pivot at this fraction of the view width before launch
  followX: 0.3,            // the camera keeps the critter at this fraction of the view width
  followXMin: 0.1,         // ... or as far left as this when the arc's landing is too far ahead for zoomMin
  zoomMin: 0.45,
  zoomLook: 1.0,           // seconds of horizontal travel kept in view ahead of the critter
  zoomOutTime: 0.35,
  zoomInTime: 0.9,
  landMargin: 30,
  skyTop: 50,
  skyFill: 0.8,
  spriteMin: 0.65,
  endDelay: 0.9,
  endDelayTaught: 2.4,
  cardGrace: 0.4,

  palette: {
    skyDusk: ['#f3a9b8', '#8f6fb0'],
    skyNight: ['#4a3a78', '#1d1a3a'],
    ink: '#2d2238',
    critter: '#ff8a1a', critterLight: '#ffb366', eye: '#ffffff', powder: '#fff6ec',
    teal: '#1ea896', tealLight: '#7fe0d2', tealSpent: '#8fb3ad',
    bird: '#5fcbb8', birdWing: '#a9eadf', birdRim: '#ffffff',
    mud: '#341b08', mudDeep: '#1f0f04', mudRim: '#f6d7a4', mudBubble: '#6b3d12', mudSheen: '#9a5c16',
    zones: ['#ffd84d', '#f59bc2', '#4a7fd4', '#584a70'], // gauge zones: Perfect gold, Great rose, Good blue, Weak slate (never orange)
    // The Mochi Maker 3000: brass and plum iron, never orange; bulbs by zone (green, amber, red; every bulb on a Perfect).
    brass: '#c9a24a', brassLight: '#f2d98a', brassDark: '#8a6a2a', iron: '#5a4a6e', ironDark: '#3a3048', dial: '#fff8e6',
    bulbOff: '#6e6278', bulb: ['#ffe680', '#5fd36e', '#ffcf3d', '#ff5a5a'], steam: '#ffffff', spring: '#b9c0d4',
    ramp: '#efdcb4', rampPlank: '#c9a774',
    glass: '#cfeaf8', soda: '#6aa8e0', cap: '#e8476a',
    nozzle: '#9aa0b8', cola: '#6e3626', colaRim: '#f3dcc4', fizz: '#ffffff', glaze: '#f7a8c8',
    vent: '#e6eef8', ventHole: '#3b4a6b', column: '#f2fbff', columnSpent: '#c9dad8',
    cloud: '#f8bfdc', cloudBlue: '#cfe2fb', cloudUsed: '#f3dbe8',
    dough: '#fff0f4', berry: '#e8476a', seed: '#ffe9a8', leaf: '#6fae5a', blush: '#f7a8bf', heart: '#ef5b8a',
    shopWall: '#fbe9d3', awning: '#f29bb5', post: '#ffffff',
    gumdrops: ['#f7a8c8', '#aed9f0', '#c9e79f', '#f4e394'], house: ['#dcb595', '#c99c7a'], river: ['#cfa48a', '#ecd2c0'],
    sugar: '#fffaf0',
    star: '#fff6e0', coin: '#ffd84d',
    button: '#6b5aa6', buttonOff: '#4a3f5e',
    panel: 'rgba(45,34,56,0.84)', panelSolid: '#2d2238', panelEdge: '#5a4a72',
    text: '#fff6ec', textDim: '#cbbfdc', textOff: '#8f84a3',
    shadow: 'rgba(45,34,56,0.28)', dust: '#efe2cf', white: '#ffffff', halo: '#fff6ec',
    arc: ['#ffffff', '#bfe6ff', '#fff0d6', '#ffd2a8'], // range finder dots: plain, boosting, parachute, condensed
  },
  duskAt: 120,
  nightAt: 300,
  hillFadeLift: 40,
  style: { line: 2, radius: 14 },
  type: { sm: 14, md: 18, lg: 28, xl: 44 },

  // Juice: all cosmetic, never read by the physics.
  juice: {
    particleCap: 220,
    kick: 3, kickTime: 0.12, dust: 10,
    fizz: 10, fizzLife: 0.45, fizzTrail: 0.75, gaugePop: 0.25,
    landSquash: 0.35, squashTime: 0.3, bounceSquash: 0.0006, // squash per unit/s of impact
    springPop: 0.3, speedLines: 0.45, speedLineMin: 900, boingLife: 0.8,
    feathers: 12, tumbleTime: 1.3,
    chainPop: 0.35, chainLife: 1.0, coins: [0, 3, 5, 8],
    splat: 16, mudShake: 6, mudShakeTime: 0.25,
    bigBounce: 500,        // an impact this fast shakes the screen ...
    bounceShake: 5, bounceShakeTime: 0.2,
    bannerTime: 1.8, countUp: 0.6, cardSlide: 0.35,
    geyserWarn: 0.5,
    hearts: 14, homeTime: 2.4,
    zonePop: 1.1,
    zoneFreq: [1320, 990, 740, 330],
    zoneHaptic: [30, 16, 10, 6],
    perfectShake: 7, perfectShakeTime: 0.3,
    slowMo: 0.2, slowMoRate: 0.3, // a Perfect launch's slow-motion beat: real seconds, and flight seconds per real second
    sparks: 18,
    steam: [22, 12, 7, 3], // steam puffs on fire by zone
    pump: 0.35,            // seconds the pistons pump after a fire
    callout: 2.6,
    actionHint: 3.6,       // seconds the three-action hint shows from the top of the first arc
    springWobble: 0.3,
    stars: 90,
    whoosh: 0.16,          // seconds between whoosh puffs while boosting
    haptic: { launch: 12, boost: 6, spring: 10, bird: 8, mud: 30, milestone: 20, geyser: 12, cloud: 6, lock: 10, chute: 6, drop: 8, home: [30, 60, 30, 60, 60] },
  },
};
const T = TUNING;
const STEP = T.physicsStep;
const DEG = Math.PI / 180;

// ---------- Places (PRD v0.2 E) ----------
// The mochi flies from the bakery counter home to the daifuku; each milestone opens a place with its own sky by day, rolling
// hills (two sines each: frequencies f, weights w, amplitude amp and base in design px, a seed), ground (top strip and soil)
// and backdrop motif. Places start at 0 and at each TUNING.milestones distance; Home flies on the tier 3 field.
// Style sentences: docs/games/launch/style.md.
const PLACES = [
  { name: 'The Bakery', sky: ['#fff1dc', '#f5c1c6'], top: '#7fae6a', soil: '#5f8a58', motif: 'bakery',
    hills: { far: '#ecc0c4', near: '#dca5b3', f: [0.006, 0.0137], w: [0.5, 0.35], amp: [46, 34], base: [70, 40], seed: [1.3, 4.1] } },
  { name: 'Candy Meadow', sky: ['#f6f8e4', '#eec3dd'], top: '#88c27a', soil: '#5c8f5f', motif: 'gumdrops',
    hills: { far: '#f2c9df', near: '#cbe4b8', f: [0.011, 0.023], w: [0.55, 0.3], amp: [40, 30], base: [62, 36], seed: [0.4, 2.2] } },
  { name: 'Chocolate River', sky: ['#fbebdc', '#e9bdb8'], top: '#c09474', soil: '#957059', motif: 'river',
    hills: { far: '#ead0c0', near: '#dcb8a4', f: [0.0045, 0.01], w: [0.6, 0.25], amp: [52, 30], base: [74, 44], seed: [2.7, 0.9] } },
  { name: 'Soda Springs', sky: ['#eaf6f3', '#c3c9ef'], top: '#9db3da', soil: '#6a78a8', motif: 'bubbles',
    hills: { far: '#d3dbf3', near: '#bcc8ec', f: [0.008, 0.019], w: [0.45, 0.45], amp: [58, 36], base: [64, 40], seed: [3.3, 5.0] } },
  { name: 'Gingerbread Town', sky: ['#fbf1d8', '#e8c3cb'], top: '#bf9a78', soil: '#937260', motif: 'houses',
    hills: { far: '#ead3be', near: '#dcbda2', f: [0.0035, 0.008], w: [0.4, 0.3], amp: [34, 24], base: [74, 42], seed: [4.6, 1.7] } },
  { name: 'Home', sky: ['#fff1f2', '#f4bfd3'], top: '#86b86f', soil: '#5c8a58', motif: 'strawberries',
    hills: { far: '#f4c8d6', near: '#cfe6bf', f: [0.007, 0.016], w: [0.5, 0.35], amp: [44, 32], base: [66, 38], seed: [5.9, 3.4] } },
];
const placeFrom = (i) => (i ? T.milestones[i - 1] : 0) * T.unitsPerMetre; // units
function placeIndex(x) { let i = 0; while (i + 1 < PLACES.length && x >= placeFrom(i + 1)) i++; return i; }


// ---------- The Mochi Maker 3000 (PRD v0.3 A) ----------
// Zones by index: 0 Perfect, 1 Great, 2 Good, 3 Weak.
const ZONES = ['Perfect!', 'Great', 'Good', 'Weak'];
const tri = (t, period) => { const ph = (((t / period) % 1) + 1) % 1; return ph < 0.5 ? ph * 2 : 2 - ph * 2; };
// The barrel's angle `t` seconds after the machine was ready.
const aimAngle = (t) => T.aimMin + (T.aimMax - T.aimMin) * tri(t, T.aimPeriod);
// A flight's gauge: its period (Steady Gauge slows it, a Perfect streak speeds it up, the seed nudges it), its seeded start
// phase, and its zone half-widths.
function gaugeOf(seed, streak = 0, up = T.upgrades) {
  const rng = makeRng((seed ^ 0x5bd1e995) >>> 0), k = up.steady || 0, w = T.steadyWiden * k, s = Math.min(streak, T.streakCap);
  const nudge = 1 + rng.range(-T.gaugeJitter, T.gaugeJitter);
  return { period: (T.gaugePeriod * nudge) / Math.max(0.05, 1 - T.steadySlow * k) / (1 + T.streakSpeedup * s), phase: rng(), half: T.zoneHalf.map((h) => (h + w) * T.zoneScale) };
}
// The gauge's reading (0 to 1) `t` seconds after the barrel locked.
const gaugeAt = (t, g) => tri(t + g.phase * g.period, g.period);
function zoneOf(v, g) { const d = Math.abs(v - T.gaugeSweet); return d <= g.half[0] ? 0 : d <= g.half[1] ? 1 : d <= g.half[2] ? 2 : 3; }
// Weak's power ramps from zonePower Weak at the Good edge down to weakPowerMin at the gauge's end (no cliff).
function powerOf(v, g, streak = 0) {
  const z = zoneOf(v, g);
  if (z === 0) return T.zonePower[0] * (1 + T.streakPower * Math.min(streak, T.streakCap));
  if (z < 3) return T.zonePower[z];
  const edge = g.half[2], end = v < T.gaugeSweet ? T.gaugeSweet : 1 - T.gaugeSweet;
  const k = clamp((Math.abs(v - T.gaugeSweet) - edge) / Math.max(1e-6, end - edge), 0, 1);
  return T.zonePower[3] + (T.weakPowerMin - T.zonePower[3]) * k;
}
// The launch from the two taps: `t1` seconds from ready to the lock, `t2` from the lock to the fire; `streak` Perfect
// launches in a row before this one.
function launchOf(seed, t1, t2, streak = 0, up = T.upgrades) {
  const g = gaugeOf(seed, streak, up), v = gaugeAt(t2, g), zone = zoneOf(v, g);
  return { angle: aimAngle(t1), gauge: v, zone, power: powerOf(v, g, streak), streak, t1, t2 };
}
// The barrel's mouth at an angle: where the mochi sits and leaves from (world units, y the critter's bottom).
const mouth = (deg) => [Math.cos(deg * DEG) * T.barrelLen, T.pivotH + Math.sin(deg * DEG) * T.barrelLen - T.critterR];

// ---------- Field (PRD v0.3 C) ----------
// One consistent field, laid out gap by gap from a seeded stream: a jelly, then plain ground to the next jelly that grows
// gently with distance (no free early carpet, no cliff), holding at most one caramel pit, one bird or cloud, and one wafer or
// geyser. Every gap draws the same count of numbers, so a seed always gives the same field. Kept by construction (and flown
// by tools/sim-launch.mjs --check): a jelly before the first caramel and between any two, no stretch longer than gapMax
// without a jelly, geysers from Soda Springs, clouds from Gingerbread Town, at most one air object per gap. Metres.
const FIELD = {
  first: 75,               // the first jelly starts here
  gap: 42,                 // plain ground between jellies: gap + gapGrow x distance, +- gapJitter of it, at most gapMax
  gapGrow: 0.011,
  gapJitter: 0.25,
  gapMax: 120,
  jellyW: 11,              // a jelly's width, shrinking by jellyShrink per metre to jellyWMin
  jellyShrink: 0.0008,
  jellyWMin: 6,
  mudFrom: 400,            // caramel from here, with this chance per gap rising to mudMax by mudFull
  mudChance: 0.2,
  mudMax: 0.55,
  mudFull: 3500,
  mudW: [9, 15],
  birdChance: 0.4,         // a bird in a gap ...
  birdY: [10, 24],         // ... this high (its centre)
  rampFrom: 400,           // a wafer from here, with this chance per gap
  rampChance: 0.2,
  rampW: [20, 28], rampH: [6, 8],
  geyserFrom: 2000,        // Soda Springs on: a ground object is a geyser this often
  geyserShare: 0.65,
  extraFrom: 2000,         // ... and ground objects come this often from here
  extraChance: 0.4,
  cloudFrom: 3500,         // Gingerbread Town on: the air object is a cloud this often
  cloudChance: 0.45,
  cloudY: [20, 30],
};

function makeField(seed) {
  return { seed, rng: makeRng(seed), ground: [], birds: [], clouds: [], end: 0, next: FIELD.first * T.unitsPerMetre };
}

function addGap(f) {
  const F = FIELD, U = T.unitsPerMetre, rng = f.rng, x0 = f.next, m = x0 / U, lerp = (a, k) => a[0] + (a[1] - a[0]) * k;
  const r = Array.from({ length: 12 }, () => rng());
  const w = Math.round(Math.max(F.jellyWMin, F.jellyW - F.jellyShrink * m) * U);
  f.ground.push({ kind: 'spring', x0, x1: x0 + w, w, h: 0, spent: false });
  const L = Math.round(Math.min(F.gapMax, (F.gap + F.gapGrow * m) * (1 + (r[0] * 2 - 1) * F.gapJitter)) * U), a = x0 + w, b = a + L;
  let free = a + 3 * U; // ground objects keep 3 m from each other and from the jellies
  const extraP = m >= F.extraFrom ? F.extraChance : m >= F.rampFrom ? F.rampChance : 0;
  if (r[1] < extraP) {
    const geyser = m >= F.geyserFrom && r[2] < F.geyserShare, gx = Math.round(a + L * (0.08 + 0.1 * r[3]));
    if (geyser) { f.ground.push({ kind: 'geyser', x0: gx, x1: gx + 40, w: 40, h: 0, spent: false, phase: Math.round(r[4] * T.geyserPeriod * 100) / 100 }); free = gx + 40 + 3 * U; }
    else {
      const rw = Math.round(Math.min(lerp(F.rampW, r[4]) * U, L * 0.3)), rh = Math.round(lerp(F.rampH, r[4]) * U);
      f.ground.push({ kind: 'ramp', x0: gx, x1: gx + rw, w: rw, h: rh, spent: false, a: Math.atan2(rh, rw) }); free = gx + rw + 3 * U;
    }
  }
  const mudP = m < F.mudFrom ? 0 : F.mudChance + (F.mudMax - F.mudChance) * clamp((m - F.mudFrom) / (F.mudFull - F.mudFrom), 0, 1);
  if (r[5] < mudP) {
    const mw = Math.round(lerp(F.mudW, r[6]) * U), c0 = Math.max(free + mw / 2, a + L * 0.4), c1 = b - 3 * U - mw / 2;
    if (c1 >= c0) { const mx = Math.round(c0 + (c1 - c0) * r[7] - mw / 2); f.ground.push({ kind: 'mud', x0: mx, x1: mx + mw, w: mw, h: 0, spent: false }); }
  }
  const ax = Math.round(a + L * (0.3 + 0.4 * r[9]));
  if (m >= F.cloudFrom && r[8] < F.cloudChance) f.clouds.push({ x: ax, y: Math.round(lerp(F.cloudY, r[10]) * U), used: false });
  else if (r[8] < F.birdChance) f.birds.push({ x0: ax, y: Math.round(lerp(F.birdY, r[10]) * U), phase: r[11] * Math.PI * 2, hit: false });
  f.ground.sort((p, q) => p.x0 - q.x0);
  f.next = b; f.end = b;
}

function ensureField(f, x) { while (f.end < x + T.lookahead) addGap(f); }

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
const geyserOn = (g, t) => (t + g.phase) % T.geyserPeriod < T.geyserOn;
const inCloud = (c, x, cy) => { const dx = (c.x - x) / (T.cloudRX + T.critterR), dy = (c.y - cy) / (T.cloudRY + T.critterR); return dx * dx + dy * dy < 1; };
const birdX = (b, t) => b.x0 + T.birdSwing * Math.sin((t / T.birdPeriod) * Math.PI * 2 + b.phase);

// ---------- Flight ----------

// A flight's numbers at a set of upgrade levels.
function stats(up = T.upgrades) {
  const airDrag = T.airDrag * Math.max(0, 1 - T.aeroStep * (up.aero || 0));
  return {
    launchSpeed: T.launchSpeedMax * (1 + T.bandStep * (up.band || 0)),
    fuelMax: T.fuelMax + T.fuelStep * (up.fuel || 0),
    airDrag,
    dragK: Math.pow(1 - airDrag, STEP),
    chuteK: Math.exp(-T.chuteBleed * STEP),
    slideK: Math.exp(-T.slideFriction * STEP),
    thrust: T.boostThrust * (1 + T.rocketStep * (up.rocket || 0)),
    look: T.rangeLook + T.scopeStep * (up.scope || 0),
  };
}

// A launch is { angle, power, zone } (launchOf gives one from two tap times).
function newRun(seed, launch, up = T.upgrades, field = null) {
  const st = stats(up), sp = launch.power * st.launchSpeed, a = launch.angle * DEG, [x, y] = mouth(launch.angle);
  if (!field) { field = makeField(seed); ensureField(field, 0); }
  const fuel = st.fuelMax + (launch.zone === 0 ? T.perfectFuel : 0);
  return {
    seed, launch, up: { ...up }, st, field,
    x, y, vx: sp * Math.cos(a), vy: sp * Math.sin(a), mode: 'air', ramp: null, u: 0,
    fuel, fuelCap: fuel, boost: false, burstEnd: -1, chute: false, ball: false, dropTop: 0, steps: 0, acc: 0, q: [], ev: [],
    chain: 0, chainMax: 0, birds: 0, springs: 0, geysers: 0, clouds: 0, bounces: 0, combo: 0, comboMax: 0,
    boosts: 0, boostT: 0, chutes: 0, drops: 0, coinAcc: 0, nextMark: 10 * T.unitsPerMetre, maxX: x,
    msIdx: 0, stars: [], slowT: 0, ended: null, timeout: false, boosted: false, boostSprings: 0,
  };
}

const flightTime = (r) => r.steps * STEP;
const mult = (r) => T.chainSteps[Math.min(r.chain, T.chainSteps.length - 1)];

// Queue an input at flight time `at` (seconds); it applies on the step that contains that time. Kinds: boostOn, boostOff,
// burst (a quick tap: boost for tapBurst), chuteOn, chuteOff, condense.
function queueInput(r, at, kind) {
  r.q.push({ at, kind });
  r.q.sort((a, b) => a.at - b.at);
}

function applyInput(r, e) {
  const k = e.kind;
  if (k === 'boostOn' || k === 'burst') {
    if (!r.boost) { r.boosts++; r.ev.push({ k: 'boost' }); }
    r.boost = true; r.burstEnd = k === 'burst' ? e.at + T.tapBurst : -1;
  } else if (k === 'boostOff') { r.boost = false; r.burstEnd = -1; }
  else if (k === 'chuteOn') { if (!r.chute) { r.chutes++; r.ev.push({ k: 'chute' }); } r.chute = true; r.ball = false; }
  else if (k === 'chuteOff') { if (r.chute) r.ev.push({ k: 'chuteOff' }); r.chute = false; }
  else if (k === 'condense' && r.mode === 'air') {
    r.dropTop = r.y + Math.max(0, r.vy) ** 2 / (2 * T.gravity); // the top of this arc: what the hard landing gives back
    r.ball = true; r.chute = false; r.vy = Math.min(r.vy, -T.condenseDrop); r.drops++; r.ev.push({ k: 'drop' });
  }
}

// One air step of `dt` for a state { x, y, vx, vy, boost, chute, ball, fuel }: thrust while boosting (along the flight, never
// pointing below boostFloor, fading to nothing at boostTop), gravity (heavier while condensed), drag, then the parachute's bleed and capped fall. `kd` and
// `kc` are the drag and bleed factors for `dt`. The flight and the range finder both step with this.
function airStep(s, st, dt, kd, kc) {
  if (s.boost && s.fuel > 0) {
    const sp = Math.hypot(s.vx, s.vy), part = Math.min(1, s.fuel / (T.boostDrain * dt)) * Math.max(0, 1 - sp / T.boostTop), floor = Math.sin(T.boostFloor * DEG);
    let ux = sp > 1 ? s.vx / sp : Math.cos(T.groundBoostAngle * DEG), uy = sp > 1 ? s.vy / sp : Math.sin(T.groundBoostAngle * DEG);
    if (uy < floor) { uy = floor; ux = Math.sqrt(1 - floor * floor); }
    s.fuel = Math.max(0, s.fuel - T.boostDrain * dt);
    s.vx += ux * st.thrust * dt * part; s.vy += uy * st.thrust * dt * part;
  }
  s.vy -= T.gravity * (s.ball ? T.condenseGrav : 1) * dt;
  s.vx *= kd; s.vy *= kd;
  if (s.chute) { s.vx *= kc; if (s.vy < -T.chuteFall) s.vy += (-T.chuteFall - s.vy) * Math.min(1, T.chuteGrip * dt); }
  s.x += s.vx * dt; s.y += s.vy * dt;
}

function end(r, why) { r.ended = why; r.vx = r.vy = 0; r.boost = r.chute = r.ball = false; r.ev.push({ k: why }); }
const bump = (r) => { r.chain++; r.chainMax = Math.max(r.chainMax, r.chain); r.combo++; r.comboMax = Math.max(r.comboMax, r.combo); };

// A jelly: at least springMin up, or springBounce of the fall; condensed, condenseJelly x the condensed bounce (the big one).
const dropBack = (r) => Math.sqrt(2 * T.gravity * Math.max(0, r.dropTop)) * T.condenseLift;
function hitSpring(r, g, vyIn) {
  g.spent = true;
  if (r.boosted) r.boostSprings++;
  r.boosted = false;
  const big = r.ball;
  if (big) r.vx *= T.condenseKeep;
  r.vy = Math.min(T.maxBounce, Math.max(T.springMin, big ? dropBack(r) * T.condenseJelly : -vyIn * T.springBounce));
  r.y = 0; r.mode = 'air'; r.ball = false;
  r.springs++; bump(r);
  r.ev.push({ k: 'spring', x: r.x, chain: r.chain, big, v: -vyIn });
}

function hitGeyser(r, g) {
  g.spent = true; r.boosted = false; r.ball = false;
  r.vy = Math.max(r.vy, T.geyserLift); r.y = Math.max(r.y, 0); r.mode = 'air';
  r.geysers++; bump(r);
  r.ev.push({ k: 'geyser', x: r.x, chain: r.chain });
}

function enterRamp(r, g, speed) {
  r.boosted = false; r.ball = false;
  if (r.vx <= 0) { r.vx = 0; r.vy = 0; r.mode = 'ground'; r.y = 0; return; }
  r.mode = 'ramp'; r.ramp = g; r.u = speed * T.rampKeep;
  r.y = surfaceH(g, r.x); r.vx = r.u * Math.cos(g.a); r.vy = r.u * Math.sin(g.a);
  r.ev.push({ k: 'ramp' });
}

// A plain-ground touch (PRD v0.3 C): the bounce keeps groundBounce of the fall (condensed: back to condenseLift x the height
// it dropped from), and a grazing
// touch skims, hopping on skimLift of its horizontal speed; horizontal speed kept from skimKeep (grazing) to groundKeep
// (straight down), condenseKeep when condensed. A flight slow for stopTime ends here.
function plainTouch(r) {
  r.chain = 0; r.boosted = false; r.y = 0;
  if (r.slowT >= T.stopTime) { end(r, 'stop'); return; }
  const vin = -r.vy, sp = Math.hypot(r.vx, r.vy) || 1, steep = vin / sp, ball = r.ball;
  r.ball = false;
  r.vx *= ball ? T.condenseKeep : T.skimKeep + (T.groundKeep - T.skimKeep) * steep;
  const out = Math.min(T.maxBounce, ball ? dropBack(r) : Math.max(vin * T.groundBounce, Math.abs(r.vx) * T.skimLift * (1 - steep)));
  if (out >= T.settleSpeed) { r.vy = out; r.bounces++; r.combo++; r.comboMax = Math.max(r.comboMax, r.combo); r.ev.push({ k: 'bounce', v: vin, big: ball, skim: steep < 0.35 }); }
  else { r.vy = 0; r.mode = 'ground'; r.combo = 0; r.ev.push({ k: 'land', v: vin }); }
}

// One fixed physics step.
function stepRun(r) {
  if (r.ended) return;
  const f = r.field, st = r.st, t1 = (r.steps + 1) * STEP;
  while (r.q.length && r.q[0].at < t1) applyInput(r, r.q.shift());
  if (r.burstEnd >= 0 && t1 > r.burstEnd) { r.boost = false; r.burstEnd = -1; }
  const fueled = r.boost && r.fuel > 0;
  if (fueled) { r.boosted = true; r.boostT += STEP; }

  if (r.mode === 'air') {
    airStep(r, st, STEP, st.dragK, st.chuteK);
    const t = t1, cy = r.y + T.critterR;
    for (const b of f.birds) {
      if (b.hit || Math.abs(b.x0 - r.x) > T.birdSwing + 40) continue;
      if (Math.hypot(birdX(b, t) - r.x, b.y - cy) < T.critterR + T.birdR) {
        b.hit = true; r.boosted = false; r.ball = false;
        r.vy = Math.max(r.vy, T.birdLift);
        r.birds++; bump(r);
        r.ev.push({ k: 'bird', x: r.x, chain: r.chain });
      }
    }
    for (const c of f.clouds) {
      if (c.used || Math.abs(c.x - r.x) > T.cloudRX + T.critterR || !inCloud(c, r.x, cy)) continue;
      c.used = true;
      r.vx *= 1 - T.cloudDrag; r.vy *= 1 - T.cloudDrag;
      r.fuel = Math.min(r.fuelCap, r.fuel + T.cloudFuel); r.clouds++;
      r.ev.push({ k: 'cloud', x: c.x, y: c.y });
    }
    const g = groundAt(f, r.x);
    if (g && g.kind === 'geyser' && !g.spent && r.y < T.geyserH && geyserOn(g, t)) hitGeyser(r, g);
    else if (r.y <= surfaceH(g, r.x) && (r.vy <= 0 || (g && g.kind === 'ramp'))) {
      const vyIn = r.vy;
      if (g && g.kind === 'mud') { r.y = 0; end(r, 'mud'); }
      else if (g && g.kind === 'spring' && !g.spent) hitSpring(r, g, vyIn);
      else if (g && g.kind === 'ramp') enterRamp(r, g, Math.hypot(r.vx, r.vy));
      else plainTouch(r);
    }
  } else if (r.mode === 'ground') {
    if (fueled) { // a boost on the ground hops
      r.fuel = Math.max(0, r.fuel - T.boostDrain * STEP);
      r.vx += Math.cos(T.groundBoostAngle * DEG) * st.thrust * STEP; r.vy = Math.sin(T.groundBoostAngle * DEG) * st.thrust * STEP;
      r.mode = 'air'; r.y = 0.01;
    } else {
      r.vx *= st.slideK;
      r.x += r.vx * STEP;
      const g = groundAt(f, r.x);
      if (g && g.kind === 'mud') end(r, 'mud');
      else if (g && g.kind === 'spring' && !g.spent) hitSpring(r, g, 0);
      else if (g && g.kind === 'geyser' && !g.spent && geyserOn(g, t1)) hitGeyser(r, g);
      else if (g && g.kind === 'ramp') enterRamp(r, g, Math.abs(r.vx));
      else r.chain = 0;
    }
  } else if (r.mode === 'ramp') {
    const g = r.ramp;
    r.u = r.u * st.dragK - T.gravity * Math.sin(g.a) * STEP + (fueled ? st.thrust * STEP : 0);
    if (fueled) r.fuel = Math.max(0, r.fuel - T.boostDrain * STEP);
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
  // Slow means horizontally slow: on the ground it ends after stopTime, in the air at the next plain touch.
  if (Math.abs(r.vx) < T.stopSpeed) { r.slowT += STEP; if (r.mode !== 'air' && r.slowT >= T.stopTime) end(r, 'stop'); }
  else r.slowT = 0;
  if (!r.ended && flightTime(r) >= T.maxFlight) { r.timeout = true; end(r, 'stop'); }
}

// Frame-rate independent advance: whole steps only, the remainder carried.
function advance(r, dt) {
  r.acc += dt;
  while (r.acc >= STEP && !r.ended) { stepRun(r); r.acc -= STEP; }
}

const metres = (r) => Math.floor(r.maxX / T.unitsPerMetre);
const coinsOf = (r) => Math.floor(r.coinAcc) + r.birds * T.birdCoins;

// ---------- The range finder (PRD v0.3 D) ----------
// The flight's own air step run forward from a copy of its state with the current action kept (a held boost until the
// fizz runs out, a tap's burst to its end, the parachute, the condensed drop), for `look` seconds or to the first contact:
// a bird, an erupting geyser's column, or the ground (a jelly, caramel, a wafer or plain). The field is only read. Dots
// every rangeDot steps go into `out` as x, y pairs. Returns { n: dots, hit: contact reached, x, kind } or null off the air.
function rangeArc(r, look, out) {
  if (r.mode !== 'air' || r.ended) return null;
  const f = r.field, st = r.st, s = { x: r.x, y: r.y, vx: r.vx, vy: r.vy, boost: r.boost, chute: r.chute, ball: r.ball, fuel: r.fuel };
  const R = T.critterR + T.birdR, near = f.birds.filter((b) => !b.hit && Math.abs(b.x0 - r.x) < 4000);
  let n = 0, t = flightTime(r);
  const steps = Math.ceil(look / STEP);
  for (let i = 1; i <= steps; i++) {
    t += STEP;
    if (r.burstEnd >= 0 && t > r.burstEnd) s.boost = false;
    airStep(s, st, STEP, st.dragK, st.chuteK);
    if (out && i % T.rangeDot === 0) { out[2 * n] = s.x; out[2 * n + 1] = s.y; n++; }
    const cy = s.y + T.critterR;
    for (const b of near) if (Math.abs(b.x0 - s.x) <= T.birdSwing + 40 && Math.hypot(birdX(b, t) - s.x, b.y - cy) < R) return { n, hit: true, x: s.x, y: s.y, kind: 'bird' };
    if (s.y > T.geyserH) continue; // high up: nothing on the ground reaches
    const g = groundAt(f, s.x);
    if (g && g.kind === 'geyser' && !g.spent && s.y < T.geyserH && geyserOn(g, t)) return { n, hit: true, x: s.x, y: s.y, kind: 'geyser' };
    if (s.y <= surfaceH(g, s.x) && (s.vy <= 0 || (g && g.kind === 'ramp'))) return { n, hit: true, x: s.x, y: surfaceH(g, s.x), kind: !g ? 'ground' : g.kind === 'spring' ? (g.spent ? 'ground' : 'spring') : g.kind === 'geyser' ? 'ground' : g.kind };
  }
  return { n, hit: false, x: s.x, y: s.y, kind: null };
}

// ---------- Goals (PRD v0.2 B, G2) ----------
// In order of difficulty; three are active at a time (the first three not done). A flight pays every active goal it meets,
// on the card, and the next in the list takes its place. Each is a name in the candy kitchen's trade and a short plain
// condition; `stat` is a number from the flight's summary (goalStats), met at `need`; `count` goals show "have/need".
const GOALS = [
  { id: 'reach300', name: 'Warm Oven', text: 'Reach 300 m', stat: 'm', need: 300, reward: 80 },
  { id: 'great', name: 'Good Knead', text: 'Launch Great or better', stat: 'great', need: 1, reward: 80 },
  { id: 'bird', name: 'Feather Whisk', text: 'Bounce off a bird', stat: 'birds', need: 1, reward: 100 },
  { id: 'reach500', name: 'Rising Dough', text: 'Reach 500 m', stat: 'm', need: 500, reward: 120 },
  { id: 'springs5', name: 'Jelly Hopper', text: 'Hit 5 jellies in one flight', stat: 'springs', need: 5, reward: 120, count: true },
  { id: 'fly5', name: 'Five Batches', text: 'Fly 5 times', stat: 'flights', need: 5, reward: 100, count: true },
  { id: 'perfect', name: 'Golden Crust', text: 'Launch Perfect', stat: 'perfect', need: 1, reward: 150 },
  { id: 'boostSpring', name: 'Fizz Drop', text: 'Boost onto a jelly', stat: 'boostSprings', need: 1, reward: 150 },
  { id: 'reach750', name: 'Long Taffy', text: 'Reach 750 m', stat: 'm', need: 750, reward: 200 },
  { id: 'chain5', name: 'Layer Cake', text: 'Chain 5 in a row', stat: 'chain', need: 5, reward: 180, count: true },
  { id: 'fly10', name: 'Ten Trays', text: 'Fly 10 times', stat: 'flights', need: 10, reward: 180, count: true },
  { id: 'birds3', name: 'Meringue Flock', text: 'Hit 3 birds in one flight', stat: 'birds', need: 3, reward: 250, count: true },
  { id: 'reach1000', name: 'Sugar Rush', text: 'Reach 1000 m', stat: 'm', need: 1000, reward: 300 },
  { id: 'perfect2', name: 'Twin Glaze', text: 'Two Perfect launches in a row', stat: 'perfectRow', need: 2, reward: 300, count: true },
  { id: 'chain7', name: 'Tiered Tower', text: 'Chain 7 in a row', stat: 'chain', need: 7, reward: 350, count: true },
  { id: 'reach1500', name: 'Candy Road', text: 'Reach 1500 m', stat: 'm', need: 1500, reward: 400 },
  { id: 'springs8', name: 'Jelly Jumper', text: 'Hit 8 jellies in one flight', stat: 'springs', need: 8, reward: 400, count: true },
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
// v7: { best: metres, sugar, ms: [milestone metres ever passed], flights, up: { band, fuel, aero, rocket, steady, scope },
//       goalsDone: [goal ids], perfectRow: Perfect launches in a row up to the last flight (the machine's streak), birdTaught,
//       mudTaught, home: the mochi has met the daifuku, actionsTaught: the three-action hint has shown }

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
  E.ledger.add('flight', { m, why: r.ended, sugar: earned, bonus, goals: gs.paid.map((g) => g.id).join('/') || 'none', chain: r.chainMax, ms: r.stars.join('/') || 'none', springs: r.springs, birds: r.birds, geysers: r.geysers, clouds: r.clouds, bounces: r.bounces,
    boosts: r.boosts, boostT: +r.boostT.toFixed(1), chutes: r.chutes, drops: r.drops, secs: +flightTime(r).toFixed(1),
    angle: +r.launch.angle.toFixed(1), gauge: +r.launch.gauge.toFixed(3), zone: ZONES[r.launch.zone ?? 3].replace('!', ''), streak: r.launch.streak || 0,
    up: `b${up.band}f${up.fuel}a${up.aero}r${up.rocket}s${up.steady || 0}t${up.scope || 0}`, seed: r.seed });
  // The card: rewards as tickets (the goals paid and the new places, largest first), then the three goals now active (a
  // counter for those this flight counted toward, "new" for the ones that just took a slot).
  const tickets = gs.paid.map((g) => ({ name: g.name, cond: g.text, sugar: g.reward })).concat(firsts.map((ms) => ({ name: PLACES[T.milestones.indexOf(ms) + 1].name, short: PLACES[T.milestones.indexOf(ms) + 1].name.split(' ')[0], cond: `New place, ${ms} m`, sugar: T.milestoneBonus[T.milestones.indexOf(ms)] })))
    .sort((a, b) => b.sugar - a.sugar);
  const active = activeGoals(gs.done).map((g) => ({ g, have: before.includes(g.id) ? st[g.stat] : undefined, isNew: !before.includes(g.id) }));
  return { m, best: Math.max(best, m), isNew: m > best, sugar: coinsOf(r), bonus, earned, chainMax: r.chainMax, comboMax: r.comboMax, tickets, active, seed: r.seed, why: r.ended, zone: r.launch.zone ?? 3, streak: perfectRow };
}

// ---------- Shop ----------
// Save: `up` holds the bought level of each upgrade (0 to upgradeMax); sugar is spent from `sugar`.

// Named in the candy kitchen's trade; each bolts a part onto the Mochi Maker 3000 (PRD v0.3 A, D), drawn at every level on
// the machine and in the shop (the Fizz Tank's bottle and the Cola Rocket's nozzle ride on the mochi too).
const UPGRADES = [{ id: 'band', name: 'Spring Coil' }, { id: 'fuel', name: 'Fizz Tank' }, { id: 'rocket', name: 'Cola Rocket' }, { id: 'aero', name: 'Sugar Glaze' }, { id: 'steady', name: 'Steady Gauge' }, { id: 'scope', name: 'Brass Telescope' }];
const levelsOf = (E) => ({ ...T.upgrades, ...E.save.get('up', {}) });

// What buying level `lvl` (1 to upgradeMax) of an upgrade does, in plain words.
function effectText(id) {
  if (id === 'band') return `+${Math.round(T.bandStep * 100)}% launch speed`;
  if (id === 'fuel') return `+${T.fuelStep} fizz pips`;
  if (id === 'aero') return `${Math.round(T.aeroStep * 100)}% less air drag`;
  if (id === 'steady') return `Gauge ${Math.round(T.steadySlow * 100)}% slower, zones wider`;
  if (id === 'scope') return `Range finder +${T.scopeStep} s`;
  return `+${Math.round(T.rocketStep * 100)}% boost thrust`;
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

// An upgrade's picture at a level (the shop's): the part itself, as it is drawn on the machine, on a light plate.
function drawUpgradePic(ctx, id, lvl, cx, cy, size, time) {
  ctx.fillStyle = P.shopWall; ctx.beginPath(); ctx.arc(cx, cy, size / 2, 0, Math.PI * 2); ctx.fill();
  const k = size / 80, lw = 2 * k;
  if (id === 'band') drawCoil(ctx, cx - size * 0.3, cy, size * 0.6, size * (0.16 + 0.05 * lvl), 4 + 2 * lvl, lw);
  else if (id === 'steady') drawGauge(ctx, cx, cy, size * 0.36, null, T.zoneHalf.map((h) => h + T.steadyWiden * lvl), lvl, lw);
  else if (id === 'scope') drawScope(ctx, cx - size * 0.3, cy + size * 0.1, size * (0.36 + 0.1 * lvl), -0.35, lvl, lw);
  else if (id === 'fuel') drawBottle(ctx, cx, cy + size * 0.05, size * (0.36 + 0.12 * lvl), 0, 0.75, lw);
  else if (id === 'rocket') {
    drawNozzle(ctx, cx - size * 0.12, cy, size * (0.2 + 0.07 * lvl), 0, lvl, true, lw, time);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = P.cola; ctx.strokeStyle = P.colaRim; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx + size * (0.18 + 0.08 * i), cy + Math.sin(time * 4 + i) * size * 0.06, size * (0.05 - 0.01 * i), 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  } else { drawGlazeDrum(ctx, cx, cy + size * 0.1, size * (0.18 + 0.04 * lvl), lvl, lw); drawMochi(ctx, cx, cy - size * 0.2, size * 0.16, 0, 1, 1, lw * 0.7, { aero: lvl }, time); }
}

// The shop: six cards in a row, each a picture of the gear at the level Buy gives (or the top level), the name in the
// kitchen's trade, level pips, the effect in plain words and a Buy button carrying the price (principle 11: three text items).
const shop = {
  enter(E, p = {}) { this.from = p.from || 'menu'; this.card = p.card || null; this.cells = []; },
  render(ctx, E) {
    const sf = E.safe, left = sf.left + 16, right = E.w - sf.right - 16, top = sf.top + 8;
    const grad = ctx.createLinearGradient(0, 0, 0, E.h); grad.addColorStop(0, P.skyDusk[1]); grad.addColorStop(1, P.skyNight[1]);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, E.w, E.h);
    this.btnBack = btn(E, 'Back', left + 40, top + 22, { w: 80, h: 44, size: TY.md, fill: P.buttonOff });
    E.text('Shop', E.w / 2, top + 22, { size: TY.lg, weight: '800', color: P.text });
    const sugar = E.save.get('sugar', 0), up = levelsOf(E);
    E.text(`${sugar} sugar`, right, top + 22, { size: TY.md, align: 'right', color: P.coin, weight: '800' });
    const n = UPGRADES.length, gap = 8, gy = top + 52, cw = (right - left - gap * (n - 1)) / n, ch = E.h - sf.bottom - 10 - gy, pad = cw < 110 ? 5 : 10, tw = cw - 2 * pad;
    const effects = UPGRADES.map((u) => (up[u.id] >= T.upgradeMax ? 'Fully upgraded' : effectText(u.id, up[u.id] + 1)));
    const lines = Math.max(...effects.map((t) => wrap(E, t, tw, TY.sm, '600').length));
    const pic = clamp(Math.min(tw, ch * 0.36, ch - 6 - 88 - 52 - lines * 17), 36, 108); // the picture gives way to the words
    this.cells = UPGRADES.map((u, i) => {
      const x = left + i * (cw + gap), y = gy, lvl = up[u.id], max = lvl >= T.upgradeMax, cx = x + cw / 2;
      const price = max ? 0 : T.upgradePrices[u.id][lvl], can = !max && sugar >= price;
      E.roundRect(x, y, cw, ch, T.style.radius, P.panel, P.panelEdge);
      drawUpgradePic(ctx, u.id, Math.min(lvl + 1, T.upgradeMax), cx, y + 6 + pic / 2, pic, E.time);
      const big = u.name.split(' ').every((w) => fit(E, w, tw, TY.md, '800') === w), ns = big ? TY.md : TY.sm;
      const names = wrap(E, u.name, tw, ns, '800');
      names.slice(0, 2).forEach((l, k) => E.text(fit(E, l, tw, ns, '800'), cx, y + pic + 22 + k * 20, { size: ns, weight: '800', color: P.text }));
      const py = y + pic + 22 + 2 * 20;
      for (let k = 0; k < T.upgradeMax; k++) E.roundRect(cx - 30 + k * 20 + 2, py - 7, 16, 16, 4, k < lvl ? P.teal : P.panelSolid, P.panelEdge);
      const btnTop = y + ch - 52, ey = py + 26, room = Math.max(1, Math.floor((btnTop - ey + 6) / 17));
      const words = wrap(E, effects[i], tw, TY.sm, '600');
      const shown = words.length > room ? words.slice(0, room - 1).concat(fit(E, words.slice(room - 1).join(' '), tw, TY.sm, '600')) : words;
      shown.forEach((line, k) => E.text(line, cx, ey + k * 17, { size: TY.sm, color: max ? P.textDim : P.text, weight: '600' }));
      if (max) return { u, btn: null, rect: { x, y, w: cw, h: ch } };
      const bw = Math.min(tw, 170);
      const [label, size] = [[`Buy for ${price}`, TY.md], [`Buy for ${price}`, TY.sm], [`Buy ${price}`, TY.sm]].find(([l, z]) => fit(E, l, bw - 12, z, '600') === l) || [`${price}`, TY.sm];
      const b = btn(E, label, cx, y + ch - 28, { w: bw, h: 44, size, fill: can ? P.button : P.buttonOff, color: can ? P.text : P.textOff });
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

// Where the critter comes down if nothing else touches it: the air step (with the action it holds now) in 4-step strides,
// onto the ground or a ramp.
function predictLanding(r) {
  if (r.mode !== 'air') return r.x;
  const h = STEP * 4, s = { x: r.x, y: r.y, vx: r.vx, vy: r.vy, boost: r.boost && r.burstEnd < 0, chute: r.chute, ball: r.ball, fuel: r.fuel };
  const kd = Math.pow(1 - r.st.airDrag, h), kc = Math.exp(-T.chuteBleed * h);
  for (let i = 0; i < 3000; i++) {
    airStep(s, r.st, h, kd, kc);
    if (s.vy < 0 && s.y <= surfaceH(groundAt(r.field, s.x), s.x)) return s.x;
  }
  return s.x;
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

const RGB = new Map();
function hexRgb(h) { let v = RGB.get(h); if (!v) { const n = parseInt(h.slice(1), 16); v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; RGB.set(h, v); } return v; }
const lerpRgb = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
const mix = (a, b, t) => (t <= 0 ? a : t >= 1 ? b : css(lerpRgb(hexRgb(a), hexRgb(b), t)));
// The sky at an altitude (metres at the top of the view) over a place's day sky: horizon and top colours, how far into night.
function skyAt(alt, day) {
  const d = clamp((alt - 30) / (T.duskAt - 30), 0, 1), n = clamp((alt - T.duskAt) / (T.nightAt - T.duskAt), 0, 1);
  const dk = P.skyDusk.map(hexRgb), nt = P.skyNight.map(hexRgb);
  if (n > 0) return { h: css(lerpRgb(dk[0], nt[0], n)), t: css(lerpRgb(dk[1], nt[1], n)), night: n };
  return { h: css(lerpRgb(day[0], dk[0], d)), t: css(lerpRgb(day[1], dk[1], d)), night: 0 };
}
// The place a view centred at world x shows: place a, blending into b by k over placeBlend before b's line.
function placeView(x) {
  const i = placeIndex(x);
  if (i + 1 < PLACES.length) { const k = clamp(1 - (placeFrom(i + 1) - x) / T.placeBlend, 0, 1); if (k > 0) return { a: i, b: i + 1, k }; }
  return { a: i, b: i, k: 0 };
}

let STARS = null; // cosmetic star field, made once
function stars() {
  if (!STARS) STARS = Array.from({ length: J.stars }, () => ({ x: Math.random(), y: Math.random() * 0.8, r: 0.6 + Math.random() * 1.2, tw: Math.random() * 6 }));
  return STARS;
}

// Rolling hills: a sum of two sines per layer (0 far, 1 near), scrolled at a share of the camera; heights in design px.
const hillY = (u, h, li) => Math.sin(u * h.f[0] + h.seed[li]) * h.w[0] + Math.sin(u * h.f[1] + h.seed[li] * 2.1) * h.w[1] + 0.5;

// A place's backdrop motif on one hill layer: pale, low and sparse, never busier than the play objects. `top(u)` is the hill
// line's screen y at layer coordinate u; `off` is the layer's scroll (design px).
function drawMotif(ctx, E, motif, li, top, off, s, gy, time) {
  const each = (step, f) => { for (let u = Math.ceil(off / step) * step; (u - off) * s < E.w + step * s; u += step) f((u - off) * s, top(u), u); };
  if (motif === 'gumdrops' && li === 1) P.gumdrops.forEach((col, c) => {
    ctx.fillStyle = col; ctx.beginPath();
    each(70, (x, y, u) => { if (((Math.round(u / 70) % 4) + 4) % 4 === c) { ctx.moveTo(x + 6 * s, y + 2 * s); ctx.arc(x, y + 2 * s, 6 * s, 0, Math.PI, true); } });
    ctx.fill();
  });
  else if (motif === 'strawberries' && li === 1) {
    ctx.fillStyle = P.berry; ctx.beginPath(); each(56, (x, y) => { ctx.moveTo(x + 3.2 * s, y + 4 * s); ctx.arc(x, y + 4 * s, 3.2 * s, 0, Math.PI * 2); }); ctx.fill();
    ctx.fillStyle = P.leaf; ctx.beginPath(); each(56, (x, y) => ctx.rect(x - 2.5 * s, y, 5 * s, 1.6 * s)); ctx.fill();
  } else if (motif === 'houses' && li === 0) {
    const w = 22 * s, h = 15 * s;
    ctx.fillStyle = P.house[0]; ctx.beginPath(); each(180, (x, y) => ctx.rect(x - w / 2, y - h + 4 * s, w, h)); ctx.fill();
    ctx.fillStyle = P.house[1]; ctx.beginPath(); each(180, (x, y) => { ctx.moveTo(x - w / 2 - 3 * s, y - h + 5 * s); ctx.lineTo(x, y - h - 8 * s); ctx.lineTo(x + w / 2 + 3 * s, y - h + 5 * s); ctx.closePath(); }); ctx.fill();
    ctx.strokeStyle = P.white; ctx.lineWidth = 1.2 * s; ctx.beginPath(); // icing on the eaves
    each(180, (x, y) => { for (let i = 0; i <= 6; i++) ctx[i ? 'lineTo' : 'moveTo'](x - w / 2 + (w * i) / 6, y - h + 5 * s + (i % 2) * 2 * s); });
    ctx.stroke();
  } else if (motif === 'bubbles' && li === 0) {
    ctx.strokeStyle = P.white; ctx.lineWidth = 1.2 * s; ctx.beginPath();
    each(150, (x, y, u) => { const k = ((time * 0.25 + u * 0.013) % 1 + 1) % 1, bx = x + Math.sin(time + u) * 3 * s, by = y - k * 70 * s, br = (2 + 3 * k) * s; ctx.moveTo(bx + br, by); ctx.arc(bx, by, br, 0, Math.PI * 2); });
    ctx.stroke();
  } else if (motif === 'river' && li === 1) { // a milk-chocolate river flowing in front of the near hills
    ctx.fillStyle = P.river[0]; ctx.beginPath(); ctx.moveTo(0, gy - 14 * s);
    for (let x = 0; x <= E.w + 24 * s; x += 24 * s) ctx.lineTo(x, gy - (14 + 2 * Math.sin((x / s + off) * 0.02 + time)) * s);
    ctx.lineTo(E.w, gy); ctx.lineTo(0, gy); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = P.river[1]; ctx.lineWidth = 1.4 * s; ctx.beginPath();
    each(60, (x) => { const k = ((time * 0.4 + x * 0.01) % 1) * 20 * s; ctx.moveTo(x - k, gy - 7 * s); ctx.lineTo(x - k + 14 * s, gy - 7 * s); });
    ctx.stroke();
  }
}

// `pre`: the machine's state ({ aim: barrel angle, gauge, half, lit, glow, pump }, see drawMachine) and in flight `arc`, the
// range finder. `up`: the gear to draw.
function drawWorld(ctx, E, v, c, r, pre = null, up = S.up || T.upgrades) {
  const s = v.s, z = c.z, lw = T.style.line * s;
  const X = (wx) => (wx - c.x) * z * s, Y = (wy) => v.oy + (T.groundY - (wy - c.y) * z) * s;
  const gy = v.oy + T.groundY * s, lift = c.y * z * s, liftM = c.y / T.unitsPerMetre;
  const sprite = Math.max(z, T.spriteMin), span = v.vw / z;
  const pv = placeView(c.x + span / 2), A = PLACES[pv.a], B = PLACES[pv.b];
  const day = [lerpRgb(hexRgb(A.sky[0]), hexRgb(B.sky[0]), pv.k), lerpRgb(hexRgb(A.sky[1]), hexRgb(B.sky[1]), pv.k)];
  const alt = (c.y + T.groundY / z) / T.unitsPerMetre, sky = skyAt(alt, day);

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
    for (const [li, par, key] of [[0, 0.15, 'far'], [1, 0.35, 'near']]) {
      const off = c.x * z * par, drop = lift * 0.6, ha = A.hills, hb = B.hills, k = pv.k;
      const hy = (u) => { const a = ha.base[li] + ha.amp[li] * hillY(u, ha, li); return k > 0 ? a + (hb.base[li] + hb.amp[li] * hillY(u, hb, li) - a) * k : a; };
      const top = (u) => gy + drop - hy(u) * s;
      ctx.globalAlpha = hillA; ctx.fillStyle = mix(ha[key], hb[key], k);
      ctx.beginPath(); ctx.moveTo(0, gy);
      for (let px = 0; px <= E.w + 24 * s; px += 24 * s) ctx.lineTo(px, top(px / s + off));
      ctx.lineTo(E.w, gy); ctx.closePath(); ctx.fill();
      for (const [pl, wgt] of pv.a === pv.b ? [[A, 1]] : [[A, 1 - k], [B, k]]) if (wgt > 0.01) { ctx.globalAlpha = hillA * wgt; drawMotif(ctx, E, pl.motif, li, top, off, s, gy + drop, E.time); }
    }
    ctx.globalAlpha = 1;
  }
  // The bakery the mochi is flung from, behind the launcher.
  if (X(-200) < E.w && X(-60) > 0) shopfront(ctx, X(-190), gy, 110 * z * s, s * z, lw, false);
  // Home: a cottage and the daifuku waiting at the roadside.
  const hx = placeFrom(PLACES.length - 1) + T.homeAhead;
  if (X(hx + 200) > 0 && X(hx - 200) < E.w) {
    shopfront(ctx, X(hx + 60), gy, 90 * z * s, s * z, lw, true);
    const hop = S.homeT > 0 ? Math.abs(Math.sin((J.homeTime - S.homeT) * 9)) * 10 * s * sprite : 0;
    drawDaifuku(ctx, X(hx), gy - T.critterR * s * sprite - hop, T.critterR * s * sprite, E.time, lw);
  }

  // The ground band, each place in its own colours from its line: a top strip, soil, distance ticks and labels.
  for (let i = placeIndex(Math.max(0, c.x)); i < PLACES.length && placeFrom(i) < c.x + span; i++) {
    const a = i === 0 ? 0 : Math.max(0, X(placeFrom(i))), b = i + 1 < PLACES.length ? Math.min(E.w, X(placeFrom(i + 1))) : E.w;
    if (b <= a) continue;
    ctx.fillStyle = PLACES[i].soil; ctx.fillRect(a, gy, b - a, E.h - gy);
    ctx.fillStyle = PLACES[i].top; ctx.fillRect(a, gy, b - a, 12 * s);
    if (i > 0) drawPost(ctx, X(placeFrom(i)), gy, s * sprite, PLACES[i].top, lw);
  }
  const u10 = 10 * T.unitsPerMetre;
  ctx.fillStyle = P.ink; ctx.globalAlpha = 0.45;
  for (let wx = Math.floor(c.x / u10) * u10; wx < c.x + span + u10; wx += u10) {
    if (wx < 0) continue;
    const big = wx % (5 * u10) === 0;
    ctx.fillRect(X(wx) - 1, gy + 12 * s, 2, (big ? 10 : 5) * s);
  }
  ctx.globalAlpha = 1;
  for (let wx = Math.ceil(c.x / (5 * u10)) * 5 * u10; wx < c.x + span + u10; wx += 5 * u10) if (wx > 0) E.text(`${wx / T.unitsPerMetre} m`, X(wx), Math.min(gy + 34 * s, E.h - E.safe.bottom - 10), { size: TY.sm, color: P.text, weight: '600' });

  // The Mochi Maker 3000 at the pivot (x = 0), true size with the zoom.
  const mk = s * z, mx = X(0), machineSeen = mx > -140 * MACHINE * mk && mx < E.w + 60 * mk;
  const aim = r ? r.launch.angle : pre && pre.aim !== undefined ? pre.aim : T.aimMin;
  if (machineSeen) drawMachine(ctx, E, mx, gy, mk, lw, up, aim, pre || {});

  if (r) {
    const f = r.field, t = flightTime(r), x0 = c.x - 400, x1 = c.x + span + 400;
    for (const g of f.ground) {
      if (g.x1 < x0 || g.x0 > x1) continue;
      if (g.kind === 'spring') drawJelly(ctx, X(g.x0), gy, g.w * z * s, s, g.spent, S.pops.get(g), E.time + g.x0 * 0.01, lw);
      else if (g.kind === 'mud') drawMud(ctx, X(g.x0), gy, g.w * z * s, s, E.time + g.x0 * 0.013);
      else if (g.kind === 'ramp') drawRamp(ctx, X(g.x0), gy, g.w * z * s, g.h * z * s, s, lw);
      else if (g.kind === 'geyser') drawGeyser(ctx, X(g.x0), gy, g.w * z * s, T.geyserH * z * s, s, g, t, E.time, lw);
    }
    for (const cl of f.clouds) if (cl.x > x0 && cl.x < x1) drawCloud(ctx, X(cl.x), Y(cl.y), s * z, cl.used, E.time + cl.x * 0.01, lw);
    for (const b of f.birds) {
      if (b.hit || b.x0 < x0 || b.x0 > x1) continue;
      const by = Y(b.y);
      if (by < gy - 4 * s) drawBird(ctx, X(birdX(b, t)), by, s * sprite, E.time + b.phase, Math.cos((t / T.birdPeriod) * Math.PI * 2 + b.phase) >= 0 ? -1 : 1, 0);
    }
  }

  if (r && pre && pre.arc) drawArc(ctx, pre.arc, X, Y, s, sprite, E.time);

  // The mochi: on the barrel's mouth until the launch, then where the run has it.
  const [m0x, m0y] = mouth(aim);
  const cx = r ? r.x : m0x, cy = r ? r.y : m0y;
  let rr = T.critterR * s * (r ? sprite : z);
  const sx = X(cx), sy = Y(cy) - rr;
  const hgt = cy * z * s;
  if (lift === 0 && hgt < 160 * s && r) { ctx.globalAlpha = 1 - hgt / (160 * s); ctx.fillStyle = P.shadow; ctx.beginPath(); ctx.ellipse(sx, gy + 2 * s, rr * 1.1, rr * 0.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  for (const e of S.fx) drawFx(ctx, E, e, X, Y, s, sprite, lw, true);
  if (lift > 0) { // panned sky: a dotted drop line from the critter to the band
    ctx.strokeStyle = sky.night > 0.5 ? P.star : P.ink; ctx.globalAlpha = 0.6; ctx.lineWidth = 1.5; ctx.setLineDash([3, 6]);
    ctx.beginPath(); ctx.moveTo(sx, sy + rr + 4); ctx.lineTo(sx, gy); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  const sp = r ? Math.hypot(r.vx, r.vy) : 0, dir = r && sp > 1 ? Math.atan2(-r.vy, r.vx) : 0;
  // Speed lines: fast, or just off a jelly or a geyser.
  const lines = r && !r.ended ? Math.max(S.speedT > 0 ? S.speedT / J.speedLines : 0, clamp((sp - J.speedLineMin) / 600, 0, 1)) : 0;
  if (lines > 0.02) {
    const ux = Math.cos(dir), uy = Math.sin(dir);
    ctx.strokeStyle = P.white; ctx.lineWidth = 2 * s; ctx.globalAlpha = Math.min(1, lines); ctx.lineCap = 'round';
    for (let i = -2; i <= 2; i++) {
      const ox = -uy * i * rr * 0.55, oy = ux * i * rr * 0.55, l = 2.2 + ((i + 2) % 3) * 0.7 + Math.sin(E.time * 30 + i) * 0.3;
      ctx.beginPath(); ctx.moveTo(sx - ux * rr * 1.5 + ox, sy - uy * rr * 1.5 + oy); ctx.lineTo(sx - ux * rr * (1.5 + l) + ox, sy - uy * rr * (1.5 + l) + oy); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.lineCap = 'butt';
  }
  // Squash on a landing, wobbling back; stretched along the flight when fast; a ball when condensed; a sail when the
  // parachute is open; a fizz jet while boosting.
  let sqx = 1, sqy = 1, rot = 0;
  if (S.sq.t > 0) { const k = S.sq.t / J.squashTime, w = S.sq.amt * k * Math.cos((1 - k) * Math.PI * 1.5); sqx = 1 + w; sqy = 1 - w; }
  else if (r && r.ended === 'mud') { sqx = 1 + J.landSquash; sqy = 1 - J.landSquash; }
  else if (r && r.mode === 'air' && !r.chute && !r.ball) { const k = clamp((sp - 350) / 1500, 0, 0.28); sqx = 1 + k; sqy = 1 - k * 0.6; rot = dir; }
  if (r && r.ball && !r.ended) { rr *= 0.8; sqx = 0.95; sqy = 1.05; }
  if (r && r.chute && !r.ended) { drawSail(ctx, sx, sy, rr, r.vx, E.time, lw); sqx = 0.9; sqy = 1.14; }
  if (r && r.boost && r.fuel > 0 && !r.ended) drawJet(ctx, sx, sy, rr, dir, E.time, lw);
  const look = r ? dir : -aim * DEG;
  const fuelK = r ? clamp(r.fuel / Math.max(1, r.fuelCap), 0, 1) : 1;
  drawMochi(ctx, sx, sy + (1 - sqy) * rr, rr, look, sqx, sqy, lw, up, E.time, fuelK, !!(r && r.boost && r.fuel > 0), rot);
  if (r && r.ball && !r.ended) { // spin marks: a condensed ball
    ctx.strokeStyle = P.ink; ctx.lineWidth = 1.6 * s; ctx.lineCap = 'round'; const a0 = E.time * 14;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(sx, sy, rr * 1.35, a0 + i * 2.1, a0 + i * 2.1 + 0.7); ctx.stroke(); }
    ctx.lineCap = 'butt';
  }
  return { sx, sy, rr, height: cy, lifted: lift > 0, night: sky.night, mx, gy, mk: mk * MACHINE };
}

// The range finder's dotted arc (PRD v0.3 D): dots in the action's colour, fading out along the arc, ending in the landing
// marker where it reaches a contact: teal on a jelly, a dark cross on caramel, a white chevron elsewhere.
function drawArc(ctx, a, X, Y, s, sprite, time) {
  const col = P.arc[a.mode], R = T.critterR;
  ctx.lineWidth = 1.2 * s; ctx.strokeStyle = P.ink;
  for (let i = 0; i < a.n; i++) {
    const x = X(a.pts[2 * i]), y = Y(a.pts[2 * i + 1] + R), k = 1 - (i / Math.max(1, a.n)) * 0.6;
    ctx.globalAlpha = k; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 2.4 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (!a.hit || a.kind === 'bird' || a.kind === 'geyser') return;
  const x = X(a.x), y = Y(a.y);
  if (a.kind === 'mud') {
    ctx.strokeStyle = P.white; ctx.lineWidth = 5 * s; ctx.lineCap = 'round';
    for (const pass of [0, 1]) { if (pass) { ctx.strokeStyle = P.mud; ctx.lineWidth = 2.6 * s; } ctx.beginPath(); ctx.moveTo(x - 6 * s, y - 16 * s); ctx.lineTo(x + 6 * s, y - 4 * s); ctx.moveTo(x + 6 * s, y - 16 * s); ctx.lineTo(x - 6 * s, y - 4 * s); ctx.stroke(); }
    ctx.lineCap = 'butt';
  } else drawMark(ctx, x, y, s, time, a.kind === 'spring' ? P.tealLight : P.white);
}

// The dough parachute: the mochi's own dough pulled up into a sail over him, two strands down, swaying with the drift.
function drawSail(ctx, x, y, r, vx, time, lw) {
  const sway = clamp(-vx / 1500, -0.3, 0.3) + Math.sin(time * 3) * 0.05, w = r * 2.6, top = y - r * 3.4, h = r * 1.5;
  ctx.save(); ctx.translate(x, y); ctx.rotate(sway); ctx.translate(-x, -y);
  ctx.strokeStyle = P.ink; ctx.lineWidth = lw * 0.7; ctx.beginPath();
  ctx.moveTo(x - r * 0.5, y - r * 0.6); ctx.lineTo(x - w, top + h * 0.8); ctx.moveTo(x + r * 0.5, y - r * 0.6); ctx.lineTo(x + w, top + h * 0.8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - w, top + h * 0.8);
  ctx.bezierCurveTo(x - w, top - h * 0.6, x + w, top - h * 0.6, x + w, top + h * 0.8);
  for (let i = 3; i >= 0; i--) ctx.quadraticCurveTo(x - w + (w / 2) * (i + 0.5), top + h * 0.45, x - w + (w / 2) * i, top + h * 0.8);
  ctx.closePath(); ctx.lineJoin = 'round';
  ctx.strokeStyle = P.halo; ctx.lineWidth = lw * 2.4; ctx.stroke();
  ctx.fillStyle = P.powder; ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = lw; ctx.stroke();
  ctx.fillStyle = P.critterLight; ctx.beginPath(); ctx.ellipse(x, top + h * 0.05, w * 0.5, h * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// The fizz jet behind a boosting mochi: a flickering white-and-soda plume pointing back along the flight.
function drawJet(ctx, x, y, r, dir, time, lw) {
  const ux = -Math.cos(dir), uy = -Math.sin(dir), len = r * (2 + 0.35 * Math.sin(time * 50)), w = r * 0.55;
  const bx = x + ux * r * 0.8, by = y + uy * r * 0.8, tx = bx + ux * len, ty = by + uy * len, nx = -uy * w, ny = ux * w;
  ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(bx + nx, by + ny); ctx.quadraticCurveTo(tx + nx * 0.6, ty + ny * 0.6, tx, ty); ctx.quadraticCurveTo(tx - nx * 0.6, ty - ny * 0.6, bx - nx, by - ny); ctx.closePath();
  ctx.fillStyle = P.soda; ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = lw * 0.7; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx + nx * 0.5, by + ny * 0.5); ctx.quadraticCurveTo(bx + ux * len * 0.6, by + uy * len * 0.6, bx + ux * len * 0.7, by + uy * len * 0.7); ctx.quadraticCurveTo(bx + ux * len * 0.3, by + uy * len * 0.3, bx - nx * 0.5, by - ny * 0.5); ctx.closePath();
  ctx.fillStyle = P.fizz; ctx.fill();
}

// A mint jelly: a row of wobbling jelly cubes (one every jellyCube design px, so a long one reads as jelly, never a rail),
// teal with a light halo, an ink outline and a shine; unspent cubes bob at rest, each a little out of step. Each cube is a
// cached sprite per height (a long jelly is many cubes, and an image is far cheaper than its outline on a slow phone).
function drawJelly(ctx, x, gy, w, s, spent, pop, time, lw) {
  const k = pop ? pop.t / J.springPop : 0; // 1 at the hit: squashed, then pops past rest
  const n = Math.max(1, Math.round(w / (T.jellyCube * s))), cw = w / n, pad = lw * 1.2;
  for (let i = 0; i < n; i++) {
    const rest = spent ? 6 : 12 * (1 + J.springWobble * Math.sin(time * 6 + i * 0.9));
    const h = Math.round((pop ? rest * (k > 0.6 ? 0.4 : 1 + 0.5 * Math.sin((1 - k / 0.6) * Math.PI)) : rest) * 2) / 2 * s; // half design px steps
    cached(ctx, `jelly${spent}|${h.toFixed(1)}|${lw.toFixed(2)}`, x + i * cw - pad, gy - h - pad, cw + 2 * pad, h + 2 * pad, (c) => jellyCube(c, pad, pad, cw, h, s, lw, spent));
  }
}
function jellyCube(ctx, x, y, cw, h, s, lw, spent) {
  const gap = Math.min(2.5 * s, cw * 0.18), x0 = x + gap / 2, ww = cw - gap, gy = y + h, rad = Math.min(ww * 0.4, h * 0.6, 7 * s);
  ctx.beginPath(); ctx.moveTo(x0, gy); ctx.lineTo(x0, gy - h + rad); ctx.quadraticCurveTo(x0, gy - h, x0 + rad, gy - h);
  ctx.lineTo(x0 + ww - rad, gy - h); ctx.quadraticCurveTo(x0 + ww, gy - h, x0 + ww, gy - h + rad); ctx.lineTo(x0 + ww, gy); ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = P.halo; ctx.lineWidth = lw * 2.2; ctx.stroke(); // the light halo keeps 3:1 on the dusk sky
  ctx.fillStyle = spent ? P.tealSpent : P.teal; ctx.fill();
  ctx.strokeStyle = P.ink; ctx.lineWidth = lw * 0.8; ctx.stroke();
  if (spent) return;
  ctx.fillStyle = P.tealLight; ctx.fillRect(x0 + ww * 0.2, gy - h + 2.4 * s, ww * 0.35, 1.8 * s); ctx.fillRect(x0 + ww * 0.2, gy - h + 5.4 * s, 1.8 * s, 1.8 * s);
}

// Caramel: a sticky pit sunk into the ground, never a pad (PRD v0.2 C, E): a dark amber glossy body with a slowly rippling top
// and a deeper middle, short light gloss streaks, slow bubbles that swell and pop, and caramel strands from both rims.
// It reads as a dark hole in every place's ground band (tools/sim-launch.mjs --contrast), with nothing raised above it.
function drawMud(ctx, x, gy, w, s, time) {
  const d = 15 * s, top = (u) => gy + (1.2 + 0.8 * Math.sin(time * 1.3 + u * 9)) * s;
  ctx.beginPath(); ctx.moveTo(x, gy);
  for (let i = 1; i <= 8; i++) ctx.lineTo(x + (w * i) / 8, top(i / 8));
  ctx.lineTo(x + w, gy + d - 5 * s); ctx.quadraticCurveTo(x + w, gy + d, x + w - 6 * s, gy + d);
  ctx.lineTo(x + 6 * s, gy + d); ctx.quadraticCurveTo(x, gy + d, x, gy + d - 5 * s); ctx.closePath();
  ctx.fillStyle = P.mud; ctx.fill();
  ctx.fillStyle = P.mudDeep; ctx.beginPath(); ctx.ellipse(x + w / 2, gy + d * 0.62, w * 0.4, d * 0.26, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = P.mudSheen; ctx.lineWidth = 1.6 * s; ctx.beginPath(); // an amber sheen just under the surface
  for (let i = 1; i <= 7; i++) ctx.lineTo(x + (w * i) / 8, top(i / 8) + 3.2 * s);
  ctx.stroke();
  ctx.strokeStyle = P.mudRim; ctx.lineCap = 'round'; ctx.lineWidth = 1.4 * s; ctx.globalAlpha = 0.7; // glossy streaks, short
  for (const u of [0.22, 0.64]) { ctx.beginPath(); ctx.moveTo(x + w * u, gy + 4 * s); ctx.lineTo(x + w * u + Math.min(10 * s, w * 0.1), gy + 3.4 * s); ctx.stroke(); }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 3; i++) { // bubbles rise, swell and pop on a slow cycle
    const ph = (time * 0.45 + i * 0.37) % 1, bx = x + w * (0.2 + 0.3 * i);
    if (ph < 0.85) { const k = ph / 0.85, br = (0.8 + 2 * k) * s; ctx.fillStyle = P.mudBubble; ctx.strokeStyle = P.mudRim; ctx.lineWidth = 0.9 * s; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(bx, gy + (11 - 7 * k) * s, br, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    else { ctx.strokeStyle = P.mudRim; ctx.lineWidth = 0.9 * s; ctx.globalAlpha = 1 - (ph - 0.85) / 0.15; ctx.beginPath(); ctx.arc(bx, gy + 3.5 * s, (3 + 20 * (ph - 0.85)) * s, Math.PI, 0); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = P.mud; ctx.lineWidth = 1.6 * s; // strands stretched from the ground at both rims down into the caramel
  for (const [ex, dir] of [[x, 1], [x + w, -1]]) for (const [dx, dy] of [[5, 9], [10, 6]]) {
    const sag = Math.sin(time * 1.1 + dx) * 0.8 * s;
    ctx.beginPath(); ctx.moveTo(ex - dir * 1.5 * s, gy); ctx.quadraticCurveTo(ex + dir * dx * 0.3 * s, gy + (dy + 2) * s + sag, ex + dir * dx * s, gy + 2 * s); ctx.stroke();
    ctx.fillStyle = P.mud; ctx.beginPath(); ctx.arc(ex + dir * dx * 0.35 * s, gy + (dy * 0.75 + 1) * s + sag, 1.4 * s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.lineCap = 'butt';
}

// A soda geyser: a low vent on the ground line with a teal rim (a good object) and a dark mouth. Before an eruption the vent
// bubbles hard and shakes; while it erupts (exactly its physics window) a fizzing white column stands `colH` tall. A vent
// spent this flight goes grey and stays quiet, as a spent jelly does.
function drawGeyser(ctx, x, gy, w, colH, s, g, t, time, lw) {
  const ph = (t + g.phase) % T.geyserPeriod, on = !g.spent && ph < T.geyserOn, warn = !g.spent && !on && ph > T.geyserPeriod - J.geyserWarn;
  const shake = warn ? Math.sin(time * 60) * 1.2 * s : 0, cx = x + w / 2 + shake, vw = Math.max(w, 16 * s), vh = 7 * s, p = lw * 1.2;
  if (on) {
    const cw = vw * 0.7, top = gy - colH * Math.min(1, ph / 0.08), ch = gy - vh - top + cw / 2; // the column shoots up in its first 0.08 s
    cached(ctx, `column|${lw.toFixed(2)}`, cx - cw / 2 - p, top - cw / 2 - p, cw + 2 * p, ch + 2 * p, (c) => {
      c.beginPath(); c.moveTo(p, ch + p); c.lineTo(p, cw / 2 + p); c.arc(cw / 2 + p, cw / 2 + p, cw / 2, Math.PI, 0); c.lineTo(cw + p, ch + p); c.closePath();
      c.lineJoin = 'round'; c.strokeStyle = P.halo; c.lineWidth = lw * 2.2; c.stroke();
      c.fillStyle = P.column; c.fill(); c.strokeStyle = P.ink; c.lineWidth = lw * 0.8; c.stroke();
    });
    ctx.fillStyle = P.tealLight; ctx.beginPath(); // bubbles racing up the column
    for (let i = 0; i < 6; i++) { const q = (time * 2.2 + i / 6) % 1, bx = cx + Math.sin(i * 2.3 + time * 5) * cw * 0.25, by = gy - vh - q * (gy - vh - top), br = (1.5 + (i % 3)) * s; ctx.moveTo(bx + br, by); ctx.arc(bx, by, br, 0, Math.PI * 2); }
    ctx.fill();
  }
  cached(ctx, `vent${g.spent}|${lw.toFixed(2)}`, cx - vw / 2 - 4 * s - p, gy - vh - p, vw + 8 * s + 2 * p, vh + 2 * p, (c) => {
    const m = vw / 2 + 4 * s + p, y0 = vh + p;
    c.beginPath(); c.moveTo(m - vw / 2 - 4 * s, y0); c.quadraticCurveTo(m - vw / 2, y0 - vh, m - vw * 0.3, y0 - vh);
    c.lineTo(m + vw * 0.3, y0 - vh); c.quadraticCurveTo(m + vw / 2, y0 - vh, m + vw / 2 + 4 * s, y0); c.closePath();
    c.lineJoin = 'round'; c.strokeStyle = P.halo; c.lineWidth = lw * 2.2; c.stroke();
    c.fillStyle = g.spent ? P.columnSpent : P.vent; c.fill(); c.strokeStyle = P.ink; c.lineWidth = lw * 0.8; c.stroke();
    c.fillStyle = g.spent ? P.tealSpent : P.teal; c.fillRect(m - vw * 0.42, y0 - vh * 0.55, vw * 0.84, 2.2 * s);
    c.fillStyle = P.ventHole; c.beginPath(); c.ellipse(m, y0 - vh, vw * 0.22, 2.2 * s, 0, 0, Math.PI * 2); c.fill();
  });
  if (!on && !g.spent) { // fizz at the mouth: a bubble now and then, a boil just before it blows
    const n = warn ? 4 : 1;
    ctx.fillStyle = P.column; ctx.strokeStyle = P.ink; ctx.lineWidth = 0.8 * s; ctx.beginPath();
    for (let i = 0; i < n; i++) { const q = (time * (warn ? 3 : 0.8) + i / n) % 1, bx = cx + (i - n / 2) * 3 * s, by = gy - vh - q * (warn ? 14 : 8) * s, br = (1.4 + q * 1.4) * s; ctx.moveTo(bx + br, by); ctx.arc(bx, by, br, 0, Math.PI * 2); }
    ctx.fill(); ctx.stroke();
  }
}

// A cotton-candy cloud: pink puffs with a blue blush, an ink outline and a light halo; a used one fades to a pale wisp.
// Drawn at its true size (`s` includes the zoom), since its outline is its reach.
const PUFFS = [[-0.55, 0.15, 0.5], [0, -0.25, 0.62], [0.52, 0.1, 0.52], [-0.18, 0.32, 0.46], [0.24, 0.34, 0.46]];
function drawCloud(ctx, x, y, s, used, time, lw) {
  const rx = T.cloudRX * s, ry = T.cloudRY * s, bob = Math.sin(time * 1.5) * 1.5 * s;
  const path = (grow) => { ctx.beginPath(); for (const [ox, oy, rr] of PUFFS) { const r = rr * rx + grow; ctx.moveTo(x + ox * rx + r, y + oy * ry * 1.4 + bob); ctx.arc(x + ox * rx, y + oy * ry * 1.4 + bob, r, 0, Math.PI * 2); } };
  if (used) { ctx.globalAlpha = 0.55; path(0); ctx.fillStyle = P.cloudUsed; ctx.fill(); ctx.globalAlpha = 1; return; } // a pale wisp, no outline
  path(lw * 1.6); ctx.fillStyle = P.halo; ctx.fill();
  path(lw * 0.6); ctx.fillStyle = P.ink; ctx.fill();
  path(0); ctx.fillStyle = P.cloud; ctx.fill();
  ctx.fillStyle = P.cloudBlue; ctx.beginPath(); ctx.arc(x + 0.3 * rx, y + 0.2 * ry + bob, 0.28 * rx, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = P.white; ctx.beginPath(); ctx.arc(x - 0.2 * rx, y - 0.45 * ry + bob, 0.14 * rx, 0, Math.PI * 2); ctx.fill();
}

// The landing marker: a small chevron on the ground line, bobbing, with a shadow on the band.
function drawMark(ctx, x, gy, s, time, col = P.white) {
  const b = Math.sin(time * 7) * 1.5 * s, tip = gy - 2 * s + b;
  ctx.fillStyle = P.shadow; ctx.beginPath(); ctx.ellipse(x, gy + 2 * s, 7 * s, 2 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col; ctx.strokeStyle = P.ink; ctx.lineWidth = 1.6 * s; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x, tip); ctx.lineTo(x - 6 * s, tip - 9 * s); ctx.lineTo(x + 6 * s, tip - 9 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
}

// A wafer ramp: a cream wedge with a crosshatch of baked lines and an ink outline (a sprite per size).
function drawRamp(ctx, x, gy, w, h, s, lw) {
  const p = lw * 2;
  cached(ctx, `wafer|${(w / h).toFixed(2)}|${lw.toFixed(2)}`, x - p, gy - h - p, w + 2 * p, h + 2 * p, (c) => wafer(c, p, h + p, w, h, s, lw));
}
function wafer(ctx, x, gy, w, h, s, lw) {
  const tri = () => { ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy - h); ctx.lineTo(x + w, gy); ctx.closePath(); };
  ctx.save(); tri(); ctx.fillStyle = P.ramp; ctx.fill(); ctx.clip();
  ctx.strokeStyle = P.rampPlank; ctx.lineWidth = 1.2 * s; ctx.beginPath();
  const step = 9 * s;
  for (let d = -h; d < w + h; d += step) { ctx.moveTo(x + d, gy); ctx.lineTo(x + d + h, gy - h); ctx.moveTo(x + d, gy - h); ctx.lineTo(x + d + h, gy); }
  ctx.stroke(); ctx.restore();
  tri(); ctx.strokeStyle = P.ink; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke();
}

// A bird in sugared pastel: a round mint body with a white rim and an ink outline, a flapping wing, sugar glints, a yellow
// beak toward `dir` (-1 left, 1 right).
function drawBird(ctx, x, y, s, time, dir, rot) {
  const r = T.birdR * s * 0.75, flap = Math.sin(time * 14) * 0.9;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(dir, 1);
  ctx.lineJoin = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = T.style.line * s * 0.8;
  ctx.fillStyle = P.coin; ctx.beginPath(); ctx.moveTo(r * 0.8, -r * 0.2); ctx.lineTo(r * 1.6, 0); ctx.lineTo(r * 0.8, r * 0.25); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.strokeStyle = P.birdRim; ctx.lineWidth = T.style.line * s * 2.6; ctx.stroke();
  ctx.fillStyle = P.bird; ctx.strokeStyle = P.ink; ctx.lineWidth = T.style.line * s * 0.8; ctx.fill(); ctx.stroke();
  ctx.fillStyle = P.birdWing; ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.1); ctx.lineTo(r * 0.3, -r * 0.1); ctx.lineTo(-r * 0.3, -r * 0.1 - r * 1.3 * flap); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = P.white; ctx.fillRect(-r * 0.55, r * 0.35, r * 0.16, r * 0.16); ctx.fillRect(-r * 0.15, r * 0.55, r * 0.14, r * 0.14);
  ctx.fillStyle = P.eye; ctx.beginPath(); ctx.arc(r * 0.4, -r * 0.3, r * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(r * 0.5, -r * 0.3, r * 0.14, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Sprites: a shape that does not change frame to frame is drawn once into an OffscreenCanvas and reused (every draw call
// costs on a slow phone; one image is one call). Its pixel width and height are each the next step up a ladder of 1.2x
// steps, so the same sprite serves while the camera zooms and is drawn at most a step smaller than it was made. Without
// OffscreenCanvas it is drawn live.
const SPRITES = new Map();
function cached(ctx, key, x, y, w, h, draw) {
  const t = ctx.getTransform ? ctx.getTransform() : null, dpr = t ? Math.hypot(t.a, t.b) : 1;
  if (typeof OffscreenCanvas === 'undefined' || !(dpr > 0) || !(w > 0) || !(h > 0)) { ctx.save(); ctx.translate(x, y); draw(ctx); ctx.restore(); return; }
  const sw = Math.ceil(Math.log(w * dpr) / Math.log(1.2)), sh = Math.ceil(Math.log(h * dpr) / Math.log(1.2)), k = `${key}|${sw}|${sh}`;
  let cv = SPRITES.get(k);
  if (!cv) {
    if (SPRITES.size > 400) SPRITES.clear();
    const W = Math.pow(1.2, sw), H = Math.pow(1.2, sh);
    cv = new OffscreenCanvas(Math.max(1, Math.ceil(W)), Math.max(1, Math.ceil(H)));
    const c = cv.getContext('2d'); c.scale(W / w, H / h); draw(c); SPRITES.set(k, cv);
  }
  ctx.drawImage(cv, x, y, w, h);
}

// The hero: an apricot mochi, a soft round blob with an ink outline and a light halo, a powder dusting, blush, eyes that look
// where it is going, and its gear (PRD v0.2 E): the Fizz Tank's bottle on its back (larger per level, filled to the fizz
// left), the Cola Rocket's nozzle (larger per level), and the Sugar Glaze (a shine per level and a tighter shape). The hitbox
// is the round critterR whatever the drawing.
function drawMochi(ctx, x, y, r, look, sx, sy, lw, up, time, fuelK = 1, holding = false, rot = 0) {
  const aero = up.aero || 0, rx = r * (1.12 - 0.04 * aero), ry = r * (0.9 + 0.03 * aero), oy = r - ry;
  const bx = -Math.cos(look), by = -Math.sin(look); // its back, away from where it is going
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sx, sy); ctx.rotate(-rot); // squash or stretch along `rot`
  ctx.lineJoin = 'round';
  const side = bx < 0 ? -1 : 1; // the bottle rides on the upper back, the nozzle points out behind
  if (up.fuel) { // the bottle: a sprite per size, side and tenth of fizz left
    const h = r * (0.8 + 0.25 * up.fuel), f = Math.round(fuelK * 10) / 10, m = h * 0.9;
    cached(ctx, `bottle${side}${f}|${lw.toFixed(2)}`, side * (rx + h * 0.05) - m, oy - ry * 0.55 - m, 2 * m, 2 * m, (c) => drawBottle(c, m, m, h, side * 0.5, f, lw));
  }
  if (up.rocket) { // the nozzle: a sprite per size and level, turned to point behind
    const len = r * (0.5 + 0.2 * up.rocket), m = len * 1.6;
    ctx.save(); ctx.translate(bx * rx * 0.8, oy + by * ry * 0.8); ctx.rotate(Math.atan2(by, bx));
    cached(ctx, `nozzle${up.rocket}|${lw.toFixed(2)}`, -m, -m, 2 * m, 2 * m, (c) => drawNozzle(c, m, m, len, 0, up.rocket, false, lw, 0));
    if (holding) { ctx.fillStyle = P.fizz; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(len * (1.25 + 0.15 * Math.sin(time * 40)), 0, len * 0.32, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.restore();
  }
  const m = r + 3 * lw; // the body, powder, glaze and blush are one sprite per size and glaze
  cached(ctx, `mochi${aero}|${lw.toFixed(2)}`, -m, oy - m, 2 * m, 2 * m, (c) => { c.translate(m, m); mochiBody(c, rx, ry, r, lw, aero); });
  if (aero >= 3) { const k = 0.6 + 0.4 * Math.sin(time * 5); ctx.fillStyle = P.white; ctx.globalAlpha = 0.9; star4(ctx, rx * 0.55, oy - ry * 0.75, r * 0.32 * k); ctx.globalAlpha = 1; }
  const ex = Math.cos(look) * r * 0.3, ey = Math.sin(look) * r * 0.3;
  for (const [col, k, rr] of [[P.eye, 0.4, 0.24], [P.ink, 0.7, 0.12]]) {
    ctx.fillStyle = col; ctx.beginPath();
    for (const ox of [-0.05, 0.42]) { ctx.moveTo(ox * r + ex * k + r * rr, oy - r * 0.12 + ey * k); ctx.arc(ox * r + ex * k, oy - r * 0.12 + ey * k, r * rr, 0, Math.PI * 2); }
    ctx.fill();
  }
  ctx.strokeStyle = P.ink; ctx.lineWidth = Math.max(1, lw * 0.6); ctx.beginPath(); ctx.arc(r * 0.18 + ex * 0.3, oy + r * 0.22 + ey * 0.2, r * 0.12, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  ctx.restore();
}

// The mochi's body at the origin (its centre): halo, apricot fill, ink outline, powder, the glaze's shines, blush.
function mochiBody(ctx, rx, ry, r, lw, aero) {
  const oy = 0;
  ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.ellipse(0, oy, rx, ry, 0, 0, Math.PI * 2);
  ctx.strokeStyle = P.halo; ctx.lineWidth = 3 * lw; ctx.stroke(); // the halo keeps the edge on the dusk sky
  ctx.fillStyle = P.critter; ctx.strokeStyle = P.ink; ctx.lineWidth = lw; ctx.fill(); ctx.stroke();
  ctx.fillStyle = P.powder; ctx.beginPath(); for (const [px, py] of [[-0.4, -0.7], [0.1, -0.82], [0.5, -0.6]]) ctx.rect(px * rx, oy + py * ry, r * 0.09, r * 0.09); ctx.fill();
  if (aero) { // the glaze: one shine, two, then a twinkle
    ctx.strokeStyle = P.white; ctx.lineCap = 'round'; ctx.globalAlpha = 0.9;
    ctx.lineWidth = r * (0.1 + 0.03 * aero); ctx.beginPath(); ctx.ellipse(0, oy, rx * 0.72, ry * 0.68, 0, Math.PI * 1.08, Math.PI * (1.25 + 0.1 * aero));
    if (aero >= 2) { ctx.moveTo(rx * 0.72 * Math.cos(Math.PI * 1.55), oy + ry * 0.68 * Math.sin(Math.PI * 1.55)); ctx.ellipse(0, oy, rx * 0.72, ry * 0.68, 0, Math.PI * 1.55, Math.PI * 1.68); }
    ctx.stroke();
    ctx.globalAlpha = 1; ctx.lineCap = 'butt';
  }
  ctx.fillStyle = P.critterLight; ctx.beginPath(); ctx.ellipse(-rx * 0.45, oy + ry * 0.25, r * 0.2, r * 0.13, 0, 0, Math.PI * 2);
  ctx.moveTo(rx * 0.62 + r * 0.17, oy + ry * 0.25); ctx.ellipse(rx * 0.62, oy + ry * 0.25, r * 0.17, r * 0.12, 0, 0, Math.PI * 2); ctx.fill();
}

// A four-point sparkle.
function star4(ctx, x, y, r) {
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r); ctx.fill();
}

// The Fizz Tank: a glass soda bottle `h` tall, tilted by `rot`, filled to `fill` with soda, a pink cap.
function drawBottle(ctx, x, y, h, rot, fill, lw) {
  const w = h * 0.5, bh = h * 0.68, nh = h * 0.2;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  roundRectPath(ctx, -w / 2, -bh / 2, w, bh, w * 0.35); ctx.moveTo(-w * 0.2, -bh / 2); ctx.rect(-w * 0.2, -bh / 2 - nh, w * 0.4, nh + 2);
  ctx.fillStyle = P.glass; ctx.strokeStyle = P.ink; ctx.lineWidth = lw * 0.8; ctx.stroke(); ctx.fill();
  const lh = (bh - 3) * fill; ctx.fillStyle = P.soda; ctx.fillRect(-w / 2 + 2, bh / 2 - 1.5 - lh, w - 4, lh);
  ctx.fillStyle = P.cap; ctx.beginPath(); ctx.rect(-w * 0.28, -bh / 2 - nh - h * 0.1, w * 0.56, h * 0.12); ctx.fill(); ctx.stroke();
  ctx.restore();
}

// The Cola Rocket: a nozzle `len` long pointing along `ang` (its back); level 3 adds a pink band. While held it glows with fizz.
function drawNozzle(ctx, x, y, len, ang, lvl, holding, lw, time) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  const w0 = len * 0.42, w1 = len * 0.7;
  ctx.beginPath(); ctx.moveTo(-len * 0.2, -w0 / 2); ctx.lineTo(len, -w1 / 2); ctx.lineTo(len, w1 / 2); ctx.lineTo(-len * 0.2, w0 / 2); ctx.closePath();
  ctx.fillStyle = P.nozzle; ctx.strokeStyle = P.ink; ctx.lineWidth = lw * 0.8; ctx.fill(); ctx.stroke();
  if (lvl >= 2) { ctx.fillStyle = P.cola; ctx.fillRect(len * 0.75, -w1 / 2, len * 0.25, w1); ctx.strokeRect(len * 0.75, -w1 / 2, len * 0.25, w1); }
  if (lvl >= 3) { ctx.fillStyle = P.cap; ctx.fillRect(len * 0.3, -w1 * 0.4, len * 0.15, w1 * 0.8); }
  if (holding) { ctx.fillStyle = P.fizz; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(len * (1.25 + 0.15 * Math.sin(time * 40)), 0, w1 * 0.45, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  ctx.restore();
}

// The Mochi Maker 3000 (PRD v0.3 A): a brass body on an iron plinth with a pressure gauge, a row of bulbs, a chimney and two
// pistons, and a barrel on an iron yoke at the pivot (x = 0, pivotH up). Upgrades bolt on parts: the Spring Coil behind the
// breech, the Fizz Tank on the left, the Cola Rocket's flared muzzle, the Sugar Glaze drum on the plinth, the Steady Gauge's
// bezel, the Brass Telescope on the barrel. `k` is CSS px per world unit. The body is one sprite per gear and size; the
// barrel, needle, bulbs and pistons are drawn live. `pre`: { gauge: reading or null, half: zone half-widths, lit: zone the
// bulbs show, glow: 0 to 1, pump: 0 to 1 }.
const MACHINE = 1.3;     // the machine is drawn in units of 1.3 world units (its pivot at 60, its barrel 34 long in them)
const GAUGE = { x: -46, y: 30, r: 19 }; // the dial on the body (machine units from the pivot's foot)
const BULBS = [-72, -63, -54, -45, -36];
function drawMachine(ctx, E, mx, gy, k0, lw, up, aim, pre) {
  const k = k0 * MACHINE, U = (u) => mx + u * k, V = (v) => gy - v * k, half = pre.half || gaugeOf(0, 0, up).half;
  const x0 = U(-104), y0 = V(80), key = `machine|${up.fuel || 0}${up.aero || 0}${up.steady || 0}|${half.map((h) => h.toFixed(3)).join(',')}|${lw.toFixed(2)}`;
  cached(ctx, key, x0, y0, 128 * k, 82 * k, (c) => { c.translate(-x0, -y0); machineBody(c, U, V, k, lw, up, half); });
  const pump = pre.pump || 0, kick = pump > 0 ? Math.abs(Math.sin((1 - pump) * Math.PI * 3)) * pump : 0;
  ctx.lineJoin = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = lw * 0.8;
  for (const px of [-26, -16]) { // pistons: rods shoot up as they pump
    const top = 52 + 5 + 9 * kick;
    ctx.fillStyle = P.spring; ctx.fillRect(U(px - 1.5), V(top), 3 * k, (top - 52) * k); ctx.strokeRect(U(px - 1.5), V(top), 3 * k, (top - 52) * k);
    ctx.fillStyle = P.brassDark; roundRectPath(ctx, U(px - 3.5), V(top + 2), 7 * k, 3 * k, 1.5 * k); ctx.fill(); ctx.stroke();
  }
  // Barrel, with its parts, turned to the aim; the yoke in front of the breech.
  ctx.save(); ctx.translate(U(0), V(T.pivotH / MACHINE)); ctx.rotate(-aim * DEG);
  const bk = `barrel|${up.band || 0}${up.rocket || 0}${up.scope || 0}|${lw.toFixed(2)}`, bx0 = -34 * k, by0 = -16 * k;
  cached(ctx, bk, bx0, by0, (T.barrelLen / MACHINE + 52) * k, 32 * k, (c) => { c.translate(-bx0, -by0); drawBarrel(c, k, lw, up); });
  ctx.restore();
  ctx.fillStyle = P.iron; ctx.beginPath(); ctx.moveTo(U(-10), V(52)); ctx.lineTo(U(-3), V(T.pivotH / MACHINE + 3)); ctx.lineTo(U(3), V(T.pivotH / MACHINE + 3)); ctx.lineTo(U(10), V(52)); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = P.brassLight; ctx.beginPath(); ctx.arc(U(0), V(T.pivotH / MACHINE), 3.2 * k, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // The gauge's needle.
  const gv = pre.gauge ?? 0, th = (225 - 270 * gv) * DEG, gx = U(GAUGE.x), gyy = V(GAUGE.y), R = GAUGE.r * k * 0.86;
  ctx.lineCap = 'round';
  for (const [w, col] of [[3.4 * k, P.halo], [1.6 * k, P.ink]]) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(gx - Math.cos(th) * R * 0.2, gyy + Math.sin(th) * R * 0.2); ctx.lineTo(gx + Math.cos(th) * R, gyy - Math.sin(th) * R); ctx.stroke(); }
  ctx.lineCap = 'butt'; ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(gx, gyy, 2.6 * k, 0, Math.PI * 2); ctx.fill();
  // Bulbs: off, a preview of the zone under the needle, or lit by the shot (every bulb on a Perfect, chasing).
  const lit = pre.lit ?? -1, n = lit < 0 ? 0 : [5, 4, 3, 1][lit], glow = pre.glow || 0;
  BULBS.forEach((bx, i) => {
    const on = i < n, col = lit === 0 ? (Math.floor(E.time * 12 + i) % 2 ? P.bulb[0] : P.bulb[1]) : P.bulb[lit] || P.bulbOff, x = U(bx), y = V(56);
    if (on && glow > 0) { ctx.globalAlpha = 0.35 * glow; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 9 * k * (0.8 + glow * 0.4), 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.fillStyle = on ? col : P.bulbOff; ctx.globalAlpha = on ? (glow > 0 ? 1 : 0.75) : 1;
    ctx.strokeStyle = P.ink; ctx.lineWidth = lw * 0.7; ctx.beginPath(); ctx.arc(x, y, 3.6 * k, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
    if (on) { ctx.fillStyle = P.white; ctx.beginPath(); ctx.arc(x - 1.2 * k, y - 1.2 * k, 1 * k, 0, Math.PI * 2); ctx.fill(); }
  });
}

function machineBody(ctx, U, V, k, lw, up, half) {
  ctx.lineJoin = 'round'; ctx.strokeStyle = P.ink;
  const box = (x0, y0, x1, y1, r, fill) => { roundRectPath(ctx, U(x0), V(y1), (x1 - x0) * k, (y1 - y0) * k, r * k); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.stroke(); };
  box(-84, 50, -76, 74, 1.5, P.iron); box(-86, 72, -74, 76, 1.5, P.ironDark); // chimney and cap
  box(-96, 0, 16, 8, 3, P.iron);
  box(-90, 8, 6, 52, 8, P.brass);
  ctx.fillStyle = P.brassDark; ctx.fillRect(U(-88), V(16), 92 * k, 4 * k); // a dark band low on the body
  ctx.fillStyle = P.brassLight; ctx.fillRect(U(-84), V(48), 80 * k, 2 * k);  // a highlight under the top edge
  ctx.fillStyle = P.brassDark; for (let x = -84; x <= 0; x += 10) { ctx.beginPath(); ctx.arc(U(x), V(12), 1.2 * k, 0, Math.PI * 2); ctx.arc(U(x), V(45), 1.2 * k, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = P.ironDark; for (const x of [-86, -40, 8]) { ctx.beginPath(); ctx.arc(U(x), V(4), 1.6 * k, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = P.iron; ctx.lineWidth = 3 * k; ctx.beginPath(); ctx.moveTo(U(-20), V(14)); ctx.lineTo(U(-20), V(22)); ctx.lineTo(U(-6), V(22)); ctx.lineTo(U(-6), V(40)); ctx.stroke(); // a pipe
  ctx.strokeStyle = P.ink; ctx.lineWidth = lw * 0.5; ctx.stroke();
  for (let i = 0; i < 5; i++) { ctx.fillStyle = P.ironDark; ctx.fillRect(U(BULBS[i] - 2), V(54), 4 * k, 2.4 * k); } // bulb sockets
  if (up.fuel) { // the Fizz Tank: a glass tank on the left, taller per level
    const h = 18 + 7 * up.fuel; box(-102, 8, -90, 8 + h, 4, P.glass);
    ctx.fillStyle = P.soda; ctx.fillRect(U(-100), V(8 + h * 0.75), 8 * k, (h * 0.75 - 2) * k);
    ctx.fillStyle = P.cap; ctx.fillRect(U(-99), V(10 + h), 6 * k, 2.5 * k);
  }
  if (up.aero) { // the Sugar Glaze drum on the plinth, larger per level, a drip
    const r = 5 + 1.5 * up.aero; ctx.fillStyle = P.glaze; ctx.beginPath(); ctx.arc(U(10), V(8 + r), r * k, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = P.ink; ctx.stroke();
    ctx.fillStyle = P.white; ctx.beginPath(); ctx.arc(U(10), V(8 + r), r * 0.4 * k, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  drawGauge(ctx, U(GAUGE.x), V(GAUGE.y), GAUGE.r * k, null, half, up.steady || 0, lw);
}

// The pressure gauge: a cream dial with a bezel (iron, then brass, light brass and gold with Steady Gauge), the zones as a
// band from 225 degrees round to -45 (Weak slate, Good blue, Great rose, Perfect gold around gaugeSweet), and ticks.
function drawGauge(ctx, x, y, R, v, half, steady, lw) {
  const th = (g) => -(225 - 270 * g) * DEG;
  ctx.lineJoin = 'round';
  ctx.fillStyle = [P.iron, P.brassDark, P.brass, P.coin][steady]; ctx.strokeStyle = P.ink; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.arc(x, y, R * 1.12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = P.dial; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = lw * 0.6; ctx.stroke();
  const band = (g0, g1, col) => { ctx.beginPath(); ctx.arc(x, y, R * 0.92, th(clamp(g0, 0, 1)), th(clamp(g1, 0, 1))); ctx.arc(x, y, R * 0.6, th(clamp(g1, 0, 1)), th(clamp(g0, 0, 1)), true); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); };
  band(0, 1, P.zones[3]);
  for (let z = 2; z >= 0; z--) band(T.gaugeSweet - half[z], T.gaugeSweet + half[z], P.zones[z]);
  ctx.strokeStyle = P.ink; ctx.lineWidth = lw * 0.5; ctx.beginPath(); ctx.arc(x, y, R * 0.92, th(0), th(1)); ctx.arc(x, y, R * 0.6, th(1), th(0), true); ctx.closePath(); ctx.stroke();
  ctx.beginPath(); for (let i = 0; i <= 10; i++) { const a = th(i / 10); ctx.moveTo(x + Math.cos(a) * R * 0.5, y + Math.sin(a) * R * 0.5); ctx.lineTo(x + Math.cos(a) * R * 0.58, y + Math.sin(a) * R * 0.58); } ctx.stroke();
  for (let i = 0; i < steady; i++) { ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(x - R * 0.2 + i * R * 0.2, y + R * 0.72, R * 0.06, 0, Math.PI * 2); ctx.fill(); } // damper screws
  if (v !== null) { const a = th(v); ctx.strokeStyle = P.ink; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * R * 0.85, y + Math.sin(a) * R * 0.85); ctx.stroke(); }
}

// The barrel in its own frame: the breech at the pivot, the tube along +x to barrelLen; the Spring Coil out of the back.
function drawBarrel(ctx, k, lw, up) {
  const L = T.barrelLen / MACHINE, band = up.band || 0;
  ctx.lineJoin = 'round'; ctx.strokeStyle = P.ink;
  drawCoil(ctx, -12 * k - (12 + 5 * band) * k, 0, (12 + 5 * band) * k, (5 + 1.5 * band) * k, 5 + 2 * band, lw);
  roundRectPath(ctx, -12 * k, -9 * k, 16 * k, 18 * k, 3 * k); ctx.fillStyle = P.iron; ctx.fill(); ctx.lineWidth = lw; ctx.stroke();
  roundRectPath(ctx, 0, -7 * k, (L - 2) * k, 14 * k, 3 * k); ctx.fillStyle = P.brass; ctx.fill(); ctx.stroke();
  ctx.fillStyle = P.brassLight; ctx.fillRect(2 * k, -5 * k, (L - 8) * k, 2.4 * k);
  ctx.fillStyle = P.brassDark; for (const x of [10, 21]) { ctx.fillRect(x * k, -7.5 * k, 3 * k, 15 * k); ctx.strokeRect(x * k, -7.5 * k, 3 * k, 15 * k); }
  if (up.rocket) { // the Cola Rocket: a flared muzzle, wider per level
    const f = 2 + 1.6 * up.rocket; ctx.beginPath(); ctx.moveTo((L - 5) * k, -8 * k); ctx.lineTo((L + 1) * k, -(8 + f) * k); ctx.lineTo((L + 1) * k, (8 + f) * k); ctx.lineTo((L - 5) * k, 8 * k); ctx.closePath();
    ctx.fillStyle = P.nozzle; ctx.fill(); ctx.stroke(); ctx.fillStyle = P.cola; ctx.fillRect((L - 2) * k, -(7 + f) * k, 2 * k, (14 + 2 * f) * k);
  } else { roundRectPath(ctx, (L - 5) * k, -9 * k, 6 * k, 18 * k, 2 * k); ctx.fillStyle = P.brassDark; ctx.fill(); ctx.stroke(); }
  if (up.scope) drawScope(ctx, 2 * k, -12 * k, (12 + 6 * up.scope) * k, 0, up.scope, lw);
}

// A coil spring from (x, y) `len` long along +x, `r` tall either side, `turns` loops (the Spring Coil).
function drawCoil(ctx, x, y, len, r, turns, lw) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const path = () => { ctx.beginPath(); ctx.moveTo(x, y); for (let i = 0; i <= turns * 2; i++) ctx.lineTo(x + (len * i) / (turns * 2), y + (i % 2 ? -r : r)); ctx.lineTo(x + len, y); };
  path(); ctx.strokeStyle = P.ink; ctx.lineWidth = lw * 2.2; ctx.stroke();
  ctx.strokeStyle = P.spring; ctx.lineWidth = lw; ctx.stroke(); ctx.lineCap = 'butt';
}

// The Brass Telescope: a tube `len` long from (x, y) along `ang`, with an eyepiece and a lens; level 3 adds a band.
function drawScope(ctx, x, y, len, ang, lvl, lw) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.lineJoin = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = lw * 0.8;
  const w = len * 0.2;
  roundRectPath(ctx, 0, -w * 0.4, len * 0.3, w * 0.8, w * 0.2); ctx.fillStyle = P.brassDark; ctx.fill(); ctx.stroke();
  roundRectPath(ctx, len * 0.25, -w / 2, len * 0.75, w, w * 0.25); ctx.fillStyle = P.brass; ctx.fill(); ctx.stroke();
  ctx.fillStyle = P.cloudBlue; ctx.beginPath(); ctx.ellipse(len, 0, w * 0.18, w * 0.42, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (lvl >= 3) { ctx.fillStyle = P.coin; ctx.fillRect(len * 0.6, -w / 2, len * 0.08, w); }
  ctx.restore();
}

// The Sugar Glaze drum (the shop's picture): a pink drum on a stand with a white glaze face, larger per level.
function drawGlazeDrum(ctx, x, y, r, lvl, lw) {
  ctx.lineJoin = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = lw * 0.8;
  ctx.fillStyle = P.iron; ctx.fillRect(x - r * 1.1, y + r * 0.7, r * 2.2, r * 0.4); ctx.strokeRect(x - r * 1.1, y + r * 0.7, r * 2.2, r * 0.4);
  ctx.fillStyle = P.glaze; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = P.white; ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  for (let i = 0; i < lvl; i++) { ctx.fillStyle = P.white; ctx.beginPath(); ctx.arc(x + r * (0.9 - i * 0.35), y + r * 1.25 + i * 2, r * 0.12, 0, Math.PI * 2); ctx.fill(); }
}

// A shopfront: the bakery the mochi is flung from (or, with `home`, the daifuku's cottage), `w` wide, standing on the ground.
function drawBakery(ctx, x, gy, w, s, lw, home = false) {
  const h = w * 0.75, aw = h * 0.2;
  ctx.lineJoin = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = lw * 0.8; ctx.globalAlpha = 0.9;
  ctx.fillStyle = P.shopWall; ctx.fillRect(x, gy - h, w, h); ctx.strokeRect(x, gy - h, w, h);
  if (home) { ctx.fillStyle = P.berry; ctx.beginPath(); ctx.moveTo(x - 6 * s, gy - h); ctx.lineTo(x + w / 2, gy - h - w * 0.4); ctx.lineTo(x + w + 6 * s, gy - h); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  else for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? P.white : P.awning; ctx.beginPath(); ctx.moveTo(x - 4 * s + (i * (w + 8 * s)) / 6, gy - h); ctx.lineTo(x - 4 * s + ((i + 1) * (w + 8 * s)) / 6, gy - h); ctx.lineTo(x - 4 * s + ((i + 1) * (w + 8 * s)) / 6, gy - h + aw); ctx.arc(x - 4 * s + ((i + 0.5) * (w + 8 * s)) / 6, gy - h + aw, (w + 8 * s) / 12, 0, Math.PI); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = P.cloudBlue; ctx.fillRect(x + w * 0.12, gy - h * 0.55, w * 0.42, h * 0.3); ctx.strokeRect(x + w * 0.12, gy - h * 0.55, w * 0.42, h * 0.3);
  ctx.fillStyle = home ? P.heart : P.awning; ctx.fillRect(x + w * 0.66, gy - h * 0.5, w * 0.22, h * 0.5); ctx.strokeRect(x + w * 0.66, gy - h * 0.5, w * 0.22, h * 0.5);
  ctx.globalAlpha = 1;
}

// The shopfront as a sprite (it is the same every frame).
function shopfront(ctx, x, gy, w, s, lw, home) {
  const x0 = x - 8 * s, y0 = gy - w * 1.2, sw = w + 16 * s, sh = w * 1.2 + 2;
  cached(ctx, `shop${home}|${lw.toFixed(2)}`, x0, y0, sw, sh, (c) => { c.translate(-x0, -y0); drawBakery(c, x, gy, w, s, lw, home); });
}

// A place's line: a candy-cane post with a round sign in the new place's ground colour.
function drawPost(ctx, x, gy, s, col, lw) {
  const h = 34 * s;
  ctx.strokeStyle = P.ink; ctx.lineWidth = 4.5 * s; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, gy - h); ctx.stroke();
  ctx.strokeStyle = P.post; ctx.lineWidth = 2.8 * s; ctx.stroke();
  ctx.strokeStyle = P.berry; ctx.setLineDash([3 * s, 3 * s]); ctx.stroke(); ctx.setLineDash([]); ctx.lineCap = 'butt';
  ctx.fillStyle = col; ctx.strokeStyle = P.ink; ctx.lineWidth = lw * 0.8; ctx.beginPath(); ctx.arc(x, gy - h - 6 * s, 7 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}

// The daifuku: a round white-pink dumpling with a strawberry on top, blush and a small smile; her heart beats over her.
function drawDaifuku(ctx, x, y, r, time, lw, heart = true) {
  ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round';
  ctx.fillStyle = P.berry; ctx.strokeStyle = P.ink; ctx.lineWidth = lw * 0.8;
  ctx.beginPath(); ctx.moveTo(-r * 0.45, -r * 0.7); ctx.quadraticCurveTo(0, -r * 1.6, r * 0.45, -r * 0.7); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = P.leaf; ctx.beginPath(); ctx.ellipse(0, -r * 1.35, r * 0.25, r * 0.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = P.seed; ctx.fillRect(-r * 0.15, -r * 1.0, r * 0.08, r * 0.08); ctx.fillRect(r * 0.12, -r * 0.9, r * 0.08, r * 0.08);
  ctx.beginPath(); ctx.ellipse(0, r * 0.08, r * 1.08, r * 0.92, 0, 0, Math.PI * 2);
  ctx.strokeStyle = P.halo; ctx.lineWidth = lw * 3; ctx.stroke();
  ctx.fillStyle = P.dough; ctx.strokeStyle = P.ink; ctx.lineWidth = lw; ctx.fill(); ctx.stroke();
  ctx.fillStyle = P.blush; ctx.beginPath(); ctx.ellipse(-r * 0.5, r * 0.3, r * 0.2, r * 0.13, 0, 0, Math.PI * 2); ctx.ellipse(r * 0.5, r * 0.3, r * 0.2, r * 0.13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = P.ink; for (const ox of [-0.28, 0.28]) { ctx.beginPath(); ctx.arc(ox * r, 0, r * 0.11, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = P.ink; ctx.lineWidth = Math.max(1, lw * 0.6); ctx.beginPath(); ctx.arc(0, r * 0.2, r * 0.13, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  if (heart) { const k = 1 + 0.15 * Math.sin(time * 6); ctx.fillStyle = P.heart; heartPath(ctx, 0, -r * 2.1, r * 0.45 * k); ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = lw * 0.6; ctx.stroke(); }
  ctx.restore();
}

function heartPath(ctx, x, y, r) {
  ctx.beginPath(); ctx.moveTo(x, y + r * 0.9);
  ctx.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.6, y - r * 1.2, x, y - r * 0.4);
  ctx.bezierCurveTo(x + r * 0.6, y - r * 1.2, x + r * 1.4, y - r * 0.1, x, y + r * 0.9); ctx.closePath();
}

function roundRectPath(ctx, x, y, w, h, rad) {
  const r = Math.min(rad, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ---------- Effects ----------
// World-space and cosmetic only: particles (dust, fizz, cola, feathers, splat, sugar cubes, cloud puffs, hearts), a tumbling
// bird, a floating word.

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
  if (e.k === 'steam') { // a puff that swells and fades as it rises
    const r = e.size * s * (1 + (1 - k) * 2.2);
    ctx.globalAlpha = 0.85 * Math.min(1, k * 1.4); ctx.fillStyle = e.color; ctx.strokeStyle = P.ink; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha *= 0.35; ctx.stroke(); ctx.globalAlpha = 1; return;
  }
  ctx.globalAlpha = Math.min(1, k * 1.5); ctx.fillStyle = e.color;
  const r = e.size * s * Math.max(0.5, k);
  if (e.k === 'coin') { // a sugar cube, tumbling
    ctx.save(); ctx.translate(x, y); ctx.rotate(e.t * 8); ctx.fillStyle = P.sugar; ctx.strokeStyle = P.ink; ctx.lineWidth = 1.2;
    ctx.fillRect(-r, -r, 2 * r, 2 * r); ctx.strokeRect(-r, -r, 2 * r, 2 * r); ctx.restore();
  } else if (e.k === 'heart') { heartPath(ctx, x, y, r); ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 1; ctx.stroke(); }
  else {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    if (e.k === 'fizz' || e.k === 'cola' || e.k === 'puff') { ctx.strokeStyle = e.k === 'cola' ? P.colaRim : P.ink; ctx.lineWidth = 0.8; ctx.stroke(); }
  }
  ctx.globalAlpha = 1;
}

// ---------- Sounds ----------
// Engine synth only (PRD section 12), through E.audio so the mute flag holds.
const SFX = {
  clunk: (E) => { E.audio.noise({ dur: 0.05, gain: 0.14 }); E.audio.beep({ freq: 150, dur: 0.09, slide: 0.6, gain: 0.12 }); E.audio.beep({ freq: 1100, dur: 0.02, gain: 0.05, delay: 0.03 }); },
  // The fire, by zone: the pistons pump, steam blows, and the whistle shrieks for a Perfect (a short toot for Great, a
  // sputter for Weak).
  fire: (E, z) => {
    [0, 0.07, 0.14].forEach((d, i) => E.audio.beep({ freq: 95 - i * 10, dur: 0.06, gain: 0.13, delay: d }));
    E.audio.noise({ dur: [0.5, 0.35, 0.22, 0.12][z], gain: [0.16, 0.12, 0.09, 0.06][z], delay: 0.05 });
    E.audio.beep({ freq: J.zoneFreq[z], dur: 0.16, type: 'triangle', slide: z === 3 ? 0.6 : 1.15, gain: 0.12 });
    if (z === 0) { E.audio.beep({ freq: 1500, dur: 0.5, type: 'sine', slide: 1.3, gain: 0.09, delay: 0.06 }); E.audio.beep({ freq: 2240, dur: 0.45, type: 'sine', slide: 1.25, gain: 0.05, delay: 0.08 }); }
    else if (z === 1) E.audio.beep({ freq: 1300, dur: 0.18, type: 'sine', gain: 0.07, delay: 0.06 });
    else if (z === 3) E.audio.beep({ freq: 180, dur: 0.25, type: 'sawtooth', slide: 0.5, gain: 0.07, delay: 0.05 });
  },
  boost: (E) => { E.audio.noise({ dur: 0.14, gain: 0.1 }); E.audio.beep({ freq: 220, dur: 0.16, type: 'sine', slide: 2.2, gain: 0.07 }); },
  whoosh: (E) => E.audio.noise({ dur: 0.12, gain: 0.04 }),
  chute: (E) => { E.audio.beep({ freq: 260, dur: 0.2, type: 'sine', slide: 1.7, gain: 0.1 }); E.audio.noise({ dur: 0.08, gain: 0.05 }); },
  drop: (E) => E.audio.beep({ freq: 760, dur: 0.16, type: 'sine', slide: 0.35, gain: 0.1 }),
  // A ground bounce: a boing pitched and loud by the impact; a condensed one adds a deep thump.
  bounce: (E, v, big) => {
    const k = clamp(v / 900, 0, 1);
    E.audio.beep({ freq: 160 + 220 * k, dur: 0.14 + 0.08 * k, type: 'sine', slide: 1.9, gain: 0.04 + 0.08 * k });
    if (big) E.audio.beep({ freq: 70, dur: 0.22, type: 'triangle', slide: 0.6, gain: 0.16 });
  },
  spring: (E, big) => { E.audio.beep({ freq: 1250, dur: 0.1, slide: 1.5 }); E.audio.beep({ freq: 420, dur: 0.18, type: 'sine', slide: 2.2, gain: 0.1 }); if (big) E.audio.beep({ freq: 210, dur: 0.35, type: 'sine', slide: 3, gain: 0.12, delay: 0.05 }); },
  bird: (E) => { E.audio.beep({ freq: 900, dur: 0.07, type: 'sawtooth', slide: 0.6, gain: 0.08 }); E.audio.beep({ freq: 1000, dur: 0.07, type: 'sawtooth', slide: 0.6, gain: 0.07, delay: 0.09 }); },
  chain: (E, n) => E.audio.beep({ freq: 520 * Math.pow(1.26, Math.min(n, 8)), dur: 0.14, type: 'triangle', gain: 0.12 }),
  geyser: (E) => { E.audio.noise({ dur: 0.35, gain: 0.12 }); E.audio.beep({ freq: 300, dur: 0.3, type: 'sine', slide: 3, gain: 0.1 }); },
  cloud: (E) => { E.audio.beep({ freq: 660, dur: 0.12, type: 'sine', slide: 0.8, gain: 0.08 }); E.audio.beep({ freq: 990, dur: 0.1, type: 'sine', gain: 0.06, delay: 0.08 }); },
  home: (E) => { [523, 659, 784, 1047].forEach((f, i) => E.audio.beep({ freq: f, dur: 0.22, type: 'triangle', gain: 0.12, delay: i * 0.12 })); },
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
  let y = top + 60;
  if (r && r.chain > 0) {
    const k = S.chainT > 0 ? ease.outBack(clamp(1 - (S.chainT - (J.chainLife - J.chainPop)) / J.chainPop, 0, 1)) : 1;
    pill(E, `Chain x${mult(r)}`, right, y, Math.max(TY.sm, Math.round((TY.sm + 3 * r.chain) * k)), 'right', P.tealLight);
    y += 36;
  }
  if (r && r.combo >= 2) { // the bounce combo: every bounce without a slide, popping on each
    const k = S.comboT > 0 ? 1 + 0.35 * (S.comboT / 0.25) : 1;
    pill(E, `${r.combo} bounces`, right, y, Math.round(TY.md * k), 'right', P.coin);
  }
  const x0 = sf.left + 16, y0 = top + 32;
  E.roundRect(x0 - 8, top - 4, Math.max(64, fuelMax * 18 + 14), 54, T.style.radius, P.panel);
  E.text('Fizz', x0, top + 10, { size: TY.sm, align: 'left', color: P.textDim, weight: '600' });
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
    pill(E, S.banner.text, E.w / 2, sf.top + 56 + 40 * inK, TY.lg, 'center', S.banner.color || P.coin);
    E.ctx.globalAlpha = 1;
  }
  if (S.actT > 0) { // the three actions, once, from the top of the first arc
    E.ctx.globalAlpha = clamp(S.actT / 0.3, 0, 1);
    pill(E, 'Hold: boost   Swipe up: sail   Swipe down: drop', E.w / 2, E.h - sf.bottom - 30, TY.md); // low, clear of the flight
    E.ctx.globalAlpha = 1;
  }
}

// ---------- Scenes ----------

const newSeed = () => (Math.random() * 2 ** 32) >>> 0; // the seed is setup; the flight itself never draws randomness
const btn = (E, label, cx, cy, o = {}) => E.button(label, cx, cy, { fill: P.button, color: P.text, ...o });

// The journey strip (PRD v0.2 E): the bakery at the left, the five places as a road in their own ground colours with a small
// picture each, the daifuku and a heart at the right; places reached are bright, the rest ghosted (state drawn, not
// written); the best distance is a small mochi on the road, and once Home is reached the two sit together. No text.
// The strip only changes with its width, the best, Home and the gear, so it is drawn once into a sprite and reused (the menu
// redraws every frame, and a few dozen small shapes a frame cost more than one image on a slow phone).
let JOURNEY = null;
function journeyStrip(E, x0, x1, y, best, home, up) {
  const h = 46, w = x1 - x0, key = JSON.stringify([w, best, home, up, E.dpr]);
  if (typeof OffscreenCanvas === 'undefined') { drawJourney(E.ctx, x0, x1, y, best, home, up); return; }
  if (!JOURNEY || JOURNEY.key !== key) {
    const cv = new OffscreenCanvas(Math.ceil(w * E.dpr), Math.ceil((h + 4) * E.dpr)), c = cv.getContext('2d');
    c.scale(E.dpr, E.dpr); c.translate(-x0, -(y - h / 2 - 2));
    drawJourney(c, x0, x1, y, best, home, up);
    JOURNEY = { key, cv };
  }
  E.ctx.drawImage(JOURNEY.cv, x0, y - h / 2 - 2, w, h + 4);
}
function drawJourney(ctx, x0, x1, y, best, home, up) {
  const lw = 2, h = 46, n = PLACES.length - 1, time = 0;
  roundRectPath(ctx, x0, y - h / 2, x1 - x0, h, T.style.radius); ctx.fillStyle = P.panel; ctx.fill();
  const rx0 = x0 + 46, rx1 = x1 - 46, seg = (rx1 - rx0) / n, ry = y + 12;
  const posOf = (m) => { let i = 0; while (i < n - 1 && m >= T.milestones[i]) i++; const a = i ? T.milestones[i - 1] : 0; return rx0 + seg * (i + clamp((m - a) / (T.milestones[i] - a), 0, 1)); };
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const reached = best >= (i ? T.milestones[i - 1] : 0), a = rx0 + seg * i, b = a + seg;
    ctx.globalAlpha = reached ? 1 : 0.35;
    ctx.strokeStyle = P.ink; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(a + 3, ry); ctx.lineTo(b - 3, ry); ctx.stroke();
    ctx.strokeStyle = PLACES[i].top; ctx.lineWidth = 6; ctx.stroke();
    drawPlaceIcon(ctx, i, a + seg / 2, y - 7, 9, lw);
  }
  ctx.globalAlpha = 1; ctx.lineCap = 'butt';
  drawBakery(ctx, x0 + 10, ry + 4, 26, 0.3, 1.4);
  const dx = x1 - 22, r = 9;
  if (home) { // together at the end of the road, a heart over them
    drawDaifuku(ctx, dx + 6, ry - r + 2, r, time, 1.6, false);
    drawMochi(ctx, dx - 14, ry - r + 2, r, 0, 1, 1, 1.6, up, time);
    ctx.fillStyle = P.heart; heartPath(ctx, dx - 4, y - 14, 6); ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 1; ctx.stroke();
  } else {
    ctx.globalAlpha = 0.6; drawDaifuku(ctx, dx, ry - r + 2, r, time, 1.6, false); ctx.globalAlpha = 1;
    ctx.fillStyle = P.heart; heartPath(ctx, dx, y - 14, 5); ctx.fill();
    drawMochi(ctx, Math.min(posOf(best), rx1), ry - r - 1, r, 0, 1, 1, 1.6, up, time);
  }
}

// A place's small picture: a cupcake, a gumdrop, a chocolate drop, soda bubbles, a gingerbread house.
function drawPlaceIcon(ctx, i, x, y, r, lw) {
  ctx.lineJoin = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = lw * 0.7;
  const shape = (fill, path) => { ctx.fillStyle = fill; ctx.beginPath(); path(); ctx.fill(); ctx.stroke(); };
  if (i === 0) { shape(P.shopWall, () => { ctx.moveTo(x - r * 0.7, y); ctx.lineTo(x + r * 0.7, y); ctx.lineTo(x + r * 0.5, y + r); ctx.lineTo(x - r * 0.5, y + r); ctx.closePath(); }); shape(P.awning, () => ctx.arc(x, y, r * 0.8, Math.PI, 0)); }
  else if (i === 1) shape(P.gumdrops[0], () => { ctx.moveTo(x - r, y + r * 0.8); ctx.quadraticCurveTo(x - r, y - r, x, y - r); ctx.quadraticCurveTo(x + r, y - r, x + r, y + r * 0.8); ctx.closePath(); });
  else if (i === 2) shape(P.river[0], () => { ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x + r, y + r * 0.2, x, y + r * 0.9); ctx.quadraticCurveTo(x - r, y + r * 0.2, x, y - r); });
  else if (i === 3) { shape(P.cloudBlue, () => ctx.arc(x - r * 0.3, y + r * 0.3, r * 0.6, 0, Math.PI * 2)); shape(P.cloudBlue, () => ctx.arc(x + r * 0.45, y - r * 0.35, r * 0.42, 0, Math.PI * 2)); }
  else { shape(P.house[0], () => ctx.rect(x - r * 0.7, y - r * 0.1, r * 1.4, r)); shape(P.house[1], () => { ctx.moveTo(x - r, y); ctx.lineTo(x, y - r); ctx.lineTo(x + r, y); ctx.closePath(); }); }
}

// The menu (principle 11): the journey strip along the top, the title, one headline number (the best distance), the three
// active goals under it, then Play, Shop and Sound.
const menu = {
  render(ctx, E) {
    const v = view(E), sf = E.safe, up = levelsOf(E), best = E.save.get('best', 0);
    drawWorld(ctx, E, v, newCamera(v.vw), null, null, up);
    journeyStrip(E, sf.left + 92, E.w - sf.right - 84, sf.top + 29, best, E.save.get('home', false), up); // clear of EXPORT and TUNE
    const titled = E.h - sf.top - sf.bottom >= T.menuTitleMinH; // on a short screen the strip is the title
    const cy = titled ? sf.top + 52 + Math.max(32, E.h * 0.12 - 14) : sf.top + 34;
    if (titled) E.text('LAUNCH', E.w / 2, cy, { size: TY.xl, weight: '800', color: P.ink });
    E.titleArea = titled ? { x: E.w / 2 - 110, y: cy - 30, w: 220, h: 60 } : { x: sf.left + 92, y: sf.top + 6, w: E.w - sf.left - sf.right - 176, h: 46 }; // release: five taps here show TUNE
    pill(E, `Best ${best} m`, E.w / 2, cy + 42, TY.md);
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

// The play scene. Before the launch S.phase is 'aim' (the barrel sweeps from ready) then 'gauge' (from the lock); a press
// anywhere takes the beat. In flight a press is a gesture (PRD v0.3 B), decided in its first gestureWindow of flight time.
const play = {
  enter(E, params = {}) {
    S.seed = params.seed ?? newSeed();
    S.run = null; S.endT = 0; S.frameReal = performance.now(); S.readyReal = S.frameReal; S.lockReal = 0; S.phase = 'aim'; S.aim = T.aimMin; S.t1 = 0;
    S.launchPid = null; S.gest = null; S.keyDown = {}; S.rate = 1;
    S.up = levelsOf(E); S.st = stats(S.up); S.cam = newCamera(view(E).vw);
    S.streak = E.save.get('perfectRow', 0); S.streakNow = S.streak; S.gauge = gaugeOf(S.seed, S.streak, S.up); S.gv = null; S.lit = -1;
    S.hint = E.save.get('flights', 0) < 2; // the two beats are named on a fresh save's first two flights
    S.fx.length = 0; S.pops = new Map(); S.sq = { amt: 0, t: 0 };
    for (const k of ['speedT', 'gaugePop', 'distPop', 'chainT', 'comboT', 'homeT', 'actT', 'pumpT', 'glowT', 'slowT', 'whooshT', 'streakT']) S[k] = 0;
    S.banner = { text: `★ ${PLACES[0].name}`, t: J.bannerTime };
    S.zonePop = null; S.arc = null; S.arcPts = new Float64Array(800); S.callouts = []; S.endWait = T.endDelay;
    S.teachBird = !E.save.get('birdTaught', false); S.teachMud = !E.save.get('mudTaught', false);
    S.teachAct = !E.save.get('actionsTaught', false); S.prevVy = 0; S.quit = false;
  },
  // Flight time now: the steps run, the remainder carried, and the real time since this frame began at the current rate.
  stamp(r) { return flightTime(r) + r.acc + Math.min(0.05, Math.max(0, (performance.now() - S.frameReal) / 1000)) * S.rate; },
  sinceReady() { return Math.max(0, (performance.now() - S.readyReal) / 1000); },
  sinceLock() { return Math.max(0, (performance.now() - S.lockReal) / 1000); },
  lock(E) {
    S.t1 = this.sinceReady(); S.aim = aimAngle(S.t1); S.phase = 'gauge'; S.lockReal = performance.now();
    SFX.clunk(E); E.haptic(J.haptic.lock); E.shake(1.5, 0.08);
    emit('steam', -16 * MACHINE, 60 * MACHINE, 3, { angle: Math.PI / 2, spread: 1.2, speed: 40, g: 30, life: 0.6, size: 3, color: P.steam });
  },
  fire(E) {
    const l = launchOf(S.seed, S.t1, this.sinceLock(), S.streak, S.up), v = view(E), z = l.zone;
    S.run = newRun(S.seed, l, S.up); S.phase = 'flight'; S.gv = l.gauge; S.lit = z; S.glowT = J.zonePop; S.pumpT = J.pump; S.hint = false;
    S.streakNow = z === 0 ? S.streak + 1 : 0; S.streakT = J.zonePop;
    SFX.fire(E, z); E.haptic(J.zoneHaptic[z]); E.shake(J.kick, J.kickTime);
    const [mx, my] = mouth(l.angle);
    emit('steam', -80 * MACHINE, 76 * MACHINE, J.steam[z], { angle: Math.PI / 2, spread: 0.9, speed: 70 + 20 * (3 - z), g: 40, life: 1.0, size: 4, color: P.steam }); // the chimney
    emit('steam', mx, my + T.critterR, J.steam[z], { angle: l.angle * DEG, spread: 1.4, speed: 110 + 30 * (3 - z), g: 30, life: 0.7, size: 3.5, color: P.steam }); // the muzzle
    const [dx, dy] = toView(S.cam, -40 * MACHINE, T.pivotH + 80);
    S.zonePop = { z, t: J.zonePop, x: dx * v.s, y: v.oy + dy * v.s };
    if (z === 0) { // Perfect: every bulb, the whistle, a gold flash, a ring of sparks, a shake and a slow-motion beat
      E.flash(P.zones[0], 0.18); E.shake(J.perfectShake, J.perfectShakeTime); S.slowT = J.slowMo;
      for (let i = 0; i < J.sparks; i++) { const t = (i / J.sparks) * Math.PI * 2; S.fx.push({ k: 'spark', x: mx, y: my + T.critterR, vx: Math.cos(t) * 160, vy: Math.sin(t) * 160, g: 0, t: 0.6, max: 0.6, size: 2.8, color: P.zones[0] }); }
    }
  },
  update(dt, E) {
    S.frameReal = performance.now();
    for (const k of ['speedT', 'gaugePop', 'distPop', 'chainT', 'comboT', 'actT', 'homeT', 'pumpT', 'glowT', 'slowT', 'streakT']) if (S[k] > 0) S[k] -= dt;
    S.rate = S.slowT > 0 ? J.slowMoRate : 1;
    if (S.sq.t > 0) S.sq.t -= dt;
    if (S.banner) { S.banner.t -= dt; if (S.banner.t <= 0) S.banner = null; }
    if (S.zonePop) { S.zonePop.t -= dt; if (S.zonePop.t <= 0) S.zonePop = null; }
    for (const c of S.callouts) c.t -= dt;
    S.callouts = S.callouts.filter((c) => c.t > 0);
    updateFx(dt * S.rate);
    const r = S.run;
    cameraStep(S.cam, r, view(E).vw, dt);
    if (Math.random() < dt * 1.5) emit('steam', -80 * MACHINE, 76 * MACHINE, 1, { angle: Math.PI / 2, spread: 0.5, speed: 30, g: 20, life: 1.2, size: 3, color: P.steam }); // the chimney idles
    if (!r) return;
    const g = S.gest;
    if (g && !g.kind && !r.ended && this.stamp(r) - g.t0 >= T.gestureWindow) { g.kind = 'boost'; queueInput(r, Math.max(g.t0 + T.gestureWindow, flightTime(r)), 'boostOn'); }
    for (const [k, off] of [[' ', 'boostOff'], ['ArrowUp', 'chuteOff']]) if (S.keyDown[k] && !E.keys.has(k)) { S.keyDown[k] = false; if (!r.ended) queueInput(r, this.stamp(r), off); }
    advance(r, dt * S.rate);
    if (S.teachAct && r.mode === 'air' && S.prevVy > 0 && r.vy <= 0) { S.teachAct = false; S.actT = J.actionHint; E.save.set('actionsTaught', true); } // the top of the first arc
    S.prevVy = r.vy;
    for (const e of r.ev) this.onEvent(e, E);
    r.ev.length = 0;
    S.arc = rangeArc(r, r.st.look, S.arcPts);
    if (S.arc) { S.arc.pts = S.arcPts; S.arc.mode = r.boost && r.fuel > 0 ? 1 : r.chute ? 2 : r.ball ? 3 : 0; }
    if (r.boost && r.fuel > 0 && !r.ended) { // the fizz trail and a whoosh
      const back = Math.atan2(-r.vy, -r.vx);
      emit('fizz', r.x, r.y + T.critterR, 2, { angle: back, spread: 0.5, speed: 140, vx: r.vx * 0.2, vy: r.vy * 0.2, g: 0, life: J.fizzTrail, size: 3.4, color: P.fizz });
      if (Math.random() < 0.5) emit('cola', r.x, r.y + T.critterR, 1, { angle: back, spread: 0.6, speed: 120, g: 0, life: J.fizzLife, size: 2.6, color: P.soda });
      S.whooshT -= dt; if (S.whooshT <= 0) { S.whooshT = J.whoosh; SFX.whoosh(E); }
    }
    if (r.ended) { S.endT += dt; if (S.endT >= S.endWait) E.setScene('over', finishFlight(E, r)); }
  },
  squash(amt) { S.sq = { amt: Math.min(J.landSquash, amt), t: J.squashTime }; },
  onEvent(e, E) {
    const r = S.run, cx = r.x, cy = r.y + T.critterR;
    if (e.k === 'spring') {
      SFX.spring(E, e.big); E.haptic(J.haptic.spring); this.squash(0.14 + r.vy / 2500); S.speedT = J.speedLines;
      const g = groundAt(r.field, r.x); if (g) S.pops.set(g, { t: J.springPop });
      if (e.big) { E.shake(J.bounceShake, J.bounceShakeTime); emit('dust', cx, 0, J.dust * 2, { angle: Math.PI / 2, spread: Math.PI, speed: 220, g: -300, life: 0.6, size: 3.5, color: P.tealLight }); }
      word(e.big ? 'BIG BOING!' : 'Boing', r.x - 40, 90, TY.md, J.boingLife);
      word(`↑ ${Math.round((r.vy * r.vy) / (2 * T.gravity) / T.unitsPerMetre)} m`, r.x - 40, 50, TY.sm, J.boingLife);
      S.comboT = 0.25;
    } else if (e.k === 'bounce') {
      const k = clamp(e.v / 900, 0, 1);
      SFX.bounce(E, e.v, e.big); this.squash(Math.max(0.08, e.v * J.bounceSquash)); S.comboT = 0.25;
      emit('dust', cx, 0, Math.round(4 + J.dust * k), { angle: Math.PI / 2, spread: Math.PI * 0.9, speed: 60 + 160 * k, g: -250, life: 0.5, size: 2.6 + 2 * k, color: P.dust });
      if (e.skim) emit('dust', cx, 0, 3, { angle: Math.PI * 0.85, spread: 0.4, speed: 120, g: -200, life: 0.4, size: 2, color: P.white });
      if (e.big || e.v > J.bigBounce) { E.shake(J.bounceShake * (e.big ? 1 : 0.6), J.bounceShakeTime); E.haptic(J.haptic.drop); }
      if (e.big) word('Bounce!', r.x - 30, 70, TY.md, J.boingLife);
    } else if (e.k === 'land') { this.squash(Math.max(0.1, e.v * J.bounceSquash)); emit('dust', cx, 0, 5, { angle: Math.PI / 2, spread: Math.PI * 0.9, speed: 70, g: -250, life: 0.5, size: 2.6, color: P.dust }); }
    else if (e.k === 'bird') {
      SFX.bird(E); E.haptic(J.haptic.bird);
      emit('feather', cx, cy, J.feathers, { speed: 140, g: -120, life: 0.7, size: 2.6, color: P.tealLight });
      let b = null, d = Infinity;
      for (const q of r.field.birds) if (q.hit && !q.tumbled && Math.abs(q.x0 - r.x) < d) { d = Math.abs(q.x0 - r.x); b = q; }
      if (b) { b.tumbled = true; S.fx.push({ k: 'tumble', x: birdX(b, flightTime(r)), y: b.y, vx: r.vx * 0.3, vy: -80, g: -500, t: J.tumbleTime, max: J.tumbleTime, rot: 0, spin: 9, size: 0 }); }
      if (S.teachBird) { S.teachBird = false; E.save.set('birdTaught', true); S.callouts.push({ text: 'Bird bounce: up and onward!', arrow: true, wx: cx, wy: cy, t: J.callout }); }
    } else if (e.k === 'boost') { // the fizz kick: a burst ring of fizz and a whoosh
      SFX.boost(E); E.haptic(J.haptic.boost); S.gaugePop = J.gaugePop; S.whooshT = J.whoosh;
      emit('fizz', cx, cy, J.fizz, { angle: Math.atan2(-r.vy, -r.vx), spread: 2.2, speed: 200, g: 0, life: J.fizzLife, size: 4, color: P.fizz });
      emit('cola', cx, cy, 5, { angle: Math.atan2(-r.vy, -r.vx), spread: 1, speed: 160, g: 0, life: J.fizzLife, size: 3, color: P.soda });
    } else if (e.k === 'chute') { SFX.chute(E); E.haptic(J.haptic.chute); emit('puff', cx, cy + 30, 6, { speed: 60, g: 0, life: 0.4, size: 3, color: P.powder }); }
    else if (e.k === 'drop') { SFX.drop(E); E.haptic(J.haptic.drop); this.squash(0.2); emit('puff', cx, cy, 6, { angle: Math.PI / 2, spread: 1.2, speed: 120, g: 0, life: 0.35, size: 2.6, color: P.critterLight }); }
    else if (e.k === 'ramp') this.squash(0.1);
    else if (e.k === 'mud') {
      E.audio.play('miss'); E.haptic(J.haptic.mud); E.shake(J.mudShake, J.mudShakeTime);
      emit('splat', cx, 0, J.splat, { angle: Math.PI / 2, spread: Math.PI * 0.8, speed: 150, g: -400, life: 0.6, size: 3, color: P.mud });
      if (S.teachMud) { S.teachMud = false; E.save.set('mudTaught', true); S.endWait = T.endDelayTaught; S.callouts.push({ text: 'Stuck! Sail or boost over caramel', arrow: false, wx: cx, wy: cy + 50, t: T.endDelayTaught + 0.2 }); }
    } else if (e.k === 'geyser') {
      SFX.geyser(E); E.haptic(J.haptic.geyser); this.squash(0.15); S.speedT = J.speedLines;
      emit('fizz', cx, 0, 14, { angle: Math.PI / 2, spread: 0.6, speed: 260, g: -300, life: 0.7, size: 3, color: P.fizz });
      word('Fizz!', r.x - 40, 90, TY.md, J.boingLife);
      word(`↑ ${Math.round((r.vy * r.vy) / (2 * T.gravity) / T.unitsPerMetre)} m`, r.x - 40, 50, TY.sm, J.boingLife);
    } else if (e.k === 'cloud') {
      SFX.cloud(E); E.haptic(J.haptic.cloud); S.gaugePop = J.gaugePop;
      emit('puff', e.x, e.y, 12, { speed: 90, g: 0, life: 0.6, size: 4, color: P.cloud });
      word('+1 fizz', e.x, e.y + T.cloudRY + 30, TY.sm, J.boingLife);
    } else if (e.k === 'milestone') {
      const i = T.milestones.indexOf(e.m) + 1, home = i === PLACES.length - 1;
      E.audio.play('win'); E.haptic(J.haptic.milestone); S.distPop = 0.3;
      S.banner = { text: `★ ${PLACES[i].name}`, t: J.bannerTime };
      if (home && !E.save.get('home', false)) { // the Home moment: once, the first flight past 5000 m
        E.save.set('home', true); E.ledger.add('home', { flights: E.save.get('flights', 0) + 1, seed: r.seed });
        S.homeT = J.homeTime; SFX.home(E); E.haptic(J.haptic.home);
        S.banner = { text: '♥ Home! (keep going)', t: J.homeTime, color: P.text };
        const hx = placeFrom(i) + T.homeAhead;
        emit('heart', hx, 2.6 * T.critterR, J.hearts, { angle: Math.PI / 2, spread: 1.6, speed: 160, g: -60, life: 1.6, size: 4, color: P.heart });
        emit('heart', r.x, r.y + T.critterR, J.hearts / 2, { angle: Math.PI / 2, spread: 2, speed: 120, g: -60, life: 1.4, size: 3.5, color: P.heart });
      }
    } else if (e.k === 'stop') {
      this.squash(0.18);
      if (!r.stars.length) E.audio.play('lose', 0.3);
    }
    if ((e.k === 'spring' || e.k === 'bird' || e.k === 'geyser') && e.chain >= 1) {
      S.chainT = J.chainLife;
      if (e.chain >= 2) SFX.chain(E, e.chain);
      emit('coin', cx, cy, J.coins[Math.min(e.chain, J.coins.length - 1)], { angle: Math.PI / 2, spread: 1.2, speed: 200, g: -500, life: 0.7, size: 3.2, color: P.coin });
    }
  },
  onPointerDown(p, E) {
    const r = S.run;
    if (!r) {
      if (S.phase === 'aim' && this.sinceReady() >= T.readyGrace) { S.launchPid = p.id; this.lock(E); }
      else if (S.phase === 'gauge' && this.sinceLock() >= T.gaugeGrace) { S.launchPid = p.id; this.fire(E); }
      return;
    }
    if (r.ended || p.id === S.launchPid) return;
    if (S.gest) this.release(S.gest, this.stamp(r), true); // a second thumb takes over
    S.gest = { id: p.id, t0: this.stamp(r), y0: p.y, kind: null };
  },
  onPointerMove(p, E) {
    const g = S.gest, r = S.run;
    if (!g || g.id !== p.id || g.kind || !r || r.ended) return;
    const dy = p.y - g.y0, at = this.stamp(r);
    if (Math.abs(dy) < T.swipeMin || at - g.t0 > T.gestureWindow) return;
    g.kind = dy < 0 ? 'chute' : 'drop';
    queueInput(r, at, dy < 0 ? 'chuteOn' : 'condense');
  },
  onPointerUp(p, E) {
    if (p.id === S.launchPid) { S.launchPid = null; return; }
    const g = S.gest, r = S.run;
    if (!g || g.id !== p.id) return;
    S.gest = null;
    if (r && !r.ended) this.release(g, this.stamp(r), p.cancelled);
  },
  // A press ends: a quick tap is a short burst; a held boost or an open parachute stops.
  release(g, at, cancelled) {
    const r = S.run;
    if (!g.kind) { if (!cancelled) queueInput(r, at, 'burst'); }
    else if (g.kind === 'boost') queueInput(r, at, 'boostOff');
    else if (g.kind === 'chute') queueInput(r, at, 'chuteOff');
  },
  onKey(k, E) { // desktop: Space takes each beat, then boosts while held; Up holds the parachute; Down condenses
    const r = S.run;
    if (!r) { if (k === ' ' || k === 'Enter') this.onPointerDown({ id: 'key' }, E); return; }
    if (r.ended) return;
    if (k === ' ' && !S.keyDown[' ']) { S.keyDown[' '] = true; queueInput(r, this.stamp(r), 'boostOn'); }
    else if (k === 'ArrowUp' && !S.keyDown.ArrowUp) { S.keyDown.ArrowUp = true; queueInput(r, this.stamp(r), 'chuteOn'); }
    else if (k === 'ArrowDown') queueInput(r, this.stamp(r), 'condense');
  },
  render(ctx, E) {
    const v = view(E), r = S.run, sf = E.safe, gy = v.oy + T.groundY * v.s;
    let pre;
    if (!r) {
      const aim = S.phase === 'aim' ? aimAngle(this.sinceReady()) : S.aim, gv = S.phase === 'gauge' ? gaugeAt(this.sinceLock(), S.gauge) : null;
      pre = { aim, gauge: gv ?? 0, half: S.gauge.half, lit: gv === null ? -1 : zoneOf(gv, S.gauge), glow: 0, pump: 0 };
    } else pre = { gauge: S.gv, half: S.gauge.half, lit: S.glowT > 0 ? S.lit : -1, glow: clamp(S.glowT / J.zonePop, 0, 1), pump: clamp(S.pumpT / J.pump, 0, 1), arc: S.arc };
    const info = drawWorld(ctx, E, v, S.cam, r, pre);
    drawHud(E, r, r ? r.fuel : S.st.fuelMax, r ? r.fuelCap : S.st.fuelMax, r ? info : null);
    const mcx = info.mx - 44 * info.mk, mtop = info.gy - 92 * info.mk;
    if (mcx > E.safe.left + 40 && (S.streakNow > 0 || S.streakT > 0)) { // the streak counter over the machine
      const lost = S.streakNow === 0, k = S.streakT > 0 ? 1 + 0.3 * Math.max(0, S.streakT / J.zonePop - 0.6) * 2.5 : 1;
      E.ctx.globalAlpha = lost ? clamp(S.streakT / 0.3, 0, 1) : 1;
      pill(E, lost ? 'Streak lost' : `Streak x${S.streakNow}`, mcx, mtop, Math.round(TY.sm * k), 'center', lost ? P.textDim : P.zones[0]);
      E.ctx.globalAlpha = 1;
    }
    if (!r && S.hint) { // under the machine, pulsing, on a fresh save's first two flights
      E.ctx.globalAlpha = 0.75 + 0.25 * Math.sin(E.time * 5);
      pill(E, S.phase === 'aim' ? 'Tap to lock the barrel' : 'Tap when the needle is in the gold', info.mx - 20 * info.mk, Math.min(gy + 30 * v.s, E.h - sf.bottom - 20), TY.md, 'center', S.phase === 'aim' ? P.text : P.zones[0]);
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
        c.sx = dx * v.s + 48; c.sy = clamp(v.oy + dy * v.s, sf.top + 110, gy - 30);
      }
      const age = (c.max ??= c.t) - c.t, y = c.sy - Math.min(age, 1) * 10;
      E.ctx.globalAlpha = clamp(c.t / 0.3, 0, 1) * clamp(age / 0.15, 0, 1);
      const b = pill(E, c.arrow ? `      ${c.text}` : c.text, c.sx, y, TY.md, c.arrow ? 'left' : 'center', P.text);
      if (c.arrow) drawUpArrow(E.ctx, b.x + 24, b.y + b.h - 5 - 2 * Math.sin(E.time * 6), 1);
      E.ctx.globalAlpha = 1;
    }
  },
  onPause(E) { // backgrounding mid-flight ends it: logged once as a quit; back to the menu
    const r = S.run;
    if (!r || S.quit) return;
    S.quit = true;
    if (!r.ended) E.ledger.add('quit', { m: metres(r), t: +flightTime(r).toFixed(1), seed: r.seed });
    else finishFlight(E, r);
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
    E.text(p.why === 'mud' ? 'Stuck in caramel' : 'Flight over', cx, py + 26, { size: TY.sm, color: P.textDim, weight: '600' });
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
  saveVersion: 7,
  // v1 was the skeleton demo (Tap Rush): its score-based best and runs mean nothing here. v2 is { best, coins, ms, flights }.
  // v3 adds `up`, the bought upgrade levels, all 0 for an older save (coins carry over to spend). v4 adds `holdTaught`.
  // v5 (PRD v0.2 B): coins become sugar one for one; `up.steady` at 0; goals start at the top of the list with every distance
  // goal the best already meets done silently (paying nothing); `perfectRow` 0; the bird and mud call-outs not yet shown.
  // v6 (PRD v0.2 E) adds `home`, false. v7 (PRD v0.3 F6): the machine replaces the chopsticks; owned levels are kept (Steady
  // Chopsticks becomes Steady Gauge, the Cola Rocket's levels now strengthen the boost every flight has), `up.scope` (the
  // Brass Telescope) 0, `actionsTaught` false so the three actions are shown once; `holdTaught` is gone; `perfectRow` is the
  // machine's streak.
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
    if (fromVersion < 6) data.home = false;
    if (fromVersion < 7) { data.up = { ...data.up, scope: 0 }; data.actionsTaught = false; delete data.holdTaught; }
    return data;
  },
  TUNING,
  // The TUNE panel (PRD v0.3 G): four strengths, and two whole feels. Floaty: light gravity, a soft launch, long sails, gentle
  // boosts, springy ground. Punchy: heavy gravity, a hard launch, short sails, hard drops and a strong boost.
  experiments: [
    { key: 'groundBounce', label: 'Bounce', min: 0.3, max: 0.85, step: 0.01 },
    { key: 'chuteFall', label: 'Parachute fall speed', min: 30, max: 200, step: 5 },
    { key: 'condenseLift', label: 'Condense bounce', min: 0.6, max: 1.4, step: 0.02 },
    { key: 'boostThrust', label: 'Boost thrust', min: 300, max: 1500, step: 10 },
  ],
  presets: [
    { label: 'Floaty', values: { gravity: 340, launchSpeedMax: 640, airDrag: 0.012, groundBounce: 0.72, skimLift: 0.14, chuteFall: 45, chuteBleed: 0.35, condenseLift: 0.9, condenseDrop: 480, boostThrust: 600 } },
    { label: 'Punchy', values: { gravity: 580, launchSpeedMax: 940, airDrag: 0.015, groundBounce: 0.63, skimLift: 0.12, chuteFall: 130, chuteBleed: 0.7, condenseLift: 1.15, condenseDrop: 820, boostThrust: 1050 } },
  ],
  // Read by tools/sim-launch.mjs so the harness runs the real physics (S, the play scene's state, lets a browser check set up the HUD).
  sim: { STEP, FIELD, makeField, ensureField, groundAt, surfaceH, birdX, stats, newRun, stepRun, advance, airStep, queueInput, metres, coinsOf, flightTime,
    aimAngle, gaugeOf, gaugeAt, zoneOf, powerOf, launchOf, mouth, ZONES, GOALS, activeGoals, goalStats, settleGoals, rangeArc,
    UPGRADES, effectText, S, predictLanding, newCamera, cameraStep, toView, PLACES, placeFrom, placeIndex, geyserOn, inCloud, palette: P },
  start: 'menu',
  scenes: { menu: landscapeOnly(menu), play: landscapeOnly(play), over: landscapeOnly(over), shop: landscapeOnly(shop) },
};
