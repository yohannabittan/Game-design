// Arena: Feature: the range trials (step 27b): Shrinking Target: knives, The Knife Board and The Wheel, thrown with the angle knife (step 27).
// Hooks: trials.js (startRange, updateRange, rangeCount for its three trials), ranged.js (while state.range is set: lineAt, chestK, the throw's
// point and arc, knifeLands, the knife count), scenes.js play.render (drawRange, behind you). The sparring foe is parked off screen; on the board
// and the wheel his figure, unarmoured, is the man (drawn and hit in a frame of our own).
import { clamp, lerp, makeRng, hashString } from '../engine.js';
import { TUNING } from '../tuning.js';
import { lay, youF, foeF, toScreen, toLocal, partLocal, inside, pop, ring, dust, dullSound } from '../fight.js';
import { drawFighter } from '../draw-fight.js';
import { state, artImg } from '../game.js';
import { backPt, drawKnife } from './ranged.js';
import { PARTS, SHOULDER } from '../data.js';

// ====== THE RANGE ======
// mode: 'targets', 'board' or 'wheel'. Sizes are the range sketch's px at a 402 px tall screen (sc), the man's offsets his heights (H).
const MODES = { shrinkKnives: 'targets', board: 'board', wheel: 'wheel' };
const sc = (E) => E.h / 402;
export function startRange(E, id) {
  const R = TUNING.range;
  state.range = { mode: MODES[id], rng: makeRng(TUNING.trials.seed ^ hashString(`range-${id}`)), idx: 0, lvl: 0, misses: 0, score: 0, wait: 0, after: null, end: null,
    hurt: -1, target: null, pots: [], stuck: [], wheel: { th: 0, w: 0, dir: 1 } };
  for (const p of state.foe.parts) { p.armour = false; p.guard = false; }
  parkFoe(); standYou(E);
  state.knives = R.knives;
  const r = state.range;
  if (r.mode === 'targets') newTarget(E); else if (r.mode === 'board') newBoard(E); else newWheel(E);
}
// before the arm is solved each frame (play.update): the man parked, you on your mark
export function holdRange(E) { parkFoe(); standYou(E); }
// you stand at TUNING.range.you of the width (the bout's mark is set for a foe at arm's length)
function standYou(E) { state.foot.pos += (TUNING.range.you * E.w - youF(E).x) / lay(E).H; }
// the sparring foe stands far off screen, never in reach
function parkFoe() { state.step.x = state.step.tgt = TUNING.range.park; state.foe.dx = 1e5; }

