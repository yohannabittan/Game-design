// Recoil, v0.5: the mechanic plus six guns (pistol, carbine, shotgun, rifle, SMG, revolver), barrel sway, moving targets, skeet with decoys, two bosses, zombies,
// and progression (guns opened by badges, twenty-three badges, skins, a gauntlet). One thumb drags the gun up and down, the other fires, and every shot kicks the barrel up.
// Instant shot lines scored by zone, a combo multiplier, five ladders (Accuracy and Speed have five rungs, Skeet three, Boss two, Zombies three) and an endless zombie mode,
// stars per gun from noisy-bot bars, points, a menu that is a range, and a card. Procedural art (gun silhouettes, paper targets, zombies, a range backdrop) from one palette
// in TUNING.art; no image assets. Landscape, two thumbs (ADR-0013).

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
  dodgeCooldown: 1.2,    // Seconds before a target can dodge again (an armed dodger wears a dashed ring; a shrinking arc counts the window)
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
  kickWindow: 0.65,      // v0.5 J, Kickback: six hits in a row within this many seconds (0.5 in the PRD is faster than any gun here can shoot: the pistol's five gaps are 0.54 s)
  coldRuns: 5,           // v0.5 J, Cold Barrel: runs in a row that open on a bullseye

  // v0.5 sections G and L: zombies. A zombie is up to three parts (circles, in units at scale 1, centre `cy` above the feet): legs, body, brain. Legs down: it crawls at `crawl` of its
  // speed and its body drops; body down: it slows to `hunch`; the brain ends it. A zombie whose front (arms, `reach`) touches the fence ends the run. The five types are
  // data (`types`): speed as a share of `base`, size (a multiplier on every radius and height), part hit points, and where the head sits, so no two heads sit at the same height
  // (Shambler 74, Crawler 22, Hunched 48 under its shield, Brute 122, and the Runner's 74 bobbing by `bob`).
  zombie: {
    fenceX: 122,         // the fence stands just in front of the muzzle
    spawnX: 618,         // zombies enter at the right wall, one after another (a wave's `gap` seconds apart)
    lanes: [240, 286],   // feet heights: lower is nearer, so bigger (scale runs over `scale` across the lanes)
    scale: [0.85, 1.15],
    base: 48,            // units a second at speed 1: v0.5 L raised the walkers of G (34) by 1.4
    crawl: 0.5,          // speed factor with the legs down (not for a Crawler, which is on the ground already)
    hunch: 0.7,          // speed factor with the body down
    reach: 24,           // how far its arms reach ahead of its middle, at scale 1
    bobPeriod: 0.7,      // seconds a Runner's head takes to bob once
    types: {
      s: { name: 'Shambler', speed: 1, size: 1, legs: { hp: 2, r: 17 }, body: { hp: 3, r: 15 }, brain: { hp: 1, r: 8 } },
      r: { name: 'Runner', speed: 1.6, size: 1, bob: 20, legs: { hp: 2, r: 17 }, body: { hp: 3, r: 15 }, brain: { hp: 1, r: 8 } },
      c: { name: 'Crawler', speed: 0.7, size: 1, ground: true, legs: null, body: { hp: 3, r: 15 }, brain: { hp: 1, r: 8 } },
      b: { name: 'Brute', speed: 0.8, size: 1.65, legs: { hp: 3, r: 17 }, body: { hp: 5, r: 15 }, brain: { hp: 1, r: 5.8 } },
      h: { name: 'Hunched', speed: 0.9, size: 1, shield: true, legs: { hp: 2, r: 17 }, body: { hp: 3, r: 18 }, brain: { hp: 1, r: 8 } },
    },
    points: { hit: 5, legs: 30, body: 50, brain: 75, bonus: 125 }, // per hit, per part destroyed, and the bonus for the brain that ends it; the multiplier applies to all
    waveGap: 1.5,        // seconds between the last zombie of a wave going down and the next wave entering
    hitFlash: 0.14,      // seconds a part shows it was hit
    endless: { speedStep: 0.04, speedCap: 2.5, hpEvery: 3, mixFrom: 2, mixEvery: 2 }, // each wave raises speed by speedStep; every hpEvery waves every part gains 1 hp; the mix opens a type every mixEvery waves
  },

  // v0.5 N: gun mastery. A gun's mastery is its lifetime bullseyes plus headshots; Marksman at `marksman`, Expert at `expert`, Master at `master` and a lifetime accuracy of at least
  // `accuracy` (hits over shots). The second skin of a gun opens at Marksman and the third at Master (a skin's `tier`).
  mastery: { marksman: 100, expert: 500, master: 1500, accuracy: 0.6 },

  // Guns (v0.2 section A): data, so a later layer adds more. kickPerShot and kickRecovery are per gun now.
  // v0.5 M: magSize rounds fire before a reload of reloadSeconds (the shotgun loads shell by shell, reloadSeconds / magSize each, and a fire tap interrupts it). Accuracy keeps its own round count on top.
  guns: {
    pistol: { id: 'pistol', job: 'The all-rounder: clean bullseyes and long combos.', name: 'Service pistol', short: 'Pistol', damage: 1, fireRate: 9, accuracy: 1.0, kickPerShot: 8, kickRecovery: 32, magSize: 12, reloadSeconds: 1.0, auto: false },
    carbine: { id: 'carbine', job: 'Hold to fire: fast targets, hordes and clays.', name: 'Carbine', short: 'Carbine', damage: 1, fireRate: 8, accuracy: 0.55, kickPerShot: 5, kickRecovery: 24, magSize: 30, reloadSeconds: 1.6, auto: true },
    // v0.3. `pellets` lines leave the barrel in a fixed fan of shotSpread degrees; each pellet deals `damage` on its own. Only the centre
    // pellet scores zone points on ring targets; on hordes every member any pellet hits scores.
    shotgun: { id: 'shotgun', job: 'Five pellets: boss plates and hordes; hopeless at far bullseyes.', name: 'Shotgun', short: 'Shotgun', damage: 1, pellets: 5, fireRate: 2.3, accuracy: 0.4, kickPerShot: 14, kickRecovery: 30, magSize: 6, reloadSeconds: 2.2, shell: true, auto: false },
    rifle: { id: 'rifle', job: 'One-shots plates; long waits and sway matter most.', name: 'Marksman rifle', short: 'Rifle', damage: 3, fireRate: 1.5, accuracy: 1.0, kickPerShot: 16, kickRecovery: 20, magSize: 5, reloadSeconds: 1.8, auto: false },
    // v0.5 section H. Both fire faster than the barrel settles, so a held SMG and a quick revolver climb off the target: the interval is under the recovery time on both.
    smg: { id: 'smg', job: 'Hold to spray: the fastest fire, and the hardest climb to hold.', name: 'SMG', short: 'SMG', damage: 1, fireRate: 14, accuracy: 0.5, kickPerShot: 6, kickRecovery: 40, magSize: 24, reloadSeconds: 1.4, auto: true },
    revolver: { id: 'revolver', job: 'Six heavy shots: one-shots plates and brains, then waits for the barrel.', name: 'Revolver', short: 'Revolver', damage: 3, fireRate: 1.2, accuracy: 1.0, kickPerShot: 20, kickRecovery: 18, magSize: 6, reloadSeconds: 2.4, auto: false },
  },
  shotSpread: 10,        // v0.3: total fan angle of the shotgun's five pellets, degrees
  unlockBadges: { carbine: 'marksman1', shotgun: 'quickdraw1', rifle: 'clay1', smg: 'quickdraw2', revolver: 'marksman2' }, // v0.5 K: the badge that unlocks each gun (the pistol is always open)

  // Additions, not in the PRDs.
  swayWindow: 0.05,      // Seconds over which the gun's speed is measured for sway
  expiryGrace: 0.12,     // v0.5 B: seconds an Accuracy card stays hit-testable after its time is up (touch latency is 50 to 100 ms); the miss books when it ends
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
  unlockStars: 2,        // Stars a gun needs on a rung to open the next rung of its ladder for that gun
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
      tier: { Bronze: '#d08a4a', Silver: '#cbd5e1', Trick: '#c4a6ff', Gold: '#fbbf24' },
      zone: ['#ffffff', '#22d3ee', '#c4b89f'], // Score pop colour by zone: bullseye, inner, outer
      // Zombies: a sickly skin, a torn shirt and trousers, a wound, the brain (its bullseye ring is the goal's cyan), and the fence's weathered wood
      zSkin: '#8fae87', zSkinDark: '#5f7d5a', zShirt: '#5d6b86', zPants: '#4a4139', zWound: '#8f2f2f', zBrain: '#e59ab0',
      zSkinR: '#a9bd8a', zShirtR: '#93503c', zSkinC: '#7d9a78', zShirtC: '#6d5f45', zSkinB: '#6f8f6a', zShirtB: '#4c3b3d', zPantsB: '#39322c', zSkinH: '#9db08d', zShirtH: '#5b6068', // the types: a lean pale Runner, a dirty Crawler, a dark Brute, a grey Hunched hood wood: '#7d6547', woodDark: '#4e3f2c',
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
      smg: { muzzle: 56, port: [6, -9], shell: [5, 2.2], parts: [
        ['rr', 'steelDark', -46, -9, 26, 4, 1.5], ['rr', 'steelDark', -49, -13, 4, 13, 1.5],
        ['poly', 'steelDark', [-8, 3, 4, 3, 6, 26, -6, 27]],
        ['poly', 'steelDark', [11, 4, 21, 4, 24, 40, 14, 40]],
        ['rr', 'steelDark', -6, -17, 28, 5, 2],
        ['rr', 'steel', -22, -12, 54, 19, 3.5],
        ['rr', 'steelDark', 32, -9, 20, 13, 3],
        ['rr', 'ink', 36, -6, 1.6, 7, 0.8], ['rr', 'ink', 41, -6, 1.6, 7, 0.8], ['rr', 'ink', 46, -6, 1.6, 7, 0.8],
        ['rr', 'orange', 50, -6, 6, 8, 2],
        ['rr', 'ink', -3, -8, 12, 3.5, 1],
        ['rr', 'highlight', -20, -10, 50, 2.6, 1.3],
      ] },
      revolver: { muzzle: 58, port: [4, -6], shell: [6, 2.6], parts: [
        ['poly', 'steelDark', [-12, 3, 6, 3, 3, 35, -17, 32]],
        ['poly', 'steelDark', [-19, -10, -11, -15, -8, -6, -18, -3]],
        ['rr', 'steel', -14, -10, 26, 20, 4],
        ['rr', 'steelDark', -3, -14, 20, 26, 5],
        ['rr', 'ink', 3, -10, 1.6, 18, 0.8], ['rr', 'ink', 8, -10, 1.6, 18, 0.8], ['rr', 'ink', 13, -10, 1.6, 18, 0.8],
        ['rr', 'steel', 17, -9, 41, 9, 3],
        ['rr', 'steelDark', 20, 0, 32, 5, 2],
        ['rr', 'steelDark', 50, -13, 4, 5, 1.5],
        ['rr', 'orange', 53, -9, 5, 9, 2],
        ['rr', 'ink', -9, 6, 12, 3, 1],
        ['rr', 'highlight', -10, -8, 46, 2.6, 1.3],
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
    // sky bands (Standard is 3.8:1), so a dark skin has a light body and dark decoration. A skin opens by its `tier` (gun mastery: 1 Marksman, 2 Expert, 3 Master; v0.5 N) or by the trick or Legend badge named in `badge`; never by points.
    // The first skin of a gun is its default. Order matters: the save keeps the id.
    skins: {
      pistol: [
        { id: 'std', name: 'Standard', badge: null, pal: {}, deco: [] },
        { id: 'nickel', name: 'Nickel', tier: 1, pal: { steel: '#cfd4da', steelDark: '#8a929c', accent: '#d6a23a' }, deco: [['rr', 'accent', 2, -7.5, 20, 7, 2], ['rr', 'ink', 5, -4.6, 14, 1.4, 0.7]] }, // engraved brass plate
        { id: 'blackout', name: 'Blackout', tier: 3, pal: { steel: '#7d828a', steelDark: '#5a5651', accent: '#15120f' }, deco: [['rr', 'accent', -21, -6.5, 60, 4.6, 1.4]] }, // black band on the slide
        { id: 'gold', name: 'Gold', badge: 'legend', pal: { steel: '#e3b53d', steelDark: '#a8781c', accent: '#fff1b8' }, deco: [['rr', 'accent', -20, -8.2, 58, 1.8, 0.9], ['rr', 'accent', -20, 0.6, 58, 1.8, 0.9]] }, // twin stripes
      ],
      carbine: [
        { id: 'std', name: 'Standard', badge: null, pal: {}, deco: [] },
        { id: 'desert', name: 'Desert', tier: 1, pal: { steel: '#c2a374', steelDark: '#7d6641', accent: '#ecdcae' }, deco: [['rr', 'accent', 26, -8.2, 2.6, 13.4, 0.8], ['rr', 'accent', 32, -8.2, 2.6, 13.4, 0.8], ['rr', 'accent', 38, -8.2, 2.6, 13.4, 0.8]] }, // tape wrap on the forend
        { id: 'arctic', name: 'Arctic', tier: 3, pal: { steel: '#e2e8f0', steelDark: '#94a3b8', accent: '#4a6fa5' }, deco: [['rr', 'accent', -16, -3, 40, 3.2, 1.4]] }, // body stripe
      ],
      shotgun: [
        { id: 'std', name: 'Standard', badge: null, pal: {}, deco: [] },
        { id: 'walnut', name: 'Walnut', tier: 1, pal: { steelDark: '#7a4a2a', accent: '#d6a23a' }, deco: [['rr', 'accent', -19, -9, 15, 6.5, 1.5], ['rr', 'ink', -16.5, -6.3, 10, 1.3, 0.6]] }, // wood furniture, engraved plate
        { id: 'tactical', name: 'Tactical', tier: 3, pal: { steel: '#8c9668', steelDark: '#59603f', accent: '#1f2416' }, deco: [['rr', 'accent', 0, -7, 56, 3.4, 1.2], ['rr', 'accent', 21, 7.5, 22, 2.6, 1]] }, // dark barrel stripe and pump band
      ],
      rifle: [
        { id: 'std', name: 'Standard', badge: null, pal: {}, deco: [] },
        { id: 'carbon', name: 'Carbon', tier: 1, pal: { steel: '#858c93', steelDark: '#565c63', accent: '#1a1d22' }, deco: [['rr', 'accent', -19, -8, 30, 3.4, 1], ['rr', 'accent', -19, -2, 30, 3.4, 1]] }, // dark weave lines on the receiver
        { id: 'bronze', name: 'Bronze', tier: 3, pal: { steel: '#b8834a', steelDark: '#7a542c', accent: '#e8c48a' }, deco: [['rr', 'accent', -19, -7, 18, 7, 2], ['rr', 'ink', -16, -4, 12, 1.3, 0.6]] }, // warm bronze, engraved plate on the receiver
        { id: 'ghost', name: 'Ghost', tier: 2, pal: { steel: '#eceef2', steelDark: '#aeb7c4', accent: '#b9a6e6' }, deco: [['rr', 'accent', -54, -4, 20, 7, 2], ['rr', 'ink', -51, -1, 14, 1.3, 0.6]] }, // engraved plate on the stock
      ],
      smg: [
        { id: 'std', name: 'Standard', badge: null, pal: {}, deco: [] },
        { id: 'brass', name: 'Brass', badge: 'kickback', pal: { steel: '#d9b25a', steelDark: '#8a5d16', accent: '#fff1b8' }, deco: [['rr', 'accent', -20, -9, 50, 1.8, 0.9], ['rr', 'accent', -20, 2, 50, 1.8, 0.9]] }, // brass finish, two bright lines on the receiver
        { id: 'hazard', name: 'Hazard', badge: 'walkline', pal: { steel: '#e7e0cf', steelDark: '#6b6458', accent: '#1a1512' }, deco: [['rr', 'accent', -16, -11, 6, 17, 1], ['rr', 'accent', -4, -11, 6, 17, 1], ['rr', 'accent', 8, -11, 6, 17, 1], ['rr', 'accent', 20, -11, 6, 17, 1]] }, // black warning bars
      ],
      revolver: [
        { id: 'std', name: 'Standard', badge: null, pal: {}, deco: [] },
        { id: 'ivory', name: 'Ivory', badge: 'lastround', pal: { steel: '#c9cdd3', steelDark: '#e6dcc4', accent: '#c08a2c' }, deco: [['rr', 'accent', -14, -2, 26, 3, 1.2], ['rr', 'accent', 20, -6, 26, 2, 1]] }, // ivory grip and cylinder, a gold band
        { id: 'frost', name: 'Frost', badge: 'coldbarrel', pal: { steel: '#dbe7f7', steelDark: '#8ea6c8', accent: '#3f6396' }, deco: [['rr', 'accent', 17, -6, 41, 3, 1.4]] }, // pale steel, a blue rib on the barrel
      ],
    },
    chip: { hit: 44, gap: 8, size: 26, radius: 6 }, // Skin swatches on the stats card: touch size, spacing, drawn size, corner
    flash: { spikes: [28, 10, 14, 8, 6, 8, 14, 10], inner: 4.5, from: 0.7, mid: 0.62, core: 0.3 }, // Muzzle flash: eight spikes (forward first), scale grows from `from` to 1 as it lives
    casing: { cap: 10, life: 0.55, gravity: 700, vx: [-75, -30], vy: [-175, -105], spin: [-16, 16], floor: 16, fade: 0.35, line: 1.2 }, // Ejected brass: capped particles
    finder: { gap: 6, rNear: 2.8, rFar: 1.5, farAlpha: 0.25, warm: 0.3, ramp: 4, track: 5.5, trackAlpha: 0.3, capHalf: 6, capWidth: 2.6, capAlpha: 0.55, fanAlpha: 0.22 },
    tracer: { width: 2.5 },
    drop: { life: 0.12, dotK: 1.7, lineAlpha: 0.9, haptic: 12 }, // v0.5 B: a tap dropped inside the fire interval flashes the range finder white (dot size factor, line alpha)
    dodge: { ghostLife: 0.25, ghostAlpha: 0.5, slide: 0.1, ringGap: 5, ringWidth: 2.5, dash: [7, 5], coolAlpha: 0.75, beep: 520, calloutDx: 84 }, // v0.5 B: a dodge leaves a fading ghost card and slides the target over `slide`, and the call-out sits to its left; the armed ring
    ring: { life: 0.3, r0: 8, r1: 30, width: 3 }, // Hit ring that opens at the target as the score pop rises (inside the pop's own life)
    popLine: 5,            // Outline width of the score pop
    backdrop: { skyLowY: 120, wallTop: 208, coping: 7, seam: 64, marker: 128, markerW: 14, markerH: 22, tape: [10, 8], tick: 5 },
    card: { pad: 3, radius: 0.6, ringLine: 1, timerK: 1.17, timerGap: 4, timerWidth: 3, post: 4, foot: 13, warn: 1, warnFlip: 0.3, pulse: 8 }, // Paper target: pad beyond the outer ring (an Accuracy card scores out to it), corner as a fraction of the half size; the timer ring goes orange and pulses in the last `warn` seconds (the last `warnFlip` of a flip window)
    trolley: { w: 0.8, h: 4, wheel: 2.6, tie: 24, tieLen: 2.5, tieW: 5, rail: 2, railAlpha: 0.55 },
    clay: { disc: 0.74, rimLine: 1.2, cross: 0.5 }, // cross: the decoy's mark, as a fraction of its radius
    flip: { time: 0.25, min: 0.08 }, // A flip target turns edge-on over its last `time` seconds (never thinner than `min`)
    plate: { shut: 0.45, r: 1.1, inner: 0.86, rivet: 2.2, glow: [1.2, 1.32], dash: 12, ring: 7, pip: 5, pipGap: 8, pipTray: 3 },
    core: { pulse: 5, glow: [7, 14], glowAlpha: [0.22, 0.12], amp: 3, spec: 0.68 },
    pip: { w: 6, h: 9, gap: 11 }, // Combo pips drawn as brass casings
    mult: { size: 24, swell: 0.5, pulse: 0.25, x: 128, dy: 50, flip: 170 }, // The multiplier beside the lane: size in design units, swell on a step, seconds it swells, where it sits, and the gun height below which it goes under the line
    intro: { y: 66, hold: 5, fade: 1.5 }, // The one-line intro (Boss 2's "Every plate scores", Accuracy 4 and 5's dodge line): design-space height, seconds shown, seconds to fade
    menu: { ext: 18, rackH: 58, gap: 4, tileMin: 46, tileMax: 66, selMin: 178, selMax: 236, laneGap: 2, label: 74, btnH: 44, edge: 4 }, // The menu (v0.5 N): the rung art's half size, the gun rack's height and gap, its small and selected tiles' widths, the space between lanes, the lane label's width, the corner buttons' height, the margin to the screen edge
    missions: { th: 104, gap: 8, rail: 44, lock: 16, lockGap: 10 }, // Missions tile height, gap, scroll rail width, the Gauntlet padlock's size and its gap to the label
  },
};
const T = TUNING;
const A = T.art, P = A.palette, TY = A.type, PI2 = Math.PI * 2;
T.bg = P.letterbox; // the engine reads this name for the letterbox
const STEP = T.physicsStep;
const DEG = Math.PI / 180;
const GUN_IDS = ['pistol', 'carbine', 'shotgun', 'rifle', 'smg', 'revolver'];
// Gauntlet: one level of each ladder in a row, each at two stars or better.
const GAUNTLET = ['a2', 's2', 'k2', 'b1'];

