// Ink, layers 1 to 5 and the v0.2 dynamic needle, the v0.3 needle inertia and the v0.4 gap hint: the mechanic, the progression, the juice, a speed-driven ink radius with momentum, a highlight for the gaps that are hard to find, and the art. Hold the tattoo machine, lay ink inside the stencil, never leave the line three times.
// Art (layer 5, PRD v0.1 section 11): tattoo flash. A transfer stencil on skin, ink on a body part, a pen-style machine in the hand, a flash-sheet menu. All of it is procedural Canvas drawing and lives in TUNING.art.
// v0.6: the timer is the biggest thing on the HUD, a slip makes the body flinch, stencils may come in parts with scored landings, and the body parts are flat.
// v0.7: a client for every stencil, the cold open, the reveal on the client's skin, Rita's rank cards and the Portfolio (the story layer, PRD v0.7).
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
  rankAt: [25, 60],      // Total stars that make Artist and Master (PRD v0.7 D); the ladder never changes a rule
  timerMultEarly: 2.2,   // Timer is this times the perfect-path time to 99 percent: Circle, Diamond, Heart, Star (read by tools/sim-ink.mjs)
  timerMultMid: 1.9,     // Same for the stencils between the bosses (Bolt, Halo, Clover, Key)
  timerMultBoss: 1.7,    // Same for the mid boss, Crescent
  timerMultFinal: 1.6,   // Same for the boss Snake
  timerMultSkull: 1.35,  // Same for the final boss, Skull (PRD v0.5 section A)
  timerGlobalMult: 1,    // v0.5 experiment (PRD section D): scales every timer on top of the five multipliers above; the TUNE presets set all six
  dailyTimerMult: 1.4,   // v0.5 daily stencil: its timer is this times the stencil's perfect-path time and the global multiplier (never longer than the stencil's own active timer)
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
  hudTop: 8,             // Screen px from the safe-area top to the HUD
  slipMarkSize: 6,       // Half-length of a slip cross
  landTolerance: 2,      // A touch-down this far outside a part's line still counts as a clean landing (stencils in parts, PRD v0.6 section D)
  blotRadius: 9,         // Radius of the blot mark left by a touch-down on skin outside every line
  fullWidthShare: 0.99,  // Featherweight: the needle counts as at full width once its radius reaches this share of the widest radius (needleR * wideScale)
  partDone: 0.99,        // A part is complete once this share of its cells (rounded down to whole cells) is inked; the rest of it is then inked for you
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
  hintPercent: 95,       // Fill percentage at which the hint turns on. The menu's Hint toggle (saved as `hint`, on by default) sets it to 101 (off) or, from off, back to hintOnPercent; the TUNE slider only moves it while the toggle is on
  hintOnPercent: 95,     // What the Hint toggle sets hintPercent to when it is switched on
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
    slipShake: 2, slipShakeSec: 0.08, slipHaptic: 20, ruinHaptic: 50, slipBurst: 6, // Screen kick on a slip (px, seconds) and the phone's buzz (ms); the third slip buzzes longer
    flinchAmp: 3, flinchSec: 0.25,           // The body flinches: the piece jolts this many design units away from the needle and settles in this long (one flinch per slip, never stacked)
    partFreq: 880, partFreqStep: 110, partDur: 0.09, partGain: 0.06, partBurst: 9, // The chime when a part of a stencil in parts is complete (rising with the part's number) and its burst of specks
    thudFreq: 82, thudSlide: 0.55, thudDur: 0.16, thudGain: 0.3, // The low thud under the slip sound
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
      skin: '#925d3c', skinShade: '#4a2d1d', skinHi: '#ffddb8', // The one flat skin tone, its soft shade and its soft highlight
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
      hairDark: '#2a1d1a', hairGrey: '#c9c6c2', // The drawn stand-in faces of the clients whose portraits have not landed
      medal: ['#b87a3e', '#b7c0ca', '#e6b73f', '#3aa89b'], // Badge tiers: Apprentice bronze, Artist silver, Master gold, Trick teal
    },
    type: { display: "'Arial Black','Impact','Helvetica Neue',system-ui,sans-serif", weight: 900, hero: 66, timer: 44, big: 34, mid: 20, small: 14, outline: 0.17 }, // Type scale (nothing under 14 px), one heavy weight; outline is a fraction of the size
    line: { weight: 2, radius: 12, shadowDx: 2, shadowDy: 3, shadowAlpha: 0.32 }, // Line weight, corner radius and drop shadow used by every plate, card and button
    field: {
      extent: [-300, -380, 660, 1240],  // Design-space rectangle the body layer covers
      bands: 8, bodyScale: 0.9,                   // Body layer pixels per design unit (the shading is soft)
      compMaxDpr: 2, grainMaxDpr: 1.5, tile: 128, grain: 0.15, grainCurve: 1.6, seed: 20260929, // Baked field (drape, body, grain) and grain overlay: max pixels per CSS pixel, noise tile size, peak alpha, curve, seed
      poreDensity: 0.00085, poreR0: 0.5, poreR1: 1.35, poreAlpha0: 0.06, poreAlpha1: 0.2, // Pores per screen px squared, radius range, alpha range
      vignette: 0.6, vigInner: 0.28, vigOuter: 0.72, // Vignette strength, and inner and outer radius as a fraction of the screen diagonal
    },
    body: { rimWidth: 80, rimSteps: 28, rimBatches: 4, rimAlpha: 0.018, edgeWidth: 1.5, edgeAlpha: 0.5, hi: 0.1, shade: 0.24 }, // Soft rim: this many strokes (laid in this many batches, one batch per menu frame) narrowing from this width, each this faint, and one clean edge line; strength of the one highlight and the one shade on every body part
    outline: { amp: 0.8, step: 5, lamA: 20, lamB: 32, lam2A: 8, lam2B: 13, edgeAmp: 1.4, edgeOffset: 1.5, edgeWidth: 1.1, edgeAlpha: 0.55, shadowWidth: 3, shadowAlpha: 0.45, alpha: 0.96 }, // Wobble (design units, sample step, wavelengths), the faint second edge, the dark line under it
    ink: { tile: 96, widthTol: 0.8, sheenAlpha: 0.27, haloPad: 3, haloAlpha: 0.06, blitMargin: 8 }, // Sheen pattern size and strength; bleed: how far past a stroke it reaches (design units) and how faint each stamp of it is; margin around the stencil that is blitted
    story: { delay: 0.35, sec: 0.55, facetFrom: 95, facetWidth: 1.8, facetAlpha: 0.9, glintSize: 11, swirlWidth: 2.6, swirlAlpha: 0.9, bannerText: 'LOVE', bannerTilt: -0.07 }, // Card decorations: reveal timing, the percent the gem facets start showing
    machine: { needleLen: 9, needleW: 1.4, nozzleTopW: 3.2, nozzleW: 9, nozzleEnd: 29, bandLen: 3, neckEnd: 46, neckW: 13, gripEnd: 98, gripW: 25, tailEnd: 128, tailW: 15, cableW: 4.5, cableAlpha: 0.85, shadowDx: 3, shadowDy: 4, shadowAlpha: 0.3, knurl: 5 }, // Pen-style machine, screen px from the needle tip down to the cable
    hud: { plateAlpha: 0.5, plateH: 46, pipGap: 22, pipR: 7, pipW: 3.2, ring: 38, ringW: 4, ringTrack: 0.28, amberAt: 1 / 3, ringHide: 0.002, timerBig: 100 }, // The timer's ring (radius, width, faint track alpha), when it turns amber (share of the time left), the slip plate; a timer of timerBig or more seconds uses the smaller numeral
    menu: { margin: 16, rowsSeen: 3, penHalf: 57, penMin: 0.25, hintSwW: 30, hintSwH: 14, hintSwDy: 8, hintLabelDy: 8, tilt: 0.03, tileWant: 116, tileMin: 100, tileMax: 132, titleMin: 0.55, topPad: 8, rowH: 44, gapTag: 8, gapDaily: 10, dailyH: 52, gapPlay: 10, playH: 52, soundW: 56, missionsW: 124, storyW: 76, rankDy: 8, rankLineH: 14, rankStrip: 22, botPad: 10, warmMs: 3, bootFrames: 5, slackTop: 0.4, numH: 22, badgeW: 46, badgeH: 18, cleanW: 56, pinR: 4.5, cardR: 5, fiberDensity: 0.0032, boardMaxDpr: 1.5, tab: { w: 74, y: 10, h: 32 } }, // Flash-sheet menu: tile heights it wants, its limits and the title's, gaps and button heights (44 px at least), and the engine's TUNE tab it must clear
    missions: { folioH: 56, top: 60, rowH: 60, lineH: 18, rowGap: 8, headH: 30, medalR: 18, bottom: 16, backW: 76, backH: 44, scrollBar: 3 }, // Missions screen: the list scrolls under the heading row, which holds Back (top left, clear of the toast at the bottom)
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
        { id: 'gold', name: 'Gold', badge: 'full-sleeve', ink: '#3a2800', sheen: '#e0aa22', gloss: '#ffe08a', halo: '#3a2800', sheenA: 0.1 },
      ],
      swatch: { size: 52, gap: 12, headH: 24, rowGap: 6, ring: 3, pen: 0.62 }, // The Skins block on the missions screen (swatch size at least 44 px) and the menu pen's scale
    },
    badge: { h: 32, w: 320, popSec: 0.3, delay: 0.25, medalR: 11, max: 3, gap: 4, stagger: 0.12 }, // The badge tickets over the result card: up to max, stacked upward, highest tier first
    title: { size: 92, w: 280, h: 130, glyphHalf: 100, glyphTop: 22, seed: 4242, passes: 18, jitter: 1.7, edge: 2.4, edgePasses: 7, streaks: 90, streakMin: 14, streakMax: 64, shadowDx: 4, shadowDy: 4, swash: 8 }, // Brush-stroke title (the fallback while the generated title loads, and if it fails)
    titleImg: { w: 280, pad: 6, at3x: 2.5, src2: 'assets/title-ink@2x.png', src3: 'assets/title-ink@3x.png' }, // Generated tattoo-script title (ADR-0015): drawn this wide, 2x and 3x bitmaps, pad is blank space around it
    card: { h: 318, landH: 36, ruinedHeroY: 74, ruinedY: 109, w: 340, pad: 14, topPad: 26, pieceGap: 46, sidePad: 34, minScale: 0.3, maxScale: 1, starR: 17, starGap: 44, stampW: 112, stampH: 34, stampTilt: -0.1, blushMargin: 48, blushScale: 0.9, blush: 0.42, blushBlur: 34 }, // Result card
    intro: { sec: 5, fade: 0.5, bottom: 16, pad: 10, lineH: 18, maxW: 340, text: 'Land on the line. Skin is a blot, and three slips ruin the piece.' }, // Split stencils: a plate near the bottom of the screen (clear of the piece) for the first seconds after the piece opens
    callout: { sec: 2.6, fade: 0.5, gap: 8, pad: 8, h: 28, text: 'Blot: landed on skin' }, // The call-out above the first blot of a piece
    blot: { rim: 2, specks: 3, speckAngle: 0.9, speckStep: 2.1, speckDist: 5, speckR: 2.2, core: 0.35 }, // The blot mark (radius is TUNING.blotRadius): dark rim beyond the disc, the specks around it (count, first angle, angle step, distance beyond the disc, size), the dark core as a share of the radius
    cast: { sec: 4, fade: 0.5, top: 8, face: 36, pad: 6, gap: 10, maxW: 340, lineH: 18, clear: 8, bottomGap: 8 }, // The client of the day on the play intro (PRD v0.7 B): a plate under the HUD (at most two lines, so a fixed height) with the client's face and line; it is gone at the first touch. `clear` is the gap kept between the plate and a stencil's tip, `bottomGap` the least left under the piece: on a short screen the piece is moved down (never scaled) to clear the plate
    reveal: { zoomSec: 1.2, tapGuard: 0.2, cueVol: 0.3, cue: { happy: 'coin', neutral: 'tap', sad: 'tap' }, crossFrom: 0.1, crossTo: 0.7, lineFrom: 0.9, lineFade: 0.25, inkAlpha: 0.92, portraitMaxW: 400, minW: 150, top: 12, bottom: 14, frame: 8, gap: 8, trayMaxW: 360, trayPad: 10, sidePad: 20, capH: 18, lineH: 24, statH: 44, metaH: 38, metaLineH: 16, starR: 15, starGap: 34, stampScale: 0.85, btnH: 52, btnPair: 10, btnGap: 10 }, // The client's result card (PRD v0.7 C and C2): the zoom from the skin to the client (seconds), the tap guard, when the skin gives way to the portrait (share of the zoom), when the line shows and how fast it fades in (seconds), the multiply strength of the ink. The portrait stays as large as fits (at most portraitMaxW wide; tickets are dropped before it shrinks below minW) with a paper tray under it (caption, the client's line, percent and stars, best and stamp; sidePad keeps the text clear of its ruled border) and the buttons below that (layout numbers in px)
    open: { anchorFit: 0.9, guard: 0.25, fade: 0.4, skipW: 96, skipH: 44, cardW: 320, pad: 22, art: 128, gap: 14, lineH: 28, face: 60, faceGap: 8 }, // The cold open (PRD v0.7 A): two cards, Skip always top right
    rank: { w: 320, h: 470, pad: 18, portH: 250, btnH: 52, guard: 0.5, gap: 12, nameGap: 10, lineH: 26, btnGap: 14, margin: 24, popSec: 0.35, medalR: 14, medalDx: 78, nameDx: 12, cueVol: 0.6 }, // The rank-up card with Rita (PRD v0.7 D): its layout (px), the pop-in (seconds) and the volume of its one sound
    folio: { cols: 3, gap: 10, pad: 6, starH: 22, headH: 8, lockedAlpha: 0.3, openAlpha: 0.55, inkAlpha: 0.92, outlineAlpha: 0.9, starScale: 0.4, starPad: 5, headY: 30, headGap: 12, countGap: 14, scrollMinH: 24 }, // The Portfolio page (PRD v0.7 E): the heading row (Back, heading, count) keeps `headGap` and `countGap` between its parts
    earlier: { alpha: 0.5, fit: 0.86, folioAlpha: 0.9 }, // PRD v0.8 A: a returning client's earlier finished pieces, drawn small and faded (perfect fills) in the portrait's second patch; `fit` is how much of its cell each piece fills, `folioAlpha` scales them on a Portfolio tile that is not passed yet
    finale: { w: 320, pad: 18, portH: 250, ritaInset: 8, ritaAspect: 2 / 3, beatFadeSec: 0.25, gap: 14, lineH: 28, btnH: 52, btnGap: 16, guard: 0.45, popSec: 0.35, margin: 24, cueVol: 0.5 }, // Rita's two-beat card before the finale (PRD v0.8 D): its layout (px), Rita's inset and aspect (also used by the rank card), the pop-in, beat fade and tap guard (seconds) and the volume of its sound
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
    // Three parts (PRD v0.6 section D): the left wing, the body (head, torso and forked tail) and the right wing, cut apart by two slanted slits 5 units wide, so a piece is at least three landings. Path (docs/games/ink/paths/swallow.json): land on a part, ride its outline 6 inside at 175, then fill it in rows 15 apart at 270, lifting between parts and at the tail fork.
    name: "Swallow", timer: 32, boss: false, tier: "mid", perfect: 16.42, body: "shoulder",
    parts: [[[[105.04,299.95],[102.87,299.2],[100.98,299.02],[99.45,299.29],[98.01,299.83],[96.3,300.28],[94.41,300.82],[92.25,301.27],[89.91,301.9],[87.39,302.53],[84.96,303.25],[82.53,304.15],[80.1,305.14],[77.67,306.31],[75.15,307.57],[72.72,309.01],[70.29,310.54],[67.86,312.16],[65.52,313.87],[63.18,315.67],[60.93,317.65],[58.68,319.72],[56.52,321.88],[54.36,324.13],[52.29,326.47],[50.4,328.9],[48.51,331.51],[46.62,334.21],[44.82,337.09],[43.11,340.06],[41.4,343.21],[39.69,346.36],[37.98,349.6],[36.36,352.84],[34.65,356.17],[32.94,359.5],[31.23,362.83],[29.61,365.98],[27.99,368.95],[26.55,371.56],[25.2,373.9],[24.75,371.29],[24.3,368.32],[23.85,365.08],[23.4,361.57],[23.04,357.88],[22.77,354.19],[22.59,350.41],[22.41,346.72],[22.32,342.94],[22.32,339.07],[22.32,335.29],[22.5,331.42],[22.77,327.46],[23.22,323.41],[23.85,319.36],[24.57,315.31],[25.56,311.26],[26.64,307.3],[27.9,303.25],[29.34,299.38],[30.96,295.42],[32.67,291.55],[34.56,287.77],[36.54,283.99],[38.79,280.3],[41.13,276.61],[43.65,273.01],[46.26,269.5],[49.14,266.08],[52.11,262.75],[55.26,259.51],[58.59,256.45],[61.92,253.39],[65.52,250.6],[69.12,247.9],[72.9,245.29],[76.77,242.77],[80.73,240.43],[84.96,238.27],[89.19,236.2],[93.6,234.4],[98.01,232.69],[102.51,231.16],[107.01,229.81],[111.6,228.64],[116.19,227.65],[118.54,227.24]]],[[[180,134.5],[183.42,141.34],[186.3,146.83],[188.64,150.7],[190.53,153.4],[192.15,155.56],[193.59,157.63],[194.85,159.79],[195.84,162.04],[196.65,164.38],[197.19,166.72],[197.55,169.15],[197.73,171.67],[197.64,174.1],[197.46,176.53],[197.01,178.96],[196.47,181.39],[195.84,183.82],[195.12,186.16],[194.4,188.5],[193.77,190.84],[193.05,193.18],[192.42,195.43],[191.88,197.59],[191.52,199.66],[191.25,201.91],[191.25,204.43],[191.52,207.31],[192.06,210.46],[193.05,213.61],[194.49,216.58],[196.47,219.19],[198.9,221.35],[201.78,223.15],[204.84,224.5],[208.17,225.4],[211.5,225.94],[215.01,226.03],[218.52,225.85],[222.03,225.67],[225.9,225.67],[230.04,225.76],[234.54,226.21],[236.22,226.44],[250.41,302.83],[248.13,304.6],[243.81,308.29],[239.22,312.61],[234.54,317.29],[230.04,321.97],[225.99,326.38],[222.57,330.52],[219.6,334.39],[216.99,338.08],[214.74,341.59],[212.67,345.19],[210.78,348.88],[208.89,352.66],[207.27,356.44],[205.65,360.31],[204.3,364.27],[202.95,368.14],[201.78,372.1],[200.7,375.97],[199.8,379.93],[198.99,383.8],[198.36,387.76],[197.73,391.72],[197.28,395.77],[196.92,399.91],[196.65,404.14],[196.47,408.19],[196.38,412.06],[196.29,415.57],[196.2,418.9],[203.67,425.83],[210.51,432.4],[215.91,438.34],[219.51,443.38],[221.58,447.61],[222.66,451.12],[223.29,454.45],[223.92,457.78],[224.64,461.11],[225.45,464.44],[226.26,467.77],[227.25,471.19],[228.15,474.61],[229.14,478.03],[230.04,481.54],[231.03,484.96],[232.11,488.47],[233.1,491.89],[234.09,495.4],[235.08,498.91],[236.07,502.42],[237.06,505.93],[237.96,509.44],[238.95,512.95],[239.94,516.46],[240.84,520.06],[241.74,523.75],[242.64,527.53],[243.45,531.4],[244.17,535.36],[244.8,539.5],[242.82,537.61],[240.66,535.45],[238.41,533.02],[236.07,530.41],[233.73,527.62],[231.39,524.74],[229.14,521.86],[226.89,518.89],[224.64,516.01],[222.48,513.04],[220.23,509.98],[218.16,507.01],[216,504.04],[213.93,501.07],[211.86,498.01],[209.7,494.95],[207.63,491.98],[205.65,488.83],[203.58,485.77],[201.6,482.62],[199.53,479.38],[197.64,476.14],[195.66,472.9],[193.77,469.48],[191.88,466.15],[190.08,462.73],[188.37,459.31],[186.66,455.89],[185.04,452.56],[183.51,449.41],[182.16,446.53],[180.99,444.1],[180,442.03],[179.01,444.1],[177.84,446.53],[176.49,449.41],[174.96,452.56],[173.34,455.89],[171.63,459.31],[169.92,462.73],[168.12,466.15],[166.23,469.48],[164.34,472.9],[162.36,476.14],[160.47,479.38],[158.4,482.62],[156.42,485.77],[154.35,488.83],[152.37,491.98],[150.3,494.95],[148.14,498.01],[146.07,501.07],[144,504.04],[141.84,507.01],[139.77,509.98],[137.52,513.04],[135.36,516.01],[133.11,518.89],[130.86,521.86],[128.61,524.74],[126.27,527.62],[123.93,530.41],[121.59,533.02],[119.34,535.45],[117.18,537.61],[115.2,539.5],[115.83,535.36],[116.55,531.4],[117.36,527.53],[118.26,523.75],[119.16,520.06],[120.06,516.46],[121.05,512.95],[122.04,509.44],[122.94,505.93],[123.93,502.42],[124.92,498.91],[125.91,495.4],[126.9,491.89],[127.89,488.47],[128.97,484.96],[129.96,481.54],[130.86,478.03],[131.85,474.61],[132.75,471.19],[133.74,467.77],[134.55,464.44],[135.36,461.11],[136.08,457.78],[136.71,454.45],[137.34,451.12],[138.42,447.61],[140.49,443.38],[144.09,438.34],[149.49,432.4],[156.33,425.83],[163.8,418.9],[163.71,415.57],[163.62,412.06],[163.53,408.19],[163.35,404.14],[163.08,399.91],[162.72,395.77],[162.27,391.72],[161.64,387.76],[161.01,383.8],[160.2,379.93],[159.3,375.97],[158.22,372.1],[157.05,368.14],[155.7,364.27],[154.35,360.31],[152.73,356.44],[151.11,352.66],[149.22,348.88],[147.33,345.19],[145.26,341.59],[143.01,338.08],[140.4,334.39],[137.43,330.52],[134.01,326.38],[129.96,321.97],[125.46,317.29],[120.78,312.61],[116.19,308.29],[111.87,304.6],[109.59,302.83],[123.78,226.44],[125.46,226.21],[129.96,225.76],[134.1,225.67],[137.97,225.67],[141.48,225.85],[144.99,226.03],[148.5,225.94],[151.83,225.4],[155.16,224.5],[158.22,223.15],[161.1,221.35],[163.53,219.19],[165.51,216.58],[166.95,213.61],[167.94,210.46],[168.48,207.31],[168.75,204.43],[168.75,201.91],[168.48,199.66],[168.12,197.59],[167.58,195.43],[166.95,193.18],[166.23,190.84],[165.6,188.5],[164.88,186.16],[164.16,183.82],[163.53,181.39],[162.99,178.96],[162.54,176.53],[162.36,174.1],[162.27,171.67],[162.45,169.15],[162.81,166.72],[163.35,164.38],[164.16,162.04],[165.15,159.79],[166.41,157.63],[167.85,155.56],[169.47,153.4],[171.36,150.7],[173.7,146.83],[176.58,141.34]]],[[[241.46,227.24],[243.81,227.65],[248.4,228.64],[252.99,229.81],[257.49,231.16],[261.99,232.69],[266.4,234.4],[270.81,236.2],[275.04,238.27],[279.27,240.43],[283.23,242.77],[287.1,245.29],[290.88,247.9],[294.48,250.6],[298.08,253.39],[301.41,256.45],[304.74,259.51],[307.89,262.75],[310.86,266.08],[313.74,269.5],[316.35,273.01],[318.87,276.61],[321.21,280.3],[323.46,283.99],[325.44,287.77],[327.33,291.55],[329.04,295.42],[330.66,299.38],[332.1,303.25],[333.36,307.3],[334.44,311.26],[335.43,315.31],[336.15,319.36],[336.78,323.41],[337.23,327.46],[337.5,331.42],[337.68,335.29],[337.68,339.07],[337.68,342.94],[337.59,346.72],[337.41,350.41],[337.23,354.19],[336.96,357.88],[336.6,361.57],[336.15,365.08],[335.7,368.32],[335.25,371.29],[334.8,373.9],[333.45,371.56],[332.01,368.95],[330.39,365.98],[328.77,362.83],[327.06,359.5],[325.35,356.17],[323.64,352.84],[322.02,349.6],[320.31,346.36],[318.6,343.21],[316.89,340.06],[315.18,337.09],[313.38,334.21],[311.49,331.51],[309.6,328.9],[307.71,326.47],[305.64,324.13],[303.48,321.88],[301.32,319.72],[299.07,317.65],[296.82,315.67],[294.48,313.87],[292.14,312.16],[289.71,310.54],[287.28,309.01],[284.85,307.57],[282.33,306.31],[279.9,305.14],[277.47,304.15],[275.04,303.25],[272.61,302.53],[270.09,301.9],[267.75,301.27],[265.59,300.82],[263.7,300.28],[261.99,299.83],[260.55,299.29],[259.02,299.02],[257.13,299.2],[254.96,299.95]]]],
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
    // Seven parts: the cranium and jaw (the eye sockets and nasal cavity are holes in it, so a fast sweep across the face still slips) and six teeth, cut from the jaw by a 5 unit slit above the notches. Path: a lap 5 inside each tooth (right to left), then on the cranium one lap 7.2 inside the outline, a lap around each hole and rows 18 apart at 300, lifting where the old lap crossed a slit.
    name: "Skull", timer: 42, boss: true, tier: "skull", perfect: 30.92, body: "calf",
    parts: [[[[180,112],[183.7,112.1],[188.7,112.1],[194.8,112.2],[201.3,112.4],[207.8,112.8],[214,113.5],[219.9,114.5],[225.9,115.7],[232,117.1],[238.1,118.8],[244.1,120.7],[250,123],[255.9,125.6],[261.8,128.6],[267.6,131.8],[273.3,135.4],[278.8,139.1],[284,143],[288.9,147.1],[293.6,151.5],[298.1,156.1],[302.4,160.9],[306.3,165.9],[310,171],[313.3,176.3],[316.4,181.7],[319.2,187.4],[321.7,193.1],[324,199],[326,205],[327.8,211.1],[329.3,217.4],[330.6,223.8],[331.7,230.2],[332.5,236.6],[333,243],[333.3,249.4],[333.3,255.8],[333,262.2],[332.5,268.6],[331.8,274.8],[331,281],[329.9,287.1],[328.6,293.2],[327.1,299.2],[325.5,305],[323.8,310.7],[322,316],[320.1,321.1],[318,325.9],[315.8,330.6],[313.7,335],[311.7,339.1],[310,343],[308.7,346.4],[307.6,349.4],[306.8,352.1],[305.9,354.8],[305,357.7],[304,361],[302.8,364.7],[301.5,368.7],[300.2,372.8],[298.8,377.1],[297.4,381.5],[296,386],[294.5,390.6],[293,395.3],[291.4,400.2],[289.9,405.1],[288.4,410.1],[287,415],[285.7,419.8],[284.4,424.6],[283.2,429.3],[282,434.2],[281,439.4],[280,445],[279.1,451.1],[278.4,457.7],[277.7,464.6],[277.1,471.5],[276.5,478.4],[276,485],[275.5,491.5],[275.1,498.1],[274.8,504.7],[274.5,511],[274.3,516.8],[274,522],[273.8,526.7],[273.72,528.5],[86.28,528.5],[86.2,526.7],[86,522],[85.7,516.8],[85.5,511],[85.2,504.7],[84.9,498.1],[84.5,491.5],[84,485],[83.5,478.4],[82.9,471.5],[82.3,464.6],[81.6,457.7],[80.9,451.1],[80,445],[79,439.4],[78,434.2],[76.8,429.3],[75.6,424.6],[74.3,419.8],[73,415],[71.6,410.1],[70.1,405.1],[68.6,400.2],[67,395.3],[65.5,390.6],[64,386],[62.6,381.5],[61.2,377.1],[59.8,372.8],[58.5,368.7],[57.2,364.7],[56,361],[55,357.7],[54.1,354.8],[53.3,352.1],[52.4,349.4],[51.3,346.4],[50,343],[48.3,339.1],[46.3,335],[44.2,330.6],[42,325.9],[39.9,321.1],[38,316],[36.2,310.7],[34.5,305],[32.9,299.2],[31.4,293.2],[30.1,287.1],[29,281],[28.2,274.8],[27.5,268.6],[27,262.2],[26.7,255.8],[26.7,249.4],[27,243],[27.5,236.6],[28.3,230.2],[29.4,223.8],[30.7,217.4],[32.2,211.1],[34,205],[36,199],[38.3,193.1],[40.8,187.4],[43.6,181.7],[46.7,176.3],[50,171],[53.7,165.9],[57.6,160.9],[61.9,156.1],[66.4,151.5],[71.1,147.1],[76,143],[81.2,139.1],[86.7,135.4],[92.4,131.8],[98.2,128.6],[104.1,125.6],[110,123],[115.9,120.7],[121.9,118.8],[128,117.1],[134.1,115.7],[140.1,114.5],[146,113.5],[152.2,112.8],[158.7,112.4],[165.3,112.2],[171.3,112.1],[176.3,112.1]],[[168.7,285],[169.4,292.5],[169.6,297.8],[169.4,302.4],[168.8,306.6],[167.9,310.5],[166.6,314.1],[165,317.4],[163.1,320.4],[160.8,323.1],[158.2,325.6],[155.3,327.7],[152,329.6],[148.3,331.2],[144.2,332.6],[139.4,333.7],[132.4,334.7],[125.4,335.4],[120.4,335.4],[116.1,335.1],[112.2,334.4],[108.5,333.4],[105.1,332],[102,330.2],[99.2,328.1],[96.6,325.6],[94.2,322.8],[92.2,319.6],[90.3,316.1],[88.8,312.1],[87.5,307.7],[86.4,302.5],[85.3,295],[84.6,287.5],[84.4,282.2],[84.6,277.6],[85.2,273.4],[86.1,269.5],[87.4,265.9],[89,262.6],[90.9,259.6],[93.2,256.9],[95.8,254.4],[98.7,252.3],[102,250.4],[105.7,248.8],[109.8,247.4],[114.6,246.3],[121.6,245.3],[128.6,244.6],[133.6,244.6],[137.9,244.9],[141.8,245.6],[145.5,246.6],[148.9,248],[152,249.8],[154.8,251.9],[157.4,254.4],[159.8,257.2],[161.8,260.4],[163.7,263.9],[165.2,267.9],[166.5,272.3],[167.6,277.5]],[[274.7,295],[273.6,302.5],[272.5,307.7],[271.2,312.1],[269.7,316.1],[267.8,319.6],[265.8,322.8],[263.4,325.6],[260.8,328.1],[258,330.2],[254.9,332],[251.5,333.4],[247.8,334.4],[243.9,335.1],[239.6,335.4],[234.6,335.4],[227.6,334.7],[220.6,333.7],[215.8,332.6],[211.7,331.2],[208,329.6],[204.7,327.7],[201.8,325.6],[199.2,323.1],[196.9,320.4],[195,317.4],[193.4,314.1],[192.1,310.5],[191.2,306.6],[190.6,302.4],[190.4,297.8],[190.6,292.5],[191.3,285],[192.4,277.5],[193.5,272.3],[194.8,267.9],[196.3,263.9],[198.2,260.4],[200.2,257.2],[202.6,254.4],[205.2,251.9],[208,249.8],[211.1,248],[214.5,246.6],[218.2,245.6],[222.1,244.9],[226.4,244.6],[231.4,244.6],[238.4,245.3],[245.4,246.3],[250.2,247.4],[254.3,248.8],[258,250.4],[261.3,252.3],[264.2,254.4],[266.8,256.9],[269.1,259.6],[271,262.6],[272.6,265.9],[273.9,269.5],[274.8,273.4],[275.4,277.6],[275.6,282.2],[275.4,287.5]],[[180,338],[182,339],[184,341.9],[186.1,346],[188.1,350.9],[190.1,356.2],[192.1,361.4],[194,366],[196.1,370.4],[198.5,375.1],[201,380],[203.3,384.7],[205.2,389.1],[206.5,393],[207,396],[206.5,398.3],[205.2,400],[203.3,401.1],[201,401.9],[198.5,402.2],[196.1,402.2],[194,402],[192.1,401.1],[190.1,399.5],[188.1,397.3],[186.1,395.1],[184,393],[182,391.6],[180,391],[178,391.6],[176,393],[173.9,395.1],[171.9,397.3],[169.9,399.5],[167.9,401.1],[166,402],[163.9,402.2],[161.5,402.2],[159,401.9],[156.7,401.1],[154.8,400],[153.5,398.3],[153,396],[153.5,393],[154.8,389.1],[156.7,384.7],[159,380],[161.5,375.1],[163.9,370.4],[166,366],[167.9,361.4],[169.9,356.2],[171.9,350.9],[173.9,346],[176,341.9],[178,339]]],[[[120,533.5],[118.62,533.5],[118,536],[114.5,556],[97,556],[95.4,555.2],[93.1,554],[90.8,552.6],[89,551],[88,549],[87.5,546.7],[87.2,544.5],[87,543],[86.9,540.9],[86.8,538.1],[86.6,534.8],[86.53,533.5],[120,533.5]]],[[[150,533.5],[148.62,533.5],[148,536],[144.5,556],[125.5,556],[122,536],[121.38,533.5],[120,533.5],[150,533.5]]],[[[180,533.5],[179.25,533.5],[178,536],[174.5,556],[155.5,556],[152,536],[151.38,533.5],[150,533.5],[180,533.5]]],[[[210,533.5],[208.62,533.5],[208,536],[204.5,556],[185.5,556],[182,536],[180.75,533.5],[180,533.5],[210,533.5]]],[[[240,533.5],[238.62,533.5],[238,536],[234.5,556],[215.5,556],[212,536],[211.38,533.5],[210,533.5],[240,533.5]]],[[[273.47,533.5],[273.4,534.8],[273.2,538.1],[273.1,540.9],[273,543],[272.8,544.5],[272.5,546.7],[272,549],[271,551],[269.2,552.6],[266.9,554],[264.6,555.2],[263,556],[245.5,556],[242,536],[241.38,533.5],[240,533.5]]]],
  },
  {
    // Three rings, each a part with a hole: a fast sweep across a ring slips in its hole, and every ring is a landing. Path: land on a ring, lap it 6 inside the outer edge at 200, lap again 6 outside the hole, lift to the next ring.
    name: "Trinity", timer: 20, boss: false, tier: "mid", perfect: 10.02, body: "forearm", story: null,
    parts: [[[[244.5,284.0],[244.3,289.6],[243.5,295.1],[242.3,300.6],[240.6,305.9],[238.5,311.1],[235.9,316.0],[232.9,320.7],[229.5,325.2],[225.8,329.3],[221.6,333.0],[217.2,336.4],[212.5,339.4],[207.5,342.0],[202.4,344.2],[197.1,345.8],[191.6,347.0],[186.1,347.8],[180.5,348.0],[174.9,347.8],[169.4,347.0],[163.9,345.8],[158.6,344.2],[153.5,342.0],[148.5,339.4],[143.8,336.4],[139.4,333.0],[135.2,329.3],[131.5,325.2],[128.1,320.7],[125.1,316.0],[122.5,311.1],[120.4,305.9],[118.7,300.6],[117.5,295.1],[116.7,289.6],[116.5,284.0],[116.7,278.4],[117.5,272.9],[118.7,267.5],[120.4,262.1],[122.5,257.0],[125.1,252.0],[128.1,247.3],[131.5,242.9],[135.2,238.8],[139.4,235.0],[143.8,231.6],[148.5,228.6],[153.5,226.0],[158.6,223.9],[163.9,222.2],[169.4,221.0],[174.9,220.3],[180.5,220.0],[186.1,220.3],[191.6,221.0],[197.1,222.2],[202.4,223.9],[207.5,226.0],[212.5,228.6],[217.2,231.6],[221.6,235.0],[225.8,238.8],[229.5,242.9],[232.9,247.3],[235.9,252.0],[238.5,257.0],[240.6,262.1],[242.3,267.5],[243.5,272.9],[244.3,278.4]],[[210.5,284.0],[210.2,287.9],[209.5,291.8],[208.2,295.5],[206.5,299.0],[204.3,302.3],[201.7,305.2],[198.8,307.8],[195.5,310.0],[192.0,311.7],[188.3,313.0],[184.4,313.8],[180.5,314.0],[176.6,313.8],[172.7,313.0],[169.0,311.7],[165.5,310.0],[162.2,307.8],[159.3,305.2],[156.7,302.3],[154.5,299.0],[152.8,295.5],[151.5,291.8],[150.8,287.9],[150.5,284.0],[150.8,280.1],[151.5,276.3],[152.8,272.5],[154.5,269.0],[156.7,265.8],[159.3,262.8],[162.2,260.2],[165.5,258.0],[169.0,256.3],[172.7,255.0],[176.6,254.3],[180.5,254.0],[184.4,254.3],[188.3,255.0],[192.0,256.3],[195.5,258.0],[198.8,260.2],[201.7,262.8],[204.3,265.8],[206.5,269.0],[208.2,272.5],[209.5,276.3],[210.2,280.1]]],[[[176.5,401.8],[176.3,407.4],[175.5,412.9],[174.3,418.4],[172.6,423.7],[170.5,428.8],[167.9,433.8],[164.9,438.5],[161.5,442.9],[157.8,447.1],[153.6,450.8],[149.2,454.2],[144.5,457.2],[139.5,459.8],[134.4,461.9],[129.1,463.6],[123.6,464.8],[118.1,465.6],[112.5,465.8],[106.9,465.6],[101.4,464.8],[95.9,463.6],[90.6,461.9],[85.5,459.8],[80.5,457.2],[75.8,454.2],[71.4,450.8],[67.2,447.1],[63.5,442.9],[60.1,438.5],[57.1,433.8],[54.5,428.8],[52.4,423.7],[50.7,418.4],[49.5,412.9],[48.7,407.4],[48.5,401.8],[48.7,396.2],[49.5,390.7],[50.7,385.2],[52.4,379.9],[54.5,374.8],[57.1,369.8],[60.1,365.1],[63.5,360.7],[67.2,356.5],[71.4,352.8],[75.8,349.4],[80.5,346.4],[85.5,343.8],[90.6,341.7],[95.9,340.0],[101.4,338.8],[106.9,338.0],[112.5,337.8],[118.1,338.0],[123.6,338.8],[129.1,340.0],[134.4,341.7],[139.5,343.8],[144.5,346.4],[149.2,349.4],[153.6,352.8],[157.8,356.5],[161.5,360.7],[164.9,365.1],[167.9,369.8],[170.5,374.8],[172.6,379.9],[174.3,385.2],[175.5,390.7],[176.3,396.2]],[[142.5,401.8],[142.2,405.7],[141.5,409.6],[140.2,413.3],[138.5,416.8],[136.3,420.1],[133.7,423.0],[130.8,425.6],[127.5,427.8],[124.0,429.5],[120.3,430.8],[116.4,431.5],[112.5,431.8],[108.6,431.5],[104.7,430.8],[101.0,429.5],[97.5,427.8],[94.2,425.6],[91.3,423.0],[88.7,420.1],[86.5,416.8],[84.8,413.3],[83.5,409.6],[82.8,405.7],[82.5,401.8],[82.8,397.9],[83.5,394.0],[84.8,390.3],[86.5,386.8],[88.7,383.5],[91.3,380.6],[94.2,378.0],[97.5,375.8],[101.0,374.1],[104.7,372.8],[108.6,372.1],[112.5,371.8],[116.4,372.1],[120.3,372.8],[124.0,374.1],[127.5,375.8],[130.8,378.0],[133.7,380.6],[136.3,383.5],[138.5,386.8],[140.2,390.3],[141.5,394.0],[142.2,397.9]]],[[[312.5,401.8],[312.3,407.4],[311.5,412.9],[310.3,418.4],[308.6,423.7],[306.5,428.8],[303.9,433.8],[300.9,438.5],[297.5,442.9],[293.8,447.1],[289.6,450.8],[285.2,454.2],[280.5,457.2],[275.5,459.8],[270.4,461.9],[265.1,463.6],[259.6,464.8],[254.1,465.6],[248.5,465.8],[242.9,465.6],[237.4,464.8],[231.9,463.6],[226.6,461.9],[221.5,459.8],[216.5,457.2],[211.8,454.2],[207.4,450.8],[203.2,447.1],[199.5,442.9],[196.1,438.5],[193.1,433.8],[190.5,428.8],[188.4,423.7],[186.7,418.4],[185.5,412.9],[184.7,407.4],[184.5,401.8],[184.7,396.2],[185.5,390.7],[186.7,385.2],[188.4,379.9],[190.5,374.8],[193.1,369.8],[196.1,365.1],[199.5,360.7],[203.2,356.5],[207.4,352.8],[211.8,349.4],[216.5,346.4],[221.5,343.8],[226.6,341.7],[231.9,340.0],[237.4,338.8],[242.9,338.0],[248.5,337.8],[254.1,338.0],[259.6,338.8],[265.1,340.0],[270.4,341.7],[275.5,343.8],[280.5,346.4],[285.2,349.4],[289.6,352.8],[293.8,356.5],[297.5,360.7],[300.9,365.1],[303.9,369.8],[306.5,374.8],[308.6,379.9],[310.3,385.2],[311.5,390.7],[312.3,396.2]],[[278.5,401.8],[278.2,405.7],[277.5,409.6],[276.2,413.3],[274.5,416.8],[272.3,420.1],[269.7,423.0],[266.8,425.6],[263.5,427.8],[260.0,429.5],[256.3,430.8],[252.4,431.5],[248.5,431.8],[244.6,431.5],[240.7,430.8],[237.0,429.5],[233.5,427.8],[230.2,425.6],[227.3,423.0],[224.7,420.1],[222.5,416.8],[220.8,413.3],[219.5,409.6],[218.8,405.7],[218.5,401.8],[218.8,397.9],[219.5,394.0],[220.8,390.3],[222.5,386.8],[224.7,383.5],[227.3,380.6],[230.2,378.0],[233.5,375.8],[237.0,374.1],[240.7,372.8],[244.6,372.1],[248.5,371.8],[252.4,372.1],[256.3,372.8],[260.0,374.1],[263.5,375.8],[266.8,378.0],[269.7,380.6],[272.3,383.5],[274.5,386.8],[276.2,390.3],[277.5,394.0],[278.2,397.9]]]],
  },
  {
    // Five small stars joined by nothing: five landings on small targets and long lifts. Path: land in a star, ride its outline 5 inside at 175, spiral the middle at 220, lift to the next star.
    name: "Constellation", timer: 15, boss: false, tier: "early", perfect: 6.45, body: "shoulder", story: null,
    parts: [[[[82.0,149.5],[92.6,170.9],[116.2,174.4],[99.1,191.1],[103.2,214.6],[82.0,203.5],[60.8,214.6],[64.9,191.1],[47.8,174.4],[71.4,170.9]]],[[[135.0,307.5],[143.2,324.2],[161.6,326.8],[148.3,339.8],[151.5,358.2],[135.0,349.5],[118.5,358.2],[121.7,339.8],[108.4,326.8],[126.8,324.2]]],[[[238.0,202.5],[249.2,225.1],[274.1,228.8],[256.1,246.4],[260.3,271.2],[238.0,259.5],[215.7,271.2],[219.9,246.4],[201.9,228.8],[226.8,225.1]]],[[[268.0,380.5],[276.8,398.4],[296.5,401.2],[282.3,415.1],[285.6,434.8],[268.0,425.5],[250.4,434.8],[253.7,415.1],[239.5,401.2],[259.2,398.4]]],[[[148.0,466.5],[158.0,486.7],[180.3,490.0],[164.2,505.8],[168.0,528.0],[148.0,517.5],[128.0,528.0],[131.8,505.8],[115.7,490.0],[138.0,486.7]]]],
  },
  {
    // Two crossed bones: one whole, the other cut in two by a 5 unit slit either side of it, so three parts and three landings. Path: land on a part, ride its outline 5 inside at 175, lift to the next part.
    name: "Bones", timer: 23, boss: false, tier: "mid", perfect: 11.62, body: "calf", story: null,
    parts: [[[[106.9,171.2],[107.5,170.6],[108.2,170.0],[108.8,169.3],[109.4,168.6],[109.9,167.8],[110.3,167.0],[110.7,166.2],[111.1,165.3],[111.4,164.5],[111.8,162.7],[111.9,161.8],[112.0,160.9],[112.0,160.0],[111.9,159.0],[111.8,158.1],[111.4,156.3],[111.1,155.5],[110.8,154.6],[110.4,153.8],[109.9,153.0],[109.4,152.2],[108.8,151.5],[108.2,150.8],[107.6,150.2],[106.9,149.6],[106.2,149.0],[105.4,148.5],[104.6,148.0],[103.8,147.6],[103.0,147.3],[102.1,147.0],[101.2,146.8],[99.4,146.4],[96.7,146.4],[95.7,146.6],[94.8,146.7],[94.0,147.0],[93.1,147.3],[92.2,147.6],[91.4,148.0],[90.6,148.5],[89.9,149.0],[89.1,149.5],[88.4,150.1],[87.8,150.8],[87.2,151.5],[86.6,152.2],[86.1,153.0],[84.9,155.4],[84.6,156.3],[84.4,157.2],[84.2,157.9],[83.5,157.6],[82.7,157.3],[80.9,156.9],[80.0,156.8],[79.1,156.7],[78.1,156.7],[77.2,156.8],[76.3,156.9],[75.4,157.1],[74.5,157.3],[73.7,157.6],[72.8,157.9],[72.0,158.3],[71.2,158.8],[70.4,159.3],[69.7,159.9],[69.0,160.5],[68.4,161.1],[67.8,161.8],[67.2,162.5],[66.7,163.3],[66.2,164.1],[65.8,164.9],[65.5,165.7],[65.2,166.6],[64.9,167.5],[64.8,168.4],[64.6,169.3],[64.6,172.0],[64.8,173.0],[64.9,173.9],[65.2,174.7],[65.8,176.5],[66.2,177.3],[66.7,178.1],[67.2,178.8],[67.7,179.6],[68.3,180.3],[69.0,180.9],[69.7,181.5],[70.4,182.1],[71.2,182.6],[71.9,183.0],[72.8,183.4],[73.6,183.8],[74.5,184.1],[75.4,184.3],[76.3,184.5],[77.2,184.6],[78.1,184.7],[79.0,184.7],[79.9,184.6],[80.8,184.5],[81.7,184.3],[82.6,184.1],[83.5,183.8],[84.3,183.5],[85.1,183.1],[164.9,333.1],[177.4,309.6],[104.6,172.7],[105.4,172.3],[106.1,171.8]]],[[[277.1,183.8],[278.0,184.1],[278.9,184.3],[279.8,184.5],[280.7,184.6],[281.6,184.7],[282.5,184.7],[283.4,184.6],[284.3,184.5],[285.2,184.3],[286.1,184.1],[287.0,183.8],[287.8,183.4],[288.7,183.0],[289.4,182.6],[290.2,182.1],[290.9,181.5],[291.6,180.9],[292.3,180.3],[292.9,179.6],[293.4,178.8],[293.9,178.1],[294.4,177.3],[294.8,176.5],[295.4,174.7],[295.7,173.9],[295.8,173.0],[296.0,172.0],[296.0,169.3],[295.8,168.4],[295.7,167.5],[295.4,166.6],[295.1,165.7],[294.8,164.9],[294.4,164.1],[293.9,163.3],[293.4,162.5],[292.8,161.8],[292.2,161.1],[291.6,160.5],[290.9,159.9],[290.2,159.3],[289.4,158.8],[288.6,158.3],[287.8,157.9],[286.9,157.6],[286.1,157.3],[285.2,157.1],[284.3,156.9],[283.4,156.8],[282.5,156.7],[281.5,156.7],[280.6,156.8],[279.7,156.9],[277.9,157.3],[277.1,157.6],[276.4,157.9],[276.2,157.2],[276.0,156.3],[275.7,155.4],[274.9,153.8],[274.5,153.0],[274.0,152.2],[273.4,151.5],[272.8,150.8],[272.2,150.1],[271.5,149.5],[270.7,149.0],[270.0,148.5],[269.2,148.0],[268.4,147.6],[267.5,147.3],[266.6,147.0],[265.8,146.7],[264.9,146.6],[263.9,146.4],[261.2,146.4],[259.4,146.8],[258.5,147.0],[257.6,147.3],[256.8,147.6],[256.0,148.0],[255.2,148.5],[254.4,149.0],[253.7,149.6],[253.0,150.2],[252.4,150.8],[251.8,151.5],[251.2,152.2],[250.7,153.0],[250.2,153.8],[249.8,154.6],[249.5,155.5],[249.2,156.3],[249.0,157.2],[248.8,158.1],[248.7,159.0],[248.6,160.0],[248.6,160.9],[248.7,161.8],[248.8,162.7],[249.0,163.6],[249.2,164.5],[249.5,165.3],[249.9,166.2],[250.3,167.0],[250.7,167.8],[251.2,168.6],[251.8,169.3],[252.4,170.0],[253.1,170.6],[253.7,171.2],[254.5,171.8],[255.2,172.3],[256.0,172.7],[85.1,494.1],[84.3,493.7],[83.5,493.4],[82.6,493.1],[81.7,492.9],[80.8,492.7],[79.9,492.6],[79.0,492.5],[78.1,492.5],[77.2,492.6],[76.3,492.7],[75.4,492.9],[74.5,493.1],[73.6,493.4],[72.8,493.8],[71.9,494.2],[71.2,494.6],[70.4,495.1],[69.7,495.7],[69.0,496.3],[68.3,496.9],[67.7,497.6],[67.2,498.4],[66.7,499.1],[66.2,499.9],[65.8,500.7],[65.2,502.5],[64.9,503.3],[64.8,504.2],[64.6,505.2],[64.6,507.9],[64.8,508.8],[64.9,509.7],[65.2,510.6],[65.5,511.5],[65.8,512.3],[66.2,513.1],[66.7,513.9],[67.2,514.7],[67.8,515.4],[68.4,516.1],[69.0,516.7],[69.7,517.3],[70.4,517.9],[71.2,518.4],[72.0,518.9],[72.8,519.3],[73.7,519.6],[74.5,519.9],[75.4,520.1],[76.3,520.3],[77.2,520.4],[78.1,520.5],[79.1,520.5],[80.0,520.4],[80.9,520.3],[82.7,519.9],[83.5,519.6],[84.2,519.3],[84.4,520.0],[84.6,520.9],[84.9,521.8],[85.7,523.4],[86.1,524.2],[86.6,525.0],[87.2,525.7],[87.8,526.4],[88.4,527.1],[89.1,527.7],[89.9,528.2],[90.6,528.7],[91.4,529.2],[92.2,529.6],[93.1,529.9],[94.0,530.2],[94.8,530.5],[95.7,530.6],[96.7,530.8],[99.4,530.8],[101.2,530.4],[102.1,530.2],[103.0,529.9],[103.8,529.6],[104.6,529.2],[105.4,528.7],[106.2,528.2],[106.9,527.6],[107.6,527.0],[108.2,526.4],[108.8,525.7],[109.4,525.0],[109.9,524.2],[110.4,523.4],[110.8,522.6],[111.1,521.7],[111.4,520.9],[111.8,519.1],[111.9,518.2],[112.0,517.2],[112.0,516.3],[111.9,515.4],[111.8,514.5],[111.4,512.7],[111.1,511.9],[110.7,511.0],[110.3,510.2],[109.9,509.4],[109.4,508.6],[108.2,507.2],[107.5,506.6],[106.9,506.0],[106.1,505.4],[105.4,504.9],[104.6,504.5],[275.5,183.1],[276.3,183.5]]],[[[256.0,504.5],[255.2,504.9],[254.5,505.4],[253.7,506.0],[253.1,506.6],[252.4,507.2],[251.2,508.6],[250.7,509.4],[250.3,510.2],[249.9,511.0],[249.5,511.9],[249.2,512.7],[249.0,513.6],[248.8,514.5],[248.7,515.4],[248.6,516.3],[248.6,517.2],[248.7,518.2],[248.8,519.1],[249.0,520.0],[249.2,520.9],[249.5,521.7],[249.8,522.6],[250.2,523.4],[250.7,524.2],[251.2,525.0],[251.8,525.7],[252.4,526.4],[253.0,527.0],[253.7,527.6],[254.4,528.2],[255.2,528.7],[256.0,529.2],[256.8,529.6],[257.6,529.9],[258.5,530.2],[259.4,530.4],[261.2,530.8],[263.9,530.8],[264.9,530.6],[265.8,530.5],[266.6,530.2],[267.5,529.9],[268.4,529.6],[269.2,529.2],[270.0,528.7],[270.7,528.2],[271.5,527.7],[272.2,527.1],[272.8,526.4],[273.4,525.7],[274.0,525.0],[274.5,524.2],[275.7,521.8],[276.0,520.9],[276.2,520.0],[276.4,519.3],[277.1,519.6],[277.9,519.9],[279.7,520.3],[280.6,520.4],[281.5,520.5],[282.5,520.5],[283.4,520.4],[284.3,520.3],[285.2,520.1],[286.1,519.9],[286.9,519.6],[287.8,519.3],[288.6,518.9],[289.4,518.4],[290.2,517.9],[290.9,517.3],[291.6,516.7],[292.2,516.1],[292.8,515.4],[293.4,514.7],[293.9,513.9],[294.4,513.1],[294.8,512.3],[295.1,511.5],[295.4,510.6],[295.7,509.7],[295.8,508.8],[296.0,507.9],[296.0,505.2],[295.8,504.2],[295.7,503.3],[295.4,502.5],[294.8,500.7],[294.4,499.9],[293.9,499.1],[293.4,498.4],[292.9,497.6],[292.3,496.9],[291.6,496.3],[290.9,495.7],[290.2,495.1],[289.4,494.6],[288.7,494.2],[287.8,493.8],[287.0,493.4],[286.1,493.1],[285.2,492.9],[284.3,492.7],[283.4,492.6],[282.5,492.5],[281.6,492.5],[280.7,492.6],[279.8,492.7],[278.9,492.9],[278.0,493.1],[277.1,493.4],[276.3,493.7],[275.5,494.1],[195.7,344.1],[183.2,367.6]]]],
  },
  {
    // v0.8 content shard. Teaches rows on a big body and a thin wedge: a lighthouse in three parts, the tower with lantern and roof (a window and a door as holes) and a beam either side, 5 units off the lantern. Path (docs/games/ink/paths/lighthouse.json): land in the tower, lap it 5.5 inside, loop the lantern window and the door, fill the tower in rows 17 apart at 280, lift to each beam and lap it, fill in rows.
    name: "Lighthouse", timer: 33, boss: false, tier: "mid", perfect: 17.31, body: "forearm", story: null,
    parts: [[[[184.9,162.9],[186.5,160.7],[187.0,158.0],[186.5,155.3],[184.9,153.1],[182.7,151.5],[180.0,151.0],[178.2,151.2],[175.7,152.4],[173.9,154.5],[173.2,156.2],[173.0,158.0],[173.2,159.8],[173.9,161.5],[175.1,162.9],[176.4,164.0],[174.0,164.0],[146.0,196.0],[160.0,196.0],[157.7,196.5],[155.8,197.8],[154.5,199.7],[154.0,202.0],[154.1,241.2],[155.0,243.3],[156.7,245.0],[157.7,245.5],[160.0,246.0],[137.0,246.0],[135.3,246.5],[134.5,247.3],[134.1,248.4],[134.0,259.0],[134.2,260.1],[135.3,261.5],[137.0,262.0],[151.0,262.0],[138.0,528.0],[222.0,528.0],[209.0,262.0],[223.0,262.0],[224.7,261.5],[225.8,260.1],[226.0,259.0],[225.9,248.4],[225.5,247.3],[224.7,246.5],[223.0,246.0],[200.0,246.0],[202.3,245.5],[204.2,244.2],[205.5,242.3],[206.0,240.0],[205.9,200.8],[205.0,198.7],[203.3,197.0],[202.3,196.5],[200.0,196.0],[214.0,196.0],[186.0,164.0],[183.6,164.0]],[[190.9,228.8],[190.3,230.2],[189.8,230.8],[189.2,231.3],[187.8,231.9],[173.0,232.0],[171.5,231.7],[170.2,230.8],[169.3,229.5],[169.0,228.0],[169.0,212.0],[169.3,210.5],[170.2,209.2],[171.5,208.3],[173.0,208.0],[187.0,208.0],[188.5,208.3],[189.8,209.2],[190.7,210.5],[191.0,212.0]],[[166.0,484.0],[172.0,474.0],[188.0,474.0],[194.0,484.0],[194.0,516.0],[166.0,516.0]]],[[[147.0,210.0],[40.0,180.0],[40.0,262.0],[147.0,232.0]]],[[[213.0,210.0],[213.0,232.0],[320.0,262.0],[320.0,180.0]]]]
  },
  {
    // v0.8 content shard. Two crossed parts after the Bones rule: the fork is whole and the knife is cut in two by a 5 unit slit either side of it, so three parts and three landings. Path (docs/games/ink/paths/knife-and-fork.json): land on the fork, ride it 5.5 inside at 175 (down the middle of each tine and out again, then the head), lift to the knife blade and to the handle and ride each 5.5 inside.
    name: "Knife and Fork", timer: 23, boss: false, tier: "mid", perfect: 11.75, body: "forearm", story: null,
    parts: [[[[90.3,209.7],[88.3,208.5],[87.2,208.3],[84.9,208.4],[83.6,208.9],[82.6,209.5],[81.1,211.2],[80.4,213.4],[80.5,215.7],[117.8,292.4],[119.6,291.5],[136.4,307.8],[152.2,317.6],[246.1,519.0],[256.7,536.1],[269.1,540.4],[269.9,540.4],[270.4,539.8],[274.6,527.3],[267.7,508.5],[166.8,310.5],[168.8,292.0],[166.3,268.7],[168.1,267.8],[131.2,192.2],[129.8,190.4],[128.9,189.7],[126.7,189.0],[124.4,189.1],[123.2,189.6],[121.3,191.0],[120.2,193.0],[119.9,195.3],[120.4,197.5],[142.0,241.6],[133.0,246.0],[110.8,200.9],[109.1,199.4],[108.1,198.9],[106.9,198.6],[104.7,198.8],[102.4,199.9],[101.6,200.6],[100.4,202.6],[100.1,204.9],[100.7,207.1],[122.2,251.3],[113.2,255.7],[91.7,211.5]]],[[[225.6,284.0],[255.8,229.8],[263.4,215.6],[274.5,193.6],[283.7,173.4],[288.3,161.6],[290.1,156.3],[291.4,151.4],[292.3,147.0],[292.7,142.9],[292.8,139.2],[292.3,136.1],[291.2,133.5],[289.2,131.7],[286.2,130.6],[277.8,129.2],[268.9,140.5],[204.6,272.4],[203.4,273.0],[202.7,273.9],[198.3,282.9],[198.0,284.1],[198.2,285.2],[198.8,286.2],[199.6,286.9],[179.6,323.9],[192.5,349.1],[216.9,295.3],[217.9,295.6],[219.1,295.4],[220.5,294.4],[225.2,284.9],[225.5,283.9]]],[[[123.4,436.6],[115.1,460.4],[120.1,470.6],[131.3,468.3],[144.9,447.1],[176.5,382.4],[163.5,354.4]]]]
  },
  {
    // v0.8 content shard. Lettering in a heart: M, & and J are three small landings inside a long heart ring, so every letter is a clean touch-down and the ring needs its own. Path: land on each letter, ride its strokes at 220, lift, then lap the heart.
    name: "M and J", noMirror: true, timer: 15, boss: false, tier: "mid", perfect: 7.68, body: "shoulder", story: null,
    parts: [[[[83.63,268.13],[86.38,268.13],[88.63,269.88],[89.63,271.88],[90.38,272.38],[91.88,275.13],[92.63,275.63],[94.13,278.38],[94.88,278.88],[96.38,281.63],[97.13,282.13],[98.63,284.88],[99.38,285.38],[100.88,288.13],[101.63,288.63],[103.13,291.38],[103.88,291.88],[105.38,294.63],[106.13,295.13],[114.63,307.88],[116.63,304.88],[117.38,304.38],[118.88,301.63],[119.63,301.13],[121.13,298.38],[121.88,297.88],[123.38,295.13],[124.13,294.63],[125.63,291.88],[126.38,291.38],[127.88,288.63],[128.63,288.13],[130.13,285.38],[130.88,284.88],[132.38,282.13],[133.13,281.63],[134.63,278.88],[135.38,278.38],[136.88,275.63],[137.63,275.13],[139.13,272.38],[139.88,271.88],[140.88,269.88],[143.13,268.13],[145.88,268.13],[147.88,269.63],[148.38,270.88],[148.38,339.13],[146.88,341.38],[145.88,341.88],[143.13,341.88],[140.88,340.13],[140.38,338.63],[140.38,285.13],[138.13,287.88],[136.63,290.63],[135.88,291.13],[134.38,293.88],[133.63,294.38],[132.13,297.13],[131.38,297.63],[129.88,300.38],[129.13,300.88],[127.63,303.63],[126.88,304.13],[125.38,306.88],[124.63,307.38],[123.13,310.13],[122.38,310.63],[120.88,313.38],[120.13,313.88],[118.63,316.63],[117.38,318.13],[115.88,318.88],[113.63,318.88],[111.63,317.63],[102.63,304.13],[101.88,303.63],[100.38,300.88],[99.63,300.38],[98.13,297.63],[97.38,297.13],[95.88,294.38],[95.13,293.88],[93.63,291.13],[92.88,290.63],[91.38,287.88],[89.13,285.13],[89.13,338.63],[88.63,340.13],[86.38,341.88],[83.63,341.88],[81.63,340.38],[81.13,339.38],[81.13,270.63],[81.63,269.63]]],[[[187.38,268.13],[190.63,268.13],[192.38,268.63],[196.88,271.63],[196.88,272.13],[199.13,274.13],[199.13,274.63],[200.38,275.88],[202.13,280.63],[202.13,286.38],[200.63,292.13],[196.38,299.63],[192.63,303.88],[192.63,304.38],[191.38,305.38],[191.88,306.38],[192.63,306.88],[193.88,309.13],[194.63,309.63],[194.63,310.13],[195.38,310.63],[195.38,311.13],[197.88,313.88],[197.88,314.38],[198.63,314.88],[198.63,315.38],[199.38,315.88],[201.38,318.88],[202.13,318.38],[202.38,317.38],[204.38,314.63],[207.63,307.88],[207.63,307.13],[208.88,305.63],[210.88,304.88],[212.88,305.13],[214.13,305.88],[215.13,307.38],[215.38,309.88],[214.13,312.13],[214.13,312.88],[210.13,320.63],[206.88,325.38],[207.13,326.38],[215.13,336.38],[215.38,338.88],[214.38,340.88],[213.88,340.88],[213.38,341.63],[209.88,341.88],[208.63,341.13],[203.63,334.88],[203.63,334.38],[202.63,333.63],[202.63,333.13],[201.63,332.63],[201.38,333.38],[197.63,336.63],[190.38,340.63],[183.88,342.38],[175.63,342.13],[173.13,341.38],[170.13,339.63],[167.63,336.88],[165.38,332.63],[164.38,328.63],[164.38,325.38],[166.38,320.38],[168.38,318.13],[168.38,317.63],[169.63,316.63],[169.63,316.13],[174.38,311.38],[174.38,310.88],[180.88,304.88],[177.38,300.13],[176.63,298.13],[176.13,297.88],[174.88,294.13],[174.38,288.13],[175.63,280.63],[177.13,277.13],[177.63,276.88],[178.88,274.38],[180.13,273.38],[180.13,272.88],[183.88,269.63]],[[188.88,276.13],[186.88,277.38],[186.63,278.13],[184.63,280.13],[183.63,282.13],[182.63,285.88],[182.38,289.88],[182.88,293.13],[184.63,296.63],[185.38,297.13],[186.38,298.88],[187.63,297.88],[187.63,297.38],[188.63,296.63],[188.63,296.13],[191.63,292.38],[193.13,289.38],[194.13,285.88],[194.13,281.63],[193.38,279.88],[190.63,276.88]],[[185.63,311.38],[178.13,318.63],[178.13,319.13],[174.63,322.63],[172.63,325.63],[172.38,327.88],[173.13,330.38],[174.63,332.88],[176.13,333.88],[177.88,334.38],[183.13,334.38],[186.88,333.38],[191.88,330.88],[196.88,326.38],[196.38,325.13],[195.63,324.63],[194.88,323.13],[193.88,322.38],[193.88,321.88],[193.13,321.38],[193.13,320.88]]],[[[248.63,267.88],[274.88,267.88],[277.38,268.63],[278.88,270.63],[278.88,273.38],[278.38,274.38],[276.38,275.88],[265.88,276.13],[265.88,319.63],[265.13,325.88],[262.88,332.38],[261.38,334.13],[260.63,335.88],[257.63,338.88],[256.63,339.13],[254.38,340.88],[251.13,341.88],[246.13,341.88],[242.88,340.88],[240.88,339.38],[239.88,339.13],[236.13,335.38],[235.88,334.38],[234.38,332.63],[232.88,329.13],[231.63,324.38],[231.38,321.63],[231.63,312.38],[233.38,310.63],[235.63,310.13],[238.13,311.13],[239.13,312.63],[239.38,321.38],[240.13,325.63],[241.63,329.13],[244.63,332.63],[247.38,333.88],[249.88,333.88],[252.13,332.88],[254.63,330.38],[256.88,325.88],[257.88,319.38],[257.88,276.13],[248.63,276.13],[246.13,275.38],[244.88,273.88],[244.63,270.88],[246.13,268.63]]],[[[96.13,185.13],[111.63,185.38],[118.13,186.38],[125.38,188.13],[132.13,190.38],[135.38,192.13],[137.88,192.88],[147.13,198.13],[150.13,200.13],[150.63,200.88],[151.13,200.88],[152.88,202.63],[153.38,202.63],[155.38,204.63],[155.88,204.63],[162.88,211.38],[162.88,211.88],[166.38,215.38],[166.38,215.88],[167.38,216.63],[170.88,221.88],[171.63,222.38],[171.88,223.38],[175.13,228.13],[178.63,235.13],[179.88,238.88],[182.88,232.63],[182.88,231.88],[183.38,231.63],[184.88,228.13],[188.13,223.38],[188.38,222.38],[189.13,221.88],[189.63,220.63],[190.38,220.13],[192.63,216.63],[193.63,215.88],[193.63,215.38],[197.13,211.88],[197.13,211.38],[204.13,204.63],[204.63,204.63],[206.63,202.63],[208.13,201.88],[208.88,200.88],[215.63,196.38],[220.38,194.13],[220.63,193.63],[227.88,190.38],[234.63,188.13],[240.63,186.63],[248.38,185.38],[263.88,185.13],[271.88,186.13],[275.13,187.13],[277.63,187.38],[287.38,190.38],[296.88,194.63],[297.13,195.13],[300.63,196.63],[300.88,197.13],[301.88,197.38],[303.63,198.88],[307.63,201.13],[309.38,202.88],[312.88,205.13],[314.88,207.38],[315.38,207.38],[324.13,216.38],[324.13,216.88],[329.13,223.13],[331.38,227.38],[332.38,228.38],[335.88,235.38],[338.13,242.13],[338.63,242.63],[340.63,250.38],[341.88,260.13],[341.88,270.13],[340.63,280.13],[338.63,288.13],[335.38,297.13],[328.88,310.13],[326.13,313.88],[324.13,317.63],[322.63,319.13],[318.63,325.13],[313.13,331.38],[313.13,331.88],[306.13,339.13],[306.13,339.63],[294.63,351.13],[294.13,351.13],[288.13,357.13],[287.63,357.13],[285.88,359.13],[285.38,359.13],[283.63,361.13],[283.13,361.13],[281.63,362.88],[281.13,362.88],[279.63,364.63],[279.13,364.63],[272.63,370.63],[272.13,370.63],[271.13,371.88],[270.63,371.88],[269.63,373.13],[269.13,373.13],[268.13,374.38],[267.63,374.38],[266.38,375.88],[264.63,376.88],[263.63,378.13],[263.13,378.13],[254.63,385.63],[252.88,386.63],[250.13,389.38],[249.63,389.38],[248.63,390.63],[248.13,390.63],[247.13,391.88],[246.63,391.88],[245.63,393.13],[243.63,394.38],[242.38,395.88],[240.38,397.13],[239.13,398.63],[238.63,398.63],[237.38,400.13],[236.88,400.13],[231.38,405.38],[230.88,405.38],[223.13,412.88],[222.63,412.88],[217.38,418.38],[216.88,418.38],[208.38,427.13],[208.38,427.63],[205.63,430.13],[205.63,430.63],[201.13,435.38],[201.13,435.88],[198.38,438.88],[198.38,439.38],[196.13,441.88],[195.63,443.13],[194.88,443.63],[191.88,448.13],[191.63,449.13],[189.63,451.88],[185.63,460.38],[184.13,465.38],[183.88,468.38],[183.38,469.38],[181.38,470.88],[178.63,470.88],[176.63,469.38],[174.38,460.38],[170.38,451.88],[169.88,451.63],[168.13,448.13],[165.13,443.63],[164.38,443.13],[163.88,441.88],[161.63,439.38],[161.63,438.88],[158.88,435.88],[158.88,435.38],[157.38,434.13],[157.38,433.63],[155.88,432.38],[154.38,430.13],[151.63,427.63],[151.63,427.13],[146.88,422.63],[146.88,422.13],[133.88,409.63],[133.38,409.63],[123.13,400.13],[122.63,400.13],[119.63,397.13],[117.63,395.88],[116.38,394.38],[115.88,394.38],[114.88,393.13],[114.38,393.13],[113.38,391.88],[112.88,391.88],[111.88,390.63],[111.38,390.63],[110.38,389.38],[109.88,389.38],[108.63,387.88],[108.13,387.88],[107.13,386.63],[105.38,385.63],[104.38,384.38],[103.88,384.38],[95.38,376.88],[93.63,375.88],[92.38,374.38],[91.88,374.38],[84.38,367.63],[83.88,367.63],[82.63,366.13],[82.13,366.13],[80.88,364.63],[80.38,364.63],[78.88,362.88],[78.38,362.88],[76.88,361.13],[76.38,361.13],[72.38,357.13],[71.88,357.13],[53.88,339.63],[53.88,339.13],[46.88,331.88],[46.88,331.38],[42.38,326.38],[42.38,325.88],[41.38,325.13],[39.38,321.88],[37.88,320.38],[37.38,319.13],[35.88,317.63],[33.88,313.88],[31.13,310.13],[24.63,297.13],[21.38,288.13],[19.38,280.13],[18.38,273.63],[18.13,260.13],[18.63,255.13],[19.38,250.38],[21.38,242.63],[21.88,242.13],[23.63,236.63],[27.63,228.38],[28.63,227.38],[31.38,222.38],[32.88,220.88],[35.88,216.38],[38.13,214.38],[38.13,213.88],[40.63,211.63],[41.63,210.13],[42.13,210.13],[47.13,205.13],[50.63,202.88],[51.38,201.88],[58.13,197.38],[59.13,197.13],[59.38,196.63],[67.13,192.63],[77.13,188.88],[88.13,186.13]],[[96.88,193.13],[89.13,194.13],[79.13,196.63],[70.63,199.88],[63.63,203.38],[61.88,204.88],[57.38,207.38],[55.63,209.13],[52.13,211.38],[49.88,213.88],[49.38,213.88],[42.13,221.38],[42.13,221.88],[38.38,226.38],[35.88,230.88],[34.88,231.88],[31.13,239.38],[30.63,241.63],[28.88,245.63],[26.88,254.13],[26.13,260.38],[26.13,269.88],[27.13,277.88],[29.13,286.13],[33.63,297.63],[38.38,306.63],[39.38,307.63],[39.63,308.63],[41.13,310.38],[42.88,313.63],[47.63,319.63],[47.63,320.13],[49.88,322.38],[49.88,322.88],[53.13,326.38],[53.13,326.88],[57.13,330.88],[57.13,331.38],[69.13,343.63],[69.63,343.63],[79.13,352.88],[79.63,352.88],[83.38,356.63],[83.88,356.63],[85.38,358.38],[85.88,358.38],[92.38,364.38],[92.88,364.38],[93.88,365.63],[94.38,365.63],[95.38,366.88],[97.38,368.13],[98.63,369.63],[99.13,369.63],[100.13,370.88],[101.88,371.88],[102.88,373.13],[103.38,373.13],[104.38,374.38],[104.88,374.38],[105.88,375.63],[106.38,375.63],[107.38,376.88],[107.88,376.88],[111.88,380.63],[113.63,381.63],[114.88,383.13],[115.38,383.13],[120.88,388.13],[121.38,388.13],[122.63,389.63],[124.63,390.88],[129.63,395.63],[131.88,397.13],[133.63,399.13],[134.13,399.13],[135.88,401.13],[136.38,401.13],[138.38,403.38],[138.88,403.38],[145.63,410.13],[146.13,410.13],[158.13,422.38],[158.13,422.88],[160.63,425.13],[160.63,425.63],[162.13,426.88],[162.13,427.38],[163.63,428.63],[163.63,429.13],[167.88,433.88],[167.88,434.38],[168.63,434.88],[168.63,435.38],[169.38,435.88],[169.38,436.38],[170.13,436.88],[170.13,437.38],[170.88,437.88],[171.38,439.13],[172.13,439.63],[174.63,443.38],[180.13,453.38],[183.13,447.13],[183.63,446.88],[185.38,443.38],[187.88,439.63],[188.63,439.13],[189.13,437.88],[189.88,437.38],[192.13,433.88],[193.13,433.13],[193.13,432.63],[194.13,431.88],[194.13,431.38],[195.13,430.63],[195.13,430.13],[196.38,429.13],[196.38,428.63],[201.88,422.88],[201.88,422.38],[205.13,419.38],[205.13,418.88],[213.88,410.13],[214.38,410.13],[217.88,406.38],[218.38,406.38],[221.13,403.38],[221.63,403.38],[228.13,397.13],[228.63,397.13],[238.63,388.13],[239.13,388.13],[240.13,386.88],[240.63,386.88],[241.63,385.63],[242.13,385.63],[243.13,384.38],[245.13,383.13],[246.38,381.63],[248.13,380.63],[256.63,373.13],[257.13,373.13],[258.13,371.88],[258.63,371.88],[262.63,368.13],[263.13,368.13],[264.13,366.88],[264.63,366.88],[265.63,365.63],[267.63,364.38],[268.88,362.88],[269.38,362.88],[270.63,361.38],[271.13,361.38],[272.38,359.88],[274.63,358.38],[276.13,356.63],[276.63,356.63],[278.38,354.63],[278.88,354.63],[280.38,352.88],[280.88,352.88],[282.88,350.63],[283.38,350.63],[286.13,347.63],[286.63,347.63],[302.88,331.38],[302.88,330.88],[306.88,326.88],[306.88,326.38],[308.13,325.38],[308.13,324.88],[311.38,321.38],[311.38,320.88],[312.38,320.13],[314.38,316.88],[315.88,315.38],[320.38,308.63],[320.63,307.63],[321.63,306.63],[326.38,297.63],[326.38,296.88],[328.88,291.88],[330.13,287.38],[330.63,286.88],[332.63,279.13],[333.88,269.88],[333.88,260.38],[332.88,252.63],[331.13,245.63],[329.38,241.63],[328.88,239.38],[325.13,231.88],[324.13,230.88],[321.63,226.38],[317.88,221.88],[317.88,221.38],[307.88,211.38],[307.38,211.38],[301.13,206.38],[298.13,204.88],[296.38,203.38],[289.38,199.88],[277.63,195.63],[270.88,194.13],[263.38,193.13],[249.13,193.38],[242.63,194.38],[236.63,195.88],[226.13,199.88],[220.38,202.88],[220.13,203.38],[219.13,203.63],[213.88,207.13],[213.13,208.13],[212.63,208.13],[209.63,210.88],[209.13,210.88],[206.63,213.63],[206.13,213.63],[197.88,222.88],[192.38,231.13],[188.13,239.63],[185.63,246.63],[184.38,251.63],[183.88,256.88],[182.13,259.13],[179.38,259.63],[177.88,259.13],[176.13,256.88],[175.63,251.63],[174.38,246.63],[171.88,239.63],[167.63,231.13],[167.13,230.88],[166.88,229.88],[162.88,223.88],[160.13,220.88],[160.13,220.38],[150.88,210.88],[150.38,210.88],[148.38,208.88],[146.88,208.13],[146.13,207.13],[140.88,203.63],[139.88,203.38],[139.63,202.88],[131.63,198.88],[123.38,195.88],[117.38,194.38],[110.88,193.38]]]]
  },
  {
    // v0.8 content shard. Teaches two linked rings as parts and a single slow lane: each band is 22 units wide, so one lap down its middle at 175 units per second widens the ink to cover it and a faster lap leaves the edges bare. The link is two slits (the left ring is cut where the right ring passes over it at the bottom, the right ring where the left passes over at the top), so each ring is a C and a piece is two landings. Path (docs/games/ink/paths/two-rings.json): land on the left ring, hold a moment to widen, ride the centre of its band at 175, lift, land on the right ring, hold, ride it the other way.
    name: "Two Rings", timer: 12, boss: false, tier: "mid", perfect: 6.15, body: "shoulder", story: null,
    parts: [[[[204.6,319.4],[202.9,311.7],[200.6,304.2],[197.6,297.0],[193.9,290.0],[189.7,283.4],[184.9,277.1],[179.6,271.4],[173.9,266.1],[167.6,261.3],[161.0,257.1],[154.0,253.4],[146.8,250.4],[139.3,248.1],[131.6,246.4],[123.8,245.3],[116.0,245.0],[108.2,245.3],[100.4,246.4],[92.7,248.1],[85.2,250.4],[78.0,253.4],[71.0,257.1],[64.4,261.3],[58.1,266.1],[52.4,271.4],[47.1,277.1],[42.3,283.4],[38.1,290.0],[34.4,297.0],[31.4,304.2],[29.1,311.7],[27.4,319.4],[26.3,327.2],[26.0,335.0],[26.3,342.8],[27.4,350.6],[29.1,358.3],[31.4,365.8],[34.4,373.0],[38.1,380.0],[42.3,386.6],[47.1,392.9],[52.4,398.6],[58.1,403.9],[64.4,408.7],[71.0,412.9],[78.0,416.6],[85.2,419.6],[92.7,421.9],[100.4,423.6],[108.2,424.7],[116.0,425.0],[123.8,424.7],[131.6,423.6],[139.3,421.9],[146.8,419.6],[154.0,416.6],[161.0,412.9],[167.6,408.7],[173.9,403.9],[176.1,401.9],[170.8,396.1],[166.0,389.9],[162.5,384.5],[159.7,387.1],[155.0,390.7],[150.0,393.9],[144.7,396.6],[139.3,398.9],[133.6,400.7],[127.8,402.0],[121.9,402.7],[116.0,403.0],[110.1,402.7],[104.2,402.0],[98.4,400.7],[92.7,398.9],[87.3,396.6],[82.0,393.9],[77.0,390.7],[72.3,387.1],[67.9,383.1],[63.9,378.7],[60.3,374.0],[57.1,369.0],[54.4,363.7],[52.1,358.3],[50.3,352.6],[49.0,346.8],[48.3,340.9],[48.0,335.0],[48.3,329.1],[49.0,323.2],[50.3,317.4],[52.1,311.7],[54.4,306.3],[57.1,301.0],[60.3,296.0],[63.9,291.3],[67.9,286.9],[72.3,282.9],[77.0,279.3],[82.0,276.1],[87.3,273.4],[92.7,271.1],[98.4,269.3],[104.2,268.0],[110.1,267.3],[116.0,267.0],[121.9,267.3],[127.8,268.0],[133.6,269.3],[139.3,271.1],[144.7,273.4],[150.0,276.1],[155.0,279.3],[159.7,282.9],[164.1,286.9],[168.1,291.3],[171.7,296.0],[174.9,301.0],[177.6,306.3],[179.9,311.7],[181.7,317.4],[183.0,323.2],[183.7,329.1],[184.0,335.0],[183.7,340.9],[182.8,347.7],[183.5,351.2],[185.2,356.4],[187.3,361.5],[189.8,366.3],[192.7,370.9],[196.3,375.5],[197.6,373.0],[200.6,365.8],[202.9,358.3],[204.6,350.6],[205.7,342.8],[206.0,335.0],[205.7,327.2]]],[[[332.6,319.4],[330.9,311.7],[328.6,304.2],[325.6,297.0],[321.9,290.0],[317.7,283.4],[312.9,277.1],[307.6,271.4],[301.9,266.1],[295.6,261.3],[289.0,257.1],[282.0,253.4],[274.8,250.4],[267.3,248.1],[259.6,246.4],[251.8,245.3],[244.0,245.0],[236.2,245.3],[228.4,246.4],[220.7,248.1],[213.2,250.4],[206.0,253.4],[199.0,257.1],[192.4,261.3],[186.1,266.1],[183.9,268.1],[189.2,273.9],[194.0,280.1],[197.5,285.5],[200.3,282.9],[205.0,279.3],[210.0,276.1],[215.3,273.4],[220.7,271.1],[226.4,269.3],[232.2,268.0],[238.1,267.3],[244.0,267.0],[249.9,267.3],[255.8,268.0],[261.6,269.3],[267.3,271.1],[272.7,273.4],[278.0,276.1],[283.0,279.3],[287.7,282.9],[292.1,286.9],[296.1,291.3],[299.7,296.0],[302.9,301.0],[305.6,306.3],[307.9,311.7],[309.7,317.4],[311.0,323.2],[311.7,329.1],[312.0,335.0],[311.7,340.9],[311.0,346.8],[309.7,352.6],[307.9,358.3],[305.6,363.7],[302.9,369.0],[299.7,374.0],[296.1,378.7],[292.1,383.1],[287.7,387.1],[283.0,390.7],[278.0,393.9],[272.7,396.6],[267.3,398.9],[261.6,400.7],[255.8,402.0],[249.9,402.7],[244.0,403.0],[238.1,402.7],[232.2,402.0],[226.4,400.7],[220.7,398.9],[215.3,396.6],[210.0,393.9],[205.0,390.7],[200.3,387.1],[195.9,383.1],[191.9,378.7],[188.3,374.0],[185.1,369.0],[182.4,363.7],[180.1,358.3],[178.3,352.6],[177.0,346.8],[176.3,340.9],[176.0,335.0],[176.3,329.1],[177.2,322.3],[176.5,318.8],[174.8,313.6],[172.7,308.5],[170.2,303.7],[167.3,299.1],[163.7,294.5],[162.4,297.0],[159.4,304.2],[157.1,311.7],[155.4,319.4],[154.3,327.2],[154.0,335.0],[154.3,342.8],[155.4,350.6],[157.1,358.3],[159.4,365.8],[162.4,373.0],[166.1,380.0],[170.3,386.6],[175.1,392.9],[180.4,398.6],[186.1,403.9],[192.4,408.7],[199.0,412.9],[206.0,416.6],[213.2,419.6],[220.7,421.9],[228.4,423.6],[236.2,424.7],[244.0,425.0],[251.8,424.7],[259.6,423.6],[267.3,421.9],[274.8,419.6],[282.0,416.6],[289.0,412.9],[295.6,408.7],[301.9,403.9],[307.6,398.6],[312.9,392.9],[317.7,386.6],[321.9,380.0],[325.6,373.0],[328.6,365.8],[330.9,358.3],[332.6,350.6],[333.7,342.8],[334.0,335.0],[333.7,327.2]]]]
  },
  {
    // v0.8 content shard. Teaches a thin sole beside a big body: a winged running shoe in three parts, the upper (three lace slots as holes), the sole under it and the wing behind the heel, each 5.4 units from the next. Path (docs/games/ink/paths/winged-shoe.json): land in the upper, lap it 5.5 inside, fill it in rows 17 apart at 280 and loop the lace slots, lift to the sole, hold a moment and ride one slow lane from heel to toe at 175, lift to the wing, lap it and fill the middle.
    name: "Winged Shoe", timer: 28, boss: false, tier: "mid", perfect: 14.62, body: "calf", story: null,
    parts: [[[[161.9,473.8],[182.6,473.2],[202.0,473.0],[240.2,473.5],[276.9,473.4],[304.6,472.5],[315.3,471.8],[324.3,470.9],[331.5,469.7],[337.0,468.0],[340.3,465.8],[341.4,463.1],[341.1,460.2],[337.6,450.9],[335.9,447.6],[333.8,444.2],[331.1,441.0],[328.0,438.0],[324.3,435.3],[320.1,432.9],[315.4,430.6],[300.5,423.7],[278.5,414.0],[259.6,404.9],[253.2,401.5],[234.2,390.6],[228.0,386.6],[222.5,382.4],[218.2,378.0],[215.3,373.0],[213.7,367.5],[212.0,356.5],[211.0,352.0],[208.3,342.2],[207.2,339.8],[205.6,338.0],[203.3,336.6],[200.5,335.6],[197.4,335.1],[194.2,335.2],[191.2,336.0],[188.3,337.7],[185.4,340.4],[176.8,350.0],[174.2,353.5],[169.4,361.4],[166.9,364.4],[164.2,366.0],[161.2,365.5],[158.1,363.3],[151.4,357.6],[148.0,356.0],[144.4,355.4],[140.7,355.4],[136.9,355.8],[133.3,356.6],[130.0,358.0],[127.0,359.9],[124.3,362.3],[121.8,365.1],[119.5,368.4],[117.4,372.0],[115.5,376.0],[113.9,380.4],[112.4,385.2],[111.2,390.4],[110.2,396.0],[108.8,408.6],[108.5,415.5],[108.4,430.0],[107.4,438.2],[105.3,447.3],[104.1,456.4],[105.7,464.3],[112.0,470.0],[124.5,473.0],[141.8,474.0]],[[234.3,429.0],[232.9,429.7],[231.4,429.8],[229.9,429.2],[228.2,428.2],[227.5,427.8],[226.6,426.5],[226.2,425.0],[226.4,423.4],[237.5,404.9],[238.1,404.4],[239.5,403.7],[241.0,403.7],[241.8,403.8],[244.2,405.2],[245.4,406.3],[246.1,407.7],[246.2,408.4],[246.0,410.0],[235.4,427.9]],[[262.8,443.5],[261.7,444.5],[260.2,445.0],[258.6,444.9],[256.1,443.8],[254.9,442.8],[254.4,442.2],[253.9,440.7],[254.0,439.1],[263.6,419.8],[264.1,419.2],[265.4,418.5],[266.2,418.3],[267.8,418.4],[270.3,419.5],[271.5,420.5],[272.3,421.8],[272.5,423.4],[272.4,424.2]],[[290.8,455.4],[289.9,456.7],[288.6,457.5],[287.1,457.8],[285.6,457.5],[283.1,456.3],[282.0,455.2],[281.4,453.8],[281.4,452.2],[289.9,432.4],[290.5,431.8],[291.8,430.9],[292.5,430.7],[294.1,430.8],[296.7,431.8],[297.9,432.7],[298.8,434.0],[299.1,435.5],[299.0,436.3]]],[[[101.9,482.2],[101.3,488.6],[103.9,495.2],[108.4,500.0],[114.9,502.4],[123.8,503.4],[163.7,504.3],[201.2,504.2],[257.7,503.5],[275.9,503.0],[292.0,502.0],[305.9,500.6],[318.3,498.9],[328.8,496.7],[337.0,494.0],[342.5,490.5],[345.6,486.2],[347.0,481.9],[347.8,478.0],[347.8,474.2],[346.7,470.5],[345.3,468.4],[343.9,470.2],[339.6,473.0],[333.1,475.0],[324.8,476.5],[315.7,477.4],[304.9,478.1],[272.3,479.2],[238.0,480.0],[183.3,480.2],[166.0,480.0],[155.9,479.5],[141.5,479.6],[123.6,478.6],[116.6,476.9],[106.6,478.0]]],[[[57.7,346.7],[46.3,341.0],[35.5,336.2],[21.5,330.5],[20.5,330.3],[19.6,330.5],[18.8,331.1],[18.2,331.9],[18.1,333.1],[18.5,334.3],[27.5,346.4],[34.8,355.9],[42.3,364.7],[50.4,373.1],[59.0,380.7],[68.5,387.6],[78.5,393.5],[88.9,398.4],[98.7,401.9],[100.2,402.0],[101.2,401.5],[104.3,397.4],[105.7,389.4],[107.1,383.6],[108.6,378.4],[112.2,369.7],[112.5,364.4],[111.8,348.3],[110.0,332.4],[107.0,316.7],[103.1,301.1],[98.3,285.7],[93.0,270.3],[85.7,250.3],[85.0,249.3],[84.0,248.7],[82.8,248.7],[81.9,249.1],[81.2,249.8],[80.9,250.7],[79.3,272.2],[78.5,288.4],[78.2,304.6],[78.7,320.7],[79.3,327.3],[72.2,317.9],[63.0,306.9],[53.2,296.1],[40.0,282.3],[39.0,281.7],[37.5,281.7],[36.5,282.3],[35.8,283.3],[35.8,284.5],[37.1,289.1],[41.2,303.1],[45.6,317.0],[50.6,330.6],[56.1,343.6]]]]
  },
  {
    // v0.8 content shard. Six letters on a banner: seven landings with a lift over every gap, and a banner ring around them. Path: land on each letter, ride its strokes at 220, lift, then lap the banner.
    name: "ENCORE", noMirror: true, timer: 17, boss: false, tier: "mid", perfect: 8.63, body: "back", story: null,
    parts: [[[[53.88,301.88],[82.88,301.88],[85.13,302.63],[86.13,303.63],[86.88,305.88],[86.63,307.38],[86.13,308.38],[84.13,309.88],[57.88,310.13],[57.88,325.88],[77.88,325.88],[80.38,326.63],[81.88,328.63],[81.88,331.38],[81.38,332.38],[79.38,333.88],[57.88,334.13],[57.88,349.88],[84.13,350.13],[86.13,351.63],[86.88,353.88],[86.63,355.38],[85.13,357.38],[82.88,358.13],[53.88,358.13],[51.63,357.38],[50.38,356.13],[49.88,354.63],[49.88,305.38],[50.38,303.88],[51.63,302.63]]],[[[94.88,302.13],[97.63,302.13],[99.63,303.63],[123.13,340.13],[123.38,305.38],[123.88,303.88],[126.13,302.13],[128.88,302.13],[130.88,303.63],[131.38,304.63],[131.38,355.38],[129.88,357.38],[128.88,357.88],[126.13,357.88],[123.88,356.13],[123.13,354.38],[120.13,350.38],[119.88,349.38],[116.88,345.38],[116.63,344.38],[113.63,340.38],[113.38,339.38],[110.38,335.38],[110.13,334.38],[107.13,330.38],[106.88,329.38],[103.88,325.38],[103.63,324.38],[100.63,319.88],[100.13,355.38],[99.63,356.38],[97.63,357.88],[94.88,357.88],[92.88,356.38],[92.38,355.38],[92.38,304.63],[92.88,303.63]]],[[[155.63,302.13],[160.63,302.13],[162.88,302.63],[167.88,304.88],[172.63,309.13],[175.38,313.38],[175.38,315.88],[174.88,316.88],[173.13,318.38],[170.63,318.63],[168.63,317.63],[166.38,314.13],[163.13,311.38],[159.63,310.13],[156.38,310.13],[153.38,311.38],[150.38,313.88],[150.38,314.38],[149.13,315.38],[148.88,316.38],[147.88,317.38],[146.13,321.63],[144.88,329.38],[145.63,336.38],[147.88,342.63],[151.88,347.63],[156.38,349.88],[160.88,349.63],[163.13,348.63],[164.88,346.88],[165.38,346.88],[168.38,343.13],[168.38,342.63],[170.63,341.38],[173.63,341.88],[175.38,344.13],[175.13,347.38],[173.13,349.63],[172.63,350.88],[170.38,353.13],[169.88,353.13],[167.88,355.13],[164.88,356.38],[164.63,356.88],[160.63,357.88],[155.63,357.88],[151.38,356.63],[146.88,353.88],[143.63,350.63],[141.13,346.88],[140.88,345.88],[140.38,345.63],[138.38,340.63],[137.13,334.13],[136.88,329.13],[137.38,323.88],[138.38,319.38],[140.38,314.38],[140.88,314.13],[141.13,313.13],[143.63,309.38],[146.88,306.13],[151.38,303.38]]],[[[199.88,302.13],[206.38,302.38],[209.13,303.38],[213.38,305.88],[216.88,309.38],[217.38,310.63],[219.13,312.63],[221.13,316.63],[223.38,325.38],[223.63,330.63],[222.63,338.63],[221.13,343.38],[219.13,347.38],[217.38,349.38],[216.88,350.63],[213.38,354.13],[209.13,356.63],[204.63,357.88],[198.13,357.63],[195.38,356.63],[191.13,354.13],[187.63,350.63],[187.13,349.38],[185.38,347.38],[183.38,343.38],[181.13,334.63],[180.88,329.38],[181.88,321.38],[183.38,316.63],[185.38,312.63],[187.13,310.63],[187.63,309.38],[191.13,305.88],[195.38,303.38]],[[200.63,310.13],[198.88,310.63],[195.88,312.38],[192.63,316.13],[190.63,320.13],[189.13,326.13],[189.13,333.88],[190.63,339.88],[193.88,345.63],[195.88,347.63],[198.88,349.38],[200.38,349.88],[204.13,349.88],[208.63,347.63],[211.88,343.88],[213.63,340.38],[215.38,333.88],[215.38,326.13],[213.63,319.63],[210.63,314.38],[208.63,312.38],[205.63,310.63],[204.13,310.13]]],[[[233.13,301.88],[250.88,301.88],[254.63,302.38],[257.38,303.38],[260.63,305.38],[264.63,310.13],[266.13,313.63],[266.63,316.13],[266.63,321.88],[265.88,324.88],[263.38,329.63],[260.13,332.88],[257.13,334.63],[255.13,335.13],[255.13,335.88],[255.88,336.38],[258.63,340.63],[259.38,341.13],[262.88,346.38],[267.13,351.63],[267.63,352.63],[267.63,355.38],[266.13,357.38],[265.13,357.88],[262.38,357.88],[260.38,356.38],[260.38,355.88],[259.63,355.38],[259.63,354.88],[258.88,354.38],[258.88,353.88],[258.13,353.38],[256.13,350.13],[255.38,349.63],[255.38,349.13],[254.63,348.63],[254.63,348.13],[253.88,347.63],[253.88,347.13],[253.13,346.63],[251.88,344.38],[251.13,343.88],[251.13,343.38],[250.38,342.88],[250.38,342.38],[249.63,341.88],[249.63,341.38],[248.88,340.88],[248.88,340.38],[248.13,339.88],[247.63,338.63],[245.38,335.88],[237.13,335.88],[236.88,355.38],[236.38,356.38],[234.38,357.88],[231.63,357.88],[229.63,356.38],[229.13,355.38],[229.13,304.63],[230.63,302.63]],[[237.38,310.13],[237.13,327.88],[252.13,327.88],[255.13,326.63],[256.88,324.88],[258.63,321.13],[258.63,316.88],[257.63,314.13],[255.13,311.38],[252.63,310.13]]],[[[277.13,301.88],[306.13,301.88],[308.38,302.63],[309.63,303.88],[310.13,305.38],[309.88,307.63],[308.38,309.38],[307.38,309.88],[281.13,310.13],[281.13,325.88],[301.13,325.88],[303.63,326.63],[305.13,328.63],[305.13,331.38],[304.63,332.38],[302.63,333.88],[281.13,334.13],[281.13,349.88],[307.38,350.13],[309.63,351.88],[310.13,353.38],[309.88,355.63],[308.38,357.38],[306.13,358.13],[277.13,358.13],[274.88,357.38],[273.88,356.38],[273.13,354.13],[273.13,305.88],[273.88,303.63],[274.88,302.63]]],[[[41.38,284.88],[320.88,285.13],[323.38,286.13],[325.38,287.88],[326.88,291.13],[327.13,293.88],[346.38,294.13],[349.63,295.63],[350.88,296.88],[351.88,299.13],[351.63,304.13],[342.63,337.38],[342.88,342.13],[351.63,373.88],[351.88,378.88],[350.88,381.13],[349.63,382.38],[346.38,383.88],[327.38,384.13],[323.63,383.38],[320.63,381.13],[319.13,377.88],[318.88,375.13],[41.13,375.13],[40.88,377.88],[39.38,381.13],[37.38,382.88],[34.88,383.88],[13.63,383.88],[11.38,383.13],[9.13,381.13],[8.13,378.88],[8.13,375.13],[17.13,342.13],[17.38,337.38],[8.38,304.13],[8.13,299.13],[9.13,296.88],[10.38,295.63],[13.63,294.13],[32.88,293.88],[33.13,291.13],[34.63,287.88],[37.63,285.63]],[[41.38,293.13],[40.88,293.63],[40.88,295.88],[39.88,298.38],[38.13,300.38],[36.38,301.38],[32.63,302.13],[16.38,302.13],[23.88,331.13],[24.38,331.88],[25.38,336.88],[25.38,341.13],[24.88,344.13],[16.38,375.88],[32.88,375.88],[33.13,373.13],[34.63,369.88],[37.63,367.63],[41.38,366.88],[318.63,366.88],[322.38,367.63],[325.38,369.88],[326.88,373.13],[327.13,375.88],[343.63,375.88],[336.13,346.88],[335.63,346.13],[334.63,341.13],[334.63,336.88],[335.13,333.88],[343.63,302.13],[327.38,302.13],[323.63,301.38],[321.88,300.38],[320.13,298.38],[319.13,295.88],[318.88,293.13]]]]
  },
  {
    // v0.8 content shard. Teaches the hollow inner flame and three landings: a fast sweep slips in the hole and across the gaps. Path: land in the left flame and lap it 6 inside at 175, lift to the big flame and lap it 6 inside both its outer edge and the inner flame, lift to the right flame.
    name: "Flame", timer: 32, boss: false, tier: "mid", perfect: 16.67, body: "shoulder", story: null,
    parts: [[[[203.8,116.0],[221.1,148.9],[226.8,160.2],[232.3,172.0],[237.7,184.4],[245.6,203.9],[253.2,224.1],[268.1,266.7],[272.8,281.6],[277.0,296.7],[278.7,304.3],[281.4,319.8],[283.4,335.9],[284.8,352.2],[285.1,360.4],[285.2,368.5],[284.6,384.4],[282.8,399.5],[281.5,406.9],[279.9,414.2],[278.0,421.4],[273.6,435.5],[271.0,442.3],[268.1,449.1],[265.1,455.6],[261.8,462.0],[258.1,468.3],[254.0,474.6],[249.6,480.8],[240.0,492.8],[235.0,498.4],[225.1,508.9],[211.4,522.0],[202.9,529.6],[198.7,533.0],[194.6,536.0],[190.5,538.6],[186.3,540.8],[182.1,542.5],[177.8,543.6],[173.4,544.0],[168.9,543.8],[164.3,542.9],[159.6,541.4],[154.8,539.4],[150.0,537.0],[145.2,534.2],[140.5,531.0],[131.6,523.8],[127.4,520.0],[123.4,515.9],[119.4,511.4],[115.4,506.5],[107.9,495.9],[104.3,490.2],[101.0,484.3],[95.0,472.2],[92.5,466.0],[90.2,459.6],[88.1,453.0],[86.3,446.1],[84.7,439.0],[82.1,424.5],[80.4,410.0],[79.6,396.0],[79.6,389.2],[79.9,382.3],[80.5,375.3],[82.4,361.6],[84.8,348.4],[88.8,330.0],[90.2,324.4],[93.6,314.1],[101.0,295.4],[104.1,286.5],[105.4,282.0],[107.4,273.2],[109.6,260.5],[110.8,248.2],[110.9,240.0],[110.6,235.9],[109.2,227.7],[106.0,215.6],[104.3,207.7],[103.7,203.8],[103.5,200.0],[103.7,196.2],[104.6,188.9],[110.9,164.0],[140.3,214.0],[160.1,185.4],[181.9,152.9],[190.2,139.6]],[[144.8,247.7],[144.4,255.5],[143.2,265.6],[141.6,275.6],[138.4,289.9],[136.9,295.6],[134.5,302.8],[125.5,325.7],[123.0,333.6],[119.4,349.1],[117.0,361.1],[115.0,373.0],[114.3,378.8],[113.6,389.9],[113.8,401.0],[114.9,413.3],[117.9,431.9],[120.8,443.6],[124.2,453.8],[126.2,458.5],[128.4,463.3],[133.5,472.8],[136.4,477.3],[142.3,485.7],[145.3,489.4],[151.1,495.6],[157.2,501.0],[163.5,505.5],[169.0,508.5],[172.3,509.8],[175.4,507.9],[181.0,503.5],[192.5,493.2],[205.3,480.5],[214.1,470.7],[222.3,460.5],[229.1,450.5],[231.9,445.7],[237.0,435.2],[241.5,424.0],[245.2,412.3],[248.1,400.2],[250.1,387.9],[251.1,375.2],[251.2,368.4],[250.8,354.1],[249.6,339.4],[247.8,324.8],[245.4,311.2],[242.2,298.1],[238.1,284.5],[223.6,242.3],[218.8,229.1],[208.9,203.7],[201.1,185.5],[183.6,211.2],[168.3,233.3],[166.2,236.0],[163.9,238.5],[161.3,240.8],[155.6,244.4],[152.4,245.8],[149.2,246.8]]],[[[40.0,408.0],[31.6,423.6],[27.6,431.6],[24.0,440.0],[19.0,453.6],[16.2,463.2],[15.1,468.1],[14.3,473.0],[14.0,478.0],[14.0,483.2],[15.0,494.2],[17.0,505.4],[20.1,515.6],[22.0,520.0],[24.3,524.3],[27.1,528.9],[30.2,533.3],[33.5,537.4],[36.9,540.8],[40.2,543.2],[43.3,544.4],[46.0,544.0],[48.5,541.8],[51.1,537.9],[53.6,532.7],[56.0,526.5],[58.1,519.8],[59.9,512.9],[61.2,506.2],[62.0,500.0],[62.2,494.2],[61.8,488.2],[61.0,482.1],[59.9,476.0],[52.5,446.3],[49.2,435.2]]],[[[318.0,380.0],[304.2,397.9],[298.8,405.7],[290.2,419.3],[284.2,429.2],[278.7,440.1],[276.2,445.9],[274.0,452.0],[270.0,465.8],[266.4,481.2],[265.0,489.0],[264.1,496.5],[263.7,503.6],[264.0,510.0],[265.0,516.0],[266.6,522.0],[268.7,527.7],[271.2,533.1],[274.2,538.0],[277.3,542.2],[280.6,545.6],[284.0,548.0],[287.7,549.5],[291.9,550.2],[296.4,550.2],[301.1,549.5],[305.8,548.1],[310.3,546.0],[314.4,543.3],[318.0,540.0],[321.2,535.8],[324.1,530.7],[326.8,524.8],[329.2,518.2],[331.4,511.3],[333.3,504.2],[334.8,497.0],[336.0,490.0],[336.8,482.9],[337.2,475.5],[337.3,467.8],[337.1,460.0],[336.0,444.5],[334.0,430.0],[332.7,423.3],[331.0,416.8],[329.0,410.5],[320.1,386.2]]]]
  },
  {
    // v0.8 content shard. Teaches crossing like Bones: one axe whole, the other cut in two by a 5 unit slit either side of it, so three landings. Path: land on the cut axe's head and lap it 6 inside at 175 with rows over the blade, lift to the whole axe and lap its handle and head the same way, then lift to the cut axe's lower handle.
    name: "Crossed Axes", timer: 31, boss: false, tier: "mid", perfect: 15.83, body: "shoulder", story: null,
    parts: [[[[117.5,234.0],[84.7,287.8],[75.7,281.9],[56.0,270.9],[51.4,268.1],[47.0,265.1],[42.9,262.0],[39.3,258.7],[36.3,255.1],[33.9,251.2],[32.2,247.1],[31.1,242.6],[30.6,237.9],[30.5,233.0],[30.8,228.0],[31.4,222.8],[34.6,201.7],[35.4,191.5],[100.8,199.7],[135.0,187.8],[148.0,214.4],[135.5,222.5],[245.3,447.6],[273.2,497.7],[276.8,519.6],[263.5,526.1],[248.5,509.8],[226.2,456.9]]],[[[242.5,234.0],[275.3,287.8],[284.3,281.9],[304.0,270.9],[308.6,268.1],[313.0,265.1],[317.1,262.0],[320.7,258.7],[323.7,255.1],[326.1,251.2],[327.8,247.1],[328.9,242.6],[329.4,237.9],[329.5,233.0],[329.2,228.0],[327.9,217.6],[325.4,201.7],[324.6,191.5],[259.2,199.7],[225.0,187.8],[212.0,214.4],[224.5,222.5],[183.2,307.3],[195.0,331.5]]],[[[114.7,447.6],[86.8,497.7],[83.2,519.6],[96.5,526.1],[111.5,509.8],[133.8,456.9],[176.8,368.7],[165.0,344.5]]]]
  },
  {
    // v0.8 content shard. A fuller rose in seven parts: the bud, two inner petals, two outer petals, the stem and a leaf, each cut off by a 5.8 unit slit so the finger lifts between them and every petal is a landing. Path: land in the bud and lap it 6 inside at 175, ring each petal in turn and fill it in rows 15 apart at 270, then ride the stem's centre line top to bottom after a 0.5 s hold and finish on the leaf.
    name: "Rose for Elsie", timer: 37, boss: false, tier: "mid", perfect: 19.38, body: "forearm", story: null,
    parts: [[[[213.3,220.2],[211.9,225.8],[210.0,231.2],[207.6,236.2],[204.8,240.9],[201.7,245.1],[198.3,248.8],[194.6,251.9],[190.7,254.4],[186.8,256.1],[182.8,257.2],[178.8,257.5],[174.9,257.0],[171.1,255.9],[167.6,254.0],[164.3,251.4],[161.4,248.2],[158.9,244.3],[156.8,240.0],[155.2,235.3],[154.0,230.1],[153.4,224.7],[153.3,219.1],[153.7,213.4],[154.7,207.8],[156.1,202.2],[158.0,196.8],[160.4,191.8],[163.2,187.1],[166.3,182.9],[169.7,179.2],[173.4,176.1],[177.3,173.6],[181.2,171.9],[185.2,170.8],[189.2,170.5],[193.1,171.0],[196.9,172.1],[200.4,174.0],[203.7,176.6],[206.6,179.8],[209.1,183.7],[211.2,188.0],[212.8,192.7],[214.0,197.9],[214.6,203.3],[214.7,208.9],[214.3,214.6]]],[[[201.3,148.6],[192.9,146.8],[184.2,146.2],[175.6,147.0],[167.0,149.1],[158.7,152.5],[150.8,157.1],[143.5,162.9],[136.8,169.7],[130.8,177.4],[125.8,186.0],[121.7,195.1],[118.6,204.8],[116.6,214.8],[115.8,225.0],[116.1,235.1],[117.5,245.1],[120.0,254.7],[123.5,263.7],[128.1,272.1],[133.6,279.7],[139.9,286.3],[147.0,291.8],[149.2,293.1],[150.1,285.2],[150.9,280.1],[152.0,275.2],[153.3,270.8],[155.0,267.0],[157.0,263.8],[159.1,261.1],[162.6,257.4],[160.4,255.6],[157.1,252.0],[153.7,246.9],[151.3,241.9],[149.7,237.1],[148.3,230.8],[147.6,224.8],[147.5,218.7],[147.9,213.0],[149.0,206.3],[150.5,200.7],[152.6,194.9],[155.4,188.8],[158.2,184.1],[161.6,179.4],[166.0,174.7],[169.7,171.6],[174.1,168.7],[179.8,166.2],[184.3,165.1],[188.8,164.7],[194.4,165.3],[199.8,167.1],[201.3,160.5],[203.3,149.4]]],[[[247.9,212.9],[246.5,202.9],[244.0,193.3],[240.5,184.3],[235.9,175.9],[230.4,168.3],[224.1,161.7],[217.0,156.2],[208.9,151.6],[207.0,161.7],[204.9,170.2],[207.6,172.4],[211.2,176.3],[214.0,180.4],[216.4,185.4],[218.5,191.5],[219.7,197.2],[220.4,202.6],[220.5,208.8],[220.0,215.5],[219.1,221.2],[217.5,227.3],[215.4,233.1],[212.6,239.2],[209.8,243.9],[206.4,248.6],[202.0,253.3],[198.3,256.4],[193.9,259.3],[188.7,261.6],[183.7,262.9],[178.6,263.3],[174.2,262.8],[169.4,261.4],[167.7,260.6],[165.5,262.8],[163.5,264.9],[161.7,267.2],[160.1,269.9],[158.7,273.0],[156.6,281.1],[154.7,296.3],[162.7,299.4],[171.1,301.2],[179.8,301.8],[188.4,301.0],[197.0,298.9],[205.3,295.5],[213.2,290.9],[220.5,285.1],[227.2,278.3],[233.2,270.6],[238.2,262.0],[242.3,252.9],[245.4,243.2],[247.4,233.2],[248.2,223.0]]],[[[88.8,248.5],[89.5,250.1],[89.7,251.8],[88.5,257.5],[88.0,263.9],[88.5,270.4],[90.0,276.9],[92.3,282.9],[95.7,288.8],[99.9,294.3],[104.8,299.2],[110.5,303.6],[117.2,307.4],[124.0,310.2],[131.2,312.3],[138.6,313.6],[146.2,314.0],[153.4,313.6],[160.8,312.3],[168.0,310.2],[175.0,307.3],[170.3,307.0],[161.5,305.0],[152.1,301.5],[143.4,296.4],[135.7,290.3],[129.4,283.7],[123.0,274.9],[118.1,265.9],[114.4,256.1],[111.7,245.9],[110.3,235.9],[110.0,224.5],[110.9,214.3],[112.9,203.7],[116.1,193.4],[120.8,183.0],[125.8,174.5],[132.2,166.2],[139.3,158.8],[147.9,152.1],[155.8,147.5],[157.4,146.8],[155.1,142.3],[153.0,137.1],[151.2,130.7],[150.5,126.9],[148.2,128.5],[143.4,132.5],[138.9,137.4],[136.5,140.6],[134.6,141.8],[132.4,142.3],[127.8,142.0],[120.9,142.5],[113.7,144.1],[106.4,146.8],[99.8,150.4],[93.8,155.0],[88.3,160.3],[83.5,166.4],[79.4,173.2],[76.2,180.4],[74.0,187.8],[72.5,195.7],[72.0,203.8],[72.5,212.3],[74.0,220.2],[76.2,227.6],[79.4,234.8],[83.5,241.6]]],[[[164.8,143.8],[174.6,141.3],[184.6,140.4],[193.7,141.0],[202.5,143.0],[211.9,146.5],[220.6,151.6],[228.3,157.7],[235.1,164.9],[241.0,173.1],[245.6,181.5],[249.6,191.9],[252.3,202.1],[253.7,212.7],[254.0,223.5],[253.0,234.3],[250.9,244.9],[247.6,255.2],[243.5,264.4],[238.2,273.5],[231.8,281.8],[224.7,289.2],[216.7,295.4],[208.2,300.5],[199.2,304.2],[191.1,306.3],[191.3,311.1],[194.0,312.2],[200.8,314.2],[208.6,315.6],[216.2,316.0],[223.7,315.5],[231.2,314.2],[238.0,312.2],[244.8,309.4],[251.5,305.6],[256.9,301.5],[261.9,296.6],[266.3,290.8],[269.7,284.9],[272.0,278.8],[273.5,272.5],[274.0,266.0],[273.5,259.5],[272.0,252.9],[272.2,250.6],[272.9,249.0],[276.9,243.6],[280.7,237.2],[283.8,229.9],[286.2,221.9],[287.5,213.9],[288.0,205.8],[287.5,197.7],[286.1,189.8],[283.9,182.4],[280.8,175.2],[276.9,168.4],[272.3,162.3],[267.0,157.0],[260.8,152.2],[254.5,148.6],[247.8,146.1],[240.9,144.5],[234.0,144.0],[229.0,144.3],[227.3,144.1],[226.3,143.6],[224.5,142.2],[221.1,137.4],[216.9,132.8],[211.5,128.2],[205.8,124.6],[200.1,121.9],[193.6,119.8],[186.6,118.4],[179.8,118.0],[173.4,118.4],[166.4,119.8],[160.3,121.7],[155.9,123.8],[156.8,129.4],[157.6,132.6],[159.4,137.7],[162.7,144.6]]],[[[171.5,337.4],[167.7,380.2],[167.3,393.4],[167.5,400.2],[168.0,407.3],[168.9,414.7],[170.0,421.7],[175.2,449.5],[176.2,456.5],[177.0,463.4],[177.5,470.4],[177.7,477.5],[177.6,484.9],[176.9,500.1],[173.5,548.3],[173.7,550.0],[174.3,551.6],[175.1,553.0],[176.2,554.2],[179.1,556.0],[180.7,556.4],[182.3,556.5],[184.8,556.0],[186.3,555.3],[187.6,554.4],[188.8,553.1],[189.6,551.7],[190.4,549.3],[193.9,501.2],[194.6,485.4],[194.7,477.3],[194.5,469.4],[194.0,462.1],[193.1,454.4],[192.0,446.7],[185.7,412.2],[184.5,399.6],[184.3,393.4],[184.7,381.3],[185.6,369.3],[188.5,338.6],[188.3,336.1],[187.4,333.8],[186.4,332.5],[185.2,331.3],[183.8,330.4],[182.3,329.8],[180.6,329.5],[177.3,329.9],[175.8,330.6],[174.5,331.6],[173.3,332.8],[172.1,334.9]]],[[[198.9,454.0],[208.1,461.4],[213.2,464.8],[215.9,466.2],[218.8,467.3],[222.0,468.0],[225.4,468.4],[233.0,468.6],[237.1,468.3],[245.5,467.2],[249.7,466.3],[258.0,463.7],[262.0,462.0],[266.0,460.0],[274.2,455.1],[278.3,452.2],[286.3,445.9],[293.7,439.0],[300.0,432.0],[302.6,428.4],[304.9,424.6],[306.9,420.7],[310.2,412.6],[314.7,400.2],[318.0,392.0],[290.3,396.1],[276.5,398.8],[262.9,402.7],[253.7,405.7],[244.6,409.2],[236.0,413.2],[231.9,415.5],[228.0,418.0],[224.3,420.8],[220.8,423.8],[214.3,430.4],[198.3,449.5]]]]
  },
  {
    // v0.8 content shard. Her name in a slanted hand on a banner: leaning strokes tucked close, five landings and a banner ring. Path: land on each letter, ride its strokes at 220, lift, then lap the banner.
    name: "ELSIE", noMirror: true, timer: 17, boss: false, tier: "mid", perfect: 8.43, body: "forearm", story: null,
    parts: [[[[81.63,295.88],[117.63,295.88],[119.13,296.13],[121.13,297.63],[121.63,298.63],[121.63,301.38],[120.13,303.38],[117.63,304.13],[84.63,304.13],[83.63,306.63],[83.63,307.63],[77.63,325.88],[102.13,325.88],[104.13,326.38],[104.63,327.13],[105.13,327.13],[106.13,329.13],[106.13,330.88],[105.13,332.88],[104.63,332.88],[104.13,333.63],[102.13,334.13],[74.88,334.13],[68.13,355.88],[98.63,355.88],[100.88,356.63],[101.88,357.63],[102.63,359.88],[101.88,362.38],[100.88,363.38],[98.63,364.13],[61.13,363.88],[60.13,363.38],[58.63,361.38],[58.63,358.63],[75.63,306.38],[75.63,305.38],[77.63,300.13],[77.88,298.38],[79.38,296.63]]],[[[131.13,296.13],[133.88,296.13],[135.13,296.88],[136.38,298.88],[136.38,301.13],[119.13,354.13],[118.88,355.88],[148.13,355.88],[150.38,356.63],[151.38,357.63],[152.13,359.88],[151.88,361.38],[150.38,363.38],[148.13,364.13],[111.88,363.88],[110.88,363.38],[109.38,361.63],[109.38,358.38],[111.13,353.88],[111.13,352.88],[113.13,347.63],[113.13,346.63],[115.13,341.38],[115.13,340.38],[117.13,335.13],[117.13,334.13],[119.13,328.88],[119.13,327.88],[121.13,322.63],[121.13,321.63],[123.13,316.38],[123.13,315.38],[125.13,310.13],[125.13,309.13],[128.63,298.38],[129.38,297.13]]],[[[189.38,296.13],[195.88,296.13],[199.88,297.13],[203.13,298.63],[205.88,301.13],[206.38,301.13],[206.38,301.63],[208.38,303.88],[209.13,305.63],[209.13,307.38],[208.63,308.63],[206.88,310.13],[204.13,310.38],[202.88,309.88],[200.13,306.38],[197.13,304.63],[194.88,304.13],[189.88,304.13],[186.38,304.88],[181.63,306.88],[179.38,308.38],[178.63,309.38],[178.13,309.38],[176.13,311.38],[173.63,315.38],[173.13,317.13],[173.13,320.38],[174.13,322.63],[177.38,325.13],[180.13,325.88],[187.63,326.38],[191.63,327.63],[191.88,328.13],[194.63,329.38],[197.63,332.13],[199.88,336.13],[200.63,339.13],[200.63,342.38],[199.63,347.13],[197.63,351.13],[195.13,353.88],[195.13,354.38],[191.63,357.63],[186.38,360.88],[185.63,360.88],[182.88,362.38],[176.38,363.88],[169.88,363.88],[165.63,362.88],[163.63,361.63],[162.38,361.38],[160.63,359.63],[160.13,359.63],[156.88,355.63],[156.63,352.13],[157.88,350.38],[159.38,349.63],[161.63,349.63],[163.63,350.88],[165.13,353.38],[168.63,355.38],[170.63,355.88],[177.38,355.63],[181.38,354.38],[186.63,351.38],[189.88,348.13],[191.88,344.88],[192.63,342.38],[192.63,340.13],[191.63,337.63],[189.88,335.88],[188.13,334.88],[185.38,334.13],[177.13,333.38],[174.63,332.63],[170.88,330.63],[167.63,327.38],[167.38,326.38],[166.13,324.88],[165.13,321.38],[165.13,316.13],[165.63,314.13],[168.13,308.63],[169.88,306.88],[169.88,306.38],[173.13,303.13],[173.63,303.13],[174.38,302.13],[178.13,299.63],[184.38,297.13]]],[[[222.88,295.88],[246.88,295.88],[249.13,296.63],[250.38,297.88],[250.88,300.63],[250.38,302.13],[248.13,303.88],[237.63,304.13],[236.88,306.13],[236.88,307.13],[221.13,355.38],[221.13,355.88],[227.63,355.88],[229.63,356.38],[230.13,357.13],[230.63,357.13],[231.63,359.13],[231.63,360.88],[230.63,362.88],[230.13,362.88],[229.63,363.63],[227.63,364.13],[202.13,363.88],[200.38,362.63],[199.63,361.13],[199.63,358.88],[200.88,356.88],[203.63,355.88],[212.88,355.88],[212.88,354.88],[228.88,305.88],[229.13,304.13],[221.38,303.88],[219.38,302.38],[218.88,301.38],[218.88,298.63],[219.38,297.63],[220.38,296.63]]],[[[261.38,295.88],[297.38,295.88],[298.88,296.13],[300.88,297.63],[301.38,298.63],[301.38,301.38],[299.88,303.38],[297.38,304.13],[264.38,304.13],[257.38,325.88],[283.38,326.13],[285.13,327.38],[285.88,328.88],[285.88,331.13],[284.63,333.13],[281.88,334.13],[254.63,334.13],[254.38,335.88],[247.88,355.38],[247.88,355.88],[278.38,355.88],[280.63,356.63],[281.88,357.88],[282.38,359.38],[281.88,362.13],[280.63,363.38],[278.38,364.13],[240.88,363.88],[239.88,363.38],[238.38,361.38],[238.38,358.63],[240.38,353.38],[240.38,352.38],[242.38,347.13],[242.38,346.13],[244.38,340.88],[244.38,339.88],[246.38,334.63],[246.38,333.63],[248.38,328.38],[248.38,327.38],[250.38,322.13],[250.38,321.13],[252.38,315.88],[252.38,314.88],[254.38,309.63],[254.38,308.63],[257.63,298.63],[259.13,296.63]]],[[[41.38,279.88],[318.63,279.88],[322.38,280.63],[324.13,281.63],[325.88,283.63],[326.88,286.13],[327.13,288.88],[346.38,289.13],[349.63,290.63],[350.88,291.88],[351.88,293.88],[351.88,298.63],[342.63,336.63],[342.63,341.38],[351.88,379.38],[351.88,384.13],[350.88,386.13],[349.63,387.38],[346.38,388.88],[327.38,389.13],[323.63,388.38],[320.63,386.13],[319.13,382.88],[318.88,380.13],[41.13,380.13],[40.88,382.88],[39.38,386.13],[37.38,387.88],[34.88,388.88],[15.88,389.13],[11.38,388.13],[9.13,386.13],[8.13,384.13],[7.88,380.88],[16.88,343.88],[17.38,341.38],[17.38,336.63],[8.13,298.63],[8.13,293.88],[9.13,291.88],[10.38,290.63],[13.63,289.13],[32.88,288.88],[33.13,286.13],[34.63,282.88],[37.63,280.63]],[[41.38,288.13],[40.88,288.63],[40.88,290.88],[39.88,293.38],[38.13,295.38],[36.38,296.38],[32.63,297.13],[16.13,297.13],[25.38,336.38],[25.38,341.63],[24.88,344.63],[16.13,380.88],[32.88,380.88],[33.13,378.13],[34.63,374.88],[37.63,372.63],[41.38,371.88],[318.63,371.88],[322.38,372.63],[325.38,374.88],[326.88,378.13],[327.13,380.88],[343.88,380.88],[334.63,341.63],[334.63,336.38],[335.13,333.38],[343.88,297.13],[327.38,297.13],[323.63,296.38],[321.88,295.38],[320.13,293.38],[319.13,290.88],[318.88,288.13]]]]
  },
  {
    // v0.8 content shard. Boss: six parts (two feathered wings, the body with its crest, three tail feathers) cut by 5.8 unit slits, so six landings and sharp feather tips to reach. Path: land in the left wing, lap it 4.5 inside at 175 and fill it in rows 15 apart at 270, with a short stroke into each feather tip that the lap misses, then the body, the right wing, then the tail feathers right to left.
    name: "Phoenix", timer: 41, boss: true, tier: "final", perfect: 25.35, body: "shoulder", story: null,
    parts: [[[[20.0,267.9],[29.5,274.0],[39.3,279.7],[49.1,285.0],[59.0,289.9],[69.0,294.4],[79.1,298.4],[89.3,301.9],[99.7,304.7],[110.1,306.8],[120.8,308.2],[131.8,308.7],[143.8,308.1],[142.4,298.3],[141.3,286.3],[141.2,281.0],[141.4,275.7],[142.8,265.7],[144.8,256.5],[148.6,244.0],[150.0,240.1],[151.7,236.3],[159.6,220.9],[160.4,218.4],[161.4,213.7],[159.3,209.2],[155.8,202.5],[152.0,215.1],[150.9,216.1],[149.8,216.5],[148.7,216.5],[147.4,215.8],[136.6,198.6],[131.0,190.4],[125.1,182.3],[118.8,174.4],[118.8,184.9],[119.2,195.1],[119.9,203.5],[119.6,204.6],[118.9,205.6],[118.0,206.2],[116.8,206.4],[115.9,206.3],[114.9,205.7],[102.2,193.0],[93.7,185.0],[84.9,177.2],[75.8,169.7],[79.1,181.5],[82.8,192.9],[86.8,204.1],[89.4,210.8],[89.5,212.0],[89.1,213.1],[88.3,214.0],[87.3,214.5],[86.1,214.6],[85.2,214.3],[74.5,208.1],[63.9,202.3],[53.1,196.7],[42.0,191.5],[48.2,202.5],[54.8,213.2],[61.6,223.5],[67.9,232.4],[68.3,233.8],[68.0,235.3],[67.5,236.0],[66.5,236.7],[64.8,236.9],[47.4,232.3],[35.9,229.7],[24.3,227.6],[32.6,236.6],[41.1,245.1],[49.9,253.3],[59.1,261.3],[59.6,262.0],[59.9,262.9],[59.9,264.3],[58.9,265.8],[57.2,266.4],[42.1,266.5],[31.1,267.0]]],[[[154.5,120.8],[155.7,128.2],[158.5,138.7],[161.1,145.4],[164.7,152.0],[164.5,153.1],[161.8,157.4],[160.6,160.5],[159.7,163.6],[159.2,166.7],[159.0,170.1],[159.2,173.3],[159.7,176.4],[160.6,179.5],[166.5,195.3],[167.3,200.8],[167.7,206.0],[167.7,208.8],[167.2,214.2],[166.7,217.0],[166.0,219.9],[165.0,222.9],[163.6,226.1],[156.9,238.8],[155.3,242.3],[151.6,253.9],[149.4,262.3],[147.7,271.3],[147.2,276.1],[147.0,281.0],[147.1,286.3],[147.5,291.9],[148.1,297.7],[149.9,309.6],[153.0,326.0],[156.5,339.5],[160.4,351.2],[163.0,358.0],[165.5,363.8],[173.0,378.0],[180.0,380.0],[187.0,378.0],[194.5,363.8],[197.0,358.0],[199.6,351.2],[203.5,339.5],[207.0,326.0],[210.1,309.6],[211.9,297.7],[212.5,291.9],[212.9,286.3],[213.0,281.0],[212.8,276.1],[212.3,271.3],[210.6,262.3],[208.4,253.9],[204.7,242.3],[203.1,238.8],[196.4,226.1],[195.0,222.9],[194.0,219.9],[193.3,217.0],[192.8,214.2],[192.3,208.8],[192.3,206.0],[192.7,200.8],[193.5,195.3],[199.4,179.5],[200.3,176.4],[200.8,173.3],[201.0,170.1],[200.8,166.7],[200.3,163.6],[199.4,160.5],[198.2,157.4],[195.5,153.1],[195.3,152.0],[198.9,145.4],[201.5,138.7],[204.3,128.2],[205.5,120.8],[201.9,123.0],[195.4,127.8],[190.5,132.1],[189.5,132.4],[188.7,132.3],[188.1,131.9],[187.6,131.2],[185.0,123.1],[181.9,115.7],[180.0,112.0],[178.1,115.7],[175.0,123.1],[172.4,131.2],[171.6,132.1],[170.7,132.4],[169.4,132.0],[164.6,127.8],[158.1,123.0]]],[[[340.0,267.9],[330.5,274.0],[320.7,279.7],[310.9,285.0],[301.0,289.9],[291.0,294.4],[280.9,298.4],[270.7,301.9],[260.3,304.7],[249.9,306.8],[239.2,308.2],[228.2,308.7],[216.2,308.1],[217.6,298.3],[218.7,286.3],[218.8,281.0],[218.6,275.7],[217.2,265.7],[215.2,256.5],[211.4,244.0],[210.0,240.1],[208.3,236.3],[200.4,220.9],[199.6,218.4],[198.6,213.7],[200.7,209.2],[204.2,202.5],[208.0,215.1],[209.1,216.1],[210.2,216.5],[211.3,216.5],[212.6,215.8],[223.4,198.6],[229.0,190.4],[234.9,182.3],[241.2,174.4],[241.2,184.9],[240.8,195.1],[240.1,203.5],[240.4,204.6],[241.1,205.6],[242.0,206.2],[243.2,206.4],[244.1,206.3],[245.1,205.7],[257.8,193.0],[266.3,185.0],[275.1,177.2],[284.2,169.7],[280.9,181.5],[277.2,192.9],[273.2,204.1],[270.6,210.8],[270.5,212.0],[270.9,213.1],[271.7,214.0],[272.7,214.5],[273.9,214.6],[274.8,214.3],[285.5,208.1],[296.1,202.3],[306.9,196.7],[318.0,191.5],[311.8,202.5],[305.2,213.2],[298.4,223.5],[292.1,232.4],[291.7,233.8],[292.0,235.3],[293.5,236.7],[295.2,236.9],[312.6,232.3],[324.1,229.7],[335.7,227.6],[327.4,236.6],[318.9,245.1],[310.1,253.3],[300.9,261.3],[300.4,262.0],[300.1,262.9],[300.1,264.3],[301.1,265.8],[302.8,266.4],[317.9,266.5],[328.9,267.0]]],[[[137.9,421.6],[134.3,431.9],[131.8,442.3],[130.2,452.9],[129.4,463.6],[129.4,474.5],[130.2,485.5],[131.7,496.7],[133.8,507.9],[136.4,519.3],[139.6,530.7],[143.2,542.2],[147.6,553.9],[149.1,543.3],[154.4,500.7],[156.3,479.3],[157.0,468.5],[157.3,457.7],[157.2,446.8],[156.7,435.8],[155.7,424.8],[153.9,413.6],[150.0,402.0],[142.6,411.6]]],[[[173.0,403.4],[169.0,414.9],[166.2,426.3],[164.3,437.7],[163.3,449.1],[163.0,460.6],[163.4,472.0],[164.4,483.4],[166.0,494.9],[168.1,506.3],[170.5,517.7],[173.3,529.1],[176.4,540.6],[180.0,552.0],[183.6,540.6],[186.7,529.1],[189.5,517.7],[191.9,506.3],[194.0,494.9],[195.6,483.4],[196.6,472.0],[197.0,460.6],[196.7,449.1],[195.7,437.7],[193.8,426.3],[191.0,414.9],[187.0,403.4],[180.0,392.0]]],[[[222.1,421.6],[225.7,431.9],[228.2,442.3],[229.8,452.9],[230.6,463.6],[230.6,474.5],[229.8,485.5],[228.3,496.7],[226.2,507.9],[223.6,519.3],[220.4,530.7],[216.8,542.2],[212.4,553.9],[210.9,543.3],[205.6,500.7],[203.7,479.3],[203.0,468.5],[202.7,457.7],[202.8,446.8],[203.3,435.8],[204.3,424.8],[206.1,413.6],[210.0,402.0],[217.4,411.6]]]]
  },
  {
    // v0.8 content shard. Five five-petal flowers, each with an eye that is a hole, and a stem with two leaves: six landings, and a fast sweep slips in every eye. Path: land in a flower, lap it 6 inside its outer edge and 6 outside its eye at 175, lift to the next, then the stem and leaves by their outline.
    name: "Forget-me-not", timer: 31, boss: false, tier: "mid", perfect: 15.95, body: "forearm", story: null,
    parts: [[[[208.4,169.7],[212.0,166.9],[214.0,164.5],[215.6,161.9],[216.8,158.9],[217.5,155.9],[217.8,152.9],[217.5,149.8],[216.8,146.7],[215.6,143.9],[214.0,141.2],[212.0,138.9],[209.6,136.8],[207.0,135.2],[204.1,134.0],[201.1,133.3],[196.7,133.1],[195.8,132.8],[195.2,132.0],[193.6,127.9],[192.0,125.3],[190.0,122.9],[187.6,120.9],[185.0,119.3],[182.1,118.1],[179.1,117.3],[176.0,117.1],[172.9,117.3],[169.9,118.1],[167.0,119.3],[164.3,120.9],[162.0,122.9],[160.0,125.2],[158.4,127.9],[156.8,132.0],[156.4,132.6],[155.3,133.1],[150.9,133.3],[147.9,134.0],[145.0,135.2],[142.4,136.8],[140.0,138.9],[138.0,141.2],[136.4,143.9],[135.2,146.7],[134.5,149.8],[134.2,152.9],[134.5,156.0],[135.2,159.0],[136.4,161.9],[138.0,164.5],[140.0,166.9],[143.4,169.6],[144.0,170.6],[144.0,171.4],[142.9,175.6],[142.6,178.7],[142.9,181.8],[143.6,184.8],[144.8,187.6],[146.4,190.3],[148.5,192.7],[150.8,194.7],[153.4,196.3],[156.3,197.5],[159.3,198.2],[162.4,198.5],[165.5,198.2],[168.5,197.5],[171.4,196.3],[175.0,193.9],[176.0,193.7],[177.0,193.9],[180.6,196.3],[183.5,197.5],[186.5,198.2],[189.6,198.5],[192.7,198.2],[195.7,197.5],[198.6,196.3],[201.2,194.7],[203.6,192.7],[205.6,190.3],[207.2,187.7],[208.4,184.8],[209.1,181.8],[209.4,178.7],[209.1,175.6],[207.9,170.8]],[[183.2,160.0],[182.9,161.9],[182.2,163.6],[181.1,165.1],[179.6,166.2],[177.9,166.9],[176.0,167.2],[174.1,166.9],[172.4,166.2],[170.9,165.1],[169.8,163.6],[169.1,161.9],[168.8,160.0],[169.1,158.1],[169.8,156.4],[170.9,154.9],[172.4,153.8],[174.1,153.1],[176.0,152.8],[177.9,153.1],[179.6,153.8],[181.1,154.9],[182.2,156.4],[182.9,158.1]]],[[[68.1,233.1],[70.1,236.5],[70.0,237.5],[67.2,241.7],[66.1,244.4],[65.4,247.3],[65.2,250.2],[65.4,253.1],[66.1,256.0],[67.2,258.7],[68.7,261.2],[70.6,263.4],[72.9,265.4],[75.4,266.9],[78.1,268.0],[80.9,268.7],[83.9,268.9],[86.8,268.7],[90.3,267.9],[91.3,268.0],[94.8,272.2],[97.0,274.1],[99.5,275.7],[102.3,276.8],[105.1,277.5],[108.0,277.7],[110.9,277.5],[113.8,276.8],[116.5,275.7],[119.0,274.2],[121.3,272.2],[123.2,270.0],[124.7,267.5],[125.8,264.8],[126.5,261.9],[126.7,258.6],[127.0,257.8],[127.9,257.0],[129.6,256.6],[132.3,255.5],[134.8,253.9],[137.1,252.0],[138.9,249.8],[140.5,247.3],[141.6,244.5],[142.3,241.7],[142.5,238.8],[142.3,235.8],[141.6,233.0],[140.5,230.3],[139.0,227.8],[137.1,225.5],[134.8,223.6],[132.3,222.1],[129.0,220.7],[128.3,220.0],[128.1,219.1],[128.2,217.5],[128.0,214.5],[127.3,211.7],[126.1,209.0],[124.6,206.4],[122.7,204.2],[120.5,202.4],[118.0,200.8],[115.2,199.7],[112.4,199.0],[109.5,198.8],[106.5,199.0],[103.7,199.7],[101.0,200.8],[98.4,202.4],[96.2,204.2],[93.9,206.9],[93.2,207.3],[92.2,207.4],[90.6,206.8],[87.7,206.1],[84.8,205.8],[81.9,206.1],[79.0,206.8],[76.3,207.9],[73.8,209.4],[71.6,211.3],[69.6,213.6],[68.1,216.1],[67.0,218.8],[66.3,221.6],[66.1,224.5],[66.3,227.5],[67.0,230.3]],[[108.8,238.0],[108.5,239.7],[107.9,241.4],[106.8,242.8],[105.4,243.9],[103.7,244.5],[102.0,244.8],[100.3,244.5],[98.6,243.9],[97.2,242.8],[96.1,241.4],[95.5,239.7],[95.2,238.0],[95.5,236.3],[96.1,234.6],[97.2,233.2],[98.6,232.1],[100.3,231.5],[102.0,231.2],[103.7,231.5],[105.4,232.1],[106.8,233.2],[107.9,234.6],[108.5,236.3]]],[[[289.5,244.1],[292.4,240.8],[294.0,238.1],[295.2,235.3],[296.0,232.2],[296.2,229.2],[296.0,226.1],[295.2,223.1],[294.0,220.2],[292.4,217.5],[290.4,215.2],[288.0,213.1],[285.4,211.5],[282.5,210.3],[279.5,209.6],[276.4,209.4],[273.3,209.6],[271.7,209.9],[270.8,209.7],[270.0,209.1],[268.0,205.6],[266.0,203.3],[263.6,201.2],[261.0,199.6],[258.1,198.4],[255.1,197.7],[251.9,197.5],[248.9,197.7],[245.9,198.4],[243.0,199.6],[240.4,201.2],[238.0,203.2],[236.0,205.6],[234.3,208.3],[233.2,211.1],[232.4,214.2],[232.3,215.8],[231.9,216.5],[231.1,217.1],[227.0,218.0],[224.1,219.1],[221.5,220.8],[219.1,222.8],[217.1,225.1],[215.5,227.8],[214.3,230.7],[213.6,233.7],[213.3,236.8],[213.6,239.9],[214.3,242.9],[215.5,245.8],[217.1,248.4],[219.1,250.8],[221.5,252.8],[224.1,254.4],[225.6,255.1],[226.3,256.0],[226.5,256.8],[226.1,260.8],[226.3,263.9],[227.0,266.9],[228.2,269.7],[229.8,272.4],[231.9,274.8],[234.3,276.8],[236.9,278.4],[239.7,279.6],[242.8,280.3],[245.9,280.6],[248.9,280.3],[252.0,279.6],[254.9,278.4],[257.5,276.8],[259.9,274.8],[260.9,273.6],[261.9,273.2],[262.9,273.3],[266.5,274.9],[269.5,275.6],[272.7,275.8],[275.7,275.6],[278.7,274.9],[281.6,273.7],[284.3,272.1],[286.6,270.0],[288.7,267.7],[290.3,265.0],[291.4,262.2],[292.2,259.2],[292.4,256.0],[292.2,252.9],[291.4,249.9],[289.4,245.3]],[[263.1,240.0],[262.9,241.9],[262.2,243.6],[261.1,245.1],[259.6,246.2],[257.9,246.9],[256.0,247.2],[254.1,246.9],[252.4,246.2],[250.9,245.1],[249.8,243.6],[249.1,241.9],[248.8,240.0],[249.1,238.1],[249.8,236.4],[250.9,234.9],[252.4,233.8],[254.1,233.1],[256.0,232.8],[257.9,233.1],[259.6,233.8],[261.1,234.9],[262.2,236.4],[262.9,238.1]]],[[[183.0,349.0],[185.8,347.3],[188.2,345.2],[190.3,342.7],[192.0,339.9],[193.2,337.0],[194.0,333.9],[194.2,330.7],[194.0,327.5],[193.2,324.3],[192.0,321.4],[190.3,318.6],[188.2,316.2],[185.8,314.1],[183.0,312.4],[180.1,311.2],[176.0,310.3],[175.1,309.8],[174.6,308.9],[173.7,304.0],[172.4,301.1],[170.8,298.4],[168.6,295.9],[166.2,293.8],[163.5,292.1],[160.5,290.9],[157.4,290.2],[154.2,289.9],[150.9,290.2],[147.8,290.9],[144.8,292.1],[142.1,293.8],[139.7,295.9],[137.6,298.4],[135.5,302.0],[134.9,302.5],[133.7,302.9],[132.1,302.5],[128.9,302.2],[125.7,302.5],[122.5,303.2],[119.6,304.5],[116.8,306.2],[114.4,308.3],[112.3,310.7],[110.6,313.4],[109.3,316.4],[108.6,319.6],[108.3,322.8],[108.6,326.0],[109.3,329.1],[110.6,332.1],[112.3,334.8],[115.1,337.9],[115.5,339.0],[115.4,339.8],[114.5,341.3],[113.3,344.3],[112.5,347.4],[112.3,350.6],[112.5,353.9],[113.3,357.0],[114.5,359.9],[116.2,362.7],[118.3,365.2],[120.7,367.2],[123.5,368.9],[126.5,370.2],[129.6,370.9],[132.8,371.1],[136.0,370.9],[139.1,370.2],[142.9,368.4],[143.9,368.4],[144.8,368.8],[148.5,372.1],[151.2,373.8],[154.2,375.0],[157.3,375.8],[160.5,376.0],[163.7,375.8],[166.8,375.0],[169.8,373.8],[172.6,372.1],[175.0,370.0],[177.1,367.5],[178.8,364.8],[180.0,361.9],[180.8,358.8],[181.0,355.5],[180.6,350.8],[181.3,349.8]],[[157.4,334.0],[157.2,335.9],[156.4,337.7],[155.2,339.2],[153.7,340.4],[151.9,341.2],[150.0,341.4],[148.1,341.2],[146.3,340.4],[144.8,339.2],[143.6,337.7],[142.8,335.9],[142.6,334.0],[142.8,332.1],[143.6,330.3],[144.8,328.8],[146.3,327.6],[148.1,326.8],[150.0,326.6],[151.9,326.8],[153.7,327.6],[155.2,328.8],[156.4,330.3],[157.2,332.1]]],[[[223.6,338.9],[220.0,340.5],[217.5,342.0],[215.3,343.9],[213.4,346.2],[211.9,348.6],[210.8,351.3],[210.1,354.2],[209.8,357.1],[210.1,360.1],[210.7,362.9],[211.9,365.6],[213.4,368.1],[215.3,370.4],[217.5,372.3],[220.0,373.8],[224.5,375.4],[225.2,376.0],[225.6,376.9],[225.9,380.3],[226.5,383.1],[227.7,385.9],[229.2,388.4],[231.1,390.6],[233.4,392.5],[235.9,394.0],[238.5,395.2],[241.4,395.9],[244.4,396.1],[247.3,395.9],[250.1,395.2],[252.8,394.0],[255.4,392.5],[257.6,390.6],[259.5,388.4],[260.3,387.0],[261.1,386.4],[262.2,386.3],[265.5,387.1],[268.5,387.3],[271.4,387.1],[274.3,386.4],[277.0,385.3],[279.5,383.7],[281.7,381.8],[283.6,379.6],[285.2,377.1],[286.3,374.4],[287.0,371.5],[287.2,368.5],[287.0,365.7],[286.3,362.8],[285.1,360.1],[283.6,357.6],[282.5,356.2],[282.2,355.1],[282.5,354.3],[284.3,351.4],[285.4,348.7],[286.1,345.9],[286.3,343.0],[286.1,340.0],[285.4,337.1],[284.3,334.4],[282.7,332.0],[280.8,329.7],[278.6,327.8],[276.1,326.2],[273.4,325.1],[270.5,324.4],[267.6,324.2],[264.7,324.4],[261.8,325.1],[260.1,325.8],[259.2,325.7],[258.3,325.2],[256.1,322.6],[253.9,320.7],[251.4,319.2],[248.7,318.0],[245.8,317.4],[242.9,317.1],[239.9,317.4],[237.1,318.1],[234.4,319.2],[231.9,320.7],[229.7,322.6],[227.8,324.8],[226.2,327.3],[225.1,330.1],[224.4,333.0],[224.2,338.0]],[[257.1,356.4],[256.9,358.1],[256.2,359.8],[255.2,361.2],[253.8,362.2],[252.1,362.9],[250.4,363.1],[248.6,362.9],[247.0,362.2],[245.6,361.2],[244.5,359.8],[243.8,358.1],[243.6,356.4],[243.8,354.6],[244.5,353.0],[245.6,351.6],[247.0,350.5],[248.6,349.8],[250.4,349.6],[252.1,349.8],[253.8,350.5],[255.2,351.6],[256.2,353.0],[256.9,354.6]]],[[[100.0,446.0],[105.1,452.3],[115.0,465.4],[120.3,471.3],[123.0,473.8],[126.0,476.0],[132.4,479.8],[139.4,482.9],[143.0,484.1],[146.6,485.1],[150.1,485.8],[153.6,486.2],[156.8,486.3],[160.0,486.0],[162.9,485.2],[165.7,483.9],[169.9,481.1],[170.9,481.1],[171.7,481.7],[171.9,482.7],[168.6,498.7],[167.2,509.4],[166.3,520.2],[164.5,551.5],[164.9,554.3],[165.9,556.4],[166.9,557.5],[168.0,558.3],[170.1,559.2],[171.5,559.5],[173.0,559.4],[174.4,559.1],[175.8,558.5],[178.0,556.6],[179.2,553.9],[179.9,547.2],[181.7,516.1],[183.3,502.2],[183.9,501.3],[184.8,501.0],[185.7,501.3],[200.4,514.0],[203.1,516.0],[206.0,517.8],[208.9,519.1],[212.0,520.0],[215.2,520.4],[218.6,520.5],[225.5,519.7],[229.1,518.9],[236.2,516.6],[242.9,513.6],[246.0,512.0],[249.0,510.1],[251.7,507.9],[257.0,502.9],[266.9,491.5],[272.0,486.0],[267.8,483.8],[259.8,479.0],[255.3,477.1],[252.8,476.4],[247.0,475.8],[240.1,475.7],[232.5,476.1],[228.7,476.6],[221.1,477.9],[214.0,480.0],[210.7,481.4],[207.6,483.0],[201.6,486.8],[186.5,498.2],[185.4,498.5],[184.5,498.0],[184.2,496.9],[185.3,491.4],[193.0,461.7],[195.4,451.4],[198.1,436.7],[203.4,403.2],[203.5,401.8],[203.3,400.3],[202.8,398.9],[202.1,397.7],[201.1,396.5],[200.0,395.6],[197.9,394.7],[196.4,394.5],[195.0,394.6],[193.5,394.9],[192.2,395.5],[191.0,396.4],[190.0,397.5],[188.8,400.0],[184.1,429.5],[181.6,443.7],[178.9,456.1],[178.6,456.7],[178.1,457.0],[177.4,457.2],[176.6,456.9],[168.5,449.4],[165.9,447.4],[160.0,444.0],[153.2,441.5],[141.9,439.1],[130.6,438.0],[124.0,438.0],[121.1,438.2],[118.4,438.7],[113.6,440.2],[104.6,444.2]]]]
  },
  {
    // v0.8 content shard. The finale: twelve parts (two wings each cut into a root and two feathered tips, the body, the two tail streamers and a banner in three pieces) by 5.8 unit slits, with pointed feather tips and thin forks, so twelve landings and little room. Path: land in the left wing tip and lap it 4.5 inside at 175, fill in rows 15 apart at 270 and stroke into each feather tip the lap misses, then the wing root, body, right wing, the tail streamers and the three banner pieces right to left.
    name: "Swallow for Rita", timer: 33, boss: true, tier: "skull", perfect: 23.93, body: "forearm", story: null,
    parts: [[[[29.3,299.1],[41.1,298.7],[57.3,297.6],[58.7,297.8],[109.8,273.9],[108.2,269.5],[107.0,265.3],[105.4,256.5],[105.1,252.1],[105.1,247.7],[105.5,243.3],[106.3,237.8],[93.2,239.3],[82.7,241.3],[72.3,243.9],[62.0,247.0],[51.6,250.5],[41.3,254.3],[30.9,258.5],[20.7,263.3],[31.5,265.7],[52.5,269.4],[53.3,269.7],[54.0,270.3],[54.7,271.5],[54.8,272.4],[54.6,273.3],[54.2,274.1],[53.6,274.7],[46.5,278.9],[36.7,285.2],[26.9,291.8],[17.4,298.9]]],[[[57.7,304.6],[41.2,321.5],[33.5,330.3],[45.2,328.1],[56.7,325.2],[67.9,322.1],[76.9,319.3],[78.0,319.3],[79.1,319.7],[79.9,320.5],[80.4,321.6],[80.5,322.5],[80.2,323.6],[69.6,341.3],[64.6,350.8],[74.8,346.3],[84.6,341.5],[94.1,336.3],[103.4,330.9],[112.4,325.2],[120.9,319.1],[129.1,312.6],[137.5,305.0],[134.6,303.3],[130.9,300.8],[124.2,295.2],[121.2,292.0],[118.4,288.6],[115.8,285.1],[112.3,279.2]]],[[[143.8,298.3],[148.5,292.5],[146.7,276.0],[145.9,265.2],[145.4,250.2],[145.6,240.5],[135.4,238.6],[124.8,237.6],[112.3,237.5],[111.2,244.0],[110.9,248.0],[110.9,252.0],[111.2,256.0],[112.6,263.8],[113.7,267.6],[115.1,271.4],[116.7,275.0],[118.6,278.5],[123.0,285.2],[128.3,291.1],[131.3,293.7],[134.4,296.2],[137.7,298.4],[141.6,300.6]]],[[[173.0,143.3],[169.2,145.0],[168.0,146.0],[165.7,148.7],[163.6,152.1],[162.7,154.1],[161.4,157.9],[161.0,159.9],[161.0,164.2],[163.0,175.4],[162.8,180.5],[161.6,188.1],[159.0,200.0],[154.2,219.1],[152.6,227.6],[152.0,232.0],[151.4,240.9],[151.3,254.9],[151.7,264.8],[152.4,275.4],[154.4,292.9],[158.0,316.0],[161.2,332.0],[164.7,347.0],[168.1,360.1],[176.0,384.0],[180.0,386.0],[184.0,384.0],[189.6,367.4],[191.9,360.1],[195.3,347.0],[198.8,332.0],[201.0,321.4],[204.7,298.8],[206.3,286.9],[207.6,275.4],[208.3,264.8],[208.7,254.9],[208.6,240.9],[208.0,232.0],[206.7,223.4],[201.0,200.0],[198.4,188.1],[197.2,180.5],[197.0,175.4],[199.0,164.2],[199.1,162.1],[199.0,159.9],[198.0,155.9],[195.4,150.4],[193.1,147.2],[192.0,146.0],[190.7,145.0],[187.5,143.6],[186.7,143.0],[180.0,128.0],[173.5,142.6]]],[[[216.2,298.3],[211.5,292.5],[213.3,276.0],[214.1,265.2],[214.6,250.2],[214.4,240.5],[224.6,238.6],[235.2,237.6],[247.7,237.5],[248.8,244.0],[249.1,248.0],[249.1,252.0],[248.8,256.0],[247.4,263.8],[246.3,267.6],[244.9,271.4],[243.3,275.0],[241.4,278.5],[237.0,285.2],[231.7,291.1],[228.7,293.7],[225.6,296.2],[222.3,298.4],[218.4,300.6]]],[[[302.3,304.6],[318.8,321.5],[326.5,330.3],[314.8,328.1],[303.3,325.2],[292.1,322.1],[283.1,319.3],[282.0,319.3],[280.9,319.7],[280.1,320.5],[279.6,321.6],[279.5,322.5],[279.8,323.6],[290.4,341.3],[295.4,350.8],[285.2,346.3],[275.4,341.5],[265.9,336.3],[256.6,330.9],[247.6,325.2],[239.1,319.1],[230.9,312.6],[222.5,305.0],[225.4,303.3],[229.1,300.8],[235.8,295.2],[238.8,292.0],[241.6,288.6],[244.2,285.1],[247.7,279.2]]],[[[330.7,299.1],[318.9,298.7],[302.7,297.6],[301.3,297.8],[250.2,273.9],[251.8,269.5],[253.0,265.3],[254.6,256.5],[254.9,252.1],[254.9,247.7],[254.5,243.3],[253.7,237.8],[266.8,239.3],[277.3,241.3],[287.7,243.9],[298.0,247.0],[308.4,250.5],[318.7,254.3],[329.1,258.5],[339.3,263.3],[328.5,265.7],[307.5,269.4],[306.7,269.7],[306.0,270.3],[305.3,271.5],[305.2,272.4],[305.4,273.3],[305.8,274.1],[306.4,274.7],[313.5,278.9],[323.3,285.2],[333.1,291.8],[342.6,298.9]]],[[[161.4,395.4],[157.4,403.8],[154.4,412.4],[152.2,421.3],[150.9,430.4],[150.3,439.8],[150.4,449.3],[151.2,459.1],[152.6,469.0],[154.5,479.0],[156.9,489.2],[159.8,499.6],[163.3,510.1],[171.8,465.0],[174.7,446.8],[175.9,437.6],[177.1,424.3],[177.1,394.8],[176.8,390.9],[173.2,389.1],[171.8,388.0],[170.8,386.6],[169.9,384.0],[166.5,387.4]]],[[[198.6,395.4],[202.6,403.8],[205.6,412.4],[207.8,421.3],[209.1,430.4],[209.7,439.8],[209.6,449.3],[208.8,459.1],[207.4,469.0],[205.5,479.0],[203.1,489.2],[200.2,499.6],[196.7,510.1],[188.2,465.0],[185.3,446.8],[184.1,437.6],[182.9,424.3],[182.9,394.8],[183.2,390.9],[186.8,389.1],[188.2,388.0],[189.2,386.6],[190.1,384.0],[193.5,387.4]]],[[[81.8,523.2],[63.8,521.0],[30.0,516.0],[44.0,532.0],[30.0,548.0],[75.3,552.0]]],[[[272.4,523.8],[245.2,526.0],[217.4,527.9],[198.5,528.7],[180.0,529.0],[161.5,528.7],[142.6,527.9],[114.8,526.0],[87.6,523.8],[81.2,552.4],[123.8,555.1],[142.6,556.0],[161.5,556.7],[180.0,557.0],[198.5,556.7],[217.4,556.0],[236.2,555.1],[278.8,552.4]]],[[[284.7,552.0],[330.0,548.0],[316.0,533.0],[330.0,516.0],[296.2,521.0],[278.2,523.2]]]]
  },
];

