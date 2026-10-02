// game.js - Checkpoint v0.2: the X-ray belt on the left, the walk-through scanner lane on the right.
//
// Coordinates: play is laid out in design units, 360 wide, scaled to the screen by layout(). The belt takes the left 60 percent; each bag
// shares a colour tag with a traveller who queues at the top of the lane, stands in the scanner arch while the body scan shows, walks down
// and waits at the bottom for the bag. Only a traveller carrying metal sets off the arch (a two-tone beep and an amber flash of the arch light)
// and only then does the body scan show; everyone else walks through on a soft green light (PRD v0.2 J). Randomness only builds the shift
// (genShiftSteps, seeded); every tap resolves the same way (ADR-0008).
// The shift clock runs in fixed steps (TUNING.simStep): the belt, the walkers, the rush lever, the SWAT slow-motion and the false-alarm lock
// all live on that clock, so the same seed and tap times give the same shift at any frame rate.

import { makeRng, clamp, ease } from './engine.js';

const TUNING = {
  get bg() { return S && S.live ? this.palette.screen : this.palette.bg; },   // the engine clears to this: in play, the belt's screen colour, so the belt costs no fill

  bagsPerShift: 20,                       // and as many travellers, one per bag
  strikesMax: 3,
  beltSpeed: [70, 75, 78, 76, 76, 74, 76, 80, 80, 70],                // units/s per day (v0.1: 70 to 105); lowered from day 3 for the lane's share of attention
  itemsPerBag: [[4, 5], [4, 6], [5, 6], [5, 7], [6, 8], [6, 7], [6, 8], [7, 8], [7, 8], [7, 8]],
  cleanShare: 0.5,
  hitMargin: 14,                          // design units round an item's outline (PRD v0.2 H6: the margin may grow)
  bodyHit: 21,                            // ... round a body item on the scan (the zipper is thin)
  bodyScale: 1.5,                         // body items are drawn larger than life on the scan so they read at a glance
  figureHit: 12,                          // ... round a walking traveller
  bagGap: 64,

  // PRD v0.2 C: the severity ladder. Index is the tier: 1 minor, 2 serious, 3 critical.
  tierName: ['', 'Minor', 'Serious', 'Critical'],
  tierBase: [0, 100, 200, 400],           // catch points before the early factor, streak and lever
  missStrikes: [0, 1, 2, 99],             // a missed critical item ends the shift at once
  cleanBase: 20,                          // a clean bag left alone
  cleanTraveller: 10,                     // a beeper with only harmless metal, left alone (a traveller who did not beep pays nothing)
  earlyMax: 3, earlyMin: 0.5,             // a bag catch: x3 entering at the top, x0.5 at the bottom; a body catch: x3 during the scan, x0.5 leaving
  streakSteps: [4, 8, 12, 16],            // x2 to x5 (bags and travellers both count)
  falseLock: 0.6,                         // the time penalty of a false alarm: taps are ignored this long while the traveller grumbles
  swat: { bonus: 800, capShare: 0.33, min: 300, slow: 0.25, slowT: 1.3, len: 3.4, drop: 0.35, tackle: 0.6, drag: 2.5, zoom: 1.4 },   // bonus x early factor, the day's SWAT bonuses together capped at capShare of goodDay (a call always pays at least min); the belt and lane at `slow` for slowT s
  goodDay: [25500, 20500, 16500, 24500, 21000, 21000, 37000, 37000, 29000, 37500],   // a good day's score per day: the fast reader at normal speed, mean of 12 seeds (tools/sim-checkpoint.mjs prints it against the live value); the day's SWAT bonuses together are capped at capShare of it

  // PRD v0.2 E and G: the rush lever and the TUNE knobs. Every shift is clearable and three-starrable with the lever up.
  scanShow: 1.4,                          // s the body scan shows (only for a traveller who beeped), never shortened by the lever
  // PRD v0.2 J: the detector decides whom to check. Only a traveller carrying metal beeps; most beepers carry harmless metal.
  beepShare: [0.33, 0.35, 0.38, 0.4, 0.42, 0.45, 0.47, 0.5, 0.52, 0.55],   // share of a day's travellers who set off the arch (exact count per day, the cast included)
  beepCast: { grandma: true, businessman: true, tourist: true },           // recurring characters who always carry harmless metal; Vic beeps only when his contraband is on his body
  beep: { hz: 6, fade: 0.35 },                                              // arch light: amber flashes per second while the scan shows; fade of either light after the traveller steps out
  rushSpeed: 1.6,                         // belt and lane speed with the lever down ...
  rushMult: 1.5,                          // ... and the score multiplier on everything earned meanwhile
  tune: { belt: 1, pace: 1, occlusion: 0.6 },   // belt speed and traveller pace multipliers; occlusion 0 = v0.1 spacing, 1 = heaviest packing

  // The shift table (rows are days 1 to 10; each opens when the one before is cleared)
  //   day  teaches / needs                                                     intended solution (naked run)
  //   1    the gun ends the day if missed; people carry metal; Vic's leg knife  read the scan once, then the bag; tap the shapes
  //   2    clean bags and clean people are left alone; hammer, lighter          one glance per scan, one pass per bag
  //   3    items overlap, dense things hide what is under them                  read the readable part: a point, a hood, a trigger guard
  //   4    look-alikes; the blade in the boot                                   judge shape and colour together; two catches per bag pay
  //   5    rush hour: bags in bursts, denser bags, the belt taser               glance at the arch between bursts
  //   6    all bag shapes; brass knuckles                                       catch early, pull the lever only when the belt is easy
  //   7    the gun under the arm: one look at the scan is not optional          watch the armpits; SWAT pays the most
  //   8    explosives; Vic hides a multi-tool under a tablet                     dense corners first
  //   9    near-full clutter                                                    one pass per bag, one glance per scan
  //   10   rush hour again: everything at once                                  all of the above
  brief: [
    'Beep means look. A missed gun ends the day.', 'Green light: leave them be. Clean bags too.', 'Dense things hide what is under them.', 'Look-alikes are harmless. Read the shape.',
    'Bags arrive in bursts.', 'All bag shapes. Catch early for points.', 'Watch under the arms.', 'Explosives on the belt now.', 'Read each bag in one pass.', 'Everything at once.',
  ],
  ranks: [[1, 'Rookie'], [4, 'Officer'], [7, 'Lead officer'], [10, 'Senior officer']],   // first day of each rank
  starRule: '3 stars: no strikes. 2: one. 1: clear.',
  tips: ['', '', '', '', '', '', '', '', 'One glance per scan.', 'Pull the lever only when it is easy.'],
  rush: [5, 10],                                                        // rush hour days: bags arrive in bursts
  burst: { size: 3, gapIn: 12 },
  rotMax: [20, 30, 45, 60, 90, 90, 120, 150, 180, 180],
  maxContraband: [1, 1, 1, 2, 2, 2, 2, 2, 2, 2],
  twoShare: [0, 0, 0, 0.2, 0.3, 0.25, 0.3, 0.35, 0.3, 0.3],
  overlapBias: [0, 0, 0.35, 0.4, 0.6, 0.45, 0.5, 0.55, 0.55, 0.7],     // scaled by the occlusion knob (x1 at its default)
  confusableShare: [0, 0, 0, 0.25, 0.45, 0.2, 0.3, 0.5, 0.15, 0.4],
  newContraband: [['knife', 'scissors', 'gun'], ['hammer', 'lighter'], ['large liquid', 'batteries'], ['fireworks', 'toy gun'], ['taser', 'snow globe'], ['box cutter', 'brass knuckles'], ['multi-tool'], ['explosives'], [], []],
  newBody: [['leg knife'], ['pocket lighter'], [], ['boot blade'], ['belt taser'], ['knuckles'], ['arm gun'], [], [], []],
  bodyShare: [0, 0.25, 0.25, 0.28, 0.28, 0.3, 0.3, 0.3, 0.3, 0.3],     // share of ordinary beepers carrying body contraband (the rest carry harmless metal)
  bodyGunShare: 0.25,                                                   // of those, how many carry the gun once it is in the pool
  bodyNormal: [[1, 2], [1, 2], [1, 3], [1, 3], [2, 3], [2, 3], [2, 3], [2, 3], [2, 4], [2, 4]],   // normal body items per beeper (the first is always metal)
  opener: { shift: 1, contraband: ['scissors'], harmless: ['shirt', 'phone', 'headphones'] },
  // Recurring characters (PRD v0.2 F). Behaviour is flavour, never the tell; only the scans are. Days each one appears:
  cast: { grandma: [1, 3, 5, 7, 9, 10], businessman: [1, 2, 4, 6, 8, 10], tourist: [2, 4, 5, 7, 9], smuggler: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  // Vic the smuggler comes back every day with a cleverer hiding place: in the bag (under another item) or on the body.
  smuggler: [
    { body: ['leg knife'] }, { body: ['pocket lighter'] }, { bag: ['knife'], under: 'laptop' }, { body: ['boot blade'] }, { body: ['belt taser'] },
    { body: ['knuckles'] }, { body: ['arm gun'] }, { bag: ['multi-tool'], under: 'tablet' }, { body: ['leg knife', 'boot blade'] }, { bag: ['explosives'], under: 'power bank' },
  ],
  touristGlobeFrom: 5,                    // from this day the tourist's souvenir is a snow globe (a minor item)

  // Packing
  overlapFrom: 3,
  packGap: 6,
  minVisible: 0.6,                        // area and outline share every item keeps with the occlusion knob at 0 ...
  occMinVisible: { harmless: 0.3, contraband: 0.45 },   // ... and at 1 (harmless items may nearly vanish; contraband keeps its tell)
  tellVis: 0.85,                          // fairness: share of a contraband item's distinctive part not under any other item's metal or dense part
  visSlack: 0.04, visStep: 3, edgeStep: 3, visFinalStep: 1.5, visFinalSlack: 0.01,
  packTries: 40, bagTries: 60,
  tintFrom: 3,
  organicContraband: [1, 1, 4, 3, 3, 3, 3, 3, 3, 3],
  organicHarmless: 0.45,
  criticalWeight: 0.3,                    // pick weight of a critical item (gun, explosives) in a bag, so SWAT stays an event
  tangleOpposite: 0.9,                    // an overlapping item is dropped on one of another material this often
  confusableNear: 0.5,
  runMax: 4,
  itemScale: 0.85,                        // item outlines are drawn at this size in the narrower bag

  // Layout (design units unless px)
  designW: 360,
  designMinH: 560,
  beltW: 216,                             // the belt is the left 60 percent
  bagX: 10, bagW: 196, bagH: 260, bagPad: 8,
  firstBagGap: 8,
  hudH: 56,                               // px below the top safe inset
  hoodH: 34,                              // px of scanner hood over the belt
  lane: { queueY: 64, boothTop: 76, boothH: 250, boothX: 224, boothW: 128, centre: 288, queueStep: 30, spots: [236, 266, 296], spotLift: 14, figW: 24, figH: 56 },
  lever: { x: 310, w: 46, h: 124, lift: 14 },
  travel: { walk: 120, release: 0.25, firstAt: 1.2, scanFade: 0.35, leave: 0.8, passK: 1.6, archExit: 24 },   // walk units/s; a traveller starts walking when their bag is `release` out of the hood, and never before firstAt s; one who did not beep strides through the arch at passK x; a missed body critical ends the day archExit units past the arch

  simStep: 1 / 120,

  // Art. The belt is the scanner screen: real X-ray colours by material on a pale screen, overlaps multiply, dense things go black.
  palette: {
    bg: '#070f24', screen: '#eef1ee', roller: '#c9d3dc', floor: '#0b1530', tile: '#13213f', booth: '#45566f', boothHi: '#8fa3bf', boothDark: '#050b1a',
    hood: '#0a1428', hoodLip: '#1b3a6b', strip: '#050b1a', bagEdge: '#2a5a9a',
    metal: '#4aa8ff', organic: '#ff9a1f', catch: '#e8202e', falseAlarm: '#ffd21a', falseEdge: '#4a3600', clean: '#1fb35f',
    text: '#dbe7ff', dim: '#7f95b8', star: '#ffd11a', ink: '#15171c', paper: '#efe9dc', paperDim: '#5d564a', pill: 'rgba(7,15,36,0.86)',
    panel: '#12274d', panelOff: '#0a1226', panelOffEdge: '#1a2540', textOff: '#4a5d80',
    rushOff: '#b0701f', button: '#1d4ed8', buttonQuiet: '#334155', buttonMute: '#1f2937', badge: '#0f1c38', badgeHot: '#3a2a08', strikeOn: '#3a0c12',
    lever: '#ff8a1f', leverOff: '#24324f', lampOff: '#1b2b4a', lampAmber: '#ffb020', lampGreen: '#3fcf8a', swatRed: '#ff2840', swatBlue: '#2f6bff', officer: '#151a24', vest: '#2b3446',
    tags: ['#b45cff', '#19c3d6', '#ff6fb5', '#ff9a3c', '#5b7cff', '#f2f2f2'],
  },
  // X-ray materials (PRD v0.2 D): orange organic, green plastic, blue metal, black dense. Fills multiply, so overlaps darken.
  mats: {
    organic: { fill: '#f6a54e', edge: '#b9620f' },
    plastic: { fill: '#91d277', edge: '#3c8a2c' },
    metal: { fill: '#5a8ff0', edge: '#1c49ad' },
    dense: { fill: '#2a2e3d', edge: '#05060a' },
    skin: { fill: '#f7e0c8', edge: '#d6a277' },
    fabric: { edge: '#e3c39c' },
  },
  people: {
    coat: ['#4a6fa5', '#8a5a44', '#5b7f4f', '#7a4e8c', '#9c7a3c', '#3f6f73', '#6b6b7a', '#2f5d8a'],
    skin: ['#f1c7a3', '#d9a47a', '#a8714a', '#7a4a2e', '#e8b896'],
    hair: ['#2b1d14', '#5a3a22', '#b07a3a', '#d9c27a', '#1a1a1a', '#8a8a8a'],
    flavour: 0.22,                        // chance of each of sweating, glancing, sunglasses: never linked to what they carry
  },
  characters: {
    grandma: { name: 'Grandma Rose', coat: '#8a5ca8', hair: '#e2e2e2', skin: '#f1c7a3', bun: true, specs: true },
    businessman: { name: 'Mr. Pike', coat: '#262b36', hair: '#2b1d14', skin: '#e8b896', tie: '#4d8bd6', sweat: true, glance: true },
    smuggler: { name: 'Vic', coat: '#7a6440', hair: '#1a1a1a', skin: '#d9a47a', cap: '#15171c', shades: true, glance: true },
    tourist: { name: 'Tourist Tom', coat: '#e0902a', hair: '#b07a3a', skin: '#f1c7a3', hat: '#efe0a8', dots: true },
  },
  sprite: { ahead: 320, perFrame: 1, items: 3, maxDpr: 3 },   // bag sprites are painted ahead of the hood, `items` items a frame
  prepMs: 4,
  type: { small: 14, medium: 20, large: 36, weight: '700' },
  line: { edge: 1.6, ring: 3, flag: 3 },

  juice: {
    ripple: 0.3, rippleR: 26, rippleMax: 6,
    ringSnap: 0.2, ringFrom: 38,
    particleCap: 160, particleLife: 0.45, particleSize: 4, burstSpeed: 240,
    burst: { catch: 14, big: 26, tint: 8, falseAlarm: 8, miss: 8 },
    earlyLabel: 0.35,
    bigCatch: 900,
    shake: { big: [3, 0.14], falseAlarm: [4, 0.2], miss: [5, 0.25], over: [7, 0.35], swat: [9, 0.4], breach: [10, 0.6] },
    pop: 0.3, popSize: 0.35, badgePop: 0.4, badgeSize: 0.5,
    tray: 0.55, trayDist: 300, trayTilt: 0.12,
    bagFlash: 0.4, screenFlash: 0.08, flashLife: 0.5, fxLife: 0.9, ghostLife: 1.2, cueLift: 14, banner: 1.4, press: 0.96,
    stampFrom: 2.6, stampT: 0.32, endDelay: 1.7, breachDelay: 2.2, bagStamp: 0.25, grumble: 1.3,
    cardButtons: 0.7, cardStars: 0.25, cardCount: 0.8,
    haptic: { catch: 10, beep: 15, falseAlarm: [25, 45, 25], miss: 80, clear: 20, swat: [40, 30, 90], breach: [120, 60, 120, 60, 200] },
    hum: { every: 0.2, base: 58, step: 8, maxStreak: 20, gain: 0.05, rush: 1.7, lever: 1.45, leverGain: 1.6 },
    tones: {
      pass: [{ freq: 784, dur: 0.1, type: 'sine', gain: 0.06 }, { freq: 1047, dur: 0.16, type: 'sine', gain: 0.06, delay: 0.08 }],
      falseAlarm: [{ freq: 660, dur: 0.09, type: 'square', gain: 0.09 }, { freq: 660, dur: 0.09, type: 'square', gain: 0.09, delay: 0.14 }],
      miss: { freq: 330, dur: 0.32, type: 'sawtooth', slide: 0.85, gain: 0.16 },
      step: { freq: 520, dur: 0.14, type: 'triangle', gain: 0.1, up: 1.19 },
      rush: { freq: 1400, dur: 0.2, type: 'sine', gain: 0.06, slide: 1.3 },
      beep: [{ freq: 1046, dur: 0.14, type: 'square', gain: 0.07 }, { freq: 784, dur: 0.2, type: 'square', gain: 0.07, delay: 0.16 }],   // falling two-tone: the metal detector
      lever: { freq: 240, dur: 0.18, type: 'square', gain: 0.07, slide: 1.8 },
      leverOff: { freq: 300, dur: 0.16, type: 'square', gain: 0.06, slide: 0.55 },
      siren: { lo: 640, hi: 920, n: 6, every: 0.24, dur: 0.22, type: 'square', gain: 0.07 },
      klaxon: { lo: 300, hi: 220, n: 5, every: 0.36, dur: 0.32, type: 'sawtooth', gain: 0.14 },
      stamp: { freq: 140, dur: 0.08, type: 'square', gain: 0.07 },
    },
  },
};

const T = TUNING;
const DEG = Math.PI / 180;

// ---------- shape helpers ----------
const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const ell = (cx, cy, rx, ry, n = 12) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
const bar = (x1, y1, x2, y2, w) => { const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy), nx = (-dy / d) * w / 2, ny = (dx / d) * w / 2; return [[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]]; };
const taper = (x1, y1, x2, y2, w1, w2) => { const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy), nx = -dy / d, ny = dx / d; return [[x1 + nx * w1 / 2, y1 + ny * w1 / 2], [x2 + nx * w2 / 2, y2 + ny * w2 / 2], [x2 - nx * w2 / 2, y2 - ny * w2 / 2], [x1 - nx * w1 / 2, y1 - ny * w1 / 2]]; };
const arc = (cx, cy, r, a0, a1, n = 10) => Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + ((a1 - a0) * i) / n) * DEG; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
const band = (cx, cy, r, w, a0, a1, n = 10) => [...arc(cx, cy, r, a0, a1, n), ...arc(cx, cy, r - w, a1, a0, n)];
const ring = (cx, cy, r, w) => band(cx, cy, r, w, 0, 359.9, 14);
const rrect = (x, y, w, h, r) => [...arc(x + w - r, y + r, r, -90, 0, 3), ...arc(x + w - r, y + h - r, r, 0, 90, 3), ...arc(x + r, y + h - r, r, 90, 180, 3), ...arc(x + r, y + r, r, 180, 270, 3)];
const gear = (cx, cy, ro, ri, n) => Array.from({ length: n * 2 }, (_, i) => { const a = (i / (n * 2)) * Math.PI * 2, r = i % 2 ? ri : ro; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
const crimp = (x0, x1, y, dy, n) => Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y + (i % 2 ? dy : 0)]);

