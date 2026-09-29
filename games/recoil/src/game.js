// Recoil, v0.3: the mechanic plus guns, barrel sway, moving targets, skeet, a boss, and progression (four guns unlocked by
// points, nine badges, a gauntlet). One thumb drags the gun up and down, the other fires, and every shot kicks the barrel up.
// Instant shot lines scored by zone, a combo multiplier, four ladders, stars, points, menu and card. Grey box: shapes and three colours only.
// Landscape, two thumbs (ADR-0013).

import { makeRng, ease, clamp } from './engine.js';

// Design-space units unless stated. Names match the PRDs; the rest are marked.
// Per-challenge values (counts, timers, spawn intervals, scales, star thresholds) live in CHALLENGES.
const TUNING = {
  designW: 640,          // Design space width
  designH: 360,          // Design space height
  gunX: 70,              // Gun pivot from the left edge
  gunLineX: 110,         // Approaching targets vanish as a miss at this x
  thumbLane: 70,         // Bottom band with no targets
  gunMinY: 60,           // Highest gun position (raised from 40 so the HUD never covers the gun or the range finder)
  gunMaxY: 300,          // Lowest gun position
  dragGain: 1.0,         // Design units of gun movement per design unit of drag
  kickMax: 28,           // Cap on the kick angle (degrees)
  zoneR: [6, 14, 24],    // Bullseye, inner, outer radii at scale 1
  zonePoints: [100, 50, 20], // Points per zone
  comboStep: 0.5,        // Multiplier added per consecutive hit
  comboCap: 4,           // Max multiplier
  rangeDots: 28,         // Dots on the range finder
  approachSpeed: 60,     // Base approach speed in Speed 1 (other levels scale it)
  physicsStep: 1 / 120,  // Fixed timestep
  particleCap: 200,      // Reserved for a later layer; there are no particles

  // v0.2 section F.
  swayPerSpeed: 0.02,    // Degrees of barrel sway per unit per second of gun movement (200 u/s sways 4 degrees)
  swayMax: 6,            // Cap on sway in degrees
  swayRecovery: 40,      // Degrees per second the sway settles once the gun stops
  weaveAmp: 40,          // Vertical amplitude of a weave
  weavePeriod: 1.4,      // Seconds per weave cycle
  dodgeRange: 30,        // A shot within this of the target centre triggers a dodge
  dodgeStep: 60,         // Dodge distance
  dodgeCooldown: 1.2,    // Seconds before a target can dodge again (it flickers when ready)
  hordeCount: 6,         // Targets per horde
  skeetSpeed: 420,       // Launch speed
  skeetGravity: 380,     // Gravity on skeet
  bossPartHp: 2,         // Hit points per boss part
  bossCoreHp: 6,         // Hit points of the core
  bossCoreDrift: 50,     // Core drift speed

  // Guns (v0.2 section A): data, so a later layer adds more. kickPerShot and kickRecovery are per gun now.
  // magSize and reloadSeconds are carried but not used yet: Accuracy keeps its own ammo, the other ladders are unlimited.
  guns: {
    pistol: { id: 'pistol', name: 'Service pistol', short: 'Pistol', damage: 1, fireRate: 9, accuracy: 1.0, kickPerShot: 8, kickRecovery: 32, magSize: 12, reloadSeconds: 1.0, auto: false },
    carbine: { id: 'carbine', name: 'Carbine', short: 'Carbine', damage: 1, fireRate: 8, accuracy: 0.55, kickPerShot: 5, kickRecovery: 24, magSize: 20, reloadSeconds: 1.5, auto: true },
    // v0.3. `pellets` lines leave the barrel in a fixed fan of shotSpread degrees; each pellet deals `damage` on its own.
    shotgun: { id: 'shotgun', name: 'Shotgun', short: 'Shotgun', damage: 1, pellets: 5, fireRate: 2.3, accuracy: 0.4, kickPerShot: 14, kickRecovery: 30, magSize: 6, reloadSeconds: 2.0, auto: false },
    rifle: { id: 'rifle', name: 'Marksman rifle', short: 'Rifle', damage: 3, fireRate: 1.5, accuracy: 1.0, kickPerShot: 16, kickRecovery: 20, magSize: 5, reloadSeconds: 2.0, auto: false },
  },
  shotSpread: 10,        // v0.3: total fan angle of the shotgun's five pellets, degrees
  unlockPoints: [0, 60, 150, 300], // v0.3: points needed per gun, in GUN_IDS order

  // Additions, not in the PRDs.
  swayWindow: 0.05,      // Seconds over which the gun's speed is measured for sway
  dodgeWarn: 0.4,        // A dodge target starts flickering this long before it can dodge again
  accLife: 6,            // Seconds an Accuracy target stays before it is a miss
  accGap: 0.45,          // Seconds between a target going and the next appearing
  startDelay: 0.6,       // Seconds before the first target
  endDelay: 0.8,         // Seconds between the last event and the card
  cardLock: 0.4,         // Seconds the card ignores taps after it appears
  targetTop: 56,         // Top edge of the highest target (keeps the HUD clear)
  targetGapX: 24,        // Clear space between the gun line and a target's left edge
  targetEdge: 8,         // Clear space between a target's right edge and the wall
  barrelLen: 40,         // Barrel length; the tip sits on gunLineX at zero angle
  startGunY: 180,        // Gun height at the start of a challenge
  keyMoveSpeed: 200,     // Keyboard fallback: gun units per second
  unlockStars: 1,        // Stars on a level that unlock the next in its ladder
  starPoints: [0, 10, 25, 50], // Points by best star count
  tracerLife: 0.15,      // Seconds a tracer takes to fade
  flashLife: 0.07,       // Seconds a muzzle flash shows
  popLife: 0.7,          // Seconds a score number floats
  edgeLife: 0.3,         // Seconds the red edge flash shows
  breachGap: 0.3,        // Least seconds between two breach sounds and buzzes
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
const GUN_IDS = ['pistol', 'carbine', 'shotgun', 'rifle'];
// Gauntlet: one level of each ladder in a row, each at two stars or better.
const GAUNTLET = ['a2', 's2', 'k2', 'b1'];

// Challenge data. Positions come from makeRng(seed) in setup only (build below); resolution is deterministic.
// x is the range of target centres, yBand the fraction (0 top, 1 bottom) of the legal height band, minDy the least
// height change from the previous target (met unless the band cannot allow it). behaviour: still, dodge (Accuracy);
// approach, weave, horde (Speed). speedMul scales approachSpeed (Speed 1, 2, 3 = 60, 80, 100 at the default tuning).
// Skeet: launches at skeetEvery seconds, angle range in degrees, skeetMul scales skeetSpeed, pair launches two at once.
// Boss: parts in order, then the core (coreScale, coreBull scale the core and its bullseye).
// Stars: three at 85 percent of the scripted perfect pistol run (every shot a bullseye timed to the recovery, sway
// settled), two at 55, one at 30, rounded to 10. The perfect-run score is in each comment. The carbine plays the same thresholds.
const CHALLENGES = [
  { // Teaches the kick: the second quick shot sails high. Perfect run 2150.
    id: 'a1', ladder: 'accuracy', level: 1, name: 'Accuracy 1', seed: 41001, behaviour: 'still',
    accTargets: 8, accAmmo: 12, scale: 1.3, x: [370, 430], yBand: [0.15, 0.9], minDy: 50,
    stars: { one: 650, two: 1180, three: 1830 },
  },
  { // Teaches tip 2: nudge down as you fire. Perfect run 2950.
    id: 'a2', ladder: 'accuracy', level: 2, name: 'Accuracy 2', seed: 41002, behaviour: 'still',
    accTargets: 10, accAmmo: 13, scale: 1.0, x: [300, 560], yBand: [0, 1], minDy: 70,
    stars: { one: 890, two: 1620, three: 2510 },
  },
  { // Teaches tip 5: every third target is high and the one before it low (the rest sit mid-height), so every change is at least
    // minDy and the kick can carry the barrel to the high ones. Perfect run 3750.
    id: 'a3', ladder: 'accuracy', level: 3, name: 'Accuracy 3', seed: 41003, behaviour: 'still',
    accTargets: 12, accAmmo: 14, scale: 0.8, x: [520, 612], yBand: [0.35, 0.6], minDy: 70,
    high: { every: 3, band: [0, 0.2], before: [0.6, 1] },
    stars: { one: 1130, two: 2060, three: 3190 },
  },
  { // Dodgers: a shot near a flickering target makes it jump, so fire once to make it jump, then again at where it landed. Perfect run 2950.
    id: 'a4', ladder: 'accuracy', level: 4, name: 'Accuracy 4', seed: 41004, behaviour: 'dodge',
    accTargets: 10, accAmmo: 24, scale: 0.9, x: [400, 600], yBand: [0, 1], minDy: 70,
    stars: { one: 890, two: 1620, three: 2510 },
  },
  { // Teaches prioritising: one target at a time. Perfect run 4150.
    id: 's1', ladder: 'speed', level: 1, name: 'Speed 1', seed: 42001, behaviour: 'approach',
    speedSeconds: 25, spawnEvery: 2.0, speedMul: 1, maxTargets: 1, scale: 1.2, yBand: [0.1, 0.9], minDy: 60,
    stars: { one: 1250, two: 2280, three: 3530 },
  },
  { // Perfect run 7350.
    id: 's2', ladder: 'speed', level: 2, name: 'Speed 2', seed: 42002, behaviour: 'approach',
    speedSeconds: 30, spawnEvery: 1.4, speedMul: 4 / 3, maxTargets: 2, scale: 1.0, yBand: [0, 1], minDy: 80,
    stars: { one: 2210, two: 4040, three: 6250 },
  },
  { // Weavers: every target oscillates, so the line has to keep chasing it. The band leaves room for the weave and
    // is only 106 tall, so minDy is 50, the most it allows. Perfect run 12950.
    id: 's3', ladder: 'speed', level: 3, name: 'Speed 3', seed: 42003, behaviour: 'weave',
    speedSeconds: 35, spawnEvery: 1.0, speedMul: 5 / 3, maxTargets: 3, scale: 0.9, yBand: [0.22, 0.78], minDy: 50,
    stars: { one: 3890, two: 7120, three: 11010 },
  },
  { // Hordes: a column of small targets drifting left, each worth outer-ring points. Perfect run 3630.
    id: 's4', ladder: 'speed', level: 4, name: 'Speed 4', seed: 42004, behaviour: 'horde',
    speedSeconds: 35, spawnEvery: 4.5, speedMul: 0.7, maxTargets: 12, scale: 0.55, yBand: [0, 1], minDy: 60,
    hordeSpacing: 30, hordeJitterX: 16, hordeJitterY: 3, // column spacing, and how loose the column is (x and y)
    stars: { one: 1090, two: 2000, three: 3090 },
  },
  { // Clay pigeons from the bottom right; only bullseye and inner count. Perfect run 2950.
    id: 'k1', ladder: 'skeet', level: 1, name: 'Skeet 1', seed: 43001,
    skeetCount: 10, skeetEvery: 2.4, skeetMul: 0.9, pair: false, angle: [58, 68], launchSpread: 30, scale: 1.2,
    stars: { one: 890, two: 1620, three: 2510 },
  },
  { // Two at once. Perfect run 3750.
    id: 'k2', ladder: 'skeet', level: 2, name: 'Skeet 2', seed: 43002,
    skeetCount: 12, skeetEvery: 2.6, skeetMul: 1.0, pair: true, angle: [56, 66], pairSplit: 0.4, pairDx: 46, scale: 1.0, // the pair's angles come from the low and high 40 percent of the range; the second launches pairDx to the left
    stars: { one: 1130, two: 2060, three: 3190 },
  },
  { // Three parts in order, then a drifting core. Perfect run 3750.
    id: 'b1', ladder: 'boss', level: 1, name: 'Boss 1', seed: 44001,
    bossSeconds: 40, scale: 1.1, x: [430, 560], coreX: 520, coreScale: 0.9, coreBull: 0.6,
    stars: { one: 1130, two: 2060, three: 3190 },
    // The shotgun and rifle finish in five scoring hits (perfect run 1000 for both), so their stars are 30/55/85 of that.
    starsByGun: { shotgun: { one: 300, two: 550, three: 850 }, rifle: { one: 300, two: 550, three: 850 } },
  },
];
const LADDERS = [['accuracy', 'Accuracy'], ['speed', 'Speed'], ['skeet', 'Skeet'], ['boss', 'Boss']];

// ---------- Setup (seeded) ----------

// Where a target of this scale may sit: never in the thumb lane, under the gun, or off the field.
function legal(sc) {
  const r = T.zoneR[2] * sc;
  return { x0: T.gunLineX + T.targetGapX + r, x1: T.designW - T.targetEdge - r, y0: T.targetTop + r, y1: T.designH - T.thumbLane - r };
}

// A height in the band that is at least minDy from prev; if the band cannot allow that, the farthest point in it.
function pickY(rng, lg, band, prev, minDy) {
  const lo = lg.y0 + (lg.y1 - lg.y0) * band[0], hi = lg.y0 + (lg.y1 - lg.y0) * band[1];
  if (prev === null) return rng.range(lo, hi);
  const iv = [[lo, Math.min(hi, prev - minDy)], [Math.max(lo, prev + minDy), hi]].filter(([a, b]) => b >= a);
  if (!iv.length) return prev - lo >= hi - prev ? lo : hi;
  let r = rng.range(0, iv.reduce((s, [a, b]) => s + (b - a), 0));
  for (const [a, b] of iv) { if (r <= b - a) return a + r; r -= b - a; }
  return iv[iv.length - 1][1];
}

const BUILT = new Map();
// Accuracy: target centres (with dodge bits). Speed: spawn heights, or horde columns. Skeet: launches. Boss: parts and core.
function build(ch) {
  let b = BUILT.get(ch.id);
  if (b) return b;
  const rng = makeRng(ch.seed), lg = legal(ch.scale);
  if (ch.ladder === 'accuracy') {
    b = [];
    let prev = null;
    for (let i = 0; i < ch.accTargets; i++) {
      const h = ch.high;
      const band = h && (i + 1) % h.every === 0 ? h.band : h && (i + 2) % h.every === 0 ? h.before : ch.yBand;
      const x = clamp(rng.range(ch.x[0], ch.x[1]), lg.x0, lg.x1);
      const y = pickY(rng, lg, band, prev, ch.minDy);
      b.push({ x, y, bits: Array.from({ length: 8 }, () => rng() < 0.5) });
      prev = y;
    }
  } else if (ch.ladder === 'speed') {
    const n = Math.ceil(ch.speedSeconds / ch.spawnEvery) + 2;
    b = [];
    let prev = null;
    if (ch.behaviour === 'horde') {
      const sp = ch.hordeSpacing, jy = ch.hordeJitterY, span = (T.hordeCount - 1) * sp, lh = { y0: lg.y0 + span / 2 + jy, y1: lg.y1 - span / 2 - jy };
      for (let i = 0; i < n; i++) {
        const cy = pickY(rng, lh, ch.yBand, prev, ch.minDy);
        b.push({ members: Array.from({ length: T.hordeCount }, (_, k) => ({ dx: -rng.range(0, ch.hordeJitterX), y: cy - span / 2 + k * sp + rng.range(-jy, jy) })) });
        prev = cy;
      }
    } else {
      for (let i = 0; i < n; i++) { const y = pickY(rng, lg, ch.yBand, prev, ch.minDy); b.push({ y }); prev = y; }
    }
  } else if (ch.ladder === 'skeet') {
    b = [];
    const [lo, hi] = ch.angle, cut = (hi - lo) * (ch.pairSplit || 0);
    const groups = ch.pair ? ch.skeetCount / 2 : ch.skeetCount;
    for (let i = 0; i < groups; i++) {
      const at = T.startDelay + i * ch.skeetEvery;
      if (ch.pair) {
        b.push({ at, a: rng.range(lo, lo + cut), x0: lg.x1 });
        b.push({ at, a: rng.range(hi - cut, hi), x0: lg.x1 - ch.pairDx });
      } else b.push({ at, a: rng.range(lo, hi), x0: lg.x1 - rng.range(0, ch.launchSpread) });
    }
  } else {
    const order = rng.shuffle([0, 1, 2]), h = lg.y1 - lg.y0;
    b = {
      parts: order.map((slot) => ({ x: rng.range(ch.x[0], ch.x[1]), y: lg.y0 + (slot + rng.range(0.15, 0.85)) * h / 3 })),
      core: { x: ch.coreX, y: rng.range(lg.y0, lg.y1), dir: rng() < 0.5 ? 1 : -1 },
    };
  }
  BUILT.set(ch.id, b);
  return b;
}

// ---------- The sim: fixed step, input queued by timestamp so frame rate never changes an outcome ----------

function makeRun(ch, gunId) {
  const gun = T.guns[gunId] || T.guns.pistol, hn = Math.round(T.swayWindow / STEP);
  return {
    ch, gun, list: build(ch), idx: 0, targets: [], stage: 0,
    steps: 0, acc: 0, q: [], frameReal: 0, events: [],
    gunY: T.startGunY, kick: 0, sway: 0, hist: new Array(hn + 1).fill(T.startGunY), hi: 0, hn,
    kUp: false, kDown: false, holding: false, nextFire: 0,
    score: 0, streak: 0, shots: 0, hits: 0, bulls: 0, misses: 0,
    ammo: ch.ladder === 'accuracy' ? ch.accAmmo : Infinity,
    nextAt: T.startDelay, done: false, cleared: false, pairHits: {}, double: false,
  };
}

function moveGun(run, du) { run.gunY = clamp(run.gunY + du, T.gunMinY, T.gunMaxY); }

// The true barrel angle in degrees: kick plus sway.
function angleOf(run) { return run.kick + run.sway; }

// Length along the barrel line of the range finder: it reaches `accuracy` of the way to the right edge.
function rangeLen(run) { return run.gun.accuracy * (T.designW - T.gunX) / Math.cos(angleOf(run) * DEG); }

// Queue an input at sim time `at` (seconds). kind: 'move' (design units), 'fire', or 'trigger' (value: held or not).
function queueInput(run, at, kind, value) { run.q.push({ at, kind, value }); }

function finish(run) {
  if (run.done) return;
  run.done = true;
  run.events.push({ type: 'end' });
}

// Where a target is at sim time t. Written into `o` (which may be the target itself).
function posAt(tg, t, o) {
  const u = t - tg.born;
  o.x = tg.x0; o.y = tg.y0;
  switch (tg.kind) {
    case 'approach': case 'horde': o.x = tg.x0 - tg.v * u; break;
    case 'weave': o.x = tg.x0 - tg.v * u; o.y = clamp(tg.y0 + tg.amp * Math.sin(2 * Math.PI * u / tg.period), tg.ymin, tg.ymax); break;
    case 'skeet': o.x = tg.x0 + tg.vx * u; o.y = tg.y0 + tg.vy * u + 0.5 * tg.g * u * u; break;
    case 'core': {
      const len = tg.ymax - tg.ymin, m = (((tg.y0 - tg.ymin + tg.dir * T.bossCoreDrift * u) % (2 * len)) + 2 * len) % (2 * len);
      o.y = tg.ymin + (m <= len ? m : 2 * len - m);
      break;
    }
  }
}

function addTarget(run, tg, t) {
  tg.born = t; tg.x = tg.x0; tg.y = tg.y0;
  run.targets.push(tg);
  return tg;
}

function spawnAccuracy(run, t) {
  const ch = run.ch, p = run.list[run.idx++], lg = legal(ch.scale);
  addTarget(run, {
    kind: ch.behaviour === 'dodge' ? 'dodge' : 'still', x0: p.x, y0: p.y, sc: ch.scale, life: T.accLife,
    bits: p.bits, dodges: 0, nextDodge: t, ymin: lg.y0, ymax: lg.y1,
  }, t);
}

function spawnSpeed(run, t) {
  const ch = run.ch, e = run.list[run.idx++], lg = legal(ch.scale), v = T.approachSpeed * ch.speedMul;
  if (e.members) {
    for (const m of e.members) addTarget(run, { kind: 'horde', x0: lg.x1 + m.dx, y0: m.y, v, sc: ch.scale, flat: true }, t);
  } else {
    addTarget(run, { kind: ch.behaviour, x0: lg.x1, y0: e.y, v, sc: ch.scale, amp: T.weaveAmp, period: T.weavePeriod, ymin: lg.y0, ymax: lg.y1 }, t);
  }
}

function spawnSkeet(run, t) {
  const ch = run.ch, e = run.list[run.idx++], lg = legal(ch.scale), v = T.skeetSpeed * ch.skeetMul, g = T.skeetGravity;
  const a = Math.min(e.a * DEG, Math.asin(Math.min(1, Math.sqrt(2 * g * (lg.y1 - lg.y0)) / v))); // apex stays on the field
  addTarget(run, { kind: 'skeet', x0: e.x0, y0: lg.y1, vx: -v * Math.cos(a), vy: -v * Math.sin(a), g, sc: ch.scale, group: ch.pair ? (run.idx - 1) >> 1 : undefined }, t);
}

function spawnBoss(run, t) {
  const ch = run.ch;
  run.list.parts.forEach((p, i) => addTarget(run, { kind: 'part', x0: p.x, y0: p.y, sc: ch.scale, hp: T.bossPartHp, hpMax: T.bossPartHp, idx: i }, t));
}

function spawnCore(run, t) {
  const ch = run.ch, c = run.list.core, lg = legal(ch.coreScale);
  addTarget(run, { kind: 'core', x0: c.x, y0: c.y, sc: ch.coreScale, bullMul: ch.coreBull, hp: T.bossCoreHp, hpMax: T.bossCoreHp, dir: c.dir, ymin: lg.y0, ymax: lg.y1 }, t);
}

function targetRadius(tg) { return (tg.kind === 'skeet' ? T.zoneR[1] : T.zoneR[2]) * tg.sc; }

function dodge(tg, now) {
  let dir = tg.bits[tg.dodges % tg.bits.length] ? 1 : -1;
  if (tg.y0 + dir * T.dodgeStep < tg.ymin || tg.y0 + dir * T.dodgeStep > tg.ymax) dir = -dir;
  tg.y0 = clamp(tg.y0 + dir * T.dodgeStep, tg.ymin, tg.ymax); tg.y = tg.y0;
  tg.dodges++; tg.nextDodge = now + T.dodgeCooldown;
}

function checkEnd(run) {
  if (run.ch.ladder === 'accuracy' && (run.ammo <= 0 || (run.idx >= run.list.length && !run.targets.length))) finish(run);
  else if (run.ch.ladder === 'boss' && run.cleared) finish(run);
}

// The angle offsets of a gun's pellets from the barrel: one line straight ahead, or a fixed fan of shotSpread degrees.
function fanOffsets(g) {
  const n = g.pellets || 1;
  return Array.from({ length: n }, (_, i) => (n > 1 ? T.shotSpread * (i / (n - 1) - 0.5) : 0));
}

// One shot: every pellet flies its own line from the gun and stops at the first target it crosses; then the kick.
// The shot scores once, by its best pellet's zone. Each pellet damages separately. A pellet on an inactive boss part is neutral.
function fire(run) {
  if (run.done || run.ammo <= 0) return;
  const g = run.gun, now = run.steps * STEP;
  if (now < run.nextFire - STEP - 1e-9) return; // one step of slack, so a tap at the nominal interval is not lost to step rounding
  run.nextFire = Math.max(now, run.nextFire) + 1 / g.fireRate; // held fire keeps the exact rate
  const gx = T.gunX, gy = run.gunY, a0 = angleOf(run);
  const lines = fanOffsets(g).map((off) => { const a = (a0 + off) * DEG; return { sn: Math.sin(a), cs: Math.cos(a) }; });
  let dodged = false;
  for (const tg of run.targets) {
    if (tg.kind !== 'dodge' || now < tg.nextDodge - 1e-9) continue;
    const vx = tg.x - gx, vy = tg.y - gy;
    if (lines.some((l) => vx * l.cs - vy * l.sn > 0 && Math.abs(vx * l.sn + vy * l.cs) <= T.dodgeRange)) { dodge(tg, now); dodged = true; }
  }
  const res = lines.map((l) => {
    let tg = null, along = Infinity, perp = 0;
    for (const t of run.targets) {
      const vx = t.x - gx, vy = t.y - gy, al = vx * l.cs - vy * l.sn, pe = Math.abs(vx * l.sn + vy * l.cs);
      if (al > 0 && pe <= targetRadius(t) && al < along) { tg = t; along = al; perp = pe; }
    }
    const len = tg ? along : (T.designW - gx) / l.cs;
    return { tg, perp, x1: gx + l.cs * len, y1: gy - l.sn * len, neutral: !!tg && tg.kind === 'part' && tg.idx !== run.stage };
  });
  const R = T.zoneR;
  const zoneOf = (r) => (r.tg.flat ? 2 : r.perp <= R[0] * r.tg.sc * (r.tg.bullMul || 1) ? 0 : r.perp <= R[1] * r.tg.sc ? 1 : 2);
  const scoring = res.filter((r) => r.tg && !r.neutral);
  const mid = res[(res.length - 1) >> 1];
  const ev = { type: 'shot', x0: gx + Math.cos(a0 * DEG) * T.barrelLen, y0: gy - Math.sin(a0 * DEG) * T.barrelLen, lines: res.map((r) => ({ x1: r.x1, y1: r.y1 })), x1: mid.x1, y1: mid.y1, hit: scoring.length > 0, dodged: dodged && !scoring.length, neutral: !scoring.length && res.some((r) => r.neutral) };
  if (scoring.length) {
    let best = scoring[0], bz = zoneOf(best);
    for (const r of scoring) { const z = zoneOf(r); if (z < bz) { best = r; bz = z; } }
    const mult = Math.min(T.comboCap, 1 + T.comboStep * run.streak);
    const pts = Math.round(T.zonePoints[bz] * mult);
    run.score += pts; run.streak++; run.hits++;
    if (bz === 0) run.bulls++;
    const down = new Set();
    for (const r of scoring) {
      if (r.tg.hp === undefined) down.add(r.tg);
      else { r.tg.hp -= g.damage; if (r.tg.hp <= 0) down.add(r.tg); }
    }
    for (const tg of down) {
      run.targets.splice(run.targets.indexOf(tg), 1);
      if (run.ch.ladder === 'accuracy') run.nextAt = now + T.accGap;
      if (tg.kind === 'part') { run.stage++; if (run.stage >= run.list.parts.length) spawnCore(run, now); }
      if (tg.kind === 'core') run.cleared = true;
      if (tg.group !== undefined) { run.pairHits[tg.group] = (run.pairHits[tg.group] || 0) + 1; if (run.pairHits[tg.group] >= 2) run.double = true; }
    }
    Object.assign(ev, { tx: best.tg.x, ty: best.tg.y, zone: bz, pts, mult, streak: run.streak, killed: down.size > 0, damaged: best.tg.hp !== undefined });
  } else {
    if (!dodged && !ev.neutral) { run.streak = 0; run.misses++; }
    ev.streak = run.streak;
  }
  run.events.push(ev);
  run.kick = Math.min(T.kickMax, run.kick + g.kickPerShot);
  run.ammo--; run.shots++;
  checkEnd(run);
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
  } else if (run.idx < run.list.length && t >= run.nextAt) spawnAccuracy(run, t);
  if (!run.targets.length && run.idx >= run.list.length) finish(run);
}