// A stencil in parts lists them as `parts`: each a shape (a list of polygons, even-odd, so a part can have holes), and the parts must not overlap. `shape`, the union of every
// polygon, is then made here, so everything that draws or clips the stencil reads one field. A stencil without `parts` is one part.
function prepStencil(st) {
  if (st.parts) st.shape = st.parts.flat();
  return st;
}
for (const st of STENCILS) prepStencil(st);

// ---------- The cast (PRD v0.7) ----------
// Each stencil belongs to one client (the daily has none): its line shows on the play intro, and the client wears the finished piece in the reveal and the Portfolio.
// `face` is the square crop of the head (x, y and width, as shares of the portrait's width and height) for the small plates.
const CLIENTS = {
  bram: { name: 'Bram', face: [0.27, 0.04, 0.42] },
  theo: { name: 'Theo', face: [0.12, 0.02, 0.42] },
  june: { name: 'June', face: [0.34, 0.02, 0.4] },
  ola: { name: 'Ola', face: [0.3, 0.06, 0.4] },
  mina: { name: 'Mina', face: [0.04, 0, 0.4] },
  kai: { name: 'Kai', face: [0.46, 0, 0.42] },
  // PRD v0.8 (Pack 16): `hair` and `glasses` only draw the stand-in face while the portraits are missing; `face` is a placeholder until the art lands
  ines: { name: 'Ines', face: [0.3, 0.06, 0.4], hair: P.hairDark },
  arlo: { name: 'Arlo', face: [0.3, 0.06, 0.4], hair: P.hairGrey },
  rita: { name: 'Rita', face: [0.3, 0.06, 0.4], hair: P.hairGrey, glasses: true, react: { happy: ['A swallow always comes home. So does this shop. It\'s yours.'], neutral: ['Steady. Try again, I\'m not going anywhere.'], sad: ['Steady. Try again, I\'m not going anywhere.'] } },
};
const COLD_IDS = ['bram', 'theo', 'june', 'ola', 'mina', 'kai']; // the six faces of the cold open
const CAST = {
  Circle: ['bram', 'Something simple. My first.'], Anchor: ['bram', 'An anchor for my first voyage.'],
  Key: ['theo', 'The key to my first restaurant.'], Trinity: ['theo', 'Three knots: me, my wife, my kitchen.'],
  Rose: ['june', 'My grandchildren dared me.'], Swallow: ['june', 'A swallow always comes home.'],
  Diamond: ['ola', 'Something new, for the wedding.'], Star: ['ola', 'My wife calls me her star.'], Constellation: ['ola', 'The sky the night we met.'],
  Heart: ['mina', 'For my mum, who never misses a race.'], Bolt: ['mina', 'Fastest on the team. Prove it.'], Dagger: ['mina', 'Hill sprints. Every week.'], Skull: ['mina', 'Survived the mountain race.'], Bones: ['mina', 'Two broken legs, still running.'],
  Crescent: ['kai', 'The moon from our first album.'], Halo: ['kai', 'For my band. We\'re angels. Ish.'], Clover: ['kai', 'Lucky, for the tour.'], Snake: ['kai', 'Tour starts Monday. Make it count.'],
};
// PRD v0.8: the stencils appended as #19 to #31 are keyed by index (a name can repeat: Arlo's Rose is not June's). [client, the line on the intro].
const CAST_AT = {
  18: ['bram', 'Made it back. A lighthouse, for the way home.'], 19: ['theo', 'One year open. Still full every night.'], 20: ['june', 'My grandchildren, Max and Jo. Right here.'],
  21: ['ola', 'One year married. She still calls me her star.'], 22: ['mina', 'First marathon. Mum was at the finish.'], 23: ['kai', 'The album\'s out. They want an encore.'],
  24: ['ines', 'Twenty years. I\'m keeping one flame.'], 25: ['ines', 'For the crew. Station 9.'], 26: ['arlo', 'My first, at eighty. For Elsie.'],
  27: ['arlo', 'Sixty years married. Her name, in her hand.'], 28: ['ines', 'Last shift done. Now I rise.'], 29: ['arlo', 'So I never do.'],
  30: ['rita', 'One more piece, then. On me.'], // the finale, Swallow for Rita
};
const FINALE = 30; // the finale's index: it opens when every other stencil has a star, and Rita's card comes before it
// ===== PACK 16: the one block to edit when the art chat's webps land (Ines, Arlo, Rita's two faces) =====
// Until a client's flag is true its portraits are never requested (no 404) and a drawn stand-in face is used. When the files land:
//   1. copy them into games/ink/assets/ (client-ines-happy|neutral|sad.webp, client-arlo-...webp, rita-proud.webp, rita-kind.webp);
//   2. set the client's flag below to true, measure its PATCH and PATCH2 rows on the real portraits (Rita: only PATCH, her forearm), and its `face` crop in CLIENTS;
//   3. list the files in PACK16 in sw.js and bump CACHE_VERSION.
const PACK16 = { ines: false, arlo: false, rita: false };
const packOf = (file) => (file.startsWith('client-ines-') ? 'ines' : file.startsWith('client-arlo-') ? 'arlo' : file.startsWith('rita-') ? 'rita' : null);
const artReady = (file) => { const k = packOf(file); return !k || PACK16[k]; };
// The portrait file of a client in a mood. Rita has two faces: proud (a happy mood, 4 or 5 stars) and kind (any other).
const portraitFile = (id, mood) => (id === 'rita' ? (mood === 'happy' ? 'rita-proud' : 'rita-kind') : `client-${id}-${mood}`);
// The skin patch on each portrait, measured from the final art (docs/art/final/ink): [centre x, centre y, width, height, tilt in radians], x and width as shares of the portrait's width,
// y and height of its height. The piece is fitted inside the rectangle (and turned with the limb), so the tattoo sits on skin.
const PATCH = {
  bram: { happy: [0.56, 0.675, 0.17, 0.075, -0.33], neutral: [0.56, 0.715, 0.17, 0.07, -0.33], sad: [0.595, 0.69, 0.17, 0.07, -0.38] },
  theo: { happy: [0.795, 0.58, 0.14, 0.13, 0], neutral: [0.795, 0.58, 0.14, 0.13, 0], sad: [0.795, 0.58, 0.14, 0.13, 0] },
  june: { happy: [0.58, 0.505, 0.2, 0.15, 0], neutral: [0.58, 0.505, 0.2, 0.15, 0], sad: [0.58, 0.505, 0.2, 0.15, 0] },
  ola: { happy: [0.52, 0.54, 0.2, 0.14, 0], neutral: [0.52, 0.54, 0.2, 0.14, 0], sad: [0.52, 0.54, 0.2, 0.14, 0] },
  mina: { happy: [0.58, 0.6, 0.17, 0.08, 0.12], neutral: [0.6, 0.6, 0.17, 0.07, 0.1], sad: [0.6, 0.6, 0.17, 0.07, 0.15] },
  kai: { happy: [0.45, 0.475, 0.26, 0.19, 0], neutral: [0.45, 0.475, 0.26, 0.19, 0], sad: [0.45, 0.475, 0.26, 0.19, 0] },
  // Pack 16 placeholders, set on the drawn stand-in (shoulder, forearm, forearm); replace each with the measured row when the portraits land
  ines: { happy: [0.7, 0.62, 0.2, 0.12, 0.15], neutral: [0.7, 0.62, 0.2, 0.12, 0.15], sad: [0.7, 0.62, 0.2, 0.12, 0.15] },
  arlo: { happy: [0.5, 0.74, 0.22, 0.09, -0.2], neutral: [0.5, 0.74, 0.22, 0.09, -0.2], sad: [0.5, 0.74, 0.22, 0.09, -0.2] },
  rita: { happy: [0.5, 0.78, 0.22, 0.1, -0.1], neutral: [0.5, 0.78, 0.22, 0.1, -0.1], sad: [0.5, 0.78, 0.22, 0.1, -0.1] },
};
// The second patch on each portrait (PRD v0.8 A), where a returning client's earlier finished pieces sit small and faded: the same rows as PATCH, measured on the same art.
// A client missing here has no clear second patch and shows no earlier pieces. Bram's and Theo's are the smallest (two pieces fit); Rita has none.
const PATCH2 = {
  bram: { happy: [0.705, 0.668, 0.09, 0.065, -0.3], neutral: [0.7, 0.69, 0.09, 0.065, -0.3], sad: [0.715, 0.7, 0.09, 0.065, -0.35] },
  theo: { happy: [0.795, 0.705, 0.12, 0.075, 0], neutral: [0.795, 0.705, 0.12, 0.075, 0], sad: [0.795, 0.705, 0.12, 0.075, 0] },
  june: { happy: [0.57, 0.65, 0.2, 0.075, 0], neutral: [0.57, 0.65, 0.2, 0.075, 0], sad: [0.57, 0.65, 0.2, 0.075, 0] },
  ola: { happy: [0.36, 0.72, 0.1, 0.085, 0.1], neutral: [0.36, 0.72, 0.1, 0.085, 0.1], sad: [0.36, 0.72, 0.1, 0.085, 0.1] },
  mina: { happy: [0.33, 0.56, 0.18, 0.085, -0.08], neutral: [0.33, 0.56, 0.18, 0.085, -0.08], sad: [0.33, 0.56, 0.18, 0.085, -0.08] },
  kai: { happy: [0.38, 0.63, 0.24, 0.09, 0], neutral: [0.38, 0.63, 0.24, 0.09, 0], sad: [0.38, 0.63, 0.24, 0.09, 0] },
  ines: { happy: [0.3, 0.62, 0.2, 0.12, -0.15], neutral: [0.3, 0.62, 0.2, 0.12, -0.15], sad: [0.3, 0.62, 0.2, 0.12, -0.15] }, // Pack 16 placeholders, as PATCH
  arlo: { happy: [0.5, 0.9, 0.22, 0.07, -0.2], neutral: [0.5, 0.9, 0.22, 0.07, -0.2], sad: [0.5, 0.9, 0.22, 0.07, -0.2] },
};
const MOODS = ['happy', 'neutral', 'sad'];
const REACT = { happy: ['I love it. Thank you.', 'It\'s perfect.'], neutral: ['It\'s... good. Thanks.'], sad: ['Oh. Well. It\'s done now.'] };
const moodOf = (stars, failed) => (failed || stars <= 1 ? 'sad' : stars >= 4 ? 'happy' : 'neutral'); // PRD v0.7 C: happy at 4 or 5, neutral at 2 or 3, sad at 0 or 1 or a failed piece
const castRow = (st) => { const i = STENCILS.indexOf(st); return i < 0 ? null : CAST_AT[i] || CAST[st.name]; }; // one index-keyed lookup for every client read (the daily, not in the book, has no client)
const castOf = (st) => { const c = st && castRow(st); return c ? { id: c[0], who: CLIENTS[c[0]], line: c[1], react: CLIENTS[c[0]].react || REACT } : null; };
const clientAt = (i) => { const c = STENCILS[i] && castRow(STENCILS[i]); return c ? c[0] : null; };
// The same client's earlier stencils (a lower index) that have a star: what they already wear (PRD v0.8 A).
function earlierOf(idx, stars) {
  const id = clientAt(idx), out = [];
  if (id) for (let i = 0; i < idx; i++) if (clientAt(i) === id && (stars[i] || 0) > 0) out.push(i);
  return out;
}
const RANKS = [{ name: 'Apprentice' }, { name: 'Artist', line: 'Clean lines. You\'ll do. Chair two is yours.' }, { name: 'Master', line: 'Your own shop. Your name on the door.' }];
const rankOf = (total) => T.rankAt.filter((n) => total >= n).length;

