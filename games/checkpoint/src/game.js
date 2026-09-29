// game.js - Checkpoint, layer 1 (mechanic). Grey-box: bags on an X-ray belt, tap the contraband, leave clean bags alone.
//
// Coordinates: play is laid out in design units, 360 wide, scaled to the screen by layout(). Belt speed, item outlines,
// bags and the hit margin are all in design units. Item outlines are lists of polygons around the item's own origin
// (its centre, y down). Randomness only builds the bags (genShift, seeded); every tap resolves the same way (ADR-0008).
// The shift clock runs in fixed steps (TUNING.simStep) so the same seed and tap times score the same at any frame rate.

import { makeRng, clamp } from './engine.js';

const TUNING = {
  bg: '#040914',

  // PRD section 16
  bagsPerShift: 20,
  strikesMax: 3,
  beltSpeed: [70, 80, 90, 100, 120, 110, 120, 130, 140, 160],           // units/s per shift; 5 and 10 are rush hour
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
  //   5      rush hour: faster belt, denser bags                              read the dense corner first, tap as soon as the shape is clear
  //   6      all ten shapes; slower belt to digest the dense bags             catch early: points fall with the bag
  //   7      heavier overlap and more pairs                                    scan bag by bag, never linger on a clean one
  //   8      most look-alikes                                                 a false alarm costs a strike: hesitate on hairdryer, pen, phone, belt
  //   9      near-full clutter at speed                                       read each bag in one pass, top to bottom
  //   10     rush hour again: everything at once                              all of the above
  rush: [5, 10],
  rotMax: [20, 30, 45, 60, 90, 90, 120, 150, 180, 180],                 // item rotation, degrees either way
  maxContraband: [1, 1, 1, 2, 2, 2, 2, 2, 2, 2],                        // per bag
  twoShare: [0, 0, 0, 0.2, 0.25, 0.25, 0.3, 0.3, 0.3, 0.25],           // share of contraband bags holding two (where two are allowed)
  overlapBias: [0, 0, 0.35, 0.4, 0.55, 0.45, 0.5, 0.55, 0.55, 0.45],     // chance an item is dropped near another one (clutter), once overlap is on
  confusableShare: [0, 0, 0, 0.2, 0.35, 0.3, 0.35, 0.4, 0.35, 0.25],       // share of bags holding one harmless look-alike
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

  // Timing
  simStep: 1 / 120,
  endDelay: 0.9,                 // seconds the last frame stays before the card
  cardDelay: 0.6,                // card ignores taps this long
  fxLife: 0.9,
  flashLife: 0.5,
  ghostLife: 1,                  // seconds the ghost of a missed item pulses at the bottom edge
  cueLift: 14,                   // px the bottom cues sit above the safe inset

  // PRD section 11
  colors: {
    organic: '#ff9a1f', metal: '#4aa8ff', catch: '#ff3b47', falseAlarm: '#ffe61a', clean: '#38e07b',
    belt: '#08122a', roller: '#16305c', bag: '#0d1c3c', bagEdge: '#2a5a9a', hud: '#040914', text: '#dbe7ff', dim: '#7f95b8',
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
  { name: 'toothbrush', tint: 'organic', confusable: 'box cutter', shape: [[[-38, -4], [2, -4], [10, -10], [38, -10], [38, 10], [10, 10], [2, 4], [-38, 4]]] },
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
  { name: 'belt', tint: 'organic', confusable: 'hammer', shape: [rect(-42, -4, 64, 8), rect(20, -10, 24, 20)] },
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
  return { def, name: def.name, contraband: def.contraband, x, y, rot, parts, pts: def.samples.map(tr), epts: def.edge.map(tr), bb, cov: null, ecov: null, hidden: 0, ehidden: 0, state: 0 };
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
      const a = rng.pick(placed);
      x = clamp(a.x + rng.range(-0.5, 0.5) * a.def.size, x0, x1); y = clamp(a.y + rng.range(-0.5, 0.5) * a.def.size, y0, y1);
    } else { x = rng.range(x0, x1); y = rng.range(y0, y1); }
    const it = instance(def, x, y, rot);
    if (commit(it, placed, rule)) return it;
  }
  return null;
}
function packBag(rng, names, shift) {
  const overlap = shift >= T.overlapFrom;
  const rule = { overlap, margin: overlap ? 0 : T.packGap, need: overlap ? T.minVisible + T.visSlack : 1, rotMax: T.rotMax[shift - 1], bias: T.overlapBias[shift - 1] };
  const defs = names.map((n) => BY_NAME[n]).sort((a, b) => b.samples.length - a.samples.length);
  for (let attempt = 0; attempt < T.bagTries; attempt++) {
    const placed = [];
    for (const def of defs) { const it = tryPlace(rng, def, placed, rule); if (!it) break; placed.push(it); }
    // The packing measure is coarse; the finished bag must also pass a fine one.
    const fine = { items: placed };
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
function bagNames(rng, shift, holds, index) {
  if (T.opener.shift === shift && index === 0) return { contra: T.opener.contraband.slice(), harmless: T.opener.harmless.slice() };
  const [lo, hi] = T.itemsPerBag[shift - 1], total = rng.int(lo, hi);
  const pool = contrabandPool(shift);
  const k = !holds ? 0 : T.maxContraband[shift - 1] > 1 && rng.chance(T.twoShare[shift - 1]) ? 2 : 1;
  const contra = rng.shuffle(pool).slice(0, k);
  const hpool = HARMLESS.filter((h) => !h.confusable);
  const harmless = rng.shuffle(hpool).slice(0, total - k).map((h) => h.name);
  if (rng.chance(T.confusableShare[shift - 1])) {
    const all = HARMLESS.filter((h) => h.confusable);
    const near = all.filter((h) => contra.includes(h.confusable));
    harmless[harmless.length - 1] = (near.length && rng.chance(T.confusableNear) ? rng.pick(near) : rng.pick(all)).name;
  }
  return { contra, harmless };
}
// One shift's bags from a seed. Nothing here runs during play.
function genShift(seed, shift) {
  const rng = makeRng(seed);
  const kinds = schedule(rng, shift);
  const bags = kinds.map((holds, index) => {
    const { contra, harmless } = bagNames(rng, shift, holds, index);
    const items = packBag(rng, [...contra, ...harmless], shift);
    return { kind: holds ? 'contra' : 'clean', w: T.bagW, h: T.bagH, items };
  });
  return { seed, shift, bags };
}
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

function layout(E) {
  const s = Math.min(E.w / T.designW, E.h / T.designMinH);
  return { s, ox: (E.w - T.designW * s) / 2, H: E.h / s, hud: E.safe.top + T.hudH, bottom: E.h - E.safe.bottom };
}
const multiplier = () => 1 + T.streakSteps.filter((n) => S.streak >= n).length;

function startShift(E, shift, seed) {
  const g = genShift(seed, shift), L = layout(E), first = L.hud / L.s + T.firstBagGap;
  S = {
    shift, seed, time: 0, dist: 0, acc: 0, score: 0, streak: 0, strikes: 0, catches: 0, falseAlarms: 0, misses: 0, passes: 0, resolved: 0,
    ended: null, endT: 0, finished: false, H: L.H, fx: [], ghosts: [], flashT: 0, flashColor: '', log: [],
    bags: g.bags.map((b, i) => ({
      ...b, idx: i, y0: first - i * (T.bagH + T.bagGap), y: 0,
      pending: b.items.filter((it) => it.contraband).length, touched: false, missed: false, resolved: false, settled: false, gone: false,
    })),
  };
  for (const b of S.bags) b.y = b.y0;
}

function addFx(text, x, y, color) { S.fx.push({ text, x, y, color, t: 0 }); }
function flash(color) { S.flashT = T.flashLife; S.flashColor = color; }

function endShift(E, result) {
  S.ended = result; S.endT = 0;
  const stars = result === 'clear' ? (S.strikes === 0 ? 3 : S.strikes <= 1 ? 2 : 1) : 0;
  const rec = E.save.get('shifts', {})[S.shift] || { best: 0, stars: 0 };
  const unlocked = result === 'clear' ? E.save.update('unlocked', (n) => Math.max(n, Math.min(T.beltSpeed.length, S.shift + 1)), 1) : E.save.get('unlocked', 1);
  S.result = { shift: S.shift, seed: S.seed, unlocked, result, score: S.score, strikes: S.strikes, stars, best: Math.max(rec.best, S.score), isNew: S.score > rec.best, catches: S.catches, falseAlarms: S.falseAlarms, misses: S.misses };
  E.save.update('shifts', (all) => ({ ...all, [S.shift]: { best: S.result.best, stars: Math.max(rec.stars, stars) } }), {});
  if (E.ledger) E.ledger.add('shift', { shift: S.shift, seed: S.seed, result, score: S.score, strikes: S.strikes, stars, catches: S.catches, falseAlarms: S.falseAlarms, misses: S.misses });
  S.log.push({ t: S.time, e: result });
}
function strike(E) {
  S.strikes++; S.streak = 0;
  if (S.strikes >= T.strikesMax) endShift(E, 'over');
}
function bagDone(E, b, correct) {
  b.resolved = true; S.resolved++;
  if (correct) S.streak++;
  if (!S.ended && S.resolved === S.bags.length) endShift(E, 'clear');
}

function catchItem(E, b, it) {
  const f = clamp((b.y + it.y) / S.H, 0, 1);
  const pts = Math.round(T.catchBase * (T.earlyMax + (T.earlyMin - T.earlyMax) * f) * multiplier());
  it.state = 1; b.pending--; S.catches++; S.score += pts;
  E.audio.play('hit');
  addFx(`+${pts}`, BAG_X + it.x, b.y + it.y, T.colors.catch);
  S.log.push({ t: S.time, e: 'catch', item: it.name, pts });
  if (b.pending === 0) bagDone(E, b, !b.touched && !b.missed);
}
function falseAlarm(E, b, it) {
  it.state = 2; b.touched = true; S.falseAlarms++;
  E.audio.play('miss');
  addFx('False alarm', BAG_X + it.x, b.y + it.y, T.colors.falseAlarm);
  S.log.push({ t: S.time, e: 'false', item: it.name });
  strike(E);
}
function missItem(E, b, it) {
  it.state = 3; b.pending--; b.missed = true; S.misses++;
  E.audio.play('miss'); flash(T.colors.catch);
  S.ghosts.push({ it, t: 0 });
  S.log.push({ t: S.time, e: 'miss', item: it.name });
  strike(E);
  if (b.pending === 0) bagDone(E, b, false);
}
function passBag(E, b) {
  b.passed = true; S.passes++;
  const pts = T.cleanBase * multiplier();
  S.score += pts;
  flash(T.colors.clean);
  S.fx.push({ text: `+${pts}`, x: T.designW / 2, y: 0, color: T.colors.clean, t: 0, bottom: true });
  S.log.push({ t: S.time, e: 'pass', pts });
  bagDone(E, b, true);
}

function step(E) {
  S.dist += T.beltSpeed[S.shift - 1] * T.simStep; S.time += T.simStep;
  for (const b of S.bags) {
    if (b.gone) continue;
    b.y = b.y0 + S.dist;
    if (b.y + b.h < 0) continue;
    if (b.pending > 0) for (const it of b.items) if (it.contraband && it.state === 0 && b.y + it.bb.y0 >= S.H && !S.ended) missItem(E, b, it);
    // A clean bag is settled when its bottom edge reaches the belt's end, while it is still on screen.
    if (b.kind === 'clean' && !b.settled && b.y + b.h >= S.H && !S.ended) { b.settled = true; if (b.touched) bagDone(E, b, false); else passBag(E, b); }
    if (b.y >= S.H) b.gone = true;
  }
}

// A tap resolves to one thing. Uncaught contraband under the finger always wins; else an already flagged item swallows the tap
// (a double tap must not cost a strike); else the nearest harmless item is a false alarm; else nothing.
function tapAt(E, x, y) {
  if (!S || S.ended) return;
  const L = layout(E);
  if (y < L.hud) return;
  const px = (x - L.ox) / L.s, py = y / L.s;
  let c = null, cd = Infinity, h = null, hd = Infinity, flagged = false;
  for (const b of S.bags) {
    if (b.gone || b.settled || b.y >= S.H || b.y + b.h < 0) continue;
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

// ---------- drawing ----------
const pathOf = (def) => {
  if (!def.path) {
    const p = new Path2D();
    for (const poly of def.shape) { poly.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); }
    def.path = p;
  }
  return def.path;
};
const itemColor = (it) => (it.state === 1 ? T.colors.catch : it.state === 2 ? T.colors.falseAlarm : T.colors[it.def.tint]);
const alpha = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

function drawItem(ctx, b, it) {
  const C = T.colors;
  const color = itemColor(it);
  ctx.save();
  ctx.translate(BAG_X + it.x, b.y + it.y); ctx.rotate(it.rot * DEG);
  const p = pathOf(it.def);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = alpha(color, 0.2); ctx.fill(p);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = alpha(color, 0.2); ctx.lineWidth = 6; ctx.stroke(p);
  ctx.strokeStyle = alpha(color, 0.95); ctx.lineWidth = 2; ctx.stroke(p);
  ctx.restore();
  if (it.state === 1 || it.state === 2) {
    ctx.strokeStyle = it.state === 1 ? C.catch : C.falseAlarm; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(BAG_X + it.x, b.y + it.y, it.def.rad + 8, 0, Math.PI * 2); ctx.stroke();
  }
}

const fillBox = (E, x, y, w, h, color) => { E.ctx.fillStyle = color; E.ctx.fillRect(x, y, w, h); };

function drawHud(E, L) {
  const C = T.colors, top = E.safe.top;
  fillBox(E, 0, 0, E.w, L.hud, alpha(C.hud, 0.94));
  const cy = top + 28, m = multiplier();
  E.text(String(S.score), 16 + E.safe.left, cy, { size: 28, weight: '800', align: 'left', color: C.text });
  const cx = E.w / 2;
  E.roundRect(cx - 32, cy - 15, 64, 30, 10, m > 1 ? '#3a2a08' : '#0f1c38', m > 1 ? C.organic : C.bagEdge);
  E.text(`x${m}`, cx, cy, { size: 20, weight: '800', color: m > 1 ? C.organic : C.text });
  const next = T.streakSteps.find((n) => S.streak < n);
  if (next) { const prev = [0, ...T.streakSteps].filter((n) => n <= S.streak).pop(); fillBox(E, cx - 28, cy + 18, 56 * ((S.streak - prev) / (next - prev)), 3, C.organic); }
  for (let i = 0; i < T.strikesMax; i++) {
    const x = E.w - 16 - E.safe.right - (T.strikesMax - i) * 28 + 4, used = i < S.strikes;
    E.roundRect(x, cy - 12, 24, 24, 6, used ? '#3a0c12' : '#0f1c38', used ? C.catch : C.bagEdge);
    if (used) { const g = E.ctx; g.strokeStyle = C.catch; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 6, cy - 6); g.lineTo(x + 18, cy + 6); g.moveTo(x + 18, cy - 6); g.lineTo(x + 6, cy + 6); g.stroke(); }
  }
  fillBox(E, 0, L.hud - 3, E.w * (S.resolved / S.bags.length), 3, C.bagEdge);
}

const play = {
  enter(E, params = {}) {
    startShift(E, params.shift || 1, params.seed ?? ((E.rng() * 2 ** 32) >>> 0));
  },
  update(dt, E) {
    S.H = layout(E).H;
    for (const f of S.fx) f.t += dt;
    for (const g of S.ghosts) g.t += dt;
    S.ghosts = S.ghosts.filter((g) => g.t < T.ghostLife);
    S.fx = S.fx.filter((f) => f.t < T.fxLife);
    if (S.flashT > 0) S.flashT -= dt;
    if (S.ended) {
      S.endT += dt;
      if (S.endT >= T.endDelay && !S.finished) { S.finished = true; E.setScene('over', S.result); }
      return;
    }
    S.acc += dt;
    while (S.acc >= T.simStep - 1e-9 && !S.ended) { S.acc -= T.simStep; step(E); }
  },
  onPointerDown(p, E) { tapAt(E, p.x, p.y); },
  onPause(E) {
    if (S && !S.ended && E.ledger) E.ledger.add('quit', { shift: S.shift, seed: S.seed, score: S.score, bag: S.resolved });
    if (S && !S.ended) E.setScene('menu');
  },
  render(ctx, E) {
    const L = layout(E), C = T.colors;
    ctx.save();
    ctx.translate(L.ox, 0); ctx.scale(L.s, L.s);
    ctx.fillStyle = C.belt; ctx.fillRect(0, 0, T.designW, L.H);
    ctx.fillStyle = C.roller;
    const off = S.dist % 20;
    for (let y = off - 20; y < L.H; y += 20) { ctx.fillRect(3, y, 16, 8); ctx.fillRect(T.designW - 19, y, 16, 8); }
    for (const b of S.bags) {
      if (b.gone || b.y >= L.H || b.y + b.h < 0) continue;
      E.roundRect(BAG_X, b.y, b.w, b.h, 18, C.bag, b.touched ? C.falseAlarm : b.passed ? C.clean : C.bagEdge);
      for (const it of b.items) drawItem(ctx, b, it);
    }
    ctx.restore();
    if (S.flashT > 0) { ctx.globalAlpha = Math.min(1, S.flashT / T.flashLife) * 0.9; ctx.fillStyle = S.flashColor; ctx.fillRect(0, L.bottom - 10, E.w, 10); ctx.globalAlpha = 1; }
    // The miss cue: after the strike, the ghost of the missed item pulses at the bottom edge.
    for (const g of S.ghosts) {
      const it = g.it, gx = clamp(L.ox + (BAG_X + it.x) * L.s, (it.x - it.bb.x0) * L.s + 8, E.w - (it.bb.x1 - it.x) * L.s - 8), gy = L.bottom - T.cueLift - (it.bb.y1 - it.y) * L.s;
      const a = (0.35 + 0.65 * Math.abs(Math.sin(g.t * 9))) * Math.min(1, (T.ghostLife - g.t) * 4);
      const ctx2 = E.ctx;
      ctx2.save(); ctx2.translate(gx, gy); ctx2.scale(L.s, L.s); ctx2.rotate(it.rot * DEG);
      ctx2.lineJoin = 'round'; ctx2.strokeStyle = alpha(T.colors.catch, a); ctx2.lineWidth = 3; ctx2.stroke(pathOf(it.def));
      ctx2.restore();
      E.text('Missed', clamp(gx, 60, E.w - 60), gy - (it.y - it.bb.y0) * L.s - 16, { size: 20, weight: '800', color: T.colors.catch, alpha: a });
    }
    for (const f of S.fx) E.text(f.text, clamp(L.ox + f.x * L.s, 70, E.w - 70), (f.bottom ? L.bottom - 70 : f.y * L.s) - 36 * (f.t / T.fxLife), { size: 20, weight: '800', color: f.color, alpha: 1 - (f.t / T.fxLife) ** 2 });
    drawHud(E, L);
  },
};

// ---------- menu and card ----------
const drawStar = (ctx, cx, cy, r, on) => {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  ctx.closePath();
  if (on) { ctx.fillStyle = '#ffd91a'; ctx.fill(); } else { ctx.strokeStyle = T.colors.dim; ctx.lineWidth = 2; ctx.stroke(); }
};

const menu = {
  enter() { this.cells = []; this.btnMute = null; },
  render(ctx, E) {
    const C = T.colors, shifts = E.save.get('shifts', {}), unlocked = E.save.get('unlocked', 1);
    const ty = E.safe.top + Math.max(84, E.h * 0.1);   // clear of the engine's EXPORT tab (top left, 82 x 48)
    E.text('CHECKPOINT', E.w / 2, ty, { size: 38, weight: '800', color: C.metal });
    E.text('Tap the contraband', E.w / 2, ty + 34, { size: 16, color: C.dim });
    const n = T.beltSpeed.length, cols = 2, gap = 12, cw = Math.min(170, (E.w - 40 - gap) / cols), ch = 58, top = ty + 66;
    const x0 = (E.w - (cw * cols + gap)) / 2;
    this.cells = [];
    for (let i = 0; i < n; i++) {
      const col = i % cols, row = Math.floor(i / cols), x = x0 + col * (cw + gap), y = top + row * (ch + 8), open = i + 1 <= unlocked, rec = shifts[i + 1] || { best: 0, stars: 0 };
      E.roundRect(x, y, cw, ch, 12, open ? '#12274d' : '#0a1226', open ? C.bagEdge : '#1a2540');
      E.text(`Shift ${i + 1}`, x + 12, y + 18, { size: 17, weight: '800', align: 'left', color: open ? C.text : '#4a5d80' });
      if (T.rush.includes(i + 1)) E.text('RUSH', x + cw - 10, y + 18, { size: 14, align: 'right', color: open ? C.organic : '#5a4a30' });
      if (open) {
        for (let k = 0; k < 3; k++) drawStar(ctx, x + 20 + k * 20, y + 41, 8, k < rec.stars);
        if (rec.best) E.text(String(rec.best), x + cw - 10, y + 41, { size: 14, align: 'right', color: C.dim });
      } else E.text('Locked', x + 12, y + 41, { size: 14, align: 'left', color: '#4a5d80' });
      this.cells.push({ x, y, w: cw, h: ch, shift: i + 1, open });
    }
    this.btnMute = E.button(E.audio.muted ? 'Sound: off' : 'Sound: on', E.w / 2, top + 5 * (ch + 8) + 30, { fill: '#1f2937', w: 160, h: 44, size: 16 });
  },
  onTap(p, E) {
    const c = this.cells.find((c) => E.hit(c, p));
    if (c) { if (c.open) E.setScene('play', { shift: c.shift }); }
    else if (this.btnMute && E.hit(this.btnMute, p)) E.audio.toggleMute();
  },
};

const over = {
  enter(E, r) { this.r = r; this.t0 = E.time; this.btns = {}; },
  render(ctx, E) {
    const C = T.colors, r = this.r, cleared = r.result === 'clear', cx = E.w / 2, h = E.h;
    E.text(cleared ? 'CLEARED' : 'SHIFT OVER', cx, h * 0.17, { size: 38, weight: '800', color: cleared ? C.clean : C.catch });
    for (let i = 0; i < 3; i++) drawStar(ctx, cx + (i - 1) * 48, h * 0.27, 19, i < r.stars);
    E.text(String(r.score), cx, h * 0.37, { size: 48, weight: '800', color: C.text });
    E.text(r.isNew && r.score > 0 ? 'New best' : `Best ${r.best}`, cx, h * 0.37 + 40, { size: 18, color: C.organic });
    E.text(`Strikes ${r.strikes} of ${T.strikesMax}`, cx, h * 0.37 + 68, { size: 18, color: C.dim });
    E.text(`Seed ${r.seed}`, cx, h * 0.37 + 94, { size: 14, color: C.dim });
    const next = cleared && r.shift < T.beltSpeed.length;
    let y = h * 0.6;
    this.btns = {};
    if (next) { this.btns.next = E.button('Next shift', cx, y); y += 68; }
    this.btns.retry = E.button('Retry', cx, y, next ? { fill: '#334155' } : {}); y += 68;
    this.btns.menu = E.button('Menu', cx, y, { fill: '#334155' });
  },
  onTap(p, E) {
    if (E.time - this.t0 < T.cardDelay) return;
    const b = this.btns, r = this.r;
    if (b.next && E.hit(b.next, p)) E.setScene('play', { shift: r.shift + 1 });
    else if (b.retry && E.hit(b.retry, p)) E.setScene('play', { shift: r.shift });
    else if (b.menu && E.hit(b.menu, p)) E.setScene('menu');
  },
};

export const game = {
  slug: 'checkpoint',
  title: 'Checkpoint',
  saveVersion: 1,
  migrate(data, fromVersion) { return data; },
  TUNING,
  start: 'menu',
  scenes: { menu, play, over },
  // Read by tools/sim-checkpoint.mjs so the harness runs the real generation, tap resolution and scoring.
  sim: {
    ITEMS, genShift, visibility, outlineVisibility, layout,
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
