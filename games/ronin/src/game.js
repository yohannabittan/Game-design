// Ronin, layer 1: swipe to dash-slash up through a village held by bandits.
// World units are screen widths (x 0..1); y grows upward from the street at 0. One level, a plain array.

import { clamp, ease } from './engine.js';

const INK = '#1b1a17', PAPER = '#f1e8d4', RED = '#b8242c', WHITE = '#ffffff', STRAW = '#e2cf9f';

const TUNING = {
  bg: PAPER,
  dash: {
    len: 0.34,      // dash length, share of the screen's width
    time: 0.11,     // seconds a dash takes
    width: 0.05,    // half-width of the cut along the dash
    air: 2,         // air dashes before you must land or kill
    hang: 0.2,      // seconds of slowed fall after a kill
    hangGrav: 0.3,  // gravity scale during the hang
    pop: 0.7,       // upward speed after a kill, widths per s
    carry: 0.25,    // speed kept after a dash without a kill, widths per s
    drag: 6,        // how fast sideways drift dies in the air, per s
    buffer: 0.14,   // a swipe this early during a dash runs when it ends
  },
  swipe: { min: 24 },
  aim: { assist: 14, extra: 0.1 }, // degrees a swipe snaps toward a bandit in reach; reach beyond dash.len
  gravity: 4.4,     // widths per s² (about 2 screen heights per s² at 390x844)
  hearts: 3,
  hitstop: 0.05,    // world freeze on a kill
  body: { r: 0.034, h: 0.1 },
  hurt: { inv: 1.1, knockX: 0.9, knockY: 0.9 },
  bandit: { tell: 0.7, reach: 0.12, rest: 1.2, sight: 0.38, strike: 0.16 },
  archer: { every: 2.4, speed: 0.45, tell: 0.8, sight: 1.15, arrowLife: 4 },
  cam: { follow: 0.36, rate: 9, fallMargin: 0.55 },
  hint: { swipe: 'Swipe anywhere to dash and cut' },
};

// One level. Ledges are one-way platforms {x, y, w}; bandits stand on them.
const LEVELS = [{
  name: 'The village',
  start: { x: 0.16, y: 0 },
  ledges: [
    { x: 0, y: 0, w: 1, street: true },
    { x: 0.34, y: 0.17, w: 0.34 },  // 1. the street: two lone swords
    { x: 0.06, y: 0.44, w: 0.3 },
    { x: 0.62, y: 0.6, w: 0.35 },   // 2. the gap
    { x: 0.36, y: 0.92, w: 0.36 },  // 3. a bandit above a ledge
    { x: 0.23, y: 1.14, w: 0.13 },  // 4. the staircase of three
    { x: 0.5, y: 1.33, w: 0.13 },
    { x: 0.24, y: 1.54, w: 0.13 },
    { x: 0.55, y: 1.86, w: 0.4 },   // 5. the archer's ledge and the way past him
    { x: 0.03, y: 2.2, w: 0.22 },
    { x: 0.5, y: 2.42, w: 0.3 },
    { x: 0.28, y: 2.62, w: 0.15 },  // 6. four and an archer, one flight
    { x: 0.55, y: 2.86, w: 0.15 },
    { x: 0.28, y: 3.1, w: 0.15 },
    { x: 0.56, y: 3.32, w: 0.15 },
    { x: 0.29, y: 3.56, w: 0.17 },
    { x: 0.12, y: 3.88, w: 0.76, roof: true }, // 7. the roof and the bell
  ],
  bandits: [
    { kind: 'sword', x: 0.48, y: 0.17 },
    { kind: 'sword', x: 0.2, y: 0.44 },
    { kind: 'sword', x: 0.54, y: 0.92 },
    { kind: 'sword', x: 0.3, y: 1.14 },
    { kind: 'sword', x: 0.56, y: 1.33 },
    { kind: 'sword', x: 0.3, y: 1.54 },
    { kind: 'archer', x: 0.12, y: 2.2 },
    { kind: 'sword', x: 0.36, y: 2.62 },
    { kind: 'sword', x: 0.62, y: 2.86 },
    { kind: 'sword', x: 0.36, y: 3.1 },
    { kind: 'sword', x: 0.63, y: 3.32 },
    { kind: 'archer', x: 0.38, y: 3.56 },
  ],
  bell: { x: 0.5, y: 4.06 },
}];

// Distance from point (px,py) to segment a-b.
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

function newRun() {
  const L = LEVELS[0];
  const ledges = L.ledges.map((l) => ({ ...l }));
  return {
    level: 0, ledges,
    bandits: L.bandits.map((b) => ({ ...b, face: -1, phase: 'idle', t: 0, rest: 0.6, aim: null, dead: null })),
    arrows: [], slashes: [], ghosts: [], pops: [],
    bell: { ...L.bell, ring: 0 },
    p: { x: L.start.x, y: L.start.y, vx: 0, vy: 0, ground: ledges[0], dash: null, air: TUNING.dash.air, inv: 0, face: 1, hang: 0, hurtT: 0, blink: 0 },
    last: { ledge: ledges[0], x: L.start.x },
    hearts: TUNING.hearts, kills: 0, chain: 0, bestChain: 0, time: 0, stop: 0,
    cam: -0.12, buffered: null, dashed: false, end: null, endT: 0,
  };
}