// ---------- Timers, the daily stencil, badges (v0.5) ----------

// The timer is the stencil's perfect-path time (`perfect`, measured with tools/sim-ink.mjs on its intended path at 300 units/s) times the tier's active multiplier times
// timerGlobalMult, rounded up, so the TUNE presets (PRD v0.5 section D) can retime every stencil. At the standard multipliers it is the stencil's own `timer`.
const STD_MULT = { early: T.timerMultEarly, mid: T.timerMultMid, boss: T.timerMultBoss, final: T.timerMultFinal, skull: T.timerMultSkull };
const TIER_KEY = { early: 'timerMultEarly', mid: 'timerMultMid', boss: 'timerMultBoss', final: 'timerMultFinal', skull: 'timerMultSkull' };
const perfectTime = (st) => st.perfect ?? st.timer / STD_MULT[st.tier];
function timerFor(st) {
  if (!STD_MULT[st.tier]) return st.timer; // a stencil without a tier (a shard's JSON under test) keeps its own timer
  return Math.ceil(perfectTime(st) * T[TIER_KEY[st.tier]] * T.timerGlobalMult - 1e-6);
}

// The daily stencil is played as one more stencil, at index DAILY_IDX, rebuilt when the day changes. Everything that caches per stencil index clears that slot then.
const DAILY_IDX = 1000; // clear of any real index, and of the one tools/sim-ink.mjs appends for a stencil under test
let DAILY_ST = null, DAILY_KEY = '';
const stOf = (idx) => (idx === DAILY_IDX ? DAILY_ST : STENCILS[idx]);
const utcDay = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
const dailyTimer = (st) => Math.min(timerFor(st), Math.ceil(perfectTime(st) * T.dailyTimerMult * T.timerGlobalMult - 1e-6));

