// Step 2026-11-21 (faces-and-women.md, Build 1, the turned bodies): a man wears the torso turned three-quarter, and his weapon arm hangs from its
// painted near shoulder in every pose, one arm on one shoulder. For each build, yours across the poses (rest, raised, back, thrust, swing, low, a
// knife up) and his (rest, his tells high, mid and low): the arm's shoulder lies on the torso's painting, the painted shoulder does not stick out past
// the arm's round end on its back and top (a second shoulder), the arm is not stretched past what reads as one arm, and the fist is where the fight
// has it. Build 2 (women and faces): the same for a woman, her torso turned as his (yours a Spartan's, his Mevia's).
import { boot } from '../exact.mjs';
import { VET } from '../arena.mjs';
import { scene, knifeUp, release, holdTell, dropTell } from '../scene.mjs';

const BUILDS = { lean: 2, avg: 3, musc: 5 };
// your poses: the thumb dragged (dx, dy) H from where it lands (null: no touch)
const POSES = { rest: null, raised: [0.05, -0.75], back: [-0.2, -0.6], thrust: [0.5, 0], swing: [0.55, 0.35], low: [0.3, 0.55] };
// most an arm may be drawn longer than its painting to reach its fist, and the share of the ring just past the arm's round end on the painted
// shoulder's side (back and top) the torso may still cover
const STRETCH = 1.35, RING = 0.2;

// in the page: where an arm drawn from body point S (body units, his frame) sits on his torso's painting, and how much of the ring at r body units
// round it, on the back and top side, the painting covers
const probe = (g, who, S, r) => g.ev(async ([who, S, r]) => {
  const E = window.__engine, P = E.game.scenes.play, s = P.state, D = await import(new URL('src/draw-fight.js', location.href).href);
  const T = P.TUNING.kit, fm = who === 'you' ? s.you : s.foe, lk = D.lookFor(fm, who !== 'you'), pic = D.kitPic('torso', lk.kit.tier, 0, lk.kit.fk), J = pic.J;
  const f = (await import(new URL('src/data.js', location.href).href)).PARTS.find((d) => d.id === 'belly').w / J.w, sy = (T.belt - T.neck) / (J.b[1] - J.a[1]);
  const px = (x, y) => [J.a[0] + (x - T.turn.dx) / f, J.a[1] + (y - T.neck) / sy];
  const cv = new OffscreenCanvas(J.size[0], J.size[1]), c = cv.getContext('2d'); c.drawImage(pic.im, 0, 0, J.size[0], J.size[1]);
  const A = c.getImageData(0, 0, J.size[0], J.size[1]).data, alpha = ([x, y]) => (x < 0 || y < 0 || x >= J.size[0] || y >= J.size[1] ? 0 : A[(Math.round(y) * J.size[0] + Math.round(x)) * 4 + 3]);
  let n = 0, hit = 0;
  for (let a = 100; a <= 260; a += 10) { const t = a * Math.PI / 180; n++; if (alpha(px(S[0] + Math.cos(t) * r, S[1] - Math.sin(t) * r)) > 128) hit++; }
  return { name: pic.J.sh ? 'turned' : 'frontal', on: alpha(px(S[0], S[1])) > 128, ring: hit / n };
}, [who, S, r]);

