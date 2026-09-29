// Ink, layers 1 to 5 and the v0.2 dynamic needle, the v0.3 needle inertia and the v0.4 gap hint: the mechanic, the progression, the juice, a speed-driven ink radius with momentum, a highlight for the gaps that are hard to find, and the art. Hold the tattoo machine, lay ink inside the stencil, never leave the line three times.
// Art (layer 5, PRD v0.1 section 11): tattoo flash. A transfer stencil on skin, ink on a body part, a pen-style machine in the hand, a flash-sheet menu. All of it is procedural Canvas drawing and lives in TUNING.art.
// Fifteen stencils, authored as data and verified with tools/sim-ink.mjs.

import { clamp, dist, ease, makeRng, hashString } from './engine.js';

// Design-space units unless stated. Names match PRD section 16; the rest are marked.
const TUNING = {
  designW: 360,          // Design space width
  designH: 640,          // Design space height
  needleOffset: 56,      // Screen pixels from the finger to the needle tip, straight up
  needleR: 7,            // Needle radius; ink is laid within this of the needle centre
  cellSize: 3,           // Coverage grid cell size
  sampleSpacing: 2,      // Distance between path samples along the needle's movement
  slipTolerance: 2,      // The needle centre may be this far outside the outline before a slip counts
  maxSlips: 3,           // Third slip ruins the piece
  starPercents: [70, 80, 90, 95, 99], // Percentage thresholds for 1 to 5 stars
  passPercent: 70,       // Below this at the timer is a fail
  timerMultEarly: 2.2,   // Timer is this times the perfect-path time to 99 percent: Circle, Diamond, Heart, Star (read by tools/sim-ink.mjs)
  timerMultMid: 1.9,     // Same for the stencils between the bosses (Bolt, Halo, Clover, Key)
  timerMultBoss: 1.7,    // Same for the mid boss, Crescent
  timerMultFinal: 1.6,   // Same for the boss Snake
  timerMultSkull: 1.35,  // Same for the final boss, Skull (PRD v0.5 section A)
  timerGlobalMult: 1,    // v0.5 experiment (PRD section D): scales every timer on top of the five multipliers above; the TUNE presets set all six
  dailyTimerMult: 1.4,   // v0.5 daily stencil: its timer is this times the stencil's perfect-path time (never longer than the stencil's own timer)
  dailyKeep: 7,          // Days of daily results kept in the save
  dailyVariants: [       // The daily is a stencil from the unlocked ones turned by one of these (about its own centre); all keep the shape, so its perfect path is the same
    { label: 'Mirror', sx: -1, sy: 1 },
    { label: 'Flipped', sx: 1, sy: -1 },
    { label: 'Turned', sx: -1, sy: -1 },
  ],
  inkStrokeWidth: 14,    // Drawn ink stroke width at the classic radius (twice needleR); the dynamic needle scales it with the radius
  outlineWidth: 2,       // Stencil outline width
  particleCap: 200,      // Max live particles; every emit is trimmed to fit

  // Layer 1 additions, not in the PRD table.
  bg: null,              // Set below from the art palette (the engine reads this name and fills the whole screen with it)
  endHold: 0.6,          // Seconds the finished piece stays on screen before the card
  hudTop: 16,            // Screen px from the safe-area top to the HUD
  slipMarkSize: 6,       // Half-length of a slip cross
  circlePoints: 96,      // Vertices of the circle stencil polygon

  // Layer 2 additions.
  gridCols: 5,           // Stencil select tiles per row
  gridGap: 8,            // Gap between tiles (screen px)
  inkLayerMaxDpr: 2,     // The cached ink layer is drawn at most this many pixels per CSS pixel

  // v0.2 dynamic needle (PRD v0.2 section E; the game since v0.4). Speeds are design units per second of finger travel.
  slowSpeed: 175,        // At or below this speed the ink radius is needleR * wideScale
  fastSpeed: 520,        // At or above this speed the ink radius is needleR * thinScale
  wideScale: 1.8,        // Radius multiplier when slow
  thinScale: 0.65,       // Radius multiplier when fast
  speedWindow: 24,       // Units of travel over which speed is measured (never per frame)

  // v0.3 needle inertia (PRD v0.3 sections A, E). The Flowy values won the phone playtest. Radius units are design units per second.
  growRate: 14,          // Radius units per second the ink radius widens toward its target
  shrinkRate: 30,        // Radius units per second it narrows toward its target
  floorScale: 0.8,       // The radius never drops below needleR * floorScale
  physicsStep: 1 / 120,  // Fixed step (seconds) for integrating the radius while the finger holds still
  holdGap: 0.06,         // Seconds without a movement event before the finger counts as holding still

  // v0.4 gap hint (PRD v0.4 section E). Cosmetic: never changes coverage, slips, the timer or stars.
  hintPercent: 95,       // Fill percentage at which the hint turns on (101 turns it off)
  hintShare: 0.1,        // A cluster of unfilled cells is shown when it holds at least this share of the unfilled cells
  hintEvery: 0.25,       // Seconds between hint recomputations
  hintAlphaMin: 0.25,    // Pulse floor
  hintAlphaMax: 0.45,    // Pulse peak
  hintPeriod: 1.2,       // Pulse period, seconds

  // Layer 3: feel only. Nothing here touches coverage, slips, the timer, stars or saves. Seconds, screen px and design units as marked.
  juice: {
    settleSec: 0.22, settleFrom: 0.82,       // Machine scale pop on touch down (scale about the needle tip, so the tip never moves)
    vibAmp: 0.9, vibHz: 55, vibHold: 0.09,   // Machine body vibration (screen px, Hz, seconds it lingers after the last ink)
    glintHz: 13, glintLen: 4.5,              // Needle tip sparkle rate and half-length (screen px)
    tickEvery: 42, tickMinGap: 0.085,        // Needle tick: design units of inked travel, and the minimum seconds between ticks
    tickFreq: 1900, tickFreqAlt: 1500, tickDur: 0.02, tickGain: 0.035,
    sprayMinSpeed: 240, sprayGap: 0.035, sprayCount: 2, spraySpeed: 70, sprayLife: 0.35, spraySize: 1.8, // Tip specks (design units per second for the speed gate)
    slipFlashSec: 0.45, slipPopSec: 0.3, slipPopFrom: 1.5, // Outline red flash, counter pop
    slipShake: 2, slipShakeSec: 0.15, slipHaptic: 30, ruinHaptic: 50, slipBurst: 6,
    pctStepFrom: 1.1, pctStepSec: 0.18,      // Whole-percent step at or past the first star threshold
    pctThresholdFrom: 1.35, pctThresholdSec: 0.32, pctStarSec: 0.7, // Crossing a star threshold: bigger pop and the number turns star colour
    timerPulseFrom: 1.18, timerPulseSec: 0.28, timerPulseSecs: 5, // Timer pulse each second in the last few seconds
    timerTickSecs: 3, timerTickFreq: 700, timerTickDur: 0.03, timerTickGain: 0.05,
    finishHaptic: 30, finishFlashSec: 0.3, finishFlashAlpha: 0.55,
    burstPoints: 36, burstPer: 3, burstSpeed: 110, burstLife: 0.75, burstSize: 3.6,
    outlineFadeSec: 0.5, outlineEndAlpha: 0.12, machineFadeSec: 0.25,
    smearSec: 0.5, smearDrop: 3, loseDelay: 0.2,
    cardSlideSec: 0.45, cardFrom: 0.5, // Card slide-up; the slide starts this fraction of the screen height below
    starDelay: 0.2, starStagger: 0.08, starSec: 0.25, starBurst: 5,
    buttonGap: 0.08, buttonPopSec: 0.18,     // Buttons appear this long after the last star lands, and pop in
    cleanDelay: 0.1, cleanPopSec: 0.3, cleanSweepSec: 0.7, cleanSweepAlpha: 0.4,
    menuPopDelay: 0.18, menuPopSec: 0.4, menuPopFrom: 0.8,
  },

  // Layer 5: art. Tattoo flash. Every colour and every drawing number lives here; cosmetic only, nothing below touches coverage, slips, the timer, stars, saves or the hint.
  // Three semantic colours keep their meaning everywhere: stencil blue is the goal, ink black is progress, slip red is danger (and appears nowhere else).
  art: {
    pal: {
      drape: '#28170f',          // The cloth around the body part; also the engine's screen fill (bg)
      skinLight: '#a9714f', skinMid: '#96603f', skinDark: '#774a33', skinShade: '#4d281c', skinHi: '#ffddb8', // Body part shading, light to dark
      pore: '#5a2e21', blush: '#df8a60',                 // Pores; the warm skin tint of the halo around a finished piece (a tan, not the slip red)
      stencil: '#c6ecff', stencilDeep: '#5a8fd8', stencilShadow: '#2b1710', // Goal: the outline, its faint second edge, and the dark line under it that keeps it readable on skin
      ink: '#070a13', inkSheen: '#22366e', inkGloss: '#6786d6', facet: '#c9d8fa', inkHalo: '#0b0f1b', // Progress: near-black, the blue sheen in it, gloss and specks, the bleed halo
      slip: '#f2493f', slipShadow: '#2a0907',              // Danger
      gold: '#ffd166',                                    // Accent: a star threshold crossed
      paper: '#eee1c4', paperShade: '#d6c298', paperEdge: '#a48b5e', stamp: '#2b5fb4', // Accent: flash paper, its shade and edge line, the blue of the Clean stamp
      board: '#c8b083', boardDark: '#9d8256', boardHi: '#ecdcb6', boardFiber: '#7d6640', // Menu board
      cream: '#f8eedd', textDark: '#17110d', textMute: '#76624d', // Text on skin and on paper
      plate: '#0d0908', shadow: '#1b0d07', smear: '#7d7f88', // HUD plates and drop shadows; the grey of a ruined piece's smear
      steel: '#cdd3de', steelDark: '#646c7f', machine: '#1a1e2a', machineHi: '#3d4660', band: '#e2a93c', cable: '#12141b', glint: '#fffaf0',
      amber: '#ffb238',                                  // The countdown in the last five seconds (slip red is for slips only)
      pin: '#b98a2e', pinHi: '#f1d58a', lock: '#a08c6c',
      medal: ['#b87a3e', '#b7c0ca', '#e6b73f'], // Badge tiers: Apprentice bronze, Artist silver, Master gold
    },
    type: { display: "'Arial Black','Impact','Helvetica Neue',system-ui,sans-serif", weight: 900, hero: 66, big: 34, mid: 20, small: 14, outline: 0.17 }, // Type scale (nothing under 14 px), one heavy weight; outline is a fraction of the size
    line: { weight: 2, radius: 12, shadowDx: 2, shadowDy: 3, shadowAlpha: 0.32 }, // Line weight, corner radius and drop shadow used by every plate, card and button
    field: {
      extent: [-300, -380, 660, 1240],  // Design-space rectangle the body layer covers
      bodyScale: 0.9,                   // Body layer pixels per design unit (the shading is soft)
      compMaxDpr: 2, grainMaxDpr: 1.5, tile: 128, grain: 0.15, grainCurve: 1.6, seed: 20260929, // Baked field (drape, body, grain) and grain overlay: max pixels per CSS pixel, noise tile size, peak alpha, curve, seed
      poreDensity: 0.00085, poreR0: 0.5, poreR1: 1.35, poreAlpha0: 0.06, poreAlpha1: 0.2, // Pores per screen px squared, radius range, alpha range
      vignette: 0.6, vigInner: 0.28, vigOuter: 0.72, // Vignette strength, and inner and outer radius as a fraction of the screen diagonal
    },
    body: { rimWidth: 130, rimSteps: 28, rimAlpha: 0.03, hi: 0.2, shade: 0.5 }, // Soft rim: this many strokes narrowing from this width, each this faint; strength of highlights and shade on every body part
    outline: { amp: 0.8, step: 5, lamA: 20, lamB: 32, lam2A: 8, lam2B: 13, edgeAmp: 1.4, edgeOffset: 1.5, edgeWidth: 1.1, edgeAlpha: 0.55, shadowWidth: 3, shadowAlpha: 0.45, alpha: 0.96 }, // Wobble (design units, sample step, wavelengths), the faint second edge, the dark line under it
    ink: { tile: 96, widthTol: 0.8, sheenAlpha: 0.27, haloPad: 3, haloAlpha: 0.06, blitMargin: 8 }, // Sheen pattern size and strength; bleed: how far past a stroke it reaches (design units) and how faint each stamp of it is; margin around the stencil that is blitted
    story: { delay: 0.35, sec: 0.55, facetFrom: 95, facetWidth: 1.8, facetAlpha: 0.9, glintSize: 11, swirlWidth: 2.6, swirlAlpha: 0.9, bannerText: 'LOVE', bannerTilt: -0.07 }, // Card decorations: reveal timing, the percent the gem facets start showing
    machine: { needleLen: 9, needleW: 1.4, nozzleTopW: 3.2, nozzleW: 9, nozzleEnd: 29, bandLen: 3, neckEnd: 46, neckW: 13, gripEnd: 98, gripW: 25, tailEnd: 128, tailW: 15, cableW: 4.5, cableAlpha: 0.85, shadowDx: 3, shadowDy: 4, shadowAlpha: 0.3, knurl: 5 }, // Pen-style machine, screen px from the needle tip down to the cable
    hud: { plateAlpha: 0.5, plateH: 46, timerW: 74, pipGap: 22, pipR: 7, pipW: 3.2 }, // Timer and slip plates
    menu: { margin: 16, tilt: 0.03, tileWant: 116, tileMin: 100, tileMax: 132, titleMin: 0.55, topPad: 8, rowH: 44, gapTag: 8, gapDaily: 10, dailyH: 52, gapPlay: 10, playH: 52, soundW: 56, missionsW: 124, botPad: 10, warmMs: 3, slackTop: 0.4, numH: 22, badgeW: 46, badgeH: 18, cleanW: 56, pinR: 4.5, cardR: 5, fiberDensity: 0.0032, boardMaxDpr: 1.5, tab: { w: 74, y: 10, h: 32 } }, // Flash-sheet menu: tile heights it wants, its limits and the title's, gaps and button heights (44 px at least), and the engine's TUNE tab it must clear
    missions: { top: 60, rowH: 60, rowGap: 8, headH: 30, medalR: 18, bottom: 84, backW: 224, backH: 52, scrollBar: 3 }, // Missions screen: the list scrolls between the heading and the Back button
    // Skins (PRD v0.5 section F): data entries, each earned by one badge and never by grind. A machine skin overrides the machine palette and adds one decoration to the same
    // silhouette; an ink skin overrides the ink, its sheen, gloss and bleed halo. Anything a skin leaves out is the default palette. The outline, the hint and the slip colours never change.
    skins: {
      machines: [
        { id: 'steel', name: 'Steel', badge: null },
        { id: 'brass', name: 'Brass', badge: 'steady-hand', body: '#a9822f', hi: '#e2c06a', steel: '#cfa84c', steelDark: '#6e5216', band: '#0d0d10', cable: '#12141b', deco: 'gripband' },
        { id: 'rose', name: 'Rose Gold', badge: 'cornered', body: '#b8746f', hi: '#efc0b4', steel: '#e8b4a6', steelDark: '#7a4642', band: '#f1d4c8', cable: '#3a1f24', deco: 'plate' },
        { id: 'obsidian', name: 'Obsidian', badge: 'flash-sheet', body: '#101116', hi: '#242631', steel: '#3a3d4a', steelDark: '#0a0a0e', band: '#3a3d4a', cable: '#0a0a0e', deco: 'ring' },
        { id: 'bone', name: 'Bone', badge: 'bone', body: '#d9cfb4', hi: '#fff6dc', steel: '#efe6cc', steelDark: '#8a7f68', band: '#8a7f68', cable: '#2a2320', deco: null },
      ],
      inks: [
        { id: 'black', name: 'Black', badge: null },
        { id: 'blue', name: 'Blue', badge: 'five-stars', ink: '#0a1c66', sheen: '#3a63f0', gloss: '#8fb0ff', halo: '#0a1c66', sheenA: 0.3 },
        { id: 'red', name: 'Red', badge: 'thin-line', ink: '#560c14', sheen: '#a83333', gloss: '#e88a80', halo: '#560c14', sheenA: 0.3 },
        { id: 'green', name: 'Green', badge: 'serpent', ink: '#082b15', sheen: '#237a42', gloss: '#8fdcaa', halo: '#082b15', sheenA: 0.28 },
        { id: 'gold', name: 'Gold', badge: 'full-sleeve', ink: '#2e2006', sheen: '#b8892a', gloss: '#ffe08a', halo: '#2e2006', sheenA: 0.22 },
      ],
      swatch: { size: 52, gap: 12, headH: 24, rowGap: 6, ring: 3, pen: 0.62 }, // The Skins block on the missions screen (swatch size at least 44 px) and the menu pen's scale
    },
    badge: { h: 32, w: 320, popSec: 0.3, delay: 0.25, medalR: 11 }, // The badge ticket over the result card
    title: { size: 92, w: 280, h: 130, glyphHalf: 100, glyphTop: 22, seed: 4242, passes: 18, jitter: 1.7, edge: 2.4, edgePasses: 7, streaks: 90, streakMin: 14, streakMax: 64, shadowDx: 4, shadowDy: 4, swash: 8 }, // Brush-stroke title
    card: { h: 318, w: 340, pad: 14, topPad: 26, pieceGap: 46, sidePad: 34, minScale: 0.5, maxScale: 1, starR: 17, starGap: 44, stampW: 112, stampH: 34, stampTilt: -0.1, blushMargin: 48, blushScale: 0.9, blush: 0.42, blushBlur: 34 }, // Result card
    star: { inner: 0.45, sheen: 0.55 }, // Ink stars
  },
};
const T = TUNING;
const J = T.juice;
const A = T.art, P = A.pal;
T.bg = P.drape;

const circle = (cx, cy, r, n = T.circlePoints) =>
  Array.from({ length: n }, (_, i) => [cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n)]);

const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

// Stencil data. `shape` is a list of closed polygons in the 360x640 design space, even-odd (a polygon inside another is a hole).
// `perfect` is the time in seconds its intended path takes to reach 99 percent; `tier` picks the timer multiplier (early, mid, boss, final or skull: see TUNING.timerMult*); `timer` is its standard timer, `perfect` times that tier's standard multiplier, rounded up.
// `body` is the body part drawn behind the stencil (art only), `story` names a decoration added to the finished piece on the card (art only).
// Entries are pasted from the content shards' JSON (see docs/games/ink/README.md); tools/sim-ink.mjs verifies each one.
// Old stencil index to new index, for the save migration (see game.migrate).
const REMAP_TEN = [0, 1, 2, 3, 5, 4, 6, 7, 13, 12];
const REMAP_INTERIM = [0, 1, 2, 3, 8, 5, 9, 4, 6, 11, 10, 7, 13, 12, 14];

