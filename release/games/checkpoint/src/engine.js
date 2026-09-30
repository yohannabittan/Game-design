// engine.js - the shared runtime every game in this repo is built on.
//
// Contract: a game exports `game` (see game.js) and the engine drives it.
// The engine owns: canvas + DPR, the loop, unified touch/mouse/keyboard input,
// scenes, local save, a tiny synth for audio, haptics, seeded RNG, and juice
// helpers (shake, particles, tweens), the dev/release channel (ADR-0016), and
// the playtest ledger with its Export scene. Games should not touch the DOM.
// The engine's own DOM: the toast, and one hidden textarea that the Export
// scene uses as the select-all fallback for Copy.
//
// Coordinates: everything is in CSS pixels. engine.w / engine.h are the
// current viewport size. Portrait phone is the primary target.

// ---------- RNG (deterministic, for "smart randomness") ----------
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  const rng = () => {
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (min, max) => min + rng() * (max - min);
  rng.int = (min, max) => Math.floor(rng.range(min, max + 1));
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.chance = (p) => rng() < p;
  rng.shuffle = (arr) => { const a2 = arr.slice(); for (let i = a2.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a2[i], a2[j]] = [a2[j], a2[i]]; } return a2; };
  return rng;
}
export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ---------- Easing / tween ----------
export const ease = {
  linear: (t) => t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inQuad: (t) => t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  outBack: (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  outElastic: (t) => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1,
  inOut: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
};
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

// ---------- Save (localStorage, namespaced, versioned) ----------
class Save {
  constructor(slug, version, migrate, channel = 'dev') {
    // The release channel shares an origin with dev, so it gets its own key and the two never mix (ADR-0016).
    this.key = channel === 'release' ? `game:${slug}.release` : `game:${slug}`;
    this.version = version;
    this.data = {};
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) {
        const parsed = JSON.parse(raw);
        const from = parsed.__v || 1;
        this.data = parsed.data || {};
        // __ledger belongs to the engine (ADR-0016): migrate never sees it and cannot drop it.
        const ledger = this.data.__ledger;
        delete this.data.__ledger;
        if (from < version && migrate) this.data = migrate(this.data, from) || this.data;
        if (ledger) this.data.__ledger = ledger;
      }
    } catch (e) { this.data = {}; }
  }
  get(k, def) { return k in this.data ? this.data[k] : def; }
  set(k, v) { this.data[k] = v; this.flush(); return v; }
  update(k, fn, def) { return this.set(k, fn(this.get(k, def))); }
  flush() { try { localStorage.setItem(this.key, JSON.stringify({ __v: this.version, data: this.data })); } catch (e) {} }
  reset() { const ledger = this.data.__ledger; this.data = {}; if (ledger) this.data.__ledger = ledger; this.flush(); }
}

