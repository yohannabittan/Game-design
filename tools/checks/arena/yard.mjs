// Steps 23, 22b, 23b and 24: the training yard on a fresh save, played end to end by touch from the purse's Fight! to "Now fight." (sword strokes,
// the shield and DODGE buttons, the knife's tap and drag); Skip ends it; a second run doesn't show it. Also the bugs it has had: the hold step
// stuck when the wall cut a hold short (22b), marks so far apart that a plain jab fell short (23b), and a tap that threw no knife (24).
// Step 26b: each sword step's ghost thumb, copied as a thumb at the ghost's speed and size, passes the step, and still does a little slower and smaller.
import { FRESH } from '../arena.mjs';

export const tr = (g) => g.ev(() => { const P = window.__engine.game.scenes.play, s = P.state, t = s.train; return t ? { id: P.YARD[t.i].id, done: t.doneT >= 0, fails: t.fails } : null; });

// from the purse (as a fresh run opens it) to the bout card and its tap
async function toBout(t, save, w = 667, h = 375) {
  const g = await t.boot({ w, h, save });
  await g.ev(() => { const E = window.__engine; E.setScene('roll', { seed: 777, arena: 'pit' }); const R = E.game.scenes.roll; R.at(8); R.cardT = 1; R.openPurse(E); R.purse.t = 1; });
  await g.frames(30);
  await g.tapRect(await g.ev(() => window.__engine.game.scenes.roll.purse.fight));
  await g.frames(60);
  await g.tap(w * 0.6, h * 0.5);
  await g.frames(30);
  return g;
}

// the right thumb's strokes, [frame, dx, dy] from where it lands (the replays' strokes, tools/checks/replays/make.mjs); the gap step's jab is tried
// at a few heights, since where the gap is depends on the size
const STROKES = {
  jab: [[0, 0, 0], [6, -12, 4], [9, 30, -4], [14, 30, -4]],
  slash: [[0, -20, -70], [1, -20, -70], [2, -5, -20], [3, 10, 30], [4, 20, 70], [8, 20, 70]],
  over: [[0, 0, 0], [5, 0, -70], [10, 5, -140], [18, 5, -140], [20, 10, -40], [22, 15, 60], [26, 15, 60]],
  lunge: [[0, 0, 0], [6, 60, -5], [12, 140, -10], [18, 190, -10], [45, 190, -10]],
};
// the gap step's jab: the thumb first brought down (or up) by the height from the tip to the gap nearest his chest, then the same push
const gapJab = (g, n) => g.ev((n) => {
  const E = window.__engine, P = E.game.scenes.play, s = P.state, F = P.foeF(E), [, cy] = P.partCenter(F, s.foe, s.foe.parts.find((q) => q.d.id === 'chest'));
  const gaps = s.foe.parts.filter((q) => q.slot && !q.guard && !q.cut).map((q) => P.partCenter(F, s.foe, q)).sort((a, b) => Math.abs(a[1] - cy) - Math.abs(b[1] - cy));
  const dy = (gaps[n % gaps.length][1] - s.hand.uy) / P.TUNING.control.gain;
  return [[0, 0, 0], [6, -12, dy], [9, 30, dy - 4], [14, 30, dy - 4]];
}, n);

// the sword ghost's thumb as the yard draws it, sampled a frame at a time at `slow` x its time and `size` x its size: where it lands, and
// [frame, dx, dy] from there until it lifts
const ghostCopy = (g, id, slow, size) => g.ev(async ([id, slow, size]) => {
  const E = window.__engine, P = E.game.scenes.play, Y = await import(new URL('src/features/yard.js', location.href).href);
  const { keys, ax, ay } = Y.ghostStroke(E, id), n = P.TUNING.train.ghost.loop * 60 * slow, out = [];
  for (let f = 0; f <= n; f++) { const [x, y, d] = Y.ghostAt(keys, f / n); if (!d) break; out.push([f, x, y]); }
  const [, x0, y0] = out[0];
  return { x: ax + x0, y: ay + y0, keys: out.map(([f, x, y]) => [f, (x - x0) * size, (y - y0) * size]) };
}, [id, slow, size]);

