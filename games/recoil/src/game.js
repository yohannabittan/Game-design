// Recoil, v0.3: the mechanic plus guns, barrel sway, moving targets, skeet, a boss, and progression (four guns unlocked by
// points, nine badges, a gauntlet). One thumb drags the gun up and down, the other fires, and every shot kicks the barrel up.
// Instant shot lines scored by zone, a combo multiplier, four ladders, stars, points, menu and card. Layer 5: procedural art (four gun
// silhouettes, paper targets, a range backdrop) from one palette in TUNING.art; no image assets.
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
    // v0.3. `pellets` lines leave the barrel in a fixed fan of shotSpread degrees; each pellet deals `damage` on its own. Only the centre
    // pellet scores zone points on ring targets; on hordes every member any pellet hits scores.
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
  // Layer 5 (art). Every colour and every effect number the drawing uses lives here; nothing below reads a literal colour.
  // Look: chunky flat vector, warm-black outlines (line, gunLine), one soft highlight per shape, a drop shadow (shadowX, shadowY, palette.shadow),
  // corner radius `radius` on panels. Light comes from the upper left. Semantic colours keep their meaning: cyan is the goal (targets, clays,
  // the selected boss plate), orange is the player (gun, shots, muzzle, range finder), red is danger (the breach line and edge only).
  // World art is in design units; HUD and menus in screen px.
  art: {
    palette: {
      letterbox: '#0f1115',  // Outside the field (the engine reads TUNING.bg, set from this)
      ink: '#1a1512',        // Outlines and dark details
      inkSoft: 'rgba(26,21,18,0.55)', // Thin printed lines on cards
      shadow: 'rgba(10,6,4,0.42)',
      highlight: 'rgba(255,246,232,0.36)', // The one soft highlight
      // Range backdrop
      sky: '#2a2622', skyLow: '#342e29', wall: '#463f37', wallTop: '#645a50', wallSeam: '#382f29',
      ground: '#1b1715', groundLine: '#8f8170', tape: '#74675a', backstop: '#2b2521', backstopEdge: '#63584d',
      // Gunmetal, warm
      steel: '#8d877e', steelDark: '#57524b', steelLight: '#b4ada1',
      // Accents
      orange: '#f97316', orangeLight: '#fdba74', flashCore: '#fff4dc',
      brass: '#d6a23a', brassDark: '#8a5d16',
      // Targets
      cyan: '#22d3ee', cyanGlow: 'rgba(34,211,238,0.2)', orbShell: '#123a4a',
      slate: '#475569', slateEdge: '#64748b',
      paper: '#ece3d0', paperShade: '#c4b89f', white: '#ffffff', red: '#ef4444',
      // Text and panels
      text: '#f3ede3', textDim: '#b0a698', textFaint: '#7b7266',
      panel: '#1f1b18', panelHi: '#2e2823', panelEdge: '#453d35',
      tier: { Bronze: '#d08a4a', Silver: '#cbd5e1', Gold: '#fbbf24' },
      zone: ['#ffffff', '#22d3ee', '#c4b89f'], // Score pop colour by zone: bullseye, inner, outer
    },
    type: { small: 14, mid: 18, big: 30, normal: '600', strong: '800' }, // Three sizes, one weight rule: strong for numbers and headings
    line: 2.5, gunLine: 2.6, radius: 10, shadowX: 2, shadowY: 3,
    // Guns: side view, origin on the bore axis at the grip (the gun turns about it), +x forward, +y down. muzzle is the drawn tip
    // (at least barrelLen, so shots leave the barrel); port is where the casing leaves; shell is the casing size.
    // Parts draw in order: ['rr', fill, x, y, w, h, radius] or ['poly', fill, [x, y, ...]]. fill is a palette key; 'ink' and 'highlight' get no outline.
    guns: {
      pistol: { muzzle: 40, port: [-2, -9], shell: [5, 2.4], parts: [
        ['rr', 'steelDark', 4, 4, 18, 14, 4], ['rr', 'ink', 9, 8, 8, 8, 2],
        ['poly', 'steelDark', [-13, 3, 8, 3, 4, 31, -14, 33]],
        ['rr', 'steelDark', -21, -14, 6, 5, 1.5], ['rr', 'steelDark', 32, -14, 6, 5, 1.5],
        ['rr', 'steel', -22, -10, 62, 15, 3.5],
        ['rr', 'orange', 34, -10, 6, 15, 2],
        ['rr', 'ink', -6, -8, 11, 3.5, 1], ['rr', 'ink', -18, -6, 1.6, 8, 0.8], ['rr', 'ink', -14.5, -6, 1.6, 8, 0.8], ['rr', 'ink', -11, -6, 1.6, 8, 0.8],
        ['rr', 'highlight', -6, -8, 38, 2.6, 1.3],
      ] },
      carbine: { muzzle: 50, port: [2, -10], shell: [6, 2.6], parts: [
        ['poly', 'steelDark', [-16, -9, -44, -6, -47, 13, -40, 13, -16, 4]],
        ['poly', 'steelDark', [-14, 4, -2, 4, -5, 22, -18, 22]],
        ['poly', 'steelDark', [4, 5, 18, 5, 26, 31, 14, 34]],
        ['poly', 'steelDark', [30, 3, 38, 3, 41, 19, 33, 19]],
        ['rr', 'steelDark', -12, -16, 9, 6, 2], ['rr', 'steelDark', 36, -15, 5, 7, 1.5],
        ['rr', 'steelDark', 22, -9, 22, 15, 3.5],
        ['rr', 'steel', 43, -4, 9, 8, 2],
        ['rr', 'steel', -18, -12, 42, 18, 3.5],
        ['rr', 'orange', 47, -5, 5, 10, 2],
        ['rr', 'ink', -2, -8, 10, 3.5, 1],
        ['rr', 'highlight', -14, -10, 34, 2.6, 1.3],
      ] },
      shotgun: { muzzle: 62, port: [-8, -10], shell: [8, 3.6], parts: [
        ['poly', 'steelDark', [-18, -10, -60, -6, -67, 18, -42, 20, -18, 8]],
        ['poly', 'steelDark', [-14, 6, -2, 6, -5, 26, -18, 25]],
        ['rr', 'steelDark', -2, 3, 52, 9, 4],
        ['rr', 'steel', -22, -12, 26, 20, 3.5],
        ['rr', 'steel', -4, -9, 66, 11, 3],
        ['rr', 'steelDark', 18, 5, 26, 15, 4.5], ['rr', 'ink', 24, 8, 1.6, 9, 0.8], ['rr', 'ink', 29, 8, 1.6, 9, 0.8], ['rr', 'ink', 34, 8, 1.6, 9, 0.8], ['rr', 'ink', 39, 8, 1.6, 9, 0.8],
        ['rr', 'steelDark', 54, -13, 4, 4, 1.5],
        ['rr', 'orange', 57, -10, 5, 13, 2],
        ['rr', 'highlight', 0, -7, 54, 2.6, 1.3],
      ] },
      rifle: { muzzle: 66, port: [4, -8], shell: [7, 2.8], parts: [
        ['poly', 'steelDark', [-20, -6, -46, -12, -62, -10, -62, 15, -42, 12, -20, 6]],
        ['poly', 'steelDark', [-14, 4, -2, 4, -6, 26, -19, 25]],
        ['rr', 'steelDark', -4, 4, 13, 9, 2.5],
        ['poly', 'steelDark', [36, 2, 43, 2, 55, 18, 50, 21]],
        ['rr', 'steel', 10, -3.5, 56, 6, 2],
        ['rr', 'steelDark', 14, -6, 26, 9, 3],
        ['rr', 'steel', -22, -10, 36, 16, 3.5],
        ['rr', 'steelDark', -7, -15, 4, 7, 1.5], ['rr', 'steelDark', 13, -15, 4, 7, 1.5],
        ['rr', 'steelDark', -14, -22, 44, 8, 4],
        ['rr', 'steel', -19, -25, 7, 13, 3], ['rr', 'steel', 24, -26, 10, 15, 3],
        ['rr', 'ink', 32.5, -22, 1.6, 7, 0.8],
        ['rr', 'orange', 61, -6, 5, 10, 2],
        ['rr', 'highlight', -17, -8, 28, 2.6, 1.3], ['rr', 'highlight', -10, -20.5, 32, 2.2, 1.1],
      ] },
    },
    // Skins (v0.3 section B): the same silhouette with a palette override and one decoration, so a skin is a data entry. `pal` replaces palette keys for
    // this gun (steel, steelDark) and defines `accent`; `deco` parts are appended after the gun's own in the same format, drawn flat (no outline) and
    // inside the silhouette, so bounds, hitbox and shots never change. Each skin is earned by the badge named in `badge` (BADGES ids), never by points.
    // The first skin of a gun is its default. Order matters: the save keeps the id.
    skins: {
      pistol: [
        { id: 'std', name: 'Standard', badge: null, pal: {}, deco: [] },
        { id: 'nickel', name: 'Nickel', badge: 'marksman1', pal: { steel: '#cfd4da', steelDark: '#8a929c', accent: '#d6a23a' }, deco: [['rr', 'accent', 2, -7.5, 20, 7, 2], ['rr', 'ink', 5, -4.6, 14, 1.4, 0.7]] }, // engraved brass plate
        { id: 'blackout', name: 'Blackout', badge: 'quickdraw1', pal: { steel: '#3f3c39', steelDark: '#2a2826', accent: '#d9d2c4' }, deco: [['rr', 'accent', -20, -1.5, 58, 2.2, 1]] }, // slide stripe
        { id: 'gold', name: 'Gold', badge: 'legend', pal: { steel: '#e3b53d', steelDark: '#a8781c', accent: '#fff1b8' }, deco: [['rr', 'accent', -20, -8.2, 58, 1.8, 0.9], ['rr', 'accent', -20, 0.6, 58, 1.8, 0.9]] }, // twin stripes
      ],
      carbine: [
        { id: 'std', name: 'Standard', badge: null, pal: {}, deco: [] },
        { id: 'desert', name: 'Desert', badge: 'clay1', pal: { steel: '#c2a374', steelDark: '#7d6641', accent: '#ecdcae' }, deco: [['rr', 'accent', 26, -8.2, 2.6, 13.4, 0.8], ['rr', 'accent', 32, -8.2, 2.6, 13.4, 0.8], ['rr', 'accent', 38, -8.2, 2.6, 13.4, 0.8]] }, // tape wrap on the forend
        { id: 'arctic', name: 'Arctic', badge: 'steady', pal: { steel: '#e2e8f0', steelDark: '#94a3b8', accent: '#4a6fa5' }, deco: [['rr', 'accent', -16, -3, 40, 3.2, 1.4]] }, // body stripe
      ],
      shotgun: [
        { id: 'std', name: 'Standard', badge: null, pal: {}, deco: [] },
        { id: 'walnut', name: 'Walnut', badge: 'storm', pal: { steelDark: '#7a4a2a', accent: '#d6a23a' }, deco: [['rr', 'accent', -19, -9, 15, 6.5, 1.5], ['rr', 'ink', -16.5, -6.3, 10, 1.3, 0.6]] }, // wood furniture, engraved plate
        { id: 'tactical', name: 'Tactical', badge: 'double', pal: { steel: '#474c42', steelDark: '#2e322b', accent: '#9aae5c' }, deco: [['rr', 'accent', 0, -6.5, 56, 2.2, 1]] }, // barrel stripe
      ],
      rifle: [
        { id: 'std', name: 'Standard', badge: null, pal: {}, deco: [] },
        { id: 'carbon', name: 'Carbon', badge: 'bosskiller', pal: { steel: '#34373b', steelDark: '#202225', accent: '#69707a' }, deco: [['rr', 'accent', -19, -6, 30, 2, 1], ['rr', 'accent', -19, -1, 30, 2, 1]] }, // weave lines on the receiver
        { id: 'ghost', name: 'Ghost', badge: 'gauntlet', pal: { steel: '#eceef2', steelDark: '#aeb7c4', accent: '#b9a6e6' }, deco: [['rr', 'accent', -54, -4, 20, 7, 2], ['rr', 'ink', -51, -1, 14, 1.3, 0.6]] }, // engraved plate on the stock
      ],
    },
    chip: { hit: 44, gap: 8, size: 26, radius: 6, labelW: 46, mini: 14 }, // Skin swatches: menu touch size, spacing, drawn size, corner, the "Skin" label's width; mini is the missions swatch
    flash: { spikes: [28, 10, 14, 8, 6, 8, 14, 10], inner: 4.5, from: 0.7, mid: 0.62, core: 0.3, dropAlpha: 0.3, dropScale: 0.5 }, // Muzzle flash: eight spikes (forward first), scale grows from `from` to 1 as it lives; a dropped tap flickers a small faint one (dropAlpha, dropScale)
    casing: { cap: 10, life: 0.55, gravity: 700, vx: [-75, -30], vy: [-175, -105], spin: [-16, 16], floor: 16, fade: 0.35, line: 1.2 }, // Ejected brass: capped particles
    finder: { gap: 6, rNear: 2.8, rFar: 1.5, farAlpha: 0.25, warm: 0.3, ramp: 4, track: 5.5, trackAlpha: 0.3, capHalf: 6, capWidth: 2.6, capAlpha: 0.55, fanAlpha: 0.22 },
    tracer: { width: 2.5 },
    ring: { life: 0.3, r0: 8, r1: 30, width: 3 }, // Hit ring that opens at the target as the score pop rises (inside the pop's own life)
    popLine: 5,            // Outline width of the score pop
    backdrop: { skyLowY: 120, wallTop: 208, coping: 7, seam: 64, marker: 128, markerW: 14, markerH: 22, tape: [10, 8], tick: 5 },
    card: { pad: 3, radius: 0.6, ringLine: 1, timerK: 1.17, timerGap: 4, timerWidth: 3, post: 4, foot: 13 }, // Paper target: pad beyond the outer ring, corner as a fraction of the half size
    trolley: { w: 0.8, h: 4, wheel: 2.6, tie: 24, tieLen: 2.5, tieW: 5, rail: 2, railAlpha: 0.55 },
    clay: { disc: 0.74, rimLine: 1.2 },
    plate: { r: 1.1, inner: 0.86, rivet: 2.2, glow: [1.2, 1.32], dash: 12, ring: 7, pip: 5, pipGap: 8, pipTray: 3 },
    core: { pulse: 5, glow: [7, 14], glowAlpha: [0.22, 0.12], amp: 3, spec: 0.68 },
    pip: { w: 6, h: 9, gap: 11 }, // Combo pips drawn as brass casings
    tile: { pad: 6 }, // Gun tiles on the menu: padding round the silhouette
  },
};
const T = TUNING;
const A = T.art, P = A.palette, TY = A.type, PI2 = Math.PI * 2;
T.bg = P.letterbox; // the engine reads this name for the letterbox
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
    // Per-gun stars are 30/55/85 percent of each gun's true maximum run (searched over every aim error, streak and pellet count, then replayed
    // in the sim): pistol and carbine 3750 (twelve one-damage bullseyes), rifle 1000 (five bullseyes, damage 3), shotgun 1350 (six scoring
    // bullseyes: the core takes three shots when the centre pellet sits in the bullseye and only one outer pellet lands on the core too).
    starsByGun: { shotgun: { one: 410, two: 740, three: 1150 }, rifle: { one: 300, two: 550, three: 850 } },
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
// Scoring (PRD v0.3 section A): only the centre pellet scores zone points on ring targets, so the fan never makes aiming easier; every
// pellet damages boss parts separately; on horde targets every member any pellet hits scores outer points. The shot is one hit for the
// combo. A pellet on an inactive boss part is neutral. `cue` is true for a tap (not held fire): a tap dropped inside the interval says so.
function fire(run, cue) {
  if (run.done || run.ammo <= 0) return;
  const g = run.gun, now = run.steps * STEP;
  if (now < run.nextFire - STEP - 1e-9) { if (cue) run.events.push({ type: 'dropped' }); return; } // one step of slack, so a tap at the nominal interval is not lost to step rounding
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
  const R = T.zoneR, ci = (res.length - 1) >> 1;
  const zoneOf = (r) => (r.tg.flat ? 2 : r.perp <= R[0] * r.tg.sc * (r.tg.bullMul || 1) ? 0 : r.perp <= R[1] * r.tg.sc ? 1 : 2);
  const scored = new Map(), hurt = new Set(); // target -> zone it scores; boss targets a pellet damaged
  res.forEach((r, i) => {
    if (!r.tg || r.neutral) return;
    if (r.tg.flat) scored.set(r.tg, 2);
    else if (i === ci) scored.set(r.tg, zoneOf(r));
    if (r.tg.hp !== undefined) { r.tg.hp -= g.damage; hurt.add(r.tg); }
  });
  const down = new Set();
  for (const tg of scored.keys()) if (tg.hp === undefined) down.add(tg);
  for (const tg of hurt) if (tg.hp <= 0) down.add(tg);
  const mid = res[ci];
  const ev = { type: 'shot', x0: gx + Math.cos(a0 * DEG) * T.barrelLen, y0: gy - Math.sin(a0 * DEG) * T.barrelLen, lines: res.map((r) => ({ x1: r.x1, y1: r.y1 })), x1: mid.x1, y1: mid.y1, hit: scored.size > 0, dodged: dodged && !scored.size, neutral: !scored.size && !hurt.size && res.some((r) => r.neutral) };
  if (scored.size) {
    const mult = Math.min(T.comboCap, 1 + T.comboStep * run.streak);
    let pts = 0, bz = 3, tx = 0, ty = 0;
    for (const [tg, z] of scored) { pts += Math.round(T.zonePoints[z] * mult); bz = Math.min(bz, z); tx += tg.x; ty += tg.y; }
    run.score += pts; run.streak++; run.hits += scored.size;
    if (bz === 0) run.bulls++;
    Object.assign(ev, { tx: tx / scored.size, ty: ty / scored.size, zone: bz, pts, mult, streak: run.streak, killed: down.size > 0 });
  } else {
    if (!dodged && !ev.neutral) { run.streak = 0; run.misses++; }
    ev.streak = run.streak;
  }
  for (const tg of down) {
    run.targets.splice(run.targets.indexOf(tg), 1);
    if (run.ch.ladder === 'accuracy') run.nextAt = now + T.accGap;
    if (tg.kind === 'part') { run.stage++; if (run.stage >= run.list.parts.length) spawnCore(run, now); }
    if (tg.kind === 'core') run.cleared = true;
    if (tg.group !== undefined) { run.pairHits[tg.group] = (run.pairHits[tg.group] || 0) + 1; if (run.pairHits[tg.group] >= 2) run.double = true; }
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
      else if (e.kind === 'fire') fire(run, true);
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

// Thresholds are pistol-derived. Boss 1 is the exception: the shotgun and rifle finish it in far fewer scoring shots (maxima 1350 and 1000
// against the pistol's 3750), so they carry their own thresholds from their own maxima, or Boss Killer could never be earned.
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

// ---------- Skins: cosmetic, earned by badges ----------

function skinById(gun, id) { const l = A.skins[gun]; return l.find((k) => k.id === id) || l[0]; }
function skinOpen(E, skin) { return !skin.badge || !!badgeMap(E)[skin.badge]; }
// The skin a gun wears: the saved choice if its badge is earned, else the default.
function skinId(E, gun) {
  const m = E.save.get('skins', {}), k = skinById(gun, m && typeof m === 'object' ? m[gun] : null);
  return skinOpen(E, k) ? k.id : 'std';
}
// The skin a badge unlocks, or null: { gun, skin }.
function skinOfBadge(badge) {
  for (const gun of GUN_IDS) { const skin = A.skins[gun].find((k) => k.badge === badge); if (skin) return { gun, skin }; }
  return null;
}

// ---------- Drawing ----------
// Everything below reads TUNING.art. Guns, the muzzle flash and the backdrop are built once (Path2D, an offscreen canvas), and the
// per-frame loops keep no arrays or closures, so a frame allocates nothing beyond the engine's own text calls.

const NO_DASH = [], BREACH_DASH = [6, 6], SEL_DASH = [5, 4], TIE_DASH = [A.trolley.tieLen, A.trolley.tie - A.trolley.tieLen], PART_NUM = ['1', '2', '3', '4', '5', '6'];
const HORIZON = T.designH - T.thumbLane;
const GUN_ART = {}, RAMP = [];
let FLASH = null, GUN_BOX = null;

function view(E) {
  const aw = E.w - E.safe.left - E.safe.right, ah = E.h - E.safe.top - E.safe.bottom;
  const s = Math.min(aw / T.designW, ah / T.designH);
  return { s, ox: E.safe.left + (aw - T.designW * s) / 2, oy: E.safe.top + (ah - T.designH * s) / 2, w: T.designW * s, h: T.designH * s };
}

function mixHex(a, b, t) {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), c = (s) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}

// Rounded rectangle and polygon onto a Path2D or a context.
function rrPath(p, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r); p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath();
}
function rrect(g, x, y, w, h, r) { g.beginPath(); rrPath(g, x, y, w, h, r); }
function polyPath(p, pts) { p.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]); p.closePath(); }
function disc(ctx, x, y, r, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, PI2); ctx.fill(); }
// A printed ring: filled, then edged with the current stroke style.
function ringDisc(ctx, x, y, r, fill) { disc(ctx, x, y, r, fill); ctx.stroke(); }

