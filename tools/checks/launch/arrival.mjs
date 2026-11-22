// The arrival beat at Tea Party (step 2026-11-22, Decided 2 and 3): on a save that has not had the proposal, crossing the 5000 m line
// plays a ~2 s beat (slow-motion a thumb ends, she leaps onto his back), the result waits for it, and the proposal follows once.
// After the proposal she rides in every flight and there is no beat. Presses in the beat are never lost.
import { VET, atLine, read, stop, scenesUntil } from './_flight.mjs';

const ARRIVE = 2.0;

export default async function (t) {
  // An old save that met her before v0.6 and never had the proposal: as stored at v10 and at v11, so migrate runs.
  for (const v of [9, 10, 11]) {
    const old = v === 9 ? { openSeen: true, proposed: undefined, lesson: undefined } : v === 10 ? { lesson: undefined } : {};
    const g = await t.boot({ slug: 'launch', w: 874, h: 402, raw: { __v: v, data: VET({ home: true, proposed: false, ...old }) } });
    await atLine(g, { before: 20, vx: 600 });
    await g.frames(3);
    let a = await read(g);
    t.ok(`v${v} save with home and no proposal: crossing the line starts the beat`, a.arrive && !a.riding && a.propose, JSON.stringify({ arrive: a.arrive, riding: a.riding, propose: a.propose, lesson: a.save.lesson }));
    await g.frames(12);
    a = await read(g);
    t.ok(`v${v}: the beat slows the flight (rate under 1) while no thumb is down`, a.rate < 0.5 && a.rate > 0, `rate ${a.rate}`);
    await g.frames(50);
    a = await read(g);
    t.ok(`v${v}: by the meeting she is on his back`, a.riding, JSON.stringify(a.arrive));
    await stop(g);
    const seen = await scenesUntil(g, 'over', 2400);
    t.ok(`v${v}: the flight ends, then the proposal once, then the result card`, seen.join(',') === 'play,proposal,over', seen.join(','));
    a = await read(g);
    t.ok(`v${v}: the save has proposed after it`, a.save.proposed === true && a.save.home === true, JSON.stringify({ proposed: a.save.proposed }));
    // the next flight: she rides from the start, and the line plays no beat
    await g.ev(() => window.__engine.setScene('play', { seed: 9 }));
    await atLine(g, { before: 20, vx: 600 });
    await g.frames(30);
    a = await read(g);
    t.ok(`v${v}: next flight she rides from the start and the line plays no beat`, a.riding && !a.arrive && a.rate === 1, JSON.stringify({ riding: a.riding, arrive: a.arrive, rate: a.rate }));
    await stop(g);
    const seen2 = await scenesUntil(g, 'over', 600);
    t.ok(`v${v}: and no second proposal`, seen2.join(',') === 'play,over', seen2.join(','));
  }

  // A fresh-ish save that never reached Tea Party: the beat on the flight that does, at the three sizes.
  for (const [w, h] of [[667, 375], [844, 390], [932, 430]]) {
    const g = await t.boot({ slug: 'launch', w, h, save: VET() });
    await atLine(g, { before: 10, vx: 900, y: 200 });
    await g.frames(2);
    let a = await read(g);
    t.ok(`${w}x${h}: the first crossing on a save starts the beat and owes the proposal`, a.arrive && a.propose, JSON.stringify(a.arrive));
    // the result waits for the beat: end the flight at once
    await stop(g);
    let frames = 0;
    while (frames < 600) { await g.frames(3); frames += 3; const s = await g.ev(() => window.__engine.sceneName); if (s !== 'play') break; }
    const s1 = await g.ev(() => window.__engine.sceneName);
    t.ok(`${w}x${h}: a flight that stops in the beat waits for it (${frames} frames, at least ${Math.round(ARRIVE * 60)}) and goes on to the proposal`, s1 === 'proposal' && frames >= ARRIVE * 60 - 3, `${s1} after ${frames} frames`);
    a = await read(g);
    t.ok(`${w}x${h}: she met him even though the flight had stopped`, a.riding, '');
  }

  // Presses in the beat: boost (held), glide (swipe up), slam (swipe down), each the first press after the line; and a tap.
  {
    const g = await t.boot({ slug: 'launch', w: 874, h: 402, save: VET() });
    const X = 600, Y = 220;
    const cases = [
      ['boost held', async () => { await g.down(X, Y, 3); await g.frames(30); await g.up(X, Y, 3); await g.frames(2); }, (b, a) => a.run.boosts > b.run.boosts],
      ['glide swipe', async () => { await g.stroke(X, Y, [[0, 0, 0], [3, 0, -40], [20, 0, -40]], 3); }, (b, a) => a.run.chutes > b.run.chutes],
      ['slam swipe', async () => { await g.stroke(X, Y, [[0, 0, 0], [3, 0, 40], [5, 0, 40]], 3); }, (b, a) => a.run.drops > b.run.drops],
      ['quick tap', async () => { await g.tap(X, Y, 3); await g.frames(2); }, (b, a) => a.run.boosts > b.run.boosts],
      ['slow swipe up (8 frames)', async () => { await g.stroke(X, Y, [[0, 0, 0], [8, 0, -40], [20, 0, -40]], 3); }, (b, a) => a.run.chutes > b.run.chutes],
    ];
    for (const [name, act, ok] of cases) {
      await g.ev(() => window.__engine.setScene('play', { seed: 4 }));
      await atLine(g, { before: 10, vx: 700, y: 400, vy: 50 });
      await g.frames(15); // in the slow-motion
      const b = await read(g);
      await act();
      const a = await read(g);
      t.ok(`a ${name} in the beat's slow-motion counts, and the thumb ends the slow-motion`, b.arrive && b.rate < 1 && ok(b, a) && a.arrive && a.arrive.thumb && a.rate === 1, JSON.stringify({ before: b.run, after: a.run, rate: [b.rate, a.rate] }));
    }
  }

  // Quit (backgrounded) mid-beat: back to the menu, no proposal yet; the next flight that crosses gets the beat and then the proposal.
  {
    const g = await t.boot({ slug: 'launch', w: 874, h: 402, save: VET() });
    await atLine(g, { before: 10, vx: 700 });
    await g.frames(20);
    await g.ev(() => { const E = window.__engine; E.scene.onPause(E); });
    await g.frames(2);
    let a = await read(g);
    t.ok('backgrounded mid-beat: back to the menu, home saved, no proposal yet', a.scene === 'menu' && a.save.home === true && !a.save.proposed, JSON.stringify({ scene: a.scene, home: a.save.home, proposed: a.save.proposed }));
    await g.ev(() => window.__engine.setScene('play', { seed: 8 }));
    await atLine(g, { before: 10, vx: 700 });
    await g.frames(3);
    a = await read(g);
    t.ok('the next crossing plays the beat again (she has not flown with him yet)', a.arrive && !a.riding && a.propose, JSON.stringify(a.arrive));
    await stop(g);
    const seen = await scenesUntil(g, 'over', 2400);
    t.ok('and the proposal follows it', seen.join(',') === 'play,proposal,over', seen.join(','));
  }

  // Caramel at the line, in the beat: the catch and sling play under the slow-motion; a second caramel ends the flight, and the beat still finishes.
  {
    const g = await t.boot({ slug: 'launch', w: 874, h: 402, save: VET() });
    await atLine(g, { before: 15, vx: 300, y: 4, vy: -60, mud: [-5, 110] });
    let caught = false, slung = false, n = 0;
    while (n < 300) { await g.frames(2); n += 2; const a = await read(g); if (a.run.mode === 'caught') caught = true; if (caught && a.run.mode === 'air') { slung = true; break; } }
    const a = await read(g);
    t.ok('caramel at the line in the beat: he is caught, then slung on, and the flight goes on', caught && slung && !a.run.ended, JSON.stringify({ caught, slung, run: a.run, n }));
    await g.ev(() => window.__engine.setScene('play', { seed: 4 }));
    await atLine(g, { before: 15, vx: 300, y: 4, vy: -60, mud: [-5, 110], catches: 1 });
    const seen = await scenesUntil(g, 'over', 2400);
    const b = await read(g);
    t.ok('a second caramel at the line ends the flight; the beat finishes, then the proposal and the card', seen.join(',') === 'play,proposal,over' && b.save.proposed, seen.join(','));
  }

  // The beat fires once a flight: crossing the line again (forced back) plays nothing.
  {
    const g = await t.boot({ slug: 'launch', w: 874, h: 402, save: VET() });
    await atLine(g, { before: 10, vx: 700 });
    await g.frames(150);
    const a = await read(g);
    await g.ev(() => { const S = window.__engine.game.sim.S, r = S.run, U = window.__engine.game.TUNING.unitsPerMetre; r.x = 5000 * U - 10; r.maxX = r.x; r.msIdx = 4; });
    await g.frames(10);
    const b = await read(g);
    t.ok('the beat ends after about 2 s, and a second crossing in the same flight plays no beat', !a.arrive && a.riding && !b.arrive, JSON.stringify({ a: a.arrive, b: b.arrive }));
  }
}