// ----- where things are, on screen -----
const floorY = (E) => lay(E).floor;
// the target's centre and radius now (it sways from the swayFrom'th on)
function targetAt(E, t = state.range.target) {
  const T = TUNING.range.target, s = sc(E), R = t.R * s, top = Math.max(E.safe.top + TUNING.range.top + R, floorY(E) - T.rise * s), bot = floorY(E) - R - T.foot * s;
  const x = E.w * TUNING.range.marks[t.mark] + t.jx * s + (t.sw ? Math.sin(state.m * T.swayHz + t.ph) * t.sw * s : 0);
  return { x, y: top + t.yk * Math.max(0, bot - top), R };
}
// the man's frame: on the board, standing at its foot; on the wheel, his middle on the hub, turned with it (a sit-down when hurt, on the board).
// He stands at your depth, so he is a medium body as tall as you; the board, the wheel and their pots are sized from him.
const manH = (E) => foeF(E).H;
export function manF(E) {
  const r = state.range, H = manH(E);
  if (r.mode === 'board') {
    const k = r.hurt < 0 ? 0 : clamp(r.hurt / TUNING.range.sit, 0, 1);
    return { x: E.w * TUNING.range.board.x, y: floorY(E) + k * k * 0.3 * H, a: k * 0.3, dir: -1, H };
  }
  const W = wheelAt(E), F0 = { x: 0, y: 0, a: -r.wheel.th, dir: -1, H }, [mx, my] = toScreen(F0, 0, -TUNING.range.wheel.mid);
  return { ...F0, x: W.x - mx, y: W.y - my };
}
const wheelAt = (E) => { const R = manH(E) / TUNING.range.wheel.man; return { x: E.w * TUNING.range.wheel.x, y: floorY(E) - R - 6 * sc(E), R }; };
// a pot's radius in px (its R is a share of his height on the board, of the wheel's radius on the wheel)
const potR = (E, p) => p.R * (state.range.mode === 'board' ? manH(E) : wheelAt(E).R);
// a pot's centre: on the board, from the man's feet; on the wheel, turned with it
function potAt(E, p) {
  const r = state.range;
  if (r.mode === 'board') { const H = manH(E); return [E.w * TUNING.range.board.x + p.lx * H, floorY(E) + p.ly * H]; }
  const W = wheelAt(E), c = Math.cos(r.wheel.th), s = Math.sin(r.wheel.th), x = p.lx * W.R, y = p.ly * W.R;
  return [W.x + x * c - y * s, W.y + x * s + y * c];
}
const boardRect = (E) => { const H = manH(E), B = TUNING.range.board; return { x: E.w * B.x - B.w * H / 2, y: floorY(E) - B.h * H, w: B.w * H, h: B.h * H }; };
function manAt(E, x, y) {
  const F = manF(E), fm = state.foe, [lx, ly] = toLocal(F, x, y), P = manPose(E, F), pad = TUNING.range.pad / F.H;
  return posed(P, () => fm.parts.some((p) => {
    if (p.d.id !== 'legs' || !P.legs) { const [qx, qy] = partLocal(p, fm, lx, ly); return inside(p.d, qx, qy, pad); }
    return P.legs.some((fr) => { fm.fr.legs = fr; const [qx, qy] = partLocal(p, fm, lx, ly); return inside(p.d, qx, qy, pad); });
  }));
}
// His pose, in his frame F: on the board, his back to the planks and his arms at his sides; on the wheel, spread-eagled, each wrist and ankle
// toward its strap (Pack 30's straps, turned with the wheel). legs: the two frames his legs are drawn and hit in (each turned about the hip).
const HIP = [0, -0.38];
function manPose(E, F) {
  if (state.range.mode !== 'wheel') return { fr: { armF: { ox: SHOULDER[0], oy: SHOULDER[1], rot: 0.04 }, armB: { ox: PARTS[4].joint[0], oy: PARTS[4].joint[1], rot: -0.04 } }, legs: null };
  const W = wheelAt(E), th = state.range.wheel.th, c = Math.cos(th), s = Math.sin(th);
  const at = ([sx, sy]) => toLocal(F, W.x + (sx * c - sy * s) * W.R, W.y + (sx * s + sy * c) * W.R);
  const [w1, w2, a1, a2] = TUNING.range.wheel.straps.map(at), hands = w1[0] > w2[0] ? [w1, w2] : [w2, w1];
  // (a limb from its joint o toward t: the frame's rot puts the limb's +y along it)
  const aim = (o, t) => Math.atan2(-(t[0] - o[0]), t[1] - o[1]);
  const jF = SHOULDER, jB = PARTS[4].joint, leg = (t) => { const r = aim(HIP, t), cr = Math.cos(r), sr = Math.sin(r); return { ox: HIP[0] - (HIP[0] * cr - HIP[1] * sr), oy: HIP[1] - (HIP[0] * sr + HIP[1] * cr), rot: r, a: r }; };
  return { fr: { armF: { ox: jF[0], oy: jF[1], rot: aim(jF, hands[0]) }, armB: { ox: jB[0], oy: jB[1], rot: aim(jB, hands[1]) } }, legs: [leg(a1), leg(a2)] };
}
// run fn with the man in his pose (the parked foe's own frames put back after)
function posed(P, fn) {
  const fm = state.foe, keep = fm.fr;
  fm.fr = { ...keep, ...P.fr };
  try { return fn(); } finally { fm.fr = keep; }
}
// what is at (x, y): a pot, the man, or nothing (the board and the wheel are behind them)
function whatAt(E, x, y) {
  for (const p of state.range.pots) { if (!p.alive) continue; const [px, py] = potAt(E, p); if (Math.hypot(x - px, y - py) <= potR(E, p) + TUNING.range.pad) return { k: 'pot', p }; }
  return manAt(E, x, y) ? { k: 'man' } : null;
}

