// Gravity Golf v0.7: planets, suns (with mass), rotating bars, orbiting moons, comets and black holes on the v0.1 mechanic, juice, scenes, the
// space look, missions and skins, a full-run counter, the playtest ledger, a rank ladder from Asteroid to Black Hole driven by stars, and nine exotic badges with secret slots and a Black Hole tier.
// Slingshot aim, fixed-step ball physics, strokes against per-hole star thresholds, the hole card, hole select.

import { makeRng, hashString, ease, clamp, lerp, dist } from './engine.js';

// Design-space units unless stated. Names match PRD v0.1 section 16, v0.2 section E, v0.3 section E and v0.4 section D; the rest are marked.
const TUNING = {
  designW: 360,          // Design space width
  designH: 640,          // Design space height
  ballR: 9,              // Ball radius
  holeR: 18,             // Hole radius, ball centre must be inside
  sinkSpeed: 380,        // Max speed (units per second) at which the ball can sink
  captureR: 44,          // Within this distance of the hole centre the cup pulls the ball
  captureStrength: 900,  // Constant acceleration toward the hole centre inside captureR
  friction: 0.28,        // Fraction of speed kept per second on the open field
  stopSpeed: 50,         // Below this speed the ball is at rest
  dragMax: 150,          // Drag distance (screen px) that gives full power
  dragDead: 12,          // Drag shorter than this cancels the shot
  powerMax: 820,         // Launch speed at full drag
  wallBounce: 0.85,      // Fraction of speed kept on a wall, planet or sun bounce
  planetGravity: 4500000, // Acceleration toward a planet is this times mass over distance squared (never under the radius)
  planetMinR: 24,        // Smallest planet radius (bumper-planets)
  sunPenalty: 1,         // Strokes added per sun touch
  sunMass: 1.6,          // PRD v0.5 B: a sun pulls like a planet of this mass (unless the sun sets `mass`)
  sunPullR: 60,          // Distance below which a sun's pull stops growing: at 60 a sun's floor pull matches the heaviest planet's at its surface (1.2 / 52^2) and stays far under a black hole's (1.4 / 26^2), so a ball on a sun can always shoot free
  sunReach: 12,          // A sun pulls with the full law only within this distance of its surface (unless it sets `reach`)
  sunFade: 1.2,          // and fades smoothly to nothing at sunFade times that ring's radius, so a slow ball can rest just clear of it
  landSpeed: 60,         // Below this speed, a ball touching a planet comes to rest on it
  moonMassMax: 0.5,      // Cap on moon mass
  barAngularSpeed: 1.2,  // Radians per second for a rotating bar (clockwise on screen)
  cometR: 10,            // Comet radius (unless the comet sets `r`)
  cometPush: 0.8,        // Fraction of the comet's velocity added to the ball on contact
  holeR2: 26,            // Black hole horizon radius (unless the black hole sets `r`)
  bhMass: 1.4,           // Black hole pull strength as a planet mass (unless the black hole sets `mass`)
  bhPullR: 26,           // Distance below which a black hole's pull stops growing (equals the horizon)
  bhPenalty: 1,          // Strokes per swallow
  bhReach: 150,          // PRD v0.4 A: a black hole's influence ring (unless it sets `reach`); inside it the pull is the full law
  bhFade: 1.5,           // Between reach and bhFade times reach the pull fades smoothly to zero; beyond, the black hole does nothing
  ghostSeconds: 3,       // PRD v0.4 B: the last shot's ghost keeps at most this much of the end of its flight
  ghostAlpha: 0.32,      // How strongly the ghost's dots show
  // PRD v0.9: the blind fourth star. A blind try hides the preview and the ghost and draws only a short straight pointer; physics is untouched.
  blind: {
    label: 'Expert',     // The player-facing name of the mode: the HUD tag, the end card's button and line (the save and the code keep 'blind')
    pointerLen: 64,      // Design px from the ball's edge gap to the arrow tip: it shows direction, never power or curve
    gap: 6, pointerW: 4, backGrow: 1.5, headLen: 13, headHalf: 7, minLen: 20, alpha: 0.95, // Pointer: start gap from the ball, shaft width, dark backing, arrowhead, shortest length
    hudClear: 38,        // Screen px below the HUD band: the tip is shortened to stay under it and the Blind tag
    col: '#67e8f9', edge: '#22d3ee', core: '#ecfeff', // The fourth star's cyan comet colours
    tag: { y: 16, w: 64, h: 24 }, // The HUD tag: centre below the HUD band, size (screen px)
    starR: 4.5, tileStep: 14, tail: 1.8, tailW: 1.3, tailDx: -0.6, tailDy: 0.8, // Tile: comet star radius, star spacing on a three-star tile, comet tail length in radii and its direction
    cardStarR: 17, cardStarsX: [-76, -20, 36], cardCometX: 94, // End card: the fourth star's radius and x offsets of the four slots (the three-star layout otherwise)
    cardBtnW: 312, cardBtnGap: 64, cardBtnY: 148, cardExtra: 64, // End card Blind button: width, extra card height and the row's offset below the Next button
    burstCount: 70, burstSpeedK: 1.6, flash: 0.18, haptic: 40, // A blind three-star sink: a bigger cyan burst, and a stronger flash
    chime: [{ f: 659.25, d: 0.12 }, { f: 880, d: 0.12 }, { f: 1318.5, d: 0.32 }], chimeGap: 0.09, chimeGain: 0.16, // The brighter three-star sound: a rising chime over the usual coin and win
  },
  previewFullHoles: 3,   // Holes 1 to this show the full preview
  previewFullSeconds: 2.0,   // Length of the full preview in simulated seconds
  previewShortSeconds: 0.4,  // Length of the preview after the full-preview holes
  previewDotEvery: 0.05, // Simulated seconds between preview dots
  physicsStep: 1 / 120,  // Fixed physics timestep in seconds
  maxFlightSeconds: 12,  // Safety: a ball still moving after this is stopped where it is
  moverPeriod: 2.4,      // Seconds for a sliding wall to complete one sweep and return (unless the mover sets `period`)
  trailLength: 18,       // Points kept in the ball's trail
  particleCap: 200,      // Max live particles
  speedMax: 1400,        // Ball speed is clamped here so a slingshot cannot cause tunnelling
  keyPowerStart: 0.5,    // Starting power fraction for the keyboard fallback

  // Builder additions, not in the PRD tables.
  barW: 8,               // Rotating bar thickness
  sunRearm: 30,          // A sun touch counts again only once the ball has left its surface by this much (30: a ball the planet presses back into a sun pays once)
  cometRearm: 9,         // A comet kicks the ball again only once the ball has left its surface by this much
  hudH: 48,              // HUD stack height below the safe top (screen px); Retry sits below it, the field below both
  hudGap: 6,             // Gap between Retry and the field's edge wall (screen px)
  borderW: 8,            // Drawn thickness of the edge walls, kept on screen by view()
  retryW: 96,            // Retry button size (screen px): a circular arrow and the word, so it reads as a button at rest
  retryH: 44,
  bounceEventSpeed: 40,  // Impact speed below this is a slide, not a hit (no sound)
  sinkTime: 0.45,        // Seconds the ball takes to drop into the hole before the card
  gridCols: 5,           // Hole select tiles per row
  tileGap: 8,            // Gap between hole select tiles (screen px)
  tileH: 68,             // Hole select tile height (screen px)
  keyAngleStep: 0.04,    // Keyboard fallback: radians per arrow press
  keyPowerStep: 0.05,    // Keyboard fallback: fraction of full power per arrow press
  runSlack: 5,           // Under Par: a full run within this many strokes of the sum of every hole's three-star count (20 on ten holes, as the PRD)

  // Juice. Cosmetic only; nothing here is read by the physics. Durations in seconds, sizes in design units,
  // speeds in design units per second, particle drag is per frame.
  juice: {
    particleDrag: 0.93,
    // Drag start
    glowStart: 0.6,        // Glow strength on the very first frame of a touch (0 to 1)
    glowInTime: 0.08,      // Seconds to reach full glow while aiming
    glowOutTime: 0.18,     // Seconds to fade after release or cancel
    glowR: 12,             // Glow radius beyond the ball at zero power
    glowRPower: 10,        // Extra glow radius at full power
    glowAlpha: 0.75,
    dragPopFrom: 0.72,     // Ball scale at touch, springs to 1 with outBack
    dragPopTime: 0.2,
    aimWidth: 3,           // Aim line width at zero power
    aimWidthPower: 2.5,    // Extra width at full power
    // Release
    flashTime: 0.22,       // Ball flash ring and glow
    flashRing: 2.8,        // Flash ring radius at the end, in ball radii
    puffCount: 7,
    puffSpeed: 90,
    puffLife: 0.35,
    puffSize: 3.5,
    puffSpread: 1.1,
    releaseHaptic: 8,
    // Wall, bar and planet bounce
    hitVol: 0.3,
    bigHitVol: 0.5,
    bigHitSpeed: 560,      // Impact speed above which a hit is a big hit (burst, shake, louder)
    sparkCount: 5,
    sparkBigCount: 13,
    sparkSpeed: 120,
    sparkBigSpeed: 210,
    sparkLife: 0.28,
    sparkBigLife: 0.42,
    sparkSize: 2.4,
    sparkBigSize: 3.2,
    sparkSpread: 1.9,
    bigShake: 3,           // Screen px
    bigShakeTime: 0.12,
    // Planets
    planetNearR: 80,       // Within this distance of a planet's surface the ball trails and the planet's pull ring speeds up
    ringRate: 0.5,         // Pull ring cycles per second when the ball is far
    ringBoost: 2.4,        // Extra cycles per second when the ball is on the surface
    pullRing: 22,          // The pull ring drifts in from this far outside the surface, times the planet's mass
    atmosphere: 9,         // The pull ring starts half this far outside the surface
    orbitAlpha: 0.22,      // Moon orbit path
    trailEvery: 2,         // Physics steps between trail samples
    trailDecay: 0.03,      // Seconds per trail point when the trail drains at rest
    trailWidth: 4,
    trailAlpha: 0.5,
    // Suns
    corona: 1.5,           // Corona glow radius in sun radii (the rays reach further)
    coronaAlpha: 0.7,
    flareTime: 0.55,
    flareGrow: 0.8,        // Extra corona radius at the start of a flare, in sun radii
    flareCount: 12,
    flareSpeed: 170,
    flareLife: 0.4,
    flareSize: 3,
    sunHaptic: 30,
    // Comets
    cometHaptic: 20,
    cometSparkCount: 14,
    cometSparkSpeed: 220,
    cometSparkLife: 0.4,
    cometSparkSize: 3,
    cometShake: 2.5,       // Screen px
    cometShakeTime: 0.1,
    // Black holes
    swallowTime: 0.7,      // Seconds the ball spirals into the horizon before it returns to its last rest
    swallowTurns: 1.25,    // Turns it makes on the way in (clockwise, with the swirl)
    swallowHaptic: 45,
    swallowVol: 0.6,
    bhFlareTime: 0.6,
    returnFade: 0.35,      // The ball fades in at its last rest
    // Boss banner
    bannerTime: 1.5,
    bannerIn: 0.25,
    bannerOut: 0.25,
    bannerH: 68,
    bannerY: 0.3,          // Fraction of screen height
    // Sink
    burstCount: 22,
    burstBigCount: 46,
    burstSpeed: 230,
    burstLife: 0.55,
    burstSize: 3.6,
    sinkHaptic: 30,
    sinkRingTime: 0.4,
    sinkRingR: 34,
    coinLead: 0.14,        // Three stars: coin, then win after this long
    threeStarFlash: 0.1,
    // Hole card
    cardSlide: 0.42,
    cardSlideFrac: 0.35,   // Slide distance as a fraction of screen height
    numDelay: 0.12,
    numPop: 0.35,
    starDelay: 0.3,
    starStagger: 0.16,
    starPop: 0.32,
    lineFade: 0.2,
    buttonGap: 0.15,       // Pause after the last star before the buttons appear
    buttonPop: 0.22,
    // HUD and retry
    shotsPopFrom: 0.55,    // Strokes number scale on change, springs to 1 with outBack
    shotsPopTime: 0.3,
    retryTapVol: 0.4,
    retryFade: 0.35,
    // Resting far from the hole
    farRestShots: 3,       // More shots than this on the hole
    farRestDist: 100,      // and resting farther than this from the hole gives the pulse
    restPulseTime: 0.6,
    restPulseR: 3.2,       // In ball radii
    // Menu
    menuPopFrom: 0.7,      // Tile scale when the menu opens after a clear
    menuPopTime: 0.45,
    menuStarDelay: 0.15,
    menuStarStagger: 0.12,
    menuStarPop: 0.3,
    // Badges on the card
    badgeDelay: 0.25,      // After the last star
    badgePop: 0.35,
    badgeHold: 2.2,        // Each new badge shows this long before the next one takes its place
  },

  // Art (layer 5). Cosmetic only; nothing here is read by the physics. Every colour in the game lives in art.palette.
  // Rules: light comes from the upper left and shadows fall to the lower right; line weights are art.line (design units);
  // glows are soft radial gradients; the ball is the highest-contrast object, the range finder the second.
  art: {
    palette: {
      space: '#070b19',      // Letterbox (the engine reads TUNING.bg, set below) and the deepest sky
      starCool: '#dbeafe',
      starWarm: '#fde68a',
      // One per sector of art.sectors: the play field and its nebula tints (never green or orange; sector 2's purples are
      // deep and dim so they never read as gravity); meteor streaks, the whale's rim and the twin suns' glows.
      sectors: [
        { field: '#0e1631', nebula: ['#3346a8', '#0f7490', '#2f5d9e', '#7a3560'] },
        { field: '#120f30', nebula: ['#4c2a85', '#3b2f8f', '#5b2a6e', '#2e2a78'] },
        { field: '#0c1630', nebula: ['#0f7490', '#2f5d9e', '#1e3a8a'], streak: '#dbeafe' },
        { field: '#090e22', nebula: ['#1e2a5a', '#233a6b'], whale: '#04060f', whaleRim: '#94a3b8' },
        { field: '#0b0d24', nebula: ['#7a3560', '#5a3a7a'], suns: ['#f59e0b', '#e0527a'] },
        { field: '#120c22', nebula: ['#7a3560', '#5a3a7a', '#6b2f4f'], core: '#f2b94b' },
      ],
      // Three meanings: green is the goal, purple is gravity, orange is danger and full power.
      green: '#22c55e', greenLight: '#bbf7d0', ink: '#04110a', // ink is the text on green
      purple: '#a855f7',
      planets: [ // Every planet is purple-family; the look is picked from its position and mass
        { light: '#e9d5ff', mid: '#a855f7', dark: '#4c1d95' },
        { light: '#ddd6fe', mid: '#7c6cf0', dark: '#3730a3' },
        { light: '#f5d0fe', mid: '#c26be0', dark: '#6b21a8' },
      ],
      boss: [
        { light: '#fae8ff', mid: '#e879f9', dark: '#6b21a8' },
        { light: '#fbcfe8', mid: '#d946ef', dark: '#86198f' },
      ],
      bossAccent: '#e879f9', bannerBg: '#1a0d2e',
      moon: { light: '#c9d6ea', mid: '#8b9dbb', dark: '#46587a' }, moonCrater: '#5f7294', // cool blue-grey: the ball is the only white sphere
      amber: '#fbbf24', // the range finder warms white to amber; orange is kept for full power
      violet: '#a78bfa', // the range finder while the shot's projected flight enters a black hole's influence ring
      orange: '#f97316', sunCore: '#fffbeb', sunMid: '#fde047', sunRim: '#ea580c', sunRay: '#fdba74',
      slate: '#64748b', slateLight: '#94a3b8', slateDark: '#334155', slateDeep: '#1e293b', // Walls, bars, bumpers, border
      white: '#ffffff', ballMid: '#e2e8f0', ballEdge: '#a3b1c6', ballRim: '#0b1226', ballSpin: '#5f6f8a',
      trail: '#e0ecff', shadow: '#02040c',
      cometCore: '#ecfeff', cometHead: '#67e8f9', cometTail: '#22d3ee', // comets are cyan: a fast body with no pull
      bhCore: '#000000', bhRim: '#c4b5fd', bhSwirl: '#8b5cf6', bhGlow: '#6d28d9', // black holes are gravity (purple) with no surface
      cupDeep: '#02060a', cupEdge: '#0b1f15',
      text: '#f1f5f9', textDim: '#a3aec2', textOff: '#64748b',
      card: '#0c1330', tile: '#16203d', tileLocked: '#0a1024', tileLockedEdge: '#1b2440', retryOff: '#141c33', starOff: '#475569',
      puff: '#cbd5e1', spark: '#94a3b8', sparkBig: '#cbd5e1', restPulse: '#94a3b8',
      tiers: ['#a8a29e', '#c9d6ea', '#a855f7', '#fde047', '#fb923c'], // Badge medals: Meteorite rock, Moon, Planet purple, Star gold, Black Hole (the accretion ring: its edge, text and glow)
      bhTierRim: '#17151c', // Black Hole tier: the near-black disc inside the glowing orange ring
    },
    type: { sm: 15, md: 20, lg: 36, heavy: '800' }, // Three sizes; only the large size is heavy, everything else is the engine's 600
    line: { hair: 1.5, edge: 2, radius: 10, card: 18, button: 14 }, // Design units (button radius is the engine's)
    sky: {
      layers: [ // Far then near: star count, radius range, drift (design units at the field edge), alpha buckets
        { n: 70, r0: 0.4, r1: 0.9, drift: 2.5, alphas: [0.22, 0.34, 0.5] },
        { n: 30, r0: 0.8, r1: 1.4, drift: 6, alphas: [0.4, 0.6, 0.85] },
      ],
      margin: 12,          // Stars are laid out this far beyond the field so the drift never shows an edge
      flares: 4,           // Bright stars with a small cross
      flareLen: 3.6,
      flareAlpha: 0.55,
    },
    // Sectors (PRD v0.5 C): holes grouped by sectorSize share a backdrop. stars scales the star counts, warmChance is the
    // share of warm stars, nebulae is how many soft gradients a hole gets (from its seed). A hole past the last keeps it.
    sectorSize: 5,
    sectors: [
      { name: 'Starfield', stars: 1, warmChance: 0.15, nebulae: [1, 2], nebAlpha: [0.2, 0.32], nebR: [50, 90] },
      { name: 'Nebula', stars: 1, warmChance: 0.1, nebulae: [3, 4], nebAlpha: [0.18, 0.28], nebR: [80, 140] },
      { name: 'Meteor shower', stars: 1, warmChance: 0.15, nebulae: [1, 1], nebAlpha: [0.16, 0.24], nebR: [50, 80], meteors: true },
      { name: 'Deep space', stars: 0.7, warmChance: 0.05, nebulae: [0, 1], nebAlpha: [0.12, 0.18], nebR: [60, 100], whale: true },
      { name: 'Binary sunrise', stars: 0.8, warmChance: 0.4, nebulae: [1, 2], nebAlpha: [0.12, 0.2], nebR: [60, 100], sunrise: true },
      { name: 'Galactic Core', stars: 1.6, warmChance: 0.45, nebulae: [1, 2], nebAlpha: [0.1, 0.16], nebR: [60, 100], core: true },
    ],
    meteors: {
      period: 6,           // Seconds between showers
      count: 4,            // Streaks per shower
      stagger: 0.35,       // Seconds between streak starts
      life: 0.7,           // Seconds a streak is visible
      speed: 420,          // Design units per second
      len: [50, 95],       // Tail length
      angle: [2.1, 2.5],   // Heading in radians (down and to the left)
      alpha: 0.55,         // Head alpha at the middle of its life; the tail fades to nothing. Dimmer than the brightest stars.
      width: 1.4,
    },
    whale: {
      period: 60,          // One pass a minute
      cross: 40,           // Seconds a pass takes; the rest of the minute the sky is empty
      size: 150,           // Length in design units
      y: 0.3,              // Height as a share of the field
      bob: 8,              // Slow rise and fall over a pass
      alpha: 0.8,
      rimAlpha: 0.14,
      rimW: 1,
    },
    sunrise: {
      suns: [ // Centres below the field's bottom edge (x as a share of the width, dy below the edge), radius; only the glow rises
        { x: 0.32, dy: 40, r: 190 },
        { x: 0.74, dy: 70, r: 150 },
      ],
      alpha: 0.1,
    },
    core: { x: 0.5, dy: 50, r: 330, alpha: 0.1 }, // The galaxy's core: one wide golden glow rising from below the bottom edge (sector 6)
    planet: {
      lowMass: 0.75,       // Below this: plain with a few craters
      ringMass: 1.2,       // Above this: ring system (bands in between)
      atm: 0.3,            // Atmosphere width as a fraction of the radius
      atmAlpha: 0.5,
      rimAlpha: 0.6,       // Crisp edge line, so the dark side of a planet still shows its size
      moonAtm: 0.5,        // A moon's atmosphere is this much of a planet's
      craters: [3, 5], bands: [3, 5], ringBands: 2,
      bandAlpha: [0.14, 0.28],
      craterAlpha: 0.32,
      ringR: 1.3, ringW: 0.1, ringInner: 1.14, ringInnerW: 0.05, ringAlpha: 0.5, ringTilt: 0.5, ringSquash: [0.26, 0.36], // outer edge 1.35 radii
    },
    sun: {
      raysA: 12, lenA: 2.0,   // Long rays, in sun radii (short ones are three quarters as long)
      raysB: 8, lenB: 1.6,    // Second, counter-rotating set
      rayRate: 0.14,          // Radians per second
      rayAlpha: 0.75,
      shimmerRate: 2.6,       // Heat shimmer ring: radians per second of its breathing
      shimmerAmp: 0.05,
      shimmerAlpha: 0.5,
      reachAlpha: 0.6, reachDash: [4, 6], reachW: 1.4, // The reach ring: a faint warm dashed circle where the pull starts (sunReach past the surface)
    },
    metal: { bevel: 1.5, boltMin: 16, boltR: 1.9, railW: 6 },
    comet: {
      tail: 48,               // Tail length (design units); it grows from nothing at the start of the path
      tailW: 0.9,             // Tail half-width at the head, in comet radii
      glowR: 2.4,             // Head glow, in comet radii
      pathAlpha: 0.16,        // The faint dashed path from a to b
    },
    blackhole: {
      arms: 3, armTurns: 0.7, // Swirl arms: count, and turns from the influence ring in to the horizon
      armOuter: 0.3,          // The arms fade to this alpha at the influence ring
      reachAlpha: 0.75, reachDash: [5, 7], reachW: 1.6, // The influence ring: a dashed circle at `reach` (design units for the dash and width)
      restAlpha: 0.55, restDash: [2, 6], restW: 1.4, bandAlpha: 0.06, // The rest radius (a slow ball inside it is pulled in): a finer ring, 3:1 or better, over a faint wash of the fade band
      swirlRate: 0.55,        // Radians per second, clockwise
      ringRate: 0.45,         // Inward drifting rings per second
      rings: 3, ringAlpha: 0.55,
      armAlpha: 1,            // Full strength: the arms read at about 4:1 on the field and stay far below the ball's white highlight
      lens: 1.7, lensAlpha: 0.5, // Soft purple glow just outside the horizon
      rimW: 2.2,              // Horizon ring width (design units)
      flareGrow: 0.5,         // Extra glow radius at the start of a swallow flare, in horizon radii
    },
    ball: {
      shadowDx: 2.4, shadowDy: 3.4, shadowR: 1.25, shadowAlpha: 0.6, // Offset toward the lower right, in design units at rest size
      rim: 1.1,               // Thin dark rim so the white ball holds against pale planets
      spinMax: 12,            // Radians per second (a marking that turns faster than this only strobes)
      seam: 0.13,
    },
    ghost: { dotR: 1.3, every: 2 }, // The last shot's ghost: dot radius, and one dot per this many trail samples
    retry: { pad: 14, icon: 7, iconW: 2.2, head: 4.5, gap: 9 }, // The HUD Retry button: left padding, arrow radius, line width, arrowhead size, gap to the word (screen px)
    hint: { text: 'Drag anywhere away from the ball to aim, release to shoot.', fade: 0.5, y: 0.14, pad: 14, lineH: 20, margin: 28 }, // The first-run hint: on a fresh save until the first release, then it fades (seconds; y as a fraction of the field's height from its top)
    further: { text: 'Drag further', time: 1.2, dy: 30 }, // A release inside the dead zone: this call-out above the ball for `time` seconds (dy in design units)
    stuckShots: 3, // Shots from a planet (or sun) that end on the same one before the 'More power to leave the planet (sun)' toast, once per hole
    hudRun: { line1: 12, line2: 32 }, // The run counter and the landed mark, left of Retry: baselines below the HUD (screen px)
    trail: {
      minSpeed: 90,           // Below this the trail drains
      speedRef: 700,          // Speed at which the trail is at full strength
      glowWidth: 2.6, glowAlpha: 0.28,
      floor: 0.3,             // Weakest strength, at minSpeed
    },
    range: {
      r0: 3.4, r1: 1.4,       // Dot radius, first to last
      a0: 0.95, a1: 0.38,     // Dot alpha, first to last
      powerGrow: 0.25,        // Dots swell by this much at full power
      firstDots: 6,           // The first segment is brighter: a tapering line and boosted dots
      dotGroup: 3,            // Dots per fill (they share an alpha), to keep the draw calls few
      headBoost: 0.35, headW: 3.4, headAlpha: 0.6,
      backAlpha: 0.4, backGrow: 1,   // Dark backing under each dot for pale backgrounds
      gaugeGap: 5, gaugeW: 2.4, gaugeTrack: 0.22, // Power gauge ring around the ball
      capLen: 8, capW: 3, capGap: 5.5, capAlpha: 1, capGlowR: 13, capGlowA: 0.4, // Soft end cap of a preview cut by time
      violetMin: 0.65,        // While violet (the path enters an influence ring) no dot fades below this, so every dot keeps 3:1 on the field
    },
    cup: {
      haloR: 2.3, haloIdle: 0.16, haloGlow: 0.5,
      glowIdle: 0.12, glowMax: 0.75, glowRate: 12, // Per second, easing toward the sinkable state
      flagH: 26, flagW: 13, flagRate: 3.2, flagWave: 1.4,
    },
    tile: { number: 14, icon: 37, iconR: 10, sunR: 7, stars: 10, starR: 5.5, bhReach: 1.45 }, // Offsets from the tile top (stars from the bottom), design px; bhReach: a badge black hole's ring in icon radii
    menu: { titleGap: 26, tabBottom: 42, missionsW: 150, rowGap: 12 }, // Title sits titleGap below the engine's TUNE tab (safe top + 42)
    missions: { top: 64, headH: 32, rowH: 58, rowGap: 6, medalR: 20, bottom: 156, backW: 200, backH: 52, scrollBar: 3, margin: 16, lineH: 17, toastBand: 96 }, // rowH for a one-line condition; each extra line adds lineH. Back sits above toastBand: the engine's toast (24 px up, two lines) takes taps while it shows
    swatch: { size: 46, gap: 10, perRow: 6, headH: 26, rowGap: 10, ring: 3, ballR: 13 }, // The Skins block on the missions screen (swatches at least 44 px)
    ticket: { w: 320, h: 50, r: 14, medalR: 18 }, // The badge ticket that pops over the top edge of the hole card
    tierGlow: { rate: 0.4, min: 0.25, max: 0.85, r: 1.55, halo: 3 }, // Black Hole tier rim: glow pulses per second, its alpha range, its radius in medal radii, and the ticket's halo width (design px)
    secret: { name: '???', text: 'Secret badge', mark: 1.15 }, // A secret badge not yet earned: its name, its one line, and the '?' size in medal radii
    // Skins (PRD v0.3 C2): data entries, each earned by one badge. A ball skin sets the body gradient (light, mid, edge, or
    // `stops` for chrome), the seam (`seamKind`: 'seam', 'corona' or 'crescent'), the rim and the shadow tint; anything left
    // out is the default ball. A trail skin sets the trail colour everywhere (only the default trail turns gravity purple near a
    // planet); `none` draws no trail. The white highlight on every skin keeps the ball the brightest sphere on the field; dark bodies
    // carry a light rim. Physics, the range finder and the cup never change.
    skins: {
      balls: [
        { id: 'default', name: 'Classic', badge: null },
        { id: 'comet', name: 'Comet', badge: 'first-orbit', light: '#f0f9ff', mid: '#b5e2fb', edge: '#6fa9cf', seam: '#2f6f99', shadow: '#01121c' },
        { id: 'brass', name: 'Brass', badge: 'banker', light: '#fff1c9', mid: '#d6ab4c', edge: '#8a6420', seam: '#5a3d0c', shadow: '#140c02' },
        { id: 'ember', name: 'Ember', badge: 'slingshot', light: '#ff8f7a', mid: '#9f1d1d', edge: '#4a0b0b', seam: '#240404', rim: '#ffd0c4', rimW: 1.5, rimA: 0.95, shadow: '#160202' },
        { id: 'moonstone', name: 'Moonstone', badge: 'touchdown', light: '#f8fafc', mid: '#c3ccd8', edge: '#8793a6', seam: '#5b6779' },
        { id: 'solar', name: 'Solar', badge: 'untouched', light: '#fffbe0', mid: '#fde047', edge: '#d49a0f', seam: '#ea580c', seamKind: 'corona', shadow: '#140d00' },
        { id: 'nebula', name: 'Nebula', badge: 'binary-star', light: '#f3e8ff', mid: '#a855f7', edge: '#4c1d95', seam: '#2e1065', rim: '#f5d0fe', rimW: 1.2, rimA: 0.8, shadow: '#0c0419' },
        { id: 'chrome', name: 'Chrome', badge: 'clockwork', stops: [0, '#ffffff', 0.42, '#b9c2cf', 0.5, '#3b4452', 0.62, '#dfe5ec', 1, '#6b7584'], seam: '#1e293b' },
        { id: 'void', name: 'Void', badge: 'never-landed', light: '#2a2a3a', mid: '#0e0e16', edge: '#000000', seam: '#34344a', rim: '#ffffff', rimW: 1.6, rimA: 1 },
        { id: 'eclipse', name: 'Eclipse', badge: 'eclipse', seam: '#05070d', seamKind: 'crescent' },
        { id: 'gold', name: 'Gold', badge: 'perfect-run', light: '#fff7cc', mid: '#f5c542', edge: '#a87708', seam: '#6b4a05', shadow: '#140e00' },
      ],
      trails: [
        { id: 'default', name: 'Starlight', badge: null, col: '#e0ecff' },
        { id: 'comet', name: 'Cyan', badge: 'first-orbit', col: '#22d3ee' },
        { id: 'brass', name: 'Warm', badge: 'banker', col: '#fbbf6a' },
        { id: 'ember', name: 'Orange', badge: 'slingshot', col: '#f97316' },
        { id: 'moonstone', name: 'White', badge: 'touchdown', col: '#ffffff' },
        { id: 'solar', name: 'Sunlit', badge: 'untouched', col: '#fbbf24' },
        { id: 'nebula', name: 'Magenta', badge: 'binary-star', col: '#e879f9' },
        { id: 'chrome', name: 'Silver', badge: 'clockwork', col: '#cbd5e1' },
        { id: 'void', name: 'Violet', badge: 'never-landed', col: '#8b5cf6' },
        { id: 'eclipse', name: 'None', badge: 'eclipse', col: null },
        { id: 'gold', name: 'Gold', badge: 'perfect-run', col: '#facc15' },
        { id: 'under-par', name: 'Green', badge: 'under-par', col: '#22c55e' },
      ],
    },
  },

  // Ranks (PRD v0.6). Stars drive the rank and nothing else: rank n needs (n - 1) times starsPerRank stars, so the ladder never
  // changes when holes are added. The rank is computed from the saved stars and never stored (only `rankSeen` is). Sizes are screen px
  // unless stated, times are seconds. `ranks` is the ladder in order: the name, the emblem file in assets/ (without extension) and the
  // emblem's own colour, used for the card's border, glow ring and sparks.
  rank: {
    starsPerRank: 10,
    menu: { emblem: 72, cardH: 88, margin: 16, pad: 12, nameY: 26, lineY: 56, barY: 70, barH: 6, chevron: 6, nameMin: 24, lineMin: 14, titleW: 220, titleAspect: 467 / 1024, titleGap: 12, gridGap: 22 }, // The headline card under the title; nameY, lineY, barY are from the card's top
    ladder: { emblem: 44, rowH: 56, rowGap: 6, pad: 10, dividerH: 30, headGap: 6, lineGap: 4, tail: 6, silRes: 128, silhouette: '#1e293b', lockedMedal: 0.35 }, // Rows on the missions screen; silRes is the silhouette canvas size
    card: {
      w: 300, h: 280, top: 28, emblem: 150, oldScale: 0.7, dim: 0.82,
      delay: 0.2,          // After the hole's end card shows its buttons
      menuDelay: 0.5,      // After the menu opens, for a veteran's one card
      total: 1.8, fadeIn: 0.2, fadeOut: 0.22,
      swapAt: 0.3, swapTime: 0.4, glowR: 0.95, glowAlpha: 0.55,
      ringAt: 0.4, ringTime: 0.6, ringFrom: 0.9, ringTo: 2, ringW: 6, // In emblem half-widths
      sparks: 26, sparkSpeed: 260, sparkLife: 0.7, sparkSize: 3.4, sparkWhite: 0.55, // The second burst is the colour mixed this far to white
      titleY: 214, lineY: 246, textAt: 0.5, textIn: 0.2, haptic: 30,
      chime: [{ f: 523.25, d: 0.14 }, { f: 659.25, d: 0.14 }, { f: 783.99, d: 0.4 }], chimeAt: 0.3, chimeGap: 0.12, chimeGain: 0.18,
    },
    ranks: [
      { name: 'Asteroid', file: 'rank-01-asteroid', col: '#c9b99a' },
      { name: 'Moon', file: 'rank-02-moon', col: '#bcd4f5' },
      { name: 'Planet', file: 'rank-03-planet', col: '#4fa3d9' },
      { name: 'Giant Planet', file: 'rank-04-giant-planet', col: '#f0a050' },
      { name: 'Brown Dwarf', file: 'rank-05-brown-dwarf', col: '#c0654a' },
      { name: 'Red Dwarf', file: 'rank-06-red-dwarf', col: '#f0452a' },
      { name: 'Yellow Star', file: 'rank-07-yellow-star', col: '#fbbf24' },
      { name: 'Blue Star', file: 'rank-08-blue-star', col: '#5cc8f5' },
      { name: 'Red Giant', file: 'rank-09-red-giant', col: '#e0452a' },
      { name: 'Blue Giant', file: 'rank-10-blue-giant', col: '#4aa8f5' },
      { name: 'White Dwarf', file: 'rank-11-white-dwarf', col: '#b8d8f5' },
      { name: 'Supernova', file: 'rank-12-supernova', col: '#f59e3b' },
      { name: 'Nebula', file: 'rank-13-nebula', col: '#c084fc' },
      { name: 'Neutron Star', file: 'rank-14-neutron-star', col: '#38bdf8' },
      { name: 'Quasar', file: 'rank-15-quasar', col: '#e879f9' },
      { name: 'Black Hole', file: 'rank-16-black-hole', col: '#f08a24' },
    ],
  },

  // Exotic badges (PRD v0.7). The flight measurements only watch the physics (speed, each body's pull, contacts); they never change it.
  // Speeds are design units per second, angles degrees, times minutes.
  badges: {
    bendTurn: 10,          // A gravity body "bent" the sinking shot if its pull alone turned the heading this much over the flight (net, in degrees)
    heatSpeed: 80,         // Heat Death: sink slower than this (set by the harness: the lowest 10-step value with a 1 degree, 5 px sink on some hole; about 21 percent of sinkSpeed)
    heatMinutes: 10,       // Heat Death: or hole out after this many minutes on the hole (screen on and app visible)
    lagrangePull: 4,       // Lagrange Point: each of two bodies pulls at least this times restPull() (the open-field rest threshold)
    lagrangeApart: 150,    // and the two pulls point at least this many degrees apart
    lagrangeClear: 9,      // and the ball's edge is at least this far from every surface: open space, not hovering on a planet where a moon cancels its pull
    relSpeed: 850,         // Relativistic: reach this speed on any shot (set by the harness; above the full-power launch speed of 820)
    ftlSpeed: 970,         // FTL: reach this speed on any shot (set by the harness: the highest top speed a shot reaches over 1 degree of aim and 5 px of drag; well above relSpeed)
    improbableStrokes: 42, // Improbability Drive: hole out on exactly this stroke
    wormholeThree: 2,      // Wormhole: a hole in one on a hole whose three stars take at least this many strokes
    chime: [{ f: 196, d: 0.18 }, { f: 246.94, d: 0.18 }, { f: 392, d: 0.5 }], chimeGap: 0.14, chimeGain: 0.2, // Black Hole tier: a lower, longer chime than the Star tier's
    fxCount: 18, fxSpeed: 200, fxLife: 0.5, // The burst at the ball when a badge is earned in flight
  },
};
const T = TUNING;
const J = T.juice;
const STEP = T.physicsStep;
TUNING.bg = TUNING.art.palette.space; // the engine reads TUNING.bg for the letterbox

