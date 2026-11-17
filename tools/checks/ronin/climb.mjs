// Ronin layer 1: a fixed route of swipes climbs the village and rings the bell; the staircase chains three without landing;
// a sword bandit's strike costs a heart when you stand in his reach, and dashing through him during the tell costs nothing; an arrow is cut.
// Each swipe is a fixed target in world units; the stroke's direction is worked out from where the ronin is, as a player aims.
import { boot } from '../exact.mjs';

const S = (g) => g.ev(() => { const s = window.__engine.game.scenes.play.state; return s && { x: s.p.x, y: s.p.y, ground: !!s.p.ground, dash: !!s.p.dash, kills: s.kills, chain: s.chain, best: s.bestChain, hearts: s.hearts, end: s.end, cut: s.arrowsCut || 0, scene: window.__engine.sceneName }; });

// A quick, clean 3-frame flick from mid-screen toward world point (tx, ty), or toward bandit i.
async function flick(g, to) {
  const v = await g.ev((to) => {
    const s = window.__engine.game.scenes.play.state, H = 0.1;
    const t = typeof to === 'number' ? { x: s.bandits[to].x, y: s.bandits[to].y + H / 2 } : to;
    const dx = t.x - s.p.x, dy = t.y - (s.p.y + H / 2), l = Math.hypot(dx, dy);
    return [dx / l * 40, -dy / l * 40];
  }, to);
  await g.stroke(g.w / 2, g.h * 0.6, [[0, 0, 0], [3, v[0], v[1]]]);
}
const settle = (g) => g.until(() => { const s = window.__engine.game.scenes.play.state; return s.p.ground || s.end; }, 300);
const airborne = (g) => g.until(() => { const s = window.__engine.game.scenes.play.state; return !s.p.dash && s.stop <= 0; }, 60);

// The route: [target, wait]. A bandit target is flicked at until he falls (at most three flicks, as a player would);
// 'land' then waits until standing, 'air' only until the dash ends (a chain). 'stair' records the chain after the staircase.
export const ROUTE = [
  [0, 'land'], [1, 'land'],
  [{ x: 0.62, y: 0.66 }, 'air'], [{ x: 0.8, y: 0.72 }, 'land'],
  [2, 'land'],
  [3, 'air'], [4, 'air'], [5, 'air'], ['stair', null],
  [{ x: 0.62, y: 1.92 }, 'air'], [{ x: 0.75, y: 2.0 }, 'land'],
  [{ x: 0.66, y: 2.3 }, 'air'], [{ x: 0.66, y: 2.6 }, 'land'],
  [7, 'air'], [8, 'air'], [9, 'air'], [10, 'air'], [11, 'air'],
  [{ x: 0.5, y: 4.06 }, 'air'], [{ x: 0.5, y: 4.06 }, 'air'],
];

const dead = (g, i) => g.ev((i) => !!window.__engine.game.scenes.play.state.bandits[i].dead, i);

export async function runRoute(g, onStep) {
  let stair = null;
  for (const [to, wait] of ROUTE) {
    const s0 = await S(g);
    if (s0.end || s0.scene !== 'play') break;
    if (to === 'stair') { stair = s0; continue; }
    for (let n = 0; n < (typeof to === 'number' ? 3 : 1); n++) {
      if (typeof to === 'number' && await dead(g, to)) break;
      await flick(g, to);
      await airborne(g); await g.frames(3);
    }
    if (wait === 'land') await settle(g);
    if (onStep) await onStep(to);
  }
  return stair;
}

export default async function (t) {
  for (const [w, h] of [[390, 844], [375, 667]]) {
    const g = await t.boot({ slug: 'ronin', w, h });
    await g.ev(() => window.__engine.setScene('play'));
    await g.frames(2);
    const stair = await runRoute(g);
    t.ok(`${w}x${h}: the staircase chains three without landing`, stair && stair.chain >= 3, JSON.stringify(stair));
    await g.until(() => window.__engine.sceneName === 'over', 200);
    const over = await g.ev(() => ({ scene: window.__engine.sceneName, p: window.__engine.scene.p }));
    t.ok(`${w}x${h}: the route rings the bell`, over.scene === 'over' && over.p && over.p.won, JSON.stringify(over).slice(0, 200));
    t.is(`${w}x${h}: every bandit on the route cut`, over.p && over.p.kills, (k) => k >= 11, 'at least 11 of 12');
    // One tap on Again restarts.
    const r = await g.ev(() => window.__engine.scene.btnAgain);
    await g.tapRect(r);
    t.eq(`${w}x${h}: Again restarts in one tap`, await g.ev(() => window.__engine.sceneName), 'play');
  }

  // The tell: stand in a sword bandit's reach through his strike and lose a heart; dash through him during the tell and lose nothing.
  const g = await t.boot({ slug: 'ronin', w: 390, h: 844 });
  await g.ev(() => { const E = window.__engine; E.setScene('play'); const s = E.game.scenes.play.state; s.p.x = 0.42; s.p.y = 0.17; s.p.ground = s.ledges[1]; });
  await g.until(() => window.__engine.game.scenes.play.state.bandits[0].phase === 'strike', 200);
  t.eq('standing in reach through the strike costs a heart', (await S(g)).hearts, 2);
  await g.ev(() => { const E = window.__engine; E.setScene('play'); });
  await g.until(() => window.__engine.game.scenes.play.state.bandits[0].phase === 'tell', 200);
  await g.ev(() => { const s = window.__engine.game.scenes.play.state; s.p.x = 0.42; s.p.y = 0.17; s.p.ground = s.ledges[1]; });
  await flick(g, 0);
  await g.frames(40);
  const a = await S(g);
  t.ok('dashing through him during the tell kills him and costs nothing', a.kills === 1 && a.hearts === 3, JSON.stringify(a));

  // An arrow is cut by a dash through it.
  await g.ev(() => { const E = window.__engine; E.setScene('play'); const s = E.game.scenes.play.state; s.p.x = 0.3; s.p.y = 0; s.arrows.push({ x: 0.45, y: 0.05, ux: -1, uy: 0, t: 0, cut: null }); });
  await flick(g, { x: 0.6, y: 0.05 });
  await g.frames(10);
  const c = await S(g);
  t.ok('a dash through an arrow cuts it', c.cut === 1 && c.hearts === 3, JSON.stringify(c));
}