// ----- the knife's line (ranged.js lineAt while state.range is set) -----
// From the drawn-back hand (o) toward the scene's middle at a height set by k (0: the span's top, 1: its foot): on the target, where the line crosses
// its middle; on the board and the wheel, the first pot or the man it meets; else into the board or the wheel where it crosses the middle, or past.
export function rangeLine(E, k, o) {
  const r = state.range, s = sc(E), [sp0, sp1] = TUNING.range.span, fy = floorY(E);
  const ex = r.mode === 'targets' ? targetAt(E).x : r.mode === 'board' ? E.w * TUNING.range.board.x : wheelAt(E).x, ey = lerp(fy - sp0 * s, fy + sp1 * s, k);
  const d = Math.hypot(ex - o[0], ey - o[1]) || 1;
  return { ex, ey, o, ...along(E, o, (ex - o[0]) / d, (ey - o[1]) / d) };
}
// what a straight line from o along (ux, uy) meets now: the target, the first pot or the man, the wood, or nothing (past)
function along(E, o, ux, uy) {
  const r = state.range, fy = floorY(E), ex = r.mode === 'targets' ? targetAt(E).x : r.mode === 'board' ? E.w * TUNING.range.board.x : wheelAt(E).x, out = { part: null, hit: null };
  if (r.mode === 'targets') {
    const t = targetAt(E), y = o[1] + uy * (t.x - o[0]) / ux, on = Math.hypot(0, y - t.y) <= t.R;
    return on ? { ...out, x: t.x, y, over: 'target', part: 'target' } : { ...out, ...past(E, o, ux, uy), over: 'miss' };
  }
  for (let q = 0; ; q += 2) {
    const x = o[0] + ux * q, y = o[1] + uy * q;
    if (y >= fy || x > E.w + 40 || y < -40) break;
    const c = x > ex - 1.4 * manH(E) && whatAt(E, x, y);
    if (c) return { ...out, x, y, over: c.k, part: c.k, hit: c.p || null };
  }
  const yc = o[1] + uy * (ex - o[0]) / ux, W = r.mode === 'wheel' && wheelAt(E), B = r.mode === 'board' && boardRect(E);
  if ((W && Math.abs(yc - W.y) <= W.R * 0.9) || (B && yc >= B.y && yc <= B.y + B.h)) return { ...out, x: ex, y: yc, over: 'wood' };
  return { ...out, ...past(E, o, ux, uy), over: 'miss' };
}
// a line that meets nothing ends in the sand, or off the screen's edge
function past(E, o, ux, uy) {
  const fy = floorY(E), q = Math.min(uy > 0 ? (fy - o[1]) / uy : 1e9, (E.w + 40 - o[0]) / ux);
  return { x: o[0] + ux * q, y: Math.min(fy, o[1] + uy * q) };
}
// where a plain press aims: the target's middle; on the board and the wheel, the man's chest (a plain press is no free hit)
export function rangeK0(E, o) {
  const r = state.range, s = sc(E), [sp0, sp1] = TUNING.range.span, fy = floorY(E);
  let x, y;
  if (r.mode === 'targets') ({ x, y } = targetAt(E));
  else { [x, y] = toScreen(manF(E), 0, -0.6); }
  const ex = r.mode === 'targets' ? x : r.mode === 'board' ? E.w * TUNING.range.board.x : wheelAt(E).x, ey = o[1] + (y - o[1]) * (ex - o[0]) / ((x - o[0]) || 1);
  return clamp((ey - (fy - sp0 * s)) / ((sp0 + sp1) * s), 0, 1);
}
// the knife's rise in flight (px at the top of its arc): a little, more the further it flies (the sketch's arc)
export function rangeArc(E, x0, x1) { return TUNING.range.arc * sc(E) * clamp((x1 - x0 - E.w * 0.3) / (E.w * 0.45), 0, 1); }

