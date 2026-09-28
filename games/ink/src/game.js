// Ink, layers 1 and 2: the mechanic and the progression. Hold the tattoo gun, lay ink inside the stencil, never leave the line three times.
// Grey box: shapes and four colours only. Ten stencil slots; 2 to 10 are placeholders until the content shards are merged.

import { clamp, dist } from './engine.js';

// Design-space units unless stated. Names match PRD section 16; the rest are marked.
const TUNING = {
  designW: 360,          // Design space width
  designH: 640,          // Design space height
  needleOffset: 56,      // Screen pixels from the finger to the needle tip, straight up
  needleR: 7,            // Needle radius; ink is laid within this of the needle centre
  cellSize: 3,           // Coverage grid cell size
  sampleSpacing: 2,      // Distance between path samples along the needle's movement
  slipTolerance: 2,      // The needle centre may be this far outside the outline before a slip counts
  maxSlips: 3,           // Third slip ruins the piece
  starPercents: [70, 80, 90, 95, 99], // Percentage thresholds for 1 to 5 stars
  passPercent: 70,       // Below this at the timer is a fail
  timerSpareEarly: 0.15, // Fraction of the timer left after the intended path on stencils 1 to 4 (read by tools/sim-ink.mjs)
  timerSpareMid: 0.10,   // Same for stencils 5 to 9
  timerSpareBoss: 0.05,  // Same for stencil 10
  inkStrokeWidth: 14,    // Drawn ink stroke width, twice the needle radius
  outlineWidth: 2,       // Stencil outline width
  particleCap: 200,      // Reserved for layer 3 (particles)

  // Layer 1 additions, not in the PRD table.
  bg: '#5a3a2c',         // Skin field; the engine reads this name and fills the whole screen with it
  stencilBlue: '#9bd6ff',// Goal: the stencil outline
  inkColor: '#090d18',   // Progress: near-black with a blue cast
  slipRed: '#ef4444',    // Danger: slip marks and the slip counter
  machineBody: '#1a1d29',
  machineEdge: '#c9ced8',
  cardColor: '#1b1410',
  textColor: '#f4ece4',
  starColor: '#ffd166',
  buttonFill: '#3b82f6',
  buttonAltFill: '#3a2a22',
  endHold: 0.6,          // Seconds the finished piece stays on screen before the card
  hudTop: 16,            // Screen px from the safe-area top to the HUD
  slipMarkSize: 6,       // Half-length of a slip cross
  machineGripW: 22,      // Screen px width of the machine at the finger
  machineTubeW: 8,       // Screen px width of the machine near the needle
  circlePoints: 96,      // Vertices of the circle stencil polygon

  // Layer 2 additions.
  gridCols: 5,           // Stencil select tiles per row
  gridGap: 8,            // Gap between tiles (screen px)
  tileH: 92,             // Tile height (screen px, at least 44)
  lockColor: '#7a6558',
  inkLayerMaxDpr: 2,     // The cached ink layer is drawn at most this many pixels per CSS pixel
};
const T = TUNING;

const circle = (cx, cy, r, n = T.circlePoints) =>
  Array.from({ length: n }, (_, i) => [cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n)]);

const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

