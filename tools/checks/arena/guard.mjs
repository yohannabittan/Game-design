// Step 2026-11-17, the guard, the body, then the lunge (steps/2026-11-17-yard-distance.md): the guard is held back, so at rest the tip is short of
// him by a visible gap, in the yard and in a fight; a plain push (the arm straight, the body leaning in, no lunge) lands on the yard's ring; no hand
// target around the guard folds the blade back at you; and a plain push reaches at least as far as v84's jab did.
import { boot } from '../exact.mjs';
import { VET } from '../arena.mjs';
import { scene, frontAt, STROKES } from '../scene.mjs';
import { plainPush } from './yard.mjs';

// v84's jab (STROKES.JAB, foe out of reach), the tip's furthest x past your shoulder in H, 874x402, by your size: measured on arena-v84's main checkout
const V84 = { gladius: { runt: 0.73, medium: 0.778, giant: 0.823 }, spear: { runt: 1.263, medium: 1.237, giant: 1.142 } };

// at rest (no touch): the tip, his front at its height, and the blade's length, px
const rest = (g) => g.ev(async () => {
  const E = window.__engine, P = E.game.scenes.play, s = P.state, M = await import(new URL('src/fight.js', location.href).href);
  return { ux: s.hand.ux, uy: s.hand.uy, blade: M.myPoint(E), H: M.myH(E) };
});

// the tip's furthest x past the shoulder (H) over a stroke, him moved far out of reach
async function reach(g, keys) {
  await g.ev(() => {
    const E = window.__engine, P = E.game.scenes.play, s = P.state; window.__far = -9; s.step.x = s.step.tgt = s.foe.home = 3;
    if (!window.__farOn) { window.__farOn = 1; const raf = requestAnimationFrame; const f = () => { const s = P.state; if (s.hand.down) window.__far = Math.max(window.__far, s.hand.ux); raf(f); }; raf(f); }
  });
  await g.frames(20);
  await g.stroke(g.w * 0.7, g.h * 0.42, keys);
  await g.frames(10);
  return g.ev(async () => {
    const E = window.__engine, P = E.game.scenes.play, M = await import(new URL('src/fight.js', location.href).href);
    const [sx] = P.toScreen(P.youF(E), ...(await import(new URL('src/data.js', location.href).href)).SHOULDER);
    return +((window.__far - sx) / M.myH(E)).toFixed(3);
  });
}