// Hole data. Coordinates are design space; the four field edges are walls added by the physics.
//   stars: { three, two }: three is the fewest strokes proved in the harness; two is par, shown on the card.
//   walls: axis-aligned rectangles { x, y, w, h }.
//   planets: { x, y, r, mass }; mass 1.0 is standard, up to 1.5 on bosses if the escape rule holds; mass 0 is a bumper.
//   suns: { x, y, r, mass?, reach? }: pull like a planet of mass `mass` (sunMass) with the distance floored at sunPullR, within
//     `reach` (sunReach) of the surface, fading smoothly to nothing at sunFade times that ring's radius; a touch costs
//     sunPenalty strokes and the ball bounces on (no landing).
//   movers, all on the hole clock (restarts at 0 whenever the ball comes to rest):
//     { type: 'slide', w, h, a: { x, y }, b: { x, y }, period? }: a wall easing from a to b and back (period defaults to moverPeriod).
//     { type: 'bar', x, y, len, phase }: a bar of length len spinning about its centre at barAngularSpeed; phase is its angle (radians) at clock 0.
//     { type: 'moon', parent, orbitR, period, r, mass, phase }: a small planet circling planets[parent] clockwise; phase is its angle at clock 0.
//     { type: 'comet', a: { x, y }, b: { x, y }, period, r? }: a body crossing from a to b in period seconds, then back at a;
//       no pull; contact adds cometPush times its velocity to the ball on top of a wallBounce reflection. r defaults to cometR.
//   blackholes: { x, y, r?, mass?, reach? }: pulls like a planet of mass `mass` (bhMass) with the distance floored at bhPullR
//     inside its influence ring (reach, bhReach), fading smoothly to nothing at bhFade times the ring; a ball whose centre
//     crosses the horizon (r, holeR2) is swallowed: bhPenalty strokes and back to where the shot started.
//   A ball never comes to rest where a mover would sweep it (a bar's disc, a moon's orbit band, a slide's or comet's path); it waits
//   there until the part knocks it on. A ball that lands on a moon rides it. So keep tees, cups and other objects clear of
//   those zones, keep orbitR at least parent r + moon r + 2 ball radii, and keep moon orbits clear of walls and suns.
// Drag vectors in the comments are screen px (finger moves dx right, dy down); the ball flies the opposite way.
// Entries are pasted from the content shards' JSON (docs/games/gravity-golf/README.md); tools/sim-golf.mjs verifies each one.
const LEVELS = [
  {
    // Teaches drag, power and release, and that a planet bends the flight: a straight shot curves into it, so aim off the line.
    // three: drag (14, 119), one shot, passing 38 units from the surface; sinks over 11 degrees of aim and 113 to 142 px of drag.
    // v0.4 (PRD v0.4 C window rule): the route is drag (27, 102), passing farther left of the planet; it sinks over 17.1 degrees of aim and 93 to 128 px of drag, its whole-pixel neighbours over at least 16.25 degrees and 31.5 px ((14, 119) has a 10 px neighbour).
    name: 'First Light', boss: false, stars: { three: 1, two: 2 },
    ball: { x: 180, y: 530 }, hole: { x: 180, y: 200 },
    walls: [], planets: [{ x: 240, y: 360, r: 34, mass: 0.8 }], suns: [], movers: [],
  },
  {
    // Teaches the bank: the wall blocks every straight line, so bounce off the left edge through the gap.
    // three: drag (79, 120), one bank, one shot; sinks over 9 degrees of aim and 101 px of drag up to full power.
    name: 'Bank Shot', boss: false, stars: { three: 1, two: 2 },
    ball: { x: 120, y: 500 }, hole: { x: 110, y: 160 },
    walls: [{ x: 35, y: 320, w: 165, h: 22 }], planets: [], suns: [], movers: [],
  },
  {
    // Teaches the slingshot: the planet sits on the straight line and the wall shuts the low way round, so pass close up
    // the planet's right side and let it whip the ball over its top and across to the cup on the left.
    // three: drag (-5, 131), one shot, passing 30 units from the surface; sinks over 7.7 degrees of aim and 111.6 to 145.6 px of
    // drag (its whole-pixel neighbours at least 7.6 degrees and 32.5 px). A bank off the right edge into the same whip sinks
    // over 9.5 degrees at full power. No-straight sweep: 0.
    // v0.5 (PRD v0.5 D0): the cup moves from (125, 225) to (150, 200), a shorter whip, so the route meets the window rule
    // (v0.4: 4.2 degrees and 17.5 px); the wall ends at x 160 instead of 200, clear of the planet, so no ball wedges in the
    // corner where the wall used to run into it. two: (-4, 111) rests above the wall end at (165, 315), then (0, 87).
    name: 'Slingshot', boss: false, stars: { three: 1, two: 3 },
    ball: { x: 300, y: 560 }, hole: { x: 150, y: 200 },
    walls: [{ x: 0, y: 330, w: 160, h: 22 }], planets: [{ x: 220, y: 300, r: 48, mass: 1 }], suns: [], movers: [],
  },
  {
    // Teaches landing: the wall blocks every line from the tee to the cup (and banks), so put the first shot on the planet, then leave its right side and go straight up through the gap on the left. three: drag (86, 28) lands on the planet at (123, 528) (any shot at the planet lands there), then drag (-23, 143) sinks in one flight with 0 bounces. two (3 strokes): (91, 24) rests at (111, 553), (0, 30) rests at (122, 533), (-30, 142) sinks. Sweep from the tee: 0 straight sinks; last-shot aim window 9.6 degrees (-5.8 / +3.8), drag 131.8 px to full power.
    // v0.4 (PRD v0.4 C window rule): the route lands on the planet's top instead: (114, 0) runs left under the planet, bounces off the left edge and curls onto its top at (89.9, 473.3), then (-7, 128) goes straight up through the gap over 12.1 degrees of aim and 120.7 px to full power (neighbours at least 11.95 degrees and 29.2 px); from v0.3's landing point the last shot has 18.2 px.
    name: "Landing", boss: false, stars: { three: 2, two: 3 },
    ball: { x: 300, y: 590 }, hole: { x: 95, y: 110 },
    walls: [{ x: 150, y: 300, w: 210, h: 22 }], planets: [{ x: 75, y: 520, r: 40, mass: 1 }], suns: [], movers: [],
  },
  {
    // Teaches the double pass between two planets: the lower planet blocks the line to the cup, the upper one sits under it, and the lower right wall shuts the corridor a tee shot would need, so land on the lower planet first, then launch from its top so it bends the ball toward the upper planet, which whips it over its top and down into the cup. three: drag (-7, 50) lands on the lower planet at (155.3, 410.2), then drag (54, 134) sinks with 0 bounces, passing the lower planet at 14.5 and the upper at 38.5. two (4 strokes): (-7, 50), (0, 20) rests (161.2, 404.0), (40, 30) rests (159.8, 405.3), (54, 134) sinks; (-7, 50), (0, 20), (54, 134) sinks in 3. Sweep from the tee: 0 straight sinks; last-shot aim window 7.5 degrees (-3.8 / +3.7), drag 137 px to full power.
    // v0.4 (PRD v0.4 C window rule, boss): the route lands on the lower planet's top instead: (42, 0) rolls left, curls up round the lower planet and lands on its top at (205.9, 398.1), then (69, 118) sinks over 9.95 degrees of aim and 132.2 px to full power (neighbours at least 9.2 degrees and 17.4 px); from v0.3's landing point the last shot has 13 px.
    // v0.5 (PRD v0.5 A2): widened to a 25 px drag window. The cup moves from (167, 110) to (150, 135) and the upper planet's mass from 1.5 to 0.9 (a gentler whip; the cup stays over 89 from its centre, so a ball resting on it is never inside the cup's pull). Route (42, 0) lands at (189.8, 394.0), then (63, 118): 13.75 degrees and 118.3 px to full power (neighbours at least 13.65 degrees and 31.1 px); noisy human 95 percent. two: (42, 0), (0, -20), (63, 118).
    name: "Binary", boss: true, stars: { three: 2, two: 4 },
    ball: { x: 228, y: 581 }, hole: { x: 150, y: 135 },
    walls: [{ x: 73, y: 264, w: 22, h: 196 }, { x: 238, y: 470, w: 122, h: 22 }], planets: [{ x: 188, y: 435, r: 32, mass: 1.1 }, { x: 188, y: 223, r: 36, mass: 0.9 }], suns: [], movers: [],
  },
  {
    // Teaches choosing the safe side: a sun sits in front of the tee and shuts the short near-side lane (no near-side sink at one stroke), so go the long way round the far side with more power. three: drag (-91, 100), one shot, passing 30 from the surface; sinks over 8.85 degrees of aim and 118 to 147 px. two: (-46, 39) lands on the planet, then (-3, 90). Sweep (0.5 degrees, 5 px): 0 straight sinks.
    // v0.3: the sun sits at (86, 492), 184 from the planet centre (v0.2: 158) and 46 from the left edge, so no slot opens between them. Soft shots (15 to 75 px, every 0.5 degrees and 1 px) charge two penalties in 4227 and three in 404, never four (v0.2 at (100, 470): 5788 and 249; v8 at (61, 469): 2279, 207 and 2 of four). The remaining doubles and triples are balls the planet presses back into the sun's underside.
    // v0.5 (PRD v0.5 B, suns have mass): the old sun 78 from the tee pulled every soft shot in, so it moves to (100, 405), r 30, beside the near-side lane, and the cup to (245, 225). three: drag (-108, 82), the far side round the planet, 0 bounces: 13.7 degrees and 122.6 px to full power (neighbours at least 13.6 degrees and 26.6 px); noisy human 97.5 percent. One clean one-shot sink goes up the near side (of 89). two: (34, 106) rests on the planet's top at (209.4, 295.0), then (-69, 95).
    // v18 (sun reach): a sun now pulls only within sunReach (12) of its surface, fading out by 1.2 times that ring, so the v0.5 layout stays and the route is re-found: drag (-89, 80), 0 bounces, passes the planet at 52: 15.45 degrees and 103.2 px to full power (neighbours at least 14.0 degrees and 46.4 px); noisy human 100 percent. Soft tee misses (15 to 75 px) touching the sun: 32.8 percent, twice 0.6 percent (v15 42.0 and 3.6, v17 99.0 and 21.8). two: (-46, 39) rests on the planet, then (-3, 90).
    name: "Solar Flare", boss: false, stars: { three: 1, two: 3 },
    ball: { x: 90, y: 570 }, hole: { x: 245, y: 225 },
    walls: [{ x: 0, y: 300, w: 70, h: 22 }], planets: [{ x: 190, y: 340, r: 40, mass: 1 }], suns: [{ x: 100, y: 405, r: 30 }], movers: [],
  },
  {
    // Teaches bumper banks: mass 0 planets do not pull, so aim by where the ball rebounds. three: drag (-120, 72), one shot, glancing off the bumper beside the tee, then the floor, then up into the cup (2 bounces); sinks over 5.2 degrees of aim and 135 px to full power. two: (-80, 0) rolls to (294, 592), then (-2, 70). Sweep (0.5 degrees, 5 px): 0 straight sinks.
    // v0.3: a half-sunk floor bumper right of the tee closes the floor-bank ace (an 18 degree cluster around drag (-84, -86)): one-shot sinks that bank off the floor first fell from 320 to 2 (widest 1 degree), all one-shot sinks from 536 to 283; the widest aim cluster is now the route's own bumper bank (8.5 degrees at full power).
    // v0.5 (PRD v0.5 D0): the cup moves down from (299, 404) to (299, 440), so the bumper bank arrives slower and the route meets the window rule: (-109, 64) sinks over 6.75 degrees and 123.4 px to full power (neighbours at least 6.6 degrees and 26.1 px); v0.4's (-120, 72) had 14.6 px. two: (-111, 54) rests at (308.1, 491.3), then (-5, 39).
    name: "Pinball", boss: false, stars: { three: 1, two: 2 },
    ball: { x: 122, y: 592 }, hole: { x: 299, y: 440 },
    walls: [{ x: 0, y: 399, w: 175, h: 22 }], planets: [{ x: 171, y: 527, r: 36, mass: 0 }, { x: 91, y: 151, r: 31, mass: 0 }, { x: 240, y: 247, r: 28, mass: 0 }, { x: 150, y: 640, r: 24, mass: 0 }], suns: [], movers: [],
  },
  {
    // Teaches timing a slingshot: a sliding door hangs in the exit lane and the whip only works while it is raised. three: drag (0, 120) released at clock 1.25 (window about 1.0 to 1.6 s of the 2.4 s cycle), one shot, passing 25 from the surface; sinks over 5.7 degrees of aim and 115 to 127 px. Fired at clock 0 to 0.9 the ball hits the door. two: (-19, 108) at clock 0 lands on the planet, then (-18, 129) at clock 1.25. Sweep at clocks 0, 0.5, 1.0, 1.25, 1.5, 2.0: 0 straight sinks.
    // v0.5 (PRD v0.5 D0): the tee moves up to (50, 500) and the cup down to (225, 235), a shorter flight, so the route meets the window rule: drag (50, 124) at clock 1.4 banks off the left edge into the planet's pull and whips over its top through the door's lane, sinking over 6.7 degrees and 119.2 px to full power (neighbours at least 6.55 degrees and 29.8 px); it finishes for release clocks 0.95 to 2.05 of the 2.4 s door cycle (23 of 48 tried) and hits the door otherwise. v0.4's (0, 120) had 12 px; no bank-free whip at this size reached 20 px. The cup stays over 101 from the planet's centre, so a ball resting on the planet is never inside the cup's pull (it would never rest). two: (51, 105) rests on the wall top at (190.6, 273.7), then (-44, 37) at any clock (an untimed two-stroke way, as in v0.4).
    name: "Tide", boss: false, stars: { three: 1, two: 3 },
    ball: { x: 50, y: 500 }, hole: { x: 225, y: 235 },
    walls: [{ x: 160, y: 330, w: 200, h: 22 }], planets: [{ x: 140, y: 300, r: 48, mass: 1 }], suns: [], movers: [{ type: "slide", w: 22, h: 100, a: { x: 165, y: 58 }, b: { x: 165, y: 130 }, period: 2.4 }],
  },
  {
    // Teaches timing a moving part: the bar spins in the door and the planet is the staging post. three: (-30, 18) at clock 0 lands on the planet top, then (-51, 120) released at clock 1.45 passes the bar and sinks, the sun guarding the left lane; it sinks for clocks 1.15 to 1.75 and over 10.3 degrees of aim. two: four shots, (-30,18) / (-51,120) at clock 0.3 misses / (127,27) / (-51,120) at clock 1.45. Sweep: 0 straight sinks.
    // v0.5 (PRD v0.5 B): the sun's pull moves every rest, so the route changes and the hole does not: (147, 31) runs off the left edge and settles on the planet's top at (233.5, 432.4) at any release clock (9 of 9 one-pixel nudges still finish), then (-60, 121) at clock 1.35 passes the bar and sinks (the bar allows 13 of 53 release clocks): 6.35 degrees, 123.1 to 145.1 px (neighbours at least 6.15 degrees and 20.5 px); noisy human 89 percent. two: (147, 31), (0, -20), (-60, 121) at clock 1.35.
    // v18 (sun reach): the v0.3 route holds again: (-30, 18) settles on the planet's top at (244.4, 431.0), then (-51, 120) at clock 1.45 (clocks 1.18 to 1.70 of each half-turn of the bar): 10.25 degrees and 37.6 px (neighbours at least 10.05 degrees and 37.1 px); noisy human 100 percent, the whole route with every shot noisy 76 percent. two: (-30, 18), (-51, 120) at 0.3 misses, (127, 27), (-51, 120) at 1.45.
    name: "Windmill", boss: false, stars: { three: 2, two: 4 },
    ball: { x: 40, y: 470 }, hole: { x: 315, y: 110 },
    walls: [{ x: 0, y: 289, w: 195, h: 22 }, { x: 173, y: 311, w: 22, h: 100 }, { x: 335, y: 289, w: 25, h: 22 }], planets: [{ x: 245, y: 480, r: 40, mass: 0.7 }], suns: [{ x: 250, y: 185, r: 20 }], movers: [{ type: "bar", x: 265, y: 300, len: 90, phase: 0 }],
  },
  {
    // Boss: a heavy planet with an orbiting moon sits under the door; the moon closes the slingshot window on a 4 s cycle and a sun blocks the low approach from the tee. three: (-6, 90) at clock 0 (fine at 0 to 0.75 and 3.25 up; at 1 to 3 the ball meets the moon) lobs up the left and lands on the planet top, then (-69, 98) at clock 1.25 (works at clocks 3.7 to 2.4; 2.5 to 3.6 the moon spoils it) banks off the right edge through the door and settles on the ceiling, then (58, 94) sinks over 9.95 degrees of aim at any clock. two: (-6,90) / (-69,98) at 1.25 / (90,0) / (52,120). Sweep: 0 straight sinks.
    // v0.5 (PRD v0.5 B): under the sun's pull the old first shot no longer reached the planet's top; new route, same hole: (70, 114) at clock 0 lands on the planet's upper right at (235.5, 374.6) (release clocks 0 to 0.8 and 3.3 up: the moon, as before), (-66, 111) at clock 1.25 goes through the door onto the wall top at (241.1, 169.0) (26 of 40 moon clocks), then (63, 93) at any clock: 11.9 degrees, 75.3 px to full power (neighbours at least 11.15 degrees and 73.9 px); noisy human 100 percent. two: the same with a nudge (20, 0) along the wall top before the last shot.
    // v18 (sun reach): the v0.3 route holds again: (-6, 90) lands on the planet's top at (214.6, 349.7) (release clocks 0 to 0.75 and 3.25 up of the 4 s moon cycle), (-69, 98) at clock 1.25 settles on the wall top at (227.7, 169.0) (clocks 3.75 round to 2.4), then (58, 94) at any clock: 9.95 degrees and 74.0 px (neighbours at least 9.2 degrees and 73.4 px); noisy human 100 percent. The sun stays at (140, 548): moved away from the tee it opens a timed two-stroke lane past the wall's right end. Soft tee misses touching the sun 38.0 percent, twice 1.2 (v15 31.1 and 1.5). two: (-6, 90), (-69, 98) at 1.25, (90, 0), (52, 120).
    name: "Eclipse", boss: true, stars: { three: 3, two: 5 },
    ball: { x: 60, y: 590 }, hole: { x: 60, y: 130 },
    walls: [{ x: 0, y: 178, w: 290, h: 22 }, { x: 120, y: 70, w: 22, h: 108 }], planets: [{ x: 180, y: 400, r: 52, mass: 1.2 }], suns: [{ x: 140, y: 548, r: 20 }], movers: [{ type: "moon", parent: 0, orbitR: 96, period: 4, r: 12, mass: 0.4, phase: 0 }],
  },
  {
    // Teaches timing a crossing comet: the planet and the wall gap force one line up the middle, and a slow, broad comet crosses it just under the door, so let it pass. three: drag (3, 150) released at clock 0.55 (safe from 0.27 to 0.88 s of the 1.2 s cycle; at 0 to 0.26 and 0.89 to 1.19 the comet knocks it back onto the planet), one shot, passing 25 from the planet; aim window 4.85 degrees, drag 138.5 px to full power. two: (0, 60) lands on the planet, then (39, 129) at clock 0.3. Sweep at clocks 0, 0.3, 0.55 and 0.9: 0 straight sinks.
    // v0.3 (v11 review): the comet blocked the route on 13 percent of release clocks (a 440-unit path at 300 u/s); it now runs 110 units under the door at 92 u/s, r 18, 18 below the walls, and blocks 48 percent.
    // v0.5 (PRD v0.5 D0): the tee moves up from (250, 590) to (260, 480), so the shot no longer needs full power: (15, 133) at clock 0.8 sinks over 7.45 degrees and 118.3 px to full power (neighbours at least 7.3 degrees and 28.5 px) and finishes for release clocks 0.45 to 1.0 of the 1.2 s comet cycle (12 of 24 tried); the comet knocks it back otherwise. v0.4's (3, 150) at 0.55 had 11.5 px. two: (-95, 113) rests on the left wall top at (94.6, 168.0) on most clocks, then (-7, 51).
    name: "Comet Lane", boss: false, stars: { three: 1, two: 3 },
    ball: { x: 260, y: 480 }, hole: { x: 110, y: 110 },
    walls: [{ x: 0, y: 177, w: 115, h: 22 }, { x: 265, y: 177, w: 95, h: 22 }], planets: [{ x: 170, y: 380, r: 44, mass: 1 }], suns: [], blackholes: [], movers: [{ type: "comet", a: { x: 245, y: 235 }, b: { x: 135, y: 235 }, period: 1.2, r: 18 }],
  },
  {
    // Teaches skirting a black hole's pull for a bend: the wall blocks the straight line, so go up through the gap and let the black hole bend the ball round its right side and left into the cup; aim a little closer and it is swallowed. three: drag (40, 128), one shot, passing 64 from the horizon; aim window 12.55 degrees (-6.45 / +6.10), drag 119.6 px to full power. The greedy line (60, 120) is swallowed; the obvious straight shot at the cup (90, 120) hits the wall. two: straight up the right side, e.g. (-5, 70), rests outside the pull at (328.6, 179.6), then (73, 75) sinks over 10.2 degrees and 72.7 to 131.2 px. Sweep: 0 straight sinks.
    // v0.4 (PRD v0.4 A, C): re-authored for the influence ring. v0.3's route sank only from 145.8 px to full power and every soft shot past the wall was swallowed; the black hole sits higher and farther left, the tee is closer to the wall, and the right side above the wall is outside the pull, so a two-stroke fallback rests there.
    name: "Event Horizon", boss: false, stars: { three: 1, two: 3 },
    ball: { x: 310, y: 440 }, hole: { x: 55, y: 100 },
    walls: [{ x: 0, y: 330, w: 245, h: 22 }], planets: [], suns: [], blackholes: [{ x: 100, y: 160 }], movers: [],
  },
  {
    // v0.3 (v11 review): a lip on the door's right edge (150..170, up to y 282) and a fin (188..210, y 150..300) close the right wall top as a staging shelf: the shortcut (76, 124) then (29, 105), which rested on the wall top at (230.9, 291) and sank at every clock, now sinks 0 of 36. Both keep 18 from the comet paths. two (4 strokes): (-128, 57), (20, 128) at clock 1.0 is knocked back onto the planet, (8.8, 71.5) back to the top, (20, 128) at clock 1.4.
    // Teaches finding the gap between two comets: the wall shuts every line from the tee, so land on the planet, wait out the meteors, then fly the door at clock 1.4. three: (-128, 57) lands on the planet at (141.3, 442.3), then (20, 128) released at clock 1.4 (gap 1.20 to 1.58 s; at 1.0 or 1.8 a comet knocks it back), 0 bounces, sinks over 5.95 degrees of aim. Sweep at clocks 0, 0.5, 1.0, 1.4, 2.4: 0 straight sinks, 0 one-shot sinks of any kind from the tee.
    name: "Meteor Shower", boss: false, stars: { three: 2, two: 4 },
    ball: { x: 300, y: 585 }, hole: { x: 75, y: 120 },
    walls: [{ x: 0, y: 300, w: 85, h: 22 }, { x: 150, y: 300, w: 210, h: 22 }, { x: 150, y: 282, w: 20, h: 18 }, { x: 188, y: 150, w: 22, h: 150 }], planets: [{ x: 110, y: 480, r: 40, mass: 1 }], suns: [], blackholes: [], movers: [{ type: "comet", a: { x: 55, y: 250 }, b: { x: 155, y: 250 }, period: 1, r: 14 }, { type: "comet", a: { x: 155, y: 195 }, b: { x: 55, y: 195 }, period: 1.4, r: 14 }],
  },
  {
    // Teaches a slingshot through a black hole's pull: the wall and the pull shut every line from the tee and the sun sits on the lazy tee-to-cup line, so land on the planet, then whip round the black hole's left side and up into the cup. three: (68, -15) lands on the planet at (139.9, 452.0), then (95, 86) passes the horizon at 37.6 units and sinks with 0 bounces; aim window 14.8 degrees (-4.25 / +10.55), drag 117.6 px to full power. Lazy line (85, 123) hits the sun (+1). two: (68, -15), (0, -30) shuffles to (120.4, 451.9), (95, 86) sinks. Sweep: 0 straight sinks.
    // v0.4 (PRD v0.4 A, C): under the influence ring the v0.3 whip ((-49, 142) to a cup at (60, 110), outside the ring) sank only from 145.5 px to full power; the cup moves down to (80, 220), inside the ring, and the whip is re-authored. A one-shot double whip past the planet and the black hole exists from the tee (a 3.5 degree cluster at full power, around (111.5, 100.4)); it stays as an expert find.
    // v0.5 (PRD v0.5 B): the sun moves to (225, 405), r 26, still on the lazy tee-to-cup line, where a ball resting on it can still shoot free (the escape rule now covers suns); (68, -15) lands at (92.4, 468.6), then (85, 106) whips round the black hole: 15.9 degrees and 123.9 px to full power (neighbours at least 15.3 degrees and 25.8 px); noisy human 96.5 percent. two: (68, -15), (0, -20), (85, 106).
    // v18 (sun reach): the v0.4 route holds again: (68, -15) lands at (139.9, 452.0), then (95, 86) whips round the black hole: 14.8 degrees and 32.4 px (neighbours at least 13.6 degrees and 32.3 px); noisy human 100 percent, the whole route with every shot noisy 77 percent. Soft tee misses touching the sun 10.8 percent (v15 11.4). two: (68, -15), (0, -30), (95, 86).
    name: "Singularity", boss: false, stars: { three: 2, two: 4 },
    ball: { x: 330, y: 580 }, hole: { x: 80, y: 220 },
    walls: [{ x: 215, y: 300, w: 145, h: 22 }], planets: [{ x: 130, y: 500, r: 40, mass: 1 }], suns: [{ x: 225, y: 405, r: 26 }], blackholes: [{ x: 120, y: 350 }], movers: [],
  },
  {
    // Boss: land on the planet, time the moon to get through the door, then time the comet to cross the top lane past the black hole into the cup. three: (10, 53) lands on the planet's upper left at (114.7, 407.7); (-112, 100) at clock 0.8 (full power; the route still finishes for release clocks 0.1 to 1.8 of the 3.2 s moon cycle, 18 of 32 tried; otherwise the moon turns it away) rests at (327.3, 175.1); (-84, 68) at clock 0.5 (finishes for clocks 0.35 to 0.75 of the 1.2 s comet cycle, 9 of 24 tried; otherwise the comet knocks it away) banks off the right wall, crosses the top lane over the pillar, bounces off the ceiling and drops through the black hole's ring into the cup; aim window 7.0 degrees (-2.50 / +4.50), drag 100.1 px to full power. Sweep: 0 straight sinks. Lesson not carried: the straight line at the cup is walled, not swallowed.
    // v0.4 (PRD v0.4 A, C): under the influence ring every shot of the v0.3 route changed (its black hole pulled across the whole field); the pillar top drops from y 90 to 120 (a wider top lane) and the comet now falls through the lane at x 200 (from y -20 to 110, r 18, 1.2 s) instead of running along the ceiling, so the last shot has a wide window at the right clock and misses on the rest. The black hole moves down from y 190 to 215, over the gap at the left end of the long wall: a timed two-stroke shortcut up that gap, whipped round the black hole into the cup (a 4 degree untimed second shot), is now swallowed.
    // v0.5 (v17): no first shot lands on the planet at every clock (the moon orbits it), so the first shot is timed as on hole 10, the most forgiving one found: (13, 74) at clock 2.9 lands on the planet and the route finishes for release clocks 2.0 to 0.5 through the loop (1.8 s of the 3.2 s moon cycle, 18 of 32 tried); then (-112, 100) at clock 1.5 (clocks 0.6 to 2.4, 1.9 s of 3.2 s, 19 of 32) and (-84, 68) at clock 0.5 (clocks 0.25 to 0.7, 0.5 s of the 1.2 s comet cycle, 10 of 24). Level data unchanged.
    name: "Collapse", boss: true, stars: { three: 3, two: 5 },
    ball: { x: 40, y: 610 }, hole: { x: 80, y: 100 },
    walls: [{ x: 30, y: 250, w: 242, h: 22 }, { x: 250, y: 120, w: 22, h: 130 }, { x: 245, y: 390, w: 115, h: 22 }], planets: [{ x: 130, y: 450, r: 36, mass: 0.8 }], suns: [], blackholes: [{ x: 28, y: 215 }], movers: [{ type: "moon", parent: 0, orbitR: 74, period: 3.2, r: 13, mass: 0.45, phase: 0 }, { type: "comet", a: { x: 200, y: -20 }, b: { x: 200, y: 110 }, period: 1.2, r: 18 }],
  },
  {
    // Tests timing a shot past the moon: a wall row shuts every line to the cup, so the first shot has to go up through its gap and land on the upper-left planet, and the moon (r 16, mass 0.5, 4 s cycle) crosses that lane, spoiling the shot on 56 percent of the release clocks. three: drag (-49, 121) released at clock 2.3 (lands at (47.5, 248.4); works for release clocks about 1.6 to 3.0 of the 4 s cycle), then (-94, -105) at any clock: 10.25 degrees of aim and 120.9 px to full power (neighbours at least 10.1 degrees and 28.8 px); noisy human 100 percent on the last shot, 72.5 percent on the whole route. two (3 strokes): (-49, 121) at 2.3, a nudge (-20, 0) along the planet, then (-94, -105). Sweep at clocks 0 and 2.3: 0 straight sinks; at 2.3 an expert one-stroke full-power bank near (-57, 139) sinks over 2 degrees. --two-shot prints a NOTE with 0 fully untimed routes: the only other 2-stroke routes start with a first shot that lands on the wall top and needs 1 or 2 of 8 release clocks, so they are timed too. The gap's left edge is at 160 (146 let a 2-degree full-power drag from the floor corner sink untimed).
    // v0.5 D (hole 16, content shard on Sonnet, proven with tools/sim-golf.mjs: --three, --windows, --sweep, --escape, --two-shot, noisy human).
    name: "Moonrise", boss: false, stars: {three: 2, two: 3},
    ball: {x: 41, y: 600}, hole: {x: 233, y: 129},
    walls: [{x: 0, y: 310, w: 160, h: 22}, {x: 236, y: 310, w: 124, h: 22}], planets: [{x: 205, y: 460, r: 35, mass: 1}, {x: 76, y: 211, r: 38, mass: 0.9}, {x: 305, y: 554, r: 26, mass: 0}], suns: [], blackholes: [], movers: [{type: "moon", parent: 0, orbitR: 76, period: 4, r: 16, mass: 0.5, phase: 2.356194490192345}],
  },
  {
    // Tests threading the calm lane between two black holes' influence rings, with a planet as the staging post: the wall under the right black hole stops the straight line at the cup, so land on the planet, then fly the diagonal between the rings. three: drag (45, 33) rests on the planet's top at (118.6, 463.8) (any soft tap at the planet lands on it), then (-52, 130) passes the two horizons at 104.8 and 127.2 and sinks with 0 bounces: 17.45 degrees of aim and 121 px to full power (neighbours at least 17.1 degrees and 28.4 px); about 6 degrees to the left or 11 to the right of it is out of the lane, and 16 to the left or 20 to the right is swallowed. Noisy human 100 percent on the last shot, 98.5 percent on the whole route. The obvious straight shot at the cup, (28, 117), hits the wall and rests at (156.5, 503), not swallowed. Sweep: 0 straight sinks, 0 one-shot sinks of any kind. two (3 strokes): (45, 33), a nudge (20, 0), then (-52, 130).
    // v0.5 D (hole 17, content shard on Sonnet, proven with tools/sim-golf.mjs: --three, --windows, --sweep, --escape, --two-shot, noisy human).
    name: "Twin Wells", boss: false, stars: {three: 2, two: 3},
    ball: {x: 320, y: 600}, hole: {x: 200, y: 100},
    walls: [{x: 200, y: 450, w: 160, h: 22}], planets: [{x: 110, y: 510, r: 38, mass: 1}, {x: 90, y: 170, r: 30, mass: 0.7}], suns: [], blackholes: [{x: 45, y: 300, reach: 90}, {x: 315, y: 390, reach: 90}], movers: [],
  },
  {
    // Tests skimming a heavy sun's reach without touching it: the sun (mass 1.6, r 24, reach 75) bends a fast ball that passes within about 55 of its surface, a pass closer than about 9 touches it (+1) and one farther than about 62 is not bent at all. three: drag (27, 35) lands on the big planet's top at (142.6, 432.0), then (-113, 65) skims the sun at 54.6 from the surface, loops round its right side and sinks with 0 bounces: 9.2 degrees of aim and 114.9 px to full power (neighbours at least 9.1 degrees and 34.5 px); it sinks from any rest on the planet between 236 and 304 degrees. Noisy human 100 percent on the last shot, 94.5 percent on the whole route. Soft tee misses touching the sun: 3.6 percent, twice 0.0. Sweep: 0 straight sinks; an expert one-stroke full-power skim (-6.5, 150) sinks over 2.5 degrees. two (3 strokes): (27, 35), a nudge (0, -20), then (-113, 65).
    // v0.5 D (hole 18, content shard on Sonnet, proven with tools/sim-golf.mjs: --three, --windows, --sweep, --escape, --two-shot, noisy human).
    name: "Perihelion", boss: false, stars: {three: 2, two: 3},
    ball: {x: 40, y: 590}, hole: {x: 220, y: 153},
    walls: [], planets: [{x: 132, y: 486, r: 46, mass: 1}, {x: 87, y: 161, r: 32, mass: 0.9}, {x: 300, y: 470, r: 30, mass: 0}], suns: [{x: 165, y: 327, r: 24, mass: 1.6, reach: 75}], blackholes: [], movers: [],
  },
  {
    // Tests timing two movers at once: the wall row shuts every line to the cup, a sliding door (2.4 s) closes its gap, and two comets (r 18) cross the lane, one under the row every 1.2 s and one above it every 2.4 s, so only a short stretch of the cycle has door open and both comets clear. three: drag (-23, 11) rolls onto the big planet's left side at (206.0, 491.1), then (23, 128) released at clock 1.15 (works for release clocks 0.90 to 1.40 of the 2.4 s cycle, 0.5 s; the door or a comet stops it otherwise): 12.1 degrees of aim and 112.5 px to full power (neighbours at least 11.75 degrees and 37.0 px); noisy human 100 percent on the last shot and on the whole route. Sweep at clocks 0 and 1.15: 0 straight sinks. two (3 strokes): (-23, 11), a nudge (-15, 0) along the planet, then (23, 128) at 1.15. --two-shot prints a NOTE with 0 fully untimed routes: the only 2-stroke alternatives start with a first shot that lands on the wall top and needs about one of eight release clocks, so they are timed too. Two comets and a door, not three comets.
    // v0.5 D (hole 19, content shard on Sonnet, proven with tools/sim-golf.mjs: --three, --windows, --sweep, --escape, --two-shot, noisy human).
    name: "Crossfire", boss: false, stars: {three: 2, two: 3},
    ball: {x: 40, y: 590}, hole: {x: 195, y: 115},
    walls: [{x: 0, y: 300, w: 150, h: 22}, {x: 237, y: 300, w: 123, h: 22}], planets: [{x: 255, y: 490, r: 40, mass: 1}, {x: 78, y: 123, r: 30, mass: 0.7}, {x: 52, y: 509, r: 30, mass: 0}], suns: [], blackholes: [], movers: [{type: "slide", w: 123, h: 22, a: {x: 132, y: 300}, b: {x: 9, y: 300}, period: 2.4}, {type: "comet", a: {x: 380, y: 391}, b: {x: -20, y: 391}, period: 1.2, r: 18}, {type: "comet", a: {x: -20, y: 210}, b: {x: 380, y: 210}, period: 2.4, r: 18}],
  },
  {
    // Tests everything so far (boss, sector 4): the moon, a chute, the whale planet, the black hole and the sun in one three-shot route, each shot using a different body. three: (87, 39) at clock 3 runs low under the ceiling, swings under the small planet and up its left side onto its top at (87.0, 513.1) while the moon is clear (release clocks 1.9 to 4.4 of the 4.5 s moon cycle, 47 of 72 tried; too early and the moon catches the ball and it rides); (8, 110) at clock 1 goes straight up the chute and the whale planet (mass 1.2) curls it onto its top at (223.5, 239.7) (clocks 0 to 2.6 and 3.6 up; otherwise the moon is over the launch point; softer falls back, harder is swallowed); (99, 77) at any clock hooks wide left of the cup and the black hole bends it in: 17.25 degrees and 36.6 px to full power (neighbours at least 7.65 degrees and 29.0 px). Aimed straight at the cup it is swallowed, and a flat hook touches the sun, which guards the outside of the bend. The chute only admits a near-vertical launch from the small planet's top and the low ceiling keeps fast tee shots off the planet's upper side, so no tee shot reaches the whale planet: --two-shot finds no untimed two-shot route. Sweep at clocks 0, 1 and 3: 0 straight sinks, 0 one-shot sinks. Noisy human: last shot 95.5 percent, whole route 67.5 percent. The tee cannot reach the sun (soft tee misses touching it: 0). two: (87, 39) at clock 1 rides the moon, (20, 0) at clock 1.5 hops onto the small planet's top, then (8, 110) at clock 1 and (99, 77).
    // v0.5 D (hole 20, content shard on Opus, proven with tools/sim-golf.mjs: --three, --windows, --sweep, --escape, --two-shot, noisy human).
    name: "Leviathan", boss: true, stars: {three: 3, two: 4},
    ball: {x: 310, y: 610}, hole: {x: 123, y: 74},
    walls: [{x: 0, y: 400, w: 65, h: 22}, {x: 115, y: 400, w: 93, h: 22}, {x: 43, y: 338, w: 22, h: 62}, {x: 115, y: 338, w: 22, h: 62}, {x: 186, y: 422, w: 22, h: 133}, {x: 186, y: 555, w: 174, h: 22}], planets: [{x: 90, y: 550, r: 28, mass: 1}, {x: 200, y: 278, r: 36, mass: 1.2}], suns: [{x: 60, y: 230, r: 18}], blackholes: [{x: 184, y: 125}], movers: [{type: "moon", parent: 0, orbitR: 58, period: 4.5, r: 10, mass: 0.25, phase: 0}],
  },
  {
    // Tests chaining two sun whips: a soft first shot lands on the planet, then one shot passes between the binary pair and each sun bends it toward the cup. v0.5 heavy suns: suns 0.8 and 0.9 against a planet of 0.5 (hole-21-light.json kept suns 0.56 and 0.67 against a planet of 1.0). three: drag (27, 24) rests on the planet's upper right at (152.9, 473.6), then (-53, 97), passing the suns at 34.9 and 29.0 from their surfaces; sinks over 8.65 degrees of aim and 94 to 133 px (neighbours at least 8.35 degrees and 38 px); noisy human 94.5 percent on the last shot, 81 percent on the whole route. two: (27, 24), (0, 20), (-53, 97). Sweep: 0 straight sinks; a shelf wall under the tee lane closes the one-shot double whip (1 sink of 20160). Soft tee misses touching a sun: 0.0 and 0.1 percent, never twice. At suns 1.2 and 1.2 the best second shot has 7.3 degrees and 16 px (under the rule). Reworked after the sequence review so both suns outweigh the planet (designer's rule, PRD v0.5 B); heavier pairs (1.0 to 1.3) found no clean window.
    // v0.5 D (hole 21, content shard on Sonnet, proven with tools/sim-golf.mjs: --three, --windows, --sweep, --escape, --two-shot, noisy human).
    name: "Daybreak", boss: false, stars: {three: 2, two: 3},
    ball: {x: 300, y: 600}, hole: {x: 265, y: 259},
    walls: [{x: 215, y: 470, w: 145, h: 22}, {x: 200, y: 170, w: 160, h: 22}], planets: [{x: 110, y: 450, r: 40, mass: 0.5}], suns: [{x: 169, y: 313, r: 20, reach: 46, mass: 0.8}, {x: 251, y: 381, r: 21, reach: 56, mass: 0.9}], blackholes: [], movers: [],
  },
  {
    // Tests reading a crossing pattern and picking a release clock: three comets on different paths and periods (2.8, 1.4 and 1.8 s) cross the lane from the planet to the cup, so wait for the gap. three: (-40, 0) rests on the planet's west side at (236.0, 540.0), then (9, 130) released at clock 2.85 (sinks for clocks 2.40 to 3.30 of the 2.8 s comet cycle, 21 of 69 tried; the comets knock it back otherwise); sinks over 11.05 degrees of aim and 119.3 to 146.3 px at that clock (neighbours at least 10.95 degrees and 26 px); noisy human 99 percent on the last shot, 87.5 percent on the whole route. two: (-40, 0), (0, 20), (9, 130) at clock 2.85. Sweep at clocks 0, 1.0 and 2.85: 0 straight sinks. Two walls close the diagonal lanes from the tee; the --two-shot NOTE (untimed routes) is only narrow 4 degree full-power finds from the planet's right side. --two-shot NOTE: narrow untimed two-stroke finds near full power (about 4 degrees) also make three; kept as expert finds, as on hole 9.
    // v0.5 D (hole 22, content shard on Sonnet, proven with tools/sim-golf.mjs: --three, --windows, --sweep, --escape, --two-shot, noisy human).
    name: "Leonids", boss: false, stars: {three: 2, two: 3},
    ball: {x: 50, y: 540}, hole: {x: 295, y: 200},
    walls: [{x: 0, y: 290, w: 235, h: 22}, {x: 30, y: 360, w: 185, h: 22}], planets: [{x: 285, y: 540, r: 40, mass: 1}], suns: [], blackholes: [], movers: [{type: "comet", a: {x: 163, y: 464}, b: {x: 304, y: 375}, period: 2.8, r: 15}, {type: "comet", a: {x: 374, y: 405}, b: {x: 185, y: 434}, period: 1.4, r: 15}, {type: "comet", a: {x: 193, y: 189}, b: {x: 375, y: 337}, period: 1.8, r: 16}],
  },
  {
    // Tests a slingshot that uses the moon's pull past two black-hole rings: the moon's planet and its moon bend a long shot up the left lane while the two black holes frame the field and swallow a loose shot. three: (-35, 0) rests on the first planet's top left at (179.3, 522.3), then (32, 128) released at clock 1.85 (sinks for clocks 1.55 to 2.35 of the 3.6 s moon cycle, 17 of 73 tried), passing the moon's planet at 24.1 and the moon at 55.9, black hole 0 at 84.8 from its horizon (inside its fade ring) and black hole 1 at 157.9 (outside it); sinks over 7.3 degrees of aim and 121.9 to 144.9 px (neighbours at least 7.25 degrees and 22.5 px); noisy human 89.5 percent on the last shot, 87.5 percent on the whole route (a miss is swallowed 4.5 percent of the time). two: (-35, 0), (0, 20), (32, 128) at clock 1.85. Sweep at clocks 0, 0.9 and 1.85: 0 straight sinks. Straight shots at the cup: (-57, 82) and (-45, 65) rest, (-68, 99) bounces off the moon and is swallowed. The --two-shot NOTE (untimed routes) is only near-full-power finds (141 to 147 px) from the planet's right side, which sink on 6 to 8 of 8 clocks over 6 to 10 degrees; they stay as expert finds because the lesson here is the pull, not the clock. --two-shot NOTE: near-full-power (141 to 147 px) untimed two-stroke shots from the planet's right side also make three; kept as expert finds.
    // v0.5 D (hole 23, content shard on Sonnet, proven with tools/sim-golf.mjs: --three, --windows, --sweep, --escape, --two-shot, noisy human).
    name: "Dark Twins", boss: false, stars: {three: 2, two: 3},
    ball: {x: 60, y: 560}, hole: {x: 294, y: 221},
    walls: [], planets: [{x: 200, y: 560, r: 34, mass: 1}, {x: 204, y: 321, r: 34, mass: 0.37}], suns: [], blackholes: [{x: 40, y: 390, reach: 70}, {x: 345, y: 420, reach: 85}], movers: [{type: "moon", parent: 1, orbitR: 70, period: 3.6, r: 14, mass: 0.5, phase: 0.78}],
  },
  {
    // Tests everything, the pre-final (not a boss): a rotating bar guards the lane to the first planet, then one shot threads a heavy sun whip past a second planet and its moon into the cup. v0.5 heavy sun: sun 1.2 against planets of 0.5 and 0.39 (hole-24-light.json kept sun 0.7 against a planet of 1.0). three: (-40, 0) released at clock 2.1 passes the bar and rests on the first planet's top right at (247.4, 484.3) (the bar lets it through for release clocks 1.8 to 2.95 of its 2.62 s half-turn cycle, 55 of 105 tried), then (33, 118) at clock 1.6; sinks over 11.25 degrees of aim and 109.5 to 140.5 px (neighbours at least 11.2 degrees and 30 px); noisy human 99.5 percent on the last shot and on the whole route. two: (-40, 0) at 2.1, (0, 20), (33, 118) at 1.6. Sweep at clocks 0, 1.0 and 2.1: 0 straight sinks (a wall under the sun's left side closes the tee-side lens; at most 15 one-shot sinks of 20160, none wider than 1 degree). Soft tee misses touching the sun: 0.1 percent. Weak spot: the timing is mild and the --two-shot NOTE stays (untimed routes from the planet's top, reached by soft taps that skirt the bar). Reworked after the sequence review: the sun (1.2) now outweighs both planets. --two-shot NOTE: 10 to 14 degree untimed routes from the planet's top also make three; kept.
    // v0.5 D (hole 24, content shard on Sonnet, proven with tools/sim-golf.mjs: --three, --windows, --sweep, --escape, --two-shot, noisy human).
    name: "Zenith", boss: false, stars: {three: 2, two: 3},
    ball: {x: 40, y: 520}, hole: {x: 145, y: 242},
    walls: [{x: 0, y: 430, w: 135, h: 22}], planets: [{x: 220, y: 520, r: 36, mass: 0.5}, {x: 265, y: 324, r: 30, mass: 0.39}], suns: [{x: 142, y: 338, r: 22, reach: 63, mass: 1.2}], blackholes: [], movers: [{type: "moon", parent: 1, orbitR: 64, period: 3.4, r: 12, mass: 0.44, phase: 1.88}, {type: "bar", x: 110, y: 523, len: 75, phase: 1.9}],
  },
  {
    // Tests everything (sector 5 finale): time a comet, land twice, then the binary whip. The twin suns are heavy and wide (mass 1.2, reach 40): heavier than every planet here, lighter than the black hole (1.4). three: (0, 150) runs up the sealed right channel, over the roof, and lands on the top-left planet at (97.7, 110.0) at any release clock; (9.5, -135.7) released at clock 0.9 drops down the left side under the comet lane onto the lower planet at (111.1, 406.1) (finishes on 16 of 24 clocks of the 1.2 s comet cycle: 0.70 to 0.20 through the wrap, and 0.35; otherwise the comet knocks it away); then (-56.1, 126.1) at any clock is the binary whip: it threads the pair inside both coronas (24.1 and 23.7 from the surfaces), curves right, kisses the right wall and drops into the cup: 9.25 degrees and 19.0 px (131 px to full power), neighbours at least 8.35 degrees and 18.0 px. The black hole (reach 60) sits under the pair: a shot from the lower planet that runs under the suns, e.g. (-118, -21), is swallowed. The moon circles a slate bumper below the pair. The stub under the roof's left end shuts the lane from the top planet into the cup. Noisy human: last shot 81.5 percent, whole route 48.5 percent. Soft tee misses touch neither sun (the tee is sealed in the channel). Sweep at clocks 0 and 0.9: 0 straight sinks. two: (0, 150), (9.5, -135.7) at 0.9, (-18, 18) resettles at (108.7, 403.1), (-56.1, 126.1).
    // v0.5 D (hole 25, content shard on Opus, proven with tools/sim-golf.mjs: --three, --windows, --sweep, --escape, --two-shot, noisy human).
    name: "Twin Dawn", boss: true, stars: {three: 3, two: 4},
    ball: {x: 341, y: 605}, hole: {x: 270, y: 230},
    walls: [{x: 300, y: 150, w: 22, h: 490}, {x: 150, y: 150, w: 150, h: 22}, {x: 150, y: 172, w: 22, h: 90}], planets: [{x: 84, y: 425, r: 24, mass: 0.6}, {x: 60, y: 100, r: 30, mass: 1}, {x: 140, y: 550, r: 26, mass: 0}], suns: [{x: 177, y: 374, r: 22, mass: 1.2, reach: 40}, {x: 236, y: 310, r: 22, mass: 1.2, reach: 40}], blackholes: [{x: 260, y: 470, reach: 60}], movers: [{type: "comet", a: {x: -20, y: 250}, b: {x: 110, y: 250}, period: 1.2, r: 12}, {type: "moon", parent: 2, orbitR: 56, period: 4.8, r: 10, mass: 0.25, phase: 0}],
  },
  {
    // Tests the balance between two pulls (sector 6 opener): two planets of similar pull (mass 1.0 and 0.9, 236 apart) cancel along the line between them, so a ball flies calm up the gap and bends only toward the nearer one. v0.10 tightening: the cup moved from (270, 170) up to (260, 140); the old cup let a full-power shot sink over 13.5 degrees (noisy human 100 percent). three: drag (-11.9, 129.5), one shot, 0 bounces: runs up the gap (planet 0 passed at 103 from its surface, planet 1 at 63) and planet 1 swings it into the cup; sinks over 5.15 degrees of aim (-2.70 / +2.45) and 123.0 px to full power (neighbours at least 4.80 degrees and 25.9 px); noisy human 68 percent. It turns -18.2 and 33.8 degrees, so it is a Dark Matter route; full power along the same lane is wider (7.0 degrees at 145 px, the widest any-bounce cluster). Sweep: 0 straight sinks. Escape: 0 timeouts. two (2 strokes): (-30, 60) rests on planet 1's upper left at (263.5, 357.9), then (-35, 115). Badge find, not the route (PRD v0.7 C Lagrange Point, unchanged by the cup move): a soft pull straight down, drag (-1, 29) (28 to 30 px all work), floats up and settles at (182.7, 381.7) with 0 bounces, 83 from both surfaces; the pulls there are 309 and 305, each over 4 times the 64 rest threshold, 180 degrees apart, net under 64. The three route earns no Great Attractor, Lagrange Point or speed badge (top speed 711).
    // v0.8 A (hole 26, content shard on Sonnet, proven with tools/sim-golf.mjs: --three, --windows, --sweep, --escape, --two-shot at merge, noisy human).
    name: "Fulcrum", boss: false, stars: {three: 1, two: 2},
    ball: {x: 183, y: 590}, hole: {x: 260, y: 140},
    walls: [], planets: [{x: 62, y: 380, r: 36, mass: 1}, {x: 298, y: 380, r: 32, mass: 0.9}], suns: [], blackholes: [], movers: [],
  },
  {
    // Tests timing a shot through the moon's lane (sector 6): the tee sits on the first planet's top, the stub wall shuts the lane left of the sun, so the one shot goes up between the heavy sun (mass 1.2, reach 60, heavier than every planet and the moon) and the moon planet, where the moon (r 13, mass 0.5, 3.3 s cycle) sweeps across the lane; the sun whips what gets past into the cup behind it. three: drag (-18, 121) released at clock 2.9, one shot, 0 bounces, passing the sun at 16.4 from its surface and the moon at 124. It sinks for release clocks 2.03 to 3.3 and 0 to 0.45 of the 3.3 s cycle (71 of 132 tried, 54 percent, one run of 1.75 s round the wrap); at the other clocks the moon touches the ball (30 percent of clocks) or pulls it off (15 percent), and sinking clocks keep at least 39 from the moon. Sinks over 10.65 degrees of aim (-2.4 / +8.25) and 115.8 to 146.3 px (neighbours at least 10.55 degrees and 28.5 px); noisy human 83.5 percent. Sweep at clocks 0 and 2.9: 0 straight sinks (at 1.2 the route fails, the moon is in the lane; 0 straight sinks there too). Escape: 0 timeouts. two (2 strokes): a nudge (0, 15) rests at (137.5, 500.7), then (-18, 121) at 2.9. Without the stub a left-lane family opens (about 8 degrees, sinking on 50 to 80 percent of clocks), so it stays. Note: at clock 1.2 a narrow 4 degree near-full-power lane around drag (14.5, 144.3) sinks on about 1 clock in 8 (expert find). The three route earns no new v0.7 badge (no Dark Matter: the sun is the only body bending it over 10 degrees; top speed 669).
    // v0.8 A (hole 27, content shard on Sonnet, proven with tools/sim-golf.mjs: --three, --windows, --sweep, --escape, --two-shot at merge, noisy human).
    name: "Penumbra", boss: false, stars: {three: 1, two: 2},
    ball: {x: 136, y: 497}, hole: {x: 125, y: 225},
    walls: [{x: 0, y: 285, w: 95, h: 22}], planets: [{x: 120, y: 540, r: 34, mass: 0.6}, {x: 221, y: 422, r: 30, mass: 0.45}], suns: [{x: 125, y: 330, r: 22, mass: 1.2, reach: 60}], blackholes: [], movers: [{type: "moon", parent: 1, orbitR: 69, period: 3.3, r: 13, mass: 0.5, phase: 0.33}],
  },
  {
    // Tests three bodies bending one shot (sector 6): the lane up the middle is pulled by the left planet, the upper right planet and, more lightly, the lower right one. v0.10 tightening: the left planet moved from (74, 399) to (110, 430), which pulls the lanes together (the old cup let a soft shot sink over 14 degrees, noisy human 97.5 percent); the cup stays at (189, 180). three: drag (-32, 110), one shot, 0 bounces, passing planet 0 at 12.2, planet 1 at 87.0 and planet 2 at 118.8 from the surface; sinks over 4.45 degrees of aim (-1.75 / +2.70) and 99.1 to 133.6 px of drag (neighbours at least 4.35 degrees and 30.0 px). Its pulls turn it -24.9, 30.9 and 7.4 degrees, so the third body stays under bendTurn and the route does not earn Great Attractor (it does bend two bodies without a touch, so it is a Dark Matter route). Great Attractor find: ease off the power to about 103 px, drag (-30, 98.5), turns -31.6, 65.4 and 13.2 degrees, about 4 degrees of aim and 8 px of drag (99 to 107). Noisy human 72 percent on the last shot. Sweep at clock 0: 0 straight sinks; the widest any-bounce cluster (4.5 degrees at 105 px) is this same lane. Escape: 0 timeouts. two (2 strokes): (21, 46) rests on the right of the left planet at (160.6, 436.6), then (-20, 128) sinks over 7.75 degrees at 130 px. Planet 1 and 2's east surface points sit under the border (blocked in --escape, information).
    // v0.8 A (hole 28, content shard on Sonnet, proven with tools/sim-golf.mjs: --three, --windows, --sweep, --escape, --two-shot at merge, noisy human).
    name: "Triad", boss: false, stars: {three: 1, two: 2},
    ball: {x: 137, y: 540}, hole: {x: 189, y: 180},
    walls: [], planets: [{x: 110, y: 430, r: 42, mass: 0.65}, {x: 312, y: 226, r: 35, mass: 1}, {x: 305, y: 534, r: 41, mass: 0.82}], suns: [], blackholes: [], movers: [],
  },
  {
    // Tests reading two slow comets with a black hole behind them: the planet is the staging post, the black hole swallows any soft or wide shot from it, and the comets knock a ball that leaves at the wrong moment into the black hole or away. v0.10 tightening: the release window was 0.20 to 2.04 s of the 2.4 s cycle (77 percent); comet 0 now starts 0.2 s later (r 20) and comet 1 0.1 s earlier (r 20), both shifted along their lines, and the cup moved from (106, 213) to (90, 220), which also narrows the aim window. three: (65, 0) lands on the planet's top at (238.0, 439.0) (any drag from (60, 0) to (70, 2) rests within 6 px of it), then (98, 110) released at clock 1.8: it sinks for release clocks 1.43 to 2.28 of the 2.4 s cycle (32 percent of the clocks, a first-to-last span of 35 percent, the longest unbroken run 0.7 s, 29 percent; otherwise a comet or the black hole takes it). Allowing any aim and power, some shot sinks on 55 percent of clocks (longest run 39 percent). It passes the planet at 14.0 and the black hole at 59.7 from the horizon; sinks over 4.70 degrees of aim (-1.70 / +3.00) and 122.8 px to full power (neighbours at least 4.70 degrees and 25.6 px); noisy human 74.5 percent. Two walls close the untimed routes: a floor under the first comet (x 0 to 125, y 328 to 341) shuts the left strip and the lower left off from the cup lane, so every way up to the cup crosses both comets through the door at x 125 and over, and a fin hanging from the top at x 150 to 172 stops the black hole's right-hand slingshot from entering the cup's side. --two-shot finds no fully untimed route (74 rests; the only untimed second shots start from two rests a first shot reaches on 1 of 8 clocks: the right edge near (351, 371) and the left edge at (16, 177), both timed first shots). Sweep at clocks 0, 1.0, 1.8 and 2.2: 0 straight sinks, 0 any-bounce one-shot sinks of 20160. Escape: 0 timeouts. two (3 strokes): (65, 0), a hop (0, 15) that re-times the clock, then (98, 110) at 1.8.
    // v0.8 A (hole 29, content shard on Sonnet, fix round on Sonnet, proven with tools/sim-golf.mjs: --three, --windows, --sweep, --escape, --two-shot at merge, noisy human).
    name: "Drift Gate", boss: false, stars: {three: 2, two: 3},
    ball: {x: 331, y: 608}, hole: {x: 90, y: 220},
    walls: [{x: 150, y: 0, w: 22, h: 256}, {x: 0, y: 328, w: 125, h: 13}], planets: [{x: 238, y: 481, r: 33, mass: 0.87}], suns: [], blackholes: [{x: 224, y: 296, reach: 115}], movers: [{type: "comet", a: {x: 155, y: 297.2}, b: {x: -13, y: 259.2}, period: 2.4, r: 20}, {type: "comet", a: {x: 123.4, y: 379.9}, b: {x: 277.4, y: 376.9}, period: 2.4, r: 20}],
  },
  {
    // Tests the sector (boss, sector 6): a comet gate, a chute landing, a timed door and the core's pull. Nudge left past the comet onto the low planet, shoot up the chute onto the high planet, then wait for the door in the fin and fire through it; the high planet and the black hole bend it into the cup. three: (39, -22.5) at clock 0.3 crosses the comet lane and lands on the low planet at (82.4, 525.8) (the comet spoils clocks of about 0.75 to 1.1 of its 1.5 s cycle); (-2.7, 78) at any clock rises through the chute and lands under the high planet at (111.1, 323.0); (-87, 38) at clock 1.6 goes through the door gap: it sinks for releases from about 0.9 to 2.45 s of the door's 4 s cycle (40 percent), 19.60 degrees and 29.5 px at 1.6 (84.9 to 114.4 px), neighbours at least 19.05 degrees and 26.5 px. The fin (x 212) runs from y 100 to the floor, close enough to the black hole that nothing passes between, so the cup's pocket opens only through the door gap (y 280 to 340); the door overlaps the fin by 30 when shut and is open under half its cycle at any height, so every shot into the pocket is timed. The pocket floor is raised to y 370 so no ball rests in it. Sun 1.2 (heavier than both planets at 0.5, lighter than the black hole at 1.4) guards the right of the cup; the moon circles a slate bumper top left on the door's 4 s period and only guards overhit shots. No v0.7 badge on the route. Noisy human: last shot 96.0 percent, whole route 29.5 percent. Sweep at clocks 0, 0.3 and 1.6: 0 straight sinks, 0 any-bounce aces. two: (39, -22.5) at 0.3, (-2.7, 78), (0, -20), (-87, 38) at 1.6. Known find: the full-power tee shot (122.7, 32.9) still loops onto the high planet at most clocks, but every second shot from there is timed by the door (a timed two-stroke expert find). Two-shot: 217 tee-reachable rests, 0 with an untimed second shot.
    // v0.8 A (hole 30, content shard on Opus, retry round on Opus, proven with tools/sim-golf.mjs: --three, --windows, --sweep, --escape, --two-shot at merge, noisy human).
    name: "Sagittarius", boss: true, stars: {three: 3, two: 4},
    ball: {x: 205, y: 480}, hole: {x: 269, y: 273},
    walls: [{x: 0, y: 420, w: 30, h: 22}, {x: 110, y: 420, w: 250, h: 22}, {x: 212, y: 100, w: 14, h: 180}, {x: 212, y: 340, w: 14, h: 80}, {x: 226, y: 370, w: 134, h: 50}], planets: [{x: 90, y: 560, r: 26, mass: 0.5}, {x: 110, y: 288, r: 26, mass: 0.5}, {x: 90, y: 110, r: 24, mass: 0}], suns: [{x: 320, y: 340, r: 22, mass: 1.2, reach: 30}], blackholes: [{x: 265, y: 199}], movers: [{type: "comet", a: {x: 150, y: 660}, b: {x: 150, y: 470}, period: 1.5, r: 10}, {type: "moon", parent: 2, orbitR: 52, period: 4, r: 10, mass: 0.3, phase: 0}, {type: "slide", w: 14, h: 100, a: {x: 212, y: 250}, b: {x: 212, y: 340}, period: 4}],
  },
];
// Clamps a hole to the size and mass limits and fills the optional fields; also applied by tools/sim-golf.mjs to a shard's JSON.
function prepareLevel(lv) {
  lv.blackholes = lv.blackholes || [];
  for (const p of lv.planets) p.r = Math.max(p.r, T.planetMinR);
  for (const h of lv.blackholes) { if (h.r === undefined) h.r = T.holeR2; if (h.mass === undefined) h.mass = T.bhMass; }
  for (const m of lv.movers) {
    if (m.type === 'moon') m.mass = Math.min(m.mass, T.moonMassMax);
    else if (m.type === 'comet' && m.r === undefined) m.r = T.cometR;
  }
  return lv;
}
LEVELS.forEach(prepareLevel);

