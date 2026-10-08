// Arena (proto 13): a fair feint switch (tapping another zone moves a raised shield at once, the cooldown follows only a block, a real tell of
// 0.85 s, never under 0.6 s, with a snap and a flash on the real zone's button), your own rolled weapon (a sixth wheel; reach, speed, damage,
// stamina and a special each, and its gladiator look), a deck of 28 with reachable epics, one token per run for a Respin or a Reroll, a clean screen.
// Arena (proto 12): a story for your fighter (origin and reason wheels, a rolled name, Old Brutus on every card, a rival champion who remembers,
// an epilogue or the pit wall), a pick of three seeded upgrades after each fell with odds set by the bout's grade, and footwork: a back / in rocker,
// arena walls, range that decides whether a blow reaches, and a foe who keeps his weapon's distance and can be pushed back.
// Arena (proto 10): the feint is taught (a violet hesitation before the glow jumps to the real zone, the first one in slow motion with a caption,
// "Feint read!" when you hold still through the fake and block the real strike), a fair ramp (bout 1 a sparring partner, feints from bout 2, memory
// from bout 3), an open window when he is winded (a brief slow, OPEN!, glowing slots), and your own fighter rolled on five wheels before the gauntlet.
// Arena (proto 9): a five-opponent gauntlet of rolled fighters (size, weapon, armour set, three stats, an intro card), and a foe with intent:
// a per-weapon move set with honest tells (chop, thrust, sweep, a zone-changing combo, a feint, a shield bash, a net throw), his own stamina and a winded
// state, footwork that keeps his weapon's range, and a short memory of your habits. Every exchange is planned with the fight RNG when it starts.
// Arena (proto 8): the sword thumb works like a trackpad (relative control).
// Arena (proto 7): one hit per swing (the first thing the blade meets), slots count only for a jab along the slit, the foe covers the part you hit.
// Arena (proto 6): fighters apart, a lunge to reach deep targets, joint slots (3x), one health bar, a dodge button, exhaustion.
// Arena (proto 5): two full-body gladiators, side view, landscape (ADR-0013), two thumbs.
// RIGHT thumb: the sword arm. The body stays upright and the sword leads: straight on a near-full-length circle around the shoulder at the finger's angle,
// elbow bent only when the finger draws back. The torso leans (12 degrees at most) only on a fast slash past the arm's reach. Overhead, jab (tip only) and
// slash come out of the motion. Every attack costs stamina; armour and the foe's guard clang (recoil; a counter only after an overhead clang).
// LEFT hand: three shield buttons (High, Mid, Low) on the left edge: tap = shield up for 0.6 s, hold = keep it up (slow stamina drain). Only the matching zone blocks.
// A fourth button, Dodge: tap = quick sidestep, hold = stay backed off (burns stamina). No stamina = exhausted: no swings for 1.5 s, slow shield.
// Layout: H = fighter body unit = screen height * fighter.height (the foe's is scaled by his size), feet on a floor line. Body units: x forward, y down, origin at the feet.
// All particles are the game's own so a hit-stop freezes the burst, then lets it fly.

import { makeRng, clamp, lerp } from './engine.js';

const TUNING = {
  hearts: 3,               // drawn as hearts, counted in halves
  heal: 1,                 // half hearts back for each foe felled
  bouts: 5,                // opponents in the gauntlet
  resetDelay: 0.9,         // seconds after a foe falls before the next intro card
  swayRate: 1.3,           // radians per second of the foe's sway
  offset: 50,              // aim point above the finger, px (absolute control only)
  control: { relative: 1, gain: 1.6, guard: [0.38, -0.08], lungeStart: 1.3, lungeFull: 1.7, back: 0.12, jabCone: 0.68 },  // relative: 1 trackpad, 0 absolute (proto 7); gain: hand px per thumb px; guard: hand at touch-down from the shoulder (H); lunge from thumb offset x gain, in arm lengths (start, full); back: seconds to ease to guard on lift; jabCone: cosine of the widest push angle (off the guard line) that still counts as a jab
  hand: {
    lag: 0.035,            // seconds of weight in the hand
    regrip: 0.12,          // lag while the hand recovers from a bounce
    tiredLag: 2.4,         // lag multiplier at zero stamina
    rest: [0.5, -0.2],     // aim point at rest (finger up), from the shoulder, in body units
  },
  arm: { len: 0.45, minFrac: 0.35, full: 0.97, chamberAt: 0.16, straightAt: 0.5 },  // arm in H; finger distance (H) at which the arm is chambered and at which it is straight
  blade: { len: 0.36, pad: 5, jabPad: 10, tip: 0.22 },   // gladius length in H, hit pad px, jab tip radius px, fraction of the blade that is the jab tip
  grip: { straight: -0.25, chamber: -0.6, tau: 0.045, trail: 0.018 },  // blade angle from the arm (radians, up is negative), smoothing, trail per rad/s of arm swing
  fighter: { height: 0.72, floor: 0.92, gap: 0.2, body: 0.12 },   // body unit as a fraction of screen height, feet line, clear gap between the bodies (fraction of width), half body width in H
  lunge: { start: 0.7, full: 1.0, stride: 0.3, cost: 10, tauIn: 0.06, tauOut: 0.14 },  // aim distance from the shoulder (H) where the lunge starts and is full; stride in H; extra stamina
  lean: { base: 0.03, max: 0.21, beyond: 0.6, span: 0.2, fast: 0.7, tau: 0.06, back: 0.05 },  // radians (max = 12 degrees); aim distance (H) past which a fast slash leans, over span; fast = fraction of hit.mid
  dodge: { dur: 0.35, back: 0.32, hop: 0.1, cost: 12, cool: 0.2, drain: 14 },  // dur: a tap's sidestep; a hold stays back and drains stamina per second
  hit: { minSpeed: 400, mid: 950, fast: 1800, cool: 0.2 },   // tip px/s: slash threshold, slash damage 2, glow
  attack: {
    jab: { cost: 8, minSpeed: 520, dmg: 2, recoil: 0.18 },
    slash: { cost: 14, dmg: 1, fastDmg: 2, recoil: 0.5, dents: 1 },
    over: { cost: 20, minSpeed: 750, dmg: 3, recoil: 0.7, dents: 2, raise: 0.2, window: 0.6 },  // raise: hand this far (H) above the shoulder; window: seconds it counts
  },
  stamina: { max: 100, regen: 45, delay: 0.45, tired: 0.5, idleMul: 1.8, exhaust: 1.5 },  // tired: damage multiplier at zero; idleMul: regen when not swinging, blocking or dodging; exhaust: seconds with no swings at zero
  part: { hp: 3 },         // damage a gap part takes before it is disabled
  skin: { glint: 0.16, cutFade: 3.5, maxDpr: 3 },  // art only: tip distance (H) at which a slot glints, seconds a cut line takes to fade, sprite pixel-ratio cap
  armour: { dents: 3, kick: 0.6 },
  stun: 1.2,               // seconds the foe is stunned when the head goes
  armSlow: 0.4,            // each disabled arm lengthens the wind-up by this fraction
  swing: {
    windup: 0.95,          // base seconds from the first tell to the blow, scaled by the move, weapon, size, Speed and rhythm
    gap: 3.2,              // base seconds between exchanges: gap * 0.6 + up to gapSpread, scaled by the rhythm
    gapSpread: 1.5,
    lunge: 0.22,           // foe steps in this far (H) as the blow lands
  },
  counter: { windup: 0.55 },  // only an overhead clang (or any clang on a shield-bearer) brings a counter
  open: { dur: 1.1 },      // seconds the foe is open after each of his moves
  shield: { dur: 0.6, perfect: 0.25, hits: 6, cool: 0.25, stagger: 1.0, riposte: 1.0, riposteMul: 2, drain: 3, slow: 0.45 },  // drain: stamina per second of hold
  juice: { stop1: 0.04, stop2: 0.07, stop3: 0.1, stopBreak: 0.05, stopClang: 0.03, strawPerDmg: 14 },
  foe: { swayX: 0.05, swayDeg: 3, kick: 0.9, hp: 22, tierHp: 0.1, champHp: 1.15, dmgCap: 3, coverShield: 0.2, coverGuard: 0.1 },  // hp scaled by size and tier; dmgCap: most half hearts one blow takes; cover radii (H) with and without a shield
  cover: { dur: 3.2, slide: 0.07, jabTol: 0.8 },  // seconds the foe's guard stays on the part you hit; seconds to slide there; radians a jab may stray from the slit's axis
  step: { circle: [-0.05, 0.07], period: 3.4, tau: 0.16, lead: 0.5, dodge: 0.3, dodgeDur: 0.7, dodgeCool: 2.4 },  // footwork (H): a slow drift around his range (period s); lead: seconds before a move he steps to striking distance; his sidestep from a lunge
  // his stamina: base + per Stamina point; costs per move are in moves; block: paid when your blow meets his guard; winded: seconds with guard down at zero; combo: seconds winded after any combo
  foeSta: { base: 40, per: 14, regen: 16, delay: 0.6, block: 8, winded: 1.5, combo: 1.4, windedRegen: 2.5, windedDmg: 1.5, windedStep: 4 },
  // feint: show = fraction of the move's tell spent on the fake zone, cock = how far the fake winds up (an honest, shallower cock), after = seconds of real tell left after the switch
  // at base (x his size and Speed), never under min; snap = seconds the real zone's button flashes at the jump
  moves: {
    chop:   { wind: 1.05, cost: 18, dmg: 2 },
    thrust: { wind: 0.85, cost: 12, dmg: 1, high: 0.35 },   // high: a spear's chance to thrust at the face
    sweep:  { wind: 0.95, cost: 14, dmg: 1 },
    combo:  { wind: 0.9, next: 0.6, cost: 10, dmg: 1 },     // cost and damage per hit; next: windup of each later hit as a fraction of the first
    feint:  { show: 0.6, cock: 0.6, after: 0.85, min: 0.6, snap: 0.3, cost: 8, dmg: 1 },
    bash:   { wind: 0.7, cost: 15, drain: 30, blocked: 0.4, push: 0.2, w: 1.2 },  // drain: your stamina; blocked: drain fraction when you block it; push: H; w: weight for a shield-bearer
    net:    { wind: 0.95, cost: 14, dur: 2.2, slow: 2.6 },  // dur: seconds you are slowed; slow: hand lag multiplier while netted
  },
  // rhythm of an exchange: how many moves, the pause between them (s), windup multiplier, the pause after it (x the base gap), feint weight multiplier
  rhythm: [
    { id: 'flurry', w: 1, n: [2, 3], gap: 0.3, wind: 0.85, after: 1.0, feint: 0.7 },
    { id: 'probe', w: 1, n: [1, 1], gap: 0, wind: 1.15, after: 0.65, feint: 2 },
    { id: 'pause', w: 0.8, n: [1, 2], gap: 0.7, wind: 1, after: 1.5, feint: 1 },
  ],
  // what he remembers of you: blockRun same-zone blocks in a row (the read fades memWin s after the last) make him avoid that zone (avoid x weight); lunges in lungeWin s make him sidestep and punish;
  // turtle: share of recent time (tau s) your shield is up that makes him feint and bash more; lowSta: your stamina fraction below which he presses
  read: { blockRun: 3, memWin: 20, avoid: 0.08, lunges: 2, lungeWin: 10, turtle: 0.45, turtleTau: 4, turtleFeint: 3, turtleBash: 4, lowSta: 0.3, pressMul: 3, pressWind: 0.88 },
  retreat: { chance: 0.5, hurt: 0.6, dur: 1.2, dist: 0.2 },  // chance per exchange that a hit below hurt (health fraction) sends him back dist (H) for dur s
  stat: { strDmg: [0.75, 0.1], spdWind: [1.25, 0.1], spdStep: [1.3, 0.12] },  // multiplier = a - b * stat (Strength adds: a + b * stat)
  // sizes: drawn scale, health, extra range (H), damage, windup and footwork multipliers, stat bias (Strength, Speed, Stamina)
  sizes: [
    { id: 'S', name: 'SMALL', scale: 0.86, hp: 0.8, reach: -0.04, dmg: 0.9, wind: 0.9, step: 0.8, bias: [-1, 1, 0] },
    { id: 'M', name: 'MEDIUM', scale: 1, hp: 1, reach: 0, dmg: 1, wind: 1, step: 1, bias: [0, 0, 0] },
    { id: 'L', name: 'LARGE', scale: 1.15, hp: 1.3, reach: 0.06, dmg: 1.2, wind: 1.12, step: 1.3, bias: [1, -1, 0.5] },
  ],
  // weapons: home and striking distance (H, beyond the base stance), windup multiplier, damage, drawn length (H), move weights, combo length, shield chance, your stamina drained per block, shield wear per block
  weapons: [
    { id: 'gladius', name: 'GLADIUS', range: 0.12, strike: -0.04, speed: 0.9, dmg: 1, len: 0.3, moves: { chop: 2, thrust: 2, sweep: 1.5, combo: 3, feint: 1.5 }, combo: [2, 3], shield: 0.7, drain: 0, wear: 1 },
    { id: 'spear', name: 'SPEAR', range: 0.34, strike: 0.2, speed: 1, dmg: 1, len: 0.8, moves: { chop: 0.8, thrust: 4, sweep: 2, combo: 1, feint: 1.5 }, combo: [2, 2], shield: 0.5, drain: 0, wear: 1 },
    { id: 'axe', name: 'AXE', alt: 'MACE', range: 0.16, strike: 0, speed: 1.25, dmg: 1.6, len: 0.44, moves: { chop: 4, thrust: 0.4, sweep: 2, combo: 1, feint: 1 }, combo: [2, 2], shield: 0.3, drain: 18, wear: 2 },
    { id: 'dagger', name: 'DAGGER & NET', range: 0.04, strike: -0.16, speed: 0.85, dmg: 0.8, len: 0.17, moves: { chop: 1, thrust: 3, sweep: 1, combo: 2, feint: 2, net: 1.6 }, combo: [2, 3], shield: 0, drain: 0, wear: 1 },
  ],
  // armour sets: plates (min, max), a helmet, joint slots open
  armourSets: [
    { id: 'light', name: 'LIGHT', plates: [1, 1], helmet: false, slots: 3 },
    { id: 'medium', name: 'MEDIUM', plates: [2, 3], helmet: false, slots: 4 },
    { id: 'heavy', name: 'HEAVY', plates: [4, 4], helmet: true, slots: 5 },
  ],
  net: { stuck: 1 },       // lunges are blocked while netted (1) or not (0)
  // the feint lesson: hes = seconds of violet hesitation before the glow jumps; slow = game speed during the first feint ever; captions last cap / remind s
  lesson: { hes: 0.28, slow: 0.4, cap: 5, remind: 2.6 },
  feintRead: { drain: 0.6 },  // fraction of his stamina bar a read feint costs him
  openWin: { dur: 0.15, slow: 0.25 },  // when he is winded: seconds of slow time, and the game speed during it
  // your rolled fighter. Wheels: [value, weight, tier name]. Per size: drawn scale, arm reach multiplier, hearts, hand lag (swing speed) multiplier.
  // Per stat value 1-5: Strength damage, Speed hand lag / recoil and dodge length, Stamina bar and regen. Armour: plates on head/chest/legs (+ shield arm), stamina regen.
  me: {
    wheels: {
      size: [['S', 30, 'Small'], ['M', 45, 'Medium'], ['L', 25, 'Large']],
      stat: [[1, 8, 'Feeble'], [2, 20, 'Fair'], [3, 34, 'Solid'], [4, 26, 'Strong'], [5, 12, 'Mighty']],
      armour: [['light', 35, 'Light'], ['medium', 45, 'Medium'], ['heavy', 20, 'Heavy']],
      weapon: [['gladius', 35, 'Gladius', 'GL'], ['spear', 25, 'Spear', 'SP'], ['axe', 20, 'Axe/mace', 'AX'], ['dagger', 20, 'Dagger', 'DG']],
      // flavour only: [value, weight, name, wheel label]
      origin: [['gaul', 1, 'Gaul', 'GA'], ['thrace', 1, 'Thrace', 'TH'], ['numidia', 1, 'Numidia', 'NU'], ['capua', 1, 'Capua', 'CA'], ['ostia', 1, 'Ostia', 'OS'], ['alexandria', 1, 'Alexandria', 'AL']],
      reason: [['freedom', 1, 'Freedom', 'F'], ['debt', 1, 'Debt', 'D'], ['revenge', 1, 'Revenge', 'R'], ['glory', 1, 'Glory', 'G']],
    },
    spin: 0.8, turns: 2.5, pause: 0.22,  // seconds per wheel, turns per spin, pause before the next wheel
    sizes: {
      S: { name: 'SMALL', scale: 0.88, reach: 0.95, hearts: 2.5, lag: 0.82, score: 0 },
      M: { name: 'MEDIUM', scale: 1, reach: 1, hearts: 3, lag: 1, score: 0.5 },
      L: { name: 'LARGE', scale: 1.15, reach: 1.05, hearts: 3.5, lag: 1.2, score: 1 },
    },
    str: [0.75, 0.9, 1, 1.15, 1.3],
    spdLag: [1.35, 1.15, 1, 0.88, 0.76], spdDodge: [0.8, 0.9, 1, 1.12, 1.25],
    staMax: [70, 85, 100, 115, 130], staRegen: [0.8, 0.9, 1, 1.1, 1.2],
    armour: {
      light: { name: 'LIGHT', n: 1, regen: 1, score: 0 },
      medium: { name: 'MEDIUM', n: 2, regen: 0.92, score: 0.5 },
      heavy: { name: 'HEAVY', n: 3, regen: 0.82, score: 1, arm: true },
    },
    plateMul: 0.5,                        // a hit on a plated part costs this share (a quarter heart instead of a half)
    tiers: [['S', 13], ['A', 11], ['B', 9], ['C', 7], ['D', -1]],  // score = STR + SPD + STA + size + armour
    underdog: 7, underdogHalves: 1,       // a score below this gets +1 half heart
    // your weapon: reach = blade length, speed divides hand lag and recoil, dmg and cost multiply every blow, slash multiplies slash damage,
    // slot = slot-hit multiplier, overBreak = dents at which an overhead breaks a plate (0: the usual armour.dents), mace = chance an axe is a mace
    weapons: {
      gladius: { name: 'GLADIUS', reach: 1, speed: 1, dmg: 1, cost: 1, slash: 1, slot: 3, overBreak: 0 },
      spear: { name: 'SPEAR', reach: 1.35, speed: 0.85, dmg: 1, cost: 1, slash: 0.6, slot: 3, overBreak: 0 },
      axe: { name: 'AXE', alt: 'MACE', reach: 0.9, speed: 0.75, dmg: 1.7, cost: 1.4, slash: 1, slot: 3, overBreak: 2 },
      dagger: { name: 'DAGGER', reach: 0.65, speed: 1.4, dmg: 0.75, cost: 1, slash: 1, slot: 4, overBreak: 0 },
    },
    mace: 0.5,
  },
  // the one token per run: a Respin on your fighter card or a Reroll on a draft
  token: 1,
  hint: { bouts: 2, dur: 10 },  // the in-play hint shows in this many bouts ever, for this many seconds of each
  // footwork, in H. Yours: a tap of In steps pace over tapDur s, holding walks in at walkIn after hold s; a tap of Back is the old dodge and steps back
  // (x your Speed's dodge length), holding keeps backing off at walkBack. Speeds are H per second. close: nearest clear gap between the bodies.
  // room: the most each fighter can give ground before the wall (yours, his), trimmed to the screen; margin: px kept clear at the screen edge.
  // His: walk speed (x Speed and size), commit = speed share while winding up, reach = how far past his striking distance a blow still lands, push = a pace share.
  // proto 12.1 left column: width as a fraction of screen width (never under minW), gap between buttons, top of the column below the safe top, step row height (fraction of screen height, never under stepMinH), touch reach past a drawn edge, and how much of the way the fighters' frame slides toward the middle of the space the column leaves
  col: { frac: 0.22, minW: 96, gap: 6, top: 70, stepFrac: 0.17, stepMinH: 64, reach: 8, frame: 0.75 },
  foot: { pace: 0.14, tapDur: 0.16, walkIn: 0.32, back: 0.2, walkBack: 0.42, hold: 0.22, close: 0.1, room: [0.6, 0.7], margin: 22, foeV: 0.75, commit: 0.3, reach: 0.12, push: 0.5, wallMsg: 0.9 },
  // the bout's grade: S needs no hits taken and reads + punishes of at least S.skill; A and B allow up to taken hits with slot hits + reads + punishes of at least skill
  grade: { S: { taken: 0, skill: 2 }, A: { taken: 1, skill: 3 }, B: { taken: 3, skill: 1 } },
  // the draft: cards dealt, rarity weights per grade (common, rare, epic), an S grade's first card is always epic and the rest use its row; delay before a pick counts (s)
  draft: { deal: 3, odds: { S: [20, 50, 30], A: [20, 50, 30], B: [40, 45, 15], C: [60, 35, 5] }, delay: 0.45 },
  // card effects: half hearts, multipliers, seconds, slot multiplier added, shield hits, stamina fractions, the foe's health fraction, hp reflected
  cards: {
    hide: 1, wind: 1.2, wrist: 0.8, steady: 0.75, grip: 1.2, heavy: 2, keen: 0.3, blade: 0.5, crowd: 2,
    feet: 1.25, breath: 1.2, edge: 1, tough: 2, cstance: 0.15, second: 0.5, hunter: 0.5, lungem: 0.5, exec: 0.25, lion: 2, lionFell: 1, mirror: 3,
  },
};

// The gauntlet: what each bout may roll (sizes, armour sets) and the stat level it centres on. The fifth is the named champion.
// The ramp: bout 1 is a sparring partner (no feints, no memory, no counters, tells x tell); feints from bout 2, memory from bout 3.
const GAUNTLET = [
  { sizes: ['S'], armour: ['light'], stat: 1, spar: true, tell: 1.4 },
  { sizes: ['S', 'M'], armour: ['light', 'medium'], stat: 1.9, feints: true, counters: true },
  { sizes: ['M', 'L'], armour: ['medium'], stat: 2.6, feints: true, memory: true, counters: true },
  { sizes: ['S', 'M', 'L'], armour: ['medium', 'heavy'], stat: 3.2, feints: true, memory: true, counters: true },
  { sizes: ['M', 'L'], armour: ['heavy'], stat: 4, champion: true, feints: true, memory: true, counters: true },
];
const bout = () => GAUNTLET[state.rack] || GAUNTLET[GAUNTLET.length - 1];
const NAMES = ['Crixus', 'Priscus', 'Verus', 'Celadus', 'Hermes', 'Triumphus', 'Tetraites', 'Spiculus', 'Carpophorus', 'Attilius', 'Oenomaus', 'Gannicus', 'Pugnax', 'Calamus', 'Asteropaeus'];
const CHAMPIONS = ['Flamma the Unbroken', 'Marcus the Red', 'Varro of Capua', 'Aurelius the Golden'];

// Your fighter's story: flavour only. Names carry 'f' or 'm' for the epilogue's and the wall's words.
const ORIGINS = {
  gaul: { text: 'a farmer from Gaul', noun: 'farmer' }, thrace: { text: 'a Thracian soldier', noun: 'soldier' }, numidia: { text: 'a Numidian horseman', noun: 'horseman' },
  capua: { text: 'a baker from Capua', noun: 'baker' }, ostia: { text: 'a sailor from Ostia', noun: 'sailor' }, alexandria: { text: 'a scribe from Alexandria', noun: 'scribe' },
};
const MY_NAMES = [['Gaius', 'm'], ['Lucia', 'f'], ['Decimus', 'm'], ['Aurelia', 'f'], ['Brennus', 'm'], ['Tullia', 'f'], ['Nikandros', 'm'], ['Iuba', 'm']];
const REASON_NAME = { freedom: 'Freedom', debt: 'Debt', revenge: 'Revenge', glory: 'Glory' };
// Old Brutus, the lanista: three lines per reason, and which one he says at each moment (first intro, later intros, the champion's intro, after a fell, the end of a lost run).
const BRUTUS = {
  freedom: { lines: ['Win the wooden sword and you walk out free.', "Free men don't lose to farmers. Get up.", 'One more, and the gate opens.'], first: 0, intro: 0, champ: 2, won: 0, lost: 1 },
  debt: { lines: ['Your family owes me. Every win pays.', "That one's worth a month of bread.", 'Lose, and the debt grows.'], first: 0, intro: 2, champ: 0, won: 1, lost: 2 },
  revenge: { lines: ["He burned your village. He's waiting at the end.", 'Keep your anger for the champion.', 'Not yet. Him last.'], first: 0, intro: 1, champ: 0, won: 2, lost: 1 },
  glory: { lines: ['Rome wants a name. Make it yours.', "Hear them? They're chanting for you.", 'Glory is loud. Be louder.'], first: 0, intro: 2, champ: 0, won: 1, lost: 2 },
};
const brutus = (me, moment) => { const B = BRUTUS[me.reason]; return B.lines[B[moment]]; };
const EPILOGUE = {
  freedom: (n, f) => `${n} walked out a free ${f ? 'woman' : 'man'}, the wooden sword in hand.`,
  debt: (n, f) => `The debt was paid. ${n} went home to ${f ? 'her' : 'his'} family.`,
  revenge: (n) => `The village was avenged. ${n} finally slept.`,
  glory: (n) => `Rome sang the name ${n} for a generation.`,
};
const storyLine = (me) => `${me.name}, ${ORIGINS[me.origin].text}. Fights for: ${REASON_NAME[me.reason]}.`;

// The upgrade deck: dealt three at a time after each fell. Commons stack (unless once); a rare or epic is dealt only once, and never when it would do nothing.
const DECK = [
  { id: 'hide', tier: 0, name: 'Thick Hide', line: '+½ heart' },
  { id: 'wind', tier: 0, name: 'Big Lungs', line: '+20% stamina' },
  { id: 'wrist', tier: 0, name: 'Quick Wrist', line: 'jab recovery −20%' },
  { id: 'steady', tier: 0, name: 'Steady Shield', line: 'blocking costs 25% less' },
  { id: 'grip', tier: 0, name: 'Sandal Grip', line: 'steps 20% faster' },
  { id: 'feet', tier: 0, name: 'Quick Feet', line: 'steps 25% faster' },
  { id: 'breath', tier: 0, name: 'Deep Breath', line: 'stamina regenerates 20% faster' },
  { id: 'edge', tier: 0, name: 'Sharp Edge', line: 'bare hits +1' },
  { id: 'tough', tier: 0, name: 'Tough Shield', line: '2 more shield hits' },
  { id: 'stance', tier: 0, name: 'Wide Stance', line: 'no push-back from a bash', once: true },
  { id: 'greaves', tier: 1, name: 'Iron Greaves', line: 'your legs are plated' },
  { id: 'helm', tier: 1, name: 'Bronze Helm', line: 'your head is plated' },
  { id: 'heavy', tier: 1, name: 'Heavy Arm', line: 'overheads dent twice' },
  { id: 'keen', tier: 1, name: 'Keen Eye', line: "a feint's real strike comes 0.3 s later" },
  { id: 'riposte', tier: 1, name: 'Riposte', line: 'a perfect block gives a free counter jab' },
  { id: 'cstance', tier: 1, name: 'Counter Stance', line: 'a block within 0.15 s of the strike staggers him' },
  { id: 'second', tier: 1, name: 'Second Wind', line: 'once per bout, at zero stamina, refill half the bar' },
  { id: 'hunter', tier: 1, name: "Hunter's Eye", line: 'his open slots glow 0.5 s longer' },
  { id: 'cutter', tier: 1, name: 'Net Cutter', line: 'never netted' },
  { id: 'lungem', tier: 1, name: 'Lunge Master', line: 'lunges cost half the stamina' },
  { id: 'gut', tier: 1, name: 'Iron Gut', line: 'the first body hit each bout costs nothing' },
  { id: 'blade', tier: 2, name: "Champion's Blade", line: 'slot hits +0.5x (3x becomes 3.5x)' },
  { id: 'crowd', tier: 2, name: "Crowd's Favourite", line: '+1 heart after each fell' },
  { id: 'unbreak', tier: 2, name: 'Unbreakable', line: 'the first hit each bout is ignored' },
  { id: 'exec', tier: 2, name: 'Executioner', line: 'below a quarter health, slot hits fell him' },
  { id: 'lion', tier: 2, name: "Lion's Heart", line: '+1 heart now and +½ per fell' },
  { id: 'mirror', tier: 2, name: 'Mirror Shield', line: 'perfect blocks reflect a half-heart' },
  { id: 'blur', tier: 2, name: 'Blur', line: 'a backstep leaves a ghost he attacks instead' },
];
const CARD = Object.fromEntries(DECK.map((c) => [c.id, c]));
const TIERS = ['COMMON', 'RARE', 'EPIC'], TIER_TINT = ['#c4b99a', '#7dd3fc', '#e879f9'];
const has = (id) => !!state.picks && state.picks.includes(id);
const count = (id) => (state.picks ? state.picks.filter((q) => q === id).length : 0);

// Parts in body units. Arms hang from a joint (their own frame): d is relative to the joint.
const PARTS = [
  { id: 'head',  shape: 'circle', x: 0.03, y: -0.80, r: 0.08 },
  { id: 'chest', shape: 'rect',   x: 0,    y: -0.60, w: 0.24, h: 0.17 },
  { id: 'belly', shape: 'rect',   x: 0,    y: -0.44, w: 0.20, h: 0.13 },
  { id: 'armF',  shape: 'rect',   x: 0,    y: 0.15,  w: 0.09, h: 0.30, joint: [0.05, -0.67] },
  { id: 'armB',  shape: 'rect',   x: 0,    y: 0.15,  w: 0.085, h: 0.30, joint: [-0.04, -0.67] },
  { id: 'legs',  shape: 'rect',   x: 0,    y: -0.19, w: 0.22, h: 0.38 },
];
// Joint slots: always open, drawn as dark slits. 'frame' names the limb they ride on; 'axis' is the direction (radians, body frame) a thrust must follow to go in.
const SLOTS = [
  { id: 'slot-neck', label: 'NECK', shape: 'rect', x: 0.03, y: -0.70, w: 0.085, h: 0.05, axis: 0 },
  { id: 'slot-armpit', label: 'ARMPIT', shape: 'rect', x: 0.115, y: -0.60, w: 0.045, h: 0.085, axis: 0.5 },
  { id: 'slot-waist', label: 'WAIST', shape: 'rect', x: 0, y: -0.51, w: 0.21, h: 0.04, axis: 0 },
  { id: 'slot-elbow', label: 'ELBOW', shape: 'rect', x: 0, y: 0.15, w: 0.085, h: 0.04, axis: 0, frame: 'armF' },
  { id: 'slot-knee', label: 'KNEE', shape: 'rect', x: 0.075, y: -0.20, w: 0.045, h: 0.06, axis: 0.3 },
];
const ARM_LEN = 0.30, SHOULDER = [0.05, -0.67];

// The three zones: where the blow lands (body units), the shield height that blocks it.
const ZONES = [
  { id: 'high', y: -0.78, label: 'HIGH', sy: -0.8 },
  { id: 'mid',  y: -0.62, label: 'MID', sy: -0.58 },
  { id: 'low',  y: -0.18, label: 'LOW', sy: -0.28 },
];
const ZONE = Object.fromEntries(ZONES.map((z) => [z.id, z]));
// The foe's weapon arm for each blow: cocked angle and end angle (from forward, y down), lean while winding, crouch, how far the blow lunges (x swing.lunge).
const POSES = {
  chop:   { cock: -1.55, end: 1.15, lean: -0.18, crouch: 0, lunge: 1 },
  slash:  { cock: -2.9, end: 0.0, lean: -0.08, crouch: 0, lunge: 1 },
  sweep:  { cock: 2.5, end: 0.9, lean: 0.22, crouch: 0.05, lunge: 1 },
  thrust: { cock: 0.1, end: -0.08, lean: -0.16, crouch: 0.01, lunge: 1.7 },
  bash:   { cock: 1.3, end: 0.7, lean: -0.22, crouch: 0, lunge: 1.9 },
  net:    { cock: -2.4, end: 0.2, lean: -0.12, crouch: 0, lunge: 0.6 },
};
const ZONE_POSE = { high: 'chop', mid: 'slash', low: 'sweep' };
const MOVE_ZONE = { chop: 'high', thrust: 'mid', sweep: 'low' };
const POSE_NAME = { chop: 'CHOP', slash: 'SLASH', sweep: 'SWEEP', thrust: 'THRUST', bash: 'BASH', net: 'NET' };
const REST_TH = 0.9;

const STRAW = ['#e6c866', '#d4b04a', '#f2dc90', '#b8923a'];
const YOU = { skin: '#c58f5e', tunic: '#2f7d6d', hem: '#1d5448', crest: '#e6c866' };
const state = {};
const now = () => performance.now() / 1000;
const easeOut = (u) => 1 - (1 - u) * (1 - u);
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const ZERO = { ox: 0, oy: 0, rot: 0 };
const pidx = (id) => PARTS.findIndex((q) => q.id === id);
const mkPart = (d, armour) => ({ d, armour, cx: d.x, cy: d.y, slot: false, cut: false, hp: TUNING.part.hp, dents: 0, cracks: [], gashes: [], flash: 0, clang: 0, cool: 0 });

// Your plates follow your rolled set: n of head, chest and legs (the parts the high, mid and low blows land on), heavy also plates the shield arm.
const ZONE_PART = { high: 'head', mid: 'chest', low: 'legs' };
const playerParts = (me) => PARTS.map((d) => mkPart(d, me.plates.includes(d.id)));

