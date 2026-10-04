// Arena (feel prototype): cut the bare gaps of a straw training dummy, clang off the armour.
// Three input presets switch live in TUNE (cut.mode): 0 offset blade, 1 flick, 2 slow motion.
// All particles are the game's own so a hit-stop freezes the burst, then lets it fly.

import { makeRng, clamp } from './engine.js';

const TUNING = {
  bg: '#14100c',
  roundTime: 30,           // seconds per round
  resetDelay: 0.7,         // seconds after the last gap is cut before a fresh dummy
  swayRate: 1.3,           // radians per second of the dummy's sway
  swayBobRate: 2.4,
  dummy: {
    height: 0.8,           // body unit as a fraction of screen width
    pivotY: 0.64,          // pivot (feet) as a fraction of screen height
    swayDeg: 25,
    bob: 6,                // px
    kick: 0.9,             // angular impulse (rad/s) per cut
    armourMin: 3, armourMax: 4,
    // Parts in body units, origin at the feet, y up is negative.
    parts: [
      { id: 'head',  shape: 'circle', x: 0,     y: -0.77, r: 0.09 },
      { id: 'chest', shape: 'rect',   x: 0,     y: -0.59, w: 0.28, h: 0.18 },
      { id: 'belly', shape: 'rect',   x: 0,     y: -0.42, w: 0.20, h: 0.14 },
      { id: 'armL',  shape: 'rect',   x: -0.25, y: -0.61, w: 0.22, h: 0.075 },
      { id: 'armR',  shape: 'rect',   x: 0.25,  y: -0.61, w: 0.22, h: 0.075 },
      { id: 'legs',  shape: 'rect',   x: 0,     y: -0.17, w: 0.20, h: 0.34 },
    ],
  },
  cut: {
    mode: 0,               // 0 offset blade, 1 flick, 2 slow motion
    maxLen: 300,           // reach, px
    maxTime: 0.6,          // seconds to draw a cut
    offset: 70,            // blade above the finger, px
    pad: 5,                // forgiveness around parts, px
    slowMo: 0.25,          // dummy speed while slow-mo is active
    slowTime: 0.6,         // max seconds of slow-mo per touch
    flickWindow: 0.16,     // seconds of trail that define a flick
    flickMinSpeed: 350,    // px/s
    flickLenPerSpeed: 0.24,
    flickMinLen: 70,
  },
  juice: {
    hitStop: 0.06,         // per bare cut
    hitStopCombo: 0.11,
    clangStop: 0.025,
    strawPerCut: 26,
    strawPerCombo: 46,
    comboRing: 150,
  },
};

const STRAW = ['#e6c866', '#d4b04a', '#f2dc90', '#b8923a'];
const state = {};

const hasCombo = (n) => n >= 2;

function newRack(E) {
  const D = TUNING.dummy;
  const rng = makeRng(state.seed + state.rack * 7919);
  const order = rng.shuffle(D.parts.map((_, i) => i));
  const n = rng.chance(0.5) ? D.armourMin : D.armourMax;
  const armoured = new Set(order.slice(0, n));
  state.parts = D.parts.map((d, i) => {
    const straws = [];
    const sz = d.shape === 'circle' ? d.r * 2 : Math.max(d.w, d.h);
    for (let k = 0; k < 34; k++) straws.push({ x: (Math.random() - 0.5) * sz * 1.2, y: (Math.random() - 0.5) * sz * 1.2, a: Math.random() * Math.PI, l: 0.04 + Math.random() * 0.05, c: Math.random() * 4 | 0 });
    return { d, armour: armoured.has(i), cut: false, flash: 0, clang: 0, gash: null, straws };
  });
  state.pop = 1;
  state.resetT = 0;
}

function newRound(E, seed) {
  Object.assign(state, {
    seed, rack: 0, t: TUNING.roundTime, m: 0, stop: 0, kickA: 0, kickV: 0,
    cuts: 0, clangs: 0, combos: 0, bestCombo: 0,
    fx: [], pops: [], streaks: [], cut: null, slowUsed: 0, slowing: false, whiff: 0,
  });
  newRack(E);
}

// Where the dummy is on screen right now.
function lay(E) {
  const D = TUNING.dummy;
  const H = Math.min(E.w * D.height, E.h * 0.5);
  const a = (D.swayDeg * Math.PI / 180) * Math.sin(state.m * TUNING.swayRate) + state.kickA;
  const bob = Math.sin(state.m * TUNING.swayBobRate) * D.bob;
  return { H, a, px: E.w / 2, py: E.h * D.pivotY + bob };
}