// ----- a knife arrives (ranged.js knifeLands): it flew straight along its line, and hits what is on that line now (the wheel turns and the target
// sways while it flies: on the wheel, leading the spin is the skill) -----
export function rangeLands(E, k) {
  const r = state.range, ang = Math.atan2(k.y1 - k.y0, k.x1 - k.x0), R = TUNING.range;
  if (r.end || r.hurt >= 0) return;
  const o = k.o || [k.x0, k.y0], d0 = Math.hypot(k.x1 - o[0], k.y1 - o[1]) || 1, L = along(E, o, (k.x1 - o[0]) / d0, (k.y1 - o[1]) / d0), x = L.x, y = L.y;
  if (r.mode === 'targets') {
    const t = targetAt(E), d = Math.min(t.R, Math.hypot(x - t.x, y - t.y));
    if (L.over === 'target') {
      const q = d / t.R, pts = q < R.target.rings[0] ? 10 : q < R.target.rings[1] ? 5 : 2;
      r.stuck.push({ on: 'target', lx: x - t.x, ly: y - t.y, ang }); r.score++;
      dust(x, y, 6); dullSound(E); E.haptic(14);
      pop(x, y - 14, String(pts), pts === 10 ? '#ffd24a' : '#ffffff', pts === 10 ? 30 : 24);
      if (pts === 10 && r.misses > 0) { r.misses--; pop(t.x, t.y - t.R - 18, 'MISS BACK', '#7be07b', 18); E.audio.beep({ freq: 1320, dur: 0.12, type: 'sine', gain: 0.08 }); }
      r.wait = R.between[0]; r.after = () => { r.idx++; r.stuck = []; newTarget(E); };
      return;
    }
    miss(E, x, y, ang, false);
    return;
  }
  if (L.over === 'pot') { burst(E, L.hit, ang); return; }
  if (L.over === 'man') { ow(E, x, y, ang); return; }
  miss(E, x, y, ang, L.over === 'wood');
}
function burst(E, p, ang) {
  const r = state.range, [x, y] = potAt(E, p), s = sc(E), R = TUNING.range, pr = potR(E, p);
  p.alive = false; r.score++;
  for (let i = 0; i < R.wine; i++) {
    const a = ang + Math.PI + (Math.random() - 0.5) * 3.4, v = (60 + Math.random() * 190) * s;
    state.fx.push({ k: 'b', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 90 * s, g: 620, r: (2 + Math.random() * 3.5) * Math.max(0.6, pr / (15 * s)) * s, life: 0.5 + Math.random() * 0.5, max: 1, c: WINE[i % 3] });
  }
  ring(x, y, pr * 2.2, '#b3192b');
  E.audio.beep({ freq: 420, dur: 0.08, type: 'square', slide: 0.4, gain: 0.08 }); E.audio.noise({ dur: 0.12, gain: 0.12 }); E.haptic(18);
  pop(x, y - pr - 10, 'SPLASH!', '#ff8a8a', 20);
  if (r.pots.some((q) => q.alive)) return;
  r.wait = R.between[1]; state.knives = 0;
  if (r.mode === 'board') { pop(E.w * R.board.x, boardRect(E).y - 16, 'NEW BOARD', '#ffe08a', 24); r.after = () => { r.lvl++; newBoard(E); }; }
  else { const nl = r.lvl + 1, W = wheelAt(E); pop(W.x, W.y - W.R - 14, nl % 2 ? 'FASTER, REVERSE!' : 'FASTER!', '#ffe08a', 22); r.after = () => { r.lvl = nl; newWheel(E); }; }
}
const WINE = ['#b3192b', '#d12a3c', '#8c1020'];
// the man is hit: a comic yelp and a hard sit-down, no blood; the trial ends on what was burst
function ow(E, x, y, ang) {
  const r = state.range, F = manF(E), [hx, hy] = toScreen(F, 0, -0.95);
  r.hurt = 0; r.end = R_END.ow;
  r.stuck.push({ on: 'fall', x, y, ang, vx: -70, vy: -160 });
  pop(hx - 10, hy - 30, 'OW!', '#ffd34a', 44);
  E.audio.beep({ freq: 620, dur: 0.12, type: 'square', slide: 1.6, gain: 0.1 }); E.audio.beep({ freq: 980, dur: 0.28, type: 'triangle', slide: 0.5, gain: 0.1, delay: 0.1 });
  E.shake(6, 0.2); E.haptic(30);
}
const R_END = { ow: 'ow', misses: 'misses' };
function miss(E, x, y, ang, wood) {
  const r = state.range, R = TUNING.range;
  if (wood) { r.stuck.push({ on: r.mode, ...stuckAt(E, x, y), ang: ang - (r.mode === 'wheel' ? r.wheel.th : 0) }); dust(x, y, 5); dullSound(E); }
  else { state.knifeFall = { x, y, vx: Math.cos(ang) * 260, vy: Math.sin(ang) * 260 - 60, rot: ang, vr: 12, flat: Math.PI * 0.02, floor: floorY(E) - 2, life: TUNING.knives.fall }; E.audio.play('miss'); }
  r.misses++;
  pop(x, y - 18, 'MISS', '#ff8a70', 20);
  if (r.misses >= R.misses) { r.end = R_END.misses; r.wait = R.ending; }
}
// a knife in the wood keeps its place on the wheel as it turns
function stuckAt(E, x, y) {
  const r = state.range;
  if (r.mode !== 'wheel') return { x, y };
  const W = wheelAt(E), c = Math.cos(-r.wheel.th), s = Math.sin(-r.wheel.th), dx = (x - W.x) / W.R, dy = (y - W.y) / W.R;
  return { lx: dx * c - dy * s, ly: dx * s + dy * c };
}

