// Arena (proto 2): your gladiator's sword hand. The blade follows the finger with an offset and a little weight.
// A fast swing through a gap hits hard, armour bounces and dents, the dummy swings back: swipe up to parry, down to dodge.
// All particles are the game's own so a hit-stop freezes the burst, then lets it fly.

import { makeRng, clamp } from './engine.js';

const TUNING = {
  roundTime: 45,           // seconds per round
  hearts: 3,
  resetDelay: 0.9,         // seconds after a dummy falls before a fresh one
  swayRate: 1.3,           // radians per second of the dummy's sway
  swayBobRate: 2.4,
  offset: 70,              // blade tip above the finger, px
  hand: {
    lag: 0.035,            // seconds of weight in the hand
    regrip: 0.12,          // lag while the hand recovers from a bounce
    shoulderDrop: 140,     // shoulder sits this far below the screen bottom, px
  },
  blade: { len: 120, pad: 5 },
  hit: {
    minSpeed: 450,         // tip px/s below which the blade does nothing
    mid: 950,              // speed for damage 2
    fast: 1800,            // speed for damage 3
    cool: 0.2,             // seconds before the same part can be hit again
  },
  part: { hp: 3 },         // damage a gap part takes before it is disabled
  armour: { recoil: 0.35, dents: 3, kick: 0.45 },
  stun: 1.2,               // seconds the dummy is stunned when the head goes
  armSlow: 0.4,            // each disabled arm lengthens the wind-up by this fraction
  swing: {
    windup: 0.7,           // seconds from the first tell to the blow
    gap: 2.0,              // seconds between swings: gap to gap + gapSpread
    gapSpread: 1.5,
  },
  parry: { window: 0.3, perfectFrac: 1 / 3, stagger: 1.0, riposteMul: 2 },
  swipe: { minDist: 70, minSpeed: 650, span: 0.18 },
  juice: { stop1: 0.04, stop2: 0.07, stop3: 0.1, stopBreak: 0.05, stopClang: 0.03, strawPerDmg: 14 },
  dummy: {
    height: 0.8,           // body unit as a fraction of screen width
    pivotY: 0.6,           // pivot (feet) as a fraction of screen height
    swayDeg: 18,
    bob: 6,                // px
    kick: 0.9,
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
};

// The three tells: where the blow lands (body units) and how the club is cocked.
const ZONES = [
  { id: 'high', y: -0.77, cock: -1.45, label: 'HIGH' },
  { id: 'mid',  y: -0.55, cock: -0.5,  label: 'MID' },
  { id: 'low',  y: -0.22, cock: 0.35,  label: 'LOW' },
];

const STRAW = ['#e6c866', '#d4b04a', '#f2dc90', '#b8923a'];
const state = {};
const now = () => performance.now() / 1000;

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
    return { d, armour: armoured.has(i), cut: false, hp: TUNING.part.hp, dents: 0, cracks: [], gashes: [], flash: 0, clang: 0, cool: 0, straws };
  });
  state.pop = 1; state.fallT = 0; state.sw = null; state.stun = 0; state.stagger = 0;
  state.swingIn = nextGap();
}

function nextGap() { const S = TUNING.swing; return S.gap + state.rng.range(0, S.gapSpread); }

function newRound(E, seed) {
  Object.assign(state, {
    seed, rng: makeRng(seed ^ 0x9e3779b9), rack: 0, t: TUNING.roundTime, m: 0, stop: 0, kickA: 0, kickV: 0,
    hearts: TUNING.hearts, endT: 0, guard: 0, dodgeT: 0, hurt: 0,
    gapHits: 0, clangs: 0, broken: 0, parries: 0, perfects: 0, dodges: 0, taken: 0, felled: 0,
    fx: [], pops: [], streaks: [], trail: [],
    hand: { down: false, id: -1, fx: 0, fy: 0, tx: E.w / 2, ty: E.h * 0.85, ptx: E.w / 2, pty: E.h * 0.85, hx: E.w / 2, hy: E.h, phx: E.w / 2, phy: E.h, vx: 0, vy: 0, lock: 0, grip: 0, sp: 0, hist: [] },
  });
  newRack(E);
  state.swingIn += 0.6;
}

// Where the dummy is on screen right now.
function lay(E) {
  const D = TUNING.dummy;
  const H = Math.min(E.w * D.height, E.h * 0.5);
  const a = (D.swayDeg * Math.PI / 180) * Math.sin(state.m * TUNING.swayRate) + state.kickA;
  const bob = Math.sin(state.m * TUNING.swayBobRate) * D.bob;
  return { H, a, px: E.w / 2, py: E.h * D.pivotY + bob };
}
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

function plateBits(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, s = 200 + Math.random() * 360;
    state.fx.push({ k: 'p', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 900, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 20, w: 10 + Math.random() * 12, h: 6 + Math.random() * 8, life: 0.9 + Math.random() * 0.4, max: 1.3 });
  }
}

function parrySound(E) {
  const A = E.audio;
  A.beep({ freq: 880, dur: 0.16, type: 'square', slide: 0.7, gain: 0.1 });
  A.beep({ freq: 1320, dur: 0.1, type: 'sine', gain: 0.1 });
  A.beep({ freq: 220, dur: 0.18, type: 'triangle', slide: 0.6, gain: 0.25 });
  A.noise({ dur: 0.05, gain: 0.18 });
}
function swooshSound(E, gain = 0.12) { E.audio.noise({ dur: 0.16, gain }); E.audio.beep({ freq: 700, dur: 0.14, type: 'sine', slide: 0.3, gain: gain * 0.4 }); }

