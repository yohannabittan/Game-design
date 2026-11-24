// Arena: Feature: the sidearm, throwing knives and the bow (steps 22 and 24), with the first-knife lesson. Hooks: play.onPointerDown (armsTouch, aimDown, bowDown), play.update (stepArms, updateLesson), the HUD (drawArmsBtns, drawKnives), the tent and the purse (knifeRow, knifeBuy, rackBow).
// Split from game.js by tools/arena-split.mjs (ADR-0024). Only tuning.js and data.js may be read while modules load.

import { clamp, lerp } from '../engine.js';
import { TUNING } from '../tuning.js';
import { ARM_LEN, SHOULDER, PARTS } from '../data.js';
import { lay, youF, inReach, myH, myArm, foeF, toScreen, toLocal, partLocal, partCenter, guardPt, inside, fell, blood, sparks, ring, pop, dmgPop, slotSound,
  dullSound, sliceSound, clangSound, swooshSound, dust, mark, localDir } from '../fight.js';
import { covered, setCover } from '../foe.js';
import { staggerFoe, finLive, crowdEvent } from '../cards.js';
import { weaponKey, artPic, kitPic, TAU, line, lerp2, drawCoin, drawWeapon, shieldFace, drawArm } from '../draw-fight.js';
import { wield, iconWeapon, weaponTitle } from '../screens.js';
import { state, noShield, shake, meSize, ENG, kitOn, has, count } from '../game.js';
import { rangeLine, rangeK0, rangeArc, rangeLands, rangeMark, rangeArrowAt, rangeArrowLands } from './range.js';
import { chargeHit } from './charge.js';
import { YARD, GHOST, yardChime, yardTick, yardPlate, gapRings, ghostThumb, ghostAt } from '../features/yard.js';

