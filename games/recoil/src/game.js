// Recoil, v0.9 (the career story, "The Last Picture at Backlot 88", on top of v0.8): the mechanic plus six guns as movie props (Buddy-Cop 9mm, Pulse Rifle, Spin-Lever Shotgun, Assassin's Scope, One-Man Army SMG, Make-My-Day .44), barrel sway, moving targets, skeet with decoys, two bosses, zombies,
// and progression (guns bought in the Prop Room with box office, the .44 by a badge, twenty-three badges, skins, a montage). One thumb drags the gun up and down, the other fires, and every shot kicks the barrel up.
// Instant shot lines scored by zone, a combo multiplier, five ladders (Accuracy and Speed have five rungs, Skeet three, Boss two, Zombies three) and an endless zombie mode,
// stars per gun from noisy-bot bars, points, a menu that is a prop rack, and a wrap card. Procedural art (movie-prop guns, cut-outs, saucers, monsters, zombie extras, one soundstage set per mode)
// from one palette in TUNING.art; no image assets. Landscape, two thumbs (ADR-0013).

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
  tough: { share: 0.9, over: 0.1 }, // v0.8 D: a rung tile says "tough with this gun" when a gun's two-star bar is at least `share` of its perfect run and `over` above the pistol's share
  starRound: 10,         // Bars are rounded to this
  starFallback: { gap: 0.15, shares: [0.30, 0.55, 0.85] }, // v0.5 O: when a gun's three-star bar minus its one-star bar is under `gap` of its perfect run the bars measure no aim, so they become these shares of the perfect run
  slowLife: 0.4,         // Seconds of real time the last kill of a Speed or Skeet run plays in slow motion
  slowScale: 0.25,       // Game speed during it
  tickerLife: 0.9,       // Seconds the card takes to count the score up
  calloutLife: 1.0,      // Seconds a streak call-out stays on the field
  kickWindow: 0.5,       // v0.5 J and O, Kickback: kickCount hits in a row within this many seconds (only the SMG's gaps are short enough: its five are 0.36 s), on at least kickTargets distinct targets
  kickCount: 6,
  kickTargets: 2,        // the recoil walking the aim: a held gun on one target does not earn it
  coldRuns: 5,           // v0.5 J, Cold Barrel: runs in a row that open on a bullseye

  // v0.5 sections G and L: zombies. A zombie is up to three parts (circles, in units at scale 1, centre `cy` above the feet): legs, body, brain. Legs down: it crawls at `crawl` of its
  // speed and its body drops; body down: it slows to `hunch`; the brain ends it. A zombie whose front (arms, `reach`) touches the fence ends the run. The five types are
  // data (`types`): speed as a share of `base`, size (a multiplier on every radius and height), part hit points, and where the head sits, so no two heads sit at the same height
  // (Shambler 74, Crawler 28, Hunched 48 under its shield, Brute 181, and the Runner's 74 bobbing by `bob`).
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
      b: { name: 'Brute', speed: 0.8, size: 2.45, legs: { hp: 3, r: 17 }, body: { hp: 5, r: 15 }, brain: { hp: 1, r: 3.9 } }, // v0.5 O and P: tall enough that its head stands at the top of the field band, and no taller than the HUD (the near-lane head's top is at y 52, under the Menu button's bottom edge at 48)
      h: { name: 'Hunched', speed: 0.9, size: 1, shield: true, legs: { hp: 2, r: 17 }, body: { hp: 3, r: 18 }, brain: { hp: 1, r: 8 } },
    },
    points: { hit: 5, legs: 30, body: 50, brain: 75, bonus: 125 }, // per hit, per part destroyed, and the bonus for the brain that ends it; the multiplier applies to all
    waveGap: 1.5,        // seconds between the last zombie of a wave going down and the next wave entering
    // Where each part sits, [dx toward the fence (negative), height above the feet] in units at scale 1 and size 1 (every offset scales with the type's size): standing, on its hands (legs down; the head is forward of the
    // body and 14 up, clearing the top half of the body circle so legs, then body, then brain is a real order), with the body gone (legs left) and the head alone. `shield` is the Hunched zombie's set: it stoops over its head.
    pose: {
      stand: { legs: [0, 17], body: [0, 50], brain: [0, 74] }, crawl: { body: [0, 14], brain: [-17, 28] }, hunch: { brain: [-6, 58] }, drag: { brain: [-16, 8] },
      shield: { stand: { body: [0, 44], brain: [7, 48] }, crawl: { brain: [3, 20] }, hunch: { brain: [-6, 42] } },
    },
    outerShare: 0.25,    // v0.5 P (0.5 in the PRD; the orchestrator moved it to 0.25 because 0.5 left the shotgun's Speed 4 aim-free): a horde member or a zombie part hit only by an outer pellet scores this share of its points (the centre pellet's hit scores in full); damage is unchanged
    hitFlash: 0.14,      // seconds a part shows it was hit
    endless: { speedStep: 0.04, speedCap: 2.5, hpEvery: 3, mixFrom: 2, mixEvery: 2, sizeFrom: 2, sizeEvery: 2, sizeCap: 6, forceFrom: 24, forceMin: 9 }, // each wave raises speed by speedStep; every hpEvery waves every part gains 1 hp; the mix opens a type every mixEvery waves; a wave holds sizeFrom zombies and one more every sizeEvery waves up to sizeCap; the next wave is forced forceFrom seconds after one enters, one second sooner per wave, but never under forceMin
  },

  // v0.5 N: gun mastery. A gun's mastery is its lifetime bullseyes plus headshots; Marksman at `marksman`, Expert at `expert`, Master at `master` and a lifetime accuracy of at least
  // `accuracy` (hits over shots). The second skin of a gun opens at Marksman and the third at Master (a skin's `tier`).
  mastery: { marksman: 100, expert: 500, master: 1500, accuracy: 0.6 },

  // Guns (v0.2 section A): data, so a later layer adds more. kickPerShot and kickRecovery are per gun now.
  // v0.5 M: magSize rounds fire before a reload of reloadSeconds (the shotgun loads shell by shell, reloadSeconds / magSize each, and a fire tap interrupts it). Accuracy keeps its own round count on top, and v0.8 A scales it per gun by `accAmmo` (an automatic gun spends rounds in bursts).
  guns: {
    pistol: { id: 'pistol', job: 'The all-rounder: clean bullseyes and long combos.', name: 'Buddy-Cop 9mm', short: 'Buddy-Cop', damage: 1, fireRate: 9, accuracy: 1.0, kickPerShot: 8, kickRecovery: 32, magSize: 12, reloadSeconds: 1.0, accAmmo: 1, auto: false },
    carbine: { id: 'carbine', job: 'Hold to fire: fast targets, hordes and clays.', name: 'Pulse Rifle', short: 'Pulse Rifle', damage: 1, fireRate: 8, accuracy: 0.55, kickPerShot: 5, kickRecovery: 24, magSize: 30, reloadSeconds: 1.6, accAmmo: 2.5, auto: true },
    // v0.3. `pellets` lines leave the barrel in a fixed fan of shotSpread degrees; each pellet deals `damage` on its own. Only the centre
    // pellet scores zone points on ring targets; on hordes every member any pellet hits scores.
    shotgun: { id: 'shotgun', job: 'Five pellets: boss plates and hordes; hopeless at far bullseyes.', name: 'Spin-Lever Shotgun', short: 'Spin-Lever', damage: 1, pellets: 5, fireRate: 2.3, accuracy: 0.4, kickPerShot: 14, kickRecovery: 30, magSize: 6, reloadSeconds: 2.2, shell: true, accAmmo: 1, auto: false },
    rifle: { id: 'rifle', job: 'One-shots plates; long waits and sway matter most.', name: "Assassin's Scope", short: 'Scope', damage: 3, fireRate: 1.5, accuracy: 1.0, kickPerShot: 16, kickRecovery: 20, magSize: 5, reloadSeconds: 1.8, accAmmo: 1, auto: false },
    // v0.5 section H. Both fire faster than the barrel settles, so a held SMG and a quick revolver climb off the target: the interval is under the recovery time on both.
    smg: { id: 'smg', job: 'Hold to spray: the fastest fire, and the hardest climb to hold.', name: 'One-Man Army SMG', short: 'One-Man Army', damage: 1, fireRate: 14, accuracy: 0.5, kickPerShot: 6, kickRecovery: 40, magSize: 24, reloadSeconds: 1.4, accAmmo: 2.5, auto: true },
    revolver: { id: 'revolver', job: 'Six heavy shots: one-shots plates and brains, then waits for the barrel.', name: 'Make-My-Day .44', short: 'Make-My-Day', damage: 3, fireRate: 1.2, accuracy: 1.0, kickPerShot: 20, kickRecovery: 18, magSize: 6, reloadSeconds: 2.4, accAmmo: 1, auto: false },
  },
  shotSpread: 10,        // v0.3: total fan angle of the shotgun's five pellets, degrees
  unlockBadges: { revolver: 'gauntlet' }, // v0.6 B: the guns a badge opens (the .44 by the Blockbuster badge a good player earns first); the pistol is free and the rest are bought (gunPrices)
  // v0.6 B, the Prop Room: box office is dollars. A run pays boxPerPoint per point it scored and boxPerStar per star it earned; a new save starts with boxStart, and a save from before
  // v0.6 is credited boxPerStar for every star it already had. Prices rise in the order the PRD lists the guns.
  boxPerPoint: 0.02,
  boxPerStar: 40,
  boxStart: 100,
  gunPrices: { carbine: 250, shotgun: 600, rifle: 1000, smg: 1500 },
  // v0.7 (PRD v0.7 B, E, H): the player's career rank, from total stars across every gun and set (324 in all): rank names with the stars each needs; the Endless wave that releases its poster
  // (Endless has no stars); the seconds a story card ignores a tap that is not Skip; the rank card's clapperboard (when its stick starts to close, how long it takes) and a card's fade-in.
  career: { ranks: [['Extra', 0], ['Intern', 10], ['Stunt Double', 40], ['Action Star', 100]], endlessWave: 8, lock: 0.25, snapAt: 0.15, snap: 0.12, fade: 0.3 },
  // v0.9 (PRD v0.9 A, B): the story's animated scenes. Seconds each scene runs (a tap jumps to its end, and it goes on by itself `autoGap` seconds after), the Skip button, the story version the
  // cold open is shown for (a save that has seen a lower one sees it once) and the stars from which the director's note takes its second line.
  scenes: { lot: 3.4, extras: 3.6, gus: 3.4, intern: 4.6, turn: 5.4, ending: 6, autoGap: 1, skipW: 96, skipH: 48, version: 2, noteHigh: 2 },

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
      letterbox: '#0c0a10',  // Outside the field (the engine reads TUNING.bg, set from this)
      ink: '#1a1512',        // Outlines and dark details
      inkSoft: 'rgba(26,21,18,0.55)', // Thin printed lines on cards
      shadow: 'rgba(10,6,4,0.42)',
      highlight: 'rgba(255,246,232,0.36)', // The one soft highlight
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
      // Zombies (v0.6: extras in make-up): the make-up skin, the costume shirt and trousers (lighter than v0.5's, so every part measures at least 3:1 against the dark sets), a wound, the brain
      // (its bullseye ring is the goal's cyan), the squib's stage blood, and the fence's wood
      zSkin: '#8fae87', zSkinDark: '#5f7d5a', zShirt: '#6f7fa0', zPants: '#7a7390', zWound: '#8f2f2f', zBrain: '#e59ab0', zBlood: '#b3364f',
      zSkinR: '#a9bd8a', zShirtR: '#b0674c', zSkinC: '#7d9a78', zShirtC: '#8f7d5a', zSkinB: '#6f8f6a', zShirtB: '#85707a', zPantsB: '#7e7896', zSkinH: '#9db08d', zShirtH: '#7c818b', // the types: a lean pale Runner, a dirty Crawler, a dark Brute, a grey Hunched
      wood: '#7d6547', woodDark: '#4e3f2c', picket: '#b9b0a0', picketDark: '#7f786c',
      // v0.6 D, the studio: stage blacks, set paint, the prop wood and the two neon lights. Neon pink and teal light the sets only, never a target; no set paint uses a target's
      // colours (the goal's cyan, the paper and the cut-outs' kraft, the player's orange, the danger red), and the band behind the targets stays near black.
      stage: '#120f18', stageHi: '#1c1826', stageLow: '#0b0a0f', floor: '#19151f', floorLine: '#3b3447', truss: '#2b2634', lamp: '#4d4659',
      neonPink: '#ff4fa3', neonTeal: '#27b3a1', pinkGlow: 'rgba(255,79,163,0.18)', tealGlow: 'rgba(39,179,161,0.16)',
      kraft: '#cfae7c', kraftDark: '#9d7f54', villain: '#3a3446', villainBand: '#7a728c', cowboy: '#7b5236', cowboyBand: '#c9a15e', bandana: '#4f6fb0',
      city: '#1d1a2b', cityHi: '#26223a', cityWin: '#353047', cityLit: '#5a5070', moon: '#262236',
      facade: '#2a1d1b', facadeHi: '#3a2924', facadeWin: '#110c10', boardwalk: '#221815', mesa: '#1d1522', duskHi: '#1f1426',
      space: '#0c0b16', starDot: '#6a6488', planet: '#2d2140', planetHi: '#3b2b55', planetRing: '#4a3868', wire: '#9b95ad',
      kaiju: '#16211c', kaijuHi: '#1f2e27', zipper: '#56685e', robot: '#1b1c26', robotHi: '#272836', eyeDim: '#5a2a46',
      grave: '#221f2b', graveHi: '#2e2a39', tree: '#17141d', fog: 'rgba(150,144,172,0.05)', flood: 'rgba(214,226,236,0.045)',
      pegboard: '#2a221c', pegHole: '#15110e', counter: '#5a4632', counterTop: '#7a6147', register: '#15171c', brassText: '#f0c860',
      terrazzo: '#c98a9c', vhs: 'rgba(0,0,0,0.22)', vhsBand: 'rgba(255,255,255,0.025)',
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
        ['rr', 'ink', 12, -9, 17, 3, 1], ['rr', 'steelDark', -16, 29, 7, 5, 2], // the open-top slide and a lanyard ring
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
        ['rr', 'steelDark', 20, -14, 26, 5, 2], ['rr', 'steelDark', 40, 6, 12, 7, 2.5], // the shroud's top and the pump launcher under the barrel
        ['rr', 'orange', 47, -5, 5, 10, 2],
        ['rr', 'ink', 4, -6, 13, 8, 1.5], ['rr', 'highlight', 6, -4.5, 3.6, 5, 0.6], ['rr', 'highlight', 11, -4.5, 3.6, 5, 0.6], // the round counter
        ['rr', 'ink', -2, -8, 5, 2, 0.8],
        ['rr', 'highlight', -14, -10, 34, 2.6, 1.3],
      ] },
      shotgun: { muzzle: 62, port: [-8, -10], shell: [8, 3.6], parts: [
        ['rr', 'steelDark', -12, 4, 24, 26, 11], ['rr', 'ink', -8, 9, 16, 16, 7], // the spin lever's big loop
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
        ['rr', 'ink', 25, -7.5, 1.4, 3.5, 0.6], ['rr', 'ink', 31, -7.5, 1.4, 3.5, 0.6], ['rr', 'ink', 37, -7.5, 1.4, 3.5, 0.6], ['rr', 'ink', 43, -7.5, 1.4, 3.5, 0.6], // the vented rib
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
        ['rr', 'steel', -19, -25, 7, 13, 3], ['rr', 'steel', 24, -26, 10, 15, 3], ['rr', 'steelDark', 33, -25, 9, 13, 2], ['rr', 'highlight', 39.5, -23, 1.6, 9, 0.8], // the sunshade and a lens glint
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
    dodge: { ghostLife: 0.25, ghostAlpha: 0.5, slide: 0.1, ringGap: 5, ringWidth: 2.5, dash: [7, 5], coolAlpha: 0.75, beep: 520, pulse: 6, pulseGrow: 2.5 }, // v0.5 B: a dodge leaves a fading ghost card and slides the target over `slide`; the armed ring
    ring: { life: 0.3, r0: 8, r1: 30, width: 3 }, // Hit ring that opens at the target as the score pop rises (inside the pop's own life)
    popLine: 5,            // Outline width of the score pop
    card: { pad: 3, radius: 0.6, ringLine: 1, timerK: 1.17, timerGap: 4, timerWidth: 3, post: 4, foot: 13, warn: 1, warnFlip: 0.3, pulse: 8 }, // Paper target: pad beyond the outer ring (an Accuracy card scores out to it), corner as a fraction of the half size; the timer ring goes orange and pulses in the last `warn` seconds (the last `warnFlip` of a flip window)
    trolley: { w: 0.8, h: 4, wheel: 2.6, tie: 24, tieLen: 2.5, tieW: 5, rail: 2, railAlpha: 0.55 },
    clay: { disc: 0.74, rimLine: 1.2, cross: 0.5 }, // cross: the decoy's mark, as a fraction of its radius
    flip: { time: 0.25, min: 0.08 }, // A flip target turns edge-on over its last `time` seconds (never thinner than `min`)
    plate: { shut: 0.45, r: 1.1, inner: 0.86, rivet: 2.2, glow: [1.2, 1.32], dash: 12, ring: 7, pip: 5, pipGap: 8, pipTray: 3 },
    core: { pulse: 5, glow: [7, 14], glowAlpha: [0.22, 0.12], amp: 3, spec: 0.68 },
    pip: { w: 6, h: 9, gap: 11 }, // Combo pips drawn as brass casings
    mult: { size: 24, swell: 0.5, pulse: 0.25, x: 128, dy: 50, flip: 170 }, // The multiplier beside the lane: size in design units, swell on a step, seconds it swells, where it sits, and the gun height below which it goes under the line
    first: { text: 'Left thumb drags the gun. Right thumb fires.', hold: 3, fade: 0.5 }, // v0.5 P: the first-run controls line, in seconds
    intro: { y: 66, hold: 5, fade: 1.5 }, // The one-line intro (Boss 2's "Every plate scores", Accuracy 4 and 5's dodge line): design-space height, seconds shown, seconds to fade
    menu: { ext: 18, rackH: 66, gap: 4, tileMin: 46, tileMax: 66, selMin: 200, selMax: 236, selFrac: 0.46, laneGap: 2, label: 104, labelMax: 140, propsTag: 150, btnH: 44, edge: 4, dotR: 5, playMin: 120, playMax: 210, missionsW: 80, soundW: 48, endlessW: 112, playPad: 20 }, // The menu (v0.5 N, Q): the rung art's half size, the gun rack's height (the headline, name, bar and tier stack in the selected tile) and gap, its small and selected tiles' widths, the space between lanes, the lane label's least and most width (it fits the longest set name), the width under which the Prop Room button drops its tag, the corner buttons' height and widths, the margin to the screen edge, the radius of the Missions dot, the Play button's least and most width and the room round its label
    pop: { sec: 0.5, delay: 0.25, amp: 0.2 }, // v0.5 Q: a rung whose stars rose swells once on return to the menu: seconds, seconds of delay, the extra size at the peak (never under full size, so its text stays 14 px)
    missions: { cardH: 56, gap: 6, headH: 34, medalR: 17, pad: 12, lineH: 18, gunW: 52, gunH: 24, newR: 5, rail: 44, lock: 16, lockGap: 10 }, // v0.5 Q, the list: a card's height (a wrapped line adds lineH), the gap between cards, a tier heading's height, the medal's radius, the card padding, the silhouette of the gun a badge opens, the radius of the new-badge dot, the scroll rail's width, the Gauntlet padlock's size and its gap to the label
    tickets: { max: 3, h: 34, gap: 6, pad: 8, icon: 26, medal: 22, iconGap: 4, edge: 8, more: 26, delay: 0.5, stagger: 0.12, pop: 0.3, swell: 0.12, rank: { Bronze: 1, Silver: 2, Trick: 3, Gold: 4, gun: 5, skin: 0.5, tier: [0, 2, 3, 4] } }, // v0.5 Q: tickets on the result card, at most `max`, in a row centred `y` below the card's top with `noteY` the note line above them; their height, gap, padding, icon width (a medal's is `medal`), the gap after it, the least margin to the card's edge when the card widens, the room a "+n" takes, the delay and stagger of their pops, the swell; rank: highest first (a badge by tier, a badge that opens a gun, a skin, a mastery tier by number)
    // v0.6 A: the sets, one per mode, in design units. Each is painted once per screen scale into an offscreen image (the static flats) and drawn with one blit a frame; the fog is
    // the one moving piece. `band` is the part of the field the targets use, kept near black; the contrast table in the changelog measures every target against it.
    sets: {
      band: [110, 56, 632, 290], // x0, y0, x1, y1
      truss: { y: 14, h: 7, lamps: 96, lampW: 16, lampH: 12, beam: 0.07 }, // the lighting truss across the top: height, lamp spacing and size, the beams' alpha
      screen: { skyline: [[0, 150, 70], [60, 120, 54], [104, 168, 48], [150, 104, 60], [206, 140, 44], [248, 92, 58], [300, 132, 50], [346, 112, 64], [404, 150, 46], [444, 98, 56], [494, 128, 52], [540, 84, 60], [594, 136, 50]], win: [7, 9, 13, 16], moon: [470, 70, 26], track: 6, tie: 18, camera: [566, 214] },
      western: { fronts: [[0, 96, 150], [150, 120, 118], [268, 84, 140], [408, 110, 112], [520, 90, 120]], win: [26, 30], door: [34, 58], walk: 16, mesa: [[0, 140], [90, 118], [170, 132], [260, 104], [330, 126], [420, 112], [520, 136], [640, 120]], tower: [96, 60] },
      scifi: { stars: 90, planet: [430, 128, 70], ring: [1.7, 0.32], moon: [180, 76, 16], spires: [[150, 44, 120], [230, 30, 80], [520, 38, 100], [600, 28, 70]], grate: 12 },
      monster: { x: 505, top: 26, w: 190, eye: [-50, 18, 7], spines: 6, zip: 12 }, // the kaiju: its middle, the top of its head, its width, the eye (offset from the middle, size), spines, zipper teeth
      robot: { x: 470, top: 30, w: 250, head: -80, visor: [60, 12], rivet: 26 }, // the robot: its middle, the head's top and its offset left of the middle, the torso's width, the visor, rivet spacing
      horror: { stones: [[170, 262, 22, 34], [236, 250, 18, 44], [318, 266, 26, 28], [402, 254, 20, 40], [486, 262, 24, 32], [566, 248, 18, 46]], tree: [600, 290], moon: [210, 58, 18], fence: [130, 236, 640], fog: [[120, 300, 180, 16, 9], [330, 312, 220, 18, -7], [520, 296, 160, 14, 6]], machine: [604, 282] },
      flood: { rigs: [[40, 0], [600, 0]], cone: 170 }, // the night shoot's floodlight rigs (top corners) and how far their cones spread at the floor
      wireAlpha: 0.4,
    },
    set: { accuracy: 'screen', speed: 'western', skeet: 'scifi', zombie: 'horror' }, // the set of each ladder (Boss 1 is the monster, Boss 2 the robot, Endless the night shoot)
    setName: { accuracy: 'Screen Test', speed: 'Western Street', skeet: 'Sci-Fi Stage', boss: 'Monster Stage', zombie: 'Horror Set' },
    clap: { life: 0.55, snap: 0.12, fade: 0.15, w: 150, h: 74, stick: 18, y: 0.45 }, // v0.6 A: the clapperboard, in screen px: seconds shown (under 0.6), the snap, the fade, its size, the striped stick, and its height as a share of the field
    saucer: { lights: 6, lightR: 0.13, band: 0.2, fall: 520, sparks: 7, sparkLen: 9, life: 0.7 }, // a saucer's rim lights and band (fractions of its radius), and its drop when hit: gravity, sparks, seconds
    squib: { drops: 9, speed: [60, 150], life: 0.5, r: [1.6, 3.2] }, // the make-up squib a headshot pops: droplets of stage blood
    props: { side: 132, master: 1.45, masterX: 150, gap: 8, cardMin: 140, cardMax: 190, headH: 52, art: 34, artTall: 56, artMin: 22, line: 16, row: 11, bar: 5, stamp: 0.9, soldShow: 1.2, picScale: 0.26, picScaleTall: 0.15, picRow: 625, headRise: 562 }, // v0.6 B and I, the Prop Room: the prop master's column, his scale and (portrait) his x, the gap between cards, a card's least and most height, the header, the gun art's most height (landscape, portrait) and least height, the name's line pitch, a stat row's pitch and bar height, the seconds a SOLD stamp shows, then the prop master's picture: the seconds his sold pose shows, his scale in game units per pixel of the 512 x 768 canvas (landscape, portrait) and the canvas row that sits on the counter's top
    logo: { title: 28, beam: 0.16, word: [0.03, 0.29, 0.94, 0.5], top: 8, strip: 18 }, // the studio logo on the menu: the title size (the procedural fallback), and the searchlights' alpha; word is the card image's RECOIL lettering as fractions of the image (left, top, width, height), the part portrait shows; top is the margin above the portrait lettering, strip is the height kept under the landscape card for the tagline
    vhs: { pitch: 3, bandH: 14, bandSpeed: 22 }, // menu scan lines every `pitch` px; a faint tracking band `bandH` tall rolls down at `bandSpeed` px a second
    // v0.7, the story: the career plate's widest width in menu tiles (it gives the logo the room its line needs) and its bar's height; a poster's colours per set (top, bottom, accent: the drawn fallback while the Artist's picture is missing); the
    // director's fallback megaphone is drawn from these and the palette; `lines` caps a Prop Room speech strip.
    story: { plateMax: 1.8, bar: 4, lines: 4, poster: { accuracy: ['#14323a', '#0b161b', '#22d3ee'], speed: ['#3a2218', '#170e0b', '#f97316'], skeet: ['#2b2140', '#100c1a', '#c4a6ff'], boss: ['#1b2e25', '#0b130f', '#7ddc9a'], zombie: ['#2d1f2a', '#120b10', '#e59ab0'], endless: ['#1a1a2e', '#07070d', '#ff4fa3'] } },
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
// v0.8 B2: `h` is the median score, over 50 seeds, of a human-pace clean run (every target engaged until hit, 0.45 s reaction, 0.2 s aim settle, reload when empty) on the same
// noise grid, and `cal` the lowest of the designer's 100 percent runs that must earn two stars. The two-star bar never sits above either. Only pairs whose bar did carry them.
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
    smg: { m: [2150, 2150, 2133, 2041, 1925, 1796, 1694, 1601, 1501, 1387, 1280, 1185, 1110, 1054, 996, 944, 904, 863, 832, 781, 750],
      q: [2150, 2150, 2150, 1950, 1850, 1675, 1525, 1445, 1310, 1205, 1080, 920, 835, 790, 760, 720, 695, 670, 645, 585, 585] },
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
    smg: { m: [2950, 2949, 2802, 2585, 2365, 2168, 1973, 1766, 1603, 1455, 1325, 1215, 1139, 1068, 1000, 947, 885, 845, 821, 782, 750],
      q: [2950, 2950, 2750, 2425, 2195, 1970, 1735, 1460, 1305, 1110, 1080, 915, 850, 820, 780, 730, 680, 660, 650, 620, 620] },
    revolver: { m: [2950, 2947, 2804, 2579, 2357, 2133, 1950, 1780, 1615, 1437, 1258, 1128, 1028, 971, 885, 796, 722, 666, 611, 562, 533],
      q: [2950, 2950, 2750, 2425, 2175, 1905, 1700, 1465, 1340, 1120, 940, 795, 725, 655, 535, 535, 450, 415, 400, 385, 345] },
  },
  a3: {
    pistol: { m: [3750, 3690, 3248, 2825, 2423, 2028, 1699, 1394, 1163, 941, 838, 700, 613, 545, 501, 440, 391, 338, 306, 282, 266],
      q: [3750, 3650, 3100, 2615, 2240, 1735, 1380, 1090, 805, 640, 570, 450, 420, 320, 310, 240, 215, 135, 120, 100, 70],
      h: [3750, 3750, 3275, 2830, 2435, 2022, 1615, 1362, 1180, 975, 877, 737, 647, 610, 507, 460, 425, 390, 370, 360, 347] },
    carbine: { m: [3750, 3690, 3248, 2825, 2425, 2026, 1712, 1422, 1211, 1021, 901, 779, 666, 626, 572, 512, 461, 432, 404, 370, 349],
      q: [3750, 3650, 3100, 2615, 2240, 1730, 1380, 1085, 880, 755, 655, 590, 480, 435, 410, 365, 320, 280, 270, 260, 225],
      h: [3750, 3750, 3275, 2830, 2435, 2022, 1615, 1362, 1180, 975, 877, 737, 647, 560, 517, 452, 430, 405, 367, 352, 320] },
    shotgun: { m: [3750, 3700, 3273, 2860, 2462, 2013, 1687, 1358, 1133, 931, 809, 688, 590, 529, 485, 418, 394, 355, 340, 315, 297],
      q: [3750, 3675, 3100, 2625, 2240, 1625, 1270, 935, 775, 625, 540, 470, 405, 315, 325, 260, 260, 240, 220, 210, 195],
      h: [3750, 3750, 3275, 2830, 2435, 2022, 1615, 1362, 1180, 975, 877, 737, 647, 560, 497, 460, 430, 402, 367, 342, 342] },
    rifle: { m: [3750, 3675, 3074, 2623, 2132, 1692, 1283, 1033, 893, 739, 658, 591, 553, 494, 460, 430, 396, 375, 362, 343, 315],
      q: [3750, 3600, 2875, 2380, 1875, 1335, 980, 765, 635, 525, 470, 410, 370, 325, 280, 280, 265, 245, 240, 220, 175] },
    smg: { m: [3750, 3690, 3248, 2825, 2422, 2026, 1736, 1464, 1297, 1150, 1072, 969, 887, 860, 853, 810, 754, 698, 677, 631, 588],
      q: [3750, 3650, 3100, 2615, 2240, 1730, 1395, 1190, 1030, 935, 885, 770, 725, 725, 685, 665, 610, 550, 540, 460, 405] },
    revolver: { m: [3750, 3665, 3000, 2447, 1943, 1454, 1160, 893, 712, 575, 498, 437, 394, 353, 328, 309, 286, 256, 244, 252, 239],
      q: [3750, 3550, 2800, 2280, 1690, 1155, 870, 650, 535, 370, 290, 260, 225, 215, 180, 190, 165, 140, 140, 150, 140] },
  },
  a4: {
    pistol: { m: [2950, 2942, 2753, 2480, 2237, 1979, 1748, 1548, 1297, 1117, 914, 789, 697, 625, 500, 420, 374, 327, 289, 252, 233],
      q: [2950, 2950, 2625, 2275, 2055, 1705, 1495, 1255, 1015, 865, 665, 575, 490, 410, 340, 260, 210, 195, 170, 140, 100],
      h: [2950, 2950, 2662, 1962, 1530, 1350, 987, 910, 800, 722, 590, 547, 517, 490, 432, 377, 347, 320, 317, 287, 277] },
    carbine: { m: [2950, 2942, 2753, 2480, 2237, 1979, 1748, 1556, 1306, 1102, 957, 812, 720, 623, 536, 486, 443, 418, 390, 356, 338],
      q: [2950, 2950, 2625, 2275, 2055, 1705, 1495, 1255, 1025, 860, 750, 625, 530, 460, 390, 370, 340, 310, 290, 270, 255],
      h: [2950, 2950, 2662, 1962, 1530, 1342, 987, 910, 825, 732, 635, 555, 525, 487, 432, 375, 342, 315, 315, 295, 272] },
    shotgun: { m: [2950, 2940, 2749, 2477, 2221, 1989, 1744, 1520, 1360, 1222, 1094, 1022, 867, 804, 773, 740, 659, 649, 611, 562, 546],
      q: [2950, 2950, 2625, 2275, 2005, 1725, 1505, 1235, 1020, 910, 840, 730, 645, 555, 560, 535, 485, 420, 420, 365, 365],
      h: [2950, 2950, 2750, 2435, 2127, 1930, 1635, 1412, 1162, 1047, 962, 967, 887, 842, 772, 712, 682, 632, 642, 577, 545] },
    rifle: { m: [2950, 2942, 2755, 2484, 2230, 1975, 1727, 1498, 1235, 1024, 779, 603, 525, 434, 365, 329, 307, 275, 242, 201, 194],
      q: [2950, 2950, 2625, 2275, 2050, 1705, 1400, 1170, 865, 725, 540, 395, 320, 280, 230, 220, 200, 150, 140, 120, 120],
      h: [2950, 2950, 2550, 1850, 1500, 1182, 952, 845, 655, 545, 480, 387, 335, 320, 307, 247, 237, 220, 200, 180, 170] },
    smg: { m: [2950, 2942, 2753, 2480, 2237, 1979, 1748, 1550, 1305, 1114, 990, 866, 802, 738, 702, 662, 631, 617, 588, 573, 561],
      q: [2950, 2950, 2625, 2275, 2055, 1705, 1495, 1255, 1030, 865, 770, 680, 665, 580, 565, 540, 520, 515, 480, 455, 470],
      h: [2000, 2000, 1872, 1435, 1170, 1077, 950, 810, 787, 747, 715, 715, 715, 680, 670, 605, 550, 587, 590, 525, 542] },
    revolver: { m: [2950, 2943, 2729, 2469, 2228, 1933, 1643, 1418, 1115, 876, 709, 604, 495, 394, 302, 275, 272, 249, 214, 201, 171],
      q: [2950, 2950, 2625, 2325, 2050, 1745, 1360, 1165, 765, 575, 400, 355, 295, 235, 185, 170, 175, 160, 135, 100, 90],
      h: [2950, 2950, 2750, 1987, 1552, 1165, 985, 852, 690, 585, 525, 450, 375, 305, 260, 240, 207, 177, 170, 170, 142] },
  },
  a5: {
    pistol: { m: [3750, 3639, 3118, 2650, 2213, 1803, 1512, 1128, 889, 667, 509, 450, 390, 305, 265, 240, 208, 183, 153, 131, 127],
      q: [3750, 3550, 2950, 2415, 1805, 1455, 1200, 745, 600, 420, 340, 255, 215, 140, 120, 90, 70, 60, 50, 40, 40],
      h: [3750, 3650, 2837, 2097, 1520, 1107, 875, 722, 625, 557, 527, 497, 462, 380, 367, 325, 315, 275, 260, 240, 247] },
    carbine: { m: [3750, 3636, 3088, 2583, 2146, 1751, 1407, 1120, 941, 756, 609, 541, 463, 432, 388, 348, 318, 291, 256, 248, 233],
      q: [3750, 3550, 2950, 2310, 1875, 1470, 1045, 795, 630, 550, 455, 390, 325, 325, 255, 220, 165, 120, 120, 120, 100],
      h: [3750, 3650, 2837, 2097, 1520, 1107, 915, 770, 630, 535, 507, 475, 442, 395, 370, 340, 325, 290, 285, 267, 255] },
    shotgun: { m: [3750, 3653, 3066, 2576, 2138, 1740, 1355, 1052, 843, 718, 628, 560, 502, 440, 440, 413, 395, 368, 351, 330, 335],
      q: [3750, 3550, 2855, 2360, 1855, 1380, 1000, 750, 575, 440, 430, 325, 290, 270, 260, 230, 220, 210, 200, 195, 170],
      h: [3750, 3650, 3065, 2602, 2212, 1580, 1332, 1250, 915, 755, 652, 650, 615, 587, 525, 480, 405, 380, 370, 370, 395] },
    rifle: { m: [3750, 3625, 2998, 2464, 1893, 1365, 926, 763, 537, 467, 390, 342, 281, 240, 220, 214, 188, 173, 168, 153, 132],
      q: [3750, 3550, 2775, 2200, 1570, 1005, 635, 450, 320, 280, 225, 210, 170, 150, 140, 120, 100, 70, 70, 70, 50],
      h: [3750, 3650, 2837, 2070, 1325, 1042, 755, 607, 500, 420, 347, 325, 325, 275, 240, 210, 205, 182, 170, 142, 145] },
    smg: { m: [3750, 3634, 3088, 2591, 2163, 1772, 1494, 1265, 1117, 971, 883, 827, 760, 720, 656, 630, 616, 585, 517, 474, 422],
      q: [3750, 3550, 2950, 2320, 1875, 1470, 1190, 1020, 900, 805, 720, 680, 640, 605, 555, 520, 475, 415, 350, 325, 270],
      h: [3275, 3275, 2630, 1930, 1465, 1280, 1127, 1017, 882, 832, 830, 800, 780, 755, 682, 625, 572, 557, 545, 535, 437] },
    revolver: { m: [3750, 3636, 2995, 2470, 1912, 1299, 955, 609, 486, 409, 297, 265, 211, 181, 174, 165, 142, 140, 126, 105, 103],
      q: [3750, 3550, 2770, 2190, 1495, 910, 670, 425, 330, 240, 170, 165, 120, 90, 100, 90, 40, 50, 40, 20, 20],
      h: [3350, 3250, 2635, 1762, 1102, 827, 577, 400, 350, 325, 270, 240, 187, 197, 160, 157, 150, 155, 145, 140, 142] },
  },
  s1: {
    pistol: { m: [4150, 4147, 3909, 3517, 3175, 2801, 2442, 2131, 1872, 1628, 1482, 1327, 1222, 1167, 1089, 1035, 989, 968, 944, 909, 874],
      q: [4150, 4150, 3800, 3350, 2985, 2555, 2125, 1690, 1525, 1300, 1210, 1055, 995, 995, 910, 890, 835, 785, 755, 750, 730],
      h: [3750, 3750, 3575, 3287, 2965, 2685, 2385, 2185, 1817, 1500, 1335, 1265, 1127, 1110, 1077, 1010, 957, 910, 842, 857, 840] },
    carbine: { m: [4150, 4147, 3909, 3517, 3175, 2801, 2443, 2130, 1869, 1639, 1478, 1330, 1228, 1170, 1095, 1053, 998, 977, 962, 941, 906],
      q: [4150, 4150, 3800, 3350, 2985, 2555, 2125, 1690, 1525, 1315, 1215, 1090, 1010, 990, 930, 910, 845, 825, 795, 780, 770],
      h: [3750, 3750, 3575, 3287, 2965, 2685, 2385, 2185, 1817, 1500, 1330, 1265, 1127, 1107, 1077, 1002, 967, 910, 862, 857, 860] },
    shotgun: { m: [4150, 4147, 3909, 3517, 3175, 2802, 2441, 2128, 1861, 1634, 1465, 1318, 1225, 1151, 1066, 1030, 990, 966, 949, 920, 889],
      q: [4150, 4150, 3800, 3350, 2985, 2555, 2125, 1690, 1460, 1310, 1190, 1085, 1010, 960, 870, 885, 835, 815, 760, 750, 730],
      h: [3750, 3750, 3575, 3287, 2965, 2685, 2385, 2185, 1817, 1525, 1342, 1265, 1137, 1110, 1065, 1010, 960, 892, 862, 817, 817], cal: 2335 },
    rifle: { m: [4150, 4147, 3909, 3517, 3175, 2803, 2441, 2125, 1839, 1624, 1466, 1292, 1172, 1111, 1030, 970, 917, 886, 874, 856, 827],
      q: [4150, 4150, 3800, 3350, 2985, 2580, 2125, 1670, 1435, 1310, 1125, 985, 940, 890, 880, 800, 760, 705, 700, 700, 665],
      h: [3750, 3750, 3575, 3287, 2965, 2685, 2385, 2185, 1817, 1525, 1407, 1322, 1137, 1107, 1072, 1002, 907, 845, 842, 817, 797] },
    smg: { m: [4150, 4147, 3909, 3517, 3175, 2801, 2443, 2130, 1869, 1630, 1473, 1328, 1228, 1171, 1093, 1045, 1008, 974, 961, 941, 904],
      q: [4150, 4150, 3800, 3350, 2985, 2555, 2125, 1690, 1505, 1315, 1210, 1080, 1005, 995, 940, 915, 855, 820, 805, 770, 740],
      h: [3750, 3750, 3575, 3287, 2965, 2685, 2385, 2185, 1817, 1500, 1330, 1265, 1127, 1107, 1077, 1002, 970, 910, 862, 857, 860] },
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
    shotgun: { m: [1722, 1752, 1764, 1720, 1656, 1616, 1596, 1577, 1573, 1552, 1545, 1505, 1494, 1470, 1449, 1430, 1389, 1384, 1368, 1344, 1294],
      q: [1722, 1722, 1722, 1662, 1602, 1562, 1520, 1502, 1491, 1450, 1463, 1420, 1385, 1378, 1368, 1336, 1259, 1260, 1236, 1239, 1176] },
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
    shotgun: { m: [2061, 2048, 1908, 1775, 1619, 1480, 1344, 1249, 1178, 1118, 1094, 1060, 1033, 967, 931, 917, 910, 900, 873, 861, 833],
      q: [2061, 2061, 1825, 1636, 1473, 1294, 1169, 1047, 938, 904, 905, 850, 791, 754, 725, 704, 702, 705, 707, 708, 669] },
    rifle: { m: [2830, 2830, 2807, 2646, 2353, 2097, 1964, 1830, 1701, 1649, 1535, 1492, 1382, 1328, 1323, 1263, 1211, 1177, 1151, 1103, 1111],
      q: [2830, 2830, 2830, 2530, 2090, 1860, 1755, 1620, 1500, 1440, 1280, 1280, 1125, 1060, 1040, 985, 920, 940, 920, 850, 855],
      h: [2430, 2430, 2430, 2430, 2340, 2195, 1920, 2020, 1855, 1710, 1462, 1432, 1347, 1257, 1267, 1110, 1092, 1042, 1085, 1040, 930] },
    smg: { m: [3310, 3282, 3030, 2622, 2004, 1720, 1500, 1294, 1188, 1139, 1108, 1042, 995, 947, 938, 919, 891, 886, 866, 859, 859],
      q: [3310, 3310, 2910, 2380, 1715, 1455, 1295, 1140, 1055, 1015, 970, 900, 870, 810, 830, 810, 785, 810, 780, 770, 755] },
    revolver: { m: [980, 913, 975, 999, 973, 996, 936, 877, 831, 806, 755, 686, 658, 612, 594, 559, 549, 523, 512, 496, 489],
      q: [980, 930, 980, 980, 885, 885, 855, 690, 615, 610, 585, 485, 485, 430, 440, 415, 420, 400, 370, 360, 360] },
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
      q: [3750, 3750, 3350, 2875, 1975, 1600, 1300, 1075, 900, 800, 750, 650, 600, 550, 500, 450, 450, 400, 350, 350, 350],
      h: [1450, 1550, 1600, 1600, 1562, 1475, 1437, 1350, 1237, 1112, 1075, 975, 912, 775, 775, 700, 700, 700, 612, 537, 500] },
    smg: { m: [3750, 3738, 3394, 2814, 2235, 1842, 1594, 1428, 1329, 1250, 1195, 1173, 1149, 1129, 1105, 1083, 1059, 1045, 1033, 1029, 1026],
      q: [3750, 3750, 3275, 2400, 1850, 1500, 1300, 1225, 1075, 1075, 1025, 1000, 1000, 1000, 975, 950, 925, 925, 925, 925, 925] },
    revolver: { m: [3750, 3711, 3521, 2945, 2318, 1765, 1496, 1323, 1152, 1038, 981, 887, 829, 795, 754, 710, 657, 606, 573, 531, 522],
      q: [3750, 3750, 3400, 2675, 1575, 1200, 1100, 950, 900, 825, 800, 700, 650, 625, 600, 525, 525, 475, 425, 400, 350] },
  },
  k3: {
    pistol: { m: [2950, 2915, 2523, 2036, 1614, 1354, 1186, 1075, 987, 956, 928, 871, 818, 804, 773, 737, 690, 679, 680, 650, 639],
      q: [2950, 2950, 2350, 1700, 1275, 1100, 950, 875, 850, 825, 775, 750, 700, 675, 650, 650, 550, 575, 575, 525, 525],
      h: [2000, 2000, 1837, 1650, 1362, 1137, 975, 900, 800, 775, 700, 650, 575, 575, 525, 525, 500, 512, 500, 500, 487] },
    carbine: { m: [2950, 2915, 2523, 2044, 1610, 1360, 1207, 1110, 1007, 960, 919, 870, 838, 818, 775, 767, 724, 711, 695, 693, 672],
      q: [2950, 2950, 2350, 1700, 1275, 1100, 975, 925, 875, 800, 800, 725, 725, 700, 675, 675, 600, 600, 600, 575, 550],
      h: [2000, 2000, 1837, 1650, 1387, 1162, 1025, 937, 850, 775, 700, 675, 650, 625, 575, 600, 537, 575, 550, 550, 512] },
    shotgun: { m: [2950, 2915, 2523, 2043, 1599, 1344, 1167, 1057, 965, 888, 840, 779, 738, 693, 644, 618, 594, 578, 557, 527, 512],
      q: [2950, 2950, 2350, 1700, 1275, 1075, 925, 850, 800, 725, 675, 625, 600, 550, 525, 475, 475, 475, 425, 425, 400],
      h: [1650, 1650, 1500, 1350, 1137, 1025, 900, 787, 662, 600, 562, 512, 475, 475, 425, 400, 375, 350, 362, 350, 375] },
    rifle: { m: [2950, 2923, 2559, 1945, 1464, 1194, 1023, 910, 804, 712, 640, 590, 553, 504, 448, 405, 393, 374, 355, 340, 324],
      q: [2950, 2950, 2475, 1500, 1025, 900, 800, 700, 600, 525, 425, 400, 350, 350, 300, 300, 275, 250, 225, 225, 200],
      h: [1650, 1650, 1500, 1300, 1050, 850, 825, 675, 600, 462, 425, 400, 400, 362, 350, 325, 300, 287, 262, 250, 262] },
    smg: { m: [2950, 2915, 2523, 2039, 1615, 1362, 1186, 1106, 1020, 971, 933, 896, 869, 855, 811, 782, 764, 752, 728, 721, 706],
      q: [2950, 2950, 2350, 1700, 1275, 1100, 975, 900, 900, 825, 800, 750, 750, 725, 700, 675, 675, 675, 625, 600, 600],
      h: [2000, 2000, 1837, 1650, 1387, 1162, 1025, 937, 850, 775, 700, 675, 650, 637, 562, 600, 550, 575, 550, 550, 500] },
    revolver: { m: [2950, 2916, 2548, 2065, 1624, 1294, 1064, 929, 827, 737, 628, 556, 505, 463, 429, 398, 365, 341, 319, 312, 284],
      q: [2950, 2950, 2475, 1725, 1250, 950, 750, 675, 600, 525, 425, 375, 325, 300, 250, 250, 225, 200, 200, 200, 150],
      h: [1650, 1650, 1525, 1287, 1037, 850, 762, 612, 550, 450, 400, 325, 300, 300, 262, 212, 212, 237, 187, 187, 187] },
  },
  b1: {
    pistol: { m: [3750, 3577, 2961, 2448, 1989, 1610, 1319, 1120, 990, 918, 899, 851, 834, 791, 793, 775, 757, 737, 720, 696, 715],
      q: [3750, 3550, 2775, 2260, 1785, 1395, 1155, 985, 860, 785, 745, 715, 715, 670, 655, 620, 650, 605, 615, 570, 615] },
    carbine: { m: [3750, 3591, 3011, 2605, 2285, 1955, 1644, 1396, 1218, 1085, 978, 917, 870, 858, 864, 829, 804, 770, 774, 782, 773],
      q: [3750, 3550, 2800, 2430, 2125, 1715, 1385, 1165, 950, 805, 700, 690, 690, 685, 705, 675, 660, 615, 615, 625, 615] },
    shotgun: { m: [1000, 1138, 1120, 1006, 911, 814, 692, 605, 535, 489, 428, 387, 351, 333, 308, 293, 285, 269, 253, 242, 233],
      q: [1000, 1000, 1000, 900, 800, 690, 525, 405, 355, 325, 295, 245, 215, 200, 190, 160, 170, 145, 140, 120, 120],
      h: [1000, 1125, 1075, 1025, 912, 825, 687, 605, 500, 470, 425, 327, 295, 295, 245, 242, 242, 217, 195, 190, 177] },
    rifle: { m: [1000, 955, 863, 764, 695, 636, 586, 538, 497, 468, 442, 415, 392, 383, 366, 352, 348, 342, 332, 328, 320],
      q: [1000, 875, 775, 700, 600, 525, 475, 415, 390, 355, 350, 320, 310, 305, 280, 265, 265, 260, 260, 240, 235],
      h: [1000, 1000, 850, 750, 675, 635, 555, 547, 485, 460, 440, 420, 365, 360, 365, 342, 337, 335, 325, 320, 302] },
    smg: { m: [3750, 3579, 3001, 2525, 2092, 1666, 1356, 1118, 942, 841, 805, 798, 814, 796, 751, 726, 704, 690, 710, 692, 686],
      q: [3750, 3550, 2775, 2330, 1860, 1410, 1100, 920, 795, 685, 655, 665, 655, 665, 620, 605, 600, 595, 610, 565, 555] },
    revolver: { m: [1000, 966, 861, 770, 693, 637, 574, 522, 490, 461, 418, 387, 363, 352, 342, 328, 328, 314, 309, 300, 284],
      q: [1000, 1000, 750, 675, 600, 515, 450, 380, 365, 345, 310, 275, 265, 260, 250, 245, 240, 215, 235, 230, 220],
      h: [1000, 1000, 850, 750, 650, 600, 547, 485, 435, 417, 395, 377, 340, 320, 300, 305, 322, 317, 297, 282, 270] },
  },
  b2: {
    pistol: { m: [9750, 9378, 8205, 7066, 5937, 4904, 4146, 3393, 2923, 2589, 2317, 2203, 2186, 2107, 2064, 2036, 2008, 1848, 1760, 1755, 1663],
      q: [9750, 9150, 7900, 6715, 5580, 4405, 3645, 2925, 2500, 2230, 1955, 1855, 1895, 1780, 1760, 1750, 1705, 1655, 1565, 1540, 1450] },
    carbine: { m: [9750, 9370, 8085, 6564, 5343, 4349, 3695, 3227, 2900, 2620, 2449, 2265, 2245, 2155, 2090, 2014, 2029, 1937, 1899, 1858, 1753],
      q: [9750, 9150, 7750, 6220, 5000, 4010, 3245, 2735, 2370, 2185, 1965, 1880, 1820, 1805, 1740, 1705, 1690, 1730, 1640, 1615, 1510] },
    shotgun: { m: [4550, 3270, 2873, 2557, 2314, 2057, 1768, 1463, 1241, 1104, 1022, 939, 869, 798, 738, 699, 669, 617, 589, 573, 558],
      q: [4550, 3150, 2675, 2330, 2035, 1810, 1480, 1110, 875, 770, 730, 670, 635, 570, 520, 485, 475, 440, 425, 415, 390],
      h: [4950, 3350, 2962, 2752, 2425, 2192, 1725, 1460, 1222, 1077, 925, 825, 770, 737, 652, 587, 565, 570, 555, 562, 522] },
    rifle: { m: [2550, 2455, 2179, 1931, 1732, 1555, 1362, 1224, 1149, 1063, 999, 935, 901, 880, 837, 816, 801, 785, 765, 724, 710],
      q: [2550, 2350, 2025, 1785, 1545, 1380, 1135, 985, 925, 840, 810, 730, 715, 680, 670, 620, 600, 605, 615, 570, 555] },
    smg: { m: [9750, 9424, 8219, 6873, 5515, 4395, 3407, 2691, 2393, 2173, 2082, 1989, 2087, 2081, 2026, 1920, 1905, 1874, 1827, 1767, 1745],
      q: [9750, 9350, 7950, 6545, 5160, 3985, 2915, 2305, 2000, 1815, 1765, 1695, 1785, 1780, 1700, 1675, 1515, 1610, 1595, 1500, 1475] },
    revolver: { m: [2550, 2469, 2205, 1902, 1695, 1502, 1364, 1181, 1060, 1015, 901, 856, 818, 803, 768, 753, 732, 694, 702, 671, 656],
      q: [2550, 2350, 2025, 1725, 1500, 1330, 1170, 915, 850, 835, 700, 630, 605, 605, 615, 570, 580, 560, 545, 535, 490] },
  },
  z1: {
    pistol: { m: [3362, 3353, 3040, 2641, 2371, 2265, 2174, 2068, 2017, 1994, 1967, 1952, 1926, 1944, 1948, 1949, 1951, 1954, 1953, 1953, 1947],
      q: [3362, 3362, 2547, 2235, 2055, 2034, 1947, 1931, 1876, 1857, 1861, 1844, 1839, 1844, 1849, 1849, 1852, 1859, 1843, 1849, 1853],
      h: [3362, 3362, 3362, 2542, 2310, 2179, 2146, 2059, 2009, 2019, 2013, 1992, 1992, 2015, 2011, 2019, 2012, 1996, 1975, 1961, 1955] },
    carbine: { m: [3362, 3353, 3042, 2642, 2403, 2257, 2186, 2060, 2032, 1995, 1970, 1967, 1965, 1961, 1943, 1932, 1925, 1921, 1937, 1939, 1940],
      q: [3362, 3362, 2547, 2242, 2124, 2027, 1962, 1910, 1897, 1883, 1878, 1879, 1880, 1884, 1860, 1854, 1844, 1841, 1863, 1863, 1858],
      h: [3362, 3362, 3362, 2542, 2250, 2177, 2175, 2065, 2033, 2029, 2043, 1997, 1976, 1992, 1998, 2046, 1998, 1995, 2001, 2017, 2017] },
    shotgun: { m: [3409, 3400, 3099, 2712, 2437, 2217, 2012, 1790, 1609, 1547, 1504, 1395, 1364, 1319, 1302, 1293, 1256, 1235, 1207, 1159, 1195],
      q: [3409, 3409, 2619, 2298, 2098, 1886, 1675, 1501, 1366, 1325, 1300, 1189, 1120, 1043, 1059, 1055, 978, 981, 958, 926, 966],
      h: [3409, 3409, 3409, 2619, 2322, 2025, 1938, 1869, 1595, 1562, 1488, 1310, 1391, 1351, 1258, 1188, 1195, 1244, 1143, 1054, 1146], cal: 1592 },
    rifle: { m: [3502, 3493, 3170, 2785, 2569, 2437, 2392, 2281, 2266, 2261, 2227, 2256, 2244, 2217, 2206, 2211, 2195, 2185, 2171, 2181, 2185],
      q: [3502, 3502, 2737, 2402, 2252, 2204, 2172, 2156, 2164, 2137, 2116, 2134, 2107, 2116, 2122, 2127, 2124, 2103, 2066, 2059, 2101],
      h: [3502, 3502, 3502, 2711, 2557, 2316, 2293, 2291, 2262, 2261, 2251, 2226, 2220, 2196, 2185, 2246, 2208, 2205, 2195, 2194, 2209] },
    smg: { m: [3362, 3353, 3044, 2637, 2409, 2248, 2177, 2051, 2026, 2009, 1978, 1954, 1951, 1935, 1944, 1953, 1955, 1936, 1945, 1933, 1941],
      q: [3362, 3362, 2547, 2237, 2124, 2031, 1944, 1911, 1881, 1884, 1862, 1857, 1844, 1834, 1836, 1841, 1847, 1854, 1848, 1857, 1849],
      h: [3362, 3362, 3362, 2542, 2266, 2177, 2175, 2069, 2039, 2023, 2045, 2006, 1998, 2027, 2022, 2029, 2000, 2006, 2008, 2003, 2006] },
    revolver: { m: [3502, 3493, 3166, 2777, 2569, 2399, 2301, 2264, 2245, 2193, 2170, 2166, 2161, 2128, 2122, 2134, 2141, 2152, 2102, 2067, 2099],
      q: [3502, 3502, 2737, 2402, 2259, 2157, 2113, 2102, 2101, 2045, 2062, 2064, 2059, 2061, 2059, 2031, 2041, 2054, 2024, 2024, 2041] },
  },
  z2: {
    pistol: { m: [7002, 6993, 6355, 5532, 5067, 4832, 4511, 4436, 4374, 4256, 4218, 4222, 4158, 4165, 4179, 4166, 4139, 4194, 4177, 4095, 4163],
      q: [7002, 7002, 6079, 4988, 4665, 4502, 4244, 4166, 4179, 4089, 4063, 4093, 4020, 4039, 4003, 4044, 4005, 4078, 4040, 3997, 4044] },
    carbine: { m: [7002, 6994, 6481, 5510, 4964, 4731, 4538, 4415, 4356, 4330, 4310, 4290, 4264, 4180, 4199, 4158, 4153, 4224, 4130, 4116, 4051],
      q: [7002, 7002, 6177, 5072, 4672, 4532, 4304, 4188, 4153, 4093, 4100, 4135, 4097, 4084, 4071, 4051, 4021, 4108, 4050, 4018, 4029] },
    shotgun: { m: [7141, 7119, 6612, 5575, 4987, 4532, 4069, 3778, 3559, 3384, 3224, 3036, 2950, 2899, 2799, 2716, 2674, 2614, 2574, 2554, 2494],
      q: [7141, 7117, 6344, 5162, 4487, 4052, 3655, 3423, 3101, 2971, 2791, 2673, 2552, 2557, 2440, 2351, 2407, 2278, 2241, 2212, 2164],
      h: [6226, 6233, 5953, 5290, 4616, 4224, 4062, 3700, 3500, 3314, 3191, 2935, 2945, 2880, 2894, 2801, 2713, 2631, 2650, 2652, 2463] },
    rifle: { m: [7347, 7335, 6675, 5815, 5454, 5264, 5168, 5038, 5060, 4934, 4999, 5039, 4919, 4827, 4675, 4702, 4589, 4456, 4287, 4358, 4219],
      q: [7347, 7347, 6242, 5380, 5111, 4968, 4921, 4807, 4785, 4714, 4789, 4856, 4773, 4688, 4696, 4695, 4655, 4619, 4403, 4403, 4267] },
    smg: { m: [7002, 6999, 6467, 5418, 5059, 4771, 4528, 4430, 4328, 4297, 4260, 4195, 4181, 4174, 4208, 4205, 4198, 4175, 4158, 4139, 4156],
      q: [7002, 7002, 6177, 4954, 4647, 4457, 4229, 4214, 4117, 4094, 4088, 4019, 4041, 4030, 4038, 4080, 4038, 4043, 4032, 4000, 4015] },
    revolver: { m: [7347, 7340, 6870, 6151, 5523, 5256, 5093, 5015, 4674, 4545, 4303, 4115, 3987, 3735, 3447, 3157, 3074, 2870, 2691, 2511, 2379],
      q: [7347, 7347, 6472, 5727, 5072, 4887, 4794, 4799, 4697, 4646, 4517, 4183, 3306, 2156, 1384, 1323, 1331, 1273, 1221, 1068, 1043],
      h: [7347, 7347, 6844, 5925, 5606, 5226, 5053, 4984, 5022, 4950, 4924, 4904, 4820, 4418, 4330, 3668, 3647, 2638, 2201, 1805, 1685] },
  },
  z3: {
    pistol: { m: [11250, 10994, 10120, 8835, 7953, 7468, 7157, 7125, 7019, 6971, 6956, 6889, 6920, 6862, 6881, 6807, 6793, 6759, 6810, 6648, 6738],
      q: [11250, 10745, 9707, 8234, 7499, 7054, 6872, 6850, 6764, 6686, 6731, 6678, 6733, 6725, 6668, 6609, 6631, 6618, 6620, 6549, 6610] },
    carbine: { m: [11250, 11240, 10272, 8842, 8048, 7534, 7283, 7170, 7102, 7026, 7006, 6882, 6804, 6704, 6695, 6703, 6666, 6509, 6196, 6034, 5913],
      q: [11250, 11250, 9907, 8387, 7582, 7102, 6910, 6899, 6864, 6749, 6757, 6669, 6628, 6680, 6647, 6683, 6605, 6563, 6393, 6218, 6329] },
    shotgun: { m: [10664, 10844, 10077, 8599, 7806, 6914, 6471, 6056, 5683, 5381, 5182, 4853, 4781, 4689, 4599, 4486, 4341, 4417, 4322, 4220, 4199],
      q: [10664, 10667, 9591, 8044, 7173, 6330, 5861, 5556, 5087, 4865, 4703, 4397, 4245, 4263, 4064, 3996, 3936, 4082, 3913, 3852, 3785],
      h: [10306, 9955, 9549, 8440, 7667, 6973, 6278, 6044, 5609, 5342, 5196, 5115, 4913, 4769, 4582, 4485, 4640, 4335, 4351, 4172, 4251] },
    rifle: { m: [11725, 11725, 10806, 9869, 9264, 8866, 8802, 8404, 7277, 6467, 5890, 4972, 4099, 3739, 3323, 2841, 2907, 2717, 2598, 2483, 2284],
      q: [11725, 11725, 10420, 9305, 8855, 8499, 8633, 8264, 5703, 4729, 3203, 2830, 2634, 2578, 2453, 2185, 1511, 1552, 1614, 1776, 1680],
      h: [11295, 11650, 10782, 10137, 9341, 9009, 8712, 8702, 7118, 5846, 5563, 4819, 4369, 3861, 3773, 2724, 2710, 2386, 2188, 2109, 1939] },
    smg: { m: [11250, 11241, 10261, 8805, 8112, 7571, 7253, 7050, 6928, 6964, 6892, 6832, 6846, 6885, 6761, 6710, 6691, 6711, 6716, 6676, 6565],
      q: [11250, 11250, 9820, 8173, 7597, 7127, 6917, 6827, 6688, 6735, 6653, 6644, 6629, 6664, 6652, 6585, 6578, 6535, 6551, 6545, 6455] },
    revolver: { m: [11725, 11725, 10902, 9825, 8321, 6705, 5274, 4397, 4053, 3421, 3133, 2909, 2375, 2156, 1954, 1852, 1629, 1439, 1335, 1291, 1115],
      q: [11725, 11725, 10317, 9587, 6152, 5475, 3045, 2753, 2520, 2217, 2052, 1854, 1251, 1311, 1101, 903, 886, 813, 798, 713, 633] },
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
  let b = { one: Math.max(R, one), two: Math.max(2 * R, two), three: Math.max(3 * R, three) };
  const F = T.starFallback;
  if (b.three - b.one < F.gap * c.m[0]) { const [f1, f2, f3] = F.shares.map((k) => Math.round((k * c.m[0]) / R) * R); b = { one: f1, two: f2, three: f3, fallback: true }; } // the bars measure no aim: efficiency instead
  const lid = Math.min(c.h ? curveAt(c.h, N.two) : Infinity, c.cal || Infinity);
  if (b.two > lid) { b.two = Math.floor(lid / R) * R; b.one = Math.min(b.one, b.two - R); } // v0.8 B2: a human-pace clean run earns two stars
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
  return { n: Math.min(E2.sizeCap, E2.sizeFrom + Math.floor(k / E2.sizeEvery)), mul: Math.min(E2.speedCap, 1 + E2.speedStep * k), hp: Math.floor(k / E2.hpEvery), types: ENDLESS_MIX.slice(0, Math.min(ENDLESS_MIX.length, E2.mixFrom + Math.floor(k / E2.mixEvery))) };
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
    kUp: false, kDown: false, holding: false, burst: null, nextFire: 0,
    score: 0, streak: 0, shots: 0, hits: 0, bulls: 0, misses: 0, baits: 0,
    ammo: ch.ladder === 'accuracy' ? Math.round(ch.accAmmo * (gun.accAmmo || 1)) : Infinity,
    nextAt: T.startDelay, done: false, cleared: false, pairHits: {}, double: false,
    decoyHits: 0, down: 0, revealed: 0, revealQ: [],
    mag: gun.magSize, reloading: false, reloadStart: 0, reloadEnd: 0, shellNext: 0, shellEach: 0, reloads: 0, // the magazine (v0.5 M)
    cBull: 0, cHead: 0, cPlate: 0, // the run's mastery counters (v0.5 N)
    zs: [], zN: 0, wave: 0, pending: [], calmAt: T.startDelay, forceAt: Infinity, zdown: 0, breach: null, // zombies (v0.5 G)
    hitTimes: [], hitWho: [], hitShots: 0, kickback: false, lastShotHit: false, firstZone: -1, lateClay: false, hordes: {}, hordeN: 0, walked: false, // counters for the delighter badges
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
  closeBurst(run);
  run.done = true;
  run.events.push({ type: 'end' });
}

