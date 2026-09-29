// game.js - Checkpoint, layer 1 (mechanic). Grey-box: bags on an X-ray belt, tap the contraband, leave clean bags alone.
//
// Coordinates: play is laid out in design units, 360 wide, scaled to the screen by layout(). Belt speed, item outlines,
// bags and the hit margin are all in design units. Item outlines are lists of polygons around the item's own origin
// (its centre, y down). Randomness only builds the bags (genShift, seeded); every tap resolves the same way (ADR-0008).
// The shift clock runs in fixed steps (TUNING.simStep) so the same seed and tap times score the same at any frame rate.

import { makeRng, clamp, ease } from './engine.js';

const TUNING = {
  get bg() { return this.palette.bg; },   // the engine clears to this

  // PRD section 16
  bagsPerShift: 20,
  strikesMax: 3,
  beltSpeed: [70, 75, 80, 85, 90, 90, 95, 100, 105, 95],               // units/s per shift (PRD 70 to 160): the slope comes from clutter, not throughput
  itemsPerBag: [[4, 5], [4, 6], [5, 6], [5, 7], [6, 8], [6, 7], [6, 8], [7, 8], [7, 9], [8, 9]],
  cleanShare: 0.5,
  hitMargin: 12,
  minVisible: 0.6,
  catchBase: 100,
  cleanBase: 20,
  earlyMax: 3,                                                          // catch multiplier entering at the top ...
  earlyMin: 0.5,                                                        // ... falling linearly to this at the bottom edge
  streakSteps: [4, 8, 12, 16],                                          // x2, x3, x4, x5
  bagGap: 64,                                                           // PRD 40; raised with bagH so the last shift is at least 40 s long

  // The shift table, columns beyond PRD section 16 (rows are shifts 1 to 10; every shift is playable once the one before it is cleared)
  //   shift  teaches / needs                                                  intended solution (naked run)
  //   1      one obvious shape on a sparse bag (knife, scissors, gun)         tap the one contraband item in the top third
  //   2      clean bags exist and must be left alone; hammer and lighter      scan each bag once; tap the shape, leave the rest
  //   3      items overlap: read the dense corner, the outline shows through  find the blade or bottle under the clutter by its silhouette
  //   4      look-alikes (hairdryer, pen, phone...); up to two per bag        judge the silhouette, not the tint; two catches in a bag are worth it
  //   5      rush hour: bags in bursts of three, denser and more look-alikes  read the dense corner first, tap as soon as the shape is clear
  //   6      all ten shapes; a breather after the rush                        catch early: points fall with the bag
  //   7      heavier overlap and more pairs                                    scan bag by bag, never linger on a clean one
  //   8      most look-alikes                                                 a false alarm costs a strike: hesitate on hairdryer, pen, phone, belt
  //   9      near-full clutter                                                read each bag in one pass, top to bottom
  //   10     rush hour again: bursts, the densest bags, most look-alikes      all of the above
  brief: [                                                              // the line under the shift card
    'Tap the contraband. Leave clean bags.', 'Some bags are clean. Do not tap them.', 'Items overlap. Outlines show through.', 'Look-alikes are harmless. Two per bag.',
    'Bags arrive in bursts.', 'All ten shapes. Catch early for points.', 'Same shapes, heavier clutter.', 'Look-alikes everywhere. Be sure.', 'Read each bag in one pass.', 'Everything at once.',
  ],
  starRule: '3 stars: no strikes. 2: one. 1: clear.',   // the one line on the card that says how stars are earned
  tips: ['', '', '', '', '', '', 'Dense corner first.', 'Judge shape, not tint.', 'One pass, top to bottom.', 'Early catches pay most.'],   // the middle of the card when no shape is new
  rush: [5, 10],                                                        // rush hour shifts: bags arrive in bursts
  burst: { size: 3, gapIn: 12 },                                        // bags per burst and the belt gap inside one; the gap between bursts keeps the average pitch
  rotMax: [20, 30, 45, 60, 90, 90, 120, 150, 180, 180],                 // item rotation, degrees either way
  maxContraband: [1, 1, 1, 2, 2, 2, 2, 2, 2, 2],                        // per bag
  twoShare: [0, 0, 0, 0.2, 0.3, 0.25, 0.3, 0.35, 0.35, 0.4],           // share of contraband bags holding two (where two are allowed)
  overlapBias: [0, 0, 0.35, 0.4, 0.6, 0.45, 0.5, 0.55, 0.55, 0.7],     // chance an item is dropped near another one (clutter), once overlap is on
  confusableShare: [0, 0, 0, 0.25, 0.45, 0.3, 0.4, 0.5, 0.15, 0.75],       // share of bags holding one harmless look-alike
  newContraband: [['knife', 'scissors', 'gun'], ['hammer', 'lighter'], ['large liquid', 'batteries'], ['fireworks'], ['taser'], ['box cutter'], [], [], [], []],
  opener: { shift: 1, contraband: ['scissors'], harmless: ['shirt', 'phone', 'headphones'] }, // bag 1, then bag 2 is clean

  // Packing
  overlapFrom: 3,                // first shift where items may overlap; before it every hit shape stays apart
  packGap: 6,                    // extra clearance between items while overlap is off
  visSlack: 0.04,                // generation asks minVisible plus this (area and outline), so the exact measure never dips under minVisible
  visStep: 3,                    // sample spacing (units) for the visibility measure used while packing
  edgeStep: 3,                   // spacing along an outline for the outline-visibility samples used while packing
  visFinalStep: 1.5,             // spacing of the fine check a finished bag must pass ...
  visFinalSlack: 0.01,           // ... at minVisible plus this
  packTries: 40,                 // placements tried per item before the bag layout is redrawn
  bagTries: 40,                  // layouts tried per bag
  tintFrom: 3,                   // from this shift the picks are balanced so organic items are contraband about as often as metal ones
  organicContraband: [1, 1, 4, 3, 3, 3, 3, 3, 3, 3],   // pick weight per shift of an organic contraband item (large liquid, fireworks) ...
  organicHarmless: 0.45,         // ... and of an organic harmless one, against 1 for metal
  tangleOpposite: 0.9,           // chance an overlapping item is dropped on one of the other tint, so metal-on-metal knots stay rare
  confusableNear: 0.5,           // ... and how often it is the look-alike of a contraband item in that bag
  runMax: 4,                     // most clean (or contraband) bags in a row

  // Layout
  designW: 360,
  designMinH: 560,               // the view is never scaled down for a shorter screen than this
  bagW: 300,
  bagH: 260,
  bagPad: 8,
  firstBagGap: 8,                // the first bag starts this far below the HUD, fully in view
  hudH: 56,                      // px below the top safe inset
  hoodH: 34,                     // px of scanner hood under the HUD; bags slide out from beneath it

  // Timing
  simStep: 1 / 120,

  // Art (PRD section 11): glowing X-ray outlines with a soft bloom on deep blue. Every colour drawn comes from this palette.
  palette: {
    bg: '#070f24',   // the belt: the engine clears to it, so the belt costs no fill of its own
    rail: '#0a1730', roller: '#16305c', rollerHi: '#2f5f9e',
    hood: '#0a1428', hoodLip: '#1b3a6b', strip: '#050b1a', bag: '#0d1c3c', bagEdge: '#2a5a9a',
    metal: '#4aa8ff', organic: '#ff9a1f', catch: '#ff3b47', falseAlarm: '#ffe61a', clean: '#38e07b',
    text: '#dbe7ff', dim: '#7f95b8', star: '#ffd11a',
    panel: '#12274d', panelOff: '#0a1226', panelOffEdge: '#1a2540', textOff: '#4a5d80',
    rushOff: '#b0701f', button: '#1d4ed8', buttonQuiet: '#334155', buttonMute: '#1f2937', badge: '#0f1c38', badgeHot: '#3a2a08', strikeOn: '#3a0c12',
  },
  // Frame budget: the bloom is measured, not assumed. The first seconds of a shift time the frames; then the level is fixed for the shift.
  // The level only ever goes down: a rolling window of recent frames is checked while the first `probe` seconds of a shift run, and a level that is
  // dropped stays dropped for the session. A frame slower than slowMs is slow; up to threeShare slow frames keeps 3 passes, up to oneShare 1 pass, else none.
  // A steady frame time near 33 ms (a 30 fps cap, as in Low Power Mode) is healthy, not slow.
  bloom: { probe: 4, warm: 12, window: 120, minFrames: 40, every: 15, slowMs: 24, threeShare: 0.08, oneShare: 0.25, capMs: [28, 38], capSpread: 8 },
  sprite: { ahead: 320, perFrame: 1, rebuild: 1 },      // sprites for coming bags a frame; and stale ones repainted (after a downgrade) a frame
  prepMs: 4,                                                 // work per frame spent building the next shift while a card is showing                       // items are painted once into small sprites, this far above the hood, this many a frame
  type: { small: 14, medium: 20, large: 36, weight: '700' },   // the three text sizes and the one weight
  line: { core: 2, glow: 6, halo: 12, ring: 3, edge: 2 },      // outline core, its bloom passes, ring and plate edge widths (design units)

  // Juice (PRD section 10). Everything here is cosmetic: none of it moves a hit shape, a clock or a score.
  juice: {
    ripple: 0.3, rippleR: 26, rippleMax: 6,          // the touch answers in the same frame
    ringSnap: 0.2, ringFrom: 38,                     // the catch ring snaps in from this far out
    particleCap: 140, particleLife: 0.45, particleSize: 4, burstSpeed: 240,
    burst: { catch: 14, big: 26, tint: 8, falseAlarm: 8, miss: 8 },
    earlyLabel: 0.35,                                // catches above this share of the screen height say "early"
    bigCatch: 900,                                   // points at which a catch is big: more sparks and a small shake
    shake: { big: [3, 0.14], falseAlarm: [4, 0.2], miss: [5, 0.25], over: [7, 0.35] },
    pop: 0.3, popSize: 0.35, badgePop: 0.4, badgeSize: 0.5,
    tray: 0.55, trayDist: 420, trayTilt: 0.12,       // the caught bag slides sideways off the belt
    bagFlash: 0.4, screenFlash: 0.08, flashLife: 0.5, fxLife: 0.9, ghostLife: 1, cueLift: 14, banner: 1.4, press: 0.96,
    stampFrom: 2.6, stampT: 0.32, endDelay: 1.7,     // the stamp slams down, then the card
    cardButtons: 0.7, cardStars: 0.25, cardCount: 0.8,
    haptic: { catch: 10, falseAlarm: [25, 45, 25], miss: 80, clear: 20 },   // a double pulse for a false alarm, one long pulse for a miss
    hum: { every: 0.2, base: 58, step: 8, maxStreak: 20, gain: 0.05, rush: 1.7 },   // the belt hum, rising with the streak
    tones: {
      pass: [{ freq: 784, dur: 0.1, type: 'sine', gain: 0.06 }, { freq: 1047, dur: 0.16, type: 'sine', gain: 0.06, delay: 0.08 }],
      falseAlarm: [{ freq: 660, dur: 0.09, type: 'square', gain: 0.09 }, { freq: 660, dur: 0.09, type: 'square', gain: 0.09, delay: 0.14 }],   // two blips, an octave above the miss
      miss: { freq: 330, dur: 0.32, type: 'sawtooth', slide: 0.85, gain: 0.16 },   // both sit above the hum (58 to 218 Hz)
      step: { freq: 520, dur: 0.14, type: 'triangle', gain: 0.1, up: 1.19 },
      rush: { freq: 1400, dur: 0.2, type: 'sine', gain: 0.06, slide: 1.3 },   // far above the miss (330) and false alarm (660) pitches
    },
  },
};

