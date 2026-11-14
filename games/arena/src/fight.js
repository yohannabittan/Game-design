// Arena: Your fighter: the model and layout, footwork and defence, input, hit resolution and the juice.
// Split from game.js by tools/arena-split.mjs (ADR-0024). Only tuning.js and data.js may be read while modules load.

import { clamp, lerp, ease } from './engine.js';
import { TUNING } from './tuning.js';
import { pctOf, PARTS, FACE_SLOT, ARM_LEN, SHOULDER, BEAST_BODY, ZONES, ZONE, POSES, REST_TH, ZONE_PART, mkPart } from './data.js';
import { guardUp, covering, covered, foeHas, LIMB, limbName, lamed, setCover, memoryOn, blockRun, readJab, lungeRead, readPop, RANGED, SIG_NAME,
  spearOut, tagPop, startBlow, feintSwitch, spendFoe, windFoe, counter, settleFeint } from './foe.js';
import { C_, growth, topThird, staggerFoe, perfectWin, atWall, emit, netMul, favour, gainMom, addBleed } from './cards.js';
import { weaponKey, TAU, lerp2, hudRow } from './draw-fight.js';
import { boutTally, gradeBout, boutGold } from './screens.js';
import { popTop } from './scenes.js';
import { arenaT, bout, trait, drives, state, easeOut, wrap, ZERO, has, count, noDodge, noShield, busy, statMul, shake, meSize, meWeapon, meLag,
  nextGap } from './game.js';
import { yardLand, foeAt } from './features/yard.js';
import { bowShown, raisePt, bowPt } from './features/ranged.js';

// ====== FIGHTER MODEL: layout, your body and sword arm, footwork, defence, the foe's body ======
// ----- layout and frames -----
// In a pairs bout the waiting foe takes the screen's right edge, so the frame slides left (by the worst of the two foes in either place) until the one
// fighting keeps clear of him when he gives ground to his wall. A beast is long: in its bout the frame also shrinks (TUNING.beastFit) until it fits with
// a short slide, the beast at its home plus room, or the pair in either place. This is the unzoomed frame; the camera (frameAt) scales it.
function frame1(E) {
  const F = TUNING.fighter, f = state.foe, e = state.edge, kMax = Math.max(state.me ? meSize().scale : 1, f && f.size ? (f.beast ? drawK(f) * beastOf(f).tall : f.size.scale) : 1);
  let H = E.h * F.height * Math.min(1, F.fit / kMax);
  // the frame is centred on the space right of the left column (partly, so the foe keeps room too)
  const R = colRect(E), c0 = E.w / 2 + TUNING.col.frame * ((R.x + R.w + (E.w - E.safe.right)) / 2 - E.w / 2), g2 = E.w * F.gap / 2;
  const pair = !!(e && f && f.size && e.size), solo = !pair && !!(f && f.beast), lim = E.w - E.safe.right - (pair ? 4 : 12);
  // how far right of the frame's edge each arrangement reaches (H): the one fighting at his wall, and the one waiting
  const need = pair ? Math.max(reachR(f) + waitW(e), reachR(e) + waitW(f)) : solo ? f.home + TUNING.beastFit.room + rearOf(f) : 0;
  if ((f && f.beast) || (e && e.beast)) { const BF = TUNING.beastFit; H = clamp((lim - c0 - g2) / (F.body + need - BF.slide), H * BF.min, H); }
  return { H, g2, c0, lim, need, slide: pair || solo };
}
// Step 15, the fight camera: that frame zoomed out by z, every length in it (the gap between the marks too, so the fight in H is unchanged) scaled
// about its centre, then slid as above so a pair's waiting foe still stands clear
function frameAt(E, z, B = frame1(E)) {
  const H = B.H * z, g2 = B.g2 * z, half = g2 + TUNING.fighter.body * H, cx = B.c0 - (B.slide ? Math.max(0, B.c0 + half + B.need * H - B.lim) : 0);
  return { H, g2, cx, floor: E.h * TUNING.fighter.floor, x0: cx - half, x1: cx + half };
}
// what the camera must show at rest (px): your back foot and his (at his home), your blade at full reach with the lunge's stride, and his weapon's tip
function camSpan(E, L) {
  const f = state.foe, F = TUNING.fighter, k = meSize().scale, B = beastOf(f), kf = f.size ? drawK(f) : 1, yH = L.H * k, fH = L.H * kf;
  const yx = L.x0 - (k - 1) * F.body * L.H, fx = L.x1 + (f.home || 0) * L.H + (B ? kf * B.front - F.body : (kf - 1) * F.body) * L.H;
  const yBack = L.x0 + (F.body - (k - 1) * F.body - TUNING.pairs.fbody * k) * L.H, fBack = L.x1 + ((f.home || 0) - F.body + rearOf(f)) * L.H;
  const yTip = yx + (SHOULDER[0] + TUNING.arm.len * meSize().arm + TUNING.blade.len * meWeapon().reach + TUNING.lunge.stride) * yH;
  const fTip = B ? L.x1 + ((f.home || 0) - F.body) * L.H : fx - (SHOULDER[0] + ARM_LEN + (f.weapon.len || 0)) * fH;
  return [Math.min(yBack, fTip), Math.max(fBack, yTip)];
}
// the frame the camera eases to: TUNING.camera.rest, zoomed out further until camSpan fits right of the left column with the margin
const camKey = (E) => `${E.w}x${E.h}|${state.rack}`;
function camTarget(E) {
  const C = TUNING.camera, B = frame1(E), R = colRect(E), lo = R.x + R.w + C.margin, hi = E.w - E.safe.right - C.margin;
  let z = C.rest, L = frameAt(E, z, B);
  for (let i = 0; i < 3; i++) {
    const [a, b] = camSpan(E, L), k = Math.min(a < lo && a < L.cx ? (L.cx - lo) / (L.cx - a) : 1, b > hi && b > L.cx ? (hi - L.cx) / (b - L.cx) : 1);
    if (k >= 0.999 || z <= C.min) break;
    z = Math.max(C.min, z * k); L = frameAt(E, z, B);
  }
  return { ...L, z, key: camKey(E) };
}
// eased toward its target each frame (a new bout or a resize cuts straight to it); lay is what every drawing and hit reads
export function camUpdate(E, dt) {
  const t = camTarget(E), c = state.cam, k = 1 - Math.exp(-dt / TUNING.camera.ease);
  if (!c || c.key !== t.key) { state.cam = t; return; }
  for (const q of ['H', 'g2', 'cx', 'z']) c[q] = Math.abs(t[q] - c[q]) < 0.05 ? t[q] : c[q] + (t[q] - c[q]) * k;
  const half = c.g2 + TUNING.fighter.body * c.H;
  c.x0 = c.cx - half; c.x1 = c.cx + half;
}
export function lay(E) {
  if (!state.cam || state.cam.key !== camKey(E)) state.cam = camTarget(E);
  return state.cam;
}
// a beast's numbers (TUNING.beasts), or null for a man
export const beastOf = (f) => (f && f.beast ? TUNING.beasts[f.beast] : null);
// the scale a foe is drawn at: his band's, and a beast's body unit against a man's
export const drawK = (f) => f.size.scale * (f.beast ? TUNING.beasts[f.beast].draw : 1);
// how far a foe reaches behind the line a medium man's near edge stands on (H): a man's body, or a beast from nose to rump
export function rearOf(f) { const B = beastOf(f), k = drawK(f); return B ? k * (B.front + B.back) - TUNING.fighter.body : (k - 1) * TUNING.fighter.body + TUNING.pairs.fbody * k; }
// the one fighting in a pair, at his wall (his home and the room past it), and the one waiting at the edge: his centre from the edge, and his near half
const reachR = (f) => f.home + TUNING.pairs.room + rearOf(f);
export const pairScale = () => ((state.foe && state.foe.beast) || (state.edge && state.edge.beast) ? TUNING.pairs.beastScale : TUNING.pairs.scale);
export const edgeX = (f) => (f.beast ? beastOf(f).back + 0.06 : TUNING.pairs.x);
const waitW = (f) => (edgeX(f) + (f.beast ? beastOf(f).front : TUNING.pairs.body)) * drawK(f) * pairScale();
const waitLeft = (E, H, e) => E.w - E.safe.right - waitW(e) * H;
// you are drawn at your rolled size the same way: your near edge stays put
export function youF(E) { const L = lay(E), y = state.you, k = meSize().scale; return { x: L.x0 + state.foot.pos * L.H + y.lunge - y.push * L.H - (k - 1) * TUNING.fighter.body * L.H, y: L.floor + y.hopY, a: y.a, dir: 1, H: L.H * k }; }
// The arena's edges, in H from each fighter's mark: how far you can give ground (negative) and how far he can, trimmed so both stay on screen, then
// brought in by the arena's ring (the Pit's tight ring; the sparring bout keeps the full room).
// Step 15: the camera's zoom never widens the ring: each wall is the nearer of the one its frame trims it to and the unzoomed frame's.
export function walls(E) {
  const T = TUNING.foot, k = state.foe.size ? state.foe.size.scale : 1, ring = bout().spar ? 1 : arenaT().ring, f = state.foe;
  const room = (L) => [Math.min(T.room[0], Math.max(0.1, (L.x0 - 0.2 * L.H * meSize().scale - colRect(E).x - colRect(E).w - T.margin) / L.H)),
    state.edge && state.edge.size ? Math.min(T.room[1], Math.max(0.1, (waitLeft(E, L.H, state.edge) - 4 - L.x1 - rearOf(f) * L.H) / L.H))
      : Math.min(T.room[1], Math.max(0.1, (E.w - E.safe.right - (f.beast ? 12 : 24) - L.x1 - (f.beast ? rearOf(f) : 0.3 * k) * L.H) / L.H))];
  const [b0, f0] = room(lay(E)), [b1, f1] = room(frameAt(E, 1));
  return { back: -Math.min(b0, b1) * ring, fore: Math.min(f0, f1) * ring };
}
// the nearest the two can stand: the clear gap between the bodies at the marks, less a little air
export const gMin = (E) => { const L = lay(E); return -2 * L.g2 / L.H + TUNING.foot.close; };
// the gap between you now, in H, measured from where the marks put it
export const gapNow = () => state.step.x - state.foot.pos;
// your body's place in the same units: your feet plus the lunge's stride; his reach is measured to it
export const bodyPos = () => state.foot.pos + (state.you.lungeK * TUNING.lunge.stride + state.you.drive) * meSize().scale;
export const inReach = (extra = 0) => state.step.x - bodyPos() <= state.foe.strike + TUNING.foot.reach + extra;
export const myH = (E) => lay(E).H * meSize().scale;
export const myArm = (E) => TUNING.arm.len * myH(E) * meSize().arm;
export const myBlade = (E) => TUNING.blade.len * myH(E) * meWeapon().reach;
// the foe is drawn at his size: the frame's unit scales, his near edge (a beast's nose) stays where a medium fighter's would be
export function foeF(E) {
  const L = lay(E), f = state.foe, k = f.size ? drawK(f) : 1, B = beastOf(f);
  return { x: L.x1 + f.dx + (B ? k * B.front - TUNING.fighter.body : (k - 1) * TUNING.fighter.body) * L.H, y: L.floor + f.dy, a: f.a, dir: -1, H: L.H * k };
}
export function toScreen(F, lx, ly) {
  const c = Math.cos(F.a), s = Math.sin(F.a);
  return [F.x + F.dir * (lx * c - ly * s) * F.H, F.y + (lx * s + ly * c) * F.H];
}
export function toLocal(F, X, Y) {
  const ax = F.dir * (X - F.x) / F.H, ay = (Y - F.y) / F.H, c = Math.cos(F.a), s = Math.sin(F.a);
  return [ax * c + ay * s, -ax * s + ay * c];
}
export function partLocal(p, fm, lx, ly) {
  const fr = fm.fr[p.d.frame || p.d.id] || ZERO, dx = lx - fr.ox, dy = ly - fr.oy, c = Math.cos(fr.rot), s = Math.sin(fr.rot);
  return [dx * c + dy * s, -dx * s + dy * c];
}
export function partCenter(F, fm, p) {
  const fr = fm.fr[p.d.frame || p.d.id] || ZERO, c = Math.cos(fr.rot), s = Math.sin(fr.rot), d = p.d;
  return toScreen(F, fr.ox + d.x * c - d.y * s, fr.oy + d.x * s + d.y * c);
}
export function inside(d, lx, ly, pad) {
  if (d.shape === 'circle') return Math.hypot(lx - d.x, ly - d.y) <= d.r + pad;
  return Math.abs(lx - d.x) <= d.w / 2 + pad && Math.abs(ly - d.y) <= d.h / 2 + pad;
}
export const zoneScreenY = (L, zone) => L.floor + zone.y * L.H;

