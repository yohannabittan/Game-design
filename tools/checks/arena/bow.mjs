// 2026-11-21, the bow and beasts: a beast bout opens with its charge (arrows and knives stagger and drop it; without a ranged weapon it arrives and
// strikes), the bow aimed like the knife always looses, a man closes at his own pace with it out, and the two bow trials can be finished.
import { VET } from '../arena.mjs';
import { scene, bowShot, bowUp } from '../scene.mjs';

const st = (g) => g.ev(() => { const s = window.__engine.game.scenes.play.state, c = s.charge; return { charge: !!c, left: c ? +c.left.toFixed(3) : null, f: c ? +c.f.toFixed(2) : null, hp: s.foe.hp, max: s.foe.maxHp, fall: s.fallT > 0, sw: !!s.sw, arrows: s.arrows, flying: !!s.arrow, x: +s.step.x.toFixed(3), home: +s.foe.home.toFixed(3) }; });

export default async function (t) {
  for (const [w, h] of [[667, 375], [844, 390]]) {
    const g = await t.boot({ w, h, save: VET });

    // the charge: a lion (no ranged weapon) starts at the far end of the sand, closes in about TUNING.charge.time s, then its first blow comes
    await scene(g, { foe: 'lion', still: false, foeHp: 0, settle: 1 });
    const c0 = await st(g), T = await g.ev(() => window.__engine.game.scenes.play.TUNING.charge);
    await g.frames(Math.round(T.time * 60 * 0.5));
    const c1 = await st(g);
    const arrived = await g.until(() => !window.__engine.game.scenes.play.state.charge, Math.round(T.time * 60 * 0.7));
    const blow = await g.until(() => !!window.__engine.game.scenes.play.state.sw, 240);
    t.ok(`${w}x${h}: a beast bout opens with its charge from the far end; it arrives in about ${T.time} s and its first blow follows`,
      c0.charge && c0.x > c0.home + 2 && c1.charge && c1.x < c0.x - 0.3 && arrived && blow, JSON.stringify({ c0, c1, arrived, blow }));

    // with a bow on the belt the charge opens with it in hand; two or three good draws drop a lion before it arrives
    await scene(g, { foe: 'lion', side: 'bow', still: false, foeHp: 0, settle: 1, bare: true });
    const b0 = await st(g), shots = [];
    for (let i = 0; i < 4 && !(await st(g)).fall && (await st(g)).charge; i++) shots.push(await bowShot(g, { hold: 50 }));
    await g.frames(30);
    const b1 = await st(g);
    t.ok(`${w}x${h}: with a bow the charge opens with it up; good draws drop a charging lion before it arrives (2 or 3)`,
      b0.charge && (await g.ev(() => window.__engine.game.scenes.play.state.bowOut)) && b1.fall && b1.arrows >= 2 && b1.arrows <= 3, JSON.stringify({ b0, shots, b1 }));

    // 2026-11-22: the whole charging beast is on screen and clear of the round buttons (and the thumb's room on them) from its first frame to its
    // arrival, a knock-back included, with the bow or with knives
    for (const o of [{ side: 'bow' }, { knives: 3 }]) {
      await scene(g, { foe: 'lion', ...o, still: false, foeHp: 0, settle: 0, bare: true });
      let worst = -1e9, left = 1e9, n = 0, at = -1;
      const look = async () => { const e = await g.ev(() => { const E = window.__engine, P = E.game.scenes.play, s = P.state, f = s.foe; if (!s.charge) return null; const F = P.foeF(E), B = P.TUNING.beasts[f.beast], b = P.armsBtns(E), bs = b ? [b.swap, b.knife].filter(Boolean) : [];
        return { over: F.x + B.back * F.H - Math.min(E.w, ...bs.map((q) => q.x - q.r)), nose: F.x - B.front * F.H }; }); if (e) { if (e.over > worst) at = n; worst = Math.max(worst, e.over); left = Math.min(left, e.nose); n++; } };
      await look();
      for (let i = 0; i < 160 && (await st(g)).charge; i += 4) { if (i === 20 || i === 70) await g.ev(() => { const P = window.__engine.game.scenes.play, s = P.state; s.charge.kb = P.TUNING.charge.kb; s.charge.f = P.TUNING.charge.slow; }); await g.frames(4); await look(); }
      t.ok(`${w}x${h}: ${o.side ? 'bow' : 'knives'}: the charging lion is whole on screen and never under a round button, from its first frame (knocked back too)`, n > 10 && worst < 0 && left > 0, JSON.stringify({ n, worst, left, at }));
    }

    // a hit on the charge slows it and knocks it back; a knife does it too
    await scene(g, { foe: 'lion', knives: 3, still: false, foeHp: 0, settle: 1, bare: true });
    const k = await g.ev(() => {
      const E = window.__engine, P = E.game.scenes.play, s = P.state, f = s.foe, hd = f.parts.find((q) => q.d.id === 'head'), [x, y] = P.partCenter(P.foeF(E), f, hd), hp = f.hp;
      P.knifeLands(E, { x0: x - 200, y0: y, x1: x, y1: y });
      return { dealt: hp - f.hp, slow: s.charge.f, kb: s.charge.kb };
    });
    t.ok(`${w}x${h}: a knife that hits the charge wounds it, slows it and knocks it back`, k.dealt > 0 && k.slow < 0.5 && k.kb > 0, JSON.stringify(k));

    // 2026-11-22: the archer draws the string: his far hand is on it by the grip as the draw starts and at his cheek at a full draw, the arrow
    // from the hand past the grip, the arm joined at its shoulder and both its halves an arm's half long or less
    await scene(g, { side: 'bow', arena: 'city', bout: 2, still: true });
    await bowUp(g);
    const pose = () => g.ev(async () => { const E = window.__engine, P = E.game.scenes.play, s = P.state, R = await import(new URL('src/features/ranged.js', location.href).href), F = P.youF(E), r = R.drawArmRec(E), [ax, ay] = P.toScreen(F, ...P.TUNING.bow.anchor), U = P.TUNING.arm.len * F.H / 2, a = s.aim;
      const tip = a && a.path ? [a.path[0], a.path[1]] : null, ux = a ? Math.cos(a.ang) : 1, uy = a ? Math.sin(a.ang) : 0;
      return { cheek: Math.hypot(r.hx - ax, r.hy - ay) / F.H, grip: Math.hypot(r.hx - s.hand.hx, r.hy - s.hand.hy) / F.H, upper: Math.hypot(r.ex - r.sx, r.ey - r.sy) / U, fore: Math.hypot(r.hx - r.ex, r.hy - r.ey) / U,
        past: tip ? ((tip[0] - s.hand.hx) * ux + (tip[1] - s.hand.hy) * uy) / F.H : null, behind: (r.ex - F.x) / F.H }; });
    const px = g.w * 0.8, py = g.h * 0.62;
    await g.down(px, py, 6); await g.frames(2); const p0 = await pose(); await g.frames(72); const p1 = await pose(); await g.up(px, py, 6); await g.frames(60);
    t.ok(`${w}x${h}: the far hand holds the string by the grip as the draw starts and at the cheek at a full draw; the arrow runs past the grip; the arm is one arm`,
      p0.grip < 0.12 && p1.cheek < 0.04 && p1.past > 0.01 && p1.behind < 0 && [p0, p1].every((q) => q.upper <= 1.01 && q.fore <= 1.01 && q.upper > 0.3), JSON.stringify({ p0, p1 }));

    // the bow always looses: a quick tap, a slow draw, a draw slid off the top, and one inside his reach against a man (weaker, never refused)
    const shotsOut = [];
    for (const o of [{ hold: 2 }, { hold: 120 }, { hold: 30, slide: -400 }, { hold: 20, slide: 200 }]) {
      const a0 = (await st(g)).arrows; const seen = await bowShot(g, o); const a1 = await st(g);
      shotsOut.push({ o, loosed: a1.arrows - a0, flying: a1.flying, seen }); await g.frames(60);
    }
    await g.ev(() => { const s = window.__engine.game.scenes.play.state; window.__pinNear = 1; const raf = window.requestAnimationFrame; const f = () => { s.step.x = s.step.tgt = s.foe.strike - 0.05; raf(f); }; raf(f); });
    await g.frames(5);
    const n0 = (await st(g)).arrows, close = await bowShot(g, { hold: 40 }), n1 = (await st(g)).arrows;
    const said = await g.ev(() => window.__engine.game.scenes.play.state.pops.map((q) => q.s).join('|'));
    t.ok(`${w}x${h}: every release looses an arrow (a tap, a long hold, slid off the screen's edges, inside his reach), and nothing says TOO SOON or TOO CLOSE`,
      shotsOut.every((q) => q.loosed === 1) && n1 - n0 === 1 && !/TOO/.test(said), JSON.stringify({ shotsOut, close, said }));
    await g.close();
  }

  // against a man the bow brings him on at his own pace: with his blows held off he stays about his home, no rush to striking distance
  {
    const g = await t.boot({ w: 844, h: 390, save: VET });
    await scene(g, { side: 'bow', arena: 'city', bout: 2, still: false, foeHp: 0 });
    await g.ev(() => { const s = window.__engine.game.scenes.play.state, raf = window.requestAnimationFrame; const f = () => { s.swingIn = 99; s.plan = null; s.sw = null; s.move = null; raf(f); }; raf(f); });
    await bowUp(g);
    await g.frames(90);
    const m = await st(g), strike = await g.ev(() => window.__engine.game.scenes.play.state.foe.strike);
    t.ok('with the bow out a man keeps his own distance until he means to strike (no rush)', m.x > strike + 0.05, JSON.stringify({ m, strike }));
    await g.close();
  }

  // the two bow trials: Shrinking Target: bow scores with full draws and ends on three misses; the Apple Shot bursts fruit and a hit man ends it (OW!)
  {
    const g = await t.boot({ w: 844, h: 390, save: VET });
    const trial = async (id) => { await g.ev((id) => window.__engine.setScene('play', { trial: id }), id); await g.frames(120); };
    const rs = () => g.ev(() => { const s = window.__engine.game.scenes.play.state, r = s.range; return r ? { score: r.score, misses: r.misses, end: r.end, fruit: r.fruit && r.fruit.kind } : null; });
    const ended = () => g.until(() => window.__engine.scene === window.__engine.game.scenes.trials, 400);
    await trial('shrinkBow');
    for (let i = 0; i < 3; i++) { await bowShot(g, { hold: 75, x: 0.8, y: 0.7 }); await g.frames(50); }
    const hit = await rs();
    for (let i = 0; i < 3; i++) { await bowShot(g, { hold: 30, slide: -300, x: 0.8, y: 0.7 }); await g.frames(40); }
    const done1 = await ended(), rec1 = await g.ev(() => (window.__engine.save.get('trials', {}) || {}).shrinkBow);
    t.ok('Shrinking Target: bow: full draws hit the targets; three misses end it and its best is kept', hit && hit.score === 3 && done1 && rec1 && rec1.best === 3, JSON.stringify({ hit, done1, rec1 }));

    await trial('apple');
    await bowShot(g, { hold: 75, slide: -80, x: 0.8, y: 0.7 }); await g.frames(70);
    const fruit = await rs();
    await bowShot(g, { hold: 75, x: 0.8, y: 0.7 }); await g.frames(10);
    const said = await g.ev(() => window.__engine.game.scenes.play.state.pops.map((q) => q.s).join('|'));
    const done2 = await ended(), rec2 = await g.ev(() => (window.__engine.save.get('trials', {}) || {}).apple);
    t.ok('The Apple Shot: a shot over his head bursts the pumpkin and the watermelon comes next; a plain shot hits the man (OW!) and ends it, its best kept',
      fruit && fruit.score === 1 && fruit.fruit === 'watermelon' && /OW!/.test(said) && done2 && rec2 && rec2.best === 1, JSON.stringify({ fruit, said, done2, rec2 }));
    await g.close();
  }
}
