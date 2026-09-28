// Recoil, layer 1: the mechanic. One thumb drags the gun up and down, the other taps to fire, and every shot
// kicks the barrel up. Instant shot lines scored by zone, a combo multiplier, Accuracy 1 to 3 and Speed 1 to 3,
// stars, points, menu and card. Grey box: shapes and three colours only. Landscape, two thumbs (ADR-0013).

import { makeRng, ease, clamp } from './engine.js';

// Design-space units unless stated. Names match PRD section 16; the rest are marked.
// Per-challenge values (accTargets, accAmmo, speedSeconds, maxTargets, spawnEvery, star thresholds) live in CHALLENGES.
const TUNING = {
  designW: 640,          // Design space width
  designH: 360,          // Design space height
  gunX: 70,              // Gun pivot from the left edge
  gunLineX: 110,         // Approaching targets vanish as a miss at this x
  thumbLane: 70,         // Bottom band with no targets
  gunMinY: 40,           // Highest gun position
  gunMaxY: 300,          // Lowest gun position
  dragGain: 1.0,         // Design units of gun movement per design unit of drag
  kickPerShot: 8,        // Degrees of barrel climb per shot (PRD 7; 7 misses the 24-unit check, see changelog)
  kickMax: 28,           // Cap on the barrel angle
  kickRecovery: 32,      // Degrees per second the barrel settles
  zoneR: [6, 14, 24],    // Bullseye, inner, outer radii at scale 1
  zonePoints: [100, 50, 20], // Points per zone
  comboStep: 0.5,        // Multiplier added per consecutive hit
  comboCap: 4,           // Max multiplier
  rangeDots: 28,         // Dots on the range finder
  approachSpeed: 60,     // Base approach speed in Speed 1 (Speed 2 and 3 scale it)
  physicsStep: 1 / 120,  // Fixed timestep
  particleCap: 200,      // Reserved for a later layer; v0.1 has no particles

  // Additions, not in the PRD table.
  accLife: 6,            // Seconds an Accuracy target stays before it is a miss
  accGap: 0.45,          // Seconds between a target going and the next appearing
  startDelay: 0.6,       // Seconds before the first target
  endDelay: 0.8,         // Seconds between the last event and the card
  targetTop: 56,         // Top edge of the highest target (keeps the HUD clear)
  targetGapX: 24,        // Clear space between the gun line and a target's left edge
  targetEdge: 8,         // Clear space between a target's right edge and the wall
  barrelLen: 40,         // Barrel length; the tip sits on gunLineX at zero kick
  startGunY: 180,        // Gun height at the start of a challenge
  keyMoveSpeed: 200,     // Keyboard fallback: gun units per second
  unlockStars: 1,        // Stars on a level that unlock the next in its ladder
  starPoints: [0, 10, 25, 50], // Points by best star count
  tracerLife: 0.15,      // Seconds a tracer takes to fade
  flashLife: 0.07,       // Seconds a muzzle flash shows
  popLife: 0.7,          // Seconds a score number floats
  edgeLife: 0.3,         // Seconds the red edge flash shows
  hudPad: 8,             // HUD padding in screen px
  bg: '#0f1115',         // Letterbox colour (the engine reads this name)
  fieldColor: '#141b2d',
  groundColor: '#0b1019',
  horizonColor: '#33405c',
  cyan: '#22d3ee',       // Targets (goal)
  orange: '#f97316',     // Gun and shots (player)
  red: '#ef4444',        // A target that reaches the line (danger)
  slate: '#475569',
  slateEdge: '#64748b',
};
const T = TUNING;
const STEP = T.physicsStep;
const DEG = Math.PI / 180;

