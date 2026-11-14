// Step 21: each weapon hits with its striking part, as cut, pierce or crush; the haft thuds. Your blows go through checkHits (the weapon laid
// through his bare head at a point along it) and land; his go through resolveSwing.
import { VET } from '../arena.mjs';

export default async function (t) {
  const g = await t.boot({ save: VET });
  const R = await g.ev(() => {
    const E = window.__engine, P = E.game.scenes.play, s = P.state, T = P.TUNING, R = {};
    const fight = (w, o = {}) => {
      const me = { ...P.kitMe(P.rollMe(777, []), w === 'mace' ? 'axe' : w, []), str: 3, mace: w === 'mace' };
      E.setScene('play', { seed: 777, arena: o.arena || 'pit', me });
      P.newRackAt(E, o.rack || 0);
      Object.assign(s, { intro: false, swingIn: 99, sw: null, plan: null, move: null, cover: null }); s.bout.foeShrug = true; s.hp = s.maxHp = 99;
      s.foe.hp = s.foe.maxHp = 999;
      return s.foe;
    };
    // the weapon held upright through his bare head, the head's top sFrac of the weapon's length down from the point
    const through = (w, kind, sFrac) => {
      const f = fight(w), head = f.parts.find((q) => q.d.id === 'head'); head.armour = false; f.parts = f.parts.filter((q) => q === head || !q.slot);
      for (const q of f.parts) q.cool = 0;
      const F = P.foeF(E), [cx, cy] = P.partCenter(F, f, head), L = P.myBlade(E), h = s.hand, tipY = cy - (head.d.r || head.d.h / 2) * F.H - sFrac * L;
      Object.assign(h, { hx: cx, hy: tipY + L, ux: cx, uy: tipY, phx: cx - 1, phy: tipY + L, pux: cx - 1, puy: tipY, vx: 0, vy: -1500, sp: 1500, lock: 0, atk: { kind, done: false } });
      Object.assign(s, { away: false, fallT: 0, lunging: false, pops: [] });
      const hp0 = f.hp; P.checkHits(E);
      return { dmg: +(hp0 - f.hp).toFixed(2), thud: s.pops.some((q) => q.s === 'THUD') };
    };
    R.geo = {};
    for (const w of ['gladius', 'dagger', 'spear', 'trident', 'sica', 'axe', 'mace', 'fist']) {
      const Z = T.strike[w], J = Z.pin ? Z : T.kit.weapon[w], top = J.top || 0, span = J.pin - top, r = {};
      const deep = Math.max(...[...Z.jab, ...Z.swing].map((q) => q[1]), 0);
      for (const [att, kind] of [['jab', 'jab'], ['swing', 'slash']]) {
        const z = Z[att][0];
        if (z) r[`${kind} part`] = through(w, kind, Math.max(0, (z[0] - top) / span + 0.25 * (z[1] - z[0]) / span));
        if (deep < J.pin) r[`${kind} haft`] = through(w, kind, (deep - top) / span + 0.8 * (1 - (deep - top) / span));
      }
      R.geo[w] = r;
    }
    // one blow landed on bare skin, a gap or a plate of a Colosseum foe, with the strike row i of the weapon's jab or swing (-1: the haft)
    const one = (w, att, i, what) => {
      const f = fight(w, { arena: 'rome', rack: 2 });
      let p = what === 'bare' ? f.parts.find((q) => !q.slot && !q.armour && !q.guard && q.d.id !== 'head') : what === 'gap' ? f.parts.find((q) => q.slot && !q.guard) : f.parts.find((q) => q.armour);
      if (!p && what === 'plate') { p = f.parts.find((q) => !q.slot && q.d.id === 'chest'); p.armour = true; p.dents = 0; }
      if (!p) return 'no target';
      p.cool = 0; Object.assign(s, { picks: [], bleed: [], cutAcc: 0.5, crushN: T.strike.crush.stagger - 1, stagger: 0 });
      const st = P.strikeOf(w, att, i), kind = att === 'jab' ? 'jab' : 'slash', [x, y] = P.partCenter(P.foeF(E), f, p);
      const hp0 = f.hp, d0 = p.dents || 0, g0 = s.slotHits;
      s.hand.atk = { kind }; P.land(E, { kind }, { p, at: { x, y, lx: p.d.x, ly: p.d.y }, ang: 0, sp: 1200, slit: true, st });
      return { dmg: +(hp0 - f.hp).toFixed(2), bleed: s.bleed.length, dents: +((p.dents || 0) - d0).toFixed(2), gap: s.slotHits - g0, stagger: s.stagger > 0 };
    };
    const vs = (w, att, i) => ({ bare: one(w, att, i, 'bare'), gap: one(w, att, i, 'gap'), plate: one(w, att, i, 'plate') });
    R.kinds = { cut: vs('gladius', 'swing', 0), sica: vs('sica', 'swing', 0), pierce: vs('gladius', 'jab', 0), spear: vs('spear', 'jab', 0), crush: vs('mace', 'swing', 0), fist: vs('fist', 'jab', 0), thud: vs('mace', 'jab', -1) };
    // his blows on you: his spear and his mace from inside their heads are a thud; his gladius from inside is not (all blade)
    const his = (w, mace, inside) => {
      fight('gladius', { rack: 1 });
      const f = s.foe; f.weapon = T.weapons.find((q) => q.id === w); f.mace = mace; f.home = f.weapon.range + f.size.reach; f.strike = f.weapon.strike + f.size.reach;
      s.you.parts.forEach((q) => { q.armour = false; });
      s.foot.pos = s.foot.tgt = 0; s.you.lungeK = 0; s.you.drive = 0; s.away = false; s.sh.held = false; s.sh.t = -1;
      s.step.x = f.strike - inside; s.hp = 50;
      P.startMove(E, P.buildMove(s.rng, 'thrust', { avoid: null, wind: 1, fixed: 0.5 }), false);
      s.pops = []; const hp0 = s.hp; P.resolveSwing(E);
      return { thud: !!s.sw.thud, lost: hp0 - s.hp };
    };
    R.his = { spearAtReach: his('spear', false, 0), spearInside: his('spear', false, 0.2), maceInside: his('axe', true, 0.2), gladiusInside: his('gladius', false, 0.2) };
    return R;
  });

  for (const [w, r] of Object.entries(R.geo)) {
    const bad = Object.entries(r).filter(([k, v]) => (k.endsWith('part') ? v.thud || !(v.dmg > 0) : !v.thud)).map(([k, v]) => `${k} ${JSON.stringify(v)}`);
    t.ok(`${w}: jab and slash land clean at the striking part, THUD at the haft`, !bad.length, `wrong: ${bad.join('; ')}`);
  }
  const k = R.kinds;
  t.ok('cut: bleeds on bare skin, glances off plate (no damage)', k.cut.bare.bleed > 0 && k.cut.plate.dmg === 0 && k.cut.plate.bleed === 0, JSON.stringify(k.cut));
  t.ok('sica: a cut that bleeds on skin', k.sica.bare.bleed > 0 && k.sica.bare.dmg > 0, JSON.stringify(k.sica.bare));
  t.ok('pierce: the gap bonus in a gap (more than on skin), nothing on plate', k.pierce.gap.gap === 1 && k.pierce.gap.dmg > k.pierce.bare.dmg && k.pierce.plate.dmg === 0 && k.spear.gap.gap === 1, JSON.stringify({ gladius: k.pierce, spearGap: k.spear.gap }));
  t.ok('crush: dents plate and staggers, never bleeds', k.crush.plate.dents > 0 && k.crush.plate.stagger && k.crush.bare.bleed === 0 && k.crush.gap.gap === 0, JSON.stringify(k.crush));
  t.ok('fists: crush that staggers but never dents', k.fist.plate.dents === 0 && k.fist.bare.stagger, JSON.stringify(k.fist));
  t.ok('thud: a quarter of the blow, no bleed, dent, gap bonus or stagger', k.thud.bare.dmg > 0 && k.thud.bare.dmg < k.crush.bare.dmg / 2 && ['bare', 'gap', 'plate'].every((q) => !k.thud[q].bleed && !k.thud[q].dents && !k.thud[q].gap && !k.thud[q].stagger), JSON.stringify(k.thud));
  t.ok("his spear or mace from inside its head thuds on you; his spear's point at reach and his gladius from inside don't", R.his.spearInside.thud && R.his.maceInside.thud && !R.his.spearAtReach.thud && !R.his.gladiusInside.thud && R.his.spearAtReach.lost > R.his.spearInside.lost, JSON.stringify(R.his));
}
