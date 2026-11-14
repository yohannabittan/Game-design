// Arena check helpers: open the game with a save, send thumb paths, jump to a training step, read the fight's geometry.
// Kept in the repo so each builder starts from them (docs/games/arena/RECIPES.md, recipe 11) and adds to them.
//   import { open, VET, FRESH, ptr, stroke, yardAt, logAtk, geo, OUT } from '../../tools/checks/arena.mjs';
// ROOT is the checkout this file sits in, so in a worktree it drives the worktree's game. OUT=<dir> says where frames go.
import { open as driveOpen, ROOT as HERE } from '../drive.mjs';
export const ROOT = process.env.ROOT || HERE;
export const OUT = process.env.OUT || '.';
export const VAULT = ['vault-wall', 'vault-blood', 'vault-dancer', 'vault-brute', 'vault-trick', 'vault-show'];
export const LUDUS = ['trident', 'sica', 'trick', 'show', 'crest', 'plume', 'paint', 'cloak', ...VAULT];
export const VET = { ludus: LUDUS, fame: 200, arenas: 3, purseHint: 1, boutsSeen: 9, finHint: 1, heartHint: 1, feintLesson: 9, firstRunDone: 1, momHint: 1, baitHint: 1, hudHint: 1, storySeen: 1, trainDone: 1, knifeHint: 1 };
export const FRESH = { storySeen: 1 };
export const open = (o = {}) => driveOpen('arena', { save: VET, w: 844, h: 390, ...o, root: o.root || ROOT });
export const ptr = (g, type, x, y, id = 7) => g.eval(([type, x, y, id]) => { const cv = document.querySelector('canvas'); cv.setPointerCapture = () => {}; cv.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true })); }, [type, x, y, id]);
// a thumb path: keys [ms, dx, dy] from (x0, y0), stepped every 16 ms (each step waits for the page), then lifted
export async function stroke(g, x0, y0, keys, id = 7) {
  await ptr(g, 'pointerdown', x0, y0, id);
  const end = keys[keys.length - 1][0];
  let t0 = Date.now();
  for (let t = 16; t <= end + 1; t += 16) {
    let i = 0; while (i < keys.length - 2 && keys[i + 1][0] <= t) i++;
    const [a, ax, ay] = keys[i], [b, bx, by] = keys[i + 1], k = Math.min(1, Math.max(0, (t - a) / Math.max(1, b - a)));
    await ptr(g, 'pointermove', x0 + ax + (bx - ax) * k, y0 + ay + (by - ay) * k, id);
    const lag = t - (Date.now() - t0); if (lag > 0) await g.wait(lag);
  }
  const [, lx, ly] = keys[keys.length - 1];
  await g.wait(60); await ptr(g, 'pointerup', x0 + lx, y0 + ly, id);
}
// the yard at a step, on a fresh save (pit arena, bout 1's sparring partner)
export const yardAt = (g, id, arena = 'pit') => g.eval(([id, arena]) => { const E = window.__engine, P = E.game.scenes.play; const me = { ...P.kitMe(P.rollMe(777, []), 'gladius', ['chest']), str: 3 };
  E.setScene('play', { seed: 3, arena, me, buy: 'x', gold: 0 }); P.beginBout(E); const tr = P.state.train; tr.i = P.YARD.findIndex((q) => q.id === id) - 1; P.nextYard(E); return P.YARD[tr.i].id; }, [id, arena]);
// a log of every attack born (its kind), sampled each frame
export const logAtk = (g) => g.eval(() => { if (window.__atkOn) return; window.__atkOn = 1; const s = () => window.__engine.game.scenes.play.state; window.__atk = []; let last = null;
  const f = () => { const h = s().hand, a = h.atk; if (a !== last) { if (a) window.__atk.push(a.kind); last = a; } requestAnimationFrame(f); }; f(); });
export const geo = (g) => g.eval(() => { const E = window.__engine, P = E.game.scenes.play, s = P.state, F = P.foeF(E), Fy = P.youF(E), head = s.foe.parts.find((q) => q.d.id === 'head');
  return { H: Math.round(Fy.H), foeH: Math.round(F.H), hand: [Math.round(s.hand.hx), Math.round(s.hand.hy)], head: P.partCenter(F, s.foe, head).map(Math.round), you: [Math.round(Fy.x), Math.round(Fy.y)] }; });