// v0.8 B2: on Accuracy an automatic gun's trigger hold is one shot for accuracy and the combo, a hit if any of its rounds hit. Its miss, or its bait, books when the hold ends.
function closeBurst(run) {
  const b = run.burst;
  if (!b) return;
  run.burst = null;
  if (b.hit) return;
  if (b.bait) run.baits++;
  else { run.streak = 0; run.misses++; }
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
  const z = d.size, PS = T.zombie.pose, SH = d.shield ? PS.shield : {}, sc = (o) => (o ? [o[0] * z, o[1] * z] : o), pick = (name) => Object.fromEntries(Object.keys({ ...PS[name], ...SH[name] }).map((part) => [part, sc((SH[name] && SH[name][part]) || PS[name][part])]));
  ZTYPES[k] = { id: k, ...d, pose: { stand: pick('stand'), crawl: pick('crawl'), hunch: pick('hunch'), drag: pick('drag') } };
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
  run.forceAt = t + (ch.endless ? Math.max(T.zombie.endless.forceMin, T.zombie.endless.forceFrom - run.wave) : ch.force);
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
  const parts = [...hurt].filter((p) => p.kind === 'zpart').sort((a, b) => (a.part < b.part ? -1 : 1)), centre = res[(res.length - 1) >> 1].tg; // a fixed order, by name
  for (const p of parts) {
    const w = p === centre ? 1 : Z.outerShare; // v0.5 P: a part only an outer pellet hit pays its outer share (a quarter)
    base += w * PT.hit * hits.get(p); tx += p.x; ty += p.y; p.hitAt = now;
    if (p.part === 'brain') brain = true;
    if (p.hp > 0) continue;
    base += w * PT[p.part];
    if (p.part === 'brain') { base += w * PT.bonus; zone = 0; tag = 'Brain shot'; killed = true; }
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
  const g = run.gun, now = run.steps * STEP, grp = run.ch.ladder === 'accuracy' && !!g.auto;
  if (run.reloading && !(g.shell && run.mag > 0)) { if (cue) run.events.push({ type: 'dropped', reload: true }); return; } // a reload under way: the tap does nothing
  if (now < run.nextFire - STEP - 1e-9) { if (cue) run.events.push({ type: 'dropped' }); return; }
  if (run.reloading) { run.reloading = false; run.events.push({ type: 'interrupt' }); } // the shotgun fires what it has loaded, and the reload stops // one step of slack, so a tap at the nominal interval is not lost to step rounding
  run.nextFire = Math.max(now, run.nextFire) + 1 / g.fireRate; // held fire keeps the exact rate
  const newShot = !grp || !run.burst;
  if (grp && newShot) run.burst = { hit: false, bait: false };
  const gx = T.gunX, gy = run.gunY, a0 = angleOf(run);
  const lines = fanOffsets(g).map((off) => { const a = (a0 + off) * DEG; return { sn: Math.sin(a), cs: Math.cos(a) }; });
  let dodged = false, baitAt = null; // v0.8 C: a shot that only makes a dodger jump is a bait, not a miss
  for (const tg of run.targets) {
    if (tg.kind !== 'dodge' || now < tg.nextDodge - 1e-9) continue;
    const vx = tg.x - gx, vy = tg.y - gy;
    if (lines.some((l) => vx * l.cs - vy * l.sn > 0 && Math.abs(vx * l.sn + vy * l.cs) <= T.dodgeRange)) { baitAt = baitAt || { x: tg.x, y: tg.y }; dodge(run, tg, now); dodged = true; }
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
    for (const [tg, z] of scored) { pts += Math.round(T.zonePoints[z] * mult * (tg.flat && tg !== mid.tg ? T.zombie.outerShare : 1)); bz = Math.min(bz, z); tx += tg.x; ty += tg.y; if (z === 0 && (run.ch.ladder === 'accuracy' || run.ch.ladder === 'skeet' || tg.kind === 'core')) run.cBull++; } // mastery (v0.5 N): bullseyes on cards and clays, and on a boss core
    if (zh) { zt = zombieShot(run, res, hurt, mult, now); if (zt.brain) run.cHead++; pts += zt.pts; bz = Math.min(bz, zt.zone); tx += zt.tx; ty += zt.ty; nt++; }
    const was = run.streak, counts = !grp || !run.burst.hit;
    run.score += pts; run.hits += scored.size + (zh ? 1 : 0);
    run.streak = zt && !zt.brain && !scored.size ? 0 : counts ? run.streak + 1 : run.streak; // v0.5 L: on a zombie only a brain hit steps the multiplier, a hit on anything else resets it
    if (bz === 0) run.bulls++;
    if (run.shots === 0) run.firstZone = bz;
    if (counts) run.hitShots++;
    if (grp) run.burst.hit = true;
    run.hitTimes.push(now); run.hitWho.push([...scored.keys(), ...[...hurt].filter((p) => p.kind === 'zpart').map((p) => p.z)]); // who each hit landed on: a zombie counts once
    if (run.hitTimes.length > T.kickCount) { run.hitTimes.shift(); run.hitWho.shift(); }
    if (run.streak >= T.kickCount && now - run.hitTimes[0] <= T.kickWindow + 1e-9 && new Set(run.hitWho.flat()).size >= T.kickTargets) run.kickback = true; // consecutive scoring shots within the window, on at least two targets
    Object.assign(ev, { tx: tx / nt, ty: ty / nt, zone: bz, pts, mult, streak: run.streak, lost: was > 0 && run.streak === 0, killed: down.size > 0 || !!(zt && zt.killed), tag: zt ? zt.tag : null });
  } else if (grp) {
    if (dodged) { run.burst.bait = true; ev.bait = baitAt; }
  } else {
    if (dodged) { run.baits++; ev.bait = baitAt; } // a bait costs neither the chain nor the accuracy
    else if (!ev.neutral) { run.streak = 0; run.misses++; }
  }
  ev.streak = run.streak;
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
  run.lastShotHit = grp ? run.burst.hit : ev.hit;
  run.events.push(ev);
  run.kick = Math.min(T.kickMax, run.kick + g.kickPerShot);
  run.ammo--; if (newShot) run.shots++;
  if (--run.mag <= 0) startReload(run, now); // empty: the reload starts by itself
  if (grp && !run.holding) closeBurst(run); // a tap is a hold of one round
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
      else { run.holding = !!e.value; if (!run.holding) closeBurst(run); }
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
// The gun's stars over every rung, and the most there are (the menu's one headline).
function starTotal(E, gun) { return CHALLENGES.reduce((n, ch) => n + starsOf(E, ch, gun), 0); }
// Where Play goes (v0.5 Q): this gun's frontier, the first open rung it has not passed (passing is the unlock rule's two stars), so it is the rung the hint line is waiting on;
// with every open rung passed, the first short of three stars; with all three-starred, the first rung.
function frontier(E, gun) {
  const open = CHALLENGES.filter((ch) => isUnlocked(E, ch, gun));
  return open.find((ch) => starsOf(E, ch, gun) < T.unlockStars) || open.find((ch) => starsOf(E, ch, gun) < 3) || CHALLENGES[0];
}
// Rungs where a gun has two stars or better.
function rungsDone(E, gun) { return CHALLENGES.filter((ch) => starsOf(E, ch, gun) >= 2).length; }
// ---------- Guns: bought in the Prop Room (v0.6 B), the .44 by a badge ----------

function hadMap(E) { const m = E.save.get('gunsHad', {}); return m && typeof m === 'object' ? m : {}; }
function ownedMap(E) { const m = E.save.get('owned', {}); return m && typeof m === 'object' ? m : {}; }
// A gun is open when it is the free pistol, was bought (or owned before v0.6, which the migration put in `owned`), or its badge is earned; a save from before v7 also keeps what the old
// points table opened (gunsHad). A gun is never taken away.
function gunUnlocked(E, id) { return id === 'pistol' || !!ownedMap(E)[id] || !!hadMap(E)[id] || (!!T.unlockBadges[id] && !!badgeMap(E)[T.unlockBadges[id]]); }
// Box office, in dollars: what a run pays (its score and its stars), the save's balance, and how it is written ("$1,240").
function boxFor(score, stars) { return Math.round(T.boxPerPoint * Math.max(0, score) + T.boxPerStar * stars); }
function boxOf(E) { const b = E.save.get('box', T.boxStart); return Number.isFinite(b) ? b : T.boxStart; }
const money = (n) => `$${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
// v0.5 K's unlock badges: before v0.6 a gun opened with its badge, so a save with the badge had the gun (the migration keeps it owned).
const OLD_UNLOCK_BADGES = { carbine: 'marksman1', shotgun: 'quickdraw1', rifle: 'clay1', smg: 'quickdraw2', revolver: 'marksman2' };
function gunId(E) { const id = E.save.get('gun', 'pistol'); return T.guns[id] && gunUnlocked(E, id) ? id : 'pistol'; }
function unlockBadge(id) { return T.unlockBadges[id] ? BADGES.find((b) => b.id === T.unlockBadges[id]) : null; }

// ---------- Badges (v0.3 section B): skill acts, tiered ----------

// Each badge is data with a rule: met(o) says whether a finished run earns it. o: { ch, gun, stars, double, decoyHits, gauntletDone, bests, run, cold }; bests is
// { challengeId: { gunId: { stars } } } and already includes this run, run is the sim's run (its counters), cold the runs in a row that opened on a bullseye.
const at = (o, id) => o.ch.id === id;
const three = (o) => o.stars === 3;
const BADGES = [
  { id: 'marksman1', tier: 'Bronze', name: 'Marksman I', cond: 'Three stars on Accuracy 1', met: (o) => at(o, 'a1') && three(o) },
  { id: 'quickdraw1', tier: 'Bronze', name: 'Quick Draw I', cond: 'Three stars on Speed 1', met: (o) => at(o, 's1') && three(o) },
  { id: 'clay1', tier: 'Bronze', name: 'Saucer Shooter I', cond: 'Three stars on Skeet 1', met: (o) => at(o, 'k1') && three(o) },
  { id: 'steady', tier: 'Silver', name: 'Steady', cond: `Accuracy 4, three stars, ${T.guns.carbine.short}`, met: (o) => at(o, 'a4') && three(o) && o.gun === 'carbine' },
  { id: 'storm', tier: 'Silver', name: 'Storm', cond: 'Three stars on Speed 4', met: (o) => at(o, 's4') && three(o) },
  { id: 'double', tier: 'Silver', name: 'Double Feature', cond: 'Hit both saucers of a Skeet 2 pair', short: 'Both saucers of a Skeet pair', met: (o) => at(o, 'k2') && !!o.double },
  { id: 'marksman2', tier: 'Silver', name: 'Marksman II', cond: 'Three stars on Accuracy 5', met: (o) => at(o, 'a5') && three(o) },
  { id: 'quickdraw2', tier: 'Silver', name: 'Quick Draw II', cond: 'Three stars on Speed 5', met: (o) => at(o, 's5') && three(o) },
  { id: 'clay2', tier: 'Silver', name: 'Saucer Shooter II', cond: 'Skeet 3, no decoy hit, three stars', short: 'Skeet 3: no decoy, three stars', met: (o) => at(o, 'k3') && three(o) && !o.decoyHits },
  // Wrong Tool: the gun a challenge was not made for; each unlocks only its badge
  { id: 'sprint', tier: 'Silver', name: "Marksman's Sprint", cond: `${T.guns.rifle.short} on Speed 3, two stars`, met: (o) => at(o, 's3') && o.gun === 'rifle' && o.stars >= 2 },
  { id: 'scatter', tier: 'Silver', name: 'Scatter Precision', cond: `${T.guns.shotgun.short} on Accuracy 2, two stars`, met: (o) => at(o, 'a2') && o.gun === 'shotgun' && o.stars >= 2 },
  { id: 'sidearm', tier: 'Silver', name: 'Sidearm Only', cond: `${T.guns.pistol.short} on Boss 2, two stars`, met: (o) => at(o, 'b2') && o.gun === 'pistol' && o.stars >= 2 },
  { id: 'claycarbine', tier: 'Silver', name: 'Pulse Saucers', cond: `${T.guns.carbine.short} on Skeet 2, three stars`, met: (o) => at(o, 'k2') && o.gun === 'carbine' && three(o) },
  // Delighters (PRD v0.5 J): one act, never grind; each pops a ticket on the card
  { id: 'kickback', tier: 'Trick', name: 'Kickback', cond: `${T.kickCount} hits in a row in ${T.kickWindow} s, on ${T.kickTargets}+ targets`, short: `${T.kickCount} hits in ${T.kickWindow} s, ${T.kickTargets}+ targets`, met: (o) => o.run.kickback },
  { id: 'lastround', tier: 'Trick', name: 'Last Round', cond: 'Accuracy, three stars, the last bullet the last hit', short: 'Accuracy: last bullet hits, three stars', met: (o) => o.ch.ladder === 'accuracy' && three(o) && o.run.ammo === 0 && o.run.lastShotHit },
  { id: 'coldbarrel', tier: 'Trick', name: 'One Take', cond: 'A bullseye on the first shot, five runs in a row', short: 'First-shot bullseye, five runs running', met: (o) => o.cold >= T.coldRuns, count: (E) => ({ have: Math.min(E.save.get('cold', 0), T.coldRuns), need: T.coldRuns }) },
  { id: 'claysweep', tier: 'Trick', name: 'Saucer Sweep', cond: 'Skeet, every goal saucer hit before it peaks', short: 'Skeet: every saucer before it peaks', met: (o) => o.ch.ladder === 'skeet' && o.run.misses === 0 && !o.run.lateClay && !o.run.decoyHits && o.run.hits >= o.run.list.filter((e) => !e.decoy).length },
  { id: 'walkline', tier: 'Trick', name: 'Walk the Line', cond: 'A horde cleared left to right, no miss', short: 'Horde left to right, no miss', met: (o) => o.run.walked },
  { id: 'bosskiller', tier: 'Gold', name: 'Monster Slayer', cond: 'Boss 1 three stars, every gun', met: (o) => at(o, 'b1') && three(o) && GUN_IDS.every((g) => o.bests.b1[g].stars === 3), count: (E) => ({ have: GUN_IDS.filter((g) => starsOf(E, chById('b1'), g) === 3).length, need: GUN_IDS.length }) },
  { id: 'gauntlet', tier: 'Gold', name: 'Training Montage', cond: 'A2, S2, K2, B1 in a row, two stars each', short: 'Four rungs in a row, two stars each', met: (o) => !!o.gauntletDone },
  { id: 'legend', tier: 'Gold', name: 'Legend', cond: 'Every challenge at three stars', met: (o) => CHALLENGES.every((c) => GUN_IDS.some((g) => o.bests[c.id][g].stars === 3)), count: (E) => ({ have: CHALLENGES.filter((c) => GUN_IDS.some((g) => starsOf(E, c, g) === 3)).length, need: CHALLENGES.length }) },
  { id: 'arsenal', tier: 'Gold', name: 'Arsenal', cond: 'Three stars on every challenge, every gun', short: 'Every challenge, three stars, every gun', met: (o) => CHALLENGES.every((c) => GUN_IDS.every((g) => o.bests[c.id][g].stars === 3)), count: (E) => ({ have: CHALLENGES.reduce((n, c) => n + GUN_IDS.filter((g) => starsOf(E, c, g) === 3).length, 0), need: CHALLENGES.length * GUN_IDS.length }) },
  { id: 'sniper', tier: 'Gold', name: 'Sniper', cond: `Boss 2, three stars, ${T.guns.rifle.short}`, met: (o) => at(o, 'b2') && three(o) && o.gun === 'rifle' },
];

// The four tiers on the missions screen, in the studio's trade (v0.6 C): the data's tier key and the name it goes by, lowest first.
const BADGE_TIERS = [{ key: 'Bronze', name: 'B-Movie' }, { key: 'Silver', name: 'Box Office' }, { key: 'Trick', name: 'Cult Classic' }, { key: 'Gold', name: 'Blockbuster' }];
// A badge's card line: the short form if it has one. A counter { have, need } only where an unearned badge counts something, else null.
const badgeLine = (b) => b.short || b.cond;
const badgeCount = (E, b) => (b.count ? b.count(E) : null);
// What a badge opens, in words: a gun, or a skin. Null when it opens nothing but itself.
function badgeOpens(b) {
  const gun = GUN_IDS.find((g) => T.unlockBadges[g] === b.id), skin = skinOfBadge(b.id);
  return gun ? `the ${T.guns[gun].name}` : skin ? `the ${T.guns[skin.gun].short} ${skin.skin.name} skin` : null;
}

// Badges a finished run earns that are not already `have`.
function newBadges(o) { return BADGES.filter((b) => b.met(o) && !o.have[b.id]).map((b) => b.id); }

// After a gauntlet stage: passes at two stars or better; done after the last stage.
function gauntletStep(i, stars) {
  const ok = stars >= 2, done = ok && i + 1 >= GAUNTLET.length;
  return { i, ok, done, next: ok && !done ? GAUNTLET[i + 1] : null };
}
function badgeMap(E) { const b = E.save.get('badges', {}); return b && typeof b === 'object' ? b : {}; }
// The badges already shown on the missions screen (v12): the dot on the menu's Missions button marks an earned badge that is not in it.
function seenMap(E) { const b = E.save.get('seen', {}); return b && typeof b === 'object' ? b : {}; }
function unseenBadges(E) { const have = badgeMap(E), seen = seenMap(E); return BADGES.filter((b) => have[b.id] && !seen[b.id]).map((b) => b.id); }

// ---------- Gun mastery (v0.5 N) ----------
// Per gun, lifetime counters in the save: shots, hits, bulls (Accuracy and Skeet bullseyes and boss-core bullseyes), heads (zombie brain hits) and plates (boss plates destroyed).
// Mastery is bulls plus heads; the tier and the bar come from it. The counters are the sums of the runs' own numbers, which the ledger's `result` lines carry.
const MASTERY_KEYS = ['shots', 'hits', 'bulls', 'heads', 'plates'];
const TIER_NAMES = ['Rookie', 'Trained', 'Signature', 'Legendary']; // v0.7 B: the gun's own tiers (Marksman, Expert, Master) no longer share names with the player's career ranks; the numbers behind them are unchanged
function masteryMap(E) { const m = E.save.get('mastery', {}); return m && typeof m === 'object' ? m : {}; }
function masteryOf(E, gun) {
  const e = masteryMap(E)[gun] || {}, o = {};
  for (const k of MASTERY_KEYS) o[k] = Number.isFinite(e[k]) && e[k] > 0 ? Math.floor(e[k]) : 0;
  o.hits = Math.min(o.hits, o.shots); // v0.5 O: a hit is a shot that hit (a v17 save may hold a sweep of a horde as several)
  return o;
}
// The tier a set of counters has reached (0 to 3), the score, the accuracy, the score of the next tier and how far to it. Master also needs the lifetime accuracy.
function masteryInfo(m) {
  const M = T.mastery, score = m.bulls + m.heads, acc = m.shots ? m.hits / m.shots : 0, at = [0, M.marksman, M.expert, M.master];
  const tier = score >= M.master && acc >= M.accuracy ? 3 : score >= M.expert ? 2 : score >= M.marksman ? 1 : 0, next = tier < 3 ? at[tier + 1] : null;
  return { score, acc, tier, next, frac: next === null ? 1 : clamp((score - at[tier]) / (next - at[tier]), 0, 1), accShort: tier === 2 && score >= M.master };
}
const tierOf = (E, gun) => masteryInfo(masteryOf(E, gun)).tier;

// ---------- Career (PRD v0.7 B, E): one rank for the player, and a premiere poster for every finished set ----------

// The lines of the story, as in docs/games/recoil/prd-v0.9.md. Every line is one sentence of about 60 characters at most.
const STORY = {
  open: ['Backlot 88 is broke. This film is its last chance.', "You're an extra. Your only line so far was a scream.", "'Kid. Take this one. It shoots straight.'"], // the three scenes of the cold open: the lot, the extras, Gus
  intern: ["You! Coffee, then set. Don't trip on the cables.", 'Told you it shoots straight.'], // Big Lou, then Gus
  turn: ['He walked. No star, no film, no studio.', '...Kid. Can you fall off a roof?'], // Stunt Double: both Big Lou
  ending: ["We're saved. You saved us.", 'Always said it shoots straight.'], // Action Star: Big Lou, then Gus
  note: [ // the director's note by career rank, then by the take's stars (the second line from TUNING.scenes.noteHigh)
    ["Cut! We can't afford many more takes.", 'The bank called. Again. Go again.'],
    ['Not bad. Not bad at all.', 'Keep that up and we might make payroll.'],
    ["The whole studio's riding on you, kid.", 'Print it! The bank can wait.'],
    ["That's my star.", "They're lining up round the block!"],
  ],
  gusStep: "Got you something special. Don't tell Lou.", // said once in the Prop Room after each career step
  premiere: "Premiere night! It's on the wall now.",
  coming: 'Coming soon',
  // Gus, the prop master, one line per gun, shown in the Prop Room for the gun that is selected.
  toughNote: 'tough with this gun',
  tough: 'Tough with this gun, kid. Steady hands, or bring the pistol.', // v0.8 D: Gus, on a rung tile that asks much more of this gun than of the pistol
  gus: {
    pistol: 'Buddy-Cop 9mm. Never jams. Well, hardly ever.',
    carbine: 'Pulse Rifle. Three sequels, two lawsuits. Careful.',
    shotgun: "Spin-Lever. Flip it like you mean it, don't dent it.",
    rifle: "Assassin's Scope. One shot, one very quiet set.",
    smg: 'One-Man Army. Eats props for breakfast. Mind the bill.',
    revolver: 'The .44. Big noise, bigger paperwork.',
  },
  posters: { accuracy: 'Screen Test: The Movie', speed: 'High Noon-ish', skeet: 'Saucers Over Burbank', boss: 'Rubber Suit Rampage', zombie: 'Night of the Extras', endless: 'The Overnight Shoot' },
  hint: { endless: (n) => `Reach wave ${n} in Endless to release it` },
};
const POSTER_SETS = ['accuracy', 'speed', 'skeet', 'boss', 'zombie', 'endless'];
const CAREER_MAX = CHALLENGES.length * GUN_IDS.length * 3;
// The stars a saved best holds for a gun on a rung (a plain save's `best`, as migrate sees it): the stars saved, or what its score earns now if that is more.
function starsInBest(best, ch, gun) { const e = best && best[ch.id] && best[ch.id][gun]; return e && typeof e === 'object' ? Math.max(e.stars || 0, starsFor(ch, e.score || 0, gun)) : 0; }
function careerStars(best) { return CHALLENGES.reduce((n, ch) => n + GUN_IDS.reduce((m, g) => m + starsInBest(best, ch, g), 0), 0); }
// The rank a star total reaches (an index into T.career.ranks).
function rankFor(n) { const R = T.career.ranks; let i = 0; while (i + 1 < R.length && n >= R[i + 1][1]) i++; return i; }
function careerInfo(E) {
  const n = careerStars(bests(E)), i = rankFor(n), R = T.career.ranks, nx = R[i + 1];
  return { n, rank: i, name: R[i][0], next: nx ? nx[0] : null, toNext: nx ? nx[1] - n : 0, frac: nx ? clamp((n - R[i][1]) / (nx[1] - R[i][1]), 0, 1) : 1 };
}
// The career step whose story scene is owed (1 Intern, 2 the turn, 3 the ending), else -1. One at a time, lowest first, so a save that is behind (a veteran, or a jump of two ranks) is caught up
// by one scene per result card and never a cascade. Each scene is marked seen as it shows (careerSeen is the Intern scene's, turnSeen and endSeen the others').
function pendingStory(E) {
  const r = careerInfo(E).rank;
  if (r >= 1 && E.save.get('careerSeen', 0) < 1) return 1;
  if (r >= 2 && !E.save.get('turnSeen', false)) return 2;
  if (r >= 3 && !E.save.get('endSeen', false)) return 3;
  return -1;
}
const STORY_SCENE = ['', 'intern', 'turn', 'ending']; // a career step's scene
// Has any one gun three-starred every rung of the set? (Endless has no stars; it is a wave.)
function threeStarred(best, set) { const list = CHALLENGES.filter((c) => c.ladder === set); return GUN_IDS.some((g) => list.every((c) => starsInBest(best, c, g) === 3)); }
function postersMap(E) { const m = E.save.get('posters', {}); return m && typeof m === 'object' ? m : {}; }
// After a run: the poster this run releases, if any (once per set). Returns the list of sets (zero or one).
function releasePosters(E, ch, wave) {
  const set = ch.endless ? (wave >= T.career.endlessWave ? 'endless' : null) : (threeStarred(bests(E), ch.ladder) ? ch.ladder : null);
  if (!set || postersMap(E)[set]) return [];
  E.save.update('posters', (m) => ({ ...(m && typeof m === 'object' ? m : {}), [set]: 1 }), {});
  E.ledger.add('poster', { set });
  return [set];
}

// The first text drawn at each weight and size makes the browser find and shape the font, which costs milliseconds in the first frame; draw it once, off screen, at start.
function warmText(ctx) {
  ctx.save(); ctx.textBaseline = 'middle';
  for (const w of [TY.normal, TY.strong]) for (const z of [TY.small, TY.mid, TY.mid + 2, TY.big, A.logo.title]) { ctx.font = `${w} ${z}px system-ui, sans-serif`; ctx.fillText('AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz 0123456789 %/:.,·', -4000, -4000); }
  ctx.restore();
}

// The counters a save without any gets from the ledger: the sums of its `result` lines' shots and hits, and of the bulls, heads and plates the lines carry (v0.5 N onward; older lines
// have only shots and hits, so an older save starts with those and zero for the rest). No ledger, zero.
function deriveMastery(E) {
  const out = {};
  for (const e of E.ledger.entries) {
    if (e.k !== 'result' || !e.d || !T.guns[e.d.gun]) continue;
    const m = out[e.d.gun] || (out[e.d.gun] = { shots: 0, hits: 0, bulls: 0, heads: 0, plates: 0 });
    for (const [key, field] of [['shots', 'shots'], ['bulls', 'bulls'], ['heads', 'heads'], ['plates', 'plates']]) if (Number.isFinite(e.d[field])) m[key] += Math.max(0, e.d[field]);
    if (Number.isFinite(e.d.baits)) m.shots = Math.max(0, m.shots - e.d.baits); // v0.8 C: a bait is no shot for the gun's accuracy
    const hs = Number.isFinite(e.d.hitShots) ? e.d.hitShots : e.d.hits; // older lines counted targets hit, which a sweep makes more than the shots
    if (Number.isFinite(hs)) m.hits += Math.max(0, Math.min(hs, Number.isFinite(e.d.shots) ? e.d.shots : hs));
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
const K_CARD = 1e6, K_FLAT = 2e6, K_CLAY = 3e6, K_PLATE = 4e6, K_CORE = 5e6, K_GUN = 6e6, K_DECOY = 7e6, K_FRAME = 8e6, K_EXTRA = 1.5e6;

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
// A badge medal: a disc in its tier's colour with a star, or a dull disc with a padlock while it is unearned.
function drawMedal(ctx, cx, cy, r, tier, earned) {
  ctx.lineWidth = 2; ctx.strokeStyle = earned ? P.ink : P.panelEdge;
  disc(ctx, cx, cy, r, earned ? P.tier[tier] : P.panel); ctx.stroke();
  if (earned) drawStar(ctx, cx, cy + 0.5, r * 0.62, P.ink); else drawLock(ctx, cx, cy, P.textDim);
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

// Generated art (ADR-0015, PRD v0.6 H): every gun and every skin is a picture (Pack 7), used everywhere the gun shows, in play too, and the title card. A picture shows once it has
// loaded; until then, and if it never does, the procedural drawing stands in. Nothing is hit-tested on the gun, so a picture's own silhouette changes no rule.
// GUN_PIC is measured from the pixels (PIL, on the shipped files): per gun `s` is game units per picture pixel and `gx` the grip's x in picture pixels (the picture's left edge sits where the
// drawn gun's left edge did, its barrel tip where the drawn muzzle was), and per file [name, tipX, tipY] is the opaque pixel furthest along the barrel, in picture pixels. The bore axis
// runs through the tip, so the picture hangs from the pivot by (gx, tipY), and the flash, the range finder and the shot's drawn origin start at (tipX - gx) * s.
const GUN_PIC = {
  pistol: { s: 0.2305, gx: 95.4, files: { std: ['gun-buddy-cop.webp', 269, 22], nickel: ['gun-buddy-cop-nickel.webp', 266, 15.9], blackout: ['gun-buddy-cop-blackout.webp', 269, 22], gold: ['gun-buddy-cop-gold.webp', 269, 19.2] } },
  carbine: { s: 0.2531, gx: 185.7, files: { std: ['gun-pulse-rifle.webp', 384, 50.9], desert: ['gun-pulse-rifle-desert.webp', 387, 56.9], arctic: ['gun-pulse-rifle-arctic.webp', 384, 54.6] } },
  shotgun: { s: 0.2524, gx: 266.4, files: { std: ['gun-spin-lever.webp', 512, 22.8], walnut: ['gun-spin-lever-walnut.webp', 512, 22.8], tactical: ['gun-spin-lever-tactical.webp', 512, 22.8] } },
  rifle: { s: 0.2515, gx: 246.5, files: { std: ['gun-assassins-scope.webp', 509, 45.3], carbon: ['gun-assassins-scope-carbon.webp', 509, 45.3], bronze: ['gun-assassins-scope-bronze.webp', 509, 45.3], ghost: ['gun-assassins-scope-ghost.webp', 509, 45.3] } },
  smg: { s: 0.3076, gx: 160.3, files: { std: ['gun-one-man-army.webp', 342, 32.3], brass: ['gun-one-man-army-brass.webp', 342, 29.2], hazard: ['gun-one-man-army-hazard.webp', 321, 42.1] } },
  revolver: { s: 0.2082, gx: 91.3, files: { std: ['gun-make-my-day.webp', 370, 29.9], ivory: ['gun-make-my-day-ivory.webp', 372, 22.6], frost: ['gun-make-my-day-frost.webp', 370, 29.9] } },
};
const ART_FILES = { title: 'title-backlot88.png', master: 'prop-master.webp', masterSold: 'prop-master-sold.webp' }, PICS = {}, ART_IMG = {};
GUN_IDS.forEach((id, gi) => {
  const g = GUN_PIC[id];
  Object.entries(g.files).forEach(([sk, [file, tx, ty]], si) => {
    const key = sk === 'std' ? id : `${id}-${sk}`;
    ART_FILES[key] = file;
    PICS[key] = { key, idx: gi * SKIN_SLOTS + si, s: g.s, gx: g.gx, ty, muzzle: (tx - g.gx) * g.s };
  });
});
// v0.7 E2: the director (shouting, approving) and the six premiere posters come from the Artist (Pack 9). A missing or blocked file leaves the drawn fallback (a megaphone for the director, a coloured
// card for a poster). Null means no picture, so nothing is requested.
const STORY_ART = { director: 'director.webp', directorApprove: 'director-approve.webp', 'poster-accuracy': 'poster-accuracy.webp', 'poster-speed': 'poster-speed.webp', 'poster-skeet': 'poster-skeet.webp', 'poster-boss': 'poster-boss.webp', 'poster-zombie': 'poster-zombies.webp', 'poster-endless': 'poster-endless.webp' };
for (const [id, file] of Object.entries(STORY_ART)) if (file) ART_FILES[id] = file;
function loadArtImages() {
  if (typeof Image === 'undefined') return;
  for (const [id, file] of Object.entries(ART_FILES)) {
    const im = new Image();
    im.onload = () => { if (im.naturalWidth) ART_IMG[id] = im; };
    im.src = `assets/${file}`;
  }
}
// The loaded picture for a gun in a skin (an unknown skin is the standard one), or null while it is missing.
function picOf(id, skin) {
  const g = GUN_PIC[id];
  if (!g) return null;
  const p = PICS[skin && skin !== 'std' && g.files[skin] ? `${id}-${skin}` : id];
  return ART_IMG[p.key] ? p : null;
}
// The drawn barrel tip's distance from the grip: the picture's, else the drawn gun's.
function muzzleOf(id, skin) { const p = picOf(id, skin); return p ? p.muzzle : gunArt(id, skin).muzzle; }
// The picture contained in a w x h box, centred at cx, cy; false when it has not loaded. `crop` is a source rectangle in fractions of the image.
// `snap` draws it unscaled-transform at whole device pixels (a plain copy for the raster) when the view is not turned.
function drawArtImage(ctx, id, cx, cy, w, h, crop, snap) {
  const im = ART_IMG[id];
  if (!im) return false;
  const sx = crop ? crop[0] * im.naturalWidth : 0, sy = crop ? crop[1] * im.naturalHeight : 0, sw = crop ? crop[2] * im.naturalWidth : im.naturalWidth, sh = crop ? crop[3] * im.naturalHeight : im.naturalHeight;
  const k = Math.min(w / sw, h / sh), dw = sw * k, dh = sh * k;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  const m = snap ? ctx.getTransform() : null;
  if (m && m.b === 0 && m.c === 0) {
    const x0 = Math.round(m.e + (cx - dw / 2) * m.a), y0 = Math.round(m.f + (cy - dh / 2) * m.d);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(im, sx, sy, sw, sh, x0, y0, Math.round(m.e + (cx + dw / 2) * m.a) - x0, Math.round(m.f + (cy + dh / 2) * m.d) - y0);
    ctx.restore();
  } else ctx.drawImage(im, sx, sy, sw, sh, cx - dw / 2, cy - dh / 2, dw, dh);
  return true;
}

// Every gun drawn at one scale, so sizes stay honest, centred on its own bounds inside a w x h box: its picture in the skin it wears, else the procedural gun.
function drawGunTile(ctx, id, cx, cy, w, h, skin) {
  if (drawArtImage(ctx, skin && skin !== 'std' && GUN_PIC[id] && GUN_PIC[id].files[skin] ? `${id}-${skin}` : id, cx, cy, w, h, null, true)) return;
  const ga = gunArt(id, skin), k = Math.min(w / GUN_BOX.w, h / GUN_BOX.h);
  drawGunArt(ctx, ga, cx - ((ga.x0 + ga.x1) / 2) * k, cy - ((ga.y0 + ga.y1) / 2) * k, k, 0, false);
}

// The gun is one sprite cut to its own bounds (outline and shadow included), turned about the grip at draw time.
const GUN_PAD = 6;
function paintGun(g, ga) { drawGunArt(g, ga, 0, 0, 1, 0, true); }
// A picture gun: one sprite resized once to the screen's pixels, hung from the pivot at whole pixels and turned about it. Without offscreen canvases it is drawn straight.
function drawGunPic(ctx, run, p) {
  const im = ART_IMG[p.key], a = angleOf(run) * DEG, m = ctx.getTransform();
  if (!SPR_K || typeof OffscreenCanvas === 'undefined') {
    ctx.save(); ctx.translate(T.gunX, run.gunY); ctx.rotate(-a); ctx.scale(p.s, p.s); ctx.drawImage(im, -p.gx, -p.ty); ctx.restore();
    return;
  }
  const key = K_GUN + 100 + p.idx, k = (SPR_K / 100) * p.s;
  let s = SPR.get(key);
  if (s === undefined) {
    const cv = new OffscreenCanvas(Math.max(1, Math.round(im.naturalWidth * k)), Math.max(1, Math.round(im.naturalHeight * k))), g = cv.getContext('2d');
    s = null;
    if (g) { g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, cv.width, cv.height); s = cv; }
    SPR.set(key, s);
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, Math.round(m.e + T.gunX * m.a), Math.round(m.f + run.gunY * m.d)); ctx.rotate(-a);
  if (s) ctx.drawImage(s, -Math.round(p.gx * k), -Math.round(p.ty * k)); else ctx.drawImage(im, -p.gx * k, -p.ty * k, im.naturalWidth * k, im.naturalHeight * k);
  ctx.restore();
}
function drawGun(ctx, run) {
  const p = picOf(run.gun.id, S.skin);
  if (p) { drawGunPic(ctx, run, p); return; }
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
  const F = A.flash, a = angleOf(run) * DEG, m = muzzleOf(run.gun.id, S.skin), life = f.t / f.max, s = F.from + (1 - F.from) * (1 - life);
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

// A cut-out (v0.6 A): a round kraft board exactly the size of what scores (the hit radius is the rings plus the card pad), the three printed rings on it (cyan and white for the
// goal, unchanged from v0.5), and a costume painted over its top and bottom, clipped to the board: a villain's fedora and moustache (look 0, Accuracy), an extra's cowboy hat
// and bandana (look 1, Speed). The hat covers only the outer ring's top, which scores as outer; the inner ring and the bullseye are never covered. A horde member is small:
// the board, two rings and a hat, no shadow. Returns nothing; the board's radius is (zoneR[2] + card.pad) * sc.
function drawCard(ctx, x, y, sc, bullMul, flat, look) {
  const R = T.zoneR, C = A.card, r2 = R[2] * sc, half = r2 + C.pad * sc, lw = Math.max(1.5, A.line * Math.min(1, sc + 0.25)), cow = flat || look === 1;
  ctx.lineJoin = 'round';
  if (!flat) disc(ctx, x + A.shadowX, y + A.shadowY, half, P.shadow);
  disc(ctx, x, y, half, P.kraft);
  ctx.lineWidth = C.ringLine; ctx.strokeStyle = P.inkSoft;
  if (flat) { disc(ctx, x, y, r2, P.slate); disc(ctx, x, y, R[1] * sc, P.cyan); }
  else { ringDisc(ctx, x, y, r2, P.slate); ringDisc(ctx, x, y, R[1] * sc, P.cyan); ringDisc(ctx, x, y, R[0] * sc * bullMul, P.white); }
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, half, 0, PI2); ctx.clip();
  const h = half, top = y - h, brim = y - h * 0.62, low = y + R[1] * sc; // the brim's top edge sits above the inner ring's top (0.52 of the board)
  ctx.fillStyle = cow ? P.cowboy : P.villain;
  ctx.beginPath(); ctx.moveTo(x - h * 0.56, brim); ctx.lineTo(x - h * 0.5, top); ctx.lineTo(x + h * 0.5, top); ctx.lineTo(x + h * 0.56, brim); ctx.closePath(); ctx.fill(); // the crown
  if (cow) { ctx.fillStyle = P.kraftDark; ctx.beginPath(); ctx.moveTo(x - h * 0.14, top); ctx.lineTo(x, top + h * 0.14); ctx.lineTo(x + h * 0.14, top); ctx.closePath(); ctx.fill(); } // the crease
  ctx.fillStyle = cow ? P.cowboyBand : P.villainBand; ctx.fillRect(x - h * 0.55, brim - h * 0.12, h * 1.1, h * 0.08); // the band
  ctx.fillStyle = cow ? P.cowboy : P.villain; ctx.fillRect(x - h, brim, h * 2, h * 0.08); // the brim, across the board
  if (!flat) {
    if (cow) { ctx.fillStyle = P.bandana; ctx.beginPath(); ctx.moveTo(x - h, low + h * 0.2); ctx.lineTo(x + h, low + h * 0.2); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill(); } // the bandana
    else { // the moustache, under the inner ring
      ctx.fillStyle = P.ink; const my = low + h * 0.14;
      ctx.beginPath(); ctx.ellipse(x - h * 0.17, my, h * 0.2, h * 0.07, 0.25, 0, PI2); ctx.ellipse(x + h * 0.17, my, h * 0.2, h * 0.07, -0.25, 0, PI2); ctx.fill();
    }
  }
  ctx.restore();
  ctx.strokeStyle = P.ink; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(x, y, half, 0, PI2); ctx.stroke();
}

function paintCard(g, sc, flat) { drawCard(g, 0, 0, sc, 1, flat, 0); }
function paintExtra(g, sc) { drawCard(g, 0, 0, sc, 1, false, 1); }

// The stand of a still cut-out: a wooden post down to a small dolly on the Screen Test's track. Drawn before the board, which hides its top.
function drawPost(ctx, x, top) {
  const C = A.card, base = HORIZON;
  if (base - top < 6) return;
  ctx.fillStyle = P.woodDark; ctx.strokeStyle = P.ink; ctx.lineWidth = A.line * 0.8;
  ctx.fillRect(x - C.post / 2, top - 2, C.post, base - top - 4); ctx.strokeRect(x - C.post / 2, top - 2, C.post, base - top - 4);
  ctx.fillStyle = P.steelDark; rrect(ctx, x - C.foot / 2 - 3, base - 8, C.foot + 6, 5, 2); ctx.fill(); ctx.stroke();
  disc(ctx, x - C.foot / 2, base - 1, 2.6, P.steel); ctx.stroke(); disc(ctx, x + C.foot / 2, base - 1, 2.6, P.steel); ctx.stroke();
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

// A flying saucer on a wire (v0.6 A), in the goal colour: a cyan hull exactly the hit radius, a ring of rim lights, the paper dome and the white bullseye at its centre (the
// clay's zones of v0.5, unchanged). A decoy (Skeet 3) is the same saucer in the player's orange with a dark cross where the bullseye would be: shape as well as colour tells it apart.
function paintClay(g, sc) { drawClay(g, 0, 0, sc, false); }
function paintDecoy(g, sc) { drawClay(g, 0, 0, sc, true); }
function drawClay(ctx, x, y, sc, decoy) {
  const C = A.clay, S2 = A.saucer, r = T.zoneR[1] * sc;
  ctx.lineJoin = 'round';
  disc(ctx, x + A.shadowX, y + A.shadowY, r, P.shadow);
  ctx.fillStyle = decoy ? P.orange : P.cyan; ctx.strokeStyle = P.ink; ctx.lineWidth = A.line * Math.min(1, sc + 0.3);
  ctx.beginPath(); ctx.arc(x, y, r, 0, PI2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = P.inkSoft; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, r * (1 - S2.band), 0, PI2); ctx.stroke();
  ctx.fillStyle = decoy ? P.orangeLight : P.white; ctx.beginPath();
  for (let i = 0; i < S2.lights; i++) { const a = (i * PI2) / S2.lights + Math.PI / S2.lights, lx = x + Math.cos(a) * r * (1 - S2.band / 2), ly = y + Math.sin(a) * r * (1 - S2.band / 2); ctx.moveTo(lx + r * S2.lightR, ly); ctx.arc(lx, ly, r * S2.lightR, 0, PI2); }
  ctx.fill();
  ctx.strokeStyle = P.inkSoft; ctx.lineWidth = C.rimLine; ringDisc(ctx, x, y, r * C.disc * (1 - S2.band), decoy ? P.orangeLight : P.paper);
  ctx.strokeStyle = P.highlight; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r * 0.45, Math.PI * 1.05, Math.PI * 1.45); ctx.stroke();
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
      drawTrolley(ctx, tg.x, tg.y, half, sc, tg.kind === 'approach'); drawSprite(ctx, K_EXTRA + Math.round(sc * 100), half + 6, paintExtra, tg.x, tg.y, sc, 0); break;
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
        const first = run.shots === 0, pw = first ? 0.5 + 0.5 * Math.sin(E.time * K.pulse) : 0; // v0.8 C: the first dodger's ring pulses until the first shot says what it is
        ctx.strokeStyle = P.ink; ctx.lineWidth = K.ringWidth + 2 + pw * K.pulseGrow; ctx.setLineDash(DODGE_DASH); ctx.beginPath(); ctx.arc(tg.x, tg.y, rd + pw * K.pulseGrow, 0, PI2); ctx.stroke();
        ctx.strokeStyle = first ? P.orangeLight : P.orange; ctx.lineWidth = K.ringWidth + pw * K.pulseGrow; ctx.beginPath(); ctx.arc(tg.x, tg.y, rd + pw * K.pulseGrow, 0, PI2); ctx.stroke(); ctx.setLineDash(NO_DASH);
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
// The fence (v0.6: the horror set's picket fence) at the near edge of the field, red when a zombie is close. The sim ends the run when one touches it; this is only its look.
function drawFence(ctx, run) {
  const Z = T.zombie, fx = Z.fenceX, top = 196, bot = HORIZON + 4;
  let near = 1e9; for (const z of run.zs) near = Math.min(near, z.x - zReach(z) - fx);
  ctx.lineJoin = 'round'; ctx.lineWidth = 1.8; ctx.strokeStyle = P.ink;
  ctx.fillStyle = P.picketDark; for (const y of [top + 22, top + 64]) { ctx.fillRect(fx - 13, y, 26, 5); ctx.strokeRect(fx - 13, y, 26, 5); } // two rails
  for (let i = 0; i < 3; i++) { // three pickets with pointed tops
    const x = fx - 11 + i * 8, h = i === 1 ? 0 : 6;
    ctx.fillStyle = P.picket; ctx.beginPath(); ctx.moveTo(x, bot); ctx.lineTo(x, top + h + 6); ctx.lineTo(x + 3, top + h); ctx.lineTo(x + 6, top + h + 6); ctx.lineTo(x + 6, bot); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  if (near < 140) { ctx.globalAlpha = 0.5 * (1 - Math.max(0, near) / 140); ctx.fillStyle = P.red; ctx.fillRect(fx - 13, top, 26, bot - top); ctx.globalAlpha = 1; } // danger
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
  const d0 = muzzleOf(run.gun.id, S.skin) + F.gap, d1 = rangeLen(run), n = T.rangeDots, nb = F.ramp;
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

// A hit saucer (v0.6 A) drops off its wire, turning, and fades; the sparks and a headshot's make-up squib are short bursts of dots under gravity (cosmetic: Math.random).
function drawDrop(ctx, f) {
  const u = f.max - f.t, x = f.x + f.vx * u, y = f.y + f.vy * u + 0.5 * A.saucer.fall * u * u, r = T.zoneR[1] * f.sc;
  ctx.save(); ctx.globalAlpha = clamp(f.t / f.max * 1.6, 0, 1); ctx.translate(x, y); ctx.rotate(f.spin * u);
  drawSprite(ctx, (f.decoy ? K_DECOY : K_CLAY) + Math.round(f.sc * 100), r + 6, f.decoy ? paintDecoy : paintClay, 0, 0, f.sc, 0);
  ctx.restore();
}
function drawBurst(ctx, f) {
  const u = f.max - f.t, a = clamp(f.t / f.max, 0, 1);
  ctx.globalAlpha = a;
  for (const d of f.dots) { ctx.fillStyle = d.c; ctx.beginPath(); ctx.arc(f.x + d.vx * u, f.y + d.vy * u + 0.5 * f.g * u * u, d.r, 0, PI2); ctx.fill(); }
  ctx.globalAlpha = 1;
}
function burst(x, y, n, speed, rads, cols, life, g) {
  const dots = [];
  for (let i = 0; i < n; i++) { const a = Math.random() * PI2, v = rnd(speed); dots.push({ vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed[0] * 0.5, r: rnd(rads), c: cols[i % cols.length] }); }
  return { x, y, dots, g, t: life, max: life };
}
// The clapperboard (v0.6 A): "Action!" as a run starts and "Cut!" as it ends, in screen px over the middle of the field. The stick snaps shut in the first moment and the board
// fades at the end; it is a picture only, so input runs under it and the timers never wait for it.
function drawClapper(E, v, clap) {
  const K = A.clap, age = E.time - clap.t0;
  if (age < 0 || age >= K.life) return;
  const ctx = E.ctx, a = age > K.life - K.fade ? (K.life - age) / K.fade : 1, cx = v.ox + v.w / 2, cy = v.oy + v.h * K.y, x = cx - K.w / 2, y = cy - K.h / 2 + K.stick / 2;
  const shut = clamp(age / K.snap, 0, 1), ang = -0.5 * (1 - ease.outQuad(shut));
  ctx.save(); ctx.globalAlpha = a; ctx.lineJoin = 'round';
  ctx.fillStyle = P.shadow; rrect(ctx, x + A.shadowX, y + A.shadowY, K.w, K.h - K.stick, 6); ctx.fill();
  ctx.fillStyle = P.stageLow; ctx.strokeStyle = P.text; ctx.lineWidth = 2; rrect(ctx, x, y, K.w, K.h - K.stick, 6); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = P.textFaint; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 8, y + K.h - K.stick - 12); ctx.lineTo(x + K.w - 8, y + K.h - K.stick - 12); ctx.stroke();
  const stripes = (sy) => { // the black and white bars of a clapper stick, clipped to it
    ctx.fillStyle = P.stageLow; rrect(ctx, x, sy, K.w, K.stick, 3); ctx.fill(); ctx.save(); rrect(ctx, x, sy, K.w, K.stick, 3); ctx.clip();
    ctx.fillStyle = P.text; for (let k = -1; k < 8; k++) { const bx = x + k * 22; ctx.beginPath(); ctx.moveTo(bx, sy + K.stick); ctx.lineTo(bx + 11, sy); ctx.lineTo(bx + 22, sy); ctx.lineTo(bx + 11, sy + K.stick); ctx.closePath(); ctx.fill(); }
    ctx.restore(); ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5; rrect(ctx, x, sy, K.w, K.stick, 3); ctx.stroke();
  };
  stripes(y - K.stick);
  ctx.save(); ctx.translate(x, y - K.stick); ctx.rotate(ang); ctx.translate(-x, -(y - K.stick)); stripes(y - 2 * K.stick - 1); ctx.restore();
  ctx.restore();
  E.text(clap.text, cx, y + (K.h - K.stick) / 2 - 3, { size: TY.mid + 2, weight: TY.strong, color: P.text, alpha: a });
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

// ---- The sets (v0.6 A): each mode is a soundstage on the Backlot 88 lot. A set is painted once per screen scale into an offscreen image and drawn with one blit a frame (only the
// fog and the saucers' wires move). Everything here is set dressing: nothing on a set is a target or uses a target's colour, and the band the targets use stays near black. ----

// Which set a run plays on: the ladder's, Boss 1's monster, Boss 2's robot, and the night shoot for Endless.
function setOf(ch) { return ch.endless ? 'night' : ch.ladder === 'boss' ? (ch.wall ? 'robot' : 'monster') : A.set[ch.ladder]; }
const SET_IMG = { key: null, k: 0, cv: null };
// A soft glow: a radial gradient disc (only ever painted into a cached set image).
function glow(g, x, y, r, col) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
// A rim light: the path stroked in a neon colour at part strength.
function rim(g, col, a, w) { g.save(); g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = w; g.stroke(); g.restore(); }
// The stage: black walls, the lighting truss with its lamps and faint beams (strongest above the target band), and the floor.
function paintStage(g, floorCol) {
  const W = T.designW, H = T.designH, hz = HORIZON, K = A.sets.truss;
  g.fillStyle = P.stage; g.fillRect(0, 0, W, hz);
  for (let x = K.lamps / 2, i = 0; x < W; x += K.lamps, i++) { // beams first, so the truss sits over their tops
    const gr = g.createLinearGradient(0, K.y + K.h, 0, 150); gr.addColorStop(0, i % 2 ? P.tealGlow : P.pinkGlow); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(x - K.lampW / 2, K.y + K.h + K.lampH); g.lineTo(x + K.lampW / 2, K.y + K.h + K.lampH); g.lineTo(x + 46, 150); g.lineTo(x - 46, 150); g.closePath(); g.fill();
  }
  g.fillStyle = P.truss; g.fillRect(0, K.y, W, K.h);
  g.strokeStyle = P.stageHi; g.lineWidth = 1.5; g.beginPath();
  for (let x = 0; x < W; x += 14) { g.moveTo(x, K.y); g.lineTo(x + 7, K.y + K.h); g.lineTo(x + 14, K.y); }
  g.stroke();
  for (let x = K.lamps / 2; x < W; x += K.lamps) { g.fillStyle = P.lamp; rrect(g, x - K.lampW / 2, K.y + K.h, K.lampW, K.lampH, 3); g.fill(); g.fillStyle = P.stageLow; g.fillRect(x - K.lampW / 2 + 3, K.y + K.h + K.lampH - 3, K.lampW - 6, 3); }
  g.fillStyle = floorCol || P.floor; g.fillRect(0, hz, W, H - hz);
  g.fillStyle = P.floorLine; g.fillRect(0, hz - 1, W, 2);
  g.fillStyle = P.shadow; g.fillRect(0, hz + 1, W, 5);
}
function paintScreen(g) { // Screen test: a painted city on a flat, a camera on a dolly, a dolly track on the floor
  const S2 = A.sets.screen, hz = HORIZON, top = 44, base = hz - 22;
  paintStage(g);
  g.fillStyle = P.city; g.fillRect(8, top, T.designW - 16, base - top); // the flat, its painted night sky
  disc(g, S2.moon[0], S2.moon[1], S2.moon[2], P.moon);
  S2.skyline.forEach(([x, y, w], i) => {
    g.fillStyle = i % 2 ? P.cityHi : P.stageHi; g.fillRect(x, y, w, base - y);
    const [wx, wy, gx, gy] = S2.win;
    for (let yy = y + 8; yy < base - 10; yy += gy) for (let xx = x + 6; xx < x + w - wx; xx += gx) { g.fillStyle = (xx * 7 + yy * 3) % 11 === 0 ? P.cityLit : P.cityWin; g.fillRect(xx, yy, wx, wy * 0.6); }
  });
  g.fillStyle = P.stageLow; g.fillRect(8, base - 6, T.designW - 16, 6);
  g.strokeStyle = P.floorLine; g.lineWidth = 2; g.strokeRect(8, top, T.designW - 16, base - top); // the flat's frame
  g.beginPath(); g.moveTo(8, top); g.lineTo(T.designW - 8, top); rim(g, P.neonPink, 0.55, 2);
  g.fillStyle = P.floorLine; for (let x = 168; x < T.designW - 20; x += 160) g.fillRect(x, top, 1.5, base - top); // seams between the flats
  // the camera on its dolly, facing the targets' side
  const [cx, cy] = S2.camera;
  g.fillStyle = P.stageHi; g.strokeStyle = P.floorLine; g.lineWidth = 1.5;
  rrect(g, cx - 4, cy - 30, 40, 26, 4); g.fill(); g.stroke();
  disc(g, cx + 4, cy - 40, 11, P.stageHi); g.stroke(); disc(g, cx + 26, cy - 40, 11, P.stageHi); g.stroke(); // the film reels
  rrect(g, cx - 18, cy - 24, 16, 14, 3); g.fill(); g.stroke(); // the lens hood
  g.beginPath(); g.moveTo(cx + 16, cy - 4); g.lineTo(cx + 8, hz - 10); g.moveTo(cx + 16, cy - 4); g.lineTo(cx + 26, hz - 10); g.lineWidth = 3; g.stroke();
  rrect(g, cx - 6, hz - 12, 46, 6, 2); g.fill(); disc(g, cx, hz - 4, 4, P.lamp); disc(g, cx + 34, hz - 4, 4, P.lamp);
  g.beginPath(); g.moveTo(cx + 36, cy - 30); g.lineTo(cx + 36, cy - 4); rim(g, P.neonTeal, 0.6, 2);
  // the dolly track the cut-outs stand on
  g.fillStyle = P.truss; for (let x = 4; x < T.designW; x += S2.tie) g.fillRect(x, hz + 1, 8, S2.track + 2);
  g.fillStyle = P.lamp; g.fillRect(0, hz, T.designW, 2); g.fillRect(0, hz + S2.track, T.designW, 2);
}
function paintWestern(g) { // Western street: a painted dusk, a mesa, a water tower, false-front buildings, a boardwalk
  const S2 = A.sets.western, hz = HORIZON, walkTop = hz - S2.walk;
  paintStage(g, P.boardwalk);
  g.fillStyle = P.duskHi; g.fillRect(8, 60, T.designW - 16, walkTop - 60);
  g.fillStyle = P.mesa; g.beginPath(); g.moveTo(8, walkTop); S2.mesa.forEach(([x, y]) => g.lineTo(clamp(x, 8, T.designW - 8), y)); g.lineTo(T.designW - 8, walkTop); g.closePath(); g.fill();
  const [tx, ty] = S2.tower; // the water tower behind the street
  g.fillStyle = P.stageHi; g.fillRect(tx - 18, ty + 34, 3, 60); g.fillRect(tx + 15, ty + 34, 3, 60); rrect(g, tx - 24, ty, 48, 36, 6); g.fill();
  S2.fronts.forEach(([x, y, w], i) => {
    const sign = y - 22;
    g.fillStyle = i % 2 ? P.facadeHi : P.facade; g.fillRect(x, y, w, walkTop - y); rrect(g, x + w * 0.18, sign, w * 0.64, 24, 3); g.fill();
    g.fillStyle = P.stageLow; for (let yy = y + 6; yy < walkTop; yy += 9) g.fillRect(x, yy, w, 1); // the clapboards
    g.beginPath(); rrPath(g, x + w * 0.18, sign, w * 0.64, 24, 3); rim(g, i % 2 ? P.neonTeal : P.neonPink, 0.55, 1.8);
    const [ww, wh] = S2.win, [dw, dh] = S2.door;
    g.fillStyle = P.facadeWin; g.fillRect(x + w * 0.22 - ww / 2, y + 22, ww, wh); g.fillRect(x + w * 0.78 - ww / 2, y + 22, ww, wh);
    g.fillRect(x + w / 2 - dw / 2, walkTop - dh, dw, dh);
    g.fillStyle = P.facadeHi; g.fillRect(x + w / 2 - dw / 2 + 3, walkTop - dh + 16, dw / 2 - 4, 22); g.fillRect(x + w / 2 + 1, walkTop - dh + 16, dw / 2 - 4, 22); // the swing doors
  });
  g.fillStyle = P.facadeHi; g.fillRect(0, walkTop, T.designW, 3);
  g.fillStyle = P.stageLow; for (let x = 0; x < T.designW; x += 22) g.fillRect(x, walkTop + 3, 1.5, S2.walk - 3);
}
function paintScifi(g) { // B-movie sci-fi: a starfield flat, a painted ringed planet and a moon, rocket-spire flats, a grated floor
  const S2 = A.sets.scifi, hz = HORIZON, rng = makeRng(88);
  paintStage(g);
  g.fillStyle = P.space; g.fillRect(8, 40, T.designW - 16, hz - 40);
  g.fillStyle = P.starDot; for (let i = 0; i < S2.stars; i++) { const r = rng() < 0.2 ? 1.3 : 0.8; g.fillRect(rng.range(10, T.designW - 10), rng.range(42, hz - 8), r, r); }
  const [px, py, pr] = S2.planet, [rk, rh] = S2.ring;
  g.strokeStyle = P.planetRing; g.lineWidth = 5; g.beginPath(); g.ellipse(px, py, pr * rk, pr * rh, -0.25, Math.PI, PI2); g.stroke(); // the ring's far half
  disc(g, px, py, pr, P.planet);
  g.save(); g.beginPath(); g.arc(px, py, pr, 0, PI2); g.clip(); disc(g, px - pr * 0.35, py - pr * 0.3, pr * 0.8, P.planetHi); disc(g, px - pr * 0.1, py - pr * 0.05, pr * 0.72, P.planet); g.restore();
  g.beginPath(); g.arc(px, py, pr, -0.4, 1.3); rim(g, P.neonTeal, 0.5, 2);
  g.strokeStyle = P.planetRing; g.lineWidth = 5; g.beginPath(); g.ellipse(px, py, pr * rk, pr * rh, -0.25, 0, Math.PI); g.stroke(); // the near half
  const [mx, my, mr] = S2.moon; disc(g, mx, my, mr, P.planetHi); disc(g, mx - 4, my - 3, 3, P.planet); disc(g, mx + 5, my + 4, 2.4, P.planet);
  S2.spires.forEach(([x, w, h]) => { // rocket-shaped flats on the floor line
    g.fillStyle = P.stageHi; g.beginPath(); g.moveTo(x - w / 2, hz); g.lineTo(x - w / 4, hz - h * 0.8); g.lineTo(x, hz - h); g.lineTo(x + w / 4, hz - h * 0.8); g.lineTo(x + w / 2, hz); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(x, hz - h); g.lineTo(x + w / 4, hz - h * 0.8); g.lineTo(x + w / 2, hz); rim(g, P.neonPink, 0.45, 1.6);
  });
  g.fillStyle = P.stageHi; for (let x = 0; x < T.designW; x += S2.grate) g.fillRect(x, hz + 2, 1.5, T.designH - hz);
}
function paintMonster(g) { // the monster stage: a rubber-suit kaiju (zipper up its back) over a model city; its plates and core are its exposed machinery
  const M = A.sets.monster, hz = HORIZON, x = M.x, w = M.w, t = M.top;
  paintStage(g);
  const body = new Path2D(); // the head leans toward the gun, the tail curls to the right
  body.moveTo(x - w * 0.3, hz); body.lineTo(x - w * 0.42, t + 150); body.quadraticCurveTo(x - w * 0.5, t + 70, x - w * 0.32, t + 42); body.lineTo(x - w * 0.46, t + 30); body.quadraticCurveTo(x - w * 0.5, t + 6, x - w * 0.24, t);
  body.quadraticCurveTo(x - w * 0.02, t - 4, x + w * 0.06, t + 30); body.quadraticCurveTo(x + w * 0.44, t + 60, x + w * 0.46, t + 170); body.quadraticCurveTo(x + w * 0.62, hz - 20, x + w * 0.7, hz - 6); body.lineTo(x + w * 0.4, hz); body.closePath();
  g.fillStyle = P.kaiju; g.fill(body);
  for (let i = 0; i < M.spines; i++) { const k = i / (M.spines - 1), sx = x + w * (0.04 + 0.4 * k), sy = t + 26 + 120 * k * k; g.fillStyle = P.kaijuHi; g.beginPath(); g.moveTo(sx - 9, sy + 6); g.lineTo(sx + 12, sy - 14); g.lineTo(sx + 8, sy + 12); g.closePath(); g.fill(); }
  g.fillStyle = P.kaijuHi; rrect(g, x - w * 0.3, t + 120, w * 0.4, hz - t - 130, 30); g.fill(); // the belly
  g.strokeStyle = P.kaiju; g.lineWidth = 2; for (let y = t + 136; y < hz - 20; y += 16) { g.beginPath(); g.moveTo(x - w * 0.28, y); g.lineTo(x + w * 0.08, y); g.stroke(); }
  g.strokeStyle = P.zipper; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x + w * 0.2, t + 50); g.quadraticCurveTo(x + w * 0.38, t + 110, x + w * 0.4, hz - 30); g.stroke(); // the zipper
  for (let i = 0; i < M.zip; i++) { const k = i / (M.zip - 1), zx = x + w * (0.2 + 0.2 * Math.sqrt(k)), zy = t + 50 + (hz - 80 - t) * k; g.fillStyle = P.zipper; g.fillRect(zx - 3, zy, 6, 1.6); }
  const [ex, ey, er] = M.eye; disc(g, x + ex, t + ey, er, P.eyeDim); disc(g, x + ex, t + ey, er * 0.45, P.neonPink); // one eye, lit pink
  g.beginPath(); g.moveTo(x - w * 0.46, t + 36); g.lineTo(x - w * 0.3, t + 40); g.strokeStyle = P.stageLow; g.lineWidth = 2; g.stroke(); // the jaw line
  g.save(); g.beginPath(); g.rect(0, 0, x - w * 0.1, hz); g.clip(); g.lineWidth = 3; g.strokeStyle = P.neonPink; g.globalAlpha = 0.5; g.stroke(body); g.restore(); // pink from the left
  g.save(); g.beginPath(); g.rect(x + w * 0.1, 0, T.designW, hz); g.clip(); g.lineWidth = 3; g.strokeStyle = P.neonTeal; g.globalAlpha = 0.45; g.stroke(body); g.restore(); // teal from the right
  [[x - w * 0.62, 22, 40], [x - w * 0.48, 16, 26], [x + w * 0.5, 20, 34], [x + w * 0.62, 14, 22], [x - w * 0.78, 18, 30]].forEach(([bx, bw, bh]) => { // the model city at its feet
    g.fillStyle = P.cityHi; g.fillRect(bx - bw / 2, hz - bh, bw, bh); g.fillStyle = P.cityWin; for (let yy = hz - bh + 4; yy < hz - 4; yy += 7) g.fillRect(bx - bw / 2 + 3, yy, bw - 6, 2);
  });
}
function paintRobot(g) { // the animatronic robot of Boss 2: the Bunker's plates sit in its chest and the core is its heart; cables hang from the truss
  const R2 = A.sets.robot, hz = HORIZON, x = R2.x, w = R2.w, t = R2.top, l = x - w / 2, r = x + w / 2;
  paintStage(g);
  g.strokeStyle = P.stageHi; g.lineWidth = 2.5; g.beginPath(); for (const cx of [l + 30, x + R2.head, r - 30]) { g.moveTo(cx, A.sets.truss.y + A.sets.truss.h); g.quadraticCurveTo(cx + 12, t + 10, cx, t + 36); } g.stroke();
  const hx = x + R2.head; // the head sits left of the middle, clear of the HUD's corner
  g.fillStyle = P.robot; rrect(g, hx - 40, t, 80, 44, 10); g.fill();
  const [vw, vh] = R2.visor; g.fillStyle = P.robotHi; rrect(g, hx - vw / 2, t + 14, vw, vh, 5); g.fill(); g.beginPath(); rrPath(g, hx - vw / 2, t + 14, vw, vh, 5); rim(g, P.neonTeal, 0.7, 1.6);
  g.fillStyle = P.stageHi; g.fillRect(hx + 22, t - 16, 3, 16); disc(g, hx + 23.5, t - 17, 4, P.eyeDim); // the antenna
  g.fillStyle = P.robot; g.fillRect(hx - 14, t + 44, 28, 12); // the neck
  disc(g, hx - 13, t + 20, 3, P.neonTeal); disc(g, hx + 13, t + 20, 3, P.neonTeal); // its eyes behind the visor
  const torso = new Path2D(); // broad shoulders, a waist, a hip plate
  torso.moveTo(l + 10, t + 54); torso.lineTo(r - 10, t + 54); torso.quadraticCurveTo(r, t + 54, r, t + 70); torso.lineTo(r - 18, hz - 60); torso.lineTo(r - 4, hz - 40); torso.lineTo(r - 4, hz); torso.lineTo(l + 4, hz); torso.lineTo(l + 4, hz - 40); torso.lineTo(l + 18, hz - 60); torso.lineTo(l, t + 70); torso.quadraticCurveTo(l, t + 54, l + 10, t + 54); torso.closePath();
  g.fillStyle = P.robot; g.fill(torso);
  g.fillStyle = P.robotHi; rrect(g, l - 26, t + 58, 34, 92, 12); g.fill(); rrect(g, r - 8, t + 58, 34, 92, 12); g.fill(); // the shoulders and arms
  g.fillStyle = P.robot; rrect(g, l - 20, t + 150, 22, hz - t - 170, 8); g.fill(); rrect(g, r - 2, t + 150, 22, hz - t - 170, 8); g.fill();
  g.fillStyle = P.robotHi; g.fillRect(l + 18, hz - 58, w - 36, 3); g.fillRect(l + 6, hz - 40, w - 12, 3); // the waist seams
  for (let yy = t + 70; yy < hz - 70; yy += R2.rivet) { disc(g, l + 10, yy, 2.2, P.robotHi); disc(g, r - 10, yy, 2.2, P.robotHi); }
  g.save(); g.beginPath(); g.rect(0, 0, l + 30, hz); g.clip(); g.lineWidth = 2.5; g.strokeStyle = P.neonPink; g.globalAlpha = 0.5; g.stroke(torso); g.restore(); // pink on its left side
  g.save(); g.beginPath(); g.rect(r - 30, 0, T.designW, hz); g.clip(); g.lineWidth = 2.5; g.strokeStyle = P.neonTeal; g.globalAlpha = 0.45; g.stroke(torso); g.restore(); // teal on its right
}
function paintHorror(g) { // the horror set: a painted moon, a dead tree, tombstones, a far iron fence, a low fog and the fog machine
  const S2 = A.sets.horror, hz = HORIZON;
  paintStage(g);
  const [mx, my, mr] = S2.moon; disc(g, mx, my, mr, P.moon);
  const [fx0, fy, fx1] = S2.fence; g.fillStyle = P.graveHi; g.fillRect(fx0, fy, fx1 - fx0, 2); g.fillRect(fx0, fy + 16, fx1 - fx0, 2); for (let x = fx0; x < fx1; x += 12) g.fillRect(x, fy - 6, 1.6, hz - fy + 6);
  const [tx, ty] = S2.tree; g.strokeStyle = P.tree; g.lineCap = 'round';
  g.lineWidth = 12; g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx - 8, ty - 150); g.stroke();
  g.lineWidth = 5; g.beginPath(); g.moveTo(tx - 6, ty - 110); g.lineTo(tx - 50, ty - 170); g.moveTo(tx - 8, ty - 140); g.lineTo(tx + 20, ty - 200); g.moveTo(tx - 30, ty - 140); g.lineTo(tx - 44, ty - 196); g.stroke(); g.lineCap = 'butt';
  S2.stones.forEach(([x, y, w, h]) => { g.fillStyle = P.grave; g.beginPath(); g.moveTo(x - w / 2, hz); g.lineTo(x - w / 2, y - h + w / 2); g.arc(x, y - h + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w / 2, hz); g.closePath(); g.fill(); g.fillStyle = P.graveHi; g.fillRect(x - w / 2, y - h + w / 2, 2, hz - y + h - w / 2); g.fillRect(x - w * 0.25, y - h + w * 0.7, w * 0.5, 2); });
  const [qx, qy] = S2.machine; g.fillStyle = P.stageHi; rrect(g, qx - 16, qy - 20, 32, 22, 4); g.fill(); g.fillRect(qx - 22, qy - 14, 8, 6); // the fog machine, nozzle toward the field
  g.beginPath(); rrPath(g, qx - 16, qy - 20, 32, 22, 4); rim(g, P.lamp, 0.8, 1.4); // a plain grey edge: nothing near the goal's cyan on this set
  const gr = g.createLinearGradient(0, hz - 20, 0, T.designH); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.35, P.fog); gr.addColorStop(1, P.fog); g.fillStyle = gr; g.fillRect(0, hz - 20, T.designW, T.designH - hz + 20);
}
function paintNight(g) { // the night shoot: the horror set darker, under two floodlight rigs whose cones fade before the targets' band
  paintHorror(g);
  g.fillStyle = 'rgba(5,4,8,0.4)'; g.fillRect(0, 0, T.designW, HORIZON);
  const F = A.sets.flood;
  F.rigs.forEach(([x, y]) => {
    const dir = x < T.designW / 2 ? 1 : -1, gr = g.createLinearGradient(x, y + 30, x + dir * 60, 200);
    gr.addColorStop(0, P.flood); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(x, y + 30); g.lineTo(x + dir * (F.cone + 40), HORIZON); g.lineTo(x + dir * 20, HORIZON); g.closePath(); g.fill();
    g.fillStyle = P.lamp; g.fillRect(x - 2, y, 4, 34); rrect(g, x - 14, y + 26, 28, 14, 3); g.fill(); g.fillStyle = P.flood; g.fillRect(x - 12, y + 36, 24, 3);
  });
}
const SET_PAINT = { screen: paintScreen, western: paintWestern, scifi: paintScifi, monster: paintMonster, robot: paintRobot, horror: paintHorror, night: paintNight };
// Builds the set's image at this device scale (at play start, so the first frame does not pay for it): an opaque canvas exactly the field's size in device pixels.
function setScale(k) { return Math.round(k * 1000) / 1000; }
function prepSet(key, k) {
  if (SET_IMG.key === key && SET_IMG.k === k) return;
  SET_IMG.key = key; SET_IMG.k = k; SET_IMG.cv = null;
  if (typeof OffscreenCanvas === 'undefined') return;
  const cv = new OffscreenCanvas(Math.round(T.designW * k), Math.round(T.designH * k)), g = cv.getContext('2d', { alpha: false });
  if (!g) return;
  g.scale(cv.width / T.designW, cv.height / T.designH); SET_PAINT[key](g);
  SET_IMG.cv = cv;
}
// The set, drawn in device pixels at a whole-pixel offset and no scale, so the raster copies it rather than filtering and blending every pixel (a full-field blit through the
// field's fractional scale cost two to three times v0.5's whole frame under software raster). Without offscreen canvases, only the stage's flat base is drawn.
function drawSet(ctx, key) {
  const m = ctx.getTransform(), k = setScale(m.a);
  prepSet(key, k);
  if (!SET_IMG.cv) { ctx.fillStyle = P.stage; ctx.fillRect(0, 0, T.designW, HORIZON); ctx.fillStyle = P.floor; ctx.fillRect(0, HORIZON, T.designW, T.designH - HORIZON); return; }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(SET_IMG.cv, Math.round(m.e), Math.round(m.f)); ctx.restore();
}
// The fog machine's fog: three slow wisps along the floor, below the zombies' feet (the one moving part of a set).
function drawFog(ctx, now) {
  ctx.fillStyle = P.fog;
  for (const [x, y, w, h, v] of A.sets.horror.fog) { const xx = ((x + v * now) % (T.designW + w)) - w / 2; ctx.beginPath(); ctx.ellipse(xx, y, w / 2, h / 2, 0, 0, PI2); ctx.fill(); ctx.beginPath(); ctx.ellipse(xx + w * 0.3, y + 4, w / 3, h / 2.5, 0, 0, PI2); ctx.fill(); }
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
  if (label) E.text(label, cx, cy, { size: o.size, color: o.color || P.text, weight: TY.strong });
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
  if (ch.ladder === 'accuracy') drawCard(g, 0, 0, base, 1, false, 0);
  else if (ch.ladder === 'speed') {
    if (ch.waves || ch.behaviour === 'horde') for (let k = -1; k <= 1; k++) drawCard(g, 0, k * 10, 0.3, 1, true);
    else { drawCard(g, 0, -2, base * 0.85, 1, false, 1); g.fillStyle = P.steelDark; g.fillRect(-9, 11, 18, 3); disc(g, -5, 15, 2.2, P.steel); disc(g, 5, 15, 2.2, P.steel); if (ch.behaviour === 'weave') { g.strokeStyle = P.cyan; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-14, 4); g.bezierCurveTo(-8, -12, -2, 14, 4, -2); g.stroke(); } }
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

// A call sheet (v0.6 C, the reward tickets of v0.5 Q restyled): a paper sheet with a strip in the reward's colour down its left edge and two punched holes, text in ink.
function drawCallSheet(ctx, x, y, w, h, col) {
  const l = x - w / 2, t = y - h / 2;
  ctx.fillStyle = P.shadow; rrect(ctx, l + A.shadowX, t + A.shadowY, w, h, 4); ctx.fill();
  ctx.fillStyle = P.paper; ctx.strokeStyle = P.ink; ctx.lineWidth = 1.6; rrect(ctx, l, t, w, h, 4); ctx.fill();
  ctx.fillStyle = col; ctx.fillRect(l + 1, t + 1, 5, h - 2);
  ctx.stroke(); disc(ctx, l + 3.5, t + h * 0.28, 1.6, P.ink); disc(ctx, l + 3.5, t + h * 0.72, 1.6, P.ink);
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
let popRung = null; // set when a run raised a rung's stars (and which gun), read once by the menu

function newRun(ch, id, gauntlet, skin) {
  S.ch = ch; S.gunId = id; S.skin = skin || 'std'; S.run = makeRun(ch, id); S.gauntlet = gauntlet === undefined ? null : gauntlet;
  S.fx = []; S.nope = -9; S.endT = 0; S.drag = null; S.right = new Set(); S.breachAt = -1; S.multAt = -9; S.killAt = -9; S.slow = 0; S.slowed = false; S.swept = false;
  S.set = setOf(ch); S.clap = null; S.cut = false;
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
    const run = S.run, ex = muzzleOf(run.gun.id, S.skin) - T.barrelLen, dx = ev.x1 - ev.x0, dy = ev.y1 - ev.y0, dl = Math.hypot(dx, dy) || 1;
    const ox = ev.x0 + (dx / dl) * ex, oy = ev.y0 + (dy / dl) * ex;
    for (const l of ev.lines) S.fx.push({ k: 'tracer', x0: ox, y0: oy, x1: l.x1, y1: l.y1, t: T.tracerLife, max: T.tracerLife });
    S.fx.push({ k: 'flash', t: T.flashLife, max: T.flashLife });
    ejectCasing(run);
    E.audio.play('tap'); E.haptic(8);
    if (ev.outer) S.fx.push({ k: 'callout', x: ev.outer.x, y: Math.max(ev.outer.y - 46, 40), text: 'Centre pellet scores', color: P.textDim, size: TY.mid, t: T.calloutLife, max: T.calloutLife }); // a shotgun's outer pellet on a card counts for nothing
    if (ev.bait) S.fx.push({ k: 'callout', x: ev.bait.x, y: Math.max(ev.bait.y - 34, 40), text: 'bait', color: P.orangeLight, size: TY.small + 2, t: T.calloutLife, max: T.calloutLife }); // v0.8 C: the tag sits where the dodger was
    if (ev.decoy) { // the minus shows on the decoy that was hit
      S.fx.push({ k: 'pop', x: ev.tx, y: ev.ty, text: `\u2212${-ev.pts}`, color: P.text, t: T.popLife, max: T.popLife });
      E.audio.play('miss', 0.6); E.haptic(20);
    }
    const SA = A.saucer, sk = S.ch.ladder === 'skeet', sc0 = S.ch.scale || 1;
    if (sk && ((ev.hit && ev.killed) || ev.decoy)) { // a hit saucer sparks and drops off its wire
      S.fx.push({ k: 'saucer', x: ev.tx, y: ev.ty, sc: sc0, decoy: !!ev.decoy, vx: rnd([-40, 40]), vy: -60, spin: rnd([-5, 5]), t: SA.life, max: SA.life });
      S.fx.push({ k: 'spark', ...burst(ev.tx, ev.ty, SA.sparks, [90, 200], [1, 1.8], [P.flashCore, P.white], 0.3, 200) });
    }
    if (ev.tag === 'Brain shot') { const Q = A.squib; S.fx.push({ k: 'squib', ...burst(ev.tx, ev.ty, Q.drops, Q.speed, Q.r, [P.zBlood, P.zBrain, P.zWound], Q.life, 380) }); } // a headshot pops a make-up squib
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
  let bestWave = 0, isNew = !prev || r.score > prev.score, bestScore = isNew ? r.score : prev ? prev.score : 0, bestStars = Math.max(stars, prevStars), acc = r.shots > r.baits ? Math.round((100 * r.hitShots) / (r.shots - r.baits)) : 0, day = null;
  if (ch.endless) { // no stars: the day's seed has its own best, and there is an all-time best
    const zz = E.save.get('zend', null), d = zz && typeof zz === 'object' ? zz : {}, today = d.day === E.dailySeed() && d.today ? d.today : { score: 0, wave: 0 }, best = d.best || { score: 0, wave: 0 };
    isNew = r.score > best.score; bestScore = Math.max(best.score, r.score); bestWave = isNew ? r.wave : best.wave;
    day = { best: Math.max(today.score, r.score), isNew: r.score > today.score, wave: r.score > today.score ? r.wave : today.wave };
    E.save.set('zend', { day: E.dailySeed(), today: { score: day.best, wave: day.wave }, best: isNew ? { score: r.score, wave: r.wave, gun: gid } : best });
  } else if (isNew || bestStars !== prevStars) {
    E.save.update('best', (b) => { const all = b && typeof b === 'object' ? b : {}; return { ...all, [ch.id]: { ...(all[ch.id] || {}), [gid]: { score: bestScore, stars: bestStars, accuracy: isNew ? acc : prev.accuracy || 0 } } }; }, {});
  }
  const pay = boxFor(r.score, stars), box = boxOf(E) + pay; // v0.6 B: every run pays box office from its score and its stars
  E.save.set('box', box);
  const cold = r.firstZone === 0 ? E.save.get('cold', 0) + 1 : 0; // runs in a row that opened on a bullseye, kept across runs
  E.save.set('cold', cold);
  // Gun mastery (v0.5 N): the run's counters join the gun's lifetime ones; a tier reached opens that tier's skin.
  const m0 = masteryOf(E, gid), m1 = { shots: m0.shots + r.shots - r.baits, hits: m0.hits + r.hitShots, bulls: m0.bulls + r.cBull, heads: m0.heads + r.cHead, plates: m0.plates + r.cPlate }, t0 = masteryInfo(m0).tier, t1 = masteryInfo(m1).tier;
  E.save.update('mastery', (all) => ({ ...(all && typeof all === 'object' ? all : {}), [gid]: m1 }), {});
  const tierSkins = [];
  for (let t = t0 + 1; t <= t1; t++) {
    for (const sk of A.skins[gid]) if (sk.tier === t && !(skinsHadMap(E)[gid] && skinsHadMap(E)[gid][sk.id])) tierSkins.push(sk);
  }
  const gaunt = S.gauntlet === null ? null : gauntletStep(S.gauntlet, stars);
  const fresh = newBadges({ ch, gun: r.gun.id, stars, double: r.double, decoyHits: r.decoyHits, run: r, cold, gauntletDone: !!(gaunt && gaunt.done), bests: Object.fromEntries(CHALLENGES.map((c) => [c.id, Object.fromEntries(GUN_IDS.map((g) => [g, { stars: starsOf(E, c, g) }]))])), have: badgeMap(E) });
  E.ledger.add('result', { id: ch.id, gun: gid, score: r.score, accuracy: acc, stars, best: bestStars, time: r.steps * STEP, hits: r.hits, hitShots: r.hitShots, shots: r.shots, ...(r.baits ? { baits: r.baits } : {}), bulls: r.cBull, heads: r.cHead, plates: r.cPlate, ...(r.ammo === Infinity ? {} : { ammo: r.ammo }), reloads: r.reloads, box: pay, ...(ch.ladder === 'zombie' ? { wave: r.wave, down: r.zdown, fence: !!r.breach } : {}), ...(S.gauntlet === null ? {} : { gauntlet: S.gauntlet }) });
  for (const id of fresh) E.ledger.add('badge', { id, gun: gid, on: ch.id });
  for (let t = t0 + 1; t <= t1; t++) E.ledger.add('mastery', { gun: gid, tier: TIER_NAMES[t], score: m1.bulls + m1.heads }); // after the result that earned it
  const newGuns = GUN_IDS.filter((g) => fresh.includes(T.unlockBadges[g]) && !gunUnlocked(E, g)); // guns these badges open, before the badges are saved
  if (fresh.length) E.save.update('badges', (b) => ({ ...(b && typeof b === 'object' ? b : {}), ...Object.fromEntries(fresh.map((id) => [id, 1])) }), {});
  const badgeSkins = fresh.map(skinOfBadge).filter(Boolean);
  // Everything earned on the run becomes a ticket on its card (v0.5 Q), highest first. A badge that opens a gun is one ticket ("Quick Draw I: Shotgun", the gun's icon) and ranks above
  // everything, so a gun opening is never pushed behind "+n"; a mastery tier and a skin name only themselves, and their icon shows the gun.
  const K = A.tickets, tickets = fresh.map((id) => {
    const b = BADGES.find((k) => k.id === id), gun = newGuns.find((g) => T.unlockBadges[g] === id);
    return gun ? { kind: 'badge', tier: b.tier, gun, name: `${b.name}: ${T.guns[gun].short}`, rank: K.rank.gun } : { kind: 'badge', tier: b.tier, name: b.name, rank: K.rank[b.tier] };
  });
  for (let t = t0 + 1; t <= t1; t++) tickets.push({ kind: 'tier', gun: gid, tier: t, name: TIER_NAMES[t], rank: K.rank.tier[t] });
  for (const [g, sk] of badgeSkins.map((k) => [k.gun, k.skin]).concat(tierSkins.map((k) => [gid, k]))) tickets.push({ kind: 'skin', gun: g, skin: sk, name: sk.name, rank: K.rank.skin });
  tickets.sort((a, b) => b.rank - a.rank);
  if (!ch.endless && bestStars > prevStars) popRung = { id: ch.id, gun: gid }; // the menu swells that rung once on return
  const news = tierSkins.map((k) => [gid, k.id]).concat(badgeSkins.map((k) => [k.gun, k.skin.id]));
  if (news.length) E.save.update('skinsNew', (m) => { const o = { ...(m && typeof m === 'object' ? m : {}) }; for (const [g, id] of news) o[g] = [...new Set([...(o[g] || []), id])]; return o; }, {}); // the rack marks a gun with a skin not yet looked at
  // A Bunker cleared early leaves plates standing; say what they were worth (a full combo, the shots the gun needs per plate).
  const left = ch.wall && r.cleared ? r.targets.filter((t) => t.kind === 'part').length : 0;
  const perPlate = Math.ceil((ch.plateHp || 0) / (r.gun.damage * (r.gun.pellets > 1 ? 3 : 1)));
  const zom = ch.ladder === 'zombie' ? { zdown: r.zdown, ztotal: ch.endless ? 0 : r.list.reduce((n, w) => n + w.length, 0), zwave: r.wave, zwaves: ch.endless ? 0 : r.list.length, breach: r.breach, day, bestWave } : {};
  const posters = releasePosters(E, ch, r.wave), rankUp = pendingStory(E); // v0.7: a poster this run released; v0.9: the career step whose story scene is owed (one scene, never a cascade)
  if (rankUp >= 0) E.ledger.add('rank', { rank: T.career.ranks[rankUp][0], stars: careerInfo(E).n });
  E.setScene('over', { posters, rankUp, id: ch.id, gun: r.gun.name, gunId: r.gun.id, skin: S.skin, pay, box, platesLeft: left, platesValue: left * perPlate * T.zonePoints[0] * T.comboCap, score: r.score, stars, best: bestScore, isNew, bestStars, hits: r.hits, bulls: r.bulls, heads: r.cHead, shots: r.shots, tickets, gaunt, thr: ch.endless ? null : thresholds(ch, r.gun.id), preset: presetName(), ...zom });
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
function menuLayout(E, playLabel) {
  const M = A.menu, land = E.w >= E.h * 1.2, sl = E.safe.left, sr = E.safe.right, st = E.safe.top, sb = E.safe.bottom, sel = gunId(E), L = { land, rows: [], rack: [] };
  const nl = LADDERS.length, count = (ladder) => CHALLENGES.filter((c) => c.ladder === ladder).length;
  if (land) {
    const x0 = sl + 90, x1 = E.w - sr - 84, rackW = x1 - x0, y = st + 4; // the engine's EXPORT tab ends 82 px in from the left, its TUNE tab starts 74 px in from the right
    const selW = clamp(rackW * M.selFrac, M.selMin, M.selMax), uw = clamp((rackW - selW - 5 * M.gap) / 5, M.tileMin, M.tileMax);
    let x = x0;
    for (const id of GUN_IDS) { const w = id === sel ? selW : uw; L.rack.push({ id, x, y, w, h: M.rackH, sel: id === sel }); x += w + M.gap; }
    const lx = sl + 10, lw = E.w - sl - sr - 20, laneTop = y + M.rackH + 6, btnY = E.h - sb - M.edge - M.btnH, pitch = Math.max(M.btnH + M.laneGap, (btnY - 6 - laneTop) / nl), gap = 6;
    const E1 = E.ctx; E1.font = `${TY.normal} ${TY.small}px system-ui, sans-serif`; // the label column is as wide as the longest set name (v0.6 C), at least `label`
    const labW = clamp(Math.max(...LADDERS.map(([l]) => E1.measureText(A.setName[l]).width + 10)), M.label, M.labelMax);
    LADDERS.forEach(([ladder, label], i) => L.rows.push({ ladder, label, x: lx, y: laneTop + i * pitch, h: pitch - M.laneGap, labelW: labW, tw: (lw - labW - 4 * gap) / 5, gap, n: count(ladder) }));
    // The bottom row: Missions and Sound, the hint line, then Endless and Play at the right thumb's end (Play is as wide as its label).
    const E2 = E.ctx; E2.font = `${TY.strong} ${TY.mid}px system-ui, sans-serif`;
    const pw = clamp(E2.measureText(playLabel).width + M.playPad, M.playMin, M.playMax);
    L.missions = { x: lx, y: btnY, w: M.missionsW, h: M.btnH }; L.mute = { x: lx + M.missionsW + 8, y: btnY, w: M.soundW, h: M.btnH };
    L.play = { x: lx + lw - pw, y: btnY, w: pw, h: M.btnH }; L.endless = { x: L.play.x - 8 - M.endlessW, y: btnY, w: M.endlessW, h: M.btnH };
    const hx = L.mute.x + M.soundW + 10;
    L.hint = { x: hx, y: btnY, w: L.endless.x - 10 - hx, h: M.btnH };
  } else {
    const side = 16 + Math.max(sl, sr), W = Math.min(E.w - 2 * side, 560), x0 = (E.w - W) / 2, y = st + 56, gap = 4, uw = (W - 5 * gap) / 6;
    L.panel = { id: sel, x: x0, y, w: W, h: M.rackH, sel: true };
    GUN_IDS.forEach((id, i) => L.rack.push({ id, x: x0 + i * (uw + gap), y: y + M.rackH + 4, w: uw, h: M.btnH, sel: id === sel, small: true }));
    const E1 = E.ctx; E1.font = `${TY.normal} ${TY.small}px system-ui, sans-serif`; // the label column fits the longest set name while every tile keeps 44 px
    const laneTop = y + M.rackH + 4 + M.btnH + 8, pitch = M.btnH + 6, lg = 4, labelW = clamp(Math.max(...LADDERS.map(([l]) => E1.measureText(A.setName[l]).width + 8)), 78, W - 4 * lg - 5 * M.btnH);
    LADDERS.forEach(([ladder, label], i) => L.rows.push({ ladder, label, x: x0, y: laneTop + i * pitch, h: pitch - M.laneGap, labelW, tw: (W - labelW - 4 * lg) / 5, gap: lg, n: count(ladder) }));
    const hy = laneTop + nl * pitch + 4, by = hy + 40 + 52 + 8, bw = (W - 16) / 3;
    L.hint = { x: x0, y: hy, w: W, h: 36 }; L.play = { x: x0, y: hy + 40, w: W, h: 52 };
    L.missions = { x: x0, y: by, w: bw, h: 48 }; L.endless = { x: x0 + bw + 8, y: by, w: bw, h: 48 }; L.mute = { x: x0 + 2 * (bw + 8), y: by, w: bw, h: 48 };
  }
  // v0.6: the lanes' empty slots on the right (the fourth and fifth of Skeet, Boss and Zombies) hold the studio logo and, on the Zombies row, the Prop Room button. Portrait has no
  // room for the logo there, so it heads the screen.
  const rs = L.rows[2], rz = L.rows[4], sx = (row, i) => row.x + row.labelW + i * (row.tw + row.gap);
  L.props = { x: sx(rz, 3), y: rz.y, w: 2 * rz.tw + rz.gap, h: rz.h };
  L.logo = land ? { x: L.props.x, y: rs.y, w: L.props.w, h: rz.y - rs.y - M.laneGap } : { x: E.w / 2 - 110, y: st + A.logo.top, w: 220, h: 50 };
  // v0.7: the career plate sits in the Boss lane's empty third slot (a little wider than a tile, taking some of the logo's width); portrait puts it under the buttons.
  if (land) {
    const rb = L.rows[3], px = sx(rb, 2), span = 3 * rb.tw + 2 * rb.gap, E3 = E.ctx; E3.font = `${TY.normal} ${TY.small}px system-ui, sans-serif`;
    const logoW = Math.max(E3.measureText('a Backlot 88 production').width + 10, span - rb.tw * A.story.plateMax - rb.gap), pw = clamp(span - rb.gap - logoW, rb.tw, rb.tw * A.story.plateMax), nx = px + pw + rb.gap;
    L.career = { x: px, y: rb.y, w: pw, h: rb.h };
    L.logo = { ...L.logo, w: L.logo.x + L.logo.w - nx, x: nx };
  } else L.career = { x: L.missions.x, y: L.missions.y + L.missions.h + 8, w: 3 * L.missions.w + 16, h: 44 };
  L.titleArea = L.logo; // release: five taps on the logo show TUNE
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
// v0.8 D: a pair that needs much more skill than the pistol does on the same rung: its two-star bar is near its own perfect run (information only, the rung stays open).
function toughPair(ch, gun) {
  if (ch.endless || gun === 'pistol' || !BARS[ch.id] || !BARS[ch.id][gun]) return false;
  const share = (g) => thresholds(ch, g).two / BARS[ch.id][g].m[0], K = T.tough;
  return share(gun) >= K.share && share(gun) - share('pistol') >= K.over;
}
function drawRungTile(ctx, E, x, y, w, h, ch, locked, st, ring, k0, tough) {
  ctx.save(); if (k0 !== 1) { ctx.translate(x + w / 2, y + h / 2); ctx.scale(k0, k0); ctx.translate(-x - w / 2, -y - h / 2); }
  const narrow = w < 84, ext = A.menu.ext, k = narrow ? 0.8 : clamp((w - 30) / 74, 0.7, 1), ax = narrow ? x + w / 2 + 5 : x + 12 + ext * k, ay = narrow ? y + 19 : y + h / 2;
  plate(E, x, y, w, h, locked ? P.panel : P.panelHi, ring ? P.orange : P.panelEdge, 8);
  ctx.globalAlpha = locked ? 0.3 : 1; menuSprite(ctx, K_ICON + CHALLENGES.indexOf(ch), ext, paintRung, ax, ay, ch, 0, k); ctx.globalAlpha = 1;
  E.text(`${ch.level}`, x + 9, y + 11, { size: TY.small, weight: TY.strong, color: locked ? P.textDim : P.text });
  const note = tough && !locked, r = narrow ? 4.4 : 5.4, dx = narrow ? 12 : 16, sx = narrow ? x + w / 2 : x + w - 6 - dx - r, sy = narrow ? y + h - 10 : note ? y + 15 : y + h / 2;
  if (locked) { ctx.save(); ctx.translate(sx, sy); ctx.scale(narrow ? 0.6 : 0.8, narrow ? 0.6 : 0.8); drawLock(ctx, 0, 0, P.textDim); ctx.restore(); }
  else for (let i = 0; i < 3; i++) drawStar(ctx, sx + (i - 1) * dx, sy, r, i < st ? P.brass : null, i < st ? null : P.panelEdge);
  if (note) { // the written note, as large as the free space allows: under the stars (wide) or over the art (narrow, which is dimmed to keep it legible)
    const nx = narrow ? x + 3 : x + 40, ny = narrow ? y + 14 : y + 27, nw = x + w - 3 - nx, nh = y + h - 3 - ny - (narrow ? 12 : 0);
    if (narrow) { ctx.globalAlpha = 0.85; E.roundRect(x + 2, y + 13, w - 4, h - 29, 4, P.panel); ctx.globalAlpha = 1; }
    let sz = TY.small, ln = wrapText(ctx, STORY.toughNote, nw, sz);
    while (sz > 7 && (ln.length * sz * 1.1 > nh || ln.some((t) => ctx.measureText(t).width > nw))) { sz -= 0.5; ln = wrapText(ctx, STORY.toughNote, nw, sz); }
    ln.forEach((t, i) => E.text(t, nx + nw / 2, ny + (i + 0.5) * sz * 1.1, { size: sz, weight: TY.normal, color: P.orange }));
  }
  ctx.restore();
}
// The Walk of Fame's star (v0.6 C): a pink terrazzo square with a star set in it, gold once the gun has reached the top tier, an outline before.
function drawFameStar(ctx, cx, cy, gold) {
  ctx.fillStyle = P.terrazzo; ctx.strokeStyle = P.ink; ctx.lineWidth = 1.6; rrect(ctx, cx - 11, cy - 11, 22, 22, 3); ctx.fill(); ctx.stroke();
  drawStar(ctx, cx, cy + 0.5, 8, gold ? P.brass : null, gold ? null : P.ink);
}
// The mastery bar and the tier: a track with a cyan fill toward the next tier (brass once Master).
function drawMasteryBar(E, x, y, w, info) {
  E.roundRect(x, y, w, 6, 3, P.panelEdge);
  E.roundRect(x, y, Math.max(6, w * info.frac), 6, 3, info.tier === 3 ? P.brass : P.cyan);
}
// The selected gun on the rack: the gun larger, the headline (its stars over the most there are), its name, the mastery bar and tier; a star waits in the corner while a skin
// has not been looked at (the skins are on the stats card).
function drawRackSelected(ctx, E, b, id) {
  const g = T.guns[id], info = masteryInfo(masteryOf(E, id)), worn = skinById(id, skinId(E, id)), fresh = ((E.save.get('skinsNew', {}) || {})[id] || []).length > 0, tx = b.x + 90, tw = b.w - 90 - 8;
  plate(E, b.x, b.y, b.w, b.h, P.panelHi, P.orange);
  drawGunTile(ctx, id, b.x + 46, b.y + b.h / 2, 78, 42, worn.id);
  drawStar(ctx, tx + 8, b.y + 13, 8, P.brass);
  E.text(`${starTotal(E, id)} / ${CHALLENGES.length * 3}`, tx + 22, b.y + 13, { size: TY.mid, weight: TY.strong, align: 'left', color: P.text });
  E.text(g.short, tx, b.y + 32, { size: TY.small, weight: TY.strong, align: 'left', color: P.textDim });
  drawMasteryBar(E, tx, b.y + 43, tw, info);
  E.text(TIER_NAMES[info.tier], tx, b.y + 56, { size: TY.small, weight: TY.strong, align: 'left', color: info.tier ? P.cyan : P.textDim });
  if (fresh) drawStar(ctx, b.x + b.w - 12, b.y + 12, 7, P.cyan);
}
// A gun on the rack that is not selected: the silhouette, and three pips for its tier; one not owned shows a padlock and, beside it, a price tag (bought in the Prop Room) or the
// star of the badge that opens it.
function drawRackSmall(ctx, E, b, open) {
  const cx = b.x + b.w / 2, worn = open ? skinId(E, b.id) : 'std', tier = open ? tierOf(E, b.id) : 0, bd = unlockBadge(b.id);
  plate(E, b.x, b.y, b.w, b.h, P.panel, P.panelEdge);
  ctx.globalAlpha = open ? 1 : 0.25; drawGunTile(ctx, b.id, cx, b.y + b.h / 2 - (b.small ? 0 : 5), b.w - 10, b.small ? b.h - 14 : b.h - 26, worn); ctx.globalAlpha = 1;
  if (!open) { drawLock(ctx, cx - 9, b.y + b.h / 2 - 2, P.text); if (bd) drawStar(ctx, cx + 9, b.y + b.h / 2 + 3, 6, P.tier[bd.tier]); else drawTag(ctx, cx + 10, b.y + b.h / 2 + 3); return; }
  if (!b.small) for (let i = 0; i < 3; i++) disc(ctx, cx + (i - 1) * 9, b.y + b.h - 8, 2.6, i < tier ? P.cyan : P.panelEdge);
}
// The one hint line: the next thing this gun opens and how, else the next mastery tier.
function menuHint(E, gid) {
  const pl = frontier(E, gid);
  if (toughPair(pl, gid)) return `${pl.name}: ${STORY.tough}`;
  const locked = CHALLENGES.find((c) => !isUnlocked(E, c, gid));
  if (locked) return `${locked.name}: two stars on ${CHALLENGES.find((p) => p.ladder === locked.ladder && p.level === locked.level - 1).name}`;
  const info = masteryInfo(masteryOf(E, gid));
  if (info.accShort) return `${TIER_NAMES[3]} needs ${Math.round(T.mastery.accuracy * 100)}% accuracy (now ${Math.round(info.acc * 100)}%)`;
  if (info.next !== null) return `${TIER_NAMES[info.tier + 1]}: ${info.score}/${info.next} bullseyes+headshots`;
  return `Every rung open, ${T.guns[gid].short} on the ${TIER_NAMES[3]}`;
}
// The sound toggle: a speaker on a slate plate, waves when on and a cross when off (drawn, not written).
function soundButton(ctx, E, r, muted) {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  plate(E, r.x, r.y, r.w, r.h, P.slate, P.ink);
  ctx.fillStyle = ctx.strokeStyle = P.text; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(cx - 11, cy - 5); ctx.lineTo(cx - 5, cy - 5); ctx.lineTo(cx + 2, cy - 11); ctx.lineTo(cx + 2, cy + 11); ctx.lineTo(cx - 5, cy + 5); ctx.lineTo(cx - 11, cy + 5); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  if (muted) { ctx.moveTo(cx + 7, cy - 6); ctx.lineTo(cx + 16, cy + 6); ctx.moveTo(cx + 16, cy - 6); ctx.lineTo(cx + 7, cy + 6); } else { ctx.arc(cx + 2, cy, 8, -0.9, 0.9); ctx.moveTo(cx + 2 + 14 * Math.cos(-0.9), cy + 14 * Math.sin(-0.9)); ctx.arc(cx + 2, cy, 14, -0.9, 0.9); }
  ctx.stroke(); ctx.lineCap = 'butt';
  return { x: r.x, y: r.y, w: r.w, h: r.h };
}
// A price tag (drawn, not written): a brass tag with a hole and a string, the Prop Room's mark.
function drawTag(ctx, cx, cy) {
  ctx.lineJoin = 'round'; ctx.fillStyle = P.brass; ctx.strokeStyle = P.ink; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(cx - 9, cy - 6); ctx.lineTo(cx + 5, cy - 6); ctx.lineTo(cx + 10, cy); ctx.lineTo(cx + 5, cy + 6); ctx.lineTo(cx - 9, cy + 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  disc(ctx, cx + 4, cy, 1.8, P.ink);
}
// The menu's own patterns (v0.6 C): VHS scan lines and the pegboard behind the prop rack, built once per pixel ratio as small tiles and filled in one call each.
const MPAT = { dpr: 0, scan: null, peg: null };
function menuPatterns(ctx, dpr) {
  if (MPAT.dpr === dpr) return MPAT;
  MPAT.dpr = dpr; MPAT.scan = MPAT.peg = null;
  try {
    const V = A.vhs, sc = new OffscreenCanvas(1, Math.round(V.pitch * dpr)), g = sc.getContext('2d');
    g.fillStyle = P.vhs; g.fillRect(0, 0, 1, Math.max(1, Math.round(dpr)));
    const pc = new OffscreenCanvas(Math.round(12 * dpr), Math.round(12 * dpr)), h = pc.getContext('2d');
    h.fillStyle = P.pegboard; h.fillRect(0, 0, pc.width, pc.height); h.fillStyle = P.pegHole; h.beginPath(); h.arc(6 * dpr, 6 * dpr, 1.7 * dpr, 0, PI2); h.fill();
    const m = new DOMMatrix().scale(1 / dpr);
    MPAT.scan = ctx.createPattern(sc, 'repeat'); MPAT.scan.setTransform(m);
    MPAT.peg = ctx.createPattern(pc, 'repeat'); MPAT.peg.setTransform(m);
  } catch (e) { MPAT.scan = MPAT.peg = null; }
  return MPAT;
}
function drawVHS(ctx, E) {
  const M = menuPatterns(ctx, E.dpr), V = A.vhs, by = ((E.time * V.bandSpeed) % (E.h + 2 * V.bandH)) - V.bandH;
  if (M.scan) { ctx.fillStyle = M.scan; ctx.fillRect(0, 0, E.w, E.h); }
  ctx.fillStyle = P.vhsBand; ctx.fillRect(0, by, E.w, V.bandH); // the tracking band rolling down
}
function drawPegboard(ctx, x, y, w, h) {
  const M = MPAT;
  ctx.fillStyle = M.peg || P.pegboard; rrect(ctx, x, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.stroke();
}
// The studio logo (v0.6 A): "RECOIL" over "a Backlot 88 production", two searchlights crossing behind it and a row of stars, like the card before a picture.
function drawLogo(ctx, E, r, land) {
  if (land && drawArtImage(ctx, 'title', r.x + r.w / 2, r.y + (r.h - A.logo.strip) / 2, r.w, r.h - A.logo.strip)) { // the generated title card carries its own searchlights and lettering; the line is text in the strip under it
    E.text('a Backlot 88 production', r.x + r.w / 2, r.y + r.h - A.logo.strip / 2 + 1, { size: TY.small, color: P.textDim });
    return;
  }
  if (!land && ART_IMG.title) { // portrait has room for the lettering only; the line under it is text at the minimum size
    drawArtImage(ctx, 'title', r.x + r.w / 2, r.y + 15, r.w, 30, A.logo.word);
    E.text('a Backlot 88 production', r.x + r.w / 2, r.y + 37, { size: TY.small, color: P.textDim });
    return;
  }
  const cx = r.x + r.w / 2, K = A.logo, big = land ? K.title : TY.mid + 2, ty = land ? r.y + r.h * 0.42 : r.y + 16, sy = land ? r.y + r.h * 0.42 + big * 0.62 + 6 : r.y + 38;
  if (land) {
    ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); ctx.globalAlpha = K.beam;
    ctx.fillStyle = P.neonTeal; ctx.beginPath(); ctx.moveTo(cx - r.w * 0.3, r.y + r.h); ctx.lineTo(cx + r.w * 0.05, r.y - 4); ctx.lineTo(cx + r.w * 0.25, r.y - 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = P.neonPink; ctx.beginPath(); ctx.moveTo(cx + r.w * 0.3, r.y + r.h); ctx.lineTo(cx - r.w * 0.05, r.y - 4); ctx.lineTo(cx - r.w * 0.25, r.y - 4); ctx.closePath(); ctx.fill();
    ctx.restore();
    for (let i = -2; i <= 2; i++) drawStar(ctx, cx + i * 16, ty - big * 0.62 - 8, i ? 4 : 5.5, P.brass);
  }
  ctx.font = `${TY.strong} ${big}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = 5; ctx.strokeStyle = P.ink; ctx.strokeText('RECOIL', cx, ty);
  E.text('RECOIL', cx, ty, { size: big, weight: TY.strong, color: P.brassText });
  E.text('a Backlot 88 production', cx, sy, { size: TY.small, color: P.textDim });
}
// The career plate on the menu (PRD v0.7 B): the player's rank, the stars to the next one, and a bar toward it. One tap opens the career screen (the poster wall).
function drawCareerPlate(ctx, E, r, ci) {
  plate(E, r.x, r.y, r.w, r.h, P.panelHi, P.brass);
  E.text(fitText(ctx, ci.name, r.w - 14, TY.small, TY.strong), r.x + 8, r.y + r.h / 2 - 12, { size: TY.small, weight: TY.strong, align: 'left', color: P.brassText });
  const one = ci.toNext === 1, forms = ci.next ? [`${ci.toNext} ${one ? 'star' : 'stars'} to ${ci.next}`, `${ci.toNext} to ${ci.next}`, `${ci.toNext} more ${one ? 'star' : 'stars'}`, `${ci.toNext} more`] : [`${ci.n} of ${CAREER_MAX} stars`, `${ci.n} stars`];
  ctx.font = `${TY.normal} ${TY.small}px system-ui, sans-serif`; // the longest form that fits the plate
  const line = forms.find((f) => ctx.measureText(f).width <= r.w - 14) || forms[forms.length - 1];
  E.text(fitText(ctx, line, r.w - 14, TY.small, TY.normal), r.x + 8, r.y + r.h / 2 + 4, { size: TY.small, align: 'left', color: P.textDim });
  const bh = A.story.bar;
  E.roundRect(r.x + 8, r.y + r.h - 8, r.w - 16, bh, bh / 2, P.panelEdge);
  E.roundRect(r.x + 8, r.y + r.h - 8, Math.max(bh, (r.w - 16) * ci.frac), bh, bh / 2, P.brass);
}

// ---------- Story cards, posters and the career screen (PRD v0.7) ----------

// The director, Big Lou (PRD v0.7 C, E2): the Artist's picture for the pose once it is in STORY_ART and loaded, else a megaphone silhouette in neon pink (shouting: sound arcs; approving: a gold
// star), drawn to fit a size x size box centred on cx, cy.
function drawDirector(ctx, cx, cy, size, approve) {
  if (drawArtImage(ctx, approve ? 'directorApprove' : 'director', cx, cy, size, size)) return;
  const k = size / 190;
  ctx.save(); ctx.translate(cx - 36 * k, cy); ctx.scale(k, k); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = 4;
  ctx.fillStyle = P.steelDark; rrect(ctx, -26, 6, 14, 30, 5); ctx.fill(); ctx.stroke(); // the handle
  ctx.fillStyle = P.steel; rrect(ctx, -52, -9, 16, 18, 5); ctx.fill(); ctx.stroke(); // the mouthpiece
  ctx.fillStyle = P.neonPink; ctx.beginPath(); ctx.moveTo(-38, -11); ctx.lineTo(8, -11); ctx.lineTo(40, -38); ctx.lineTo(40, 38); ctx.lineTo(8, 11); ctx.lineTo(-38, 11); ctx.closePath(); ctx.fill(); ctx.stroke(); // the cone
  ctx.fillStyle = P.paper; ctx.beginPath(); ctx.ellipse(40, 0, 8, 38, 0, 0, PI2); ctx.fill(); ctx.stroke(); // its rim
  if (approve) drawStar(ctx, 74, -30, 17, P.brass);
  else { ctx.strokeStyle = P.text; ctx.lineWidth = 5; for (const r of [52, 68, 84]) { ctx.beginPath(); ctx.arc(40, 0, r, -0.42, 0.42); ctx.stroke(); } }
  ctx.restore();
}

// A premiere poster (PRD v0.7 E, E2) in the box x, y, w, h: the Artist's picture if loaded, else a coloured card with searchlights and a star; the title is always drawn here, on a dark band,
// because generated text misspells. `size` is the title's font size.
function drawPoster(ctx, E, x, y, w, h, set, size) {
  const C = A.story.poster[set];
  ctx.save(); rrect(ctx, x, y, w, h, 8); ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, C[0]); g.addColorStop(1, C[1]); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  if (!drawArtImage(ctx, `poster-${set}`, x + w / 2, y + h / 2, w, h)) {
    ctx.globalAlpha = 0.22; ctx.fillStyle = C[2];
    ctx.beginPath(); ctx.moveTo(x + w * 0.12, y + h); ctx.lineTo(x + w * 0.4, y); ctx.lineTo(x + w * 0.6, y); ctx.lineTo(x + w * 0.34, y + h); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + w * 0.88, y + h); ctx.lineTo(x + w * 0.6, y); ctx.lineTo(x + w * 0.4, y); ctx.lineTo(x + w * 0.66, y + h); ctx.fill();
    ctx.globalAlpha = 1;
    drawStar(ctx, x + w / 2, y + h * 0.3, w * 0.24, C[2]);
    for (let i = -2; i <= 2; i++) drawStar(ctx, x + w / 2 + i * w * 0.14, y + h * 0.46, i ? w * 0.04 : w * 0.055, P.brass);
  }
  const lines = wrapText(ctx, STORY.posters[set], w - 18, size), lh = size + 4, bh = lines.length * lh + 14;
  ctx.fillStyle = 'rgba(8,6,10,0.84)'; ctx.fillRect(x, y + h - bh, w, bh);
  lines.forEach((ln, i) => E.text(ln, x + w / 2, y + h - bh + 7 + lh / 2 + i * lh, { size, weight: TY.strong, color: P.brassText }));
  ctx.restore();
  ctx.strokeStyle = P.ink; ctx.lineWidth = 2; rrect(ctx, x, y, w, h, 8); ctx.stroke();
}
// A poster slot on the wall that has not been released: a dark card, a star outline, "Coming soon".
function drawPosterSlot(ctx, E, x, y, w, h) {
  plate(E, x, y, w, h, P.panel, P.panelEdge, 8);
  drawStar(ctx, x + w / 2, y + h * 0.38, w * 0.22, null, P.panelEdge);
  const lines = wrapText(ctx, STORY.coming, w - 10, TY.small); // two short lines in a narrow slot
  lines.forEach((ln, i) => E.text(ln, x + w / 2, y + h - 14 - (lines.length - 1 - i) * 18, { size: TY.small, weight: TY.strong, color: P.textDim }));
}