// the overhead line: the hand above it (TUNING.attack.over.raise H over the guard) is raised for an overhead
const overLine = (E) => guardPt(E)[1] - TUNING.attack.over.raise * myH(E);
// the guard: a relaxed, half-bent arm in front of the body, in screen px, on the body as it stands now
export function guardPt(E) {
  const H = myH(E), [sx, sy] = toScreen(youF(E), SHOULDER[0], SHOULDER[1]), g = TUNING.control.guard;
  return [sx + g[0] * H, sy + g[1] * H];
}
// thumb offset from the anchor, times the gain, px
function relOff() { const h = state.hand, G = TUNING.control.gain; return [(h.fx - h.ax) * G, (h.fy - h.ay) * G]; }
export function poseYou(E, dt) {
  const L = { H: myH(E) }, y = state.you, D = TUNING.dodge, h = state.hand, sh = state.sh;
  const LU = TUNING.lunge;
  state.burnT = Math.max(0, state.burnT - dt);
  // lunge: the thumb pushed far past the reach steps the gladiator in, up to a stride; he steps back when the hand relaxes or recoils
  let tk = 0;
  if (h.down && h.lock <= 0 && !state.away && state.exhaust <= 0 && state.endT <= 0 && state.fallT <= 0 && !(state.netT > 0 && TUNING.net.stuck)) {
    const [ox, oy] = relOff(), C = TUNING.control;
    tk = clamp((Math.hypot(ox, oy) / myArm(E) - C.lungeStart) / (C.lungeFull - C.lungeStart), 0, 1);
    // step 24c: an overhead is planted: while the hand is above the overhead line, and from the blow's birth through its recovery until the thumb
    // comes back inside the lunge's start, no lunge begins (one already begun ends where it is, with no step in)
    if (h.atk && h.atk.kind === 'over') state.plant = true; else if (tk < 0.05) state.plant = false;
    if (state.plant || h.hy < overLine(E)) { if (state.lunging) endLunge(E, false, true); tk = 0; }
    else if (tk > 0.1 && !state.lunging) {
      const lc = LU.cost;
      if (state.stamina >= lc) {
        state.stamina -= lc; state.lastAtk = state.m; state.lunging = true; state.lunges++; state.mem.lunges.push(state.m); state.jabRun = state.mem.jabs = 0; swooshSound(E, 0.1);
        const Fy = youF(E); dust(Fy.x - 0.1 * Fy.H, Fy.y, TUNING.juice.lungeDust);
        if (gapNow() > state.foe.strike + TUNING.foot.reach) chaseIn();
        state.lng = { t0: state.m, pk: tk, d: 0, at: 0, near: 0, committed: !has('myfeint'), hit: false, ly: tipLy(E), dd: beyondLunge(E) ? LU.driveFar : LU.driveNear };
        if (h.atk && !h.atk.done) h.atk.lunge = true;
      }
      else { tk = 0; tiredPop(E); }
    } else if (tk < 0.05) endLunge(E, true);
    if (state.lunging && state.lng) { commitLunge(E, Math.hypot(ox, oy), tk, dt); drive(E, tk, dt); }
  } else { endLunge(E); state.plant = false; }
  y.lungeK += (tk - y.lungeK) * (1 - Math.exp(-dt / (tk > y.lungeK ? LU.tauIn : LU.tauOut)));
  const dOn = driving();
  if (!state.lunging && y.drive > 0) { y.drive *= Math.exp(-dt / LU.driveOut); if (y.drive < 1e-3) y.drive = 0; }
  y.dk += ((dOn ? 1 : 0) - y.dk) * (1 - Math.exp(-dt / (dOn ? LU.tauIn : LU.driveOut)));
  y.lunge = (y.lungeK * LU.stride + y.drive) * L.H;
  const want = state.away ? 1 : 0;
  y.back += (want - y.back) * (1 - Math.exp(-dt / (want ? 0.05 : 0.14)));
  const u = state.dodgeT > 0 ? 1 - state.dodgeT / state.dodgeMax : 1;
  y.hopY = state.dodgeT > 0 ? -D.hop * L.H * Math.sin(Math.PI * u) : 0;
  y.push += ((state.pushT > 0 ? TUNING.moves.bash.push : 0) - y.push) * (1 - Math.exp(-dt / (state.pushT > 0 ? 0.05 : 0.25)));
  const LN = TUNING.lean, a = h.atk;
  // upright, sword leading; lean only on a fast slash whose aim lies past the straight arm's reach
  let leanT = LN.base;
  if (a && a.kind === 'slash' && h.down && h.lock <= 0 && h.sp >= TUNING.hit.mid * LN.fast) leanT += LN.max * clamp((Math.hypot(h.tgx - h.sx, h.tgy - h.sy) / L.H - LN.beyond) / LN.span, 0, 1);
  leanT = Math.min(leanT, LN.max) + LU.driveLean * y.dk - 0.22 * y.back;
  y.a += (leanT - y.a) * (1 - Math.exp(-dt / (leanT > y.a ? LN.tau : LN.back)));
  // step 24c: a raised hand barely leans you back
  if (h.hy < overLine(E)) y.a = Math.max(y.a, -TUNING.over.leanBack);
  sh.zy += (sh.zone.sy - sh.zy) * (1 - Math.exp(-dt / 0.05));
  sh.up += ((raised() ? 1 : 0) - sh.up) * (1 - Math.exp(-dt / (raised() ? 0.045 : 0.12)));
  const [cx, cy] = shieldPos();
  if (state.me.dual) {
    const D = TUNING.dual, k = state.offT > 0 ? Math.sin(Math.PI * (1 - state.offT / D.swing)) : 0, g = lerp(D.down, D.guard[ZONES.indexOf(sh.zone)], sh.up);
    y.offA = lerp(y.offA == null ? g : y.offA + (g - y.offA) * (1 - Math.exp(-dt / D.tau)), D.thrust, k);
  }
  y.fr = { armB: { ox: PARTS[4].joint[0], oy: PARTS[4].joint[1], rot: Math.atan2(cy - PARTS[4].joint[1], cx - PARTS[4].joint[0]) - Math.PI / 2 + 0.05 * Math.sin(state.m * 1.9) } };
}
// walking in is the lunge: its recovery plants your feet up to a pace forward, taking back ground you gave, never past your mark. A lunge pulled back with
// the thumb still down may be your own feint.
function endLunge(E, pulled, planted = false) {
  if (!state.lunging) return;
  state.lunging = false;
  // pulled back with the thumb down it may be a feint; anything else lands what the blade met
  const feint = pulled && ownFeint(E);
  if (!feint && state.lng && !state.lng.committed) commit(E);
  if (!feint && state.lng && !state.lng.hit && state.landM < state.lng.t0 && state.endT <= 0 && state.fallT <= 0 && !E.save.get('driveHint', 0)) state.lungeMiss = true;
  const T = TUNING.foot, ft = state.foot;
  if (ft.pos >= 0 || planted) return;
  ft.tgt = Math.min(0, Math.max(ft.tgt, ft.pos) + T.pace); ft.v = T.pace / T.gainDur * gripMul(); state.stepsIn++;
}
// The drive: a committed lunge (never a feint still open) held at full depth presses on in short stamping steps, burning stamina. Drawn back under full
// depth it holds its ground until the lunge ends; what the blade meets, an empty tank or his body ends it for good. The recovery gives the ground back.
export const driving = () => !!(state.lunging && state.lng && state.lng.dv && state.lng.dv.on && !state.lng.dEnd && state.lng.full >= state.lng.dd);
function drive(E, tk, dt) {
  const LU = TUNING.lunge, L = state.lng, y = state.you;
  if (!L.committed || L.dEnd) return;
  // what the blade met, in the lunge or the push that launched it, ends it
  if (L.hit || L.pend || state.landM > L.t0 - LU.driveNear) { L.dEnd = true; return; }
  // drawn back under full depth the body stops; going out again re-arms the drive
  if (tk < 1) { L.full = 0; if (L.dv) { L.dv.on = false; L.dv.t = 0; } return; }
  L.full = (L.full || 0) + dt;
  if (L.full < L.dd) return;
  const Fy = youF(E);
  if (!L.dv) L.dv = { t: 0, ph: 0, on: false };
  const D = L.dv, k = meSize().scale;
  D.t += dt; D.ph += dt * LU.driveHz;
  if (D.ph >= 1) { D.ph -= 1; stamp(E, Fy); }
  let v = LU.drive * Math.min(1, D.t / LU.driveRamp) * (1 + LU.driveSurge * Math.sin(TAU * D.ph)) * dt;
  // his body: stop a little short of it
  const room = Math.min(LU.driveMax - y.drive, (state.step.x - bodyPos() - gMin(E)) / k);
  if (v >= room) { v = Math.max(0, room); L.dEnd = true; }
  const cost = LU.driveCost * dt, sta0 = state.stamina;
  if (state.stamina <= cost) { v *= state.stamina / cost; state.stamina = 0; L.dEnd = true; } else state.stamina -= cost;
  if (v > 0 && !D.on) {
    // the body (re)starts moving: it carries the lunge's stab, its blade landing on what it reaches however slow the hand; a stab of its own pays a jab
    D.on = true;
    if (!L.counted) { L.counted = true; state.drives++; }
    state.burn = sta0;
    stamp(E, Fy);
    const h = state.hand;
    if (h.atk && !h.atk.done) h.atk.drive = true;
    else {
      const jc = TUNING.attack.jab.cost * meWeapon().cost;
      h.atk = { kind: 'jab', tired: state.stamina <= 0, done: false, cost: jc, drive: true };
      state.stamina = Math.max(0, state.stamina - jc);
    }
  }
  y.drive += v; state.driveDist += v; state.lastAtk = state.m; state.burnT = LU.driveBurn;
}
// Is he beyond what your plain lunge reaches? The clear air between the two fronts against the stride, your shoulder's lead and the arm and blade
// past it. A drive from beyond it starts at once (driveFar); within it the hold (driveNear) stays.
function beyondLunge(E) {
  const L = lay(E), B = TUNING.fighter.body, clear = (L.x1 - L.x0) + gapNow() * L.H - 2 * B * L.H;
  return clear > (TUNING.lunge.stride + SHOULDER[0] - B) * myH(E) + myArm(E) + myBlade(E);
}
const driveStab = (a) => !!a.drive && driving();
// each step of the drive plants the back foot: a kick of sand behind you and a dull footfall
function stamp(E, Fy) {
  const LU = TUNING.lunge, x = Fy.x - LU.driveFoot * Fy.H;
  sand(x, Fy.y, -1, LU.driveSand); dust(x, Fy.y, LU.driveDust);
  thud(E, LU.driveThud); E.haptic(LU.driveHaptic);
}
// your sword tip's height in his body units (y down, his feet at 0)
const tipLy = (E) => (state.foe && state.foe.size ? toLocal(foeF(E), state.hand.ux, state.hand.uy)[1] : 0);
// With the Feint worn, a lunge commits once the thumb settles at its furthest reach (or hold s after it began): what its blade met on the way (pend) lands
// then; until then its stab is kept (lungeStab). The furthest reach also marks the zone the tip threatened. Without the Feint a lunge commits at once.
function commitLunge(E, d, tk, dt) {
  const F = TUNING.myFeint, L = state.lng, slack = F.slack * myArm(E);
  if (tk > L.pk) L.pk = tk;
  if (d > L.d) { L.d = d; L.ly = tipLy(E); }
  // settled: the thumb has stayed in a slack-wide band at its furthest reach (moving further out or back starts the count again)
  if (d > L.at + slack || d < L.d - slack) { L.at = d; L.near = 0; } else L.near += dt;
  if (!L.committed && (L.near >= F.settle || state.m - L.t0 >= F.hold)) commit(E);
}
function commit(E) {
  const L = state.lng, a = state.hand.atk;
  L.committed = true;
  if (L.pend && a && !a.done) { a.done = true; state.stop = Math.max(state.stop, land(E, a, L.pend)); }
}
// the lunge's stab, kept alive while the lunge has not committed
const lungeStab = (a) => !!a.lunge && !!state.lng && !state.lng.committed;
// Your own feint (the Feint card): a lunge pulled back with the thumb still down before it committed. A blade that met any part or slot means a hit, never a
// feint; one held out until it commits is a lunge, landed or missed; one ended by lifting the thumb, too shallow, too quick (minAge) or while he swings never
// counts. He must be free to guard (not swinging, open, winded or stunned). It is not a lunge to his memory, but it costs a little stamina, and with his
// memory one too many in a while is read and countered (Unreadable: never). Returns whether it was a feint.
function ownFeint(E) {
  const F = TUNING.myFeint, L = state.lng;
  if (!has('myfeint') || !L || L.committed || L.hit || L.pend || L.pk < F.depth || state.m - L.t0 < F.minAge || !guardUp() || state.endT > 0) return false;
  const a = state.hand.atk;
  if (a && !a.done && a.cost) state.stamina = Math.min(state.staMax, state.stamina + a.cost);
  state.hand.atk = null; state.mem.lunges.pop();
  state.stamina = Math.max(0, state.stamina - F.cost); state.lastAtk = state.m;
  const zone = L.ly < F.high ? ZONE.high : L.ly > F.low ? ZONE.low : ZONE.mid, recent = state.mem.feints.filter((t) => state.m - t < F.learnWin).length;
  state.mem.feints.push(state.m); state.recT = state.m;
  if (memoryOn() && !has('unreadable') && recent >= F.learn) { state.feintsLearned++; readPop(E, 'READS YOUR FEINT'); counter(E); return true; }
  state.ownFeints++;
  fakeOut(E, zone);
  return true;
}
// He guards the zone you faked, and the open gap farthest from it opens for a moment (your feint, or a tell dodge with False Step)
export function fakeOut(E, zone) {
  const f = state.foe, prev = state.ownT, near = (q) => Math.abs(q.cy - zone.y);
  const body = f.parts.filter((q) => !q.slot && !q.cut).sort((a, b) => near(a) - near(b))[0];
  if (body && guardUp()) setCover(body);
  state.ownT = state.m;
  const Fy = youF(E); pop(Fy.x + 0.35 * Fy.H, Fy.y - 1.05 * Fy.H, 'FEINT!', '#c4b5fd', 22);
  const p = openGap(E, zone, growth('deceiver', 'trick', C_().deceiveOpen));
  E.audio.beep({ freq: 520, dur: 0.08, type: 'triangle', slide: 1.6, gain: 0.1 }); E.audio.noise({ dur: 0.04, gain: 0.08 }); E.haptic(10);
  emit(E, 'feint', { p, gap: state.m - prev });
}
// the open gap farthest from a zone opens for the feint's time (x k); returns it
function openGap(E, zone, k = 1) {
  const f = state.foe, near = (q) => Math.abs(q.cy - zone.y), p = f.parts.filter((q) => q.slot && !q.guard && !q.cut).sort((a, b) => near(b) - near(a))[0];
  state.gapOpen = p ? { p, t: TUNING.myFeint.open * k } : null;
  if (p) { const [x, y] = partCenter(foeF(E), f, p); pop(x, y - 26, `${p.d.label} OPEN`, '#ffd24a', 18); ring(x, y, 44, '#ffd24a'); }
  return p;
}
// the gap your feint opened, while it is open
export const openNow = (p) => !!state.gapOpen && state.gapOpen.p === p && state.gapOpen.t > 0;
// shield centre in body units: hanging at the hip, or raised to the zone
// (two blades: the off hand's follow-up reaches out and back over TUNING.dual.swing)
export function shieldPos() {
  // (step 24: the bow out, the far hand reaches for its string)
  if (state.bowNock && bowShown()) return state.bowNock;
  const sh = state.sh, J = PARTS[4].joint, p = [lerp(J[0] + 0.3 * Math.cos(1.69), 0.2, sh.up), lerp(J[1] + 0.3 * Math.sin(1.69), sh.zy, sh.up)], D = TUNING.dual;
  const k = state.me && state.me.dual && state.offT > 0 ? Math.sin(Math.PI * (1 - state.offT / D.swing)) : 0;
  return k ? lerp2(p, D.reach, k) : p;
}

// Step 24c: the arm's reach (px from the shoulder to the fist) that brings the middle of the weapon's striking part (its swing's first, TUNING.strike)
// down onto his head, its blade TUNING.over.lead ahead of the arm; null for fists, a weapon with no striking part in a swing, or no foe
export function overReach(E, sx, sy) {
  const key = myKey(), S = TUNING.strike[key], z = S && S.swing[0];
  if (!z || key === 'fist' || !state.foe || !state.foe.parts) return null;
  const J = S.pin ? S : TUNING.kit.weapon[key], t = J.top || 0, l = (1 - ((z[0] + z[1]) / 2 - t) / (J.pin - t)) * myBlade(E), ph = TUNING.over.lead;
  const [hx, hy] = foeAt(E, 'head', 0.8), q = (hx - sx) ** 2 + (hy - sy) ** 2 - (l * Math.sin(ph)) ** 2;
  return q > 0 ? Math.sqrt(q) - l * Math.cos(ph) : 0;
}
// ----- the sword arm: the aim point follows the finger, the arm stays straight on a circle round the shoulder and bends when the finger draws in -----
export function solveArm(E, dt) {
  const h = state.hand, A = TUNING.arm, G = TUNING.grip, H = myH(E);
  const [sx, sy] = toScreen(youF(E), SHOULDER[0], SHOULDER[1]);
  const arm = myArm(E), blade = myBlade(E);
  const ax = h.tgx - sx, ay = h.tgy - sy, d = Math.hypot(ax, ay) || 1, dx = ax / d, dy = ay / d;
  const e = clamp((d / H - A.chamberAt) / (A.straightAt - A.chamberAt), 0, 1), ov = h.ovK > 0.001 ? overReach(E, sx, sy) : null;
  let r = arm * (A.minFrac + (A.full - A.minFrac) * e);
  // step 24c: an overhead coming down reaches as far as brings its striking part onto his head (within what the arm can do)
  if (ov != null) r = lerp(r, clamp(ov, arm * A.minFrac, arm * A.full), h.ovK);
  h.sx = sx; h.sy = sy; h.ang = Math.atan2(dy, dx);
  h.hx = sx + dx * r; h.hy = sy + dy * r;
  const half = r / 2, bend = Math.sqrt(Math.max(0, (arm / 2) ** 2 - half * half));
  let nx = -dy, ny = dx; if (-0.3 * nx + ny < 0) { nx = -nx; ny = -ny; }
  h.ex = sx + dx * half + nx * bend; h.ey = sy + dy * half + ny * bend;
  // the blade hangs from the fist: up from the arm line, more so when chambered, along the line in a thrust, trailing a swing
  const omega = dt > 0 ? wrap(h.ang - h.pang) / dt : 0; h.pang = h.ang;
  const thrust = clamp(h.along / 700, 0, 1);
  let tg = h.ang + (G.straight + (G.chamber - G.straight) * (1 - e)) * (1 - thrust) - clamp(omega * G.trail, -0.5, 0.5);
  // (and its blade leads the arm, so the head comes down first, not the haft)
  if (ov != null) tg = lerp(tg, h.ang + TUNING.over.lead, h.ovK);
  h.ph = dt > 0 ? h.ph + wrap(tg - h.ph) * (1 - Math.exp(-dt / G.tau)) : tg;
  h.bx = Math.cos(h.ph); h.by = Math.sin(h.ph);
  h.ux = h.hx + h.bx * blade; h.uy = h.hy + h.by * blade;
}