// ---------- Physics (one function drives the flight and the preview) ----------

// Reused scratch objects: callers read them immediately.
const PART = { x: 0, y: 0, w: 0, h: 0, vx: 0, vy: 0 };
const N = { x: 0, y: 0 };
const ACC = { x: 0, y: 0 };

function slideAt(m, clock) {
  const w = (2 * Math.PI) / (m.period || T.moverPeriod), k = 0.5 - 0.5 * Math.cos(w * clock), dk = 0.5 * w * Math.sin(w * clock);
  PART.x = lerp(m.a.x, m.b.x, k); PART.y = lerp(m.a.y, m.b.y, k); PART.w = m.w; PART.h = m.h;
  PART.vx = (m.b.x - m.a.x) * dk; PART.vy = (m.b.y - m.a.y) * dk;
  return PART;
}

// A moon's centre and velocity; its orbit is clockwise on screen.
function moonAt(lv, m, clock) {
  const p = lv.planets[m.parent], w = (2 * Math.PI) / m.period, a = m.phase + w * clock;
  const c = Math.cos(a), s = Math.sin(a);
  PART.x = p.x + c * m.orbitR; PART.y = p.y + s * m.orbitR;
  PART.vx = -s * m.orbitR * w; PART.vy = c * m.orbitR * w;
  return PART;
}

// A comet's centre and velocity: a to b at constant speed once per period, then back at a.
function cometAt(m, clock) {
  const per = m.period || T.moverPeriod, k = (clock % per) / per;
  PART.x = lerp(m.a.x, m.b.x, k); PART.y = lerp(m.a.y, m.b.y, k);
  PART.vx = (m.b.x - m.a.x) / per; PART.vy = (m.b.y - m.a.y) / per; PART.k = k;
  return PART;
}

// Half of the bar as a vector from its pivot.
function barAt(m, clock) {
  const a = m.phase + T.barAngularSpeed * clock;
  PART.x = Math.cos(a) * m.len / 2; PART.y = Math.sin(a) * m.len / 2;
  return PART;
}

// Reflects the ball off a surface with outward normal n moving at (sx, sy). Returns the impact speed along n.
function reflect(b, nx, ny, sx, sy) {
  b.touch = true;
  const rx = b.vx - sx, ry = b.vy - sy, vn = rx * nx + ry * ny;
  if (vn >= 0) return 0;
  b.vx = sx + (rx - 2 * vn * nx) * T.wallBounce;
  b.vy = sy + (ry - 2 * vn * ny) * T.wallBounce;
  b.nx = nx; b.ny = ny;
  return -vn;
}

function hit(b, nx, ny, sx, sy) {
  if (reflect(b, nx, ny, sx, sy) >= T.bounceEventSpeed) b.hits++;
}

// Pushes the ball out of a circle of radius cr; the contact normal goes to N. False when not touching.
function circleOut(b, cx, cy, cr) {
  const dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy), min = T.ballR + cr;
  if (d >= min) return false;
  if (d > 0) { N.x = dx / d; N.y = dy / d; } else { N.x = 0; N.y = -1; }
  b.x = cx + N.x * min; b.y = cy + N.y * min;
  return true;
}

function bounceRect(b, r, sx, sy) {
  const cx = clamp(b.x, r.x, r.x + r.w), cy = clamp(b.y, r.y, r.y + r.h);
  let nx = b.x - cx, ny = b.y - cy;
  const d = Math.hypot(nx, ny);
  if (d >= T.ballR) return;
  if (d > 0) {
    nx /= d; ny /= d;
    b.x = cx + nx * T.ballR; b.y = cy + ny * T.ballR;
  } else {
    // Centre is inside the rectangle: leave by the nearest face.
    const g0 = b.x - r.x, g1 = r.x + r.w - b.x, g2 = b.y - r.y, g3 = r.y + r.h - b.y, g = Math.min(g0, g1, g2, g3);
    nx = g === g0 ? -1 : g === g1 ? 1 : 0;
    ny = nx !== 0 ? 0 : g === g2 ? -1 : 1;
    if (nx < 0) b.x = r.x - T.ballR; else if (nx > 0) b.x = r.x + r.w + T.ballR;
    else if (ny < 0) b.y = r.y - T.ballR; else b.y = r.y + r.h + T.ballR;
  }
  hit(b, nx, ny, sx, sy);
}

// The bar is a capsule: the ball bounces off the nearest point of the segment, which moves with the spin.
function bounceBar(b, m, clock) {
  const u = barAt(m, clock), ux = u.x, uy = u.y;
  const t = clamp(((b.x - m.x) * ux + (b.y - m.y) * uy) / (ux * ux + uy * uy), -1, 1);
  const cx = m.x + ux * t, cy = m.y + uy * t;
  if (!circleOut(b, cx, cy, T.barW / 2)) return;
  hit(b, N.x, N.y, -T.barAngularSpeed * (cy - m.y), T.barAngularSpeed * (cx - m.x));
}

// A comet kicks the ball once per contact: a wallBounce reflection off its surface plus cometPush times its velocity.
// It is solid, so if it is still catching the ball after the kick it pushes it on like a moving wall (PRD v0.3 C3.3): the
// ball leaves at no less than the comet's speed along the contact normal, and the 0.8 kick is all it gets only when its own
// approach is fast enough to separate (about 0.235 of the comet's speed head on). A ball at rest hit square by a 200 u/s comet
// leaves at 234. The kick re-arms once the ball is cometRearm clear of it (or on the next shot).
function bounceComet(b, m, i, clock) {
  const c = cometAt(m, clock), bit = 1 << i;
  if (circleOut(b, c.x, c.y, m.r)) {
    if (!(b.cometIn & bit)) {
      b.cometIn |= bit; b.cometHits++; b.cometLast = i; b.hits++;
      reflect(b, N.x, N.y, 0, 0);
      b.vx += T.cometPush * c.vx; b.vy += T.cometPush * c.vy;
      b.nx = N.x; b.ny = N.y;
    }
    reflect(b, N.x, N.y, c.vx, c.vy);
  } else if (b.cometIn & bit && dist(b.x, b.y, c.x, c.y) > m.r + T.ballR + T.cometRearm) b.cometIn &= ~bit;
}

// How much of a pull reaches distance d: 1 inside the ring R, fading smoothly to 0 at `fade` times R.
function fall(R, fade, d) {
  const R1 = R * fade;
  if (d <= R) return 1;
  if (d >= R1) return 0;
  const u = (R1 - d) / (R1 - R);
  return u * u * (3 - 2 * u);
}
function bhFall(R, d) { return fall(R, T.bhFade, d); }
function bhInfluence(h, x, y) { return bhFall(h.reach || T.bhReach, dist(x, y, h.x, h.y)); }
function sunReach(s) { return s.r + (s.reach || T.sunReach); } // the ring's radius from the sun's centre
function sunMassOf(s) { return s.mass === undefined ? T.sunMass : s.mass; }