function buildDaily(rec, key) {
  const base = STENCILS[rec.idx], b = bboxOf(rec.idx);
  const v = base.noMirror ? { label: 'Upright', sx: 1, sy: 1 } : T.dailyVariants[rec.vi]; // lettering is never mirrored, flipped or turned
  DAILY_KEY = `${key}|${rec.idx}|${rec.vi}`;
  DAILY_ST = {
    name: base.name, variant: v.label, noMirror: base.noMirror, boss: base.boss, body: base.body, tier: base.tier, perfect: base.perfect, base: rec.idx, timer: base.timer,
    shape: base.shape.map((poly) => poly.map(([x, y]) => [b.cx + v.sx * (x - b.cx), b.cy + v.sy * (y - b.cy)])),
  };
  if (base.parts) DAILY_ST.parts = base.parts.map((part) => part.map((poly) => poly.map(([x, y]) => [b.cx + v.sx * (x - b.cx), b.cy + v.sy * (y - b.cy)])));
  delete gridCache[DAILY_IDX]; delete gridBuild[DAILY_IDX]; delete AC.outline[DAILY_IDX]; delete AC.bbox[DAILY_IDX]; delete AC.mini[DAILY_IDX];
  if (AC.blushIdx === DAILY_IDX) AC.blushIdx = -1;
  if (AC.olIdx === DAILY_IDX) { AC.ol = null; AC.olIdx = -1; } // the outline bitmap of the day before
}

