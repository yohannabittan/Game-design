// Step 27: the knife thrown by angle, one press. The thumb goes down on KNIFE and stays down: the press aims at the bare skin nearest his chest,
// the thumb's slide up or down moves the line from there (its height alone), its release throws. What the line shows at the release is what happens.
// Every throw here is a real thumb path on exact frames; where the knife goes is read from the page's own counters.
import { VET } from '../arena.mjs';
import { bout, still } from '../exact.mjs';

const btn = (g) => g.ev(() => { const E = window.__engine; const b = E.game.scenes.play.armsBtns(E); return b && b.knife; });
const tally = (g) => g.ev(() => { const s = window.__engine.game.scenes.play.state;
  return { knives: s.knives, thrown: s.knivesThrown, gap: s.knifeGaps, skin: s.knifeSkin, plate: s.knifePlate, miss: s.knifeMiss, hp: s.foe.hp, aim: !!s.aim,
    said: s.pops.map((q) => q.s).filter((q) => /[A-Z]{3}/.test(q)).join('|'), gaps: { ...s.bout.gaps } }; });
const fresh = (g) => g.ev(() => { const s = window.__engine.game.scenes.play.state; s.pops = []; s.foe.hp = s.foe.maxHp = 999; s.knives = 6; for (const p of s.foe.parts) p.cool = 0; });
const aimNow = (g) => g.ev(() => { const a = window.__engine.game.scenes.play.state.aim; return a && { over: a.over, part: a.part }; });
const KINDS = { gap: 'gap', skin: 'skin', plate: 'plate', miss: 'miss' };

// the thumb down on KNIFE, then a sweep of its height from the top of the screen to the bottom (x to one side), reading what the line meets;
// the thumb stays down. Returns the bands: [{ k: 'gap:slot-neck', y0, n }]
async function scan(g, kb, x) {
  await g.down(kb.x, kb.y, 5); await g.frames(20);
  const segs = []; let last = null;
  for (let y = 0; y < g.h; y++) {
    await g.move(x, y, 5); await g.frames(1);
    const r = await g.ev(() => { const a = window.__engine.game.scenes.play.state.aim; const E = window.__engine; return a ? `${a.over}:${a.part || (a.y >= E.game.scenes.play.lay(E).floor - 1 ? 'sand' : 'air')}` : 'none'; });
    if (!last || last.k !== r) { last = { k: r, y0: y, n: 0 }; segs.push(last); }
    last.n++;
  }
  return segs;
}
// one throw: down on KNIFE, slid (over frames) to (x, y), held a little, let go; then the flight
async function throwAt(g, kb, x, y, frames = 12) {
  await g.stroke(kb.x, kb.y, [[0, 0, 0], [frames, x - kb.x, y - kb.y], [frames + 4, x - kb.x, y - kb.y]], 5);
  await g.frames(60);
  return tally(g);
}
const d = (a, b) => Object.fromEntries(['knives', 'thrown', 'gap', 'skin', 'plate', 'miss'].map((k) => [k, b[k] - a[k]]).concat([['dmg', +(a.hp - b.hp).toFixed(2)], ['said', b.said]]));