const btn = (g, i) => g.ev((i) => { const E = window.__engine, b = E.game.scenes.play.shieldBtns(E)[i]; return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; }, i);
const waitBlow = (g) => g.until(() => { const s = window.__engine.game.scenes.play.state; return !!(s.train && s.train.sw && !s.train.sw.outcome); }, 600);

// one try at the step the yard is on; true when it is done
export async function doStep(g, id, n = 0) {
  const B = async (i) => btn(g, i);
  if (id === 'hand') {
    const c = await g.ev(() => { const E = window.__engine, T = E.game.scenes.play.TUNING.train.ghost; return [E.w * T.at[0], E.h * T.at[1]]; });
    await g.down(c[0], c[1]);
    for (let k = 1; k <= 40; k++) { await g.frames(1); await g.move(c[0] + 28 * Math.cos(k / 6), c[1] + 20 * Math.sin(k / 6)); }
    await g.frames(1); await g.up(c[0] + 28, c[1]);
  } else if (id === 'gap') {
    await g.stroke(g.w * 0.7, g.h * 0.42, await gapJab(g, n));
  } else if (STROKES[id]) {
    await g.stroke(g.w * (id === 'lunge' ? 0.5 : 0.7), g.h * (id === 'lunge' ? 0.6 : 0.42), STROKES[id]);
  } else if (id === 'shield' || id === 'read') {
    if (!(await waitBlow(g))) return false;
    const z = await g.ev(() => { const P = window.__engine.game.scenes.play; return P.ZONES.indexOf(P.state.sw.zone); }), b = await B(z);
    await g.down(b.x, b.y, 3);
    await g.until(() => { const t = window.__engine.game.scenes.play.state.train; return !t || !t.sw || !!t.sw.outcome; }, 400);
    await g.frames(2); await g.up(b.x, b.y, 3);
  } else if (id === 'dodge') {
    const b = await B(3); await g.tap(b.x, b.y, 4);
  } else if (id === 'hold') {
    const b = await B(3); await g.down(b.x, b.y, 4); await g.frames(60); await g.up(b.x, b.y, 4);
  } else if (id === 'knife') {
    const k = await g.ev(() => { const E = window.__engine, b = E.game.scenes.play.armsBtns(E); return b && b.knife; });
    await g.tap(k.x, k.y, 5); await g.frames(20);
    const q = await g.ev(() => { const E = window.__engine, P = E.game.scenes.play, s = P.state, K = P.TUNING.knives, p = s.foe.parts.find((q) => q.slot && !q.guard && !q.cut), [x, y] = P.partCenter(P.foeF(E), s.foe, p); return { sx: E.w * K.ghost[0], sy: E.h * K.ghost[1], x, y: y + K.lift }; });
    await g.stroke(q.sx, q.sy, [[0, 0, 0], [20, q.x - q.sx, q.y - q.sy], [26, q.x - q.sx, q.y - q.sy]], 6);
  } else if (id === 'perfect') {
    if (!(await waitBlow(g))) return false;
    await g.until(() => { const P = window.__engine.game.scenes.play, sw = P.state.sw; return !sw || sw.wind - sw.t <= P.perfectWin() * 0.5; }, 400);
    const b = await B(1); await g.down(b.x, b.y, 3);
    await g.until(() => { const t = window.__engine.game.scenes.play.state.train; return !t || !t.sw || !!t.sw.outcome; }, 200);
    await g.frames(2); await g.up(b.x, b.y, 3);
  } else if (id === 'tell') {
    if (!(await waitBlow(g))) return false;
    await g.until(() => { const P = window.__engine.game.scenes.play, sw = P.state.sw; return !sw || sw.wind - sw.t <= P.TUNING.dodge.dur * 0.5; }, 400);
    const b = await B(3); await g.tap(b.x, b.y, 4);
  }
  await g.frames(20);
  const q = await tr(g);
  return !q || q.id !== id || q.done;
}

