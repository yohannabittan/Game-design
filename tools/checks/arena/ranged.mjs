// Steps 22, 22b, 24 and 27: the sidearm, the knives and the bow. The swaps by the ⇄ button, blocks by the shield buttons, draws and throws by the
// right thumb (step 27's throw by angle in detail: knife.mjs), all on exact frames; where a knife or an arrow lands is resolved in the page (knifeLands, arrowLands).
import { VET } from '../arena.mjs';
import { bout, still } from '../exact.mjs';

const W = 844, H = 390;
const words = (g) => g.ev(() => window.__engine.game.scenes.play.state.pops.map((q) => q.s).filter((q) => !/^[\d.+-]/.test(q)).join('|'));
const btn = (g, k) => g.ev((k) => { const E = window.__engine, b = E.game.scenes.play.armsBtns(E); return b && b[k]; }, k);
// press HIGH for two frames: did the shield come up?
async function tryBlock(g) {
  const b = await g.ev(() => { const E = window.__engine, b = E.game.scenes.play.shieldBtns(E)[0]; return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; });
  await g.ev(() => { window.__engine.game.scenes.play.state.pops = []; });
  await g.down(b.x, b.y, 3); await g.frames(2);
  const r = await g.ev(() => window.__engine.game.scenes.play.raised());
  await g.up(b.x, b.y, 3); await g.frames(2);
  return r;
}
const swapT = (g) => g.ev(() => +window.__engine.game.scenes.play.state.swapT.toFixed(3));