// Your fighter, rolled once at setup on eight weighted wheels (size, three stats, armour, weapon, origin, reason). Each wheel's landing is decided here; the wheels only show it.
// idx follows the wheels' order on screen.
const ME_WHEEL = ['size', 'stat', 'stat', 'stat', 'armour', 'weapon', 'origin', 'reason'];
function platesFor(rng, set) {
  const A = TUNING.me.armour[set], plates = rng.shuffle(['head', 'chest', 'legs']).slice(0, A.n);
  if (A.arm) plates.push('armB');
  return plates;
}
function rollMe(seed) {
  const rng = makeRng(seed ^ 0x2545f491), W = TUNING.me.wheels;
  const spin = (list) => pickW(rng, list.map((e, i) => [i, e[1]]));
  const idx = [spin(W.size), spin(W.stat), spin(W.stat), spin(W.stat), spin(W.armour)];
  const plates = platesFor(rng, W.armour[idx[4]][0]);
  const origin = spin(W.origin), reason = spin(W.reason), [name, sex] = rng.pick(MY_NAMES);
  // the weapon is rolled last, so a seed still rolls the same fighter and story as in proto 12
  const weapon = spin(W.weapon), mace = rng.chance(TUNING.me.mace);
  idx.push(weapon, origin, reason);
  return deriveMe({ idx, plates, name, female: sex === 'f', mace });
}
// everything that follows from the wheels' landings
function deriveMe(me) {
  const M = TUNING.me, W = M.wheels, v = (k) => W[ME_WHEEL[k]][me.idx[k]][0];
  const size = v(0), str = v(1), spd = v(2), sta = v(3), set = v(4), A = M.armour[set];
  const score = str + spd + sta + M.sizes[size].score + A.score;
  const tier = M.tiers.find((t) => score >= t[1])[0], underdog = score < M.underdog;
  return { ...me, size, str, spd, sta, set, weapon: v(5), origin: v(6), reason: v(7), score, tier, underdog, halves: M.sizes[size].hearts * 2 + (underdog ? M.underdogHalves : 0) };
}
// The respin: wheel k rolled again with its own seeded stream, by its odds but never landing where it was. A new armour set re-rolls its plates.
function respinMe(me, k, seed) {
  const rng = makeRng((seed ^ 0x6c8e9cf5) + k * 7919), list = TUNING.me.wheels[ME_WHEEL[k]];
  const idx = me.idx.slice();
  idx[k] = pickW(rng, list.map((e, j) => [j, j === me.idx[k] ? 0 : e[1]]));
  return deriveMe({ ...me, idx, plates: k === 4 ? platesFor(rng, list[idx[k]][0]) : me.plates.slice(), mace: k === 5 ? rng.chance(TUNING.me.mace) : me.mace });
}
// your size, weapon and stat multipliers
const meSize = () => TUNING.me.sizes[state.me.size];
const meWeapon = () => TUNING.me.weapons[state.me.weapon];
const meLag = () => meSize().lag * TUNING.me.spdLag[state.me.spd - 1] / meWeapon().speed;
const weaponName = (me) => { const W = TUNING.me.weapons[me.weapon]; return W.alt && me.mace ? W.alt : W.name; };

// The foe's plates follow his set: light 1, medium 2 or 3 (never chest and belly both, legs bare), heavy a helmet and 4 of chest, belly, arms and legs.
// The set also decides how many joint slots are open between the pieces.
function foeParts(rng, set) {
  let on;
  if (set.helmet) on = new Set(['head', ...rng.shuffle(['chest', 'belly', 'armF', 'armB', 'legs']).slice(0, set.plates[0])]);
  else {
    const n = rng.int(set.plates[0], set.plates[1]);
    for (let k = 0; k < 30; k++) { on = new Set(rng.shuffle(n === 1 ? ['chest', 'belly', 'armF', 'armB'] : ['head', 'chest', 'belly', 'armF', 'armB']).slice(0, n)); if (!(on.has('chest') && on.has('belly'))) break; }
    if (on.has('chest') && on.has('belly')) on.delete('belly');
  }
  const out = PARTS.map((d) => mkPart(d, on.has(d.id)));
  for (const d of rng.shuffle(SLOTS).slice(0, set.slots)) { const q = mkPart(d, false); q.slot = true; out.push(q); }
  return out;
}

// One fighter of the gauntlet, rolled from the bout's tables: size, weapon, armour set, three 1-5 stats with the size's bias.
function rollFighter(rng, tier, weapon, used) {
  const G = GAUNTLET[tier], T = TUNING;
  let size, set;
  for (let k = 0; k < 20; k++) {
    const si = rng.pick(G.sizes), ai = rng.pick(G.armour);
    size = T.sizes.find((z) => z.id === si); set = T.armourSets.find((z) => z.id === ai);
    if (!used.has(`${size.id}${weapon.id}${set.id}`)) break;
  }
  used.add(`${size.id}${weapon.id}${set.id}`);
  const roll = (b) => clamp(Math.round(G.stat + b + rng.range(-1, 1)), 1, 5);
  const best = (b) => (G.champion ? Math.max(roll(b), roll(b)) : roll(b));
  const stats = size.bias.map(best);
  const name = G.champion ? rng.pick(CHAMPIONS) : rng.pick(NAMES);
  return { tier, name, champion: !!G.champion, size, weapon, set, str: stats[0], spd: stats[1], sta: stats[2], shield: rng.chance(weapon.shield), mace: rng.chance(0.5), partSeed: (rng() * 2 ** 32) >>> 0 };
}

// A saved rival takes the champion's place: the same man, look and weapon as the one who cut you down.
function rollGauntlet(seed, rival) {
  const rng = makeRng(seed ^ 0x51ed270b), used = new Set(), W = TUNING.weapons, T = TUNING;
  const order = rng.shuffle(W.map((_, i) => i));
  const g = GAUNTLET.map((_, i) => rollFighter(rng, i, W[i < order.length ? order[i] : rng.int(0, W.length - 1)], used));
  const size = rival && T.sizes.find((z) => z.id === rival.size), weapon = rival && W.find((z) => z.id === rival.weapon), set = rival && T.armourSets.find((z) => z.id === rival.set);
  if (size && weapon && set) {
    const c = g[g.length - 1];
    g[g.length - 1] = { ...c, name: rival.name, rival: true, size, weapon, set, str: rival.str, spd: rival.spd, sta: rival.sta, shield: !!rival.shield, mace: !!rival.mace, partSeed: rival.partSeed >>> 0 };
  }
  return g;
}
const rivalOf = (d) => ({ name: d.name, size: d.size.id, weapon: d.weapon.id, set: d.set.id, str: d.str, spd: d.spd, sta: d.sta, shield: d.shield, mace: d.mace, partSeed: d.partSeed });

const statMul = (k, v) => TUNING.stat[k][0] - TUNING.stat[k][1] * v;

function newRack(E) {
  const f = state.foe, d = state.gauntlet[state.rack], FT = TUNING.foe;
  Object.assign(f, d);
  f.wname = d.weapon.alt && d.mace ? d.weapon.alt : d.weapon.name;
  f.parts = foeParts(makeRng(d.partSeed), d.set);
  f.maxHp = Math.round(FT.hp * d.size.hp * (1 + FT.tierHp * d.tier) * (d.champion ? FT.champHp : 1)); f.hp = f.maxHp; f.shown = f.hp;
  f.staMax = TUNING.foeSta.base + TUNING.foeSta.per * d.sta; f.sta = f.staMax; f.staT = 9; f.staShown = 1;
  f.home = d.weapon.range + d.size.reach; f.strike = d.weapon.strike + d.size.reach;
  f.th = REST_TH; f.dx = 0; f.dy = 0; f.a = 0; f.fr = {};
  state.rng = makeRng(state.seed + state.rack * 7919);
  state.cover = null; state.step = { x: f.home, tgt: 0, t: 1, dodgeT: 0, dodgeCool: 0 };
  state.pop = 1; state.fallT = 0; state.sw = null; state.move = null; state.plan = null; state.stun = 0; state.stagger = 0; state.kickA = 0; state.kickV = 0;
  state.winded = 0; state.windedMax = 1; state.retreat = 0; state.mood = { retreat: false };
  state.mem = { blocks: [], lunges: [], turtle: 0 };
  state.swingIn = 1.2; state.intro = true; state.introT = 0;
  settleFeint('none');
  state.bout = { felled: false, shrugged: false, gut: false, second: false, slot: state.slotHits, read: state.feintsRead, pun: state.punishes, taken: state.taken };
  state.open = 0; state.riposte = 0; state.slowT = 0; state.snapT = 0;
  state.sh.hits = shieldMax(); state.sh.broken = false; state.sh.cool = 0; state.sh.blocked = false;
  // both fighters start each bout back on their marks
  Object.assign(state.foot, { pos: 0, tgt: 0, v: 1, inDown: false, inId: -1, inT: 0, wallT: -9, foeWallT: -9 });
}

function nextGap() { const S = TUNING.swing; return S.gap * 0.6 + state.rng.range(0, S.gapSpread); }

function newRound(E, seed, me0) {
  const M = TUNING.me, me = { ...me0, plates: me0.plates.slice() }, rival = E.save.get('rival', null);
  Object.assign(state, {
    me, maxHp: me.halves, staMax: M.staMax[me.sta - 1], lessons: E.save.get('feintLesson', 0), caption: null, slowT: 0,
    picks: [], grades: [], draft: null, token: TUNING.token, tokenUsed: '', epicsSeen: 0, switchReads: 0, hint: false, boutT0: 0, stepsIn: 0, stepsOut: 0, wallHits: 0, foeWall: 0, outReach: 0, shrugs: 0, rivalBeaten: 0,
    foot: { pos: 0, tgt: 0, v: 1, inDown: false, inId: -1, inT: 0, wallT: -9, foeWallT: -9 },
    seed, rng: makeRng(seed ^ 0x9e3779b9), gauntlet: rollGauntlet(seed, rival), results: [], rack: 0, m: 0, stop: 0, kickA: 0, kickV: 0,
    hp: me.halves, endT: 0, dodgeT: 0, dodgeMax: TUNING.dodge.dur, dodgeCool: 0, away: false, hurt: 0, done: false, exhaust: 0, exMsg: -9, lunging: false, lunges: 0, slotHits: 0, dg: { down: false, id: -1, t: 0 }, stepHold: null,
    stamina: M.staMax[me.sta - 1], lastAtk: -9, riposte: 0, open: 0, netT: 0, pushT: 0,
    gapHits: 0, clangs: 0, broken: 0, overheads: 0, jabs: 0, slashes: 0, blocks: 0, perfects: 0, dodges: 0, staOuts: 0, counters: 0, counterHits: 0, taken: 0, felled: 0,
    feints: 0, feintsRead: 0, feintsBit: 0, feintsNone: 0, feintLive: false, plateSaves: 0, combos: 0, windeds: 0, punishes: 0, bashes: 0, bashHits: 0, nets: 0, netted: 0, zoneReads: 0, lungeReads: 0, turtleReads: 0, presses: 0, retreats: 0, moveCount: {},
    fx: [], pops: [], streaks: [], trail: [],
    you: { dx: 0, lunge: 0, lungeK: 0, a: 0, kick: 0, kickV: 0, back: 0, hopY: 0, push: 0, parts: playerParts(me), fr: {} },
    foe: {},
    crowd: [],
    sh: { t: -1, cool: 0, up: 0, hits: TUNING.shield.hits, broken: false, flash: 0, zone: ZONES[1], held: false, hid: -1, zy: -0.58, arm: 0, blocked: false, pressT: -9 },
    hand: { down: false, id: -1, fx: 0, fy: 0, tgx: 0, tgy: 0, ux: 0, uy: 0, pux: 0, puy: 0, hx: 0, hy: 0, phx: 0, phy: 0, ex: 0, ey: 0, sx: 0, sy: 0, bx: 1, by: 0, ang: 0, pang: 0, ph: 0, e: 1, vx: 0, vy: 0, along: 0, hvx: 0, hvy: 0, lock: 0, grip: 0, sp: 0, hist: [], raisedT: -9, atk: null },
  });
  const cr = makeRng(seed ^ 0x1234567);
  for (let i = 0; i < 70; i++) state.crowd.push({ x: cr.range(0, 1), y: cr.range(0, 1), r: cr.range(2, 4), c: cr.int(0, 3) });
  newRack(E);
}

// ----- layout and frames -----
function lay(E) {
  const F = TUNING.fighter, H = E.h * F.height, half = (E.w * F.gap + 2 * F.body * H) / 2;
  // the frame is centred on the space right of the left column (partly, so the foe keeps room too)
  const R = colRect(E), cx = E.w / 2 + TUNING.col.frame * ((R.x + R.w + (E.w - E.safe.right)) / 2 - E.w / 2);
  return { H, floor: E.h * F.floor, x0: cx - half, x1: cx + half };
}
// you are drawn at your rolled size the same way: your near edge stays put
function youF(E) { const L = lay(E), y = state.you, k = meSize().scale; return { x: L.x0 + state.foot.pos * L.H + y.lunge - y.push * L.H - (k - 1) * TUNING.fighter.body * L.H, y: L.floor + y.hopY, a: y.a, dir: 1, H: L.H * k }; }
// The arena's edges, in H from each fighter's mark: how far you can give ground (negative) and how far he can, trimmed so both stay on screen.
function walls(E) {
  const L = lay(E), T = TUNING.foot, k = state.foe.size ? state.foe.size.scale : 1;
  const back = Math.min(T.room[0], Math.max(0.1, (L.x0 - 0.2 * L.H * meSize().scale - colRect(E).x - colRect(E).w - T.margin) / L.H));
  const fore = Math.min(T.room[1], Math.max(0.1, (E.w - E.safe.right - 24 - L.x1 - 0.3 * L.H * k) / L.H));
  return { back: -back, fore };
}
// the nearest the two can stand: the clear gap between the bodies at the marks, less a little air
const gMin = (E) => -(E.w * TUNING.fighter.gap) / lay(E).H + TUNING.foot.close;
// the gap between you now, in H, measured from where the marks put it
const gapNow = () => state.step.x - state.foot.pos;
const myH = (E) => lay(E).H * meSize().scale;
const myArm = (E) => TUNING.arm.len * myH(E) * meSize().reach;
const myBlade = (E) => TUNING.blade.len * myH(E) * meWeapon().reach;
// the foe is drawn at his size: the frame's unit scales, his near edge stays where a medium fighter's would be
function foeF(E) { const L = lay(E), f = state.foe, k = f.size ? f.size.scale : 1; return { x: L.x1 + f.dx + (k - 1) * TUNING.fighter.body * L.H, y: L.floor + f.dy, a: f.a, dir: -1, H: L.H * k }; }
function toScreen(F, lx, ly) {
  const c = Math.cos(F.a), s = Math.sin(F.a);
  return [F.x + F.dir * (lx * c - ly * s) * F.H, F.y + (lx * s + ly * c) * F.H];
}
function toLocal(F, X, Y) {
  const ax = F.dir * (X - F.x) / F.H, ay = (Y - F.y) / F.H, c = Math.cos(F.a), s = Math.sin(F.a);
  return [ax * c + ay * s, -ax * s + ay * c];
}
function partLocal(p, fm, lx, ly) {
  const fr = fm.fr[p.d.frame || p.d.id] || ZERO, dx = lx - fr.ox, dy = ly - fr.oy, c = Math.cos(fr.rot), s = Math.sin(fr.rot);
  return [dx * c + dy * s, -dx * s + dy * c];
}
function partCenter(F, fm, p) {
  const fr = fm.fr[p.d.frame || p.d.id] || ZERO, c = Math.cos(fr.rot), s = Math.sin(fr.rot), d = p.d;
  return toScreen(F, fr.ox + d.x * c - d.y * s, fr.oy + d.x * s + d.y * c);
}
function inside(d, lx, ly, pad) {
  if (d.shape === 'circle') return Math.hypot(lx - d.x, ly - d.y) <= d.r + pad;
  return Math.abs(lx - d.x) <= d.w / 2 + pad && Math.abs(ly - d.y) <= d.h / 2 + pad;
}
const zoneScreenY = (L, zone) => L.floor + zone.y * L.H;

// ----- the foe's pose: sway, wind-up, lunge, fall, winded -----
const cockOf = (sw, pose, zone) => POSES[pose].cock + (pose === 'thrust' && zone.id === 'high' ? -0.35 : 0);
function poseFoe(E, dt) {
  const L = lay(E), f = state.foe, sw = state.sw, S = TUNING.swing, FT = TUNING.foe;
  const fall = state.fallT > 0 ? Math.pow(clamp(state.fallT / 0.5, 0, 1), 2) : 0;
  let lean = FT.swayDeg * Math.PI / 180 * Math.sin(state.m * TUNING.swayRate * 1.3) + state.kickA, crouch = 0, lunge = 0;
  let th = covering() ? clamp(-0.3 + 2.3 * (state.cover.y + 0.8), -0.4, 1.1) + 0.05 * Math.sin(state.m * 3) : REST_TH + 0.08 * Math.sin(state.m * 3);
  if (state.winded > 0 && fall === 0) { th = 1.4 + 0.06 * Math.sin(state.m * 2.2); lean += 0.24 + 0.05 * Math.sin(state.m * 6); crouch = 0.05; }
  else if (!sw && state.open > 0 && fall === 0) lean += 0.1;
  if (sw) {
    const P = POSES[sw.pose];
    if (sw.fin > 0) {
      const v = clamp((0.4 - sw.fin) / 0.12, 0, 1), back = clamp(sw.fin / 0.2, 0, 1), c = cockOf(sw, sw.pose, sw.zone);
      th = c + (P.end - c) * v * v;
      lunge = S.lunge * P.lunge * easeOut(v) * back; lean += 0.22 * easeOut(v) * back;
    } else if (sw.fake && !sw.switched) {
      // the fake winds only part of the way and never trembles: the honest tell of a feint
      const FP = POSES[sw.fakePose], u = clamp(sw.t / (sw.switchAt * 0.8), 0, 1), e = easeOut(u) * TUNING.moves.feint.cock * (sw.hesOn ? 0.9 + 0.1 * Math.sin(state.m * 30) : 1);
      th = sw.th0 + (cockOf(sw, sw.fakePose, sw.fake) - sw.th0) * e;
      lean += FP.lean * e; crouch = FP.crouch * e;
    } else {
      const t0 = sw.switched ? sw.realAt : 0, u = clamp((sw.t - t0) / ((sw.wind - t0) * 0.55), 0, 1), e = easeOut(u);
      th = sw.th0 + (cockOf(sw, sw.pose, sw.zone) - sw.th0) * e + (u >= 1 ? Math.sin(sw.t * 55) * 0.035 : 0);
      lean += P.lean * e; crouch = P.crouch * e;
    }
    f.th = th;
  } else {
    f.th += (th - f.th) * (1 - Math.exp(-(dt || 0.016) / 0.1));
    th = f.th;
  }
  f.dx = -(lunge * L.H) + Math.sin(state.m * TUNING.swayRate * 0.8) * FT.swayX * L.H + fall * 0.3 * L.H + state.step.x * L.H;
  f.dy = crouch * L.H + Math.abs(Math.sin(state.m * (state.winded > 0 ? 4.5 : 2.4))) * -3;
  f.a = lean - fall * 1.45;
  f.fr = {
    armF: { ox: SHOULDER[0], oy: SHOULDER[1], rot: th - Math.PI / 2 },
    armB: { ox: PARTS[4].joint[0], oy: PARTS[4].joint[1], rot: sw && sw.pose === 'bash' && sw.fin <= 0 ? -1.2 : 0.14 + 0.08 * Math.sin(state.m * 1.7) },
  };
  for (const p of f.parts) {
    const fr = f.fr[p.d.frame || p.d.id] || ZERO, c = Math.cos(fr.rot), sn = Math.sin(fr.rot);
    p.cx = fr.ox + p.d.x * c - p.d.y * sn; p.cy = fr.oy + p.d.x * sn + p.d.y * c;
  }
}

// Footwork: he drifts around the distance his weapon wants, steps to striking distance just before and while he attacks (and while open),
// backs off when hurt (if this exchange's mood says so), and sidesteps your lunge once he has read it. No randomness here: the drift is a slow wave.
function stepFoe(dt, E) {
  const T = TUNING.step, st = state.step, f = state.foe, tau = T.tau * statMul('spdStep', f.spd) * f.size.step;
  st.dodgeT = Math.max(0, st.dodgeT - dt); st.dodgeCool = Math.max(0, st.dodgeCool - dt);
  const free = !state.sw && state.winded <= 0 && state.stun <= 0 && state.stagger <= 0 && state.fallT <= 0 && !state.intro && state.endT <= 0;
  if (free && state.you.lungeK > 0.5 && st.dodgeCool <= 0 && (lungeRead() || f.spd >= 5)) {
    st.dodgeT = T.dodgeDur; st.dodgeCool = T.dodgeCool;
    if (lungeRead()) { state.lungeReads++; readPop(E, 'READS YOUR LUNGE'); counter(E, 'thrust'); }
  }
  if (state.fallT > 0 || state.winded > 0 || state.stagger > 0) return;
  const c = T.circle, wave = (c[0] + c[1]) / 2 + (c[1] - c[0]) / 2 * Math.sin(state.m * 2 * Math.PI / T.period + state.rack);
  const want = st.dodgeT > 0 ? f.home + T.dodge : state.retreat > 0 ? f.home + TUNING.retreat.dist
    : state.sw || state.open > 0 || (!state.intro && state.swingIn < T.lead) ? f.strike : f.home + wave;
  // the same footwork rules as yours: he keeps his distance from where you stand, walks no faster than his legs allow
  // (barely at all while winding up a blow), and stops at the wall behind him
  const FT = TUNING.foot, pos = state.foot.pos, wl = walls(E), lo = pos + gMin(E);
  const goal = clamp(want + pos, lo, wl.fore), v = FT.foeV / (statMul('spdStep', f.spd) * f.size.step) * (state.sw && state.sw.fin <= 0 ? FT.commit : 1);
  st.x = clamp(st.x + clamp((goal - st.x) * (1 - Math.exp(-dt / tau)), -v * dt, v * dt), lo, wl.fore);
}
// a strong block or a blocked bash drives him back half a pace, to the wall at most
function pushFoe(E) {
  const FT = TUNING.foot, st = state.step, wl = walls(E), was = st.x;
  st.x = Math.min(wl.fore, st.x + FT.push * FT.pace);
  if (st.x >= wl.fore - 0.005 && state.m - state.foot.foeWallT > FT.wallMsg) {
    state.foot.foeWallT = state.m; state.foeWall++;
    const Ff = foeF(E); pop(Ff.x, Ff.y - 1.3 * Ff.H, was >= wl.fore - 0.005 ? 'PINNED!' : 'TO THE WALL!', '#fde68a', 20);
  }
}

// ----- your footwork: the rocker's In and Back, the wall behind you -----
const gripMul = () => Math.pow(TUNING.cards.grip, count('grip')) * Math.pow(TUNING.cards.feet, count('feet'));
function backToWall(E) {
  const ft = state.foot;
  if (state.m - ft.wallT < TUNING.foot.wallMsg) return;
  ft.wallT = state.m; state.wallHits++;
  const Fy = youF(E); pop(Fy.x + 30, Fy.y - 1.1 * Fy.H, 'Back to the wall!', '#fca5a5', 24); E.haptic(18); E.shake(3, 0.1);
}
function stepIn(E, pid) {
  const T = TUNING.foot, ft = state.foot, hi = state.step.x - gMin(E);
  ft.inDown = true; ft.inId = pid; ft.inT = 0;
  if (state.away || state.fallT > 0 || state.endT > 0) return;
  if (ft.pos >= hi - 0.01) return;
  ft.tgt = Math.min(hi, Math.max(ft.tgt, ft.pos) + T.pace); ft.v = T.pace / T.tapDur * gripMul(); state.stepsIn++;
  const Fy = youF(E); dust(Fy.x, Fy.y, 4); E.haptic(6); E.audio.noise({ dur: 0.05, gain: 0.06 });
}
function stepYou(E, dt) {
  const T = TUNING.foot, ft = state.foot, dg = state.dg, k = gripMul(), wl = walls(E), hi = Math.max(wl.back, state.step.x - gMin(E));
  if (ft.inDown) {
    ft.inT += dt;
    if (ft.inT > T.hold && !state.away) { ft.tgt = Math.max(ft.tgt, ft.pos) + T.walkIn * k * dt; ft.v = Math.max(ft.v, T.walkIn * k); }
  }
  const holding = dg.down && dg.t > TUNING.dodge.dur;
  if (holding) ft.tgt -= T.walkBack * k * dt;
  ft.tgt = clamp(ft.tgt, wl.back, hi);
  ft.pos = clamp(ft.pos + clamp(ft.tgt - ft.pos, -ft.v * dt, ft.v * dt), wl.back, hi);
  // holding Back against the wall: you can give no more ground, and the backed-off guard ends
  if (holding && ft.pos <= wl.back + 0.005) { backToWall(E); dg.down = false; dg.id = -1; }
}

function tiredPop(E) {
  if (state.m - state.exMsg < 0.8) return;
  state.exMsg = state.m;
  const Fy = youF(E); pop(Fy.x, Fy.y - 1.0 * Fy.H, state.exhaust > 0 ? 'EXHAUSTED' : 'TOO TIRED', '#fca5a5', 16);
}

function guardUp() { return !state.sw && state.open <= 0 && state.stun <= 0 && state.stagger <= 0 && state.fallT <= 0 && state.winded <= 0; }
// The foe's cover: after a blow lands he slides his guard (or shield) over that spot for a few seconds. It is down while he swings, is open, winded or stunned.
const hesitating = () => !!state.sw && !!state.sw.fake && state.sw.hesOn && !state.sw.switched && state.sw.fin <= 0;
const covering = () => !!state.cover && state.cover.t > 0 && guardUp();
const guarded = (p) => covering() && Math.hypot(p.cx - state.cover.x, p.cy - state.cover.y) <= state.cover.r;
const covered = (p) => p.armour || guarded(p);
function setCover(p) {
  const c = state.cover, r = state.foe.shield ? TUNING.foe.coverShield : TUNING.foe.coverGuard;
  state.cover = { x: p.cx, y: p.cy, r, t: TUNING.cover.dur, max: TUNING.cover.dur, dx: c ? c.dx : 0.28, dy: c ? c.dy : -0.67 };
}
const raised = () => !state.sh.broken && state.sh.arm <= 0 && state.you.lungeK < 0.15 && (state.sh.held || (state.sh.t >= 0 && state.sh.t < TUNING.shield.dur));
const blocks = (zone) => raised() && state.sh.zone === zone;
const relative = () => TUNING.control.relative >= 0.5;
// the guard: a relaxed, half-bent arm in front of the body (relative control), in screen px, on the body as it stands now
function guardPt(E) {
  const H = myH(E), [sx, sy] = toScreen(youF(E), SHOULDER[0], SHOULDER[1]), g = TUNING.control.guard;
  return [sx + g[0] * H, sy + g[1] * H];
}
// thumb offset from the anchor, times the gain, px
function relOff() { const h = state.hand, G = TUNING.control.gain; return [(h.fx - h.ax) * G, (h.fy - h.ay) * G]; }

function poseYou(E, dt) {
  const L = { H: myH(E) }, y = state.you, D = TUNING.dodge, h = state.hand, sh = state.sh;
  const LU = TUNING.lunge;
  // lunge: the aim point pushed past the reach steps the gladiator in, up to a stride; he steps back when the hand relaxes or recoils
  let tk = 0;
  if (h.down && h.lock <= 0 && !state.away && state.exhaust <= 0 && state.endT <= 0 && state.fallT <= 0 && !(state.netT > 0 && TUNING.net.stuck)) {
    if (relative()) { const [ox, oy] = relOff(), C = TUNING.control; tk = clamp((Math.hypot(ox, oy) / myArm(E) - C.lungeStart) / (C.lungeFull - C.lungeStart), 0, 1); }
    else tk = clamp((Math.hypot(h.tgx - (h.sx - y.lunge), h.tgy - h.sy) / L.H - LU.start) / (LU.full - LU.start), 0, 1);
    if (tk > 0.1 && !state.lunging) {
      const lc = LU.cost * (has('lungem') ? TUNING.cards.lungem : 1);
      if (state.stamina >= lc) { state.stamina -= lc; state.lastAtk = state.m; state.lunging = true; state.lunges++; state.mem.lunges.push(state.m); swooshSound(E, 0.1); }
      else { tk = 0; tiredPop(E); }
    } else if (tk < 0.05) state.lunging = false;
  } else state.lunging = false;
  y.lungeK += (tk - y.lungeK) * (1 - Math.exp(-dt / (tk > y.lungeK ? LU.tauIn : LU.tauOut)));
  y.lunge = y.lungeK * LU.stride * L.H;
  const want = state.away ? 1 : 0;
  y.back += (want - y.back) * (1 - Math.exp(-dt / (want ? 0.05 : 0.14)));
  const u = state.dodgeT > 0 ? 1 - state.dodgeT / state.dodgeMax : 1;
  y.hopY = state.dodgeT > 0 ? -D.hop * L.H * Math.sin(Math.PI * u) : 0;
  y.kickV += (-y.kick * 90 - y.kickV * 7) * dt; y.kick += y.kickV * dt;
  y.push += ((state.pushT > 0 ? TUNING.moves.bash.push : 0) - y.push) * (1 - Math.exp(-dt / (state.pushT > 0 ? 0.05 : 0.25)));
  const LN = TUNING.lean, a = h.atk;
  // upright, sword leading; lean only on a fast slash whose aim lies past the straight arm's reach
  let leanT = LN.base;
  if (a && a.kind === 'slash' && h.down && h.lock <= 0 && h.sp >= TUNING.hit.mid * LN.fast) leanT += LN.max * clamp((Math.hypot(h.tgx - h.sx, h.tgy - h.sy) / L.H - LN.beyond) / LN.span, 0, 1);
  leanT = Math.min(leanT, LN.max) - 0.22 * y.back;
  y.a += (leanT - y.a) * (1 - Math.exp(-dt / (leanT > y.a ? LN.tau : LN.back)));
  sh.zy += (sh.zone.sy - sh.zy) * (1 - Math.exp(-dt / 0.05));
  sh.up += ((raised() ? 1 : 0) - sh.up) * (1 - Math.exp(-dt / (raised() ? 0.045 : 0.12)));
  const [cx, cy] = shieldPos();
  y.fr = { armB: { ox: PARTS[4].joint[0], oy: PARTS[4].joint[1], rot: Math.atan2(cy - PARTS[4].joint[1], cx - PARTS[4].joint[0]) - Math.PI / 2 + 0.05 * Math.sin(state.m * 1.9) } };
}
// shield centre in body units: hanging at the hip, or raised to the zone
function shieldPos() {
  const sh = state.sh, J = PARTS[4].joint;
  return [lerp(J[0] + 0.3 * Math.cos(1.69), 0.2, sh.up), lerp(J[1] + 0.3 * Math.sin(1.69), sh.zy, sh.up)];
}

// ----- particles -----
function straw(x, y, ang, spread, speed, n) {
  for (let i = 0; i < n; i++) {
    const a = ang + (Math.random() - 0.5) * spread;
    const s = speed * (0.35 + Math.random() * 0.9);
    state.fx.push({ k: 's', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, g: 650, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 14, len: 8 + Math.random() * 12, life: 0.7 + Math.random() * 0.5, max: 1.1, c: STRAW[Math.random() * 4 | 0] });
  }
}
function sparks(x, y, ang, n) {
  for (let i = 0; i < n; i++) {
    const a = ang + (Math.random() - 0.5) * 2.4;
    const s = 220 + Math.random() * 380;
    state.fx.push({ k: 'k', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 500, life: 0.18 + Math.random() * 0.2, max: 0.38, c: Math.random() < 0.5 ? '#ffe9a8' : '#ffffff' });
  }
}
function dust(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, s = 30 + Math.random() * 90;
    state.fx.push({ k: 'd', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, g: 0, life: 0.35 + Math.random() * 0.25, max: 0.6, r: 4 + Math.random() * 6, c: '#8a7452' });
  }
}
function ring(x, y, r, color) { state.fx.push({ k: 'r', x, y, r0: 10, r, life: 0.3, max: 0.3, c: color }); }
function pop(x, y, s, color, size) { state.pops.push({ x, y, s, color, size, life: 0.8, max: 0.8 }); }
function plateBits(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, s = 200 + Math.random() * 360;
    state.fx.push({ k: 'p', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 900, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 20, w: 10 + Math.random() * 12, h: 6 + Math.random() * 8, life: 0.9 + Math.random() * 0.4, max: 1.3 });
  }
}

// ----- sounds -----
function sliceSound(E, delay, big) {
  const A = E.audio, f = 1500 + Math.random() * 500;
  A.noise({ dur: 0.1, gain: 0.26, delay });
  A.beep({ freq: f, dur: 0.09, type: 'sawtooth', slide: 0.22, gain: 0.07, delay });
  A.beep({ freq: 150, dur: 0.1, type: 'sine', slide: 0.45, gain: 0.26, delay });
  A.noise({ dur: 0.03, gain: 0.2, delay: delay + 0.025 });
  A.noise({ dur: 0.03, gain: 0.16, delay: delay + 0.055 });
  if (big) A.beep({ freq: 90, dur: 0.22, type: 'sine', slide: 0.4, gain: 0.3, delay });
}
function clangSound(E, delay) {
  const A = E.audio;
  A.beep({ freq: 190, dur: 0.2, type: 'triangle', slide: 0.85, gain: 0.26, delay });
  A.beep({ freq: 301, dur: 0.12, type: 'square', slide: 0.9, gain: 0.05, delay });
  A.beep({ freq: 523, dur: 0.07, type: 'sine', gain: 0.05, delay });
  A.noise({ dur: 0.03, gain: 0.1, delay });
}
function parrySound(E) {
  const A = E.audio;
  A.beep({ freq: 880, dur: 0.16, type: 'square', slide: 0.7, gain: 0.1 });
  A.beep({ freq: 1320, dur: 0.1, type: 'sine', gain: 0.1 });
  A.beep({ freq: 220, dur: 0.18, type: 'triangle', slide: 0.6, gain: 0.25 });
  A.noise({ dur: 0.05, gain: 0.18 });
}
function swooshSound(E, gain = 0.12) { E.audio.noise({ dur: 0.16, gain }); E.audio.beep({ freq: 700, dur: 0.14, type: 'sine', slide: 0.3, gain: gain * 0.4 }); }

// ----- the sword arm: the aim point follows the finger, the arm stays straight on a circle round the shoulder and bends when the finger draws in -----
function solveArm(E, dt) {
  const h = state.hand, A = TUNING.arm, G = TUNING.grip, H = myH(E);
  const [sx, sy] = toScreen(youF(E), SHOULDER[0], SHOULDER[1]);
  const arm = myArm(E), blade = myBlade(E);
  const ax = h.tgx - sx, ay = h.tgy - sy, d = Math.hypot(ax, ay) || 1, dx = ax / d, dy = ay / d;
  const e = clamp((d / H - A.chamberAt) / (A.straightAt - A.chamberAt), 0, 1);
  const r = arm * (A.minFrac + (A.full - A.minFrac) * e);
  h.e = e; h.sx = sx; h.sy = sy; h.ang = Math.atan2(dy, dx);
  h.hx = sx + dx * r; h.hy = sy + dy * r;
  const half = r / 2, bend = Math.sqrt(Math.max(0, (arm / 2) ** 2 - half * half));
  let nx = -dy, ny = dx; if (-0.3 * nx + ny < 0) { nx = -nx; ny = -ny; }
  h.ex = sx + dx * half + nx * bend; h.ey = sy + dy * half + ny * bend;
  // the blade hangs from the fist: up from the arm line, more so when chambered, along the line in a thrust, trailing a swing
  const omega = dt > 0 ? wrap(h.ang - h.pang) / dt : 0; h.pang = h.ang;
  const thrust = clamp(h.along / 700, 0, 1);
  const tg = h.ang + (G.straight + (G.chamber - G.straight) * (1 - e)) * (1 - thrust) - clamp(omega * G.trail, -0.5, 0.5);
  h.ph = dt > 0 ? h.ph + wrap(tg - h.ph) * (1 - Math.exp(-dt / G.tau)) : tg;
  h.bx = Math.cos(h.ph); h.by = Math.sin(h.ph);
  h.ux = h.hx + h.bx * blade; h.uy = h.hy + h.by * blade;
}

