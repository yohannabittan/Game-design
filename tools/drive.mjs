#!/usr/bin/env node
// drive: play a game headlessly from a script, as a phone would.
//   import { open } from './tools/drive.mjs';
//   const g = await open('ink', { w: 390, h: 844, save: { __v: 3, data: {...} }, offline: false });
//   await g.tap(195, 500); await g.taps([[100, 300, 0], [200, 300, 250]]); await g.shot('/tmp/a.png'); await g.close();
// open() options: w, h (viewport), save (an {__v, data} envelope, or plain data which is wrapped with a huge __v so
// migrate is skipped; written to localStorage before the game loads, once per tab), offline (start with the network off,
// only useful after a first online visit), root (serve another copy of the repo, used by perf --compare).
// CLI: node tools/drive.mjs <slug> [--w 390 --h 844] [--shot out.png] [--offline]
//   boots, screenshots, optionally proves the offline reload, prints one JSON line, exits 1 on any error.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ROOT = resolve(new URL('..', import.meta.url).pathname);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.css': 'text/css', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.webp': 'image/webp', '.jpg': 'image/jpeg' };

// Playwright may be a local install or the global one in the cloud environment.
export async function loadPlaywright() {
  const pw = await import('playwright').catch(async () => {
    const { execSync } = await import('node:child_process');
    return import(`${execSync('npm root -g').toString().trim()}/playwright/index.mjs`);
  });
  return pw.chromium ? pw : pw.default;
}

// Static server on a free port. Returns { base, close }.
export async function serve(root = ROOT) {
  const server = createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    try {
      const data = await readFile(join(root, p));
      res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); res.end(data);
    } catch { res.writeHead(404); res.end('not found'); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

export async function open(slug, { w = 390, h = 844, save, offline = false, root = ROOT } = {}) {
  const { chromium } = await loadPlaywright();
  const srv = await serve(root);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, hasTouch: true, isMobile: true, serviceWorkers: 'allow' });
  const errs = [];
  if (save !== undefined) {
    const env = JSON.stringify(save && save.__v ? save : { __v: 999, data: save });
    await ctx.addInitScript(([key, val]) => {
      try { if (!sessionStorage.getItem('__drive')) { localStorage.setItem(key, val); sessionStorage.setItem('__drive', '1'); } } catch (e) {}
    }, [`game:${slug}`, env]);
  }
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => errs.push(`failed: ${r.url()} (${r.failure()?.errorText})`));
  page.on('response', (r) => { if (r.status() >= 400) errs.push(`${r.status()} ${r.url()}`); });

  const booted = (timeout = 8000) => page.waitForFunction(() => window.__engine && window.__engine.frame > 5, null, { timeout });
  if (offline) await ctx.setOffline(true);
  await page.goto(`${srv.base}/games/${slug}/`, { waitUntil: 'load' });
  await booted();

  return {
    page, ctx, base: srv.base,
    tap: (x, y) => page.touchscreen.tap(x, y),
    // [[x, y, delayMs], ...]: delay is measured from the previous tap's start. Dispatched from one in-page timer chain,
    // so spacing is exact whatever the host is doing. Resolves after the last tap lifts.
    taps: (list) => page.evaluate((list) => new Promise((done) => {
      const c = document.querySelector('canvas');
      c.setPointerCapture = () => {}; // synthetic pointer ids are not capturable
      const fire = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true }));
      let i = 0;
      const next = () => {
        if (i >= list.length) return done();
        const [x, y, d = 0] = list[i++];
        setTimeout(() => { fire('pointerdown', x, y); setTimeout(() => { fire('pointerup', x, y); next(); }, 40); }, d);
      };
      next();
    }), list),
    wait: (ms) => page.waitForTimeout(ms),
    shot: (path) => page.screenshot({ path }),
    eval: (fn, arg) => page.evaluate(fn, arg),
    // Waits for the service worker to control the page, goes offline, reloads; true if the game boots again.
    async offlineReload() {
      await page.evaluate(() => navigator.serviceWorker.ready);
      if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) { await page.reload({ waitUntil: 'load' }); }
      await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 5000 });
      await ctx.setOffline(true);
      try { await page.reload({ waitUntil: 'load' }); await booted(); return true; } catch (e) { errs.push(`offline reload: ${e.message.split('\n')[0]}`); return false; }
    },
    errors: () => errs.slice(),
    close: async () => { await browser.close(); srv.close(); },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const a = process.argv.slice(2);
  const slug = a[0];
  const opt = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
  if (!slug || slug.startsWith('--')) { console.error('usage: node tools/drive.mjs <slug> [--w 390 --h 844] [--shot out.png] [--offline]'); process.exit(2); }
  const out = { slug, ok: false };
  let g;
  try {
    g = await open(slug, { w: +opt('--w', 390), h: +opt('--h', 844) });
    if (a.includes('--shot')) { await g.shot(opt('--shot')); out.shot = opt('--shot'); }
    out.scene = await g.eval(() => window.__engine.sceneName);
    out.frames = await g.eval(() => window.__engine.frame);
    if (a.includes('--offline')) out.offline = await g.offlineReload();
    out.errors = g.errors();
    out.ok = out.errors.length === 0 && out.offline !== false;
  } catch (e) { out.errors = [...(g ? g.errors() : []), e.message.split('\n')[0]]; }
  console.log(JSON.stringify(out));
  if (g) await g.close();
  process.exit(out.ok ? 0 : 1);
}
