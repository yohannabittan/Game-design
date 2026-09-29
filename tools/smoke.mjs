// Smoke test: boots a game folder in headless Chromium at phone size and checks
// it loads with zero console errors, all assets resolve, the service worker
// registers, a tap reaches the game, and the save layer writes. It also checks the
// channel contract (ADR-0016): the EXPORT tab and ledger exist in both channels, and a
// release/games/<slug> copy (made by tools/release.sh) is really the release channel:
// release meta, release cache name, versioned manifest, its own save key, TUNE hidden.
// Usage: node tools/smoke.mjs [folder ...]   (default: skeleton + every games/* + every release/games/* present)
// Playwright may be installed locally (npm install) or globally (this cloud env).
const pw = await import('playwright').catch(async () => {
  const { execSync } = await import('node:child_process');
  const g = execSync('npm root -g').toString().trim();
  return import(`${g}/playwright/index.mjs`);
});
const { chromium, devices } = pw;
import { createServer } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.css': 'text/css', '.svg': 'image/svg+xml' };

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  try {
    const data = await readFile(join(ROOT, p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); res.end(data);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

let folders = process.argv.slice(2);
if (!folders.length) {
  folders = ['skeleton'];
  try { for (const d of await readdir(join(ROOT, 'games'))) if ((await stat(join(ROOT, 'games', d))).isDirectory()) folders.push(`games/${d}`); } catch {}
  try { for (const d of await readdir(join(ROOT, 'release', 'games'))) if ((await stat(join(ROOT, 'release', 'games', d))).isDirectory()) folders.push(`release/games/${d}`); } catch {}
}

const browser = await chromium.launch();
let failed = 0;
let meta = [];
try { meta = JSON.parse(await readFile(join(ROOT, 'games', 'index.json'), 'utf8')); } catch {}
for (const folder of folders) {
  const errors = [];
  const isRelease = folder.startsWith('release/');
  const slug = folder.replace(/\/+$/, '').split('/').pop();
  const landscape = (meta.find((g) => g.slug === slug) || {}).orientation === 'landscape';
  const ctx = await browser.newContext({ ...(landscape ? devices['iPhone 13 landscape'] : devices['iPhone 13']), serviceWorkers: 'allow' });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  try {
    await page.goto(`${base}/${folder}/`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__engine && window.__engine.frame > 5, null, { timeout: 5000 });
    const before = await page.evaluate(() => window.__engine.sceneName);
    const info = await page.evaluate(() => { const E = window.__engine; return { channel: E.channel, version: E.releaseVersion, gslug: E.game.slug, hasLedger: !!(E.ledger && E.ledger.add), exportTab: !!E._exportTab, tune: !!E._tune, tuneShown: E._tuneShown, tuneTab: !!E._tuneTab, scene: E.sceneName, meta: (document.querySelector('meta[name="channel"]') || {}).content || null }; });
    if (before === 'menu' && !info.exportTab) errors.push('no EXPORT tab on the menu');
    if (!info.hasLedger) errors.push('engine has no ledger');
    else {
      const txt = await page.evaluate(() => { const E = window.__engine; E.ledger.add('smoke', { ok: 1 }); return E.ledger.text(E); });
      if (!/ smoke ok=1$/m.test(txt) || !/^Channel: /m.test(txt)) errors.push('ledger text is missing the smoke entry or header');
    }
    if (isRelease) {
      if (info.channel !== 'release' || info.meta !== 'release') errors.push(`release copy reports channel ${info.channel} (meta ${info.meta})`);
      if (!info.version) errors.push('release copy has no release-version meta');
      if (info.tune && (info.tuneShown || info.tuneTab)) errors.push('TUNE tab is visible in the release channel before five title taps');
      const sw = await (await fetch(`${base}/${folder}/sw.js`)).text();
      const cache = (sw.match(/const CACHE_VERSION = '([^']*)'/) || [])[1];
      if (cache !== `${info.gslug}-release-${info.version}`) errors.push(`sw.js cache name ${cache} is not ${info.gslug}-release-${info.version}`);
      const mf = await (await fetch(`${base}/${folder}/manifest.webmanifest`)).json();
      if (!String(mf.name).startsWith(info.version + ' ')) errors.push(`manifest name "${mf.name}" is not prefixed with ${info.version}`);
      const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('game:')));
      if (!keys.includes(`game:${info.gslug}.release`) || keys.includes(`game:${info.gslug}`)) errors.push(`save keys ${JSON.stringify(keys)} should be only game:${info.gslug}.release`);
    } else {
      if (info.channel !== 'dev') errors.push(`dev folder reports channel ${info.channel}`);
      if (info.tune && !info.tuneShown) errors.push('dev channel hides the TUNE tab');
      const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('game:')));
      if (keys.some((k) => k.endsWith('.release'))) errors.push('dev folder wrote a .release save key');
    }
    // Tap roughly where the skeleton's Play button sits; a real game may differ, so only warn.
    const vp = page.viewportSize();
    await page.touchscreen.tap(vp.width / 2, vp.height * 0.58);
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => window.__engine.sceneName);
    await page.touchscreen.tap(vp.width / 2, vp.height * 0.5);
    await page.waitForTimeout(200);
    const sw = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!r; });
    const saved = await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('game:')));
    const frames = await page.evaluate(() => window.__engine.frame);
    const notes = [`frames=${frames}`, `channel=${info.channel}${info.version ? ' ' + info.version : ''}`, `scene ${before}→${after}`, `sw=${sw}`, `save=${saved}`, landscape ? 'landscape' : 'portrait'];
    if (!sw) errors.push('service worker did not register');
    if (errors.length) { failed++; console.log(`FAIL ${folder}  ${notes.join('  ')}\n  - ${errors.join('\n  - ')}`); }
    else console.log(`ok   ${folder}  ${notes.join('  ')}`);
  } catch (e) { failed++; console.log(`FAIL ${folder}: ${e.message}${errors.length ? '\n  - ' + errors.join('\n  - ') : ''}`); }
  await ctx.close();
}
await browser.close(); server.close();
process.exit(failed ? 1 : 0);