const T = TUNING;
const DEG = Math.PI / 180;

// ---------- shape helpers ----------
const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const ell = (cx, cy, rx, ry, n = 12) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
const bar = (x1, y1, x2, y2, w) => { const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy), nx = (-dy / d) * w / 2, ny = (dx / d) * w / 2; return [[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]]; };
const arc = (cx, cy, r, a0, a1, n = 10) => Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + ((a1 - a0) * i) / n) * DEG; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
const band = (cx, cy, r, w, a0, a1) => [...arc(cx, cy, r, a0, a1), ...arc(cx, cy, r - w, a1, a0)];
const crimp = (x0, x1, y, dy, n) => Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y + (i % 2 ? dy : 0)]);

// ---------- the item table (PRD section 9) ----------
// tint: organic (amber) or metal (blue). confusable: the contraband item this harmless one can be mistaken for.
const ITEM_DATA = [
  // contraband
  { name: 'knife', tint: 'metal', contraband: true, shape: [[[-34, -6], [-8, -6], [-8, -10], [22, -10], [38, 4], [-8, 4], [-8, 6], [-34, 6]], rect(-11, -12, 4, 22)] },
  { name: 'scissors', tint: 'metal', contraband: true, shape: [bar(-26, -9, 39, 13, 5), bar(-26, 9, 39, -13, 5), ell(-33, -12, 8, 8, 10), ell(-33, 12, 8, 8, 10)] },
  { name: 'gun', tint: 'metal', contraband: true, shape: [rect(-34, -16, 68, 15), rect(-30, -1, 44, 7), [[-30, -1], [-12, -1], [-6, 28], [-24, 28]], [[-4, 5], [18, 5], [18, 9], [12, 9], [9, 17], [1, 17], [1, 9], [-4, 9]]] },
  { name: 'lighter', tint: 'metal', contraband: true, shape: [rect(-12, -4, 24, 34), [[-12, -4], [-12, -16], [8, -22], [12, -14], [12, -4]]] },
  { name: 'large liquid', tint: 'organic', contraband: true, shape: [rect(-20, -16, 40, 50), [[-20, -16], [-8, -24], [8, -24], [20, -16]], rect(-7, -32, 14, 8), rect(-9, -40, 18, 8)] },
  { name: 'batteries', tint: 'metal', contraband: true, shape: [rect(-24, -16, 14, 40), rect(-20, -20, 6, 4), rect(-7, -22, 14, 40), rect(-3, -26, 6, 4), rect(10, -16, 14, 40), rect(14, -20, 6, 4)] },
  { name: 'fireworks', tint: 'organic', contraband: true, shape: [rect(-8, -24, 16, 36), [[-8, -24], [0, -40], [8, -24]], [[-8, 4], [-15, 15], [-8, 12]], [[8, 4], [15, 15], [8, 12]], rect(-1.5, 12, 3, 30)] },
  { name: 'taser', tint: 'metal', contraband: true, shape: [rect(-24, -11, 38, 22), [[-20, 11], [-6, 11], [-10, 32], [-24, 32]], rect(14, -9, 10, 18), rect(24, -9, 18, 4), rect(24, 5, 18, 4)] },
  { name: 'hammer', tint: 'metal', contraband: true, shape: [rect(-6, -4, 46, 8), rect(-24, -13, 22, 26), [[-24, -13], [-42, -9], [-42, -3], [-24, 3]]] },
  { name: 'box cutter', tint: 'metal', contraband: true, shape: [rect(-32, -9, 52, 18), [[-8, -9], [-4, -13], [6, -13], [10, -9]], [[20, -6], [36, -6], [46, 5], [20, 5]]] },
  // harmless
  { name: 'shirt', tint: 'organic', shape: [[[-13, -27], [-5, -27], [0, -22], [5, -27], [13, -27], [36, -14], [28, -2], [15, -8], [15, 28], [-15, 28], [-15, -8], [-28, -2], [-36, -14]]] },
  { name: 'shoes', tint: 'organic', shape: [[[-36, 12], [-36, -4], [-28, -14], [-16, -15], [-8, -6], [8, -4], [24, 4], [36, 8], [36, 12]]] },
  { name: 'phone', tint: 'metal', confusable: 'lighter', shape: [rect(-14, -27, 28, 54)] },
  { name: 'laptop', tint: 'metal', shape: [rect(-36, -28, 72, 42), [[-44, 14], [44, 14], [40, 22], [-40, 22]]] },
  { name: 'headphones', tint: 'metal', shape: [band(0, 4, 26, 4, 180, 360), rect(-32, 2, 12, 22), rect(20, 2, 12, 22)] },
  { name: 'book', tint: 'organic', shape: [rect(-20, -27, 40, 54)] },
  { name: 'toothbrush', tint: 'metal', confusable: 'box cutter', shape: [[[-38, -4], [2, -4], [10, -10], [38, -10], [38, 10], [10, 10], [2, 4], [-38, 4]]] },
  { name: 'charger', tint: 'metal', confusable: 'taser', shape: [rect(-16, -14, 32, 28), rect(-9, -24, 4, 10), rect(5, -24, 4, 10), rect(-3, 14, 6, 30)] },
  { name: 'small liquid', tint: 'organic', confusable: 'large liquid', shape: [rect(-12, -6, 24, 32), rect(-4, -12, 8, 6), rect(-6, -19, 12, 7)] },
  { name: 'sunglasses', tint: 'organic', shape: [ell(-17, 0, 13, 10), ell(17, 0, 13, 10), rect(-5, -3, 10, 4)] },
  { name: 'hairdryer', tint: 'metal', confusable: 'gun', shape: [rect(-30, -14, 44, 22), [[14, -14], [26, -17], [26, 11], [14, 8]], [[-16, 8], [-4, 8], [-1, 36], [-13, 36]]] },
  { name: 'pen', tint: 'metal', confusable: 'knife', shape: [[[-38, -8], [24, -8], [38, 0], [24, 8], [-38, 8]], rect(-32, -12, 24, 4)] },
  { name: 'umbrella', tint: 'organic', shape: [[...arc(0, 0, 30, 180, 360, 12)], rect(-1.5, 0, 3, 34), [[-1.5, 32], [1.5, 32], [1.5, 40], [-7, 40], [-7, 36], [-3, 36], [-3, 34], [-1.5, 34]]] },
  { name: 'camera', tint: 'metal', shape: [rect(-26, -17, 52, 34), rect(-22, -24, 16, 7), ell(4, 0, 12, 12), rect(14, -21, 10, 4)] },
  { name: 'wallet', tint: 'organic', shape: [[[-24, -17], [24, -17], [24, -8], [14, -8], [14, 8], [24, 8], [24, 17], [-24, 17]]] },
  { name: 'keys', tint: 'metal', shape: [band(-22, 0, 11, 5, 15, 345), rect(-14, -8, 44, 5), rect(20, -3, 4, 5), rect(-14, 3, 38, 5), rect(16, 8, 4, 5)] },
  { name: 'toy', tint: 'organic', shape: [ell(-4, 8, 22, 14, 14), ell(14, -10, 11, 11), [[24, -12], [34, -9], [24, -6]]] },
  { name: 'water bottle', tint: 'organic', confusable: 'large liquid', shape: [rect(-13, -8, 26, 44), [[-13, -8], [-5, -22], [5, -22], [13, -8]], rect(-6, -30, 12, 8)] },
  { name: 'belt', tint: 'metal', confusable: 'hammer', shape: [rect(-42, -4, 64, 8), rect(20, -10, 24, 20)] },
  { name: 'snacks', tint: 'organic', shape: [[...crimp(-22, 22, -28, 4, 8), ...crimp(22, -22, 28, -4, 8)]] },
];

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
// Distance from a point to a union of polygons: 0 inside.
const shapeDist = (px, py, parts) => {
  let m = Infinity;
  for (const poly of parts) {
    if (inPoly(px, py, poly)) return 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) m = Math.min(m, segDist(px, py, poly[j][0], poly[j][1], poly[i][0], poly[i][1]));
  }
  return m;
};
const inShape = (px, py, parts) => { for (const poly of parts) if (inPoly(px, py, poly)) return true; return false; };