// Screen point to the dummy's local (body unit) space.
function toLocal(L, x, y) {
  const dx = x - L.px, dy = y - L.py;
  const c = Math.cos(-L.a), s = Math.sin(-L.a);
  return [(dx * c - dy * s) / L.H, (dx * s + dy * c) / L.H];
}
function toScreen(L, lx, ly) {
  const c = Math.cos(L.a), s = Math.sin(L.a);
  return [L.px + (lx * c - ly * s) * L.H, L.py + (lx * s + ly * c) * L.H];
}

function inside(d, lx, ly, pad) {
  if (d.shape === 'circle') return Math.hypot(lx - d.x, ly - d.y) <= d.r + pad;
  return Math.abs(lx - d.x) <= d.w / 2 + pad && Math.abs(ly - d.y) <= d.h / 2 + pad;
}

// ----- particles -----
function straw(x, y, ang, spread, speed, n) {
  for (let i = 0; i < n; i++) {
    const a = ang + (Math.random() - 0.5) * spread;
    const s = speed * (0.35 + Math.random() * 0.9);
    state.fx.push({ k: 's', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, g: 650, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 14, len: 8 + Math.random() * 12, life: 0.7 + Math.random() * 0.5, max: 1.1, c: STRAW[Math.random() * 4 | 0] });
  }
}
function sparks(x, y, ang, n) {
  for (let i = 0; i < n; i++) {
    const a = ang + (Math.random() - 0.5) * 2.4;
    const s = 220 + Math.random() * 380;
    state.fx.push({ k: 'k', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 500, life: 0.18 + Math.random() * 0.2, max: 0.38, c: Math.random() < 0.5 ? '#ffe9a8' : '#ffffff' });
  }
}
function dust(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, s = 30 + Math.random() * 90;
    state.fx.push({ k: 'd', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, g: 0, life: 0.35 + Math.random() * 0.25, max: 0.6, r: 4 + Math.random() * 6, c: '#8a7452' });
  }
}
function ring(x, y, r, color) { state.fx.push({ k: 'r', x, y, r0: 10, r, life: 0.3, max: 0.3, c: color }); }
function pop(x, y, s, color, size) { state.pops.push({ x, y, s, color, size, life: 0.8, max: 0.8 }); }

// ----- sounds -----
function sliceSound(E, delay, big) {
  const A = E.audio, f = 1500 + Math.random() * 500;
  A.noise({ dur: 0.1, gain: 0.26, delay });
  A.beep({ freq: f, dur: 0.09, type: 'sawtooth', slide: 0.22, gain: 0.07, delay });
  A.beep({ freq: 150, dur: 0.1, type: 'sine', slide: 0.45, gain: 0.26, delay });
  A.noise({ dur: 0.03, gain: 0.2, delay: delay + 0.025 });
  A.noise({ dur: 0.03, gain: 0.16, delay: delay + 0.055 });
  if (big) A.beep({ freq: 90, dur: 0.22, type: 'sine', slide: 0.4, gain: 0.3, delay });
}
function clangSound(E, delay) {
  const A = E.audio;
  A.beep({ freq: 190, dur: 0.2, type: 'triangle', slide: 0.85, gain: 0.26, delay });
  A.beep({ freq: 301, dur: 0.12, type: 'square', slide: 0.9, gain: 0.05, delay });
  A.beep({ freq: 523, dur: 0.07, type: 'sine', gain: 0.05, delay });
  A.noise({ dur: 0.03, gain: 0.1, delay });
}

// ----- the cut -----
function bladeSeg(E) {
  const c = state.cut, T = TUNING.cut;
  if (!c) return null;
  if (T.mode === 1) return flickSeg(c);
  const ex = c.px, ey = c.py - T.offset;
  const dx = ex - c.sx, dy = ey - c.sy, len = Math.hypot(dx, dy);
  const k = len > T.maxLen ? T.maxLen / len : 1;
  return { x1: c.sx, y1: c.sy, x2: c.sx + dx * k, y2: c.sy + dy * k, len: len * k };
}

