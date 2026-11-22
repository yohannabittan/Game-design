// The verifier's checks for the bow and the beasts' charge (2026-11-22), written from the step's acceptance list: a thumb's sloppy shots are never
// lost or refused, a plain press at a barded charging beast finds flesh, the charge never runs under a button, and its first blow winds up on a still frame.
import { VET } from '../arena.mjs';
import { bout, still } from '../exact.mjs';
import { bowUp } from '../scene.mjs';

// every word the game says (pops with three capitals running), from the page's own frame loop
const watch = (g) => g.ev(() => { window.__said = []; if (window.__pw) return; window.__pw = 1; const seen = new WeakSet(), raf = window.requestAnimationFrame;
  const f = () => { const s = window.__engine.game.scenes.play.state; for (const q of s.pops || []) if (!seen.has(q)) { seen.add(q); if (/[A-Z]{3}/.test(q.s)) window.__said.push(q.s); } raf(f); }; raf(f); });
const tally = (g) => g.ev(() => { const s = window.__engine.game.scenes.play.state; return { arrows: s.arrows, said: window.__said.filter((w) => /GAP|HEAD|WEAK|HIT|PLATE|MISSED|STAGGER/.test(w)), ch: !!s.charge, hp: s.foe.hp }; });
const tap = async (g, x, y, hold = 2) => { await g.down(x, y, 6); await g.frames(hold); await g.up(x, y, 6); };

export default async function (t) {
  const sizes = [[874, 402], [844, 390], [667, 375]];
  // 1. every Colosseum beast bout (young and grown, lion and bear) opens with the charge from the far end; its hit areas never reach the round buttons'
  // column while it runs; and its first blow winds up once the camera has all but come to rest (no more than 16 px left to slide)
  for (const [w, h] of sizes) {
    const g = await t.boot({ w, h, save: VET });
    const out = [];
    for (const [seed, rack] of [[778, 1], [778, 3], [777, 1], [781, 3]]) {
      await bout(g, { w: 'gladius', kit: ['chest'], arena: 'rome', seed, rack, side: w === 667 ? null : 'bow', knives: 2 });
      const r = await g.ev(() => { const s = window.__engine.game.scenes.play.state; return { beast: `${s.foe.young ? 'young ' : ''}${s.foe.beast}`, left: s.charge && s.charge.left }; });
      let under = 0, sw0 = null;
      for (let i = 0; i < 260 && !sw0; i++) {
        const q = await g.ev(() => {
          const E = window.__engine, P = E.game.scenes.play, s = P.state, b = P.armsBtns(E), btns = b ? [b.swap, b.knife].filter(Boolean) : [];
          let mx = -1; for (let x = E.w - 1; x > E.w / 2 && mx < 0; x -= 4) for (let y = 0; y < E.h; y += 6) if (P.knifeAt(E, x, y).kind !== 'miss') { mx = x; break; }
          return { ch: !!s.charge, under: s.charge && btns.some((q) => mx >= q.x - q.r), sw: !!s.sw, cx: s.cam.cx };
        });
        if (q.under) under++;
        if (q.sw) sw0 = q;
        await g.frames(1);
      }
      await g.frames(90);
      const cx1 = await g.ev(() => window.__engine.game.scenes.play.state.cam.cx);
      out.push({ ...r, under, slide: sw0 ? Math.round(Math.abs(cx1 - sw0.cx)) : null });
    }
    t.ok(`${w}x${h}: each beast starts 3 H out and charges, never under a button, its first blow winding up with 16 px or less of camera slide left`,
      out.length === 4 && out.every((q) => q.left > 2.9 && q.under === 0 && q.slide != null && q.slide <= 16), JSON.stringify(out));
  }

  const g = await t.boot({ w: 874, h: 402, save: VET });
  const X = 874 * 0.75, Y = 402 * 0.62;
  // 2. two quick taps at a charging beast, the second loosed while the first flies: two arrows, two words (the first is never lost)
  {
    await bout(g, { w: 'gladius', kit: ['chest'], arena: 'rome', seed: 778, rack: 3, side: 'bow' }); await watch(g); await g.frames(10);
    const a = await tally(g);
    await tap(g, X, Y); await g.frames(4); await tap(g, X, Y); await g.frames(60);
    const b = await tally(g);
    t.ok('two quick shots at a charging beast, the second while the first flies: both land and say what they hit', b.arrows - a.arrows === 2 && b.said.length === 2, JSON.stringify(b));
  }
  // 3. a plain press held to a full draw at a barded charging beast (plated head and chest, every Colosseum beast) hits flesh, not plate
  for (const [seed, rack] of [[778, 3], [777, 1]]) {
    await bout(g, { w: 'gladius', kit: ['chest'], arena: 'rome', seed, rack, side: 'bow' }); await watch(g); await g.frames(2);
    await tap(g, X, Y, 72); await g.frames(40);
    const r = await tally(g);
    t.ok(`a plain full draw at the charging beast (seed ${seed}, bout ${rack + 1}) hits it, not its barding`, r.said.length === 1 && !/PLATE/.test(r.said[0]) && r.hp < 999, JSON.stringify(r));
  }
  // 4. against a man: a thumb down while the bow comes up (held through the swap) draws once it is up and looses on release; a press and release both
  // inside the swap looses once it is up; a pointer-cancel looses nothing and leaves no aim
  {
    await bout(g, { w: 'gladius', kit: ['chest'], arena: 'city', rack: 1, side: 'bow' }); await still(g); await g.frames(10); await watch(g);
    const swap = () => g.ev(() => { const E = window.__engine; E.game.scenes.play.swapBow(E); });
    await swap(); await g.frames(10); const a = await tally(g);
    await g.down(X, Y, 6); await g.frames(60); await g.up(X, Y, 6); await g.frames(60);
    const held = await tally(g);
    await swap(); await g.until(() => window.__engine.game.scenes.play.state.swapT <= 0, 90); await swap(); await g.frames(8);
    await tap(g, X, Y, 4); await g.frames(90);
    const quick = await tally(g);
    await g.down(X, Y, 6); await g.frames(30); await g.ev(([x, y]) => window.__replay.fire('cancel', x, y, 6), [X, Y]); await g.frames(40);
    const cancel = { ...(await tally(g)), aim: await g.ev(() => !!window.__engine.game.scenes.play.state.aim) };
    t.ok('a press held through the swap to the bow looses on release; one pressed and let go inside the swap looses once the bow is up', held.arrows - a.arrows === 1 && held.said.length === 1
      && quick.arrows - held.arrows === 1 && quick.said.length === 2, JSON.stringify({ held, quick }));
    t.ok('a pointer-cancel mid-draw looses nothing and leaves no aim up', cancel.arrows === quick.arrows && !cancel.aim, JSON.stringify(cancel));
  }
}