export default async function (t) {
  // 1. the KNIFE button: on the right, a 44 px target at least, clear of him and of the HUD, at the designer's size and the smallest
  for (const [w, h] of [[874, 402], [667, 375]]) {
    const g = await t.boot({ w, h, save: VET });
    await bout(g, { w: 'gladius', kit: ['chest'], arena: 'city', rack: 1, knives: 3 });
    await still(g); await g.frames(10);
    const r = await g.ev(() => { const E = window.__engine, P = E.game.scenes.play, b = P.armsBtns(E).knife, F = P.foeF(E); return { b, right: F.x + 0.3 * F.H, w: E.w }; });
    t.ok(`${w}x${h}: KNIFE sits on the right, 44 px or more, clear of him and the HUD`, r.b.x > 0.8 * r.w && 2 * r.b.r >= 44 && r.b.x - r.b.r > r.right && r.b.y - r.b.r > 0.5 * h, JSON.stringify(r));
  }

  const g = await t.boot({ w: 874, h: 402, save: VET });
  await bout(g, { w: 'gladius', kit: ['chest'], arena: 'city', rack: 1, knives: 6 });
  await still(g); await g.frames(10);
  const kb = await btn(g);

  // 4. the bands: over his head, his head's plate, each open gap at least 12 px of thumb height, skin, and the sand under his feet
  const segs = await scan(g, kb, kb.x - 40);
  await g.move(kb.x - 40, g.h - 2, 5); await g.frames(1); await g.up(kb.x, kb.y, 5); await g.frames(60);
  const total = {}; for (const s of segs) total[s.k] = (total[s.k] || 0) + s.n;
  const gaps = Object.keys(total).filter((k) => k.startsWith('gap:'));
  // (a gap that overlaps another, as his waist behind his elbow, shares its heights: what counts is that the heights over any gap are one band of gap)
  const g0 = segs.findIndex((s) => s.k.startsWith('gap:')), g1 = segs.length - 1 - [...segs].reverse().findIndex((s) => s.k.startsWith('gap:'));
  const band = segs.slice(g0, g1 + 1);
  t.ok('874x402: all four open gaps can be aimed at, in one unbroken band of gap, each gap 7 px or more and the band 12 px a gap or more',
    gaps.length === 4 && gaps.every((k) => total[k] >= 7) && band.every((s) => s.k.startsWith('gap:')) && band.reduce((n, s) => n + s.n, 0) >= 12 * 4, JSON.stringify(segs.map((s) => `${s.y0}:${s.k}(${s.n})`)));
  t.ok('874x402: top to bottom the line goes over his head, onto his helmet, through gaps, onto skin, and under his feet into the sand', segs[0].k === 'miss:air' && segs[1].k === 'plate:head' && segs[2].k.startsWith('gap:')
    && segs[segs.length - 2].k.startsWith('skin:') && segs[segs.length - 1].k === 'miss:sand', JSON.stringify(segs.map((s) => `${s.y0}:${s.k}(${s.n})`)));
  const mid = (k) => { const s = segs.filter((q) => q.k === k).sort((a, b) => b.n - a.n)[0]; return s && Math.round(s.y0 + s.n / 2); };

  // 2. a press, a slide to a gap's height and a release: the knife goes into that gap, for knives.dmg; the same height with the thumb far left
  // or far right puts it in the same gap
  {
    const yG = mid('gap:slot-neck'), out = [];
    for (const x of [kb.x - 20, Math.round(g.w * 0.08), g.w - 4]) {
      await fresh(g); const a = await tally(g), b = await throwAt(g, kb, x, yG);
      out.push({ x, ...d(a, b), neck: (b.gaps['slot-neck'] || 0) - (a.gaps['slot-neck'] || 0) });
    }
    const dmg = await g.ev(() => window.__engine.game.scenes.play.TUNING.knives.dmg);
    t.ok('a slide to the neck gap\'s height and a release: the knife goes in, for knives.dmg; thumb far left or far right, the same gap', out.every((q) => q.thrown === 1 && q.knives === -1 && q.gap === 1 && q.neck === 1 && q.dmg === dmg), JSON.stringify({ yG, out }));
  }

  // 3. over his head and under his knees: missed; over his helmet: plate, nothing taken; over bare skin: knives.skin
  {
    await g.ev(() => { window.__engine.game.scenes.play.state.knives = 6; });
    const out = {};
    for (const k of ['miss:air', 'plate:head', 'skin:armF']) { await fresh(g); const a = await tally(g); out[k] = d(a, await throwAt(g, kb, kb.x - 30, mid(k))); }
    const skin = await g.ev(() => window.__engine.game.scenes.play.TUNING.knives.skin);
    t.ok('over his head, MISSED; on his helmet, PLATE and nothing taken; on his bare arm, knives.skin',
      out['miss:air'].miss === 1 && out['miss:air'].dmg === 0 && /MISSED/.test(out['miss:air'].said)
      && out['plate:head'].plate === 1 && out['plate:head'].dmg === 0 && /PLATE/.test(out['plate:head'].said) && out['skin:armF'].skin === 1 && out['skin:armF'].dmg === skin, JSON.stringify(out));
  }

  // 5. no press ends with nothing and no word: a plain press and release on KNIFE throws (along the line it shows: at his chest, never into the
  // sand); so does a hurried one (a slide and a release in three frames, before the knife is up), and one slid away and back onto KNIFE (his chest
  // again). Only a thumb slid off the bottom edge puts the knife away, keeps it, and says NO THROW.
  {
    await g.ev(() => { window.__engine.game.scenes.play.state.knives = 6; });
    await fresh(g); const a0 = await tally(g);
    await g.tap(kb.x, kb.y, 5); await g.frames(60);
    const plain = d(a0, await tally(g));
    await fresh(g); const a1 = await tally(g), quick = d(a1, await throwAt(g, kb, kb.x - 30, mid('gap:slot-neck'), 2));
    await fresh(g); const a2 = await tally(g);
    await g.stroke(kb.x, kb.y, [[0, 0, 0], [10, -30, -150], [20, -30, -150], [30, 0, 0], [32, 0, 0]], 5); await g.frames(30);
    const back = { ...d(a2, await tally(g)), aim: (await tally(g)).aim };
    await fresh(g); const a3 = await tally(g);
    await g.stroke(kb.x, kb.y, [[0, 0, 0], [10, -60, -150], [20, -60, -150], [30, -60, g.h - 2 - kb.y], [32, -60, g.h - 2 - kb.y]], 5); await g.frames(30);
    const edge = { ...d(a3, await tally(g)), aim: (await tally(g)).aim };
    t.ok('a plain press and release throws, onto him (no miss), and says where it went', plain.thrown === 1 && plain.knives === -1 && plain.miss === 0 && (/PLATE|GAP/.test(plain.said) || plain.dmg > 0), JSON.stringify(plain));
    t.ok('a hurried slide and release (3 frames) throws, once the knife is up, into the gap', quick.thrown === 1 && quick.gap === 1, JSON.stringify(quick));
    t.ok('slid away and back onto KNIFE: thrown at him; off the bottom edge: no throw, the knife kept, NO THROW said', back.thrown === 1 && back.miss === 0 && !/NO THROW/.test(back.said)
      && edge.thrown === 0 && edge.knives === 0 && !edge.aim && /NO THROW/.test(edge.said), JSON.stringify({ back, edge }));
  }

  // 6. a plain press aims at the bare skin nearest his chest: on Gannicus (no gap over his chest's middle) the line lands on his chest, for knives.skin
  {
    const g0 = await t.boot({ w: 874, h: 402, save: VET });
    await bout(g0, { w: 'gladius', kit: ['chest'], arena: 'city', rack: 0, knives: 3 });
    await still(g0); await g0.frames(10);
    const k0 = await btn(g0);
    await g0.down(k0.x, k0.y, 5); await g0.frames(20); const pre = await aimNow(g0);
    await g0.up(k0.x, k0.y, 5); await g0.frames(60);
    const r = await tally(g0), skin = await g0.ev(() => window.__engine.game.scenes.play.TUNING.knives.skin);
    t.ok('874x402, Gannicus: a plain press shows his chest and puts the knife in it', pre && pre.part === 'chest' && r.skin === 1 && r.thrown === 1, JSON.stringify({ pre, r, skin }));
  }

  // 7. what the line shows is what happens: for each foe in the first bouts, at both sizes, a sweep of thumb heights (every few px), each thrown:
  // the line's gap, skin, plate or miss at the release is the one counted when the knife lands, though he breathes while it flies. And where the
  // line crosses any of his gaps it says gap: no sliver of something else between two gaps that overlap.
  for (const [w, h, racks, step] of [[874, 402, [0, 1, 2, 3, 4], 9], [667, 375, [1], 9]]) {
    const gg = await t.boot({ w, h, save: VET });
    for (const rack of racks) {
      await bout(gg, { w: 'gladius', kit: ['chest'], arena: 'city', rack, knives: 6 });
      await still(gg); await gg.frames(10);
      const kb2 = await btn(gg), name = await gg.ev(() => window.__engine.game.scenes.play.state.foe.name);
      // the bands: the thumb down, swept from the top to the bottom 2 px at a time
      await gg.down(kb2.x, kb2.y, 5); await gg.frames(20);
      const keys = [];
      for (let y = 0; y < h - 10; y += 2) { await gg.move(kb2.x - 20, y, 5); await gg.frames(1); const a = await aimNow(gg); keys.push(a.over); }
      await gg.move(kb2.x, kb2.y, 5); await gg.frames(1); await gg.up(kb2.x, kb2.y, 5); await gg.until(() => { const s = window.__engine.game.scenes.play.state; return !s.aim && !s.whip && !s.knife; }, 120);
      // (a sliver: under 8 px of anything else between two heights of gap; his arm between his waist and his knee is no sliver)
      const runs = []; keys.forEach((k, i) => { const r = runs[runs.length - 1]; if (r && r.k === k) r.n++; else runs.push({ k, y: i * 2, n: 1 }); });
      const i0 = keys.indexOf('gap'), i1 = keys.lastIndexOf('gap'), sliver = runs.filter((r, i) => r.k !== 'gap' && r.n < 4 && i > 0 && i < runs.length - 1 && runs[i - 1].k === 'gap' && runs[i + 1].k === 'gap');
      t.ok(`${w}x${h}, ${name}: over his gaps the line says gap, with no sliver of anything else between two that meet`, i0 >= 0 && sliver.length === 0, JSON.stringify({ sliver, gapsFrom: i0 * 2, to: i1 * 2 }));
      const bad = [];
      for (let y = 4; y < h - 10; y += step) {
        await fresh(gg); const a = await tally(gg);
        await gg.down(kb2.x, kb2.y, 5); await gg.frames(3); await gg.move(kb2.x - 20, y, 5); await gg.frames(15);
        const pre = await aimNow(gg); await gg.up(kb2.x - 20, y, 5);
        await gg.until(() => { const s = window.__engine.game.scenes.play.state; return !s.aim && !s.whip && !s.knife; }, 120);
        const b = d(a, await tally(gg)), got = Object.keys(KINDS).filter((k) => b[k] === 1);
        if (got.length !== 1 || got[0] !== pre.over) bad.push({ y, pre, got });
      }
      t.ok(`${w}x${h}, ${name}: every height thrown lands on what its line showed`, bad.length === 0, JSON.stringify(bad));
    }
  }

  // 8. on each foe of the first bouts, at both sizes: a plain press goes onto bare skin (or plate), never into a gap; and from the press, a slide of
  // at most UP px up or down to the bottom edge's cancel reaches every gap any line height crosses on him (his knee too), each for 7 px or more
  const UP = 160;
  for (const [w, h] of [[874, 402], [667, 375]]) {
    const gg = await t.boot({ w, h, save: VET });
    const plains = [], bands = [];
    for (const rack of [0, 1, 2, 3, 4]) {
      await bout(gg, { w: 'gladius', kit: ['chest'], arena: 'city', rack, knives: 6 });
      await still(gg); await gg.frames(10);
      const kb2 = await btn(gg), name = await gg.ev(() => window.__engine.game.scenes.play.state.foe.name);
      await fresh(gg); const a = await tally(gg);
      await gg.down(kb2.x, kb2.y, 5); await gg.frames(20); const pre = await aimNow(gg); await gg.up(kb2.x, kb2.y, 5);
      await gg.until(() => { const s = window.__engine.game.scenes.play.state; return !s.aim && !s.whip && !s.knife; }, 120);
      plains.push({ name, pre, ...d(a, await tally(gg)) });
      const all = await gg.ev(async () => { const E = window.__engine, R = await import('./src/features/ranged.js'), o = new Set();
        for (let i = 0; i <= 500; i++) { const q = R.lineAt(E, i / 500); if (q.over === 'gap') o.add(q.part); } return [...o]; });
      const edge = await gg.ev(() => window.__engine.game.scenes.play.TUNING.knives.edge), seen = {};
      await gg.down(kb2.x, kb2.y, 5); await gg.frames(20);
      for (let y = kb2.y - UP; y < h - edge; y++) {
        await gg.move(kb2.x - 20, y, 5); await gg.frames(1);
        const q = await aimNow(gg);
        if (q.over === 'gap') { const b = seen[q.part] || (seen[q.part] = { n: 0, y0: y, y1: y }); b.n++; b.y1 = y; }
      }
      await gg.move(kb2.x, kb2.y, 5); await gg.frames(1); await gg.up(kb2.x, kb2.y, 5);
      await gg.until(() => { const s = window.__engine.game.scenes.play.state; return !s.aim && !s.whip && !s.knife; }, 120);
      bands.push({ name, kb: kb2.y, all, seen: Object.fromEntries(Object.entries(seen).map(([k, b]) => [k, `${b.n}px ${b.y0 - kb2.y}..${b.y1 - kb2.y}`])),
        ok: all.length > 0 && all.every((k) => seen[k] && seen[k].n >= 7) });
    }
    t.ok(`${w}x${h}, all five: a plain press throws onto bare skin or plate, never into a gap`, plains.every((q) => q.thrown === 1 && q.gap === 0 && q.miss === 0 && q.skin + q.plate === 1 && q.pre.over !== 'gap'), JSON.stringify(plains));
    t.ok(`${w}x${h}, all five: from the press, ${UP} px up and down to the edge reach every gap he has, his knee too, 7 px or more each`, bands.every((b) => b.ok), JSON.stringify(bands));
    if (t.flags.has('--show')) console.log(w, h, JSON.stringify(plains.map((q) => [q.name, q.pre, q.dmg])), '\n', bands.map((b) => `${b.name} ${JSON.stringify(b.seen)}`).join('\n '));
  }
}
