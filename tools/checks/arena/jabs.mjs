// Step 2026-11-17, jabs land: a straight push of the thumb is a jab with every weapon, one or two, at any body size, fresh touches one after another
// (no rest, so some start in the last blow's hit-stop); a slash and an overhead stay what they were. The jab is the fist's push along the guard
// line (fight.js pushOf, attack.jab.push), not the point's path: a spear's point swings down as a push straightens it and read as a slash, and a
// short blade's point never reached the old point-speed gate.
import { VET } from '../arena.mjs';
import { scene, knifeUp, STROKES } from '../scene.mjs';

// thumb paths, [frame, dx, dy] from where the thumb lands: a jab (drawn back, then pushed), a push (straight out), a slash (down and on), an overhead
// (up, a pause, then down)
const K = {
  jab: [[0, 0, 0], [6, -12, 4], [9, 30, -4], [14, 30, -4]],
  push: [[0, 0, 0], [3, 40, 0], [6, 40, 0]],
  slash: [[0, 0, -40], [6, 20, 30], [10, 20, 30]],
  over: [[0, 0, 0], [12, 0, -60], [19, 0, -60], [28, 25, 40], [32, 25, 40]],
  overhead: STROKES.OVERHEAD,
};
const WANT = { jab: 'jab', push: 'jab', slash: 'slash', over: 'over', overhead: 'over' };
const AT = { over: [0.74, 0.66] };

// a bout with the weapon (one or two, the size's tier), him bare and unkillable and never swinging; each touch logs the first blow born in it
const setup = (g, wp, dual, size) => g.ev(([wp, dual, size]) => {
  const E = window.__engine, P = E.game.scenes.play, T = P.TUNING;
  let me = P.rollMe(777, []); me.idx = me.idx.slice(); me.idx[0] = T.me.wheels.size.findIndex((e) => e[0] === size);
  me = { ...P.kitMe(me, wp === 'mace' ? 'axe' : wp, ['chest'], dual), str: 3, origin: 'capua', mace: wp === 'mace' };
  E.setScene('play', { seed: 777, arena: 'rome', me, buy: 'x', gold: 0 }); P.newRackAt(E, 0);
  const s = P.state; s.intro = false; s.bout.foeShrug = true; s.foe.hp = s.foe.maxHp = 999; for (const p of s.foe.parts) { p.armour = false; p.guard = false; }
  window.__T = [];
  if (window.__jabsOn) return; window.__jabsOn = 1;
  let cur = null; const raf = window.requestAnimationFrame;
  const f = () => {
    const s = P.state, h = s.hand;
    if (s && s.foe) {
      Object.assign(s, { swingIn: 99, sw: null, plan: null, cover: null, stamina: s.staMax, hp: 99, maxHp: 99 }); s.step.x = s.step.tgt = s.foe.home; s.foe.hp = 999;
      if (h.down) { if (!cur) { cur = { k: null }; window.__T.push(cur); } if (!cur.k && h.atk && h.atk.cost != null) cur.k = h.atk.kind; } else cur = null;
    }
    raf(f);
  };
  raf(f);
}, [wp, dual, size]);

// n touches of a stroke, rest frames apart: the kinds born, one per touch ('-' for none)
async function strokes(g, k, n, rest) {
  await g.frames(30); await g.ev(() => { window.__T = []; });
  const [x, y] = AT[k] || [0.7, 0.45];
  for (let i = 0; i < n; i++) { await g.stroke(g.w * x, g.h * y, K[k]); await g.frames(rest); }
  await g.frames(20);
  return (await g.ev(() => window.__T.map((q) => q.k || '-'))).join(' ');
}