function restPt(E) {
  if (relative()) return guardPt(E);
  const [sx, sy] = toScreen(youF(E), SHOULDER[0], SHOULDER[1]), H = myH(E);
  return [sx + TUNING.hand.rest[0] * H, sy + TUNING.hand.rest[1] * H];
}

function moveHand(E, dt) {
  const h = state.hand, HT = TUNING.hand, L = { H: myH(E) }, tired = state.stamina <= 0 || state.exhaust > 0;
  h.pux = h.ux; h.puy = h.uy; h.phx = h.hx; h.phy = h.hy;
  if (h.lock > 0) {
    h.lock -= dt;
    h.tgx += h.hvx * dt; h.tgy += h.hvy * dt;
    const damp = Math.exp(-9 * dt); h.hvx *= damp; h.hvy *= damp;
    h.tgx = clamp(h.tgx, 10, E.w - 10); h.tgy = clamp(h.tgy, E.safe.top + 40, E.h - 10);
    if (h.lock <= 0) h.grip = 0.3;
  } else if (h.down) {
    const lag = (h.grip > 0 ? HT.regrip : HT.lag) * meLag() * (tired ? HT.tiredLag : 1) * (state.netT > 0 ? TUNING.moves.net.slow : 1);
    const k = 1 - Math.exp(-dt / lag);
    if (relative()) {
      const [gx, gy] = guardPt(E), [ox, oy] = relOff();
      h.tgx += (clamp(gx + ox, 10, E.w - 10) - h.tgx) * k; h.tgy += (clamp(gy + oy, E.safe.top + 40, E.h - 10) - h.tgy) * k;
    } else { h.tgx += (clamp(h.fx, 0, E.w) - h.tgx) * k; h.tgy += (h.fy - TUNING.offset - h.tgy) * k; }
    if (h.grip > 0) h.grip -= dt;
  } else {
    const [rx, ry] = restPt(E);
    const k = 1 - Math.exp(-dt / (relative() ? TUNING.control.back : 0.09));
    h.tgx += (rx - h.tgx) * k; h.tgy += (ry - h.tgy) * k;
  }
  solveArm(E, dt);
  const iv = Math.max(dt, 0.001), vx = (h.ux - h.pux) / iv, vy = (h.uy - h.puy) / iv, inst = Math.hypot(vx, vy), kv = 1 - Math.exp(-dt / 0.03);
  h.vx += (vx - h.vx) * kv; h.vy += (vy - h.vy) * kv;
  h.along = h.vx * Math.cos(h.ang) + h.vy * Math.sin(h.ang);  // tip speed straight out from the shoulder
    h.sp = h.down && h.lock <= 0 ? h.sp * 0.5 + inst * 0.5 : 0;
  if (h.hy < (relative() ? guardPt(E)[1] : h.sy) - TUNING.attack.over.raise * L.H) h.raisedT = state.m;
  state.trail.push({ x: h.ux, y: h.uy, life: 0.12 });
  for (const q of state.trail) q.life -= dt;
  state.trail = state.trail.filter((q) => q.life > 0);
}

// An attack is born when the tip gets fast, and is named by how it moves: straight out from the shoulder (jab), down after the hand was above the head (overhead),
// up (a free raise, no blow), or any other arc (slash). The cost is paid then.
function updateAttack(E, dt) {
  const h = state.hand, T = TUNING, AT = T.attack, S = T.stamina, sh = state.sh;
  const live = h.down && h.lock <= 0 && !state.away && state.endT <= 0 && state.fallT <= 0;
  if (h.atk && (!live || h.sp < T.hit.minSpeed * 0.55)) h.atk = null;
  if (!h.atk && live && h.sp >= T.hit.minSpeed) {
    const spv = Math.hypot(h.vx, h.vy) || 1, ux = h.vx / spv, uy = h.vy / spv;
    // relative control: a jab is a push forward along the guard line, whatever the arm's aim; absolute: straight out from the shoulder
    const ga = relative() ? Math.atan2(TUNING.control.guard[1], TUNING.control.guard[0]) : h.ang, along = (h.vx * Math.cos(ga) + h.vy * Math.sin(ga)) / spv;
    let kind = null;
    if (along > (relative() ? TUNING.control.jabCone : 0.85)) { if (spv >= AT.jab.minSpeed) kind = 'jab'; }
    else if (uy > 0.25 && state.m - h.raisedT < AT.over.window) { if (spv >= AT.over.minSpeed) kind = 'over'; }
    else if (uy < -0.7) kind = 'raise';
    else kind = 'slash';
    if (kind === 'raise') h.atk = { kind, done: true };
    else if (kind && state.exhaust > 0) tiredPop(E);
    else if (kind) {
      const tired = state.stamina <= 0, cost = AT[kind].cost * meWeapon().cost;
      state.stamina = Math.max(0, state.stamina - cost);
      state.lastAtk = state.m;
      h.atk = { kind, tired, done: false };
      if (kind === 'over') state.overheads++; else if (kind === 'jab') state.jabs++; else state.slashes++;
    }
  }
  // regen: only when not swinging, holding or dodging; faster when also not blocking
  const RM = TUNING.me.staRegen[state.me.sta - 1] * TUNING.me.armour[state.me.set].regen * Math.pow(TUNING.cards.breath, count('breath'));
  if (state.m - state.lastAtk > S.delay && !sh.held && !state.away) state.stamina = Math.min(state.staMax, state.stamina + S.regen * RM * (raised() ? 1 : S.idleMul) * dt);
}

function checkExhaust(E, dt) {
  state.exhaust = Math.max(0, state.exhaust - dt);
  if (state.stamina <= 0 && state.exhaust <= 0 && has('second') && !state.bout.second) {
    state.bout.second = true; state.stamina = state.staMax * TUNING.cards.second;
    const Fy = youF(E); pop(Fy.x, Fy.y - 1.0 * Fy.H, 'SECOND WIND', '#7dd3fc', 20); E.haptic(15);
    return;
  }
  if (state.stamina <= 0 && state.exhaust <= 0) {
    state.stamina = 0; state.exhaust = TUNING.stamina.exhaust; state.staOuts++; state.hand.atk = null;
    const Fy = youF(E); pop(Fy.x, Fy.y - 1.0 * Fy.H, 'EXHAUSTED', '#fca5a5', 20); E.haptic(20);
  }
}

// One hit per swing: the first thing the blade meets decides it (tip first, earliest point of the sweep first; a slot wins over the part it sits on).
function checkHits(E) {
  const h = state.hand, T = TUNING, a = h.atk;
  if (!a || a.done || h.lock > 0 || state.fallT > 0 || state.endT > 0 || state.away) return;
  const need = a.kind === 'jab' ? T.attack.jab.minSpeed : a.kind === 'over' ? T.attack.over.minSpeed : T.hit.minSpeed;
  if (h.sp < need) return;
  const F = foeF(E), fm = state.foe, jab = a.kind === 'jab', pad = (jab ? T.blade.jabPad : T.blade.pad) / F.H;
  const order = fm.parts.filter((p) => p.slot).concat(fm.parts.filter((p) => !p.slot));
  let first = null;
  scan: for (const f of [0.4, 0.7, 1]) {
    const hx = h.phx + (h.hx - h.phx) * f, hy = h.phy + (h.hy - h.phy) * f, tx = h.pux + (h.ux - h.pux) * f, ty = h.puy + (h.uy - h.puy) * f;
    const k0 = jab ? 1 - T.blade.tip : 0, x0 = hx + (tx - hx) * k0, y0 = hy + (ty - hy) * k0;
    const n = Math.max(1, Math.ceil(Math.hypot(tx - x0, ty - y0) / 8));
    for (let i = n; i >= 0; i--) {
      const x = x0 + (tx - x0) * i / n, y = y0 + (ty - y0) * i / n;
      const [lx, ly] = toLocal(F, x, y);
      for (const p of order) {
        if (p.cool > 0 || p.cut) continue;
        const [qx, qy] = partLocal(p, fm, lx, ly);
        if (inside(p.d, qx, qy, pad)) { first = { p, at: { x, y, lx: qx, ly: qy } }; break scan; }
      }
    }
  }
  if (!first) return;
  const { p, at } = first, ang = Math.atan2(h.vy, h.vx), sp = h.sp;
  let stop;
  if (covered(p)) stop = bounce(E, p, at, ang, sp, a);
  else stop = gapHit(E, p, at, ang, sp, 0, a, p.slot && jab && alongSlit(F, fm, p));
  a.done = true;
  state.stop = Math.max(state.stop, stop);
}

// A jab goes into a slot only if its direction (in the foe's frame, and the limb's) is within the tolerance of the slit's axis.
function alongSlit(F, fm, p) {
  const h = state.hand, sp = Math.hypot(h.vx, h.vy) || 1, ax = F.dir * h.vx / sp, ay = h.vy / sp, c = Math.cos(F.a), s = Math.sin(F.a);
  let lx = ax * c + ay * s, ly = -ax * s + ay * c;
  const fr = fm.fr[p.d.frame || p.d.id] || ZERO, fc = Math.cos(fr.rot), fs = Math.sin(fr.rot);
  [lx, ly] = [lx * fc + ly * fs, -lx * fs + ly * fc];
  return Math.abs(lx * Math.cos(p.d.axis) + ly * Math.sin(p.d.axis)) >= Math.cos(TUNING.cover.jabTol);
}

function bounce(E, p, at, ang, sp, a) {
  const h = state.hand, A = TUNING.armour, J = TUNING.juice, AT = TUNING.attack[a.kind], glance = a.kind === 'jab';
  state.clangs++; p.clang = 0.25; p.cool = 0.3;
  const dn = p.armour && !glance ? AT.dents * (a.kind === 'over' ? Math.pow(TUNING.cards.heavy, count('heavy')) : 1) : 0;
  p.dents += dn;
  const rv = glance ? clamp(sp * 0.3, 200, 420) : clamp(sp * A.kick, 450, 1300);
  h.hvx = -Math.cos(ang) * rv; h.hvy = -Math.sin(ang) * rv; h.lock = AT.recoil * TUNING.me.spdLag[state.me.spd - 1] / meWeapon().speed * (glance ? Math.pow(TUNING.cards.wrist, count('wrist')) : 1); h.grip = 0; h.atk = null;
  const d = p.d, sz = d.shape === 'circle' ? d.r : Math.min(d.w, d.h) / 2;
  for (let c = 0; c < dn; c++) {
    const a0 = Math.random() * 6.28, pts = [[Math.cos(a0) * 0.1 * sz, Math.sin(a0) * 0.1 * sz]];
    for (let k = 1; k <= 4; k++) { const b = a0 + (Math.random() - 0.5) * 0.9; pts.push([pts[0][0] + Math.cos(b) * sz * 0.5 * k * (0.8 + Math.random() * 0.4), pts[0][1] + Math.sin(b) * sz * 0.5 * k * (0.8 + Math.random() * 0.4)]); }
    p.cracks.push(pts);
  }
  sparks(at.x, at.y, ang + Math.PI, glance ? 8 : 24); ring(at.x, at.y, glance ? 24 : 44, '#cbd5e1');
  clangSound(E, 0); E.shake(glance ? 2 : 6, 0.12); E.haptic(glance ? 8 : 24);
  let stop = glance ? 0.01 : J.stopClang + 0.02;
  const breakAt = a.kind === 'over' && meWeapon().overBreak ? meWeapon().overBreak : A.dents;
  if (p.armour && p.dents >= breakAt) {
    p.armour = false; state.broken++;
    const [sx, sy] = partCenter(foeF(E), state.foe, p);
    plateBits(sx, sy, 9); ring(sx, sy, 70, '#ffe9a8'); pop(sx, sy - 24, 'PLATE BROKEN', '#ffe9a8', 17);
    E.audio.beep({ freq: 110, dur: 0.25, type: 'sine', slide: 0.4, gain: 0.3 }); E.shake(8, 0.2); E.haptic(30);
    stop = J.stopBreak + 0.04;
  } else pop(at.x, at.y - 18, glance ? 'GLANCE' : !p.armour ? 'GUARDED' : p.dents >= breakAt - 1 ? 'DENT!' : 'CLANG', '#9aa4b2', glance ? 13 : 16);
  if (state.cover) state.cover.t = Math.max(state.cover.t, TUNING.cover.dur * 0.5);
  const onGuard = !p.armour;
  if (onGuard) spendFoe(E, TUNING.foeSta.block);
  if (a.kind === 'over' || (state.foe.shield && onGuard)) counter(E);
  return stop;
}

// A counter is a fresh one-move exchange: a quick thrust or chop, planned now with the fight RNG, its zone glowing like any tell.
function counter(E, kind) {
  if (!bout().counters || state.sw || state.fallT > 0 || state.stun > 0 || state.endT > 0 || state.stagger > 0 || state.winded > 0 || state.intro) return;
  const k = kind || (state.rng.chance(0.5) ? 'thrust' : 'chop');
  state.plan = null;
  startMove(E, buildMove(state.rng, k, { avoid: blockRun(), wind: 1, fixed: TUNING.counter.windup * statMul('spdWind', state.foe.spd) }), true);
  state.counters++;
  const Ff = foeF(E); pop(Ff.x, Ff.y - 1.0 * Ff.H, 'COUNTER!', '#ff8a7a', 20);
}

function gapHit(E, p, at, ang, sp, delay, a, thrust) {
  const T = TUNING, J = T.juice, AT = T.attack, kind = a.kind, f = state.foe, slot = p.slot;
  const MW = meWeapon();
  let dmg = kind === 'jab' ? AT.jab.dmg : kind === 'over' ? AT.over.dmg : sp >= T.hit.mid ? AT.slash.fastDmg : AT.slash.dmg;
  if (a.tired) dmg = Math.max(1, Math.floor(dmg * T.stamina.tired));
  dmg *= T.me.str[state.me.str - 1];
  // the weapon multiplies after the usual rounding, to the nearest half, so the gladius hits exactly as before
  const wm = MW.dmg * (kind === 'slash' ? MW.slash : 1);
  const rip = state.riposte > 0, winded = state.winded > 0;
  if (rip) dmg *= T.shield.riposteMul;
  // the open window multiplies after rounding, so a punish is exactly 1.5x (health can hold halves)
  const raw = Math.max(1, Math.round(thrust ? dmg * (MW.slot + (has('blade') ? T.cards.blade : 0)) : dmg + (!slot ? T.cards.edge * count('edge') : 0)));
  let dealt = Math.max(0.5, Math.round(raw * wm * 2) / 2) * (winded ? T.foeSta.windedDmg : 1);
  // Executioner: a slot hit on a foe below a quarter of his health fells him
  const exec = thrust && has('exec') && f.hp < f.maxHp * T.cards.exec;
  if (exec) dealt = Math.max(dealt, f.hp);
  p.cool = T.hit.cool; p.flash = 0.16; state.gapHits++; if (thrust) state.slotHits++; if (winded) state.punishes++;
  f.hp -= dealt;
  const gl = kind === 'jab' ? 0.03 : 0.06;
  if (!slot) { p.hp -= dmg * wm; p.gashes.push({ a: [at.lx - Math.cos(ang) * gl, at.ly - Math.sin(ang) * gl], b: [at.lx + Math.cos(ang) * gl, at.ly + Math.sin(ang) * gl], t: state.m }); }
  const big = dealt >= 3;
  const n = Math.min(60, J.strawPerDmg * dealt);
  straw(at.x, at.y, ang + Math.PI / 2, 2.6, 260 + dealt * 50, n >> 1);
  straw(at.x, at.y, ang - Math.PI / 2, 2.6, 260 + dealt * 50, n >> 1);
  dust(at.x, at.y, 3 + dealt * 3);
  sliceSound(E, delay, big);
  pop(at.x, at.y - 20, exec ? 'EXECUTED!' : rip ? `RIPOSTE x${Math.round(dealt)}` : winded ? `PUNISH x${Math.round(dealt)}` : thrust ? `${p.d.label}!` : kind === 'jab' ? 'STAB' : kind === 'over' ? 'SMASH!' : dealt >= 2 ? 'HARD' : 'HIT', rip ? '#ffd24a' : thrust ? '#ff6a4a' : big ? '#ffb347' : '#fff0b8', Math.min(34, 15 + dealt * 4));
  state.kickV += T.foe.kick * (Math.cos(ang) > 0 ? -1 : 0.5) * (0.6 + Math.min(dealt, 4) * 0.4);
  E.shake(2 + Math.min(dealt, 5) * 2.5, 0.1); E.haptic(10 + Math.min(dealt, 5) * 8);
  if (big) E.flash('#fff0b8', 0.07);
  let stop = dealt >= 3 ? J.stop3 : dealt >= 2 ? J.stop2 : J.stop1;
  if (!slot && p.hp <= 0) { disable(E, p, at, ang); stop += 0.04; }
  if (f.hp <= 0) fell(E);
  else {
    setCover(p);
    // he backs off when hurt, if this exchange's mood (rolled when it was planned) says so
    if (state.mood.retreat && !state.sw && state.winded <= 0 && f.hp < f.maxHp * T.retreat.hurt) {
      state.mood.retreat = false; state.retreat = T.retreat.dur; state.retreats++; state.swingIn = Math.max(state.swingIn, T.retreat.dur);
    }
  }
  return stop;
}

function disable(E, p, at, ang) {
  p.cut = true;
  straw(at.x, at.y, ang + Math.PI / 2, 3, 360, 22); straw(at.x, at.y, ang - Math.PI / 2, 3, 360, 22);
  pop(at.x, at.y - 44, 'DOWN', '#ff9f43', 20);
  E.audio.beep({ freq: 90, dur: 0.22, type: 'sine', slide: 0.4, gain: 0.3 });
  if (p.d.id === 'head') {
    state.stun = TUNING.stun; state.sw = null; state.move = null; state.plan = null; state.swingIn = nextGap();
    pop(at.x, at.y - 70, 'STUNNED', '#a5b4fc', 20);
  }
}

function fell(E) {
  if (state.fallT > 0) return;
  state.felled++; state.fallT = 0.01; state.sw = null; state.move = null; state.plan = null; state.winded = 0; state.results[state.rack] = 'felled';
  state.hp = Math.min(state.maxHp, state.hp + TUNING.heal + TUNING.cards.crowd * count('crowd') + TUNING.cards.lionFell * count('lion'));
  state.grades.push(gradeBout());
  if (state.foe.rival) { state.rivalBeaten = 1; E.save.set('rival', null); pop(E.w * 0.62, E.h * 0.42, 'Rival defeated!', '#f87171', 30); }
  pop(E.w * 0.62, E.h * 0.3, 'FOE DOWN', '#ffd24a', 28); E.shake(10, 0.3); E.flash('#fff0b8', 0.1); E.audio.play('coin');
}


// ----- between bouts: the grade and the draft -----
// The bout's grade from what this bout added to the run's counts.
function boutTally() {
  const b = state.bout;
  return { slot: state.slotHits - b.slot, read: state.feintsRead - b.read, pun: state.punishes - b.pun, taken: state.taken - b.taken };
}
function gradeBout() {
  const G = TUNING.grade, t = boutTally(), skill = t.slot + t.read + t.pun;
  if (t.taken <= G.S.taken && t.read + t.pun >= G.S.skill) return 'S';
  if (t.taken <= G.A.taken && skill >= G.A.skill) return 'A';
  if (t.taken <= G.B.taken && skill >= G.B.skill) return 'B';
  return 'C';
}
// What can still be dealt: commons always, a rare or epic only once, and never a plate you already wear.
function dealable() {
  const me = state.me;
  return DECK.filter((c) => ((c.tier === 0 && !c.once) || !has(c.id)) && !(c.id === 'greaves' && me.plates.includes('legs')) && !(c.id === 'helm' && me.plates.includes('head')));
}
// Three seeded cards, dealt once when the draft opens (salt 0) or rerolled (salt 1, never the cards just shown when the deck allows):
// each card's tier by the grade's odds (an S grade's first is epic), then a card of that tier.
function dealDraft(grade, salt = 0, not = []) {
  const D = TUNING.draft, rng = makeRng((state.seed ^ 0x7f4a7c15) + state.rack * 104729 + salt * 15485863), all = dealable(), out = [];
  const fresh = all.filter((c) => !not.includes(c)), pool = fresh.length >= D.deal ? fresh : all;
  for (let i = 0; i < D.deal; i++) {
    const left = pool.filter((c) => !out.includes(c)), tiers = [0, 1, 2].filter((t) => left.some((c) => c.tier === t));
    if (!tiers.length) break;
    const tier = grade === 'S' && i === 0 && tiers.includes(2) ? 2 : pickW(rng, tiers.map((t) => [t, D.odds[grade][t]]));
    out.push(rng.pick(left.filter((c) => c.tier === tier)));
  }
  return out;
}
function openDraft(E) {
  const grade = state.grades[state.grades.length - 1] || 'C';
  state.draft = { grade, tally: boutTally(), cards: dealDraft(grade), t: 0, btns: [], reroll: null };
  state.epicsSeen += state.draft.cards.filter((c) => c.tier === 2).length;
  const h = state.hand; h.down = false; h.id = -1; h.atk = null; state.sh.held = false; state.sh.hid = -1; state.dg.down = false; state.foot.inDown = false; state.stepHold = null;
  E.audio.play('coin');
}
function pickCard(E, c) {
  const me = state.me, C = TUNING.cards;
  state.picks.push(c.id);
  if (c.id === 'hide') { state.maxHp += C.hide; state.hp += C.hide; }
  else if (c.id === 'lion') { state.maxHp += C.lion; state.hp += C.lion; }
  else if (c.id === 'wind') { const add = state.staMax * (C.wind - 1); state.staMax += add; state.stamina += add; }
  else if (c.id === 'greaves' || c.id === 'helm') {
    const id = c.id === 'greaves' ? 'legs' : 'head';
    me.plates.push(id); state.you.parts.find((q) => q.d.id === id).armour = true;
  }
  E.audio.play('tap'); E.haptic(15);
  state.draft = null; state.rack++; newRack(E); poseFoe(E, 0.016);
}
// the run's one token, spent on the draft: three new cards
function rerollDraft(E) {
  const d = state.draft;
  if (!d || state.token <= 0) return;
  state.token--; state.tokenUsed = `reroll-b${state.rack + 1}`;
  d.cards = dealDraft(d.grade, 1, d.cards); d.t = 0;
  state.epicsSeen += d.cards.filter((c) => c.tier === 2).length;
  E.audio.beep({ freq: 520, dur: 0.12, type: 'triangle', slide: 1.4, gain: 0.12 }); E.haptic(12);
}

// ----- the foe's mind: each exchange is planned with the fight RNG when it starts, then played out exactly, so every tell is honest -----
// What he remembers of you.
function blockRun() {
  const R = TUNING.read, b = state.mem.blocks;
  if (!bout().memory || b.length < R.blockRun || state.m - b[b.length - 1].t > R.memWin) return null;
  const last = b.slice(-R.blockRun);
  return last.every((q) => q.z === last[0].z) ? last[0].z : null;
}
const lungeRead = () => !!bout().memory && state.mem.lunges.filter((t) => state.m - t < TUNING.read.lungeWin).length >= TUNING.read.lunges;
const turtling = () => !!bout().memory && state.mem.turtle >= TUNING.read.turtle;
const pressing = () => bout().memory && state.stamina < state.staMax * TUNING.read.lowSta;
function readPop(E, s) { const Ff = foeF(E); pop(Ff.x, Ff.y - 1.12 * Ff.H, s, '#c4b5fd', 14); }

function pickW(rng, list) { let tot = 0; for (const e of list) tot += e[1]; let r = rng() * tot; for (const e of list) { r -= e[1]; if (r < 0) return e[0]; } return list[list.length - 1][0]; }
const pickZone = (rng, avoid, not) => pickW(rng, ZONES.filter((z) => z.id !== not).map((z) => [z.id, z.id === avoid ? TUNING.read.avoid : 1]));
// half hearts one blow takes: the move, weapon, size and Strength
function blowDmg(k) {
  const f = state.foe, S = TUNING.stat.strDmg;
  return k <= 0 ? 0 : clamp(Math.round(k * f.weapon.dmg * f.size.dmg * (S[0] + S[1] * f.str)), 1, TUNING.foe.dmgCap);
}

// A move is a list of blows, each with its zone, windup, damage and pose; a feint's one blow carries the fake zone it shows first.
function buildMove(rng, kind, ctx) {
  const f = state.foe, M = TUNING.moves, W = f.weapon, avoid = ctx.avoid, spd = f.size.wind * statMul('spdWind', f.spd);
  const base = TUNING.swing.windup * W.speed * spd * ctx.wind * (bout().tell || 1), wind = (k) => ctx.fixed || base * k;
  const blow = (zone, w, dmg, pose) => ({ zone, wind: w, dmg: blowDmg(dmg), pose });
  const mv = { kind, cost: M[kind].cost, hits: [] };
  if (kind === 'chop') mv.hits.push(blow('high', wind(M.chop.wind), M.chop.dmg, 'chop'));
  else if (kind === 'sweep') mv.hits.push(blow('low', wind(M.sweep.wind), M.sweep.dmg, 'sweep'));
  else if (kind === 'thrust') {
    const z = avoid === 'mid' || (avoid !== 'high' && W.id === 'spear' && rng.chance(M.thrust.high)) ? 'high' : 'mid';
    mv.hits.push(blow(z, wind(M.thrust.wind), M.thrust.dmg, 'thrust'));
  } else if (kind === 'combo') {
    const n = rng.int(W.combo[0], W.combo[1]);
    let z = pickZone(rng, avoid);
    for (let i = 0; i < n; i++) {
      if (i) z = pickZone(rng, avoid, z);
      mv.hits.push(blow(z, base * M.combo.wind * (i ? M.combo.next : 1), M.combo.dmg, W.id === 'spear' && z !== 'low' ? 'thrust' : ZONE_POSE[z]));
    }
    mv.cost = M.combo.cost * n;
  } else if (kind === 'feint') {
    // the zone you have been blocking is the best lie
    // the real tell after the jump: his size and Speed shorten it, but never below min; Keen Eye adds to it
    const fake = avoid || pickZone(rng, null), real = pickZone(rng, avoid, fake), show = base * M.feint.show, hes = TUNING.lesson.hes;
    const after = Math.max(M.feint.min, M.feint.after * spd) + TUNING.cards.keen * count('keen');
    mv.hits.push({ ...blow(real, show + hes + after, M.feint.dmg, ZONE_POSE[real]), fake, fakePose: ZONE_POSE[fake], switchAt: show, hes });
  } else if (kind === 'bash') mv.hits.push(blow('mid', wind(M.bash.wind), 0, 'bash'));
  else if (kind === 'net') mv.hits.push(blow('mid', wind(M.net.wind), 0, 'net'));
  return mv;
}

// An exchange: a rhythm (flurry, probe or pause), one to three moves weighted by his weapon and by what he has read of you, his mood if hurt, the pause after.
function planExchange(E) {
  const rng = state.rng, f = state.foe, R = TUNING.read;
  const avoid = blockRun(), turtle = turtling(), press = pressing();
  const rh = pickW(rng, TUNING.rhythm.map((r) => [r, r.w * (press && r.id === 'flurry' ? R.pressMul : 1)]));
  const n = rng.int(rh.n[0], rh.n[1]), wind = rh.wind * (press ? R.pressWind : 1), q = [];
  for (let i = 0; i < n; i++) {
    const w = Object.entries(f.weapon.moves).filter(([k]) => k !== 'feint' || bout().feints).map(([k, v]) => [k, v * (k === 'feint' ? rh.feint * (turtle ? R.turtleFeint : 1) : 1) * (avoid && MOVE_ZONE[k] === avoid ? R.avoid : 1)]);
    if (f.shield) w.push(['bash', TUNING.moves.bash.w * (turtle ? R.turtleBash : 1)]);
    const kind = pickW(rng, w);
    q.push(buildMove(rng, kind, { avoid, wind }));
    if (kind === 'combo') break;  // a combo ends the exchange: he is winded after it
  }
  state.mood.retreat = rng.chance(TUNING.retreat.chance);
  if (avoid) { state.zoneReads++; readPop(E, `READS YOUR ${ZONE[avoid].label} GUARD`); }
  else if (turtle) { state.turtleReads++; readPop(E, 'READS YOUR SHIELD'); }
  else if (press) { state.presses++; readPop(E, 'PRESSES YOU'); }
  return { q, gap: rh.gap, after: nextGap() * rh.after, rhythm: rh.id, avoid };
}

function startMove(E, mv, isCounter) {
  const f = state.foe;
  state.move = mv; mv.idx = 0; mv.counter = !!isCounter;
  f.sta -= mv.cost; f.staT = 0;
  state.moveCount[mv.kind] = (state.moveCount[mv.kind] || 0) + 1;
  if (mv.kind === 'feint') state.feints++; else if (mv.kind === 'combo') state.combos++; else if (mv.kind === 'bash') state.bashes++; else if (mv.kind === 'net') state.nets++;
  startBlow(E);
}
function startBlow(E) {
  const mv = state.move, h = mv.hits[mv.idx], f = state.foe;
  settleFeint('none');
  state.feintLive = !!h.fake;
  const k = 1 + TUNING.armSlow * f.parts.filter((p) => (p.d.id === 'armF' || p.d.id === 'armB') && p.cut).length;
  state.sw = {
    zone: ZONE[h.fake || h.zone], real: ZONE[h.zone], fake: h.fake ? ZONE[h.fake] : null, fakePose: h.fakePose, switchAt: (h.switchAt || 0) * k, switched: false,
    t: 0, wind: h.wind * k, dmg: h.dmg, pose: h.pose, kind: mv.kind, idx: mv.idx, n: mv.hits.length, counter: mv.counter, fin: 0, outcome: null, th0: f.th,
    hes: (h.hes || 0) * k, hesOn: false, realAt: 0, lesson: null,
  };
  // the first feint ever is a slow-motion lesson, the second a short reminder (counted in the save)
  if (h.fake && state.lessons < 2) {
    state.sw.lesson = state.lessons === 0 ? 'slow' : 'remind';
    state.lessons++; E.save.set('feintLesson', state.lessons);
  }
}
// the fake ends in a violet hesitation; then the glow jumps to the real zone
function feintHesitate(E) {
  const sw = state.sw, L = TUNING.lesson;
  sw.hesOn = true;
  E.audio.beep({ freq: 620, dur: 0.12, type: 'sine', slide: 0.7, gain: 0.08 });
  if (sw.lesson === 'slow') state.caption = { lines: [`FEINT! He faked ${sw.fake.label}.`, 'Wait for the glow to settle, then block where it lands.'], t: L.cap, max: L.cap };
  else if (sw.lesson === 'remind') state.caption = { lines: ['Feint: wait for the glow to settle.'], t: L.remind, max: L.remind };
}
// the jump: a crisp snap, and the real zone's button flashes under the thumb
function feintSwitch(E) {
  const sw = state.sw;
  sw.switched = true; sw.th0 = state.foe.th; sw.zone = sw.real; sw.realAt = sw.t; state.snapT = TUNING.moves.feint.snap;
  const Ff = foeF(E); pop(Ff.x - 0.3 * Ff.H, zoneScreenY(lay(E), sw.real) + 0.16 * lay(E).H, 'FEINT!', '#c4b5fd', 20);
  E.audio.noise({ dur: 0.025, gain: 0.3 });
  E.audio.beep({ freq: 2200, dur: 0.03, type: 'square', slide: 0.5, gain: 0.08 });
  E.audio.beep({ freq: 1100, dur: 0.05, type: 'triangle', gain: 0.1, delay: 0.01 });
  E.haptic(12);
}
// a blow is done: the next blow of a combo, the next move of the exchange, or a pause; winded after a combo or at zero stamina, open otherwise
function endBlow(E) {
  const mv = state.move; state.sw = null;
  if (mv && !mv.broken && mv.idx + 1 < mv.hits.length) { mv.idx++; startBlow(E); return; }
  state.move = null;
  const plan = state.plan;
  if (plan && plan.q.length) state.swingIn = plan.gap; else { state.swingIn = plan ? plan.after : nextGap(); state.plan = null; }
  if (state.foe.sta <= 0) windFoe(E, TUNING.foeSta.winded);
  else if (mv && mv.kind === 'combo' && !mv.broken) windFoe(E, TUNING.foeSta.combo);
  else state.open = TUNING.open.dur;
}
// You held still through the fake and blocked the real strike: he loses a chunk of stamina, often enough to wind him when the blow is done.
function feintRead(E, bx, by) {
  const f = state.foe;
  state.feintsRead++; f.sta -= TUNING.feintRead.drain * f.staMax; f.staT = 0;
  pop(bx + 20, by - 64, 'Feint read!', '#c4b5fd', 30);
  E.flash('#a78bfa', 0.12); E.haptic(30);
  E.audio.beep({ freq: 660, dur: 0.12, type: 'triangle', gain: 0.12 }); E.audio.beep({ freq: 990, dur: 0.16, type: 'sine', gain: 0.1, delay: 0.08 });
  if (state.caption && state.sw && state.sw.lesson) state.caption = { lines: ['Feint read! He spent his stamina on the fake.'], t: 2.2, max: 2.2, good: true };
}
function spendFoe(E, n) {
  const f = state.foe; f.sta -= n; f.staT = 0;
  if (f.sta <= 0 && !state.sw && state.winded <= 0) windFoe(E, TUNING.foeSta.winded);
}
// winded is the open window: a brief slow, OPEN!, and his slots glow until he recovers
function windFoe(E, dur) {
  if (state.fallT > 0) return;
  dur += has('hunter') ? TUNING.cards.hunter : 0;
  state.winded = dur; state.windedMax = dur; state.windeds++; state.slowT = TUNING.openWin.dur;
  const Ff = foeF(E); pop(Ff.x, Ff.y - 1.2 * Ff.H, 'OPEN!', '#ffd24a', 34); E.flash('#ffd24a', 0.06);
  state.sw = null; state.move = null; state.plan = null; state.open = 0; state.retreat = 0; state.swingIn = Math.max(state.swingIn, 0.6);
  state.foe.sta = Math.max(0, state.foe.sta);
  E.audio.beep({ freq: 180, dur: 0.3, type: 'sine', slide: 0.5, gain: 0.16 });
}

