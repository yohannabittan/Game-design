// The suite's harness: a game opened on tools/replay.mjs's fake clock, stepped one frame at a time, with pointer events sent between frames.
// Nothing here waits on real time, so a check gives the same answer every run.
//   const g = await boot({ w: 667, h: 375, save: FRESH });
//   await g.ev(() => ...)            run in the page (window.__engine), between frames
//   await g.frames(n)                step n frames of 1/60 s
//   await g.until(() => cond, max)   step until cond holds in the page (true), or max frames pass (false)
//   await g.down(x, y, id) / move / up    a pointer event, sent before the next frame
//   await g.tap(x, y)                down, two frames, up, one frame
//   await g.stroke(x0, y0, keys, id) a thumb path: keys [frame, dx, dy] from (x0, y0), a move each frame, then lifted
import { launch } from '../replay.mjs';
import { ROOT } from './arena.mjs';

export async function boot({ slug = 'arena', w = 844, h = 390, save, raw, seed = 1, root = ROOT } = {}) {
  const hh = await launch({ slug, w, h, seed, save: raw ? undefined : save, rawSave: raw, start: { scene: 'menu' } }, { root });
  const page = hh.page;
  const fire = (type, x, y, id) => page.evaluate(([t, x, y, id]) => window.__replay.fire(t, x, y, id), [type, Math.round(x), Math.round(y), id]);
  const g = {
    w, h, page, errors: hh.errors, close: hh.close,
    ev: (fn, arg) => page.evaluate(fn, arg),
    frames: (n) => hh.step(n),
    // frames in the page until the predicate holds; a frame that starts an image load stops the batch so the load can settle first
    async until(pred, max = 600, arg) {
      let left = max;
      while (left > 0) {
        const r = await page.evaluate(([src, n, arg]) => {
          const f = new Function('arg', `return (${src})(arg);`);
          for (let i = 0; i < n; i++) {
            if (f(arg)) return { ok: true, ran: i };
            const before = window.__imgPending; window.__replay.frame([]);
            if (window.__imgPending > before) return { ok: false, ran: i + 1 };
          }
          return { ok: !!f(arg), ran: n };
        }, [pred.toString(), Math.min(left, 240), arg]);
        if (r.ok) return true;
        left -= r.ran;
        await hh.settle(100);
      }
      return false;
    },
    down: (x, y, id = 7) => fire('down', x, y, id),
    move: (x, y, id = 7) => fire('move', x, y, id),
    up: (x, y, id = 7) => fire('up', x, y, id),
    async tap(x, y, id = 9) { await fire('down', x, y, id); await hh.step(2); await fire('up', x, y, id); await hh.step(1); },
    async tapRect(r, id = 9) { await g.tap(r.x + r.w / 2, r.y + r.h / 2, id); },
    // keys: [frame, dx, dy], the first at frame 0; one move per frame between keys, the lift a frame after the last
    async stroke(x0, y0, keys, id = 7) {
      await fire('down', x0 + keys[0][1], y0 + keys[0][2], id);
      for (let i = 1; i < keys.length; i++) {
        const [a, ax, ay] = keys[i - 1], [b, bx, by] = keys[i];
        for (let t = a + 1; t <= b; t++) { await hh.step(1); const u = (t - a) / (b - a); await fire('move', x0 + ax + (bx - ax) * u, y0 + ay + (by - ay) * u, id); }
      }
      await hh.step(1);
      const [, lx, ly] = keys[keys.length - 1];
      await fire('up', x0 + lx, y0 + ly, id); await hh.step(1);
    },
  };
  return g;
}

// A bout begun in the page: you (roll 777, the weapon and kit given, str 3) against the rack's foe. o: { w, kit, side, dual, mace, arena, seed, rack,
// knives, gold, begin } (begin: beginBout, so the intro card, the yard and the lessons run as in play; else the intro is dropped)
export const bout = (g, o = {}) => g.ev((o) => {
  const E = window.__engine, P = E.game.scenes.play, s = P.state;
  const me = { ...P.kitMe(P.rollMe(777, []), o.w || 'gladius', o.kit || ['chest'], !!o.dual), str: 3, side: o.side || null, mace: !!o.mace, origin: 'capua' };
  E.setScene('play', { seed: o.seed || 777, arena: o.arena || 'pit', me, buy: 'x', gold: o.gold || 0, knives: o.knives || 0 });
  if (o.rack != null) P.newRackAt(E, o.rack);
  if (o.begin) P.beginBout(E); else s.intro = false;
  return true;
}, o);

// He stands still and never swings (set every frame from the page's own frame loop, so it is exact): his swing timer held off, and the gap pinned
// when `gap` is a number (H). Calling it again changes the gap; null stops pinning.
export const still = (g, gap = null) => g.ev((gap) => {
  const E = window.__engine, P = E.game.scenes.play;
  window.__pinGap = gap;
  if (window.__stillOn) return; window.__stillOn = 1;
  const raf = window.requestAnimationFrame;
  const f = () => { const s = P.state; if (s && s.foe) { s.swingIn = 99; s.sw = null; s.plan = null; s.cover = null; s.stamina = s.staMax; if (window.__pinGap != null) s.step.x = s.step.tgt = window.__pinGap; } raf(f); };
  raf(f);
}, gap);