const play = {
  state: null,
  enter() { this.state = newRun(); this.paused = false; this.touch = null; },

  // World to screen.
  sx(x, E) { return x * E.w; },
  sy(y, E) { return E.h - (y - this.state.cam) * E.w; },
  pauseRect(E) { return { x: E.w - 54 - E.safe.right, y: E.safe.top + 6, w: 48, h: 48 }; },

  onPointerDown(p, E) {
    if (this.paused) { this.touch = { id: p.id, ui: 'resume' }; return; }
    this.touch = { id: p.id, x0: p.x, y0: p.y, fired: false, ui: E.hit(this.pauseRect(E), p) ? 'pause' : null };
  },
  onPointerMove(p, E) {
    const t = this.touch;
    if (!t || t.id !== p.id || t.fired || t.ui === 'resume') return;
    const dx = p.x - t.x0, dy = p.y - t.y0;
    // The dash fires the moment the thumb has travelled swipe.min: no waiting for the lift.
    if (Math.hypot(dx, dy) >= TUNING.swipe.min) { t.fired = true; this.swipe(dx, -dy, E); }
  },
  onPointerUp(p, E) {
    const t = this.touch;
    if (!t || t.id !== p.id) return;
    this.touch = null;
    if (p.cancelled) return;
    if (t.ui === 'resume') {
      if (this.menuRect && E.hit(this.menuRect, p)) { E.setScene('menu'); return; }
      this.paused = false; return;
    }
    if (t.fired) return;
    const dx = p.x - t.x0, dy = p.y - t.y0;
    if (Math.hypot(dx, dy) >= TUNING.swipe.min) this.swipe(dx, -dy, E);
    else if (t.ui === 'pause' && !this.state.end) { this.paused = true; E.audio.play('tap', 0.3); }
  },
  onPause() { if (this.state && !this.state.end) this.paused = true; },
  onKey(k, E) {
    const d = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], q: [-1, 1], e: [1, 1] }[k];
    if (d) this.swipe(d[0], d[1], E);
  },

  swipe(dx, dy, E) {
    const s = this.state;
    if (s.end) return;
    const l = Math.hypot(dx, dy);
    let ux = dx / l, uy = dy / l;
    // Aim assist: a swipe within aim.assist degrees of a bandit in reach goes straight at him.
    const p = s.p, cy = p.y + TUNING.body.h / 2, reach = TUNING.dash.len + TUNING.aim.extra;
    let best = null, bestA = TUNING.aim.assist * Math.PI / 180;
    for (const b of s.bandits) {
      if (b.dead) continue;
      const bx = b.x - p.x, by = b.y + TUNING.body.h / 2 - cy, d = Math.hypot(bx, by);
      if (d > reach || d < 1e-6) continue;
      const a = Math.acos(clamp((bx * ux + by * uy) / d, -1, 1));
      if (a < bestA) { bestA = a; best = [bx / d, by / d]; }
    }
    if (best) [ux, uy] = best;
    if (p.dash || s.stop > 0) { s.buffered = { ux, uy, t: TUNING.dash.buffer }; return; }
    this.startDash(ux, uy, E);
  },

  startDash(ux, uy, E) {
    const s = this.state, p = s.p;
    if (!p.ground) {
      if (p.air <= 0) { p.blink = 0.3; return; }
      p.air--;
    }
    if (p.ground && uy < 0) uy = 0.0001; // no dashing into the floor you stand on
    p.ground = null; p.hang = 0; p.vx = p.vy = 0;
    if (Math.abs(ux) > 0.15) p.face = Math.sign(ux);
    p.dash = { ux, uy, t: 0, kill: false };
    s.dashed = true;
    const cy = p.y + TUNING.body.h / 2;
    s.slashes.push({ x0: p.x, y0: cy, x1: p.x, y1: cy, t: 0, live: true });
    E.audio.beep({ freq: 900, dur: 0.06, type: 'triangle', slide: -500, gain: 0.08 });
  },

  update(dt, E) {
    const s = this.state;
    if (this.paused) return;
    for (const sl of s.slashes) if (!sl.live) sl.t += dt;
    s.slashes = s.slashes.filter((sl) => sl.live || sl.t < 0.28);
    for (const g of s.ghosts) g.t += dt;
    s.ghosts = s.ghosts.filter((g) => g.t < 0.16);
    for (const pp of s.pops) pp.t += dt;
    s.pops = s.pops.filter((pp) => pp.t < 0.8);
    for (const b of s.bandits) if (b.dead) b.dead.t += dt;
    if (s.bell.ring > 0) s.bell.ring += dt;
    if (s.end) {
      s.endT += dt;
      this.fallBodies(dt, s);
      if (s.endT > (s.end === 'win' ? 1.4 : 1.0)) this.finish(E);
      return;
    }
    if (s.stop > 0) { s.stop -= dt; return; }
    s.time += dt;
    if (s.buffered) { s.buffered.t -= dt; if (s.buffered.t <= 0) s.buffered = null; }
    this.stepPlayer(dt, E);
    this.stepBandits(dt, E);
    this.stepArrows(dt, E);
    this.fallBodies(dt, s);
    this.stepCamera(dt, E);
  },

  stepPlayer(dt, E) {
    const s = this.state, p = s.p, D = TUNING.dash, H = TUNING.body.h;
    if (p.inv > 0) p.inv -= dt;
    if (p.hurtT > 0) p.hurtT -= dt;
    if (p.blink > 0) p.blink -= dt;
    const px = p.x, py = p.y;
    if (p.dash) {
      const d = p.dash, step = Math.min(dt, D.time - d.t) * D.len / D.time;
      d.t += dt;
      p.x = clamp(p.x + d.ux * step, 0.03, 0.97);
      p.y += d.uy * step;
      if (E.frame % 2 === 0) s.ghosts.push({ x: px, y: py, ux: d.ux, uy: d.uy, face: p.face, t: 0 });
      this.cutAlong(px, py + H / 2, p.x, p.y + H / 2, E);
      const sl = s.slashes[s.slashes.length - 1];
      if (sl && sl.live) { sl.x1 = p.x; sl.y1 = p.y + H / 2; }
      if (s.end) return;
      if (d.uy < 0 && this.land(px, py)) { this.endSlash(); return; }
      if (d.t >= D.time) {
        p.dash = null;
        this.endSlash();
        if (d.kill) { p.vx = 0; p.vy = D.pop; p.hang = D.hang; }
        else { p.vx = d.ux * D.carry; p.vy = d.uy * D.carry; }
        if (s.buffered) { const b = s.buffered; s.buffered = null; this.startDash(b.ux, b.uy, E); }
      }
      return;
    }
    if (p.ground) { p.vx = 0; p.vy = 0; return; }
    const g = TUNING.gravity * (p.hang > 0 ? D.hangGrav : 1);
    if (p.hang > 0) p.hang -= dt;
    p.vy -= g * dt;
    p.vx *= Math.max(0, 1 - D.drag * dt);
    p.x = clamp(p.x + p.vx * dt, 0.03, 0.97);
    p.y += p.vy * dt;
    if (p.vy < 0) this.land(px, py);
    if (p.y < s.last.ledge.y - TUNING.cam.fallMargin) this.fell(E);
  },

  endSlash() { const sl = this.state.slashes[this.state.slashes.length - 1]; if (sl) sl.live = false; },

  // Land on the highest one-way ledge crossed from above between (px,py) and the player's position now.
  land(px, py) {
    const s = this.state, p = s.p;
    let hit = null;
    for (const l of s.ledges) {
      if (py < l.y - 1e-6 || p.y > l.y) continue;
      const k = py === p.y ? 0 : (py - l.y) / (py - p.y), x = px + (p.x - px) * k;
      if (x < l.x - 0.012 || x > l.x + l.w + 0.012) continue;
      if (!hit || l.y > hit.l.y) hit = { l, x };
    }
    if (!hit) return false;
    p.x = clamp(hit.x, hit.l.x + 0.01, hit.l.x + hit.l.w - 0.01); p.y = hit.l.y;
    p.vx = p.vy = 0; p.dash = null; p.hang = 0; p.ground = hit.l; p.air = TUNING.dash.air;
    s.last = { ledge: hit.l, x: p.x };
    s.chain = 0;
    return true;
  },

  // Everything the dash's path crosses this frame is cut: bandits, arrows, the bell.
  cutAlong(ax, ay, bx, by, E) {
    const s = this.state, p = s.p, T = TUNING;
    for (const b of s.bandits) {
      if (b.dead) continue;
      if (segDist(b.x, b.y + T.body.h / 2, ax, ay, bx, by) > T.dash.width + T.body.r) continue;
      b.dead = { t: 0, a: Math.atan2(-p.dash.uy, p.dash.ux), vx: p.dash.ux * 0.4, vy: 0.6 + p.dash.uy * 0.3, y: 0, x: 0 };
      p.dash.kill = true;
      s.kills++; s.chain++; s.bestChain = Math.max(s.bestChain, s.chain);
      p.air = Math.min(T.dash.air, p.air + 1);
      s.stop = T.hitstop;
      if (s.chain >= 2) s.pops.push({ n: s.chain, x: b.x, y: b.y + T.body.h * 2.1, t: 0 });
      E.audio.play('hit'); E.haptic(12);
    }
    for (const a of s.arrows) {
      if (a.cut || segDist(a.x, a.y, ax, ay, bx, by) > T.dash.width + 0.02) continue;
      a.cut = { t: 0 };
      s.arrowsCut = (s.arrowsCut || 0) + 1;
      E.audio.play('hit', 0.3); E.haptic(6);
    }
    const bl = s.bell;
    if (!s.end && segDist(bl.x, bl.y, ax, ay, bx, by) < T.dash.width + 0.05) this.ring(E);
  },

  ring(E) {
    const s = this.state;
    s.end = 'win'; s.endT = 0; s.bell.ring = 0.001; s.p.dash = null;
    E.audio.play('win');
  },

  hurt(fromX, E) {
    const s = this.state, p = s.p, T = TUNING.hurt;
    if (p.inv > 0 || s.end) return;
    s.hearts--; p.inv = T.inv; p.hurtT = 0.35;
    p.dash = null; this.endSlash(); p.ground = null; p.hang = 0;
    p.vx = (p.x >= fromX ? 1 : -1) * T.knockX; p.vy = T.knockY;
    E.audio.play('miss'); E.flash(RED, 0.18); E.shake(7, 0.22); E.haptic(30);
    if (s.hearts <= 0) { s.end = 'lose'; s.endT = 0; }
  },

  fell(E) {
    const s = this.state, p = s.p, l = s.last.ledge;
    s.hearts--; s.chain = 0;
    E.audio.play('miss'); E.flash(RED, 0.18); E.haptic(30);
    if (s.hearts <= 0) { s.end = 'lose'; s.endT = 0; return; }
    p.x = clamp(s.last.x, l.x + 0.02, l.x + l.w - 0.02); p.y = l.y;
    p.vx = p.vy = 0; p.dash = null; p.ground = l; p.air = TUNING.dash.air; p.inv = TUNING.hurt.inv;
  },

  stepBandits(dt, E) {
    const s = this.state, p = s.p, T = TUNING, B = T.bandit, A = T.archer, H = T.body.h;
    const vh = E.h / E.w;
    for (const b of s.bandits) {
      if (b.dead) continue;
      const dx = p.x - b.x, dy = p.y - b.y;
      const onScreen = b.y > s.cam - 0.1 && b.y < s.cam + vh;
      if (b.phase === 'idle') b.face = dx >= 0 ? 1 : -1;
      b.t += dt;
      if (b.kind === 'sword') {
        if (b.phase === 'idle') {
          b.rest -= dt;
          if (b.rest <= 0 && onScreen && Math.abs(dx) < B.sight && dy > -0.2 && dy < 0.3) { b.phase = 'tell'; b.t = 0; }
        } else if (b.phase === 'tell' && b.t >= B.tell) {
          b.phase = 'strike'; b.t = 0;
          // The strike lands on the space in front of him, the instant the tell ends.
          const x1 = b.x + b.face * (T.body.r + B.reach);
          const lo = Math.min(b.x, x1) - 0.022, hi = Math.max(b.x, x1) + 0.022;
          if (p.x > lo && p.x < hi && p.y > b.y - 0.06 && p.y < b.y + H * 1.1) this.hurt(b.x, E);
          E.audio.beep({ freq: 220, dur: 0.08, type: 'sawtooth', slide: -120, gain: 0.05 });
        } else if (b.phase === 'strike' && b.t >= B.strike) { b.phase = 'idle'; b.t = 0; b.rest = B.rest; }
      } else {
        if (b.phase === 'idle') {
          b.rest -= dt;
          if (b.rest <= 0 && onScreen && Math.hypot(dx, dy) < A.sight) {
            const ax = p.x - b.x, ay = p.y + H / 2 - (b.y + H * 0.62), l = Math.hypot(ax, ay) || 1;
            b.aim = { ux: ax / l, uy: ay / l }; b.face = ax >= 0 ? 1 : -1;
            b.phase = 'tell'; b.t = 0;
          }
        } else if (b.phase === 'tell' && b.t >= A.tell) {
          s.arrows.push({ x: b.x + b.face * 0.03, y: b.y + H * 0.62, ux: b.aim.ux, uy: b.aim.uy, t: 0, cut: null });
          b.phase = 'idle'; b.t = 0; b.rest = A.every - A.tell;
          E.audio.beep({ freq: 520, dur: 0.07, type: 'square', slide: 300, gain: 0.04 });
        }
      }
    }
  },

  stepArrows(dt, E) {
    const s = this.state, p = s.p, A = TUNING.archer, H = TUNING.body.h;
    for (const a of s.arrows) {
      a.t += dt;
      if (a.cut) { a.cut.t += dt; continue; }
      a.x += a.ux * A.speed * dt; a.y += a.uy * A.speed * dt;
      if (Math.abs(a.x - p.x) < 0.03 && a.y > p.y && a.y < p.y + H) { a.cut = { t: 0, hit: true }; this.hurt(a.x - a.ux, E); }
    }
    s.arrows = s.arrows.filter((a) => (a.cut ? a.cut.t < 0.6 : a.t < A.arrowLife && a.x > -0.1 && a.x < 1.1));
  },

  fallBodies(dt, s) {
    for (const b of s.bandits) {
      const d = b.dead;
      if (!d || d.t > 1.5) continue;
      d.vy -= TUNING.gravity * 0.8 * dt;
      d.x += d.vx * dt; d.y += d.vy * dt;
    }
  },

  stepCamera(dt, E) {
    const s = this.state, C = TUNING.cam, vh = E.h / E.w;
    const lo = Math.max(-0.12, s.last.ledge.y - C.fallMargin - 0.04);
    const hi = s.bell.y + 0.32 - vh;
    const target = clamp(s.p.y - vh * C.follow, lo, Math.max(lo, hi));
    s.cam += (target - s.cam) * Math.min(1, dt * C.rate);
    s.cam = Math.max(s.cam, lo);
  },

  finish(E) {
    const s = this.state, won = s.end === 'win';
    const prevChain = E.save.get('bestChain', 0), prevTime = E.save.get('bestTime', 0);
    const bestChain = Math.max(prevChain, s.bestChain);
    const bestTime = won ? (prevTime ? Math.min(prevTime, s.time) : s.time) : prevTime;
    E.save.set('bestChain', bestChain);
    if (won) E.save.set('bestTime', bestTime);
    E.save.update('runs', (n) => n + 1, 0);
    E.ledger.add('result', { won, kills: s.kills, chain: s.bestChain, time: Math.round(s.time * 10) / 10, hearts: s.hearts });
    E.setScene('over', { won, kills: s.kills, chain: s.bestChain, time: s.time, bestChain, bestTime, newChain: s.bestChain > prevChain, newTime: won && (!prevTime || s.time < prevTime) });
  },

  render(ctx, E) {
    const s = this.state, W = E.w, u = W * 0.0105, H = TUNING.body.h;
    drawBackdrop(ctx, E, s.cam);
    for (const l of s.ledges) drawLedge(ctx, this.sx(l.x, E), this.sy(l.y, E), l.w * W, u, l, E);
    drawBell(ctx, this.sx(s.bell.x, E), this.sy(s.bell.y, E), u, s.bell.ring, E.time);

    // The first bandit's route: a dotted arc from you to him until you've cut someone.
    if (!s.kills && !s.end) {
      const b = s.bandits[0], p = s.p;
      const ax = this.sx(p.x, E), ay = this.sy(p.y + H / 2, E), bx = this.sx(b.x, E), by = this.sy(b.y + H / 2, E);
      ctx.save(); ctx.strokeStyle = INK; ctx.globalAlpha = 0.45; ctx.lineWidth = 0.6 * u; ctx.setLineDash([u, 1.4 * u]);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + bx) / 2, Math.min(ay, by) - 4 * u, bx, by); ctx.stroke();
      ctx.restore();
    }

    for (const b of s.bandits) {
      const x = this.sx(b.x, E), y = this.sy(b.y, E);
      if (b.dead) { if (b.dead.t < 1.2) drawCutBandit(ctx, x, y, u, b, W); continue; }
      if (b.kind === 'archer' && b.phase === 'tell') {
        const ox = x + b.face * 1.2 * u, oy = this.sy(b.y + H * 0.62, E);
        ctx.save(); ctx.strokeStyle = RED; ctx.globalAlpha = 0.35 + 0.35 * (b.t / TUNING.archer.tell); ctx.lineWidth = 0.5 * u; ctx.setLineDash([1.6 * u, 1.6 * u]);
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + b.aim.ux * W * 1.3, oy - b.aim.uy * W * 1.3); ctx.stroke(); ctx.restore();
      }
      drawBandit(ctx, x, y, u, b, W);
    }

    for (const a of s.arrows) drawArrow(ctx, this.sx(a.x, E), this.sy(a.y, E), u, a);

    for (const sl of s.slashes) drawSlash(ctx, this.sx(sl.x0, E), this.sy(sl.y0, E), this.sx(sl.x1, E), this.sy(sl.y1, E), u, sl);
    for (const g of s.ghosts) {
      ctx.save(); ctx.globalAlpha = 0.22 * (1 - g.t / 0.16);
      drawRonin(ctx, this.sx(g.x, E), this.sy(g.y, E), u, g.face, 'dash', g.ux, g.uy, true);
      ctx.restore();
    }
    const p = s.p;
    if (!(p.inv > 0 && Math.floor(p.inv * 14) % 2 === 0)) {
      const pose = p.hurtT > 0 ? 'hurt' : p.dash ? 'dash' : p.ground ? 'stand' : 'air';
      drawRonin(ctx, this.sx(p.x, E), this.sy(p.y, E), u, p.face, pose, p.dash ? p.dash.ux : 0, p.dash ? p.dash.uy : 0);
    }
    // Air dashes left: pips over the hat while airborne.
    if (!p.ground && !s.end) {
      const cx = this.sx(p.x, E), cy = this.sy(p.y, E) - 16 * u;
      for (let i = 0; i < TUNING.dash.air; i++) {
        const on = i < p.air, x = cx + (i - (TUNING.dash.air - 1) / 2) * 2.4 * u;
        ctx.fillStyle = on ? INK : p.blink > 0 ? RED : 'rgba(27,26,23,0.18)';
        ctx.fillRect(x - 0.9 * u, cy - 0.35 * u, 1.8 * u, 0.7 * u);
      }
    }
    for (const pp of s.pops) {
      const k = pp.t / 0.8, sc = 1 + 0.6 * Math.max(0, 1 - pp.t * 8);
      E.text(`${pp.n} chain`, this.sx(clamp(pp.x, 0.16, 0.84), E), this.sy(pp.y, E) - k * 5 * u, { size: Math.round(4.6 * u * sc), weight: '900', color: RED, alpha: 1 - k * k });
    }

    this.renderHud(ctx, E);
    if (this.paused) {
      ctx.save(); ctx.globalAlpha = 0.82; ctx.fillStyle = PAPER; ctx.fillRect(0, 0, E.w, E.h); ctx.restore();
      E.text('Paused', E.w / 2, E.h * 0.38, { size: 34, weight: '800', color: INK });
      E.text('Tap to go on', E.w / 2, E.h * 0.38 + 40, { size: 16, color: INK, alpha: 0.6 });
      this.menuRect = E.button('Menu', E.w / 2, E.h * 0.62, { fill: INK, color: PAPER, w: 180 });
    }
  },

  renderHud(ctx, E) {
    const s = this.state, top = E.safe.top + 30;
    // A paper band so the HUD never sits on a bandit.
    const band = ctx.createLinearGradient(0, 0, 0, top + 34);
    band.addColorStop(0, PAPER); band.addColorStop(0.7, PAPER); band.addColorStop(1, 'rgba(241,232,212,0)');
    ctx.fillStyle = band; ctx.fillRect(0, 0, E.w, top + 34);
    for (let i = 0; i < TUNING.hearts; i++) drawHeart(ctx, E.safe.left + 24 + i * 30, top, 11, i < s.hearts);
    const m = Math.floor(s.time / 60), sec = Math.floor(s.time % 60);
    E.text(`${m}:${String(sec).padStart(2, '0')}`, E.w / 2, top, { size: 18, weight: '700', color: INK, alpha: 0.7 });
    // Kills: a red slash and the count.
    const kx = E.w / 2 + 52;
    ctx.save(); ctx.strokeStyle = RED; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(kx - 7, top + 7); ctx.lineTo(kx + 7, top - 7); ctx.stroke(); ctx.restore();
    E.text(`${s.kills}`, kx + 12, top, { size: 18, weight: '800', color: RED, align: 'left' });
    const r = this.pauseRect(E);
    ctx.fillStyle = INK; ctx.globalAlpha = 0.55;
    ctx.fillRect(r.x + 17, r.y + 15, 5, 18); ctx.fillRect(r.x + 27, r.y + 15, 5, 18); ctx.globalAlpha = 1;
    if (!s.dashed) {
      E.text(TUNING.hint.swipe, E.w / 2, Math.max(this.sy(0, E) + 22, E.h - E.safe.bottom - 22), { size: 17, weight: '700', color: PAPER, alpha: 0.75 + 0.25 * Math.sin(E.time * 4) });
    }
  },
};

