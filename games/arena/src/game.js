// Arena (proto 3): two full-body gladiators, side view, landscape (ADR-0013). Your gladiator is on the left and the finger drives his sword arm:
// a two-bone shoulder, elbow, hand chain, with the proto 1 offset and the proto 2 weight, and the whole body leans and steps with it.
// The opponent is the same build on the right: seeded armour, gaps, wind-ups (high, mid, low), parry (swipe right), dodge (swipe left, you hop back).
// Layout: H = fighter body unit = screen height * fighter.height, feet on a floor line, one side each of the screen centre. Body units: x forward, y down, origin at the feet.
// All particles are the game's own so a hit-stop freezes the burst, then lets it fly.

import { makeRng, clamp } from './engine.js';

const TUNING = {
  roundTime: 45,           // seconds per round
  hearts: 3,
  resetDelay: 0.9,         // seconds after a foe falls before a fresh one
  swayRate: 1.3,           // radians per second of the foe's sway
  offset: 70,              // blade tip above the finger, px
  hand: {
    lag: 0.035,            // seconds of weight in the hand
    regrip: 0.12,          // lag while the hand recovers from a bounce
    rest: [0.62, -0.12],   // sword at rest (finger up), from the shoulder, in body units
  },
  arm: { len: 0.40, minFrac: 0.22 },   // shoulder to hand, in H; the hand keeps at least minFrac of it from the shoulder
  blade: { len: 0.50, pad: 5 },        // blade length in H, hit pad in px
  fighter: { height: 0.68, floor: 0.88, sep: 0.5 },   // body unit as a fraction of screen height, feet line, half the gap between feet in H
  lean: { gain: 0.5, max: 0.4, vel: 4200, min: -0.12, tau: 0.07 },  // radians toward the hand, and per px/s of tip speed
  step: { max: 0.3, from: 0.62, gain: 0.55, tau: 0.09 },            // the step in, in H
  dodge: { dur: 0.4, back: 0.3, hop: 0.12 },
  hit: {
    minSpeed: 450,         // tip px/s below which the blade does nothing
    mid: 950,              // speed for damage 2
    fast: 1800,            // speed for damage 3
    cool: 0.2,             // seconds before the same part can be hit again
  },
  part: { hp: 3 },         // damage a gap part takes before it is disabled
  armour: { recoil: 0.35, dents: 3, kick: 0.45 },
  stun: 1.2,               // seconds the foe is stunned when the head goes
  armSlow: 0.4,            // each disabled arm lengthens the wind-up by this fraction
  swing: {
    windup: 0.7,           // seconds from the first tell to the blow
    gap: 2.0,              // seconds between swings: gap to gap + gapSpread
    gapSpread: 1.5,
    lunge: 0.22,           // foe steps in this far (H) as the blow lands
  },
  parry: { window: 0.3, perfectFrac: 1 / 3, stagger: 1.0, riposteMul: 2 },
  swipe: { minDist: 80, minSpeed: 650, span: 0.18 },
  juice: { stop1: 0.04, stop2: 0.07, stop3: 0.1, stopBreak: 0.05, stopClang: 0.03, strawPerDmg: 14 },
  foe: { swayX: 0.05, swayDeg: 3, kick: 0.9, armourMin: 3, armourMax: 4 },
};

// Parts in body units. Arms hang from a joint (their own frame): d is relative to the joint.
const PARTS = [
  { id: 'head',  shape: 'circle', x: 0.03, y: -0.80, r: 0.08 },
  { id: 'chest', shape: 'rect',   x: 0,    y: -0.60, w: 0.24, h: 0.17 },
  { id: 'belly', shape: 'rect',   x: 0,    y: -0.44, w: 0.20, h: 0.13 },
  { id: 'armF',  shape: 'rect',   x: 0,    y: 0.15,  w: 0.09, h: 0.30, joint: [0.05, -0.67] },
  { id: 'armB',  shape: 'rect',   x: 0,    y: 0.15,  w: 0.085, h: 0.30, joint: [-0.04, -0.67] },
  { id: 'legs',  shape: 'rect',   x: 0,    y: -0.19, w: 0.22, h: 0.38 },
];
const ARM_LEN = 0.30, CLUB_LEN = 0.40, SHOULDER = [0.05, -0.67];

// The three tells: where the blow lands (body units), how the weapon arm is cocked and where the swing ends (angles from forward, y down).
const ZONES = [
  { id: 'high', y: -0.78, cock: -1.55, end: 1.15, label: 'HIGH' },
  { id: 'mid',  y: -0.62, cock: -2.9,  end: 0.0,  label: 'MID' },
  { id: 'low',  y: -0.18, cock: 2.5,   end: 0.9,  label: 'LOW' },
];
const REST_TH = 0.9;

const STRAW = ['#e6c866', '#d4b04a', '#f2dc90', '#b8923a'];
const YOU = { skin: '#c58f5e', tunic: '#2f7d6d', hem: '#1d5448', crest: '#e6c866', cap: '#b08a3e' };
const FOE = { skin: '#b9835a', tunic: '#9b2f2f', hem: '#6d1d1d', crest: '#2a2a2a', cap: '#6b6f78' };
const state = {};
const now = () => performance.now() / 1000;
const easeOut = (u) => 1 - (1 - u) * (1 - u);
const ZERO = { ox: 0, oy: 0, rot: 0 };

function makeParts(rng, noArmour) {
  const F = TUNING.foe;
  const ids = PARTS.map((_, i) => i).filter((i) => !noArmour.includes(PARTS[i].id));
  const order = rng.shuffle(ids);
  const n = rng.chance(0.5) ? F.armourMin : F.armourMax;
  const armoured = new Set(order.slice(0, n));
  return PARTS.map((d, i) => ({ d, armour: armoured.has(i), cut: false, hp: TUNING.part.hp, dents: 0, cracks: [], gashes: [], flash: 0, clang: 0, cool: 0 }));
}

function newRack(E) {
  const rng = makeRng(state.seed + state.rack * 7919);
  const f = state.foe;
  f.parts = makeParts(rng, []);
  f.th = REST_TH; f.dx = 0; f.dy = 0; f.a = 0; f.fr = {};
  state.pop = 1; state.fallT = 0; state.sw = null; state.stun = 0; state.stagger = 0; state.kickA = 0; state.kickV = 0;
  state.swingIn = nextGap();
}