// A flick is the recent trail: its start, its direction, and a length from its speed.
function flickSeg(c) {
  const T = TUNING.cut, tr = c.trail;
  if (tr.length < 2) return null;
  const last = tr[tr.length - 1];
  let first = tr[0];
  for (const q of tr) if (last.t - q.t <= T.flickWindow) { first = q; break; }
  const dx = last.x - first.x, dy = last.y - first.y, d = Math.hypot(dx, dy), dt = Math.max(0.016, last.t - first.t);
  if (d < 24) return null;
  const speed = d / dt;
  if (speed < T.flickMinSpeed) return null;
  const len = clamp(speed * T.flickLenPerSpeed, T.flickMinLen, T.maxLen);
  return { x1: first.x, y1: first.y, x2: first.x + dx / d * len, y2: first.y + dy / d * len, len };
}

function strike(E, seg) {
  if (!seg || seg.len < 10) { state.whiff = 0.12; return; }
  const L = lay(E), pad = TUNING.cut.pad / L.H, J = TUNING.juice;
  const n = Math.ceil(seg.len / 3), ang = Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1);
  const hits = new Map();
  for (let i = 0; i <= n; i++) {
    const f = i / n, x = seg.x1 + (seg.x2 - seg.x1) * f, y = seg.y1 + (seg.y2 - seg.y1) * f;
    const [lx, ly] = toLocal(L, x, y);
    for (const p of state.parts) {
      if (!inside(p.d, lx, ly, pad)) continue;
      let h = hits.get(p);
      if (!h) { h = { p, f0: f, sx: 0, sy: 0, k: 0, lx0: lx, ly0: ly }; hits.set(p, h); }
      h.sx += x; h.sy += y; h.k++; h.lx1 = lx; h.ly1 = ly;
    }
  }
  state.streaks.push({ ...seg, life: 0.2, max: 0.2 });
  if (!hits.size) { state.whiff = 0.12; E.audio.noise({ dur: 0.07, gain: 0.07 }); E.audio.beep({ freq: 900, dur: 0.07, type: 'sine', slide: 0.4, gain: 0.04 }); return; }

  const list = [...hits.values()].sort((a, b) => a.f0 - b.f0);
  const fresh = list.filter((h) => !h.p.armour && !h.p.cut);
  const combo = hasCombo(fresh.length);
  let stop = 0, i = 0;
  for (const h of list) {
    const x = h.sx / h.k, y = h.sy / h.k, delay = i++ * 0.045;
    if (h.p.armour) {
      state.clangs++; h.p.clang = 0.22;
      sparks(x, y, ang + Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1), 16);
      ring(x, y, 34, '#cbd5e1');
      pop(x, y - 18, 'CLANG', '#9aa4b2', 15);
      clangSound(E, delay); E.shake(2.5, 0.09); E.haptic(10);
      stop = Math.max(stop, J.clangStop);
    } else if (!h.p.cut) {
      h.p.cut = true; h.p.flash = 0.16; h.p.gash = { a: [h.lx0, h.ly0], b: [h.lx1, h.ly1] };
      state.cuts++;
      const n2 = combo ? J.strawPerCombo : J.strawPerCut;
      straw(x, y, ang + Math.PI / 2, 2.6, 330, n2 >> 1);
      straw(x, y, ang - Math.PI / 2, 2.6, 330, n2 >> 1);
      dust(x, y, combo ? 10 : 5);
      sliceSound(E, delay, combo);
      stop = Math.max(stop, combo ? J.hitStopCombo : J.hitStop);
      state.kickV += TUNING.dummy.kick * (Math.cos(ang) > 0 ? 1 : -1) * (combo ? 1.6 : 1);
      E.haptic(15);
    }
  }
  if (fresh.length) {
    if (combo) {
      state.combos++; state.bestCombo = Math.max(state.bestCombo, fresh.length);
      const mx = (seg.x1 + seg.x2) / 2, my = (seg.y1 + seg.y2) / 2;
      ring(mx, my, J.comboRing, '#ffd24a');
      pop(mx, my - 40, `COMBO x${fresh.length}!`, '#ffd24a', 34);
      E.shake(9, 0.24); E.flash('#fff0b8', 0.09); E.haptic(40);
      E.audio.play('coin');
    } else E.shake(3.5, 0.1);
  }
  state.stop = Math.max(state.stop, stop);

  if (state.parts.every((p) => p.armour || p.cut) && !state.resetT) { state.resetT = TUNING.resetDelay; }
}