// ----- the targets, boards and wheels, set up from the trial's seeded rng -----
function newTarget(E) {
  const r = state.range, T = TUNING.range.target, i = r.idx, rng = r.rng;
  r.target = { mark: i % 3, R: Math.max(T.min, T.R * T.shrink ** i), jx: (rng() - 0.5) * T.jitter, yk: rng(), ph: rng() * 6.28,
    sw: i >= T.swayFrom ? Math.min(T.sway[2], T.sway[0] + (i - T.swayFrom) * T.sway[1]) : 0 };
}
function newBoard(E) {
  const r = state.range, B = TUNING.range.board, L = r.lvl, R = Math.max(B.min, B.R * B.shrink ** L), c = Math.max(B.closeMin, 1 - B.close * L);
  r.pots = B.pots.map(([x, y]) => ({ lx: x * c, ly: B.mid + (y - B.mid) * c, R, kind: r.rng() < 0.5 ? 'pot-clay' : 'pot-wineskin', alive: true }));
  r.stuck = []; reachable(E);
  state.knives = TUNING.range.knives;
}
function newWheel(E) {
  const r = state.range, W = TUNING.range.wheel, L = r.lvl, R = Math.max(W.min, W.potR * W.shrink ** L);
  r.wheel = { th: r.wheel.th, w: L ? W.speed + W.step * Math.min(L, W.steps) : W.first, dir: L >= 1 && L % 2 ? -1 : 1 };
  r.pots = W.at.map((a) => { const q = a * Math.PI / 180; return { lx: Math.sin(q) * W.r, ly: -Math.cos(q) * W.r, R, kind: r.rng() < 0.5 ? 'pot-clay' : 'pot-wineskin', alive: true }; });
  r.stuck = [];
  state.knives = TUNING.range.knives;
}
// a board keeps only the pots some line can burst (each one in front of another counts once that one is gone): no board that can't be cleared
function reachable(E) {
  const r = state.range, o = backPt(E), keep = new Set();
  for (let pass = 0; pass < 4; pass++) {
    let more = false;
    for (let i = 0; i <= 120; i++) {
      const L = rangeLine(E, i / 120, o);
      if (L.over === 'pot' && !keep.has(L.hit)) { keep.add(L.hit); L.hit.alive = false; more = true; }
    }
    if (!more) break;
  }
  for (const p of r.pots) p.alive = keep.has(p);
  r.pots = r.pots.filter((p) => p.alive);
}