export function moveHand(E, dt) {
  const h = state.hand, HT = TUNING.hand, L = { H: myH(E) }, tired = state.stamina <= 0 || state.exhaust > 0;
  h.pux = h.ux; h.puy = h.uy; h.phx = h.hx; h.phy = h.hy; h.ptgy = h.tgy;
  if (h.lock > 0) {
    h.lock -= dt;
    h.tgx += h.hvx * dt; h.tgy += h.hvy * dt;
    const damp = Math.exp(-9 * dt); h.hvx *= damp; h.hvy *= damp;
    h.tgx = clamp(h.tgx, 10, E.w - 10); h.tgy = clamp(h.tgy, E.safe.top + 40, E.h - 10);
    if (h.lock <= 0) h.grip = 0.3;
  } else if (h.down) {
    const lag = (h.grip > 0 ? HT.regrip : HT.lag) * meLag() * (tired ? HT.tiredLag : 1) * (state.netT > 0 ? TUNING.moves.net.slow : 1);
    const k = 1 - Math.exp(-dt / lag);
    const [gx, gy] = guardPt(E), [ox, oy] = relOff();
    h.tgx += (clamp(gx + ox, 10, E.w - 10) - h.tgx) * k; h.tgy += (clamp(gy + oy, E.safe.top + 40, E.h - 10) - h.tgy) * k;
    if (h.grip > 0) h.grip -= dt;
  } else {
    const [rx, ry] = bowShown() ? bowPt(E) : state.aim ? raisePt(E) : guardPt(E);
    const k = 1 - Math.exp(-dt / TUNING.control.back);
    h.tgx += (rx - h.tgx) * k; h.tgy += (ry - h.tgy) * k;
  }
  // step 24c: an overhead coming down (born, or the hand coming down fast from above the line) is aimed at his head (overReach)
  const AO = TUNING.attack.over, falling = h.down && h.lock <= 0 && ((h.atk && h.atk.kind === 'over' && !h.atk.done) || (h.hy < overLine(E) && h.tgy > h.ptgy + AO.minSpeed * 0.5 * dt));
  h.ovK = (h.ovK || 0) + ((falling ? 1 : 0) - (h.ovK || 0)) * (1 - Math.exp(-dt / TUNING.over.tau));
  solveArm(E, dt);
  const iv = Math.max(dt, 0.001), vx = (h.ux - h.pux) / iv, vy = (h.uy - h.puy) / iv, inst = Math.hypot(vx, vy), kv = 1 - Math.exp(-dt / 0.03);
  h.vx += (vx - h.vx) * kv; h.vy += (vy - h.vy) * kv;
  // tip speed straight out from the shoulder
  h.along = h.vx * Math.cos(h.ang) + h.vy * Math.sin(h.ang);
  h.sp = h.down && h.lock <= 0 ? h.sp * 0.5 + inst * 0.5 : 0;
  if (h.hy < overLine(E)) h.raisedT = state.m;
  // (a fist's trail follows the fist, step 14)
  if (state.me.weapon === 'fist') state.trail.push({ x: h.hx, y: h.hy, life: 0.12 }); else state.trail.push({ x: h.ux, y: h.uy, life: 0.12 });
  for (const q of state.trail) q.life -= dt;
  state.trail = state.trail.filter((q) => q.life > 0);
}

// An attack is born when the tip gets fast, and is named by how it moves: down after the hand was above the head (overhead), straight out from the shoulder (jab),
// up (a free raise, no blow), or any other arc (slash). The cost is paid then.
export function updateAttack(E, dt) {
  const h = state.hand, T = TUNING, AT = T.attack, S = T.stamina, sh = state.sh;
  const live = h.down && h.lock <= 0 && !state.away && state.endT <= 0 && state.fallT <= 0 && !busy();
  if (h.atk && (!live || (h.sp < T.hit.minSpeed * 0.55 && !lungeStab(h.atk) && !driveStab(h.atk)))) h.atk = null;
  if (!h.atk && live && h.sp >= T.hit.minSpeed) {
    const spv = Math.hypot(h.vx, h.vy) || 1, ux = h.vx / spv, uy = h.vy / spv;
    // a jab is a push forward along the guard line, whatever the arm's aim
    const ga = Math.atan2(TUNING.control.guard[1], TUNING.control.guard[0]), along = (h.vx * Math.cos(ga) + h.vy * Math.sin(ga)) / spv;
    // (a downward stroke from a hand raised above the head is an overhead before it is a jab; the thumb must be bringing it down, not drawing it in)
    let kind = null;
    if (uy > AT.over.down && h.tgy > h.ptgy && state.m - h.raisedT < AT.over.window) { if (spv >= AT.over.minSpeed) kind = 'over'; }
    else if (along > TUNING.control.jabCone) { if (spv >= AT.jab.minSpeed) kind = 'jab'; }
    else if (uy < -0.7) kind = 'raise';
    else kind = 'slash';
    // the hand's motion just after your feint is its recovery, not a blow
    if (state.m - state.recT < TUNING.myFeint.recover && kind !== 'raise') kind = 'pull';
    if (kind === 'raise' || kind === 'pull') h.atk = { kind, done: true };
    else if (kind && state.exhaust > 0) tiredPop(E);
    else if (kind) {
      const tired = state.stamina <= 0, cost = AT[kind].cost * meWeapon().cost;
      state.stamina = Math.max(0, state.stamina - cost);
      state.lastAtk = state.m;
      h.atk = { kind, tired, done: false, cost, lunge: !!(state.lunging && state.lng && !state.lng.committed) };
      if (kind === 'over') state.overheads++; else if (kind === 'jab') state.jabs++; else state.slashes++;
      // step 23: your jabs in a row (Brutus's nudge), and his read of them
      if (kind === 'jab') { state.jabRun++; readJab(E); } else state.jabRun = state.mem.jabs = 0;
    }
  }
  // regen: only when not swinging, holding or dodging; faster when also not blocking
  const RM = TUNING.me.staRegen[state.me.sta - 1] * TUNING.me.armour[state.me.set].regen * Math.pow(TUNING.cards.deepbreath, count('deepbreath')) * (trait('gaul') ? TUNING.origins.gaul.regen : 1);
  if (state.m - state.lastAtk > S.delay && !sh.held && !state.away) state.stamina = Math.min(state.staMax, state.stamina + S.regen * RM * (raised() ? 1 : S.idleMul) * dt);
  // Ox-Strong shows as your breath comes all the way back from under half
  if (trait('gaul')) { if (state.stamina < state.staMax / 2) state.oxLow = true; else if (state.oxLow && state.stamina >= state.staMax) { state.oxLow = false; tagPop(E, 'gaul', 'OX-STRONG'); } }
}

export function checkExhaust(E, dt) {
  state.exhaust = Math.max(0, state.exhaust - dt);
  if (state.stamina <= 0 && state.exhaust <= 0) {
    state.stamina = 0; state.exhaust = TUNING.stamina.exhaust; state.staOuts++; state.hand.atk = null;
    const Fy = youF(E); pop(Fy.x, Fy.y - 1.0 * Fy.H, 'EXHAUSTED', '#fca5a5', 20); E.haptic(20);
  }
}
function tiredPop(E) {
  if (state.m - state.exMsg < 0.8) return;
  state.exMsg = state.m;
  const Fy = youF(E); pop(Fy.x, Fy.y - 1.0 * Fy.H, state.exhaust > 0 ? 'EXHAUSTED' : 'TOO TIRED', '#fca5a5', 16);
}

// ----- your footwork: the backstep and backing off, the wall behind you -----
const gripMul = () => Math.pow(TUNING.cards.grip, count('grip')) * Math.pow(TUNING.cards.feet, count('feet'));
function backToWall(E) {
  const ft = state.foot;
  if (state.m - ft.wallT < TUNING.foot.wallMsg) return;
  ft.wallT = state.m; state.wallHits++;
  const Fy = youF(E); pop(Fy.x + 30, Fy.y - 1.1 * Fy.H, 'Back to the wall!', '#fca5a5', 24); E.haptic(18); shake(E, 3, 0.1);
}
export function stepYou(E, dt) {
  const T = TUNING.foot, ft = state.foot, dg = state.dg, k = gripMul(), wl = walls(E), hi = Math.max(wl.back, state.step.x - gMin(E));
  const holding = dg.down && dg.t > TUNING.dodge.dur;
  if (holding) ft.tgt -= T.walkBack * k * dt;
  // idle (no swing, dodge or lunge for drift.idle s) with him within his striking distance and reach: drift back toward your mark, a pace per drift.secs;
  // out of his reach you hold your ground
  else if (ft.tgt < 0 && !dg.down && !state.away && !state.lunging && !state.hand.atk && state.m - state.lastAtk > T.drift.idle && inReach()) {
    const rate = T.pace / T.drift.secs;
    ft.tgt = Math.min(0, ft.tgt + rate * dt); ft.v = Math.max(ft.v, rate);
  }
  ft.tgt = clamp(ft.tgt, wl.back, hi);
  ft.pos = clamp(ft.pos + clamp(ft.tgt - ft.pos, -ft.v * dt, ft.v * dt), wl.back, hi);
  // holding DODGE against the wall: you can give no more ground, and the backed-off guard ends
  if (holding && ft.pos <= wl.back + 0.005) { backToWall(E); dg.down = false; dg.id = -1; }
}
// his bash drives you back half a pace, to the wall at most
function pushYou(E, k = 1) {
  const FT = TUNING.foot, ft = state.foot, wl = walls(E), sea = trait('ostia');
  if (sea) tagPop(E, 'ostia', 'SEA LEGS');
  ft.pos = Math.max(wl.back, ft.pos - FT.push * FT.pace * k * (sea ? TUNING.origins.ostia.push : 1)); ft.tgt = Math.min(ft.tgt, ft.pos);
  if (ft.pos <= wl.back + 0.005) backToWall(E);
}

// ----- your defence: the shield and the backstep in time -----
export const raised = () => !state.sh.broken && !noShield() && !busy() && state.sh.arm <= 0 && state.you.lungeK < 0.15 && (state.sh.held || (state.sh.t >= 0 && state.sh.t < TUNING.shield.dur));
const blocks = (zone) => raised() && state.sh.zone === zone;
export function updateDefence(dt, E) {
  const s = state.sh, D = TUNING.dodge, S = TUNING.shield, dg = state.dg;
  if (s.held) { state.stamina -= S.drain * steadyMul() * (state.me.dual ? TUNING.dual.holdDrain : 1) * dt; state.lastAtk = state.m; if (state.stamina <= 0) { state.stamina = 0; s.held = false; s.hid = -1; s.t = -1; s.cool = S.cool; } }
  if (s.arm > 0) { s.arm -= dt; if (s.arm <= 0) s.t = 0; }
  // the cooldown follows only a raise that blocked a blow
  if (s.t >= 0) { s.t += dt; if (s.t >= S.dur && !s.held) { s.t = -1; s.cool = s.blocked ? S.cool : 0; s.blocked = false; } }
  s.cool = Math.max(0, s.cool - dt); s.flash = Math.max(0, s.flash - dt);
  state.dodgeCool = Math.max(0, state.dodgeCool - dt); state.bitT = Math.max(0, state.bitT - dt);
  if (dg.down) {
    dg.t += dt;
    if (dg.t > D.dur) { state.stamina -= (has('untouch') ? 0 : D.drain) * dt; state.lastAtk = state.m; if (state.stamina <= 0) { state.stamina = 0; dg.down = false; dg.id = -1; } }
  }
  if (state.away && !dg.down && state.dodgeT <= 0) { state.away = false; state.dodgeCool = D.cool; }
}
const steadyMul = () => Math.pow(TUNING.cards.steady, count('steady'));
// (step 24: the reinforced shield, the Arms slot's plate, takes TUNING.purse.reinforce x the blows; never with two blades)
const reinforced = () => !!state.me && !state.me.dual && (state.me.kit || []).includes('manica');
export const shieldMax = () => Math.round(TUNING.shield.hits * (reinforced() ? TUNING.purse.reinforce : 1)) + TUNING.cards.tough * count('tough');
// Wide Stance (a tent ware): no push-back from a bash
const noPush = () => has('stance');

// ----- the foe's pose: sway, wind-up, lunge, fall, winded -----
const cockOf = (pose, zone) => POSES[pose].cock + (pose === 'thrust' && zone.id === 'high' ? -0.35 : 0);
export function poseFoe(E, dt) {
  if (state.foe.beast) { poseBeast(E, dt); return; }
  const L = lay(E), f = state.foe, sw = state.sw, S = TUNING.swing, FT = TUNING.foe;
  const fall = state.fallT > 0 ? Math.pow(clamp(state.fallT / 0.5, 0, 1), 2) : 0;
  let lean = FT.swayDeg * Math.PI / 180 * Math.sin(state.m * TUNING.swayRate * 1.3) + state.kickA, crouch = 0, lunge = 0;
  // a lamed sword arm droops at rest; a lamed shield arm hangs, his guard dropped; lamed legs limp
  let th = covering() ? clamp(-0.3 + 2.3 * (state.cover.y + 0.8), -0.4, 1.1) + 0.05 * Math.sin(state.m * 3) : REST_TH + 0.08 * Math.sin(state.m * 3) + (lamed('armF') ? 0.35 : 0);
  if (state.winded > 0 && fall === 0) { th = 1.4 + 0.06 * Math.sin(state.m * 2.2); lean += 0.24 + 0.05 * Math.sin(state.m * 6); crouch = 0.05; }
  else if (!sw && state.open > 0 && fall === 0) lean += 0.1;
  // th2: his other arm's angle on a blow at a second height (Aquila's two blades)
  let th2 = null;
  if (sw) {
    const P = POSES[sw.pose], P2 = sw.pose2 && POSES[sw.pose2];
    if (sw.fin > 0) {
      const v = clamp((0.4 - sw.fin) / 0.12, 0, 1), back = clamp(sw.fin / 0.2, 0, 1), c = cockOf(sw.pose, sw.zone);
      th = sw.kind === 'throw' ? P.end : c + (P.end - c) * v * v;
      if (P2) { const c2 = cockOf(sw.pose2, sw.zone2); th2 = c2 + (P2.end - c2) * v * v; }
      lunge = S.lunge * P.lunge * easeOut(v) * back; lean += 0.22 * easeOut(v) * back;
    } else if (sw.kind === 'throw' && sw.thrown) {
      // the spear has left her hand: the arm follows through
      const MV = TUNING.champs.mevia, v = clamp((sw.t - (sw.wind - MV.flight)) / MV.flight, 0, 1), c = cockOf(sw.pose, sw.zone);
      th = c + (P.end - c) * easeOut(v); lean += P.lean * (1 - v) + 0.18 * v;
    } else if (sw.fake && !sw.switched) {
      // the fake winds only part of the way and never trembles: the honest tell of a feint
      const FP = POSES[sw.fakePose], u = clamp(sw.t / (sw.switchAt * 0.8), 0, 1), e = easeOut(u) * TUNING.moves.feint.cock * (sw.hesOn ? 0.9 + 0.1 * Math.sin(state.m * 30) : 1);
      th = sw.th0 + (cockOf(sw.fakePose, sw.fake) - sw.th0) * e;
      lean += FP.lean * e; crouch = FP.crouch * e;
    } else {
      // (the Red Rage's roar comes before his arm moves: he rears back)
      const t0 = sw.switched ? sw.realAt : sw.pre || 0, u = clamp((sw.t - t0) / ((sw.wind - t0) * 0.55), 0, 1), e = easeOut(u);
      th = sw.th0 + (cockOf(sw.pose, sw.zone) - sw.th0) * e + (u >= 1 ? Math.sin(sw.t * 55) * 0.035 : 0);
      if (P2) th2 = sw.th0 + (cockOf(sw.pose2, sw.zone2) - sw.th0) * e + (u >= 1 ? Math.sin(sw.t * 51) * 0.035 : 0);
      lean += P.lean * e; crouch = P.crouch * e;
      if (sw.pre && sw.t < sw.pre) lean -= TUNING.champs.marcus.rear * easeOut(clamp(sw.t / (sw.pre * 0.4), 0, 1));
      if (sw.kind === 'blink' && !sw.spring) { const C = TUNING.champs.hermes, k = easeOut(clamp(sw.t / (sw.springAt * 0.6), 0, 1)); crouch += C.low * k; lean += C.lean * k; }
      if (sw.kind === 'throw') sw.grip = TUNING.champs.mevia.grip * e;
    }
    f.th = th;
  } else {
    f.th += (th - f.th) * (1 - Math.exp(-(dt || 0.016) / 0.1));
    th = f.th;
  }
  f.dx = -(lunge * L.H) + Math.sin(state.m * TUNING.swayRate * 0.8) * FT.swayX * L.H + fall * 0.3 * L.H + state.step.x * L.H;
  const limp = lamed('legs') && fall === 0 ? Math.max(0, Math.sin(state.m * 5)) : 0;
  f.dy = crouch * L.H + Math.abs(Math.sin(state.m * (state.winded > 0 ? 4.5 : 2.4))) * -3 + limp * 0.03 * L.H;
  lean += limp * 0.06;
  f.a = lean - fall * 1.45;
  // two blades (step 18): his far arm holds its blade up in guard and swings with his weapon arm, or (a blow at two heights) to its own height
  const D = TUNING.dual, far = lamed('armB') ? 0.75 + 0.04 * Math.sin(state.m * 1.7) : f.dual ? (th2 != null ? th2 - Math.PI / 2 : D.rest + (th - REST_TH) * D.follow) + 0.05 * Math.sin(state.m * 1.7)
    : sw && sw.pose === 'bash' && sw.fin <= 0 ? -1.2 : 0.14 + 0.08 * Math.sin(state.m * 1.7);
  f.fr = {
    armF: { ox: SHOULDER[0], oy: SHOULDER[1], rot: th - Math.PI / 2 },
    armB: { ox: PARTS[4].joint[0], oy: PARTS[4].joint[1], rot: far },
  };
  for (const p of f.parts) {
    const fr = f.fr[p.d.frame || p.d.id] || ZERO, c = Math.cos(fr.rot), sn = Math.sin(fr.rot);
    p.cx = fr.ox + p.d.x * c - p.d.y * sn; p.cy = fr.oy + p.d.x * sn + p.d.y * c;
  }
}

