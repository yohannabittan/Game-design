// The lessons button (step 2026-11-22, Decided 5): on the menu, on any save, it replays the three first-flight lessons on the next three
// flights without touching anything else in the save. A 44 px target inside the safe area, clear of every other target, at each size.
import { VET, FRESH } from './_flight.mjs';

const SAFE = { top: 0, bottom: 21, left: 47, right: 47 }; // an iPhone held sideways
const rects = (g) => g.ev(() => {
  const m = window.__engine.scene, E = window.__engine, r = (b) => b && { x: b.x, y: b.y, w: b.w, h: b.h };
  return { learn: r(m.btnLearn), play: r(m.btnPlay), shop: r(m.btnShop), story: r(m.btnStory), mute: r(m.btnMute), title: r(E.titleArea), tune: r(E._tuneTab), exp: r(E._exportTab), art: r(E._artTab), w: E.w, h: E.h, safe: E.safe };
});
const overlap = (a, b) => a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export default async function (t) {
  for (const [w, h] of [[667, 375], [844, 390], [874, 402], [932, 430]]) for (const safe of [false, true]) {
    const g = await t.boot({ slug: 'launch', w, h, save: VET({ home: true, proposed: true, best: 6200 }) });
    if (safe) await g.ev((s) => { window.__engine._safe = s; }, SAFE);
    await g.frames(3);
    const R = await rects(g), b = R.learn, sf = R.safe, tag = `${w}x${h}${safe ? ' with notch insets' : ''}`;
    t.ok(`${tag}: the lessons button is at least 44 px and inside the safe area`, b && b.w >= 44 && b.h >= 44 && b.x >= sf.left && b.y >= sf.top && b.x + b.w <= w - sf.right && b.y + b.h <= h - sf.bottom, JSON.stringify({ b, sf }));
    const hits = ['play', 'shop', 'story', 'mute', 'title', 'tune', 'exp', 'art'].filter((k) => overlap(b, R[k]));
    t.ok(`${tag}: it covers no other target`, hits.length === 0, `${hits.join(', ')} ${JSON.stringify(R)}`);
    if (w === 874 && !safe) await g.page.screenshot({ path: `${process.env.SHOTS || '/tmp'}/menu-${w}x${h}.png` });
    if (w === 667 && safe) await g.page.screenshot({ path: `${process.env.SHOTS || '/tmp'}/menu-${w}x${h}-notch.png` });
  }

  // A veteran save: one press replays the lessons from the next flight, and changes nothing else in the save.
  {
    const g = await t.boot({ slug: 'launch', w: 874, h: 402, save: VET({ home: true, proposed: true, best: 6200 }) });
    await g.frames(3);
    const before = await g.ev(() => JSON.parse(JSON.stringify(window.__engine.save.data)));
    const R = await rects(g);
    await g.tapRect(R.learn); await g.frames(3);
    const after = await g.ev(() => ({ scene: window.__engine.sceneName, save: JSON.parse(JSON.stringify(window.__engine.save.data)), lesson: window.__engine.game.sim.S.lesson, hint: window.__engine.game.sim.S.hint }));
    const changed = [...new Set([...Object.keys(before), ...Object.keys(after.save)])].filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after.save[k]));
    t.ok('a press starts a flight with the first lesson due and the two launch beats named', after.scene === 'play' && after.lesson === 0 && after.hint, JSON.stringify(after));
    t.eq('only the lesson changes in the save', changed, ['lesson']);
    // fly three flights through their lessons by doing each verb once in the air: boost, glide, slam
    for (const [i, act] of [[0, 'boost'], [1, 'chute'], [2, 'drop']]) {
      if (i > 0) await g.ev(() => window.__engine.setScene('play', { seed: 3 }));
      const st = await g.ev(() => { const E = window.__engine, P = E.game.scenes.play, S = E.game.sim.S, o = { lesson: S.lesson, hint: S.hint }; P.lock(E); P.fire(E); return o; });
      await g.frames(30);
      if (act === 'boost') { await g.down(600, 200, 4); await g.frames(30); await g.up(600, 200, 4); }
      else await g.stroke(600, 200, [[0, 0, 0], [3, 0, act === 'chute' ? -40 : 40], [12, 0, act === 'chute' ? -40 : 40]], 4);
      await g.frames(4);
      const lesson = await g.ev(() => window.__engine.save.get('lesson'));
      t.ok(`flight ${i + 1} after the press teaches ${act} (lesson ${st.lesson}, beats named: ${st.hint}), and doing it moves on`, st.lesson === i && lesson === i + 1 && st.hint === (i < 2), JSON.stringify({ st, lesson }));
    }
    await g.ev(() => window.__engine.setScene('play', { seed: 3 }));
    const fourth = await g.ev(() => ({ lesson: window.__engine.game.sim.S.lesson, hint: window.__engine.game.sim.S.hint }));
    t.ok('the fourth flight has no lesson and no beat names', fourth.lesson === 3 && !fourth.hint, JSON.stringify(fourth));
  }

  // Pressed again mid-lessons: back to the first one. Pressed twice in a row on the menu: the same as once.
  {
    const g = await t.boot({ slug: 'launch', w: 667, h: 375, save: VET({ lesson: 1 }) });
    await g.frames(3);
    let R = await rects(g);
    await g.tapRect(R.learn); await g.frames(2);
    t.eq('pressed mid-lessons (lesson 1), it starts again from the first', await g.ev(() => window.__engine.game.sim.S.lesson), 0);
    await g.ev(() => window.__engine.setScene('menu')); await g.frames(3);
    R = await rects(g);
    await g.tapRect(R.learn); await g.frames(2);
    t.eq('pressed again before flying, still the first', await g.ev(() => window.__engine.game.sim.S.lesson), 0);
  }

  // A fresh save gets the lessons by itself (no press), with the beats named on its first two flights.
  {
    const g = await t.boot({ slug: 'launch', w: 844, h: 390, save: FRESH });
    await g.ev(() => window.__engine.setScene('play', { seed: 2 }));
    const a = await g.ev(() => ({ lesson: window.__engine.game.sim.S.lesson, hint: window.__engine.game.sim.S.hint }));
    t.ok('a fresh save starts its first flight on the first lesson, beats named', a.lesson === 0 && a.hint, JSON.stringify(a));
  }
}
