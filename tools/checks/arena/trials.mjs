// Trials (steps 27 and 27b): the menu's Trials button, the grid's tabs, each of the eight trials starts, can be passed and failed, and records its
// medal and best; a first gold gives fame once; Retry restarts the trial; the attempt reaches the export; a save from before Trials (v19) loads.
// The passes below put the trial's goal in place (the count, the plates, the fall) and check what the runner does with it; they don't play it.
import { VET } from '../arena.mjs';
import { throwKnife } from '../scene.mjs';

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
    let c = await g.ev(() => window.__engine.game.scenes.trials.cards[1]);
    await g.tap(c.x + c.w / 2, c.y + c.h / 2); await g.frames(3);
    t.eq(`${w}x${h}: the bow's range card (soon) starts nothing yet`, await scene(g), 'trials');
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

  await range(t);

  // a save from before Trials loads, with no trials played, and opens the grid
  const old = JSON.parse(JSON.stringify(VET));
  const g2 = await t.boot({ w: 667, h: 375, raw: { __v: 19, data: old } });
  await g2.frames(60);
  t.eq('a v19 save migrates to no trials played', await g2.ev(() => window.__engine.save.get('trials', null)), {});
  await g2.ev(() => window.__engine.setScene('trials')); await g2.frames(5);
  // (since ranks, v21, the fame a v20 save spent in the ludus counts too: ranks.mjs checks how much)
  t.eq('the old save opens the grid, its fame kept', await g2.ev(([f]) => [window.__engine.sceneName, window.__engine.save.get('fame', 0) >= f], [VET.fame]), ['trials', true]);
}