function stepSpeed(run, t) {
  const ch = run.ch;
  for (let i = run.targets.length - 1; i >= 0; i--) {
    const tg = run.targets[i];
    if (tg.x <= T.gunLineX) {
      run.targets.splice(i, 1); run.streak = 0; run.misses++;
      run.events.push({ type: 'breach', x: tg.x, y: tg.y });
    }
  }
  if (t >= ch.speedSeconds) { finish(run); return; }
  if (run.idx < run.list.length && t >= run.nextAt) {
    const n = run.list[run.idx].members ? run.list[run.idx].members.length : 1;
    if (run.targets.length + n <= ch.maxTargets) { spawnSpeed(run, t); run.nextAt = t + ch.spawnEvery; }
  }
}

function stepSkeet(run, t) {
  for (let i = run.targets.length - 1; i >= 0; i--) {
    const tg = run.targets[i], u = t - tg.born;
    if (u >= -2 * tg.vy / tg.g || tg.x <= T.gunLineX) {
      run.targets.splice(i, 1); run.streak = 0; run.misses++;
      run.events.push({ type: 'expire', x: tg.x, y: tg.y });
    }
  }
  while (run.idx < run.list.length && run.list[run.idx].at <= t + 1e-9) spawnSkeet(run, t);
  if (run.idx >= run.list.length && !run.targets.length) finish(run);
}