// ====== RANGED: the sidearm, knives and the bow ======
// step 24: the bow is in your hand, from halfway through the swap to it until halfway through the swap back (the shield on your back the same)
export const bowShown = () => (state.swapT > 0 && state.bowSwap ? !!state.bowOut === state.swapT <= TUNING.bow.swap / 2 : !!state.bowOut);
// step 27: a knife up, or in its throw until the arm is back on guard: the sword hand holds only the knife
export const knifeShown = () => (!!state.aim && !state.aim.bow) || !!state.whip;
// ----- step 22: the sidearm (⇄) and throwing knives, two round buttons at the bottom right -----
// the purse's weapon id as the weapon wheel's (the mace is an axe that is a mace)
export const sideWield = (id) => [id === 'mace' ? 'axe' : id, id === 'mace'];
// never in the training yard (but its knife step, step 24) or the card lab
export const yardKnife = () => !!state.train && YARD[state.train.i].id === 'knife';
const armsLive = (E) => (!state.train || yardKnife()) && !state.lab && finLive(E);
// ⇄ in the corner while you carry a sidearm, the knife button above it (in the corner without one) while you carry a knife or aim one; w: the room
// they take from the finisher button and the hints
export function armsBtns(E) {
  if (!state.me || !armsLive(E)) return null;
  const B = TUNING.sidearm.btn, side = !!state.me.side, kn = !state.bowOut && (state.knives > 0 || (!!state.aim && !state.aim.bow));
  if (!side && !kn) return null;
  const x = E.w - 16 - E.safe.right - B.r, y0 = E.h - 10 - E.safe.bottom - B.r;
  // (KNIFE in the upper place, with or without ⇄ under it: the thumb slides down from it to aim low)
  return { swap: side && !state.train ? { x, y: y0, r: B.r } : null, knife: kn ? { x, y: y0 - 2 * B.r - B.gap, r: B.r } : null, w: 2 * B.r + B.gap };
}
export const armsW = (E) => { const b = armsBtns(E); return b ? b.w : 0; };
const onRound = (b, p) => !!b && Math.hypot(p.x - b.x, p.y - b.y) <= b.r + TUNING.finBtn.reach;
// a touch on ⇄ swaps; a thumb down on the knife button raises a knife, and that thumb aims and throws it
export function armsTouch(E, p) {
  const b = armsBtns(E);
  if (!b) return false;
  if (onRound(b.swap, p)) { startSwap(E); return true; }
  if (onRound(b.knife, p)) { if (!state.aim) startAim(E, p); return true; }
  return false;
}
// he sees you open: within his reach, his next blow comes soon
function seenOpen() { if (!state.sw && inReach()) state.swingIn = Math.min(state.swingIn, TUNING.sidearm.punish); }
// the swap: the weapon in your hand goes to your belt and the sidearm comes up; the hand is down for TUNING.sidearm.swap s (no swing), the shield too
export function startSwap(E) {
  if (state.swapT > 0 || (state.aim && !state.aim.bow) || !state.me.side) return;
  if (state.me.side === 'bow') { swapBow(E); return; }
  const S = TUNING.sidearm, h = state.hand, [w, m] = sideWield(state.me.side), was = weaponKey(state.me.weapon, state.me.mace);
  state.me = { ...wield(state.me, w, m), side: was };
  state.swapT = S.swap; state.bowSwap = false; state.mySwaps++;
  h.atk = null; h.lock = S.swap; h.hvx = 0; h.hvy = 240; h.grip = 0;
  const Fy = youF(E); pop(Fy.x, Fy.y - 1.2 * Fy.H, weaponTitle(state.me).toUpperCase(), '#fde68a', 16);
  swooshSound(E, 0.1); E.haptic(10);
  seenOpen();
}
// step 27, one press: the thumb down on KNIFE raises a knife, the arm drawn back; open (no block, no swing) until it is thrown or put away. That
// thumb's height alone aims it (knifeAim); its release throws once the knife is up (TUNING.knives.aim s). With no thumb (p), the line is at rest.
export function startAim(E, p) {
  if (state.knives <= 0 || state.swapT > 0 || state.bowOut) return;
  const h = state.hand;
  h.down = false; h.atk = null;
  state.aim = { t: 0, id: p ? p.id : -1, ty: p ? p.y : null, sy: p ? p.y : 0, k0: chestK(E), go: false, x: 0, y: 0, over: 'miss' };
  knifeAim(E);
  E.audio.beep({ freq: 880, dur: 0.06, type: 'triangle', gain: 0.08 }); E.haptic(8);
  seenOpen();
}
// the bow's thumb: where it went down, and its slide up or down from there turns the angle (a knife's thumb is its own, from the press)
export function aimDown(E, p) { const a = state.aim; if (!a.bow) return; a.id = p.id; a.sx = p.x; a.sy = p.y; a.go = false; aimAt(E, p); }
export function aimAt(E, p) {
  const a = state.aim;
  if (!a.bow) { a.ty = p.y; return; }
  a.tx = p.x; a.ty = p.y;
  bowAim(E);
}
// the thumb lifted: the knife flies along its line, however short the press (once it is up). Only a thumb slid down off the bottom edge puts it
// away, and says so (back over the button is his chest again, where a plain press aims, so it throws)
export function aimUp(E, p) {
  const a = state.aim, K = TUNING.knives;
  // (a thumb down while the bow comes up draws once it is up; let go before that, it looses then)
  if (a.bow) { if (p && p.cancelled) state.aim = null; else if (state.swapT > 0) { a.go = true; a.id = -1; } else bowRelease(E); return; }
  a.id = -1;
  if (p && (p.cancelled || (p.y >= E.h - K.edge && p.y > a.sy))) {
    const [hx, hy] = knifeHand();
    state.aim = null; pop(hx, hy - 24, 'NO THROW', '#e2e8f0', 18); E.audio.beep({ freq: 520, dur: 0.1, type: 'triangle', slide: 0.6, gain: 0.07 }); E.haptic(6);
    return;
  }
  a.go = true;
}
// what a knife arriving at (x, y) meets now: an open gap, plate (or his shield or guard), bare skin, or nothing (his parts, slots first: order)
const slotsFirst = (fm) => fm.parts.filter((q) => q.slot).concat(fm.parts.filter((q) => !q.slot));
export function knifeAt(E, x, y, order = null) {
  const K = TUNING.knives, F = foeF(E), fm = state.foe;
  if (state.fallT > 0 || fm.hp <= 0 || !fm.parts) return { p: null, kind: 'miss' };
  const [lx, ly] = toLocal(F, x, y);
  for (const p of order || slotsFirst(fm)) {
    const [qx, qy] = partLocal(p, fm, lx, ly);
    if (inside(p.d, qx, qy, K.pad / F.H)) return { p, kind: p.slot && !covered(p) ? 'gap' : covered(p) ? 'plate' : 'skin', lx: qx, ly: qy };
  }
  return { p: null, kind: 'miss' };
}
// where the raised knife is held: in your sword hand, drawn back beside your head (moveHand)
function knifeHand() { return [state.hand.hx, state.hand.hy]; }
const wrapA = (x) => Math.atan2(Math.sin(x), Math.cos(x));
export const backPt = (E) => { const Fy = youF(E), R = TUNING.knives.raise, [sx, sy] = toScreen(Fy, SHOULDER[0], SHOULDER[1]); return [sx + R[0] * Fy.dir * Fy.H, sy + R[1] * Fy.H]; };
// where the sword hand goes with a knife up: drawn back; in a throw (state.whip) it whips forward along the throw, follows through, and goes
// back to guard, on the whip's own clock (the third value says: no easing in moveHand)
export function raisePt(E) {
  const w = state.whip, back = backPt(E);
  if (!w) return back;
  const K = TUNING.knives, Fy = youF(E), H = Fy.H, [t1, t2, t3] = K.whip, [sx, sy] = toScreen(Fy, SHOULDER[0], SHOULDER[1]), e = (u) => { const v = clamp(u, 0, 1); return v * v * (3 - 2 * v); };
  const fw = [sx + w.ux * K.fwd[0] * H, sy + w.uy * K.fwd[0] * H], ft = [fw[0] + w.ux * K.fwd[1] * H, fw[1] + w.uy * K.fwd[1] * H + K.fwd[2] * H];
  // (round the shoulder, over the head, not across the face)
  if (w.t < t1) {
    const u = e(w.t / t1), [fx, fy] = [w.from[0] - sx, w.from[1] - sy], a0 = Math.atan2(fy, fx), a1 = Math.atan2(w.uy, w.ux), r = lerp(Math.hypot(fx, fy), K.fwd[0] * H, u), an = a0 + wrapA(a1 - a0) * u;
    return [sx + Math.cos(an) * r, sy + Math.sin(an) * r, true];
  }
  if (w.t < t2) return [...lerp2(fw, ft, e((w.t - t1) / (t2 - t1))), true];
  return [...lerp2(ft, guardPt(E), e((w.t - t2) / (t3 - t2))), true];
}
// the line's height at his middle, as the share k of TUNING.knives.at (0: at[0], 1: at[1]), that runs through (x, y)
function lineK(E, x, y) {
  const K = TUNING.knives, F = foeF(E), [ox, oy] = backPt(E), yF = oy + (y - oy) * (F.x - ox) / (x - ox || 1);
  return (K.at[0] - (F.y - yF) / F.H) / (K.at[0] - K.at[1]);
}
// where a plain press aims: the bare skin nearest his chest (a line that crosses no gap: a stray press is no gap hit), a little inside it, as he
// breathes; with no bare skin near, the plate nearest; else his chest's middle
function chestK(E) {
  if (state.range) return rangeK0(E, backPt(E));
  const fm = state.foe, c = fm && fm.parts && fm.parts.find((q) => q.d.id === 'chest'), K = TUNING.knives, st = 0.004;
  if (!c) return (K.at[0] - K.rest) / (K.at[0] - K.at[1]);
  const k0 = clamp(lineK(E, ...partCenter(foeF(E), fm, c)), 0, 1), memo = new Map(), at = (k) => { if (!memo.has(k)) memo.set(k, lineAt(E, k)); return memo.get(k); };
  for (const want of ['skin', 'plate']) {
    for (let j = 0; j <= 80; j++) for (const dir of [-1, 1]) {
      const k = k0 + dir * j * st;
      if (k < 0 || k > 1 || at(k).over !== want) continue;
      // (on into that part the way it was found, K.inside of k, or to its middle if it is narrower than twice that)
      let m = 0; const n = Math.round(2 * K.inside / st), kk = (i) => k + dir * i * st, p = at(k).hit;
      while (m < n && kk(m + 1) >= 0 && kk(m + 1) <= 1 && at(kk(m + 1)).over === want && at(kk(m + 1)).hit === p) m++;
      return kk(Math.floor(m / 2));
    }
  }
  return k0;
}
let chestMemo = { t: -1, k: 0 };
const chestNow = (E) => { if (state.m !== chestMemo.t) chestMemo = { t: state.m, k: chestK(E) }; return chestMemo.k; };
// the knife's line: from the drawn-back hand to his middle at a height set by the thumb: the press aims at the skin nearest his chest (a.k0), and
// the thumb's slide up or down from where it went down moves the line from there, TUNING.knives.gain's shares of the screen's height for all of .at
// (up, down); sideways counts for nothing. Where it goes (a.x, a.y, a.over, a.hit): an open gap the line crosses on him (of two, the one it runs nearer the middle of); else the
// first thing on him it meets (plate, skin); else nothing, on past him. a.x, a.y is a point on the line inside that part, the nearest to the middle
// of the line's run through it. Checked every frame, as he moves; a release takes it as it is (throwKnife), and that is what happens.
function knifeAim(E) {
  const a = state.aim, dy = a.ty == null ? 0 : a.ty - a.sy, k = clamp(a.k0 + dy / (TUNING.knives.gain[dy < 0 ? 0 : 1] * E.h), 0, 1);
  Object.assign(a, lineAt(E, k), { k });
}
export function lineAt(E, k) {
  if (state.range) return rangeLine(E, k, backPt(E));
  const K = TUNING.knives, F = foeF(E), [ox, oy] = backPt(E), floor = lay(E).floor;
  const ex = F.x, ey = F.y - lerp(K.at[0], K.at[1], k) * F.H, d = Math.hypot(ex - ox, ey - oy) || 1, ux = (ex - ox) / d, uy = (ey - oy) / d;
  const runs = new Map(), order = state.foe.parts ? slotsFirst(state.foe) : null;
  let first = null, gap = null, end = d + F.H / 2;
  // (from half his height before his middle to as far past it)
  for (let s = Math.max(0, d - F.H / 2); s <= end; s += 2) {
    const x = ox + ux * s, y = oy + uy * s;
    if (y >= floor) { end = s; break; }
    const t = knifeAt(E, x, y, order);
    if (t.kind === 'miss') continue;
    const r = runs.get(t.p) || { p: t.p, kind: t.kind, at: [] };
    r.at.push(s); runs.set(t.p, r);
    if (t.kind === 'gap') {
      const [cx, cy] = partCenter(F, state.foe, t.p), off = Math.abs((cx - ox) * uy - (cy - oy) * ux);
      if (!gap || (gap.p !== t.p && off < gap.off)) gap = { p: t.p, off };
    } else if (!first) first = { p: t.p };
  }
  const q = gap || first, r = q && runs.get(q.p);
  let sm = end;
  if (r) { const mid = (r.at[0] + r.at[r.at.length - 1]) / 2; sm = r.at.reduce((b, v) => (Math.abs(v - mid) < Math.abs(b - mid) ? v : b), r.at[0]); }
  return { ex, ey, x: ox + ux * sm, y: Math.min(floor, oy + uy * sm), over: r ? r.kind : 'miss', part: r ? r.p.d.id : null, hit: r ? r.p : null };
}
// the thumb height (px) whose line runs through (x, y): for the lesson's ghost, and the checks
// (from a thumb gone down on the knife button at (bx, by))
export function knifeThumb(E, x, y, by) {
  const dk = lineK(E, x, y) - chestNow(E);
  return by + dk * TUNING.knives.gain[dk < 0 ? 0 : 1] * E.h;
}
// thrown: spent at once, and what it hits decided now, as its line showed it (the part, and the point on him in his own frame, so his breathing and
// steps carry the point and change nothing); the arm whips forward along the throw and the knife leaves the hand TUNING.knives.release s in
function throwKnife(E) {
  const a = state.aim, h = state.hand, [sx, sy] = toScreen(youF(E), SHOULDER[0], SHOULDER[1]), d = Math.hypot(a.x - sx, a.y - sy) || 1;
  state.aim = null; state.knives--; state.knivesThrown++;
  state.whip = { t: 0, out: false, x1: a.x, y1: a.y, at: state.range ? null : toLocal(foeF(E), a.x, a.y), p: a.hit, kind: a.over, ux: (a.x - sx) / d, uy: (a.y - sy) / d, from: [h.tgx, h.tgy], ...(state.range && { o: a.o }) };
  swooshSound(E, 0.1); E.haptic(10);
}
// the knife leaves the hand, and flies to its point at TUNING.knives.speed; it finds what is there when it arrives
function loose(E, w) {
  const [x1, y1] = w.at ? toScreen(foeF(E), ...w.at) : [w.x1, w.y1], [x0, y0] = knifeHand(), d = Math.hypot(x1 - x0, y1 - y0);
  w.out = true;
  // (the range trials' knife rises a little in flight, straight along its line: rangeLands finds what is on it when it arrives)
  state.knife = { x0, y0, x1, y1, at: w.at, p: w.p, kind: w.kind, t: 0, dur: Math.max(0.05, d / (TUNING.knives.speed * youF(E).H)), arc: state.range ? rangeArc(E, x0, x1) : 0, ...(state.range && { o: w.o }) };
}
export function stepArms(E, dt) {
  state.swapT = Math.max(0, state.swapT - dt);
  if (state.bowOut) state.bowTime += dt;
  if (state.follow) state.follow.t -= dt;
  const a = state.aim;
  if (a && !armsLive(E)) state.aim = null;
  else if (a && a.bow) { const B = TUNING.bow, d0 = a.draw; if (state.swapT <= 0) a.draw += dt; if ((d0 < B.draw && a.draw >= B.draw) || (d0 < B.full && a.draw >= B.full)) drawTick(E, a.draw >= B.full); bowAim(E); if (a.go && state.swapT <= 0) bowRelease(E); }
  // (a knife let go while the last is still in the air leaves the hand as that one lands: one in flight at a time, none lost)
  else if (a) { knifeAim(E); if ((a.t += dt) >= TUNING.knives.aim && a.go && !state.knife && !(state.whip && !state.whip.out)) throwKnife(E); }
  const w = state.whip;
  if (w) { w.t += dt; if (!w.out && w.t >= TUNING.knives.release) loose(E, w); if (w.t >= TUNING.knives.whip[2]) state.whip = null; }
  const k = state.knife;
  if (k && k.at) [k.x1, k.y1] = toScreen(foeF(E), ...k.at);
  if (k && (k.t += dt) >= k.dur) { state.knife = null; knifeLands(E, k); }
  // (an arrow loosed while another flies: both fly on and both land, each saying what it hit)
  const ar = state.arrow, vo = state.volley;
  if (ar && flyArrow(E, dt, ar) && state.arrow === ar) state.arrow = null;
  if (vo) for (const r of vo.slice()) if (flyArrow(E, dt, r) && vo.includes(r)) vo.splice(vo.indexOf(r), 1);
  state.knifeFall = fallStep(state.knifeFall, dt);
  state.arrowFall = fallStep(state.arrowFall, dt);
  state.bowNock = bowShown() ? toLocal(youF(E), ...stringHand(E)) : null;
}
// a spent knife or arrow, falling to the sand and lying there a while
function fallStep(q, dt) {
  if (!q) return null;
  q.life -= dt; q.vy += 1600 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt;
  if (q.y >= q.floor) { q.y = q.floor; q.vx = q.vy = q.vr = 0; q.rot = q.flat; }
  return q.life > 0 ? q : null;
}
// ----- step 24: the bow -----
// ⇄ with the bow: it comes up (your blade to the belt, the shield to your back) or goes down again (both back), in TUNING.bow.swap s, open all the
// while it is out; raising it brings him on (stepFoe), and a beast's next blow sooner
export function swapBow(E) {
  const B = TUNING.bow, h = state.hand, sh = state.sh;
  state.aim = null; state.bowOut = !state.bowOut; state.bowSwap = true; state.swapT = B.swap; state.mySwaps++;
  h.atk = null; h.down = false; h.lock = B.swap; h.hvx = 0; h.hvy = 240; h.grip = 0;
  sh.held = false; sh.hid = -1; sh.t = -1; sh.arm = 0;
  const Fy = youF(E); pop(Fy.x, Fy.y - 1.2 * Fy.H, state.bowOut ? 'BOW' : weaponTitle(state.me).toUpperCase(), '#fde68a', 16);
  if (state.bowOut && state.foe.beast) state.swingIn = Math.min(state.swingIn, B.pounce);
  swooshSound(E, 0.1); E.haptic(10);
  seenOpen();
}
// the right thumb down with the bow out starts the draw: the angle that puts a full draw's arrow on his chest (the range's mark), the thumb's
// slide turning it from there
export function bowDown(E, p) {
  const mark = state.range ? null : chestMark(E);
  state.aim = { bow: true, draw: 0, t: 0, id: -1, mark, a0: chestAng(E, { mark }), ang: 0, pw: TUNING.bow.weak, sx: p.x, sy: p.y, tx: p.x, ty: p.y, go: false, over: 'miss', path: [], x: 0, y: 0 };
  aimDown(E, p);
  E.audio.beep({ freq: 180, dur: TUNING.bow.full, type: 'triangle', slide: 1.4, gain: 0.05 }); E.haptic(6);
}
// the bow's power (0 to 1) after a hold of d s: weak at once, mid at the draw's tick, 1 at full
export function bowPower(d) { const B = TUNING.bow; return d < B.draw ? lerp(B.weak, B.mid, d / B.draw) : lerp(B.mid, 1, clamp((d - B.draw) / (B.full - B.draw), 0, 1)); }
const arrowV = (E, pw) => lerp(TUNING.bow.vMin, TUNING.bow.vMax, pw) * lay(E).H;
const grav = (E) => TUNING.bow.grav * lay(E).H;
// the string's draw (0 to 1): from the string at rest to your cheek at a full draw (TUNING.bow.full), quick at first and settling into it
const pullK = (a) => (a && a.bow ? Math.sin(Math.PI / 2 * clamp(a.draw / TUNING.bow.full, 0, 1)) : 0);
function drawTick(E, full) { E.audio.beep({ freq: full ? 1320 : 990, dur: 0.05, type: 'triangle', gain: 0.07 }); E.haptic(full ? 14 : 8); }
// where a full draw's arrow leaves the bow along ang: its nock at your cheek (the anchor), its point an arrow's length on
function launchAt(E, ang) {
  const [sx, sy] = anchorPt(E), r = arrowLen(E);
  return [sx + Math.cos(ang) * r, sy + Math.sin(ang) * r];
}
// the angle whose full-draw flight passes through (x, y) (its drop allowed for): the shot leaves along a line from your cheek, so that is the origin
function angTo(E, x, y) {
  const v = arrowV(E, 1), g = grav(E), [sx, sy] = anchorPt(E), r = arrowLen(E), dx = Math.max(1, x - sx);
  let ang = Math.atan2(y - sy, dx);
  for (let i = 0; i < 6; i++) { const t = Math.max(0, dx - r * Math.cos(ang)) / (v * Math.cos(ang)); ang = Math.atan2(y - sy - 0.5 * g * t * t, dx); }
  return clamp(ang, TUNING.bow.ang[0], TUNING.bow.ang[1]);
}
// where a plain press aims: the middle of the bare part nearest his chest's that a full draw's flight meets first (his chest, else his belly; a
// barded beast's foreleg, its plated head and chest standing in front of its belly), never a gap; as a point on him, so the aim stays on it while he
// moves (a charging beast). With none, his chest's middle (or his belly's when the chest is plated). On the range, its mark (rangeMark), held still
function chestMark(E) {
  const fm = state.foe, F = foeF(E), part = (id) => fm && fm.parts && fm.parts.find((q) => q.d.id === id), c = [part('chest'), part('belly')].find((q) => q && !covered(q)) || part('chest');
  if (!c) return toLocal(F, F.x, F.y - TUNING.knives.rest * F.H);
  const [cx, cy] = partCenter(F, fm, part('chest') || c), v = arrowV(E, 1);
  const bare = fm.parts.filter((q) => !q.slot && !covered(q)).map((q) => partCenter(F, fm, q)).sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
  for (const at of bare) { const ang = angTo(E, ...at), [x0, y0] = launchAt(E, ang); if (flight(E, x0, y0, Math.cos(ang) * v, Math.sin(ang) * v).over === 'skin') return toLocal(F, ...at); }
  return toLocal(F, ...partCenter(F, fm, c));
}
const chestAng = (E, a) => angTo(E, ...(state.range ? rangeMark(E) : toScreen(foeF(E), ...(a && a.mark || chestMark(E)))));
// the aim each frame: the angle from the thumb's slide, the power from the hold, and the flight it gives now (a.path, what it meets: a.over at a.x, a.y)
function bowAim(E) {
  const B = TUNING.bow, a = state.aim;
  if (a.mark) a.a0 = chestAng(E, a);
  a.ang = clamp(a.a0 + (a.ty - a.sy) / E.h * B.gain, B.ang[0], B.ang[1]); a.pw = bowPower(a.draw);
  const [x0, y0] = bowShown() ? arrowTip(E, a) : launchAt(E, a.ang), v = arrowV(E, a.pw), q = flight(E, x0, y0, Math.cos(a.ang) * v, Math.sin(a.ang) * v);
  Object.assign(a, { path: q.path, over: q.over, x: q.x, y: q.y });
}
// a flight from (x, y) at (vx, vy) px/s, falling: its points, and the first thing it meets (his parts, the range's marks, the sand) or the screen's edge
function flight(E, x, y, vx, vy) {
  const L = lay(E), g = grav(E), h = 1 / 120, path = [x, y];
  for (let i = 0; i < 480; i++) {
    const px = x, py = y;
    vy += g * h; x += vx * h; y += vy * h;
    path.push(x, y);
    const m = arrowMeets(E, px, py, x, y);
    if (m) return { path, ...m };
    if (y >= L.floor) return { path, over: 'sand', x, y: L.floor };
    if (x > E.w + 40 || x < -40 || y < -E.h) break;
  }
  return { path, over: 'miss', x, y };
}
// what an arrow going from (x0, y0) to (x1, y1) meets: on the range, its marks; in a fight, the first of his parts (as a knife's point finds them)
function arrowMeets(E, x0, y0, x1, y1) {
  if (state.range) return rangeArrowAt(E, x0, y0, x1, y1);
  const t = knifeAt(E, x1, y1);
  return t.kind === 'miss' ? null : { over: t.kind, x: x1, y: y1 };
}
// the thumb lifted: the arrow always flies, at the power of its hold (inside his reach it bites less: close)
export function bowRelease(E) {
  const B = TUNING.bow, a = state.aim, [x0, y0] = arrowTip(E, a), v = arrowV(E, a.pw);
  state.aim = null;
  state.arrows++; state.follow = { ang: a.ang, t: B.follow, dep: nockDep(E, bowFrame(E, a), a) / myH(E) };
  if (state.arrow) (state.volley || (state.volley = [])).push(state.arrow);
  state.arrow = { x: x0, y: y0, vx: Math.cos(a.ang) * v, vy: Math.sin(a.ang) * v, pw: a.pw, close: !state.range && inReach() };
  swooshSound(E, 0.12); E.audio.beep({ freq: 140, dur: 0.12, type: 'triangle', slide: 0.5, gain: 0.12 }); E.haptic(14);
}
// an arrow in flight, in small steps: it falls, and lands on the first thing in its way as it is now (a charging beast moves while it flies); true once landed
function flyArrow(E, dt, r) {
  const L = lay(E), g = grav(E), n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
  for (let i = 0; i < n; i++) {
    const px = r.x, py = r.y;
    r.vy += g * h; r.x += r.vx * h; r.y += r.vy * h;
    const m = arrowMeets(E, px, py, r.x, r.y), hit = { x0: px, y0: py, x1: r.x, y1: r.y, pw: r.pw, close: r.close };
    if (m) { if (state.range) rangeArrowLands(E, hit, m); else arrowLands(E, hit); return true; }
    if (r.y >= L.floor || r.x > E.w + 40 || r.x < -40 || r.y < -E.h) {
      if (state.range) rangeArrowLands(E, hit, { over: 'miss', x: r.x, y: Math.min(r.y, L.floor) }); else arrowLands(E, { ...hit, y1: Math.min(r.y, L.floor) });
      return true;
    }
  }
}
// the ordinary gap hit: a gladius jab's in a gap, at your Strength and size
export const plainGap = () => Math.max(1, Math.round(TUNING.attack.jab.dmg * TUNING.me.str[state.me.str - 1] * meSize().dmg * TUNING.me.weapons.gladius.slot));
// an arrow's bite: power x (base + (1 - base) x its power), and close x that inside his reach
const arrowK = (r) => { const B = TUNING.bow, pw = r.pw == null ? 1 : r.pw; return B.power * (B.base + (1 - B.base) * pw) * (r.close ? B.close : 1); };
// what the arrow meets where it arrives: a gap, TUNING.bow.gap x the ordinary gap hit (GAP!); bare skin, a light hit and a stagger (STAGGER); plate or
// his shield or guard, nothing (PLATE, a clang, it drops); nothing, MISSED, it sticks in the sand or flies on. Harder by its power (arrowK). A
// charging beast takes it by the charge's rules (chargeHit).
export function arrowLands(E, r) {
  const B = TUNING.bow, J = TUNING.juice, f = state.foe, at = { x: r.x1, y: r.y1 }, ang = Math.atan2(r.y1 - r.y0, r.x1 - r.x0), { p, kind } = knifeAt(E, r.x1, r.y1), L = lay(E), k = arrowK(r);
  const fall = (vx, vy) => { state.arrowFall = { x: at.x, y: at.y, vx, vy, rot: ang, vr: (Math.random() < 0.5 ? -1 : 1) * 8, flat: Math.PI * (Math.random() < 0.5 ? 0.02 : 0.98), floor: L.floor - 2, life: B.fall }; };
  if (state.charge && kind !== 'miss') { if (chargeHit(E, p, kind, at, ang, r.pw == null ? 1 : r.pw) === 'PLATE') fall(-Math.cos(ang) * 120, -140); return; }
  if (kind === 'gap') {
    const dealt = Math.round(plainGap() * B.gap * k * 2) / 2;
    p.cool = TUNING.hit.cool; p.flash = 0.16; state.gapHits++; state.slotHits++; state.arrowGaps++; state.bout.gaps[p.d.id] = (state.bout.gaps[p.d.id] || 0) + 1;
    f.hp -= dealt;
    blood(at.x, at.y, ang, J.blood.slot); ring(at.x, at.y, J.slotRing, '#ef4444'); slotSound(E); sliceSound(E, true);
    pop(at.x, at.y - 30, 'GAP!', '#ffd24a', 22); dmgPop(E, at, dealt, '#ff6a4a'); shake(E, 8, 0.1); E.haptic(30); E.flash('#fff0b8', 0.07);
    state.stop = Math.max(state.stop, J.slotStop);
    crowdEvent(E, 'slot');
    if (f.hp <= 0) fell(E); else setCover(p);
    return;
  }
  if (kind === 'skin') {
    const dealt = Math.round(B.skin * k * 2) / 2;
    state.arrowSkin++; f.hp -= dealt;
    blood(at.x, at.y, ang, 6); dullSound(E); pop(at.x, at.y - 30, 'STAGGER', '#fbbf24', 22); dmgPop(E, at, dealt, '#fca5a5'); E.haptic(16);
    if (f.hp <= 0) fell(E); else staggerFoe(E, true);
    return;
  }
  if (kind === 'plate') { state.arrowPlate++; p.clang = 0.25; sparks(at.x, at.y, ang + Math.PI, 12); ring(at.x, at.y, 30, '#cbd5e1'); clangSound(E, 0); pop(at.x, at.y - 24, 'PLATE', '#cbd5e1', 20); E.haptic(12); fall(-Math.cos(ang) * 120, -140); return; }
  state.arrowMiss++; pop(clamp(at.x, 40, E.w - 40), clamp(at.y, E.safe.top + 60, L.floor) - 24, 'MISSED', '#e2e8f0', 20); E.audio.play('miss');
  // (into the sand it sticks where it fell, at its angle)
  if (at.y >= L.floor - 1) state.arrowFall = { x: at.x, y: L.floor + 2, vx: 0, vy: 0, rot: ang, vr: 0, flat: ang, floor: L.floor + 2, life: B.fall };
}
// where the bow sits: its grip in your fist, its belly along the aim's angle (or along your arm) and its string toward you; pt maps a point of its
// painting (TUNING.bow.art, px) to the screen
function bowFrame(E, a = state.aim) {
  const h = state.hand, A = TUNING.bow.art, k = bowScale(E);
  const q = a && a.bow ? a : state.follow && state.follow.t > 0 ? state.follow : null, an = q ? q.ang : h.ang, ux = Math.cos(an), uy = Math.sin(an);
  return { A, k, ux, uy, pt: (x, y) => [h.hx + (ux * (x - A.grip[0]) - uy * (y - A.grip[1])) * k, h.hy + (uy * (x - A.grip[0]) + ux * (y - A.grip[1])) * k] };
}
// the bow painting's scale (screen px per painting px)
export const bowScale = (E) => { const A = TUNING.bow.art; return TUNING.bow.len * myH(E) / (A.rest[1][1] - A.rest[0][1]); };
// your cheek, where a full draw's string comes to (TUNING.bow.anchor, your body's frame)
const anchorPt = (E) => toScreen(youF(E), ...TUNING.bow.anchor);
// your far shoulder, where the drawing arm hangs from
const drawShoulder = (E) => toScreen(youF(E), ...PARTS[4].joint);
// how far behind the grip (px, along the arrow) the string hand holds the string: at rest where the painted string is, at a full draw at your cheek
// (the anchor, seen along the arrow), and never beyond what the drawing arm reaches from its shoulder (the string follows the hand)
function nockDep(E, f, a) {
  const A = TUNING.bow.art, h = state.hand, rest = (A.grip[0] - A.rest[0][0]) * f.k, [ax, ay] = anchorPt(E), [jx, jy] = drawShoulder(E), R = myArm(E) * TUNING.bow.reach;
  const full = Math.max(rest, (h.hx - ax) * f.ux + (h.hy - ay) * f.uy), vx = h.hx - jx, vy = h.hy - jy, b = vx * f.ux + vy * f.uy, q = b * b - (vx * vx + vy * vy) + R * R;
  return Math.max(lerp(rest, full, pullK(a)), q >= 0 ? b - Math.sqrt(q) : b);
}
// the string hand now: on the nock while you draw; after a loose it stays back a moment (TUNING.bow.follow, the second half easing it to the string),
// then rests on the string by the grip
function stringHand(E) {
  const a = state.aim && state.aim.bow ? state.aim : null, f = bowFrame(E, a), fo = !a && state.follow && state.follow.t > 0 ? state.follow : null, rest = nockDep(E, f, null);
  const d = a ? nockDep(E, f, a) : fo ? lerp(rest, fo.dep * myH(E), clamp(fo.t / (TUNING.bow.follow / 2), 0, 1)) : rest;
  return [state.hand.hx - f.ux * d, state.hand.hy - f.uy * d];
}
// the drawing arm (your far arm, drawArm's record): from its shoulder to the string hand. Drawn back, its forearm runs back from the hand along the
// arrow, tipped up by TUNING.bow.elbow, the elbow behind your head (the upper arm short as it turns toward you); nearer the bow it bends as an arm does
const DRAW_ARM = { bare: true, lock: 0, sl: 0, ph: 0 };
export function drawArmRec(E) {
  const [sx, sy] = drawShoulder(E), [hx, hy] = stringHand(E), U = myArm(E) / 2, q = state.aim && state.aim.bow ? state.aim : state.follow && state.follow.t > 0 ? state.follow : null;
  const ea = (q ? q.ang : state.hand.ang) + Math.PI + TUNING.bow.elbow;
  let ex = hx + Math.cos(ea) * U, ey = hy + Math.sin(ea) * U;
  if (Math.hypot(ex - sx, ey - sy) > U) {
    const dx = hx - sx, dy = hy - sy, l = Math.hypot(dx, dy) || 1, half = Math.min(l, 2 * U) / 2, bend = Math.sqrt(Math.max(0, U * U - half * half));
    // (of the two bends, the one with the elbow behind you; down rather than up when the hand is level with the shoulder)
    const sd = -dy / l - 0.3 * dx / l >= 0 ? 1 : -1;
    ex = sx + dx / l * half + sd * dy / l * bend; ey = sy + dy / l * half - sd * dx / l * bend;
  }
  return Object.assign(DRAW_ARM, { sx, sy, ex, ey, hx, hy, ph: Math.atan2(hy - ey, hx - ex) });
}
// the arrow's drawn length, nock to tip (TUNING.bow.arrow.len)
export const arrowLen = (E) => TUNING.bow.arrow.len * myH(E);
// the nocked arrow's point now
function arrowTip(E, a) {
  const f = bowFrame(E, a), d = nockDep(E, f, a), len = arrowLen(E);
  return [state.hand.hx + f.ux * (len - d), state.hand.hy + f.uy * (len - d)];
}
// where your sword hand holds the bow: while you draw (and for TUNING.bow.follow s after a loose) the arm straight, the grip where the arrow's line
// from your cheek along the aim's angle meets the arm's reach, so the drawn string comes to your cheek; low and forward with no thumb down
export function bowPt(E) {
  const H = myH(E), [sx, sy] = toScreen(youF(E), SHOULDER[0], SHOULDER[1]), a = state.aim;
  const q = a && a.bow ? a : state.follow && state.follow.t > 0 ? state.follow : null;
  if (q) {
    const [ax, ay] = anchorPt(E), ux = Math.cos(q.ang), uy = Math.sin(q.ang), wx = ax - sx, wy = ay - sy, b = wx * ux + wy * uy, R = myArm(E) * TUNING.arm.full;
    const D = -b + Math.sqrt(Math.max(0, b * b - wx * wx - wy * wy + R * R)), gx = wx + ux * D, gy = wy + uy * D, l = Math.hypot(gx, gy) || 1, r = TUNING.arm.straightAt * H * 1.05;
    return [sx + gx / l * r, sy + gy / l * r];
  }
  return [sx + TUNING.bow.rest[0] * H, sy + TUNING.bow.rest[1] * H];
}
// the arrow, its nock at (x, y) and its point len px along ang: Pack 29's painting, or drawn. ks: the painting's scale; in a fight the bow's, so a
// long arrow keeps its fletching and head and only its shaft is longer (the rack's is the painting as it is)
export function drawArrow(ctx, x, y, ang, len, ks = len / (TUNING.bow.arrow.tip[0] - TUNING.bow.arrow.nock[0])) {
  const R = TUNING.bow.arrow, P = kitOn() && artPic('arrow', R, (R.tip[0] - R.nock[0]) * ks * Math.min((ENG && ENG.dpr) || 1, TUNING.skin.maxDpr));
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  // (drawn thick x R.thick across, or the painted shaft is a hairline at game size)
  if (P) {
    const S = R.slice, im = P.im, kx = P.kx, top = -R.nock[1] * ks * R.thick, h = R.size[1] * ks * R.thick, a = (S[0] - R.nock[0]) * ks, b = len - (R.tip[0] - S[1]) * ks;
    // (the shaft is stroked, so it reads over an arm or the sand at any length; the fletching and head are the painting's)
    const sw = Math.max(1.4, R.shaft * ks);
    ctx.lineCap = 'butt'; ctx.strokeStyle = 'rgba(30,18,8,0.8)'; ctx.lineWidth = sw + 1.4; line(ctx, a - 2, 0, b + 2, 0); ctx.strokeStyle = '#9a6a3a'; ctx.lineWidth = sw; line(ctx, a - 2, 0, b + 2, 0);
    ctx.drawImage(im, 0, 0, S[0] * kx, im.height, -R.nock[0] * ks, top, S[0] * ks, h);
    ctx.drawImage(im, S[1] * kx, 0, (R.size[0] - S[1]) * kx, im.height, b, top, (R.size[0] - S[1]) * ks, h);
  } else {
    const n = (R.tip[0] - R.nock[0]) * ks;
    ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = Math.max(1.5, n * 0.025); line(ctx, 0, 0, len - n * 0.08, 0);
    ctx.fillStyle = '#3a3f47'; ctx.beginPath(); ctx.moveTo(len, 0); ctx.lineTo(len - n * 0.1, -n * 0.035); ctx.lineTo(len - n * 0.1, n * 0.035); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8e2d2'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(n * 0.02, 0); ctx.lineTo(n * 0.16, 0); ctx.lineTo(n * 0.05, sd * n * 0.04); ctx.closePath(); ctx.fill(); }
  }
  ctx.restore();
}
// the painted bow with its painted string taken out (once per copy), so the string can be drawn to the hand however far it is drawn
const UNSTRUNG = new WeakMap();
function unstrung(P, ends, nock) {
  let c = UNSTRUNG.get(P.im);
  if (c) return c;
  const A = TUNING.bow.art, cv = new OffscreenCanvas(P.im.width, P.im.height), g = cv.getContext('2d'), T = A.unstring;
  g.drawImage(P.im, 0, 0); g.globalCompositeOperation = 'destination-out'; g.scale(P.kx, P.ky); g.lineWidth = T[0]; g.lineCap = 'round';
  const m = [nock, A.grip[1]], at = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];
  // (from just inside each tip, so the limbs' ends are untouched)
  if (nock >= A.rest[0][0] - 1) { g.beginPath(); g.moveTo(...at(ends[0], ends[1], T[1])); g.lineTo(...at(ends[1], ends[0], T[1])); g.stroke(); }
  else { g.beginPath(); g.moveTo(...at(ends[0], m, T[1])); g.lineTo(...m); g.lineTo(...at(ends[1], m, T[1])); g.stroke(); }
  c = { im: cv }; UNSTRUNG.set(P.im, c);
  return c;
}
// the bow in your hand: Pack 29's bow at rest and drawn, crossfading as the draw fills (TUNING.bow.art.fade), its string from tip to tip through
// the string hand while you draw (straight at rest); with no painting, a drawn one
export function drawBow(ctx, E) {
  const B = TUNING.bow, A = B.art, a = state.aim && state.aim.bow ? state.aim : null, f = bowFrame(E, a), dk = pullK(a), px = (A.rest[1][1] - A.rest[0][1]) * f.k * Math.min(E.dpr || 1, TUNING.skin.maxDpr);
  const R = kitOn() && artPic('weapon-bow', A, px), D = kitOn() && artPic('weapon-bow-drawn', A, px), nx = a ? A.grip[0] - nockDep(E, f, a) / f.k : A.rest[0][0], ny = A.grip[1];
  const x = R && D ? clamp((dk - A.fade[0]) / (A.fade[1] - A.fade[0]), 0, 1) : dk, ends = A.rest.map((q, i) => lerp2(q, A.drawn[i], x));
  if (R && D) {
    const o = f.pt(0, 0), a0 = ctx.globalAlpha;
    ctx.save(); ctx.transform(f.ux * f.k, f.uy * f.k, -f.uy * f.k, f.ux * f.k, o[0], o[1]);
    // (the grip is the same in both, so it stays solid through the crossfade)
    const [lo, hi, k] = x <= 0.5 ? [R, D, x * 2] : [D, R, (1 - x) * 2], im = (P) => unstrung(P, P === R ? A.rest : A.drawn, P === R ? A.rest[0][0] : A.nock).im;
    ctx.drawImage(im(lo), 0, 0, A.size[0], A.size[1]);
    if (k > 0) { ctx.globalAlpha = a0 * k; ctx.drawImage(im(hi), 0, 0, A.size[0], A.size[1]); ctx.globalAlpha = a0; }
    ctx.restore();
  } else {
    // drawn: two limbs bent back from the grip
    const g = f.pt(...A.grip), t = ends.map((q) => f.pt(...q)), mid = (q) => f.pt(lerp(A.grip[0], q[0], 0.4) + 40, lerp(A.grip[1], q[1], 0.6));
    ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = '#3b2412'; ctx.lineWidth = 0.022 * myH(E) + 2;
    ctx.beginPath(); ctx.moveTo(...t[0]); ctx.quadraticCurveTo(...mid(ends[0]), ...g); ctx.quadraticCurveTo(...mid(ends[1]), ...t[1]); ctx.stroke();
    ctx.strokeStyle = '#7a4a24'; ctx.lineWidth = 0.022 * myH(E); ctx.stroke();
    ctx.restore();
  }
  // the string, tip to tip through its point
  const t = ends.map((q) => f.pt(...q)), s = f.pt(nx, ny), w = Math.max(1.2, A.unstring[2] * f.k);
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(...t[0]); ctx.lineTo(...s); ctx.lineTo(...t[1]);
  ctx.strokeStyle = 'rgba(40,24,10,0.55)'; ctx.lineWidth = w + 1.2; ctx.stroke(); ctx.strokeStyle = '#ece4cf'; ctx.lineWidth = w; ctx.stroke(); ctx.restore();
}
// the arrow nocked on the drawn string, over your bow arm, and the string hand over its nock (drawKnives, after the arm)
function drawNocked(ctx, E) {
  const a = state.aim;
  if (!bowShown()) return;
  if (a && a.bow) { const f = bowFrame(E, a), d = nockDep(E, f, a); drawArrow(ctx, state.hand.hx - f.ux * d, state.hand.hy - f.uy * d, Math.atan2(f.uy, f.ux), arrowLen(E), bowScale(E)); }
  drawArm(ctx, E, drawArmRec(E), false, 'front');
}
// your kit put away while the bow is out, in your body's frame (drawFighter, before the body): the blade (both, with two blades) hanging back from
// the hip, and the shield slung on your back
export function drawSlung(ctx, E, H, lk) {
  const me = state.me, K = TUNING.bow.hip, B = TUNING.bow.back;
  if (me.weapon !== 'fist') for (const i of me.dual ? [1, 0] : [0]) {
    ctx.save(); ctx.translate(K[0] * H, K[1] * H); ctx.rotate(K[2] + i * 0.35); ctx.translate(0, -ARM_LEN * H * K[3]);
    drawWeapon(ctx, { weapon: iconWeapon(me.weapon), mace: me.mace }, H * K[3]); ctx.restore();
  }
  if (me.dual || state.sh.broken || noShield()) return;
  ctx.save(); ctx.translate(B[0] * H, B[1] * H); ctx.rotate(B[3]); ctx.scale(B[4], 1);
  shieldFace(ctx, E, B[2] * H, H, lk, !!(lk.kit && kitPic('upperarm', lk.kit.tier, 0, lk.kit.fk) && kitPic('forearm', lk.kit.tier, 0, lk.kit.fk)));
  ctx.restore();
}
// what the knife meets where it arrives, and the word for it: GAP! (TUNING.knives.dmg); PLATE on plate, his shield or guard (a dull knock, nothing
// taken); on bare skin a small wound (knives.skin) with its mark; MISSED, into the sand
// a thrown knife (k.kind) lands on what its line showed at the release; one with no line (k.kind unset) on what is at (x1, y1) as it arrives
export function knifeLands(E, k) {
  if (state.range) { rangeLands(E, k); return; }
  const K = TUNING.knives, at = { x: k.x1, y: k.y1 }, ang = Math.atan2(k.y1 - k.y0, k.x1 - k.x0), fm = state.foe, gone = state.fallT > 0 || fm.hp <= 0 || !fm.parts;
  const { p, kind, lx, ly } = k.kind == null ? knifeAt(E, k.x1, k.y1) : gone || !k.p ? { p: null, kind: 'miss' } : { p: k.p, kind: k.kind, ...partAt(E, k.p, k.x1, k.y1) };
  // (a charging beast takes it by the charge's rules; off its plate the knife drops as below)
  if (state.charge && kind !== 'miss') { if (chargeHit(E, p, kind, at, ang, null) !== 'PLATE') return; }
  else if (kind === 'gap') { knifeGap(E, p, at, ang); return; }
  else if (kind === 'plate') { state.knifePlate++; p.clang = 0.25; sparks(at.x, at.y, ang + Math.PI, 6); dullSound(E); pop(at.x, at.y - 24, 'PLATE', '#cbd5e1', 20); E.haptic(8); }
  else if (kind === 'skin') { state.knifeSkin++; knifeSkin(E, p, { ...at, lx, ly }, ang); }
  else { state.knifeMiss++; pop(at.x, at.y - 24, 'MISSED', '#e2e8f0', 20); E.audio.play('miss'); }
  const L = lay(E);
  state.knifeFall = { x: at.x, y: at.y, vx: -Math.cos(ang) * 90, vy: -120, rot: ang, vr: (Math.random() < 0.5 ? -1 : 1) * 14, flat: Math.PI * (Math.random() < 0.5 ? 0.02 : 0.98), floor: L.floor - 2, life: K.fall };
}
const partAt = (E, p, x, y) => { const [lx, ly] = partLocal(p, state.foe, ...toLocal(foeF(E), x, y)); return { lx, ly }; };
// a knife in a gap: a big piercing hit, the gap's ring and sound; he covers it after, as after any blow
function knifeGap(E, p, at, ang) {
  const J = TUNING.juice, f = state.foe, dealt = TUNING.knives.dmg;
  p.cool = TUNING.hit.cool; p.flash = 0.16; state.gapHits++; state.slotHits++; state.knifeGaps++; state.bout.gaps[p.d.id] = (state.bout.gaps[p.d.id] || 0) + 1;
  f.hp -= dealt;
  blood(at.x, at.y, ang, J.blood.slot); ring(at.x, at.y, J.slotRing, '#ef4444'); slotSound(E); sliceSound(E, true);
  pop(at.x, at.y - 30, 'GAP!', '#ffd24a', 22); dmgPop(E, at, dealt, '#ff6a4a'); shake(E, 8, 0.1); E.haptic(30); E.flash('#fff0b8', 0.07);
  state.stop = Math.max(state.stop, J.slotStop);
  crowdEvent(E, 'slot');
  if (f.hp <= 0) fell(E); else setCover(p);
}
// a knife on bare skin: a small wound and its mark, by the rules of any bare hit (Haemorrhage: no bite; Sharp Edge adds), no bleed
function knifeSkin(E, p, at, ang) {
  const f = state.foe, numb = has('haem'), dealt = numb ? 0 : TUNING.knives.skin + TUNING.cards.edge * count('edge');
  p.cool = TUNING.hit.cool; f.hp -= dealt;
  if (numb) { dust(at.x, at.y, 3); dullSound(E); pop(at.x, at.y - 24, 'NO BITE', '#cbd5e1', 15); E.haptic(8); }
  else {
    p.flash = 0.16; blood(at.x, at.y, ang, TUNING.juice.blood.drops); sliceSound(E, false); dmgPop(E, at, dealt, '#fff0b8'); shake(E, 4, 0.08); E.haptic(16);
    const [ux, uy] = localDir(foeF(E), f, p, ang), l = TUNING.look.mark.cut[0];
    mark(p, { k: 'cut', x: at.lx - ux * l / 2, y: at.ly - uy * l / 2, ux, uy, s: l }); p.gashes.push({ a: [at.lx - ux * l, at.ly - uy * l], b: [at.lx, at.ly], t: state.m });
  }
  if (f.hp <= 0) fell(E); else setCover(p);
}
// a small dark throwing knife, its point along ang from (x, y), len px from pommel to point
export function drawKnife(ctx, x, y, ang, len) {
  const w = Math.max(2.5, len * 0.12);
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.strokeStyle = '#11141a'; ctx.lineWidth = 1;
  ctx.fillStyle = '#5b3a22'; ctx.fillRect(-len * 0.4, -w * 0.45, len * 0.36, w * 0.9); ctx.strokeRect(-len * 0.4, -w * 0.45, len * 0.36, w * 0.9);
  ctx.fillStyle = '#20242b'; ctx.fillRect(-len * 0.05, -w * 0.9, len * 0.05, w * 1.8);
  ctx.beginPath(); ctx.moveTo(0, -w * 0.6); ctx.lineTo(len * 0.6, 0); ctx.lineTo(0, w * 0.6); ctx.closePath();
  ctx.fillStyle = '#353b44'; ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(203,213,225,0.7)'; ctx.beginPath(); ctx.moveTo(len * 0.04, -w * 0.15); ctx.lineTo(len * 0.5, 0); ctx.stroke();
  ctx.restore();
}
// in the world: the raised knife in your fist, drawn back and pointing along its line, and the line as dots from its point, TUNING.knives.pre of
// the way to him (step 27: no ring, no snap); in a throw, the knife in the whipping fist until it leaves; the knife in flight; a spent one falling.
// The bow's aim: its ring (gold; green over a gap, red over plate) with a thin line down to your thumb
export function drawKnives(ctx, E) {
  const K = TUNING.knives, B = TUNING.bow, len = K.len * youF(E).H, a = state.aim, k = state.knife, q = state.knifeFall, w = state.whip;
  drawNocked(ctx, E);
  if ((a && !a.bow) || (w && !w.out)) {
    const [hx, hy] = knifeHand(), ang = a ? Math.atan2(a.ey - hy, a.ex - hx) : Math.atan2(w.uy, w.ux), kl = len * K.held;
    ctx.save(); ctx.shadowColor = 'rgba(255,236,150,0.9)'; ctx.shadowBlur = 8; drawKnife(ctx, hx - Math.cos(ang) * kl * 0.15, hy - Math.sin(ang) * kl * 0.15, ang, kl); ctx.restore();
    if (a) {
      const tx = hx + Math.cos(ang) * kl * 0.45, ty = hy + Math.sin(ang) * kl * 0.45, D = Math.hypot(a.ex - tx, a.ey - ty), L = D * K.pre * clamp(a.t / K.aim, 0, 1);
      ctx.save();
      for (let d = 10; d <= L; d += 13) {
        const r = 3.2 - (d / Math.max(L, 1)), x = tx + (a.ex - tx) / D * d, y = ty + (a.ey - ty) / D * d;
        ctx.fillStyle = 'rgba(20,12,6,0.7)'; ctx.beginPath(); ctx.arc(x, y, r + 1.6, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  }
  if (a && a.bow) {
    // (the bow's aim: its real flight as dots, B.pre of the way to where it lands, as the knife's; round the thumb, the draw filling to full with a
    // tick at the draw's mark)
    const P = a.path, n = P.length / 2;
    let run = 0, total = 0;
    for (let i = 1; i < n; i++) total += Math.hypot(P[2 * i] - P[2 * i - 2], P[2 * i + 1] - P[2 * i - 1]);
    const lim = Math.max(60, total * B.pre);
    ctx.save();
    for (let i = 1, next = 10; i < n && run <= lim; i++) {
      run += Math.hypot(P[2 * i] - P[2 * i - 2], P[2 * i + 1] - P[2 * i - 1]);
      if (run < next) continue;
      next += 13;
      const r = 3.2 - run / lim, x = P[2 * i], y = P[2 * i + 1];
      ctx.fillStyle = 'rgba(20,12,6,0.7)'; ctx.beginPath(); ctx.arc(x, y, r + 1.6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    const u = clamp(a.draw / B.full, 0, 1), R = 34, at = -Math.PI / 2 + TAU * B.draw / B.full;
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(20,12,6,0.55)'; ctx.beginPath(); ctx.arc(a.tx, a.ty, R, 0, TAU); ctx.stroke();
    ctx.strokeStyle = u >= 1 ? '#ffd24a' : '#fde68a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(a.tx, a.ty, R, -Math.PI / 2, -Math.PI / 2 + TAU * u); ctx.stroke();
    ctx.strokeStyle = '#1b1410'; ctx.lineWidth = 2; line(ctx, a.tx + Math.cos(at) * (R - 5), a.ty + Math.sin(at) * (R - 5), a.tx + Math.cos(at) * (R + 5), a.ty + Math.sin(at) * (R + 5));
    ctx.restore();
  }
  if (k) { const u = clamp(k.t / k.dur, 0, 1), h = k.arc || 0; drawKnife(ctx, lerp(k.x0, k.x1, u), lerp(k.y0, k.y1, u) - 4 * h * u * (1 - u), Math.atan2(k.y1 - k.y0 - 4 * h * (1 - 2 * u), k.x1 - k.x0), len); }
  if (q) { ctx.globalAlpha = clamp(q.life / 0.3, 0, 1); drawKnife(ctx, q.x, q.y, q.rot, len); ctx.globalAlpha = 1; }
  // step 24: an arrow in flight (its point on the way to the ring), and one spent
  const rq = state.arrowFall, al = arrowLen(E);
  for (const r of [state.arrow, ...(state.volley || [])]) if (r) { const an = Math.atan2(r.vy, r.vx); drawArrow(ctx, r.x - Math.cos(an) * al, r.y - Math.sin(an) * al, an, al, bowScale(E)); }
  if (rq) { ctx.globalAlpha = clamp(rq.life / 0.3, 0, 1); drawArrow(ctx, rq.x - Math.cos(rq.rot) * al, rq.y - Math.sin(rq.rot) * al, rq.rot, al, bowScale(E)); ctx.globalAlpha = 1; }
}
// the round buttons: ⇄ (its ring fills while you swap) and the knife button with the knives left (red while one is raised)
export function drawArmsBtns(ctx, E) {
  const b = armsBtns(E);
  if (!b) return;
  const S = TUNING.sidearm;
  if (b.swap) {
    const c = b.swap, on = state.swapT > 0;
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, TAU); ctx.fillStyle = 'rgba(30,24,36,0.85)'; ctx.fill(); ctx.strokeStyle = state.aim && !state.aim.bow ? '#6b7280' : '#e6c866'; ctx.lineWidth = 2; ctx.stroke();
    if (on) { ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(c.x, c.y, c.r - 3, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - state.swapT / (state.bowSwap ? TUNING.bow.swap : S.swap))); ctx.stroke(); }
    E.text('⇄', c.x, c.y + 1, { size: 26, weight: '800', color: state.aim && !state.aim.bow ? '#6b7280' : '#fde68a' });
  }
  if (b.knife) {
    const c = b.knife, on = !!state.aim;
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, TAU); ctx.fillStyle = on ? 'rgba(90,20,20,0.9)' : 'rgba(30,24,36,0.85)'; ctx.fill(); ctx.strokeStyle = on ? '#f87171' : '#e6c866'; ctx.lineWidth = 2; ctx.stroke();
    drawKnife(ctx, c.x - c.r * 0.5, c.y + c.r * 0.38, -Math.PI / 4, c.r * 1.25);
    const bx = c.x + c.r * 0.68, by = c.y - c.r * 0.68;
    ctx.beginPath(); ctx.arc(bx, by, 10, 0, TAU); ctx.fillStyle = '#1b1410'; ctx.fill(); ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 1.5; ctx.stroke();
    E.text(state.range ? '∞' : `${state.knives}`, bx, by + 1, { size: 14, weight: '800', color: '#ffd24a' });
  }
}
// Step 22: the Knives row wherever gold is spent: the knife, its word and price, then - and + either side of the count (n of the most). Returns the two
// buttons' rects; add and sub say whether each can be tapped now.
export function knifeRow(ctx, E, x, y, w, n, add, sub) {
  const K = TUNING.knives, [h, bw] = K.row, R = x + w;
  E.roundRect(x, y, w, h, 10, '#1f1a24', '#4a4252');
  const my = y + h / 2;
  drawKnife(ctx, x + 17, my + 5, -0.6, 24);
  E.text('KNIVES', x + 34, my - 7, { size: 14, weight: '800', align: 'left', color: '#c4b99a' });
  const pr = `${K.price}`;
  E.text(pr, x + 47, my + 9, { size: 14, weight: '800', align: 'left', color: '#fbbf24' }); drawCoin(ctx, x + 40, my + 9, 5.5);
  const plus = { x: R - bw - 2, y: y + 2, w: bw, h: h - 4 }, cw = 40, minus = { x: plus.x - cw - bw, y: y + 2, w: bw, h: h - 4 };
  for (const [r, t, ok] of [[minus, '−', sub], [plus, '+', add]]) {
    E.roundRect(r.x, r.y, r.w, r.h, 8, ok ? '#3a2a10' : '#2a2016', ok ? '#ffd24a' : '#4a4252');
    E.text(t, r.x + r.w / 2, r.y + r.h / 2 + 1, { size: 22, weight: '800', color: ok ? '#ffd24a' : '#6b7280' });
  }
  E.text(`${n}/${K.max}`, minus.x + bw + cw / 2, my, { size: 16, weight: '800', color: n ? '#f0e6cc' : '#9aa4b2' });
  return { minus, plus };
}
// the tent's and the stall's: a knife bought (up to the most carried) or one bought here sold back (tt.kn: bought on this screen)
export function knifeBuy(E, tt, more) {
  const K = TUNING.knives;
  if (more ? state.knives >= K.max || state.gold < K.price : !(tt.kn > 0)) { E.audio.play('miss'); return; }
  const d = more ? 1 : -1;
  state.knives += d; tt.kn = (tt.kn || 0) + d; state.gold -= d * K.price;
  E.audio.play(more ? 'coin' : 'tap'); E.haptic(10);
}
// step 28: the draft's knife chip, top right: one tap buys one (a miss sound and a shake when full or short, and the chip says which). Returns its rect.
export function draftKnifeChip(ctx, E, d) {
  const K = TUNING.knives, [cw, ch] = K.chip, n = state.knives, full = n >= K.max, short = !full && state.gold < K.price, ok = !full && !short;
  const sh = d.knShake >= 0 && d.t - d.knShake < TUNING.draft.shake ? Math.sin((d.t - d.knShake) * 60) * TUNING.draft.shakePx : 0;
  const r = { x: E.w - E.safe.right - 12 - cw, y: E.safe.top + 6, w: cw, h: ch };
  ctx.globalAlpha = d.t > TUNING.draft.delay ? 1 : 0.5;
  E.roundRect(r.x + sh, r.y, cw, ch, 12, ok ? '#3a2a10' : '#1f1a24', ok ? '#ffd24a' : '#4a4252');
  drawKnife(ctx, r.x + sh + 20, r.y + ch / 2 + 6, -0.6, 26);
  E.text(full ? 'Most carried' : short ? 'Need gold' : '+1 knife', r.x + sh + 38, r.y + 14, { size: 14, weight: '800', align: 'left', color: ok ? '#fde68a' : '#9aa4b2' });
  drawCoin(ctx, r.x + sh + 44, r.y + 32, 5.5);
  E.text(`${K.price}`, r.x + sh + 53, r.y + 32, { size: 14, weight: '800', align: 'left', color: ok ? '#fbbf24' : '#9aa4b2' });
  E.text(`${n}/${K.max}`, r.x + sh + cw - 10, r.y + 32, { size: 14, weight: '800', align: 'right', color: n ? '#f0e6cc' : '#9aa4b2' });
  ctx.globalAlpha = 1;
  return r;
}
// a tap on the draft's knife chip
export function draftKnifeBuy(E, d) {
  const K = TUNING.knives;
  if (state.knives >= K.max || state.gold < K.price) { d.knShake = d.t; E.audio.play('miss'); E.haptic(20); return; }
  state.knives++; state.gold -= K.price; state.bought.push('knife');
  E.audio.play('coin'); E.haptic(10);
}
// step 22: the tent's and the stall's Knives row, centred at y
export function tentKnives(ctx, E, y, ready) {
  const K = TUNING.knives, tt = state.tent, w = Math.min(300, E.w - 64);
  ctx.globalAlpha = ready ? 1 : 0.6;
  const r = knifeRow(ctx, E, (E.w - w) / 2, y, w, state.knives, state.knives < K.max && state.gold >= K.price, tt.kn > 0);
  ctx.globalAlpha = 1;
  return r;
}
// Step 24: the bow at rest, its grip at (x, y), its length turned ang from straight up (rad), h px tip to tip (Pack 29's painting, or drawn)
export function bowAt(ctx, x, y, ang, h) {
  const A = TUNING.bow.art, k = h / (A.rest[1][1] - A.rest[0][1]), P = kitOn() && artPic('weapon-bow', A, h * Math.min((ENG && ENG.dpr) || 1, TUNING.skin.maxDpr));
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(k, k);
  if (P) ctx.drawImage(P.im, -A.grip[0], -A.grip[1], A.size[0], A.size[1]);
  else {
    const [t, b] = A.rest.map((q) => [q[0] - A.grip[0], q[1] - A.grip[1]]);
    ctx.lineCap = 'round'; ctx.strokeStyle = '#7a4a24'; ctx.lineWidth = 40; ctx.beginPath(); ctx.moveTo(...t); ctx.quadraticCurveTo(60, 0, ...b); ctx.stroke();
    ctx.strokeStyle = '#ece4cf'; ctx.lineWidth = 10; line(ctx, ...t, ...b);
  }
  ctx.restore();
}
// the rack's bow, lying with its belly up and an arrow under it, w px across, centred on (x, y)
export function rackBow(ctx, x, y, w) {
  const A = TUNING.bow.art, k = w / (A.rest[1][1] - A.rest[0][1]), gy = y - (A.grip[0] - (A.rest[0][0] + A.size[0]) / 2) * k;
  bowAt(ctx, x, gy, -Math.PI / 2, w);
  const al = (TUNING.bow.arrow.tip[0] - TUNING.bow.arrow.nock[0]) * k;
  drawArrow(ctx, x - al / 2, gy + (A.grip[0] - A.rest[0][0]) * k + 4, 0, al);
}
// ----- step 22b: the first-knife lesson -----
// The first bout ever begun with knives on your belt (knifeHint in the save), Brutus walks you through one throw the training yard's way: his line
// at the top, a ghost thumb and a pulse, and no timer; a tick and a chime as each step is done. He holds still (stepFoe) and the sword thumb waits.
const KNIFE_LESSON = ['Hold the knife.', 'Up or down to aim. Let go.'];
export const lessonDue = (E) => state.knives > 0 && !state.drill && !state.lab && !E.save.get('knifeHint', 0);
export function startLesson() { state.kLesson = { i: 0, t: 0, doneT: -1, base: state.knivesThrown }; state.hint = false; }
function endLesson(E) { state.kLesson = null; E.save.set('knifeHint', 1); state.swingIn = 1.2; }
export function updateLesson(E, dt) {
  const ls = state.kLesson, a = state.aim, thrown = state.knivesThrown > ls.base;
  ls.t += dt; state.swingIn = 1.2;
  if (state.fallT > 0 || state.endT > 0) { endLesson(E); return; }
  if (ls.doneT >= 0) { if (ls.t - ls.doneT >= TUNING.train.next) { if (ls.i >= KNIFE_LESSON.length - 1) endLesson(E); else { ls.i++; ls.doneT = -1; } } return; }
  // the knife lowered before it was thrown: back to raising it
  if (ls.i > 0 && !a && !thrown) ls.i = 0;
  const got = ls.i === 0 ? !!a : thrown;
  if (got) { ls.doneT = ls.t; yardChime(E); }
}
// the open gap the lesson points at: the one nearest his middle
export function lessonGap(E) {
  const F = foeF(E), fm = state.foe, cy = F.y - TUNING.knives.rest * F.H;
  let best = null, bd = Infinity;
  for (const p of fm.parts) {
    if (!p.slot || covered(p)) continue;
    const [px, py] = partCenter(F, fm, p), d = Math.hypot(px - F.x, py - cy);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
export function drawLesson(ctx, E) {
  const ls = state.kLesson, T = TUNING.train, L = 16 + E.safe.left, w = E.w - 16 - E.safe.right - 182 - L, cx = L + w / 2;
  yardPlate(ctx, E, L, w, KNIFE_LESSON[ls.i], ls.doneT >= 0);
  if (ls.doneT >= 0) { yardTick(ctx, cx, E.safe.top + 90, ls.t - ls.doneT); return; }
  knifeGhost(ctx, E, (ls.t % T.ghost.loop) / T.ghost.loop, ls.t);
}
// the knife's ghost (the lesson's and the yard's): the knife button pulsing; a ghost thumb pressing it, sliding straight up to the height whose line
// meets the gap nearest his middle (ringed), and letting go
export function knifeGhost(ctx, E, u, t) {
  const b = armsBtns(E), g = lessonGap(E), pulse = 0.5 + 0.5 * Math.sin(t * 8);
  if (!b || !b.knife) return;
  const c = b.knife;
  if (!state.aim) { ctx.save(); ctx.strokeStyle = `rgba(255,210,74,${0.5 + 0.5 * pulse})`; ctx.lineWidth = 3 + 2 * pulse; ctx.beginPath(); ctx.arc(c.x, c.y, c.r + 5, 0, TAU); ctx.stroke(); ctx.restore(); }
  if (!g) { ghostThumb(ctx, c.x - c.r * 0.2, c.y + c.r * 0.1, ghostAt(GHOST.tap, u)[2]); return; }
  gapRings(ctx, E, t, [g]);
  const gy = knifeThumb(E, ...partCenter(foeF(E), state.foe, g), c.y), keys = [[0, c.x, c.y, 0], [0.15, c.x, c.y, 1], [0.6, c.x, gy, 1], [0.8, c.x, gy, 1], [0.9, c.x, gy, 0], [1, c.x, c.y, 0]];
  ctx.save(); ctx.strokeStyle = 'rgba(248,241,228,0.35)'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]); line(ctx, c.x, c.y, c.x, gy); ctx.restore();
  const [x, y, dn] = ghostAt(keys, u);
  ghostThumb(ctx, x, y, dn);
}