// Challenge data. Positions come from makeRng(seed) in setup only (build below); resolution is deterministic.
// x is the range of target centres, yBand the fraction (0 top, 1 bottom) of the legal height band, minDy the least
// height change from the previous target (met unless the band cannot allow it). behaviour: still, dodge (Accuracy);
// approach, weave, horde (Speed). speedMul scales approachSpeed (Speed 1, 2, 3 = 60, 80, 100 at the default tuning).
// Skeet: launches at skeetEvery seconds, angle range in degrees, skeetMul scales skeetSpeed, pair launches two at once.
// Boss: parts in order, then the core (coreScale, coreBull scale the core and its bullseye).
// Stars (PRD v0.5 A and K): the bars come from BARS, the scores of noisy bots with each gun, read at the noise TUNE sets. The perfect-run score in each comment is
// the pistol's, the ceiling its bars sit under (starCap); another gun has its own perfect run and bars.
const CHALLENGES = [
  { // Teaches the kick: the second quick shot sails high. Perfect run 2150.
    id: 'a1', ladder: 'accuracy', level: 1, name: 'Accuracy 1', seed: 41001, behaviour: 'still',
    accTargets: 8, accAmmo: 12, scale: 1.3, x: [370, 430], yBand: [0.15, 0.9], minDy: 50,
  },
  { // Teaches tip 2: nudge down as you fire. Perfect run 2950.
    id: 'a2', ladder: 'accuracy', level: 2, name: 'Accuracy 2', seed: 41002, behaviour: 'still',
    accTargets: 10, accAmmo: 13, scale: 1.0, x: [300, 560], yBand: [0, 1], minDy: 70,
  },
  { // Teaches tip 5: every third target is high and the one before it low (the rest sit mid-height), so every change is at least
    // minDy and the kick can carry the barrel to the high ones. Perfect run 3750.
    id: 'a3', ladder: 'accuracy', level: 3, name: 'Accuracy 3', seed: 41003, behaviour: 'still',
    accTargets: 12, accAmmo: 14, scale: 0.8, x: [520, 612], yBand: [0.35, 0.6], minDy: 70,
    high: { every: 3, band: [0, 0.2], before: [0.6, 1] },
  },
  { // Dodgers: a shot near a target wearing the dashed orange ring makes it jump (armed from its first frame), so fire once to make it jump, then again at where it landed. Perfect run 2950.
    id: 'a4', ladder: 'accuracy', level: 4, name: 'Accuracy 4', seed: 41004, behaviour: 'dodge',
    accTargets: 10, accAmmo: 24, scale: 0.9, x: [400, 600], yBand: [0, 1], minDy: 70,
  },
  { // v0.4. Small far targets: the dodgers of Accuracy 4 (fire once to make it jump, then again where it landed) and every third target a flip
    // target that shows for flipWindow seconds and turns away, a miss costing nothing but the window. Tests sway control and the first shot.
    // Naked run: the pistol's kick recovery (0.25 s) is inside the window. Perfect run 3750 (twelve bullseyes). Windows by the perfect-path rule: the flip window
    // is 1.5 times the slowest flip target on a keyboard-speed perfect path (0.97 s, gun travelling at keyMoveSpeed), accLife 4 s is 2.25 times the slowest dodger (1.78 s).
    id: 'a5', ladder: 'accuracy', level: 5, name: 'Accuracy 5', seed: 41005, behaviour: 'dodge',
    accTargets: 12, accAmmo: 22, scale: 0.7, x: [500, 612], yBand: [0, 1], minDy: 70, accLife: 4, flipEvery: 3, flipWindow: 1.5,
  },
  { // Teaches prioritising: one target at a time. Perfect run 4150.
    id: 's1', ladder: 'speed', level: 1, name: 'Speed 1', seed: 42001, behaviour: 'approach',
    speedSeconds: 25, spawnEvery: 2.0, speedMul: 1, maxTargets: 1, scale: 1.2, yBand: [0.1, 0.9], minDy: 60,
  },
  { // Perfect run 7350.
    id: 's2', ladder: 'speed', level: 2, name: 'Speed 2', seed: 42002, behaviour: 'approach',
    speedSeconds: 30, spawnEvery: 1.4, speedMul: 4 / 3, maxTargets: 2, scale: 1.0, yBand: [0, 1], minDy: 80,
  },
  { // Weavers: every target oscillates, so the line has to keep chasing it. The band leaves room for the weave and
    // is only 106 tall, so minDy is 50, the most it allows. Perfect run 12950.
    id: 's3', ladder: 'speed', level: 3, name: 'Speed 3', seed: 42003, behaviour: 'weave',
    speedSeconds: 35, spawnEvery: 1.0, speedMul: 5 / 3, maxTargets: 3, scale: 0.9, yBand: [0.22, 0.78], minDy: 50,
  },
  { // Hordes: a column of small targets drifting left, each worth outer-ring points. Perfect run 3630.
    id: 's4', ladder: 'speed', level: 4, name: 'Speed 4', seed: 42004, behaviour: 'horde',
    speedSeconds: 35, spawnEvery: 4.5, speedMul: 0.7, maxTargets: 12, scale: 0.55, yBand: [0, 1], minDy: 60,
    hordeSpacing: 30, hordeJitterX: 16, hordeJitterY: 3, // column spacing, and how loose the column is (x and y)
  },
  { // v0.4. Two hordes back to back with a weaving pair between them, twice, on a tighter clock than Speed 4. Burst discipline: the fire interval is
    // under the kick recovery, so holding fire climbs off the column. Naked run: every member is worth outer points, the pair can be left alone at a cost
    // of the combo only. Perfect run 3310 (28 hits, last kill 18.34 s); the timer is that rounded up to a multiple of 5 like Speed 1 to 4 (20 s against Speed 4's 35).
    id: 's5', ladder: 'speed', level: 5, name: 'Speed 5', seed: 42005, behaviour: 'horde',
    speedSeconds: 20, speedMul: 0.8, maxTargets: 16, scale: 0.55, yBand: [0, 1], minDy: 60,
    hordeSpacing: 30, hordeJitterX: 16, hordeJitterY: 3, pairScale: 0.9, pairMul: 1.4, pairBand: [0.2, 0.8], pairGap: 70,
    waves: [{ at: 0.6, horde: true }, { at: 3.6, pair: true }, { at: 6.6, horde: true }, { at: 11.6, horde: true }, { at: 14.6, pair: true }, { at: 17.6, horde: true }],
  },
  { // Clay pigeons from the bottom right; only bullseye and inner count. Perfect run 2950.
    id: 'k1', ladder: 'skeet', level: 1, name: 'Skeet 1', seed: 43001,
    skeetCount: 10, skeetEvery: 2.4, skeetMul: 0.9, pair: false, angle: [58, 68], launchSpread: 30, scale: 1.2,
  },
  { // Two at once. Perfect run 3750.
    id: 'k2', ladder: 'skeet', level: 2, name: 'Skeet 2', seed: 43002,
    skeetCount: 12, skeetEvery: 2.6, skeetMul: 1.0, pair: true, angle: [56, 66], pairSplit: 0.4, pairDx: 46, scale: 1.0, // the pair's angles come from the low and high 40 percent of the range; the second launches pairDx to the left
  },
  { // v0.4. Three launches a volley from alternating sides, one of them a decoy in the player's orange: shot, it costs its zone value and the combo.
    // Goal clays stay cyan. Tests target discrimination under speed. Naked run: leave the decoy, shoot the two cyan ones. Perfect run 2950 (ten bullseyes on the goal clays).
    // The 0.6 s between launches is 1.5 times the 0.4 s a keyboard-speed perfect path needs to switch clays (at 0.3 s it drops one). The left station sits mid-field
    // (leftX) and lobs steeply toward the wall, so no clay is launched near the gun; every clay is smaller than Skeet 2's (0.75), so the angle that hits a bullseye is
    // about Skeet 2's from the left station (4.5 units at 360, against 6 at 512) and tighter from the right (4.5 at 515), and a bot at 1 and 2 degrees does no better here.
    id: 'k3', ladder: 'skeet', level: 3, name: 'Skeet 3', seed: 43003,
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
    id: 'b2', ladder: 'boss', level: 2, name: 'Boss 2', seed: 44002,
    bossSeconds: 24, scale: 0.85, plateHp: 3, startReveal: 2,
    wall: [[430, 80], [350, 116], [495, 153], [385, 189], [465, 226], [350, 262]], // plate positions: no two share a height band, so a level shot at any plate never crosses another
    coreX: 585, coreBand: [145, 205], coreScale: 0.9, coreBull: 0.6, coreHp: 9, coreDrift: 35,
  },
  { // v0.5 G and L. Zombies walk to the fence at the near edge and the run ends when one touches it; waves are fixed and seeded. Types (T.zombie.types): s Shambler, r Runner (1.6 times
    // the speed, head bobbing), c Crawler (on the ground, brain low), b Brute (tall, body 5 hp, head high), h Hunched (the body shields the brain). `mul` scales every speed on the rung,
    // `gap` is the seconds between one zombie of a wave entering and the next, `force` the seconds after a wave enters that the next comes regardless.
    id: 'z1', ladder: 'zombie', level: 1, name: 'Zombies 1', seed: 45001,
    waves: ['ss', 'scs', 'shs'], gap: [1.6, 2.6], force: 22, mul: 1,
  },
  { id: 'z2', ladder: 'zombie', level: 2, name: 'Zombies 2', seed: 45002,
    waves: ['src', 'shcr', 'srchs', 'crbhs'], gap: [0.9, 1.8], force: 12, mul: 1.15,
  },
  { id: 'z3', ladder: 'zombie', level: 3, name: 'Zombies 3', seed: 45003,
    waves: ['rbch', 'srhbc', 'rrbhcs', 'brhcsr', 'hrbrcs'], gap: [0.6, 1.3], force: 8, mul: 1.3,
  },
];
const ENDLESS_MIX_ICON = ['s', 'h', 'r']; // the crowd on a rung's icon: a Shambler, a Hunched, a Runner
// The endless mode: not a rung (no stars, not in the points), a daily seed and a high score. Waves come without end, larger and faster.
const ENDLESS = { id: 'zend', ladder: 'zombie', level: 0, name: 'Endless', endless: true, gap: [1.0, 2.2], seed: 45999 };
function chById(id) { return id === ENDLESS.id ? ENDLESS : CHALLENGES.find((c) => c.id === id); }