function updateFoe(dt, E) {
  const f = state.foe, FS = TUNING.foeSta;
  if (state.fallT > 0 || state.intro) return;
  f.staT += dt;
  if (!state.sw && f.staT > FS.delay) f.sta = Math.min(f.staMax, f.sta + FS.regen * (state.winded > 0 ? FS.windedRegen : 1) * dt);
  state.retreat = Math.max(0, state.retreat - dt);
  if (state.winded > 0) { state.winded = Math.max(0, state.winded - dt); return; }
  if (state.stun > 0) { state.stun -= dt; return; }
  const sw = state.sw;
  if (sw) {
    if (sw.fin > 0) { sw.fin -= dt; if (sw.fin <= 0) endBlow(E); return; }
    sw.t += dt;
    if (sw.fake && raised() && state.sh.zone === sw.fake) sw.sawFake = true;
    if (sw.fake && !sw.switched) {
      if (!sw.hesOn && sw.t >= sw.switchAt) feintHesitate(E);
      if (sw.t >= sw.switchAt + sw.hes) feintSwitch(E);
    }
    if (sw.t >= sw.wind) resolveSwing(E);
    return;
  }
  if (state.stagger > 0) return;
  state.swingIn -= dt;
  if (state.swingIn <= 0 && state.endT <= 0) {
    if (!state.plan) state.plan = planExchange(E);
    startMove(E, state.plan.q.shift(), false);
  }
}

// ----- the left hand: three shield buttons and the step rocker (Back: tap = the quick backstep, hold = keep backing off; In: tap = a pace in, hold = walk in) -----
function colRect(E) {
  const C = TUNING.col, x = 10 + E.safe.left, w = Math.max(C.minW, Math.round(E.w * C.frac));
  const bottom = E.h - 10 - E.safe.bottom, stepH = Math.max(C.stepMinH, Math.round(E.h * C.stepFrac)), top = E.safe.top + C.top;
  return { x, w, top, bottom, stepH, h: (bottom - top - stepH - 3 * C.gap) / 3 };
}
function shieldBtns(E) {
  const C = TUNING.col, R = colRect(E), h = R.h;
  const out = ZONES.map((z, i) => ({ z, x: R.x, y: R.top + i * (h + C.gap), w: R.w, h }));
  const sy = R.bottom - R.stepH;
  out.push({ z: null, rocker: true, back: true, x: R.x, y: sy, w: R.w / 2, h: R.stepH }, { z: null, rocker: true, back: false, x: R.x + R.w / 2, y: sy, w: R.w / 2, h: R.stepH });
  return out;
}

// A button's touch area: 8 px past each drawn edge, but only half the gap toward a neighbour, and the two step buttons meet at their shared edge.
function hitRect(E, b) {
  const C = TUNING.col, first = b.z === ZONES[0], last = b.rocker;
  const x0 = b.rocker && !b.back ? b.x : b.x - C.reach, x1 = b.rocker && b.back ? b.x + b.w : b.x + b.w + C.reach;
  return { x0, x1, y0: b.y - (first ? C.reach : C.gap / 2), y1: b.y + b.h + (last ? C.reach : C.gap / 2) };
}
function buttonAt(E, p) {
  return shieldBtns(E).find((b) => { const r = hitRect(E, b); return p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1; }) || null;
}
const stepSide = (b) => (b && b.rocker ? (b.back ? 'back' : 'in') : null);

function pressStep(E, side, pid) { if (side === 'back') dodge(E, pid); else stepIn(E, pid); }
function releaseStep(pid) {
  const dg = state.dg, ft = state.foot;
  if (ft.inDown && ft.inId === pid) { ft.inDown = false; ft.inId = -1; }
  if (dg.down && dg.id === pid) { dg.down = false; dg.id = -1; }
}

function raiseShield(E, zone, pid) {
  const s = state.sh, Fy = youF(E);
  if (s.broken) { pop(Fy.x, Fy.y - 1.0 * Fy.H, 'NO SHIELD', '#94a3b8', 14); return; }
  if (state.away || state.you.lungeK >= 0.15) return;
  if (!raised() && !(s.arm > 0)) {
    if (s.cool > 0) return;
    s.zone = zone; s.zy = zone.sy; s.blocked = false;
    if (state.exhaust > 0) { s.arm = TUNING.shield.slow; s.t = -1; } else s.t = 0;
    E.audio.beep({ freq: 260, dur: 0.07, type: 'triangle', slide: 1.5, gain: 0.12 }); E.haptic(8);
  } else if (s.zone !== zone) {
    // switching zones is instant, with no cooldown: the shield moves at once and stays up as if just raised
    s.zone = zone; if (s.t >= 0) s.t = 0;
    E.audio.beep({ freq: 330, dur: 0.05, type: 'triangle', gain: 0.08 }); E.haptic(6);
  }
  s.pressT = state.m;
  if (pid != null) { s.held = true; s.hid = pid; }
}

// The backstep is the old dodge, now a real step back: out of reach for its length, and the ground stays given. At the wall there is none to give.
function dodge(E, pid) {
  const D = TUNING.dodge, Fy = youF(E), s = state.sh, h = state.hand, ft = state.foot, wl = walls(E);
  if (state.away || state.dodgeCool > 0) return;
  if (ft.pos <= wl.back + 0.01) { backToWall(E); return; }
  if (state.stamina < D.cost) { tiredPop(E); return; }
  state.stamina -= D.cost; state.lastAtk = state.m;
  const spd = TUNING.me.spdDodge[state.me.spd - 1];
  // Blur: his blow in flight now aims at the ghost left where you stood
  if (has('blur') && state.sw && state.sw.fin <= 0 && !state.sw.ghostX) state.sw.ghostX = Fy.x;
  state.dodges++; state.stepsOut++; state.away = true; state.dodgeT = state.dodgeMax = D.dur * spd; h.atk = null;
  ft.tgt = Math.max(wl.back, Math.min(ft.tgt, ft.pos) - TUNING.foot.back * spd); ft.v = TUNING.foot.back * spd / state.dodgeMax * gripMul();
  state.dg.down = true; state.dg.id = pid; state.dg.t = 0;
  s.held = false; s.hid = -1; s.t = -1; s.arm = 0;
  pop(Fy.x, Fy.y - 1.0 * Fy.H, 'BACK', '#7de3ff', 24); swooshSound(E, 0.16); E.haptic(12);
  dust(Fy.x, Fy.y, 8);
}

function updateDefence(dt, E) {
  const s = state.sh, D = TUNING.dodge, S = TUNING.shield, dg = state.dg;
  if (s.held) { state.stamina -= S.drain * steadyMul() * dt; state.lastAtk = state.m; if (state.stamina <= 0) { state.stamina = 0; s.held = false; s.hid = -1; s.t = -1; s.cool = S.cool; } }
  if (s.arm > 0) { s.arm -= dt; if (s.arm <= 0) s.t = 0; }
  // the cooldown follows only a raise that blocked a blow
  if (s.t >= 0) { s.t += dt; if (s.t >= S.dur && !s.held) { s.t = -1; s.cool = s.blocked ? S.cool : 0; s.blocked = false; } }
  s.cool = Math.max(0, s.cool - dt); s.flash = Math.max(0, s.flash - dt);
  state.dodgeCool = Math.max(0, state.dodgeCool - dt);
  if (dg.down) {
    dg.t += dt;
    if (dg.t > D.dur) { state.stamina -= D.drain * dt; state.lastAtk = state.m; if (state.stamina <= 0) { state.stamina = 0; dg.down = false; dg.id = -1; } }
  }
  if (state.away && !dg.down && state.dodgeT <= 0) { state.away = false; state.dodgeCool = D.cool; }
}
const steadyMul = () => Math.pow(TUNING.cards.steady, count('steady'));
const shieldMax = () => TUNING.shield.hits + TUNING.cards.tough * count('tough');

function resolveSwing(E) {
  const sw = state.sw, L = lay(E), zy = zoneScreenY(L, sw.zone), Fy = youF(E), Ff = foeF(E), sh = state.sh, SH = TUNING.shield, M = TUNING.moves, W = state.foe.weapon;
  const net = sw.pose === 'net', bash = sw.pose === 'bash', feint = !!sw.fake;
  sw.fin = 0.4;
  state.streaks.push({ x1: Ff.x - Ff.H * 0.3, y1: zy - 30, x2: Fy.x - L.H * 0.1, y2: zy + 20, life: 0.22, max: 0.22, red: !state.away, net });
  if (sw.ghostX) {
    sw.outcome = 'whiff'; settleFeint('none');
    swooshSound(E, 0.2); pop(sw.ghostX, zy - 30, 'HE HIT YOUR GHOST', '#e879f9', 20); return;
  }
  if (state.away) {
    sw.outcome = 'whiff'; settleFeint('none');
    swooshSound(E, 0.2); pop(E.w / 2, zy - 30, net ? 'NET DODGED' : feint ? 'FEINT DODGED' : 'OUT OF REACH', '#7de3ff', 18); return;
  }
  // range: a blow lands only if he stands within his striking distance (plus a little reach); the net is thrown and always carries
  if (!net && gapNow() > state.foe.strike + TUNING.foot.reach) {
    sw.outcome = 'whiff'; state.outReach++; settleFeint('none');
    swooshSound(E, 0.2); pop(E.w / 2, zy - 30, 'OUT OF REACH', '#7de3ff', 20); return;
  }
  if (blocks(sw.zone)) {
    // a read is the shield in the real zone when the real strike lands, however it got there: switching from the fake is the skill
    const perfect = sh.t <= SH.perfect && !net && !bash, bx = Fy.x + 0.28 * L.H, by = zy, read = feint;
    sw.outcome = 'block'; state.blocks++; sh.flash = 0.25; sh.blocked = true;
    if (read) { settleFeint('read'); feintRead(E, bx, by); if (sw.sawFake) state.switchReads++; }
    state.mem.blocks.push({ z: sw.zone.id, t: state.m }); if (state.mem.blocks.length > 6) state.mem.blocks.shift();
    // a read of your guard breaks off the rest of this exchange, so his next move already aims elsewhere
    const run = blockRun();
    if (run && state.plan && state.plan.avoid !== run) { state.plan.q = []; state.plan.after = Math.min(state.plan.after, 1.2); }
    sparks(bx, by, 0, perfect ? 30 : 16); ring(bx, by, perfect ? 130 : 70, perfect ? '#ffd24a' : '#ffffff');
    if (net) { pop(bx, by - 40, 'NET BLOCKED', '#ffffff', 22); clangSound(E, 0); return; }
    if (perfect) {
      state.perfects++; state.stagger = SH.stagger; state.riposte = SH.riposte; state.plan = null; if (state.move) state.move.broken = true;
      parrySound(E); E.shake(10, 0.2); E.haptic(35); E.flash('#fff0b8', 0.1); E.audio.play('coin');
      state.stop = Math.max(state.stop, 0.12);
      pop(bx, by - 40, 'PERFECT BLOCK', '#ffd24a', 28); if (!read) pop(bx + 30, by - 70, 'RIPOSTE!', '#ffd24a', 18);
      state.kickV += -0.8; pushFoe(E);
      if (has('mirror')) mirrorBlow(E, bx, by);
      if (has('riposte')) counterJab(E);
    } else {
      // Counter Stance: a shield pressed within a moment of the strike staggers him
      if (has('cstance') && state.m - sh.pressT <= TUNING.cards.cstance) {
        state.stagger = SH.stagger; state.plan = null; if (state.move) state.move.broken = true; pushFoe(E);
        pop(bx + 30, by - 96, 'STAGGERED!', '#7dd3fc', 20);
      }
      sh.hits -= bash ? 1 : W.wear;
      const drain = (bash ? M.bash.drain * M.bash.blocked : W.drain) * steadyMul();
      if (drain) { state.stamina = Math.max(0, state.stamina - drain); state.lastAtk = state.m; pop(bx, by - 70, 'DRAINED', '#fca5a5', 14); }
      if (bash) { if (!has('stance')) state.pushT = 0.2; pushFoe(E); }
      clangSound(E, 0); E.shake(bash || W.wear > 1 ? 9 : 6, 0.15); E.haptic(22); state.stop = Math.max(state.stop, 0.06);
      if (!read) pop(bx, by - 40, feint ? 'FEINT BLOCKED' : bash ? 'BASH BLOCKED' : W.wear > 1 ? 'SHIELD CRACKS' : 'BLOCK', '#ffffff', 24);
      state.you.kickV -= bash ? 6 : 3;
      if (sh.hits <= 0) {
        sh.hits = 0; sh.broken = true; sh.t = -1; sh.up = 0;
        plateBits(bx, by, 12); pop(bx, by - 70, 'SHIELD BROKEN', '#ff9f43', 22); E.shake(9, 0.2);
        E.audio.beep({ freq: 110, dur: 0.25, type: 'sine', slide: 0.4, gain: 0.3 });
      }
    }
    return;
  }
  state.mem.blocks = [];
  if (feint) { state.feintsBit++; settleFeint('bit'); }
  if (net && has('cutter')) {
    sw.outcome = 'cut'; pop(Fy.x, zy - 40, 'NET CUT', '#e2e8f0', 26); E.audio.noise({ dur: 0.08, gain: 0.15 }); return;
  }
  if (net) {
    sw.outcome = 'net'; state.netT = M.net.dur; state.netted++;
    pop(Fy.x, zy - 40, 'NETTED', '#e2e8f0', 30); E.shake(6, 0.2); E.haptic(30); E.audio.noise({ dur: 0.25, gain: 0.2 });
    return;
  }
  if (bash) {
    sw.outcome = 'bash'; state.bashHits++;
    if (!has('stance')) { state.pushT = 0.35; pushYou(E); }
    state.stamina = Math.max(0, state.stamina - M.bash.drain); state.lastAtk = state.m;
    pop(Fy.x, zy - 40, 'BASHED', '#fca5a5', 30); E.shake(12, 0.25); E.haptic(45); clangSound(E, 0); E.audio.play('boom', 0.5);
    state.you.kickV -= 8; state.hand.lock = Math.max(state.hand.lock, 0.3); state.hand.hvx = -260; state.hand.hvy = 60; state.hand.atk = null;
    return;
  }
  // Unbreakable: the first blow each bout that would hurt you is shrugged off
  if (has('unbreak') && !state.bout.shrugged) {
    state.bout.shrugged = true; state.shrugs++; sw.outcome = 'shrug';
    sparks(Fy.x + 0.2 * L.H, zy, Math.PI, 20); clangSound(E, 0); E.shake(6, 0.2); E.haptic(30);
    pop(Fy.x, zy - 40, 'UNBREAKABLE', '#e879f9', 28); return;
  }
  // Iron Gut: the first blow to the body each bout costs nothing
  if (has('gut') && !state.bout.gut && sw.zone.id === 'mid') {
    state.bout.gut = true; state.shrugs++; sw.outcome = 'shrug';
    clangSound(E, 0); E.shake(6, 0.2); E.haptic(30);
    pop(Fy.x, zy - 40, 'IRON GUT', '#7dd3fc', 28); return;
  }
  // a blow on one of your plates costs half as much (a quarter heart for a light blow)
  const part = state.you.parts.find((q) => q.d.id === ZONE_PART[sw.zone.id]), plated = !!(part && part.armour), dmg = sw.dmg * (plated ? TUNING.me.plateMul : 1);
  sw.outcome = 'hit'; state.hp -= dmg; state.taken++; state.hurt = plated ? 0.25 : 0.4; if (sw.counter) state.counterHits++;
  if (plated) { state.plateSaves++; part.clang = 0.25; const [px, py] = partCenter(Fy, state.you, part); sparks(px, py, Math.PI, 16); clangSound(E, 0); }
  E.flash('#ff2a2a', plated ? 0.15 : 0.3); E.shake(12 + 4 * sw.dmg, 0.35); E.haptic(50 + 20 * sw.dmg);
  E.audio.play('boom'); E.audio.play('lose', 0.5);
  pop(Fy.x, zy - 40, feint ? 'FEINTED!' : plated ? 'PLATE TOOK IT' : sw.dmg >= 2 ? `OUCH x${sw.dmg}` : 'OUCH', plated ? '#cbd5e1' : '#ff5a4a', 30 + 4 * sw.dmg);
  state.you.kickV -= 7;
  state.hand.lock = Math.max(state.hand.lock, 0.2); state.hand.hvx = -200; state.hand.hvy = 120; state.hand.atk = null;
  if (state.hp <= 0) { state.hp = 0; state.endT = 1.0; state.results[state.rack] = 'lost'; }
}

// Every feint ends as exactly one of read, bitten or neither (dodged, out of reach, or cut short by a stun, a winding or a fell).
function settleFeint(how) {
  if (!state.feintLive) return;
  state.feintLive = false;
  if (how === 'none') state.feintsNone++;
}
// Mirror Shield: a perfect block sends a half-heart's worth back into him
function mirrorBlow(E, bx, by) {
  const f = state.foe;
  if (f.hp <= 0) return;
  f.hp -= TUNING.cards.mirror;
  pop(bx + 40, by - 100, 'MIRRORED!', '#e879f9', 22); E.flash('#e879f9', 0.08);
  if (f.hp <= 0) fell(E);
}
// his bash drives you back half a pace, to the wall at most
function pushYou(E) {
  const FT = TUNING.foot, ft = state.foot, wl = walls(E);
  ft.pos = Math.max(wl.back, ft.pos - FT.push * FT.pace); ft.tgt = Math.min(ft.tgt, ft.pos);
  if (ft.pos <= wl.back + 0.005) backToWall(E);
}
// Riposte: a perfect block sends a free jab into the first bare part he leaves (a body part before a slot), at the riposte's damage
function counterJab(E) {
  const f = state.foe, F = foeF(E);
  const p = f.parts.find((q) => !q.slot && !q.armour && !q.cut) || f.parts.find((q) => q.slot && !q.cut);
  if (!p || f.hp <= 0) return;
  const [x, y] = partCenter(F, f, p);
  state.stop = Math.max(state.stop, gapHit(E, p, { x, y, lx: p.d.x, ly: p.d.y }, Math.PI, TUNING.hit.mid, 0, { kind: 'jab', tired: false }, false));
  pop(x, y - 46, 'COUNTER JAB', '#7dd3fc', 16);
}

// ----- drawing: one procedural body for both fighters -----
function path(ctx, d, H, inset = 0) {
  ctx.beginPath();
  if (d.shape === 'circle') { ctx.arc(d.x * H, d.y * H, (d.r - inset) * H, 0, Math.PI * 2); return; }
  const w = (d.w - inset * 2) * H, h = (d.h - inset * 2) * H, x = d.x * H - w / 2, y = d.y * H - h / 2, r = Math.min(w, h) * 0.18;
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ----- the skin: plates, gaps and bodies over the hit shapes. Each part is painted once into a sprite and repainted only when it changes. -----
const TAU = Math.PI * 2;
const STEEL = { hi: '#f2f5f8', lite: '#c3cbd3', mid: '#8d97a1', dark: '#49515a', edge: '#1f242a' };
const POLISH = { hi: '#ffffff', lite: '#dfe5eb', mid: '#a7b1bc', dark: '#56606b', edge: '#1c2127' };
const IRON = { hi: '#dcdad4', lite: '#a6a39c', mid: '#77746d', dark: '#3d3a35', edge: '#1a1815' };
const BRONZE = { hi: '#ffe7b0', lite: '#dcae62', mid: '#a9772f', dark: '#5e3e15', edge: '#2b1b08' };
const LEATHER = { lite: '#9a6a3c', mid: '#6e4524', dark: '#3e2511' };
const LINEN = { lite: '#e8dcbc', mid: '#b9aa86', dark: '#6d6248' };
// The foe's weapon sets his type (flavour only). A helmet is drawn only on a plated head, so the art never hides a bare part.
const GTYPE = {
  gladius: { id: 'murmillo', helm: 'murmillo', bare: 'leather', metal: STEEL, trim: '#c9a43a', skin: '#b9835a', hair: '#2a1a10', tunic: '#9b2f2f', hem: '#5e1818', crest: '#c8372a', wrap: 'tunic' },
  spear: { id: 'hoplomachus', helm: 'hoplo', bare: 'leather', metal: STEEL, trim: '#d6b04a', skin: '#c08a5c', hair: '#3a2414', tunic: '#38457a', hem: '#1f2748', crest: '#efe6cf', wrap: 'tunic' },
  axe: { id: 'brute', helm: 'open', bare: 'hair', beard: true, pauldron: true, metal: IRON, trim: '#8a7a5a', skin: '#a8714a', hair: '#1a120c', tunic: '#5a3b22', hem: '#2e1d10', wrap: 'loin' },
  dagger: { id: 'retiarius', helm: 'cap', bare: 'band', band: '#c9a43a', galerus: true, net: true, metal: STEEL, trim: '#d6b04a', skin: '#c99568', hair: '#4a2a14', tunic: '#b08c34', hem: '#6e561a', wrap: 'loin' },
};
// Your metal follows your rolled armour set: bronze and leather, steel with bronze trim, polished steel with gold and a red crest.
const MYLOOK = {
  light: { metal: BRONZE, trim: LEATHER.mid },
  medium: { metal: STEEL, trim: BRONZE.lite },
  heavy: { metal: POLISH, trim: '#e6c866', crest: '#d8473a' },
};
// Your look: the gladiator type of your rolled weapon, in your own colours (teal tunic) and the metal of your armour set.
function myLook(me) {
  const G = GTYPE[me.weapon], A = MYLOOK[me.set];
  return { ...G, id: `you-${me.set}-${me.weapon}${me.female ? 'f' : ''}`, metal: A.metal, trim: A.trim, skin: YOU.skin, hair: '#3a2414', tunic: YOU.tunic, hem: YOU.hem,
    crest: A.crest || G.crest || YOU.crest, band: G.band ? YOU.crest : YOU.tunic, beard: G.beard && !me.female };
}
const lookOf = (fm, isFoe) => (isFoe ? GTYPE[fm.weapon.id] : myLook(state.me));
// What shows through each gap, and which sides the plate edges frame it from (top and bottom, or left and right).
const SLOT_ART = { 'slot-neck': ['skin', 'tb'], 'slot-armpit': ['linen', 'lr'], 'slot-waist': ['linen', 'tb'], 'slot-elbow': ['skin', 'tb'], 'slot-knee': ['skin', 'tb'] };
// Sprite bounds in body units (arms in their own frame): room for crests, straps, the fist and the shoulder guards.
const BOX = { head: [-0.17, -1.05, 0.18, -0.66], chest: [-0.15, -0.74, 0.16, -0.5], belly: [-0.19, -0.54, 0.19, -0.24], armF: [-0.12, -0.2, 0.12, 0.37], armB: [-0.12, -0.2, 0.12, 0.37], legs: [-0.21, -0.43, 0.25, 0.02] };
const LEGS = [[[-0.02, -0.37], [-0.07, -0.19], [-0.12, -0.02]], [[0.02, -0.37], [0.09, -0.2], [0.12, -0.02]]];
const canSprite = typeof OffscreenCanvas === 'function';

const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function shade(h, f) { return '#' + rgbOf(h).map((v) => Math.round(f >= 1 ? v + (255 - v) * Math.min(1, f - 1) : v * f).toString(16).padStart(2, '0')).join(''); }
const lw = (H, k) => Math.max(1, k * H);
function line(c, x0, y0, x1, y1) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
function metalGrad(c, x0, y0, x1, y1, M, dn = 0) {
  const g = c.createLinearGradient(x0, y0, x1, y1), k = 1 - 0.3 * dn;
  g.addColorStop(0, shade(M.lite, k)); g.addColorStop(0.3, shade(M.hi, k)); g.addColorStop(0.55, shade(M.mid, k)); g.addColorStop(1, shade(M.dark, k));
  return g;
}
function skinGrad(c, x0, y0, x1, y1, col) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, shade(col, 1.16)); g.addColorStop(0.45, col); g.addColorStop(1, shade(col, 0.64));
  return g;
}
// a dark outer edge, and an inner rim lit from above and shadowed below
function bevel(c, shape, M, H, y0, y1) {
  shape(0); c.strokeStyle = M.edge; c.lineWidth = lw(H, 0.009); c.lineJoin = 'round'; c.stroke();
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, 'rgba(255,255,255,0.75)'); g.addColorStop(0.5, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0.5)');
  shape(0.011 * H); c.strokeStyle = g; c.lineWidth = lw(H, 0.006); c.stroke();
}
function rivet(c, x, y, H, M) {
  const s = lw(H, 0.0065);
  c.fillStyle = M.edge; c.beginPath(); c.arc(x, y, s, 0, TAU); c.fill();
  c.fillStyle = M.hi; c.beginPath(); c.arc(x - s * 0.3, y - s * 0.3, s * 0.45, 0, TAU); c.fill();
}
function strap(c, x0, y0, x1, y1, w, H, buckle) {
  c.lineCap = 'butt';
  c.strokeStyle = LEATHER.dark; c.lineWidth = w + lw(H, 0.005); line(c, x0, y0, x1, y1);
  c.strokeStyle = LEATHER.mid; c.lineWidth = w; line(c, x0, y0, x1, y1);
  c.strokeStyle = 'rgba(255,220,170,0.4)'; c.lineWidth = Math.max(0.6, w * 0.12); c.setLineDash([w * 0.45, w * 0.45]); line(c, x0, y0, x1, y1); c.setLineDash([]);
  if (buckle) {
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    c.fillStyle = '#d6b04a'; c.fillRect(mx - w * 0.5, my - w * 0.4, w, w * 0.8);
    c.strokeStyle = '#4a3410'; c.lineWidth = Math.max(0.6, w * 0.15); c.strokeRect(mx - w * 0.25, my - w * 0.2, w * 0.5, w * 0.4);
  }
}
function dent(c, x, y, s, i) {
  const g = c.createRadialGradient(x - s * 0.25, y - s * 0.25, 0, x, y, s);
  g.addColorStop(0, 'rgba(8,10,14,0.8)'); g.addColorStop(0.6, 'rgba(8,10,14,0.42)'); g.addColorStop(1, 'rgba(8,10,14,0)');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, s, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = Math.max(0.8, s * 0.14); c.beginPath(); c.arc(x, y, s * 0.72, 0.1, 1.7); c.stroke();
  const a = 0.5 + i * 1.9, dx = Math.cos(a) * s * 1.5, dy = Math.sin(a) * s * 1.5;
  c.lineWidth = Math.max(0.7, s * 0.1); c.strokeStyle = 'rgba(15,17,21,0.8)'; line(c, x - dx, y - dy, x + dx, y + dy);
  c.strokeStyle = 'rgba(255,255,255,0.6)'; line(c, x - dx + 0.8, y - dy + 0.8, x + dx + 0.8, y + dy + 0.8);
}
// dents as dark dimples with a scratch, cracks as jagged lines, both kept on the plate
function wear(c, p, H, cx, cy, sz, clip) {
  if (!p.dents && !p.cracks.length) return;
  c.save(); clip(); c.clip();
  for (let i = 0; i < p.dents; i++) { const a = i * 2.4 + 0.7; dent(c, cx + Math.cos(a) * sz * 0.45, cy + Math.sin(a) * sz * 0.4, sz * 0.32, i); }
  c.lineJoin = 'round';
  for (const k of p.cracks) {
    const trace = (o) => { c.beginPath(); k.forEach((q, i) => (i ? c.lineTo((p.d.x + q[0]) * H + o, (p.d.y + q[1]) * H + o) : c.moveTo((p.d.x + q[0]) * H + o, (p.d.y + q[1]) * H + o))); c.stroke(); };
    c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = lw(H, 0.004); trace(1);
    c.strokeStyle = '#0e1114'; c.lineWidth = lw(H, 0.007); trace(0);
  }
  c.restore();
}
// a bare part darkens as it is hurt, and goes dark and limp when disabled (sprites only: it paints over what is already there)
function tint(c, p, H) {
  const k = p.cut ? 0.68 : (1 - clamp(p.hp / TUNING.part.hp, 0, 1)) * 0.3;
  if (k <= 0 || !canSprite) return;
  const b = BOX[p.d.id];
  c.save(); c.globalCompositeOperation = 'source-atop'; c.fillStyle = `rgba(36,16,8,${k})`; c.fillRect(b[0] * H, b[1] * H, (b[2] - b[0]) * H, (b[3] - b[1]) * H); c.restore();
}