// The rest radius: beyond it the pull is under restPull(), so a slow ball can stop; inside it, it crawls in and is swallowed.
// This is the line drawn as the black hole's outer ring (the "you will be pulled in" line).
function bhRestR(h) {
  const R = h.reach || T.bhReach, need = restPull(), gm = T.planetGravity * h.mass;
  if (gm / (R * R) < need) return Math.max(T.bhPullR, Math.sqrt(gm / need));
  let lo = R, hi = R * T.bhFade;
  for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if ((gm / (m * m)) * bhFall(R, m) >= need) lo = m; else hi = m; }
  return lo;
}

// A sun's rest radius: inside it a slow ball is pulled back onto the sun; beyond it, it can stop.
function sunRestR(s) {
  const R = sunReach(s), need = restPull(), gm = T.planetGravity * sunMassOf(s), g = (d) => gm / (Math.max(d, T.sunPullR) ** 2);
  if (g(R) < need) return Math.max(s.r, Math.sqrt(gm / need));
  let lo = R, hi = R * T.sunFade;
  for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (g(m) * fall(R, T.sunFade, m) >= need) lo = m; else hi = m; }
  return lo;
}

function pull(b, x, y, r, mass) {
  const dx = x - b.x, dy = y - b.y, d = Math.hypot(dx, dy) || 1e-6, dd = Math.max(d, r);
  const a = (T.planetGravity * mass) / (dd * dd);
  ACC.x += (dx / d) * a; ACC.y += (dy / d) * a;
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

// True where a moving part will sweep the ball: it must not come to rest there.
function inSweep(lv, b) {
  for (const m of lv.movers) {
    if (m.type === 'bar') {
      if (dist(b.x, b.y, m.x, m.y) < m.len / 2 + T.barW / 2 + T.ballR) return true;
    } else if (m.type === 'moon') {
      const p = lv.planets[m.parent];
      if (Math.abs(dist(b.x, b.y, p.x, p.y) - m.orbitR) < m.r + T.ballR) return true;
    } else if (m.type === 'comet') {
      if (segDist(b.x, b.y, m.a.x, m.a.y, m.b.x, m.b.y) < m.r + T.ballR) return true;
    } else if (b.x > Math.min(m.a.x, m.b.x) - T.ballR && b.x < Math.max(m.a.x, m.b.x) + m.w + T.ballR &&
               b.y > Math.min(m.a.y, m.b.y) - T.ballR && b.y < Math.max(m.a.y, m.b.y) + m.h + T.ballR) return true;
  }
  return false;
}

// A ball resting on a moon rides it: it sits on the surface at a fixed angle from the moon's centre.
function carry(lv, b, clock) {
  if (b.on < 0) return;
  const m = lv.movers[b.on], c = moonAt(lv, m, clock), R = m.r + T.ballR;
  b.x = c.x + Math.cos(b.onA) * R; b.y = c.y + Math.sin(b.onA) * R;
}

function newBall(x, y) {
  return { x, y, vx: 0, vy: 0, hits: 0, sunHits: 0, sunLast: -1, sunIn: 0, cometHits: 0, cometLast: -1, cometIn: 0, bh: -1,
    on: -1, onA: 0, nx: 0, ny: -1, touch: false, land: false, moon: -1 };
}

function restPull() { return T.stopSpeed * -Math.log(T.friction); }

// Advances the ball one fixed step. Returns null while it is still rolling, otherwise 'sink' | 'rest' | 'swallow'.
// `clock` is the hole clock in seconds at the end of the step.
function stepBall(lv, b, clock) {
  b.touch = false; b.land = false; b.moon = -1;
  ACC.x = 0; ACC.y = 0;
  for (const p of lv.planets) if (p.mass > 0) pull(b, p.x, p.y, p.r, p.mass);
  for (const s of lv.suns) { const k = fall(sunReach(s), T.sunFade, dist(b.x, b.y, s.x, s.y)); if (k > 0) pull(b, s.x, s.y, T.sunPullR, sunMassOf(s) * k); }
  for (const m of lv.movers) if (m.type === 'moon') { const c = moonAt(lv, m, clock); pull(b, c.x, c.y, m.r, m.mass); }
  for (const h of lv.blackholes) { const k = bhInfluence(h, b.x, b.y); if (k > 0) pull(b, h.x, h.y, T.bhPullR, h.mass * k); }
  const gx = ACC.x, gy = ACC.y;
  b.vx += gx * STEP; b.vy += gy * STEP;
  const hx = lv.hole.x - b.x, hy = lv.hole.y - b.y, hd = Math.hypot(hx, hy);
  if (hd < T.captureR && hd > 0) { // the cup pulls a slow ball in like a real cup
    b.vx += (hx / hd) * T.captureStrength * STEP;
    b.vy += (hy / hd) * T.captureStrength * STEP;
  }
  // Friction is read from TUNING every step so the tune panel applies on the next shot.
  const fric = Math.pow(T.friction, STEP);
  b.vx *= fric; b.vy *= fric;
  const sp = Math.hypot(b.vx, b.vy);
  if (sp > T.speedMax) { b.vx *= T.speedMax / sp; b.vy *= T.speedMax / sp; }
  b.x += b.vx * STEP; b.y += b.vy * STEP;

  // At speedMax the ball moves under 12 units a step, less than any surface is deep, so it cannot skip one.
  for (const r of lv.walls) bounceRect(b, r, 0, 0);
  for (let i = 0; i < lv.movers.length; i++) {
    const m = lv.movers[i];
    if (m.type === 'slide') { const r = slideAt(m, clock); bounceRect(b, r, r.vx, r.vy); }
    else if (m.type === 'bar') bounceBar(b, m, clock);
    else if (m.type === 'comet') bounceComet(b, m, i, clock);
    else {
      const c = moonAt(lv, m, clock);
      if (circleOut(b, c.x, c.y, m.r)) { hit(b, N.x, N.y, c.vx, c.vy); b.moon = i; b.mvx = c.vx; b.mvy = c.vy; }
    }
  }
  for (const p of lv.planets) if (circleOut(b, p.x, p.y, p.r)) { hit(b, N.x, N.y, 0, 0); b.land = true; }
  for (let i = 0; i < lv.suns.length; i++) {
    const s = lv.suns[i], bit = 1 << i;
    if (circleOut(b, s.x, s.y, s.r)) {
      reflect(b, N.x, N.y, 0, 0);
      if (!(b.sunIn & bit)) { b.sunIn |= bit; b.sunHits++; b.sunLast = i; }
    } else if (b.sunIn & bit && dist(b.x, b.y, s.x, s.y) > s.r + T.ballR + T.sunRearm) b.sunIn &= ~bit;
  }

  // Every hole is walled on all four edges of the design space.
  if (b.x < T.ballR) { b.x = T.ballR; hit(b, 1, 0, 0, 0); }
  else if (b.x > T.designW - T.ballR) { b.x = T.designW - T.ballR; hit(b, -1, 0, 0, 0); }
  if (b.y < T.ballR) { b.y = T.ballR; hit(b, 0, 1, 0, 0); }
  else if (b.y > T.designH - T.ballR) { b.y = T.designH - T.ballR; hit(b, 0, -1, 0, 0); }

  for (let i = 0; i < lv.blackholes.length; i++) {
    const h = lv.blackholes[i];
    if (dist(b.x, b.y, h.x, h.y) < h.r) { b.bh = i; return 'swallow'; }
  }
  const speed = Math.hypot(b.vx, b.vy);
  if (speed < T.sinkSpeed && dist(b.x, b.y, lv.hole.x, lv.hole.y) < T.holeR) return 'sink';
  if (hd < T.captureR) return null; // inside the cup's pull the ball always runs on and drops
  if (b.moon >= 0 && Math.hypot(b.vx - b.mvx, b.vy - b.mvy) < T.landSpeed) {
    const c = moonAt(lv, lv.movers[b.moon], clock);
    b.on = b.moon; b.onA = Math.atan2(b.y - c.y, b.x - c.x);
    return 'rest';
  }
  if (inSweep(lv, b)) return null;
  if (b.land && speed < T.landSpeed) return 'rest';
  // Pressed against a wall, or where the pull could not roll it faster than stopSpeed against friction, a slow ball
  // rests; so it never freezes at the top of an arc near a planet.
  if (speed < T.stopSpeed && (b.touch || Math.hypot(gx, gy) < restPull())) return 'rest';
  return null;
}

// ---------- Flight watch (PRD v0.7 C) ----------
// What a flight did, for the exotic badges: its top speed, the net turn each gravity body's pull alone gave the heading, and whether
// it touched anything. watchPre runs just before a step and watchPost just after; neither writes to the ball or to the physics scratch,
// so a flight is bit-for-bit the same with or without them. The preview and the harness's own shots never call them.
const FW = { n: 0, turn: [], top: 0, touched: false, got: 0 }; // got: the in-flight badges already fired on this flight
const PUL = new Float64Array(64);
let PK = 0;
function put(b, x, y, r, mass) {
  const dx = x - b.x, dy = y - b.y, d = Math.hypot(dx, dy) || 1e-6, dd = Math.max(d, r), a = (T.planetGravity * mass) / (dd * dd);
  PUL[2 * PK] = (dx / d) * a; PUL[2 * PK + 1] = (dy / d) * a; PK++;
}
// Each gravity body's pull on the ball into PUL (ax, ay per slot), in a fixed order: planets with mass, suns, moons, black holes (the
// same laws as stepBall). Returns the slot count; a sun out of reach holds a zero slot.
function pulls(lv, b, clock) {
  PK = 0;
  for (const p of lv.planets) if (p.mass > 0) put(b, p.x, p.y, p.r, p.mass);
  for (const s of lv.suns) if (sunMassOf(s) > 0) put(b, s.x, s.y, T.sunPullR, sunMassOf(s) * fall(sunReach(s), T.sunFade, dist(b.x, b.y, s.x, s.y)));
  for (const m of lv.movers) if (m.type === 'moon') { const c = moonAt(lv, m, clock); put(b, c.x, c.y, m.r, m.mass); }
  for (const h of lv.blackholes) if (h.mass > 0) put(b, h.x, h.y, T.bhPullR, h.mass * bhInfluence(h, b.x, b.y));
  return PK;
}
function watchStart(lv, b) {
  FW.n = pulls(lv, b, 0); FW.turn.length = FW.n; FW.turn.fill(0);
  FW.top = 0; FW.touched = false; FW.got = 0;
}
// `clock` is the value the coming stepBall gets. Heading change from a pull a is (v x a) dt / |v|^2.
function watchPre(lv, b, clock) {
  const s2 = b.vx * b.vx + b.vy * b.vy, sp = Math.sqrt(s2);
  if (sp > FW.top) FW.top = sp;
  if (s2 < 1) return;
  const n = pulls(lv, b, clock), k = STEP / s2;
  for (let i = 0; i < n; i++) FW.turn[i] += (b.vx * PUL[2 * i + 1] - b.vy * PUL[2 * i]) * k;
}
function watchPost(b) { if (b.touch) FW.touched = true; }
// How many gravity bodies bent the flight by at least bendTurn degrees.
function bent() {
  const lim = (T.badges.bendTurn * Math.PI) / 180;
  let n = 0;
  for (let i = 0; i < FW.n; i++) if (Math.abs(FW.turn[i]) >= lim) n++;
  return n;
}
// The sinking shot's flags: Dark Matter (two bodies bent it and nothing was touched), Great Attractor (every body of three or more
// bent it) and Heat Death's slow roll-in.
const SINK = { dark: false, great: false, slow: false };
function sinkFlags(b) {
  const n = bent();
  SINK.dark = !FW.touched && n >= 2;
  SINK.great = FW.n >= 3 && n === FW.n;
  SINK.slow = Math.hypot(b.vx, b.vy) < T.badges.heatSpeed;
  return SINK;
}
// Kessler Cascade: after a step with an impact over bounceEventSpeed, marks the walls (the hole's own, then the four field edges,
// slots lv.walls.length to +3) the ball is now touching. Returns how many walls are still untouched; `seen` is per hole.
function kesslerMark(lv, b, seen) {
  const R = T.ballR + 1e-4, nw = lv.walls.length;
  for (let i = 0; i < nw; i++) {
    const r = lv.walls[i];
    if (!seen[i] && Math.hypot(b.x - clamp(b.x, r.x, r.x + r.w), b.y - clamp(b.y, r.y, r.y + r.h)) <= R) seen[i] = 1;
  }
  if (b.x <= R) seen[nw] = 1;
  if (b.x >= T.designW - R) seen[nw + 1] = 1;
  if (b.y <= R) seen[nw + 2] = 1;
  if (b.y >= T.designH - R) seen[nw + 3] = 1;
  let left = 0;
  for (let i = 0; i < nw + 4; i++) if (!seen[i]) left++;
  return left;
}
// The gap between the ball's edge and the nearest solid surface (walls, field edges, planets, suns, moons).
function surfaceGap(lv, b, clock) {
  let m = Math.min(b.x, b.y, T.designW - b.x, T.designH - b.y);
  for (const r of lv.walls) m = Math.min(m, Math.hypot(b.x - clamp(b.x, r.x, r.x + r.w), b.y - clamp(b.y, r.y, r.y + r.h)));
  for (const p of lv.planets) m = Math.min(m, dist(b.x, b.y, p.x, p.y) - p.r);
  for (const s of lv.suns) m = Math.min(m, dist(b.x, b.y, s.x, s.y) - s.r);
  for (const mv of lv.movers) if (mv.type === 'moon') { const c = moonAt(lv, mv, clock); m = Math.min(m, dist(b.x, b.y, c.x, c.y) - mv.r); }
  return m - T.ballR;
}
// Lagrange Point: a ball at rest in open space (lagrangeClear from every surface) with two bodies each pulling at least lagrangePull
// times restPull(), their pulls at least lagrangeApart degrees apart, and the net pull under restPull(): the pulls cancel.
function lagrangeAt(lv, b, clock) {
  if (surfaceGap(lv, b, clock) < T.badges.lagrangeClear) return false;
  const n = pulls(lv, b, clock), rp = restPull(), need = T.badges.lagrangePull * rp, cos = Math.cos((T.badges.lagrangeApart * Math.PI) / 180);
  let nx = 0, ny = 0;
  for (let i = 0; i < n; i++) { nx += PUL[2 * i]; ny += PUL[2 * i + 1]; }
  if (Math.hypot(nx, ny) >= rp) return false;
  for (let i = 0; i < n; i++) {
    const ai = Math.hypot(PUL[2 * i], PUL[2 * i + 1]);
    if (ai < need) continue;
    for (let j = i + 1; j < n; j++) {
      const aj = Math.hypot(PUL[2 * j], PUL[2 * j + 1]);
      if (aj >= need && (PUL[2 * i] * PUL[2 * j] + PUL[2 * i + 1] * PUL[2 * j + 1]) / (ai * aj) <= cos) return true;
    }
  }
  return false;
}

// Drag in screen px (finger minus touch start) to launch velocity. Null inside the dead zone.
function launchFromDrag(dx, dy) {
  const len = Math.hypot(dx, dy);
  if (len < T.dragDead) return null;
  const power = Math.min(1, len / T.dragMax);
  return { vx: (-dx / len) * power * T.powerMax, vy: (-dy / len) * power * T.powerMax, power };
}

// The velocity the ball actually leaves with: the shot plus the moon it rides, if any.
const LV = { vx: 0, vy: 0 };
function launchVel(lv, b, l, clock) {
  LV.vx = l.vx; LV.vy = l.vy;
  if (b.on >= 0) { const c = moonAt(lv, lv.movers[b.on], clock); LV.vx += c.vx; LV.vy += c.vy; }
  return LV;
}

// Same physics as the flight, sampled every previewDotEvery simulated seconds into PV; returns the dot count.
const PV = Array.from({ length: Math.ceil(Math.max(T.previewFullSeconds, T.previewShortSeconds) / T.previewDotEvery) + 2 }, () => ({ x: 0, y: 0 }));
const PB = newBall(0, 0);
function previewPoints(lv, b, l, clock, seconds) {
  const v = launchVel(lv, b, l, clock);
  Object.assign(PB, b); PB.vx = v.vx; PB.vy = v.vy; PB.on = -1;
  const every = Math.round(T.previewDotEvery / STEP);
  const steps = Math.round(seconds / STEP);
  let n = 0;
  for (let i = 1; i <= steps && n < PV.length; i++) {
    const r = stepBall(lv, PB, clock + i * STEP);
    if (r === 'sink' || r === 'swallow') { PV[n].x = PB.x; PV[n++].y = PB.y; break; }
    if (r === 'rest') break;
    if (i % every === 0) { PV[n].x = PB.x; PV[n++].y = PB.y; }
  }
  return n;
}

// True when the shot, flown on with the preview's physics until it would stop, comes inside a black hole's influence ring:
// the range finder turns violet (PRD v0.4 A). Only the finder's colour tells; the drawn preview keeps its length.
const PR = newBall(0, 0);
function flightEntersRing(lv, b, l, clock) {
  if (!lv.blackholes.length) return false;
  const v = launchVel(lv, b, l, clock);
  Object.assign(PR, b); PR.vx = v.vx; PR.vy = v.vy; PR.on = -1;
  if (inRing(lv, PR)) return true;
  const steps = Math.round(T.maxFlightSeconds / STEP);
  for (let i = 1; i <= steps; i++) {
    const r = stepBall(lv, PR, clock + i * STEP);
    if (inRing(lv, PR)) return true;
    if (r) return false;
  }
  return false;
}
function inRing(lv, b) {
  for (const h of lv.blackholes) if (dist(b.x, b.y, h.x, h.y) < (h.reach || T.bhReach)) return true;
  return false;
}

// ---------- Helpers ----------

// The design space plus its edge walls is fitted to the screen below the HUD and the Retry button, so all four walls are
// always visible and nothing on the field sits under the HUD.
const VIEW = { s: 1, ox: 0, oy: 0 }; // reused: callers read it at once
function view(E) {
  const top = E.safe.top + T.hudH + T.retryH + T.hudGap, room = E.h - top - E.safe.bottom;
  const s = Math.min(E.w / (T.designW + 2 * T.borderW), room / (T.designH + 2 * T.borderW));
  VIEW.s = s; VIEW.ox = (E.w - T.designW * s) / 2; VIEW.oy = top + (room - T.designH * s) / 2;
  return VIEW;
}

// The menu and cards paint the sky over the whole screen: the design space scaled to cover it.
function coverView(E) {
  const s = Math.max(E.w / T.designW, E.h / T.designH);
  return { s, ox: (E.w - T.designW * s) / 2, oy: (E.h - T.designH * s) / 2 };
}

const blindCount = (blind) => { let n = 0; if (blind) for (let i = 0; i < LEVELS.length; i++) if (blind[i]) n++; return n; }; // fourth stars earned (PRD v0.9)
function starsFor(strokes, st) { return strokes <= st.three ? 3 : strokes <= st.two ? 2 : 1; }
function shots(n) { return `${n} ${n === 1 ? 'shot' : 'shots'}`; }

// The next hole opens once any hole is cleared, so a ladder that grows never locks a cleared player out (PRD v0.5 D2).
function openHole(best, unlocked) {
  const cleared = Object.keys(best || {}).map(Number).filter((i) => i >= 0);
  return clamp(Math.max(unlocked || 0, cleared.length ? Math.max(...cleared) + 1 : 0), 0, LEVELS.length - 1);
}

function progress(E) {
  const best = E.save.get('best', {}), won = E.save.get('stars', {});
  const stars = LEVELS.map((lv, i) => won[i] || 0), blind = E.save.get('blind', {});
  return { best, stars, blind, total: stars.reduce((a, b) => a + b, 0) + blindCount(blind), unlocked: openHole(best, E.save.get('unlocked', 0)), badges: E.save.get('badges', {}), prog: E.save.get('prog', {}) };
}

// ---------- Art (layer 5) ----------
// Everything below draws from TUNING.art. Gradients are built once (unit radius, drawn translated and scaled, or per
// planet look), the starfield once per hole as Path2D, and text styles once, so a frame allocates nothing.

const A = T.art, P = A.palette, TY = A.type, PI2 = Math.PI * 2;
const NO_DASH = [], ORBIT_DASH = [3, 7];

// ---------- Badges (PRD v0.3 C) ----------
// Each badge is a skill act, checked when a hole is finished; `holes` are 0-based LEVELS indices. Kinds:
//   three: three stars on every listed hole; threeAny: on any hole; threeAll: on every hole in LEVELS; ace: a listed hole in one;
//   touchdown: a sinking shot played from a rest on a planet or moon; untouched: finish a hole that has a sun without touching it;
//   runNoLand, runStrokes: a full run, every hole in LEVELS in order from hole 1, going on with Next. A retried attempt's strokes
//   and rests count toward the run (a retry on hole 1 starts it again); leaving for the menu ends it.
const BADGE_TIERS = ['Meteorite', 'Moon', 'Planet', 'Star', 'Black Hole'];
const BADGES = [
  { id: 'first-orbit', tier: 0, name: 'First Orbit', text: 'Three stars on any hole', kind: 'threeAny' },
  { id: 'banker', tier: 0, name: 'Banker', text: 'Ace hole 2', kind: 'ace', holes: [1] },
  { id: 'slingshot', tier: 1, name: 'Slingshot', text: 'Three stars on hole 3', kind: 'three', holes: [2] },
  { id: 'touchdown', tier: 1, name: 'Touchdown', text: 'Land on a planet and sink the next shot', kind: 'touchdown' },
  { id: 'untouched', tier: 1, name: 'Untouched', text: 'Finish a hole with a sun without touching it', kind: 'untouched' },
  { id: 'binary-star', tier: 2, name: 'Binary Star', text: 'Three stars on hole 5', kind: 'three', holes: [4] },
  { id: 'clockwork', tier: 2, name: 'Clockwork', text: 'Three stars on holes 8 and 9', kind: 'three', holes: [7, 8] },
  { id: 'never-landed', tier: 2, name: 'Never Landed', text: '', kind: 'runNoLand' },
  { id: 'eclipse', tier: 3, name: 'Eclipse', text: 'Three stars on hole 10', kind: 'three', holes: [9] },
  { id: 'perfect-run', tier: 3, name: 'Perfect Run', text: 'Three stars on every hole', kind: 'threeAll' },
  { id: 'under-par', tier: 3, name: 'Under Par', text: '', kind: 'runStrokes' },
  // PRD v0.7: nine exotic badges. `secret` ones show as a dark '?' medal until earned. `file` names the medal image when it is not
  // medal-<id> (the drawn medal shows while it loads or if it fails). Kinds: the flight watch's sinking-shot flags
  // (dark, great, heat), wholes of the hole (kessler, improbable, wormhole), and `live` ones earned the moment they happen.
  { id: 'kessler-cascade', tier: 2, name: 'Kessler Cascade', text: 'Touch every wall on one hole, edges too, then still sink', kind: 'kessler' },
  { id: 'dark-matter', tier: 2, secret: true, name: 'Dark Matter', text: 'Sink a shot two bodies bend, touching nothing', kind: 'dark' },
  { id: 'relativistic', tier: 2, name: 'Relativistic', text: 'Reach near light speed on one shot', kind: 'live' },
  { id: 'great-attractor', tier: 3, name: 'Great Attractor', text: 'Sink a shot every body on the hole bends (3 or more)', kind: 'great' },
  { id: 'lagrange-point', tier: 3, name: 'Lagrange Point', text: 'Rest in open space where two bodies pull equally apart', kind: 'live' },
  { id: 'improbability', file: 'medal-improbability-drive', tier: 4, secret: true, name: 'Improbability Drive', text: 'Hole out on exactly your 42nd stroke', kind: 'improbable' },
  { id: 'wormhole', tier: 4, name: 'Wormhole', text: 'A hole in one where three stars take two shots', kind: 'wormhole' },
  { id: 'heat-death', tier: 4, secret: true, name: 'Heat Death', text: 'Sink at a crawl, or hole out after 10 minutes', kind: 'heat' },
  { id: 'ftl', tier: 4, name: 'FTL', text: `Hit ${T.badges.ftlSpeed} speed`, kind: 'live' },
];
const badgeById = (id) => BADGES.find((b) => b.id === id);
const runLimit = () => LEVELS.reduce((a, lv) => a + lv.stars.three, 0) + T.runSlack;
function badgeText(b) {
  if (b.kind === 'runNoLand') return `Play holes 1 to ${LEVELS.length} in a row with Next, never resting on a planet or moon (a bounce is fine)`;
  if (b.kind === 'runStrokes') return `Play holes 1 to ${LEVELS.length} in a row with Next in ${runLimit()} strokes or fewer`;
  return b.text;
}
// Progress toward a badge for its missions tile (PRD v0.5 A): a count, a best, or where it was lost. `prog` is the saved
// record finishHole and endRun keep: lands, sunBest, runBest, lastRun { through, landedOn }.
function badgeProgress(b, p, prog) {
  const st = (i) => p.stars[i] || 0;
  if (b.kind === 'threeAny') { const n = LEVELS.filter((lv, i) => st(i) >= 3).length, best = Math.max(0, ...p.stars); return n ? `Three stars on ${n} ${n === 1 ? 'hole' : 'holes'}` : best ? `Best so far: ${best} ${best === 1 ? 'star' : 'stars'}` : 'No hole finished yet'; }
  if (b.kind === 'ace') return b.holes.map((i) => (p.best[i] === undefined ? `Hole ${i + 1} not finished yet` : `Hole ${i + 1} best: ${shots(p.best[i])}`)).join(', ');
  if (b.kind === 'three') return b.holes.length === 1 ? `Hole ${b.holes[0] + 1}: ${st(b.holes[0])} of 3 stars` : `Stars so far: ${b.holes.map((i) => `hole ${i + 1}: ${st(i)}`).join(', ')}`;
  if (b.kind === 'threeAll') return `Three stars on ${LEVELS.filter((lv, i) => st(i) >= 3).length} of ${LEVELS.length} holes`;
  if (b.kind === 'touchdown') return `Landings so far: ${prog.lands || 0}`;
  if (b.kind === 'untouched') return prog.sunBest === undefined ? 'No sun hole finished yet' : `Best finish: ${prog.sunBest} sun ${prog.sunBest === 1 ? 'touch' : 'touches'}`;
  if (b.kind === 'runNoLand') {
    const r = prog.lastRun;
    return !r ? 'No run yet' : r.landedOn ? `Last run: landed on hole ${r.landedOn}` : `Last run: no landing through hole ${r.through}`;
  }
  if (b.kind === 'runStrokes') return prog.runBest === undefined ? `No full run yet, need ${runLimit()} or fewer` : `Best run ${prog.runBest}, need ${runLimit()} or fewer`;
  return '';
}
// Badges that follow from the saved stars and best strokes alone (also used by the save migration).
function savedBadge(b, stars, best) {
  const three = (i) => (stars[i] || 0) >= 3;
  if (b.kind === 'three') return b.holes.every(three);
  if (b.kind === 'threeAny') return LEVELS.some((lv, i) => three(i));
  if (b.kind === 'threeAll') return LEVELS.every((lv, i) => three(i));
  if (b.kind === 'ace') return b.holes.every((i) => best[i] === 1);
  return false;
}
// Badges that need what happened on the hole just finished: ev = { touchdown, untouched, runDone, runStrokes, runLanded, strokes, three,
// dark, great, slow, long, kessler }. The `live` kinds (Lagrange Point, Relativistic, FTL) are earned in flight by earn().
function eventBadge(b, ev) {
  if (b.kind === 'kessler') return ev.kessler;
  if (b.kind === 'dark') return ev.dark;
  if (b.kind === 'great') return ev.great;
  if (b.kind === 'heat') return ev.slow || ev.long;
  if (b.kind === 'improbable') return ev.strokes === T.badges.improbableStrokes;
  if (b.kind === 'wormhole') return ev.strokes === 1 && ev.three >= T.badges.wormholeThree;
  if (b.kind === 'touchdown') return ev.touchdown;
  if (b.kind === 'untouched') return ev.untouched;
  if (b.kind === 'runNoLand') return ev.runDone && !ev.runLanded;
  if (b.kind === 'runStrokes') return ev.runDone && ev.runStrokes <= runLimit();
  return false;
}
const RUN = { on: false, next: 0, strokes: 0, landed: false, landedOn: -1 }; // the full run in progress, if any (not saved: a run is one sitting); landedOn: the hole of its first landing

// ---------- Skins (PRD v0.3 C2) ----------
// Every field filled from the default ball, so the art code reads one shape. A skin counts only while its badge is earned:
// a saved choice whose badge is missing renders as the default.
const SKINS = {
  balls: A.skins.balls.map((s) => ({ light: P.white, mid: P.ballMid, edge: P.ballEdge, seam: P.ballSpin, seamKind: 'seam', rim: P.ballRim, rimW: A.ball.rim, rimA: 0.75, shadow: P.shadow, ...s })),
  trails: A.skins.trails,
};
const SK = { ball: SKINS.balls[0], trail: SKINS.trails[0] };
const skinOwned = (s, badges) => !s.badge || !!badges[s.badge];
function applySkins(E) {
  const sv = E.save.get('skin', {}), had = E.save.get('badges', {});
  SK.ball = SKINS.balls.find((s) => s.id === sv.ball && skinOwned(s, had)) || SKINS.balls[0];
  SK.trail = SKINS.trails.find((s) => s.id === sv.trail && skinOwned(s, had)) || SKINS.trails[0];
}
// The skins a badge unlocks, for the card's ticket.
const skinsOf = (id) => [...SKINS.balls.filter((s) => s.badge === id), ...SKINS.trails.filter((s) => s.badge === id && !SKINS.balls.some((b) => b.badge === id))];

function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
function mixHex(a, b, t) {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), c = (s) => Math.round(lerp((x >> s) & 255, (y >> s) & 255, t));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}
const WARM = Array.from({ length: 17 }, (_, i) => mixHex(P.white, P.amber, i / 16)); // ball colour toward amber as power rises; orange is full power

// Text styles, shared objects so no call builds one. One weight rule: heavy on the large size only.
const tx = (size, color, align, weight) => ({ size, color, align, weight });
const TX = {
  big: tx(TY.lg, P.text, 'center', TY.heavy), bossBig: tx(TY.lg, P.bossAccent, 'center', TY.heavy),
  dim: tx(TY.md, P.textDim, 'center'), sm: tx(TY.sm, P.textDim, 'center'),
  bossMd: tx(TY.md, P.bossAccent, 'center'), smLight: tx(TY.sm, P.text, 'center'),
  tileNum: tx(TY.md, P.text, 'center'), tileNumOff: tx(TY.md, P.textOff, 'center'),
  label: tx(TY.sm, P.textDim, 'left'), labelC: tx(TY.sm, P.textDim, 'center'), labelBoss: tx(TY.sm, P.bossAccent, 'center'), labelR: tx(TY.sm, P.textDim, 'right'),
  valueL: tx(TY.md, P.text, 'left'), valueC: tx(TY.md, P.text, 'center'), valueGoalR: tx(TY.md, P.green, 'right'),
  goalL: tx(TY.sm, P.green, 'left'), btnL: tx(TY.sm, P.text, 'left'), btnOffL: tx(TY.sm, P.textOff, 'left'), runClean: tx(TY.sm, P.green, 'left'), progL: tx(TY.sm, P.amber, 'left'),
  goalMdL: tx(TY.md, P.green, 'left'), amberR: tx(TY.sm, P.amber, 'right'), cardTitle: tx(TY.md, P.text, 'center', TY.heavy),
  tier: P.tiers.map((c) => tx(TY.sm, c, 'left')), bigL: tx(TY.lg, P.text, 'left', TY.heavy), labelL: tx(TY.sm, P.text, 'left'), dimL: tx(TY.sm, P.textDim, 'left'), offL: tx(TY.md, P.textOff, 'left'),
};
// Button styles (engine buttons take these), and their outline colour.
const BTN = {
  primary: { fill: P.green, color: P.ink, h: 64, size: TY.md, edge: P.greenLight },
  half: { fill: P.slateDark, color: P.text, w: A.menu.missionsW, h: 48, size: TY.sm, edge: P.slate },
  back: { fill: P.slateDark, color: P.text, w: A.missions.backW, h: A.missions.backH, size: TY.md, edge: P.slate },
  secondCard: { fill: P.slateDark, color: P.text, w: 150, h: 48, size: TY.sm, edge: P.slate },
  blind: { fill: P.slateDark, color: T.blind.col, w: T.blind.cardBtnW, h: 48, size: TY.sm, edge: T.blind.col },
  retryOn: { w: T.retryW, h: T.retryH, fill: P.slate, color: P.text, edge: P.slateLight },
  retryOff: { w: T.retryW, h: T.retryH, fill: P.retryOff, color: P.textOff, edge: P.slateDeep },
};
function pill(E, label, cx, cy, o) {
  const r = E.button(label, cx, cy, o);
  E.roundRect(r.x, r.y, r.w, r.h, A.line.button, null, o.edge);
  return r;
}

// ---------- Ranks (PRD v0.6): the ladder, its images, and the rank-up card ----------
// Ranks are numbered 1 (Asteroid) to 16 (Black Hole). The rank is a function of the stars and is never stored.
const RT = T.rank, RANKS = RT.ranks;
const rankNeed = (rank) => (rank - 1) * RT.starsPerRank;
const rankFor = (stars) => Math.min(Math.floor(stars / RT.starsPerRank) + 1, RANKS.length);
const starTotal = (stars, blind) => Object.values(stars || {}).reduce((a, b) => a + b, 0) + blindCount(blind);
const starsMax = () => LEVELS.length * 4;
const starWord = (n) => `${n} ${n === 1 ? 'star' : 'stars'}`;
const firstFar = () => RANKS.findIndex((r, i) => rankNeed(i + 1) > starsMax()); // first rank today's holes cannot reach (index, or -1)

// Where the player stands: rank, next rank (0 at the top), stars to it, the bar fill, the stars still missing on holes already
// played (so the ladder can say a rank is reachable by going back), and whether today's holes cannot reach the next rank at all.
const RI = { rank: 1, next: 2, need: 0, frac: 0, left: 0, far: false };
function rankInfo(p) {
  const rank = rankFor(p.total), next = rank < RANKS.length ? rank + 1 : 0;
  RI.rank = rank; RI.next = next;
  RI.need = next ? rankNeed(next) - p.total : 0;
  RI.frac = next ? (p.total - rankNeed(rank)) / RT.starsPerRank : 1;
  RI.far = next > 0 && rankNeed(next) > starsMax();
  RI.left = 0;
  for (let i = 0; i < p.stars.length; i++) if (p.stars[i] > 0) RI.left += 3 - p.stars[i] + (p.stars[i] === 3 && !p.blind[i] ? 1 : 0); // a missing fourth star counts on a hole that has three
  return RI;
}
// The largest size up to `size` (not below `min`) at which `text` fits `width`, measured once per text and width.
const FIT = new Map();
function fitSize(ctx, text, weight, size, min, width) {
  const key = `${weight}:${size}:${width}:${text}`;
  let s = FIT.get(key);
  if (s === undefined) {
    ctx.font = `${weight} ${size}px system-ui, sans-serif`;
    const mw = ctx.measureText(text).width;
    s = mw <= width ? size : Math.max(min, Math.floor((size * width) / mw));
    FIT.set(key, s);
  }
  return s;
}
const menuLine = (i) => (!i.next ? 'Top rank' : i.far ? 'More holes coming' : `${starWord(i.need)} to ${RANKS[i.next - 1].name}`);
function ladderLine(i) {
  if (!i.next) return 'Top rank';
  const base = `${starWord(i.need)} to ${RANKS[i.next - 1].name}`;
  return !i.far && i.left >= i.need ? `${base}: ${i.left} left on holes you've played` : base; // a far rank sits under the ladder's 'more holes coming' line
}