// Stencil data. `shape` is a list of closed polygons in the 360x640 design space, even-odd (a polygon inside another is a hole).
// Entries are pasted from the content shards' JSON (see docs/games/ink/README.md); tools/sim-ink.mjs verifies each one.
const STENCILS = [
  {
    // Teaches: hold and move, fill the middle fast, the edge is round and forgiving.
    // Intended path: a spiral from the centre out at 12 units per turn (needleR 7 leaves no gap), then one lap 3 units inside the rim.
    // About 4500 units of travel, 15 s at 300 units/s, 99 percent; the timer is generous so the first card can show five stars.
    name: 'Circle', timer: 30, boss: false,
    shape: [circle(180, 320, 125)],
  },
  // PLACEHOLDERS, entries 2 to 10: the orchestrator replaces each with an authored stencil (name, timer, boss, shape, comment).
  // Until then they are plain rectangles so progression, the grid and the cards can be played. Stencils 5 and 10 are bosses.
  { name: 'Stencil 2', timer: 30, boss: false, shape: [rect(110, 220, 140, 200)] },
  { name: 'Stencil 3', timer: 30, boss: false, shape: [rect(110, 220, 140, 200)] },
  { name: 'Stencil 4', timer: 30, boss: false, shape: [rect(110, 220, 140, 200)] },
  { name: 'Stencil 5', timer: 30, boss: true, shape: [rect(110, 220, 140, 200)] },
  { name: 'Stencil 6', timer: 30, boss: false, shape: [rect(110, 220, 140, 200)] },
  { name: 'Stencil 7', timer: 30, boss: false, shape: [rect(110, 220, 140, 200)] },
  { name: 'Stencil 8', timer: 30, boss: false, shape: [rect(110, 220, 140, 200)] },
  { name: 'Stencil 9', timer: 30, boss: false, shape: [rect(110, 220, 140, 200)] },
  { name: 'Stencil 10', timer: 30, boss: true, shape: [rect(110, 220, 140, 200)] },
];

// ---------- Geometry ----------

function pointInShape(shape, x, y) {
  let inside = false;
  for (const poly of shape) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

// Nearest point on any outline edge: { d, x, y }.
function nearestEdge(shape, x, y) {
  let best = { d: Infinity, x, y };
  for (const poly of shape) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [ax, ay] = poly[j], [bx, by] = poly[i];
      const ex = bx - ax, ey = by - ay;
      const t = clamp(((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey || 1), 0, 1);
      const px = ax + ex * t, py = ay + ey * t;
      const d = dist(x, y, px, py);
      if (d < best.d) best = { d, x: px, y: py };
    }
  }
  return best;
}

// Coverage grid, built once per stencil. Cells whose centre is inside the stencil are the ones that count.
const gridCache = [];
function gridFor(idx) {
  if (gridCache[idx]) return gridCache[idx];
  const shape = STENCILS[idx].shape, cs = T.cellSize;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const poly of shape) for (const [x, y] of poly) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const cols = Math.ceil((x1 - x0) / cs), rows = Math.ceil((y1 - y0) / cs);
  const inside = new Uint8Array(cols * rows);
  let total = 0;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    if (pointInShape(shape, x0 + (i + 0.5) * cs, y0 + (j + 0.5) * cs)) { inside[j * cols + i] = 1; total++; }
  }
  return (gridCache[idx] = { x0, y0, cols, rows, inside, total });
}

// ---------- Play state ----------

const S = {}; // the current attempt; the card reads it to draw the finished piece

function view(E) {
  const s = Math.min(E.w / T.designW, E.h / T.designH);
  return { s, ox: (E.w - T.designW * s) / 2, oy: (E.h - T.designH * s) / 2 };
}

function newAttempt(idx) {
  const st = STENCILS[idx], g = gridFor(idx);
  Object.assign(S, {
    idx, st, g,
    inked: new Uint8Array(g.cols * g.rows), count: 0,
    strokes: [], stroke: null, marks: [],
    slips: 0, time: st.timer, started: false, ended: null, holdT: 0,
    pid: null, last: null, carry: 0, armed: false,
    finger: null,
    layer: null, layerK: 0, inkDone: [],
  });
}

const percent = () => Math.floor((S.count * 100) / S.g.total);
const starsFor = (pct) => T.starPercents.filter((p) => pct >= p).length;

// Lay ink on every inside cell whose centre is within needleR of (x, y).
function inkAt(x, y) {
  const { g } = S, cs = T.cellSize, R = T.needleR;
  const i0 = Math.max(0, Math.floor((x - R - g.x0) / cs)), i1 = Math.min(g.cols - 1, Math.floor((x + R - g.x0) / cs));
  const j0 = Math.max(0, Math.floor((y - R - g.y0) / cs)), j1 = Math.min(g.rows - 1, Math.floor((y + R - g.y0) / cs));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const k = j * g.cols + i;
    if (!g.inside[k] || S.inked[k]) continue;
    if (dist(x, y, g.x0 + (i + 0.5) * cs, g.y0 + (j + 0.5) * cs) <= R) { S.inked[k] = 1; S.count++; }
  }
}

