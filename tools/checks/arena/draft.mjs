// Step 23: the draft after a bout: one tap takes a card; the gold card isn't taken when you can't pay for it; Skip pays its gold.
import { VET } from '../arena.mjs';
import { bout } from '../exact.mjs';

// a bout won, then the draft open and its cards ready for a tap
async function toDraft(g, gold) {
  await bout(g, { w: 'gladius', kit: ['chest'], rack: 0 });
  await g.ev((gold) => { const E = window.__engine, P = E.game.scenes.play, s = P.state; s.foe.hp = 0; P.fell(E); P.openDraft(E); s.draft.t = 1; s.gold = gold; }, gold);
  await g.frames(5);
}
const read = (g) => g.ev(() => { const s = window.__engine.game.scenes.play.state, d = s.draft; return { open: !!d, rack: s.rack, gold: s.gold, picks: s.picks.slice(), skips: s.skips, need: d ? d.need : null }; });

export default async function (t) {
  const g = await t.boot({ w: 667, h: 375, save: VET });

  await toDraft(g, 0);
  const free = await g.ev(() => { const d = window.__engine.game.scenes.play.state.draft, i = d.btns.findIndex((b) => b.i !== d.priced); const b = d.btns[i]; return { x: b.x, y: b.y, w: b.w, h: b.h, id: d.cards[b.i].id }; });
  const a = await read(g);
  await g.tapRect(free); await g.frames(90);
  const b = await read(g);
  t.ok('one tap on a free card takes it and closes the draft', a.open && !b.open && b.picks.includes(free.id) && b.picks.length === a.picks.length + 1, JSON.stringify({ card: free.id, before: a, after: b }));

  await toDraft(g, 0);
  const gold = await g.ev(() => { const P = window.__engine.game.scenes.play, d = P.state.draft, b = d.btns.find((q) => q.i === d.priced); return b ? { x: b.x, y: b.y, w: b.w, h: b.h, id: d.cards[b.i].id, price: P.priceOf(d.cards[b.i]) } : null; });
  t.ok('the draft deals a gold card with a price', gold && gold.price > 0, JSON.stringify(gold));
  if (gold) {
    const c = await read(g);
    await g.tapRect(gold); await g.frames(90);
    const d = await read(g);
    t.ok("a gold card you can't afford isn't taken: the draft stays, it shakes, nothing is spent", d.open && !d.picks.includes(gold.id) && d.gold === 0 && d.need >= 0, JSON.stringify({ card: gold, before: c, after: d }));
    // with the gold, the same tap takes it and pays
    await g.ev((p) => { window.__engine.game.scenes.play.state.gold = p + 5; }, gold.price);
    await g.tapRect(gold); await g.frames(90);
    const e = await read(g);
    t.ok('with the gold, the same tap takes it and pays its price', !e.open && e.picks.includes(gold.id) && e.gold === 5, JSON.stringify(e));
  }

  await toDraft(g, 10);
  const sk = await g.ev(() => { const P = window.__engine.game.scenes.play; return { r: P.state.draft.skip, pay: P.skipPay() }; });
  const f = await read(g);
  await g.tapRect(sk.r); await g.frames(30);
  const h = await read(g);
  t.ok('Skip closes the draft, takes no card, and pays its gold', sk.pay > 0 && !h.open && h.gold === f.gold + sk.pay && h.skips === f.skips + 1 && h.picks.length === f.picks.length, JSON.stringify({ pay: sk.pay, before: f, after: h }));
}
