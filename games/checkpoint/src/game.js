// game.js - THE file a one-shot prompt replaces. Everything game-specific lives here.
//
// Reference game: "Tap Rush". Targets appear and shrink; tap them before they
// vanish. It exists to prove the contract: scenes, touch input, tuning block,
// seeded randomness, save, juice, audio. Replace it entirely for a real game.
//
// Contract the engine expects:
//   slug, title, saveVersion, migrate?, TUNING, init?, start, scenes{ name: Scene }
//   Scene = { enter?, exit?, update?(dt, E), render?(ctx, E), resize?,
//             onPointerDown?, onPointerMove?, onPointerUp?, onTap?, onSwipe?, onKey?, onPause? }
//   E is the engine: E.w E.h E.time E.save E.audio E.particles E.rng E.text() E.button() E.hit() E.shake() E.flash() E.tween() E.haptic() E.setScene()

import { makeRng, ease, clamp, dist } from './engine.js';

// All numbers a designer would want to tweak. Iterate here first, code second.
const TUNING = {
  bg: '#0f1115',
  lives: 3,
  targetRadius: 42,        // px at spawn
  targetLife: 1.6,         // seconds before it vanishes (a miss)
  spawnEvery: 0.9,         // seconds between spawns at start
  spawnMin: 0.35,          // fastest spawn interval
  rampPerHit: 0.985,       // spawn interval multiplier per hit (difficulty ramp)
  comboWindow: 0.8,        // seconds to keep a combo alive
  colors: ['#f472b6', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa'],
};

const state = {};

function newRun(E, seed) {
  state.rng = makeRng(seed);
  state.seed = seed;
  state.score = 0; state.combo = 0; state.comboT = 0;
  state.lives = TUNING.lives;
  state.targets = [];
  state.spawnT = 0.4; state.spawnEvery = TUNING.spawnEvery;
  state.hits = 0;
}

function spawn(E) {
  const r = TUNING.targetRadius;
  const top = 90, bottom = E.h - 40;
  state.targets.push({
    x: state.rng.range(r + 8, E.w - r - 8),
    y: state.rng.range(top + r, bottom - r),
    r, life: TUNING.targetLife, max: TUNING.targetLife,
    color: state.rng.pick(TUNING.colors),
  });
}

const menu = {
  enter(E) { this.btnDaily = null; this.btnRandom = null; },
  render(ctx, E) {
    E.text('TAP RUSH', E.w / 2, E.h * 0.28, { size: 44, weight: '800' });
    E.text('Tap the circles before they vanish', E.w / 2, E.h * 0.28 + 44, { size: 16, color: '#9aa4b2' });
    const best = E.save.get('best', 0);
    E.text(`Best: ${best}`, E.w / 2, E.h * 0.28 + 80, { size: 18, color: '#fbbf24' });
    this.btnRandom = E.button('Play', E.w / 2, E.h * 0.58);
    this.btnDaily = E.button('Daily seed', E.w / 2, E.h * 0.58 + 76, { fill: '#334155' });
    this.btnMute = E.button(E.audio.muted ? 'Sound: off' : 'Sound: on', E.w / 2, E.h * 0.58 + 152, { fill: '#1f2937', w: 160, h: 44, size: 16 });
  },
  onTap(p, E) {
    if (E.hit(this.btnRandom, p)) { E.audio.play('tap'); E.setScene('play', { seed: (Math.random() * 2 ** 32) >>> 0 }); }
    else if (E.hit(this.btnDaily, p)) { E.audio.play('tap'); E.setScene('play', { seed: E.dailySeed() }); }
    else if (E.hit(this.btnMute, p)) { E.audio.toggleMute(); E.audio.play('tap'); }
  },
};

const play = {
  enter(E, { seed }) { newRun(E, seed); this.pop = 0; },
  update(dt, E) {
    state.spawnT -= dt;
    if (state.spawnT <= 0) { spawn(E); state.spawnT = state.spawnEvery; }
    for (const t of state.targets) t.life -= dt;
    const expired = state.targets.filter((t) => t.life <= 0);
    if (expired.length) { state.targets = state.targets.filter((t) => t.life > 0); expired.forEach(() => this.miss(E)); }
    if (state.comboT > 0) { state.comboT -= dt; if (state.comboT <= 0) state.combo = 0; }
    if (this.pop > 0) this.pop -= dt;
  },
  miss(E) {
    state.lives--; state.combo = 0;
    E.audio.play('miss'); E.shake(8, 0.25); E.flash('#ef4444', 0.15); E.haptic(30);
    if (state.lives <= 0) {
      const best = E.save.get('best', 0);
      if (state.score > best) E.save.set('best', state.score);
      E.save.update('runs', (n) => n + 1, 0);
      // The playtest ledger (ADR-0016): one line per result, so an exported run says what happened without memory.
      E.ledger.add('result', { score: state.score, hits: state.hits, best: Math.max(best, state.score), seed: state.seed });
      E.setScene('over', { score: state.score, best: Math.max(best, state.score), isNew: state.score > best });
    }
  },
  onPointerDown(p, E) {
    // Hit-test from newest target backwards so overlapping targets favour the visible one.
    for (let i = state.targets.length - 1; i >= 0; i--) {
      const t = state.targets[i];
      const r = t.r * (0.35 + 0.65 * (t.life / t.max));
      if (dist(p.x, p.y, t.x, t.y) <= r + 10) {
        state.targets.splice(i, 1);
        state.combo++; state.comboT = TUNING.comboWindow;
        const gained = 10 * state.combo;
        state.score += gained; state.hits++;
        state.spawnEvery = Math.max(TUNING.spawnMin, state.spawnEvery * TUNING.rampPerHit);
        E.audio.play(state.combo >= 5 ? 'coin' : 'hit'); E.haptic(8);
        E.particles.emit({ x: t.x, y: t.y, count: 14, color: t.color, speed: 220, life: 0.4, size: 5 });
        this.pop = 0.15;
        return;
      }
    }
    // Tapped empty space: that's a miss too. Precision matters.
    this.miss(E);
  },
  render(ctx, E) {
    for (const t of state.targets) {
      const k = t.life / t.max;
      const r = t.r * (0.35 + 0.65 * k);
      ctx.globalAlpha = 0.25; ctx.fillStyle = t.color; ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(t.x, t.y, r, 0, Math.PI * 2); ctx.fill();
    }
    const top = 24 + E.safe.top;
    const popScale = 1 + (this.pop > 0 ? this.pop * 2 : 0);
    E.text(`${state.score}`, E.w / 2, top + 16, { size: 34 * popScale, weight: '800' });
    E.text('♥'.repeat(state.lives) + '♡'.repeat(TUNING.lives - state.lives), 20, top + 16, { size: 22, align: 'left', color: '#ef4444' });
    if (state.combo > 1) E.text(`x${state.combo}`, E.w - 20, top + 16, { size: 22, align: 'right', color: '#fbbf24' });
  },
  onPause(E) { /* nothing to persist mid-run in the demo; real games save a resumable run here */ },
};

const over = {
  enter(E, params) {
    this.p = params; this.k = 0;
    E.audio.play(params.isNew ? 'win' : 'lose');
    E.tween(0.6, (t) => { this.k = t; }, ease.outBack);
  },
  render(ctx, E) {
    E.text('Run over', E.w / 2, E.h * 0.3, { size: 36, weight: '800' });
    E.text(`${this.p.score}`, E.w / 2, E.h * 0.3 + 60, { size: 48 * this.k, weight: '800', color: '#fbbf24' });
    E.text(this.p.isNew ? 'New best!' : `Best ${this.p.best}`, E.w / 2, E.h * 0.3 + 110, { size: 18, color: '#9aa4b2' });
    this.btnAgain = E.button('Again', E.w / 2, E.h * 0.62);
    this.btnMenu = E.button('Menu', E.w / 2, E.h * 0.62 + 76, { fill: '#334155' });
  },
  onTap(p, E) {
    if (E.hit(this.btnAgain, p)) E.setScene('play', { seed: (Math.random() * 2 ** 32) >>> 0 });
    else if (E.hit(this.btnMenu, p)) E.setScene('menu');
  },
};

export const game = {
  slug: 'checkpoint',
  title: 'Checkpoint',
  saveVersion: 1,
  migrate(data, fromVersion) { return data; },
  TUNING,
  experiments: [{ key: 'targetLife', label: 'Target lifetime (s)', min: 0.6, max: 3, step: 0.1 }],
  start: 'menu',
  scenes: { menu, play, over },
};
