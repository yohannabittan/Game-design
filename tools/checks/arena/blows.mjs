// Step "honest blows" (2026-11-14): knives hurt (12 in a gap, 4 on bare skin with a mark, nothing on plate); the sica's point stabs (a push is a
// gap hit or a skin wound at three quarters of a gladius jab, never a THUD); a blow that does nothing shows no blood and says why, and a slash on
// plate always has a word; a barded lion or bear wears plate on its head and chest only.
import { VET } from '../arena.mjs';

export default async function (t) {
  const g = await t.boot({ save: VET, w: 874, h: 402 });
  const R = await g.ev(() => {
    const E = window.__engine, P = E.game.scenes.play, s = P.state, T = P.TUNING, R = {};
    const fight = (w, o = {}) => {
      const me = { ...P.kitMe(P.rollMe(777, []), w, []), str: 3 };
      E.setScene('play', { seed: o.seed || 777, arena: o.arena || 'rome', me });
      P.newRackAt(E, o.rack == null ? 2 : o.rack);
      Object.assign(s, { intro: false, swingIn: 99, sw: null, plan: null, move: null, cover: null, picks: o.picks || [], bleed: [], pops: [] }); s.bout.foeShrug = true; s.hp = s.maxHp = 99;
      s.foe.hp = s.foe.maxHp = 999;
      for (const q of s.foe.parts) { q.cool = 0; q.guard = false; }
      return s.foe;
    };
    const bare = (f) => f.parts.find((q) => !q.slot && !q.armour && q.d.id !== 'head');
    const gap = (f) => f.parts.find((q) => q.slot);
    const plate = (f) => { const p = f.parts.find((q) => !q.slot && q.d.id === 'chest'); p.armour = true; p.dents = 0; return p; };
    const words = () => s.pops.map((q) => q.s).filter((q) => !/^[\d.+-]/.test(q));
    const drops = () => s.fx.filter((q) => q.k === 'b').length;

    // 1. knives, each through knifeLands at the part's middle
    const knife = (pick, picks) => {
      const f = fight('gladius', { picks }), p = pick(f), [x, y] = P.partCenter(P.foeF(E), f, p), h0 = f.hp, c0 = [s.knifeGaps, s.knifeSkin, s.knifePlate, s.knifeMiss], n0 = p.gashes.length;
      s.fx = []; s.pops = []; E._shake = { amt: 0, t: 0, dur: 0 };
      P.knifeLands(E, { x0: x - 200, y0: y, x1: x, y1: y });
      return { dmg: h0 - f.hp, count: [s.knifeGaps, s.knifeSkin, s.knifePlate, s.knifeMiss].map((v, i) => v - c0[i]), mark: p.gashes.length - n0, drops: drops(), shake: E._shake.t > 0, words: words() };
    };
    R.knife = { gap: knife(gap), skin: knife(bare), plate: knife(plate), haem: knife(bare, ['haem']), dmg: T.knives.dmg, skinDmg: T.knives.skin };
    { const f = fight('gladius'), h0 = f.hp, m0 = s.knifeMiss; P.knifeLands(E, { x0: 0, y0: 50, x1: 300, y1: 60 }); R.knife.miss = { dmg: h0 - f.hp, count: s.knifeMiss - m0 }; }

    // 2. one blow through land, with the weapon's first jab row, at Strength 3
    const one = (w, pick, kind = 'jab', picks = []) => {
      const f = fight(w, { picks }), p = pick(f), [x, y] = P.partCenter(P.foeF(E), f, p), st = P.strikeOf(w, kind === 'jab' ? 'jab' : 'swing', 0), h0 = f.hp, g0 = s.slotHits, d0 = p.dents;
      s.fx = []; s.pops = []; s.hand.atk = { kind }; E._shake = { amt: 0, t: 0, dur: 0 };
      P.land(E, { kind }, { p, at: { x, y, lx: p.d.x, ly: p.d.y }, ang: 0, sp: 1200, slit: true, st });
      return { dmg: h0 - f.hp, gap: s.slotHits - g0, dents: p.dents - d0, bleed: s.bleed.length, drops: drops(), shake: E._shake.t > 0, words: words() };
    };
    R.jab = { sica: { gap: one('sica', gap), skin: one('sica', bare) }, gladius: { gap: one('gladius', gap), skin: one('gladius', bare) } };
    // a level push of the sica, through checkHits: the blade laid level through his waist's gap, point first
    {
      const f = fight('sica'), p = f.parts.find((q) => q.d.id === 'slot-waist'), F = P.foeF(E), [cx, cy] = P.partCenter(F, f, p), L = P.myBlade(E), h = s.hand;
      s.openAll = 1; f.parts = f.parts.filter((q) => q === p || !q.slot);
      const tx = cx + 4, hx = tx - L;
      Object.assign(h, { hx, hy: cy, ux: tx, uy: cy, phx: hx - 40, phy: cy, pux: tx - 40, puy: cy, vx: 1500, vy: 0, sp: 1500, lock: 0, atk: { kind: 'jab', done: false } });
      Object.assign(s, { away: false, fallT: 0, lunging: false, pops: [] });
      const h0 = f.hp, g0 = s.slotHits; P.checkHits(E);
      R.push = { dmg: h0 - f.hp, gap: s.slotHits - g0, words: words() };
    }

    // 3. Haemorrhage on bare skin, and a slash on plate that dents and one that doesn't (the trident's swing is a point: it never dents)
    R.haem = one('gladius', bare, 'slash', ['haem']);
    R.dent = one('gladius', plate, 'slash');
    R.glance = one('trident', plate, 'slash');

    // 4. Rome's fourth bout: the barded bear (seed 1) and lion (seed 2) side-on; what a point meets, by knifeAt with no pad
    const pad = T.knives.pad; T.knives.pad = 0;
    for (const [kind, seed] of [['bear', 1], ['lion', 2]]) {
      const f = fight('gladius', { seed, rack: 3 }), F = P.foeF(E), at = (x, y) => P.knifeAt(E, x, y).kind;
      const pts = f.parts.filter((q) => !q.slot).map((q) => P.partCenter(F, f, q)), x0 = Math.min(...pts.map((q) => q[0])) - F.H * 0.3, x1 = Math.max(...pts.map((q) => q[0])) + F.H * 0.3;
      const y0 = Math.min(...pts.map((q) => q[1])) - F.H * 0.3, y1 = Math.max(...pts.map((q) => q[1])) + F.H * 0.3, n = { plate: 0, skin: 0, gap: 0 };
      for (let x = x0; x < x1; x += 2) for (let y = y0; y < y1; y += 2) { const k = at(x, y); if (k !== 'miss') n[k]++; }
      const tot = n.plate + n.skin + n.gap, belly = f.parts.find((q) => q.d.id === 'belly'), [, by] = P.partCenter(F, f, belly), front = f.dir == null ? F.dir : f.dir;
      // a level slash from his front (the side facing you) at belly height: the first thing it meets
      const first = [];
      for (const dy of [-0.03, 0, 0.03]) { const y = by + dy * F.H; let k = 'miss'; for (let x = x0; x < x1 && k === 'miss'; x += 1) k = at(x, y); first.push(k); }
      R[kind] = { plate: n.plate / tot, open: (n.skin + n.gap) / tot, first, barded: f.armour, plated: f.parts.filter((q) => q.armour).map((q) => q.d.id), front };
    }
    T.knives.pad = pad;
    return R;
  });

  const k = R.knife, same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  t.ok('a knife in a gap takes 12, on bare skin 4 with a mark, on plate and in the air nothing', k.dmg === 12 && k.skinDmg === 4 && k.gap.dmg === 12 && k.skin.dmg === 4 && k.skin.mark > 0 && k.skin.drops > 0 && k.plate.dmg === 0 && k.miss.dmg === 0, JSON.stringify(k));
  t.ok('the run log counts one knife each in gap, skin, plate and miss', same(k.gap.count, [1, 0, 0, 0]) && same(k.skin.count, [0, 1, 0, 0]) && same(k.plate.count, [0, 0, 1, 0]) && k.miss.count === 1, JSON.stringify({ gap: k.gap.count, skin: k.skin.count, plate: k.plate.count, miss: k.miss.count }));
  t.ok('with Haemorrhage a knife on bare skin takes nothing, shows no blood or shake and says NO BITE', k.haem.dmg === 0 && k.haem.drops === 0 && !k.haem.shake && k.haem.mark === 0 && k.haem.words.includes('NO BITE'), JSON.stringify(k.haem));

  const j = R.jab, rg = j.sica.gap.dmg / j.gladius.gap.dmg, rs = j.sica.skin.dmg / j.gladius.skin.dmg;
  t.ok("the sica's push at Strength 3 is a gap hit at 70-80% of a gladius jab's, and a skin wound at the same share; no THUD", j.sica.gap.gap === 1 && rg >= 0.7 && rg <= 0.8 && rs >= 0.7 && rs <= 0.8 && !j.sica.gap.words.includes('THUD') && !j.sica.skin.words.includes('THUD'), JSON.stringify({ rg, rs, ...j }));
  t.ok('a level push of the sica into an open gap goes in point first (a gap hit, no THUD)', R.push.gap === 1 && R.push.dmg > 0 && !R.push.words.includes('THUD'), JSON.stringify(R.push));

  t.ok('with Haemorrhage a slash on bare skin shows no blood, no shake, and says NO BITE', R.haem.dmg === 0 && R.haem.drops === 0 && !R.haem.shake && R.haem.words.includes('NO BITE'), JSON.stringify(R.haem));
  t.ok('a slash on plate always has a word: DENTED when it dents, GLANCES OFF (and no shake) when it does nothing', R.dent.dents > 0 && R.dent.words.includes('DENTED') && R.glance.dents === 0 && !R.glance.shake && R.glance.words.includes('GLANCES OFF') && !R.glance.words.includes('DENTED'), JSON.stringify({ dent: R.dent, glance: R.glance }));

  for (const kind of ['bear', 'lion']) {
    const b = R[kind];
    t.ok(`Rome bout 4, barded ${kind}: plate on head and chest only, at least 40% of it side-on is hide or gap, and a level slash at belly height from the front meets hide or a gap`,
      b.barded && same(b.plated.sort(), ['chest', 'head']) && b.open >= 0.4 && b.first.every((q) => q === 'skin' || q === 'gap'), JSON.stringify(b));
  }
}