const STENCILS = [
  {
    // 
    name: "Circle", timer: 33, boss: false, tier: "early", perfect: 14.82, body: "forearm",
    shape: [[[305,320],[304.73236540482543,328.17539115376786],[303.9306076717263,336.31577402750645],[302.5981600504038,344.386290252016],[300.74072828613356,352.3523806378151],[298.3662661868882,360.17993316289517],[295.48494156391087,367.8354290456362],[292.10909269158606,375.28608627737515],[288.25317547305485,382.5],[283.93370153781814,389.4462791274503],[279.1691675364044,396.0951786260901],[273.9799759348722,402.4182268875086],[268.3883476483185,408.3883476483184],[262.4182268875086,413.9799759348722],[256.0951786260901,419.1691675364044],[249.44627912745028,423.93370153781814],[242.5,428.25317547305485],[235.28608627737515,432.10909269158606],[227.83542904563623,435.48494156391087],[220.17993316289522,438.3662661868882],[212.3523806378151,440.74072828613356],[204.38629025201604,442.5981600504038],[196.31577402750645,443.9306076717263],[188.17539115376792,444.73236540482543],[180,445],[171.8246088462321,444.73236540482543],[163.68422597249355,443.9306076717263],[155.613709747984,442.5981600504038],[147.6476193621849,440.74072828613356],[139.8200668371048,438.3662661868882],[132.1645709543638,435.48494156391087],[124.71391372262485,432.10909269158606],[117.50000000000003,428.25317547305485],[110.55372087254972,423.93370153781814],[103.90482137390991,419.1691675364044],[97.58177311249139,413.9799759348722],[91.61165235168157,408.3883476483185],[86.02002406512784,402.41822688750864],[80.83083246359561,396.0951786260901],[76.06629846218188,389.44627912745034],[71.74682452694516,382.5],[67.89090730841399,375.2860862773752],[64.51505843608916,367.83542904563626],[61.6337338131118,360.1799331628952],[59.25927171386647,352.35238063781514],[57.401839949596194,344.386290252016],[56.06939232827371,336.3157740275065],[55.26763459517457,328.1753911537679],[55,320],[55.26763459517457,311.82460884623214],[56.06939232827371,303.68422597249355],[57.40183994959618,295.613709747984],[59.259271713866454,287.6476193621849],[61.63373381311179,279.82006683710483],[64.51505843608915,272.1645709543638],[67.89090730841397,264.7139137226248],[71.74682452694515,257.50000000000006],[76.06629846218182,250.55372087254977],[80.8308324635956,243.9048213739099],[86.02002406512783,237.5817731124914],[91.61165235168151,231.6116523516816],[97.58177311249136,226.02002406512784],[103.9048213739099,220.83083246359564],[110.55372087254973,216.06629846218186],[117.49999999999994,211.7468245269452],[124.71391372262482,207.89090730841397],[132.1645709543638,204.51505843608913],[139.82006683710478,201.6337338131118],[147.6476193621849,199.25927171386644],[155.61370974798393,197.4018399495962],[163.68422597249355,196.0693923282737],[171.82460884623217,195.26763459517457],[179.99999999999997,195],[188.1753911537678,195.26763459517457],[196.3157740275064,196.0693923282737],[204.38629025201604,197.4018399495962],[212.35238063781503,199.25927171386644],[220.17993316289517,201.6337338131118],[227.83542904563615,204.51505843608913],[235.28608627737512,207.89090730841394],[242.5,211.74682452694518],[249.44627912745023,216.0662984621818],[256.09517862609,220.83083246359553],[262.41822688750864,226.02002406512787],[268.3883476483184,231.61165235168153],[273.9799759348722,237.58177311249142],[279.16916753640436,243.9048213739099],[283.9337015378181,250.55372087254963],[288.2531754730548,257.49999999999994],[292.10909269158606,264.71391372262485],[295.48494156391087,272.1645709543638],[298.3662661868882,279.8200668371048],[300.7407282861335,287.6476193621848],[302.5981600504038,295.61370974798393],[303.9306076717263,303.68422597249355],[304.73236540482543,311.82460884623214]]],
  },
  {
    // 
    name: "Diamond", timer: 29, boss: false, tier: "early", perfect: 13.12, body: "shoulder", story: "gem",
    shape: [[[130,150],[230,150],[295,262],[295,276],[180,540],[65,276],[65,262]]],
  },
  {
    // 
    name: "Heart", timer: 26, boss: false, tier: "early", perfect: 11.55, body: "calf", story: "banner",
    shape: [[[180,238.7],[185.4,233],[191.3,228],[197.5,223.7],[204.2,220.2],[211.1,217.6],[218.2,215.8],[225.4,214.9],[232.6,214.9],[239.8,215.8],[246.9,217.6],[253.8,220.2],[260.5,223.7],[266.7,228],[272.6,233],[278,238.7],[282.9,245.1],[287.1,252],[290.7,259.4],[293.7,267.2],[295.9,275.4],[297.4,283.7],[298.2,292.3],[298.2,300.8],[297.4,309.3],[295.9,317.7],[293.7,325.8],[290.7,333.7],[287.1,341.1],[282.9,348],[278,354.4],[180,470],[82,354.4],[77.1,348],[72.9,341.1],[69.3,333.7],[66.3,325.8],[64.1,317.7],[62.6,309.3],[61.8,300.8],[61.8,292.3],[62.6,283.7],[64.1,275.4],[66.3,267.2],[69.3,259.4],[72.9,252],[77.1,245.1],[82,238.7],[87.4,233],[93.3,228],[99.5,223.7],[106.2,220.2],[113.1,217.6],[120.2,215.8],[127.4,214.9],[134.6,214.9],[141.8,215.8],[148.9,217.6],[155.8,220.2],[162.5,223.7],[168.7,228],[174.6,233]]],
  },
  {
    // 
    name: "Star", timer: 24, boss: false, tier: "early", perfect: 10.69, body: "shoulder", story: "swirl",
    shape: [[[180,200],[217,299],[322.7,303.6],[239.9,369.5],[268.2,471.4],[180,413],[91.8,471.4],[120.1,369.5],[37.3,303.6],[143,299]]],
  },
  {
    // 
    name: "Bolt", timer: 29, boss: false, tier: "mid", perfect: 15.23, body: "calf",
    shape: [[[166,110],[298,110],[234,272],[310,272],[98,560],[170,352],[50,352]]],
  },
  {
    // 
    name: "Crescent", timer: 19, boss: true, tier: "boss", perfect: 10.69, body: "back",
    shape: [[[338.2,144.7],[312.7,133.6],[286,125.4],[258.3,120.5],[230,119],[201.5,121.2],[173.3,127.1],[146,136.7],[120,150],[95.8,166.7],[74.1,186.6],[55.2,209.3],[39.6,234.5],[27.5,261.7],[19.3,290.2],[15.1,319.5],[14.9,349.1],[18.8,378.3],[26.5,406.7],[38,433.5],[52.7,458.5],[70.5,481.1],[91,501.1],[113.6,518.1],[138,532.2],[163.7,543.1],[190.3,551],[196.5,551],[201.9,547.8],[205,542.5],[205,536.3],[201.9,530.9],[196.5,527.8],[173.6,519],[152.3,507],[133,492.3],[116,475.4],[101.4,456.6],[89.3,436.3],[80,414.9],[73.4,392.8],[69.5,370.1],[68.2,347.3],[69.7,324.7],[73.6,302.4],[80.1,280.8],[89.1,260.1],[100.3,240.5],[113.8,222.2],[129.4,205.5],[146.9,190.7],[166.2,178],[187.2,167.6],[209.4,159.8],[232.7,154.8],[256.6,152.8],[280.8,154],[304.8,158.4],[328,166.4],[334.2,167.5],[340,165.4],[344,160.6],[345.1,154.5],[342.9,148.7]]],
  },
  {
    // 
    name: "Halo", timer: 18, boss: false, tier: "mid", perfect: 9.07, body: "back",
    shape: [[[345,335],[341.8,367.2],[332.4,398.1],[317.2,426.7],[296.7,451.7],[271.7,472.2],[243.1,487.4],[212.2,496.8],[180,500],[147.8,496.8],[116.9,487.4],[88.3,472.2],[63.3,451.7],[42.8,426.7],[27.6,398.1],[18.2,367.2],[15,335],[18.2,302.8],[27.6,271.9],[42.8,243.3],[63.3,218.3],[88.3,197.8],[116.9,182.6],[147.8,173.2],[180,170],[212.2,173.2],[243.1,182.6],[271.7,197.8],[296.7,218.3],[317.2,243.3],[332.4,271.9],[341.8,302.8]],[[310,335],[307.5,360.4],[300.1,384.7],[288.1,407.2],[271.9,426.9],[252.2,443.1],[229.7,455.1],[205.4,462.5],[180,465],[154.6,462.5],[130.3,455.1],[107.8,443.1],[88.1,426.9],[71.9,407.2],[59.9,384.7],[52.5,360.4],[50,335],[52.5,309.6],[59.9,285.3],[71.9,262.8],[88.1,243.1],[107.8,226.9],[130.3,214.9],[154.6,207.5],[180,205],[205.4,207.5],[229.7,214.9],[252.2,226.9],[271.9,243.1],[288.1,262.8],[300.1,285.3],[307.5,309.6]]],
  },
  {
    // 
    name: "Clover", timer: 53, boss: false, tier: "mid", perfect: 27.88, body: "back",
    shape: [[[105.2,138.5],[116,138],[127,139.1],[137.5,141.6],[143,143.6],[148,145.8],[157.5,151.3],[166,157.9],[173.5,165.6],[180,174.4],[183.5,169.3],[187.5,164.4],[191.7,160],[196.5,155.7],[201.5,151.9],[206.9,148.5],[212.5,145.6],[218,143.2],[224,141.2],[230,139.7],[236,138.6],[242.5,138.1],[249,138.1],[255,138.5],[261,139.5],[267,140.9],[277,144.4],[286,149],[294.6,155],[302.5,162.2],[309.4,170.5],[314.9,179.5],[319.2,189],[322.1,199],[323.2,205],[323.8,211],[324,217],[323.7,223],[322.9,229],[321.8,234.5],[320.1,240.5],[318,246],[315.5,251.5],[312.5,256.8],[309.4,261.5],[305.5,266.4],[301.5,270.8],[297,275],[292.5,278.6],[287.6,282],[294,286.5],[299.8,291.5],[305,297],[309.7,303],[313.8,309.5],[317.4,316.5],[320.1,323.5],[322.1,331],[323.4,338.5],[324,346],[323.8,354],[322.8,361.5],[321.1,369],[318.6,376.5],[315.5,383.5],[311.5,390.4],[306.3,397.5],[300.5,403.8],[294,409.5],[286.8,414.5],[279,418.7],[271,421.9],[262.5,424.2],[254,425.6],[245.5,426],[237,425.5],[228.5,424],[220,421.5],[212,418.2],[204.5,414],[198,409.5],[190.5,402.8],[190.3,403],[193.6,424],[200.6,460],[202.9,473.5],[204.7,487],[205.9,501],[206.1,511],[205.9,521],[204.6,537],[201.9,554],[201,555.7],[199,556.9],[197,556.9],[195.5,556.2],[194.5,555],[194,553],[196.1,537],[197,521.5],[196.8,507.5],[195,489.5],[191.1,467.5],[180.5,420],[176.2,395.5],[176,395.3],[172.1,400],[167.8,404.5],[159.5,411.4],[150.5,416.9],[140.5,421.4],[130,424.3],[119,425.8],[108,425.8],[97,424.1],[86.5,421],[76.5,416.4],[71.6,413.5],[67,410.2],[58.7,403],[51.5,394.7],[45.6,385.5],[41,375.5],[37.9,365],[36.8,359],[36.2,353],[36,347],[36.3,341],[37.1,335],[38.2,329.5],[39.9,323.5],[42,318],[44.5,312.5],[47.5,307.2],[50.6,302.5],[54.5,297.6],[58.5,293.2],[63,289],[67.5,285.4],[72.4,282],[67.3,278.5],[62.4,274.5],[57.7,270],[53.5,265.2],[49.9,260.5],[46.5,255],[43.6,249.5],[41,243.5],[39,237.5],[37.6,231.5],[36.6,225.5],[36.1,219],[36.1,212.5],[36.6,206.5],[37.7,200],[39.2,194],[41,188.5],[43.3,183],[45.9,178],[48.9,173],[52.1,168.5],[55.9,164],[59.7,160],[64,156.1],[68.5,152.6],[73.2,149.5],[78.5,146.5],[83.5,144.2],[94,140.6],[99.5,139.4]]],
  },
  {
    // Teaches tips 3 and 4 on a sharp point and a hollow blade: the blade edges and the fuller loop 8 inside cover the whole blade with no middle rows, and the tip needs a lift. Path: hold at the pommel and ride the grip up at 175, loop the pommel, hold at the left knob and ride the guard to the right knob at 175, then both blade edges from the guard up to the point (lift there) and the fuller loop, all 8 inside at 200.
    name: "Dagger", timer: 18, boss: false, tier: "mid", perfect: 9.3, body: "calf",
    shape: [[[174.5,130.7],[168.7,155.6],[160.8,193],[152.3,236.5],[144.3,280.1],[144,286.4],[144,379.3],[131.5,381.4],[116.5,385],[101.6,389.8],[90.4,394.1],[79.2,399.2],[68,405],[64.5,405.5],[61.3,407],[59.5,408.5],[57.4,411.3],[56.2,414.7],[56,417],[56.2,419.3],[56.9,421.6],[58,423.7],[59.5,425.5],[61.3,427],[63.4,428.1],[66.8,428.9],[69.2,428.9],[71.5,428.5],[73.7,427.6],[75.6,426.3],[77.8,423.9],[90.4,418.1],[101.6,413.8],[116.5,409],[127.7,406.2],[142.7,403.5],[153.9,402.1],[168,401.2],[168,511.8],[163.8,515.7],[161.5,519.1],[160.6,521],[159.4,524.9],[159.1,526.9],[159.1,531.1],[159.4,533.1],[160.6,537],[162.5,540.7],[165.2,543.8],[168.3,546.5],[172,548.4],[175.9,549.6],[180,550],[184.1,549.6],[188,548.4],[191.7,546.5],[194.8,543.8],[197.5,540.7],[199.4,537],[200.6,533.1],[200.9,531.1],[200.9,526.9],[200.6,524.9],[199.4,521],[198.5,519.1],[196.2,515.7],[192,511.8],[192,401.2],[206.1,402.1],[217.3,403.5],[232.3,406.2],[243.5,409],[258.4,413.8],[269.6,418.1],[282.2,423.9],[284.4,426.3],[286.3,427.6],[288.5,428.5],[290.8,428.9],[293.2,428.9],[295.5,428.5],[297.7,427.6],[299.6,426.3],[302,423.7],[303.1,421.6],[303.8,419.3],[304,417],[303.5,413.5],[302.6,411.3],[301.3,409.4],[298.7,407],[295.5,405.5],[292,405],[280.8,399.2],[269.6,394.1],[258.4,389.8],[243.5,385],[228.5,381.4],[216,379.3],[216,286.4],[215.7,280.1],[204.1,217.9],[194,168],[185.5,130.7],[182.2,118.2],[180,112],[177.8,118.2]],[[181.2,205.4],[182.7,221.6],[183.8,243.2],[184.5,264.8],[184.6,286.4],[184.1,313.4],[183,335],[181.2,356.6],[180,362],[178.8,356.6],[178.2,351.2],[176.7,329.6],[175.8,308],[175.4,281],[175.8,254],[176.7,232.4],[178.2,210.8],[178.8,205.4],[180,200]]],
  },
  {
    // Teaches tip 4 on thin limbs (21 to 28 units wide): one centre lane per limb at 175 units per second lets the wide slow needle cover it, and lifts at the flukes' points. Path: hold 0.4 s in the left fluke tip and ride its two edges 7 inside, sweep the crown arc to the right fluke and ride its two edges, then the crossbar with a small loop at each knob, then a lap of the ring curving down the shank to the crown; all at 175.
    name: "Anchor", timer: 19, boss: false, tier: "mid", perfect: 9.54, body: "forearm",
    shape: [[[217,144.7],[213.3,137.8],[210.9,134.6],[205.4,129.1],[198.9,124.7],[191.6,121.7],[183.9,120.2],[176.1,120.2],[172.2,120.8],[164.7,123],[157.8,126.7],[151.7,131.7],[149.1,134.6],[144.7,141.1],[143,144.7],[140.8,152.2],[140,160],[140.2,163.9],[140.8,167.8],[143,175.3],[144.7,178.9],[149.1,185.4],[154.6,190.9],[157.8,193.3],[161.1,195.3],[168,198.1],[168,222],[109,222],[107.1,220.8],[104.4,219.6],[101.5,219.1],[98.5,219.1],[94.3,220.1],[91.7,221.5],[89.4,223.4],[86.8,226.9],[85.6,229.6],[85.1,232.5],[85.3,236.9],[86.1,239.7],[87.5,242.3],[89.4,244.6],[91.7,246.5],[94.3,247.9],[97.1,248.7],[100,249],[102.9,248.7],[105.7,247.9],[109,246],[168,246],[168,514.9],[157.1,513.2],[148.2,511],[143.8,509.5],[135.2,506.1],[131,504.1],[123,499.5],[115.3,494.3],[111.7,491.4],[104.8,485.2],[101.5,481.9],[95.5,474.9],[92.7,471.1],[87.6,463.4],[83.2,455.1],[79.5,446.6],[76.6,437.7],[75.5,433.2],[73.8,424],[72.9,414.7],[72.8,405.3],[73.1,399.3],[91.9,402.6],[70.7,350.1],[32.9,392.2],[52.3,395.6],[51.5,404.4],[51.3,410],[51.7,421.2],[53.1,432.4],[54.1,437.9],[56.9,448.8],[60.7,459.4],[62.9,464.6],[68,474.6],[74,484.2],[77.3,488.8],[84.5,497.5],[92.4,505.6],[101,512.9],[110.2,519.5],[120,525.3],[130.2,530.2],[140.9,534.1],[151.8,537.2],[163,539.2],[174.3,540.3],[180,540.5],[191.4,539.9],[202.6,538.3],[208.2,537.2],[219.1,534.1],[229.8,530.2],[234.9,527.8],[244.9,522.5],[254.5,516.3],[259,512.9],[267.6,505.6],[275.5,497.5],[279.2,493.2],[286,484.2],[289.1,479.5],[294.6,469.7],[297.1,464.6],[301.3,454.2],[304.6,443.4],[305.9,437.9],[307.7,426.8],[308.3,421.2],[308.7,410],[308.5,404.4],[307.7,395.6],[327.1,392.2],[289.3,350.1],[268.1,402.6],[286.9,399.3],[287.2,405.3],[287.1,414.7],[286.2,424],[284.5,433.2],[283.4,437.7],[280.5,446.6],[276.8,455.1],[272.4,463.4],[267.3,471.1],[264.5,474.9],[258.5,481.9],[255.2,485.2],[248.3,491.4],[244.7,494.3],[237,499.5],[229,504.1],[224.8,506.1],[216.2,509.5],[211.8,511],[202.9,513.2],[192,514.9],[192,246],[251,246],[252.9,247.2],[255.6,248.4],[258.5,248.9],[261.5,248.9],[265.7,247.9],[268.3,246.5],[270.6,244.6],[272.5,242.3],[273.9,239.7],[274.9,235.5],[274.9,232.5],[274.4,229.6],[273.2,226.9],[271.6,224.5],[268.3,221.5],[265.7,220.1],[262.9,219.3],[260,219],[257.1,219.3],[254.3,220.1],[251,222],[192,222],[192,198.1],[198.9,195.3],[202.2,193.3],[208.3,188.3],[213.3,182.2],[217,175.3],[218.3,171.6],[219.8,163.9],[219.8,156.1],[219.2,152.2]],[[194.8,166.1],[193.3,168.9],[191.3,171.3],[188.9,173.3],[186.1,174.8],[183.1,175.7],[180,176],[176.9,175.7],[173.9,174.8],[171.1,173.3],[168.7,171.3],[166.7,168.9],[165.2,166.1],[164.3,163.1],[164,160],[164.3,156.9],[165.2,153.9],[166.7,151.1],[168.7,148.7],[171.1,146.7],[173.9,145.2],[176.9,144.3],[180,144],[183.1,144.3],[186.1,145.2],[188.9,146.7],[191.3,148.7],[193.3,151.1],[194.8,153.9],[195.7,156.9],[196,160],[195.7,163.1]]],
  },
  {
    // Teaches tips 2 and 6 on a fat head with slits: ride every edge and slit 8 inside and flood only what is left, planning the tour so the finger lifts little. Path: hold at the stem foot and ride the stem up at 175 with a lift to loop each leaf's two edges 8 inside at 175, then the head's outer lap and the four slit loops 8 inside at 200, then rows 17 apart at 300 over the middle that is left; lift at the leaf and sepal tips.
    name: "Rose", timer: 33, boss: false, tier: "mid", perfect: 17.31, body: "shoulder",
    shape: [[[209.4,125.6],[205.8,122.6],[201.9,120],[197.8,117.9],[193.5,116.2],[189.1,115],[184.5,114.2],[180,114],[175.5,114.2],[170.9,115],[166.5,116.2],[162.2,117.9],[158.1,120],[154.2,122.6],[150.6,125.6],[147.2,129],[144.1,132.7],[141.4,136.8],[139.1,141.1],[137.4,145.1],[131.7,142.5],[127,141],[122.3,140],[117.6,139.5],[112.9,139.6],[108.3,140.1],[103.9,141.2],[99.6,142.8],[95.6,144.9],[91.8,147.5],[88.3,150.5],[85.1,154],[82.3,157.8],[79.9,161.9],[77.9,166.4],[76.3,171.2],[75.2,176.1],[74.5,181.3],[74.3,186.5],[74.5,191.9],[75.2,197.2],[76.4,202.5],[78,207.8],[80,212.9],[82.4,217.8],[85.3,222.5],[88.4,226.9],[94.7,233.7],[92.8,240.4],[92.3,244.3],[92.5,252.1],[94.3,259.9],[97.5,267.2],[102.2,273.8],[105,276.7],[108.1,279.4],[114.9,283.8],[122.5,286.8],[126.4,287.8],[134.5,288.6],[142,288],[143.7,290.4],[114.4,312.4],[161.4,302.8],[168.1,304.7],[167.6,333],[168,360.8],[171.6,449.6],[172.4,489.1],[166.7,482.3],[160,475.1],[152.9,468.5],[145.3,462.2],[137.4,456.5],[129,451.4],[120.4,446.8],[111.5,442.7],[102.3,439.3],[93,436.4],[78.6,433.3],[68.9,432],[59.1,431.4],[49.3,431.4],[40,432],[46.1,440],[52.6,447.3],[59.5,454.3],[66.8,460.7],[74.6,466.7],[82.8,472.1],[91.2,477],[100,481.3],[109.1,485.1],[118.3,488.2],[127.8,490.8],[137.4,492.7],[147.1,494],[156.9,494.6],[172.3,494.3],[172.1,507.7],[171.3,523.5],[169,548.9],[169.4,551],[170.2,553],[171.4,554.8],[172.9,556.4],[174.6,557.6],[176.6,558.5],[178.7,558.9],[180.9,559],[183,558.6],[185,557.8],[186.8,556.6],[188.4,555.1],[189.6,553.4],[190.5,551.4],[191.8,541.4],[193.7,516.8],[194.4,491.7],[194.1,466],[192.9,432.1],[208.5,431.4],[218.4,430.1],[228.2,428.1],[237.9,425.5],[247.3,422.3],[256.6,418.5],[265.5,414.1],[274.2,409],[282.5,403.5],[290.5,397.4],[298,390.8],[305,383.7],[311.6,376.2],[317.7,368.3],[322,362],[306.5,362.2],[296.6,363.2],[286.7,364.8],[277,367.1],[267.4,370],[258,373.5],[248.9,377.7],[240.1,382.4],[231.6,387.7],[219.5,396.6],[212,403.2],[205,410.3],[198.4,417.8],[192.6,425.3],[190.5,378.2],[189.8,351.2],[189.7,324],[190.1,305.1],[198.6,302.8],[245.6,312.4],[216.3,290.4],[218,288],[225.5,288.6],[229.5,288.4],[237.5,286.8],[241.4,285.5],[245.1,283.8],[251.9,279.4],[257.8,273.8],[260.3,270.6],[262.5,267.2],[265.7,259.9],[267.5,252.1],[267.7,244.3],[267.2,240.4],[265.3,233.7],[271.6,226.9],[274.7,222.5],[277.6,217.8],[280,212.9],[282,207.8],[283.6,202.5],[284.8,197.2],[285.5,191.9],[285.7,186.5],[285.5,181.3],[284.8,176.1],[283.7,171.2],[282.1,166.4],[280.1,161.9],[277.7,157.8],[274.9,154],[271.7,150.5],[268.2,147.5],[264.4,144.9],[260.4,142.8],[256.1,141.2],[251.7,140.1],[247.1,139.6],[242.4,139.5],[237.7,140],[233,141],[228.3,142.5],[222.6,145.1],[220.9,141.1],[218.6,136.8],[215.9,132.7],[212.8,129]],[[168.7,172.2],[172,169.6],[175.9,167.7],[180.2,166.6],[184.6,166.4],[189.1,167],[193.4,168.6],[197.4,170.9],[199.1,172.4],[202.1,175.9],[204.3,179.9],[205.5,184.3],[205.8,186.6],[205.8,188.9],[204.9,193.4],[203.1,197.6],[200.5,201.3],[198.9,202.9],[195.2,205.6],[191,207.5],[186.6,208.5],[182.1,208.6],[177.8,207.9],[173.7,206.3],[170.2,204],[168.8,202.5],[166.6,199.3],[167.2,198.6],[170.5,200.2],[173.7,201.3],[178.7,202],[183.5,201.5],[186.5,200.5],[189.2,199.1],[191.4,197.3],[194,194.2],[195.4,190.7],[195.8,187.1],[195.1,183.5],[193.3,180.1],[190.4,177.1],[188,175.6],[185.2,174.4],[182.2,173.6],[177.3,173.5],[172.5,174.6],[169.3,175.9],[166.2,177.8],[165.5,177.2],[167.4,173.8]],[[128,241.4],[125.6,239.5],[122.4,236.2],[119.8,232.4],[118.5,229.7],[117,225.4],[116.5,222.4],[116.5,216.4],[117,213.4],[118.3,209.1],[119.6,206.4],[122.1,202.5],[125.3,199.1],[127.6,197],[133.2,193.8],[133.5,194.2],[130,200.9],[127.5,207],[126.2,211.7],[125.5,216.2],[125.4,222.8],[126.1,228.5],[127.8,234.6],[131.1,242.7],[130.7,243.1]],[[226.8,193.8],[231.1,196.1],[234.7,199.1],[236.9,201.3],[239.6,205],[241.7,209.1],[242.7,212],[243.5,216.4],[243.7,219.4],[243.5,222.4],[242.6,226.9],[241.5,229.7],[239.4,233.7],[236.6,237.3],[234.4,239.5],[232,241.4],[229.3,243.1],[228.9,242.7],[231.7,235.9],[233.6,229.7],[234.4,225.1],[234.7,219.5],[234,212.8],[232.5,207],[230,200.9],[226.5,194.2]],[[214.9,231.8],[213.4,235.8],[209.9,241.5],[207,244.9],[201.8,249.3],[195.8,252.7],[191.5,254.3],[184.6,255.8],[180,256.1],[175.4,255.8],[168.5,254.3],[164.2,252.7],[158.2,249.3],[153,244.9],[150.1,241.5],[146.6,235.8],[145.1,231.8],[145.6,231.4],[150.2,235.7],[155,239.4],[161.8,243.2],[165.3,244.6],[170.7,246.1],[174.4,246.7],[180,247.1],[185.6,246.7],[189.3,246.1],[194.7,244.6],[198.2,243.2],[205,239.4],[209.8,235.7],[214.4,231.4]]],
  },
  {
    // Teaches thin tips: the wing tips (about 25 units wide 45 from the point), tail streamers (about 21) and beak can only be inked by a slow centred pass, the fast middle rows never reach them. Path: ride the outline 7.2 inside at 175 in runs lifting at the armpit corners, a slow centre stroke out to each of the five tips, then fill wings, body and tail in rows 17 apart at 270.
    name: "Swallow", timer: 34, boss: false, tier: "mid", perfect: 17.47, body: "shoulder",
    shape: [[[180,134.5],[183.42,141.34],[186.3,146.83],[188.64,150.7],[190.53,153.4],[192.15,155.56],[193.59,157.63],[194.85,159.79],[195.84,162.04],[196.65,164.38],[197.19,166.72],[197.55,169.15],[197.73,171.67],[197.64,174.1],[197.46,176.53],[197.01,178.96],[196.47,181.39],[195.84,183.82],[195.12,186.16],[194.4,188.5],[193.77,190.84],[193.05,193.18],[192.42,195.43],[191.88,197.59],[191.52,199.66],[191.25,201.91],[191.25,204.43],[191.52,207.31],[192.06,210.46],[193.05,213.61],[194.49,216.58],[196.47,219.19],[198.9,221.35],[201.78,223.15],[204.84,224.5],[208.17,225.4],[211.5,225.94],[215.01,226.03],[218.52,225.85],[222.03,225.67],[225.9,225.67],[230.04,225.76],[234.54,226.21],[239.13,226.84],[243.81,227.65],[248.4,228.64],[252.99,229.81],[257.49,231.16],[261.99,232.69],[266.4,234.4],[270.81,236.2],[275.04,238.27],[279.27,240.43],[283.23,242.77],[287.1,245.29],[290.88,247.9],[294.48,250.6],[298.08,253.39],[301.41,256.45],[304.74,259.51],[307.89,262.75],[310.86,266.08],[313.74,269.5],[316.35,273.01],[318.87,276.61],[321.21,280.3],[323.46,283.99],[325.44,287.77],[327.33,291.55],[329.04,295.42],[330.66,299.38],[332.1,303.25],[333.36,307.3],[334.44,311.26],[335.43,315.31],[336.15,319.36],[336.78,323.41],[337.23,327.46],[337.5,331.42],[337.68,335.29],[337.68,339.07],[337.68,342.94],[337.59,346.72],[337.41,350.41],[337.23,354.19],[336.96,357.88],[336.6,361.57],[336.15,365.08],[335.7,368.32],[335.25,371.29],[334.8,373.9],[333.45,371.56],[332.01,368.95],[330.39,365.98],[328.77,362.83],[327.06,359.5],[325.35,356.17],[323.64,352.84],[322.02,349.6],[320.31,346.36],[318.6,343.21],[316.89,340.06],[315.18,337.09],[313.38,334.21],[311.49,331.51],[309.6,328.9],[307.71,326.47],[305.64,324.13],[303.48,321.88],[301.32,319.72],[299.07,317.65],[296.82,315.67],[294.48,313.87],[292.14,312.16],[289.71,310.54],[287.28,309.01],[284.85,307.57],[282.33,306.31],[279.9,305.14],[277.47,304.15],[275.04,303.25],[272.61,302.53],[270.09,301.9],[267.75,301.27],[265.59,300.82],[263.7,300.28],[261.99,299.83],[260.55,299.29],[259.02,299.02],[257.13,299.2],[254.79,300.01],[251.73,301.81],[248.13,304.6],[243.81,308.29],[239.22,312.61],[234.54,317.29],[230.04,321.97],[225.99,326.38],[222.57,330.52],[219.6,334.39],[216.99,338.08],[214.74,341.59],[212.67,345.19],[210.78,348.88],[208.89,352.66],[207.27,356.44],[205.65,360.31],[204.3,364.27],[202.95,368.14],[201.78,372.1],[200.7,375.97],[199.8,379.93],[198.99,383.8],[198.36,387.76],[197.73,391.72],[197.28,395.77],[196.92,399.91],[196.65,404.14],[196.47,408.19],[196.38,412.06],[196.29,415.57],[196.2,418.9],[203.67,425.83],[210.51,432.4],[215.91,438.34],[219.51,443.38],[221.58,447.61],[222.66,451.12],[223.29,454.45],[223.92,457.78],[224.64,461.11],[225.45,464.44],[226.26,467.77],[227.25,471.19],[228.15,474.61],[229.14,478.03],[230.04,481.54],[231.03,484.96],[232.11,488.47],[233.1,491.89],[234.09,495.4],[235.08,498.91],[236.07,502.42],[237.06,505.93],[237.96,509.44],[238.95,512.95],[239.94,516.46],[240.84,520.06],[241.74,523.75],[242.64,527.53],[243.45,531.4],[244.17,535.36],[244.8,539.5],[242.82,537.61],[240.66,535.45],[238.41,533.02],[236.07,530.41],[233.73,527.62],[231.39,524.74],[229.14,521.86],[226.89,518.89],[224.64,516.01],[222.48,513.04],[220.23,509.98],[218.16,507.01],[216,504.04],[213.93,501.07],[211.86,498.01],[209.7,494.95],[207.63,491.98],[205.65,488.83],[203.58,485.77],[201.6,482.62],[199.53,479.38],[197.64,476.14],[195.66,472.9],[193.77,469.48],[191.88,466.15],[190.08,462.73],[188.37,459.31],[186.66,455.89],[185.04,452.56],[183.51,449.41],[182.16,446.53],[180.99,444.1],[180,442.03],[179.01,444.1],[177.84,446.53],[176.49,449.41],[174.96,452.56],[173.34,455.89],[171.63,459.31],[169.92,462.73],[168.12,466.15],[166.23,469.48],[164.34,472.9],[162.36,476.14],[160.47,479.38],[158.4,482.62],[156.42,485.77],[154.35,488.83],[152.37,491.98],[150.3,494.95],[148.14,498.01],[146.07,501.07],[144,504.04],[141.84,507.01],[139.77,509.98],[137.52,513.04],[135.36,516.01],[133.11,518.89],[130.86,521.86],[128.61,524.74],[126.27,527.62],[123.93,530.41],[121.59,533.02],[119.34,535.45],[117.18,537.61],[115.2,539.5],[115.83,535.36],[116.55,531.4],[117.36,527.53],[118.26,523.75],[119.16,520.06],[120.06,516.46],[121.05,512.95],[122.04,509.44],[122.94,505.93],[123.93,502.42],[124.92,498.91],[125.91,495.4],[126.9,491.89],[127.89,488.47],[128.97,484.96],[129.96,481.54],[130.86,478.03],[131.85,474.61],[132.75,471.19],[133.74,467.77],[134.55,464.44],[135.36,461.11],[136.08,457.78],[136.71,454.45],[137.34,451.12],[138.42,447.61],[140.49,443.38],[144.09,438.34],[149.49,432.4],[156.33,425.83],[163.8,418.9],[163.71,415.57],[163.62,412.06],[163.53,408.19],[163.35,404.14],[163.08,399.91],[162.72,395.77],[162.27,391.72],[161.64,387.76],[161.01,383.8],[160.2,379.93],[159.3,375.97],[158.22,372.1],[157.05,368.14],[155.7,364.27],[154.35,360.31],[152.73,356.44],[151.11,352.66],[149.22,348.88],[147.33,345.19],[145.26,341.59],[143.01,338.08],[140.4,334.39],[137.43,330.52],[134.01,326.38],[129.96,321.97],[125.46,317.29],[120.78,312.61],[116.19,308.29],[111.87,304.6],[108.27,301.81],[105.21,300.01],[102.87,299.2],[100.98,299.02],[99.45,299.29],[98.01,299.83],[96.3,300.28],[94.41,300.82],[92.25,301.27],[89.91,301.9],[87.39,302.53],[84.96,303.25],[82.53,304.15],[80.1,305.14],[77.67,306.31],[75.15,307.57],[72.72,309.01],[70.29,310.54],[67.86,312.16],[65.52,313.87],[63.18,315.67],[60.93,317.65],[58.68,319.72],[56.52,321.88],[54.36,324.13],[52.29,326.47],[50.4,328.9],[48.51,331.51],[46.62,334.21],[44.82,337.09],[43.11,340.06],[41.4,343.21],[39.69,346.36],[37.98,349.6],[36.36,352.84],[34.65,356.17],[32.94,359.5],[31.23,362.83],[29.61,365.98],[27.99,368.95],[26.55,371.56],[25.2,373.9],[24.75,371.29],[24.3,368.32],[23.85,365.08],[23.4,361.57],[23.04,357.88],[22.77,354.19],[22.59,350.41],[22.41,346.72],[22.32,342.94],[22.32,339.07],[22.32,335.29],[22.5,331.42],[22.77,327.46],[23.22,323.41],[23.85,319.36],[24.57,315.31],[25.56,311.26],[26.64,307.3],[27.9,303.25],[29.34,299.38],[30.96,295.42],[32.67,291.55],[34.56,287.77],[36.54,283.99],[38.79,280.3],[41.13,276.61],[43.65,273.01],[46.26,269.5],[49.14,266.08],[52.11,262.75],[55.26,259.51],[58.59,256.45],[61.92,253.39],[65.52,250.6],[69.12,247.9],[72.9,245.29],[76.77,242.77],[80.73,240.43],[84.96,238.27],[89.19,236.2],[93.6,234.4],[98.01,232.69],[102.51,231.16],[107.01,229.81],[111.6,228.64],[116.19,227.65],[120.87,226.84],[125.46,226.21],[129.96,225.76],[134.1,225.67],[137.97,225.67],[141.48,225.85],[144.99,226.03],[148.5,225.94],[151.83,225.4],[155.16,224.5],[158.22,223.15],[161.1,221.35],[163.53,219.19],[165.51,216.58],[166.95,213.61],[167.94,210.46],[168.48,207.31],[168.75,204.43],[168.75,201.91],[168.48,199.66],[168.12,197.59],[167.58,195.43],[166.95,193.18],[166.23,190.84],[165.6,188.5],[164.88,186.16],[164.16,183.82],[163.53,181.39],[162.99,178.96],[162.54,176.53],[162.36,174.1],[162.27,171.67],[162.45,169.15],[162.81,166.72],[163.35,164.38],[164.16,162.04],[165.15,159.79],[166.41,157.63],[167.85,155.56],[169.47,153.4],[171.36,150.7],[173.7,146.83],[176.58,141.34]]],
  },
  {
    // 
    name: "Snake", timer: 22, boss: true, tier: "final", perfect: 13.51, body: "back",
    shape: [[[95.2,546.3],[107.1,545.2],[119,543.5],[130.7,541.4],[163.3,534.8],[173.3,533.1],[183.4,531.6],[193.6,530.5],[203.8,529.6],[237.9,527.6],[250.5,526.7],[263.9,525.2],[268.8,524.2],[271.5,523.2],[274.1,522.1],[276.5,520.7],[279.4,518.7],[281.5,516.9],[283.9,514.5],[285.6,512.4],[287.6,509.5],[289.1,506.5],[290.2,504],[291,501.4],[291.6,498.7],[291.9,496],[292,493.3],[291.9,490.6],[291.3,487.2],[290,482.7],[288.2,479],[285.5,475],[282.8,472],[279.1,469],[275.6,466.9],[271.8,465.3],[267.2,464.1],[244.1,461.9],[200.4,455.8],[189.9,454.6],[179.5,453.8],[169,453.3],[158.4,453.2],[124.6,454],[113.3,454.1],[102.8,453.9],[93.2,453.4],[87.9,452.8],[81.5,451.3],[76.6,449.5],[70.6,446.8],[65,443.3],[59.8,439.3],[55.1,434.7],[51.7,430.6],[48,425.2],[45.6,420.5],[43.1,414.4],[41.3,408.1],[40.3,401.6],[40,395],[40.4,388.4],[41.6,381.9],[43.5,375.6],[46.1,369.6],[48.7,365],[52.5,359.6],[56,355.6],[59.8,352],[65,347.9],[69.4,345.1],[74.1,342.8],[79,340.8],[84.1,339.3],[89.2,338.3],[112.6,336.1],[156.1,330],[167.4,328.7],[177.8,327.9],[189.3,327.3],[200.7,327.2],[236.9,328],[249.5,328.1],[264.5,327.5],[267.2,327.2],[269.9,326.6],[272.5,325.7],[275,324.7],[277.4,323.4],[279.7,321.9],[281.8,320.2],[283.8,318.3],[285.5,316.3],[287.1,314],[288.5,311.7],[289.7,309.2],[290.6,306.7],[291.3,304],[291.8,301.4],[292,298.6],[292,295.9],[291.7,293.2],[290.8,289.2],[289.1,284.8],[286.8,280.6],[283.8,276.9],[280.2,273.8],[276.2,271.2],[271.8,269.3],[267.9,268.2],[265.2,267.8],[254.5,267],[244.1,265.9],[200.4,259.7],[189.9,258.5],[180.4,257.8],[169.9,257.3],[158.4,257.2],[124.6,258],[113.3,258.1],[102.8,257.9],[93.2,257.4],[87.9,256.7],[82.8,255.6],[77.8,254],[72.9,251.9],[68.3,249.4],[63.9,246.5],[59.8,243.3],[56,239.6],[52.5,235.6],[49.4,231.4],[46.7,226.8],[44,220.8],[42.3,215.9],[40.8,209.4],[40.1,204.2],[40,198.9],[40.3,193.7],[41.3,187.2],[42.7,182.1],[44.5,177.1],[47.4,171.2],[50.2,166.8],[53.3,162.6],[57.8,157.7],[61.8,154.3],[67.2,150.5],[71.8,147.9],[77.8,145.2],[84.1,143.3],[90.6,142.1],[106.9,140.7],[125.2,138.6],[145.1,137.2],[154.3,136.1],[157.3,135.4],[160.3,134.3],[171.3,128.8],[175.4,127],[178.5,125.9],[181.7,125.2],[183.8,125],[191.3,126.2],[200.7,128],[211,130.3],[225,133.9],[249.6,140.7],[258.6,143.2],[263.6,145],[264.7,145.5],[263.7,146.2],[260.8,147.6],[253.8,150.2],[245.7,152.6],[231.4,156],[199.7,162.5],[185.6,166],[182.8,165.9],[179,165.2],[168.3,161.7],[164.3,160.6],[160.3,160],[157.4,160],[149.6,161.3],[132.1,165.3],[125.1,166.7],[109.7,168.6],[94.1,169.8],[91.4,170.3],[88.8,171],[86.3,172],[83.8,173.2],[81.5,174.6],[78.7,176.6],[76.7,178.4],[74.9,180.4],[73.2,182.6],[71.8,184.9],[70.6,187.4],[69.6,189.9],[68.8,192.5],[68.3,195.2],[68,197.9],[68,201.3],[68.3,204],[68.8,206.7],[70.3,211.2],[72.1,214.9],[74.5,218.2],[77.2,221.3],[80.9,224.3],[84.4,226.4],[88.2,228],[92.8,229.2],[95.5,229.5],[100.9,229.8],[114.3,230.1],[126,230],[152.1,229.3],[165.5,229.2],[178,229.6],[190.5,230.5],[208,232.5],[246.4,238],[270.8,240.3],[275.9,241.3],[281,242.8],[285.9,244.7],[289.4,246.5],[295,249.9],[300.2,254],[304.9,258.6],[308.3,262.6],[312,268.1],[315,274],[317.3,280.1],[318.7,285.2],[319.7,291.7],[320,297],[319.7,303.5],[318.7,310],[317.3,315.1],[315,321.3],[312,327.1],[308.3,332.6],[304.9,336.7],[301.2,340.4],[297.2,343.8],[291.7,347.5],[287.1,349.9],[281,352.4],[275.9,353.9],[270.8,355],[262.4,355.7],[248.8,356.1],[235.4,356],[200.7,355.2],[190.1,355.3],[179.6,355.8],[171,356.5],[161.5,357.5],[120,363.4],[107.6,364.8],[94.8,365.8],[90.1,366.7],[87.5,367.5],[85,368.6],[82.6,369.9],[80.3,371.4],[78.2,373.1],[76.2,374.9],[74.5,377],[72.9,379.2],[71.5,381.6],[70.3,384],[69.4,386.6],[68.7,389.2],[68.2,391.9],[68,394.6],[68,397.3],[68.3,400.1],[69.4,404.7],[70.9,408.5],[73.2,412.6],[76.2,416.3],[79.8,419.5],[83.8,422.1],[88.2,424],[92.1,425.1],[97.1,425.6],[110.5,426.1],[123.1,426.1],[149,425.4],[161.3,425.2],[174.9,425.5],[188.4,426.3],[207,428.4],[246.4,434],[270.8,436.3],[274.6,437],[279.7,438.4],[283.4,439.8],[287.1,441.3],[292.8,444.5],[297.2,447.5],[301.2,450.9],[304.9,454.6],[309.1,459.7],[312,464.1],[314.4,468.8],[316.5,473.7],[318.4,479.9],[319.4,485.1],[319.9,490.4],[320,495.6],[319.6,500.9],[318.7,506.1],[317.3,511.2],[315.5,516.1],[312.6,522],[310.5,525.4],[308.2,528.6],[303.9,533.5],[301,536.2],[298,538.7],[292.5,542.3],[289.1,544.2],[285.5,545.8],[279.4,547.9],[275.6,548.8],[271.8,549.4],[268,549.8],[263.3,549.9],[255,549.7],[246.7,549.3],[233.5,548.2],[199.7,544.6],[188.9,543.8],[179.1,543.4],[166.2,543.5],[153.3,544.2],[141.4,545.1],[111.4,548.1],[95.4,549.2]],[[191.9,135.8],[191.6,137.4],[190.6,138.6],[189.2,139.2],[187.6,139.2],[186.2,138.6],[185.3,137.4],[184.9,135.8],[185.3,134.3],[186.2,133.1],[187.6,132.4],[189.2,132.4],[190.6,133.1],[191.6,134.3]],[[192.5,154.8],[192.1,156.3],[191.2,157.6],[189.8,158.2],[188.2,158.2],[186.8,157.6],[185.8,156.3],[185.5,154.8],[185.8,153.3],[186.8,152.1],[188.2,151.4],[189.8,151.4],[191.2,152.1],[192.1,153.3]]],
  },
  {
    // 
    name: "Key", timer: 28, boss: false, tier: "mid", perfect: 14.37, body: "forearm",
    shape: [[[172.7,114.3],[177.5,114],[182.5,114],[187.5,114.3],[192.5,114.7],[197.5,115.4],[202.3,116.3],[207.3,117.5],[212,118.8],[216.8,120.4],[221.3,122.2],[225.8,124.2],[230.3,126.4],[234.8,128.9],[238.9,131.5],[243,134.3],[247,137.3],[250.9,140.5],[254.5,143.8],[258,147.3],[261.4,151],[264.5,154.8],[267.5,158.8],[270.5,163],[273.1,167.3],[275.5,171.5],[277.7,176],[279.7,180.5],[281.6,185.3],[283.2,190],[284.5,194.8],[285.6,199.5],[286.6,204.5],[287.3,209.8],[287.8,215.3],[288,220.5],[287.9,226],[287.6,231.5],[287,236.8],[286.1,242.3],[284.9,247.5],[283.5,252.8],[281.9,257.8],[280,262.8],[277.8,267.8],[275.5,272.5],[272.8,277.3],[270,281.8],[266.8,286.3],[263.5,290.5],[259.8,294.8],[256.2,298.5],[252.3,302.3],[248.2,305.8],[244,309],[239.5,312.1],[234.9,315],[230.3,317.6],[225.5,319.9],[220.5,322.1],[215.5,324],[210.5,325.6],[205.5,326.9],[200,328.1],[194.3,329.1],[194,329.3],[194,340],[203.8,340],[204,340.3],[204,352.8],[203.8,353],[194,353],[194,359],[198.8,359],[199,359.3],[199,370.8],[198.8,371],[194,371],[194,470],[243.8,470],[244,470.3],[244,490.8],[243.8,491],[194,491],[194,505],[229.8,505],[230,505.3],[230,525.8],[229.8,526],[194,526],[194,539],[245.8,539],[246,539.3],[246,559.8],[245.8,560],[166.3,560],[166,559.8],[166,371],[161.3,371],[161,370.8],[161,359.3],[161.3,359],[166,359],[166,353],[156.3,353],[156,352.8],[156,340.3],[156.3,340],[166,340],[166,329.3],[165.8,329.1],[161,328.3],[156.3,327.4],[148.5,325.3],[140.5,322.5],[132.8,319.1],[125.3,315.1],[118,310.4],[111.2,305.3],[104.8,299.5],[98.8,293.3],[93.4,286.5],[88.6,279.5],[84.3,272],[80.6,264.3],[77.6,256.3],[75.2,248],[73.4,239.5],[72.7,234],[72.2,228.5],[72,223],[72.1,217.3],[72.5,211.5],[73.2,206],[74.2,200.5],[75.4,195],[77,189.5],[78.8,184.3],[80.9,179],[83.3,174],[85.9,169],[88.8,164.2],[91.9,159.5],[95.3,155],[98.8,150.8],[102.8,146.5],[106.8,142.6],[111,138.9],[115.5,135.4],[120,132.2],[124.8,129.2],[129.8,126.4],[134.8,123.9],[140,121.7],[145.3,119.7],[150.5,118.1],[156,116.7],[161.5,115.6],[167,114.8]],[[180,170],[174.8,170.3],[169.8,171],[164.8,172.3],[160,174],[155.3,176.3],[151,178.8],[147,181.8],[143.3,185.2],[139.8,189],[136.8,193],[134.3,197.3],[132,202],[130.3,206.8],[129,211.8],[128.3,216.8],[128,222],[128.3,227.3],[129,232.3],[130.3,237.3],[132,242],[134.3,246.7],[136.8,251],[139.8,255],[143.2,258.8],[147,262.2],[151,265.2],[155.3,267.8],[160,270],[164.8,271.7],[169.8,273],[174.8,273.7],[180,274],[185.3,273.7],[190.3,273],[195.3,271.7],[200,270],[204.7,267.8],[209,265.2],[213,262.2],[216.8,258.8],[220.2,255],[223.2,251],[225.8,246.7],[228,242],[229.7,237.3],[231,232.3],[231.7,227.3],[232,222],[231.7,216.8],[231,211.8],[229.7,206.8],[228,202],[225.8,197.3],[223.2,193],[220.2,189],[216.8,185.3],[213,181.8],[209,178.8],[204.7,176.3],[200,174],[195.3,172.3],[190.3,171],[185.3,170.3]]],
  },
  {
    // Teaches riding three inner edges: the eye sockets and nasal cavity are holes and the jaw has five tooth notches, so a fast sweep across the face slips at the holes. Path: one lap 7.2 inside the outline at 175 that weaves around the tooth notches, a lap 7.2 outside each socket and the nose, then rows 18 apart at 300 filling cranium, cheeks and jaw.
    name: "Skull", timer: 39, boss: true, tier: "skull", perfect: 28.82, body: "calf",
    shape: [[[180,112],[183.7,112.1],[188.7,112.1],[194.8,112.2],[201.3,112.4],[207.8,112.8],[214,113.5],[219.9,114.5],[225.9,115.7],[232,117.1],[238.1,118.8],[244.1,120.7],[250,123],[255.9,125.6],[261.8,128.6],[267.6,131.8],[273.3,135.4],[278.8,139.1],[284,143],[288.9,147.1],[293.6,151.5],[298.1,156.1],[302.4,160.9],[306.3,165.9],[310,171],[313.3,176.3],[316.4,181.7],[319.2,187.4],[321.7,193.1],[324,199],[326,205],[327.8,211.1],[329.3,217.4],[330.6,223.8],[331.7,230.2],[332.5,236.6],[333,243],[333.3,249.4],[333.3,255.8],[333,262.2],[332.5,268.6],[331.8,274.8],[331,281],[329.9,287.1],[328.6,293.2],[327.1,299.2],[325.5,305],[323.8,310.7],[322,316],[320.1,321.1],[318,325.9],[315.8,330.6],[313.7,335],[311.7,339.1],[310,343],[308.7,346.4],[307.6,349.4],[306.8,352.1],[305.9,354.8],[305,357.7],[304,361],[302.8,364.7],[301.5,368.7],[300.2,372.8],[298.8,377.1],[297.4,381.5],[296,386],[294.5,390.6],[293,395.3],[291.4,400.2],[289.9,405.1],[288.4,410.1],[287,415],[285.7,419.8],[284.4,424.6],[283.2,429.3],[282,434.2],[281,439.4],[280,445],[279.1,451.1],[278.4,457.7],[277.7,464.6],[277.1,471.5],[276.5,478.4],[276,485],[275.5,491.5],[275.1,498.1],[274.8,504.7],[274.5,511],[274.3,516.8],[274,522],[273.8,526.7],[273.6,531],[273.4,534.8],[273.2,538.1],[273.1,540.9],[273,543],[272.8,544.5],[272.5,546.7],[272,549],[271,551],[269.2,552.6],[266.9,554],[264.6,555.2],[263,556],[245.5,556],[242,536],[241,532],[239,532],[238,536],[234.5,556],[215.5,556],[212,536],[211,532],[209,532],[208,536],[204.5,556],[185.5,556],[182,536],[180,532],[178,536],[174.5,556],[155.5,556],[152,536],[151,532],[149,532],[148,536],[144.5,556],[125.5,556],[122,536],[121,532],[119,532],[118,536],[114.5,556],[97,556],[95.4,555.2],[93.1,554],[90.8,552.6],[89,551],[88,549],[87.5,546.7],[87.2,544.5],[87,543],[86.9,540.9],[86.8,538.1],[86.6,534.8],[86.4,531],[86.2,526.7],[86,522],[85.7,516.8],[85.5,511],[85.2,504.7],[84.9,498.1],[84.5,491.5],[84,485],[83.5,478.4],[82.9,471.5],[82.3,464.6],[81.6,457.7],[80.9,451.1],[80,445],[79,439.4],[78,434.2],[76.8,429.3],[75.6,424.6],[74.3,419.8],[73,415],[71.6,410.1],[70.1,405.1],[68.6,400.2],[67,395.3],[65.5,390.6],[64,386],[62.6,381.5],[61.2,377.1],[59.8,372.8],[58.5,368.7],[57.2,364.7],[56,361],[55,357.7],[54.1,354.8],[53.3,352.1],[52.4,349.4],[51.3,346.4],[50,343],[48.3,339.1],[46.3,335],[44.2,330.6],[42,325.9],[39.9,321.1],[38,316],[36.2,310.7],[34.5,305],[32.9,299.2],[31.4,293.2],[30.1,287.1],[29,281],[28.2,274.8],[27.5,268.6],[27,262.2],[26.7,255.8],[26.7,249.4],[27,243],[27.5,236.6],[28.3,230.2],[29.4,223.8],[30.7,217.4],[32.2,211.1],[34,205],[36,199],[38.3,193.1],[40.8,187.4],[43.6,181.7],[46.7,176.3],[50,171],[53.7,165.9],[57.6,160.9],[61.9,156.1],[66.4,151.5],[71.1,147.1],[76,143],[81.2,139.1],[86.7,135.4],[92.4,131.8],[98.2,128.6],[104.1,125.6],[110,123],[115.9,120.7],[121.9,118.8],[128,117.1],[134.1,115.7],[140.1,114.5],[146,113.5],[152.2,112.8],[158.7,112.4],[165.3,112.2],[171.3,112.1],[176.3,112.1]],[[168.7,285],[169.4,292.5],[169.6,297.8],[169.4,302.4],[168.8,306.6],[167.9,310.5],[166.6,314.1],[165,317.4],[163.1,320.4],[160.8,323.1],[158.2,325.6],[155.3,327.7],[152,329.6],[148.3,331.2],[144.2,332.6],[139.4,333.7],[132.4,334.7],[125.4,335.4],[120.4,335.4],[116.1,335.1],[112.2,334.4],[108.5,333.4],[105.1,332],[102,330.2],[99.2,328.1],[96.6,325.6],[94.2,322.8],[92.2,319.6],[90.3,316.1],[88.8,312.1],[87.5,307.7],[86.4,302.5],[85.3,295],[84.6,287.5],[84.4,282.2],[84.6,277.6],[85.2,273.4],[86.1,269.5],[87.4,265.9],[89,262.6],[90.9,259.6],[93.2,256.9],[95.8,254.4],[98.7,252.3],[102,250.4],[105.7,248.8],[109.8,247.4],[114.6,246.3],[121.6,245.3],[128.6,244.6],[133.6,244.6],[137.9,244.9],[141.8,245.6],[145.5,246.6],[148.9,248],[152,249.8],[154.8,251.9],[157.4,254.4],[159.8,257.2],[161.8,260.4],[163.7,263.9],[165.2,267.9],[166.5,272.3],[167.6,277.5]],[[274.7,295],[273.6,302.5],[272.5,307.7],[271.2,312.1],[269.7,316.1],[267.8,319.6],[265.8,322.8],[263.4,325.6],[260.8,328.1],[258,330.2],[254.9,332],[251.5,333.4],[247.8,334.4],[243.9,335.1],[239.6,335.4],[234.6,335.4],[227.6,334.7],[220.6,333.7],[215.8,332.6],[211.7,331.2],[208,329.6],[204.7,327.7],[201.8,325.6],[199.2,323.1],[196.9,320.4],[195,317.4],[193.4,314.1],[192.1,310.5],[191.2,306.6],[190.6,302.4],[190.4,297.8],[190.6,292.5],[191.3,285],[192.4,277.5],[193.5,272.3],[194.8,267.9],[196.3,263.9],[198.2,260.4],[200.2,257.2],[202.6,254.4],[205.2,251.9],[208,249.8],[211.1,248],[214.5,246.6],[218.2,245.6],[222.1,244.9],[226.4,244.6],[231.4,244.6],[238.4,245.3],[245.4,246.3],[250.2,247.4],[254.3,248.8],[258,250.4],[261.3,252.3],[264.2,254.4],[266.8,256.9],[269.1,259.6],[271,262.6],[272.6,265.9],[273.9,269.5],[274.8,273.4],[275.4,277.6],[275.6,282.2],[275.4,287.5]],[[180,338],[182,339],[184,341.9],[186.1,346],[188.1,350.9],[190.1,356.2],[192.1,361.4],[194,366],[196.1,370.4],[198.5,375.1],[201,380],[203.3,384.7],[205.2,389.1],[206.5,393],[207,396],[206.5,398.3],[205.2,400],[203.3,401.1],[201,401.9],[198.5,402.2],[196.1,402.2],[194,402],[192.1,401.1],[190.1,399.5],[188.1,397.3],[186.1,395.1],[184,393],[182,391.6],[180,391],[178,391.6],[176,393],[173.9,395.1],[171.9,397.3],[169.9,399.5],[167.9,401.1],[166,402],[163.9,402.2],[161.5,402.2],[159,401.9],[156.7,401.1],[154.8,400],[153.5,398.3],[153,396],[153.5,393],[154.8,389.1],[156.7,384.7],[159,380],[161.5,375.1],[163.9,370.4],[166,366],[167.9,361.4],[169.9,356.2],[171.9,350.9],[173.9,346],[176,341.9],[178,339]]],
  },
];

