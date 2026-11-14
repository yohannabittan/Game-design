// Step 2026-11-14 (your spear is as long as his, and the grip slides): your spear is drawn as long as a same-size foe's; when he is inside its point it
// chokes up, the shaft sliding back through your fist so a push lands point first: of 20 varied thumb strokes from a spearman's stand-off and from a
// swordsman's, at least 14 land clean and no more than 2 thud (a lean fighter's at least 10 against the spearman); the slide never jumps from one frame
// to the next as he steps in; at full lunge with a spear or a trident both points stay on screen and clear of the left column, open and at either wall.
import { VET } from '../arena.mjs';

// the 20 strokes the step's table was counted with: yard-style jabs, quick pushes, a slow aim then a push, short pushes, at five heights each
const STROKES = [];
for (const dy of [0, 10, 20, 30, 40]) {
  STROKES.push([[0, 0, 0], [6, -12, 4 + dy], [9, 30, -4 + dy], [14, 30, -4 + dy]]);
  STROKES.push([[0, 0, 0], [3, 40, dy], [6, 40, dy]]);
  STROKES.push([[0, 0, 0], [30, -12, dy], [45, -12, dy], [48, 30, dy - 8], [53, 30, dy - 8]]);
  STROKES.push([[0, 0, 0], [8, 0, dy], [11, 18, dy], [15, 18, dy]]);
}

// a bout in the Colosseum: you (medium, or the size given) with the weapon against a medium man with his weapon, bare, never swinging, the gap
// pinned at his own stand-off (or the gap given, H); window.__rec, when set, gathers each frame's landing, thud, lunge and the slide (px)
const setup = (g, o) => g.ev((o) => {
  const E = window.__engine, P = E.game.scenes.play, T = P.TUNING;
  let me = P.rollMe(777, []); me.idx = me.idx.slice(); me.idx[0] = T.me.wheels.size.findIndex((e) => e[0] === (o.size || 'medium'));
  me = { ...P.kitMe(me, o.w, ['chest']), str: 3, origin: 'capua' };
  E.setScene('play', { seed: 777, arena: 'rome', me, buy: 'x', gold: 0 });
  P.newRackAt(E, 0);
  const s = P.state, f = s.foe, W = T.weapons.find((q) => q.id === o.his);
  Object.assign(s, { intro: false, hp: 99, maxHp: 99 }); s.bout.foeShrug = true;
  f.hp = f.maxHp = 999; f.size = { ...T.sizes.find((q) => q.id === 'medium') };
  f.weapon = W; f.wname = W.name; f.home = W.range; f.strike = W.strike; f.shield = false; s.cam = null;
  window.__gap = o.gap == null ? f.home : o.gap;
  if (!window.__pin) {
    window.__pin = 1; const raf = window.requestAnimationFrame;
    const lp = () => { const s = P.state; if (s && s.foe) { Object.assign(s, { swingIn: 99, sw: null, plan: null, cover: null, stamina: s.staMax }); s.step.x = s.step.tgt = window.__gap; if (window.__rec) window.__rec.push({ l: s.landM, thud: s.pops.some((q) => q.s === 'THUD'), lunge: s.lunging || s.you.lungeK > 0.05, sl: (s.hand.sl || 0) * P.myBlade(E) }); } raf(lp); };
    raf(lp);
  }
  return { home: f.home };
}, o);
// one stroke: 'H' clean, 't' a thud on the haft, '.' a miss, 'L' it lunged
async function stroke(g, keys) {
  await g.frames(30);
  await g.ev(() => { window.__rec = []; });
  await g.stroke(g.w * 0.7, g.h * 0.42, keys);
  await g.frames(20);
  const r = await g.ev(() => { const r = window.__rec; window.__rec = null; return r; });
  if (r.some((q) => q.lunge)) return 'L';
  const i = r.findIndex((q) => q.l !== r[0].l);
  return i < 0 ? '.' : r[i].thud ? 't' : 'H';
}