// Today's daily: chosen once per UTC day from the stencils that are unlocked (so it never stands in for a locked one), seeded by the date, and stored with its result under the
// dated key. The save keeps the last dailyKeep days.
function dailyToday(E) {
  const key = utcDay(), all = E.save.get('daily', {}), cutoff = utcDay(Date.parse(key) - (T.dailyKeep - 1) * 864e5);
  let rec = all[key];
  const stale = Object.keys(all).some((k) => k < cutoff);
  if (!rec || stale) {
    if (!rec) {
      const rng = makeRng(hashString(key)), pool = progress(E).unlocked;
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
// A ruined run still is the first attempt (that is the point of a daily) but never raises the best of the day.
function recordDaily(E, key, pct, ruined) {
  const all = E.save.get('daily', {}), rec = all[key];
  if (!rec) return null;
  const next = { ...rec, first: rec.first < 0 ? pct : rec.first, best: ruined ? rec.best : Math.max(rec.best, pct) };
  E.save.set('daily', { ...all, [key]: next });
  return next;
}

// Badges are data: a tier, a name, a line of text and a rule. A rule reads one stat (best stars, a clean pass, or the best stars of a clean pass) on any stencil, on one
// stencil by name, or on every stencil in a range of indices, and needs it at `min`. Nothing in the play code knows a badge.
const BADGE_TIERS = ['Apprentice', 'Artist', 'Master', 'Trick'];
const BADGES = [
  { id: 'first-ink', tier: 0, name: 'First Ink', text: 'Pass any stencil', rule: { on: 'any', stat: 'stars', min: 1 } },
  { id: 'steady-hand', tier: 0, name: 'Steady Hand', text: 'Clean pass on any stencil', rule: { on: 'any', stat: 'clean', min: 1 } },
  { id: 'five-stars', tier: 0, name: 'Five Stars', text: 'Five stars on any stencil', rule: { on: 'any', stat: 'stars', min: 5 } },
  { id: 'steady-landing', tier: 1, name: 'Steady Landing', text: 'Every part done, every landing clean', rule: { on: 'any', stat: 'steady', min: 1 } },
  { id: 'cornered', tier: 1, name: 'Cornered', text: 'Clean pass on the Star', rule: { on: 'one', of: 'Star', stat: 'clean', min: 1 } },
  { id: 'thin-line', tier: 1, name: 'Thin Line', text: 'Five stars on the Crescent', rule: { on: 'one', of: 'Crescent', stat: 'stars', min: 5 } },
  { id: 'two-edges', tier: 1, name: 'Two Edges', text: 'Clean pass on the Halo', rule: { on: 'one', of: 'Halo', stat: 'clean', min: 1 } },
  { id: 'flash-sheet', tier: 1, name: 'Flash Sheet', text: 'Three stars on the first ten', rule: { on: 'all', from: 0, to: 10, stat: 'stars', min: 3 } },
  { id: 'serpent', tier: 2, name: 'Serpent', text: 'Clean five stars, the Snake', rule: { on: 'one', of: 'Snake', stat: 'cs', min: 5 } },
  { id: 'bone', tier: 2, name: 'Bone', text: 'Clean five stars, the Skull', rule: { on: 'one', of: 'Skull', stat: 'cs', min: 5 } },
  { id: 'set-piece', tier: 2, name: 'Set Piece', text: 'Five stars on all stencils in parts', rule: { on: 'parts', stat: 'split', min: 5 } },
  { id: 'full-sleeve', tier: 2, name: 'Full Sleeve', text: 'Five stars on every stencil', rule: { on: 'all', from: 0, to: 15, stat: 'stars', min: 5 } },
  // Tricks (PRD v0.6 section G) are earned by how one attempt was played, so each is a function of that attempt: `a` is what toCard sees (daily, pct, stars, ruined, failed, clean,
  // lifts99 = finger lifts before 99 percent was reached (-1 if never), used and total seconds, hintOff, maxR = the widest ink radius laid). Only Second Skin is earned on the daily.
  { id: 'one-line', tier: 3, name: 'One Line', text: '99% without a lift', trick: (a) => !a.daily && !a.failed && a.lifts99 === 0 },
  { id: 'half-time', tier: 3, name: 'Half Time', text: 'Five stars in half the time', trick: (a) => !a.daily && a.stars === 5 && a.used < a.total / 2 },
  { id: 'blind', tier: 3, name: 'Blind', text: 'Five stars, gap hint off', trick: (a) => !a.daily && a.stars === 5 && a.hintOff },
  { id: 'featherweight', tier: 3, name: 'Featherweight', text: 'Clean pass, needle never at full width', trick: (a) => !a.daily && !a.failed && a.clean && a.maxR < T.needleR * T.wideScale * T.fullWidthShare },
  { id: 'second-skin', tier: 3, name: 'Second Skin', text: 'The daily at 100%', trick: (a) => a.daily && !a.ruined && a.pct === 100 },
];
const statOf = (p, i, stat) => (stat === 'clean' ? (p.clean[i] ? 1 : 0) : stat === 'steady' ? (p.land && p.land[i] && p.land[i].ok ? 1 : 0) : stat === 'split' ? (p.land && p.land[i] && p.land[i].st) || 0 : p[stat][i] || 0);
// How far a badge is: { have, need } stencils meeting its rule.
function badgeProgress(b, p) {
  const r = b.rule;
  if (!r) return { have: 0, need: 1 }; // a trick: earned by one attempt, never by saved stats
  if (r.on === 'any') { for (let i = 0; i < STENCILS.length; i++) if (statOf(p, i, r.stat) >= r.min) return { have: 1, need: 1 }; return { have: 0, need: 1 }; }
  if (r.on === 'one') return { have: statOf(p, STENCILS.findIndex((s) => s.name === r.of), r.stat) >= r.min ? 1 : 0, need: 1 };
  let have = 0, need = 0;
  if (r.on === 'parts') { STENCILS.forEach((st, i) => { if (st.parts) { need++; if (statOf(p, i, r.stat) >= r.min) have++; } }); return { have, need }; } // every stencil made of parts
  for (let i = r.from; i < r.to; i++) if (statOf(p, i, r.stat) >= r.min) have++;
  return { have, need: r.to - r.from };
}
// Every badge the given progress (stars, clean, cs) has earned, as { id: true }.
function earnedBadges(p) {
  const out = {};
  for (const b of BADGES) if (b.rule) { const g = badgeProgress(b, p); if (g.have >= g.need) out[b.id] = true; }
  return out;
}
// The tricks one finished attempt earned, as { id: true }.
function trickBadges(a) {
  const out = {};
  for (const b of BADGES) if (b.trick && b.trick(a)) out[b.id] = true;
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
    const parts = stOf(idx).parts || null;
    b = gridBuild[idx] = { shape, parts, x0, y0, cols, rows, inside: new Uint8Array(cols * rows), part: parts ? new Uint8Array(cols * rows) : null, partTotal: parts ? new Int32Array(parts.length) : null, total: 0, j: 0 };
  }
  const cs = T.cellSize, t0 = ms === Infinity ? 0 : performance.now();
  while (b.j < b.rows) {
    const j = b.j++;
    for (let i = 0; i < b.cols; i++) {
      const cx = b.x0 + (i + 0.5) * cs, cy = b.y0 + (j + 0.5) * cs;
      if (b.parts) { // a stencil in parts: a cell counts if it is inside some part, and belongs to it
        for (let pi = 0; pi < b.parts.length; pi++) if (pointInShape(b.parts[pi], cx, cy)) { b.inside[j * b.cols + i] = 1; b.part[j * b.cols + i] = pi + 1; b.partTotal[pi]++; b.total++; break; }
      } else if (pointInShape(b.shape, cx, cy)) { b.inside[j * b.cols + i] = 1; b.total++; }
    }
    if (ms !== Infinity && performance.now() - t0 >= ms) break;
  }
  if (b.j < b.rows) return null;
  delete gridBuild[idx];
  return (gridCache[idx] = { x0: b.x0, y0: b.y0, cols: b.cols, rows: b.rows, inside: b.inside, total: b.total, part: b.part, partTotal: b.partTotal });
}
const gridFor = (idx) => gridStep(idx, Infinity);

// ---------- Play state ----------

const S = {}; // the current attempt; the card reads it to draw the finished piece
let menuPopIdx = -1; // set by the card when stars went up; the menu pops that tile once

const V = { s: 1, ox: 0, oy: 0 }; // the play view, shared: one object, refilled on each call
function view(E, o = V) {
  o.s = Math.min(E.w / T.designW, E.h / T.designH);
  o.ox = (E.w - T.designW * o.s) / 2; o.oy = (E.h - T.designH * o.s) / 2;
  o.oy += plateShift(E, o);
  return o;
}
// The client's plate (PRD v0.7 B) is two lines at most, so its height is fixed: on a short screen a tall stencil's tip would sit under it, so the piece is moved down (never scaled,
// so every judged distance is unchanged) until its tip clears the plate, as far as the room under it allows (and clear of the split intro's plate).
function plateRect(E) { const C = A.cast; return { y: E.safe.top + T.hudTop + 2 * A.hud.ring + 2 + C.top, h: C.face + 2 * C.pad }; }
function plateShift(E, v) {
  if (!S.st || S.daily || !castOf(S.st)) return 0;
  const C = A.cast, I = A.intro, bb = bboxOf(S.idx), pl = plateRect(E), top = v.oy + bb.y0 * v.s, bot = v.oy + bb.y1 * v.s;
  const floor = E.h - E.safe.bottom - (S.st.parts ? I.bottom + 2 * I.lineH + 2 * I.pad + C.bottomGap : 0) - C.bottomGap;
  return clamp(pl.y + pl.h + C.clear - top, 0, Math.max(0, floor - bot));
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
  endT: -9, flashT: -9, smear: 0, pendName: null, pendAt: 0, flinchT: -9, flinchX: 0, flinchY: 0, partT: -9,
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
  E.shake(J.slipShake, J.slipShakeSec); // the screen kicks once
  E.haptic(S.slips >= T.maxSlips ? J.ruinHaptic : J.slipHaptic); // navigator.vibrate is missing on iPhone Safari; the engine's call then does nothing and the flinch carries it
  E.audio.beep({ freq: J.thudFreq, dur: J.thudDur, type: 'sine', slide: J.thudSlide, gain: J.thudGain });
  // The body flinches: away from the needle, toward the middle of the piece. A new slip replaces the flinch in progress, it never adds to it.
  const bb = bboxOf(S.idx), dx = bb.cx - x, dy = bb.cy - y, len = Math.hypot(dx, dy) || 1;
  f.flinchT = E.time; f.flinchX = dx / len; f.flinchY = dy / len;
  const [sx, sy] = toScreen(E, x, y);
  emit(E, sx, sy, J.slipBurst, P.slip, 90, 0.35, 2.4);
}

// A part of a stencil in parts was completed: a chime and a burst of ink specks around it.
function fxPart(E, i) {
  if (!E.tween) return;
  S.fx.partT = E.time;
  E.audio.beep({ freq: J.partFreq + J.partFreqStep * i, dur: J.partDur, type: 'triangle', gain: J.partGain });
  const g = S.g, cs = T.cellSize;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let k = 0; k < g.part.length; k++) if (g.part[k] === i + 1) { const cx = g.x0 + (k % g.cols) * cs, cy = g.y0 + Math.floor(k / g.cols) * cs; x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy); }
  const [sx, sy] = toScreen(E, (x0 + x1) / 2, (y0 + y1) / 2);
  emit(E, sx, sy, J.partBurst, SK.i.gloss, J.burstSpeed, J.burstLife, J.burstSize);
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
    inked: new Uint8Array(g.cols * g.rows), count: 0, partN: g.partTotal ? new Int32Array(g.partTotal.length) : null, partDone: g.partTotal ? new Uint8Array(g.partTotal.length) : null, fills: [], fillDrawn: 0, landings: 0, cleanLand: 0, lifts: 0, lifts99: -1, maxR: 0, hintOff: false, quit: false, tickets: 0, callout: null, introT: 0,
    strokes: [], stroke: null, marks: [],
    slips: 0, time: 0, total: 0, started: false, ended: null, holdT: 0,
    pid: null, last: null, lastT: 0, carry: 0, armed: false,
    finger: null, r: T.needleR, hist: newHist(), sT: 0, idle: 0, acc: 0, pushR: 0,
    layer: null, layerK: 0, inkDone: [],
    grey: null, greyK: 0, prep: 0, olWait: 1, inkFrom: 0, fx: newFx(),
    hint: newHint(g), hintT: 0,
  });
  S.time = S.total = daily ? dailyTimer(st) : timerFor(st);
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
  if (S.r > S.maxR) S.maxR = S.r; // Featherweight
}
// One Line: how many times the finger had lifted when 99 percent was first reached.
function mark99() { if (S.lifts99 < 0 && percent() >= 99) S.lifts99 = S.lifts; }

