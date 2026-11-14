// Steps 23b and 24c: a natural up-and-down overhead registers at each phone size, never lunges or steps you in, and from the weapon's own range
// lands its striking part (the mace's ball, the axe's blade), not a THUD. Plain jab and slash strokes still class as themselves.
import { VET } from '../arena.mjs';
import { bout, still } from '../exact.mjs';

const SIZES = [[667, 375], [844, 390], [874, 402]];
// thumb paths, [frame, dx, dy] from where the thumb lands (24c's overheads, at 60 frames a second)
// (the thumb rests 60 ms at the end before it lifts, as a thumb does; a lift ends the blow)
// straight and long are clean; short, slow, hurried and sloppy (no pause at the top, a sideways wobble) are a thumb on a bad day
const OVER = {
  straight: [[0, 0, 0], [12, 0, -60], [19, 0, -60], [28, 25, 40], [32, 25, 40]],
  long: [[0, 0, 0], [13, -10, -80], [20, -10, -80], [29, 70, 45], [33, 70, 45]],
  short: [[0, 0, 0], [10, 0, -40], [15, 0, -40], [22, 15, 20], [26, 15, 20]],
  slow: [[0, 0, 0], [24, 0, -60], [36, 0, -60], [48, 25, 40], [52, 25, 40]],
  hurried: [[0, 0, 0], [6, 5, -60], [7, 5, -60], [12, 30, 40], [15, 30, 40]],
  sloppy: [[0, 0, 0], [8, -15, -45], [12, 12, -70], [17, -8, -55], [24, 35, 30], [27, 30, 35]],
};
const JAB = [[0, 0, 0], [6, -12, 4], [9, 30, -4], [14, 30, -4]];
const SLASH = [[0, -20, -70], [1, -20, -70], [2, -5, -20], [3, 10, 30], [4, 20, 70], [8, 20, 70]];

// a bout with the weapon, him still and bare, every attack born logged; the gap at which your straight arm and weapon reach k H into his front
async function setup(g, w) {
  await bout(g, { w: w === 'mace' ? 'axe' : w, mace: w === 'mace', kit: [], rack: 1 });
  await g.ev(() => {
    const E = window.__engine, P = E.game.scenes.play, s = P.state;
    s.foe.hp = s.foe.maxHp = 999; for (const q of s.foe.parts) q.armour = false;
    window.__own = (k) => { const L = P.lay(E), Fy = P.youF(E), B = P.TUNING.fighter.body, H = Fy.H, sc = H / L.H, arm = P.TUNING.arm.len * H * P.meSize().arm; return (L.x0 - (sc - 1) * B * L.H + 0.05 * H + arm + P.myBlade(E) - k * H - L.x1 + B * L.H) / L.H; };
    window.__atk = [];
    if (window.__atkOn) return; window.__atkOn = 1;
    let last = null; const raf = window.requestAnimationFrame;
    const f = () => { const a = P.state.hand.atk; if (a !== last) { if (a) window.__atk.push(a.kind); last = a; } for (const q of P.state.foe.parts) q.cool = 0; raf(f); }; raf(f);
  });
  await still(g, await g.ev(() => window.__own(0.08)));
  await g.frames(10);
}
async function blow(g, keys) {
  await g.ev(() => { const s = window.__engine.game.scenes.play.state; s.foot.pos = s.foot.tgt = -0.1; s.pops = []; window.__atk = []; window.__b0 = { l: s.lunges, si: s.stepsIn, zm: s.zfx ? s.zfx.m : -1, hp: s.foe.hp }; });
  await g.frames(10);
  await g.stroke(g.w * 0.74, g.h * 0.66, keys);
  await g.frames(36);
  return g.ev(() => { const s = window.__engine.game.scenes.play.state, b = window.__b0, p = s.pops.map((q) => q.s).filter((q) => !/^[\d.+-]/.test(q));
    return { kinds: window.__atk.join('>'), lunges: s.lunges - b.l, stepsIn: s.stepsIn - b.si, foot: +(s.foot.pos + 0.1).toFixed(3), clean: !!(s.zfx && s.zfx.m !== b.zm), thud: p.includes('THUD'), dmg: +(b.hp - s.foe.hp).toFixed(2), pops: p.join('|') }; });
}

export default async function (t) {
  for (const [w, h] of SIZES) {
    const g = await t.boot({ w, h, save: VET });
    for (const wp of ['mace', 'axe', 'gladius']) {
      await setup(g, wp);
      const r = {};
      for (const [n, keys] of Object.entries(OVER)) r[n] = await blow(g, keys);
      const notOver = (n) => !/over/.test(r[n].kinds) || /jab|slash/.test(r[n].kinds);
      const bad = ['straight', 'long', 'short', 'slow', 'sloppy'].filter(notOver).map((n) => `${n}: ${r[n].kinds || 'nothing'}`);
      t.ok(`${w}x${h} ${wp}: an up-and-down overhead registers, clean, short, slow or wobbly`, !bad.length, bad.join('; '));
      // found by this suite (2026-11-14): up and straight down with no pause at the top stays a 'raise' (the raise is still the attack in hand
      // when the chop comes, so no overhead is born) and does nothing
      if (wp === 'gladius') t.known(`${w}x${h}: a hurried overhead (no pause at the top) registers`, !notOver('hurried'), `hurried: ${r.hurried.kinds || 'nothing'}`);
      const moved = Object.entries(r).filter(([, v]) => v.lunges || v.stepsIn || Math.abs(v.foot) > 0.001).map(([n, v]) => `${n}: ${JSON.stringify(v)}`);
      t.ok(`${w}x${h} ${wp}: the overhead never lunges or steps you in`, !moved.length, moved.join('; '));
      if (wp !== 'gladius') {
        const thud = Object.entries(r).filter(([n]) => n === 'straight' || n === 'long').filter(([, v]) => v.thud || !v.clean).map(([n, v]) => `${n}: ${JSON.stringify(v)}`);
        t.ok(`${w}x${h} ${wp}: from its own range the overhead lands the ${wp === 'mace' ? 'ball' : 'blade'}, not a THUD`, !thud.length, thud.join('; '));
      }
    }
    await setup(g, 'gladius');
    const j = await blow(g, JAB), s = await blow(g, SLASH);
    t.ok(`${w}x${h}: a jab stroke is a jab and a slash stroke a slash`, j.kinds === 'jab' && s.kinds === 'slash', JSON.stringify({ jab: j.kinds, slash: s.kinds }));
    // jabs repeated as a thumb does them, lifted and put down again each time (a short or slow push is under the jab's speed, by design)
    await g.ev(() => { window.__atk = []; });
    for (let i = 0; i < 3; i++) { await g.stroke(g.w * 0.74, g.h * 0.66, JAB); await g.frames(4); }
    const rep = await g.ev(() => window.__atk.join('>'));
    t.eq(`${w}x${h}: three quick jabs in a row are three jabs`, rep, 'jab>jab>jab');
  }
}