function stepBoss(run, t) {
  if (run.idx === 0 && t >= T.startDelay) { spawnBoss(run, t); run.idx = 1; }
  if (t >= run.ch.bossSeconds) finish(run);
}

function updateSway(run) {
  run.hist[run.hi] = run.gunY;
  run.hi = (run.hi + 1) % (run.hn + 1);
  const v = (run.gunY - run.hist[run.hi]) / (run.hn * STEP);
  const tgt = clamp(T.swayPerSpeed * v, -T.swayMax, T.swayMax);
  if (Math.abs(tgt) >= Math.abs(run.sway) && tgt * run.sway >= 0) run.sway = tgt; // follows the movement at once
  else { const d = T.swayRecovery * STEP; run.sway = run.sway < tgt ? Math.min(tgt, run.sway + d) : Math.max(tgt, run.sway - d); }
}

function step(run) {
  if (run.kUp || run.kDown) moveGun(run, ((run.kDown ? 1 : 0) - (run.kUp ? 1 : 0)) * T.keyMoveSpeed * STEP);
  run.kick = Math.max(0, run.kick - run.gun.kickRecovery * STEP);
  updateSway(run);
  run.steps++;
  const t = run.steps * STEP;
  for (const tg of run.targets) posAt(tg, t, tg);
  const l = run.ch.ladder;
  if (l === 'accuracy') stepAccuracy(run, t);
  else if (l === 'speed') stepSpeed(run, t);
  else if (l === 'skeet') stepSkeet(run, t);
  else stepBoss(run, t);
}

