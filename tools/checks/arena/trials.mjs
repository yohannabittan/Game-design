// Trials (steps 27 and 27b): the menu's Trials button, the grid's tabs, each of the eight trials starts, can be passed and failed, and records its
// medal and best; a first gold gives fame once; Retry restarts the trial; the attempt reaches the export; a save from before Trials (v19) loads.
// The passes below put the trial's goal in place (the count, the plates, the fall) and check what the runner does with it; they don't play it.
import { VET } from '../arena.mjs';

const IDS = ['ironwall', 'gaphunter', 'breaker', 'knuckles', 'stagger', 'brawl', 'capuan', 'rage'];
// each trial's goal reached, from inside the page (s: the play state)
const PASS = {
  gaphunter: (s) => { s.trial.stabs = 5; },
  breaker: (s) => { for (const p of s.foe.parts) p.armour = false; },
  stagger: (s) => { s.trial.staggers = 5; },
  knuckles: (s) => { s.felled = 1; },
  brawl: (s) => { s.felled = 1; },
  capuan: (s) => { s.specials.capuan = [5, 5]; s.trial.a0 = 5; s.trial.score = 5; s.move = null; s.sw = null; },
  rage: (s) => { s.specials.rage = [3, 0]; s.move = null; s.sw = null; },
};
const scene = (g) => g.ev(() => window.__engine.sceneName);
const start = async (g, id) => { await g.ev((id) => window.__engine.setScene('play', { trial: id }), id); await g.frames(30); };
const endCard = (g) => g.until(() => window.__engine.sceneName === 'trials' && !!window.__engine.game.scenes.trials.end, 400);
// A bot by real pointer input: block (tap the shown height's button, about 0.2 s before the blow) and/or one stroke over and over, to the end card
const JAB = [[0, 0, 0], [6, -12, 4], [9, 30, -4], [14, 30, -4]], SLASH = [[0, 0, -40], [6, 20, 30], [10, 20, 30]];
async function bot(g, id, { block, stroke }) {
  await start(g, id);
  const btns = await g.ev(async () => (await import('./src/fight.js')).shieldBtns(window.__engine).map((b) => ({ z: b.z && b.z.id, x: b.x + b.w / 2, y: b.y + b.h / 2 })));
  for (let f = 0; f < 7000;) {
    const s = await g.ev(() => { const E = window.__engine, s = E.game.scenes.play.state; if (E.sceneName !== 'play' || !s.trial) return null;
      return { sw: s.sw && !s.sw.outcome ? { z: s.sw.zone.id, rem: s.sw.wind - s.sw.t } : null, w: E.w, h: E.h }; });
    if (!s) break;
    if (block && s.sw) { if (s.sw.rem <= 0.2) { const b = btns.find((q) => q.z === s.sw.z) || btns[0]; await g.tap(b.x, b.y); f += 3; } await g.frames(1); f++; continue; }
    if (stroke) { await g.stroke(s.w * 0.78, s.h * 0.5, stroke); await g.frames(4); f += 21; } else { await g.frames(1); f++; }
  }
  await endCard(g);
  return g.ev(() => window.__engine.game.scenes.trials.end);
}
const rec = (g, id) => g.ev((id) => (window.__engine.save.get('trials', {}) || {})[id] || null, id);