// ---------- drawing ----------

function drawBackdrop(ctx, E, cam) {
  const W = E.w, H = E.h;
  // A low red sun and two bands of village roofs, drifting slower than the climb.
  ctx.save();
  ctx.globalAlpha = 0.13; ctx.fillStyle = RED;
  ctx.beginPath(); ctx.arc(W * 0.72, H * 0.3 + cam * W * 0.05, W * 0.2, 0, Math.PI * 2); ctx.fill();
  for (let band = 0; band < 2; band++) {
    const par = band ? 0.45 : 0.22, alpha = band ? 0.08 : 0.05;
    ctx.globalAlpha = alpha; ctx.fillStyle = INK;
    for (let i = -1; i < 9; i++) {
      const row = i * 0.55, y = H - (row - cam * par) * W;
      if (y < -W * 0.4 || y > H + W * 0.4) continue;
      for (let j = 0; j < 3; j++) {
        const x = ((j * 0.37 + i * 0.29 + band * 0.18) % 1 + 1) % 1 * W, w = W * (0.22 + 0.06 * (((i + j) % 3 + 3) % 3)), h = W * 0.07;
        ctx.beginPath(); ctx.moveTo(x - w * 0.62, y); ctx.quadraticCurveTo(x - w * 0.3, y - h * 0.4, x, y - h); ctx.quadraticCurveTo(x + w * 0.3, y - h * 0.4, x + w * 0.62, y); ctx.closePath(); ctx.fill();
        ctx.fillRect(x - w * 0.42, y, w * 0.84, W * 0.12);
      }
    }
  }
  ctx.restore();
}

