// Arena: Feature: the beast's charge (step 2026-11-21, the bow and beasts). Every beast bout opens with the beast at the far end of the sand running
// at you; arrows and knives that hit it stagger and slow it, and enough of them drop it before it arrives. If it reaches you the fight goes on from
// there, its first blow soon after. Hooks: game.js newRack (startCharge), fight.js stepFoe (stepCharge), foe.js updateFoe (it waits), fight.js camSpan
// (the camera holds it in frame), ranged.js arrowLands and knifeLands (chargeHit).
import { clamp } from '../engine.js';
import { TUNING } from '../tuning.js';
import { foeF, fell, blood, ring, sparks, pop, dmgPop, slotSound, sliceSound, dullSound, clangSound } from '../fight.js';
import { state, shake } from '../game.js';

// ====== THE CHARGE ======
// the beast's nose this far (H) beyond its home at the start; it covers that in TUNING.charge.time s, starting at v0 of its mean pace and speeding up
// evenly (distance = v0 t + a t^2 / 2, the sketch's run). Only a beast bout's first foe, never the yard, the trials or the lab. With a bow on your
// belt it is already in your hand: you saw it coming.
export function startCharge(E) {
  const C = TUNING.charge, f = state.foe;
  delete state.charge;
  if (!f || !f.beast || state.train || state.drill || state.trial || state.lab) return;
  const D = C.dist, v0 = C.v0 * D / C.time, a = 2 * (D - v0 * C.time) / (C.time * C.time);
  state.charge = { t: 0, left: D, v0, a, f: 1, kb: 0, rear: 0 };
  state.step.x = f.home + D;
  // (the camera cuts to the charge's frame, never easing from the last bout's: the beast is whole on screen from the first frame)
  state.cam = null;
  if (state.me.side === 'bow') { state.bowOut = true; state.bowSwap = false; }
}
// one frame of the run (in place of his footwork): it closes, a hit's knock-back and slowing wearing off; at its home it is here, and it strikes soon
export function stepCharge(E, dt) {
  const C = TUNING.charge, c = state.charge, f = state.foe;
  state.swingIn = Math.max(state.swingIn, 1);
  // (dropped in its run, it lies where it fell, and the camera stays on it: the charge ends with the bout)
  if (state.fallT > 0) return;
  c.t += dt; c.f = Math.min(1, c.f + dt / C.recover); c.rear = Math.max(0, c.rear - dt / C.stag);
  c.left = Math.max(0, c.left - (c.v0 + c.a * c.t) * c.f * dt + c.kb * dt);
  c.kb *= Math.exp(-C.kbDecay * dt);
  state.step.x = state.step.tgt = f.home + c.left;
  if (c.left <= 0) {
    delete state.charge;
    state.swingIn = C.blow;
    const F = foeF(E); pop(F.x, F.y - 1.0 * F.H, 'ROAR!', '#fca5a5', 22);
    E.audio.beep({ freq: 160, dur: 0.4, type: 'sawtooth', slide: 0.4, gain: 0.12 }); shake(E, 6, 0.2); E.haptic(20);
  }
}
// an arrow (pw: its power, 0 to 1) or a knife (pw null) meets the charging beast on part p: a share of its health by what it hit, a stagger that slows
// it and knocks it back; plate stops it. Returns the word said.
export function chargeHit(E, p, kind, at, ang, pw) {
  const C = TUNING.charge, c = state.charge, f = state.foe;
  if (kind === 'plate') {
    p.clang = 0.25; sparks(at.x, at.y, ang + Math.PI, 10); clangSound(E, 0); pop(at.x, at.y - 24, 'PLATE', '#cbd5e1', 20); E.haptic(12);
    return 'PLATE';
  }
  const head = p.d.id === 'head', big = kind === 'gap' || head, base = pw == null ? C.knife : C.hit * (C.weak + (1 - C.weak) * pw);
  const dealt = Math.max(1, Math.round(base * (big ? C.head : 1) * f.maxHp));
  f.hp -= dealt; p.flash = 0.16; p.cool = TUNING.hit.cool;
  if (kind === 'gap') { state.gapHits++; state.slotHits++; state.bout.gaps[p.d.id] = (state.bout.gaps[p.d.id] || 0) + 1; }
  const word = kind === 'gap' ? 'GAP!' : head ? 'HEAD!' : pw != null && pw < 0.5 ? 'WEAK' : 'HIT';
  blood(at.x, at.y, ang, big ? TUNING.juice.blood.slot : 6); ring(at.x, at.y, big ? TUNING.juice.slotRing : 30, big ? '#ef4444' : '#fbbf24');
  if (big) slotSound(E); else dullSound(E);
  sliceSound(E, big);
  pop(at.x, at.y - 30, word, big ? '#ffd24a' : '#fbbf24', 22); dmgPop(E, at, dealt, big ? '#ff6a4a' : '#fca5a5'); shake(E, big ? 8 : 5, 0.1); E.haptic(big ? 30 : 16);
  // (the first of a pair down: the second steps in on foot, no charge)
  if (f.hp <= 0) { if (state.edge && !state.edge.down) delete state.charge; fell(E); return word; }
  c.f = C.slow; c.kb = C.kb; c.rear = 1;
  return word;
}
// how far it rears from a hit (0 to 1), for its pose
export const chargeRear = () => (state.charge ? clamp(state.charge.rear, 0, 1) : 0);