// Fixed-step accumulator. Queued inputs apply at the start of the step that contains their timestamp.
function advance(run, dt) {
  run.acc += dt;
  while (run.acc >= STEP - 1e-12 && !run.done) {
    const tEnd = (run.steps + 1) * STEP;
    while (run.q.length && run.q[0].at <= tEnd + 1e-9) {
      const e = run.q.shift();
      if (e.kind === 'move') moveGun(run, e.value);
      else if (e.kind === 'fire') fire(run);
      else run.holding = !!e.value;
    }
    if (run.holding && run.gun.auto) fire(run);
    run.acc -= STEP;
    step(run);
  }
}

// Sim time of "now" for an input event arriving between frames.
function stamp(run) {
  return run.steps * STEP + run.acc + Math.min(0.05, Math.max(0, (performance.now() - run.frameReal) / 1000));
}

// Thresholds are pistol-derived. Boss 1 is the exception: a one-hit gun has only five scoring hits in it (about 1000 at best),
// so the shotgun and rifle carry their own thresholds from their own perfect runs, or Boss Killer could never be earned.
function thresholds(ch, gun) { return (ch.starsByGun && ch.starsByGun[gun]) || ch.stars; }
function starsFor(ch, score, gun) { const t = thresholds(ch, gun); return score >= t.three ? 3 : score >= t.two ? 2 : score >= t.one ? 1 : 0; }

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
// ---------- Guns: unlocked by points ----------

function gunUnlockedAt(points, id) { return points >= T.unlockPoints[GUN_IDS.indexOf(id)]; }
function gunUnlocked(E, id) { return gunUnlockedAt(pointsTotal(E), id); }
function gunId(E) { const id = E.save.get('gun', 'pistol'); return T.guns[id] && gunUnlocked(E, id) ? id : 'pistol'; }
// The next gun to unlock, or null: { id, need, from } (points needed, threshold of the gun before it).
function nextUnlock(points) {
  const i = GUN_IDS.findIndex((id) => !gunUnlockedAt(points, id));
  return i < 0 ? null : { id: GUN_IDS[i], need: T.unlockPoints[i], from: T.unlockPoints[i - 1] };
}

// ---------- Badges (v0.3 section B): skill acts, tiered ----------

