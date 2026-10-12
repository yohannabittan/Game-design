#!/usr/bin/env node
// ink-letters: turn a word into an Ink stencil in parts (PRD v0.8 section B). No dependencies.
//
//   node tools/ink-letters.mjs "ENCORE" --name ENCORE --out stencil.json [options]   (the word comes first)
//
// Each letter is one part, drawn from a hand-made single-stroke alphabet (A to Z and "&", centre lines on a grid 10 tall)
// and thickened to a stroke width into closed polygons (outer polygon plus holes, even-odd). Letters are placed left to right
// with at least --gap units of bare skin between their ink; a frame may be added as one more part, kept at least --gap from the letters.
//
// Options (units are the 360x640 design space)
//   --height N       letter height of the centre lines, default 50 (ink is --width taller)
//   --width N        stroke width, default 8 (keep it at 8 or more so every letter part has about 40 cells)
//   --slant N        lean: top moves right by N per unit of height, default 0 (script look: 0.25 to 0.35; negative leans left)
//   --gap N          bare skin between letters, and between letters and the frame, default 6 (never below 5)
//   --kern           tuck each letter against the one before it until the ink is --gap apart (slanted letters nest)
//   --space N        extra width for a space in the word, default 10
//   --at X,Y         centre of the text block, default 180,330
//   --frame KIND     heart or banner: a ring added as its own part
//   --frame-size W,H heart: bounding box of the ring's centre line. banner: total width with tails, height of the main band
//   --frame-at X,Y   heart: centre of its bounding box. banner: centre of the main band. Default: the text centre
//   --frame-width N  ring thickness, default = --width
//   --name --timer --tier --body --perfect --story --comment   the stencil's own fields (boss is false)
//   --out FILE       write the stencil JSON (README "Stencil file"), else it goes to stdout
//   --path FILE      write the intended path: land on each letter, ride its strokes at --speed, lift; then lap the frame
//   --speed N        finger speed along strokes in the path, default 220
//   --svg FILE       write a preview picture
//
// It prints the parts, their cell counts and the smallest gap between parts, and warns when a part has fewer than 40 cells,
// a letter falls in pieces, or a gap is under 5. Add a letter by adding strokes to GLYPHS (polylines on the 10 tall grid, y down).
import { writeFileSync } from 'node:fs';

const D = Math.PI / 180;
const arc = (cx, cy, rx, ry, a0, a1, step = 12) => {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / step)), out = [];
  for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * D; out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
  return out;
};
const spline = (pts, per = 8) => { // Catmull-Rom through the points, open
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
};