// ---------- the item table (PRD v0.1 9, v0.2 D) ----------
// parts: [material, polygon]; tell: indices of the parts that make the item's distinctive, always-readable piece (contraband only);
// lines: cosmetic detail strokes [material, [x0, y0, x1, y1, ...]]. tier: 0 harmless, 1 minor, 2 serious, 3 critical.
// confusable: the contraband item this harmless one can be mistaken for (they share a material).
const O = 'organic', PL = 'plastic', M = 'metal', D = 'dense';
const ITEM_DATA = [
  // contraband
  { name: 'knife', tier: 2, parts: [[O, rrect(-38, -6, 26, 12, 4)], [M, rect(-13, -11, 5, 22)], [M, [[-8, -8], [20, -8], [40, 4], [-8, 4]]]], tell: [2, 1], lines: [[D, [-32, 0, -31, 0]], [D, [-20, 0, -19, 0]]] },
  { name: 'scissors', tier: 1, parts: [[PL, ring(-30, -12, 10, 4)], [PL, ring(-30, 12, 10, 4)], [M, taper(-22, -7, 40, 13, 8, 2)], [M, taper(-22, 7, 40, -13, 8, 2)], [D, ell(0, 0, 3.5, 3.5, 8)]], tell: [2, 3, 4] },
  { name: 'gun', tier: 3, parts: [[D, rect(-34, -16, 64, 13)], [M, rect(30, -14, 6, 9)], [D, rect(-30, -3, 40, 7)], [D, [[-30, -3], [-12, -3], [-6, 26], [-24, 26]]], [M, band(2, 4, 9, 3, 0, 180)], [M, rect(0, 3, 3, 8)]], tell: [0, 1, 4] },
  // the lighter: a body with its fuel showing, a metal shield-shaped hood with its jet, and a big toothed flint wheel standing proud on top (a cog on a stick, never a bottle)
  { name: 'lighter', tier: 1, parts: [[PL, rrect(-13, -2, 26, 38, 5)], [O, rect(-10, 17, 20, 15)], [M, [[-13, -2], [13, -2], [13, -14], [8, -19], [-13, -19]]], [M, gear(6, -26, 12.5, 10.5, 14)], [M, rect(-11, -33, 5, 15)], [D, ell(6, -26, 3, 3, 8)]], tell: [2, 3], lines: [[M, [-7, -15, -7, -8]], [M, [-1, -15, -1, -8]]] },
  { name: 'large liquid', tier: 1, parts: [[O, rect(-20, -16, 40, 50)], [O, [[-20, -16], [-8, -24], [8, -24], [20, -16]]], [O, rect(-7, -32, 14, 8)], [PL, rect(-9, -40, 18, 8)]], tell: [0, 1, 2], lines: [[O, [-20, -4, 20, -4]]] },
  { name: 'batteries', tier: 1, parts: [[M, rect(-24, -16, 14, 40)], [D, rect(-20, -20, 6, 4)], [M, rect(-7, -22, 14, 40)], [D, rect(-3, -26, 6, 4)], [M, rect(10, -16, 14, 40)], [D, rect(14, -20, 6, 4)]], tell: [0, 2, 4] },
  { name: 'fireworks', tier: 2, parts: [[O, rect(-8, -24, 16, 36)], [O, [[-8, -24], [0, -40], [8, -24]]], [PL, [[-8, 4], [-15, 15], [-8, 12]]], [PL, [[8, 4], [15, 15], [8, 12]]], [O, rect(-1.5, 12, 3, 30)]], tell: [0, 1], lines: [[O, [-8, -10, 8, -10]], [O, [-8, 0, 8, 0]]] },
  { name: 'taser', tier: 2, parts: [[PL, rect(-24, -11, 38, 22)], [PL, [[-20, 11], [-6, 11], [-10, 32], [-24, 32]]], [D, rect(-19, -6, 16, 12)], [M, rect(14, -9, 10, 18)], [M, rect(24, -9, 18, 4)], [M, rect(24, 5, 18, 4)]], tell: [3, 4, 5] },
  { name: 'hammer', tier: 2, parts: [[O, rect(-6, -4, 46, 8)], [M, rect(-24, -13, 22, 26)], [M, [[-24, -13], [-42, -9], [-42, -3], [-24, 3]]]], tell: [1, 2] },
  { name: 'box cutter', tier: 2, parts: [[PL, rect(-32, -9, 52, 18)], [M, [[-8, -9], [-4, -13], [6, -13], [10, -9]]], [M, [[20, -6], [36, -6], [46, 5], [20, 5]]]], tell: [2], lines: [[PL, [-28, 0, 16, 0]]] },
  { name: 'explosives', tier: 3, parts: [[O, rect(-21, -18, 13, 36)], [O, rect(-7, -18, 13, 36)], [O, rect(7, -18, 13, 36)], [PL, rect(-23, -4, 45, 7)], [D, rect(24, -9, 13, 18)], [M, bar(24, -5, 10, -14, 2.5)], [M, bar(24, 4, 14, 14, 2.5)]], tell: [4, 5, 6] },
  { name: 'brass knuckles', tier: 2, parts: [[M, ring(-21, -9, 7.5, 3)], [M, ring(-7, -9, 7.5, 3)], [M, ring(7, -9, 7.5, 3)], [M, ring(21, -9, 7.5, 3)], [M, rrect(-28, -2, 56, 13, 6)]], tell: [0, 1, 2, 3] },
  { name: 'toy gun', tier: 1, parts: [[PL, rect(-32, -14, 58, 16)], [PL, [[-26, 2], [-10, 2], [-6, 24], [-22, 24]]], [O, rect(26, -13, 8, 14)], [PL, band(0, 4, 8, 3, 0, 180)]], tell: [0, 2] },
  { name: 'snow globe', tier: 1, parts: [[O, ell(0, -8, 20, 20, 16)], [PL, rrect(-18, 10, 36, 13, 3)]], tell: [0], lines: [[O, [-4, -2, 0, -12, 4, -2]], [O, [-8, -18, -7, -18]], [O, [6, -20, 7, -20]]] },
  { name: 'multi-tool', tier: 2, parts: [[M, rect(-34, -9, 40, 7)], [M, rect(-34, 2, 40, 7)], [M, [[6, -9], [30, -4], [30, -1], [6, -2]]], [M, [[6, 2], [30, 1], [30, 4], [6, 9]]], [D, ell(2, 0, 5, 5, 10)], [M, taper(-30, -7, -8, -30, 7, 1.5)]], tell: [5, 2, 3] },
  // harmless
  { name: 'shirt', parts: [[O, [[-13, -27], [-5, -27], [0, -22], [5, -27], [13, -27], [36, -14], [28, -2], [15, -8], [15, 28], [-15, 28], [-15, -8], [-28, -2], [-36, -14]]]], lines: [[PL, [0, -18, 0, -16]], [PL, [0, -6, 0, -4]], [PL, [0, 6, 0, 8]]] },
  { name: 'shoes', parts: [[O, [[-36, 12], [-36, -4], [-28, -14], [-16, -15], [-8, -6], [8, -4], [24, 4], [36, 8], [36, 12]]], [M, rect(-26, 6, 34, 3)]] },
  { name: 'phone', confusable: 'lighter', parts: [[M, rrect(-14, -27, 28, 54, 5)], [D, rect(-10, -18, 20, 30)]] },
  { name: 'laptop', parts: [[PL, rect(-36, -28, 72, 42)], [PL, [[-44, 14], [44, 14], [40, 22], [-40, 22]]], [D, rect(-28, -2, 56, 12)]], lines: [[M, [-30, -22, 30, -22]]] },
  { name: 'headphones', parts: [[PL, band(0, 4, 26, 4, 180, 360)], [PL, rect(-32, 2, 12, 22)], [PL, rect(20, 2, 12, 22)], [D, ell(-26, 13, 4, 6, 8)], [D, ell(26, 13, 4, 6, 8)]] },
  { name: 'book', parts: [[O, rect(-20, -27, 40, 54)]], lines: [[O, [-15, -27, -15, 27]]] },
  { name: 'toothbrush', confusable: 'box cutter', parts: [[PL, [[-38, -4], [2, -4], [10, -10], [38, -10], [38, 10], [10, 10], [2, 4], [-38, 4]]]], lines: [[PL, [16, -6, 16, 6]], [PL, [24, -6, 24, 6]], [PL, [32, -6, 32, 6]]] },
  { name: 'charger', confusable: 'taser', parts: [[PL, rect(-16, -14, 32, 28)], [M, rect(-9, -24, 4, 10)], [M, rect(5, -24, 4, 10)], [PL, rect(-3, 14, 6, 30)]] },
  { name: 'small liquid', confusable: 'large liquid', parts: [[O, rect(-12, -6, 24, 32)], [O, rect(-4, -12, 8, 6)], [PL, rect(-6, -19, 12, 7)]] },
  { name: 'sunglasses', parts: [[PL, ell(-17, 0, 13, 10)], [PL, ell(17, 0, 13, 10)], [M, rect(-5, -3, 10, 4)]] },
  { name: 'hairdryer', confusable: 'gun', parts: [[PL, rect(-30, -14, 44, 22)], [PL, [[14, -14], [26, -17], [26, 11], [14, 8]]], [PL, [[-16, 8], [-4, 8], [-1, 36], [-13, 36]]], [D, ell(-20, -3, 6, 6, 10)]], lines: [[M, [-6, -10, -6, 4]], [M, [0, -10, 0, 4]], [M, [6, -10, 6, 4]], [M, [-10, 20, -6, 32]]] },
  { name: 'pen', confusable: 'box cutter', parts: [[M, [[-38, -8], [24, -8], [38, 0], [24, 8], [-38, 8]]], [M, rect(-32, -12, 24, 4)]] },
  { name: 'umbrella', parts: [[O, [...arc(0, 0, 30, 180, 360, 12)]], [M, rect(-1.5, 0, 3, 34)], [PL, [[-1.5, 32], [1.5, 32], [1.5, 40], [-7, 40], [-7, 36], [-3, 36], [-3, 34], [-1.5, 34]]]], lines: [[M, [-30, 0, 0, -30, 30, 0]]] },
  { name: 'camera', parts: [[PL, rect(-26, -17, 52, 34)], [PL, rect(-22, -24, 16, 7)], [M, ring(4, 0, 12, 4)], [D, rect(-24, -12, 10, 24)], [M, rect(14, -21, 10, 4)]] },
  { name: 'wallet', parts: [[O, [[-24, -17], [24, -17], [24, -8], [14, -8], [14, 8], [24, 8], [24, 17], [-24, 17]]], [M, ell(-12, 4, 5, 5, 10)], [M, ell(-2, 8, 5, 5, 10)]] },
  { name: 'keys', parts: [[M, band(-22, 0, 11, 5, 15, 345)], [M, rect(-14, -8, 44, 5)], [M, rect(20, -3, 4, 5)], [M, rect(-14, 3, 38, 5)], [M, rect(16, 8, 4, 5)]] },
  { name: 'toy', parts: [[O, ell(-4, 8, 22, 14, 14)], [O, ell(14, -10, 11, 11)], [O, [[24, -12], [34, -9], [24, -6]]]] },
  { name: 'water bottle', confusable: 'large liquid', parts: [[O, rect(-13, -8, 26, 44)], [O, [[-13, -8], [-5, -22], [5, -22], [13, -8]]], [PL, rect(-6, -30, 12, 8)]] },
  { name: 'belt', confusable: 'hammer', parts: [[O, rect(-42, -4, 64, 8)], [M, ring(32, 0, 10, 4)]] },
  { name: 'snacks', parts: [[O, [...crimp(-22, 22, -28, 4, 8), ...crimp(22, -22, 28, -4, 8)]]] },
  { name: 'perfume', confusable: 'large liquid', parts: [[O, [[-16, -6], [16, -6], [20, 4], [16, 26], [-16, 26], [-20, 4]]], [O, rect(-5, -12, 10, 6)], [M, rrect(-8, -26, 16, 14, 3)]] },
  { name: 'fork', confusable: 'knife', parts: [[M, rrect(-40, -4, 40, 8, 3)], [M, rect(0, -10, 8, 20)], [M, rect(8, -10, 26, 4)], [M, rect(8, -3.5, 26, 3)], [M, rect(8, 0.5, 26, 3)], [M, rect(8, 6, 26, 4)]] },
  { name: 'knitting needles', confusable: 'knife', parts: [[O, ell(0, 4, 18, 16, 14)], [M, bar(-34, -14, 34, 18, 4)], [M, bar(-34, 18, 34, -14, 4)], [PL, ell(-34, -14, 4, 4, 8)], [PL, ell(-34, 18, 4, 4, 8)]] },
  { name: 'power bank', confusable: 'explosives', parts: [[D, rrect(-26, -15, 46, 30, 5)], [PL, rect(20, -6, 8, 12)]] },
  { name: 'tablet', parts: [[PL, rrect(-30, -38, 60, 76, 6)], [D, rect(-22, -24, 44, 40)]] },
  { name: 'banana', parts: [[O, band(0, -24, 42, 17, 55, 125, 12)]] },
  { name: 'stapler', confusable: 'multi-tool', parts: [[M, rrect(-36, -10, 66, 9, 4)], [M, rect(-36, 2, 72, 7)], [M, ell(-30, -1, 5, 5, 10)]] },
  { name: 'cable', parts: [[PL, ring(-6, 0, 18, 4)], [PL, ring(4, 0, 16, 4)], [M, rect(20, -4, 12, 8)]] },
  { name: 'usb stick', confusable: 'lighter', parts: [[PL, rrect(-10, -4, 20, 34, 5)], [M, rect(-7, -16, 14, 12)]], lines: [[M, [-3, -12, -2, -12]], [M, [2, -12, 3, -12]]] },
  { name: 'mug', parts: [[PL, rrect(-18, -20, 32, 40, 4)], [PL, band(14, 0, 12, 4, -80, 80)]] },
  { name: 'tape measure', parts: [[PL, rrect(-20, -20, 40, 40, 8)], [D, ring(0, 0, 9, 4)], [M, rect(20, 10, 18, 7)]] },
];

// ---------- the body scan (PRD v0.2 B) ----------
// The silhouette stands with hands up; body items sit at fixed places on it (silhouette units, y down, origin at the belt line).
const SILHOUETTE = [
  ell(0, -82, 12, 15, 14), rect(-5, -69, 10, 9), [[-24, -62], [24, -62], [21, -12], [18, 8], [-18, 8], [-21, -12]],
  bar(-22, -58, -36, -86, 12), bar(22, -58, 36, -86, 12), bar(-36, -86, -32, -112, 10), bar(36, -86, 32, -112, 10), ell(-31, -119, 6, 8, 10), ell(31, -119, 6, 8, 10),
  bar(-10, 4, -12, 96, 15), bar(10, 4, 12, 96, 15), rrect(-24, 94, 18, 10, 4), rrect(6, 94, 18, 10, 4),
];
const BODY_DATA = [
  // normal
  { name: 'hair clip', slot: 'crown', pos: [6, -95], rot: 20, parts: [[M, rect(-7, -2, 14, 4)], [M, rect(-5, -4, 2, 8)]] },
  { name: 'glasses', slot: 'face', pos: [0, -84], parts: [[M, ring(-6, 0, 5, 1.6)], [M, ring(6, 0, 5, 1.6)], [M, rect(-1.5, -1, 3, 2)]] },
  { name: 'earrings', slot: 'ears', pos: [0, -76], parts: [[M, ring(-8.7, 0, 3, 1.6)], [M, ring(8.7, 0, 3, 1.6)]] },
  { name: 'wristwatch', slot: 'wrist', pos: [-33, -106], rot: -10, parts: [[M, rrect(-5, -6, 10, 12, 2)], [PL, rect(-3.5, -11, 7, 5)], [PL, rect(-3.5, 6, 7, 5)]] },
  { name: 'ring', slot: 'hand', pos: [31, -116], parts: [[M, ring(0, 0, 3.5, 1.6)]] },
  { name: 'underwire', slot: 'chest', pos: [0, -44], parts: [[M, band(-10, -4, 10, 1.8, 20, 160)], [M, band(10, -4, 10, 1.8, 20, 160)]] },
  { name: 'belt buckle', slot: 'waist', pos: [0, 0], parts: [[M, ring(0, 0, 6, 2.2)], [M, rect(-1, -5, 2, 10)]] },
  { name: 'zipper', slot: 'fly', pos: [0, 16], parts: [[M, rect(-1.2, -8, 2.4, 16)], [M, rect(-2.5, -9, 5, 4)]] },
  { name: 'keys', slot: 'pocketL', pos: [-13, 24], rot: 30, parts: [[M, ring(-4, 0, 4, 1.6)], [M, rect(0, -1.5, 9, 3)], [M, rect(0, 2, 7, 2.5)]] },
  { name: 'coins', slot: 'pocketR', pos: [13, 24], parts: [[M, ell(-3, -2, 3.5, 3.5, 10)], [M, ell(3, 1, 3.5, 3.5, 10)], [M, ell(-1, 4, 3.5, 3.5, 10)]] },
  { name: 'phone', slot: 'pocketR', pos: [13, 26], parts: [[D, rrect(-5, -9, 10, 18, 2)]] },
  { name: 'knee brace', slot: 'knee', pos: [-11, 54], parts: [[M, rect(-10, -10, 3, 20)], [M, rect(7, -10, 3, 20)], [M, ell(-8.5, 0, 3, 3, 8)], [M, ell(8.5, 0, 3, 3, 8)]] },
  // contraband
  { name: 'arm gun', label: 'gun under the arm', item: 'gun', tier: 3, slot: 'armpit', pos: [-6, -44], rot: 12, parts: [[D, rect(-10, -5, 19, 4)], [M, rect(9, -4.5, 2, 3)], [D, rect(-9, -1, 12, 2.5)], [D, [[-9, -1], [-3.5, -1], [-1.8, 8], [-7.2, 8]]], [M, band(1, 1.6, 3, 1.1, 0, 180, 6)]] },
  { name: 'leg knife', label: 'knife on the leg', item: 'knife', tier: 2, slot: 'shin', pos: [12, 74], parts: [[O, rect(-3.5, -24, 7, 10)], [M, rect(-5, -14, 10, 2.5)], [M, [[-3, -12], [3, -12], [3, 8], [0, 16], [-3, 8]]], [O, rect(-8, -6, 16, 2)]] },
  { name: 'boot blade', label: 'blade in the boot', item: 'knife', tier: 2, slot: 'boot', pos: [-14, 90], rot: -8, parts: [[M, [[-2, -14], [3, -14], [3, 6], [-2, 10]]], [D, rect(-3, 6, 6, 6)]] },
  { name: 'belt taser', label: 'taser on the belt', item: 'taser', tier: 2, slot: 'hip', pos: [21, -2], parts: [[PL, rect(-6, -9, 12, 18)], [D, rect(-4, -6, 8, 8)], [M, rect(-4, 9, 2, 5)], [M, rect(2, 9, 2, 5)]] },
  { name: 'knuckles', label: 'brass knuckles', item: 'brass knuckles', tier: 2, slot: 'hand', pos: [31, -117], parts: [[M, ring(-4.5, -3, 3, 1.4)], [M, ring(0, -3, 3, 1.4)], [M, ring(4.5, -3, 3, 1.4)], [M, rrect(-7, 0, 14, 4, 2)]] },
  { name: 'pocket lighter', label: 'lighter in a pocket', item: 'lighter', tier: 1, slot: 'pocketL', pos: [-13, 24], parts: [[PL, rrect(-3.5, -3, 7, 13, 1.5)], [M, rect(-3.5, -7, 7, 4)], [M, gear(2, -9.5, 4.2, 3.4, 9)], [M, rect(-3.5, -12, 2, 6)]] },
];