// The soundstage behind a story card: near black, two searchlights from the rig, the floor.
function drawStage(ctx, E) {
  ctx.fillStyle = P.stageLow; ctx.fillRect(0, 0, E.w, E.h);
  const fl = E.h * 0.8;
  ctx.fillStyle = P.floor; ctx.fillRect(0, fl, E.w, E.h - fl); ctx.fillStyle = P.floorLine; ctx.fillRect(0, fl, E.w, 2);
  ctx.globalAlpha = 0.13;
  ctx.fillStyle = P.neonTeal; ctx.beginPath(); ctx.moveTo(E.w * 0.12, 0); ctx.lineTo(E.w * 0.26, 0); ctx.lineTo(E.w * 0.5, fl); ctx.lineTo(E.w * 0.2, fl); ctx.fill();
  ctx.fillStyle = P.neonPink; ctx.beginPath(); ctx.moveTo(E.w * 0.88, 0); ctx.lineTo(E.w * 0.74, 0); ctx.lineTo(E.w * 0.5, fl); ctx.lineTo(E.w * 0.8, fl); ctx.fill();
  ctx.globalAlpha = 1;
}
// A clapperboard with the rank on it: the striped stick opens, then snaps shut at `snapAt`.
function drawRankBoard(ctx, E, cx, cy, w, name, age) {
  const K = T.career, h = 92, st = 20, x = cx - w / 2, y = cy - h / 2 + st, bh = h - st;
  const stick = (sy) => {
    ctx.fillStyle = P.stageLow; rrect(ctx, x, sy, w, st, 3); ctx.fill(); ctx.save(); rrect(ctx, x, sy, w, st, 3); ctx.clip();
    ctx.fillStyle = P.text; for (let k = -1; k < w / 22 + 1; k++) { const bx = x + k * 22; ctx.beginPath(); ctx.moveTo(bx, sy + st); ctx.lineTo(bx + 11, sy); ctx.lineTo(bx + 22, sy); ctx.lineTo(bx + 11, sy + st); ctx.fill(); }
    ctx.restore(); ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5; rrect(ctx, x, sy, w, st, 3); ctx.stroke();
  };
  ctx.save(); ctx.lineJoin = 'round';
  ctx.fillStyle = P.shadow; rrect(ctx, x + A.shadowX, y + A.shadowY, w, bh, 6); ctx.fill();
  ctx.fillStyle = P.panel; ctx.strokeStyle = P.text; ctx.lineWidth = 2; rrect(ctx, x, y, w, bh, 6); ctx.fill(); ctx.stroke();
  stick(y - st);
  const ang = -0.5 * (1 - ease.outQuad(clamp((age - K.snapAt) / K.snap, 0, 1)));
  ctx.save(); ctx.translate(x, y - st); ctx.rotate(ang); ctx.translate(-x, -(y - st)); stick(y - 2 * st - 1); ctx.restore();
  ctx.restore();
  E.text(fitText(ctx, name, w - 20, TY.big, TY.strong), cx, y + bh / 2 + 1, { size: TY.big, weight: TY.strong, color: P.brassText });
}