export default async function (t) {
  const root = process.env.GUARD_ROOT;
  // measure mode (GUARD_ROOT=<a checkout>): print the jab's reach there, for V84
  if (root) {
    const g = await boot({ w: 874, h: 402, save: VET, root });
    const out = {};
    for (const weapon of ['gladius', 'spear']) for (const size of ['runt', 'medium', 'giant']) {
      await scene(g, { weapon, size, foeSize: 'medium' });
      (out[weapon] ||= {})[size] = await reach(g, STROKES.JAB);
    }
    t.ok(`v84 reach ${JSON.stringify(out)}`, false);
    return;
  }
  // 1. at rest the tip is short of him by a visible gap: in the yard's jab step, and in a fight at his striking distance
  {
    const g = await boot({ w: 874, h: 402, save: VET });
    const bad = [], seen = [];
    for (const weapon of ['gladius', 'dagger', 'spear', 'axe']) for (const size of ['runt', 'medium', 'giant']) for (const where of ['yard', 'fight']) {
      await scene(g, { weapon, size, foeSize: 'medium', ...(where === 'yard' ? { yard: 'jab' } : {}) });
      // (his front at the tip's height, or the nearest of him below it: a guard held above his head is still short of him)
      const r = await rest(g); let fr = null;
      for (let y = r.uy; fr == null && y < r.uy + r.H; y += 4) fr = await frontAt(g, y);
      const gap = fr == null ? null : (fr - r.ux) / r.blade;
      seen.push(`${where} ${weapon} ${size} ${gap == null ? '-' : gap.toFixed(2)}`);
      if (gap == null || gap < 0.2) bad.push(`${where} ${weapon} ${size}: ${gap == null ? 'none' : gap.toFixed(2)} blades`);
    }
    t.ok('at rest the tip is short of him by a visible gap (yard and fight; gladius, dagger, spear, axe; runt, medium, giant)', !bad.length, bad.join('; ') + ' | ' + seen.join(', '));
  }
  // 2. a plain push from guard lands on the yard's jab ring and counts, no lunge: every size, gladius, dagger and spear, both phone sizes
  for (const [w, h] of [[874, 402], [667, 375]]) {
    const g = await boot({ w, h, save: VET });
    const bad = [];
    for (const weapon of ['gladius', 'dagger', 'spear']) for (const size of ['runt', 'medium', 'giant']) {
      await scene(g, { weapon, size, foeSize: 'medium', yard: 'jab' });
      const l0 = await g.ev(() => window.__engine.game.scenes.play.state.lunges);
      await g.stroke(w * 0.7, h * 0.42, await plainPush(g)); await g.frames(30);
      const r = await g.ev(() => { const s = window.__engine.game.scenes.play.state; return { jabs: s.train.jabs, lunges: s.lunges }; });
      if (r.jabs < 1 || r.lunges !== l0) bad.push(`${weapon} ${size}: ${JSON.stringify(r)}`);
    }
    t.ok(`${w}x${h}: a plain push lands on the yard's ring, no lunge (gladius, dagger, spear; runt, medium, giant)`, !bad.length, bad.join('; '));
  }
  // 3. no hand target around the guard (below the overhead line) folds the blade back at you: with the fist at or below your shoulder the blade
  // never points back (a fist raised above the shoulder may cock it back over your head, as a raise does). v84 folded across the guard's rows.
  {
    const g = await boot({ w: 874, h: 402, save: VET });
    const bad = [];
    for (const weapon of ['gladius', 'spear', 'dagger']) {
      await scene(g, { weapon, foeSize: 'medium' });
      const r = await g.ev(async () => {
        const E = window.__engine, P = E.game.scenes.play, s = P.state, h = s.hand, M = await import(new URL('src/fight.js', location.href).href), D = await import(new URL('src/data.js', location.href).href);
        const [gx, gy] = M.guardPt(E), H = M.myH(E), arm = M.myArm(E), line = gy - P.TUNING.attack.over.raise * H, keep = [h.tgx, h.tgy], out = [];
        for (let ox = -1; ox <= 1.6; ox += 0.1) for (let oy = -1; oy <= 1.2; oy += 0.1) {
          h.tgx = gx + ox * arm; h.tgy = gy + oy * arm; if (h.tgy < line) continue;
          M.solveArm(E, 0);
          const sy = P.toScreen(P.youF(E), ...D.SHOULDER)[1];
          if (h.bx < -0.3 && h.hy >= sy) out.push([+ox.toFixed(1), +oy.toFixed(1)]);
        }
        [h.tgx, h.tgy] = keep; M.solveArm(E, 0);
        return out;
      });
      if (r.length) bad.push(`${weapon}: ${JSON.stringify(r.slice(0, 6))}${r.length > 6 ? ` +${r.length - 6}` : ''}`);
    }
    t.ok('no hand target around the guard folds the blade back toward you (gladius, spear, dagger)', !bad.length, bad.join('; '));
  }
  // 4. a plain push reaches at least as far as v84's jab (V84, measured with GUARD_ROOT on arena-v84)
  {
    const g = await boot({ w: 874, h: 402, save: VET });
    const bad = [], seen = [];
    for (const weapon of ['gladius', 'spear']) for (const size of ['runt', 'medium', 'giant']) {
      await scene(g, { weapon, size, foeSize: 'medium' });
      const r = await reach(g, await plainPush(g));
      seen.push(`${weapon} ${size} ${r} (v84 ${V84[weapon][size]})`);
      if (r < V84[weapon][size]) bad.push(seen[seen.length - 1]);
    }
    t.ok('a plain push reaches at least as far as v84\'s jab (gladius, spear; runt, medium, giant)', !bad.length, bad.join('; '));
  }
}
