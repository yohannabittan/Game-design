// engine.js - the shared runtime every game in this repo is built on.
//
// Contract: a game exports `game` (see game.js) and the engine drives it.
// The engine owns: canvas + DPR, the loop, unified touch/mouse/keyboard input,
// scenes, local save, a tiny synth for audio, haptics, seeded RNG, and juice
// helpers (shake, particles, tweens). Games should not touch the DOM.
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
  constructor(slug, version, migrate) {
    this.key = `game:${slug}`;
    this.version = version;
    this.data = {};
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) {
        const parsed = JSON.parse(raw);
        const from = parsed.__v || 1;
        this.data = parsed.data || {};
        if (from < version && migrate) this.data = migrate(this.data, from) || this.data;
      }
    } catch (e) { this.data = {}; }
  }
  get(k, def) { return k in this.data ? this.data[k] : def; }
  set(k, v) { this.data[k] = v; this.flush(); return v; }
  update(k, fn, def) { return this.set(k, fn(this.get(k, def))); }
  flush() { try { localStorage.setItem(this.key, JSON.stringify({ __v: this.version, data: this.data })); } catch (e) {} }
  reset() { this.data = {}; this.flush(); }
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
    this.save = new Save(game.slug, game.saveVersion || 1, game.migrate);
    this.audio = new Audio(this.save);
    this.particles = new Particles();
    this.rng = makeRng(Date.now() & 0xffffffff);
    this.tweens = [];
    this._shake = { amt: 0, t: 0, dur: 0 };
    this._flash = { color: null, t: 0, dur: 0 };
    this._toast = document.getElementById('toast');
    this._toastCb = null;
    this._bind();
  }

  // --- lifecycle ---
  start() {
    this.resize();
    this.save.update('__opens', (n) => n + 1, 0); // also proves storage works on first launch
    this._setupTune();
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
    if (this._tune && this.sceneName === 'menu') {
      this._tuneTab = { x: this.w - 74, y: this.safe.top + 10, w: 64, h: 32 };
      this.roundRect(this._tuneTab.x, this._tuneTab.y, 64, 32, 10, '#1f2937', '#475569');
      this.text('TUNE', this._tuneTab.x + 32, this._tuneTab.y + 16, { size: 13, color: '#9aa4b2' });
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
    const saved = this.save.get('__tune', {});
    for (const e of this._tune) if (e.key in saved) this._setPath(e.key, saved[e.key]);
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
        else if (this.reset && E.hit(this.reset, p)) { for (const e of E._tune) E._setPath(e.key, e.def); E.save.set('__tune', {}); }
        else for (const b of this.presetRow()) if (E.hit(b, p)) {
          for (const [k, v] of Object.entries(b.p.values)) E._setPath(k, v);
          E.save.update('__tune', (t) => ({ ...t, ...b.p.values }), {});
          E.audio.play('tap');
        }
      },
    };
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