// ----- the sword hand -----
function shoulder(E) { return [E.w / 2, E.h + TUNING.hand.shoulderDrop]; }

function moveHand(E, dt) {
  const h = state.hand, H = TUNING.hand;
  h.ptx = h.tx; h.pty = h.ty; h.phx = h.hx; h.phy = h.hy;
  if (h.lock > 0) {
    h.lock -= dt;
    h.tx += h.vx * dt; h.ty += h.vy * dt;
    const damp = Math.exp(-9 * dt); h.vx *= damp; h.vy *= damp;
    h.tx = clamp(h.tx, 10, E.w - 10); h.ty = clamp(h.ty, E.safe.top + 40, E.h - 10);
    if (h.lock <= 0) h.grip = 0.3;
  } else if (h.down) {
    const lag = h.grip > 0 ? H.regrip : H.lag;
    const k = 1 - Math.exp(-dt / lag);
    h.tx += (h.fx - h.tx) * k; h.ty += (h.fy - TUNING.offset - h.ty) * k;
    if (h.grip > 0) h.grip -= dt;
  }
  const [sx, sy] = shoulder(E);
  let dx = h.tx - sx, dy = h.ty - sy; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
  h.dx = dx; h.dy = dy;
  h.hx = h.tx - dx * TUNING.blade.len; h.hy = h.ty - dy * TUNING.blade.len;
  const inst = Math.hypot(h.tx - h.ptx, h.ty - h.pty) / Math.max(dt, 0.001);
  h.sp = h.down && h.lock <= 0 ? h.sp * 0.5 + inst * 0.5 : 0;
  state.trail.push({ x: h.tx, y: h.ty, life: 0.12 });
  for (const q of state.trail) q.life -= dt;
  state.trail = state.trail.filter((q) => q.life > 0);
}

function checkHits(E) {
  const h = state.hand, T = TUNING;
  if (!h.down || h.lock > 0 || h.grip > 0.18 || state.guard > 0 || state.fallT > 0 || state.endT > 0) return;
  if (h.sp < T.hit.minSpeed) return;
  const L = lay(E), pad = T.blade.pad / L.H;
  const found = new Map();
  for (const f of [1, 0.7, 0.4]) {
    const x0 = h.phx + (h.ptx - h.phx) * f, y0 = h.phy + (h.pty - h.phy) * f;
    const x1 = h.hx + (h.tx - h.hx) * f, y1 = h.hy + (h.ty - h.hy) * f;
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8));
    for (let i = 0; i <= n; i++) {
      const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
      const [lx, ly] = toLocal(L, x, y);
      for (const p of state.parts) {
        if (p.cool > 0 || p.cut || found.has(p)) continue;
        if (inside(p.d, lx, ly, pad)) found.set(p, { x, y, lx, ly });
      }
    }
  }
  if (!found.size) return;
  const ang = Math.atan2(h.ty - h.pty, h.tx - h.ptx), sp = h.sp;
  let stop = 0, i = 0;
  for (const [p, at] of found) {
    if (p.armour) { stop = Math.max(stop, bounce(E, p, at, ang, sp)); break; }
    stop = Math.max(stop, gapHit(E, p, at, ang, sp, i++ * 0.04));
  }
  state.stop = Math.max(state.stop, stop);
}

function bounce(E, p, at, ang, sp) {
  const h = state.hand, A = TUNING.armour, J = TUNING.juice;
  state.clangs++; p.clang = 0.25; p.cool = 0.3; p.dents++;
  // recoil: the hand is thrown back along the swing and locked
  const rv = clamp(sp * A.kick, 250, 900);
  h.vx = -Math.cos(ang) * rv; h.vy = -Math.sin(ang) * rv; h.lock = A.recoil; h.grip = 0;
  const d = p.d, sz = d.shape === 'circle' ? d.r : Math.min(d.w, d.h) / 2;
  const a0 = Math.random() * 6.28, pts = [[Math.cos(a0) * 0.1 * sz, Math.sin(a0) * 0.1 * sz]];
  for (let k = 1; k <= 4; k++) { const a = a0 + (Math.random() - 0.5) * 0.9; pts.push([pts[0][0] + Math.cos(a) * sz * 0.5 * k * (0.8 + Math.random() * 0.4), pts[0][1] + Math.sin(a) * sz * 0.5 * k * (0.8 + Math.random() * 0.4)]); }
  p.cracks.push(pts);
  sparks(at.x, at.y, ang + Math.PI, 18); ring(at.x, at.y, 36, '#cbd5e1');
  clangSound(E, 0); E.shake(4, 0.12); E.haptic(18);
  if (p.dents >= A.dents) {
    p.armour = false; state.broken++;
    const [sx, sy] = toScreen(lay(E), p.d.x, p.d.y);
    plateBits(sx, sy, 9); ring(sx, sy, 70, '#ffe9a8'); pop(sx, sy - 24, 'PLATE BROKEN', '#ffe9a8', 17);
    E.audio.beep({ freq: 110, dur: 0.25, type: 'sine', slide: 0.4, gain: 0.3 }); E.shake(8, 0.2); E.haptic(30);
    return J.stopBreak + 0.04;
  }
  pop(at.x, at.y - 18, p.dents === 2 ? 'DENT!' : 'CLANG', '#9aa4b2', 15);
  return J.stopClang;
}