// Footwork: he drifts around the distance his weapon wants, steps to striking distance just before and while he attacks (and while open),
// backs off when hurt (if this exchange's mood says so), and sidesteps your lunge once he has read it. No randomness here: the drift is a slow wave.
export function stepFoe(dt, E) {
  // step 24: your bow up, a man rushes in to striking distance at TUNING.bow.rush x his step (a beast pounces sooner instead: swapBow)
  const rush = state.bowOut && !state.intro && !state.foe.beast ? TUNING.bow.rush : 1;
  const T = TUNING.step, st = state.step, f = state.foe, limp = (lamed('legs') ? TUNING.lame.legs : 1) * netMul(TUNING.me.net.step), tau = T.tau * statMul('spdStep', f.spd) * f.size.step / limp / rush;
  st.dodgeT = Math.max(0, st.dodgeT - dt); st.dodgeCool = Math.max(0, st.dodgeCool - dt);
  const free = !state.sw && state.winded <= 0 && state.stun <= 0 && state.stagger <= 0 && state.fallT <= 0 && !state.intro && state.endT <= 0;
  if (free && state.you.lungeK > 0.5 && st.dodgeCool <= 0 && (lungeRead() || f.spd >= 5)) {
    st.dodgeT = T.dodgeDur; st.dodgeCool = T.dodgeCool;
    if (lungeRead()) { state.lungeReads++; readPop(E, 'READS YOUR LUNGE'); counter(E, 'thrust'); }
  }
  if (state.fallT > 0 || state.winded > 0 || state.stagger > 0 || state.kLesson) return;
  // the pounce's spring carries a beast across the ground to where it lands
  const sw = state.sw;
  if (sw && sw.spring && sw.fin <= 0) { st.x = lerp(sw.from, sw.land, ease.inOut(clamp((sw.t - sw.springAt) / Math.max(0.01, sw.wind - sw.springAt), 0, 1))); return; }
  const c = T.circle, wave = (c[0] + c[1]) / 2 + (c[1] - c[0]) / 2 * Math.sin(state.m * 2 * Math.PI / T.period + state.rack);
  // a blow in flight keeps him at striking distance, whatever else he meant to do; a crouching lion gathers itself back, and stays back for a pounce
  const pounce = !!(state.plan && state.plan.q[0] && RANGED[state.plan.q[0].kind]);
  const want = sw ? (sw.pose === 'pounce' ? f.home + TUNING.moves.pounce.back : sw.kind === 'blink' ? f.home + TUNING.champs.hermes.start : RANGED[sw.kind] ? f.home : f.strike) : st.dodgeT > 0 ? f.home + T.dodge : state.retreat > 0 ? f.home + TUNING.retreat.dist
    : state.chase > 0 || state.open > 0 || rush > 1 || (!state.intro && state.swingIn < T.lead && !pounce) ? f.strike : f.home + wave;
  // the same footwork rules as yours: he keeps his distance from where you stand, walks no faster than his legs allow
  // (barely at all while winding up a blow), and stops at the wall behind him
  const FT = TUNING.foot, pos = state.foot.pos, wl = walls(E), lo = pos + gMin(E);
  const goal = clamp(want + pos, lo, wl.fore), v = FT.foeV / (statMul('spdStep', f.spd) * f.size.step) * (state.sw && state.sw.fin <= 0 ? FT.commit : state.chase > 0 ? FT.chaseV : rush) * limp;
  st.x = clamp(st.x + clamp((goal - st.x) * (1 - Math.exp(-dt / tau)), -v * dt, v * dt), lo, wl.fore);
}
// your lunge from beyond his reach: he steps in behind its recovery and strikes soon after, so a missed long lunge leaves you open
function chaseIn() {
  if (state.sw || state.winded > 0 || state.stun > 0 || state.stagger > 0 || state.fallT > 0 || state.intro || state.step.dodgeT > 0) return;
  state.chase = TUNING.foot.chase; state.chases++; state.swingIn = Math.min(state.swingIn, TUNING.foot.chaseSwing);
}
// a strong block or a blocked bash drives him back half a pace, to the wall at most
export function pushFoe(E, k = 1) {
  const FT = TUNING.foot, st = state.step, wl = walls(E), was = st.x, steer = trait('circus');
  st.x = Math.min(wl.fore, st.x + FT.push * FT.pace * k * (steer ? TUNING.origins.circus.push : 1));
  if (st.x >= wl.fore - 0.005 && state.m - state.foot.foeWallT > FT.wallMsg) {
    state.foot.foeWallT = state.m; state.foeWall++;
    const Ff = foeF(E); pop(Ff.x, Ff.y - 1.3 * Ff.H, was >= wl.fore - 0.005 ? 'PINNED!' : 'TO THE WALL!', '#fde68a', 20);
    // Steer Him: the wall knocks the breath out of him
    if (steer) { tagPop(E, 'circus', 'STEER HIM'); spendFoe(E, TUNING.origins.circus.wall * state.foe.staMax); }
  } else if (steer && st.x > was) tagPop(E, 'circus', 'STEER HIM');
}

// ----- a beast's pose: the lion's crouch and spring and its raised paw, the bear rearing up and lowering its head -----
// A pose is a few numbers (q): the body lowered (y) and risen about the hip (rot, negative is up), the head dipped, the jaw open, each foreleg free at
// an angle (0 hangs down, -PI/2 points at you) or standing, the hind legs trailing or standing, the tail's lash. From it come the body, head and near
// foreleg frames its parts and gaps ride, and its four legs (shoulder or hip, knee, foot), so what is drawn is what is hit.
export const beastRestQ = () => ({ y: 0, rot: 0, dip: 0, jaw: 0, fore: [null, null], hind: null, tail: 1 });
function poseBeast(E, dt) {
  const L = lay(E), f = state.foe, sw = state.sw, S = TUNING.swing, M = TUNING.moves, q = beastRestQ();
  const fall = state.fallT > 0 ? Math.pow(clamp(state.fallT / 0.5, 0, 1), 2) : 0;
  let lunge = 0, air = 0;
  q.y = 0.006 * Math.sin(state.m * 2.4); q.dip = 0.01 * Math.sin(state.m * 1.3);
  if (state.winded > 0 && fall === 0) { q.y = 0.035; q.dip = 0.06; q.jaw = 0.45 + 0.2 * Math.sin(state.m * 9); q.tail = 0.3; }
  else if (state.stun > 0) { q.dip = 0.07; q.jaw = 0.25; }
  // a lamed foreleg is held off the sand; lamed hind legs limp
  if (lamed('legF')) q.fore[0] = -0.45;
  if (lamed('legs') && fall === 0) q.y += 0.02 * Math.max(0, Math.sin(state.m * 5));
  if (sw) {
    const P = sw.pose, t = sw.t, w = sw.wind, fin = sw.fin > 0, back = fin ? clamp(sw.fin / 0.2, 0, 1) : 1, v = fin ? clamp((0.4 - sw.fin) / 0.12, 0, 1) : 0;
    const shiver = (u) => (u >= 1 ? Math.sin(t * 55) : 0);
    if (P === 'pounce') {
      const at = sw.springAt;
      if (fin) { q.y = 0.04 * back; q.fore = [-1.1 * back, -1.25 * back]; q.jaw = 0.4 * back; if (back < 0.15) q.fore = [null, null]; }
      else if (t < at) { const u = clamp(t / at, 0, 1), e = easeOut(u); q.y = 0.11 * e + 0.006 * shiver(u); q.rot = 0.09 * e; q.dip = 0.06 * e; q.jaw = 0.2 * e; q.tail = 2.6; }
      else { const u = clamp((t - at) / Math.max(0.01, w - at), 0, 1); q.y = 0.11 * (1 - u) - 0.03 * u; q.rot = 0.06 - 0.18 * u; air = Math.sin(Math.PI * u) * 0.1; q.fore = [0.1 - 1.2 * u, 0.1 - 1.35 * u]; q.hind = 0.7 * u; q.jaw = 0.7 * u; }
    } else if (P === 'swipe') {
      // the paw goes up: high over its head for HIGH, forward at its chest for MID; then it swings forward and down through that height
      const cock = sw.zone.id === 'high' ? -2.55 : -1.85, end = sw.zone.id === 'high' ? -1.45 : -0.85, u = clamp(t / (w * 0.55), 0, 1), e = easeOut(u);
      if (fin) { q.fore[0] = v < 1 ? cock + (end - cock) * v * v : end * back + 0.1 * (1 - back); q.rot = -0.08 * back; lunge = S.lunge * easeOut(v) * back; q.jaw = 0.5 * back; if (back < 0.1) q.fore[0] = null; }
      else { q.fore[0] = 0.1 + (cock - 0.1) * e + 0.05 * shiver(u); q.rot = -0.08 * e; q.jaw = 0.3 * e; q.tail = 2; }
    } else if (P === 'maul') {
      // it rears up about its hips: high with its paws over its head (it will come down on your chest, MID), or half up with its paws low (it rakes LOW)
      const lo = sw.zone.id === 'low', top = lo ? 0.45 : 0.66, up = lo ? [-0.6, -0.75] : [-2.35, -2.6], down = lo ? [-0.3, -0.4] : [-0.9, -1.0];
      const u = clamp(t / (w * M.maul.rear), 0, 1), e = easeOut(u);
      if (fin) { q.rot = -top * (1 - v) * back; q.fore = [up[0] + (down[0] - up[0]) * v, up[1] + (down[1] - up[1]) * v].map((a) => a * back); lunge = S.lunge * 1.2 * easeOut(v) * back; q.jaw = 0.6 * back; if (back < 0.1) q.fore = [null, null]; }
      else { q.rot = -top * e + 0.03 * shiver(u); q.fore = [0.1 + (up[0] - 0.1) * e, 0.1 + (up[1] - 0.1) * e]; q.jaw = 0.9 * e; q.tail = 1.5; }
    } else if (P === 'shove') {
      // the head goes down and it draws back, then it charges in with its shoulder
      const u = clamp(t / (w * 0.55), 0, 1), e = easeOut(u);
      q.dip = 0.08 * (fin ? back : e); q.rot = 0.08 * (fin ? back : e); q.y = 0.03 * (fin ? back : e);
      lunge = fin ? S.lunge * 1.9 * easeOut(v) * back : -0.04 * e - 0.005 * shiver(u); q.jaw = 0.3 * (fin ? back : e);
    }
  }
  if (fall > 0) { q.y = 0.16 * fall; q.rot = 0.05 * fall; q.dip = 0.1 * fall; q.fore = [null, null]; q.hind = null; q.jaw = 0.3 * fall; q.tail = 0; }
  // walking moves the feet: a little stride cycle from the ground he covers
  const wx = state.step.x; f.walk = (f.walk || 0) + Math.abs(wx - (f.walkX == null ? wx : f.walkX)); f.walkX = wx;
  f.dx = -(lunge * L.H) + 0.01 * Math.sin(state.m * TUNING.swayRate * 0.8) * L.H + state.step.x * L.H;
  f.dy = -air * L.H * drawK(f);
  f.a = 0;
  beastFrames(f, q, sw || fall > 0 ? 0 : f.walk);
}
// the waiting beast's (and its card's) pose: standing at rest
export function beastRest(f) { beastFrames(f, beastRestQ(), 0); }
// A pose's frames and legs (body units, in the beast's own ground frame), and each part's centre in them.
function beastFrames(f, q, walk) {
  const K = BEAST_BODY[f.beast], [hx, hy] = K.hip, c = Math.cos(q.rot), s = Math.sin(q.rot);
  const ox = hx - hx * c + hy * s, oy = hy + q.y - hx * s - hy * c, T = (p) => [ox + p[0] * c - p[1] * s, oy + p[0] * s + p[1] * c];
  f.fr = { body: { ox, oy, rot: q.rot }, head: { ox: ox - s * q.dip, oy: oy + c * q.dip, rot: q.rot } };
  const anchors = [T(K.sh[0]), T(K.sh[1]), T(K.hp[0]), T(K.hp[1])], free = [q.fore[0], q.fore[1], q.hind, q.hind == null ? null : q.hind * 0.85];
  f.lg = anchors.map((a, i) => {
    const [l1, l2] = K.leg[i < 2 ? 0 : 1], n = l1 + l2;
    const ft = free[i] != null ? [a[0] - Math.sin(free[i]) * n * 0.97, Math.min(0, a[1] + Math.cos(free[i]) * n * 0.97)] : [K.feet[i] + (walk ? 0.022 * Math.sin(walk * 22 + i * 1.7) : 0), Math.min(0, a[1] + n)];
    return [a, knee(a, ft, l1, l2, i < 2 ? -1 : 1), ft];
  });
  const [a, , ft] = f.lg[0];
  f.fr.legF = { ox: a[0], oy: a[1], rot: Math.atan2(-(ft[0] - a[0]), ft[1] - a[1]) };
  f.bq = q;
  for (const p of f.parts) {
    const fr = f.fr[p.d.frame || p.d.id] || ZERO, cc = Math.cos(fr.rot), sn = Math.sin(fr.rot);
    p.cx = fr.ox + p.d.x * cc - p.d.y * sn; p.cy = fr.oy + p.d.x * sn + p.d.y * cc;
  }
}
// a two-bone leg's knee between a and b: side -1 bends it back (a foreleg's elbow), 1 forward (a hind knee); straight when the leg is at full stretch
export function knee(a, b, l1, l2, side) {
  const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.max(1e-6, Math.hypot(dx, dy)), k = clamp((l1 * l1 - l2 * l2 + d * d) / (2 * d * d), 0, 1), h = Math.sqrt(Math.max(0, l1 * l1 - (k * d) ** 2));
  return [a[0] + dx * k + side * dy / d * h, a[1] + dy * k - side * dx / d * h];
}

// ====== INPUT: the left thumb's column (the right thumb is read in moveHand; pointer routing is in the play scene) ======
// ----- the left hand: three shield buttons and one DODGE across the column (tap = the quick backstep, hold = keep backing off) -----
export function colRect(E) {
  const C = TUNING.col, x = 10 + E.safe.left, w = Math.max(C.minW, Math.round(E.w * C.frac));
  const bottom = E.h - 10 - E.safe.bottom, dodgeH = Math.max(C.dodgeMinH, Math.round(E.h * C.dodgeFrac)), top = E.safe.top + C.top;
  return { x, w, top, bottom, dodgeH, h: (bottom - top - dodgeH - 3 * C.gap) / 3 };
}
export function shieldBtns(E) {
  const C = TUNING.col, R = colRect(E), h = R.h;
  const out = ZONES.map((z, i) => ({ z, x: R.x, y: R.top + i * (h + C.gap), w: R.w, h }));
  out.push({ z: null, dodge: true, x: R.x, y: R.bottom - R.dodgeH, w: R.w, h: R.dodgeH });
  return out;
}

// A button's touch area: 8 px past each drawn edge, but only half the gap toward a neighbour.
function hitRect(E, b) {
  const C = TUNING.col, first = b.z === ZONES[0], last = b.dodge;
  return { x0: b.x - C.reach, x1: b.x + b.w + C.reach, y0: b.y - (first ? C.reach : C.gap / 2), y1: b.y + b.h + (last ? C.reach : C.gap / 2) };
}
export function buttonAt(E, p) {
  return shieldBtns(E).find((b) => { const r = hitRect(E, b); return p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1; }) || null;
}
export function raiseShield(E, zone, pid) {
  const s = state.sh, Fy = youF(E);
  if (s.broken || noShield()) { pop(Fy.x, Fy.y - 1.0 * Fy.H, 'NO SHIELD', '#94a3b8', 14); return; }
  if (state.away || state.you.lungeK >= 0.15) return;
  if (busy()) { pop(Fy.x, Fy.y - 1.0 * Fy.H, 'OPEN', '#fca5a5', 14); return; }
  if (!raised() && !(s.arm > 0)) {
    if (s.cool > 0) return;
    s.zone = zone; s.zy = zone.sy; s.blocked = false;
    if (state.exhaust > 0) { s.arm = TUNING.shield.slow; s.t = -1; } else s.t = 0;
    E.audio.beep({ freq: 260, dur: 0.07, type: 'triangle', slide: 1.5, gain: 0.12 }); E.haptic(8);
  } else if (s.zone !== zone) {
    // switching zones is instant, with no cooldown: the shield moves at once and stays up as if just raised
    s.zone = zone; if (s.t >= 0) s.t = 0;
    E.audio.beep({ freq: 330, dur: 0.05, type: 'triangle', gain: 0.08 }); E.haptic(6);
  }
  s.pressT = state.m;
  if (pid != null) { if (!s.held) s.heldAt = state.m; s.held = true; s.hid = pid; }
}