// One frame of the range: the wheel turns, the man sits down, the beat between boards, the end. Returns the score once it is over, else null.
export function updateRange(E, dt) {
  const r = state.range, R = TUNING.range;
  parkFoe(); state.foe.hp = state.foe.shown = state.foe.maxHp; standYou(E);
  if (r.wait <= 0 && !r.end && !r.after && state.knives > 0) state.knives = R.knives;
  if (r.mode === 'wheel') { if (r.hurt >= 0) r.wheel.w *= Math.exp(-2.5 * dt); r.wheel.th += r.wheel.w * r.wheel.dir * dt; }
  if (r.hurt >= 0) { r.hurt += dt; return r.hurt >= R.hurt ? r.score : null; }
  if (r.wait > 0 && (r.wait -= dt) <= 0) {
    if (r.end) return r.score;
    const a = r.after; r.after = null; if (a) a();
  }
  return null;
}
// the trial line's count: what is hit or burst, the board or wheel, and the misses left
export function rangeCount() {
  const r = state.range, left = Math.max(0, TUNING.range.misses - r.misses), m = `${'●'.repeat(left)}${'○'.repeat(TUNING.range.misses - left)}`;
  return r.mode === 'targets' ? `HIT ${r.score}  ·  ${m}` : `POTS ${r.score}  ·  ${r.mode === 'board' ? 'BOARD' : 'WHEEL'} ${r.lvl + 1}  ·  ${m}`;
}