// Single-stroke alphabet: each letter is a list of strokes, each stroke a polyline on a grid 10 tall (y down). Strokes of a letter may cross.
const GLYPHS = {
  A: [[[0, 10], [3.5, 0], [7, 10]], [[1.19, 6.6], [5.81, 6.6]]],
  B: [[[0, 10], [0, 0], [3.6, 0], ...arc(3.6, 2.5, 2.4, 2.5, -90, 90), [0, 5]], [[0, 5], [3.4, 5], ...arc(3.4, 7.5, 2.6, 2.5, -90, 90), [0, 10]]],
  C: [arc(3.6, 5, 3.6, 5, -40, -320)],
  D: [[[0, 10], [0, 0], [2.6, 0], ...arc(2.6, 5, 3.6, 5, -90, 90), [0, 10]]],
  E: [[[6, 0], [0, 0], [0, 10], [6, 10]], [[0, 5], [5, 5]]],
  F: [[[6, 0], [0, 0], [0, 10]], [[0, 5], [5, 5]]],
  G: [[...arc(3.6, 5, 3.6, 5, -40, -350), [7.2, 5], [3.9, 5]]],
  H: [[[0, 0], [0, 10]], [[6.5, 0], [6.5, 10]], [[0, 5], [6.5, 5]]],
  I: [[[0, 0], [4, 0]], [[2, 0], [2, 10]], [[0, 10], [4, 10]]],
  J: [[[3, 0], [7, 0]], [[5, 0], [5, 7.2], ...arc(3, 7.2, 2, 2.8, 0, 180), [1, 6.4]]],
  K: [[[0, 0], [0, 10]], [[6, 0], [0, 5], [6.2, 10]]],
  L: [[[0, 0], [0, 10], [5.8, 10]]],
  M: [[[0, 10], [0, 0], [4.5, 6.5], [9, 0], [9, 10]]],
  N: [[[0, 10], [0, 0], [6.5, 10], [6.5, 0]]],
  O: [arc(3.6, 5, 3.6, 5, -90, 270, 10)],
  P: [[[0, 10], [0, 0], [3.7, 0], ...arc(3.7, 2.7, 2.5, 2.7, -90, 90), [0, 5.4]]],
  Q: [arc(3.6, 5, 3.6, 5, -90, 270, 10), [[4.3, 7.2], [7.4, 10.6]]],
  R: [[[0, 10], [0, 0], [3.7, 0], ...arc(3.7, 2.7, 2.5, 2.7, -90, 90), [0, 5.4]], [[3, 5.4], [6.4, 10]]],
  S: [[...arc(3, 2.5, 3, 2.5, -35, -270), ...arc(3, 7.5, 3, 2.5, -90, 145).slice(1)]],
  T: [[[0, 0], [6.5, 0]], [[3.25, 0], [3.25, 10]]],
  U: [[[0, 0], [0, 6.5], ...arc(3.1, 6.5, 3.1, 3.5, 180, 0), [6.2, 0]]],
  V: [[[0, 0], [3.6, 10], [7.2, 0]]],
  W: [[[0, 0], [2.6, 10], [5.2, 3.5], [7.8, 10], [10.4, 0]]],
  X: [[[0, 0], [6.4, 10]], [[6.4, 0], [0, 10]]],
  Y: [[[0, 0], [3.2, 5], [6.4, 0]], [[3.2, 5], [3.2, 10]]],
  Z: [[[0, 0], [6.4, 0], [0, 10], [6.4, 10]]],
  '&': [spline([[7, 10], [5.2, 7.7], [3.4, 5.3], [2.1, 3.3], [2.3, 1.2], [3.6, 0], [4.9, 1.1], [4.8, 2.8], [3.6, 4.6], [1.6, 6.6], [0.5, 8.2], [1.2, 9.8], [3.0, 10], [4.9, 9], [6.3, 7], [7, 5.6]], 6)],
};

// ---- geometry helpers
const dist2seg = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
};
const dedupe = (pts, eps = 0.01) => pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > eps);
const resample = (pts, maxStep) => { // keep every vertex, add points so no step is longer than maxStep
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / maxStep));
    for (let k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  return out;
};
const roundCorners = (poly, r) => { // closed polygon, each corner replaced by a quadratic arc that starts r from the corner
  const out = [], n = poly.length;
  for (let i = 0; i < n; i++) {
    const p0 = poly[(i + n - 1) % n], p1 = poly[i], p2 = poly[(i + 1) % n];
    const l0 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), rr = Math.min(r, l0 / 2, l2 / 2);
    const a = [p1[0] + (p0[0] - p1[0]) * rr / l0, p1[1] + (p0[1] - p1[1]) * rr / l0], b = [p1[0] + (p2[0] - p1[0]) * rr / l2, p1[1] + (p2[1] - p1[1]) * rr / l2];
    for (let k = 0; k <= 6; k++) { const t = k / 6; out.push([(1 - t) * (1 - t) * a[0] + 2 * t * (1 - t) * p1[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * t * (1 - t) * p1[1] + t * t * b[1]]); }
  }
  return out;
};