// Step 27b, the range: each knife trial starts from its card; a thrown knife at a pot bursts it, at the man ends it; the targets cycle near, mid and
// far and the knife's line and its result agree at each; the wheel turns faster and the other way on the second; a knife flies straight and hits what
// is on its line when it arrives (a pot the wheel has turned away is missed); Knife Work passes and fails; nothing of the range under the KNIFE button;
// no fight buttons, hearts or stamina in a range trial; your sword arm's shoulder on your body's shoulder (at rest, a knife up, after a throw).
// px between the drawn arm's shoulder end and your body's shoulder
const armGap = (g) => g.ev(async () => { const E = window.__engine, s = E.game.scenes.play.state, F = await import('./src/fight.js'), D = await import('./src/data.js'), [x, y] = F.toScreen(F.youF(E), D.SHOULDER[0], D.SHOULDER[1]); return Math.hypot(s.hand.sx - x, s.hand.sy - y); });
// which fight HUD pieces drew in the last frame (the canvas's draw calls watched for one render)
const hudDrawn = (g) => g.ev(async () => {
  const E = window.__engine, D = await import('./src/draw-fight.js'), seen = [], ctx = E.ctx, rr = E.roundRect, F = await import('./src/fight.js'), btn = F.shieldBtns(E)[0];
  E.roundRect = function (x, y, w, h, ...a) { if (Math.abs(x - btn.x) < 1 && Math.abs(w - btn.w) < 1) seen.push('shield column'); if (w === 182) seen.push('hearts and stamina plate'); return rr.call(this, x, y, w, h, ...a); };
  try { E.game.scenes.play.render(ctx, E); } finally { E.roundRect = rr; }
  return [...new Set(seen)];
});
const rs = (g) => g.ev(() => { const s = window.__engine.game.scenes.play.state, r = s.range; return r && { score: r.score, misses: r.misses, lvl: r.lvl, pots: r.pots.filter((p) => p.alive).length, mark: r.target && r.target.mark, dir: r.wheel.dir, w: r.wheel.w }; });
async function range(t) {
  for (const [w, h] of [[874, 402], [667, 375]]) {
    const g = await t.boot({ w, h, save: VET });
    await g.frames(30); await g.ev(() => window.__engine.setScene('trials', { tab: 'range' })); await g.frames(2);
    const cards = await g.ev(() => window.__engine.game.scenes.trials.cards);
    for (const [i, id] of [[0, 'shrinkKnives'], [2, 'knifeWork'], [4, 'board'], [5, 'wheel']]) {
      await g.ev(() => window.__engine.setScene('trials', { tab: 'range' })); await g.frames(2);
      await g.tap(cards[i].x + cards[i].w / 2, cards[i].y + cards[i].h / 2); await g.frames(120);
      // what of the range could sit under the KNIFE button (and the thumb's reach) or the HUD's right plate: every target place, the board, the wheel
      const o = await g.ev(async () => {
        const E = window.__engine, s = E.game.scenes.play.state, R = (await import('./src/tuning.js')).TUNING.range, b = (await import('./src/features/ranged.js')).armsBtns(E).knife;
        const F = await import('./src/fight.js'), sc = E.h / 402, fl = F.lay(E).floor, mH = F.foeF(E).H, boxes = [];
        if (s.range && s.range.mode === 'targets') R.marks.forEach((m, i) => { const r = (R.target.R * R.target.shrink ** i + R.target.jitter / 2) * sc; boxes.push([E.w * m - r, E.safe.top + R.top, E.w * m + r, fl]); });
        if (s.range && s.range.mode === 'board') boxes.push([E.w * R.board.x - (R.board.w / 2 + 0.07) * mH, fl - 1.2 * mH, E.w * R.board.x + (R.board.w / 2 + 0.07) * mH, fl]);
        if (s.range && s.range.mode === 'wheel') { const r = mH / R.wheel.man * 1.05; boxes.push([E.w * R.wheel.x - r, fl - 2 * r, E.w * R.wheel.x + r, fl]); }
        const kb = [b.x - b.r - 22, b.y - b.r - 22, E.w, E.h];
        const ov = (a, c) => a[0] < c[2] && c[0] < a[2] && a[1] < c[3] && c[1] < a[3];
        return { id: s.trial && s.trial.id, knife: !!b, clash: boxes.filter((q) => ov(q, kb)).length, man: s.range && s.range.mode !== 'targets' ? Math.round(mH / F.youF(E).H * 100) : 100 };
      });
      t.ok(`${w}x${h}: ${id} starts from its card, KNIFE on hand, nothing of it under KNIFE, the man as tall as you`, o.id === id && o.knife && !o.clash && Math.abs(o.man - 100) <= 5, JSON.stringify(o));
      if (id !== 'knifeWork') {
        // no fight in a range trial: the shield column's places do nothing when pressed, and none of it is drawn (nor the hearts and stamina)
        const btns = await g.ev(async () => (await import('./src/fight.js')).shieldBtns(window.__engine).map((q) => [q.x + q.w / 2, q.y + q.h / 2]));
        for (const [x, y] of [btns[0], btns[3]]) { await g.tap(x, y); await g.frames(4); }
        const f = await g.ev(() => { const s = window.__engine.game.scenes.play.state; return [s.sh.t, !!s.away]; });
        t.eq(`${w}x${h}: ${id}: no block or dodge buttons work`, f, [-1, false]);
        t.eq(`${w}x${h}: ${id}: no fight HUD drawn (shield column, hearts, stamina)`, await hudDrawn(g), []);
        t.ok(`${w}x${h}: ${id}: your sword arm on your shoulder at rest`, (await armGap(g)) < 1, String(await armGap(g)));
      }
      if (id === 'shrinkKnives') {
        const marks = [];
        for (let n = 0; n < 3; n++) { const m = (await rs(g)).mark, seen = await throwKnife(g, 'target', { after: 50 }); marks.push([m, seen && seen.over, (await rs(g)).score]); }
        t.eq(`${w}x${h}: the targets go near, mid, far, and a knife the line shows on each hits it`, marks, [[0, 'target', 1], [1, 'target', 2], [2, 'target', 3]]);
        for (let n = 0; n < 3; n++) await throwKnife(g, -400, { after: 30 });
        t.ok(`${w}x${h}: three misses end it, on the targets hit`, await endCard(g) && (await g.ev(() => window.__engine.game.scenes.trials.end.score)) === 3, '');
      }
      if (id === 'board' || id === 'wheel') {
        // (the wheel held still while the thumb finds a pot: the check is of the line and its result, not of leading the spin)
        const hold = () => g.ev(() => { window.__engine.game.scenes.play.state.range.wheel.w = 0; });
        if (id === 'wheel') await hold();
        let raised = null;
        const s0 = await rs(g), seen = await throwKnife(g, 'pot', { after: 50, onFrame: async () => { if (raised == null) raised = await armGap(g); } }), s1 = await rs(g);
        t.ok(`${w}x${h}: ${id}: your sword arm on your shoulder with the knife up and after the throw`, raised < 1 && (await armGap(g)) < 1, String([raised, await armGap(g)]));
        t.ok(`${w}x${h}: ${id}: a knife the line shows on a pot bursts it`, seen.over === 'pot' && s1.score === 1 && s1.pots === s0.pots - 1, JSON.stringify([seen, s0, s1]));
        if (id === 'wheel' && w === 874) {
          // the last pot of the first wheel: the second turns faster, the other way
          await g.ev(() => { const r = window.__engine.game.scenes.play.state.range; const c = Math.cos(r.wheel.th), sn = Math.sin(r.wheel.th), x = (p) => p.lx * c - p.ly * sn, near = r.pots.filter((p) => p.alive).sort((a, b) => x(a) - x(b))[0]; r.pots.forEach((p) => { p.alive = p === near; }); });
          await hold(); await throwKnife(g, 'pot', { after: 90 });
          const s2 = await rs(g);
          t.ok('wheel: cleared, the second wheel turns faster and the other way', s2.lvl === 1 && s2.dir === -1 && s2.w > 0.6, JSON.stringify([s1, s2]));
        }
        if (id === 'wheel') {
          // a knife aimed at a pot while the wheel stands, which then turns fast while the knife flies: it flies straight, the pot has moved on, missed
          await hold();
          // (onFrame runs on each of the thumb's 14 sliding frames, then after the release)
          let n = 0;
          const spin = async () => { if (++n === 15) await g.ev(() => { window.__engine.game.scenes.play.state.range.wheel.w = 8; }); };
          const a0 = await rs(g), seen2 = await throwKnife(g, 'pot', { after: 40, onFrame: spin }), a1 = await rs(g);
          t.ok(`${w}x${h}: wheel: a knife at a pot the wheel turns away before it arrives bursts nothing`, seen2.over === 'pot' && a1.score === a0.score && a1.pots === a0.pots, JSON.stringify([seen2, a0, a1]));
          await g.ev(() => { const r = window.__engine.game.scenes.play.state.range; r.misses = 0; r.end = null; r.wait = 0; r.hurt = -1; });
          await hold();
        }
        const hit = await throwKnife(g, 'man', { after: 50 });
        t.eq(`${w}x${h}: ${id}: a knife at the man says OW and ends it`, [hit.over, await g.ev(() => window.__engine.game.scenes.play.state.pops.some((q) => q.s === 'OW!'))], ['man', true]);
        t.ok(`${w}x${h}: ${id}: ended, its pots burst recorded as best`, await endCard(g) && (await rec(g, id)).best >= 1, JSON.stringify(await rec(g, id)));
      }
      if (id === 'knifeWork') {
        await g.ev(() => { const s = window.__engine.game.scenes.play.state; s.foe.hp = 3; s.knifeGaps = 2; s.swingIn = 99; });
        await throwKnife(g, 0, { after: 60 });
        t.ok(`${w}x${h}: knifeWork: a knife fells him; it scores the knives left`, await endCard(g) && (await g.ev(() => window.__engine.game.scenes.trials.end.score)) === 5, JSON.stringify(await g.ev(() => window.__engine.game.scenes.trials.end)));
        await g.ev(() => window.__engine.setScene('play', { trial: 'knifeWork' })); await g.frames(5);
        await g.ev(() => { window.__engine.game.scenes.play.state.knives = 0; });
        t.ok(`${w}x${h}: knifeWork: out of knives with him standing fails`, await endCard(g) && !(await g.ev(() => window.__engine.game.scenes.trials.end.pass)), '');
      }
    }
    t.eq(`${w}x${h}: no page errors in the range`, g.errors().length, 0);
    await g.close();
  }
}