// ---------- Timers, the daily stencil, badges (v0.5) ----------

// The timer is the stencil's perfect-path time (`perfect`, measured with tools/sim-ink.mjs on its intended path at 300 units/s) times the tier's active multiplier times
// timerGlobalMult, rounded up, so the TUNE presets (PRD v0.5 section D) can retime every stencil. At the standard multipliers it is the stencil's own `timer`.
const STD_MULT = { early: T.timerMultEarly, mid: T.timerMultMid, boss: T.timerMultBoss, final: T.timerMultFinal, skull: T.timerMultSkull };
const TIER_KEY = { early: 'timerMultEarly', mid: 'timerMultMid', boss: 'timerMultBoss', final: 'timerMultFinal', skull: 'timerMultSkull' };
const perfectTime = (st) => st.perfect ?? st.timer / STD_MULT[st.tier];
function timerFor(st) {
  if (st.fixed || !STD_MULT[st.tier]) return st.timer; // a stencil without a tier (a shard's JSON under test) keeps its own timer
  return Math.ceil(perfectTime(st) * T[TIER_KEY[st.tier]] * T.timerGlobalMult - 1e-6);
}

// The daily stencil is played as one more stencil, at index DAILY_IDX, rebuilt when the day changes. Everything that caches per stencil index clears that slot then.
const DAILY_IDX = 1000; // clear of any real index, and of the one tools/sim-ink.mjs appends for a stencil under test
let DAILY_ST = null, DAILY_KEY = '';
const stOf = (idx) => (idx === DAILY_IDX ? DAILY_ST : STENCILS[idx]);
const utcDay = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
const dailyTimer = (st) => Math.min(st.timer, Math.ceil(perfectTime(st) * T.dailyTimerMult - 1e-6));