export default async function (t) {
  for (const her of [false, true]) await bodies(t, her);
}
async function bodies(t, her) {
  const g = await boot({ w: 874, h: 402, save: VET }), who = her ? 'her ' : '';
  await scene(g, { kit: 'none', foe: her ? 'mevia' : 'Gannicus', knives: 3, foeHp: 999 });
  for (const [bn, str] of Object.entries(BUILDS)) {
    await g.ev(([str, her]) => {
      const s = window.__engine.game.scenes.play.state;
      s.me.str = str; s.foe.str = str; s.you.lookSig = null;
      if (her) { s.me.female = true; s.me.origin = 'sparta'; }
    }, [str, her]);
    await g.frames(20);
    // yours: the drawn shoulder (screen px) back in your frame, the drawn upper arm's and forearm's lengths per half an arm, the fist against the hand
    const mine = () => g.ev(async () => {
      const E = window.__engine, P = E.game.scenes.play, s = P.state, D = await import(new URL('src/draw-fight.js', location.href).href), M = await import(new URL('src/fight.js', location.href).href);
      const h = s.hand, [sx, sy, ex, ey, turn] = D.armJoints(E, h), F = P.youF(E), L = M.myArm(E) / 2, [lx, ly] = M.toLocal(F, sx, sy);
      return { turn, S: [lx, ly], up: Math.hypot(ex - sx, ey - sy) / L, fore: Math.hypot(h.hx - ex, h.hy - ey) / L, r: P.TUNING.kit.arm / 2 };
    });
    const bad = [];
    // (the torso leans with a blow, and the arm's shoulder with it, so the painting is probed at rest; every pose checks the arm itself)
    const m0 = await mine(), q0 = await probe(g, 'you', m0.S, m0.r * 1.1);
    if (q0.name !== 'turned' || !q0.on || q0.ring > RING) bad.push(`at rest: ${JSON.stringify({ ...m0, ...q0 })}`);
    const look = async (pose) => {
      const m = await mine();
      if (!m.turn || m.up > STRETCH || m.fore > STRETCH) bad.push(`${pose}: ${JSON.stringify(m)}`);
    };
    for (const [pose, d] of Object.entries(POSES)) {
      const x0 = g.w * 0.62, y0 = g.h * 0.5, H = await g.ev(() => { const E = window.__engine; return E.game.scenes.play.youF(E).H; });
      if (d) { await g.down(x0, y0, 7); await g.frames(3); for (let i = 1; i <= 12; i++) { await g.move(x0 + d[0] * H * i / 12, y0 + d[1] * H * i / 12, 7); await g.frames(1); } await g.frames(20); }
      else await g.frames(20);
      await look(pose);
      if (d) { await g.up(x0 + d[0] * H, y0 + d[1] * H, 7); await g.frames(30); }
    }
    await knifeUp(g); await g.frames(10); await look('knife up'); await release(g); await g.frames(60);
    t.ok(`${who}${bn}: your sword arm hangs from the turned torso's painted shoulder, one shoulder, in every pose`, !bad.length, bad.join(' | '));
    // his: the arm's drawn frame from the painted shoulder, reaching the same fist
    const his = () => g.ev(async () => {
      const E = window.__engine, P = E.game.scenes.play, f = P.state.foe, D = await import(new URL('src/draw-fight.js', location.href).href), A = (await import(new URL('src/data.js', location.href).href)).ARM_LEN;
      const fr = f.fr.armF, d = D.frDrawn(f, 'armF', D.lookFor(f, true)), fist = (q, k) => [q.ox - Math.sin(q.rot) * A * k, q.oy + Math.cos(q.rot) * A * k];
      const a = fist(fr, 1), b = fist(d, d.k || 1);
      return { S: [d.ox, d.oy], k: d.k || 1, miss: Math.hypot(a[0] - b[0], a[1] - b[1]), r: f.parts.find((p) => p.d.id === 'armF').d.w / 2 };
    });
    const hb = [];
    for (const z of [null, 'high', 'mid', 'low']) {
      if (z) { await holdTell(g, z, null, 0.95); await g.frames(30); }
      const m = await his(), q = await probe(g, 'foe', m.S, m.r * 1.1);
      if (q.name !== 'turned' || !q.on || q.ring > RING || m.k > STRETCH || m.miss > 1e-6) hb.push(`${z || 'rest'}: ${JSON.stringify({ ...m, ...q })}`);
      if (z) { await dropTell(g); await g.frames(5); }
    }
    t.ok(`${who}${bn}: ${her ? 'her' : 'his'} weapon arm hangs from the turned torso's painted shoulder and reaches the same fist, at rest and in each tell`, !hb.length, hb.join(' | '));
  }
  // her body is hers: her turned torso and her limbs, on you and on the foe
  if (her) {
    const B = await g.ev(async () => {
      const s = window.__engine.game.scenes.play.state, D = await import(new URL('src/draw-fight.js', location.href).href);
      return [D.lookFor(s.you, false), D.lookFor(s.foe, true)].map((lk) => D.manArt(lk, lk.kit.tier, null, lk.kit.fk).body.join(' '));
    });
    t.ok('a woman wears her own turned torso and limbs, yours and the foe\'s', B.every((b) => /kit-base-torso(-\w+)?-f-3q/.test(b) && /kit-arm-up-\w+-f/.test(b) && /kit-leg-lo-\w+-f/.test(b)), JSON.stringify(B));
  }
  await g.close();
}