// One path sample. Inside: ink. Outside: no ink; a slip counts only if the needle had been inside and is now past the tolerance.
function sample(E, x, y) {
  if (S.ended) return;
  if (pointInShape(S.st.shape, x, y)) {
    S.armed = true;
    if (!S.stroke) { S.stroke = []; S.strokes.push(S.stroke); }
    S.stroke.push(x, y);
    inkAt(x, y);
    if (S.count === S.g.total) finish(E, 'full');
    return;
  }
  S.stroke = null;
  checkSlip(E, x, y);
}

// Count a slip if the needle had been inside and (x, y) is outside past the tolerance. Ink is never laid here.
function checkSlip(E, x, y) {
  if (!S.armed || S.ended || pointInShape(S.st.shape, x, y)) return;
  const e = nearestEdge(S.st.shape, x, y);
  if (e.d <= T.slipTolerance) return;
  S.armed = false; S.stroke = null;
  S.slips++;
  S.marks.push({ x: e.x, y: e.y });
  E.audio.play('miss');
  if (S.slips >= T.maxSlips) finish(E, 'ruined');
}

// Walk the needle from its last position to (x, y), sampling every sampleSpacing along the way.
function moveNeedle(E, x, y) {
  if (!S.last) { S.last = { x, y }; S.carry = 0; sample(E, x, y); return; }
  const dx = x - S.last.x, dy = y - S.last.y, len = Math.hypot(dx, dy);
  if (len === 0) return;
  const ux = dx / len, uy = dy / len;
  let t = T.sampleSpacing - S.carry; // distance along this segment to the next sample
  while (t <= len && !S.ended) { sample(E, S.last.x + ux * t, S.last.y + uy * t); t += T.sampleSpacing; }
  S.carry = T.sampleSpacing - (t - len);
  S.last = { x, y };
  checkSlip(E, x, y); // the real needle position too, so a reversal apex between samples still counts
}

function finish(E, reason) {
  if (S.ended) return;
  S.ended = reason;
  S.holdT = T.endHold;
  S.stroke = null;
}

function needleFromPointer(p, E) {
  const v = view(E);
  return { x: (p.x - v.ox) / v.s, y: (p.y - T.needleOffset - v.oy) / v.s };
}

function liftFinger() {
  S.pid = null; S.last = null; S.stroke = null; S.armed = false; S.finger = null;
}

// ---------- Drawing ----------

function shapePath(ctx, shape) {
  ctx.beginPath();
  for (const poly of shape) {
    poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  }
}