// Lay ink on every inside cell whose centre is within R of (x, y).
function inkAt(x, y, R) {
  const { g } = S, cs = T.cellSize;
  const i0 = Math.max(0, Math.floor((x - R - g.x0) / cs)), i1 = Math.min(g.cols - 1, Math.floor((x + R - g.x0) / cs));
  const j0 = Math.max(0, Math.floor((y - R - g.y0) / cs)), j1 = Math.min(g.rows - 1, Math.floor((y + R - g.y0) / cs));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const k = j * g.cols + i;
    if (!g.inside[k] || S.inked[k]) continue;
    if (dist(x, y, g.x0 + (i + 0.5) * cs, g.y0 + (j + 0.5) * cs) <= R) { S.inked[k] = 1; S.count++; if (g.part) S.partN[g.part[k] - 1]++; }
  }
}

// Is the piece done? A stencil in one part is done at 100 percent. A stencil in parts is done when every part is: a part is complete once partDone of its cells (rounded
// down to whole cells) are inked, and completing it inks the rest of it (the ink layer fills it in), so a finished piece reads 100 percent.
function checkDone(E) {
  const g = S.g;
  if (!g.part) return S.count === g.total;
  let all = true;
  for (let i = 0; i < g.partTotal.length; i++) {
    if (!S.partDone[i] && S.partN[i] >= Math.floor(g.partTotal[i] * T.partDone)) {
      S.partDone[i] = 1; S.fills.push(i);
      for (let k = 0; k < g.part.length; k++) if (g.part[k] === i + 1 && !S.inked[k]) { S.inked[k] = 1; S.count++; S.partN[i]++; }
      fxPart(E, i);
    }
    if (!S.partDone[i]) all = false;
  }
  return all;
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
    const done = checkDone(E);
    mark99();
    if (done) finish(E, 'full');
    return;
  }
  S.stroke = null;
  checkSlip(E, x, y);
}