// Challenge data. Positions come from makeRng(seed) in setup only (build below); resolution is deterministic.
// x is the range of target centres, yBand the fraction (0 top, 1 bottom) of the legal height band, minDy the least
// height change from the previous target. Speed heights are one per spawn. speedMul scales approachSpeed
// (Speed 1, 2, 3 = 60, 80, 100 at the default tuning).
// Stars: three at 85 percent of the scripted perfect run (every shot a bullseye timed to the recovery), two at 55,
// one at 30, rounded to 10. The perfect-run score is in each comment.
const CHALLENGES = [
  { // Teaches the kick: the second quick shot sails high. Perfect run 2150.
    id: 'a1', ladder: 'accuracy', level: 1, name: 'Accuracy 1', seed: 41001,
    accTargets: 8, accAmmo: 12, scale: 1.3, x: [370, 430], yBand: [0.15, 0.9], minDy: 50,
    stars: { one: 650, two: 1180, three: 1830 },
  },
  { // Teaches tip 2: nudge down as you fire. Perfect run 2950.
    id: 'a2', ladder: 'accuracy', level: 2, name: 'Accuracy 2', seed: 41002,
    accTargets: 10, accAmmo: 13, scale: 1.0, x: [300, 560], yBand: [0, 1], minDy: 70,
    stars: { one: 890, two: 1620, three: 2510 },
  },
  { // Teaches tip 5: every third target is high, so the kick can carry the barrel there. Perfect run 3750.
    id: 'a3', ladder: 'accuracy', level: 3, name: 'Accuracy 3', seed: 41003,
    accTargets: 12, accAmmo: 14, scale: 0.8, x: [520, 612], yBand: [0, 1], minDy: 70,
    high: { every: 3, band: [0, 0.2] },
    stars: { one: 1130, two: 2060, three: 3190 },
  },
  { // Teaches prioritising: one target at a time. Perfect run 4150.
    id: 's1', ladder: 'speed', level: 1, name: 'Speed 1', seed: 42001,
    speedSeconds: 25, spawnEvery: 2.0, speedMul: 1, maxTargets: 1, scale: 1.2, yBand: [0.1, 0.9], minDy: 60,
    stars: { one: 1250, two: 2280, three: 3530 },
  },
  { // Perfect run 7350.
    id: 's2', ladder: 'speed', level: 2, name: 'Speed 2', seed: 42002,
    speedSeconds: 30, spawnEvery: 1.4, speedMul: 4 / 3, maxTargets: 2, scale: 1.0, yBand: [0, 1], minDy: 80,
    stars: { one: 2210, two: 4040, three: 6250 },
  },
  { // Perfect run 12950.
    id: 's3', ladder: 'speed', level: 3, name: 'Speed 3', seed: 42003,
    speedSeconds: 35, spawnEvery: 1.0, speedMul: 5 / 3, maxTargets: 3, scale: 0.9, yBand: [0, 1], minDy: 110,
    stars: { one: 3890, two: 7120, three: 11010 },
  },
];

// ---------- Setup (seeded) ----------

// Where a target of this scale may sit: never in the thumb lane, under the gun, or off the field.
function legal(sc) {
  const r = T.zoneR[2] * sc;
  return { x0: T.gunLineX + T.targetGapX + r, x1: T.designW - T.targetEdge - r, y0: T.targetTop + r, y1: T.designH - T.thumbLane - r };
}

function pickY(rng, lg, band, prev, minDy) {
  let y = 0;
  for (let i = 0; i < 40; i++) {
    y = lg.y0 + (lg.y1 - lg.y0) * rng.range(band[0], band[1]);
    if (prev === null || Math.abs(y - prev) >= minDy) break;
  }
  return y;
}

const BUILT = new Map();
// Accuracy: the fixed list of target centres. Speed: the fixed list of spawn heights (x is the far end of the field).
function build(ch) {
  let b = BUILT.get(ch.id);
  if (b) return b;
  const rng = makeRng(ch.seed), lg = legal(ch.scale);
  const n = ch.ladder === 'accuracy' ? ch.accTargets : Math.ceil(ch.speedSeconds / ch.spawnEvery) + 2;
  b = [];
  let prev = null;
  for (let i = 0; i < n; i++) {
    const band = ch.high && (i + 1) % ch.high.every === 0 ? ch.high.band : ch.yBand;
    const x = ch.ladder === 'accuracy' ? clamp(rng.range(ch.x[0], ch.x[1]), lg.x0, lg.x1) : lg.x1;
    const y = pickY(rng, lg, band, prev, ch.minDy);
    b.push({ x, y });
    prev = y;
  }
  BUILT.set(ch.id, b);
  return b;
}