// Star bars (PRD v0.5 A, G, H and K): for each challenge and gun, the noisy bot's scores by aim noise. `m` is the mean score and `q` the 25th percentile, over 100 seeds of a bot whose
// every shot's barrel angle is off by a Gaussian of sigma degrees, sigma from 0 to 5 in steps of starGrid (index 0 is the perfect run). A bar is read off these curves at the
// active noise (TUNE), so a slider needs no re-run. Generated by the harness described in the changelog; regenerate whenever the sim changes.
const BARS = {
  a1: {
    pistol: { m: [2150, 2150, 2133, 2041, 1925, 1796, 1694, 1601, 1501, 1387, 1280, 1185, 1110, 1054, 996, 944, 902, 857, 826, 767, 731],
      q: [2150, 2150, 2150, 1950, 1850, 1675, 1525, 1445, 1310, 1205, 1080, 920, 835, 790, 760, 710, 695, 670, 625, 580, 550] },
    carbine: { m: [2150, 2150, 2133, 2041, 1925, 1796, 1694, 1601, 1501, 1387, 1280, 1185, 1110, 1054, 996, 944, 900, 857, 824, 770, 735],
      q: [2150, 2150, 2150, 1950, 1850, 1675, 1525, 1445, 1310, 1205, 1080, 920, 835, 790, 760, 710, 695, 670, 625, 580, 555] },
    shotgun: { m: [2150, 2150, 2135, 2041, 1924, 1796, 1697, 1601, 1501, 1388, 1282, 1194, 1112, 1043, 998, 935, 899, 860, 827, 763, 730],
      q: [2150, 2150, 2150, 1950, 1825, 1675, 1525, 1425, 1310, 1205, 1080, 940, 835, 780, 775, 705, 695, 660, 625, 575, 545] },
    rifle: { m: [2150, 2150, 2135, 2041, 1924, 1795, 1696, 1618, 1519, 1414, 1292, 1206, 1130, 1067, 1033, 972, 918, 871, 829, 782, 765],
      q: [2150, 2150, 2150, 1950, 1825, 1675, 1535, 1465, 1345, 1245, 1065, 980, 865, 825, 790, 760, 700, 645, 595, 560, 560] },
    smg: { m: [2150, 2150, 2133, 2041, 1925, 1796, 1694, 1601, 1501, 1387, 1280, 1185, 1110, 1054, 996, 943, 902, 857, 824, 771, 736],
      q: [2150, 2150, 2150, 1950, 1850, 1675, 1525, 1445, 1310, 1205, 1080, 920, 835, 790, 760, 710, 695, 670, 625, 580, 575] },
    revolver: { m: [2150, 2150, 2134, 2051, 1877, 1759, 1618, 1532, 1444, 1333, 1217, 1139, 1069, 992, 920, 872, 833, 807, 757, 715, 714],
      q: [2150, 2150, 2150, 2000, 1750, 1650, 1475, 1360, 1245, 1170, 1040, 955, 845, 775, 735, 670, 655, 590, 570, 540, 515] },
  },
  a2: {
    pistol: { m: [2950, 2949, 2802, 2585, 2365, 2168, 1973, 1765, 1605, 1449, 1317, 1193, 1106, 1033, 941, 868, 809, 753, 702, 638, 590],
      q: [2950, 2950, 2750, 2425, 2195, 1970, 1735, 1460, 1305, 1110, 1075, 855, 815, 775, 705, 600, 515, 470, 465, 405, 355] },
    carbine: { m: [2950, 2949, 2802, 2585, 2365, 2168, 1973, 1765, 1599, 1449, 1315, 1196, 1108, 1036, 946, 872, 813, 753, 702, 641, 599],
      q: [2950, 2950, 2750, 2425, 2195, 1970, 1735, 1460, 1300, 1110, 1075, 880, 820, 775, 685, 590, 530, 490, 465, 420, 390] },
    shotgun: { m: [2950, 2949, 2802, 2584, 2364, 2170, 1981, 1765, 1608, 1438, 1321, 1202, 1106, 1031, 963, 877, 815, 756, 719, 657, 604],
      q: [2950, 2950, 2750, 2425, 2180, 1970, 1735, 1460, 1300, 1110, 1075, 880, 815, 775, 710, 610, 515, 515, 490, 435, 400] },
    rifle: { m: [2950, 2949, 2801, 2579, 2361, 2170, 1971, 1761, 1613, 1455, 1332, 1218, 1131, 1051, 964, 876, 808, 751, 715, 673, 594],
      q: [2950, 2950, 2750, 2425, 2180, 1970, 1700, 1445, 1295, 1140, 1070, 920, 840, 805, 710, 660, 540, 515, 480, 445, 390] },
    smg: { m: [2950, 2949, 2802, 2585, 2365, 2168, 1973, 1766, 1603, 1452, 1315, 1196, 1112, 1036, 946, 876, 808, 751, 700, 643, 598],
      q: [2950, 2950, 2750, 2425, 2195, 1970, 1735, 1460, 1305, 1110, 1075, 880, 820, 775, 685, 590, 515, 470, 460, 435, 390] },
    revolver: { m: [2950, 2947, 2804, 2579, 2357, 2133, 1950, 1780, 1615, 1437, 1258, 1128, 1028, 971, 885, 796, 722, 666, 611, 562, 533],
      q: [2950, 2950, 2750, 2425, 2175, 1905, 1700, 1465, 1340, 1120, 940, 795, 725, 655, 535, 535, 450, 415, 400, 385, 345] },
  },
  a3: {
    pistol: { m: [3750, 3690, 3248, 2825, 2423, 2028, 1699, 1394, 1163, 941, 838, 700, 613, 545, 501, 440, 391, 338, 306, 282, 266],
      q: [3750, 3650, 3100, 2615, 2240, 1735, 1380, 1090, 805, 640, 570, 450, 420, 320, 310, 240, 215, 135, 120, 100, 70] },
    carbine: { m: [3750, 3690, 3248, 2825, 2425, 2026, 1712, 1422, 1211, 1021, 901, 779, 666, 626, 572, 512, 461, 432, 404, 370, 349],
      q: [3750, 3650, 3100, 2615, 2240, 1730, 1380, 1085, 880, 755, 655, 590, 480, 435, 410, 365, 320, 280, 270, 260, 225] },
    shotgun: { m: [3750, 3700, 3273, 2860, 2462, 2013, 1687, 1358, 1133, 931, 809, 688, 590, 529, 485, 418, 394, 355, 340, 315, 297],
      q: [3750, 3675, 3100, 2625, 2240, 1625, 1270, 935, 775, 625, 540, 470, 405, 315, 325, 260, 260, 240, 220, 210, 195] },
    rifle: { m: [3750, 3675, 3074, 2623, 2132, 1692, 1283, 1033, 893, 739, 658, 591, 553, 494, 460, 430, 396, 375, 362, 343, 315],
      q: [3750, 3600, 2875, 2380, 1875, 1335, 980, 765, 635, 525, 470, 410, 370, 325, 280, 280, 265, 245, 240, 220, 175] },
    smg: { m: [3750, 3690, 3248, 2825, 2422, 2024, 1710, 1407, 1193, 996, 890, 764, 660, 608, 548, 502, 451, 401, 368, 343, 310],
      q: [3750, 3650, 3100, 2615, 2240, 1730, 1375, 1060, 845, 740, 655, 570, 460, 415, 385, 340, 295, 245, 220, 210, 140] },
    revolver: { m: [3750, 3665, 3000, 2447, 1943, 1454, 1160, 893, 712, 575, 498, 437, 394, 353, 328, 309, 286, 256, 244, 252, 239],
      q: [3750, 3550, 2800, 2280, 1690, 1155, 870, 650, 535, 370, 290, 260, 225, 215, 180, 190, 165, 140, 140, 150, 140] },
  },
  a4: {
    pistol: { m: [2950, 2938, 2514, 1917, 1595, 1362, 1141, 983, 819, 721, 645, 557, 507, 455, 398, 328, 293, 270, 245, 215, 201],
      q: [2950, 2950, 2150, 1570, 1255, 1075, 885, 720, 620, 535, 480, 370, 320, 300, 270, 200, 170, 165, 110, 100, 90] },
    carbine: { m: [2950, 2938, 2510, 1934, 1597, 1358, 1158, 1002, 838, 743, 672, 596, 543, 482, 441, 413, 393, 385, 358, 349, 330],
      q: [2950, 2950, 2150, 1600, 1275, 1110, 925, 740, 630, 565, 530, 460, 410, 370, 350, 295, 270, 290, 270, 265, 240] },
    shotgun: { m: [2950, 2942, 2750, 2464, 2199, 1933, 1722, 1509, 1353, 1191, 1085, 1019, 903, 869, 806, 713, 670, 655, 628, 623, 590],
      q: [2950, 2950, 2625, 2275, 1980, 1645, 1480, 1245, 1080, 940, 830, 765, 665, 670, 615, 500, 485, 485, 460, 460, 470] },
    rifle: { m: [2950, 2935, 2505, 1910, 1590, 1331, 1147, 954, 786, 695, 568, 490, 429, 369, 325, 298, 275, 250, 241, 210, 192],
      q: [2950, 2950, 2125, 1550, 1275, 1025, 860, 720, 565, 515, 405, 320, 280, 230, 190, 190, 170, 150, 150, 130, 120] },
    smg: { m: [2950, 2938, 2517, 1933, 1597, 1358, 1168, 1003, 830, 744, 663, 598, 549, 481, 431, 406, 380, 371, 323, 306, 273],
      q: [2950, 2950, 2200, 1600, 1275, 1110, 925, 740, 625, 565, 530, 465, 400, 365, 335, 270, 260, 265, 240, 210, 190] },
    revolver: { m: [2950, 2942, 2545, 1871, 1429, 1154, 943, 793, 642, 540, 433, 375, 339, 306, 259, 247, 224, 210, 189, 186, 169],
      q: [2950, 2950, 2250, 1475, 1080, 825, 650, 535, 430, 370, 295, 245, 220, 190, 145, 140, 120, 110, 100, 90, 80] },
  },
  a5: {
    pistol: { m: [3750, 3639, 2835, 2046, 1532, 1265, 993, 726, 626, 505, 409, 341, 311, 265, 225, 212, 198, 162, 128, 118, 113],
      q: [3750, 3550, 2500, 1650, 1145, 875, 695, 445, 400, 315, 240, 190, 150, 120, 100, 90, 70, 70, 40, 50, 50] },
    carbine: { m: [3750, 3636, 2801, 2012, 1530, 1226, 977, 814, 683, 620, 524, 459, 413, 368, 357, 329, 295, 269, 230, 206, 189],
      q: [3750, 3550, 2450, 1570, 1145, 835, 695, 605, 520, 460, 360, 320, 250, 220, 210, 170, 140, 120, 100, 70, 70] },
    shotgun: { m: [3750, 3660, 3049, 2587, 2113, 1729, 1388, 1056, 879, 765, 717, 625, 522, 472, 453, 431, 416, 385, 344, 333, 327],
      q: [3750, 3550, 2885, 2330, 1800, 1405, 1070, 740, 635, 475, 455, 435, 355, 320, 320, 270, 270, 230, 195, 190, 200] },
    rifle: { m: [3750, 3615, 2577, 1817, 1337, 988, 728, 536, 426, 341, 305, 287, 265, 237, 227, 193, 161, 155, 148, 132, 124],
      q: [3750, 3550, 2275, 1315, 835, 685, 530, 345, 265, 220, 215, 185, 170, 150, 135, 100, 70, 70, 70, 60, 50] },
    smg: { m: [3750, 3634, 2798, 2016, 1529, 1229, 981, 801, 687, 591, 517, 438, 371, 330, 305, 268, 240, 223, 200, 183, 166],
      q: [3750, 3550, 2450, 1590, 1100, 845, 705, 590, 540, 435, 370, 305, 235, 180, 150, 120, 90, 80, 40, 40, 20] },
    revolver: { m: [3750, 3575, 2404, 1439, 1026, 675, 535, 418, 329, 283, 222, 184, 163, 143, 140, 128, 122, 118, 104, 96, 98],
      q: [3750, 3550, 1915, 1100, 765, 535, 390, 295, 200, 170, 110, 100, 70, 60, 70, 50, 40, 40, 40, 20, 40] },
  },
  s1: {
    pistol: { m: [4150, 4147, 3909, 3517, 3175, 2801, 2442, 2131, 1872, 1628, 1482, 1327, 1222, 1167, 1089, 1035, 989, 968, 944, 909, 874],
      q: [4150, 4150, 3800, 3350, 2985, 2555, 2125, 1690, 1525, 1300, 1210, 1055, 995, 995, 910, 890, 835, 785, 755, 750, 730] },
    carbine: { m: [4150, 4147, 3909, 3517, 3175, 2801, 2443, 2130, 1869, 1639, 1478, 1330, 1228, 1170, 1095, 1053, 998, 977, 962, 941, 906],
      q: [4150, 4150, 3800, 3350, 2985, 2555, 2125, 1690, 1525, 1315, 1215, 1090, 1010, 990, 930, 910, 845, 825, 795, 780, 770] },
    shotgun: { m: [4150, 4147, 3909, 3517, 3175, 2802, 2441, 2128, 1861, 1634, 1465, 1318, 1225, 1151, 1066, 1030, 990, 966, 949, 920, 889],
      q: [4150, 4150, 3800, 3350, 2985, 2555, 2125, 1690, 1460, 1310, 1190, 1085, 1010, 960, 870, 885, 835, 815, 760, 750, 730] },
    rifle: { m: [4150, 4147, 3909, 3517, 3175, 2803, 2441, 2125, 1839, 1624, 1466, 1292, 1172, 1111, 1030, 970, 917, 886, 874, 856, 827],
      q: [4150, 4150, 3800, 3350, 2985, 2580, 2125, 1670, 1435, 1310, 1125, 985, 940, 890, 880, 800, 760, 705, 700, 700, 665] },
    smg: { m: [4150, 4147, 3909, 3517, 3175, 2801, 2443, 2130, 1869, 1630, 1473, 1328, 1228, 1171, 1093, 1045, 1008, 974, 961, 941, 904],
      q: [4150, 4150, 3800, 3350, 2985, 2555, 2125, 1690, 1505, 1315, 1210, 1080, 1005, 995, 940, 915, 855, 820, 805, 770, 740] },
    revolver: { m: [3750, 3747, 3523, 3169, 2874, 2571, 2297, 2005, 1783, 1605, 1450, 1231, 1146, 1052, 955, 912, 850, 826, 802, 764, 715],
      q: [3750, 3750, 3400, 3005, 2710, 2355, 2020, 1740, 1435, 1300, 1145, 975, 935, 865, 725, 715, 665, 660, 645, 610, 570] },
  },
  s2: {
    pistol: { m: [7350, 7318, 6565, 5745, 5017, 4239, 3604, 3074, 2644, 2304, 2151, 1969, 1847, 1757, 1675, 1597, 1491, 1487, 1461, 1426, 1398],
      q: [7350, 7350, 6350, 5460, 4595, 3825, 3195, 2550, 2260, 2010, 1855, 1695, 1535, 1480, 1450, 1350, 1255, 1315, 1295, 1215, 1190] },
    carbine: { m: [7350, 7318, 6565, 5745, 5017, 4239, 3605, 3065, 2630, 2338, 2151, 1981, 1876, 1773, 1693, 1647, 1578, 1541, 1497, 1463, 1424],
      q: [7350, 7350, 6350, 5460, 4595, 3825, 3195, 2590, 2215, 2025, 1860, 1700, 1620, 1535, 1465, 1435, 1370, 1335, 1260, 1280, 1220] },
    shotgun: { m: [7350, 7318, 6565, 5745, 5019, 4240, 3601, 3068, 2641, 2343, 2135, 1995, 1883, 1776, 1709, 1653, 1581, 1541, 1488, 1435, 1417],
      q: [7350, 7350, 6350, 5460, 4595, 3900, 3195, 2595, 2210, 2035, 1870, 1735, 1645, 1530, 1475, 1445, 1390, 1375, 1275, 1260, 1230] },
    rifle: { m: [7350, 7322, 6601, 5771, 5048, 4311, 3645, 3143, 2738, 2383, 2163, 2002, 1847, 1708, 1653, 1597, 1539, 1519, 1445, 1402, 1336],
      q: [7350, 7350, 6400, 5555, 4640, 3935, 3195, 2650, 2310, 2050, 1825, 1720, 1610, 1510, 1475, 1365, 1285, 1265, 1210, 1155, 1125] },
    smg: { m: [7350, 7318, 6565, 5745, 5017, 4239, 3602, 3059, 2631, 2331, 2124, 1976, 1880, 1771, 1712, 1630, 1541, 1486, 1476, 1423, 1419],
      q: [7350, 7350, 6350, 5460, 4595, 3825, 3195, 2570, 2220, 2010, 1825, 1690, 1615, 1540, 1495, 1385, 1335, 1280, 1240, 1245, 1230] },
    revolver: { m: [7350, 7324, 6582, 5725, 5027, 4196, 3518, 2853, 2518, 2112, 1909, 1757, 1613, 1546, 1465, 1387, 1364, 1271, 1235, 1164, 1177],
      q: [7350, 7350, 6350, 5470, 4725, 3780, 2925, 2255, 1965, 1750, 1595, 1445, 1355, 1325, 1220, 1160, 1155, 1090, 1025, 965, 995] },
  },
  s3: {
    pistol: { m: [12950, 12817, 11275, 9763, 8229, 6790, 5593, 4602, 3952, 3523, 3257, 2942, 2756, 2576, 2536, 2424, 2302, 2269, 2253, 2154, 2149],
      q: [12950, 12750, 10900, 9365, 7720, 6185, 4920, 3915, 3440, 3155, 2825, 2550, 2405, 2295, 2130, 2135, 1955, 2000, 2030, 1855, 1980] },
    carbine: { m: [12950, 12821, 11285, 9786, 8261, 6819, 5608, 4673, 3976, 3526, 3212, 2983, 2823, 2661, 2561, 2462, 2362, 2324, 2249, 2192, 2143],
      q: [12950, 12750, 10925, 9370, 7720, 6195, 4890, 4005, 3460, 3200, 2840, 2630, 2540, 2360, 2255, 2205, 2090, 2045, 2000, 1980, 1895] },
    shotgun: { m: [12950, 12817, 11275, 9763, 8231, 6792, 5581, 4648, 3985, 3545, 3247, 3000, 2829, 2705, 2582, 2499, 2412, 2326, 2330, 2269, 2232],
      q: [12950, 12750, 10900, 9365, 7720, 6185, 4875, 4010, 3510, 3145, 2795, 2665, 2460, 2340, 2240, 2210, 2095, 2090, 2130, 1975, 1935] },
    rifle: { m: [12950, 12838, 11456, 9992, 8443, 6988, 5896, 5333, 4946, 4818, 4600, 4273, 3992, 3841, 3649, 3511, 3397, 3253, 3175, 3127, 3022],
      q: [12950, 12750, 11150, 9665, 7850, 6465, 5265, 4740, 4430, 4265, 4155, 3710, 3510, 3380, 3230, 3090, 3005, 2770, 2695, 2640, 2625] },
    smg: { m: [12950, 12819, 11279, 9772, 8244, 6789, 5586, 4628, 3958, 3505, 3197, 3081, 2806, 2676, 2546, 2406, 2324, 2256, 2238, 2170, 2146],
      q: [12950, 12750, 10900, 9365, 7720, 6170, 4875, 3980, 3465, 3145, 2730, 2720, 2460, 2315, 2185, 2140, 2055, 2010, 1965, 1885, 1865] },
    revolver: { m: [11350, 11300, 10665, 9731, 8797, 7836, 7185, 6677, 6064, 5650, 5227, 4934, 4558, 4188, 4019, 3817, 3552, 3277, 3247, 3119, 2986],
      q: [11350, 11250, 10450, 9500, 8435, 7450, 6640, 6205, 5405, 5065, 4505, 4170, 3825, 3515, 3485, 3330, 2860, 2710, 2670, 2475, 2340] },
  },
  s4: {
    pistol: { m: [3630, 3630, 3566, 3085, 2427, 2135, 1862, 1655, 1595, 1492, 1462, 1438, 1365, 1340, 1297, 1302, 1264, 1242, 1232, 1235, 1250],
      q: [3630, 3630, 3430, 2940, 2210, 1930, 1670, 1490, 1490, 1400, 1350, 1340, 1270, 1240, 1200, 1220, 1180, 1170, 1150, 1160, 1190] },
    carbine: { m: [3630, 3630, 3593, 3128, 2657, 2264, 1988, 1846, 1734, 1624, 1535, 1512, 1405, 1395, 1329, 1319, 1284, 1278, 1315, 1322, 1319],
      q: [3630, 3630, 3630, 2940, 2420, 2030, 1790, 1690, 1560, 1460, 1380, 1350, 1280, 1240, 1180, 1190, 1200, 1160, 1200, 1210, 1200] },
    shotgun: { m: [3190, 3223, 3242, 3240, 3239, 3244, 3256, 3262, 3260, 3265, 3262, 3224, 3227, 3206, 3172, 3120, 3045, 3056, 3023, 2977, 2885],
      q: [3190, 3190, 3190, 3190, 3190, 3190, 3190, 3190, 3190, 3190, 3200, 3190, 3190, 3190, 3170, 2910, 2850, 2810, 2800, 2720, 2630] },
    rifle: { m: [2990, 2984, 2986, 2900, 2720, 2504, 2418, 2273, 2195, 2132, 2096, 2000, 1977, 1907, 1846, 1738, 1740, 1719, 1636, 1568, 1562],
      q: [2990, 2990, 2990, 2730, 2620, 2350, 2260, 2120, 2060, 1950, 1890, 1710, 1750, 1660, 1590, 1520, 1500, 1440, 1390, 1330, 1250] },
    smg: { m: [3630, 3630, 3584, 3165, 2566, 2214, 1954, 1818, 1690, 1575, 1483, 1456, 1388, 1376, 1351, 1302, 1297, 1241, 1249, 1227, 1203],
      q: [3630, 3630, 3630, 3000, 2370, 1970, 1800, 1650, 1540, 1430, 1390, 1340, 1290, 1290, 1260, 1190, 1210, 1150, 1150, 1140, 1120] },
    revolver: { m: [2170, 2170, 2173, 2134, 1986, 1835, 1697, 1591, 1492, 1441, 1403, 1372, 1298, 1240, 1213, 1177, 1147, 1110, 1062, 1025, 1027],
      q: [2170, 2170, 2170, 2170, 1850, 1690, 1480, 1410, 1210, 1280, 1210, 1170, 1150, 1070, 1050, 990, 970, 900, 890, 860, 850] },
  },
  s5: {
    pistol: { m: [3310, 3290, 3080, 2602, 2079, 1681, 1462, 1311, 1147, 1091, 1010, 983, 967, 939, 896, 926, 870, 859, 842, 838, 850],
      q: [3310, 3310, 2910, 2375, 1830, 1460, 1240, 1090, 1010, 970, 890, 875, 860, 810, 800, 785, 790, 760, 750, 760, 770] },
    carbine: { m: [3310, 3290, 3042, 2596, 2099, 1776, 1553, 1394, 1268, 1139, 1072, 1033, 993, 974, 914, 913, 872, 853, 848, 818, 813],
      q: [3310, 3310, 2910, 2350, 1725, 1515, 1335, 1195, 1060, 980, 940, 885, 880, 860, 800, 800, 780, 760, 760, 715, 720] },
    shotgun: { m: [2750, 2744, 2612, 2497, 2354, 2216, 2058, 1946, 1853, 1777, 1735, 1703, 1673, 1599, 1547, 1539, 1531, 1503, 1460, 1447, 1416],
      q: [2750, 2750, 2535, 2390, 2215, 2010, 1805, 1700, 1600, 1510, 1545, 1440, 1390, 1320, 1260, 1260, 1260, 1230, 1215, 1220, 1155] },
    rifle: { m: [2830, 2830, 2807, 2646, 2353, 2097, 1964, 1830, 1701, 1649, 1535, 1492, 1382, 1328, 1323, 1263, 1211, 1177, 1151, 1103, 1111],
      q: [2830, 2830, 2830, 2530, 2090, 1860, 1755, 1620, 1500, 1440, 1280, 1280, 1125, 1060, 1040, 985, 920, 940, 920, 850, 855] },
    smg: { m: [3310, 3282, 3030, 2622, 2004, 1720, 1500, 1294, 1188, 1139, 1108, 1042, 995, 947, 938, 919, 891, 886, 866, 859, 859],
      q: [3310, 3310, 2910, 2380, 1715, 1455, 1295, 1140, 1055, 1015, 970, 900, 870, 810, 830, 810, 785, 810, 780, 770, 755] },
    revolver: { m: [2190, 2190, 2184, 2063, 1696, 1386, 1188, 1080, 1004, 970, 939, 949, 952, 914, 855, 849, 817, 762, 790, 787, 742],
      q: [2190, 2190, 2190, 1990, 1250, 1130, 1020, 920, 905, 855, 760, 815, 820, 740, 690, 665, 640, 580, 600, 605, 590] },
  },
  k1: {
    pistol: { m: [2950, 2949, 2791, 2447, 2104, 1784, 1520, 1349, 1248, 1152, 1098, 1049, 1016, 994, 959, 943, 927, 921, 907, 899, 884],
      q: [2950, 2950, 2700, 2275, 1725, 1400, 1250, 1075, 1025, 975, 925, 900, 825, 825, 825, 825, 825, 825, 800, 800, 775] },
    carbine: { m: [2950, 2949, 2791, 2447, 2104, 1782, 1519, 1350, 1250, 1154, 1092, 1043, 1015, 991, 955, 935, 921, 916, 901, 888, 872],
      q: [2950, 2950, 2700, 2275, 1725, 1400, 1250, 1075, 1000, 975, 925, 900, 850, 850, 825, 800, 825, 800, 800, 775, 750] },
    shotgun: { m: [2950, 2949, 2791, 2447, 2104, 1781, 1524, 1361, 1249, 1150, 1097, 1036, 1010, 989, 947, 918, 894, 867, 853, 843, 817],
      q: [2950, 2950, 2700, 2275, 1725, 1400, 1250, 1075, 1000, 975, 925, 875, 825, 825, 800, 800, 775, 725, 750, 725, 700] },
    rifle: { m: [2950, 2949, 2791, 2447, 2079, 1742, 1484, 1326, 1195, 1082, 1003, 933, 891, 857, 810, 754, 730, 685, 667, 634, 607],
      q: [2950, 2950, 2700, 2275, 1725, 1375, 1200, 1075, 950, 875, 775, 725, 700, 650, 650, 600, 600, 525, 525, 500, 475] },
    smg: { m: [2950, 2949, 2791, 2447, 2106, 1783, 1520, 1351, 1247, 1157, 1092, 1047, 1015, 991, 959, 937, 924, 916, 904, 903, 885],
      q: [2950, 2950, 2700, 2275, 1725, 1400, 1250, 1075, 1000, 975, 925, 900, 825, 825, 825, 825, 800, 800, 800, 800, 800] },
    revolver: { m: [2950, 2949, 2791, 2440, 2093, 1751, 1486, 1296, 1186, 1084, 975, 903, 833, 772, 745, 722, 690, 620, 598, 576, 539],
      q: [2950, 2950, 2700, 2275, 1650, 1350, 1200, 1025, 925, 875, 775, 725, 675, 600, 575, 575, 550, 475, 475, 450, 400] },
  },
  k2: {
    pistol: { m: [3750, 3738, 3396, 2848, 2271, 1875, 1623, 1453, 1343, 1261, 1205, 1177, 1148, 1124, 1140, 1122, 1085, 1056, 1044, 1035, 1028],
      q: [3750, 3750, 3275, 2500, 1850, 1500, 1300, 1200, 1125, 1075, 1050, 1025, 1025, 1000, 1025, 975, 975, 950, 950, 925, 925] },
    carbine: { m: [3750, 3738, 3397, 2836, 2255, 1870, 1610, 1437, 1330, 1252, 1192, 1138, 1115, 1096, 1081, 1052, 1024, 997, 995, 971, 971],
      q: [3750, 3750, 3275, 2475, 1850, 1525, 1300, 1225, 1100, 1075, 1050, 975, 1000, 975, 975, 950, 900, 875, 875, 850, 850] },
    shotgun: { m: [3750, 3739, 3432, 2931, 2384, 1946, 1717, 1514, 1397, 1306, 1258, 1219, 1180, 1135, 1107, 1069, 1025, 986, 965, 924, 903],
      q: [3750, 3750, 3300, 2675, 2000, 1600, 1400, 1275, 1175, 1150, 1075, 1025, 1025, 975, 975, 950, 925, 875, 825, 775, 725] },
    rifle: { m: [3750, 3739, 3477, 3006, 2457, 2006, 1725, 1476, 1256, 1106, 976, 886, 825, 749, 682, 620, 588, 556, 520, 498, 474],
      q: [3750, 3750, 3350, 2875, 1975, 1600, 1300, 1075, 900, 800, 750, 650, 600, 550, 500, 450, 450, 400, 350, 350, 350] },
    smg: { m: [3750, 3738, 3394, 2814, 2235, 1842, 1594, 1428, 1329, 1250, 1195, 1173, 1149, 1129, 1105, 1083, 1059, 1045, 1033, 1029, 1026],
      q: [3750, 3750, 3275, 2400, 1850, 1500, 1300, 1225, 1075, 1075, 1025, 1000, 1000, 1000, 975, 950, 925, 925, 925, 925, 925] },
    revolver: { m: [3750, 3711, 3521, 2945, 2318, 1765, 1496, 1323, 1152, 1038, 981, 887, 829, 795, 754, 710, 657, 606, 573, 531, 522],
      q: [3750, 3750, 3400, 2675, 1575, 1200, 1100, 950, 900, 825, 800, 700, 650, 625, 600, 525, 525, 475, 425, 400, 350] },
  },
  k3: {
    pistol: { m: [2950, 2915, 2523, 2036, 1614, 1354, 1186, 1075, 987, 956, 928, 871, 818, 804, 773, 737, 690, 679, 680, 650, 639],
      q: [2950, 2950, 2350, 1700, 1275, 1100, 950, 875, 850, 825, 775, 750, 700, 675, 650, 650, 550, 575, 575, 525, 525] },
    carbine: { m: [2950, 2915, 2523, 2044, 1610, 1360, 1207, 1110, 1007, 960, 919, 870, 838, 818, 775, 767, 724, 711, 695, 693, 672],
      q: [2950, 2950, 2350, 1700, 1275, 1100, 975, 925, 875, 800, 800, 725, 725, 700, 675, 675, 600, 600, 600, 575, 550] },
    shotgun: { m: [2950, 2915, 2523, 2043, 1599, 1344, 1167, 1057, 965, 888, 840, 779, 738, 693, 644, 618, 594, 578, 557, 527, 512],
      q: [2950, 2950, 2350, 1700, 1275, 1075, 925, 850, 800, 725, 675, 625, 600, 550, 525, 475, 475, 475, 425, 425, 400] },
    rifle: { m: [2950, 2923, 2559, 1945, 1464, 1194, 1023, 910, 804, 712, 640, 590, 553, 504, 448, 405, 393, 374, 355, 340, 324],
      q: [2950, 2950, 2475, 1500, 1025, 900, 800, 700, 600, 525, 425, 400, 350, 350, 300, 300, 275, 250, 225, 225, 200] },
    smg: { m: [2950, 2915, 2523, 2039, 1615, 1362, 1186, 1106, 1020, 971, 933, 896, 869, 855, 811, 782, 764, 752, 728, 721, 706],
      q: [2950, 2950, 2350, 1700, 1275, 1100, 975, 900, 900, 825, 800, 750, 750, 725, 700, 675, 675, 675, 625, 600, 600] },
    revolver: { m: [2950, 2916, 2548, 2065, 1624, 1294, 1064, 929, 827, 737, 628, 556, 505, 463, 429, 398, 365, 341, 319, 312, 284],
      q: [2950, 2950, 2475, 1725, 1250, 950, 750, 675, 600, 525, 425, 375, 325, 300, 250, 250, 225, 200, 200, 200, 150] },
  },
  b1: {
    pistol: { m: [3750, 3577, 2961, 2448, 1989, 1610, 1319, 1120, 990, 918, 899, 851, 834, 791, 793, 775, 757, 737, 720, 696, 715],
      q: [3750, 3550, 2775, 2260, 1785, 1395, 1155, 985, 860, 785, 745, 715, 715, 670, 655, 620, 650, 605, 615, 570, 615] },
    carbine: { m: [3750, 3591, 3011, 2605, 2285, 1955, 1644, 1396, 1218, 1085, 978, 917, 870, 858, 864, 829, 804, 770, 774, 782, 773],
      q: [3750, 3550, 2800, 2430, 2125, 1715, 1385, 1165, 950, 805, 700, 690, 690, 685, 705, 675, 660, 615, 615, 625, 615] },
    shotgun: { m: [1000, 1138, 1120, 1006, 911, 814, 692, 605, 535, 489, 428, 387, 351, 333, 308, 293, 285, 269, 253, 242, 233],
      q: [1000, 1000, 1000, 900, 800, 690, 525, 405, 355, 325, 295, 245, 215, 200, 190, 160, 170, 145, 140, 120, 120] },
    rifle: { m: [1000, 955, 863, 764, 695, 636, 586, 538, 497, 468, 442, 415, 392, 383, 366, 352, 348, 342, 332, 328, 320],
      q: [1000, 875, 775, 700, 600, 525, 475, 415, 390, 355, 350, 320, 310, 305, 280, 265, 265, 260, 260, 240, 235] },
    smg: { m: [3750, 3579, 3001, 2525, 2092, 1666, 1356, 1118, 942, 841, 805, 798, 814, 796, 751, 726, 704, 690, 710, 692, 686],
      q: [3750, 3550, 2775, 2330, 1860, 1410, 1100, 920, 795, 685, 655, 665, 655, 665, 620, 605, 600, 595, 610, 565, 555] },
    revolver: { m: [1000, 966, 861, 770, 693, 637, 574, 522, 490, 461, 418, 387, 363, 352, 342, 328, 328, 314, 309, 300, 284],
      q: [1000, 1000, 750, 675, 600, 515, 450, 380, 365, 345, 310, 275, 265, 260, 250, 245, 240, 215, 235, 230, 220] },
  },
  b2: {
    pistol: { m: [9750, 9479, 8637, 7788, 6973, 6206, 5585, 4996, 4584, 4240, 4025, 3781, 3660, 3412, 3236, 3086, 2946, 2891, 2743, 2685, 2568],
      q: [9750, 9350, 8400, 7500, 6570, 5775, 5100, 4595, 4105, 3740, 3585, 3345, 3205, 2990, 2805, 2670, 2535, 2450, 2320, 2280, 2180] },
    carbine: { m: [9750, 9481, 8637, 7786, 6971, 6205, 5575, 4956, 4522, 4109, 3829, 3635, 3418, 3237, 3095, 3014, 2922, 2916, 2834, 2791, 2651],
      q: [9750, 9350, 8400, 7500, 6570, 5805, 5085, 4455, 4050, 3665, 3380, 3125, 2945, 2750, 2740, 2670, 2575, 2525, 2415, 2350, 2305] },
    shotgun: { m: [4550, 3268, 2995, 2668, 2400, 2075, 1804, 1543, 1385, 1249, 1114, 996, 881, 807, 729, 690, 669, 635, 599, 563, 533],
      q: [4550, 2950, 2750, 2385, 2075, 1790, 1465, 1165, 1035, 890, 815, 695, 600, 565, 505, 485, 470, 455, 400, 385, 395] },
    rifle: { m: [2550, 2454, 2192, 1952, 1750, 1588, 1413, 1233, 1138, 1043, 994, 924, 877, 844, 822, 799, 790, 749, 735, 723, 681],
      q: [2550, 2350, 2075, 1800, 1575, 1370, 1180, 995, 960, 805, 765, 735, 685, 645, 640, 635, 625, 595, 570, 560, 530] },
    smg: { m: [9750, 9481, 8637, 7786, 6970, 6219, 5579, 5001, 4576, 4175, 3865, 3592, 3390, 3185, 2987, 2866, 2817, 2803, 2715, 2658, 2553],
      q: [9750, 9350, 8400, 7500, 6570, 5775, 5080, 4555, 4145, 3760, 3525, 3110, 2915, 2730, 2570, 2455, 2465, 2405, 2300, 2265, 2225] },
    revolver: { m: [2550, 2454, 2190, 1949, 1747, 1583, 1416, 1263, 1173, 1077, 1020, 948, 897, 852, 823, 788, 766, 731, 714, 704, 653],
      q: [2550, 2350, 2075, 1800, 1555, 1365, 1180, 1015, 975, 845, 830, 750, 705, 680, 680, 620, 625, 590, 565, 535, 515] },
  },
  z1: {
    pistol: { m: [3362, 3353, 3042, 2645, 2375, 2265, 2194, 2080, 2032, 1997, 1961, 1952, 1939, 1942, 1939, 1938, 1947, 1948, 1934, 1918, 1934],
      q: [3362, 3362, 2547, 2242, 2072, 2032, 1999, 1942, 1910, 1847, 1866, 1847, 1844, 1839, 1826, 1843, 1856, 1836, 1834, 1811, 1839] },
    carbine: { m: [3362, 3353, 3042, 2642, 2409, 2254, 2184, 2054, 2028, 2002, 1961, 1963, 1967, 1965, 1945, 1944, 1919, 1918, 1932, 1936, 1938],
      q: [3362, 3362, 2547, 2242, 2124, 2027, 1962, 1909, 1895, 1894, 1869, 1880, 1877, 1882, 1849, 1842, 1854, 1841, 1850, 1873, 1872] },
    shotgun: { m: [3542, 3536, 3253, 2953, 2884, 2873, 2874, 2795, 2718, 2743, 2730, 2722, 2734, 2668, 2715, 2752, 2699, 2697, 2669, 2614, 2621],
      q: [3542, 3542, 2792, 2579, 2570, 2497, 2471, 2494, 2466, 2495, 2451, 2482, 2431, 2402, 2421, 2458, 2424, 2382, 2368, 2361, 2399] },
    rifle: { m: [3502, 3493, 3170, 2791, 2574, 2437, 2389, 2273, 2256, 2256, 2222, 2241, 2243, 2214, 2200, 2203, 2191, 2181, 2169, 2182, 2191],
      q: [3502, 3502, 2737, 2402, 2254, 2204, 2172, 2137, 2157, 2149, 2103, 2144, 2113, 2121, 2114, 2114, 2124, 2081, 2074, 2061, 2096] },
    smg: { m: [3362, 3353, 3044, 2637, 2407, 2251, 2183, 2058, 2030, 2004, 1970, 1949, 1941, 1940, 1949, 1953, 1950, 1926, 1935, 1932, 1936],
      q: [3362, 3362, 2547, 2237, 2124, 2032, 1944, 1910, 1871, 1882, 1851, 1843, 1844, 1839, 1852, 1849, 1841, 1834, 1829, 1839, 1854] },
    revolver: { m: [3502, 3493, 3165, 2770, 2575, 2386, 2296, 2265, 2237, 2206, 2167, 2153, 2159, 2135, 2134, 2148, 2103, 2119, 2062, 2035, 2071],
      q: [3502, 3502, 2635, 2402, 2299, 2147, 2122, 2089, 2088, 2054, 2053, 2069, 2072, 2059, 2039, 2034, 2026, 2028, 1997, 1997, 2014] },
  },
  z2: {
    pistol: { m: [7002, 6993, 6359, 5540, 5005, 4760, 4533, 4428, 4361, 4257, 4203, 4200, 4151, 4165, 4150, 4121, 4163, 4153, 4141, 4127, 4135],
      q: [7002, 7002, 6082, 4967, 4624, 4406, 4239, 4227, 4144, 4106, 4073, 4060, 4035, 4043, 4003, 3992, 4020, 4006, 4001, 3995, 4014] },
    carbine: { m: [7002, 6994, 6481, 5524, 4976, 4698, 4510, 4423, 4333, 4289, 4243, 4178, 4233, 4153, 4151, 4188, 4181, 4168, 4110, 4104, 4015],
      q: [7002, 7002, 6177, 5142, 4655, 4457, 4304, 4224, 4164, 4101, 4077, 4068, 4088, 4059, 4078, 4039, 4033, 4069, 4037, 4051, 4022] },
    shotgun: { m: [7512, 7466, 6960, 6134, 5938, 5988, 5891, 5894, 5897, 5921, 5890, 5733, 5733, 5778, 5693, 5610, 5606, 5564, 5569, 5541, 5500],
      q: [7512, 7431, 6664, 5755, 5558, 5558, 5533, 5495, 5385, 5481, 5356, 5402, 5317, 5411, 5256, 5217, 5198, 5164, 5183, 5131, 5089] },
    rifle: { m: [7347, 7335, 6655, 5837, 5389, 5176, 5155, 5037, 5000, 4937, 5006, 4910, 4930, 4801, 4626, 4634, 4569, 4410, 4291, 4395, 4315],
      q: [7347, 7347, 6227, 5337, 5052, 4901, 4914, 4781, 4807, 4711, 4807, 4722, 4719, 4703, 4731, 4652, 4672, 4555, 4548, 4588, 4454] },
    smg: { m: [7002, 6999, 6469, 5432, 5052, 4787, 4566, 4441, 4359, 4260, 4242, 4189, 4136, 4144, 4141, 4149, 4127, 4127, 4133, 4148, 4124],
      q: [7002, 7002, 6177, 4954, 4651, 4465, 4257, 4178, 4167, 4090, 4043, 4042, 3984, 4003, 4005, 4004, 4005, 3987, 4006, 4017, 3998] },
    revolver: { m: [7347, 7340, 6897, 6008, 5577, 5316, 5044, 4991, 4685, 4593, 4393, 4132, 4098, 3627, 3299, 3161, 3043, 2922, 2610, 2385, 2355],
      q: [7347, 7347, 6472, 5462, 5119, 4975, 4832, 4835, 4742, 4590, 4648, 4205, 4159, 1773, 1281, 1293, 1273, 1323, 1218, 1048, 1013] },
  },
  z3: {
    pistol: { m: [11250, 11019, 10139, 8732, 7922, 7394, 7200, 7090, 7104, 6949, 6899, 6853, 6884, 6731, 6781, 6783, 6754, 6793, 6682, 6693, 6667],
      q: [11250, 10745, 9617, 8200, 7499, 7048, 6824, 6786, 6787, 6746, 6666, 6601, 6622, 6566, 6581, 6572, 6563, 6578, 6540, 6553, 6557] },
    carbine: { m: [11250, 11240, 10319, 8755, 8091, 7495, 7317, 7182, 7051, 6934, 6810, 6790, 6524, 6712, 6573, 6527, 6517, 6134, 6152, 5916, 5644],
      q: [11250, 11250, 10025, 8315, 7609, 7153, 6991, 6873, 6817, 6682, 6590, 6606, 6483, 6600, 6506, 6494, 6476, 6180, 6305, 5454, 4917] },
    shotgun: { m: [11490, 11594, 10670, 9666, 9571, 9418, 9505, 9487, 9593, 9358, 9462, 9237, 9185, 9218, 9277, 9202, 9036, 9054, 8957, 8925, 8837],
      q: [11490, 11490, 10180, 9072, 8962, 8950, 8983, 8910, 9099, 8876, 8941, 8632, 8777, 8732, 8695, 8646, 8521, 8463, 8481, 8452, 8449] },
    rifle: { m: [11725, 11725, 10892, 9848, 9169, 8973, 8859, 8227, 7414, 6724, 5857, 5002, 4341, 3964, 3627, 3112, 2803, 2628, 2551, 2556, 2413],
      q: [11725, 11725, 10542, 9305, 8807, 8608, 8655, 8012, 5826, 4534, 3175, 3010, 2787, 2762, 2477, 2029, 2042, 1734, 1584, 1594, 1594] },
    smg: { m: [11250, 11241, 10273, 8815, 8133, 7681, 7155, 7119, 6990, 6865, 6860, 6751, 6709, 6742, 6670, 6651, 6611, 6612, 6639, 6652, 6639],
      q: [11250, 11250, 9820, 8095, 7592, 7219, 6796, 6759, 6744, 6679, 6630, 6533, 6492, 6548, 6515, 6515, 6527, 6477, 6509, 6487, 6483] },
    revolver: { m: [11725, 11707, 10991, 10133, 8600, 6558, 4980, 4201, 4149, 3467, 3302, 2903, 2521, 2354, 2024, 1835, 1821, 1736, 1531, 1481, 1372],
      q: [11725, 11725, 10477, 9892, 6333, 5402, 2948, 2765, 2550, 2161, 2187, 2072, 1326, 1184, 1134, 1096, 1033, 903, 886, 848, 785] },
  },
};