// The backstep is a real step back: out of reach for its length, and the ground stays given. At the wall there is none to give.
export function dodge(E, pid) {
  const D = TUNING.dodge, Fy = youF(E), s = state.sh, h = state.hand, ft = state.foot, wl = walls(E);
  if (noDodge()) { pop(Fy.x, Fy.y - 1.0 * Fy.H, 'NO DODGE', '#94a3b8', 14); return; }
  if (state.away || state.dodgeCool > 0) return;
  if (fakeShowing()) { bitFeint(E); return; }
  if (ft.pos <= wl.back + 0.01) { backToWall(E); return; }
  // Counterstep: a dodge just after a block is free, and opens a gap
  const step = has('counterstep') && state.m - state.blockM <= C_().counterWin, light = trait('numidia'), cost = has('untouch') || step ? 0 : Math.round(D.cost * (light ? TUNING.origins.numidia.dodge : 1));
  if (state.stamina < cost) { tiredPop(E); return; }
  state.stamina -= cost; state.lastAtk = state.m;
  if (light && cost > 0) tagPop(E, 'numidia', 'LIGHT FEET');
  const spd = TUNING.me.spdDodge[state.me.spd - 1];
  // Blur: his blow in flight now aims at the ghost left where you stood
  if (has('blur') && state.sw && state.sw.fin <= 0 && !state.sw.ghostX) state.sw.ghostX = Fy.x;
  state.dodges++; state.stepsOut++; state.away = true; state.dodgeM = state.m; state.dodgeT = state.dodgeMax = D.dur * spd * growth('winddancer', 'dancer', C_().windDodge); h.atk = null;
  if (step) { state.blockM = -9; pop(Fy.x + 0.3 * Fy.H, Fy.y - 1.15 * Fy.H, 'COUNTERSTEP', '#86efac', 18); openGap(E, s.zone); }
  ft.tgt = Math.max(wl.back, Math.min(ft.tgt, ft.pos) - TUNING.foot.back * spd); ft.v = TUNING.foot.back / D.dur * gripMul();
  state.dg.down = true; state.dg.id = pid; state.dg.t = 0;
  s.held = false; s.hid = -1; s.t = -1; s.arm = 0;
  swooshSound(E, 0.16); E.haptic(12);
  // a short ghost trail behind you and a scuff of sand
  dust(Fy.x, Fy.y, TUNING.juice.scuff); E.audio.noise({ dur: 0.07, gain: 0.1, delay: 0.05 }); state.ghostT = TUNING.juice.ghost; state.ghostAt = -9;
}
// Biting his feint (step 10): a dodge begun while his fake still shows is a stumble, not a step. Your dodge locks, and his real blow comes at once on a
// shorter tell, which you can still block. No dodge card fires, since there is no dodge for tellDodge to see.
export const fakeShowing = () => !!(state.sw && state.sw.fake && !state.sw.switched && state.sw.fin <= 0);
function bitFeint(E) {
  const sw = state.sw, FB = TUNING.feintBite, Fy = youF(E), rest = Math.max(0, sw.wind - sw.switchAt - sw.hes) * FB.wind;
  state.baited++; sw.baited = true; state.dodgeCool = Math.max(state.dodgeCool, FB.lock); state.bitT = FB.lock;
  // a Capuan fake bitten: his real blow comes at once, on a shorter tell
  if (sw.dud) { const mv = state.move; mv.idx = mv.hits.length - 1; state.sw = null; startBlow(E); state.sw.wind *= FB.wind; state.sw.baited = true; }
  else { feintSwitch(E); sw.wind = sw.t + rest; }
  state.you.a -= TUNING.juice.recoil * FB.lean;
  pop(Fy.x, Fy.y - 1.05 * Fy.H, 'BAITED', '#f87171', 28); shake(E, 5, 0.15); E.haptic(25);
  E.audio.beep({ freq: 210, dur: 0.18, type: 'sawtooth', slide: 0.6, gain: 0.1 });
  if (!E.save.get('baitHint', 0)) { E.save.set('baitHint', 1); state.caption = { lines: ['That was a fake. Dodging a fake leaves you open.'], t: FB.cap, max: FB.cap }; }
}

// ====== HIT RESOLUTION: your blows on him, his blows on you ======
// ----- step 21, the striking parts: which part of a weapon meets him, and how it hits (TUNING.strike) -----
export const myKey = () => weaponKey(state.me.weapon, state.me.mace);
const attOf = (kind) => (kind === 'jab' ? 'jab' : 'swing');
// the part s of the way from the point to the hand: its index in the weapon's jab or swing list, -1 for the haft
export function zoneAt(key, att, s) {
  const S = TUNING.strike[key], J = S.pin ? S : TUNING.kit.weapon[key], t = J.top || 0, r = t + s * (J.pin - t);
  return S[att].findIndex((z) => r >= z[0] && r <= z[1]);
}
// what a blow with that part is: its kinds and multiplier (a thud's on the haft)
export function strikeOf(key, att, i) {
  const S = TUNING.strike, z = i >= 0 ? S[key][att][i] : null, k = z ? z[2].split(' ') : [];
  return { key, att, z: i, thud: !z, mul: z ? z[3] : S.thud, cut: k.includes('cut'), pierce: k.includes('pierce'), crush: k.includes('crush'), hook: !!S[key].hook && k.includes('cut') };
}
// a blow that meets him with its first part (a finisher's, a free jab's)
const cleanStrike = (kind, key = myKey()) => strikeOf(key, attOf(kind), TUNING.strike[key][attOf(kind)].length ? 0 : -1);
// One hit per swing: the first thing the weapon meets decides it (point first, earliest point of the sweep first; a slot wins over the part it sits on).
export function checkHits(E) {
  const h = state.hand, T = TUNING, a = h.atk;
  if (!a || a.done || h.lock > 0 || state.fallT > 0 || state.endT > 0 || state.away || busy()) return;
  const need = a.kind === 'jab' ? T.attack.jab.minSpeed : a.kind === 'over' ? T.attack.over.minSpeed : T.hit.minSpeed;
  if (h.sp < need && !lungeStab(a) && !driveStab(a)) return;
  // a lunge that has not committed (the Feint worn) holds what its blade meets until it commits
  const F = foeF(E), fm = state.foe, jab = a.kind === 'jab', held = state.lunging && state.lng && !state.lng.committed;
  // a jab's striking part has the wider jab pad (the trident's wider still), every other point of the weapon the plain one
  const key = myKey(), att = attOf(a.kind), wide = (jab && TUNING.strike[key].wide) || 1, pad = T.blade.pad / F.H, jpad = T.blade.jabPad * wide / F.H;
  const order = fm.parts.filter((p) => p.slot).concat(fm.parts.filter((p) => !p.slot));
  if (a.kind === 'slash' && state.armed.whirl && !held && whirlwind(E, F, fm, pad)) return;
  let first = null;
  scan: for (const f of [0.4, 0.7, 1]) {
    const hx = h.phx + (h.hx - h.phx) * f, hy = h.phy + (h.hy - h.phy) * f, tx = h.pux + (h.ux - h.pux) * f, ty = h.puy + (h.uy - h.puy) * f;
    const n = Math.max(1, Math.ceil(Math.hypot(tx - hx, ty - hy) / 8));
    for (let i = n; i >= 0; i--) {
      const x = hx + (tx - hx) * i / n, y = hy + (ty - hy) * i / n, zi = zoneAt(key, att, 1 - i / n), pd = jab && zi >= 0 ? jpad : pad;
      const [lx, ly] = toLocal(F, x, y);
      for (const p of order) {
        if (p.cool > 0 || p.cut) continue;
        const [qx, qy] = partLocal(p, fm, lx, ly);
        if (inside(p.d, qx, qy, pd)) { first = { p, at: { x, y, lx: qx, ly: qy }, st: strikeOf(key, att, zi) }; break scan; }
      }
    }
  }
  if (!first) return;
  const hit = { ...first, ang: Math.atan2(h.vy, h.vx), sp: h.sp, slit: first.p.slot && jab && alongSlit(F, fm, first.p, wide) };
  if (held) { if (!state.lng.pend) state.lng.pend = hit; return; }
  a.done = true;
  state.stop = Math.max(state.stop, land(E, a, hit));
}
// what the weapon met lands: a clang on a plate, his guard or a gap guard; a thud where its haft met him; or a hit (a piercing jab along a slit, or into an
// opened gap, goes in for a slot hit)
export function land(E, a, { p, at, ang, sp, slit, st = cleanStrike(a.kind) }) {
  if (state.train) yardLand(E, a, p);
  if (state.lng && state.lunging) state.lng.hit = true;
  state.landM = state.m;
  // Shadow Step: the first blow to reach him after the dodge goes through his guard (never a plate or a gap guard)
  const shadow = has('shadow') && state.m - state.shadowM <= C_().shadowWin && !p.armour && !p.guard;
  if (shadow) { state.shadowM = -9; if (covered(p)) pop(at.x, at.y - 40, 'UNBLOCKABLE', '#86efac', 18); }
  if (covered(p) && !shadow) return bounce(E, p, at, ang, sp, a, st);
  if (st.thud) return shaftHit(E, p, at, ang, sp, a);
  return gapHit(E, p, at, ang, sp, a, p.slot && a.kind === 'jab' && st.pierce && (state.openAll > 0 || openNow(p) || slit), st);
}

// Whirlwind, armed: this slash goes into every slot its sweep crosses, through his cover, each a slot hit
function whirlwind(E, F, fm, pad) {
  const h = state.hand, hit = new Set();
  for (const f of [0.25, 0.5, 0.75, 1]) {
    const hx = h.phx + (h.hx - h.phx) * f, hy = h.phy + (h.hy - h.phy) * f, tx = h.pux + (h.ux - h.pux) * f, ty = h.puy + (h.uy - h.puy) * f, n = Math.max(1, Math.ceil(Math.hypot(tx - hx, ty - hy) / 8));
    for (let i = 0; i <= n; i++) {
      const [lx, ly] = toLocal(F, hx + (tx - hx) * i / n, hy + (ty - hy) * i / n);
      for (const p of fm.parts) if (p.slot && !p.guard && !p.cut && p.cool <= 0 && !hit.has(p)) { const [qx, qy] = partLocal(p, fm, lx, ly); if (inside(p.d, qx, qy, pad)) hit.add(p); }
    }
  }
  if (!hit.size) return false;
  state.armed.whirl = false; h.atk.done = true;
  pop(E.w / 2, E.h * 0.3, `WHIRLWIND x${hit.size}`, '#e879f9', 26);
  for (const p of hit) {
    if (state.foe.hp <= 0) break;
    const [x, y] = partCenter(F, fm, p);
    state.stop = Math.max(state.stop, gapHit(E, p, { x, y, lx: p.d.x, ly: p.d.y }, Math.atan2(h.vy, h.vx), h.sp, h.atk, true));
  }
  return true;
}
// A jab goes into a slot only if its direction (in the foe's frame, and the limb's) is within the tolerance of the slit's axis.
function alongSlit(F, fm, p, wide = 1) {
  const h = state.hand, sp = Math.hypot(h.vx, h.vy) || 1, ax = F.dir * h.vx / sp, ay = h.vy / sp, c = Math.cos(F.a), s = Math.sin(F.a);
  let lx = ax * c + ay * s, ly = -ax * s + ay * c;
  const fr = fm.fr[p.d.frame || p.d.id] || ZERO, fc = Math.cos(fr.rot), fs = Math.sin(fr.rot);
  [lx, ly] = [lx * fc + ly * fs, -lx * fs + ly * fc];
  return Math.abs(lx * Math.cos(p.d.axis) + ly * Math.sin(p.d.axis)) >= Math.cos(Math.min(1.5, TUNING.cover.jabTol * wide));
}

// a plate dents by the blow's kind (a crush fully, a cut a little, a point or a haft not at all); Heavy Blows and Crusher multiply what it dents
export function bounce(E, p, at, ang, sp, a, st = cleanStrike(a.kind)) {
  const h = state.hand, A = TUNING.armour, J = TUNING.juice, AT = TUNING.attack[a.kind], glance = a.kind === 'jab', S = TUNING.strike;
  state.clangs++; p.clang = 0.25; p.cool = 0.3;
  const crusher = a.kind === 'slash' && sp >= TUNING.hit.mid && has('crusher'), anvil = !st.thud && a.kind === 'over' && has('anvil') && state.m - state.anvilM <= C_().anvilWin;
  const bite = st.thud ? 0 : st.crush ? 1 : st.cut ? S.cut.dent : 0;
  const dn = p.armour && bite && !meWeapon().noDent ? AT.dents * bite * (a.kind === 'over' ? Math.pow(TUNING.cards.heavy, count('heavy')) : crusher ? TUNING.cards.crusher : 1) : 0;
  const was = p.dents; p.dents += dn;
  if (p.armour && !dn) pop(at.x, at.y - 30, st.thud ? 'THUD' : 'GLANCES OFF', '#cbd5e1', 15);
  if (p.armour && st.crush && !st.thud) crushLands(E);
  if (dn) state.zfx = { st, m: state.m };
  const rv = glance ? clamp(sp * 0.3, 200, 420) : clamp(sp * A.kick, 450, 1300);
  h.hvx = -Math.cos(ang) * rv; h.hvy = -Math.sin(ang) * rv; h.lock = AT.recoil * TUNING.me.spdLag[state.me.spd - 1] / meWeapon().speed * (glance ? Math.pow(TUNING.cards.wrist, count('wrist')) : 1); h.grip = 0; h.atk = null;
  const d = p.d, sz = d.shape === 'circle' ? d.r : Math.min(d.w, d.h) / 2;
  for (let c = Math.floor(was); c < Math.floor(p.dents); c++) {
    const a0 = Math.random() * 6.28, pts = [[Math.cos(a0) * 0.1 * sz, Math.sin(a0) * 0.1 * sz]];
    for (let k = 1; k <= 4; k++) { const b = a0 + (Math.random() - 0.5) * 0.9; pts.push([pts[0][0] + Math.cos(b) * sz * 0.5 * k * (0.8 + Math.random() * 0.4), pts[0][1] + Math.sin(b) * sz * 0.5 * k * (0.8 + Math.random() * 0.4)]); }
    p.cracks.push(pts);
  }
  sparks(at.x, at.y, ang + Math.PI, glance ? 8 : 24); ring(at.x, at.y, glance ? 24 : 44, '#cbd5e1');
  clangSound(E, 0); shake(E, glance ? 2 : 6, 0.12); E.haptic(glance ? 8 : 24);
  let stop = glance ? 0.01 : J.stopClang + 0.02;
  const breakAt = a.kind === 'over' && meWeapon().overBreak ? meWeapon().overBreak : state.foe.beast ? TUNING.beasts.armour.dents : A.dents;
  if (p.armour && (p.dents >= breakAt || (!st.thud && a.kind === 'over' && has('breaker')) || anvil)) {
    p.armour = false; state.broken++;
    if (p.d.id === 'head' && !state.foe.beast && !state.foe.parts.some((q) => q.d === FACE_SLOT)) { const q = mkPart(FACE_SLOT, false); q.slot = true; state.foe.parts.push(q); }
    if (anvil) { state.anvilM = -9; pop(at.x, at.y - 48, 'HAMMER AND ANVIL', '#fbbf24', 18); }
    const [sx, sy] = partCenter(foeF(E), state.foe, p);
    plateBits(sx, sy, 9); ring(sx, sy, 70, '#ffe9a8'); pop(sx, sy - 24, 'PLATE BROKEN', '#ffe9a8', 17); emit(E, 'break', { p });
    E.audio.beep({ freq: 110, dur: 0.25, type: 'sine', slide: 0.4, gain: 0.3 }); shake(E, 8, 0.2); E.haptic(30);
    stop = J.stopBreak + 0.04;
  }
  if (state.cover) state.cover.t = Math.max(state.cover.t, TUNING.cover.dur * 0.5);
  // his cover (a gap guard is not: it shuts its gap and costs him nothing); his Thorns make a blow on his guard cost you, his Riposte answers it
  const onGuard = !p.armour && !p.guard;
  if (a.kind === 'jab' && onGuard) state.mem.jabs++;
  if (a.kind === 'over') { emit(E, 'over', { p, at, clang: true }); if (has('titan')) staggerFoe(E); }
  if (onGuard) spendFoe(E, TUNING.foeSta.block * (state.foe.dual ? TUNING.dual.drain : 1));
  // his crossed blades give way after a few blows: his guard is down a while
  if (onGuard && state.foe.dual && ++state.coverHits >= TUNING.dual.breakAt) {
    state.coverHits = 0; state.gbreak = TUNING.dual.broken; state.cover = null;
    pop(at.x, at.y - 44, 'GUARD BROKEN', '#ffd24a', 20); clangSound(E, 0.05);
  }
  if (onGuard && foeHas('thorns')) { state.stamina = Math.max(0, state.stamina - TUNING.foeGear.thorns); state.lastAtk = state.m; pop(at.x, at.y - 40, 'THORNS', '#fca5a5', 15); }
  if (a.kind === 'over' || (onGuard && (state.foe.shield || foeHas('riposte')))) counter(E);
  return stop;
}