// ---------- geometry ----------
const inPoly = (px, py, poly) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? clamp(((px - ax) * dx + (py - ay) * dy) / l, 0, 1) : 0;
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
};
const shapeDist = (px, py, parts) => {
  let m = Infinity;
  for (const poly of parts) {
    if (inPoly(px, py, poly)) return 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) m = Math.min(m, segDist(px, py, poly[j][0], poly[j][1], poly[i][0], poly[i][1]));
  }
  return m;
};
const inShape = (px, py, parts) => { for (const poly of parts) if (inPoly(px, py, poly)) return true; return false; };
const OPAQUE = new Set([M, D]);   // materials that hide what is under them (for the fairness rule)

function outlinePoints(shape, step, offset) {
  const pts = [];
  shape.forEach((poly, pi) => {
    const others = shape.filter((_, k) => k !== pi);
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [ax, ay] = poly[j], [bx, by] = poly[i], len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(len / step));
      for (let k = 0; k < n; k++) {
        const t = (k + offset) / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
        if (!others.length || shapeDist(x, y, others) > 0.05) pts.push([x, y]);
      }
    }
  });
  return pts;
}
function minWidth(shape) {
  const pts = shape.flat();
  let best = Infinity;
  for (let a = 0; a < 180; a++) {
    const c = Math.cos(a * DEG), s = Math.sin(a * DEG);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [x, y] of pts) { const u = x * c - y * s, v = x * s + y * c; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    best = Math.min(best, u1 - u0, v1 - v0);
  }
  return best;
}
const gridIn = (shape, step, offset) => {
  const xs = shape.flat().map((p) => p[0]), ys = shape.flat().map((p) => p[1]), pts = [];
  for (let y = Math.min(...ys) + step * offset; y < Math.max(...ys); y += step)
    for (let x = Math.min(...xs) + step * offset; x < Math.max(...xs); x += step) if (inShape(x, y, shape)) pts.push([x, y]);
  return pts;
};
const scalePts = (poly, k) => poly.map(([x, y]) => [x * k, y * k]);
const ITEMS = ITEM_DATA.map((d) => {
  const k = T.itemScale;
  const parts = d.parts.map(([m, poly]) => [m, scalePts(poly, k)]);
  const item = { tier: 0, confusable: null, tell: [], lines: [], ...d, parts, lines: (d.lines || []).map(([m, l]) => [m, l.map((v) => v * k)]) };
  item.contraband = item.tier > 0;
  item.shape = parts.map((p) => p[1]);
  item.mats = parts.map((p) => p[0]);
  item.tellShape = item.tell.map((i) => item.shape[i]);
  const area = {};
  for (const [m, poly] of parts) { let a = 0; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]); area[m] = (area[m] || 0) + Math.abs(a / 2); }
  item.mat = Object.entries(area).sort((a, b) => b[1] - a[1])[0][0];   // dominant material
  const xs = item.shape.flat().map((p) => p[0]), ys = item.shape.flat().map((p) => p[1]);
  item.size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  item.thin = minWidth(item.shape);
  item.rad = Math.max(...item.shape.flat().map((p) => Math.hypot(p[0], p[1])));
  item.samples = gridIn(item.shape, T.visStep, 0.5);
  item.edge = outlinePoints(item.shape, T.edgeStep, 0.5);
  item.tellPts = item.tell.length ? gridIn(item.tellShape, T.visStep * 0.67, 0.5) : [];
  return item;
});
const BY_NAME = Object.fromEntries(ITEMS.map((i) => [i.name, i]));
const HARMLESS = ITEMS.filter((i) => !i.contraband);
const BODY = BODY_DATA.map((d) => ({ tier: 0, rot: 0, label: d.name, ...d, parts: d.parts.map(([m, poly]) => [m, scalePts(poly, T.bodyScale)]), contraband: (d.tier || 0) > 0, metal: d.parts.some(([m]) => m === M) }));
const BODY_BY_NAME = Object.fromEntries(BODY.map((b) => [b.name, b]));
const BODY_NORMAL = BODY.filter((b) => !b.contraband);

// ---------- bag generation (setup only, seeded) ----------
const xform = (x, y, rot) => { const c = Math.cos(rot * DEG), s = Math.sin(rot * DEG); return ([px, py]) => [x + px * c - py * s, y + px * s + py * c]; };
function instance(def, x, y, rot) {
  const tr = xform(x, y, rot);
  const parts = def.shape.map((poly) => poly.map(tr));
  const opaque = parts.filter((_, i) => OPAQUE.has(def.mats[i]));
  const bb = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const [px, py] of parts.flat()) { bb.x0 = Math.min(bb.x0, px); bb.x1 = Math.max(bb.x1, px); bb.y0 = Math.min(bb.y0, py); bb.y1 = Math.max(bb.y1, py); }
  return { def, name: def.name, tier: def.tier, contraband: def.contraband, x, y, rot, parts, opaque, pts: def.samples.map(tr), epts: def.edge.map(tr), tpts: def.tellPts.map(tr), bb, cov: null, ecov: null, tcov: null, hidden: 0, ehidden: 0, thidden: 0, state: 0, flagT: -1 };
}
function extents(def, rot) {
  const c = Math.cos(rot * DEG), s = Math.sin(rot * DEG);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [px, py] of def.shape.flat()) { const x = px * c - py * s, y = px * s + py * c; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  return { minX, maxX, minY, maxY };
}
function covers(px, py, o, margin, opaqueOnly) {
  const b = o.bb;
  if (px < b.x0 - margin || px > b.x1 + margin || py < b.y0 - margin || py > b.y1 + margin) return false;
  if (opaqueOnly) return o.opaque.length > 0 && (margin > 0 ? shapeDist(px, py, o.opaque) <= margin : inShape(px, py, o.opaque));
  return margin > 0 ? shapeDist(px, py, o.parts) <= margin : inShape(px, py, o.parts);
}
// Adds `it` to the bag if every item, itself included, keeps its share of area and outline visible, and every contraband item keeps its
// distinctive part (the tell) clear of other items' metal and dense parts.
const CHANS = [['pts', 'cov', 'hidden', false], ['epts', 'ecov', 'ehidden', false], ['tpts', 'tcov', 'thidden', true]];
const needOf = (it, c, rule) => (c === 2 ? T.tellVis + rule.slack : it.contraband ? rule.needC : rule.needH);
function commit(it, placed, rule) {
  const own = CHANS.map(([pts]) => ({ cov: new Uint8Array(it[pts].length), hidden: 0 })), extras = [];
  for (const p of placed) {
    const a = it.bb, b = p.bb, m = rule.margin;
    if (a.x1 + m < b.x0 || b.x1 + m < a.x0 || a.y1 + m < b.y0 || b.y1 + m < a.y0) continue;
    const ex = [];
    for (let c = 0; c < 3; c++) {
      const [pts, cov, hid, opq] = CHANS[c], mine = it[pts], theirs = p[pts];
      for (let i = 0; i < mine.length; i++) if (!own[c].cov[i] && covers(mine[i][0], mine[i][1], p, m, opq)) { own[c].cov[i] = 1; own[c].hidden++; }
      const list = [];
      for (let j = 0; j < theirs.length; j++) if (!p[cov][j] && covers(theirs[j][0], theirs[j][1], it, m, opq)) list.push(j);
      if (theirs.length && (theirs.length - p[hid] - list.length) / theirs.length < needOf(p, c, rule)) return false;
      ex.push(list);
    }
    extras.push([p, ex]);
  }
  for (let c = 0; c < 3; c++) { const n = it[CHANS[c][0]].length; if (n && (n - own[c].hidden) / n < needOf(it, c, rule)) return false; }
  for (const [p, ex] of extras) for (let c = 0; c < 3; c++) { for (const j of ex[c]) p[CHANS[c][1]][j] = 1; p[CHANS[c][2]] += ex[c].length; }
  for (let c = 0; c < 3; c++) { it[CHANS[c][1]] = own[c].cov; it[CHANS[c][2]] = own[c].hidden; }
  return true;
}
function tryPlace(rng, def, placed, rule, anchor) {
  for (let k = 0; k < T.packTries; k++) {
    const rot = rng.range(-rule.rotMax, rule.rotMax), e = extents(def, rot);
    const x0 = T.bagPad - e.minX, x1 = T.bagW - T.bagPad - e.maxX, y0 = T.bagPad - e.minY, y1 = T.bagH - T.bagPad - e.maxY;
    if (x1 < x0 || y1 < y0) continue;
    let x, y;
    const a0 = anchor && placed.find((q) => q.name === anchor);
    if (a0 || (rule.overlap && placed.length && rng.chance(rule.bias))) {
      const other = placed.filter((q) => q.def.mat !== def.mat);
      const a = a0 || (other.length && rng.chance(T.tangleOpposite) ? rng.pick(other) : rng.pick(placed));
      const spread = a0 ? 0.35 : 0.5;
      x = clamp(a.x + rng.range(-spread, spread) * a.def.size, x0, x1); y = clamp(a.y + rng.range(-spread, spread) * a.def.size, y0, y1);
    } else { x = rng.range(x0, x1); y = rng.range(y0, y1); }
    const it = instance(def, x, y, rot);
    if (commit(it, placed, rule)) return it;
  }
  return null;
}
const occ = () => clamp(T.tune.occlusion, 0, 1);
function packRule(shift) {
  const overlap = shift >= T.overlapFrom, o = occ();
  return {
    overlap, margin: overlap ? 0 : T.packGap, rotMax: T.rotMax[shift - 1], bias: Math.min(0.95, T.overlapBias[shift - 1] * (0.4 + o)), slack: overlap ? T.visSlack : 0,
    needH: overlap ? T.minVisible + (T.occMinVisible.harmless - T.minVisible) * o + T.visSlack : 1,
    needC: overlap ? T.minVisible + (T.occMinVisible.contraband - T.minVisible) * o + T.visSlack : 1,
  };
}
// A generator: it yields `null` between item placements, so a caller can spread one bag over many frames. `under`: the smuggler's hiding place.
function* packBagSteps(rng, names, shift, under) {
  const rule = packRule(shift);
  const defs = names.map((n) => BY_NAME[n]).sort((a, b) => (b.name === under) - (a.name === under) || b.samples.length - a.samples.length);
  for (let attempt = 0; attempt < T.bagTries; attempt++) {
    const placed = [];
    for (const def of defs) { const it = tryPlace(rng, def, placed, rule, under && def.contraband && attempt < T.bagTries / 2 ? under : null); if (!it) break; placed.push(it); yield null; }
    if (placed.length === defs.length) yield null;
    if (placed.length === defs.length && finalOk({ items: placed }, rule)) {
      for (const it of placed) { it.vis = 1 - it.hidden / it.pts.length; it.evis = 1 - it.ehidden / it.epts.length; it.tvis = it.tpts.length ? 1 - it.thidden / it.tpts.length : 1; }
      return rng.shuffle(placed);
    }
  }
  throw new Error(`checkpoint: could not pack ${names.join(', ')} in shift ${shift}`);
}
// The packing measure is coarse; the finished bag must also pass a fine one.
function finalOk(bag, rule) {
  if (!rule.overlap) return true;
  const area = visibility(bag, T.visFinalStep), line = outlineVisibility(bag, T.visFinalStep), tell = tellVisibility(bag, T.visFinalStep);
  return bag.items.every((it, i) => {
    const need = (it.contraband ? rule.needC : rule.needH) - rule.slack + T.visFinalSlack;
    return area[i] >= need && line[i] >= need && tell[i] >= T.tellVis + T.visFinalSlack;
  });
}
const contrabandPool = (shift) => T.newContraband.slice(0, shift).flat();
const bodyPool = (shift) => T.newBody.slice(0, shift).flat();

function runsOk(kinds) {
  let run = 1;
  for (let i = 1; i < kinds.length; i++) { run = kinds[i] === kinds[i - 1] ? run + 1 : 1; if (run > T.runMax) return false; }
  return true;
}
function schedule(rng, shift) {
  const n = T.bagsPerShift, clean = Math.round(n * T.cleanShare), opener = T.opener.shift === shift;
  for (let k = 0; k < 200; k++) {
    const kinds = rng.shuffle([...Array(clean).fill(0), ...Array(n - clean).fill(1)]);
    if (runsOk(kinds) && (!opener || (kinds[0] === 1 && kinds[1] === 0))) return kinds;
  }
  return Array.from({ length: n }, (_, i) => (i + 1) % 2);
}
function pickWeighted(rng, list, weight, n) {
  return list.map((d) => ({ d, k: Math.log(rng()) / weight(d) })).sort((a, b) => b.k - a.k).slice(0, n).map((x) => x.d);
}
const fill = (rng, shift, have, n) => {
  const balance = shift >= T.tintFrom, pool = HARMLESS.filter((h) => !h.confusable && !have.includes(h.name));
  return pickWeighted(rng, pool, (d) => (balance && d.mat === O ? T.organicHarmless : 1), Math.max(0, n)).map((h) => h.name);
};
function bagNames(rng, shift, holds, index) {
  if (T.opener.shift === shift && index === 0) return { contra: T.opener.contraband.slice(), harmless: T.opener.harmless.slice() };
  const [lo, hi] = T.itemsPerBag[shift - 1], total = rng.int(lo, hi);
  const pool = contrabandPool(shift).map((n) => BY_NAME[n]);
  const k = !holds ? 0 : T.maxContraband[shift - 1] > 1 && rng.chance(T.twoShare[shift - 1]) ? 2 : 1;
  const balance = shift >= T.tintFrom;
  const contra = pickWeighted(rng, pool, (d) => (balance && d.mat === O ? T.organicContraband[shift - 1] : 1) * (d.tier === 3 ? T.criticalWeight : 1), k).map((d) => d.name);
  const harmless = fill(rng, shift, contra, total - k);
  if (rng.chance(T.confusableShare[shift - 1])) {
    const all = HARMLESS.filter((h) => h.confusable);
    const near = all.filter((h) => contra.includes(h.confusable));
    harmless[harmless.length - 1] = (near.length && rng.chance(T.confusableNear) ? rng.pick(near) : rng.pick(all)).name;
  }
  return { contra, harmless };
}
// The recurring characters' bags: their own items, filled up to the day's count.
function castBag(rng, shift, who) {
  const [lo, hi] = T.itemsPerBag[shift - 1], total = rng.int(lo, hi);
  let contra = [], own = [], under = null;
  if (who === 'grandma') own = ['knitting needles', 'book'];
  else if (who === 'businessman') own = ['laptop', 'pen'];
  else if (who === 'tourist') { own = ['camera', 'sunglasses']; if (shift >= T.touristGlobeFrom) contra = ['snow globe']; else own.push('toy'); }
  else { const s = T.smuggler[shift - 1]; contra = (s.bag || []).slice(); if (s.under) { under = s.under; own = [s.under]; } }
  own = own.slice(0, Math.max(1, total - contra.length));
  return { contra, harmless: [...own, ...fill(rng, shift, [...contra, ...own], total - contra.length - own.length)], under };
}
// Who appears where today: each recurring character takes one index whose bag kind matches what they carry.
function castOf(rng, shift, kinds) {
  const out = {}, used = new Set([0, 1]);
  for (const who of ['smuggler', 'tourist', 'grandma', 'businessman']) {
    if (!T.cast[who].includes(shift)) continue;
    const contraBag = who === 'smuggler' ? !!T.smuggler[shift - 1].bag : who === 'tourist' ? shift >= T.touristGlobeFrom : false;
    const want = contraBag ? 1 : 0, open = kinds.map((k, i) => i).filter((i) => !used.has(i) && kinds[i] === want && i < kinds.length - 1);
    if (!open.length) continue;
    const i = rng.pick(open);
    used.add(i); out[i] = who;
  }
  return out;
}
// The travellers: one per bag. Only a traveller carrying metal beeps and has body items to show (PRD v0.2 J); the rest have none. Setup only,
// from its own seeded stream so bags never change with them.
function makeTravellers(seed, shift, cast, n) {
  const rng = makeRng((seed ^ 0x2545f491) >>> 0), P = T.people, out = [], pool = bodyPool(shift).map((b) => BODY_BY_NAME[b]), smug = T.smuggler[shift - 1];
  // Who beeps: the cast by their rule, then ordinary travellers by an exact count, so a day's share is what the table says.
  const beepers = new Set();
  for (let i = 0; i < n; i++) if (cast[i] && (T.beepCast[cast[i]] || (cast[i] === 'smuggler' && smug.body))) beepers.add(i);
  const ordinary = rng.shuffle(Array.from({ length: n }, (_, i) => i).filter((i) => !cast[i]));
  for (const i of ordinary.slice(0, clamp(Math.round(T.beepShare[shift - 1] * n) - beepers.size, 0, ordinary.length))) beepers.add(i);
  for (let i = 0; i < n; i++) {
    const who = cast[i] || null, ch = who ? T.characters[who] : null;
    const look = ch ? { ...ch } : { coat: rng.pick(P.coat), skin: rng.pick(P.skin), hair: rng.pick(P.hair), sweat: rng.chance(P.flavour), glance: rng.chance(P.flavour), shades: rng.chance(P.flavour) };
    let contra = [], normal = [];
    if (beepers.has(i)) {
      if (who === 'smuggler') contra = (smug.body || []).map((b) => BODY_BY_NAME[b]);
      else if (!who && pool.length && rng.chance(T.bodyShare[shift - 1])) {
        const gun = pool.find((b) => b.tier === 3), rest = pool.filter((b) => b.tier < 3);
        contra = [gun && (!rest.length || rng.chance(T.bodyGunShare)) ? gun : rng.pick(rest)];
      }
      const [lo, hi] = T.bodyNormal[shift - 1], slots = new Set(contra.map((b) => b.slot));
      if (who === 'grandma') normal = ['hair clip', 'glasses', 'earrings', 'knee brace'].map((b) => BODY_BY_NAME[b]);
      else if (who === 'businessman') normal = ['wristwatch', 'belt buckle', 'keys', 'phone'].map((b) => BODY_BY_NAME[b]);
      else if (who === 'tourist') normal = ['coins', 'wristwatch', 'zipper'].map((b) => BODY_BY_NAME[b]);
      else { const first = rng.pick(BODY_NORMAL.filter((b) => b.metal)); normal = [first, ...rng.shuffle(BODY_NORMAL.filter((b) => b !== first))]; }   // the first is metal: that is what set off the arch
      normal = normal.filter((b) => { if (slots.has(b.slot)) return false; slots.add(b.slot); return true; }).slice(0, who ? 4 : rng.int(lo, hi));
    }
    const body = [...normal, ...contra].map((def) => ({ def, name: def.name, tier: def.tier, contraband: def.contraband, x: def.pos[0], y: def.pos[1], parts: def.parts.map(([, poly]) => poly.map(xform(def.pos[0], def.pos[1], def.rot))), state: 0 }));
    out.push({ idx: i, who, look, tag: T.palette.tags[i % T.palette.tags.length], body, beeps: body.some((b) => b.def.metal) });
  }
  return out;
}
// One shift from a seed: first a plan (bag kinds and cast), then a bag at a time (null between placements) so the work spreads over frames.
function* genShiftSteps(seed, shift) {
  const rng = makeRng(seed);
  const kinds = schedule(rng, shift), cast = castOf(rng, shift, kinds);
  yield { plan: { kinds, cast } };
  for (let index = 0; index < kinds.length; index++) {
    const who = cast[index], { contra, harmless, under } = who ? castBag(rng, shift, who) : bagNames(rng, shift, kinds[index], index);
    const items = yield* packBagSteps(rng, [...contra, ...harmless], shift, under);
    yield { kind: contra.length ? 'contra' : 'clean', w: T.bagW, h: T.bagH, items, who: who || null };
  }
}
function collect(seed, shift, list) {
  const plan = list.find((x) => x && x.plan).plan, bags = list.filter((x) => x && !x.plan);
  return { seed, shift, bags, travellers: makeTravellers(seed, shift, plan.cast, bags.length), cast: plan.cast };
}
function genShift(seed, shift) { return collect(seed, shift, [...genShiftSteps(seed, shift)]); }