const BAR_CACHE = {}; // by challenge and gun, rebuilt when the noise sliders move
function curveAt(a, x) { const f = clamp(x / T.starGrid, 0, a.length - 1), i = Math.min(a.length - 2, Math.floor(f)); return a[i] + (a[i + 1] - a[i]) * (f - i); }
// The bars {one, two, three} of a challenge for a gun: the mean score of that gun's bot at the three-star and two-star noise, and the 25th percentile at the one-star noise
// (the mean of a skewed score is beaten by fewer than half the bots, and most of the one-star bots must earn the first star), each capped at starCap of that gun's perfect run.
function thresholds(ch, gun) {
  const N = T.starNoise, sig = N.three * 1e4 + N.two * 100 + N.one, by = BARS[ch.id], key = by[gun] ? gun : 'pistol';
  const C = BAR_CACHE[ch.id] || (BAR_CACHE[ch.id] = {}), hit = C[key];
  if (hit && hit.sig === sig) return hit.b;
  const c = by[key], cap = T.starCap * c.m[0], R = T.starRound, r = (x) => Math.round(Math.min(x, cap) / R) * R;
  const three = r(curveAt(c.m, N.three)), two = Math.min(r(curveAt(c.m, N.two)), three - R), one = Math.min(r(curveAt(c.q, N.one)), two - R);
  const b = { one: Math.max(R, one), two: Math.max(2 * R, two), three: Math.max(3 * R, three) };
  C[key] = { sig, b };
  return b;
}
const LADDERS = [['accuracy', 'Accuracy'], ['speed', 'Speed'], ['skeet', 'Skeet'], ['boss', 'Boss'], ['zombie', 'Zombies']];

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

// A wave of an endless run (v0.5 L): from the day's seed and the wave number alone. The size grows from two to six, every wave is `speedStep` faster than the one before, every
// `hpEvery` waves every part has one more hit point, and the mix of types opens one more every `mixEvery` waves (Shambler and Crawler, then Hunched, Runner, Brute).
const ENDLESS_MIX = ['s', 'c', 'h', 'r', 'b'];
function endlessWave(k) { // what wave index k (0 first) is made of, apart from the seed
  const E2 = T.zombie.endless;
  return { n: Math.min(6, 2 + (k >> 1)), mul: Math.min(E2.speedCap, 1 + E2.speedStep * k), hp: Math.floor(k / E2.hpEvery), types: ENDLESS_MIX.slice(0, Math.min(ENDLESS_MIX.length, E2.mixFrom + Math.floor(k / E2.mixEvery))) };
}
function zombieWave(ch, k) {
  const rng = makeRng((ch.seed ^ Math.imul(k + 1, 2654435761)) >>> 0), Z = T.zombie, w = endlessWave(k), out = [];
  for (let i = 0; i < w.n; i++) out.push({ type: w.types[Math.floor(rng() * w.types.length)], mul: w.mul, hp: w.hp, feet: rng.range(Z.lanes[0], Z.lanes[1]), gap: rng.range(ch.gap[0], ch.gap[1]) });
  return out;
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
  } else if (ch.ladder === 'zombie') { // waves of zombies: class, the lane the feet keep (nearer is bigger), and the seconds since the one before
    const Z = T.zombie;
    b = ch.waves.map((w) => [...w].map((type) => ({ type, mul: ch.mul, hp: 0, feet: rng.range(Z.lanes[0], Z.lanes[1]), gap: rng.range(ch.gap[0], ch.gap[1]) })));
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
    ch, gun, list: ch.endless ? null : build(ch), idx: 0, targets: [], stage: 0,
    steps: 0, acc: 0, q: [], frameReal: 0, events: [],
    gunY: T.startGunY, kick: 0, sway: 0, hist: new Array(hn + 1).fill(T.startGunY), hi: 0, hn,
    kUp: false, kDown: false, holding: false, nextFire: 0,
    score: 0, streak: 0, shots: 0, hits: 0, bulls: 0, misses: 0,
    ammo: ch.ladder === 'accuracy' ? ch.accAmmo : Infinity,
    nextAt: T.startDelay, done: false, cleared: false, pairHits: {}, double: false,
    decoyHits: 0, down: 0, revealed: 0, revealQ: [],
    mag: gun.magSize, reloading: false, reloadStart: 0, reloadEnd: 0, shellNext: 0, shellEach: 0, reloads: 0, // the magazine (v0.5 M)
    cBull: 0, cHead: 0, cPlate: 0, // the run's mastery counters (v0.5 N)
    zs: [], zN: 0, wave: 0, pending: [], calmAt: T.startDelay, forceAt: Infinity, zdown: 0, breach: null, // zombies (v0.5 G)
    hitTimes: [], kickback: false, lastShotHit: false, firstZone: -1, lateClay: false, hordes: {}, hordeN: 0, walked: false, // counters for the delighter badges
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
    kind: ch.behaviour === 'dodge' && !p.flip ? 'dodge' : 'still', card: true, x0: p.x, y0: p.y, sc: ch.scale, life, lifeMax: life, flip: p.flip,
    bits: p.bits, dodges: 0, nextDodge: t, ymin: lg.y0, ymax: lg.y1,
  }, t);
}

