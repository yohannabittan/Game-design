#!/usr/bin/env node
// replay: play a recorded input script against a game with time, frames and Math.random made exact, and dump the run state as JSON.
//   node tools/replay.mjs <script.json> [--root <checkout>] > dump.json
// Two runs of one script give byte-identical dumps, so a dump taken before a change and one taken after prove the change left play alone
// (ADR-0024). Nothing in the game or the engine changes: before the game loads, an init script replaces requestAnimationFrame with a manual
// frame queue, performance.now, Date.now and Date with a fake clock, and Math.random with a seeded generator. The harness then steps one
// frame at a time at exactly 1/60 s and sends each recorded pointer event before the frame it is due on.
// The painted art loads in real time, so the harness lets every load settle after boot (and after any frame that asked for a new image)
// before it steps on: what a frame draws never depends on how fast the network was.
// A script (JSON):
//   { "slug": "arena", "w": 844, "h": 390, "seed": 1,              viewport and the Math.random seed
//     "save": { ... },                                             save data written before boot (plain data, migrate skipped)
//     "tune": { "foe.hp": 4 },                                     TUNING paths set before the start, as the TUNE panel would
//     "start": { "scene": "play", "params": { ... },               the scene to start and its params; for play, "me": { "roll", "weapon",
//                "me": { "roll": 777, "weapon": "gladius", "kit": ["chest"], "side": null } },   "kit", "side" } builds the fighter in the page
//     "frames": 3000, "every": 600,                                frames to run, and a state snapshot every N frames
//     "events": [[frame, "down"|"move"|"up", x, y, pointerId], ...] }
// The dump: { script, snapshots: [{ frame, scene, time, state, scene_fields }...], final: { ..., save, ledger } }, with the cosmetic fields
// (particles, pops, trails, sprite caches, canvases and images) left out.
// As a module: import { launch } from './replay.mjs' gives the same harness to a script recorder (tools/checks/replays/make.mjs).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { serve, loadPlaywright, ROOT as HERE } from './drive.mjs';

// Fields that only draw: left out of every dump, wherever they sit.
export const COSMETIC = ['fx', 'pops', 'streaks', 'trail', 'trails', 'particles', 'dust', 'sparks', 'zfx', 'cv', 'spr', 'sprite', 'img', 'im', 'canvas', 'ghosts'];

// In the page, before any game code: the fake clock, the frame queue and the seeded Math.random.
function determinism(seed) {
  let now = 1000;
  const EPOCH = Date.UTC(2026, 0, 1);
  let s = seed >>> 0;
  Math.random = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  performance.now = () => now;
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(EPOCH + now); }
    static now() { return EPOCH + now; }
  }
  window.Date = FakeDate;
  let queue = [], nextId = 1;
  window.requestAnimationFrame = (cb) => { const id = nextId++; queue.push([id, cb]); return id; };
  window.cancelAnimationFrame = (id) => { queue = queue.filter((q) => q[0] !== id); };
  const canvas = () => document.querySelector('canvas');
  const fire = (type, x, y, id) => {
    const c = canvas();
    c.setPointerCapture = () => {};
    c.dispatchEvent(new PointerEvent(`pointer${type}`, { pointerId: id, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true }));
  };
  // one frame: the events due on it, then every queued callback at the new time
  const frame = (events) => {
    for (const [type, x, y, id] of events || []) fire(type, x, y, id);
    now += 1000 / 60;
    const run = queue; queue = [];
    for (const [, cb] of run) cb(now);
  };
  // images the page has asked for and not yet loaded and decoded
  window.__imgPending = 0;
  const desc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    configurable: true, get() { return desc.get.call(this); },
    set(v) {
      window.__imgPending++;
      let done = false;
      const end = () => { if (!done) { done = true; window.__imgPending--; } };
      this.addEventListener('load', () => { (this.decode ? this.decode() : Promise.resolve()).then(end, end); }, { once: true });
      this.addEventListener('error', end, { once: true });
      desc.set.call(this, v);
    },
  });
  window.__replay = { frame, fire, get now() { return now; } };
}

// A plain copy of a value for the dump: no functions, no DOM or canvas objects, no cosmetic fields, cycles cut.
function snapshot(cosmetic) {
  const skip = new Set(cosmetic);
  const seen = new WeakSet();
  const plain = (v, depth) => {
    if (v === null || typeof v !== 'object') {
      if (typeof v === 'function') return undefined;
      if (typeof v === 'number' && !Number.isFinite(v)) return String(v);
      return v;
    }
    if (depth > 12) return '[deep]';
    if (typeof Node !== 'undefined' && v instanceof Node) return undefined;
    if (typeof OffscreenCanvas !== 'undefined' && v instanceof OffscreenCanvas) return undefined;
    if (typeof ImageBitmap !== 'undefined' && v instanceof ImageBitmap) return undefined;
    if (typeof CanvasRenderingContext2D !== 'undefined' && v instanceof CanvasRenderingContext2D) return undefined;
    if (v instanceof Map || v instanceof Set || v instanceof WeakMap || v instanceof WeakSet) return undefined;
    if (seen.has(v)) return '[ref]';
    seen.add(v);
    let out;
    if (Array.isArray(v)) out = v.map((x) => { const y = plain(x, depth + 1); return y === undefined ? null : y; });
    else {
      out = {};
      for (const k of Object.keys(v)) {
        if (skip.has(k)) continue;
        const y = plain(v[k], depth + 1);
        if (y !== undefined) out[k] = y;
      }
    }
    seen.delete(v);
    return out;
  };
  const E = window.__engine, P = E.game.scenes.play;
  const sceneFields = {};
  if (E.scene && E.scene !== P) for (const k of Object.keys(E.scene)) { const y = plain(E.scene[k], 1); if (y !== undefined && !skip.has(k)) sceneFields[k] = y; }
  return { frame: E.frame, scene: E.sceneName, time: E.time, state: E.sceneName === 'play' || E.sceneName === 'over' ? plain(P.state, 0) : null, sceneFields };
}

