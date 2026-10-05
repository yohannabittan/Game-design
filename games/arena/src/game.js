// Arena (proto 4): two full-body gladiators, side view, landscape (ADR-0013), two thumbs.
// RIGHT thumb: the sword arm. It is straight on a near-full-length circle around the shoulder at the finger's angle, and the elbow bends only when
// the finger draws back toward the body. A gladius hangs from the fist; its angle follows the arm and the swing. Overhead, jab (tip only) and slash
// come out of the motion. Every attack costs stamina; armour and the foe's guard clang (recoil, then an immediate counter).
// LEFT thumb (a touch that starts in the left third): swipe forward raises the shield, swipe back dodges out of reach.
// Layout: H = fighter body unit = screen height * fighter.height, feet on a floor line, one side each of the screen centre. Body units: x forward, y down, origin at the feet.
// All particles are the game's own so a hit-stop freezes the burst, then lets it fly.

import { makeRng, clamp, lerp } from './engine.js';

const TUNING = {
  roundTime: 45,           // seconds per round
  hearts: 3,
  resetDelay: 0.9,         // seconds after a foe falls before a fresh one
  swayRate: 1.3,           // radians per second of the foe's sway
  offset: 70,              // aim point above the finger, px
  hand: {
    lag: 0.035,            // seconds of weight in the hand
    regrip: 0.12,          // lag while the hand recovers from a bounce
    tiredLag: 2.4,         // lag multiplier at zero stamina
    rest: [0.5, -0.2],     // aim point at rest (finger up), from the shoulder, in body units
  },
  arm: { len: 0.42, minFrac: 0.35, full: 0.97, chamberAt: 0.16, straightAt: 0.5 },  // arm in H; finger distance (H) at which the arm is chambered and at which it is straight
  blade: { len: 0.36, pad: 5, tip: 0.22 },   // gladius length in H, hit pad px, fraction of the blade that is the jab tip
  grip: { straight: -0.25, chamber: -0.6, tau: 0.045, trail: 0.018 },  // blade angle from the arm (radians, up is negative), smoothing, trail per rad/s of arm swing
  fighter: { height: 0.68, floor: 0.88, sep: 0.5 },   // body unit as a fraction of screen height, feet line, half the gap between feet in H
  lean: { gain: 0.5, max: 0.4, vel: 4200, min: -0.12, tau: 0.07 },  // radians toward the hand, and per px/s of tip speed
  step: { max: 0.3, from: 0.55, gain: 0.9, tau: 0.09 },            // the step in, in H
  dodge: { dur: 0.45, back: 0.32, hop: 0.12, cost: 30, cool: 1.2, stepIn: 0.3, stepDist: 45 },  // stepDist: px the left thumb must move forward and hold to step back in
  hit: { minSpeed: 450, mid: 950, fast: 1800, cool: 0.2 },   // tip px/s: slash threshold, slash damage 2, glow
  attack: {
    jab: { cost: 8, minSpeed: 520, dmg: 2, recoil: 0.18 },
    slash: { cost: 14, dmg: 1, fastDmg: 2, recoil: 0.5, dents: 1 },
    over: { cost: 28, minSpeed: 750, dmg: 3, recoil: 0.7, dents: 2, raise: 0.2, window: 0.6 },  // raise: hand this far (H) above the shoulder; window: seconds it counts
  },
  stamina: { max: 100, regen: 32, delay: 0.45, tired: 0.5 },  // tired: damage multiplier at zero
  part: { hp: 3 },         // damage a gap part takes before it is disabled
  armour: { dents: 3, kick: 0.6 },
  stun: 1.2,               // seconds the foe is stunned when the head goes
  armSlow: 0.4,            // each disabled arm lengthens the wind-up by this fraction
  swing: {
    windup: 0.7,           // seconds from the first tell to the blow
    gap: 2.0,              // seconds between swings: gap to gap + gapSpread
    gapSpread: 1.5,
    lunge: 0.22,           // foe steps in this far (H) as the blow lands
  },
  counter: { windup: 0.38 },
  open: { dur: 0.8 },      // seconds the foe is open after each of his blows
  shield: { dur: 0.6, perfect: 0.15, hits: 4, cool: 0.25, stagger: 1.0, riposte: 1.0, riposteMul: 2 },
  swipe: { minDist: 70, minSpeed: 600, span: 0.18 },
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

// The three zones: where the blow lands (body units), how the weapon arm is cocked and where the swing ends (angles from forward, y down),
// and the guard: the arm angle held while guarding and the parts it covers.
const ZONES = [
  { id: 'high', y: -0.78, cock: -1.55, end: 1.15, label: 'HIGH', guard: -0.3, cover: ['head'] },
  { id: 'mid',  y: -0.62, cock: -2.9,  end: 0.0,  label: 'MID',  guard: 0.2,  cover: ['chest', 'belly'] },
  { id: 'low',  y: -0.18, cock: 2.5,   end: 0.9,  label: 'LOW',  guard: 1.05, cover: ['legs'] },
];
const REST_TH = 0.9;

const STRAW = ['#e6c866', '#d4b04a', '#f2dc90', '#b8923a'];
const YOU = { skin: '#c58f5e', tunic: '#2f7d6d', hem: '#1d5448', crest: '#e6c866', cap: '#b08a3e' };
const FOE = { skin: '#b9835a', tunic: '#9b2f2f', hem: '#6d1d1d', crest: '#2a2a2a', cap: '#6b6f78' };
const state = {};
const now = () => performance.now() / 1000;
const easeOut = (u) => 1 - (1 - u) * (1 - u);
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
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
  state.guardZone = ZONES[rng.int(0, ZONES.length - 1)]; state.open = 0; state.riposte = 0;
  state.sh.hits = TUNING.shield.hits; state.sh.broken = false;
}

function nextGap() { const S = TUNING.swing; return S.gap + state.rng.range(0, S.gapSpread); }

