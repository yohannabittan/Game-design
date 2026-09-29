// Gravity Golf v0.4: planets, suns, rotating bars, orbiting moons, comets and black holes on the v0.1 mechanic, juice, scenes and the space look.
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
      field: '#0e1631',      // The play field
      starCool: '#dbeafe',
      starWarm: '#fde68a',
      nebula: ['#3346a8', '#0f7490', '#2f5d9e', '#7a3560'], // Indigo, teal, steel, dusty plum; never green, purple or orange
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
      tiers: ['#a8a29e', '#c9d6ea', '#a855f7', '#fde047'], // Badge medals: Meteorite rock, Moon, Planet purple, Star gold
    },
    type: { sm: 15, md: 20, lg: 36, heavy: '800' }, // Three sizes; only the large size is heavy, everything else is the engine's 600
    line: { hair: 1.5, edge: 2, radius: 10, card: 18, button: 14 }, // Design units (button radius is the engine's)
    sky: {
      layers: [ // Far then near: star count, radius range, drift (design units at the field edge), alpha buckets
        { n: 70, r0: 0.4, r1: 0.9, drift: 2.5, alphas: [0.22, 0.34, 0.5] },
        { n: 30, r0: 0.8, r1: 1.4, drift: 6, alphas: [0.4, 0.6, 0.85] },
      ],
      margin: 12,          // Stars are laid out this far beyond the field so the drift never shows an edge
      warmChance: 0.15,    // Share of stars in the warm bucket
      flares: 4,           // Bright stars with a small cross
      flareLen: 3.6,
      flareAlpha: 0.55,
      nebulae: [1, 2],     // Soft gradients per hole, one or two from the seed
      nebAlpha: [0.2, 0.32],
      nebR: [50, 90],
    },
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
    ghost: { dotR: 1.3, every: 2 },
    retry: { pad: 14, icon: 7, iconW: 2.2, head: 4.5, gap: 9 }, // The HUD Retry button: left padding, arrow radius, line width, arrowhead size, gap to the word (screen px)
    hint: { text: 'Drag anywhere away from the ball to aim, release to shoot.', hold: 3, fade: 0.5, y: 0.14, pad: 14, lineH: 20, margin: 28 }, // The first-run hint: shown once on a fresh save (seconds; y as a fraction of the field's height from its top)
    hudRun: { line1: 12, line2: 32 }, // The run counter and the landed mark, left of Retry: baselines below the HUD (screen px) // The last shot's ghost: dot radius, and one dot per this many trail samples
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
    menu: { titleGap: 26, tabBottom: 42, starsGap: 40, gridGap: 34, missionsW: 150, rowGap: 12 }, // Title sits titleGap below the engine's TUNE tab (safe top + 42)
    missions: { top: 64, headH: 32, rowH: 58, rowGap: 6, medalR: 15, bottom: 156, backW: 200, backH: 52, scrollBar: 3, margin: 16, lineH: 17, toastBand: 96 }, // rowH for a one-line condition; each extra line adds lineH. Back sits above toastBand: the engine's toast (24 px up, two lines) takes taps while it shows
    swatch: { size: 46, gap: 10, perRow: 6, headH: 26, rowGap: 10, ring: 3, ballR: 13 }, // The Skins block on the missions screen (swatches at least 44 px)
    ticket: { w: 320, h: 50, r: 14, medalR: 12 }, // The badge ticket that pops over the top edge of the hole card
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
};
const T = TUNING;
const J = T.juice;
const STEP = T.physicsStep;
TUNING.bg = TUNING.art.palette.space; // the engine reads TUNING.bg for the letterbox