// Points along an item's outline, leaving out the seams where one of its own parts lies inside another.
function outlinePoints(def, step, offset) {
  const pts = [];
  def.shape.forEach((poly, pi) => {
    const others = def.shape.filter((_, k) => k !== pi);
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
// Narrowest width of an outline over all directions (the hit shape adds hitMargin on both sides of it).
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
const ITEMS = ITEM_DATA.map((d) => {
  const item = { contraband: false, confusable: null, ...d };
  const xs = item.shape.flat().map((p) => p[0]), ys = item.shape.flat().map((p) => p[1]);
  item.size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));   // longest extent, design units
  item.thin = minWidth(item.shape);                                                             // narrowest width, design units
  item.rad = Math.max(...item.shape.flat().map((p) => Math.hypot(p[0], p[1])));
  item.samples = [];
  for (let y = Math.min(...ys) + T.visStep / 2; y < Math.max(...ys); y += T.visStep)
    for (let x = Math.min(...xs) + T.visStep / 2; x < Math.max(...xs); x += T.visStep) if (inShape(x, y, item.shape)) item.samples.push([x, y]);
  item.edge = outlinePoints(item, T.edgeStep, 0.5);
  return item;
});
const BY_NAME = Object.fromEntries(ITEMS.map((i) => [i.name, i]));
const HARMLESS = ITEMS.filter((i) => !i.contraband);

// ---------- bag generation (setup only, seeded) ----------
function instance(def, x, y, rot) {
  const c = Math.cos(rot * DEG), s = Math.sin(rot * DEG), tr = ([px, py]) => [x + px * c - py * s, y + px * s + py * c];
  const parts = def.shape.map((poly) => poly.map(tr));
  const bb = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const [px, py] of parts.flat()) { bb.x0 = Math.min(bb.x0, px); bb.x1 = Math.max(bb.x1, px); bb.y0 = Math.min(bb.y0, py); bb.y1 = Math.max(bb.y1, py); }
  return { def, name: def.name, contraband: def.contraband, x, y, rot, parts, pts: def.samples.map(tr), epts: def.edge.map(tr), bb, cov: null, ecov: null, hidden: 0, ehidden: 0, state: 0, flagT: -1 };
}
function extents(def, rot) {
  const c = Math.cos(rot * DEG), s = Math.sin(rot * DEG);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [px, py] of def.shape.flat()) { const x = px * c - py * s, y = px * s + py * c; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  return { minX, maxX, minY, maxY };
}
function covers(px, py, o, margin) {
  const b = o.bb;
  if (px < b.x0 - margin || px > b.x1 + margin || py < b.y0 - margin || py > b.y1 + margin) return false;
  return margin > 0 ? shapeDist(px, py, o.parts) <= margin : inShape(px, py, o.parts);
}
// Adds `it` to the bag if every item, itself included, keeps its visible share of both its area and its outline.
// Visible = not under any other item's shape.
function commit(it, placed, rule) {
  const chans = [['pts', 'cov', 'hidden'], ['epts', 'ecov', 'ehidden']];
  const own = chans.map(([pts]) => ({ cov: new Uint8Array(it[pts].length), hidden: 0 })), extras = [];
  for (const p of placed) {
    const a = it.bb, b = p.bb, m = rule.margin;
    if (a.x1 + m < b.x0 || b.x1 + m < a.x0 || a.y1 + m < b.y0 || b.y1 + m < a.y0) continue;
    const ex = [];
    for (let c = 0; c < 2; c++) {
      const [pts, cov, hid] = chans[c], mine = it[pts], theirs = p[pts];
      for (let i = 0; i < mine.length; i++) if (!own[c].cov[i] && covers(mine[i][0], mine[i][1], p, m)) { own[c].cov[i] = 1; own[c].hidden++; }
      const list = [];
      for (let j = 0; j < theirs.length; j++) if (!p[cov][j] && covers(theirs[j][0], theirs[j][1], it, m)) list.push(j);
      if ((theirs.length - p[hid] - list.length) / theirs.length < rule.need) return false;
      ex.push(list);
    }
    extras.push([p, ex]);
  }
  for (let c = 0; c < 2; c++) if ((it[chans[c][0]].length - own[c].hidden) / it[chans[c][0]].length < rule.need) return false;
  for (const [p, ex] of extras) for (let c = 0; c < 2; c++) { for (const j of ex[c]) p[chans[c][1]][j] = 1; p[chans[c][2]] += ex[c].length; }
  for (let c = 0; c < 2; c++) { it[chans[c][1]] = own[c].cov; it[chans[c][2]] = own[c].hidden; }
  return true;
}
function tryPlace(rng, def, placed, rule) {
  for (let k = 0; k < T.packTries; k++) {
    const rot = rng.range(-rule.rotMax, rule.rotMax), e = extents(def, rot);
    const x0 = T.bagPad - e.minX, x1 = T.bagW - T.bagPad - e.maxX, y0 = T.bagPad - e.minY, y1 = T.bagH - T.bagPad - e.maxY;
    if (x1 < x0 || y1 < y0) continue;
    let x, y;
    if (rule.overlap && placed.length && rng.chance(rule.bias)) {
      const other = placed.filter((q) => q.def.tint !== def.tint);
      const a = other.length && rng.chance(T.tangleOpposite) ? rng.pick(other) : rng.pick(placed);
      x = clamp(a.x + rng.range(-0.5, 0.5) * a.def.size, x0, x1); y = clamp(a.y + rng.range(-0.5, 0.5) * a.def.size, y0, y1);
    } else { x = rng.range(x0, x1); y = rng.range(y0, y1); }
    const it = instance(def, x, y, rot);
    if (commit(it, placed, rule)) return it;
  }
  return null;
}
// A generator: it yields `null` between item placements and before each fine check, so a caller can spread one bag over many frames.
function* packBagSteps(rng, names, shift) {
  const overlap = shift >= T.overlapFrom;
  const rule = { overlap, margin: overlap ? 0 : T.packGap, need: overlap ? T.minVisible + T.visSlack : 1, rotMax: T.rotMax[shift - 1], bias: T.overlapBias[shift - 1] };
  const defs = names.map((n) => BY_NAME[n]).sort((a, b) => b.samples.length - a.samples.length);
  for (let attempt = 0; attempt < T.bagTries; attempt++) {
    const placed = [];
    for (const def of defs) { const it = tryPlace(rng, def, placed, rule); if (!it) break; placed.push(it); yield null; }
    // The packing measure is coarse; the finished bag must also pass a fine one.
    const fine = { items: placed };
    if (placed.length === defs.length) yield null;
    if (placed.length === defs.length && Math.min(...visibility(fine, T.visFinalStep), ...outlineVisibility(fine, T.visFinalStep)) >= T.minVisible + T.visFinalSlack) {
      for (const it of placed) { it.vis = 1 - it.hidden / it.pts.length; it.evis = 1 - it.ehidden / it.epts.length; }
      return rng.shuffle(placed);
    }
  }
  throw new Error(`checkpoint: could not pack ${names.join(', ')} in shift ${shift}`);
}
const contrabandPool = (shift) => T.newContraband.slice(0, shift).flat();

