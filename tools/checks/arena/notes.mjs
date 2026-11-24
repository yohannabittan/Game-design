// The menu's "What's new" plaque and card: on the menu at both phone sizes, 44 px to touch, clear of every other button, newest build on top,
// unseen builds listed together (2 to 5), scrollable, no line unreachable, Close and a tap outside both return to the menu, the number shown is the shipped CACHE_VERSION.
import { readFileSync } from 'node:fs';
import { ROOT } from '../arena.mjs';

export default async function (t) {
  const sw = readFileSync(`${ROOT}/games/arena/sw.js`, 'utf8'), shipped = +sw.match(/CACHE_VERSION = 'arena-v(\d+)'/)[1];
  for (const [w, h] of [[874, 402], [667, 375]]) {
    const g = await t.boot({ w, h });
    await g.frames(120);
    const m = await g.ev(() => {
      const E = window.__engine, s = E.game.scenes.menu, ov = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      const n = s.btns.notes, others = Object.entries(s.btns).filter(([k]) => k !== 'notes');
      return { n, hit: others.filter(([, b]) => ov(n, b)).map(([k]) => k), inside: n.x >= 0 && n.y >= 0 && n.x + n.w <= E.w && n.y + n.h <= E.h };
    });
    t.ok(`${w}x${h}: the plaque is on screen, at least 44 px, and covers no other button`, m.inside && m.n.w >= 44 && m.n.h >= 44 && !m.hit.length, JSON.stringify(m));
    await g.tap(m.n.x + m.n.w / 2, m.n.y + m.n.h / 2);
    await g.frames(5);
    const c = await g.ev(() => {
      const E = window.__engine, s = E.game.scenes.menu, cv = document.createElement('canvas').getContext('2d');
      return { card: s.card, fit: s.cardFit(cv, E), vs: s.cardItems.map((e) => e.v), seen: s.cardSeen, saved: E.save.get('notesSeen', 0), L: s.cardLay(E) };
    });
    t.eq(`${w}x${h}: a tap on the plaque opens the card`, c.card, 0);
    const all = await g.ev(() => Math.min(window.__engine.game.scenes.menu.cardList(0).length, 999));
    t.eq(`${w}x${h}: it lists every build in the notes, newest first, the newest being the shipped CACHE_VERSION`, c.vs[0] === shipped && c.vs.every((v, i) => !i || v < c.vs[i - 1]) && c.vs.length, all);
    t.eq(`${w}x${h}: opening it saves the newest build as seen`, c.saved, shipped);
    t.ok(`${w}x${h}: what does not fit can be scrolled to`, c.fit.h <= c.fit.room || c.fit.max > 0, JSON.stringify(c.fit));
    const y0 = c.L.view.y + c.L.view.h / 2;
    await g.stroke(c.L.view.x + 100, y0 + 60, [[0, 0, 0], [6, 0, -120]]); await g.frames(3);
    const sc = await g.ev(() => window.__engine.game.scenes.menu.cardScroll);
    t.ok(`${w}x${h}: a thumb drag scrolls the list when it is taller than the card`, c.fit.max === 0 || sc > 0, `scroll ${sc}, max ${c.fit.max}`);
    t.eq(`${w}x${h}: the card is still open after a drag`, await g.ev(() => window.__engine.game.scenes.menu.card), 0);
    await g.tap(c.L.close.x + c.L.close.w / 2, c.L.close.y + c.L.close.h / 2); await g.frames(3);
    t.eq(`${w}x${h}: Close returns to the menu`, await g.ev(() => window.__engine.game.scenes.menu.card), null);
    await g.tap(m.n.x + m.n.w / 2, m.n.y + m.n.h / 2); await g.frames(3);
    const again = await g.ev(() => { const s = window.__engine.game.scenes.menu; return s.cardItems.length; });
    t.eq(`${w}x${h}: opened again with nothing new it still lists every build`, again, all);
    await g.tap(c.L.box.x + c.L.box.w / 2, 4); await g.frames(3);
    await g.ev((v) => window.__engine.save.set('notesSeen', v - 3), shipped);
    await g.tap(m.n.x + m.n.w / 2, m.n.y + m.n.h / 2); await g.frames(3);
    t.eq(`${w}x${h}: with three builds unseen, exactly those three are marked new`, await g.ev(() => { const s = window.__engine.game.scenes.menu; return s.cardItems.filter((e) => e.v > s.cardSeen).map((e) => e.v); }), [shipped, shipped - 1, shipped - 2]);
    await g.tap(c.L.close.x + c.L.close.w / 2, c.L.close.y + c.L.close.h / 2); await g.frames(3);
    await g.tap(m.n.x + m.n.w / 2, m.n.y + m.n.h / 2); await g.frames(3);
    await g.tap(c.L.box.x + c.L.box.w / 2, 4); await g.frames(3);
    t.eq(`${w}x${h}: a tap outside returns to the menu`, await g.ev(() => ({ card: window.__engine.game.scenes.menu.card, scene: window.__engine.sceneName })), { card: null, scene: 'menu' });
  }
}