function buildDaily(rec, key) {
  const base = STENCILS[rec.idx], v = T.dailyVariants[rec.vi], b = bboxOf(rec.idx);
  DAILY_KEY = `${key}|${rec.idx}|${rec.vi}`;
  DAILY_ST = {
    name: base.name, variant: v.label, boss: base.boss, body: base.body, tier: base.tier, base: rec.idx, timer: dailyTimer(base), fixed: true,
    shape: base.shape.map((poly) => poly.map(([x, y]) => [b.cx + v.sx * (x - b.cx), b.cy + v.sy * (y - b.cy)])),
  };
  delete gridCache[DAILY_IDX]; delete gridBuild[DAILY_IDX]; delete AC.outline[DAILY_IDX]; delete AC.bbox[DAILY_IDX]; delete AC.mini[DAILY_IDX];
  if (AC.blushIdx === DAILY_IDX) AC.blushIdx = -1;
}

// Today's daily: chosen once per UTC day from the stencils that are unlocked (so it never stands in for a locked one), seeded by the date, and stored with its result under the
// dated key. The save keeps the last dailyKeep days.
function dailyToday(E) {
  const key = utcDay(), all = E.save.get('daily', {}), cutoff = utcDay(Date.parse(key) - (T.dailyKeep - 1) * 864e5);
  let rec = all[key];
  const stale = Object.keys(all).some((k) => k < cutoff);
  if (!rec || stale) {
    if (!rec) {
      const rng = makeRng(hashString(key)), pool = clamp(E.save.get('unlocked', 0), 0, STENCILS.length - 1);
      rec = { idx: rng.int(0, pool), vi: rng.int(0, T.dailyVariants.length - 1), first: -1, best: -1 };
    }
    const kept = {};
    for (const k of Object.keys(all)) if (k >= cutoff) kept[k] = all[k];
    kept[key] = rec;
    E.save.set('daily', kept);
  }
  if (DAILY_KEY !== `${key}|${rec.idx}|${rec.vi}`) buildDaily(rec, key);
  return rec;
}

// The first attempt of the day is the daily score; the best of the day is shown beside it.
function recordDaily(E, key, pct) {
  const all = E.save.get('daily', {}), rec = all[key];
  if (!rec) return null;
  const next = { ...rec, first: rec.first < 0 ? pct : rec.first, best: Math.max(rec.best, pct) };
  E.save.set('daily', { ...all, [key]: next });
  return next;
}

// Badges are data: a tier, a name, a line of text and a rule. A rule reads one stat (best stars, a clean pass, or the best stars of a clean pass) on any stencil, on one
// stencil by name, or on every stencil in a range of indices, and needs it at `min`. Nothing in the play code knows a badge.
const BADGE_TIERS = ['Apprentice', 'Artist', 'Master'];
const BADGES = [
  { id: 'first-ink', tier: 0, name: 'First Ink', text: 'Pass any stencil', rule: { on: 'any', stat: 'stars', min: 1 } },
  { id: 'steady-hand', tier: 0, name: 'Steady Hand', text: 'Clean pass on any stencil', rule: { on: 'any', stat: 'clean', min: 1 } },
  { id: 'five-stars', tier: 0, name: 'Five Stars', text: 'Five stars on any stencil', rule: { on: 'any', stat: 'stars', min: 5 } },
  { id: 'cornered', tier: 1, name: 'Cornered', text: 'Clean pass on the Star', rule: { on: 'one', of: 'Star', stat: 'clean', min: 1 } },
  { id: 'thin-line', tier: 1, name: 'Thin Line', text: 'Five stars on the Crescent', rule: { on: 'one', of: 'Crescent', stat: 'stars', min: 5 } },
  { id: 'two-edges', tier: 1, name: 'Two Edges', text: 'Clean pass on the Halo', rule: { on: 'one', of: 'Halo', stat: 'clean', min: 1 } },
  { id: 'flash-sheet', tier: 1, name: 'Flash Sheet', text: 'Three stars on the first ten', rule: { on: 'all', from: 0, to: 10, stat: 'stars', min: 3 } },
  { id: 'serpent', tier: 2, name: 'Serpent', text: 'Clean five stars, the Snake', rule: { on: 'one', of: 'Snake', stat: 'cs', min: 5 } },
  { id: 'bone', tier: 2, name: 'Bone', text: 'Clean five stars, the Skull', rule: { on: 'one', of: 'Skull', stat: 'cs', min: 5 } },
  { id: 'full-sleeve', tier: 2, name: 'Full Sleeve', text: 'Five stars on every stencil', rule: { on: 'all', from: 0, to: 15, stat: 'stars', min: 5 } },
];
const statOf = (p, i, stat) => (stat === 'clean' ? (p.clean[i] ? 1 : 0) : p[stat][i] || 0);
// How far a badge is: { have, need } stencils meeting its rule.
function badgeProgress(b, p) {
  const r = b.rule;
  if (r.on === 'any') { for (let i = 0; i < STENCILS.length; i++) if (statOf(p, i, r.stat) >= r.min) return { have: 1, need: 1 }; return { have: 0, need: 1 }; }
  if (r.on === 'one') return { have: statOf(p, STENCILS.findIndex((s) => s.name === r.of), r.stat) >= r.min ? 1 : 0, need: 1 };
  let have = 0;
  for (let i = r.from; i < r.to; i++) if (statOf(p, i, r.stat) >= r.min) have++;
  return { have, need: r.to - r.from };
}
// Every badge the given progress (stars, clean, cs) has earned, as { id: true }.
function earnedBadges(p) {
  const out = {};
  for (const b of BADGES) { const g = badgeProgress(b, p); if (g.have >= g.need) out[b.id] = true; }
  return out;
}

// The skins as the art code uses them (every field filled from the default palette), the ones in use, and the rule that a skin counts only while its badge is earned: a saved
// choice whose badge is missing renders as the default.
const SKINS = {
  machines: A.skins.machines.map((m) => ({ deco: null, body: P.machine, hi: P.machineHi, steel: P.steel, steelDark: P.steelDark, band: P.band, cable: P.cable, ...m })),
  inks: A.skins.inks.map((i) => ({ ink: P.ink, sheen: P.inkSheen, gloss: P.inkGloss, halo: P.inkHalo, sheenA: A.ink.sheenAlpha, ...i })),
};
const SK = { m: SKINS.machines[0], i: SKINS.inks[0] };
const skinOwned = (sk, badges) => !sk.badge || !!badges[sk.badge];
function applySkins(E) {
  const sv = E.save.get('skin', {}), had = E.save.get('badges', {});
  SK.m = SKINS.machines.find((x) => x.id === sv.machine && skinOwned(x, had)) || SKINS.machines[0];
  SK.i = SKINS.inks.find((x) => x.id === sv.ink && skinOwned(x, had)) || SKINS.inks[0];
}

// ---------- Geometry ----------

function pointInShape(shape, x, y) {
  let inside = false;
  for (const poly of shape) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j], yi = a[1], yj = b[1]; // indexed, not destructured: the same arithmetic, without an array allocated per edge
      if ((yi > y) !== (yj > y) && x < ((b[0] - a[0]) * (y - yi)) / (yj - yi) + a[0]) inside = !inside;
    }
  }
  return inside;
}

// Nearest point on any outline edge: { d, x, y }.
function nearestEdge(shape, x, y) {
  let best = { d: Infinity, x, y };
  for (const poly of shape) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [ax, ay] = poly[j], [bx, by] = poly[i];
      const ex = bx - ax, ey = by - ay;
      const t = clamp(((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey || 1), 0, 1);
      const px = ax + ex * t, py = ay + ey * t;
      const d = dist(x, y, px, py);
      if (d < best.d) best = { d, x: px, y: py };
    }
  }
  return best;
}

// Coverage grid, built once per stencil. Cells whose centre is inside the stencil are the ones that count.
const gridCache = [], gridBuild = [];
// A grid is built row by row, so the menu can build the ones it will need a few milliseconds a frame (see warmStep); gridFor finishes whatever is left at once.
function gridStep(idx, ms) {
  if (gridCache[idx]) return gridCache[idx];
  let b = gridBuild[idx];
  if (!b) {
    const shape = stOf(idx).shape, cs = T.cellSize;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const poly of shape) for (const [x, y] of poly) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const cols = Math.ceil((x1 - x0) / cs), rows = Math.ceil((y1 - y0) / cs);
    b = gridBuild[idx] = { shape, x0, y0, cols, rows, inside: new Uint8Array(cols * rows), total: 0, j: 0 };
  }
  const cs = T.cellSize, t0 = ms === Infinity ? 0 : performance.now();
  while (b.j < b.rows) {
    const j = b.j++;
    for (let i = 0; i < b.cols; i++) {
      if (pointInShape(b.shape, b.x0 + (i + 0.5) * cs, b.y0 + (j + 0.5) * cs)) { b.inside[j * b.cols + i] = 1; b.total++; }
    }
    if (ms !== Infinity && performance.now() - t0 >= ms) break;
  }
  if (b.j < b.rows) return null;
  delete gridBuild[idx];
  return (gridCache[idx] = { x0: b.x0, y0: b.y0, cols: b.cols, rows: b.rows, inside: b.inside, total: b.total });
}
const gridFor = (idx) => gridStep(idx, Infinity);

// ---------- Play state ----------

const S = {}; // the current attempt; the card reads it to draw the finished piece
let menuPopIdx = -1; // set by the card when stars went up; the menu pops that tile once

const V = { s: 1, ox: 0, oy: 0 }; // the play view, shared: one object, refilled on each call
function view(E, o = V) {
  o.s = Math.min(E.w / T.designW, E.h / T.designH);
  o.ox = (E.w - T.designW * o.s) / 2; o.oy = (E.h - T.designH * o.s) / 2;
  return o;
}

// ---------- Gap hint (v0.4) ----------
// Once the fill reaches hintPercent, the unfilled cells are grouped into 4-neighbour clusters on the coverage grid, and every cluster holding at least
// hintShare of all unfilled cells is glowed (drawn in drawPiece). Recomputed every hintEvery seconds from update; reads coverage, never writes it.

const newHint = (g) => {
  const n = g.cols * g.rows;
  return { label: new Int32Array(n), queue: new Int32Array(n), size: new Int32Array(n + 1), shown: new Int32Array(n), n: 0, clusters: 0, remaining: 0 };
};

function computeHint() {
  const h = S.hint, { cols, rows, inside } = S.g, inked = S.inked, lab = h.label, q = h.queue, total = cols * rows;
  lab.fill(0);
  let id = 0, remaining = 0;
  for (let k0 = 0; k0 < total; k0++) {
    if (!inside[k0] || inked[k0] || lab[k0]) continue;
    id++; lab[k0] = id;
    let qh = 0, qt = 0; q[qt++] = k0;
    while (qh < qt) {
      const k = q[qh++], i = k % cols;
      if (i > 0 && inside[k - 1] && !inked[k - 1] && !lab[k - 1]) { lab[k - 1] = id; q[qt++] = k - 1; }
      if (i < cols - 1 && inside[k + 1] && !inked[k + 1] && !lab[k + 1]) { lab[k + 1] = id; q[qt++] = k + 1; }
      if (k >= cols && inside[k - cols] && !inked[k - cols] && !lab[k - cols]) { lab[k - cols] = id; q[qt++] = k - cols; }
      if (k < total - cols && inside[k + cols] && !inked[k + cols] && !lab[k + cols]) { lab[k + cols] = id; q[qt++] = k + cols; }
    }
    h.size[id] = qt; remaining += qt;
  }
  h.clusters = id; h.remaining = remaining;
  const need = T.hintShare * remaining;
  let n = 0;
  for (let k = 0; k < total; k++) if (lab[k] && h.size[lab[k]] >= need) h.shown[n++] = k;
  h.n = n;
}

function hintStep(dt) {
  if (S.ended || !S.started) return;
  if (percent() < T.hintPercent) { S.hint.n = 0; S.hintT = 0; return; }
  S.hintT -= dt;
  if (S.hintT <= 0) { S.hintT = T.hintEvery; computeHint(); }
}

// The glow is a pulsing stencil-blue fill over the shown clusters' cells, drawn under the ink layer and under the outline (see drawPiece), so ink hides it
// at once and the outline stays clean. Two passes, a faint slightly larger one first, give it soft edges. Cells are not clipped to the stencil (a clip
// per frame costs more than the glow); a boundary cell can spill about two pixels past the outline.
function drawHint(ctx, E, v) {
  const h = S.hint, g = S.g, cs = T.cellSize;
  const a = T.hintAlphaMin + (T.hintAlphaMax - T.hintAlphaMin) * (0.5 - 0.5 * Math.cos((2 * Math.PI * E.time) / T.hintPeriod));
  ctx.save();
  ctx.translate(v.ox, v.oy); ctx.scale(v.s, v.s);
  ctx.fillStyle = P.stencil;
  for (let pass = 0; pass < 2; pass++) {
    const pad = pass ? 0 : 0.9;
    ctx.globalAlpha = pass ? a : a * 0.4;
    ctx.beginPath();
    for (let i = 0; i < h.n; i++) { const k = h.shown[i]; ctx.rect(g.x0 + (k % g.cols) * cs - pad, g.y0 + Math.floor(k / g.cols) * cs - pad, cs + 2 * pad, cs + 2 * pad); }
    ctx.fill();
  }
  ctx.restore();
}

// ---------- Juice (layer 3) ----------
// Cosmetic only: these read the attempt and never write coverage, slips, the timer or the stars. Times are E.time stamps; -9 means long ago.
// The headless simulator's stand-in engine has no tween, so every effect that needs the engine's helpers is skipped there.

const newFx = () => ({
  downT: -9, inkT: -9, tickAcc: 0, tickT: -9, tickAlt: 0, sprayT: -9, laid: false, speed: 0, px: 0, py: 0, hasP: false,
  slipT: -9, slipPopT: -9, pct: 0, pctT: -9, pctFrom: 1, pctStarT: -9, sec: -1, secT: -9,
  endT: -9, flashT: -9, smear: 0, pendName: null, pendAt: 0,
});

// Scale that eases from `from` to 1 with an overshoot (outBack); 1 outside [0, dur).
const pop = (age, dur, from) => (age < 0 || age >= dur ? 1 : from + (1 - from) * ease.outBack(age / dur));

const EMIT = { x: 0, y: 0, count: 0, color: '', speed: 0, life: 0, size: 0, gravity: 0, drag: 0.96, spread: Math.PI * 2, angle: 0 };
function emit(E, x, y, count, color, speed, life, size, spread = Math.PI * 2, angle = 0) {
  const room = T.particleCap - E.particles.list.length;
  if (room <= 0) return;
  Object.assign(EMIT, { x, y, count: Math.min(count, room), color, speed, life, size, spread, angle });
  E.particles.emit(EMIT);
}
const toScreen = (E, x, y) => { const v = view(E); return [v.ox + x * v.s, v.oy + y * v.s]; };

// One ink sample was laid: note it for the vibration and glint, and tick every tickEvery units of travel, never faster than tickMinGap.
function fxInk(E) {
  if (!E.tween) return;
  const f = S.fx, now = E.time;
  f.inkT = now; f.laid = true;
  f.tickAcc += T.sampleSpacing;
  if (f.tickAcc >= J.tickEvery && now - f.tickT >= J.tickMinGap && E.audio.beep) {
    f.tickAcc = 0; f.tickT = now; f.tickAlt ^= 1;
    E.audio.beep({ freq: f.tickAlt ? J.tickFreq : J.tickFreqAlt, dur: J.tickDur, type: 'triangle', gain: J.tickGain });
  }
}

// A few ink specks off the tip while the needle is laying ink fast.
function sprayTip(E, p) {
  if (!E.tween) return;
  const f = S.fx;
  if (!f.laid || S.ended || f.speed < J.sprayMinSpeed || E.time - f.sprayT < J.sprayGap) return;
  f.sprayT = E.time;
  emit(E, p.x, p.y - T.needleOffset, J.sprayCount, SK.i.ink, J.spraySpeed, J.sprayLife, J.spraySize);
}

// A slip was just counted at the exit point (x, y in design units).
function fxSlip(E, x, y) {
  if (!E.tween) return;
  const f = S.fx;
  f.slipT = f.slipPopT = E.time;
  E.shake(J.slipShake, J.slipShakeSec);
  E.haptic(S.slips >= T.maxSlips ? J.ruinHaptic : J.slipHaptic);
  const [sx, sy] = toScreen(E, x, y);
  emit(E, sx, sy, J.slipBurst, P.slip, 90, 0.35, 2.4);
}

// The stencil ended: sounds, haptic and the end-of-piece effects. The card follows after endHold.
function fxFinish(E, reason) {
  if (!E.tween) return;
  const f = S.fx, now = E.time;
  f.endT = now;
  if (reason === 'full') {
    E.audio.play('win'); E.haptic(J.finishHaptic);
    f.flashT = now;
    fxBurst(E);
  } else if (reason === 'time') {
    E.audio.play(percent() >= T.starPercents[0] ? 'win' : 'lose');
  } else {
    f.pendName = 'lose'; f.pendAt = now + J.loseDelay; // after the miss sound
    E.tween(J.smearSec, (k) => { f.smear = k; }, ease.outQuad);
  }
}

// Ink specks along the whole outline, evenly spaced.
function fxBurst(E) {
  const v = view(E);
  let len = 0;
  for (const poly of S.st.shape) for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) len += dist(poly[j][0], poly[j][1], poly[i][0], poly[i][1]);
  const step = len / J.burstPoints;
  let next = 0, run = 0, n = 0;
  for (const poly of S.st.shape) for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const ax = poly[j][0], ay = poly[j][1], bx = poly[i][0], by = poly[i][1], el = dist(ax, ay, bx, by);
    while (next <= run + el && n < J.burstPoints) {
      const t = el ? (next - run) / el : 0;
      emit(E, v.ox + (ax + (bx - ax) * t) * v.s, v.oy + (ay + (by - ay) * t) * v.s, J.burstPer, n % 2 ? SK.i.gloss : SK.i.ink, J.burstSpeed, J.burstLife, J.burstSize);
      next += step; n++;
    }
    run += el;
  }
}

// Per frame while playing: needle speed, whole-percent pops, timer pulse and ticks, delayed sounds.
function fxUpdate(dt, E) {
  const f = S.fx, now = E.time;
  if (S.last) {
    f.speed = f.hasP ? f.speed + (dist(S.last.x, S.last.y, f.px, f.py) / Math.max(dt, 0.001) - f.speed) * 0.35 : 0;
    f.px = S.last.x; f.py = S.last.y; f.hasP = true;
  } else { f.hasP = false; f.speed = 0; }
  const p = percent();
  if (p !== f.pct) {
    let crossed = false;
    for (const th of T.starPercents) if (f.pct < th && p >= th) crossed = true;
    f.pct = p;
    if (p >= T.starPercents[0]) { f.pctT = now; f.pctFrom = crossed ? J.pctThresholdFrom : J.pctStepFrom; }
    if (crossed) f.pctStarT = now;
  }
  if (S.started && !S.ended) {
    const sec = Math.ceil(S.time);
    if (sec !== f.sec) {
      f.sec = sec; f.secT = now;
      if (sec >= 1 && sec <= J.timerTickSecs) E.audio.beep({ freq: J.timerTickFreq, dur: J.timerTickDur, type: 'sine', gain: J.timerTickGain });
    }
  }
  if (f.pendName && now >= f.pendAt) { E.audio.play(f.pendName); f.pendName = null; }
}

function newAttempt(idx, daily = false) {
  const st = stOf(idx), g = gridFor(idx);
  Object.assign(S, {
    idx, st, g, daily, dailyKey: daily ? utcDay() : '',
    inked: new Uint8Array(g.cols * g.rows), count: 0,
    strokes: [], stroke: null, marks: [],
    slips: 0, time: timerFor(st), started: false, ended: null, holdT: 0,
    pid: null, last: null, lastT: 0, carry: 0, armed: false,
    finger: null, r: T.needleR, hist: newHist(), sT: 0, idle: 0, acc: 0, pushR: 0,
    layer: null, layerK: 0, inkDone: [],
    grey: null, greyK: 0, prep: 0, olWait: 1, inkFrom: 0, fx: newFx(),
    hint: newHint(g), hintT: 0,
  });
}

const percent = () => Math.floor((S.count * 100) / S.g.total);
const starsFor = (pct) => T.starPercents.filter((p) => pct >= p).length;

// Speed history for the dynamic needle: cumulative travel and time at the last path samples since touch down (a ring, no allocation per sample).
const HIST = 64;
const newHist = () => ({ d: new Float64Array(HIST), t: new Float64Array(HIST), head: 0, n: 0, cum: 0 });
function histPush(h, cum, t) {
  h.head = (h.head + 1) % HIST; h.d[h.head] = cum; h.t[h.head] = t; if (h.n < HIST) h.n++;
}
// Finger speed over the last speedWindow units of travel, or -1 with no travel yet. With less travel than the window it uses what there is.
// `idle` is time spent holding still since the newest sample, so a pause drags the measured speed down.
function windowSpeed(h, idle = 0) {
  const target = h.cum - Math.min(T.speedWindow, (HIST - 2) * T.sampleSpacing);
  let k = h.head, cnt = 1, d0 = h.d[k], t0 = h.t[k];
  while (cnt < h.n) {
    const prev = (k + HIST - 1) % HIST;
    if (h.d[prev] <= target) { // interpolate the time at cumulative distance `target` between prev and k
      const span = h.d[k] - h.d[prev], f = span > 0 ? (target - h.d[prev]) / span : 0;
      d0 = target; t0 = h.t[prev] + (h.t[k] - h.t[prev]) * f;
      return (h.cum - d0) / Math.max(h.t[h.head] - t0 + idle, 1e-4);
    }
    k = prev; cnt++; d0 = h.d[k]; t0 = h.t[k];
  }
  const dd = h.cum - d0;
  if (dd > 0) return dd / Math.max(h.t[h.head] - t0 + idle, 1e-4);
  return idle > 0 ? 0 : -1; // no travel yet: unknown, or stopped if the finger has been holding still
}
// Target ink radius for a finger speed: wide when slow, thin when fast, linear between; never below the floor. Unknown speed is neutral.
function radiusFor(speed) {
  if (speed < 0) return T.needleR;
  const u = clamp((speed - T.slowSpeed) / Math.max(T.fastSpeed - T.slowSpeed, 1e-6), 0, 1);
  return Math.max(T.needleR * (T.wideScale + (T.thinScale - T.wideScale) * u), T.needleR * T.floorScale);
}
// Inertia: the radius moves toward its target over dt seconds at growRate while widening and shrinkRate while narrowing.
function stepRadius(dt, speed) {
  const goal = radiusFor(speed);
  S.r = clamp(S.r < goal ? Math.min(goal, S.r + T.growRate * dt) : Math.max(goal, S.r - T.shrinkRate * dt), T.needleR * T.floorScale, Infinity);
}