function plume(c, x, y, r, col, H, s) {
  c.fillStyle = col; c.strokeStyle = '#2a1c10'; c.lineWidth = lw(H, 0.005);
  c.beginPath(); c.moveTo(x + r * 0.6, y - r * 0.85); c.quadraticCurveTo(x + r * 0.1, y - r * (1 + s), x - r * 1.2, y - r * (0.9 + s * 0.4));
  c.quadraticCurveTo(x - r * 1.65, y - r * 0.6, x - r * 1.5, y - r * 0.05); c.quadraticCurveTo(x - r * 1.1, y - r * 0.75, x - r * 0.5, y - r * 0.95);
  c.quadraticCurveTo(x, y - r * 1.05, x + r * 0.6, y - r * 0.85); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = shade(col, 0.72); c.lineWidth = lw(H, 0.003);
  for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(x + r * (0.3 - i * 0.25), y - r * (1.0 + s * 0.3)); c.quadraticCurveTo(x - r * (0.6 + i * 0.15), y - r * (1.1 + s * 0.2), x - r * (1.2 + i * 0.07), y - r * (0.3 + i * 0.12)); c.stroke(); }
}
function face(c, x, y, r, lk, H, hair) {
  c.fillStyle = (() => { const g = c.createRadialGradient(x + r * 0.35, y - r * 0.35, r * 0.1, x, y, r * 1.1); g.addColorStop(0, shade(lk.skin, 1.2)); g.addColorStop(0.55, lk.skin); g.addColorStop(1, shade(lk.skin, 0.6)); return g; })();
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  c.beginPath(); c.moveTo(x + r * 0.88, y - r * 0.22); c.lineTo(x + r * 1.13, y + r * 0.16); c.lineTo(x + r * 0.92, y + r * 0.24); c.closePath(); c.fill();
  c.save(); c.beginPath(); c.arc(x, y, r * 1.02, 0, TAU); c.clip(); c.fillStyle = lk.hair;
  if (hair) { c.beginPath(); c.ellipse(x - r * 0.45, y - r * 0.5, r * 0.95, r * 0.68, -0.2, 0, TAU); c.fill(); }
  if (lk.beard) { c.beginPath(); c.ellipse(x + r * 0.45, y + r * 0.8, r * 0.75, r * 0.42, 0.3, 0, TAU); c.fill(); }
  c.restore();
  c.fillStyle = shade(lk.skin, 0.72); c.beginPath(); c.ellipse(x - r * 0.12, y + r * 0.08, r * 0.15, r * 0.23, 0, 0, TAU); c.fill();
  c.strokeStyle = shade(lk.skin, 0.4); c.lineWidth = lw(H, 0.005); c.lineCap = 'round';
  line(c, x + r * 0.32, y - r * 0.3, x + r * 0.78, y - r * 0.24);
  if (!lk.beard) line(c, x + r * 0.58, y + r * 0.52, x + r * 0.84, y + r * 0.47);
  c.fillStyle = '#1a1410'; c.beginPath(); c.ellipse(x + r * 0.56, y - r * 0.1, r * 0.1, r * 0.08, 0, 0, TAU); c.fill();
  c.strokeStyle = '#2a1c10'; c.lineWidth = lw(H, 0.006); c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
}
function visor(c, x, y, r, M, H, dn) {
  c.save(); c.beginPath(); c.arc(x, y, r * 1.03, 0, TAU); c.clip();
  rrect(c, x + r * 0.08, y - r * 0.28, r * 1.05, r * 1.3, r * 0.22); c.fillStyle = metalGrad(c, x + r, y - r * 0.3, x, y + r, M, dn + 0.4); c.fill();
  c.strokeStyle = M.edge; c.lineWidth = lw(H, 0.005); c.stroke();
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const hx = x + r * (0.3 + i * 0.19), hy = y + r * (-0.05 + j * 0.22);
    c.fillStyle = '#0b0d10'; c.beginPath(); c.arc(hx, hy, r * 0.065, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.arc(hx + r * 0.02, hy + r * 0.05, r * 0.03, 0, TAU); c.fill();
  }
  c.restore();
}
function brim(c, x, y, rx, ry, M, H, dn) {
  c.beginPath(); c.ellipse(x, y, rx, ry, -0.05, 0, TAU); c.fillStyle = metalGrad(c, x + rx, y - ry, x - rx, y + ry, M, dn); c.fill();
  c.strokeStyle = M.edge; c.lineWidth = lw(H, 0.006); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = lw(H, 0.003); c.beginPath(); c.ellipse(x, y - ry * 0.25, rx * 0.92, ry * 0.55, -0.05, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
}
function paintHead(c, p, H, lk) {
  const d = p.d, x = d.x * H, y = d.y * H, r = d.r * H, M = lk.metal, dn = p.dents / TUNING.armour.dents;
  c.fillStyle = skinGrad(c, 0.035 * H, 0, -0.025 * H, 0, shade(lk.skin, 0.85)); c.fillRect(-0.025 * H, -0.745 * H, 0.06 * H, 0.07 * H);
  const helm = p.armour ? lk.helm : null, closed = helm === 'murmillo' || helm === 'hoplo';
  if (!closed) face(c, x, y, r, lk, H, !p.armour);
  if (!p.armour) {
    if (lk.bare === 'leather') {
      c.beginPath(); c.arc(x, y, r * 1.05, Math.PI * 0.92, Math.PI * 2.04); c.closePath();
      const g = c.createLinearGradient(0, y - r, 0, y); g.addColorStop(0, LEATHER.lite); g.addColorStop(1, LEATHER.dark);
      c.fillStyle = g; c.fill(); c.strokeStyle = '#24160a'; c.lineWidth = lw(H, 0.005); c.stroke();
      c.strokeStyle = 'rgba(255,220,170,0.35)'; c.setLineDash([2, 2]); c.beginPath(); c.arc(x, y, r * 0.7, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); c.setLineDash([]);
      plume(c, x, y, r, lk.crest, H, 0.6);
    } else if (lk.bare === 'band') {
      c.save(); c.beginPath(); c.arc(x, y, r * 1.02, 0, TAU); c.clip(); c.fillStyle = lk.band; c.fillRect(x - r * 1.1, y - r * 0.5, r * 2.2, r * 0.2); c.restore();
      c.strokeStyle = lk.band; c.lineWidth = lw(H, 0.008); c.lineCap = 'round';
      line(c, x - r * 0.95, y - r * 0.38, x - r * 1.35, y - r * 0.05); line(c, x - r * 0.95, y - r * 0.38, x - r * 1.45, y - r * 0.3);
    }
    tint(c, p, H);
    return;
  }
  const dome = (i) => { c.beginPath(); c.arc(x, y, r * 1.04 - i, 0, TAU); };
  const cap = (i) => { c.beginPath(); c.arc(x, y, r * 1.06 - i, Math.PI * 0.9, Math.PI * 2.08); c.closePath(); };
  if (closed) {
    if (helm === 'hoplo') {
      c.fillStyle = shade(lk.crest, 0.9); c.strokeStyle = '#2a1c10'; c.lineWidth = lw(H, 0.004);
      c.beginPath(); c.ellipse(x - r * 0.25, y - r * 1.6, r * 0.09, r * 0.62, -0.18, 0, TAU); c.fill(); c.stroke();
    }
    dome(0); c.fillStyle = metalGrad(c, x + r, y - r, x - r, y + r, M, dn); c.fill();
    bevel(c, dome, M, H, y - r, y + r);
    visor(c, x, y, r, M, H, dn);
    if (helm === 'murmillo') {
      brim(c, x, y - r * 0.3, r * 1.55, r * 0.24, M, H, dn);
      // the fish crest: a tall fin, ribbed, painted along its back
      c.beginPath(); c.moveTo(x + r * 0.55, y - r * 0.85); c.quadraticCurveTo(x + r * 0.35, y - r * 2.3, x - r * 0.5, y - r * 2.05);
      c.quadraticCurveTo(x - r * 1.3, y - r * 1.6, x - r * 1.35, y - r * 0.55); c.lineTo(x - r * 0.75, y - r * 0.75); c.quadraticCurveTo(x, y - r * 1.1, x + r * 0.55, y - r * 0.85); c.closePath();
      c.fillStyle = metalGrad(c, x + r, y - r * 2, x - r, y - r * 0.6, M, dn); c.fill(); c.strokeStyle = M.edge; c.lineWidth = lw(H, 0.006); c.stroke();
      c.save(); c.clip(); c.strokeStyle = 'rgba(30,34,40,0.55)'; c.lineWidth = lw(H, 0.003);
      for (let i = 0; i < 6; i++) { const a = -0.3 - i * 0.42; line(c, x - r * 0.1, y - r * 0.95, x - r * 0.1 + Math.cos(a) * r * 1.05, y - r * 1.05 + Math.sin(a) * r * 1.0); }
      c.restore();
      c.strokeStyle = lk.crest; c.lineWidth = lw(H, 0.012); c.beginPath(); c.moveTo(x + r * 0.45, y - r * 1.2); c.quadraticCurveTo(x + r * 0.3, y - r * 2.2, x - r * 0.5, y - r * 1.98); c.quadraticCurveTo(x - r * 1.2, y - r * 1.55, x - r * 1.28, y - r * 0.7); c.stroke();
    } else {
      brim(c, x, y - r * 0.28, r * 1.3, r * 0.16, M, H, dn);
      c.strokeStyle = M.dark; c.lineWidth = lw(H, 0.01); c.beginPath(); c.arc(x, y, r * 1.08, Math.PI * 1.2, Math.PI * 1.8); c.stroke();
      plume(c, x, y - r * 0.12, r * 1.1, lk.crest, H, 1.15);
    }
    for (const a of [2.6, 3.3, 5.9]) rivet(c, x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82 - r * 0.3, H, M);
  } else {
    if (helm !== 'cap') {
      // neck guard flaring at the back, and a cheek guard over the jaw
      c.beginPath(); c.moveTo(x - r * 0.9, y - r * 0.2); c.lineTo(x - r * 1.4, y + r * 0.6); c.lineTo(x - r * 0.55, y + r * 0.45); c.lineTo(x - r * 0.35, y); c.closePath();
      c.fillStyle = metalGrad(c, x, y, x - r * 1.4, y + r * 0.6, M, dn + 0.3); c.fill(); c.strokeStyle = M.edge; c.lineWidth = lw(H, 0.006); c.stroke();
    }
    cap(0); c.fillStyle = metalGrad(c, x + r, y - r, x - r, y, M, dn); c.fill();
    bevel(c, cap, M, H, y - r, y);
    c.strokeStyle = lk.trim; c.lineWidth = lw(H, 0.008); line(c, x - r * 1.0, y - r * 0.12, x + r * 1.02, y - r * 0.12);
    if (helm !== 'cap') {
      rrect(c, x + r * 0.02, y - r * 0.14, r * 0.42, r * 0.86, r * 0.16); c.fillStyle = metalGrad(c, x + r * 0.4, y, x, y + r * 0.7, M, dn); c.fill();
      c.strokeStyle = M.edge; c.lineWidth = lw(H, 0.005); c.stroke();
      rivet(c, x + r * 0.23, y + r * 0.08, H, M); rivet(c, x + r * 0.23, y + r * 0.52, H, M);
    }
    if (helm === 'cap') {
      c.fillStyle = M.dark; c.beginPath(); c.arc(x, y - r * 1.04, r * 0.12, 0, TAU); c.fill();
    } else {
      c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = lw(H, 0.006); c.beginPath(); c.arc(x, y, r * 0.95, Math.PI * 1.25, Math.PI * 1.75); c.stroke();
    }
    for (const a of [3.5, 4.7, 5.9]) rivet(c, x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75 - r * 0.05, H, M);
  }
  wear(c, p, H, x, y - r * 0.3, r, closed ? () => dome(0) : () => cap(0));
}

function cuirass(c, x0, y0, x1, y1) {
  const w = x1 - x0, h = y1 - y0;
  c.beginPath(); c.moveTo(x0 + w * 0.08, y0); c.lineTo(x0 + w * 0.32, y0); c.quadraticCurveTo(x0 + w * 0.5, y0 + h * 0.18, x0 + w * 0.68, y0);
  c.lineTo(x1 - w * 0.08, y0); c.quadraticCurveTo(x1, y0, x1, y0 + h * 0.18); c.lineTo(x1 - w * 0.02, y1 - h * 0.22); c.quadraticCurveTo(x1 - w * 0.04, y1, x1 - w * 0.2, y1);
  c.lineTo(x0 + w * 0.2, y1); c.quadraticCurveTo(x0 + w * 0.04, y1, x0 + w * 0.02, y1 - h * 0.22); c.lineTo(x0, y0 + h * 0.18); c.quadraticCurveTo(x0, y0, x0 + w * 0.08, y0); c.closePath();
}
function pecs(c, x0, y0, w, h) {
  c.beginPath(); c.moveTo(x0 + w * 0.12, y0 + h * 0.48); c.quadraticCurveTo(x0 + w * 0.3, y0 + h * 0.74, x0 + w * 0.48, y0 + h * 0.5); c.stroke();
  c.beginPath(); c.moveTo(x0 + w * 0.54, y0 + h * 0.5); c.quadraticCurveTo(x0 + w * 0.74, y0 + h * 0.76, x0 + w * 0.92, y0 + h * 0.46); c.stroke();
  line(c, x0 + w * 0.51, y0 + h * 0.2, x0 + w * 0.51, y0 + h * 0.92);
}
function paintChest(c, p, H, lk) {
  const d = p.d, w = d.w * H, h = d.h * H, x0 = d.x * H - w / 2, y0 = d.y * H - h / 2, x1 = x0 + w, y1 = y0 + h, M = lk.metal;
  if (!p.armour) {
    path(c, d, H); c.fillStyle = skinGrad(c, x1, y0, x0, y1, lk.skin); c.fill();
    c.lineCap = 'round'; c.lineWidth = lw(H, 0.005); c.strokeStyle = shade(lk.skin, 0.55); pecs(c, x0, y0, w, h);
    c.strokeStyle = 'rgba(255,240,220,0.3)'; c.lineWidth = lw(H, 0.004); line(c, x0 + w * 0.58, y0 + h * 0.28, x0 + w * 0.86, y0 + h * 0.24);
    path(c, d, H); c.strokeStyle = '#3a2414'; c.lineWidth = lw(H, 0.007); c.stroke();
    strap(c, -0.09 * H, -0.69 * H, 0.09 * H, -0.53 * H, 0.022 * H, H, true);
    tint(c, p, H);
    return;
  }
  const dn = p.dents / TUNING.armour.dents, shape = (i) => cuirass(c, x0 + i, y0 + i, x1 - i, y1 - i);
  shape(0); c.fillStyle = metalGrad(c, x1, y0, x0, y1, M, dn); c.fill();
  c.save(); shape(0); c.clip();
  const g = c.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, 'rgba(0,0,0,0.38)'); g.addColorStop(0.45, 'rgba(0,0,0,0)'); g.addColorStop(0.72, 'rgba(255,255,255,0.3)'); g.addColorStop(0.86, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.22)');
  c.fillStyle = g; c.fillRect(x0, y0, w, h);
  c.lineCap = 'round'; c.lineWidth = lw(H, 0.005);
  c.strokeStyle = 'rgba(255,255,255,0.5)'; c.save(); c.translate(0, -1); pecs(c, x0, y0, w, h); c.restore();
  c.strokeStyle = 'rgba(16,20,26,0.55)'; pecs(c, x0, y0, w, h);
  c.restore();
  bevel(c, shape, M, H, y0, y1);
  c.strokeStyle = lk.trim; c.lineWidth = lw(H, 0.005); line(c, x0 + w * 0.2, y1 - 0.017 * H, x1 - w * 0.2, y1 - 0.017 * H);
  for (const k of [0.12, 0.88]) rivet(c, x0 + w * k, y0 + h * 0.2, H, M);
  for (const k of [0.25, 0.5, 0.75]) rivet(c, x0 + w * k, y1 - h * 0.12, H, M);
  for (const k of [0.2, 0.8]) strap(c, x0 + w * k, y0 - 0.035 * H, x0 + w * k, y0 + h * 0.14, 0.02 * H, H, true);
  wear(c, p, H, (x0 + x1) / 2, (y0 + y1) / 2, Math.min(w, h) / 2, () => shape(0));
}

// the tunic or loincloth, with folds and a hem, under the belly
function paintWrap(c, H, lk) {
  const top = -0.43 * H, loin = lk.wrap === 'loin';
  c.beginPath(); c.moveTo(-0.11 * H, top); c.lineTo(0.11 * H, top);
  if (loin) { c.lineTo(0.13 * H, -0.345 * H); c.lineTo(0.075 * H, -0.335 * H); c.lineTo(0.03 * H, -0.26 * H); c.lineTo(-0.015 * H, -0.335 * H); c.lineTo(-0.13 * H, -0.345 * H); }
  else { c.lineTo(0.15 * H, -0.27 * H); c.quadraticCurveTo(0, -0.255 * H, -0.14 * H, -0.27 * H); }
  c.closePath();
  const g = c.createLinearGradient(0.12 * H, top, -0.12 * H, -0.27 * H); g.addColorStop(0, shade(lk.tunic, 1.12)); g.addColorStop(0.5, lk.tunic); g.addColorStop(1, shade(lk.tunic, 0.62));
  c.fillStyle = g; c.fill(); c.strokeStyle = lk.hem; c.lineWidth = lw(H, 0.006); c.lineJoin = 'round'; c.stroke();
  c.save(); c.clip(); c.lineCap = 'round';
  for (const k of [-0.075, -0.03, 0.025, 0.075]) {
    const bx = loin ? k * 0.6 + 0.02 : k * 1.2;
    c.strokeStyle = shade(lk.tunic, 0.58); c.lineWidth = lw(H, 0.006); c.beginPath(); c.moveTo(k * H, top + 0.02 * H); c.quadraticCurveTo((k + 0.01) * H, -0.36 * H, bx * H, -0.26 * H); c.stroke();
    c.strokeStyle = 'rgba(255,240,220,0.18)'; c.lineWidth = lw(H, 0.004); c.beginPath(); c.moveTo((k + 0.012) * H, top + 0.02 * H); c.quadraticCurveTo((k + 0.022) * H, -0.36 * H, (bx + 0.012) * H, -0.26 * H); c.stroke();
  }
  c.strokeStyle = lk.hem; c.lineWidth = lw(H, 0.014); c.stroke();
  c.restore();
}
function belt(c, H) {
  const x0 = -0.108 * H, y0 = -0.507 * H, w = 0.216 * H, h = 0.036 * H;
  const g = c.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, LEATHER.lite); g.addColorStop(1, LEATHER.dark);
  rrect(c, x0, y0, w, h, h * 0.2); c.fillStyle = g; c.fill(); c.strokeStyle = '#24160a'; c.lineWidth = lw(H, 0.004); c.stroke();
  for (let i = 0; i < 6; i++) if (i !== 3) rivet(c, x0 + w * (0.08 + i * 0.17), y0 + h / 2, H, BRONZE);
  const bg = c.createLinearGradient(0, y0, 0, y0 + h * 1.2); bg.addColorStop(0, '#f2d88a'); bg.addColorStop(1, '#8a6a20');
  c.fillStyle = bg; c.fillRect(0, y0 - h * 0.1, 0.04 * H, h * 1.2); c.strokeStyle = '#4a3410'; c.lineWidth = lw(H, 0.004); c.strokeRect(0.008 * H, y0 + h * 0.15, 0.024 * H, h * 0.7);
}
function paintBelly(c, p, H, lk) {
  paintWrap(c, H, lk);
  const d = p.d, w = d.w * H, h = d.h * H, x0 = d.x * H - w / 2, y0 = d.y * H - h / 2, M = lk.metal;
  if (!p.armour) {
    path(c, d, H); c.fillStyle = skinGrad(c, x0 + w, y0, x0, y0 + h, lk.skin); c.fill();
    c.strokeStyle = shade(lk.skin, 0.58); c.lineWidth = lw(H, 0.004); c.lineCap = 'round';
    line(c, x0 + w * 0.52, y0 + h * 0.3, x0 + w * 0.52, y0 + h * 0.9);
    for (const k of [0.45, 0.68]) { line(c, x0 + w * 0.3, y0 + h * k, x0 + w * 0.47, y0 + h * (k + 0.03)); line(c, x0 + w * 0.57, y0 + h * (k + 0.03), x0 + w * 0.76, y0 + h * k); }
    c.fillStyle = shade(lk.skin, 0.5); c.beginPath(); c.arc(x0 + w * 0.53, y0 + h * 0.84, lw(H, 0.004), 0, TAU); c.fill();
    path(c, d, H); c.strokeStyle = '#3a2414'; c.lineWidth = lw(H, 0.006); c.stroke();
    tint(c, p, H);
  } else {
    // banded lames, the upper overlapping the lower
    const dn = p.dents / TUNING.armour.dents, n = 3, bh = h / n;
    for (let i = n - 1; i >= 0; i--) {
      const by = y0 + i * bh, hh = i === n - 1 ? bh : bh * 1.2;
      rrect(c, x0, by, w, hh, hh * 0.3); c.fillStyle = metalGrad(c, x0 + w, by, x0, by + hh, M, dn); c.fill();
      c.strokeStyle = M.edge; c.lineWidth = lw(H, 0.006); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = lw(H, 0.003); line(c, x0 + hh * 0.3, by + 1.5, x0 + w - hh * 0.3, by + 1.5);
      rivet(c, x0 + w * 0.1, by + hh * 0.5, H, M); rivet(c, x0 + w * 0.9, by + hh * 0.5, H, M);
    }
    wear(c, p, H, x0 + w / 2, y0 + h / 2, Math.min(w, h) / 2, () => rrect(c, x0, y0, w, h, 2));
  }
  belt(c, H);
}

function paintArm(c, p, H, lk) {
  const d = p.d, w = d.w * H, h = d.h * H, x0 = -w / 2, y0 = d.y * H - h / 2, M = lk.metal, front = d.id === 'armF', sk = front ? lk.skin : shade(lk.skin, 0.86);
  if (!p.armour) {
    rrect(c, x0, y0, w, h, w * 0.45); c.fillStyle = skinGrad(c, w / 2, 0, -w / 2, 0, sk); c.fill();
    c.strokeStyle = shade(lk.skin, 0.55); c.lineWidth = lw(H, 0.004); c.lineCap = 'round';
    c.beginPath(); c.moveTo(x0 + w * 0.72, y0 + h * 0.1); c.quadraticCurveTo(x0 + w * 1.0, y0 + h * 0.28, x0 + w * 0.7, y0 + h * 0.44); c.stroke();
    c.beginPath(); c.moveTo(x0 + w * 0.3, y0 + h * 0.58); c.quadraticCurveTo(x0 + w * 0.15, y0 + h * 0.7, x0 + w * 0.35, y0 + h * 0.84); c.stroke();
    line(c, x0 + w * 0.35, y0 + h * 0.5, x0 + w * 0.65, y0 + h * 0.52);
    rrect(c, x0, y0, w, h, w * 0.45); c.strokeStyle = '#3a2414'; c.lineWidth = lw(H, 0.006); c.stroke();
    c.fillStyle = LEATHER.mid; c.fillRect(x0 - 1, y0 + h * 0.82, w + 2, h * 0.09); c.strokeStyle = LEATHER.dark; c.lineWidth = 1; c.strokeRect(x0 - 1, y0 + h * 0.82, w + 2, h * 0.09);
  } else {
    // the manica: overlapping bands down the arm, a strap along the back
    const dn = p.dents / TUNING.armour.dents, n = 6, bh = h / n;
    for (let i = n - 1; i >= 0; i--) {
      const by = y0 + i * bh, hh = i === n - 1 ? bh : bh * 1.3;
      rrect(c, x0 - w * 0.06, by, w * 1.12, hh, hh * 0.35); c.fillStyle = metalGrad(c, w / 2, by, -w / 2, by + hh, M, dn); c.fill();
      c.strokeStyle = M.edge; c.lineWidth = lw(H, 0.005); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = lw(H, 0.003); line(c, x0, by + 1.4, x0 + w, by + 1.4);
    }
    strap(c, x0 + w * 0.22, y0, x0 + w * 0.22, y0 + h, w * 0.16, H, false);
    for (let i = 0; i < n; i++) rivet(c, x0 + w * 0.22, y0 + (i + 0.5) * bh, H, M);
    wear(c, p, H, 0, d.y * H, w / 2, () => rrect(c, x0 - w * 0.06, y0, w * 1.12, h, 3));
  }
  const fy = ARM_LEN * H, fr = 0.042 * H, fg = c.createRadialGradient(fr * 0.3, fy - fr * 0.3, fr * 0.1, 0, fy, fr);
  fg.addColorStop(0, shade(sk, 1.15)); fg.addColorStop(1, shade(sk, 0.7));
  c.fillStyle = fg; c.beginPath(); c.arc(0, fy, fr, 0, TAU); c.fill(); c.strokeStyle = '#2a1c10'; c.lineWidth = lw(H, 0.006); c.stroke();
  c.strokeStyle = shade(lk.skin, 0.5); c.lineWidth = lw(H, 0.003); for (const k of [-0.4, 0, 0.4]) line(c, fr * k, fy + fr * 0.2, fr * k, fy + fr * 0.75);
  if (!p.armour) tint(c, p, H);
  if (front && lk.pauldron) {
    // a heavy layered pauldron: iron on a plated arm, studded leather on a bare one
    const P = p.armour ? M : null;
    for (let i = 2; i >= 0; i--) {
      const py = -0.01 * H + i * 0.032 * H;
      c.beginPath(); c.ellipse(0, py, w * 0.9, 0.04 * H, 0, Math.PI, TAU); c.closePath();
      c.fillStyle = P ? metalGrad(c, w, py - 0.04 * H, -w, py, P) : (i % 2 ? LEATHER.mid : LEATHER.lite); c.fill();
      c.strokeStyle = P ? P.edge : LEATHER.dark; c.lineWidth = lw(H, 0.005); c.stroke();
      for (const k of [-0.5, 0, 0.5]) rivet(c, w * 0.9 * k, py - 0.012 * H, H, P || IRON);
    }
  }
  if (!front && lk.galerus) {
    // the galerus: a flared shoulder guard rising beside the head
    const g = (i) => { c.beginPath(); c.moveTo(-w * 0.2 + i, 0.04 * H - i); c.lineTo(-w * 1.0 + i, -0.02 * H); c.quadraticCurveTo(-w * 1.25 + i, -0.12 * H + i, -w * 0.9 + i, -0.16 * H + i); c.lineTo(w * 0.35 - i, -0.11 * H + i); c.lineTo(w * 0.6 - i, 0.03 * H - i); c.closePath(); };
    g(0); c.fillStyle = metalGrad(c, w, -0.16 * H, -w, 0.04 * H, BRONZE); c.fill();
    bevel(c, g, BRONZE, H, -0.16 * H, 0.04 * H);
    c.strokeStyle = 'rgba(94,62,21,0.6)'; c.lineWidth = lw(H, 0.004); line(c, -w * 0.5, -0.12 * H, -w * 0.3, 0.02 * H);
  }
}

// a leg as a tapered quad from a to b (widths in px), for plates and their clip
function quad(c, a, b, wa, wb) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  c.moveTo(a[0] + nx * wa / 2, a[1] + ny * wa / 2); c.lineTo(b[0] + nx * wb / 2, b[1] + ny * wb / 2); c.lineTo(b[0] - nx * wb / 2, b[1] - ny * wb / 2); c.lineTo(a[0] - nx * wa / 2, a[1] - ny * wa / 2); c.closePath();
  return [nx, ny];
}
function paintLegs(c, p, H, lk) {
  const M = lk.metal, dn = p.dents / TUNING.armour.dents, TH = 0.085 * H, SH = 0.068 * H;
  const legs = LEGS.map((L) => L.map((q) => [q[0] * H, q[1] * H]));
  legs.forEach(([hip, knee, ank], i) => {
    const sk = i ? lk.skin : shade(lk.skin, 0.8);
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = '#2a1c10'; c.lineWidth = TH + 2.5; line(c, hip[0], hip[1], knee[0], knee[1]); c.lineWidth = SH + 2.5; line(c, knee[0], knee[1], ank[0], ank[1]);
    c.strokeStyle = sk; c.lineWidth = TH; line(c, hip[0], hip[1], knee[0], knee[1]); c.lineWidth = SH; line(c, knee[0], knee[1], ank[0], ank[1]);
    c.strokeStyle = 'rgba(255,236,214,0.22)'; c.lineWidth = SH * 0.3;
    line(c, hip[0] + 0.016 * H, hip[1], knee[0] + 0.016 * H, knee[1]); line(c, knee[0] + 0.014 * H, knee[1], ank[0] + 0.012 * H, ank[1]);
    c.strokeStyle = 'rgba(0,0,0,0.2)'; c.lineWidth = SH * 0.28;
    line(c, hip[0] - 0.024 * H, hip[1], knee[0] - 0.022 * H, knee[1]); line(c, knee[0] - 0.02 * H, knee[1], ank[0] - 0.018 * H, ank[1]);
    c.strokeStyle = shade(lk.skin, 0.5); c.lineWidth = lw(H, 0.004);
    c.beginPath(); c.moveTo(knee[0] - 0.02 * H, knee[1] + 0.03 * H); c.quadraticCurveTo(knee[0] - 0.04 * H, knee[1] + 0.07 * H, knee[0] - 0.03 * H, knee[1] + 0.11 * H); c.stroke();
    // sandal: sole and laces up the ankle
    rrect(c, ank[0] - 0.03 * H, -0.035 * H, 0.09 * H, 0.035 * H, 0.014 * H); c.fillStyle = sk; c.fill(); c.strokeStyle = '#2a1c10'; c.lineWidth = lw(H, 0.005); c.stroke();
    c.fillStyle = LEATHER.dark; c.fillRect(ank[0] - 0.03 * H, -0.01 * H, 0.09 * H, 0.01 * H);
    c.strokeStyle = LEATHER.mid; c.lineWidth = lw(H, 0.006);
    for (let k = 0; k < 3; k++) { const yy = ank[1] - 0.012 * H - k * 0.02 * H; line(c, ank[0] - SH * 0.45, yy, ank[0] + SH * 0.45, yy - 0.012 * H); }
    if (!p.armour) return;
    // thigh plates and a greave with a knee boss
    const thigh = () => { c.beginPath(); return quad(c, hip, knee, TH * 1.06, TH * 0.96); };
    const greave = () => { c.beginPath(); return quad(c, [knee[0] + (ank[0] - knee[0]) * 0.05, knee[1] + (ank[1] - knee[1]) * 0.05], [ank[0] + (knee[0] - ank[0]) * 0.1, ank[1] + (knee[1] - ank[1]) * 0.1], SH * 1.35, SH * 1.1); };
    for (const [seg, a, b, ww] of [[thigh, hip, knee, TH], [greave, knee, ank, SH * 1.3]]) {
      const [nx, ny] = seg();
      c.fillStyle = metalGrad(c, a[0] + nx * ww / 2, a[1] + ny * ww / 2, a[0] - nx * ww / 2, a[1] - ny * ww / 2, M, dn + (i ? 0 : 0.35)); c.fill();
      c.strokeStyle = M.edge; c.lineWidth = lw(H, 0.006); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = lw(H, 0.004); line(c, a[0] + nx * ww * 0.2, a[1] + ny * ww * 0.2, b[0] + nx * ww * 0.2, b[1] + ny * ww * 0.2);
    }
    c.strokeStyle = M.edge; c.lineWidth = lw(H, 0.004);
    for (const t of [0.35, 0.68]) { const x = hip[0] + (knee[0] - hip[0]) * t, y = hip[1] + (knee[1] - hip[1]) * t; line(c, x - TH * 0.5, y, x + TH * 0.5, y + 0.004 * H); }
    for (const t of [0.35, 0.75]) { const x = knee[0] + (ank[0] - knee[0]) * t, y = knee[1] + (ank[1] - knee[1]) * t; strap(c, x - SH * 0.7, y, x + SH * 0.7, y + 0.006 * H, 0.012 * H, H, false); }
    const kg = c.createRadialGradient(knee[0] + 0.01 * H, knee[1] - 0.012 * H, 0, knee[0], knee[1], 0.04 * H);
    kg.addColorStop(0, M.hi); kg.addColorStop(0.5, M.mid); kg.addColorStop(1, M.dark);
    c.fillStyle = kg; c.beginPath(); c.arc(knee[0], knee[1], 0.038 * H, 0, TAU); c.fill(); c.strokeStyle = M.edge; c.lineWidth = lw(H, 0.006); c.stroke();
    rivet(c, knee[0], knee[1], H, M);
  });
  if (p.armour) wear(c, p, H, 0.06 * H, -0.24 * H, 0.08 * H, () => { c.beginPath(); for (const [hip, knee, ank] of legs) { quad(c, hip, knee, TH, TH); quad(c, knee, ank, SH * 1.3, SH * 1.1); } });
  else tint(c, p, H);
}

// A joint slot is where two plates don't meet: their edges frame it, padding or skin shows inside in shadow, with a warm rim.
function paintSlot(c, p, H, lk) {
  const d = p.d, w = d.w * H, h = d.h * H, x0 = d.x * H - w / 2, y0 = d.y * H - h / 2, [under, lips] = SLOT_ART[d.id], M = lk.metal, tb = lips === 'tb';
  c.fillStyle = under === 'skin' ? shade(lk.skin, 0.85) : LINEN.mid; c.fillRect(x0, y0, w, h);
  c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.clip();
  if (under === 'linen') {
    c.strokeStyle = LINEN.dark; c.lineWidth = Math.max(0.7, 0.003 * H);
    const st = Math.max(3, 0.014 * H);
    if (tb) for (let x = x0 + st / 2; x < x0 + w; x += st) line(c, x, y0, x, y0 + h); else for (let y = y0 + st / 2; y < y0 + h; y += st) line(c, x0, y, x0 + w, y);
  }
  const sw = Math.min(w, h) * 0.45;
  if (tb) strap(c, x0 + w * 0.3, y0 - 2, x0 + w * 0.55, y0 + h + 2, sw, H, false); else strap(c, x0 - 2, y0 + h * 0.3, x0 + w + 2, y0 + h * 0.62, sw, H, false);
  const g = tb ? c.createLinearGradient(0, y0, 0, y0 + h) : c.createLinearGradient(x0, 0, x0 + w, 0);
  g.addColorStop(0, 'rgba(6,3,2,0.95)'); g.addColorStop(0.5, 'rgba(6,3,2,0.5)'); g.addColorStop(1, 'rgba(6,3,2,0.95)');
  c.fillStyle = g; c.fillRect(x0, y0, w, h);
  const e = tb ? c.createLinearGradient(x0, 0, x0 + w, 0) : c.createLinearGradient(0, y0, 0, y0 + h);
  e.addColorStop(0, 'rgba(6,3,2,0.8)'); e.addColorStop(0.25, 'rgba(6,3,2,0)'); e.addColorStop(0.75, 'rgba(6,3,2,0)'); e.addColorStop(1, 'rgba(6,3,2,0.8)');
  c.fillStyle = e; c.fillRect(x0, y0, w, h);
  c.restore();
  const t = Math.max(2.5, 0.016 * H);
  const lip = (x, y, lw2, lh) => { rrect(c, x, y, lw2, lh, Math.min(lw2, lh) * 0.4); c.fillStyle = metalGrad(c, x + lw2, y, x, y + lh, M); c.fill(); c.strokeStyle = M.edge; c.lineWidth = Math.max(1, 0.005 * H); c.stroke(); };
  if (tb) { lip(x0 - t * 0.5, y0 - t + 1, w + t, t); lip(x0 - t * 0.5, y0 + h - 1, w + t, t); }
  else { lip(x0 - t + 1, y0 - t * 0.5, t, h + t); lip(x0 + w - 1, y0 - t * 0.5, t, h + t); }
  c.strokeStyle = 'rgba(255,170,90,0.9)'; c.lineWidth = Math.max(1, 0.005 * H);
  if (tb) { line(c, x0 + 1, y0 + 1.6, x0 + w - 1, y0 + 1.6); line(c, x0 + 1, y0 + h - 1.6, x0 + w - 1, y0 + h - 1.6); }
  else { line(c, x0 + 1.6, y0 + 1, x0 + 1.6, y0 + h - 1); line(c, x0 + w - 1.6, y0 + 1, x0 + w - 1.6, y0 + h - 1); }
  c.strokeStyle = 'rgba(255,170,90,0.35)'; c.lineWidth = 1; c.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);
}

const PAINT = { head: paintHead, chest: paintChest, belly: paintBelly, armF: paintArm, armB: paintArm, legs: paintLegs };
function paintPart(c, p, H, lk) { (p.slot ? paintSlot : PAINT[p.d.id])(c, p, H, lk); }
// The part's sprite, repainted only when its look, scale, dents, cracks or damage change. Null without OffscreenCanvas (painted live).
function spriteOf(E, p, H, lk) {
  if (!canSprite) return null;
  const k = Math.min(E.dpr || 1, TUNING.skin.maxDpr), d = p.d;
  const key = `${Math.round(H * k)}|${lk.id}|${p.armour ? 1 : 0}|${p.dents}|${p.cracks.length}|${p.cut ? 1 : 0}|${Math.ceil(p.hp / TUNING.part.hp * 4)}`;
  if (p.spr && p.spr.key === key) return p.spr;
  const m = 0.03, b = p.slot ? [d.x - d.w / 2 - m, d.y - d.h / 2 - m, d.x + d.w / 2 + m, d.y + d.h / 2 + m] : BOX[d.id];
  const x = b[0] * H, y = b[1] * H, cw = Math.ceil((b[2] - b[0]) * H * k), ch = Math.ceil((b[3] - b[1]) * H * k);
  const cv = new OffscreenCanvas(cw, ch), c = cv.getContext('2d');
  c.scale(k, k); c.translate(-x, -y); paintPart(c, p, H, lk);
  p.spr = { key, cv, x, y, w: cw / k, h: ch / k };
  return p.spr;
}
// small red cut lines on bare hits, fading over a few seconds
function cuts(ctx, p, H) {
  if (!p.gashes.length) return;
  const T = TUNING.skin.cutFade;
  p.gashes = p.gashes.filter((g) => state.m - g.t < T);
  ctx.lineCap = 'round';
  for (const g of p.gashes) {
    const k = 1 - (state.m - g.t) / T;
    ctx.strokeStyle = `rgba(110,14,10,${0.55 * k})`; ctx.lineWidth = Math.max(2, 0.011 * H); line(ctx, g.a[0] * H, g.a[1] * H, g.b[0] * H, g.b[1] * H);
    ctx.strokeStyle = `rgba(232,62,46,${k})`; ctx.lineWidth = Math.max(1, 0.005 * H); line(ctx, g.a[0] * H, g.a[1] * H, g.b[0] * H, g.b[1] * H);
  }
}
// A part in its frame: the sprite, its cuts, a shake and a bright wash while a plate clangs, a flash when hit.
function drawPart(ctx, E, p, H, lk, fr) {
  ctx.save();
  if (fr) { ctx.translate(fr.ox * H, fr.oy * H); ctx.rotate(fr.rot); }
  const sh = p.armour && p.clang > 0 ? p.clang / 0.25 : 0;
  if (sh > 0) ctx.translate((Math.random() - 0.5) * 7 * sh, (Math.random() - 0.5) * 7 * sh);
  const s = spriteOf(E, p, H, lk);
  // sprites are painted at the screen's pixel ratio, so an unsmoothed blit stays crisp and costs far less than a smoothed one
  ctx.imageSmoothingEnabled = false;
  if (s) ctx.drawImage(s.cv, s.x, s.y, s.w, s.h); else paintPart(ctx, p, H, lk);
  cuts(ctx, p, H);
  const glow = Math.max(sh * 0.5, p.flash / 0.16 * 0.6);
  if (s && glow > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= glow; ctx.drawImage(s.cv, s.x, s.y, s.w, s.h); }
  ctx.restore();
}

// The joint slots riding on their limbs: all the sprites first, then the live light over them (the open window's gold, or a glint when your tip is near).
function drawSlots(ctx, E, F, H, fm, lk) {
  const slots = fm.parts.filter((q) => q.slot);
  for (const p of slots) drawPart(ctx, E, p, H, lk, p.d.frame ? fm.fr[p.d.frame] : null);
  for (const p of slots) slotLight(ctx, F, p, H, fm);
}
function slotLight(ctx, F, p, H, fm) {
  const d = p.d, fr = d.frame ? fm.fr[d.frame] : null;
  ctx.save();
  if (fr) { ctx.translate(fr.ox * H, fr.oy * H); ctx.rotate(fr.rot); }
  path(ctx, d, H);
  if (state.winded > 0 && fm === state.foe && p.flash <= 0) {
    const k = 0.6 + 0.4 * Math.sin(state.m * 12);
    ctx.shadowColor = '#ffd24a'; ctx.shadowBlur = 16; ctx.strokeStyle = `rgba(255,210,74,${k})`; ctx.lineWidth = 3.5; ctx.stroke();
  } else {
    const h = state.hand, [sx, sy] = partCenter(F, fm, p), R = TUNING.skin.glint * H, dist = Math.hypot(h.ux - sx, h.uy - sy);
    if (dist < R) {
      const k = Math.min(1, (1 - dist / R) * 1.6) * (0.8 + 0.2 * Math.sin(state.m * 10)), gx = (d.x + d.w * 0.25) * H, gy = (d.y - d.h / 2) * H, s = 4 + 8 * k;
      ctx.shadowColor = '#ffb347'; ctx.shadowBlur = 10 * k;
      ctx.strokeStyle = `rgba(255,200,120,${0.9 * k})`; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = `rgba(255,244,200,${k})`; ctx.beginPath(); ctx.moveTo(gx, gy - s);
      ctx.quadraticCurveTo(gx, gy, gx + s, gy); ctx.quadraticCurveTo(gx, gy, gx, gy + s); ctx.quadraticCurveTo(gx, gy, gx - s, gy); ctx.quadraticCurveTo(gx, gy, gx, gy - s); ctx.fill();
    }
  }
  ctx.restore();
}

