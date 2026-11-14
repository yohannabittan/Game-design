// Step 2026-11-14 (two weapons strike hand to hand): with two of a weapon your blows go main, off, main, off, and after dual.reset s with no blow the
// next is the main hand's; the thumb drawn back after a blow is no blow; an off-hand blow is the same blow as the main hand's (its kind, its striking
// part, its damage, the spear's slide); two blows with the thumb held down take at most 0.7x the time they take with one weapon, and after a bounce
// the free hand waits only dual.overlap of the recoil; the old off-hand flick after a landed slash is gone.
import { VET } from '../arena.mjs';

// a bout in the Colosseum: you (medium) with the weapon (two of it when dual) against a medium man with his weapon, bare, never swinging, the gap
// pinned at his stand-off; window.__rec gathers each blow as it is born (which hand, its kind) and each landing (the damage, the striking part, the slide)
const setup = (g, o) => g.ev((o) => {
  const E = window.__engine, P = E.game.scenes.play, T = P.TUNING;
  let me = P.rollMe(777, []); me.idx = me.idx.slice(); me.idx[0] = T.me.wheels.size.findIndex((e) => e[0] === 'medium');
  me = { ...P.kitMe(me, o.w, ['chest'], !!o.dual), str: 3, origin: 'capua' };
  E.setScene('play', { seed: 777, arena: 'rome', me, buy: 'x', gold: 0 });
  P.newRackAt(E, 0);
  const s = P.state, f = s.foe, W = T.weapons.find((q) => q.id === o.his);
  Object.assign(s, { intro: false, hp: 99, maxHp: 99 }); s.bout.foeShrug = true;
  f.hp = f.maxHp = 999; f.size = { ...T.sizes.find((q) => q.id === 'medium') };
  f.weapon = W; f.wname = W.name; f.home = W.range; f.strike = W.strike; f.shield = false; s.cam = null;
  for (const p of f.parts) { p.armour = false; p.guard = false; }
  window.__gap = f.home; window.__rec = [];
  if (!window.__pin) {
    window.__pin = 1; const raf = window.requestAnimationFrame;
    let atk = null, land = null;
    const lp = () => {
      const s = P.state, h = s && s.hand;
      if (s && s.foe) {
        Object.assign(s, { swingIn: 99, sw: null, plan: null, cover: null, stamina: s.staMax }); s.step.x = s.step.tgt = window.__gap;
        for (const p of s.foe.parts) p.cool = 0;
        const R = window.__rec;
        if (R && h.atk && h.atk.cost != null && h.atk !== atk) R.push({ t: 'blow', m: s.m, off: !!h.off, kind: h.atk.kind });
        if (R && s.landM !== land && land !== null) R.push({ t: 'land', m: s.m, off: !!h.off, kind: h.atk && h.atk.kind, dmg: +(s.foe.maxHp - s.foe.hp).toFixed(2), z: s.zfx && s.zfx.st.z, thud: s.pops.some((q) => q.s === 'THUD'), sl: +(h.sl || 0).toFixed(3) });
        if (R) R.push({ t: 'f', hp: s.foe.hp });
        atk = h.atk; land = s.landM;
        s.foe.hp = s.foe.maxHp;
      }
      raf(lp);
    };
    raf(lp);
  }
}, o);
const rec = (g) => g.ev(() => { const r = window.__rec.filter((q) => q.t !== 'f'); window.__rec = []; return r; });
const hands = (r) => r.filter((q) => q.t === 'blow').map((q) => (q.off ? 'L' : 'R')).join('');

// thumb paths, [frame, dx, dy]: a jab (draw back a little, push), a quick push, a downward slash
const JAB = [[0, 0, 0], [6, -12, 4], [9, 30, -4], [14, 30, -4]];
const PUSH = [[0, 0, 0], [3, 40, 0], [6, 40, 0]];
const SLASH = [[0, 0, -40], [6, 20, 30], [10, 20, 30]];