// Lay ink on every inside cell whose centre is within R of (x, y).
function inkAt(x, y, R) {
  const { g } = S, cs = T.cellSize;
  const i0 = Math.max(0, Math.floor((x - R - g.x0) / cs)), i1 = Math.min(g.cols - 1, Math.floor((x + R - g.x0) / cs));
  const j0 = Math.max(0, Math.floor((y - R - g.y0) / cs)), j1 = Math.min(g.rows - 1, Math.floor((y + R - g.y0) / cs));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const k = j * g.cols + i;
    if (!g.inside[k] || S.inked[k]) continue;
    if (dist(x, y, g.x0 + (i + 0.5) * cs, g.y0 + (j + 0.5) * cs) <= R) { S.inked[k] = 1; S.count++; }
  }
}

// One path sample. Inside: ink. Outside: no ink; a slip counts only if the needle had been inside and is now past the tolerance.
function sample(E, x, y, r) {
  if (S.ended) return;
  S.r = r;
  if (pointInShape(S.st.shape, x, y)) {
    S.armed = true;
    if (!S.stroke) { S.stroke = []; S.strokes.push(S.stroke); }
    S.stroke.push(x, y, r); S.pushR = r;
    inkAt(x, y, r);
    fxInk(E);
    if (S.count === S.g.total) finish(E, 'full');
    return;
  }
  S.stroke = null;
  checkSlip(E, x, y);
}

// Count a slip if the needle had been inside and (x, y) is outside past the tolerance. Ink is never laid here.
function checkSlip(E, x, y) {
  if (!S.armed || S.ended || pointInShape(S.st.shape, x, y)) return;
  const e = nearestEdge(S.st.shape, x, y);
  if (e.d <= T.slipTolerance) return;
  S.armed = false; S.stroke = null;
  S.slips++;
  S.marks.push({ x: e.x, y: e.y });
  E.audio.play('miss');
  fxSlip(E, e.x, e.y);
  if (S.slips >= T.maxSlips) finish(E, 'ruined');
}

// Walk the needle from its last position to (x, y) at time tm (seconds), sampling every sampleSpacing along the way.
// Each sample gets the time it would have had on that straight segment, so the speed window depends on positions and speeds, not on how events were cut.
function moveNeedle(E, x, y, tm) {
  const h = S.hist;
  if (!S.last) {
    S.last = { x, y }; S.lastT = tm; S.carry = 0; S.sT = tm; S.idle = 0; S.acc = 0;
    h.n = 0; h.cum = 0; histPush(h, 0, tm);
    S.r = Math.max(T.needleR, T.needleR * T.floorScale);
    sample(E, x, y, S.r);
    return;
  }
  const dx = x - S.last.x, dy = y - S.last.y, len = Math.hypot(dx, dy);
  if (len === 0) return;
  const ux = dx / len, uy = dy / len, dt = tm - S.lastT;
  S.idle = 0; S.acc = 0;
  let t = T.sampleSpacing - S.carry; // distance along this segment to the next sample
  while (t <= len && !S.ended) {
    const ts = S.lastT + dt * (t / len);
    h.cum += T.sampleSpacing; histPush(h, h.cum, ts);
    stepRadius(Math.max(0, ts - S.sT), windowSpeed(h)); S.sT = Math.max(S.sT, ts);
    sample(E, S.last.x + ux * t, S.last.y + uy * t, S.r);
    t += T.sampleSpacing;
  }
  S.carry = T.sampleSpacing - (t - len);
  S.last = { x, y }; S.lastT = tm;
  checkSlip(E, x, y); // the real needle position too, so a reversal apex between samples still counts
}

// Holding still: the finger sends no events, but time passes. In fixed steps the radius keeps swelling toward the slow size, and the disc it lays
// grows with it (never past the slow radius). Runs from update, so it is the same code the simulator's holds use.
function holdStep(E, dt) {
  if (S.pid === null || !S.last || S.ended) return;
  S.idle += dt;
  if (S.idle < T.holdGap) return;
  S.acc += dt;
  while (S.acc >= T.physicsStep) {
    S.acc -= T.physicsStep; S.sT += T.physicsStep;
    stepRadius(T.physicsStep, windowSpeed(S.hist, S.idle));
  }
  if (S.stroke && S.r > S.pushR + 0.05 && pointInShape(S.st.shape, S.last.x, S.last.y)) {
    S.pushR = S.r; S.stroke.push(S.last.x, S.last.y, S.r); inkAt(S.last.x, S.last.y, S.r);
    if (S.count === S.g.total) finish(E, 'full');
  }
}

function finish(E, reason) {
  if (S.ended) return;
  S.ended = reason;
  S.holdT = T.endHold;
  S.stroke = null;
  fxFinish(E, reason);
}

// Seconds at which a pointer event happened. The harness stamps p.t; the engine's pointers carry none, so the real clock is read.
const eventTime = (p) => (typeof p.t === 'number' ? p.t : performance.now() / 1000);

function needleFromPointer(p, E) {
  const v = view(E);
  return { x: (p.x - v.ox) / v.s, y: (p.y - T.needleOffset - v.oy) / v.s };
}

function liftFinger() {
  S.pid = null; S.last = null; S.stroke = null; S.armed = false; S.finger = null;
}

// ---------- Drawing ----------

function shapePath(ctx, shape) {
  ctx.beginPath();
  for (const poly of shape) {
    poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  }
}

// ---------- Art (layer 5) ----------
// Everything here is cosmetic and reads TUNING.art. Textures are built once (per size where they depend on it) into offscreen canvases and only blitted each frame;
// shapes that repeat every frame (the outline, the machine) are Path2D objects and gradients built once. The headless simulator never draws, so nothing here runs at import time.

const TAU = Math.PI * 2;
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const rgbOf = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const mk = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }));
const rr = (c, x, y, w, h, r) => { c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };

const FONT = {};
for (const k of ['hero', 'big', 'mid', 'small']) FONT[k] = `${A.type.weight} ${A.type[k]}px ${A.type.display}`;
const NUM = Array.from({ length: 201 }, (_, i) => `${i}`), PCT = Array.from({ length: 101 }, (_, i) => `${i}%`); // strings for the HUD, made once

// Caches of everything built once. Body layers are per body part; the rest are per size or per stencil.
const AC = {
  warm: 0, warmGrid: 0, warmOl: 0, warmBmp: false, order: null, inkTile: {}, mach: {}, body: {}, comp: {}, ol: null, olIdx: -1, olK: 0, grain: null, gw: 0, gh: 0, outline: [], bbox: [], mini: [], blush: null, blushIdx: -1,
  title: null, titleK: 0, board: null, bw: 0, bh: 0, shapes: null, tilt: null,
};

function bboxOf(idx) {
  if (AC.bbox[idx]) return AC.bbox[idx];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const poly of stOf(idx).shape) for (const [x, y] of poly) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return (AC.bbox[idx] = { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 });
}

// Label: text with an optional dark outline for legibility on skin. Fonts are prebuilt strings, so nothing is allocated here.
function label(ctx, str, x, y, font, fill, align = 'center', outline = 0, outlineColor = P.ink) {
  ctx.font = font; ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (outline) { ctx.lineJoin = 'round'; ctx.lineWidth = outline; ctx.strokeStyle = outlineColor; ctx.strokeText(str, x, y); }
  ctx.fillStyle = fill; ctx.fillText(str, x, y);
}
// The same, scaled about (x, y) for the pops.
function plabel(ctx, str, x, y, k, font, fill, align, outline, outlineColor) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  label(ctx, str, 0, 0, font, fill, align, outline, outlineColor);
  ctx.restore();
}

// ----- Body parts -----
// Soft-shaded silhouettes in design space, drawn once into one large low-resolution layer per body part. Low contrast: shading only, no lines that compete with the stencil.

function glow(c, cx, cy, rx, ry, rot, color, a) {
  c.save(); c.translate(cx, cy); c.rotate(rot); c.scale(1, ry / rx);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, rgba(color, a)); g.addColorStop(1, rgba(color, 0));
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill(); c.restore();
}
// A horizontal band of shade or light: stops are [t, alpha] across x0..x1.
function xband(c, x0, x1, color, stops) {
  const g = c.createLinearGradient(x0, 0, x1, 0);
  for (const [t, a] of stops) g.addColorStop(t, rgba(color, a));
  c.fillStyle = g; c.fillRect(x0 - 1, -900, x1 - x0 + 2, 2200);
}
function yband(c, y0, y1, color, stops) {
  const g = c.createLinearGradient(0, y0, 0, y1);
  for (const [t, a] of stops) g.addColorStop(t, rgba(color, a));
  c.fillStyle = g; c.fillRect(-900, y0 - 1, 2200, y1 - y0 + 2);
}
function bodyFill(c, path) {
  const g = c.createLinearGradient(0, -440, 0, 1300);
  g.addColorStop(0, P.skinLight); g.addColorStop(0.5, P.skinMid); g.addColorStop(1, P.skinDark);
  path(); c.fillStyle = g; c.fill();
}
function bodyRim(c, path) { // wide low-alpha strokes clipped to the silhouette: a soft shaded edge
  c.save(); path(); c.clip(); c.lineJoin = 'round'; c.strokeStyle = P.skinShade;
  const B = A.body;
  c.globalAlpha = B.rimAlpha;
  for (let i = 0; i < B.rimSteps; i++) { c.lineWidth = 4 + B.rimWidth * (1 - i / B.rimSteps); path(); c.stroke(); }
  c.restore();
}
function crease(c, x0, y0, cx, cy, x1, y1, w, a) {
  c.save(); c.strokeStyle = P.skinShade; c.lineCap = 'round'; c.lineWidth = w; c.globalAlpha = a;
  c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(cx, cy, x1, y1); c.stroke(); c.restore();
}

const BODY = {
  // A forearm running down the screen: a tapering cylinder, lit from the left.
  forearm(c) {
    const B = A.body, path = () => { c.beginPath(); c.moveTo(44, -440); c.bezierCurveTo(24, -200, 2, 80, 8, 300); c.bezierCurveTo(16, 520, 50, 800, 72, 1300); c.lineTo(312, 1300); c.bezierCurveTo(330, 800, 358, 520, 364, 300); c.bezierCurveTo(370, 80, 350, -200, 332, -440); c.closePath(); };
    bodyFill(c, path);
    c.save(); path(); c.clip();
    xband(c, 14, 356, P.skinShade, [[0, B.shade], [0.2, 0], [0.62, 0], [0.86, B.shade * 0.5], [1, B.shade * 1.1]]);
    xband(c, 14, 356, P.skinHi, [[0.2, 0], [0.38, B.hi * 0.7], [0.56, 0]]);
    glow(c, 130, 250, 80, 330, 0.04, P.skinHi, B.hi * 0.6);
    crease(c, 60, 890, 190, 918, 326, 884, 6, 0.16); crease(c, 70, 930, 190, 954, 316, 926, 4, 0.1);
    yband(c, 900, 1300, P.skinShade, [[0, 0], [1, 0.35]]);
    c.restore();
    bodyRim(c, path);
  },
  // A shoulder: the deltoid dome over an arm falling away at the left, the torso running off to the right.
  shoulder(c) {
    const B = A.body, path = () => { c.beginPath(); c.moveTo(-14, 1300); c.bezierCurveTo(-36, 800, -50, 540, -42, 320); c.bezierCurveTo(-32, 150, 70, 24, 214, 22); c.bezierCurveTo(300, 24, 380, 70, 440, 110); c.lineTo(780, 120); c.lineTo(780, 1300); c.closePath(); };
    bodyFill(c, path);
    c.save(); path(); c.clip();
    glow(c, 150, 230, 230, 270, 0, P.skinHi, B.hi);
    xband(c, -10, 110, P.skinShade, [[0, B.shade * 1.1], [1, 0]]);
    xband(c, 380, 600, P.skinShade, [[0, 0], [1, B.shade * 0.7]]);
    yband(c, 10, 150, P.skinShade, [[0, B.shade * 0.9], [1, 0]]);
    c.save(); c.lineCap = 'round'; c.strokeStyle = P.skinShade; c.globalAlpha = 0.11; c.lineWidth = 22;
    c.beginPath(); c.moveTo(236, 50); c.quadraticCurveTo(312, 300, 214, 580); c.stroke();
    c.strokeStyle = P.skinHi; c.globalAlpha = 0.07; c.lineWidth = 10; c.beginPath(); c.moveTo(252, 56); c.quadraticCurveTo(330, 300, 232, 580); c.stroke(); c.restore();
    yband(c, 700, 1300, P.skinShade, [[0, 0], [1, 0.3]]);
    c.restore();
    bodyRim(c, path);
  },
  // A calf: a bulging leg, knee at the top, ankle at the bottom, two muscle heads with a groove between them.
  calf(c) {
    const B = A.body, path = () => { c.beginPath(); c.moveTo(80, -440); c.bezierCurveTo(60, -200, -10, 40, -14, 300); c.bezierCurveTo(-14, 540, 40, 720, 84, 1300); c.lineTo(282, 1300); c.bezierCurveTo(324, 720, 376, 540, 376, 300); c.bezierCurveTo(376, 40, 310, -200, 290, -440); c.closePath(); };
    bodyFill(c, path);
    c.save(); path(); c.clip();
    xband(c, 18, 352, P.skinShade, [[0, B.shade * 1.1], [0.22, 0], [0.75, 0], [1, B.shade * 1.1]]);
    glow(c, 130, 300, 100, 330, -0.03, P.skinHi, B.hi * 1.1);
    glow(c, 250, 350, 70, 250, 0.05, P.skinHi, B.hi * 0.7);
    c.save(); c.lineCap = 'round'; c.strokeStyle = P.skinShade; c.globalAlpha = 0.2; c.lineWidth = 14;
    c.beginPath(); c.moveTo(206, 40); c.bezierCurveTo(196, 220, 216, 380, 196, 560); c.stroke(); c.restore();
    yband(c, 780, 1300, P.skinShade, [[0, 0], [1, 0.3]]);
    yband(c, -440, -160, P.skinShade, [[0, 0.3], [1, 0]]);
    c.restore();
    bodyRim(c, path);
  },
  // A back: broad and flat, shoulders sloping away at the top corners, the spine down the middle, a shoulder blade each side.
  back(c) {
    const B = A.body, path = () => { c.beginPath(); c.moveTo(-420, 150); c.bezierCurveTo(-300, 130, -120, 70, 40, 14); c.bezierCurveTo(100, -6, 140, -32, 160, -56); c.lineTo(200, -56); c.bezierCurveTo(220, -32, 260, -6, 320, 14); c.bezierCurveTo(480, 70, 660, 130, 780, 150); c.lineTo(780, 1300); c.lineTo(-420, 1300); c.closePath(); };
    bodyFill(c, path);
    c.save(); path(); c.clip();
    glow(c, 70, 260, 120, 170, -0.3, P.skinHi, B.hi * 0.9);
    glow(c, 290, 260, 120, 170, 0.3, P.skinHi, B.hi * 0.9);
    xband(c, 146, 214, P.skinShade, [[0, 0], [0.5, B.shade * 0.75], [1, 0]]);
    for (let y = 30; y < 1000; y += 54) glow(c, 180, y, 11, 11, 0, P.skinHi, B.hi * 0.5);
    yband(c, -60, 160, P.skinShade, [[0, B.shade], [1, 0]]);
    yband(c, 760, 1300, P.skinShade, [[0, 0], [1, 0.35]]);
    xband(c, -420, -120, P.skinShade, [[0, 0.4], [1, 0]]); xband(c, 480, 780, P.skinShade, [[0, 0], [1, 0.4]]);
    c.restore();
    bodyRim(c, path);
  },
};

function bodyLayer(name) {
  if (AC.body[name]) return AC.body[name];
  const F = A.field, [x0, y0, x1, y1] = F.extent, k = F.bodyScale;
  const cv = (AC.body[name] = mk(Math.ceil((x1 - x0) * k), Math.ceil((y1 - y0) * k)));
  const c = cv.getContext('2d');
  c.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
  BODY[name](c);
  return cv;
}

// ----- Skin grain, pores and vignette -----
// One screen-sized overlay, built once per size: fine noise (a repeated tile of light and dark specks), scattered pores, and the vignette.
function grainLayer(E) {
  const F = A.field, k = Math.min(E.dpr || 1, F.grainMaxDpr), w = Math.ceil(E.w * k), h = Math.ceil(E.h * k);
  if (AC.grain && AC.gw === w && AC.gh === h) return AC.grain;
  AC.gw = w; AC.gh = h;
  const cv = (AC.grain = mk(w, h)), c = cv.getContext('2d'), rng = makeRng(F.seed);
  const N = F.tile, tile = mk(N, N), tc = tile.getContext('2d'), img = tc.createImageData(N, N), d = img.data, dark = rgbOf(P.skinShade), light = rgbOf(P.skinHi);
  for (let i = 0; i < N * N; i++) {
    const v = rng() * 2 - 1, col = v < 0 ? dark : light;
    d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = Math.round(Math.pow(Math.abs(v), F.grainCurve) * F.grain * 255);
  }
  tc.putImageData(img, 0, 0);
  c.fillStyle = c.createPattern(tile, 'repeat'); c.fillRect(0, 0, w, h);
  c.scale(k, k);
  c.fillStyle = P.pore;
  const n = Math.round(E.w * E.h * F.poreDensity);
  for (let i = 0; i < n; i++) {
    c.globalAlpha = rng.range(F.poreAlpha0, F.poreAlpha1);
    c.beginPath(); c.arc(rng() * E.w, rng() * E.h, rng.range(F.poreR0, F.poreR1), 0, TAU); c.fill();
  }
  c.globalAlpha = 1;
  const cx = E.w / 2, cy = E.h * 0.46, diag = Math.hypot(E.w, E.h), g = c.createRadialGradient(cx, cy, diag * F.vigInner, cx, cy, diag * F.vigOuter);
  g.addColorStop(0, rgba(P.drape, 0)); g.addColorStop(1, rgba(P.drape, F.vignette));
  c.fillStyle = g; c.fillRect(0, 0, E.w, E.h);
  return cv;
}

// The field as one screen-sized bitmap: drape, body part and grain baked together for a given view, so a frame is one 1:1 blit. Two slots: the play view and the card's final
// view (the card eases between them, and until it settles it blits the body and the grain separately). Play keeps one per body part, all built while the menu shows.
function fieldComp(E, v, slot, name = S.st.body) {
  const F = A.field, k = Math.min(E.dpr || 1, F.compMaxDpr), w = Math.ceil(E.w * k), h = Math.ceil(E.h * k);
  const key = slot === 0 ? name : '#card'; // one baked field per body part for play, one for the card's final view
  let c = AC.comp[key];
  if (c && c.name === name && c.w === w && c.h === h && Math.abs(c.s - v.s) + Math.abs(c.ox - v.ox) + Math.abs(c.oy - v.oy) < 1e-3) return c.cv;
  if (!c || c.w !== w || c.h !== h) c = AC.comp[key] = { cv: mk(w, h), w, h, name: '', s: 0, ox: 0, oy: 0 };
  c.name = name; c.s = v.s; c.ox = v.ox; c.oy = v.oy;
  const g = c.cv.getContext('2d'), ex = F.extent, sc = v.s;
  g.setTransform(k, 0, 0, k, 0, 0);
  g.fillStyle = P.drape; g.fillRect(0, 0, E.w, E.h);
  g.drawImage(bodyLayer(name), v.ox + ex[0] * sc, v.oy + ex[1] * sc, (ex[2] - ex[0]) * sc, (ex[3] - ex[1]) * sc);
  g.drawImage(grainLayer(E), 0, 0, E.w, E.h);
  return c.cv;
}

// ----- Stencil outline -----
// The outline is the polygon walked in steps of a few units and pushed sideways by a smooth wobble that is fixed per stencil (seeded from its name), so a re-draw is
// identical. The amplitude stays under a unit: the line is hand-drawn, the polygon is still the truth. A second, fainter pass with its own wobble is the double edge.

function addRing(path, poly, rng, amp, off, inward) {
  const O = A.outline, n = poly.length;
  const w1 = TAU / rng.range(O.lamA, O.lamB), w2 = TAU / rng.range(O.lam2A, O.lam2B), p1 = rng() * TAU, p2 = rng() * TAU;
  let s = 0, first = true;
  const nx = new Float64Array(n), ny = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n], L = dist(a[0], a[1], b[0], b[1]) || 1;
    nx[i] = (b[1] - a[1]) / L; ny[i] = -(b[0] - a[0]) / L; // normal of the edge leaving vertex i
  }
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n], L = dist(a[0], a[1], b[0], b[1]), m = Math.max(1, Math.ceil(L / O.step)), pr = (i + n - 1) % n;
    let vx = nx[pr] + nx[i], vy = ny[pr] + ny[i]; const vl = Math.hypot(vx, vy) || 1; vx /= vl; vy /= vl;
    for (let j = 0; j < m; j++) {
      const w = 0.62 * Math.sin(w1 * s + p1) + 0.38 * Math.sin(w2 * s + p2), t = j / m;
      const d = inward ? inward * (off + amp * (0.5 + 0.5 * w)) : amp * w; // the faint edge only ever moves toward the inside of the shape
      const ux = j === 0 ? vx : nx[i], uy = j === 0 ? vy : ny[i];
      const x = a[0] + (b[0] - a[0]) * t + ux * d, y = a[1] + (b[1] - a[1]) * t + uy * d;
      if (first) { path.moveTo(x, y); first = false; } else path.lineTo(x, y);
      s += L / m;
    }
  }
  path.closePath();
}
// Which side of a ring's edges is the inside of the shape (+1 along the edge normal used by addRing, or -1), by probing the midpoints of its longer edges.
function inwardSide(shape, poly) {
  let vote = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], L = dist(a[0], a[1], b[0], b[1]);
    if (L < 4) continue;
    const nx = (b[1] - a[1]) / L, ny = -(b[0] - a[0]) / L;
    vote += pointInShape(shape, (a[0] + b[0]) / 2 + nx * 0.8, (a[1] + b[1]) / 2 + ny * 0.8) ? 1 : -1;
  }
  return vote >= 0 ? 1 : -1;
}
function outlineFor(idx) {
  if (AC.outline[idx]) return AC.outline[idx];
  const O = A.outline, seed = hashString(stOf(idx).name), main = new Path2D(), edge = new Path2D();
  stOf(idx).shape.forEach((poly, ri) => {
    addRing(main, poly, makeRng(seed + ri * 7919), O.amp, 0, 0);
    addRing(edge, poly, makeRng((seed ^ 0x9e3779b9) + ri * 104729), O.amp * O.edgeAmp, O.edgeOffset, inwardSide(stOf(idx).shape, poly));
  });
  return (AC.outline[idx] = { main, edge });
}

// The outline baked into one layer at the ink layer's scale (three strokes of a long path are slow to redo every frame): the dark line under it, the faint second edge, the line.
function outlineLayer(idx, k) {
  if (AC.ol && AC.olIdx === idx && AC.olK === k) return AC.ol;
  const O = A.outline, ol = outlineFor(idx);
  AC.olIdx = idx; AC.olK = k;
  AC.ol = mk(Math.ceil(T.designW * k), Math.ceil(T.designH * k));
  const c = AC.ol.getContext('2d');
  c.setTransform(k, 0, 0, k, 0, 0); c.lineJoin = 'round'; c.lineCap = 'round';
  c.globalAlpha = O.shadowAlpha; c.strokeStyle = P.stencilShadow; c.lineWidth = T.outlineWidth + O.shadowWidth; c.stroke(ol.main);
  c.globalAlpha = O.edgeAlpha; c.strokeStyle = P.stencilDeep; c.lineWidth = O.edgeWidth; c.stroke(ol.edge);
  c.globalAlpha = O.alpha; c.strokeStyle = P.stencil; c.lineWidth = T.outlineWidth; c.stroke(ol.main);
  return AC.ol;
}

// ----- Ink -----
// The ink layer's core is filled with a repeating sheen pattern (near-black with faint diagonal blue bands, fixed in design space, so overlapping strokes never show
// seams). The bleed at the edge of a stroke is a wider, very faint stroke laid under every core stroke: overlaps stack, so it is strongest beside the stroke and
// fades outward. It lives in the same layer, so it is clipped to the stencil like the ink.

function inkTile(sk) {
  if (AC.inkTile[sk.id]) return AC.inkTile[sk.id];
  const n = A.ink.tile, cv = mk(n, n), c = cv.getContext('2d');
  c.fillStyle = sk.ink; c.fillRect(0, 0, n, n);
  const g = c.createLinearGradient(0, 0, n, n); // period 0.5 in t, so the diagonal bands tile in x and y
  for (let i = 0; i <= 4; i++) g.addColorStop(i / 4, rgba(sk.sheen, i % 2 ? sk.sheenA : 0));
  c.fillStyle = g; c.fillRect(0, 0, n, n);
  return (AC.inkTile[sk.id] = cv);
}

