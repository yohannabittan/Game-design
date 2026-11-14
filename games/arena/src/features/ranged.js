// Arena: Feature: the sidearm, throwing knives and the bow (steps 22 and 24), with the first-knife lesson. Hooks: play.onPointerDown (armsTouch, aimDown, bowDown), play.update (stepArms, updateLesson), the HUD (drawArmsBtns, drawKnives), the tent and the purse (knifeRow, knifeBuy, rackBow).
// Split from game.js by tools/arena-split.mjs (ADR-0024). Only tuning.js and data.js may be read while modules load.

import { clamp, lerp } from '../engine.js';
import { TUNING } from '../tuning.js';
import { ARM_LEN, SHOULDER } from '../data.js';
import { lay, youF, inReach, myH, foeF, toScreen, toLocal, partLocal, partCenter, inside, fell, blood, sparks, ring, pop, dmgPop, slotSound,
  dullSound, sliceSound, clangSound, swooshSound } from '../fight.js';
import { covered, setCover } from '../foe.js';
import { staggerFoe, finLive, crowdEvent } from '../cards.js';
import { weaponKey, artPic, kitPic, TAU, line, lerp2, drawCoin, drawWeapon, shieldFace } from '../draw-fight.js';
import { wield, iconWeapon, weaponTitle } from '../screens.js';
import { state, noShield, shake, meSize, ENG, kitOn } from '../game.js';
import { YARD, GHOST, yardKnifeTap, yardChime, yardTick, yardPlate, gapRings, ghostThumb, ghostAt } from '../features/yard.js';