// Sprites: shapes that never change (a card, a plate, a clay, a gun, a casing) are painted once into a small offscreen canvas at screen
// resolution and blitted each frame. Keys are numbers (no strings built per frame); the cache is rebuilt when the screen scale changes.
const SPR = new Map();
let SPR_K = 0;
function sprScale(k) { const r = Math.round(k * 100); if (r !== SPR_K) { SPR_K = r; SPR.clear(); } }
// paint(g, a, b) draws centred on the origin inside +-ext. Falls back to painting straight onto the frame if offscreen canvases are missing.
function drawSprite(ctx, key, ext, paint, x, y, a, b) {
  let s = SPR.get(key);
  if (s === undefined) {
    s = null;
    if (typeof OffscreenCanvas !== 'undefined' && SPR_K) {
      const k = SPR_K / 100, ey = ext, cv = new OffscreenCanvas(Math.ceil(2 * ext * k), Math.ceil(2 * ey * k)), g = cv.getContext('2d');
      if (g) { g.scale(cv.width / (2 * ext), cv.height / (2 * ey)); g.translate(ext, ey); paint(g, a, b); s = cv; }
    }
    SPR.set(key, s);
  }
  if (s) ctx.drawImage(s, x - ext, y - ext, 2 * ext, 2 * ext);
  else { ctx.save(); ctx.translate(x, y); paint(ctx, a, b); ctx.restore(); }
}
const SKIN_SLOTS = 4; // most skins one gun has (the pistol's default, two badge skins and Gold), so every sprite key is unique
const K_CARD = 1e6, K_FLAT = 2e6, K_CLAY = 3e6, K_PLATE = 4e6, K_CORE = 5e6, K_GUN = 6e6;