const gridCache = new Map();
const gridOf = (def, step, offset, tell) => {
  const key = `${def.name}|${step}|${offset}|${tell ? 1 : 0}`;
  if (!gridCache.has(key)) gridCache.set(key, tell ? (def.tell.length ? gridIn(def.tellShape, step, offset) : []) : gridIn(def.shape, step, offset));
  return gridCache.get(key);
};
const near = (bag, it) => bag.items.filter((o) => o !== it && o.bb.x0 < it.bb.x1 && o.bb.x1 > it.bb.x0 && o.bb.y0 < it.bb.y1 && o.bb.y1 > it.bb.y0);
function shareVisible(it, others, pts, opaqueOnly) {
  if (!others.length || !pts.length) return 1;
  const tr = xform(it.x, it.y, it.rot);
  let hidden = 0;
  for (const p of pts) {
    const [x, y] = tr(p);
    for (const o of others) if (x >= o.bb.x0 && x <= o.bb.x1 && y >= o.bb.y0 && y <= o.bb.y1 && inShape(x, y, opaqueOnly ? o.opaque : o.parts)) { hidden++; break; }
  }
  return 1 - hidden / pts.length;
}
function visibility(bag, step = 1, offset = 0.5) { return bag.items.map((it) => shareVisible(it, near(bag, it), gridOf(it.def, step, offset), false)); }
const edgeCache = new Map();
function outlineVisibility(bag, step = 1, offset = 0.5) {
  return bag.items.map((it) => {
    const key = `${it.name}|${step}|${offset}`;
    if (!edgeCache.has(key)) edgeCache.set(key, outlinePoints(it.def.shape, step, offset));
    return shareVisible(it, near(bag, it), edgeCache.get(key), false);
  });
}
// The fairness rule: the share of each contraband item's tell that lies clear of every other item's metal and dense parts (1 for harmless).
function tellVisibility(bag, step = 1, offset = 0.5) { return bag.items.map((it) => (it.contraband ? shareVisible(it, near(bag, it), gridOf(it.def, step, offset, true), true) : 1)); }

// ---------- play state ----------
let S = null;
const BAG_X = T.bagX;
const P = T.palette, J = T.juice, TY = T.type, LN = T.line, MT = T.mats, LA = T.lane;

let layoutMemo = null;
function layout(E) {
  const m = layoutMemo, st = E.safe.top, sb = E.safe.bottom;
  if (m && m.w === E.w && m.h === E.h && m.st === st && m.sb === sb) return m.L;
  const s = Math.min(E.w / T.designW, E.h / T.designMinH);
  const L = { s, ox: (E.w - T.designW * s) / 2, H: E.h / s, hud: st + T.hudH, top: st + T.hudH + T.hoodH, bottom: E.h - sb };
  L.laneTop = L.hud / s; L.B = L.bottom / s;
  L.boothTop = L.laneTop + LA.boothTop; L.boothBot = L.boothTop + LA.boothH;
  L.queueY = L.laneTop + LA.queueY; L.spotY = L.B - LA.spotLift;
  L.lever = { x: T.lever.x, y: L.B - T.lever.lift - T.lever.h, w: T.lever.w, h: T.lever.h };
  const sw = LA.boothW - 12, sh = LA.boothH - 16;
  L.scan = { x: LA.boothX + 6, y: L.boothTop + 8, w: sw, h: sh, cx: LA.boothX + LA.boothW / 2, cy: L.boothTop + 8 + sh * 0.55, k: Math.min(sw / 96, sh / 240) };
  layoutMemo = { w: E.w, h: E.h, st, sb, L };
  return L;
}
const cleanShifts = (all) => {
  const out = {};
  if (!all || typeof all !== 'object' || Array.isArray(all)) return out;
  const num = (v) => (Number.isFinite(v) && v > 0 ? v : 0);
  for (const [k, r] of Object.entries(all)) if (/^\d+$/.test(k) && r && typeof r === 'object') out[k] = { best: num(r.best), stars: clamp(Math.floor(num(r.stars)), 0, 3) };
  return out;
};
const readShifts = (E) => cleanShifts(E.save.get('shifts', {}));
const clampUnlocked = (n) => (Number.isFinite(Number(n)) ? clamp(Math.floor(Number(n)), 1, T.beltSpeed.length) : 1);
const readUnlocked = (E) => clampUnlocked(E.save.get('unlocked', 1));
const cleanCareer = (c) => { const n = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0); return c && typeof c === 'object' && !Array.isArray(c) ? { swats: n(c.swats), vic: n(c.vic), breaches: n(c.breaches) } : { swats: 0, vic: 0, breaches: 0 }; };
const multiplier = () => 1 + T.streakSteps.filter((n) => S.streak >= n).length;
const rankOf = (day) => T.ranks.filter(([d]) => day >= d).pop()[1];

const txt = (E, str, x, y, size, color, o = {}) => E.text(str, x, y, { size, color, weight: TY.weight, ...o });
const alpha = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const polyPath = (polys) => { const p = new Path2D(); for (const poly of polys) { poly.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); } return p; };
const pathsOf = (def) => {
  if (!def.paths) {
    def.paths = def.parts.map(([, poly]) => polyPath([poly]));
    def.outline = polyPath(def.parts.map((p) => p[1]));
    def.linePaths = (def.lines || []).map(([m, l]) => { const p = new Path2D(); for (let i = 0; i < l.length; i += 2) (i ? p.lineTo(l[i], l[i + 1]) : p.moveTo(l[i], l[i + 1])); return [m, p]; });
  }
  return def;
};
const plate = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
};
const fillBox = (E, x, y, w, h, color) => { E.ctx.fillStyle = color; E.ctx.fillRect(x, y, w, h); };

// ---------- preparing a shift while a card is on screen, so entering play never blocks ----------
let PREP = null;
function prepare(shift, seed) {
  if (!PREP || PREP.shift !== shift || PREP.seed !== seed) PREP = { shift, seed, iter: genShiftSteps(seed, shift), list: [], done: false, ready: false, g: null };
  return PREP;
}
function pump(E) {
  const p = PREP;
  if (!p || p.ready) return;
  if (!p.done) {
    const t0 = performance.now();
    do { const r = p.iter.next(); if (r.done) { p.done = true; p.g = collect(p.seed, p.shift, p.list); break; } if (r.value) p.list.push(r.value); } while (performance.now() - t0 < T.prepMs);
    return;
  }
  const L = layout(E);
  for (const b of p.g.bags.slice(0, 2)) if (!bagSpriteOk(E, L, b)) { makeBagSprite(E, L, b); return; }
  p.ready = true;
}
function takeShift(shift, seed) {
  const p = PREP;
  PREP = null;
  if (p && p.shift === shift && p.seed === seed) {
    if (!p.done) { for (let r = p.iter.next(); !r.done; r = p.iter.next()) if (r.value) p.list.push(r.value); p.g = collect(seed, shift, p.list); }
    return p.g;
  }
  return genShift(seed, shift);
}

function startShift(E, shift, seed) {
  const g = takeShift(shift, seed), L = layout(E), first = L.top / L.s + T.firstBagGap;
  const rush = T.rush.includes(shift), { size, gapIn } = T.burst, gapOut = size * T.bagGap - (size - 1) * gapIn, offsets = [0];
  for (let i = 1; i < g.bags.length; i++) offsets.push(offsets[i - 1] + T.bagH + (rush ? (i % size === 0 ? gapOut : gapIn) : T.bagGap));
  S = {
    shift, seed, rush, time: 0, dist: 0, acc: 0, score: 0, streak: 0, strikes: 0, catches: 0, falseAlarms: 0, misses: 0, passes: 0, resolved: 0,
    ended: null, endT: 0, finished: false, H: L.H, exitY: L.B, fx: [], ghosts: [], ripples: [], stamp: null, flashT: 0, flashColor: '', log: [],
    bannerT: 0, humT: 0, scorePop: 0, badgePop: 0, lastMult: 1, streakMax: 0, frames: 0, timed: 0, slow: 0, missNames: [], faNames: [],
    lever: false, leverT: 0, leverAnim: 0, leverTime: 0, lockUntil: 0, slowT: 0, swats: [], swatCount: 0, bodyCatches: 0, bodyMisses: 0, breach: null, alarmT: 0, sirenT: 0, sirenN: 0,
    arch: null, lamp: null, beeps: 0, swatPaid: 0, vicCaught: false, travellers: [],
    bags: g.bags.map((b, i) => ({
      ...b, idx: i, y0: first - offsets[i], y: 0,
      pending: b.items.filter((it) => it.contraband).length, touched: false, missed: false, resolved: false, settled: false, gone: false,
      trayT: -1, flashT: 0, shown: false, stampT: -1, spr: b.spr || null,
    })),
  };
  for (const b of S.bags) b.y = b.y0;
  S.travellers = g.travellers.map((t, i) => ({
    ...t, bag: S.bags[i], state: 'queue', x: LA.centre + LA.queueStep * 3, y: L.queueY, t: 0, scanT0: -1, fadeT: 0, spot: -1, stopped: false, touched: false,
    resolved: false, pending: t.body.filter((b) => b.contraband).length, grumbleT: 0, fa: null, alpha: 0, swat: null, scanned: false, archDone: false, spr: null,
  }));
  for (const tr of S.travellers) tr.bag.tr = tr;
}

// ---------- juice helpers (cosmetic only) ----------
const itemXY = (L, b, it) => [L.ox + (BAG_X + it.x) * L.s, (b.y + it.y) * L.s];
function burst(E, x, y, color, n, speed) {
  const room = J.particleCap - E.particles.list.length;
  if (room > 0 && n > 0) E.particles.emit({ x, y, count: Math.min(n, room), color, speed, life: J.particleLife, size: J.particleSize });
}
function pop(E, field, dur) { const s = S; E.tween(dur, (k) => { s[field] = 1 - k; }, ease.outBack); }
function tone(E, t, up = 0) { E.audio.beep({ ...t, freq: t.freq * (t.up || 1) ** up }); }
function addFx(text, x, y, color, big = false, bottom = false) { S.fx.push({ text, x, y, color, t: 0, big, bottom }); }
function flash(color) { S.flashT = J.flashLife; S.flashColor = color; }
const scoreMult = () => multiplier() * (S.lever ? T.rushMult : 1);

const headline = (r) => {
  if (r.result === 'breach') return { lines: r.breachItem === 'explosives' ? ['BOMB WALKS', 'THROUGH', 'CHECKPOINT'] : ['GUN WALKS', 'THROUGH', 'CHECKPOINT'], sub: `${r.rank} sent home on day ${r.shift}` };
  if (r.result === 'over') return { lines: ['SHIFT CUT', 'SHORT AT', 'GATE 4'], sub: `Three strikes for the ${r.rank.toLowerCase()} on day ${r.shift}` };
  if (r.swats) return { lines: ['SWAT TAKES', 'DOWN ARMED', 'FLYER'], sub: r.swats > 1 ? `${r.swats} tackles on day ${r.shift}` : `Quick eyes on day ${r.shift}` };
  if (r.vic) return { lines: ['SMUGGLER', 'VIC CAUGHT', 'AGAIN'], sub: `Day ${r.shift}: he is getting cleverer` };
  if (r.stars === 3) return { lines: ['NOTHING', 'GETS PAST', 'THIS ONE'], sub: `A flawless day ${r.shift} at the belt` };
  return { lines: ['QUIET DAY', 'AT THE', 'CHECKPOINT'], sub: `Day ${r.shift} done, ${r.strikes} strike${r.strikes === 1 ? '' : 's'}` };
};

function endShift(E, result, item) {
  S.ended = result; S.endT = 0;
  const clear = result === 'clear';
  const stars = clear ? (S.strikes === 0 ? 3 : S.strikes <= 1 ? 2 : 1) : 0;
  const rec = readShifts(E)[S.shift] || { best: 0, stars: 0 };
  const unlocked = clear ? E.save.set('unlocked', Math.max(readUnlocked(E), clampUnlocked(S.shift + 1))) : readUnlocked(E);
  const career = E.save.update('career', (c) => { const x = cleanCareer(c); x.swats += S.swatCount; x.vic += S.vicCaught ? 1 : 0; x.breaches += result === 'breach' ? 1 : 0; return x; }, {});
  const best = clear ? Math.max(rec.best, S.score) : rec.best;   // a best counts only on a cleared day
  S.result = { shift: S.shift, seed: S.seed, unlocked, result, score: S.score, strikes: Math.min(S.strikes, T.strikesMax), stars, best, isNew: clear && S.score > rec.best, catches: S.catches, falseAlarms: S.falseAlarms, misses: S.misses, time: S.time, swats: S.swatCount, vic: S.vicCaught, breachItem: item || '', rank: rankOf(S.shift), career };
  E.save.update('shifts', (all) => ({ ...cleanShifts(all), [S.shift]: { best, stars: Math.max(rec.stars, stars) } }), {});
  if (E.ledger) E.ledger.add('shift', { shift: S.shift, seed: S.seed, result, score: S.score, strikes: S.strikes, missed: S.misses, falseAlarms: S.falseAlarms, stars, catches: S.catches, passes: S.passes, bags: S.bags.filter((b) => b.resolved).length, time: +S.time.toFixed(1), streakMax: S.streakMax, swats: S.swatCount, beeps: S.beeps, bodyCatches: S.bodyCatches, bodyMisses: S.bodyMisses, lever: +(S.leverTime / Math.max(1e-9, S.time)).toFixed(3), breach: item || '', slow: +(S.slow / Math.max(1, S.timed)).toFixed(3), dpr: +(E.dpr || 1).toFixed(2), missedItems: S.missNames.join(','), falseItems: S.faNames.join(','), occlusion: T.tune.occlusion, beltK: T.tune.belt, pace: T.tune.pace, scanShow: T.scanShow });
  S.log.push({ t: S.time, e: result });
  S.stamp = { text: clear ? 'CLEARED' : result === 'breach' ? 'BREACH' : 'SHIFT OVER', color: clear ? P.clean : P.catch, t: 0 };
  prepare(S.shift, S.seed);
  if (result === 'breach') { E.haptic(J.haptic.breach); E.shake(...J.shake.breach); S.alarmT = 0; }
  else { E.audio.play(clear ? 'win' : 'lose'); if (clear) E.haptic(J.haptic.clear); else E.shake(...J.shake.over); }
}
function strike(E, n = 1) {
  S.strikes += n; S.streak = 0; S.lastMult = 1;
  if (S.strikes >= T.strikesMax && !S.ended) endShift(E, 'over');
}
function correct(E) {
  S.streak++; S.streakMax = Math.max(S.streakMax, S.streak);
  const m = multiplier();
  if (m > S.lastMult) { S.lastMult = m; pop(E, 'badgePop', J.badgePop); tone(E, J.tones.step, m - 2); }
}
function resolved(E) {
  S.resolved++;
  if (!S.ended && S.resolved === S.bags.length + S.travellers.length) endShift(E, 'clear');
}
function bagDone(E, b, ok) { b.resolved = true; if (ok) correct(E); resolved(E); }

