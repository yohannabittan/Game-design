// Steps 23, 22, 22b and 24: the purse before bout 1, by taps: the first run's kit; Fight! with no plate asks "No plates?" (Buy a plate, Fight bare);
// knives one at a time up to the cap (and at the bandage stall); the reinforced shield (manica) lasts 9 blocks, not 6.
import { VET, FRESH } from '../arena.mjs';

const W = 667, H = 375;
// the purse open, ready for taps; o sets its fields (w, kit, gold, knives)
async function toPurse(g, arena = 'pit', o = null) {
  await g.ev(([arena, o]) => { const E = window.__engine; E.setScene('roll', { seed: 777, arena }); const R = E.game.scenes.roll; R.at(8); R.cardT = 1; R.openPurse(E); R.purse.t = 1; if (o) Object.assign(R.purse, o); }, [arena, o]);
  await g.frames(5);
}
const purse = (g) => g.ev(() => { const P = window.__engine.game.scenes.roll.purse; return P && { w: P.w, kit: P.kit.slice(), gold: P.gold, knives: P.knives, ask: !!P.ask, pulse: P.pulse >= 0, fight: P.fight, krow: P.krow, askBtns: P.ask && P.ask.buy ? { buy: P.ask.buy, bare: P.ask.bare } : null }; });

export default async function (t) {
  // the first run's kit
  {
    const g = await t.boot({ w: W, h: H, save: FRESH });
    await toPurse(g);
    const p = await purse(g), cost = await g.ev(() => window.__engine.game.scenes.play.purseCost('gladius', ['chest'], false, null, 0));
    t.ok('the first run opens the purse with a gladius and a chest plate, 30 of 45 gold', p.w === 'gladius' && p.kit.join() === 'chest' && p.gold === 45 && cost === 30, JSON.stringify({ ...p, fight: undefined, krow: undefined, cost }));
  }
  const g = await t.boot({ w: W, h: H, save: VET });
  // "No plates?": Fight! bare asks; Buy a plate goes back with a slot pulsing; a plate bought then fights without asking
  {
    await toPurse(g, 'pit', { w: 'gladius', kit: [] });
    let p = await purse(g);
    await g.tapRect(p.fight); await g.frames(5);
    const asked = await purse(g);
    await g.tapRect(asked.askBtns.buy); await g.frames(5);
    const back = await purse(g);
    t.ok('Fight! with no plate asks "No plates?"; Buy a plate goes back to the purse with a plate slot pulsing', asked.ask && !back.ask && back.pulse, JSON.stringify({ asked: asked.ask, back: { ask: back.ask, pulse: back.pulse } }));
    const slot = await g.ev(() => window.__engine.game.scenes.roll.purse.slots.find((q) => q.plate === 'chest'));
    await g.tapRect(slot); await g.frames(5);
    p = await purse(g);
    await g.tapRect(p.fight); await g.frames(10);
    const sc = await g.ev(() => ({ scene: window.__engine.sceneName, buy: window.__engine.game.scenes.play.state.buy }));
    t.ok('with a plate bought, Fight! starts the bout without asking', p.kit.includes('chest') && sc.scene === 'play' && /chest/.test(sc.buy), JSON.stringify({ kit: p.kit, ...sc }));
  }
  {
    await toPurse(g, 'pit', { w: 'gladius', kit: [] });
    const p = await purse(g);
    await g.tapRect(p.fight); await g.frames(5);
    const a = await purse(g);
    await g.tapRect(a.askBtns.bare); await g.frames(10);
    const sc = await g.ev(() => ({ scene: window.__engine.sceneName, buy: window.__engine.game.scenes.play.state.buy }));
    t.ok('Fight bare starts the bout with no plate, asked only the once', a.ask && sc.scene === 'play' && /gladius,none/.test(sc.buy), JSON.stringify(sc));
  }
  // knives: + up to the cap with gold to spare; only what the gold covers; the bandage stall's row stops at the cap too
  {
    await toPurse(g, 'city', { w: 'fist', kit: [], knives: 0, gold: 200 });
    const p = await purse(g), seen = [];
    for (let i = 0; i < 8; i++) { await g.tapRect(p.krow.plus); seen.push((await purse(g)).knives); }
    const max = await g.ev(() => window.__engine.game.scenes.play.TUNING.knives.max);
    t.eq('the purse sells knives one a tap, up to the cap', seen, [1, 2, 3, 4, 5, 6, 6, 6].map((n) => Math.min(n, max)));
    await toPurse(g, 'city', { w: 'fist', kit: [], knives: 0, gold: 20 });
    const q = await purse(g), few = [];
    for (let i = 0; i < 4; i++) { await g.tapRect(q.krow.plus); few.push((await purse(g)).knives); }
    t.eq('with 20 gold the purse sells two knives at 8, then refuses', few, [1, 2, 2, 2]);
    await g.ev(() => { const E = window.__engine, P = E.game.scenes.play;
      const me = { ...P.kitMe(P.rollMe(777, []), 'gladius', ['chest']), str: 3 };
      E.setScene('play', { seed: 3, arena: 'city', me, buy: 'x', gold: 100, knives: 4 }); const s = P.state; s.intro = false; s.hp = s.maxHp - 2; P.openBandage(E); s.tent.t = 1; });
    await g.frames(5);
    const r = await g.ev(() => { const t = window.__engine.game.scenes.play.state.tent; return t && t.krow && t.krow.plus; });
    if (r) for (let i = 0; i < 4; i++) await g.tapRect(r);
    const st = await g.ev(() => { const s = window.__engine.game.scenes.play.state; return { knives: s.knives, gold: s.gold }; });
    t.eq('the bandage stall sells knives up to the cap, 8 gold each', st, { knives: max, gold: 100 - (max - 4) * 8 });
  }
  // the reinforced shield: plain blocks of his gladius until the shield breaks
  {
    const brk = (kit) => g.ev((kit) => {
      const E = window.__engine, P = E.game.scenes.play, s = P.state;
      const me = { ...P.kitMe(P.rollMe(777, []), 'gladius', kit), str: 3, origin: 'capua' }; E.setScene('play', { seed: 4, arena: 'pit', me }); P.newRackAt(E, 1); s.intro = false; s.hp = s.maxHp = 999;
      const f = s.foe; f.weapon = P.TUNING.weapons.find((q) => q.id === 'gladius'); f.mace = false;
      let n = 0;
      for (; n < 20 && !s.sh.broken; n++) {
        s.foot.pos = s.foot.tgt = 0; s.step.x = f.strike - 0.05; s.away = false; s.you.lungeK = 0;
        P.startMove(E, P.buildMove(s.rng, 'thrust', { avoid: null, wind: 1, fixed: 0.5 }), false);
        Object.assign(s.sh, { held: true, hid: 9, t: 5, arm: 0, zone: s.sw.zone, cool: 0 });
        P.resolveSwing(E); s.sw = null; s.move = null;
      }
      return n;
    }, kit);
    t.eq('the shield breaks at the 6th block, the reinforced shield at the 9th', { plain: await brk(['chest']), reinforced: await brk(['chest', 'manica']) }, { plain: 6, reinforced: 9 });
  }
}