function gapHit(E, p, at, ang, sp, delay) {
  const T = TUNING, J = T.juice;
  let dmg = sp >= T.hit.fast ? 3 : sp >= T.hit.mid ? 2 : 1;
  const rip = state.stagger > 0;
  if (rip) dmg *= T.parry.riposteMul;
  p.hp -= dmg; p.cool = T.hit.cool; p.flash = 0.16; state.gapHits++;
  p.gashes.push([[at.lx - Math.cos(ang) * 0.06, at.ly - Math.sin(ang) * 0.06], [at.lx + Math.cos(ang) * 0.06, at.ly + Math.sin(ang) * 0.06]]);
  const big = dmg >= 3;
  const n = Math.min(60, J.strawPerDmg * dmg);
  straw(at.x, at.y, ang + Math.PI / 2, 2.6, 260 + dmg * 50, n >> 1);
  straw(at.x, at.y, ang - Math.PI / 2, 2.6, 260 + dmg * 50, n >> 1);
  dust(at.x, at.y, 3 + dmg * 3);
  sliceSound(E, delay, big);
  pop(at.x, at.y - 20, rip ? `RIPOSTE x${dmg}` : dmg >= 3 ? 'SMASH!' : dmg === 2 ? 'HARD' : 'HIT', rip ? '#ffd24a' : dmg >= 3 ? '#ffb347' : '#fff0b8', 15 + dmg * 5);
  state.kickV += T.dummy.kick * (Math.cos(ang) > 0 ? 1 : -1) * (0.6 + dmg * 0.4);
  E.shake(2 + dmg * 2.5, 0.1); E.haptic(10 + dmg * 8);
  if (big) E.flash('#fff0b8', 0.07);
  let stop = dmg >= 3 ? J.stop3 : dmg === 2 ? J.stop2 : J.stop1;
  if (p.hp <= 0) { disable(E, p, at, ang); stop += 0.04; }
  return stop;
}

function disable(E, p, at, ang) {
  p.cut = true;
  straw(at.x, at.y, ang + Math.PI / 2, 3, 360, 22); straw(at.x, at.y, ang - Math.PI / 2, 3, 360, 22);
  pop(at.x, at.y - 44, 'DOWN', '#ff9f43', 20);
  E.audio.beep({ freq: 90, dur: 0.22, type: 'sine', slide: 0.4, gain: 0.3 });
  const id = p.d.id;
  if (id === 'head') {
    state.stun = TUNING.stun; state.sw = null; state.swingIn = nextGap();
    pop(at.x, at.y - 70, 'STUNNED', '#a5b4fc', 20);
  }
  const P = (k) => state.parts.find((q) => q.d.id === k);
  if (P('chest').cut && P('belly').cut && !state.fallT) {
    state.felled++; state.fallT = 0.01; state.sw = null;
    pop(E.w / 2, E.h * 0.22, 'DUMMY DOWN', '#ffd24a', 28); E.shake(10, 0.3); E.flash('#fff0b8', 0.1); E.audio.play('coin');
  }
}

// ----- the dummy swings back -----
function startSwing() {
  const S = TUNING.swing;
  const arms = state.parts.filter((p) => (p.d.id === 'armL' || p.d.id === 'armR') && p.cut).length;
  const wind = S.windup * (1 + TUNING.armSlow * arms);
  state.sw = { zone: ZONES[state.rng.int(0, ZONES.length - 1)], t: 0, wind, def: null, perfect: false, fin: 0, outcome: null };
}

function swipeCheck(E) {
  const h = state.hand, sw = state.sw, S = TUNING.swipe, P = TUNING.parry;
  if (!sw || sw.def || sw.fin > 0 || !h.down || h.hist.length < 2) return;
  const last = h.hist[h.hist.length - 1];
  let first = h.hist[0];
  for (const q of h.hist) if (last.t - q.t <= S.span) { first = q; break; }
  const dx = last.x - first.x, dy = last.y - first.y, d = Math.hypot(dx, dy), dt = Math.max(0.03, last.t - first.t);
  if (d < S.minDist || d / dt < S.minSpeed || Math.abs(dy) < Math.abs(dx) * 1.3) return;
  h.hist.length = 0;
  const L = lay(E), zy = toScreen(L, 0, sw.zone.y)[1];
  if (dy > 0) {
    sw.def = 'dodge'; state.dodges++; state.dodgeT = 0.5; state.guard = 0.3;
    pop(E.w / 2, E.h * 0.7, 'DODGE', '#7de3ff', 26); swooshSound(E, 0.16); E.haptic(12);
    for (let i = 0; i < 8; i++) state.fx.push({ k: 'd', x: E.w / 2 + (Math.random() - 0.5) * 160, y: E.h * 0.8, vx: (Math.random() - 0.5) * 60, vy: -20, g: 0, life: 0.4, max: 0.4, r: 8, c: '#8a7452' });
    return;
  }
  const toWindow = sw.wind - sw.t;
  if (toWindow > P.window) { pop(E.w / 2, E.h * 0.7, 'too early', '#94a3b8', 14); return; }
  sw.def = 'parry'; sw.outcome = 'parry'; sw.fin = 0.4; state.guard = 0.3; state.parries++;
  sw.perfect = sw.t - (sw.wind - P.window) < P.window * P.perfectFrac;
  const cx = E.w / 2, cy = zy;
  sparks(cx, cy, 0, 22); sparks(cx, cy, Math.PI, 22); ring(cx, cy, sw.perfect ? 130 : 80, sw.perfect ? '#ffd24a' : '#ffffff');
  parrySound(E); E.shake(sw.perfect ? 10 : 6, 0.2); E.haptic(sw.perfect ? 35 : 20);
  state.stop = Math.max(state.stop, sw.perfect ? 0.12 : 0.07);
  if (sw.perfect) {
    state.perfects++; state.stagger = P.stagger; E.flash('#fff0b8', 0.1); E.audio.play('coin');
    pop(cx, cy - 40, 'PERFECT PARRY', '#ffd24a', 28);
  } else pop(cx, cy - 40, 'PARRY', '#ffffff', 24);
  state.kickV += -0.8;
}