// SWAT: officers drop on the traveller, the belt and lane slow to a crawl for a beat, sirens, a big bonus (larger the earlier the catch).
function callSwat(E, tr, early) {
  if (!tr || tr.swat) return;
  const raw = Math.round(T.swat.bonus * early * scoreMult()), pts = Math.min(raw, Math.max(swatBudget() - S.swatPaid, T.swat.min));
  S.score += pts; S.swatPaid += pts; S.swatCount++;
  const L = layout(E);
  tr.swat = { t: 0, x: tr.x, y: tr.state === 'scan' && tr.beeps ? L.boothTop + LA.boothH * 0.62 : tr.y, pts, line: rngLine(tr.idx) };
  S.swats.push(tr);
  S.slowT = T.swat.slowT; S.sirenT = 0; S.sirenN = J.tones.siren.n;
  if (S.arch === tr) { S.arch = null; if (S.lamp) S.lamp.off = 0; }
  E.shake(...J.shake.swat); E.haptic(J.haptic.swat); E.audio.play('boom');
  S.bannerT = J.banner; S.banner = { text: 'SWAT', color: P.swatRed };
  addFx(`SWAT +${pts}`, tr.x, tr.y - 70, P.catch, true);
  S.log.push({ t: S.time, e: 'swat', who: tr.idx, pts });
}
const swatBudget = () => Math.round(T.swat.capShare * T.goodDay[S.shift - 1]);   // all of a day's SWAT bonuses together
const rngLine = (i) => ['Freeze!', 'Hands up!', 'Down! Now!'][i % 3];
function catchItem(E, b, it) {
  const L = layout(E), f = clamp((b.y + it.y) / S.exitY, 0, 1), early = T.earlyMax + (T.earlyMin - T.earlyMax) * f;
  const pts = Math.round(T.tierBase[it.tier] * early * scoreMult());
  it.state = 1; it.flagT = 0; b.pending--; S.catches++; S.score += pts;
  const big = pts >= J.bigCatch, [x, y] = itemXY(L, b, it);
  E.audio.play('hit'); E.haptic(J.haptic.catch);
  burst(E, x, y, P.catch, big ? J.burst.big : J.burst.catch, J.burstSpeed);
  burst(E, x, y, MT[it.def.mat].fill, J.burst.tint, J.burstSpeed * 0.6);
  if (big) E.shake(...J.shake.big);
  pop(E, 'scorePop', J.pop);
  addFx(f < J.earlyLabel ? `+${pts}, early` : `+${pts}`, BAG_X + it.x, b.y + it.y, P.catch, big);
  S.log.push({ t: S.time, e: 'catch', item: it.name, pts });
  if (b.who === 'smuggler') S.vicCaught = true;
  if (it.tier === 3) callSwat(E, b.tr, early);
  if (b.pending === 0) { b.trayT = 0; b.stampT = 0; b.stamp = 'SEARCH'; tone(E, J.tones.stamp); bagDone(E, b, !b.touched && !b.missed); }
}
function falseAlarm(E, b, it) {
  const L = layout(E), [x, y] = itemXY(L, b, it);
  it.state = 2; it.flagT = 0; b.touched = true; b.flashT = J.bagFlash;
  raiseFalse(E, x, y, BAG_X + it.x, b.y + it.y, it.name);
}
function raiseFalse(E, px, py, ux, uy, name) {
  S.falseAlarms++; S.lockUntil = S.time + T.falseLock;
  for (const t of J.tones.falseAlarm) tone(E, t);
  E.haptic(J.haptic.falseAlarm); E.shake(...J.shake.falseAlarm); E.flash(P.falseAlarm, J.screenFlash);
  burst(E, px, py, P.falseAlarm, J.burst.falseAlarm, J.burstSpeed * 0.7);
  addFx('False alarm', ux, uy, P.falseAlarm);
  S.log.push({ t: S.time, e: 'false', item: name }); S.faNames.push(name);
  strike(E);
}
function missCost(E, tier, name, ghost) {
  S.misses++;
  tone(E, J.tones.miss); E.haptic(J.haptic.miss); E.shake(...J.shake.miss); flash(P.catch);
  S.ghosts.push(ghost);
  S.log.push({ t: S.time, e: 'miss', item: name, tier }); S.missNames.push(name);
  if (tier >= 3) { S.breach = name; endShift(E, 'breach', ghost.item || name); return; }
  strike(E, T.missStrikes[tier]);
}
function missItem(E, b, it) {
  const L = layout(E);
  it.state = 3; b.pending--; b.missed = true;
  burst(E, clamp(L.ox + (BAG_X + it.x) * L.s, 30, E.w - 30), L.bottom - J.cueLift - 20, P.catch, J.burst.miss, J.burstSpeed * 0.5);
  missCost(E, it.tier, it.name, { it, t: 0, label: `Missed: ${it.name}`, item: it.name });
  if (b.pending === 0 && !b.resolved) bagDone(E, b, false);
}
function passBag(E, b) {
  b.passed = true; S.passes++; b.stampT = 0; b.stamp = 'CLEAR';
  const pts = Math.round(T.cleanBase * scoreMult());
  S.score += pts;
  for (const t of J.tones.pass) tone(E, t);
  flash(P.clean);
  addFx(`Clean +${pts}`, T.beltW / 2, 0, P.clean, false, true);
  S.log.push({ t: S.time, e: 'pass', pts });
  bagDone(E, b, true);
}

// ---------- the lane ----------
const scanOn = (tr) => tr.state === 'scan';
function stopTraveller(E, tr, early, ux, uy) {
  const L = layout(E);
  tr.stopped = true;
  let crit = false, sum = 0;
  for (const it of tr.body) if (it.contraband && it.state === 0) {
    it.state = 1; tr.pending--; S.catches++; S.bodyCatches++;
    const pts = Math.round(T.tierBase[it.tier] * early * scoreMult());
    sum += pts; S.score += pts;
    if (it.tier === 3) crit = true;
    S.log.push({ t: S.time, e: 'catch', item: it.name, body: true, pts });
  }
  if (tr.who === 'smuggler') S.vicCaught = true;
  E.audio.play('hit'); E.haptic(J.haptic.catch); pop(E, 'scorePop', J.pop);
  burst(E, L.ox + ux * L.s, uy * L.s, P.catch, J.burst.catch, J.burstSpeed);
  addFx(early >= T.earlyMax - 1e-9 ? `+${sum}, early` : `+${sum}`, ux, uy, P.catch, sum >= J.bigCatch);
  if (crit) callSwat(E, tr, early);
}
function bodyEarly(tr) {
  if (tr.state === 'scan') return T.earlyMax;
  const k = tr.state === 'walkOut' ? clamp(tr.t / walkOutTime(tr), 0, 1) * 0.5 : 0.5 + clamp(tr.t / 4, 0, 0.5);
  return T.earlyMax + (T.earlyMin - T.earlyMax) * k;
}
const walkOutTime = (tr) => Math.max(0.1, tr.walkLen / T.travel.walk);
// A missed body critical ends the day as the traveller leaves the arch area, not the lane; lesser items are judged when they leave the lane.
function archExit(E, tr) {
  tr.archDone = true;
  const crit = tr.stopped || tr.swat ? null : tr.body.find((b) => b.contraband && b.state === 0 && b.tier >= 3);
  if (!crit) return false;
  crit.state = 3; tr.pending--; S.bodyMisses++;
  missCost(E, crit.tier, crit.def.label, { body: crit, tr, t: 0, label: `Missed: ${crit.def.label}`, item: crit.def.item || crit.name });
  return true;
}
// The arch: a traveller with metal sets off a two-tone beep and flashes the light amber; anyone else gets a soft green light.
function archIn(E, tr) {
  S.lamp = { kind: tr.beeps ? 'beep' : 'clear', t: 0, off: -1 };
  if (!tr.beeps) return;
  for (const t of J.tones.beep) tone(E, t);
  E.haptic(J.haptic.beep); S.beeps++;
}
function archOut(L, tr, shown) {
  const TV = T.travel;
  tr.state = 'walkOut'; tr.t = 0; S.arch = null; if (S.lamp) S.lamp.off = 0;
  tr.fadeT = shown ? TV.scanFade : 0;
  const taken = new Set(S.travellers.filter((o) => o !== tr && (o.state === 'walkOut' || o.state === 'wait') && !o.swat).map((o) => o.spot));
  tr.spot = [0, 1, 2].find((k) => !taken.has(k)) ?? tr.idx % 3;
  tr.x = LA.centre; tr.y = L.boothBot; tr.fromX = tr.x; tr.fromY = tr.y;
  tr.walkLen = Math.hypot(LA.spots[tr.spot] - tr.x, L.spotY - tr.y);
}
function leaveLane(E, tr) {
  tr.state = 'leave'; tr.t = 0; tr.resolved = true;
  if (tr.stopped || tr.swat) { resolved(E); return; }
  if (tr.pending > 0) {
    const worst = tr.body.filter((b) => b.contraband && b.state === 0).sort((a, b) => b.tier - a.tier)[0];
    for (const b of tr.body) if (b.contraband && b.state === 0) b.state = 3;
    tr.pending = 0; S.bodyMisses++;
    missCost(E, worst.tier, worst.def.label, { body: worst, tr, t: 0, label: `Missed: ${worst.def.label}`, item: worst.def.item || worst.name });
    if (!S.ended) resolved(E);
    return;
  }
  if (!tr.touched && tr.beeps) {
    const pts = Math.round(T.cleanTraveller * scoreMult());
    S.score += pts; S.passes++;
    S.log.push({ t: S.time, e: 'passT', pts });
    correct(E);
  }
  resolved(E);
}
function laneStep(E, L, dt, walk) {
  const TV = T.travel;
  let prevReleased = true, queuePos = 0;
  for (const tr of S.travellers) {
    if (tr.swat) { tr.swat.t += dt; if (!tr.resolved && tr.swat.t >= T.swat.len) { tr.resolved = true; tr.state = 'gone'; resolved(E); } continue; }
    switch (tr.state) {
      case 'queue': {
        const b = tr.bag, out = b.y + b.h * TV.release >= L.top / L.s && S.time >= TV.firstAt;
        if (prevReleased && !S.arch && out) { tr.state = 'walkIn'; tr.t = 0; S.arch = tr; tr.fromX = tr.x; tr.fromY = tr.y; break; }
        const tx = LA.centre + queuePos * LA.queueStep;
        tr.x += clamp(tx - tr.x, -walk * dt, walk * dt); tr.y = L.queueY;
        queuePos++;
        prevReleased = false;
        continue;
      }
      case 'walkIn': {
        const tx = LA.centre, ty = L.boothTop + 20, d = Math.hypot(tx - tr.x, ty - tr.y), st = walk * dt;
        if (d <= st) { tr.x = tx; tr.y = ty; tr.state = 'scan'; tr.t = 0; tr.scanT0 = S.time; tr.scanned = true; archIn(E, tr); }
        else { tr.x += ((tx - tr.x) / d) * st; tr.y += ((ty - tr.y) / d) * st; }
        break;
      }
      case 'scan':
        tr.t += dt;   // the scan time is not scaled by the lever or the slow-motion: every body item shows at least scanShow
        if (tr.beeps) { if (tr.t >= T.scanShow) { tr.shownFor = tr.t; archOut(L, tr, true); } }
        else { const st = walk * TV.passK * dt; if (L.boothBot - tr.y <= st) archOut(L, tr, false); else tr.y += st; }
        break;
      case 'walkOut': {
        tr.t += dt * (walk / TV.walk);
        const tx = LA.spots[tr.spot], ty = L.spotY - (taken2(tr) ? 18 : 0), d = Math.hypot(tx - tr.x, ty - tr.y), st = walk * dt;
        if (d <= st) { tr.x = tx; tr.y = ty; tr.state = 'wait'; tr.t = 0; } else { tr.x += ((tx - tr.x) / d) * st; tr.y += ((ty - tr.y) / d) * st; }
        if (!tr.archDone && tr.y >= L.boothBot + TV.archExit && archExit(E, tr)) return;
        break;
      }
      case 'wait':
        tr.t += dt;
        if (tr.bag.resolved || tr.bag.gone || tr.bag.settled) leaveLane(E, tr);
        break;
      case 'leave':
        tr.t += dt * (walk / TV.walk);
        tr.y += walk * dt * 0.6;
        if (tr.t >= TV.leave) tr.state = 'gone';
        break;
      default: break;
    }
    if (tr.fadeT > 0) tr.fadeT -= dt;
    if (tr.grumbleT > 0) tr.grumbleT -= dt;
    if (tr.state !== 'queue') { prevReleased = true; }
  }
}
const taken2 = (tr) => S.travellers.some((o) => o !== tr && o.idx < tr.idx && o.spot === tr.spot && (o.state === 'wait' || o.state === 'walkOut') && !o.swat);

function speedK() {
  const sl = S.slowT > 0 ? T.swat.slow + (1 - T.swat.slow) * clamp(1 - S.slowT / T.swat.slowT, 0, 1) ** 2 : 1;
  return (S.lever ? T.rushSpeed : 1) * sl;
}
function step(E) {
  const L = layout(E), dt = T.simStep, k = speedK();
  S.dist += T.beltSpeed[S.shift - 1] * T.tune.belt * k * dt; S.time += dt;
  if (S.lever) S.leverTime += dt;
  if (S.slowT > 0) S.slowT -= dt;
  for (const b of S.bags) {
    if (b.gone) continue;
    b.y = b.y0 + S.dist;
    if (b.y + b.h < 0) continue;
    if (b.pending > 0) for (const it of b.items) if (it.contraband && it.state === 0 && b.y + it.bb.y0 >= S.exitY && !S.ended) missItem(E, b, it);
    if (b.kind === 'clean' && !b.settled && b.y + b.h >= S.exitY && !S.ended) { b.settled = true; if (b.touched) bagDone(E, b, false); else passBag(E, b); }
    if (b.kind === 'contra' && !b.settled && b.pending === 0 && b.y + b.h >= S.exitY) b.settled = true;
    if (b.y >= S.H) { b.gone = true; b.spr = null; }
  }
  if (!S.ended) laneStep(E, L, dt, T.travel.walk * T.tune.pace * k);
}

// A tap resolves to one thing. On the belt: uncaught contraband under the finger wins; else a flagged item swallows it; else the nearest
// harmless item is a false alarm. In the lane: the scan's contraband wins, then a normal body item is a false alarm, then the scanned
// traveller (on the scan or walking) is stopped. Nothing resolves during the false-alarm lock.
function tapAt(E, x, y) {
  if (!S || S.ended) return;
  const L = layout(E), px = (x - L.ox) / L.s, py = y / L.s;
  if (E.hit({ x: L.ox + L.lever.x * L.s, y: L.lever.y * L.s, w: L.lever.w * L.s, h: L.lever.h * L.s }, { x, y })) { pullLever(E); return; }
  if (S.time < S.lockUntil) return;
  if (y > L.bottom) return;
  if (px < T.beltW) { if (y >= L.top) tapBelt(E, px, py); return; }
  tapLane(E, px, py);
}
function tapBelt(E, px, py) {
  let c = null, cd = Infinity, h = null, hd = Infinity, flagged = false;
  for (const b of S.bags) {
    if (b.gone || b.settled || b.trayT >= 0 || b.y >= S.H || b.y + b.h < 0) continue;
    const lx = px - BAG_X, ly = py - b.y;
    for (const it of b.items) {
      const d = shapeDist(lx, ly, it.parts);
      if (d > T.hitMargin) continue;
      const key = d + Math.hypot(lx - it.x, ly - it.y) * 1e-4;
      if (it.state !== 0) flagged = true;
      else if (it.contraband) { if (key < cd) { cd = key; c = [b, it]; } }
      else if (key < hd) { hd = key; h = [b, it]; }
    }
  }
  if (c) catchItem(E, c[0], c[1]);
  else if (!flagged && h) falseAlarm(E, h[0], h[1]);
}
function tapLane(E, px, py) {
  const L = layout(E), sc = L.scan, cur = S.travellers.find((t) => scanOn(t) && t.beeps && !t.swat);
  if (cur && px >= sc.x && px <= sc.x + sc.w && py >= sc.y && py <= sc.y + sc.h) {
    if (cur.stopped || cur.touched) return;
    const lx = (px - sc.cx) / sc.k, ly = (py - sc.cy) / sc.k, m = T.bodyHit / sc.k;
    let c = null, cd = Infinity, h = null, hd = Infinity;
    for (const it of cur.body) {
      const d = shapeDist(lx, ly, it.parts);
      if (d > m) continue;
      if (it.contraband) { if (d < cd) { cd = d; c = it; } } else if (d < hd) { hd = d; h = it; }
    }
    if (c || (!h && cur.pending > 0)) { stopTraveller(E, cur, bodyEarly(cur), px, py); return; }
    travellerFalse(E, cur, px, py, h ? h.name : 'traveller', h);
    return;
  }
  const fw = LA.figW / 2 + T.figureHit, fh = LA.figH + T.figureHit;
  let best = null, bd = Infinity;
  for (const tr of S.travellers) {
    if (!tr.scanned || tr.swat || tr.stopped || tr.touched || tr.state === 'leave' || tr.state === 'gone' || (tr.state === 'scan' && tr.beeps)) continue;
    if (Math.abs(px - tr.x) > fw || py > tr.y + T.figureHit || py < tr.y - fh) continue;
    const d = Math.hypot(px - tr.x, py - (tr.y - LA.figH / 2));
    if (d < bd) { bd = d; best = tr; }
  }
  if (!best) return;
  if (best.pending > 0) stopTraveller(E, best, bodyEarly(best), best.x, best.y - LA.figH);
  else travellerFalse(E, best, px, py, 'traveller', null);
}
function travellerFalse(E, tr, px, py, name, it) {
  const L = layout(E);
  tr.touched = true; tr.grumbleT = J.grumble; tr.fa = it;
  if (it) it.state = 2;
  raiseFalse(E, L.ox + px * L.s, py * L.s, px, py, name);
}
function pullLever(E) {
  S.lever = !S.lever;
  tone(E, S.lever ? J.tones.lever : J.tones.leverOff); E.haptic(J.haptic.catch);
  S.log.push({ t: S.time, e: S.lever ? 'leverOn' : 'leverOff' });
}

// ---------- drawing ----------
// Items are painted in X-ray colours: each part's fill multiplies onto what is under it (overlaps darken, dense parts go black), then its
// darker edge. Only the material decides how a part looks: never the item's name, tier or position.
function paintItem(c, def) {
  pathsOf(def);
  c.lineJoin = 'round';
  c.globalCompositeOperation = 'multiply';
  def.parts.forEach(([m], i) => { c.fillStyle = MT[m].fill; c.fill(def.paths[i]); });
  c.lineWidth = LN.edge;
  def.parts.forEach(([m], i) => { c.strokeStyle = MT[m].edge; c.stroke(def.paths[i]); });
  for (const [m, p] of def.linePaths) { c.strokeStyle = MT[m].edge; c.stroke(p); }
  c.globalCompositeOperation = 'source-over';
}
// The bag itself is a faint outline and its trolley frame (drawn each frame); the items are one sprite cropped to where they lie.
function paintBagItems(c, b) {
  for (const it of b.items) { c.save(); c.translate(it.x, it.y); c.rotate(it.rot * DEG); paintItem(c, it.def); c.restore(); }
}
function itemsBox(b) {
  if (!b.box) { const x0 = Math.min(...b.items.map((i) => i.bb.x0)) - 2, y0 = Math.min(...b.items.map((i) => i.bb.y0)) - 2; b.box = { x0, y0, w: Math.max(...b.items.map((i) => i.bb.x1)) + 2 - x0, h: Math.max(...b.items.map((i) => i.bb.y1)) + 2 - y0 }; }
  return b.box;
}
function drawBagShell(ctx, b) {
  plate(ctx, BAG_X, b.y, b.w, b.h, 18);
  ctx.strokeStyle = MT.fabric.edge; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = alpha(MT.metal.fill, 0.55); ctx.fillRect(BAG_X + 13, b.y + 10, 2.5, b.h - 20); ctx.fillRect(BAG_X + b.w - 15.5, b.y + 10, 2.5, b.h - 20);
}
const canSprite = () => typeof OffscreenCanvas === 'function';
const freeze = (cv) => (typeof cv.transferToImageBitmap === 'function' ? cv.transferToImageBitmap() : cv);
const spriteScale = (E, L) => L.s * Math.min(E.dpr || 1, T.sprite.maxDpr);
const bagSpriteOk = (E, L, b) => !canSprite() || !!(b.spr && b.spr.k === spriteScale(E, L));
// Painted `per` items at a time across frames (a whole bag at a high pixel ratio is too much for one frame); true when finished.
function makeBagSprite(E, L, b, per = Infinity) {
  if (!canSprite()) return true;
  const k = spriteScale(E, L), bx = itemsBox(b);
  if (!b.wip || b.wip.k !== k) {
    const cv = new OffscreenCanvas(Math.ceil(bx.w * k), Math.ceil(bx.h * k)), c = cv.getContext('2d');
    c.scale(k, k); c.translate(-bx.x0, -bx.y0);
    b.wip = { cv, c, k, i: 0 };
  }
  const w = b.wip;
  for (let n = 0; n < per && w.i < b.items.length; n++, w.i++) { const it = b.items[w.i]; w.c.save(); w.c.translate(it.x, it.y); w.c.rotate(it.rot * DEG); paintItem(w.c, it.def); w.c.restore(); }
  if (w.i < b.items.length) return false;
  b.spr = { cv: freeze(w.cv), k, w: Math.ceil(bx.w * k) / k, h: Math.ceil(bx.h * k) / k };
  b.wip = null;
  return true;
}
function ensureSprites(E, L) {
  if (!canSprite()) return;
  let n = T.sprite.perFrame;
  for (const b of S.bags) {
    if (b.gone || b.y + b.h < L.top / L.s - T.sprite.ahead) continue;
    if (b.y < -T.sprite.ahead * 4 - b.h * 2) break;
    if (!bagSpriteOk(E, L, b)) { if (n-- <= 0) return; makeBagSprite(E, L, b, T.sprite.items); return; }
  }
  for (const tr of S.travellers) if (tr.beeps && (tr.state === 'walkIn' || tr.state === 'queue') && tr === S.travellers.find((t) => t.state === 'queue' || t.state === 'walkIn') && !scanSpriteOk(E, L, tr)) { if (n-- <= 0) return; makeScanSprite(E, L, tr); }
}