// Images (ADR-0015): looking at, never in play. Each is drawn once it has decoded; until then, or if it fails, the shapes draw.
const ART = { title: null, ranks: [], medals: new Map() };
function loadImage(file) {
  const o = { img: new Image(), ok: false, sil: null };
  o.img.src = `assets/${file}.webp`;
  (o.img.decode ? o.img.decode() : Promise.reject()).then(() => { o.ok = true; }, () => { o.ok = o.img.complete && o.img.naturalWidth > 0; });
  return o;
}
function loadArt() {
  ART.title = loadImage('title-gravity-golf');
  ART.ranks = RANKS.map((r) => loadImage(r.file));
  for (const b of BADGES) ART.medals.set(b.id, loadImage(b.file || `medal-${b.id}`));
}
// A rank's silhouette for the ladder: the emblem's own shape in one dark colour, built once. Null without OffscreenCanvas (the disc is drawn live).
function silhouette(o) {
  if (!o.sil && typeof OffscreenCanvas !== 'undefined') {
    const n = RT.ladder.silRes, c = new OffscreenCanvas(n, n), g = c.getContext('2d');
    g.drawImage(o.img, 0, 0, n, n);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = RT.ladder.silhouette; g.fillRect(0, 0, n, n);
    o.sil = c;
  }
  return o.sil || null;
}
// Before the first frame: the gradients, the menu's sky and tile icons and the three text fonts, so the first menu frame only draws.
function warmUp(ctx) {
  G = buildGradients(ctx);
  buildSky(ctx, 'menu', 0);
  for (const lv of LEVELS) drawBadge(ctx, lv, -200, -200, 0); // the menu's tile icons, drawn off screen once so their looks are built
  for (const f of [`${TY.heavy} ${TY.lg}`, `600 ${TY.md}`, `600 ${TY.sm}`]) { ctx.font = `${f}px system-ui, sans-serif`; ctx.measureText('Aa'); }
}
// An emblem of `size` centred at (cx, cy). The shape fallback is a disc in the rank's colour (a dark one for a silhouette).
function drawEmblem(ctx, rank, cx, cy, size, dark) {
  const o = ART.ranks[rank - 1], r = size / 2;
  const im = o && o.ok ? (dark ? silhouette(o) : o.img) : null;
  if (im) { ctx.drawImage(im, cx - r, cy - r, size, size); return; }
  ctx.fillStyle = dark ? RT.ladder.silhouette : RANKS[rank - 1].col;
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.8, 0, PI2); ctx.fill();
}

// The rank-up card: an overlay on the hole's end card (or on the menu, for a veteran's one card). Tap skips it.
const RK = { on: false, t: 0, from: 1, to: 1, burst: false, skipped: false, line: '' };
function rankUpStart(E, from, to, where) {
  const C = RT.card, p = progress(E);
  RK.on = true; RK.t = 0; RK.from = from; RK.to = to; RK.burst = false; RK.skipped = false; RK.line = menuLine(rankInfo(p));
  E.save.set('rankSeen', Math.max(E.save.get('rankSeen', 1), to));
  E.ledger.add('rank', { rank: to, name: RANKS[to - 1].name, stars: p.total, at: where });
  for (let i = 0; i < C.chime.length; i++) E.audio.beep({ freq: C.chime[i].f, dur: C.chime[i].d, type: 'triangle', gain: C.chimeGain, delay: C.chimeAt + i * C.chimeGap });
  E.haptic(C.haptic);
}
const RKG = { px: 0, py: 0, pw: 0, cx: 0, ey: 0 };
function rankUpGeom(E) {
  const C = RT.card;
  RKG.pw = Math.min(E.w - 40, C.w); RKG.px = (E.w - RKG.pw) / 2; RKG.py = (E.h - C.h) / 2; RKG.cx = E.w / 2; RKG.ey = RKG.py + C.top + C.emblem / 2;
  return RKG;
}
function rankUpUpdate(dt, E) {
  if (!RK.on) return;
  const C = RT.card, col = RANKS[RK.to - 1].col;
  RK.t += dt;
  if (!RK.burst && RK.t >= C.burstAt) {
    RK.burst = true;
    const g = rankUpGeom(E), room = T.particleCap - E.particles.list.length;
    if (room > 0) {
      E.particles.emit({ x: g.cx, y: g.ey, count: Math.min(C.sparks, room), color: col, speed: C.sparkSpeed, life: C.sparkLife, size: C.sparkSize, drag: J.particleDrag });
      E.particles.emit({ x: g.cx, y: g.ey, count: Math.min(C.sparks >> 1, Math.max(0, room - C.sparks)), color: mixHex(col, P.white, C.sparkWhite), speed: C.sparkSpeed * 0.6, life: C.sparkLife, size: C.sparkSize * 0.7, drag: J.particleDrag });
    }
  }
  if (RK.t >= C.total) RK.on = false;
}
// The first tap while the card shows is spent on the card and jumps it to its fade; taps during the fade fall through to the scene. Returns true when it took the tap.
function rankUpTap() {
  const end = RT.card.total - RT.card.fadeOut;
  if (!RK.on || RK.skipped || RK.t >= end) return false;
  RK.skipped = true; RK.burst = true; RK.t = end;
  return true;
}
function drawRankUp(ctx, E) {
  const C = RT.card, t = RK.t, g = rankUpGeom(E), r = RANKS[RK.to - 1], S = C.emblem;
  const a = Math.min(clamp(t / C.fadeIn, 0, 1), clamp((C.total - t) / C.fadeOut, 0, 1));
  ctx.globalAlpha = a * C.dim; ctx.fillStyle = P.space; ctx.fillRect(0, 0, E.w, E.h);
  const k = lerp(0.9, 1, ease.outBack(clamp(t / C.fadeIn, 0, 1))), mid = g.py + C.h / 2;
  ctx.save(); ctx.translate(g.cx, mid); ctx.scale(k, k); ctx.translate(-g.cx, -mid);
  ctx.globalAlpha = a; E.roundRect(g.px, g.py, g.pw, C.h, A.line.card, P.card, r.col);
  const sw = clamp((t - C.swapAt) / C.swapTime, 0, 1), eo = ease.outBack(sw);
  if (sw > 0) { // the glow behind the new emblem
    const gr = ctx.createRadialGradient(g.cx, g.ey, 0, g.cx, g.ey, S * C.glowR);
    gr.addColorStop(0, rgba(r.col, C.glowAlpha)); gr.addColorStop(1, rgba(r.col, 0));
    ctx.globalAlpha = a * Math.min(1, eo); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(g.cx, g.ey, S * C.glowR, 0, PI2); ctx.fill();
  }
  ctx.globalAlpha = a * (1 - sw); drawEmblem(ctx, RK.from, g.cx, g.ey, S * C.oldScale);
  if (sw > 0) { ctx.globalAlpha = a * clamp(sw * 3, 0, 1); drawEmblem(ctx, RK.to, g.cx, g.ey, S * lerp(C.oldScale, 1, eo)); }
  ctx.globalAlpha = 1;
  const rk = clamp((t - C.ringAt) / C.ringTime, 0, 1);
  if (rk > 0 && rk < 1) drawRing(ctx, g.cx, g.ey, (S / 2) * lerp(C.ringFrom, C.ringTo, ease.outCubic(rk)), lerp(C.ringW, 1.5, rk), r.col, a * (1 - rk));
  const ta = a * clamp((t - C.textAt) / C.textIn, 0, 1);
  E.text(`Rank up: ${r.name}`, g.cx, g.py + C.titleY, { ...TX.cardTitle, alpha: ta });
  E.text(RK.line, g.cx, g.py + C.lineY, { ...TX.sm, alpha: ta });
  ctx.restore();
}

function radial(ctx, x0, y0, r0, x1, y1, r1, stops) {
  const g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
  for (let i = 0; i < stops.length; i += 2) g.addColorStop(stops[i], stops[i + 1]);
  return g;
}

// Shared gradients, all in unit space. Built on the first frame.
let G = null;
function buildGradients(ctx) {
  const so = rgba(P.orange, 0), lit = [-0.4, -0.4, 0.06, 0, 0, 1.05];
  return {
    glow: radial(ctx, 0, 0, 0, 0, 0, 1, [0, rgba(P.white, 0.9), 0.55, rgba(P.white, 0.3), 1, rgba(P.white, 0)]),
    bump: radial(ctx, ...lit, [0, P.slateLight, 0.5, P.slate, 1, P.slateDeep]),
    moon: radial(ctx, ...lit, [0, P.moon.light, 0.5, P.moon.mid, 1, P.moon.dark]),
    corona: radial(ctx, 0, 0, 0, 0, 0, 1, [0, rgba(P.orange, 0.9), 0.55, rgba(P.orange, 0.35), 1, so]),
    rays: radial(ctx, 0, 0, 0.9, 0, 0, 2.1, [0, rgba(P.sunMid, 0.95), 0.4, rgba(P.sunRay, 0.6), 1, rgba(P.orange, 0)]),
    sun: radial(ctx, 0, 0, 0, 0, 0, 1, [0, P.sunCore, 0.5, P.sunMid, 0.88, P.orange, 1, P.sunRim]),
    cup: radial(ctx, 0, 0, 0, 0, 0, 1, [0, P.cupDeep, 0.72, P.cupDeep, 1, P.cupEdge]),
    cupGlow: radial(ctx, 0, 0, 0, 0, 0, 1, [0, rgba(P.green, 0.9), 0.6, rgba(P.green, 0.3), 1, rgba(P.green, 0)]),
    cupHalo: radial(ctx, 0, 0, 0.45, 0, 0, 1, [0, rgba(P.green, 0.6), 1, rgba(P.green, 0)]),
    cometHead: radial(ctx, -0.25, -0.25, 0.05, 0, 0, 1, [0, P.cometCore, 0.45, P.cometHead, 1, P.cometTail]),
    cometGlow: radial(ctx, 0, 0, 0, 0, 0, 1, [0, rgba(P.cometHead, 0.8), 0.4, rgba(P.cometTail, 0.3), 1, rgba(P.cometTail, 0)]),
    cometTail: linear(ctx, 0, 0, -1, 0, [0, rgba(P.cometHead, 0.85), 0.35, rgba(P.cometTail, 0.4), 1, rgba(P.cometTail, 0)]),
    bhLens: radial(ctx, 0, 0, 0.95, 0, 0, A.blackhole.lens, [0, rgba(P.bhGlow, 0.9), 0.3, rgba(P.bhSwirl, 0.35), 1, rgba(P.bhGlow, 0)]),
    bhCore: radial(ctx, 0, 0, 0, 0, 0, 1, [0, P.bhCore, 0.75, P.bhCore, 1, rgba(P.bhGlow, 0.9)]),
    tierGlow: radial(ctx, 0, 0, 0, 0, 0, 1, [0, rgba(P.tiers[4], 0.6), 0.62, rgba(P.tiers[4], 0.6), 1, rgba(P.tiers[4], 0)]), // the Black Hole tier's glow, unit radius = the glow's outer edge
  };
}

function linear(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (let i = 0; i < stops.length; i += 2) g.addColorStop(stops[i], stops[i + 1]);
  return g;
}

// A black hole's swirl arms in horizon radii, from the influence ring (q horizon radii out) in to the horizon, and the
// stroke that fades them outward. They wind back against the clockwise spin, so as they turn each arm's points slide
// inward. Built once per ring size.
const ARMS = new Map();
function spiralArms(ctx, q) {
  const key = q.toFixed(2);
  let s = ARMS.get(key);
  if (!s) {
    const bh = A.blackhole, p = new Path2D();
    for (let j = 0; j < bh.arms; j++) {
      for (let i = 0; i <= 48; i++) {
        const u = i / 48, rr = q - (q - 1) * u, a = (j * PI2) / bh.arms - u * bh.armTurns * PI2;
        p[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
      }
    }
    s = { path: p, stroke: radial(ctx, 0, 0, 1, 0, 0, q, [0, rgba(P.bhSwirl, 1), 1, rgba(P.bhSwirl, bh.armOuter)]) };
    ARMS.set(key, s);
  }
  return s;
}

// Ball gradients per skin: the body (radial from the upper left, or a linear horizon band for chrome) and the shadow tint.
const BG = new Map();
function ballG(ctx, s) {
  let g = BG.get(s);
  if (!g) {
    g = {
      body: s.stops ? linear(ctx, -0.3, -1, 0.3, 1, s.stops) : radial(ctx, -0.35, -0.4, 0.05, 0, 0, 1.05, [0, s.light, 0.5, s.mid, 1, s.edge]),
      shadow: radial(ctx, 0, 0, 0, 0, 0, 1, [0, rgba(s.shadow, 1), 0.55, rgba(s.shadow, 0.75), 1, rgba(s.shadow, 0)]),
    };
    BG.set(s, g);
  }
  return g;
}

// Planet gradients per tint (light, mid, dark): the lit body and the atmosphere.
const TG = new Map();
function tintG(ctx, t) {
  let g = TG.get(t);
  if (!g) {
    g = {
      body: radial(ctx, -0.4, -0.4, 0.06, 0, 0, 1.05, [0, t.light, 0.45, t.mid, 1, t.dark]),
      atm: radial(ctx, 0, 0, 1, 0, 0, 1 + A.planet.atm, [0, rgba(t.mid, 0.9), 1, rgba(t.mid, 0)]),
    };
    TG.set(t, g);
  }
  return g;
}

// ----- Sky: two parallax star layers, bright stars, nebulae and the sector's feature, seeded per hole -----

function sectorOf(idx) { return Math.min(Math.floor(idx / A.sectorSize), A.sectors.length - 1); }

// A whale facing right, one unit long, centred on the origin.
function whalePath() {
  const w = new Path2D();
  w.moveTo(0.5, 0.02);
  w.bezierCurveTo(0.48, -0.14, 0.2, -0.2, -0.05, -0.16);
  w.bezierCurveTo(-0.2, -0.13, -0.32, -0.05, -0.4, -0.02);
  w.lineTo(-0.49, -0.13); w.lineTo(-0.45, 0); w.lineTo(-0.49, 0.11); w.lineTo(-0.4, 0.02);
  w.bezierCurveTo(-0.25, 0.08, -0.05, 0.16, 0.2, 0.14);
  w.bezierCurveTo(0.4, 0.12, 0.5, 0.1, 0.5, 0.02);
  w.closePath();
  w.moveTo(0.12, 0.13); w.lineTo(0.02, 0.27); w.lineTo(0.06, 0.13); w.closePath();
  return w;
}

const SKY = new Map();
function buildSky(ctx, key, sector) {
  const sk = A.sky, sec = A.sectors[sector], pal = P.sectors[sector], rng = makeRng(hashString(`sky:${key}`));
  const m = sk.margin, w = T.designW + 2 * m, h = T.designH + 2 * m;
  const layers = sk.layers.map((L) => {
    const buckets = L.alphas.map((a, i) => ({ path: new Path2D(), a, c: i === L.alphas.length - 1 ? P.starWarm : P.starCool }));
    for (let i = 0, n = Math.round(L.n * sec.stars); i < n; i++) {
      const b = buckets[rng() < sec.warmChance ? buckets.length - 1 : rng.int(0, buckets.length - 2)];
      const x = rng.range(-m, w - m), y = rng.range(-m, h - m), r = rng.range(L.r0, L.r1);
      b.path.moveTo(x + r, y); b.path.arc(x, y, r, 0, PI2);
    }
    return { buckets, drift: L.drift };
  });
  const flare = { dots: new Path2D(), cross: new Path2D() };
  for (let i = 0; i < sk.flares; i++) {
    const x = rng.range(10, T.designW - 10), y = rng.range(10, T.designH - 10), L = sk.flareLen * rng.range(0.8, 1.3);
    flare.dots.moveTo(x + 1.2, y); flare.dots.arc(x, y, 1.2, 0, PI2);
    flare.cross.moveTo(x - L, y); flare.cross.lineTo(x + L, y); flare.cross.moveTo(x, y - L); flare.cross.lineTo(x, y + L);
  }
  const cols = pal.nebula, first = rng.int(0, cols.length - 1);
  const neb = Array.from({ length: rng.int(...sec.nebulae) }, (_, i) => {
    const c = cols[(first + i * rng.int(1, cols.length - 1)) % cols.length];
    return {
      x: rng.range(0, T.designW), y: rng.range(0, T.designH), r: rng.range(...sec.nebR), a: rng.range(...sec.nebAlpha),
      g: radial(ctx, 0, 0, 0, 0, 0, 1, [0, rgba(c, 1), 0.45, rgba(c, 0.45), 1, rgba(c, 0)]),
    };
  });
  const s = { key, sec, pal, layers, flare, neb, streaks: null, shower: -1, streakG: null, whale: null, suns: null, core: null };
  if (sec.meteors) {
    s.streaks = Array.from({ length: A.meteors.count }, () => ({ x: 0, y: 0, c: 0, s: 0, len: 0 }));
    s.streakG = linear(ctx, 0, 0, 1, 0, [0, rgba(pal.streak, 0), 1, rgba(pal.streak, 1)]);
  }
  if (sec.whale) s.whale = whalePath();
  if (sec.sunrise) s.suns = pal.suns.map((c) => radial(ctx, 0, 0, 0, 0, 0, 1, [0, rgba(c, 1), 0.35, rgba(c, 0.5), 1, rgba(c, 0)]));
  if (sec.core) s.core = radial(ctx, 0, 0, 0, 0, 0, 1, [0, rgba(pal.core, 1), 0.3, rgba(pal.core, 0.45), 1, rgba(pal.core, 0)]);
  SKY.set(key, s);
  return s;
}

// A new shower re-rolls its streaks from the hole's seed and the shower's number.
function rollShower(s, n) {
  const M = A.meteors, rng = makeRng(hashString(`meteor:${s.key}:${n}`));
  s.shower = n;
  for (let i = 0; i < s.streaks.length; i++) {
    const k = s.streaks[i], a = rng.range(...M.angle);
    k.x = rng.range(T.designW * 0.2, T.designW * 1.1); k.y = rng.range(-20, T.designH * 0.45);
    k.c = Math.cos(a); k.s = Math.sin(a); k.len = rng.range(...M.len);
  }
}

function drawMeteors(ctx, s, t) {
  const M = A.meteors, n = Math.floor(t / M.period), u = t - n * M.period;
  if (u > M.stagger * (M.count - 1) + M.life) return;
  if (n !== s.shower) rollShower(s, n);
  ctx.strokeStyle = s.streakG; ctx.lineWidth = M.width; ctx.lineCap = 'round';
  for (let i = 0; i < s.streaks.length; i++) {
    const k = s.streaks[i], v = (u - i * M.stagger) / M.life;
    if (v <= 0 || v >= 1) continue;
    const d = v * M.life * M.speed;
    ctx.save(); ctx.translate(k.x + k.c * d, k.y + k.s * d); ctx.rotate(Math.atan2(k.s, k.c)); ctx.scale(k.len, 1);
    ctx.globalAlpha = M.alpha * Math.sin(Math.PI * v);
    ctx.beginPath(); ctx.moveTo(-1, 0); ctx.lineTo(0, 0); ctx.stroke(); ctx.restore();
  }
}

function drawWhale(ctx, s, t) {
  const W = A.whale, u = (t % W.period) / W.cross;
  if (u >= 1) return;
  const x = lerp(-W.size, T.designW + W.size, u), y = T.designH * W.y + Math.sin(u * PI2) * W.bob;
  ctx.save(); ctx.translate(x, y); ctx.scale(W.size, W.size);
  ctx.globalAlpha = W.alpha; ctx.fillStyle = s.pal.whale; ctx.fill(s.whale);
  ctx.globalAlpha = W.rimAlpha; ctx.strokeStyle = s.pal.whaleRim; ctx.lineWidth = W.rimW / W.size; ctx.stroke(s.whale);
  ctx.restore();
}

function drawCore(ctx, s) {
  const C = A.core;
  ctx.globalAlpha = C.alpha;
  ctx.save(); ctx.translate(T.designW * C.x, T.designH + C.dy); ctx.scale(C.r, C.r);
  ctx.fillStyle = s.core; ctx.beginPath(); ctx.arc(0, 0, 1, 0, PI2); ctx.fill(); ctx.restore();
}

function drawSunrise(ctx, s) {
  const R = A.sunrise;
  ctx.globalAlpha = R.alpha;
  for (let i = 0; i < R.suns.length; i++) {
    const o = R.suns[i];
    ctx.save(); ctx.translate(T.designW * o.x, T.designH + o.dy); ctx.scale(o.r, o.r);
    ctx.fillStyle = s.suns[i]; ctx.beginPath(); ctx.arc(0, 0, 1, 0, PI2); ctx.fill(); ctx.restore();
  }
}

// Draws the field for a hole of the given sector at time t (seconds, cosmetic only). (ox, oy) is where the ball is on
// the field, -1 to 1; the layers drift against it.
function drawField(ctx, key, sector, ox, oy, t) {
  if (!G) G = buildGradients(ctx);
  const s = SKY.get(key) || buildSky(ctx, key, sector), sk = A.sky;
  ctx.fillStyle = s.pal.field;
  ctx.fillRect(0, 0, T.designW, T.designH);
  if (s.suns) drawSunrise(ctx, s);
  if (s.core) drawCore(ctx, s);
  for (let i = 0; i < s.neb.length; i++) {
    const n = s.neb[i];
    ctx.save(); ctx.translate(n.x, n.y); ctx.scale(n.r, n.r);
    ctx.globalAlpha = n.a; ctx.fillStyle = n.g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, PI2); ctx.fill(); ctx.restore();
  }
  for (let i = 0; i < s.layers.length; i++) {
    const L = s.layers[i];
    if (i === s.layers.length - 1 && s.whale) drawWhale(ctx, s, t);
    ctx.save(); ctx.translate(-ox * L.drift, -oy * L.drift);
    for (let j = 0; j < L.buckets.length; j++) { const b = L.buckets[j]; ctx.globalAlpha = b.a; ctx.fillStyle = b.c; ctx.fill(b.path); }
    if (i === s.layers.length - 1) {
      ctx.globalAlpha = 0.9; ctx.fillStyle = P.starCool; ctx.fill(s.flare.dots);
      ctx.globalAlpha = sk.flareAlpha; ctx.strokeStyle = P.starCool; ctx.lineWidth = 0.8; ctx.lineCap = 'round'; ctx.stroke(s.flare.cross);
    }
    ctx.restore();
  }
  if (s.streaks) drawMeteors(ctx, s, t);
  ctx.globalAlpha = 1;
}

// ----- Stars (the rating) and the lock -----

function drawStar(ctx, cx, cy, R, fill, stroke) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? R * 0.45 : R;
    ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = A.line.hair; ctx.stroke(); }
}

// The fourth star (PRD v0.9): a smaller cyan star with a short comet tail, drawn the same on the tile and the end card; dim until earned.
function drawCometStar(ctx, cx, cy, R, earned) {
  const B = T.blind, col = earned ? B.col : P.starOff;
  ctx.strokeStyle = col; ctx.lineWidth = (B.tailW * R) / B.starR; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx + B.tailDx * R * 0.4, cy + B.tailDy * R * 0.4); ctx.lineTo(cx + B.tailDx * R * B.tail, cy + B.tailDy * R * B.tail); ctx.stroke();
  ctx.lineCap = 'butt';
  if (earned) drawStar(ctx, cx, cy, R, B.col, B.core); else drawStar(ctx, cx, cy, R, null, P.starOff);
}

function drawLock(ctx, cx, cy) {
  ctx.strokeStyle = P.textOff; ctx.lineWidth = A.line.edge;
  ctx.beginPath(); ctx.arc(cx, cy - 3, 5, Math.PI, 0); ctx.stroke();
  ctx.fillStyle = P.textOff; ctx.fillRect(cx - 7, cy - 3, 14, 11);
}

// ----- Slate metal: walls, sliding walls, bars and bumpers are one material. Bevels sit inside the hit shape. -----

// The edge walls sit just outside the field so the ball never overlaps them.
function drawBorder(ctx) {
  const bw = T.borderW, W = T.designW, H = T.designH, hair = A.line.hair;
  ctx.fillStyle = P.slate; // the frame as one evenodd fill, then a light line inside and a dark line outside
  ctx.beginPath(); ctx.rect(-bw, -bw, W + 2 * bw, H + 2 * bw); ctx.rect(0, 0, W, H); ctx.fill('evenodd');
  ctx.fillStyle = P.slateLight;
  ctx.fillRect(-hair, -hair, W + 2 * hair, hair); ctx.fillRect(-hair, H, W + 2 * hair, hair);
  ctx.fillRect(-hair, 0, hair, H); ctx.fillRect(W, 0, hair, H);
  ctx.fillStyle = P.slateDeep;
  ctx.fillRect(-bw, -bw, W + 2 * bw, hair); ctx.fillRect(-bw, H + bw - hair, W + 2 * bw, hair);
  ctx.fillRect(-bw, -bw + hair, hair, H + 2 * bw - 2 * hair); ctx.fillRect(W + bw - hair, -bw + hair, hair, H + 2 * bw - 2 * hair);
  for (let i = 0; i < 4; i++) drawBolt(ctx, i % 2 ? W + bw / 2 : -bw / 2, i > 1 ? H + bw / 2 : -bw / 2, 1.5);
}

function drawBolt(ctx, x, y, r) {
  ctx.fillStyle = P.slateDeep; ctx.beginPath(); ctx.arc(x, y, r, 0, PI2); ctx.fill();
  ctx.fillStyle = P.slateLight; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.4, 0, PI2); ctx.fill();
}

function drawSlab(ctx, x, y, w, h) {
  const bv = A.metal.bevel, m = Math.min(w, h);
  ctx.fillStyle = P.slate; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = P.slateLight; ctx.fillRect(x, y, w, bv); ctx.fillRect(x, y, bv, h);
  ctx.fillStyle = P.slateDark; ctx.fillRect(x, y + h - bv, w, bv); ctx.fillRect(x + w - bv, y, bv, h);
  if (m >= A.metal.boltMin) {
    if (w >= h) { drawBolt(ctx, x + m / 2, y + h / 2, A.metal.boltR); drawBolt(ctx, x + w - m / 2, y + h / 2, A.metal.boltR); }
    else { drawBolt(ctx, x + w / 2, y + m / 2, A.metal.boltR); drawBolt(ctx, x + w / 2, y + h - m / 2, A.metal.boltR); }
  }
}
function drawWall(ctx, r) { drawSlab(ctx, r.x, r.y, r.w, r.h); }

// The groove a sliding wall runs in, the length of its travel.
function drawRail(ctx, m) {
  const horiz = Math.abs(m.b.x - m.a.x) >= Math.abs(m.b.y - m.a.y), rw = A.metal.railW;
  const x0 = Math.min(m.a.x, m.b.x), x1 = Math.max(m.a.x, m.b.x) + m.w, y0 = Math.min(m.a.y, m.b.y), y1 = Math.max(m.a.y, m.b.y) + m.h;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (horiz) { ctx.moveTo(x0 + rw, m.a.y + m.h / 2); ctx.lineTo(x1 - rw, m.a.y + m.h / 2); }
  else { ctx.moveTo(m.a.x + m.w / 2, y0 + rw); ctx.lineTo(m.a.x + m.w / 2, y1 - rw); }
  ctx.strokeStyle = P.slateDark; ctx.lineWidth = rw; ctx.stroke();
  ctx.strokeStyle = P.slateDeep; ctx.lineWidth = rw * 0.4; ctx.stroke();
}

function drawBar(ctx, m, clock) {
  const u = barAt(m, clock), bw = T.barW;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(m.x - u.x, m.y - u.y); ctx.lineTo(m.x + u.x, m.y + u.y);
  ctx.strokeStyle = P.slateDeep; ctx.lineWidth = bw; ctx.stroke();
  ctx.strokeStyle = P.slate; ctx.lineWidth = bw - 2; ctx.stroke();
  ctx.save(); ctx.translate(-0.9, -0.9);
  ctx.strokeStyle = P.slateLight; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
  ctx.fillStyle = P.slateDeep; ctx.beginPath(); ctx.arc(m.x, m.y, 4.8, 0, PI2); ctx.fill();
  ctx.fillStyle = P.slateLight; ctx.beginPath(); ctx.arc(m.x, m.y, 3.2, 0, PI2); ctx.fill();
  ctx.fillStyle = P.slateDark; ctx.beginPath(); ctx.arc(m.x, m.y, 1.4, 0, PI2); ctx.fill();
}

// A bumper (mass 0): a matte slate sphere, no specular, no atmosphere.
function drawBumper(ctx, x, y, r) {
  ctx.save(); ctx.translate(x, y); ctx.scale(r, r);
  ctx.fillStyle = G.bump; ctx.beginPath(); ctx.arc(0, 0, 1, 0, PI2); ctx.fill();
  ctx.globalAlpha = 0.5; ctx.strokeStyle = P.slateDark; ctx.lineWidth = A.line.hair / r;
  ctx.beginPath(); ctx.arc(0, 0, 0.68, 0, PI2); ctx.stroke();
  ctx.globalAlpha = 0.85; ctx.strokeStyle = P.slateLight; ctx.lineWidth = A.line.edge / r;
  ctx.beginPath(); ctx.arc(0, 0, 1 - A.line.edge / r / 2, Math.PI * 0.8, Math.PI * 1.7); ctx.stroke();
  ctx.restore();
}

// ----- Planets: a look per planet from its position and mass -----
// Low mass: plain with craters. Mass about 1: bands. Above ringMass: a ring system. Moons are small and pale with a crater.

const LOOK = new WeakMap();
function lookOf(o, mass, boss) {
  let k = LOOK.get(o);
  if (k) return k;
  const pa = A.planet, moon = o.parent !== undefined; // movers have a parent; planets do not
  const rng = makeRng(hashString(moon ? `moon,${o.parent},${o.orbitR},${o.phase}` : `${o.x},${o.y},${mass}`));
  k = { bump: mass <= 0, moon, tint: null, atmTint: null, craters: null, bands: null, ring: null, tilt: 0 };
  const craters = (n) => { // x, y, radius in planet radii; the first is the largest
    const c = [];
    for (let i = 0; i < n; i++) { const a = rng.range(0, PI2), d = rng.range(0.1, 0.62); c.push(Math.cos(a) * d, Math.sin(a) * d, i ? rng.range(0.09, 0.17) : rng.range(0.17, 0.24)); }
    return c;
  };
  const bands = (n) => { // y, height, light (1) or dark (0), alpha
    const c = [];
    for (let i = 0; i < n; i++) c.push(rng.range(-0.8, 0.8), rng.range(0.07, 0.2), i % 2, rng.range(...pa.bandAlpha));
    return c;
  };
  if (moon) { k.tint = P.moon; k.atmTint = P.planets[0]; k.craters = [0.3, -0.25, 0.28, -0.35, 0.3, 0.14]; }
  else if (!k.bump) {
    k.tint = k.atmTint = rng.pick(boss ? P.boss : P.planets);
    if (mass > pa.ringMass) {
      k.ring = { tilt: rng.range(-pa.ringTilt, pa.ringTilt), squash: rng.range(...pa.ringSquash) };
      k.bands = bands(pa.ringBands);
    } else if (mass >= pa.lowMass) k.bands = bands(rng.int(...pa.bands));
    else k.craters = craters(rng.int(...pa.craters));
    k.tilt = rng.range(-0.3, 0.3);
  }
  LOOK.set(o, k);
  return k;
}

function ringHalf(ctx, k, back) {
  const pa = A.planet, rg = k.ring, a0 = back ? Math.PI : 0, a1 = back ? PI2 : Math.PI;
  ctx.lineCap = 'butt'; ctx.strokeStyle = k.tint.light;
  ctx.globalAlpha = pa.ringAlpha; ctx.lineWidth = pa.ringW;
  ctx.beginPath(); ctx.ellipse(0, 0, pa.ringR, pa.ringR * rg.squash, rg.tilt, a0, a1); ctx.stroke();
  ctx.globalAlpha = pa.ringAlpha * 0.8; ctx.lineWidth = pa.ringInnerW;
  ctx.beginPath(); ctx.ellipse(0, 0, pa.ringInner, pa.ringInner * rg.squash, rg.tilt, a0, a1); ctx.stroke();
  ctx.globalAlpha = 1;
}