export default async function (t) {
  // 1. drawn as long as his (the same painting, so fist to point decides it), and the trident still longer by its old share (1.5 / 1.35)
  {
    const g = await t.boot({ w: 874, h: 402, save: VET });
    await setup(g, { w: 'spear', his: 'spear' }); await g.frames(10);
    const r = await g.ev(() => { const E = window.__engine, P = E.game.scenes.play, T = P.TUNING, s = P.state; return { mine: P.myBlade(E), his: (s.foe.weapon.len + T.kit.weapon.spear.tip) * P.foeF(E).H, share: T.me.weapons.trident.reach / T.me.weapons.spear.reach }; });
    t.ok('a medium spear is drawn within 10% of a medium spear foe\'s', Math.abs(r.mine / r.his - 1) <= 0.1, JSON.stringify(r));
    t.ok('the trident is still longer than the spear by its old share (about 1.11x)', Math.abs(r.share - 1.5 / 1.35) < 0.02, JSON.stringify(r));
  }
  // 2 and 3. the 20 strokes at 874x402: medium against a spearman and a swordsman at their stand-offs, lean against the spearman
  {
    const g = await t.boot({ w: 874, h: 402, save: VET });
    for (const [size, his, min] of [['medium', 'spear', 14], ['medium', 'gladius', 14], ['lean', 'spear', 10]]) {
      let line = '';
      for (const keys of STROKES) { await setup(g, { w: 'spear', his, size }); line += await stroke(g, keys); }
      const n = (c) => line.split(c).length - 1;
      t.ok(`874x402: of 20 thumb strokes a ${size} spear lands at least ${min} clean on a ${his === 'spear' ? 'spearman' : 'swordsman'} at his stand-off, at most 2 on the haft`, n('H') >= min && n('t') <= 2, line);
    }
  }
  // 4. the slide is smooth: as he steps in from beyond your point to close, your fist never jumps along the shaft from one frame to the next
  {
    const g = await t.boot({ w: 874, h: 402, save: VET });
    await setup(g, { w: 'spear', his: 'spear', gap: 0.9 });
    await g.frames(30);
    await g.ev(() => { window.__rec = []; });
    for (let x = 0.9; x >= 0; x -= 0.02) { await g.ev((x) => { window.__gap = x; }, x); await g.frames(1); }
    await g.frames(30);
    const r = await g.ev(() => { const r = window.__rec; window.__rec = null; return r; });
    let jump = 0; for (let i = 1; i < r.length; i++) jump = Math.max(jump, Math.abs(r[i].sl - r[i - 1].sl));
    const slid = r[r.length - 1].sl - r[0].sl;
    t.ok('as a spearman steps in from beyond your point the spear slides back through your fist, never more than 6 px in a frame', slid > 40 && jump <= 6, JSON.stringify({ slid: Math.round(slid), jump: +jump.toFixed(1) }));
  }
  // 5. a full lunge (before any drive) with a spear and a trident: your point, and his at its full length ahead of him, on screen and right of the
  // left column, in the open and at either wall
  for (const [w, h] of [[667, 375], [874, 402]]) {
    const g = await t.boot({ w, h, save: VET });
    const bad = [];
    for (const wid of ['spear', 'trident']) for (const where of ['open', 'mine', 'his']) {
      await setup(g, { w: wid, his: 'spear' });
      await g.ev((where) => { const E = window.__engine, P = E.game.scenes.play, s = P.state, W = P.walls(E);
        if (where === 'mine') { s.foot.pos = s.foot.tgt = W.back; window.__gap = W.back + s.foe.home; }
        if (where === 'his') { window.__gap = W.fore; s.foot.pos = s.foot.tgt = W.fore - s.foe.home; } }, where);
      await g.frames(30);
      const x0 = w * 0.5, y0 = h * 0.6;
      await g.down(x0, y0);
      for (let i = 1; i <= 18; i++) { await g.frames(1); await g.move(x0 + 190 * i / 18, y0 - 10 * i / 18); }
      const ok = await g.until(() => { const s = window.__engine.game.scenes.play.state; return s.you.lungeK > 0.97 || s.you.drive > 0; }, 30);
      const r = await g.ev(() => { const E = window.__engine, P = E.game.scenes.play, s = P.state, c = P.shieldBtns(E)[0], F = P.foeF(E), f = s.foe;
        return { x: Math.round(s.hand.ux), y: Math.round(s.hand.uy), his: Math.round(F.x - (0.05 + 0.3 + f.weapon.len + P.TUNING.kit.weapon.spear.tip) * F.H), lo: c.x + c.w, hi: E.w - E.safe.right, k: +s.you.lungeK.toFixed(2) }; });
      await g.up(x0 + 190, y0 - 10); await g.frames(40);
      if (!ok || r.x > r.hi || r.x < r.lo || r.y < 0 || r.his < r.lo) bad.push(`${wid} ${where} ${JSON.stringify(r)}`);
    }
    t.ok(`${w}x${h}: at full lunge with a spear or a trident both points are on screen and clear of the left column, open and at either wall`, !bad.length, bad.join('; '));
  }
}