// The ink lives on an offscreen layer (design space, clipped to the stencil like the score) that only ever receives new
// segments; each frame just blits it. A change of layer scale rebuilds it from the stored strokes.
function syncInk(E, s) {
  const k = s * Math.min(E.dpr || 1, T.inkLayerMaxDpr);
  const w = Math.ceil(T.designW * k), h = Math.ceil(T.designH * k);
  if (!S.layer || S.layerK !== k) {
    S.layer = mk(w, h);
    S.layerK = k; S.inkDone = []; S.inkFrom = 0;
    const c = S.layer.getContext('2d');
    c.setTransform(k, 0, 0, k, 0, 0);
    shapePath(c, S.st.shape); c.clip('evenodd');
    c.strokeStyle = c.fillStyle = c.createPattern(inkTile(SK.i), 'repeat');
    c.lineCap = 'round'; c.lineJoin = 'round';
  }
  const c = S.layer.getContext('2d'), pad = A.ink.haloPad, tol = A.ink.widthTol, halo = rgba(SK.i.halo, A.ink.haloAlpha), core = c.strokeStyle;
  // Strokes are flat lists of x, y, radius. New segments are drawn as one path per run of similar width (a slow stroke is fat and a fast one thin), the bleed halo
  // first and the sheen-filled core over it: a frame that lays a dozen segments costs a couple of strokes, not two dozen.
  const wk = T.inkStrokeWidth / (2 * T.needleR);
  while (S.inkFrom < S.strokes.length - 1 && (S.inkDone[S.inkFrom] || 0) >= S.strokes[S.inkFrom].length) S.inkFrom++;
  for (let n = S.inkFrom; n < S.strokes.length; n++) {
    const pts = S.strokes[n], done = S.inkDone[n] || 0;
    if (done >= pts.length) continue;
    let open = false, w0 = 0;
    for (let i = done < 3 ? 0 : done; i < pts.length; i += 3) {
      const hold = i === 0 || (pts[i] === pts[i - 3] && pts[i + 1] === pts[i - 2]); // a first point or a hold: a disc, swelling in place
      if (hold) {
        if (open) { c.strokeStyle = halo; c.lineWidth = w0 + 2 * pad; c.stroke(); c.strokeStyle = core; c.lineWidth = w0; c.stroke(); open = false; }
        c.fillStyle = halo; c.beginPath(); c.arc(pts[i], pts[i + 1], pts[i + 2] * wk + pad, 0, TAU); c.fill();
        c.fillStyle = core; c.beginPath(); c.arc(pts[i], pts[i + 1], pts[i + 2] * wk, 0, TAU); c.fill();
        continue;
      }
      const lw = (pts[i - 1] + pts[i + 2]) * wk;
      if (open && Math.abs(lw - w0) > tol) { c.strokeStyle = halo; c.lineWidth = w0 + 2 * pad; c.stroke(); c.strokeStyle = core; c.lineWidth = w0; c.stroke(); open = false; }
      if (!open) { c.beginPath(); c.moveTo(pts[i - 3], pts[i - 2]); w0 = lw; open = true; }
      c.lineTo(pts[i], pts[i + 1]);
    }
    if (open) { c.strokeStyle = halo; c.lineWidth = w0 + 2 * pad; c.stroke(); c.strokeStyle = core; c.lineWidth = w0; c.stroke(); }
    S.inkDone[n] = pts.length;
  }
}

// The ruined piece's grey ink: the ink layer's shape filled grey, built once when the smear starts (and again after a resize).
function syncGrey() {
  if (S.grey && S.greyK === S.layerK) return;
  S.grey = mk(S.layer.width, S.layer.height);
  S.greyK = S.layerK;
  const c = S.grey.getContext('2d');
  c.drawImage(S.layer, 0, 0);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = P.smear; c.fillRect(0, 0, S.grey.width, S.grey.height);
}

// The skin-redness halo around a finished piece, built once per stencil at card time: the shape's shadow, drawn with the shape itself pushed off the canvas.
function blushLayer(idx) {
  if (AC.blush && AC.blushIdx === idx) return AC.blush;
  const C = A.card, bb = bboxOf(idx), m = C.blushMargin, k = C.blushScale, off = 4000;
  AC.blushIdx = idx;
  AC.blush = mk(Math.ceil((bb.w + 2 * m) * k), Math.ceil((bb.h + 2 * m) * k));
  const c = AC.blush.getContext('2d');
  c.setTransform(k, 0, 0, k, -off - (bb.x0 - m) * k, -(bb.y0 - m) * k);
  c.shadowOffsetX = off; c.fillStyle = P.blush;
  for (const [blur, a] of [[C.blushBlur, 1], [C.blushBlur * 0.4, 0.7]]) {
    c.shadowColor = rgba(P.blush, a); c.shadowBlur = blur * k;
    shapePath(c, stOf(idx).shape); c.fill('evenodd');
  }
  return AC.blush;
}

// ----- Story decorations (card only) -----
// Drawn over the finished piece and clipped to the stencil where they must stay inside it; they never touch the polygon or the coverage grid.
const GEM_LINES = [ // facet lines for the Diamond (design space): crown, girdle and pavilion
  [130, 150, 122, 269], [130, 150, 180, 269], [180, 150, 122, 269], [180, 150, 238, 269], [230, 150, 180, 269], [230, 150, 238, 269],
  [65, 269, 295, 269], [122, 269, 180, 540], [180, 269, 180, 540], [238, 269, 180, 540], [122, 269, 111, 382], [238, 269, 249, 382],
];
const STORY_W = { banner: 304 }; // design-space width of a decoration that sticks out of the stencil (the ribbon's tails), so the card view keeps it on screen
const SWIRL = (() => { // an Archimedean spiral for the Star, centre out, two and a half turns
  const pts = [], n = 72;
  for (let i = 0; i <= n; i++) { const u = i / n, r = 5 + 48 * u, a = 0.5 + 2.5 * TAU * u; pts.push(180 + r * Math.cos(a), 352 + r * Math.sin(a)); }
  return pts;
})();

function sparkle(ctx, x, y, L) {
  ctx.moveTo(x - L, y); ctx.lineTo(x + L, y); ctx.moveTo(x, y - L); ctx.lineTo(x, y + L);
}

function drawStory(ctx, ct) {
  const st = S.st, Y = A.story;
  if (!st.story || ct < 0) return;
  const pct = percent(), passed = S.ended !== 'ruined' && pct >= T.passPercent;
  const rev = clamp((ct - Y.delay) / Y.sec, 0, 1);
  if (rev <= 0) return;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (st.story === 'gem') {
    const a = clamp((pct - Y.facetFrom) / (100 - Y.facetFrom), 0, 1) * rev;
    if (a <= 0) { ctx.restore(); return; }
    shapePath(ctx, st.shape); ctx.clip('evenodd');
    ctx.globalAlpha = a * Y.facetAlpha; ctx.strokeStyle = P.facet; ctx.lineWidth = Y.facetWidth;
    ctx.beginPath();
    for (const l of GEM_LINES) { ctx.moveTo(l[0], l[1]); ctx.lineTo(l[2], l[3]); }
    ctx.stroke();
    ctx.globalAlpha = a; ctx.strokeStyle = P.glint; ctx.lineWidth = 1.6;
    ctx.beginPath(); sparkle(ctx, 152, 192, Y.glintSize); sparkle(ctx, 218, 322, Y.glintSize * 0.6); ctx.stroke();
  } else if (passed && st.story === 'swirl') {
    shapePath(ctx, st.shape); ctx.clip('evenodd');
    ctx.globalAlpha = rev * Y.swirlAlpha; ctx.strokeStyle = P.facet; ctx.lineWidth = Y.swirlWidth;
    ctx.beginPath(); ctx.moveTo(SWIRL[0], SWIRL[1]);
    for (let i = 2; i < SWIRL.length; i += 2) ctx.lineTo(SWIRL[i], SWIRL[i + 1]);
    ctx.stroke();
    ctx.globalAlpha = rev; ctx.strokeStyle = P.glint; ctx.lineWidth = 1.6;
    ctx.beginPath(); sparkle(ctx, 150, 288, Y.glintSize * 0.7); ctx.stroke();
  } else if (passed && st.story === 'banner') {
    // A ribbon across the middle of the heart, a little askew, wider than the heart so its tails sit outside the fill. Pops in from small.
    const k = 0.8 + 0.2 * ease.outBack(rev);
    ctx.globalAlpha = rev; ctx.translate(180, 338); ctx.rotate(Y.bannerTilt); ctx.scale(k, k);
    ctx.lineWidth = 2.4; ctx.strokeStyle = P.ink;
    ctx.fillStyle = P.paperShade; // the two tails, behind the body
    for (const sg of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(sg * 112, -18); ctx.lineTo(sg * 150, -10); ctx.lineTo(sg * 136, 2); ctx.lineTo(sg * 150, 14); ctx.lineTo(sg * 112, 22); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = P.paper; // the body, sagging in the middle
    ctx.beginPath(); ctx.moveTo(-118, -20); ctx.quadraticCurveTo(0, -2, 118, -20); ctx.lineTo(118, 20); ctx.quadraticCurveTo(0, 38, -118, 20); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.paperEdge; // the folds where the tails go behind
    for (const sg of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sg * 118, -20); ctx.lineTo(sg * 104, -13); ctx.lineTo(sg * 118, 20); ctx.closePath(); ctx.fill(); }
    label(ctx, Y.bannerText, 0, 9, FONT.mid, P.ink);
  }
  ctx.restore();
}

// ----- The piece: field, ink, story, outline, slips -----
// One draw for play and for the card. `v` maps design space to the screen, `ct` is the card time (-1 while playing). The layers are kept at the play scale and
// the card only ever shrinks the piece, so nothing is rebuilt when the card opens.
function drawPiece(ctx, E, v, ct) {
  const shape = S.st.shape, f = S.fx, now = E.time, sc = v.s, F = A.field, ex = F.extent;
  syncInk(E, view(E).s);
  if (ct < 0 || ct >= J.cardSlideSec) ctx.drawImage(fieldComp(E, v, ct < 0 ? 0 : 1), 0, 0, E.w, E.h);
  else { // the card is easing to its view
    ctx.drawImage(bodyLayer(S.st.body), v.ox + ex[0] * sc, v.oy + ex[1] * sc, (ex[2] - ex[0]) * sc, (ex[3] - ex[1]) * sc);
    ctx.drawImage(grainLayer(E), 0, 0, E.w, E.h);
  }
  const W = T.designW * sc, H = T.designH * sc;
  if (ct >= 0 && S.ended !== 'ruined') {
    const bb = bboxOf(S.idx), m = A.card.blushMargin;
    ctx.globalAlpha = A.card.blush * ease.outQuad(clamp(ct / (J.cardSlideSec * 2), 0, 1));
    ctx.drawImage(blushLayer(S.idx), v.ox + (bb.x0 - m) * sc, v.oy + (bb.y0 - m) * sc, (bb.w + 2 * m) * sc, (bb.h + 2 * m) * sc);
    ctx.globalAlpha = 1;
  }
  if (!S.ended && S.hint.n) drawHint(ctx, E, v); // under the ink, over the skin
  // Only the stencil's own rectangle of each layer is blitted (the ink and its bleed stay inside it).
  const bb = bboxOf(S.idx), bm = A.ink.blitMargin, bx = Math.max(0, bb.x0 - bm), by = Math.max(0, bb.y0 - bm), bw = Math.min(T.designW, bb.x1 + bm) - bx, bh = Math.min(T.designH, bb.y1 + bm) - by;
  const lk = S.layer.width / T.designW;
  ctx.drawImage(S.layer, bx * lk, by * lk, bw * lk, bh * lk, v.ox + bx * sc, v.oy + by * sc, bw * sc, bh * sc);
  if (f.smear > 0) {
    syncGrey();
    ctx.globalAlpha = f.smear;
    ctx.drawImage(S.grey, v.ox, v.oy + f.smear * J.smearDrop * sc, W, H * (1 + f.smear * 0.01));
    ctx.globalAlpha = 1;
  }
  ctx.save();
  ctx.translate(v.ox, v.oy); ctx.scale(sc, sc);
  const flash = 1 - (now - f.flashT) / J.finishFlashSec;
  if (flash > 0 && flash <= 1) {
    shapePath(ctx, shape);
    ctx.globalAlpha = flash * J.finishFlashAlpha; ctx.fillStyle = P.glint; ctx.fill('evenodd'); ctx.globalAlpha = 1;
  }
  drawStory(ctx, ct);
  const fade = f.endT > 0 ? clamp((now - f.endT) / J.outlineFadeSec, 0, 1) : 0, a = 1 - (1 - J.outlineEndAlpha) * ease.outQuad(fade);
  ctx.restore(); // the outline layer is blitted in screen space, the slip flash and marks go back into design space
  // A stencil the menu had not prebuilt gets its outline bitmap on the second frame, so no single frame carries all of it.
  if ((AC.ol && AC.olIdx === S.idx && AC.olK === lk) || ct >= 0 || S.olWait <= 0) {
    ctx.globalAlpha = a; ctx.drawImage(outlineLayer(S.idx, lk), bx * lk, by * lk, bw * lk, bh * lk, v.ox + bx * sc, v.oy + by * sc, bw * sc, bh * sc); ctx.globalAlpha = 1;
  } else S.olWait--;
  ctx.save();
  ctx.translate(v.ox, v.oy); ctx.scale(sc, sc);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const red = 1 - (now - f.slipT) / J.slipFlashSec;
  if (red > 0 && red <= 1) { ctx.globalAlpha = red * a; ctx.strokeStyle = P.slip; ctx.lineWidth = T.outlineWidth + 1.5; ctx.stroke(outlineFor(S.idx).main); ctx.globalAlpha = 1; }
  ctx.lineCap = 'round';
  const m = T.slipMarkSize;
  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = pass ? P.slip : P.slipShadow; ctx.lineWidth = pass ? 3 : 5.5;
    for (const k of S.marks) {
      ctx.beginPath();
      ctx.moveTo(k.x - m, k.y - m); ctx.lineTo(k.x + m, k.y + m);
      ctx.moveTo(k.x + m, k.y - m); ctx.lineTo(k.x - m, k.y + m);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ----- The tattoo machine -----
// A pen-style machine, in screen px, tip at the local origin and the finger at (0, needleOffset): the needle and a steel nozzle with a band, a short neck, a
// knurled grip under the finger, a tail, and a cable trailing off the bottom of the screen. Shapes are built once; gradients once per skin. A skin recolours it and adds
// one decoration (`deco`): a black band across the grip, an engraved plate, or a single ring.
function machineShapes() {
  if (AC.shapes) return AC.shapes;
  const M = A.machine, g = {};
  g.noz = new Path2D(); g.noz.moveTo(-M.nozzleTopW / 2, M.needleLen - 2); g.noz.lineTo(M.nozzleTopW / 2, M.needleLen - 2); g.noz.lineTo(M.nozzleW / 2, M.nozzleEnd); g.noz.lineTo(-M.nozzleW / 2, M.nozzleEnd); g.noz.closePath();
  g.band = new Path2D(); g.band.rect(-M.nozzleW / 2 - 1, M.nozzleEnd, M.nozzleW + 2, M.bandLen);
  g.neck = new Path2D(); g.neck.moveTo(-M.nozzleW / 2, M.nozzleEnd + M.bandLen); g.neck.lineTo(M.nozzleW / 2, M.nozzleEnd + M.bandLen); g.neck.lineTo(M.neckW / 2, M.neckEnd); g.neck.lineTo(-M.neckW / 2, M.neckEnd); g.neck.closePath();
  g.grip = new Path2D(); rr(g.grip, -M.gripW / 2, M.neckEnd - 2, M.gripW, M.gripEnd - M.neckEnd + 2, 8);
  g.tail = new Path2D(); g.tail.moveTo(-M.tailW / 2, M.gripEnd - 4); g.tail.lineTo(M.tailW / 2, M.gripEnd - 4); g.tail.lineTo(M.tailW / 2 - 2, M.tailEnd - 4); g.tail.arcTo(0, M.tailEnd + 4, -M.tailW / 2 + 2, M.tailEnd - 4, M.tailW / 2); g.tail.lineTo(-M.tailW / 2 + 2, M.tailEnd - 4); g.tail.closePath();
  g.sil = new Path2D(); for (const p of [g.noz, g.neck, g.grip, g.tail]) g.sil.addPath(p);
  g.knurl = new Path2D(); for (let y = M.neckEnd + 6; y < M.gripEnd - 4; y += M.knurl) { g.knurl.moveTo(-M.gripW / 2 + 3, y); g.knurl.lineTo(M.gripW / 2 - 3, y); }
  g.hi = new Path2D(); g.hi.moveTo(-M.gripW / 2 + 5, M.neckEnd + 2); g.hi.lineTo(-M.gripW / 2 + 5, M.gripEnd - 6);
  const gy = M.neckEnd + 20, hw = M.gripW / 2;
  g.gripband = new Path2D(); g.gripband.rect(-hw + 1, gy - 5, M.gripW - 2, 10);
  g.plate = new Path2D(); rr(g.plate, -6, M.gripEnd - 30, 12, 20, 3);
  g.plateLines = new Path2D(); for (const dy of [-22, -17, -12]) { g.plateLines.moveTo(-3.5, M.gripEnd + dy); g.plateLines.lineTo(3.5, M.gripEnd + dy); }
  g.ring = new Path2D(); g.ring.moveTo(-hw + 1, gy); g.ring.quadraticCurveTo(0, gy + 3, hw - 1, gy);
  return (AC.shapes = g);
}
function machineGfx(ctx, sk) {
  if (AC.mach[sk.id]) return AC.mach[sk.id];
  const M = A.machine;
  const lin = (x0, stops) => { const gr = ctx.createLinearGradient(x0, 0, -x0, 0); for (const [t, col] of stops) gr.addColorStop(t, col); return gr; };
  return (AC.mach[sk.id] = {
    ...machineShapes(),
    steelG: lin(-M.nozzleW / 2, [[0, sk.steelDark], [0.4, sk.steel], [0.55, P.glint], [1, sk.steelDark]]),
    bodyG: lin(-M.gripW / 2, [[0, sk.body], [0.32, sk.hi], [0.5, sk.hi], [1, sk.body]]),
    tailG: lin(-M.tailW / 2, [[0, sk.body], [0.45, sk.hi], [1, sk.body]]),
  });
}
// The machine body (tail, grip, neck, nozzle, band and the skin's decoration) with its drop shadow, at the current transform; `base` is the alpha it is drawn at.
function drawMachineBody(ctx, g, sk, base) {
  const M = A.machine;
  ctx.save(); ctx.translate(M.shadowDx, M.shadowDy); ctx.globalAlpha = base * M.shadowAlpha; ctx.fillStyle = P.shadow; ctx.fill(g.sil); ctx.restore();
  ctx.fillStyle = g.tailG; ctx.fill(g.tail);
  ctx.fillStyle = g.bodyG; ctx.fill(g.grip);
  ctx.strokeStyle = P.ink; ctx.lineWidth = 1; ctx.globalAlpha = base * 0.5; ctx.stroke(g.knurl); ctx.globalAlpha = base;
  ctx.strokeStyle = sk.steelDark; ctx.lineWidth = 1.2; ctx.stroke(g.grip);
  ctx.strokeStyle = sk.hi; ctx.lineWidth = 1.5; ctx.globalAlpha = base * 0.7; ctx.stroke(g.hi); ctx.globalAlpha = base;
  if (sk.deco === 'gripband') { ctx.fillStyle = P.ink; ctx.fill(g.gripband); }
  else if (sk.deco === 'plate') { ctx.fillStyle = sk.hi; ctx.fill(g.plate); ctx.strokeStyle = sk.steelDark; ctx.lineWidth = 1; ctx.stroke(g.plate); ctx.stroke(g.plateLines); }
  else if (sk.deco === 'ring') { ctx.strokeStyle = P.glint; ctx.lineWidth = 2.2; ctx.stroke(g.ring); }
  ctx.fillStyle = g.bodyG; ctx.fill(g.neck);
  ctx.fillStyle = g.steelG; ctx.fill(g.noz); ctx.strokeStyle = sk.steelDark; ctx.lineWidth = 1; ctx.stroke(g.noz);
  ctx.fillStyle = sk.band; ctx.fill(g.band);
}

function drawMachine(ctx, E) {
  const f = S.finger; if (!f) return;
  const fx = S.fx, now = E.time, s = view(E).s, off = T.needleOffset, M = A.machine, sk = SK.m, g = machineGfx(ctx, sk);
  const out = fx.endT > 0 ? clamp((now - fx.endT) / J.machineFadeSec, 0, 1) : 0;
  if (out >= 1) return;
  const vib = now - fx.inkT < J.vibHold && !S.ended ? Math.sin(now * J.vibHz * 2 * Math.PI) * J.vibAmp : 0;
  ctx.save();
  ctx.globalAlpha = 1 - out;
  ctx.translate(f.x, f.y - off);
  const sc = pop(now - fx.downT, J.settleSec, J.settleFrom);
  ctx.scale(sc, sc);
  const base = ctx.globalAlpha;
  // the cable, from the tail out to the bottom right of the screen
  const ex = E.w - f.x + 30, ey = E.h - (f.y - off) + 40;
  ctx.lineCap = 'round';
  ctx.strokeStyle = sk.cable; ctx.lineWidth = M.cableW; ctx.globalAlpha = base * M.cableAlpha;
  ctx.beginPath(); ctx.moveTo(0, M.tailEnd); ctx.bezierCurveTo(-8, M.tailEnd + 60, ex * 0.3, ey - 140, ex, ey); ctx.stroke();
  ctx.strokeStyle = sk.hi; ctx.lineWidth = 1.1; ctx.globalAlpha = base * 0.4;
  ctx.beginPath(); ctx.moveTo(-1, M.tailEnd); ctx.bezierCurveTo(-9, M.tailEnd + 60, ex * 0.3 - 1, ey - 140, ex - 1, ey); ctx.stroke();
  ctx.globalAlpha = base;
  ctx.save();
  ctx.translate(vib, 0);
  drawMachineBody(ctx, g, sk, base);
  ctx.restore();
  // the needle: a bright steel pin out of the nozzle, tipped with a bead of ink
  ctx.strokeStyle = P.steel; ctx.lineWidth = M.needleW; ctx.beginPath(); ctx.moveTo(0, M.needleLen); ctx.lineTo(0, 0.5); ctx.stroke();
  ctx.strokeStyle = P.steel;
  ctx.beginPath(); ctx.arc(0, 0, S.r * s, 0, TAU); ctx.lineWidth = 1.5; ctx.globalAlpha = base * 0.8; ctx.stroke(); ctx.globalAlpha = base;
  ctx.fillStyle = SK.i.ink; ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, TAU); ctx.fill();
  ctx.fillStyle = SK.i.gloss; ctx.beginPath(); ctx.arc(-0.8, -0.8, 0.9, 0, TAU); ctx.fill();
  // Glint: a small four-point sparkle that breathes, brighter and longer while inking.
  const gl = 0.5 + 0.5 * Math.sin(now * J.glintHz), laying = now - fx.inkT < J.vibHold, L = J.glintLen * (0.5 + gl) * (laying ? 1.5 : 1);
  ctx.globalAlpha = base * (laying ? 0.5 + 0.5 * gl : 0.25 + 0.35 * gl);
  ctx.strokeStyle = P.glint; ctx.lineWidth = 1.2;
  ctx.beginPath(); sparkle(ctx, 0, 0, L); ctx.stroke();
  ctx.restore();
}

// ----- Small glyphs -----
function starPath(ctx, cx, cy, R) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? R * A.star.inner : R, a = -Math.PI / 2 + (i * Math.PI) / 5;
    i ? ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)) : ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  ctx.closePath();
}
// An ink star: solid ink with a small blue sheen. An unearned star is a faint outline on the paper.
function drawStar(ctx, cx, cy, R, filled) {
  starPath(ctx, cx, cy, R);
  ctx.lineJoin = 'round';
  if (filled) {
    ctx.fillStyle = P.ink; ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = Math.max(1, R * 0.14); ctx.stroke();
    starPath(ctx, cx - R * 0.14, cy - R * 0.12, R * 0.5);
    ctx.globalAlpha = A.star.sheen; ctx.fillStyle = P.inkSheen; ctx.fill(); ctx.globalAlpha = 1;
  } else { ctx.strokeStyle = P.paperEdge; ctx.lineWidth = R > 8 ? 2 : 1.2; ctx.stroke(); }
}

function drawLock(ctx, cx, cy, k = 1) {
  ctx.fillStyle = P.lock; ctx.strokeStyle = P.lock; ctx.lineWidth = 3 * k;
  ctx.fillRect(cx - 9 * k, cy - 2 * k, 18 * k, 14 * k);
  ctx.beginPath(); ctx.arc(cx, cy - 2 * k, 6 * k, Math.PI, 0); ctx.stroke();
}

function drawPin(ctx, x, y, r) {
  ctx.globalAlpha = 0.35; ctx.fillStyle = P.shadow; ctx.beginPath(); ctx.arc(x + 1.6, y + 2.4, r, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  ctx.fillStyle = P.pin; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = P.ink; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = P.pinHi; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.32, 0, TAU); ctx.fill();
}

// A plate: rounded rectangle, dark and translucent, so HUD text stays legible on skin.
function plate(ctx, x, y, w, h) {
  ctx.globalAlpha = A.hud.plateAlpha; ctx.fillStyle = P.plate; ctx.beginPath(); rr(ctx, x, y, w, h, A.line.radius); ctx.fill();
  ctx.globalAlpha = 0.28; ctx.strokeStyle = P.cream; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
}

// A button: ink black with a blue rule for the primary, flash paper for the rest, with the shared drop shadow.
function inkButton(ctx, str, cx, cy, w, h, primary, font) {
  const x = cx - w / 2, y = cy - h / 2, L = A.line;
  ctx.globalAlpha = L.shadowAlpha; ctx.fillStyle = P.shadow; ctx.beginPath(); rr(ctx, x + L.shadowDx, y + L.shadowDy, w, h, L.radius); ctx.fill(); ctx.globalAlpha = 1;
  ctx.beginPath(); rr(ctx, x, y, w, h, L.radius); ctx.fillStyle = primary ? P.ink : P.paperShade; ctx.fill();
  ctx.lineWidth = L.weight; ctx.strokeStyle = primary ? P.stencilDeep : P.ink; ctx.beginPath(); rr(ctx, x + 4, y + 4, w - 8, h - 8, L.radius - 4); ctx.globalAlpha = primary ? 0.9 : 0.55; ctx.stroke(); ctx.globalAlpha = 1;
  label(ctx, str, cx, cy + 1, font, primary ? P.cream : P.textDark);
  return { x, y, w, h };
}

