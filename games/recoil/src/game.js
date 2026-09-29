// Recoil, v0.4: the mechanic plus guns, barrel sway, moving targets, skeet with decoys, two bosses, and progression (four guns unlocked by
// points, thirteen badges, nine gun skins, a gauntlet). One thumb drags the gun up and down, the other fires, and every shot kicks the barrel up.
// Instant shot lines scored by zone, a combo multiplier, four ladders of five rungs (Skeet has three, Boss two), stars, points, menu and card.
// Procedural art (four gun silhouettes, paper targets, a range backdrop) from one palette in TUNING.art; no image assets.
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

  // v0.4: Boss 2 (the Bunker), Skeet 3 and the flip targets of Accuracy 5. Per-challenge numbers (plate hp, flip window, wall) are on the entries.
  plateReveal: 0.5,      // Seconds after a Bunker plate falls before the next one is revealed (two are revealed at a time)
  coreOpen: 4,           // Plates that must be down before the Bunker's core can be hurt
  decoyPenalty: 1,       // A decoy hit costs this times its zone value (a shot that hits one also breaks the combo)

  // v0.5 section A: a star bar is read off BARS at these aim noises (degrees of Gaussian error on the barrel angle): the noise that earns three stars, two, one.
  // TUNE has the three as sliders and Pro, Skilled and Casual as presets. Section D: the slow-motion last kill and the card's score ticker.
  starNoise: { three: 0.75, two: 1.5, one: 3.0 },
  starGrid: 0.25,        // Degrees between the samples of a BARS curve
  starCap: 0.95,         // A bar never exceeds this share of the perfect run, so perfect centred play always earns three stars
  starRound: 10,         // Bars are rounded to this
  slowLife: 0.4,         // Seconds of real time the last kill of a Speed or Skeet run plays in slow motion
  slowScale: 0.25,       // Game speed during it
  tickerLife: 0.9,       // Seconds the card takes to count the score up
  calloutLife: 1.0,      // Seconds a streak call-out stays on the field

  // Guns (v0.2 section A): data, so a later layer adds more. kickPerShot and kickRecovery are per gun now.
  // magSize and reloadSeconds are carried but not used yet: Accuracy keeps its own ammo, the other ladders are unlimited.
  guns: {
    pistol: { id: 'pistol', job: 'The all-rounder: clean bullseyes and long combos.', name: 'Service pistol', short: 'Pistol', damage: 1, fireRate: 9, accuracy: 1.0, kickPerShot: 8, kickRecovery: 32, magSize: 12, reloadSeconds: 1.0, auto: false },
    carbine: { id: 'carbine', job: 'Hold to fire: fast targets, hordes and clays.', name: 'Carbine', short: 'Carbine', damage: 1, fireRate: 8, accuracy: 0.55, kickPerShot: 5, kickRecovery: 24, magSize: 20, reloadSeconds: 1.5, auto: true },
    // v0.3. `pellets` lines leave the barrel in a fixed fan of shotSpread degrees; each pellet deals `damage` on its own. Only the centre
    // pellet scores zone points on ring targets; on hordes every member any pellet hits scores.
    shotgun: { id: 'shotgun', job: 'Five pellets: boss plates and hordes; hopeless at far bullseyes.', name: 'Shotgun', short: 'Shotgun', damage: 1, pellets: 5, fireRate: 2.3, accuracy: 0.4, kickPerShot: 14, kickRecovery: 30, magSize: 6, reloadSeconds: 2.0, auto: false },
    rifle: { id: 'rifle', job: 'One-shots plates; long waits and sway matter most.', name: 'Marksman rifle', short: 'Rifle', damage: 3, fireRate: 1.5, accuracy: 1.0, kickPerShot: 16, kickRecovery: 20, magSize: 5, reloadSeconds: 2.0, auto: false },
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
    // inside the silhouette, so bounds, hitbox and shots never change. Readability rule (PRD v0.3 E): every skin's steel measures at least 3:1 against the
    // sky bands (Standard is 3.8:1), so a dark skin has a light body and dark decoration. Each skin is earned by the badge named in `badge` (BADGES ids), never by points.
    // The first skin of a gun is its default. Order matters: the save keeps the id.
    skins: {
      pistol: [
        { id: 'std', name: 'Standard', badge: null, pal: {}, deco: [] },
        { id: 'nickel', name: 'Nickel', badge: 'marksman1', pal: { steel: '#cfd4da', steelDark: '#8a929c', accent: '#d6a23a' }, deco: [['rr', 'accent', 2, -7.5, 20, 7, 2], ['rr', 'ink', 5, -4.6, 14, 1.4, 0.7]] }, // engraved brass plate
        { id: 'blackout', name: 'Blackout', badge: 'quickdraw1', pal: { steel: '#7d828a', steelDark: '#5a5651', accent: '#15120f' }, deco: [['rr', 'accent', -21, -6.5, 60, 4.6, 1.4]] }, // black band on the slide
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
        { id: 'tactical', name: 'Tactical', badge: 'double', pal: { steel: '#8c9668', steelDark: '#59603f', accent: '#1f2416' }, deco: [['rr', 'accent', 0, -7, 56, 3.4, 1.2], ['rr', 'accent', 21, 7.5, 22, 2.6, 1]] }, // dark barrel stripe and pump band
      ],
      rifle: [
        { id: 'std', name: 'Standard', badge: null, pal: {}, deco: [] },
        { id: 'carbon', name: 'Carbon', badge: 'bosskiller', pal: { steel: '#858c93', steelDark: '#565c63', accent: '#1a1d22' }, deco: [['rr', 'accent', -19, -8, 30, 3.4, 1], ['rr', 'accent', -19, -2, 30, 3.4, 1]] }, // dark weave lines on the receiver
        { id: 'bronze', name: 'Bronze', badge: 'sniper', pal: { steel: '#b8834a', steelDark: '#7a542c', accent: '#e8c48a' }, deco: [['rr', 'accent', -19, -7, 18, 7, 2], ['rr', 'ink', -16, -4, 12, 1.3, 0.6]] }, // warm bronze, engraved plate on the receiver
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
    clay: { disc: 0.74, rimLine: 1.2, cross: 0.5 }, // cross: the decoy's mark, as a fraction of its radius
    flip: { time: 0.25, min: 0.08 }, // A flip target turns edge-on over its last `time` seconds (never thinner than `min`)
    plate: { shut: 0.45, r: 1.1, inner: 0.86, rivet: 2.2, glow: [1.2, 1.32], dash: 12, ring: 7, pip: 5, pipGap: 8, pipTray: 3 },
    core: { pulse: 5, glow: [7, 14], glowAlpha: [0.22, 0.12], amp: 3, spec: 0.68 },
    pip: { w: 6, h: 9, gap: 11 }, // Combo pips drawn as brass casings
    mult: { size: 24, swell: 0.5, pulse: 0.25, x: 128, dy: 50, flip: 170 }, // The multiplier beside the lane: size in design units, swell on a step, seconds it swells, where it sits, and the gun height below which it goes under the line
    intro: { y: 52, hold: 5, fade: 1.5 }, // Boss 2's "Every plate scores" line: design-space height, seconds shown, seconds to fade
    missions: { th: 104, gap: 8, rail: 44, lock: 16, lockGap: 10 }, // Missions tile height, gap, scroll rail width, the Gauntlet padlock's size and its gap to the label
    tile: { pad: 6, info: 22 }, // Gun tiles on the menu: padding round the silhouette
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
// Stars (PRD v0.5 A): the bars come from BARS, the scores of noisy bots with the challenge's `bestGun` (per gun on the bosses), read at the noise TUNE sets. The
// perfect-run score in each comment is the ceiling every bar sits under (starCap).
const CHALLENGES = [
  { // Teaches the kick: the second quick shot sails high. Perfect run 2150.
    id: 'a1', bestGun: 'pistol', ladder: 'accuracy', level: 1, name: 'Accuracy 1', seed: 41001, behaviour: 'still',
    accTargets: 8, accAmmo: 12, scale: 1.3, x: [370, 430], yBand: [0.15, 0.9], minDy: 50,
  },
  { // Teaches tip 2: nudge down as you fire. Perfect run 2950.
    id: 'a2', bestGun: 'pistol', ladder: 'accuracy', level: 2, name: 'Accuracy 2', seed: 41002, behaviour: 'still',
    accTargets: 10, accAmmo: 13, scale: 1.0, x: [300, 560], yBand: [0, 1], minDy: 70,
  },
  { // Teaches tip 5: every third target is high and the one before it low (the rest sit mid-height), so every change is at least
    // minDy and the kick can carry the barrel to the high ones. Perfect run 3750.
    id: 'a3', bestGun: 'pistol', ladder: 'accuracy', level: 3, name: 'Accuracy 3', seed: 41003, behaviour: 'still',
    accTargets: 12, accAmmo: 14, scale: 0.8, x: [520, 612], yBand: [0.35, 0.6], minDy: 70,
    high: { every: 3, band: [0, 0.2], before: [0.6, 1] },
  },
  { // Dodgers: a shot near a flickering target makes it jump, so fire once to make it jump, then again at where it landed. Perfect run 2950.
    id: 'a4', bestGun: 'pistol', ladder: 'accuracy', level: 4, name: 'Accuracy 4', seed: 41004, behaviour: 'dodge',
    accTargets: 10, accAmmo: 24, scale: 0.9, x: [400, 600], yBand: [0, 1], minDy: 70,
  },
  { // v0.4. Small far targets: the dodgers of Accuracy 4 (fire once to make it jump, then again where it landed) and every third target a flip
    // target that shows for flipWindow seconds and turns away, a miss costing nothing but the window. Tests sway control and the first shot.
    // Naked run: the pistol's kick recovery (0.25 s) is inside the window. Perfect run 3750 (twelve bullseyes). Windows by the perfect-path rule: the flip window
    // is 1.5 times the slowest flip target on a keyboard-speed perfect path (0.97 s, gun travelling at keyMoveSpeed), accLife 4 s is 2.25 times the slowest dodger (1.78 s).
    id: 'a5', bestGun: 'pistol', ladder: 'accuracy', level: 5, name: 'Accuracy 5', seed: 41005, behaviour: 'dodge', needStars: 2,
    accTargets: 12, accAmmo: 22, scale: 0.7, x: [500, 612], yBand: [0, 1], minDy: 70, accLife: 4, flipEvery: 3, flipWindow: 1.5,
  },
  { // Teaches prioritising: one target at a time. Perfect run 4150.
    id: 's1', bestGun: 'carbine', ladder: 'speed', level: 1, name: 'Speed 1', seed: 42001, behaviour: 'approach',
    speedSeconds: 25, spawnEvery: 2.0, speedMul: 1, maxTargets: 1, scale: 1.2, yBand: [0.1, 0.9], minDy: 60,
  },
  { // Perfect run 7350.
    id: 's2', bestGun: 'carbine', ladder: 'speed', level: 2, name: 'Speed 2', seed: 42002, behaviour: 'approach',
    speedSeconds: 30, spawnEvery: 1.4, speedMul: 4 / 3, maxTargets: 2, scale: 1.0, yBand: [0, 1], minDy: 80,
  },
  { // Weavers: every target oscillates, so the line has to keep chasing it. The band leaves room for the weave and
    // is only 106 tall, so minDy is 50, the most it allows. Perfect run 12950.
    id: 's3', bestGun: 'carbine', ladder: 'speed', level: 3, name: 'Speed 3', seed: 42003, behaviour: 'weave',
    speedSeconds: 35, spawnEvery: 1.0, speedMul: 5 / 3, maxTargets: 3, scale: 0.9, yBand: [0.22, 0.78], minDy: 50,
  },
  { // Hordes: a column of small targets drifting left, each worth outer-ring points. Perfect run 3630.
    id: 's4', bestGun: 'carbine', ladder: 'speed', level: 4, name: 'Speed 4', seed: 42004, behaviour: 'horde',
    speedSeconds: 35, spawnEvery: 4.5, speedMul: 0.7, maxTargets: 12, scale: 0.55, yBand: [0, 1], minDy: 60,
    hordeSpacing: 30, hordeJitterX: 16, hordeJitterY: 3, // column spacing, and how loose the column is (x and y)
  },
  { // v0.4. Two hordes back to back with a weaving pair between them, twice, on a tighter clock than Speed 4. Burst discipline: the fire interval is
    // under the kick recovery, so holding fire climbs off the column. Naked run: every member is worth outer points, the pair can be left alone at a cost
    // of the combo only. Perfect run 3310 (28 hits, last kill 18.34 s); the timer is that rounded up to a multiple of 5 like Speed 1 to 4 (20 s against Speed 4's 35).
    id: 's5', bestGun: 'carbine', ladder: 'speed', level: 5, name: 'Speed 5', seed: 42005, behaviour: 'horde', needStars: 2,
    speedSeconds: 20, speedMul: 0.8, maxTargets: 16, scale: 0.55, yBand: [0, 1], minDy: 60,
    hordeSpacing: 30, hordeJitterX: 16, hordeJitterY: 3, pairScale: 0.9, pairMul: 1.4, pairBand: [0.2, 0.8], pairGap: 70,
    waves: [{ at: 0.6, horde: true }, { at: 3.6, pair: true }, { at: 6.6, horde: true }, { at: 11.6, horde: true }, { at: 14.6, pair: true }, { at: 17.6, horde: true }],
  },
  { // Clay pigeons from the bottom right; only bullseye and inner count. Perfect run 2950.
    id: 'k1', bestGun: 'pistol', ladder: 'skeet', level: 1, name: 'Skeet 1', seed: 43001,
    skeetCount: 10, skeetEvery: 2.4, skeetMul: 0.9, pair: false, angle: [58, 68], launchSpread: 30, scale: 1.2,
  },
  { // Two at once. Perfect run 3750.
    id: 'k2', bestGun: 'pistol', ladder: 'skeet', level: 2, name: 'Skeet 2', seed: 43002,
    skeetCount: 12, skeetEvery: 2.6, skeetMul: 1.0, pair: true, angle: [56, 66], pairSplit: 0.4, pairDx: 46, scale: 1.0, // the pair's angles come from the low and high 40 percent of the range; the second launches pairDx to the left
  },
  { // v0.4. Three launches a volley from alternating sides, one of them a decoy in the player's orange: shot, it costs its zone value and the combo.
    // Goal clays stay cyan. Tests target discrimination under speed. Naked run: leave the decoy, shoot the two cyan ones. Perfect run 2950 (ten bullseyes on the goal clays).
    // The 0.6 s between launches is 1.5 times the 0.4 s a keyboard-speed perfect path needs to switch clays (at 0.3 s it drops one). The left station sits mid-field
    // (leftX) and lobs steeply toward the wall, so no clay is launched near the gun; every clay is smaller than Skeet 2's (0.75), so the angle that hits a bullseye is
    // about Skeet 2's from the left station (4.5 units at 360, against 6 at 512) and tighter from the right (4.5 at 515), and a bot at 1 and 2 degrees does no better here.
    id: 'k3', bestGun: 'pistol', ladder: 'skeet', level: 3, name: 'Skeet 3', seed: 43003, needStars: 2,
    skeetEvery: 4.0, volleys: 5, volley: 3, volleyGap: 0.6, skeetMul: 1.0, angle: [56, 66], launchSpread: 30, leftX: 430, leftAngle: [64, 68], scale: 0.75,
  },
  { // Three parts in order, then a drifting core. Perfect run 3750.
    id: 'b1', ladder: 'boss', level: 1, name: 'Boss 1', seed: 44001,
    bossSeconds: 40, scale: 1.1, x: [430, 560], coreX: 520, coreScale: 0.9, coreBull: 0.6,
    // Perfect centred runs: pistol and carbine 3750 (twelve one-damage bullseyes), rifle and shotgun 1000 (five bullseyes: a centred shotgun shot kills a plate, and two kill the core).
  },
  { // v0.4, "the Bunker": a wall of six 3-hp plates, each in a bolted frame, two revealed at a time in a seeded order (the next one plateReveal seconds after a
    // plate falls); behind them a core that cannot be hurt until coreOpen plates are down. Tests damage per shot: the rifle one-shots a plate, the pistol needs
    // three centred hits, the shotgun its centre pellet plus two outers on the same plate. Naked run: the pistol clears it with 27 bullseyes.
    // Perfect centred runs (searched, then replayed in the sim): pistol and carbine 9750 (27 bullseyes: six plates of three, then the core's nine), shotgun 4950 (15),
    // rifle 2550 (9). bossSeconds is 1.6 times the slowest gun's keyboard-speed perfect path (the pistol's 14.9 s), rounded up.
    id: 'b2', ladder: 'boss', level: 2, name: 'Boss 2', seed: 44002, needStars: 2, needGun: 'rifle',
    bossSeconds: 24, scale: 0.85, plateHp: 3, startReveal: 2,
    wall: [[430, 80], [350, 116], [495, 153], [385, 189], [465, 226], [350, 262]], // plate positions: no two share a height band, so a level shot at any plate never crosses another
    coreX: 585, coreBand: [145, 205], coreScale: 0.9, coreBull: 0.6, coreHp: 9, coreDrift: 35,
  },
];

// Star bars (PRD v0.5 A): for each challenge, the noisy bot's scores by aim noise. `m` is the mean score and `q` the 25th percentile, over 100 seeds of a bot whose
// every shot's barrel angle is off by a Gaussian of sigma degrees, sigma from 0 to 5 in steps of starGrid (index 0 is the perfect run). The gun is the challenge's `bestGun`
// (per gun on the bosses). Generated by the harness described in the changelog; a bar is read off these curves at the active noise (TUNE), so a slider needs no re-run.
const BARS = {
  a1: {
    pistol: { m: [2150, 2150, 2133, 2041, 1925, 1796, 1688, 1601, 1477, 1366, 1242, 1152, 1082, 1035, 980, 919, 877, 811, 775, 730, 697],
      q: [2150, 2150, 2150, 1950, 1850, 1675, 1525, 1445, 1270, 1170, 995, 885, 835, 780, 760, 710, 690, 610, 585, 550, 540] },
  },
  a2: {
    pistol: { m: [2950, 2949, 2802, 2585, 2365, 2122, 1919, 1722, 1549, 1401, 1244, 1137, 1046, 958, 871, 802, 735, 665, 613, 579, 532],
      q: [2950, 2950, 2750, 2425, 2195, 1885, 1645, 1390, 1215, 1095, 945, 835, 775, 650, 575, 500, 485, 435, 390, 380, 340] },
  },
  a3: {
    pistol: { m: [3750, 3690, 3248, 2816, 2373, 1956, 1564, 1246, 1023, 845, 718, 604, 520, 437, 404, 346, 282, 250, 228, 198, 189],
      q: [3750, 3650, 3100, 2605, 2075, 1660, 1205, 935, 675, 550, 475, 380, 315, 240, 215, 120, 100, 50, 50, 20, 20] },
  },
  a4: {
    pistol: { m: [2950, 2938, 2514, 1918, 1592, 1346, 1123, 926, 767, 645, 550, 456, 398, 309, 264, 225, 194, 155, 136, 114, 106],
      q: [2950, 2950, 2150, 1570, 1225, 1075, 845, 700, 580, 445, 340, 270, 240, 140, 90, 40, 20, 20, 0, 0, 0] },
  },
  a5: {
    pistol: { m: [3750, 3639, 2835, 2046, 1523, 1159, 861, 658, 507, 390, 306, 262, 219, 183, 147, 133, 109, 97, 86, 79, 71],
      q: [3750, 3550, 2545, 1650, 1100, 795, 575, 410, 300, 220, 175, 120, 70, 80, 50, 20, 0, 20, 0, 0, 0] },
  },
  s1: {
    carbine: { m: [4150, 4147, 3909, 3517, 3175, 2801, 2443, 2130, 1869, 1639, 1478, 1330, 1228, 1170, 1096, 1053, 998, 979, 961, 942, 906],
      q: [4150, 4150, 3800, 3350, 2985, 2555, 2125, 1690, 1525, 1315, 1215, 1090, 1010, 990, 930, 910, 845, 825, 790, 780, 770] },
  },
  s2: {
    carbine: { m: [7350, 7318, 6565, 5745, 5017, 4239, 3605, 3065, 2630, 2340, 2154, 1987, 1870, 1773, 1685, 1636, 1556, 1489, 1439, 1391, 1338],
      q: [7350, 7350, 6350, 5460, 4595, 3825, 3195, 2590, 2215, 2025, 1860, 1690, 1620, 1525, 1450, 1380, 1355, 1265, 1205, 1175, 1120] },
  },
  s3: {
    carbine: { m: [12950, 12817, 11275, 9763, 8233, 6790, 5593, 4646, 3966, 3497, 3213, 2981, 2813, 2654, 2565, 2440, 2318, 2248, 2139, 2045, 1993],
      q: [12950, 12750, 10900, 9365, 7720, 6185, 4875, 4005, 3460, 3155, 2845, 2650, 2535, 2360, 2275, 2190, 2020, 1970, 1845, 1735, 1745] },
  },
  s4: {
    carbine: { m: [3630, 3630, 3597, 3145, 2611, 2222, 1984, 1820, 1649, 1539, 1481, 1377, 1344, 1262, 1240, 1229, 1199, 1207, 1194, 1203, 1215],
      q: [3630, 3630, 3630, 3000, 2380, 2000, 1760, 1660, 1520, 1410, 1350, 1290, 1230, 1140, 1110, 1130, 1110, 1140, 1120, 1140, 1140] },
  },
  s5: {
    carbine: { m: [3310, 3290, 3042, 2596, 2092, 1776, 1497, 1360, 1188, 1040, 969, 932, 863, 833, 810, 786, 774, 770, 767, 756, 761],
      q: [3310, 3310, 2910, 2350, 1715, 1520, 1260, 1190, 1015, 895, 840, 775, 755, 750, 710, 710, 710, 690, 700, 700, 680] },
  },
  k1: {
    pistol: { m: [2950, 2949, 2791, 2447, 2104, 1782, 1519, 1350, 1249, 1155, 1095, 1047, 1015, 993, 959, 942, 925, 919, 904, 903, 894],
      q: [2950, 2950, 2700, 2275, 1725, 1400, 1250, 1075, 1000, 975, 925, 900, 825, 850, 850, 825, 825, 825, 800, 800, 800] },
  },
  k2: {
    pistol: { m: [3750, 3738, 3394, 2832, 2253, 1861, 1613, 1440, 1334, 1258, 1204, 1170, 1144, 1126, 1118, 1105, 1069, 1052, 1045, 1034, 1028],
      q: [3750, 3750, 3275, 2475, 1850, 1500, 1300, 1225, 1100, 1075, 1050, 1025, 1025, 1000, 975, 975, 950, 950, 950, 925, 925] },
  },
  k3: {
    pistol: { m: [2950, 2915, 2523, 2036, 1616, 1356, 1190, 1084, 992, 966, 939, 872, 817, 800, 778, 754, 713, 709, 712, 688, 665],
      q: [2950, 2950, 2350, 1700, 1275, 1075, 975, 875, 850, 825, 775, 775, 700, 700, 650, 675, 625, 600, 600, 575, 575] },
  },
  b1: {
    pistol: { m: [3750, 3577, 2961, 2448, 1984, 1580, 1222, 962, 831, 790, 772, 745, 736, 738, 699, 698, 650, 558, 443, 349, 295],
      q: [3750, 3550, 2775, 2260, 1790, 1330, 1015, 830, 720, 660, 640, 610, 585, 575, 535, 570, 500, 400, 205, 140, 140] },
    carbine: { m: [3750, 3591, 3011, 2605, 2285, 1955, 1644, 1396, 1218, 1089, 975, 909, 850, 810, 762, 724, 678, 607, 523, 460, 410],
      q: [3750, 3550, 2800, 2430, 2125, 1715, 1385, 1165, 950, 805, 695, 675, 630, 630, 605, 570, 555, 490, 290, 235, 225] },
    shotgun: { m: [1000, 1138, 1120, 1006, 911, 814, 692, 605, 535, 489, 428, 387, 351, 333, 308, 293, 285, 269, 253, 242, 233],
      q: [1000, 1000, 1000, 900, 800, 690, 525, 405, 355, 325, 295, 245, 215, 200, 190, 160, 170, 145, 140, 120, 120] },
    rifle: { m: [1000, 955, 863, 764, 695, 636, 586, 540, 496, 472, 442, 409, 388, 380, 364, 347, 342, 326, 315, 297, 269],
      q: [1000, 875, 775, 700, 600, 525, 475, 415, 390, 360, 350, 315, 305, 300, 275, 265, 260, 235, 225, 190, 160] },
  },
  b2: {
    pistol: { m: [9750, 9481, 8637, 7790, 6972, 6210, 5573, 4967, 4543, 4133, 3883, 3671, 3515, 3352, 3217, 3096, 3016, 2983, 2848, 2763, 2631],
      q: [9750, 9350, 8400, 7500, 6570, 5805, 5085, 4455, 4055, 3680, 3465, 3245, 3035, 2970, 2850, 2670, 2705, 2505, 2430, 2395, 2215] },
    carbine: { m: [9750, 9481, 8637, 7786, 6971, 6205, 5575, 4956, 4521, 4109, 3829, 3635, 3418, 3236, 3095, 3017, 2923, 2911, 2843, 2801, 2664],
      q: [9750, 9350, 8400, 7500, 6570, 5805, 5085, 4455, 4050, 3665, 3380, 3125, 2945, 2750, 2740, 2675, 2575, 2515, 2415, 2350, 2300] },
    shotgun: { m: [4550, 3268, 2995, 2668, 2400, 2075, 1804, 1543, 1385, 1249, 1114, 996, 881, 807, 729, 690, 669, 635, 599, 563, 533],
      q: [4550, 2950, 2750, 2385, 2075, 1790, 1465, 1165, 1035, 890, 815, 695, 600, 565, 505, 485, 470, 455, 400, 385, 395] },
    rifle: { m: [2550, 2454, 2190, 1949, 1747, 1580, 1402, 1225, 1135, 1045, 993, 925, 880, 851, 825, 800, 773, 745, 735, 730, 695],
      q: [2550, 2350, 2075, 1800, 1555, 1365, 1170, 990, 960, 810, 775, 740, 685, 645, 645, 610, 610, 600, 565, 550, 530] },
  },
};

const BAR_CACHE = {}; // by challenge and gun, rebuilt when the noise sliders move
function curveAt(a, x) { const f = clamp(x / T.starGrid, 0, a.length - 1), i = Math.min(a.length - 2, Math.floor(f)); return a[i] + (a[i + 1] - a[i]) * (f - i); }
// The bars {one, two, three} of a challenge for a gun: the mean score of the bot at the three-star and two-star noise, and the 25th percentile at the one-star noise
// (the mean of a skewed score is beaten by fewer than half the bots, and most of the one-star bots must earn the first star), each capped at starCap of the perfect run.
function thresholds(ch, gun) {
  const N = T.starNoise, sig = N.three * 1e4 + N.two * 100 + N.one, g = ch.ladder === 'boss' ? gun : ch.bestGun, by = BARS[ch.id], key = by[g] ? g : 'pistol';
  const C = BAR_CACHE[ch.id] || (BAR_CACHE[ch.id] = {}), hit = C[key];
  if (hit && hit.sig === sig) return hit.b;
  const c = by[key], cap = T.starCap * c.m[0], R = T.starRound, r = (x) => Math.round(Math.min(x, cap) / R) * R;
  const three = r(curveAt(c.m, N.three)), two = Math.min(r(curveAt(c.m, N.two)), three - R), one = Math.min(r(curveAt(c.q, N.one)), two - R);
  const b = { one: Math.max(R, one), two: Math.max(2 * R, two), three: Math.max(3 * R, three) };
  C[key] = { sig, b };
  return b;
}
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
      b.push({ x, y, bits: Array.from({ length: 8 }, () => rng() < 0.5), flip: !!ch.flipEvery && (i + 1) % ch.flipEvery === 0 });
      prev = y;
    }
  } else if (ch.ladder === 'speed') {
    const n = ch.waves ? ch.waves.length : Math.ceil(ch.speedSeconds / ch.spawnEvery) + 2;
    b = [];
    let prev = null;
    if (ch.waves) { // a scripted sequence: each wave is a horde or a weaving pair, spawned at its own time
      const sp = ch.hordeSpacing, jy = ch.hordeJitterY, span = (T.hordeCount - 1) * sp, lh = { y0: lg.y0 + span / 2 + jy, y1: lg.y1 - span / 2 - jy }, lp = legal(ch.pairScale);
      for (const w of ch.waves) {
        if (w.horde) {
          const cy = pickY(rng, lh, ch.yBand, prev, ch.minDy);
          b.push({ at: w.at, members: Array.from({ length: T.hordeCount }, (_, k) => ({ dx: -rng.range(0, ch.hordeJitterX), y: cy - span / 2 + k * sp + rng.range(-jy, jy) })) });
          prev = cy;
        } else {
          const cy = pickY(rng, lp, ch.pairBand, prev, ch.minDy);
          b.push({ at: w.at, pair: [{ y: cy - ch.pairGap / 2, phase: 0 }, { y: cy + ch.pairGap / 2, phase: Math.PI }] });
          prev = cy;
        }
      }
    } else if (ch.behaviour === 'horde') {
      const sp = ch.hordeSpacing, jy = ch.hordeJitterY, span = (T.hordeCount - 1) * sp, lh = { y0: lg.y0 + span / 2 + jy, y1: lg.y1 - span / 2 - jy };
      for (let i = 0; i < n; i++) {
        const cy = pickY(rng, lh, ch.yBand, prev, ch.minDy);
        b.push({ members: Array.from({ length: T.hordeCount }, (_, k) => ({ dx: -rng.range(0, ch.hordeJitterX), y: cy - span / 2 + k * sp + rng.range(-jy, jy) })) });
        prev = cy;
      }
    } else {
      for (let i = 0; i < n; i++) { const y = pickY(rng, lg, ch.yBand, prev, ch.minDy); b.push({ y }); prev = y; }
    }
  } else if (ch.ladder === 'skeet' && ch.volley) { // volleys of `volley` launches from alternating sides, one of them a decoy
    b = [];
    const [lo, hi] = ch.angle;
    for (let v = 0; v < ch.volleys; v++) {
      const decoy = Math.floor(rng() * ch.volley);
      for (let j = 0; j < ch.volley; j++) {
        const side = (v * ch.volley + j) % 2 ? 'L' : 'R';
        const left = side === 'L'; // the left station sits mid-field and lobs steeply toward the wall, so no clay is launched close to the gun
        b.push({ at: T.startDelay + v * ch.skeetEvery + j * ch.volleyGap, a: left ? rng.range(...ch.leftAngle) : rng.range(lo, hi), side, decoy: j === decoy, x0: left ? ch.leftX + rng.range(0, ch.launchSpread) : lg.x1 - rng.range(0, ch.launchSpread) });
      }
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
  } else if (ch.wall) { // the Bunker: plates in the order they are revealed, and a core behind them
    b = {
      parts: rng.shuffle(ch.wall.map((_, i) => i)).map((k) => ({ x: ch.wall[k][0], y: ch.wall[k][1] })),
      core: { x: ch.coreX, y: rng.range(ch.coreBand[0], ch.coreBand[1]), dir: rng() < 0.5 ? 1 : -1 },
    };
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
    decoyHits: 0, down: 0, revealed: 0, revealQ: [],
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
    case 'weave': o.x = tg.x0 - tg.v * u; o.y = clamp(tg.y0 + tg.amp * Math.sin(2 * Math.PI * u / tg.period + (tg.phase || 0)), tg.ymin, tg.ymax); break;
    case 'skeet': o.x = tg.x0 + tg.vx * u; o.y = tg.y0 + tg.vy * u + 0.5 * tg.g * u * u; break;
    case 'core': {
      const len = tg.ymax - tg.ymin, m = (((tg.y0 - tg.ymin + tg.dir * (tg.drift || T.bossCoreDrift) * u) % (2 * len)) + 2 * len) % (2 * len);
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
  const ch = run.ch, p = run.list[run.idx++], lg = legal(ch.scale), life = p.flip ? ch.flipWindow : ch.accLife || T.accLife; // a flip target shows for a short window, then turns away
  addTarget(run, {
    kind: ch.behaviour === 'dodge' && !p.flip ? 'dodge' : 'still', x0: p.x, y0: p.y, sc: ch.scale, life, lifeMax: life, flip: p.flip,
    bits: p.bits, dodges: 0, nextDodge: t, ymin: lg.y0, ymax: lg.y1,
  }, t);
}

function spawnSpeed(run, t) {
  const ch = run.ch, e = run.list[run.idx++], lg = legal(ch.scale), v = T.approachSpeed * ch.speedMul;
  if (e.members) {
    for (const m of e.members) addTarget(run, { kind: 'horde', x0: lg.x1 + m.dx, y0: m.y, v, sc: ch.scale, flat: true }, t);
  } else if (e.pair) {
    const lp = legal(ch.pairScale);
    for (const m of e.pair) addTarget(run, { kind: 'weave', x0: lp.x1, y0: m.y, v: T.approachSpeed * ch.pairMul, sc: ch.pairScale, amp: T.weaveAmp, period: T.weavePeriod, phase: m.phase, ymin: lp.y0, ymax: lp.y1 }, t);
  } else {
    addTarget(run, { kind: ch.behaviour, x0: lg.x1, y0: e.y, v, sc: ch.scale, amp: T.weaveAmp, period: T.weavePeriod, ymin: lg.y0, ymax: lg.y1 }, t);
  }
}

function spawnSkeet(run, t) {
  const ch = run.ch, e = run.list[run.idx++], lg = legal(ch.scale), v = T.skeetSpeed * ch.skeetMul, g = T.skeetGravity;
  const a = Math.min(e.a * DEG, Math.asin(Math.min(1, Math.sqrt(2 * g * (lg.y1 - lg.y0)) / v))); // apex stays on the field
  addTarget(run, { kind: 'skeet', x0: e.x0, y0: lg.y1, vx: (e.side === 'L' ? 1 : -1) * v * Math.cos(a), vy: -v * Math.sin(a), g, sc: ch.scale, group: ch.pair ? (run.idx - 1) >> 1 : undefined, decoy: !!e.decoy }, t);
}

function spawnBoss(run, t) {
  const ch = run.ch, hp = ch.plateHp || T.bossPartHp;
  run.list.parts.forEach((p, i) => addTarget(run, { kind: 'part', x0: p.x, y0: p.y, sc: ch.scale, hp, hpMax: hp, idx: i }, t));
  if (ch.wall) { // the Bunker's core stands behind the wall from the start, shielded until enough plates are down
    const c = run.list.core;
    addTarget(run, { kind: 'core', x0: c.x, y0: c.y, sc: ch.coreScale, bullMul: ch.coreBull, hp: ch.coreHp, hpMax: ch.coreHp, dir: c.dir, ymin: ch.coreBand[0], ymax: ch.coreBand[1], drift: ch.coreDrift }, t);
    run.revealed = ch.startReveal;
  }
}
// A boss plate can be hurt while active: the current one in a sequence (Boss 1), or any revealed one in the Bunker. The Bunker's core is shielded until coreOpen plates are down.
function partActive(run, tg) { return run.ch.wall ? tg.idx < run.revealed : tg.idx === run.stage; }
function coreShielded(run) { return !!run.ch.wall && run.down < T.coreOpen; }

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
const FANS = {}; // per gun, built once
function fanOffsets(g) {
  const n = g.pellets || 1;
  return FANS[g.id] || (FANS[g.id] = Array.from({ length: n }, (_, i) => (n > 1 ? T.shotSpread * (i / (n - 1) - 0.5) : 0)));
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
    return { tg, perp, x1: gx + l.cs * len, y1: gy - l.sn * len, neutral: !!tg && ((tg.kind === 'part' && !partActive(run, tg)) || (tg.kind === 'core' && coreShielded(run))) };
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
  const decoy = [...scored].find(([tg]) => tg.decoy);
  if (decoy) { // a decoy hit costs its zone value and breaks the combo; it is no hit and no miss
    const pts = -Math.round(T.zonePoints[decoy[1]] * T.decoyPenalty);
    run.score = Math.max(0, run.score + pts); run.streak = 0; run.decoyHits++;
    Object.assign(ev, { decoy: true, tx: decoy[0].x, ty: decoy[0].y, pts, streak: 0, hit: false });
  } else if (scored.size) {
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
    if (tg.kind === 'part' && run.ch.wall) { run.down++; if (run.revealed + run.revealQ.length < run.list.parts.length) run.revealQ.push(now + T.plateReveal); }
    else if (tg.kind === 'part') { run.stage++; if (run.stage >= run.list.parts.length) spawnCore(run, now); }
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
      run.targets.length = 0;
      if (!tg.flip) { run.streak = 0; run.misses++; } // a flip target that turns away costs nothing but its window
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
  if (run.idx < run.list.length) {
    const e = run.list[run.idx], n = e.members ? e.members.length : e.pair ? e.pair.length : 1;
    if ((e.at !== undefined ? t >= e.at : t >= run.nextAt) && run.targets.length + n <= ch.maxTargets) { spawnSpeed(run, t); if (e.at === undefined) run.nextAt = t + ch.spawnEvery; }
  } else if (ch.waves && !run.targets.length) finish(run); // a scripted sequence ends when its last wave is gone
}

function stepSkeet(run, t) {
  for (let i = run.targets.length - 1; i >= 0; i--) {
    const tg = run.targets[i], u = t - tg.born;
    if (u >= -2 * tg.vy / tg.g || tg.x <= T.gunLineX || tg.x >= T.designW - T.targetEdge) {
      run.targets.splice(i, 1);
      if (!tg.decoy) { run.streak = 0; run.misses++; } // a decoy left alone costs nothing
      run.events.push({ type: 'expire', x: tg.x, y: tg.y });
    }
  }
  while (run.idx < run.list.length && run.list[run.idx].at <= t + 1e-9) spawnSkeet(run, t);
  if (run.idx >= run.list.length && !run.targets.length) finish(run);
}

function stepBoss(run, t) {
  if (run.idx === 0 && t >= T.startDelay) { spawnBoss(run, t); run.idx = 1; }
  while (run.revealQ.length && t >= run.revealQ[0] - 1e-9) { run.revealQ.shift(); run.revealed++; }
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

function starsFor(ch, score, gun) { const t = thresholds(ch, gun); return score >= t.three ? 3 : score >= t.two ? 2 : score >= t.one ? 1 : 0; }
function presetName() { const p = PRESETS.find((q) => q.group === 'stars' && Object.entries(q.values).every(([k, v]) => Math.abs(getPath(k) - v) < 1e-9)); return p ? p.label : 'Custom'; }

// ---------- Save ----------

function bests(E) { const b = E.save.get('best', {}); return b && typeof b === 'object' ? b : {}; }
// Stars shown for a saved best: the stars saved, or what its score earns against the bars now if that is more (never fewer: saved stars are never revoked). A boss
// best does not say which gun set it, so it is read against the pistol's bars, the hardest.
function starsOf(E, ch) { const b = bests(E)[ch.id]; return b ? Math.max(b.stars || 0, starsFor(ch, b.score || 0, 'pistol')) : 0; }
function isUnlocked(E, ch) {
  if (ch.level === 1) return true;
  const prev = CHALLENGES.find((c) => c.ladder === ch.ladder && c.level === ch.level - 1);
  return starsOf(E, prev) >= (ch.needStars || T.unlockStars) && (!ch.needGun || gunUnlocked(E, ch.needGun));
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
  { id: 'marksman2', tier: 'Silver', name: 'Marksman II', cond: 'Three stars on Accuracy 5' },
  { id: 'quickdraw2', tier: 'Silver', name: 'Quick Draw II', cond: 'Three stars on Speed 5' },
  { id: 'clay2', tier: 'Silver', name: 'Clay II', cond: 'Skeet 3, no decoy hit, three stars' },
  { id: 'sprint', tier: 'Silver', name: "Marksman's Sprint", cond: 'Rifle on Speed 3, two stars' }, // Wrong Tool: the gun a challenge was not made for; each unlocks only its badge
  { id: 'scatter', tier: 'Silver', name: 'Scatter Precision', cond: 'Shotgun on Accuracy 2, two stars' },
  { id: 'sidearm', tier: 'Silver', name: 'Sidearm Only', cond: 'Pistol on Boss 2, two stars' },
  { id: 'claycarbine', tier: 'Silver', name: 'Clay Carbine', cond: 'Carbine on Skeet 2, three stars' },
  { id: 'bosskiller', tier: 'Gold', name: 'Boss Killer', cond: 'Boss 1 three stars, every gun' },
  { id: 'gauntlet', tier: 'Gold', name: 'Gauntlet', cond: 'A2, S2, K2, B1 in a row, two stars each' },
  { id: 'legend', tier: 'Gold', name: 'Legend', cond: 'Three stars on every challenge' },
  { id: 'sniper', tier: 'Gold', name: 'Sniper', cond: 'Boss 2, three stars, rifle' },
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
    marksman2: id === 'a5' && three,
    sprint: id === 's3' && o.gun === 'rifle' && o.stars >= 2,
    scatter: id === 'a2' && o.gun === 'shotgun' && o.stars >= 2,
    sidearm: id === 'b2' && o.gun === 'pistol' && o.stars >= 2,
    claycarbine: id === 'k2' && o.gun === 'carbine' && three,
    quickdraw2: id === 's5' && three,
    clay2: id === 'k3' && three && !o.decoyHits,
    sniper: id === 'b2' && three && o.gun === 'rifle',
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
const GUN_ART = {}, RAMP = []; // GUN_ART[gun][skin]
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
const K_CARD = 1e6, K_FLAT = 2e6, K_CLAY = 3e6, K_PLATE = 4e6, K_CORE = 5e6, K_GUN = 6e6, K_DECOY = 7e6, K_FRAME = 8e6;

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
// GUN_ART[gun][skin], 'std' the default. The tile scale comes from the default skins.
function buildArt() {
  if (FLASH) return;
  let w = 0, h = 0;
  GUN_IDS.forEach((id, gi) => {
    A.skins[id].forEach((skin, si) => {
      const art = buildGun(id, skin, gi * SKIN_SLOTS + si);
      (GUN_ART[id] || (GUN_ART[id] = {}))[skin.id] = art;
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
function gunArt(id, skin) { if (!FLASH) buildArt(); const g = GUN_ART[id] || GUN_ART.pistol; return g[skin] || g.std; }

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
// A decoy (Skeet 3) is the same clay in the player's orange with a dark cross where the bullseye would be: shape as well as colour tells it from a goal clay.
function paintClay(g, sc) { drawClay(g, 0, 0, sc, false); }
function paintDecoy(g, sc) { drawClay(g, 0, 0, sc, true); }
function drawClay(ctx, x, y, sc, decoy) {
  const C = A.clay, r = T.zoneR[1] * sc;
  ctx.lineJoin = 'round';
  disc(ctx, x + A.shadowX, y + A.shadowY, r, P.shadow);
  ctx.fillStyle = decoy ? P.orange : P.cyan; ctx.strokeStyle = P.ink; ctx.lineWidth = A.line * Math.min(1, sc + 0.3);
  ctx.beginPath(); ctx.arc(x, y, r, 0, PI2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = P.inkSoft; ctx.lineWidth = C.rimLine; ringDisc(ctx, x, y, r * C.disc, decoy ? P.orangeLight : P.paper);
  ctx.strokeStyle = P.highlight; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r * 0.6, Math.PI * 1.05, Math.PI * 1.45); ctx.stroke();
  if (decoy) {
    const k = r * C.cross; ctx.strokeStyle = P.ink; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - k, y - k); ctx.lineTo(x + k, y + k); ctx.moveTo(x + k, y - k); ctx.lineTo(x - k, y + k); ctx.stroke(); ctx.lineCap = 'butt';
  } else { ctx.lineWidth = 1; ctx.strokeStyle = P.inkSoft; ringDisc(ctx, x, y, T.zoneR[0] * sc, P.white); }
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
// A Bunker plate that is not revealed yet: its bolted frame, empty and dark, shutters across. Shots at it are neutral.
function paintFrame(g, sc) {
  const B = A.plate, pr = T.zoneR[2] * sc * B.r;
  g.lineJoin = 'round';
  g.fillStyle = P.shadow; octagon(g, A.shadowX, A.shadowY, pr); g.fill();
  g.fillStyle = P.steelDark; g.strokeStyle = P.ink; g.lineWidth = A.line; octagon(g, 0, 0, pr); g.fill(); g.stroke();
  g.fillStyle = P.ink; octagon(g, 0, 0, pr * B.inner); g.fill();
  g.fillStyle = P.panel; for (let k = -1; k <= 1; k++) g.fillRect(-pr * 0.6, k * pr * 0.32 - 1.5, pr * 1.2, 3);
  g.strokeStyle = P.ink; g.lineWidth = 1.2;
  for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + (k * Math.PI) / 2; disc(g, Math.cos(a) * pr * 0.905, Math.sin(a) * pr * 0.905, B.rivet * Math.min(1, sc + 0.2), P.steelLight); g.stroke(); }
}
function drawPlate(ctx, tg, active, time, closed) {
  const B = A.plate, pr = T.zoneR[2] * tg.sc * B.r, x = tg.x, y = tg.y;
  if (closed) { drawSprite(ctx, K_FRAME + Math.round(tg.sc * 100), pr * B.glow[1] + 6, paintFrame, x, y, tg.sc, 0); return; }
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
  const turn = tg.flip && tg.life < A.flip.time; // a flip target turns edge-on as its window closes
  if (turn) { ctx.save(); ctx.translate(tg.x, 0); ctx.scale(Math.max(A.flip.min, tg.life / A.flip.time), 1); ctx.translate(-tg.x, 0); }
  switch (tg.kind) {
    case 'skeet': drawSprite(ctx, (tg.decoy ? K_DECOY : K_CLAY) + Math.round(sc * 100), T.zoneR[1] * sc + 6, tg.decoy ? paintDecoy : paintClay, tg.x, tg.y, sc, 0); break;
    case 'core': {
      const shut = coreShielded(run); // the Bunker's core is dimmed and padlocked until enough plates are down
      if (shut) ctx.globalAlpha = alpha * A.plate.shut;
      drawCore(ctx, tg, E.time);
      if (shut) { ctx.globalAlpha = 1; drawLock(ctx, tg.x, tg.y, P.text); }
      break;
    }
    case 'part': { const on = partActive(run, tg); drawPlate(ctx, tg, on, E.time, !on && !!ch.wall); break; }
    case 'horde':
      drawSprite(ctx, K_FLAT + Math.round(sc * 100), half + 6, paintCard, tg.x, tg.y, sc, true); break;
    case 'approach': case 'weave':
      drawTrolley(ctx, tg.x, tg.y, half, sc, tg.kind === 'approach'); drawSprite(ctx, K_CARD + Math.round(sc * 100), half + 6, paintCard, tg.x, tg.y, sc, false); break;
    default: // still and dodge cards on a post
      drawPost(ctx, tg.x, tg.y + half); drawSprite(ctx, K_CARD + Math.round(sc * 100), half + 6, paintCard, tg.x, tg.y, sc, false);
  }
  if (ch.ladder === 'accuracy') { // time left, as a ring round the card (cyan on a flip target, which has a short window)
    const C = A.card, rr = half * C.timerK + C.timerGap, end = -Math.PI / 2 + PI2 * clamp(tg.life / tg.lifeMax, 0, 1);
    ctx.lineCap = 'round';
    ctx.strokeStyle = P.ink; ctx.lineWidth = C.timerWidth + 2; ctx.beginPath(); ctx.arc(tg.x, tg.y, rr, -Math.PI / 2, end); ctx.stroke();
    ctx.strokeStyle = tg.flip ? P.cyan : P.paperShade; ctx.lineWidth = C.timerWidth; ctx.beginPath(); ctx.arc(tg.x, tg.y, rr, -Math.PI / 2, end); ctx.stroke();
    ctx.lineCap = 'butt';
  }
  if (turn) ctx.restore();
  ctx.globalAlpha = 1;
}

// Hit points are a second pass so no neighbouring plate covers them.
function drawTargetHp(ctx, tg, alpha) {
  if (tg.hp === undefined) return;
  const R2 = T.zoneR[2] * tg.sc;
  ctx.globalAlpha = alpha; drawHp(ctx, tg.x, tg.y + (tg.kind === 'core' ? R2 + A.core.glow[0] + 2 : R2 * A.plate.r) + 6, tg.hp, tg.hpMax); ctx.globalAlpha = 1;
}

// The combo multiplier beside the lane: big, at the muzzle end of the range finder (below it when the gun is high, above when low, so the HUD is never under it),
// dim at x1, orange while the streak lives, lighter at the cap, and it swells for a moment on every step. It draws the combo that already exists.
function drawMult(ctx, run) {
  const mult = Math.min(T.comboCap, 1 + T.comboStep * run.streak), live = run.streak > 0, pulse = clamp(1 - (run.steps * STEP - S.multAt) / A.mult.pulse, 0, 1);
  const size = A.mult.size * (1 + A.mult.swell * pulse), x = A.mult.x, y = run.gunY + (run.gunY < A.mult.flip ? A.mult.dy : -A.mult.dy);
  ctx.font = `${TY.strong} ${size}px system-ui, sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const str = `x${mult.toFixed(1)}`;
  ctx.globalAlpha = live ? 1 : 0.55; ctx.lineWidth = A.popLine; ctx.strokeStyle = P.ink; ctx.strokeText(str, x, y);
  ctx.fillStyle = !live ? P.textDim : mult >= T.comboCap ? P.orangeLight : P.orange; ctx.fillText(str, x, y); ctx.globalAlpha = 1;
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
function popText(E, str, x, y, color, alpha, size) {
  const ctx = E.ctx;
  ctx.globalAlpha = alpha; ctx.font = `${TY.strong} ${size || TY.mid + 2}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
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
// A small swatch then "Pistol Nickel", left-aligned at x on its own row: what a badge unlocks, on the missions screen.
function drawSkinLine(ctx, E, k, x, y, on) {
  const C = A.chip;
  paintChip(ctx, x + C.mini / 2, y, C.mini, 3, k.skin, on);
  E.text(`${T.guns[k.gun].short} ${k.skin.name}`, x + C.mini + 8, y, { size: TY.small, align: 'left', color: on ? P.text : P.textDim });
}

// ---------- Play state ----------

const S = {};

function newRun(ch, id, gauntlet, skin) {
  S.ch = ch; S.gunId = id; S.skin = skin || 'std'; S.run = makeRun(ch, id); S.gauntlet = gauntlet === undefined ? null : gauntlet;
  S.fx = []; S.endT = 0; S.drag = null; S.right = new Set(); S.breachAt = -1; S.multAt = -9; S.killAt = -9; S.slow = 0; S.slowed = false; S.swept = false;
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
    if (ev.decoy) { // the minus shows on the decoy that was hit
      S.fx.push({ k: 'pop', x: ev.tx, y: ev.ty, text: `\u2212${-ev.pts}`, color: P.text, t: T.popLife, max: T.popLife });
      E.audio.play('miss', 0.6); E.haptic(20);
    }
    if (ev.hit) {
      S.multAt = S.run.steps * STEP; if (ev.killed) S.killAt = S.multAt;
      const word = ev.streak === 2 ? 'Double' : ev.streak === 3 ? 'Triple' : ev.streak >= 5 && ev.streak % 5 === 0 ? `${ev.streak} in a row` : null; // streak call-outs, in the goal colour
      if (word) S.fx.push({ k: 'callout', x: ev.tx, y: ev.ty - 46, text: word, t: T.calloutLife, max: T.calloutLife });
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
  const prev = bests(E)[ch.id], prevStars = starsOf(E, ch);
  // Stars are monotonic and kept apart from the best score: a higher score with fewer stars (another gun's thresholds) never lowers them.
  const isNew = !prev || r.score > prev.score, bestScore = isNew ? r.score : prev.score, bestStars = Math.max(stars, prevStars);
  if (isNew || bestStars !== prevStars) E.save.update('best', (b) => ({ ...(b && typeof b === 'object' ? b : {}), [ch.id]: { score: bestScore, stars: bestStars } }), {});
  let bossGuns = E.save.get('bossGuns', {});
  if (!bossGuns || typeof bossGuns !== 'object') bossGuns = {};
  if (ch.id === 'b1' && stars === 3 && !bossGuns[r.gun.id]) { bossGuns = { ...bossGuns, [r.gun.id]: 1 }; E.save.set('bossGuns', bossGuns); }
  const gaunt = S.gauntlet === null ? null : gauntletStep(S.gauntlet, stars);
  const fresh = newBadges({ ch, gun: r.gun.id, stars, double: r.double, decoyHits: r.decoyHits, gauntletDone: !!(gaunt && gaunt.done), bests: Object.fromEntries(CHALLENGES.map((c) => [c.id, { stars: starsOf(E, c) }])), bossGuns, have: badgeMap(E) });
  if (fresh.length) E.save.update('badges', (b) => ({ ...(b && typeof b === 'object' ? b : {}), ...Object.fromEntries(fresh.map((id) => [id, 1])) }), {});
  const unlocked = fresh.map(skinOfBadge).filter(Boolean).map((k) => `${T.guns[k.gun].short} ${k.skin.name}`); // shown on the card's badge line
  // A Bunker cleared early leaves plates standing; say what they were worth (a full combo, the shots the gun needs per plate).
  const left = ch.wall && r.cleared ? r.targets.filter((t) => t.kind === 'part').length : 0;
  const perPlate = Math.ceil((ch.plateHp || 0) / (r.gun.damage * (r.gun.pellets > 1 ? 3 : 1)));
  E.setScene('over', { id: ch.id, gun: r.gun.name, gunId: r.gun.id, skin: S.skin, platesLeft: left, platesValue: left * perPlate * T.zonePoints[0] * T.comboCap, score: r.score, stars, best: bestScore, isNew, bestStars, hits: r.hits, bulls: r.bulls, shots: r.shots, badges: fresh, gaunt, thr: thresholds(ch, r.gun.id), preset: presetName(), skins: unlocked });
}

function meterText(r, ch) {
  if (ch.ladder === 'accuracy') return `Ammo ${r.ammo}`;
  if (ch.ladder === 'skeet') { let n = 0; for (let i = r.idx; i < r.list.length; i++) if (!r.list[i].decoy) n++; for (const t of r.targets) if (!t.decoy) n++; return `Left ${n}`; } // goal clays only
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
    const gap = 6, lab = 78, tw = (w - lab - 4 * gap) / 5; // five rungs a ladder (v0.4)
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

// The string, or its start with an ellipsis, so that it is no wider than maxW at the given size and weight.
function fitText(ctx, str, maxW, size, weight) {
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  if (ctx.measureText(str).width <= maxW) return str;
  let n = str.length; while (n > 1 && ctx.measureText(`${str.slice(0, n)}…`).width > maxW) n--;
  return `${str.slice(0, n)}…`;
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
  enter() { this.tiles = []; this.guns = []; this.infos = []; this.chips = []; this.btnPlay = null; this.btnMute = null; this.btnMissions = null; },
  render(ctx, E) {
    const L = menuLayout(E), sel = T.guns[gunId(E)], pts = pointsTotal(E), nx = nextUnlock(pts);
    E.text('RECOIL', L.title.x, L.title.y, { size: TY.big, weight: TY.strong, color: P.text });
    E.text(`Points ${pts}`, L.points.x, L.points.y + 2, { size: TY.mid, weight: TY.strong, color: P.cyan });
    E.text(nx ? `Next: ${T.guns[nx.id].name} at ${nx.need}` : 'All guns unlocked', L.next.x, L.next.y, { size: TY.small, color: P.textDim });
    E.roundRect(L.bar.x - 2, L.bar.y - 2, L.bar.w + 4, L.bar.h + 4, 5, P.ink);
    E.roundRect(L.bar.x, L.bar.y, L.bar.w, L.bar.h, 3, P.panelEdge);
    const frac = nx ? clamp((pts - nx.from) / (nx.need - nx.from), 0, 1) : 1;
    if (frac > 0) E.roundRect(L.bar.x, L.bar.y, Math.max(6, L.bar.w * frac), L.bar.h, 3, P.cyan);
    this.guns = L.guns; this.infos = [];
    for (const b of L.guns) {
      const on = b.id === sel.id, open = gunUnlocked(E, b.id), cx = b.x + b.w / 2;
      plate(E, b.x, b.y, b.w, b.h, on ? P.panelHi : P.panel, on ? P.orange : P.panelEdge);
      ctx.globalAlpha = open ? 1 : 0.25;
      drawGunTile(ctx, b.id, cx - A.tile.info / 2, b.y + b.h / 2, b.w - 2 * A.tile.pad - A.tile.info, b.h - 2 * A.tile.pad, open ? skinId(E, b.id) : 'std'); // clear of the info corner
      ctx.globalAlpha = 1;
      if (!open) {
        drawLock(ctx, cx, b.y + b.h / 2 - 12, P.textDim);
        E.text(`${T.unlockPoints[GUN_IDS.indexOf(b.id)]} points`, cx, b.y + b.h - 14, { size: TY.small, weight: TY.strong, color: P.textDim });
      }
      const info = { x: b.x + b.w - 44, y: b.y, w: 44, h: 44, id: b.id }; // the info corner opens the stats card; the rest of the tile selects the gun
      this.infos.push(info);
      ctx.strokeStyle = P.textDim; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(info.x + 26, info.y + 18, 9, 0, PI2); ctx.stroke();
      E.text('i', info.x + 26, info.y + 18.5, { size: TY.small, weight: TY.strong, color: P.textDim });
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
    this.btnMissions = btn(E, '', ms.x + ms.w / 2, ms.y + ms.h / 2, { w: ms.w, h: ms.h, fill: P.panelHi, size: TY.small });
    E.text('Missions', ms.x + ms.w / 2, ms.y + ms.h / 2 - 9, { size: TY.small, weight: TY.strong }); // two lines: 13 badges no longer fit one line at 114 px
    E.text(`${earned}/${BADGES.length}`, ms.x + ms.w / 2, ms.y + ms.h / 2 + 9, { size: TY.small, color: P.textDim });
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
    for (const i of this.infos) if (E.hit(i, p)) { E.audio.play('tap'); E.setScene('gun', { id: i.id }); return; }
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

// Missions: the badge tiers, in a list that scrolls by drag (or the 44 px rail on its right) when it does not fit. Earned badges are lit; the rest show what
// earns them and the skin each unlocks. The gauntlet starts here.
const missions = {
  enter() { this.back = null; this.btnGauntlet = null; this.reason = ''; this.scroll = 0; this.drag = null; this.v = null; this.rail = null; },
  render(ctx, E) {
    const have = badgeMap(E), land = E.w >= E.h * 1.2, side = 16 + Math.max(E.safe.left, E.safe.right), M = A.missions, top = E.safe.top;
    const W = Math.min(E.w - 2 * side, land ? 780 : 560), x0 = (E.w - W) / 2, earned = BADGES.filter((b) => have[b.id]).length;
    const open = GAUNTLET.every((id) => isUnlocked(E, CHALLENGES.find((c) => c.id === id)));
    this.reason = open ? '' : gauntletReason(E);
    this.back = btn(E, 'Back', x0 + 42, top + 30, { w: 84, h: 44, size: TY.small, fill: P.slate });
    E.text(`Missions  ${earned}/${BADGES.length}`, E.w / 2, top + 30, { size: land ? TY.mid + 2 : TY.mid, weight: TY.strong, color: P.text });
    // The Gauntlet button: a padlock and its label placed by measure when locked, so they never touch.
    const gw = land ? 120 : 110, gx = x0 + W - gw / 2, gy = top + 30;
    this.btnGauntlet = btn(E, open ? 'Gauntlet' : '', gx, gy, { w: gw, h: 44, size: TY.small, fill: open ? P.orange : P.panelHi, color: P.ink });
    if (!open) {
      ctx.font = `${TY.strong} ${TY.small}px system-ui, sans-serif`;
      const tw = ctx.measureText('Gauntlet').width, all = M.lock + M.lockGap + tw, x = gx - all / 2;
      drawLock(ctx, x + M.lock / 2, gy, P.textDim);
      E.text('Gauntlet', x + M.lock + M.lockGap + tw / 2, gy, { size: TY.small, weight: TY.strong, color: P.textDim });
    }
    let listTop = top + 62;
    if (!open && !land) { // portrait has the room to say why, under the header; landscape says it on tap
      wrapText(ctx, this.reason, W, TY.small).forEach((ln, k) => E.text(ln, E.w / 2, listTop - 6 + k * 18, { size: TY.small, color: P.textDim })); listTop += 40;
    }
    const listBottom = E.h - E.safe.bottom - 8, viewH = listBottom - listTop, cols = land ? 3 : 1, rows = Math.ceil(BADGES.length / cols);
    const contentH = rows * (M.th + M.gap) - M.gap, max = Math.max(0, contentH - viewH), listW = max > 0 ? W - M.rail - 8 : W;
    this.scroll = clamp(this.scroll, 0, max);
    const tw = (listW - (cols - 1) * M.gap) / cols;
    this.v = { x0, W, listTop, listBottom, viewH, max, listW, contentH };
    ctx.save(); ctx.beginPath(); ctx.rect(x0 - 8, listTop, W + 16, viewH); ctx.clip();
    BADGES.forEach((b, i) => {
      const x = x0 + (i % cols) * (tw + M.gap), y = listTop + Math.floor(i / cols) * (M.th + M.gap) - this.scroll;
      if (y + M.th < listTop || y > listBottom) return;
      const on = !!have[b.id], col = P.tier[b.tier], sk = skinOfBadge(b.id);
      plate(E, x, y, tw, M.th, on ? P.panelHi : P.panel, on ? col : P.panelEdge, 12);
      E.text(b.tier.toUpperCase(), x + 12, y + 14, { size: TY.small, align: 'left', color: on ? col : P.textDim });
      ctx.font = `${TY.strong} ${TY.mid}px system-ui, sans-serif`;
      const ns = clamp(Math.floor(TY.mid * (tw - 24) / ctx.measureText(b.name).width), TY.small, TY.mid); // a long name shrinks, never under the small size
      E.text(fitText(ctx, b.name, tw - 24, ns, TY.strong), x + 12, y + 34, { size: ns, weight: TY.strong, align: 'left', color: on ? P.text : P.textDim });
      if (on) drawStar(ctx, x + tw - 24, y + 14, 9, col); // on the tier row, clear of the name below
      if (sk) drawSkinLine(ctx, E, sk, x + 12, y + 54, on);
      wrapText(ctx, b.cond, tw - 24, TY.small).forEach((ln, k) => E.text(ln, x + 12, y + (sk ? 74 : 56) + k * 18, { size: TY.small, align: 'left', color: P.textDim }));
    });
    ctx.restore();
    this.rail = null;
    if (max > 0) { // the scroll affordance: a 44 px rail with chevrons, a track and a thumb; drag it or tap the chevrons
      const rx = x0 + W - M.rail, cx = rx + M.rail / 2, tt = listTop + M.rail, tb = listBottom - M.rail, th = Math.max(M.rail, (tb - tt) * viewH / contentH), ty = tt + (tb - tt - th) * (this.scroll / max);
      this.rail = { x: rx, y: listTop, w: M.rail, h: viewH, tt, tb, th };
      plate(E, rx, listTop, M.rail, viewH, P.panel, P.panelEdge, 10);
      ctx.fillStyle = this.scroll > 0 ? P.text : P.textDim; ctx.beginPath(); ctx.moveTo(cx - 8, listTop + 27); ctx.lineTo(cx + 8, listTop + 27); ctx.lineTo(cx, listTop + 15); ctx.closePath(); ctx.fill();
      ctx.fillStyle = this.scroll < max ? P.text : P.textDim; ctx.beginPath(); ctx.moveTo(cx - 8, listBottom - 27); ctx.lineTo(cx + 8, listBottom - 27); ctx.lineTo(cx, listBottom - 15); ctx.closePath(); ctx.fill();
      E.roundRect(cx - 3, tt, 6, tb - tt, 3, P.panelEdge);
      E.roundRect(cx - 9, ty, 18, th, 9, P.slateEdge, P.ink);
    }
    this.open = open;
  },
  railTo(y) { const r = this.rail; if (r) this.scroll = clamp((y - r.tt - r.th / 2) / (r.tb - r.tt - r.th), 0, 1) * this.v.max; },
  onPointerDown(p, E) {
    if (!this.v || this.v.max <= 0 || p.y < this.v.listTop || p.y > this.v.listBottom) return;
    if (this.rail && E.hit(this.rail, p)) { if (p.y >= this.rail.tt && p.y <= this.rail.tb) { this.drag = { id: p.id, rail: true }; this.railTo(p.y); } return; }
    this.drag = { id: p.id, y: p.y };
  },
  onPointerMove(p) {
    if (!this.drag || this.drag.id !== p.id) return;
    if (this.drag.rail) this.railTo(p.y); else { this.scroll = clamp(this.scroll - (p.y - this.drag.y), 0, this.v.max); this.drag.y = p.y; }
  },
  onPointerUp(p) { if (this.drag && this.drag.id === p.id) this.drag = null; },
  onTap(p, E) {
    if (E.hit(this.back, p)) { E.audio.play('tap'); E.setScene('menu'); return; }
    if (E.hit(this.btnGauntlet, p)) {
      if (this.open) { E.audio.play('tap'); E.setScene('play', { id: GAUNTLET[0], gauntlet: 0 }); } else { E.audio.play('tap', 0.3); E.toast(this.reason); }
      return;
    }
    const r = this.rail; // a chevron pages the list
    if (r && E.hit(r, p)) { if (p.y < r.tt) this.scroll = clamp(this.scroll - this.v.viewH * 0.75, 0, this.v.max); else if (p.y > r.tb) this.scroll = clamp(this.scroll + this.v.viewH * 0.75, 0, this.v.max); }
  },
};

// The gun stats card: the six numbers as bars against the four-gun maximum, its job in a line, and its skin swatches with the badge each needs, locked or not.
const STAT_ROWS = [
  ['Damage', (g) => g.damage * (g.pellets || 1), (g) => `${g.damage}${g.pellets > 1 ? ` x${g.pellets}` : ''}`],
  ['Fire rate', (g) => g.fireRate, (g) => `${g.fireRate}/s`],
  ['Range', (g) => g.accuracy, (g) => `${Math.round(g.accuracy * 100)}%`],
  ['Kick', (g) => g.kickPerShot, (g) => `${g.kickPerShot}\u00b0`],
  ['Recovery', (g) => g.kickRecovery, (g) => `${g.kickRecovery}\u00b0/s`],
  ['Magazine', (g) => g.magSize, (g) => `${g.magSize}`],
];
const gunCard = {
  enter(E, params) { this.id = (params && params.id) || 'pistol'; this.chips = []; this.back = null; this.use = null; },
  render(ctx, E) {
    const id = this.id, g = T.guns[id], land = E.w >= E.h * 1.2, side = 16 + Math.max(E.safe.left, E.safe.right), W = Math.min(E.w - 2 * side, land ? 780 : 560), x0 = (E.w - W) / 2;
    const open = gunUnlocked(E, id), worn = skinId(E, id), top = E.safe.top, need = T.unlockPoints[GUN_IDS.indexOf(id)];
    this.back = btn(E, 'Back', x0 + 42, top + 30, { w: 84, h: 44, size: TY.small, fill: P.slate });
    E.text(g.name, E.w / 2, top + 30, { size: TY.mid + 2, weight: TY.strong, color: P.text });
    const cur = gunId(E) === id;
    this.use = btn(E, open ? (cur ? 'In use' : 'Use') : 'Locked', x0 + W - 42, top + 30, { w: 84, h: 44, size: TY.small, fill: open && !cur ? P.orange : P.panelHi, color: open && !cur ? P.ink : P.textDim });
    const lw = land ? 236 : W, y0 = top + 62;
    plate(E, x0, y0, lw, 92, P.panel, P.panelEdge, 12);
    ctx.globalAlpha = open ? 1 : 0.3; drawGunTile(ctx, id, x0 + lw / 2, y0 + 46, lw - 32, 70, worn); ctx.globalAlpha = 1;
    if (!open) drawLock(ctx, x0 + lw / 2, y0 + 46, P.textDim);
    const lines = wrapText(ctx, g.job, lw - 8, TY.small);
    lines.forEach((ln, k) => E.text(ln, x0 + 4, y0 + 108 + k * 18, { size: TY.small, align: 'left', color: P.textDim }));
    if (!open) E.text(`Unlocks at ${need} points`, x0 + 4, y0 + 108 + lines.length * 18, { size: TY.small, weight: TY.strong, align: 'left', color: P.orange });
    // bars against the four-gun maximum
    const bx = land ? x0 + lw + 20 : x0, bw = land ? W - lw - 20 : W, by = land ? y0 : y0 + 108 + (lines.length + 1) * 18 + 6, rowH = 26;
    STAT_ROWS.forEach(([label, val, txt], i) => {
      const max = Math.max(...GUN_IDS.map((k) => val(T.guns[k]))), y = by + i * rowH + 12, tx = bx + 84, tw = bw - 84 - 64;
      E.text(label, bx + 4, y, { size: TY.small, align: 'left', color: P.text });
      E.roundRect(tx, y - 5, tw, 10, 5, P.panelEdge); E.roundRect(tx, y - 5, Math.max(8, tw * val(g) / max), 10, 5, P.cyan);
      E.text(txt(g), bx + bw - 4, y, { size: TY.small, weight: TY.strong, align: 'right', color: P.text });
    });
    // skin swatches: every gun shows its own, the badge each needs beside it
    const sy = land ? y0 + 170 : by + STAT_ROWS.length * rowH + 14, list = A.skins[id], cols = land ? list.length : 2, cw = W / cols;
    this.chips = list.map((skin, i) => {
      const cx = x0 + (i % cols) * cw, cy = sy + Math.floor(i / cols) * 52, r = { x: cx, y: cy, w: 44, h: 44, skin }, have = skinOpen(E, skin), b = skin.badge && BADGES.find((k) => k.id === skin.badge);
      drawChip(ctx, E, r, skin, open && skin.id === worn, have);
      E.text(fitText(ctx, skin.name, cw - 56, TY.small, TY.strong), cx + 52, cy + 12, { size: TY.small, weight: TY.strong, align: 'left', color: have ? P.text : P.textDim });
      E.text(fitText(ctx, b ? b.name : 'Default', cw - 56, TY.small, TY.normal), cx + 52, cy + 32, { size: TY.small, align: 'left', color: P.textDim });
      return r;
    });
  },
  onTap(p, E) {
    const id = this.id, g = T.guns[id];
    if (E.hit(this.back, p)) { E.audio.play('tap'); E.setScene('menu'); return; }
    if (E.hit(this.use, p)) { if (gunUnlocked(E, id) && gunId(E) !== id) { E.save.set('gun', id); E.audio.play('tap'); } else E.audio.play('tap', 0.3); return; }
    for (const c of this.chips) if (E.hit(c, p)) {
      if (!gunUnlocked(E, id)) { E.audio.play('tap', 0.3); E.toast(`The ${g.short} unlocks at ${T.unlockPoints[GUN_IDS.indexOf(id)]} points`); }
      else if (skinOpen(E, c.skin)) { E.save.update('skins', (m) => ({ ...(m && typeof m === 'object' ? m : {}), [id]: c.skin.id }), {}); E.audio.play('tap'); }
      else { const b = BADGES.find((k) => k.id === c.skin.badge); E.audio.play('tap', 0.3); E.toast(`${c.skin.name}: earn the ${b.name} badge (${b.cond})`); }
      return;
    }
  },
};

const play = {
  enter(E, params) {
    newRun(CHALLENGES.find((c) => c.id === (params && params.id)) || CHALLENGES[0], gunId(E), params && params.gauntlet, skinId(E, gunId(E)));
    this.menuBtn = null;
  },

  update(dt, E) {
    const r = S.run, gdt = S.slow > 0 ? dt * T.slowScale : dt; // the last kill of a Speed or Skeet run plays in slow motion; only the show slows, the sim is over
    S.slow = Math.max(0, S.slow - dt);
    for (const f of S.fx) f.t -= gdt;
    let n = 0;
    for (const f of S.fx) if (f.t > 0) S.fx[n++] = f;
    S.fx.length = n;
    r.kUp = E.keys.has('ArrowUp'); r.kDown = E.keys.has('ArrowDown');
    advance(r, dt);
    r.frameReal = performance.now();
    for (const ev of r.events) cosmetics(E, ev);
    r.events.length = 0;
    if (r.done) {
      const l = S.ch.ladder;
      if (!S.slowed && (l === 'speed' || l === 'skeet') && r.steps * STEP - S.killAt < 0.1) { S.slowed = true; S.slow = T.slowLife; }
      if (!S.swept && r.misses === 0 && r.hits >= 3) { S.swept = true; S.fx.push({ k: 'callout', x: T.designW / 2, y: 130, text: 'Clean sweep', t: T.calloutLife * 1.4, max: T.calloutLife * 1.4, big: true }); }
      S.endT += dt; if (S.endT >= T.endDelay) endRun(E);
    }
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
      if (tg.kind === 'part' && !ch.wall && tg.idx !== r.stage) alpha = 0.5;
      if (tg.kind === 'dodge' && now >= tg.nextDodge - T.dodgeWarn && Math.floor(E.time * 10) % 2) alpha = 0.3;
      drawTargetFull(ctx, E, tg, r, ch, alpha);
    }
    for (const tg of r.targets) {
      if (tg.kind === 'part' && ch.wall && !partActive(r, tg)) continue; // a closed frame shows no hit points
      drawTargetHp(ctx, tg, tg.kind === 'part' && !ch.wall && tg.idx !== r.stage ? 0.5 : tg.kind === 'core' && coreShielded(r) ? A.plate.shut : 1);
    }
    drawRangeFinder(ctx, r);
    for (const f of S.fx) if (f.k === 'tracer') drawTracer(ctx, f);
    for (const f of S.fx) if (f.k === 'pop') drawHitRing(ctx, f);
    drawGun(ctx, r);
    drawMult(ctx, r);
    for (const f of S.fx) if (f.k === 'flash') drawFlash(ctx, r, f);
    for (const f of S.fx) if (f.k === 'casing') drawCasing(ctx, f);
    ctx.restore();

    if (!ch.wall) for (const tg of r.targets) if (tg.kind === 'part') { // the Bunker's plates come in a random order, so they carry no numbers
      const on = tg.idx === r.stage;
      E.text(PART_NUM[tg.idx], v.ox + (tg.x - T.zoneR[2] * tg.sc * A.plate.r - 10) * v.s, v.oy + tg.y * v.s, { size: TY.small, weight: TY.strong, color: on ? P.text : P.textDim });
    }
    for (const f of S.fx) if (f.k === 'pop') {
      const k = 1 - f.t / f.max;
      popText(E, f.text, v.ox + f.x * v.s, v.oy + (f.y - 18 - 22 * k) * v.s, f.color, 1 - k * k);
    }
    if (ch.wall && now < A.intro.hold + A.intro.fade) { // the Bunker's one-line intro: plates 5 and 6 are optional but they score
      const a = clamp((A.intro.hold + A.intro.fade - now) / A.intro.fade, 0, 1);
      E.text('Every plate scores', v.ox + (T.designW / 2) * v.s, v.oy + A.intro.y * v.s, { size: TY.small, weight: TY.strong, color: P.text, alpha: a });
    }
    for (const f of S.fx) if (f.k === 'callout') {
      const k = 1 - f.t / f.max, big = f.big ? 1.35 : 1, x = clamp(v.ox + f.x * v.s, v.ox + 70, v.ox + v.w - 70);
      popText(E, f.text, x, v.oy + (f.y - 26 * k) * v.s, P.cyan, Math.min(1, 3 * (1 - k)), TY.mid * big + 4);
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
    this.p = params; this.ch = CHALLENGES.find((c) => c.id === params.id); this.t0 = E.time; this.tick = -1;
    const g = params.gaunt;
    if (g) { this.next = g.next ? CHALLENGES.find((c) => c.id === g.next) : null; this.canNext = !!this.next; }
    else {
      this.next = CHALLENGES.find((c) => c.ladder === this.ch.ladder && c.level === this.ch.level + 1);
      this.canNext = !!this.next && params.bestStars >= (this.next.needStars || T.unlockStars) && (!this.next.needGun || gunUnlocked(E, this.next.needGun));
    }
    E.audio.play(params.stars >= 1 ? 'win' : 'lose'); E.haptic(30);
  },
  update(dt, E) { // a soft tick, rising, while the score counts up
    const a = E.time - this.t0 - 0.15;
    if (a >= 0 && a < T.tickerLife && Math.floor(a / 0.07) !== this.tick) { this.tick = Math.floor(a / 0.07); E.audio.beep({ freq: 300 + 500 * (a / T.tickerLife), dur: 0.03, type: 'triangle', gain: 0.05 }); }
  },
  render(ctx, E) {
    const p = this.p, ch = this.ch, cx = E.w / 2, g = p.gaunt;
    const H = 310, y0 = Math.max(E.safe.top + 8, E.safe.top + (E.h - E.safe.top - E.safe.bottom - H) / 2);
    const pw = Math.min(E.w - 16, 500);
    plate(E, cx - pw / 2, y0 - 18, pw, H + 30, P.panel, P.panelEdge, 16);
    E.text(`${ch.name}  ·  ${p.gun}${g ? `  ·  Gauntlet ${g.i + 1}/${GAUNTLET.length}` : ''}`, cx, y0 + 10, { size: TY.small, color: P.textDim });
    const age0 = E.time - this.t0, shown = Math.round(p.score * ease.outQuad(clamp((age0 - 0.15) / T.tickerLife, 0, 1))); // the score counts up
    E.text(`${shown}`, cx, y0 + 46, { size: TY.big + 16, weight: TY.strong, color: P.text });
    if (p.gunId) { // the gun as it was worn, on the left of the score
      const tx = cx - pw / 2 + 14 + 42, ws = skinById(p.gunId, p.skin);
      drawGunTile(ctx, p.gunId, tx, y0 + 48, 84, 34, p.skin);
      if (ws.badge) E.text(ws.name, tx, y0 + 74, { size: TY.small, color: P.textDim });
    }
    const age = E.time - this.t0;
    for (let i = 0; i < 3; i++) {
      const sx = cx + (i - 1) * 60, sy = y0 + 94;
      if (i < p.stars) {
        const k = ease.outBack(clamp((age - i * 0.2) / 0.3, 0, 1));
        if (k > 0) drawStar(ctx, sx, sy, 22 * k, P.brass);
      } else drawStar(ctx, sx, sy, 22, null, P.panelEdge);
    }
    const of = ch.ladder === 'accuracy' ? ` of ${ch.accTargets}` : '';
    E.text(`Hits ${p.hits}${of}   Bullseyes ${p.bulls}`, cx, y0 + 134, { size: TY.mid, color: P.text });
    E.text(`${p.isNew ? 'New best' : 'Best'} ${p.best}  ·  ${p.bestStars} ${p.bestStars === 1 ? 'star' : 'stars'} saved`, cx, y0 + 156, { size: TY.mid, weight: p.isNew ? TY.strong : TY.normal, color: p.isNew ? P.orange : P.textDim });
    E.text(`Stars at ${p.thr.one} / ${p.thr.two} / ${p.thr.three}  ·  ${p.preset}`, cx, y0 + 178, { size: TY.small, color: P.textDim });
    // Optional lines stack under the thresholds (a cursor, not fixed rows): the Bunker's plates, the badge, its skin, a gauntlet note. The buttons start at y0 + 256;
    // with all four the last line ends at y0 + 247.
    let yy = y0 + 178;
    if (ch.wall) {
      yy += 20;
      E.text(p.platesLeft ? `${p.platesLeft} plates left, worth up to ${p.platesValue} more` : 'Every plate scores', cx, yy, { size: TY.small, color: p.platesLeft ? P.cyan : P.textDim });
    }
    if (p.badges.length) { // a badge pop: the line pops in by transform, from popFrom of its size (never under the small text size), fading up
      yy += 22;
      const t = clamp((age - 0.5) / 0.35, 0, 1), k = ease.outBack(t), names = p.badges.map((id) => BADGES.find((b) => b.id === id).name).join(', ');
      const col = P.tier[BADGES.find((b) => b.id === p.badges[0]).tier], from = TY.small / TY.mid, sc = from + (1 - from) * k, msg = `Badge earned: ${names}`;
      if (t > 0) {
        ctx.save(); ctx.translate(cx + 12, yy); ctx.scale(sc, sc);
        E.text(msg, 0, 0, { size: TY.mid, weight: TY.strong, color: col, alpha: t }); ctx.globalAlpha = t;
        drawStar(ctx, -ctx.measureText(msg).width / 2 - 16, 0, 11, col);
        ctx.restore();
        if (p.skins && p.skins.length) E.text(`Skin unlocked: ${p.skins.join(', ')}`, cx, yy + 20, { size: TY.small, color: P.textDim, alpha: t });
      }
    } else if (g && !g.ok) E.text('Gauntlet over: two stars needed', cx, yy += 22, { size: TY.mid, color: P.red });
    else if (g && g.done) E.text('Gauntlet complete', cx, yy += 22, { size: TY.mid, color: P.cyan });
    else if (g) E.text('Gauntlet stage passed', cx, yy += 22, { size: TY.mid, color: P.cyan });
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
  { group: 'stars', key: 'starNoise.three', label: 'Three stars: aim noise (deg)', min: 0.25, max: 5, step: 0.25 },
  { group: 'stars', key: 'starNoise.two', label: 'Two stars: aim noise (deg)', min: 0.25, max: 5, step: 0.25 },
  { group: 'stars', key: 'starNoise.one', label: 'One star: aim noise (deg)', min: 0.25, max: 5, step: 0.25 },
  { group: 'handling', key: 'guns.pistol.kickPerShot', label: 'Pistol kick per shot (deg)', min: 2, max: 15, step: 0.5 },
  { group: 'handling', key: 'swayPerSpeed', label: 'Sway per speed', min: 0, max: 0.06, step: 0.005 },
];
const PRESETS = [
  { group: 'stars', label: 'Pro', values: { 'starNoise.three': 0.5, 'starNoise.two': 1, 'starNoise.one': 2 } },
  { group: 'stars', label: 'Skilled', values: { 'starNoise.three': 0.75, 'starNoise.two': 1.5, 'starNoise.one': 3 } },
  { group: 'stars', label: 'Casual', values: { 'starNoise.three': 1, 'starNoise.two': 2, 'starNoise.one': 4 } },
  { group: 'handling', label: 'Steady', values: { 'guns.pistol.kickPerShot': 5, swayPerSpeed: 0.01 } },
  { group: 'handling', label: 'Standard', values: { 'guns.pistol.kickPerShot': 8, swayPerSpeed: 0.02 } },
  { group: 'handling', label: 'Wild', values: { 'guns.pistol.kickPerShot': 12, swayPerSpeed: 0.04 } },
];
const TUNE_KEYS = new Set([...EXPERIMENTS.map((e) => e.key), ...PRESETS.flatMap((p) => Object.keys(p.values))]);
function getPath(key) { return key.split('.').reduce((o, k) => o[k], T); }
function setPath(key, v) { const ks = key.split('.'); ks.slice(0, -1).reduce((o, k) => o[k], T)[ks[ks.length - 1]] = v; }
const TUNE_DEFAULTS = Object.fromEntries([...TUNE_KEYS].map((k) => [k, getPath(k)]));

// The TUNE screen (the engine's own has room for two sliders; this has two panels): star bars and handling, each a row of presets and its sliders. Values persist the
// way the engine's do, in __tune, which the engine restores at boot for the declared keys.
function tuneLayout(E) {
  const land = E.w >= E.h * 1.2, side = 16 + Math.max(E.safe.left, E.safe.right), W = Math.min(E.w - 2 * side, 780), x0 = (E.w - W) / 2, top = E.safe.top + 56, gap = 16;
  const pw = land ? (W - gap) / 2 : W, out = { land, x0, W, back: { x: x0, y: E.safe.top + 8, w: 84, h: 44 }, reset: { x: x0 + W - 84, y: E.safe.top + 8, w: 84, h: 44 }, panels: [] };
  let y = top;
  [['stars', 'Star bars'], ['handling', 'Handling']].forEach(([group, title], i) => {
    const x = land ? x0 + i * (pw + gap) : x0, py = land ? top : y, ps = PRESETS.filter((p) => p.group === group), ss = EXPERIMENTS.filter((e) => e.group === group);
    const bw = (pw - (ps.length - 1) * 8) / ps.length;
    const panel = { group, title, x, y: py, w: pw, presets: ps.map((p, k) => ({ p, x: x + k * (bw + 8), y: py + 24, w: bw, h: 44 })), sliders: ss.map((e, k) => ({ e, x, y: py + 76 + k * 56, w: pw, h: 56 })) };
    panel.h = 76 + ss.length * 56;
    out.panels.push(panel); y = py + panel.h + 12;
  });
  return out;
}
const tune = {
  enter() { this.drag = null; },
  render(ctx, E) {
    const L = tuneLayout(E); this.L = L;
    btn(E, 'Back', L.back.x + L.back.w / 2, L.back.y + 22, { w: L.back.w, h: 44, size: TY.small, fill: P.slate });
    btn(E, 'Reset', L.reset.x + L.reset.w / 2, L.reset.y + 22, { w: L.reset.w, h: 44, size: TY.small, fill: P.slate });
    E.text('Tune', E.w / 2, E.safe.top + 30, { size: TY.mid + 2, weight: TY.strong, color: P.text });
    for (const pn of L.panels) {
      E.text(pn.title.toUpperCase(), pn.x + 4, pn.y + 8, { size: TY.small, weight: TY.strong, align: 'left', color: P.textDim });
      for (const b of pn.presets) {
        const on = Object.entries(b.p.values).every(([k, v]) => Math.abs(getPath(k) - v) < 1e-9);
        plate(E, b.x, b.y, b.w, b.h, on ? P.orange : P.panelHi, P.ink);
        E.text(b.p.label, b.x + b.w / 2, b.y + b.h / 2, { size: TY.small, weight: TY.strong, color: on ? P.ink : P.text });
      }
      for (const r of pn.sliders) {
        const v = getPath(r.e.key), k = clamp((v - r.e.min) / (r.e.max - r.e.min), 0, 1), dec = r.e.step < 1 ? Math.min(3, Math.ceil(-Math.log10(r.e.step))) : 0;
        E.text(r.e.label, r.x + 4, r.y + 12, { size: TY.small, align: 'left', color: P.text });
        E.text(v.toFixed(dec), r.x + r.w - 4, r.y + 12, { size: TY.small, weight: TY.strong, align: 'right', color: P.orange });
        E.roundRect(r.x + 14, r.y + 34, r.w - 28, 8, 4, P.panelEdge);
        E.roundRect(r.x + 14, r.y + 34, (r.w - 28) * k, 8, 4, P.cyan);
        disc(ctx, r.x + 14 + (r.w - 28) * k, r.y + 38, 12, P.text); ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.stroke();
      }
      if (pn.group === 'stars') { // what the bars are now, on two ladders
        const a = thresholds(CHALLENGES.find((c) => c.id === 'a3'), 'pistol'), b = thresholds(CHALLENGES.find((c) => c.id === 's3'), 'carbine'), y = pn.y + pn.h + 2;
        E.text(`Accuracy 3: ${a.one} / ${a.two} / ${a.three}`, pn.x + 4, y + 8, { size: TY.small, align: 'left', color: P.textDim });
        E.text(`Speed 3: ${b.one} / ${b.two} / ${b.three}   (${presetName()})`, pn.x + 4, y + 28, { size: TY.small, align: 'left', color: P.textDim });
      }
    }
  },
  set(E, r, px) {
    const k = clamp((px - (r.x + 14)) / (r.w - 28), 0, 1);
    let v = r.e.min + k * (r.e.max - r.e.min);
    v = +(Math.round(v / r.e.step) * r.e.step).toFixed(6);
    setPath(r.e.key, v); E.save.update('__tune', (t) => ({ ...t, [r.e.key]: v }), {}); E.save.set('starPreset', presetName());
  },
  onPointerDown(p, E) {
    const r = this.L && this.L.panels.flatMap((pn) => pn.sliders).find((r) => E.hit(r, p));
    if (r) { this.drag = r; this.set(E, r, p.x); }
  },
  onPointerMove(p, E) { if (this.drag) this.set(E, this.drag, p.x); },
  onPointerUp() { this.drag = null; },
  onTap(p, E) {
    const L = this.L;
    if (!L) return;
    if (E.hit(L.back, p)) { E.setScene('menu'); return; }
    if (E.hit(L.reset, p)) { for (const [k, v] of Object.entries(TUNE_DEFAULTS)) setPath(k, v); E.save.set('__tune', {}); E.save.set('starPreset', presetName()); return; }
    for (const pn of L.panels) for (const b of pn.presets) if (E.hit(b, p)) {
      for (const [k, v] of Object.entries(b.p.values)) setPath(k, v);
      E.save.update('__tune', (t) => ({ ...t, ...b.p.values }), {}); E.save.set('starPreset', presetName()); E.audio.play('tap');
    }
  },
};

export const game = {
  slug: 'recoil',
  title: 'Recoil',
  saveVersion: 6,
  // Save shape: best { challengeId: { score, stars } }, gun (id), skins { gunId: skinId }, badges { badgeId: 1 }, bossGuns { gunId: 1 }, starPreset (the star-bar preset's name), __tune, __muted.
  // v2 added the chosen gun; v3 pruned saved tune values (ADR-0014); v4 adds badges and bossGuns and awards the star-only badges
  // that the existing bests already earn; v5 adds the worn skin per gun (a skin whose badge is not earned plays as the default); v6 adds the star-bar preset's name. Nothing else changes, and the whole save stays under a kilobyte or two.
  migrate(data, fromVersion) {
    if (typeof data.best !== 'object' || data.best === null) delete data.best;
    if (!data.gun) data.gun = 'pistol';
    if (!data.badges || typeof data.badges !== 'object') data.badges = {};
    if (!data.bossGuns || typeof data.bossGuns !== 'object') data.bossGuns = {};
    if (!data.skins || typeof data.skins !== 'object') data.skins = {};
    if (typeof data.starPreset !== 'string') data.starPreset = 'Skilled';
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
  scenes: { menu, play, over, missions, tune, gun: gunCard },
};