function spawnSpeed(run, t) {
  const ch = run.ch, e = run.list[run.idx++], lg = legal(ch.scale), v = T.approachSpeed * ch.speedMul;
  if (e.members) {
    const hid = run.hordeN++; run.hordes[hid] = { left: e.members.length, broken: false, misses: null };
    for (const m of e.members) addTarget(run, { kind: 'horde', x0: lg.x1 + m.dx, y0: m.y, v, sc: ch.scale, flat: true, hid }, t);
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

function targetRadius(tg) { return tg.rad !== undefined ? tg.rad : tg.card ? (T.zoneR[2] + A.card.pad) * tg.sc : (tg.kind === 'skeet' ? T.zoneR[1] : T.zoneR[2]) * tg.sc; } // an Accuracy card scores over all its drawn paper (v0.5 B, F7)

function dodge(run, tg, now) {
  const oldY = tg.y;
  let dir = tg.bits[tg.dodges % tg.bits.length] ? 1 : -1;
  if (tg.y0 + dir * T.dodgeStep < tg.ymin || tg.y0 + dir * T.dodgeStep > tg.ymax) dir = -dir;
  tg.y0 = clamp(tg.y0 + dir * T.dodgeStep, tg.ymin, tg.ymax); tg.y = tg.y0;
  tg.dodges++; tg.nextDodge = now + T.dodgeCooldown;
  run.events.push({ type: 'dodge', x: tg.x, y0: oldY, y1: tg.y, sc: tg.sc });
}

// ---- Reload (v0.5 M) ----
// The magazine holds `magSize` rounds; the shot that empties it starts a reload, and a Reload tap starts one early. Firing during a reload does nothing (a dropped tap) except the shotgun's,
// which loads shell by shell and a fire tap interrupts it and fires what is loaded. Everything here runs on sim time, so frame rate changes nothing.
function startReload(run, now) {
  const g = run.gun;
  if (run.done || run.reloading || run.mag >= g.magSize) return false;
  run.reloading = true; run.reloadStart = now; run.reloads++;
  if (g.shell) { run.shellEach = g.reloadSeconds / g.magSize; run.shellNext = now + run.shellEach; run.reloadEnd = now + (g.magSize - run.mag) * run.shellEach; }
  else run.reloadEnd = now + g.reloadSeconds;
  run.events.push({ type: 'reload', early: run.mag > 0 });
  return true;
}
function stepReload(run, t) {
  if (!run.reloading) return;
  const g = run.gun;
  if (g.shell) {
    while (run.reloading && t >= run.shellNext - 1e-9) { run.mag++; run.shellNext += run.shellEach; if (run.mag >= g.magSize) { run.reloading = false; run.events.push({ type: 'reloaded' }); } else run.events.push({ type: 'shell' }); }
  } else if (t >= run.reloadEnd - 1e-9) { run.mag = g.magSize; run.reloading = false; run.events.push({ type: 'reloaded' }); }
}
// How far a reload is, 0 to 1 (0 when none is running).
function reloadFrac(run, now) { return run.reloading ? clamp((now - run.reloadStart) / Math.max(1e-6, run.reloadEnd - run.reloadStart), 0, 1) : 0; }

// ---- Zombies (v0.5 G and L) ----
// Each type's poses, in units at scale 1: part centres as [dx toward the fence (negative), height above the feet] for standing, on its hands (legs down), with the body gone (legs left)
// and the head alone. Every offset scales with the type's size. A Hunched zombie's head sits inside its body's circle, and stays out of the shot lines (`hidden`) while the body stands.
const ZTYPES = {};
for (const [k, d] of Object.entries(T.zombie.types)) {
  const z = d.size, sh = !!d.shield;
  ZTYPES[k] = { id: k, ...d, pose: {
    stand: { legs: [0, 17 * z], body: [0, (sh ? 44 : 50) * z], brain: [sh ? 7 : 0, (sh ? 48 : 74) * z] },
    crawl: { body: [0, 14 * z], brain: sh ? [3, 20 * z] : [-17 * z, 22 * z] },
    hunch: { brain: [-6 * z, (sh ? 42 : 58) * z] },
    drag: { brain: [-16 * z, 8 * z] },
  } };
}
function zSpeed(z) { const Z = T.zombie; return z.v * (z.legsDown && !z.ty.ground ? Z.crawl : 1) * (z.bodyDown ? Z.hunch : 1); }
function zReach(z) { return T.zombie.reach * z.ty.size * z.sc; }
// Where each part that is left sits: the pose follows what is left of the zombie, and the parts are the targets (circles) the shot lines cross. A Runner's head bobs with time.
function layoutZombie(z, t) {
  const Z = T.zombie, P2 = z.ty.pose, sc = z.sc, pl = z.legsDown ? (z.bodyDown ? P2.drag : P2.crawl) : z.bodyDown ? P2.hunch : P2.stand;
  const put = (p, o, up) => { p.x0 = p.x = z.x + o[0] * sc; p.y0 = p.y = z.y - (o[1] + up) * sc; };
  if (z.parts.legs) put(z.parts.legs, P2.stand.legs, 0);
  if (z.parts.body) put(z.parts.body, pl.body || P2.stand.body, 0);
  if (z.parts.brain) {
    put(z.parts.brain, pl.brain, z.ty.bob && !z.legsDown ? (z.ty.bob / 2) * Math.sin((PI2 * (t - z.born)) / Z.bobPeriod) : 0);
    z.parts.brain.hidden = !!z.ty.shield && !!z.parts.body;
  }
}
function spawnZombie(run, spec, wave, n, t) {
  const Z = T.zombie, ty = ZTYPES[spec.type], k = clamp((spec.feet - Z.lanes[0]) / (Z.lanes[1] - Z.lanes[0]), 0, 1), sc = Z.scale[0] + (Z.scale[1] - Z.scale[0]) * k;
  const z = { id: run.zN++, wave, n, ty, cls: spec.type, x: Z.spawnX, y: spec.feet, sc, v: Z.base * ty.speed * (spec.mul || 1), legsDown: !!ty.ground, bodyDown: false, parts: {}, born: t };
  for (const name of ['legs', 'body', 'brain']) {
    const d = ty[name]; if (!d) continue;
    const hp = d.hp + (spec.hp || 0);
    z.parts[name] = { kind: 'zpart', part: name, z, hp, hpMax: hp, rad: d.r * ty.size * sc, sc, hitAt: -9, hidden: false };
  }
  layoutZombie(z, t);
  for (const name of ['legs', 'body', 'brain']) if (z.parts[name]) addTarget(run, z.parts[name], t);
  let i = run.zs.length; while (i > 0 && run.zs[i - 1].y > z.y) i--; run.zs.splice(i, 0, z); // kept far to near, the order they are drawn in
}
function startWave(run, t) {
  const ch = run.ch, specs = ch.endless ? zombieWave(ch, run.wave) : run.list[run.wave];
  let at = t;
  specs.forEach((sp, i) => { if (i) at += sp.gap; run.pending.push({ at, spec: sp, wave: run.wave + 1, n: i + 1 }); });
  run.wave++;
  run.forceAt = t + (ch.endless ? Math.max(9, 24 - run.wave) : ch.force);
  run.events.push({ type: 'wave', n: run.wave });
}
function killZombie(run, z, now) {
  for (const p of Object.values(z.parts)) if (p) { const i = run.targets.indexOf(p); if (i >= 0) run.targets.splice(i, 1); }
  z.parts = {}; z.dead = true; run.zs.splice(run.zs.indexOf(z), 1); run.zdown++;
  if (!run.zs.length && !run.pending.length) run.calmAt = now + T.zombie.waveGap;
  run.events.push({ type: 'fall', x: z.x, y: z.y, sc: z.sc, crawl: z.legsDown, ty: z.cls });
}
// The score of one shot's hits on zombie parts (called with the parts the pellets hurt, after damage): a point value per hit and per part destroyed, the brain bonus, all times
// the multiplier. A part at zero hit points is destroyed: legs down make the zombie crawl, body down slow it, and the brain ends it. `brain` says the shot hit a brain: only a brain hit steps
// the multiplier (v0.5 L); a shot that hit only legs or body is paid at the multiplier it found and then resets it.
function zombieShot(run, res, hurt, mult, now) {
  const Z = T.zombie, PT = Z.points, hits = new Map();
  for (const r of res) if (r.tg && r.tg.kind === 'zpart') hits.set(r.tg, (hits.get(r.tg) || 0) + 1);
  let base = 0, tx = 0, ty = 0, zone = 2, tag = null, killed = false, brain = false;
  const parts = [...hurt].filter((p) => p.kind === 'zpart').sort((a, b) => (a.part < b.part ? -1 : 1)); // a fixed order, by name
  for (const p of parts) {
    base += PT.hit * hits.get(p); tx += p.x; ty += p.y; p.hitAt = now;
    if (p.part === 'brain') brain = true;
    if (p.hp > 0) continue;
    base += PT[p.part];
    if (p.part === 'brain') { base += PT.bonus; zone = 0; tag = 'Brain shot'; killed = true; }
    else { zone = Math.min(zone, 1); if (tag !== 'Brain shot') tag = p.part === 'legs' ? 'Legs down' : 'Body down'; }
  }
  for (const p of parts) if (p.hp <= 0 && p.part !== 'brain') { const z = p.z; run.targets.splice(run.targets.indexOf(p), 1); z.parts[p.part] = null; if (p.part === 'legs') z.legsDown = true; else z.bodyDown = true; layoutZombie(z, now); }
  for (const p of parts) if (p.hp <= 0 && p.part === 'brain') killZombie(run, p.z, now);
  return { pts: Math.round(base * mult), zone, tx: tx / parts.length, ty: ty / parts.length, tag, killed, brain };
}
function stepZombie(run, t) {
  const Z = T.zombie, ch = run.ch;
  let touched = null;
  for (const z of run.zs) {
    z.x -= zSpeed(z) * STEP; layoutZombie(z, t);
    if (!touched && z.x - zReach(z) <= Z.fenceX) touched = z;
  }
  if (touched) { // the fence: the run ends the moment one touches it
    run.breach = { wave: touched.wave, n: touched.n, cls: touched.cls, legs: touched.legsDown, body: touched.bodyDown };
    run.events.push({ type: 'fence', x: Z.fenceX, y: touched.y });
    finish(run); return;
  }
  while (run.pending.length && run.pending[0].at <= t + 1e-9) { const e = run.pending.shift(); spawnZombie(run, e.spec, e.wave, e.n, t); }
  const live = run.zs.length + run.pending.length, more = ch.endless || run.wave < run.list.length;
  if (more && ((!live && t >= run.calmAt) || t >= run.forceAt)) startWave(run, t);
  else if (!more && !live) { run.cleared = true; finish(run); }
}

function checkEnd(run) {
  if (run.ch.ladder === 'accuracy' && (run.ammo <= 0 || (run.idx >= run.list.length && !run.targets.length))) finish(run);
  else if (run.ch.ladder === 'boss' && run.cleared) finish(run);
  else if (run.ch.ladder === 'zombie' && run.cleared) finish(run);
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
  if (run.reloading && !(g.shell && run.mag > 0)) { if (cue) run.events.push({ type: 'dropped', reload: true }); return; } // a reload under way: the tap does nothing
  if (now < run.nextFire - STEP - 1e-9) { if (cue) run.events.push({ type: 'dropped' }); return; }
  if (run.reloading) { run.reloading = false; run.events.push({ type: 'interrupt' }); } // the shotgun fires what it has loaded, and the reload stops // one step of slack, so a tap at the nominal interval is not lost to step rounding
  run.nextFire = Math.max(now, run.nextFire) + 1 / g.fireRate; // held fire keeps the exact rate
  const gx = T.gunX, gy = run.gunY, a0 = angleOf(run);
  const lines = fanOffsets(g).map((off) => { const a = (a0 + off) * DEG; return { sn: Math.sin(a), cs: Math.cos(a) }; });
  let dodged = false;
  for (const tg of run.targets) {
    if (tg.kind !== 'dodge' || now < tg.nextDodge - 1e-9) continue;
    const vx = tg.x - gx, vy = tg.y - gy;
    if (lines.some((l) => vx * l.cs - vy * l.sn > 0 && Math.abs(vx * l.sn + vy * l.cs) <= T.dodgeRange)) { dodge(run, tg, now); dodged = true; }
  }
  const res = lines.map((l) => {
    let tg = null, along = Infinity, perp = 0;
    for (const t of run.targets) {
      if (t.hidden) continue; // a Hunched zombie's shielded brain: the body takes the shot
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
    if (r.tg.kind === 'zpart') { /* a zombie's parts score by damage below, not by zone */ }
    else if (r.tg.flat) scored.set(r.tg, 2);
    else if (i === ci) scored.set(r.tg, zoneOf(r));
    if (r.tg.hp !== undefined) { r.tg.hp -= g.damage; hurt.add(r.tg); }
  });
  const down = new Set();
  for (const tg of scored.keys()) if (tg.hp === undefined) down.add(tg);
  for (const tg of hurt) if (tg.hp <= 0 && tg.kind !== 'zpart') down.add(tg);
  const zh = [...hurt].some((tg) => tg.kind === 'zpart');
  const mid = res[ci];
  const outer = res.find((r, i) => i !== ci && r.tg && !r.tg.flat && !r.neutral && (r.tg.kind === 'still' || r.tg.kind === 'dodge' || r.tg.kind === 'approach' || r.tg.kind === 'weave') && !scored.has(r.tg)); // an outer pellet on a card the centre pellet missed
  const ev = { type: 'shot', x0: gx + Math.cos(a0 * DEG) * T.barrelLen, y0: gy - Math.sin(a0 * DEG) * T.barrelLen, lines: res.map((r) => ({ x1: r.x1, y1: r.y1 })), x1: mid.x1, y1: mid.y1, hit: scored.size > 0 || zh, dodged: dodged && !scored.size && !zh, neutral: !scored.size && !hurt.size && res.some((r) => r.neutral), outer: outer ? { x: outer.tg.x, y: outer.tg.y } : null };
  const decoy = [...scored].find(([tg]) => tg.decoy);
  if (decoy) { // a decoy hit costs its zone value and breaks the combo; it is no hit and no miss
    const pts = -Math.round(T.zonePoints[decoy[1]] * T.decoyPenalty);
    run.score = Math.max(0, run.score + pts); run.streak = 0; run.decoyHits++;
    Object.assign(ev, { decoy: true, tx: decoy[0].x, ty: decoy[0].y, pts, streak: 0, hit: false });
  } else if (scored.size || zh) {
    const mult = Math.min(T.comboCap, 1 + T.comboStep * run.streak);
    let pts = 0, bz = 3, tx = 0, ty = 0, nt = scored.size, zt = null;
    for (const [tg, z] of scored) { pts += Math.round(T.zonePoints[z] * mult); bz = Math.min(bz, z); tx += tg.x; ty += tg.y; if (z === 0 && (run.ch.ladder === 'accuracy' || run.ch.ladder === 'skeet' || tg.kind === 'core')) run.cBull++; } // mastery (v0.5 N): bullseyes on cards and clays, and on a boss core
    if (zh) { zt = zombieShot(run, res, hurt, mult, now); if (zt.brain) run.cHead++; pts += zt.pts; bz = Math.min(bz, zt.zone); tx += zt.tx; ty += zt.ty; nt++; }
    const was = run.streak;
    run.score += pts; run.hits += scored.size + (zh ? 1 : 0);
    run.streak = zt && !zt.brain && !scored.size ? 0 : run.streak + 1; // v0.5 L: on a zombie only a brain hit steps the multiplier, a hit on anything else resets it
    if (bz === 0) run.bulls++;
    if (run.shots === 0) run.firstZone = bz;
    run.hitTimes.push(now); if (run.hitTimes.length > 6) run.hitTimes.shift();
    if (run.streak >= 6 && now - run.hitTimes[0] <= T.kickWindow + 1e-9) run.kickback = true; // six consecutive scoring shots within the window
    Object.assign(ev, { tx: tx / nt, ty: ty / nt, zone: bz, pts, mult, streak: run.streak, lost: was > 0 && run.streak === 0, killed: down.size > 0 || !!(zt && zt.killed), tag: zt ? zt.tag : null });
  } else {
    if (!dodged && !ev.neutral) { run.streak = 0; run.misses++; }
    ev.streak = run.streak;
  }
  for (const tg of down) {
    if (tg.kind === 'skeet' && !tg.decoy && now - tg.born > -tg.vy / tg.g + 1e-9) run.lateClay = true; // a clay hit after its peak
    const hd = tg.hid !== undefined && run.hordes[tg.hid];
    if (hd) { // Walk the Line: each kill takes the leftmost living member, and no shot misses between the first kill and the last
      if (hd.misses === null) hd.misses = run.misses;
      const mine = Math.min(...[...down].filter((t) => t.hid === tg.hid).map((t) => t.x));
      if (run.targets.some((t) => t.hid === tg.hid && !down.has(t) && t.x < mine - 1e-9)) hd.broken = true;
    }
    run.targets.splice(run.targets.indexOf(tg), 1);
    if (hd && --hd.left === 0 && !hd.broken && run.misses === hd.misses) run.walked = true;
    if (run.ch.ladder === 'accuracy') run.nextAt = now + T.accGap;
    if (tg.kind === 'part') run.cPlate++; // a boss plate destroyed
    if (tg.kind === 'part' && run.ch.wall) { run.down++; if (run.revealed + run.revealQ.length < run.list.parts.length) run.revealQ.push(now + T.plateReveal); }
    else if (tg.kind === 'part') { run.stage++; if (run.stage >= run.list.parts.length) spawnCore(run, now); }
    if (tg.kind === 'core') run.cleared = true;
    if (tg.group !== undefined) { run.pairHits[tg.group] = (run.pairHits[tg.group] || 0) + 1; if (run.pairHits[tg.group] >= 2) run.double = true; }
  }
  run.lastShotHit = ev.hit;
  run.events.push(ev);
  run.kick = Math.min(T.kickMax, run.kick + g.kickPerShot);
  run.ammo--; run.shots++;
  if (--run.mag <= 0) startReload(run, now); // empty: the reload starts by itself
  checkEnd(run);
}

function stepAccuracy(run, t) {
  const tg = run.targets[0];
  if (tg) {
    tg.life -= STEP;
    if (tg.life <= -T.expiryGrace + 1e-9) { // the card fades through the grace and can still be hit; the miss books when it ends
      run.targets.length = 0;
      const lost = !tg.flip && run.streak > 0;
      if (!tg.flip) { run.streak = 0; run.misses++; } // a flip target that turns away costs nothing but its window
      run.events.push({ type: 'expire', x: tg.x, y: tg.y, flip: !!tg.flip, lost, card: true });
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
      if (tg.hid !== undefined) run.hordes[tg.hid].broken = true;
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
  stepReload(run, t);
  for (const tg of run.targets) posAt(tg, t, tg);
  const l = run.ch.ladder;
  if (l === 'accuracy') stepAccuracy(run, t);
  else if (l === 'speed') stepSpeed(run, t);
  else if (l === 'skeet') stepSkeet(run, t);
  else if (l === 'zombie') stepZombie(run, t);
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
      else if (e.kind === 'reload') startReload(run, run.steps * STEP);
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

// Bests are per gun (PRD v0.5 K): best[challengeId][gunId] = { score, stars, accuracy } (accuracy is the share of shots that hit, of the best run).
function bests(E) { const b = E.save.get('best', {}); return b && typeof b === 'object' ? b : {}; }
function bestOf(E, ch, gun) { const b = bests(E)[ch.id], e = b && b[gun]; return e && typeof e === 'object' ? e : null; }
// Stars a gun has on a rung: the stars saved, or what its best score earns against that gun's bars now if that is more (never fewer: saved stars are never revoked).
function starsOf(E, ch, gun) { const e = bestOf(E, ch, gun); return e ? Math.max(e.stars || 0, starsFor(ch, e.score || 0, gun)) : 0; }
// A rung opens for a gun when that gun has unlockStars on the rung before it (Boss 2 on Boss 1); every gun starts each ladder at rung 1.
function isUnlocked(E, ch, gun) {
  if (ch.level === 1) return true;
  const prev = CHALLENGES.find((c) => c.ladder === ch.ladder && c.level === ch.level - 1);
  return starsOf(E, prev, gun) >= T.unlockStars;
}
// Points are every gun's stars on every rung, summed.
function pointsTotal(E) { return CHALLENGES.reduce((n, ch) => n + GUN_IDS.reduce((m, g) => m + T.starPoints[starsOf(E, ch, g)], 0), 0); }
// Play on the menu: this gun's first unlocked rung with no stars yet, else the first rung.
function firstPlayable(E, gun) { return CHALLENGES.find((ch) => isUnlocked(E, ch, gun) && starsOf(E, ch, gun) === 0) || CHALLENGES[0]; }
// Rungs where a gun has two stars or better.
function rungsDone(E, gun) { return CHALLENGES.filter((ch) => starsOf(E, ch, gun) >= 2).length; }
// ---------- Guns: unlocked by badges ----------

function hadMap(E) { const m = E.save.get('gunsHad', {}); return m && typeof m === 'object' ? m : {}; }
// A gun is open when its badge is earned, or (a save from before v7) it was open under the old points table: a badge or a gun is never taken away.
function gunUnlocked(E, id) { return id === 'pistol' || !!badgeMap(E)[T.unlockBadges[id]] || !!hadMap(E)[id]; }
function gunId(E) { const id = E.save.get('gun', 'pistol'); return T.guns[id] && gunUnlocked(E, id) ? id : 'pistol'; }
function unlockBadge(id) { return BADGES.find((b) => b.id === T.unlockBadges[id]); }

// ---------- Badges (v0.3 section B): skill acts, tiered ----------

// Each badge is data with a rule: met(o) says whether a finished run earns it. o: { ch, gun, stars, double, decoyHits, gauntletDone, bests, run, cold }; bests is
// { challengeId: { gunId: { stars } } } and already includes this run, run is the sim's run (its counters), cold the runs in a row that opened on a bullseye.
const at = (o, id) => o.ch.id === id;
const three = (o) => o.stars === 3;
const BADGES = [
  { id: 'marksman1', tier: 'Bronze', name: 'Marksman I', cond: 'Three stars on Accuracy 1', met: (o) => at(o, 'a1') && three(o) },
  { id: 'quickdraw1', tier: 'Bronze', name: 'Quick Draw I', cond: 'Three stars on Speed 1', met: (o) => at(o, 's1') && three(o) },
  { id: 'clay1', tier: 'Bronze', name: 'Clay I', cond: 'Three stars on Skeet 1', met: (o) => at(o, 'k1') && three(o) },
  { id: 'steady', tier: 'Silver', name: 'Steady', cond: 'Accuracy 4, three stars, carbine', met: (o) => at(o, 'a4') && three(o) && o.gun === 'carbine' },
  { id: 'storm', tier: 'Silver', name: 'Storm', cond: 'Three stars on Speed 4', met: (o) => at(o, 's4') && three(o) },
  { id: 'double', tier: 'Silver', name: 'Double', cond: 'Hit both clays of a Skeet 2 pair', met: (o) => at(o, 'k2') && !!o.double },
  { id: 'marksman2', tier: 'Silver', name: 'Marksman II', cond: 'Three stars on Accuracy 5', met: (o) => at(o, 'a5') && three(o) },
  { id: 'quickdraw2', tier: 'Silver', name: 'Quick Draw II', cond: 'Three stars on Speed 5', met: (o) => at(o, 's5') && three(o) },
  { id: 'clay2', tier: 'Silver', name: 'Clay II', cond: 'Skeet 3, no decoy hit, three stars', met: (o) => at(o, 'k3') && three(o) && !o.decoyHits },
  // Wrong Tool: the gun a challenge was not made for; each unlocks only its badge
  { id: 'sprint', tier: 'Silver', name: "Marksman's Sprint", cond: 'Rifle on Speed 3, two stars', met: (o) => at(o, 's3') && o.gun === 'rifle' && o.stars >= 2 },
  { id: 'scatter', tier: 'Silver', name: 'Scatter Precision', cond: 'Shotgun on Accuracy 2, two stars', met: (o) => at(o, 'a2') && o.gun === 'shotgun' && o.stars >= 2 },
  { id: 'sidearm', tier: 'Silver', name: 'Sidearm Only', cond: 'Pistol on Boss 2, two stars', met: (o) => at(o, 'b2') && o.gun === 'pistol' && o.stars >= 2 },
  { id: 'claycarbine', tier: 'Silver', name: 'Clay Carbine', cond: 'Carbine on Skeet 2, three stars', met: (o) => at(o, 'k2') && o.gun === 'carbine' && three(o) },
  // Delighters (PRD v0.5 J): one act, never grind; each pops a ticket on the card
  { id: 'kickback', tier: 'Trick', name: 'Kickback', cond: 'Six hits in a row within 0.65 s', met: (o) => o.run.kickback },
  { id: 'lastround', tier: 'Trick', name: 'Last Round', cond: 'Accuracy, three stars, the last bullet the last hit', met: (o) => o.ch.ladder === 'accuracy' && three(o) && o.run.ammo === 0 && o.run.lastShotHit },
  { id: 'coldbarrel', tier: 'Trick', name: 'Cold Barrel', cond: 'A bullseye on the first shot, five runs in a row', met: (o) => o.cold >= T.coldRuns },
  { id: 'claysweep', tier: 'Trick', name: 'Clay Sweep', cond: 'Skeet, every goal clay hit before it peaks', met: (o) => o.ch.ladder === 'skeet' && o.run.misses === 0 && !o.run.lateClay && !o.run.decoyHits && o.run.hits >= o.run.list.filter((e) => !e.decoy).length },
  { id: 'walkline', tier: 'Trick', name: 'Walk the Line', cond: 'A horde cleared left to right, no miss', met: (o) => o.run.walked },
  { id: 'bosskiller', tier: 'Gold', name: 'Boss Killer', cond: 'Boss 1 three stars, every gun', met: (o) => at(o, 'b1') && three(o) && GUN_IDS.every((g) => o.bests.b1[g].stars === 3) },
  { id: 'gauntlet', tier: 'Gold', name: 'Gauntlet', cond: 'A2, S2, K2, B1 in a row, two stars each', met: (o) => !!o.gauntletDone },
  { id: 'legend', tier: 'Gold', name: 'Legend', cond: 'Every challenge at three stars', met: (o) => CHALLENGES.every((c) => GUN_IDS.some((g) => o.bests[c.id][g].stars === 3)) },
  { id: 'arsenal', tier: 'Gold', name: 'Arsenal', cond: 'Three stars on every challenge, every gun', met: (o) => CHALLENGES.every((c) => GUN_IDS.every((g) => o.bests[c.id][g].stars === 3)) },
  { id: 'sniper', tier: 'Gold', name: 'Sniper', cond: 'Boss 2, three stars, rifle', met: (o) => at(o, 'b2') && three(o) && o.gun === 'rifle' },
];

// Badges a finished run earns that are not already `have`.
function newBadges(o) { return BADGES.filter((b) => b.met(o) && !o.have[b.id]).map((b) => b.id); }

// After a gauntlet stage: passes at two stars or better; done after the last stage.
function gauntletStep(i, stars) {
  const ok = stars >= 2, done = ok && i + 1 >= GAUNTLET.length;
  return { i, ok, done, next: ok && !done ? GAUNTLET[i + 1] : null };
}
function badgeMap(E) { const b = E.save.get('badges', {}); return b && typeof b === 'object' ? b : {}; }

// ---------- Gun mastery (v0.5 N) ----------
// Per gun, lifetime counters in the save: shots, hits, bulls (Accuracy and Skeet bullseyes and boss-core bullseyes), heads (zombie brain hits) and plates (boss plates destroyed).
// Mastery is bulls plus heads; the tier and the bar come from it. The counters are the sums of the runs' own numbers, which the ledger's `result` lines carry.
const MASTERY_KEYS = ['shots', 'hits', 'bulls', 'heads', 'plates'];
const TIER_NAMES = ['Recruit', 'Marksman', 'Expert', 'Master'];
function masteryMap(E) { const m = E.save.get('mastery', {}); return m && typeof m === 'object' ? m : {}; }
function masteryOf(E, gun) {
  const e = masteryMap(E)[gun] || {}, o = {};
  for (const k of MASTERY_KEYS) o[k] = Number.isFinite(e[k]) && e[k] > 0 ? Math.floor(e[k]) : 0;
  return o;
}
// The tier a set of counters has reached (0 to 3), the score, the accuracy, the score of the next tier and how far to it. Master also needs the lifetime accuracy.
function masteryInfo(m) {
  const M = T.mastery, score = m.bulls + m.heads, acc = m.shots ? m.hits / m.shots : 0, at = [0, M.marksman, M.expert, M.master];
  const tier = score >= M.master && acc >= M.accuracy ? 3 : score >= M.expert ? 2 : score >= M.marksman ? 1 : 0, next = tier < 3 ? at[tier + 1] : null;
  return { score, acc, tier, next, frac: next === null ? 1 : clamp((score - at[tier]) / (next - at[tier]), 0, 1), accShort: tier === 2 && score >= M.master };
}
const tierOf = (E, gun) => masteryInfo(masteryOf(E, gun)).tier;

// The first text drawn at each weight and size makes the browser find and shape the font, which costs milliseconds in the first frame; draw it once, off screen, at start.
function warmText(ctx) {
  ctx.save(); ctx.textBaseline = 'middle';
  for (const w of [TY.normal, TY.strong]) for (const z of [TY.small, TY.mid, TY.mid + 2, TY.big]) { ctx.font = `${w} ${z}px system-ui, sans-serif`; ctx.fillText('AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz 0123456789 %/:.,·', -4000, -4000); }
  ctx.restore();
}

// The counters a save without any gets from the ledger: the sums of its `result` lines' shots and hits, and of the bulls, heads and plates the lines carry (v0.5 N onward; older lines
// have only shots and hits, so an older save starts with those and zero for the rest). No ledger, zero.
function deriveMastery(E) {
  const out = {};
  for (const e of E.ledger.entries) {
    if (e.k !== 'result' || !e.d || !T.guns[e.d.gun]) continue;
    const m = out[e.d.gun] || (out[e.d.gun] = { shots: 0, hits: 0, bulls: 0, heads: 0, plates: 0 });
    for (const [key, field] of [['shots', 'shots'], ['hits', 'hits'], ['bulls', 'bulls'], ['heads', 'heads'], ['plates', 'plates']]) if (Number.isFinite(e.d[field])) m[key] += Math.max(0, e.d[field]);
  }
  return out;
}

// ---------- Skins: cosmetic, opened by gun mastery or by a trick badge ----------

function skinById(gun, id) { const l = A.skins[gun]; return l.find((k) => k.id === id) || l[0]; }
function skinsHadMap(E) { const m = E.save.get('skinsHad', {}); return m && typeof m === 'object' ? m : {}; } // skins a save had before v10 (a worn or earned skin is never taken away)
function skinOpen(E, gun, skin) {
  if (skin.tier) return tierOf(E, gun) >= skin.tier || !!(skinsHadMap(E)[gun] && skinsHadMap(E)[gun][skin.id]);
  if (skin.badge) return !!badgeMap(E)[skin.badge] || !!(skinsHadMap(E)[gun] && skinsHadMap(E)[gun][skin.id]);
  return true;
}
// What opens a skin, in words.
function skinNeed(gun, skin) {
  if (skin.tier) return `${TIER_NAMES[skin.tier]}: ${[0, T.mastery.marksman, T.mastery.expert, T.mastery.master][skin.tier]} bullseyes and headshots${skin.tier === 3 ? `, ${Math.round(T.mastery.accuracy * 100)}% accuracy` : ''}`;
  const b = skin.badge && BADGES.find((k) => k.id === skin.badge);
  return b ? `the ${b.name} badge (${b.cond})` : 'always';
}
// The skin a gun wears: the saved choice if it is open, else the default.
function skinId(E, gun) {
  const m = E.save.get('skins', {}), k = skinById(gun, m && typeof m === 'object' ? m[gun] : null);
  return skinOpen(E, gun, k) ? k.id : 'std';
}
// The skin a trick or Legend badge unlocks, or null: { gun, skin }.
function skinOfBadge(badge) {
  for (const gun of GUN_IDS) { const skin = A.skins[gun].find((k) => k.badge === badge); if (skin) return { gun, skin }; }
  return null;
}
// Before v10 the ladder badges opened these skins: a save that earned the badge keeps the skin.
const OLD_SKIN_BADGES = { pistol: { nickel: 'marksman1', blackout: 'quickdraw1' }, carbine: { desert: 'clay1', arctic: 'steady' }, shotgun: { walnut: 'storm', tactical: 'double' }, rifle: { carbon: 'bosskiller', bronze: 'sniper', ghost: 'gauntlet' } };

// ---------- Drawing ----------
// Everything below reads TUNING.art. Guns, the muzzle flash and the backdrop are built once (Path2D, an offscreen canvas), and the
// per-frame loops keep no arrays or closures, so a frame allocates nothing beyond the engine's own text calls.

const NO_DASH = [], BREACH_DASH = [6, 6], SEL_DASH = [5, 4], DODGE_DASH = A.dodge.dash, TIE_DASH = [A.trolley.tieLen, A.trolley.tie - A.trolley.tieLen], PART_NUM = ['1', '2', '3', '4', '5', '6'];
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
const K_ICON = 9e6; // menu sprites: a rung's target
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
  const F = A.flash, a = angleOf(run) * DEG, m = gunArt(run.gun.id).muzzle, life = f.t / f.max, s = F.from + (1 - F.from) * (1 - life);
  ctx.save(); ctx.translate(T.gunX + Math.cos(a) * m, run.gunY - Math.sin(a) * m); ctx.rotate(-a); ctx.scale(s, s);
  ctx.globalAlpha = life;
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
  if (ch.ladder === 'accuracy') { // time left, as a ring round the card (cyan on a flip target, which has a short window); orange and pulsing when it is nearly up
    const C = A.card, rr = half * C.timerK + C.timerGap, life = Math.max(0, tg.life), end = -Math.PI / 2 + PI2 * clamp(life / tg.lifeMax, 0, 1);
    const late = life > 0 && (tg.flip ? life / tg.lifeMax <= C.warnFlip : life <= C.warn);
    if (life > 0) { // no ring in the grace: the time is up
      ctx.lineCap = 'round';
      ctx.strokeStyle = P.ink; ctx.lineWidth = C.timerWidth + 2; ctx.beginPath(); ctx.arc(tg.x, tg.y, rr, -Math.PI / 2, end); ctx.stroke();
      ctx.strokeStyle = late ? P.orange : tg.flip ? P.cyan : P.paperShade; ctx.lineWidth = C.timerWidth; if (late) ctx.globalAlpha = alpha * (0.6 + 0.4 * Math.abs(Math.sin(E.time * C.pulse)));
      ctx.beginPath(); ctx.arc(tg.x, tg.y, rr, -Math.PI / 2, end); ctx.stroke(); ctx.globalAlpha = alpha;
      ctx.lineCap = 'butt';
    }
    if (tg.kind === 'dodge') { // a dodger that can jump wears a steady dashed ring; while it recharges an arc counts the window down
      const K = A.dodge, rd = rr + C.timerWidth + K.ringGap, cool = tg.nextDodge - run.steps * STEP;
      ctx.lineWidth = K.ringWidth;
      if (cool <= 1e-9) {
        ctx.strokeStyle = P.ink; ctx.lineWidth = K.ringWidth + 2; ctx.setLineDash(DODGE_DASH); ctx.beginPath(); ctx.arc(tg.x, tg.y, rd, 0, PI2); ctx.stroke();
        ctx.strokeStyle = P.orange; ctx.lineWidth = K.ringWidth; ctx.beginPath(); ctx.arc(tg.x, tg.y, rd, 0, PI2); ctx.stroke(); ctx.setLineDash(NO_DASH);
      } else {
        const e2 = -Math.PI / 2 + PI2 * clamp(cool / T.dodgeCooldown, 0, 1);
        ctx.lineCap = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = K.ringWidth + 2; ctx.beginPath(); ctx.arc(tg.x, tg.y, rd, -Math.PI / 2, e2); ctx.stroke();
        ctx.globalAlpha = alpha * K.coolAlpha; ctx.strokeStyle = P.orange; ctx.lineWidth = K.ringWidth; ctx.beginPath(); ctx.arc(tg.x, tg.y, rd, -Math.PI / 2, e2); ctx.stroke(); ctx.globalAlpha = alpha; ctx.lineCap = 'butt';
      }
    }
  }
  if (turn) ctx.restore();
  ctx.globalAlpha = 1;
}

// Hit points are a second pass so no neighbouring plate covers them.
function drawTargetHp(ctx, tg, alpha) {
  if (tg.hp === undefined || tg.kind === 'zpart') return;
  const R2 = T.zoneR[2] * tg.sc;
  ctx.globalAlpha = alpha; drawHp(ctx, tg.x, tg.y + (tg.kind === 'core' ? R2 + A.core.glow[0] + 2 : R2 * A.plate.r) + 6, tg.hp, tg.hpMax); ctx.globalAlpha = 1;
}

// ---- Zombies (v0.5 G and L) ----
// A zombie is drawn from the same pose the hit circles follow (its type's `pose`), so what you see is what a line crosses: legs and body while they stand, the body dragged low with the legs
// down, the head alone with both gone. Drawn in the zombie's own units (feet at the origin, scaled by its lane and its type's size), leaning into its walk; the gait follows its position, so it
// needs no state. The types differ in size, colour and shape: the Runner leans hard, the Crawler is on its hands from the start, the Brute is broad and tall, the Hunched one stoops over its head.
function zPose(z) { const P2 = z.ty.pose; return z.legsDown ? (z.bodyDown ? P2.drag : P2.crawl) : z.bodyDown ? P2.hunch : P2.stand; }
function limb(g, x0, y0, x1, y1, w, col) { g.strokeStyle = P.ink; g.lineWidth = w + 3; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
const ZCOL = { s: ['zSkin', 'zShirt', 'zPants'], r: ['zSkinR', 'zShirtR', 'zPants'], c: ['zSkinC', 'zShirtC', 'zPants'], b: ['zSkinB', 'zShirtB', 'zPantsB'], h: ['zSkinH', 'zShirtH', 'zPants'] };
function paintZombie(g, z, flash, phase, lean, bob) {
  const Z = T.zombie, ty = z.ty, k = ty.size, pl = zPose(z), legs = !z.legsDown, body = !z.bodyDown, [skinK, shirtK, pantsK] = ZCOL[ty.id], skin = P[skinK], shirt = P[shirtK], pants = P[pantsK];
  const stoop = !!ty.shield && legs && body, u = (v) => v / k, hx = u(pl.brain[0]), hy = -u(pl.brain[1]) - (bob || 0) / k;
  const sw = Math.sin(phase) * 7, bobY = legs ? Math.abs(Math.sin(phase)) * 1.5 : 0;
  g.save(); g.scale(k, k); g.lineCap = 'round'; g.lineJoin = 'round';
  g.fillStyle = P.shadow; g.beginPath(); g.ellipse(2, 1, legs ? 15 : 24, 3.5, 0, 0, PI2); g.fill();
  if (legs) { // two legs, the far one darker; the front one swings toward the fence
    limb(g, 2, -34, 2 - sw, 0, 9, pants); limb(g, -2, -34, -2 + sw, 0, 9, pants);
    g.fillStyle = P.ink; g.fillRect(-2 - sw - 5, -3, 9, 3); g.fillRect(-2 + sw - 5, -3, 9, 3);
  } else { // the stumps behind a crawler
    limb(g, 14, -9, 26, -6, 9, pants); g.fillStyle = P.zWound; g.beginPath(); g.arc(27, -6, 4, 0, PI2); g.fill();
  }
  const head = () => { // the head: skin, a dark eye, an open mouth, the exposed brain with the goal's cyan ring round it (dim and padlocked while the body shields it)
    g.fillStyle = skin; g.beginPath(); g.arc(hx, hy, 8, 0, PI2); g.fill(); g.strokeStyle = P.ink; g.lineWidth = 2.2; g.stroke();
    g.fillStyle = P.zBrain; g.beginPath(); g.ellipse(hx + 1, hy - 5, 5, 2.9, 0, 0, PI2); g.fill();
    g.fillStyle = P.ink; g.beginPath(); g.arc(hx - 3.2, hy - 0.5, 1.5, 0, PI2); g.fill(); g.fillRect(hx - 5.5, hy + 3, 5, 1.6);
  };
  const ring = (dim) => { g.strokeStyle = P.cyan; g.globalAlpha = dim ? 0.3 : 0.6; g.lineWidth = 1.4; g.beginPath(); g.arc(hx, hy, ty.brain.r + (ty.id === 'b' ? 0.8 : 2.6), 0, PI2); g.stroke(); g.globalAlpha = 1; };
  g.save(); if (legs) { g.translate(0, -bobY); g.rotate(lean); }
  if (stoop) { // stooped over its head: long arms hanging forward, the head behind the shoulder, out of the shot lines
    head(); ring(true);
    limb(g, -6, -44, -27, -34 + Math.sin(phase) * 2, 6, skin);
    g.fillStyle = shirt; g.save(); g.translate(-2, -44); g.rotate(-0.42); rrect(g, -15, -20, 30, 38, 9); g.restore(); g.fill(); g.strokeStyle = P.ink; g.lineWidth = 2.2; g.stroke();
    g.strokeStyle = P.inkSoft; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-8, -40); g.lineTo(-3, -30); g.lineTo(2, -37); g.stroke();
    limb(g, -6, -50, -27, -42 + Math.sin(phase + 1) * 2, 6, skin);
    g.save(); g.translate(hx, hy); g.scale(0.55, 0.55); drawLock(g, 0, 0, P.text); g.restore();
  } else {
    if (body) {
      const bx = pl.body[0] / k, by = -pl.body[1] / k;
      if (z.legsDown) { // crawling: the torso lies forward, an arm reaching and one dragging
        limb(g, bx - 8, by - 2, bx - 32, by + 3 + Math.sin(phase) * 3, 6, skin); limb(g, bx - 4, by + 4, bx - 26, by + 10, 6, P.zSkinDark);
        g.fillStyle = shirt; rrect(g, bx - 15, by - 10, 32, 20, 8); g.fill(); g.strokeStyle = P.ink; g.lineWidth = 2.2; g.stroke();
      } else {
        limb(g, -1, by - 10, -27, by - 6 + Math.sin(phase) * 2, 6, P.zSkinDark); // arms out to the fence
        g.fillStyle = shirt; rrect(g, -11, by - 15, 22, 30, 6); g.fill(); g.strokeStyle = P.ink; g.lineWidth = 2.2; g.stroke();
        g.strokeStyle = P.inkSoft; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-5, by - 2); g.lineTo(-1, by + 6); g.lineTo(3, by + 1); g.stroke(); // a tear
        limb(g, -1, by - 8, -27, by - 12 + Math.sin(phase + 1) * 2, 6, skin);
      }
    } else if (legs) { // body down: a torn stump of a torso under the head, ribs showing
      g.fillStyle = P.zWound; rrect(g, -8, -47, 16, 14, 4); g.fill(); g.strokeStyle = P.ink; g.lineWidth = 2; g.stroke();
      g.strokeStyle = P.paper; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-5, -44); g.lineTo(5, -44); g.moveTo(-5, -40); g.lineTo(5, -40); g.stroke();
      limb(g, -2, -50, -25, -46 + Math.sin(phase) * 2, 6, skin);
    } else limb(g, hx - 4, hy + 3, hx - 22, hy + 6, 6, skin); // head only: a hand still reaching
    head(); ring(false);
  }
  g.restore(); g.restore();
  if (flash) for (const p of Object.values(z.parts)) if (p && z.now - p.hitAt < Z.hitFlash) { // a part just hit: a white flash over its circle
    g.globalAlpha = 0.65 * (1 - (z.now - p.hitAt) / Z.hitFlash); g.fillStyle = P.white; g.beginPath(); g.arc((p.x - z.x) / z.sc, (p.y - z.y) / z.sc, p.rad / z.sc, 0, PI2); g.fill(); g.globalAlpha = 1;
  }
}
function drawZombie(ctx, z, now) {
  z.now = now;
  const sc = z.sc, id = z.ty.id, lean = id === 'r' ? -0.28 : id === 'b' ? 0.03 : id === 's' ? 0.05 : 0, bob = z.parts.brain && z.ty.bob && !z.legsDown ? (z.ty.bob / 2) * Math.sin((PI2 * (now - z.born)) / T.zombie.bobPeriod) : 0;
  ctx.save(); ctx.translate(z.x, z.y); ctx.scale(sc, sc);
  paintZombie(ctx, z, 1, z.x * 0.32 / z.ty.size * (id === 'r' ? 0.7 : 1), lean, bob);
  ctx.restore();
  for (const p of Object.values(z.parts)) if (p && p.hp < p.hpMax && !p.hidden) drawHp(ctx, p.x, p.y - p.rad - 5, p.hp, p.hpMax); // a damaged part shows what it has left
}
// A zombie that has gone down: it topples about its feet and fades (cosmetic; the sim removed it at the brain shot).
function drawCorpse(ctx, f) {
  const k = 1 - f.t / f.max, z = { ty: ZTYPES[f.ty || 's'], legsDown: f.crawl, bodyDown: false, parts: {}, sc: f.sc };
  ctx.save(); ctx.translate(f.x, f.y); ctx.scale(f.sc, f.sc); ctx.globalAlpha = 1 - k; ctx.rotate(-Math.min(1.45, k * 2.6) * (f.crawl ? 0.25 : 1));
  paintZombie(ctx, z, 0, 0, 0, 0);
  ctx.restore(); ctx.globalAlpha = 1;
}
// The fence: a palisade at the near edge of the field, red when a zombie is close. The sim ends the run when one touches it; this is only its look.
function drawFence(ctx, run) {
  const Z = T.zombie, fx = Z.fenceX, top = 190, bot = HORIZON + 4;
  let near = 1e9; for (const z of run.zs) near = Math.min(near, z.x - zReach(z) - fx);
  ctx.lineJoin = 'round'; ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) { // three planks side by side with pointed tops
    const x = fx - 8 + i * 6, h = i === 1 ? 0 : 5;
    ctx.fillStyle = i === 1 ? P.woodDark : P.wood; ctx.strokeStyle = P.ink;
    ctx.beginPath(); ctx.moveTo(x, bot); ctx.lineTo(x, top + h + 6); ctx.lineTo(x + 3, top + h); ctx.lineTo(x + 6, top + h + 6); ctx.lineTo(x + 6, bot); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = P.steelDark; ctx.strokeStyle = P.ink; ctx.lineWidth = 1.6;
  for (const y of [top + 26, top + 62]) { ctx.fillRect(fx - 12, y, 24, 5); ctx.strokeRect(fx - 12, y, 24, 5); } // two crossbars
  if (near < 140) { ctx.globalAlpha = 0.5 * (1 - Math.max(0, near) / 140); ctx.fillStyle = P.red; ctx.fillRect(fx - 12, top, 24, bot - top); ctx.globalAlpha = 1; } // danger
}

// ---- Reload (v0.5 M): the button, the ring on the gun, the text cue ----
// The Reload button is 100 x 44 screen px at the right end of the ground band, below the lane the gun's line can take (the gun stops at gunMaxY, the band starts under it), clear of the
// HUD (top) and of the combo (centre). In portrait it sits in the letterbox under the field. A tap on it reloads and never fires.
function reloadRect(E, v) {
  const w = 100, h = 44;
  return E.h > E.w ? { x: v.ox + v.w - 12 - w, y: v.oy + v.h + 6, w, h } : { x: v.ox + v.w - 8 - w, y: v.oy + v.h - h - 4, w, h };
}
// A ring round the grip, filling clockwise from the top as the reload goes.
function drawReloadRing(ctx, run, now) {
  if (!run.reloading) return;
  const f = reloadFrac(run, now), R = 34;
  ctx.lineCap = 'round';
  ctx.strokeStyle = P.ink; ctx.globalAlpha = 0.55; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(T.gunX, run.gunY, R, 0, PI2); ctx.stroke();
  ctx.globalAlpha = 1; ctx.strokeStyle = P.cyan; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.arc(T.gunX, run.gunY, R, -Math.PI / 2, -Math.PI / 2 + PI2 * f); ctx.stroke();
  ctx.lineCap = 'butt';
}

// The combo multiplier beside the lane: big, at the muzzle end of the range finder (below it when the gun is high, above when low, so the HUD is never under it),
// dim at x1, orange while the streak lives, lighter at the cap, and it swells for a moment on every step. It draws the combo that already exists (past the fence on a zombie run).
function drawMult(ctx, run) {
  const mult = Math.min(T.comboCap, 1 + T.comboStep * run.streak), live = run.streak > 0, pulse = clamp(1 - (run.steps * STEP - S.multAt) / A.mult.pulse, 0, 1);
  const size = A.mult.size * (1 + A.mult.swell * pulse), x = run.ch.ladder === 'zombie' ? T.zombie.fenceX + 16 : A.mult.x, y = run.gunY + (run.gunY < A.mult.flip ? A.mult.dy : -A.mult.dy);
  ctx.font = `${TY.strong} ${size}px system-ui, sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const str = `x${mult.toFixed(1)}`;
  ctx.globalAlpha = live ? 1 : 0.55; ctx.lineWidth = A.popLine; ctx.strokeStyle = P.ink; ctx.strokeText(str, x, y);
  ctx.fillStyle = !live ? P.textDim : mult >= T.comboCap ? P.orangeLight : P.orange; ctx.fillText(str, x, y); ctx.globalAlpha = 1;
}

// ---- Range finder and hit feedback ----

// Dots along the true barrel line, scaled and faded with distance, orange near the muzzle. It ends `accuracy` of the way to the right
// edge; a short one gets a soft cap so the end reads as deliberate.
function drawRangeFinder(ctx, run, flash) {
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
  if (flash > 0) { // a dropped tap: the whole line goes white for a moment, dots swollen
    const D = A.drop;
    ctx.globalAlpha = flash * D.lineAlpha; ctx.strokeStyle = P.white; ctx.lineWidth = F.track * 0.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(gx + cs * d0, gy - sn * d0); ctx.lineTo(gx + cs * d1, gy - sn * d1); ctx.stroke(); ctx.lineCap = 'butt';
    ctx.fillStyle = P.white; ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n, d = d0 + (d1 - d0) * f, r = (F.rNear + (F.rFar - F.rNear) * f) * D.dotK, x = gx + cs * d;
      ctx.moveTo(x + r, gy - sn * d); ctx.arc(x, gy - sn * d, r, 0, PI2);
    }
    ctx.fill(); ctx.globalAlpha = 1;
  }
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
// ---- The range menu (PRD v0.5 F): each ladder a lane of targets on posts, one per rung, drawn as the rung's own target type ----

// The menu's sprites (a rung's target, a small gun) live in their own cache, so going to play and back does not rebuild them; it is rebuilt only if the pixel ratio
// changes, and the icons are built at start (init), not in the menu's first frame.
const MSPR = new Map();
let MSPR_K = 0;
function menuSprite(ctx, key, ext, paint, x, y, a, b, k = 1) {
  let s = MSPR.get(key);
  if (s === undefined) {
    s = null;
    if (typeof OffscreenCanvas !== 'undefined' && MSPR_K) {
      const cv = new OffscreenCanvas(Math.ceil(2 * ext * MSPR_K), Math.ceil(2 * ext * MSPR_K)), g = cv.getContext('2d');
      if (g) { g.scale(cv.width / (2 * ext), cv.height / (2 * ext)); g.translate(ext, ext); paint(g, a, b); s = cv; }
    }
    MSPR.set(key, s);
  }
  if (s) ctx.drawImage(s, x - ext * k, y - ext * k, 2 * ext * k, 2 * ext * k); else { ctx.save(); ctx.translate(x, y); ctx.scale(k, k); paint(ctx, a, b); ctx.restore(); }
}
function prepMenu(dpr, ctx) {
  const k = Math.round(dpr * 100) / 100;
  if (k !== MSPR_K) { MSPR.clear(); MSPR_K = k; }
  if (ctx && !MSPR.size) [...CHALLENGES, ENDLESS].forEach((ch, i) => menuSprite(ctx, K_ICON + i, A.menu.ext, paintRung, 0, 0, ch, 0));
}
// What stands on a rung's post: a card, a card on a trolley, a weaver, a horde's small cards, a clay (with a decoy for Skeet 3), a plate, the Bunker's frame.
function paintRung(g, ch) {
  g.lineJoin = 'round';
  const R = T.zoneR, base = ch.ladder === 'boss' ? 0.5 : 0.5 * clamp(ch.scale || 1, 0.7, 1.2);
  if (ch.ladder === 'accuracy') drawCard(g, 0, 0, base, 1, false);
  else if (ch.ladder === 'speed') {
    if (ch.waves || ch.behaviour === 'horde') for (let k = -1; k <= 1; k++) drawCard(g, 0, k * 10, 0.3, 1, true);
    else { drawCard(g, 0, -2, base * 0.85, 1, false); g.fillStyle = P.steelDark; g.fillRect(-9, 11, 18, 3); disc(g, -5, 15, 2.2, P.steel); disc(g, 5, 15, 2.2, P.steel); if (ch.behaviour === 'weave') { g.strokeStyle = P.cyan; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-14, 4); g.bezierCurveTo(-8, -12, -2, 14, 4, -2); g.stroke(); } }
  } else if (ch.ladder === 'skeet') {
    if (ch.volley) { drawClay(g, -4, 2, 0.8, false); drawClay(g, 9, -6, 0.5, true); } else drawClay(g, 0, 0, 0.9, false);
  } else if (ch.ladder === 'zombie') { // one, two or three zombies for the rung's wave count; the endless mode shows the crowd
    const n = ch.endless ? 3 : ch.level, k = n === 1 ? 0.3 : 0.24, zs = { ty: ZTYPES.s, legsDown: false, bodyDown: false, parts: {}, sc: 1 };
    for (let i = 0; i < n; i++) { g.save(); g.translate((i - (n - 1) / 2) * 11, 14 - (i % 2) * 2); g.scale(k, k); paintZombie(g, { ...zs, ty: ZTYPES[ENDLESS_MIX_ICON[i % 3]] }, 0, 0.5 + i, 0, 0); g.restore(); }
  } else if (ch.wall) { paintFrame(g, base); paintPlate(g, base * 0.55, true); } else paintPlate(g, base, false);
}
// A ticket: a rounded stub with a notch bitten from each side and a dashed edge, centred on x, y (behind a delighter's line on the card).
function drawTicket(ctx, x, y, w, h, col) {
  const l = x - w / 2, r = x + w / 2, t = y - h / 2, b = y + h / 2, k = 5;
  ctx.beginPath(); ctx.moveTo(l + 6, t); ctx.lineTo(r - 6, t); ctx.quadraticCurveTo(r, t, r, t + 6); ctx.lineTo(r, y - k); ctx.arc(r, y, k, -Math.PI / 2, Math.PI / 2, true); ctx.lineTo(r, b - 6);
  ctx.quadraticCurveTo(r, b, r - 6, b); ctx.lineTo(l + 6, b); ctx.quadraticCurveTo(l, b, l, b - 6); ctx.lineTo(l, y + k); ctx.arc(l, y, k, Math.PI / 2, -Math.PI / 2, true); ctx.lineTo(l, t + 6); ctx.quadraticCurveTo(l, t, l + 6, t); ctx.closePath();
  ctx.fillStyle = P.panelHi; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.setLineDash(SEL_DASH); ctx.stroke(); ctx.setLineDash(NO_DASH);
}

// A menu swatch on a plate, hit rect r; the worn one is ringed in orange, a locked one carries a padlock.
function drawChip(ctx, E, r, skin, on, open) {
  const C = A.chip, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  plate(E, r.x + 2, r.y + 2, r.w - 4, r.h - 4, on ? P.panelHi : P.panel, on ? P.orange : P.panelEdge);
  paintChip(ctx, cx, cy, C.size, C.radius, skin, open);
  if (!open) drawLock(ctx, cx, cy, P.text);
}
// ---------- Play state ----------

const S = {};

function newRun(ch, id, gauntlet, skin) {
  S.ch = ch; S.gunId = id; S.skin = skin || 'std'; S.run = makeRun(ch, id); S.gauntlet = gauntlet === undefined ? null : gauntlet;
  S.fx = []; S.nope = -9; S.endT = 0; S.drag = null; S.right = new Set(); S.breachAt = -1; S.multAt = -9; S.killAt = -9; S.slow = 0; S.slowed = false; S.swept = false;
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
    if (ev.outer) S.fx.push({ k: 'callout', x: ev.outer.x, y: Math.max(ev.outer.y - 46, 40), text: 'Centre pellet scores', color: P.textDim, size: TY.mid, t: T.calloutLife, max: T.calloutLife }); // a shotgun's outer pellet on a card counts for nothing
    if (ev.decoy) { // the minus shows on the decoy that was hit
      S.fx.push({ k: 'pop', x: ev.tx, y: ev.ty, text: `\u2212${-ev.pts}`, color: P.text, t: T.popLife, max: T.popLife });
      E.audio.play('miss', 0.6); E.haptic(20);
    }
    if (ev.hit) {
      S.multAt = S.run.steps * STEP; if (ev.killed) S.killAt = S.multAt;
      const word = ev.tag || (ev.streak === 2 ? 'Double' : ev.streak === 3 ? 'Triple' : ev.streak >= 5 && ev.streak % 5 === 0 ? `${ev.streak} in a row` : null); // streak call-outs, in the goal colour (a zombie's part or brain shot names itself)
      if (word) S.fx.push({ k: 'callout', x: ev.tx, y: ev.ty - 46, text: word, t: T.calloutLife, max: T.calloutLife });
      if (ev.lost) S.fx.push({ k: 'callout', x: ev.tx, y: ev.ty - 72, text: 'Chain lost', color: P.red, t: T.calloutLife, max: T.calloutLife }); // a zombie hit that was not the brain
      S.fx.push({ k: 'pop', x: ev.tx, y: ev.ty, text: `${ev.pts}`, color: P.zone[ev.zone], t: T.popLife, max: T.popLife });
      if (ev.zone === 0) { E.audio.play('coin'); E.haptic(16); }
      E.audio.play('hit', 0.5);
      E.audio.beep({ freq: 440 * Math.pow(2, Math.min(ev.streak, 12) / 12), dur: 0.06, type: 'triangle', gain: 0.1 });
    }
  } else if (ev.type === 'reload') { E.audio.beep({ freq: 200, dur: 0.09, type: 'square', gain: 0.07 });
  } else if (ev.type === 'shell') { E.audio.beep({ freq: 330, dur: 0.04, type: 'square', gain: 0.05 });
  } else if (ev.type === 'reloaded') { E.audio.beep({ freq: 560, dur: 0.07, type: 'triangle', gain: 0.09 });
  } else if (ev.type === 'interrupt') { E.audio.beep({ freq: 260, dur: 0.05, type: 'square', gain: 0.05 });
  } else if (ev.type === 'dropped') { // a tap inside the fire interval, or during a reload: the range finder flashes white and it clicks, no effect on timing
    if (ev.reload) S.nope = E.time;
    E.audio.play('tap'); E.haptic(A.drop.haptic);
    S.fx = S.fx.filter((f) => f.k !== 'finder'); S.fx.push({ k: 'finder', t: A.drop.life, max: A.drop.life });
  } else if (ev.type === 'dodge') { // the target jumped: a ghost stays where it was, the target slides, a call-out and a soft note
    S.fx.push({ k: 'ghost', x: ev.x, y: ev.y0, sc: ev.sc, t: A.dodge.ghostLife, max: A.dodge.ghostLife });
    S.fx.push({ k: 'slide', x: ev.x, y0: ev.y0, y1: ev.y1, t: A.dodge.slide, max: A.dodge.slide });
    S.fx.push({ k: 'callout', x: ev.x - A.dodge.calloutDx, y: Math.max((ev.y0 + ev.y1) / 2, 40), text: 'Dodged', color: P.orangeLight, t: T.calloutLife, max: T.calloutLife });
    E.audio.beep({ freq: A.dodge.beep, dur: 0.09, type: 'sine', gain: 0.06 });
  } else if (ev.type === 'expire' && ev.card) { // an Accuracy card timed out: it says so, and a chain that dies says so
    S.fx.push({ k: 'callout', x: ev.x, y: Math.max(ev.y - 40, 40), text: 'Gone', color: P.textDim, size: TY.mid, t: T.calloutLife, max: T.calloutLife });
    if (ev.lost) S.fx.push({ k: 'callout', x: ev.x, y: Math.max(ev.y - 64, 40), text: 'Chain lost', color: P.red, size: TY.mid, t: T.calloutLife, max: T.calloutLife });
    if (!ev.flip) E.audio.play('miss', 0.5);
  } else if (ev.type === 'wave') { // a wave enters
    S.fx.push({ k: 'callout', x: T.designW / 2, y: 120, text: `Wave ${ev.n}`, t: T.calloutLife * 1.4, max: T.calloutLife * 1.4, big: true });
    E.audio.play('tap', 0.4);
  } else if (ev.type === 'fall') { // a zombie goes down: it topples and fades
    S.fx.push({ k: 'corpse', x: ev.x, y: ev.y, sc: ev.sc, crawl: ev.crawl, t: 0.6, max: 0.6 });
    E.audio.play('coin', 0.6);
  } else if (ev.type === 'fence') { // one touched the fence: the run is over
    S.fx.push({ k: 'edge', t: T.edgeLife * 2, max: T.edgeLife * 2 });
    E.audio.play('lose'); E.haptic(60); E.shake(9, 0.35);
  } else if (ev.type === 'breach') {
    S.fx.push({ k: 'edge', t: T.edgeLife, max: T.edgeLife });
    if (E.time - S.breachAt >= T.breachGap) { S.breachAt = E.time; E.audio.play('miss'); E.haptic(30); } // a horde breaching together sounds once
  }
}

// The playtest ledger (ADR-0016): what a tester did, so an export lists every result, retry, quit, badge and gun or skin change.
function pickGun(E, id) { if (gunId(E) !== id) E.ledger.add('gun', { gun: id }); E.save.set('gun', id); }
function wearSkin(E, gun, skin) { if (skinId(E, gun) !== skin.id) E.ledger.add('skin', { gun, skin: skin.id }); E.save.update('skins', (m) => ({ ...(m && typeof m === 'object' ? m : {}), [gun]: skin.id }), {}); }
function quitRun(E, why) {
  const r = S.run;
  if (r && !r.done) E.ledger.add(why, { id: S.ch.id, gun: r.gun.id, score: r.score, shots: r.shots, hits: r.hits, time: r.steps * STEP, ...(r.ammo === Infinity ? {} : { ammo: r.ammo }) });
}

function endRun(E) {
  const r = S.run, ch = S.ch, gid = r.gun.id, stars = ch.endless ? 0 : starsFor(ch, r.score, gid);
  const prev = ch.endless ? null : bestOf(E, ch, gid), prevStars = ch.endless ? 0 : starsOf(E, ch, gid);
  // Stars are monotonic and kept apart from the best score: a higher score with fewer stars never lowers them. All per gun.
  let bestWave = 0, isNew = !prev || r.score > prev.score, bestScore = isNew ? r.score : prev ? prev.score : 0, bestStars = Math.max(stars, prevStars), acc = r.shots ? Math.round((100 * r.hits) / r.shots) : 0, day = null;
  if (ch.endless) { // no stars: the day's seed has its own best, and there is an all-time best
    const zz = E.save.get('zend', null), d = zz && typeof zz === 'object' ? zz : {}, today = d.day === E.dailySeed() && d.today ? d.today : { score: 0, wave: 0 }, best = d.best || { score: 0, wave: 0 };
    isNew = r.score > best.score; bestScore = Math.max(best.score, r.score); bestWave = isNew ? r.wave : best.wave;
    day = { best: Math.max(today.score, r.score), isNew: r.score > today.score, wave: r.score > today.score ? r.wave : today.wave };
    E.save.set('zend', { day: E.dailySeed(), today: { score: day.best, wave: day.wave }, best: isNew ? { score: r.score, wave: r.wave, gun: gid } : best });
  } else if (isNew || bestStars !== prevStars) {
    E.save.update('best', (b) => { const all = b && typeof b === 'object' ? b : {}; return { ...all, [ch.id]: { ...(all[ch.id] || {}), [gid]: { score: bestScore, stars: bestStars, accuracy: isNew ? acc : prev.accuracy || 0 } } }; }, {});
  }
  const cold = r.firstZone === 0 ? E.save.get('cold', 0) + 1 : 0; // runs in a row that opened on a bullseye, kept across runs
  E.save.set('cold', cold);
  // Gun mastery (v0.5 N): the run's counters join the gun's lifetime ones; a tier reached opens that tier's skin.
  const m0 = masteryOf(E, gid), m1 = { shots: m0.shots + r.shots, hits: m0.hits + r.hits, bulls: m0.bulls + r.cBull, heads: m0.heads + r.cHead, plates: m0.plates + r.cPlate }, t0 = masteryInfo(m0).tier, t1 = masteryInfo(m1).tier;
  E.save.update('mastery', (all) => ({ ...(all && typeof all === 'object' ? all : {}), [gid]: m1 }), {});
  const tierSkins = [];
  for (let t = t0 + 1; t <= t1; t++) {
    E.ledger.add('mastery', { gun: gid, tier: TIER_NAMES[t], score: m1.bulls + m1.heads });
    for (const sk of A.skins[gid]) if (sk.tier === t && !(skinsHadMap(E)[gid] && skinsHadMap(E)[gid][sk.id])) tierSkins.push(sk);
  }
  const gaunt = S.gauntlet === null ? null : gauntletStep(S.gauntlet, stars);
  const fresh = newBadges({ ch, gun: r.gun.id, stars, double: r.double, decoyHits: r.decoyHits, run: r, cold, gauntletDone: !!(gaunt && gaunt.done), bests: Object.fromEntries(CHALLENGES.map((c) => [c.id, Object.fromEntries(GUN_IDS.map((g) => [g, { stars: starsOf(E, c, g) }]))])), have: badgeMap(E) });
  E.ledger.add('result', { id: ch.id, gun: gid, score: r.score, accuracy: acc, stars, best: bestStars, time: r.steps * STEP, hits: r.hits, shots: r.shots, bulls: r.cBull, heads: r.cHead, plates: r.cPlate, ...(r.ammo === Infinity ? {} : { ammo: r.ammo }), reloads: r.reloads, ...(ch.ladder === 'zombie' ? { wave: r.wave, down: r.zdown, fence: !!r.breach } : {}), ...(S.gauntlet === null ? {} : { gauntlet: S.gauntlet }) });
  for (const id of fresh) E.ledger.add('badge', { id, gun: gid, on: ch.id });
  if (fresh.length) E.save.update('badges', (b) => ({ ...(b && typeof b === 'object' ? b : {}), ...Object.fromEntries(fresh.map((id) => [id, 1])) }), {});
  const badgeSkins = fresh.map(skinOfBadge).filter(Boolean);
  const unlocked = badgeSkins.map((k) => `${T.guns[k.gun].short} ${k.skin.name}`).concat(tierSkins.map((k) => `${T.guns[gid].short} ${k.name}`)); // shown on the card's skin line
  const news = tierSkins.map((k) => [gid, k.id]).concat(badgeSkins.map((k) => [k.gun, k.skin.id]));
  if (news.length) E.save.update('skinsNew', (m) => { const o = { ...(m && typeof m === 'object' ? m : {}) }; for (const [g, id] of news) o[g] = [...new Set([...(o[g] || []), id])]; return o; }, {}); // the rack marks a gun with a skin not yet looked at
  // A Bunker cleared early leaves plates standing; say what they were worth (a full combo, the shots the gun needs per plate).
  const left = ch.wall && r.cleared ? r.targets.filter((t) => t.kind === 'part').length : 0;
  const perPlate = Math.ceil((ch.plateHp || 0) / (r.gun.damage * (r.gun.pellets > 1 ? 3 : 1)));
  const zom = ch.ladder === 'zombie' ? { zdown: r.zdown, ztotal: ch.endless ? 0 : r.list.reduce((n, w) => n + w.length, 0), zwave: r.wave, zwaves: ch.endless ? 0 : r.list.length, breach: r.breach, day, bestWave } : {};
  E.setScene('over', { id: ch.id, gun: r.gun.name, gunId: r.gun.id, skin: S.skin, platesLeft: left, platesValue: left * perPlate * T.zonePoints[0] * T.comboCap, score: r.score, stars, best: bestScore, isNew, bestStars, hits: r.hits, bulls: r.bulls, shots: r.shots, badges: fresh, gaunt, thr: ch.endless ? null : thresholds(ch, r.gun.id), preset: presetName(), skins: unlocked, tierUp: t1 > t0 ? { gun: T.guns[gid].short, name: TIER_NAMES[t1] } : null, ...zom });
}

function meterText(r, ch) {
  if (ch.ladder === 'accuracy') return `Rounds ${r.ammo}`; // the challenge's rounds; the magazine is on the Reload button
  if (ch.ladder === 'skeet') { let n = 0; for (let i = r.idx; i < r.list.length; i++) if (!r.list[i].decoy) n++; for (const t of r.targets) if (!t.decoy) n++; return `Left ${n}`; } // goal clays only
  if (ch.ladder === 'zombie') return ch.endless ? `Wave ${r.wave}  Down ${r.zdown}` : `Wave ${r.wave}/${r.list.length}  Down ${r.zdown}`;
  return `Time ${Math.max(0, Math.ceil((ch.speedSeconds || ch.bossSeconds) - r.steps * STEP))}`;
}

// ---------- Menu layout ----------

// ---- The menu (v0.5 N): the gun is the context ----
// Landscape: the gun rack across the top (EXPORT and TUNE keep their corners), the selected gun's five lanes under it, and one row of corner buttons and the hint line at the bottom. Portrait
// (the fallback) stacks the selected gun's panel, the rack's row, the lanes, the hint and the buttons. Every tile and button is 44 px or more.
function menuLayout(E) {
  const M = A.menu, land = E.w >= E.h * 1.2, sl = E.safe.left, sr = E.safe.right, st = E.safe.top, sb = E.safe.bottom, sel = gunId(E), L = { land, rows: [], rack: [] };
  const nl = LADDERS.length, count = (ladder) => CHALLENGES.filter((c) => c.ladder === ladder).length;
  if (land) {
    const x0 = sl + 90, x1 = E.w - sr - 84, rackW = x1 - x0, y = st + 4; // the engine's EXPORT tab ends 82 px in from the left, its TUNE tab starts 74 px in from the right
    const selW = clamp(rackW * 0.4, M.selMin, M.selMax), uw = clamp((rackW - selW - 5 * M.gap) / 5, M.tileMin, M.tileMax);
    let x = x0;
    for (const id of GUN_IDS) { const w = id === sel ? selW : uw; L.rack.push({ id, x, y, w, h: M.rackH, sel: id === sel }); x += w + M.gap; }
    const lx = sl + 10, lw = E.w - sl - sr - 20, laneTop = y + M.rackH + 6, btnY = E.h - sb - M.edge - M.btnH, pitch = Math.max(M.btnH + M.laneGap, (btnY - 6 - laneTop) / nl), gap = 6;
    LADDERS.forEach(([ladder, label], i) => L.rows.push({ ladder, label, x: lx, y: laneTop + i * pitch, h: pitch - M.laneGap, labelW: M.label, tw: (lw - M.label - 4 * gap) / 5, gap, n: count(ladder) }));
    const mw = 104, sw = 92, ew = 136;
    L.missions = { x: lx, y: btnY, w: mw, h: M.btnH }; L.mute = { x: lx + lw - sw, y: btnY, w: sw, h: M.btnH }; L.endless = { x: L.mute.x - 8 - ew, y: btnY, w: ew, h: M.btnH };
    L.hint = { x: lx + mw + 12, y: btnY, w: L.endless.x - 12 - (lx + mw + 12), h: M.btnH };
    L.word = { x: sl + 46, y: st + 57 }; L.titleArea = { x: sl + 6, y: st + 48, w: 84, h: 44 };
  } else {
    const side = 16 + Math.max(sl, sr), W = Math.min(E.w - 2 * side, 560), x0 = (E.w - W) / 2, y = st + 56, gap = 4, uw = (W - 5 * gap) / 6;
    L.word = { x: E.w / 2, y: st + 26 }; L.titleArea = { x: E.w / 2 - 50, y: st, w: 100, h: 52 };
    L.panel = { id: sel, x: x0, y, w: W, h: M.rackH, sel: true };
    GUN_IDS.forEach((id, i) => L.rack.push({ id, x: x0 + i * (uw + gap), y: y + M.rackH + 4, w: uw, h: M.btnH, sel: id === sel, small: true }));
    const laneTop = y + M.rackH + 4 + M.btnH + 8, pitch = M.btnH + 6, labelW = 78, lg = 4;
    LADDERS.forEach(([ladder, label], i) => L.rows.push({ ladder, label, x: x0, y: laneTop + i * pitch, h: pitch - M.laneGap, labelW, tw: (W - labelW - 4 * lg) / 5, gap: lg, n: count(ladder) }));
    const hy = laneTop + nl * pitch + 4, by = hy + 40, bw = (W - 16) / 3;
    L.hint = { x: x0, y: hy, w: W, h: 36 };
    L.missions = { x: x0, y: by, w: bw, h: 48 }; L.endless = { x: x0 + bw + 8, y: by, w: bw, h: 48 }; L.mute = { x: x0 + 2 * (bw + 8), y: by, w: bw, h: 48 };
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

// One rung: the target, the level, that gun's stars (a padlock if the rung is closed); ringed when it is the rung to play next. Narrow tiles (portrait) stack the art over the stars.
function drawRungTile(ctx, E, x, y, w, h, ch, locked, st, ring) {
  const narrow = w < 84, k = narrow ? 0.8 : 1, ext = A.menu.ext, ax = narrow ? x + w / 2 + 5 : x + 36, ay = narrow ? y + 19 : y + h / 2;
  plate(E, x, y, w, h, locked ? P.panel : P.panelHi, ring ? P.orange : P.panelEdge, 8);
  ctx.globalAlpha = locked ? 0.3 : 1; menuSprite(ctx, K_ICON + CHALLENGES.indexOf(ch), ext, paintRung, ax, ay, ch, 0, k); ctx.globalAlpha = 1;
  E.text(`${ch.level}`, x + 9, y + 11, { size: TY.small, weight: TY.strong, color: locked ? P.textDim : P.text });
  const sx = narrow ? x + w / 2 : x + 56 + (w - 62) / 2, sy = narrow ? y + h - 10 : y + h / 2, r = narrow ? 4.4 : 5.4, dx = narrow ? 12 : 16;
  if (locked) { ctx.save(); ctx.translate(sx, sy); ctx.scale(narrow ? 0.6 : 0.8, narrow ? 0.6 : 0.8); drawLock(ctx, 0, 0, P.textDim); ctx.restore(); }
  else for (let i = 0; i < 3; i++) drawStar(ctx, sx + (i - 1) * dx, sy, r, i < st ? P.brass : null, i < st ? null : P.panelEdge);
}
// The mastery bar and the tier: a track with a cyan fill toward the next tier (brass once Master).
function drawMasteryBar(E, x, y, w, info) {
  E.roundRect(x, y, w, 6, 3, P.panelEdge);
  E.roundRect(x, y, Math.max(6, w * info.frac), 6, 3, info.tier === 3 ? P.brass : P.cyan);
}
// The selected gun on the rack: the gun larger, its name, the mastery bar and tier, and the skin it wears (a star and "New skin" while one is waiting).
function drawRackSelected(ctx, E, b, id) {
  const g = T.guns[id], info = masteryInfo(masteryOf(E, id)), worn = skinById(id, skinId(E, id)), fresh = ((E.save.get('skinsNew', {}) || {})[id] || []).length > 0, tx = b.x + 90, tw = b.w - 90 - 8;
  plate(E, b.x, b.y, b.w, b.h, P.panelHi, P.orange);
  drawGunTile(ctx, id, b.x + 46, b.y + b.h / 2, 78, 42, worn.id);
  E.text(g.short, tx, b.y + 11, { size: TY.small, weight: TY.strong, align: 'left', color: P.text });
  drawMasteryBar(E, tx, b.y + 22, tw, info);
  E.text(TIER_NAMES[info.tier], tx, b.y + 37, { size: TY.small, weight: TY.strong, align: 'left', color: info.tier ? P.cyan : P.textDim });
  E.text(fresh ? 'New skin!' : worn.name, tx, b.y + 51, { size: TY.small, align: 'left', color: fresh ? P.cyan : P.textDim });
  if (fresh) drawStar(ctx, b.x + b.w - 12, b.y + 12, 7, P.cyan);
}
// A gun on the rack that is not selected: the silhouette, and three pips for its tier; a locked one shows a padlock and the star of the badge that opens it.
function drawRackSmall(ctx, E, b, open) {
  const cx = b.x + b.w / 2, worn = open ? skinId(E, b.id) : 'std', tier = open ? tierOf(E, b.id) : 0, bd = unlockBadge(b.id);
  plate(E, b.x, b.y, b.w, b.h, P.panel, P.panelEdge);
  ctx.globalAlpha = open ? 1 : 0.25; drawGunTile(ctx, b.id, cx, b.y + b.h / 2 - (b.small ? 0 : 5), b.w - 10, b.small ? b.h - 14 : b.h - 26, worn); ctx.globalAlpha = 1;
  if (!open) { drawLock(ctx, cx - 9, b.y + b.h / 2 - 2, P.text); drawStar(ctx, cx + 9, b.y + b.h / 2 + 3, 6, P.tier[bd.tier]); return; }
  if (!b.small) for (let i = 0; i < 3; i++) disc(ctx, cx + (i - 1) * 9, b.y + b.h - 8, 2.6, i < tier ? P.cyan : P.panelEdge);
}
// The one hint line: the next thing this gun opens and how, else the next mastery tier.
function menuHint(E, gid) {
  const locked = CHALLENGES.find((c) => !isUnlocked(E, c, gid));
  if (locked) return `${locked.name}: two stars on ${CHALLENGES.find((p) => p.ladder === locked.ladder && p.level === locked.level - 1).name}`;
  const info = masteryInfo(masteryOf(E, gid));
  if (info.accShort) return `Master needs ${Math.round(T.mastery.accuracy * 100)}% accuracy (now ${Math.round(info.acc * 100)}%)`;
  if (info.next !== null) return `${TIER_NAMES[info.tier + 1]}: ${info.next} bullseyes and headshots (${info.score} so far)`;
  return `Every rung is open and ${T.guns[gid].short} is Master`;
}
const menu = {
  enter() { this.tiles = []; this.guns = []; this.btnEndless = null; this.btnMute = null; this.btnMissions = null; },
  render(ctx, E) {
    const L = menuLayout(E), gid = gunId(E), play = firstPlayable(E, gid), earned = BADGES.filter((b) => badgeMap(E)[b.id]).length;
    prepMenu(E.dpr, ctx);
    E.titleArea = L.titleArea; // release: five taps on the small wordmark show TUNE
    E.text('RECOIL', L.word.x, L.word.y, { size: TY.small, weight: TY.strong, color: P.textDim });
    this.guns = [];
    if (L.panel) { drawRackSelected(ctx, E, L.panel, gid); this.guns.push(L.panel); }
    for (const b of L.rack) {
      const open = gunUnlocked(E, b.id);
      if (b.small) { drawRackSmall(ctx, E, b, open); if (b.sel) { ctx.strokeStyle = P.orange; ctx.lineWidth = 2; rrect(ctx, b.x, b.y, b.w, b.h, A.radius); ctx.stroke(); } }
      else if (b.sel) drawRackSelected(ctx, E, b, b.id); else drawRackSmall(ctx, E, b, open);
      this.guns.push(b);
    }
    this.tiles = [];
    for (const row of L.rows) {
      E.text(row.label, row.x, row.y + row.h / 2, { size: TY.small, align: 'left', color: P.textDim });
      CHALLENGES.filter((c) => c.ladder === row.ladder).forEach((ch, i) => {
        const x = row.x + row.labelW + i * (row.tw + row.gap), locked = !isUnlocked(E, ch, gid);
        drawRungTile(ctx, E, x, row.y, row.tw, row.h, ch, locked, starsOf(E, ch, gid), ch === play && !locked);
        this.tiles.push({ x, y: row.y, w: row.tw, h: row.h, ch, locked });
      });
    }
    const h = L.hint, lines = wrapText(ctx, menuHint(E, gid), h.w, TY.small).slice(0, 2);
    lines.forEach((ln, i) => E.text(ln, h.x + h.w / 2, h.y + h.h / 2 + (i - (lines.length - 1) / 2) * 18, { size: TY.small, color: P.textDim }));
    const two = (r, a, b2, fill, edge) => { plate(E, r.x, r.y, r.w, r.h, fill, edge); E.text(a, r.x + r.w / 2, r.y + r.h / 2 - 8, { size: TY.small, weight: TY.strong }); E.text(b2, r.x + r.w / 2, r.y + r.h / 2 + 9, { size: TY.small, color: P.textDim }); return r; };
    const zz = E.save.get('zend', null), d = zz && typeof zz === 'object' ? zz : {}, today = d.day === (E.dailySeed ? E.dailySeed() : 0) && d.today ? d.today.score : 0;
    this.btnMissions = two(L.missions, 'Missions', `${earned}/${BADGES.length}`, P.panelHi, P.ink);
    this.btnEndless = two(L.endless, 'Endless', today ? `Today ${today}` : 'New today', P.panelHi, P.cyan);
    this.btnMute = btn(E, E.audio.muted ? 'Sound: off' : 'Sound: on', L.mute.x + L.mute.w / 2, L.mute.y + L.mute.h / 2, { w: L.mute.w, h: L.mute.h, fill: P.slate, size: TY.small });
  },
  onTap(p, E) {
    if (E.hit(this.btnMute, p)) { E.audio.toggleMute(); E.audio.play('tap'); return; }
    if (E.hit(this.btnMissions, p)) { E.audio.play('tap'); E.setScene('missions'); return; }
    if (E.hit(this.btnEndless, p)) { E.audio.play('tap'); E.setScene('play', { id: ENDLESS.id }); return; }
    for (const b of this.guns) if (E.hit(b, p)) {
      if (!gunUnlocked(E, b.id)) { E.audio.play('tap', 0.3); const bd = unlockBadge(b.id); E.toast(`The ${T.guns[b.id].short} opens with the ${bd.name} badge (${bd.cond})`); }
      else { E.audio.play('tap'); if (gunId(E) === b.id) E.setScene('gun', { id: b.id }); else pickGun(E, b.id); } // the selected gun's tile is the stats card's button
      return;
    }
    for (const t of this.tiles) if (E.hit(t, p)) {
      if (t.locked) { E.audio.play('tap', 0.3); E.toast(`Two stars on ${CHALLENGES.find((c) => c.ladder === t.ch.ladder && c.level === t.ch.level - 1).name} with the ${T.guns[gunId(E)].short} open this`); }
      else E.setScene('play', { id: t.ch.id });
      return;
    }
  },
};

// Why the Gauntlet is locked: the rung before each locked stage needs two stars with the selected gun (Boss 1 is always open).
function gauntletReason(E) {
  const gun = gunId(E), need = GAUNTLET.map((id) => CHALLENGES.find((c) => c.id === id)).filter((c) => !isUnlocked(E, c, gun))
    .map((c) => CHALLENGES.find((p) => p.ladder === c.ladder && p.level === c.level - 1).name);
  return `Locked: two stars with the ${T.guns[gun].short} on ${need.join(', ')} first`;
}

// Missions: the badge tiers, in a list that scrolls by drag (or the 44 px rail on its right) when it does not fit. Earned badges are lit; the rest show what
// earns them and the skin each unlocks. The gauntlet starts here.
const missions = {
  enter() { this.back = null; this.btnGauntlet = null; this.reason = ''; this.scroll = 0; this.drag = null; this.v = null; this.rail = null; },
  render(ctx, E) {
    const have = badgeMap(E), land = E.w >= E.h * 1.2, side = 16 + Math.max(E.safe.left, E.safe.right), M = A.missions, top = E.safe.top;
    const W = Math.min(E.w - 2 * side, land ? 780 : 560), x0 = (E.w - W) / 2, earned = BADGES.filter((b) => have[b.id]).length;
    const open = GAUNTLET.every((id) => isUnlocked(E, CHALLENGES.find((c) => c.id === id), gunId(E)));
    this.reason = open ? '' : gauntletReason(E);
    this.back = btn(E, 'Back', x0 + 42, top + 30, { w: 84, h: 44, size: TY.small, fill: P.slate });
    E.text(land ? `Missions  ${earned}/${BADGES.length}   ·   Points ${pointsTotal(E)}` : `Missions  ${earned}/${BADGES.length}`, E.w / 2, top + 30, { size: land ? TY.mid + 2 : TY.mid, weight: TY.strong, color: P.text });
    if (!land) E.text(`Points ${pointsTotal(E)}`, E.w / 2, top + 66, { size: TY.small, weight: TY.strong, color: P.cyan });
    // The Gauntlet button: a padlock and its label placed by measure when locked, so they never touch.
    const gw = land ? 120 : 110, gx = x0 + W - gw / 2, gy = top + 30;
    this.btnGauntlet = btn(E, open ? 'Gauntlet' : '', gx, gy, { w: gw, h: 44, size: TY.small, fill: open ? P.orange : P.panelHi, color: P.ink });
    if (!open) {
      ctx.font = `${TY.strong} ${TY.small}px system-ui, sans-serif`;
      const tw = ctx.measureText('Gauntlet').width, all = M.lock + M.lockGap + tw, x = gx - all / 2;
      drawLock(ctx, x + M.lock / 2, gy, P.textDim);
      E.text('Gauntlet', x + M.lock + M.lockGap + tw / 2, gy, { size: TY.small, weight: TY.strong, color: P.textDim });
    }
    let listTop = top + (land ? 62 : 80);
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
      const on = !!have[b.id], col = P.tier[b.tier];
      plate(E, x, y, tw, M.th, on ? P.panelHi : P.panel, on ? col : P.panelEdge, 12);
      E.text(b.tier.toUpperCase(), x + 12, y + 14, { size: TY.small, align: 'left', color: on ? col : P.textDim });
      ctx.font = `${TY.strong} ${TY.mid}px system-ui, sans-serif`;
      const ns = clamp(Math.floor(TY.mid * (tw - 24) / ctx.measureText(b.name).width), TY.small, TY.mid); // a long name shrinks, never under the small size
      E.text(fitText(ctx, b.name, tw - 24, ns, TY.strong), x + 12, y + 34, { size: ns, weight: TY.strong, align: 'left', color: on ? P.text : P.textDim });
      if (on) drawStar(ctx, x + tw - 24, y + 14, 9, col); // on the tier row, clear of the name below
      wrapText(ctx, b.cond, tw - 24, TY.small).forEach((ln, k) => E.text(ln, x + 12, y + 56 + k * 18, { size: TY.small, align: 'left', color: P.textDim }));
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

// The gun stats card (v0.5 N), opened from the selected gun's tile: the numbers as bars against the six-gun maximum, its job, its mastery (tier, bar, the lifetime counters), the points and the rung
// count, and the skins picker with what opens each.
const STAT_ROWS = [
  ['Damage', (g) => g.damage * (g.pellets || 1), (g) => `${g.damage}${g.pellets > 1 ? ` x${g.pellets}` : ''}`],
  ['Fire rate', (g) => g.fireRate, (g) => `${g.fireRate}/s`],
  ['Range', (g) => g.accuracy, (g) => `${Math.round(g.accuracy * 100)}%`],
  ['Kick', (g) => g.kickPerShot, (g) => `${g.kickPerShot}°`],
  ['Recovery', (g) => g.kickRecovery, (g) => `${g.kickRecovery}°/s`],
  ['Magazine', (g) => g.magSize, (g) => `${g.magSize}`],
  ['Reload', (g) => g.reloadSeconds, (g) => `${g.reloadSeconds} s${g.shell ? ' shells' : ''}`],
];
const gunCard = {
  enter(E, params) {
    this.id = (params && params.id) || 'pistol'; this.chips = []; this.back = null; this.use = null;
    const m = E.save.get('skinsNew', {});
    if (m && m[this.id]) E.save.update('skinsNew', (o) => { const c = { ...o }; delete c[this.id]; return c; }, {}); // looking at the card is looking at the new skin
  },
  render(ctx, E) {
    const id = this.id, g = T.guns[id], land = E.w >= E.h * 1.2, side = 16 + Math.max(E.safe.left, E.safe.right), W = Math.min(E.w - 2 * side, land ? 780 : 560), x0 = (E.w - W) / 2;
    const open = gunUnlocked(E, id), worn = skinId(E, id), top = E.safe.top, bd = unlockBadge(id), done = rungsDone(E, id), m = masteryOf(E, id), info = masteryInfo(m);
    this.back = btn(E, 'Back', x0 + 42, top + 30, { w: 84, h: 44, size: TY.small, fill: P.slate });
    E.text(g.name, E.w / 2, top + 30, { size: TY.mid + 2, weight: TY.strong, color: P.text });
    this.use = null;
    if (open && gunId(E) !== id) this.use = btn(E, 'Use', x0 + W - 42, top + 30, { w: 84, h: 44, size: TY.small, fill: P.orange, color: P.ink });
    else if (!open) this.use = btn(E, 'Locked', x0 + W - 42, top + 30, { w: 84, h: 44, size: TY.small, fill: P.panelHi, color: P.textDim });
    const lw = land ? 236 : W, y0 = top + 62, ph = land ? 76 : 92;
    plate(E, x0, y0, lw, ph, P.panel, P.panelEdge, 12);
    ctx.globalAlpha = open ? 1 : 0.3; drawGunTile(ctx, id, x0 + lw / 2, y0 + ph / 2, lw - 32, ph - 22, worn); ctx.globalAlpha = 1;
    if (!open) drawLock(ctx, x0 + lw / 2, y0 + ph / 2, P.textDim);
    let y = y0 + ph + 16;
    const lines = wrapText(ctx, g.job, lw - 8, TY.small);
    lines.forEach((ln, k) => E.text(ln, x0 + 4, y + k * 18, { size: TY.small, align: 'left', color: P.textDim }));
    y += lines.length * 18;
    if (!open) { E.text(`Opens with the ${bd.name} badge`, x0 + 4, y, { size: TY.small, weight: TY.strong, align: 'left', color: P.orange }); y += 18; }
    // mastery: the tier, the bar toward the next, the lifetime counters
    y += 12;
    E.text(TIER_NAMES[info.tier], x0 + 4, y, { size: TY.mid, weight: TY.strong, align: 'left', color: info.tier === 3 ? P.brass : info.tier ? P.cyan : P.textDim });
    E.text(info.next === null ? `${info.score}` : `${info.score} / ${info.next}`, x0 + lw - 4, y, { size: TY.small, weight: TY.strong, align: 'right', color: P.text });
    drawMasteryBar(E, x0 + 4, y + 14, lw - 8, info);
    y += 34;
    const pct = Math.round(info.acc * 100);
    [`Shots ${m.shots}   Hits ${m.hits}`, `Accuracy ${pct}%   Plates ${m.plates}`, `Bullseyes ${m.bulls}   Headshots ${m.heads}`].forEach((ln, k) => E.text(ln, x0 + 4, y + k * 18, { size: TY.small, align: 'left', color: P.text }));
    y += 3 * 18;
    if (info.accShort) { E.text(`Master needs ${Math.round(T.mastery.accuracy * 100)}% accuracy`, x0 + 4, y, { size: TY.small, weight: TY.strong, align: 'left', color: P.orange }); y += 18; }
    // the numbers as bars, against the six-gun maximum
    const bx = land ? x0 + lw + 20 : x0, bw = land ? W - lw - 20 : W, by = land ? y0 : y + 12, rowH = land ? 22 : 26;
    STAT_ROWS.forEach(([label, val, txt], i) => {
      const max = Math.max(...GUN_IDS.map((k) => val(T.guns[k]))), yy = by + i * rowH + 11, tx = bx + 84, tw = bw - 84 - 64;
      E.text(label, bx + 4, yy, { size: TY.small, align: 'left', color: P.text });
      E.roundRect(tx, yy - 4, tw, 8, 4, P.panelEdge); E.roundRect(tx, yy - 4, Math.max(8, tw * val(g) / max), 8, 4, P.cyan);
      E.text(txt(g), bx + bw - 4, yy, { size: TY.small, weight: TY.strong, align: 'right', color: P.text });
    });
    const ry = by + STAT_ROWS.length * rowH + 8;
    E.text(`Points ${pointsTotal(E)}   ·   ${done} of ${CHALLENGES.length} rungs at two stars`, bx + 4, ry + 6, { size: TY.small, weight: TY.strong, align: 'left', color: P.cyan });
    // the skins picker: every skin of the gun with what opens it, the worn one ringed
    const sy = ry + 24, list = A.skins[id], cols = 2, cw = bw / cols;
    this.chips = list.map((skin, i) => {
      const cx = bx + (i % cols) * cw, cy = sy + Math.floor(i / cols) * 50, r = { x: cx, y: cy, w: 44, h: 44, skin }, have = skinOpen(E, id, skin), need = skin.tier ? TIER_NAMES[skin.tier] : skin.badge ? BADGES.find((k) => k.id === skin.badge).name : 'Default';
      drawChip(ctx, E, r, skin, open && skin.id === worn, have);
      E.text(fitText(ctx, skin.name, cw - 56, TY.small, TY.strong), cx + 52, cy + 12, { size: TY.small, weight: TY.strong, align: 'left', color: have ? P.text : P.textDim });
      E.text(fitText(ctx, need, cw - 56, TY.small, TY.normal), cx + 52, cy + 32, { size: TY.small, align: 'left', color: P.textDim });
      return r;
    });
  },
  onTap(p, E) {
    const id = this.id, g = T.guns[id];
    if (E.hit(this.back, p)) { E.audio.play('tap'); E.setScene('menu'); return; }
    if (this.use && E.hit(this.use, p)) { if (gunUnlocked(E, id) && gunId(E) !== id) { pickGun(E, id); E.audio.play('tap'); } else E.audio.play('tap', 0.3); return; }
    for (const c of this.chips) if (E.hit(c, p)) {
      if (!gunUnlocked(E, id)) { E.audio.play('tap', 0.3); E.toast(`The ${g.short} opens with the ${unlockBadge(id).name} badge`); }
      else if (skinOpen(E, id, c.skin)) { wearSkin(E, id, c.skin); E.audio.play('tap'); }
      else { E.audio.play('tap', 0.3); E.toast(`${c.skin.name}: ${skinNeed(id, c.skin)}`); }
      return;
    }
  },
};

const play = {
  enter(E, params) {
    const ch = (params && chById(params.id)) || CHALLENGES[0];
    newRun(ch.endless ? { ...ch, seed: E.dailySeed() } : ch, gunId(E), params && params.gauntlet, skinId(E, gunId(E))); // the endless mode plays the day's seed
    this.menuBtn = null; this.reloadBtn = null; S.restarted = false;
  },

  update(dt, E) {
    if (S.restarted) { S.restarted = false; E.toast('Run restarted'); }
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
      if (!S.slowed && (l === 'speed' || l === 'skeet' || (l === 'zombie' && r.cleared)) && r.steps * STEP - S.killAt < 0.1) { S.slowed = true; S.slow = T.slowLife; }
      if (!S.swept && r.misses === 0 && r.hits >= 3 && !r.breach) { S.swept = true; S.fx.push({ k: 'callout', x: T.designW / 2, y: 130, text: 'Clean sweep', t: T.calloutLife * 1.4, max: T.calloutLife * 1.4, big: true }); }
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
    if (ch.ladder === 'zombie') {
      drawFence(ctx, r);
      for (const f of S.fx) if (f.k === 'corpse') drawCorpse(ctx, f);
      for (const z of r.zs) drawZombie(ctx, z, now);
    }
    for (const f of S.fx) if (f.k === 'ghost') { // the card where a dodger was, fading
      const half = (T.zoneR[2] + A.card.pad) * f.sc;
      ctx.globalAlpha = A.dodge.ghostAlpha * (f.t / f.max); drawSprite(ctx, K_CARD + Math.round(f.sc * 100), half + 6, paintCard, f.x, f.y, f.sc, false); ctx.globalAlpha = 1;
    }
    for (const tg of r.targets) {
      if (tg.kind === 'zpart') continue; // a zombie is drawn whole, above
      let alpha = 1, at = tg;
      if (tg.kind === 'part' && !ch.wall && tg.idx !== r.stage) alpha = 0.5;
      if (tg.card && tg.life < 0) alpha = 1 + tg.life / T.expiryGrace; // the grace: the card fades out and is still there to hit
      if (tg.kind === 'dodge') for (const f of S.fx) if (f.k === 'slide' && f.x === tg.x && f.y1 === tg.y) at = { ...tg, y: f.y0 + (f.y1 - f.y0) * ease.outQuad(1 - f.t / f.max) }; // the jump is drawn as a short slide
      drawTargetFull(ctx, E, at, r, ch, alpha);
    }
    for (const tg of r.targets) {
      if (tg.kind === 'part' && ch.wall && !partActive(r, tg)) continue; // a closed frame shows no hit points
      drawTargetHp(ctx, tg, tg.kind === 'part' && !ch.wall && tg.idx !== r.stage ? 0.5 : tg.kind === 'core' && coreShielded(r) ? A.plate.shut : 1);
    }
    const ff = S.fx.find((f) => f.k === 'finder');
    drawRangeFinder(ctx, r, ff ? ff.t / ff.max : 0);
    for (const f of S.fx) if (f.k === 'tracer') drawTracer(ctx, f);
    for (const f of S.fx) if (f.k === 'pop') drawHitRing(ctx, f);
    drawReloadRing(ctx, r, now);
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
    const intro = ch.wall ? 'Every plate scores' : ch.behaviour === 'dodge' ? 'Fire near it and it jumps. Shoot again where it lands.' : null;
    if (intro && now < A.intro.hold + A.intro.fade) { // the one-line intro: the Bunker's optional plates score; a dodger jumps when a shot passes near it
      const a = clamp((A.intro.hold + A.intro.fade - now) / A.intro.fade, 0, 1);
      wrapText(ctx, intro, v.w - 24, TY.small).forEach((ln, i) => E.text(ln, v.ox + (T.designW / 2) * v.s, v.oy + A.intro.y * v.s + i * 18, { size: TY.small, weight: TY.strong, color: P.text, alpha: a })); // a narrow field wraps it
    }
    for (const f of S.fx) if (f.k === 'callout') {
      const k = 1 - f.t / f.max, big = f.big ? 1.35 : 1, x = clamp(v.ox + f.x * v.s, v.ox + 70, v.ox + v.w - 70);
      popText(E, f.text, x, v.oy + (f.y - 26 * k) * v.s, f.color || P.cyan, Math.min(1, 3 * (1 - k)), f.size || TY.mid * big + 4);
    }
    this.hud(E, v, r, ch);
    this.reloadUI(E, v, r, now);
    if (E.h > E.w) { // portrait: playable, but say what it wants, in the letterbox below the field
      const below = v.oy + v.h + 58 + 34 <= E.h - E.safe.bottom;
      const by = (below ? v.oy + v.h + 58 : E.h - E.safe.bottom - 38) + 17;
      plate(E, v.ox + 12, by - 17, v.w - 24, 34, P.panel, P.orange);
      E.text('Rotate your phone', v.ox + v.w / 2, by, { size: TY.mid, weight: TY.strong, color: P.text });
    }
  },

  // The Reload button (rounds in the magazine, or the reload's progress) and the cue on the gun.
  reloadUI(E, v, r, now) {
    const g = r.gun, rb = this.reloadBtn = reloadRect(E, v), cx = rb.x + rb.w / 2, low = r.mag <= Math.ceil(g.magSize * 0.25), full = r.mag >= g.magSize && !r.reloading;
    plate(E, rb.x, rb.y, rb.w, rb.h, P.panelHi, r.reloading ? P.cyan : low ? P.orange : P.ink);
    if (r.reloading) E.roundRect(rb.x + 8, rb.y + rb.h - 8, (rb.w - 16) * reloadFrac(r, now), 3, 1.5, P.cyan);
    E.text(r.reloading ? 'Reloading' : 'Reload', cx, rb.y + 13, { size: TY.small, weight: TY.strong, color: full ? P.textDim : P.text });
    E.text(`${r.mag}/${g.magSize}`, cx, rb.y + 27, { size: TY.small, color: low && !r.reloading ? P.orange : P.textDim });
    if (r.reloading) { // the text cue on the gun; it turns orange for a moment when a tap was dropped
      const nope = E.time - S.nope < 0.25;
      E.text(g.shell ? `Loading ${r.mag}/${g.magSize}` : 'Reloading', v.ox + T.gunX * v.s, v.oy + Math.min(T.designH - 14, r.gunY + 50) * v.s, { size: TY.small, weight: TY.strong, color: nope ? P.orange : P.cyan });
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
    const run = S.run;
    if (this.reloadBtn && E.hit(this.reloadBtn, p) && run.mag < run.gun.magSize && !run.reloading) { queueInput(run, stamp(run), 'reload'); return; } // the button reloads; with a full magazine or a reload under way it is just a fire tap
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
    if (this.menuBtn && E.hit(this.menuBtn, p)) { quitRun(E, 'quit'); E.setScene('menu'); }
  },
  onKey(key, E) {
    if (key === 'Escape') { quitRun(E, 'quit'); E.setScene('menu'); }
    else if (key === ' ') queueInput(S.run, stamp(S.run), 'fire'); // key repeat fires at the gun's rate
    else if (key === 'r' || key === 'R') queueInput(S.run, stamp(S.run), 'reload');
  },
  onPause() { newRun(S.ch, S.gunId, S.gauntlet === null ? undefined : S.gauntlet, S.skin); S.restarted = true; }, // closing the app mid-challenge restarts it, and the toast says so on return
};

const over = {
  enter(E, params) {
    this.p = params; this.ch = chById(params.id); this.t0 = E.time; this.tick = -1;
    const g = params.gaunt;
    if (g) { this.next = g.next ? CHALLENGES.find((c) => c.id === g.next) : null; this.canNext = !!this.next; }
    else {
      this.next = this.ch.endless ? null : CHALLENGES.find((c) => c.ladder === this.ch.ladder && c.level === this.ch.level + 1);
      this.canNext = !!this.next && params.bestStars >= T.unlockStars;
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
      if (ws.id !== 'std') E.text(ws.name, tx, y0 + 74, { size: TY.small, color: P.textDim });
    }
    const age = E.time - this.t0;
    for (let i = 0; i < 3 && !ch.endless; i++) {
      const sx = cx + (i - 1) * 60, sy = y0 + 94;
      if (i < p.stars) {
        const k = ease.outBack(clamp((age - i * 0.2) / 0.3, 0, 1));
        if (k > 0) drawStar(ctx, sx, sy, 22 * k, P.brass);
      } else drawStar(ctx, sx, sy, 22, null, P.panelEdge);
    }
    const of = ch.ladder === 'accuracy' ? ` of ${ch.accTargets}` : '';
    if (ch.ladder === 'zombie') E.text(ch.endless ? `Wave ${p.zwave}   Down ${p.zdown}   Brain shots ${p.bulls}` : `Down ${p.zdown} of ${p.ztotal}   Brain shots ${p.bulls}`, cx, y0 + (ch.endless ? 104 : 134), { size: TY.mid, weight: ch.endless ? TY.strong : TY.normal, color: P.text });
    else E.text(`Hits ${p.hits}${of}   Bullseyes ${p.bulls}`, cx, y0 + 134, { size: TY.mid, color: P.text });
    if (ch.endless) {
      E.text(`${p.isNew ? 'New best' : 'Best'} ${p.best}  ·  wave ${p.bestWave}`, cx, y0 + 140, { size: TY.mid, weight: p.isNew ? TY.strong : TY.normal, color: p.isNew ? P.orange : P.textDim });
      E.text(`Today ${p.day.best}${p.day.isNew ? ' (new)' : ''}  ·  the same waves all day`, cx, y0 + 164, { size: TY.small, color: P.textDim });
    } else {
      E.text(`${p.isNew ? 'New best' : 'Best'} ${p.best}  ·  ${p.bestStars} ${p.bestStars === 1 ? 'star' : 'stars'} saved`, cx, y0 + 156, { size: TY.mid, weight: p.isNew ? TY.strong : TY.normal, color: p.isNew ? P.orange : P.textDim });
      E.text(`Stars at ${p.thr.one} / ${p.thr.two} / ${p.thr.three}  ·  ${p.preset}`, cx, y0 + 178, { size: TY.small, color: P.textDim });
    }
    // Optional lines stack under the thresholds (a cursor, not fixed rows): the Bunker's plates, the badge, its skin, a gauntlet note. The buttons start at y0 + 256;
    // with all four the last line ends at y0 + 247.
    let yy = y0 + 178;
    if (ch.wall) {
      yy += 20;
      E.text(p.platesLeft ? `${p.platesLeft} plates left, worth up to ${p.platesValue} more` : 'Every plate scores', cx, yy, { size: TY.small, color: p.platesLeft ? P.cyan : P.textDim });
    }
    if (ch.ladder === 'zombie') { // which one reached the fence, and how far the waves got
      yy += 20;
      const b = p.breach;
      E.text(b ? `A ${ZTYPES[b.cls].name.toLowerCase()}${b.legs && !ZTYPES[b.cls].ground ? ' on its hands' : ''} reached the fence: zombie ${b.n} of wave ${b.wave}${p.zwaves ? ' of ' + p.zwaves : ''}` : 'The fence held', cx, yy, { size: TY.small, weight: TY.strong, color: b ? P.red : P.cyan });
    }
    if (p.badges.length) { // a badge pop: the line pops in by transform, from popFrom of its size (never under the small text size), fading up
      yy += 22;
      const t = clamp((age - 0.5) / 0.35, 0, 1), k = ease.outBack(t), names = p.badges.map((id) => BADGES.find((b) => b.id === id).name).join(', ');
      const col = P.tier[BADGES.find((b) => b.id === p.badges[0]).tier], from = TY.small / TY.mid, sc = from + (1 - from) * k, msg = `Badge earned: ${names}`;
      if (t > 0) {
        ctx.save(); ctx.translate(cx + 12, yy); ctx.scale(sc, sc);
        ctx.font = `${TY.strong} ${TY.mid}px system-ui, sans-serif`; // the engine's text font, set here to measure the line the ticket goes behind
        const mw = ctx.measureText(msg).width;
        ctx.globalAlpha = t;
        if (p.badges.some((id) => BADGES.find((b) => b.id === id).tier === 'Trick')) drawTicket(ctx, 0, 0, mw + 68, 28, col); // a delighter pops a ticket behind its line
        E.text(msg, 0, 0, { size: TY.mid, weight: TY.strong, color: col, alpha: t }); ctx.globalAlpha = t;
        drawStar(ctx, -mw / 2 - 16, 0, 11, col);
        ctx.restore();
      }
    } else if (g && !g.ok) E.text('Gauntlet over: two stars needed', cx, yy += 22, { size: TY.mid, color: P.red });
    else if (g && g.done) E.text('Gauntlet complete', cx, yy += 22, { size: TY.mid, color: P.cyan });
    else if (g) E.text('Gauntlet stage passed', cx, yy += 22, { size: TY.mid, color: P.cyan });
    if (p.tierUp || (p.skins && p.skins.length)) { // mastery (v0.5 N): a tier reached, and the skin it opens
      yy += 22;
      const a = clamp((age - 0.7) / 0.35, 0, 1), sk = p.skins && p.skins.length ? `${p.skins.join(', ')} unlocked` : '';
      E.text(p.tierUp ? `${p.tierUp.gun} is now ${p.tierUp.name}${sk ? ': ' + sk : ''}` : `Skin unlocked: ${sk}`, cx, yy, { size: TY.small, weight: TY.strong, color: P.cyan, alpha: a });
    }
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
    if (b.act === 'again') { const g = this.p.gaunt; E.ledger.add('retry', { id: this.ch.id, gun: this.p.gunId, score: this.p.score, stars: this.p.stars }); E.setScene('play', g && g.ok && !g.done ? { id: this.ch.id, gauntlet: g.i } : { id: this.ch.id }); } // a passed stage replayed stays in the chain
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

// v7 (PRD v0.5 K): every old best { score, stars } becomes the pistol's entry, except Boss 1 where `bossGuns` names the guns that three-starred it (each gets the entry) and
// Boss 2 when the Sniper badge says the rifle did it. Nothing is lost: stars and badges are kept, and a gun the old points table had opened (60, 150, 300 points of the old
// stars) is kept in gunsHad, since guns now open by badge and not everyone who had one has the badge.
const OLD_UNLOCK_POINTS = { carbine: 60, shotgun: 150, rifle: 300 };
function migrateGuns(data) {
  const old = data.best && typeof data.best === 'object' ? data.best : {}, out = {}, named = data.bossGuns && typeof data.bossGuns === 'object' ? Object.keys(data.bossGuns).filter((g) => T.guns[g]) : [];
  let points = 0;
  for (const [cid, e] of Object.entries(old)) {
    if (!e || typeof e !== 'object') continue;
    if (typeof e.score !== 'number') { out[cid] = e; continue; } // already per gun
    points += T.starPoints[e.stars || 0] || 0;
    const guns = cid === 'b1' && named.length ? named : cid === 'b2' && data.badges.sniper ? ['rifle'] : ['pistol'];
    out[cid] = Object.fromEntries(guns.map((g) => [g, { score: e.score, stars: e.stars || 0, accuracy: 0 }]));
  }
  data.best = out;
  const had = data.gunsHad && typeof data.gunsHad === 'object' ? data.gunsHad : {};
  for (const [g, need] of Object.entries(OLD_UNLOCK_POINTS)) if (points >= need) had[g] = 1;
  data.gunsHad = had;
}

export const game = {
  slug: 'recoil',
  title: 'Recoil',
  saveVersion: 10,
  // Save shape: best { challengeId: { gunId: { score, stars, accuracy } } }, gun (id), skins { gunId: skinId }, badges { badgeId: 1 }, gunsHad { gunId: 1 } (guns a save from
  // before v7 already had), cold (Cold Barrel's runs in a row), zend (the endless mode's bests), mastery { gunId: { shots, hits, bulls, heads, plates } } and skinsHad { gunId: { skinId: 1 } } and skinsNew { gunId: [skinId] } (v10), starPreset (the star-bar preset's name), __tune, __muted.
  // v2 added the chosen gun; v3 pruned saved tune values (ADR-0014); v4 adds badges and bossGuns and awards the star-only badges
  // that the existing bests already earn; v5 adds the worn skin per gun (a skin whose badge is not earned plays as the default); v6 adds the star-bar preset's name. Nothing else changes, and the whole save stays under a kilobyte or two.
  migrate(data, fromVersion) {
    if (typeof data.best !== 'object' || data.best === null) delete data.best;
    if (!data.gun) data.gun = 'pistol';
    if (!data.badges || typeof data.badges !== 'object') data.badges = {};
    if (!data.skins || typeof data.skins !== 'object') data.skins = {};
    if (typeof data.starPreset !== 'string') data.starPreset = 'Skilled';
    if (typeof data.cold !== 'number') data.cold = 0;
    if (data.zend !== undefined && (typeof data.zend !== 'object' || data.zend === null)) delete data.zend; // v9: the endless mode's bests, { day, today: { score, wave }, best: { score, wave, gun } }
    if (fromVersion < 4) { // the star-only badges the bests of that time already earned
      const b = data.best || {}, three = (id) => b[id] && b[id].stars === 3;
      for (const [badge, id] of [['marksman1', 'a1'], ['quickdraw1', 's1'], ['clay1', 'k1'], ['storm', 's4']]) if (three(id)) data.badges[badge] = 1;
      if (CHALLENGES.every((c) => three(c.id))) data.badges.legend = 1;
    }
    if (fromVersion < 7) migrateGuns(data);
    if (fromVersion < 10) { // v10: skins open by gun mastery; a skin the ladder badges opened stays open (so every skin a save wore stays worn). The counters come from the ledger at start (init), which migrate never sees.
      const had = data.skinsHad && typeof data.skinsHad === 'object' ? data.skinsHad : {};
      for (const [gun, map] of Object.entries(OLD_SKIN_BADGES)) for (const [skin, badge] of Object.entries(map)) if (data.badges[badge]) (had[gun] || (had[gun] = {}))[skin] = 1;
      data.skinsHad = had;
    }
    if (data.mastery !== undefined && (typeof data.mastery !== 'object' || data.mastery === null)) delete data.mastery;
    delete data.bossGuns;
    if (data.__tune && typeof data.__tune === 'object') data.__tune = Object.fromEntries(Object.entries(data.__tune).filter(([k]) => TUNE_KEYS.has(k)));
    return data;
  },
  TUNING,
  init(E) {
    buildArt(); prepMenu(E.dpr, E.ctx); warmText(E.ctx);
    if (!E.save.get('mastery', null)) E.save.set('mastery', deriveMastery(E)); // a save from before v10: the counters the ledger still has, else zero
  }, // the art and the menu's sprites are built before the first frame
  experiments: EXPERIMENTS,
  presets: PRESETS,
  start: 'menu',
  scenes: { menu, play, over, missions, tune, gun: gunCard },
};