// ---- thicken polylines into closed polygons: rasterise the distance field at RES, trace the boundary, simplify
const RES = 0.25, OFF = RES / 2; // the lattice is shifted half a pixel so no vertex sits on a cell centre (cells are 3 units, centres 1.5, 4.5, ...)
function thicken(strokes, w) { // strokes: list of polylines [[x,y],...]; returns { polys, comps, bbox }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of strokes) for (const [x, y] of s) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const h = w / 2, ox = Math.floor((x0 - h - 2) / RES) * RES + OFF, oy = Math.floor((y0 - h - 2) / RES) * RES + OFF;
  const W = Math.ceil((x1 - x0 + w + 4) / RES) + 2, H = Math.ceil((y1 - y0 + w + 4) / RES) + 2;
  const ink = new Uint8Array(W * H);
  const mark = (ax, ay, bx, by) => {
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - h - ox) / RES) - 1), i1 = Math.min(W - 1, Math.ceil((Math.max(ax, bx) + h - ox) / RES) + 1);
    const j0 = Math.max(0, Math.floor((Math.min(ay, by) - h - oy) / RES) - 1), j1 = Math.min(H - 1, Math.ceil((Math.max(ay, by) + h - oy) / RES) + 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (!ink[j * W + i] && dist2seg(ox + (i + 0.5) * RES, oy + (j + 0.5) * RES, ax, ay, bx, by) <= h) ink[j * W + i] = 1;
    }
  };
  for (const s of strokes) { if (s.length === 1) mark(s[0][0], s[0][1], s[0][0], s[0][1]); for (let i = 1; i < s.length; i++) mark(s[i - 1][0], s[i - 1][1], s[i][0], s[i][1]); }
  // connected components (8-neighbour) of the ink
  const lab = new Int32Array(W * H); let comps = 0;
  for (let k = 0; k < W * H; k++) if (ink[k] && !lab[k]) {
    comps++; const st = [k]; lab[k] = comps;
    while (st.length) { const c = st.pop(), cx = c % W, cy = (c - cx) / W; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const nk = ny * W + nx; if (ink[nk] && !lab[nk]) { lab[nk] = comps; st.push(nk); } } }
  }
  // boundary edges with the ink on the right (y down)
  const at = (i, j) => (i < 0 || j < 0 || i >= W || j >= H) ? 0 : ink[j * W + i];
  const V = W + 1, edges = new Map(); // start vertex -> [{to, dx, dy}]
  const add = (ax, ay, bx, by) => { const k = ay * V + ax; if (!edges.has(k)) edges.set(k, []); edges.get(k).push({ k2: by * V + bx, dx: bx - ax, dy: by - ay, used: false }); };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (ink[j * W + i]) {
    if (!at(i, j - 1)) add(i, j, i + 1, j);
    if (!at(i + 1, j)) add(i + 1, j, i + 1, j + 1);
    if (!at(i, j + 1)) add(i + 1, j + 1, i, j + 1);
    if (!at(i - 1, j)) add(i, j + 1, i, j);
  }
  const loops = [];
  for (const [k0, list] of edges) for (const e0 of list) {
    if (e0.used) continue;
    const loop = []; let e = e0, k = k0;
    for (;;) {
      e.used = true; loop.push([k % V, Math.floor(k / V)]); k = e.k2;
      const next = (edges.get(k) || []).filter((c) => !c.used);
      if (!next.length) break;
      let pick = next[0];
      if (next.length > 1) { // diagonal touch: turn right, else straight, else left
        const score = (c) => { const cr = e.dx * c.dy - e.dy * c.dx; return cr > 0 ? 0 : cr === 0 ? 1 : 2; };
        pick = next.reduce((a, b) => (score(b) < score(a) ? b : a));
      }
      e = pick;
    }
    loops.push(loop);
  }
  const polys = [];
  for (const loop of loops) {
    const pts = loop.map(([i, j]) => [ox + i * RES, oy + j * RES]);
    const s = simplifyClosed(pts, 0.28);
    if (s.length >= 3 && Math.abs(area(s)) >= 20) polys.push(s.map(([x, y]) => [+x.toFixed(2), +y.toFixed(2)]));
  }
  return { polys, comps };
}
const area = (p) => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a / 2; };
function dp(pts, eps) { // Douglas-Peucker on an open polyline
  if (pts.length < 3) return pts;
  const a = pts[0], b = pts[pts.length - 1]; let m = -1, mi = 0;
  for (let i = 1; i < pts.length - 1; i++) { const d = dist2seg(pts[i][0], pts[i][1], a[0], a[1], b[0], b[1]); if (d > m) { m = d; mi = i; } }
  if (m <= eps) return [a, b];
  return [...dp(pts.slice(0, mi + 1), eps).slice(0, -1), ...dp(pts.slice(mi), eps)];
}
function simplifyClosed(pts, eps) {
  let bi = 0, bd = -1;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (d > bd) { bd = d; bi = i; } }
  const a = pts.slice(0, bi + 1), b = [...pts.slice(bi), pts[0]];
  return [...dp(a, eps).slice(0, -1), ...dp(b, eps).slice(0, -1)];
}