// A planet or moon `o` at (x, y). `phase` (0 to 1) is the drifting pull ring, or undefined for none.
function drawPlanet(ctx, x, y, r, o, mass, boss, phase) {
  const k = lookOf(o, mass, boss), pa = A.planet;
  if (k.bump) { drawBumper(ctx, x, y, r); return; }
  const tg = tintG(ctx, k.tint), ag = tintG(ctx, k.atmTint);
  ctx.save(); ctx.translate(x, y); ctx.scale(r, r);
  ctx.globalAlpha = pa.atmAlpha * (k.moon ? pa.moonAtm : 1); ctx.fillStyle = ag.atm;
  ctx.beginPath(); ctx.arc(0, 0, 1 + pa.atm, 0, PI2); ctx.arc(0, 0, 0.98, 0, PI2, true); ctx.fill('evenodd');
  ctx.globalAlpha = 1;
  if (k.ring) ringHalf(ctx, k, true);
  ctx.fillStyle = k.moon ? G.moon : tg.body; ctx.beginPath(); ctx.arc(0, 0, 1, 0, PI2); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, 1, 0, PI2); ctx.clip();
  if (k.bands) {
    ctx.rotate(k.tilt);
    for (let i = 0; i < k.bands.length; i += 4) {
      ctx.globalAlpha = k.bands[i + 3]; ctx.fillStyle = k.bands[i + 2] ? k.tint.light : k.tint.dark;
      ctx.fillRect(-1.3, k.bands[i], 2.6, k.bands[i + 1]);
    }
    ctx.globalAlpha = 1;
  }
  if (k.craters) {
    ctx.lineWidth = A.line.hair / r;
    for (let i = 0; i < k.craters.length; i += 3) {
      const cx = k.craters[i], cy = k.craters[i + 1], cr = k.craters[i + 2];
      ctx.globalAlpha = pa.craterAlpha; ctx.fillStyle = k.moon ? P.moonCrater : k.tint.dark;
      ctx.beginPath(); ctx.arc(cx, cy, cr, 0, PI2); ctx.fill();
      ctx.strokeStyle = k.tint.light; ctx.globalAlpha = pa.craterAlpha * 1.4;
      ctx.beginPath(); ctx.arc(cx, cy, cr, -0.2, Math.PI * 0.75); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  ctx.globalAlpha = pa.rimAlpha; ctx.strokeStyle = k.tint.mid; ctx.lineWidth = A.line.hair / r; // a crisp edge all round, so the dark side still shows its size
  ctx.beginPath(); ctx.arc(0, 0, 1 - A.line.hair / r / 2, 0, PI2); ctx.stroke(); ctx.globalAlpha = 1;
  if (k.ring) ringHalf(ctx, k, false);
  if (phase !== undefined) {
    ctx.strokeStyle = k.tint.mid; ctx.lineWidth = A.line.hair / r; ctx.globalAlpha = 0.5 * phase;
    ctx.beginPath(); ctx.arc(0, 0, (r + J.atmosphere * 0.5 + J.pullRing * mass * (1 - phase)) / r, 0, PI2); ctx.stroke();
  }
  ctx.restore();
}

// ----- Suns: bright core, rotating soft rays, a breathing heat shimmer. `flare` runs 0 to 1 after a touch. -----

// reach: the pull's ring radius on the field, 0 for a menu badge.
function drawSun(ctx, x, y, r, flare, t, reach) {
  const sa = A.sun, f = 1 - flare, R = r * (J.corona + J.flareGrow * f);
  ctx.save(); ctx.translate(x, y);
  ctx.save(); ctx.scale(R, R); ctx.globalAlpha = Math.min(1, J.coronaAlpha + 0.5 * f); ctx.fillStyle = G.corona;
  ctx.beginPath(); ctx.arc(0, 0, 1, 0, PI2); ctx.arc(0, 0, r / R * 0.95, 0, PI2, true); ctx.fill('evenodd'); ctx.restore();
  ctx.scale(r, r);
  ctx.fillStyle = G.rays;
  for (let layer = 0; layer < 2; layer++) {
    const n = layer ? sa.raysB : sa.raysA, hw = (PI2 / n) * 0.28;
    ctx.save(); ctx.rotate(t * sa.rayRate * (layer ? -1.5 : 1) + layer * 0.3);
    ctx.globalAlpha = Math.min(1, sa.rayAlpha * (layer ? 0.7 : 1) + 0.4 * f);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = (i * PI2) / n, len = layer ? sa.lenB : i % 2 ? sa.lenA * 0.75 : sa.lenA;
      ctx.moveTo(Math.cos(a - hw), Math.sin(a - hw)); ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len); ctx.lineTo(Math.cos(a + hw), Math.sin(a + hw));
    }
    ctx.fill(); ctx.restore();
  }
  ctx.strokeStyle = P.sunMid; ctx.lineWidth = A.line.hair / r;
  for (let i = 0; i < 2; i++) {
    ctx.globalAlpha = sa.shimmerAlpha * (0.65 + 0.35 * Math.sin(t * sa.shimmerRate + i * 2));
    ctx.beginPath(); ctx.arc(0, 0, 1.28 + i * 0.2 + sa.shimmerAmp * Math.sin(t * sa.shimmerRate * 0.7 + i * 1.6), 0, PI2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = G.sun; ctx.beginPath(); ctx.arc(0, 0, 1, 0, PI2); ctx.fill();
  ctx.strokeStyle = P.sunRim; ctx.lineWidth = A.line.edge / r;
  ctx.beginPath(); ctx.arc(0, 0, 1 - A.line.edge / r / 2, 0, PI2); ctx.stroke();
  ctx.restore();
  if (reach) {
    ctx.setLineDash(sa.reachDash); ctx.lineWidth = sa.reachW; ctx.strokeStyle = P.sunRay; ctx.globalAlpha = sa.reachAlpha;
    ctx.beginPath(); ctx.arc(x, y, reach, 0, PI2); ctx.stroke(); ctx.setLineDash(NO_DASH); ctx.globalAlpha = 1;
  }
}

// ----- Comets: a bright cyan head and a tail trailing its motion; the path is a faint dashed line -----

function drawCometPath(ctx, m) {
  ctx.setLineDash(ORBIT_DASH); ctx.lineCap = 'round';
  ctx.globalAlpha = A.comet.pathAlpha; ctx.strokeStyle = P.cometHead; ctx.lineWidth = A.line.hair;
  ctx.beginPath(); ctx.moveTo(m.a.x, m.a.y); ctx.lineTo(m.b.x, m.b.y); ctx.stroke();
  ctx.setLineDash(NO_DASH); ctx.globalAlpha = 1;
}

function drawComet(ctx, m, clock) {
  const c = cometAt(m, clock), ca = A.comet, r = m.r, x = c.x, y = c.y;
  const back = Math.min(ca.tail, c.k * Math.hypot(m.b.x - m.a.x, m.b.y - m.a.y)); // the tail never reaches back past a
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(c.vy, c.vx));
  if (back > 1) {
    ctx.save(); ctx.scale(back, 1); ctx.fillStyle = G.cometTail;
    ctx.beginPath(); ctx.moveTo(0, -r * ca.tailW); ctx.lineTo(-1, 0); ctx.lineTo(0, r * ca.tailW); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.scale(r, r);
  ctx.save(); ctx.scale(ca.glowR, ca.glowR); ctx.fillStyle = G.cometGlow; ctx.beginPath(); ctx.arc(0, 0, 1, 0, PI2); ctx.fill(); ctx.restore();
  ctx.fillStyle = G.cometHead; ctx.beginPath(); ctx.arc(0, 0, 1, 0, PI2); ctx.fill();
  ctx.restore();
}

// ----- Black holes: a black core, a thin horizon ring, a soft purple glow and a slow clockwise swirl drawn inward -----
// `flare` runs 0 to 1 after a swallow.

function drawBlackHole(ctx, h, t, flare) {
  const bh = A.blackhole, r = h.r, f = 1 - flare, q = (h.reach || T.bhReach) / r, arms = spiralArms(ctx, q);
  ctx.save(); ctx.translate(h.x, h.y);
  if (h.mass !== undefined) { // on the field (not a menu badge): the fade band out to the rest radius, washed faintly, with a finer outer ring
    const rr = bhRestR(h);
    ctx.globalAlpha = bh.bandAlpha; ctx.fillStyle = P.bhSwirl;
    ctx.beginPath(); ctx.arc(0, 0, rr, 0, PI2); ctx.arc(0, 0, q * r, 0, PI2, true); ctx.fill();
    ctx.setLineDash(bh.restDash); ctx.lineWidth = bh.restW; ctx.strokeStyle = P.bhRim; ctx.globalAlpha = bh.restAlpha;
    ctx.beginPath(); ctx.arc(0, 0, rr, 0, PI2); ctx.stroke();
  }
  ctx.setLineDash(bh.reachDash); ctx.lineWidth = bh.reachW; ctx.strokeStyle = P.bhRim; ctx.globalAlpha = bh.reachAlpha; // the influence ring
  ctx.beginPath(); ctx.arc(0, 0, q * r, 0, PI2); ctx.stroke(); ctx.setLineDash(NO_DASH);
  ctx.scale(r, r);
  ctx.save(); const L = 1 + bh.flareGrow * f; ctx.scale(L, L);
  ctx.globalAlpha = Math.min(1, bh.lensAlpha + 0.5 * f); ctx.fillStyle = G.bhLens;
  ctx.beginPath(); ctx.arc(0, 0, bh.lens, 0, PI2); ctx.fill(); ctx.restore();
  ctx.lineCap = 'round'; ctx.strokeStyle = P.bhSwirl; ctx.lineWidth = A.line.hair / r;
  for (let i = 0; i < bh.rings; i++) { // rings drifting in to the horizon and fading as they arrive
    const k = (t * bh.ringRate + i / bh.rings) % 1, rr = q - (q - 1) * k;
    ctx.globalAlpha = bh.ringAlpha * Math.sin(Math.PI * k);
    ctx.beginPath(); ctx.arc(0, 0, rr, 0, PI2); ctx.stroke();
  }
  ctx.save(); ctx.rotate(t * bh.swirlRate);
  ctx.globalAlpha = bh.armAlpha; ctx.lineWidth = (A.line.edge * 1.2) / r; ctx.strokeStyle = arms.stroke; ctx.stroke(arms.path);
  ctx.restore();
  ctx.globalAlpha = 1; ctx.fillStyle = G.bhCore; ctx.beginPath(); ctx.arc(0, 0, 1, 0, PI2); ctx.fill();
  ctx.strokeStyle = P.bhRim; ctx.lineWidth = bh.rimW / r; ctx.globalAlpha = 0.85 + 0.15 * f;
  ctx.beginPath(); ctx.arc(0, 0, 1, 0, PI2); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ----- The cup: dark disc, green ring, inner glow that brightens when sinkable, and a flag so it reads at arm's length -----

function drawCup(ctx, x, y, glow, t) {
  const c = A.cup, R = T.holeR;
  ctx.save(); ctx.translate(x, y);
  ctx.save(); ctx.scale(R * c.haloR, R * c.haloR); ctx.globalAlpha = lerp(c.haloIdle, c.haloGlow, glow); ctx.fillStyle = G.cupHalo;
  ctx.beginPath(); ctx.arc(0, 0, 1, 0, PI2); ctx.fill(); ctx.restore();
  ctx.save(); ctx.scale(R, R);
  ctx.fillStyle = G.cup; ctx.beginPath(); ctx.arc(0, 0, 1, 0, PI2); ctx.fill();
  ctx.globalAlpha = lerp(c.glowIdle, c.glowMax, glow); ctx.fillStyle = G.cupGlow;
  ctx.beginPath(); ctx.arc(0, 0, 0.95, 0, PI2); ctx.fill(); ctx.restore();
  ctx.strokeStyle = P.green; ctx.globalAlpha = lerp(0.55, 1, glow); ctx.lineWidth = lerp(3, 5, glow);
  ctx.beginPath(); ctx.arc(0, 0, R, 0, PI2); ctx.stroke();
  if (glow > 0.01) { ctx.globalAlpha = 0.35 * glow; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, R + 6, 0, PI2); ctx.stroke(); }
  ctx.globalAlpha = 1;
  const px = R * 0.72, py = -R * 0.72, top = py - c.flagH, wave = Math.sin(t * c.flagRate) * c.flagWave;
  ctx.lineCap = 'round'; ctx.strokeStyle = P.slateLight; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, top); ctx.stroke();
  ctx.fillStyle = P.green;
  ctx.beginPath(); ctx.moveTo(px, top); ctx.quadraticCurveTo(px + c.flagW * 0.55, top + 1 + wave, px + c.flagW, top + c.flagH * 0.2 + wave);
  ctx.lineTo(px, top + c.flagH * 0.44); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ----- The ball: white sphere, highlight, soft shadow to the lower right, a spin marking that turns with the roll -----

// `s` is a ball skin (SKINS.balls entry); the marking turns with `spin` whatever its kind.
function drawBall(ctx, x, y, r, a, spin, s = SK.ball) {
  const b = A.ball, k = r / T.ballR, g = ballG(ctx, s);
  ctx.globalAlpha = a * b.shadowAlpha;
  ctx.save(); ctx.translate(x + b.shadowDx * k, y + b.shadowDy * k); ctx.scale(r * b.shadowR, r * b.shadowR);
  ctx.fillStyle = g.shadow; ctx.beginPath(); ctx.arc(0, 0, 1, 0, PI2); ctx.fill(); ctx.restore();
  ctx.globalAlpha = a;
  ctx.save(); ctx.translate(x, y); ctx.scale(r, r);
  ctx.fillStyle = g.body; ctx.beginPath(); ctx.arc(0, 0, 1, 0, PI2); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 1, 0, PI2); ctx.clip(); ctx.rotate(spin);
  ctx.fillStyle = s.seam; ctx.strokeStyle = s.seam;
  if (s.seamKind === 'crescent') { // a black crescent: the disc less an offset disc
    ctx.globalAlpha = a * 0.92;
    ctx.beginPath(); ctx.arc(0, 0, 1, 0, PI2); ctx.arc(0.42, -0.08, 0.84, 0, PI2); ctx.fill('evenodd');
  } else if (s.seamKind === 'corona') { // a ring of small rays, like the sun's
    ctx.globalAlpha = a * 0.75; ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const t = (i * PI2) / 8, c = Math.cos(t), sn = Math.sin(t), w = 0.16;
      ctx.moveTo(c * 0.34 - sn * w, sn * 0.34 + c * w); ctx.lineTo(c * 0.74, sn * 0.74); ctx.lineTo(c * 0.34 + sn * w, sn * 0.34 - c * w);
    }
    ctx.fill();
  } else {
    ctx.globalAlpha = a * 0.5; ctx.lineWidth = b.seam;
    ctx.beginPath(); ctx.ellipse(0, 0, 0.42, 1, 0, 0, PI2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0.66, 0, 0.11, 0, PI2); ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = a; ctx.fillStyle = P.white; // full white on every skin: the ball stays the brightest sphere
  ctx.beginPath(); ctx.ellipse(-0.36, -0.4, 0.26, 0.17, -0.7, 0, PI2); ctx.fill();
  const rim = Math.min(s.rimW, r * 0.25) / r; // the rim thins as the ball drops into the cup
  ctx.globalAlpha = a * s.rimA; ctx.strokeStyle = s.rim; ctx.lineWidth = rim;
  ctx.beginPath(); ctx.arc(0, 0, 1 - rim / 2, 0, PI2); ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = 1;
}