function nextGap() { const S = TUNING.swing; return S.gap + state.rng.range(0, S.gapSpread); }

function newRound(E, seed) {
  Object.assign(state, {
    seed, rng: makeRng(seed ^ 0x9e3779b9), rack: 0, t: TUNING.roundTime, m: 0, stop: 0, kickA: 0, kickV: 0,
    hearts: TUNING.hearts, endT: 0, guard: 0, dodgeT: 0, hurt: 0, parryT: 0, clash: null, done: false,
    gapHits: 0, clangs: 0, broken: 0, parries: 0, perfects: 0, dodges: 0, taken: 0, felled: 0,
    fx: [], pops: [], streaks: [], trail: [],
    you: { dx: 0, a: 0, kick: 0, kickV: 0, back: 0, hopX: 0, hopY: 0, tvx: 0, parts: makeParts(makeRng(seed ^ 0x5bd1e995), ['armF']), fr: {} },
    foe: {},
    crowd: [],
    hand: { down: false, id: -1, fx: 0, fy: 0, tgx: 0, tgy: 0, ux: 0, uy: 0, pux: 0, puy: 0, hx: 0, hy: 0, phx: 0, phy: 0, ex: 0, ey: 0, sx: 0, sy: 0, dx: 1, dy: 0, hvx: 0, hvy: 0, lock: 0, grip: 0, sp: 0, hist: [] },
  });
  const cr = makeRng(seed ^ 0x1234567);
  for (let i = 0; i < 70; i++) state.crowd.push({ x: cr.range(0, 1), y: cr.range(0, 1), r: cr.range(2, 4), c: cr.int(0, 3) });
  newRack(E);
  state.swingIn += 0.6;
}

// ----- layout and frames -----
function lay(E) {
  const F = TUNING.fighter, H = E.h * F.height;
  return { H, floor: E.h * F.floor, x0: E.w / 2 - H * F.sep, x1: E.w / 2 + H * F.sep };
}
function youF(E) { const L = lay(E), y = state.you; return { x: L.x0 + y.dx + y.hopX, y: L.floor + y.hopY, a: y.a, dir: 1, H: L.H }; }
function foeF(E) { const L = lay(E), f = state.foe; return { x: L.x1 + f.dx, y: L.floor + f.dy, a: f.a, dir: -1, H: L.H }; }
function toScreen(F, lx, ly) {
  const c = Math.cos(F.a), s = Math.sin(F.a);
  return [F.x + F.dir * (lx * c - ly * s) * F.H, F.y + (lx * s + ly * c) * F.H];
}
function toLocal(F, X, Y) {
  const ax = F.dir * (X - F.x) / F.H, ay = (Y - F.y) / F.H, c = Math.cos(F.a), s = Math.sin(F.a);
  return [ax * c + ay * s, -ax * s + ay * c];
}
function partLocal(p, fm, lx, ly) {
  const fr = fm.fr[p.d.id] || ZERO, dx = lx - fr.ox, dy = ly - fr.oy, c = Math.cos(fr.rot), s = Math.sin(fr.rot);
  return [dx * c + dy * s, -dx * s + dy * c];
}
function partCenter(F, fm, p) {
  const fr = fm.fr[p.d.id] || ZERO, c = Math.cos(fr.rot), s = Math.sin(fr.rot), d = p.d;
  return toScreen(F, fr.ox + d.x * c - d.y * s, fr.oy + d.x * s + d.y * c);
}
function inside(d, lx, ly, pad) {
  if (d.shape === 'circle') return Math.hypot(lx - d.x, ly - d.y) <= d.r + pad;
  return Math.abs(lx - d.x) <= d.w / 2 + pad && Math.abs(ly - d.y) <= d.h / 2 + pad;
}
const zoneScreenY = (L, zone) => L.floor + zone.y * L.H;

// ----- the foe's pose: sway, wind-up, lunge, fall -----
function poseFoe(E, dt) {
  const L = lay(E), f = state.foe, sw = state.sw, S = TUNING.swing, FT = TUNING.foe;
  const fall = state.fallT > 0 ? Math.pow(clamp(state.fallT / 0.5, 0, 1), 2) : 0;
  let lean = FT.swayDeg * Math.PI / 180 * Math.sin(state.m * TUNING.swayRate * 1.3) + state.kickA, crouch = 0, lunge = 0;
  let th = REST_TH + 0.08 * Math.sin(state.m * 3);
  if (sw) {
    const z = sw.zone;
    if (sw.fin > 0) {
      const v = clamp((0.4 - sw.fin) / 0.12, 0, 1), back = clamp(sw.fin / 0.2, 0, 1);
      if (sw.outcome === 'parry') {
        const v1 = clamp((0.4 - sw.fin) / 0.08, 0, 1), ret = clamp(1 - sw.fin / 0.25, 0, 1);
        th = z.cock + (sw.thClash - z.cock) * easeOut(v1) * (1 - ret);
        lunge = S.lunge * 0.6 * easeOut(v1) * back; lean += 0.1 * easeOut(v1) * back;
      } else {
        th = z.cock + (z.end - z.cock) * v * v;
        lunge = S.lunge * easeOut(v) * back; lean += 0.22 * easeOut(v) * back;
      }
    } else {
      const u = clamp(sw.t / (sw.wind * 0.55), 0, 1), e = easeOut(u);
      th = REST_TH + (z.cock - REST_TH) * e + (u >= 1 ? Math.sin(sw.t * 55) * 0.035 : 0);
      lean += (z.id === 'high' ? -0.18 : z.id === 'mid' ? -0.08 : 0.22) * e;
      crouch = z.id === 'low' ? 0.05 * e : 0;
    }
    f.th = th;
  } else {
    f.th += (th - f.th) * (1 - Math.exp(-(dt || 0.016) / 0.1));
    th = f.th;
  }
  f.dx = -(lunge * L.H) + Math.sin(state.m * TUNING.swayRate * 0.8) * FT.swayX * L.H + fall * 0.3 * L.H;
  f.dy = crouch * L.H + Math.abs(Math.sin(state.m * 2.4)) * -3;
  f.a = lean - fall * 1.45;
  f.fr = {
    armF: { ox: SHOULDER[0], oy: SHOULDER[1], rot: th - Math.PI / 2 },
    armB: { ox: PARTS[4].joint[0], oy: PARTS[4].joint[1], rot: 0.14 + 0.08 * Math.sin(state.m * 1.7) },
  };
}