// A touch-down on a stencil in parts is a landing: inside a part's line (or within landTolerance of it) is clean, on skin outside every line is a blot, which is a slip
// of its own kind (its own mark, the same flinch and the same third-slip ruin).
function landing(E, x, y) {
  if (S.ended) return;
  S.landings++;
  if (pointInShape(S.st.shape, x, y) || nearestEdge(S.st.shape, x, y).d <= T.landTolerance) { S.cleanLand++; return; }
  S.slips++;
  if (!S.marks.some((k) => k.blot)) S.callout = { x, y, t: E.time }; // the first blot of a piece gets a call-out
  S.marks.push({ x, y, blot: true });
  E.audio.play('miss');
  fxSlip(E, x, y);
  if (S.slips >= T.maxSlips) finish(E, 'ruined');
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
    if (S.g.part) landing(E, x, y);
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
    const done = checkDone(E);
    mark99();
    if (done) finish(E, 'full');
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
  if (S.pid !== null && !S.ended) S.lifts++;
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
for (const k of ['hero', 'timer', 'big', 'mid', 'small']) FONT[k] = `${A.type.weight} ${A.type[k]}px ${A.type.display}`;
const NUM = Array.from({ length: 201 }, (_, i) => `${i}`), PCT = Array.from({ length: 101 }, (_, i) => `${i}%`); // strings for the HUD, made once

// Caches of everything built once. Body layers are per body part; the rest are per size or per stencil.
const AC = {
  grainBuild: null, warmGo: false, warm: 0, warmGrid: 0, warmOl: 0, warmBmp: false, boot: 0, order: null, bodyBuild: {}, inkTile: {}, mach: {}, body: {}, comp: {}, ol: null, olIdx: -1, olK: 0, grain: null, gw: 0, gh: 0, outline: [], bbox: [], mini: [], blush: null, blushIdx: -1,
  wrap: {}, mctx: null, title: null, titleK: 0, titleImg: null, titleM: null, board: null, bw: 0, bh: 0, shapes: null, tilt: null,
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

// Text broken into lines no wider than maxW at the given font (measured once per string and width, so nothing is measured per frame).
function wrapText(str, maxW, font) {
  const key = `${font}|${maxW}|${str}`;
  if (AC.wrap[key]) return AC.wrap[key];
  const c = (AC.mctx = AC.mctx || mk(1, 1).getContext('2d')), lines = [];
  c.font = font;
  let line = '';
  for (const word of str.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && c.measureText(next).width > maxW) { lines.push(line); line = word; } else line = next;
  }
  lines.push(line);
  return (AC.wrap[key] = lines);
}

// ----- Body parts -----
// Flattened (PRD v0.6 section C): one flat skin tone, a single soft shade and a single soft highlight, and a smooth silhouette (straight sides or one long curve, no bulges,
// creases or muscle lines), drawn once into one large low-resolution layer per body part. Low contrast: shading only, no lines that compete with the stencil.

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
function bodyFill(c, path) { path(); c.fillStyle = P.skin; c.fill(); }
// The edge: wide low-alpha strokes clipped to the silhouette (a soft even fall-off toward the cloth), laid in rimBatches batches, and in the last batch one clean thin line.
function bodyRim(c, path, batch) {
  const B = A.body, per = B.rimSteps / B.rimBatches;
  c.save(); path(); c.clip(); c.lineJoin = 'round'; c.strokeStyle = P.skinShade;
  c.globalAlpha = B.rimAlpha;
  for (let i = batch * per; i < (batch + 1) * per; i++) { c.lineWidth = 4 + B.rimWidth * (1 - i / B.rimSteps); path(); c.stroke(); }
  if (batch === B.rimBatches - 1) { c.globalAlpha = B.edgeAlpha; c.lineWidth = B.edgeWidth * 2; path(); c.stroke(); } // half of it is clipped away: the visible line is edgeWidth
  c.restore();
}

const BODY = {
  // A forearm running down the screen: a straight taper, lit from the left.
  forearm(c, stage) {
    const B = A.body, path = () => { c.beginPath(); c.moveTo(8, -440); c.lineTo(28, 1300); c.lineTo(332, 1300); c.lineTo(352, -440); c.closePath(); };
    if (stage < 0) {
      bodyFill(c, path);
      c.save(); path(); c.clip();
      xband(c, 8, 352, P.skinShade, [[0, B.shade], [0.22, 0], [0.7, 0], [1, B.shade]]);
      glow(c, 130, 260, 90, 340, 0, P.skinHi, B.hi);
      c.restore();
    } else bodyRim(c, path, stage);
  },
  // A shoulder: the deltoid dome over an arm falling away at the left, the torso running off to the right; one smooth curve over the top.
  shoulder(c, stage) {
    const B = A.body, path = () => { c.beginPath(); c.moveTo(-40, 1300); c.lineTo(-40, 340); c.bezierCurveTo(-40, 140, 90, 20, 230, 20); c.bezierCurveTo(380, 20, 480, 118, 600, 122); c.lineTo(780, 122); c.lineTo(780, 1300); c.closePath(); };
    if (stage < 0) {
      bodyFill(c, path);
      c.save(); path(); c.clip();
      glow(c, 150, 240, 230, 280, 0, P.skinHi, B.hi);
      xband(c, -40, 110, P.skinShade, [[0, B.shade], [1, 0]]);
      yband(c, 20, 150, P.skinShade, [[0, B.shade * 0.8], [1, 0]]);
      c.restore();
    } else bodyRim(c, path, stage);
  },
  // A calf: a leg swelling smoothly from the knee to the ankle, one long curve each side.
  calf(c, stage) {
    const B = A.body, path = () => { c.beginPath(); c.moveTo(58, -440); c.bezierCurveTo(-14, 50, -14, 600, 78, 1300); c.lineTo(282, 1300); c.bezierCurveTo(374, 600, 374, 50, 302, -440); c.closePath(); };
    if (stage < 0) {
      bodyFill(c, path);
      c.save(); path(); c.clip();
      xband(c, -14, 374, P.skinShade, [[0, B.shade], [0.2, 0], [0.75, 0], [1, B.shade]]);
      glow(c, 140, 300, 110, 340, 0, P.skinHi, B.hi);
      c.restore();
    } else bodyRim(c, path, stage);
  },
  // A back: broad and flat under one shallow curve of shoulders.
  back(c, stage) {
    const B = A.body, path = () => { c.beginPath(); c.moveTo(-420, 150); c.quadraticCurveTo(180, -150, 780, 150); c.lineTo(780, 1300); c.lineTo(-420, 1300); c.closePath(); };
    if (stage < 0) {
      bodyFill(c, path);
      c.save(); path(); c.clip();
      glow(c, 180, 330, 260, 300, 0, P.skinHi, B.hi);
      yband(c, -20, 170, P.skinShade, [[0, B.shade], [1, 0]]);
      xband(c, -420, -120, P.skinShade, [[0, B.shade], [1, 0]]); xband(c, 480, 780, P.skinShade, [[0, 0], [1, B.shade]]);
      c.restore();
    } else bodyRim(c, path, stage);
  },
};

// A body layer is built in stages (the fill and shading, then the rim in batches) so the menu can lay one stage a frame; bodyLayer finishes whatever is left at once.
function bodyStep(name) {
  let b = AC.bodyBuild[name];
  if (!b) {
    const F = A.field, [x0, y0, x1, y1] = F.extent, k = F.bodyScale, cv = mk(Math.ceil((x1 - x0) * k), Math.ceil((y1 - y0) * k)), c = cv.getContext('2d');
    c.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
    b = AC.bodyBuild[name] = { cv, c, step: 0 };
  }
  const F = A.field, nb = F.bands, k = F.bodyScale, Hpx = b.cv.height, rows = A.body.rimBatches + 1, s = b.step++, stage = Math.floor(s / nb) - 1, band = s % nb;
  b.c.save(); b.c.beginPath(); b.c.rect(F.extent[0], F.extent[1] + bandRow(Hpx, nb, band) / k, F.extent[2] - F.extent[0], (bandRow(Hpx, nb, band + 1) - bandRow(Hpx, nb, band)) / k); b.c.clip();
  BODY[name](b.c, stage);
  b.c.restore();
  if (s + 1 < rows * nb) return null;
  delete AC.bodyBuild[name];
  return (AC.body[name] = b.cv);
}
function bodyLayer(name) {
  while (!AC.body[name]) bodyStep(name);
  return AC.body[name];
}

// ----- Skin grain, pores and vignette -----
// One screen-sized overlay, built once per size: fine noise (a repeated tile of light and dark specks), scattered pores, and the vignette.
// The rows of a band of a canvas h device pixels tall cut into n bands, on whole pixels (so bands drawn on different frames meet without a seam).
const bandRow = (h, n, i) => Math.floor((i * h) / n);
// Built in stages, one small piece per call: the noise tile, the grain in bands, the pores, the vignette in bands. grainLayer finishes whatever is left at once.
function grainStep(E) {
  const F = A.field, k = Math.min(E.dpr || 1, F.grainMaxDpr), w = Math.ceil(E.w * k), h = Math.ceil(E.h * k), nb = F.bands;
  if (AC.grain && AC.gw === w && AC.gh === h) return AC.grain;
  let b = AC.grainBuild;
  if (!b || b.w !== w || b.h !== h) {
    const cv = mk(w, h);
    b = AC.grainBuild = { cv, c: cv.getContext('2d'), rng: makeRng(F.seed), w, h, k, stage: 0, pat: null };
  }
  const c = b.c, st = b.stage++;
  if (st === 0) { // the noise tile
    const N = F.tile, tile = mk(N, N), tc = tile.getContext('2d'), img = tc.createImageData(N, N), d = img.data, dark = rgbOf(P.skinShade), light = rgbOf(P.skinHi);
    for (let i = 0; i < N * N; i++) {
      const v = b.rng() * 2 - 1, col = v < 0 ? dark : light;
      d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = Math.round(Math.pow(Math.abs(v), F.grainCurve) * F.grain * 255);
    }
    tc.putImageData(img, 0, 0);
    b.pat = c.createPattern(tile, 'repeat');
  } else if (st <= nb) { // the grain, a band at a time
    const y0 = bandRow(h, nb, st - 1), y1 = bandRow(h, nb, st);
    c.fillStyle = b.pat; c.fillRect(0, y0, w, y1 - y0);
  } else if (st === nb + 1) { // the pores
    c.save(); c.scale(k, k); c.fillStyle = P.pore;
    const n = Math.round(E.w * E.h * F.poreDensity);
    for (let i = 0; i < n; i++) {
      c.globalAlpha = b.rng.range(F.poreAlpha0, F.poreAlpha1);
      c.beginPath(); c.arc(b.rng() * E.w, b.rng() * E.h, b.rng.range(F.poreR0, F.poreR1), 0, TAU); c.fill();
    }
    c.restore();
  } else { // the vignette, a band at a time
    const i = st - nb - 2, y0 = bandRow(h, nb, i), y1 = bandRow(h, nb, i + 1);
    if (i === 0) {
      const cx = E.w / 2, cy = E.h * 0.46, diag = Math.hypot(E.w, E.h), g = c.createRadialGradient(cx * k, cy * k, diag * k * F.vigInner, cx * k, cy * k, diag * k * F.vigOuter);
      g.addColorStop(0, rgba(P.drape, 0)); g.addColorStop(1, rgba(P.drape, F.vignette)); b.vig = g;
    }
    c.fillStyle = b.vig; c.fillRect(0, y0, w, y1 - y0);
    if (i === nb - 1) { AC.gw = w; AC.gh = h; AC.grainBuild = null; return (AC.grain = b.cv); }
  }
  return null;
}
function grainLayer(E) {
  let cv;
  while (!(cv = grainStep(E)));
  return cv;
}

// The field as one screen-sized bitmap: drape, body part and grain baked together for a given view, so a frame is one 1:1 blit. Two slots: the play view and the card's final
// view (the card eases between them, and until it settles it blits the body and the grain separately). Play keeps one per body part, all built while the menu shows.
function compStep(E, v, slot, name) {
  const F = A.field, k = Math.min(E.dpr || 1, F.compMaxDpr), w = Math.ceil(E.w * k), h = Math.ceil(E.h * k), nb = F.bands;
  const key = slot === 0 ? name : '#card'; // one baked field per body part for play, one for the card's final view
  let c = AC.comp[key];
  if (!c || c.w !== w || c.h !== h) c = AC.comp[key] = { cv: mk(w, h), w, h, name: '', s: 0, ox: 0, oy: 0, step: 0, done: false };
  if (c.name !== name || Math.abs(c.s - v.s) + Math.abs(c.ox - v.ox) + Math.abs(c.oy - v.oy) >= 1e-3) { c.name = name; c.s = v.s; c.ox = v.ox; c.oy = v.oy; c.step = 0; c.done = false; }
  if (c.done) return c;
  // one band of the body part, then (after all bands) one band of the grain, per call
  const g = c.cv.getContext('2d'), ex = F.extent, sc = v.s, st = c.step++, band = st % nb, y0 = bandRow(h, nb, band) / k, y1 = bandRow(h, nb, band + 1) / k;
  g.setTransform(k, 0, 0, k, 0, 0);
  g.save(); g.beginPath(); g.rect(0, y0, E.w, y1 - y0); g.clip();
  if (st < nb) {
    g.fillStyle = P.drape; g.fillRect(0, y0, E.w, y1 - y0);
    g.drawImage(bodyLayer(name), v.ox + ex[0] * sc, v.oy + ex[1] * sc, (ex[2] - ex[0]) * sc, (ex[3] - ex[1]) * sc);
  } else g.drawImage(grainLayer(E), 0, 0, E.w, E.h);
  g.restore();
  if (c.step >= 2 * nb) c.done = true;
  return c;
}
function fieldComp(E, v, slot, name = S.st.body) {
  let c;
  while (!(c = compStep(E, v, slot, name)).done);
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
    S.layerK = k; S.inkDone = []; S.inkFrom = 0; S.fillDrawn = 0;
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
  // a completed part is inked in full (the last sliver of it is the game's to lay)
  for (; S.fillDrawn < S.fills.length; S.fillDrawn++) { c.fillStyle = core; shapePath(c, S.st.parts[S.fills[S.fillDrawn]]); c.fill('evenodd'); }
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

// The slip marks and blots, in design space (the caller has set the transform): a cross per slip, and a splat per touch-down on skin.
function drawMarks(ctx) {
  ctx.lineCap = 'round';
  const m = T.slipMarkSize;
  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = pass ? P.slip : P.slipShadow; ctx.lineWidth = pass ? 3 : 5.5;
    for (const k of S.marks) {
      if (k.blot) continue;
      ctx.beginPath();
      ctx.moveTo(k.x - m, k.y - m); ctx.lineTo(k.x + m, k.y + m);
      ctx.moveTo(k.x + m, k.y - m); ctx.lineTo(k.x - m, k.y + m);
      ctx.stroke();
    }
  }
  // A blot (a touch-down on skin outside every line): a slip-red splat with its own shape, a dark rim and three specks, so it never reads as a cross.
  for (const k of S.marks) {
    if (!k.blot) continue;
    const R = T.blotRadius;
    ctx.fillStyle = P.slipShadow; ctx.beginPath(); ctx.arc(k.x, k.y, R + A.blot.rim, 0, TAU); ctx.fill();
    ctx.fillStyle = P.slip; ctx.beginPath(); ctx.arc(k.x, k.y, R, 0, TAU); ctx.fill();
    for (let i = 0; i < A.blot.specks; i++) { const a = A.blot.speckAngle + i * A.blot.speckStep, d = R + A.blot.speckDist; ctx.fillStyle = P.slip; ctx.beginPath(); ctx.arc(k.x + Math.cos(a) * d, k.y + Math.sin(a) * d, A.blot.speckR, 0, TAU); ctx.fill(); }
    ctx.fillStyle = P.slipShadow; ctx.beginPath(); ctx.arc(k.x, k.y, R * A.blot.core, 0, TAU); ctx.fill();
  }
}

// ----- The piece: field, ink, story, outline, slips -----
// One draw for play and for the card. `v` maps design space to the screen, `ct` is the card time (-1 while playing). The layers are kept at the play scale and
// the card only ever shrinks the piece, so nothing is rebuilt when the card opens.
function drawPiece(ctx, E, v, ct) {
  // the body flinch: the whole piece (skin, ink, outline, marks) shifts a few units and settles; the needle and the HUD do not move
  const fa = ct < 0 ? E.time - S.fx.flinchT : 9, fk = fa >= 0 && fa < J.flinchSec ? J.flinchAmp * v.s * (1 - fa / J.flinchSec) * (1 - fa / J.flinchSec) : 0;
  if (fk) { ctx.save(); ctx.translate(S.fx.flinchX * fk, S.fx.flinchY * fk); }
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
  drawMarks(ctx);
  ctx.restore();
  if (fk) ctx.restore();
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

// The same plate at a given opacity (a share of its usual one), for text that fades away.
function fadePlate(ctx, x, y, w, h, a) {
  ctx.globalAlpha = a * A.hud.plateAlpha; ctx.fillStyle = P.plate; ctx.beginPath(); rr(ctx, x, y, w, h, A.line.radius); ctx.fill();
  ctx.globalAlpha = a * 0.28; ctx.strokeStyle = P.cream; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
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

// The generated title image, once loaded (a failed or blocked load leaves the procedural title below as the title). Its menu metrics are measured from the bitmap.
function loadTitleImage() {
  const I = A.titleImg, img = new Image();
  img.onload = () => {
    if (!img.naturalWidth) return;
    AC.titleM = { w: I.w, h: Math.round((I.w * img.naturalHeight) / img.naturalWidth) + I.pad, glyphHalf: I.w / 2, glyphTop: I.pad / 2 };
    AC.titleImg = img;
  };
  img.src = (window.devicePixelRatio || 1) >= I.at3x ? I.src3 : I.src2;
}
// Title size on the menu: the image's while it is loaded, else the brush title's.
const titleMetrics = () => AC.titleM || A.title;
function drawTitle(ctx, E, x, y, ts) {
  const m = titleMetrics();
  if (AC.titleM) { ctx.imageSmoothingQuality = 'high'; ctx.drawImage(AC.titleImg, x, y + (A.titleImg.pad / 2) * ts, A.titleImg.w * ts, (m.h - A.titleImg.pad) * ts); }
  else ctx.drawImage(titleLayer(E), x, y, m.w * ts, m.h * ts);
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

// Idle work while the menu shows, one small piece per frame so no frame is long: the grain, each body part (its fill, then its rim in batches) and its baked field (two
// stages), then every stencil's coverage grid (a few milliseconds a frame, the stencil Play would open first) and outline path, and the outline bitmap of that first
// stencil. A bitmap stage is forced to rasterise here (a one-pixel read) rather than on the first play frame.
function warmStep(E, next) {
  const F = A.field, nb = F.bands, names = Object.keys(BODY), first = STENCILS[next].body, order = [first, ...names.filter((n) => n !== first)];
  const flush = (cv) => cv.getContext('2d').getImageData(0, 0, 1, 1), grainSteps = nb * 2 + 2, bodySteps = (A.body.rimBatches + 1) * nb, compSteps = 2 * nb;
  const w = AC.warm, total = grainSteps + names.length * (bodySteps + compSteps);
  if (w < total) {
    AC.warm++;
    if (w < grainSteps) { const cv = grainStep(E); flush(cv || AC.grainBuild.cv); return; }
    const i = w - grainSteps, bi = Math.floor(i / (bodySteps + compSteps)), r = i % (bodySteps + compSteps), name = order[bi];
    if (r < bodySteps) { const cv = bodyStep(name); flush(cv || AC.bodyBuild[name].cv); } else flush(compStep(E, view(E), 0, name).cv);
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
// pass per stencil. land: { idx: { n, c, ok, st } } landings, clean landings, a finished pass with all landings clean and the best stars of a finished pass, for stencils in parts. badges: { id: true } once earned. skin: { machine, ink } skin ids (each counts only while its badge is earned). daily: { 'YYYY-MM-DD': { idx, vi, first, best } } for the last dailyKeep days.

function progress(E) {
  const best = E.save.get('best', {}), stars = E.save.get('stars', {}), clean = E.save.get('clean', {}), cs = E.save.get('cs', {}), badges = E.save.get('badges', {}), land = E.save.get('land', {});
  let unlocked = clamp(E.save.get('unlocked', 0), 0, STENCILS.length - 1), total = 0;
  for (let i = 0; i < STENCILS.length; i++) total += stars[i] || 0;
  const finaleShut = unlocked >= FINALE && !finaleOpen(stars); // the finale (PRD v0.8 D) waits for a star on every other stencil
  if (finaleShut) unlocked = FINALE - 1;
  return { best, stars, clean, cs, badges, land, unlocked, total, finaleShut };
}
const finaleOpen = (stars) => STENCILS.every((s, i) => i === FINALE || (stars[i] || 0) > 0);

function recordResult(E, idx, { pct, stars, ruined, clean, landings, cleanLand, steady, done }) {
  const p = progress(E);
  if (!ruined && pct > (p.best[idx] || 0)) E.save.set('best', { ...p.best, [idx]: pct });
  if (stars > (p.stars[idx] || 0)) E.save.set('stars', { ...p.stars, [idx]: stars });
  if (clean && !p.clean[idx]) E.save.set('clean', { ...p.clean, [idx]: true });
  if (clean && stars > (p.cs[idx] || 0)) E.save.set('cs', { ...p.cs, [idx]: stars }); // best stars of a zero-slip pass (the Serpent and Bone badges)
  if (landings) { // stencils in parts: lifetime landings and clean landings, and whether any pass had every landing clean (the Steady Landing badge)
    const o = p.land[idx] || { n: 0, c: 0, ok: 0, st: 0 };
    // st: best stars of a pass with every part complete, made on the split version (stars saved before a stencil was split never count toward Set Piece)
    E.save.set('land', { ...p.land, [idx]: { n: o.n + landings, c: o.c + cleanLand, ok: o.ok || (steady ? 1 : 0), st: Math.max(o.st || 0, done ? stars : 0) } });
  }
  if (stars >= 1) E.save.set('unlocked', Math.max(E.save.get('unlocked', 0), Math.min(idx + 1, STENCILS.length - 1))); // progress() holds the finale back until it is earned
  if (idx === FINALE && stars >= 4 && !E.save.get('shopYours', false)) { E.save.set('shopYours', true); ledger(E, 'shop', { stars }); } // the first 4-star finish (PRD v0.8 D)
}

// ---------- Playtest ledger (ADR-0016) ----------
// One line per result, retry, quit, badge, skin change and daily result, written through the engine's ledger (the headless simulator has none). Numbers and strings only.
const ledger = (E, kind, data) => { if (E.ledger) E.ledger.add(kind, data); };
// The timer preset the multipliers match (Relaxed, Standard, Tight), or 'custom' once a slider has moved them.
function presetName() {
  const hit = (game.presets || []).find((pr) => Object.entries(pr.values).every(([k, v]) => T[k] === v));
  return hit ? hit.label : 'custom';
}
// The newest badges, highest tier first (the card shows the top few as tickets).
const byTier = (list) => list.slice().sort((x, y) => y.tier - x.tier);
// The Hint toggle (menu, beside Sound; saved as `hint`, on unless switched off; both channels). Off sets hintPercent to 101 so the gap glow never shows (Blind needs that); on
// puts back hintOnPercent if it was off, and leaves a TUNE slider value alone.
const hintOn = (E) => E.save.get('hint', true) !== false;
function applyHint(E) {
  if (!hintOn(E)) T.hintPercent = 101;
  else if (T.hintPercent >= 101) T.hintPercent = T.hintOnPercent;
}
const blotsOf = () => S.marks.filter((k) => k.blot).length;

// ---------- Scenes ----------

const menu = {
  enter(E) { this.btnPlay = null; this.btnMute = null; this.btnMissions = null; this.btnStory = null; this.btnDaily = null; this.btnHint = null; this.tiles = []; this.popIdx = menuPopIdx; this.popT = E.time; menuPopIdx = -1; this.daily = dailyToday(E); this.dayT = E.time; applyHint(E); this.scroll = 0; this.drag = null; this.focus = true; this.gridView = { top: 0, h: 0, max: 0 }; this.titleBox = { x: 0, y: 0, w: 0, h: 0 }; applySkins(E); },
  // The vertical layout comes from the height there is. The title shrinks (to titleMin) until rowsSeen rows of tiles at tileWant fit between the count row and the daily strip;
  // the daily strip and Play stay fixed under the grid. If every row fits at tileMin or more the grid is laid out whole and grows to tileMax; if not, the grid scrolls in a
  // window that shows a whole number of rows and a peek of the next (tiles never below tileMin). The title also drops below the engine's TUNE tab when its letters would run
  // under it. `out` is filled with the positions (nothing is allocated per frame).
  layout(E, rows, out, strip = 0) {
    const M = A.menu, cx = E.w / 2, top = E.safe.top, availBottom = E.h - E.safe.bottom, gap = T.gridGap, tabX = E.w - M.tab.w - E.safe.right, tabBottom = top + M.tab.y + M.tab.h;
    const TM = titleMetrics(), below = M.gapDaily + M.dailyH + M.gapPlay + M.playH + M.botPad;
    const rest = (ts) => {
      const y0 = Math.max(top + M.topPad, cx + TM.glyphHalf * ts + 8 > tabX ? tabBottom + 4 - TM.glyphTop * ts : 0);
      const rowY = y0 + TM.h * ts + M.rowH / 2, tilesTop = rowY + M.rowH / 2 + strip + M.gapTag;
      return { y0, rowY, tilesTop, viewH: availBottom - below - tilesTop };
    };
    const seen = Math.min(rows, M.rowsSeen), want = seen * M.tileWant + (seen - 1) * gap;
    let ts = 1, r = rest(1);
    while (r.viewH < want && ts > M.titleMin) { ts = Math.max(M.titleMin, ts - 0.05); r = rest(ts); }
    const viewH = Math.max(r.viewH, M.tileMin);
    let th, gridH, slack = 0;
    if (rows * M.tileMin + (rows - 1) * gap <= viewH) { // everything fits: whole grid, tiles grow to tileMax, spare height moves the title down a little
      th = clamp((viewH + gap) / rows - gap, M.tileMin, M.tileMax); gridH = rows * th + (rows - 1) * gap; slack = Math.max(0, viewH - gridH) * M.slackTop;
    } else { // scrolling: the most rows k (and a 0.4 row peek) that keep tiles at tileMin or more
      let k = 1;
      while (k < rows && (viewH + gap) / (k + 1.4) - gap >= M.tileMin) k++;
      th = Math.min((viewH + gap) / (k + 0.4) - gap, M.tileMax); gridH = viewH;
    }
    out.ts = ts; out.th = th; out.y0 = r.y0 + slack; out.rowY = r.rowY + slack; out.tilesTop = r.tilesTop + slack; out.viewH = gridH;
    out.max = Math.max(0, rows * th + (rows - 1) * gap - gridH);
    out.dailyY = out.tilesTop + gridH + M.gapDaily + M.dailyH / 2; out.playY = out.dailyY + M.dailyH / 2 + M.gapPlay + M.playH / 2;
    return out;
  },
  render(ctx, E) {
    const cx = E.w / 2, p = progress(E), gap = T.gridGap, cols = T.gridCols, M = A.menu, L = A.line, rows = Math.ceil(STENCILS.length / cols);
    if (!AC.tilt) { const r = makeRng(A.field.seed + 7); AC.tilt = STENCILS.map(() => (r() * 2 - 1) * M.tilt); }
    if (E.time - this.dayT > 1) { this.dayT = E.time; this.daily = dailyToday(E); } // the app can stay open across UTC midnight
    // The first frames of a launch build the board, the title and the tile previews one at a time (plain paper first), so none of them is long.
    if (AC.boot < A.menu.bootFrames) {
      const b = AC.boot++;
      ctx.fillStyle = P.board; ctx.fillRect(0, 0, E.w, E.h);
      if (b >= 1) ctx.drawImage(boardLayer(E), 0, 0, E.w, E.h);
      if (b >= 2) drawTitle(ctx, E, E.w / 2 - titleMetrics().w / 2, E.safe.top + A.menu.topPad, 1);
      if (b === 3) { for (let i = 0; i < STENCILS.length; i++) miniPath(i); machineGfx(ctx, SK.m); }
      if (b < A.menu.bootFrames - 1) return;
    }
    ctx.drawImage(boardLayer(E), 0, 0, E.w, E.h);

    const rankStr = E.save.get('shopYours', false) ? 'The Lucky Needle, yours' : RANKS[rankOf(p.total)].name, rankRoom = E.w - M.margin - M.missionsW - 8 - M.storyW - 8 - (M.margin + 2), rankWide = wrapText(rankStr, rankRoom, FONT.small).length > 1; // a rank name that will not fit beside the buttons gets its own line under the row
    const Y = this.layout(E, rows, this.pos || (this.pos = {}), rankWide ? M.rankStrip : 0), m = M.margin, tw = (E.w - 2 * m - (cols - 1) * gap) / cols, th = Y.th;
    const TM = titleMetrics();
    drawTitle(ctx, E, cx - (TM.w * Y.ts) / 2, Y.y0, Y.ts);
    // The pen sits left of the title, below the engine's EXPORT tab (top left, 72 x 44) and above the count row, so it is never under either.
    { const penTop = E.safe.top + 4 + 44 + 6, rowTop = Y.rowY - M.rowH / 2 - 2, k = Math.min(clamp((cx - TM.glyphHalf * Y.ts - m - 8) / 60, 0.3, A.skins.swatch.pen), (rowTop - penTop) / (2 * M.penHalf));
      if (k >= M.penMin) drawPen(ctx, m + (cx - TM.glyphHalf * Y.ts - m) / 2 - 2, (penTop + rowTop) / 2, k); }
    // Where the INK title really is, for the release channel's five title taps (ADR-0016).
    Object.assign(this.titleBox, { x: cx - TM.glyphHalf * Y.ts, y: Y.y0, w: 2 * TM.glyphHalf * Y.ts, h: TM.h * Y.ts });
    { const ex = E._exportTab, tb = this.titleBox; if (ex && tb.x < ex.x + ex.w + 2 && tb.y < ex.y + ex.h) { const cut = ex.x + ex.w + 2 - tb.x; tb.x += cut; tb.w -= cut; } } // keep the title's tap box off the EXPORT tab
    E.titleArea = this.titleBox;
    const str = `${p.total} / ${STENCILS.length * T.starPercents.length}`;
    drawStar(ctx, m + 11, Y.rowY - M.rankDy - 1, 10, true);
    ctx.font = FONT.mid; // 155 stars at most (31 stencils): on a narrow phone the count drops to the small font before it would run under the Story button
    label(ctx, str, m + 26, Y.rowY - M.rankDy, ctx.measureText(str).width <= E.w - m - M.missionsW - 8 - M.storyW - 8 - (m + 26) ? FONT.mid : FONT.small, P.textDark, 'left');
    label(ctx, rankStr, m + 2, Y.rowY + M.rankDy + 5 + (rankWide ? M.rowH / 2 - M.rankDy - 5 + M.rankStrip / 2 : 0), FONT.small, P.textMute, 'left'); // the ladder, quietly (PRD v0.7 D)
    this.btnMissions = inkButton(ctx, 'Missions', E.w - m - M.missionsW / 2, Y.rowY, M.missionsW, M.rowH, false, FONT.small);
    this.btnStory = inkButton(ctx, 'Story', E.w - m - M.missionsW - 8 - M.storyW / 2, Y.rowY, M.storyW, M.rowH, false, FONT.small);

    this.tiles = [];
    const gv = this.gridView; gv.top = Y.tilesTop; gv.h = Y.viewH; gv.max = Y.max;
    if (this.focus) { // on entering, bring the row of the next stencil to play into view
      this.focus = false;
      const rowTop = Math.floor(p.unlocked / cols) * (th + gap);
      if (rowTop + th > this.scroll + gv.h || rowTop < this.scroll) this.scroll = rowTop - (gv.h - th) / 2;
    }
    this.scroll = clamp(this.scroll, 0, gv.max);
    if (gv.max > 0) { ctx.save(); ctx.beginPath(); ctx.rect(0, gv.top - 4, E.w, gv.h + 4); ctx.clip(); }
    STENCILS.forEach((st, i) => {
      const x = m + (i % cols) * (tw + gap), y = Y.tilesTop + Math.floor(i / cols) * (th + gap) - this.scroll;
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
    if (gv.max > 0) { // scrolling: the clip ends, and a thin bar shows where the window is
      ctx.restore();
      const bh = Math.max(24, gv.h * gv.h / (gv.h + gv.max));
      ctx.globalAlpha = 0.45; ctx.fillStyle = P.ink; ctx.beginPath(); rr(ctx, E.w - 6, gv.top + (gv.h - bh) * (this.scroll / gv.max), 3, bh, 1.5); ctx.fill(); ctx.globalAlpha = 1;
    }

    this.btnDaily = this.drawDaily(ctx, E, Y.dailyY, m);
    // Bottom row: Play, then Hint and Sound, centred as a group.
    const pw = E.w - 2 * m - 2 * (M.soundW + 10), px = Math.min(pw, 224), left = cx - (px + 2 * (M.soundW + 10)) / 2;
    this.btnPlay = inkButton(ctx, p.unlocked > 0 ? `Play ${p.unlocked + 1}` : 'Play', left + px / 2, Y.playY, px, M.playH, true, FONT.big);
    this.btnHint = hintButton(ctx, left + px + 10 + M.soundW / 2, Y.playY, M.soundW, M.playH, hintOn(E));
    this.btnMute = soundButton(ctx, left + px + 20 + M.soundW * 1.5, Y.playY, M.soundW, M.playH, E.audio.muted);
    if (AC.warmGo) warmStep(E, p.unlocked); else AC.warmGo = true; // the warm-up starts the frame after the first full render
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
    label(ctx, rec.first < 0 ? `${st.variant}  ${dailyTimer(st)} s` : `${st.variant}  ${rec.first}%${rec.best > rec.first ? `  best ${rec.best}%` : ''}`, tx, cy + 10, FONT.small, P.textMute, 'left');
    drawPin(ctx, x + w - M.cardR - 12, y + 9, M.pinR);
    return { x, y, w, h };
  },
  onTap(p, E) {
    if (E.hit(this.btnPlay, p)) { E.audio.play('tap'); E.setScene(...route(E, 'play', { stencil: progress(E).unlocked })); return; }
    if (E.hit(this.btnMute, p)) { E.audio.toggleMute(); E.audio.play('tap'); return; }
    if (E.hit(this.btnHint, p)) { const on = !hintOn(E); E.save.set('hint', on); applyHint(E); E.audio.play('tap'); ledger(E, 'hint', { on }); return; }
    if (E.hit(this.btnMissions, p)) { E.audio.play('tap'); E.setScene('missions'); return; }
    if (E.hit(this.btnStory, p)) { E.audio.play('tap'); E.setScene('story', { replay: true }); return; }
    if (E.hit(this.btnDaily, p)) { E.audio.play('tap'); E.setScene('play', { daily: true }); return; }
    const gv = this.gridView, hit = p.y >= gv.top && p.y <= gv.top + gv.h && this.tiles.find((t) => E.hit(t, p));
    if (hit && hit.locked) { if (hit.idx === FINALE && progress(E).finaleShut) E.toast('Star every other piece first'); return; }
    if (hit) { E.audio.play('tap'); E.setScene(...route(E, 'play', { stencil: hit.idx })); }
  },
  // Dragging the grid scrolls it when there are more rows than fit; a quick still touch is a tap (the engine tells them apart).
  onPointerDown(p) { const gv = this.gridView; this.drag = gv && gv.max > 0 && p.y >= gv.top && p.y <= gv.top + gv.h ? { y: p.y, scroll: this.scroll } : null; },
  onPointerMove(p) { if (this.drag) this.scroll = clamp(this.drag.scroll - (p.y - this.drag.y), 0, this.gridView.max); },
  onPointerUp() { this.drag = null; },
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

// The hint toggle: the word HINT over a small switch, stencil blue and knob right when on, grey and knob left when off.
function hintButton(ctx, cx, cy, w, h, on) {
  const x = cx - w / 2, y = cy - h / 2, L = A.line;
  ctx.globalAlpha = L.shadowAlpha; ctx.fillStyle = P.shadow; ctx.beginPath(); rr(ctx, x + L.shadowDx, y + L.shadowDy, w, h, L.radius); ctx.fill(); ctx.globalAlpha = 1;
  ctx.beginPath(); rr(ctx, x, y, w, h, L.radius); ctx.fillStyle = P.paperShade; ctx.fill();
  ctx.lineWidth = L.weight; ctx.strokeStyle = P.ink; ctx.beginPath(); rr(ctx, x + 4, y + 4, w - 8, h - 8, L.radius - 4); ctx.globalAlpha = 0.55; ctx.stroke(); ctx.globalAlpha = 1;
  label(ctx, 'HINT', cx, cy - A.menu.hintLabelDy, FONT.small, on ? P.textDark : P.textMute);
  const M = A.menu, sw = M.hintSwW, sh = M.hintSwH, sx = cx - sw / 2, sy = cy + M.hintSwDy;
  ctx.beginPath(); rr(ctx, sx, sy, sw, sh, sh / 2); ctx.fillStyle = on ? P.stencilDeep : P.lock; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = P.ink; ctx.stroke();
  ctx.beginPath(); ctx.arc(on ? sx + sw - sh / 2 : sx + sh / 2, sy + sh / 2, sh / 2 - 2, 0, TAU); ctx.fillStyle = P.paper; ctx.fill(); ctx.stroke();
  return { x, y, w, h };
}

// A badge medal: a disc in the tier's colour with a star, or a dull disc with a lock while unearned.
function drawMedal(ctx, cx, cy, r, tier, earned) {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fillStyle = earned ? P.medal[tier] : P.paperShade; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = earned ? P.ink : P.paperEdge; ctx.stroke();
  if (earned) { starPath(ctx, cx, cy + 0.5, r * 0.62); ctx.fillStyle = P.ink; ctx.fill(); }
  else drawLock(ctx, cx, cy - 1, r / 18);
}

// The missions screen: the badges by tier, earned ones in colour and the rest with how far along they are. The list scrolls by dragging; Back is fixed at the top left, so the engine's toast (bottom of the screen) never covers it.
const missions = {
  enter(E) { this.scroll = 0; this.drag = null; this.btnBack = null; this.btnFolio = null; this.moved = 0; this.swatches = []; applySkins(E); },
  skinsH() { const M = A.missions, W = A.skins.swatch; return M.headH + 2 * (W.headH + W.size + W.rowGap) + 6; },
  textW(E) { return E.w - 2 * A.menu.margin - (14 + 2 * A.missions.medalR + 12) - 12; }, // room for a badge's line of text on its tile
  rowH(E, b) { const M = A.missions; return M.rowH + (wrapText(b.text, this.textW(E), FONT.small).length - 1) * M.lineH; }, // a long line wraps and the tile grows
  content(E) { const M = A.missions; return M.folioH + this.skinsH() + BADGE_TIERS.length * M.headH + BADGES.reduce((n, b) => n + this.rowH(E, b) + M.rowGap, 0); },
  view(E) { const M = A.missions, top = E.safe.top + M.top, bot = E.h - E.safe.bottom - M.bottom; return { top, bot, max: Math.max(0, this.content(E) - (bot - top)) }; },
  render(ctx, E) {
    const M = A.missions, p = progress(E), V = this.view(E), m = A.menu.margin, w = E.w - 2 * m, L = A.line;
    ctx.drawImage(boardLayer(E), 0, 0, E.w, E.h);
    label(ctx, 'Missions', E.w / 2 + 14, E.safe.top + 30, FONT.big, P.textDark);
    const earned = BADGES.filter((b) => p.badges[b.id]).length;
    label(ctx, `${earned} / ${BADGES.length}`, E.w - m, E.safe.top + 30, FONT.mid, P.textMute, 'right');
    this.scroll = clamp(this.scroll, 0, V.max);
    ctx.save(); ctx.beginPath(); ctx.rect(0, V.top, E.w, V.bot - V.top); ctx.clip();
    let y = V.top - this.scroll;
    this.btnFolio = inkButton(ctx, 'Portfolio', E.w / 2, y + (M.folioH - 8) / 2, w, M.folioH - 8, false, FONT.mid);
    y += M.folioH;
    y = this.drawSkins(ctx, E, p, y, V, m, w);
    BADGE_TIERS.forEach((tn, tier) => {
      const inTier = BADGES.filter((b) => b.tier === tier);
      ctx.fillStyle = P.medal[tier]; ctx.beginPath(); ctx.arc(m + 6, y + M.headH / 2 + 2, 6, 0, TAU); ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5; ctx.stroke();
      label(ctx, `${tn.toUpperCase()}  ${inTier.filter((b) => p.badges[b.id]).length}/${inTier.length}`, m + 20, y + M.headH / 2 + 2, FONT.small, P.textDark, 'left');
      y += M.headH;
      for (const b of inTier) {
        const got = !!p.badges[b.id], g = got ? null : badgeProgress(b, p), h = this.rowH(E, b);
        if (y + h > V.top && y < V.bot) {
          ctx.globalAlpha = L.shadowAlpha; ctx.fillStyle = P.shadow; ctx.beginPath(); rr(ctx, m + L.shadowDx, y + L.shadowDy, w, h, A.menu.cardR); ctx.fill(); ctx.globalAlpha = 1;
          ctx.fillStyle = got ? P.paper : P.paperShade; ctx.beginPath(); rr(ctx, m, y, w, h, A.menu.cardR); ctx.fill();
          ctx.strokeStyle = got ? P.ink : P.paperEdge; ctx.lineWidth = got ? 1.6 : 1; ctx.stroke();
          drawMedal(ctx, m + 14 + M.medalR, y + h / 2, M.medalR, tier, got);
          const tx = m + 14 + 2 * M.medalR + 12;
          label(ctx, b.name, tx, y + 20, FONT.mid, got ? P.textDark : P.textMute, 'left');
          wrapText(b.text, this.textW(E), FONT.small).forEach((ln, i) => label(ctx, ln, tx, y + 43 + i * M.lineH, FONT.small, P.textMute, 'left'));
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
    this.btnBack = inkButton(ctx, 'Back', m + M.backW / 2, E.safe.top + 30, M.backW, M.backH, true, FONT.mid);
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
    const V = this.view(E);
    if (p.y >= V.top && p.y <= V.bot && this.btnFolio && E.hit(this.btnFolio, p)) { E.audio.play('tap'); E.setScene('folio'); return; }
    const sw = p.y >= V.top && p.y <= V.bot && this.swatches.find((s) => E.hit(s, p));
    if (!sw) return;
    if (!sw.owned) { E.toast(`${sw.sk.name} ${sw.kind === 'machine' ? 'machine' : 'ink'}: earn the ${BADGES.find((b) => b.id === sw.sk.badge).name} badge`); return; }
    E.save.set('skin', { ...E.save.get('skin', {}), [sw.kind]: sw.sk.id });
    applySkins(E); E.audio.play('tap');
    ledger(E, 'skin', { kind: sw.kind, skin: sw.sk.id });
  },
};

// The HUD: the percentage is the hero, big and centred, with a dark outline so it holds on skin; the timer and the slips sit on small dark plates either side.
function drawHud(ctx, E) {
  const H = A.hud, R = H.ring, top = E.safe.top + T.hudTop, cx = E.w / 2, now = E.time, f = S.fx, ty = top + R + 2, o = A.type.outline, ph = H.plateH, m = A.menu.margin;
  // The timer is the biggest thing here (PRD v0.6 section A): a numeral in a ring that drains clockwise, cream, amber once a third of the time is gone, pulsing in the last
  // few seconds. It sits top centre, never near the thumb. The percentage is smaller, beside it.
  const left = S.time / S.total, low = S.started && !S.ended && left <= H.amberAt, col = low ? P.amber : P.cream, rr_ = R - H.ringW / 2;
  ctx.globalAlpha = H.plateAlpha; ctx.fillStyle = P.plate; ctx.beginPath(); ctx.arc(cx, ty, R, 0, TAU); ctx.fill();
  ctx.lineCap = 'round'; ctx.lineWidth = H.ringW;
  ctx.globalAlpha = H.ringTrack; ctx.strokeStyle = P.cream; ctx.beginPath(); ctx.arc(cx, ty, rr_, 0, TAU); ctx.stroke();
  ctx.globalAlpha = 1;
  if (left > H.ringHide) { ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(cx, ty, rr_, -Math.PI / 2 + TAU * (1 - clamp(left, 0, 1)), -Math.PI / 2 + TAU); ctx.stroke(); }
  const tk = S.started && !S.ended && S.time <= J.timerPulseSecs ? pop(now - f.secT, J.timerPulseSec, J.timerPulseFrom) : 1, sec = Math.ceil(S.time), big = sec >= H.timerBig;
  plabel(ctx, NUM[sec], cx, ty + 2, tk, big ? FONT.mid : FONT.timer, col, 'center', (big ? A.type.mid : A.type.timer) * o * 0.6, P.ink);
  // Percentage: pops on each whole-percent step from the first star threshold up, harder on a threshold, and glows star colour after one.
  const pk = pop(now - f.pctT, f.pctFrom === J.pctThresholdFrom ? J.pctThresholdSec : J.pctStepSec, f.pctFrom), pstr = PCT[percent()];
  plabel(ctx, pstr, m, ty + 1, pk, FONT.big, P.cream, 'left', A.type.big * o);
  const glowA = 1 - (now - f.pctStarT) / J.pctStarSec;
  if (glowA > 0 && glowA <= 1) { ctx.globalAlpha = glowA; plabel(ctx, pstr, m, ty + 1, pk, FONT.big, P.gold, 'left', 0); ctx.globalAlpha = 1; }
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

// Split stencils judge the landing blind (the needle is not shown before it touches), so for the first seconds a plate near the bottom of the screen, clear of every piece, says how.
function drawIntro(ctx, E) {
  const I = A.intro, age = E.time - S.introT;
  if (!S.st.parts || S.ended || age < 0 || age >= I.sec) return;
  const w = Math.min(E.w - 2 * A.menu.margin, I.maxW), lines = wrapText(I.text, w - 2 * I.pad, FONT.small), h = lines.length * I.lineH + 2 * I.pad;
  const a = clamp((I.sec - age) / I.fade, 0, 1);
  fadePlate(ctx, (E.w - w) / 2, E.h - E.safe.bottom - I.bottom - h, w, h, a);
  ctx.globalAlpha = a;
  lines.forEach((ln, i) => label(ctx, ln, E.w / 2, E.h - E.safe.bottom - I.bottom - h + I.pad + I.lineH * (i + 0.5), FONT.small, P.cream));
  ctx.globalAlpha = 1;
}
// The first blot of a piece: a short plate just above the mark, kept on screen, so the player learns what the red disc is.
function drawCallout(ctx, E) {
  const C = A.callout, k = S.callout;
  if (!k) return;
  const age = E.time - k.t;
  if (age < 0 || age >= C.sec) return;
  const v = view(E), sx = v.ox + k.x * v.s, sy = v.oy + k.y * v.s;
  ctx.font = FONT.small;
  const w = ctx.measureText(C.text).width + 2 * C.pad, x = clamp(sx - w / 2, 4, E.w - w - 4), y = Math.max(E.safe.top + 4, sy - (T.blotRadius + C.gap) * v.s - C.h);
  const a = clamp((C.sec - age) / C.fade, 0, 1);
  fadePlate(ctx, x, y, w, C.h, a);
  ctx.globalAlpha = a;
  label(ctx, C.text, x + w / 2, y + C.h / 2 + 1, FONT.small, P.cream);
  ctx.globalAlpha = 1;
}

const play = {
  enter(E, { stencil = 0, daily = false } = {}) { applySkins(E); applyHint(E); if (daily) dailyToday(E); newAttempt(daily ? DAILY_IDX : clamp(stencil, 0, STENCILS.length - 1), daily); S.hintOff = !hintOn(E); S.introT = E.time; const c = !daily && castOf(S.st); if (c) loadClient(c.id); },
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
    const clean = !failed && S.slips === 0, landings = S.landings, cleanLand = S.cleanLand, done = S.ended === 'full', steady = done && landings > 0 && cleanLand === landings; // steady: every part complete and every landing clean
    const a = { daily: S.daily, pct, stars, ruined, failed, clean, lifts99: S.lifts99, used: S.total - S.time, total: S.total, hintOff: S.hintOff, maxR: S.maxR };
    const res = { stencil: S.st.name, percent: pct, stars, clean, slips: S.slips, blots: blotsOf(), landings, clean_landings: cleanLand, time: +a.used.toFixed(1), preset: presetName(), hint: !S.hintOff, ended: S.ended, daily: S.daily };
    ledger(E, 'result', res);
    const had = E.save.get('badges', {});
    if (S.daily) { // the daily counts for the daily only: no stars, unlocks or badges (Second Skin is the one trick it can earn)
      const wasFirst = (E.save.get('daily', {})[S.dailyKey] || { first: -1 }).first < 0, rec = recordDaily(E, S.dailyKey, pct, ruined);
      const tr = trickBadges(a), fresh = BADGES.filter((b) => tr[b.id] && !had[b.id]);
      if (fresh.length) E.save.set('badges', { ...had, ...tr });
      S.tickets = ticketFit(E, fresh.length);
      ledger(E, 'daily', { stencil: S.st.name, variant: S.st.variant, percent: pct, first: wasFirst, best: rec ? rec.best : pct, ruined });
      for (const b of fresh) ledger(E, 'badge', { badge: b.name, tier: BADGE_TIERS[b.tier], stencil: S.st.name });
      E.setScene('over', { idx: S.idx, pct, stars, failed, clean, best: rec ? rec.first : pct, boss: S.st.boss, daily: true, ruined, wasFirst, last: false, starsUp: false, newBadges: byTier(fresh), landings, cleanLand });
      return;
    }
    const starsUp = stars > (progress(E).stars[S.idx] || 0);
    recordResult(E, S.idx, { pct, stars, ruined, clean, landings, cleanLand, steady, done });
    const now = { ...earnedBadges(progress(E)), ...trickBadges(a) }, fresh = BADGES.filter((b) => now[b.id] && !had[b.id]);
    if (fresh.length) E.save.set('badges', { ...had, ...now });
    S.tickets = ticketFit(E, fresh.length, !!castOf(S.st));
    for (const b of fresh) ledger(E, 'badge', { badge: b.name, tier: BADGE_TIERS[b.tier], stencil: S.st.name });
    const rk = rankOf(progress(E).total), over = { idx: S.idx, pct, stars, failed, clean, ruined, best: progress(E).best[S.idx] || 0, boss: S.st.boss, last: S.idx + 1 > progress(E).unlocked, starsUp, newBadges: byTier(fresh), landings, cleanLand, rankUp: rk > E.save.get('rankSeen', 0) ? rk : 0 };
    E.setScene('over', over);
  },
  // Leaving a piece that was started and not finished (the app going to the background, or any scene change) is a quit, logged once.
  quit(E) {
    if (!S.started || S.ended || S.quit) return;
    S.quit = true;
    ledger(E, 'quit', { stencil: S.st.name, percent: percent(), slips: S.slips, time: S.total - S.time, daily: S.daily });
  },
  onPause(E) { this.quit(E); },
  exit(E) { this.quit(E); },
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
    drawIntro(ctx, E);
    drawCast(ctx, E);
    drawCallout(ctx, E);
  },
};

// The card. Timeline (seconds from enter): the piece eases into a large showcase position and the paper card slides up; stars pop in one by one with a coin each;
// then "Clean" is stamped; the buttons appear only after the beat and only then take taps, so a tap during the animation is never swallowed by a button.
const IDV = { s: 1, ox: 0, oy: 0 }; // the identity view, for effects drawn in design space inside an already-placed piece
const CV = { s: 1, ox: 0, oy: 0 }, LV = { s: 1, ox: 0, oy: 0 }; // the card's piece view, and the view eased between the play view and it
const cardBoxFor = (E, b) => {
  const C = A.card;
  b.w = Math.min(C.w, E.w - 2 * C.pad); b.h = C.h + (S.st.parts ? C.landH : 0); b.x = E.w / 2 - b.w / 2; b.y = E.h - E.safe.bottom - b.h - C.pad;
  return b;
};
// Where the finished piece sits on the card: as large as fits above the paper card, never larger than it was in play.
const CB = { x: 0, y: 0, w: 0, h: 0 };
// The client's result card (PRD v0.7 C2), top to bottom: the portrait as large as fits, the badge tickets (n of them, stacked upward from the tray), the paper tray (caption, the
// client's line, percent and stars, best and stamp), the buttons. The tray and the buttons take what they need and the portrait takes the rest, so nothing sits over the face.
const CL = { px: 0, py: 0, pw: 0, ph: 0, tx: 0, ty: 0, tw: 0, th: 0, by: 0, lines: null };
function clientLayout(E, n, str, o = CL) {
  const R = A.reveal, B = A.badge, F = R.frame, m = A.menu.margin;
  const tw = Math.min(R.trayMaxW, E.w - 2 * m), lines = wrapText(str, tw - 2 * R.sidePad, FONT.mid), th = 2 * R.trayPad + R.capH + lines.length * R.lineH + R.statH + R.metaH;
  const slot = n ? R.gap + n * (B.h + B.gap) - B.gap : 0, availH = E.h - E.safe.top - E.safe.bottom - R.top - R.bottom, rest = 2 * F + R.gap + slot + th + R.btnGap + R.btnH;
  const pw = Math.min(R.portraitMaxW, E.w - 2 * m - 2 * F, ((availH - rest) * 3) / 4), ph = (pw * 4) / 3, y0 = E.safe.top + R.top + Math.max(0, (availH - ph - rest) / 2);
  o.pw = pw; o.ph = ph; o.px = (E.w - pw) / 2; o.py = y0 + F; o.tw = tw; o.tx = (E.w - tw) / 2; o.th = th; o.ty = o.py + ph + F + R.gap + slot; o.by = o.ty + th + R.btnGap + R.btnH / 2; o.lines = lines;
  return o;
}
// How many badge tickets can stack over the card and still leave the piece its minimum scale (never covering it): as many as were earned, up to badge.max, fewer where the
// screen is short.
function ticketFit(E, want, client) {
  const C = A.card, B = A.badge, b = cardBoxFor(E, CB), bb = bboxOf(S.idx), top = E.safe.top + C.topPad;
  let n = Math.min(want, B.max);
  if (client) { while (n > 1 && clientLayout(E, n, '').pw < A.reveal.minW) n--; } // a client's portrait keeps its width; the tickets give way first
  else while (n > 1 && (b.y - C.pieceGap - (n - 1) * (B.h + B.gap) - top) / bb.h < C.minScale) n--;
  return n;
}
function cardViewFor(E, out) {
  const C = A.card, b = cardBoxFor(E, CB), bb = bboxOf(S.idx), top = E.safe.top + C.topPad, bot = b.y - C.pieceGap - Math.max(0, S.tickets - 1) * (A.badge.h + A.badge.gap);
  out.s = clamp(Math.min((E.w - 2 * C.sidePad) / Math.max(bb.w, STORY_W[S.st.story] || 0), (bot - top) / bb.h), C.minScale, C.maxScale * view(E).s);
  out.ox = E.w / 2 - bb.cx * out.s; out.oy = (top + bot) / 2 - bb.cy * out.s;
  return out;
}
// While the finished piece holds on screen, build what the card will need, one thing per frame, so opening the card costs nothing. A client's card never moves the piece
// (it is drawn into the portrait), so it needs only the blush.
function prepareCard(E) {
  if (S.prep >= 2) return;
  if (S.prep === 0) { if (S.ended !== 'ruined') blushLayer(S.idx); } else if (!castOf(S.st) || S.daily) fieldComp(E, cardViewFor(E, CV), 1);
  S.prep++;
}
const SLIPWORD = { 2: 'two', 3: 'three', 4: 'four', 5: 'five' };
const over = {
  enter(E, params) {
    this.p = params;
    this.btnMain = null; this.btnMenu = null;
    this.t = 0; this.coins = 0; this.box = { x: 0, y: 0, w: 0, h: 0 };
    this.head = params.daily ? `DAILY   ${S.st.name.toUpperCase()}` : `${params.boss ? 'BOSS   ' : ''}No. ${params.idx + 1}   ${S.st.name.toUpperCase()}`;
    this.badgeAt = this.starsEndFor(params.stars) + A.badge.delay; this.badgeDone = false;
    this.bestStr = params.daily ? `Score ${params.best}%` : `Best ${params.best}%`; // a daily's best is its first attempt's score here; the menu strip also shows the best of the day
    const n = params.stars;
    this.starsEnd = J.starDelay + Math.max(0, n - 1) * J.starStagger + J.starSec;
    this.buttonsAt = Math.max(J.cardSlideSec, n ? this.starsEnd : 0) + J.buttonGap; // about 0.75 s with five stars
    this.sweepAt = params.clean ? this.starsEnd + J.cleanDelay : Infinity;
    this.client = params.daily ? null : castOf(S.st); // a client's card keeps the client on screen; the daily keeps the paper card
    this.z = 0; this.zoomEnd = this.client ? A.reveal.zoomSec : 0; this.cued = false; // the zoom to the client runs first; the card's own clock (t) starts when it ends
    if (this.client) {
      this.mood = moodOf(params.stars, params.failed);
      const pool = this.client.react[this.mood];
      this.line = pool[Math.floor(Math.random() * pool.length)]; // which of the pool is cosmetic
      this.earlier = earlierOf(params.idx, progress(E).stars); // what this client already wears of yours (PRD v0.8 A)
      loadClient(this.client.id);
    }
  },
  starsEndFor(n) { return J.starDelay + Math.max(0, n - 1) * J.starStagger + J.starSec; },
  cardBox(E) { return cardBoxFor(E, this.box); },
  cardView(E) { return cardViewFor(E, CV); },
  slideOffset(E) {
    const b = this.cardBox(E), k = ease.outBack(clamp(this.t / J.cardSlideSec, 0, 1));
    return (1 - k) * (E.h * J.cardFrom + b.h);
  },
  update(dt, E) {
    const R = A.reveal;
    if (this.client && !this.cued && this.z >= R.zoomSec * R.crossTo) { this.cued = true; E.audio.play(R.cue[this.mood], R.cueVol); } // one soft cue as the face shows
    if (this.z < this.zoomEnd) { this.z = Math.min(this.z + dt, this.zoomEnd); return; }
    this.t += dt;
    const n = this.p.stars, C = A.card, lay = this.client && this.layout(E);
    while (this.coins < n && this.t >= J.starDelay + this.coins * J.starStagger) {
      const i = this.coins++, b = this.cardBox(E);
      E.audio.play('coin');
      if (lay) emit(E, this.starX(lay, i), this.statY(lay), J.starBurst, P.inkGloss, 90, 0.4, 2.6);
      else emit(E, E.w / 2 + (i - 2) * C.starGap, b.y + 134 + this.slideOffset(E), J.starBurst, P.inkGloss, 90, 0.4, 2.6);
    }
    if (!this.badgeDone && this.p.newBadges.length && this.t >= this.badgeAt) { // a badge was earned: a beat of its own
      this.badgeDone = true; E.audio.play('win', 0.6); E.haptic(J.finishHaptic);
      emit(E, E.w / 2, this.ticketBottom(E, lay) - A.badge.h / 2, J.starBurst * 2, P.medal[this.p.newBadges[0].tier], 110, 0.5, 3);
    }
  },
  layout(E) { return clientLayout(E, S.tickets, this.line, CL); },
  ticketBottom(E, lay) { return lay ? lay.ty - A.reveal.gap : this.cardBox(E).y - 8; }, // the lowest ticket sits just above the card (the paper card, or the client's tray)
  starX(lay, i) { return lay.tx + lay.tw - A.reveal.sidePad - A.reveal.starR - (4 - i) * A.reveal.starGap; },
  statY(lay) { return lay.ty + A.reveal.trayPad + A.reveal.capH + lay.lines.length * A.reveal.lineH + A.reveal.statH / 2; },
  render(ctx, E) {
    if (this.client) { this.renderClient(ctx, E); return; }
    const p = this.p, cx = E.w / 2, t = this.t, b = this.cardBox(E), { w, h, x, y } = b, C = A.card, L = A.line;
    const ld = S.st.parts ? C.landH : 0, pv = view(E), cv = this.cardView(E), ek = ease.outCubic(clamp(t / J.cardSlideSec, 0, 1));
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
    label(ctx, PCT[p.pct], cx, y + (p.ruined ? C.ruinedHeroY : 80), FONT.hero, P.textDark);
    if (p.ruined) label(ctx, `Ruined at ${p.pct}%: ${SLIPWORD[T.maxSlips] || T.maxSlips} slips`, cx, y + C.ruinedY, FONT.small, P.textDark); // a blot counts as a slip
    for (let i = 0; i < 5; i++) {
      const sx = cx + (i - 2) * C.starGap;
      if (i >= p.stars) { drawStar(ctx, sx, y + 134, C.starR, false); continue; }
      const k = clamp((t - (J.starDelay + i * J.starStagger)) / J.starSec, 0, 1);
      if (k <= 0) { drawStar(ctx, sx, y + 134, C.starR, false); continue; }
      drawStar(ctx, sx, y + 134, C.starR * ease.outBack(k), true);
    }
    if (p.clean && t >= this.sweepAt) this.drawStamp(ctx, cx, y + 178, pop(t - this.sweepAt, J.cleanPopSec, 0));
    if (S.st.parts) { // stencils in parts: how many landings were clean
      const all = p.landings > 0 && p.cleanLand === p.landings;
      label(ctx, `Landings ${p.cleanLand} / ${p.landings} clean`, cx, y + 217, FONT.small, all ? P.stamp : P.textMute);
    }
    if (p.daily && p.ruined && t >= this.starsEnd) label(ctx, `${p.wasFirst ? 'First attempt stands' : 'Best unchanged'}`, cx, y + 178, FONT.small, P.textMute);
    ctx.restore();
    if (this.badgeDone) this.drawBadge(ctx, E, y - 8, t - this.badgeAt);

    this.btnMain = this.btnMenu = null;
    if (t < this.buttonsAt) return;
    // Primary: Again on a fail, Next on a pass, Menu on a pass of the last stencil or of the daily. Secondary: Menu, or Again after a daily pass (replays are allowed).
    const menuIsPrimary = !p.failed && (p.last || p.daily), bk = pop(t - this.buttonsAt, J.buttonPopSec, 0.85);
    ctx.save();
    const zoom = (cy) => { ctx.translate(cx, cy); ctx.scale(bk, bk); ctx.translate(-cx, -cy); };
    ctx.save(); zoom(y + 228 + ld);
    this.btnMain = inkButton(ctx, p.failed ? 'Again' : menuIsPrimary ? 'Menu' : 'Next', cx, y + 228 + ld, w - 56, 56, true, FONT.big);
    ctx.restore();
    if (!menuIsPrimary || p.daily) { ctx.save(); zoom(y + 286 + ld); this.btnMenu = inkButton(ctx, menuIsPrimary ? 'Again' : 'Menu', cx, y + 286 + ld, w - 56, 44, false, FONT.mid); ctx.restore(); }
    ctx.restore();
  },
  // The client's card. The zoom (z) takes the view from the skin to the portrait, whose skin patch wears the piece; the face and the line show at its end and stay. Then the
  // card's own clock (t) runs the stars, the badge and the buttons, as on the paper card.
  renderClient(ctx, E) {
    const R = A.reveal, p = this.p, L = this.layout(E), t = this.t, cx = E.w / 2, done = this.z >= this.zoomEnd;
    ctx.drawImage(boardLayer(E), 0, 0, E.w, E.h);
    const la = clamp((this.z - R.lineFrom) / R.lineFade, 0, 1);
    if (la > 0) this.drawTray(ctx, L, la);
    this.drawZoom(ctx, E, L);
    if (this.badgeDone) this.drawBadge(ctx, E, this.ticketBottom(E, L), t - this.badgeAt);
    this.btnMain = this.btnMenu = null;
    if (!done || t < this.buttonsAt) return;
    // Primary: Again on a fail, Next on a pass, Menu on a pass of the last stencil. Secondary (left of it): Menu.
    const menuIsPrimary = !p.failed && p.last, bk = pop(t - this.buttonsAt, J.buttonPopSec, 0.85), pair = !menuIsPrimary, bw = pair ? (L.tw - R.btnPair) / 2 : L.tw;
    const draw = (str, x, primary) => { ctx.save(); ctx.translate(x, L.by); ctx.scale(bk, bk); ctx.translate(-x, -L.by); const r = inkButton(ctx, str, x, L.by, bw, R.btnH, primary, FONT.mid); ctx.restore(); return r; };
    this.btnMain = draw(p.failed ? 'Again' : menuIsPrimary ? 'Menu' : 'Next', pair ? cx + (bw + R.btnPair) / 2 : cx, true);
    if (pair) this.btnMenu = draw('Menu', cx - (bw + R.btnPair) / 2, false);
  },
  drawZoom(ctx, E, L) {
    const R = A.reveal, F = R.frame, lk = A.line, id = this.client.id, mood = this.mood, k = clamp(this.z / R.zoomSec, 0, 1), e = ease.inOut(k);
    const bb = bboxOf(S.idx), pv = view(E), pt = patchIn(id, mood, L.px, L.py, L.pw, L.ph);
    const sf = Math.min(pt.w / bb.w, pt.h / bb.h), zm = Math.pow(pv.s / sf, 1 - e); // zoom: the piece is as big as it was in play at the start, as big as the patch at the end
    const ppx = pv.ox + bb.cx * pv.s, ppy = pv.oy + bb.cy * pv.s; // where the piece's centre sat in play
    const cross = ease.inOut(clamp((k - R.crossFrom) / (R.crossTo - R.crossFrom), 0, 1)); // the skin gives way to the portrait
    ctx.save();
    ctx.translate(ppx + (pt.cx - ppx) * e, ppy + (pt.cy - ppy) * e); ctx.rotate(-pt.r * (1 - e)); ctx.scale(zm, zm); ctx.translate(-pt.cx, -pt.cy);
    ctx.globalAlpha = lk.shadowAlpha; ctx.fillStyle = P.shadow; ctx.beginPath(); rr(ctx, L.px - F + lk.shadowDx, L.py - F + lk.shadowDy + 2, L.pw + 2 * F, L.ph + 2 * F, lk.radius); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = P.paper; ctx.beginPath(); rr(ctx, L.px - F, L.py - F, L.pw + 2 * F, L.ph + 2 * F, lk.radius); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.rect(L.px, L.py, L.pw, L.ph); ctx.clip();
    if (cross < 1) { // the piece as it was on the skin, turned with the limb, shrinking into the patch
      PV.s = sf; PV.ox = pt.cx - sf * bb.cx; PV.oy = pt.cy - sf * bb.cy;
      ctx.save(); ctx.translate(pt.cx, pt.cy); ctx.rotate(pt.r); ctx.translate(-pt.cx, -pt.cy);
      drawPiece(ctx, E, PV, J.cardSlideSec * 0.99);
      ctx.restore();
    }
    if (cross > 0) { // the client, with your ink on the skin (multiply, so the skin shows through) and the slips over it
      ctx.globalAlpha = cross;
      drawPortrait(ctx, id, mood, L.px, L.py, L.pw, L.ph);
      drawEarlier(ctx, id, mood, L.px, L.py, L.pw, L.ph, this.earlier);
      syncInk(E, view(E).s);
      const bx = Math.max(0, bb.x0 - A.ink.blitMargin), by = Math.max(0, bb.y0 - A.ink.blitMargin), bw = Math.min(T.designW, bb.x1 + A.ink.blitMargin) - bx, bh = Math.min(T.designH, bb.y1 + A.ink.blitMargin) - by, ik = S.layer.width / T.designW;
      ctx.save();
      ctx.translate(pt.cx, pt.cy); ctx.rotate(pt.r); ctx.scale(sf, sf); ctx.translate(-bb.cx, -bb.cy);
      ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = cross * R.inkAlpha;
      ctx.drawImage(S.layer, bx * ik, by * ik, bw * ik, bh * ik, bx, by, bw, bh);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = cross;
      drawMarks(ctx);
      ctx.globalAlpha = 1;
      if (this.p.clean && this.t >= this.sweepAt) this.drawSweep(ctx, IDV, (this.t - this.sweepAt) / J.cleanSweepSec);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    ctx.strokeStyle = P.ink; ctx.lineWidth = lk.weight; ctx.beginPath(); rr(ctx, L.px - F + 3, L.py - F + 3, L.pw + 2 * F - 6, L.ph + 2 * F - 6, lk.radius - 3); ctx.globalAlpha = 0.8; ctx.stroke(); ctx.globalAlpha = 1;
    ctx.restore();
  },
  // The paper tray under the portrait: the stencil's caption and the client's line (faded in as the zoom ends), then the percent and stars, the best and the Clean stamp.
  drawTray(ctx, L, la) {
    const R = A.reveal, lk = A.line, p = this.p, t = this.t, x = L.tx, y = L.ty, w = L.tw, h = L.th, pad = R.trayPad, sp = R.sidePad, cx = x + w / 2, done = this.z >= this.zoomEnd;
    ctx.globalAlpha = la * lk.shadowAlpha; ctx.fillStyle = P.shadow; ctx.beginPath(); rr(ctx, x + lk.shadowDx, y + lk.shadowDy + 2, w, h, lk.radius + 4); ctx.fill();
    ctx.globalAlpha = la; ctx.fillStyle = P.paper; ctx.beginPath(); rr(ctx, x, y, w, h, lk.radius + 4); ctx.fill();
    ctx.strokeStyle = P.ink; ctx.lineWidth = lk.weight; ctx.beginPath(); rr(ctx, x + 7, y + 7, w - 14, h - 14, lk.radius); ctx.globalAlpha = la * 0.8; ctx.stroke(); ctx.globalAlpha = la;
    label(ctx, this.head, cx, y + pad + R.capH / 2, FONT.small, P.textMute);
    L.lines.forEach((ln, i) => label(ctx, ln, cx, y + pad + R.capH + R.lineH * (i + 0.5), FONT.mid, P.textDark));
    ctx.globalAlpha = 1;
    if (!done) return;
    const sy = this.statY(L), my = sy + R.statH / 2 + R.metaH / 2, k = pop(t, J.cardSlideSec, 0.7);
    plabel(ctx, PCT[p.pct], x + sp, sy, k, FONT.big, P.textDark, 'left');
    for (let i = 0; i < 5; i++) {
      const sx = this.starX(L, i), sk = i < p.stars ? clamp((t - (J.starDelay + i * J.starStagger)) / J.starSec, 0, 1) : 0;
      if (sk > 0) drawStar(ctx, sx, sy, R.starR * ease.outBack(sk), true); else drawStar(ctx, sx, sy, R.starR * k, false);
    }
    const extra = p.ruined ? `Ruined: ${SLIPWORD[T.maxSlips] || T.maxSlips} slips` : S.st.parts ? `Landings ${p.cleanLand} / ${p.landings} clean` : null; // a blot counts as a slip
    label(ctx, this.bestStr, x + sp, my - (extra ? R.metaLineH / 2 : 0), FONT.small, P.textMute, 'left');
    if (extra) label(ctx, extra, x + sp, my + R.metaLineH / 2, FONT.small, p.ruined ? P.textDark : p.landings > 0 && p.cleanLand === p.landings ? P.stamp : P.textMute, 'left');
    if (p.clean && t >= this.sweepAt) this.drawStamp(ctx, x + w - sp - A.card.stampW * R.stampScale / 2, my, pop(t - this.sweepAt, J.cleanPopSec, 0) * R.stampScale);
  },
  // The badge tickets over the card, the lowest one ending at `bottom`: a paper strip per new badge (up to max, the highest tier nearest the card) with the tier's medal and the badge's name; "+n" counts the ones
  // that did not fit. Each pops in a beat after the one below it.
  drawBadge(ctx, E, bottom, age) {
    const B = A.badge, L = A.line, bg = this.p.newBadges, n = Math.min(bg.length, S.tickets), w = Math.min(B.w, E.w - 2 * A.card.pad), h = B.h, cx = E.w / 2;
    for (let i = 0; i < n; i++) {
      const cy = bottom - h / 2 - i * (h + B.gap), k = pop(age - i * B.stagger, B.popSec, 0.5);
      if (age - i * B.stagger < 0) continue;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k);
      ctx.globalAlpha = L.shadowAlpha; ctx.fillStyle = P.shadow; ctx.beginPath(); rr(ctx, -w / 2 + L.shadowDx, -h / 2 + L.shadowDy, w, h, 8); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = P.paper; ctx.beginPath(); rr(ctx, -w / 2, -h / 2, w, h, 8); ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = L.weight; ctx.stroke();
      drawMedal(ctx, -w / 2 + 8 + B.medalR + 2, 0, B.medalR, bg[i].tier, true);
      label(ctx, `BADGE  ${bg[i].name}`, -w / 2 + 44, 1, FONT.small, P.textDark, 'left');
      if (i === n - 1 && bg.length > n) label(ctx, `+${bg.length - n}`, w / 2 - 12, 1, FONT.small, P.textMute, 'right');
      ctx.restore();
    }
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
  // A rank earned on this piece shows Rita's card first (once per rank), then goes where the player was going.
  go(E, scene, params) {
    [scene, params] = route(E, scene, params);
    const r = this.p.rankUp;
    if (r) E.setScene('rank', { rank: r, next: scene, params }); else E.setScene(scene, params);
  },
  onTap(p, E) {
    if (this.z < this.zoomEnd) { if (this.z >= A.reveal.tapGuard) this.z = this.zoomEnd; return; } // the first tap jumps to the end of the zoom
    if (this.t < this.buttonsAt || !this.btnMain) return;
    if (E.hit(this.btnMain, p)) {
      E.audio.play('tap');
      const q = this.p;
      if (q.failed) { ledger(E, 'retry', { stencil: S.st.name, after: q.pct, daily: !!q.daily }); this.go(E, 'play', q.daily ? { daily: true } : { stencil: q.idx }); }
      else if (q.last || q.daily) { menuPopIdx = q.starsUp ? q.idx : -1; this.go(E, 'menu'); }
      else this.go(E, 'play', { stencil: q.idx + 1 });
    } else if (this.btnMenu && E.hit(this.btnMenu, p)) {
      E.audio.play('tap');
      const q = this.p;
      if (q.daily && !q.failed) { ledger(E, 'retry', { stencil: S.st.name, after: q.pct, daily: true }); this.go(E, 'play', { daily: true }); return; }
      menuPopIdx = q.starsUp ? q.idx : -1; this.go(E, 'menu');
    }
  },
};

// ---------- The cast on screen (PRD v0.7) ----------
// Portraits (ADR-0015): looking at, never in play. Each is drawn once it has decoded; until then, or if it fails, a drawn face stands in.
const IMGS = {};
let ART = null; // E.art (ADR-0020): portraits load through ART.src, so a dev-channel pick can replace one
function artImg(file) {
  let o = IMGS[file];
  if (o) return o;
  o = IMGS[file] = { img: new Image(), ok: false };
  if (!artReady(file)) return o; // Pack 16 art that has not landed is never requested: the drawn stand-in shows
  o.img.src = ART ? ART.src(file, `assets/${file}.webp`) : `assets/${file}.webp`;
  (o.img.decode ? o.img.decode() : Promise.reject()).then(() => { o.ok = true; }, () => { o.ok = o.img.complete && o.img.naturalWidth > 0; });
  return o;
}
const portraitOf = (id, mood) => artImg(portraitFile(id, mood));
const loadClient = (id) => { for (const m of MOODS) portraitOf(id, m); };

// A plain drawn face: a head, two eyes and a mouth that follows the mood.
// `look` ({ hair, glasses }) is for the clients whose portraits have not landed; `kind` is a gentle smile (Rita's second face).
function drawFace(ctx, cx, cy, r, mood, look) {
  ctx.fillStyle = P.skin; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  if (look && look.hair) { ctx.fillStyle = look.hair; ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * 1.04, Math.PI * 1.96); ctx.quadraticCurveTo(cx, cy - r * 0.5, cx + r * Math.cos(Math.PI * 1.04), cy + r * Math.sin(Math.PI * 1.04)); ctx.fill(); }
  ctx.strokeStyle = P.ink; ctx.lineWidth = Math.max(1.5, r * 0.07); ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
  ctx.fillStyle = P.ink;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s * r * 0.36, cy - r * 0.12, r * 0.08, 0, TAU); ctx.fill(); }
  if (look && look.glasses) { for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s * r * 0.36, cy - r * 0.12, r * 0.22, 0, TAU); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(cx - r * 0.14, cy - r * 0.12); ctx.lineTo(cx + r * 0.14, cy - r * 0.12); ctx.stroke(); }
  const my = cy + r * 0.38, dy = mood === 'happy' ? r * 0.2 : mood === 'kind' ? r * 0.1 : mood === 'sad' ? -r * 0.16 : 0;
  ctx.beginPath(); ctx.moveTo(cx - r * 0.34, my); ctx.quadraticCurveTo(cx, my + dy * 2, cx + r * 0.34, my); ctx.stroke();
}
// A client's whole portrait in the box (x, y, w, h): the webp, or a head over a torso where the patch table still points at skin.
function drawPortrait(ctx, id, mood, x, y, w, h) {
  const o = portraitOf(id, mood);
  if (o.ok) { ctx.drawImage(o.img, x, y, w, h); return; }
  ctx.fillStyle = P.boardDark; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = P.skin; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h * 1.02, w * 0.6, h * 0.55, 0, 0, TAU); ctx.fill();
  drawFace(ctx, x + w / 2, y + h * 0.28, w * 0.2, id === 'rita' && mood !== 'happy' ? 'kind' : mood, CLIENTS[id]);
}
// The head only, square, for the small plates.
function drawFaceCrop(ctx, c, mood, x, y, size) {
  const o = portraitOf(c.id, mood);
  if (o.ok) { const W = o.img.naturalWidth, H = o.img.naturalHeight, f = c.who.face; ctx.drawImage(o.img, f[0] * W, f[1] * H, f[2] * W, f[2] * W, x, y, size, size); }
  else { ctx.fillStyle = P.boardDark; ctx.fillRect(x, y, size, size); drawFace(ctx, x + size / 2, y + size / 2, size * 0.4, c.id === 'rita' && mood !== 'happy' ? 'kind' : mood, c.who); }
}
// Rita, on her own card: the webp (transparent around her), or a head with silver hair and glasses.
function drawRita(ctx, x, y, w, h) {
  const o = artImg('rita');
  if (o.ok) { ctx.drawImage(o.img, x, y, w, h); return; }
  const cx = x + w / 2, cy = y + h * 0.4, r = Math.min(w, h) * 0.3;
  drawFace(ctx, cx, cy, r, 'neutral');
  ctx.strokeStyle = P.steel; ctx.lineWidth = Math.max(2, r * 0.12);
  ctx.beginPath(); ctx.arc(cx, cy - r * 0.1, r * 1.02, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  ctx.strokeStyle = P.ink; ctx.lineWidth = Math.max(1.5, r * 0.07);
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s * r * 0.36, cy - r * 0.12, r * 0.22, 0, TAU); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(cx - r * 0.14, cy - r * 0.12); ctx.lineTo(cx + r * 0.14, cy - r * 0.12); ctx.stroke();
}
// Where a piece goes on a portrait drawn into the box (x, y, w, h): { cx, cy, w, h, r } in the box's own coordinates.
const PS = { cx: 0, cy: 0, w: 0, h: 0, r: 0 };
function patchIn(id, mood, x, y, w, h, o = PS) {
  const p = PATCH[id][mood];
  o.cx = x + p[0] * w; o.cy = y + p[1] * h; o.w = p[2] * w; o.h = p[3] * h; o.r = p[4];
  return o;
}
// The stencil as it is (a perfect fill, or its outline) in a patch, as ink laid on skin: multiply, so the skin shows through.
function stencilInPatch(ctx, idx, o, alpha, filled) {
  const bb = bboxOf(idx), fit = Math.min(o.w / bb.w, o.h / bb.h), mp = miniPath(idx);
  ctx.save();
  ctx.translate(o.cx, o.cy); ctx.rotate(o.r); ctx.scale(fit, fit); ctx.translate(-bb.cx, -bb.cy);
  if (filled) { ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = alpha; ctx.fillStyle = SK.i.ink || P.ink; ctx.fill(mp, 'evenodd'); }
  else { ctx.globalAlpha = alpha; ctx.strokeStyle = P.stencilDeep; ctx.lineWidth = 1.6 / fit; ctx.lineJoin = 'round'; ctx.stroke(mp); }
  ctx.restore();
}

// A returning client's earlier finished pieces (`list`, stencil indices) in the portrait's second patch (PRD v0.8 A): perfect fills, small and faded, in a grid that gives each the
// most room, multiplied into the skin like the new piece. (x, y, w, h) is the portrait's box; `k` scales the fade (a Portfolio tile that is not passed yet is dimmer).
function drawEarlier(ctx, id, mood, x, y, w, h, list, k = 1) {
  const t = PATCH2[id] && PATCH2[id][mood], n = list.length;
  if (!t || !n) return;
  const E2 = A.earlier, pw = t[2] * w, ph = t[3] * h;
  let cols = 1;
  for (let c = 2; c <= n; c++) if (Math.min(pw / c, ph / Math.ceil(n / c)) > Math.min(pw / cols, ph / Math.ceil(n / cols))) cols = c;
  const rows = Math.ceil(n / cols), cw = pw / cols, ch = ph / rows;
  ctx.save();
  ctx.translate(x + t[0] * w, y + t[1] * h); ctx.rotate(t[4]);
  ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha *= E2.alpha * k; ctx.fillStyle = SK.i.ink || P.ink;
  list.forEach((idx, j) => {
    const row = Math.floor(j / cols), inRow = Math.min(cols, n - row * cols), bb = bboxOf(idx), fit = Math.min((cw * E2.fit) / bb.w, (ch * E2.fit) / bb.h);
    ctx.save();
    ctx.translate(-pw / 2 + ((cols - inRow) * cw) / 2 + (j % cols + 0.5) * cw, -ph / 2 + (row + 0.5) * ch); ctx.scale(fit, fit); ctx.translate(-bb.cx, -bb.cy);
    ctx.fill(miniPath(idx), 'evenodd');
    ctx.restore();
  });
  ctx.restore();
}

// The client of the day on the play intro (PRD v0.7 B): a plate under the HUD with the client's face and line. It never sits near the thumb, and it is gone as soon as
// the player's first touch. The daily has no client.
function drawCast(ctx, E) {
  const C = A.cast, c = !S.daily && !S.ended && !S.started && castOf(S.st), age = E.time - S.introT;
  if (!c || age < 0 || age >= C.sec) return;
  const a = clamp((C.sec - age) / C.fade, 0, 1);
  if (a <= 0) return;
  const w = Math.min(C.maxW, E.w - 2 * A.menu.margin), tx = C.pad + C.face + C.gap, lines = wrapText(c.line, w - tx - C.pad, FONT.small), pl = plateRect(E);
  const h = pl.h, x = (E.w - w) / 2, y = pl.y, fy = y + h / 2 - C.face / 2;
  fadePlate(ctx, x, y, w, h, a);
  ctx.globalAlpha = a;
  ctx.save(); ctx.beginPath(); rr(ctx, x + C.pad, fy, C.face, C.face, 8); ctx.clip();
  drawFaceCrop(ctx, c, 'neutral', x + C.pad, fy, C.face);
  ctx.restore();
  ctx.strokeStyle = P.cream; ctx.lineWidth = 1.5; ctx.beginPath(); rr(ctx, x + C.pad, fy, C.face, C.face, 8); ctx.stroke();
  lines.forEach((ln, i) => label(ctx, ln, x + tx, y + h / 2 + (i - (lines.length - 1) / 2) * C.lineH, FONT.small, P.cream, 'left'));
  ctx.globalAlpha = 1;
}

// The paper card the cold open and the rank card share: shadow, paper, rule and pin.
function paperCard(ctx, x, y, w, h) {
  const L = A.line;
  ctx.globalAlpha = L.shadowAlpha; ctx.fillStyle = P.shadow; ctx.beginPath(); rr(ctx, x + L.shadowDx, y + L.shadowDy + 2, w, h, L.radius + 4); ctx.fill(); ctx.globalAlpha = 1;
  ctx.beginPath(); rr(ctx, x, y, w, h, L.radius + 4); ctx.fillStyle = P.paper; ctx.fill();
  ctx.strokeStyle = P.ink; ctx.lineWidth = L.weight; ctx.beginPath(); rr(ctx, x + 7, y + 7, w - 14, h - 14, L.radius); ctx.globalAlpha = 0.8; ctx.stroke(); ctx.globalAlpha = 1;
  drawPin(ctx, x + w / 2, y + 1, 6);
}

// The cold open (PRD v0.7 A): two cards, one tap each, Skip always top right. Shown once on a save without `openSeen` (set as it opens, so closing the app midway never repeats
// it) and again from the menu's Story button.
const OPEN_CARDS = ['A tattoo lasts a lifetime.', 'Every client trusts your hand with theirs.'];
const story = {
  enter(E, p) {
    this.replay = !!(p && p.replay); this.i = 0; this.t = 0; this.btnSkip = null;
    if (!this.replay) E.save.set('openSeen', true);
    ledger(E, 'story', { part: this.replay ? 'replay' : 'open' });
    for (const id of COLD_IDS) portraitOf(id, 'happy');
  },
  update(dt) { this.t += dt; },
  next(E) { if (this.i + 1 < OPEN_CARDS.length) { this.i++; this.t = 0; } else E.setScene('menu'); },
  render(ctx, E) {
    const O = A.open, cx = E.w / 2, w = Math.min(O.cardW, E.w - 2 * A.menu.margin), lines = wrapText(OPEN_CARDS[this.i], w - 2 * O.pad, FONT.mid);
    const h = 2 * O.pad + O.art + O.gap + lines.length * O.lineH, k = ease.outCubic(clamp(this.t / O.fade, 0, 1)), x = cx - w / 2, y = E.safe.top + (E.h - E.safe.top - E.safe.bottom - h) / 2 + (1 - k) * 16;
    ctx.drawImage(boardLayer(E), 0, 0, E.w, E.h);
    ctx.save(); ctx.globalAlpha = k;
    paperCard(ctx, x, y, w, h);
    const ay = y + O.pad;
    if (this.i === 0) { // the anchor, inked
      const idx = Math.max(0, STENCILS.findIndex((s) => s.name === 'Anchor')), bb = bboxOf(idx), fit = Math.min((w - 2 * O.pad) / bb.w, O.art / bb.h) * O.anchorFit;
      ctx.save(); ctx.translate(cx, ay + O.art / 2); ctx.scale(fit, fit); ctx.translate(-bb.cx, -bb.cy);
      ctx.fillStyle = P.ink; ctx.fill(miniPath(idx), 'evenodd'); ctx.restore();
    } else { // six clients, three by two
      const names = COLD_IDS, gw = 3 * O.face + 2 * O.faceGap, gx = cx - gw / 2;
      names.forEach((id, i) => {
        const fx = gx + (i % 3) * (O.face + O.faceGap), fy = ay + Math.floor(i / 3) * (O.face + O.faceGap);
        ctx.save(); ctx.beginPath(); rr(ctx, fx, fy, O.face, O.face, 8); ctx.clip();
        drawFaceCrop(ctx, { id, who: CLIENTS[id] }, 'happy', fx, fy, O.face);
        ctx.restore();
        ctx.strokeStyle = P.ink; ctx.lineWidth = 1.6; ctx.beginPath(); rr(ctx, fx, fy, O.face, O.face, 8); ctx.stroke();
      });
    }
    const ty = ay + O.art + O.gap;
    lines.forEach((ln, i) => label(ctx, ln, cx, ty + O.lineH * (i + 0.5), FONT.mid, P.textDark));
    ctx.restore();
    this.btnSkip = inkButton(ctx, 'Skip', E.w - E.safe.right - 16 - O.skipW / 2, E.safe.top + 10 + O.skipH / 2, O.skipW, O.skipH, false, FONT.small);
  },
  onTap(p, E) {
    if (this.btnSkip && E.hit(this.btnSkip, p)) { E.audio.play('tap'); E.setScene('menu'); return; }
    if (this.t >= A.open.guard) { E.audio.play('tap', 0.6); this.next(E); }
  },
};

const PV = { s: 1, ox: 0, oy: 0 }; // the piece's view in the portrait's frame (the zoom in the client's result card)

// The rank-up card (PRD v0.7 D): Rita, once per rank, between the result card and wherever the player was going.
const rank = {
  enter(E, p) {
    this.p = p; this.t = 0; this.btn = null;
    E.save.set('rankSeen', Math.max(E.save.get('rankSeen', 0), p.rank));
    artImg('rita');
    ledger(E, 'rank', { rank: RANKS[p.rank].name });
    E.audio.play('win', A.rank.cueVol); E.haptic(J.finishHaptic);
  },
  update(dt) { this.t += dt; },
  render(ctx, E) {
    const R = A.rank, rk = RANKS[this.p.rank], cx = E.w / 2, w = Math.min(R.w, E.w - 2 * A.menu.margin), inner = w - 2 * R.pad, lines = wrapText(rk.line, inner, FONT.mid);
    const rest = 2 * R.pad + R.gap + A.type.big + R.nameGap + lines.length * R.lineH + R.btnGap + R.btnH, availH = E.h - E.safe.top - E.safe.bottom - R.margin, portH = Math.min(R.portH, availH - rest), h = rest + portH;
    const k = ease.outBack(clamp(this.t / R.popSec, 0, 1)), y = E.safe.top + (E.h - E.safe.top - E.safe.bottom - h) / 2, cy = y + h / 2;
    ctx.drawImage(boardLayer(E), 0, 0, E.w, E.h);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy);
    paperCard(ctx, cx - w / 2, y, w, h);
    const px = cx - w / 2 + R.pad, py = y + R.pad;
    ctx.fillStyle = P.drape; ctx.beginPath(); rr(ctx, px, py, inner, portH, 10); ctx.fill();
    ctx.save(); ctx.beginPath(); rr(ctx, px, py, inner, portH, 10); ctx.clip();
    const F = A.finale, rh = portH - F.ritaInset, rw = rh * F.ritaAspect;
    drawRita(ctx, cx - rw / 2, py + F.ritaInset, rw, rh);
    ctx.restore();
    let ty = py + portH + R.gap + A.type.big / 2;
    drawMedal(ctx, cx - R.medalDx, ty, R.medalR, this.p.rank, true);
    label(ctx, rk.name, cx + R.nameDx, ty + 1, FONT.big, P.textDark);
    ty += A.type.big / 2 + R.nameGap;
    lines.forEach((ln, i) => label(ctx, ln, cx, ty + R.lineH * (i + 0.5), FONT.mid, P.textDark));
    this.btn = inkButton(ctx, 'Continue', cx, y + h - R.pad - R.btnH / 2, inner, R.btnH, true, FONT.big);
    ctx.restore();
  },
  onTap(p, E) {
    if (this.t < A.rank.guard) return;
    E.audio.play('tap');
    E.setScene(this.p.next, this.p.params);
  },
};

// Rita's card before the finale (PRD v0.8 D): two beats, one tap each, then the piece. It shows once (`ritaSeen`, set as the player leaves it, so closing the app between the beats
// shows both again). Every way into the finale goes through `route`.
const RITA_BEATS = ['My hands have been shaking for a year. You noticed.', 'One more piece, then. On me.'];
function route(E, scene, params) {
  if (scene === 'play' && params && params.stencil === FINALE && !E.save.get('ritaSeen', false)) return ['ritaCard', { next: params }];
  return [scene, params];
}
const ritaCard = {
  enter(E, p) {
    this.p = p; this.i = 0; this.t = 0; this.bt = 0;
    artImg('rita');
    ledger(E, 'rita', { part: 'card' });
    E.audio.play('win', A.finale.cueVol);
  },
  update(dt) { this.t += dt; this.bt += dt; },
  render(ctx, E) {
    const R = A.finale, cx = E.w / 2, w = Math.min(R.w, E.w - 2 * A.menu.margin), inner = w - 2 * R.pad, lines = wrapText(RITA_BEATS[this.i], inner, FONT.mid), most = Math.max(...RITA_BEATS.map((b) => wrapText(b, inner, FONT.mid).length)); // the card keeps one height for both beats
    const rest = 2 * R.pad + R.gap + most * R.lineH + R.btnGap + R.btnH, availH = E.h - E.safe.top - E.safe.bottom - R.margin, portH = Math.min(R.portH, availH - rest), h = rest + portH;
    const k = ease.outBack(clamp(this.t / R.popSec, 0, 1)), y = E.safe.top + (E.h - E.safe.top - E.safe.bottom - h) / 2, cy = y + h / 2;
    ctx.drawImage(boardLayer(E), 0, 0, E.w, E.h);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy);
    paperCard(ctx, cx - w / 2, y, w, h);
    const px = cx - w / 2 + R.pad, py = y + R.pad;
    ctx.fillStyle = P.drape; ctx.beginPath(); rr(ctx, px, py, inner, portH, 10); ctx.fill();
    ctx.save(); ctx.beginPath(); rr(ctx, px, py, inner, portH, 10); ctx.clip();
    const rh = portH - R.ritaInset, rw = rh * R.ritaAspect;
    drawRita(ctx, cx - rw / 2, py + R.ritaInset, rw, rh);
    ctx.restore();
    const ty = py + portH + R.gap, ta = clamp(this.bt / R.beatFadeSec, 0, 1);
    ctx.globalAlpha = ta;
    lines.forEach((ln, i) => label(ctx, ln, cx, ty + R.lineH * (i + 0.5), FONT.mid, P.textDark));
    ctx.globalAlpha = 1;
    inkButton(ctx, this.i === 0 ? 'Next' : 'Sit down', cx, y + h - R.pad - R.btnH / 2, inner, R.btnH, true, FONT.big);
    ctx.restore();
  },
  onTap(p, E) {
    if (this.t < A.finale.guard || this.bt < A.finale.guard) return;
    E.audio.play('tap');
    if (this.i === 0) { this.i = 1; this.bt = 0; return; }
    E.save.set('ritaSeen', true);
    E.setScene('play', this.p.next);
  },
};

// The Portfolio (PRD v0.7 E): every stencil's best, worn by its client. The game keeps stars, not the ink, so each tile is a perfect fill of the stencil on the client,
// the face by its best stars. Not yet passed: the outline only, the portrait faded.
const folio = {
  enter(E) { this.scroll = 0; this.drag = null; this.moved = 0; this.btnBack = null; this.tiles = []; },
  geom(E, o = {}) {
    const F = A.folio, m = A.menu.margin, tw = (E.w - 2 * m - (F.cols - 1) * F.gap) / F.cols, pw = tw - 2 * F.pad, ph = (pw * 4) / 3, th = F.pad + ph + F.starH + F.headH, rows = Math.ceil(STENCILS.length / F.cols);
    const top = E.safe.top + A.missions.top, bot = E.h - E.safe.bottom - A.missions.bottom, content = rows * th + (rows - 1) * F.gap;
    o.tw = tw; o.pw = pw; o.ph = ph; o.th = th; o.top = top; o.bot = bot; o.max = Math.max(0, content - (bot - top));
    return o;
  },
  render(ctx, E) {
    const F = A.folio, M = A.missions, m = A.menu.margin, p = progress(E), G = this.geom(E, this.G || (this.G = {})), L = A.line, cols = F.cols;
    ctx.drawImage(boardLayer(E), 0, 0, E.w, E.h);
    const count = `${STENCILS.filter((s, i) => p.stars[i]).length} / ${STENCILS.length}`, hy = E.safe.top + F.headY, hx = m + M.backW + F.headGap;
    ctx.font = FONT.mid; const cw = ctx.measureText(count).width; ctx.font = FONT.big;
    const room = E.w - m - cw - F.countGap - hx, headFont = ctx.measureText('Portfolio').width <= room ? FONT.big : FONT.mid; // Back, heading and count never touch
    label(ctx, 'Portfolio', hx, hy, headFont, P.textDark, 'left');
    label(ctx, count, E.w - m, hy, FONT.mid, P.textMute, 'right');
    this.scroll = clamp(this.scroll, 0, G.max);
    this.tiles = [];
    ctx.save(); ctx.beginPath(); ctx.rect(0, G.top, E.w, G.bot - G.top); ctx.clip();
    STENCILS.forEach((st, i) => {
      const x = m + (i % cols) * (G.tw + F.gap), y = G.top + Math.floor(i / cols) * (G.th + F.gap) - this.scroll;
      if (y + G.th < G.top || y > G.bot) return;
      const c = castOf(st), stars = p.stars[i] || 0, locked = i > p.unlocked, got = stars > 0, mood = got ? moodOf(stars, false) : 'neutral';
      ctx.globalAlpha = L.shadowAlpha; ctx.fillStyle = P.shadow; ctx.beginPath(); rr(ctx, x + L.shadowDx, y + L.shadowDy, G.tw, G.th, A.menu.cardR); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = got ? P.paper : P.paperShade; ctx.beginPath(); rr(ctx, x, y, G.tw, G.th, A.menu.cardR); ctx.fill();
      ctx.strokeStyle = got ? P.ink : P.paperEdge; ctx.lineWidth = got ? 1.6 : 1; ctx.stroke();
      const qx = x + F.pad, qy = y + F.pad;
      ctx.save(); ctx.beginPath(); rr(ctx, qx, qy, G.pw, G.ph, 4); ctx.clip();
      ctx.globalAlpha = got ? 1 : locked ? F.lockedAlpha : F.openAlpha;
      drawPortrait(ctx, c.id, mood, qx, qy, G.pw, G.ph);
      ctx.globalAlpha = 1;
      const pt = patchIn(c.id, mood, qx, qy, G.pw, G.ph);
      if (got) stencilInPatch(ctx, i, pt, F.inkAlpha, true); else if (!locked) stencilInPatch(ctx, i, pt, F.outlineAlpha, false);
      if (!locked) drawEarlier(ctx, c.id, mood, qx, qy, G.pw, G.ph, earlierOf(i, p.stars), got ? 1 : A.earlier.folioAlpha); // what the client already wears
      ctx.restore();
      if (locked) drawLock(ctx, x + G.tw / 2, qy + G.ph / 2);
      else {
        const step = (G.tw - 2 * F.starPad) / T.starPercents.length, sy = y + F.pad + G.ph + F.starH / 2 + 2;
        for (let j = 0; j < T.starPercents.length; j++) drawStar(ctx, x + F.starPad + step * (j + 0.5), sy, step * F.starScale, j < stars);
      }
      this.tiles.push({ x, y, w: G.tw, h: G.th, idx: i, locked });
    });
    ctx.restore();
    if (G.max > 0) {
      const tr = G.bot - G.top, bh = Math.max(F.scrollMinH, (tr * tr) / (tr + G.max));
      ctx.globalAlpha = 0.45; ctx.fillStyle = P.ink; ctx.beginPath(); rr(ctx, E.w - 6, G.top + (tr - bh) * (this.scroll / G.max), M.scrollBar, bh, 1.5); ctx.fill(); ctx.globalAlpha = 1;
    }
    this.btnBack = inkButton(ctx, 'Back', m + M.backW / 2, hy, M.backW, M.backH, true, FONT.mid);
  },
  onPointerDown(p) { this.drag = { y: p.y, scroll: this.scroll }; this.moved = 0; },
  onPointerMove(p, E) { if (this.drag) { this.scroll = clamp(this.drag.scroll - (p.y - this.drag.y), 0, this.geom(E).max); this.moved = Math.max(this.moved, Math.abs(p.y - this.drag.y)); } },
  onPointerUp() { this.drag = null; },
  onTap(p, E) {
    if (E.hit(this.btnBack, p)) { E.audio.play('tap'); E.setScene('missions'); return; }
    const G = this.G, t = G && p.y >= G.top && p.y <= G.bot && this.tiles.find((q) => E.hit(q, p));
    if (t && t.locked) E.toast(t.idx === FINALE && progress(E).finaleShut ? 'Star every other piece first' : `Pass No. ${t.idx} first`);
  },
};

export const game = {
  slug: 'ink',
  title: 'Ink',
  init(E) { ART = E.art; loadTitleImage(); game.start = E.save.get('openSeen', false) ? 'menu' : 'story'; }, // a fresh save opens on the cold open
  saveVersion: 11,
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
      // v6 adds cs (best stars of a clean pass), badges and the daily results. A save cannot say whether a clean pass and a five-star pass were the same attempt, so cs starts
      // empty (Serpent and Bone, and the green ink they unlock, are earned by the next clean five-star run); the other badges are earned from what the save already shows.
      data.cs = {};
      data.daily = {};
      data.badges = earnedBadges({ stars: data.stars || {}, clean: data.clean || {}, cs: data.cs });
    }
    if (fromVersion < 7) data.skin = { machine: 'steel', ink: 'black' }; // v7: the chosen machine and ink skins
    if (fromVersion < 8) data.land = {}; // v8: landing counts per stencil in parts (nothing earlier can have any); everything else is kept
    if (fromVersion < 9) {
      // v9: Set Piece and Steady Landing changed rules (a finished split version) after the v17 to v20 builds had saved under v8. A land entry saved before the change has no `st`,
      // so its `ok` was earned without knowing the piece was finished and is not trusted; entries saved since carry `st` and are kept. Those two badges are then re-derived from
      // the entries (added or removed); every other badge, and everything else in the save, is kept.
      const land = data.land || {};
      for (const id of Object.keys(land)) if (land[id].st === undefined) land[id] = { ...land[id], ok: 0, st: 0 };
      data.land = land;
      const p = { land, stars: data.stars || {}, clean: data.clean || {}, cs: data.cs || {} }, badges = { ...(data.badges || {}) };
      for (const id of ['steady-landing', 'set-piece']) { const g = badgeProgress(BADGES.find((b) => b.id === id), p); if (g.have >= g.need) badges[id] = true; else delete badges[id]; }
      data.badges = badges;
    }
    if (fromVersion < 10) {
      // v10 (PRD v0.7 G): `openSeen` (the cold open has shown) and `rankSeen` (the highest rank whose card has shown). A save that has been played has seen the open and holds its
      // current rank already, so the ladder never cascades; a save with nothing played in it (settings only) still gets the open.
      const stars = data.stars || {}, total = Object.values(stars).reduce((n, v) => n + (v || 0), 0);
      const played = total > 0 || Object.keys(data.best || {}).length > 0 || (data.unlocked || 0) > 0 || Object.keys(data.daily || {}).length > 0;
      data.openSeen = played; data.rankSeen = played ? rankOf(total) : 0;
    }
    if (fromVersion < 11) {
      // v11 (PRD v0.8 F): `ritaSeen` (the finale card has shown) and `shopYours` (a 4-star finale). Bests for the first 18 stencils are untouched. The book grew past the old last
      // stencil (index 17), whose unlock was clamped to itself, so a save that has a star on it now opens index 18.
      data.ritaSeen = false; data.shopYours = false;
      if (((data.stars || {})[17] || 0) > 0) data.unlocked = Math.max(Number(data.unlocked) || 0, Math.min(18, STENCILS.length - 1));
    }
    return data;
  },
  TUNING,
  // TUNE tab: the timer feel (PRD v0.5 section D) and the gap hint. The preset row holds only the timer presets (the panel has room for about four buttons in one row, so the
  // hint's presets became its two sliders: 101 is off). Everything reads TUNING at use time, so it applies live, from the next attempt for timers.
  experiments: [
    { key: 'timerGlobalMult', label: 'Timer multiplier (all stencils)', min: 0.6, max: 2, step: 0.05 },
    { key: 'hintPercent', label: 'Hint starts at (percent; the menu toggle turns it off)', min: 85, max: 100, step: 1 },
    { key: 'hintShare', label: 'Gap share shown (of what is left)', min: 0.02, max: 0.5, step: 0.01 },
  ],
  presets: [
    { label: 'Relaxed', values: { timerMultEarly: 2.6, timerMultMid: 2.6, timerMultBoss: 2.6, timerMultFinal: 2.6, timerMultSkull: 2.6, timerGlobalMult: 1 } },
    { label: 'Standard', values: { timerMultEarly: 2.2, timerMultMid: 1.9, timerMultBoss: 1.7, timerMultFinal: 1.6, timerMultSkull: 1.35, timerGlobalMult: 1 } },
    { label: 'Tight', values: { timerMultEarly: 1.6, timerMultMid: 1.6, timerMultBoss: 1.6, timerMultFinal: 1.6, timerMultSkull: 1.35, timerGlobalMult: 1 } }, // the skull's standard 1.35 is already tighter than 1.6
  ],
  start: 'menu',
  scenes: { menu, play, over, rank, ritaCard, missions, folio, story },
  // Read by tools/sim-ink.mjs so the simulator runs the real coverage and slip code.
  sim: { stencils: STENCILS, toScreen, prep: prepStencil, landings: () => S.landings, cleanLand: () => S.cleanLand, parts: () => (S.g.part ? S.partDone.slice() : null), partPct: () => S.partN.map((n, i) => (100 * n) / S.g.partTotal[i]), timerFor, dailyTimer: () => dailyTimer(DAILY_ST), skins: () => ({ machine: SK.m.id, ink: SK.i.id }), percent, slips: () => S.slips, ended: () => S.ended, inked: () => S.inked, time: () => S.time, total: () => S.total, grid: () => S.g, radius: () => S.r, tickets: () => S.tickets, maxR: () => S.maxR, lifts99: () => S.lifts99, hint: () => S.hint, computeHint },
};
