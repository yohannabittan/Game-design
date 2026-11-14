// Arena: Feature: the training yard (step 23). Hooks: play.enter (startYard for the drill), beginBout (yardDue, startYard), play.update (updateYard), play.onTap/onPointerUp (endYard, yardRelease), play.render (drawYard).
// Split from game.js by tools/arena-split.mjs (ADR-0024). Only tuning.js and data.js may be read while modules load.

import { clamp, lerp, ease } from '../engine.js';
import { TUNING } from '../tuning.js';
import { SHOULDER, ZONES, ZONE, playerParts } from '../data.js';
import { lay, youF, gMin, inReach, myH, myArm, myBlade, foeF, toScreen, partCenter, guardPt, raised, shieldMax, shieldBtns, ring, pop } from '../fight.js';
import { covered, buildMove, startMove } from '../foe.js';
import { perfectWin, firstRun } from '../cards.js';
import { sayLine, TAU, line, rrect } from '../draw-fight.js';
import { fitSize } from '../screens.js';
import { initHand, beginBout } from '../scenes.js';
import { state, easeOut, meSize, newRack, RUN_KEYS } from '../game.js';
import { yardKnife, armsBtns, lessonGap } from '../features/ranged.js';

// ====== YARD: the training yard ======
// ----- step 23: the training yard -----
// Before the first run's bout 1 (and from the menu's Training button), bout 1's sparring partner stands in, one control a step: a line of Brutus's at
// the top, a ghost thumb showing the gesture on its side, and no timer; a tick and a chime once it is done, then the next. Neither of you loses
// hearts: his blows here do none, and he never falls. Skip training ends it. The run's counts are put back as they were and the bout starts afresh.
// Each step: its line (the shield's is per height), its ghost, and what is counted (got: a running total, need: how many past the step's start).
const YARD_BLOW = { high: 'chop', mid: 'thrust', low: 'sweep' };
export const YARD = [
  { id: 'hand', line: 'Right thumb: your sword goes where you hold.', ghost: 'hand', got: (tr) => (tr.move >= TUNING.train.move ? 1 : 0), need: () => 1 },
  { id: 'jab', line: 'Push toward him: jab.', ghost: 'jab', want: 'jab', got: (tr) => tr.jabs, need: () => TUNING.train.jabs },
  { id: 'slash', line: 'Sweep across: slash.', ghost: 'slash', want: 'slash', got: () => state.slashes, need: () => TUNING.train.slashes },
  { id: 'over', line: (tr) => (tr.higher ? 'Higher first. Then chop down.' : 'Up, then down: overhead.'), ghost: 'over', want: 'over', got: () => state.overheads, need: () => TUNING.train.overs },
  { id: 'lunge', line: 'Push long and hold: lunge in.', ghost: 'lunge', got: () => state.lunges, need: () => TUNING.train.lunges },
  { id: 'shield', line: (tr) => { const z = ZONES[Math.min(tr.blocked, ZONES.length - 1)]; return `He swings ${z.id}. Left thumb: ${z.label}.`; }, ghost: 'shield', got: (tr) => tr.blocked, need: () => ZONES.length },
  { id: 'dodge', line: 'Tap DODGE to step back.', ghost: 'tap', got: () => state.dodges, need: () => 1 },
  { id: 'hold', line: 'Hold DODGE to back off.', ghost: 'hold', got: (tr) => tr.held, need: () => 1 },
  { id: 'gap', line: 'See the glow? A gap. Hit it.', ghost: 'gap', got: (tr) => tr.gaps, need: () => 1 },
  // step 24: a practice knife (TUNING.train.knife), raised with a tap and thrown with a drag; a tap on him throws nothing
  { id: 'knife', line: () => (state.aim ? 'Drag onto the gap, and let go.' : 'Tap the knife to raise it.'), ghost: 'knife', got: () => state.knivesThrown, need: () => 1 },
  { id: 'read', line: "When he glows, he's about to swing.", ghost: 'read', got: (tr) => tr.read, need: () => 1 },
  // step 23b: the last two lessons
  { id: 'perfect', line: 'Block just as it lands: perfect.', ghost: 'perfect', got: () => state.perfects, need: () => TUNING.train.perfects },
  { id: 'tell', line: 'Dodge just as he swings.', ghost: 'tell', got: (tr) => tr.dodged, need: () => 1 },
  { id: 'go', line: 'Now fight.' },
];
// the ghost thumb's loops on a button: keyframes [phase, dx, dy, pressed] (the sword thumb's paths are worked out each frame, ghostPath)
export const GHOST = {
  tap: [[0, 0, 0, 0], [0.2, 0, 0, 1], [0.4, 0, 0, 1], [0.5, 0, 0, 0], [1, 0, 0, 0]],
  hold: [[0, 0, 0, 0], [0.1, 0, 0, 1], [0.85, 0, 0, 1], [0.95, 0, 0, 0], [1, 0, 0, 0]],
};
// why an attempt didn't count
const WHY = { slow: 'TOO SLOW', early: 'EARLY', late: 'TOO LATE', height: 'WRONG HEIGHT', missed: 'MISSED', gap: 'NOT A GAP', further: 'PUSH FURTHER', hold: 'HOLD IT LONGER',
  block: 'DODGE, NOT BLOCK', jab: 'THAT WAS A JAB', slash: 'THAT WAS A SLASH', over: 'THAT WAS AN OVERHEAD', tap: 'DRAG, THEN LET GO' };