function poseYou(E, dt) {
  const L = lay(E), y = state.you, D = TUNING.dodge, h = state.hand;
  const want = state.sw && state.sw.def === 'dodge' ? 1 : 0;
  y.back += (want - y.back) * (1 - Math.exp(-dt / (want ? 0.05 : 0.14)));
  const u = state.dodgeT > 0 ? 1 - state.dodgeT / D.dur : 1;
  y.hopX = -D.back * L.H * y.back;
  y.hopY = state.dodgeT > 0 ? -D.hop * L.H * Math.sin(Math.PI * u) : 0;
  y.kickV += (-y.kick * 90 - y.kickV * 7) * dt; y.kick += y.kickV * dt;
  const S0x = L.x0 + SHOULDER[0] * L.H, reach = (TUNING.arm.len + TUNING.blade.len) * L.H, LN = TUNING.lean, ST = TUNING.step;
  let leanT = clamp(((h.ux - S0x) / reach - 0.3) * LN.gain, LN.min, LN.max) + clamp(y.tvx / LN.vel, -0.18, 0.18);
  if (!h.down && h.lock <= 0) leanT = 0.05;
  leanT -= 0.22 * y.back;
  y.a += (leanT - y.a) * (1 - Math.exp(-dt / LN.tau));
  const stepT = h.down || h.lock > 0 ? clamp((h.tgx - S0x - ST.from * reach) * ST.gain, 0, ST.max * L.H) : 0;
  y.dx += (stepT - y.dx) * (1 - Math.exp(-dt / ST.tau));
  y.fr = { armB: { ox: PARTS[4].joint[0], oy: PARTS[4].joint[1], rot: 0.12 + 0.06 * Math.sin(state.m * 1.9) - y.a * 0.6 } };
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
function plateBits(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, s = 200 + Math.random() * 360;
    state.fx.push({ k: 'p', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 900, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 20, w: 10 + Math.random() * 12, h: 6 + Math.random() * 8, life: 0.9 + Math.random() * 0.4, max: 1.3 });
  }
}

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
function parrySound(E) {
  const A = E.audio;
  A.beep({ freq: 880, dur: 0.16, type: 'square', slide: 0.7, gain: 0.1 });
  A.beep({ freq: 1320, dur: 0.1, type: 'sine', gain: 0.1 });
  A.beep({ freq: 220, dur: 0.18, type: 'triangle', slide: 0.6, gain: 0.25 });
  A.noise({ dur: 0.05, gain: 0.18 });
}
function swooshSound(E, gain = 0.12) { E.audio.noise({ dur: 0.16, gain }); E.audio.beep({ freq: 700, dur: 0.14, type: 'sine', slide: 0.3, gain: gain * 0.4 }); }

// ----- the sword arm: target follows the finger, then a two-bone solve from the shoulder -----
function solveArm(E) {
  const h = state.hand, L = lay(E), A = TUNING.arm, H = L.H;
  const [sx, sy] = toScreen(youF(E), SHOULDER[0], SHOULDER[1]);
  const arm = A.len * H, blade = TUNING.blade.len * H;
  let dx = h.tgx - sx, dy = h.tgy - sy; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
  const hd = clamp(d - blade, A.minFrac * arm, 0.985 * arm);
  h.sx = sx; h.sy = sy; h.dx = dx; h.dy = dy;
  h.hx = sx + dx * hd; h.hy = sy + dy * hd;
  h.ux = h.hx + dx * blade; h.uy = h.hy + dy * blade;
  const half = hd / 2, bend = Math.sqrt(Math.max(0, (arm / 2) ** 2 - half * half));
  h.ex = sx + dx * half - dy * bend; h.ey = sy + dy * half + dx * bend;
}

function moveHand(E, dt) {
  const h = state.hand, HT = TUNING.hand, L = lay(E);
  h.pux = h.ux; h.puy = h.uy; h.phx = h.hx; h.phy = h.hy;
  if (h.lock > 0) {
    h.lock -= dt;
    h.tgx += h.hvx * dt; h.tgy += h.hvy * dt;
    const damp = Math.exp(-9 * dt); h.hvx *= damp; h.hvy *= damp;
    h.tgx = clamp(h.tgx, 10, E.w - 10); h.tgy = clamp(h.tgy, E.safe.top + 40, E.h - 10);
    if (h.lock <= 0) h.grip = 0.3;
  } else if (state.parryT > 0) {
    state.parryT -= dt;
    const k = 1 - Math.exp(-dt / 0.03);
    h.tgx += (state.clash.x - h.tgx) * k; h.tgy += (state.clash.y - h.tgy) * k;
    if (state.parryT <= 0) h.grip = 0.25;
  } else if (h.down) {
    const lag = h.grip > 0 ? HT.regrip : HT.lag;
    const k = 1 - Math.exp(-dt / lag);
    h.tgx += (clamp(h.fx, 0, E.w) - h.tgx) * k; h.tgy += (h.fy - TUNING.offset - h.tgy) * k;
    if (h.grip > 0) h.grip -= dt;
  } else {
    const [sx, sy] = toScreen(youF(E), SHOULDER[0], SHOULDER[1]);
    const k = 1 - Math.exp(-dt / 0.09);
    h.tgx += (sx + HT.rest[0] * L.H - h.tgx) * k; h.tgy += (sy + HT.rest[1] * L.H - h.tgy) * k;
  }
  solveArm(E);
  const vx = (h.ux - h.pux) / Math.max(dt, 0.001), vy = (h.uy - h.puy) / Math.max(dt, 0.001), inst = Math.hypot(vx, vy);
  state.you.tvx += (vx - state.you.tvx) * (1 - Math.exp(-dt / 0.06));
  h.sp = h.down && h.lock <= 0 && state.parryT <= 0 ? h.sp * 0.5 + inst * 0.5 : 0;
  state.trail.push({ x: h.ux, y: h.uy, life: 0.12 });
  for (const q of state.trail) q.life -= dt;
  state.trail = state.trail.filter((q) => q.life > 0);
}