const TIER_COLOR = { Bronze: '#d08a4a', Silver: '#cbd5e1', Gold: '#fbbf24' };
const BADGES = [
  { id: 'marksman1', tier: 'Bronze', name: 'Marksman I', cond: 'Three stars on Accuracy 1' },
  { id: 'quickdraw1', tier: 'Bronze', name: 'Quick Draw I', cond: 'Three stars on Speed 1' },
  { id: 'clay1', tier: 'Bronze', name: 'Clay I', cond: 'Three stars on Skeet 1' },
  { id: 'steady', tier: 'Silver', name: 'Steady', cond: 'Accuracy 4, three stars, carbine' },
  { id: 'storm', tier: 'Silver', name: 'Storm', cond: 'Three stars on Speed 4' },
  { id: 'double', tier: 'Silver', name: 'Double', cond: 'Hit both clays of a Skeet 2 pair' },
  { id: 'bosskiller', tier: 'Gold', name: 'Boss Killer', cond: 'Boss 1 three stars, every gun' },
  { id: 'gauntlet', tier: 'Gold', name: 'Gauntlet', cond: 'A2, S2, K2, B1 in a row, two stars each' },
  { id: 'legend', tier: 'Gold', name: 'Legend', cond: 'Three stars on every challenge' },
];

// Badges a finished run earns that are not already `have`. o: { ch, gun, stars, double, gauntletDone, bests, bossGuns, have }.
// bests and bossGuns already include this run.
function newBadges(o) {
  const id = o.ch.id, three = o.stars === 3;
  const met = {
    marksman1: id === 'a1' && three,
    quickdraw1: id === 's1' && three,
    clay1: id === 'k1' && three,
    steady: id === 'a4' && three && o.gun === 'carbine',
    storm: id === 's4' && three,
    double: id === 'k2' && !!o.double,
    bosskiller: id === 'b1' && three && GUN_IDS.every((g) => o.bossGuns[g]),
    gauntlet: !!o.gauntletDone,
    legend: CHALLENGES.every((c) => o.bests[c.id] && o.bests[c.id].stars === 3),
  };
  return BADGES.filter((b) => met[b.id] && !o.have[b.id]).map((b) => b.id);
}

// After a gauntlet stage: passes at two stars or better; done after the last stage.
function gauntletStep(i, stars) {
  const ok = stars >= 2, done = ok && i + 1 >= GAUNTLET.length;
  return { i, ok, done, next: ok && !done ? GAUNTLET[i + 1] : null };
}
function badgeMap(E) { const b = E.save.get('badges', {}); return b && typeof b === 'object' ? b : {}; }

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

