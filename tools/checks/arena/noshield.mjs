// 2026-11-14 (no glow when you can't block): the block buttons glow with the foe's tell only while a press would block. With the bow out, a knife
// raised, a swap running, the shield broken, or you backed off, they sit dim; two blades (and fists) block, so they glow.
import { VET } from '../arena.mjs';
import { bout } from '../exact.mjs';

const W = 874, H = 402;
// frames until the foe's tell is showing (the page only moves when stepped, so it stays there); true once it is
const tell = async (g) => {
  await g.ev(() => {
    const P = window.__engine.game.scenes.play, s = P.state;
    s.swingIn = 0; s.sw = null; s.plan = null; s.cover = null;
  });
  for (let i = 0; i < 240; i++) { await g.frames(1); if (await g.ev(() => { const s = window.__engine.game.scenes.play.state; return !!s.sw && s.sw.fin <= 0 && s.sw.t > (s.sw.pre || 0) + 0.05; })) return true; }
  return false;
};
const glow = (g) => g.ev(() => { const P = window.__engine.game.scenes.play, z = P.glowZones(); return { can: P.canBlock(), hot: !!(z.tell || z.tell2), fake: !!z.fakeBtn }; });
const rest = (g) => g.ev(() => { const P = window.__engine.game.scenes.play, s = P.state; s.sw = null; s.plan = null; s.swingIn = 99; s.bowOut = false; s.aim = null; s.swapT = 0; s.sh.broken = false; s.away = false; s.cards = []; });

export default async function (t) {
  const g = await t.boot({ w: W, h: H, save: VET });
  const cases = {};
  await bout(g, { w: 'sica', side: 'bow', kit: ['helmet'], arena: 'city', rack: 1 });
  await g.frames(5);
  cases.ready = await (async () => { await tell(g); return glow(g); })();
  if (process.env.NOSHIELD_SHOTS) await g.page.screenshot({ path: `${process.env.NOSHIELD_SHOTS}/shield-ready.png` });
  await rest(g);
  await tell(g); await g.ev(() => { window.__engine.game.scenes.play.state.bowOut = true; });
  cases.bow = await glow(g);
  if (process.env.NOSHIELD_SHOTS) { await g.frames(2); await g.page.screenshot({ path: `${process.env.NOSHIELD_SHOTS}/bow-out.png` }); }
  await rest(g);
  await tell(g); await g.ev(() => { window.__engine.game.scenes.play.state.aim = { x: 0, y: 0 }; });
  cases.knife = await glow(g); await rest(g);
  await tell(g); await g.ev(() => { window.__engine.game.scenes.play.state.swapT = 0.4; });
  cases.swap = await glow(g); await rest(g);
  await tell(g); await g.ev(() => { window.__engine.game.scenes.play.state.sh.broken = true; });
  cases.broken = await glow(g); await rest(g);
  await tell(g); await g.ev(() => { window.__engine.game.scenes.play.state.away = true; });
  cases.away = await glow(g); await rest(g);
  cases.back = await (async () => { await tell(g); return glow(g); })(); await rest(g);

  await bout(g, { w: 'gladius', dual: true, kit: ['helmet'], arena: 'city', rack: 1 });
  await g.frames(5); await tell(g);
  cases.dual = await glow(g);

  t.ok('with the shield ready the tell glows', cases.ready.can && cases.ready.hot, JSON.stringify(cases.ready));
  for (const k of ['bow', 'knife', 'swap', 'broken', 'away']) t.ok(`${k}: no block, no glow`, !cases[k].can && !cases[k].hot && !cases[k].fake, JSON.stringify(cases[k]));
  t.ok('put away, the glow comes back', cases.back.can && cases.back.hot, JSON.stringify(cases.back));
  t.ok('two blades block, so the glow stays', cases.dual.can && cases.dual.hot, JSON.stringify(cases.dual));
}