function checkHits(E) {
  const h = state.hand, T = TUNING;
  if (!h.down || h.lock > 0 || h.grip > 0.18 || state.guard > 0 || state.fallT > 0 || state.endT > 0 || state.parryT > 0) return;
  if (h.sp < T.hit.minSpeed) return;
  const F = foeF(E), fm = state.foe, pad = T.blade.pad / F.H;
  const found = new Map();
  for (const f of [1, 0.7, 0.4]) {
    const x0 = h.phx + (h.hx - h.phx) * f, y0 = h.phy + (h.hy - h.phy) * f;
    const x1 = h.pux + (h.ux - h.pux) * f, y1 = h.puy + (h.uy - h.puy) * f;
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8));
    for (let i = 0; i <= n; i++) {
      const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
      const [lx, ly] = toLocal(F, x, y);
      for (const p of fm.parts) {
        if (p.cool > 0 || p.cut || found.has(p)) continue;
        const [qx, qy] = partLocal(p, fm, lx, ly);
        if (inside(p.d, qx, qy, pad)) found.set(p, { x, y, lx: qx, ly: qy });
      }
    }
  }
  if (!found.size) return;
  const ang = Math.atan2(h.uy - h.puy, h.ux - h.pux), sp = h.sp;
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
  const rv = clamp(sp * A.kick, 250, 900);
  h.hvx = -Math.cos(ang) * rv; h.hvy = -Math.sin(ang) * rv; h.lock = A.recoil; h.grip = 0;
  const d = p.d, sz = d.shape === 'circle' ? d.r : Math.min(d.w, d.h) / 2;
  const a0 = Math.random() * 6.28, pts = [[Math.cos(a0) * 0.1 * sz, Math.sin(a0) * 0.1 * sz]];
  for (let k = 1; k <= 4; k++) { const a = a0 + (Math.random() - 0.5) * 0.9; pts.push([pts[0][0] + Math.cos(a) * sz * 0.5 * k * (0.8 + Math.random() * 0.4), pts[0][1] + Math.sin(a) * sz * 0.5 * k * (0.8 + Math.random() * 0.4)]); }
  p.cracks.push(pts);
  sparks(at.x, at.y, ang + Math.PI, 18); ring(at.x, at.y, 36, '#cbd5e1');
  clangSound(E, 0); E.shake(4, 0.12); E.haptic(18);
  if (p.dents >= A.dents) {
    p.armour = false; state.broken++;
    const [sx, sy] = partCenter(foeF(E), state.foe, p);
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
  state.kickV += T.foe.kick * (Math.cos(ang) > 0 ? -1 : 0.5) * (0.6 + dmg * 0.4);
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
  if (p.d.id === 'head') {
    state.stun = TUNING.stun; state.sw = null; state.swingIn = nextGap();
    pop(at.x, at.y - 70, 'STUNNED', '#a5b4fc', 20);
  }
  const P = (k) => state.foe.parts.find((q) => q.d.id === k);
  if (P('chest').cut && P('belly').cut && !state.fallT) {
    state.felled++; state.fallT = 0.01; state.sw = null;
    pop(E.w * 0.62, E.h * 0.3, 'FOE DOWN', '#ffd24a', 28); E.shake(10, 0.3); E.flash('#fff0b8', 0.1); E.audio.play('coin');
  }
}

// ----- the foe swings back -----
function startSwing() {
  const S = TUNING.swing;
  const arms = state.foe.parts.filter((p) => (p.d.id === 'armF' || p.d.id === 'armB') && p.cut).length;
  const wind = S.windup * (1 + TUNING.armSlow * arms);
  state.sw = { zone: ZONES[state.rng.int(0, ZONES.length - 1)], t: 0, wind, def: null, perfect: false, fin: 0, outcome: null, thClash: 0 };
}