export function gapHit(E, p, at, ang, sp, a, thrust, st = cleanStrike(a.kind)) {
  const T = TUNING, J = T.juice, AT = T.attack, kind = a.kind, f = state.foe, slot = p.slot;
  // his Unbreakable (the lion pelt): your first hit each bout is shrugged off
  if (foeHas('unbreak') && !state.bout.foeShrug) {
    state.bout.foeShrug = true; p.cool = T.hit.cool;
    sparks(at.x, at.y, ang + Math.PI, 14); clangSound(E, 0); pop(at.x, at.y - 20, 'SHRUGGED OFF', '#e879f9', 22);
    return J.stopClang;
  }
  const MW = meWeapon();
  let dmg = kind === 'jab' ? AT.jab.dmg : kind === 'over' ? AT.over.dmg * growth('colossus', 'brute', T.cards.colossusOver) : sp >= T.hit.mid ? AT.slash.fastDmg : AT.slash.dmg;
  if (a.tired) dmg = Math.max(1, Math.floor(dmg * T.stamina.tired));
  dmg *= T.me.str[state.me.str - 1] * meSize().dmg;
  // the weapon multiplies after the usual rounding, to the nearest half, so the gladius (1x) adds no rounding of its own; a slot hit uses slotDmg, any
  // other hit the weapon's dmg times its striking part's
  const wm = thrust ? MW.slotDmg : MW.dmg * st.mul;
  const rip = state.riposte > 0, winded = state.winded > 0;
  if (rip) dmg *= T.shield.riposteMul;
  // the open window multiplies after rounding, so a punish is exactly 1.5x (health can hold halves)
  // Cruel Edge: +1 a bleed stack on a slot hit; Sharp Edge and the whetstone (tent wares) add to bare hits and every hit
  const raw = Math.max(1, Math.round(thrust ? dmg * MW.slot + (has('cruel') ? T.cards.cruel * state.bleed.length : 0) : dmg + (!slot ? T.cards.edge * count('edge') : 0)) + count('whet'));
  let dealt = Math.max(0.5, Math.round(raw * wm * 2) / 2) * (winded ? T.foeSta.windedDmg : 1) * (has('forge') ? TUNING.tent.forge : 1);
  // Slip and Stab: a jab soon after a dodge in his tell
  const slip = kind === 'jab' && has('slip') && state.m - state.lastTellDodge <= T.cards.slipWin;
  // Haemorrhage's price: a bare hit does nothing
  const numb = !slot && has('haem');
  if (numb) dealt = 0;
  // Misdirection: a slot hit in the gap your feint opened (which closes it); Crowd Pleaser: a slot hit with the crowd in its top third, spending some of it
  const misd = thrust && openNow(p) && has('misdir'), please = thrust && has('pleaser') && topThird();
  if (thrust && openNow(p)) state.gapOpen = null;
  if (please) favour(E, -T.cards.pleaserCost);
  // the multipliers stack up to mulMax
  dealt *= Math.min(T.cards.mulMax, (slip ? T.cards.slip : 1) * (misd ? T.cards.misdir : 1) * (please ? T.cards.pleaser : 1));
  // Execute, armed: a slot hit on a foe below half his health fells him
  const exec = thrust && state.armed.exec && f.hp < f.maxHp * T.fin.below;
  if (exec) { dealt = Math.max(dealt, f.hp); state.armed.exec = false; }
  if (!exec && !numb) dealt *= blowMul(E);
  if (kind === 'jab') state.mem.jabs = 0;
  p.cool = T.hit.cool; p.flash = 0.16; state.gapHits++; if (thrust) { state.slotHits++; state.bout.gaps[p.d.id] = (state.bout.gaps[p.d.id] || 0) + 1; } if (winded) state.punishes++;
  f.hp -= dealt;
  const gl = kind === 'jab' ? 0.03 : 0.06;
  // Bonebreaker: an overhead on a bare limb lames it at once
  if (!slot && kind === 'over' && LIMB[p.d.id] && has('bones')) p.hp = 0;
  if (!slot && !numb) { p.hp -= dmg * wm; p.gashes.push({ a: [at.lx - Math.cos(ang) * gl, at.ly - Math.sin(ang) * gl], b: [at.lx + Math.cos(ang) * gl, at.ly + Math.sin(ang) * gl], t: state.m }); }
  const big = dealt >= 3;
  blood(at.x, at.y, ang, Math.min(J.blood.max, J.blood.drops + J.blood.perDmg * dealt));
  dust(at.x, at.y, 3 + dealt * 3);
  sliceSound(E, big);
  // a word for the moments that have one (an Execute, a bite that does nothing, a punish and the other multiplied hits); every other hit shows its number
  const word = exec ? 'EXECUTED!' : numb ? 'NO BITE' : please ? `CROWD PLEASER x${Math.round(dealt)}` : misd ? `MISDIRECTION x${Math.round(dealt)}` : slip ? `SLIP x${Math.round(dealt)}` : rip ? `RIPOSTE x${Math.round(dealt)}` : winded ? `PUNISH x${Math.round(dealt)}` : null;
  const col = rip || please ? '#ffd24a' : misd ? '#c4b5fd' : thrust ? '#ff6a4a' : big ? '#ffb347' : '#fff0b8';
  if (word) pop(at.x, at.y - 20, word, col, Math.min(34, 15 + dealt * 4)); else dmgPop(E, at, dealt, col);
  state.kickV += T.foe.kick * (Math.cos(ang) > 0 ? -1 : 0.5) * (0.6 + Math.min(dealt, 4) * 0.4);
  shake(E, 2 + Math.min(dealt, 5) * 2.5, 0.1); E.haptic(10 + Math.min(dealt, 5) * 8);
  if (big) E.flash('#fff0b8', 0.07);
  let stop = dealt >= 3 ? J.stop3 : dealt >= 2 ? J.stop2 : J.stop1;
  // a gap hit: a short hit-stop, more blood from the gap with a red ring, and a deeper hit
  if (thrust) { stop = Math.max(stop, J.slotStop); blood(at.x, at.y, ang, J.blood.slot); ring(at.x, at.y, J.slotRing, '#ef4444'); slotSound(E); }
  if (!slot && p.hp <= 0) { disable(E, p, at, ang); stop += 0.04; }
  // step 21: the part that struck lights up; a cut on bare skin bleeds (the sica's hook more, and pulls him in); a crush counts to a stagger
  state.zfx = { st, m: state.m };
  if (st.cut && !numb && dealt > 0) cutBleed(E, st);
  if (st.crush && dealt > 0) crushLands(E);
  emit(E, thrust ? 'slot' : 'hit', { p, kind, at, ang, cut: st.cut });
  // two blades: the off hand follows a slash that lands, a moment later, for part of its damage
  if (kind === 'slash' && state.me.dual && dealt > 0) state.offHit = { f, p, t: T.dual.after, dmg: Math.max(0.5, Math.round(dealt * T.dual.part * 2) / 2), ang };
  if (kind === 'over') emit(E, 'over', { p, at });
  if (kind === 'over' && has('titan') && f.hp > 0) staggerFoe(E);
  if (f.hp <= 0) fell(E);
  else {
    setCover(p);
    // he backs off when hurt, if this exchange's mood (rolled when it was planned) says so
    if (state.mood.retreat && !state.sw && state.winded <= 0 && f.hp < f.maxHp * T.retreat.hurt) {
      state.mood.retreat = false; state.retreat = T.retreat.dur; state.retreats++; state.swingIn = Math.max(state.swingIn, T.retreat.dur);
    }
  }
  return stop;
}

// a cut's bleed, kept as a part until it makes a whole stack; the sica's hook bleeds more and pulls him a little toward you
function cutBleed(E, st) {
  const S = TUNING.strike;
  state.cutAcc = (state.cutAcc || 0) + S.cut.bleed * (st.hook ? S.hook.bleed : 1);
  const n = Math.floor(state.cutAcc + 1e-6);
  state.cutAcc -= n; addBleed(E, n);
  if (st.hook) { state.step.x = Math.max(state.foot.pos + gMin(E), state.step.x - S.hook.pull); const Ff = foeF(E); pop(Ff.x - 0.1 * Ff.H, Ff.y - 1.05 * Ff.H, 'HOOKED', '#fca5a5', 15); }
}
// every few crushing blows that land, plate or flesh, stagger him
function crushLands(E) {
  if (++state.crushN < TUNING.strike.crush.stagger) return;
  state.crushN = 0; staggerFoe(E);
}
// the haft or shaft meets him: a thud, a quarter of the blow with no gap bonus, bleed or dent, and a little push
function shaftHit(E, p, at, ang, sp, a) {
  const T = TUNING, AT = T.attack, f = state.foe;
  let dmg = a.kind === 'jab' ? AT.jab.dmg : a.kind === 'over' ? AT.over.dmg : sp >= T.hit.mid ? AT.slash.fastDmg : AT.slash.dmg;
  if (a.tired) dmg = Math.max(1, Math.floor(dmg * T.stamina.tired));
  dmg *= T.me.str[state.me.str - 1] * meSize().dmg;
  const dealt = !p.slot && has('haem') ? 0 : Math.max(0.5, Math.round(dmg * meWeapon().dmg * T.strike.thud * 2) / 2) * (state.winded > 0 ? T.foeSta.windedDmg : 1);
  p.cool = T.hit.cool; f.hp -= dealt; state.thuds++;
  dust(at.x, at.y, 5); dullSound(E); pop(at.x, at.y - 20, 'THUD', '#cbd5e1', 20);
  state.kickV += T.foe.kick * (Math.cos(ang) > 0 ? -0.4 : 0.2);
  pushFoe(E, T.strike.push); shake(E, 2, 0.08); E.haptic(8);
  if (f.hp <= 0) fell(E); else setCover(p);
  return T.juice.stop1;
}
// Step 19 on your blows: Kneading (each hit within the crowd's combo window of the last adds a step, up to its most), Nothing to Lose (low on hearts),
// Him Last (the champion or your rival)
function blowMul(E) {
  let k = 1;
  if (trait('capua')) {
    const O = TUNING.origins.capua, n = state.m - state.kneadM <= TUNING.crowd.comboWin ? Math.min(Math.round(O.max / O.step), (state.kneadN || 0) + 1) : 0;
    state.kneadN = n; state.kneadM = state.m;
    if (n) { k *= 1 + n * O.step; tagPop(E, 'capua', `KNEADING +${pctOf(n * O.step)}%`); }
  }
  const R = TUNING.reasons;
  if (drives('freedom') && state.hp <= state.maxHp * R.freedom.below) { k *= R.freedom.dmg; tagPop(E, 'freedom', 'NOTHING TO LOSE', true); }
  if (drives('revenge') && (state.foe.champion || state.gauntlet[state.rack].rival)) { k *= R.revenge.dmg; tagPop(E, 'revenge', 'HIM LAST', true); }
  return k;
}
export function disable(E, p, at, ang) {
  p.cut = true;
  blood(at.x, at.y, ang, TUNING.juice.blood.down);
  pop(at.x, at.y - 44, 'DOWN', '#ff9f43', 20);
  E.audio.beep({ freq: 90, dur: 0.22, type: 'sine', slide: 0.4, gain: 0.3 });
  if (p.d.id === 'head') {
    state.stun = TUNING.stun; state.sw = null; state.move = null; state.plan = null; state.swingIn = nextGap();
    pop(at.x, at.y - 70, 'STUNNED', '#a5b4fc', 20);
  }
  if (LIMB[p.d.id]) {
    state.lamings++;
    pop(at.x, at.y - 70, `LAMED: ${limbName(p.d.id)}`, '#f87171', 20); E.flash('#7f1d1d', 0.08);
    gainMom(E, TUNING.mom.lame); emit(E, 'lame', { p });
  }
}

// the bout's rival is cleared from this arena's record once he falls
function clearRival(E, from = state.arena) { const rv = { ...E.save.get('rivals', {}) }; delete rv[from]; E.save.set('rivals', rv); }
export function fell(E) {
  if (state.fallT > 0 || state.train) return;
  if (state.edge && !state.edge.down) { fellOne(E); return; }
  state.felled++; state.fallT = 0.01; state.sw = null; state.move = null; state.plan = null; state.winded = 0; state.results[state.rack] = 'felled';
  state.hp = Math.min(state.maxHp, state.hp + TUNING.heal);
  waitingHeal(E);
  state.grades.push(gradeBout()); state.goods.push(boutTally().good);
  state.lastGold = boutGold(); state.gold += state.lastGold.sum; state.goldEarned += state.lastGold.sum;
  const pays = state.lastGold.items.find((e) => e[0] === 'every win pays');
  if (pays) tagPop(E, 'debt', `EVERY WIN PAYS +${pays[1]}`, true);
  if (state.gauntlet[state.rack].rival) { state.rivalBeaten = 1; clearRival(E, state.gauntlet[state.rack].from); pop(E.w * 0.62, E.h * 0.42, 'Rival defeated!', '#f87171', 30); }
  pop(E.w * 0.62, E.h * 0.3, 'FOE DOWN', '#ffd24a', 28); shake(E, 10, 0.3); E.flash('#fff0b8', 0.1); E.audio.play('coin'); fellJuice(E);
  if (boutTally().taken === 0) favour(E, TUNING.crowd.clean);
  emit(E, 'fell');
}
// the pop for hearts gained: "+2 HEARTS"
export const heartsPop = (n) => `+${n} HEART${n === 1 ? '' : 'S'}`;
// She's Waiting: more hearts back for each foe felled
function waitingHeal(E) {
  if (!drives('promise')) return;
  const was = state.hp; state.hp = Math.min(state.maxHp, state.hp + TUNING.reasons.promise.heal);
  if (state.hp > was) tagPop(E, 'promise', `SHE'S WAITING ${heartsPop(state.hp - was)}`, true);
}
// Broken Chains: once a run, a blow that would fell you leaves you on its hearts; otherwise the bout is lost
function youDown(E) {
  if (state.hp > 0) return;
  if (trait('egypt') && !state.chains) {
    state.chains = 1; state.hp = TUNING.origins.egypt.hearts; tagPop(E, 'egypt', 'BROKEN CHAINS');
    E.flash('#fde68a', 0.15); E.audio.beep({ freq: 180, dur: 0.3, type: 'square', slide: 2, gain: 0.08 }); return;
  }
  state.hp = 0; state.endT = 1.0; state.results[state.rack] = 'lost';
}
// the first of a pair falls: the bout goes on, his partner taunts from the edge and steps in (stepIn, from the play scene's fall clock)
function fellOne(E) {
  state.fallT = 0.01; state.sw = null; state.move = null; state.plan = null; state.winded = 0; state.swapping = false;
  pop(E.w * 0.62, E.h * 0.3, 'ONE DOWN', '#ffd24a', 26); shake(E, 8, 0.25); E.flash('#fff0b8', 0.08); fellJuice(E);
  E.audio.beep({ freq: 220, dur: 0.2, type: 'triangle', slide: 0.6, gain: 0.2 });
  const was = state.hp; state.hp = Math.min(state.maxHp, state.hp + TUNING.pairs.heal); E.audio.play('coin');
  if (state.hp > was) { const Fy = youF(E); pop(Fy.x, Fy.y - 1.1 * Fy.H, heartsPop(state.hp - was), '#fca5a5', 24); }
  waitingHeal(E);
  emit(E, 'fell');
}