function drawLedge(ctx, x, y, w, u, l, E) {
  if (l.street) { ctx.fillStyle = INK; ctx.fillRect(0, y, E.w, E.h); return; }
  if (l.roof) {
    // The top roof: a long curved tile roof; the bell frame stands on it.
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.moveTo(x - 2 * u, y - 0.4 * u); ctx.quadraticCurveTo(x + w * 0.2, y + 0.6 * u, x + w / 2, y + 0.8 * u);
    ctx.quadraticCurveTo(x + w * 0.8, y + 0.6 * u, x + w + 2 * u, y - 0.4 * u); ctx.lineTo(x + w - 3 * u, y + 4 * u); ctx.lineTo(x + 3 * u, y + 4 * u); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.35;
    for (let t = x + 4 * u; t < x + w - 4 * u; t += 2.2 * u) ctx.fillRect(t, y + 4 * u, 1.1 * u, 1.4 * u);
    ctx.globalAlpha = 1;
    return;
  }
  // A roof beam: a dark plank with tile ticks under it.
  ctx.fillStyle = INK;
  ctx.fillRect(x, y, w, 1.6 * u);
  ctx.globalAlpha = 0.35;
  for (let t = x + u; t < x + w - u * 0.5; t += 2.2 * u) ctx.fillRect(t, y + 1.6 * u, 1.1 * u, 1.3 * u);
  ctx.globalAlpha = 1;
}