function resolveSwing(E) {
  const sw = state.sw, L = lay(E), zy = toScreen(L, 0, sw.zone.y)[1];
  sw.fin = 0.4;
  state.streaks.push({ x1: E.w * 0.95, y1: zy - 30, x2: E.w * 0.05, y2: zy + 20, life: 0.22, max: 0.22, red: sw.def !== 'dodge' });
  if (sw.def === 'dodge') { sw.outcome = 'whiff'; swooshSound(E, 0.2); pop(E.w / 2, zy - 30, 'WHIFF', '#7de3ff', 18); return; }
  sw.outcome = 'hit'; state.hearts--; state.taken++; state.hurt = 0.4;
  E.flash('#ff2a2a', 0.3); E.shake(16, 0.35); E.haptic(70);
  E.audio.play('boom'); E.audio.play('lose', 0.5);
  pop(E.w / 2, zy - 30, 'OUCH', '#ff5a4a', 34);
  state.hand.lock = Math.max(state.hand.lock, 0.2); state.hand.vx = 0; state.hand.vy = 120;
  if (state.hearts <= 0) state.endT = 1.0;
}

function updateSwing(dt, E) {
  if (state.fallT > 0) return;
  if (state.stun > 0) { state.stun -= dt; return; }
  const sw = state.sw;
  if (sw) {
    if (sw.fin > 0) { sw.fin -= dt; if (sw.fin <= 0) { state.sw = null; state.swingIn = nextGap(); } return; }
    sw.t += dt;
    if (sw.t >= sw.wind) resolveSwing(E);
    return;
  }
  if (state.stagger > 0) return;
  state.swingIn -= dt;
  if (state.swingIn <= 0 && state.endT <= 0) startSwing();
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
  if (!p.cut && p.hp < TUNING.part.hp) { ctx.fillStyle = `rgba(40,20,5,${(1 - p.hp / TUNING.part.hp) * 0.5})`; ctx.fillRect((d.x - 0.3) * H, (d.y - 0.3) * H, 0.6 * H, 0.6 * H); }
  for (const g of p.gashes) {
    ctx.strokeStyle = '#0a0705'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(g[0][0] * H, g[0][1] * H); ctx.lineTo(g[1][0] * H, g[1][1] * H); ctx.stroke();
    ctx.strokeStyle = '#6b5a3c'; ctx.lineWidth = 1.1; ctx.stroke();
  }
  ctx.restore();
  path(ctx, d, H);
  ctx.strokeStyle = p.cut ? '#120d08' : '#8a6d28'; ctx.lineWidth = 2; ctx.stroke();
  if (p.flash > 0) { path(ctx, d, H); ctx.fillStyle = `rgba(255,250,220,${p.flash / 0.16})`; ctx.fill(); }
  ctx.restore();

  if (p.armour) {
    ctx.save();
    const sh = p.clang > 0 ? p.clang / 0.25 : 0;
    if (sh > 0) ctx.translate((Math.random() - 0.5) * 7 * sh, (Math.random() - 0.5) * 7 * sh);
    const dn = p.dents / TUNING.armour.dents;
    path(ctx, d, H, 0.008 + 0.004 * p.dents);
    const top = (d.y - (d.r || d.h / 2)) * H, bot = (d.y + (d.r || d.h / 2)) * H;
    const g = ctx.createLinearGradient(0, top, 0, bot);
    const dk = (c) => `rgb(${Math.round(c[0] * (1 - dn * 0.35))},${Math.round(c[1] * (1 - dn * 0.35))},${Math.round(c[2] * (1 - dn * 0.3))})`;
    g.addColorStop(0, sh > 0 ? '#e6ebf0' : dk([170, 179, 188])); g.addColorStop(1, sh > 0 ? '#b8c0c8' : dk([89, 97, 106]));
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#2c3238'; ctx.lineWidth = 3; ctx.stroke();
    path(ctx, d, H, 0.026); ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.save(); path(ctx, d, H); ctx.clip();
    for (const c of p.cracks) {
      ctx.fillStyle = 'rgba(20,24,30,0.3)'; ctx.beginPath(); ctx.arc(d.x * H + c[0][0] * H, d.y * H + c[0][1] * H, 0.035 * H, 0, 6.28); ctx.fill();
      ctx.strokeStyle = '#14181e'; ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
      ctx.beginPath(); c.forEach((q, i) => (i ? ctx.lineTo((d.x + q[0]) * H, (d.y + q[1]) * H) : ctx.moveTo((d.x + q[0]) * H, (d.y + q[1]) * H))); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.8; ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#2c3238';
    const rv = (x, y) => { ctx.beginPath(); ctx.arc(x * H, y * H, 2.2, 0, 6.28); ctx.fill(); };
    if (d.shape === 'circle') ctx.fillRect((d.x - d.r * 0.8) * H, (d.y - 0.012) * H, d.r * 1.6 * H, 0.03 * H);
    else { rv(d.x - d.w * 0.4, d.y - d.h * 0.32); rv(d.x + d.w * 0.4, d.y - d.h * 0.32); rv(d.x - d.w * 0.4, d.y + d.h * 0.32); rv(d.x + d.w * 0.4, d.y + d.h * 0.32); }
    ctx.restore();
  }
}

const easeOut = (u) => 1 - (1 - u) * (1 - u);

function clubAngle(sw) {
  const rest = Math.PI / 2, cock = sw.zone.cock;
  if (sw.fin > 0) {
    const v = clamp((0.4 - sw.fin) / 0.15, 0, 1);
    if (sw.outcome === 'parry') return cock - 1.1 * easeOut(v);
    return cock + (2.7 - cock) * v * v;
  }
  const u = clamp(sw.t / (sw.wind * 0.55), 0, 1);
  return rest + (cock - rest) * easeOut(u) + (u >= 1 ? Math.sin(sw.t * 55) * 0.035 : 0);
}

function drawDummy(ctx, E) {
  const L = lay(E);
  const sc = state.pop < 1 ? 0.8 + 0.2 * (1 - state.pop) : 1;
  const fall = state.fallT > 0 ? Math.pow(clamp(state.fallT / 0.5, 0, 1), 2) : 0;
  const H = L.H;
  ctx.save();
  ctx.translate(L.px, L.py); ctx.rotate(L.a + fall * 1.35); ctx.scale(sc, sc);
  if (state.stagger > 0) {
    const g = ctx.createRadialGradient(0, -0.5 * H, 10, 0, -0.5 * H, 0.6 * H);
    g.addColorStop(0, 'rgba(255,210,74,0.45)'); g.addColorStop(1, 'rgba(255,210,74,0)');
    ctx.fillStyle = g; ctx.fillRect(-0.7 * H, -1.1 * H, 1.4 * H, 1.3 * H);
  }
  ctx.fillStyle = '#4a3622'; ctx.fillRect(-0.02 * H, -0.7 * H, 0.04 * H, 0.7 * H);
  ctx.fillStyle = '#3a2a1a'; ctx.fillRect(-0.12 * H, -0.02 * H, 0.24 * H, 0.04 * H);
  ctx.strokeStyle = '#4a3622'; ctx.lineWidth = 0.04 * H; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-0.36 * H, -0.61 * H); ctx.lineTo(0.36 * H, -0.61 * H); ctx.stroke();
  ctx.globalAlpha = state.pop < 1 ? 1 - state.pop * 0.7 : 1;
  if (fall > 0) ctx.globalAlpha = 1 - fall * 0.5;
  for (const p of state.parts) drawPart(ctx, p, H);
  ctx.globalAlpha = 1;
  // the club arm
  const sw = state.sw;
  if (sw) {
    const th = clubAngle(sw), px = 0.36 * H, py = -0.6 * H, len = 0.46 * H;
    const ex = px + Math.cos(th) * len, ey = py + Math.sin(th) * len;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = 0.075 * H; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = '#7a5532'; ctx.lineWidth = 0.05 * H; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = '#5b3d22'; ctx.beginPath(); ctx.arc(ex, ey, 0.058 * H, 0, 6.28); ctx.fill();
    ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.restore();
  if (state.stun > 0) {
    const [hx, hy] = toScreen(L, 0, -0.9);
    for (let i = 0; i < 3; i++) {
      const a = state.m * 7 + i * 2.09;
      E.text('*', hx + Math.cos(a) * 0.14 * H, hy + Math.sin(a) * 0.04 * H, { size: 26, color: '#fde68a', weight: '800' });
    }
  }
}

function drawZone(ctx, E) {
  const sw = state.sw;
  if (!sw || sw.fin > 0) return;
  const L = lay(E), P = TUNING.parry;
  const y = toScreen(L, 0, sw.zone.y)[1], bh = 0.15 * L.H;
  const left = sw.wind - sw.t, inWin = left <= P.window, perfect = inWin && sw.t - (sw.wind - P.window) < P.window * P.perfectFrac;
  const pulse = 0.5 + 0.5 * Math.sin(sw.t * (10 + 14 * sw.t / sw.wind));
  const rgb = perfect ? '255,236,120' : inWin ? '255,150,60' : '255,70,50';
  const a = (0.12 + 0.3 * (sw.t / sw.wind)) * (0.7 + 0.5 * pulse);
  const g = ctx.createLinearGradient(0, y - bh, 0, y + bh);
  g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.5, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.fillRect(0, y - bh, E.w, bh * 2);
  ctx.strokeStyle = `rgba(${rgb},${0.5 + 0.4 * pulse})`; ctx.lineWidth = 3; ctx.setLineDash([14, 10]);
  ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(E.w - 10, y); ctx.stroke(); ctx.setLineDash([]);
  E.text(inWin ? (perfect ? 'PARRY NOW' : 'PARRY') : sw.zone.label, E.w / 2, y - bh - 10, { size: 18, weight: '800', color: `rgb(${rgb})` });
  if (sw.zone.id !== 'low') E.text('^', E.w - 26, y + 6, { size: 24, color: `rgba(${rgb},0.8)`, weight: '800' });
}

function drawHand(ctx, E) {
  const h = state.hand;
  if (!h.down && h.lock <= 0) return;
  const [sx, sy] = shoulder(E), locked = h.lock > 0;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // motion trail
  if (state.trail.length > 1 && h.sp >= TUNING.hit.minSpeed) {
    ctx.strokeStyle = 'rgba(125,227,255,0.35)'; ctx.lineWidth = 8; ctx.beginPath();
    state.trail.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
  }
  // arm
  ctx.strokeStyle = '#3b2a1c'; ctx.lineWidth = 24; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(h.hx, h.hy); ctx.stroke();
  ctx.strokeStyle = '#a97a50'; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(h.hx, h.hy); ctx.stroke();
  // blade
  const hot = h.sp >= TUNING.hit.minSpeed && !locked;
  if (hot) { ctx.strokeStyle = h.sp >= TUNING.hit.fast ? 'rgba(255,200,90,0.5)' : 'rgba(125,227,255,0.45)'; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(h.hx, h.hy); ctx.lineTo(h.tx, h.ty); ctx.stroke(); }
  ctx.strokeStyle = '#1b2026'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(h.hx, h.hy); ctx.lineTo(h.tx, h.ty); ctx.stroke();
  ctx.strokeStyle = locked ? '#ff8a7a' : '#e8eef4'; ctx.lineWidth = 4; ctx.stroke();
  // guard and hand
  const nx = -h.dy, ny = h.dx, gx = h.hx + h.dx * 8, gy = h.hy + h.dy * 8;
  ctx.strokeStyle = '#c9a43a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(gx - nx * 16, gy - ny * 16); ctx.lineTo(gx + nx * 16, gy + ny * 16); ctx.stroke();
  ctx.fillStyle = '#c58f5e'; ctx.beginPath(); ctx.arc(h.hx, h.hy, 12, 0, 6.28); ctx.fill();
  ctx.strokeStyle = '#3b2a1c'; ctx.lineWidth = 2; ctx.stroke();
  // finger tether
  if (h.down) {
    ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(h.fx, h.fy); ctx.lineTo(h.fx, h.fy - TUNING.offset); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(h.fx, h.fy, 14, 0, 6.28); ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.stroke();
  }
  if (locked) E.text('X', h.tx, h.ty - 22, { size: 22, color: '#ff8a7a', weight: '800' });
}

// ----- scenes -----
const menu = {
  enter() { this.btnPlay = null; this.btnMute = null; },
  render(ctx, E) {
    E.text('ARENA', E.w / 2, E.h * 0.24, { size: 48, weight: '800', color: '#e6c866' });
    E.text('Swing through the gaps. Armour bounces.', E.w / 2, E.h * 0.24 + 46, { size: 15, color: '#9aa4b2' });
    E.text('Swipe up to parry, down to dodge.', E.w / 2, E.h * 0.24 + 70, { size: 15, color: '#9aa4b2' });
    E.text(`Best: ${E.save.get('best2', 0)} gap hits`, E.w / 2, E.h * 0.24 + 106, { size: 18, color: '#fbbf24' });
    this.btnPlay = E.button('Play', E.w / 2, E.h * 0.58);
    this.btnMute = E.button(E.audio.muted ? 'Sound: off' : 'Sound: on', E.w / 2, E.h * 0.58 + 84, { fill: '#1f2937', w: 160, h: 44, size: 16 });
  },
  onTap(p, E) {
    if (this.btnPlay && E.hit(this.btnPlay, p)) { E.audio.play('tap'); E.setScene('play', { seed: (Math.random() * 2 ** 32) >>> 0 }); }
    else if (this.btnMute && E.hit(this.btnMute, p)) { E.audio.toggleMute(); E.audio.play('tap'); }
  },
};

function geom(E) {
  const h = state.hand, [sx, sy] = shoulder(E);
  let dx = h.tx - sx, dy = h.ty - sy; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
  h.dx = dx; h.dy = dy; h.hx = h.tx - dx * TUNING.blade.len; h.hy = h.ty - dy * TUNING.blade.len;
}

const play = {
  state, lay, toScreen,
  enter(E, params) { newRound(E, params.seed); geom(E); },
  update(dt, E) {
    if (state.stop > 0) { state.stop -= dt; return; }
    state.m += dt;
    if (state.endT <= 0) state.t -= dt;
    state.kickV += (-state.kickA * 90 - state.kickV * 7) * dt;
    state.kickA += state.kickV * dt;
    for (const p of state.parts) { p.flash = Math.max(0, p.flash - dt); p.clang = Math.max(0, p.clang - dt); p.cool = Math.max(0, p.cool - dt); }
    if (state.pop > 0) state.pop = Math.max(0, state.pop - dt * 4);
    state.guard = Math.max(0, state.guard - dt);
    state.dodgeT = Math.max(0, state.dodgeT - dt);
    state.hurt = Math.max(0, state.hurt - dt);
    if (state.stagger > 0) state.stagger -= dt;

    moveHand(E, dt);
    checkHits(E);
    updateSwing(dt, E);

    if (state.fallT > 0) {
      state.fallT += dt;
      if (state.fallT >= TUNING.resetDelay) { state.rack++; newRack(E); pop(E.w / 2, E.h * 0.2, 'NEW DUMMY', '#e6c866', 20); }
    }
    for (const f of state.fx) {
      f.life -= dt; f.vy += (f.g || 0) * dt; f.x += f.vx * dt || 0; f.y += f.vy * dt || 0;
      if (f.k === 's' || f.k === 'p') f.rot += f.vr * dt;
      if (f.k === 'd') { f.vx *= 0.94; f.vy *= 0.94; }
    }
    state.fx = state.fx.filter((f) => f.life > 0);
    for (const s of state.streaks) s.life -= dt;
    state.streaks = state.streaks.filter((s) => s.life > 0);
    for (const q of state.pops) q.life -= dt;
    state.pops = state.pops.filter((q) => q.life > 0);

    if (state.endT > 0) { state.endT -= dt; if (state.endT <= 0) this.finish(E); }
    else if (state.t <= 0) this.finish(E);
  },
  finish(E) {
    if (state.done) return; state.done = true;
    const best = E.save.get('best2', 0), isNew = state.gapHits > best;
    if (isNew) E.save.set('best2', state.gapHits);
    const r = { gapHits: state.gapHits, clangs: state.clangs, broken: state.broken, parries: state.parries, perfects: state.perfects, dodges: state.dodges, taken: state.taken, felled: state.felled };
    E.ledger.add('result', { ...r, hearts: state.hearts, left: Math.round(state.t) });
    E.setScene('over', { ...r, hearts: state.hearts, best: Math.max(best, state.gapHits), isNew });
  },
  onPointerDown(p, E) {
    const h = state.hand;
    if (h.down || state.endT > 0) return;
    h.down = true; h.id = p.id; h.fx = p.x; h.fy = p.y; h.hist = [{ x: p.x, y: p.y, t: now() }];
    if (h.lock <= 0) { h.tx = h.ptx = p.x; h.ty = h.pty = p.y - TUNING.offset; h.sp = 0; geom(E); h.phx = h.hx; h.phy = h.hy; }
  },
  onPointerMove(p, E) {
    const h = state.hand;
    if (!h.down || h.id !== p.id) return;
    h.fx = p.x; h.fy = p.y;
    const t = now();
    h.hist.push({ x: p.x, y: p.y, t });
    while (h.hist.length > 2 && t - h.hist[0].t > 0.35) h.hist.shift();
    swipeCheck(E);
  },
  onPointerUp(p) {
    const h = state.hand;
    if (!h.down || h.id !== p.id) return;
    h.down = false; h.hist = []; h.sp = 0;
  },
  render(ctx, E) {
    const L = lay(E);
    ctx.save();
    if (state.dodgeT > 0) { const s = 1 - 0.07 * Math.sin(Math.PI * (1 - state.dodgeT / 0.5)); ctx.translate(E.w / 2, E.h * 0.85); ctx.scale(s, s); ctx.translate(-E.w / 2, -E.h * 0.85); }
    const g = ctx.createRadialGradient(E.w / 2, L.py, 20, E.w / 2, L.py, E.w * 0.9);
    g.addColorStop(0, '#4a3a28'); g.addColorStop(1, '#14100c');
    ctx.fillStyle = g; ctx.fillRect(-20, -20, E.w + 40, E.h + 40);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(L.px, L.py + 4, L.H * 0.3, L.H * 0.05, 0, 0, 6.28); ctx.fill();

    drawDummy(ctx, E);
    drawZone(ctx, E);

    for (const f of state.fx) {
      const t = clamp(f.life / f.max, 0, 1);
      if (f.k === 's') {
        ctx.globalAlpha = Math.min(1, t * 2); ctx.strokeStyle = f.c; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + Math.cos(f.rot) * f.len, f.y + Math.sin(f.rot) * f.len); ctx.stroke();
      } else if (f.k === 'p') {
        ctx.globalAlpha = Math.min(1, t * 2); ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
        ctx.fillStyle = '#8b949e'; ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h); ctx.strokeStyle = '#2c3238'; ctx.lineWidth = 1.5; ctx.strokeRect(-f.w / 2, -f.h / 2, f.w, f.h); ctx.restore();
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

    for (const s of state.streaks) {
      const t = s.life / s.max;
      ctx.lineCap = 'round';
      ctx.globalAlpha = t * 0.6; ctx.strokeStyle = s.red ? '#ff4a3a' : '#9ff'; ctx.lineWidth = 22 * t;
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
      ctx.globalAlpha = t; ctx.strokeStyle = '#fff'; ctx.lineWidth = 5 * t + 1;
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    drawHand(ctx, E);
    ctx.restore();

    if (state.hurt > 0) {
      const g2 = ctx.createRadialGradient(E.w / 2, E.h / 2, E.w * 0.3, E.w / 2, E.h / 2, E.h * 0.7);
      g2.addColorStop(0, 'rgba(255,0,0,0)'); g2.addColorStop(1, `rgba(255,20,20,${state.hurt / 0.4 * 0.55})`);
      ctx.fillStyle = g2; ctx.fillRect(0, 0, E.w, E.h);
    }
    for (const q of state.pops) {
      const t = q.life / q.max;
      E.text(q.s, q.x, q.y - (1 - t) * 34, { size: q.size * (1 + (1 - t) * 0.2), color: q.color, weight: '800', alpha: Math.min(1, t * 2) });
    }

    // HUD
    const top = 20 + E.safe.top;
    const secs = Math.max(0, Math.ceil(state.t));
    E.text(`0:${String(secs).padStart(2, '0')}`, 20 + E.safe.left, top + 12, { size: 26, align: 'left', weight: '800', color: secs <= 5 ? '#ef4444' : '#e6e6e6' });
    E.text(`${state.gapHits}`, E.w / 2, top + 14, { size: 40, weight: '800', color: '#ffd24a' });
    E.text('gap hits', E.w / 2, top + 42, { size: 12, color: '#9aa4b2' });
    for (let i = 0; i < TUNING.hearts; i++) E.text('♥', E.w - 26 - E.safe.right - i * 26, top + 12, { size: 26, color: i < state.hearts ? '#ef4444' : '#3b3f46' });
    E.text(`${state.felled} felled`, E.w - 20 - E.safe.right, top + 38, { size: 13, align: 'right', color: '#9aa4b2' });
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(0, top + 56, E.w, 3);
    ctx.fillStyle = '#e6c866'; ctx.fillRect(0, top + 56, E.w * clamp(state.t / TUNING.roundTime, 0, 1), 3);
    if (state.t > TUNING.roundTime - 7) E.text('swing fast  |  swipe up parry  |  swipe down dodge', E.w / 2, E.h - 18 - E.safe.bottom, { size: 12, color: '#7c8796', alpha: clamp((state.t - (TUNING.roundTime - 7)) / 1.5 + 0.2, 0, 1) });
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
    const p = this.p, y = E.h * 0.18;
    E.text(p.hearts <= 0 ? 'Cut down' : 'Round over', E.w / 2, y, { size: 34, weight: '800', color: p.hearts <= 0 ? '#ef4444' : '#e6e6e6' });
    E.text(`${Math.round(p.gapHits * this.k)}`, E.w / 2, y + 74, { size: 72, weight: '800', color: '#ffd24a' });
    E.text('gap hits', E.w / 2, y + 120, { size: 16, color: '#9aa4b2' });
    E.text(p.isNew ? 'New best!' : `Best ${p.best}`, E.w / 2, y + 148, { size: 18, color: '#fbbf24' });
    const lines = [`${p.clangs} clangs   |   ${p.broken} plates broken`, `${p.parries} parries (${p.perfects} perfect)   |   ${p.dodges} dodges`, `${p.taken} hits taken   |   ${p.felled} dummies felled`];
    lines.forEach((s, i) => E.text(s, E.w / 2, y + 190 + i * 26, { size: 15, color: '#cbd5e1' }));
    this.btnAgain = E.button('Again', E.w / 2, E.h * 0.62);
    this.btnMenu = E.button('Menu', E.w / 2, E.h * 0.62 + 76, { fill: '#334155' });
  },
  onTap(p, E) {
    if (this.btnAgain && E.hit(this.btnAgain, p)) E.setScene('play', { seed: (Math.random() * 2 ** 32) >>> 0 });
    else if (this.btnMenu && E.hit(this.btnMenu, p)) E.setScene('menu');
  },
};

const STD = { offset: 70, 'hand.lag': 0.035, 'hit.minSpeed': 450, 'parry.window': 0.3, 'swing.windup': 0.7, 'swing.gap': 2.0 };

export const game = {
  slug: 'arena',
  title: 'Arena',
  saveVersion: 1,
  migrate(data, fromVersion) { return data; },
  TUNING,
  experiments: [
    { key: 'offset', label: 'Blade offset (px)', min: 0, max: 130, step: 5 },
    { key: 'hand.lag', label: 'Hand weight (s)', min: 0.005, max: 0.12, step: 0.005 },
    { key: 'hit.minSpeed', label: 'Min hit speed (px/s)', min: 200, max: 1200, step: 25 },
    { key: 'parry.window', label: 'Parry window (s)', min: 0.15, max: 0.6, step: 0.05 },
    { key: 'swing.windup', label: 'Wind-up (s)', min: 0.4, max: 1.2, step: 0.05 },
    { key: 'swing.gap', label: 'Swing interval (s)', min: 0.8, max: 4, step: 0.1 },
  ],
  presets: [
    { label: 'Gentle', values: { ...STD, 'swing.windup': 0.95, 'parry.window': 0.5, 'swing.gap': 3.2, 'hit.minSpeed': 400 } },
    { label: 'Standard', values: { ...STD } },
    { label: 'Brutal', values: { ...STD, 'swing.windup': 0.55, 'parry.window': 0.22, 'swing.gap': 1.3, 'hit.minSpeed': 600 } },
  ],
  start: 'menu',
  scenes: { menu, play, over },
};