// ---- the game's own inside test (even-odd over all polygons of a part), on the 3 unit cell grid
const inside = (polys, x, y) => {
  let c = false;
  for (const p of polys) for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const cellCount = (polys) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, n = 0;
  for (const p of polys) for (const [x, y] of p) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  for (let y = Math.floor(y0 / 3) * 3 + 1.5; y < y1; y += 3) for (let x = Math.floor(x0 / 3) * 3 + 1.5; x < x1; x += 3) if (inside(polys, x, y)) n++;
  return n;
};
const partGap = (A, B) => { // smallest distance between the boundaries of two parts
  let m = Infinity;
  const one = (P, Q) => { for (const p of P) for (const [x, y] of p) for (const q of Q) for (let i = 0, j = q.length - 1; i < q.length; j = i++) m = Math.min(m, dist2seg(x, y, q[j][0], q[j][1], q[i][0], q[i][1])); };
  one(A, B); one(B, A);
  return m;
};

// ---- frames: closed centre lines
const heartLine = (W, H, cx, cy) => {
  const pts = [];
  for (let i = 0; i < 160; i++) { const t = i / 160 * 2 * Math.PI; pts.push([16 * Math.sin(t) ** 3, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]); }
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), mx = (Math.min(...xs) + Math.max(...xs)) / 2, my = (Math.min(...ys) + Math.max(...ys)) / 2;
  const sx = W / (Math.max(...xs) - Math.min(...xs)), sy = H / (Math.max(...ys) - Math.min(...ys));
  return pts.map(([x, y]) => [cx + (x - mx) * sx, cy + (y - my) * sy]);
};
const bannerLine = (W, Hb, cx, cy) => { // a ribbon with two swallowtail ends; W counts the tails
  const tail = 26, d = 9, n = 11, xl = cx - W / 2 + tail, xr = cx + W / 2 - tail, yt = cy - Hb / 2, yb = cy + Hb / 2, ym = cy + d;
  return roundCorners([[xl, yt], [xr, yt], [xr, yt + d], [xr + tail, yt + d], [xr + tail - n, ym], [xr + tail, yb + d], [xr, yb + d], [xr, yb], [xl, yb], [xl, yb + d], [xl - tail, yb + d], [xl - tail + n, ym], [xl - tail, yt + d], [xl, yt + d]], 5);
};

// ---- command line
const argv = process.argv.slice(2);
const word = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const num = (n, d) => Number(opt(n, d));
const pair = (n, d) => String(opt(n, d)).split(',').map(Number);
if (word === undefined) { console.error('usage: node tools/ink-letters.mjs "WORD" --name NAME --out stencil.json [--height 50 --width 8 --slant 0 --gap 6 --at 180,330 --frame heart|banner --frame-size W,H --frame-at X,Y --path path.json --speed 220 --svg preview.svg]'); process.exit(2); }
const height = num('height', 50), sw = num('width', 8), slant = num('slant', 0), gap = Math.max(5, num('gap', 6)), space = num('space', 10);
const kern = argv.includes('--kern'), speed = num('speed', 220), [atx, aty] = pair('at', '180,330'), frameKind = opt('frame'), fw = num('frame-width', sw);