// ----- drawing helpers -----
function path(ctx, d, H, inset = 0) {
  ctx.beginPath();
  if (d.shape === 'circle') { ctx.arc(d.x * H, d.y * H, (d.r - inset) * H, 0, Math.PI * 2); return; }
  const w = (d.w - inset * 2) * H, h = (d.h - inset * 2) * H, x = d.x * H - w / 2, y = d.y * H - h / 2, r = Math.min(w, h) * 0.18;
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function drawPart(ctx, p, H) {
  const d = p.d;
  ctx.save();
  path(ctx, d, H);
  ctx.fillStyle = p.cut ? '#2b2217' : '#d9b95a';
  ctx.fill();
  ctx.save(); ctx.clip();
  ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (const s of p.straws) {
    ctx.strokeStyle = p.cut ? (s.c % 2 ? '#3a2e1f' : '#1c150e') : STRAW[s.c];
    const cx = (d.x + s.x) * H, cy = (d.y + s.y) * H, dx = Math.cos(s.a) * s.l * H / 2, dy = Math.sin(s.a) * s.l * H / 2;
    ctx.beginPath(); ctx.moveTo(cx - dx, cy - dy); ctx.lineTo(cx + dx, cy + dy); ctx.stroke();
  }
  if (p.cut && p.gash) {
    ctx.strokeStyle = '#0a0705'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(p.gash.a[0] * H, p.gash.a[1] * H); ctx.lineTo(p.gash.b[0] * H, p.gash.b[1] * H); ctx.stroke();
    ctx.strokeStyle = '#6b5a3c'; ctx.lineWidth = 1.2; ctx.stroke();
  }
  ctx.restore();
  path(ctx, d, H);
  ctx.strokeStyle = p.cut ? '#120d08' : '#8a6d28'; ctx.lineWidth = 2; ctx.stroke();
  if (p.flash > 0) { path(ctx, d, H); ctx.fillStyle = `rgba(255,250,220,${p.flash / 0.16})`; ctx.fill(); }
  ctx.restore();

  if (p.armour) {
    ctx.save();
    if (p.clang > 0) ctx.translate((Math.random() - 0.5) * 6 * (p.clang / 0.22), (Math.random() - 0.5) * 6 * (p.clang / 0.22));
    path(ctx, d, H, 0.008);
    const top = (d.y - (d.r || d.h / 2)) * H, bot = (d.y + (d.r || d.h / 2)) * H;
    const g = ctx.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, p.clang > 0 ? '#e6ebf0' : '#aab3bc'); g.addColorStop(1, p.clang > 0 ? '#b8c0c8' : '#59616a');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#2c3238'; ctx.lineWidth = 3; ctx.stroke();
    path(ctx, d, H, 0.026); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#2c3238';
    const rv = (x, y) => { ctx.beginPath(); ctx.arc(x * H, y * H, 2.2, 0, 6.28); ctx.fill(); };
    if (d.shape === 'circle') {
      ctx.fillRect((d.x - d.r * 0.8) * H, (d.y - 0.012) * H, d.r * 1.6 * H, 0.03 * H);
    } else { rv(d.x - d.w * 0.4, d.y - d.h * 0.32); rv(d.x + d.w * 0.4, d.y - d.h * 0.32); rv(d.x - d.w * 0.4, d.y + d.h * 0.32); rv(d.x + d.w * 0.4, d.y + d.h * 0.32); }
    ctx.restore();
  }
}

function drawDummy(ctx, E) {
  const L = lay(E);
  const sc = state.pop < 1 ? 0.8 + 0.2 * (1 - state.pop) : 1;
  ctx.save();
  ctx.translate(L.px, L.py); ctx.rotate(L.a); ctx.scale(sc, sc);
  const H = L.H;
  // post and base
  ctx.fillStyle = '#4a3622'; ctx.fillRect(-0.02 * H, -0.7 * H, 0.04 * H, 0.7 * H);
  ctx.fillStyle = '#3a2a1a'; ctx.fillRect(-0.12 * H, -0.02 * H, 0.24 * H, 0.04 * H);
  ctx.strokeStyle = '#4a3622'; ctx.lineWidth = 0.04 * H; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-0.36 * H, -0.61 * H); ctx.lineTo(0.36 * H, -0.61 * H); ctx.stroke();
  ctx.globalAlpha = state.pop < 1 ? 1 - state.pop * 0.7 : 1;
  for (const p of state.parts) drawPart(ctx, p, H);
  ctx.restore();
}

