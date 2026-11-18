// The Capuan Feint trial played by real taps: a read is possible. The bot lets every fake pass, then taps the real blow's block button `lead` s before
// it lands (the perfect window is TUNING.shield.perfect). Trials.mjs sets the score directly; this one plays for it, so it fails if no read can happen.
import { VET } from '../arena.mjs';

const log = (...a) => process.env.CAPUAN_LOG && console.log(...a);
// one trial attempt: returns { reads, notes, exchanges }, the bot tapping `lead` s before each real blow
async function play(g, lead, all = false) {
  await g.ev(() => { window.__notes = []; window.__last = null; window.__engine.setScene('play', { trial: 'capuan' }); }); await g.frames(30);
  const btns = await g.ev(async () => (await import('./src/fight.js')).shieldBtns(window.__engine).map((b) => ({ z: b.z && b.z.id, x: b.x + b.w / 2, y: b.y + b.h / 2 })));
  const notes = [];
  for (let n = 0; n < (all ? 30 : 12); n++) {
    // step in the page to the first frame the real blow is `lead` s from landing (or the trial's end)
    const hit = await g.until((arg) => {
      const E = window.__engine; if (E.sceneName !== 'play') return true;
      const st = E.game.scenes.play.state, tr = st.trial; if (!tr) return true;
      if (tr.note && tr.note.s && window.__last !== tr.note) { window.__last = tr.note; (window.__notes = window.__notes || []).push(tr.note.s); }
      const sw = st.sw; return !!(sw && !sw.outcome && st.move && st.move.sig === 'capuan' && (arg.all || !sw.dud) && sw.wind - sw.t <= arg.lead && window.__tapped !== sw);
    }, 900, { lead, all });
    const s = await g.ev(() => { const E = window.__engine, st = E.game.scenes.play.state; if (E.sceneName !== 'play' || !st.trial) return null; const sw = st.sw;
      if (sw) window.__tapped = sw;
      return sw && st.move && st.move.sig === 'capuan' ? { z: sw.zone.id, rem: sw.wind - sw.t, fakes: st.move.idx } : null; });
    if (!hit || !s) break;
    const b = btns.find((q) => q.z === s.z) || btns[0];
    log('tap', s.z, 'rem', s.rem.toFixed(3), 'after fakes', s.fakes);
    await g.tap(b.x, b.y);
    await g.frames(40);
  }
  notes.push(...(await g.ev(() => window.__notes || [])));
  const reads = await g.ev(() => { const st = window.__engine.game.scenes.play.state; return st.trial ? st.trial.score : null; });
  return { reads, notes };
}

export default async function (t) {
  const g = await t.boot({ w: 874, h: 402, save: VET });
  await g.frames(60);
  const count = (r, w) => r.notes.filter((x) => x === w).length;
  // letting the fakes pass and tapping the real blow's button with 0.2 s to go (inside TUNING.shield.perfect, 0.25 s) is a READ, every time
  const good = await play(g, 0.2);
  log('good', JSON.stringify(good));
  t.is('letting every fake pass and blocking the real blow 0.2 s out reads it', count(good, 'READ'), (n) => n >= 3, 'at least 3 READs (the goal)');
  // a block 0.4 s out is raised too early to be perfect: no read
  const early = await play(g, 0.4);
  log('early', JSON.stringify(early));
  t.eq('a block raised 0.4 s out is NOT PERFECT, never a READ', count(early, 'READ'), 0);
  // a thumb that blocks every swing, fakes too, bites the fakes: no read
  const greedy = await play(g, 0.2, true);
  log('greedy', JSON.stringify(greedy));
  t.eq('blocking every swing, the fakes too, is never a READ', count(greedy, 'READ'), 0);
}