// The ink lives on an offscreen layer (design space, clipped to the stencil like the score) that only ever receives new
// segments; each frame just blits it. A resize changes the layer scale, so it is rebuilt from the stored strokes.
function syncInk(E, v) {
  const k = v.s * Math.min(E.dpr || 1, T.inkLayerMaxDpr);
  const w = Math.ceil(T.designW * k), h = Math.ceil(T.designH * k);
  if (!S.layer || S.layerK !== k) {
    S.layer = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
    S.layerK = k; S.inkDone = [];
    const c = S.layer.getContext('2d');
    c.setTransform(k, 0, 0, k, 0, 0);
    shapePath(c, S.st.shape); c.clip('evenodd');
    c.strokeStyle = T.inkColor; c.fillStyle = T.inkColor;
    c.lineWidth = T.inkStrokeWidth; c.lineCap = 'round'; c.lineJoin = 'round';
  }
  const c = S.layer.getContext('2d');
  S.strokes.forEach((pts, n) => {
    const done = S.inkDone[n] || 0;
    if (done >= pts.length) return;
    if (pts.length === 2) { c.beginPath(); c.arc(pts[0], pts[1], T.needleR, 0, Math.PI * 2); c.fill(); }
    else {
      c.beginPath();
      c.moveTo(pts[Math.max(0, done - 2)], pts[Math.max(0, done - 2) + 1]);
      for (let i = Math.max(2, done); i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
      c.stroke();
    }
    S.inkDone[n] = pts.length;
  });
}

function drawPiece(ctx, E) {
  const v = view(E), shape = S.st.shape;
  syncInk(E, v);
  ctx.drawImage(S.layer, v.ox, v.oy, T.designW * v.s, T.designH * v.s);
  ctx.save();
  ctx.translate(v.ox, v.oy); ctx.scale(v.s, v.s);
  shapePath(ctx, shape);
  ctx.strokeStyle = T.stencilBlue; ctx.lineWidth = T.outlineWidth; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.strokeStyle = T.slipRed; ctx.lineWidth = 3; ctx.lineCap = 'round';
  const m = T.slipMarkSize;
  for (const k of S.marks) {
    ctx.beginPath();
    ctx.moveTo(k.x - m, k.y - m); ctx.lineTo(k.x + m, k.y + m);
    ctx.moveTo(k.x + m, k.y - m); ctx.lineTo(k.x - m, k.y + m);
    ctx.stroke();
  }
  ctx.restore();
}

// The tattoo machine, in screen pixels: grip at the finger, tube, needle, and a ring showing the ink radius at the tip.
function drawMachine(ctx, E) {
  const f = S.finger; if (!f) return;
  const s = view(E).s, tipY = f.y - T.needleOffset;
  const gw = T.machineGripW / 2, tw = T.machineTubeW / 2, neck = tipY + 12;
  ctx.fillStyle = T.machineBody; ctx.strokeStyle = T.machineEdge; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(f.x - gw, f.y); ctx.lineTo(f.x - tw, neck); ctx.lineTo(f.x + tw, neck); ctx.lineTo(f.x + gw, f.y); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(f.x, neck); ctx.lineTo(f.x, tipY); ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.arc(f.x, tipY, T.needleR * s, 0, Math.PI * 2); ctx.lineWidth = 1.5; ctx.globalAlpha = 0.8; ctx.stroke(); ctx.globalAlpha = 1;
  ctx.fillStyle = T.machineEdge;
  ctx.beginPath(); ctx.arc(f.x, tipY, 2.5, 0, Math.PI * 2); ctx.fill();
}

function drawStar(ctx, cx, cy, R, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? R * 0.45 : R, a = -Math.PI / 2 + (i * Math.PI) / 5;
    i ? ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)) : ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  ctx.closePath();
  if (filled) { ctx.fillStyle = T.starColor; ctx.fill(); }
  else { ctx.strokeStyle = T.lockColor; ctx.lineWidth = R > 8 ? 2 : 1; ctx.lineJoin = 'round'; ctx.stroke(); }
}

function drawLock(ctx, cx, cy) {
  ctx.fillStyle = T.lockColor; ctx.strokeStyle = T.lockColor; ctx.lineWidth = 3;
  ctx.fillRect(cx - 9, cy - 2, 18, 14);
  ctx.beginPath(); ctx.arc(cx, cy - 2, 6, Math.PI, 0); ctx.stroke();
}

// ---------- Progress (saved) ----------
// unlocked: highest unlocked stencil index. best: percentage per stencil. stars: best stars per stencil. clean: a zero-slip pass per stencil.

function progress(E) {
  const best = E.save.get('best', {}), stars = E.save.get('stars', {}), clean = E.save.get('clean', {});
  const unlocked = clamp(E.save.get('unlocked', 0), 0, STENCILS.length - 1);
  let total = 0;
  for (let i = 0; i < STENCILS.length; i++) total += stars[i] || 0;
  return { best, stars, clean, unlocked, total };
}

function recordResult(E, idx, { pct, stars, ruined, clean }) {
  const p = progress(E);
  if (!ruined && pct > (p.best[idx] || 0)) E.save.set('best', { ...p.best, [idx]: pct });
  if (stars > (p.stars[idx] || 0)) E.save.set('stars', { ...p.stars, [idx]: stars });
  if (clean && !p.clean[idx]) E.save.set('clean', { ...p.clean, [idx]: true });
  if (stars >= 1) E.save.set('unlocked', Math.max(p.unlocked, Math.min(idx + 1, STENCILS.length - 1)));
}

// ---------- Scenes ----------