// ---------- The sim: fixed step, input queued by timestamp so frame rate never changes an outcome ----------

function makeRun(ch) {
  return {
    ch, list: build(ch), idx: 0, targets: [],
    steps: 0, acc: 0, q: [], frameReal: 0, events: [],
    gunY: T.startGunY, angle: 0, kUp: false, kDown: false,
    score: 0, streak: 0, shots: 0, hits: 0, bulls: 0, misses: 0,
    ammo: ch.ladder === 'accuracy' ? ch.accAmmo : Infinity,
    nextAt: T.startDelay, done: false,
  };
}

function moveGun(run, du) { run.gunY = clamp(run.gunY + du, T.gunMinY, T.gunMaxY); }

// Queue an input at sim time `at` (seconds). kind: 'move' (value is design units) or 'fire'.
function queueInput(run, at, kind, value) { run.q.push({ at, kind, value }); }

function finish(run) {
  if (run.done) return;
  run.done = true;
  run.events.push({ type: 'end' });
}

function spawnTarget(run) {
  const ch = run.ch, p = run.list[run.idx++];
  run.targets.push({ x: p.x, y: p.y, sc: ch.scale, life: T.accLife });
}

// One shot along the true barrel line, then the kick. The shot stops at the first target it crosses.
function fire(run) {
  if (run.done || run.ammo <= 0) return;
  const a = run.angle * DEG, sn = Math.sin(a), cs = Math.cos(a);
  const gx = T.gunX, gy = run.gunY;
  let hit = null, hitAlong = Infinity, hitPerp = 0;
  for (const tg of run.targets) {
    const vx = tg.x - gx, vy = tg.y - gy;
    const along = vx * cs - vy * sn;
    const perp = Math.abs(vx * sn + vy * cs);
    if (along > 0 && perp <= T.zoneR[2] * tg.sc && along < hitAlong) { hit = tg; hitAlong = along; hitPerp = perp; }
  }
  const ev = { type: 'shot', x0: gx + cs * T.barrelLen, y0: gy - sn * T.barrelLen, hit: !!hit };
  if (hit) {
    const z = hitPerp <= T.zoneR[0] * hit.sc ? 0 : hitPerp <= T.zoneR[1] * hit.sc ? 1 : 2;
    const mult = Math.min(T.comboCap, 1 + T.comboStep * run.streak);
    const pts = Math.round(T.zonePoints[z] * mult);
    run.score += pts; run.streak++; run.hits++;
    if (z === 0) run.bulls++;
    run.targets.splice(run.targets.indexOf(hit), 1);
    if (run.ch.ladder === 'accuracy') run.nextAt = run.steps * STEP + T.accGap;
    Object.assign(ev, { x1: gx + cs * hitAlong, y1: gy - sn * hitAlong, tx: hit.x, ty: hit.y, zone: z, pts, mult, streak: run.streak });
  } else {
    run.streak = 0; run.misses++;
    const len = (T.designW - gx) / cs;
    Object.assign(ev, { x1: gx + cs * len, y1: gy - sn * len, streak: 0 });
  }
  run.events.push(ev);
  run.angle = Math.min(T.kickMax, run.angle + T.kickPerShot);
  run.ammo--; run.shots++;
  if (run.ch.ladder === 'accuracy' && (run.ammo <= 0 || (run.idx >= run.list.length && !run.targets.length))) finish(run);
}

function stepAccuracy(run, t) {
  const tg = run.targets[0];
  if (tg) {
    tg.life -= STEP;
    if (tg.life <= 0) {
      run.targets.length = 0; run.streak = 0; run.misses++;
      run.events.push({ type: 'expire', x: tg.x, y: tg.y });
      run.nextAt = t + T.accGap;
    }
  } else if (run.idx < run.list.length && t >= run.nextAt) spawnTarget(run);
  if (!run.targets.length && run.idx >= run.list.length) finish(run);
}