export async function launch(script, { root = HERE } = {}) {
  const { chromium } = await loadPlaywright();
  const srv = await serve(root);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: script.w || 844, height: script.h || 390 }, deviceScaleFactor: script.dpr || 1, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  const slug = script.slug || 'arena';
  const errs = [];
  let inflight = 0, lastNet = 0;
  ctx.on('request', () => { inflight++; lastNet = Date.now(); });
  ctx.on('requestfinished', () => { inflight--; lastNet = Date.now(); });
  ctx.on('requestfailed', () => { inflight--; lastNet = Date.now(); });
  await ctx.addInitScript(determinism, script.seed || 1);
  if (script.save !== undefined) {
    await ctx.addInitScript(([key, val]) => { try { localStorage.setItem(key, val); } catch (e) {} }, [`game:${slug}`, JSON.stringify({ __v: 999, data: script.save })]);
  }
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !/candidates\.json/.test(m.location().url || '')) errs.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
  await page.goto(`${srv.base}/games/${slug}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__engine);
  // every load settled: nothing in flight on the network or in the page for a while
  const settle = async (quiet = 300, max = 30000) => {
    const t0 = Date.now();
    for (;;) {
      const pending = await page.evaluate(() => window.__imgPending);
      if (!inflight && !pending && Date.now() - lastNet >= quiet) return;
      if (Date.now() - t0 > max) { errs.push(`settle: still loading after ${max} ms (${inflight} requests, ${pending} images)`); return; }
      await new Promise((r) => setTimeout(r, 25));
    }
  };
  await settle(500);
  const h = {
    page, errors: () => errs.slice(), settle,
    // step n frames, sending the events due on each (events: [[frame, type, x, y, id], ...] with frames counted from the start)
    async step(n, events = [], from = 0) {
      const due = new Map();
      for (const [f, type, x, y, id] of events) { if (!due.has(f)) due.set(f, []); due.get(f).push([type, x, y, id]); }
      let f = from;
      while (f < from + n) {
        // run frames in the page up to the next load: a frame that starts an image load stops the batch so it can settle
        const batch = [];
        for (let k = f; k < from + n && batch.length < 120; k++) batch.push(due.get(k) || []);
        const ran = await page.evaluate((batch) => {
          let i = 0;
          for (; i < batch.length; i++) { const before = window.__imgPending; window.__replay.frame(batch[i]); if (window.__imgPending > before) { i++; break; } }
          return i;
        }, batch);
        f += ran;
        if (inflight || await page.evaluate(() => window.__imgPending)) await settle(100);
      }
      return f;
    },
    snap: () => page.evaluate(snapshot, COSMETIC),
    async final() {
      const s = await page.evaluate(snapshot, COSMETIC);
      const extra = await page.evaluate(() => {
        const E = window.__engine, save = { ...E.save.data };
        return { save: JSON.parse(JSON.stringify(save)), ledger: E.ledger.text(E) };
      });
      return { ...s, ...extra };
    },
    close: async () => { await browser.close(); srv.close(); },
  };
  // the start: TUNING paths, then the scene (for play, the fighter is built in the page from the roll, weapon, kit and sidearm)
  await page.evaluate((st) => {
    const E = window.__engine, P = E.game.scenes.play;
    for (const [k, v] of Object.entries(st.tune || {})) E._setPath(k, v);
    const s = st.start || { scene: 'menu' }, params = { ...(s.params || {}) };
    if (s.me) {
      const m = s.me, me = { ...P.kitMe(P.rollMe(m.roll, m.open || []), m.weapon || 'gladius', m.kit || [], !!m.dual), side: m.side || null };
      if (params.resume) params.resume = { ...params.resume, me }; else params.me = me;
    }
    E.setScene(s.scene, params);
  }, { tune: script.tune, start: script.start });
  return h;
}

// Plays a script start to end; returns the dump.
export async function replay(script, opts) {
  const h = await launch(script, opts);
  try {
    const snaps = [], every = script.every || 0, total = script.frames;
    let f = 0;
    while (f < total) {
      const n = every ? Math.min(every - (f % every), total - f) : total - f;
      f = await h.step(n, script.events || [], f);
      if (every && f % every === 0 && f < total) snaps.push(await h.snap());
    }
    const final = await h.final();
    const errors = h.errors();
    return { script: script.name || '', frames: total, snapshots: snaps, final, errors };
  } finally { await h.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const a = process.argv.slice(2);
  const file = a.find((x) => !x.startsWith('--') && a[a.indexOf(x) - 1] !== '--root');
  if (!file) { console.error('usage: node tools/replay.mjs <script.json> [--root <checkout>] > dump.json'); process.exit(2); }
  const root = a.includes('--root') ? resolve(a[a.indexOf('--root') + 1]) : HERE;
  const dump = await replay(JSON.parse(readFileSync(file, 'utf8')), { root });
  process.stdout.write(JSON.stringify(dump, null, 1) + '\n');
  if (dump.errors.length) { console.error(dump.errors.join('\n')); process.exit(1); }
}