const menu = {
  enter() { this.btnPlay = null; this.btnMute = null; this.tiles = []; },
  render(ctx, E) {
    const cx = E.w / 2, p = progress(E), gap = T.gridGap, cols = T.gridCols;
    E.text('INK', cx, E.safe.top + E.h * 0.08, { size: 48, weight: '800', color: T.textColor });
    E.text(`Stars ${p.total} / ${STENCILS.length * T.starPercents.length}`, cx, E.safe.top + E.h * 0.08 + 40, { size: 18, color: T.starColor });

    const m = 16, tw = (E.w - 2 * m - (cols - 1) * gap) / cols, th = T.tileH, top = E.safe.top + E.h * 0.08 + 68;
    this.tiles = [];
    STENCILS.forEach((st, i) => {
      const x = m + (i % cols) * (tw + gap), y = top + Math.floor(i / cols) * (th + gap);
      const locked = i > p.unlocked, cleared = (p.stars[i] || 0) > 0;
      E.roundRect(x, y, tw, th, 10, locked ? '#3a281f' : T.cardColor, cleared ? T.stencilBlue : locked ? '#4a3428' : T.lockColor);
      E.text(`${i + 1}`, x + tw / 2, y + 18, { size: 20, weight: '800', color: locked ? T.lockColor : T.textColor });
      if (locked) drawLock(ctx, x + tw / 2, y + th / 2 + 2);
      else {
        if (st.boss) E.text('Boss', x + tw / 2, y + 40, { size: 14, color: T.textColor });
        if (p.clean[i]) E.text('Clean', x + tw / 2, y + 58, { size: 14, weight: '800', color: T.stencilBlue });
        const step = (tw - 6) / T.starPercents.length;
        for (let k = 0; k < T.starPercents.length; k++) drawStar(ctx, x + 3 + step * (k + 0.5), y + th - 12, step * 0.46, k < (p.stars[i] || 0));
      }
      this.tiles.push({ x, y, w: tw, h: th, idx: i, locked });
    });

    const py = top + Math.ceil(STENCILS.length / cols) * (th + gap) + 44;
    this.btnPlay = E.button(p.unlocked > 0 ? `Play ${p.unlocked + 1}` : 'Play', cx, py, { fill: T.buttonFill, h: 64, size: 24 });
    this.btnMute = E.button(E.audio.muted ? 'Sound: off' : 'Sound: on', cx, py + 80, { fill: T.buttonAltFill, w: 170, h: 48, size: 16 });
  },
  onTap(p, E) {
    if (E.hit(this.btnPlay, p)) { E.audio.play('tap'); E.setScene('play', { stencil: progress(E).unlocked }); return; }
    if (E.hit(this.btnMute, p)) { E.audio.toggleMute(); E.audio.play('tap'); return; }
    const t = this.tiles.find((t) => !t.locked && E.hit(t, p));
    if (t) { E.audio.play('tap'); E.setScene('play', { stencil: t.idx }); }
  },
};

const play = {
  enter(E, { stencil = 0 } = {}) { newAttempt(clamp(stencil, 0, STENCILS.length - 1)); },
  update(dt, E) {
    if (S.ended) {
      S.holdT -= dt;
      if (S.holdT <= 0) this.toCard(E);
      return;
    }
    if (!S.started) return;
    S.time -= dt;
    if (S.time <= 0) { S.time = 0; finish(E, 'time'); }
  },
  toCard(E) {
    const pct = percent(), ruined = S.ended === 'ruined';
    const stars = ruined ? 0 : starsFor(pct);
    const failed = ruined || pct < T.passPercent;
    const clean = !failed && S.slips === 0;
    recordResult(E, S.idx, { pct, stars, ruined, clean });
    E.setScene('over', { idx: S.idx, pct, stars, failed, clean, best: progress(E).best[S.idx] || 0, boss: S.st.boss, last: S.idx === STENCILS.length - 1 });
  },
  onPointerDown(p, E) {
    if (S.ended) return;
    if (S.pid !== null) { if (E.pointers.has(S.pid)) return; liftFinger(); } // a lost up or cancel must not lock out inking
    S.pid = p.id; S.started = true; S.finger = { x: p.x, y: p.y };
    E.audio.play('tap');
    const n = needleFromPointer(p, E);
    moveNeedle(E, n.x, n.y);
  },
  onPointerMove(p, E) {
    if (p.id !== S.pid || S.ended) return;
    S.finger = { x: p.x, y: p.y };
    const n = needleFromPointer(p, E);
    moveNeedle(E, n.x, n.y);
  },
  onPointerUp(p, E) { if (p.id === S.pid) liftFinger(); },
  render(ctx, E) {
    drawPiece(ctx, E);
    drawMachine(ctx, E);
    const top = E.safe.top + T.hudTop, cx = E.w / 2;
    E.text(`${percent()}%`, cx, top + 30, { size: 60, weight: '800', color: T.textColor });
    E.text(`${Math.ceil(S.time)}`, 16, top + 28, { size: 48, weight: '800', align: 'left', color: S.time <= 5 && S.started ? T.slipRed : T.textColor });
    E.text(`${S.slips}/${T.maxSlips}`, E.w - 16, top + 28, { size: 26, weight: '800', align: 'right', color: S.slips ? T.slipRed : T.textColor });
  },
};