// ----- Menu textures -----
// The board: flash-sheet paper tone with fibres and a soft vignette, built once per size.
function boardLayer(E) {
  const Bd = A.menu, k = Math.min(E.dpr || 1, Bd.boardMaxDpr), w = Math.ceil(E.w * k), h = Math.ceil(E.h * k);
  if (AC.board && AC.bw === w && AC.bh === h) return AC.board;
  AC.bw = w; AC.bh = h;
  const cv = (AC.board = mk(w, h)), c = cv.getContext('2d'), rng = makeRng(A.field.seed + 1);
  c.scale(k, k);
  const cx = E.w / 2, cy = E.h * 0.4, diag = Math.hypot(E.w, E.h), g = c.createRadialGradient(cx, cy, 0, cx, cy, diag * 0.62);
  g.addColorStop(0, P.boardHi); g.addColorStop(0.55, P.board); g.addColorStop(1, P.boardDark);
  c.fillStyle = g; c.fillRect(0, 0, E.w, E.h);
  c.strokeStyle = P.boardFiber; c.lineWidth = 0.7; c.lineCap = 'round';
  const n = Math.round(E.w * E.h * Bd.fiberDensity);
  for (let i = 0; i < n; i++) {
    const x = rng() * E.w, y = rng() * E.h, a = rng() * TAU, len = rng.range(4, 20);
    c.globalAlpha = rng.range(0.05, 0.2);
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); c.stroke();
  }
  c.globalAlpha = 1;
  return cv;
}