function swipeCheck(E) {
  const h = state.hand, sw = state.sw, S = TUNING.swipe, P = TUNING.parry;
  if (!sw || sw.def || sw.fin > 0 || !h.down || h.hist.length < 2) return;
  const last = h.hist[h.hist.length - 1];
  let first = h.hist[0];
  for (const q of h.hist) if (last.t - q.t <= S.span) { first = q; break; }
  const dx = last.x - first.x, dy = last.y - first.y, d = Math.hypot(dx, dy), dt = Math.max(0.03, last.t - first.t);
  if (d < S.minDist || d / dt < S.minSpeed || Math.abs(dx) < Math.abs(dy) * 1.3) return;
  h.hist.length = 0;
  const L = lay(E), Fy = youF(E), Ff = foeF(E);
  if (dx < 0) {
    sw.def = 'dodge'; state.dodges++; state.dodgeT = TUNING.dodge.dur; state.guard = 0.3;
    const [px, py] = toScreen(Fy, 0, -0.95);
    pop(px, py - 10, 'DODGE', '#7de3ff', 26); swooshSound(E, 0.16); E.haptic(12);
    dust(Fy.x, L.floor, 8);
    return;
  }
  const toWindow = sw.wind - sw.t;
  if (toWindow > P.window) { const [px, py] = toScreen(Fy, 0, -0.95); pop(px, py - 10, 'too early', '#94a3b8', 14); return; }
  sw.def = 'parry'; sw.outcome = 'parry'; sw.fin = 0.4; state.guard = 0.3; state.parries++;
  sw.perfect = sw.t - (sw.wind - P.window) < P.window * P.perfectFrac;
  // the clash point: where the foe's weapon can reach at the blow's height, and where your blade snaps to
  const [fsx, fsy] = toScreen(Ff, SHOULDER[0], SHOULDER[1]);
  const zy = zoneScreenY(L, sw.zone), Lc = 0.62 * L.H, dyc = zy - fsy;
  const dxc = Math.sqrt(Math.max(0.04 * L.H * L.H, Lc * Lc - dyc * dyc));
  const cx = fsx - dxc, cy = zy;
  sw.thClash = Math.atan2(dyc / L.H, dxc / L.H);
  state.clash = { x: cx, y: cy }; state.parryT = 0.28;
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
  const sw = state.sw, L = lay(E), zy = zoneScreenY(L, sw.zone), Fy = youF(E), Ff = foeF(E);
  sw.fin = 0.4;
  state.streaks.push({ x1: Ff.x - L.H * 0.3, y1: zy - 30, x2: Fy.x - L.H * 0.1, y2: zy + 20, life: 0.22, max: 0.22, red: sw.def !== 'dodge' });
  if (sw.def === 'dodge') { sw.outcome = 'whiff'; swooshSound(E, 0.2); pop(E.w / 2, zy - 30, 'WHIFF', '#7de3ff', 18); return; }
  sw.outcome = 'hit'; state.hearts--; state.taken++; state.hurt = 0.4;
  E.flash('#ff2a2a', 0.3); E.shake(16, 0.35); E.haptic(70);
  E.audio.play('boom'); E.audio.play('lose', 0.5);
  pop(Fy.x, zy - 40, 'OUCH', '#ff5a4a', 34);
  state.you.kickV -= 7;
  state.hand.lock = Math.max(state.hand.lock, 0.2); state.hand.hvx = -200; state.hand.hvy = 120;
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

// ----- drawing: one procedural body for both fighters -----
function path(ctx, d, H, inset = 0) {
  ctx.beginPath();
  if (d.shape === 'circle') { ctx.arc(d.x * H, d.y * H, (d.r - inset) * H, 0, Math.PI * 2); return; }
  const w = (d.w - inset * 2) * H, h = (d.h - inset * 2) * H, x = d.x * H - w / 2, y = d.y * H - h / 2, r = Math.min(w, h) * 0.18;
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function drawPart(ctx, p, H, st, fr) {
  const d = p.d;
  ctx.save();
  if (fr) { ctx.translate(fr.ox * H, fr.oy * H); ctx.rotate(fr.rot); }
  if (d.id !== 'legs') {
    path(ctx, d, H);
    ctx.fillStyle = p.cut ? '#2b2217' : st.skin; ctx.fill();
    ctx.save(); ctx.clip();
    if (!p.cut && p.hp < TUNING.part.hp) { ctx.fillStyle = `rgba(60,20,10,${(1 - p.hp / TUNING.part.hp) * 0.5})`; ctx.fillRect(-H, -2 * H, 2 * H, 3 * H); }
    for (const g of p.gashes) {
      ctx.strokeStyle = '#0a0705'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(g[0][0] * H, g[0][1] * H); ctx.lineTo(g[1][0] * H, g[1][1] * H); ctx.stroke();
      ctx.strokeStyle = '#a05a3c'; ctx.lineWidth = 1.1; ctx.stroke();
    }
    ctx.restore();
    path(ctx, d, H);
    ctx.strokeStyle = p.cut ? '#120d08' : '#5a3a22'; ctx.lineWidth = 2; ctx.stroke();
    if (p.flash > 0) { path(ctx, d, H); ctx.fillStyle = `rgba(255,250,220,${p.flash / 0.16})`; ctx.fill(); }
  }
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
    const rv = (x, y) => { ctx.beginPath(); ctx.arc(x * H, y * H, 2, 0, 6.28); ctx.fill(); };
    if (d.shape === 'circle') ctx.fillRect((d.x - d.r * 0.2) * H, (d.y - 0.01) * H, d.r * 1.2 * H, 0.025 * H);
    else { rv(d.x - d.w * 0.3, d.y - d.h * 0.3); rv(d.x + d.w * 0.3, d.y - d.h * 0.3); rv(d.x - d.w * 0.3, d.y + d.h * 0.3); rv(d.x + d.w * 0.3, d.y + d.h * 0.3); }
    ctx.restore();
  }
  ctx.restore();
}

function limb(ctx, pts, w, col) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = w + 3; ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
}