function drawBell(ctx, x, y, u, ring, time) {
  ctx.save();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.4 * u; ctx.lineCap = 'round';
  const base = y + 18.4 * u;
  ctx.beginPath(); ctx.moveTo(x - 7 * u, base); ctx.lineTo(x - 7 * u, y - 8 * u); ctx.moveTo(x + 7 * u, base); ctx.lineTo(x + 7 * u, y - 8 * u);
  ctx.moveTo(x - 9.5 * u, y - 8 * u); ctx.lineTo(x + 9.5 * u, y - 8 * u); ctx.stroke();
  const swing = ring > 0 ? Math.sin(ring * 18) * 0.35 * Math.max(0, 1 - ring / 1.4) : Math.sin(time * 1.1) * 0.03;
  ctx.translate(x, y - 8 * u); ctx.rotate(swing);
  ctx.fillStyle = INK;
  ctx.fillRect(-0.4 * u, 0, 0.8 * u, 2.5 * u);
  ctx.beginPath(); ctx.moveTo(-2.4 * u, 2.5 * u); ctx.quadraticCurveTo(-3 * u, 9 * u, -4.4 * u, 10.5 * u); ctx.lineTo(4.4 * u, 10.5 * u); ctx.quadraticCurveTo(3 * u, 9 * u, 2.4 * u, 2.5 * u); ctx.closePath(); ctx.fill();
  ctx.fillStyle = RED; ctx.fillRect(-4.4 * u, 8.6 * u, 8.8 * u, 0.9 * u);
  ctx.restore();
  if (ring > 0) {
    ctx.save(); ctx.strokeStyle = RED; ctx.lineWidth = 0.8 * u;
    for (let i = 0; i < 3; i++) {
      const k = (ring * 1.6 + i / 3) % 1;
      ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.arc(x, y, (5 + k * 22) * u, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
}

function drawHeart(ctx, x, y, r, full) {
  ctx.save(); ctx.translate(x, y);
  ctx.beginPath(); ctx.moveTo(0, r * 0.9);
  ctx.bezierCurveTo(-r * 1.4, -r * 0.1, -r * 0.7, -r * 1.1, 0, -r * 0.35);
  ctx.bezierCurveTo(r * 0.7, -r * 1.1, r * 1.4, -r * 0.1, 0, r * 0.9);
  if (full) { ctx.fillStyle = RED; ctx.fill(); } else { ctx.strokeStyle = RED; ctx.lineWidth = 2; ctx.globalAlpha = 0.5; ctx.stroke(); }
  ctx.restore();
}

function line(ctx, pts, w, color) {
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.stroke();
}

// The ronin, feet at (x, y), u = a hundredth of the screen width. Drawn facing right, flipped by face.
function drawRonin(ctx, x, y, u, face, pose, ux, uy, ghost) {
  ctx.save();
  ctx.translate(x, y);
  if (pose === 'dash') {
    // Lean the whole body into the dash, pivoting at the hips.
    const lean = clamp(Math.atan2(ux * face, Math.max(0.2, uy + 0.6)), -1.1, 1.1);
    ctx.translate(0, -5 * u); ctx.rotate(lean * face); ctx.translate(0, 5 * u);
  } else if (pose === 'hurt') { ctx.translate(0, -5 * u); ctx.rotate(-0.5 * face); ctx.translate(0, 5 * u); }
  ctx.scale(face, 1);
  const lw = 1.35 * u;
  if (pose === 'stand') { line(ctx, [-0.7 * u, -4 * u, -2 * u, 0], lw, INK); line(ctx, [0.7 * u, -4 * u, 2 * u, 0], lw, INK); }
  else if (pose === 'dash') { line(ctx, [-0.6 * u, -4 * u, -2.6 * u, -1.6 * u, -4 * u, -0.6 * u], lw, INK); line(ctx, [0.6 * u, -4 * u, 1.2 * u, -1.8 * u, -0.6 * u, -0.6 * u], lw, INK); }
  else { line(ctx, [-0.6 * u, -4 * u, -1.6 * u, -2 * u, -0.6 * u, -0.6 * u], lw, INK); line(ctx, [0.7 * u, -4 * u, 2 * u, -2.4 * u, 1.2 * u, -1 * u], lw, INK); }
  // Robe (kimono over hakama).
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.moveTo(-1.9 * u, -8.6 * u); ctx.lineTo(1.9 * u, -8.6 * u); ctx.lineTo(2.9 * u, -3.4 * u); ctx.lineTo(-2.9 * u, -3.4 * u); ctx.closePath(); ctx.fill();
  if (!ghost) { ctx.strokeStyle = PAPER; ctx.lineWidth = 0.35 * u; ctx.beginPath(); ctx.moveTo(-0.9 * u, -8.5 * u); ctx.lineTo(0.5 * u, -6.6 * u); ctx.lineTo(1.6 * u, -8.5 * u); ctx.stroke(); }
  // Arm and katana: low and ready standing, straight out in a dash.
  if (pose === 'dash') {
    line(ctx, [0.6 * u, -7.6 * u, 4 * u, -6.8 * u], 1.1 * u, INK);
    line(ctx, [4 * u, -6.8 * u, 11.5 * u, -6.4 * u], 0.55 * u, INK);
    if (!ghost) line(ctx, [5 * u, -6.95 * u, 11 * u, -6.65 * u], 0.18 * u, WHITE);
  } else if (pose === 'hurt') {
    line(ctx, [0.6 * u, -7.6 * u, 3 * u, -9.6 * u], 1.1 * u, INK);
  } else {
    line(ctx, [0.8 * u, -7.6 * u, 2.6 * u, -5.2 * u], 1.1 * u, INK);
    line(ctx, [2.6 * u, -5.2 * u, 8.4 * u, -2.2 * u], 0.55 * u, INK);
  }
  // Head and the straw hat (kasa): a wide flat cone, the one shape that says "ronin".
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, -9.7 * u, 1.35 * u, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-4.8 * u, -9.9 * u); ctx.quadraticCurveTo(0, -10.6 * u, 4.8 * u, -9.9 * u); ctx.lineTo(0.3 * u, -12.9 * u); ctx.closePath();
  ctx.fillStyle = ghost ? INK : STRAW; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 0.55 * u; ctx.stroke();
  if (!ghost) { ctx.lineWidth = 0.3 * u; ctx.beginPath(); ctx.moveTo(0.3 * u, -12.9 * u); ctx.lineTo(-2 * u, -10.1 * u); ctx.moveTo(0.3 * u, -12.9 * u); ctx.lineTo(2.3 * u, -10.1 * u); ctx.stroke(); }
  ctx.restore();
}

// A bandit, red, feet at (0, 0). The tell: blade raised overhead and the body flashing white.
function drawBanditBody(ctx, u, b, flash) {
  const body = flash ? WHITE : RED;
  const lw = 1.35 * u;
  line(ctx, [-0.8 * u, -4 * u, -2.6 * u, 0], lw, RED); line(ctx, [0.8 * u, -4 * u, 2.6 * u, 0], lw, RED);
  ctx.fillStyle = body; ctx.strokeStyle = RED; ctx.lineWidth = 0.5 * u;
  ctx.beginPath(); ctx.moveTo(-2.1 * u, -8.4 * u); ctx.lineTo(2.1 * u, -8.4 * u); ctx.lineTo(2.7 * u, -3.6 * u); ctx.lineTo(-2.7 * u, -3.6 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK; ctx.fillRect(-2.5 * u, -5 * u, 5 * u, 0.8 * u); // sash
  ctx.fillStyle = body; ctx.beginPath(); ctx.arc(0, -9.8 * u, 1.45 * u, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Headband with its tail, and a topknot.
  ctx.fillStyle = INK; ctx.fillRect(-1.5 * u, -10.6 * u, 3 * u, 0.6 * u);
  line(ctx, [-1.4 * u, -10.3 * u, -3 * u, -9.6 * u], 0.4 * u, INK);
  ctx.beginPath(); ctx.arc(-0.3 * u, -11.6 * u, 0.6 * u, 0, Math.PI * 2); ctx.fill();
  if (b.kind === 'sword') {
    if (b.phase === 'tell') {
      line(ctx, [0.8 * u, -8 * u, 1.4 * u, -11.6 * u], 1.1 * u, RED);
      line(ctx, [1.4 * u, -11.6 * u, -4 * u, -16.5 * u], 0.6 * u, flash ? WHITE : INK);
    } else if (b.phase === 'strike') {
      line(ctx, [0.8 * u, -8 * u, 3.6 * u, -6.6 * u], 1.1 * u, RED);
      line(ctx, [3.6 * u, -6.6 * u, 10.5 * u, -5.4 * u], 0.6 * u, INK);
    } else {
      line(ctx, [0.8 * u, -7.8 * u, 2.4 * u, -5.4 * u], 1.1 * u, RED);
      line(ctx, [2.4 * u, -5.4 * u, 7.6 * u, -8.6 * u], 0.6 * u, INK);
    }
  } else {
    // Archer: bow held out in front; drawn back during the tell.
    const drawn = b.phase === 'tell' ? clamp(b.t / TUNING.archer.tell, 0, 1) : 0;
    line(ctx, [0.8 * u, -7.8 * u, 3.6 * u, -6.8 * u], 1.1 * u, RED);
    ctx.strokeStyle = INK; ctx.lineWidth = 0.55 * u;
    ctx.beginPath(); ctx.arc(2.4 * u, -6.8 * u, 4 * u, -1.1, 1.1); ctx.stroke();
    const sx = 2.4 * u + Math.cos(1.1) * 4 * u, nx = sx - drawn * 3 * u;
    ctx.lineWidth = 0.2 * u; ctx.beginPath(); ctx.moveTo(sx, -6.8 * u - Math.sin(1.1) * 4 * u); ctx.lineTo(nx, -6.8 * u); ctx.lineTo(sx, -6.8 * u + Math.sin(1.1) * 4 * u); ctx.stroke();
    if (b.phase === 'tell') line(ctx, [nx, -6.8 * u, nx + 6 * u, -6.8 * u], 0.35 * u, flash ? WHITE : INK);
  }
}

function drawBandit(ctx, x, y, u, b, W) {
  const tell = b.phase === 'tell';
  const flash = tell && Math.floor(b.t * 12) % 2 === 0;
  ctx.save(); ctx.translate(x, y);
  if (b.kind === 'sword' && b.phase === 'strike') {
    // The strike: a red arc over the space in front of him.
    const r = (TUNING.body.r + TUNING.bandit.reach) * W, k = 1 - b.t / TUNING.bandit.strike;
    ctx.save(); ctx.scale(b.face, 1); ctx.globalAlpha = 0.45 * k; ctx.fillStyle = RED;
    ctx.beginPath(); ctx.moveTo(0, -6 * u); ctx.arc(0, -6 * u, r, -1.3, 0.7); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  if (tell) {
    // A white halo so the wind-up reads even small.
    ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = WHITE;
    ctx.beginPath(); ctx.arc(0, -7 * u, 7 * u + Math.sin(b.t * 30) * 0.6 * u, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  ctx.scale(b.face, 1);
  drawBanditBody(ctx, u, b, flash);
  ctx.restore();
}

// A cut bandit: two halves split along the dash, sliding apart and dropping.
function drawCutBandit(ctx, x, y, u, b, W) {
  const d = b.dead, k = Math.min(1, d.t / 0.25), fade = d.t > 0.7 ? 1 - (d.t - 0.7) / 0.5 : 1;
  const ca = Math.cos(d.a), sa = Math.sin(d.a), nx = -sa, ny = ca, cy = -6 * u, L = 40 * u;
  ctx.save(); ctx.globalAlpha = clamp(fade, 0, 1);
  for (const side of [1, -1]) {
    ctx.save();
    ctx.translate(x + d.x * W + (side > 0 ? ca * 3 * u * k : 0), y - d.y * W * (side > 0 ? 1 : 1.25) + (side > 0 ? sa * 3 * u * k : 0));
    ctx.beginPath();
    ctx.moveTo(-ca * L, cy - sa * L); ctx.lineTo(ca * L, cy + sa * L);
    ctx.lineTo(ca * L + nx * L * side, cy + sa * L + ny * L * side); ctx.lineTo(-ca * L + nx * L * side, cy - sa * L + ny * L * side);
    ctx.closePath(); ctx.clip();
    ctx.translate(0, cy); ctx.rotate(side * k * 0.35); ctx.translate(0, -cy);
    ctx.scale(b.face, 1);
    drawBanditBody(ctx, u, { kind: b.kind, phase: 'idle', t: 0 }, false);
    ctx.restore();
  }
  ctx.restore();
}

function drawArrow(ctx, x, y, u0, a) {
  const u = u0 * 1.4, ang = Math.atan2(-a.uy, a.ux);
  if (a.cut) {
    const k = a.cut.t;
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k / 0.6);
    for (const side of [1, -1]) {
      ctx.save(); ctx.translate(x + side * a.ux * 2 * u, y + k * k * 60 * u); ctx.rotate(ang + side * k * 4);
      line(ctx, side > 0 ? [0, 0, 2.6 * u, 0] : [-2.6 * u, 0, 0, 0], 0.45 * u, INK);
      ctx.restore();
    }
    ctx.restore();
    return;
  }
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  line(ctx, [-5 * u, 0, 2 * u, 0], 0.45 * u, INK);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(3.2 * u, 0); ctx.lineTo(1.6 * u, -0.9 * u); ctx.lineTo(1.6 * u, 0.9 * u); ctx.closePath(); ctx.fill();
  ctx.fillStyle = RED; ctx.beginPath(); ctx.moveTo(-5 * u, 0); ctx.lineTo(-3.6 * u, -1.1 * u); ctx.lineTo(-3 * u, 0); ctx.lineTo(-3.6 * u, 1.1 * u); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// The slash: a red blade-stroke along the dash, thickest at its head, fading once the dash ends.
function drawSlash(ctx, x0, y0, x1, y1, u, sl) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 1) return;
  const a = sl.live ? 1 : 1 - sl.t / 0.28, nx = -(y1 - y0) / len, ny = (x1 - x0) / len, w = 1.5 * u * (sl.live ? 1 : 1 - sl.t / 0.4);
  ctx.save(); ctx.globalAlpha = clamp(a, 0, 1);
  ctx.fillStyle = RED;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 + nx * w, y1 + ny * w); ctx.lineTo(x1 + (x1 - x0) / len * 1.5 * u, y1 + (y1 - y0) / len * 1.5 * u); ctx.lineTo(x1 - nx * w, y1 - ny * w); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = WHITE; ctx.lineWidth = 0.3 * u; ctx.beginPath(); ctx.moveTo(x0 + (x1 - x0) * 0.3, y0 + (y1 - y0) * 0.3); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.restore();
}

// ---------- menu and end card ----------

const menu = {
  render(ctx, E) {
    const u = E.w * 0.0105;
    drawBackdrop(ctx, E, 0);
    const cy = E.h * 0.24 + E.safe.top * 0.5;
    E.text('RONIN', E.w / 2, cy, { size: 54, weight: '900', color: INK });
    E.text('Cut your way up to the bell', E.w / 2, cy + 44, { size: 16, color: INK, alpha: 0.65 });
    // The hero past a bandit he has just cut, the slash between them.
    const gy = E.h * 0.53;
    ctx.fillStyle = INK; ctx.fillRect(E.w * 0.12, gy, E.w * 0.76, 1.6 * u);
    drawSlash(ctx, E.w * 0.24, gy - 9 * u, E.w * 0.66, gy - 10 * u, u * 1.4, { live: true });
    drawCutBandit(ctx, E.w * 0.4, gy, u * 1.5, { kind: 'sword', face: 1, dead: { t: 0.25, a: 0.12, x: 0, y: 0 } }, E.w);
    drawRonin(ctx, E.w * 0.72, gy, u * 1.5, 1, 'stand', 0, 0);
    const best = E.save.get('bestChain', 0), bt = E.save.get('bestTime', 0);
    if (best || bt) E.text(`Best chain ${best}${bt ? `   Best time ${fmtTime(bt)}` : ''}`, E.w / 2, E.h * 0.62, { size: 16, weight: '700', color: RED });
    this.btnPlay = E.button('Play', E.w / 2, E.h * 0.72, { fill: INK, color: PAPER, w: 200, h: 64, size: 24 });
    this.btnMute = E.button(E.audio.muted ? 'Sound: off' : 'Sound: on', E.w / 2, E.h * 0.72 + 80, { fill: 'rgba(27,26,23,0.12)', color: INK, w: 160, h: 44, size: 16 });
  },
  onTap(p, E) {
    if (E.hit(this.btnPlay, p)) { E.audio.play('tap'); E.setScene('play'); }
    else if (E.hit(this.btnMute, p)) { E.audio.toggleMute(); E.audio.play('tap'); }
  },
};

function fmtTime(t) { const m = Math.floor(t / 60), s = (t % 60).toFixed(1); return `${m}:${s.padStart(4, '0')}`; }

const over = {
  enter(E, params) {
    this.p = params; this.k = 0;
    if (!params.won) E.audio.play('lose');
    E.tween(0.5, (t) => { this.k = t; }, ease.outBack);
  },
  render(ctx, E) {
    const P = this.p, u = E.w * 0.0105, y0 = E.h * 0.2 + E.safe.top * 0.5;
    drawBackdrop(ctx, E, 0);
    E.text(P.won ? 'The bell rings' : 'Fallen', E.w / 2, y0, { size: 38, weight: '900', color: P.won ? INK : RED });
    const rows = [
      ['Cut', `${P.kills}`, ''],
      ['Best chain', `${P.chain}`, P.newChain ? 'new best' : `best ${P.bestChain}`],
      ['Time', P.won ? fmtTime(P.time) : '-', P.won ? (P.newTime ? 'new best' : `best ${fmtTime(P.bestTime)}`) : P.bestTime ? `best ${fmtTime(P.bestTime)}` : ''],
    ];
    rows.forEach(([a, b, c], i) => {
      const y = y0 + 80 + i * 62;
      E.text(a, E.w * 0.12, y, { size: 18, color: INK, align: 'left', alpha: 0.7 });
      E.text(b, E.w * 0.62, y, { size: Math.round(30 * Math.max(0.2, this.k)), weight: '900', color: INK, align: 'right' });
      if (c) E.text(c, E.w * 0.66, y, { size: 14, weight: '700', color: RED, align: 'left' });
    });
    drawRonin(ctx, E.w / 2, y0 + 80 + 3 * 62 + 12 * u, u * 1.3, 1, P.won ? 'stand' : 'hurt', 0, 0);
    this.btnAgain = E.button('Again', E.w / 2, E.h * 0.76, { fill: INK, color: PAPER, w: 200, h: 64, size: 24 });
    this.btnMenu = E.button('Menu', E.w / 2, E.h * 0.76 + 78, { fill: 'rgba(27,26,23,0.12)', color: INK, w: 160, h: 44, size: 16 });
  },
  onTap(p, E) {
    if (E.hit(this.btnAgain, p)) { E.audio.play('tap'); E.setScene('play'); }
    else if (E.hit(this.btnMenu, p)) E.setScene('menu');
  },
};

export const game = {
  slug: 'ronin',
  title: 'Ronin',
  saveVersion: 1,
  migrate(data) { return data; },
  TUNING,
  LEVELS,
  experiments: [
    { key: 'dash.len', label: 'Dash length (widths)', min: 0.2, max: 0.5, step: 0.01 },
    { key: 'dash.time', label: 'Dash time (s)', min: 0.06, max: 0.2, step: 0.01 },
    { key: 'dash.pop', label: 'Pop after a kill', min: 0, max: 1.5, step: 0.05 },
    { key: 'gravity', label: 'Gravity (widths/s²)', min: 2, max: 8, step: 0.1 },
    { key: 'bandit.tell', label: 'Bandit wind-up (s)', min: 0.3, max: 1.2, step: 0.05 },
  ],
  start: 'menu',
  scenes: { menu, play, over },
};