function foeHealth(ctx, E) {
  const F = foeF(E), L = lay(E), f = state.foe, w = 0.46 * L.H, h = 10, x = F.x - w / 2, y = Math.max(E.safe.top + 26, L.floor - 1.16 * L.H);
  const k = clamp(f.hp / f.maxHp, 0, 1), ks = clamp(f.shown / f.maxHp, 0, 1), sk = clamp(f.sta / f.staMax, 0, 1);
  E.text(`${f.name.toUpperCase()}  ${f.size.id} \u00b7 ${f.wname}`, F.x, y - 11, { size: 12, color: f.champion ? '#ffd24a' : '#f0e6cc', weight: '800' });
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - 2, y - 2, w + 4, h + 11);
  ctx.fillStyle = '#f2d88a'; ctx.fillRect(x, y, w * ks, h);
  ctx.fillStyle = k < 0.3 ? '#ef4444' : '#d9483a'; ctx.fillRect(x, y, w * k, h);
  const wd = state.winded > 0, on = Math.floor(state.m * 8) % 2 === 0;
  ctx.fillStyle = wd ? (on ? '#ffd24a' : '#7c5a10') : sk < 0.25 ? '#f59e0b' : '#7dd3fc';
  ctx.fillRect(x, y + h + 2, wd ? w * clamp(1 - state.winded / state.windedMax, 0.04, 1) : w * sk, 5);
}

function limb(ctx, pts, w, col) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = w + 3; ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,236,214,0.22)'; ctx.lineWidth = w * 0.3; ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1] - w * 0.2) : ctx.moveTo(q[0], q[1] - w * 0.2))); ctx.stroke();
}

// Something held in the off hand (far arm), drawn in that arm's frame at the fist.
function offHand(ctx, fr, H, fn) { ctx.save(); ctx.translate(fr.ox * H, fr.oy * H); ctx.rotate(fr.rot); ctx.translate(0, 0.3 * H); fn(); ctx.restore(); }
function drawScutum(ctx, H, k) {
  const w = 0.17 * H * k, h = 0.32 * H * k, g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, '#5a1814'); g.addColorStop(0.5, '#a8352c'); g.addColorStop(1, '#621b16');
  rrect(ctx, -w / 2, -h / 2, w, h, 0.04 * H * k); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#e6c866'; ctx.lineWidth = 3; ctx.stroke();
  ctx.strokeStyle = 'rgba(230,200,102,0.7)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -h / 2 + 6); ctx.lineTo(0, h / 2 - 6); ctx.stroke();
  for (const sy of [-1, 1]) for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, sy * h * 0.1); ctx.quadraticCurveTo(sx * w * 0.32, sy * h * 0.16, sx * w * 0.34, sy * h * 0.38); ctx.stroke(); }
  const bg = ctx.createRadialGradient(-0.01 * H * k, -0.01 * H * k, 0, 0, 0, 0.035 * H * k);
  bg.addColorStop(0, '#fbe7a6'); bg.addColorStop(1, '#8a6a20');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, 0, 0.035 * H * k, 0, 6.28); ctx.fill(); ctx.strokeStyle = '#4a3410'; ctx.lineWidth = 1.5; ctx.stroke();
}
// the hoplomachus's small round bronze parma
function drawParma(ctx, H, k) {
  const r = 0.1 * H * k, g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#f0cf86'); g.addColorStop(0.6, '#b07a34'); g.addColorStop(1, '#5e3e15');
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.28); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#2b1b08'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,231,176,0.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, r * 0.78, 0, 6.28); ctx.stroke();
  ctx.fillStyle = '#e6c866'; ctx.beginPath(); ctx.arc(0, 0, r * 0.24, 0, 6.28); ctx.fill(); ctx.strokeStyle = '#4a3410'; ctx.stroke();
}
const drawFoeShield = (ctx, H, k, lk) => (lk.id === 'hoplomachus' ? drawParma : drawScutum)(ctx, H, k);
// the retiarius's net, bundled and hanging from the belt at the back hip
function drawBeltNet(ctx, H) {
  const x = -0.12 * H, y = -0.49 * H, w = 0.07 * H, h = 0.19 * H;
  ctx.save(); ctx.beginPath(); ctx.moveTo(x - w * 0.2, y); ctx.quadraticCurveTo(x - w * 0.9, y + h * 0.6, x - w * 0.3, y + h);
  ctx.quadraticCurveTo(x + w * 0.3, y + h * 1.05, x + w * 0.6, y + h * 0.8); ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.3, x + w * 0.3, y); ctx.closePath();
  ctx.fillStyle = 'rgba(200,190,160,0.35)'; ctx.fill(); ctx.strokeStyle = '#6b5a3a'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.clip();
  ctx.strokeStyle = 'rgba(230,220,190,0.8)'; ctx.lineWidth = 1;
  for (let i = -3; i <= 3; i++) { line(ctx, x + i * w * 0.35 - w, y, x + i * w * 0.35 + w, y + h); line(ctx, x + i * w * 0.35 + w, y, x + i * w * 0.35 - w, y + h); }
  ctx.restore();
  ctx.fillStyle = '#4b5059'; for (const k of [-0.3, 0.1, 0.5]) { ctx.beginPath(); ctx.arc(x + w * k, y + h * (0.95 + k * 0.05), 2.2, 0, 6.28); ctx.fill(); }
}
function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function drawNet(ctx, x, y, r) {
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, 6.28); ctx.fillStyle = 'rgba(200,190,160,0.25)'; ctx.fill(); ctx.clip();
  ctx.strokeStyle = 'rgba(230,220,190,0.85)'; ctx.lineWidth = 1.2;
  for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(x - r + i * r / 2, y - r); ctx.lineTo(x + r + i * r / 2, y + r); ctx.moveTo(x + r - i * r / 2, y - r); ctx.lineTo(x - r - i * r / 2, y + r); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = '#6b5a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.28); ctx.stroke();
}
// The foe's weapon in his arm's frame: the fist at (0, ARM_LEN), the weapon along +y; frame -x is the edge that leads a chop.
function drawWeapon(ctx, f, H) {
  const W = f.weapon, y0 = ARM_LEN * H, len = W.len * H;
  ctx.strokeStyle = '#1b1610'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
  const leaf = (y1, y2, w) => { ctx.beginPath(); ctx.moveTo(-w * 0.8, y1); ctx.lineTo(-w, y1 + (y2 - y1) * 0.3); ctx.lineTo(-w * 0.6, y1 + (y2 - y1) * 0.75); ctx.lineTo(0, y2); ctx.lineTo(w * 0.6, y1 + (y2 - y1) * 0.75); ctx.lineTo(w, y1 + (y2 - y1) * 0.3); ctx.lineTo(w * 0.8, y1); ctx.closePath(); ctx.fillStyle = '#d5dce4'; ctx.fill(); ctx.stroke(); };
  const pole = (a, b, w) => { ctx.fillStyle = '#7a5532'; ctx.fillRect(-w / 2, a, w, b - a); ctx.strokeRect(-w / 2, a, w, b - a); };
  if (W.id === 'spear') { pole(y0 - 0.3 * H, y0 + len, 0.02 * H); leaf(y0 + len, y0 + len + 0.12 * H, 0.026 * H); }
  else if (W.id === 'axe') {
    pole(y0 - 0.05 * H, y0 + len, 0.026 * H);
    if (f.mace) {
      ctx.fillStyle = '#4b5059'; ctx.beginPath(); ctx.arc(0, y0 + len, 0.06 * H, 0, 6.28); ctx.fill(); ctx.stroke();
      for (let i = 0; i < 8; i++) { const a = i * 0.785; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 0.05 * H, y0 + len + Math.sin(a) * 0.05 * H); ctx.lineTo(Math.cos(a) * 0.085 * H, y0 + len + Math.sin(a) * 0.085 * H); ctx.stroke(); }
    } else {
      const hy = y0 + len - 0.05 * H;
      ctx.fillStyle = '#b7c0ca'; ctx.beginPath(); ctx.moveTo(-0.01 * H, hy - 0.04 * H); ctx.lineTo(-0.12 * H, hy - 0.09 * H); ctx.quadraticCurveTo(-0.15 * H, hy + 0.02 * H, -0.12 * H, hy + 0.11 * H); ctx.lineTo(-0.01 * H, hy + 0.06 * H); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  } else {
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(-0.012 * H, y0 - 0.05 * H, 0.024 * H, 0.08 * H);
    ctx.strokeStyle = '#c9a43a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-0.04 * H, y0 + 0.035 * H); ctx.lineTo(0.04 * H, y0 + 0.035 * H); ctx.stroke();
    ctx.strokeStyle = '#1b1610'; ctx.lineWidth = 2;
    leaf(y0 + 0.04 * H, y0 + 0.04 * H + len, W.id === 'dagger' ? 0.018 * H : 0.026 * H);
  }
}

// who: 'you' or 'foe'. The foe also draws his weapon arm and club; yours is drawn in screen space by drawSwordArm. ga: overall alpha (Blur's ghost).
function drawFighter(ctx, E, F, fm, who, ga = 1) {
  const H = F.H, L = lay(E), isFoe = who === 'foe', lk = lookOf(fm, isFoe);
  const P = (id) => fm.parts.find((q) => q.d.id === id);
  const fall = isFoe && state.fallT > 0 ? Math.pow(clamp(state.fallT / 0.5, 0, 1), 2) : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(F.x, L.floor + 3, H * 0.22, H * 0.035, 0, 0, 6.28); ctx.fill();
  ctx.save();
  ctx.translate(F.x, F.y); ctx.scale(F.dir, 1); ctx.rotate(F.a);
  if (isFoe && (state.stagger > 0 || state.winded > 0)) {
    const k = state.winded > 0 ? 0.35 + 0.25 * Math.sin(state.m * 9) : 0.45;
    const g = ctx.createRadialGradient(0, -0.5 * H, 10, 0, -0.5 * H, 0.6 * H);
    g.addColorStop(0, `rgba(255,210,74,${k})`); g.addColorStop(1, 'rgba(255,210,74,0)');
    ctx.fillStyle = g; ctx.fillRect(-0.7 * H, -1.1 * H, 1.4 * H, 1.3 * H);
  }
  const sc = isFoe && state.pop < 1 ? 0.85 + 0.15 * (1 - state.pop) : 1;
  ctx.scale(sc, sc);
  ctx.globalAlpha = ga * (isFoe && state.pop < 1 ? 1 - state.pop * 0.7 : 1);
  if (fall > 0) ctx.globalAlpha = 1 - fall * 0.5;
  // far arm and its shield, legs, tunic and belly, chest, head
  const sw = isFoe ? state.sw : null, bashing = sw && sw.pose === 'bash';
  drawPart(ctx, E, P('armB'), H, lk, fm.fr.armB);
  if (isFoe && fm.shield && !bashing) offHand(ctx, fm.fr.armB, H, () => drawFoeShield(ctx, H, 0.75, lk));
  drawPart(ctx, E, P('legs'), H, lk, null);
  drawPart(ctx, E, P('belly'), H, lk, null);
  if (lk.net && !(sw && sw.pose === 'net' && sw.fin <= 0)) drawBeltNet(ctx, H);
  drawPart(ctx, E, P('chest'), H, lk, null);
  drawPart(ctx, E, P('head'), H, lk, null);
  // the foe's weapon arm and club
  if (isFoe) {
    const fr = fm.fr.armF;
    drawPart(ctx, E, P('armF'), H, lk, fr);
    ctx.save(); ctx.translate(fr.ox * H, fr.oy * H); ctx.rotate(fr.rot);
    if (hesitating()) {
      ctx.save(); ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 24; ctx.strokeStyle = `rgba(167,139,250,${0.5 + 0.4 * Math.sin(state.m * 60)})`; ctx.lineWidth = 0.07 * H; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, ARM_LEN * H); ctx.lineTo(0, (ARM_LEN + fm.weapon.len) * H); ctx.stroke(); ctx.restore();
    }
    if (sw && sw.pose === 'net' && sw.fin <= 0) drawNet(ctx, 0, (ARM_LEN + 0.05) * H, 0.1 * H); else drawWeapon(ctx, fm, H);
    ctx.restore();
    drawSlots(ctx, E, F, H, fm, lk);
    if (fm.shield && bashing) { ctx.save(); ctx.translate((0.2 + 0.1 * (sw.fin > 0 ? 1 : clamp(sw.t / sw.wind, 0, 1))) * H, -0.52 * H); drawFoeShield(ctx, H, 1, lk); ctx.restore(); }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  if (isFoe && state.stun > 0) {
    const [sx, sy] = toScreen(F, 0.03, -1.0);
    for (let i = 0; i < 3; i++) {
      const a = state.m * 7 + i * 2.09;
      E.text('*', sx + Math.cos(a) * 0.12 * H, sy + Math.sin(a) * 0.035 * H, { size: 26, color: '#fde68a', weight: '800' });
    }
  }
}

// Your weapon arm, in screen space: a gladius or dagger as a leaf blade (broad, tapering to a point), a spear's shaft and head, an axe or a mace.
function drawSwordArm(ctx, E) {
  const h = state.hand, H = myH(E), locked = h.lock > 0, blade = myBlade(E), wid = state.me.weapon;
  const w = (wid === 'dagger' ? 0.026 : 0.034) * H, pole = wid === 'spear' || wid === 'axe';
  const bx = h.bx, by = h.by, nx = -by, ny = bx;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (state.trail.length > 1 && h.sp >= TUNING.hit.minSpeed) {
    ctx.strokeStyle = 'rgba(125,227,255,0.35)'; ctx.lineWidth = 8; ctx.beginPath();
    state.trail.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
  }
  const lk = lookOf(state.you, false);
  limb(ctx, [[h.sx, h.sy], [h.ex, h.ey], [h.hx, h.hy]], 0.075 * H, YOU.skin);
  ctx.fillStyle = YOU.tunic; ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(h.sx, h.sy, 0.058 * H, 0, 6.28); ctx.fill(); ctx.stroke();
  if (lk.pauldron) {
    // the brute's layered iron pauldron over the weapon shoulder
    for (let i = 2; i >= 0; i--) {
      const r = (0.07 - i * 0.012) * H, cy = h.sy - 0.01 * H + i * 0.022 * H;
      ctx.beginPath(); ctx.ellipse(h.sx, cy, r * 1.15, r * 0.7, 0, Math.PI, TAU); ctx.closePath();
      ctx.fillStyle = metalGrad(ctx, h.sx + r, cy - r, h.sx - r, cy, lk.metal); ctx.fill(); ctx.strokeStyle = lk.metal.edge; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }
  const a = h.atk, hot = a && !a.done && h.sp >= TUNING.hit.minSpeed && !locked;
  const gx = h.hx + bx * 0.05 * H, gy = h.hy + by * 0.05 * H, steel = locked ? '#ff8a7a' : '#dfe6ee';
  if (hot) { ctx.strokeStyle = a.kind === 'over' ? 'rgba(255,200,90,0.5)' : 'rgba(125,227,255,0.45)'; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(h.ux, h.uy); ctx.stroke(); }
  const P = (t, s, len = blade, x0 = gx, y0 = gy) => [x0 + bx * len * t + nx * w * s, y0 + by * len * t + ny * w * s];
  const shape = (pts) => { ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); };
  if (pole) {
    // a wooden shaft from behind the fist to the head
    ctx.strokeStyle = '#1b1610'; ctx.lineWidth = 0.03 * H + 2; ctx.beginPath(); ctx.moveTo(h.hx - bx * 0.12 * H, h.hy - by * 0.12 * H); ctx.lineTo(h.ux - bx * 0.02 * H, h.uy - by * 0.02 * H); ctx.stroke();
    ctx.strokeStyle = '#7a5532'; ctx.lineWidth = 0.03 * H; ctx.stroke();
    if (wid === 'spear') {
      const hl = 0.13 * H, hx0 = h.ux - bx * hl, hy0 = h.uy - by * hl;
      shape([P(0, -0.6, hl, hx0, hy0), P(0.3, -1.1, hl, hx0, hy0), P(1, 0, hl, hx0, hy0), P(0.3, 1.1, hl, hx0, hy0), P(0, 0.6, hl, hx0, hy0)]);
      ctx.fillStyle = steel; ctx.fill(); ctx.strokeStyle = '#1b2026'; ctx.lineWidth = 2; ctx.stroke();
    } else if (state.me.mace) {
      ctx.fillStyle = locked ? '#ff8a7a' : '#5b616b'; ctx.strokeStyle = '#1b1610'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(h.ux - bx * 0.04 * H, h.uy - by * 0.04 * H, 0.055 * H, 0, TAU); ctx.fill(); ctx.stroke();
      for (let i = 0; i < 8; i++) { const an = i * 0.785, cx = h.ux - bx * 0.04 * H, cy = h.uy - by * 0.04 * H; line(ctx, cx + Math.cos(an) * 0.045 * H, cy + Math.sin(an) * 0.045 * H, cx + Math.cos(an) * 0.078 * H, cy + Math.sin(an) * 0.078 * H); }
    } else {
      // the axe head bites on the leading edge, behind the tip
      const hx0 = h.ux - bx * 0.13 * H, hy0 = h.uy - by * 0.13 * H, k = 0.034 * H / w;
      shape([P(0.05, k * 0.4, H, hx0, hy0), P(0.0, k * 3.4, H, hx0, hy0), P(0.06, k * 4.2, H, hx0, hy0), P(0.13, k * 3.6, H, hx0, hy0), P(0.11, k * 0.4, H, hx0, hy0)]);
      ctx.fillStyle = locked ? '#ff8a7a' : '#b7c0ca'; ctx.fill(); ctx.strokeStyle = '#1b2026'; ctx.lineWidth = 2; ctx.stroke();
    }
  } else {
    // grip, pommel, crossguard, then the leaf blade
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(h.hx - bx * 0.07 * H, h.hy - by * 0.07 * H); ctx.lineTo(h.hx + bx * 0.04 * H, h.hy + by * 0.04 * H); ctx.stroke();
    ctx.fillStyle = '#c9a43a'; ctx.beginPath(); ctx.arc(h.hx - bx * 0.08 * H, h.hy - by * 0.08 * H, 5, 0, 6.28); ctx.fill();
    ctx.strokeStyle = '#c9a43a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(gx - nx * 0.05 * H, gy - ny * 0.05 * H); ctx.lineTo(gx + nx * 0.05 * H, gy + ny * 0.05 * H); ctx.stroke();
    shape([P(0, -0.8), P(0.3, -1), P(0.72, -0.7), P(1, 0), P(0.72, 0.7), P(0.3, 1), P(0, 0.8)]);
    ctx.fillStyle = steel; ctx.fill(); ctx.strokeStyle = '#1b2026'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(gx + bx * 6, gy + by * 6); ctx.lineTo(h.ux - bx * 6, h.uy - by * 6); ctx.stroke();
  }
  if (hot && a.kind === 'jab') { ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(h.ux, h.uy, 6, 0, 6.28); ctx.fill(); }
  ctx.fillStyle = YOU.skin; ctx.beginPath(); ctx.arc(h.hx, h.hy, 0.042 * H, 0, 6.28); ctx.fill();
  ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = 2; ctx.stroke();
  if (h.down && relative()) {
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(h.ax, h.ay, 22, 0, 6.28); ctx.stroke();
    ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.moveTo(h.ax, h.ay); ctx.lineTo(h.fx, h.fy); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(h.fx, h.fy, 7, 0, 6.28); ctx.fill();
  } else if (h.down) {
    ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(h.fx, h.fy); ctx.lineTo(h.fx, h.fy - TUNING.offset); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(h.fx, h.fy, 14, 0, 6.28); ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.stroke();
  }
  if (a && a.kind !== 'raise' && !locked) E.text(a.kind === 'over' ? 'OVERHEAD' : a.kind.toUpperCase(), h.hx, h.hy - 0.12 * H, { size: 11, color: '#e2e8f0', alpha: 0.7, weight: '700' });
  if (locked) E.text('X', h.ux, h.uy - 22, { size: 22, color: '#ff8a7a', weight: '800' });
}

// Your off arm and the round shield: hanging at the hip when down, up across the chest when raised, cracked as it wears.
function drawShield(ctx, E) {
  const sh = state.sh, Fy = youF(E), H = Fy.H, J = PARTS[4].joint;
  if (sh.broken) return;
  const [hx, hy] = toScreen(Fy, ...shieldPos());
  const [sx, sy] = toScreen(Fy, J[0], J[1]);
  const r = lerp(0.11, 0.2, sh.up) * H, cx = hx, cy = hy;
  limb(ctx, [[sx, sy], [hx, hy]], 0.07 * H, YOU.skin);
  ctx.save(); ctx.translate(cx, cy);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#b9803a'); g.addColorStop(1, '#6d4519');
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.28); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = sh.flash > 0 ? '#ffffff' : '#2a1c10'; ctx.lineWidth = 4; ctx.stroke();
  ctx.strokeStyle = '#d6b04a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r * 0.82, 0, 6.28); ctx.stroke();
  ctx.fillStyle = '#c9a43a'; ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, 6.28); ctx.fill(); ctx.stroke();
  const worn = shieldMax() - sh.hits;
  ctx.strokeStyle = '#1a120a'; ctx.lineWidth = 2;
  for (let i = 0; i < worn; i++) { const a = i * 1.7 + 0.5; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.25, Math.sin(a) * r * 0.25); ctx.lineTo(Math.cos(a + 0.2) * r * 0.65, Math.sin(a + 0.2) * r * 0.65); ctx.lineTo(Math.cos(a - 0.1) * r * 0.95, Math.sin(a - 0.1) * r * 0.95); ctx.stroke(); }
  if (sh.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${sh.flash / 0.25 * 0.5})`; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.28); ctx.fill(); }
  ctx.restore();
}

// The shield buttons and the step rocker. The shield button matching the foe's tell glows; the raised one is lit; Back lights while you are backed off, In while you step in.
function drawShieldBtns(ctx, E) {
  const sh = state.sh, sw = state.sw, tell = sw && sw.fin <= 0 && !hesitating() ? sw.zone : null, fakeBtn = hesitating() ? sw.zone : null;
  const pulse = 0.5 + 0.5 * Math.sin(state.m * 14);
  for (const b of shieldBtns(E)) {
    if (b.rocker) { drawStepBtn(ctx, E, b); continue; }
    const on = raised() && sh.zone === b.z, hot = tell === b.z, perfect = hot && sw.wind - sw.t <= TUNING.shield.perfect;
    const fill = on ? 'rgba(214,162,74,0.85)' : hot ? `rgba(255,${perfect ? 220 : 120},60,${0.45 + 0.4 * pulse})` : sh.arm > 0 && sh.zone === b.z ? 'rgba(214,162,74,0.35)' : 'rgba(20,16,26,0.55)';
    E.roundRect(b.x, b.y, b.w, b.h, 12, sh.broken ? 'rgba(40,40,46,0.6)' : fill, hot ? '#ffd24a' : on ? '#fff0b8' : 'rgba(240,230,204,0.45)');
    if (hot) { ctx.save(); ctx.shadowColor = '#ffb347'; ctx.shadowBlur = 18; E.roundRect(b.x, b.y, b.w, b.h, 12, null, '#ffb347'); ctx.restore(); }
    if (fakeBtn === b.z) E.roundRect(b.x, b.y, b.w, b.h, 12, `rgba(167,139,250,${0.2 + 0.25 * pulse})`, '#c4b5fd');
    if (state.snapT > 0 && hot) { const k = state.snapT / TUNING.moves.feint.snap; ctx.save(); ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 28 * k; E.roundRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6, 14, `rgba(255,255,255,${0.75 * k})`, '#ffffff'); ctx.restore(); }
    E.text(b.z.label, b.x + b.w / 2, b.y + b.h / 2, { size: Math.round(clamp(b.h * 0.26, 15, 22)), weight: '800', color: on ? '#2a1c10' : '#f0e6cc' });
  }
}

function drawStepBtn(ctx, E, b) {
  const ft = state.foot, back = state.away, fwd = ft.inDown || ft.tgt > ft.pos + 0.005, wall = ft.pos <= walls(E).back + 0.01, cd = state.dodgeCool > 0 && !back;
  const on = b.back ? back : fwd, cx = b.x + b.w / 2, cy = b.y + b.h / 2 - b.h * 0.1, s = clamp(b.h * 0.2, 12, 18), dir = b.back ? -1 : 1;
  const fill = on ? 'rgba(125,227,255,0.8)' : b.back && wall ? 'rgba(239,68,68,0.45)' : b.back && cd ? 'rgba(20,16,26,0.55)' : 'rgba(20,40,52,0.6)';
  E.roundRect(b.x + 2, b.y, b.w - 4, b.h, 12, fill, 'rgba(125,227,255,0.6)');
  ctx.fillStyle = on ? '#0b2530' : '#bff0ff'; ctx.beginPath(); ctx.moveTo(cx - dir * s * 0.7, cy - s); ctx.lineTo(cx + dir * s * 0.9, cy); ctx.lineTo(cx - dir * s * 0.7, cy + s); ctx.closePath(); ctx.fill();
  const lbl = b.back ? (state.dg.down ? 'hold' : 'back') : (ft.inDown && ft.inT > TUNING.foot.hold ? 'walk' : 'in');
  E.text(lbl, cx, b.y + b.h - clamp(b.h * 0.2, 11, 15), { size: Math.round(clamp(b.h * 0.2, 12, 16)), weight: '800', color: on ? '#0b2530' : '#bff0ff' });
}
// The arena's edges: a low timber barrier behind each fighter, where he can give no more ground.
function drawWalls(ctx, E) {
  const L = lay(E), wl = walls(E), H = L.H, k = state.foe.size ? state.foe.size.scale : 1;
  const xs = [L.x0 + wl.back * H - 0.2 * H * meSize().scale - 6, L.x1 + wl.fore * H + 0.3 * H * k + 6];
  for (const x of xs) {
    const top = L.floor - 0.34 * H;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x - 6, L.floor - 2, 12, 6);
    ctx.fillStyle = '#5e3e1e'; ctx.fillRect(x - 5, top, 10, L.floor - top);
    ctx.fillStyle = '#8a5f30'; ctx.fillRect(x - 5, top, 3, L.floor - top);
    ctx.fillStyle = '#3e2511'; ctx.fillRect(x - 8, top - 4, 16, 6); ctx.fillRect(x - 8, top + 0.14 * H, 16, 4);
  }
}

// The foe's cover: a shield or guard disc sliding over the part you just hit, plus the OPEN flag while he recovers.
function drawGuard(ctx, E) {
  if (state.fallT > 0) return;
  const F = foeF(E), H = F.H, sty = state.foe.shield ? { tint: '#7dd3fc', label: 'SHIELD' } : { tint: '#fde68a', label: 'GUARD' };
  if (state.winded > 0) {
    const [ox, oy] = toScreen(F, 0.03, -1.04), k = state.winded / state.windedMax, pulse = 0.5 + 0.5 * Math.sin(state.m * 10);
    E.text('OPEN!', ox, oy - 14, { size: 24, color: '#ffd24a', weight: '800', alpha: 0.75 + 0.25 * pulse });
    E.text('winded: stab the glowing slots', ox, oy + 6, { size: 12, color: '#fff0b8', weight: '700' });
    ctx.fillStyle = 'rgba(255,210,74,0.85)'; ctx.fillRect(ox - 34, oy + 16, 68 * k, 4);
  } else if (covering()) {
    const c = state.cover, r = c.r * H, k = clamp(c.t / c.max, 0, 1);
    ctx.save(); ctx.translate(F.x, F.y); ctx.scale(F.dir, 1); ctx.rotate(F.a);
    ctx.translate(c.dx * H, c.dy * H);
    ctx.globalAlpha = 0.45 + 0.4 * Math.min(1, k * 3);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0, 'rgba(210,225,240,0.75)'); g.addColorStop(1, 'rgba(90,110,130,0.7)');
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.28); ctx.fillStyle = g; ctx.fill();
    ctx.setLineDash([6, 4]); ctx.strokeStyle = sty.tint; ctx.lineWidth = 3.5; ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.25, 0, 6.28); ctx.fillStyle = 'rgba(40,50,60,0.7)'; ctx.fill();
    ctx.restore();
    const [gx, gy] = toScreen(F, c.dx + 0.02, c.dy - c.r - 0.03);
    E.text(sty.label, gx, gy, { size: 11, color: sty.tint, weight: '700', alpha: 0.95 });
  } else if (state.open > 0 && !state.sw) {
    const [ox, oy] = toScreen(F, 0.03, -1.02), k = state.open / TUNING.open.dur;
    E.text('OPEN', ox, oy, { size: 20, color: '#ffd24a', weight: '800', alpha: 0.5 + 0.5 * k });
    ctx.fillStyle = 'rgba(255,210,74,0.8)'; ctx.fillRect(ox - 24, oy + 10, 48 * k, 4);
  }
}

// The foe's tell: a band at the height of the coming blow. The label says what to do, and turns gold in the perfect-block window.
function drawZone(ctx, E) {
  const sw = state.sw;
  if (!sw || sw.fin > 0) return;
  const L = lay(E), SH = TUNING.shield, Fy = youF(E), Ff = foeF(E);
  const y = zoneScreenY(L, sw.zone), bh = 0.11 * L.H;
  const x0 = Fy.x - 0.2 * L.H, x1 = Ff.x - 0.1 * L.H, w = x1 - x0;
  if (hesitating()) {
    // the hesitation: a violet shimmer on the fake zone, no shield call yet
    const sh = 0.5 + 0.5 * Math.sin(state.m * 60), g = ctx.createLinearGradient(0, y - bh, 0, y + bh);
    g.addColorStop(0, 'rgba(167,139,250,0)'); g.addColorStop(0.5, `rgba(167,139,250,${0.25 + 0.35 * sh})`); g.addColorStop(1, 'rgba(167,139,250,0)');
    ctx.fillStyle = g; ctx.fillRect(x0, y - bh, w, bh * 2);
    for (let i = 0; i < 7; i++) { const px = x0 + w * ((i * 0.37 + state.m * 1.7) % 1), py = y + Math.sin(i * 2.3 + state.m * 23) * bh * 0.6; ctx.fillStyle = `rgba(221,214,254,${0.5 + 0.5 * Math.sin(i + state.m * 40)})`; ctx.fillRect(px - 2, py - 2, 4, 4); }
    E.text(`${sw.fake.label}...?`, (x0 + x1) / 2, y - bh - 10, { size: 18, weight: '800', color: '#c4b5fd', alpha: 0.6 + 0.4 * sh });
    return;
  }
  const left = sw.wind - sw.t, inWin = left <= SH.dur, perfect = left <= SH.perfect;
  const pulse = 0.5 + 0.5 * Math.sin(sw.t * (10 + 14 * sw.t / sw.wind));
  const rgb = perfect ? '255,236,120' : inWin ? '255,150,60' : '255,70,50';
  const a = (0.12 + 0.3 * (sw.t / sw.wind)) * (0.7 + 0.5 * pulse);
  const g = ctx.createLinearGradient(0, y - bh, 0, y + bh);
  g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.5, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.fillRect(x0, y - bh, w, bh * 2);
  if (sw.counter) {
    const [gx, gy] = toScreen(Ff, 0.2, sw.zone.y);
    ctx.save(); ctx.shadowColor = '#ff5a3a'; ctx.shadowBlur = 30 + 20 * pulse;
    ctx.strokeStyle = `rgba(255,120,80,${0.6 + 0.4 * pulse})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(gx, gy, 0.16 * L.H, 0, 6.28); ctx.stroke(); ctx.restore();
  }
  ctx.strokeStyle = `rgba(${rgb},${0.5 + 0.4 * pulse})`; ctx.lineWidth = 3; ctx.setLineDash([14, 10]);
  ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x0, y); ctx.stroke(); ctx.setLineDash([]);
  const ar = `rgba(${rgb},${0.55 + 0.4 * pulse})`;
  ctx.strokeStyle = ar; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const ax = x0 + w * 0.18, s = 7;
  ctx.beginPath(); ctx.moveTo(ax - s, y - s); ctx.lineTo(ax - 2 * s, y); ctx.lineTo(ax - s, y + s); ctx.stroke();
  const pose = sw.fake && !sw.switched ? sw.fakePose : sw.pose, name = sw.kind === 'combo' ? `COMBO ${sw.idx + 1}/${sw.n}` : POSE_NAME[pose];
  const what = pose === 'bash' ? 'BASH: DODGE' : pose === 'net' ? 'NET: DODGE' : null;
  E.text(what || (perfect ? `${sw.zone.label} NOW` : inWin ? `SHIELD ${sw.zone.label}` : `${sw.counter ? 'COUNTER ' : ''}${name} ${sw.zone.label}`), (x0 + x1) / 2, y - bh - 10, { size: 18, weight: '800', color: `rgb(${rgb})` });
}

// The hint, in a player's first bouts ever: two short lines along the bottom, in the space right of the left thumb's column, fading out.
function drawHint(ctx, E) {
  const t = state.m - state.boutT0, D = TUNING.hint.dur;
  if (t > D) return;
  const R = colRect(E), x0 = R.x + R.w + 12, cx = (x0 + E.w - E.safe.right - 12) / 2, a = clamp((D - t) / 1.5, 0, 1), y = E.h - 12 - E.safe.bottom;
  const lines = ['Left thumb: High / Mid / Low raise the shield  \u00b7  \u25c0 back  \u25b6 in', `Right thumb: your weapon (${relative() ? 'like a trackpad; push far to lunge' : 'push past your reach to lunge'})`];
  lines.forEach((s, i) => E.text(s, cx, y - (lines.length - 1 - i) * 17, { size: 12, color: '#f0e6cc', weight: '700', alpha: a }));
}
// The lesson caption: a banner along the bottom edge, over the feet, so it never covers a zone band, its label or the foe's flags.
function drawCaption(ctx, E) {
  const c = state.caption;
  if (!c) return;
  const a = clamp(c.t / 0.4, 0, 1) * clamp((c.max - c.t) / 0.15, 0, 1), w = Math.min(E.w - 220, 540), lh = 18, h = 10 + c.lines.length * lh, x = (E.w - w) / 2, y = E.h - E.safe.bottom - h - 4;
  ctx.globalAlpha = a;
  E.roundRect(x, y, w, h, 10, 'rgba(24,16,40,0.88)', c.good ? '#ffd24a' : '#a78bfa');
  c.lines.forEach((t, i) => E.text(t, E.w / 2, y + 5 + lh / 2 + i * lh, { size: i ? 13 : 16, weight: i ? '700' : '800', color: i ? '#ede9fe' : c.good ? '#ffd24a' : '#c4b5fd', alpha: a }));
  if (state.sw && state.sw.lesson === 'slow') E.text('slow motion', x + w - 8, y - 8, { size: 10, align: 'right', color: '#a78bfa', alpha: a });
  ctx.globalAlpha = 1;
}