export default async function (t) {
  // 1 and 2. every weapon, one and two, medium: four hurried touches of each stroke (no rest), each the kind it is meant as
  {
    const g = await t.boot({ w: 667, h: 375, save: VET });
    for (const wp of ['gladius', 'dagger', 'spear', 'trident', 'axe', 'mace', 'sica']) for (const dual of wp === 'mace' ? [false] : [false, true]) {
      const bad = [];
      for (const k of ['jab', 'push', 'slash', 'over']) {
        await setup(g, wp, dual, 'medium');
        // (overheads with a rest: two back to back with none, the second is often a slash, today as before this step)
        const got = await strokes(g, k, 4, k === 'over' ? 12 : 0), want = Array(4).fill(WANT[k]).join(' ');
        if (got !== want) bad.push(`${k}: ${got}`);
      }
      t.ok(`667x375 ${dual ? 'two' : 'one'} ${wp}: hurried jabs and pushes are jabs, slashes slashes; overheads overheads`, !bad.length, bad.join('; '));
    }
  }
  // 3. a runt and a giant, at the largest and smallest phone: the spear's and gladius's jab and push
  for (const [w, h] of [[874, 402], [667, 375]]) {
    const g = await t.boot({ w, h, save: VET });
    const bad = [];
    for (const size of ['runt', 'giant']) for (const wp of ['spear', 'gladius']) for (const k of ['jab', 'push']) {
      await setup(g, wp, false, size);
      const got = await strokes(g, k, 3, 6);
      if (got !== 'jab jab jab') bad.push(`${size} ${wp} ${k}: ${got}`);
    }
    t.ok(`${w}x${h}: a runt's and a giant's jab and push with spear and gladius are jabs`, !bad.length, bad.join('; '));
  }
  // 4. a sword touch that lands in a hit-stop cuts it short and is live at once: the hand is never behind the thumb, and lets go the frame the thumb
  // does, for a touch begun in a stop and for one held through several
  {
    const g = await t.boot({ w: 874, h: 402, save: VET });
    const x0 = 874 * 0.7, y0 = 402 * 0.45, bad = [];
    const hand = () => g.ev(() => { const s = window.__engine.game.scenes.play.state, h = s.hand; return { down: h.down, atk: !!h.atk, fx: h.fx, stop: s.stop }; });
    const setStop = (v) => g.ev((v) => { window.__engine.game.scenes.play.state.stop = v; }, v);
    await setup(g, 'gladius', false, 'medium'); await g.frames(20);
    await setStop(0.12); await g.down(x0, y0, 3);
    if ((await hand()).stop > 0.02) bad.push('a touch in a stop left the stop running');
    for (let i = 1; i <= 6; i++) { await g.frames(1); await g.move(x0 + i * 7, y0, 3); }
    await g.frames(1); if (Math.abs((await hand()).fx - (x0 + 42)) > 1) bad.push(`the hand trails the thumb after a stop (${(await hand()).fx} for ${x0 + 42})`);
    await g.up(x0 + 42, y0, 3); await g.frames(1);
    let q = await hand(); if (q.down || q.atk) bad.push('a touch begun in a stop outlives the thumb');
    await g.frames(10); await setStop(0.12); await g.down(x0, y0, 4);
    for (let i = 1; i <= 30; i++) { await g.frames(1); if (i % 8 === 0) await setStop(0.12); await g.move(x0 + 20 * Math.sin(i / 3), y0 + 30 * Math.cos(i / 3), 4); }
    await g.up(x0, y0, 4); await g.frames(1);
    q = await hand(); if (q.down || q.atk) bad.push('a touch held through stops outlives the thumb');
    t.ok('874x402: a sword touch in a hit-stop is live at once and ends with the thumb', !bad.length, bad.join('; '));
    // 5. the sword thumb down in a stop, then KNIFE: the sword hand lets go and stays down while the knife is up, as before
    await scene(g, { weapon: 'gladius', knives: 2 }); await g.frames(10);
    await setStop(0.12); await g.down(x0, y0, 7); await g.frames(1); await knifeUp(g, 5);
    const kb = [];
    for (let i = 1; i <= 6; i++) { await g.move(x0 + i * 10, y0, 7); await g.frames(1); q = await hand(); if (q.down || q.atk) kb.push(i); }
    await g.up(x0 + 60, y0, 7);
    t.ok('874x402: sword thumb down in a stop, then KNIFE: no sword stroke while aiming', !kb.length, `sword hand live on frames ${kb.join(',')}`);
    // 6. back-to-back overheads (6 frames' rest, so each lands in the last one's stop) on a giant: each an overhead, no slash before it
    const ob = [];
    for (const wp of ['gladius', 'axe']) { await setup(g, wp, false, 'giant'); const got = await strokes(g, 'overhead', 6, 6); if (got !== Array(6).fill('over').join(' ')) ob.push(`${wp}: ${got}`); }
    t.ok('874x402: a giant\'s back-to-back overheads are overheads', !ob.length, ob.join('; '));
  }
}
