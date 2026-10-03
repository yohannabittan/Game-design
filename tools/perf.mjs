#!/usr/bin/env node
// perf: frame time of a game's own loop under CPU throttling, at 844x390 (phone, landscape).
//   node tools/perf.mjs <slug> [--scene menu|play] [--throttle 4] [--rounds 6] [--taps '[[x,y,ms],...]'] [--compare <dir-or-git-ref>]
// Each round is a fresh browser. In the page a requestAnimationFrame chain (queued after the game's own) records the
// timestamp delta between frames ("frame") and the time from frame start to the end of a 1-pixel getImageData readback
// ("work"), which forces the frame to really rasterise. Frame is capped by vsync, so work is the number that moves first.
// Scenes: menu is the first screen as booted; play taps the centre once after boot. A game whose play needs other taps
// passes them with --taps (x, y, delay ms; replaces the centre tap, played through drive's g.taps).
// --compare serves a second copy of the repo (a directory, or a git ref exported with `git worktree add` and removed
// afterwards) and alternates rounds A, B, A, B so machine noise lands on both.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { open, ROOT } from './drive.mjs';

const a = process.argv.slice(2);
const slug = a[0];
const opt = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
if (!slug || slug.startsWith('--')) { console.error('usage: node tools/perf.mjs <slug> [--scene menu|play] [--throttle 4] [--rounds 6] [--taps JSON] [--compare dir|ref]'); process.exit(2); }
const scene = opt('--scene', 'menu');
const throttle = +opt('--throttle', 4);
const rounds = +opt('--rounds', 6);
const taps = opt('--taps') ? JSON.parse(opt('--taps')) : null;
const compare = opt('--compare');
const FRAMES = 240, SKIP = 30;

async function round(root) {
  const g = await open(slug, { w: 844, h: 390, root });
  try {
    const cdp = await g.ctx.newCDPSession(g.page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    if (scene === 'play') await g.taps(taps || [[422, 195, 0]]);
    await g.wait(600);
    const r = await g.eval(([frames, skip]) => new Promise((done) => {
      const ctx = document.querySelector('canvas').getContext('2d');
      const dt = [], work = []; let last = 0, n = 0;
      const step = (now) => {
        ctx.getImageData(0, 0, 1, 1);
        if (last && n++ >= skip) { dt.push(now - last); work.push(performance.now() - now); }
        last = now;
        if (dt.length < frames) requestAnimationFrame(step); else done({ dt, work });
      };
      requestAnimationFrame(step);
    }), [FRAMES, SKIP]);
    return { ...r, errors: g.errors() };
  } finally { await g.close(); }
}

const mean = (v) => v.reduce((s, x) => s + x, 0) / v.length;
const p95 = (v) => [...v].sort((x, y) => x - y)[Math.min(v.length - 1, Math.floor(v.length * 0.95))];
const stats = (rs) => {
  const dt = rs.flatMap((r) => r.dt), work = rs.flatMap((r) => r.work);
  return { mean: mean(dt), p95: p95(dt), work: mean(work), workP95: p95(work) };
};
const f = (x) => x.toFixed(2).padStart(8);
const pct = (x, y) => ((y - x) / x * 100).toFixed(1).padStart(7) + '%';

let B = null, tmp = null;
if (compare) {
  if (existsSync(compare) && statSync(compare).isDirectory()) B = resolve(compare);
  else {
    tmp = mkdtempSync(join(tmpdir(), 'perf-ref-'));
    execFileSync('git', ['worktree', 'add', '--detach', tmp, compare], { cwd: ROOT, stdio: 'ignore' });
    B = tmp;
  }
}
const A_r = [], B_r = [];
try {
  for (let i = 0; i < rounds; i++) {
    A_r.push(await round(ROOT));
    if (B) B_r.push(await round(B));
  }
} finally {
  if (tmp) { try { execFileSync('git', ['worktree', 'remove', '--force', tmp], { cwd: ROOT, stdio: 'ignore' }); } catch { rmSync(tmp, { recursive: true, force: true }); } }
}

const sa = stats(A_r), errs = [...new Set([...A_r, ...B_r].flatMap((r) => r.errors))];
console.log(`${slug}  scene=${scene}  throttle=${throttle}x  rounds=${rounds}  ${FRAMES} frames each, 844x390   (ms)`);
console.log('         frame mean  frame p95   work mean   work p95');
console.log(`A (here) ${f(sa.mean)}  ${f(sa.p95)}  ${f(sa.work)}  ${f(sa.workP95)}`);
if (B) {
  const sb = stats(B_r);
  console.log(`B (${compare.length > 12 ? '...' + compare.slice(-9) : compare})`.padEnd(9) + ` ${f(sb.mean)}  ${f(sb.p95)}  ${f(sb.work)}  ${f(sb.workP95)}`);
  console.log(`B vs A   ${pct(sa.mean, sb.mean)}   ${pct(sa.p95, sb.p95)}   ${pct(sa.work, sb.work)}   ${pct(sa.workP95, sb.workP95)}`);
}
if (errs.length) { console.log('errors:\n  ' + errs.join('\n  ')); process.exit(1); }