const over = {
  enter(E, params) {
    this.p = params;
    this.btnMain = null; this.btnMenu = null;
    E.audio.play(params.failed ? 'lose' : 'win');
  },
  render(ctx, E) {
    const p = this.p, cx = E.w / 2;
    drawPiece(ctx, E);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, E.w, E.h);

    const w = Math.min(320, E.w - 32), h = 392, x = cx - w / 2, y = Math.max(E.safe.top + 16, (E.h - h) / 2);
    E.roundRect(x, y, w, h, 20, T.cardColor, T.stencilBlue);
    if (p.boss) E.text('Boss', cx, y + 24, { size: 16, weight: '800', color: T.stencilBlue });
    E.text(`${p.pct}%`, cx, y + 68, { size: 72, weight: '800', color: T.textColor });
    for (let i = 0; i < 5; i++) drawStar(ctx, cx + (i - 2) * 44, y + 134, 18, i < p.stars);
    if (p.clean) E.text('Clean', cx, y + 180, { size: 22, weight: '800', color: T.stencilBlue });
    E.text(`Best ${p.best}%`, cx, y + 214, { size: 18, color: '#b8a698' });
    // Primary: Again on a fail, Next on a pass, Menu on a pass of the last stencil. Secondary Menu always, unless it is already primary.
    const menuIsPrimary = !p.failed && p.last;
    this.btnMain = E.button(p.failed ? 'Again' : p.last ? 'Menu' : 'Next', cx, y + 270, { w: w - 48, fill: T.buttonFill, size: 22 });
    this.btnMenu = menuIsPrimary ? null : E.button('Menu', cx, y + 340, { w: w - 48, h: 48, fill: T.buttonAltFill, size: 18 });
  },
  onTap(p, E) {
    if (E.hit(this.btnMain, p)) {
      E.audio.play('tap');
      const q = this.p;
      if (q.failed) E.setScene('play', { stencil: q.idx });
      else if (q.last) E.setScene('menu');
      else E.setScene('play', { stencil: q.idx + 1 });
    } else if (this.btnMenu && E.hit(this.btnMenu, p)) { E.audio.play('tap'); E.setScene('menu'); }
  },
};

export const game = {
  slug: 'ink',
  title: 'Ink',
  saveVersion: 2,
  // v1 saved only best percentages. Derive stars and the unlock from them.
  migrate(data, fromVersion) {
    if (fromVersion < 2) {
      const best = data.best || {}, stars = {};
      let unlocked = 0;
      for (const id of Object.keys(best)) {
        const n = starsFor(best[id]);
        if (n) { stars[id] = n; unlocked = Math.max(unlocked, Number(id) + 1); }
      }
      data.stars = stars; data.clean = {}; data.unlocked = Math.min(unlocked, STENCILS.length - 1);
    }
    return data;
  },
  TUNING,
  start: 'menu',
  scenes: { menu, play, over },
  // Read by tools/sim-ink.mjs so the simulator runs the real coverage and slip code.
  sim: { stencils: STENCILS, percent, slips: () => S.slips, ended: () => S.ended },
};