// One gun in one skin: parts (the gun's own, then the skin's decoration) coloured through the skin's palette override, and its bounds.
const NO_LINE = new Set(['ink', 'highlight', 'accent']); // fills that get no outline
function buildGun(id, skin, idx) {
  const spec = A.guns[id], parts = [], sil = new Path2D();
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const grow = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  for (const [kind, fill, a, b, c, d, e] of spec.parts.concat(skin.deco)) {
    const path = new Path2D(), line = !NO_LINE.has(fill);
    if (kind === 'rr') { rrPath(path, a, b, c, d, e); grow(a, b); grow(a + c, b + d); } else { polyPath(path, a); for (let i = 0; i < a.length; i += 2) grow(a[i], a[i + 1]); }
    if (line) sil.addPath(path);
    parts.push({ path, fill: skin.pal[fill] || P[fill], line });
  }
  return { idx, parts, sil, x0, y0, x1, y1, muzzle: spec.muzzle, port: spec.port, shell: spec.shell };
}

// Builds every cached shape: each gun in each skin, the muzzle flash and the finder colour ramp. Runs once (init), and lazily if a harness skips init.
// GUN_ART holds a gun's default under its id and the other skins under 'id/skin'. The tile scale comes from the default skins.
function buildArt() {
  if (FLASH) return;
  let w = 0, h = 0;
  GUN_IDS.forEach((id, gi) => {
    A.skins[id].forEach((skin, si) => {
      const art = buildGun(id, skin, gi * SKIN_SLOTS + si);
      GUN_ART[si ? `${id}/${skin.id}` : id] = art;
      if (!si) { w = Math.max(w, art.x1 - art.x0); h = Math.max(h, art.y1 - art.y0); }
    });
  });
  GUN_BOX = { w, h };
  const F = A.flash, n = F.spikes.length;
  FLASH = new Path2D();
  for (let i = 0; i < n * 2; i++) {
    const a = (i * Math.PI) / n, r = i % 2 ? F.inner : F.spikes[i >> 1];
    if (i) FLASH.lineTo(Math.cos(a) * r, Math.sin(a) * r); else FLASH.moveTo(r, 0);
  }
  FLASH.closePath();
  for (let i = 0; i < A.finder.ramp; i++) RAMP.push(mixHex(P.orange, P.white, Math.min(1, i / (A.finder.ramp * A.finder.warm))));
}
function gunArt(id, skin) { if (!FLASH) buildArt(); return GUN_ART[skin && skin !== 'std' ? `${id}/${skin}` : id] || GUN_ART[id] || GUN_ART.pistol; }

function drawStar(ctx, cx, cy, R, fill, stroke) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? R * 0.45 : R;
    ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath(); ctx.lineJoin = 'round';
  if (fill) { ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.stroke(); }
  else if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}

function drawLock(ctx, cx, cy, col) {
  ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy - 3, 5, Math.PI, 0); ctx.stroke();
  ctx.fillStyle = col; ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5; rrect(ctx, cx - 8, cy - 3, 16, 12, 2.5); ctx.fill(); ctx.stroke();
  disc(ctx, cx, cy + 3, 1.8, P.ink);
}

// ---- Guns ----

// One gun, origin (the grip) at x, y, turned by rot radians. The outline stays chunky at menu sizes; the shadow is one union fill.
function drawGunArt(ctx, ga, x, y, k, rot, shadow) {
  ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round';
  if (shadow) { ctx.save(); ctx.translate(A.shadowX, A.shadowY); ctx.scale(k, k); ctx.rotate(rot); ctx.fillStyle = P.shadow; ctx.fill(ga.sil); ctx.restore(); }
  ctx.scale(k, k); ctx.rotate(rot);
  ctx.lineWidth = Math.max(A.gunLine, 1.6 / k); ctx.strokeStyle = P.ink;
  for (const p of ga.parts) { ctx.fillStyle = p.fill; ctx.fill(p.path); if (p.line) ctx.stroke(p.path); }
  ctx.restore();
}

// Every gun drawn at one scale, so sizes stay honest, centred on its own bounds inside a w x h box.
function drawGunTile(ctx, id, cx, cy, w, h, skin) {
  const ga = gunArt(id, skin), k = Math.min(w / GUN_BOX.w, h / GUN_BOX.h);
  drawGunArt(ctx, ga, cx - ((ga.x0 + ga.x1) / 2) * k, cy - ((ga.y0 + ga.y1) / 2) * k, k, 0, false);
}

// The gun is one sprite cut to its own bounds (outline and shadow included), turned about the grip at draw time.
const GUN_PAD = 6;
function paintGun(g, ga) { drawGunArt(g, ga, 0, 0, 1, 0, true); }
function drawGun(ctx, run) {
  const ga = gunArt(run.gun.id, S.skin), key = K_GUN + ga.idx, w = ga.x1 - ga.x0 + 2 * GUN_PAD, h = ga.y1 - ga.y0 + 2 * GUN_PAD;
  ctx.save(); ctx.translate(T.gunX, run.gunY); ctx.rotate(-angleOf(run) * DEG);
  let s = SPR.get(key);
  if (s === undefined) {
    s = null;
    if (typeof OffscreenCanvas !== 'undefined' && SPR_K) {
      const k = SPR_K / 100, cv = new OffscreenCanvas(Math.ceil(w * k), Math.ceil(h * k)), g = cv.getContext('2d');
      if (g) { g.scale(cv.width / w, cv.height / h); g.translate(GUN_PAD - ga.x0, GUN_PAD - ga.y0); paintGun(g, ga); s = cv; }
    }
    SPR.set(key, s);
  }
  if (s) ctx.drawImage(s, ga.x0 - GUN_PAD, ga.y0 - GUN_PAD, w, h); else paintGun(ctx, ga);
  ctx.restore();
}

// The muzzle flash sprite at the barrel tip, turned with the barrel. It grows as it fades.
function drawFlash(ctx, run, f) {
  const F = A.flash, a = angleOf(run) * DEG, m = gunArt(run.gun.id).muzzle, life = f.t / f.max, s = (F.from + (1 - F.from) * (1 - life)) * (f.faint ? F.dropScale : 1);
  ctx.save(); ctx.translate(T.gunX + Math.cos(a) * m, run.gunY - Math.sin(a) * m); ctx.rotate(-a); ctx.scale(s, s);
  ctx.globalAlpha = life * (f.faint ? F.dropAlpha : 1);
  ctx.fillStyle = P.orangeLight; ctx.fill(FLASH);
  ctx.scale(F.mid, F.mid); ctx.fillStyle = P.orange; ctx.fill(FLASH);
  ctx.scale(F.core / F.mid, F.core / F.mid); ctx.fillStyle = P.flashCore; ctx.fill(FLASH);
  ctx.restore(); ctx.globalAlpha = 1;
}

// A casing on its short arc: launched up and back from the port, tumbling, resting on the ground line, fading out. Tumbling is drawn as the
// turning rectangle's bounding box (two plain rects, no transform), which reads the same at this size and costs almost nothing.
function drawCasing(ctx, f) {
  const C = A.casing, u = f.max - f.t, fy = HORIZON + C.floor, th = f.r0 + f.vr * u, c = Math.abs(Math.cos(th)), s = Math.abs(Math.sin(th));
  const x = f.x + f.vx * u, y = Math.min(fy, f.y + f.vy * u + 0.5 * C.gravity * u * u), w = f.w * c + f.h * s, h = f.w * s + f.h * c;
  ctx.globalAlpha = Math.min(1, f.t / (f.max * C.fade));
  ctx.fillStyle = P.ink; ctx.fillRect(x - w / 2 - C.line, y - h / 2 - C.line, w + 2 * C.line, h + 2 * C.line);
  ctx.fillStyle = P.brass; ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.globalAlpha = 1;
}

// ---- Targets ----

// A paper range target: a card with three printed rings, cyan and white for the goal (a horde card prints two and no bullseye). Returns the card's half size.
function drawCard(ctx, x, y, sc, bullMul, flat) {
  const R = T.zoneR, C = A.card, r2 = R[2] * sc, half = r2 + C.pad * sc, lw = Math.max(1.5, A.line * Math.min(1, sc + 0.25));
  ctx.lineJoin = 'round';
  if (!flat) { ctx.fillStyle = P.shadow; rrect(ctx, x - half + A.shadowX, y - half + A.shadowY, half * 2, half * 2, half * C.radius); ctx.fill(); }
  ctx.fillStyle = P.paper; ctx.strokeStyle = P.ink; ctx.lineWidth = lw;
  rrect(ctx, x - half, y - half, half * 2, half * 2, half * C.radius); ctx.fill(); ctx.stroke();
  if (flat) { disc(ctx, x, y, r2, P.slate); disc(ctx, x, y, R[1] * sc, P.cyan); return; } // a horde member is small: no printed edges, no shadow
  ctx.lineWidth = C.ringLine; ctx.strokeStyle = P.inkSoft;
  ringDisc(ctx, x, y, r2, P.slate); ringDisc(ctx, x, y, R[1] * sc, P.cyan);
  ringDisc(ctx, x, y, R[0] * sc * bullMul, P.white);
}

function paintCard(g, sc, flat) { drawCard(g, 0, 0, sc, 1, flat); }

// The stand of a still card: a thin post to the ground line with a foot. Drawn before the card, which hides its top.
function drawPost(ctx, x, top) {
  const C = A.card, base = HORIZON;
  if (base - top < 6) return;
  ctx.fillStyle = P.steelDark; ctx.strokeStyle = P.ink; ctx.lineWidth = A.line * 0.8;
  ctx.fillRect(x - C.post / 2, top - 2, C.post, base - top + 2); ctx.strokeRect(x - C.post / 2, top - 2, C.post, base - top + 2);
  rrect(ctx, x - C.foot / 2, base - 4, C.foot, 6, 2); ctx.fill(); ctx.stroke();
}