// who: 'you' or 'foe'. The foe also draws his weapon arm and club; yours is drawn in screen space by drawSwordArm.
function drawFighter(ctx, E, F, fm, st, who) {
  const H = F.H, L = lay(E), isFoe = who === 'foe';
  const P = (id) => fm.parts.find((q) => q.d.id === id);
  const fall = isFoe && state.fallT > 0 ? Math.pow(clamp(state.fallT / 0.5, 0, 1), 2) : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(F.x + (isFoe ? 0 : 0), L.floor + 3, H * 0.22, H * 0.035, 0, 0, 6.28); ctx.fill();
  ctx.save();
  ctx.translate(F.x, F.y); ctx.scale(F.dir, 1); ctx.rotate(F.a);
  if (isFoe && state.stagger > 0) {
    const g = ctx.createRadialGradient(0, -0.5 * H, 10, 0, -0.5 * H, 0.6 * H);
    g.addColorStop(0, 'rgba(255,210,74,0.45)'); g.addColorStop(1, 'rgba(255,210,74,0)');
    ctx.fillStyle = g; ctx.fillRect(-0.7 * H, -1.1 * H, 1.4 * H, 1.3 * H);
  }
  const sc = isFoe && state.pop < 1 ? 0.85 + 0.15 * (1 - state.pop) : 1;
  ctx.scale(sc, sc);
  ctx.globalAlpha = isFoe && state.pop < 1 ? 1 - state.pop * 0.7 : 1;
  if (fall > 0) ctx.globalAlpha = 1 - fall * 0.5;
  // far arm
  const armB = P('armB');
  drawPart(ctx, armB, H, st, fm.fr.armB);
  // legs, two segments each, a stance that shifts with the sway
  const legs = P('legs'), lc = legs.cut ? '#2b2217' : st.skin, wob = Math.sin(state.m * 2.1) * 0.015;
  limb(ctx, [[-0.02 * H, -0.37 * H], [-0.07 * H, -0.19 * H], [(-0.12 + wob) * H, -0.02 * H]], 0.075 * H, lc);
  limb(ctx, [[0.02 * H, -0.37 * H], [0.09 * H, -0.2 * H], [(0.12 - wob) * H, -0.02 * H]], 0.075 * H, lc);
  ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = 0.055 * H; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo((-0.12 + wob) * H, -0.012 * H); ctx.lineTo((-0.07 + wob) * H, -0.012 * H); ctx.moveTo((0.12 - wob) * H, -0.012 * H); ctx.lineTo((0.17 - wob) * H, -0.012 * H); ctx.stroke();
  if (legs.armour) drawPart(ctx, legs, H, st, null);
  // tunic
  ctx.fillStyle = st.tunic; ctx.strokeStyle = st.hem; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-0.11 * H, -0.42 * H); ctx.lineTo(0.11 * H, -0.42 * H); ctx.lineTo(0.15 * H, -0.27 * H); ctx.lineTo(-0.14 * H, -0.27 * H); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = st.hem; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-0.01 * H, -0.4 * H); ctx.lineTo(0.0 * H, -0.28 * H); ctx.stroke();
  drawPart(ctx, P('belly'), H, st, null);
  ctx.fillStyle = '#3a2a1a'; ctx.fillRect(-0.105 * H, -0.5 * H, 0.21 * H, 0.03 * H);
  ctx.fillStyle = '#d6b04a'; ctx.fillRect(0.0 * H, -0.505 * H, 0.04 * H, 0.04 * H);
  drawPart(ctx, P('chest'), H, st, null);
  if (!P('chest').armour) { ctx.strokeStyle = '#4a2f1a'; ctx.lineWidth = 0.025 * H; ctx.beginPath(); ctx.moveTo(-0.09 * H, -0.68 * H); ctx.lineTo(0.09 * H, -0.54 * H); ctx.stroke(); }
  // neck and head with a gladiator helm
  ctx.fillStyle = P('head').cut ? '#2b2217' : st.skin; ctx.fillRect(-0.025 * H, -0.74 * H, 0.06 * H, 0.06 * H);
  const head = P('head'), hx = head.d.x * H, hy = head.d.y * H, hr = head.d.r * H;
  drawPart(ctx, head, H, st, null);
  if (!head.armour) {
    ctx.fillStyle = st.cap; ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(hx, hy, hr * 1.06, Math.PI * 0.92, Math.PI * 2.04); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = head.cut ? '#6a6a6a' : '#1a1410'; ctx.beginPath(); ctx.arc(hx + hr * 0.45, hy - hr * 0.05, 0.012 * H + 1, 0, 6.28); ctx.fill();
  }
  ctx.fillStyle = st.crest; ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(hx + hr * 0.7, hy - hr * 0.8); ctx.quadraticCurveTo(hx, hy - hr * 2.0, hx - hr * 1.5, hy - hr * 0.5); ctx.lineTo(hx - hr * 0.9, hy - hr * 0.55); ctx.quadraticCurveTo(hx, hy - hr * 1.45, hx + hr * 0.4, hy - hr * 0.95); ctx.closePath(); ctx.fill(); ctx.stroke();
  // the foe's weapon arm and club
  if (isFoe) {
    const arm = P('armF'), fr = fm.fr.armF;
    drawPart(ctx, arm, H, st, fr);
    ctx.save(); ctx.translate(fr.ox * H, fr.oy * H); ctx.rotate(fr.rot);
    ctx.fillStyle = st.skin; ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, ARM_LEN * H, 0.042 * H, 0, 6.28); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7a5532';
    ctx.beginPath(); ctx.moveTo(-0.016 * H, (ARM_LEN - 0.04) * H); ctx.lineTo(0.016 * H, (ARM_LEN - 0.04) * H); ctx.lineTo(0.042 * H, (ARM_LEN + CLUB_LEN) * H); ctx.lineTo(-0.042 * H, (ARM_LEN + CLUB_LEN) * H); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4a3320';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc((i - 1) * 0.02 * H, (ARM_LEN + CLUB_LEN - 0.04 - (i % 2) * 0.05) * H, 2.2, 0, 6.28); ctx.fill(); }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  if (isFoe && state.stun > 0) {
    const [sx, sy] = toScreen(F, 0.03, -1.0);
    for (let i = 0; i < 3; i++) {
      const a = state.m * 7 + i * 2.09;
      E.text('*', sx + Math.cos(a) * 0.12 * H, sy + Math.sin(a) * 0.035 * H, { size: 26, color: '#fde68a', weight: '800' });
    }
  }
}

function drawSwordArm(ctx, E) {
  const h = state.hand, H = lay(E).H, locked = h.lock > 0;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (state.trail.length > 1 && h.sp >= TUNING.hit.minSpeed) {
    ctx.strokeStyle = 'rgba(125,227,255,0.35)'; ctx.lineWidth = 8; ctx.beginPath();
    state.trail.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
  }
  // two bones, shoulder to elbow to hand
  limb(ctx, [[h.sx, h.sy], [h.ex, h.ey], [h.hx, h.hy]], 0.075 * H, YOU.skin);
  ctx.fillStyle = YOU.tunic; ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(h.sx, h.sy, 0.058 * H, 0, 6.28); ctx.fill(); ctx.stroke();
  // blade
  const hot = h.sp >= TUNING.hit.minSpeed && !locked;
  if (hot) { ctx.strokeStyle = h.sp >= TUNING.hit.fast ? 'rgba(255,200,90,0.5)' : 'rgba(125,227,255,0.45)'; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(h.hx, h.hy); ctx.lineTo(h.ux, h.uy); ctx.stroke(); }
  ctx.strokeStyle = '#1b2026'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(h.hx - h.dx * 12, h.hy - h.dy * 12); ctx.lineTo(h.ux, h.uy); ctx.stroke();
  ctx.strokeStyle = locked ? '#ff8a7a' : '#e8eef4'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(h.hx + h.dx * 10, h.hy + h.dy * 10); ctx.lineTo(h.ux, h.uy); ctx.stroke();
  const nx = -h.dy, ny = h.dx, gx = h.hx + h.dx * 10, gy = h.hy + h.dy * 10;
  ctx.strokeStyle = '#c9a43a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(gx - nx * 15, gy - ny * 15); ctx.lineTo(gx + nx * 15, gy + ny * 15); ctx.stroke();
  ctx.fillStyle = YOU.skin; ctx.beginPath(); ctx.arc(h.hx, h.hy, 0.042 * H, 0, 6.28); ctx.fill();
  ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = 2; ctx.stroke();
  if (h.down) {
    ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(h.fx, h.fy); ctx.lineTo(h.fx, h.fy - TUNING.offset); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(h.fx, h.fy, 14, 0, 6.28); ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.stroke();
  }
  if (locked) E.text('X', h.ux, h.uy - 22, { size: 22, color: '#ff8a7a', weight: '800' });
}