function stepSpeed(run, t) {
  const ch = run.ch, v = T.approachSpeed * ch.speedMul * STEP;
  for (let i = run.targets.length - 1; i >= 0; i--) {
    const tg = run.targets[i];
    tg.x -= v;
    if (tg.x <= T.gunLineX) {
      run.targets.splice(i, 1); run.streak = 0; run.misses++;
      run.events.push({ type: 'breach', x: tg.x, y: tg.y });
    }
  }
  if (t >= ch.speedSeconds) { finish(run); return; }
  if (run.idx < run.list.length && t >= run.nextAt && run.targets.length < ch.maxTargets) {
    spawnTarget(run); run.nextAt = t + ch.spawnEvery;
  }
}

function step(run) {
  if (run.kUp || run.kDown) moveGun(run, ((run.kDown ? 1 : 0) - (run.kUp ? 1 : 0)) * T.keyMoveSpeed * STEP);
  run.angle = Math.max(0, run.angle - T.kickRecovery * STEP);
  run.steps++;
  const t = run.steps * STEP;
  if (run.ch.ladder === 'accuracy') stepAccuracy(run, t); else stepSpeed(run, t);
}

// Fixed-step accumulator. Queued inputs apply at the start of the step that contains their timestamp.
function advance(run, dt) {
  run.acc += dt;
  while (run.acc >= STEP - 1e-12 && !run.done) {
    const tEnd = (run.steps + 1) * STEP;
    while (run.q.length && run.q[0].at <= tEnd + 1e-9) {
      const e = run.q.shift();
      if (e.kind === 'move') moveGun(run, e.value); else fire(run);
    }
    run.acc -= STEP;
    step(run);
  }
}

// Sim time of "now" for an input event arriving between frames.
function stamp(run) {
  return run.steps * STEP + run.acc + Math.min(0.05, Math.max(0, (performance.now() - run.frameReal) / 1000));
}

function starsFor(ch, score) { return score >= ch.stars.three ? 3 : score >= ch.stars.two ? 2 : score >= ch.stars.one ? 1 : 0; }

// ---------- Save ----------

function bests(E) { const b = E.save.get('best', {}); return b && typeof b === 'object' ? b : {}; }
function starsOf(E, ch) { const b = bests(E)[ch.id]; return b && b.stars ? b.stars : 0; }
function isUnlocked(E, ch) {
  if (ch.level === 1) return true;
  const prev = CHALLENGES.find((c) => c.ladder === ch.ladder && c.level === ch.level - 1);
  return starsOf(E, prev) >= T.unlockStars;
}
function pointsTotal(E) { return CHALLENGES.reduce((n, ch) => n + T.starPoints[starsOf(E, ch)], 0); }
// Play on the menu: the first unlocked challenge with no stars yet, else the first challenge.
function firstPlayable(E) { return CHALLENGES.find((ch) => isUnlocked(E, ch) && starsOf(E, ch) === 0) || CHALLENGES[0]; }

// ---------- Drawing ----------

function view(E) {
  const aw = E.w - E.safe.left - E.safe.right, ah = E.h - E.safe.top - E.safe.bottom;
  const s = Math.min(aw / T.designW, ah / T.designH);
  return { s, ox: E.safe.left + (aw - T.designW * s) / 2, oy: E.safe.top + (ah - T.designH * s) / 2, w: T.designW * s, h: T.designH * s };
}

function drawStar(ctx, cx, cy, R, fill, stroke) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? R * 0.45 : R;
    ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
}

function drawLock(ctx, cx, cy) {
  ctx.strokeStyle = T.slateEdge; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy - 3, 5, Math.PI, 0); ctx.stroke();
  ctx.fillStyle = T.slateEdge; ctx.fillRect(cx - 7, cy - 3, 14, 11);
}

function drawTarget(ctx, x, y, sc) {
  const cols = ['#ffffff', T.cyan, T.slateEdge];
  for (let i = 2; i >= 0; i--) { ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.arc(x, y, T.zoneR[i] * sc, 0, Math.PI * 2); ctx.fill(); }
}

const ZONE_COLOR = ['#ffffff', T.cyan, '#94a3b8'];