// letters: scale, lean, place left to right
const sc = height / 10, letters = [];
let cursor = 0, spaced = false;
for (const ch of word.toUpperCase()) {
  if (ch === ' ') { cursor += space; spaced = true; continue; }
  const g = GLYPHS[ch];
  if (!g) { console.error(`no glyph for "${ch}"`); process.exit(2); }
  const strokes = g.map((s) => dedupe(s.map(([x, y]) => [(x + slant * (10 - y)) * sc, y * sc])));
  let lo = Infinity, hi = -Infinity;
  for (const s of strokes) for (const [x] of s) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
  let dx = cursor - (lo - sw / 2);
  const prev = letters[letters.length - 1];
  if (kern && prev && !spaced) { // slide left while the centre lines stay sw + gap apart
    const dense = (ss, m) => ss.flatMap((s) => resample(s, 1).map(([x, y]) => [x + m, y]));
    const a = prev.strokes, minD = (m) => { let d = Infinity; for (const [x, y] of dense(strokes, dx + m)) for (const s of a) for (let i = 1; i < s.length; i++) d = Math.min(d, dist2seg(x, y, s[i - 1][0], s[i - 1][1], s[i][0], s[i][1])); return d; };
    let m = 0;
    while (m > -80 && minD(m - 0.5) >= sw + gap) m -= 0.5;
    dx += m;
  }
  spaced = false;
  const placed = strokes.map((s) => s.map(([x, y]) => [x + dx, y]));
  letters.push({ ch, strokes: placed });
  cursor = Math.max(...placed.flat().map((p) => p[0])) + sw / 2 + gap;
}
let bx0 = Infinity, bx1 = -Infinity;
for (const l of letters) for (const s of l.strokes) for (const [x] of s) { bx0 = Math.min(bx0, x - sw / 2); bx1 = Math.max(bx1, x + sw / 2); }
const shiftX = atx - (bx0 + bx1) / 2, shiftY = aty - height / 2;
for (const l of letters) l.strokes = l.strokes.map((s) => s.map(([x, y]) => [x + shiftX, y + shiftY]));

const parts = [], warns = [], names = [];
for (const l of letters) {
  const { polys, comps } = thicken(l.strokes, sw);
  if (comps > 1) warns.push(`letter ${l.ch} falls in ${comps} pieces`);
  parts.push(polys); names.push(l.ch);
}
let ring = null;
if (frameKind) {
  const [fW, fH] = frameKind === 'heart' ? pair('frame-size', '300,270') : pair('frame-size', '300,80');
  const [fx, fy] = pair('frame-at', `${atx},${aty}`);
  const line = frameKind === 'heart' ? heartLine(fW, fH, fx, fy) : frameKind === 'banner' ? bannerLine(fW, fH, fx, fy) : null;
  if (!line) { console.error('--frame must be heart or banner'); process.exit(2); }
  ring = resample([...line, line[0]], 5);
  const { polys } = thicken([ring], fw);
  parts.push(polys); names.push('frame');
}