// The trolley under an approaching card: a bracket, a flat base and two wheels; approach cards also ride a rail with ties fixed in the world.
function drawTrolley(ctx, x, y, half, sc, rail) {
  const K = A.trolley, by = y + half, w = half * K.w, wr = Math.max(1.8, K.wheel * sc), wy = by + 1 + K.h, ga = ctx.globalAlpha;
  if (rail) {
    const ry = wy + wr, x0 = Math.floor(x / K.tie) * K.tie;
    ctx.globalAlpha = ga * K.railAlpha; ctx.strokeStyle = P.steelDark;
    ctx.lineWidth = K.rail; ctx.beginPath(); ctx.moveTo(x, ry); ctx.lineTo(T.designW - 4, ry); ctx.stroke();
    ctx.lineWidth = K.tieW; ctx.setLineDash(TIE_DASH); ctx.beginPath(); ctx.moveTo(x0, ry + 1); ctx.lineTo(T.designW - 4, ry + 1); ctx.stroke(); ctx.setLineDash(NO_DASH);
    ctx.globalAlpha = ga;
  }
  ctx.fillStyle = P.steelDark; ctx.strokeStyle = P.ink; ctx.lineWidth = A.line * 0.7;
  ctx.fillRect(x - 2, by - 2, 4, K.h + 4);
  rrect(ctx, x - w, by + 1, w * 2, K.h, 2); ctx.fill(); ctx.stroke();
  disc(ctx, x - w * 0.55, wy, wr, P.steel); ctx.stroke(); disc(ctx, x + w * 0.55, wy, wr, P.steel); ctx.stroke();
}

// A clay pigeon in the goal colour: a cyan rim round a neutral paper disc, a highlight and the white bullseye. Its radius is exactly the hit radius.
function paintClay(g, sc) { drawClay(g, 0, 0, sc); }
function drawClay(ctx, x, y, sc) {
  const C = A.clay, r = T.zoneR[1] * sc;
  ctx.lineJoin = 'round';
  disc(ctx, x + A.shadowX, y + A.shadowY, r, P.shadow);
  ctx.fillStyle = P.cyan; ctx.strokeStyle = P.ink; ctx.lineWidth = A.line * Math.min(1, sc + 0.3);
  ctx.beginPath(); ctx.arc(x, y, r, 0, PI2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = P.inkSoft; ctx.lineWidth = C.rimLine; ringDisc(ctx, x, y, r * C.disc, P.paper);
  ctx.strokeStyle = P.highlight; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r * 0.6, Math.PI * 1.05, Math.PI * 1.45); ctx.stroke();
  ctx.lineWidth = 1; ctx.strokeStyle = P.inkSoft; ringDisc(ctx, x, y, T.zoneR[0] * sc, P.white);
}

function octagon(g, x, y, r) {
  g.beginPath();
  for (let k = 0; k < 8; k++) { const a = Math.PI / 8 + (k * Math.PI) / 4; g[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); }
  g.closePath();
}

// A boss part: a bolted octagonal armour plate with the rings printed on it. The active one is lit in the goal colour: cyan bolts, glow and marching ring.
function paintPlate(g, sc, active) {
  const B = A.plate, R = T.zoneR, r2 = R[2] * sc, pr = r2 * B.r;
  g.lineJoin = 'round';
  if (active) { g.fillStyle = P.cyanGlow; octagon(g, 0, 0, pr * B.glow[1]); g.fill(); octagon(g, 0, 0, pr * B.glow[0]); g.fill(); }
  g.fillStyle = P.shadow; octagon(g, A.shadowX, A.shadowY, pr); g.fill();
  g.fillStyle = P.steel; g.strokeStyle = P.ink; g.lineWidth = A.line; octagon(g, 0, 0, pr); g.fill(); g.stroke();
  g.fillStyle = P.steelDark; octagon(g, 0, 0, pr * B.inner); g.fill();
  g.strokeStyle = P.highlight; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, pr * 0.93, Math.PI * 1.08, Math.PI * 1.42); g.stroke();
  g.lineWidth = 1; g.strokeStyle = P.inkSoft;
  ringDisc(g, 0, 0, r2, P.slate); ringDisc(g, 0, 0, R[1] * sc, P.cyan);
  ringDisc(g, 0, 0, R[0] * sc, P.white);
  g.strokeStyle = P.ink; g.lineWidth = 1.2;
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    disc(g, Math.cos(a) * pr * 0.905, Math.sin(a) * pr * 0.905, B.rivet * Math.min(1, sc + 0.2), active ? P.cyan : P.steelLight); g.stroke();
  }
}
function drawPlate(ctx, tg, active, time) {
  const B = A.plate, pr = T.zoneR[2] * tg.sc * B.r, x = tg.x, y = tg.y;
  drawSprite(ctx, K_PLATE + Math.round(tg.sc * 100) * 2 + (active ? 1 : 0), pr * B.glow[1] + 6, paintPlate, x, y, tg.sc, active);
  if (active) {
    ctx.strokeStyle = P.cyan; ctx.lineWidth = 2; ctx.setLineDash(SEL_DASH); ctx.lineDashOffset = -time * B.dash;
    ctx.beginPath(); ctx.arc(x, y, pr * B.glow[1] + 2, 0, PI2); ctx.stroke(); ctx.setLineDash(NO_DASH); ctx.lineDashOffset = 0;
  }
}

// The boss core: a pulsing halo, a dark shell with a cyan rim, the printed rings, and a specular glint outside the scoring rings.
function paintCore(g, sc, bullMul) {
  const C = A.core, R = T.zoneR, r2 = R[2] * sc;
  disc(g, A.shadowX, A.shadowY, r2, P.shadow);
  g.fillStyle = P.orbShell; g.strokeStyle = P.ink; g.lineWidth = A.line;
  g.beginPath(); g.arc(0, 0, r2, 0, PI2); g.fill(); g.stroke();
  g.strokeStyle = P.cyan; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, r2 - 2.5, 0, PI2); g.stroke();
  g.lineWidth = 1; g.strokeStyle = P.inkSoft;
  ringDisc(g, 0, 0, R[1] * sc, P.cyan);
  ringDisc(g, 0, 0, R[0] * sc * bullMul, P.white);
  disc(g, -r2 * C.spec * 0.7, -r2 * C.spec * 0.7, r2 * 0.13, P.highlight);
}
function drawCore(ctx, tg, time) {
  const C = A.core, r2 = T.zoneR[2] * tg.sc, pulse = 0.5 + 0.5 * Math.sin(time * C.pulse), ga = ctx.globalAlpha;
  ctx.globalAlpha = ga * C.glowAlpha[1]; disc(ctx, tg.x, tg.y, r2 + C.glow[1] + pulse * C.amp, P.cyan);
  ctx.globalAlpha = ga * C.glowAlpha[0]; disc(ctx, tg.x, tg.y, r2 + C.glow[0] + pulse * C.amp * 0.5, P.cyan);
  ctx.globalAlpha = ga;
  drawSprite(ctx, K_CORE + Math.round(tg.sc * 100), r2 + 6, paintCore, tg.x, tg.y, tg.sc, tg.bullMul || 1);
}

// A row of hit points in a small tray: lit pips are paper, spent ones dark steel.
function drawHp(ctx, x, y, hp, hpMax) {
  const B = A.plate, w = (hpMax - 1) * B.pipGap + B.pip + 2 * B.pipTray;
  ctx.fillStyle = P.ink; rrect(ctx, x - w / 2, y - B.pip / 2 - B.pipTray, w, B.pip + 2 * B.pipTray, 3); ctx.fill();
  for (let i = 0; i < hpMax; i++) { ctx.fillStyle = i < hp ? P.paper : P.steelDark; rrect(ctx, x + (i - (hpMax - 1) / 2) * B.pipGap - B.pip / 2, y - B.pip / 2, B.pip, B.pip, 1.5); ctx.fill(); }
}

// One target with everything that belongs to it: stand or trolley, the timer arc, hit points.
function drawTargetFull(ctx, E, tg, run, ch, alpha) {
  const sc = tg.sc, R2 = T.zoneR[2] * sc, half = R2 + A.card.pad * sc;
  ctx.globalAlpha = alpha;
  switch (tg.kind) {
    case 'skeet': drawSprite(ctx, K_CLAY + Math.round(sc * 100), T.zoneR[1] * sc + 6, paintClay, tg.x, tg.y, sc, 0); break;
    case 'core': drawCore(ctx, tg, E.time); break;
    case 'part': drawPlate(ctx, tg, tg.idx === run.stage, E.time); break;
    case 'horde':
      drawSprite(ctx, K_FLAT + Math.round(sc * 100), half + 6, paintCard, tg.x, tg.y, sc, true); break;
    case 'approach': case 'weave':
      drawTrolley(ctx, tg.x, tg.y, half, sc, tg.kind === 'approach'); drawSprite(ctx, K_CARD + Math.round(sc * 100), half + 6, paintCard, tg.x, tg.y, sc, false); break;
    default: // still and dodge cards on a post
      drawPost(ctx, tg.x, tg.y + half); drawSprite(ctx, K_CARD + Math.round(sc * 100), half + 6, paintCard, tg.x, tg.y, sc, false);
  }
  if (ch.ladder === 'accuracy') { // time left, as a ring round the card
    const C = A.card, rr = half * C.timerK + C.timerGap, end = -Math.PI / 2 + PI2 * clamp(tg.life / T.accLife, 0, 1);
    ctx.lineCap = 'round';
    ctx.strokeStyle = P.ink; ctx.lineWidth = C.timerWidth + 2; ctx.beginPath(); ctx.arc(tg.x, tg.y, rr, -Math.PI / 2, end); ctx.stroke();
    ctx.strokeStyle = P.paperShade; ctx.lineWidth = C.timerWidth; ctx.beginPath(); ctx.arc(tg.x, tg.y, rr, -Math.PI / 2, end); ctx.stroke();
    ctx.lineCap = 'butt';
  }
  ctx.globalAlpha = 1;
}

// Hit points are a second pass so no neighbouring plate covers them.
function drawTargetHp(ctx, tg, alpha) {
  if (tg.hp === undefined) return;
  const R2 = T.zoneR[2] * tg.sc;
  ctx.globalAlpha = alpha; drawHp(ctx, tg.x, tg.y + (tg.kind === 'core' ? R2 + A.core.glow[0] + 2 : R2 * A.plate.r) + 6, tg.hp, tg.hpMax); ctx.globalAlpha = 1;
}

// ---- Range finder and hit feedback ----