// ----- scenes -----
const MODES = ['Offset blade', 'Flick', 'Slow motion'];

const menu = {
  enter() { this.btnPlay = null; this.btnMute = null; },
  render(ctx, E) {
    E.text('ARENA', E.w / 2, E.h * 0.26, { size: 48, weight: '800', color: '#e6c866' });
    E.text('Cut the gaps. Armour clangs.', E.w / 2, E.h * 0.26 + 46, { size: 16, color: '#9aa4b2' });
    E.text(`Best: ${E.save.get('best', 0)} cuts`, E.w / 2, E.h * 0.26 + 82, { size: 18, color: '#fbbf24' });
    E.text(`Input: ${MODES[TUNING.cut.mode] || '?'} (TUNE to change)`, E.w / 2, E.h * 0.26 + 112, { size: 14, color: '#7c8796' });
    this.btnPlay = E.button('Play', E.w / 2, E.h * 0.58);
    this.btnMute = E.button(E.audio.muted ? 'Sound: off' : 'Sound: on', E.w / 2, E.h * 0.58 + 84, { fill: '#1f2937', w: 160, h: 44, size: 16 });
  },
  onTap(p, E) {
    if (this.btnPlay && E.hit(this.btnPlay, p)) { E.audio.play('tap'); E.setScene('play', { seed: (Math.random() * 2 ** 32) >>> 0 }); }
    else if (this.btnMute && E.hit(this.btnMute, p)) { E.audio.toggleMute(); E.audio.play('tap'); }
  },
};