function runsOk(kinds) {
  let run = 1;
  for (let i = 1; i < kinds.length; i++) { run = kinds[i] === kinds[i - 1] ? run + 1 : 1; if (run > T.runMax) return false; }
  return true;
}
function schedule(rng, shift) {
  const n = T.bagsPerShift, clean = Math.round(n * T.cleanShare), opener = T.opener.shift === shift;
  for (let k = 0; k < 200; k++) {
    const kinds = rng.shuffle([...Array(clean).fill(0), ...Array(n - clean).fill(1)]); // 1 = holds contraband
    if (runsOk(kinds) && (!opener || (kinds[0] === 1 && kinds[1] === 0))) return kinds;
  }
  return Array.from({ length: n }, (_, i) => (i + 1) % 2);
}
// Picks `n` distinct items with the given weights (a weighted shuffle: larger keys first).
function pickWeighted(rng, list, weight, n) {
  return list.map((d) => ({ d, k: Math.log(rng()) / weight(d) })).sort((a, b) => b.k - a.k).slice(0, n).map((x) => x.d);
}
function bagNames(rng, shift, holds, index) {
  if (T.opener.shift === shift && index === 0) return { contra: T.opener.contraband.slice(), harmless: T.opener.harmless.slice() };
  const [lo, hi] = T.itemsPerBag[shift - 1], total = rng.int(lo, hi);
  const pool = contrabandPool(shift).map((n) => BY_NAME[n]);
  const k = !holds ? 0 : T.maxContraband[shift - 1] > 1 && rng.chance(T.twoShare[shift - 1]) ? 2 : 1;
  const balance = shift >= T.tintFrom;   // shifts 1 and 2 teach the tint prior (all contraband is metal there); after that it is balanced
  const contra = pickWeighted(rng, pool, (d) => (balance && d.tint === 'organic' ? T.organicContraband[shift - 1] : 1), k).map((d) => d.name);
  const hpool = HARMLESS.filter((h) => !h.confusable);
  const harmless = pickWeighted(rng, hpool, (d) => (balance && d.tint === 'organic' ? T.organicHarmless : 1), total - k).map((h) => h.name);
  if (rng.chance(T.confusableShare[shift - 1])) {
    const all = HARMLESS.filter((h) => h.confusable);
    const near = all.filter((h) => contra.includes(h.confusable));
    harmless[harmless.length - 1] = (near.length && rng.chance(T.confusableNear) ? rng.pick(near) : rng.pick(all)).name;
  }
  return { contra, harmless };
}
// One shift's bags from a seed, a few placements per step (null until a bag is done) so a caller can spread the work over frames. Nothing here runs during play.
function* genShiftSteps(seed, shift) {
  const rng = makeRng(seed);
  const kinds = schedule(rng, shift);
  for (let index = 0; index < kinds.length; index++) {
    const holds = kinds[index], { contra, harmless } = bagNames(rng, shift, holds, index);
    const items = yield* packBagSteps(rng, [...contra, ...harmless], shift);
    yield { kind: holds ? 'contra' : 'clean', w: T.bagW, h: T.bagH, items };
  }
}
function genShift(seed, shift) { return { seed, shift, bags: [...genShiftSteps(seed, shift)].filter(Boolean) }; }
// The visible share of every item in a bag (not under any other item's shape), on a fine grid laid over the item's own outline.
const gridCache = new Map();
function gridOf(def, step, offset) {
  const key = `${def.name}|${step}|${offset}`;
  if (!gridCache.has(key)) {
    const xs = def.shape.flat().map((p) => p[0]), ys = def.shape.flat().map((p) => p[1]), pts = [];
    for (let y = Math.min(...ys) + step * offset; y < Math.max(...ys); y += step)
      for (let x = Math.min(...xs) + step * offset; x < Math.max(...xs); x += step) if (inShape(x, y, def.shape)) pts.push([x, y]);
    gridCache.set(key, pts);
  }
  return gridCache.get(key);
}
function visibility(bag, step = 1, offset = 0.5) {
  return bag.items.map((it) => {
    const near = bag.items.filter((o) => o !== it && o.bb.x0 < it.bb.x1 && o.bb.x1 > it.bb.x0 && o.bb.y0 < it.bb.y1 && o.bb.y1 > it.bb.y0);
    if (!near.length) return 1;
    const c = Math.cos(it.rot * DEG), s = Math.sin(it.rot * DEG), pts = gridOf(it.def, step, offset);
    let hidden = 0;
    for (const [px, py] of pts) {
      const x = it.x + px * c - py * s, y = it.y + px * s + py * c;
      for (const o of near) if (x >= o.bb.x0 && x <= o.bb.x1 && y >= o.bb.y0 && y <= o.bb.y1 && inShape(x, y, o.parts)) { hidden++; break; }
    }
    return 1 - hidden / pts.length;
  });
}

// Share of every item's outline that lies outside all other items' shapes, on points spaced `step` apart along the outline.
const edgeCache = new Map();
function outlineVisibility(bag, step = 1, offset = 0.5) {
  return bag.items.map((it) => {
    const near = bag.items.filter((o) => o !== it && o.bb.x0 < it.bb.x1 && o.bb.x1 > it.bb.x0 && o.bb.y0 < it.bb.y1 && o.bb.y1 > it.bb.y0);
    if (!near.length) return 1;
    const key = `${it.name}|${step}|${offset}`;
    if (!edgeCache.has(key)) edgeCache.set(key, outlinePoints(it.def, step, offset));
    const c = Math.cos(it.rot * DEG), s = Math.sin(it.rot * DEG), pts = edgeCache.get(key);
    let hidden = 0;
    for (const [px, py] of pts) {
      const x = it.x + px * c - py * s, y = it.y + px * s + py * c;
      for (const o of near) if (x >= o.bb.x0 && x <= o.bb.x1 && y >= o.bb.y0 && y <= o.bb.y1 && inShape(x, y, o.parts)) { hidden++; break; }
    }
    return 1 - hidden / pts.length;
  });
}

// ---------- play state ----------
let S = null;
const BAG_X = (T.designW - T.bagW) / 2;
const P = T.palette, J = T.juice, TY = T.type, LN = T.line;

let layoutMemo = null;   // the layout only changes with the viewport, so it is not rebuilt several times a frame
function layout(E) {
  const m = layoutMemo, st = E.safe.top, sb = E.safe.bottom;
  if (m && m.w === E.w && m.h === E.h && m.st === st && m.sb === sb) return m.L;
  const s = Math.min(E.w / T.designW, E.h / T.designMinH);
  const L = { s, ox: (E.w - T.designW * s) / 2, H: E.h / s, hud: st + T.hudH, top: st + T.hudH + T.hoodH, bottom: E.h - sb };
  layoutMemo = { w: E.w, h: E.h, st, sb, L };
  return L;
}
// Saves are read defensively: `shifts` that is null, an array or otherwise malformed reads as empty, and each record is coerced to numbers.
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
const multiplier = () => 1 + T.streakSteps.filter((n) => S.streak >= n).length;

const txt = (E, str, x, y, size, color, o = {}) => E.text(str, x, y, { size, color, weight: TY.weight, ...o });
const alpha = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const pathOf = (def) => {
  if (!def.path) {
    const p = new Path2D();
    for (const poly of def.shape) { poly.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); }
    def.path = p;
  }
  return def.path;
};
const plate = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
};
const fillBox = (E, x, y, w, h, color) => { E.ctx.fillStyle = color; E.ctx.fillRect(x, y, w, h); };

// ---------- preparing a shift while a card is on screen, so entering play never blocks ----------
// The bags of the next shift are generated one per frame (and the first two bags' sprites painted) while the shift card or the result card
// is showing; play then starts from ready objects. If a shift starts unprepared it is generated on the spot.
let PREP = null;
function prepare(shift, seed) {
  if (!PREP || PREP.shift !== shift || PREP.seed !== seed) PREP = { shift, seed, iter: genShiftSteps(seed, shift), bags: [], done: false, ready: false };
  return PREP;
}
function pump(E) {
  const p = PREP;
  if (!p || p.ready) return;
  if (!p.done) {   // steps until about a millisecond is used
    const t0 = performance.now();
    do { const r = p.iter.next(); if (r.done) { p.done = true; break; } if (r.value) p.bags.push(r.value); } while (performance.now() - t0 < T.prepMs);
    return;
  }
  const L = layout(E);
  let n = T.sprite.perFrame;
  for (const b of p.bags.slice(0, 2)) for (const it of b.items) if (n > 0 && !spriteOk(E, L, it)) { makeSprite(E, L, it); n--; }
  if (n > 0) p.ready = true;
}
function takeBags(shift, seed) {
  const p = PREP;
  PREP = null;
  if (p && p.shift === shift && p.seed === seed) { for (let r = p.iter.next(); !r.done; r = p.iter.next()) if (r.value) p.bags.push(r.value); return { seed, shift, bags: p.bags }; }
  return genShift(seed, shift);
}

function startShift(E, shift, seed) {
  const g = takeBags(shift, seed), L = layout(E), first = L.top / L.s + T.firstBagGap;
  // Belt distance of each bag behind the first. Rush hour sends bags in bursts (close together, then a gap) at the normal average rate.
  const rush = T.rush.includes(shift), { size, gapIn } = T.burst, gapOut = size * T.bagGap - (size - 1) * gapIn, offsets = [0];
  for (let i = 1; i < g.bags.length; i++) offsets.push(offsets[i - 1] + T.bagH + (rush ? (i % size === 0 ? gapOut : gapIn) : T.bagGap));
  S = {
    shift, seed, rush, time: 0, dist: 0, acc: 0, score: 0, streak: 0, strikes: 0, catches: 0, falseAlarms: 0, misses: 0, passes: 0, resolved: 0,
    ended: null, endT: 0, finished: false, H: L.H, exitY: L.bottom / L.s, fx: [], ghosts: [], ripples: [], stamp: null, flashT: 0, flashColor: '', log: [],
    bannerT: 0, humT: 0, scorePop: 0, badgePop: 0, lastMult: 1, streakMax: 0, probe: { t: 0, dts: [], done: false }, frames: 0, timed: 0, slow: 0, capped: false, missNames: [], faNames: [],
    bags: g.bags.map((b, i) => ({
      ...b, idx: i, y0: first - offsets[i], y: 0,
      pending: b.items.filter((it) => it.contraband).length, touched: false, missed: false, resolved: false, settled: false, gone: false,
      trayT: -1, flashT: 0, shown: false,
    })),
  };
  for (const b of S.bags) b.y = b.y0;
}