export default async function (t) {
  // 2. alternation: touch-and-lift jabs at a natural, a hurried and a slow pace, each R L R L; then a pause past dual.reset and the main hand again;
  // and one long touch pumping the thumb out and back: R L R L, the thumb coming back is never a blow
  for (const [w, h] of [[874, 402], [667, 375]]) {
    const g = await t.boot({ w, h, save: VET });
    for (const [name, keys, rest] of [['jabs', JAB, 8], ['hurried pushes', PUSH, 2], ['slashes', SLASH, 12]]) {
      await setup(g, { w: 'gladius', his: 'gladius', dual: true }); await g.frames(30); await rec(g);
      for (let i = 0; i < 4; i++) { await g.stroke(w * 0.7, h * 0.45, keys); await g.frames(rest); }
      await g.frames(60);
      await g.stroke(w * 0.7, h * 0.45, keys); await g.frames(10);
      const line = hands(await rec(g));
      t.eq(`${w}x${h}: four ${name} in a row go right, left, right, left, and after a pause the right again`, line, 'RLRLR');
    }
    await setup(g, { w: 'gladius', his: 'gladius', dual: true }); await g.frames(30); await rec(g);
    const pump = [[0, 0, 0]]; for (let i = 0; i < 4; i++) pump.push([i * 18 + 3, 40, 8], [i * 18 + 8, 40, 8], [i * 18 + 13, 0, 0], [i * 18 + 18, 0, 0]);
    await g.stroke(w * 0.7, h * 0.45, pump); await g.frames(10);
    t.eq(`${w}x${h}: one touch pumping out and back four times with two gladii: right, left, right, left, the returns no blows`, hands(await rec(g)), 'RLRL');
  }
  // 3. the off hand's blow is the main hand's: the same jab, slash and push with gladii and with spears (the spear inside its point, sliding) land
  // as the same kind, with the same striking part and damage, never on the haft
  {
    const g = await t.boot({ w: 874, h: 402, save: VET });
    const bad = [];
    // (each blow in a fresh bout, so no bleed or mark of the first changes the second; the off hand given the thumb as after a main-hand blow, its
    // guard and jab gate for now the main hand's, so the same thumb moves both hands along one path)
    await g.ev(() => { const T = window.__engine.game.scenes.play.TUNING; window.__hold = [T.dual.hold, T.dual.offJab]; T.dual.hold = T.control.guard.slice(); T.dual.offJab = 1; });
    const blow = async (wid, keys, off) => {
      await setup(g, { w: wid, his: 'gladius', dual: true }); await g.frames(30);
      if (off) await g.ev(() => { const E = window.__engine, P = E.game.scenes.play, s = P.state; s.hand.struck = true; s.hand.atk = null; P.updateDual(E, 0); s.duo.m = s.m + 9; });
      await g.frames(10); await rec(g);
      await g.stroke(g.w * 0.7, g.h * 0.45, keys.map(([f, x, y]) => [f, x, y + 12])); await g.frames(10);
      return (await rec(g)).filter((q) => q.t === 'land' || q.t === 'blow');
    };
    for (const wid of ['gladius', 'spear', 'axe']) for (const [name, keys] of [['jab', JAB], ['push', PUSH], ['slash', SLASH]]) {
      const m = await blow(wid, keys, false), o = await blow(wid, keys, true), ml = m.find((q) => q.t === 'land'), ol = o.find((q) => q.t === 'land');
      const same = !ml && !ol ? true : ml && ol && !o.find((q) => q.t === 'blow').off === false && ml.kind === ol.kind && ml.dmg === ol.dmg && ml.z === ol.z && !ml.thud && !ol.thud;
      if (!same || (wid === 'spear' && ol && !(ol.sl > 0 && Math.abs(ml.sl - ol.sl) < 0.05))) bad.push(`${wid} ${name} ${JSON.stringify({ m, o })}`);
    }
    await g.ev(() => { const D = window.__engine.game.scenes.play.TUNING.dual; [D.hold, D.offJab] = window.__hold; });
    t.ok('874x402: the off hand\'s jab, push and slash land as the main hand\'s (kind, striking part, damage, the spear\'s slide), gladius, spear and axe', !bad.length, bad.join('; '));
  }
  // 4. as fast as allowed with the thumb held down: one weapon must bring its hand back before it pushes again (out, back, out); two weapons push
  // again from where the thumb is (out, out). Birth of the first blow to the landing of the second, at the same thumb speed: at most 0.7x.
  // And after a bounce the free hand waits dual.overlap of the struck hand's recoil.
  {
    const g = await t.boot({ w: 874, h: 402, save: VET });
    const span = (r) => { const b = r.find((q) => q.t === 'blow'), l = r.filter((q) => q.t === 'land'); return l.length >= 2 ? +(l[1].m - b.m).toFixed(3) : null; };
    // the thumb out, back, (a pause of p frames), out again: the fastest pause that lands both blows, and how long that took
    const fastest = async (dual) => {
      for (let p = 0; p <= 36; p += 3) {
        await setup(g, { w: 'gladius', his: 'gladius', dual }); await g.frames(30); await rec(g);
        await g.stroke(g.w * 0.6, g.h * 0.5, [[0, 0, 0], [3, 40, 0], [6, 40, 0], [9, 0, 0], [9 + p, 0, 0], [12 + p, 40, 0], [15 + p, 40, 0]]); await g.frames(10);
        const t = span(await rec(g));
        if (t) return { p, t };
      }
      return null;
    };
    const one = await fastest(false), two = await fastest(true);
    t.ok('874x402: two gladius jabs with the thumb held down, as fast as each allows, land in at most 0.7x the time with two gladii', one && two && two.t <= 0.7 * one.t, JSON.stringify({ one, two }));
    const lk = await g.ev(() => {
      const E = window.__engine, P = E.game.scenes.play, s = P.state, T = P.TUNING;
      const h = s.hand; h.struck = true; h.atk = null; h.lock = 0.5;
      P.updateDual(E, 0);
      return { off: !!s.hand.off, lock: +s.hand.lock.toFixed(3), want: 0.5 * T.dual.overlap, struck: +s.duo.rest.lock.toFixed(3) };
    });
    t.ok('after a bounce the free hand takes the thumb, held only dual.overlap of the struck hand\'s recoil', lk.lock === lk.want && lk.struck === 0.5, JSON.stringify(lk));
  }
  // 5. the off-hand flick is gone: a landed slash with two gladii does one blow's damage, the same as with one, and nothing lands after it
  {
    const g = await t.boot({ w: 874, h: 402, save: VET });
    const out = {};
    for (const dual of [false, true]) {
      await setup(g, { w: 'gladius', his: 'gladius', dual }); await g.frames(30); await g.ev(() => { window.__rec = []; });
      await g.stroke(g.w * 0.7, g.h * 0.45, SLASH); await g.frames(40);
      const r = await g.ev(() => { const r = window.__rec; window.__rec = []; return r; });
      out[dual ? 'two' : 'one'] = { lands: r.filter((q) => q.t === 'land').length, hurt: r.filter((q) => q.t === 'f' && q.hp < 999).length, dmg: (r.find((q) => q.t === 'land') || {}).dmg };
    }
    t.ok('a landed slash with two gladii hurts him once, as much as with one; no flick follows', out.one.lands === 1 && out.two.lands === 1 && out.two.hurt === 1 && out.two.dmg === out.one.dmg, JSON.stringify(out));
  }
  // 6. a fresh touch's jab (draw back, push) registers every time with two weapons, as with one: the return rule is for the touch that just ended a blow
  for (const w of ['spear', 'axe']) {
    const g = await t.boot({ w: 667, h: 375, save: VET });
    await setup(g, { w, his: 'gladius', dual: true }); await g.frames(30); await rec(g);
    for (let i = 0; i < 6; i++) { await g.stroke(g.w * 0.7, g.h * 0.45, JAB); await g.frames(12); }
    const r = await rec(g);
    t.ok(`six separate fresh-touch jabs with two ${w}s all register, right then left`, r.filter((q) => q.t === 'blow').length === 6 && hands(r) === 'RLRLRL', hands(r) + ' ' + r.length);
  }
  // 7. the off hand's lower jab gate (dual.offJab) names no slash a jab: a slash given to the off hand, at its own guard, is born a slash, as the
  // main hand's is, for every weapon two of which you can hold
  {
    const g = await t.boot({ w: 874, h: 402, save: VET });
    const bad = [];
    for (const wid of ['gladius', 'dagger', 'sica', 'spear', 'trident', 'axe']) for (const off of [false, true]) {
      await setup(g, { w: wid, his: 'gladius', dual: true }); await g.frames(30);
      if (off) await g.ev(() => { const E = window.__engine, P = E.game.scenes.play, s = P.state; s.hand.struck = true; s.hand.atk = null; P.updateDual(E, 0); s.duo.m = s.m + 9; });
      await g.frames(10); await rec(g);
      await g.stroke(g.w * 0.7, g.h * 0.45, SLASH); await g.frames(10);
      const b = (await rec(g)).filter((q) => q.t === 'blow');
      if (b.length !== 1 || b[0].kind !== 'slash' || b[0].off !== off) bad.push(`${wid} ${off ? 'off' : 'main'} ${JSON.stringify(b)}`);
    }
    t.ok('874x402: a slash is a slash in either hand, at the off hand\'s own guard and jab gate, for all six weapons', !bad.length, bad.join('; '));
  }
}
