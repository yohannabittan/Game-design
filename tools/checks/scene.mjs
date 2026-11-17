// Arena test moments in one call: a bout with a loadout, a foe, a body size and a held moment (his tell up, a knife raised, the bow drawn),
// and the thumb strokes and knife throws to play into it. Built on exact.mjs's boot (the fake clock), so a moment is the same every run.
//   import { boot } from './exact.mjs';  import { VET } from './arena.mjs';  import { scene, stroke, throwKnife, release, STROKES } from './scene.mjs';
//   const g = await boot({ w: 874, h: 402, save: VET });
//   const info = await scene(g, { weapon: 'spear', dual: true, foe: 'hermes', tell: 'low' });   // info says what was set up
//   await stroke(g, 'JAB'); await stroke(g, [[0,0,0],[6,-12,4],[9,30,-4]]); await throwKnife(g, 'neck');
// Every option is optional; node tools/film.mjs --help lists them (the film tool takes the same ones as flags).
//
// What the helper does so you needn't hunt for it:
//  - A tell is started the only safe way: his swing timer, plan and cover cleared, then startMove, then the page's frame loop pins the tell at
//    `tellAt` of its wind-up every frame so it neither lands nor times out. (Clearing `sw` alone crashes startMove.) Pass `tell: null` for a live fight.
//  - `still` (default true) holds him: he never swings, stays at his home distance, his stamina is full. `foeHp: 999` (default) so a film never ends in a kill.
//  - The play update runs nothing during hit-stop, and the harness steps frames only when told: use g.frames(n), never wait for time.
//  - A new touch snaps your hand to guard: a stroke starts from rest, so end each with a few frames of rest (stroke() does, `rest`).
import { bout } from './exact.mjs';

// thumb paths: keys [frame, dx, dy] from where the thumb lands (the same table tools/verify.mjs uses)
export const STROKES = {
  JAB: [[0, 0, 0], [6, -12, 4], [9, 30, -4], [14, 30, -4]],
  PUSH: [[0, 0, 0], [3, 40, 0], [6, 40, 0]],
  SLASH: [[0, 0, -40], [6, 20, 30], [10, 20, 30]],
  OVERHEAD: [[0, 0, 0], [5, 0, -70], [10, 5, -140], [18, 5, -140], [20, 10, -40], [22, 15, 60], [26, 15, 60]],
  LONGJAB: [[0, 0, 0], [2, 20, -3], [4, 55, -6], [6, 75, -6], [10, 75, -6]],
};
const ZONES = { high: 'high', mid: 'mid', low: 'low', chop: 'high', thrust: 'mid', sweep: 'low' };