// checks
const cells = parts.map(cellCount);
let minGap = Infinity;
for (let a = 0; a < parts.length; a++) for (let b = a + 1; b < parts.length; b++) {
  const g = partGap(parts[a], parts[b]);
  if (g < 5) warns.push(`gap between ${names[a]} and ${names[b]} is ${g.toFixed(2)}`);
  if (a === b - 1 || names[b] === 'frame') minGap = Math.min(minGap, g);
}
cells.forEach((c, i) => { if (c < 40) warns.push(`${names[i]} has only ${c} cells`); });
let ymin = Infinity, ymax = -Infinity, xmin = Infinity, xmax = -Infinity;
for (const P of parts) for (const p of P) for (const [x, y] of p) { ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); }
if (ymin < 110 || ymax > 560) warns.push(`shape spans y ${ymin.toFixed(1)} to ${ymax.toFixed(1)}, outside 110 to 560`);
if (xmin < 4 || xmax > 356) warns.push(`shape spans x ${xmin.toFixed(1)} to ${xmax.toFixed(1)}`);

const stencil = { name: opt('name', word), timer: num('timer', 20), boss: false };
if (opt('tier')) stencil.tier = opt('tier');
if (opt('perfect')) stencil.perfect = num('perfect');
if (opt('body')) stencil.body = opt('body');
if (opt('story')) stencil.story = opt('story');
stencil.comment = opt('comment', `${word} in single strokes. Path: land on each letter, ride its strokes, lift.`);
stencil.parts = parts;
const out = opt('out');
// one part per line keeps the file readable
const pretty = `{\n "name": ${JSON.stringify(stencil.name)},\n "timer": ${stencil.timer},\n "boss": false,\n` +
  ['tier', 'perfect', 'body', 'story'].filter((k) => stencil[k] !== undefined).map((k) => ` "${k}": ${JSON.stringify(stencil[k])},\n`).join('') +
  ` "comment": ${JSON.stringify(stencil.comment)},\n "parts": [\n${parts.map((P) => '  ' + JSON.stringify(P)).join(',\n')}\n ]\n}\n`;
if (out) writeFileSync(out, pretty); else process.stdout.write(pretty);

// the intended path
const pathFile = opt('path');
if (pathFile) {
  const path = [];
  let len = 0;
  const ride = (pts) => {
    const r = resample(dedupe(pts), 5);
    if (path.length) path.push(null);
    r.forEach(([x, y], i) => { path.push(i === 0 ? [+x.toFixed(1), +y.toFixed(1)] : [+x.toFixed(1), +y.toFixed(1), speed]); if (i) len += Math.hypot(x - r[i - 1][0], y - r[i - 1][1]); });
  };
  for (const l of letters) for (const s of l.strokes) ride(s);
  if (ring) { // start the lap at the ring point nearest the last stroke
    const last = path[path.length - 1], pts = ring.slice(0, -1);
    let bi = 0, bd = Infinity;
    pts.forEach(([x, y], i) => { const d = Math.hypot(x - last[0], y - last[1]); if (d < bd) { bd = d; bi = i; } });
    ride([...pts.slice(bi), ...pts.slice(0, bi), pts[bi]]);
  }
  writeFileSync(pathFile, JSON.stringify(path) + '\n');
  console.error(`path: ${path.filter((p) => p).length} points, ${len.toFixed(0)} units of ink at ${speed}/s (${(len / speed).toFixed(1)} s plus lifts)`);
}

// preview
const svg = opt('svg');
if (svg) {
  const d = parts.map((P) => P.map((p) => 'M' + p.map((q) => q.join(',')).join('L') + 'Z').join(' '));
  writeFileSync(svg, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 100 360 470" width="720" height="940"><rect x="0" y="100" width="360" height="470" fill="#f1d9bf"/>${d.map((x, i) => `<path d="${x}" fill-rule="evenodd" fill="${i % 2 ? '#22304a' : '#7a2e2e'}"/>`).join('')}</svg>\n`);
}

console.error(`${stencil.name}: ${parts.length} parts (${names.join(' ')}), cells ${cells.join(' ')}, smallest gap between neighbours ${minGap.toFixed(2)}, x ${xmin.toFixed(0)}-${xmax.toFixed(0)}, y ${ymin.toFixed(0)}-${ymax.toFixed(0)}`);
for (const w of warns) console.error('WARNING: ' + w);