export const yardDue = (E) => !state.drill && state.rack === 0 && firstRun(E) && !E.save.get('trainDone', 0);
export function startYard(E, drill = false) {
  state.intro = false; state.introGo = -1; state.hint = false; state.boutT0 = state.m;
  state.train = { i: -1, drill, snap: JSON.parse(JSON.stringify(Object.fromEntries(RUN_KEYS.map((k) => [k, state[k]])))), move: 0, px: null, py: null, jabs: 0, gaps: 0,
    blocked: 0, held: 0, read: 0, dodged: 0, sw: null, wait: 0, skip: null, press: null, log: [] };
  nextYard(E);
}
export function nextYard(E) {
  const tr = state.train;
  // (the knife step's practice knives go back when it ends; your own were never touched)
  if (tr.kn0 != null) { state.knives = tr.kn0; tr.kn0 = null; state.aim = null; }
  tr.i++; tr.t = 0; tr.doneT = -1; tr.sw = null; tr.wait = TUNING.train.gap;
  const st = YARD[tr.i];
  if (st.id === 'knife') { tr.kn0 = state.knives; state.knives += TUNING.train.knife; }
  // (a hold made in the steps before counts for nothing)
  if (st.id === 'hold') { tr.press = null; tr.held = 0; }
  tr.base = st.got ? st.got(tr) : 0;
  // what the step's "why it didn't count" watches: the stroke in hand, a raise not yet used, the dodges before his tell, Brutus's second line
  Object.assign(tr, { fails: 0, whyM: -9, atk: state.hand.atk, run: null, rz: state.hand.raisedT, d0: state.dodges, endM: -9, higher: false, g0: 0 });
  // every step starts with both of you back on your marks, mid-ring, with ground behind you to give; he stands where your jab lands on him
  const gap = yardStand(E, state.foe);
  state.foe.strike = gap;
  Object.assign(state.foot, { pos: 0, tgt: 0, v: 1 }); Object.assign(state.step, { x: gap, tgt: 0 });
}
// the gap (H) the yard stands him at: his own striking distance, drawn in until your plain jab (shoulder, straight arm and blade, no lunge) reaches
// jabIn H into his front, never nearer than the bodies can stand. His blows still reach you (inReach follows his strike)
function yardStand(E, f) {
  const L = lay(E), Fy = youF(E), B = TUNING.fighter.body, own = f.weapon.strike + f.size.reach;
  const tip = L.x0 - (meSize().scale - 1) * B * L.H + SHOULDER[0] * Fy.H + myArm(E) + myBlade(E) - TUNING.train.jabIn * myH(E);
  return clamp((tip - L.x1 + B * L.H) / L.H, gMin(E), own);
}
// the yard as the export writes it: `hand2,jab4/1,over31/6,...` (seconds, and failed attempts when there were any)
const yardEntry = (id, t, fails) => `${id}${Math.round(t)}${fails ? `/${fails}` : ''}`;
export function endYard(E, skipped = false) {
  const tr = state.train, st = YARD[tr.i];
  if (skipped && st.got && tr.doneT < 0) tr.log.push(yardEntry(st.id, tr.t, tr.fails));
  state.train = null; E.save.set('trainDone', 1);
  if (tr.drill) { E.setScene('menu'); return; }
  Object.assign(state, tr.snap);
  Object.assign(state, { stamina: state.staMax, exhaust: 0, away: false, dodgeT: 0, dodgeCool: 0, lunging: false, lng: null, netT: 0, pushT: 0, hurt: 0, caption: null, pops: [], jabRun: 0, hpSeen: state.hp, heartFx: null, shatter: null });
  Object.assign(state.you, { lunge: 0, lungeK: 0, drive: 0, dk: 0, back: 0, hopY: 0, push: 0, parts: playerParts(state.me) });
  Object.assign(state.dg, { down: false, id: -1, t: 0 }); Object.assign(state.sh, { held: false, hid: -1, t: -1, arm: 0 });
  state.hand.down = false; state.hand.atk = null;
  state.yard = tr.log.join(','); state.yardSkip = skipped && st.got ? st.id : '';
  newRack(E); initHand(E); beginBout(E);
}
// the export's yard fields: past the ledger's length the steps run on into yard2
export function yardFields() {
  if (!state.yard) return {};
  const s = state.yard, cap = TUNING.train.field, cut = s.length > cap ? s.lastIndexOf(',', cap) : -1;
  return { ...(cut > 0 ? { yard: s.slice(0, cut), yard2: s.slice(cut + 1) } : { yard: s }), ...(state.yardSkip ? { yardSkip: state.yardSkip } : {}) };
}
// an attempt that didn't count: one more failed attempt for the export, and a few words why over the action
function yardMiss(E, why, x, y) {
  const tr = state.train;
  tr.fails++;
  if (state.m - tr.whyM < TUNING.train.why) return;
  tr.whyM = state.m;
  pop(x, y, WHY[why], '#fdba74', 22, E.safe.top + 110); E.audio.beep({ freq: 220, dur: 0.12, type: 'triangle', slide: 0.7, gain: 0.1 });
}
const missAtTip = (E, why) => yardMiss(E, why, state.hand.ux, state.hand.uy - 34);
const missAtYou = (E, why) => { const Fy = youF(E); yardMiss(E, why, Fy.x + 0.3 * Fy.H, Fy.y - 1.05 * Fy.H); };
// what your blade met, in the yard: jabs that land, and hits in a gap
export function yardLand(E, a, p) {
  const tr = state.train, gap = p.slot && !covered(p);
  if (a.kind === 'jab') tr.jabs++;
  if (gap) tr.gaps++;
  else if (YARD[tr.i].id === 'gap' && tr.doneT < 0) missAtTip(E, 'gap');
}
// one of his blows in the yard: slow and scripted at a height (the shield; mid for the perfect block), or his ordinary tell (reading, the dodge in
// his tell); none of them hurts
function yardBlow(E, st) {
  const tr = state.train, z = st.id === 'perfect' ? 'mid' : ZONES[Math.min(tr.blocked, ZONES.length - 1)].id, slow = st.id === 'shield' || st.id === 'perfect';
  const mv = slow ? { kind: YARD_BLOW[z], cost: 0, hits: [{ zone: z, wind: TUNING.train.wind, dmg: 0, pose: YARD_BLOW[z] }] } : buildMove(state.rng, 'thrust', { avoid: null, wind: 1 });
  for (const h of mv.hits) h.dmg = 0;
  startMove(E, mv, false); tr.sw = state.sw; tr.p0 = state.perfects;
}
// how one of his blows ended, for the step: a block, a perfect block, a dodge in his tell, or why it didn't count
function yardOutcome(E, st, sw) {
  const tr = state.train, o = sw.outcome, sh = state.sh, up = sh.held || raised();
  if (o === 'block') tr.blocked++;
  if (st.id === 'read' && (o === 'block' || o === 'dodge')) tr.read = 1;
  if (st.id === 'tell' && o === 'dodge') tr.dodged = 1;
  if (o === 'block' && st.id === 'perfect' && state.perfects === tr.p0) missAtYou(E, 'early');
  if (o === 'block' && st.id === 'tell') missAtYou(E, 'block');
  if (o === 'hit') missAtYou(E, st.id === 'tell' ? (state.dodgeM >= sw.m0 ? 'early' : 'late') : up && sh.zone !== sw.zone ? 'height' : 'late');
}
// the sword steps watch each stroke: one of the wrong kind, a jab that met nothing, a jab that never became a lunge, a stroke too slow to count,
// and in the overhead's step a raise let go by
function yardStrokes(E, st) {
  const tr = state.train, h = state.hand, AT = TUNING.attack, SL = TUNING.train.slow, a = h.atk, real = (q) => q && q.kind !== 'raise' && q.kind !== 'pull';
  if (a !== tr.atk) {
    const old = tr.atk; tr.atk = a;
    if (real(old) && old.kind === 'jab' && !old.done && (st.id === 'jab' || st.id === 'gap')) missAtTip(E, 'missed');
    if (real(old) && old.kind === 'jab' && st.id === 'lunge' && !state.lunging && state.lunges - tr.base < st.need()) missAtTip(E, 'further');
    if (real(a)) {
      tr.rz = h.raisedT;
      if (st.want && a.kind !== st.want) {
        missAtTip(E, a.kind);
        // the overhead's step: Brutus says it again his other way, and the ghost starts over
        if (st.id === 'over') { tr.higher = true; tr.g0 = tr.t; }
      }
    }
  }
  if (st.id === 'over' && h.raisedT > tr.rz && state.m - h.raisedT > AT.over.window) { tr.rz = h.raisedT; if (h.down) missAtTip(E, 'slow'); }
  // a stroke: the tip kept above slow.sp; too slow when it went far enough the step's way but no blow was born of it
  if (st.id !== 'jab' && st.id !== 'slash' && st.id !== 'gap') return;
  if (h.down && h.sp >= SL.sp) {
    const r = tr.run || (tr.run = { x: h.ux, y: h.uy, peak: 0, born: false });
    r.peak = Math.max(r.peak, h.sp); r.ex = h.ux; r.ey = h.uy; if (real(a)) r.born = true;
  } else if (tr.run) {
    const r = tr.run, dx = r.ex - r.x, dy = r.ey - r.y, d = Math.hypot(dx, dy), C = TUNING.control, ga = Math.atan2(C.guard[1], C.guard[0]);
    const fwd = d > 0 && (dx * Math.cos(ga) + dy * Math.sin(ga)) / d > C.jabCone, need = st.id === 'slash' ? TUNING.hit.minSpeed : AT.jab.minSpeed;
    tr.run = null;
    if (!r.born && r.peak < need && d >= SL.len * myH(E) && fwd === (st.id !== 'slash')) yardMiss(E, 'slow', r.ex, r.ey - 34);
  }
}
// DODGE let go in the hold step before it became a hold
export function yardRelease(E, press) {
  const tr = state.train;
  if (YARD[tr.i].id === 'hold' && tr.doneT < 0 && !tr.held && state.m - press.t0 > TUNING.dodge.dur * 0.5) missAtYou(E, 'hold');
}
export function updateYard(E, dt) {
  const tr = state.train, T = TUNING.train, st = YARD[tr.i], h = state.hand, f = state.foe;
  tr.t += dt;
  // he never falls and never swings on his own (but stays at striking distance); your breath comes back between lunges, and your shield never wears
  f.hp = f.shown = f.maxHp; state.swingIn = TUNING.step.lead / 2;
  if (!state.lunging) { state.stamina = state.staMax; state.exhaust = 0; }
  state.sh.hits = shieldMax(); state.sh.broken = false;
  if (st.id === 'go') { if (tr.t >= T.go) endYard(E); return; }
  if (tr.doneT >= 0) { if (tr.t - tr.doneT >= T.next) nextYard(E); return; }
  if (h.down) { if (tr.px != null) tr.move += Math.hypot(h.fx - tr.px, h.fy - tr.py); tr.px = h.fx; tr.py = h.fy; } else tr.px = tr.py = null;
  // a hold is DODGE kept pressed past a dodge's length, however soon the wall behind ends the backing off
  if (tr.press && state.m - tr.press.t0 > TUNING.dodge.dur + T.hold) tr.held = 1;
  if (st.id === 'gap' || st.id === 'knife') state.openAll = Math.max(state.openAll, 0.5);
  yardStrokes(E, st);
  if (st.id === 'shield' || st.id === 'read' || st.id === 'perfect' || st.id === 'tell') {
    // the dodge in his tell: one made before his tell began is early
    if (st.id === 'tell' && state.dodges > tr.d0) { if (!tr.sw && state.m - tr.endM > T.why) missAtYou(E, 'early'); tr.d0 = state.dodges; }
    if (tr.sw && tr.sw.outcome) { yardOutcome(E, st, tr.sw); tr.sw = null; tr.wait = T.gap; tr.endM = state.m; }
    else if (tr.sw && state.sw !== tr.sw) { tr.sw = null; tr.wait = T.gap; }
    else if (!tr.sw && !state.sw && state.winded <= 0 && state.stun <= 0 && (tr.wait -= dt) <= 0 && inReach()) yardBlow(E, st);
  }
  if (st.got(tr) - tr.base >= st.need()) {
    tr.doneT = tr.t; tr.log.push(yardEntry(st.id, tr.t, tr.fails));
    yardChime(E);
    // (a knife thrown here is Step 22b's lesson learnt)
    if (st.id === 'knife') E.save.set('knifeHint', 1);
  }
}
// the knife step: a raised knife let go of with no drag throws nothing; it says so, and the ghost starts over
export function yardKnifeTap(E) {
  const tr = state.train;
  if (!yardKnife() || tr.doneT >= 0) return;
  const a = state.aim; yardMiss(E, 'tap', a ? a.x : E.w / 2, (a ? a.y : E.h / 2) - 30); tr.g0 = tr.t;
}
// the knife step's ghost: the knife button pulsing under a tapping thumb, then (raised) a drag from the right side to just under the gap and a lift
function knifeGhost(ctx, E, u) {
  const b = armsBtns(E), K = TUNING.knives, pulse = 0.5 + 0.5 * Math.sin(state.train.t * 8);
  if (!state.aim) {
    if (!b || !b.knife) return;
    const c = b.knife;
    ctx.save(); ctx.strokeStyle = `rgba(255,210,74,${0.5 + 0.5 * pulse})`; ctx.lineWidth = 3 + 2 * pulse; ctx.beginPath(); ctx.arc(c.x, c.y, c.r + 5, 0, TAU); ctx.stroke(); ctx.restore();
    ghostThumb(ctx, c.x - c.r * 0.2, c.y + c.r * 0.1, ghostAt(GHOST.tap, u)[2]);
    return;
  }
  const g = lessonGap(E);
  if (!g) return;
  gapRings(ctx, E, state.train.t, [g]);
  const [gx, gy] = partCenter(foeF(E), state.foe, g), sx = E.w * K.ghost[0], sy = E.h * K.ghost[1], ey = gy + K.lift;
  const keys = [[0, sx, sy, 1], [0.55, gx, ey, 1], [0.8, gx, ey, 1], [0.9, gx, ey, 0], [1, sx, sy, 0]];
  ctx.save(); ctx.strokeStyle = 'rgba(248,241,228,0.35)'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]); line(ctx, sx, sy, gx, ey); ctx.restore();
  const [x, y, dn] = ghostAt(keys, u);
  ghostThumb(ctx, x, y, dn);
}
// a step done: the chime, and a tick that springs in at (cx, ty), u s after
export function yardChime(E) { E.audio.beep({ freq: 880, dur: 0.12, type: 'triangle', gain: 0.12 }); E.audio.beep({ freq: 1320, dur: 0.2, type: 'triangle', gain: 0.1, delay: 0.09 }); E.haptic(12); }
export function yardTick(ctx, cx, ty, u) {
  const k = easeOut(clamp(u / 0.2, 0, 1)), r = 22 * k;
  ctx.save(); ctx.fillStyle = 'rgba(20,60,30,0.85)'; ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, ty, r, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(cx - r * 0.45, ty); ctx.lineTo(cx - r * 0.1, ty + r * 0.35); ctx.lineTo(cx + r * 0.5, ty - r * 0.35); ctx.stroke(); ctx.restore();
}
// Brutus's line on a dark plate at the top, x0 to x0 + w (its rim green once the step is done)
export function yardPlate(ctx, E, x0, w, line, done) {
  const top = E.safe.top;
  E.roundRect(x0, top + 6, w, 44, 12, 'rgba(20,12,4,0.78)', done ? '#4ade80' : '#e6c866');
  sayLine(ctx, E, line, x0 + w / 2, top + 28, w - 16, { size: 17, weight: '800', color: '#fde68a', fit: true }, 'brutus');
}
// a pulsing gold ring on each of these parts of his
export function gapRings(ctx, E, t, parts) {
  const F = foeF(E), a = 0.5 + 0.5 * Math.sin(t * 8);
  for (const p of parts) {
    const [px, py] = partCenter(F, state.foe, p);
    ctx.save(); ctx.strokeStyle = `rgba(255,210,74,${0.4 + 0.6 * a})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px, py, 12 + 5 * a, 0, TAU); ctx.stroke(); ctx.restore();
  }
}
// the ghost thumb at (x, y): pressed, a solid pale thumb; lifted, a faint one; a hold grows a ring
export function ghostThumb(ctx, x, y, down, ring = 0) {
  const G = TUNING.train.ghost;
  ctx.save(); ctx.globalAlpha = G.alpha * (0.35 + 0.65 * down);
  ctx.fillStyle = '#f8f1e4'; ctx.strokeStyle = '#3b2f24'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(x, y + G.h * 0.3, G.w / 2, G.h / 2, -0.25, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e9d9c2'; ctx.beginPath(); ctx.ellipse(x - 2, y + G.h * 0.08, G.w * 0.3, G.h * 0.22, -0.25, 0, TAU); ctx.fill();
  if (ring > 0) { ctx.globalAlpha = G.alpha; ctx.strokeStyle = '#7de3ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, G.w * (0.7 + ring), 0, TAU); ctx.stroke(); }
  ctx.restore();
}
// a keyframed loop at phase u: [dx, dy, pressed]
export function ghostAt(keys, u) {
  let i = 0;
  while (i < keys.length - 2 && keys[i + 1][0] <= u) i++;
  const [t0, x0, y0, d0] = keys[i], [t1, x1, y1] = keys[i + 1], k = ease.inOut(clamp((u - t0) / Math.max(1e-3, t1 - t0), 0, 1));
  return [lerp(x0, x1, k), lerp(y0, y1, k), d0];
}
// ----- step 23b: the ghost's paths, worked out from the fight as it stands this frame -----
// Where your hand and tip would be with the hand aimed at (tx, ty), as solveArm puts them (thrust 1: the blade along the arm, as in a jab).
export function tipFor(E, tx, ty, thrust) {
  const A = TUNING.arm, G = TUNING.grip, H = myH(E), [sx, sy] = toScreen(youF(E), SHOULDER[0], SHOULDER[1]);
  const d = Math.hypot(tx - sx, ty - sy) || 1, ang = Math.atan2(ty - sy, tx - sx), e = clamp((d / H - A.chamberAt) / (A.straightAt - A.chamberAt), 0, 1);
  const r = myArm(E) * (A.minFrac + (A.full - A.minFrac) * e), hx = sx + Math.cos(ang) * r, hy = sy + Math.sin(ang) * r;
  const ph = ang + (G.straight + (G.chamber - G.straight) * (1 - e)) * (1 - thrust), b = myBlade(E);
  return { hx, hy, ux: hx + Math.cos(ph) * b, uy: hy + Math.sin(ph) * b };
}
// the hand's aim that brings the tip to (px, py), or as near as an aim within `reach` arm lengths of the guard gets it
function aimFor(E, px, py, thrust, reach) {
  const [gx, gy] = guardPt(E), lim = reach * myArm(E);
  let tx = px, ty = py;
  for (let i = 0; i < 8; i++) {
    const q = tipFor(E, tx, ty, thrust); tx += px - q.ux; ty += py - q.uy;
    const ox = tx - gx, oy = ty - gy, d = Math.hypot(ox, oy) || 1;
    if (d > lim) { tx = gx + ox / d * lim; ty = gy + oy / d * lim; }
  }
  return [tx, ty];
}
// a point on him: a part's centre, or (a beast, with no such part) the place on his figure, his H above his feet
export function foeAt(E, id, up) {
  const F = foeF(E), p = state.foe.parts.find((q) => q.d.id === id);
  return p ? partCenter(F, state.foe, p) : toScreen(F, 0, -up);
}
// the open gap the gap step points at: the one nearest his chest
function yardGap(E) {
  const F = foeF(E), [cx, cy] = foeAt(E, 'chest', 0.6);
  let best = null, bd = Infinity;
  for (const p of state.foe.parts) {
    if (!p.slot || covered(p)) continue;
    const [px, py] = partCenter(F, state.foe, p), d = Math.hypot(px - cx, py - cy);
    if (d < bd) { bd = d; best = [px, py]; }
  }
  return best;
}
// A ghost's path: its keyframes [phase, x, y, pressed] as hand aims (screen px, the first the guard), its thrust, and the point on him it is for.
// The thumb is a trackpad: wherever it touches is the guard, so the ghost's thumb draws each aim's offset from the guard, divided by the gain.
export function ghostPath(E, id) {
  const chest = () => { const c = foeAt(E, 'chest', 0.6), F = foeF(E); return [c[0] + F.dir * TUNING.train.path.front * F.H, c[1]]; };
  const P = TUNING.train.path, [gx, gy] = guardPt(E), F = foeF(E), arm = myArm(E), H = myH(E), line = gy - TUNING.attack.over.raise * H;
  if (id === 'jab' || id === 'gap') {
    // a jab: the hand drawn in toward the shoulder on the line to the point, then pushed straight out along it
    const at = id === 'gap' ? yardGap(E) || chest() : chest(), end = aimFor(E, at[0], at[1], 1, P.reach), [sx, sy] = toScreen(youF(E), SHOULDER[0], SHOULDER[1]);
    const d = Math.hypot(end[0] - sx, end[1] - sy) || 1, st = [sx + (end[0] - sx) / d * P.chamber * H, sy + (end[1] - sy) / d * P.chamber * H];
    return { thrust: 1, at, keys: [[0, gx, gy, 1], [0.22, ...st, 1], [0.3, ...end, 1], [0.5, ...end, 0], [1, gx, gy, 0]] };
  }
  if (id === 'slash') {
    const [h0, h1, x0, x1] = P.slash, a = toScreen(F, x0, -h0), b = toScreen(F, x1, -h1);
    const s0 = aimFor(E, a[0], a[1], 0, P.reach);
    // a slash starts with the hand below the raise line, or it would be an overhead
    for (let i = 0; i < 6; i++) s0[1] += Math.max(0, line + P.up * H - tipFor(E, s0[0], s0[1], 0).hy);
    const s1 = aimFor(E, b[0], b[1], 0, P.reach);
    return { thrust: 0, at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], keys: [[0, gx, gy, 1], [0.25, ...s0, 1], [0.3, ...s0, 1], [0.39, ...s1, 1], [0.55, ...s1, 0], [1, gx, gy, 0]] };
  }
  if (id === 'over') {
    // up: the arm swung up from the shoulder, from forward toward straight up, until the hand is well above your head and the tip above his
    const hd = foeAt(E, 'head', 0.8), top = hd[1] - P.over * F.H, [sx, sy] = toScreen(youF(E), SHOULDER[0], SHOULDER[1]), r = TUNING.arm.straightAt * H;
    let up = null;
    for (let a = -0.4; a >= -Math.PI / 2 - 0.4 && !up; a -= 0.05) {
      const q = [sx + Math.cos(a) * r, sy + Math.sin(a) * r], o = Math.hypot(q[0] - gx, q[1] - gy), t = tipFor(E, q[0], q[1], 0);
      if (o <= P.reach * arm && t.hy <= line - P.up * H && t.uy <= top) up = q;
    }
    if (!up) up = [sx + Math.cos(-1.3) * r, sy + Math.sin(-1.3) * r];
    const dn = aimFor(E, hd[0], hd[1] + P.through * F.H, 0, P.reach);
    return { thrust: 0, at: hd, keys: [[0, gx, gy, 1], [0.3, ...up, 1], [0.45, ...up, 1], [0.55, ...dn, 1], [0.7, ...dn, 0], [1, gx, gy, 0]] };
  }
  // the lunge: a long push past him, through his chest
  const c = chest(), d = Math.hypot(c[0] - gx, c[1] - gy) || 1, end = [gx + (c[0] - gx) / d * P.lunge * arm, gy + (c[1] - gy) / d * P.lunge * arm];
  return { thrust: 1, at: c, lunge: true, keys: [[0, gx, gy, 1], [0.35, ...end, 1], [0.75, ...end, 1], [0.85, ...end, 0], [1, gx, gy, 0]] };
}
export function drawYard(ctx, E) {
  const tr = state.train, st = YARD[tr.i], T = TUNING.train, top = E.safe.top, L = 16 + E.safe.left, R = E.w - 16 - E.safe.right - 182;
  // Skip training, top left (where BOUT and the crowd sit in a bout)
  tr.skip = { x: L, y: top + 6, w: 124, h: 44 };
  E.roundRect(tr.skip.x, tr.skip.y, tr.skip.w, tr.skip.h, 12, 'rgba(31,41,55,0.9)', '#c4b99a');
  E.text('Skip training', L + 62, top + 28, { size: fitSize(ctx, 'Skip training', 15, 112), weight: '800', color: '#f0e6cc' });
  // his line on a dark plate between Skip and the HUD, the step's count (when it is more than one) under it
  const x0 = tr.skip.x + tr.skip.w + 10, w = R - x0, cx = x0 + w / 2, line = typeof st.line === 'function' ? st.line(tr) : st.line;
  yardPlate(ctx, E, x0, w, line, tr.doneT >= 0);
  const need = st.need ? st.need() : 0, got = st.got ? clamp(st.got(tr) - tr.base, 0, need) : 0;
  if (need > 1) for (let i = 0; i < need; i++) { ctx.fillStyle = i < got ? '#4ade80' : 'rgba(240,230,204,0.35)'; ctx.beginPath(); ctx.arc(cx + (i - (need - 1) / 2) * 16, top + 60, 5, 0, TAU); ctx.fill(); }
  if (tr.doneT >= 0) { yardTick(ctx, cx, top + 90, tr.t - tr.doneT); return; }
  if (!st.ghost) return;
  // the gaps step rings each open gap
  if (st.id === 'gap') gapRings(ctx, E, tr.t, state.foe.parts.filter((q) => q.slot && !q.guard && !q.cut));
  // the ghost thumb: the right thumb's between the fighters below knee height (clear of your hand as it rises); the left thumb's on its button, which pulses
  const u = ((tr.t - tr.g0) % T.ghost.loop) / T.ghost.loop, [ax, ay] = [E.w * T.ghost.at[0], E.h * T.ghost.at[1]], B = shieldBtns(E), sw = state.sw, left = sw ? sw.wind - sw.t : 9;
  const btn = st.ghost === 'shield' ? B[Math.min(tr.blocked, ZONES.length - 1)] : st.ghost === 'read' || st.ghost === 'perfect' ? B[ZONES.indexOf(sw ? sw.zone : ZONE.mid)]
    : st.ghost === 'tap' || st.ghost === 'hold' || st.ghost === 'tell' ? B[3] : null;
  if (btn) {
    const pulse = 0.5 + 0.5 * Math.sin(tr.t * 8);
    ctx.save(); ctx.strokeStyle = `rgba(255,210,74,${0.5 + 0.5 * pulse})`; ctx.lineWidth = 3 + 2 * pulse; rrect(ctx, btn.x - 3, btn.y - 3, btn.w + 6, btn.h + 6, 14); ctx.stroke(); ctx.restore();
    // the last two lessons press with his blow: in the perfect-block window, and as his tell nears its end
    const [, , dn] = st.ghost === 'perfect' ? [0, 0, sw && left <= perfectWin() ? 1 : 0] : st.ghost === 'tell' ? [0, 0, sw && left <= TUNING.dodge.dur && left > 0 ? 1 : 0]
      : ghostAt(GHOST[st.ghost === 'hold' ? 'hold' : 'tap'], u);
    ghostThumb(ctx, btn.x + btn.w * 0.62, btn.y + btn.h * 0.5, dn, st.ghost === 'hold' && dn ? 0.6 * clamp((u - 0.1) / 0.75, 0, 1) : 0);
    return;
  }
  const k = E.h / 375;
  if (st.ghost === 'knife') { knifeGhost(ctx, E, u); return; }
  if (st.ghost === 'hand') { const a = u * TAU; ghostThumb(ctx, ax + 28 * k * Math.cos(a), ay + 20 * k * Math.sin(a), 1); return; }
  const gp = ghostPath(E, st.ghost), [gx, gy] = guardPt(E), G = TUNING.control.gain;
  const keys = gp.keys.map(([ph, x, y, d]) => [ph, (x - gx) / G, (y - gy) / G, d]), GT = T.ghost, C = TUNING.control, arm = myArm(E);
  // (the whole path is lifted, or drawn in, to keep the thumb on the screen)
  const ox = Math.min(0, E.w - E.safe.right - GT.w - ax - Math.max(...keys.map((q) => q[1]))), oy = Math.min(0, E.h - E.safe.bottom - GT.h - ay - Math.max(...keys.map((q) => q[2])));
  for (const q of keys) { q[1] += ox; q[2] += oy; }
  // a lunge's tip goes on with your stride as the push passes its start
  const stride = (x, y) => (gp.lunge ? TUNING.lunge.stride * myH(E) * clamp((Math.hypot(x - gx, y - gy) / arm - C.lungeStart) / (C.lungeFull - C.lungeStart), 0, 1) : 0);
  // where the tip goes on him: a dotted trail along the pressed part of the path, and a ring on the point it is for
  const dn = gp.keys.filter((q) => q[3]), n = T.path.tip;
  ctx.save(); ctx.fillStyle = 'rgba(255,214,110,0.7)';
  for (let i = 0; i < dn.length - 1; i++) for (let j = 0; j < n; j++) {
    const f = j / n, x = lerp(dn[i][1], dn[i + 1][1], f), y = lerp(dn[i][2], dn[i + 1][2], f), q = tipFor(E, x, y, gp.thrust);
    ctx.beginPath(); ctx.arc(q.ux + stride(x, y), q.uy, 2.2, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,214,110,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(gp.at[0], gp.at[1], 10, 0, TAU); ctx.stroke(); ctx.restore();
  // the thumb's path, faint, then the thumb on it
  ctx.save(); ctx.strokeStyle = 'rgba(248,241,228,0.35)'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]); ctx.beginPath();
  keys.filter((q) => q[3]).forEach((q, i) => (i ? ctx.lineTo(ax + q[1], ay + q[2]) : ctx.moveTo(ax + q[1], ay + q[2]))); ctx.stroke(); ctx.restore();
  const [dx, dy, d] = ghostAt(keys, u);
  ghostThumb(ctx, ax + dx, ay + dy, d);
}