// Set a moment up. o: { weapon, dual, side ('sica'|'dagger'|'bow'..), knives, kit [..] | 'none', foe (name / champion key / beast, e.g. 'hermes', 'lion',
// 'Flamma'), foeSize ('runt'..'giant'), size (your body: 'runt'..'giant'), arena ('pit'|'city'|'rome'|'games'), bout (1-5), seed, gold, begin,
// tell ('high'|'mid'|'low' or null), tellKind ('chop'|'thrust'|'sweep'|'combo'|'feint'), tellAt (0..1, default 0.7), still (true), foeHp (999),
// bare (strip his armour and guards), bow ('out' | 'drawn'), knifeUp (true: a knife raised and held) }.
// Returns what was set: { foe, arena, bout, weapon, foeSize, you, ... }. The pointer for a held draw or knife is kept on g.held (release(g) lets go).
export async function scene(g, o = {}) {
  const arena = o.arena || 'pit', rack0 = Math.max(0, (o.bout || 1) - 1);
  const kit = o.kit === 'none' ? [] : o.kit || ['chest'];
  // 1. a named foe is found by rolling gauntlets (pure): the arena and seed whose bout holds him
  let pick = { arena, seed: o.seed || 777, rack: rack0 };
  if (o.foe) {
    const f = await g.ev(([want, arena, seed]) => {
      const P = window.__engine.game.scenes.play, w = String(want).toLowerCase();
      const hit = (d) => d && [d.name, d.ck, d.beast, d.title, d.beast && `${d.beast}`].some((v) => v && String(v).toLowerCase().includes(w));
      const arenas = [arena, ...P.ARENAS.map((a) => a.id).filter((a) => a !== arena)];
      for (const id of arenas) { const A = P.ARENAS.find((a) => a.id === id);
        for (let s = seed; s < seed + 400; s++) { const gt = P.rollGauntlet(s, null, A, null); const r = gt.findIndex(hit); if (r >= 0) return { arena: id, seed: s, rack: r }; } }
      return null;
    }, [o.foe, arena, pick.seed]);
    if (!f) throw new Error(`scene: no foe matching "${o.foe}" in any arena (try a champion key, a beast, or a name such as 'Flamma', 'hermes', 'lion')`);
    pick = f;
  }
  // 2. the bout, begun on the fake clock
  await bout(g, { w: o.weapon || 'gladius', kit, side: o.side || null, dual: !!o.dual, mace: o.weapon === 'mace', arena: pick.arena, seed: pick.seed, knives: o.knives || 0, gold: o.gold || 0, begin: !!o.begin });
  const info = await g.ev(([o, rack, kit]) => {
    const E = window.__engine, P = E.game.scenes.play, s = P.state, T = P.TUNING;
    // your body size, then his
    if (o.size) {
      const k = T.me.wheels.size.findIndex((e) => e[0] === o.size); if (k < 0) throw new Error(`scene: unknown size ${o.size}`);
      const me = s.me; me.idx = me.idx.slice(); me.idx[0] = k;
      s.me = { ...P.kitMe(me, o.weapon === 'mace' ? 'axe' : o.weapon || 'gladius', kit, !!o.dual), str: 3, side: o.side || null, mace: o.weapon === 'mace', origin: 'capua' };
    }
    if (o.foeSize) s.gauntlet[rack].size = P.sizeOf(o.foeSize);
    P.newRackAt(E, rack);
    if (o.begin) P.beginBout(E); else s.intro = false;
    s.bout.foeShrug = true;
    const f = s.foe;
    if (o.bare) for (const p of f.parts) { p.armour = false; p.guard = false; }
    if (o.foeHp !== 0) f.hp = f.maxHp = o.foeHp || 999;
    return { foe: `${f.name}${f.beast ? ` (${f.beast})` : ''}`, foeWeapon: f.weapon && f.weapon.id, foeSize: f.size && f.size.id, arena: s.arena && (s.arena.id || s.arena), bout: s.rack + 1, weapon: s.me.weapon, dual: !!s.me.dual, side: s.me.side || null, knives: s.knives, kit: s.me.kit };
  }, [o, pick.rack, kit]);
  // 3. he holds still (and the tell, if asked, is pinned)
  if (o.still !== false) await holdStill(g);
  await g.frames(o.settle == null ? 30 : o.settle);
  if (o.tell) { info.tell = await holdTell(g, o.tell, o.tellKind, o.tellAt); await g.until(() => { const w = window.__engine.game.scenes.play.state.sw; return !w || w.t >= window.__holdTell * w.wind - 0.02; }, 180); await g.frames(2); }
  if (o.bow) await bowUp(g, o.bow === 'drawn');
  if (o.knifeUp) await knifeUp(g);
  info.you = await g.ev(() => { const P = window.__engine.game.scenes.play; return { size: P.state.me.size, hp: P.state.hp }; });
  return info;
}

// He stands still and never swings: every frame (from the page's own loop) his swing timer is held off, his plan and cover cleared, his stamina full,
// and the gap kept at his home distance. Unlike exact.mjs's still(), a tell started by holdTell() is left alone (that is pinned by its own loop).
export const holdStill = (g) => g.ev(() => {
  if (window.__stillOn2) return; window.__stillOn2 = 1;
  const P = window.__engine.game.scenes.play, raf = window.requestAnimationFrame;
  const f = () => { const s = P.state; if (s && s.foe) { s.swingIn = 99; s.plan = null; s.cover = null; s.stamina = s.staMax; if (window.__holdTell == null) { s.sw = null; s.move = null; } s.step.x = s.step.tgt = s.foe.home; } raf(f); };
  raf(f);
});

// Start his tell at a height and hold it there. Returns the zone and the move kind. (Re-callable: it replaces a tell already up.)
export async function holdTell(g, zone, kind, at = 0.7) {
  const z = ZONES[zone]; if (!z) throw new Error(`scene: tell must be high, mid or low (got ${zone})`);
  const k = kind || (z === 'high' ? 'chop' : z === 'low' ? 'sweep' : 'thrust');
  return g.ev(([z, k, at]) => {
    const E = window.__engine, P = E.game.scenes.play, s = P.state;
    // zero everything that would start or end a move on its own, then start one
    s.swingIn = 99; s.sw = null; s.plan = null; s.cover = null; s.move = null;
    const mv = P.buildMove(s.rng, k, { avoid: null, wind: 1 });
    // a chop is high, a sweep low, a thrust mid (a spear's thrust may roll high): force the asked height on the first blow
    if (mv.hits[0] && k !== 'combo' && k !== 'feint') mv.hits[0].zone = z;
    P.startMove(E, mv, false);
    window.__holdTell = at;
    if (!window.__holdOn) {
      window.__holdOn = 1; const raf = window.requestAnimationFrame;
      const f = () => { const w = P.state && P.state.sw; if (w && window.__holdTell != null && !w.fin) { w.t = Math.min(w.t, window.__holdTell * w.wind); s.swingIn = 99; } raf(f); };
      raf(f);
    }
    return { zone: s.sw.zone && s.sw.zone.id, kind: s.sw.kind };
  }, [z, k, at]);
}
export const dropTell = (g) => g.ev(() => { window.__holdTell = null; const s = window.__engine.game.scenes.play.state; s.sw = null; s.move = null; });