// The gun: white body, the barrel rotates with the kick, orange tip. Pivot at (gunX, gunY).
function drawGun(ctx, E, gy, angle) {
  const gx = T.gunX;
  E.roundRect(gx - 44, gy - 14, 46, 28, 5, '#f8fafc');
  E.roundRect(gx - 34, gy + 8, 14, 22, 3, '#e2e8f0');
  ctx.save();
  ctx.translate(gx, gy); ctx.rotate(-angle * DEG);
  ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, -4, T.barrelLen - 9, 8);
  ctx.fillStyle = T.orange; ctx.fillRect(T.barrelLen - 9, -4, 9, 8);
  ctx.restore();
}

// Dotted line along the true barrel angle from the tip to the right edge, fading with distance.
function drawRangeFinder(ctx, gy, angle) {
  const a = angle * DEG, cs = Math.cos(a), sn = Math.sin(a);
  const d0 = T.barrelLen + 6, d1 = (T.designW - T.gunX) / cs, n = T.rangeDots;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < n; i++) {
    const d = d0 + (d1 - d0) * (i + 0.5) / n;
    ctx.globalAlpha = 1 - 0.75 * (i / n);
    ctx.beginPath(); ctx.arc(T.gunX + cs * d, gy - sn * d, 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---------- Play state ----------

const S = {};

function newRun(ch) {
  S.ch = ch; S.run = makeRun(ch);
  S.fx = []; S.endT = 0; S.drag = null; S.spaceWas = false;
  S.run.frameReal = performance.now();
}

function cosmetics(E, ev) {
  if (ev.type === 'shot') {
    S.fx.push({ k: 'tracer', x0: ev.x0, y0: ev.y0, x1: ev.x1, y1: ev.y1, t: T.tracerLife, max: T.tracerLife });
    S.fx.push({ k: 'flash', x: ev.x0, y: ev.y0, t: T.flashLife, max: T.flashLife });
    E.audio.play('tap'); E.haptic(8);
    if (ev.hit) {
      S.fx.push({ k: 'pop', x: ev.tx, y: ev.ty, text: `${ev.pts}`, color: ZONE_COLOR[ev.zone], t: T.popLife, max: T.popLife });
      if (ev.zone === 0) { E.audio.play('coin'); E.haptic(16); }
      E.audio.play('hit', 0.5);
      E.audio.beep({ freq: 440 * Math.pow(2, Math.min(ev.streak, 12) / 12), dur: 0.06, type: 'triangle', gain: 0.1 });
    }
  } else if (ev.type === 'breach') {
    S.fx.push({ k: 'edge', t: T.edgeLife, max: T.edgeLife });
    E.audio.play('miss'); E.haptic(30);
  }
}

function endRun(E) {
  const r = S.run, ch = S.ch, stars = starsFor(ch, r.score);
  const prev = bests(E)[ch.id];
  const isNew = !prev || r.score > prev.score;
  if (isNew) E.save.update('best', (b) => ({ ...(b && typeof b === 'object' ? b : {}), [ch.id]: { score: r.score, stars } }), {});
  const bestStars = Math.max(stars, prev && prev.stars ? prev.stars : 0);
  E.setScene('over', { id: ch.id, score: r.score, stars, best: isNew ? r.score : prev.score, isNew, bestStars, hits: r.hits, bulls: r.bulls, shots: r.shots });
}

// ---------- Scenes ----------

const menu = {
  enter() { this.tiles = []; this.btnPlay = null; this.btnMute = null; },
  render(ctx, E) {
    const side = 16 + Math.max(E.safe.left, E.safe.right), W = Math.min(E.w - 2 * side, 560), x0 = (E.w - W) / 2;
    const gap = 10, tw = (W - 2 * gap) / 3, th = 64, H = 318;
    const y0 = Math.max(E.safe.top + 6, E.safe.top + (E.h - E.safe.top - E.safe.bottom - H) / 2);
    E.text('RECOIL', E.w / 2, y0 + 16, { size: 30, weight: '800' });
    E.text(`Points ${pointsTotal(E)}`, E.w / 2, y0 + 46, { size: 16, color: T.cyan });
    this.tiles = [];
    [['accuracy', 'Accuracy'], ['speed', 'Speed']].forEach(([ladder, label], row) => {
      const top = y0 + 90 + row * 102;
      E.text(label, x0, top - 14, { size: 14, align: 'left', color: '#9aa4b2' });
      CHALLENGES.filter((c) => c.ladder === ladder).forEach((ch, i) => {
        const x = x0 + i * (tw + gap), locked = !isUnlocked(E, ch), st = starsOf(E, ch);
        E.roundRect(x, top, tw, th, 10, locked ? '#0c1220' : '#1a2338', st ? T.cyan : locked ? '#1d2740' : T.slate);
        E.text(`${ch.level}`, x + tw / 2, top + 20, { size: 20, weight: '800', color: locked ? '#475569' : '#e6e6e6' });
        if (locked) drawLock(ctx, x + tw / 2, top + th - 20);
        else for (let k = 0; k < 3; k++) drawStar(ctx, x + tw / 2 + (k - 1) * 20, top + th - 17, 7.5, k < st ? T.cyan : null, k < st ? null : '#334155');
        this.tiles.push({ x, y: top, w: tw, h: th, ch, locked });
      });
    });
    const by = y0 + 294, mw = 130, pw = Math.min(260, W - mw - 12), bx = E.w / 2 - (pw + mw + 12) / 2;
    this.btnPlay = E.button(`Play ${firstPlayable(E).name}`, bx + pw / 2, by, { w: pw, h: 48, fill: T.orange, color: '#1a0a02', size: 18 });
    this.btnMute = E.button(E.audio.muted ? 'Sound: off' : 'Sound: on', bx + pw + 12 + mw / 2, by, { w: mw, h: 48, fill: T.slate, size: 15 });
  },
  onTap(p, E) {
    if (E.hit(this.btnPlay, p)) { E.setScene('play', { id: firstPlayable(E).id }); return; }
    if (E.hit(this.btnMute, p)) { E.audio.toggleMute(); E.audio.play('tap'); return; }
    for (const t of this.tiles) if (!t.locked && E.hit(t, p)) { E.setScene('play', { id: t.ch.id }); return; }
  },
};

const play = {
  enter(E, params) {
    newRun(CHALLENGES.find((c) => c.id === (params && params.id)) || CHALLENGES[0]);
    this.menuBtn = null;
  },

  update(dt, E) {
    const r = S.run;
    for (const f of S.fx) f.t -= dt;
    S.fx = S.fx.filter((f) => f.t > 0);
    r.kUp = E.keys.has('ArrowUp'); r.kDown = E.keys.has('ArrowDown');
    const sp = E.keys.has(' ');
    if (sp && !S.spaceWas) queueInput(r, stamp(r), 'fire');
    S.spaceWas = sp;
    advance(r, dt);
    r.frameReal = performance.now();
    for (const ev of r.events) cosmetics(E, ev);
    r.events.length = 0;
    if (r.done) { S.endT += dt; if (S.endT >= T.endDelay) endRun(E); }
  },

  render(ctx, E) {
    const v = view(E), r = S.run, ch = S.ch;
    ctx.save();
    ctx.translate(v.ox, v.oy); ctx.scale(v.s, v.s);
    ctx.beginPath(); ctx.rect(0, 0, T.designW, T.designH); ctx.clip();
    const horizon = T.designH - T.thumbLane;
    ctx.fillStyle = T.fieldColor; ctx.fillRect(0, 0, T.designW, horizon);
    ctx.fillStyle = T.groundColor; ctx.fillRect(0, horizon, T.designW, T.designH - horizon);
    ctx.fillStyle = T.horizonColor; ctx.fillRect(0, horizon - 1, T.designW, 2);
    ctx.fillStyle = T.slate; ctx.fillRect(T.designW - 3, 0, 3, T.designH);
    if (ch.ladder === 'speed') {
      ctx.strokeStyle = T.red; ctx.globalAlpha = 0.35; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(T.gunLineX, 0); ctx.lineTo(T.gunLineX, horizon); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    for (const f of S.fx) if (f.k === 'edge') {
      ctx.fillStyle = T.red; ctx.globalAlpha = 0.8 * (f.t / f.max); ctx.fillRect(0, 0, 10, T.designH); ctx.globalAlpha = 1;
    }
    for (const tg of r.targets) {
      drawTarget(ctx, tg.x, tg.y, tg.sc);
      if (ch.ladder === 'accuracy') {
        ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(tg.x, tg.y, T.zoneR[2] * tg.sc + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(tg.life / T.accLife, 0, 1)); ctx.stroke();
      }
    }
    drawRangeFinder(ctx, r.gunY, r.angle);
    for (const f of S.fx) if (f.k === 'tracer') {
      ctx.strokeStyle = T.orange; ctx.globalAlpha = f.t / f.max; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(f.x0, f.y0); ctx.lineTo(f.x1, f.y1); ctx.stroke(); ctx.globalAlpha = 1;
    }
    drawGun(ctx, E, r.gunY, r.angle);
    for (const f of S.fx) if (f.k === 'flash') {
      ctx.globalAlpha = f.t / f.max; ctx.fillStyle = '#fde68a';
      ctx.beginPath(); ctx.arc(f.x, f.y, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = T.orange; ctx.beginPath(); ctx.arc(f.x, f.y, 6, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.restore();

    for (const f of S.fx) if (f.k === 'pop') {
      const k = 1 - f.t / f.max;
      E.text(f.text, v.ox + f.x * v.s, v.oy + (f.y - 18 - 22 * k) * v.s, { size: 20, weight: '800', color: f.color, alpha: 1 - k * k });
    }
    this.hud(E, v, r, ch);
  },

  // HUD inside the safe insets: the field is fitted to the safe area, so anything anchored to it is inside.
  hud(E, v, r, ch) {
    const pad = T.hudPad, xl = v.ox + pad, xr = v.ox + v.w - pad, compact = v.w < 560;
    const hudH = compact ? 70 : 44;
    const top = v.oy - hudH - 4 >= E.safe.top + 4 ? v.oy - hudH - 4 : v.oy + 4;
    this.menuBtn = E.button('Menu', xl + 32, top + 22, { w: 64, h: 44, size: 14, fill: '#1f2937' });
    const accuracy = ch.ladder === 'accuracy';
    const meter = accuracy ? `Ammo ${r.ammo}` : `Time ${Math.max(0, Math.ceil(ch.speedSeconds - r.steps * STEP))}`;
    E.text(ch.name, xl + 76, top + 22, { size: 16, align: 'left' });
    E.text(meter, compact ? xl + 4 : xl + 76 + 108, top + (compact ? 58 : 22), { size: 16, align: 'left', color: accuracy && r.ammo <= 3 ? T.orange : '#cbd5e1' });
    E.text(`${r.score}`, xr, top + 22, { size: 24, weight: '800', align: 'right' });
    const mult = Math.min(T.comboCap, 1 + T.comboStep * r.streak), live = r.streak > 0;
    const cy = compact ? top + 58 : top + 22, cx = compact ? xr : xr - 88;
    E.text(`x${mult.toFixed(1)}`, cx, cy, { size: 16, align: 'right', color: live ? T.orange : '#64748b' });
    const pips = Math.round((T.comboCap - 1) / T.comboStep), ctx = E.ctx;
    const py = compact ? cy : top + 40, pxEnd = compact ? cx - 44 : cx - 4;
    for (let i = 0; i < pips; i++) {
      ctx.fillStyle = i < r.streak ? T.orange : '#334155';
      ctx.beginPath(); ctx.arc(pxEnd - (pips - 1 - i) * 11, py, 3.5, 0, Math.PI * 2); ctx.fill();
    }
  },

  onPointerDown(p, E) {
    if (S.run.done || (this.menuBtn && E.hit(this.menuBtn, p))) return;
    if (p.x < E.w / 2 && !S.drag) S.drag = { id: p.id, y: p.y };
  },
  onPointerMove(p, E) {
    if (!S.drag || S.drag.id !== p.id) return;
    const dy = p.y - S.drag.y;
    S.drag.y = p.y;
    if (dy) queueInput(S.run, stamp(S.run), 'move', (dy / view(E).s) * T.dragGain);
  },
  onPointerUp(p) {
    if (S.drag && S.drag.id === p.id) S.drag = null; // a cancelled pointer ends its gesture the same way
  },
  onTap(p, E) {
    if (this.menuBtn && E.hit(this.menuBtn, p)) { E.setScene('menu'); return; }
    if (p.startX >= E.w / 2) queueInput(S.run, stamp(S.run), 'fire');
  },
  onKey(key, E) {
    if (key === 'Escape') E.setScene('menu');
  },
  onPause() { newRun(S.ch); }, // closing the app mid-challenge restarts it
};

const over = {
  enter(E, params) {
    this.p = params; this.ch = CHALLENGES.find((c) => c.id === params.id); this.t0 = E.time;
    this.next = CHALLENGES.find((c) => c.ladder === this.ch.ladder && c.level === this.ch.level + 1);
    this.canNext = !!this.next && params.bestStars >= T.unlockStars;
    E.audio.play(params.stars >= 1 ? 'win' : 'lose'); E.haptic(30);
  },
  render(ctx, E) {
    const p = this.p, ch = this.ch, cx = E.w / 2;
    const H = 290, y0 = Math.max(E.safe.top + 8, E.safe.top + (E.h - E.safe.top - E.safe.bottom - H) / 2);
    E.text(ch.name, cx, y0 + 10, { size: 16, color: '#9aa4b2' });
    E.text(`${p.score}`, cx, y0 + 56, { size: 46, weight: '800' });
    const age = E.time - this.t0;
    for (let i = 0; i < 3; i++) {
      const sx = cx + (i - 1) * 60, sy = y0 + 112;
      if (i < p.stars) {
        const k = ease.outBack(clamp((age - i * 0.2) / 0.3, 0, 1));
        if (k > 0) drawStar(ctx, sx, sy, 22 * k, T.cyan);
      } else drawStar(ctx, sx, sy, 22, null, '#334155');
    }
    const acc = ch.ladder === 'accuracy';
    E.text(`Hits ${p.hits}${acc ? ` of ${ch.accTargets}` : ''}   Bullseyes ${p.bulls}`, cx, y0 + 158, { size: 16, color: '#cbd5e1' });
    E.text(p.isNew ? `New best ${p.best}` : `Best ${p.best}`, cx, y0 + 182, { size: 16, color: p.isNew ? T.orange : '#9aa4b2' });
    E.text(`Stars at ${ch.stars.one} / ${ch.stars.two} / ${ch.stars.three}`, cx, y0 + 206, { size: 14, color: '#64748b' });
    const btns = [['Again', T.orange, '#1a0a02', 'again']];
    if (this.canNext) btns.push(['Next', T.cyan, '#04141a', 'next']);
    btns.push(['Menu', T.slate, '#e6e6e6', 'menu']);
    const bw = Math.min(140, (E.w - 32 - 16) / 3), by = y0 + 262;
    this.btns = btns.map(([label, fill, color, act], i) => {
      const x = cx + (i - (btns.length - 1) / 2) * (bw + 12);
      return { act, ...E.button(label, x, by, { w: bw, h: 52, fill, color, size: 18 }) };
    });
  },
  onTap(p, E) {
    const b = this.btns.find((b) => E.hit(b, p));
    if (!b) return;
    E.audio.play('tap');
    if (b.act === 'again') E.setScene('play', { id: this.ch.id });
    else if (b.act === 'next') E.setScene('play', { id: this.next.id });
    else E.setScene('menu');
  },
};

export const game = {
  slug: 'recoil',
  title: 'Recoil',
  saveVersion: 1,
  migrate(data, fromVersion) { return data; },
  TUNING,
  experiments: [
    { key: 'kickPerShot', label: 'Kick per shot (deg)', min: 2, max: 15, step: 0.5 },
    { key: 'kickRecovery', label: 'Kick recovery (deg/s)', min: 10, max: 80, step: 1 },
    { key: 'dragGain', label: 'Drag gain', min: 0.5, max: 2, step: 0.05 },
    { key: 'approachSpeed', label: 'Approach speed (Speed 1)', min: 30, max: 160, step: 5 },
  ],
  start: 'menu',
  scenes: { menu, play, over },
};