// ----- drawing, behind you and the knife (play.render) -----
export function drawRange(ctx, E) {
  const r = state.range, s = sc(E), fy = floorY(E);
  // the three marks on the sand, the live one lit
  if (r.mode === 'targets') TUNING.range.marks.forEach((m, i) => {
    const x = E.w * m, on = r.target && r.target.mark === i;
    ctx.fillStyle = on ? 'rgba(255,224,138,0.9)' : 'rgba(240,230,204,0.35)'; ctx.fillRect(x - 14 * s, fy + 6 * s, 28 * s, 3 * s);
  });
  if (r.mode === 'targets') drawTarget(ctx, E);
  else if (r.mode === 'board') {
    const B = boardRect(E), im = artImg('knife-board');
    if (im) ctx.drawImage(im, 0, 0, im.width, 1131, B.x, B.y, B.w, B.h);
    else { ctx.fillStyle = '#b5652a'; ctx.fillRect(B.x, B.y, B.w, B.h); ctx.strokeStyle = '#5a2e12'; ctx.lineWidth = 3; ctx.strokeRect(B.x, B.y, B.w, B.h); }
    stuckKnives(ctx, E);
    drawMan(ctx, E);
    for (const p of r.pots) if (p.alive) drawPot(ctx, E, p, 0);
  } else {
    const W = wheelAt(E), im = artImg('knife-wheel');
    ctx.fillStyle = '#4a2d1a'; ctx.fillRect(W.x - 4 * s, W.y, 8 * s, fy - W.y);
    ctx.save(); ctx.translate(W.x, W.y); ctx.rotate(r.wheel.th);
    if (im) { const k = W.R / 460; ctx.drawImage(im, -460 * k, -460 * k, 920 * k, 920 * k); }
    else { ctx.fillStyle = '#9a5a2a'; ctx.beginPath(); ctx.arc(0, 0, W.R, 0, 6.28); ctx.fill(); ctx.strokeStyle = '#4a2a12'; ctx.lineWidth = 4; ctx.stroke(); }
    ctx.restore();
    stuckKnives(ctx, E);
    drawMan(ctx, E);
    for (const p of r.pots) if (p.alive) drawPot(ctx, E, p, r.wheel.th);
  }
  for (const q of r.stuck) if (q.on === 'fall') { q.vy += 900 / 60; q.x += q.vx / 60; q.y = Math.min(fy, q.y + q.vy / 60); drawThrown(ctx, E, q.x, q.y, q.ang + (fy - q.y) * 0.02); }
}
// the man in his pose; spread-eagled, his body above the hip, then each leg turned about the hip toward its strap (the figure clipped to each)
function drawMan(ctx, E) {
  const F = manF(E), P = manPose(E, F);
  if (!P.legs) { posed(P, () => drawFighter(ctx, E, F, state.foe, 'edge')); return; }
  const clip = (y0, y1) => { ctx.beginPath(); [[-1, y0], [1, y0], [1, y1], [-1, y1]].forEach(([lx, ly], i) => { const [px, py] = toScreen(F, lx, ly); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); ctx.clip(); };
  const [hx, hy] = toScreen(F, HIP[0], HIP[1]);
  for (const fr of P.legs) {
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(F.dir * fr.a); ctx.translate(-hx, -hy); clip(HIP[1] - 0.02, 0.03);
    posed(P, () => drawFighter(ctx, E, F, state.foe, 'edge')); ctx.restore();
  }
  ctx.save(); clip(-2, HIP[1]); posed(P, () => drawFighter(ctx, E, F, state.foe, 'edge')); ctx.restore();
}
function drawTarget(ctx, E) {
  const r = state.range, t = targetAt(E), s = sc(E), fy = floorY(E), im = artImg('range-target');
  // (the butt on a post down to the sand; the painting's easel is cropped)
  ctx.fillStyle = '#5a3a20'; ctx.fillRect(t.x - 4 * s, t.y, 8 * s, fy - t.y);
  if (im) { const k = t.R / 245; ctx.drawImage(im, 0, 0, 491, 472, t.x - 246 * k, t.y - 226 * k, 491 * k, 472 * k); }
  else {
    for (const [f, c] of [[1, '#d9c27a'], [0.73, '#f2efe6'], [0.57, '#222'], [0.45, '#c0392b'], [0.16, '#f1c40f']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(t.x, t.y, t.R * f, 0, 6.28); ctx.fill(); }
  }
  for (const q of r.stuck) if (q.on === 'target') drawThrown(ctx, E, t.x + q.lx, t.y + q.ly, q.ang);
}
function stuckKnives(ctx, E) {
  const r = state.range;
  for (const q of r.stuck) {
    if (q.on === 'board') drawThrown(ctx, E, q.x, q.y, q.ang);
    else if (q.on === 'wheel') {
      const W = wheelAt(E), c = Math.cos(r.wheel.th), s = Math.sin(r.wheel.th);
      drawThrown(ctx, E, W.x + (q.lx * c - q.ly * s) * W.R, W.y + (q.lx * s + q.ly * c) * W.R, q.ang + r.wheel.th);
    }
  }
}
// a pot or wine skin hung by its rope, its body's middle on the pot's point (Pack 30: the hanging point at the top, the body 62 to 144 px below)
function drawPot(ctx, E, p, rot) {
  const [x, y] = potAt(E, p), R = potR(E, p), im = artImg(p.kind), cy = 103, k = R / 36;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  if (im) ctx.drawImage(im, -im.width / 2 * k, -cy * k, im.width * k, im.height * k);
  else { ctx.fillStyle = p.kind === 'pot-clay' ? '#b8643a' : '#7a4a2a'; ctx.beginPath(); ctx.arc(0, 0, R, 0, 6.28); ctx.fill(); ctx.strokeStyle = '#3a2010'; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.restore();
}
// a thrown knife, stuck or falling: the fight's knife drawing
function drawThrown(ctx, E, x, y, ang) {
  const len = TUNING.knives.len * manH(E);
  drawKnife(ctx, x - Math.cos(ang) * len * 0.55, y - Math.sin(ang) * len * 0.55, ang, len);
}