// A fell: a slow-motion second, the camera punching in on him, the crowd's roar, dust as he goes down and again as he lands
function fellJuice(E) {
  const J = TUNING.juice, Ff = foeF(E);
  slowFx(J.fellSlow, J.fellMul); state.zoomT = J.fellSlow; state.dropT = J.dropAt;
  dust(Ff.x, Ff.y, J.dropDust >> 1); roar(E);
}
// slow motion for sec real seconds at game speed mul (a slower one already running is kept)
export function slowFx(sec, mul) { if (state.slowFx > 0 && state.slowMul < mul) return; state.slowFx = sec; state.slowMul = mul; }
// His blow lands (resolveOne). Aquila's at two heights: the one you block is the first, and the other lands on you after it unless you were out of
// reach; the Huntress's thrown spear leaves her with her dagger, unarmed a while if it missed.
export function resolveSwing(E) {
  const sw = state.sw;
  if (sw.zone2 && blocks(sw.zone2)) [sw.zone, sw.zone2, sw.pose, sw.pose2] = [sw.zone2, sw.zone, sw.pose2, sw.pose];
  resolveOne(E, sw);
  const on = sw.outcome === 'block' || sw.outcome === 'hit' || sw.outcome === 'shrug';
  if (sw.zone2 && on && state.hp > 0 && state.foe.hp > 0) resolveOne(E, { ...sw, zone: sw.zone2, pose: sw.pose2, dmg: sw.dmg2, zone2: null, fake: null, ghostX: null, counter: false, second: true });
  if (sw.kind === 'throw') { const missed = !on || sw.outcome === 'block'; spearOut(E, missed); if (state.move && state.move.sig) state.move.won = missed; }
}
function resolveOne(E, sw) {
  const L = lay(E), zy = zoneScreenY(L, sw.zone), Fy = youF(E), Ff = foeF(E), sh = state.sh, SH = TUNING.shield, M = TUNING.moves, W = state.foe.weapon, D = TUNING.dual, dual = !!state.me.dual, mv = state.move;
  // a beast's shove is its bash; its pounce bounces off your shield and, landing, drives you back; its maul lands with a thud whatever it meets
  const net = sw.pose === 'net', bash = sw.pose === 'bash' || sw.pose === 'shove', BM = sw.pose === 'shove' ? M.shove : M.bash, pounce = sw.pose === 'pounce', feint = !!sw.fake;
  if (!sw.second) sw.fin = 0.4;
  if (sw.pose === 'maul') maulJuice(E);
  state.streaks.push({ x1: Ff.x - Ff.H * 0.3, y1: zy - 30, x2: Fy.x - L.H * 0.1, y2: zy + 20, life: 0.22, max: 0.22, red: !state.away, net });
  if (sw.ghostX) {
    sw.outcome = 'whiff'; settleFeint('none');
    swooshSound(E, 0.2); pop(sw.ghostX, zy - 30, 'HE HIT YOUR GHOST', '#e879f9', 20); tellDodge(E, sw); return;
  }
  // False Opening, armed: this blow overcommits into the opening you showed him, misses, and leaves him winded
  if (state.armed.falseop) {
    state.armed.falseop = false; sw.outcome = 'whiff'; settleFeint('none');
    swooshSound(E, 0.2); pop(E.w / 2, zy - 30, 'FALSE OPENING!', '#c4b5fd', 24); shimmer(Ff.x, Ff.y - 0.55 * Ff.H, TUNING.juice.readBurst >> 1);
    windFoe(E, TUNING.fin.falseWind); return;
  }
  // a backstep begun during his tell is out of his reach for its length: your dodge
  if (state.away && state.dodgeM >= sw.m0) {
    sw.outcome = 'dodge'; state.dodged++; settleFeint('none');
    swooshSound(E, 0.2); pop(E.w / 2, zy - 30, net ? 'NET DODGED' : feint ? 'FEINT DODGED' : 'OUT OF REACH', '#7de3ff', 18); tellDodge(E, sw); return;
  }
  // range: a blow lands only if your body is within his striking distance (plus a little reach); the net and the spear are thrown and always carry.
  // He committed only with you in reach, so a blow that falls short is your dodge when you gave ground during the tell (a step back, a lunge's recoil).
  if (!net && sw.kind !== 'throw' && !inReach()) {
    const gave = bodyPos() < sw.body0 - TUNING.foot.give;
    sw.outcome = gave ? 'dodge' : 'whiff'; settleFeint('none');
    if (gave) state.dodged++; else state.outReach++;
    swooshSound(E, 0.2); pop(E.w / 2, zy - 30, 'OUT OF REACH', '#7de3ff', 20); if (gave) tellDodge(E, sw); return;
  }
  if (blocks(sw.zone)) {
    // a read is the shield in the real zone when the real strike lands, however it got there: switching from the fake is the skill
    const perfect = (sh.t <= perfectWin() || (has('standfast') && atWall(E))) && !net && !bash, bx = Fy.x + 0.28 * L.H, by = zy, read = feint;
    if (perfect && trait('sparta') && sh.t > perfectWin() / TUNING.origins.sparta.perfect && !(has('standfast') && atWall(E))) tagPop(E, 'sparta', 'SPARTAN GUARD');
    sw.outcome = 'block'; state.blocks++; sh.flash = 0.25; sh.blocked = true;
    if (read) { settleFeint('read'); feintRead(E, bx, by); if (sw.sawFake) state.switchReads++; }
    state.mem.blocks.push({ z: sw.zone.id, t: state.m }); if (state.mem.blocks.length > 6) state.mem.blocks.shift();
    // a read of your guard breaks off the rest of this exchange, so his next move already aims elsewhere
    const run = blockRun();
    if (run && state.plan && state.plan.avoid !== run) { state.plan.q = []; state.plan.after = Math.min(state.plan.after, 1.2); }
    sparks(bx, by, 0, perfect ? 30 : 16); ring(bx, by, perfect ? 130 : 70, perfect ? '#ffd24a' : '#ffffff');
    emit(E, 'block', { bx, by, perfect, bash });
    if (net) { pop(bx, by - 40, 'NET BLOCKED', '#ffffff', 22); clangSound(E, 0); return; }
    // a signature's answer: each blow of the Red Rage blocked, the Capuan Feint's real blow blocked, the Blink's dash met well-timed
    if (mv && mv.sig === 'rage') mv.blocked++;
    if (mv && (mv.sig === 'capuan' || (mv.sig === 'blink' && perfect))) mv.won = true;
    if (perfect) {
      // (the Red Rage's three blows run on through a well-timed block)
      state.perfects++; state.riposte = SH.riposte; state.plan = null; if (mv && !mv.chain) { mv.broken = true; state.stagger = SH.stagger; }
      parrySound(E); ringSound(E); shake(E, TUNING.juice.perfShake, 0.12); E.haptic(35); E.flash('#fff0b8', 0.1); E.audio.play('coin');
      ring(bx, by, TUNING.juice.perfRing, '#ffffff'); ring(bx, by, TUNING.juice.perfRing * 0.6, '#ffffff');
      state.stop = Math.max(state.stop, 0.12);
      pop(bx, by - 40, dual ? 'PERFECT PARRY' : 'PERFECT BLOCK', '#ffd24a', 28);
      state.kickV += -0.8; pushFoe(E);
      // crossed blades: the off hand ripostes on its own
      if (dual) { state.offT = D.swing; freeHit(E, '', false); }
      if (has('riposte')) counterJab(E);
      if (has('ironwall')) freeHit(E, 'IRON WALL', true);
      gainMom(E, TUNING.mom.perfect); emit(E, 'perfect', { bx, by });
    } else if (dual) {
      // crossed blades: no shield to wear out, but some of the blow comes through and the block costs more breath
      const thru = Math.floor(sw.dmg * D.through), drain = ((bash ? BM.drain * BM.blocked : W.drain) + D.cost) * steadyMul();
      state.stamina = Math.max(0, state.stamina - drain); state.lastAtk = state.m;
      if (bash) { if (!noPush()) state.pushT = 0.2; pushFoe(E); } else if (pounce) pushFoe(E);
      clangSound(E, 0); shake(E, 6, 0.15); E.haptic(22); state.stop = Math.max(state.stop, 0.06);
      if (thru > 0) { state.hp -= thru; state.shatter = { i: Math.max(0, Math.ceil(state.hp)), n: Math.min(thru, Math.ceil(state.hp + thru)), t: TUNING.juice.shatter }; state.hurt = 0.25; E.flash('#ff2a2a', 0.12); youDown(E); }
    } else {
      // Shield Drill: every nth block wears it nothing
      state.drillN = (state.drillN || 0) + 1;
      if (trait('thrace') && state.drillN % TUNING.origins.thrace.every === 0) tagPop(E, 'thrace', 'SHIELD DRILL'); else sh.hits -= bash ? 1 : W.wear;
      const drain = (bash ? BM.drain * BM.blocked : W.drain) * steadyMul();
      if (drain) { state.stamina = Math.max(0, state.stamina - drain); state.lastAtk = state.m; pop(bx, by - 70, 'DRAINED', '#fca5a5', 14); }
      if (bash) { if (!noPush()) state.pushT = 0.2; pushFoe(E); } else if (pounce) pushFoe(E);
      clangSound(E, 0); shake(E, bash || W.wear > 1 ? 9 : 6, 0.15); E.haptic(22); state.stop = Math.max(state.stop, 0.06);
      if (sh.hits <= 0) {
        sh.hits = 0; sh.broken = true; sh.t = -1; sh.up = 0;
        plateBits(bx, by, 12); pop(bx, by - 70, 'SHIELD BROKEN', '#ff9f43', 22); shake(E, 9, 0.2);
        E.audio.beep({ freq: 110, dur: 0.25, type: 'sine', slide: 0.4, gain: 0.3 });
      }
    }
    return;
  }
  state.mem.blocks = [];
  if (feint) { state.feintsBit++; settleFeint('bit'); }
  if (net) {
    sw.outcome = 'net'; state.netT = M.net.dur; state.netted++;
    pop(Fy.x, zy - 40, 'NETTED', '#e2e8f0', 30); shake(E, 6, 0.2); E.haptic(30); E.audio.noise({ dur: 0.25, gain: 0.2 });
    return;
  }
  if (bash) {
    sw.outcome = 'bash'; state.bashHits++;
    if (!noPush()) { state.pushT = 0.35; pushYou(E); }
    state.stamina = Math.max(0, state.stamina - BM.drain); state.lastAtk = state.m;
    pop(Fy.x, zy - 40, sw.pose === 'shove' ? 'SHOVED' : 'BASHED', '#fca5a5', 30); shake(E, 12, 0.25); E.haptic(45); clangSound(E, 0); E.audio.play('boom', 0.5);
    state.hand.lock = Math.max(state.hand.lock, 0.3); state.hand.hvx = -260; state.hand.hvy = 60; state.hand.atk = null;
    return;
  }
  // Unbreakable: the first blow each bout that would hurt you is shrugged off
  if (has('unbreak') && !state.bout.shrugged) {
    state.bout.shrugged = true; state.shrugs++; sw.outcome = 'shrug';
    sparks(Fy.x + 0.2 * L.H, zy, Math.PI, 20); clangSound(E, 0); shake(E, 6, 0.2); E.haptic(30);
    pop(Fy.x, zy - 40, 'UNBREAKABLE', '#e879f9', 28); return;
  }
  // a blow on one of your plates costs half as much, rounded up so it never takes part of a heart (step 21: a crush comes through the plate whole)
  // disarmed, he hits with his fists; Juggernaut: lunging through it, it costs half (rounded up) and you keep coming
  const part = state.you.parts.find((q) => q.d.id === ZONE_PART[sw.zone.id]), plated = !!(part && part.armour), jugg = has('jugg') && (state.you.lungeK > 0.5 || driving());
  const fs = foeStrike(sw), raw = state.disarm > 0 ? Math.min(sw.dmg, TUNING.cards.fist) : sw.dmg;
  if (fs && fs.thud) { shaftOnYou(E, sw, part, raw, jugg); return; }
  const dmg = Math.ceil(raw * (fs ? fs.mul : 1) / (plated && !(fs && fs.crush) ? TUNING.me.plateDiv : 1) * (jugg ? TUNING.cards.jugg : 1));
  sw.outcome = 'hit'; state.hp -= dmg; state.taken++; state.hurt = plated ? 0.25 : 0.4; if (sw.counter) state.counterHits++;
  if (mv && mv.sig) mv.hit = true;
  if (pounce && !noPush()) { state.pushT = 0.3; pushYou(E); }
  // you recoil, and the heart that took it shatters on the HUD
  state.you.a -= TUNING.juice.recoil; state.shatter = { i: Math.max(0, Math.ceil(state.hp)), n: Math.min(dmg, Math.ceil(state.hp + dmg)), t: TUNING.juice.shatter };
  // his Bloodlust (the wolf pelt): a blow that lands gives him stamina
  if (foeHas('bloodlust')) { const f = state.foe; f.sta = Math.min(f.staMax, f.sta + TUNING.foeGear.bloodlust); pop(Ff.x, Ff.y - 1.2 * Ff.H, 'HE DRINKS', '#f87171', 15); }
  if (plated) { state.plateSaves++; part.clang = 0.25; const [px, py] = partCenter(Fy, state.you, part); sparks(px, py, Math.PI, 16); clangSound(E, 0); }
  else if (part) { const [px, py] = partCenter(Fy, state.you, part); blood(px, py, Math.PI, Math.min(TUNING.juice.blood.max, TUNING.juice.blood.drops + TUNING.juice.blood.perDmg * dmg)); }
  E.flash('#ff2a2a', plated ? 0.15 : 0.3); shake(E, 12 + 4 * sw.dmg, 0.35); E.haptic(50 + 20 * sw.dmg);
  E.audio.play('boom'); E.audio.play('lose', 0.5);
  // his ordinary blow gets its flash and sound; a word for a fake that fooled you, Juggernaut, or 2 or more hearts actually lost
  // a signature that lands shows only its name over the blow (step 20)
  if (mv && mv.sig) pop(Fy.x, zy - 44, SIG_NAME[mv.sig], '#ff5a4a', TUNING.sigFx.miss);
  else if (jugg || feint || dmg >= 2) pop(Fy.x, zy - (plated ? 70 : 40), jugg ? 'JUGGERNAUT' : feint ? 'FEINTED!' : plated ? 'PLATE TOOK IT' : `OUCH x${dmg}`, jugg || plated ? '#cbd5e1' : '#ff5a4a', 30 + 4 * dmg);
  if (!jugg) { state.hand.lock = Math.max(state.hand.lock, 0.2); state.hand.hvx = -200; state.hand.hvy = 120; state.hand.atk = null; }
  youDown(E);
}
// Step 21, his blow: the part of his weapon that lands is the one his point has passed you by (his striking distance less the gap at your feet, so your
// lunge never carries you inside it); none for a beast, a bash, a net, a throw, or his fists
export function foeStrike(sw) {
  const f = state.foe, att = sw.pose === 'thrust' ? 'jab' : ['chop', 'slash', 'sweep'].includes(sw.pose) ? 'swing' : null;
  if (f.beast || !att || state.disarm > 0) return null;
  const key = weaponKey(f.weapon.id, f.mace), J = TUNING.kit.weapon[key];
  return strikeOf(key, att, zoneAt(key, att, clamp((f.strike - gapNow()) / ((f.weapon.len + J.tip) * drawK(f)), 0, 1)));
}
// his shaft lands on you: a thud, a quarter of the blow to the nearest heart (often none) and a little push
function shaftOnYou(E, sw, part, raw, jugg) {
  const L = lay(E), Fy = youF(E), zy = zoneScreenY(L, sw.zone), dmg = Math.round(raw * TUNING.strike.thud * (jugg ? TUNING.cards.jugg : 1));
  sw.outcome = 'hit'; sw.thud = true; state.thudsOn++;
  if (state.move && state.move.sig) state.move.hit = true;
  if (dmg > 0) { state.hp -= dmg; state.taken++; state.hurt = 0.2; state.shatter = { i: Math.max(0, Math.ceil(state.hp)), n: Math.min(dmg, Math.ceil(state.hp + dmg)), t: TUNING.juice.shatter }; }
  if (!noPush()) pushYou(E, TUNING.strike.push);
  if (part) { const [px, py] = partCenter(Fy, state.you, part); dust(px, py, 5); }
  dullSound(E); shake(E, 4, 0.12); E.haptic(16); E.flash('#94a3b8', 0.08);
  pop(Fy.x, zy - 40, 'THUD', '#cbd5e1', 24);
  youDown(E);
}
// a dodge in his tell (a backstep begun in it, ground given, or his blow on your ghost); a feint's tell counts only after the switch
export function tellDodge(E, sw) {
  if (sw.gaveFake) return;
  state.lastTellDodge = state.m;
  gainMom(E, TUNING.mom.dodge); emit(E, 'dodge', { sw });
}
// You held still through the fake and blocked the real strike: he loses a chunk of stamina, often enough to wind him when the blow is done.
export function feintRead(E, bx, by) {
  const f = state.foe;
  state.feintsRead++; f.sta -= TUNING.feintRead.drain * f.staMax; f.staT = 0;
  gainMom(E, TUNING.mom.read); emit(E, 'read');
  pop(bx + 20, by - 64, 'Feint read!', '#c4b5fd', 30);
  E.flash('#a78bfa', 0.12); E.haptic(30);
  const Ff = foeF(E); shimmer(Ff.x, Ff.y - 0.55 * Ff.H, TUNING.juice.readBurst); ring(Ff.x, Ff.y - 0.55 * Ff.H, 0.5 * Ff.H, '#c4b5fd'); ooh(E, 0.8);
  E.audio.beep({ freq: 660, dur: 0.12, type: 'triangle', gain: 0.12 }); E.audio.beep({ freq: 990, dur: 0.16, type: 'sine', gain: 0.1, delay: 0.08 });
  if (state.caption && state.sw && state.sw.lesson) state.caption = { lines: ['Spotted his fake! He spent his stamina on it.'], t: 2.2, max: 2.2, good: true };
}
// the off hand's follow-up (two blades): it lands on the part the slash cut, through his guard, unless he has gone down or stepped out
export function updateOff(E, dt) {
  state.offT = Math.max(0, state.offT - dt);
  const o = state.offHit;
  if (!o || (o.t -= dt) > 0) return;
  state.offHit = null;
  const f = state.foe;
  if (o.f !== f || f.hp <= 0 || state.fallT > 0) return;
  const F = foeF(E), [x, y] = partCenter(F, f, o.p);
  state.offT = TUNING.dual.swing; f.hp -= o.dmg;
  blood(x, y, o.ang, Math.min(TUNING.juice.blood.max, TUNING.juice.blood.drops + TUNING.juice.blood.perDmg * o.dmg)); dmgPop(E, { x: x + 8, y: y + 10 }, o.dmg, '#fff0b8'); sliceSound(E, false);
  state.kickV += -0.3; shake(E, 3, 0.08); E.haptic(10);
  if (f.hp <= 0) fell(E);
}
// Riposte: a perfect block sends a free jab into the first bare part he leaves (a body part before a slot), at the riposte's damage
const counterJab = (E) => freeHit(E, 'COUNTER JAB', false);
// A free jab: into the first bare part (or, for a slot hit, the first open slot)
function freeHit(E, label, slot) {
  const f = state.foe, F = foeF(E);
  const open = (q) => q.slot && !q.guard && !q.cut, p = slot ? f.parts.find(open) : f.parts.find((q) => !q.slot && !q.armour && !q.cut) || f.parts.find(open);
  if (!p || f.hp <= 0) return;
  const [x, y] = partCenter(F, f, p);
  state.stop = Math.max(state.stop, gapHit(E, p, { x, y, lx: p.d.x, ly: p.d.y }, Math.PI, TUNING.hit.mid, { kind: 'jab', tired: false }, slot));
  if (label) pop(x, y - 46, label, '#7dd3fc', 16);
}

