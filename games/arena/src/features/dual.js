// Arena: Feature: two weapons strike hand to hand (step 2026-11-14). Both are held forward; the thumb drives one hand at a time (state.hand), and when
// that hand's blow is over the other takes the thumb, already up at its guard, while the one that struck comes back on its own (state.duo.rest).
// Hooks: initHand and the bout's reset (startDual), poseYou (poseRest, offFist), updateAttack (returnStroke), play.update (updateDual, after
// checkHits), draw-fight.js (drawArm: the off arm drawn behind you, its blade and fist over him).
import { lerp } from '../engine.js';
import { TUNING } from '../tuning.js';
import { ZONES } from '../data.js';
import { youF, toScreen, toLocal, guardPt, solveArm, raised } from '../fight.js';
import { state, wrap } from '../game.js';
import { bowShown } from './ranged.js';

// Each bout starts with the main (right) hand on the thumb and the off hand at its guard. One weapon: no second hand at all.
export function startDual(E) {
  if (!state.me.dual) { delete state.duo; return; }
  if (state.hand.off) state.hand = state.duo.rest;
  const h = state.hand, r = { ...h, off: true, down: false, id: -1, atk: null, lock: 0, sl: null, struck: false };
  [r.tgx, r.tgy] = guardPt(E, true);
  solveArm(E, 0, r);
  state.duo = { rest: r, m: -9 };
  h.struck = false;
}

// the off hand, whichever of the two records holds it
export const offRec = () => (state.hand.off ? state.hand : state.duo.rest);

// The hand that is not on the thumb eases back to its guard over TUNING.dual.back s (its recoil from a bounce running out as it goes). The off hand
// still blocks as before: raised, it goes up to the zone with its blade across (dual.guard), and a perfect parry's riposte reaches out with it.
export function poseRest(E, dt) {
  const r = state.duo.rest, D = TUNING.dual, sh = state.sh, F = youF(E);
  r.lock = Math.max(0, r.lock - dt);
  r.pux = r.ux; r.puy = r.uy; r.phx = r.hx; r.phy = r.hy;
  let [gx, gy] = guardPt(E, !!r.off), wa = 0, a = 0;
  if (r.off && !bowShown()) {
    const [bx, by] = toScreen(F, 0.2, sh.zy), k = state.offT > 0 ? Math.sin(Math.PI * (1 - state.offT / D.swing)) : 0, [rx, ry] = toScreen(F, D.reach[0], D.reach[1]);
    gx = lerp(lerp(gx, bx, sh.up), rx, k); gy = lerp(lerp(gy, by, sh.up), ry, k);
    wa = Math.max(sh.up, k); a = F.a + lerp(D.guard[ZONES.indexOf(sh.zone)], D.thrust, k / (wa || 1));
  }
  const e = dt > 0 ? 1 - Math.exp(-dt / D.back) : 1;
  r.tgx += (gx - r.tgx) * e; r.tgy += (gy - r.tgy) * e;
  r.along = 0; r.ovK = 0;
  solveArm(E, dt, r);
  if (wa > 0) {
    r.ph += wrap(a - r.ph) * wa; r.bx = Math.cos(r.ph); r.by = Math.sin(r.ph);
    const L = Math.hypot(r.ux - r.hx, r.uy - r.hy); r.ux = r.hx + r.bx * L; r.uy = r.hy + r.by * L;
  }
  r.vx = r.vy = r.sp = 0;
}

// the off fist in your body's units (your far arm's part follows it, so his blows find it where it is drawn)
export function offFist(E) { const o = offRec(); return toLocal(youF(E), o.hx, o.hy); }

// With two weapons a stroke drawn back toward you (its direction's share against him beyond dual.pull) is the thumb coming back, not a blow, but only
// the movement of the touch that just ended a blow (h.cont, set at the swap): a fresh touch's draw-back before a push is the start of a blow.
export const returnStroke = (ux) => !!state.duo && !!state.me.dual && !!state.hand.cont && ux < -TUNING.dual.pull;

// The off hand's lower guard gives the same push of the thumb a slower point (about 0.85 to 0.93 of the main hand's), so its jab is born at offJab x
// the speed (a slash or an overhead is named before this gate and is the same for both hands).
export const jabNeed = (h) => TUNING.attack.jab.minSpeed * (h.off ? TUNING.dual.offJab : 1);

// After each blow the thumb goes to the other hand: once the blow is over (landed and slowed, missed, bounced or lifted), never in a lunge. After
// dual.reset s with no blow (while the thumb is up: a touch the off hand began stays its own), a raised block, the bow or a knife, the main hand
// takes the thumb back.
export function updateDual(E, dt) {
  state.offT = Math.max(0, state.offT - dt);
  const d = state.duo;
  if (!d || !state.me.dual) return;
  const h = state.hand;
  // (a stroke that is over, a blow landed or the thumb's return, ends as the hand turns back, as the thumb does, not only when it slows)
  if (h.atk && h.atk.dx == null) { h.atk.dx = h.vx; h.atk.dy = h.vy; }
  if (h.atk && h.atk.done && h.vx * h.atk.dx + h.vy * h.atk.dy < 0) h.atk = null;
  const a = h.atk;
  if (h.cont && (!h.down || (a && a.cost != null))) h.cont = false;
  if (a && a.cost != null && !h.struck) { h.struck = true; d.m = state.m; }
  if (state.lunging) return;
  if (h.struck && !a) swap(E);
  else if (h.off && !(a && !a.done) && (raised() || bowShown() || state.aim || state.swapT > 0 || (!h.down && state.m - d.m > TUNING.dual.reset))) swap(E);
}
// a touch that comes while a hit-stop holds the last blow's hand still finds the other hand already on the thumb
export function dualTouch(E) { if (state.duo && state.me.dual && state.hand.struck && !state.hand.atk && !state.lunging) swap(E); }
// The thumb goes over to the other hand as it is (the same touch, the same offset, so the aim stays where the thumb holds it): that hand comes up to
// it, and the move is no blow. A bounce's recoil holds it dual.overlap of the struck hand's.
function swap(E) {
  const h = state.hand, r = state.duo.rest;
  Object.assign(r, { down: h.down, id: h.id, fx: h.fx, fy: h.fy, ax: h.ax, ay: h.ay, raisedT: -9, cont: h.down, atk: h.down ? { kind: 'pull', done: true } : null, struck: false,
    grip: 0, hvx: 0, hvy: 0, lock: Math.max(r.lock, h.lock * TUNING.dual.overlap) });
  Object.assign(h, { down: false, id: -1, atk: null, struck: false });
  state.hand = r; state.duo.rest = h; state.trail = [];
}