function drawZone(ctx, E) {
  const sw = state.sw;
  if (!sw || sw.fin > 0) return;
  const L = lay(E), P = TUNING.parry, Fy = youF(E), Ff = foeF(E);
  const y = zoneScreenY(L, sw.zone), bh = 0.11 * L.H;
  const x0 = Fy.x - 0.2 * L.H, x1 = Ff.x - 0.1 * L.H, w = x1 - x0;
  const left = sw.wind - sw.t, inWin = left <= P.window, perfect = inWin && sw.t - (sw.wind - P.window) < P.window * P.perfectFrac;
  const pulse = 0.5 + 0.5 * Math.sin(sw.t * (10 + 14 * sw.t / sw.wind));
  const rgb = perfect ? '255,236,120' : inWin ? '255,150,60' : '255,70,50';
  const a = (0.12 + 0.3 * (sw.t / sw.wind)) * (0.7 + 0.5 * pulse);
  const g = ctx.createLinearGradient(0, y - bh, 0, y + bh);
  g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.5, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.fillRect(x0, y - bh, w, bh * 2);
  ctx.strokeStyle = `rgba(${rgb},${0.5 + 0.4 * pulse})`; ctx.lineWidth = 3; ctx.setLineDash([14, 10]);
  ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x0, y); ctx.stroke(); ctx.setLineDash([]);
  const ar = `rgba(${rgb},${0.55 + 0.4 * pulse})`;
  ctx.strokeStyle = ar; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const ax = x0 + w * 0.18, s = 7;
  ctx.beginPath(); ctx.moveTo(ax - s, y - s); ctx.lineTo(ax - 2 * s, y); ctx.lineTo(ax - s, y + s); ctx.stroke();
  E.text(inWin ? (perfect ? 'PARRY NOW' : 'PARRY') : sw.zone.label, (x0 + x1) / 2, y - bh - 10, { size: 18, weight: '800', color: `rgb(${rgb})` });
}