const play = {
  enter(E, params) { newRound(E, params.seed); },
  update(dt, E) {
    if (state.stop > 0) { state.stop -= dt; if (state.cut) state.cut.t += dt; return; }
    const T = TUNING.cut;
    // Slow motion: the dummy slows while a finger is down, for a limited time.
    let ts = 1;
    state.slowing = false;
    if (T.mode === 2 && state.cut && state.slowUsed < T.slowTime) { ts = T.slowMo; state.slowing = true; state.slowUsed += dt; }
    const mdt = dt * ts;
    state.m += mdt;
    state.t -= dt;
    // Spring the dummy back from a kick.
    state.kickV += (-state.kickA * 90 - state.kickV * 7) * mdt;
    state.kickA += state.kickV * mdt;
    for (const p of state.parts) { p.flash = Math.max(0, p.flash - dt); p.clang = Math.max(0, p.clang - dt); }
    if (state.pop > 0) state.pop = Math.max(0, state.pop - dt * 4);
    state.whiff = Math.max(0, state.whiff - dt);

    const c = state.cut;
    if (c) {
      c.t += dt;
      if (T.mode !== 1 && !c.spent && c.t >= T.maxTime) { c.spent = true; strike(E, bladeSeg(E)); }
    }

    for (const f of state.fx) {
      f.life -= dt; f.vy += (f.g || 0) * dt; f.x += f.vx * dt || 0; f.y += f.vy * dt || 0;
      if (f.k === 's') f.rot += f.vr * dt;
      if (f.k === 'd') { f.vx *= 0.94; f.vy *= 0.94; }
    }
    state.fx = state.fx.filter((f) => f.life > 0);
    for (const s of state.streaks) s.life -= dt;
    state.streaks = state.streaks.filter((s) => s.life > 0);
    for (const q of state.pops) q.life -= dt;
    state.pops = state.pops.filter((q) => q.life > 0);

    if (state.resetT > 0) {
      state.resetT -= dt;
      if (state.resetT <= 0) { state.rack++; newRack(E); pop(E.w / 2, E.h * 0.2, 'NEW DUMMY', '#e6c866', 20); }
    }
    if (state.t <= 0) this.finish(E);
  },
  finish(E) {
    const best = E.save.get('best', 0), isNew = state.cuts > best;
    if (isNew) E.save.set('best', state.cuts);
    E.ledger.add('result', { mode: TUNING.cut.mode, cuts: state.cuts, clangs: state.clangs, combos: state.combos, bestCombo: state.bestCombo, racks: state.rack });
    E.setScene('over', { cuts: state.cuts, clangs: state.clangs, combos: state.combos, bestCombo: state.bestCombo, best: Math.max(best, state.cuts), isNew });
  },
  onPointerDown(p, E) {
    if (state.cut) return;
    state.cut = { id: p.id, sx: p.x, sy: p.y - TUNING.cut.offset, px: p.x, py: p.y, t: 0, spent: false, trail: [{ x: p.x, y: p.y, t: E.time }] };
  },
  onPointerMove(p, E) {
    const c = state.cut;
    if (!c || c.id !== p.id) return;
    c.px = p.x; c.py = p.y;
    c.trail.push({ x: p.x, y: p.y, t: E.time });
    if (c.trail.length > 40) c.trail.shift();
  },
  onPointerUp(p, E) {
    const c = state.cut;
    if (!c || c.id !== p.id) return;
    c.px = p.x; c.py = p.y; c.trail.push({ x: p.x, y: p.y, t: E.time });
    state.cut = null;
    if (p.cancelled || c.spent) return;
    if (TUNING.cut.mode === 1) strike(E, flickSeg(c));
    else { state.cut = c; const seg = bladeSeg(E); state.cut = null; strike(E, seg); }
  },
  render(ctx, E) {
    const L = lay(E);
    // sand pit
    const g = ctx.createRadialGradient(E.w / 2, L.py, 20, E.w / 2, L.py, E.w * 0.9);
    g.addColorStop(0, '#4a3a28'); g.addColorStop(1, '#14100c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, E.w, E.h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(L.px, L.py + 4, L.H * 0.3, L.H * 0.05, 0, 0, 6.28); ctx.fill();

    drawDummy(ctx, E);

    // fx
    for (const f of state.fx) {
      const t = clamp(f.life / f.max, 0, 1);
      if (f.k === 's') {
        ctx.globalAlpha = Math.min(1, t * 2); ctx.strokeStyle = f.c; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + Math.cos(f.rot) * f.len, f.y + Math.sin(f.rot) * f.len); ctx.stroke();
      } else if (f.k === 'k') {
        ctx.globalAlpha = t; ctx.strokeStyle = f.c; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x - f.vx * 0.04, f.y - f.vy * 0.04); ctx.stroke();
      } else if (f.k === 'd') {
        ctx.globalAlpha = t * 0.45; ctx.fillStyle = f.c; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1.4 - t * 0.4), 0, 6.28); ctx.fill();
      } else if (f.k === 'r') {
        ctx.globalAlpha = t; ctx.strokeStyle = f.c; ctx.lineWidth = 3 * t + 1;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r0 + (f.r - f.r0) * (1 - t), 0, 6.28); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // slash streaks after a strike
    for (const s of state.streaks) {
      const t = s.life / s.max;
      ctx.lineCap = 'round';
      ctx.globalAlpha = t * 0.5; ctx.strokeStyle = '#9ff'; ctx.lineWidth = 14 * t;
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
      ctx.globalAlpha = t; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4 * t + 1;
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // the line being drawn
    const c = state.cut;
    if (c) {
      const T = TUNING.cut;
      const seg = bladeSeg(E);
      ctx.lineCap = 'round';
      if (T.mode !== 1) {
        // finger tether, so the blade reads as "above my thumb"
        ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(c.px, c.py); ctx.lineTo(c.px, c.py - T.offset); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(c.px, c.py, 14, 0, 6.28); ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.stroke();
        if (seg) {
          ctx.globalAlpha = 0.35; ctx.strokeStyle = '#7de3ff'; ctx.lineWidth = 12;
          ctx.beginPath(); ctx.moveTo(seg.x1, seg.y1); ctx.lineTo(seg.x2, seg.y2); ctx.stroke();
          ctx.globalAlpha = 1; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.5;
          ctx.beginPath(); ctx.moveTo(seg.x1, seg.y1); ctx.lineTo(seg.x2, seg.y2); ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(seg.x2, seg.y2, 5, 0, 6.28); ctx.fill();
          // time left to draw
          const k = clamp(1 - c.t / T.maxTime, 0, 1);
          ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(seg.x2, seg.y2, 13, -Math.PI / 2, -Math.PI / 2 + k * 6.283); ctx.stroke();
        }
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3;
        ctx.beginPath(); c.trail.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
        if (seg) {
          ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(125,227,255,0.7)'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(seg.x1, seg.y1); ctx.lineTo(seg.x2, seg.y2); ctx.stroke(); ctx.setLineDash([]);
        }
      }
    }
    if (state.slowing) { ctx.fillStyle = 'rgba(80,140,255,0.10)'; ctx.fillRect(0, 0, E.w, E.h); }

    for (const q of state.pops) {
      const t = q.life / q.max;
      E.text(q.s, q.x, q.y - (1 - t) * 34, { size: q.size * (1 + (1 - t) * 0.2), color: q.color, weight: '800', alpha: Math.min(1, t * 2) });
    }

    // HUD
    const top = 20 + E.safe.top;
    const secs = Math.max(0, Math.ceil(state.t));
    E.text(`0:${String(secs).padStart(2, '0')}`, 20 + E.safe.left, top + 12, { size: 26, align: 'left', weight: '800', color: secs <= 5 ? '#ef4444' : '#e6e6e6' });
    E.text(`${state.cuts}`, E.w / 2, top + 14, { size: 40, weight: '800', color: '#ffd24a' });
    E.text('gaps cut', E.w / 2, top + 42, { size: 12, color: '#9aa4b2' });
    E.text(`x${state.combos}  combos`, E.w - 20 - E.safe.right, top + 8, { size: 14, align: 'right', color: '#fbbf24' });
    E.text(`${state.clangs} clangs`, E.w - 20 - E.safe.right, top + 28, { size: 14, align: 'right', color: '#9aa4b2' });
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(0, top + 56, E.w, 3);
    ctx.fillStyle = '#e6c866'; ctx.fillRect(0, top + 56, E.w * clamp(state.t / TUNING.roundTime, 0, 1), 3);
    E.text(MODES[TUNING.cut.mode], E.w / 2, E.h - 18 - E.safe.bottom, { size: 12, color: '#5d6672' });
  },
  onPause() {},
};

