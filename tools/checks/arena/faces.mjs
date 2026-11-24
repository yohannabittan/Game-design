// Step 2026-11-21 (faces-and-women.md, Build 2): every fighter's face comes from origin and sex. Yours: each origin the wheel can land, a man's
// and a woman's (Sparta's women only), names face-<origin>-<m|f> and her body; every rolled fighter has a face painted for them. A foe's: every
// name and champion the gauntlets roll has a painted face, Mevia a woman's. The body's skin is tinted to the face on skin only: a skin pixel of the
// torso moves toward a Numidian's darker skin, a pixel of the belt does not.
import { boot } from '../exact.mjs';
import { VET } from '../arena.mjs';
import { scene } from '../scene.mjs';

export default async function (t) {
  const g = await boot({ w: 874, h: 402, save: VET });
  await scene(g, { kit: 'none', foe: 'Gannicus', tell: null });
  await g.frames(10);
  // yours, for every origin and sex once its paint is in: the face named, the head it draws, her body
  const origins = await g.ev(() => window.__engine.game.scenes.play.TUNING.me.wheels.origin.map((e) => e[0])), bad = [];
  for (const o of origins) for (const f of [false, true]) {
    await g.ev(([o, f]) => { const s = window.__engine.game.scenes.play.state; s.me.origin = o; s.me.female = f; s.you.lookSig = null; }, [o, f]);
    await g.until(() => { const P = window.__engine.game.scenes.play; return !!P.lookFor(P.state.you, false).kit; }, 600);
    const q = await g.ev(async () => {
      const P = window.__engine.game.scenes.play, lk = P.lookFor(P.state.you, false);
      return lk.kit ? { fk: lk.kit.fk, body: P.manArt(lk, lk.kit.tier, null, lk.kit.fk).body } : {};
    });
    const want = f ? `${o}-f` : o === 'sparta' ? '' : `${o}-m`, b = q.body || [];
    if (q.fk !== want) bad.push(`${o}/${f ? 'f' : 'm'}: face key ${q.fk}, want ${want}`);
    else if (want && b[0] !== `face-${want}`) bad.push(`${o}/${f ? 'f' : 'm'}: head ${b[0]}`);
    else if (f && !/-f-3q$/.test(b[1])) bad.push(`${o}/f: torso ${b[1]}`);
    else if (!f && /-f(-|$)/.test(b.join(' '))) bad.push(`${o}/m: a woman's part ${b.join(' ')}`);
  }
  const r = await g.ev(async ([origins]) => {
    const E = window.__engine, P = E.game.scenes.play, s = P.state, D = await import(new URL('src/draw-fight.js', location.href).href);
    const A = await import(new URL('src/data.js', location.href).href), G = await import(new URL('src/game.js', location.href).href);
    const has = (n) => E.art.has(n);
    // every fighter the wheels roll has a face painted for them (a Spartan is always a woman)
    const rolled = [];
    for (let seed = 1; seed < 400; seed++) { const me = G.rollMe(seed, origins); const k = D.meFace(me); if (!k || !has(`face-${k}`)) rolled.push(`${seed}:${me.origin}/${me.female}`); }
    // every foe's name and champion, in every arena's gauntlets
    const foes = new Set(), miss = [];
    for (const a of A.ARENAS) for (let seed = 1; seed < 60; seed++) for (const d of P.rollGauntlet(seed, null, a, null)) {
      if (d.beast) continue;
      for (const q of [d, d.pair].filter((q) => q && !q.beast)) { const k = D.foeFace(q); foes.add(`${q.name}=${k}`); if (!k || !has(`face-${k}`)) miss.push(`${q.name}:${k}`); }
    }
    const mevia = D.foeFace({ name: 'Mevia the Huntress', ck: 'mevia' });
    // the tint: on a Numidian man, the torso's skin darkens and its belt keeps its paint
    s.me.origin = 'numidia'; s.me.female = false; s.you.lookSig = null;
    const tier = D.lookFor(s.you, false).kit.tier, px = (pic, x, y) => {
      const c = new OffscreenCanvas(1, 1).getContext('2d'), J = pic.J;
      c.drawImage(pic.im, x * pic.im.width / J.size[0], y * pic.im.height / J.size[1], 1, 1, 0, 0, 1, 1); return [...c.getImageData(0, 0, 1, 1).data];
    };
    const T0 = D.kitPic('torso', tier, 0, ''), T1 = D.kitPic('torso', tier, 0, 'numidia-m'), J = T0.J;
    const skin = [J.a[0], 200], belt = [J.a[0], Math.round(J.skin + 20)];
    return { rolled, miss, foes: [...foes], mevia, s0: px(T0, ...skin), s1: px(T1, ...skin), b0: px(T0, ...belt), b1: px(T1, ...belt) };
  }, [origins]);
  t.ok('your face follows your origin and sex, a woman wears her body', !bad.length, bad.join(' | '));
  t.ok('every fighter the wheels roll has a painted face', !r.rolled.length, r.rolled.slice(0, 8).join(' '));
  t.ok('every foe and champion the gauntlets roll has a painted face', !r.miss.length && r.foes.length > 10, r.miss.slice(0, 8).join(' '));
  t.ok('Mevia wears a woman\'s face', r.mevia.endsWith('-f'), r.mevia);
  const lum = (p) => p[0] + p[1] + p[2];
  t.ok('a Numidian body\'s skin is darker than the painting, its belt unchanged', lum(r.s1) < lum(r.s0) * 0.8 && r.b0.every((v, i) => Math.abs(v - r.b1[i]) <= 2), JSON.stringify(r));
  await g.close();
}