// ---------- juice helpers (cosmetic only: nothing here touches a hit shape, a clock or the score) ----------
const itemXY = (L, b, it) => [L.ox + (BAG_X + it.x) * L.s, (b.y + it.y) * L.s];
function burst(E, x, y, color, n, speed) {
  const room = J.particleCap - E.particles.list.length;
  if (room > 0 && n > 0) E.particles.emit({ x, y, count: Math.min(n, room), color, speed, life: J.particleLife, size: J.particleSize });
}
function pop(E, field, dur) { const s = S; E.tween(dur, (k) => { s[field] = 1 - k; }, ease.outBack); }
function tone(E, t, up = 0) { E.audio.beep({ ...t, freq: t.freq * (t.up || 1) ** up }); }
function addFx(text, x, y, color, big = false) { S.fx.push({ text, x, y, color, t: 0, big }); }
function flash(color) { S.flashT = J.flashLife; S.flashColor = color; }

function endShift(E, result) {
  S.ended = result; S.endT = 0;
  const clear = result === 'clear';
  const stars = clear ? (S.strikes === 0 ? 3 : S.strikes <= 1 ? 2 : 1) : 0;
  const rec = readShifts(E)[S.shift] || { best: 0, stars: 0 };
  const unlocked = clear ? E.save.set('unlocked', Math.max(readUnlocked(E), clampUnlocked(S.shift + 1))) : readUnlocked(E);
  S.result = { shift: S.shift, seed: S.seed, unlocked, result, score: S.score, strikes: S.strikes, stars, best: Math.max(rec.best, S.score), isNew: S.score > rec.best, catches: S.catches, falseAlarms: S.falseAlarms, misses: S.misses, time: S.time };
  E.save.update('shifts', (all) => ({ ...cleanShifts(all), [S.shift]: { best: S.result.best, stars: Math.max(rec.stars, stars) } }), {});
  if (E.ledger) E.ledger.add('shift', { shift: S.shift, seed: S.seed, result, score: S.score, strikes: S.strikes, missed: S.misses, falseAlarms: S.falseAlarms, stars, catches: S.catches, passes: S.passes, bags: S.resolved, time: +S.time.toFixed(1), streakMax: S.streakMax, bloom: bloomLevel, slow: +(S.slow / Math.max(1, S.timed)).toFixed(3), capped: S.capped ? 1 : 0, dpr: +(E.dpr || 1).toFixed(2), missedItems: S.missNames.join(','), falseItems: S.faNames.join(',') });
  S.log.push({ t: S.time, e: result });
  S.stamp = { text: clear ? 'CLEARED' : 'SHIFT OVER', color: clear ? P.clean : P.catch, t: 0 };
  prepare(S.shift, S.seed);   // Retry replays this seed: it is built behind the stamp and the card, so an early Retry never stalls
  E.audio.play(clear ? 'win' : 'lose');
  if (clear) E.haptic(J.haptic.clear); else E.shake(...J.shake.over);
}
function strike(E) {
  S.strikes++; S.streak = 0; S.lastMult = 1;
  if (S.strikes >= T.strikesMax) endShift(E, 'over');
}
function bagDone(E, b, correct) {
  b.resolved = true; S.resolved++;
  if (correct) {
    S.streak++; S.streakMax = Math.max(S.streakMax, S.streak);
    const m = multiplier();
    if (m > S.lastMult) { S.lastMult = m; pop(E, 'badgePop', J.badgePop); tone(E, J.tones.step, m - 2); }
  }
  if (!S.ended && S.resolved === S.bags.length) endShift(E, 'clear');
}

function catchItem(E, b, it) {
  const L = layout(E), f = clamp((b.y + it.y) / S.exitY, 0, 1);
  const pts = Math.round(T.catchBase * (T.earlyMax + (T.earlyMin - T.earlyMax) * f) * multiplier());
  it.state = 1; it.flagT = 0; b.pending--; S.catches++; S.score += pts;
  const big = pts >= J.bigCatch, [x, y] = itemXY(L, b, it);
  E.audio.play('hit'); E.haptic(J.haptic.catch);
  burst(E, x, y, P.catch, big ? J.burst.big : J.burst.catch, J.burstSpeed);
  burst(E, x, y, P[it.def.tint], J.burst.tint, J.burstSpeed * 0.6);
  if (big) E.shake(...J.shake.big);
  pop(E, 'scorePop', J.pop);
  addFx(f < J.earlyLabel ? `+${pts}, early` : `+${pts}`, BAG_X + it.x, b.y + it.y, P.catch, big);
  S.log.push({ t: S.time, e: 'catch', item: it.name, pts });
  if (b.pending === 0) b.trayT = 0;   // the bag slides sideways into the tray
  if (b.pending === 0) bagDone(E, b, !b.touched && !b.missed);
}
function falseAlarm(E, b, it) {
  const L = layout(E), [x, y] = itemXY(L, b, it);
  it.state = 2; it.flagT = 0; b.touched = true; b.flashT = J.bagFlash; S.falseAlarms++;
  for (const t of J.tones.falseAlarm) tone(E, t);
  E.haptic(J.haptic.falseAlarm); E.shake(...J.shake.falseAlarm); E.flash(P.falseAlarm, J.screenFlash);
  burst(E, x, y, P.falseAlarm, J.burst.falseAlarm, J.burstSpeed * 0.7);
  addFx('False alarm', BAG_X + it.x, b.y + it.y, P.falseAlarm);
  S.log.push({ t: S.time, e: 'false', item: it.name }); S.faNames.push(it.name);
  strike(E);
}
function missItem(E, b, it) {
  const L = layout(E);
  it.state = 3; b.pending--; b.missed = true; S.misses++;
  tone(E, J.tones.miss); E.haptic(J.haptic.miss); E.shake(...J.shake.miss); flash(P.catch);
  S.ghosts.push({ it, t: 0 });
  burst(E, clamp(L.ox + (BAG_X + it.x) * L.s, 30, E.w - 30), L.bottom - J.cueLift - 20, P.catch, J.burst.miss, J.burstSpeed * 0.5);
  S.log.push({ t: S.time, e: 'miss', item: it.name }); S.missNames.push(it.name);
  strike(E);
  if (b.pending === 0) bagDone(E, b, false);
}
function passBag(E, b) {
  b.passed = true; S.passes++;
  const pts = T.cleanBase * multiplier();
  S.score += pts;
  for (const t of J.tones.pass) tone(E, t);
  flash(P.clean);
  S.fx.push({ text: `Clean +${pts}`, x: T.designW / 2, y: 0, color: P.clean, t: 0, bottom: true });
  S.log.push({ t: S.time, e: 'pass', pts });
  bagDone(E, b, true);
}

function step(E) {
  S.dist += T.beltSpeed[S.shift - 1] * T.simStep; S.time += T.simStep;
  for (const b of S.bags) {
    if (b.gone) continue;
    b.y = b.y0 + S.dist;
    if (b.y + b.h < 0) continue;
    if (b.pending > 0) for (const it of b.items) if (it.contraband && it.state === 0 && b.y + it.bb.y0 >= S.exitY && !S.ended) missItem(E, b, it);
    // Items resolve their exit at the bottom safe inset (the home-indicator strip is not part of the belt): a missed item when it has left it,
    // a clean bag when its bottom edge reaches it, while it is still on screen.
    if (b.kind === 'clean' && !b.settled && b.y + b.h >= S.exitY && !S.ended) { b.settled = true; if (b.touched) bagDone(E, b, false); else passBag(E, b); }
    if (b.y >= S.H) { b.gone = true; for (const it of b.items) it.spr = null; }
  }
}