const over = {
  enter(E, params) {
    this.p = params; this.k = 0;
    E.audio.play(params.isNew ? 'win' : 'lose');
    E.tween(0.5, (t) => { this.k = t; });
  },
  render(ctx, E) {
    const p = this.p, y = E.h * 0.2;
    E.text('Round over', E.w / 2, y, { size: 34, weight: '800' });
    E.text(`${Math.round(p.cuts * this.k)}`, E.w / 2, y + 74, { size: 72, weight: '800', color: '#ffd24a' });
    E.text('gaps cut', E.w / 2, y + 120, { size: 16, color: '#9aa4b2' });
    E.text(p.isNew ? 'New best!' : `Best ${p.best}`, E.w / 2, y + 150, { size: 18, color: '#fbbf24' });
    E.text(`${p.clangs} clangs   |   ${p.combos} combos   |   best combo x${p.bestCombo}`, E.w / 2, y + 190, { size: 15, color: '#cbd5e1' });
    this.btnAgain = E.button('Again', E.w / 2, E.h * 0.6);
    this.btnMenu = E.button('Menu', E.w / 2, E.h * 0.6 + 76, { fill: '#334155' });
  },
  onTap(p, E) {
    if (this.btnAgain && E.hit(this.btnAgain, p)) E.setScene('play', { seed: (Math.random() * 2 ** 32) >>> 0 });
    else if (this.btnMenu && E.hit(this.btnMenu, p)) E.setScene('menu');
  },
};

export const game = {
  slug: 'arena',
  title: 'Arena',
  saveVersion: 1,
  migrate(data, fromVersion) { return data; },
  TUNING,
  experiments: [
    { key: 'cut.mode', label: 'Input (0 offset, 1 flick, 2 slow-mo)', min: 0, max: 2, step: 1 },
    { key: 'cut.offset', label: 'Blade offset (px)', min: 0, max: 130, step: 5 },
    { key: 'cut.maxLen', label: 'Reach (px)', min: 120, max: 450, step: 10 },
    { key: 'cut.slowMo', label: 'Slow-mo speed', min: 0.1, max: 0.7, step: 0.05 },
    { key: 'juice.hitStop', label: 'Hit-stop (s)', min: 0, max: 0.2, step: 0.01 },
    { key: 'dummy.swayDeg', label: 'Dummy sway (deg)', min: 0, max: 40, step: 1 },
  ],
  presets: [
    { label: 'Offset blade', values: { 'cut.mode': 0 } },
    { label: 'Flick', values: { 'cut.mode': 1 } },
    { label: 'Slow motion', values: { 'cut.mode': 2 } },
  ],
  start: 'menu',
  scenes: { menu, play, over },
};