function drawBackground(ctx, E) {
  const L = lay(E), sandTop = L.floor - 0.06 * L.H, wallTop = E.h * 0.2;
  const sky = ctx.createLinearGradient(0, 0, 0, wallTop);
  sky.addColorStop(0, '#1a1420'); sky.addColorStop(1, '#3a2a28');
  ctx.fillStyle = sky; ctx.fillRect(-20, -20, E.w + 40, wallTop + 20);
  const cols = ['#c0805a', '#8a5a4a', '#d4a574', '#6a4a5a'];
  for (const c of state.crowd) { ctx.fillStyle = cols[c.c]; ctx.beginPath(); ctx.arc(c.x * E.w, wallTop - 6 - c.y * (wallTop - 20) * 0.7, c.r, 0, 6.28); ctx.fill(); }
  ctx.fillStyle = '#4a3a2c'; ctx.fillRect(-20, wallTop, E.w + 40, sandTop - wallTop);
  ctx.fillStyle = '#2e241b';
  const n = Math.ceil(E.w / 90);
  for (let i = 0; i < n; i++) {
    const ax = (i + 0.5) * E.w / n, aw = Math.min(46, E.w / n * 0.5), ah = (sandTop - wallTop) * 0.7;
    ctx.beginPath(); ctx.moveTo(ax - aw / 2, sandTop); ctx.lineTo(ax - aw / 2, sandTop - ah + aw / 2); ctx.arc(ax, sandTop - ah + aw / 2, aw / 2, Math.PI, 0); ctx.lineTo(ax + aw / 2, sandTop); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#3a2d22'; ctx.fillRect(-20, wallTop, E.w + 40, 5);
  const sand = ctx.createLinearGradient(0, sandTop, 0, E.h);
  sand.addColorStop(0, '#b99a62'); sand.addColorStop(1, '#7d6340');
  ctx.fillStyle = sand; ctx.fillRect(-20, sandTop, E.w + 40, E.h - sandTop + 20);
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(-20, sandTop, E.w + 40, 3);
}

// ----- upgrade icons and cards -----
// A card's icon, drawn in a roundel of radius s at (x, y) in its tier's tint.
function drawIcon(ctx, id, x, y, s) {
  const c = CARD[id], col = TIER_TINT[c.tier], u = s / 10;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#1a1422'; ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.2, s * 0.12); ctx.stroke();
  ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.2, u * 1.3); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const P = (pts, fill) => { ctx.beginPath(); pts.forEach(([a, b], i) => (i ? ctx.lineTo(a * u, b * u) : ctx.moveTo(a * u, b * u))); if (fill) { ctx.closePath(); ctx.fill(); } else ctx.stroke(); };
  const C = (a, b, r, fill) => { ctx.beginPath(); ctx.arc(a * u, b * u, r * u, 0, TAU); if (fill) ctx.fill(); else ctx.stroke(); };
  if (id === 'hide') { ctx.beginPath(); ctx.moveTo(0, 5 * u); ctx.bezierCurveTo(-8 * u, -1 * u, -4 * u, -7 * u, 0, -3 * u); ctx.bezierCurveTo(4 * u, -7 * u, 8 * u, -1 * u, 0, 5 * u); ctx.fill(); }
  else if (id === 'wind') { for (const k of [-3, 0, 3]) { ctx.beginPath(); ctx.moveTo(-5 * u, k * u); ctx.quadraticCurveTo(2 * u, (k - 2.5) * u, 5 * u, k * u); ctx.stroke(); } }
  else if (id === 'wrist') P([[1.5, -6], [-3, 1], [0.5, 1], [-1.5, 6], [3.5, -1], [0, -1]], true);
  else if (id === 'steady') { C(0, 0, 5.5, false); C(0, 0, 1.8, true); }
  else if (id === 'grip') { ctx.beginPath(); ctx.ellipse(0, 1 * u, 3 * u, 5.5 * u, 0, 0, TAU); ctx.stroke(); line(ctx, -3 * u, -1 * u, 3 * u, -1 * u); line(ctx, -3 * u, 2.5 * u, 3 * u, 2.5 * u); }
  else if (id === 'greaves') { P([[-2.5, -6], [2.5, -6], [3, 5], [5, 6], [-2, 6], [-3, 0]], true); C(-0.5, -2, 1.2, false); }
  else if (id === 'helm') { ctx.beginPath(); ctx.arc(0, 1 * u, 5.5 * u, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.fillRect(-6.5 * u, 0.5 * u, 13 * u, 2 * u); P([[0, -4.5], [0, -7.5]]); }
  else if (id === 'heavy') { ctx.fillRect(-5 * u, -5.5 * u, 10 * u, 4.5 * u); ctx.fillRect(-1 * u, -1 * u, 2 * u, 7 * u); }
  else if (id === 'keen') { ctx.beginPath(); ctx.moveTo(-6 * u, 0); ctx.quadraticCurveTo(0, -6 * u, 6 * u, 0); ctx.quadraticCurveTo(0, 6 * u, -6 * u, 0); ctx.stroke(); C(0, 0, 2.2, true); }
  else if (id === 'riposte') { P([[-5, 4], [4, -5]]); P([[1, -5], [4, -5], [4, -2]]); P([[-5, -4], [-1, 0]]); }
  else if (id === 'blade') { P([[0, -7], [1.6, -3], [1.2, 3], [-1.2, 3], [-1.6, -3]], true); ctx.fillRect(-3.5 * u, 3 * u, 7 * u, 1.4 * u); ctx.fillRect(-0.7 * u, 4.4 * u, 1.4 * u, 2.6 * u); }
  else if (id === 'crowd') { for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5, b = a + TAU / 10; P([[0, 0], [Math.cos(a) * 6.5, Math.sin(a) * 6.5], [Math.cos(b) * 2.6, Math.sin(b) * 2.6]], true); } }
  else if (id === 'unbreak') { P([[0, -6], [5, -3.5], [4, 2.5], [0, 6], [-4, 2.5], [-5, -3.5]], true); ctx.strokeStyle = '#1a1422'; P([[-2, 0], [-0.5, 2], [2.5, -2]]); }
  else if (id === 'feet') { ctx.beginPath(); ctx.ellipse(1.5 * u, 0, 2.6 * u, 5 * u, 0.3, 0, TAU); ctx.fill(); for (const k of [-3, 0, 3]) P([[-6.5, k], [-3.5, k]]); }
  else if (id === 'breath') { for (const k of [-2.5, 2.5]) { ctx.beginPath(); ctx.ellipse(k * u, 1 * u, 2.4 * u, 4.5 * u, 0, 0, TAU); ctx.stroke(); } P([[0, -6], [0, -2]]); }
  else if (id === 'edge') { P([[-5, 5], [3, -3], [5, -5], [4, -2], [-4, 6]], true); P([[-1, -6], [-1, -3]]); P([[-2.5, -4.5], [0.5, -4.5]]); }
  else if (id === 'tough') { P([[0, -6], [5, -4], [4, 3], [0, 6], [-4, 3], [-5, -4]]); P([[0, -3], [0, 3]]); P([[-3, 0], [3, 0]]); }
  else if (id === 'stance') { P([[-6, 6], [0, -5], [6, 6]]); P([[-7.5, 6], [-4, 6]]); P([[4, 6], [7.5, 6]]); }
  else if (id === 'cstance') { P([[0, -6], [5, -4], [4, 3], [0, 6], [-4, 3], [-5, -4]]); P([[1.5, -4], [-1.5, 0.5], [1.5, 0.5], [-1.5, 4.5]]); }
  else if (id === 'second') { ctx.beginPath(); ctx.arc(0, 0, 5 * u, -0.6, 4.4); ctx.stroke(); P([[3, -6], [4.3, -2.8], [1, -2.6]], true); }
  else if (id === 'hunter') { C(0, 0, 5.5, false); C(0, 0, 1.5, true); for (const [a, b] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) P([[a * 3.5, b * 3.5], [a * 7, b * 7]]); }
  else if (id === 'cutter') { ctx.lineWidth = Math.max(1, u * 0.8); for (const k of [-3, 0, 3]) { P([[k, -5], [k, 5]]); P([[-5, k], [5, k]]); } ctx.lineWidth = Math.max(1.5, u * 1.8); P([[-6, 6], [6, -6]]); }
  else if (id === 'lungem') { P([[-6, 0], [4, 0]]); P([[1, -3.5], [5, 0], [1, 3.5]]); P([[-6, -3.5], [-2, -3.5]]); P([[-6, 3.5], [-2, 3.5]]); }
  else if (id === 'gut') { ctx.beginPath(); ctx.ellipse(0, 0.5 * u, 4.5 * u, 5.5 * u, 0, 0, TAU); ctx.stroke(); P([[-4.5, -1], [4.5, -1]]); P([[-4.3, 2.2], [4.3, 2.2]]); }
  else if (id === 'exec') { P([[-1, 6], [3, -5]]); P([[1, -6], [6, -4], [4.5, 0], [1.5, -1.5]], true); C(-3.5, 2.5, 1.6, true); }
  else if (id === 'lion') { ctx.beginPath(); ctx.moveTo(0, 6 * u); ctx.bezierCurveTo(-8 * u, 0, -4 * u, -6 * u, 0, -2 * u); ctx.bezierCurveTo(4 * u, -6 * u, 8 * u, 0, 0, 6 * u); ctx.fill(); P([[-4, -5], [-2.5, -7.5], [0, -5.5], [2.5, -7.5], [4, -5]]); }
  else if (id === 'mirror') { P([[0, -6], [5, -4], [4, 3], [0, 6], [-4, 3], [-5, -4]]); P([[-6.5, -2], [-1, 1], [-6.5, 4]]); }
  else if (id === 'blur') { ctx.globalAlpha *= 0.45; C(-2.5, -3, 2, true); P([[-5, 6], [-2.5, -0.5], [0, 6]], true); ctx.globalAlpha /= 0.45; C(2.5, -3, 2, true); P([[0, 6], [2.5, -0.5], [5, 6]], true); }
  ctx.restore();
}
// short text wrapped to lines of at most n characters
function wrapText(t, n) {
  const out = [];
  for (const w of t.split(' ')) { const l = out.length - 1; if (l >= 0 && (out[l] + ' ' + w).length <= n) out[l] += ' ' + w; else out.push(w); }
  return out;
}
// The draft: the bout's grade and why, Brutus, the odds the grade set, and three cards to pick from.
function drawDraft(ctx, E) {
  const d = state.draft, D = TUNING.draft, top = E.safe.top + 18, t = d.tally, gc = TIER_COL[d.grade];
  ctx.fillStyle = 'rgba(10,8,14,0.82)'; ctx.fillRect(0, 0, E.w, E.h);
  E.text(`${state.foe.name.toUpperCase()} FELLED  \u00b7  BOUT ${state.rack + 1} OF ${state.gauntlet.length}`, E.w / 2, top, { size: 13, weight: '800', color: '#c4b99a' });
  E.text(`GRADE ${d.grade}`, E.w / 2, top + 28, { size: 24, weight: '800', color: gc });
  E.text(`${t.slot} slot hits \u00b7 ${t.read} feints read \u00b7 ${t.pun} punishes \u00b7 ${t.taken} hits taken`, E.w / 2, top + 52, { size: 12, color: '#e2e8f0' });
  const next = state.gauntlet[state.rack + 1];
  E.text(`Old Brutus: \u201c${brutus(state.me, next && next.champion ? 'champ' : 'won')}\u201d`, E.w / 2, top + 72, { size: 14, weight: '700', color: '#fde68a' });
  const o = D.odds[d.grade], tot = o[0] + o[1] + o[2], pct = o.map((v) => Math.round(v / tot * 100)), odds = `Common ${pct[0]}%  \u00b7  Rare ${pct[1]}%  \u00b7  Epic ${pct[2]}%`;
  E.text(d.grade === 'S' ? `Grade S: one Epic guaranteed, then ${odds}` : `Grade ${d.grade} odds per card: ${odds}`, E.w / 2, top + 92, { size: 12, color: '#c4b99a' });
  const n = d.cards.length, gap = 14, w = Math.min(210, (E.w - 32 - E.safe.left - E.safe.right - gap * (n - 1)) / n), y = top + 106, h = Math.min(190, E.h - E.safe.bottom - y - 64), x0 = (E.w - (w * n + gap * (n - 1))) / 2;
  const ready = d.t > D.delay;
  d.btns = d.cards.map((c, i) => {
    const x = x0 + i * (w + gap), col = TIER_TINT[c.tier];
    ctx.globalAlpha = ready ? 1 : 0.6;
    E.roundRect(x, y, w, h, 14, '#221a2b', col);
    E.text(TIERS[c.tier], x + w / 2, y + 14, { size: 10, weight: '800', color: col });
    drawIcon(ctx, c.id, x + w / 2, y + 22 + Math.min(30, h * 0.17), Math.min(28, h * 0.16));
    const ly = y + 30 + Math.min(60, h * 0.34);
    E.text(c.name, x + w / 2, ly, { size: 17, weight: '800', color: '#f0e6cc' });
    wrapText(c.line, Math.max(14, Math.floor(w / 8))).forEach((s2, k) => E.text(s2, x + w / 2, ly + 22 + k * 16, { size: 13, color: '#cbd5e1' }));
    if (c.tier === 0 && has(c.id)) E.text(`you have ${count(c.id)}`, x + w / 2, y + h - 14, { size: 10, color: '#9aa4b2' });
    ctx.globalAlpha = 1;
    return { x, y, w, h, card: c };
  });
  const by = Math.min(E.h - E.safe.bottom - 32, y + h + 34);
  E.text('Pick one', E.w / 2 - 70, by, { size: 15, weight: '800', color: '#ffd24a', alpha: ready ? 0.6 + 0.4 * Math.sin(E.time * 4) : 0.3 });
  d.reroll = tokenButton(E, 'Reroll', E.w / 2 + 90, by, state.token);
}
// The run's one token: Respin on the fighter card, Reroll on a draft. Lit with "1 left" while it is unspent, grey once spent.
function tokenButton(E, label, cx, cy, n, on = true, sub = null) {
  const left = n > 0, live = left && on, w = 170, h = 48, x = cx - w / 2, y = cy - h / 2;
  E.roundRect(x, y, w, h, 14, live ? '#7c3aed' : left ? '#3b2d55' : '#2a2a30', live ? '#c4b5fd' : 'rgba(160,160,170,0.35)');
  E.text(label, cx, cy - 7, { size: 17, weight: '800', color: live ? '#ffffff' : '#8a8f99' });
  E.text(sub || (left ? `${n} left` : 'used'), cx, cy + 12, { size: 11, weight: '700', color: live ? '#ede9fe' : '#6b7280' });
  return { x, y, w, h, live };
}

// ----- fighter cards: the intro before each bout, and the row on the end card -----
const WEAPON_TIP = { gladius: 'fast, loves combos', spear: 'long thrusts, keeps you at range', axe: 'big overheads that crack shields', dagger: 'rushes in; the net slows you' };
// A little body with his plates (grey) and open joint slots (dark), at scale s px per body unit, feet at (x, y).
function armourIcon(ctx, parts, x, y, s) {
  ctx.save(); ctx.translate(x, y);
  for (const q of parts) {
    const p = q.d, j = p.joint || (p.frame ? PARTS[pidx(p.frame)].joint : [0, 0]);
    const side = p.id === 'armF' || p.frame === 'armF' ? 0.11 : p.id === 'armB' ? -0.11 : 0, cx = (j[0] + p.x + side) * s, cy = (j[1] + p.y) * s;
    ctx.beginPath();
    if (p.shape === 'circle') ctx.arc(cx, cy, p.r * s, 0, 6.28);
    else ctx.rect(cx - p.w * s / 2, cy - p.h * s / 2, p.w * s, p.h * s);
    ctx.fillStyle = q.slot ? '#0b0705' : q.armour ? '#aab3bc' : '#b9835a'; ctx.fill();
    ctx.strokeStyle = q.slot ? 'rgba(255,214,150,0.7)' : '#2a1c10'; ctx.lineWidth = 1; ctx.stroke();
  }
  ctx.restore();
}
function statBars(ctx, E, d, x, y, w, rowH, size) {
  [['STR', d.str], ['SPD', d.spd], ['STA', d.sta]].forEach(([k, v], i) => {
    const yy = y + i * rowH;
    E.text(k, x, yy, { size, align: 'left', color: '#c4b99a', weight: '700' });
    const sx = x + size * 2.6, seg = (w - size * 2.6) / 5;
    for (let n = 0; n < 5; n++) { ctx.fillStyle = n < v ? '#e6c866' : 'rgba(255,255,255,0.12)'; ctx.fillRect(sx + n * seg, yy - size * 0.35, seg - 3, size * 0.7); }
  });
}
function weaponIcon(ctx, d, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-Math.PI / 2); ctx.translate(0, -ARM_LEN * s);
  drawWeapon(ctx, { weapon: d.weapon, mace: d.mace }, s); ctx.restore();
}
// A rival's taunt: the noun of your origin, or your village on a revenge run.
const tauntOf = (me) => (me.reason === 'revenge' ? 'I remember your village.' : `You again, little ${ORIGINS[me.origin].noun}?`);
function drawIntro(ctx, E) {
  const d = state.foe, taunt = d.rival ? tauntOf(state.me) : null, hb = Math.min(E.h - 40, 300), h = Math.min(E.h - 16, hb + 24 + (taunt ? 24 : 0));
  const w = Math.min(E.w - 32, 460), x = (E.w - w) / 2, y = (E.h - h) / 2;
  ctx.fillStyle = 'rgba(10,8,14,0.6)'; ctx.fillRect(0, 0, E.w, E.h);
  E.roundRect(x, y, w, h, 18, '#221a2b', d.rival ? '#f87171' : d.champion ? '#ffd24a' : '#e6c866');
  const moment = state.rack === 0 ? 'first' : d.champion ? 'champ' : 'intro';
  E.text(`Old Brutus: \u201c${brutus(state.me, moment)}\u201d`, E.w / 2, y + hb - 16, { size: 13, weight: '700', color: '#fde68a' });
  if (taunt) E.text(`${d.name.split(' ')[0]}: \u201c${taunt}\u201d`, E.w / 2, y + hb + 8, { size: 15, weight: '800', color: '#f87171' });
  E.text(d.rival ? `YOUR RIVAL  \u00b7  THE CHAMPION  \u00b7  BOUT ${state.rack + 1} OF ${state.gauntlet.length}` : d.champion ? `THE CHAMPION  \u00b7  BOUT ${state.rack + 1} OF ${state.gauntlet.length}` : `BOUT ${state.rack + 1} OF ${state.gauntlet.length}${bout().spar ? '  \u00b7  SPARRING' : ''}`, E.w / 2, y + 22, { size: 13, weight: '800', color: d.champion ? '#ffd24a' : '#c4b99a' });
  E.text(d.name.toUpperCase(), E.w / 2, y + 52, { size: d.name.length > 14 ? 24 : 30, weight: '800', color: '#f0e6cc' });
  const col = x + 28, s = Math.min(110, hb * 0.42);
  armourIcon(ctx, foeParts(makeRng(d.partSeed), d.set), col + 40, y + 96 + s * 0.92, s);
  E.text(`${d.set.name} ARMOUR`, col + 40, y + hb - 58, { size: 12, weight: '800', color: '#aab3bc' });
  E.text(`${d.set.slots} gaps open`, col + 40, y + hb - 42, { size: 11, color: '#c4b99a' });
  const rx = x + w * 0.38, rw = w * 0.56;
  E.text(`${d.size.name}`, rx, y + 92, { size: 18, weight: '800', align: 'left', color: '#fde68a' });
  E.text(d.weapon.alt && d.mace ? d.weapon.alt : d.weapon.name, rx, y + 120, { size: 18, weight: '800', align: 'left', color: '#f0e6cc' });
  weaponIcon(ctx, d, rx + rw - 14 - d.weapon.len * 110, y + 112, 110);
  E.text(WEAPON_TIP[d.weapon.id] + (d.shield ? ', carries a shield' : ''), rx, y + 142, { size: 12, align: 'left', color: '#9aa4b2' });
  statBars(ctx, E, d, rx, y + 172, rw, 24, 13);
  if (bout().spar) E.text('Sparring: learn his tells.', rx, y + hb - 46, { size: 15, weight: '800', align: 'left', color: '#7de3ff' });
  const k = 0.6 + 0.4 * Math.sin(state.introT * 4);
  E.text('Tap to fight', E.w / 2, y + h - 18, { size: 16, weight: '800', color: '#ffd24a', alpha: state.introT > 0.35 ? k : 0.3 });
}
function miniCard(ctx, E, d, x, y, w, h, res) {
  const stroke = res === 'felled' ? '#4ade80' : res === 'lost' ? '#ef4444' : 'rgba(240,230,204,0.25)';
  E.roundRect(x, y, w, h, 12, res ? '#221a2b' : 'rgba(34,26,43,0.5)', stroke);
  const a = res ? 1 : 0.45;
  ctx.globalAlpha = a;
  E.text(d.champion ? 'CHAMPION' : `BOUT ${d.tier + 1}`, x + w / 2, y + 13, { size: 10, weight: '800', color: d.champion ? '#ffd24a' : '#c4b99a', alpha: a });
  E.text(d.name.length > 13 ? d.name.split(' ')[0].toUpperCase() : d.name.toUpperCase(), x + w / 2, y + 30, { size: 14, weight: '800', color: '#f0e6cc', alpha: a });
  E.text(`${d.size.id} \u00b7 ${d.weapon.alt && d.mace ? d.weapon.alt : d.weapon.name}`, x + w / 2, y + 47, { size: 10, weight: '700', color: '#fde68a', alpha: a });
  ctx.globalAlpha = a;
  armourIcon(ctx, foeParts(makeRng(d.partSeed), d.set), x + w * 0.28, y + 104, 54);
  statBars(ctx, E, d, x + w * 0.5, y + 70, w * 0.46, 15, 9);
  E.text(d.set.name, x + w * 0.72, y + 118, { size: 9, color: '#aab3bc', alpha: a });
  ctx.globalAlpha = 1;
  E.text(res === 'felled' ? 'FELLED' : res === 'lost' ? 'CUT YOU DOWN' : 'NOT REACHED', x + w / 2, y + h - 14, { size: 11, weight: '800', color: res === 'felled' ? '#4ade80' : res === 'lost' ? '#ef4444' : '#6b7280' });
}

// ----- your fighter: the five wheels, the card, and the end-card mini -----
const TIER_COL = { S: '#ffd24a', A: '#4ade80', B: '#7dd3fc', C: '#c4b99a', D: '#f87171' };
const SIZE_TIP = { S: 'quick swing, short reach', M: 'balanced', L: 'long reach, slow swing' };
const WHEELS = [
  { title: 'SIZE', list: () => TUNING.me.wheels.size, cols: ['#4a6a8c', '#6b5a8c', '#8c4a6a'] },
  { title: 'STRENGTH', list: () => TUNING.me.wheels.stat },
  { title: 'SPEED', list: () => TUNING.me.wheels.stat },
  { title: 'STAMINA', list: () => TUNING.me.wheels.stat },
  { title: 'ARMOUR', list: () => TUNING.me.wheels.armour, cols: ['#8a7452', '#6f7c89', '#3f4a5a'] },
  { title: 'WEAPON', list: () => TUNING.me.wheels.weapon, cols: ['#9b2f2f', '#38457a', '#5a3b22', '#b08c34'] },
  { title: 'ORIGIN', list: () => TUNING.me.wheels.origin, cols: ['#5f7a3a', '#7a3a3a', '#a07a3a', '#8c5a2e', '#2e5f7a', '#6a4a8c'] },
  { title: 'REASON', list: () => TUNING.me.wheels.reason, cols: ['#2f7d6d', '#8a6a2a', '#8b2e2e', '#b8923a'] },
];
const STAT_COLS = ['#8b2e2e', '#a8642e', '#9a8c32', '#5f8f3e', '#2f7d6d'];
const shortOf = (e) => (typeof e[0] === 'number' ? `${e[0]}` : e[3] || (e[0].length > 1 ? e[2][0] : e[0]));
const halvesText = (n) => `${Math.floor(n / 2)}${n % 2 ? '½' : ''}`;

// One wheel: segments sized by their odds, a pointer on top. rot turns the wheel; the landed segment sits under the pointer.
function drawWheel(ctx, E, wh, cx, cy, r, rot, landed, dim, labels = true) {
  const list = wh.list(), tot = list.reduce((a, e) => a + e[1], 0);
  let a0 = -Math.PI / 2 + rot;
  list.forEach((e, i) => {
    const a1 = a0 + e[1] / tot * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, a0, a1); ctx.closePath();
    ctx.fillStyle = (wh.cols || STAT_COLS)[i]; ctx.globalAlpha = dim * (landed == null || landed === i ? 1 : 0.45); ctx.fill(); ctx.globalAlpha = dim;
    ctx.strokeStyle = '#14101a'; ctx.lineWidth = 2; ctx.stroke();
    const am = (a0 + a1) / 2;
    if (labels) E.text(shortOf(e), cx + Math.cos(am) * r * 0.66, cy + Math.sin(am) * r * 0.66, { size: shortOf(e).length > 1 ? 11 : 15, weight: '800', color: '#fff7e0', alpha: dim });
    a0 = a1;
  });
  ctx.strokeStyle = '#e6c866'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.28); ctx.stroke();
  ctx.fillStyle = '#221a2b'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.18, 0, 6.28); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.moveTo(cx - 9, cy - r - 12); ctx.lineTo(cx + 9, cy - r - 12); ctx.lineTo(cx, cy - r + 6); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#14101a'; ctx.lineWidth = 1.5; ctx.stroke();
}
// the wheel turn that puts segment i under the pointer
function wheelRest(wh, i) {
  const list = wh.list(), tot = list.reduce((a, e) => a + e[1], 0);
  let mid = 0; for (let k = 0; k < i; k++) mid += list[k][1];
  return -(mid + list[i][1] / 2) / tot * Math.PI * 2;
}

function meParts(me) { return playerParts(me); }
// what your weapon is for, in one line
const MY_WEAPON_JOB = { gladius: 'all-rounder: quick jabs, fair reach', spear: 'long reach: jab from range; slashes are weak', axe: 'slow and heavy: overheads crack plates', dagger: 'short and fast: slot hits do 4x' };
function drawMeCard(ctx, E, me, x, y, w, h) {
  const M = TUNING.me, S = M.sizes[me.size], A = M.armour[me.set];
  E.roundRect(x, y, w, h, 18, '#1d2a2a', '#4ade80');
  E.text('YOUR FIGHTER', x + w / 2, y + 16, { size: 12, weight: '800', color: '#9fe3c6' });
  E.text(storyLine(me), x + w / 2, y + 36, { size: me.origin === 'alexandria' ? 14 : 15, weight: '800', color: '#f0e6cc' });
  const s = Math.min(104, h * 0.36) * S.scale, ax = x + 70;
  armourIcon(ctx, meParts(me), ax, y + 58 + s * 0.98, s);
  E.text(`${A.name} ARMOUR`, ax, y + 172, { size: 11, weight: '800', color: '#aab3bc' });
  E.text(me.plates.length ? `plated: ${me.plates.map((q) => (q === 'armB' ? 'shield arm' : q)).join(', ')}` : '', ax, y + 187, { size: 10, color: '#c4b99a' });
  const rx = x + w * 0.33, rw = w * 0.4;
  E.text(S.name, rx, y + 62, { size: 20, weight: '800', align: 'left', color: '#fde68a' });
  E.text(SIZE_TIP[me.size], rx, y + 81, { size: 12, align: 'left', color: '#9aa4b2' });
  E.text(`\u2665 ${halvesText(me.halves)} hearts${me.underdog ? '  (+\u00bd underdog)' : ''}`, rx, y + 102, { size: 15, weight: '800', align: 'left', color: '#f87171' });
  statBars(ctx, E, me, rx, y + 126, rw, 22, 13);
  const tx = x + w - 52, ty = y + 84, tc = TIER_COL[me.tier];
  ctx.strokeStyle = tc; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(tx, ty, 30, 0, 6.28); ctx.stroke();
  E.text(me.tier, tx, ty + 2, { size: 40, weight: '800', color: tc });
  E.text('TIER', tx, ty + 44, { size: 11, weight: '800', color: '#c4b99a' });
  if (me.underdog) E.text('Underdog!', tx, ty + 66, { size: 16, weight: '800', color: '#ffd24a', alpha: 0.75 + 0.25 * Math.sin(E.time * 6) });
  // the weapon row: its icon, its name and its job
  const wy = y + 206;
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + 12, wy - 16, w - 24, 32);
  const WI = TUNING.weapons.find((q) => q.id === me.weapon);
  weaponIcon(ctx, { weapon: WI, mace: me.mace }, x + 26, wy + 2, Math.min(110, 52 / (WI.len + 0.1)));
  E.text(weaponName(me), x + 104, wy, { size: 16, weight: '800', align: 'left', color: '#f0e6cc' });
  E.text(MY_WEAPON_JOB[me.weapon], x + w - 22, wy, { size: 12, align: 'right', color: '#c4b99a' });
}
function meMini(ctx, E, me, x, y, w, h) {
  E.roundRect(x, y, w, h, 12, '#1d2a2a', '#4ade80');
  E.text(me.name.toUpperCase(), x + w / 2, y + 13, { size: 10, weight: '800', color: '#9fe3c6' });
  E.text(`TIER ${me.tier}`, x + w / 2, y + 30, { size: 14, weight: '800', color: TIER_COL[me.tier] });
  E.text(`${me.size} · ${weaponName(me)} · ♥ ${halvesText(me.halves)}`, x + w / 2, y + 47, { size: 10, weight: '700', color: '#fde68a' });
  armourIcon(ctx, meParts(me), x + w * 0.28, y + 104, 54 * TUNING.me.sizes[me.size].scale);
  statBars(ctx, E, me, x + w * 0.5, y + 70, w * 0.46, 15, 9);
  E.text(TUNING.me.armour[me.set].name, x + w * 0.72, y + 118, { size: 9, color: '#aab3bc' });
  E.text('YOUR FIGHTER', x + w / 2, y + h - 14, { size: 11, weight: '800', color: '#4ade80' });
}

// ----- scenes -----
const portrait = (E) => E.h > E.w;
function rotateCard(ctx, E) {
  ctx.fillStyle = '#14101a'; ctx.fillRect(0, 0, E.w, E.h);
  const w = Math.min(E.w - 32, 320), h = 190, x = (E.w - w) / 2, y = (E.h - h) / 2;
  E.roundRect(x, y, w, h, 18, '#241c2e', '#e6c866');
  ctx.save(); ctx.translate(E.w / 2, y + 66); ctx.rotate(-0.5 + 0.5 * Math.sin(E.time * 2));
  ctx.strokeStyle = '#e6c866'; ctx.lineWidth = 4; ctx.strokeRect(-24, -40, 48, 80);
  ctx.beginPath(); ctx.arc(0, 30, 4, 0, 6.28); ctx.stroke(); ctx.restore();
  E.text('Turn your phone sideways', E.w / 2, y + 138, { size: 20, weight: '800', color: '#f0e6cc' });
  E.text('Arena is played in landscape', E.w / 2, y + 164, { size: 13, color: '#9aa4b2' });
}

const menu = {
  enter() { this.btnPlay = null; this.btnMute = null; },
  render(ctx, E) {
    if (portrait(E)) { this.btnPlay = this.btnMute = null; rotateCard(ctx, E); return; }
    E.text('ARENA', E.w / 2, E.h * 0.22, { size: 44, weight: '800', color: '#e6c866' });
    E.text(relative() ? 'Right thumb: your weapon, anywhere on the right. Move it like a trackpad: push to jab, sweep to slash, up then down to overhead. Push far past your reach to lunge.' : 'Right thumb: your weapon. Jab out, slash, overhead. Aim for the dark slits. Push past your reach to lunge.', E.w / 2, E.h * 0.22 + 40, { size: 14, color: '#9aa4b2' });
    E.text('Left thumb: High, Mid, Low = shield (hold to keep it up); the rocker: \u25c0 back (tap a backstep, hold to back off), \u25b6 in (tap a pace, hold to walk in).', E.w / 2, E.h * 0.22 + 62, { size: 14, color: '#9aa4b2' });
    E.text('Roll your fighter and their story, then face a gauntlet of five. Hearts carry over; after each fell, pick an upgrade.', E.w / 2, E.h * 0.22 + 84, { size: 14, color: '#c4b99a' });
    this.btnPlay = E.button('Play', E.w / 2, E.h * 0.62);
    this.btnMute = E.button(E.audio.muted ? 'Sound: off' : 'Sound: on', E.w / 2, Math.min(E.h * 0.62 + 66, E.h - 30 - E.safe.bottom), { fill: '#1f2937', w: 160, h: 48, size: 16 });
  },
  onTap(p, E) {
    if (this.btnPlay && E.hit(this.btnPlay, p)) { E.audio.play('tap'); E.setScene('roll', { seed: (Math.random() * 2 ** 32) >>> 0 }); }
    else if (this.btnMute && E.hit(this.btnMute, p)) { E.audio.toggleMute(); E.audio.play('tap'); }
  },
};