// A tap resolves to one thing. Uncaught contraband under the finger always wins; else an already flagged item swallows the tap
// (a double tap must not cost a strike); else the nearest harmless item is a false alarm; else nothing. A bag that is sliding
// into the tray is done and takes no taps.
function tapAt(E, x, y) {
  if (!S || S.ended) return;
  const L = layout(E);
  if (y < L.top || y > L.bottom) return;   // the hood above and the home-indicator strip below are not the belt
  const px = (x - L.ox) / L.s, py = y / L.s;
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

// ---------- drawing: glowing X-ray outlines on a lit belt under a scanner hood ----------
// The engine clears to the belt colour, so the belt is only its rollers. At a high pixel ratio every separate shape drawn each frame costs, so
// where the browser can, the two roller rails are painted once into tall strips and scrolled by moving the copy (two blits instead of ~200 fills).
let railTex = null;
function railStrips(E, L) {
  if (typeof OffscreenCanvas !== 'function') return null;
  const k = spriteScale(E, L), h = Math.ceil(L.H) + 20;
  if (railTex && railTex.k === k && railTex.h === h) return railTex;
  const cv = new OffscreenCanvas(Math.ceil(22 * k), Math.ceil(h * k)), c = cv.getContext('2d');
  c.scale(cv.width / 22, cv.height / h);
  for (let y = 0; y < h; y += 20) { c.fillStyle = P.roller; c.fillRect(3, y, 16, 9); c.fillStyle = alpha(P.rollerHi, 0.75); c.fillRect(3, y, 16, 2); }
  railTex = { k, h, cv: freeze(cv) };
  return railTex;
}
function drawBelt(ctx, E, L) {
  const W = T.designW, H = L.H, off = S.dist % 20, tex = railStrips(E, L);
  if (tex) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tex.cv, 0, off - 20, 22, tex.h); ctx.drawImage(tex.cv, W - 22, off - 20, 22, tex.h);
  } else {
    ctx.fillStyle = P.roller; ctx.beginPath();
    for (let y = off - 20; y < H; y += 20) { ctx.rect(3, y, 16, 9); ctx.rect(W - 19, y, 16, 9); }
    ctx.fill();
    ctx.fillStyle = alpha(P.rollerHi, 0.75); ctx.beginPath();
    for (let y = off - 20; y < H; y += 20) { ctx.rect(3, y, 16, 2); ctx.rect(W - 19, y, 16, 2); }
    ctx.fill();
  }
  ctx.strokeStyle = alpha(P.metal, 0.28); ctx.lineWidth = LN.edge;
  ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(22, H); ctx.moveTo(W - 22, 0); ctx.lineTo(W - 22, H); ctx.stroke();
}

// ---------- item painting: one function, used for the sprite and for the direct fallback ----------
// Draws the item's outline, already translated and rotated to its place. Only the tint (or the flag colour) decides how: never the item's name,
// its contraband flag or its position. The bloom passes are additive; the core stroke is not, so amber stays amber and blue stays blue.
let bloomLevel = 3, spriteEpoch = 0;   // the level is measured in the first seconds of a shift and then kept
function paintItem(ctx, def, color, flagged) {
  const p = pathOf(def);
  ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = alpha(color, flagged ? 0.34 : 0.2); ctx.fill(p);
  if (bloomLevel >= 3) { ctx.strokeStyle = alpha(color, 0.07); ctx.lineWidth = LN.halo; ctx.stroke(p); }
  if (bloomLevel >= 1) { ctx.strokeStyle = alpha(color, 0.16); ctx.lineWidth = LN.glow; ctx.stroke(p); }
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = alpha(color, 1); ctx.lineWidth = flagged ? LN.core + 1 : LN.core; ctx.stroke(p);
}
const flagColor = (it) => (it.state === 1 ? P.catch : it.state === 2 ? P.falseAlarm : P[it.def.tint]);   // the tint alone, until flagged

const canSprite = () => typeof OffscreenCanvas === 'function';
// A finished sprite is frozen into an ImageBitmap where the browser can: copying one onto the belt is much cheaper than copying a canvas.
const freeze = (cv) => (typeof cv.transferToImageBitmap === 'function' ? cv.transferToImageBitmap() : cv);
const spriteScale = (E, L) => L.s * (E.dpr || 1);
// Usable: right scale and right flag colour (an older bloom level is fine to draw). Fresh: also painted at the current bloom level.
const spriteUsable = (E, L, it) => !!(it.spr && it.spr.k === spriteScale(E, L) && it.spr.state === it.state);
const spriteOk = (E, L, it) => !canSprite() || (spriteUsable(E, L, it) && it.spr.epoch === spriteEpoch);
// The item painted once, bloom and all, into a canvas that is copied onto the belt every frame.
function makeSprite(E, L, it) {
  const k = spriteScale(E, L), pad = bloomLevel >= 3 ? LN.halo / 2 + 2 : bloomLevel >= 1 ? LN.glow / 2 + 2 : LN.core + 1, w = Math.ceil((it.bb.x1 - it.bb.x0 + 2 * pad) * k), h = Math.ceil((it.bb.y1 - it.bb.y0 + 2 * pad) * k);
  const cv = new OffscreenCanvas(w, h), c = cv.getContext('2d'), sx = it.x - it.bb.x0 + pad, sy = it.y - it.bb.y0 + pad;
  c.scale(k, k); c.translate(sx, sy); c.rotate(it.rot * DEG);
  paintItem(c, it.def, flagColor(it), it.state !== 0);
  it.spr = { cv: freeze(cv), k, w, h, sx, sy, pad, epoch: spriteEpoch, state: it.state };
}
// A few sprites a frame, for the bags about to come out of the hood.
function ensureSprites(E, L) {
  if (!canSprite()) return;
  let n = T.sprite.perFrame, r = T.sprite.rebuild;
  for (const b of S.bags) {
    if (b.gone || b.y + b.h < L.top / L.s - T.sprite.ahead) continue;
    if (b.y < -T.sprite.ahead * 4 - b.h * 2) break;
    for (const it of b.items) {
      if (!spriteUsable(E, L, it)) { if (n <= 0) continue; makeSprite(E, L, it); n--; }          // missing: paint before it is needed
      else if (it.spr.epoch !== spriteEpoch) { if (r <= 0) continue; makeSprite(E, L, it); r--; }   // stale after a downgrade: repaint in the background
    }
  }
}