function drawBackground(ctx, E) {
  const L = lay(E), sandTop = L.floor - 0.06 * L.H, wallTop = E.h * 0.2;
  const sky = ctx.createLinearGradient(0, 0, 0, wallTop);
  sky.addColorStop(0, '#1a1420'); sky.addColorStop(1, '#3a2a28');
  ctx.fillStyle = sky; ctx.fillRect(-20, -20, E.w + 40, wallTop + 20);
  const cols = ['#c0805a', '#8a5a4a', '#d4a574', '#6a4a5a'];
  for (const c of state.crowd) { ctx.fillStyle = cols[c.c]; ctx.beginPath(); ctx.arc(c.x * E.w, wallTop - 6 - c.y * (wallTop - 20) * 0.7, c.r, 0, 6.28); ctx.fill(); }
  ctx.fillStyle = '#4a3a2c'; ctx.fillRect(-20, wallTop, E.w + 40, sandTop - wallTop);
  ctx.fillStyle = '#2e241b';
  const n = Math.ceil(E.w / 90);
  for (let i = 0; i < n; i++) {
    const ax = (i + 0.5) * E.w / n, aw = Math.min(46, E.w / n * 0.5), ah = (sandTop - wallTop) * 0.7;
    ctx.beginPath(); ctx.moveTo(ax - aw / 2, sandTop); ctx.lineTo(ax - aw / 2, sandTop - ah + aw / 2); ctx.arc(ax, sandTop - ah + aw / 2, aw / 2, Math.PI, 0); ctx.lineTo(ax + aw / 2, sandTop); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#3a2d22'; ctx.fillRect(-20, wallTop, E.w + 40, 5);
  const sand = ctx.createLinearGradient(0, sandTop, 0, E.h);
  sand.addColorStop(0, '#b99a62'); sand.addColorStop(1, '#7d6340');
  ctx.fillStyle = sand; ctx.fillRect(-20, sandTop, E.w + 40, E.h - sandTop + 20);
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(-20, sandTop, E.w + 40, 3);
}

// ----- scenes -----
const menu = {
  enter() { this.btnPlay = null; this.btnMute = null; },
  render(ctx, E) {
    E.text('ARENA', E.w / 2, E.h * 0.22, { size: 44, weight: '800', color: '#e6c866' });
    E.text('Swing through the gaps. Armour bounces.', E.w / 2, E.h * 0.22 + 40, { size: 15, color: '#9aa4b2' });
    E.text('Swipe right to parry, left to dodge.', E.w / 2, E.h * 0.22 + 62, { size: 15, color: '#9aa4b2' });
    E.text(`Best: ${E.save.get('best2', 0)} gap hits`, E.w / 2, E.h * 0.22 + 92, { size: 17, color: '#fbbf24' });
    this.btnPlay = E.button('Play', E.w / 2, E.h * 0.62);
    this.btnMute = E.button(E.audio.muted ? 'Sound: off' : 'Sound: on', E.w / 2, E.h * 0.62 + 66, { fill: '#1f2937', w: 160, h: 44, size: 16 });
  },
  onTap(p, E) {
    if (this.btnPlay && E.hit(this.btnPlay, p)) { E.audio.play('tap'); E.setScene('play', { seed: (Math.random() * 2 ** 32) >>> 0 }); }
    else if (this.btnMute && E.hit(this.btnMute, p)) { E.audio.toggleMute(); E.audio.play('tap'); }
  },
};

function initHand(E) {
  const h = state.hand, L = lay(E);
  state.you.fr = { armB: { ox: PARTS[4].joint[0], oy: PARTS[4].joint[1], rot: 0.12 } };
  const [sx, sy] = toScreen(youF(E), SHOULDER[0], SHOULDER[1]);
  h.tgx = sx + TUNING.hand.rest[0] * L.H; h.tgy = sy + TUNING.hand.rest[1] * L.H;
  solveArm(E);
  h.pux = h.ux; h.puy = h.uy; h.phx = h.hx; h.phy = h.hy; state.you.a = 0.05;
  poseFoe(E, 0.016);
}

const play = {
  state, lay, foeF, youF, toScreen,
  enter(E, params) { newRound(E, params.seed); initHand(E); },
  update(dt, E) {
    if (state.stop > 0) { state.stop -= dt; return; }
    state.m += dt;
    if (state.endT <= 0) state.t -= dt;
    state.kickV += (-state.kickA * 90 - state.kickV * 7) * dt;
    state.kickA += state.kickV * dt;
    for (const p of state.foe.parts) { p.flash = Math.max(0, p.flash - dt); p.clang = Math.max(0, p.clang - dt); p.cool = Math.max(0, p.cool - dt); }
    if (state.pop > 0) state.pop = Math.max(0, state.pop - dt * 4);
    state.guard = Math.max(0, state.guard - dt);
    state.dodgeT = Math.max(0, state.dodgeT - dt);
    state.hurt = Math.max(0, state.hurt - dt);
    if (state.stagger > 0) state.stagger -= dt;

    poseFoe(E, dt);
    poseYou(E, dt);
    moveHand(E, dt);
    checkHits(E);
    updateSwing(dt, E);
    poseFoe(E, 0);

    if (state.fallT > 0) {
      state.fallT += dt;
      if (state.fallT >= TUNING.resetDelay) { state.rack++; newRack(E); poseFoe(E, 0.016); pop(E.w * 0.7, E.h * 0.3, 'NEW FOE', '#e6c866', 20); }
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
    if (h.lock <= 0) {
      h.tgx = p.x; h.tgy = p.y - TUNING.offset; h.grip = 0; solveArm(E);
      h.pux = h.ux; h.puy = h.uy; h.phx = h.hx; h.phy = h.hy; h.sp = 0;
    }
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
    ctx.save();
    drawBackground(ctx, E);
    drawFighter(ctx, E, youF(E), state.you, YOU, 'you');
    drawFighter(ctx, E, foeF(E), state.foe, FOE, 'foe');
    drawZone(ctx, E);
    drawSwordArm(ctx, E);

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
    ctx.restore();

    if (state.hurt > 0) {
      const g2 = ctx.createRadialGradient(E.w / 2, E.h / 2, E.h * 0.4, E.w / 2, E.h / 2, E.w * 0.6);
      g2.addColorStop(0, 'rgba(255,0,0,0)'); g2.addColorStop(1, `rgba(255,20,20,${state.hurt / 0.4 * 0.55})`);
      ctx.fillStyle = g2; ctx.fillRect(0, 0, E.w, E.h);
    }
    for (const q of state.pops) {
      const t = q.life / q.max;
      E.text(q.s, q.x, q.y - (1 - t) * 34, { size: q.size * (1 + (1 - t) * 0.2), color: q.color, weight: '800', alpha: Math.min(1, t * 2) });
    }

    // HUD, inside the safe area
    const top = 10 + E.safe.top, l = 16 + E.safe.left, r = 16 + E.safe.right;
    const secs = Math.max(0, Math.ceil(state.t));
    E.text(`0:${String(secs).padStart(2, '0')}`, l, top + 14, { size: 24, align: 'left', weight: '800', color: secs <= 5 ? '#ef4444' : '#e6e6e6' });
    E.text(`${state.gapHits}`, E.w / 2, top + 14, { size: 34, weight: '800', color: '#ffd24a' });
    E.text('gap hits', E.w / 2, top + 38, { size: 11, color: '#c4b99a' });
    for (let i = 0; i < TUNING.hearts; i++) E.text('♥', E.w - r - 10 - i * 26, top + 14, { size: 26, color: i < state.hearts ? '#ef4444' : '#3b3f46' });
    E.text(`${state.felled} felled`, E.w - r, top + 40, { size: 12, align: 'right', color: '#c4b99a' });
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(0, top + 50, E.w, 3);
    ctx.fillStyle = '#e6c866'; ctx.fillRect(0, top + 50, E.w * clamp(state.t / TUNING.roundTime, 0, 1), 3);
    if (state.t > TUNING.roundTime - 7) E.text('swing fast  |  swipe right: parry  |  swipe left: dodge', E.w / 2, E.h - 10 - E.safe.bottom, { size: 12, color: '#f0e6cc', alpha: clamp((state.t - (TUNING.roundTime - 7)) / 1.5 + 0.2, 0, 1) });
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
    const p = this.p, lx = E.w * 0.3, rx = E.w * 0.7, y = Math.max(E.safe.top + 40, E.h * 0.2);
    E.text(p.hearts <= 0 ? 'Cut down' : 'Round over', lx, y, { size: 32, weight: '800', color: p.hearts <= 0 ? '#ef4444' : '#e6e6e6' });
    E.text(`${Math.round(p.gapHits * this.k)}`, lx, y + 68, { size: 68, weight: '800', color: '#ffd24a' });
    E.text('gap hits', lx, y + 112, { size: 15, color: '#9aa4b2' });
    E.text(p.isNew ? 'New best!' : `Best ${p.best}`, lx, y + 138, { size: 18, color: '#fbbf24' });
    const lines = [`${p.clangs} clangs  |  ${p.broken} plates broken`, `${p.parries} parries (${p.perfects} perfect)`, `${p.dodges} dodges  |  ${p.taken} hits taken`, `${p.felled} foes felled`];
    lines.forEach((s, i) => E.text(s, rx, y - 12 + i * 24, { size: 15, color: '#cbd5e1' }));
    this.btnAgain = E.button('Again', rx - 72, E.h * 0.7, { w: 130, h: 52, size: 20 });
    this.btnMenu = E.button('Menu', rx + 72, E.h * 0.7, { w: 130, h: 52, size: 20, fill: '#334155' });
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