// ---------- The animated story (PRD v0.9 A, B): the cold open, the Intern scene, the turn and the ending ----------
// Every scene is a pure function of its time t in seconds, drawn in a SW x SH box scaled to fit under the Skip row, so a tap can jump to the scene's end (t = its length) and what that draws
// is the resting picture. The props (sign, trailer, sunglasses, marquee, flashbulbs) are drawn here; Big Lou and Gus are the Artist's portraits with the drawn ones as fallback.
const SW = 560, SH = 300, GY = 238; // the box and the ground line inside it
let sceneK = 1; // the box's scale this frame, so that scene text can stay 14 px or more on the screen
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const mix = (a, b, k) => a + (b - a) * k;

// A story portrait standing at (x, bottom), h tall, squashed about its feet (sx, sy), tilted and turned (flip faces him the other way).
function storyPic(ctx, who, x, bottom, h, o = {}) {
  ctx.save(); ctx.globalAlpha *= o.alpha === undefined ? 1 : o.alpha;
  ctx.translate(x, bottom); if (o.rot) ctx.rotate(o.rot); ctx.scale((o.flip ? -1 : 1) * (o.sx === undefined ? 1 : o.sx), o.sy === undefined ? 1 : o.sy);
  if (who === 'gus') { if (!drawArtImage(ctx, o.sold && ART_IMG.masterSold ? 'masterSold' : 'master', 0, -h / 2, h * 2 / 3, h)) drawPropMaster(ctx, 0, 0, h / 105); }
  else drawDirector(ctx, 0, -h / 2, h, who === 'louOk');
  ctx.restore();
}
// A pop-in over [a, b]: an overshoot as squash and stretch about the feet.
function popOf(t, a, b) { const k = ease.outBack(seg(t, a, b)); return { sx: Math.max(0.01, k), sy: Math.max(0.01, mix(0.5, 1, k)), alpha: seg(t, a, a + 0.12) }; }
// Text inside a scene, never smaller than 14 px on the screen whatever the scale.
function sText(ctx, str, x, y, size, color, rot = 0) {
  ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot);
  ctx.font = `${TY.strong} ${Math.max(size, 14 / sceneK)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(str, 0, 0);
  ctx.restore();
}
// The newcomer: a faceless figure in the player's orange (never shown, so the player can be them). `hand` is where the reaching hand is, in the figure's own units; `sweat` runs 0 to 1.
function drawPlayer(ctx, x, bottom, s, o = {}) {
  ctx.save(); ctx.translate(x, bottom); ctx.scale((o.flip ? -1 : 1) * s * (o.sx === undefined ? 1 : o.sx), s * (o.sy === undefined ? 1 : o.sy)); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = 2.4;
  ctx.fillStyle = P.villain; rrect(ctx, -10, -26, 9, 26, 3); ctx.fill(); ctx.stroke(); rrect(ctx, 1, -26, 9, 26, 3); ctx.fill(); ctx.stroke();
  const [hx, hy] = o.hand || [15, -34];
  ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(9, -54); ctx.lineTo(hx, hy); ctx.stroke(); ctx.strokeStyle = P.orange; ctx.lineWidth = 5.4; ctx.beginPath(); ctx.moveTo(9, -54); ctx.lineTo(hx, hy); ctx.stroke(); ctx.strokeStyle = P.ink; ctx.lineWidth = 2.4;
  ctx.fillStyle = P.orange; rrect(ctx, -13, -64, 26, 42, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = P.kraft; ctx.beginPath(); ctx.arc(0, -75, 10.5, 0, PI2); ctx.fill(); ctx.stroke(); disc(ctx, hx, hy, 4.2, P.kraft); ctx.beginPath(); ctx.arc(hx, hy, 4.2, 0, PI2); ctx.stroke();
  if (o.sweat) { const k = o.sweat; ctx.globalAlpha = 1 - k * 0.6; ctx.fillStyle = P.cyan; ctx.beginPath(); ctx.arc(14, -84 + 14 * k, 2.8, 0, PI2); ctx.moveTo(14, -91 + 14 * k); ctx.lineTo(11.4, -85 + 14 * k); ctx.lineTo(16.6, -85 + 14 * k); ctx.fill(); }
  ctx.restore();
}
// A small starburst (a flash, a glint).
function glint(ctx, x, y, r, a, color = P.flashCore) {
  if (a <= 0 || r <= 0) return;
  ctx.save(); ctx.globalAlpha *= clamp(a, 0, 1); ctx.fillStyle = color; ctx.beginPath();
  for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4, rr = i % 2 ? r * 0.28 : r; ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); }
  ctx.closePath(); ctx.fill(); ctx.restore();
}
// A dust puff that grows and fades over half a second from t0.
function puff(ctx, x, y, t, t0, r) {
  const k = seg(t, t0, t0 + 0.5);
  if (k <= 0 || k >= 1) return;
  ctx.save(); ctx.globalAlpha = 0.5 * (1 - k); ctx.fillStyle = P.paperShade;
  for (const d of [-1, 0, 1]) { ctx.beginPath(); ctx.arc(x + d * r * (0.5 + k), y - k * r * 0.6 - (d === 0 ? r * 0.3 : 0), r * (0.35 + 0.5 * k), 0, PI2); ctx.fill(); }
  ctx.restore();
}

// The sky and the ground behind a scene: dusk (or night) over the lot with the studio's stages on the skyline and two searchlights sweeping, the ground filled across the whole screen.
function drawDusk(ctx, E, k, bx, by, t, night) {
  const gy = by + GY * k, g = ctx.createLinearGradient(0, 0, 0, gy);
  g.addColorStop(0, night ? '#0a0614' : '#150d28'); g.addColorStop(0.6, night ? '#24123a' : '#3b1a52'); g.addColorStop(1, night ? '#5a1f55' : '#a8346a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, E.w, gy);
  ctx.fillStyle = P.floor; ctx.fillRect(0, gy, E.w, E.h - gy); ctx.fillStyle = P.floorLine; ctx.fillRect(0, gy, E.w, 2);
  ctx.save(); ctx.translate(bx, by); ctx.scale(k, k);
  const tbl = [60, 92, 44, 110, 70, 52, 98, 66];
  ctx.globalAlpha = 0.11;
  for (const [x0, col, ph, base] of [[40, P.neonTeal, 0, 0.25], [SW - 40, P.neonPink, 2, -0.25]]) {
    const dx = Math.sin(Math.sin(t * 0.8 + ph) * 0.22 + base) * 300;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x0 - 12, GY); ctx.lineTo(x0 + 12, GY); ctx.lineTo(x0 + dx + 34, GY - 300); ctx.lineTo(x0 + dx - 34, GY - 300); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.fillStyle = P.stage;
  for (let i = 0, x = -640; x < 1200; i++, x += 64) { const h = tbl[i % 8]; ctx.fillRect(x, GY - 8 - h, 58, h + 8); }
  ctx.fillStyle = P.orangeLight; ctx.globalAlpha = 0.55;
  for (let i = 0, x = -640; x < 1200; i++, x += 64) for (let j = 0; j < 3; j++) if ((i * 7 + j * 3) % 5 === 0) ctx.fillRect(x + 8 + j * 16, GY - 8 - tbl[i % 8] + 10 + j * 12, 6, 5);
  ctx.restore();
}

// A wooden FOR SALE board centred on (cx, cy), turned by rot, `w` wide.
function forSale(ctx, cx, cy, rot, w) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.lineJoin = 'round';
  ctx.fillStyle = P.paper; ctx.strokeStyle = P.ink; ctx.lineWidth = 3; rrect(ctx, -w / 2, -20, w, 40, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = P.paperShade; ctx.fillRect(-w / 2 + 4, 14, w - 8, 2);
  sText(ctx, 'FOR SALE', 0, -1, 21, P.red);
  ctx.restore();
}

// ---- 1. The lot: the gate, and a FOR SALE sign half nailed on ----
function sceneLot(ctx, E, t) {
  const gl = 132, gr = 392; // the gate's pillars
  ctx.fillStyle = P.stageHi; ctx.strokeStyle = P.ink; ctx.lineWidth = 3;
  rrect(ctx, gl, 92, 36, GY - 92, 3); ctx.fill(); ctx.stroke(); rrect(ctx, gr, 92, 36, GY - 92, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = P.woodDark; ctx.fillRect(gl + 36, 128, gr - gl - 36, GY - 128); ctx.fillStyle = P.wood; // the gate's two leaves
  for (let x = gl + 40; x < gr - 6; x += 22) ctx.fillRect(x, 132, 18, GY - 134);
  ctx.fillStyle = P.ink; ctx.fillRect(278.5, 128, 3, GY - 128);
  ctx.fillStyle = P.truss; rrect(ctx, gl - 8, 72, gr - gl + 52, 30, 4); ctx.fill(); ctx.stroke(); // the arch
  for (let i = 0; i < 7; i++) { // its bulbs light one by one, the fifth stays dead
    const x = gl + 6 + i * 41, on = t > 0.3 + i * 0.12 && i !== 4;
    if (on) { ctx.globalAlpha = 0.25; disc(ctx, x, 87, 9, P.orange); ctx.globalAlpha = 1; }
    disc(ctx, x, 87, 4, on ? P.flashCore : P.lamp);
  }
  ctx.globalAlpha = 0.28 * seg(t, 0.4, 1); disc(ctx, 280, 58, 34, P.neonPink); ctx.globalAlpha = 1; // the neon 88 over it
  sText(ctx, '88', 280, 52, 32, P.neonPink);
  const drop = ease.outBack(seg(t, 0.35, 1)), u = Math.max(0, t - 0.9), th = 0.2 + 0.45 * Math.exp(-2.4 * u) * Math.cos(9 * u); // the sign drops on and swings from its one nail
  const nx = 188, ny = 156 - 150 * (1 - drop), c = Math.cos(th), s = Math.sin(th);
  ctx.globalAlpha = seg(t, 0.3, 0.5); forSale(ctx, nx + c * 60 - s * 14, ny + s * 60 + c * 14, th, 132);
  disc(ctx, nx, ny, 3.4, P.steelLight); ctx.strokeStyle = P.ink; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(nx, ny, 3.4, 0, PI2); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.fillStyle = P.steelLight; ctx.fillRect(338, GY + 6, 10, 2.4); ctx.fillRect(336, GY + 4.4, 3, 5.6); // the second nail on the ground, and the hammer waiting by the gate
  ctx.save(); ctx.translate(358, GY + 10); ctx.rotate(-0.5); ctx.fillStyle = P.wood; ctx.fillRect(-2.5, -34, 5, 34); ctx.fillStyle = P.steelDark; ctx.fillRect(-9, -42, 18, 10); ctx.strokeStyle = P.ink; ctx.lineWidth = 1.4; ctx.strokeRect(-9, -42, 18, 10); ctx.restore();
  puff(ctx, nx + 40, GY, t, 1.0, 10);
}

// ---- 2. The extras: a line of them, Big Lou shouting, and the newcomer at the end fumbling a prop gun ----
const EXTRA_COLORS = ['#6e5b7b', '#4f6fb0', '#7a5a3c', '#58705e', '#8a4b4b', '#5f5a73'];
function sceneExtras(ctx, E, t) {
  ctx.fillStyle = '#2a2233'; ctx.fillRect(-640, 40, 1840, GY - 40); // a painted flat
  ctx.fillStyle = '#3b2e4f'; ctx.beginPath(); ctx.moveTo(-640, GY - 30);
  for (let x = -640; x <= 1160; x += 120) { ctx.lineTo(x + 40, GY - 90 - (Math.round(x / 120) % 2 ? 30 : 0)); ctx.lineTo(x + 100, GY - 36); }
  ctx.lineTo(1200, GY); ctx.lineTo(-640, GY); ctx.fill();
  ctx.fillStyle = P.brass; ctx.globalAlpha = 0.5; for (let i = 0; i < 7; i++) ctx.fillRect(164 + i * 52 - 6, GY + 6, 12, 3); ctx.globalAlpha = 1; // the tape marks they stand on
  for (let i = 0; i < 6; i++) { // the extras, one after another, swaying a little
    const x = 164 + i * 52, a = seg(t, 0.4 + i * 0.09, 0.8 + i * 0.09);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, GY + 4); ctx.rotate(Math.sin(t * 3 + i) * 0.015 * a); ctx.lineJoin = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = 2.4;
    ctx.fillStyle = P.villain; rrect(ctx, -7, -26, 6, 26, 2); ctx.fill(); ctx.stroke(); rrect(ctx, 1, -26, 6, 26, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = EXTRA_COLORS[i]; rrect(ctx, -11, -62, 22, 40, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.kraft; ctx.beginPath(); ctx.arc(0, -72, 9.5, 0, PI2); ctx.fill(); ctx.stroke();
    if (i % 3 === 1) { ctx.fillStyle = P.cowboy; ctx.beginPath(); ctx.ellipse(0, -79, 15, 4, 0, 0, PI2); ctx.fill(); ctx.stroke(); ctx.fillRect(-7, -88, 14, 9); }
    ctx.restore();
  }
  storyPic(ctx, 'lou', 74, GY + 12, 172, { flip: true, ...popOf(t, 0.2, 0.75) }); // Big Lou, facing his extras
  for (let i = 0; i < 3; i++) { // the shout, in rings from the megaphone
    const ph = ((t - 0.8) * 1.8 + i / 3) % 1, a = seg(t, 0.8, 1) * (1 - ph);
    if (a <= 0) continue;
    ctx.globalAlpha = a; ctx.strokeStyle = P.text; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(126, GY - 112, 14 + 64 * ph, -0.5, 0.5); ctx.stroke(); ctx.globalAlpha = 1;
  }
  const p = seg(t, 1.2, 2.9), px = 492; // the newcomer at the end of the line, juggling the gun and finally holding it
  const gx = px - 20 + 14 * Math.sin(p * 9), gyy = GY - 40 - 52 * Math.abs(Math.sin(p * 3 * Math.PI)) * (1 - p * 0.3);
  ctx.globalAlpha = seg(t, 0.9, 1.2); drawPlayer(ctx, px, GY + 6, 0.92, { hand: [(gx - px) / 0.92, (gyy - GY - 6) / 0.92] }); ctx.globalAlpha = 1;
  ctx.save(); ctx.translate(gx, gyy); ctx.rotate(0.3 + 6 * Math.PI * p); drawGunTile(ctx, 'pistol', 0, 0, 40, 18, 'std'); ctx.restore();
}

// ---- 3. Gus: the Prop Room, a wink, and a pistol slid across the counter ----
function sceneGus(ctx, E, t) {
  for (const [id, x, y, w, rot] of [['carbine', 60, 84, 130, -0.12], ['shotgun', 470, 70, 150, 0.1], ['rifle', 90, 168, 120, 0.06], ['revolver', 500, 150, 60, -0.2]]) { // the pegboard's props
    ctx.save(); ctx.globalAlpha = 0.85; ctx.translate(x, y); ctx.rotate(rot); drawGunTile(ctx, id, 0, 0, w, w * 0.4, 'std'); ctx.restore();
  }
  ctx.fillStyle = P.ink; ctx.fillRect(278, 0, 4, 52); ctx.fillStyle = P.steelDark; ctx.beginPath(); ctx.moveTo(262, 66); ctx.lineTo(298, 66); ctx.lineTo(288, 50); ctx.lineTo(272, 50); ctx.fill(); // the lamp
  ctx.globalAlpha = 0.16; disc(ctx, 280, 80, 110, P.orangeLight); ctx.globalAlpha = 1; disc(ctx, 280, 68, 6, P.flashCore);
  const rise = ease.outBack(seg(t, 0.2, 1)), lean = 0.07 * ease.outQuad(seg(t, 1, 1.5)); // Gus leans out over the counter
  storyPic(ctx, 'gus', 196, GY - 16 + 110 * (1 - rise), 236, { rot: lean, alpha: seg(t, 0.15, 0.3) });
  glint(ctx, 214, GY - 196, 11 * ease.outBack(seg(t, 1.45, 1.8)), 1 - seg(t, 1.95, 2.3)); // the wink
  const ea = ease.outQuad(seg(t, 1.2, 1.9)), reach = seg(t, 2.3, 2.9), nx = mix(660, 486, ea); // the newcomer steps up behind the counter and reaches for it
  drawPlayer(ctx, nx, GY - 6, 1.25, { hand: [mix(-30, -66, reach), mix(-72, -26, reach)] });
  ctx.fillStyle = P.counter; ctx.fillRect(-640, GY - 18, 1840, 1200); ctx.fillStyle = P.counterTop; ctx.fillRect(-640, GY - 18, 1840, 8);
  const pa = seg(t, 1.7, 2.5), x = mix(236, 394, ease.outQuad(pa)); // the pistol slides to the newcomer's hand
  if (pa > 0 && pa < 1) { ctx.fillStyle = P.text; ctx.globalAlpha = 0.35 * (1 - pa); for (let i = 0; i < 3; i++) ctx.fillRect(x - 70 - i * 6, GY - 36 + i * 6, 50, 2); ctx.globalAlpha = 1; }
  if (t > 1.7) drawGunTile(ctx, 'pistol', x, GY - 30, 70, 30, 'std');
}

// ---- 4. The Intern scene: the clapperboard, Big Lou's order and Gus's grin ----
function sceneIntern(ctx, E, t) {
  ctx.save(); ctx.globalAlpha = seg(t, 0.1, 0.3); drawRankBoard(ctx, E, 280, 88 - 80 * (1 - ease.outBack(seg(t, 0.1, 0.6))), 200, T.career.ranks[1][0], t - 0.45); ctx.restore();
  storyPic(ctx, 'lou', 116, GY + 12, 168, { flip: true, ...popOf(t, 0.8, 1.35) });
  storyPic(ctx, 'gus', 440, GY - 16 + 120 * (1 - ease.outBack(seg(t, 2.4, 3.1))), 200, { sold: t > 2.9, alpha: seg(t, 2.35, 2.5) });
  glint(ctx, 458, GY - 168, 10 * ease.outBack(seg(t, 3.2, 3.5)), 1 - seg(t, 3.7, 4));
  ctx.fillStyle = P.counter; ctx.fillRect(330, GY - 18, 900, 1200); ctx.fillStyle = P.counterTop; ctx.fillRect(330, GY - 18, 900, 8);
}

// ---- 5. The turn: the star's trailer door slams, his sunglasses are tossed out, Big Lou turns to the newcomer ----
function drawShades(ctx, x, y, rot, s) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); ctx.lineJoin = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = 2;
  ctx.fillStyle = '#15120f'; ctx.beginPath(); ctx.ellipse(-11, 0, 10, 7, 0.1, 0, PI2); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.ellipse(11, 0, 10, 7, -0.1, 0, PI2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-1, -1); ctx.quadraticCurveTo(0, -4, 1, -1); ctx.stroke();
  ctx.fillStyle = P.steelLight; ctx.globalAlpha = 0.7; ctx.fillRect(-16, -4, 5, 2); ctx.fillRect(7, -4, 5, 2);
  ctx.restore();
}
function sceneTurn(ctx, E, t) {
  const open = 1.3 * (1 - ease.inQuad(seg(t, 0.4, 0.8))), thump = t > 0.8 && t < 1.3 ? Math.sin((t - 0.8) * 60) * 2.4 * (1 - seg(t, 0.8, 1.3)) : 0; // the door swings shut and the trailer shudders
  ctx.save(); ctx.translate(thump, 0); ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = P.ink;
  ctx.fillStyle = P.steelLight; rrect(ctx, 16, GY - 128, 236, 118, 16); ctx.fill(); ctx.stroke();
  ctx.fillStyle = P.neonPink; ctx.fillRect(18, GY - 54, 232, 12);
  for (const wx of [70, 202]) { disc(ctx, wx, GY - 6, 15, P.steelDark); ctx.beginPath(); ctx.arc(wx, GY - 6, 15, 0, PI2); ctx.stroke(); disc(ctx, wx, GY - 6, 5, P.steelLight); }
  const dark = t > 1.05; // the window is dark once the shades have gone through it
  ctx.fillStyle = dark ? P.stage : P.cyan; ctx.globalAlpha = dark ? 1 : 0.55; rrect(ctx, 50, GY - 104, 62, 40, 5); ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
  ctx.fillStyle = P.stage; ctx.fillRect(166, GY - 100, 46, 90); // the doorway
  const dw = 46 * Math.cos(open); ctx.fillStyle = P.steel; ctx.fillRect(166, GY - 100, dw, 90); ctx.strokeRect(166, GY - 100, dw, 90);
  if (dw > 18) drawStar(ctx, 166 + dw / 2, GY - 56, 9, P.brass, P.ink);
  ctx.restore();
  puff(ctx, 190, GY - 2, t, 0.8, 14); puff(ctx, 160, GY - 2, t, 0.85, 10);
  const pa = seg(t, 1.1, 1.85), bk = seg(t, 1.85, 2.2), bounce = Math.sin(bk * Math.PI) * 9 * (1 - bk * 0.5); // the sunglasses, tossed out of the window and bouncing once
  const sx = mix(90, 290, pa), sy = mix(GY - 84, GY - 5, ease.inQuad(pa)) - 80 * Math.sin(Math.PI * pa) * (1 - pa * 0.2) - bounce;
  if (t > 1.1) drawShades(ctx, sx, sy, 0.25 + 8 * (1 - pa), 1.25);
  const la = ease.outQuad(seg(t, 1.9, 2.5)), lean = -0.09 * ease.outQuad(seg(t, 3.5, 4)); // Big Lou walks on, then leans toward the newcomer
  if (la > 0) storyPic(ctx, 'lou', mix(660, 480, la), GY + 12, 186, { rot: lean, alpha: seg(t, 1.9, 2.1) });
  const ea = ease.outQuad(seg(t, 3.1, 3.8)), hop = Math.abs(Math.sin(ea * Math.PI * 2)) * 6 * (1 - ea); // the newcomer comes in from the left with a small hop, and sweats
  if (ea > 0) drawPlayer(ctx, mix(-40, 356, ea), GY + 4 - hop, 1.1, { sweat: seg(t, 4.1, 4.5) });
}

// ---- 6. The ending: the premiere, the sign torn down, flashbulbs, Big Lou's thanks and Gus clapping in the front row ----
const FLASHES = [[0.9, 256, 204], [1.2, 322, 208], [1.55, 290, 212], [2.0, 256, 204], [2.45, 322, 208], [2.75, 290, 212], [3.3, 256, 204], [3.7, 322, 208], [4.3, 290, 212], [4.8, 256, 204]]; // [time, x, y]
function sceneEnding(ctx, E, t) {
  const bl = 250, bw = 290; // the picture palace
  ctx.fillStyle = P.stageHi; ctx.strokeStyle = P.ink; ctx.lineWidth = 3; rrect(ctx, bl, 40, bw, GY - 40, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#1b1626'; rrect(ctx, bl + 6, 46, bw - 12, 76, 4); ctx.fill(); ctx.stroke(); // the marquee
  const chase = Math.floor(t * 5) % 2;
  for (let i = 0; i < 14; i++) for (const y of [51, 117]) disc(ctx, bl + 14 + i * ((bw - 28) / 13), y, 2.6, (i + chase) % 2 === 0 && t > 0.3 ? P.flashCore : P.lamp);
  sText(ctx, 'RECOIL', bl + bw / 2, 86, 34, P.brassText);
  const fx = bl + bw / 2 - 42, fy = 132, fw = 84, fh = 100, mx = fx + fw / 2; // the poster in its frame: the newcomer's silhouette
  ctx.fillStyle = P.ink; ctx.fillRect(fx - 4, fy - 4, fw + 8, fh + 8);
  ctx.save(); ctx.beginPath(); ctx.rect(fx, fy, fw, fh); ctx.clip(); ctx.translate(0, -120 * (1 - ease.outBack(seg(t, 0.3, 1))));
  const pg = ctx.createLinearGradient(0, fy, 0, fy + fh); pg.addColorStop(0, '#ff4fa3'); pg.addColorStop(1, '#f97316'); ctx.fillStyle = pg; ctx.fillRect(fx, fy, fw, fh);
  ctx.globalAlpha = 0.3; ctx.fillStyle = P.flashCore; ctx.beginPath(); ctx.moveTo(fx + 10, fy + fh); ctx.lineTo(fx + 36, fy); ctx.lineTo(fx + 48, fy); ctx.lineTo(fx + 30, fy + fh); ctx.fill(); ctx.globalAlpha = 1;
  ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(mx, fy + 40, 8, 0, PI2); ctx.fill(); ctx.fillRect(mx - 9, fy + 49, 18, 24); ctx.fillRect(mx - 9, fy + 72, 7, 28); ctx.fillRect(mx + 2, fy + 72, 7, 28);
  ctx.lineWidth = 6; ctx.strokeStyle = P.ink; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(mx + 8, fy + 53); ctx.lineTo(mx + 22, fy + 38); ctx.lineTo(mx + 34, fy + 36); ctx.stroke(); ctx.lineCap = 'butt'; // an arm up, a pistol in the hand
  ctx.fillRect(mx + 30, fy + 31, 12, 5);
  for (let i = -1; i <= 1; i++) drawStar(ctx, mx + i * 18, fy + 12, i ? 4.5 : 6, P.brass);
  ctx.restore();
  ctx.fillStyle = P.stageHi; ctx.strokeStyle = P.ink; ctx.lineWidth = 3; rrect(ctx, 6, 100, 24, GY - 100, 3); ctx.fill(); ctx.stroke(); // the gate's pillar and the sign: swinging, jerked up, torn down, left lying
  const th0 = 0.2 + 0.4 * Math.exp(-2 * Math.max(0, t - 0.3)) * Math.cos(8 * Math.max(0, t - 0.3)), th = mix(th0, -0.35, ease.outQuad(seg(t, 1.45, 1.7)));
  const hx = 18 + Math.cos(th) * 60 - Math.sin(th) * 14, hy = 150 + Math.sin(th) * 60 + Math.cos(th) * 14;
  if (t < 1.7) { forSale(ctx, hx, hy, th, 132); disc(ctx, 18, 150, 3.4, P.steelLight); }
  else {
    const fall = t - 1.7, fr = seg(t, 1.7, 2.1), bk = seg(t, 2.1, 2.45);
    forSale(ctx, mix(hx, 66, fr), Math.min(GY - 14, hy + 550 * fall * fall) - Math.sin(bk * Math.PI) * 6 * (1 - bk), mix(th, 0.08, ease.outQuad(fr)), 132);
  }
  puff(ctx, 62, GY - 4, t, 2.1, 14);
  for (const [ft, px, py] of FLASHES) { // the photographers' flashbulbs, one small flash at a time
    ctx.fillStyle = P.ink; ctx.fillRect(px - 8, py + 4, 16, 22); disc(ctx, px, py - 2, 7, P.ink); ctx.fillRect(px + 4, py - 6, 12, 9);
    glint(ctx, px + 12, py - 2, 26 * ease.outQuad(seg(t, ft, ft + 0.06)), 1 - seg(t, ft + 0.06, ft + 0.26));
  }
  storyPic(ctx, 'louOk', 170, GY + 14, 178, popOf(t, 2.3, 2.85));
  for (let i = 0; i < 4; i++) glint(ctx, 128 + i * 22, GY - 190 - (i % 2) * 14, 7 * seg(t, 2.8 + i * 0.1, 3.1 + i * 0.1), 1 - seg(t, 3.5, 3.9), P.brassText); // the stars he is seeing
  for (const [hx2, hh] of [[556, 112]]) { // the front row's heads
    ctx.fillStyle = '#241c2c'; ctx.strokeStyle = P.ink; ctx.lineWidth = 2.4; rrect(ctx, hx2 - 20, GY - hh + 24, 40, hh, 12); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(hx2, GY - hh + 14, 12, 0, PI2); ctx.fill(); ctx.stroke();
  }
  const gp = ease.outBack(seg(t, 3.3, 3.9)), clap = t > 3.9 ? Math.abs(Math.sin((t - 3.9) * 12)) : 0; // Gus, clapping
  storyPic(ctx, 'gus', 497, GY + 12 + 90 * (1 - gp), 168, { sy: 1 + 0.03 * clap, alpha: seg(t, 3.3, 3.45) });
  if (clap > 0.85) for (let i = -1; i <= 1; i++) { ctx.strokeStyle = P.flashCore; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(462 + i * 7, GY - 52 - Math.abs(i) * 4); ctx.lineTo(456 + i * 13, GY - 62 - Math.abs(i) * 4); ctx.stroke(); }
  ctx.fillStyle = '#2a1f2b'; ctx.fillRect(404, GY - 4, 1200, 1200); ctx.fillStyle = P.brass; ctx.fillRect(404, GY - 4, 1200, 5); // the barrier in front of the front row, with its rope
  for (const x of [410, 596]) { ctx.fillStyle = P.brass; ctx.fillRect(x - 2, GY - 34, 4, 32); disc(ctx, x, GY - 36, 5, P.brass); }
  ctx.strokeStyle = '#9d1f3a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(410, GY - 36); ctx.quadraticCurveTo(503, GY - 14, 596, GY - 36); ctx.stroke();
}

// Each scene: its drawing, whether it is the Prop Room (a pegboard wall) or the premiere night, its lines (when each fades in, and Gus's in brass) and its sounds as [time, kind].
const SCENES = {
  lot: { draw: sceneLot, beats: [{ at: 1.0, text: STORY.open[0] }], cues: [[1.0, 'thud'], [1.4, 'ting']] },
  extras: { draw: sceneExtras, beats: [{ at: 1.0, text: STORY.open[1] }], cues: [[0.5, 'shout'], [2.9, 'ting']] },
  gus: { draw: sceneGus, room: true, beats: [{ at: 1.2, text: STORY.open[2], tone: 'gus' }], cues: [[1.55, 'ting'], [1.75, 'slide']] },
  intern: { draw: sceneIntern, beats: [{ at: 1.2, text: STORY.intern[0] }, { at: 2.9, text: STORY.intern[1], tone: 'gus' }], cues: [[0.72, 'clack'], [0.95, 'shout'], [3.2, 'ting']] },
  turn: { draw: sceneTurn, beats: [{ at: 2.4, text: STORY.turn[0] }, { at: 4.0, text: STORY.turn[1] }], cues: [[0.8, 'thud'], [1.8, 'clack'], [2.1, 'shout']] },
  ending: { draw: sceneEnding, night: true, beats: [{ at: 2.9, text: STORY.ending[0] }, { at: 3.9, text: STORY.ending[1], tone: 'gus' }], cues: [[0.9, 'flash'], [1.55, 'flash'], [1.75, 'thud'], [2.45, 'flash'], [2.6, 'fanfare'], [3.3, 'flash'], [4.1, 'clap'], [4.3, 'clap'], [4.5, 'clap'], [4.8, 'flash']] },
};
const sceneLen = (id) => T.scenes[id];
// Sounds and a shake only (no haptics: the cold open plays before the first tap, and the browser refuses a vibration then).
const CUES = {
  thud: (E) => { E.audio.beep({ freq: 90, dur: 0.14, type: 'square', gain: 0.1, slide: 0.6 }); E.shake(4, 0.2); },
  clack: (E) => { E.audio.beep({ freq: 1400, dur: 0.03, type: 'square', gain: 0.06 }); E.shake(2, 0.12); },
  ting: (E) => { E.audio.beep({ freq: 1320, dur: 0.12, type: 'sine', gain: 0.05 }); E.audio.beep({ freq: 1760, dur: 0.16, type: 'sine', gain: 0.04, delay: 0.07 }); },
  shout: (E) => { E.audio.beep({ freq: 220, dur: 0.18, type: 'sawtooth', gain: 0.05, slide: 1.4 }); },
  slide: (E) => { E.audio.beep({ freq: 500, dur: 0.3, type: 'triangle', gain: 0.04, slide: 0.4 }); },
  flash: (E) => { E.audio.beep({ freq: 2400, dur: 0.02, type: 'square', gain: 0.03 }); },
  fanfare: (E) => { E.audio.beep({ freq: 523, dur: 0.16, type: 'triangle', gain: 0.07 }); E.audio.beep({ freq: 659, dur: 0.16, type: 'triangle', gain: 0.07, delay: 0.14 }); E.audio.beep({ freq: 784, dur: 0.34, type: 'triangle', gain: 0.07, delay: 0.28 }); },
  clap: (E) => { E.audio.beep({ freq: 1800, dur: 0.025, type: 'square', gain: 0.03 }); },
};
// What a scene marks as seen when it shows: the Intern scene is careerSeen 1, the turn and the ending have their own flags.
const SCENE_MARK = { intern: ['careerSeen', 1], turn: ['turnSeen', true], ending: ['endSeen', true] };
function markScene(E, id) { const m = SCENE_MARK[id]; if (m) E.save.set(m[0], typeof m[1] === 'number' ? Math.max(E.save.get(m[0], 0), m[1]) : m[1]); }

// The story player: the cold open (three scenes), the Intern scene, the turn and the ending, and a poster's card. `cards` is a list of { kind: 'scene', id } | { kind: 'poster', set }; `then` is the
// [scene, params] to go to after the last card or Skip. A scene jumps to its end on a tap, goes on at the next one and by itself `autoGap` seconds after it ends; a poster card goes on at a tap. Skip
// leaves at once and is always there, and nothing here waits on the player's input beyond the short lock after a card appears.
const OPEN_CARDS = ['lot', 'extras', 'gus'].map((id) => ({ kind: 'scene', id }));
const story = {
  enter(E, params) {
    const p = params && params.cards ? params : { cards: OPEN_CARDS, then: ['menu'], cold: true }; // no params: the cold open
    this.cards = p.cards; this.then = p.then || ['menu']; this.cold = !!p.cold; this.i = 0; this.skip = null;
    if (this.cold) E.save.set('openSeen', T.scenes.version); // marked as it opens, so closing the app half way never repeats it
    this.begin(E);
  },
  begin(E) {
    const c = this.cards[this.i];
    this.t0 = E.time; this.tapT = E.time; this.heard = 0;
    if (c.kind === 'scene') markScene(E, c.id); // the card has been shown
  },
  finish(E) {
    for (const c of this.cards) if (c.kind === 'scene') markScene(E, c.id); // skipped is seen
    E.setScene(this.then[0], this.then[1]);
  },
  advance(E) { if (++this.i >= this.cards.length) this.finish(E); else this.begin(E); },
  update(dt, E) {
    const c = this.cards[this.i];
    if (c.kind !== 'scene') return;
    const d = sceneLen(c.id), t = Math.min(E.time - this.t0, d);
    for (const [at, kind] of SCENES[c.id].cues) if (at > this.heard && at <= t) CUES[kind](E);
    this.heard = Math.max(this.heard, t);
    if (E.time - this.t0 >= d + T.scenes.autoGap) this.advance(E);
  },
  render(ctx, E) {
    const c = this.cards[this.i], age = E.time - this.t0, K = T.scenes, sf = E.safe;
    ctx.fillStyle = P.stageLow; ctx.fillRect(0, 0, E.w, E.h);
    if (c.kind === 'scene') this.renderScene(ctx, E, c, Math.min(age, sceneLen(c.id)));
    else this.renderPoster(ctx, E, c, age, E.w >= E.h * 1.2);
    this.skip = btn(E, 'Skip', E.w - sf.right - 16 - K.skipW / 2, sf.top + 8 + K.skipH / 2, { w: K.skipW, h: K.skipH, size: TY.small, fill: P.panelHi });
  },
  // A scene: the art box under the Skip row, the lines on a plate at the bottom (each fades in at its beat; the plate is sized for all of them, so nothing moves) and a triangle when a tap goes on.
  renderScene(ctx, E, c, t) {
    const sc = SCENES[c.id], K = T.scenes, sf = E.safe, aw = E.w - sf.left - sf.right, cx = sf.left + aw / 2, capW = Math.min(aw - 96, 520), lh = 24;
    const all = sc.beats.flatMap((b) => wrapText(ctx, b.text, capW - 28, TY.mid).map((ln) => ({ ln, at: b.at, tone: b.tone })));
    const capH = all.length * lh + 16, capTop = E.h - sf.bottom - 12 - capH, artTop = sf.top + 8 + K.skipH + 6, artH = capTop - 8 - artTop;
    const k = Math.min((aw - 16) / SW, artH / SH), bx = cx - SW * k / 2, by = artTop + (artH - SH * k) / 2;
    if (sc.room) { // Gus's Prop Room: the pegboard wall behind
      const gy = by + (GY - 18) * k;
      ctx.fillStyle = MPAT.peg || P.pegboard; ctx.fillRect(0, 0, E.w, gy); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 0, E.w, gy);
    } else drawDusk(ctx, E, k, bx, by, t, !!sc.night);
    sceneK = k;
    ctx.save(); ctx.translate(bx, by); ctx.scale(k, k); sc.draw(ctx, E, t); ctx.restore();
    if (t < 0.3) { ctx.globalAlpha = 1 - seg(t, 0, 0.3); ctx.fillStyle = P.stageLow; ctx.fillRect(0, 0, E.w, E.h); ctx.globalAlpha = 1; } // the scene fades in from black
    ctx.fillStyle = P.stageLow; ctx.fillRect(0, capTop - 8, E.w, E.h - capTop + 8); // the ground under the lines
    if (all.some((l) => t >= l.at)) plate(E, cx - capW / 2, capTop, capW, capH, P.panel, P.panelEdge, 12);
    all.forEach((l, i) => { const a = seg(t, l.at, l.at + 0.5); if (a > 0) E.text(l.ln, cx, capTop + 8 + lh / 2 + i * lh - (1 - a) * 5, { size: TY.mid, color: l.tone === 'gus' ? P.brassText : P.text, alpha: a }); });
    if (t >= sceneLen(c.id)) { // the triangle that says a tap goes on
      const m = 1 + 0.15 * Math.sin(E.time * 6), tx = E.w - sf.right - 26, ty = E.h - sf.bottom - 26;
      ctx.fillStyle = P.textDim; ctx.beginPath(); ctx.moveTo(tx - 7 * m, ty - 9 * m); ctx.lineTo(tx + 9 * m, ty); ctx.lineTo(tx - 7 * m, ty + 9 * m); ctx.closePath(); ctx.fill();
    }
  },
  // A premiere poster's card: the stage, the poster and its line, as in v0.7.
  renderPoster(ctx, E, c, age, land) {
    const sf = E.safe, pad = 24 + Math.max(sf.left, sf.right), top = sf.top, bot = E.h - sf.bottom, a = clamp(age / T.career.fade, 0, 1);
    drawStage(ctx, E);
    let art, tb;
    if (land) { const aw = Math.min(250, E.w * 0.32), ay = top + 64; art = { x: pad, y: ay, w: aw, h: bot - ay - 40 }; tb = { x: pad + aw + pad, w: E.w - pad - (pad + aw + pad), cy: (top + bot) / 2 }; }
    else { const ah = Math.min(E.h * 0.38, 320); art = { x: pad, y: top + 72, w: E.w - 2 * pad, h: ah }; tb = { x: pad, w: E.w - 2 * pad, cy: top + 72 + ah + (bot - top - 72 - ah) * 0.42 }; }
    ctx.globalAlpha = a;
    const pw = Math.min(art.w, art.h / 1.5), ph = pw * 1.5; drawPoster(ctx, E, art.x + (art.w - pw) / 2, art.y + (art.h - ph) / 2, pw, ph, c.set, pw >= 170 ? TY.mid : TY.small);
    ctx.globalAlpha = 1;
    const tx = tb.x + tb.w / 2, lines = wrapText(ctx, STORY.premiere, Math.min(tb.w - 8, 520), TY.mid), lh = 24, y = tb.cy - lines.length * lh / 2;
    lines.forEach((ln, i) => E.text(ln, tx, y + lh / 2 + i * lh, { size: TY.mid, color: P.text, alpha: a }));
    E.text('Tap to continue', E.w / 2, bot - 22, { size: TY.small, color: P.textDim, alpha: clamp((age - 0.4) / 0.4, 0, 1) });
  },
  onTap(p, E) {
    if (this.skip && E.hit(this.skip, p)) { E.audio.play('tap'); this.finish(E); return; }
    if (E.time - this.tapT < T.career.lock) return; // a tap meant for the card before it (the result card's button), or a double tap, does not count
    const c = this.cards[this.i];
    E.audio.play('tap', 0.6);
    if (c.kind === 'scene' && E.time - this.t0 < sceneLen(c.id)) { this.t0 = E.time - sceneLen(c.id); this.heard = sceneLen(c.id); this.tapT = E.time; return; } // jump to the scene's end
    this.advance(E);
  },
  onKey(key, E) { if (key === 'Escape') this.finish(E); else if (key === ' ' || key === 'Enter') this.onTap({ x: -1, y: -1 }, E); },
};

// The career screen: the rank ladder, and the poster wall (one slot per set; a released one shows its poster, a tap replays its card, an unreleased one says in a line what releases it). Story replays the cold open.
const career = {
  enter() { this.back = this.btnStory = null; this.slots = []; },
  layout(E) {
    const land = E.w >= E.h * 1.2, side = 16 + Math.max(E.safe.left, E.safe.right), W = Math.min(E.w - 2 * side, land ? 780 : 560), x0 = (E.w - W) / 2, top = E.safe.top, gap = 8, py = top + 92;
    const cols = land ? 6 : 3, rows = land ? 1 : 2, pw0 = (W - (cols - 1) * gap) / cols, room = E.h - E.safe.bottom - py - (land ? 132 : 140) - (rows - 1) * gap;
    const ph = Math.min(pw0 * 1.5, room / rows), pw = ph / 1.5, slots = [];
    POSTER_SETS.forEach((set, i) => { const cx = x0 + (W - (cols * pw + (cols - 1) * gap)) / 2 + (i % cols) * (pw + gap); slots.push({ set, x: cx, y: py + Math.floor(i / cols) * (ph + gap), w: pw, h: ph }); });
    const end = py + rows * ph + (rows - 1) * gap; // the poster wall's bottom edge: the studio-funds row (v0.9 C) under it, then the rank ladder
    return { W, x0, top, slots, fundsY: end + 22, barY: end + 66 };
  },
  render(ctx, E) {
    const L = this.layout(E), ci = careerInfo(E), pm = postersMap(E), R = T.career.ranks;
    this.back = btn(E, 'Back', L.x0 + 42, L.top + 30, { w: 84, h: 48, size: TY.small, fill: P.slate });
    this.btnStory = btn(E, 'Story', L.x0 + L.W - 42, L.top + 30, { w: 84, h: 48, size: TY.small, fill: P.panelHi });
    E.text('Career', E.w / 2, L.top + 30, { size: TY.mid + 2, weight: TY.strong, color: P.text });
    const cw = Math.min(E.w - 2 * (16 + Math.max(E.safe.left, E.safe.right)), L.W), sum = `${ci.name}  ·  ${ci.n} / ${CAREER_MAX} stars`, tail = ci.next ? `${ci.toNext} to ${ci.next}` : '';
    ctx.font = `${TY.strong} ${TY.small}px system-ui, sans-serif`; // one line when the whole summary fits, else the rank and stars over the next rank
    if (!tail || ctx.measureText(`${sum}  ·  ${tail}`).width <= cw) E.text(tail ? `${sum}  ·  ${tail}` : sum, E.w / 2, L.top + 66, { size: TY.small, weight: TY.strong, color: P.cyan });
    else { E.text(fitText(ctx, sum, cw, TY.small, TY.strong), E.w / 2, L.top + 61, { size: TY.small, weight: TY.strong, color: P.cyan }); E.text(fitText(ctx, tail, cw, TY.small, TY.strong), E.w / 2, L.top + 79, { size: TY.small, weight: TY.strong, color: P.cyan }); }
    this.slots = L.slots;
    this.drawFunds(ctx, E, L, pm);
    for (const s of L.slots) { if (pm[s.set]) drawPoster(ctx, E, s.x, s.y, s.w, s.h, s.set, TY.small); else drawPosterSlot(ctx, E, s.x, s.y, s.w, s.h); }
    // the rank ladder: four pips on a bar, the names under them; the bar fills up to the player's place
    const n = R.length, bx = L.x0 + 40, bw = L.W - 80, by = L.barY, seg = bw / (n - 1);
    E.roundRect(bx, by - 3, bw, 6, 3, P.panelEdge);
    E.roundRect(bx, by - 3, Math.max(6, seg * Math.min(n - 1, ci.rank + (ci.next ? ci.frac : 0))), 6, 3, P.brass);
    R.forEach(([name], i) => {
      const x = bx + i * seg, on = i <= ci.rank;
      disc(ctx, x, by, 8, on ? P.brass : P.panelEdge); ctx.lineWidth = 2; ctx.strokeStyle = P.ink; ctx.beginPath(); ctx.arc(x, by, 8, 0, PI2); ctx.stroke();
      E.text(name, x, by + 24 + (seg < 110 && i % 2 ? 20 : 0), { size: TY.small, weight: TY.strong, color: i === ci.rank ? P.brassText : on ? P.text : P.textDim }); // alternate rows when the names would touch
    });
  },
  // The studio-funds bar (v0.9 C): the gate's sign (FOR SALE, and NOT FOR SALE once all six films are out), a bar of six segments and the box office the posters have added, one each.
  drawFunds(ctx, E, L, pm) {
    const n = POSTER_SETS.filter((set) => pm[set]).length, full = n >= POSTER_SETS.length, y = L.fundsY, label = `box office +${n}`, sign = full ? 'NOT FOR SALE' : 'FOR SALE';
    ctx.font = `${TY.strong} ${TY.small}px system-ui, sans-serif`;
    const sw = Math.ceil(ctx.measureText(sign).width) + 18, lw = Math.ceil(ctx.measureText(label).width), bx = L.x0 + sw + 12, bw = L.x0 + L.W - lw - 12 - bx, seg6 = (bw - 5 * 3) / POSTER_SETS.length;
    plate(E, L.x0, y - 13, sw, 26, full ? P.brass : P.paper, P.ink, 5);
    E.text(sign, L.x0 + sw / 2, y, { size: TY.small, weight: TY.strong, color: full ? P.ink : P.red });
    POSTER_SETS.forEach((_, i) => E.roundRect(bx + i * (seg6 + 3), y - 5, seg6, 10, 3, i < n ? P.brass : P.panelEdge));
    E.text(label, L.x0 + L.W, y, { size: TY.small, weight: TY.strong, align: 'right', color: n ? P.brassText : P.textDim });
  },
  onTap(p, E) {
    if (E.hit(this.back, p)) { E.audio.play('tap'); E.setScene('menu'); return; }
    if (E.hit(this.btnStory, p)) { E.audio.play('tap'); E.setScene('story', { cards: OPEN_CARDS, then: ['career'] }); return; }
    const s = this.slots.find((q) => E.hit(q, p));
    if (!s) return;
    if (postersMap(E)[s.set]) { E.audio.play('tap'); E.setScene('story', { cards: [{ kind: 'poster', set: s.set }], then: ['career'] }); return; }
    E.audio.play('tap', 0.3);
    E.toast(s.set === 'endless' ? STORY.hint.endless(T.career.endlessWave) : `Three stars on every ${A.setName[s.set]} rung with one gun release it`);
  },
};

const menu = {
  enter(E) {
    this.tiles = []; this.guns = []; this.btnEndless = null; this.btnMute = null; this.btnMissions = null; this.btnPlay = null; this.btnProps = null; this.play = null; this.dot = false;
    this.pop = popRung && popRung.gun === gunId(E) ? { id: popRung.id, t0: E.time } : null; popRung = null; // a rung whose stars rose swells once
    this.btnCareer = null;
    if ((Number(E.save.get('openSeen', 0)) || 0) < T.scenes.version) E.setScene('story'); // v0.9: the three scenes of the cold open show once to every save below the story version (Skip leaves at once)
  },
  render(ctx, E) {
    const gid = gunId(E), play = frontier(E, gid), L = menuLayout(E, `Play ${play.name}`);
    prepMenu(E.dpr, ctx);
    drawVHS(ctx, E); // the scan lines: the menu's background only, under everything
    E.titleArea = L.titleArea; // release: five taps on the logo show TUNE
    drawLogo(ctx, E, L.logo, L.land);
    this.btnCareer = L.career; drawCareerPlate(ctx, E, L.career, careerInfo(E));
    if (L.land) drawPegboard(ctx, L.rack[0].x - 5, L.rack[0].y - 3, L.rack[L.rack.length - 1].x + L.rack[L.rack.length - 1].w - L.rack[0].x + 10, A.menu.rackH + 7); // the prop rack
    this.guns = [];
    if (L.panel) { drawRackSelected(ctx, E, L.panel, gid); this.guns.push(L.panel); }
    for (const b of L.rack) {
      const open = gunUnlocked(E, b.id);
      if (b.small) { drawRackSmall(ctx, E, b, open); if (b.sel) { ctx.strokeStyle = P.orange; ctx.lineWidth = 2; rrect(ctx, b.x, b.y, b.w, b.h, A.radius); ctx.stroke(); } }
      else if (b.sel) drawRackSelected(ctx, E, b, b.id); else drawRackSmall(ctx, E, b, open);
      this.guns.push(b);
    }
    this.tiles = []; this.play = play;
    const pu = this.pop ? clamp((E.time - this.pop.t0 - A.pop.delay) / A.pop.sec, 0, 1) : 0, popK = 1 + A.pop.amp * Math.sin(Math.PI * pu); // the swelling rung is drawn last, over its neighbours
    let popped = null;
    for (const row of L.rows) {
      E.text(row.label, row.x, row.y + row.h / 2 - 9, { size: TY.small, weight: TY.strong, align: 'left', color: P.text }); // the mode, and under it its set (v0.6 C)
      E.text(fitText(ctx, A.setName[row.ladder], row.labelW - 6, TY.small, TY.normal), row.x, row.y + row.h / 2 + 9, { size: TY.small, align: 'left', color: P.textDim });
      CHALLENGES.filter((c) => c.ladder === row.ladder).forEach((ch, i) => {
        const x = row.x + row.labelW + i * (row.tw + row.gap), locked = !isUnlocked(E, ch, gid), t = { x, y: row.y, w: row.tw, h: row.h, ch, locked };
        this.tiles.push(t);
        if (this.pop && ch.id === this.pop.id && pu > 0 && pu < 1) popped = t; else drawRungTile(ctx, E, x, row.y, row.tw, row.h, ch, locked, starsOf(E, ch, gid), ch === play && !locked, 1, toughPair(ch, gid));
      });
    }
    if (popped) drawRungTile(ctx, E, popped.x, popped.y, popped.w, popped.h, popped.ch, popped.locked, starsOf(E, popped.ch, gid), popped.ch === play && !popped.locked, popK, toughPair(popped.ch, gid));
    const h = L.hint, lines = wrapText(ctx, menuHint(E, gid), h.w, TY.small).slice(0, 2);
    lines.forEach((ln, i) => E.text(ln, h.x + h.w / 2, h.y + h.h / 2 + (i - (lines.length - 1) / 2) * 18, { size: TY.small, color: P.textDim }));
    const two = (r, a, b2, fill, edge) => { plate(E, r.x, r.y, r.w, r.h, fill, edge); E.text(a, r.x + r.w / 2, r.y + r.h / 2 - (b2 ? 8 : 0), { size: TY.small, weight: TY.strong }); if (b2) E.text(fitText(E.ctx, b2, r.w - 12, TY.small, TY.normal), r.x + r.w / 2, r.y + r.h / 2 + 9, { size: TY.small, color: P.textDim }); return r; }; // the second line only when there is something to say
    const zz = E.save.get('zend', null), d = zz && typeof zz === 'object' ? zz : {}, today = d.day === (E.dailySeed ? E.dailySeed() : 0) && d.today ? d.today.score : 0;
    this.btnMissions = btn(E, 'Missions', L.missions.x + L.missions.w / 2, L.missions.y + L.missions.h / 2, { w: L.missions.w, h: L.missions.h, fill: P.panelHi, size: TY.small });
    this.dot = unseenBadges(E).length > 0; // an earned badge not yet seen on the missions screen
    if (this.dot) { ctx.lineWidth = 2; ctx.strokeStyle = P.ink; disc(ctx, L.missions.x + L.missions.w - 6, L.missions.y + 6, A.menu.dotR, P.orange); ctx.stroke(); }
    this.btnEndless = two(L.endless, 'Endless', today ? `Today ${today < 10000 ? today : `${Math.round(today / 1000)}k`}` : '', P.panelHi, P.cyan);
    this.btnMute = soundButton(ctx, E, L.mute, E.audio.muted);
    this.btnPlay = btn(E, `Play ${play.name}`, L.play.x + L.play.w / 2, L.play.y + L.play.h / 2, { w: L.play.w, h: L.play.h, fill: P.orange, color: P.ink, size: TY.mid });
    const pr = L.props; plate(E, pr.x, pr.y, pr.w, pr.h, P.counter, P.ink); ctx.fillStyle = P.counterTop; rrect(ctx, pr.x + 2, pr.y + 2, pr.w - 4, 6, 3); ctx.fill(); // the Prop Room: a counter-top button
    const tagged = pr.w >= A.menu.propsTag; if (tagged) drawTag(ctx, pr.x + 22, pr.y + pr.h / 2); // the tag only where the label leaves room for it
    E.text('Prop Room', pr.x + pr.w / 2 + (tagged ? 10 : 0), pr.y + pr.h / 2 + 1, { size: TY.small, weight: TY.strong, color: P.text });
    this.btnProps = pr;
  },
  onTap(p, E) {
    if (E.hit(this.btnPlay, p)) { E.audio.play('tap'); E.setScene('play', { id: this.play.id }); return; }
    if (E.hit(this.btnMute, p)) { E.audio.toggleMute(); E.audio.play('tap'); return; }
    if (E.hit(this.btnMissions, p)) { E.audio.play('tap'); E.setScene('missions'); return; }
    if (E.hit(this.btnEndless, p)) { E.audio.play('tap'); E.setScene('play', { id: ENDLESS.id }); return; }
    if (E.hit(this.btnProps, p)) { E.audio.play('tap'); E.setScene('props'); return; }
    if (E.hit(this.btnCareer, p)) { E.audio.play('tap'); E.setScene('career'); return; }
    for (const b of this.guns) if (E.hit(b, p)) {
      if (!gunUnlocked(E, b.id)) { E.audio.play('tap'); E.setScene('props'); } // a gun not owned: the Prop Room, where it is bought or says what opens it
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

// Missions (v0.5 Q, the Ink standard): the badges in four named tiers, each headed "earned / total", in one column that scrolls by drag (or the 44 px rail on its right). A card is a
// medal, the name and a condition of about six words; an unearned badge that counts something carries its counter, and one that opens a gun shows the gun. Earned cards are bright
// and bordered, unearned ones shaded; a badge earned since the last visit carries a dot. A tap on an unearned card says, in one line, what earns it and what it opens. The gauntlet starts here.
const missions = {
  enter(E) {
    this.back = null; this.btnGauntlet = null; this.reason = ''; this.scroll = 0; this.drag = null; this.v = null; this.rail = null; this.cards = [];
    const fresh = unseenBadges(E); this.fresh = new Set(fresh); this.focus = fresh.length > 0; // the dot on the menu clears: these are seen now
    if (fresh.length) E.save.update('seen', (m) => ({ ...(m && typeof m === 'object' ? m : {}), ...Object.fromEntries(fresh.map((id) => [id, 1])) }), {});
  },
  // The list laid out top to bottom: a heading per tier, then its cards (a long condition wraps and the card grows). Offsets are from the top of the list.
  rows(ctx, textW) {
    const M = A.missions, out = []; let y = 0;
    for (const tier of BADGE_TIERS) {
      const list = BADGES.filter((b) => b.tier === tier.key);
      out.push({ tier, list, y, h: M.headH }); y += M.headH;
      for (const b of list) { const lines = wrapText(ctx, badgeLine(b), textW, TY.small), h = M.cardH + (lines.length - 1) * M.lineH; out.push({ b, lines, y, h, gun: GUN_IDS.find((g) => T.unlockBadges[g] === b.id) }); y += h + M.gap; }
    }
    return { out, h: y - M.gap };
  },
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
    this.btnGauntlet = btn(E, open ? 'Montage' : '', gx, gy, { w: gw, h: 44, size: TY.small, fill: open ? P.orange : P.panelHi, color: P.ink }); // v0.6: the gauntlet is the training montage
    if (!open) {
      ctx.font = `${TY.strong} ${TY.small}px system-ui, sans-serif`;
      const tw = ctx.measureText('Montage').width, all = M.lock + M.lockGap + tw, x = gx - all / 2;
      drawLock(ctx, x + M.lock / 2, gy, P.textDim);
      E.text('Montage', x + M.lock + M.lockGap + tw / 2, gy, { size: TY.small, weight: TY.strong, color: P.textDim });
    }
    let listTop = top + (land ? 62 : 80);
    if (!open && !land) { // portrait has the room to say why, under the header; landscape says it on tap
      wrapText(ctx, this.reason, W, TY.small).forEach((ln, k) => E.text(ln, E.w / 2, listTop - 6 + k * 18, { size: TY.small, color: P.textDim })); listTop += 40;
    }
    const listBottom = E.h - E.safe.bottom - 8, viewH = listBottom - listTop, listW = W - M.rail - 8; // the rail always has its room: the list is longer than any screen
    const textW = listW - M.pad * 2 - 2 * M.medalR - M.pad - M.gunW - M.pad, R = this.rows(ctx, textW), max = Math.max(0, R.h - viewH);
    if (this.focus) { this.focus = false; const f = R.out.find((r) => r.b && this.fresh.has(r.b.id)), h = f && R.out.find((r) => r.tier && r.tier.key === f.b.tier); if (h) this.scroll = h.y; } // open on the tier of the first badge that is new
    this.scroll = clamp(this.scroll, 0, max);
    this.v = { x0, W, listTop, listBottom, viewH, max, listW, contentH: R.h };
    this.cards = [];
    ctx.save(); ctx.beginPath(); ctx.rect(x0 - 8, listTop, W + 16, viewH); ctx.clip();
    for (const r of R.out) {
      const y = listTop + r.y - this.scroll;
      if (y + r.h < listTop || y > listBottom) continue;
      if (r.tier) { // "Plinker  2 / 4": the tier's medal colour and how many of its badges are earned
        const col = P.tier[r.tier.key], n = r.list.filter((b) => have[b.id]).length;
        disc(ctx, x0 + M.pad, y + r.h / 2, 6, col);
        E.text(`${r.tier.name}  ${n} / ${r.list.length}`, x0 + M.pad + 14, y + r.h / 2, { size: TY.mid, weight: TY.strong, align: 'left', color: col });
        continue;
      }
      const b = r.b, on = !!have[b.id], col = P.tier[b.tier], cnt = on ? null : badgeCount(E, b), cy = y + r.h / 2, tx = x0 + M.pad + 2 * M.medalR + M.pad, right = x0 + listW - M.pad;
      plate(E, x0, y, listW, r.h, on ? P.panelHi : P.panel, on ? col : P.panelEdge, 12);
      drawMedal(ctx, x0 + M.pad + M.medalR, cy, M.medalR, b.tier, on);
      E.text(fitText(ctx, b.name, textW, TY.mid, TY.strong), tx, y + M.cardH * 0.34, { size: TY.mid, weight: TY.strong, align: 'left', color: on ? P.text : P.textDim });
      r.lines.forEach((ln, k) => E.text(ln, tx, y + M.cardH * 0.71 + k * M.lineH, { size: TY.small, align: 'left', color: P.textDim }));
      if (r.gun) { ctx.globalAlpha = on ? 1 : 0.45; drawGunTile(ctx, r.gun, right - M.gunW / 2, cy, M.gunW, M.gunH, 'std'); ctx.globalAlpha = 1; } // the gun this badge opens
      else if (cnt) E.text(`${cnt.have}/${cnt.need}`, right, cy, { size: TY.small, weight: TY.strong, align: 'right', color: P.textDim });
      if (on && this.fresh.has(b.id)) { ctx.lineWidth = 2; ctx.strokeStyle = P.ink; disc(ctx, x0 + listW - M.pad + 2, y + M.pad - 2, M.newR, P.orange); ctx.stroke(); } // new since the last visit
      this.cards.push({ x: x0, y, w: listW, h: r.h, id: b.id, b });
    }
    ctx.restore();
    this.rail = null;
    if (max > 0) { // the scroll affordance: a 44 px rail with chevrons, a track and a thumb; drag it or tap the chevrons
      const rx = x0 + W - M.rail, cx = rx + M.rail / 2, tt = listTop + M.rail, tb = listBottom - M.rail, th = Math.max(M.rail, (tb - tt) * viewH / R.h), ty = tt + (tb - tt - th) * (this.scroll / max);
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
    if (r && E.hit(r, p)) { if (p.y < r.tt) this.scroll = clamp(this.scroll - this.v.viewH * 0.75, 0, this.v.max); else if (p.y > r.tb) this.scroll = clamp(this.scroll + this.v.viewH * 0.75, 0, this.v.max); return; }
    const v = this.v, c = v && p.y >= v.listTop && p.y <= v.listBottom && this.cards.find((c) => E.hit(c, p));
    if (c && !badgeMap(E)[c.id]) { const o = badgeOpens(c.b); E.audio.play('tap', 0.3); E.toast(`${c.b.name}: ${c.b.cond}${o ? `. Opens ${o}` : ''}`); } // a tap on an unearned card: what earns it, and what it opens
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
    this.id = (params && params.id) || 'pistol'; this.from = (params && params.from) || 'menu'; this.chips = []; this.back = null; this.use = null;
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
    else if (!open) this.use = btn(E, bd ? 'Locked' : 'Buy', x0 + W - 42, top + 30, { w: 84, h: 44, size: TY.small, fill: P.panelHi, color: bd ? P.textDim : P.text }); // a bought gun's card leads to the Prop Room
    const lw = land ? 236 : W, y0 = top + 62, ph = land ? 76 : 92;
    plate(E, x0, y0, lw, ph, P.panel, P.panelEdge, 12);
    ctx.globalAlpha = open ? 1 : 0.3; drawGunTile(ctx, id, x0 + lw / 2, y0 + ph / 2, lw - 32, ph - 22, worn); ctx.globalAlpha = 1;
    if (!open) drawLock(ctx, x0 + lw / 2, y0 + ph / 2, P.textDim);
    let y = y0 + ph + 16;
    const lines = wrapText(ctx, g.job, lw - 8, TY.small);
    lines.forEach((ln, k) => E.text(ln, x0 + 4, y + k * 18, { size: TY.small, align: 'left', color: P.textDim }));
    y += lines.length * 18;
    if (!open) wrapText(ctx, bd ? `Opens with the ${bd.name} badge` : `In the Prop Room for ${money(T.gunPrices[id])}`, lw - 8, TY.small).forEach((ln) => { E.text(ln, x0 + 4, y, { size: TY.small, weight: TY.strong, align: 'left', color: P.orange }); y += 18; }); // wrapped inside the left column, clear of the stat rows
    // mastery: the tier, the bar toward the next, the lifetime counters
    y += 12;
    drawFameStar(ctx, x0 + 14, y, info.tier === 3); // the Walk of Fame: a gold star on the pavement once the gun is there
    E.text(TIER_NAMES[info.tier], x0 + 32, y, { size: TY.mid, weight: TY.strong, align: 'left', color: info.tier === 3 ? P.brass : info.tier ? P.cyan : P.textDim });
    E.text(info.next === null ? `${info.score}` : `${info.score} / ${info.next}`, x0 + lw - 4, y, { size: TY.small, weight: TY.strong, align: 'right', color: P.text });
    drawMasteryBar(E, x0 + 4, y + 14, lw - 8, info);
    y += 34;
    const pct = Math.round(info.acc * 100);
    [`Shots ${m.shots}   Hits ${m.hits}`, `Accuracy ${pct}%   Plates ${m.plates}`, `Bullseyes ${m.bulls}   Headshots ${m.heads}`].forEach((ln, k) => E.text(ln, x0 + 4, y + k * 18, { size: TY.small, align: 'left', color: P.text }));
    y += 3 * 18;
    if (info.accShort) { E.text(`${TIER_NAMES[3]} needs ${Math.round(T.mastery.accuracy * 100)}% accuracy`, x0 + 4, y, { size: TY.small, weight: TY.strong, align: 'left', color: P.orange }); y += 18; }
    // the numbers as bars, against the six-gun maximum
    const bx = land ? x0 + lw + 20 : x0, bw = land ? W - lw - 20 : W, by = land ? y0 : y + 12, rowH = land ? 22 : 26;
    STAT_ROWS.forEach(([label, val, txt], i) => {
      const max = Math.max(...GUN_IDS.map((k) => val(T.guns[k]))), yy = by + i * rowH + 11, tx = bx + 84, tw = bw - 84 - 100;
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
    if (E.hit(this.back, p)) { E.audio.play('tap'); E.setScene(this.from); return; }
    if (this.use && E.hit(this.use, p)) { if (gunUnlocked(E, id) && gunId(E) !== id) { pickGun(E, id); E.audio.play('tap'); } else if (!gunUnlocked(E, id) && !unlockBadge(id)) { E.audio.play('tap'); E.setScene('props'); } else E.audio.play('tap', 0.3); return; }
    for (const c of this.chips) if (E.hit(c, p)) {
      if (!gunUnlocked(E, id)) { E.audio.play('tap', 0.3); const bd = unlockBadge(id); E.toast(bd ? `The ${g.short} opens with the ${bd.name} badge` : `The ${g.short} is in the Prop Room for ${money(T.gunPrices[id])}`); }
      else if (skinOpen(E, id, c.skin)) { wearSkin(E, id, c.skin); E.audio.play('tap'); }
      else { E.audio.play('tap', 0.3); E.toast(`${c.skin.name}: ${skinNeed(id, c.skin)}`); }
      return;
    }
  },
};

// The Prop Room (v0.6 B): the prop master behind the counter, the box office on the register, and the six guns on a pegboard. A card is the gun, its movie name, four stats as bars
// (damage, fire rate, range, kick, each marked by a small drawn icon; the stats card has them all with their labels, one tap on the card) and one button: "Buy $400" (orange when
// the box office covers it), "Use", "In hand", or, for the .44, the mission that opens it. Buying spends the box office, owns the gun for good and puts it in hand.
const PROP_STATS = [(g) => g.damage * (g.pellets || 1), (g) => g.fireRate, (g) => g.accuracy, (g) => g.kickPerShot];
function statIcon(ctx, i, x, y) { // bullet, double chevron, range line with a cap, up arrow
  ctx.fillStyle = ctx.strokeStyle = P.textDim; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath();
  if (i === 0) { rrPath(ctx, x - 4, y - 2.5, 6, 5, 1.2); ctx.moveTo(x + 2, y - 2.5); ctx.arc(x + 2, y, 2.5, -Math.PI / 2, Math.PI / 2); ctx.fill(); }
  else if (i === 1) { ctx.moveTo(x - 5, y - 3.5); ctx.lineTo(x - 2, y); ctx.lineTo(x - 5, y + 3.5); ctx.moveTo(x, y - 3.5); ctx.lineTo(x + 3, y); ctx.lineTo(x, y + 3.5); ctx.stroke(); }
  else if (i === 2) { ctx.moveTo(x - 5, y); ctx.lineTo(x + 3, y); ctx.moveTo(x + 4.5, y - 3.5); ctx.lineTo(x + 4.5, y + 3.5); ctx.stroke(); }
  else { ctx.moveTo(x, y + 4); ctx.lineTo(x, y - 3.5); ctx.moveTo(x - 3.5, y); ctx.lineTo(x, y - 4); ctx.lineTo(x + 3.5, y); ctx.stroke(); }
  ctx.lineCap = 'butt';
}
// The prop master: a flat cap, glasses, a moustache and an apron, behind the counter (drawn, in screen px, centred on cx with the counter's top at y).
function drawPropMaster(ctx, cx, y, k) {
  ctx.save(); ctx.translate(cx, y); ctx.scale(k, k); ctx.lineJoin = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = 2;
  ctx.fillStyle = P.steelDark; rrect(ctx, -34, -46, 68, 50, 16); ctx.fill(); ctx.stroke(); // shoulders
  ctx.fillStyle = P.slate; rrect(ctx, -18, -40, 36, 44, 6); ctx.fill(); ctx.stroke(); // the apron
  ctx.fillStyle = P.kraft; ctx.beginPath(); ctx.arc(0, -66, 20, 0, PI2); ctx.fill(); ctx.stroke(); // the head
  ctx.fillStyle = P.cowboy; ctx.beginPath(); ctx.ellipse(2, -82, 22, 9, -0.08, Math.PI, PI2); ctx.fill(); ctx.stroke(); ctx.fillRect(-4, -85, 30, 5); // the flat cap and its peak
  ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(-8, -66, 5, 0, PI2); ctx.moveTo(13, -66); ctx.arc(8, -66, 5, 0, PI2); ctx.moveTo(-3, -66); ctx.lineTo(3, -66); ctx.stroke(); // glasses
  ctx.fillStyle = P.ink; ctx.beginPath(); ctx.ellipse(-5, -56, 7, 2.6, 0.2, 0, PI2); ctx.ellipse(5, -56, 7, 2.6, -0.2, 0, PI2); ctx.fill(); // the moustache
  ctx.restore();
}
// The prop master as a picture (PRD v0.6 I): resting, or the sold pose after a purchase, on the same canvas position so the swap reads as a small bounce. The canvas is 512 x 768 and its
// bottom edge is not a clean cut, so the counter (drawn after him) covers it: `picRow` is the canvas row that lands on the counter's top. False until the picture has loaded.
function drawPropMasterPic(ctx, cx, y, s, sold) {
  const key = sold && ART_IMG.masterSold ? 'masterSold' : 'master';
  return drawArtImage(ctx, key, cx, y - (A.props.picRow - 384) * s, 512 * s, 768 * s, null, true);
}
function propsLayout(E) {
  const K = A.props, land = E.w >= E.h * 1.2, side = 16 + Math.max(E.safe.left, E.safe.right), W = Math.min(E.w - 2 * side, 840), x0 = (E.w - W) / 2, top = E.safe.top, bottom = E.h - E.safe.bottom - 8;
  const L = { land, x0, W, back: { x: x0, y: top + 8, w: 84, h: 44 }, cards: [] };
  let bx, by, bw, bh, cols;
  if (land) { L.shop = { x: x0, y: top + K.headH + 4, w: K.side, h: bottom - top - K.headH - 4 }; bx = x0 + K.side + K.gap; by = L.shop.y; bw = W - K.side - K.gap; bh = L.shop.h; cols = 3; }
  else { L.shop = { x: x0, y: top + K.headH + 4, w: W, h: 146 }; bx = x0; by = L.shop.y + L.shop.h + K.gap; bw = W; bh = bottom - by; cols = 2; }
  const rows = Math.ceil(GUN_IDS.length / cols), cw = (bw - (cols - 1) * K.gap) / cols, ch = clamp((bh - (rows - 1) * K.gap) / rows, K.cardMin, K.cardMax);
  L.board = { x: bx - 4, y: by - 4, w: bw + 8, h: rows * ch + (rows - 1) * K.gap + 8 };
  GUN_IDS.forEach((id, i) => L.cards.push({ id, x: bx + (i % cols) * (cw + K.gap), y: by + Math.floor(i / cols) * (ch + K.gap), w: cw, h: ch }));
  return L;
}
const props = {
  enter(E) { // v0.9 C: Gus says one new line the first time the Prop Room opens after a career step (gusSeen is the highest step he has said it for)
    this.L = null; this.sold = null; this.focus = null;
    const r = careerInfo(E).rank; this.step = r >= 1 && r > Number(E.save.get('gusSeen', 0));
    if (this.step) E.save.set('gusSeen', r);
  },
  render(ctx, E) {
    const K = A.props, L = this.L = propsLayout(E), box = boxOf(E), sel = gunId(E), sh = L.shop;
    btn(E, 'Back', L.back.x + 42, L.back.y + 22, { w: 84, h: 44, size: TY.small, fill: P.slate });
    E.text('Prop Room', E.w / 2, L.back.y + 22, { size: TY.mid + 2, weight: TY.strong, color: P.text });
    // the counter, the prop master behind it and the register with the box office
    const ct = L.land ? sh.y + sh.h - 88 : sh.y + sh.h - 70, rx = L.land ? sh.x + 8 : sh.x + sh.w - 150, rw = L.land ? sh.w - 16 : 142, ry = L.land ? ct + 18 : sh.y + 12;
    const mx = L.land ? sh.x + sh.w / 2 : sh.x + K.masterX; // portrait: right of the Back button
    // v0.7 D: Gus's one line for the gun that is selected (the last card tapped, else the gun in hand), in a paper speech strip: over his head in landscape, on the counter in portrait. On a short
    // screen he is drawn a little smaller so that his head clears the strip (his head is `headRise` canvas rows above the counter).
    const sw = L.land ? sh.w : sh.w - 16, sl = wrapText(ctx, this.step && !this.focus ? STORY.gusStep : STORY.gus[this.focus && T.guns[this.focus] ? this.focus : sel], sw - 16, TY.small).slice(0, L.land ? A.story.lines : 2), sbh = sl.length * 16 + 12;
    const say = { lines: sl, bx: L.land ? sh.x : sh.x + 8, by: L.land ? sh.y + 2 : ct + 12 + (52 - sbh) / 2, bw: sw, bh: sbh };
    const picK = L.land ? Math.min(K.picScale, (ct - say.by - sbh - 10) / K.headRise) : K.picScaleTall;
    if (!drawPropMasterPic(ctx, mx, ct, picK, this.sold && E.time - this.sold.t0 < K.soldShow)) drawPropMaster(ctx, mx, ct, L.land ? K.master : 0.9);
    plate(E, sh.x, ct, sh.w, sh.y + sh.h - ct, P.counter, P.ink, 8); ctx.fillStyle = P.counterTop; rrect(ctx, sh.x + 2, ct + 2, sh.w - 4, 7, 3); ctx.fill();
    { // v0.7 D: the speech strip, drawn over the counter
      const { lines, bx, by, bw, bh } = say;
      plate(E, bx, by, bw, bh, P.paper, P.ink, 8);
      if (L.land) { ctx.fillStyle = P.paper; ctx.beginPath(); ctx.moveTo(bx + bw / 2 - 7, by + bh); ctx.lineTo(bx + bw / 2 + 7, by + bh); ctx.lineTo(bx + bw / 2, by + bh + 8); ctx.fill(); }
      lines.forEach((ln, i) => E.text(ln, bx + bw / 2, by + 6 + 8 + i * 16, { size: TY.small, weight: TY.strong, color: P.ink }));
    }
    plate(E, rx, ry, rw, 58, P.register, P.brass, 8);
    E.text('Box office', rx + rw / 2, ry + 15, { size: TY.small, color: P.textDim });
    E.text(money(box), rx + rw / 2, ry + 39, { size: TY.mid + 2, weight: TY.strong, color: P.brassText });
    // the pegboard and the guns on it
    drawPegboard(ctx, L.board.x, L.board.y, L.board.w, L.board.h);
    this.btns = [];
    for (const c of L.cards) {
      const g = T.guns[c.id], own = gunUnlocked(E, c.id), price = T.gunPrices[c.id], bd = unlockBadge(c.id), can = !own && price !== undefined && box >= price;
      plate(E, c.x, c.y, c.w, c.h, own ? P.panelHi : P.panel, c.id === sel ? P.orange : P.panelEdge, 10);
      disc(ctx, c.x + 12, c.y + 8, 3, P.steel); disc(ctx, c.x + c.w - 12, c.y + 8, 3, P.steel); // the pegs it hangs from
      const lines = wrapText(ctx, g.name, c.w - 16, TY.small).slice(0, 2), bot = c.y + c.h - 48, art = clamp(bot - c.y - 8 - lines.length * K.line - 2 * K.row - 16, K.artMin, L.land ? K.art : K.artTall); // the art gives way to a two-line name
      drawGunTile(ctx, c.id, c.x + c.w / 2, c.y + 6 + art / 2, c.w - 28, art, own ? skinId(E, c.id) : 'std');
      const sy = bot - 6 - 1.5 * K.row, ny = sy - 6 - K.row / 2 - (lines.length - 0.5) * K.line, half = (c.w - 24) / 2; // two rows of two bars just above the button, the name above them
      lines.forEach((ln, k) => E.text(ln, c.x + c.w / 2, ny + k * K.line, { size: TY.small, weight: TY.strong, color: P.text }));
      PROP_STATS.forEach((f, i) => {
        const bx2 = c.x + 10 + (i % 2) * (half + 4), by2 = sy + Math.floor(i / 2) * K.row, max = Math.max(...GUN_IDS.map((k) => f(T.guns[k]))), tw = half - 14;
        statIcon(ctx, i, bx2 + 5, by2); E.roundRect(bx2 + 12, by2 - K.bar / 2, tw, K.bar, K.bar / 2, P.panelEdge); E.roundRect(bx2 + 12, by2 - K.bar / 2, Math.max(K.bar, tw * f(g) / max), K.bar, K.bar / 2, P.cyan);
      });
      const b = { x: c.x + 6, y: bot, w: c.w - 12, h: 44, id: c.id };
      if (own) { const inHand = c.id === sel; plate(E, b.x, b.y, b.w, b.h, inHand ? P.panel : P.slate, inHand ? P.orange : P.ink); E.text(inHand ? 'In hand' : 'Use', b.x + b.w / 2, b.y + b.h / 2, { size: TY.small, weight: TY.strong, color: inHand ? P.textDim : P.text }); }
      else if (bd) { // the mission that opens it, on two lines if it needs them
        plate(E, b.x, b.y, b.w, b.h, P.panel, P.panelEdge); drawMedal(ctx, b.x + 18, b.y + b.h / 2, 11, bd.tier, false);
        const ml = wrapText(ctx, bd.name, b.w - 42, TY.small).slice(0, 2); ml.forEach((ln, k) => E.text(ln, b.x + 34, b.y + b.h / 2 + (k - (ml.length - 1) / 2) * 16, { size: TY.small, weight: TY.strong, align: 'left', color: P.textDim }));
      }
      else { plate(E, b.x, b.y, b.w, b.h, can ? P.orange : P.panel, can ? P.ink : P.panelEdge); E.text(`Buy ${money(price)}`, b.x + b.w / 2, b.y + b.h / 2, { size: TY.small, weight: TY.strong, color: can ? P.ink : P.textDim }); }
      this.btns.push(b);
      if (this.sold && this.sold.id === c.id && E.time - this.sold.t0 < K.stamp) { // the SOLD stamp, slapped on at an angle
        const a = 1 - (E.time - this.sold.t0) / K.stamp, k = 1 + 0.4 * Math.max(0, 1 - (E.time - this.sold.t0) * 8);
        ctx.save(); ctx.globalAlpha = Math.min(1, a * 2); ctx.translate(c.x + c.w / 2, c.y + 6 + art / 2); ctx.rotate(-0.2); ctx.scale(k, k);
        ctx.strokeStyle = P.brassText; ctx.lineWidth = 3; rrect(ctx, -40, -16, 80, 32, 6); ctx.stroke(); ctx.restore();
        ctx.save(); ctx.translate(c.x + c.w / 2, c.y + 6 + art / 2); ctx.rotate(-0.2); ctx.scale(k, k); E.text('SOLD', 0, 0, { size: TY.mid + 2, weight: TY.strong, color: P.brassText, alpha: Math.min(1, a * 2) }); ctx.restore();
      }
    }
  },
  onTap(p, E) {
    const L = this.L;
    if (!L) return;
    if (E.hit(L.back, p)) { E.audio.play('tap'); E.setScene('menu'); return; }
    const b = this.btns.find((q) => E.hit(q, p));
    if (b) {
      const id = b.id, g = T.guns[id], price = T.gunPrices[id], bd = unlockBadge(id), box = boxOf(E);
      this.focus = id; // Gus has a line for it
      if (gunUnlocked(E, id)) { if (gunId(E) !== id) pickGun(E, id); E.audio.play('tap'); }
      else if (bd) { E.audio.play('tap', 0.3); E.toast(`The ${g.short} opens with the ${bd.name} badge (${bd.cond})`); }
      else if (box >= price) { // bought: the box office is spent, the gun is owned for good and in hand
        E.save.set('box', box - price); E.save.update('owned', (m) => ({ ...(m && typeof m === 'object' ? m : {}), [id]: 1 }), {});
        E.ledger.add('buy', { gun: id, price, box: box - price }); pickGun(E, id);
        E.audio.play('coin'); E.haptic(24); this.sold = { id, t0: E.time };
      } else { E.audio.play('tap', 0.3); E.toast(`${money(price - box)} more box office buys the ${g.name}`); }
      return;
    }
    const c = L.cards.find((q) => E.hit(q, p));
    if (c) { E.audio.play('tap'); E.setScene('gun', { id: c.id, from: 'props' }); } // the card itself: its full stats
  },
};

const play = {
  enter(E, params) {
    const ch = (params && chById(params.id)) || CHALLENGES[0];
    newRun(ch.endless ? { ...ch, seed: E.dailySeed() } : ch, gunId(E), params && params.gauntlet, skinId(E, gunId(E))); // the endless mode plays the day's seed
    this.menuBtn = null; this.reloadBtn = null; S.restarted = false;
    prepSet(S.set, setScale(view(E).s * E.dpr)); // the set's image, before the first frame
    S.clap = { t0: E.time, text: 'Action!' }; E.audio.beep({ freq: 1400, dur: 0.03, type: 'square', gain: 0.05 });
    S.first = !E.save.get('controlsSeen', false); if (S.first) E.save.set('controlsSeen', true); // the controls line: the first play of a fresh save, once
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
      if (!S.cut) { S.cut = true; S.clap = { t0: E.time, text: 'Cut!' }; E.audio.beep({ freq: 1400, dur: 0.03, type: 'square', gain: 0.05 }); } // the clapper's "Cut!" (the card still comes after endDelay)
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
    sprScale(v.s * E.dpr);
    drawSet(ctx, S.set); // before the clip: the set's image covers the field exactly, and an unclipped copy is the raster's cheapest draw
    ctx.beginPath(); ctx.rect(0, 0, T.designW, T.designH); ctx.clip();
    if (S.set === 'horror' || S.set === 'night') drawFog(ctx, E.time);
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
    if (ch.ladder === 'skeet' && r.targets.length) { // the saucers' wires, faint, from the top edge
      ctx.globalAlpha = A.sets.wireAlpha; ctx.strokeStyle = P.wire; ctx.lineWidth = 1; ctx.beginPath();
      for (const tg of r.targets) { ctx.moveTo(tg.x, 0); ctx.lineTo(tg.x, tg.y - T.zoneR[1] * tg.sc); }
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    for (const f of S.fx) if (f.k === 'saucer') drawDrop(ctx, f);
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
    for (const f of S.fx) if (f.k === 'spark' || f.k === 'squib') drawBurst(ctx, f);
    ctx.restore();

    if (!ch.wall) for (const tg of r.targets) if (tg.kind === 'part') { // the Bunker's plates come in a random order, so they carry no numbers
      const on = tg.idx === r.stage;
      E.text(PART_NUM[tg.idx], v.ox + (tg.x - T.zoneR[2] * tg.sc * A.plate.r - 10) * v.s, v.oy + tg.y * v.s, { size: TY.small, weight: TY.strong, color: on ? P.text : P.textDim });
    }
    for (const f of S.fx) if (f.k === 'pop') {
      const k = 1 - f.t / f.max;
      popText(E, f.text, v.ox + f.x * v.s, v.oy + (f.y - 18 - 22 * k) * v.s, f.color, 1 - k * k);
    }
    const intro = ch.wall ? 'Every plate scores' : ch.behaviour === 'dodge' ? 'Shoot near a ringed target to make it jump, then hit it where it lands.' : null;
    if (intro && now < A.intro.hold + A.intro.fade) { // the one-line intro: the Bunker's optional plates score; a dodger jumps when a shot passes near it
      const a = clamp((A.intro.hold + A.intro.fade - now) / A.intro.fade, 0, 1);
      wrapText(ctx, intro, v.w - 24, TY.small).forEach((ln, i) => E.text(ln, v.ox + (T.designW / 2) * v.s, v.oy + A.intro.y * v.s + i * 18, { size: TY.small, weight: TY.strong, color: P.text, alpha: a })); // a narrow field wraps it
    }
    if (S.first && now < A.first.hold + A.first.fade) { // v0.5 P: the one line of tutorial there is, on a fresh save's first play
      const a = clamp((A.first.hold + A.first.fade - now) / A.first.fade, 0, 1), lines = wrapText(ctx, A.first.text, v.w - 56, TY.small), h = 12 + lines.length * 20, cx = v.ox + v.w / 2;
      const w = Math.min(v.w - 24, Math.max(...lines.map((ln) => ctx.measureText(ln).width)) + 32);
      ctx.globalAlpha = a; plate(E, cx - w / 2, v.oy + A.intro.y * v.s - 12, w, h, P.panel, P.orange, 10); ctx.globalAlpha = 1;
      lines.forEach((ln, i) => E.text(ln, cx, v.oy + A.intro.y * v.s + 4 + i * 20, { size: TY.small, weight: TY.strong, color: P.text, alpha: a }));
    }
    for (const f of S.fx) if (f.k === 'callout') {
      const k = 1 - f.t / f.max, big = f.big ? 1.35 : 1, x = clamp(v.ox + f.x * v.s, v.ox + 70, v.ox + v.w - 70);
      popText(E, f.text, x, v.oy + (f.y - 26 * k) * v.s, f.color || P.cyan, Math.min(1, 3 * (1 - k)), f.size || TY.mid * big + 4);
    }
    this.hud(E, v, r, ch);
    this.reloadUI(E, v, r, now);
    if (S.clap) drawClapper(E, v, S.clap);
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
    queueInput(S.run, at, 'trigger', true); queueInput(S.run, at, 'fire'); // held first, so the hold's first round opens its burst
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
  onPause() { newRun(S.ch, S.gunId, S.gauntlet === null ? undefined : S.gauntlet, S.skin); S.restarted = true; S.first = false; }, // closing the app mid-challenge restarts it, and the toast says so on return
};

const over = {
  enter(E, params) {
    this.p = params; this.ch = chById(params.id); this.t0 = E.time; this.tick = -1;
    this.note = this.ch.endless ? null : STORY.note[careerInfo(E).rank][params.stars >= T.scenes.noteHigh ? 1 : 0]; // v0.9 C: the director's note, by career and then by stars (the worried line for the low takes)
    this.cards = (params.posters || []).map((set) => ({ kind: 'poster', set })).concat(params.rankUp >= 0 ? [{ kind: 'scene', id: STORY_SCENE[params.rankUp] }] : []); // story cards and scenes that wait for the player's next tap
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
  // The result card (PRD v0.8 D2), six things: the rung name with the gun beside the score, the score (and a New best tag), the stars with a thin bar to the next one, Big Lou's portrait and
  // line, one stat line (box office only above zero) and the buttons. What the run earned (badges, tiers, skins) is a row of call sheets under the stat line, only when there is any.
  render(ctx, E) {
    const p = this.p, ch = this.ch, cx = E.w / 2, g = p.gaunt, age = E.time - this.t0, K = A.tickets, endless = !!ch.endless;
    const tm = this.ticketMetrics(ctx, E), pw = Math.min(E.w - 16, Math.max(520, tm ? tm.total + 2 * K.edge : 0)), wide = pw >= 500 && E.w > E.h;
    const lx = wide ? cx - pw * 0.22 : cx, rowH = tm ? K.h + 6 : 0, H = (wide ? 254 : 314) + rowH;
    const y0 = Math.max(E.safe.top + 14, E.safe.top + (E.h - E.safe.top - E.safe.bottom - H) / 2 + 6);
    plate(E, cx - pw / 2, y0 - 14, pw, H + 20, P.panel, P.panelEdge, 16);
    E.text(`${ch.name}${g ? `  ·  Montage ${g.i + 1}/${GAUNTLET.length}` : ''}`, cx, y0 + 2, { size: TY.small, color: P.textDim });
    // the score, large, with the gun as a picture on its left and the New best tag on its right
    const sy = y0 + 46, shown = Math.round(p.score * ease.outQuad(clamp((age - 0.15) / T.tickerLife, 0, 1))), big = TY.big + 12;
    E.text(`${shown}`, lx, sy, { size: big, weight: TY.strong, color: P.text });
    ctx.font = `${TY.strong} ${big}px system-ui, sans-serif`; const sw = ctx.measureText(`${p.score}`).width;
    if (p.gunId) { const room = lx - sw / 2 - 8 - (cx - pw / 2 + 10), gw = clamp(room, 36, 84); drawGunTile(ctx, p.gunId, lx - sw / 2 - 8 - gw / 2, sy, gw, gw * 34 / 84, p.skin); } // the picture shrinks to the room left of the score, so a 6-digit score never touches it
    if (p.isNew) { const tw = 94, tx = lx + sw / 2 + 10 + tw / 2; plate(E, tx - tw / 2, sy - 12, tw, 24, P.orange, P.ink, 12); E.text('New best!', tx, sy, { size: TY.small, weight: TY.strong, color: P.ink }); }
    let ly = y0 + 140; // where the card's right-hand (or lower) block starts
    if (!endless) {
      const names = ['', 'one', 'two', 'three'], thr = p.thr, lo = p.stars ? thr[names[p.stars]] : 0, nxt = p.stars < 3 ? thr[names[p.stars + 1]] : 0, sty = y0 + 100;
      for (let i = 0; i < 3; i++) {
        const sx = lx + (i - 1) * 44;
        if (i < p.stars) { const k = ease.outBack(clamp((age - i * 0.2) / 0.3, 0, 1)); if (k > 0) drawStar(ctx, sx, sty, 17 * k, P.brass); }
        else drawStar(ctx, sx, sty, 17, null, P.panelEdge);
      }
      const bw = 190, by = y0 + 130, fr = p.stars >= 3 ? 1 : clamp((p.score - lo) / Math.max(1, nxt - lo), 0, 1) * ease.outQuad(clamp((age - 0.5) / 0.5, 0, 1));
      E.roundRect(lx - bw / 2, by, bw, 5, 2.5, P.panelEdge); if (fr > 0) E.roundRect(lx - bw / 2, by, Math.max(5, bw * fr), 5, 2.5, P.brass);
      E.text(p.stars >= 3 ? 'All stars!' : `${nxt - p.score} to ${'★'.repeat(p.stars + 1)}`, lx, by + 18, { size: TY.small, weight: TY.strong, color: p.stars >= 3 ? P.brassText : P.textDim });
      ly = by + 40;
    } else {
      E.text(`${p.isNew ? 'New best' : 'Best'} ${p.best}  ·  wave ${p.bestWave}`, lx, y0 + 100, { size: TY.mid, weight: p.isNew ? TY.strong : TY.normal, color: p.isNew ? P.orange : P.textDim });
      E.text(`Today ${p.day.best}${p.day.isNew ? ' (new)' : ''}  ·  the same waves all day`, lx, y0 + 124, { size: TY.small, color: P.textDim });
    }
    if (this.note) { // Big Lou: his pose by stars (approving on two and three), his one line beside (wide) or under (narrow) the portrait
      const na = clamp((age - 0.4) / 0.3, 0, 1), sz = 66;
      const px = wide ? cx + pw * 0.27 : cx - pw / 2 + 24 + sz / 2, py = wide ? y0 + 60 : ly + 24, tw = wide ? pw * 0.4 : pw - sz - 56;
      ctx.globalAlpha = na; drawDirector(ctx, px, py, sz, p.stars >= 2); ctx.globalAlpha = 1;
      const ln = wrapText(ctx, this.note, tw, TY.small).slice(0, 3);
      ln.forEach((t, i) => E.text(t, wide ? px : px + sz / 2 + 14, wide ? y0 + 106 + i * 17 : py + (i - (ln.length - 1) / 2) * 17, { size: TY.small, weight: TY.strong, align: wide ? 'center' : 'left', color: P.text, alpha: na }));
      if (!wide) ly += 56;
    }
    // the one stat line that suits the rung, then the box office when it is above zero
    const of = ch.ladder === 'accuracy' ? ` of ${ch.accTargets}` : '';
    let stat;
    if (g) stat = !g.ok ? 'Montage over: two stars needed' : g.done ? 'Montage complete' : 'Montage scene passed';
    else if (ch.ladder === 'zombie') stat = endless ? `Wave ${p.zwave}  ·  ${p.zdown} down  ·  ${p.heads} brain shots` : `${p.zdown} of ${p.ztotal} down  ·  ${p.heads} brain shots`;
    else if (ch.wall) stat = p.platesLeft ? `${p.platesLeft} plates left, worth up to ${p.platesValue} more` : 'Every plate scores';
    else stat = `${p.hits}${of} ${ch.ladder === 'skeet' ? 'saucers' : 'hits'}  ·  ${p.bulls} ${p.bulls === 1 ? 'bullseye' : 'bullseyes'}`;
    if (p.pay > 0) stat += `  ·  +${money(p.pay)}`;
    const sty2 = wide ? y0 + 172 : ly + 8;
    E.text(fitText(ctx, stat, pw - 24, TY.small, TY.strong), cx, sty2, { size: TY.small, weight: TY.strong, color: g && !g.ok ? P.red : P.text });
    if (tm) this.drawTickets(ctx, E, cx, sty2 + 12 + K.h / 2, age, tm);
    // Next leads when the run earned a star and the next rung is open; with no star Again leads and Next (open all the same) sits beside Menu. Every button is at least 48 px high.
    const lead = p.stars >= 1 && this.canNext ? 'next' : 'again', by2 = y0 + H - 22 - 26 + 14, big2 = { w: Math.min(200, pw * 0.4), h: 52 }, sm = { w: 92, h: 48 };
    const again = ['Again', lead === 'again' ? P.orange : P.panelHi, lead === 'again' ? P.ink : P.text, 'again', lead === 'again' ? big2 : sm], mn = ['Menu', P.slate, P.text, 'menu', sm];
    const list = !this.canNext ? [again, mn] : lead === 'next' ? [again, ['Next', P.orange, P.ink, 'next', big2], mn] : [again, ['Next', P.panelHi, P.text, 'next', sm], mn];
    const total = list.reduce((n, b) => n + b[4].w, 0) + 12 * (list.length - 1); let bx = cx - total / 2;
    this.btns = list.map(([label, fill, color, act, sz]) => {
      const x = bx + sz.w / 2; bx += sz.w + 12;
      return { act, ...btn(E, label, x, by2, { w: sz.w, h: sz.h, fill, color, size: sz === big2 ? TY.mid : TY.small }) };
    });
  },
  // The row of call sheets for what the run earned (up to `max`, fewer if the widest card the screen allows cannot hold their names whole: the rest count in "+n", so no name is ever cut):
  // each sheet's icon width and padding, its text width (the last also holds "+n") and the row's width. Null when nothing was earned.
  ticketMetrics(ctx, E) {
    const K = A.tickets, all = this.p.tickets, room = E.w - 16 - 2 * K.edge;
    if (!all.length) return null;
    ctx.font = `${TY.strong} ${TY.small}px system-ui, sans-serif`;
    let m;
    for (let n = Math.min(K.max, all.length); n >= 1; n--) {
      const list = all.slice(0, n), more = all.length - n, ic = list.map((t) => (t.kind === 'badge' && !t.gun ? K.medal : K.icon)), ch = ic.map((w) => K.pad * 2 + w + K.iconGap);
      const tw = list.map((t, i) => ctx.measureText(t.name).width + (more && i === n - 1 ? K.more : 0));
      m = { list, more, ic, ch, tw, total: tw.reduce((sum, w, i) => sum + w + ch[i], 0) + (n - 1) * K.gap };
      if (m.total <= room || n <= 1) break;
    }
    return m;
  },
  drawTickets(ctx, E, cx, cy, age, tm) {
    const K = A.tickets, { list, more, ic, ch, tw, total } = tm;
    let x = cx - total / 2;
    list.forEach((t, i) => {
      const w = tw[i] + ch[i], a = clamp((age - K.delay - i * K.stagger) / K.pop, 0, 1);
      if (a <= 0) { x += w + K.gap; return; }
      const mx = x + w / 2, col = t.kind === 'badge' ? P.tier[t.tier] : t.kind === 'tier' ? P.cyan : P.orange, ix = x + K.pad + ic[i] / 2, last = more && i === list.length - 1;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(mx, cy); const sw = 1 + K.swell * Math.sin(Math.PI * a); ctx.scale(sw, sw); ctx.translate(-mx, -cy);
      drawCallSheet(ctx, mx, cy, w, K.h, col);
      if (t.kind === 'badge' && !t.gun) drawMedal(ctx, ix, cy, ic[i] / 2, t.tier, true);
      else drawGunTile(ctx, t.gun, ix, cy, ic[i], K.h * 0.55, t.kind === 'skin' ? t.skin.id : 'std'); // a gun opened, or the gun a tier or a skin belongs to (a skin shown worn)
      E.text(t.name, x + K.pad + ic[i] + K.iconGap, cy, { size: TY.small, weight: TY.strong, align: 'left', color: P.ink, alpha: a });
      if (last) E.text(`+${more}`, x + w - K.pad, cy, { size: TY.small, weight: TY.strong, align: 'right', color: P.steelDark, alpha: a });
      ctx.restore();
      x += w + K.gap;
    });
  },
  onTap(p, E) {
    if (E.time - this.t0 < T.cardLock) return; // a tap that was meant for the last shot must not pick a button
    const b = this.btns.find((b) => E.hit(b, p));
    if (!b) return;
    E.audio.play('tap');
    // v0.7: a poster or a rank card that this run earned shows once, between the card and wherever the button goes; one tap on it goes on, Skip leaves.
    const go = (scene, params) => (this.cards.length ? E.setScene('story', { cards: this.cards, then: [scene, params] }) : E.setScene(scene, params));
    if (b.act === 'again') { const g = this.p.gaunt; E.ledger.add('retry', { id: this.ch.id, gun: this.p.gunId, score: this.p.score, stars: this.p.stars }); go('play', g && g.ok && !g.done ? { id: this.ch.id, gauntlet: g.i } : { id: this.ch.id }); } // a passed stage replayed stays in the chain
    else if (b.act === 'next') go('play', this.p.gaunt ? { id: this.next.id, gauntlet: this.p.gaunt.i + 1 } : { id: this.next.id });
    else go('menu');
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
  saveVersion: 15,
  // Save shape: best { challengeId: { gunId: { score, stars, accuracy } } }, gun (id), skins { gunId: skinId }, badges { badgeId: 1 }, gunsHad { gunId: 1 } (guns a save from
  // before v7 already had), cold (Cold Barrel's runs in a row), zend (the endless mode's bests), mastery { gunId: { shots, hits, bulls, heads, plates } } and skinsHad { gunId: { skinId: 1 } } and skinsNew { gunId: [skinId] } (v10), starPreset (the star-bar preset's name), __tune, __muted.
  // controlsSeen (v11: the first-run controls line has been shown), seen { badgeId: 1 } (v12: the badges already shown on the missions screen; the dot on the menu's Missions button marks an earned one that is not in it).
  // v13 (PRD v0.6 B): box (box office in dollars) and owned { gunId: 1 } (the guns bought in the Prop Room; the migration puts every gun a save already had here, so none is taken away).
  // v14 (PRD v0.7 F): careerSeen (the highest career rank, an index 0 to 3, whose card has been shown), openSeen (the cold open has been shown or skipped) and posters { set: 1 } (premiere posters released: accuracy,
  // speed, skeet, boss, zombie, endless). The migration marks the cold open seen, gives a veteran one rank card for the rank they are at now (careerSeen one below it), and hangs the posters of sets already three-starred.
  // v15 (PRD v0.9 D): openSeen is now the story version shown (a number; the v14 true is 1, so the new cold open shows once to everyone), turnSeen and endSeen (booleans: the Stunt Double turn and the Action Star ending
  // have shown) and gusSeen (the career step, 0 to 3, whose Prop Room line Gus has said). careerSeen is now only the Intern scene's (1 once it has shown). The migration adds the defaults; a save at a rank the
  // scenes belong to is owed them, one per result card, lowest first (pendingStory).
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
    if (fromVersion < 11) data.controlsSeen = true; // v11: a save that already exists has played; only a fresh one sees the controls line
    if (fromVersion < 12) data.seen = Object.fromEntries(Object.keys(data.badges).map((id) => [id, 1])); // v12: every badge the save had is marked seen, so the dot waits for the next one
    else if (!data.seen || typeof data.seen !== 'object') data.seen = {};
    if (fromVersion < 13) { // v13: every gun the save had stays owned (its v0.5 badge, or the old points table's gunsHad), and box office opens at boxStart plus boxPerStar for every star
      // already earned (a best's saved stars, or what its score earns against the bars now if that is more, as the menu counts them), so a veteran can shop at once
      const owned = data.owned && typeof data.owned === 'object' ? data.owned : {}, had = data.gunsHad && typeof data.gunsHad === 'object' ? data.gunsHad : {};
      for (const [g, b] of Object.entries(OLD_UNLOCK_BADGES)) if (data.badges[b] || had[g]) owned[g] = 1;
      data.owned = owned;
      let stars = 0;
      for (const [cid, per] of Object.entries(data.best || {})) { const ch = CHALLENGES.find((c) => c.id === cid); if (ch && per && typeof per === 'object') for (const [g, e] of Object.entries(per)) if (T.guns[g] && e && typeof e === 'object') stars += Math.max(e.stars || 0, starsFor(ch, e.score || 0, g)); }
      data.box = T.boxStart + T.boxPerStar * stars;
    }
    if (fromVersion < 14) { // v14: a veteran has seen the opening, gets one card for the rank they are at (never a cascade), and keeps the posters their finished sets earned
      const best = data.best && typeof data.best === 'object' ? data.best : {}, zb = data.zend && data.zend.best ? data.zend.best : null;
      data.openSeen = true;
      data.careerSeen = Math.max(0, rankFor(careerStars(best)) - 1);
      data.posters = Object.fromEntries(POSTER_SETS.filter((set) => (set === 'endless' ? !!zb && zb.wave >= T.career.endlessWave : threeStarred(best, set))).map((set) => [set, 1]));
    }
    if (fromVersion < 15) data.openSeen = data.openSeen ? 1 : 0; // v15: openSeen is the story version shown (1 is the old cold open), so the new open shows once to everyone
    if (!Number.isInteger(data.openSeen) || data.openSeen < 0) delete data.openSeen;
    data.turnSeen = data.turnSeen === true; data.endSeen = data.endSeen === true; // v15: the turn (Stunt Double) and the ending (Action Star); a veteran at or above those ranks sees each once, one per result
    if (!Number.isInteger(data.gusSeen) || data.gusSeen < 0) data.gusSeen = 0; // v15: the career step Gus has said his new line for
    if (!Number.isInteger(data.careerSeen) || data.careerSeen < 0) delete data.careerSeen;
    if (!data.posters || typeof data.posters !== 'object') data.posters = {};
    if (!data.owned || typeof data.owned !== 'object') data.owned = {};
    if (typeof data.box !== 'number' || !Number.isFinite(data.box)) data.box = T.boxStart;
    if (data.mastery !== undefined && (typeof data.mastery !== 'object' || data.mastery === null)) delete data.mastery;
    delete data.bossGuns;
    if (data.__tune && typeof data.__tune === 'object') data.__tune = Object.fromEntries(Object.entries(data.__tune).filter(([k]) => TUNE_KEYS.has(k)));
    return data;
  },
  TUNING,
  init(E) {
    buildArt(); loadArtImages(); prepMenu(E.dpr, E.ctx); menuPatterns(E.ctx, E.dpr); warmText(E.ctx);
    if (!E.save.get('mastery', null)) E.save.set('mastery', deriveMastery(E)); // a save from before v10: the counters the ledger still has, else zero
  }, // the art and the menu's sprites are built before the first frame
  experiments: EXPERIMENTS,
  presets: PRESETS,
  start: 'menu',
  scenes: { menu, play, over, missions, tune, gun: gunCard, props, story, career },
};
