// Step 28: knives between bouts. The draft after a won bout offers a Knife chip: one tap buys one at knives.price, up to knives.max; it refuses
// at the limit and without gold (and its words say why); a knife bought after bout 1 is carried into bout 2; the export's bought line counts it.
import { VET } from '../arena.mjs';
import { bout } from '../exact.mjs';

const read = (g) => g.ev(() => { const P = window.__engine.game.scenes.play, s = P.state, d = s.draft; return { open: !!d, rack: s.rack, gold: s.gold, knives: s.knives, bought: s.bought.slice(), picks: s.picks.length, chip: d && d.knife, price: P.TUNING.knives.price, max: P.TUNING.knives.max, intro: s.intro }; });
async function toDraft(g, gold, knives) {
  await bout(g, { w: 'gladius', kit: ['chest'], rack: 0, knives });
  await g.ev(([gold, knives]) => { const E = window.__engine, P = E.game.scenes.play, s = P.state; s.foe.hp = 0; P.fell(E); P.openDraft(E); s.draft.t = 1; s.gold = gold; s.knives = knives; }, [gold, knives]);
  await g.frames(5);
}

export default async function (t) {
  for (const [w, h] of [[667, 375], [874, 402]]) {
    const g = await t.boot({ w, h, save: VET });
    await toDraft(g, 30, 0);
    let a = await read(g);
    t.ok(`${w}x${h}: the draft shows a Knife chip, a 44 px target, inside the screen and clear of the cards`, a.chip && a.chip.h >= 44 && a.chip.w >= 44 && a.chip.x >= 0 && a.chip.x + a.chip.w <= w && a.chip.y >= 0
      && await g.ev(() => { const d = window.__engine.game.scenes.play.state.draft, c = d.knife; return d.btns.every((b) => c.y + c.h <= b.y || c.x + c.w <= b.x || b.x + b.w <= c.x); }), JSON.stringify(a.chip));
    if (w === 667) {
      await g.tapRect(a.chip); await g.frames(3);
      const b = await read(g);
      t.ok('one tap buys one knife for knives.price, and the draft stays open for the card', b.open && b.knives === 1 && b.gold === 30 - a.price && b.bought.includes('knife'), JSON.stringify(b));
      // on to bout 2 by skipping the card: the knife is carried
      await g.ev(() => { const E = window.__engine, P = E.game.scenes.play; P.skipDraft(E); });
      await g.frames(120);
      const c = await read(g);
      t.ok('after bout 1 a knife bought is carried into bout 2', !c.open && c.rack === 1 && c.knives === 1, JSON.stringify(c));
    }
    // at the limit: refuses, nothing spent, the chip says so
    await toDraft(g, 100, a.max);
    let m = await read(g);
    await g.tapRect(m.chip); await g.frames(3);
    const f = await read(g);
    t.ok(`${w}x${h}: at the limit the chip refuses, spends nothing, and says "Most carried"`, f.knives === m.max && f.gold === 100 && f.open, JSON.stringify(f));
    // without gold
    await toDraft(g, a.price - 1, 2);
    m = await read(g);
    await g.tapRect(m.chip); await g.frames(3);
    const n = await read(g);
    t.ok(`${w}x${h}: without the gold the chip refuses, spends nothing, and says "Need gold"`, n.knives === 2 && n.gold === a.price - 1 && n.open, JSON.stringify(n));
    // buying to the limit one tap at a time, then refusing; the card can still be taken
    await toDraft(g, 500, m.max - 2);
    m = await read(g);
    for (let i = 0; i < 4; i++) { await g.tapRect(m.chip); await g.frames(2); }
    const z = await read(g);
    t.ok(`${w}x${h}: tapped past the limit it stops at max (two bought), and the draft is still open`, z.knives === m.max && z.gold === 500 - 2 * a.price && z.open, JSON.stringify(z));
    const free = await g.ev(() => { const d = window.__engine.game.scenes.play.state.draft, b = d.btns.find((q) => q.i !== d.priced); return { x: b.x, y: b.y, w: b.w, h: b.h }; });
    await g.tapRect(free); await g.frames(90);
    const y = await read(g);
    t.ok(`${w}x${h}: with knives bought, a card can still be taken`, !y.open && y.picks === z.picks + 1 && y.knives === m.max, JSON.stringify(y));
  }
}