// A skin sample for the menu, the card and the swatches: the ball with a short streak of its trail behind it.
function drawSkinSample(ctx, x, y, r, ball, trail, spin) {
  if (trail && trail.col) {
    ctx.lineCap = 'round'; ctx.strokeStyle = trail.col;
    for (let i = 0; i < 5; i++) {
      const k0 = i / 5, k1 = (i + 1) / 5, x0 = x - r * (4 - 3 * k0), x1 = x - r * (4 - 3 * k1), y0 = y + r * 0.9 * (1 - k0) * (1 - k0), y1 = y + r * 0.9 * (1 - k1) * (1 - k1);
      ctx.globalAlpha = 0.15 + 0.55 * k1; ctx.lineWidth = r * (0.35 + 0.55 * k1);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (ball) drawBall(ctx, x, y, r, 1, spin, ball);
}

// ----- Hole select badges: each tile shows the hole's main feature -----

const ICON = new WeakMap();
function iconOf(lv) {
  let k = ICON.get(lv);
  if (!k) {
    k = { kind: 'slab', obj: null, moon: lv.movers.find((m) => m.type === 'moon') || null };
    if (lv.blackholes.length) k.kind = 'bh';
    else if (lv.movers.some((m) => m.type === 'comet')) k.kind = 'comet';
    else if (lv.suns.length) { k.kind = 'sun'; k.obj = lv.suns[0]; }
    else if (lv.planets.length) { k.kind = 'planet'; k.obj = lv.planets.reduce((a, p) => (p.mass > a.mass ? p : a)); }
    else if (lv.movers.some((m) => m.type === 'bar')) k.kind = 'bar';
    ICON.set(lv, k);
  }
  return k;
}

function drawBadge(ctx, lv, cx, cy, t) {
  const k = iconOf(lv), tl = A.tile, r = tl.iconR;
  if (k.kind === 'bh') {
    BADGE_BH.x = cx; BADGE_BH.y = cy; BADGE_BH.r = r * 0.62; BADGE_BH.reach = r * tl.bhReach;
    drawBlackHole(ctx, BADGE_BH, t, 1);
    if (lv.boss) drawBossHalo(ctx, cx, cy, r);
  } else if (k.kind === 'comet') {
    BADGE_COMET.a.x = cx - r * 1.6; BADGE_COMET.a.y = cy + r * 0.8; BADGE_COMET.b.x = cx + r * 0.6; BADGE_COMET.b.y = cy - r * 0.3;
    BADGE_COMET.r = r * 0.45;
    drawComet(ctx, BADGE_COMET, 0.999);
    if (lv.boss) drawBossHalo(ctx, cx, cy, r);
  } else if (k.kind === 'sun') drawSun(ctx, cx, cy, tl.sunR, 1, t, 0);
  else if (k.kind === 'planet') {
    drawPlanet(ctx, cx, cy, r, k.obj, k.obj.mass, lv.boss);
    if (lv.boss && !lookOf(k.obj, k.obj.mass, lv.boss).ring) drawBossHalo(ctx, cx, cy, r);
  } else if (k.kind === 'bar') {
    ctx.lineCap = 'round'; ctx.strokeStyle = P.slate; ctx.lineWidth = T.barW * 0.6;
    ctx.beginPath(); ctx.moveTo(cx - Math.cos(t * T.barAngularSpeed) * r, cy - Math.sin(t * T.barAngularSpeed) * r);
    ctx.lineTo(cx + Math.cos(t * T.barAngularSpeed) * r, cy + Math.sin(t * T.barAngularSpeed) * r); ctx.stroke();
    drawBolt(ctx, cx, cy, 3);
    if (lv.boss) drawBossHalo(ctx, cx, cy, r);
  } else {
    drawSlab(ctx, cx - r * 1.3, cy - r * 0.4, r * 2.6, r * 0.8);
    if (lv.boss) drawBossHalo(ctx, cx, cy, r);
  }
  if (k.moon) drawPlanet(ctx, cx + r * 1.35, cy - r * 0.95, r * 0.36, k.moon, k.moon.mass, lv.boss);
}

const BADGE_BH = { x: 0, y: 0, r: 0, reach: 0 }, BADGE_COMET = { a: { x: 0, y: 0 }, b: { x: 0, y: 0 }, period: 1, r: 0 };

function drawBossHalo(ctx, cx, cy, r) {
  ctx.strokeStyle = P.bossAccent; ctx.lineWidth = A.line.hair; ctx.globalAlpha = 0.8;
  ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.7, r * 0.5, -0.35, 0, PI2); ctx.stroke(); ctx.globalAlpha = 1;
}

// ---------- Play state ----------

const S = {};

function loadHole(idx) {
  const lv = LEVELS[idx];
  S.idx = idx; S.lv = lv;
  S.ball = newBall(lv.ball.x, lv.ball.y);
  S.strokes = 0;
  S.phase = 'aim';       // aim | fly | sink | swallow
  S.from = { x: lv.ball.x, y: lv.ball.y, on: -1, onA: 0, planet: false, pi: -1 }; // where the current shot started (the last rest); pi: the planet it sat on
  S.restPlanet = false;  // the ball rests on a planet or moon (for Touchdown and Never Landed)
  S.swT = 0; S.swX = 0; S.swY = 0; S.swBh = -1;
  S.acc = 0; S.steps = 0;
  S.clock = 0;           // hole clock: runs while aiming, restarts when the ball comes to rest
  S.clock0 = 0;
  S.aim = null;          // active pointer aim: { id, sx, sy, x, y }
  S.key = { on: false, angle: Math.atan2(lv.hole.y - lv.ball.y, lv.hole.x - lv.ball.x), power: T.keyPowerStart };
  S.sinkT = 0; S.sinkFrom = null;
  S.time = 0; S.swallows = 0; S.lands = 0; // for the ledger and the badge progress
  S.stuck = 0; S.stuckSaid = false;       // shots from a planet or sun that ended back on it (the 'More power' toast)
  S.kz = new Uint8Array(lv.walls.length + 4); S.kzLeft = lv.walls.length + 4; // Kessler Cascade: the walls and four edges touched so far on this hole
  ghostClear();
}

// The clock the moving parts are drawn at: the flight's own clock while it runs (and on through a swallow), the aiming clock otherwise.
function partClock() { return S.phase === 'aim' ? S.clock : S.clock0 + S.steps * STEP + (S.phase === 'swallow' ? S.swT : 0); }

// Current aim as a launch, from the pointer drag or the keyboard fallback.
function currentLaunch() {
  if (S.aim) return launchFromDrag(S.aim.x - S.aim.sx, S.aim.y - S.aim.sy);
  if (S.key.on) {
    const power = clamp(S.key.power, T.dragDead / T.dragMax, 1);
    return { vx: Math.cos(S.key.angle) * power * T.powerMax, vy: Math.sin(S.key.angle) * power * T.powerMax, power };
  }
  return null;
}

function launch(l) {
  S.strokes++;
  ghostClear(); // the ghost goes at the release; this flight is recorded for the next one
  const v = launchVel(S.lv, S.ball, l, S.clock), f = S.from;
  f.x = S.ball.x; f.y = S.ball.y; f.on = S.ball.on; f.onA = S.ball.onA; f.planet = S.restPlanet; f.pi = S.ball.on >= 0 ? -1 : bodyAt(S.lv, S.ball);
  S.ball.vx = v.vx; S.ball.vy = v.vy; S.ball.on = -1;
  S.ball.sunIn = 0; S.ball.cometIn = 0; // a shot from rest against a sun is charged if it goes back into it
  watchStart(S.lv, S.ball);
  S.clock0 = S.clock;
  S.acc = 0; S.steps = 0;
  S.phase = 'fly';
  S.aim = null; S.key.on = false;
}

function comeToRest() {
  ghostKeep();
  S.ball.vx = S.ball.vy = 0;
  S.phase = 'aim';
  S.clock = 0;
  carry(S.lv, S.ball, 0);
  S.restPlanet = onPlanet(S.lv, S.ball);
  if (S.restPlanet) S.lands++;
  if (S.restPlanet && RUN.on && !RUN.landed) { RUN.landed = true; RUN.landedOn = S.idx; }
}

// PRD v0.5 A2: after a flight comes to rest, the one-line notes. Three shots from a planet that all end back on it say
// 'More power to leave the planet' (once per hole), and the same from a sun says '... the sun'; the landing that breaks
// Never Landed says so, once the run is showing.
function restNotes(E, brokeRun) {
  const pi = bodyAt(S.lv, S.ball);
  S.stuck = pi !== -1 && pi === S.from.pi ? S.stuck + 1 : 0;
  if (S.stuck >= A.stuckShots && !S.stuckSaid) { S.stuckSaid = true; E.toast(pi >= 0 ? 'More power to leave the planet' : 'More power to leave the sun'); }
  else if (brokeRun && S.idx > 0 && !E.save.get('badges', {})['never-landed']) E.toast(`Never Landed lost: landed on hole ${S.idx + 1}`);
}
// The body a resting ball sits on: a planet's index, -2 - i for sun i (pressed against it), or -1.
function bodyAt(lv, b) {
  const i = planetAt(lv, b);
  if (i >= 0) return i;
  for (let j = 0; j < lv.suns.length; j++) { const s = lv.suns[j]; if (dist(b.x, b.y, s.x, s.y) < s.r + T.ballR + 1) return -2 - j; }
  return -1;
}
function planetAt(lv, b) {
  for (let i = 0; i < lv.planets.length; i++) { const p = lv.planets[i]; if (p.mass > 0 && dist(b.x, b.y, p.x, p.y) < p.r + T.ballR + 0.5) return i; }
  return -1;
}

// Resting on a planet that pulls, or riding a moon. A bumper (mass 0) is not a planet here.
function onPlanet(lv, b) {
  if (b.on >= 0) return true;
  for (const p of lv.planets) if (p.mass > 0 && dist(b.x, b.y, p.x, p.y) < p.r + T.ballR + 0.5) return true;
  return false;
}

// After a swallow the ball is back where the shot started, as a rest (a moon rider is back on its moon).
function returnToLastRest() {
  const b = S.ball, f = S.from;
  b.x = f.x; b.y = f.y; b.on = f.on; b.onA = f.onA; b.bh = -1;
  comeToRest();
}

// Badges earned in flight (Lagrange Point, Relativistic, FTL) are saved at once, so closing the app loses nothing, and wait here for the
// next hole card's ticket.
const PENDING = [];
function earn(E, id) {
  if (E.save.get('badges', {})[id]) return;
  E.save.update('badges', (h) => ({ ...h, [id]: 1 }), {});
  E.ledger.add('badge', { id, hole: S.idx + 1 });
  PENDING.push(id);
  badgeFx(E, badgeById(id).tier);
}

function finishHole(E) {
  const strokes = S.strokes, lv = S.lv, id = String(S.idx), stars = starsFor(strokes, lv.stars);
  const prev = E.save.get('best', {})[id], rankBefore = rankFor(starTotal(E.save.get('stars', {}), E.save.get('blind', {})));
  const fourthNew = S.blind && strokes <= lv.stars.three && !E.save.get('blind', {})[id]; // PRD v0.9: the fourth star, saved with the rest and never lost
  if (fourthNew) E.save.update('blind', (b) => ({ ...b, [id]: true }), {});
  const best = prev === undefined ? strokes : Math.min(prev, strokes);
  E.save.update('best', (b) => ({ ...b, [id]: best }), {});
  E.save.update('stars', (s) => ({ ...s, [id]: Math.max(s[id] || 0, stars) }), {});
  const hasNext = S.idx + 1 < LEVELS.length;
  if (hasNext) E.save.update('unlocked', (u) => Math.max(u, S.idx + 1), 0);
  const inRun = RUN.on && RUN.next === S.idx;
  if (inRun) { RUN.strokes += strokes; RUN.next = S.idx + 1; }
  const ev = { touchdown: S.from.planet, untouched: lv.suns.length > 0 && S.ball.sunHits === 0,
    runDone: inRun && !hasNext, runStrokes: RUN.strokes, runLanded: RUN.landed,
    strokes, three: lv.stars.three, dark: SINK.dark, great: SINK.great, slow: SINK.slow, long: S.time >= T.badges.heatMinutes * 60, kessler: S.kzLeft === 0 };
  E.ledger.add('hole', { hole: S.idx + 1, blind: S.blind, strokes, stars, swallows: S.swallows, sun: S.ball.sunHits, landed: S.lands > 0, time: S.time, run: inRun });
  E.save.update('prog', (g) => {
    const o = { ...g, lands: (g.lands || 0) + S.lands };
    if (lv.suns.length) o.sunBest = Math.min(g.sunBest === undefined ? Infinity : g.sunBest, S.ball.sunHits);
    if (inRun) o.lastRun = { through: S.idx + 1, landedOn: RUN.landedOn + 1 };
    return o;
  }, {});
  if (ev.runDone) endRun(E, true);
  const had = E.save.get('badges', {}), won = E.save.get('stars', {}), bests = E.save.get('best', {});
  const now = BADGES.filter((b) => !had[b.id] && (savedBadge(b, won, bests) || eventBadge(b, ev))).map((b) => b.id);
  if (now.length) E.save.update('badges', (h) => { const o = { ...h }; for (const k of now) o[k] = 1; return o; }, {});
  for (const id of now) E.ledger.add('badge', { id, hole: S.idx + 1 });
  const fresh = [...PENDING.splice(0), ...now].sort((a, b) => badgeById(b).tier - badgeById(a).tier); // earned in flight, then on this hole; the rarest ticket first
  const rankAfter = rankFor(starTotal(E.save.get('stars', {}), E.save.get('blind', {})));
  const owned = !!E.save.get('blind', {})[id], has3 = E.save.get('stars', {})[id] >= 3;
  E.setScene('over', { hole: S.idx, name: lv.name, boss: lv.boss, strokes, three: lv.stars.three, par: lv.stars.two, stars, best, hasNext, badges: fresh,
    blind: S.blind, fourth: owned, fourthNew, has3, rankUp: rankAfter > rankBefore ? { from: rankBefore, to: rankAfter } : null });
}

// A full run ends: finished (done) or left (a hole played out of order, Menu or Retry from the card, or hole 1 again).
function endRun(E, done) {
  if (!RUN.on) return;
  if (RUN.next > 0 || RUN.strokes > 0) E.ledger.add('run', { done, holes: RUN.next, strokes: RUN.strokes, landed: RUN.landed, landedOn: RUN.landedOn >= 0 ? RUN.landedOn + 1 : 'none', limit: runLimit() });
  if (done) E.save.update('prog', (g) => ({ ...g, runBest: Math.min(g.runBest === undefined ? Infinity : g.runBest, RUN.strokes) }), {});
  RUN.on = false;
}

// ---------- Juice (cosmetic only: reads the physics state, never writes it) ----------

const FX = { glow: 0, power: 0, pop: 1, flash: 1, rest: 1, sink: 1, retry: 1, shots: 1, banner: 1, bannerTok: null, ring: null, flare: null, bhFlare: null, trailT: 0, ghost: false, gx: 0, gy: 0,
  hint: 0, hintT: 0, further: 1, spin: 0, trailK: 1, cup: 0, skyKey: '', hudHole: '', hudPar: '', hudN: -1, hudShots: '', hudRunN: -1, hudRun: '' };
const TRAIL = { xy: new Float32Array(2 * T.trailLength), n: 0, col: P.purple }; // oldest point first
const NOOP = () => {};
let CHANGED = null;  // { hole, from, to }: the hole whose stars just went up, consumed by the menu

function resetFx() {
  FX.glow = 0; FX.power = 0; FX.pop = 1; FX.flash = 1; FX.rest = 1; FX.sink = 1; FX.retry = 1; FX.shots = 1;
  FX.ghost = false; FX.trailT = 0; FX.spin = 0; FX.trailK = 1; FX.cup = 0; FX.hudN = -1; FX.hudRunN = -1;
  FX.skyKey = `h${S.idx}`; FX.hudHole = `${S.lv.boss ? 'BOSS' : 'HOLE'} ${S.idx + 1}`; FX.hudPar = `${S.lv.stars.two}`;
  FX.ring = new Float32Array(S.lv.planets.length);
  FX.flare = new Float32Array(S.lv.suns.length).fill(1);
  FX.bhFlare = new Float32Array(S.lv.blackholes.length).fill(1);
  TRAIL.n = 0;
}

function later(E, sec, fn) { E.tween(sec, NOOP, ease.linear, fn); }

// Engine particles live in screen space, so a design-space point goes through the view. Capped by particleCap.
function burst(E, x, y, o) {
  const room = T.particleCap - E.particles.list.length;
  if (room <= 0) return;
  const v = view(E);
  E.particles.emit({
    x: v.ox + x * v.s, y: v.oy + y * v.s, count: Math.min(o.count, room), color: o.color,
    speed: o.speed * v.s, life: o.life, size: o.size * v.s, angle: o.angle || 0,
    spread: o.spread === undefined ? Math.PI * 2 : o.spread, drag: J.particleDrag,
  });
}

// A badge's sound: the Star tier and below get the usual win; Black Hole gets a lower, longer three-note chime (principle 16).
function badgeSound(E, tier, vol) {
  const B = T.badges;
  if (tier < 4) { E.audio.play('win', vol); return; }
  for (let i = 0; i < B.chime.length; i++) E.audio.beep({ freq: B.chime[i].f, dur: B.chime[i].d, type: 'triangle', gain: B.chimeGain * vol * 2, delay: i * B.chimeGap });
}
// A badge earned in flight: the sound, a haptic and a burst in the tier's colour where the ball is.
function badgeFx(E, tier) {
  const B = T.badges;
  badgeSound(E, tier, 0.5); E.haptic(J.sinkHaptic);
  burst(E, S.ball.x, S.ball.y, { count: B.fxCount, color: P.tiers[tier], speed: B.fxSpeed, life: B.fxLife, size: J.burstSize });
}

function trailPush(x, y, col) {
  if (TRAIL.n === T.trailLength) { TRAIL.xy.copyWithin(0, 2, 2 * TRAIL.n); TRAIL.n--; }
  TRAIL.xy[2 * TRAIL.n] = x; TRAIL.xy[2 * TRAIL.n + 1] = y; TRAIL.n++; TRAIL.col = col;
}
function trailDrop() {
  if (TRAIL.n > 0) { TRAIL.xy.copyWithin(0, 2, 2 * TRAIL.n); TRAIL.n--; }
}

// True when the ball is within planetNearR of the surface of a planet or moon that pulls, or of a black hole's horizon.
function planetNear(lv, b, clock) {
  for (const p of lv.planets) if (p.mass > 0 && dist(b.x, b.y, p.x, p.y) - p.r < J.planetNearR) return true;
  for (const h of lv.blackholes) if (dist(b.x, b.y, h.x, h.y) - h.r < J.planetNearR) return true;
  for (const m of lv.movers) if (m.type === 'moon') { const c = moonAt(lv, m, clock); if (dist(b.x, b.y, c.x, c.y) - m.r < J.planetNearR) return true; }
  return false;
}
function planetColor(lv) { return lv.boss ? P.bossAccent : P.purple; }

// Speed-tied glow trail: a soft wide pass under a core pass, both scaled by FX.trailK (the ball's speed).
function drawTrail(ctx, bx, by) {
  const n = TRAIL.n, tr = A.trail;
  if (n < 1 || !SK.trail.col) return;
  ctx.strokeStyle = TRAIL.col; ctx.lineCap = 'round';
  for (let pass = 0; pass < 2; pass++) {
    const wide = pass === 0, w = J.trailWidth * (wide ? tr.glowWidth : 1) * (0.7 + 0.3 * FX.trailK), a = (wide ? tr.glowAlpha : J.trailAlpha) * FX.trailK;
    for (let i = 1; i <= n; i++) {
      const k = i / n;
      const x1 = i < n ? TRAIL.xy[2 * i] : bx, y1 = i < n ? TRAIL.xy[2 * i + 1] : by;
      ctx.globalAlpha = a * k; ctx.lineWidth = w * (0.3 + 0.7 * k);
      ctx.beginPath(); ctx.moveTo(TRAIL.xy[2 * i - 2], TRAIL.xy[2 * i - 1]); ctx.lineTo(x1, y1); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function drawGlow(ctx, x, y, r, a) {
  ctx.save(); ctx.translate(x, y); ctx.scale(r, r);
  ctx.globalAlpha = a; ctx.fillStyle = G.glow;
  ctx.beginPath(); ctx.arc(0, 0, 1, 0, PI2); ctx.fill();
  ctx.restore();
}

function drawRing(ctx, x, y, r, w, col, a) {
  ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = w;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1;
}

// The range finder: the honest simulation, drawn as dots that shrink and fade with distance (evenly spaced in simulated
// time, so spacing shows speed), coloured like the ball and warming with power, with a brighter first segment. `maxN` is
// the dot count of a full-length preview: a preview that reaches it was cut by time, so it ends in a soft cap; one that
// stops earlier ended at a rest or the cup and gets none. `violet`: the shot's flight enters a black hole's influence ring.
function drawRange(ctx, b, l, n, maxN, violet) {
  const R = A.range, p = l.power, col = violet ? P.violet : p >= 1 ? P.orange : WARM[Math.round(p * (WARM.length - 1))], grow = 1 + R.powerGrow * p, head = Math.min(n, R.firstDots);
  const gr = T.ballR + R.gaugeGap;
  ctx.lineCap = 'round'; ctx.strokeStyle = col; ctx.lineWidth = R.gaugeW;
  ctx.globalAlpha = R.gaugeTrack; ctx.beginPath(); ctx.arc(b.x, b.y, gr, 0, PI2); ctx.stroke();
  ctx.globalAlpha = 0.95; ctx.beginPath(); ctx.arc(b.x, b.y, gr, -Math.PI / 2, -Math.PI / 2 + p * PI2); ctx.stroke();
  let px = b.x, py = b.y;
  for (let i = 0; i < head; i++) { // the comet head: a tapering line through the first points
    const k = i / R.firstDots, x = PV[i].x, y = PV[i].y;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y);
    ctx.globalAlpha = R.backAlpha * (1 - 0.6 * k); ctx.strokeStyle = P.shadow; ctx.lineWidth = (R.headW + R.backGrow * 2) * (1 - 0.65 * k) * grow; ctx.stroke();
    ctx.globalAlpha = R.headAlpha * (1 - 0.7 * k); ctx.strokeStyle = col; ctx.lineWidth = R.headW * (1 - 0.65 * k) * grow; ctx.stroke();
    px = x; py = y;
  }
  ctx.globalAlpha = R.backAlpha; ctx.fillStyle = P.shadow; ctx.beginPath(); // one dark backing under all the dots
  for (let i = 0; i < n; i++) { const r = lerp(R.r0, R.r1, i / maxN) * grow + R.backGrow; ctx.moveTo(PV[i].x + r, PV[i].y); ctx.arc(PV[i].x, PV[i].y, r, 0, PI2); }
  ctx.fill();
  ctx.fillStyle = col;
  for (let g = 0; g < n; g += R.dotGroup) { // dots in groups of dotGroup share one fill, and one alpha
    const mid = Math.min(n - 1, g + (R.dotGroup - 1) / 2);
    ctx.globalAlpha = Math.min(1, Math.max(violet ? R.violetMin : 0, lerp(R.a0, R.a1, mid / maxN) + (mid < R.firstDots ? R.headBoost : 0)));
    ctx.beginPath();
    for (let i = g; i < Math.min(n, g + R.dotGroup); i++) { const r = lerp(R.r0, R.r1, i / maxN) * grow; ctx.moveTo(PV[i].x + r, PV[i].y); ctx.arc(PV[i].x, PV[i].y, r, 0, PI2); }
    ctx.fill();
  }
  if (n >= maxN && n > 0) {
    const e = PV[n - 1], q = n > 1 ? PV[n - 2] : b, d = Math.hypot(e.x - q.x, e.y - q.y) || 1;
    const ux = (e.x - q.x) / d, uy = (e.y - q.y) / d, cx = e.x + ux * R.capGap, cy = e.y + uy * R.capGap;
    drawGlow(ctx, cx, cy, R.capGlowR, R.capGlowA);
    ctx.globalAlpha = R.capAlpha; ctx.strokeStyle = col; ctx.lineWidth = R.capW;
    ctx.beginPath(); ctx.moveTo(cx - uy * R.capLen, cy + ux * R.capLen); ctx.lineTo(cx + uy * R.capLen, cy - ux * R.capLen); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ----- The last shot's ghost (PRD v0.4 B): the end of the previous flight as faint dots, shown while aiming, cleared by Retry -----

const GHOST_N = Math.ceil(T.ghostSeconds / (STEP * J.trailEvery));
const GHOST = { rec: new Float32Array(2 * GHOST_N), head: 0, count: 0, show: new Float32Array(2 * GHOST_N), n: 0 };
function ghostRecord(x, y) { // a ring of the last ghostSeconds of the flight in progress
  GHOST.rec[2 * GHOST.head] = x; GHOST.rec[2 * GHOST.head + 1] = y;
  GHOST.head = (GHOST.head + 1) % GHOST_N; GHOST.count = Math.min(GHOST.count + 1, GHOST_N);
}
function ghostKeep() { // the flight ended: its recording becomes the ghost, oldest first
  const start = (GHOST.head - GHOST.count + GHOST_N) % GHOST_N;
  for (let i = 0; i < GHOST.count; i++) { const k = (start + i) % GHOST_N; GHOST.show[2 * i] = GHOST.rec[2 * k]; GHOST.show[2 * i + 1] = GHOST.rec[2 * k + 1]; }
  GHOST.n = GHOST.count; GHOST.count = 0; GHOST.head = 0;
}
function ghostClear() { GHOST.n = 0; GHOST.count = 0; GHOST.head = 0; }
// The blind try's direction pointer (PRD v0.9): a straight arrow of fixed length from the ball along the aim, nothing more.
// The tip is shortened, never moved, to stay below the HUD band and the Blind tag.
function drawPointer(ctx, E, v, b, l) {
  const B = T.blind, d = Math.hypot(l.vx, l.vy) || 1, ux = l.vx / d, uy = l.vy / d;
  const x0 = b.x + ux * (T.ballR + B.gap), y0 = b.y + uy * (T.ballR + B.gap);
  let len = B.pointerLen;
  if (uy < 0) len = Math.max(B.minLen, Math.min(len, (v.oy + y0 * v.s - (E.safe.top + T.hudH + B.hudClear)) / (-uy * v.s)));
  const x1 = x0 + ux * len, y1 = y0 + uy * len, hx = x1 - ux * B.headLen, hy = y1 - uy * B.headLen;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.globalAlpha = B.alpha * 0.45; ctx.strokeStyle = P.shadow; ctx.fillStyle = P.shadow; ctx.lineWidth = B.pointerW + 2 * B.backGrow;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(hx, hy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x1 + ux * B.backGrow, y1 + uy * B.backGrow); ctx.lineTo(hx - uy * (B.headHalf + B.backGrow), hy + ux * (B.headHalf + B.backGrow)); ctx.lineTo(hx + uy * (B.headHalf + B.backGrow), hy - ux * (B.headHalf + B.backGrow)); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = B.alpha; ctx.strokeStyle = B.col; ctx.fillStyle = B.col; ctx.lineWidth = B.pointerW;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(hx, hy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(hx - uy * B.headHalf, hy + ux * B.headHalf); ctx.lineTo(hx + uy * B.headHalf, hy - ux * B.headHalf); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
}
function drawGhost(ctx) {
  if (!GHOST.n) return;
  ctx.globalAlpha = T.ghostAlpha; ctx.fillStyle = P.trail; ctx.beginPath();
  const g = A.ghost;
  for (let i = 0; i < GHOST.n; i += g.every) { const x = GHOST.show[2 * i], y = GHOST.show[2 * i + 1]; ctx.moveTo(x + g.dotR, y); ctx.arc(x, y, g.dotR, 0, PI2); }
  ctx.fill(); ctx.globalAlpha = 1;
}

// Per frame: glow follows the touch, pull rings speed up near the ball, the trail drains when the ball is not flying.
function fxUpdate(dt) {
  const b = S.ball, planets = S.lv.planets;
  FX.glow = clamp(FX.glow + (S.aim || S.key.on ? dt / J.glowInTime : -dt / J.glowOutTime), 0, 1);
  const sp = Math.hypot(b.vx, b.vy);
  if (S.phase === 'fly') {
    FX.trailK = lerp(A.trail.floor, 1, clamp((sp - A.trail.minSpeed) / (A.trail.speedRef - A.trail.minSpeed), 0, 1));
    FX.spin += clamp(sp / T.ballR, 0, A.ball.spinMax) * dt * (b.vx < 0 ? -1 : 1);
  }
  FX.cup += ((S.phase === 'sink' || (S.phase === 'fly' && sp < T.sinkSpeed) ? 1 : 0) - FX.cup) * Math.min(1, dt * A.cup.glowRate);
  for (let i = 0; i < planets.length; i++) {
    const p = planets[i], near = clamp(1 - (dist(b.x, b.y, p.x, p.y) - p.r) / J.planetNearR, 0, 1);
    FX.ring[i] = (FX.ring[i] + dt * (J.ringRate + J.ringBoost * near)) % 1;
  }
  if (S.phase !== 'fly' && TRAIL.n > 0) {
    FX.trailT += dt;
    while (FX.trailT >= J.trailDecay && TRAIL.n > 0) { FX.trailT -= J.trailDecay; trailDrop(); }
  }
}

function dragStartFx(E) {
  FX.glow = Math.max(FX.glow, J.glowStart); FX.power = 0;
  FX.pop = J.dragPopFrom;
  E.tween(J.dragPopTime, (k) => { FX.pop = lerp(J.dragPopFrom, 1, k); }, ease.outBack);
}

function popShots(E) {
  FX.shots = J.shotsPopFrom;
  E.tween(J.shotsPopTime, (k) => { FX.shots = lerp(J.shotsPopFrom, 1, k); }, ease.outBack);
}

function releaseFx(E) {
  const b = S.ball, len = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / len, uy = b.vy / len;
  E.audio.play('tap'); E.haptic(J.releaseHaptic);
  burst(E, b.x - ux * T.ballR, b.y - uy * T.ballR, { count: J.puffCount, color: P.puff, speed: J.puffSpeed, life: J.puffLife, size: J.puffSize, angle: Math.atan2(-uy, -ux), spread: J.puffSpread });
  FX.flash = 0;
  E.tween(J.flashTime, (k) => { FX.flash = k; }, ease.linear);
  popShots(E);
}

// The physics leaves the contact normal of the latest hit on the ball.
function bounceFx(E, pvx, pvy) {
  const b = S.ball, big = Math.hypot(pvx, pvy) > J.bigHitSpeed, nx = b.nx, ny = b.ny;
  E.audio.play('hit', big ? J.bigHitVol : J.hitVol);
  burst(E, b.x - nx * T.ballR, b.y - ny * T.ballR, {
    count: big ? J.sparkBigCount : J.sparkCount, color: big ? P.sparkBig : P.spark,
    speed: big ? J.sparkBigSpeed : J.sparkSpeed, life: big ? J.sparkBigLife : J.sparkLife,
    size: big ? J.sparkBigSize : J.sparkSize, angle: Math.atan2(ny, nx), spread: J.sparkSpread,
  });
  if (big) E.shake(J.bigShake, J.bigShakeTime);
}

// A sun touch: the penalty stroke pops on the HUD, the sun flares, a hazard sound and buzz.
function sunFx(E, i) {
  const b = S.ball, s = S.lv.suns[i], flare = FX.flare;
  E.audio.play('miss'); E.haptic(J.sunHaptic);
  popShots(E);
  flare[i] = 0;
  E.tween(J.flareTime, (k) => { flare[i] = k; }, ease.outCubic);
  const nx = (b.x - s.x) / (s.r + T.ballR), ny = (b.y - s.y) / (s.r + T.ballR);
  burst(E, s.x + nx * s.r, s.y + ny * s.r, { count: J.flareCount, color: P.orange, speed: J.flareSpeed, life: J.flareLife, size: J.flareSize, angle: Math.atan2(ny, nx), spread: 2.4 });
}

// A comet kick: a cyan burst where it struck, a short shake and a buzz (the bounce itself sounds through bounceFx).
function cometFx(E) {
  const b = S.ball, nx = b.nx, ny = b.ny;
  E.haptic(J.cometHaptic); E.shake(J.cometShake, J.cometShakeTime);
  burst(E, b.x - nx * T.ballR, b.y - ny * T.ballR, { count: J.cometSparkCount, color: P.cometHead, speed: J.cometSparkSpeed, life: J.cometSparkLife, size: J.cometSparkSize, angle: Math.atan2(ny, nx), spread: 2.2 });
}

// The ball crosses a horizon: the penalty stroke pops, a falling tone, a buzz, and the horizon flares while the ball spirals in.
function swallowFx(E, i) {
  const flare = FX.bhFlare;
  E.audio.play('miss'); E.audio.beep({ freq: 420, dur: J.swallowTime, type: 'sine', gain: 0.15 * J.swallowVol, slide: 0.25 });
  E.haptic(J.swallowHaptic);
  popShots(E);
  flare[i] = 0;
  E.tween(J.bhFlareTime, (k) => { flare[i] = k; }, ease.outCubic);
}

// Back at the last rest after a swallow: the ball fades in there, with no trail leading to it.
function returnFx(E) {
  TRAIL.n = 0;
  FX.ghost = false; FX.retry = 0;
  E.tween(J.returnFade, (k) => { FX.retry = k; }, ease.outQuad);
}

function restFx(E) {
  if (S.strokes <= J.farRestShots || dist(S.ball.x, S.ball.y, S.lv.hole.x, S.lv.hole.y) <= J.farRestDist) return;
  FX.rest = 0;
  E.tween(J.restPulseTime, (k) => { FX.rest = k; }, ease.outQuad);
}

function sinkFx(E) {
  const lv = S.lv, stars = starsFor(S.strokes, lv.stars), three = stars === 3;
  const from = E.save.get('stars', {})[S.idx] || 0, B = T.blind;
  const four = S.blind && S.strokes <= lv.stars.three; // a blind three-star finish: the brighter sound and burst
  CHANGED = stars > from ? { hole: S.idx, from, to: stars } : four && !E.save.get('blind', {})[S.idx] ? { hole: S.idx, from: 3, to: 3, blind: true } : null;
  if (four) burst(E, lv.hole.x, lv.hole.y, { count: B.burstCount, color: B.col, speed: J.burstSpeed * B.burstSpeedK, life: J.burstLife, size: J.burstSize });
  burst(E, lv.hole.x, lv.hole.y, { count: three ? J.burstBigCount : J.burstCount, color: P.green, speed: J.burstSpeed * (three ? 1.3 : 1), life: J.burstLife, size: J.burstSize });
  burst(E, lv.hole.x, lv.hole.y, { count: three ? J.burstBigCount / 2 : J.burstCount / 2, color: P.greenLight, speed: J.burstSpeed * 0.6, life: J.burstLife, size: J.burstSize * 0.7 });
  E.haptic(J.sinkHaptic);
  if (three) {
    E.audio.play('coin'); later(E, J.coinLead, () => E.audio.play('win'));
    if (four) {
      for (let i = 0; i < B.chime.length; i++) E.audio.beep({ freq: B.chime[i].f, dur: B.chime[i].d, type: 'triangle', gain: B.chimeGain, delay: J.coinLead + i * B.chimeGap });
      E.haptic(B.haptic);
    }
    E.flash(four ? B.col : P.green, four ? B.flash : J.threeStarFlash);
  } else E.audio.play('win');
  FX.sink = 0;
  E.tween(J.sinkRingTime, (k) => { FX.sink = k; }, ease.outCubic);
}

// Retry is instant for the game; only the picture fades: the old ball dissolves where it lay, the ball at the tee fades in.
function retry(E) {
  const gx = S.ball.x, gy = S.ball.y, had = S.strokes > 0;
  E.ledger.add('retry', { hole: S.idx + 1, strokes: S.strokes, time: S.time, from: 'hud' });
  const moved = dist(gx, gy, S.lv.ball.x, S.lv.ball.y) > T.ballR;
  if (RUN.on && S.idx === 0) { RUN.strokes = 0; RUN.landed = false; RUN.landedOn = -1; } // a retry on hole 1 starts the run again
  else if (RUN.on) RUN.strokes += S.strokes;                            // elsewhere the abandoned attempt still counts
  loadHole(S.idx); resetFx();
  E.audio.play('tap', J.retryTapVol);
  if (moved) {
    FX.ghost = true; FX.gx = gx; FX.gy = gy; FX.retry = 0;
    E.tween(J.retryFade, (k) => { FX.retry = k; }, ease.outQuad, () => { FX.ghost = false; });
  }
  if (had) popShots(E);
}

// The Retry button: a circular arrow and the word on a raised slate pill, so it reads as a button whenever the ball rests.
function retryButton(ctx, E, cx, cy, o) {
  const R = A.retry, x = cx - o.w / 2, y = cy - o.h / 2, ix = x + R.pad + R.icon;
  E.roundRect(x, y, o.w, o.h, A.line.button, o.fill, o.edge);
  ctx.strokeStyle = o.color; ctx.fillStyle = o.color; ctx.lineWidth = R.iconW; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(ix, cy, R.icon, -0.35 * Math.PI, 1.35 * Math.PI); ctx.stroke();
  const ax = ix + R.icon * Math.cos(-0.35 * Math.PI), ay = cy + R.icon * Math.sin(-0.35 * Math.PI); // arrowhead at the open end
  ctx.beginPath(); ctx.moveTo(ax + R.head, ay - R.head * 0.2); ctx.lineTo(ax - R.head * 0.35, ay - R.head); ctx.lineTo(ax - R.head * 0.2, ay + R.head * 0.55); ctx.closePath(); ctx.fill();
  E.text('Retry', ix + R.icon + R.gap, cy, o === BTN.retryOn ? TX.btnL : TX.btnOffL);
  return { x, y, w: o.w, h: o.h };
}

// The one line of tutorial: a plate near the top of the field on a fresh save's first hole, fading after hold seconds.
function drawHint(ctx, E, v, a) {
  const H = A.hint, lines = wrapText(ctx, `hint:${E.w}`, H.text, E.w - 2 * H.margin - 2 * H.pad), cx = E.w / 2, y = v.oy + T.designH * v.s * H.y;
  ctx.font = `600 ${TY.sm}px system-ui, sans-serif`;
  let w = 0; for (const ln of lines) w = Math.max(w, ctx.measureText(ln).width);
  w += 2 * H.pad; const h = lines.length * H.lineH + H.pad;
  ctx.globalAlpha = a; E.roundRect(cx - w / 2, y - h / 2, w, h, A.line.radius, P.bannerBg, P.slateLight); ctx.globalAlpha = 1;
  for (let i = 0; i < lines.length; i++) E.text(lines[i], cx, y - ((lines.length - 1) * H.lineH) / 2 + i * H.lineH, { size: TY.sm, color: P.text, alpha: a });
}

// Banner for boss holes: slides in, holds, slides out. Position from the tween's linear 0..1.
function drawBanner(ctx, E) {
  const tt = FX.banner * J.bannerTime, outAt = J.bannerTime - J.bannerOut;
  const off = tt < J.bannerIn ? -(1 - ease.outCubic(tt / J.bannerIn)) : tt > outAt ? ease.inQuad((tt - outAt) / J.bannerOut) : 0;
  const y = E.h * J.bannerY, h = J.bannerH, x = off * E.w;
  ctx.globalAlpha = 0.94; ctx.fillStyle = P.bannerBg; ctx.fillRect(x, y - h / 2, E.w, h);
  ctx.globalAlpha = 1; ctx.fillStyle = P.bossAccent;
  ctx.fillRect(x, y - h / 2, E.w, 3); ctx.fillRect(x, y + h / 2 - 3, E.w, 3);
  ctx.globalAlpha = 0.35; ctx.fillRect(x, y - h / 2 + 7, E.w, 1); ctx.fillRect(x, y + h / 2 - 8, E.w, 1); ctx.globalAlpha = 1;
  E.text('BOSS', x + E.w / 2, y - 8, TX.bossBig);
  E.text(S.lv.name, x + E.w / 2, y + 20, TX.smLight);
}

// ---------- Badges and skins on screen ----------

// A badge medal: its generated image (locked ones at 35 percent), or while that loads or if it fails, a dark disc ringed in its tier
// colour with the tier's icon (rock, crescent, ringed planet, star); dim when not earned. `id` is the badge; the tier headings pass none.
let NOW = 0; // the scene's clock, for the Black Hole tier's slow glow pulse
const tierPulse = () => { const g = A.tierGlow; return g.min + (g.max - g.min) * (0.5 + 0.5 * Math.sin(NOW * PI2 * g.rate)); };
function drawTierGlow(ctx, x, y, r) {
  const R = r * A.tierGlow.r;
  ctx.save(); ctx.translate(x, y); ctx.scale(R, R);
  ctx.globalAlpha = tierPulse(); ctx.fillStyle = G.tierGlow;
  ctx.beginPath(); ctx.arc(0, 0, 1, 0, PI2); ctx.fill();
  ctx.restore();
}
function drawMedal(ctx, x, y, r, tier, got, id) {
  const bd = id && badgeById(id), secret = !!(bd && bd.secret && !got);
  if (tier === 4 && (got || secret)) drawTierGlow(ctx, x, y, r);
  if (secret) { // a dark disc in the tier's rim with a '?'
    ctx.save();
    ctx.fillStyle = tier === 4 ? P.bhTierRim : P.tileLocked; ctx.beginPath(); ctx.arc(x, y, r, 0, PI2); ctx.fill();
    ctx.strokeStyle = P.tiers[tier]; ctx.lineWidth = A.line.edge; ctx.stroke();
    ctx.fillStyle = P.tiers[tier]; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `${TY.heavy} ${Math.round(r * A.secret.mark)}px system-ui, sans-serif`;
    ctx.fillText('?', x, y + 1);
    ctx.restore();
    return;
  }
  const m = id && ART.medals.get(id);
  if (m && m.ok) { ctx.globalAlpha = got ? 1 : RT.ladder.lockedMedal; ctx.drawImage(m.img, x - r, y - r, 2 * r, 2 * r); ctx.globalAlpha = 1; return; }
  const col = got ? P.tiers[tier] : P.starOff;
  ctx.fillStyle = got ? (tier === 4 ? P.bhTierRim : P.card) : P.tileLocked; ctx.beginPath(); ctx.arc(x, y, r, 0, PI2); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = A.line.edge; ctx.stroke();
  ctx.globalAlpha = got ? 1 : 0.7; ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = A.line.hair;
  const q = r * 0.5;
  if (tier === 0) {
    ctx.beginPath(); ctx.arc(x, y, q, 0, PI2); ctx.fill();
    ctx.fillStyle = got ? P.card : P.tileLocked; ctx.beginPath(); ctx.arc(x - q * 0.3, y - q * 0.25, q * 0.28, 0, PI2); ctx.arc(x + q * 0.35, y + q * 0.3, q * 0.2, 0, PI2); ctx.fill();
  } else if (tier === 1) {
    ctx.beginPath(); ctx.arc(x, y, q, 0, PI2); ctx.arc(x + q * 0.45, y - q * 0.2, q * 0.85, 0, PI2); ctx.fill('evenodd');
  } else if (tier === 2) {
    ctx.beginPath(); ctx.arc(x, y, q * 0.72, 0, PI2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, y, q * 1.3, q * 0.4, -0.35, 0, PI2); ctx.stroke();
  } else if (tier === 3) drawStar(ctx, x, y, q * 1.15, col);
  else { // Black Hole: a dark core inside a tilted accretion ring
    ctx.fillStyle = got ? P.space : P.tileLocked; ctx.beginPath(); ctx.arc(x, y, q * 0.68, 0, PI2); ctx.fill(); ctx.stroke();
    ctx.lineWidth = A.line.edge; ctx.beginPath(); ctx.ellipse(x, y, q * 1.45, q * 0.45, -0.35, 0, PI2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// The ticket for a badge just earned: the medal, the tier and name, and the skins it unlocks drawn at the right end.
function drawTicket(ctx, E, b, k, y, more) {
  const TK = A.ticket, w = Math.min(TK.w, E.w - 40), x = (E.w - w) / 2, cx = E.w / 2, skins = skinsOf(b.id);
  ctx.save(); ctx.translate(cx, y); ctx.scale(k, k); ctx.translate(-cx, -y);
  if (b.tier === 4) { ctx.globalAlpha = tierPulse(); const hw = A.tierGlow.halo; E.roundRect(x - hw, y - TK.h / 2 - hw, w + 2 * hw, TK.h + 2 * hw, TK.r + hw, null, P.tiers[4]); ctx.globalAlpha = 1; }
  E.roundRect(x, y - TK.h / 2, w, TK.h, TK.r, P.bannerBg, P.tiers[b.tier]);
  drawMedal(ctx, x + 12 + TK.medalR, y, TK.medalR, b.tier, true, b.id);
  const tx0 = x + 24 + 2 * TK.medalR;
  E.text(more > 0 ? `${TIER_LABEL[b.tier]}  +${more} more` : TIER_LABEL[b.tier], tx0, y - 11, TX.tier[b.tier]);
  E.text(b.name, tx0, y + 10, TX.valueL);
  const ball = skins.find((s) => SKINS.balls.includes(s)), trail = SKINS.trails.find((s) => s.badge === b.id);
  if (skins.length) drawSkinSample(ctx, x + w - 24, y, 9, ball || null, trail, 0.6);
  ctx.restore();
}
const TIER_LABEL = BADGE_TIERS.map((n) => `${n.toUpperCase()} BADGE`);

// ---------- Scenes ----------

const menu = {
  titleBox: { x: 0, y: 0, w: 0, h: 0 },
  enter(E) {
    this.btnPlay = null; this.btnMute = null; this.btnMissions = null; this.btnRank = null; this.tiles = []; this.pop = CHANGED; CHANGED = null; this.t = 0; applySkins(E);
    RK.on = false;
    this.vet = rankFor(progress(E).total) > E.save.get('rankSeen', 1); // a rank whose card has not shown yet (a veteran's first boot): one card, never a cascade
  },
  update(dt, E) {
    if (this.pop) this.t += dt;
    this.clock = (this.clock || 0) + dt;
    if (this.vet && this.clock >= RT.card.menuDelay) {
      this.vet = false;
      const to = rankFor(progress(E).total);
      rankUpStart(E, Math.max(E.save.get('rankSeen', 1), to - 1), to, 'menu');
    }
    rankUpUpdate(dt, E);
  },
  render(ctx, E) {
    const v = coverView(E), p = progress(E), cx = E.w / 2, tl = A.tile, M = A.menu;
    ctx.save(); ctx.translate(v.ox, v.oy); ctx.scale(v.s, v.s); drawField(ctx, 'menu', 0, 0, 0, E.time); ctx.restore();
    const ty = Math.max(E.h * 0.09, E.safe.top + M.tabBottom + M.titleGap); // below the engine's TUNE tab on a notched phone
    const MR = RT.menu, titleW = Math.min(MR.titleW, E.w - 2 * MR.margin), titleH = titleW * MR.titleAspect;
    if (ART.title.ok) ctx.drawImage(ART.title.img, cx - titleW / 2, ty - titleH / 2, titleW, titleH);
    else E.text('GRAVITY GOLF', cx, ty, TX.big);
    const TA = this.titleBox; // release: five taps on the title open TUNE (ADR-0016)
    TA.x = cx - titleW / 2; TA.y = ty - titleH / 2; TA.w = titleW; TA.h = titleH; E.titleArea = TA; // clear of the EXPORT tab's corner
    this.drawRank(ctx, E, p, ty + titleH / 2 + MR.titleGap);

    const m = 16, gap = T.tileGap, cols = T.gridCols;
    const tw = (E.w - 2 * m - (cols - 1) * gap) / cols, th = T.tileH, top = ty + titleH / 2 + MR.titleGap + MR.cardH + MR.gridGap;
    this.tiles = [];
    LEVELS.forEach((lv, i) => {
      const x = m + (i % cols) * (tw + gap), y = top + Math.floor(i / cols) * (th + gap), tcx = x + tw / 2;
      const locked = i > p.unlocked, cleared = p.best[i] !== undefined;
      // Only the tile whose stars just went up pops.
      const pop = this.pop && this.pop.hole === i ? this.pop : null;
      const ts = pop ? lerp(J.menuPopFrom, 1, ease.outBack(clamp(this.t / J.menuPopTime, 0, 1))) : 1;
      if (ts !== 1) { ctx.save(); ctx.translate(tcx, y + th / 2); ctx.scale(ts, ts); ctx.translate(-tcx, -(y + th / 2)); }
      const three = !locked && p.stars[i] >= 3; // a three-starred tile also shows the fourth-star slot (PRD v0.9)
      E.roundRect(x, y, tw, th, A.line.radius, locked ? P.tileLocked : P.tile, cleared ? P.green : locked ? P.tileLockedEdge : lv.boss ? P.bossAccent : P.slate);
      E.text(`${i + 1}`, tcx, y + tl.number, locked ? TX.tileNumOff : TX.tileNum);
      if (locked) {
        ctx.fillStyle = P.tileLockedEdge; ctx.beginPath(); ctx.arc(tcx, y + tl.icon, tl.iconR + 2, 0, PI2); ctx.fill();
        drawLock(ctx, tcx, y + tl.icon + 1);
      } else {
        drawBadge(ctx, lv, tcx, y + tl.icon, E.time);
        const BL = T.blind, sy0 = y + th - tl.stars;
        for (let s = 0; s < 3; s++) {
          const sx = three ? tcx + (s - 1.5) * BL.tileStep : tcx + (s - 1) * 15, sy = sy0, earned = s < p.stars[i];
          const k = pop && earned && s >= pop.from ? ease.outBack(clamp((this.t - J.menuStarDelay - (s - pop.from) * J.menuStarStagger) / J.menuStarPop, 0, 1)) : 1;
          if (!earned || k < 1) drawStar(ctx, sx, sy, tl.starR, null, P.starOff);
          if (earned && k > 0) drawStar(ctx, sx, sy, tl.starR * k, P.green);
        }
        if (three) {
          const k = pop && pop.blind ? ease.outBack(clamp((this.t - J.menuStarDelay) / J.menuStarPop, 0, 1)) : 1, got = !!p.blind[i];
          drawCometStar(ctx, tcx + 1.5 * BL.tileStep, sy0, BL.starR * (got ? k : 1), got && k > 0);
        }
      }
      if (ts !== 1) ctx.restore();
      this.tiles.push({ x, y, w: tw, h: th, hole: i, locked });
    });

    const rows = Math.ceil(LEVELS.length / cols), py = Math.max(E.h * 0.58, top + rows * (th + gap) + 8 + BTN.primary.h / 2); // below the grid at any hole count
    this.btnPlay = pill(E, p.total > 0 || p.unlocked > 0 ? `Play hole ${p.unlocked + 1}` : 'Play', cx, py, BTN.primary);
    const hx = (M.missionsW + M.rowGap) / 2;
    this.btnMissions = pill(E, 'Missions', cx - hx, py + 84, BTN.half);
    this.btnMute = pill(E, E.audio.muted ? 'Sound: off' : 'Sound: on', cx + hx, py + 84, BTN.half);
    if (RK.on) drawRankUp(ctx, E);
  },
  // The menu's one headline (principle 11): the rank's emblem and name, one progress line and a thin bar. Tapping it opens the ladder.
  drawRank(ctx, E, p, y) {
    const MR = RT.menu, info = rankInfo(p), r = RANKS[info.rank - 1], x = MR.margin, w = E.w - 2 * x, tx0 = x + MR.pad + MR.emblem + MR.pad;
    E.roundRect(x, y, w, MR.cardH, A.line.radius, P.tile, r.col);
    drawEmblem(ctx, info.rank, x + MR.pad + MR.emblem / 2, y + MR.cardH / 2, MR.emblem);
    const bw = x + w - MR.pad - MR.chevron * 3 - tx0, line = menuLine(info); // the text and the bar stop short of the chevron; a long name or line steps down in size to fit
    E.text(r.name, tx0, y + MR.nameY, { ...TX.bigL, size: fitSize(ctx, r.name, TY.heavy, TY.lg, MR.nameMin, bw) });
    E.text(line, tx0, y + MR.lineY, { ...TX.goalMdL, size: fitSize(ctx, line, 600, TY.md, MR.lineMin, bw) });
    E.roundRect(tx0, y + MR.barY, bw, MR.barH, MR.barH / 2, P.slateDeep);
    if (info.frac > 0) E.roundRect(tx0, y + MR.barY, Math.max(MR.barH, bw * clamp(info.frac, 0, 1)), MR.barH, MR.barH / 2, P.green);
    const cx = x + w - MR.pad - MR.chevron, cy = y + MR.cardH / 2; // a chevron: this opens something
    ctx.strokeStyle = P.textDim; ctx.lineWidth = A.line.edge; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(cx - MR.chevron / 2, cy - MR.chevron); ctx.lineTo(cx + MR.chevron / 2, cy); ctx.lineTo(cx - MR.chevron / 2, cy + MR.chevron); ctx.stroke();
    ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
    this.btnRank = { x, y, w, h: MR.cardH };
  },
  onTap(p, E) {
    if (rankUpTap()) return;
    if (this.btnRank && E.hit(this.btnRank, p)) { E.audio.play('tap'); E.setScene('missions', { ladder: true }); return; }
    if (E.hit(this.btnPlay, p)) { E.setScene('play', { hole: progress(E).unlocked }); return; }
    if (E.hit(this.btnMissions, p)) { E.audio.play('tap'); E.setScene('missions'); return; }
    if (E.hit(this.btnMute, p)) { E.audio.toggleMute(); return; }
    for (const t of this.tiles) if (!t.locked && E.hit(t, p)) { E.setScene('play', { hole: t.hole }); return; }
  },
};

// The missions screen: the Skins block (ball and trail swatches) and the badges by tier, lit when earned, with their
// condition either way. The list scrolls between the heading and the Back button.
const WRAP = new Map(); // badge condition lines per width, measured once
function wrapText(ctx, key, text, width) {
  let lines = WRAP.get(key);
  if (!lines) {
    ctx.font = `600 ${TY.sm}px system-ui, sans-serif`;
    lines = [];
    let line = '';
    for (const word of text.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > width) { lines.push(line); line = word; } else line = next;
    }
    if (line) lines.push(line);
    const n = lines.length; // no one-word last line: bring the word before it down
    if (n > 1 && !lines[n - 1].includes(' ') && lines[n - 2].includes(' ')) { const k = lines[n - 2].lastIndexOf(' '); lines[n - 1] = `${lines[n - 2].slice(k + 1)} ${lines[n - 1]}`; lines[n - 2] = lines[n - 2].slice(0, k); }
    WRAP.set(key, lines);
  }
  return lines;
}

const missions = {
  enter(E, params) {
    this.drag = null; this.btnBack = null; this.swatches = []; this.listH = BADGES.length * (A.missions.rowH + A.missions.rowGap); applySkins(E);
    const L = RT.ladder; this.ladderH = A.missions.headH + 2 * A.missions.lineH + L.headGap + RANKS.length * (L.rowH + L.rowGap) + L.dividerH + L.tail; // measured by the render
    this.scroll = 0; this.focus = params && params.ladder ? 'ladder' : 'badges'; // from the menu's rank card the ladder shows at your rank; from Missions it opens on the skins and badges, the ladder above
  },
  skinsH() {
    const M = A.missions, W = A.swatch, rows = (n) => Math.ceil(n / W.perRow) * (W.size + W.rowGap);
    return M.headH + 2 * W.headH + rows(SKINS.balls.length) + rows(SKINS.trails.length) + 6;
  },
  area(E) {
    const M = A.missions, top = E.safe.top + M.top, bot = E.h - E.safe.bottom - M.bottom;
    const content = this.ladderH + this.skinsH() + BADGE_TIERS.length * M.headH + this.listH; // ladderH and listH are measured by the last render
    return { top, bot, max: Math.max(0, content - (bot - top)) };
  },
  render(ctx, E) {
    NOW = E.time;
    const M = A.missions, p = progress(E), m = M.margin, w = E.w - 2 * m, v = coverView(E), info = rankInfo(p), L = RT.ladder;
    const lines = info.next ? wrapText(ctx, `rank:${w}:${ladderLine(info)}`, ladderLine(info), w - 2 * L.pad - L.emblem - L.pad) : [], ex = lines.length ? lines.length * M.lineH + L.lineGap : 0; // the next rank's row carries the progress line
    const step = L.rowH + L.rowGap, far = firstFar(), head = M.headH + L.headGap;
    this.ladderH = head + RANKS.length * step + ex + (far >= 0 ? L.dividerH : 0) + L.tail;
    const V = this.area(E), rowTop = (i) => head + i * step + (info.next && i >= info.next ? ex : 0) + (far >= 0 && i >= far ? L.dividerH : 0);
    if (this.focus) { // once, on the first frame: the ladder with your rank in view, or past it to the skins
      this.scroll = this.focus === 'ladder' ? (info.rank > 2 ? rowTop(info.rank - 2) - 4 : 0) : this.ladderH;
      this.focus = null;
    }
    ctx.save(); ctx.translate(v.ox, v.oy); ctx.scale(v.s, v.s); drawField(ctx, 'menu', 0, 0, 0, E.time); ctx.restore();
    E.text('Missions', m, E.safe.top + 32, TX.bigL);
    E.text(`${BADGES.filter((b) => p.badges[b.id]).length} / ${BADGES.length}`, E.w - m, E.safe.top + 32, TX.valueGoalR);
    this.scroll = clamp(this.scroll, 0, V.max);
    ctx.save(); ctx.beginPath(); ctx.rect(0, V.top, E.w, V.bot - V.top); ctx.clip();
    let y = this.drawSkins(ctx, E, p, this.drawLadder(ctx, E, p, info, lines, ex, rowTop, V.top - this.scroll, V, m), V, m), listH = 0;
    BADGE_TIERS.forEach((name, tier) => {
      const inTier = BADGES.filter((b) => b.tier === tier);
      drawMedal(ctx, m + 8, y + M.headH / 2, 8, tier, true);
      E.text(`${name.toUpperCase()}   ${inTier.filter((b) => p.badges[b.id]).length} / ${inTier.length}`, m + 24, y + M.headH / 2, TX.tier[tier]);
      y += M.headH;
      for (const b of inTier) {
        const got = !!p.badges[b.id], hidden = !!b.secret && !got; // a secret badge shows only its tier until it is earned
        const tx0 = m + 24 + 2 * M.medalR, tw = w - (tx0 - m) - 12, prog = hidden ? '' : badgeProgress(b, p, p.prog);
        const lines = wrapText(ctx, `${b.id}:${w}:${hidden}`, hidden ? A.secret.text : badgeText(b), tw), plines = wrapText(ctx, `${b.id}:${w}:${prog}`, prog, tw);
        const h = M.rowH + (lines.length + plines.length - 1) * M.lineH;
        if (y + h > V.top && y < V.bot) {
          if (got && tier === 4) { ctx.globalAlpha = tierPulse(); E.roundRect(m - 2, y - 2, w + 4, h + 4, A.line.radius + 2, null, P.tiers[tier]); ctx.globalAlpha = 1; }
          E.roundRect(m, y, w, h, A.line.radius, got ? P.tile : P.tileLocked, got || hidden ? P.tiers[tier] : P.tileLockedEdge);
          drawMedal(ctx, m + 12 + M.medalR, y + h / 2, M.medalR, tier, got, b.id);
          E.text(hidden ? A.secret.name : b.name, tx0, y + 19, got ? TX.valueL : TX.offL);
          for (let i = 0; i < lines.length; i++) E.text(lines[i], tx0, y + 39 + i * M.lineH, got ? TX.labelL : TX.dimL);
          for (let i = 0; i < plines.length; i++) E.text(plines[i], tx0, y + 39 + (lines.length + i) * M.lineH, got ? TX.goalL : TX.progL);
        }
        y += h + M.rowGap; listH += h + M.rowGap;
      }
    });
    this.listH = listH;
    ctx.restore();
    if (V.max > 0) { // a thin scroll bar
      const tr = V.bot - V.top, bh = Math.max(24, (tr * tr) / (tr + V.max));
      E.roundRect(E.w - 6, V.top + (tr - bh) * (this.scroll / V.max), M.scrollBar, bh, 1.5, P.slate);
    }
    this.btnBack = pill(E, 'Back', E.w / 2, E.h - E.safe.bottom - M.toastBand - M.backH / 2, BTN.back);
  },
  // The rank ladder (PRD v0.6 B): a heading with the star total and the progress line, then a row per rank. Ranks reached show in full colour
  // with their name and star count (your own ringed in its colour), the next is tagged, the ones after are dark silhouettes with only their
  // star count, and one small line marks where today's holes run out.
  drawLadder(ctx, E, p, info, lines, ex, rowTop, y, V, m) {
    const M = A.missions, L = RT.ladder, w = E.w - 2 * m, far = firstFar(), y0 = y;
    E.text('RANKS', m, y + M.headH / 2, TX.labelL);
    E.text(starWord(p.total), E.w - m, y + M.headH / 2, TX.valueGoalR);
    RANKS.forEach((r, i) => {
      const rank = i + 1, ry = y0 + rowTop(i), cy = ry + L.rowH / 2;
      if (far === i) E.text('more holes coming', E.w / 2, ry - L.dividerH / 2 - L.rowGap / 2 + 2, TX.sm);
      if (ry + (rank === info.next ? L.rowH + ex : L.rowH) < V.top || ry > V.bot) return;
      const reached = rank <= info.rank, next = rank === info.next, tx0 = m + L.pad + L.emblem + L.pad, rh = next ? L.rowH + ex : L.rowH;
      E.roundRect(m, ry, w, rh, A.line.radius, reached ? P.tile : P.tileLocked, rank === info.rank ? r.col : reached ? P.slate : next ? P.amber : P.tileLockedEdge);
      drawEmblem(ctx, rank, m + L.pad + L.emblem / 2, cy, L.emblem, !reached && !next);
      const count = starWord(rankNeed(rank));
      if (!reached && !next) E.text(count, tx0, cy, TX.offL);
      else {
        E.text(r.name, tx0, cy, TX.valueL);
        if (next) {
          E.text('NEXT', E.w - m - L.pad, cy, TX.amberR);
          for (let j = 0; j < lines.length; j++) E.text(lines[j], tx0, ry + L.rowH - L.lineGap + M.lineH / 2 + j * M.lineH, TX.progL);
        } else E.text(count, E.w - m - L.pad, cy, TX.labelR);
      }
    });
    return y0 + this.ladderH;
  },
  // Ball swatches then trail swatches. An owned swatch picks it (ringed when chosen); a locked one shows a lock and toasts its badge.
  drawSkins(ctx, E, p, y, V, m) {
    const M = A.missions, W = A.swatch, rowW = W.perRow * W.size + (W.perRow - 1) * W.gap, x0 = (E.w - rowW) / 2;
    this.swatches.length = 0;
    E.text('SKINS', m, y + M.headH / 2, TX.labelL);
    y += M.headH;
    for (const kind of ['ball', 'trail']) {
      const list = kind === 'ball' ? SKINS.balls : SKINS.trails, cur = kind === 'ball' ? SK.ball : SK.trail;
      E.text(kind === 'ball' ? 'BALL' : 'TRAIL', x0, y + W.headH / 2, TX.dimL);
      E.text(cur.name, x0 + rowW, y + W.headH / 2, TX.labelR);
      y += W.headH;
      list.forEach((s, i) => {
        const x = x0 + (i % W.perRow) * (W.size + W.gap), sy = y + Math.floor(i / W.perRow) * (W.size + W.rowGap);
        const owned = skinOwned(s, p.badges), cx = x + W.size / 2, cy = sy + W.size / 2;
        if (sy + W.size < V.top || sy > V.bot) return;
        E.roundRect(x, sy, W.size, W.size, A.line.radius, owned ? P.tile : P.tileLocked, owned ? P.slate : P.tileLockedEdge);
        if (s === cur) E.roundRect(x - 3, sy - 3, W.size + 6, W.size + 6, A.line.radius + 3, null, P.text);
        ctx.globalAlpha = owned ? 1 : 0.35;
        if (kind === 'ball') drawBall(ctx, cx, cy, W.ballR, owned ? 1 : 0.35, 0.5, s);
        else drawSkinSample(ctx, cx + 9, cy, 6, SK.ball, s, 0);
        ctx.globalAlpha = 1;
        if (!owned) drawLock(ctx, cx, cy + 4);
        this.swatches.push({ x, y: sy, w: W.size, h: W.size, s, kind, owned });
      });
      y += Math.ceil(list.length / W.perRow) * (W.size + W.rowGap);
    }
    return y + 6;
  },
  onPointerDown(p) { this.drag = { y: p.y, scroll: this.scroll }; },
  onPointerMove(p, E) { if (this.drag) this.scroll = clamp(this.drag.scroll - (p.y - this.drag.y), 0, this.area(E).max); },
  onPointerUp() { this.drag = null; },
  onTap(p, E) {
    if (E.hit(this.btnBack, p)) { E.audio.play('tap'); E.setScene('menu'); return; }
    const V = this.area(E), sw = p.y >= V.top && p.y <= V.bot && this.swatches.find((s) => E.hit(s, p));
    if (!sw) return;
    if (!sw.owned) { E.toast(`${sw.s.name} ${sw.kind}: earn the ${BADGES.find((b) => b.id === sw.s.badge).name} badge`); return; }
    if ((sw.kind === 'ball' ? SK.ball : SK.trail) !== sw.s) E.ledger.add('skin', { kind: sw.kind, id: sw.s.id });
    E.save.set('skin', { ...E.save.get('skin', {}), [sw.kind]: sw.s.id });
    applySkins(E); E.audio.play('tap');
  },
};

// Launch, with the release juice. Both the touch and the keyboard fallback go through here.
function shoot(E, l) {
  launch(l); releaseFx(E);
  if (FX.hint === 1) { FX.hint = 2; FX.hintT = 0; E.save.set('hintSeen', true); } // the first release: the hint fades and never comes back
}

const play = {
  enter(E, params) {
    const idx = clamp((params && params.hole) || 0, 0, LEVELS.length - 1);
    const goOn = !!(params && params.run && RUN.on && RUN.next === idx); // Next, or the card's Retry, carries a run on
    if (!goOn) endRun(E, false);
    if (idx === 0 && !goOn) { RUN.on = true; RUN.next = 0; RUN.strokes = 0; RUN.landed = false; RUN.landedOn = -1; } // hole 1 starts a full run
    applySkins(E);
    loadHole(idx);
    S.blind = !!(params && params.blind) && E.save.get('stars', {})[idx] >= 3; // only a three-starred hole can be tried blind
    resetFx();
    FX.hint = E.save.get('hintSeen', false) ? 0 : 1; // a fresh save: the hint stays until the first release
    FX.hintT = 0; FX.further = 1;
    FX.banner = 1; FX.bannerTok = null;
    if (S.lv.boss) {
      const tok = FX.bannerTok = {};
      FX.banner = 0;
      E.tween(J.bannerTime, (k) => { if (FX.bannerTok === tok) FX.banner = k; }, ease.linear);
    }
  },

  update(dt, E) {
    fxUpdate(dt);
    S.time += dt; FX.hintT += dt; if (FX.further < 1) FX.further = Math.min(1, FX.further + dt / A.further.time);
    if (S.phase === 'aim') { S.clock += dt; carry(S.lv, S.ball, S.clock); return; }
    if (S.phase === 'sink') {
      S.sinkT += dt;
      if (S.sinkT >= T.sinkTime) finishHole(E);
      return;
    }
    if (S.phase === 'swallow') {
      S.swT += dt;
      if (S.swT >= J.swallowTime) { returnToLastRest(); returnFx(E); }
      return;
    }
    // Fixed-step accumulator: outcomes depend on the drag and the release clock, never on the frame rate.
    S.acc += dt;
    while (S.acc >= STEP && S.phase === 'fly') {
      S.acc -= STEP; S.steps++;
      const b = S.ball, hitsBefore = b.hits, sunsBefore = b.sunHits, cometsBefore = b.cometHits, pvx = b.vx, pvy = b.vy, clk = S.clock0 + S.steps * STEP;
      watchPre(S.lv, b, clk);
      let r = stepBall(S.lv, b, clk);
      watchPost(b);
      if (b.hits !== hitsBefore) { bounceFx(E, pvx, pvy); S.kzLeft = kesslerMark(S.lv, b, S.kz); }
      if (FW.top >= T.badges.relSpeed && !(FW.got & 1)) { FW.got |= 1; earn(E, 'relativistic'); }
      if (FW.top >= T.badges.ftlSpeed && !(FW.got & 2)) { FW.got |= 2; earn(E, 'ftl'); }
      if (b.cometHits !== cometsBefore) cometFx(E);
      if (b.sunHits !== sunsBefore) { S.strokes += T.sunPenalty * (b.sunHits - sunsBefore); sunFx(E, b.sunLast); }
      if (S.steps % J.trailEvery === 0) {
        ghostRecord(b.x, b.y);
        if (Math.hypot(b.vx, b.vy) < A.trail.minSpeed) trailDrop();
        else trailPush(b.x, b.y, SK.trail.badge || !planetNear(S.lv, b, S.clock0 + S.steps * STEP) ? SK.trail.col : planetColor(S.lv)); // a chosen trail keeps its colour
      }
      if (!r && S.steps * STEP >= T.maxFlightSeconds) r = 'rest';
      if (r === 'sink') { sinkFlags(b); S.phase = 'sink'; S.sinkT = 0; S.sinkFrom = { x: b.x, y: b.y }; sinkFx(E); }
      else if (r === 'swallow') {
        S.phase = 'swallow'; S.swT = 0; S.swX = b.x; S.swY = b.y; S.swBh = b.bh;
        S.strokes += T.bhPenalty; S.swallows++; swallowFx(E, b.bh);
      } else if (r === 'rest') {
        const lag = !b.touch && !b.land && b.moon < 0 && b.on < 0 && Math.hypot(b.vx, b.vy) < T.stopSpeed && lagrangeAt(S.lv, b, clk);
        const broke = !RUN.landed; comeToRest(); restFx(E); restNotes(E, broke && RUN.landed);
        if (lag) earn(E, 'lagrange-point');
      }
    }
  },

  render(ctx, E) {
    const v = view(E), lv = S.lv, b = S.ball, clock = partClock(), t = E.time, mv = lv.movers;
    ctx.save();
    ctx.translate(v.ox, v.oy); ctx.scale(v.s, v.s);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, T.designW, T.designH); ctx.clip();
    drawField(ctx, FX.skyKey, sectorOf(S.idx), (b.x / T.designW - 0.5) * 2, (b.y / T.designH - 0.5) * 2, t);
    for (let i = 0; i < mv.length; i++) {
      const m = mv[i];
      if (m.type === 'moon') {
        const p = lv.planets[m.parent];
        ctx.setLineDash(ORBIT_DASH); drawRing(ctx, p.x, p.y, m.orbitR, A.line.hair, planetColor(lv), J.orbitAlpha); ctx.setLineDash(NO_DASH);
      } else if (m.type === 'slide') drawRail(ctx, m);
      else if (m.type === 'comet') drawCometPath(ctx, m);
    }
    for (let i = 0; i < lv.blackholes.length; i++) drawBlackHole(ctx, lv.blackholes[i], t, FX.bhFlare[i]);
    for (let i = 0; i < lv.suns.length; i++) { const s = lv.suns[i]; drawSun(ctx, s.x, s.y, s.r, FX.flare[i], t, sunReach(s)); }
    for (let i = 0; i < lv.planets.length; i++) { const p = lv.planets[i]; drawPlanet(ctx, p.x, p.y, p.r, p, p.mass, lv.boss, FX.ring[i]); }
    for (let i = 0; i < lv.walls.length; i++) drawWall(ctx, lv.walls[i]);
    for (let i = 0; i < mv.length; i++) {
      const m = mv[i];
      if (m.type === 'slide') drawWall(ctx, slideAt(m, clock));
      else if (m.type === 'bar') drawBar(ctx, m, clock);
      else if (m.type === 'moon') { const c = moonAt(lv, m, clock); drawPlanet(ctx, c.x, c.y, m.r, m, m.mass, lv.boss); }
    }

    drawCup(ctx, lv.hole.x, lv.hole.y, FX.cup, t);
    if (FX.sink < 1) drawRing(ctx, lv.hole.x, lv.hole.y, T.holeR + J.sinkRingR * FX.sink, 4, P.green, 1 - FX.sink);

    if (S.phase === 'aim' && !S.blind) drawGhost(ctx);
    drawTrail(ctx, b.x, b.y);

    const aiming = S.phase === 'aim' ? currentLaunch() : null;
    if (aiming && S.blind) { // a blind try draws the direction only: no dots, no power gauge, no glow growth
      FX.power = 0;
      drawPointer(ctx, E, v, b, aiming);
    } else if (aiming) {
      FX.power = aiming.power;
      const seconds = S.idx < T.previewFullHoles ? T.previewFullSeconds : T.previewShortSeconds;
      const n = previewPoints(lv, b, aiming, S.clock, seconds);
      drawRange(ctx, b, aiming, n, Math.floor(Math.round(seconds / STEP) / Math.round(T.previewDotEvery / STEP)), flightEntersRing(lv, b, aiming, S.clock));
    }

    for (let i = 0; i < mv.length; i++) if (mv[i].type === 'comet') drawComet(ctx, mv[i], clock);

    let bx = b.x, by = b.y, br = T.ballR, ba = 1;
    if (S.phase === 'sink') {
      const k = clamp(S.sinkT / T.sinkTime, 0, 1);
      bx = lerp(S.sinkFrom.x, lv.hole.x, k); by = lerp(S.sinkFrom.y, lv.hole.y, k); br = T.ballR * (1 - k);
    } else if (S.phase === 'swallow') { // spiral in with the swirl, shrinking to nothing at the centre
      const h = lv.blackholes[S.swBh], k = clamp(S.swT / J.swallowTime, 0, 1), d = dist(S.swX, S.swY, h.x, h.y) * (1 - ease.inQuad(k));
      const a = Math.atan2(S.swY - h.y, S.swX - h.x) + J.swallowTurns * PI2 * k;
      bx = h.x + Math.cos(a) * d; by = h.y + Math.sin(a) * d; br = T.ballR * (1 - k); ba = 1 - 0.4 * k;
    } else {
      br = T.ballR * FX.pop; ba = FX.retry;
      if (FX.glow > 0.01) drawGlow(ctx, bx, by, T.ballR + J.glowR + J.glowRPower * FX.power, FX.glow * J.glowAlpha);
    }
    if (FX.ghost && FX.retry < 1) drawBall(ctx, FX.gx, FX.gy, T.ballR, 1 - FX.retry, FX.spin);
    if (br > 0.1) drawBall(ctx, bx, by, br, ba, FX.spin);
    if (FX.flash < 1) {
      drawGlow(ctx, bx, by, T.ballR * (1.8 + FX.flash), 1 - FX.flash);
      drawRing(ctx, bx, by, T.ballR * (1 + (J.flashRing - 1) * FX.flash), 3 * (1 - FX.flash) + 0.5, P.white, 1 - FX.flash);
    }
    if (FX.rest < 1) drawRing(ctx, bx, by, T.ballR * (1 + (J.restPulseR - 1) * FX.rest), 3, P.restPulse, 0.8 * (1 - FX.rest));
    ctx.restore();
    drawBorder(ctx);
    ctx.restore();
    if (FX.further < 1) E.text(A.further.text, v.ox + b.x * v.s, v.oy + (b.y - A.further.dy) * v.s, { size: TY.md, color: P.amber, alpha: 1 - ease.inQuad(FX.further) });

    // HUD: three small stacks, a dim label over a value, in the three-size scale.
    const top = E.safe.top + 26;
    if (FX.hudN !== S.strokes) { FX.hudN = S.strokes; FX.hudShots = `${S.strokes}`; }
    E.text('SHOTS', 16, top - 9, TX.label);
    ctx.save(); ctx.translate(16, top + 10); ctx.scale(FX.shots, FX.shots);
    E.text(FX.hudShots, 0, 0, TX.valueL);
    ctx.restore();
    E.text(FX.hudHole, E.w / 2, top - 9, lv.boss ? TX.labelBoss : TX.labelC);
    E.text(lv.name, E.w / 2, top + 10, TX.valueC);
    E.text('PAR', E.w - 16, top - 9, TX.labelR);
    E.text(FX.hudPar, E.w - 16, top + 10, TX.valueGoalR);
    S.retryRect = retryButton(ctx, E, E.w - 16 - T.retryW / 2, E.safe.top + T.hudH + T.retryH / 2, S.phase === 'aim' ? BTN.retryOn : BTN.retryOff);
    if (S.blind) {
      const G = T.blind.tag, gy = E.safe.top + T.hudH + G.y;
      E.roundRect(E.w / 2 - G.w / 2, gy - G.h / 2, G.w, G.h, G.h / 2, P.slateDark, T.blind.col);
      E.text(T.blind.label, E.w / 2, gy, { size: TY.sm, color: T.blind.col });
    }
    if (RUN.on && RUN.next === S.idx && S.idx > 0) { // the full run's strokes so far and the live Never Landed mark, once hole 1 is finished (v0.5 A2)
      const n = RUN.strokes + S.strokes, ry = E.safe.top + T.hudH;
      if (FX.hudRunN !== n) { FX.hudRunN = n; FX.hudRun = `Run: ${n} ${n === 1 ? 'stroke' : 'strokes'}`; }
      E.text(FX.hudRun, 16, ry + A.hudRun.line1, TX.labelL);
      E.text(RUN.landed ? `landed on hole ${RUN.landedOn + 1}` : 'no landings yet', 16, ry + A.hudRun.line2, RUN.landed ? TX.dimL : TX.runClean);
    }
    if (FX.hint === 1) drawHint(ctx, E, v, 1);
    else if (FX.hint === 2 && FX.hintT < A.hint.fade) drawHint(ctx, E, v, 1 - FX.hintT / A.hint.fade);
    if (FX.banner < 1) drawBanner(ctx, E);
  },

  onPointerDown(p, E) {
    if (S.phase !== 'aim' || S.aim) return;
    if (S.retryRect && E.hit(S.retryRect, p)) return; // a touch on Retry never starts an aim
    S.aim = { id: p.id, sx: p.x, sy: p.y, x: p.x, y: p.y }; // anywhere, the ball included (v0.5: a press on the ball aims too)
    dragStartFx(E);
  },
  onTap(p, E) {
    if (S.phase === 'aim' && S.retryRect && E.hit(S.retryRect, p)) retry(E);
  },
  onPointerMove(p) {
    if (S.aim && S.aim.id === p.id) { S.aim.x = p.x; S.aim.y = p.y; }
  },
  onPointerUp(p, E) {
    if (!S.aim || S.aim.id !== p.id) return;
    if (p.cancelled) { S.aim = null; return; }
    S.aim.x = p.x; S.aim.y = p.y;
    const l = currentLaunch();
    if (l) shoot(E, l); else { S.aim = null; FX.further = 0; } // inside the dead zone: cancel, no stroke, and say so
  },
  // The app goes to the background mid-hole: the ledger notes it, since a tester who stops here has quit the hole.
  onPause(E) { if (S.strokes > 0 && S.phase !== 'sink') E.ledger.add('quit', { hole: S.idx + 1, strokes: S.strokes, time: S.time, run: RUN.on && RUN.next === S.idx }); },
  onKey(key, E) {
    if (S.phase !== 'aim') return;
    if (key === 'ArrowLeft') { S.key.on = true; S.key.angle -= T.keyAngleStep; }
    else if (key === 'ArrowRight') { S.key.on = true; S.key.angle += T.keyAngleStep; }
    else if (key === 'ArrowUp') { S.key.on = true; S.key.power = Math.min(1, S.key.power + T.keyPowerStep); }
    else if (key === 'ArrowDown') { S.key.on = true; S.key.power = Math.max(T.dragDead / T.dragMax, S.key.power - T.keyPowerStep); }
    else if (key === ' ') { S.key.on = true; const l = currentLaunch(); if (l) shoot(E, l); }
  },
};

// The card slides up, the shot count pops, each star pops in turn with a coin, and only after that beat do the
// buttons appear. Until then a tap does nothing, and neither does a press that started before the buttons existed.
const over = {
  enter(E, params) {
    const p = this.p = params;
    this.t = 0; this.t0 = E.time; this.slide = 0; this.ready = false; this.sky = `h${p.hole}`;
    this.starK = [0, 0, 0, 0]; this.starDone = [false, false, false, false];
    const n = p.stars + (p.fourthNew ? 1 : 0); // the fourth star pops after the three
    this.beat = J.starDelay + Math.max(0, n - 1) * J.starStagger + J.starPop * 0.6 + J.buttonGap;
    this.btnBlind = null; this.offer = p.has3 && !p.fourth; // the Expert button follows any finish (normal or Expert) of a three-starred hole, until its fourth star is won
    this.btnNext = null; this.btnMenu = null; this.btnRetry = null;
    this.badges = (p.badges || []).map(badgeById);
    this.badgeT = J.starDelay + Math.max(0, n - 1) * J.starStagger + J.starPop + J.badgeDelay; // the first badge pops after the stars
    this.badgeOn = -1;
    RK.on = false; this.rkAt = this.beat + RT.card.delay; // the rank-up card, if this hole crossed a rank, follows the usual card
    this.rkDone = !(p.rankUp && p.rankUp.to > E.save.get('rankSeen', 1));
    applySkins(E);
    E.tween(J.cardSlide, (k) => { this.slide = k; }, ease.outBack);
  },
  update(dt, E) {
    this.t += dt;
    const n = this.p.stars + (this.p.fourthNew ? 1 : 0);
    for (let i = 0; i < n; i++) {
      if (!this.starDone[i] && this.t >= J.starDelay + i * J.starStagger) {
        this.starDone[i] = true; E.audio.play('coin');
        E.tween(J.starPop, (k) => { this.starK[i] = k; }, ease.outBack);
        if (i === 3) E.haptic(T.blind.haptic);
      }
    }
    const bi = Math.min(this.badges.length - 1, Math.floor((this.t - this.badgeT) / J.badgeHold));
    if (this.t >= this.badgeT && bi > this.badgeOn) { this.badgeOn = bi; badgeSound(E, this.badges[bi].tier, 0.5); E.haptic(J.sinkHaptic); }
    this.ready = this.t >= this.beat;
    if (!this.rkDone && this.t >= this.rkAt) { this.rkDone = true; rankUpStart(E, this.p.rankUp.from, this.p.rankUp.to, 'card'); }
    rankUpUpdate(dt, E);
  },
  render(ctx, E) {
    NOW = E.time;
    const p = this.p, cx = E.w / 2, t = this.t, v = coverView(E);
    ctx.save(); ctx.translate(v.ox, v.oy); ctx.scale(v.s, v.s); drawField(ctx, this.sky, sectorOf(p.hole), 0, 0, E.time); ctx.restore();
    ctx.save(); ctx.translate(0, (1 - this.slide) * E.h * J.cardSlideFrac);
    const pw = Math.min(E.w - 32, 340), py = E.h * 0.085;
    E.roundRect(cx - pw / 2, py, pw, E.h * 0.68 + 80 + 44 - py + (this.offer ? T.blind.cardExtra : 0), A.line.card, P.card, p.boss ? P.bossAccent : P.slate);
    const tky = Math.max(py, E.safe.top + A.ticket.h / 2 + 4), ly = Math.max(E.h * 0.12, tky + A.ticket.h / 2 + 14), ny = Math.max(E.h * 0.16, ly + 28);
    if (p.boss) E.text('Boss', cx, ly, TX.bossMd); // the label and the name sit below the badge ticket's slot
    E.text(p.name, cx, ny, TX.dim);
    drawSkinSample(ctx, cx - pw / 2 + 36, ny, 8, SK.ball, SK.trail, t * 2);
    const nk = ease.outBack(clamp((t - J.numDelay) / J.numPop, 0, 1));
    ctx.save(); ctx.translate(cx, E.h * 0.24); ctx.scale(nk, nk);
    E.text(shots(p.strokes), 0, 0, TX.big);
    ctx.restore();
    E.text(`Par ${p.par}`, cx, E.h * 0.24 + 40, TX.dim);
    E.text(`3 stars: ${shots(p.three)}   2 stars: ${shots(p.par)}`, cx, E.h * 0.24 + 68, TX.sm);
    const BL = T.blind, four = p.has3 || p.blind; // a three-starred hole shows the fourth star's slot beside the three
    for (let i = 0; i < 3; i++) {
      const sx = cx + (four ? BL.cardStarsX[i] : (i - 1) * 64), sy = E.h * 0.24 + 120;
      drawStar(ctx, sx, sy, 26, null, P.starOff);
      if (i < p.stars && this.starDone[i]) drawStar(ctx, sx, sy, 26 * this.starK[i], P.green);
    }
    if (four) {
      const got = p.fourth && (!p.fourthNew || this.starDone[3]);
      drawCometStar(ctx, cx + BL.cardCometX, E.h * 0.24 + 120, BL.cardStarR * (p.fourthNew && got ? this.starK[3] : 1), got);
    }
    const line = p.fourthNew ? (p.strokes === 1 ? 'Hole in one' : T.blind.label) : p.stars === 3 ? (p.strokes === 1 ? 'Hole in one' : 'Under par') : '';
    if (line) E.text(line, cx, E.h * 0.24 + 178, { size: TY.md, color: P.green, alpha: clamp((t - J.starDelay - (p.stars - 1 + (p.fourthNew ? 1 : 0)) * J.starStagger) / J.lineFade, 0, 1) });
    E.text(`Best ${p.best}`, cx, E.h * 0.24 + 214, TX.dim);
    if (this.ready) {
      const bk = ease.outBack(clamp((t - this.beat) / J.buttonPop, 0, 1)), by = E.h * 0.68;
      ctx.save(); ctx.translate(cx, by); ctx.scale(bk, bk); ctx.translate(-cx, -by);
      this.btnNext = pill(E, p.hasNext ? 'Next' : 'Menu', cx, by, BTN.primary);
      ctx.restore();
      const hx = p.hasNext ? (BTN.secondCard.w + A.menu.rowGap) / 2 : 0; // Retry beside Menu (Retry alone when Menu is the main button)
      ctx.save(); ctx.translate(cx, by + 80); ctx.scale(bk, bk); ctx.translate(-cx, -(by + 80));
      this.btnRetry = pill(E, 'Retry', cx - hx, by + 80, BTN.secondCard);
      if (p.hasNext) this.btnMenu = pill(E, 'Menu', cx + hx, by + 80, BTN.secondCard);
      ctx.restore();
      if (this.offer) {
        const yb = by + BL.cardBtnY;
        ctx.save(); ctx.translate(cx, yb); ctx.scale(bk, bk); ctx.translate(-cx, -yb);
        this.btnBlind = pill(E, T.blind.label, cx, yb, BTN.blind);
        ctx.restore();
      }
    }
    if (this.badgeOn >= 0) { // the ticket straddles the card's top edge; each new badge takes the place of the one before
      const k = ease.outBack(clamp((t - this.badgeT - this.badgeOn * J.badgeHold) / J.badgePop, 0, 1));
      drawTicket(ctx, E, this.badges[this.badgeOn], k, tky, this.badges.length - 1 - this.badgeOn);
    }
    ctx.restore();
    if (RK.on) drawRankUp(ctx, E);
  },
  onTap(p, E) {
    if (rankUpTap()) return;
    if (!this.ready || !this.btnNext || p.startT < this.t0 + this.beat) return;
    if (E.hit(this.btnNext, p)) { if (!this.p.hasNext) endRun(E, false); E.setScene(this.p.hasNext ? 'play' : 'menu', { hole: this.p.hole + 1, run: true }); }
    else if (this.btnMenu && E.hit(this.btnMenu, p)) { endRun(E, false); E.setScene('menu'); }
    else if (this.btnRetry && E.hit(this.btnRetry, p)) this.again(E, this.p.blind, 'card'); // the hole again, blind if it was blind
    else if (this.btnBlind && E.hit(this.btnBlind, p)) this.again(E, true, 'blind');
  },
  // The hole again; a full run goes on, this attempt's strokes still counted (v0.5 A2).
  again(E, blind, from) {
    const run = RUN.on && RUN.next === this.p.hole + 1;
    if (run) RUN.next = this.p.hole;
    E.ledger.add('retry', { hole: this.p.hole + 1, strokes: this.p.strokes, stars: this.p.stars, from, run });
    E.audio.play('tap', J.retryTapVol); E.setScene('play', { hole: this.p.hole, run, blind });
  },
};

// v0.1 pars, used once to carry stars earned under the v0.1 rule into the v0.2 save.
const V01_PAR = [2, 2, 2, 2, 3, 3, 3, 3, 3, 3];

export const game = {
  slug: 'gravity-golf',
  title: 'Gravity Golf',
  saveVersion: 10,
  // v1 was the skeleton demo, where `best` was a number; v2 keeps best strokes per hole in a map;
  // v3 adds `unlocked`, rebuilt from the holes already cleared; v4 stores stars per hole, because v0.2 judges stars
  // by per-hole thresholds on re-authored holes: stars won under v0.1 pars are kept as they were; v5 adds badges and the skin choice;
  // v6 adds `prog`, the record behind the missions tiles' progress (landings, fewest sun touches, best run, last run), empty until played,
  // and `hintSeen`, set once the first-run hint has shown; v7 is the 25-hole ladder: `unlocked` is raised to the highest cleared
  // hole plus one and the run records (`runBest`, `lastRun`) are dropped, as a run over 15 holes does not compare with one over 25;
  // v8 adds `rankSeen`, the highest rank whose card has been shown (the rank itself is computed from the stars, never stored): a save
  // with stars gets one below its current rank, so a veteran sees one card on the menu, and a save still on Asteroid gets 1 (no card);
  // v9 is the 30-hole ladder (sector 6): the same `unlocked` and run-record clean-up as v7, so a veteran lands on the first new hole;
  // v10 adds `blind`, a map from hole index to true once its fourth (blind) star is won: an empty map, nothing else changes.
  migrate(data, fromVersion) {
    if (typeof data.best !== 'object' || data.best === null) delete data.best;
    if (data.unlocked === undefined) {
      const cleared = Object.keys(data.best || {}).map(Number);
      data.unlocked = Math.min(cleared.length ? Math.max(...cleared) + 1 : 0, LEVELS.length - 1);
    }
    if (fromVersion < 4 && data.stars === undefined) {
      data.stars = {};
      for (const [k, s] of Object.entries(data.best || {})) {
        const par = V01_PAR[k];
        if (par !== undefined) data.stars[k] = s <= par - 1 ? 3 : s <= par ? 2 : 1;
      }
    }
    if (fromVersion < 5) { // v5 adds `badges` ({ id: 1 }) and `skin` ({ ball, trail }); badges the saved stars and bests already prove are granted
      data.badges = { ...data.badges };
      for (const b of BADGES) if (savedBadge(b, data.stars || {}, data.best || {})) data.badges[b.id] = 1;
      data.skin = { ...data.skin };
    }
    if (fromVersion < 6) { data.prog = { ...data.prog }; data.hintSeen = true; } // a save that already exists has played: only a fresh one sees the hint
    if (fromVersion < 9) { // v7 and v9 both added holes: open the next one and drop run records measured on fewer (a v7 or v8 save runs this too)
      data.unlocked = openHole(data.best, data.unlocked);
      if (data.prog) { delete data.prog.runBest; delete data.prog.lastRun; }
    }
    if (fromVersion < 10) data.blind = typeof data.blind === 'object' && data.blind !== null ? data.blind : {};
    if (fromVersion < 8) data.rankSeen = Math.max(1, rankFor(starTotal(data.stars)) - 1);
    return data;
  },
  TUNING,
  init(E) { loadArt(); warmUp(E.ctx); },
  // Playtest ranges for the engine's tune panel; physics reads them every step, so a change applies from the next shot.
  // PRD v0.3 D: gravity presets. The routes are proven at Heavy (the defaults) only.
  presets: [
    { label: 'Heavy', values: { planetGravity: 4500000, stopSpeed: 50 } },
    { label: 'Medium', values: { planetGravity: 3000000, stopSpeed: 50 } },
    { label: 'Light', values: { planetGravity: 2000000, stopSpeed: 50 } },
    { label: 'Light+roll', values: { planetGravity: 3000000, stopSpeed: 80 } },
  ],
  experiments: [
    { key: 'planetGravity', label: 'Planet gravity', min: 1500000, max: 13500000, step: 100000 },
    { key: 'stopSpeed', label: 'Stop speed', min: 20, max: 120, step: 5 },
    { key: 'landSpeed', label: 'Land speed', min: 20, max: 150, step: 5 },
    { key: 'friction', label: 'Friction (speed kept per s)', min: 0.15, max: 0.5, step: 0.01 },
    { key: 'powerMax', label: 'Max power', min: 500, max: 1100, step: 10 },
    { key: 'sunPenalty', label: 'Sun penalty', min: 0, max: 3, step: 1 },
    { key: 'sunMass', label: 'Sun mass', min: 0, max: 3, step: 0.1 },
    { key: 'sunReach', label: 'Sun reach (past its edge)', min: 0, max: 80, step: 5 },
    { key: 'sunFade', label: 'Sun fade (x reach)', min: 1.1, max: 2, step: 0.05 },
    { key: 'bhReach', label: 'Black hole reach', min: 100, max: 250, step: 5 },
    { key: 'bhFade', label: 'Black hole fade (x reach)', min: 1.2, max: 2, step: 0.05 },
  ],
  // Read by tools/sim-golf.mjs so the simulator runs the real physics.
  sim: { levels: LEVELS, prepareLevel, stepBall, launchFromDrag, launchVel, newBall, carry, inSweep, moonAt, barAt, slideAt, cometAt, sunRestR,
    FW, watchStart, watchPre, watchPost, sinkFlags, kesslerMark, lagrangeAt, restPull },
  start: 'menu',
  scenes: { menu, play, over, missions },
};