function drawBelt(ctx, E, L) {
  const W = T.beltW, H = L.H;
  if (L.ox > 0) { ctx.fillStyle = P.bg; ctx.fillRect(-L.ox / L.s - 1, 0, L.ox / L.s + 1, H); ctx.fillRect(T.designW, 0, L.ox / L.s + 1, H); }   // letterbox on wide screens
  ctx.fillStyle = P.roller;
  for (let y = (S.dist % 40) - 40 + L.top / L.s; y < H; y += 40) ctx.fillRect(2, y, W - 4, 1.5);
}
function drawItemFlag(ctx, b, it) {
  if (it.state !== 1 && it.state !== 2) return;
  const color = it.state === 1 ? P.catch : P.falseAlarm;
  pathsOf(it.def);
  ctx.save(); ctx.translate(BAG_X + it.x, b.y + it.y); ctx.rotate(it.rot * DEG);
  ctx.lineJoin = 'round';
  if (it.state === 2) { ctx.strokeStyle = P.falseEdge; ctx.lineWidth = LN.flag + 3; ctx.stroke(it.def.outline); }
  ctx.strokeStyle = color; ctx.lineWidth = LN.flag; ctx.stroke(it.def.outline);
  ctx.restore();
  const k = it.flagT < 0 ? 1 : clamp(it.flagT / J.ringSnap, 0, 1), r = it.def.rad + 8 + J.ringFrom * (1 - ease.outBack(k));
  ctx.globalAlpha = Math.min(1, 0.3 + k * 3);
  if (it.state === 2) { ctx.strokeStyle = P.falseEdge; ctx.lineWidth = LN.ring + 3; ctx.beginPath(); ctx.arc(BAG_X + it.x, b.y + it.y, r, 0, Math.PI * 2); ctx.stroke(); }
  ctx.strokeStyle = color; ctx.lineWidth = LN.ring; ctx.beginPath(); ctx.arc(BAG_X + it.x, b.y + it.y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1;
}
function drawBag(ctx, E, L, b) {
  const cx = BAG_X + b.w / 2, cy = b.y + b.h / 2;
  ctx.save();
  if (b.trayT >= 0) {
    const k = clamp(b.trayT / J.tray, 0, 1), e = ease.inQuad(clamp((b.trayT - J.bagStamp) / J.tray, 0, 1));
    ctx.globalAlpha = 1 - 0.6 * k;
    ctx.translate(-e * J.trayDist + cx, cy); ctx.rotate(-J.trayTilt * e); ctx.translate(-cx, -cy);
  }
  drawBagShell(ctx, b);
  if (b.spr) { const bx = itemsBox(b); ctx.imageSmoothingEnabled = b.trayT >= 0; ctx.drawImage(b.spr.cv, BAG_X + bx.x0, b.y + bx.y0, b.spr.w, b.spr.h); }   // a plain copy is exact; the sliding bag is smoothed
  else { ctx.save(); ctx.translate(BAG_X, b.y); paintBagItems(ctx, b); ctx.restore(); }
  for (const it of b.items) drawItemFlag(ctx, b, it);
  if (b.touched || b.passed) { plate(ctx, BAG_X, b.y, b.w, b.h, 18); ctx.strokeStyle = b.touched ? P.falseAlarm : P.clean; ctx.lineWidth = 4; ctx.stroke(); }
  if (b.flashT > 0) { plate(ctx, BAG_X, b.y, b.w, b.h, 18); ctx.fillStyle = alpha(P.falseAlarm, 0.35 * (b.flashT / J.bagFlash)); ctx.fill(); }
  // the colour tag on the handle, shared with the traveller
  E.roundRect(BAG_X + b.w / 2 - 14, b.y - 6, 28, 16, 4, b.tr ? b.tr.tag : P.dim, P.ink);
  if (b.stampT >= 0) drawBagStamp(ctx, E, b);
  ctx.restore();
}
function drawBagStamp(ctx, E, b) {
  const k = clamp(b.stampT / J.bagStamp, 0, 1), sc = 1 + 1.4 * (1 - ease.outQuad(k)), color = b.stamp === 'CLEAR' ? P.clean : P.catch;
  ctx.save(); ctx.translate(BAG_X + b.w / 2, b.y + b.h / 2); ctx.rotate(-0.22); ctx.scale(sc, sc); ctx.globalAlpha = Math.min(1, k * 3) * 0.92;
  ctx.font = `800 ${TY.medium + 6}px system-ui, sans-serif`;
  const w = ctx.measureText(b.stamp).width + 24;
  ctx.strokeStyle = color; ctx.lineWidth = 4; plate(ctx, -w / 2, -20, w, 40, 6); ctx.stroke();
  txt(E, b.stamp, 0, 1, TY.medium + 6, color, { weight: '800' });
  ctx.restore();
  ctx.globalAlpha = 1;
}

// The lane floor and the scanner arch never change, so they are painted once and copied.
// The lane: a floor, tile seams and the scanner arch, all axis-aligned fills (at a high pixel ratio a stroked path costs far more than a fill).
function drawLaneBase(ctx, E, L) {
  const x0 = T.beltW, w = T.designW - x0, top = L.laneTop, h = L.H - top;
  ctx.fillStyle = P.floor; ctx.fillRect(x0, top, w, h);
  ctx.fillStyle = P.tile;
  for (let y = top + 20; y < top + h; y += 28) ctx.fillRect(x0, y, w, 1);
  ctx.fillStyle = alpha(P.boothHi, 0.2); ctx.fillRect(x0, top, 3, h); ctx.fillRect(x0 + 6, L.B - 6, w - 12, 3);
  const bx = LA.boothX, bw = LA.boothW, by = L.boothTop, bh = LA.boothH;
  ctx.fillStyle = P.boothDark; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = P.booth; ctx.fillRect(bx - 4, by - 14, 8, bh + 14); ctx.fillRect(bx + bw - 4, by - 14, 8, bh + 14); ctx.fillRect(bx - 4, by - 16, bw + 8, 14);
  ctx.fillStyle = P.boothHi; ctx.fillRect(bx - 4, by - 16, bw + 8, 2); ctx.fillRect(bx - 4, by - 14, 2, bh + 14); ctx.fillRect(bx + bw + 2, by - 14, 2, bh + 14);
  ctx.fillStyle = alpha(P.boothHi, 0.12); ctx.fillRect(bx - 10, by + bh, bw + 20, 6);
}
// The arch light on the top beam: amber flashes with the beep (and frames the scan), a soft green says nothing to check. Both fade after the traveller steps out.
function drawLamp(ctx, L) {
  const bx = LA.boothX, bw = LA.boothW, by = L.boothTop, lp = S.lamp, sc = L.scan;
  ctx.fillStyle = P.lampOff; ctx.fillRect(bx + 6, by - 13, bw - 12, 9);
  if (!lp) return;
  const fade = lp.off < 0 ? 1 : Math.max(0, 1 - lp.off / T.beep.fade), beep = lp.kind === 'beep', k = fade * (beep ? (Math.floor(lp.t * T.beep.hz) % 2 === 0 ? 1 : 0.3) : 0.75);
  if (k <= 0) return;
  ctx.fillStyle = beep ? P.lampAmber : P.lampGreen;
  ctx.globalAlpha = k; ctx.fillRect(bx + 6, by - 13, bw - 12, 9);
  ctx.globalAlpha = k * 0.22; ctx.fillRect(bx - 8, by - 28, bw + 16, 38);
  ctx.globalAlpha = k * (beep ? 0.55 : 0.3); ctx.fillRect(bx - 4, by - 14, 8, LA.boothH + 14); ctx.fillRect(bx + bw - 4, by - 14, 8, LA.boothH + 14);
  if (beep) { ctx.globalAlpha = k; ctx.fillRect(sc.x - 3, sc.y - 3, sc.w + 6, 3); ctx.fillRect(sc.x - 3, sc.y + sc.h, sc.w + 6, 3); ctx.fillRect(sc.x - 3, sc.y, 3, sc.h); ctx.fillRect(sc.x + sc.w, sc.y, 3, sc.h); }
  ctx.globalAlpha = 1;
}
// The body scan: the screen, the hands-up silhouette, then the body items where they are worn, all in the X-ray palette.
let silPath = null;
function paintScan(c, tr, w, h, cx, cy, k) {
  c.fillStyle = P.screen; c.fillRect(0, 0, w, h);
  c.save(); c.translate(cx, cy); c.scale(k, k);
  if (!silPath) silPath = polyPath(SILHOUETTE);
  c.lineJoin = 'round';
  c.strokeStyle = MT.skin.edge; c.lineWidth = 3; c.stroke(silPath);   // stroked wide, then filled over, so only the outer outline shows
  c.fillStyle = MT.skin.fill; c.fill(silPath, 'nonzero');
  c.globalCompositeOperation = 'multiply';
  for (const it of tr.body) {
    pathsOf(it.def);
    c.save(); c.translate(it.x, it.y); c.rotate((it.def.rot || 0) * DEG);
    it.def.parts.forEach(([m], i) => { c.fillStyle = MT[m].fill; c.fill(it.def.paths[i]); });
    c.lineWidth = 1;
    it.def.parts.forEach(([m], i) => { c.strokeStyle = MT[m].edge; c.stroke(it.def.paths[i]); });
    c.restore();
  }
  c.globalCompositeOperation = 'source-over';
  c.restore();
}
const scanSpriteOk = (E, L, tr) => !canSprite() || !!(tr.spr && tr.spr.k === spriteScale(E, L));
function makeScanSprite(E, L, tr) {
  if (!canSprite()) return;
  const sc = L.scan, k = spriteScale(E, L), cv = new OffscreenCanvas(Math.ceil(sc.w * k), Math.ceil(sc.h * k)), c = cv.getContext('2d');
  c.scale(k, k); paintScan(c, tr, sc.w, sc.h, sc.cx - sc.x, sc.cy - sc.y, sc.k);
  tr.spr = { cv: freeze(cv), k };
}
// The body scan shows only for a traveller who beeped (PRD v0.2 J1): its opacity is 0 for everyone else.
const scanAlpha = (tr) => (!tr.beeps ? 0 : tr.state === 'scan' && !tr.swat ? Math.min(1, tr.t / 0.12) : tr.fadeT > 0 ? tr.fadeT / T.travel.scanFade : 0);
function drawScan(ctx, E, L) {
  const sc = L.scan;
  for (const tr of S.travellers) {
    const on = tr.state === 'scan' && !tr.swat, a = scanAlpha(tr);
    if (a <= 0) continue;
    ctx.globalAlpha = a;
    if (!scanSpriteOk(E, L, tr)) makeScanSprite(E, L, tr);
    if (tr.spr) { ctx.imageSmoothingEnabled = false; ctx.drawImage(tr.spr.cv, sc.x, sc.y, sc.w, sc.h); }
    else { ctx.save(); ctx.translate(sc.x, sc.y); paintScan(ctx, tr, sc.w, sc.h, sc.cx - sc.x, sc.cy - sc.y, sc.k); ctx.restore(); }
    // a scan line sweeping down while it shows
    if (on) { const y = sc.y + ((tr.t / 0.9) % 1) * sc.h; ctx.fillStyle = alpha(P.metal, 0.25); ctx.fillRect(sc.x, y, sc.w, 3); }
    for (const it of tr.body) if (it.state === 1 || it.state === 2) {
      ctx.save(); ctx.translate(sc.cx + it.x * sc.k, sc.cy + it.y * sc.k);
      ctx.strokeStyle = it.state === 1 ? P.catch : P.falseEdge; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.stroke();
      if (it.state === 2) { ctx.strokeStyle = P.falseAlarm; ctx.lineWidth = 2; ctx.stroke(); }
      ctx.restore();
    }
    if (tr.stopped || tr.touched) { ctx.strokeStyle = tr.stopped ? P.catch : P.falseAlarm; ctx.lineWidth = 3; ctx.strokeRect(sc.x + 1.5, sc.y + 1.5, sc.w - 3, sc.h - 3); }
    ctx.globalAlpha = 1;
  }
}
// A small traveller: legs, coat, head, hair and the colour tag; characters add their own touches. Flavour never depends on what they carry.
function drawPerson(ctx, E, x, y, lk, tag, walking, t, extra = {}) {
  const sw = walking ? Math.sin(t * 9) * 4 : 0;
  ctx.fillStyle = '#1d2433';
  if (!extra.noLegs) { ctx.fillRect(x - 7 + sw * 0.4, y - 20, 5, 20); ctx.fillRect(x + 2 - sw * 0.4, y - 20, 5, 20); }
  ctx.fillStyle = lk.coat; plate(ctx, x - 11, y - 44, 22, 27, 6); ctx.fill();
  if (lk.dots) { ctx.fillStyle = '#ffe9a8'; for (const [dx, dy] of [[-6, -38], [4, -34], [-3, -26], [6, -24]]) ctx.fillRect(x + dx, y + dy, 3, 3); }
  if (lk.tie) { ctx.fillStyle = '#f2f2f2'; ctx.beginPath(); ctx.moveTo(x - 4, y - 44); ctx.lineTo(x + 4, y - 44); ctx.lineTo(x, y - 36); ctx.fill(); ctx.fillStyle = lk.tie; ctx.fillRect(x - 1.5, y - 40, 3, 12); }
  ctx.fillStyle = lk.skin; ctx.beginPath(); ctx.arc(x, y - 51, 7.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = lk.hair; ctx.beginPath(); ctx.arc(x, y - 53, 7.5, Math.PI, 0); ctx.fill();
  if (lk.bun) { ctx.beginPath(); ctx.arc(x, y - 61, 4, 0, Math.PI * 2); ctx.fill(); }
  if (lk.cap) { ctx.fillStyle = lk.cap; ctx.fillRect(x - 8, y - 60, 16, 5); ctx.fillRect(x - 1, y - 57, 11, 3); }
  if (lk.hat) { ctx.fillStyle = lk.hat; ctx.fillRect(x - 11, y - 57, 22, 3); ctx.fillRect(x - 6, y - 63, 12, 6); }
  const look = lk.glance ? Math.sin(t * 2.3) * 2 : 0;
  if (lk.shades) { ctx.fillStyle = '#05060a'; ctx.fillRect(x - 6, y - 53, 12, 4); }
  else { ctx.fillStyle = '#1a1a1a'; ctx.fillRect(x - 3.5 + look, y - 52, 2, 2); ctx.fillRect(x + 1.5 + look, y - 52, 2, 2); if (lk.specs) { ctx.strokeStyle = '#cfd6e0'; ctx.lineWidth = 1; ctx.strokeRect(x - 5 + look, y - 53.5, 4, 4); ctx.strokeRect(x + 1 + look, y - 53.5, 4, 4); } }
  if (lk.sweat && !extra.still) { ctx.fillStyle = '#9fd8ff'; const k = (t * 1.3) % 1; ctx.fillRect(x + 7, y - 56 + k * 8, 2, 3); }
  E.roundRect(x - 5, y - 40, 10, 12, 2, tag, P.ink);
  if (extra.ring) { ctx.strokeStyle = extra.ring; ctx.lineWidth = 3; plate(ctx, x - 15, y - 66, 30, 70, 8); ctx.stroke(); }
}
// A walking traveller is a cached sprite of the figure (painted once) plus two leg fills, so a full lane costs a few copies a frame.
function personSprite(E, L, tr) {
  const k = spriteScale(E, L);
  if (!canSprite()) return null;
  if (!tr.fig || tr.fig.k !== k || tr.fig.ring !== tr.ring) {
    const cv = new OffscreenCanvas(Math.ceil(36 * k), Math.ceil(76 * k)), c = cv.getContext('2d');
    c.scale(k, k); drawPerson(c, E, 18, 72, tr.look, tr.tag, false, 0, { ring: tr.ring, noLegs: true, still: true });
    tr.fig = { cv: freeze(cv), k, ring: tr.ring };
  }
  return tr.fig;
}
function drawTravellers(ctx, E, L) {
  const list = S.travellers.filter((t) => t.state !== 'gone' && (t.state !== 'scan' || !t.beeps) && (t.state !== 'queue' || t.x < T.designW + 12)).sort((a, b) => a.y - b.y);
  for (const tr of list) {
    if (tr.swat) continue;
    const walking = tr.state === 'walkIn' || tr.state === 'walkOut' || tr.state === 'leave' || tr.state === 'scan' || (tr.state === 'queue' && Math.abs(tr.x - (LA.centre)) > 1);
    const a = tr.state === 'leave' ? 1 - clamp(tr.t / T.travel.leave, 0, 1) : 1;
    if (a <= 0) continue;
    ctx.globalAlpha = a;
    tr.ring = tr.stopped ? P.catch : tr.touched ? P.falseAlarm : null;
    const fig = personSprite(E, L, tr), t = S.time + tr.idx;
    if (fig) {
      const sw = walking ? Math.sin(t * 9) * 4 : 0;
      ctx.fillStyle = '#1d2433'; ctx.fillRect(tr.x - 7 + sw * 0.4, tr.y - 20, 5, 20); ctx.fillRect(tr.x + 2 - sw * 0.4, tr.y - 20, 5, 20);
      ctx.imageSmoothingEnabled = false; ctx.drawImage(fig.cv, tr.x - 18, tr.y - 72, 36, 76);
      if (tr.look.sweat) { ctx.fillStyle = '#9fd8ff'; ctx.fillRect(tr.x + 7, tr.y - 56 + ((t * 1.3) % 1) * 8, 2, 3); }
    } else drawPerson(ctx, E, tr.x, tr.y, tr.look, tr.tag, walking, t, { ring: tr.ring });
    ctx.globalAlpha = 1;
    if (tr.grumbleT > 0) speech(ctx, E, tr.x, tr.y - 74, tr.idx % 2 ? 'Seriously?' : 'Ugh!');
  }
}
function speech(ctx, E, x, y, s) {
  ctx.font = `${TY.weight} ${TY.small}px system-ui, sans-serif`;
  const w = ctx.measureText(s).width + 14, cx = clamp(x, T.beltW + w / 2 + 2, T.designW - w / 2 - 2);
  E.roundRect(cx - w / 2, y - 12, w, 24, 8, '#f2f2f2', P.ink);
  txt(E, s, cx, y, TY.small, P.ink);
}
// SWAT: officers drop on ropes, tackle, pin, then drag the traveller off. Lights wash the lane red and blue.
function drawSwat(ctx, E, L) {
  const W = T.swat, Z = W.zoom;
  for (const tr of S.swats) {
    const s = tr.swat;
    if (s.t > W.len) continue;
    const drag = s.t > W.drag ? (s.t - W.drag) / (W.len - W.drag) : 0, x = s.x + ease.inQuad(drag) * 120, y = s.y;
    const fall = clamp((s.t - W.drop) / (W.tackle - W.drop), 0, 1), drop = clamp(s.t / W.drop, 0, 1);
    if (s.t < W.drop + 0.08) { ctx.fillStyle = alpha('#ffffff', 0.5 * (1 - s.t / (W.drop + 0.08))); ctx.fillRect(T.beltW, L.laneTop, T.designW - T.beltW, L.H - L.laneTop); }
    ctx.save(); ctx.translate(x, y); ctx.scale(Z, Z); ctx.translate(-x, -y);
    ctx.save(); ctx.translate(x, y); ctx.rotate(-Math.PI / 2 * ease.outQuad(fall)); ctx.translate(-x, -y);
    drawPerson(ctx, E, x, y, tr.look, tr.tag, false, 0, { ring: P.catch });
    ctx.restore();
    for (let i = 0; i < 3; i++) {
      const side = i - 1, ox = x + side * 20 * (1 - fall * 0.4) - (i === 1 ? 14 * fall : 0), oy = y - (1 - ease.outQuad(drop)) * ((y - L.laneTop) / Z + 40) + (i === 1 ? -6 : 0);
      if (drop < 1) { ctx.strokeStyle = '#9aa4b2'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ox, y - (y - L.laneTop) / Z - 40); ctx.lineTo(ox, oy - 56); ctx.stroke(); }
      officer(ctx, E, ox, oy);
    }
    ctx.restore();
    if (s.t > W.drop && s.t < W.drag) speech(ctx, E, x - 10, y - 70 * Z - 18, s.line);
  }
}
function officer(ctx, E, x, y) {
  ctx.fillStyle = P.officer;
  ctx.fillRect(x - 7, y - 20, 5, 20); ctx.fillRect(x + 2, y - 20, 5, 20);
  plate(ctx, x - 12, y - 45, 24, 28, 5); ctx.fill();
  ctx.fillStyle = P.vest; ctx.fillRect(x - 9, y - 41, 18, 16);
  ctx.fillStyle = '#e8edf5'; ctx.fillRect(x - 7, y - 36, 14, 3);
  ctx.fillStyle = P.officer; ctx.beginPath(); ctx.arc(x, y - 52, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2a3242'; ctx.fillRect(x - 6, y - 54, 12, 3);
}
function drawLever(ctx, E, L) {
  const lv = L.lever, on = S.lever, k = S.leverAnim, cx = lv.x + lv.w / 2;
  E.roundRect(lv.x, lv.y, lv.w, lv.h, 10, on ? '#3a1c06' : P.leverOff, on ? P.lever : P.bagEdge);
  if (on) { ctx.save(); plate(ctx, lv.x + 4, lv.y + 4, lv.w - 8, lv.h - 8, 6); ctx.clip(); ctx.fillStyle = alpha(P.lever, 0.35); for (let i = -6; i < 12; i++) { ctx.beginPath(); ctx.moveTo(lv.x + i * 14 + ((S.time * 40) % 28), lv.y); ctx.lineTo(lv.x + i * 14 + 8 + ((S.time * 40) % 28), lv.y); ctx.lineTo(lv.x + i * 14 - 30 + ((S.time * 40) % 28), lv.y + lv.h); ctx.lineTo(lv.x + i * 14 - 38 + ((S.time * 40) % 28), lv.y + lv.h); ctx.fill(); } ctx.restore(); }
  ctx.fillStyle = '#05080f'; ctx.fillRect(cx - 3, lv.y + 30, 6, lv.h - 44);
  const ky = lv.y + 34 + (lv.h - 54) * k;
  ctx.strokeStyle = '#c9d3dc'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx, lv.y + lv.h / 2); ctx.lineTo(cx, ky); ctx.stroke();
  ctx.fillStyle = on ? P.lever : '#c9d3dc'; ctx.beginPath(); ctx.arc(cx, ky, 11, 0, Math.PI * 2); ctx.fill();
  txt(E, 'RUSH', cx, lv.y + 13, TY.small, on ? P.lever : P.dim);
  if (on) txt(E, `x${T.rushMult}`, cx, lv.y - 12, TY.small, P.lever);
}

let hoodTex = null;
function paintHood(c, x, w, h) {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, P.hood); g.addColorStop(1, P.strip);
  c.fillStyle = g; c.fillRect(x, 0, w, h);
  c.fillStyle = alpha(P.metal, 0.6); c.fillRect(x, h - 2, w, 2);
  c.fillStyle = P.hoodLip; c.fillRect(x, 0, w, 2);
  const n = 10, sw = (w - 8) / n;
  c.fillStyle = alpha(P.strip, 0.96); c.beginPath();
  for (let i = 0; i < n; i++) c.rect(x + 4 + i * sw + 1.5, h - 1, sw - 3, 8);
  c.fill();
  c.font = `${TY.weight} ${TY.small}px system-ui, sans-serif`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = P.dim;
  c.fillText('X-RAY', x + 14, h / 2 - 2);
}
function drawHood(E, L) {
  const ctx = E.ctx, x = L.ox, w = T.beltW * L.s, h = L.top - L.hud, dpr = E.dpr || 1;
  if (canSprite()) {
    if (!hoodTex || hoodTex.w !== w || hoodTex.h !== h || hoodTex.dpr !== dpr) {
      const cv = new OffscreenCanvas(Math.ceil(w * dpr), Math.ceil((h + 8) * dpr)), c = cv.getContext('2d');
      c.scale(cv.width / w, cv.height / (h + 8)); paintHood(c, 0, w, h);
      hoodTex = { w, h, dpr, cv: freeze(cv) };
    }
    ctx.drawImage(hoodTex.cv, x, L.hud, w, h + 8);
  } else { ctx.save(); ctx.translate(0, L.hud); paintHood(ctx, x, w, h); ctx.restore(); }
  if (S.rush && !(S.bannerT > 0)) txt(E, 'RUSH', x + w - 14, (L.hud + L.top) / 2 - 2, TY.small, P.organic, { align: 'right', alpha: 0.6 + 0.4 * Math.sin(E.time * 6) });
  const who = S.travellers.find((t) => t.state === 'scan' && t.who);
  if (who) txt(E, T.characters[who.who].name, L.ox + (LA.boothX + LA.boothW / 2) * L.s, (L.boothBot + 14) * L.s, TY.small, P.text);
}