export default async function (t) {
  const g = await t.boot({ w: W, h: H, save: VET });

  // the sidearm: ⇄ takes 0.5 s, the shield can't come up in it, and after it the spear is in hand and a block works
  await bout(g, { w: 'gladius', side: 'spear', kit: ['chest'], arena: 'city', rack: 1 });
  await still(g);
  await g.frames(5);
  const sw = await btn(g, 'swap');
  await g.tap(sw.x, sw.y, 8);
  // (the tap's down starts it, three frames ago)
  const during = [await swapT(g), await tryBlock(g)];
  await g.frames(Math.round((await swapT(g)) * 60) - 2);
  const at = await swapT(g);
  await g.frames(4);
  const after = await g.ev(() => { const s = window.__engine.game.scenes.play.state; return { swapT: s.swapT, weapon: s.me.weapon, side: s.me.side }; });
  const blockAfter = await tryBlock(g);
  t.ok("the sidearm's swap takes 0.5 s, can't block, then the spear is in hand and blocks work", Math.abs(during[0] + 3 / 60 - 0.5) < 1e-3 && !during[1] && at > 0 && after.swapT === 0 && after.weapon === 'spear' && after.side === 'gladius' && blockAfter,
    JSON.stringify({ swapT0: during[0], blockedDuring: during[1], twoFramesBefore: at, after, blockAfter }));

  // knives: one in a gap wounds for knives.dmg, on plate and in the air for nothing
  await bout(g, { w: 'gladius', kit: ['chest'], arena: 'city', rack: 1, knives: 6 });
  const kn = await g.ev(() => { const E = window.__engine, P = E.game.scenes.play, s = P.state, f = s.foe; s.aim = null; s.cover = null;
    const q = f.parts.find((p) => p.slot && !p.guard), [x, y] = P.partCenter(P.foeF(E), f, q), h0 = f.hp;
    P.knifeLands(E, { x0: x - 200, y0: y, x1: x, y1: y }); const gap = h0 - f.hp;
    const c = f.parts.find((p) => !p.slot && p.d.id === 'chest'); c.armour = true; s.cover = null; c.cool = 0; const [cx, cy] = P.partCenter(P.foeF(E), f, c), h1 = f.hp;
    P.knifeLands(E, { x0: cx - 200, y0: cy, x1: cx, y1: cy }); const plate = h1 - f.hp;
    const h2 = f.hp; P.knifeLands(E, { x0: 0, y0: 50, x1: 300, y1: 60 });
    return { gap, plate, miss: h2 - f.hp, dmg: P.TUNING.knives.dmg }; });
  t.ok('a knife in a gap wounds for knives.dmg; on plate or a miss, nothing', kn.gap === kn.dmg && kn.plate === 0 && kn.miss === 0, JSON.stringify(kn));

  // step 27, one press: KNIFE held raises a knife and throws nothing while the thumb stays down (slid wherever); its release throws it, spent
  await bout(g, { w: 'gladius', kit: ['chest'], arena: 'city', rack: 1, knives: 3 });
  await g.ev(() => { window.__engine.save.set('knifeHint', 1); });
  await still(g);
  await g.frames(5);
  const kb = await btn(g, 'knife');
  await g.down(kb.x, kb.y, 21); await g.frames(10); await g.move(kb.x - 30, kb.y - 120, 21); await g.frames(30);
  const k1 = await g.ev(() => { const s = window.__engine.game.scenes.play.state; return { knives: s.knives, thrown: s.knivesThrown, aim: !!s.aim }; });
  await g.up(kb.x - 30, kb.y - 120, 21); await g.frames(40);
  const k2 = await g.ev(() => { const s = window.__engine.game.scenes.play.state; return { knives: s.knives, thrown: s.knivesThrown, aim: !!s.aim }; });
  t.ok('KNIFE held raises a knife and throws nothing while held; the release throws it, and it is spent', k1.knives === 3 && k1.thrown === 0 && k1.aim && k2.knives === 2 && k2.thrown === 1 && !k2.aim, JSON.stringify({ held: k1, released: k2 }));

  // the bow: ⇄ takes 0.7 s, the shield can't come up in it or after it; any release looses (2026-11-21: a short one weaker, inside his reach too)
  await bout(g, { w: 'gladius', side: 'bow', kit: ['chest'], rack: 1 });
  await g.ev(() => { const s = window.__engine.game.scenes.play.state; s.foe.hp = s.foe.maxHp = 999; });
  const home = await g.ev(() => window.__engine.game.scenes.play.state.foe.home + 0.6);
  await still(g, home);
  await g.frames(5);
  const bs = await btn(g, 'swap');
  await g.tap(bs.x, bs.y, 8);
  const b0 = [await swapT(g), await tryBlock(g)];
  await g.frames(Math.round((await swapT(g)) * 60) - 2);
  const b1 = await g.ev(() => { const s = window.__engine.game.scenes.play.state; return { swapT: +s.swapT.toFixed(3), bowOut: s.bowOut }; });
  await g.frames(4);
  const b2 = await g.ev(() => { const P = window.__engine.game.scenes.play, s = P.state; return { swapT: s.swapT, bowOut: s.bowOut, shown: P.bowShown() }; });
  const b3 = await tryBlock(g), said = await words(g);
  t.ok("the bow's swap takes 0.7 s; the shield can't come up during it or with the bow out (OPEN)", Math.abs(b0[0] + 3 / 60 - 0.7) < 1e-3 && !b0[1] && b1.swapT > 0 && b2.swapT === 0 && b2.bowOut && b2.shown && !b3 && /OPEN/.test(said), JSON.stringify({ start: b0, twoFramesBefore: b1, after: b2, blockWithBow: b3, said }));

  const aimAt = await g.ev(() => { const E = window.__engine, P = E.game.scenes.play, F = P.foeF(E); return [Math.round(F.x), Math.round(F.y - 0.6 * F.H) + 50]; });
  const x0 = Math.round(W * 0.72), y0 = Math.round(H * 0.7);
  const draw = async (frames) => {
    await g.ev(() => { const s = window.__engine.game.scenes.play.state; s.pops = []; window.__a0 = s.arrows; });
    await g.stroke(x0, y0, [[0, 0, 0], [6, aimAt[0] - x0, aimAt[1] - y0], [frames, aimAt[0] - x0, aimAt[1] - y0]], 71);
    await g.frames(3);
    return g.ev(() => { const s = window.__engine.game.scenes.play.state; return { loosed: s.arrows - window.__a0, said: s.pops.map((q) => q.s).filter((q) => !/^[\d.+-]/.test(q)).join('|') }; });
  };
  const soon = await draw(Math.round(0.3 * 60)), full = await draw(Math.round(0.75 * 60));
  t.ok('a release before the full draw looses an arrow all the same; so does a full draw', soon.loosed === 1 && !/TOO/.test(soon.said) && full.loosed === 1, JSON.stringify({ soon, full }));
  await g.frames(60);
  await still(g, await g.ev(() => window.__engine.game.scenes.play.state.foe.strike - 0.05));
  await g.frames(5);
  const close = await draw(Math.round(0.75 * 60));
  t.ok('inside his reach a draw still looses (never TOO CLOSE)', close.loosed === 1 && !/TOO/.test(close.said), JSON.stringify(close));

  // where an arrow lands, at a full draw: a gap for bow.gap x bow.power times the plain gap hit, skin for a stagger, plate for nothing
  const lands = await g.ev(() => {
    const E = window.__engine, P = E.game.scenes.play, s = P.state, R = { plainGap: P.plainGap(), mult: P.TUNING.bow.gap * P.TUNING.bow.power };
    const one = (what) => {
      const f = s.foe; f.hp = 999; s.stagger = 0; s.openAll = what === 'gap' ? 5 : 0; s.cover = null;
      for (const q of f.parts) { q.cool = 0; if (q.guard) q.guard = false; }
      const p = what === 'gap' ? f.parts.find((q) => q.slot && !q.cut) : what === 'skin' ? f.parts.find((q) => !q.slot && !q.armour && !q.cut && !['head', 'armB', 'armF'].includes(q.d.id)) : f.parts.find((q) => q.armour);
      if (!p) return 'no target';
      const [x, y] = P.partCenter(P.foeF(E), f, p), hp0 = f.hp; s.pops = [];
      P.arrowLands(E, { x0: x - 200, y0: y, x1: x, y1: y, pw: 1 });
      return { dmg: +(hp0 - f.hp).toFixed(2), stagger: s.stagger > 0 };
    };
    for (const w of ['gap', 'skin', 'plate']) R[w] = one(w);
    return R;
  });
  t.ok('an arrow in a gap at full power does bow.gap x bow.power times the plain gap hit', lands.gap.dmg > 0 && Math.abs(lands.gap.dmg - Math.round(lands.plainGap * lands.mult * 2) / 2) < 0.01, JSON.stringify(lands));
  t.ok('an arrow on bare skin staggers him; on plate it does nothing', lands.skin.stagger && lands.skin.dmg > 0 && lands.plate.dmg === 0 && !lands.plate.stagger, JSON.stringify({ skin: lands.skin, plate: lands.plate }));
}
