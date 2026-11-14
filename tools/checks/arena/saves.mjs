// Saves (ADR-0005): a save written by an older version, with a run in the middle of the City, loads through migrate and the run resumes.
// The old saves are made from today's by taking away what each version since added (v18: the sidearm and knives; v19: the bow's counts).
import { VET } from '../arena.mjs';
import { bout } from '../exact.mjs';

const V19 = ['arrows', 'arrowGaps', 'arrowSkin', 'arrowPlate', 'arrowMiss', 'bowTime'];
const V18 = ['knives', 'knivesThrown', 'knifeGaps', 'mySwaps'];

export default async function (t) {
  const g0 = await t.boot({ w: 667, h: 375, save: VET });
  await bout(g0, { w: 'gladius', side: 'spear', kit: ['chest'], arena: 'city', rack: 2, gold: 40, knives: 2 });
  const data = await g0.ev(() => { const E = window.__engine; E.game.scenes.play.saveRun(E); return JSON.parse(JSON.stringify(E.save.data)); });
  t.ok('a run in the City saves at bout 3', data.run && data.run.arena === 'city' && data.run.rack === 2 && data.run.me.side === 'spear', JSON.stringify(data.run && { arena: data.run.arena, rack: data.run.rack, side: data.run.me.side }));
  if (!data.run) return;

  const v18 = JSON.parse(JSON.stringify(data)); for (const k of V19) delete v18.run[k];
  const v17 = JSON.parse(JSON.stringify(v18)); for (const k of V18) delete v17.run[k]; delete v17.run.me.side; if (v17.last) delete v17.last.me.side;

  for (const [v, d, want] of [[18, v18, { side: 'spear', knives: 2 }], [17, v17, { side: null, knives: 0 }]]) {
    const g = await t.boot({ w: 667, h: 375, raw: { __v: v, data: d } });
    const m = await g.ev(() => { const E = window.__engine, r = E.save.get('run'); return r && { rack: r.rack, side: r.me.side, knives: r.knives, arrows: r.arrows, bowTime: r.bowTime }; });
    t.eq(`a v${v} save migrates its run: the sidearm and knives as saved (or none), no arrows`, m, { rack: 2, ...want, arrows: 0, bowTime: 0 });
    await g.ev(() => { const E = window.__engine; E.setScene('play', { resume: E.save.get('run') }); });
    await g.frames(90);
    const s = await g.ev(() => { const E = window.__engine, P = E.game.scenes.play, s = P.state; return { scene: E.sceneName, arena: s.arena && (s.arena.id || s.arena), rack: s.rack, weapon: s.me.weapon, side: s.me.side, knives: s.knives, foe: !!s.foe && s.foe.hp > 0 }; });
    t.ok(`a v${v} save's run resumes at its bout, with its fighter`, s.scene === 'play' && s.rack === 2 && s.weapon === 'gladius' && s.side === want.side && s.knives === want.knives && s.foe, JSON.stringify(s));
  }
}