function drawItem(ctx, E, L, b, it) {
  if (canSprite() && spriteUsable(E, L, it)) {
    ctx.imageSmoothingEnabled = b.trayT >= 0;   // a plain copy is exact; the sliding bag is rotated, so it is smoothed
    ctx.drawImage(it.spr.cv, BAG_X + it.bb.x0 - it.spr.pad, b.y + it.bb.y0 - it.spr.pad, it.spr.w / it.spr.k, it.spr.h / it.spr.k);
  } else {
    ctx.save();
    ctx.translate(BAG_X + it.x, b.y + it.y); ctx.rotate(it.rot * DEG);
    paintItem(ctx, it.def, flagColor(it), it.state !== 0);
    ctx.restore();
  }
  if (it.state === 1 || it.state === 2) {
    const k = it.flagT < 0 ? 1 : clamp(it.flagT / J.ringSnap, 0, 1);
    ctx.globalAlpha = Math.min(1, 0.3 + k * 3);
    ctx.strokeStyle = it.state === 1 ? P.catch : P.falseAlarm; ctx.lineWidth = LN.ring;
    ctx.beginPath(); ctx.arc(BAG_X + it.x, b.y + it.y, it.def.rad + 8 + J.ringFrom * (1 - ease.outBack(k)), 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawBag(ctx, E, L, b) {
  const edge = b.touched ? P.falseAlarm : b.passed ? P.clean : P.bagEdge, cx = BAG_X + b.w / 2, cy = b.y + b.h / 2;
  ctx.save();
  if (b.trayT >= 0) {
    const k = clamp(b.trayT / J.tray, 0, 1), e = ease.inQuad(k);
    ctx.globalAlpha = 1 - 0.6 * k;
    ctx.translate(e * J.trayDist + cx, cy); ctx.rotate(J.trayTilt * e); ctx.translate(-cx, -cy);
  }
  // The bag is an outline over the belt (a fill would cost a big opaque area every frame at high pixel ratios).
  plate(ctx, BAG_X, b.y, b.w, b.h, 18);
  if (b.touched || b.passed) { ctx.strokeStyle = alpha(edge, 0.25); ctx.lineWidth = 8; ctx.stroke(); }
  ctx.strokeStyle = edge; ctx.lineWidth = LN.edge; ctx.stroke();
  ctx.strokeStyle = alpha(edge, 0.8);
  ctx.beginPath();
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const x = sx > 0 ? BAG_X + 8 : BAG_X + b.w - 8, y = sy > 0 ? b.y + 8 : b.y + b.h - 8;
    ctx.moveTo(x + sx * 14, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * 14);
  }
  ctx.stroke();
  for (const it of b.items) if (b.y + it.bb.y1 + 10 >= L.top / L.s && b.y + it.bb.y0 <= L.H) drawItem(ctx, E, L, b, it);   // nothing hidden under the hood or below the belt is drawn
  if (b.flashT > 0) { plate(ctx, BAG_X, b.y, b.w, b.h, 18); ctx.fillStyle = alpha(P.falseAlarm, 0.35 * (b.flashT / J.bagFlash)); ctx.fill(); }
  ctx.restore();
}

// The hood the bags slide out from: a housing under the HUD with a glowing lip and rubber curtain strips over the bag entrance.
let hoodTex = null;
function paintHood(c, x, w, h) {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, P.hood); g.addColorStop(1, P.strip);
  c.fillStyle = g; c.fillRect(x, 0, w, h);
  const beam = c.createLinearGradient(0, h, 0, h + 22);
  beam.addColorStop(0, alpha(P.metal, 0.2)); beam.addColorStop(1, alpha(P.metal, 0));
  c.fillStyle = beam; c.fillRect(x, h, w, 22);
  c.fillStyle = alpha(P.metal, 0.6); c.fillRect(x, h - 2, w, 2);
  c.fillStyle = P.hoodLip; c.fillRect(x, 0, w, 2);
  const n = 15, sw = (w - 8) / n;
  c.fillStyle = alpha(P.strip, 0.96); c.beginPath();
  for (let i = 0; i < n; i++) c.rect(x + 4 + i * sw + 1.5, h - 1, sw - 3, 8);
  c.fill();
  c.font = `${TY.weight} ${TY.small}px system-ui, sans-serif`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = P.dim;
  c.fillText('X-RAY', x + 14, h / 2 - 2);
}
// The hood the bags slide out from: a housing under the HUD with a glowing lip and rubber curtain strips over the bag entrance. It never
// changes, so it is painted once and copied.
function drawHood(E, L) {
  const ctx = E.ctx, x = L.ox - 4, w = T.designW * L.s + 8, h = L.top - L.hud, dpr = E.dpr || 1;
  if (typeof OffscreenCanvas === 'function') {
    if (!hoodTex || hoodTex.w !== w || hoodTex.h !== h || hoodTex.dpr !== dpr) {
      const cv = new OffscreenCanvas(Math.ceil(w * dpr), Math.ceil((h + 22) * dpr)), c = cv.getContext('2d');
      c.scale(cv.width / w, cv.height / (h + 22)); paintHood(c, 0, w, h);
      hoodTex = { w, h, dpr, cv: freeze(cv) };
    }
    ctx.drawImage(hoodTex.cv, x, L.hud, w, h + 22);
  } else {
    ctx.save(); ctx.translate(0, L.hud); paintHood(ctx, x, w, h); ctx.restore();
  }
  if (S.rush) txt(E, 'RUSH', x + w - 14, (L.hud + L.top) / 2 - 2, TY.small, P.organic, { align: 'right', alpha: 0.6 + 0.4 * Math.sin(E.time * 6) });
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
  fillBox(E, 0, L.hud - 3, E.w * (S.resolved / S.bags.length), 3, P.bagEdge);
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

const prune = (list, life) => { for (let i = list.length - 1; i >= 0; i--) if (list[i].t >= life) list.splice(i, 1); };   // in place: nothing is allocated when nothing expires

// Watches the frames of a shift. During the first seconds a rolling window of recent frame times can lower the bloom (never raise it); a steady
// 30 fps cap counts as healthy. The whole shift's slow share is kept for the ledger.
function probeFrames(dt) {
  const pr = S.probe, B = T.bloom;
  S.frames++;
  if (S.frames <= B.warm) return;
  S.timed++; if (dt * 1000 > B.slowMs) S.slow++;
  pr.dts.push(dt); if (pr.dts.length > B.window) pr.dts.shift();
  if (pr.done) return;
  pr.t += dt;
  if (pr.t >= B.probe) pr.done = true;
  if (pr.dts.length < B.minFrames || S.frames % B.every) return;
  const sorted = pr.dts.slice().sort((x, y) => x - y), q = (p) => sorted[Math.floor(p * (sorted.length - 1))] * 1000;
  S.capped = q(0.5) >= B.capMs[0] && q(0.5) <= B.capMs[1] && q(0.9) - q(0.1) <= B.capSpread;
  if (S.capped) return;
  const share = sorted.filter((d) => d * 1000 > B.slowMs).length / sorted.length;
  const want = share <= B.threeShare ? 3 : share <= B.oneShare ? 1 : 0;
  if (want < bloomLevel) { bloomLevel = want; spriteEpoch++; }
}

const play = {
  enter(E, params = {}) {
    startShift(E, params.shift || 1, params.seed ?? ((E.rng() * 2 ** 32) >>> 0));
  },
  update(dt, E) {
    const L = layout(E);
    S.H = L.H; S.exitY = L.bottom / L.s;
    probeFrames(dt);
    ensureSprites(E, L);
    for (const f of S.fx) f.t += dt;
    prune(S.fx, J.fxLife);
    for (const g of S.ghosts) g.t += dt;
    prune(S.ghosts, J.ghostLife);
    for (const r of S.ripples) r.t += dt;
    prune(S.ripples, J.ripple);
    if (S.flashT > 0) S.flashT -= dt;
    if (S.bannerT > 0) S.bannerT -= dt;
    if (S.stamp) S.stamp.t += dt;
    for (const b of S.bags) {
      if (b.gone) continue;
      if (b.flashT > 0) b.flashT -= dt;
      if (b.trayT >= 0) b.trayT += dt;
      for (const it of b.items) if (it.flagT >= 0) it.flagT += dt;
      if (S.rush && !b.shown && b.idx % T.burst.size === 0 && b.y + b.h * 0.4 >= L.top / L.s) { b.shown = true; S.bannerT = J.banner; if (!S.ended) tone(E, J.tones.rush); }
    }
    if (S.ended) {
      pump(E);
      S.endT += dt;
      if (S.endT >= J.endDelay && !S.finished) { S.finished = true; E.setScene('over', S.result); }
      return;
    }
    S.humT -= dt;
    if (S.humT <= 0) {
      S.humT += J.hum.every;
      E.audio.beep({ freq: J.hum.base + J.hum.step * Math.min(S.streak, J.hum.maxStreak), dur: J.hum.every * 1.6, type: 'triangle', gain: J.hum.gain * (S.rush ? J.hum.rush : 1) });
    }
    S.acc += dt;
    while (S.acc >= T.simStep - 1e-9 && !S.ended) { S.acc -= T.simStep; step(E); }
  },
  onPointerDown(p, E) {
    if (S.ripples.length < J.rippleMax && !S.ended && p.y >= layout(E).top) S.ripples.push({ x: p.x, y: p.y, t: 0 });   // the touch answers inside the frame
    tapAt(E, p.x, p.y);
  },
  onPause(E) {
    if (S && !S.ended && E.ledger) E.ledger.add('quit', { shift: S.shift, seed: S.seed, score: S.score, bag: S.resolved });
    if (S && !S.ended) E.setScene('menu');
  },
  render(ctx, E) {
    const L = layout(E);
    ctx.save();
    ctx.translate(L.ox, 0); ctx.scale(L.s, L.s);
    drawBelt(ctx, E, L);
    for (const b of S.bags) if (!b.gone && b.y < L.H && b.y + b.h >= 0 && !(b.trayT >= J.tray)) drawBag(ctx, E, L, b);
    ctx.restore();
    drawHood(E, L);
    if (S.flashT > 0) { ctx.globalAlpha = Math.min(1, S.flashT / J.flashLife) * 0.9; ctx.fillStyle = S.flashColor; ctx.fillRect(0, L.bottom - 10, E.w, 10); ctx.globalAlpha = 1; }
    // The miss cue: after the strike, the ghost of the missed item pulses at the bottom edge.
    for (const g of S.ghosts) {
      const it = g.it, gx = clamp(L.ox + (BAG_X + it.x) * L.s, (it.x - it.bb.x0) * L.s + 8, E.w - (it.bb.x1 - it.x) * L.s - 8), gy = L.bottom - J.cueLift - (it.bb.y1 - it.y) * L.s;
      const a = (0.35 + 0.65 * Math.abs(Math.sin(g.t * 9))) * Math.min(1, (J.ghostLife - g.t) * 4);
      ctx.save(); ctx.translate(gx, gy); ctx.scale(L.s, L.s); ctx.rotate(it.rot * DEG);
      ctx.lineJoin = 'round'; ctx.strokeStyle = alpha(P.catch, a); ctx.lineWidth = LN.ring; ctx.stroke(pathOf(it.def));
      ctx.restore();
      txt(E, `Missed: ${it.name}`, clamp(gx, 90, E.w - 90), gy - (it.y - it.bb.y0) * L.s - 16, TY.medium, P.catch, { alpha: a });
    }
    for (const r of S.ripples) { const k = r.t / J.ripple; ctx.globalAlpha = 1 - k; ctx.strokeStyle = P.text; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(r.x, r.y, 8 + J.rippleR * ease.outQuad(k), 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1;
    for (const f of S.fx) {
      const k = f.t / J.fxLife, sc = 1 + (f.big ? 0.5 : 0.3) * (1 - ease.outBack(Math.min(1, k * 4)));
      ctx.save(); ctx.translate(clamp(L.ox + f.x * L.s, 70, E.w - 70), (f.bottom ? L.bottom - 70 : f.y * L.s) - 36 * k); ctx.scale(sc, sc);
      txt(E, f.text, 0, 0, f.big ? TY.large : TY.medium, f.color, { alpha: 1 - k * k });
      ctx.restore();
    }
    if (S.bannerT > 0) {
      const k = S.bannerT / J.banner, sc = 1 + 0.25 * Math.max(0, k - 0.7) / 0.3;
      ctx.save(); ctx.translate(E.w / 2, L.top + 44); ctx.scale(sc, sc);
      txt(E, 'RUSH HOUR', 0, 0, TY.large, P.organic, { alpha: Math.min(1, k * 3) });
      ctx.restore();
    }
    drawHud(E, L);
    drawStamp(E);
  },
};

// ---------- menu and card ----------
const drawStar = (ctx, cx, cy, r, on) => {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  ctx.closePath();
  if (on) { ctx.fillStyle = P.star; ctx.fill(); } else { ctx.strokeStyle = P.dim; ctx.lineWidth = 2; ctx.stroke(); }
};
// A button that answers the touch at once: it shrinks while pressed, and pops in when `grow` (0..1) is below 1.
function button(E, label, cx, cy, opts, pressed, grow = 1) {
  const ctx = E.ctx, s = (pressed ? J.press : 1) * (0.7 + 0.3 * ease.outBack(grow));
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy);
  const r = E.button(label, cx, cy, { color: P.text, size: TY.medium, ...opts });
  ctx.restore();
  return r;
}

const shapesOf = (shift) => T.newContraband[shift - 1].map((n) => BY_NAME[n]);

const menu = {
  enter() { this.cells = []; this.btnMute = null; this.down = null; },
  render(ctx, E) {
    const shifts = readShifts(E), unlocked = readUnlocked(E);
    const ty = E.safe.top + Math.max(84, E.h * 0.1);   // clear of the engine's EXPORT tab (top left, 82 x 48) and TUNE tab (top right)
    E.titleArea = { x: 0, y: ty - 28, w: E.w, h: 60 };   // where the release channel's five-tap gesture listens
    ctx.save(); ctx.shadowColor = P.metal; ctx.shadowBlur = 18;
    txt(E, 'CHECKPOINT', E.w / 2, ty, TY.large, P.metal);
    ctx.restore();
    txt(E, 'Tap the contraband', E.w / 2, ty + 34, TY.small, P.dim);
    const n = T.beltSpeed.length, cols = 2, gap = 8, cw = Math.min(170, (E.w - 24 - gap) / cols), ch = 58, top = ty + 66;
    const x0 = (E.w - (cw * cols + gap)) / 2;
    this.cells = [];
    for (let i = 0; i < n; i++) {
      const col = i % cols, row = Math.floor(i / cols), x = x0 + col * (cw + gap), y = top + row * (ch + 8), open = i + 1 <= unlocked, rec = shifts[i + 1] || { best: 0, stars: 0 };
      const cell = { x, y, w: cw, h: ch, shift: i + 1, open }, pressed = this.down === cell.shift;
      ctx.save(); ctx.translate(x + cw / 2, y + ch / 2); ctx.scale(pressed ? J.press : 1, pressed ? J.press : 1); ctx.translate(-x - cw / 2, -y - ch / 2);
      E.roundRect(x, y, cw, ch, 12, pressed ? P.bagEdge : open ? P.panel : P.panelOff, open ? P.bagEdge : P.panelOffEdge);
      txt(E, `Shift ${i + 1}`, x + 12, y + 18, TY.medium, open ? P.text : P.textOff, { align: 'left' });
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
    if (c) { if (c.open) E.setScene('brief', { shift: c.shift }); else E.toast(`Clear shift ${c.shift - 1} first`); }
    else if (this.btnMute && E.hit(this.btnMute, p)) E.audio.toggleMute();
  },
};

// The shift card: what is new today, drawn and named, while the shift is built behind it a bag a frame. Shapes are never taught by a strike alone.
const brief = {
  enter(E, params) {
    this.shift = params.shift; this.seed = (E.rng() * 2 ** 32) >>> 0; this.t0 = E.time; this.down = null; this.btnStart = this.btnMenu = null;
    prepare(this.shift, this.seed);
    const fresh = shapesOf(this.shift);
    if (fresh.length && E.ledger) E.ledger.add('newshapes', { shift: this.shift, shapes: fresh.map((d) => d.name).join(',') });
  },
  update(dt, E) { pump(E); },
  render(ctx, E) {
    const shift = this.shift, fresh = shapesOf(shift), cx = E.w / 2, top = E.safe.top;
    txt(E, `Shift ${shift}`, cx, top + Math.max(84, E.h * 0.11), TY.large, P.text);
    if (T.rush.includes(shift)) txt(E, 'RUSH HOUR', cx, top + Math.max(84, E.h * 0.11) + 34, TY.medium, P.organic);
    txt(E, T.brief[shift - 1], cx, top + Math.max(84, E.h * 0.11) + (T.rush.includes(shift) ? 62 : 34), TY.small, P.dim);
    const y0 = E.h * 0.42;
    if (fresh.length) {
      txt(E, 'New contraband today', cx, y0 - 76, TY.medium, P.organic);
      const cw = Math.min(112, (E.w - 32) / fresh.length);
      fresh.forEach((d, i) => {
        const x = cx + (i - (fresh.length - 1) / 2) * cw, k = Math.min(1.2, 84 / d.size);
        ctx.save(); ctx.translate(x, y0); ctx.scale(k, k);
        paintItem(ctx, d, P[d.tint], false);
        ctx.restore();
        txt(E, d.name, x, y0 + 62, TY.small, P.text);
      });
    }
    else if (T.tips[shift - 1]) {
      txt(E, 'Tip', cx, y0 - 30, TY.small, P.dim);
      txt(E, T.tips[shift - 1], cx, y0, TY.medium, P.text);
    }
    const ready = PREP && PREP.shift === shift && PREP.ready;
    this.btnStart = ready ? button(E, 'Start', cx, E.h * 0.68, { fill: P.button }, this.down === 'start', clamp((E.time - this.t0) / 0.3, 0, 1)) : null;
    if (!ready) txt(E, 'Loading', cx, E.h * 0.68, TY.medium, P.dim);
    this.btnMenu = button(E, 'Menu', cx, E.h * 0.68 + 68, { fill: P.buttonQuiet }, this.down === 'menu');
  },
  onPointerDown(p, E) { this.down = this.btnStart && E.hit(this.btnStart, p) ? 'start' : this.btnMenu && E.hit(this.btnMenu, p) ? 'menu' : null; },
  onPointerUp() { this.down = null; },
  onTap(p, E) {
    if (this.btnStart && E.hit(this.btnStart, p)) E.setScene('play', { shift: this.shift, seed: this.seed });
    else if (this.btnMenu && E.hit(this.btnMenu, p)) E.setScene('menu');
  },
};

const over = {
  enter(E, r) {
    this.r = r; this.t0 = E.time; this.btns = {}; this.down = null;
    prepare(r.shift, r.seed);   // Retry replays this seed, so it is built while the card counts up
  },
  update(dt, E) { pump(E); },
  render(ctx, E) {
    const r = this.r, cleared = r.result === 'clear', cx = E.w / 2, h = E.h, k = E.time - this.t0;
    txt(E, cleared ? 'CLEARED' : 'SHIFT OVER', cx, h * 0.17, TY.large, cleared ? P.clean : P.catch);
    for (let i = 0; i < 3; i++) {
      const on = i < r.stars, kk = on ? clamp((k - J.cardStars * (i + 1)) / 0.3, 0, 1) : 1;
      drawStar(ctx, cx + (i - 1) * 48, h * 0.27, 19, false);
      if (on && kk > 0) drawStar(ctx, cx + (i - 1) * 48, h * 0.27, 19 * ease.outBack(kk), true);
    }
    const shown = Math.round(r.score * ease.outCubic(clamp((k - 0.1) / J.cardCount, 0, 1)));
    txt(E, String(shown), cx, h * 0.37, TY.large, P.text);
    txt(E, r.isNew && r.score > 0 ? 'New best' : `Best ${r.best}`, cx, h * 0.37 + 40, TY.medium, P.organic);
    txt(E, `Missed ${r.misses}, false alarms ${r.falseAlarms}`, cx, h * 0.37 + 68, TY.medium, r.strikes ? P.text : P.dim);
    txt(E, T.starRule, cx, h * 0.37 + 96, TY.small, P.dim);
    const next = cleared && r.shift < T.beltSpeed.length, grow = clamp((k - J.cardButtons) / 0.3, 0, 1);
    this.btns = {};
    if (grow <= 0) return;   // the buttons come after the beat, so a tap during it is not swallowed by one
    let y = h * 0.62;
    if (next) { this.btns.next = button(E, 'Next shift', cx, y, { fill: P.button }, this.down === 'next', grow); y += 68; }
    this.btns.retry = button(E, 'Retry', cx, y, next ? { fill: P.buttonQuiet } : { fill: P.button }, this.down === 'retry', grow); y += 68;
    this.btns.menu = button(E, 'Menu', cx, y, { fill: P.buttonQuiet }, this.down === 'menu', grow);
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
  saveVersion: 2,
  // v1 kept `unlocked` next to the per-shift records; v2 derives it from them (the highest shift with stars, plus one) and clamps it.
  migrate(data, fromVersion) {
    if (fromVersion < 2) {
      const cleared = Object.entries(cleanShifts(data.shifts)).filter(([, r]) => r.stars > 0).map(([n]) => Number(n));
      data.unlocked = clampUnlocked(Math.max(0, ...cleared) + 1);
    }
    return data;
  },
  TUNING,
  start: 'menu',
  scenes: { menu, brief, play, over },
  // Read by tools/sim-checkpoint.mjs so the harness runs the real generation, tap resolution and scoring.
  sim: {
    ITEMS, genShift, genShiftSteps, prepare, pump, bloom: () => ({ level: bloomLevel, epoch: spriteEpoch }), setBloom(level) { bloomLevel = level; spriteEpoch++; }, readShifts, cleanShifts, visibility, outlineVisibility, layout, clampUnlocked,
    // Item pairs in a bag whose shapes overlap.
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
        for (const it of b.items) out.push({ id: `${b.idx}:${b.items.indexOf(it)}`, name: it.name, contraband: it.contraband, state: it.state, cy: b.y + it.y, x: L.ox + (BAG_X + it.x) * L.s, y: (b.y + it.y) * L.s });
      }
      return out;
    },
  },
};