// ====== RANGED: the sidearm, knives and the bow ======
// step 24: the bow is in your hand, from halfway through the swap to it until halfway through the swap back (the shield on your back the same)
export const bowShown = () => (state.swapT > 0 && state.bowSwap ? !!state.bowOut === state.swapT <= TUNING.bow.swap / 2 : !!state.bowOut);
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
  return { swap: side && !state.train ? { x, y: y0, r: B.r } : null, knife: kn ? { x, y: side && !state.train ? y0 - 2 * B.r - B.gap : y0, r: B.r } : null, w: 2 * B.r + B.gap };
}
export const armsW = (E) => { const b = armsBtns(E); return b ? b.w : 0; };
const onRound = (b, p) => !!b && Math.hypot(p.x - b.x, p.y - b.y) <= b.r + TUNING.finBtn.reach;
// a touch on ⇄ swaps; on the knife button it raises a knife, or lowers the one raised
export function armsTouch(E, p) {
  const b = armsBtns(E);
  if (!b) return false;
  if (onRound(b.swap, p)) { startSwap(E); return true; }
  if (onRound(b.knife, p)) { if (state.aim) { state.aim = null; E.audio.play('tap'); } else startAim(E); return true; }
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
// a knife raised: open (no block, no swing) until it is thrown or lowered. The aim ring shows at once, on his middle; a right-thumb touch moves it
// (lift px above the thumb), and only a touch dragged TUNING.knives.drag px or more throws on its release: a tap just leaves the ring there
export function startAim(E) {
  if (state.knives <= 0 || state.swapT > 0 || state.bowOut) return;
  const h = state.hand, F = foeF(E), rx = F.x, ry = F.y - TUNING.knives.rest * F.H;
  h.down = false; h.atk = null;
  state.aim = { t: 0, id: -1, rx, ry, x: rx, y: ry, tx: null, ty: null, sx: 0, sy: 0, drag: 0, go: false, over: knifeAt(E, rx, ry).kind };
  E.audio.beep({ freq: 880, dur: 0.06, type: 'triangle', gain: 0.08 }); E.haptic(8);
  seenOpen();
}
export function aimDown(E, p) { const a = state.aim; a.id = p.id; a.sx = p.x; a.sy = p.y; a.drag = 0; aimAt(E, p); }
export function aimAt(E, p) {
  const a = state.aim;
  a.tx = p.x; a.ty = p.y; a.drag = Math.max(a.drag, Math.hypot(p.x - a.sx, p.y - a.sy));
  a.rx = clamp(p.x, 10, E.w - 10); a.ry = clamp(p.y - TUNING.knives.lift, E.safe.top + 10, E.h - 10);
  aimSnap(E);
}
// the thumb lifted: a drag throws (once the knife is up), a tap leaves it raised with the ring where it touched
export function aimUp(E) { const a = state.aim; if (a.bow) { bowRelease(E); return; } a.id = -1; if (a.drag >= TUNING.knives.drag) a.go = true; else if (state.train) yardKnifeTap(E); }
// what a knife arriving at (x, y) meets now: an open gap, plate (or his shield or guard), bare skin, or nothing
export function knifeAt(E, x, y) {
  const K = TUNING.knives, F = foeF(E), fm = state.foe;
  if (state.fallT > 0 || fm.hp <= 0 || !fm.parts) return { p: null, kind: 'miss' };
  const [lx, ly] = toLocal(F, x, y);
  for (const p of fm.parts.filter((q) => q.slot).concat(fm.parts.filter((q) => !q.slot))) {
    const [qx, qy] = partLocal(p, fm, lx, ly);
    if (inside(p.d, qx, qy, K.pad / F.H)) return { p, kind: p.slot && !covered(p) ? 'gap' : covered(p) ? 'plate' : 'skin' };
  }
  return { p: null, kind: 'miss' };
}
// how far (in his H) a point in a part's own frame lies outside its shape
function partGapDist(d, lx, ly) {
  if (d.shape === 'circle') return Math.max(0, Math.hypot(lx - d.x, ly - d.y) - d.r);
  return Math.hypot(Math.max(0, Math.abs(lx - d.x) - d.w / 2), Math.max(0, Math.abs(ly - d.y) - d.h / 2));
}
// the ring: on the thumb's point, or snapped onto the middle of the nearest open gap within TUNING.knives.snap px of its edge; green over a gap
// (with a soft tick as it turns), red over plate; checked every frame, as he moves
export function aimSnap(E) {
  const K = TUNING.knives, a = state.aim, F = foeF(E), fm = state.foe;
  a.x = a.rx; a.y = a.ry;
  let t = knifeAt(E, a.x, a.y);
  if (K.snap > 0 && t.kind !== 'gap' && state.fallT <= 0 && fm.hp > 0 && fm.parts) {
    const [lx, ly] = toLocal(F, a.rx, a.ry);
    let best = null, bd = K.snap / F.H;
    for (const p of fm.parts) {
      if (!p.slot || covered(p)) continue;
      const [qx, qy] = partLocal(p, fm, lx, ly), d = partGapDist(p.d, qx, qy);
      if (d <= bd) { bd = d; best = p; }
    }
    if (best) { [a.x, a.y] = partCenter(F, fm, best); t = { p: best, kind: 'gap' }; }
  }
  if (t.kind === 'gap' && a.over !== 'gap') E.audio.beep({ freq: 1500, dur: 0.03, type: 'triangle', gain: 0.05 });
  a.over = t.kind;
}
// where the raised knife is held: in your sword hand, which goes up beside your head (moveHand)
function knifeHand() { return [state.hand.hx, state.hand.hy]; }
export function raisePt(E) { const Fy = youF(E), R = TUNING.knives.raise, [sx, sy] = toScreen(Fy, SHOULDER[0], SHOULDER[1]); return [sx + R[0] * Fy.dir * Fy.H, sy + R[1] * Fy.H]; }
// thrown: spent, hit or miss; it flies to the aim point at TUNING.knives.speed and finds what is there when it arrives
function throwKnife(E) {
  const K = TUNING.knives, a = state.aim, [x0, y0] = knifeHand(), d = Math.hypot(a.x - x0, a.y - y0);
  state.aim = null; state.knives--; state.knivesThrown++;
  state.knife = { x0, y0, x1: a.x, y1: a.y, t: 0, dur: Math.max(0.05, d / (K.speed * youF(E).H)) };
  swooshSound(E, 0.1); E.haptic(10);
}
export function stepArms(E, dt) {
  state.swapT = Math.max(0, state.swapT - dt);
  if (state.bowOut) state.bowTime += dt;
  if (state.follow) state.follow.t -= dt;
  const a = state.aim;
  if (a && !armsLive(E)) state.aim = null;
  else if (a && a.bow) { aimSnap(E); a.draw += dt; }
  else if (a) { aimSnap(E); if ((a.t += dt) >= TUNING.knives.aim && a.go) throwKnife(E); }
  const k = state.knife;
  if (k && (k.t += dt) >= k.dur) { state.knife = null; knifeLands(E, k); }
  const r = state.arrow;
  if (r && (r.t += dt) >= r.dur) { state.arrow = null; arrowLands(E, r); }
  state.knifeFall = fallStep(state.knifeFall, dt);
  state.arrowFall = fallStep(state.arrowFall, dt);
  if (bowShown()) { const f = bowFrame(E), A = TUNING.bow.art; state.bowNock = toLocal(youF(E), ...f.pt(lerp(A.rest[0][0], A.nock, pullK(state.aim)), A.grip[1])); } else state.bowNock = null;
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
// the right thumb down with the bow out starts the draw, and aims it as a knife is aimed (the ring lift px above the thumb, its snap onto a gap)
export function bowDown(E, p) {
  const F = foeF(E);
  state.aim = { bow: true, draw: 0, t: 0, id: -1, rx: F.x, ry: F.y - TUNING.knives.rest * F.H, x: F.x, y: F.y, tx: null, ty: null, sx: 0, sy: 0, drag: 0, go: false, over: 'miss' };
  aimDown(E, p);
  E.audio.beep({ freq: 180, dur: TUNING.bow.draw, type: 'triangle', slide: 1.4, gain: 0.05 }); E.haptic(6);
}
// the draw's share of full (0 to 1), and the hold past it toward full power (0 to 1)
const pullK = (a) => (a && a.bow ? clamp(a.draw / TUNING.bow.draw, 0, 1) : 0);
const holdK = (a) => { const B = TUNING.bow; return a && a.bow ? clamp((a.draw - B.draw) / (B.full - B.draw), 0, 1) : 0; };
// the thumb lifted: a full draw looses (never inside his reach: TOO CLOSE); a short one looses nothing, TOO SOON, and the next draw starts from nothing
export function bowRelease(E) {
  const B = TUNING.bow, a = state.aim, Fy = youF(E), at = [Fy.x + 0.3 * Fy.H, Fy.y - 1.05 * Fy.H];
  state.aim = null;
  if (a.draw < B.draw) { pop(at[0], at[1], 'TOO SOON', '#fdba74', 18); E.audio.beep({ freq: 220, dur: 0.1, type: 'triangle', slide: 0.7, gain: 0.08 }); return; }
  if (inReach()) { pop(at[0], at[1], 'TOO CLOSE', '#fca5a5', 18); E.audio.beep({ freq: 200, dur: 0.12, type: 'sawtooth', slide: 0.7, gain: 0.07 }); return; }
  const f = bowFrame(E, a), k = holdK(a), pw = 1 + (B.power - 1) * k, [x0, y0] = f.pt(TUNING.bow.art.nock, f.A.grip[1]), len = arrowLen(E);
  const tx = x0 + f.ux * len, ty = y0 + f.uy * len, d = Math.hypot(a.x - tx, a.y - ty);
  state.arrows++; state.follow = { x: a.x, y: a.y, t: B.follow };
  state.arrow = { x0: tx, y0: ty, x1: a.x, y1: a.y, t: 0, dur: Math.max(0.03, d / (B.speed * pw * youF(E).H)), pw };
  swooshSound(E, 0.12); E.audio.beep({ freq: 140, dur: 0.12, type: 'triangle', slide: 0.5, gain: 0.12 }); E.haptic(14);
}
// the ordinary gap hit: a gladius jab's in a gap, at your Strength and size
export const plainGap = () => Math.max(1, Math.round(TUNING.attack.jab.dmg * TUNING.me.str[state.me.str - 1] * meSize().dmg * TUNING.me.weapons.gladius.slot));
// what the arrow meets where it arrives: a gap, TUNING.bow.gap x the ordinary gap hit (GAP!); bare skin, a light hit and a stagger (STAGGER); plate or
// his shield or guard, nothing (PLATE, a clang, it drops); nothing, MISSED, it flies on into the sand. Harder by its hold (pw).
export function arrowLands(E, r) {
  const B = TUNING.bow, J = TUNING.juice, f = state.foe, at = { x: r.x1, y: r.y1 }, ang = Math.atan2(r.y1 - r.y0, r.x1 - r.x0), { p, kind } = knifeAt(E, r.x1, r.y1), L = lay(E);
  const fall = (vx, vy) => { state.arrowFall = { x: at.x, y: at.y, vx, vy, rot: ang, vr: (Math.random() < 0.5 ? -1 : 1) * 8, flat: Math.PI * (Math.random() < 0.5 ? 0.02 : 0.98), floor: L.floor - 2, life: B.fall }; };
  if (kind === 'gap') {
    const dealt = Math.round(plainGap() * B.gap * r.pw * 2) / 2;
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
    const dealt = Math.round(B.skin * r.pw * 2) / 2;
    state.arrowSkin++; f.hp -= dealt;
    blood(at.x, at.y, ang, 6); dullSound(E); pop(at.x, at.y - 30, 'STAGGER', '#fbbf24', 22); dmgPop(E, at, dealt, '#fca5a5'); E.haptic(16);
    if (f.hp <= 0) fell(E); else staggerFoe(E, true);
    return;
  }
  if (kind === 'plate') { state.arrowPlate++; p.clang = 0.25; sparks(at.x, at.y, ang + Math.PI, 12); ring(at.x, at.y, 30, '#cbd5e1'); clangSound(E, 0); pop(at.x, at.y - 24, 'PLATE', '#cbd5e1', 20); E.haptic(12); fall(-Math.cos(ang) * 120, -140); return; }
  state.arrowMiss++; pop(at.x, at.y - 24, 'MISSED', '#e2e8f0', 20); E.audio.play('miss');
  fall(Math.cos(ang) * 420, Math.sin(ang) * 420 - 80);
}
// where the bow sits: its grip in your fist, its belly toward where you aim (or along your arm) and its string toward you; pt maps a point of its
// painting (TUNING.bow.art, px) to the screen
function bowFrame(E, a = state.aim) {
  const h = state.hand, A = TUNING.bow.art, k = TUNING.bow.len * myH(E) / (A.rest[1][1] - A.rest[0][1]);
  let ux = Math.cos(h.ang), uy = Math.sin(h.ang);
  if (a && a.bow) { const d = Math.hypot(a.x - h.hx, a.y - h.hy); if (d > 1) { ux = (a.x - h.hx) / d; uy = (a.y - h.hy) / d; } }
  return { A, k, ux, uy, pt: (x, y) => [h.hx + (ux * (x - A.grip[0]) - uy * (y - A.grip[1])) * k, h.hy + (uy * (x - A.grip[0]) + ux * (y - A.grip[1])) * k] };
}
// the arrow's drawn length, nock to tip, at the bow painting's scale
const arrowLen = (E) => { const B = TUNING.bow, R = B.arrow; return (R.tip[0] - R.nock[0]) * B.len * myH(E) / (B.art.rest[1][1] - B.art.rest[0][1]); };
// where your sword hand holds the bow: the arm straight toward the ring while you draw (and for TUNING.bow.follow s after a loose), low and forward
// with no thumb down
export function bowPt(E) {
  const H = myH(E), [sx, sy] = toScreen(youF(E), SHOULDER[0], SHOULDER[1]), a = state.aim;
  const q = a && a.bow ? a : state.follow && state.follow.t > 0 ? state.follow : null;
  if (q) { const d = Math.hypot(q.x - sx, q.y - sy) || 1, r = TUNING.arm.straightAt * H * 1.05; return [sx + (q.x - sx) / d * r, sy + (q.y - sy) / d * r]; }
  return [sx + TUNING.bow.rest[0] * H, sy + TUNING.bow.rest[1] * H];
}
// the arrow, its nock at (x, y) and its point len px along ang: Pack 29's painting, or drawn
function drawArrow(ctx, x, y, ang, len) {
  const R = TUNING.bow.arrow, P = kitOn() && artPic('arrow', R, len * Math.min((ENG && ENG.dpr) || 1, TUNING.skin.maxDpr));
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  // (drawn thick x R.thick across, or the painted shaft is a hairline at game size)
  if (P) { const k = len / (R.tip[0] - R.nock[0]); ctx.scale(k, k * R.thick); ctx.drawImage(P.im, -R.nock[0], -R.nock[1], R.size[0], R.size[1]); }
  else {
    ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = Math.max(1.5, len * 0.025); line(ctx, 0, 0, len * 0.92, 0);
    ctx.fillStyle = '#3a3f47'; ctx.beginPath(); ctx.moveTo(len, 0); ctx.lineTo(len * 0.9, -len * 0.035); ctx.lineTo(len * 0.9, len * 0.035); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8e2d2'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(len * 0.02, 0); ctx.lineTo(len * 0.16, 0); ctx.lineTo(len * 0.05, sd * len * 0.04); ctx.closePath(); ctx.fill(); }
  }
  ctx.restore();
}
// the bow in your hand: Pack 29's bow at rest and drawn, crossfading as the draw fills (TUNING.bow.art.fade), its string's point coming back to
// the drawn point; with no painting, a drawn one
export function drawBow(ctx, E) {
  const B = TUNING.bow, A = B.art, a = state.aim && state.aim.bow ? state.aim : null, f = bowFrame(E, a), dk = pullK(a), px = (A.rest[1][1] - A.rest[0][1]) * f.k * Math.min(E.dpr || 1, TUNING.skin.maxDpr);
  const R = kitOn() && artPic('weapon-bow', A, px), D = kitOn() && artPic('weapon-bow-drawn', A, px), nx = lerp(A.rest[0][0], A.nock, dk), ny = A.grip[1];
  if (R && D) {
    const o = f.pt(0, 0), x = clamp((dk - A.fade[0]) / (A.fade[1] - A.fade[0]), 0, 1), a0 = ctx.globalAlpha;
    ctx.save(); ctx.transform(f.ux * f.k, f.uy * f.k, -f.uy * f.k, f.ux * f.k, o[0], o[1]);
    // (the grip is the same in both, so it stays solid through the crossfade)
    const [lo, hi, k] = x <= 0.5 ? [R, D, x * 2] : [D, R, (1 - x) * 2];
    ctx.drawImage(lo.im, 0, 0, A.size[0], A.size[1]);
    if (k > 0) { ctx.globalAlpha = a0 * k; ctx.drawImage(hi.im, 0, 0, A.size[0], A.size[1]); ctx.globalAlpha = a0; }
    ctx.restore();
  } else {
    // drawn: two limbs bent back from the grip, the string from tip to tip through its point
    const ends = A.rest.map((q, i) => lerp2(q, A.drawn[i], dk)), g = f.pt(...A.grip), t = ends.map((q) => f.pt(...q)), mid = (q) => f.pt(lerp(A.grip[0], q[0], 0.4) + 40, lerp(A.grip[1], q[1], 0.6));
    ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = '#3b2412'; ctx.lineWidth = 0.022 * myH(E) + 2;
    ctx.beginPath(); ctx.moveTo(...t[0]); ctx.quadraticCurveTo(...mid(ends[0]), ...g); ctx.quadraticCurveTo(...mid(ends[1]), ...t[1]); ctx.stroke();
    ctx.strokeStyle = '#7a4a24'; ctx.lineWidth = 0.022 * myH(E); ctx.stroke();
    ctx.strokeStyle = '#ece4cf'; ctx.lineWidth = 1.5; const s = f.pt(nx, ny); ctx.beginPath(); ctx.moveTo(...t[0]); ctx.lineTo(...s); ctx.lineTo(...t[1]); ctx.stroke();
    ctx.restore();
  }
}
// the arrow nocked on the drawn string, over your forearm (drawKnives, after the arm)
function drawNocked(ctx, E) {
  const a = state.aim, A = TUNING.bow.art;
  if (!a || !a.bow || !bowShown()) return;
  const f = bowFrame(E, a), [x0, y0] = f.pt(lerp(A.rest[0][0], A.nock, pullK(a)), A.grip[1]);
  drawArrow(ctx, x0, y0, Math.atan2(f.uy, f.ux), arrowLen(E));
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
  shieldFace(ctx, E, B[2] * H, H, lk, !!(lk.kit && kitPic('upperarm', lk.kit.tier) && kitPic('forearm', lk.kit.tier)));
  ctx.restore();
}
// what the knife meets where it arrives, and the word for it: GAP! (TUNING.knives.dmg); PLATE on plate, his shield or guard (a clang); SKIN off bare
// skin (a glance); MISSED, into the sand
export function knifeLands(E, k) {
  const K = TUNING.knives, at = { x: k.x1, y: k.y1 }, ang = Math.atan2(k.y1 - k.y0, k.x1 - k.x0), { p, kind } = knifeAt(E, k.x1, k.y1);
  if (kind === 'gap') { knifeGap(E, p, at, ang); return; }
  if (kind === 'plate') { state.knifePlate++; p.clang = 0.25; sparks(at.x, at.y, ang + Math.PI, 12); ring(at.x, at.y, 30, '#cbd5e1'); clangSound(E, 0); pop(at.x, at.y - 24, 'PLATE', '#cbd5e1', 20); E.haptic(12); }
  else if (kind === 'skin') { state.knifeSkin++; sparks(at.x, at.y, ang + Math.PI, 4); dullSound(E); pop(at.x, at.y - 24, 'SKIN', '#fca5a5', 20); }
  else { state.knifeMiss++; pop(at.x, at.y - 24, 'MISSED', '#e2e8f0', 20); E.audio.play('miss'); }
  const L = lay(E);
  state.knifeFall = { x: at.x, y: at.y, vx: -Math.cos(ang) * 90, vy: -120, rot: ang, vr: (Math.random() < 0.5 ? -1 : 1) * 14, flat: Math.PI * (Math.random() < 0.5 ? 0.02 : 0.98), floor: L.floor - 2, life: K.fall };
}
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
// a small dark throwing knife, its point along ang from (x, y), len px from pommel to point
function drawKnife(ctx, x, y, ang, len) {
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
// in the world: the raised knife in your fist, pointing at the aim ring (gold; green over a gap, red over plate) with a thin line down to your
// thumb (or, before a thumb is down, to where it would be); the knife in flight; a spent one falling
export function drawKnives(ctx, E) {
  const K = TUNING.knives, B = TUNING.bow, len = K.len * youF(E).H, a = state.aim, k = state.knife, q = state.knifeFall;
  drawNocked(ctx, E);
  if (a) {
    // (step 24: the bow's ring is grey inside his reach, and tightens from ring[0] to ring[1] px as a full draw is held; a gold arc fills with the draw)
    const [hx, hy] = knifeHand(), ang = Math.atan2(a.y - hy, a.x - hx), close = a.bow && inReach(), col = close ? '#9ca3af' : a.over === 'gap' ? '#4ade80' : a.over === 'plate' ? '#f87171' : '#ffd24a';
    if (!a.bow) { ctx.save(); ctx.shadowColor = 'rgba(255,236,150,0.9)'; ctx.shadowBlur = 8; drawKnife(ctx, hx - Math.cos(ang) * len * 0.2, hy - Math.sin(ang) * len * 0.2, ang, len * K.held); ctx.restore(); }
    const pulse = 0.5 + 0.5 * Math.sin(state.m * 10), r = a.bow ? lerp(B.ring[0], B.ring[1], holdK(a)) : K.ring + 2 * pulse, tx = a.tx == null ? a.rx : a.tx, ty = a.tx == null ? a.ry + K.lift : a.ty;
    if (a.bow && pullK(a) < 1) { ctx.save(); ctx.strokeStyle = 'rgba(255,214,110,0.95)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(a.x, a.y, r + 6, -Math.PI / 2, -Math.PI / 2 + TAU * pullK(a)); ctx.stroke(); ctx.restore(); }
    ctx.save(); ctx.strokeStyle = col; ctx.globalAlpha = 0.7; ctx.lineWidth = 1.5; line(ctx, a.x, a.y + r, tx, ty); ctx.restore();
    if (a.id < 0) { ctx.save(); ctx.globalAlpha = 0.6; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(tx, ty, 5, 0, TAU); ctx.stroke(); ctx.restore(); }
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4; ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(a.x, a.y, r, 0, TAU); ctx.stroke();
    line(ctx, a.x - r - 6, a.y, a.x - r + 2, a.y); line(ctx, a.x + r - 2, a.y, a.x + r + 6, a.y); line(ctx, a.x, a.y - r - 6, a.x, a.y - r + 2);
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(a.x, a.y, 2.5, 0, TAU); ctx.fill(); ctx.restore();
  }
  if (k) { const u = clamp(k.t / k.dur, 0, 1); drawKnife(ctx, lerp(k.x0, k.x1, u), lerp(k.y0, k.y1, u), Math.atan2(k.y1 - k.y0, k.x1 - k.x0), len); }
  if (q) { ctx.globalAlpha = clamp(q.life / 0.3, 0, 1); drawKnife(ctx, q.x, q.y, q.rot, len); ctx.globalAlpha = 1; }
  // step 24: an arrow in flight (its point on the way to the ring), and one spent
  const r = state.arrow, rq = state.arrowFall, al = arrowLen(E);
  if (r) { const u = clamp(r.t / r.dur, 0, 1), an = Math.atan2(r.y1 - r.y0, r.x1 - r.x0), x = lerp(r.x0, r.x1, u), y = lerp(r.y0, r.y1, u); drawArrow(ctx, x - Math.cos(an) * al, y - Math.sin(an) * al, an, al); }
  if (rq) { ctx.globalAlpha = clamp(rq.life / 0.3, 0, 1); drawArrow(ctx, rq.x - Math.cos(rq.rot) * al, rq.y - Math.sin(rq.rot) * al, rq.rot, al); ctx.globalAlpha = 1; }
}
// the round buttons: ⇄ (its ring fills while you swap) and the knife button with the knives left (red while one is raised: a tap lowers it)
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
    E.text(`${state.knives}`, bx, by + 1, { size: 14, weight: '800', color: '#ffd24a' });
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
const KNIFE_LESSON = ['Tap the knife to raise it.', 'Drag onto a glowing gap.', 'Let go to throw.'];
// the ghost thumb lifting off, keyframed as GHOST's
const GHOST_LIFT = [[0, 0, 0, 1], [0.45, 0, 0, 1], [0.65, 0, -16, 0], [1, 0, -16, 0]];
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
  const got = ls.i === 0 ? !!a : ls.i === 1 ? !!a && a.id >= 0 && a.over === 'gap' && a.drag >= TUNING.knives.drag : thrown;
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
  const ls = state.kLesson, T = TUNING.train, K = TUNING.knives, L = 16 + E.safe.left, w = E.w - 16 - E.safe.right - 182 - L, cx = L + w / 2;
  yardPlate(ctx, E, L, w, KNIFE_LESSON[ls.i], ls.doneT >= 0);
  if (ls.doneT >= 0) { yardTick(ctx, cx, E.safe.top + 90, ls.t - ls.doneT); return; }
  const u = (ls.t % T.ghost.loop) / T.ghost.loop, pulse = 0.5 + 0.5 * Math.sin(ls.t * 8), b = armsBtns(E);
  // 1: the knife button pulses, and the ghost thumb taps it
  if (ls.i === 0) {
    if (!b || !b.knife) return;
    const c = b.knife;
    ctx.save(); ctx.strokeStyle = `rgba(255,210,74,${0.5 + 0.5 * pulse})`; ctx.lineWidth = 3 + 2 * pulse; ctx.beginPath(); ctx.arc(c.x, c.y, c.r + 5, 0, TAU); ctx.stroke(); ctx.restore();
    ghostThumb(ctx, c.x - c.r * 0.2, c.y + c.r * 0.1, ghostAt(GHOST.tap, u)[2]);
    return;
  }
  // 2: the gap rings, and the ghost thumb drags from the right side to just under it (the ring sits lift px above the thumb)
  if (ls.i === 1) {
    const g = lessonGap(E);
    if (!g) return;
    gapRings(ctx, E, ls.t, [g]);
    const [gx, gy] = partCenter(foeF(E), state.foe, g), sx = E.w * K.ghost[0], sy = E.h * K.ghost[1], ey = gy + K.lift;
    const keys = [[0, sx, sy, 1], [0.55, gx, ey, 1], [0.8, gx, ey, 1], [0.9, gx, ey, 0], [1, sx, sy, 0]];
    ctx.save(); ctx.strokeStyle = 'rgba(248,241,228,0.35)'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]); line(ctx, sx, sy, gx, ey); ctx.restore();
    const [x, y, dn] = ghostAt(keys, u);
    ghostThumb(ctx, x, y, dn);
    return;
  }
  // 3: the ghost thumb lifts off where yours is, in a growing ring (seen on a pale loincloth too)
  const a = state.aim;
  if (!a || a.tx == null) return;
  const [dx, dy, dn] = ghostAt(GHOST_LIFT, u);
  ghostThumb(ctx, a.tx + dx, a.ty + dy, dn, 0.2 + 0.6 * u);
}