// Dots along the true barrel line, scaled and faded with distance, orange near the muzzle. It ends `accuracy` of the way to the right
// edge; a short one gets a soft cap so the end reads as deliberate.
function drawRangeFinder(ctx, run) {
  const F = A.finder, a = angleOf(run) * DEG, cs = Math.cos(a), sn = Math.sin(a), gx = T.gunX, gy = run.gunY;
  const d0 = gunArt(run.gun.id).muzzle + F.gap, d1 = rangeLen(run), n = T.rangeDots, nb = F.ramp;
  if (d1 <= d0) return;
  // A dark track under the dots keeps them readable on paper, then one fill per colour step (colour and fade both step with distance).
  ctx.globalAlpha = F.trackAlpha; ctx.strokeStyle = P.ink; ctx.lineWidth = F.track; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(gx + cs * d0, gy - sn * d0); ctx.lineTo(gx + cs * d1, gy - sn * d1); ctx.stroke(); ctx.lineCap = 'butt';
  for (let b = 0; b < nb; b++) {
    const al = 1 - (1 - F.farAlpha) * ((b + 0.5) / nb);
    ctx.beginPath();
    for (let i = Math.ceil((b * n) / nb); i < Math.ceil(((b + 1) * n) / nb); i++) {
      const f = (i + 0.5) / n, d = d0 + (d1 - d0) * f, r = F.rNear + (F.rFar - F.rNear) * f, x = gx + cs * d;
      ctx.moveTo(x + r, gy - sn * d); ctx.arc(x, gy - sn * d, r, 0, PI2);
    }
    ctx.fillStyle = RAMP[b]; ctx.globalAlpha = al; ctx.fill();
  }
  if (run.gun.accuracy < 0.999) {
    const ex = gx + cs * d1, ey = gy - sn * d1;
    ctx.globalAlpha = F.capAlpha; ctx.strokeStyle = P.white; ctx.lineWidth = F.capWidth; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(ex + sn * F.capHalf, ey + cs * F.capHalf); ctx.lineTo(ex - sn * F.capHalf, ey - cs * F.capHalf); ctx.stroke(); ctx.lineCap = 'butt';
  }
  ctx.globalAlpha = 1;
  if (run.gun.pellets > 1) { // the fan's outer pellets, faint
    const offs = fanOffsets(run.gun);
    ctx.strokeStyle = P.white; ctx.globalAlpha = F.fanAlpha; ctx.lineWidth = 1;
    for (let j = 0; j < 2; j++) {
      const b = (angleOf(run) + offs[j ? offs.length - 1 : 0]) * DEG;
      ctx.beginPath(); ctx.moveTo(gx + Math.cos(b) * d0, gy - Math.sin(b) * d0); ctx.lineTo(gx + Math.cos(b) * d1, gy - Math.sin(b) * d1); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

// A shot line: an orange stroke with a pale core, fading with its life.
function drawTracer(ctx, f) {
  const K = A.tracer, a = f.t / f.max;
  ctx.globalAlpha = a; ctx.strokeStyle = P.orange; ctx.lineWidth = K.width;
  ctx.beginPath(); ctx.moveTo(f.x0, f.y0); ctx.lineTo(f.x1, f.y1); ctx.stroke();
  ctx.globalAlpha = 1;
}

// The ring that opens at a hit in the zone's colour, over the first part of the pop's life.
function drawHitRing(ctx, f) {
  const K = A.ring, k = (1 - f.t / f.max) * (f.max / K.life);
  if (k >= 1) return;
  ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.color; ctx.lineWidth = K.width * (1 - k * 0.5);
  ctx.beginPath(); ctx.arc(f.x, f.y, K.r0 + (K.r1 - K.r0) * k, 0, PI2); ctx.stroke(); ctx.globalAlpha = 1;
}

// Score pop: bold, zone-coloured, with a dark outline so it reads on card, wall and sky alike.
function popText(E, str, x, y, color, alpha) {
  const ctx = E.ctx;
  ctx.globalAlpha = alpha; ctx.font = `${TY.strong} ${TY.mid + 2}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = A.popLine; ctx.strokeStyle = P.ink; ctx.strokeText(str, x, y);
  ctx.fillStyle = color; ctx.fillText(str, x, y); ctx.globalAlpha = 1;
}

// ---- The range: horizon, distant wall with lane markers, ground band. The static shapes are prebuilt Path2Ds (built once), drawn in a
// handful of fills; solid fills are the cheapest thing a canvas does, so this beats blitting a full-screen image every frame. ----

const BGP = { built: false, seams: null, boards: null, chevrons: null, plaques: null, ticks: null };
function buildBackdrop() {
  const W = T.designW, hz = HORIZON, b = A.backdrop, base = b.wallTop + b.coping;
  BGP.seams = new Path2D(); BGP.boards = new Path2D(); BGP.chevrons = new Path2D(); BGP.plaques = new Path2D(); BGP.ticks = new Path2D();
  for (let x = b.seam; x < W; x += b.seam) BGP.seams.rect(x - 1, base + 2, 2, hz - base - 2);
  for (let x = b.marker; x < W - 20; x += b.marker) { // a grey lane board with a darker chevron (neutral: nothing on the wall is a target)
    rrPath(BGP.boards, x - b.markerW / 2, base + 10, b.markerW, b.markerH, 2);
    BGP.chevrons.moveTo(x - 5, base + 15); BGP.chevrons.lineTo(x + 5, base + 15); BGP.chevrons.lineTo(x, base + 23); BGP.chevrons.closePath();
    BGP.plaques.rect(x - 5, base + 27, 10, 3);
    BGP.ticks.rect(x - 1, hz + 3, 2, b.tick);
  }
  BGP.built = true;
}
function drawBackdrop(ctx) {
  if (!BGP.built) buildBackdrop();
  const W = T.designW, H = T.designH, hz = HORIZON, b = A.backdrop, top = b.wallTop, base = top + b.coping;
  ctx.fillStyle = P.sky; ctx.fillRect(0, 0, W, b.skyLowY);
  ctx.fillStyle = P.skyLow; ctx.fillRect(0, b.skyLowY, W, top - b.skyLowY);
  ctx.fillStyle = P.wall; ctx.fillRect(0, top, W, hz - top);
  ctx.fillStyle = P.wallTop; ctx.fillRect(0, top, W, b.coping);
  ctx.fillStyle = P.highlight; ctx.fillRect(0, top, W, 2);
  ctx.fillStyle = P.ink; ctx.fillRect(0, base, W, 2);
  ctx.fillStyle = P.wallSeam; ctx.fill(BGP.seams);
  ctx.fillStyle = P.steel; ctx.strokeStyle = P.ink; ctx.lineJoin = 'round'; ctx.lineWidth = 1.6; ctx.fill(BGP.boards); ctx.stroke(BGP.boards);
  ctx.fillStyle = P.steelDark; ctx.fill(BGP.chevrons);
  ctx.fillStyle = P.slate; ctx.fill(BGP.plaques);
  ctx.fillStyle = P.shadow; ctx.fillRect(0, hz - 6, W, 6);
  ctx.fillStyle = P.ground; ctx.fillRect(0, hz, W, H - hz);
  ctx.fillStyle = P.groundLine; ctx.fillRect(0, hz - 1, W, 3);
  ctx.fillStyle = P.tape; ctx.fill(BGP.ticks); ctx.fillRect(0, hz + 8, W - 8, 2); ctx.fillRect(0, H - 10, W - 8, 2);
  ctx.fillStyle = P.backstop; ctx.fillRect(W - 6, 0, 6, H);
  ctx.fillStyle = P.backstopEdge; ctx.fillRect(W - 6, 0, 2, H);
}

// ---- Interface pieces (screen px) ----

// A chunky panel: a shadow, then the face with its edge.
function plate(E, x, y, w, h, fill, edge, r) {
  const rad = r === undefined ? A.radius : r;
  E.roundRect(x, y + A.shadowY, w, h, rad, P.shadow);
  E.roundRect(x, y, w, h, rad, fill, edge);
}
// A button on a plate with a dark edge; returns its rect for hit-testing.
function btn(E, label, cx, cy, o) {
  const x = cx - o.w / 2, y = cy - o.h / 2;
  plate(E, x, y, o.w, o.h, o.fill, P.ink);
  E.text(label, cx, cy, { size: o.size, color: o.color || P.text, weight: TY.strong });
  return { x, y, w: o.w, h: o.h };
}
// The combo pips as casings, two paths for the whole row: `lit` brass ones with a primer, and the spent, empty ones.
function pipRow(ctx, x0, y, lit, total) {
  const K = A.pip;
  ctx.lineJoin = 'round'; ctx.lineWidth = 1.4;
  for (let pass = 0; pass < 2; pass++) {
    const on = pass === 1;
    ctx.beginPath();
    for (let i = 0; i < total; i++) if ((i < lit) === on) {
      const x = x0 + i * K.gap;
      rrPath(ctx, x - K.w / 2, y - K.h / 2 + 3, K.w, K.h - 3, 1.5); rrPath(ctx, x - K.w / 2 + 1, y - K.h / 2 - 1, K.w - 2, 5, 1.5);
    }
    ctx.fillStyle = on ? P.brass : P.panel; ctx.strokeStyle = on ? P.ink : P.panelEdge; ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = P.brassDark; ctx.beginPath();
  for (let i = 0; i < lit; i++) { const x = x0 + i * K.gap; ctx.moveTo(x + 1.3, y + K.h / 2 - 1); ctx.arc(x, y + K.h / 2 - 1, 1.3, 0, PI2); }
  ctx.fill();
}

// A skin swatch: the skin's steel, its darker steel and its accent stripe in one rounded square, dimmed when the skin is locked.
function paintChip(ctx, cx, cy, size, radius, skin, open) {
  const h = size / 2, pal = skin.pal;
  ctx.globalAlpha = open ? 1 : 0.4;
  ctx.save(); rrect(ctx, cx - h, cy - h, size, size, radius); ctx.clip();
  ctx.fillStyle = pal.steel || P.steel; ctx.fillRect(cx - h, cy - h, size, size);
  ctx.fillStyle = pal.steelDark || P.steelDark; ctx.fillRect(cx - h, cy + h * 0.25, size, h);
  ctx.fillStyle = pal.accent || P.orange; ctx.fillRect(cx - h, cy - h * 0.15, size, h * 0.35);
  ctx.restore();
  ctx.strokeStyle = P.ink; ctx.lineWidth = 2; rrect(ctx, cx - h, cy - h, size, size, radius); ctx.stroke();
  ctx.globalAlpha = 1;
}
// A menu swatch on a plate, hit rect r; the worn one is ringed in orange, a locked one carries a padlock.
function drawChip(ctx, E, r, skin, on, open) {
  const C = A.chip, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  plate(E, r.x + 2, r.y + 2, r.w - 4, r.h - 4, on ? P.panelHi : P.panel, on ? P.orange : P.panelEdge);
  paintChip(ctx, cx, cy, C.size, C.radius, skin, open);
  if (!open) drawLock(ctx, cx, cy, P.text);
}
// "Pistol Nickel" with a small swatch to its left, right-aligned at xr: what a badge unlocks, on the missions screen.
function drawSkinLine(ctx, E, k, xr, y, on) {
  const C = A.chip, str = `${T.guns[k.gun].short} ${k.skin.name}`;
  E.text(str, xr, y, { size: TY.small, align: 'right', color: on ? P.text : P.textDim });
  paintChip(ctx, xr - ctx.measureText(str).width - C.mini / 2 - 6, y, C.mini, 3, k.skin, on);
}

// ---------- Play state ----------

const S = {};

function newRun(ch, id, gauntlet, skin) {
  S.ch = ch; S.gunId = id; S.skin = skin || 'std'; S.run = makeRun(ch, id); S.gauntlet = gauntlet === undefined ? null : gauntlet;
  S.fx = []; S.endT = 0; S.drag = null; S.right = new Set(); S.breachAt = -1;
  S.run.frameReal = performance.now();
}

const rnd = (r) => r[0] + (r[1] - r[0]) * Math.random();

// A casing leaves the gun's port on every shot, at most `casing.cap` alive at once (the oldest goes first). Cosmetic: Math.random is fine.
function ejectCasing(run) {
  const ga = gunArt(run.gun.id), C = A.casing, a = angleOf(run) * DEG, cs = Math.cos(a), sn = Math.sin(a);
  let n = 0, oldest = -1;
  for (let i = 0; i < S.fx.length; i++) if (S.fx[i].k === 'casing') { n++; if (oldest < 0) oldest = i; }
  if (n >= C.cap) S.fx.splice(oldest, 1);
  S.fx.push({ k: 'casing', x: T.gunX + ga.port[0] * cs + ga.port[1] * sn, y: run.gunY - ga.port[0] * sn + ga.port[1] * cs, vx: rnd(C.vx), vy: rnd(C.vy), r0: Math.random() * PI2, vr: rnd(C.spin), w: ga.shell[0], h: ga.shell[1], t: C.life, max: C.life });
}

function cosmetics(E, ev) {
  if (ev.type === 'shot') {
    // Shot lines leave the drawn muzzle: the event's origin is barrelLen along the barrel, the drawn tip may be further out.
    const run = S.run, ex = gunArt(run.gun.id).muzzle - T.barrelLen, dx = ev.x1 - ev.x0, dy = ev.y1 - ev.y0, dl = Math.hypot(dx, dy) || 1;
    const ox = ev.x0 + (dx / dl) * ex, oy = ev.y0 + (dy / dl) * ex;
    for (const l of ev.lines) S.fx.push({ k: 'tracer', x0: ox, y0: oy, x1: l.x1, y1: l.y1, t: T.tracerLife, max: T.tracerLife });
    S.fx.push({ k: 'flash', t: T.flashLife, max: T.flashLife });
    ejectCasing(run);
    E.audio.play('tap'); E.haptic(8);
    if (ev.hit) {
      S.fx.push({ k: 'pop', x: ev.tx, y: ev.ty, text: `${ev.pts}`, color: P.zone[ev.zone], t: T.popLife, max: T.popLife });
      if (ev.zone === 0) { E.audio.play('coin'); E.haptic(16); }
      E.audio.play('hit', 0.5);
      E.audio.beep({ freq: 440 * Math.pow(2, Math.min(ev.streak, 12) / 12), dur: 0.06, type: 'triangle', gain: 0.1 });
    }
  } else if (ev.type === 'dropped') { // a tap inside the fire interval: a faint click and a flicker, no effect on timing
    E.audio.play('tap', 0.12);
    S.fx.push({ k: 'flash', faint: true, t: T.flashLife * 0.6, max: T.flashLife * 0.6 });
  } else if (ev.type === 'breach') {
    S.fx.push({ k: 'edge', t: T.edgeLife, max: T.edgeLife });
    if (E.time - S.breachAt >= T.breachGap) { S.breachAt = E.time; E.audio.play('miss'); E.haptic(30); } // a horde breaching together sounds once
  }
}

function endRun(E) {
  const r = S.run, ch = S.ch, stars = starsFor(ch, r.score, r.gun.id);
  const prev = bests(E)[ch.id], prevStars = prev && prev.stars ? prev.stars : 0;
  // Stars are monotonic and kept apart from the best score: a higher score with fewer stars (another gun's thresholds) never lowers them.
  const isNew = !prev || r.score > prev.score, bestScore = isNew ? r.score : prev.score, bestStars = Math.max(stars, prevStars);
  if (isNew || bestStars !== prevStars) E.save.update('best', (b) => ({ ...(b && typeof b === 'object' ? b : {}), [ch.id]: { score: bestScore, stars: bestStars } }), {});
  let bossGuns = E.save.get('bossGuns', {});
  if (!bossGuns || typeof bossGuns !== 'object') bossGuns = {};
  if (ch.id === 'b1' && stars === 3 && !bossGuns[r.gun.id]) { bossGuns = { ...bossGuns, [r.gun.id]: 1 }; E.save.set('bossGuns', bossGuns); }
  const gaunt = S.gauntlet === null ? null : gauntletStep(S.gauntlet, stars);
  const fresh = newBadges({ ch, gun: r.gun.id, stars, double: r.double, gauntletDone: !!(gaunt && gaunt.done), bests: bests(E), bossGuns, have: badgeMap(E) });
  if (fresh.length) E.save.update('badges', (b) => ({ ...(b && typeof b === 'object' ? b : {}), ...Object.fromEntries(fresh.map((id) => [id, 1])) }), {});
  const unlocked = fresh.map(skinOfBadge).filter(Boolean).map((k) => `${T.guns[k.gun].short} ${k.skin.name}`);
  E.setScene('over', { id: ch.id, gun: r.gun.name, gunId: r.gun.id, skin: S.skin, score: r.score, stars, best: bestScore, isNew, bestStars, hits: r.hits, bulls: r.bulls, shots: r.shots, badges: fresh, gaunt, thr: thresholds(ch, r.gun.id) });
  if (unlocked.length) E.toast(`Skin unlocked: ${unlocked.join(', ')}`);
}

function meterText(r, ch) {
  if (ch.ladder === 'accuracy') return `Ammo ${r.ammo}`;
  if (ch.ladder === 'skeet') return `Left ${r.list.length - r.idx + r.targets.length}`;
  return `Time ${Math.max(0, Math.ceil((ch.speedSeconds || ch.bossSeconds) - r.steps * STEP))}`;
}

// ---------- Menu layout ----------

// The landscape left column, top to bottom, as [roomy, tight] offsets from its top: the roomy column is 361 tall, the tight one 336
// (the least that keeps every button 44 px). The layout slides between them by how much height the viewport leaves above the bottom inset.
const MENU_COL = { title: [14, 12], points: [40, 34], bar: [54, 46], next: [72, 63], guns: [84, 74], pitch: [62, 56], tile: [56, 50], stat: [232, 209], play: [261, 240], playH: [48, 44], row: [317, 292], rowH: [44, 44] };
const MENU_MARGIN = 6;

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
    const W = Math.min(E.w - 2 * side, 780), x0 = (E.w - W) / 2, lw = 236, C = MENU_COL;
    const avail = E.h - E.safe.top - E.safe.bottom - 2 * MENU_MARGIN, tall = C.row[0] + C.rowH[0], short = C.row[1] + C.rowH[1];
    const k = clamp((avail - short) / (tall - short), 0, 1), at = (key) => Math.round(C[key][1] + (C[key][0] - C[key][1]) * k), H = at('row') + at('rowH');
    const y0 = E.safe.top + MENU_MARGIN + Math.max(0, (avail - H) / 2);
    L.title = { x: x0 + lw / 2, y: y0 + at('title') }; L.points = { x: x0 + lw / 2, y: y0 + at('points') }; L.bar = { x: x0, y: y0 + at('bar'), w: lw, h: 6 };
    L.next = { x: x0 + lw / 2, y: y0 + at('next') };
    L.guns = gunGrid(x0, y0 + at('guns'), lw, at('pitch'), at('tile'));
    L.stat = { x: x0 + lw / 2, y: y0 + at('stat') };
    L.play = { x: x0, y: y0 + at('play'), w: lw, h: at('playH') };
    L.missions = { x: x0, y: y0 + at('row'), w: (lw - 8) / 2, h: at('rowH') }; L.mute = { x: x0 + (lw + 8) / 2, y: y0 + at('row'), w: (lw - 8) / 2, h: at('rowH') };
    const rx = x0 + lw + 28;
    L.skinRow = { lx: rx, x: rx + A.chip.labelW, y: E.safe.top + 8 }; // the left column has no height to spare at 360, so the swatches sit above the ladders
    rowsAt(rx, E.safe.top + 56, x0 + W - rx, 66, 56);
  } else {
    const W = Math.min(E.w - 2 * side, 560), x0 = (E.w - W) / 2, y0 = E.safe.top + 14;
    L.title = { x: E.w / 2, y: y0 + 16 }; L.points = { x: E.w / 2, y: y0 + 44 }; L.bar = { x: x0, y: y0 + 58, w: W, h: 6 };
    L.next = { x: E.w / 2, y: y0 + 76 };
    L.guns = gunGrid(x0, y0 + 90, W, 62, 56);
    L.stat = { x: E.w / 2, y: y0 + 240 };
    L.skinRow = { lx: x0, x: x0 + A.chip.labelW, y: y0 + 272 };
    rowsAt(x0, y0 + 328, W, 66, 56);
    const by = y0 + 328 + 4 * 66 + 12;
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
  enter() { this.tiles = []; this.guns = []; this.chips = []; this.btnPlay = null; this.btnMute = null; this.btnMissions = null; },
  render(ctx, E) {
    const L = menuLayout(E), sel = T.guns[gunId(E)], pts = pointsTotal(E), nx = nextUnlock(pts);
    E.text('RECOIL', L.title.x, L.title.y, { size: TY.big, weight: TY.strong, color: P.text });
    E.text(`Points ${pts}`, L.points.x, L.points.y + 2, { size: TY.mid, weight: TY.strong, color: P.cyan });
    E.text(nx ? `Next: ${T.guns[nx.id].name} at ${nx.need}` : 'All guns unlocked', L.next.x, L.next.y, { size: TY.small, color: P.textDim });
    E.roundRect(L.bar.x - 2, L.bar.y - 2, L.bar.w + 4, L.bar.h + 4, 5, P.ink);
    E.roundRect(L.bar.x, L.bar.y, L.bar.w, L.bar.h, 3, P.panelEdge);
    const frac = nx ? clamp((pts - nx.from) / (nx.need - nx.from), 0, 1) : 1;
    if (frac > 0) E.roundRect(L.bar.x, L.bar.y, Math.max(6, L.bar.w * frac), L.bar.h, 3, P.cyan);
    this.guns = L.guns;
    for (const b of L.guns) {
      const on = b.id === sel.id, open = gunUnlocked(E, b.id), cx = b.x + b.w / 2;
      plate(E, b.x, b.y, b.w, b.h, on ? P.panelHi : P.panel, on ? P.orange : P.panelEdge);
      ctx.globalAlpha = open ? 1 : 0.25;
      drawGunTile(ctx, b.id, cx, b.y + b.h / 2, b.w - 2 * A.tile.pad, b.h - 2 * A.tile.pad, open ? skinId(E, b.id) : 'std');
      ctx.globalAlpha = 1;
      if (!open) {
        drawLock(ctx, cx, b.y + b.h / 2 - 12, P.textDim);
        E.text(`${T.unlockPoints[GUN_IDS.indexOf(b.id)]} points`, cx, b.y + b.h - 14, { size: TY.small, weight: TY.strong, color: P.textDim });
      }
    }
    const wear = skinById(sel.id, skinId(E, sel.id));
    E.text(wear.badge ? `${sel.short} · ${wear.name}` : sel.name, L.stat.x, L.stat.y - 19, { size: TY.mid, weight: TY.strong, color: P.text });
    E.text(`Damage ${sel.damage}${sel.pellets > 1 ? ` x${sel.pellets}` : ''}   ${sel.fireRate}/s   Range ${Math.round(sel.accuracy * 100)}%`, L.stat.x, L.stat.y, { size: TY.small, color: P.textDim });
    E.text(sel.auto ? 'Hold the right thumb to fire' : 'Tap the right thumb to fire', L.stat.x, L.stat.y + 17, { size: TY.small, color: P.textDim });
    // Skin swatches for the selected gun: a chip per skin, the worn one ringed in orange, locked ones dimmed with a padlock.
    const SK = L.skinRow, C = A.chip;
    E.text('Skin', SK.lx, SK.y + C.hit / 2, { size: TY.small, align: 'left', color: P.textDim });
    this.chips = A.skins[sel.id].map((skin, i) => {
      const r = { x: SK.x + i * (C.hit + C.gap), y: SK.y, w: C.hit, h: C.hit, gun: sel.id, skin }, open = skinOpen(E, skin);
      drawChip(ctx, E, r, skin, skin.id === wear.id, open);
      return r;
    });
    this.tiles = [];
    for (const row of L.rows) {
      E.text(row.label, row.x, row.y + row.th / 2, { size: TY.small, align: 'left', color: P.textDim });
      CHALLENGES.filter((c) => c.ladder === row.ladder).forEach((ch, i) => {
        const x = row.x + row.labelW + i * (row.tw + row.gap), top = row.y, tw = row.tw, th = row.th;
        const locked = !isUnlocked(E, ch), st = starsOf(E, ch);
        plate(E, x, top, tw, th, locked ? P.ink : P.panelHi, st ? P.brass : locked ? P.panelEdge : P.slateEdge);
        E.text(`${ch.level}`, x + tw / 2, top + 17, { size: TY.mid, weight: TY.strong, color: locked ? P.textDim : P.text });
        if (locked) drawLock(ctx, x + tw / 2, top + th - 16, P.textFaint);
        else for (let k = 0; k < 3; k++) drawStar(ctx, x + tw / 2 + (k - 1) * 16, top + th - 15, 6, k < st ? P.brass : null, k < st ? null : P.panelEdge);
        this.tiles.push({ x, y: top, w: tw, h: th, ch, locked });
      });
    }
    const p = L.play, m = L.mute, ms = L.missions, earned = BADGES.filter((b) => badgeMap(E)[b.id]).length;
    this.btnPlay = btn(E, `Play ${firstPlayable(E).name}`, p.x + p.w / 2, p.y + p.h / 2, { w: p.w, h: p.h, fill: P.orange, color: P.ink, size: TY.mid });
    this.btnMissions = btn(E, `Missions ${earned}/${BADGES.length}`, ms.x + ms.w / 2, ms.y + ms.h / 2, { w: ms.w, h: ms.h, fill: P.panelHi, size: TY.small });
    this.btnMute = btn(E, E.audio.muted ? 'Sound: off' : 'Sound: on', m.x + m.w / 2, m.y + m.h / 2, { w: m.w, h: m.h, fill: P.slate, size: TY.small });
  },
  onTap(p, E) {
    if (E.hit(this.btnPlay, p)) { E.setScene('play', { id: firstPlayable(E).id }); return; }
    if (E.hit(this.btnMute, p)) { E.audio.toggleMute(); E.audio.play('tap'); return; }
    if (E.hit(this.btnMissions, p)) { E.audio.play('tap'); E.setScene('missions'); return; }
    for (const c of this.chips) if (E.hit(c, p)) {
      if (skinOpen(E, c.skin)) { E.save.update('skins', (m) => ({ ...(m && typeof m === 'object' ? m : {}), [c.gun]: c.skin.id }), {}); E.audio.play('tap'); }
      else { const b = BADGES.find((k) => k.id === c.skin.badge); E.audio.play('tap', 0.3); E.toast(`${c.skin.name}: earn the ${b.name} badge (${b.cond})`); }
      return;
    }
    for (const b of this.guns) if (E.hit(b, p)) { if (gunUnlocked(E, b.id)) { E.save.set('gun', b.id); E.audio.play('tap'); } else E.audio.play('tap', 0.3); return; }
    for (const t of this.tiles) if (!t.locked && E.hit(t, p)) { E.setScene('play', { id: t.ch.id }); return; }
  },
};

// Why the Gauntlet is locked: the level before each locked stage needs a star (Boss 1 is always open).
function gauntletReason(E) {
  const need = GAUNTLET.map((id) => CHALLENGES.find((c) => c.id === id)).filter((c) => !isUnlocked(E, c))
    .map((c) => CHALLENGES.find((p) => p.ladder === c.ladder && p.level === c.level - 1).name);
  return `Locked: earn a star on ${need.join(', ')} first`;
}

// Missions: the badge tiers. Earned badges are lit; the rest show what earns them. The gauntlet starts here.
const missions = {
  enter() { this.back = null; this.btnGauntlet = null; this.reason = ''; },
  render(ctx, E) {
    const have = badgeMap(E), land = E.w >= E.h * 1.2, side = 16 + Math.max(E.safe.left, E.safe.right);
    const W = Math.min(E.w - 2 * side, land ? 780 : 560), x0 = (E.w - W) / 2, top = E.safe.top + 62;
    const earned = BADGES.filter((b) => have[b.id]).length;
    this.back = btn(E, 'Back', x0 + 42, E.safe.top + 30, { w: 84, h: 44, size: TY.small, fill: P.slate });
    E.text(`Missions  ${earned}/${BADGES.length}`, E.w / 2, E.safe.top + 30, { size: TY.mid + 2, weight: TY.strong, color: P.text });
    const open = GAUNTLET.every((id) => isUnlocked(E, CHALLENGES.find((c) => c.id === id)));
    this.reason = open ? '' : gauntletReason(E);
    const gw = land ? 120 : W, gy = land ? E.safe.top + 30 : top + BADGES.length * 66 + 8 + 24, gx = land ? x0 + W - 60 : E.w / 2;
    this.btnGauntlet = btn(E, 'Gauntlet', open ? gx : gx + 10, gy, { w: gw, h: land ? 44 : 48, size: TY.small, fill: open ? P.orange : P.panelHi, color: open ? P.ink : P.textDim });
    if (!open) {
      drawLock(ctx, gx - 34, gy, P.textDim); // the dim button says why: a lock here, the reason below (portrait) or on tap (toast)
      if (!land) wrapText(ctx, this.reason, W, TY.small).forEach((ln, k) => E.text(ln, E.w / 2, gy + 42 + k * 18, { size: TY.small, color: P.textDim }));
    }
    BADGES.forEach((b, i) => {
      const on = !!have[b.id], col = P.tier[b.tier], sk = skinOfBadge(b.id);
      if (land) {
        const gap = 10, tw = (W - 2 * gap) / 3, th = 88, x = x0 + (i % 3) * (tw + gap), y = top + Math.floor(i / 3) * 96;
        plate(E, x, y, tw, th, on ? P.panelHi : P.panel, on ? col : P.panelEdge, 12);
        E.text(b.tier.toUpperCase(), x + 12, y + 14, { size: TY.small, align: 'left', color: on ? col : P.textDim });
        if (sk) drawSkinLine(ctx, E, sk, x + tw - 12, y + 14, on);
        E.text(b.name, x + 12, y + 36, { size: TY.mid, weight: TY.strong, align: 'left', color: on ? P.text : P.textDim });
        wrapText(ctx, b.cond, tw - 24, TY.small).forEach((ln, k) => E.text(ln, x + 12, y + 58 + k * 18, { size: TY.small, align: 'left', color: P.textDim }));
        if (on) drawStar(ctx, x + tw - 24, y + 40, 12, col);
      } else {
        const y = top + i * 66, th = 60;
        plate(E, x0, y, W, th, on ? P.panelHi : P.panel, on ? col : P.panelEdge, 12);
        E.text(b.name, x0 + 14, y + 18, { size: TY.mid, weight: TY.strong, align: 'left', color: on ? P.text : P.textDim });
        E.text(b.tier.toUpperCase(), x0 + 14 + ctx.measureText(b.name).width + 10, y + 18, { size: TY.small, align: 'left', color: on ? col : P.textDim });
        E.text(b.cond, x0 + 14, y + 42, { size: TY.small, align: 'left', color: P.textDim });
        if (sk) drawSkinLine(ctx, E, sk, x0 + W - 14, y + 18, on);
        if (on) drawStar(ctx, x0 + W - 22, y + 42, 9, col);
      }
    });
    this.open = open;
  },
  onTap(p, E) {
    if (E.hit(this.back, p)) { E.audio.play('tap'); E.setScene('menu'); return; }
    if (E.hit(this.btnGauntlet, p)) {
      if (this.open) { E.audio.play('tap'); E.setScene('play', { id: GAUNTLET[0], gauntlet: 0 }); } else { E.audio.play('tap', 0.3); E.toast(this.reason); }
    }
  },
};

const play = {
  enter(E, params) {
    newRun(CHALLENGES.find((c) => c.id === (params && params.id)) || CHALLENGES[0], gunId(E), params && params.gauntlet, skinId(E, gunId(E)));
    this.menuBtn = null;
  },

  update(dt, E) {
    const r = S.run;
    for (const f of S.fx) f.t -= dt;
    let n = 0;
    for (const f of S.fx) { f.t -= 0; if (f.t > 0) S.fx[n++] = f; }
    S.fx.length = n;
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
    sprScale(v.s * E.dpr);
    drawBackdrop(ctx);
    if (ch.ladder === 'speed') { // the breach line
      ctx.strokeStyle = P.red; ctx.globalAlpha = 0.35; ctx.lineWidth = 2; ctx.setLineDash(BREACH_DASH);
      ctx.beginPath(); ctx.moveTo(T.gunLineX, 0); ctx.lineTo(T.gunLineX, HORIZON); ctx.stroke();
      ctx.setLineDash(NO_DASH); ctx.globalAlpha = 1;
    }
    for (const f of S.fx) if (f.k === 'edge') {
      ctx.fillStyle = P.red; ctx.globalAlpha = 0.8 * (f.t / f.max); ctx.fillRect(0, 0, 10, T.designH); ctx.globalAlpha = 1;
    }
    for (const tg of r.targets) {
      let alpha = 1;
      if (tg.kind === 'part' && tg.idx !== r.stage) alpha = 0.5;
      if (tg.kind === 'dodge' && now >= tg.nextDodge - T.dodgeWarn && Math.floor(E.time * 10) % 2) alpha = 0.3;
      drawTargetFull(ctx, E, tg, r, ch, alpha);
    }
    for (const tg of r.targets) drawTargetHp(ctx, tg, tg.kind === 'part' && tg.idx !== r.stage ? 0.5 : 1);
    drawRangeFinder(ctx, r);
    for (const f of S.fx) if (f.k === 'tracer') drawTracer(ctx, f);
    for (const f of S.fx) if (f.k === 'pop') drawHitRing(ctx, f);
    drawGun(ctx, r);
    for (const f of S.fx) if (f.k === 'flash') drawFlash(ctx, r, f);
    for (const f of S.fx) if (f.k === 'casing') drawCasing(ctx, f);
    ctx.restore();

    for (const tg of r.targets) if (tg.kind === 'part') {
      const on = tg.idx === r.stage;
      E.text(PART_NUM[tg.idx], v.ox + (tg.x - T.zoneR[2] * tg.sc * A.plate.r - 10) * v.s, v.oy + tg.y * v.s, { size: TY.small, weight: TY.strong, color: on ? P.text : P.textDim });
    }
    for (const f of S.fx) if (f.k === 'pop') {
      const k = 1 - f.t / f.max;
      popText(E, f.text, v.ox + f.x * v.s, v.oy + (f.y - 18 - 22 * k) * v.s, f.color, 1 - k * k);
    }
    this.hud(E, v, r, ch);
    if (E.h > E.w) { // portrait: playable, but say what it wants, in the letterbox below the field
      const below = v.oy + v.h + 8 + 34 <= E.h - E.safe.bottom;
      const by = (below ? v.oy + v.h + 8 : E.h - E.safe.bottom - 38) + 17;
      plate(E, v.ox + 12, by - 17, v.w - 24, 34, P.panel, P.orange);
      E.text('Rotate your phone', v.ox + v.w / 2, by, { size: TY.mid, weight: TY.strong, color: P.text });
    }
  },

  // HUD inside the safe insets: the field is fitted to the safe area, so anything anchored to it is inside. Landscape keeps
  // the top-left for text and the top-right for Menu and score (clear of the gun at its highest and of the range finder);
  // the combo sits in the ground band. Portrait puts everything in the letterbox above the field when it fits.
  // Three sizes: small (buttons, labels), mid (name, meter, combo), big (score).
  hud(E, v, r, ch) {
    const pad = T.hudPad, xl = v.ox + pad, xr = v.ox + v.w - pad, compact = v.w < 560, ctx = E.ctx;
    const hudH = compact ? 70 : 44;
    const top = v.oy - hudH - 4 >= E.safe.top + 4 ? v.oy - hudH - 4 : v.oy + 4;
    E.text(ch.name, xl, top + (compact ? 22 : 12), { size: TY.mid, weight: TY.strong, align: 'left', color: P.text });
    const nameW = ctx.measureText(ch.name).width;
    const low = ch.ladder === 'accuracy' && r.ammo <= 3;
    E.text(meterText(r, ch), compact ? xl : xl + nameW + 16, top + (compact ? 58 : 12), { size: TY.mid, align: 'left', color: low ? P.orange : P.textDim });
    E.text(`${r.score}`, xr, top + 22, { size: TY.big, weight: TY.strong, align: 'right', color: P.text });
    this.menuBtn = btn(E, 'Menu', xr - 96 - 8 - 32, top + 22, { w: 64, h: 44, size: TY.small, fill: P.panelHi });
    const mult = Math.min(T.comboCap, 1 + T.comboStep * r.streak), live = r.streak > 0;
    const pips = Math.round((T.comboCap - 1) / T.comboStep), gap = A.pip.gap;
    const cy = compact ? top + 58 : v.oy + (T.designH - T.thumbLane * 0.5) * v.s;
    const cx = compact ? xr - 44 - pips * gap : v.ox + v.w / 2 - 50;
    E.text(`x${mult.toFixed(1)}`, compact ? xr : cx, cy, { size: TY.mid, weight: TY.strong, align: compact ? 'right' : 'left', color: live ? P.orange : P.textDim });
    pipRow(ctx, compact ? cx : cx + 50, cy, Math.min(pips, r.streak), pips);
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
  onPause() { newRun(S.ch, S.gunId, S.gauntlet === null ? undefined : S.gauntlet, S.skin); }, // closing the app mid-challenge restarts it
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
    const pw = Math.min(E.w - 16, 500);
    plate(E, cx - pw / 2, y0 - 18, pw, H + 30, P.panel, P.panelEdge, 16);
    E.text(`${ch.name}  ·  ${p.gun}${g ? `  ·  Gauntlet ${g.i + 1}/${GAUNTLET.length}` : ''}`, cx, y0 + 10, { size: TY.small, color: P.textDim });
    E.text(`${p.score}`, cx, y0 + 56, { size: TY.big + 16, weight: TY.strong, color: P.text });
    if (p.gunId) { // the gun as it was worn, on the left of the score
      const tx = cx - pw / 2 + 14 + 42, ws = skinById(p.gunId, p.skin);
      drawGunTile(ctx, p.gunId, tx, y0 + 58, 84, 34, p.skin);
      if (ws.badge) E.text(ws.name, tx, y0 + 86, { size: TY.small, color: P.textDim });
    }
    const age = E.time - this.t0;
    for (let i = 0; i < 3; i++) {
      const sx = cx + (i - 1) * 60, sy = y0 + 112;
      if (i < p.stars) {
        const k = ease.outBack(clamp((age - i * 0.2) / 0.3, 0, 1));
        if (k > 0) drawStar(ctx, sx, sy, 22 * k, P.brass);
      } else drawStar(ctx, sx, sy, 22, null, P.panelEdge);
    }
    const of = ch.ladder === 'accuracy' ? ` of ${ch.accTargets}` : '';
    E.text(`Hits ${p.hits}${of}   Bullseyes ${p.bulls}`, cx, y0 + 158, { size: TY.mid, color: P.text });
    E.text(`${p.isNew ? 'New best' : 'Best'} ${p.best}  ·  ${p.bestStars} ${p.bestStars === 1 ? 'star' : 'stars'} saved`, cx, y0 + 182, { size: TY.mid, weight: p.isNew ? TY.strong : TY.normal, color: p.isNew ? P.orange : P.textDim });
    E.text(`Stars at ${p.thr.one} / ${p.thr.two} / ${p.thr.three}`, cx, y0 + 206, { size: TY.small, color: P.textDim });
    if (p.badges.length) { // a badge pop: the line pops in by transform, from popFrom of its size (never under the small text size), fading up
      const t = clamp((age - 0.5) / 0.35, 0, 1), k = ease.outBack(t), names = p.badges.map((id) => BADGES.find((b) => b.id === id).name).join(', ');
      const col = P.tier[BADGES.find((b) => b.id === p.badges[0]).tier], from = TY.small / TY.mid, sc = from + (1 - from) * k, msg = `Badge earned: ${names}`;
      if (t > 0) {
        ctx.save(); ctx.translate(cx + 12, y0 + 236); ctx.scale(sc, sc);
        E.text(msg, 0, 0, { size: TY.mid, weight: TY.strong, color: col, alpha: t }); ctx.globalAlpha = t;
        drawStar(ctx, -ctx.measureText(msg).width / 2 - 16, 0, 11, col);
        ctx.restore();
      }
    } else if (g && !g.ok) E.text('Gauntlet over: two stars needed', cx, y0 + 236, { size: TY.mid, color: P.red });
    else if (g && g.done) E.text('Gauntlet complete', cx, y0 + 236, { size: TY.mid, color: P.cyan });
    else if (g) E.text('Gauntlet stage passed', cx, y0 + 236, { size: TY.mid, color: P.cyan });
    const btns = [['Again', P.orange, P.ink, 'again']];
    if (this.canNext) btns.push(['Next', P.cyan, P.ink, 'next']);
    btns.push(['Menu', P.slate, P.text, 'menu']);
    const bw = Math.min(140, (E.w - 32 - 16) / 3), by = y0 + 282;
    this.btns = btns.map(([label, fill, color, act], i) => {
      const x = cx + (i - (btns.length - 1) / 2) * (bw + 12);
      return { act, ...btn(E, label, x, by, { w: bw, h: 52, fill, color, size: TY.mid }) };
    });
  },
  onTap(p, E) {
    if (E.time - this.t0 < T.cardLock) return; // a tap that was meant for the last shot must not pick a button
    const b = this.btns.find((b) => E.hit(b, p));
    if (!b) return;
    E.audio.play('tap');
    if (b.act === 'again') { const g = this.p.gaunt; E.setScene('play', g && g.ok && !g.done ? { id: this.ch.id, gauntlet: g.i } : { id: this.ch.id }); } // a passed stage replayed stays in the chain
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
  saveVersion: 5,
  // Save shape: best { challengeId: { score, stars } }, gun (id), skins { gunId: skinId }, badges { badgeId: 1 }, bossGuns { gunId: 1 }, __tune, __muted.
  // v2 added the chosen gun; v3 pruned saved tune values (ADR-0014); v4 adds badges and bossGuns and awards the star-only badges
  // that the existing bests already earn; v5 adds the worn skin per gun (a skin whose badge is not earned plays as the default). Nothing else changes, and the whole save stays under a kilobyte or two.
  migrate(data, fromVersion) {
    if (typeof data.best !== 'object' || data.best === null) delete data.best;
    if (!data.gun) data.gun = 'pistol';
    if (!data.badges || typeof data.badges !== 'object') data.badges = {};
    if (!data.bossGuns || typeof data.bossGuns !== 'object') data.bossGuns = {};
    if (!data.skins || typeof data.skins !== 'object') data.skins = {};
    const b = data.best || {}, three = (id) => b[id] && b[id].stars === 3;
    for (const [badge, id] of [['marksman1', 'a1'], ['quickdraw1', 's1'], ['clay1', 'k1'], ['storm', 's4']]) if (three(id)) data.badges[badge] = 1;
    if (CHALLENGES.every((c) => three(c.id))) data.badges.legend = 1;
    if (data.__tune && typeof data.__tune === 'object') data.__tune = Object.fromEntries(Object.entries(data.__tune).filter(([k]) => TUNE_KEYS.has(k)));
    return data;
  },
  TUNING,
  init() { buildArt(); },
  experiments: EXPERIMENTS,
  presets: PRESETS,
  start: 'menu',
  scenes: { menu, play, over, missions },
};