// a thumb path by name (STROKES) or keys [frame, dx, dy]; from (x0, y0) as fractions of the screen (default 0.7, 0.45: the right side where the weapon thumb lives),
// then `rest` frames of rest. Returns nothing: look at the page.
export async function stroke(g, name, { x = 0.7, y = 0.45, rest = 12, id = 7 } = {}) {
  const keys = typeof name === 'string' ? STROKES[name] : name;
  if (!keys) throw new Error(`stroke: unknown "${name}" (have ${Object.keys(STROKES).join(', ')}, or pass keys [frame, dx, dy])`);
  // (the same path as exact.mjs's g.stroke, built from g.down / g.move / g.up / g.frames, so a film that wraps them sees every frame and the thumb)
  const x0 = x <= 1 ? g.w * x : x, y0 = y <= 1 ? g.h * y : y;
  await g.down(x0 + keys[0][1], y0 + keys[0][2], id);
  for (let i = 1; i < keys.length; i++) {
    const [a, ax, ay] = keys[i - 1], [b, bx, by] = keys[i];
    for (let t = a + 1; t <= b; t++) { await g.frames(1); const u = (t - a) / (b - a); await g.move(x0 + ax + (bx - ax) * u, y0 + ay + (by - ay) * u, id); }
  }
  await g.frames(1);
  const [, lx, ly] = keys[keys.length - 1];
  await g.up(x0 + lx, y0 + ly, id); await g.frames(1);
  if (rest) await g.frames(rest);
}

// Raise a knife (thumb down on the KNIFE button), held. Needs knives > 0. The thumb stays down on g.held until release() or throwKnife().
export async function knifeUp(g, id = 5) {
  const b = await g.ev(() => { const E = window.__engine, P = E.game.scenes.play; P.state.intro = false; return P.armsBtns(E).knife; });
  if (!b) throw new Error('knifeUp: no KNIFE button (give the scene knives: N)');
  await g.down(b.x, b.y, id); await g.frames(9);
  g.held = { kind: 'knife', id, x: b.x, y: b.y, bx: b.x, by: b.y };
  return g.held;
}
// Raise the bow (the swap), and with `drawn` put the thumb down and draw it fully, held.
export async function bowUp(g, drawn = false, id = 6) {
  await g.ev(() => { const E = window.__engine, P = E.game.scenes.play; if (!P.state.bowOut) P.swapBow(E); });
  await g.until(() => window.__engine.game.scenes.play.state.swapT <= 0, 90);
  if (drawn) {
    const x = g.w * 0.75, y = g.h * 0.6;
    await g.down(x, y, id); g.held = { kind: 'bow', id, x, y, bx: x, by: y };
    await g.frames(80);
  }
  return g.held || null;
}
// let go of whatever thumb is held (a knife is thrown where it is aimed; a bow looses)
export async function release(g) {
  const h = g.held; if (!h) return;
  await g.up(h.x, h.y, h.id); g.held = null; await g.frames(2);
}

// Throw a knife: target is a part of his body to aim at ('neck', 'head', 'knee', ... : the gap or part name; the thumb slides until the line crosses it),
// or a number, the thumb's slide in px (negative = up). It raises the knife first unless one is already up. `frames` of flight afterwards.
// Returns { part, over } as the aim saw it just before release ('gap' / 'plate' / 'skin' / 'miss').
export async function throwKnife(g, target = 0, { slide = 14, after = 40, onFrame } = {}) {
  if (!g.held || g.held.kind !== 'knife') await knifeUp(g);
  const h = g.held;
  let dy = typeof target === 'number' ? target : null;
  if (dy == null) {
    // sweep the thumb's height in the page (no frames run) and take the middle of the run whose aim line crosses the part
    dy = await g.ev(([want, bx, by, id]) => {
      const E = window.__engine, P = E.game.scenes.play, s = P.state, a = s.aim, w = String(want).toLowerCase();
      const ok = [];
      // (each candidate height needs one frame in the page for the aim to follow it; the film does not see these frames)
      for (let d = -260; d <= 260; d += 6) { a.ty = by + d; a.sy = by; window.__replay.frame([]); if (a.part && String(a.part).toLowerCase().includes(w)) ok.push(d); }
      a.ty = by; a.sy = by; window.__replay.frame([]);
      return ok.length ? ok[Math.floor(ok.length / 2)] : null;
    }, [target, h.bx, h.by, h.id]);
    if (dy == null) throw new Error(`throwKnife: no thumb height aims at "${target}" (a gap shows only when his armour leaves one: try bare: true, or a part such as 'head')`);
  }
  for (let i = 1; i <= slide; i++) { const u = i / slide, k = u * u * (3 - 2 * u); h.y = h.by + dy * k; await g.move(h.x, h.y, h.id); await g.frames(1); if (onFrame) await onFrame(); }
  await g.frames(8);
  const seen = await g.ev(() => { const a = window.__engine.game.scenes.play.state.aim; return a ? { part: a.part, over: a.over } : null; });
  await release(g);
  for (let i = 0; i < after; i++) { await g.frames(1); if (onFrame) await onFrame(); }
  return seen;
}
