// Helpers for Launch's browser checks (a name starting with _ is not run as a check).
// A veteran save as stored (v11): 150 flights, every place passed, the lessons done.
export const VET = (o = {}) => ({
  best: 4800, sugar: 400, ms: [500, 1000, 1500, 2200], flights: 150, up: { band: 2, fuel: 2, aero: 1, rocket: 1, steady: 1, scope: 1 },
  goalsDone: [], perfectRow: 0, birdTaught: true, mudTaught: true, home: false, actionsTaught: true, openSeen: 2, placesSeen: 4,
  proposed: false, lesson: 3, ...o,
});
export const FRESH = {};

// A flight begun in the page (lock and fire with no wait) and moved to `before` units short of the Tea Party line, at (y, vx, vy).
// mud: a caramel pit laid from the line + mud[0] to + mud[1] (units).
export const atLine = (g, o = {}) => g.ev((o) => {
  const E = window.__engine, P = E.game.scenes.play, sim = E.game.sim, S = sim.S, T = E.game.TUNING, U = T.unitsPerMetre;
  if (E.sceneName !== 'play' || S.run) E.setScene('play', { seed: o.seed || 5 });
  P.lock(E); P.fire(E);
  const r = S.run, line = T.milestones[4] * U;
  sim.ensureField(r.field, line + 3000);
  if (o.mud) { // lay a pit where none overlaps
    const f = r.field.ground, x0 = line + o.mud[0], x1 = line + o.mud[1];
    for (let i = f.length - 1; i >= 0; i--) if (f[i].x1 >= x0 - 1 && f[i].x0 <= x1 + 1) f.splice(i, 1);
    const at = f.findIndex((q) => q.x0 > x1);
    f.splice(at < 0 ? f.length : at, 0, { kind: 'mud', x0, x1, w: x1 - x0, h: 0, spent: false });
  }
  r.x = line - (o.before ?? 30); r.maxX = r.x; r.nextMark = Math.ceil(r.x / (10 * U)) * 10 * U; r.msIdx = 4;
  r.mode = 'air'; r.y = o.y ?? 120; r.vx = o.vx ?? 700; r.vy = o.vy ?? 0; r.fuel = r.fuelCap;
  if (o.catches != null) r.catches = o.catches;
  S.slowT = 0;
  return true;
}, o);

// What the checks read: the play state's flight and beat, the scene, the save.
export const read = (g) => g.ev(() => {
  const E = window.__engine, S = E.game.sim.S, r = S.run;
  return {
    scene: E.sceneName, arrive: S.arrive ? { ...S.arrive } : null, riding: !!S.riding, propose: !!S.propose, rate: S.rate,
    run: r && { x: r.x, y: r.y, vx: r.vx, mode: r.mode, ended: r.ended, boost: r.boost, boosts: r.boosts, chute: r.chute, chutes: r.chutes, ball: r.ball, drops: r.drops, catches: r.catches, t: r.steps },
    save: JSON.parse(JSON.stringify(E.save.data)),
  };
});

// Brings the flight down to a stop: on the ground at no speed (it ends after stopTime).
export const stop = (g) => g.ev(() => { const r = window.__engine.game.sim.S.run; r.mode = 'ground'; r.y = 0; r.vy = 0; r.vx = 0; r.chute = false; r.boost = false; });

// Frames until the scene changes from play, counting each scene entered (with how many frames it took).
export async function scenesUntil(g, want, max = 1200) {
  const seen = [];
  for (let i = 0; i < max; i += 6) {
    await g.frames(6);
    const s = await g.ev(() => window.__engine.sceneName);
    if (seen[seen.length - 1] !== s) seen.push(s);
    if (s === want) return seen;
  }
  return seen;
}