function drawHud(E, L) {
  const ctx = E.ctx, top = E.safe.top, cy = top + 28, m = multiplier(), cx = E.w / 2;
  fillBox(E, 0, 0, E.w, L.hud, alpha(P.bg, 0.96));
  ctx.save(); ctx.translate(16 + E.safe.left, cy); ctx.scale(1 + J.popSize * S.scorePop, 1 + J.popSize * S.scorePop);
  txt(E, String(S.score), 0, 0, TY.large, P.text, { align: 'left' });
  ctx.restore();
  ctx.save(); ctx.translate(cx, cy); ctx.scale(1 + J.badgeSize * S.badgePop, 1 + J.badgeSize * S.badgePop);
  E.roundRect(-44, -20, 88, 40, 10, m > 1 ? P.badgeHot : P.badge, m > 1 ? P.organic : P.bagEdge);
  txt(E, 'Streak', 0, -9, TY.small, m > 1 ? P.organic : P.dim);
  txt(E, `x${m}`, 0, 9, TY.medium, m > 1 ? P.organic : P.text);
  ctx.restore();
  const next = T.streakSteps.find((n) => S.streak < n);
  if (next) { const prev = [0, ...T.streakSteps].filter((n) => n <= S.streak).pop(); fillBox(E, cx - 40, cy + 22, 80 * ((S.streak - prev) / (next - prev)), 3, P.organic); }
  for (let i = 0; i < T.strikesMax; i++) {
    const x = E.w - 16 - E.safe.right - (T.strikesMax - i) * 28 + 4, used = i < S.strikes;
    E.roundRect(x, cy - 12, 24, 24, 6, used ? P.strikeOn : P.badge, used ? P.catch : P.bagEdge);
    if (used) { ctx.strokeStyle = P.catch; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 6, cy - 6); ctx.lineTo(x + 18, cy + 6); ctx.moveTo(x + 18, cy - 6); ctx.lineTo(x + 6, cy + 6); ctx.stroke(); }
  }
  fillBox(E, 0, L.hud - 3, E.w * (S.resolved / (S.bags.length + S.travellers.length)), 3, P.bagEdge);
}
function drawStamp(E) {
  const st = S.stamp;
  if (!st) return;
  const ctx = E.ctx, k = clamp(st.t / J.stampT, 0, 1), sc = 1 + (J.stampFrom - 1) * (1 - ease.outQuad(k));
  ctx.font = `${TY.weight} ${TY.large}px system-ui, sans-serif`;
  const w = ctx.measureText(st.text).width + 40, h = TY.large + 28;
  ctx.save(); ctx.translate(E.w / 2, E.h * 0.4); ctx.rotate(-0.16); ctx.scale(sc * 1.15, sc * 1.15); ctx.globalAlpha = Math.min(1, k * 4);
  E.roundRect(-w / 2, -h / 2, w, h, 10, alpha(P.bg, 0.85), st.color);
  ctx.strokeStyle = alpha(st.color, 0.5); ctx.lineWidth = 1.5; plate(ctx, -w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 6); ctx.stroke();
  txt(E, st.text, 0, 1, TY.large, st.color);
  if (k >= 1) { const r = clamp((st.t - J.stampT) / 0.35, 0, 1); ctx.globalAlpha = 1 - r; ctx.strokeStyle = st.color; ctx.lineWidth = 3; plate(ctx, -w / 2 - r * 30, -h / 2 - r * 30, w + r * 60, h + r * 60, 10 + r * 20); ctx.stroke(); }
  ctx.restore();
  ctx.globalAlpha = 1;
}
function pill(E, text, x, y, size, color, a) {
  const ctx = E.ctx;
  ctx.font = `${TY.weight} ${size}px system-ui, sans-serif`;
  const w = ctx.measureText(text).width + 16;
  ctx.globalAlpha = a; E.roundRect(x - w / 2, y - size / 2 - 6, w, size + 12, 8, P.pill); ctx.globalAlpha = 1;
  txt(E, text, x, y, size, color, { alpha: a });
}

// Banners (RUSH HOUR, SWAT) sit in the hood strip above the belt, so they never cover the belt's top band where bags come in; the pill is size + 12 tall.
const bannerSpot = (L) => ({ x: L.ox + (T.beltW * L.s) / 2, y: (L.hud + L.top) / 2, size: TY.medium });
const prune = (list, life) => { for (let i = list.length - 1; i >= 0; i--) if (list[i].t >= life) list.splice(i, 1); };