function disc(ctx, x, y, r, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

// Three rings: outer slate, inner cyan, bullseye white. Skeet dims the outer ring (it does not count); a horde member is one disc.
function drawTarget(ctx, tg, alpha) {
  const R = T.zoneR, sc = tg.sc;
  ctx.globalAlpha = alpha;
  if (tg.flat) {
    disc(ctx, tg.x, tg.y, R[2] * sc, T.slateEdge); disc(ctx, tg.x, tg.y, R[1] * sc, T.cyan);
  } else {
    ctx.globalAlpha = alpha * (tg.kind === 'skeet' ? 0.35 : 1); disc(ctx, tg.x, tg.y, R[2] * sc, T.slateEdge);
    ctx.globalAlpha = alpha; disc(ctx, tg.x, tg.y, R[1] * sc, T.cyan); disc(ctx, tg.x, tg.y, R[0] * sc * (tg.bullMul || 1), '#ffffff');
  }
  ctx.globalAlpha = 1;
}

const ZONE_COLOR = ['#ffffff', T.cyan, '#94a3b8'];

// The gun: white body, the barrel rotates with the kick and sway, orange tip. Pivot at (gunX, gunY).
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

// Dotted line along the true barrel angle, fading with distance. It ends `accuracy` of the way to the right edge.
function drawRangeFinder(ctx, run) {
  const a = angleOf(run) * DEG, cs = Math.cos(a), sn = Math.sin(a);
  const d0 = T.barrelLen + 6, d1 = rangeLen(run), n = T.rangeDots;
  if (d1 <= d0) return;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < n; i++) {
    const d = d0 + (d1 - d0) * (i + 0.5) / n;
    ctx.globalAlpha = 1 - 0.75 * (i / n);
    ctx.beginPath(); ctx.arc(T.gunX + cs * d, run.gunY - sn * d, 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (run.gun.pellets > 1) { // the fan's outer pellets, faint
    const offs = fanOffsets(run.gun);
    ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = 0.22; ctx.lineWidth = 1;
    for (const off of [offs[0], offs[offs.length - 1]]) {
      const b = (angleOf(run) + off) * DEG;
      ctx.beginPath(); ctx.moveTo(T.gunX + Math.cos(b) * d0, run.gunY - Math.sin(b) * d0); ctx.lineTo(T.gunX + Math.cos(b) * d1, run.gunY - Math.sin(b) * d1); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

// ---------- Play state ----------

const S = {};

function newRun(ch, id, gauntlet) {
  S.ch = ch; S.gunId = id; S.run = makeRun(ch, id); S.gauntlet = gauntlet === undefined ? null : gauntlet;
  S.fx = []; S.endT = 0; S.drag = null; S.right = new Set(); S.breachAt = -1;
  S.run.frameReal = performance.now();
}

function cosmetics(E, ev) {
  if (ev.type === 'shot') {
    for (const l of ev.lines) S.fx.push({ k: 'tracer', x0: ev.x0, y0: ev.y0, x1: l.x1, y1: l.y1, t: T.tracerLife, max: T.tracerLife });
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
    if (E.time - S.breachAt >= T.breachGap) { S.breachAt = E.time; E.audio.play('miss'); E.haptic(30); } // a horde breaching together sounds once
  }
}

function endRun(E) {
  const r = S.run, ch = S.ch, stars = starsFor(ch, r.score, r.gun.id);
  const prev = bests(E)[ch.id];
  const isNew = !prev || r.score > prev.score;
  if (isNew) E.save.update('best', (b) => ({ ...(b && typeof b === 'object' ? b : {}), [ch.id]: { score: r.score, stars } }), {});
  const bestStars = Math.max(stars, prev && prev.stars ? prev.stars : 0);
  let bossGuns = E.save.get('bossGuns', {});
  if (!bossGuns || typeof bossGuns !== 'object') bossGuns = {};
  if (ch.id === 'b1' && stars === 3 && !bossGuns[r.gun.id]) { bossGuns = { ...bossGuns, [r.gun.id]: 1 }; E.save.set('bossGuns', bossGuns); }
  const gaunt = S.gauntlet === null ? null : gauntletStep(S.gauntlet, stars);
  const fresh = newBadges({ ch, gun: r.gun.id, stars, double: r.double, gauntletDone: !!(gaunt && gaunt.done), bests: bests(E), bossGuns, have: badgeMap(E) });
  if (fresh.length) E.save.update('badges', (b) => ({ ...(b && typeof b === 'object' ? b : {}), ...Object.fromEntries(fresh.map((id) => [id, 1])) }), {});
  E.setScene('over', { id: ch.id, gun: r.gun.name, score: r.score, stars, best: isNew ? r.score : prev.score, isNew, bestStars, hits: r.hits, bulls: r.bulls, shots: r.shots, badges: fresh, gaunt, thr: thresholds(ch, r.gun.id) });
}

function meterText(r, ch) {
  if (ch.ladder === 'accuracy') return `Ammo ${r.ammo}`;
  if (ch.ladder === 'skeet') return `Left ${r.list.length - r.idx + r.targets.length}`;
  return `Time ${Math.max(0, Math.ceil((ch.speedSeconds || ch.bossSeconds) - r.steps * STEP))}`;
}

// ---------- Menu layout ----------

function menuLayout(E) {
  const land = E.w >= E.h * 1.2, side = 16 + Math.max(E.safe.left, E.safe.right);
  const L = { land, rows: [] };
  const count = (ladder) => CHALLENGES.filter((c) => c.ladder === ladder).length;
  const rowsAt = (x, top, w, pitch, th) => {
    const gap = 8, lab = 82, tw = (w - lab - 3 * gap) / 4;
    LADDERS.forEach(([ladder, label], row) => {
      L.rows.push({ ladder, label, x, y: top + row * pitch, th, labelW: lab, tw, gap, n: count(ladder) });
    });
  };
  const gunGrid = (x, y, w, pitch, h) => GUN_IDS.map((id, i) => ({ id, x: x + (i % 2) * ((w + 8) / 2), y: y + Math.floor(i / 2) * pitch, w: (w - 8) / 2, h }));
  if (land) {
    const W = Math.min(E.w - 2 * side, 780), x0 = (E.w - W) / 2, lw = 236, H = 342;
    const y0 = Math.max(E.safe.top + 6, E.safe.top + (E.h - E.safe.top - E.safe.bottom - H) / 2);
    L.title = { x: x0 + lw / 2, y: y0 + 14 }; L.points = { x: x0 + lw / 2, y: y0 + 40 }; L.bar = { x: x0, y: y0 + 54, w: lw, h: 6 };
    L.next = { x: x0 + lw / 2, y: y0 + 72 };
    L.guns = gunGrid(x0, y0 + 84, lw, 54, 48);
    L.stat = { x: x0 + lw / 2, y: y0 + 213 };
    L.play = { x: x0, y: y0 + 242, w: lw, h: 48 };
    L.missions = { x: x0, y: y0 + 298, w: (lw - 8) / 2, h: 44 }; L.mute = { x: x0 + (lw + 8) / 2, y: y0 + 298, w: (lw - 8) / 2, h: 44 };
    const rx = x0 + lw + 28;
    rowsAt(rx, E.safe.top + 56, x0 + W - rx, 66, 56);
  } else {
    const W = Math.min(E.w - 2 * side, 560), x0 = (E.w - W) / 2, y0 = E.safe.top + 14;
    L.title = { x: E.w / 2, y: y0 + 16 }; L.points = { x: E.w / 2, y: y0 + 44 }; L.bar = { x: x0, y: y0 + 58, w: W, h: 6 };
    L.next = { x: E.w / 2, y: y0 + 76 };
    L.guns = gunGrid(x0, y0 + 90, W, 56, 48);
    L.stat = { x: E.w / 2, y: y0 + 226 };
    rowsAt(x0, y0 + 262, W, 66, 56);
    const by = y0 + 262 + 4 * 66 + 12;
    L.play = { x: x0, y: by, w: W, h: 48 };
    L.missions = { x: x0, y: by + 58, w: (W - 10) / 2, h: 48 }; L.mute = { x: x0 + (W + 10) / 2, y: by + 58, w: (W - 10) / 2, h: 48 };
  }
  return L;
}

// Splits text into lines no wider than maxW at the given size.
function wrapText(ctx, str, maxW, size) {
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  const lines = [];
  let cur = '';
  for (const w of str.split(' ')) {
    const t = cur ? `${cur} ${w}` : w;
    if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

// ---------- Scenes ----------

const menu = {
  enter() { this.tiles = []; this.guns = []; this.btnPlay = null; this.btnMute = null; this.btnMissions = null; },
  render(ctx, E) {
    const L = menuLayout(E), sel = T.guns[gunId(E)], pts = pointsTotal(E), nx = nextUnlock(pts);
    E.text('RECOIL', L.title.x, L.title.y, { size: 30, weight: '800' });
    E.text(`Points ${pts}`, L.points.x, L.points.y, { size: 16, color: T.cyan });
    E.text(nx ? `Next: ${T.guns[nx.id].name} at ${nx.need}` : 'All guns unlocked', L.next.x, L.next.y, { size: 14, color: '#9aa4b2' });
    E.roundRect(L.bar.x, L.bar.y, L.bar.w, L.bar.h, 3, '#1f2937');
    const frac = nx ? clamp((pts - nx.from) / (nx.need - nx.from), 0, 1) : 1;
    if (frac > 0) E.roundRect(L.bar.x, L.bar.y, Math.max(6, L.bar.w * frac), L.bar.h, 3, T.cyan);
    this.guns = L.guns;
    for (const b of L.guns) {
      const g = T.guns[b.id], on = b.id === sel.id, open = gunUnlocked(E, b.id);
      E.roundRect(b.x, b.y, b.w, b.h, 10, on ? '#1a2338' : '#0c1220', on ? T.orange : '#1d2740');
      if (open) E.text(g.short, b.x + b.w / 2, b.y + b.h / 2, { size: 14, weight: on ? '800' : '600', color: on ? '#ffffff' : '#94a3b8' });
      else {
        E.text(g.short, b.x + b.w / 2, b.y + 15, { size: 14, color: '#475569' });
        E.text(`${T.unlockPoints[GUN_IDS.indexOf(b.id)]} points`, b.x + b.w / 2, b.y + 34, { size: 14, color: T.slateEdge });
      }
    }
    E.text(sel.name, L.stat.x, L.stat.y - 17, { size: 14, weight: '800', color: '#ffffff' });
    E.text(`Damage ${sel.damage}${sel.pellets > 1 ? ` x${sel.pellets}` : ''}   ${sel.fireRate}/s   Range ${Math.round(sel.accuracy * 100)}%`, L.stat.x, L.stat.y, { size: 14, color: '#9aa4b2' });
    E.text(sel.auto ? 'Hold the right thumb to fire' : 'Tap the right thumb to fire', L.stat.x, L.stat.y + 17, { size: 14, color: '#64748b' });
    this.tiles = [];
    for (const row of L.rows) {
      E.text(row.label, row.x, row.y + row.th / 2, { size: 14, align: 'left', color: '#9aa4b2' });
      CHALLENGES.filter((c) => c.ladder === row.ladder).forEach((ch, i) => {
        const x = row.x + row.labelW + i * (row.tw + row.gap), top = row.y, tw = row.tw, th = row.th;
        const locked = !isUnlocked(E, ch), st = starsOf(E, ch);
        E.roundRect(x, top, tw, th, 10, locked ? '#0c1220' : '#1a2338', st ? T.cyan : locked ? '#1d2740' : T.slate);
        E.text(`${ch.level}`, x + tw / 2, top + 17, { size: 18, weight: '800', color: locked ? '#475569' : '#e6e6e6' });
        if (locked) drawLock(ctx, x + tw / 2, top + th - 16);
        else for (let k = 0; k < 3; k++) drawStar(ctx, x + tw / 2 + (k - 1) * 16, top + th - 15, 6, k < st ? T.cyan : null, k < st ? null : '#334155');
        this.tiles.push({ x, y: top, w: tw, h: th, ch, locked });
      });
    }
    const p = L.play, m = L.mute, ms = L.missions, earned = BADGES.filter((b) => badgeMap(E)[b.id]).length;
    this.btnPlay = E.button(`Play ${firstPlayable(E).name}`, p.x + p.w / 2, p.y + p.h / 2, { w: p.w, h: p.h, fill: T.orange, color: '#1a0a02', size: 18 });
    this.btnMissions = E.button(`Missions ${earned}/${BADGES.length}`, ms.x + ms.w / 2, ms.y + ms.h / 2, { w: ms.w, h: ms.h, fill: '#1f2937', size: 14 });
    this.btnMute = E.button(E.audio.muted ? 'Sound: off' : 'Sound: on', m.x + m.w / 2, m.y + m.h / 2, { w: m.w, h: m.h, fill: T.slate, size: 14 });
  },
  onTap(p, E) {
    if (E.hit(this.btnPlay, p)) { E.setScene('play', { id: firstPlayable(E).id }); return; }
    if (E.hit(this.btnMute, p)) { E.audio.toggleMute(); E.audio.play('tap'); return; }
    if (E.hit(this.btnMissions, p)) { E.audio.play('tap'); E.setScene('missions'); return; }
    for (const b of this.guns) if (E.hit(b, p)) { if (gunUnlocked(E, b.id)) { E.save.set('gun', b.id); E.audio.play('tap'); } else E.audio.play('tap', 0.3); return; }
    for (const t of this.tiles) if (!t.locked && E.hit(t, p)) { E.setScene('play', { id: t.ch.id }); return; }
  },
};

// Missions: the badge tiers. Earned badges are lit; the rest show what earns them. The gauntlet starts here.
const missions = {
  enter() { this.back = null; this.btnGauntlet = null; },
  render(ctx, E) {
    const have = badgeMap(E), land = E.w >= E.h * 1.2, side = 16 + Math.max(E.safe.left, E.safe.right);
    const W = Math.min(E.w - 2 * side, land ? 780 : 560), x0 = (E.w - W) / 2, top = E.safe.top + 62;
    const earned = BADGES.filter((b) => have[b.id]).length;
    this.back = E.button('Back', x0 + 42, E.safe.top + 30, { w: 84, h: 44, size: 15, fill: '#334155' });
    E.text(`Missions  ${earned}/${BADGES.length}`, E.w / 2, E.safe.top + 30, { size: 20, weight: '800' });
    const open = GAUNTLET.every((id) => isUnlocked(E, CHALLENGES.find((c) => c.id === id)));
    const gw = land ? 120 : W, gy = land ? E.safe.top + 30 : top + BADGES.length * 66 + 8 + 24, gx = land ? x0 + W - 60 : E.w / 2;
    this.btnGauntlet = E.button('Gauntlet', gx, gy, { w: gw, h: land ? 44 : 48, size: 15, fill: open ? T.orange : '#1f2937', color: open ? '#1a0a02' : '#64748b' });
    BADGES.forEach((b, i) => {
      const on = !!have[b.id], col = TIER_COLOR[b.tier];
      if (land) {
        const gap = 10, tw = (W - 2 * gap) / 3, th = 88, x = x0 + (i % 3) * (tw + gap), y = top + Math.floor(i / 3) * 96;
        E.roundRect(x, y, tw, th, 12, on ? '#1a2338' : '#0c1220', on ? col : '#1d2740');
        E.text(b.tier.toUpperCase(), x + 12, y + 14, { size: 14, align: 'left', color: on ? col : '#475569' });
        E.text(b.name, x + 12, y + 36, { size: 18, weight: '800', align: 'left', color: on ? '#ffffff' : '#94a3b8' });
        wrapText(ctx, b.cond, tw - 24, 14).forEach((ln, k) => E.text(ln, x + 12, y + 58 + k * 18, { size: 14, align: 'left', color: on ? '#9aa4b2' : '#64748b' }));
        if (on) drawStar(ctx, x + tw - 24, y + 24, 12, col);
      } else {
        const y = top + i * 66, th = 60;
        E.roundRect(x0, y, W, th, 12, on ? '#1a2338' : '#0c1220', on ? col : '#1d2740');
        E.text(b.name, x0 + 14, y + 18, { size: 16, weight: '800', align: 'left', color: on ? '#ffffff' : '#94a3b8' });
        E.text(b.tier.toUpperCase(), x0 + W - 14, y + 18, { size: 14, align: 'right', color: on ? col : '#475569' });
        E.text(b.cond, x0 + 14, y + 42, { size: 14, align: 'left', color: on ? '#9aa4b2' : '#64748b' });
        if (on) drawStar(ctx, x0 + W - 28, y + 40, 9, col);
      }
    });
    this.open = open;
  },
  onTap(p, E) {
    if (E.hit(this.back, p)) { E.audio.play('tap'); E.setScene('menu'); return; }
    if (E.hit(this.btnGauntlet, p)) {
      if (this.open) { E.audio.play('tap'); E.setScene('play', { id: GAUNTLET[0], gauntlet: 0 }); } else E.audio.play('tap', 0.3);
    }
  },
};

const play = {
  enter(E, params) {
    newRun(CHALLENGES.find((c) => c.id === (params && params.id)) || CHALLENGES[0], gunId(E), params && params.gauntlet);
    this.menuBtn = null;
  },

  update(dt, E) {
    const r = S.run;
    for (const f of S.fx) f.t -= dt;
    S.fx = S.fx.filter((f) => f.t > 0);
    r.kUp = E.keys.has('ArrowUp'); r.kDown = E.keys.has('ArrowDown');
    advance(r, dt);
    r.frameReal = performance.now();
    for (const ev of r.events) cosmetics(E, ev);
    r.events.length = 0;
    if (r.done) { S.endT += dt; if (S.endT >= T.endDelay) endRun(E); }
  },

  render(ctx, E) {
    const v = view(E), r = S.run, ch = S.ch, now = r.steps * STEP;
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
    const labels = [];
    for (const tg of r.targets) {
      let alpha = 1;
      if (tg.kind === 'part' && tg.idx !== r.stage) alpha = 0.45;
      if (tg.kind === 'dodge' && now >= tg.nextDodge - T.dodgeWarn && Math.floor(E.time * 10) % 2) alpha = 0.3;
      drawTarget(ctx, tg, alpha);
      const R = T.zoneR[2] * tg.sc;
      if (ch.ladder === 'accuracy') {
        ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(tg.x, tg.y, R + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(tg.life / T.accLife, 0, 1)); ctx.stroke();
      }
      if (tg.hp !== undefined) {
        for (let i = 0; i < tg.hpMax; i++) disc(ctx, tg.x + (i - (tg.hpMax - 1) / 2) * 8, tg.y + R + 9, 2.5, i < tg.hp ? '#ffffff' : '#334155');
      }
      if (tg.kind === 'part') {
        if (tg.idx === r.stage) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(tg.x, tg.y, R + 7, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
        labels.push({ x: tg.x, y: tg.y - R - 12, text: `${tg.idx + 1}`, on: tg.idx === r.stage });
      }
    }
    drawRangeFinder(ctx, r);
    for (const f of S.fx) if (f.k === 'tracer') {
      ctx.strokeStyle = T.orange; ctx.globalAlpha = f.t / f.max; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(f.x0, f.y0); ctx.lineTo(f.x1, f.y1); ctx.stroke(); ctx.globalAlpha = 1;
    }
    drawGun(ctx, E, r.gunY, angleOf(r));
    for (const f of S.fx) if (f.k === 'flash') {
      ctx.globalAlpha = f.t / f.max; disc(ctx, f.x, f.y, 11, '#fde68a'); disc(ctx, f.x, f.y, 6, T.orange); ctx.globalAlpha = 1;
    }
    ctx.restore();

    for (const l of labels) E.text(l.text, v.ox + l.x * v.s, v.oy + l.y * v.s, { size: 14, weight: '800', color: l.on ? '#ffffff' : '#64748b' });
    for (const f of S.fx) if (f.k === 'pop') {
      const k = 1 - f.t / f.max;
      E.text(f.text, v.ox + f.x * v.s, v.oy + (f.y - 18 - 22 * k) * v.s, { size: 20, weight: '800', color: f.color, alpha: 1 - k * k });
    }
    this.hud(E, v, r, ch);
    if (E.h > E.w) { // portrait: playable, but say what it wants, in the letterbox below the field
      const below = v.oy + v.h + 8 + 34 <= E.h - E.safe.bottom;
      const by = (below ? v.oy + v.h + 8 : E.h - E.safe.bottom - 38) + 17;
      E.roundRect(v.ox + 12, by - 17, v.w - 24, 34, 10, 'rgba(15,17,21,0.9)', T.orange);
      E.text('Rotate your phone', v.ox + v.w / 2, by, { size: 16, weight: '800', color: '#ffffff' });
    }
  },

  // HUD inside the safe insets: the field is fitted to the safe area, so anything anchored to it is inside. Landscape keeps
  // the top-left for text and the top-right for Menu and score (clear of the gun at its highest and of the range finder);
  // the combo sits in the ground band. Portrait puts everything in the letterbox above the field when it fits.
  hud(E, v, r, ch) {
    const pad = T.hudPad, xl = v.ox + pad, xr = v.ox + v.w - pad, compact = v.w < 560, ctx = E.ctx;
    const hudH = compact ? 70 : 44;
    const top = v.oy - hudH - 4 >= E.safe.top + 4 ? v.oy - hudH - 4 : v.oy + 4;
    E.text(ch.name, xl, top + (compact ? 22 : 12), { size: 16, align: 'left' });
    const nameW = ctx.measureText(ch.name).width;
    const low = ch.ladder === 'accuracy' && r.ammo <= 3;
    E.text(meterText(r, ch), compact ? xl : xl + nameW + 16, top + (compact ? 58 : 12), { size: 16, align: 'left', color: low ? T.orange : '#cbd5e1' });
    E.text(`${r.score}`, xr, top + 22, { size: 24, weight: '800', align: 'right' });
    this.menuBtn = E.button('Menu', xr - 96 - 8 - 32, top + 22, { w: 64, h: 44, size: 14, fill: '#1f2937' });
    const mult = Math.min(T.comboCap, 1 + T.comboStep * r.streak), live = r.streak > 0;
    const pips = Math.round((T.comboCap - 1) / T.comboStep);
    const cy = compact ? top + 58 : v.oy + (T.designH - T.thumbLane * 0.5) * v.s;
    const cx = compact ? xr - 44 - pips * 11 : v.ox + v.w / 2 - 50;
    E.text(`x${mult.toFixed(1)}`, compact ? xr : cx, cy, { size: 16, align: compact ? 'right' : 'left', color: live ? T.orange : '#64748b' });
    for (let i = 0; i < pips; i++) disc(ctx, (compact ? cx : cx + 50) + i * 11, cy, 3.5, i < r.streak ? T.orange : '#334155');
  },

  onPointerDown(p, E) {
    if (S.run.done || (this.menuBtn && E.hit(this.menuBtn, p))) return;
    if (p.x < E.w / 2) { if (!S.drag) S.drag = { id: p.id, y: p.y }; return; }
    S.right.add(p.id);
    const at = stamp(S.run);
    queueInput(S.run, at, 'fire'); queueInput(S.run, at, 'trigger', true);
  },
  onPointerMove(p, E) {
    if (!S.drag || S.drag.id !== p.id) return;
    const dy = p.y - S.drag.y;
    S.drag.y = p.y;
    if (dy) queueInput(S.run, stamp(S.run), 'move', (dy / view(E).s) * T.dragGain);
  },
  onPointerUp(p) {
    if (S.drag && S.drag.id === p.id) S.drag = null; // a cancelled pointer ends its gesture the same way
    if (S.right.delete(p.id)) queueInput(S.run, stamp(S.run), 'trigger', S.right.size > 0);
  },
  onTap(p, E) {
    if (this.menuBtn && E.hit(this.menuBtn, p)) E.setScene('menu');
  },
  onKey(key, E) {
    if (key === 'Escape') E.setScene('menu');
    else if (key === ' ') queueInput(S.run, stamp(S.run), 'fire'); // key repeat fires at the gun's rate
  },
  onPause() { newRun(S.ch, S.gunId, S.gauntlet === null ? undefined : S.gauntlet); }, // closing the app mid-challenge restarts it
};

const over = {
  enter(E, params) {
    this.p = params; this.ch = CHALLENGES.find((c) => c.id === params.id); this.t0 = E.time;
    const g = params.gaunt;
    if (g) { this.next = g.next ? CHALLENGES.find((c) => c.id === g.next) : null; this.canNext = !!this.next; }
    else {
      this.next = CHALLENGES.find((c) => c.ladder === this.ch.ladder && c.level === this.ch.level + 1);
      this.canNext = !!this.next && params.bestStars >= T.unlockStars;
    }
    E.audio.play(params.stars >= 1 ? 'win' : 'lose'); E.haptic(30);
  },
  render(ctx, E) {
    const p = this.p, ch = this.ch, cx = E.w / 2, g = p.gaunt;
    const H = 310, y0 = Math.max(E.safe.top + 8, E.safe.top + (E.h - E.safe.top - E.safe.bottom - H) / 2);
    E.text(`${ch.name}  ·  ${p.gun}${g ? `  ·  Gauntlet ${g.i + 1}/${GAUNTLET.length}` : ''}`, cx, y0 + 10, { size: 16, color: '#9aa4b2' });
    E.text(`${p.score}`, cx, y0 + 56, { size: 46, weight: '800' });
    const age = E.time - this.t0;
    for (let i = 0; i < 3; i++) {
      const sx = cx + (i - 1) * 60, sy = y0 + 112;
      if (i < p.stars) {
        const k = ease.outBack(clamp((age - i * 0.2) / 0.3, 0, 1));
        if (k > 0) drawStar(ctx, sx, sy, 22 * k, T.cyan);
      } else drawStar(ctx, sx, sy, 22, null, '#334155');
    }
    const of = ch.ladder === 'accuracy' ? ` of ${ch.accTargets}` : '';
    E.text(`Hits ${p.hits}${of}   Bullseyes ${p.bulls}`, cx, y0 + 158, { size: 16, color: '#cbd5e1' });
    E.text(p.isNew ? `New best ${p.best}` : `Best ${p.best}`, cx, y0 + 182, { size: 16, color: p.isNew ? T.orange : '#9aa4b2' });
    E.text(`Stars at ${p.thr.one} / ${p.thr.two} / ${p.thr.three}`, cx, y0 + 206, { size: 14, color: '#64748b' });
    if (p.badges.length) { // a badge pop: the name scales in
      const k = ease.outBack(clamp((age - 0.5) / 0.35, 0, 1)), names = p.badges.map((id) => BADGES.find((b) => b.id === id).name).join(', ');
      const col = TIER_COLOR[BADGES.find((b) => b.id === p.badges[0]).tier];
      if (k > 0) { drawStar(ctx, cx - 92 * k - names.length * 4, y0 + 236, 11 * k, col); E.text(`Badge earned: ${names}`, cx + 12, y0 + 236, { size: Math.round(16 * Math.min(1, k)) || 1, weight: '800', color: col }); }
    } else if (g && !g.ok) E.text('Gauntlet over: two stars needed', cx, y0 + 236, { size: 16, color: T.red });
    else if (g && g.done) E.text('Gauntlet complete', cx, y0 + 236, { size: 16, color: T.cyan });
    const btns = [['Again', T.orange, '#1a0a02', 'again']];
    if (this.canNext) btns.push(['Next', T.cyan, '#04141a', 'next']);
    btns.push(['Menu', T.slate, '#e6e6e6', 'menu']);
    const bw = Math.min(140, (E.w - 32 - 16) / 3), by = y0 + 282;
    this.btns = btns.map(([label, fill, color, act], i) => {
      const x = cx + (i - (btns.length - 1) / 2) * (bw + 12);
      return { act, ...E.button(label, x, by, { w: bw, h: 52, fill, color, size: 18 }) };
    });
  },
  onTap(p, E) {
    if (E.time - this.t0 < T.cardLock) return; // a tap that was meant for the last shot must not pick a button
    const b = this.btns.find((b) => E.hit(b, p));
    if (!b) return;
    E.audio.play('tap');
    if (b.act === 'again') E.setScene('play', { id: this.ch.id });
    else if (b.act === 'next') E.setScene('play', this.p.gaunt ? { id: this.next.id, gauntlet: this.p.gaunt.i + 1 } : { id: this.next.id });
    else E.setScene('menu');
  },
};

// Handling experiment (v0.3 section C): how much fight in the gun is fun. Kick is per gun, so the sliders and presets tune the
// pistol's kick; sway is shared by every gun.
const EXPERIMENTS = [
  { key: 'guns.pistol.kickPerShot', label: 'Pistol kick per shot (deg)', min: 2, max: 15, step: 0.5 },
  { key: 'swayPerSpeed', label: 'Sway per speed', min: 0, max: 0.06, step: 0.005 },
];
const PRESETS = [
  { label: 'Steady', values: { 'guns.pistol.kickPerShot': 5, swayPerSpeed: 0.01 } },
  { label: 'Standard', values: { 'guns.pistol.kickPerShot': 8, swayPerSpeed: 0.02 } },
  { label: 'Wild', values: { 'guns.pistol.kickPerShot': 12, swayPerSpeed: 0.04 } },
];
const TUNE_KEYS = new Set([...EXPERIMENTS.map((e) => e.key), ...PRESETS.flatMap((p) => Object.keys(p.values))]);

export const game = {
  slug: 'recoil',
  title: 'Recoil',
  saveVersion: 4,
  // Save shape: best { challengeId: { score, stars } }, gun (id), badges { badgeId: 1 }, bossGuns { gunId: 1 }, __tune, __muted.
  // v2 added the chosen gun; v3 pruned saved tune values (ADR-0014); v4 adds badges and bossGuns and awards the star-only badges
  // that the existing bests already earn. Nothing else changes, and the whole save stays under a kilobyte or two.
  migrate(data, fromVersion) {
    if (typeof data.best !== 'object' || data.best === null) delete data.best;
    if (!data.gun) data.gun = 'pistol';
    if (!data.badges || typeof data.badges !== 'object') data.badges = {};
    if (!data.bossGuns || typeof data.bossGuns !== 'object') data.bossGuns = {};
    const b = data.best || {}, three = (id) => b[id] && b[id].stars === 3;
    for (const [badge, id] of [['marksman1', 'a1'], ['quickdraw1', 's1'], ['clay1', 'k1'], ['storm', 's4']]) if (three(id)) data.badges[badge] = 1;
    if (CHALLENGES.every((c) => three(c.id))) data.badges.legend = 1;
    if (data.__tune && typeof data.__tune === 'object') data.__tune = Object.fromEntries(Object.entries(data.__tune).filter(([k]) => TUNE_KEYS.has(k)));
    return data;
  },
  TUNING,
  experiments: EXPERIMENTS,
  presets: PRESETS,
  start: 'menu',
  scenes: { menu, play, over, missions },
};