function newRound(E, seed) {
  Object.assign(state, {
    seed, rng: makeRng(seed ^ 0x9e3779b9), rack: 0, t: TUNING.roundTime, m: 0, stop: 0, kickA: 0, kickV: 0,
    hearts: TUNING.hearts, endT: 0, dodgeT: 0, dodgeCool: 0, away: false, stepT: 0, hurt: 0, done: false,
    stamina: TUNING.stamina.max, lastAtk: -9, riposte: 0, open: 0,
    gapHits: 0, clangs: 0, broken: 0, overheads: 0, jabs: 0, slashes: 0, blocks: 0, perfects: 0, dodges: 0, staOuts: 0, counters: 0, counterHits: 0, taken: 0, felled: 0,
    fx: [], pops: [], streaks: [], trail: [],
    you: { dx: 0, a: 0, kick: 0, kickV: 0, back: 0, hopX: 0, hopY: 0, tvx: 0, parts: makeParts(makeRng(seed ^ 0x5bd1e995), ['armF']), fr: {} },
    foe: {},
    crowd: [],
    sh: { down: false, id: -1, sx: 0, sy: 0, x: 0, y: 0, minX: 0, hist: [], t: -1, cool: 0, up: 0, hits: TUNING.shield.hits, broken: false, flash: 0 },
    hand: { down: false, id: -1, fx: 0, fy: 0, tgx: 0, tgy: 0, ux: 0, uy: 0, pux: 0, puy: 0, hx: 0, hy: 0, phx: 0, phy: 0, ex: 0, ey: 0, sx: 0, sy: 0, bx: 1, by: 0, ang: 0, pang: 0, ph: 0, e: 1, vx: 0, vy: 0, along: 0, hvx: 0, hvy: 0, lock: 0, grip: 0, sp: 0, hist: [], raisedT: -9, atk: null },
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
  let th = guardUp() ? state.guardZone.guard + 0.05 * Math.sin(state.m * 3) : REST_TH + 0.08 * Math.sin(state.m * 3);
  if (!sw && state.open > 0 && fall === 0) lean += 0.1;
  if (sw) {
    const z = sw.zone;
    if (sw.fin > 0) {
      const v = clamp((0.4 - sw.fin) / 0.12, 0, 1), back = clamp(sw.fin / 0.2, 0, 1);
      th = z.cock + (z.end - z.cock) * v * v;
      lunge = S.lunge * easeOut(v) * back; lean += 0.22 * easeOut(v) * back;
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

function guardUp() { return !state.sw && state.open <= 0 && state.stun <= 0 && state.stagger <= 0 && state.fallT <= 0; }
const guarded = (p) => guardUp() && state.guardZone.cover.includes(p.d.id);
const covered = (p) => p.armour || guarded(p);
const raised = () => state.sh.t >= 0 && state.sh.t < TUNING.shield.dur;

function poseYou(E, dt) {
  const L = lay(E), y = state.you, D = TUNING.dodge, h = state.hand, sh = state.sh;
  const want = state.away ? 1 : 0;
  y.back += (want - y.back) * (1 - Math.exp(-dt / (want ? 0.05 : 0.14)));
  const u = state.dodgeT > 0 ? 1 - state.dodgeT / D.dur : 1;
  y.hopX = -D.back * L.H * y.back;
  y.hopY = state.dodgeT > 0 ? -D.hop * L.H * Math.sin(Math.PI * u) : 0;
  y.kickV += (-y.kick * 90 - y.kickV * 7) * dt; y.kick += y.kickV * dt;
  const S0x = L.x0 + SHOULDER[0] * L.H, LN = TUNING.lean, ST = TUNING.step;
  let leanT = clamp(((h.tgx - S0x) / (0.8 * L.H) - 0.3) * LN.gain, LN.min, LN.max) + clamp(y.tvx / LN.vel, -0.18, 0.18);
  if (!h.down && h.lock <= 0) leanT = 0.05;
  leanT -= 0.22 * y.back;
  y.a += (leanT - y.a) * (1 - Math.exp(-dt / LN.tau));
  const stepT = (h.down || h.lock > 0) && !state.away ? clamp((h.tgx - S0x - ST.from * L.H) * ST.gain, 0, ST.max * L.H) : 0;
  y.dx += (stepT - y.dx) * (1 - Math.exp(-dt / ST.tau));
  sh.up += ((raised() ? 1 : 0) - sh.up) * (1 - Math.exp(-dt / (raised() ? 0.045 : 0.12)));
  y.fr = { armB: { ox: PARTS[4].joint[0], oy: PARTS[4].joint[1], rot: shieldTh() - Math.PI / 2 + 0.05 * Math.sin(state.m * 1.9) } };
}
const shieldTh = () => lerp(1.69, -0.15, state.sh.up);

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

// ----- the sword arm: the aim point follows the finger, the arm stays straight on a circle round the shoulder and bends when the finger draws in -----
function solveArm(E, dt) {
  const h = state.hand, L = lay(E), A = TUNING.arm, G = TUNING.grip, H = L.H;
  const [sx, sy] = toScreen(youF(E), SHOULDER[0], SHOULDER[1]);
  const arm = A.len * H, blade = TUNING.blade.len * H;
  const ax = h.tgx - sx, ay = h.tgy - sy, d = Math.hypot(ax, ay) || 1, dx = ax / d, dy = ay / d;
  const e = clamp((d / H - A.chamberAt) / (A.straightAt - A.chamberAt), 0, 1);
  const r = arm * (A.minFrac + (A.full - A.minFrac) * e);
  h.e = e; h.sx = sx; h.sy = sy; h.ang = Math.atan2(dy, dx);
  h.hx = sx + dx * r; h.hy = sy + dy * r;
  const half = r / 2, bend = Math.sqrt(Math.max(0, (arm / 2) ** 2 - half * half));
  let nx = -dy, ny = dx; if (-0.3 * nx + ny < 0) { nx = -nx; ny = -ny; }
  h.ex = sx + dx * half + nx * bend; h.ey = sy + dy * half + ny * bend;
  // the blade hangs from the fist: up from the arm line, more so when chambered, along the line in a thrust, trailing a swing
  const omega = dt > 0 ? wrap(h.ang - h.pang) / dt : 0; h.pang = h.ang;
  const thrust = clamp(h.along / 700, 0, 1);
  const tg = h.ang + (G.straight + (G.chamber - G.straight) * (1 - e)) * (1 - thrust) - clamp(omega * G.trail, -0.5, 0.5);
  h.ph = dt > 0 ? h.ph + wrap(tg - h.ph) * (1 - Math.exp(-dt / G.tau)) : tg;
  h.bx = Math.cos(h.ph); h.by = Math.sin(h.ph);
  h.ux = h.hx + h.bx * blade; h.uy = h.hy + h.by * blade;
}

function moveHand(E, dt) {
  const h = state.hand, HT = TUNING.hand, L = lay(E), tired = state.stamina <= 0;
  h.pux = h.ux; h.puy = h.uy; h.phx = h.hx; h.phy = h.hy;
  if (h.lock > 0) {
    h.lock -= dt;
    h.tgx += h.hvx * dt; h.tgy += h.hvy * dt;
    const damp = Math.exp(-9 * dt); h.hvx *= damp; h.hvy *= damp;
    h.tgx = clamp(h.tgx, 10, E.w - 10); h.tgy = clamp(h.tgy, E.safe.top + 40, E.h - 10);
    if (h.lock <= 0) h.grip = 0.3;
  } else if (h.down) {
    const lag = (h.grip > 0 ? HT.regrip : HT.lag) * (tired ? HT.tiredLag : 1);
    const k = 1 - Math.exp(-dt / lag);
    h.tgx += (clamp(h.fx, 0, E.w) - h.tgx) * k; h.tgy += (h.fy - TUNING.offset - h.tgy) * k;
    if (h.grip > 0) h.grip -= dt;
  } else {
    const [sx, sy] = toScreen(youF(E), SHOULDER[0], SHOULDER[1]);
    const k = 1 - Math.exp(-dt / 0.09);
    h.tgx += (sx + HT.rest[0] * L.H - h.tgx) * k; h.tgy += (sy + HT.rest[1] * L.H - h.tgy) * k;
  }
  solveArm(E, dt);
  const iv = Math.max(dt, 0.001), vx = (h.ux - h.pux) / iv, vy = (h.uy - h.puy) / iv, inst = Math.hypot(vx, vy), kv = 1 - Math.exp(-dt / 0.03);
  h.vx += (vx - h.vx) * kv; h.vy += (vy - h.vy) * kv;
  h.along = h.vx * Math.cos(h.ang) + h.vy * Math.sin(h.ang);  // tip speed straight out from the shoulder
  state.you.tvx += (vx - state.you.tvx) * (1 - Math.exp(-dt / 0.06));
  h.sp = h.down && h.lock <= 0 ? h.sp * 0.5 + inst * 0.5 : 0;
  if (h.hy < h.sy - TUNING.attack.over.raise * L.H) h.raisedT = state.m;
  state.trail.push({ x: h.ux, y: h.uy, life: 0.12 });
  for (const q of state.trail) q.life -= dt;
  state.trail = state.trail.filter((q) => q.life > 0);
}

// An attack is born when the tip gets fast, and is named by how it moves: straight out from the shoulder (jab), down after the hand was above the head (overhead),
// up (a free raise, no blow), or any other arc (slash). The cost is paid then.
function updateAttack(E, dt) {
  const h = state.hand, T = TUNING, AT = T.attack, S = T.stamina;
  const live = h.down && h.lock <= 0 && !state.away && state.endT <= 0 && state.fallT <= 0;
  if (h.atk && (!live || h.sp < T.hit.minSpeed * 0.55)) h.atk = null;
  if (!h.atk && live && h.sp >= T.hit.minSpeed) {
    const spv = Math.hypot(h.vx, h.vy) || 1, ux = h.vx / spv, uy = h.vy / spv, along = (h.vx * Math.cos(h.ang) + h.vy * Math.sin(h.ang)) / spv;
    let kind = null;
    if (along > 0.85) { if (spv >= AT.jab.minSpeed) kind = 'jab'; }
    else if (uy > 0.25 && state.m - h.raisedT < AT.over.window) { if (spv >= AT.over.minSpeed) kind = 'over'; }
    else if (uy < -0.7) kind = 'raise';
    else kind = 'slash';
    if (kind === 'raise') h.atk = { kind, done: true };
    else if (kind) {
      const tired = state.stamina <= 0, cost = AT[kind].cost;
      state.stamina = Math.max(0, state.stamina - cost);
      if (state.stamina <= 0 && !tired) { state.staOuts++; pop(h.hx, h.hy - 30, 'OUT OF BREATH', '#fca5a5', 15); }
      state.lastAtk = state.m;
      h.atk = { kind, tired, done: false };
      if (kind === 'over') state.overheads++; else if (kind === 'jab') state.jabs++; else state.slashes++;
    }
  }
  if (!h.atk && state.m - state.lastAtk > S.delay) state.stamina = Math.min(S.max, state.stamina + S.regen * dt);
}

function checkHits(E) {
  const h = state.hand, T = TUNING, a = h.atk;
  if (!a || a.done || h.lock > 0 || state.fallT > 0 || state.endT > 0 || state.away) return;
  const need = a.kind === 'jab' ? T.attack.jab.minSpeed : a.kind === 'over' ? T.attack.over.minSpeed : T.hit.minSpeed;
  if (h.sp < need) return;
  const F = foeF(E), fm = state.foe, jab = a.kind === 'jab', pad = (jab ? T.blade.pad * 0.6 : T.blade.pad) / F.H;
  const found = new Map();
  for (const f of [1, 0.7, 0.4]) {
    const hx = h.phx + (h.hx - h.phx) * f, hy = h.phy + (h.hy - h.phy) * f, tx = h.pux + (h.ux - h.pux) * f, ty = h.puy + (h.uy - h.puy) * f;
    const k0 = jab ? 1 - T.blade.tip : 0, x0 = hx + (tx - hx) * k0, y0 = hy + (ty - hy) * k0;
    const n = Math.max(1, Math.ceil(Math.hypot(tx - x0, ty - y0) / 8));
    for (let i = 0; i <= n; i++) {
      const x = x0 + (tx - x0) * i / n, y = y0 + (ty - y0) * i / n;
      const [lx, ly] = toLocal(F, x, y);
      for (const p of fm.parts) {
        if (p.cool > 0 || p.cut || found.has(p)) continue;
        const [qx, qy] = partLocal(p, fm, lx, ly);
        if (inside(p.d, qx, qy, pad)) found.set(p, { x, y, lx: qx, ly: qy });
      }
    }
  }
  if (!found.size) return;
  const ang = Math.atan2(h.vy, h.vx), sp = h.sp, arr = [...found];
  const cov = arr.filter(([p]) => covered(p)), gaps = arr.filter(([p]) => !covered(p));
  let stop = 0;
  if (jab) {
    if (gaps.length) stop = gapHit(E, gaps[0][0], gaps[0][1], ang, sp, 0, a);
    else stop = bounce(E, cov[0][0], cov[0][1], ang, sp, a);
  } else if (cov.length) stop = bounce(E, cov[0][0], cov[0][1], ang, sp, a);
  else gaps.forEach(([p, at], i) => { stop = Math.max(stop, gapHit(E, p, at, ang, sp, i * 0.04, a)); });
  if (jab || a.kind === 'over') a.done = true;
  state.stop = Math.max(state.stop, stop);
}

function bounce(E, p, at, ang, sp, a) {
  const h = state.hand, A = TUNING.armour, J = TUNING.juice, AT = TUNING.attack[a.kind], glance = a.kind === 'jab';
  state.clangs++; p.clang = 0.25; p.cool = 0.3;
  const dn = p.armour && !glance ? AT.dents : 0;
  p.dents += dn;
  const rv = glance ? clamp(sp * 0.3, 200, 420) : clamp(sp * A.kick, 450, 1300);
  h.hvx = -Math.cos(ang) * rv; h.hvy = -Math.sin(ang) * rv; h.lock = AT.recoil; h.grip = 0; h.atk = null;
  const d = p.d, sz = d.shape === 'circle' ? d.r : Math.min(d.w, d.h) / 2;
  for (let c = 0; c < dn; c++) {
    const a0 = Math.random() * 6.28, pts = [[Math.cos(a0) * 0.1 * sz, Math.sin(a0) * 0.1 * sz]];
    for (let k = 1; k <= 4; k++) { const b = a0 + (Math.random() - 0.5) * 0.9; pts.push([pts[0][0] + Math.cos(b) * sz * 0.5 * k * (0.8 + Math.random() * 0.4), pts[0][1] + Math.sin(b) * sz * 0.5 * k * (0.8 + Math.random() * 0.4)]); }
    p.cracks.push(pts);
  }
  sparks(at.x, at.y, ang + Math.PI, glance ? 8 : 24); ring(at.x, at.y, glance ? 24 : 44, '#cbd5e1');
  clangSound(E, 0); E.shake(glance ? 2 : 6, 0.12); E.haptic(glance ? 8 : 24);
  let stop = glance ? 0.01 : J.stopClang + 0.02;
  if (p.armour && p.dents >= A.dents) {
    p.armour = false; state.broken++;
    const [sx, sy] = partCenter(foeF(E), state.foe, p);
    plateBits(sx, sy, 9); ring(sx, sy, 70, '#ffe9a8'); pop(sx, sy - 24, 'PLATE BROKEN', '#ffe9a8', 17);
    E.audio.beep({ freq: 110, dur: 0.25, type: 'sine', slide: 0.4, gain: 0.3 }); E.shake(8, 0.2); E.haptic(30);
    stop = J.stopBreak + 0.04;
  } else pop(at.x, at.y - 18, glance ? 'GLANCE' : !p.armour ? 'GUARDED' : p.dents >= A.dents - 1 ? 'DENT!' : 'CLANG', '#9aa4b2', glance ? 13 : 16);
  if (!glance) counter(E);
  return stop;
}

function counter(E) {
  if (state.sw || state.fallT > 0 || state.stun > 0 || state.endT > 0 || state.stagger > 0) return;
  startSwing(true); state.counters++;
  const Ff = foeF(E); pop(Ff.x, Ff.y - 1.0 * Ff.H, 'COUNTER!', '#ff8a7a', 20);
}

function gapHit(E, p, at, ang, sp, delay, a) {
  const T = TUNING, J = T.juice, AT = T.attack, kind = a.kind;
  let dmg = kind === 'jab' ? AT.jab.dmg : kind === 'over' ? AT.over.dmg : sp >= T.hit.mid ? AT.slash.fastDmg : AT.slash.dmg;
  if (a.tired) dmg = Math.max(1, Math.floor(dmg * T.stamina.tired));
  const rip = state.riposte > 0;
  if (rip) dmg *= T.shield.riposteMul;
  p.hp -= dmg; p.cool = T.hit.cool; p.flash = 0.16; state.gapHits++;
  const gl = kind === 'jab' ? 0.03 : 0.06;
  p.gashes.push([[at.lx - Math.cos(ang) * gl, at.ly - Math.sin(ang) * gl], [at.lx + Math.cos(ang) * gl, at.ly + Math.sin(ang) * gl]]);
  const big = dmg >= 3;
  const n = Math.min(60, J.strawPerDmg * dmg);
  straw(at.x, at.y, ang + Math.PI / 2, 2.6, 260 + dmg * 50, n >> 1);
  straw(at.x, at.y, ang - Math.PI / 2, 2.6, 260 + dmg * 50, n >> 1);
  dust(at.x, at.y, 3 + dmg * 3);
  sliceSound(E, delay, big);
  pop(at.x, at.y - 20, rip ? `RIPOSTE x${dmg}` : kind === 'jab' ? 'STAB' : kind === 'over' ? 'SMASH!' : dmg >= 2 ? 'HARD' : 'HIT', rip ? '#ffd24a' : big ? '#ffb347' : '#fff0b8', 15 + dmg * 5);
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
function startSwing(isCounter) {
  const S = TUNING.swing;
  const arms = state.foe.parts.filter((p) => (p.d.id === 'armF' || p.d.id === 'armB') && p.cut).length;
  const wind = (isCounter ? TUNING.counter.windup : S.windup) * (1 + TUNING.armSlow * arms);
  state.sw = { zone: ZONES[state.rng.int(0, ZONES.length - 1)], t: 0, wind, counter: !!isCounter, fin: 0, outcome: null };
}

// ----- the left thumb: a quick swipe forward raises the shield, a quick swipe back dodges -----
function shieldSwipe(E) {
  const s = state.sh, S = TUNING.swipe;
  if (!s.down || s.hist.length < 2) return;
  const last = s.hist[s.hist.length - 1];
  let first = s.hist[0];
  for (const q of s.hist) if (last.t - q.t <= S.span) { first = q; break; }
  const dx = last.x - first.x, dy = last.y - first.y, d = Math.hypot(dx, dy), dt = Math.max(0.03, last.t - first.t);
  if (d < S.minDist || d / dt < S.minSpeed || Math.abs(dx) < Math.abs(dy) * 1.3) return;
  s.hist.length = 0;
  if (dx > 0) raiseShield(E); else dodge(E);
}

function raiseShield(E) {
  const s = state.sh, Fy = youF(E);
  if (s.broken) { pop(Fy.x, Fy.y - 1.0 * Fy.H, 'NO SHIELD', '#94a3b8', 14); return; }
  if (raised() || s.cool > 0) return;
  s.t = 0; E.audio.beep({ freq: 260, dur: 0.07, type: 'triangle', slide: 1.5, gain: 0.12 }); E.haptic(8);
}

function dodge(E) {
  const D = TUNING.dodge, Fy = youF(E), s = state.sh, h = state.hand;
  if (state.away || state.dodgeCool > 0) return;
  if (state.stamina < D.cost) { pop(Fy.x, Fy.y - 1.0 * Fy.H, 'TOO TIRED', '#fca5a5', 16); return; }
  state.stamina -= D.cost; state.lastAtk = state.m;
  state.dodges++; state.away = true; state.stepT = 0; state.dodgeT = D.dur; state.dodgeCool = D.cool; s.minX = s.x; h.atk = null;
  pop(Fy.x, Fy.y - 1.0 * Fy.H, 'DODGE', '#7de3ff', 26); swooshSound(E, 0.16); E.haptic(12);
  dust(Fy.x, Fy.y, 8);
}

// Out of reach until the left thumb is moved forward and held.
function updateDefence(dt, E) {
  const s = state.sh, D = TUNING.dodge, S = TUNING.shield;
  if (s.t >= 0) { s.t += dt; if (s.t >= S.dur) { s.t = -1; s.cool = S.cool; } }
  s.cool = Math.max(0, s.cool - dt); s.flash = Math.max(0, s.flash - dt);
  state.dodgeCool = Math.max(0, state.dodgeCool - dt);
  if (state.away && state.dodgeT <= 0) {
    const fwd = s.down && s.x - s.minX > D.stepDist;
    state.stepT = fwd ? state.stepT + dt : Math.max(0, state.stepT - dt * 2);
    if (state.stepT >= D.stepIn) { state.away = false; state.stepT = 0; const Fy = youF(E); pop(Fy.x + 20, Fy.y - 1.0 * Fy.H, 'IN', '#7de3ff', 18); dust(Fy.x, Fy.y, 5); }
  }
}

function resolveSwing(E) {
  const sw = state.sw, L = lay(E), zy = zoneScreenY(L, sw.zone), Fy = youF(E), Ff = foeF(E), sh = state.sh, SH = TUNING.shield;
  sw.fin = 0.4; state.open = TUNING.open.dur;
  state.streaks.push({ x1: Ff.x - L.H * 0.3, y1: zy - 30, x2: Fy.x - L.H * 0.1, y2: zy + 20, life: 0.22, max: 0.22, red: !state.away });
  if (state.away) { sw.outcome = 'whiff'; swooshSound(E, 0.2); pop(E.w / 2, zy - 30, 'OUT OF REACH', '#7de3ff', 18); return; }
  if (raised()) {
    const perfect = sh.t <= SH.perfect, bx = Fy.x + 0.28 * L.H, by = zy;
    sw.outcome = 'block'; state.blocks++; sh.flash = 0.25;
    sparks(bx, by, 0, perfect ? 30 : 16); ring(bx, by, perfect ? 130 : 70, perfect ? '#ffd24a' : '#ffffff');
    if (perfect) {
      state.perfects++; state.stagger = SH.stagger; state.riposte = SH.riposte;
      parrySound(E); E.shake(10, 0.2); E.haptic(35); E.flash('#fff0b8', 0.1); E.audio.play('coin');
      state.stop = Math.max(state.stop, 0.12);
      pop(bx, by - 40, 'PERFECT BLOCK', '#ffd24a', 28); pop(bx + 30, by - 70, 'RIPOSTE!', '#ffd24a', 18);
      state.kickV += -0.8;
    } else {
      sh.hits--;
      clangSound(E, 0); E.shake(6, 0.15); E.haptic(22); state.stop = Math.max(state.stop, 0.06);
      pop(bx, by - 40, 'BLOCK', '#ffffff', 24);
      state.you.kickV -= 3;
      if (sh.hits <= 0) {
        sh.broken = true; sh.t = -1; sh.up = 0;
        plateBits(bx, by, 12); pop(bx, by - 70, 'SHIELD BROKEN', '#ff9f43', 22); E.shake(9, 0.2);
        E.audio.beep({ freq: 110, dur: 0.25, type: 'sine', slide: 0.4, gain: 0.3 });
      }
    }
    return;
  }
  sw.outcome = 'hit'; state.hearts--; state.taken++; state.hurt = 0.4; if (sw.counter) state.counterHits++;
  E.flash('#ff2a2a', 0.3); E.shake(16, 0.35); E.haptic(70);
  E.audio.play('boom'); E.audio.play('lose', 0.5);
  pop(Fy.x, zy - 40, 'OUCH', '#ff5a4a', 34);
  state.you.kickV -= 7;
  state.hand.lock = Math.max(state.hand.lock, 0.2); state.hand.hvx = -200; state.hand.hvy = 120; state.hand.atk = null;
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
  if (state.swingIn <= 0 && state.endT <= 0) startSwing(false);
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

// Your sword arm and gladius, in screen space. The blade is a leaf: broad, tapering to a point.
function drawSwordArm(ctx, E) {
  const h = state.hand, H = lay(E).H, locked = h.lock > 0, blade = TUNING.blade.len * H, w = 0.034 * H;
  const bx = h.bx, by = h.by, nx = -by, ny = bx;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (state.trail.length > 1 && h.sp >= TUNING.hit.minSpeed) {
    ctx.strokeStyle = 'rgba(125,227,255,0.35)'; ctx.lineWidth = 8; ctx.beginPath();
    state.trail.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
  }
  limb(ctx, [[h.sx, h.sy], [h.ex, h.ey], [h.hx, h.hy]], 0.075 * H, YOU.skin);
  ctx.fillStyle = YOU.tunic; ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(h.sx, h.sy, 0.058 * H, 0, 6.28); ctx.fill(); ctx.stroke();
  // grip, pommel, crossguard
  ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(h.hx - bx * 0.07 * H, h.hy - by * 0.07 * H); ctx.lineTo(h.hx + bx * 0.04 * H, h.hy + by * 0.04 * H); ctx.stroke();
  ctx.fillStyle = '#c9a43a'; ctx.beginPath(); ctx.arc(h.hx - bx * 0.08 * H, h.hy - by * 0.08 * H, 5, 0, 6.28); ctx.fill();
  const gx = h.hx + bx * 0.05 * H, gy = h.hy + by * 0.05 * H;
  ctx.strokeStyle = '#c9a43a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(gx - nx * 0.05 * H, gy - ny * 0.05 * H); ctx.lineTo(gx + nx * 0.05 * H, gy + ny * 0.05 * H); ctx.stroke();
  const a = h.atk, hot = a && !a.done && h.sp >= TUNING.hit.minSpeed && !locked;
  const P = (t, s) => [gx + bx * blade * t + nx * w * s, gy + by * blade * t + ny * w * s];
  const poly = [P(0, -0.8), P(0.3, -1), P(0.72, -0.7), P(1, 0), P(0.72, 0.7), P(0.3, 1), P(0, 0.8)];
  const draw = () => { ctx.beginPath(); poly.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); };
  if (hot) { ctx.strokeStyle = a.kind === 'over' ? 'rgba(255,200,90,0.5)' : 'rgba(125,227,255,0.45)'; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(h.ux, h.uy); ctx.stroke(); }
  draw(); ctx.fillStyle = locked ? '#ff8a7a' : '#dfe6ee'; ctx.fill(); ctx.strokeStyle = '#1b2026'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(gx + bx * 6, gy + by * 6); ctx.lineTo(h.ux - bx * 6, h.uy - by * 6); ctx.stroke();
  if (hot && a.kind === 'jab') { ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(h.ux, h.uy, 6, 0, 6.28); ctx.fill(); }
  ctx.fillStyle = YOU.skin; ctx.beginPath(); ctx.arc(h.hx, h.hy, 0.042 * H, 0, 6.28); ctx.fill();
  ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = 2; ctx.stroke();
  if (h.down) {
    ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(h.fx, h.fy); ctx.lineTo(h.fx, h.fy - TUNING.offset); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(h.fx, h.fy, 14, 0, 6.28); ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.stroke();
  }
  if (a && a.kind !== 'raise' && !locked) E.text(a.kind === 'over' ? 'OVERHEAD' : a.kind.toUpperCase(), h.hx, h.hy - 0.12 * H, { size: 11, color: '#e2e8f0', alpha: 0.7, weight: '700' });
  if (locked) E.text('X', h.ux, h.uy - 22, { size: 22, color: '#ff8a7a', weight: '800' });
}

// Your off arm and the round shield: hanging at the hip when down, up across the chest when raised, cracked as it wears.
function drawShield(ctx, E) {
  const sh = state.sh, Fy = youF(E), H = Fy.H, J = PARTS[4].joint, th = shieldTh();
  if (sh.broken) return;
  const [hx, hy] = toScreen(Fy, J[0] + 0.3 * Math.cos(th), J[1] + 0.3 * Math.sin(th));
  const [sx, sy] = toScreen(Fy, J[0], J[1]);
  const r = lerp(0.11, 0.2, sh.up) * H, cx = hx + lerp(0.0, 0.06, sh.up) * H, cy = hy;
  limb(ctx, [[sx, sy], [hx, hy]], 0.07 * H, YOU.skin);
  ctx.save(); ctx.translate(cx, cy);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#b9803a'); g.addColorStop(1, '#6d4519');
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.28); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = sh.flash > 0 ? '#ffffff' : '#2a1c10'; ctx.lineWidth = 4; ctx.stroke();
  ctx.strokeStyle = '#d6b04a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r * 0.82, 0, 6.28); ctx.stroke();
  ctx.fillStyle = '#c9a43a'; ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, 6.28); ctx.fill(); ctx.stroke();
  const worn = TUNING.shield.hits - sh.hits;
  ctx.strokeStyle = '#1a120a'; ctx.lineWidth = 2;
  for (let i = 0; i < worn; i++) { const a = i * 1.7 + 0.5; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.25, Math.sin(a) * r * 0.25); ctx.lineTo(Math.cos(a + 0.2) * r * 0.65, Math.sin(a + 0.2) * r * 0.65); ctx.lineTo(Math.cos(a - 0.1) * r * 0.95, Math.sin(a - 0.1) * r * 0.95); ctx.stroke(); }
  if (sh.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${sh.flash / 0.25 * 0.5})`; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.28); ctx.fill(); }
  ctx.restore();
}

// The foe's guard: the parts his arm covers, outlined, plus the OPEN flag while he recovers.
function drawGuard(ctx, E) {
  if (state.fallT > 0) return;
  const F = foeF(E), H = F.H;
  if (guardUp()) {
    ctx.save(); ctx.translate(F.x, F.y); ctx.scale(F.dir, 1); ctx.rotate(F.a);
    for (const p of state.foe.parts) {
      if (p.cut || !state.guardZone.cover.includes(p.d.id)) continue;
      path(ctx, p.d, H, -0.012); ctx.fillStyle = 'rgba(125,211,252,0.22)'; ctx.fill();
      ctx.setLineDash([6, 4]); ctx.strokeStyle = '#7dd3fc'; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
    const [gx, gy] = toScreen(F, 0.28, state.guardZone.y - 0.1);
    E.text('GUARD', gx, gy, { size: 11, color: '#7dd3fc', weight: '700', alpha: 0.9 });
  } else if (state.open > 0 && !state.sw) {
    const [ox, oy] = toScreen(F, 0.03, -1.02), k = state.open / TUNING.open.dur;
    E.text('OPEN', ox, oy, { size: 20, color: '#ffd24a', weight: '800', alpha: 0.5 + 0.5 * k });
    ctx.fillStyle = 'rgba(255,210,74,0.8)'; ctx.fillRect(ox - 24, oy + 10, 48 * k, 4);
  }
}

// The foe's tell: a band at the height of the coming blow. The label says what to do, and turns gold in the perfect-block window.
function drawZone(ctx, E) {
  const sw = state.sw;
  if (!sw || sw.fin > 0) return;
  const L = lay(E), SH = TUNING.shield, Fy = youF(E), Ff = foeF(E);
  const y = zoneScreenY(L, sw.zone), bh = 0.11 * L.H;
  const x0 = Fy.x - 0.2 * L.H, x1 = Ff.x - 0.1 * L.H, w = x1 - x0;
  const left = sw.wind - sw.t, inWin = left <= SH.dur, perfect = left <= SH.perfect;
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
  E.text(perfect ? 'BLOCK NOW' : inWin ? 'BLOCK' : sw.counter ? 'COUNTER' : sw.zone.label, (x0 + x1) / 2, y - bh - 10, { size: 18, weight: '800', color: `rgb(${rgb})` });
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
    E.text('Right thumb: sword. Draw back, then jab out; slash; raise the hand and bring it down.', E.w / 2, E.h * 0.22 + 40, { size: 14, color: '#9aa4b2' });
    E.text('Left thumb: swipe right to raise the shield, left to dodge. Aim for the gaps.', E.w / 2, E.h * 0.22 + 62, { size: 14, color: '#9aa4b2' });
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
  const [sx, sy] = toScreen(youF(E), SHOULDER[0], SHOULDER[1]);
  h.tgx = sx + TUNING.hand.rest[0] * L.H; h.tgy = sy + TUNING.hand.rest[1] * L.H;
  h.pang = Math.atan2(h.tgy - sy, h.tgx - sx);
  solveArm(E, 0);
  h.pux = h.ux; h.puy = h.uy; h.phx = h.hx; h.phy = h.hy; state.you.a = 0.05;
  poseYou(E, 0.016);
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
    state.dodgeT = Math.max(0, state.dodgeT - dt);
    state.hurt = Math.max(0, state.hurt - dt);
    if (state.stagger > 0) state.stagger -= dt;
    state.riposte = Math.max(0, state.riposte - dt);
    if (state.open > 0) { state.open -= dt; if (state.open <= 0) state.guardZone = ZONES[state.rng.int(0, ZONES.length - 1)]; }

    poseFoe(E, dt);
    poseYou(E, dt);
    moveHand(E, dt);
    updateAttack(E, dt);
    checkHits(E);
    updateSwing(dt, E);
    updateDefence(dt, E);
    poseFoe(E, 0);

    if (state.fallT > 0) {
      state.fallT += dt;
      if (state.fallT >= TUNING.resetDelay) { state.rack++; newRack(E); poseFoe(E, 0.016); pop(E.w * 0.7, E.h * 0.3, 'NEW FOE', '#e6c866', 20); if (state.sh.broken === false) pop(E.w * 0.2, E.h * 0.3, 'SHIELD MENDED', '#e6c866', 14); }
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
    const r = { gapHits: state.gapHits, clangs: state.clangs, broken: state.broken, overheads: state.overheads, jabs: state.jabs, slashes: state.slashes, blocks: state.blocks, perfects: state.perfects, dodges: state.dodges, staOuts: state.staOuts, counters: state.counters, counterHits: state.counterHits, taken: state.taken, felled: state.felled };
    E.ledger.add('result', { ...r, hearts: state.hearts, left: Math.round(state.t) });
    E.setScene('over', { ...r, hearts: state.hearts, best: Math.max(best, state.gapHits), isNew });
  },
  // two thumbs: a touch that starts in the left third is the shield thumb, any other is the sword thumb
  onPointerDown(p, E) {
    if (state.endT > 0) return;
    if (p.startX < E.w / 3) {
      const s = state.sh;
      if (s.down) return;
      s.down = true; s.id = p.id; s.sx = s.x = s.minX = p.x; s.sy = s.y = p.y; s.hist = [{ x: p.x, y: p.y, t: now() }];
      return;
    }
    const h = state.hand;
    if (h.down) return;
    h.down = true; h.id = p.id; h.fx = p.x; h.fy = p.y; h.hist = [{ x: p.x, y: p.y, t: now() }];
    if (h.lock <= 0) {
      h.tgx = p.x; h.tgy = p.y - TUNING.offset; h.grip = 0; solveArm(E, 0);
      h.pux = h.ux; h.puy = h.uy; h.phx = h.hx; h.phy = h.hy; h.sp = 0; h.vx = h.vy = 0;
    }
  },
  onPointerMove(p, E) {
    const s = state.sh, h = state.hand, t = now();
    if (s.down && s.id === p.id) {
      s.x = p.x; s.y = p.y; s.minX = Math.min(s.minX, p.x);
      s.hist.push({ x: p.x, y: p.y, t });
      while (s.hist.length > 2 && t - s.hist[0].t > 0.35) s.hist.shift();
      shieldSwipe(E);
    } else if (h.down && h.id === p.id) {
      h.fx = p.x; h.fy = p.y;
    }
  },
  onPointerUp(p) {
    const s = state.sh, h = state.hand;
    if (s.down && s.id === p.id) { s.down = false; s.hist = []; }
    else if (h.down && h.id === p.id) { h.down = false; h.hist = []; h.sp = 0; h.atk = null; }
  },
  render(ctx, E) {
    ctx.save();
    drawBackground(ctx, E);
    drawFighter(ctx, E, youF(E), state.you, YOU, 'you');
    drawFighter(ctx, E, foeF(E), state.foe, FOE, 'foe');
    drawGuard(ctx, E);
    drawZone(ctx, E);
    drawShield(ctx, E);
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
    const top = 10 + E.safe.top, l = 16 + E.safe.left, r = 16 + E.safe.right, TS = TUNING.stamina, SHD = TUNING.shield;
    const secs = Math.max(0, Math.ceil(state.t));
    E.text(`0:${String(secs).padStart(2, '0')}`, l, top + 14, { size: 24, align: 'left', weight: '800', color: secs <= 5 ? '#ef4444' : '#e6e6e6' });
    E.text(`${state.felled} felled`, l, top + 38, { size: 12, align: 'left', color: '#c4b99a' });
    E.text(`${state.gapHits}`, E.w / 2, top + 14, { size: 34, weight: '800', color: '#ffd24a' });
    E.text('gap hits', E.w / 2, top + 38, { size: 11, color: '#c4b99a' });
    for (let i = 0; i < TUNING.hearts; i++) E.text('\u2665', E.w - r - 10 - i * 26, top + 14, { size: 26, color: i < state.hearts ? '#ef4444' : '#3b3f46' });
    const bw = 110, bx = E.w - r - bw, sf = state.stamina / TS.max;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(bx - 1, top + 29, bw + 2, 11);
    ctx.fillStyle = state.stamina <= 0 ? '#ef4444' : sf < 0.25 ? '#f59e0b' : '#4ade80'; ctx.fillRect(bx, top + 30, bw * sf, 9);
    E.text('stamina', bx - 6, top + 36, { size: 10, align: 'right', color: '#c4b99a' });
    for (let i = 0; i < SHD.hits; i++) {
      ctx.fillStyle = state.sh.broken ? '#3b3f46' : i < state.sh.hits ? '#d6a24a' : '#3b3f46';
      ctx.fillRect(bx + i * (bw / SHD.hits), top + 60, bw / SHD.hits - 4, 7);
    }
    E.text(state.sh.broken ? 'shield broken' : 'shield', bx - 6, top + 66, { size: 10, align: 'right', color: state.sh.broken ? '#ef4444' : '#c4b99a' });
    if (state.dodgeCool > 0 || state.away) E.text(state.away ? 'hold left thumb forward to step in' : 'dodge', bx + bw, top + 80, { size: 10, align: 'right', color: '#7de3ff' });
    if (state.riposte > 0) E.text('RIPOSTE x2', E.w / 2, top + 62, { size: 16, weight: '800', color: '#ffd24a' });
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(0, top + 50, E.w * 0.3, 3);
    ctx.fillStyle = '#e6c866'; ctx.fillRect(0, top + 50, E.w * 0.3 * clamp(state.t / TUNING.roundTime, 0, 1), 3);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(E.w / 3, E.h * 0.45, 1, E.h * 0.5);
    E.text('SHIELD', E.w / 6, E.h - 18 - E.safe.bottom, { size: 12, weight: '700', color: '#f0e6cc', alpha: 0.35 });
    if (state.t > TUNING.roundTime - 8) E.text('left thumb: swipe right = shield, swipe left = dodge  |  right thumb: sword', E.w / 2, E.h - 8 - E.safe.bottom, { size: 12, color: '#f0e6cc', alpha: clamp((state.t - (TUNING.roundTime - 8)) / 1.5 + 0.2, 0, 1) });
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
    const lines = [`${p.overheads} overheads | ${p.jabs} jabs | ${p.slashes} slashes`, `${p.clangs} clangs | ${p.broken} plates broken`, `${p.blocks} blocks (${p.perfects} perfect) | ${p.dodges} dodges`, `${p.staOuts} stamina-outs | ${p.counters} counters (${p.counterHits} hit)`, `${p.taken} hits taken | ${p.felled} foes felled`];
    lines.forEach((s, i) => E.text(s, rx, y - 12 + i * 23, { size: 14, color: '#cbd5e1' }));
    this.btnAgain = E.button('Again', rx - 72, E.h * 0.74, { w: 130, h: 52, size: 20 });
    this.btnMenu = E.button('Menu', rx + 72, E.h * 0.74, { w: 130, h: 52, size: 20, fill: '#334155' });
  },
  onTap(p, E) {
    if (this.btnAgain && E.hit(this.btnAgain, p)) E.setScene('play', { seed: (Math.random() * 2 ** 32) >>> 0 });
    else if (this.btnMenu && E.hit(this.btnMenu, p)) E.setScene('menu');
  },
};

const STD = { offset: 70, 'hand.lag': 0.035, 'hit.minSpeed': 450, 'stamina.regen': 32, 'attack.over.cost': 28, 'shield.perfect': 0.15, 'shield.hits': 4, 'open.dur': 0.8, 'swing.windup': 0.7, 'swing.gap': 2.0, 'dodge.cost': 30 };

export const game = {
  slug: 'arena',
  title: 'Arena',
  saveVersion: 1,
  migrate(data, fromVersion) { return data; },
  TUNING,
  experiments: [
    { key: 'offset', label: 'Aim offset (px)', min: 0, max: 130, step: 5 },
    { key: 'hand.lag', label: 'Hand weight (s)', min: 0.005, max: 0.12, step: 0.005 },
    { key: 'hit.minSpeed', label: 'Min hit speed (px/s)', min: 200, max: 1200, step: 25 },
    { key: 'stamina.regen', label: 'Stamina regen (/s)', min: 10, max: 80, step: 2 },
    { key: 'attack.over.cost', label: 'Overhead cost', min: 5, max: 60, step: 1 },
    { key: 'shield.perfect', label: 'Perfect block window (s)', min: 0.05, max: 0.4, step: 0.01 },
    { key: 'shield.hits', label: 'Shield blocks to break', min: 1, max: 8, step: 1 },
    { key: 'open.dur', label: 'Foe opening (s)', min: 0.3, max: 1.6, step: 0.1 },
    { key: 'swing.windup', label: 'Wind-up (s)', min: 0.4, max: 1.2, step: 0.05 },
    { key: 'swing.gap', label: 'Swing interval (s)', min: 0.8, max: 4, step: 0.1 },
    { key: 'dodge.cost', label: 'Dodge cost', min: 5, max: 70, step: 1 },
  ],
  presets: [
    { label: 'Gentle', values: { ...STD, 'stamina.regen': 45, 'attack.over.cost': 20, 'shield.perfect': 0.25, 'shield.hits': 6, 'open.dur': 1.1, 'swing.windup': 0.95, 'swing.gap': 3.2, 'hit.minSpeed': 400, 'dodge.cost': 22 } },
    { label: 'Standard', values: { ...STD } },
    { label: 'Brutal', values: { ...STD, 'stamina.regen': 22, 'attack.over.cost': 34, 'shield.perfect': 0.1, 'shield.hits': 3, 'open.dur': 0.6, 'swing.windup': 0.55, 'swing.gap': 1.3, 'hit.minSpeed': 600, 'dodge.cost': 40 } },
  ],
  start: 'menu',
  scenes: { menu, play, over },
};