// Before the gauntlet: your fighter's six function wheels and two flavour wheels, one after another (tap stops the spinning one), then your card.
// On the card the wheels sit in a strip above it: tap one, then Respin to roll it again with the run's one token, then Fight!
const roll = {
  enter(E, params) {
    this.seed = params.seed; this.me = rollMe(this.seed); this.i = 0; this.t = 0; this.landed = false; this.cardT = 0;
    this.btn = this.respinBtn = null; this.token = TUNING.token; this.used = ''; this.sel = -1; this.spin = null; this.prev = null;
  },
  update(dt, E) {
    if (portrait(E)) return;
    const M = TUNING.me;
    if (this.spin) { this.spin.t += dt; if (this.spin.t >= M.spin) { this.spin = null; this.prev = null; this.sel = -1; E.audio.beep({ freq: 660, dur: 0.1, type: 'triangle', gain: 0.12 }); E.haptic(12); } }
    if (this.i >= WHEELS.length) { this.cardT += dt; return; }
    this.t += dt;
    if (!this.landed && this.t >= M.spin) this.land(E);
    if (this.t >= M.spin + M.pause) { this.i++; this.t = 0; this.landed = false; }
  },
  land(E) {
    this.landed = true; this.t = Math.max(this.t, TUNING.me.spin);
    E.audio.beep({ freq: 440 + this.i * 90, dur: 0.08, type: 'triangle', gain: 0.12 }); E.haptic(10);
  },
  // the card stage's strip of small wheels: one column per wheel, the whole column is its tap target
  strip(E) {
    const n = WHEELS.length, top = E.safe.top + 4, cw = (E.w - 32 - E.safe.left - E.safe.right) / n, r = Math.min(cw * 0.28, 16);
    return { n, top, cw, r, cy: top + 14 + r, bottom: top + 2 * r + 46, x0: 16 + E.safe.left };
  },
  respin(E) {
    const k = this.sel;
    this.prev = this.me; this.me = respinMe(this.me, k, this.seed); this.spin = { k, t: 0 };
    this.token--; this.used = `respin-${WHEELS[k].title.toLowerCase()}`;
    E.audio.beep({ freq: 520, dur: 0.12, type: 'triangle', slide: 1.4, gain: 0.12 }); E.haptic(12);
  },
  render(ctx, E) {
    if (portrait(E)) { this.btn = this.respinBtn = null; rotateCard(ctx, E); return; }
    const M = TUNING.me, me = this.me, n = WHEELS.length;
    if (this.i < n) {
      const top = E.safe.top + 22;
      E.text('ROLL YOUR FIGHTER', E.w / 2, top, { size: 22, weight: '800', color: '#e6c866' });
      const cw = (E.w - 32 - E.safe.left - E.safe.right) / n, r = Math.min(cw * 0.36, E.h * 0.15), cy = top + 30 + r;
      WHEELS.forEach((wh, k) => {
        const cx = 16 + E.safe.left + cw * (k + 0.5), rest = wheelRest(wh, me.idx[k]);
        const done = k < this.i || (k === this.i && this.landed), spinning = k === this.i && !done;
        const u = spinning ? clamp(this.t / M.spin, 0, 1) : 1, rot = k > this.i ? 0 : rest - M.turns * Math.PI * 2 * Math.pow(1 - u, 3);
        const dim = k > this.i ? 0.35 : 1;
        ctx.globalAlpha = dim;
        drawWheel(ctx, E, wh, cx, cy, r, rot, done ? me.idx[k] : null, dim);
        ctx.globalAlpha = 1;
        E.text(wh.title, cx, cy + r + 16, { size: 13, weight: '800', color: done ? '#f0e6cc' : '#9aa4b2' });
        const list = wh.list(), tot = list.reduce((a, e) => a + e[1], 0);
        list.forEach((e, j) => {
          const hit = done && j === me.idx[k];
          E.text(`${typeof e[0] === 'number' ? `${e[0]} ` : ''}${e[2]}  ${Math.round(e[1] / tot * 100)}%`, cx, cy + r + 34 + j * 14, { size: hit ? 12 : 11, weight: hit ? '800' : '600', color: hit ? '#ffd24a' : '#8a8f99' });
        });
      });
      E.text('tap to stop the wheel', E.w / 2, E.h - 14 - E.safe.bottom, { size: 12, color: '#c4b99a', alpha: 0.6 + 0.4 * Math.sin(E.time * 4) });
      return;
    }
    const S = this.strip(E), sp = this.spin, k = clamp(this.cardT / 0.25, 0, 1);
    WHEELS.forEach((wh, j) => {
      const cx = S.x0 + S.cw * (j + 0.5), rest = wheelRest(wh, me.idx[j]), u = sp && sp.k === j ? clamp(sp.t / M.spin, 0, 1) : 1;
      if (this.sel === j) E.roundRect(cx - S.cw / 2 + 3, S.top, S.cw - 6, S.bottom - S.top, 10, 'rgba(124,58,237,0.35)', '#c4b5fd');
      drawWheel(ctx, E, wh, cx, S.cy, S.r, rest - M.turns * Math.PI * 2 * Math.pow(1 - u, 3), u < 1 ? null : me.idx[j], 1, false);
      E.text(wh.title, cx, S.cy + S.r + 11, { size: 10, weight: '800', color: this.sel === j ? '#ffffff' : '#c4b99a' });
      const e = wh.list()[me.idx[j]];
      if (u >= 1) E.text(typeof e[0] === 'number' ? `${e[0]} ${e[2]}` : e[2], cx, S.cy + S.r + 24, { size: 11, weight: '700', color: '#ffd24a' });
    });
    const shown = this.prev || me, w = Math.min(E.w - 32, 480), y = S.bottom + 4, h = Math.min(E.h - E.safe.bottom - y - 6, 290), x = (E.w - w) / 2;
    ctx.globalAlpha = k;
    drawMeCard(ctx, E, shown, x, y + (1 - k) * 30, w, h);
    ctx.globalAlpha = 1;
    const by = y + h - 32, pick = this.sel >= 0;
    this.respinBtn = tokenButton(E, pick ? `Respin ${WHEELS[this.sel].title.toLowerCase()}` : 'Respin', x + 108, by, this.token, pick && !sp, this.token > 0 && !pick ? '1 left · tap a wheel' : null);
    this.btn = E.button('Fight!', x + w - 92, by, { w: 150, h: 48, size: 20, fill: '#b45309' });
  },
  onTap(p, E) {
    if (portrait(E)) return;
    if (this.i < WHEELS.length) {
      if (!this.landed) this.land(E); else { this.i++; this.t = 0; this.landed = false; }
      return;
    }
    if (this.cardT <= 0.3 || this.spin) return;
    if (this.btn && E.hit(this.btn, p)) { E.audio.play('tap'); E.setScene('play', { seed: this.seed, me: this.me, token: this.token, tokenUsed: this.used }); return; }
    if (this.respinBtn && this.respinBtn.live && E.hit(this.respinBtn, p)) { this.respin(E); return; }
    const S = this.strip(E);
    if (this.token > 0 && p.y <= S.bottom + 4 && p.x >= S.x0 && p.x < S.x0 + S.cw * S.n) {
      const j = Math.floor((p.x - S.x0) / S.cw);
      this.sel = this.sel === j ? -1 : j; E.audio.play('tap'); E.haptic(6);
    }
  },
};

function initHand(E) {
  const h = state.hand, L = lay(E);
  const [sx, sy] = toScreen(youF(E), SHOULDER[0], SHOULDER[1]);
  [h.tgx, h.tgy] = restPt(E);
  h.pang = Math.atan2(h.tgy - sy, h.tgx - sx);
  solveArm(E, 0);
  h.pux = h.ux; h.puy = h.uy; h.phx = h.hx; h.phy = h.hy; state.you.a = 0.05;
  poseYou(E, 0.016);
  poseFoe(E, 0.016);
}

const play = {
  state, lay, foeF, youF, toScreen, newRack, raiseShield, dodge, fell, blockRun, ZONE, TUNING, rollMe, respinMe, solveArm, windFoe, gapHit, bout,
  walls, gapNow, stepIn, dealDraft, openDraft, pickCard, rerollDraft, CARD, buildMove, startMove, shieldBtns, myBlade, bounce,
  enter(E, params) {
    newRound(E, params.seed, params.me || rollMe(params.seed)); initHand(E);
    if (params.token != null) { state.token = params.token; state.tokenUsed = params.tokenUsed || ''; }
  },
  update(dt, E) {
    if (portrait(E)) return;
    if (state.draft) { state.draft.t += dt; return; }
    if (state.caption) { state.caption.t -= dt; if (state.caption.t <= 0) state.caption = null; }
    // slow time: the open window's brief slow, and the whole of the first feint ever
    if (state.slowT > 0) { state.slowT -= dt; dt *= TUNING.openWin.slow; } else if (state.sw && state.sw.lesson === 'slow') dt *= TUNING.lesson.slow;
    if (state.intro) {
      state.m += dt; state.introT += dt;
      if (state.pop > 0) state.pop = Math.max(0, state.pop - dt * 4);
      poseFoe(E, dt); poseYou(E, dt); moveHand(E, dt);
      for (const q of state.pops) q.life -= dt;
      state.pops = state.pops.filter((q) => q.life > 0);
      return;
    }
    if (state.stop > 0) { state.stop -= dt; return; }
    state.m += dt;
    state.netT = Math.max(0, state.netT - dt); state.pushT = Math.max(0, state.pushT - dt); state.snapT = Math.max(0, state.snapT - dt);
    state.mem.turtle += ((raised() ? 1 : 0) - state.mem.turtle) * (1 - Math.exp(-dt / TUNING.read.turtleTau));
    state.kickV += (-state.kickA * 90 - state.kickV * 7) * dt;
    state.kickA += state.kickV * dt;
    for (const p of state.foe.parts) { p.flash = Math.max(0, p.flash - dt); p.clang = Math.max(0, p.clang - dt); p.cool = Math.max(0, p.cool - dt); }
    for (const p of state.you.parts) p.clang = Math.max(0, p.clang - dt);
    if (state.pop > 0) state.pop = Math.max(0, state.pop - dt * 4);
    state.dodgeT = Math.max(0, state.dodgeT - dt);
    state.hurt = Math.max(0, state.hurt - dt);
    if (state.stagger > 0) state.stagger -= dt;
    state.riposte = Math.max(0, state.riposte - dt);
    if (state.open > 0) state.open -= dt;
    if (state.cover) {
      const c = state.cover, k = 1 - Math.exp(-dt / TUNING.cover.slide);
      c.t -= dt; c.dx += (c.x - c.dx) * k; c.dy += (c.y - c.dy) * k;
    }
    stepFoe(dt, E);
    stepYou(E, dt);

    poseFoe(E, dt);
    poseYou(E, dt);
    moveHand(E, dt);
    updateAttack(E, dt);
    checkHits(E);
    updateFoe(dt, E);
    updateDefence(dt, E);
    checkExhaust(E, dt);
    state.foe.shown += (Math.max(0, state.foe.hp) - state.foe.shown) * (1 - Math.exp(-dt / 0.25));
    poseFoe(E, 0);

    if (state.fallT > 0) {
      state.fallT += dt;
      if (state.fallT >= TUNING.resetDelay) {
        if (state.rack + 1 >= Math.min(TUNING.bouts, state.gauntlet.length)) { this.finish(E); return; }
        openDraft(E); return;
      }
    }
    for (const f of state.fx) {
      f.life -= dt; f.vy += (f.g || 0) * dt; f.x += f.vx * dt || 0; f.y += f.vy * dt || 0;
      if (f.k === 's' || f.k === 'p') f.rot += f.vr * dt;
      if (f.k === 'd') { f.vx *= 0.94; f.vy *= 0.94; }
    }
    state.fx = state.fx.filter((f) => f.life > 0);
    for (const s of state.streaks) s.life -= dt;
    state.streaks = state.streaks.filter((s) => s.life > 0);
    for (const q of state.pops) q.life -= dt;
    state.pops = state.pops.filter((q) => q.life > 0);

    if (state.endT > 0) { state.endT -= dt; if (state.endT <= 0) this.finish(E); }
  },
  finish(E) {
    if (state.done) return; state.done = true;
    settleFeint('none');
    const best = E.save.get('best2', 0), isNew = state.gapHits > best;
    if (isNew) E.save.set('best2', state.gapHits);
    const g = state.gauntlet, won = state.results.filter((r) => r === 'felled').length >= g.length, reached = Math.min(g.length, state.rack + 1);
    const r = { gapHits: state.gapHits, slotHits: state.slotHits, lunges: state.lunges, clangs: state.clangs, broken: state.broken, overheads: state.overheads, jabs: state.jabs, slashes: state.slashes, blocks: state.blocks, perfects: state.perfects, dodges: state.dodges, staOuts: state.staOuts, counters: state.counters, counterHits: state.counterHits, taken: state.taken, felled: state.felled,
      feints: state.feints, feintsRead: state.feintsRead, switchReads: state.switchReads, feintsBit: state.feintsBit, feintsNone: state.feintsNone, combos: state.combos, windeds: state.windeds, punishes: state.punishes, bashes: state.bashes, bashHits: state.bashHits, nets: state.nets, netted: state.netted,
      zoneReads: state.zoneReads, lungeReads: state.lungeReads, turtleReads: state.turtleReads, presses: state.presses, retreats: state.retreats, plateSaves: state.plateSaves };
    const me = state.me, champ = g[g.length - 1];
    // the champion who cut you down is remembered for the next run; a fall earlier only chalks your name on the wall
    if (!won && state.results[g.length - 1] === 'lost') E.save.set('rival', rivalOf(champ));
    const wall = won ? E.save.get('wall', []) : E.save.set('wall', [{ name: me.name, bout: reached, female: me.female }, ...E.save.get('wall', [])].slice(0, 8));
    E.ledger.add('result', { ...r, won, reached, halves: state.hp, sizes: g.map((d) => d.size.id).join(''), weapons: g.map((d) => d.weapon.id).join(','), armour: g.map((d) => d.set.id[0]).join(''),
      stats: g.map((d) => `${d.str}${d.spd}${d.sta}`).join(','), champ: g[g.length - 1].name, lostTo: won ? '' : `${g[reached - 1].name} ${g[reached - 1].size.id} ${g[reached - 1].weapon.id}`,
      moves: Object.entries(state.moveCount).map(([k, v]) => `${k}${v}`).join(','),
      meSize: me.size, meStats: `${me.str}${me.spd}${me.sta}`, meArmour: me.set, mePlates: me.plates.join(','), meTier: me.tier, underdog: me.underdog ? 1 : 0, bout1Loss: !won && reached === 1 ? 1 : 0,
      grades: state.grades.join(''), picks: state.picks.join(','), stepsIn: state.stepsIn, stepsOut: state.stepsOut, wallHits: state.wallHits, foeWall: state.foeWall, outReach: state.outReach,
      shrugs: state.shrugs, meWeapon: me.weapon === 'axe' && me.mace ? 'mace' : me.weapon, token: state.tokenUsed, epicsSeen: state.epicsSeen, origin: me.origin, reason: me.reason, rival: champ.rival ? 1 : 0, rivalBeaten: state.rivalBeaten });
    E.setScene('over', { ...r, won, reached, hp: state.hp, gauntlet: g, me, results: state.results.slice(), best: Math.max(best, state.gapHits), isNew,
      picks: state.picks.slice(), grades: state.grades.slice(), wall, rivalBeaten: state.rivalBeaten });
  },
  // two thumbs: a touch that starts in the left third is the shield and dodge thumb (buttons only), any other is the sword thumb
  onPointerDown(p, E) {
    if (state.endT > 0 || portrait(E) || state.intro || state.draft) return;
    if (p.startX < E.w / 3) {
      const b = buttonAt(E, p), side = stepSide(b);
      if (side) { state.stepHold = { id: p.id, side }; pressStep(E, side, p.id); }
      else if (b) raiseShield(E, b.z, p.id);
      return;
    }
    const h = state.hand;
    if (h.down) return;
    h.down = true; h.id = p.id; h.fx = p.x; h.fy = p.y; h.hist = [{ x: p.x, y: p.y, t: now() }];
    h.ax = p.x; h.ay = p.y;
    if (h.lock <= 0) {
      if (relative()) [h.tgx, h.tgy] = guardPt(E); else { h.tgx = p.x; h.tgy = p.y - TUNING.offset; }
      h.grip = 0; solveArm(E, 0);
      h.pux = h.ux; h.puy = h.uy; h.phx = h.hx; h.phy = h.hy; h.sp = 0; h.vx = h.vy = 0;
    }
  },
  onPointerMove(p, E) {
    const h = state.hand, sp = state.stepHold;
    if (sp && sp.id === p.id) {
      const side = stepSide(buttonAt(E, p));
      if (side && side !== sp.side) { releaseStep(p.id); sp.side = side; pressStep(E, side, p.id); }
      return;
    }
    if (h.down && h.id === p.id) { h.fx = p.x; h.fy = p.y; }
  },
  onTap(p, E) {
    const d = state.draft;
    if (d) {
      if (d.reroll && d.reroll.live && E.hit(d.reroll, p)) { rerollDraft(E); return; }
      const b = d.t > TUNING.draft.delay && d.btns.find((q) => E.hit(q, p)); if (b) pickCard(E, b.card); return;
    }
    if (state.intro && state.introT > 0.35 && !portrait(E)) {
      state.intro = false; state.swingIn = 1.2; E.audio.play('tap');
      const seen = E.save.get('boutsSeen', 0);
      state.hint = seen < TUNING.hint.bouts; state.boutT0 = state.m; E.save.set('boutsSeen', seen + 1);
    }
  },
  onPointerUp(p) {
    const s = state.sh, h = state.hand, dg = state.dg, ft = state.foot;
    if (state.stepHold && state.stepHold.id === p.id) state.stepHold = null;
    if (ft.inDown && ft.inId === p.id) { ft.inDown = false; ft.inId = -1; }
    else if (dg.down && dg.id === p.id) { dg.down = false; dg.id = -1; }
    else if (s.hid === p.id) { s.held = false; s.hid = -1; }
    else if (h.down && h.id === p.id) { h.down = false; h.hist = []; h.sp = 0; h.atk = null; }
  },
  render(ctx, E) {
    if (portrait(E)) { rotateCard(ctx, E); return; }
    ctx.save();
    drawBackground(ctx, E);
    drawWalls(ctx, E);
    if (state.sw && state.sw.ghostX) drawFighter(ctx, E, { ...youF(E), x: state.sw.ghostX }, state.you, 'you', 0.3 + 0.1 * Math.sin(state.m * 20));
    drawFighter(ctx, E, youF(E), state.you, 'you');
    if (state.netT > 0) { const Fy = youF(E); drawNet(ctx, Fy.x, Fy.y - 0.55 * Fy.H, 0.32 * Fy.H * clamp(state.netT / 0.3, 0.6, 1)); }
    drawFighter(ctx, E, foeF(E), state.foe, 'foe');
    drawGuard(ctx, E);
    foeHealth(ctx, E);
    drawZone(ctx, E);
    drawShield(ctx, E);
    drawSwordArm(ctx, E);
    drawShieldBtns(ctx, E);
    drawCaption(ctx, E);

    for (const f of state.fx) {
      const t = clamp(f.life / f.max, 0, 1);
      if (f.k === 's') {
        ctx.globalAlpha = Math.min(1, t * 2); ctx.strokeStyle = f.c; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + Math.cos(f.rot) * f.len, f.y + Math.sin(f.rot) * f.len); ctx.stroke();
      } else if (f.k === 'p') {
        ctx.globalAlpha = Math.min(1, t * 2); ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
        ctx.fillStyle = '#8b949e'; ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h); ctx.strokeStyle = '#2c3238'; ctx.lineWidth = 1.5; ctx.strokeRect(-f.w / 2, -f.h / 2, f.w, f.h); ctx.restore();
      } else if (f.k === 'k') {
        ctx.globalAlpha = t; ctx.strokeStyle = f.c; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x - f.vx * 0.04, f.y - f.vy * 0.04); ctx.stroke();
      } else if (f.k === 'd') {
        ctx.globalAlpha = t * 0.45; ctx.fillStyle = f.c; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1.4 - t * 0.4), 0, 6.28); ctx.fill();
      } else if (f.k === 'r') {
        ctx.globalAlpha = t; ctx.strokeStyle = f.c; ctx.lineWidth = 3 * t + 1;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r0 + (f.r - f.r0) * (1 - t), 0, 6.28); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    for (const s of state.streaks) {
      const t = s.life / s.max;
      ctx.lineCap = 'round';
      ctx.globalAlpha = t * 0.6; ctx.strokeStyle = s.net ? '#e2e8f0' : s.red ? '#ff4a3a' : '#9ff'; ctx.lineWidth = 22 * t;
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
      ctx.globalAlpha = t; ctx.strokeStyle = '#fff'; ctx.lineWidth = 5 * t + 1;
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (state.hurt > 0) {
      const g2 = ctx.createRadialGradient(E.w / 2, E.h / 2, E.h * 0.4, E.w / 2, E.h / 2, E.w * 0.6);
      g2.addColorStop(0, 'rgba(255,0,0,0)'); g2.addColorStop(1, `rgba(255,20,20,${state.hurt / 0.4 * 0.55})`);
      ctx.fillStyle = g2; ctx.fillRect(0, 0, E.w, E.h);
    }
    for (const q of state.pops) {
      const t = q.life / q.max;
      E.text(q.s, q.x, q.y - (1 - t) * 34, { size: q.size * (1 + (1 - t) * 0.2), color: q.color, weight: '800', alpha: Math.min(1, t * 2) });
    }

    // HUD, inside the safe area
    const top = 10 + E.safe.top, l = 16 + E.safe.left, r = 16 + E.safe.right, TS = TUNING.stamina;
    E.text(`BOUT ${state.rack + 1}/${state.gauntlet.length}`, l, top + 14, { size: 20, align: 'left', weight: '800', color: state.foe.champion ? '#ffd24a' : '#e6e6e6' });
    // hearts in quarters: a plated hit takes a quarter
    const nh = Math.ceil(state.maxHp / 2);
    for (let i = 0; i < nh; i++) {
      const hx = E.w - r - 10 - (nh - 1 - i) * 26, have = clamp((state.hp - i * 2) / 2, 0, 1);
      E.text('\u2665', hx, top + 14, { size: 26, color: have >= 1 ? '#ef4444' : '#3b3f46' });
      if (have > 0 && have < 1) { ctx.save(); ctx.beginPath(); ctx.rect(hx - 13, top - 4, 26 * have, 36); ctx.clip(); E.text('\u2665', hx, top + 14, { size: 26, color: '#ef4444' }); ctx.restore(); }
    }
    const bw = 110, bx = E.w - r - bw, sf = state.stamina / state.staMax;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(bx - 1, top + 29, bw + 2, 11);
    const flashOn = state.exhaust > 0 && Math.floor(state.m * 8) % 2 === 0;
    if (state.exhaust > 0) { ctx.fillStyle = flashOn ? '#ffffff' : '#ef4444'; ctx.fillRect(bx, top + 30, bw * clamp(1 - state.exhaust / TS.exhaust, 0.05, 1), 9); }
    else { ctx.fillStyle = sf < 0.25 ? '#f59e0b' : '#4ade80'; ctx.fillRect(bx, top + 30, bw * sf, 9); }
    E.text(state.exhaust > 0 ? 'EXHAUSTED' : 'stamina', bx - 6, top + 36, { size: 10, align: 'right', color: state.exhaust > 0 ? '#fca5a5' : '#c4b99a', weight: state.exhaust > 0 ? '800' : '400' });
    // your upgrades, under the hearts
    state.picks.forEach((id, i) => drawIcon(ctx, id, E.w - r - 9 - (state.picks.length - 1 - i) * 22, top + 55, 9));
    const sy = top + (state.picks.length ? 74 : 60);
    const nsh = shieldMax();
    for (let i = 0; i < nsh; i++) {
      ctx.fillStyle = state.sh.broken ? '#3b3f46' : i < state.sh.hits ? '#d6a24a' : '#3b3f46';
      ctx.fillRect(bx + i * (bw / nsh), sy, bw / nsh - 4, 7);
    }
    E.text(state.sh.broken ? 'shield broken' : 'shield', bx - 6, sy + 6, { size: 10, align: 'right', color: state.sh.broken ? '#ef4444' : '#c4b99a' });
    if (state.riposte > 0) E.text('RIPOSTE x2', E.w / 2, top + 62, { size: 16, weight: '800', color: '#ffd24a' });
    if (state.netT > 0) E.text('NETTED: slow hand, no lunge', bx + bw, sy + 34, { size: 11, align: 'right', color: '#e2e8f0', weight: '700' });
    if (state.hint && !state.intro && !state.caption) drawHint(ctx, E);
    if (state.intro) drawIntro(ctx, E);
    if (state.draft) drawDraft(ctx, E);
  },
  onPause() {},
};

// The end: an epilogue card first when the champion fell, then the end card (your card and theirs, your upgrades, the pit wall when you fell).
const over = {
  enter(E, params) {
    this.p = params; this.page = params.won ? 0 : 1; this.t = 0; this.details = false;
    E.audio.play(params.won ? 'win' : 'lose');
  },
  update(dt) { this.t += dt; },
  epilogue(ctx, E) {
    const p = this.p, me = p.me, w = Math.min(E.w - 32, 620), h = Math.min(E.h - 40, 230), x = (E.w - w) / 2, y = (E.h - h) / 2;
    E.roundRect(x, y, w, h, 18, '#221a2b', '#ffd24a');
    E.text('CHAMPION FELLED', E.w / 2, y + 30, { size: 15, weight: '800', color: '#ffd24a' });
    if (p.rivalBeaten) E.text('Rival defeated!', E.w / 2, y + 54, { size: 16, weight: '800', color: '#f87171' });
    E.text(`${me.name}, ${ORIGINS[me.origin].text}.`, E.w / 2, y + h * 0.45, { size: 20, weight: '800', color: '#f0e6cc' });
    E.text(EPILOGUE[me.reason](me.name, me.female), E.w / 2, y + h * 0.45 + 32, { size: 17, weight: '700', color: '#fde68a' });
    E.text('Tap to continue', E.w / 2, y + h - 22, { size: 14, weight: '800', color: '#ffd24a', alpha: this.t > 0.5 ? 0.6 + 0.4 * Math.sin(E.time * 4) : 0.3 });
  },
  render(ctx, E) {
    const p = this.p, g = p.gauntlet, top = E.safe.top + 22;
    if (portrait(E)) { this.btnAgain = this.btnMenu = this.btnDetails = null; rotateCard(ctx, E); return; }
    if (this.page === 0) { this.btnAgain = this.btnMenu = this.btnDetails = null; this.epilogue(ctx, E); return; }
    const last = g[p.reached - 1], me = p.me, by = E.h - 30 - E.safe.bottom;
    E.text(p.won ? 'CHAMPION FELLED' : `Cut down by ${last.name}`, E.w / 2, top, { size: 24, weight: '800', color: p.won ? '#ffd24a' : '#ef4444' });
    E.text(`Reached bout ${p.reached} of ${g.length}${p.grades.length ? `  \u00b7  grades ${p.grades.join(' ')}` : ''}`, E.w / 2, top + 22, { size: 13, color: '#fbbf24' });
    this.btnDetails = E.button(this.details ? 'Hide details' : 'Details', E.w / 2 - 160, by, { w: 150, h: 48, size: 16, fill: '#1f2937' });
    this.btnAgain = E.button('Again', E.w / 2, by, { w: 150, h: 48, size: 18 });
    this.btnMenu = E.button('Menu', E.w / 2 + 160, by, { w: 150, h: 48, size: 18, fill: '#334155' });
    if (this.details) { this.stats(ctx, E, top + 36, by - 32); return; }
    const n = g.length + 1, gap = 8, w = Math.min(150, (E.w - 32 - E.safe.left - E.safe.right - gap * (n - 1)) / n), h = 150, x0 = (E.w - (w * n + gap * (n - 1))) / 2, y0 = top + 36;
    meMini(ctx, E, me, x0, y0, w, h);
    g.forEach((d, i) => miniCard(ctx, E, d, x0 + (i + 1) * (w + gap), y0, w, h, p.results[i] || null));
    let y = y0 + h + 14;
    // your upgrades, icon and name
    if (p.picks.length) {
      ctx.font = '600 12px system-ui, sans-serif';
      const items = p.picks.map((id) => CARD[id].name), ws = items.map((t) => ctx.measureText(t).width + 34), tw = ws.reduce((a2, v) => a2 + v, 0);
      let x = E.w / 2 - tw / 2 + 40;
      E.text('Upgrades:', x - 10, y, { size: 12, align: 'right', weight: '800', color: '#c4b99a' });
      p.picks.forEach((id, i) => { drawIcon(ctx, id, x + 8, y, 8); E.text(items[i], x + 20, y, { size: 12, align: 'left', color: '#f0e6cc' }); x += ws[i]; });
    } else E.text('No upgrades picked', E.w / 2, y, { size: 12, color: '#6b7280' });
    y += 18;
    if (!p.won) {
      const her = me.female ? 'her' : 'his';
      E.text(`${me.name} fell in bout ${p.reached}. Old Brutus chalked ${her} name on the wall of the pit.`, E.w / 2, y, { size: 13, weight: '700', color: '#f0e6cc' });
      y += 18;
      // the pit wall: the last eight fallen, newest first, chalked on stone
      const names = p.wall.slice(0, 8), sw = Math.min(E.w - 40, 120 * names.length + 20), sx = (E.w - sw) / 2;
      E.roundRect(sx, y - 2, sw, 24, 6, '#3a322c', '#5a4e44');
      names.forEach((q, i) => E.text(`${q.name} (${q.bout})`, sx + 10 + (sw - 20) * (i + 0.5) / names.length, y + 10, { size: 12, weight: '700', color: i === 0 ? '#ffffff' : '#d6d0c4', alpha: i === 0 ? 1 : 0.75 }));
      y += 32;
      E.text(`Old Brutus: \u201c${brutus(me, 'lost')}\u201d`, E.w / 2, y, { size: 13, weight: '700', color: '#fde68a' });
      y += 16;
    } else {
      E.text(EPILOGUE[me.reason](me.name, me.female), E.w / 2, y, { size: 13, weight: '700', color: '#fde68a' });
    }
  },
  // Details: the raw counts of the run, laid out in a grid between the headline and the buttons
  stats(ctx, E, y0, y1) {
    const p = this.p, w = Math.min(E.w - 32, 760), x = (E.w - w) / 2;
    const items = [
      ['gap hits', `${p.gapHits}${p.isNew ? ' (new best!)' : ''}`], ['best', p.best], ['joint hits', p.slotHits], ['jabs', p.jabs], ['slashes', p.slashes], ['overheads', p.overheads],
      ['lunges', p.lunges], ['clangs', p.clangs], ['plates broken', p.broken], ['blocks', `${p.blocks} (${p.perfects} perfect)`], ['backsteps', p.dodges], ['hits taken', p.taken],
      ['stamina-outs', p.staOuts], ['counters', `${p.counters} (${p.counterHits} hit)`], ['feints', p.feints], ['feints read', `${p.feintsRead} (${p.switchReads} by a switch)`], ['feints bit', p.feintsBit], ['feints neither', p.feintsNone],
      ['combos', p.combos], ['winded', p.windeds], ['punishes', p.punishes], ['bashed', `${p.bashHits}/${p.bashes}`], ['netted', `${p.netted}/${p.nets}`], ['felled', p.felled],
    ];
    const cols = 3, rows = Math.ceil(items.length / cols), lh = Math.min(22, (y1 - y0 - 16) / rows), cw = w / cols;
    E.roundRect(x, y0, w, rows * lh + 16, 12, 'rgba(34,26,43,0.85)', 'rgba(240,230,204,0.25)');
    items.forEach(([k, v], i) => {
      const cx = x + (i % cols) * cw, cy = y0 + 8 + lh / 2 + Math.floor(i / cols) * lh;
      E.text(k, cx + cw * 0.55 - 6, cy, { size: 12, align: 'right', color: '#9aa4b2' });
      E.text(`${v}`, cx + cw * 0.55 + 6, cy, { size: 12, align: 'left', weight: '700', color: '#f0e6cc' });
    });
  },
  onTap(p, E) {
    if (this.page === 0) { if (this.t > 0.5) { this.page = 1; E.audio.play('tap'); } return; }
    if (this.btnDetails && E.hit(this.btnDetails, p)) { this.details = !this.details; E.audio.play('tap'); }
    else if (this.btnAgain && E.hit(this.btnAgain, p)) E.setScene('roll', { seed: (Math.random() * 2 ** 32) >>> 0 });
    else if (this.btnMenu && E.hit(this.btnMenu, p)) E.setScene('menu');
  },
};

const STD = { offset: 50, 'hand.lag': 0.035, 'hit.minSpeed': 450, 'stamina.regen': 32, 'attack.over.cost': 28, 'shield.perfect': 0.15, 'shield.hits': 4, 'shield.drain': 6, 'open.dur': 0.8, 'swing.windup': 0.7, 'swing.gap': 2.0, 'counter.windup': 0.55, 'dodge.cost': 18 };

export const game = {
  slug: 'arena',
  title: 'Arena',
  saveVersion: 3,
  // v2 (proto 12) adds the rival champion and the pit wall of fallen names; v3 (proto 13) counts the bouts begun, for the hint, and a player who has fought before has seen it
  migrate(data, fromVersion) {
    if (fromVersion < 2) { data.rival = data.rival && data.rival.name ? data.rival : null; data.wall = Array.isArray(data.wall) ? data.wall.slice(0, 8) : []; }
    if (fromVersion < 3) data.boutsSeen = data.best2 > 0 || (data.wall && data.wall.length) || data.feintLesson ? TUNING.hint.bouts : 0;
    return data;
  },
  TUNING,
  experiments: [
    { key: 'control.relative', label: 'Sword control (0 Absolute, 1 Relative)', min: 0, max: 1, step: 1 },
    { key: 'control.gain', label: 'Relative gain', min: 1, max: 2.6, step: 0.1 },
    { key: 'control.lungeStart', label: 'Lunge push (x reach)', min: 1, max: 1.6, step: 0.05 },
    { key: 'offset', label: 'Aim offset, absolute (px)', min: 0, max: 130, step: 5 },
    { key: 'hand.lag', label: 'Hand weight (s)', min: 0.005, max: 0.12, step: 0.005 },
    { key: 'hit.minSpeed', label: 'Min hit speed (px/s)', min: 200, max: 1200, step: 25 },
    { key: 'stamina.regen', label: 'Stamina regen (/s)', min: 10, max: 80, step: 2 },
    { key: 'attack.over.cost', label: 'Overhead cost', min: 5, max: 60, step: 1 },
    { key: 'shield.perfect', label: 'Perfect block window (s)', min: 0.05, max: 0.4, step: 0.01 },
    { key: 'shield.hits', label: 'Shield blocks to break', min: 1, max: 8, step: 1 },
    { key: 'shield.drain', label: 'Shield hold drain (/s)', min: 0, max: 30, step: 1 },
    { key: 'open.dur', label: 'Foe opening (s)', min: 0.3, max: 1.6, step: 0.1 },
    { key: 'swing.windup', label: 'Wind-up (s)', min: 0.4, max: 1.2, step: 0.05 },
    { key: 'counter.windup', label: 'Counter wind-up (s)', min: 0.25, max: 1.0, step: 0.05 },
    { key: 'swing.gap', label: 'Swing interval (s)', min: 0.8, max: 4, step: 0.1 },
    { key: 'dodge.cost', label: 'Dodge cost', min: 5, max: 70, step: 1 },
  ],
  presets: [
    { label: 'Forgiving', values: { ...STD, 'stamina.regen': 45, 'attack.over.cost': 20, 'shield.perfect': 0.25, 'shield.hits': 6, 'shield.drain': 3, 'open.dur': 1.1, 'swing.windup': 0.95, 'swing.gap': 3.2, 'counter.windup': 0.55, 'hit.minSpeed': 400, 'dodge.cost': 12 } },
    { label: 'Standard', values: { ...STD } },
    { label: 'Brutal', values: { ...STD, 'stamina.regen': 22, 'attack.over.cost': 34, 'shield.perfect': 0.1, 'shield.hits': 3, 'shield.drain': 12, 'open.dur': 0.6, 'swing.windup': 0.55, 'swing.gap': 1.3, 'counter.windup': 0.35, 'hit.minSpeed': 600, 'dodge.cost': 28 } },
  ],
  start: 'menu',
  scenes: { menu, roll, play, over },
};