// ---------- Audio (tiny synth, no asset files) ----------
class Audio {
  constructor(save) {
    this.save = save;
    this.ctx = null;
    this.muted = !!save.get('__muted', false);
  }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; }
  }
  toggleMute() { this.muted = !this.muted; this.save.set('__muted', this.muted); return this.muted; }
  // beep({freq, dur, type, gain, slide}) - slide multiplies freq over dur (e.g. 0.5 = fall an octave)
  beep({ freq = 440, dur = 0.08, type = 'square', gain = 0.15, slide = 1, delay = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  noise({ dur = 0.15, gain = 0.2, delay = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = gain;
    src.connect(g).connect(this.ctx.destination); src.start(t0);
  }
  // A few named sounds so one-shot prompts can just say "play 'hit'". vol scales loudness (0.3 = quiet).
  play(name, vol = 1) {
    const b = (o) => this.beep({ ...o, gain: (o.gain ?? 0.15) * vol });
    const n = (o) => this.noise({ ...o, gain: (o.gain ?? 0.2) * vol });
    const s = {
      tap: () => b({ freq: 660, dur: 0.05 }),
      hit: () => { b({ freq: 880, dur: 0.08, slide: 1.5 }); n({ dur: 0.05, gain: 0.08 }); },
      miss: () => b({ freq: 220, dur: 0.18, type: 'sawtooth', slide: 0.5 }),
      win: () => [523, 659, 784, 1047].forEach((f, i) => b({ freq: f, dur: 0.12, delay: i * 0.09, type: 'triangle' })),
      lose: () => [392, 330, 262].forEach((f, i) => b({ freq: f, dur: 0.2, delay: i * 0.15, type: 'sawtooth', gain: 0.12 })),
      coin: () => { b({ freq: 988, dur: 0.06, type: 'triangle' }); b({ freq: 1319, dur: 0.12, delay: 0.06, type: 'triangle' }); },
      boom: () => { n({ dur: 0.3, gain: 0.3 }); b({ freq: 120, dur: 0.3, type: 'sine', slide: 0.3, gain: 0.3 }); },
    }[name];
    if (s) s();
  }
}

// ---------- Ledger (append-only local playtest record, ADR-0016) ----------
const LEDGER_CAP = 200;
class Ledger {
  constructor(save) { this.save = save; this.cap = LEDGER_CAP; }
  get entries() { const l = this.save.get('__ledger', null); return l && Array.isArray(l.entries) ? l.entries : []; }
  // add('result', { level: 3, strokes: 5 }): scalars only; anything else is stored as JSON text. Oldest entries drop past the cap.
  add(kind, data = {}) {
    const d = {};
    for (const [k, v] of Object.entries(data || {})) {
      const t = typeof v;
      d[k] = v === null || t === 'boolean' ? v : t === 'number' ? (Number.isFinite(v) ? +v.toFixed(3) : null) : (t === 'string' ? v : JSON.stringify(v) || '').slice(0, 80);
    }
    const entries = this.entries.concat({ t: Date.now(), k: String(kind).trim().replace(/\s+/g, '_').slice(0, 32) || 'event', d });
    while (entries.length > this.cap) entries.shift();
    this.save.set('__ledger', { entries });
    return entries.length;
  }
  static fmtAgo(ms) {
    const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    const two = (n) => String(n).padStart(2, '0');
    return h ? `${h}:${two(m)}:${two(r)}` : `${m}:${two(r)}`;
  }
  static fmtData(d) {
    return Object.entries(d || {}).map(([k, v]) => `${k}=${typeof v === 'string' && /[\s"=]/.test(v) ? JSON.stringify(v) : v}`).join(' ');
  }
  // The block a tester pastes: a header, then one line per entry, time counted from the first entry kept.
  text(E) {
    const es = this.entries, t0 = es.length ? es[0].t : 0;
    const head = [
      `Game: ${E.game.title}`,
      `Channel: ${E.channel}`,
      `Version: ${E.releaseVersion || 'dev'}`,
      `Viewport: ${E.w}x${E.h}`,
      `Date: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`,
      `Entries: ${es.length}`,
      '',
    ];
    return head.concat(es.map((e) => `${Ledger.fmtAgo(e.t - t0)} ${e.k}${Object.keys(e.d || {}).length ? ' ' + Ledger.fmtData(e.d) : ''}`)).join('\n');
  }
}

// ---------- Particles ----------
class Particles {
  constructor() { this.list = []; }
  emit({ x, y, count = 12, speed = 160, spread = Math.PI * 2, angle = 0, life = 0.5, size = 4, color = '#fff', gravity = 0, drag = 0.98, shrink = true, rng = Math.random }) {
    for (let i = 0; i < count; i++) {
      const a = angle + (rng() - 0.5) * spread;
      const s = speed * (0.4 + rng() * 0.8);
      this.list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, size: size * (0.6 + rng() * 0.8), color, gravity, drag, shrink });
    }
  }
  update(dt) {
    for (const p of this.list) { p.vy += p.gravity * dt; p.vx *= p.drag; p.vy *= p.drag; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    this.list = this.list.filter((p) => p.life > 0);
  }
  render(ctx) {
    for (const p of this.list) {
      const t = p.life / p.max;
      ctx.globalAlpha = t;
      ctx.fillStyle = p.color;
      const r = p.shrink ? p.size * t : p.size;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.1, r), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  clear() { this.list = []; }
}

// ---------- Engine ----------
export class Engine {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;
    this.T = game.TUNING || {};
    this.w = 0; this.h = 0; this.dpr = 1;
    this.time = 0; this.frame = 0;
    this.scene = null; this.sceneName = null;
    this.pointers = new Map();
    this.keys = new Set();
    // ADR-0016: <meta name="channel" content="release"> and <meta name="release-version" content="v0.3"> are written by tools/release.sh.
    const meta = (n) => { const m = document.querySelector(`meta[name="${n}"]`); return m ? (m.content || '').trim() : ''; };
    this.channel = meta('channel') === 'release' ? 'release' : 'dev';
    this.releaseVersion = meta('release-version');
    this.save = new Save(game.slug, game.saveVersion || 1, game.migrate, this.channel);
    this.ledger = new Ledger(this.save);
    this.audio = new Audio(this.save);
    this.particles = new Particles();
    this.rng = makeRng(Date.now() & 0xffffffff);
    this.tweens = [];
    this._shake = { amt: 0, t: 0, dur: 0 };
    this._flash = { color: null, t: 0, dur: 0 };
    this._toast = document.getElementById('toast');
    this._toastCb = null;
    this._tuneShown = this.channel !== 'release'; // release hides TUNE until five title taps
    this._titleTaps = [];
    this._bind();
  }

  // --- lifecycle ---
  start() {
    this.resize();
    this.save.update('__opens', (n) => n + 1, 0); // also proves storage works on first launch
    this._setupTune();
    this._setupExport();
    if (this.game.init) this.game.init(this);
    this.setScene(this.game.start || Object.keys(this.game.scenes)[0]);
    let last = performance.now();
    const loop = (now) => {
      const dt = clamp((now - last) / 1000, 0, 1 / 20); // never step more than 50ms: tab switches don't explode physics
      last = now;
      this._tick(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  _tick(dt) {
    this.time += dt; this.frame++;
    for (const tw of this.tweens) { tw.t += dt; const k = clamp(tw.t / tw.dur, 0, 1); tw.fn(tw.ease(k)); if (k >= 1 && tw.done) tw.done(); }
    this.tweens = this.tweens.filter((tw) => tw.t < tw.dur);
    if (this.scene && this.scene.update) this.scene.update(dt, this);
    this.particles.update(dt);
    if (this._shake.t > 0) this._shake.t -= dt;
    if (this._flash.t > 0) this._flash.t -= dt;
    this._render();
  }
  _render() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = this.T.bg || '#0f1115';
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.save();
    if (this._shake.t > 0) {
      const k = (this._shake.t / this._shake.dur) * this._shake.amt;
      ctx.translate((Math.random() - 0.5) * 2 * k, (Math.random() - 0.5) * 2 * k);
    }
    if (this.scene && this.scene.render) this.scene.render(ctx, this);
    this.particles.render(ctx);
    ctx.restore();
    this._tuneTab = this._exportTab = null;
    if (this.sceneName === 'menu') {
      if (this._tune && this._tuneShown) {
        this._tuneTab = { x: this.w - 74 - this.safe.right, y: this.safe.top + 10, w: 64, h: 32 };
        this.roundRect(this._tuneTab.x, this._tuneTab.y, 64, 32, 10, '#1f2937', '#475569');
        this.text('TUNE', this._tuneTab.x + 32, this._tuneTab.y + 16, { size: 13, color: '#9aa4b2' });
      }
      // Top-left mirror of the TUNE tab, in both channels: a 72 x 44 target.
      this._exportTab = { x: 10 + this.safe.left, y: this.safe.top + 4, w: 72, h: 44 };
      this.roundRect(this._exportTab.x, this._exportTab.y, 72, 44, 10, '#1f2937', '#475569');
      this.text('EXPORT', this._exportTab.x + 36, this._exportTab.y + 22, { size: 14, color: '#9aa4b2' });
    }
    if (this._flash.t > 0) {
      ctx.globalAlpha = (this._flash.t / this._flash.dur) * 0.6;
      ctx.fillStyle = this._flash.color; ctx.fillRect(0, 0, this.w, this.h); ctx.globalAlpha = 1;
    }
  }
  resize() {
    this._safe = null;
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.w = window.innerWidth; this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    if (this.scene && this.scene.resize) this.scene.resize(this);
  }

  // --- scenes ---
  setScene(name, params = {}) {
    if (this.scene && this.scene.exit) this.scene.exit(this);
    const s = this.game.scenes[name];
    if (!s) throw new Error(`Unknown scene: ${name}`);
    this.scene = s; this.sceneName = name;
    this.pointers.clear();
    if (s.enter) s.enter(this, params);
  }

  // --- juice ---
  shake(amt = 6, dur = 0.25) { this._shake = { amt, t: dur, dur }; }
  flash(color = '#fff', dur = 0.12) { this._flash = { color, t: dur, dur }; }
  tween(dur, fn, easing = ease.outQuad, done) { this.tweens.push({ t: 0, dur, fn, ease: easing, done }); }
  haptic(ms = 10) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }
  toast(msg, onTap) {
    this._toast.textContent = msg; this._toast.classList.add('show');
    this._toast.style.pointerEvents = onTap ? 'auto' : 'none';
    this._toastCb = onTap || null;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this._toast.classList.remove('show'), onTap ? 15000 : 2500);
  }
  dailySeed() { const d = new Date(); return hashString(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`); }

  // --- tune panel: playtest experiment variables as sliders ---
  // A game declares `experiments: [{ key: 'needle.wideScale', label: 'Wide needle', min: 1, max: 2.5, step: 0.05 }]`
  // and optionally `presets: [{ label: 'Flowy', values: { 'needle.wideScale': 1.8, 'needle.growRate': 4 } }]`,
  // shown as buttons above the sliders so a tester compares whole feels, not knobs.
  // Keys are paths into TUNING. Values are applied live, saved per game, and shown so the tester can report them.
  _setupTune() {
    const ex = this.game.experiments;
    if (!ex || !ex.length) return;
    this._tune = ex.map((e) => ({ ...e, def: this._getPath(e.key) }));
    // Declared keys are the sliders plus every key a preset sets. Only those are restored or kept in the save;
    // anything else saved by an earlier build is pruned, so a stale experiment can never silently apply (ADR-0014).
    const presetKeys = new Set((this.game.presets || []).flatMap((p) => Object.keys(p.values)));
    this._tuneDefs = {};
    for (const k of presetKeys) if (!this._tune.some((e) => e.key === k)) this._tuneDefs[k] = this._getPath(k);
    for (const e of this._tune) this._tuneDefs[e.key] = e.def;
    // The release channel runs on TUNING as shipped: saved tune values are neither applied nor pruned (ADR-0016).
    const saved = this.channel === 'release' ? {} : this.save.get('__tune', {});
    const kept = {};
    for (const k of Object.keys(saved)) if (k in this._tuneDefs) { kept[k] = saved[k]; this._setPath(k, saved[k]); }
    if (this.channel !== 'release' && Object.keys(kept).length !== Object.keys(saved).length) this.save.set('__tune', kept);
    const E = this;
    this.game.scenes.tune = this.game.scenes.tune || {
      enter() { this.drag = null; },
      presetRow() {
        const ps = E.game.presets || [];
        if (!ps.length) return [];
        const x0 = 20, gap = 8, w = (E.w - 40 - gap * (ps.length - 1)) / ps.length, y = E.safe.top + 58;
        return ps.map((p, i) => ({ p, x: x0 + i * (w + gap), y, w, h: 40 }));
      },
      layout() {
        const top = E.safe.top + 70 + (E.game.presets && E.game.presets.length ? 56 : 0), rowH = 66, x = 28, w = E.w - 56;
        return E._tune.map((e, i) => ({ e, x, y: top + i * rowH, w, track: { x, y: top + i * rowH + 34, w, h: 24 } }));
      },
      render(ctx) {
        E.text('Tune', E.w / 2, E.safe.top + 30, { size: 24, weight: '800' });
        this.back = E.button('Back', 60, E.safe.top + 30, { w: 84, h: 36, size: 15, fill: '#334155' });
        this.reset = E.button('Reset', E.w - 60, E.safe.top + 30, { w: 84, h: 36, size: 15, fill: '#334155' });
        for (const b of this.presetRow()) {
          const active = Object.entries(b.p.values).every(([k, v]) => Math.abs(E._getPath(k) - v) < 1e-9);
          E.roundRect(b.x, b.y, b.w, b.h, 12, active ? '#3b82f6' : '#1f2937', active ? null : '#475569');
          E.text(b.p.label, b.x + b.w / 2, b.y + b.h / 2, { size: 14, color: active ? '#fff' : '#cbd5e1' });
        }
        for (const r of this.layout()) {
          const v = E._getPath(r.e.key);
          E.text(r.e.label || r.e.key, r.x, r.y + 12, { size: 15, align: 'left', color: '#e6e6e6' });
          E.text(E._fmt(v, r.e.step), r.x + r.w, r.y + 12, { size: 15, align: 'right', color: '#fbbf24' });
          E.roundRect(r.track.x, r.track.y + 8, r.track.w, 8, 4, '#1f2937');
          const k = clamp((v - r.e.min) / (r.e.max - r.e.min), 0, 1);
          E.roundRect(r.track.x, r.track.y + 8, r.track.w * k, 8, 4, '#3b82f6');
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(r.track.x + r.track.w * k, r.track.y + 12, 12, 0, Math.PI * 2); ctx.fill();
          E.text(E._fmt(r.e.min, r.e.step), r.x, r.y + 60, { size: 11, align: 'left', color: '#64748b' });
          E.text(E._fmt(r.e.max, r.e.step), r.x + r.w, r.y + 60, { size: 11, align: 'right', color: '#64748b' });
        }
      },
      _set(r, px) {
        const k = clamp((px - r.track.x) / r.track.w, 0, 1);
        let v = r.e.min + k * (r.e.max - r.e.min);
        if (r.e.step) v = Math.round(v / r.e.step) * r.e.step;
        v = +v.toFixed(6);
        E._setPath(r.e.key, v);
        E.save.update('__tune', (t) => ({ ...t, [r.e.key]: v }), {});
      },
      onPointerDown(p) {
        const r = this.layout().find((r) => p.y >= r.track.y - 12 && p.y <= r.track.y + 36 && p.x >= r.x - 16 && p.x <= r.x + r.w + 16);
        if (r) { this.drag = r; this._set(r, p.x); }
      },
      onPointerMove(p) { if (this.drag) this._set(this.drag, p.x); },
      onPointerUp(p) { this.drag = null; },
      onTap(p) {
        if (this.back && E.hit(this.back, p)) E.setScene('menu');
        else if (this.reset && E.hit(this.reset, p)) { for (const [k, v] of Object.entries(E._tuneDefs)) E._setPath(k, v); E.save.set('__tune', {}); }
        else for (const b of this.presetRow()) if (E.hit(b, p)) {
          for (const [k, v] of Object.entries(b.p.values)) E._setPath(k, v);
          E.save.update('__tune', (t) => ({ ...t, ...b.p.values }), {});
          E.audio.play('tap');
        }
      },
    };
  }
  // --- export scene: the ledger as plain text with a Copy button (ADR-0016) ---
  // Reached from the EXPORT tab the engine draws on the menu. The hidden textarea is the engine's one DOM exception besides the toast.
  _setupExport() {
    const E = this;
    const MONO = 'ui-monospace, Menlo, Consolas, monospace', SZ = 12, LH = 17;
    this.game.scenes.__export = {
      enter(_, params) {
        this.from = (params && params.from) || 'menu';
        this.text = E.ledger.text(E); this.scroll = 0; this.drag = null; this.lines = null;
        const ta = this.ta = document.createElement('textarea');
        ta.readOnly = true; ta.value = this.text; ta.setAttribute('aria-hidden', 'true'); ta.tabIndex = -1;
        ta.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;font:12px ui-monospace,Menlo,monospace;user-select:text;-webkit-user-select:text;';
        document.body.appendChild(ta);
      },
      exit() { if (this.ta) this.ta.remove(); this.ta = null; },
      body() { const top = E.safe.top + 60, bottom = E.h - E.safe.bottom - 92; return { x: 16 + E.safe.left, y: top, w: E.w - 32 - E.safe.left - E.safe.right, h: Math.max(60, bottom - top) }; },
      wrap(ctx, w) {
        ctx.font = `${SZ}px ${MONO}`;
        const cols = Math.max(10, Math.floor(w / ctx.measureText('M').width)), out = [];
        for (const raw of this.text.split('\n')) {
          let l = raw;
          if (!l.length) { out.push(''); continue; }
          out.push(l.slice(0, cols)); l = l.slice(cols);
          while (l.length) { out.push('  ' + l.slice(0, cols - 2)); l = l.slice(cols - 2); }
        }
        return out;
      },
      render(ctx) {
        const b = this.body();
        E.text('Export', E.w / 2, E.safe.top + 30, { size: 24, weight: '800' });
        this.back = E.button('Back', 16 + E.safe.left + 42, E.safe.top + 30, { w: 84, h: 44, size: 15, fill: '#334155' });
        this.copyBtn = E.button('Copy', E.w / 2, E.h - E.safe.bottom - 40, { w: Math.min(280, E.w * 0.7), h: 56, size: 20 });
        E.roundRect(b.x - 8, b.y - 8, b.w + 16, b.h + 16, 10, '#0b0e14', '#263042');
        if (!this.lines || this.lw !== b.w) { this.lines = this.wrap(ctx, b.w); this.lw = b.w; }
        const max = Math.max(0, this.lines.length * LH - b.h);
        this.scroll = clamp(this.scroll, 0, max);
        ctx.save(); ctx.beginPath(); ctx.rect(b.x - 4, b.y - 4, b.w + 8, b.h + 8); ctx.clip();
        this.lines.forEach((l, i) => {
          const y = b.y + i * LH - this.scroll + LH / 2;
          if (y > b.y - LH && y < b.y + b.h + LH) E.text(l, b.x, y, { size: SZ, font: MONO, align: 'left', weight: '400', color: i < 6 ? '#fbbf24' : '#cbd5e1' });
        });
        ctx.restore();
        if (max > 0) E.roundRect(b.x + b.w + 4, b.y + (b.h - 30) * (this.scroll / max), 3, 30, 2, '#475569');
      },
      onPointerDown(p) { this.drag = { y: p.y, s: this.scroll }; },
      onPointerMove(p) { if (this.drag) this.scroll = this.drag.s - (p.y - this.drag.y); },
      onPointerUp() { this.drag = null; },
      onTap(p) {
        if (this.back && E.hit(this.back, p)) E.setScene(this.from);
        else if (this.copyBtn && E.hit(this.copyBtn, p)) this.copy();
      },
      // Clipboard API when the browser allows it, else select-all in the hidden textarea and execCommand; if even that
      // fails the textarea is shown over the text so the tester can long-press and copy it themselves.
      copy() {
        const ta = this.ta, text = this.text;
        const fallback = () => {
          let ok = false;
          try { ta.select(); ta.setSelectionRange(0, text.length); ok = document.execCommand('copy'); } catch (e) {}
          if (!ok) {
            const b = this.body();
            ta.style.cssText = `position:fixed;left:${b.x - 8}px;top:${b.y - 8}px;width:${b.w + 16}px;height:${b.h + 16}px;box-sizing:border-box;margin:0;padding:8px;border:0;border-radius:10px;background:#0b0e14;color:#cbd5e1;font:12px/17px ui-monospace,Menlo,monospace;z-index:5;outline:none;resize:none;user-select:text;-webkit-user-select:text;`;
            ta.focus(); ta.select(); ta.setSelectionRange(0, text.length);
          }
          E.toast(ok ? 'Copied' : 'Text selected: long-press it and choose Copy');
        };
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(() => E.toast('Copied'), fallback); return; }
        } catch (e) {}
        fallback();
      },
    };
  }
  // Five quick taps on the title band reveal the TUNE tab in the release channel. The band is the top strip of the menu, clear of
  // both tabs; a game may set E.titleArea = { x, y, w, h } to say where its title really is. Returns true when the tap is consumed.
  _titleTap(p) {
    const a = this.titleArea || { x: 0, y: 0, w: this.w, h: this.safe.top + Math.max(110, this.h * 0.16) };
    if (!this.hit(a, p) || (this._exportTab && this.hit(this._exportTab, p))) { this._titleTaps = []; return false; }
    const now = performance.now();
    this._titleTaps = this._titleTaps.filter((t) => now - t < 2000).concat(now);
    if (this._titleTaps.length < 5) return false;
    this._titleTaps = []; this._tuneShown = true;
    this.haptic(20); this.audio.play('coin', 0.5); this.toast('TUNE tab unlocked');
    return true;
  }
  _fmt(v, step) { const d = step && step < 1 ? Math.min(3, Math.ceil(-Math.log10(step))) : 0; return Number(v).toFixed(d); }
  _getPath(key) { return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), this.T); }
  _setPath(key, v) { const ks = key.split('.'); let o = this.T; for (const k of ks.slice(0, -1)) { if (o[k] == null) o[k] = {}; o = o[k]; } o[ks[ks.length - 1]] = v; }

  // --- drawing helpers (so one-shots share a look) ---
  text(str, x, y, { size = 16, color = '#e6e6e6', align = 'center', baseline = 'middle', weight = '600', font = 'system-ui, sans-serif', alpha = 1 } = {}) {
    const ctx = this.ctx;
    ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = baseline;
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.fillText(str, x, y); ctx.globalAlpha = 1;
  }
  roundRect(x, y, w, h, r, fill, stroke) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  }
  // Draws a big thumb-friendly button and returns its rect for hit-testing.
  button(label, cx, cy, { w = Math.min(280, this.w * 0.7), h = 56, fill = '#3b82f6', color = '#fff', size = 20 } = {}) {
    const x = cx - w / 2, y = cy - h / 2;
    this.roundRect(x, y, w, h, 14, fill);
    this.text(label, cx, cy, { size, color });
    return { x, y, w, h };
  }
  hit(rect, p) { return p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h; }
  // Safe area insets (notch, home bar). Games should keep HUD inside these.
  get safe() {
    if (!this._safe) { const s = getComputedStyle(document.documentElement); const px = (v) => parseFloat(v) || 0; this._safe = { top: px(s.getPropertyValue('--sat')), bottom: px(s.getPropertyValue('--sab')), left: px(s.getPropertyValue('--sal')), right: px(s.getPropertyValue('--sar')) }; }
    return this._safe;
  }

  // --- input ---
  _bind() {
    const c = this.canvas;
    const toP = (e) => ({ id: e.pointerId, x: e.clientX, y: e.clientY });
    c.addEventListener('pointerdown', (e) => {
      e.preventDefault(); this.audio.unlock();
      c.setPointerCapture && c.setPointerCapture(e.pointerId);
      const p = toP(e); p.startX = p.x; p.startY = p.y; p.startT = this.time; p.down = true; p.dx = 0; p.dy = 0;
      this.pointers.set(p.id, p);
      this.scene && this.scene.onPointerDown && this.scene.onPointerDown(p, this);
    }, { passive: false });
    c.addEventListener('pointermove', (e) => {
      e.preventDefault();
      const p = this.pointers.get(e.pointerId); if (!p) return;
      p.x = e.clientX; p.y = e.clientY; p.dx = p.x - p.startX; p.dy = p.y - p.startY;
      this.scene && this.scene.onPointerMove && this.scene.onPointerMove(p, this);
    }, { passive: false });
    const up = (e) => {
      e.preventDefault();
      const p = this.pointers.get(e.pointerId); if (!p) return;
      p.x = e.clientX; p.y = e.clientY; p.dx = p.x - p.startX; p.dy = p.y - p.startY; p.down = false;
      p.dt = this.time - p.startT;
      this.pointers.delete(p.id);
      const moved = Math.hypot(p.dx, p.dy);
      p.isTap = moved < 12 && p.dt < 0.35;
      p.isSwipe = moved > 40 && p.dt < 0.5;
      if (p.isSwipe) p.swipeDir = Math.abs(p.dx) > Math.abs(p.dy) ? (p.dx > 0 ? 'right' : 'left') : (p.dy > 0 ? 'down' : 'up');
      p.cancelled = e.type === 'pointercancel'; // system gesture or palm: scenes must not act on it
      if (p.cancelled) p.isTap = p.isSwipe = false;
      if (p.isTap && this._tune && this.sceneName === 'menu' && this._tuneTab && this.hit(this._tuneTab, p)) { this.setScene('tune'); return; }
      if (p.isTap && this.sceneName === 'menu' && this._exportTab && this.hit(this._exportTab, p)) { this.setScene('__export', { from: this.sceneName }); return; }
      if (p.isTap && this.channel === 'release' && this._tune && !this._tuneShown && this.sceneName === 'menu' && this._titleTap(p)) return;
      this.scene && this.scene.onPointerUp && this.scene.onPointerUp(p, this);
      if (p.isTap && this.scene && this.scene.onTap) this.scene.onTap(p, this);
      if (p.isSwipe && this.scene && this.scene.onSwipe) this.scene.onSwipe(p, this);
    };
    c.addEventListener('pointerup', up, { passive: false });
    c.addEventListener('pointercancel', up, { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => { this.keys.add(e.key); this.scene && this.scene.onKey && this.scene.onKey(e.key, this); });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key));
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 100));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.save.flush(); this.scene && this.scene.onPause && this.scene.onPause(this); }
    });
    this._toast.addEventListener('click', () => { if (this._toastCb) this._toastCb(); this._toast.classList.remove('show'); });
  }
}