const play = {
  enter(E, params = {}) {
    startShift(E, params.shift || 1, params.seed ?? ((E.rng() * 2 ** 32) >>> 0));
    S.live = true;
  },
  exit() { if (S) S.live = false; },
  update(dt, E) {
    const L = layout(E);
    S.H = L.H; S.exitY = L.B;
    S.frames++; if (S.frames > 12) { S.timed++; if (dt > 0.024) S.slow++; }
    ensureSprites(E, L);
    for (const f of S.fx) f.t += dt;
    prune(S.fx, J.fxLife);
    for (const g of S.ghosts) g.t += dt;
    prune(S.ghosts, J.ghostLife);
    for (const r of S.ripples) r.t += dt;
    prune(S.ripples, J.ripple);
    if (S.flashT > 0) S.flashT -= dt;
    if (S.bannerT > 0) S.bannerT -= dt;
    if (S.lamp) { S.lamp.t += dt; if (S.lamp.off >= 0) S.lamp.off += dt; }
    if (S.stamp) S.stamp.t += dt;
    S.leverAnim += ((S.lever ? 1 : 0) - S.leverAnim) * Math.min(1, dt * 14);
    for (const b of S.bags) {
      if (b.gone) continue;
      if (b.flashT > 0) b.flashT -= dt;
      if (b.trayT >= 0) b.trayT += dt;
      if (b.stampT >= 0) b.stampT += dt;
      for (const it of b.items) if (it.flagT >= 0) it.flagT += dt;
      if (S.rush && !b.shown && b.idx % T.burst.size === 0 && b.y + b.h * 0.4 >= L.top / L.s) { b.shown = true; S.bannerT = J.banner; S.banner = { text: 'RUSH HOUR', color: P.organic }; if (!S.ended) tone(E, J.tones.rush); }
    }
    if (S.sirenN > 0) {
      S.sirenT -= dt;
      if (S.sirenT <= 0) { const sr = J.tones.siren; S.sirenT += sr.every; S.sirenN--; E.audio.beep({ freq: S.sirenN % 2 ? sr.hi : sr.lo, dur: sr.dur, type: sr.type, gain: sr.gain }); }
    }
    if (S.ended) {
      if (S.ended === 'breach') {
        const kx = J.tones.klaxon, n = Math.floor(S.endT / kx.every);
        if (n < kx.n && n >= (S.alarmN || 0)) { S.alarmN = n + 1; E.audio.beep({ freq: n % 2 ? kx.hi : kx.lo, dur: kx.dur, type: kx.type, gain: kx.gain }); }
      }
      pump(E);
      S.endT += dt;
      for (const tr of S.swats) tr.swat.t += dt;
      if (S.endT >= (S.ended === 'breach' ? J.breachDelay : J.endDelay) && !S.finished) { S.finished = true; E.setScene('over', S.result); }
      return;
    }
    S.humT -= dt;
    if (S.humT <= 0) {
      S.humT += J.hum.every;
      const H = J.hum;
      E.audio.beep({ freq: (H.base + H.step * Math.min(S.streak, H.maxStreak)) * (S.lever ? H.lever : 1) * (S.slowT > 0 ? 0.6 : 1), dur: H.every * 1.6, type: 'triangle', gain: H.gain * (S.rush ? H.rush : 1) * (S.lever ? H.leverGain : 1) });
    }
    S.acc += dt;
    while (S.acc >= T.simStep - 1e-9 && !S.ended) { S.acc -= T.simStep; step(E); }
  },
  onPointerDown(p, E) {
    if (S.ripples.length < J.rippleMax && !S.ended && p.y >= layout(E).hud) S.ripples.push({ x: p.x, y: p.y, t: 0 });
    tapAt(E, p.x, p.y);
  },
  onPause(E) {
    if (S && !S.ended && E.ledger) E.ledger.add('quit', { shift: S.shift, seed: S.seed, score: S.score, bag: S.bags.filter((b) => b.resolved).length });
    if (S && !S.ended) E.setScene('menu');
  },
  render(ctx, E) {
    const L = layout(E);
    ctx.save();
    ctx.translate(L.ox, 0); ctx.scale(L.s, L.s);
    drawBelt(ctx, E, L);
    for (const b of S.bags) if (!b.gone && b.y < L.H && b.y + b.h >= 0 && !(b.trayT >= J.tray + J.bagStamp)) drawBag(ctx, E, L, b);
    drawLaneBase(ctx, E, L);
    drawLamp(ctx, L);
    drawScan(ctx, E, L);
    drawTravellers(ctx, E, L);
    drawSwat(ctx, E, L);
    if (S.swats.some((t) => t.swat.t < T.swat.len)) {   // red and blue lights wash the lane
      const red = Math.floor(E.time * 6) % 2 === 0;
      ctx.fillStyle = alpha(red ? P.swatRed : P.swatBlue, 0.16); ctx.fillRect(T.beltW, L.laneTop, T.designW - T.beltW, L.H - L.laneTop);
    }
    drawLever(ctx, E, L);
    ctx.restore();
    drawHood(E, L);
    if (S.flashT > 0) { ctx.globalAlpha = Math.min(1, S.flashT / J.flashLife) * 0.9; ctx.fillStyle = S.flashColor; ctx.fillRect(0, L.bottom - 10, E.w, 10); ctx.globalAlpha = 1; }
    for (const g of S.ghosts) {
      const a = (0.35 + 0.65 * Math.abs(Math.sin(g.t * 9))) * Math.min(1, (J.ghostLife - g.t) * 4);
      if (g.it) {
        const it = g.it, gx = clamp(L.ox + (BAG_X + it.x) * L.s, (it.x - it.bb.x0) * L.s + 8, L.ox + T.beltW * L.s - (it.bb.x1 - it.x) * L.s - 8), gy = L.bottom - J.cueLift - (it.bb.y1 - it.y) * L.s;
        ctx.save(); ctx.translate(gx, gy); ctx.scale(L.s, L.s); ctx.rotate(it.rot * DEG);
        ctx.lineJoin = 'round'; ctx.strokeStyle = alpha(P.catch, a); ctx.lineWidth = LN.ring; ctx.stroke(pathsOf(it.def).outline);
        ctx.restore();
        pill(E, g.label, clamp(gx, 100, E.w - 100), gy - (it.y - it.bb.y0) * L.s - 18, TY.medium, P.catch, a);
      } else pill(E, g.label, E.w / 2, L.bottom - 70, TY.medium, P.catch, a);
    }
    for (const r of S.ripples) { const k = r.t / J.ripple; ctx.globalAlpha = 1 - k; ctx.strokeStyle = P.text; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(r.x, r.y, 8 + J.rippleR * ease.outQuad(k), 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1;
    for (const f of S.fx) {
      const k = f.t / J.fxLife, sc = 1 + (f.big ? 0.5 : 0.3) * (1 - ease.outBack(Math.min(1, k * 4)));
      ctx.save(); ctx.translate(clamp(L.ox + f.x * L.s, 80, E.w - 80), (f.bottom ? L.bottom - 70 : f.y * L.s) - 36 * k); ctx.scale(sc, sc);
      pill(E, f.text, 0, 0, f.big ? TY.large : TY.medium, f.color, 1 - k * k);
      ctx.restore();
    }
    if (S.bannerT > 0 && S.banner) { const b = bannerSpot(L); pill(E, S.banner.text, b.x, b.y, b.size, S.banner.color, Math.min(1, (S.bannerT / J.banner) * 3)); }
    drawHud(E, L);
    if (S.ended === 'breach') { const on = Math.floor(S.endT * 5) % 2 === 0; ctx.fillStyle = alpha(P.swatRed, on ? 0.32 : 0.12); ctx.fillRect(0, 0, E.w, E.h); }
    drawStamp(E);
  },
};

// ---------- menu and cards ----------
const drawStar = (ctx, cx, cy, r, on, off = P.dim) => {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  ctx.closePath();
  if (on) { ctx.fillStyle = P.star; ctx.fill(); ctx.strokeStyle = '#8a6a00'; ctx.lineWidth = 1; ctx.stroke(); } else { ctx.strokeStyle = off; ctx.lineWidth = 2; ctx.stroke(); }
};
function button(E, label, cx, cy, opts, pressed, grow = 1) {
  const ctx = E.ctx, s = (pressed ? J.press : 1) * (0.7 + 0.3 * ease.outBack(grow));
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy);
  const r = E.button(label, cx, cy, { color: P.text, size: TY.medium, ...opts });
  ctx.restore();
  return r;
}
const shapesOf = (shift) => T.newContraband[shift - 1].map((n) => BY_NAME[n]);
const bodyOf = (shift) => T.newBody[shift - 1].map((n) => BODY_BY_NAME[n]);

const menu = {
  enter() { this.cells = []; this.btnMute = null; this.down = null; },
  render(ctx, E) {
    const shifts = readShifts(E), unlocked = readUnlocked(E);
    const ty = E.safe.top + Math.max(84, E.h * 0.1);
    E.titleArea = { x: 0, y: ty - 28, w: E.w, h: 60 };
    ctx.save(); ctx.shadowColor = P.metal; ctx.shadowBlur = 18;
    txt(E, 'CHECKPOINT', E.w / 2, ty, TY.large, P.metal);
    ctx.restore();
    txt(E, 'Watch the belt. Watch the people.', E.w / 2, ty + 34, TY.small, P.dim);
    const n = T.beltSpeed.length, cols = 2, gap = 8, cw = Math.min(170, (E.w - 24 - gap) / cols), ch = 58, top = ty + 66;
    const x0 = (E.w - (cw * cols + gap)) / 2;
    this.cells = [];
    for (let i = 0; i < n; i++) {
      const col = i % cols, row = Math.floor(i / cols), x = x0 + col * (cw + gap), y = top + row * (ch + 8), open = i + 1 <= unlocked, rec = shifts[i + 1] || { best: 0, stars: 0 };
      const cell = { x, y, w: cw, h: ch, shift: i + 1, open }, pressed = this.down === cell.shift;
      ctx.save(); ctx.translate(x + cw / 2, y + ch / 2); ctx.scale(pressed ? J.press : 1, pressed ? J.press : 1); ctx.translate(-x - cw / 2, -y - ch / 2);
      E.roundRect(x, y, cw, ch, 12, pressed ? P.bagEdge : open ? P.panel : P.panelOff, open ? (rec.stars === 3 ? P.star : P.bagEdge) : P.panelOffEdge);
      txt(E, `Day ${i + 1}`, x + 12, y + 18, TY.medium, open ? P.text : P.textOff, { align: 'left' });
      if (T.rush.includes(i + 1)) txt(E, 'RUSH', x + cw - 10, y + 18, TY.small, open ? P.organic : P.rushOff, { align: 'right' });
      if (open) {
        for (let k = 0; k < 3; k++) drawStar(ctx, x + 20 + k * 20, y + 41, 8, k < rec.stars);
        if (rec.best) txt(E, String(rec.best), x + cw - 10, y + 41, TY.small, P.dim, { align: 'right' });
      } else txt(E, 'Locked', x + 12, y + 41, TY.small, P.textOff, { align: 'left' });
      ctx.restore();
      this.cells.push(cell);
    }
    this.btnMute = button(E, E.audio.muted ? 'Sound: off' : 'Sound: on', E.w / 2, top + 5 * (ch + 8) + 30, { fill: P.buttonMute, w: 160, h: 44, size: TY.small + 2 }, this.down === 'mute');
  },
  onPointerDown(p, E) {
    const c = this.cells.find((c) => c.open && E.hit(c, p));
    this.down = c ? c.shift : this.btnMute && E.hit(this.btnMute, p) ? 'mute' : null;
  },
  onPointerUp() { this.down = null; },
  onTap(p, E) {
    const c = this.cells.find((c) => E.hit(c, p));
    if (c) { if (c.open) E.setScene('brief', { shift: c.shift }); else E.toast(`Clear day ${c.shift - 1} first`); }
    else if (this.btnMute && E.hit(this.btnMute, p)) E.audio.toggleMute();
  },
};

// The day card: the rank, what is new today (bag shapes on a scanner strip, body items named), while the shift is built behind it.
const brief = {
  enter(E, params) {
    this.shift = params.shift; this.seed = (E.rng() * 2 ** 32) >>> 0; this.t0 = E.time; this.down = null; this.btnStart = this.btnMenu = null;
    prepare(this.shift, this.seed);
    const fresh = shapesOf(this.shift), body = bodyOf(this.shift);
    if ((fresh.length || body.length) && E.ledger) E.ledger.add('newshapes', { shift: this.shift, shapes: [...fresh.map((d) => d.name), ...body.map((b) => b.label)].join(',') });
  },
  update(dt, E) { pump(E); },
  render(ctx, E) {
    const shift = this.shift, fresh = shapesOf(shift), body = bodyOf(shift), cx = E.w / 2, top = E.safe.top, y1 = top + Math.max(84, E.h * 0.11);
    txt(E, `Day ${shift}`, cx, y1, TY.large, P.text);
    txt(E, rankOf(shift) + (T.rush.includes(shift) ? ', rush hour' : ''), cx, y1 + 34, TY.medium, T.rush.includes(shift) ? P.organic : P.dim);
    txt(E, T.brief[shift - 1], cx, y1 + 62, TY.small, P.dim);
    const y0 = E.h * 0.42;
    if (fresh.length || body.length) {
      txt(E, 'New contraband today', cx, y0 - 82, TY.medium, P.organic);
      const all = [...fresh.map((d) => ({ d })), ...body.map((b) => ({ b }))], cw = Math.min(112, (E.w - 32) / all.length);
      all.forEach((e, i) => {
        const x = cx + (i - (all.length - 1) / 2) * cw;
        E.roundRect(x - cw / 2 + 4, y0 - 52, cw - 8, 104, 10, P.screen);
        ctx.save(); ctx.translate(x, y0);
        if (e.d) { const k = Math.min(1.25, 76 / e.d.size, (cw - 18) / e.d.size); ctx.scale(k, k); paintItem(ctx, e.d); }
        else { E.roundRect(-20, -40, 40, 80, 16, MT.skin.fill, MT.skin.edge); ctx.scale(1.7, 1.7); ctx.rotate((e.b.rot || 0) * DEG); paintItem(ctx, e.b); }
        ctx.restore();
        const label = e.d ? [e.d.name, e.d.tier === 3 ? 'critical' : ''] : [e.b.label.split(' ')[0], e.b.label.split(' ').slice(1).join(' ')];
        txt(E, label[0], x, y0 + 66, TY.small, P.text);
        if (label[1]) txt(E, label[1], x, y0 + 84, TY.small, (e.d || e.b).tier === 3 ? P.catch : P.dim);
      });
    } else if (T.tips[shift - 1]) {
      txt(E, 'Tip', cx, y0 - 30, TY.small, P.dim);
      txt(E, T.tips[shift - 1], cx, y0, TY.medium, P.text);
    }
    const ready = PREP && PREP.shift === shift && PREP.ready;
    this.btnStart = ready ? button(E, 'Start', cx, E.h * 0.72, { fill: P.button }, this.down === 'start', clamp((E.time - this.t0) / 0.3, 0, 1)) : null;
    if (!ready) txt(E, 'Loading', cx, E.h * 0.72, TY.medium, P.dim);
    this.btnMenu = button(E, 'Menu', cx, E.h * 0.72 + 68, { fill: P.buttonQuiet }, this.down === 'menu');
  },
  onPointerDown(p, E) { this.down = this.btnStart && E.hit(this.btnStart, p) ? 'start' : this.btnMenu && E.hit(this.btnMenu, p) ? 'menu' : null; },
  onPointerUp() { this.down = null; },
  onTap(p, E) {
    if (this.btnStart && E.hit(this.btnStart, p)) E.setScene('play', { shift: this.shift, seed: this.seed });
    else if (this.btnMenu && E.hit(this.btnMenu, p)) E.setScene('menu');
  },
};

// The front page photo: what the story is about, drawn with the game's own pieces.
function photo(ctx, E, r, x, y, w, h) {
  ctx.save();
  E.roundRect(x, y, w, h, 2, '#d9d1c1', P.paperDim);
  plate(ctx, x, y, w, h, 2); ctx.clip();
  const cx = x + w / 2, k = Math.min(1.6, h / 90), fy = y + h - 10;
  if (r.result === 'breach') {
    const d = BY_NAME[r.breachItem] || BY_NAME.gun, kk = Math.min((h - 20) / d.size, (w - 40) / d.size, 2.2);
    E.roundRect(cx - w * 0.3, y + 8, w * 0.6, h - 16, 6, P.screen);
    ctx.save(); ctx.translate(cx, y + h / 2); ctx.scale(kk, kk); paintItem(ctx, d); ctx.restore();
    ctx.strokeStyle = P.catch; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(cx, y + h / 2, d.size * kk * 0.62, (h - 16) * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
  } else if (r.swats) {
    ctx.save(); ctx.translate(cx, fy); ctx.scale(k, k);
    ctx.save(); ctx.translate(-4, -12); ctx.rotate(-Math.PI / 2); drawPerson(ctx, E, 0, 0, T.characters.smuggler, P.tags[0], false, 0); ctx.restore();
    for (const ox of [-34, 6, 40]) officer(ctx, E, ox, ox === 6 ? -14 : 0);
    ctx.restore();
  } else if (r.vic) {
    ctx.save(); ctx.translate(cx, fy); ctx.scale(k, k);
    drawPerson(ctx, E, -16, 0, T.characters.smuggler, P.tags[2], false, 0, { ring: P.catch });
    officer(ctx, E, 22, 0);
    ctx.restore();
  } else {
    ctx.save(); ctx.translate(cx, fy); ctx.scale(k, k);
    ctx.fillStyle = P.booth; ctx.fillRect(-34, -78, 6, 78); ctx.fillRect(28, -78, 6, 78); ctx.fillRect(-34, -84, 68, 8);
    drawPerson(ctx, E, 0, 0, T.characters.grandma, P.tags[1], false, 0);
    ctx.restore();
  }
  ctx.restore();
}

// The end card is tomorrow's front page: the headline says what happened, then the score, stars and the buttons.
const SERIF = 'Georgia, "Times New Roman", serif';
const over = {
  enter(E, r) {
    this.r = r; this.t0 = E.time; this.btns = {}; this.down = null;
    prepare(r.shift, r.seed);
  },
  update(dt, E) { pump(E); },
  render(ctx, E) {
    const r = this.r, cx = E.w / 2, k = E.time - this.t0, hl = headline(r);
    const pw = Math.min(E.w - 24, 380), px = cx - pw / 2, py = E.safe.top + 12, ph = E.h * 0.58 - py;
    ctx.save(); ctx.translate(cx, py + ph / 2); ctx.rotate(-0.012 * (1 - ease.outCubic(clamp(k / 0.4, 0, 1)))); ctx.translate(-cx, -py - ph / 2);
    E.roundRect(px, py, pw, ph, 4, P.paper);
    txt(E, 'THE DAILY CHECKPOINT', cx, py + 24, TY.medium, P.ink, { font: SERIF, weight: '800' });
    fillBox(E, px + 12, py + 40, pw - 24, 2, P.ink);
    txt(E, `Day ${r.shift}  ·  ${r.rank}`, px + 14, py + 54, TY.small, P.paperDim, { align: 'left', font: SERIF });
    txt(E, r.result === 'clear' ? 'Final edition' : 'Extra!', px + pw - 14, py + 54, TY.small, r.result === 'clear' ? P.paperDim : P.catch, { align: 'right', font: SERIF });
    fillBox(E, px + 12, py + 64, pw - 24, 1, P.ink);
    const hy = py + 100;
    hl.lines.forEach((line, i) => txt(E, line, cx, hy + i * 38, TY.large, r.result === 'breach' ? P.catch : P.ink, { font: SERIF, weight: '900' }));
    txt(E, hl.sub, cx, hy + hl.lines.length * 38 + 2, TY.small, P.paperDim, { font: SERIF });
    const fy = hy + hl.lines.length * 38 + 22, fh = py + ph - 60 - fy;
    if (fh >= 60) photo(ctx, E, r, px + 14, fy, pw - 28, fh);
    const sy = py + ph - 34;
    for (let i = 0; i < 3; i++) {
      const on = i < r.stars, kk = on ? clamp((k - J.cardStars * (i + 1)) / 0.3, 0, 1) : 1;
      drawStar(ctx, px + 30 + i * 30, sy, 12, false, P.paperDim);
      if (on && kk > 0) drawStar(ctx, px + 30 + i * 30, sy, 12 * ease.outBack(kk), true);
    }
    const shown = Math.round(r.score * ease.outCubic(clamp((k - 0.1) / J.cardCount, 0, 1)));
    txt(E, String(shown), px + pw - 14, sy, TY.large, P.ink, { align: 'right', font: SERIF, weight: '800' });
    ctx.restore();
    const iy = py + ph + 24;
    txt(E, r.isNew ? 'New best' : r.best ? `Best ${r.best}` : 'No best yet', cx, iy, TY.medium, P.organic);
    txt(E, `Missed ${r.misses}, false alarms ${r.falseAlarms}`, cx, iy + 28, TY.small, r.strikes ? P.text : P.dim);
    txt(E, T.starRule, cx, iy + 50, TY.small, P.dim);
    const next = r.result === 'clear' && r.shift < T.beltSpeed.length, grow = clamp((k - J.cardButtons) / 0.3, 0, 1);
    this.btns = {};
    if (grow <= 0) return;
    const bh = 50, gap = 8, n = next ? 3 : 2;
    let y = Math.min(iy + 78 + bh / 2, E.h - E.safe.bottom - 12 - (n - 1) * (bh + gap) - bh / 2);
    if (next) { this.btns.next = button(E, 'Next day', cx, y, { fill: P.button, h: bh }, this.down === 'next', grow); y += bh + gap; }
    this.btns.retry = button(E, 'Retry', cx, y, next ? { fill: P.buttonQuiet, h: bh } : { fill: P.button, h: bh }, this.down === 'retry', grow); y += bh + gap;
    this.btns.menu = button(E, 'Menu', cx, y, { fill: P.buttonQuiet, h: bh }, this.down === 'menu', grow);
  },
  onPointerDown(p, E) { this.down = Object.keys(this.btns).find((k) => E.hit(this.btns[k], p)) || null; },
  onPointerUp() { this.down = null; },
  onTap(p, E) {
    if (E.time - this.t0 < J.cardButtons) return;
    const b = this.btns, r = this.r;
    if (b.next && E.hit(b.next, p)) E.setScene('brief', { shift: r.shift + 1 });
    else if (b.retry && E.hit(b.retry, p)) {
      if (E.ledger) E.ledger.add('retry', { shift: r.shift, seed: r.seed, after: r.result, score: r.score, stars: r.stars });
      E.setScene('play', { shift: r.shift, seed: r.seed });
    } else if (b.menu && E.hit(b.menu, p)) E.setScene('menu');
  },
};

export const game = {
  slug: 'checkpoint',
  title: 'Checkpoint',
  saveVersion: 4,
  // v1 kept `unlocked` beside the per-shift records; v2 derives it from them (the highest shift with stars, plus one) and clamps it.
  // v3 adds the career record (SWAT calls, Vic caught, breaches); stars, best scores and unlocked days are kept as they are.
  // v4: a best counts only on a cleared day, so a day never cleared (no stars) loses the best a breach or three strikes once saved. The shape is unchanged.
  migrate(data, fromVersion) {
    if (fromVersion < 2) {
      const cleared = Object.entries(cleanShifts(data.shifts)).filter(([, r]) => r.stars > 0).map(([n]) => Number(n));
      data.unlocked = clampUnlocked(Math.max(0, ...cleared) + 1);
    }
    if (fromVersion < 3) data.career = cleanCareer(data.career);
    if (fromVersion < 4 && data.shifts) {
      data.shifts = cleanShifts(data.shifts);
      for (const r of Object.values(data.shifts)) if (!r.stars) r.best = 0;
    }
    return data;
  },
  TUNING,
  experiments: [
    { key: 'tune.belt', label: 'Belt speed', min: 0.6, max: 1.6, step: 0.05 },
    { key: 'tune.pace', label: 'Traveller pace', min: 0.6, max: 1.8, step: 0.05 },
    { key: 'scanShow', label: 'Scan time (s)', min: 0.8, max: 2.5, step: 0.1 },
    { key: 'tune.occlusion', label: 'Occlusion', min: 0, max: 1, step: 0.05 },
  ],
  presets: [
    { label: 'Calm', values: { 'tune.belt': 0.85, 'tune.pace': 0.85, scanShow: 1.8, 'tune.occlusion': 0.35 } },
    { label: 'Rush hour', values: { 'tune.belt': 1.2, 'tune.pace': 1.3, scanShow: 1.1, 'tune.occlusion': 0.9 } },
  ],
  start: 'menu',
  scenes: { menu, brief, play, over },
  // Read by tools/sim-checkpoint.mjs so the harness runs the real generation, tap resolution and scoring.
  sim: {
    ITEMS, BODY, SILHOUETTE, scanAlpha, bannerSpot, swatBudget, genShift, genShiftSteps, prepare, pump, readShifts, cleanShifts, cleanCareer, visibility, outlineVisibility, tellVisibility, layout, clampUnlocked, headline, packRule,
    overlapPairs(bag) {
      const out = [];
      for (let i = 0; i < bag.items.length; i++) for (let j = i + 1; j < bag.items.length; j++) {
        const a = bag.items[i], b = bag.items[j];
        if (a.bb.x1 < b.bb.x0 || b.bb.x1 < a.bb.x0 || a.bb.y1 < b.bb.y0 || b.bb.y1 < a.bb.y0) continue;
        if (a.pts.some(([x, y]) => inShape(x, y, b.parts)) || b.pts.some(([x, y]) => inShape(x, y, a.parts))) out.push([a, b]);
      }
      return out;
    },
    overlaps(bag) { return this.overlapPairs(bag).length; },
    state: () => S,
    onScreen(E) {
      const L = layout(E), out = [];
      for (const b of S.bags) {
        if (b.gone || b.y >= S.H || b.y + b.h < 0) continue;
        for (const it of b.items) out.push({ id: `${b.idx}:${b.items.indexOf(it)}`, name: it.name, contraband: it.contraband, tier: it.tier, state: it.state, cy: b.y + it.y, x: L.ox + (BAG_X + it.x) * L.s, y: (b.y + it.y) * L.s });
      }
      return out;
    },
    // Where to tap a traveller now: on the scan (each body item, px) while it shows, else the walking figure's chest.
    lane(E) {
      const L = layout(E), sc = L.scan, out = [];
      for (const tr of S.travellers) {
        if (tr.state === 'gone' || tr.state === 'queue') continue;
        const o = { idx: tr.idx, state: tr.state, beeps: tr.beeps, scanT: tr.state === 'scan' ? tr.t : -1, pending: tr.pending, stopped: tr.stopped, touched: tr.touched, swat: !!tr.swat, who: tr.who, x: L.ox + tr.x * L.s, y: (tr.y - LA.figH / 2) * L.s };
        if (tr.state === 'scan' && tr.beeps) o.items = tr.body.map((b) => ({ name: b.name, contraband: b.contraband, tier: b.tier, x: L.ox + (sc.cx + b.x * sc.k) * L.s, y: (sc.cy + b.y * sc.k) * L.s }));
        out.push(o);
      }
      return out;
    },
    lever(E) { const L = layout(E); return { x: L.ox + (L.lever.x + L.lever.w / 2) * L.s, y: (L.lever.y + L.lever.h / 2) * L.s, w: L.lever.w * L.s, h: L.lever.h * L.s }; },
  },
};
