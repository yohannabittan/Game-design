// The menu's "What's new" plaque and card: on the menu at both phone sizes, 44 px to touch, clear of every other button, newest build on top,
// five builds reachable, no line clipped, Close and a tap outside both return to the menu, the number shown is the shipped CACHE_VERSION.
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
      return { card: s.card, fit: s.cardFit(cv, E), v: E.game.scenes.menu.cardPages()[0].v, n: s.cardPages().length, L: s.cardLay(E) };
    });
    t.eq(`${w}x${h}: a tap on the plaque opens the card on the newest build`, c.card, 0);
    t.eq(`${w}x${h}: the newest build shown is the shipped CACHE_VERSION`, c.v, shipped);
    t.eq(`${w}x${h}: five builds can be reached`, c.n, 5);
    t.ok(`${w}x${h}: no page's last line reaches the footer`, c.fit.pages.every((b) => b <= c.fit.room), JSON.stringify(c.fit));
    for (let i = 0; i < 4; i++) { await g.tap(c.L.next.x + c.L.next.w / 2, c.L.next.y + c.L.next.h / 2); await g.frames(3); }
    t.eq(`${w}x${h}: the next arrow reaches the fifth build`, await g.ev(() => window.__engine.game.scenes.menu.card), 4);
    await g.tap(c.L.close.x + c.L.close.w / 2, c.L.close.y + c.L.close.h / 2); await g.frames(3);
    t.eq(`${w}x${h}: Close returns to the menu`, await g.ev(() => window.__engine.game.scenes.menu.card), null);
    await g.tap(m.n.x + m.n.w / 2, m.n.y + m.n.h / 2); await g.frames(3);
    await g.tap(c.L.box.x + c.L.box.w / 2, 4); await g.frames(3);
    t.eq(`${w}x${h}: a tap outside returns to the menu`, await g.ev(() => ({ card: window.__engine.game.scenes.menu.card, scene: window.__engine.sceneName })), { card: null, scene: 'menu' });
  }
}
