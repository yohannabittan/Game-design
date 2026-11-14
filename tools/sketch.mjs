#!/usr/bin/env node
// sketch: turn a sketch page, or frames of the real game, into a GIF the designer can watch on a phone
// (docs/process.md, "Sketch before build").
//   node tools/sketch.mjs page <file.html> <out.gif> [--w 667 --h 375 --fps 18 --secs 3]
//       opens the page headlessly and records it. If the page defines window.renderFrame(n) and window.FRAMES, each
//       frame is drawn by number (exact and repeatable); otherwise it is recorded as it plays for --secs.
//   node tools/sketch.mjs frames <dir> <out.gif> [--fps 18]
//       encodes PNG frames already captured (for example with g.shot in a check script), in name order.
// Also importable: recordPage(file, out, opts) and framesToGif(dir, out, fps).
// Needs ffmpeg on the path. GIFs are 128 colours with a per-clip palette: keep them under about 3 MB and 667 px wide.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, statSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadPlaywright } from './drive.mjs';

export function framesToGif(dir, out, fps = 18) {
  const frames = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
  if (!frames.length) throw new Error(`no PNG frames in ${dir}`);
  // ffmpeg wants numbered names: copy the frames, in order, into a scratch folder
  const tmp = mkdtempSync(join(tmpdir(), 'sketch-'));
  frames.forEach((f, i) => copyFileSync(join(dir, f), join(tmp, `${String(i).padStart(5, '0')}.png`)));
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(fps), '-i', join(tmp, '%05d.png'),
    '-vf', 'split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
    '-loop', '0', out]);
  rmSync(tmp, { recursive: true, force: true });
  return { frames: frames.length, kb: Math.round(statSync(out).size / 1024) };
}

export async function recordPage(file, out, { w = 667, h = 375, fps = 18, secs = 3 } = {}) {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(pathToFileURL(resolve(file)).href);
  await page.waitForLoadState('load');
  const dir = mkdtempSync(join(tmpdir(), 'sketch-frames-'));
  const shot = (n) => page.screenshot({ path: join(dir, `${String(n).padStart(5, '0')}.png`) });
  const planned = await page.evaluate(() => (typeof window.renderFrame === 'function' && window.FRAMES > 0 ? window.FRAMES : 0));
  if (planned) for (let n = 0; n < planned; n++) { await page.evaluate((k) => window.renderFrame(k), n); await shot(n); }
  else { const total = Math.round(secs * fps), t0 = Date.now(); for (let n = 0; n < total; n++) { await shot(n); const lag = (n + 1) * 1000 / fps - (Date.now() - t0); if (lag > 0) await page.waitForTimeout(lag); } }
  await browser.close();
  const res = framesToGif(dir, out, fps);
  rmSync(dir, { recursive: true, force: true });
  return { ...res, exact: !!planned, errors };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const [mode, src, out, ...rest] = process.argv.slice(2);
  const opt = (k, d) => { const i = rest.indexOf(`--${k}`); return i >= 0 ? +rest[i + 1] : d; };
  if (!['page', 'frames'].includes(mode) || !src || !out) { console.error('usage: node tools/sketch.mjs page <file.html> <out.gif> [--w --h --fps --secs] | frames <dir> <out.gif> [--fps]'); process.exit(2); }
  const res = mode === 'frames' ? framesToGif(src, out, opt('fps', 18)) : await recordPage(src, out, { w: opt('w', 667), h: opt('h', 375), fps: opt('fps', 18), secs: opt('secs', 3) });
  console.log(`${out}: ${res.frames} frames, ${res.kb} KB${res.exact === false ? ' (recorded as played)' : ''}${res.errors && res.errors.length ? `  page errors: ${res.errors.join('; ')}` : ''}`);
}