export default async function (t) {
  // the menu's button and the grid, at both phone sizes
  for (const [w, h] of [[667, 375], [844, 390]]) {
    const g = await t.boot({ w, h, save: VET });
    await g.frames(120);
    const m = await g.ev(() => {
      const E = window.__engine, b = E.game.scenes.menu.btns, ov = (a, c) => a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h;
      return { b: b.trials, hit: Object.entries(b).filter(([k, q]) => k !== 'trials' && q && b.trials && ov(b.trials, q)).map(([k]) => k), W: E.w, H: E.h };
    });
    t.ok(`${w}x${h}: the menu's Trials button is on screen, 44 px tall, clear of the others`, m.b && m.b.h >= 44 && m.b.y + m.b.h <= m.H && !m.hit.length, JSON.stringify(m));
    await g.tap(m.b.x + m.b.w / 2, m.b.y + m.b.h / 2); await g.frames(3);
    t.eq(`${w}x${h}: Trials opens the grid`, await scene(g), 'trials');
    // each tab by a tap on it, then its cards
    const counts = {};
    for (const [i, tab] of ['range', 'blades', 'fists', 'champions'].entries()) {
      const x = await g.ev((i) => { const E = window.__engine, w = (E.w - 32 - E.safe.left - E.safe.right - 30) / 4; return [16 + E.safe.left + i * (w + 10) + w / 2, E.safe.top + 60 + 22]; }, i);
      await g.tap(x[0], x[1]); await g.frames(2);
      counts[tab] = await g.ev(() => { const T = window.__engine.game.scenes.trials; return [T.tab, T.cards.length, T.cards.every((c) => c.w >= 44 && c.h >= 44 && c.y + c.h <= window.__engine.h)]; });
    }
    t.eq(`${w}x${h}: each tab shows its cards, all on screen`, counts, { range: ['range', 6, true], blades: ['blades', 3, true], fists: ['fists', 3, true], champions: ['champions', 2, true] });
    // a "soon" card starts nothing; a live card starts its trial
    await g.ev(() => { window.__engine.game.scenes.trials.tab = 'range'; }); await g.frames(2);
    let c = await g.ev(() => window.__engine.game.scenes.trials.cards[0]);
    await g.tap(c.x + c.w / 2, c.y + c.h / 2); await g.frames(3);
    t.eq(`${w}x${h}: a range card (soon) starts nothing yet`, await scene(g), 'trials');
    await g.ev(() => { window.__engine.game.scenes.trials.tab = 'champions'; }); await g.frames(2);
    c = await g.ev(() => window.__engine.game.scenes.trials.cards[0]);
    await g.tap(c.x + c.w / 2, c.y + c.h / 2); await g.frames(3);
    t.eq(`${w}x${h}: a tap on The Capuan Feint starts it`, await g.ev(() => { const s = window.__engine.game.scenes.play.state; return [window.__engine.sceneName, s.trial && s.trial.id, s.foe.name]; }), ['play', 'capuan', 'Varro of Capua']);
    // the quit button returns to the grid on the trial's tab, saving no run
    await g.tap(16 + 22, 6 + 22 + (await g.ev(() => window.__engine.safe.top))); await g.frames(3);
    t.eq(`${w}x${h}: the quit button returns to the grid, on the trial's tab, with no run saved`, await g.ev(() => [window.__engine.sceneName, window.__engine.game.scenes.trials.tab, window.__engine.save.get('run', null)]), ['trials', 'champions', null]);
  }

  // every trial starts, passes, and records its medal and best (and its line in the export)
  const g = await t.boot({ w: 844, h: 390, save: { ...VET, fame: 0 } });
  await g.frames(60);
  for (const id of IDS) {
    await start(g, id);
    const s0 = await g.ev(() => { const E = window.__engine, s = E.game.scenes.play.state; return { scene: E.sceneName, id: s.trial && s.trial.id, foe: !!s.foe, hp: s.hp, run: E.save.get('run', null) }; });
    t.ok(`${id}: starts, with a foe and full hearts, saving no run`, s0.scene === 'play' && s0.id === id && s0.foe && s0.hp > 0 && !s0.run, JSON.stringify(s0));
    if (id === 'ironwall') {
      // a streak of ten already, and his next blow taken on the body: it ends there, on the streak
      await g.ev(() => { window.__engine.game.scenes.play.state.trial.score = 10; });
    } else await g.ev(([src]) => { const s = window.__engine.game.scenes.play.state; new Function('s', `(${src})(s)`)(s); }, [PASS[id].toString()]);
    const ended = await endCard(g);
    const e = await g.ev(() => window.__engine.game.scenes.trials.end);
    t.ok(`${id}: passed, the end card shows a medal`, ended && e && e.id === id && e.pass && e.medal >= 1, JSON.stringify(e));
    const r = await rec(g, id);
    t.ok(`${id}: its medal and best are saved`, r && r.medal === e.medal && r.best === e.score, JSON.stringify(r));
  }
  const log = await g.ev(() => window.__engine.ledger.entries.filter((q) => q.k === 'trial').map((q) => q.d));
  t.ok('each attempt is in the export: id, score, time and medal', log.length === IDS.length && log.every((d) => IDS.includes(d.id) && 'score' in d && d.time >= 0 && d.medal >= 0), JSON.stringify(log.slice(0, 2)));

  // a first gold gives fame once
  const f0 = await g.ev(() => window.__engine.save.get('fame', 0));
  await start(g, 'gaphunter'); await g.ev(() => { window.__engine.game.scenes.play.state.trial.stabs = 5; }); await endCard(g);
  const again = await g.ev(() => window.__engine.game.scenes.trials.end);
  t.eq('a second gold gives no more fame', [again.medal, again.fame, await g.ev(() => window.__engine.save.get('fame', 0))], [3, 0, f0]);
  t.ok('the first golds gave TUNING.trials.fame each', f0 > 0 && f0 % 5 === 0, `fame ${f0}`);

  // failing: time runs out, or your hearts do; no medal and the best stands
  const before = await rec(g, 'gaphunter');
  await start(g, 'gaphunter'); await g.ev(() => { window.__engine.game.scenes.play.state.trial.t = 999; }); await endCard(g);
  const fl = await g.ev(() => window.__engine.game.scenes.trials.end);
  t.ok('gaphunter: out of time fails, with no medal, and the best stands', !fl.pass && fl.medal === 0, JSON.stringify(fl));
  t.eq('gaphunter: the saved record is unchanged by a failure', await rec(g, 'gaphunter'), before);
  await start(g, 'knuckles'); await g.ev(() => { window.__engine.game.scenes.play.state.hp = 0; }); await endCard(g);
  t.ok('knuckles: falling fails it', !(await g.ev(() => window.__engine.game.scenes.trials.end.pass)), '');

  // Retry restarts the same trial from its start; Trials goes back to the grid
  const rt = await g.ev(() => { const E = window.__engine, w = Math.min(620, E.w - 32 - E.safe.left - E.safe.right), h = Math.min(300, E.h - 24 - E.safe.top - E.safe.bottom), x = (E.w - w) / 2, y = (E.h - h) / 2; return { x: x + 18 + (w * 0.6 - 24) / 2, y: y + h - 52 - 16 + 26, bx: x + w * 0.6 + 6 + (w * 0.4 - 24) / 2 }; });
  await g.tap(rt.x, rt.y); await g.frames(3);
  t.eq('Retry restarts the trial from its start, hearts full', await g.ev(() => { const s = window.__engine.game.scenes.play.state; return [window.__engine.sceneName, s.trial.id, s.trial.t < 0.2, s.hp === s.maxHp]; }), ['play', 'knuckles', true, true]);
  await g.ev(() => { window.__engine.game.scenes.play.state.felled = 1; }); await endCard(g);
  await g.tap(rt.bx, rt.y); await g.frames(3);
  t.eq('Trials goes back to the grid on its tab', await g.ev(() => [window.__engine.sceneName, window.__engine.game.scenes.trials.end, window.__engine.game.scenes.trials.tab]), ['trials', null, 'fists']);

  // each trial from a fresh page, drawn in the drawn look before any painting loads (the brawler's plain cap once broke this)
  for (const id of IDS) {
    const g3 = await t.boot({ w: 667, h: 375, save: VET });
    await g3.frames(10); await start(g3, id); await g3.frames(60);
    t.eq(`${id}: starts on a fresh page and plays a second`, await g3.ev(() => { const s = window.__engine.game.scenes.play.state; return [window.__engine.sceneName, s.trial && s.trial.id]; }), ['play', id]);
    await g3.close();
  }

  // the rule for every trial: blocking alone, or one stroke over and over, earns at most bronze (Gap Hunter, the Capuan Feint, Weather the Rage)
  const gb = await t.boot({ w: 844, h: 390, save: VET });
  await gb.frames(30);
  for (const [id, how, name] of [['gaphunter', { block: true }, 'blocking only'], ['gaphunter', { stroke: SLASH }, 'slashing only'], ['capuan', { block: true }, 'blocking every blow'],
    ['capuan', { stroke: SLASH }, 'slashing only'], ['rage', { block: true }, 'blocking only'], ['rage', { stroke: SLASH }, 'slashing only']]) {
    const e = await bot(gb, id, how);
    t.ok(`${id}: ${name} earns at most bronze`, e && e.medal <= 1, JSON.stringify(e));
  }
  await gb.close();

  // phone held upright: the grid and the end card ask you to turn it, and a tap starts nothing
  const gp = await t.boot({ w: 390, h: 844, save: VET });
  await gp.frames(30); await gp.ev(() => window.__engine.setScene('trials', { tab: 'blades' })); await gp.frames(3);
  await gp.tap(70, 170); await gp.tap(195, 300); await gp.tap(320, 420); await gp.frames(3);
  t.eq('upright: the grid shows the turn card, a tap starts nothing', await gp.ev(() => [window.__engine.sceneName, window.__engine.game.scenes.trials.cards.length]), ['trials', 0]);
  await gp.ev(() => window.__engine.setScene('trials', { end: { id: 'ironwall', score: 4, pass: true, medal: 1, fame: 0, isBest: false, best: 4 } })); await gp.frames(3);
  await gp.tap(110, 530); await gp.tap(290, 530); await gp.frames(3);
  t.eq('upright: the end card waits too', await gp.ev(() => [window.__engine.sceneName, !!window.__engine.game.scenes.trials.end]), ['trials', true]);
  await gp.close();

  // a save from before Trials loads, with no trials played, and opens the grid
  const old = JSON.parse(JSON.stringify(VET));
  const g2 = await t.boot({ w: 667, h: 375, raw: { __v: 19, data: old } });
  await g2.frames(60);
  t.eq('a v19 save migrates to no trials played', await g2.ev(() => window.__engine.save.get('trials', null)), {});
  await g2.ev(() => window.__engine.setScene('trials')); await g2.frames(5);
  // (since ranks, v21, the fame a v20 save spent in the ludus counts too: ranks.mjs checks how much)
  t.eq('the old save opens the grid, its fame kept', await g2.ev(([f]) => [window.__engine.sceneName, window.__engine.save.get('fame', 0) >= f], [VET.fame]), ['trials', true]);
}