// Hole data. Coordinates are design space; the four field edges are walls added by the physics.
//   stars: { three, two }: three is the fewest strokes proved in the harness; two is par, shown on the card.
//   walls: axis-aligned rectangles { x, y, w, h }.
//   planets: { x, y, r, mass }; mass 1.0 is standard, up to 1.5 on bosses if the escape rule holds; mass 0 is a bumper.
//   suns: { x, y, r }: a touch costs sunPenalty strokes and the ball bounces on.
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
    name: "Binary", boss: true, stars: { three: 2, two: 4 },
    ball: { x: 228, y: 581 }, hole: { x: 167, y: 110 },
    walls: [{ x: 73, y: 264, w: 22, h: 196 }, { x: 238, y: 470, w: 122, h: 22 }], planets: [{ x: 188, y: 435, r: 32, mass: 1.1 }, { x: 188, y: 223, r: 36, mass: 1.5 }], suns: [], movers: [],
  },
  {
    // Teaches choosing the safe side: a sun sits in front of the tee and shuts the short near-side lane (no near-side sink at one stroke), so go the long way round the far side with more power. three: drag (-91, 100), one shot, passing 30 from the surface; sinks over 8.85 degrees of aim and 118 to 147 px. two: (-46, 39) lands on the planet, then (-3, 90). Sweep (0.5 degrees, 5 px): 0 straight sinks.
    // v0.3: the sun sits at (86, 492), 184 from the planet centre (v0.2: 158) and 46 from the left edge, so no slot opens between them. Soft shots (15 to 75 px, every 0.5 degrees and 1 px) charge two penalties in 4227 and three in 404, never four (v0.2 at (100, 470): 5788 and 249; v8 at (61, 469): 2279, 207 and 2 of four). The remaining doubles and triples are balls the planet presses back into the sun's underside.
    name: "Solar Flare", boss: false, stars: { three: 1, two: 3 },
    ball: { x: 90, y: 570 }, hole: { x: 230, y: 190 },
    walls: [{ x: 0, y: 300, w: 70, h: 22 }], planets: [{ x: 190, y: 340, r: 40, mass: 1 }], suns: [{ x: 86, y: 492, r: 40 }], movers: [],
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
    name: "Windmill", boss: false, stars: { three: 2, two: 4 },
    ball: { x: 40, y: 470 }, hole: { x: 315, y: 110 },
    walls: [{ x: 0, y: 289, w: 195, h: 22 }, { x: 173, y: 311, w: 22, h: 100 }, { x: 335, y: 289, w: 25, h: 22 }], planets: [{ x: 245, y: 480, r: 40, mass: 0.7 }], suns: [{ x: 250, y: 185, r: 20 }], movers: [{ type: "bar", x: 265, y: 300, len: 90, phase: 0 }],
  },
  {
    // Boss: a heavy planet with an orbiting moon sits under the door; the moon closes the slingshot window on a 4 s cycle and a sun blocks the low approach from the tee. three: (-6, 90) at clock 0 (fine at 0 to 0.75 and 3.25 up; at 1 to 3 the ball meets the moon) lobs up the left and lands on the planet top, then (-69, 98) at clock 1.25 (works at clocks 3.7 to 2.4; 2.5 to 3.6 the moon spoils it) banks off the right edge through the door and settles on the ceiling, then (58, 94) sinks over 9.95 degrees of aim at any clock. two: (-6,90) / (-69,98) at 1.25 / (90,0) / (52,120). Sweep: 0 straight sinks.
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
    name: "Singularity", boss: false, stars: { three: 2, two: 4 },
    ball: { x: 330, y: 580 }, hole: { x: 80, y: 220 },
    walls: [{ x: 215, y: 300, w: 145, h: 22 }], planets: [{ x: 130, y: 500, r: 40, mass: 1 }], suns: [{ x: 245, y: 430, r: 24 }], blackholes: [{ x: 120, y: 350 }], movers: [],
  },
  {
    // Boss: land on the planet, time the moon to get through the door, then time the comet to cross the top lane past the black hole into the cup. three: (10, 53) lands on the planet's upper left at (114.7, 407.7); (-112, 100) at clock 0.8 (full power; the route still finishes for release clocks 0.1 to 1.8 of the 3.2 s moon cycle, 18 of 32 tried; otherwise the moon turns it away) rests at (327.3, 175.1); (-84, 68) at clock 0.5 (finishes for clocks 0.35 to 0.75 of the 1.2 s comet cycle, 9 of 24 tried; otherwise the comet knocks it away) banks off the right wall, crosses the top lane over the pillar, bounces off the ceiling and drops through the black hole's ring into the cup; aim window 7.0 degrees (-2.50 / +4.50), drag 100.1 px to full power. Sweep: 0 straight sinks. Lesson not carried: the straight line at the cup is walled, not swallowed.
    // v0.4 (PRD v0.4 A, C): under the influence ring every shot of the v0.3 route changed (its black hole pulled across the whole field); the pillar top drops from y 90 to 120 (a wider top lane) and the comet now falls through the lane at x 200 (from y -20 to 110, r 18, 1.2 s) instead of running along the ceiling, so the last shot has a wide window at the right clock and misses on the rest. The black hole moves down from y 190 to 215, over the gap at the left end of the long wall: a timed two-stroke shortcut up that gap, whipped round the black hole into the cup (a 4 degree untimed second shot), is now swallowed.
    name: "Collapse", boss: true, stars: { three: 3, two: 5 },
    ball: { x: 40, y: 610 }, hole: { x: 80, y: 100 },
    walls: [{ x: 30, y: 250, w: 242, h: 22 }, { x: 250, y: 120, w: 22, h: 130 }, { x: 245, y: 390, w: 115, h: 22 }], planets: [{ x: 130, y: 450, r: 36, mass: 0.8 }], suns: [], blackholes: [{ x: 28, y: 215 }], movers: [{ type: "moon", parent: 0, orbitR: 74, period: 3.2, r: 13, mass: 0.45, phase: 0 }, { type: "comet", a: { x: 200, y: -20 }, b: { x: 200, y: 110 }, period: 1.2, r: 18 }],
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

// How much of a black hole's pull reaches distance d: 1 inside its influence ring R, fading smoothly to 0 at bhFade times R.
function bhFall(R, d) {
  const R1 = R * T.bhFade;
  if (d <= R) return 1;
  if (d >= R1) return 0;
  const u = (R1 - d) / (R1 - R);
  return u * u * (3 - 2 * u);
}
function bhInfluence(h, x, y) { return bhFall(h.reach || T.bhReach, dist(x, y, h.x, h.y)); }

// The rest radius: beyond it the pull is under restPull(), so a slow ball can stop; inside it, it crawls in and is swallowed.
// This is the line drawn as the black hole's outer ring (the "you will be pulled in" line).
function bhRestR(h) {
  const R = h.reach || T.bhReach, need = restPull(), gm = T.planetGravity * h.mass;
  if (gm / (R * R) < need) return Math.max(T.bhPullR, Math.sqrt(gm / need));
  let lo = R, hi = R * T.bhFade;
  for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if ((gm / (m * m)) * bhFall(R, m) >= need) lo = m; else hi = m; }
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

function starsFor(strokes, st) { return strokes <= st.three ? 3 : strokes <= st.two ? 2 : 1; }
function shots(n) { return `${n} ${n === 1 ? 'shot' : 'shots'}`; }

function progress(E) {
  const best = E.save.get('best', {}), won = E.save.get('stars', {});
  const stars = LEVELS.map((lv, i) => won[i] || 0);
  return { best, stars, total: stars.reduce((a, b) => a + b, 0), unlocked: clamp(E.save.get('unlocked', 0), 0, LEVELS.length - 1), badges: E.save.get('badges', {}), prog: E.save.get('prog', {}) };
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
const BADGE_TIERS = ['Meteorite', 'Moon', 'Planet', 'Star'];
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
];
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
// Badges that need what happened on the hole just finished: ev = { touchdown, untouched, runDone, runStrokes, runLanded }.
function eventBadge(b, ev) {
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
  goal: tx(TY.md, P.green, 'center'), dim: tx(TY.md, P.textDim, 'center'), sm: tx(TY.sm, P.textDim, 'center'),
  bossMd: tx(TY.md, P.bossAccent, 'center'), smLight: tx(TY.sm, P.text, 'center'),
  tileNum: tx(TY.md, P.text, 'center'), tileNumOff: tx(TY.md, P.textOff, 'center'),
  label: tx(TY.sm, P.textDim, 'left'), labelC: tx(TY.sm, P.textDim, 'center'), labelBoss: tx(TY.sm, P.bossAccent, 'center'), labelR: tx(TY.sm, P.textDim, 'right'),
  valueL: tx(TY.md, P.text, 'left'), valueC: tx(TY.md, P.text, 'center'), valueGoalR: tx(TY.md, P.green, 'right'),
  goalL: tx(TY.sm, P.green, 'left'), btnL: tx(TY.sm, P.text, 'left'), btnOffL: tx(TY.sm, P.textOff, 'left'), runClean: tx(TY.sm, P.green, 'left'), progL: tx(TY.sm, P.amber, 'left'),
  tier: P.tiers.map((c) => tx(TY.sm, c, 'left')), bigL: tx(TY.lg, P.text, 'left', TY.heavy), labelL: tx(TY.sm, P.text, 'left'), dimL: tx(TY.sm, P.textDim, 'left'), offL: tx(TY.md, P.textOff, 'left'),
};
// Button styles (engine buttons take these), and their outline colour.
const BTN = {
  primary: { fill: P.green, color: P.ink, h: 64, size: TY.md, edge: P.greenLight },
  half: { fill: P.slateDark, color: P.text, w: A.menu.missionsW, h: 48, size: TY.sm, edge: P.slate },
  back: { fill: P.slateDark, color: P.text, w: A.missions.backW, h: A.missions.backH, size: TY.md, edge: P.slate },
  secondCard: { fill: P.slateDark, color: P.text, w: 150, h: 48, size: TY.sm, edge: P.slate },
  retryOn: { w: T.retryW, h: T.retryH, fill: P.slate, color: P.text, edge: P.slateLight },
  retryOff: { w: T.retryW, h: T.retryH, fill: P.retryOff, color: P.textOff, edge: P.slateDeep },
};
function pill(E, label, cx, cy, o) {
  const r = E.button(label, cx, cy, o);
  E.roundRect(r.x, r.y, r.w, r.h, A.line.button, null, o.edge);
  return r;
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

// ----- Sky: two parallax star layers, bright stars and one or two nebulae, seeded per hole -----

const SKY = new Map();
function buildSky(ctx, key) {
  const sk = A.sky, rng = makeRng(hashString(`sky:${key}`)), m = sk.margin, w = T.designW + 2 * m, h = T.designH + 2 * m;
  const layers = sk.layers.map((L) => {
    const buckets = L.alphas.map((a, i) => ({ path: new Path2D(), a, c: i === L.alphas.length - 1 ? P.starWarm : P.starCool }));
    for (let i = 0; i < L.n; i++) {
      const b = buckets[rng() < sk.warmChance ? buckets.length - 1 : rng.int(0, buckets.length - 2)];
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
  const first = rng.int(0, P.nebula.length - 1);
  const neb = Array.from({ length: rng.int(...sk.nebulae) }, (_, i) => {
    const c = P.nebula[(first + i * rng.int(1, P.nebula.length - 1)) % P.nebula.length];
    return {
      x: rng.range(0, T.designW), y: rng.range(0, T.designH), r: rng.range(...sk.nebR), a: rng.range(...sk.nebAlpha),
      g: radial(ctx, 0, 0, 0, 0, 0, 1, [0, rgba(c, 1), 0.45, rgba(c, 0.45), 1, rgba(c, 0)]),
    };
  });
  const s = { layers, flare, neb };
  SKY.set(key, s);
  return s;
}

// Draws the field for a hole. (ox, oy) is where the ball is on the field, -1 to 1; the layers drift against it.
function drawField(ctx, key, ox, oy) {
  if (!G) G = buildGradients(ctx);
  const s = SKY.get(key) || buildSky(ctx, key), sk = A.sky;
  ctx.fillStyle = P.field;
  ctx.fillRect(0, 0, T.designW, T.designH);
  for (let i = 0; i < s.neb.length; i++) {
    const n = s.neb[i];
    ctx.save(); ctx.translate(n.x, n.y); ctx.scale(n.r, n.r);
    ctx.globalAlpha = n.a; ctx.fillStyle = n.g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, PI2); ctx.fill(); ctx.restore();
  }
  for (let i = 0; i < s.layers.length; i++) {
    const L = s.layers[i];
    ctx.save(); ctx.translate(-ox * L.drift, -oy * L.drift);
    for (let j = 0; j < L.buckets.length; j++) { const b = L.buckets[j]; ctx.globalAlpha = b.a; ctx.fillStyle = b.c; ctx.fill(b.path); }
    if (i === s.layers.length - 1) {
      ctx.globalAlpha = 0.9; ctx.fillStyle = P.starCool; ctx.fill(s.flare.dots);
      ctx.globalAlpha = sk.flareAlpha; ctx.strokeStyle = P.starCool; ctx.lineWidth = 0.8; ctx.lineCap = 'round'; ctx.stroke(s.flare.cross);
    }
    ctx.restore();
  }
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

function drawSun(ctx, x, y, r, flare, t) {
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
  } else if (k.kind === 'sun') drawSun(ctx, cx, cy, tl.sunR, 1, t);
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
  S.from = { x: lv.ball.x, y: lv.ball.y, on: -1, onA: 0, planet: false }; // where the current shot started (the last rest)
  S.restPlanet = false;  // the ball rests on a planet or moon (for Touchdown and Never Landed)
  S.swT = 0; S.swX = 0; S.swY = 0; S.swBh = -1;
  S.acc = 0; S.steps = 0;
  S.clock = 0;           // hole clock: runs while aiming, restarts when the ball comes to rest
  S.clock0 = 0;
  S.aim = null;          // active pointer aim: { id, sx, sy, x, y }
  S.key = { on: false, angle: Math.atan2(lv.hole.y - lv.ball.y, lv.hole.x - lv.ball.x), power: T.keyPowerStart };
  S.sinkT = 0; S.sinkFrom = null;
  S.time = 0; S.swallows = 0; S.lands = 0; // for the ledger and the badge progress
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
  f.x = S.ball.x; f.y = S.ball.y; f.on = S.ball.on; f.onA = S.ball.onA; f.planet = S.restPlanet;
  S.ball.vx = v.vx; S.ball.vy = v.vy; S.ball.on = -1;
  S.ball.sunIn = 0; S.ball.cometIn = 0; // a shot from rest against a sun is charged if it goes back into it
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

function finishHole(E) {
  const strokes = S.strokes, lv = S.lv, id = String(S.idx), stars = starsFor(strokes, lv.stars);
  const prev = E.save.get('best', {})[id];
  const best = prev === undefined ? strokes : Math.min(prev, strokes);
  E.save.update('best', (b) => ({ ...b, [id]: best }), {});
  E.save.update('stars', (s) => ({ ...s, [id]: Math.max(s[id] || 0, stars) }), {});
  const hasNext = S.idx + 1 < LEVELS.length;
  if (hasNext) E.save.update('unlocked', (u) => Math.max(u, S.idx + 1), 0);
  const inRun = RUN.on && RUN.next === S.idx;
  if (inRun) { RUN.strokes += strokes; RUN.next = S.idx + 1; }
  const ev = { touchdown: S.from.planet, untouched: lv.suns.length > 0 && S.ball.sunHits === 0,
    runDone: inRun && !hasNext, runStrokes: RUN.strokes, runLanded: RUN.landed };
  E.ledger.add('hole', { hole: S.idx + 1, strokes, stars, swallows: S.swallows, sun: S.ball.sunHits, landed: S.lands > 0, time: S.time, run: inRun });
  E.save.update('prog', (g) => {
    const o = { ...g, lands: (g.lands || 0) + S.lands };
    if (lv.suns.length) o.sunBest = Math.min(g.sunBest === undefined ? Infinity : g.sunBest, S.ball.sunHits);
    if (inRun) o.lastRun = { through: S.idx + 1, landedOn: RUN.landedOn + 1 };
    return o;
  }, {});
  if (ev.runDone) endRun(E, true);
  const had = E.save.get('badges', {}), won = E.save.get('stars', {}), bests = E.save.get('best', {});
  const fresh = BADGES.filter((b) => !had[b.id] && (savedBadge(b, won, bests) || eventBadge(b, ev))).map((b) => b.id);
  if (fresh.length) E.save.update('badges', (h) => { const o = { ...h }; for (const k of fresh) o[k] = 1; return o; }, {});
  for (const id of fresh) E.ledger.add('badge', { id, hole: S.idx + 1 });
  E.setScene('over', { hole: S.idx, name: lv.name, boss: lv.boss, strokes, three: lv.stars.three, par: lv.stars.two, stars, best, hasNext, badges: fresh });
}

// A full run ends: finished (done) or left (a hole played out of order, Menu or Retry from the card, or hole 1 again).
function endRun(E, done) {
  if (!RUN.on) return;
  if (RUN.next > 0 || RUN.strokes > 0) E.ledger.add('run', { done, holes: RUN.next, strokes: RUN.strokes, landed: RUN.landed, landedOn: RUN.landedOn + 1, limit: runLimit() });
  if (done) E.save.update('prog', (g) => ({ ...g, runBest: Math.min(g.runBest === undefined ? Infinity : g.runBest, RUN.strokes) }), {});
  RUN.on = false;
}

// ---------- Juice (cosmetic only: reads the physics state, never writes it) ----------

const FX = { glow: 0, power: 0, pop: 1, flash: 1, rest: 1, sink: 1, retry: 1, shots: 1, banner: 1, bannerTok: null, ring: null, flare: null, bhFlare: null, trailT: 0, ghost: false, gx: 0, gy: 0,
  hint: 0, hintT: 0, spin: 0, trailK: 1, cup: 0, skyKey: '', hudHole: '', hudPar: '', hudN: -1, hudShots: '', hudRunN: -1, hudRun: '' };
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
  const from = E.save.get('stars', {})[S.idx] || 0;
  CHANGED = stars > from ? { hole: S.idx, from, to: stars } : null;
  burst(E, lv.hole.x, lv.hole.y, { count: three ? J.burstBigCount : J.burstCount, color: P.green, speed: J.burstSpeed * (three ? 1.3 : 1), life: J.burstLife, size: J.burstSize });
  burst(E, lv.hole.x, lv.hole.y, { count: three ? J.burstBigCount / 2 : J.burstCount / 2, color: P.greenLight, speed: J.burstSpeed * 0.6, life: J.burstLife, size: J.burstSize * 0.7 });
  E.haptic(J.sinkHaptic);
  if (three) {
    E.audio.play('coin'); later(E, J.coinLead, () => E.audio.play('win'));
    E.flash(P.green, J.threeStarFlash);
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

// A badge medal: a dark disc ringed in its tier colour with the tier's icon (rock, crescent, ringed planet, star); dim when not earned.
function drawMedal(ctx, x, y, r, tier, got) {
  const col = got ? P.tiers[tier] : P.starOff;
  ctx.fillStyle = got ? P.card : P.tileLocked; ctx.beginPath(); ctx.arc(x, y, r, 0, PI2); ctx.fill();
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
  } else drawStar(ctx, x, y, q * 1.15, col);
  ctx.globalAlpha = 1;
}

// The ticket for a badge just earned: the medal, the tier and name, and the skins it unlocks drawn at the right end.
function drawTicket(ctx, E, b, k, y, more) {
  const TK = A.ticket, w = Math.min(TK.w, E.w - 40), x = (E.w - w) / 2, cx = E.w / 2, skins = skinsOf(b.id);
  ctx.save(); ctx.translate(cx, y); ctx.scale(k, k); ctx.translate(-cx, -y);
  E.roundRect(x, y - TK.h / 2, w, TK.h, TK.r, P.bannerBg, P.tiers[b.tier]);
  drawMedal(ctx, x + 12 + TK.medalR, y, TK.medalR, b.tier, true);
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
  enter(E) { this.btnPlay = null; this.btnMute = null; this.btnMissions = null; this.tiles = []; this.pop = CHANGED; CHANGED = null; this.t = 0; applySkins(E); },
  update(dt) { if (this.pop) this.t += dt; },
  render(ctx, E) {
    const v = coverView(E), p = progress(E), cx = E.w / 2, tl = A.tile, M = A.menu;
    ctx.save(); ctx.translate(v.ox, v.oy); ctx.scale(v.s, v.s); drawField(ctx, 'menu', 0, 0); ctx.restore();
    const ty = Math.max(E.h * 0.09, E.safe.top + M.tabBottom + M.titleGap); // below the engine's TUNE tab on a notched phone
    E.text('GRAVITY GOLF', cx, ty, TX.big);
    const tw0 = ctx.measureText('GRAVITY GOLF').width + 16, TA = this.titleBox; // release: five taps on the title open TUNE (ADR-0016)
    TA.x = cx - tw0 / 2; TA.y = ty - TY.lg / 2; TA.w = tw0; TA.h = TY.lg + 4; E.titleArea = TA; // starts below the EXPORT tab's 48 px corner
    E.text(`Stars ${p.total} / ${LEVELS.length * 3}`, cx, ty + M.starsGap, TX.goal);
    drawSkinSample(ctx, cx - 108, ty + M.starsGap, 8, SK.ball, SK.trail, E.time * 1.5);

    const m = 16, gap = T.tileGap, cols = T.gridCols;
    const tw = (E.w - 2 * m - (cols - 1) * gap) / cols, th = T.tileH, top = Math.max(E.h * 0.2, ty + M.starsGap + M.gridGap);
    this.tiles = [];
    LEVELS.forEach((lv, i) => {
      const x = m + (i % cols) * (tw + gap), y = top + Math.floor(i / cols) * (th + gap), tcx = x + tw / 2;
      const locked = i > p.unlocked, cleared = p.best[i] !== undefined;
      // Only the tile whose stars just went up pops.
      const pop = this.pop && this.pop.hole === i ? this.pop : null;
      const ts = pop ? lerp(J.menuPopFrom, 1, ease.outBack(clamp(this.t / J.menuPopTime, 0, 1))) : 1;
      if (ts !== 1) { ctx.save(); ctx.translate(tcx, y + th / 2); ctx.scale(ts, ts); ctx.translate(-tcx, -(y + th / 2)); }
      E.roundRect(x, y, tw, th, A.line.radius, locked ? P.tileLocked : P.tile, cleared ? P.green : locked ? P.tileLockedEdge : lv.boss ? P.bossAccent : P.slate);
      E.text(`${i + 1}`, tcx, y + tl.number, locked ? TX.tileNumOff : TX.tileNum);
      if (locked) {
        ctx.fillStyle = P.tileLockedEdge; ctx.beginPath(); ctx.arc(tcx, y + tl.icon, tl.iconR + 2, 0, PI2); ctx.fill();
        drawLock(ctx, tcx, y + tl.icon + 1);
      } else {
        drawBadge(ctx, lv, tcx, y + tl.icon, E.time);
        for (let s = 0; s < 3; s++) {
          const sx = tcx + (s - 1) * 15, sy = y + th - tl.stars, earned = s < p.stars[i];
          const k = pop && earned && s >= pop.from ? ease.outBack(clamp((this.t - J.menuStarDelay - (s - pop.from) * J.menuStarStagger) / J.menuStarPop, 0, 1)) : 1;
          if (!earned || k < 1) drawStar(ctx, sx, sy, tl.starR, null, P.starOff);
          if (earned && k > 0) drawStar(ctx, sx, sy, tl.starR * k, P.green);
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
  },
  onTap(p, E) {
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
    WRAP.set(key, lines);
  }
  return lines;
}

const missions = {
  enter(E) { this.scroll = 0; this.drag = null; this.btnBack = null; this.swatches = []; this.listH = BADGES.length * (A.missions.rowH + A.missions.rowGap); applySkins(E); },
  skinsH() {
    const M = A.missions, W = A.swatch, rows = (n) => Math.ceil(n / W.perRow) * (W.size + W.rowGap);
    return M.headH + 2 * W.headH + rows(SKINS.balls.length) + rows(SKINS.trails.length) + 6;
  },
  area(E) {
    const M = A.missions, top = E.safe.top + M.top, bot = E.h - E.safe.bottom - M.bottom;
    const content = this.skinsH() + BADGE_TIERS.length * M.headH + this.listH; // listH is measured by the last render
    return { top, bot, max: Math.max(0, content - (bot - top)) };
  },
  render(ctx, E) {
    const M = A.missions, V = this.area(E), p = progress(E), m = M.margin, w = E.w - 2 * m, v = coverView(E);
    ctx.save(); ctx.translate(v.ox, v.oy); ctx.scale(v.s, v.s); drawField(ctx, 'menu', 0, 0); ctx.restore();
    E.text('Missions', m, E.safe.top + 32, TX.bigL);
    E.text(`${BADGES.filter((b) => p.badges[b.id]).length} / ${BADGES.length}`, E.w - m, E.safe.top + 32, TX.valueGoalR);
    this.scroll = clamp(this.scroll, 0, V.max);
    ctx.save(); ctx.beginPath(); ctx.rect(0, V.top, E.w, V.bot - V.top); ctx.clip();
    let y = this.drawSkins(ctx, E, p, V.top - this.scroll, V, m), listH = 0;
    BADGE_TIERS.forEach((name, tier) => {
      const inTier = BADGES.filter((b) => b.tier === tier);
      drawMedal(ctx, m + 8, y + M.headH / 2, 8, tier, true);
      E.text(`${name.toUpperCase()}   ${inTier.filter((b) => p.badges[b.id]).length} / ${inTier.length}`, m + 24, y + M.headH / 2, TX.tier[tier]);
      y += M.headH;
      for (const b of inTier) {
        const tx0 = m + 24 + 2 * M.medalR, tw = w - (tx0 - m) - 12, prog = badgeProgress(b, p, p.prog);
        const lines = wrapText(ctx, `${b.id}:${w}`, badgeText(b), tw), plines = wrapText(ctx, `${b.id}:${w}:${prog}`, prog, tw);
        const h = M.rowH + (lines.length + plines.length - 1) * M.lineH;
        if (y + h > V.top && y < V.bot) {
          const got = !!p.badges[b.id];
          E.roundRect(m, y, w, h, A.line.radius, got ? P.tile : P.tileLocked, got ? P.tiers[tier] : P.tileLockedEdge);
          drawMedal(ctx, m + 12 + M.medalR, y + h / 2, M.medalR, tier, got);
          E.text(b.name, tx0, y + 19, got ? TX.valueL : TX.offL);
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
function shoot(E, l) { launch(l); releaseFx(E); }

const play = {
  enter(E, params) {
    const idx = clamp((params && params.hole) || 0, 0, LEVELS.length - 1);
    if (!(idx > 0 && params && params.run && RUN.on && RUN.next === idx)) endRun(E, false); // only Next carries a run on
    if (idx === 0) { RUN.on = true; RUN.next = 0; RUN.strokes = 0; RUN.landed = false; RUN.landedOn = -1; } // hole 1 starts a full run
    applySkins(E);
    loadHole(idx);
    resetFx();
    FX.hint = E.save.get('hintSeen', false) ? 0 : 1; if (FX.hint) E.save.set('hintSeen', true); // the first play of a fresh save, once
    FX.hintT = 0;
    FX.banner = 1; FX.bannerTok = null;
    if (S.lv.boss) {
      const tok = FX.bannerTok = {};
      FX.banner = 0;
      E.tween(J.bannerTime, (k) => { if (FX.bannerTok === tok) FX.banner = k; }, ease.linear);
    }
  },

  update(dt, E) {
    fxUpdate(dt);
    S.time += dt; FX.hintT += dt;
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
      const b = S.ball, hitsBefore = b.hits, sunsBefore = b.sunHits, cometsBefore = b.cometHits, pvx = b.vx, pvy = b.vy;
      let r = stepBall(S.lv, b, S.clock0 + S.steps * STEP);
      if (b.hits !== hitsBefore) bounceFx(E, pvx, pvy);
      if (b.cometHits !== cometsBefore) cometFx(E);
      if (b.sunHits !== sunsBefore) { S.strokes += T.sunPenalty * (b.sunHits - sunsBefore); sunFx(E, b.sunLast); }
      if (S.steps % J.trailEvery === 0) {
        ghostRecord(b.x, b.y);
        if (Math.hypot(b.vx, b.vy) < A.trail.minSpeed) trailDrop();
        else trailPush(b.x, b.y, SK.trail.badge || !planetNear(S.lv, b, S.clock0 + S.steps * STEP) ? SK.trail.col : planetColor(S.lv)); // a chosen trail keeps its colour
      }
      if (!r && S.steps * STEP >= T.maxFlightSeconds) r = 'rest';
      if (r === 'sink') { S.phase = 'sink'; S.sinkT = 0; S.sinkFrom = { x: b.x, y: b.y }; sinkFx(E); }
      else if (r === 'swallow') {
        S.phase = 'swallow'; S.swT = 0; S.swX = b.x; S.swY = b.y; S.swBh = b.bh;
        S.strokes += T.bhPenalty; S.swallows++; swallowFx(E, b.bh);
      } else if (r === 'rest') { comeToRest(); restFx(E); }
    }
  },

  render(ctx, E) {
    const v = view(E), lv = S.lv, b = S.ball, clock = partClock(), t = E.time, mv = lv.movers;
    ctx.save();
    ctx.translate(v.ox, v.oy); ctx.scale(v.s, v.s);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, T.designW, T.designH); ctx.clip();
    drawField(ctx, FX.skyKey, (b.x / T.designW - 0.5) * 2, (b.y / T.designH - 0.5) * 2);
    for (let i = 0; i < mv.length; i++) {
      const m = mv[i];
      if (m.type === 'moon') {
        const p = lv.planets[m.parent];
        ctx.setLineDash(ORBIT_DASH); drawRing(ctx, p.x, p.y, m.orbitR, A.line.hair, planetColor(lv), J.orbitAlpha); ctx.setLineDash(NO_DASH);
      } else if (m.type === 'slide') drawRail(ctx, m);
      else if (m.type === 'comet') drawCometPath(ctx, m);
    }
    for (let i = 0; i < lv.blackholes.length; i++) drawBlackHole(ctx, lv.blackholes[i], t, FX.bhFlare[i]);
    for (let i = 0; i < lv.suns.length; i++) { const s = lv.suns[i]; drawSun(ctx, s.x, s.y, s.r, FX.flare[i], t); }
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

    if (S.phase === 'aim') drawGhost(ctx);
    drawTrail(ctx, b.x, b.y);

    const aiming = S.phase === 'aim' ? currentLaunch() : null;
    if (aiming) {
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
    if (RUN.on && RUN.next === S.idx) { // PRD v0.5 A: the full run's strokes so far, and the live Never Landed mark
      const n = RUN.strokes + S.strokes, ry = E.safe.top + T.hudH;
      if (FX.hudRunN !== n) { FX.hudRunN = n; FX.hudRun = `Run: ${n} ${n === 1 ? 'stroke' : 'strokes'}`; }
      E.text(FX.hudRun, 16, ry + A.hudRun.line1, TX.labelL);
      E.text(RUN.landed ? `landed on hole ${RUN.landedOn + 1}` : 'no landings yet', 16, ry + A.hudRun.line2, RUN.landed ? TX.dimL : TX.runClean);
    }
    if (FX.hint && FX.hintT < A.hint.hold + A.hint.fade) drawHint(ctx, E, v, clamp((A.hint.hold + A.hint.fade - FX.hintT) / A.hint.fade, 0, 1));
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
    if (l) shoot(E, l); else S.aim = null; // inside the dead zone: cancel, no stroke
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
    this.starK = [0, 0, 0]; this.starDone = [false, false, false];
    this.beat = J.starDelay + Math.max(0, p.stars - 1) * J.starStagger + J.starPop * 0.6 + J.buttonGap;
    this.btnNext = null; this.btnMenu = null; this.btnRetry = null;
    this.badges = (p.badges || []).map((id) => BADGES.find((b) => b.id === id));
    this.badgeT = J.starDelay + Math.max(0, p.stars - 1) * J.starStagger + J.starPop + J.badgeDelay; // the first badge pops after the stars
    this.badgeOn = -1;
    applySkins(E);
    E.tween(J.cardSlide, (k) => { this.slide = k; }, ease.outBack);
  },
  update(dt, E) {
    this.t += dt;
    for (let i = 0; i < this.p.stars; i++) {
      if (!this.starDone[i] && this.t >= J.starDelay + i * J.starStagger) {
        this.starDone[i] = true; E.audio.play('coin');
        E.tween(J.starPop, (k) => { this.starK[i] = k; }, ease.outBack);
      }
    }
    const bi = Math.min(this.badges.length - 1, Math.floor((this.t - this.badgeT) / J.badgeHold));
    if (this.t >= this.badgeT && bi > this.badgeOn) { this.badgeOn = bi; E.audio.play('win', 0.5); E.haptic(J.sinkHaptic); }
    this.ready = this.t >= this.beat;
  },
  render(ctx, E) {
    const p = this.p, cx = E.w / 2, t = this.t, v = coverView(E);
    ctx.save(); ctx.translate(v.ox, v.oy); ctx.scale(v.s, v.s); drawField(ctx, this.sky, 0, 0); ctx.restore();
    ctx.save(); ctx.translate(0, (1 - this.slide) * E.h * J.cardSlideFrac);
    const pw = Math.min(E.w - 32, 340), py = E.h * 0.085;
    E.roundRect(cx - pw / 2, py, pw, E.h * 0.68 + 80 + 44 - py, A.line.card, P.card, p.boss ? P.bossAccent : P.slate);
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
    for (let i = 0; i < 3; i++) {
      const sx = cx + (i - 1) * 64, sy = E.h * 0.24 + 120;
      drawStar(ctx, sx, sy, 26, null, P.starOff);
      if (i < p.stars && this.starDone[i]) drawStar(ctx, sx, sy, 26 * this.starK[i], P.green);
    }
    const line = p.stars === 3 ? (p.strokes === 1 ? 'Hole in one' : 'Under par') : '';
    if (line) E.text(line, cx, E.h * 0.24 + 178, { size: TY.md, color: P.green, alpha: clamp((t - J.starDelay - (p.stars - 1) * J.starStagger) / J.lineFade, 0, 1) });
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
    }
    if (this.badgeOn >= 0) { // the ticket straddles the card's top edge; each new badge takes the place of the one before
      const k = ease.outBack(clamp((t - this.badgeT - this.badgeOn * J.badgeHold) / J.badgePop, 0, 1));
      drawTicket(ctx, E, this.badges[this.badgeOn], k, tky, this.badges.length - 1 - this.badgeOn);
    }
    ctx.restore();
  },
  onTap(p, E) {
    if (!this.ready || !this.btnNext || p.startT < this.t0 + this.beat) return;
    if (E.hit(this.btnNext, p)) { if (!this.p.hasNext) endRun(E, false); E.setScene(this.p.hasNext ? 'play' : 'menu', { hole: this.p.hole + 1, run: true }); }
    else if (this.btnMenu && E.hit(this.btnMenu, p)) { endRun(E, false); E.setScene('menu'); }
    else if (this.btnRetry && E.hit(this.btnRetry, p)) { // the hole again, outside the run (hole 1 starts a new one)
      E.ledger.add('retry', { hole: this.p.hole + 1, strokes: this.p.strokes, stars: this.p.stars, from: 'card' });
      E.audio.play('tap', J.retryTapVol); E.setScene('play', { hole: this.p.hole });
    }
  },
};

// v0.1 pars, used once to carry stars earned under the v0.1 rule into the v0.2 save.
const V01_PAR = [2, 2, 2, 2, 3, 3, 3, 3, 3, 3];

export const game = {
  slug: 'gravity-golf',
  title: 'Gravity Golf',
  saveVersion: 6,
  // v1 was the skeleton demo, where `best` was a number; v2 keeps best strokes per hole in a map;
  // v3 adds `unlocked`, rebuilt from the holes already cleared; v4 stores stars per hole, because v0.2 judges stars
  // by per-hole thresholds on re-authored holes: stars won under v0.1 pars are kept as they were; v5 adds badges and the skin choice;
  // v6 adds `prog`, the record behind the missions tiles' progress (landings, fewest sun touches, best run, last run), empty until played,
  // and `hintSeen`, set once the first-run hint has shown.
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
    return data;
  },
  TUNING,
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
    { key: 'bhReach', label: 'Black hole reach', min: 100, max: 250, step: 5 },
    { key: 'bhFade', label: 'Black hole fade (x reach)', min: 1.2, max: 2, step: 0.05 },
  ],
  // Read by tools/sim-golf.mjs so the simulator runs the real physics.
  sim: { levels: LEVELS, prepareLevel, stepBall, launchFromDrag, launchVel, newBall, carry, inSweep, moonAt, barAt, slideAt, cometAt },
  start: 'menu',
  scenes: { menu, play, over, missions },
};
