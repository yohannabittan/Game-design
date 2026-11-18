// Ranks (step 2026-11-18): fame climbs and is never spent, each rank hands the path's next unlock. A fresh save is rank 1 with nothing and a run that
// reaches the champion hands the sica; a run crossing two ranks hands both; a v20 save gets its rank from fame held plus what it spent, keeps every item
// and gains the path up to its rank (the checks' veteran, and one that bought out of the path's order); the ludus sells nothing.
import { VET, FRESH } from '../arena.mjs';
import { bout } from '../exact.mjs';

const PRICE = { trident: 30, sica: 30, sparta: 25, egypt: 25, circus: 25, trick: 40, show: 40, slot: 60, fourth: 50, promise: 30, crest: 15, plume: 15, paint: 15, cloak: 20,
  'vault-wall': 45, 'vault-blood': 45, 'vault-dancer': 45, 'vault-brute': 45, 'vault-trick': 45, 'vault-show': 45 };

// a run ended in the page: bouts before `at` won with `grades`, then `at` lost (or won, when won), and the run's end called
const endRun = (g, o) => g.ev((o) => {
  const E = window.__engine, P = E.game.scenes.play, s = P.state;
  P.newRackAt(E, o.at);
  for (let i = 0; i < s.gauntlet.length; i++) s.results[i] = i < o.at || (o.won && i === o.at) ? 'felled' : i === o.at ? 'lost' : null;
  s.grades = o.grades.slice(); s.gold = 0;
  P.finish(E);
  const over = E.game.scenes.over;
  return { scene: E.sceneName, fame: E.save.get('fame', 0), ludus: E.save.get('ludus', []), seen: E.save.get('rankSeen', 0), ups: over.p.fame.ups, sum: over.p.fame.sum, rank: P.rankOf(E.save.get('fame', 0)) };
}, o);

export default async function (t) {
  // acceptance 1: a fresh save, one run to the champion (four bouts won at A, B, A, B, lost to him)
  const g = await t.boot({ w: 874, h: 402, save: FRESH });
  t.eq('a fresh save is rank 1 with nothing', await g.ev(() => { const E = window.__engine, P = E.game.scenes.play; return [P.rankOf(E.save.get('fame', 0)), E.save.get('ludus', [])]; }), [1, []]);
  await bout(g, { arena: 'pit' });
  const a = await endRun(g, { at: 4, grades: ['A', 'B', 'A', 'B'] });
  t.eq('a run to the champion reaches rank 2 and Brutus hands the sica', [a.scene, a.rank, a.ludus, a.ups, a.seen], ['over', 2, ['sica'], [2], 2]);
  await g.ev(() => { window.__engine.game.scenes.over.page = 1; });
  await g.frames(200);
  t.eq('the run\'s end shows the rank-up once the bar crosses it', await g.ev(() => window.__engine.game.scenes.over.upShown), 1);

  // a won Pit run from 20 fame crosses two ranks or more: each is handed, in order
  const g2 = await t.boot({ w: 667, h: 375, save: { ...FRESH, fame: 20 } });
  await bout(g2, { arena: 'pit' });
  const b = await endRun(g2, { at: 4, won: true, grades: ['S', 'A', 'A', 'B', 'A'] });
  t.ok('a won Pit run from 20 fame hands two ranks or more, in order', b.ups.length >= 2 && b.ups[0] === 2 && b.ups.every((r, i) => r === 2 + i) && b.rank === b.ups[b.ups.length - 1], JSON.stringify(b));
  t.ok('and everything on the path up to it is yours', ['sica', 'fourth'].every((id) => b.ludus.includes(id)), b.ludus.join(','));

  // acceptance 2: a v20 save. The checks' veteran (fame 200, 14 items bought); and one with fame held and four items bought out of the path's order
  for (const [what, d] of [['the veteran', JSON.parse(JSON.stringify(VET))], ['an out-of-order buyer', { ...JSON.parse(JSON.stringify(VET)), fame: 40, ludus: ['trick', 'show', 'vault-show', 'cloak'], tailor: { cloak: 2 } }]]) {
    const life = d.fame + d.ludus.reduce((s, id) => s + PRICE[id], 0);
    const gv = await t.boot({ w: 844, h: 390, raw: { __v: 20, data: d } });
    const m = await gv.ev(() => { const E = window.__engine, P = E.game.scenes.play; return { fame: E.save.get('fame', 0), ludus: E.save.get('ludus', []), tailor: E.save.get('tailor', {}), seen: E.save.get('rankSeen', 0), rank: P.rankOf(E.save.get('fame', 0)), path: P.PATH.slice(0, P.rankOf(E.save.get('fame', 0))).flat(), at: P.rankAt(P.rankOf(E.save.get('fame', 0)) + 1) }; });
    t.eq(`${what}: lifetime fame is fame held plus what it spent`, m.fame, life);
    t.ok(`${what}: keeps every item bought and gains the path up to rank ${m.rank}`, d.ludus.every((id) => m.ludus.includes(id)) && m.path.every((id) => m.ludus.includes(id)) && m.seen === m.rank && m.fame < m.at, JSON.stringify(m));
    t.ok(`${what}: keeps its looks`, Object.entries(d.tailor || {}).every(([k, v]) => m.tailor[k] === v), JSON.stringify(m.tailor));
    // the ludus opens on the path and sells nothing: tapping across it spends no fame
    await gv.ev(() => window.__engine.setScene('ludus')); await gv.frames(3);
    for (const [x, y] of [[100, 260], [250, 260], [420, 260], [600, 260], [760, 260]]) { await gv.tap(x, y); await gv.frames(2); }
    t.eq(`${what}: the ludus sells nothing`, await gv.ev(() => window.__engine.save.get('fame', 0)), life);
  }
  // a save from before the ludus (v9): the Trickster and the Showman it was given are kept and not counted as spent
  const g9 = await t.boot({ w: 667, h: 375, raw: { __v: 9, data: { storySeen: 1 } } });
  await g9.frames(5);
  t.eq('a v9 save: its gift kept, not counted, rank 1', await g9.ev(() => { const E = window.__engine; return [E.save.get('fame', 0), E.save.get('ludus', [])]; }), [0, ['trick', 'show']]);
}