// ====== JUICE: particles and sounds ======
// ----- particles -----
// a spray of red drops along the blow (ang) that fall, and a small red flash where it landed
const BLOOD = ['#b91c1c', '#dc2626', '#7f1d1d'];
export function blood(x, y, ang, n) {
  const B = TUNING.juice.blood;
  for (let i = 0; i < n; i++) {
    const a = ang + (Math.random() - 0.5) * B.spread, s = B.speed * (0.35 + Math.random() * 0.9);
    state.fx.push({ k: 'b', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 90, g: 950, r: 1.5 + Math.random() * 2.5, life: 0.4 + Math.random() * 0.35, max: 0.75, c: BLOOD[i % 3] });
  }
  state.fx.push({ k: 'h', x, y, r: B.flash, life: 0.14, max: 0.14 });
}
export function sparks(x, y, ang, n) {
  for (let i = 0; i < n; i++) {
    const a = ang + (Math.random() - 0.5) * 2.4;
    const s = 220 + Math.random() * 380;
    state.fx.push({ k: 'k', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 500, life: 0.18 + Math.random() * 0.2, max: 0.38, c: Math.random() < 0.5 ? '#ffe9a8' : '#ffffff' });
  }
}
export function dust(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, s = 30 + Math.random() * 90;
    state.fx.push({ k: 'd', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, g: 0, life: 0.35 + Math.random() * 0.25, max: 0.6, r: 4 + Math.random() * 6, c: '#8a7452' });
  }
}
// sand kicked up from the sand at (x, y), thrown back (dir 1 is away from you, -1 toward you) and up, falling back
const SAND = ['#d8b878', '#c9a466', '#e6cc96', '#b08c52'];
export function sand(x, y, dir, n) {
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + dir * (0.3 + Math.random() * 0.9), sp = 160 + Math.random() * 260;
    state.fx.push({ k: 's', x, y: y - 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 900, rot: a, vr: (Math.random() - 0.5) * 6, len: 3 + Math.random() * 5, life: 0.4 + Math.random() * 0.35, max: 0.75, c: SAND[i % 4] });
  }
}
export function ring(x, y, r, color) { state.fx.push({ k: 'r', x, y, r0: 10, r, life: 0.3, max: 0.3, c: color }); }
export function pop(x, y, s, color, size, minY = 0, life = 0.8, rise = 34) {
  const clash = (yy) => state.pops.find((q) => q.life > 0.5 * q.max && Math.abs(q.x - x) < 120 && Math.abs(q.y - yy) < (q.size + size) * 0.6);
  for (let n = 0, q; n < 6 && (q = clash(y)); n++) y = q.y - (q.size + size) * 0.6;
  if (y < Math.max(popTop, minY)) { y = Math.max(popTop, minY); for (let n = 0, q; n < 6 && (q = clash(y)); n++) y = q.y + (q.size + size) * 0.6; }
  const q = { x, y, s, color, size, life, max: life, rise };
  state.pops.push(q);
  return q;
}
// a hit's damage, rounded to the half, sized by it (TUNING.juice.num), kept below the right HUD; where it would cross his face on its way up it sits
// just above his head, or just under his chin when the HUD leaves no room above
export function dmgPop(E, at, dealt, color) {
  const N = TUNING.juice.num, v = Math.round(dealt * 2) / 2, size = N.min + (N.max - N.min) * clamp((v - 1) / (N.top - 1), 0, 1);
  const under = at.x > E.w - 16 - E.safe.right - 236 ? 10 + E.safe.top + hudRow().shield + 60 : popTop;
  const q = pop(at.x, at.y - N.up, String(v), color, size, under + size / 2 + N.rise, N.life, N.rise), hd = state.foe.parts.find((p) => p.d.id === 'head');
  if (!hd) return;
  const F = foeF(E), [hx, hy] = partCenter(F, state.foe, hd), r = hd.d.r * F.H * N.face, half = size * 0.3 * q.s.length + 2;
  if (Math.abs(q.x - hx) >= r + half || q.y - N.rise - size / 2 >= hy + r || q.y + size / 2 <= hy - r) return;
  const up = hy - r - size / 2 - N.gap;
  q.y = up - size / 2 - N.rise >= under ? up : hy + r + size / 2 + N.rise + N.gap;
}
function plateBits(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, s = 200 + Math.random() * 360;
    state.fx.push({ k: 'p', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 900, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 20, w: 10 + Math.random() * 12, h: 6 + Math.random() * 8, life: 0.9 + Math.random() * 0.4, max: 1.3 });
  }
}

// his violet shimmer off a read feint: sparks of light bursting from his body
function shimmer(x, y, n) {
  const C = ['#c4b5fd', '#a78bfa', '#f5d0fe', '#ffffff'];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, sp = 120 + Math.random() * 260;
    state.fx.push({ k: 'k', x: x + Math.cos(a) * 12, y: y + Math.sin(a) * 30, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: -60, life: 0.3 + Math.random() * 0.3, max: 0.6, c: C[i % 4] });
  }
}
// the juice that follows the fighters' feet each frame: a Giant's thud as he walks, your dodge's ghosts, the dust as a felled foe lands
export function stepJuice(E, dt) {
  const J = TUNING.juice;
  if (state.dropT > 0 && (state.dropT -= dt) <= 0) { const Ff = foeF(E); dust(Ff.x + 0.35 * Ff.H, Ff.y, J.dropDust); thud(E, 1.4); }
  for (const [key, k, x, F] of [['foe', state.foe.size.scale, state.step.x, foeF], ['me', meSize().scale, state.foot.pos, youF]]) {
    if (k < J.giantAt) continue;
    const st = state.steps[key] || (state.steps[key] = { x, acc: 0 });
    st.acc += Math.min(0.1, Math.abs(x - st.x)); st.x = x;
    if (st.acc >= J.giantStep) { st.acc = 0; thud(E, 1); shake(E, J.giantShake, 0.08); const Fq = F(E); dust(Fq.x, Fq.y, 3); }
  }
  if (state.ghostT > 0) {
    state.ghostT -= dt;
    if (state.m - state.ghostAt >= J.ghostEvery) { state.ghostAt = state.m; state.ghosts.push({ x: youF(E).x, life: J.ghost }); }
  }
  for (const g of state.ghosts) g.life -= dt;
  state.ghosts = state.ghosts.filter((g) => g.life > 0);
}
// your war paint glowing while a finisher fires
export function paintGlow(ctx, E) {
  const F = youF(E), hp = state.you.parts.find((q) => q.d.id === 'head'), k = state.paintT / TUNING.juice.paint;
  if (!hp) return;
  const [x, y] = partCenter(F, state.you, hp), R = 0.2 * F.H, g = ctx.createRadialGradient(x, y, R * 0.2, x, y, R);
  g.addColorStop(0, `rgba(240,171,252,${0.75 * k})`); g.addColorStop(1, 'rgba(232,121,249,0)');
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, 6.283); ctx.fill(); ctx.restore();
}
// the finisher's name on a banner across the arena, sliding in and out
// (a champion's signature, step 18: dark red, thinner and higher, clear of the tell bands)
export function drawBanner(ctx, E) {
  const b = state.banner, J = TUNING.juice, u = 1 - b.t / (b.max || J.banner), a = Math.min(1, u * 6, b.t / 0.2), y = E.h * (b.sig ? 0.25 : 0.38), h = b.sig ? 36 : 46;
  const R = colRect(E), x0 = b.sig ? R.x + R.w + 6 : 0, cx = (x0 + E.w) / 2;
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = b.sig ? 'rgba(90,14,14,0.82)' : 'rgba(76,29,90,0.85)'; ctx.fillRect(x0, y - h / 2, E.w - x0, h);
  ctx.fillStyle = b.sig ? '#f87171' : '#e879f9'; ctx.fillRect(x0, y - h / 2, E.w - x0, 3); ctx.fillRect(x0, y + h / 2 - 3, E.w - x0, 3);
  ctx.restore();
  E.text(b.s, cx + (1 - Math.min(1, u * 5)) * 60, y + 1, { size: b.sig ? 24 : 32, weight: '800', color: '#fde68a', alpha: a });
}
// a heart breaking on the HUD: shards flying out and falling (u: 0 to 1)
export function heartShatter(ctx, x, y, u) {
  ctx.save(); ctx.globalAlpha = 1 - u; ctx.fillStyle = '#ef4444';
  for (let q = 0; q < 6; q++) {
    const a = -Math.PI / 2 + (q - 2.5) * 0.7, d = 28 * u, sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d + 50 * u * u;
    ctx.beginPath(); ctx.moveTo(sx, sy - 4); ctx.lineTo(sx + 4, sy + 3); ctx.lineTo(sx - 4, sy + 3); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// ----- sounds -----
// a gap hit's deeper thump under the slice
export function slotSound(E) { E.audio.beep({ freq: 72, dur: 0.2, type: 'sine', slide: 0.5, gain: 0.32 }); E.audio.noise({ dur: 0.05, gain: 0.12, delay: 0.01 }); }
// a perfect block's sharp ring
export function ringSound(E) { E.audio.beep({ freq: 2093, dur: 0.5, type: 'sine', gain: 0.07 }); E.audio.beep({ freq: 3136, dur: 0.32, type: 'sine', gain: 0.035, delay: 0.01 }); }
// the crowd's roar at a fell: a long swell of noise over low voices
export function roar(E) {
  E.audio.noise({ dur: 0.9, gain: 0.16 }); E.audio.noise({ dur: 0.7, gain: 0.1, delay: 0.25 });
  [147, 175, 220].forEach((f, i) => E.audio.beep({ freq: f, dur: 0.8, type: 'sawtooth', slide: 1.15, gain: 0.025, delay: i * 0.03 }));
}
// his wind-up, heard as well as seen: a grunt with the gladius, a shaft's creak with the spear, a heavy grunt and creak with the axe, a hiss with the dagger
export function windSound(E, id) {
  const A = E.audio;
  if (id === 'spear') A.beep({ freq: 520, dur: 0.18, type: 'square', slide: 0.6, gain: 0.025 });
  else if (id === 'axe') { A.beep({ freq: 110, dur: 0.22, type: 'sawtooth', slide: 0.6, gain: 0.07 }); A.beep({ freq: 380, dur: 0.16, type: 'square', slide: 0.7, gain: 0.02, delay: 0.05 }); }
  else if (id === 'dagger') { A.noise({ dur: 0.1, gain: 0.07 }); A.beep({ freq: 900, dur: 0.06, type: 'sine', slide: 1.3, gain: 0.025 }); }
  else A.beep({ freq: 150, dur: 0.14, type: 'sawtooth', slide: 0.7, gain: 0.06 });
}
// a beast's tell is heard: the lion roars before a pounce and snarls before a swipe, the bear roars as it rears and grunts before a shove
export function beastSound(E, kind, pose) {
  const A = E.audio, g = TUNING.juice.roar, big = pose === 'pounce' || pose === 'maul', f0 = kind === 'bear' ? 92 : 150;
  A.noise({ dur: big ? 0.55 : 0.18, gain: g * (big ? 0.9 : 0.6) });
  A.beep({ freq: f0 * (big ? 1 : 1.3), dur: big ? 0.6 : 0.2, type: 'sawtooth', slide: 0.55, gain: g * 0.7 });
  A.beep({ freq: f0 * 1.5, dur: big ? 0.45 : 0.15, type: 'square', slide: 0.6, gain: g * 0.18, delay: 0.03 });
}
// the bear's maul landing: a heavy thud, a shake and the sand kicked up under its paws
function maulJuice(E) {
  const J = TUNING.juice, Ff = foeF(E), [x, y] = toScreen(Ff, 0.2, 0);
  thud(E, J.maulThud); shake(E, J.maulShake, 0.15); dust(x, y, 12); sand(x, y, -1, J.sand >> 1);
}
// a haft's thud: dull and low, no ring
export function dullSound(E) { E.audio.beep({ freq: 95, dur: 0.1, type: 'triangle', slide: 0.6, gain: 0.22 }); E.audio.noise({ dur: 0.05, gain: 0.08 }); }
// a heavy footfall (k: louder)
export function thud(E, k = 1) { E.audio.beep({ freq: 55, dur: 0.14, type: 'sine', slide: 0.7, gain: 0.18 * k }); E.audio.noise({ dur: 0.04, gain: 0.05 * k }); }
export function sliceSound(E, big) {
  const A = E.audio, f = 1500 + Math.random() * 500;
  A.noise({ dur: 0.1, gain: 0.26 });
  A.beep({ freq: f, dur: 0.09, type: 'sawtooth', slide: 0.22, gain: 0.07 });
  A.beep({ freq: 150, dur: 0.1, type: 'sine', slide: 0.45, gain: 0.26 });
  A.noise({ dur: 0.03, gain: 0.2, delay: 0.025 });
  A.noise({ dur: 0.03, gain: 0.16, delay: 0.055 });
  if (big) A.beep({ freq: 90, dur: 0.22, type: 'sine', slide: 0.4, gain: 0.3 });
}
export function clangSound(E, delay) {
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
// a wheel's landing chime, a little higher for each wheel k
export function landChime(E, k) { E.audio.beep({ freq: 440 + k * 60, dur: 0.1, type: 'triangle', gain: 0.13 }); E.audio.beep({ freq: 880 + k * 120, dur: 0.16, type: 'sine', gain: 0.07, delay: 0.06 }); }
// a wheel's ticker on a peg: a click, higher the slower the wheel turns (speed in radians per second)
export function tickSound(E, speed) { E.audio.beep({ freq: lerp(1500, 520, clamp(speed / 30, 0, 1)), dur: 0.025, type: 'square', gain: 0.045 }); }
// the crowd's "ooh": a few low voices sliding down together over a breath of noise (k: louder)
export function ooh(E, k = 1) {
  [196, 247, 294, 330].forEach((f, i) => E.audio.beep({ freq: f, dur: 0.6, type: i % 2 ? 'triangle' : 'sine', slide: 0.78, gain: 0.035 * k, delay: i * 0.02 }));
  E.audio.noise({ dur: 0.45, gain: 0.05 * k });
}
// the crowd chants your name: a clap for each step of their favour (one at least), louder the more they love you
export const chantN = () => 1 + Math.round((TUNING.story.chant.max - 1) * state.fav / TUNING.crowd.max);
export function chant(E) {
  const C = TUNING.story.chant, n = chantN(), g = C.gain + C.step * (n - 1);
  for (let i = 0; i < n; i++) {
    E.audio.noise({ dur: 0.06, gain: g, delay: i * C.gap });
    E.audio.beep({ freq: 196, dur: 0.16, type: 'triangle', gain: g * 0.8, delay: i * C.gap + 0.02 });
    E.audio.beep({ freq: 294, dur: 0.12, type: 'sine', gain: g * 0.5, delay: i * C.gap + 0.1 });
  }
}
// the crowd at the Emperor's thumb: a long roar
export function crowdVerdict(E) {
  const A = E.audio;
  for (let i = 0; i < 6; i++) A.noise({ dur: 0.3, gain: 0.22 - i * 0.02, delay: i * 0.22 });
  A.play('win');
}
export function swooshSound(E, gain = 0.12) { E.audio.noise({ dur: 0.16, gain }); E.audio.beep({ freq: 700, dur: 0.14, type: 'sine', slide: 0.3, gain: gain * 0.4 }); }