export default async function (t) {
  // 1. end to end, at each phone size
  for (const [w, h] of [[667, 375], [844, 390], [874, 402]]) {
    const g = await toBout(t, FRESH, w, h);
    const seen = [], stuck = [];
    for (let n = 0; n < 40; n++) {
      const q = await tr(g);
      if (!q || q.id === 'go') break;
      if (seen[seen.length - 1] !== q.id) seen.push(q.id);
      let tries = 0;
      while (!(await doStep(g, q.id, tries))) if (++tries >= 6) { stuck.push(`${q.id} (${(await tr(g)).fails} failed)`); break; }
      if (stuck.length) break;
      await g.until(() => { const s = window.__engine.game.scenes.play.state; return !s.train || s.train.doneT < 0; }, 120);
    }
    await g.until(() => !window.__engine.game.scenes.play.state.train, 300);
    const end = await g.ev(() => { const E = window.__engine, s = E.game.scenes.play.state; return { train: !!s.train, scene: E.sceneName, trainDone: E.save.get('trainDone', 0), knives: s.knives, yard: s.yard }; });
    const all = await g.ev(() => window.__engine.game.scenes.play.YARD.map((q) => q.id).filter((q) => q !== 'go'));
    t.ok(`${w}x${h}: every step completes by touch`, !stuck.length && seen.join() === all.join(), `stuck at ${stuck.join()}; steps done: ${seen.join()}`);
    t.ok(`${w}x${h}: the yard ends into the bout, marked done, its practice knife given back`, !end.train && end.scene === 'play' && end.trainDone === 1 && end.knives === 0 && /tell/.test(end.yard || ''), JSON.stringify(end));
  }

  // 2. the hold step from the wall: you backed to the wall as it starts (the dodge ends at once), DODGE held
  {
    const g = await toBout(t, FRESH);
    await g.ev(() => { const E = window.__engine, P = E.game.scenes.play, tr = P.state.train; tr.i = P.YARD.findIndex((q) => q.id === 'hold') - 1; P.nextYard(E); P.state.foot.pos = P.state.foot.tgt = P.walls(E).back; });
    const b = await btn(g, 3);
    await g.down(b.x, b.y, 4); await g.frames(50);
    const q = await tr(g); await g.up(b.x, b.y, 4);
    t.ok('hold DODGE with your back to the wall completes the hold step', q && q.id === 'hold' && q.done, JSON.stringify(q));
  }

  // 3. the marks: with a long-reach partner (a spear, whose own striking distance is past your plain jab), each step stands him where your plain
  // jab lands: two jabs from the marks both land, with no lunge
  for (const [w, h] of [[667, 375], [844, 390]]) {
    const g = await toBout(t, FRESH, w, h);
    const r = await g.ev(() => {
      const E = window.__engine, P = E.game.scenes.play, s = P.state, tr = s.train;
      s.foe.weapon = P.TUNING.weapons.find((q) => q.id === 'spear');
      tr.i = P.YARD.findIndex((q) => q.id === 'jab') - 1; P.nextYard(E);
      return { gap: +P.gapNow().toFixed(3), own: +(s.foe.weapon.strike + s.foe.size.reach).toFixed(3) };
    });
    await g.frames(5);
    for (let i = 0; i < 2; i++) { await g.stroke(w * 0.7, h * 0.42, STROKES.jab); await g.frames(30); }
    const j = await g.ev(() => { const s = window.__engine.game.scenes.play.state; return { jabs: s.train.jabs, lunges: s.lunges }; });
    t.ok(`${w}x${h}: the yard stands a spearman within your plain jab: two jabs from the marks both land, no lunge`, r.gap < r.own && j.jabs === 2 && j.lunges === 0, JSON.stringify({ ...r, ...j }));
  }

  // the knife step: a tap on him throws nothing and doesn't complete it (DRAG, THEN LET GO)
  {
    const g = await toBout(t, FRESH);
    await g.ev(() => { const E = window.__engine, P = E.game.scenes.play, tr = P.state.train; tr.i = P.YARD.findIndex((q) => q.id === 'knife') - 1; P.nextYard(E); });
    await g.frames(5);
    const k = await g.ev(() => { const E = window.__engine, b = E.game.scenes.play.armsBtns(E); return b && b.knife; });
    await g.tap(k.x, k.y, 5); await g.frames(20);
    const q = await g.ev(() => { const E = window.__engine, P = E.game.scenes.play, s = P.state, p = s.foe.parts.find((q) => q.slot && !q.guard && !q.cut), [x, y] = P.partCenter(P.foeF(E), s.foe, p); return { x, y: y + P.TUNING.knives.lift }; });
    await g.ev(() => { window.__engine.game.scenes.play.state.pops = []; });
    await g.tap(q.x, q.y, 6); await g.frames(30);
    const r = await g.ev(() => { const P = window.__engine.game.scenes.play, s = P.state; return { done: s.train.doneT >= 0, thrown: s.knivesThrown, said: s.pops.map((q) => q.s).filter((q) => /[A-Z]{3}/.test(q)).join('|') }; });
    t.ok('the knife step: a tap on him throws nothing, and says DRAG, THEN LET GO', !r.done && r.thrown === 0 && /DRAG, THEN LET GO/.test(r.said), JSON.stringify(r));
  }

  // 2b. step 26b: the ghost is a gesture a person can copy: each sword step's ghost, replayed as a thumb, counts (a step that needs two counts one),
  // at the ghost's own speed and size, and at 1.25 x its time and 0.85 x its size (a copy a little slow and small)
  for (const [w, h] of [[667, 375], [844, 390], [874, 402]]) {
    const g = await toBout(t, FRESH, w, h);
    for (const id of ['jab', 'slash', 'over', 'lunge']) {
      const bad = [];
      for (const [slow, size] of [[1, 1], [1.25, 0.85]]) {
        await g.ev((id) => { const E = window.__engine, P = E.game.scenes.play; P.state.train.i = P.YARD.findIndex((q) => q.id === id) - 1; P.nextYard(E); }, id);
        await g.frames(20);
        const c = await ghostCopy(g, id, slow, size), l0 = await g.ev(() => window.__engine.game.scenes.play.state.lunges);
        await g.stroke(c.x, c.y, c.keys);
        await g.frames(30);
        // (a step that counted may already have moved on; a copy of a jab, slash or overhead never lunges)
        const r = await g.ev(([id, l0]) => {
          const P = window.__engine.game.scenes.play, s = P.state, tr = s.train, st = P.YARD[tr.i];
          return { id: st.id, got: st.id === id ? st.got(tr) - tr.base : 0, done: st.id !== id || tr.doneT >= 0, lunged: s.lunges - l0 };
        }, [id, l0]);
        if (!r.done && r.got < 1) bad.push(`x${slow} time, x${size} size: ${JSON.stringify(r)}`);
        if (id !== 'lunge' && r.lunged) bad.push(`x${slow} time, x${size} size lunged: ${JSON.stringify(r)}`);
      }
      t.ok(`${w}x${h}: a thumb copying the ${id} ghost passes, with room to spare`, !bad.length, bad.join('; '));
    }
  }

  // 4. Skip ends it; 5. it doesn't show on a second run, nor once done
  {
    const g = await toBout(t, FRESH);
    const a = await tr(g);
    await g.tapRect(await g.ev(() => window.__engine.game.scenes.play.state.train.skip)); await g.frames(30);
    const b = await g.ev(() => { const E = window.__engine, s = E.game.scenes.play.state; return { train: !!s.train, scene: E.sceneName, trainDone: E.save.get('trainDone', 0) }; });
    t.ok('Skip training ends the yard into the bout and marks it done', a && a.id === 'hand' && !b.train && b.scene === 'play' && b.trainDone === 1, JSON.stringify({ a, b }));
  }
  for (const [k, save] of [['a second run', { storySeen: 1, firstRunDone: 1 }], ['a save with the yard done', { storySeen: 1, trainDone: 1 }]]) {
    const g = await toBout(t, save);
    t.eq(`the yard doesn't show on ${k}`, await tr(g), null);
  }
}