// The title: heavy letters built from many jittered copies (a rough, fat edge), a brush swash under them, dry-brush streaks cut through, and a misregistered blue
// copy behind like an off-register flash print. Built once per pixel ratio.
function titleLayer(E) {
  const M = A.title, k = Math.min(E.dpr || 1, 2);
  if (AC.title && AC.titleK === k) return AC.title;
  AC.titleK = k;
  const w = M.w, h = M.h, ink = mk(Math.ceil(w * k), Math.ceil(h * k)), c = ink.getContext('2d'), rng = makeRng(M.seed);
  c.scale(k, k);
  c.font = `${A.type.weight} ${M.size}px ${A.type.display}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  const cx = w / 2, cy = h * 0.42;
  c.fillStyle = P.ink; c.strokeStyle = P.ink; c.lineJoin = 'round';
  for (let i = 0; i < M.passes; i++) { const a = rng() * TAU, r = rng() * M.jitter; c.fillText('INK', cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  c.lineWidth = M.edge; c.lineJoin = 'bevel';
  for (let i = 0; i < M.edgePasses; i++) { const a = rng() * TAU, r = rng() * M.jitter * 1.4; c.strokeText('INK', cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  // the swash: a tapered brush stroke under the word, ragged along its top edge
  c.beginPath();
  const x0 = cx - w * 0.4, x1 = cx + w * 0.4, ys = cy + M.size * 0.5, N = 40;
  for (let i = 0; i <= N; i++) { const t = i / N; c.lineTo(x0 + (x1 - x0) * t, ys - M.swash * Math.pow(Math.sin(Math.PI * t), 0.6) * 0.5 + rng.range(-1, 1)); }
  for (let i = N; i >= 0; i--) { const t = i / N; c.lineTo(x0 + (x1 - x0) * t, ys + M.swash * Math.pow(Math.sin(Math.PI * t), 0.6) * 0.5 + rng.range(-0.6, 0.6)); }
  c.closePath(); c.fill();
  // dry-brush streaks: thin, mostly horizontal cuts, so the letters read as one loaded brush dragged across paper
  c.globalCompositeOperation = 'destination-out'; c.lineCap = 'round';
  for (let i = 0; i < M.streaks; i++) {
    const y = rng.range(cy - M.size * 0.38, ys + 3), x = rng.range(cx - w * 0.44, cx + w * 0.38), len = rng.range(M.streakMin, M.streakMax);
    c.globalAlpha = rng.range(0.25, 0.9); c.lineWidth = rng.range(0.5, 1.4);
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + len, y + rng.range(-1, 1) * len * 0.05); c.stroke();
  }
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  const out = (AC.title = mk(ink.width, ink.height)), o = out.getContext('2d');
  o.drawImage(ink, M.shadowDx * k, M.shadowDy * k);
  o.globalCompositeOperation = 'source-in'; o.fillStyle = P.stencilDeep; o.fillRect(0, 0, out.width, out.height);
  o.globalCompositeOperation = 'source-over'; o.drawImage(ink, 0, 0);
  return out;
}

// Idle work while the menu shows, a small piece per frame, so the first frames of play have almost nothing left to build: the grain, each body part and its baked field,
// then every stencil's coverage grid (a few milliseconds a frame, the stencil Play would open first) and outline path, and the outline bitmap of that first stencil. Each
// bitmap is forced to rasterise here (a one-pixel read) rather than on the first play frame.
function warmStep(E, next) {
  const names = Object.keys(BODY), fixed = 1 + 2 * names.length, flush = (cv) => cv.getContext('2d').getImageData(0, 0, 1, 1);
  if (AC.warm < fixed) {
    const st = AC.warm++;
    if (st === 0) flush(grainLayer(E));
    else if (st <= names.length) flush(bodyLayer(names[st - 1]));
    else flush(fieldComp(E, view(E), 0, names[st - 1 - names.length]));
    return;
  }
  if (!AC.order) AC.order = [next, ...STENCILS.map((_, i) => i).filter((i) => i !== next)];
  if (AC.warmGrid < AC.order.length) { if (gridStep(AC.order[AC.warmGrid], A.menu.warmMs)) AC.warmGrid++; return; }
  if (AC.warmOl < AC.order.length) { outlineFor(AC.order[AC.warmOl++]); return; }
  if (DAILY_ST && !gridCache[DAILY_IDX]) { gridStep(DAILY_IDX, A.menu.warmMs); return; } // today's daily, turned
  if (!AC.warmBmp) { AC.warmBmp = true; flush(outlineLayer(AC.order[0], view(E).s * Math.min(E.dpr || 1, T.inkLayerMaxDpr))); }
}

// A stencil's polygon as one Path2D in design space, for the tiny previews on the menu.
function miniPath(idx) {
  if (AC.mini[idx]) return AC.mini[idx];
  const p = new Path2D();
  for (const poly of stOf(idx).shape) { poly.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); }
  return (AC.mini[idx] = p);
}

// ---------- Progress (saved) ----------
// unlocked: highest unlocked stencil index. best: percentage per stencil. stars: best stars per stencil. clean: a zero-slip pass per stencil. cs: best stars of a zero-slip
// pass per stencil. badges: { id: true } once earned. skin: { machine, ink } skin ids (each counts only while its badge is earned). daily: { 'YYYY-MM-DD': { idx, vi, first, best } } for the last dailyKeep days.

function progress(E) {
  const best = E.save.get('best', {}), stars = E.save.get('stars', {}), clean = E.save.get('clean', {}), cs = E.save.get('cs', {}), badges = E.save.get('badges', {});
  const unlocked = clamp(E.save.get('unlocked', 0), 0, STENCILS.length - 1);
  let total = 0;
  for (let i = 0; i < STENCILS.length; i++) total += stars[i] || 0;
  return { best, stars, clean, cs, badges, unlocked, total };
}

function recordResult(E, idx, { pct, stars, ruined, clean }) {
  const p = progress(E);
  if (!ruined && pct > (p.best[idx] || 0)) E.save.set('best', { ...p.best, [idx]: pct });
  if (stars > (p.stars[idx] || 0)) E.save.set('stars', { ...p.stars, [idx]: stars });
  if (clean && !p.clean[idx]) E.save.set('clean', { ...p.clean, [idx]: true });
  if (clean && stars > (p.cs[idx] || 0)) E.save.set('cs', { ...p.cs, [idx]: stars }); // best stars of a zero-slip pass (the Serpent and Bone badges)
  if (stars >= 1) E.save.set('unlocked', Math.max(p.unlocked, Math.min(idx + 1, STENCILS.length - 1)));
}

// ---------- Scenes ----------

const menu = {
  enter(E) { this.btnPlay = null; this.btnMute = null; this.btnMissions = null; this.btnDaily = null; this.tiles = []; this.popIdx = menuPopIdx; this.popT = E.time; menuPopIdx = -1; this.daily = dailyToday(E); applySkins(E); },
  // The vertical layout comes from the height there is: the title shrinks first (to titleWant), then the tiles (to tileMin), then the title again (to titleMin). The
  // title also drops below the engine's TUNE tab when its letters would run under it. `out` is filled with the y positions (nothing is allocated per frame).
  layout(E, rows, out) {
    const M = A.menu, cx = E.w / 2, top = E.safe.top, availBottom = E.h - E.safe.bottom, gap = T.gridGap, tabX = E.w - M.tab.w - E.safe.right, tabBottom = top + M.tab.y + M.tab.h;
    const rest = (ts, th) => {
      const y0 = Math.max(top + M.topPad, cx + A.title.glyphHalf * ts + 8 > tabX ? tabBottom + 4 - A.title.glyphTop * ts : 0);
      const rowY = y0 + A.title.h * ts + M.rowH / 2, tilesTop = rowY + M.rowH / 2 + M.gapTag, tilesBottom = tilesTop + rows * th + (rows - 1) * gap;
      const dailyY = tilesBottom + M.gapDaily + M.dailyH / 2, playY = dailyY + M.dailyH / 2 + M.gapPlay + M.playH / 2;
      return { y0, rowY, tilesTop, dailyY, playY, bottom: playY + M.playH / 2 + M.botPad, ts, th };
    };
    let ts = 1, r = rest(1, 0);
    while ((availBottom - r.bottom) / rows < M.tileWant && ts > M.titleMin) { ts = Math.max(M.titleMin, ts - 0.05); r = rest(ts, 0); }
    const th = clamp((availBottom - r.bottom) / rows, M.tileMin, M.tileMax), f = rest(ts, th), slack = Math.max(0, availBottom - f.bottom) * M.slackTop;
    out.ts = ts; out.th = th; out.y0 = f.y0 + slack; out.rowY = f.rowY + slack; out.tilesTop = f.tilesTop + slack; out.dailyY = f.dailyY + slack; out.playY = f.playY + slack;
    return out;
  },
  render(ctx, E) {
    const cx = E.w / 2, p = progress(E), gap = T.gridGap, cols = T.gridCols, M = A.menu, L = A.line, rows = Math.ceil(STENCILS.length / cols);
    if (!AC.tilt) { const r = makeRng(A.field.seed + 7); AC.tilt = STENCILS.map(() => (r() * 2 - 1) * M.tilt); }
    ctx.drawImage(boardLayer(E), 0, 0, E.w, E.h);

    const Y = this.layout(E, rows, this.pos || (this.pos = {})), m = M.margin, tw = (E.w - 2 * m - (cols - 1) * gap) / cols, th = Y.th;
    ctx.drawImage(titleLayer(E), cx - (A.title.w * Y.ts) / 2, Y.y0, A.title.w * Y.ts, A.title.h * Y.ts);
    drawPen(ctx, m + (cx - A.title.glyphHalf * Y.ts - m) / 2 - 2, Y.y0 + A.title.h * Y.ts * 0.42, clamp((cx - A.title.glyphHalf * Y.ts - m - 8) / 60, 0.3, A.skins.swatch.pen));
    const str = `${p.total} / ${STENCILS.length * T.starPercents.length}`;
    drawStar(ctx, m + 11, Y.rowY - 1, 10, true);
    label(ctx, str, m + 26, Y.rowY, FONT.mid, P.textDark, 'left');
    this.btnMissions = inkButton(ctx, 'Missions', E.w - m - M.missionsW / 2, Y.rowY, M.missionsW, M.rowH, false, FONT.small);

    this.tiles = [];
    STENCILS.forEach((st, i) => {
      const x = m + (i % cols) * (tw + gap), y = Y.tilesTop + Math.floor(i / cols) * (th + gap);
      const locked = i > p.unlocked, stars = p.stars[i] || 0, hw = tw / 2, hh = th / 2;
      const k = i === this.popIdx ? pop(E.time - this.popT - J.menuPopDelay, J.menuPopSec, J.menuPopFrom) : 1;
      ctx.save();
      ctx.translate(x + hw, y + hh); ctx.rotate(AC.tilt[i]);
      if (k !== 1) ctx.scale(k, k);
      ctx.globalAlpha = L.shadowAlpha; ctx.fillStyle = P.shadow; ctx.beginPath(); rr(ctx, -hw + L.shadowDx, -hh + L.shadowDy, tw, th, M.cardR); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = locked ? P.paperShade : P.paper; ctx.beginPath(); rr(ctx, -hw, -hh, tw, th, M.cardR); ctx.fill();
      ctx.strokeStyle = stars ? P.ink : P.paperEdge; ctx.lineWidth = stars ? 1.6 : 1; ctx.stroke();
      label(ctx, NUM[i + 1], -hw + 5, -hh + 15, FONT.small, locked ? P.lock : P.textDark, 'left');
      // Bottom up: the stars, then the BOSS badge (boss cards, locked or not), then the preview above them; the Clean sticker sits over the preview's corner.
      const starY = hh - 10, badgeH = st.boss ? M.badgeH + 3 : 0, areaTop = -hh + M.numH, areaBot = hh - 20 - badgeH, areaH = areaBot - areaTop;
      const bb = bboxOf(i), fit = Math.min((tw - 14) / bb.w, areaH / bb.h);
      ctx.save();
      ctx.translate(0, areaTop + areaH / 2); ctx.scale(fit, fit); ctx.translate(-bb.cx, -bb.cy);
      const mp = miniPath(i);
      if (locked) { ctx.globalAlpha = 0.3; ctx.fillStyle = P.paperEdge; ctx.fill(mp, 'evenodd'); }
      else if (stars) { ctx.fillStyle = P.ink; ctx.fill(mp, 'evenodd'); }
      else { ctx.strokeStyle = P.stencilDeep; ctx.lineWidth = 1.7 / fit; ctx.lineJoin = 'round'; ctx.stroke(mp); }
      ctx.restore();
      if (locked) drawLock(ctx, 0, areaTop + areaH / 2 - 2);
      if (st.boss) {
        ctx.fillStyle = locked ? P.lock : P.ink; ctx.beginPath(); rr(ctx, -M.badgeW / 2, areaBot + 1, M.badgeW, M.badgeH, 4); ctx.fill();
        label(ctx, 'BOSS', 0, areaBot + 1 + M.badgeH / 2 + 1, FONT.small, P.cream);
      }
      if (!locked) {
        const step = (tw - 10) / T.starPercents.length;
        for (let j = 0; j < T.starPercents.length; j++) drawStar(ctx, -hw + 5 + step * (j + 0.5), starY, step * 0.46, j < stars);
        if (p.clean[i]) {
          ctx.save(); ctx.translate(0, areaBot - 12); ctx.rotate(-0.12);
          ctx.fillStyle = P.paper; ctx.beginPath(); rr(ctx, -M.cleanW / 2, -M.badgeH / 2, M.cleanW, M.badgeH, 4); ctx.fill();
          ctx.strokeStyle = P.stamp; ctx.lineWidth = 1.5; ctx.stroke();
          label(ctx, 'CLEAN', 0, 1, FONT.small, P.stamp);
          ctx.restore();
        }
      }
      drawPin(ctx, 0, -hh + 6, M.pinR);
      ctx.restore();
      this.tiles.push({ x, y, w: tw, h: th, idx: i, locked });
    });

    warmStep(E, p.unlocked);
    this.btnDaily = this.drawDaily(ctx, E, Y.dailyY, m);
    const pw = E.w - 2 * m - M.soundW - 10, px = Math.min(pw, 224);
    this.btnPlay = inkButton(ctx, p.unlocked > 0 ? `Play ${p.unlocked + 1}` : 'Play', cx - (M.soundW + 10) / 2, Y.playY, px, M.playH, true, FONT.big);
    this.btnMute = soundButton(ctx, cx - (M.soundW + 10) / 2 + px / 2 + 10 + M.soundW / 2, Y.playY, M.soundW, M.playH, E.audio.muted);
    warmStep(E, p.unlocked);
  },
  // The daily strip: today's stencil (turned as the day says), its tight timer, and the score so far.
  drawDaily(ctx, E, cy, m) {
    const M = A.menu, L = A.line, rec = this.daily, st = stOf(DAILY_IDX), w = E.w - 2 * m, h = M.dailyH, x = m, y = cy - h / 2;
    ctx.globalAlpha = L.shadowAlpha; ctx.fillStyle = P.shadow; ctx.beginPath(); rr(ctx, x + L.shadowDx, y + L.shadowDy, w, h, M.cardR); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = P.paper; ctx.beginPath(); rr(ctx, x, y, w, h, M.cardR); ctx.fill();
    ctx.strokeStyle = P.ink; ctx.lineWidth = 1.6; ctx.stroke();
    const bb = bboxOf(DAILY_IDX), box = h - 14, fit = Math.min(box / bb.w, box / bb.h);
    ctx.save(); ctx.translate(x + 12 + box / 2, cy); ctx.scale(fit, fit); ctx.translate(-bb.cx, -bb.cy);
    ctx.fillStyle = rec.first >= 0 ? P.ink : P.paperEdge; ctx.fill(miniPath(DAILY_IDX), 'evenodd');
    ctx.restore();
    const tx = x + 12 + box + 12;
    label(ctx, `DAILY  ${st.name.toUpperCase()}`, tx, cy - 11, FONT.small, P.textDark, 'left');
    label(ctx, rec.first < 0 ? `${st.variant}  ${st.timer} s` : `${st.variant}  ${rec.first}%${rec.best > rec.first ? `  best ${rec.best}%` : ''}`, tx, cy + 10, FONT.small, P.textMute, 'left');
    drawPin(ctx, x + w - M.cardR - 12, y + 9, M.pinR);
    return { x, y, w, h };
  },
  onTap(p, E) {
    if (E.hit(this.btnPlay, p)) { E.audio.play('tap'); E.setScene('play', { stencil: progress(E).unlocked }); return; }
    if (E.hit(this.btnMute, p)) { E.audio.toggleMute(); E.audio.play('tap'); return; }
    if (E.hit(this.btnMissions, p)) { E.audio.play('tap'); E.setScene('missions'); return; }
    if (E.hit(this.btnDaily, p)) { E.audio.play('tap'); E.setScene('play', { daily: true }); return; }
    const t = this.tiles.find((t) => !t.locked && E.hit(t, p));
    if (t) { E.audio.play('tap'); E.setScene('play', { stencil: t.idx }); }
  },
};

// The chosen machine drawn small and static, tip down-left, centred on (cx, cy): the menu's pen and the machine swatches.
function drawPen(ctx, cx, cy, k, angle = Math.PI + 0.7, sk = SK.m) {
  const M = A.machine, g = machineGfx(ctx, sk);
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle); ctx.scale(k, k); ctx.translate(0, -M.tailEnd / 2);
  drawMachineBody(ctx, g, sk, 1);
  ctx.strokeStyle = P.steel; ctx.lineWidth = M.needleW * 1.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, M.needleLen); ctx.lineTo(0, 0.5); ctx.stroke();
  ctx.restore();
}

// The sound toggle: a speaker on a paper button, struck through when muted.
function soundButton(ctx, cx, cy, w, h, muted) {
  const x = cx - w / 2, y = cy - h / 2, L = A.line;
  ctx.globalAlpha = L.shadowAlpha; ctx.fillStyle = P.shadow; ctx.beginPath(); rr(ctx, x + L.shadowDx, y + L.shadowDy, w, h, L.radius); ctx.fill(); ctx.globalAlpha = 1;
  ctx.beginPath(); rr(ctx, x, y, w, h, L.radius); ctx.fillStyle = P.paperShade; ctx.fill();
  ctx.lineWidth = L.weight; ctx.strokeStyle = P.ink; ctx.beginPath(); rr(ctx, x + 4, y + 4, w - 8, h - 8, L.radius - 4); ctx.globalAlpha = 0.55; ctx.stroke(); ctx.globalAlpha = 1;
  ctx.fillStyle = P.textDark; ctx.strokeStyle = P.textDark; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(cx - 12, cy - 5); ctx.lineTo(cx - 6, cy - 5); ctx.lineTo(cx + 1, cy - 11); ctx.lineTo(cx + 1, cy + 11); ctx.lineTo(cx - 6, cy + 5); ctx.lineTo(cx - 12, cy + 5); ctx.closePath(); ctx.fill();
  if (muted) { ctx.beginPath(); ctx.moveTo(cx + 6, cy - 6); ctx.lineTo(cx + 16, cy + 6); ctx.moveTo(cx + 16, cy - 6); ctx.lineTo(cx + 6, cy + 6); ctx.stroke(); }
  else { ctx.beginPath(); ctx.arc(cx + 1, cy, 8, -0.9, 0.9); ctx.stroke(); ctx.beginPath(); ctx.arc(cx + 1, cy, 14, -0.9, 0.9); ctx.stroke(); }
  return { x, y, w, h };
}

// A badge medal: a disc in the tier's colour with a star, or a dull disc with a lock while unearned.
function drawMedal(ctx, cx, cy, r, tier, earned) {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fillStyle = earned ? P.medal[tier] : P.paperShade; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = earned ? P.ink : P.paperEdge; ctx.stroke();
  if (earned) { starPath(ctx, cx, cy + 0.5, r * 0.62); ctx.fillStyle = P.ink; ctx.fill(); }
  else drawLock(ctx, cx, cy - 1, r / 18);
}

// The missions screen: the badges by tier, earned ones in colour and the rest with how far along they are. The list scrolls by dragging; Back is fixed at the bottom.
const missions = {
  enter(E) { this.scroll = 0; this.drag = null; this.btnBack = null; this.moved = 0; this.swatches = []; applySkins(E); },
  skinsH() { const M = A.missions, W = A.skins.swatch; return M.headH + 2 * (W.headH + W.size + W.rowGap) + 6; },
  content(E) { const M = A.missions; return this.skinsH() + BADGE_TIERS.length * M.headH + BADGES.length * (M.rowH + M.rowGap); },
  view(E) { const M = A.missions, top = E.safe.top + M.top, bot = E.h - E.safe.bottom - M.bottom; return { top, bot, max: Math.max(0, this.content(E) - (bot - top)) }; },
  render(ctx, E) {
    const M = A.missions, p = progress(E), V = this.view(E), m = A.menu.margin, w = E.w - 2 * m, L = A.line;
    ctx.drawImage(boardLayer(E), 0, 0, E.w, E.h);
    label(ctx, 'Missions', E.w / 2, E.safe.top + 30, FONT.big, P.textDark);
    const earned = BADGES.filter((b) => p.badges[b.id]).length;
    label(ctx, `${earned} / ${BADGES.length}`, E.w - m, E.safe.top + 30, FONT.mid, P.textMute, 'right');
    this.scroll = clamp(this.scroll, 0, V.max);
    ctx.save(); ctx.beginPath(); ctx.rect(0, V.top, E.w, V.bot - V.top); ctx.clip();
    let y = V.top - this.scroll;
    y = this.drawSkins(ctx, E, p, y, V, m, w);
    BADGE_TIERS.forEach((tn, tier) => {
      const inTier = BADGES.filter((b) => b.tier === tier);
      ctx.fillStyle = P.medal[tier]; ctx.beginPath(); ctx.arc(m + 6, y + M.headH / 2 + 2, 6, 0, TAU); ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5; ctx.stroke();
      label(ctx, `${tn.toUpperCase()}  ${inTier.filter((b) => p.badges[b.id]).length}/${inTier.length}`, m + 20, y + M.headH / 2 + 2, FONT.small, P.textDark, 'left');
      y += M.headH;
      for (const b of inTier) {
        const got = !!p.badges[b.id], g = got ? null : badgeProgress(b, p), h = M.rowH;
        if (y + h > V.top && y < V.bot) {
          ctx.globalAlpha = L.shadowAlpha; ctx.fillStyle = P.shadow; ctx.beginPath(); rr(ctx, m + L.shadowDx, y + L.shadowDy, w, h, A.menu.cardR); ctx.fill(); ctx.globalAlpha = 1;
          ctx.fillStyle = got ? P.paper : P.paperShade; ctx.beginPath(); rr(ctx, m, y, w, h, A.menu.cardR); ctx.fill();
          ctx.strokeStyle = got ? P.ink : P.paperEdge; ctx.lineWidth = got ? 1.6 : 1; ctx.stroke();
          drawMedal(ctx, m + 14 + M.medalR, y + h / 2, M.medalR, tier, got);
          const tx = m + 14 + 2 * M.medalR + 12;
          label(ctx, b.name, tx, y + 20, FONT.mid, got ? P.textDark : P.textMute, 'left');
          label(ctx, b.text, tx, y + 43, FONT.small, P.textMute, 'left');
          if (g && g.need > 1) label(ctx, `${g.have}/${g.need}`, m + w - 12, y + 20, FONT.small, P.textMute, 'right');
        }
        y += h + M.rowGap;
      }
    });
    ctx.restore();
    if (V.max > 0) { // a thin scroll bar
      const tr = V.bot - V.top, bh = Math.max(24, tr * tr / (tr + V.max));
      ctx.globalAlpha = 0.45; ctx.fillStyle = P.ink; ctx.beginPath(); rr(ctx, E.w - 6, V.top + (tr - bh) * (this.scroll / V.max), M.scrollBar, bh, 1.5); ctx.fill(); ctx.globalAlpha = 1;
    }
    this.btnBack = inkButton(ctx, 'Back', E.w / 2, E.h - E.safe.bottom - 16 - M.backH / 2, M.backW, M.backH, true, FONT.big);
  },
  // The Skins block: a row of machine swatches and a row of ink swatches. An owned swatch picks it (ringed when chosen); a locked one shows the badge that earns it.
  drawSkins(ctx, E, p, y, V, m, w) {
    const W = A.skins.swatch, M = A.missions, L = A.line, sv = { machine: SK.m.id, ink: SK.i.id };
    this.swatches.length = 0;
    label(ctx, 'SKINS', m + 20, y + M.headH / 2 + 2, FONT.small, P.textDark, 'left');
    ctx.fillStyle = P.medal[2]; ctx.beginPath(); ctx.arc(m + 6, y + M.headH / 2 + 2, 6, 0, TAU); ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5; ctx.stroke();
    y += M.headH;
    for (const kind of ['machine', 'ink']) {
      const list = kind === 'machine' ? SKINS.machines : SKINS.inks, gap = Math.min(20, (w - list.length * W.size) / (list.length - 1));
      label(ctx, kind === 'machine' ? 'MACHINE' : 'INK', m, y + W.headH / 2, FONT.small, P.textMute, 'left');
      label(ctx, (kind === 'machine' ? SK.m : SK.i).name, m + w, y + W.headH / 2, FONT.small, P.textDark, 'right');
      y += W.headH;
      list.forEach((sk, i) => {
        const x = m + i * (W.size + gap), owned = skinOwned(sk, p.badges), on = sv[kind] === sk.id;
        ctx.globalAlpha = L.shadowAlpha; ctx.fillStyle = P.shadow; ctx.beginPath(); rr(ctx, x + L.shadowDx, y + L.shadowDy, W.size, W.size, A.menu.cardR + 3); ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = owned ? P.paper : P.paperShade; ctx.beginPath(); rr(ctx, x, y, W.size, W.size, A.menu.cardR + 3); ctx.fill();
        ctx.strokeStyle = owned ? P.ink : P.paperEdge; ctx.lineWidth = owned ? 1.6 : 1; ctx.stroke();
        if (on) { ctx.strokeStyle = P.stamp; ctx.lineWidth = W.ring; ctx.beginPath(); rr(ctx, x - 3, y - 3, W.size + 6, W.size + 6, A.menu.cardR + 6); ctx.stroke(); }
        const cx = x + W.size / 2, cy = y + W.size / 2;
        if (kind === 'machine') { ctx.globalAlpha = owned ? 1 : 0.35; drawPen(ctx, cx, cy, 0.34, Math.PI, sk); ctx.globalAlpha = 1; }
        else {
          ctx.globalAlpha = owned ? 1 : 0.35;
          ctx.fillStyle = sk.ink; ctx.beginPath(); ctx.arc(cx, cy, 17, 0, TAU); ctx.fill();
          ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 17, 0, TAU); ctx.clip();
          ctx.strokeStyle = sk.sheen; ctx.globalAlpha *= 0.8; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(cx - 20, cy + 6); ctx.lineTo(cx + 6, cy - 20); ctx.stroke(); ctx.restore();
          ctx.globalAlpha = 1;
        }
        if (!owned) drawLock(ctx, cx, cy - 2, 0.9);
        if (y + W.size > V.top && y < V.bot) this.swatches.push({ x, y, w: W.size, h: W.size, sk, kind, owned });
      });
      y += W.size + W.rowGap;
    }
    return y + 6;
  },
  onPointerDown(p) { this.drag = { y: p.y, scroll: this.scroll }; this.moved = 0; },
  onPointerMove(p, E) { if (this.drag) { this.scroll = clamp(this.drag.scroll - (p.y - this.drag.y), 0, this.view(E).max); this.moved = Math.max(this.moved, Math.abs(p.y - this.drag.y)); } },
  onPointerUp() { this.drag = null; },
  onTap(p, E) {
    if (E.hit(this.btnBack, p)) { E.audio.play('tap'); E.setScene('menu'); return; }
    const V = this.view(E), sw = p.y >= V.top && p.y <= V.bot && this.swatches.find((s) => E.hit(s, p));
    if (!sw) return;
    if (!sw.owned) { E.toast(`${sw.sk.name} ${sw.kind === 'machine' ? 'machine' : 'ink'}: earn the ${BADGES.find((b) => b.id === sw.sk.badge).name} badge`); return; }
    E.save.set('skin', { ...E.save.get('skin', {}), [sw.kind]: sw.sk.id });
    applySkins(E); E.audio.play('tap');
  },
};

// The HUD: the percentage is the hero, big and centred, with a dark outline so it holds on skin; the timer and the slips sit on small dark plates either side.
function drawHud(ctx, E) {
  const top = E.safe.top + T.hudTop, cx = E.w / 2, now = E.time, f = S.fx, H = A.hud, ty = top + 30, o = A.type.outline;
  // Percentage: pops on each whole-percent step from the first star threshold up, harder on a threshold, and glows star colour after one.
  const pk = pop(now - f.pctT, f.pctFrom === J.pctThresholdFrom ? J.pctThresholdSec : J.pctStepSec, f.pctFrom), pstr = PCT[percent()];
  plabel(ctx, pstr, cx, ty, pk, FONT.hero, P.cream, 'center', A.type.hero * o);
  const glowA = 1 - (now - f.pctStarT) / J.pctStarSec;
  if (glowA > 0 && glowA <= 1) { ctx.globalAlpha = glowA; plabel(ctx, pstr, cx, ty, pk, FONT.hero, P.gold, 'center', 0); ctx.globalAlpha = 1; }
  // Timer: pulses each second in the last few; amber in the last five.
  const px = 16, ph = H.plateH;
  plate(ctx, px, ty - ph / 2, H.timerW, ph);
  const tk = S.started && !S.ended && S.time <= J.timerPulseSecs ? pop(now - f.secT, J.timerPulseSec, J.timerPulseFrom) : 1;
  plabel(ctx, NUM[Math.ceil(S.time)], px + H.timerW / 2, ty + 1, tk, FONT.big, S.time <= 5 && S.started ? P.amber : P.cream, 'center', 0);
  // Slips: three pips, a ring until it is used and a red cross after; the newest one pops.
  const pw = T.maxSlips * H.pipGap + 18, sx = E.w - 16 - pw;
  plate(ctx, sx, ty - ph / 2, pw, ph);
  const sk = pop(now - f.slipPopT, J.slipPopSec, J.slipPopFrom), r = H.pipR;
  ctx.lineCap = 'round';
  for (let i = 0; i < T.maxSlips; i++) {
    const x = sx + 9 + H.pipGap * (i + 0.5);
    ctx.save(); ctx.translate(x, ty);
    if (i < S.slips) {
      if (i === S.slips - 1) ctx.scale(sk, sk);
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass ? P.slip : P.slipShadow; ctx.lineWidth = pass ? H.pipW : H.pipW + 2.4;
        ctx.beginPath(); ctx.moveTo(-r, -r); ctx.lineTo(r, r); ctx.moveTo(r, -r); ctx.lineTo(-r, r); ctx.stroke();
      }
    } else { ctx.globalAlpha = 0.55; ctx.strokeStyle = P.cream; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }
}

const play = {
  enter(E, { stencil = 0, daily = false } = {}) { applySkins(E); newAttempt(daily ? DAILY_IDX : clamp(stencil, 0, STENCILS.length - 1), daily); },
  update(dt, E) {
    holdStep(E, dt);
    hintStep(dt);
    fxUpdate(dt, E);
    if (S.ended) {
      S.holdT -= dt;
      if (S.holdT <= 0) this.toCard(E);
      return;
    }
    if (!S.started) return;
    S.time -= dt;
    if (S.time <= 0) { S.time = 0; finish(E, 'time'); }
  },
  toCard(E) {
    const pct = percent(), ruined = S.ended === 'ruined';
    const stars = ruined ? 0 : starsFor(pct);
    const failed = ruined || pct < T.passPercent;
    const clean = !failed && S.slips === 0;
    if (S.daily) { // the daily counts for the daily only: no stars, unlocks or badges
      const rec = recordDaily(E, S.dailyKey, pct);
      E.setScene('over', { idx: S.idx, pct, stars, failed, clean, best: rec ? rec.best : pct, boss: S.st.boss, daily: true, last: false, starsUp: false, newBadges: [] });
      return;
    }
    const starsUp = stars > (progress(E).stars[S.idx] || 0), had = E.save.get('badges', {});
    recordResult(E, S.idx, { pct, stars, ruined, clean });
    const now = earnedBadges(progress(E)), fresh = BADGES.filter((b) => now[b.id] && !had[b.id]);
    if (fresh.length) E.save.set('badges', { ...had, ...now });
    E.setScene('over', { idx: S.idx, pct, stars, failed, clean, best: progress(E).best[S.idx] || 0, boss: S.st.boss, last: S.idx === STENCILS.length - 1, starsUp, newBadges: fresh });
  },
  onPointerDown(p, E) {
    if (S.ended) return;
    if (S.pid !== null) { if (E.pointers.has(S.pid)) return; liftFinger(); } // a lost up or cancel must not lock out inking
    S.pid = p.id; S.started = true; S.finger = { x: p.x, y: p.y };
    E.audio.play('tap');
    S.fx.downT = E.time;
    const n = needleFromPointer(p, E);
    moveNeedle(E, n.x, n.y, eventTime(p));
  },
  onPointerMove(p, E) {
    if (p.id !== S.pid || S.ended) return;
    S.finger = { x: p.x, y: p.y };
    const n = needleFromPointer(p, E);
    S.fx.laid = false;
    moveNeedle(E, n.x, n.y, eventTime(p));
    sprayTip(E, p);
  },
  onPointerUp(p, E) { if (p.id === S.pid) liftFinger(); },
  render(ctx, E) {
    const v = view(E);
    drawPiece(ctx, E, v, -1);
    if (S.ended) prepareCard(E);
    drawMachine(ctx, E);
    drawHud(ctx, E);
  },
};

// The card. Timeline (seconds from enter): the piece eases into a large showcase position and the paper card slides up; stars pop in one by one with a coin each;
// then "Clean" is stamped; the buttons appear only after the beat and only then take taps, so a tap during the animation is never swallowed by a button.
const CV = { s: 1, ox: 0, oy: 0 }, LV = { s: 1, ox: 0, oy: 0 }; // the card's piece view, and the view eased between the play view and it
const cardBoxFor = (E, b) => {
  const C = A.card;
  b.w = Math.min(C.w, E.w - 2 * C.pad); b.h = C.h; b.x = E.w / 2 - b.w / 2; b.y = E.h - E.safe.bottom - C.h - C.pad;
  return b;
};
// Where the finished piece sits on the card: as large as fits above the paper card, never larger than it was in play.
const CB = { x: 0, y: 0, w: 0, h: 0 };
function cardViewFor(E, out) {
  const C = A.card, b = cardBoxFor(E, CB), bb = bboxOf(S.idx), top = E.safe.top + C.topPad, bot = b.y - C.pieceGap;
  out.s = clamp(Math.min((E.w - 2 * C.sidePad) / Math.max(bb.w, STORY_W[S.st.story] || 0), (bot - top) / bb.h), C.minScale, C.maxScale * view(E).s);
  out.ox = E.w / 2 - bb.cx * out.s; out.oy = (top + bot) / 2 - bb.cy * out.s;
  return out;
}
// While the finished piece holds on screen, build what the card will need, one thing per frame, so opening the card costs nothing.
function prepareCard(E) {
  if (S.prep >= 2) return;
  if (S.prep === 0) { if (S.ended !== 'ruined') blushLayer(S.idx); } else fieldComp(E, cardViewFor(E, CV), 1);
  S.prep++;
}
const over = {
  enter(E, params) {
    this.p = params;
    this.btnMain = null; this.btnMenu = null;
    this.t = 0; this.coins = 0; this.box = { x: 0, y: 0, w: 0, h: 0 };
    this.head = params.daily ? `DAILY   ${S.st.name.toUpperCase()}` : `${params.boss ? 'BOSS   ' : ''}No. ${params.idx + 1}   ${S.st.name.toUpperCase()}`;
    this.badgeAt = this.starsEndFor(params.stars) + A.badge.delay; this.badgeDone = false;
    this.bestStr = `Best ${params.best}%`;
    const n = params.stars;
    this.starsEnd = J.starDelay + Math.max(0, n - 1) * J.starStagger + J.starSec;
    this.buttonsAt = Math.max(J.cardSlideSec, n ? this.starsEnd : 0) + J.buttonGap; // about 0.75 s with five stars
    this.sweepAt = params.clean ? this.starsEnd + J.cleanDelay : Infinity;
  },
  starsEndFor(n) { return J.starDelay + Math.max(0, n - 1) * J.starStagger + J.starSec; },
  cardBox(E) { return cardBoxFor(E, this.box); },
  cardView(E) { return cardViewFor(E, CV); },
  slideOffset(E) {
    const b = this.cardBox(E), k = ease.outBack(clamp(this.t / J.cardSlideSec, 0, 1));
    return (1 - k) * (E.h * J.cardFrom + b.h);
  },
  update(dt, E) {
    this.t += dt;
    const n = this.p.stars, C = A.card;
    while (this.coins < n && this.t >= J.starDelay + this.coins * J.starStagger) {
      const i = this.coins++, b = this.cardBox(E);
      E.audio.play('coin');
      emit(E, E.w / 2 + (i - 2) * C.starGap, b.y + 134 + this.slideOffset(E), J.starBurst, P.inkGloss, 90, 0.4, 2.6);
    }
    if (!this.badgeDone && this.p.newBadges.length && this.t >= this.badgeAt) { // a badge was earned: a beat of its own
      this.badgeDone = true; E.audio.play('win', 0.6); E.haptic(J.finishHaptic);
      emit(E, E.w / 2, this.cardBox(E).y - 8 - A.badge.h / 2, J.starBurst * 2, P.medal[this.p.newBadges[0].tier], 110, 0.5, 3);
    }
  },
  render(ctx, E) {
    const p = this.p, cx = E.w / 2, t = this.t, b = this.cardBox(E), { w, h, x, y } = b, C = A.card, L = A.line;
    const pv = view(E), cv = this.cardView(E), ek = ease.outCubic(clamp(t / J.cardSlideSec, 0, 1));
    if (ek >= 1) { LV.s = cv.s; LV.ox = cv.ox; LV.oy = cv.oy; }
    else { LV.s = pv.s + (cv.s - pv.s) * ek; LV.ox = pv.ox + (cv.ox - pv.ox) * ek; LV.oy = pv.oy + (cv.oy - pv.oy) * ek; }
    drawPiece(ctx, E, LV, t);
    if (p.clean && t >= this.sweepAt) this.drawSweep(ctx, LV, (t - this.sweepAt) / J.cleanSweepSec);

    ctx.save();
    ctx.translate(0, this.slideOffset(E));
    ctx.globalAlpha = L.shadowAlpha; ctx.fillStyle = P.shadow; ctx.beginPath(); rr(ctx, x + L.shadowDx, y + L.shadowDy + 2, w, h, L.radius + 4); ctx.fill(); ctx.globalAlpha = 1;
    ctx.beginPath(); rr(ctx, x, y, w, h, L.radius + 4); ctx.fillStyle = P.paper; ctx.fill();
    ctx.strokeStyle = P.ink; ctx.lineWidth = L.weight; ctx.beginPath(); rr(ctx, x + 7, y + 7, w - 14, h - 14, L.radius); ctx.globalAlpha = 0.8; ctx.stroke(); ctx.globalAlpha = 1;
    drawPin(ctx, cx, y + 1, 6);
    label(ctx, this.head, x + 20, y + 30, FONT.small, P.textMute, 'left');
    label(ctx, this.bestStr, x + w - 20, y + 30, FONT.small, P.textMute, 'right');
    label(ctx, PCT[p.pct], cx, y + 80, FONT.hero, P.textDark);
    for (let i = 0; i < 5; i++) {
      const sx = cx + (i - 2) * C.starGap;
      if (i >= p.stars) { drawStar(ctx, sx, y + 134, C.starR, false); continue; }
      const k = clamp((t - (J.starDelay + i * J.starStagger)) / J.starSec, 0, 1);
      if (k <= 0) { drawStar(ctx, sx, y + 134, C.starR, false); continue; }
      drawStar(ctx, sx, y + 134, C.starR * ease.outBack(k), true);
    }
    if (p.clean && t >= this.sweepAt) this.drawStamp(ctx, cx, y + 178, pop(t - this.sweepAt, J.cleanPopSec, 0));
    ctx.restore();
    if (this.badgeDone) this.drawBadge(ctx, E, y, t - this.badgeAt);

    this.btnMain = this.btnMenu = null;
    if (t < this.buttonsAt) return;
    // Primary: Again on a fail, Next on a pass, Menu on a pass of the last stencil or of the daily. Secondary: Menu, or Again after a daily pass (replays are allowed).
    const menuIsPrimary = !p.failed && (p.last || p.daily), bk = pop(t - this.buttonsAt, J.buttonPopSec, 0.85);
    ctx.save();
    const zoom = (cy) => { ctx.translate(cx, cy); ctx.scale(bk, bk); ctx.translate(-cx, -cy); };
    ctx.save(); zoom(y + 228);
    this.btnMain = inkButton(ctx, p.failed ? 'Again' : menuIsPrimary ? 'Menu' : 'Next', cx, y + 228, w - 56, 56, true, FONT.big);
    ctx.restore();
    if (!menuIsPrimary || p.daily) { ctx.save(); zoom(y + 286); this.btnMenu = inkButton(ctx, menuIsPrimary ? 'Again' : 'Menu', cx, y + 286, w - 56, 44, false, FONT.mid); ctx.restore(); }
    ctx.restore();
  },
  // The badge ticket over the card: a paper strip with the tier's medal and the badge's name (and how many more were earned).
  drawBadge(ctx, E, panelY, age) {
    const B = A.badge, L = A.line, bg = this.p.newBadges, w = Math.min(B.w, E.w - 2 * A.card.pad), h = B.h, cx = E.w / 2, cy = panelY - 8 - h / 2, k = pop(age, B.popSec, 0.5);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k);
    ctx.globalAlpha = L.shadowAlpha; ctx.fillStyle = P.shadow; ctx.beginPath(); rr(ctx, -w / 2 + L.shadowDx, -h / 2 + L.shadowDy, w, h, 8); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = P.paper; ctx.beginPath(); rr(ctx, -w / 2, -h / 2, w, h, 8); ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = L.weight; ctx.stroke();
    drawMedal(ctx, -w / 2 + 8 + B.medalR + 2, 0, B.medalR, bg[0].tier, true);
    label(ctx, `BADGE  ${bg[0].name}`, -w / 2 + 44, 1, FONT.small, P.textDark, 'left');
    if (bg.length > 1) label(ctx, `+${bg.length - 1}`, w / 2 - 12, 1, FONT.small, P.textMute, 'right');
    ctx.restore();
  },
  // Clean flourish, part one: a rubber stamp in ink blue, tilted, double ruled, that lands with a pop.
  drawStamp(ctx, cx, cy, k) {
    const C = A.card, sw = C.stampW, sh = C.stampH;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(C.stampTilt); ctx.scale(k, k);
    ctx.strokeStyle = P.stamp; ctx.lineJoin = 'round';
    ctx.lineWidth = 2.6; ctx.beginPath(); rr(ctx, -sw / 2, -sh / 2, sw, sh, 6); ctx.stroke();
    ctx.lineWidth = 1; ctx.beginPath(); rr(ctx, -sw / 2 + 4, -sh / 2 + 4, sw - 8, sh - 8, 3); ctx.stroke();
    label(ctx, 'CLEAN', 0, 1, FONT.mid, P.stamp);
    ctx.restore();
  },
  // Clean flourish, part two: a soft blue band sweeps across the piece, clipped to the stencil shape.
  drawSweep(ctx, v, k) {
    if (k >= 1) return;
    ctx.save();
    ctx.translate(v.ox, v.oy); ctx.scale(v.s, v.s);
    shapePath(ctx, S.st.shape); ctx.clip('evenodd');
    ctx.translate(T.designW / 2, T.designH / 2); ctx.rotate(-0.5);
    ctx.translate(-480 + 960 * ease.inOut(k), 0);
    ctx.fillStyle = P.stencil;
    const a = J.cleanSweepAlpha * Math.sin(Math.PI * k);
    ctx.globalAlpha = a * 0.35; ctx.fillRect(-60, -700, 120, 1400);
    ctx.globalAlpha = a * 0.5; ctx.fillRect(-32, -700, 64, 1400);
    ctx.globalAlpha = a; ctx.fillRect(-12, -700, 24, 1400);
    ctx.restore();
  },
  onTap(p, E) {
    if (this.t < this.buttonsAt || !this.btnMain) return;
    if (E.hit(this.btnMain, p)) {
      E.audio.play('tap');
      const q = this.p;
      if (q.failed) E.setScene('play', q.daily ? { daily: true } : { stencil: q.idx });
      else if (q.last || q.daily) { menuPopIdx = q.starsUp ? q.idx : -1; E.setScene('menu'); }
      else E.setScene('play', { stencil: q.idx + 1 });
    } else if (this.btnMenu && E.hit(this.btnMenu, p)) {
      E.audio.play('tap');
      const q = this.p;
      if (q.daily && !q.failed) { E.setScene('play', { daily: true }); return; }
      menuPopIdx = q.starsUp ? q.idx : -1; E.setScene('menu');
    }
  },
};

export const game = {
  slug: 'ink',
  title: 'Ink',
  saveVersion: 7,
  // v1 saved only best percentages: derive stars and the unlock from them. v3 kept bests per needle mode; v4 has one needle, so the dynamic bests become the bests
  // and every earlier best (all made with the classic needle) is dropped. Stars, clean and unlocks are kept.
  migrate(data, fromVersion) {
    if (fromVersion < 2) {
      const best = data.best || {}, stars = {};
      let unlocked = 0;
      for (const id of Object.keys(best)) {
        const n = starsFor(best[id]);
        if (n) { stars[id] = n; unlocked = Math.max(unlocked, Number(id) + 1); }
      }
      data.stars = stars; data.clean = {}; data.unlocked = Math.min(unlocked, STENCILS.length - 1);
    }
    if (fromVersion < 4) { data.best = (fromVersion >= 3 && data.bests && data.bests.dynamic) || {}; delete data.bests; delete data.needleMode; }
    // The tune panel now holds only the hint; drop saved needle and juice experiment values so they cannot override the new defaults.
    if (fromVersion < 4 && data.__tune) data.__tune = Object.fromEntries(Object.entries(data.__tune).filter(([k]) => k.startsWith('hint')));
    if (fromVersion < 5) {
      // Saves are keyed by stencil index and the stencils were reordered (PRD v0.5 section A). The ten-stencil layout of v0.4 and the interim fifteen-stencil layout that
      // shipped as cache v11 (also saveVersion 4) each map to the final order; a save with any key or unlock at 10 or above can only be the interim layout.
      const keys = ['best', 'stars', 'clean'], u = Number(data.unlocked) || 0;
      const interim = u >= 10 || keys.some((k) => Object.keys(data[k] || {}).some((id) => Number(id) >= 10));
      const map = interim ? REMAP_INTERIM : REMAP_TEN;
      for (const k of keys) {
        const out = {};
        for (const id of Object.keys(data[k] || {})) if (map[id] !== undefined) out[map[id]] = data[k][id];
        data[k] = out;
      }
      data.unlocked = clamp(Math.max(0, ...map.slice(0, Math.min(u, map.length - 1) + 1)), 0, STENCILS.length - 1);
    }
    if (fromVersion < 6) {
      // v6 adds cs (best stars of a clean pass), badges and the daily results. A save cannot say whether a clean pass and a five-star pass were the same attempt, so cs takes
      // the stars of any stencil that has a clean pass; badges are earned from what the save already shows, so nothing is lost or asked for again.
      data.cs = {};
      for (const id of Object.keys(data.clean || {})) if (data.clean[id]) data.cs[id] = (data.stars || {})[id] || 0;
      data.daily = {};
      data.badges = earnedBadges({ stars: data.stars || {}, clean: data.clean || {}, cs: data.cs });
    }
    if (fromVersion < 7) data.skin = { machine: 'steel', ink: 'black' }; // v7: the chosen machine and ink skins
    return data;
  },
  TUNING,
  // TUNE tab: the timer feel (PRD v0.5 section D) and the gap hint. The preset row holds only the timer presets (the panel has room for about four buttons in one row, so the
  // hint's presets became its two sliders: 101 is off). Everything reads TUNING at use time, so it applies live, from the next attempt for timers.
  experiments: [
    { key: 'timerGlobalMult', label: 'Timer multiplier (all stencils)', min: 0.6, max: 2, step: 0.05 },
    { key: 'hintPercent', label: 'Hint starts at (percent, 101 = off)', min: 85, max: 101, step: 1 },
    { key: 'hintShare', label: 'Gap share shown (of what is left)', min: 0.02, max: 0.5, step: 0.01 },
  ],
  presets: [
    { label: 'Relaxed', values: { timerMultEarly: 2.6, timerMultMid: 2.6, timerMultBoss: 2.6, timerMultFinal: 2.6, timerMultSkull: 2.6, timerGlobalMult: 1 } },
    { label: 'Standard', values: { timerMultEarly: 2.2, timerMultMid: 1.9, timerMultBoss: 1.7, timerMultFinal: 1.6, timerMultSkull: 1.35, timerGlobalMult: 1 } },
    { label: 'Tight', values: { timerMultEarly: 1.6, timerMultMid: 1.6, timerMultBoss: 1.6, timerMultFinal: 1.6, timerMultSkull: 1.35, timerGlobalMult: 1 } }, // the skull's standard 1.35 is already tighter than 1.6
  ],
  start: 'menu',
  scenes: { menu, play, over, missions },
  // Read by tools/sim-ink.mjs so the simulator runs the real coverage and slip code.
  sim: { stencils: STENCILS, timerFor, skins: () => ({ machine: SK.m.id, ink: SK.i.id }), percent, slips: () => S.slips, ended: () => S.ended, inked: () => S.inked, grid: () => S.g, radius: () => S.r, hint: () => S.hint, computeHint },
};
