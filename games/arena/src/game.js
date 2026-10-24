// Arena v2: a two-thumb gladiator duel, side view, in landscape (ADR-0013). You roll a fighter on eight seeded wheels (size, Strength, Speed,
// Stamina, armour, weapon, origin and reason), with one token per run for a Respin there or a Reroll of a draft, then fight a gauntlet of five
// rolled opponents, a sparring partner first and a named champion last; a champion who cuts you down is saved and returns as your rival. The right
// thumb is the weapon arm, moved like a trackpad from wherever it lands: a push is a jab (a jab along a joint slot's slit goes in for the weapon's
// slot multiplier), a sweep is a slash, up then down is an overhead, a long push lunges, and plates and his guard clang and recoil. The left thumb
// raises the shield High, Mid or Low (only the matching zone blocks, a block at the last moment is perfect) and works one big DODGE (tap a backstep, hold to back off).
// The foe plans each exchange with the seeded fight RNG and plays it out with honest tells (chops, thrusts, sweeps, combos, feints, bashes, nets),
// keeps his weapon's range, remembers your habits, and is winded and open when his stamina runs out. After each fell the bout is graded, the crowd's gold counted, and you
// pick one of three seeded cards (four families of rule cards that make and spend Momentum and Bleed; the third is priced in gold), with the armourer's tent once after bout 3.
// One run is one arena, picked on a ladder that opens as each arena's champion falls: the Pit's tight ring, the City's pairs (a second foe waits at the edge
// and steps in when the first is winded or felled), the Colosseum's men and beasts (a lion that crouches and pounces, a bear that rears and mauls, read
// by their bodies), the Grand Games ending on the Emperor's thumb; a crowd meter fills with style and drains on turtling,
// throws the gold as coins, drives Glory's chant and decides the thumb. H is the fighter body unit (screen height x fighter.height, scaled by size); body units have x forward, y down,
// origin at the feet. Particles are the game's own, so a hit-stop freezes them. The section map is docs/games/arena/CODEMAP.md.

import { makeRng, clamp, lerp, ease } from './engine.js';

// ====== TUNING: every tunable number ======
const TUNING = {
  hearts: 3,               // the base for a medium fighter; health is counted in whole hearts, two to the base number (a medium shows 6)
  heal: 1,                 // hearts back for each foe felled
  bouts: 5,                // opponents in the gauntlet
  resetDelay: 0.9,         // seconds after a foe falls before the next intro card
  swayRate: 1.3,           // radians per second of the foe's sway
  // the sword thumb is a trackpad: gain = hand px per thumb px; guard = the hand at touch-down, from the shoulder (H); the lunge starts and is full at
  // these thumb offsets x gain, in arm lengths; back = seconds to ease to guard on lift; jabCone = cosine of the widest push angle off the guard line that is still a jab
  control: { gain: 1.6, guard: [0.38, -0.08], lungeStart: 1.3, lungeFull: 1.7, back: 0.12, jabCone: 0.68 },
  hand: {
    lag: 0.035,            // seconds of weight in the hand
    regrip: 0.12,          // lag while the hand recovers from a bounce
    tiredLag: 2.4,         // lag multiplier at zero stamina
  },
  arm: { len: 0.45, minFrac: 0.35, full: 0.97, chamberAt: 0.16, straightAt: 0.5 },  // arm in H; finger distance (H) at which the arm is chambered and at which it is straight
  blade: { len: 0.36, pad: 5, jabPad: 10, tip: 0.22 },   // gladius length in H, hit pad px, jab tip radius px, fraction of the blade that is the jab tip
  grip: { straight: -0.25, chamber: -0.6, tau: 0.045, trail: 0.018 },  // blade angle from the arm (radians, up is negative), smoothing, trail per rad/s of arm swing
  // body unit as a fraction of screen height, feet line, clear gap between the bodies (fraction of width), half body width in H; fit = the largest scale
  // drawn at full frame: a bigger fighter (a Giant) shrinks the whole frame so his head stays as high as that scale's would, clear of the HUD
  fighter: { height: 0.72, floor: 0.92, gap: 0.2, body: 0.12, fit: 1.15 },
  // stride in H; extra stamina; seconds to step in and back. The drive: a committed lunge held at full depth for driveNear s (driveFar s when the foe stands beyond your plain lunge's reach as it starts) presses on at drive H/s for
  // driveCost stamina/s (and one jab's cost when it starts moving), up to driveMax H past the stride; it reaches full pace over driveRamp s, in stamping steps driveHz a second whose pace swings by
  // driveSurge; the body leans driveLean rad into it, eases back over driveOut s, each stamp kicks driveSand grains; the stamina it burns glows for driveBurn s;
  // each stamp: a thud at driveThud gain, a haptic of driveHaptic, driveDust puffs driveFoot H behind the foot
  lunge: { stride: 0.3, cost: 10, tauIn: 0.06, tauOut: 0.14, drive: 0.6, driveCost: 25, driveMax: 0.3, driveNear: 0.2, driveFar: 0, driveRamp: 0.1, driveHz: 6, driveSurge: 0.55,
    driveLean: 0.13, driveOut: 0.2, driveSand: 8, driveBurn: 0.5,
    driveThud: 0.45, driveHaptic: 6, driveFoot: 0.1, driveDust: 2 },
  lean: { base: 0.03, max: 0.21, beyond: 0.6, span: 0.2, fast: 0.7, tau: 0.06, back: 0.05 },  // radians (max = 12 degrees); aim distance (H) past which a fast slash leans, over span; fast = fraction of hit.mid
  dodge: { dur: 0.35, back: 0.32, hop: 0.1, cost: 12, cool: 0.2, drain: 14 },  // dur: a tap's sidestep; a hold stays back and drains stamina per second
  hit: { minSpeed: 400, mid: 950, cool: 0.2 },   // tip px/s: slash threshold, slash damage 2; seconds before a part can be hit again
  attack: {
    jab: { cost: 8, minSpeed: 520, dmg: 2, recoil: 0.18 },
    slash: { cost: 14, dmg: 1, fastDmg: 2, recoil: 0.5, dents: 1 },
    over: { cost: 20, minSpeed: 750, dmg: 3, recoil: 0.7, dents: 2, raise: 0.2, window: 0.6 },  // raise: hand this far (H) above the shoulder; window: seconds it counts
  },
  stamina: { max: 100, regen: 45, delay: 0.45, tired: 0.5, idleMul: 1.8, exhaust: 1.5 },  // tired: damage multiplier at zero; idleMul: regen when not swinging, blocking or dodging; exhaust: seconds with no swings at zero
  part: { hp: 3 },         // damage a gap part takes before it is disabled
  skin: { glint: 0.16, cutFade: 3.5, maxDpr: 3, gearGlint: 2.8, gearGlintA: 0.55 },  // art only: tip distance (H) at which a slot glints, seconds a cut line takes to fade, sprite pixel-ratio cap, seconds between a worn piece's glints and their brightest alpha
  armour: { dents: 3, kick: 0.6 },
  stun: 1.2,               // seconds the foe is stunned when the head goes
  swing: {
    windup: 0.95,          // base seconds from the first tell to the blow, scaled by the move, weapon, size, Speed and rhythm
    gap: 3.2,              // base seconds between exchanges: gap * 0.6 + up to gapSpread, scaled by the rhythm
    gapSpread: 1.5,
    lunge: 0.22,           // foe steps in this far (H) as the blow lands
  },
  counter: { windup: 0.55 },  // only an overhead clang (or any clang on a shield-bearer) brings a counter
  open: { dur: 1.1 },      // seconds the foe is open after each of his moves
  shield: { dur: 0.6, perfect: 0.25, hits: 6, cool: 0.25, stagger: 1.0, riposte: 1.0, riposteMul: 2, drain: 3, slow: 0.45 },  // drain: stamina per second of hold
  // juice (principle 16). Hit-stops (s) and straw per damage; shake = x every shake, shakeOn = 0 turns shake off (the engine does not expose the system's
  // reduced motion). A slot hit: its hit-stop, sparks and ring (px). A fell: s of slow motion at fellMul game speed, the camera punching in by fellZoom
  // over zoomIn s, dust as he drops (dropAt s after, dropDust motes). A perfect block: its white ring (px) and tiny shake (px). A feint read: the violet
  // burst off him. A lunge: dust at your back foot. A dodge: s of ghost trail, one ghost each ghostEvery s, sand scuff motes. A finisher: s of slow motion
  // at finMul, the banner's s, the war paint's glow s. A Giant (scale giantAt and up) thuds each giantStep H he walks, with a shake (px). Getting hit:
  // your recoil (radians of lean back) and the heart's shatter (s).
  juice: { stop1: 0.04, stop2: 0.07, stop3: 0.1, stopBreak: 0.05, stopClang: 0.03, strawPerDmg: 14, shake: 0.5, shakeOn: 1,
    slotStop: 0.06, slotSpark: 18, slotRing: 34, fellSlow: 1, fellMul: 0.35, fellZoom: 0.06, zoomIn: 0.2, dropAt: 0.35, dropDust: 18,
    perfRing: 150, perfShake: 2, readBurst: 28, lungeDust: 7, ghost: 0.22, ghostEvery: 0.05, scuff: 7, finSlow: 0.35, finMul: 0.4, banner: 0.9, paint: 1.2,
    giantAt: 1.25, giantStep: 0.12, giantShake: 1.5, recoil: 0.14, shatter: 0.6,
    // a beast: its roar on the tell (gain), the sand its pounce sprays from its hind feet (motes), the bear's maul landing (a thud x, a shake px)
    roar: 0.12, sand: 22, maulThud: 1.7, maulShake: 4 },
  foe: { swayX: 0.05, swayDeg: 3, kick: 0.9, hp: 22, tierHp: 0.1, champHp: 1.15, dmgCap: 3, coverShield: 0.2, coverGuard: 0.1 },  // hp scaled by size and tier; dmgCap: most hearts one blow takes; cover radii (H) with and without a shield
  cover: { dur: 3.2, slide: 0.07, jabTol: 0.8 },  // seconds the foe's guard stays on the part you hit; seconds to slide there; radians a jab may stray from the slit's axis
  step: { circle: [-0.05, 0.07], period: 3.4, tau: 0.16, lead: 0.5, dodge: 0.3, dodgeDur: 0.7, dodgeCool: 2.4 },  // footwork (H): a slow drift around his range (period s); lead: seconds before a move he steps to striking distance; his sidestep from a lunge
  // his stamina: base + per Stamina point; costs per move are in moves; block: paid when your blow meets his guard; winded: seconds with guard down at zero; combo: seconds winded after any combo
  foeSta: { base: 40, per: 14, regen: 16, delay: 0.6, block: 8, winded: 1.5, combo: 1.4, windedRegen: 2.5, windedDmg: 1.5 },
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
    // the beasts' moves. pounce: the lion's crouch (at = the tell's share spent crouching, gathering back H as it does), then the spring, at most leap H
    // of ground, landing at its striking distance from you; a pounce that lands pushes you back. swipe: a paw raised, then swung (HIGH or MID). maul: the
    // bear rears up (rear = the tell's share spent rising), then slams down (LOW or MID). shove: the bear's charge, a bash with its shoulder.
    pounce: { wind: 1, cost: 16, dmg: 2, at: 0.72, back: 0.06, leap: 0.34 },
    swipe:  { wind: 0.95, cost: 10, dmg: 1 },
    maul:   { wind: 1, cost: 18, dmg: 2, rear: 0.6 },
    shove:  { wind: 0.75, cost: 14, drain: 26, blocked: 0.4 },
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
  // the five size bands, his and yours: drawn scale, health, extra range (H), damage, windup and footwork multipliers (under 1 is quicker). Each fighter's
  // scale is his band's, varied by up to sizeVary either way (seeded), and every effect follows his scale continuously between the bands' rows.
  sizes: [
    { id: 'runt', name: 'RUNT', scale: 0.75, hp: 0.65, reach: -0.08, dmg: 0.8, wind: 0.8, step: 0.65 },
    { id: 'lean', name: 'LEAN', scale: 0.88, hp: 0.82, reach: -0.04, dmg: 0.9, wind: 0.9, step: 0.82 },
    { id: 'medium', name: 'MEDIUM', scale: 1, hp: 1, reach: 0, dmg: 1, wind: 1, step: 1 },
    { id: 'big', name: 'BIG', scale: 1.16, hp: 1.3, reach: 0.05, dmg: 1.2, wind: 1.12, step: 1.3 },
    { id: 'giant', name: 'GIANT', scale: 1.35, hp: 1.6, reach: 0.1, dmg: 1.4, wind: 1.25, step: 1.5 },
  ],
  sizeVary: 0.04,
  // his stats: points by bout (plus champ for a champion, plus the arena's shift x 3), split by a rolled profile's shares (Strength, Speed, Stamina), each
  // 1 to 5, with jitter (points) of seeded spread before rounding; his weakest stat is held to weak (champWeak for a champion). Each profile's roll weight
  // per size band (runt, lean, medium, big, giant), so a Giant is more often a Brute or a Tank and a Runt a Duelist or a Glass cannon.
  foeStats: { budget: [6, 8, 9, 10, 11], champ: 1, weak: 2, champWeak: 3, jitter: 0.6 },
  profiles: {
    brute: { share: [0.42, 0.16, 0.42], w: [0.4, 0.8, 1, 2, 3] },
    duelist: { share: [0.29, 0.42, 0.29], w: [3, 2, 1, 0.7, 0.4] },
    glass: { share: [0.42, 0.42, 0.16], w: [3, 2, 1, 0.8, 0.5] },
    tank: { share: [0.32, 0.16, 0.52], w: [0.4, 0.8, 1, 2, 3] },
    balanced: { share: [1 / 3, 1 / 3, 1 / 3], w: [1.2, 1.2, 1.5, 1.2, 1] },
  },
  // weapons: home and striking distance (H, beyond the base stance), windup multiplier, damage, drawn length (H), move weights, combo length, shield chance, your stamina drained per block, shield wear per block
  weapons: [
    { id: 'gladius', name: 'GLADIUS', range: 0.12, strike: -0.04, speed: 0.9, dmg: 1, len: 0.3, moves: { chop: 2, thrust: 2, sweep: 1.5, combo: 3, feint: 1.5 }, combo: [2, 3], shield: 0.7, drain: 0, wear: 1 },
    { id: 'spear', name: 'SPEAR', range: 0.34, strike: 0.2, speed: 1, dmg: 1, len: 0.8, moves: { chop: 0.8, thrust: 4, sweep: 2, combo: 1, feint: 1.5 }, combo: [2, 2], shield: 0.5, drain: 0, wear: 1 },
    { id: 'axe', name: 'AXE', alt: 'MACE', range: 0.16, strike: 0, speed: 1.25, dmg: 1.6, len: 0.44, moves: { chop: 4, thrust: 0.4, sweep: 2, combo: 1, feint: 1 }, combo: [2, 2], shield: 0.3, drain: 18, wear: 2 },
    { id: 'dagger', name: 'DAGGER & NET', range: 0.04, strike: -0.16, speed: 0.85, dmg: 0.8, len: 0.17, moves: { chop: 1, thrust: 3, sweep: 1, combo: 2, feint: 2, net: 1.6 }, combo: [2, 3], shield: 0, drain: 0, wear: 1 },
  ],
  // armour sets: plates (min, max), a helmet, joint slots open
  // the beasts (the Colosseum), foes with their own body and moves: no shield, gear, guards or feints. band: its size band (its stats follow TUNING.sizes
  // at its varied scale, its profile rolls with prof's weights); draw: its body unit against a man's (drawn at the band's scale x draw); front, back: its
  // nose and rump from its forepaws (body units); tall: its height against a man's (the frame's fit); range, strike, speed, dmg as a weapon's; wear: shield
  // hits a block takes; moves: weights; zone: a swipe's (lion) or maul's (bear) chance of its first zone (HIGH, LOW); counter: the move it counters with
  beasts: {
    lion: { band: 'big', draw: 1.1, front: 0.26, back: 0.43, tall: 0.62, range: 0.03, strike: -0.15, speed: 0.8, dmg: 1, wear: 1, moves: { pounce: 2, swipe: 3 }, zone: 0.5, counter: 'swipe',
      prof: { brute: 0.3, duelist: 3, glass: 3, tank: 0.3, balanced: 1 } },
    bear: { band: 'giant', draw: 0.92, front: 0.28, back: 0.37, tall: 0.8, range: -0.05, strike: -0.22, speed: 1.2, dmg: 1.15, wear: 2, moves: { maul: 3, shove: 1.4 }, zone: 0.5, counter: 'shove',
      prof: { brute: 3, duelist: 0.2, glass: 0.2, tank: 3, balanced: 1 } },
  },
  // a beast's bout: the frame shrinks (never under min) until the beast, at its home plus room H, needs the frame to slide left by at most slide H
  beastFit: { room: 0.1, slide: 0.1, min: 0.7 },
  // a young beast (the Colosseum's arenas.rome.young bouts): its band this many steps smaller than its kind's, drawn at that size, its stats following that band
  beastYoung: 1,
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
  // your rolled fighter. Wheels: [value, weight, tier name]. Per size band: arm reach multiplier, hearts, hand lag (swing speed) multiplier and tier score
  // (your scale and damage follow TUNING.sizes, like his). Per stat value 1-5: Strength damage, Speed hand lag / recoil and dodge length, Stamina bar and regen.
  // Armour: plates on head/chest/legs (+ shield arm), stamina regen.
  me: {
    wheels: {
      size: [['runt', 7, 'Runt'], ['lean', 22, 'Lean'], ['medium', 38, 'Medium'], ['big', 25, 'Big'], ['giant', 8, 'Giant']],
      stat: [[1, 8, 'Feeble'], [2, 20, 'Fair'], [3, 34, 'Solid'], [4, 26, 'Strong'], [5, 12, 'Mighty']],  // the B-tier wheel; statTiers holds every tier's weights
      armour: [['light', 35, 'Light'], ['medium', 45, 'Medium'], ['heavy', 20, 'Heavy']],
      // the ludus's slices (LUDUS_LOCK) come last, and weigh nothing until they are bought, so a seed rolls as it did before them
      weapon: [['gladius', 35, 'Gladius', 'GL'], ['spear', 25, 'Spear', 'SP'], ['axe', 20, 'Axe/mace', 'AX'], ['dagger', 20, 'Dagger', 'DG'], ['trident', 20, 'Trident', 'TR'], ['sica', 20, 'Sica', 'SI']],
      // flavour only: [value, weight, name, wheel label]
      origin: [['gaul', 1, 'Gaul', 'GA'], ['thrace', 1, 'Thrace', 'TH'], ['numidia', 1, 'Numidia', 'NU'], ['capua', 1, 'Capua', 'CA'], ['ostia', 1, 'Ostia', 'OS'], ['alexandria', 1, 'Alexandria', 'AL'],
        ['sparta', 1, 'Sparta', 'SP'], ['egypt', 1, 'Egypt', 'EG'], ['circus', 1, 'Circus', 'CI']],
      reason: [['freedom', 1, 'Freedom', 'F'], ['debt', 1, 'Debt', 'D'], ['revenge', 1, 'Revenge', 'R'], ['glory', 1, 'Glory', 'G'], ['promise', 1, 'A promise', 'P']],
    },
    // the stat wheels' named tiers (L8): each tier's weights over Feeble to Mighty. A wheel starts at B; your band tilts it (steps per stat: Strength,
    // Speed, Stamina; up is toward S) and the stat wheel before it shifts it by chain[its result - 1]; the sum stays within D to S.
    statTiers: { S: [3, 8, 24, 37, 28], A: [5, 13, 32, 32, 18], B: [8, 20, 34, 26, 12], C: [14, 30, 34, 16, 6], D: [24, 36, 26, 10, 4] },
    tierOrder: ['D', 'C', 'B', 'A', 'S'],
    tilt: { runt: [-1, 1, 0], lean: [0, 1, 0], medium: [0, 0, 0], big: [1, 0, 0], giant: [1, -1, 0] },
    chain: [1, 1, 0, -1, -1],
    rare: { size: ['runt', 'giant'], stat: [1, 5] },  // the slivers that burst and make the crowd ooh
    // the roll scene, per wheel (s): the slices reshape (shape, or wait when nothing changed), the spin (turns, and the share of it before the last-peg
    // tease), the hold on the answer; the card's spin on a respin (spin); the tease's peg margin and settle (fraction across the landed slice, radians)
    roll: { shape: 0.5, wait: 0.25, spin: 1.15, turns: 2.6, main: 0.8, hold: 0.5, settle: 0.32, peg: 0.05, tickGap: 0.025 },
    spin: 0.8, turns: 2.5,  // a respin on the card: seconds and turns
    sizes: {
      runt: { name: 'RUNT', arm: 0.9, hearts: 2, lag: 0.75, score: 0 },
      lean: { name: 'LEAN', arm: 0.95, hearts: 2.5, lag: 0.85, score: 0.25 },
      medium: { name: 'MEDIUM', arm: 1, hearts: 3, lag: 1, score: 0.5 },
      big: { name: 'BIG', arm: 1.05, hearts: 3.5, lag: 1.15, score: 0.75 },
      giant: { name: 'GIANT', arm: 1.1, hearts: 4.5, lag: 1.3, score: 1 },
    },
    str: [0.75, 0.9, 1, 1.15, 1.3],
    spdLag: [1.35, 1.15, 1, 0.88, 0.76], spdDodge: [0.8, 0.9, 1, 1.12, 1.25],
    staMax: [70, 85, 100, 115, 130], staRegen: [0.8, 0.9, 1, 1.1, 1.2],
    armour: {
      light: { name: 'LIGHT', n: 1, regen: 1, score: 0 },
      medium: { name: 'MEDIUM', n: 2, regen: 0.92, score: 0.5 },
      heavy: { name: 'HEAVY', n: 3, regen: 0.82, score: 1, arm: true },
    },
    plateDiv: 2,                          // a hit on a plated part costs the hit divided by this, rounded up, so never part of a heart
    tiers: [['S', 13], ['A', 11], ['B', 9], ['C', 7], ['D', -1]],  // score = STR + SPD + STA + size + armour
    underdog: 7, underdogHalves: 1,       // a score below this gets +1 heart
    heartsPerBase: 2,                     // a size's base hearts times this is its whole hearts (a medium's 3 shows 6)
    // your weapon: reach = blade length, speed divides hand lag and recoil, dmg and cost multiply every blow, slash multiplies slash damage,
    // slot = slot-hit multiplier, slotDmg = what multiplies a slot hit in place of dmg (the dagger's slot hits are 4x a bare jab, so 1.33x the gladius's),
    // overBreak = dents at which an overhead breaks a plate (0: the usual armour.dents), mace = chance an axe is a mace
    weapons: {
      gladius: { name: 'GLADIUS', reach: 1, speed: 1, dmg: 1, cost: 1, slash: 1, slot: 3, slotDmg: 1, overBreak: 0 },
      spear: { name: 'SPEAR', reach: 1.35, speed: 0.85, dmg: 1, cost: 1, slash: 0.6, slot: 3, slotDmg: 1, overBreak: 0 },
      axe: { name: 'AXE', alt: 'MACE', reach: 0.9, speed: 0.75, dmg: 1.7, cost: 1.4, slash: 1, slot: 3, slotDmg: 1.7, overBreak: 2 },
      dagger: { name: 'DAGGER', reach: 0.65, speed: 1.4, dmg: 0.75, cost: 1, slash: 1, slot: 4, slotDmg: 1, overBreak: 0 },
      // the ludus's armoury (len: the length drawn on your card, H). The trident: the longest reach and the slowest hand, weak slashes, its net cast by
      // your first perfect block each bout (net). The sica: short and quick, its curved edge makes every slash cut deep.
      trident: { name: 'TRIDENT & NET', reach: 1.5, speed: 0.8, dmg: 1, cost: 1.1, slash: 0.5, slot: 3, slotDmg: 1.15, overBreak: 0, net: true, len: 0.8 },
      sica: { name: 'SICA', reach: 0.8, speed: 1.2, dmg: 1, cost: 1, slash: 1.6, slot: 3, slotDmg: 1, overBreak: 0, len: 0.3 },
    },
    mace: 0.5,
    // your net (the trident): it holds him dur s, his wind-ups wind x longer, his footwork at step x its speed
    net: { dur: 3, wind: 0.3, step: 0.5 },
  },
  // fame, kept for good (E): a champion felled, an arena's first clear, the Emperor's thumbs up, bout fame for every bout won (a lost run too), and 1 for each goldPer gold left when a run ends
  fame: { champ: 10, clear: 25, thumbUp: 10, goldPer: 50, bout: 3 },
  // Brutus's ludus: each unlock's price in fame; the Wall of Champions keeps the newest wallMax fighters; a veteran gains vetUp on one stat
  ludus: { price: { trident: 30, sica: 30, sparta: 25, egypt: 25, circus: 25, trick: 40, show: 40, slot: 60, fourth: 50, promise: 30, crest: 15, plume: 15, paint: 15, cloak: 20 },
    wallMax: 30, vetUp: 1, vetCap: 4, dot: { r: 6, inset: 9 }, rowBase: 38, rowLine: 17, rowMin: 72, rowLines: 5, hubLines: 5, hubIcon: 36 },  // rowBase + rowLine x lines is an item's row height on a station page (at least rowMin, at most rowLines lines); the courtyard card's line shows hubLines lines, its icon hubIcon at least
  // your own feint (the Trickster's enabler). With the Feint worn a lunge commits, and only then does what its blade met land, once the thumb has stayed
  // within slack (arm lengths of hand travel) of its furthest reach for settle s, or hold s after it began. A lunge
  // pulled back under the lunge's start with the thumb still down before it commits, having reached depth of a full lunge and touched nothing, no sooner than
  // minAge s after it began (a quicker flick is a poke, and a blade that met him always lands), is a feint: he guards the zone the tip threatened (high above high, low below low, in his body units) and the gap farthest from it opens for open s; it costs cost stamina. With his
  // memory, a feint after learn others within learnWin s is read. The stab it withdrew is refunded, and for recover s after it the hand's motion is no blow.
  myFeint: { settle: 0.08, slack: 0.08, hold: 0.3, depth: 0.25, minAge: 0.12, recover: 0.25, open: 0.6, cost: 4, learn: 3, learnWin: 12, high: -0.7, low: -0.42 },
  // a Flourish: the sword thumb's heading turns turn radians one way within win s, moving at speed px/s or more (one fast circle), at most once each cool s
  flourish: { speed: 150, turn: 6, win: 0.9, cool: 2.5 },
  // the reason's thread: the debt in denarii and what each fell knocks off it; the crowd's chant (one clap, and one more per share of the crowd meter, up to
  // max, louder with each: gain base + step x claps beyond the first)
  story: { debt: 1000, debtPer: 200, chant: { gain: 0.08, step: 0.04, gap: 0.24, max: 5 } },
  // the one token per run: a Respin on your fighter card or a Reroll on a draft
  token: 1,
  hint: { bouts: 2, dur: 10, heartDur: 6, driveDur: 6, hudDur: 8 },  // the in-play hint shows in this many bouts ever, for this many seconds of each; heartDur, driveDur: the heart hint after your first fell, the drive hint after your first missed lunge
  // your hearts on the HUD, one for each point of health: heart = spacing and size (px), perRow = most in a row (more start a second row), rowGap = px a second row pushes the rows below it down
  hud: { heart: 19, size: 17, perRow: 9, rowGap: 18, bout: 17, crowdH: 15, crowdW: 0.82 },  // bout: the BOUT line's size; crowdH, crowdW: the crowd bar's height and its share of the left strip
  // footwork, in H. Yours: a tap of DODGE is the backstep (back x your Speed's dodge length), holding it keeps backing off at walkBack; a lunge's recovery
  // takes back up to pace of the ground you gave, over gainDur s, never past your mark; drift: idle for idle s (no swing, dodge or lunge) you drift back a pace per secs s. Speeds are H per second. close: nearest clear gap between the bodies.
  // room: the most each fighter can give ground before the wall (yours, his), trimmed to the screen; margin: px kept clear at the screen edge.
  // His: walk speed (x Speed and size), commit = speed share while winding up, reach = how far past his striking distance a blow still lands, push = a pace share.
// He commits only with your body (feet plus lunge) inside his striking distance plus reach. A blow that then falls short counts as your dodge when your body gave
// at least give H during his tell. After a lunge launched from beyond his reach he chases for chase s at chaseV x his walk, and strikes within chaseSwing s.
  // the left column: width as a fraction of screen width (never under minW), gap between buttons, top of the column below the safe top, DODGE height (fraction of screen height, never under dodgeMinH), touch reach past a drawn edge, and how much of the way the fighters' frame slides toward the middle of the space the column leaves
  col: { frac: 0.22, minW: 96, gap: 6, top: 70, dodgeFrac: 0.17, dodgeMinH: 64, reach: 8, frame: 0.75 },
  foot: { pace: 0.14, drift: { idle: 0.6, secs: 1.5 }, gainDur: 0.16, back: 0.2, walkBack: 0.42, close: 0.1, room: [0.6, 0.7], margin: 22, foeV: 0.75, commit: 0.3, reach: 0.12, push: 0.5, wallMsg: 0.9, give: 0.02, chase: 1.0, chaseV: 1.6, chaseSwing: 0.5 },
  // the bout's grade: each grade allows up to `taken` hits this bout (a pair bout allows `pair` more) with at least `good` good moves (gap hits, fakes read,
  // punishes, perfect blocks, swings dodged, limbs lamed)
  grade: { S: { taken: 0, good: 5 }, A: { taken: 2, good: 5 }, B: { taken: 4, good: 2 }, pair: 1 },
  // the draft: cards dealt (the last is priced), weights per grade for the free cards (common, rare), the pull on a family you wear, at most perFam cards of
  // one family a draft; the priced slot's cascade, each tier's own chance (a set bonus you qualify for, else a legendary, else an epic, else a rare);
  // prices by rarity (common, rare, epic, legendary) and a set's; delay before a pick counts (s)
  draft: { deal: 3, odds: { S: [20, 80], A: [35, 65], B: [55, 45], C: [75, 25] }, pull: 3, perFam: 2, cascade: { set: 0.6, legend: 0.15, epic: 0.3 }, price: [0, 30, 45, 60], duoPrice: 50, delay: 0.45 },
  // gold, per run: a fell, each feint read, perfect block and slot hit in the bout, and a bout with no hits taken
  gold: { fell: 20, read: 4, perfect: 2, slot: 2, clean: 15 },
  // the armourer's tent, once a run after bout `after`: big wares and cheap ones (the old commons) shown, each ware's price; forge = your weapon's damage x
  tent: { after: 3, big: 2, small: 1, forge: 1.25, heart: 2,
    price: { plate: 40, whet: 50, heart: 35, token: 25, forge: 60, hide: 15, wind: 15, wrist: 12, steady: 12, grip: 12, feet: 15, deepbreath: 15, edge: 20, tough: 15, stance: 12 } },
  // card effects. The tent's old commons: half hearts, multipliers, bare-hit damage, shield hits. The Wall: shove = paces a perfect block drives him, shoveStun = s stunned
  // at his wall, thorns = blocks that disarm him, thornsDur = s disarmed. Blood: bleed stacks per hit, vein = his wind-up x while he bleeds, bloodlust = stamina per stack
  // per tick, cruel = slot damage per stack. Dancer: sidestep = s winded, matador = s stunned, slip = jab x within slipWin s of a tell dodge, untouch = s all slots open.
  // Brute: heavy = smash dents x, brawler = Momentum per broken plate, jugg = blow cost x while lunging (rounded up), titan = hearts. Duos: cape = every nth stuns for capeStun s,
  // butcher = stacks per broken plate, spiked = stacks per perfect block, hamWin = s after a tell dodge. fist = most hearts a disarmed blow takes. braced = Momentum per block that is not well-timed.
  // Trickster: misdir = slot hit x through your feint's opening, mind = extra pips per feint read, bait = his next blow's tell x after you drop a shield held
  // baitHold s (for baitWin s), bluff = s every slot opens after two feints within bluffWin s, puppet = every nth move of his is a feint, puppetHearts = the
  // most hearts you keep. Showman: flourish = favour, showboat = drains x, play = perfect block and read favour x, bread = hearts thrown at breadAt
  // favour (once a bout), encore = pips off a finisher at the top third, pleaser = slot hit x at the top third (it spends pleaserCost favour), aweAt =
  // favour at which he stands in awe for awe s before each exchange, darlingGold = the crowd's gold x. Duos: sucker = s after your feint an overhead staggers,
  // bloodSport = favour per stack per tick, salute = s every slot opens on a perfect block at the top third.
  cards: {
    hide: 1, wind: 1.2, wrist: 0.8, steady: 0.75, grip: 1.2, feet: 1.25, deepbreath: 1.2, edge: 1, tough: 2,
    shove: 2, shoveStun: 1, thorns: 3, thornsDur: 4,
    serrated: 1, rend: 1, vein: 1.2, bloodlust: 2, cruel: 1,
    sidestep: 1, matador: 1, slip: 2, slipWin: 1, untouch: 1,
    heavy: 2, brawler: 2, jugg: 0.5, titan: 4,
    misdir: 2, mind: 1, bait: 2, baitHold: 0.5, baitWin: 3, bluff: 1, bluffWin: 1.5, puppet: 3, puppetHearts: 4,
    flourish: 6, showboat: 0.5, play: 2, bread: 2, breadAt: 80, breadCoins: 3, mulMax: 4, encore: 1, pleaser: 3, pleaserCost: 30, aweAt: 90, awe: 0.7, darlingGold: 0.5,
    cape: 2, capeStun: 1, butcher: 2, spiked: 1, hamWin: 1, sucker: 1.2, bloodSport: 0.5, salute: 1,
    fist: 1, braced: 1,
  },
  // finishers: Momentum each costs; Execute works below this share of his health; Disarm's seconds; False Opening's winding (s); Showstopper's favour and awe (s)
  fin: { exec: 3, whirl: 2, breath: 2, disarm: 4, falseop: 3, showstop: 3, below: 0.5, disarmDur: 3, beastStun: 1, falseWind: 1.5, showFav: 30, showAwe: 1.5 },  // beastStun: a beast has no weapon, so a disarm stuns it this long
  // Momentum pips, per bout: the most you hold, what each event gives (a perfect block, a feint read, a dodge in his tell, a laming);
  mom: { max: 5, perfect: 1, read: 1, dodge: 1, lame: 1, hintDur: 6 },
  // the finisher button, bottom right: its body w x h px (an arrow chip of arrow px joins it when two are ready), the touch area's extra px, and the first-time
  // hint's seconds on screen (it is shown once ever, stored in the save)
  finBtn: { w: 140, h: 50, arrow: 44, reach: 6, hintDur: 7 },
  // bleed on him: at most max stacks, each lasting dur s; every tick s each stack deals dmg
  bleed: { max: 5, dur: 6, tick: 1, dmg: 0.5 },
  // his gear (from the deck, one piece a slot): pieces per bout, the highest rarity each bout deals (a champion also wears one legendary). Six pieces act for
  // him: Thorns (a blow on his guard costs you thorns stamina), Bloodlust (his blow that lands gives him bloodlust stamina), Riposte (he counters a blow off
  // his guard), Unbreakable (he shrugs off your first hit each bout), the Dark Hood (he feints hood x as often) and the Eye Amulet (his memory works from
  // his first bout); the rest are a look and a warning
  foeGear: { n: [0, 1, 1, 2, 3], rar: [0, 1, 1, 2, 2], thorns: 8, bloodlust: 15, hood: 2 },
  // his gap guards: per bout, the chance of one, then of a second; each gap's weight (the gorget the most common); the gaps always left open
  guard: { one: [0, 0.35, 0.5, 0.65, 1], two: [0, 0.15, 0.25, 0.35, 0.4], w: { 'slot-neck': 4, 'slot-armpit': 1.5, 'slot-waist': 1.5, 'slot-elbow': 1.5, 'slot-knee': 1.5 }, open: 2 },
  // crippling him: a lamed sword arm lengthens his wind-ups by arm; a lamed shield arm makes his cover slide cover x slower; lamed legs walk at legs x.
  // A beast: a lamed foreleg lengthens its wind-ups by arm; either leg lamed lengthens its pounce or charge's tell by pounce and its leap to legs x
  lame: { arm: 0.2, cover: 2.5, legs: 0.55, pounce: 0.25 },
  // each arena's foes: shift = stat levels added to every bout's centre, feint = x his feint weight, guard = added to the chance of a first and a second
  // gap guard (never in bout 1), gear = pieces added to each foe's; ring = x the distance to both walls; pairs = the bout index (0-based) pairs start at
  arenas: {
    pit: { shift: 0, feint: 1, guard: [0, 0], gear: 0, ring: 0.7, pairs: 99 },
    city: { shift: 0.4, feint: 1.15, guard: [0.1, 0.05], gear: 0, ring: 1, pairs: 2 },
    rome: { shift: 0.7, feint: 1.25, guard: [0.15, 0.1], gear: 1, ring: 1, pairs: 99, beasts: [1, 3], young: [1] },  // beasts: the bouts (0-based) a beast fights; young: those of them that bring a young one
    games: { shift: 0.9, feint: 1.35, guard: [0.2, 0.1], gear: 1, ring: 1, pairs: 99 },
  },
  // the City's pairs: the waiting foe drawn at scale x his size and alpha, his centre x from the screen's edge (in his H), his body's half width (body, in his H);
  // the fighters' frame slides left until the one fighting stays clear of him (room = H his wall gives the one fighting past his mark, fbody = his half width in
  // his H); taunt = s his bubble shows before he steps in; enter = s before the one who steps in may swing; hp = x each pair foe's health
  pairs: { scale: 0.6, alpha: 0.6, x: 0.3, body: 0.2, room: 0.1, fbody: 0.22, taunt: 0.5, enter: 1.2, hp: 1, beastScale: 0.6, heal: 2 },  // beastScale: the waiting one's scale when a beast is in the pair; heal = hearts back when the first of a pair falls
  // the crowd's favour, 0 to max, carried through the run: what each style event gives (a feint read, a perfect block, a slot hit, a laming, a bout with
  // no hits taken, two of your hits within comboWin s, a finisher), what turtling (his turtle read's measure) and backing off with no blow coming drain
  // per second; with nothing stylish for idle s the meter drains drain of itself per second (0.03: a high meter eases down, a low one barely moves); coins arc in from the stands at each step of favour; the Emperor's
  // thumb reads the average of the meter over the champion's bout, by thirds (bands)
  crowd: { max: 100, read: 5, perfect: 2.5, slot: 2.5, lame: 2.5, clean: 5, combo: 1, fin: 1, comboWin: 1, turtle: 4, back: 6, idle: 3, drain: 0.02, pay: 0.5, hintDur: 6, step: 20, coins: 5, coinCap: 15, bands: [1 / 3, 2 / 3] },
  // the Colosseum's champions: Carpophorus sends in his lion when his health falls to send x his own; Mevia's spear also throws a net (its weight)
  champs: { carpophorus: { send: 0.5 }, mevia: { net: 2.4 } },
  // the Emperor's thumb card: s the box takes to show, then the hand to rise, then the thumb to turn; s before a tap continues
  thumb: { box: 0.6, hand: 0.8, turn: 0.4, tap: 2.2 },
  // Step 6, the art (ADR-0020, ADR-0021). Backdrops: each arena's image covers the screen behind the fighters, under a dark wash (alpha over the whole
  // screen, then a band from band H above the floor down to the floor at bandA), so the fighters and their tells read first. Portraits: face = the px of
  // a speaker's face beside his line (big for a headline), crop = the face's box in a portrait (fractions x0 y0 x1 y1), bust = a champion's on his card
  // (w, h px, gap from the card's corner), box = the Emperor's crop in the imperial box.
  art: { wash: 0.28, band: 1.15, bandA: 0.32, face: 30, faceBig: 40, faceCard: 26, gap: 4, cardDrop: 8, crop: [0.2, 0.02, 0.78, 0.46], bust: [60, 80, 10], epi: [96, 128], box: [0, 0.02, 1, 0.62] },
  // The painted cut-out kit (dev-only pilot, a switch on the ART screen): Strength picks the muscle tier (lean up to lean, avg up to avg, the muscular
  // parts above). Each part's joint centres a and b in its PNG (px of size; a tier's image is scaled by its own size), measured from the alpha, and w = the
  // px across it that spans the rig's width (the part's hit width, so the drawn shape stays the hitbox). The torso runs from neck to belt (body units)
  // and is cut at cut between the chest and belly sprites; the head maps its top and chin to head (body units, about the head circle); far = the
  // shade of the far arm and leg; arm = your live arms' width (H).
  kit: {
    tier: { lean: 2, avg: 3 }, leg: 0.085, sw: [140, 44],
    // a card's painted figure: its sprite's box (body units, feet at 0), room for a crest above and the sandals below
    iconBox: [-0.45, -1.2, 0.45, 0.12],
    // A part whose image comes on a wider canvas (the muscular torso and shin, HANDOFF-arena-kit-muscle) uses its wide joints, pinned by the top axis;
    // k = how much wider that painted torso is than the others (the chest plate widens with it).
    torso: { size: [384, 512], a: [178, 0], b: [178, 298], w: 291, k: 1, wide: { size: [488, 512], a: [228, 0], b: [228, 298], w: 291, k: 1.3 } },
    upperarm: { size: [160, 320], a: [80, 45], b: [66, 296], w: 97 },
    forearm: { size: [160, 320], a: [86, 38], b: [75, 285], w: 97 },
    thigh: { size: [192, 352], a: [100, 60], b: [94, 333], w: 88 },
    shin: { size: [192, 384], a: [62, 45], b: [58, 322], w: 88, wide: { size: [272, 384], a: [103, 45], b: [99, 322], w: 88 } },
    head: { size: [256, 256], a: [128, 0], b: [128, 222] },
    // Step 6b, the painted gear (Pack 19), each piece's joints in its own PNG: a helmet's top and chin line (a closed one hides the head under it); the
    // chest plate from the neck to the belt (abs: the row the belly's plate starts at; w: the px across that spans the torso); the manica from the elbow
    // to `to` of the forearm, the greave from `from` to `to` of the shin, the wrap down the thigh; the galerus's box in the shield arm's frame (H); a
    // shield's rim radius r or, for the scutum, its half height h (px), drawn at the drawn shield's size.
    // Step 6c: each helmet's a and b pin it to the head's top and chin scaled to cover the painted head (the bowl over the hair, the brim wider
    // than the skull, an open helmet's brim at the brow so the face shows under it), measured on the head drawn under it.
    helm: {
      gallic: { size: [256, 256], a: [126, 55], b: [126, 226] },
      murmillo: { size: [256, 256], a: [130, 48], b: [130, 232], closed: true },
      thraex: { size: [256, 256], a: [120, 52], b: [120, 238], closed: true },
      secutor: { size: [256, 256], a: [131, 10], b: [131, 232], closed: true },
    },
    plate: { size: [320, 320], a: [160, 0], b: [160, 300], w: 270, abs: 150, flip: true },
    // Step 6e: a guarded gap on a painted man is shut by a band of the chest plate's riveted rim: its centre column and rows (px of plate.size)
    guard: { x: 160, y: [284, 312] },
    manica: { size: [160, 320], a: [72, 10], b: [60, 305], w: 125, to: 0.86 },
    greave: { size: [192, 384], a: [97, 10], b: [105, 350], w: 105, from: 0.05, to: 0.95 },
    wrap: { size: [192, 352], a: [92, 30], b: [86, 330], w: 114 },
    galerus: { size: [192, 256], box: [-0.105, -0.17, 0.045, 0.03] },
    shields: { round: { size: [320, 320], r: 160 }, parma: { size: [224, 224], r: 112 }, scutum: { size: [224, 448], h: 224 } },
    neck: -0.745, belt: -0.49, cut: -0.51, top: -0.9, chin: -0.71, far: 0.22, arm: 0.075, shArm: 0.07,
    // your painted shield: a scutum's half height and half width per its rim radius r
    tall: [1.2, 0.6],
    // your sword arm's halves are mirrored only past this much elbow bend (the elbow's offset per upper arm length) or hilt angle (its sine across the
    // forearm), so they never flicker when straight
    flip: [0.08, 0.2],
    // a part drawn live each frame is drawn from a copy this many times its size on screen (headroom for the rig's stretch, little to downscale)
    live: 1.25,
    // Step 6c, a stopgap until the one-segment parts (`<name>-seg`, Pack 20, drawn whole with the part's joints) land: each delivered upper
    // segment shows a whole limb, so it is drawn cropped to its own segment, by its file: a the shoulder or hip, b the elbow or knee (pinned to
    // the rig's), clip the last row drawn (just above the knee cap; just under the elbow crease, under the forearm's top). A beast's are in
    // TUNING.beastArt.crop.
    crop: {
      'kit-base-upperarm-A': { a: [80, 45], b: [75, 170], clip: 176 }, 'kit-base-upperarm-B': { a: [80, 45], b: [80, 172], clip: 178 },
      'kit-base-upperarm-avg-A': { a: [81, 45], b: [89, 176], clip: 182 }, 'kit-base-upperarm-lean-A': { a: [81, 45], b: [86, 174], clip: 180 },
      'kit-base-upperarm-lean-B': { a: [80, 45], b: [84, 148], clip: 154 },
      'kit-base-thigh-A': { a: [100, 60], b: [101, 205], clip: 192 }, 'kit-base-thigh-B': { a: [100, 60], b: [100, 190], clip: 178 },
      'kit-base-thigh-avg-A': { a: [100, 60], b: [98, 200], clip: 188 }, 'kit-base-thigh-lean-A': { a: [100, 60], b: [100, 192], clip: 180 },
      'kit-base-thigh-lean-B': { a: [95, 60], b: [89, 194], clip: 184 },
      // the muscular torso is painted with both upper arms hanging at its sides: below row trim[0] only columns trim[1] to trim[2] are drawn
      'kit-base-torso-A': { trim: [150, 100, 335] },
      // Step 6e: these torsos are painted turned to their left (the sternum and neck left of centre, the right flank showing), against the head
      // and limbs painted facing right, so they are drawn mirrored to face where the head faces
      'kit-base-torso-B': { flip: true }, 'kit-base-torso-lean-A': { flip: true }, 'kit-base-torso-lean-B': { flip: true }, 'kit-base-torso-avg-A': { flip: true },
      // Step 6c-2, the Pack 20 one-segment parts, drawn whole: a the shoulder or hip, b the elbow or knee (their ends run on under the forearm's or
      // shin's top), w the px across that spans the rig's width
      'kit-base-upperarm-seg-A': { a: [107, 50], b: [30, 294] }, 'kit-base-upperarm-lean-seg-A': { a: [82, 45], b: [31, 294] },
      'kit-base-upperarm-avg-seg-A': { a: [84, 48], b: [56, 294], w: 135 },
      'kit-base-thigh-seg-A': { a: [96, 60], b: [105, 335] }, 'kit-base-thigh-lean-seg-A': { a: [94, 60], b: [98, 335] },
      'kit-base-thigh-avg-seg-A': { a: [97, 60], b: [108, 335] },
    },
    // Step 6c-2, the card gear painted (Pack 20, `gear-<name>`), each piece's pins in its own PNG: a and b land on the rig's points at, w = the px
    // across that spans the part's width (none: drawn in its own shape). arms: at = two heights in the arm's frame (H from the shoulder: the forearm
    // runs from ARM_LEN / 2 to the fist at ARM_LEN), so they follow your live arm too (up: there it sits upright on the shoulder, as the drawn one);
    // helmet: a and b the head's top and chin, as a helmet (helm: it covers the skull and stands in for a plated head's painted helmet); chest: at =
    // x, then the top and bottom height (body units; flip: painted turned to his left, so mirrored to face where his head faces); legs: at = fractions from the knee to the ankle (flip: painted facing left); belt: at = x0, x1
    // and the height of the waist; cloak: at = the shoulder point, the hem point and the width (body units), behind the body; shield: its rim radius
    // r or, for the tower, its half height h. bare: on an unplated part of his, a piece that would read as a plate shows only its rows above this
    // one (a helmet's crest or horns, a cuirass's collar and straps), so you never aim at a plate that is not there; yours is worn whole.
    gear: {
      'gear-bronze-bracers': { size: [160, 160], a: [80, 22], b: [80, 138], w: 160, at: [0.19, 0.265] },
      'gear-barbed-bracers': { size: [160, 160], a: [90, 22], b: [82, 150], w: 130, at: [0.19, 0.27] },
      'gear-matador-ribbons': { size: [160, 240], a: [88, 20], b: [88, 100], w: 90, at: [0.2, 0.25] },
      'gear-knife-bracers': { size: [160, 160], a: [0, 88], b: [160, 88], w: 100, at: [0.19, 0.27] },
      'gear-gilt-armlets': { size: [160, 160], a: [80, 22], b: [80, 138], w: 160, at: [0.19, 0.265] },
      'gear-iron-pauldrons': { size: [224, 192], a: [105, 5], b: [105, 185], w: 180, at: [-0.055, 0.05], up: true },
      'gear-bronze-crest': { size: [256, 256], a: [120, 30], b: [120, 235], helm: true, bare: 85 },
      'gear-blood-band': { size: [256, 256], a: [140, -20], b: [140, 250] },
      'gear-ribbon-band': { size: [256, 256], a: [130, 0], b: [130, 280] },
      'gear-horned-cap': { size: [256, 256], a: [130, 55], b: [130, 285], helm: true, bare: 95 },
      'gear-dark-hood': { size: [256, 256], a: [130, 20], b: [130, 225] },
      'gear-plumed-helm': { size: [256, 256], a: [125, 50], b: [125, 240], helm: true, bare: 95 },
      'gear-bronze-phalerae': { size: [384, 384], a: [160, 25], b: [160, 375], w: 300, at: [0, -0.745, -0.49], bare: 70, flip: true },
      'gear-ghost-silk': { size: [384, 384], a: [200, 0], b: [200, 384], w: 380, at: [0, -0.74, -0.45] },
      'gear-black-plate': { size: [384, 384], a: [190, 12], b: [190, 372], w: 300, at: [0, -0.745, -0.48], bare: 95, flip: true },
      'gear-eye-amulet': { size: [128, 160], a: [64, 0], b: [64, 160], at: [0.03, -0.745, -0.6] },
      'gear-gilded-harness': { size: [384, 384], a: [192, 20], b: [192, 355], w: 340, at: [0, -0.745, -0.49], flip: true },
      'gear-bronze-boots': { size: [192, 384], a: [62, 82], b: [58, 262], at: [0.38, 1] },
      'gear-dancers-sandals': { size: [192, 384], a: [62, 55], b: [66, 288], at: [0.1, 1] },
      'gear-spiked-boots': { size: [192, 384], a: [48, 88], b: [50, 262], at: [0.35, 1] },
      'gear-soft-boots': { size: [192, 384], a: [130, 95], b: [120, 265], at: [0.35, 1], flip: true },
      'gear-gilded-greaves': { size: [192, 384], a: [95, 22], b: [100, 365], w: 135, at: [0.02, 0.97] },
      'gear-hook-belt': { size: [384, 96], a: [118, 18], b: [266, 18], at: [-0.11, 0.11, -0.48] },
      'gear-ribbon-sash': { size: [384, 96], a: [112, 18], b: [272, 18], at: [-0.11, 0.11, -0.48] },
      'gear-chain-belt': { size: [384, 96], a: [0, 40], b: [384, 40], at: [-0.115, 0.115, -0.47] },
      'gear-coin-belt': { size: [384, 96], a: [0, 15], b: [384, 15], at: [-0.115, 0.115, -0.48] },
      'gear-wolf-pelt': { size: [384, 512], a: [192, 10], b: [192, 480], w: 384, at: [-0.05, -0.74, -0.13, -0.2, 0.26] },
      'gear-flowing-cape': { size: [384, 512], a: [192, 20], b: [192, 500], w: 384, at: [-0.05, -0.73, -0.14, -0.08, 0.27] },
      'gear-puppeteers-mantle': { size: [384, 512], a: [192, 40], b: [192, 500], w: 384, at: [-0.05, -0.72, -0.13, -0.12, 0.27] },
      'gear-purple-cloak': { size: [384, 512], a: [192, 20], b: [192, 500], w: 384, at: [-0.05, -0.73, -0.14, -0.08, 0.27] },
      'gear-lion-pelt': { size: [384, 512], a: [192, 10], b: [192, 480], w: 384, at: [-0.05, -0.74, -0.13, -0.2, 0.26] },
      'gear-spiked-shield': { size: [320, 320], r: 122 }, 'gear-spiral-shield': { size: [320, 320], r: 158 }, 'gear-tower-shield': { size: [224, 448], h: 224 },
    },
    // a round shield face on a tall shield: its rim radius per the tall shield's half width
    emblem: 0.85,
    // the draped net (kit-net-draped): its crown a and hem b (px), w its px across; over a man, a lion or a bear in its body's frame: the crown's x and
    // y, the hem's x and y and the width (body units); grow: the s it takes to land, and the size it lands from
    net: { size: [512, 512], a: [256, 84], b: [256, 428], w: 512, grow: [0.3, 0.6], man: [0.02, -1.0, 0, -0.3, 0.55], lion: [0, -0.6, -0.02, -0.1, 0.8], bear: [-0.02, -0.64, -0.04, -0.12, 0.82] },
  },
  // his shield (H x its scale): a round one's radius, a scutum's half height, Iron Wall's tower stretch (x, y)
  foeShield: { r: 0.1, h: 0.16, tower: [1.25, 1.45] },
  // Step 6b, the beasts painted from their kits (Pack 19; a young beast takes the -young parts where they exist), in its own body units: the body's box
  // (x0 y0 x1 y1; the PNG faces left, so it is mirrored), the head's eye (px) pinned at eyeAt from the head's centre at u body units per px, each leg
  // bone's joints a and b (px; the upper leg is cut at row clip, under the knee), w = the px across that spans the leg's hit width, the lion's tail from
  // its root to its tuft; head hinge and lip (px) pin the roar's jaw to the painted muzzle; far = the shade of the far legs, leg = the copies' width
  // in body units, gape = the painted jaw's opening per unit of the pose's jaw (rad), pawBand = how far the toe must point back or ahead (its forward share) before a lower leg is mirrored.
  beastArt: {
    lion: {
      body: { size: [640, 384], box: [-0.38, -0.44, 0.16, -0.12] }, head: { size: [320, 320], eye: [245, 121], u: 0.00094, hinge: [255, 172], lip: [303, 187] },
      upper: { size: [160, 288], a: [72, 40], b: [86, 232], w: 69, clip: 250 }, lower: { size: [160, 288], a: [70, 40], b: [80, 286], w: 95 },
      tail: { size: [320, 160], a: [8, 78], b: [300, 80], root: [-0.33, -0.33] },
    },
    bear: {
      body: { size: [640, 384], box: [-0.4, -0.48, 0.15, -0.15] }, head: { size: [320, 320], eye: [215, 108], u: 0.00088, hinge: [238, 160], lip: [296, 172] },
      upper: { size: [160, 288], a: [88, 40], b: [78, 232], w: 105, clip: 250 }, lower: { size: [160, 288], a: [57, 40], b: [75, 286], w: 95 },
    },
    eyeAt: [0.02, -0.018], far: 0.28, leg: 0.08, pawBand: 0.2, gape: 1.1,
    // Step 6c: each upper leg cropped to its own segment by its file (as TUNING.kit.crop: a the shoulder or hip, b the elbow or knee, clip the last
    // row, above the paw's leg), and each body's painted shoulder and hip (px in its left-facing PNG), where the near legs' tops are pinned; the far
    // legs' keep the rig's offset from the near ones (BEAST_BODY sh, hp)
    crop: {
      'beast-lion-upperleg-A': { a: [73, 40], b: [75, 136], clip: 146 }, 'beast-lion-upperleg-B': { a: [78, 40], b: [72, 140], clip: 150 },
      'beast-bear-upperleg-A': { a: [88, 40], b: [60, 130], clip: 140 }, 'beast-bear-upperleg-B': { a: [80, 40], b: [80, 150], clip: 160 },
      // Step 6c-2, the one-segment upper legs (Pack 20), drawn whole
      'beast-lion-upperleg-seg-A': { a: [70, 40], b: [106, 268] }, 'beast-lion-upperleg-young-seg-A': { a: [70, 40], b: [118, 268] },
      'beast-bear-upperleg-seg-A': { a: [90, 42], b: [78, 268] }, 'beast-bear-upperleg-young-seg-A': { a: [80, 42], b: [62, 268] },
    },
    pin: {
      'beast-lion-body-A': [[90, 190], [510, 180]], 'beast-lion-body-B': [[130, 200], [520, 170]],
      'beast-bear-body-A': [[170, 190], [520, 180]], 'beast-bear-body-B': [[190, 200], [540, 190]],
    },
  },
};

// ====== DATA TABLES: the gauntlet, story lines, the upgrade deck, body parts, zones and poses ======
// The gauntlet: what each bout may roll (size bands with their weights, armour sets). The fifth is the named champion. His stat points are TUNING.foeStats.
// The ramp: bout 1 is a sparring partner (no feints, no memory, no counters, tells x tell); feints from bout 2, memory from bout 3. A Giant is rare before bout 3.
const GAUNTLET = [
  { sizes: [['runt', 2], ['lean', 3], ['medium', 3]], armour: ['light'], spar: true, tell: 1.4 },
  { sizes: [['runt', 1.5], ['lean', 3], ['medium', 3], ['big', 1.5], ['giant', 0.3]], armour: ['light', 'medium'], feints: true, counters: true },
  { sizes: [['runt', 1], ['lean', 2], ['medium', 3], ['big', 2.5], ['giant', 1]], armour: ['medium'], feints: true, memory: true, counters: true },
  { sizes: [['runt', 1.5], ['lean', 2], ['medium', 2.5], ['big', 2.5], ['giant', 1.5]], armour: ['medium', 'heavy'], feints: true, memory: true, counters: true },
  { sizes: [['lean', 1.5], ['medium', 2.5], ['big', 3], ['giant', 2]], armour: ['heavy'], champion: true, feints: true, memory: true, counters: true },
];
// his profile's name and its line on his intro card (the shares are TUNING.profiles)
const PROFILES = {
  brute: { name: 'Brute', line: 'hits hard, never tires, slow feet.' },
  duelist: { name: 'Duelist', line: 'quick hands, quick feet.' },
  glass: { name: 'Glass cannon', line: 'hits hard, tires fast.' },
  tank: { name: 'Tank', line: 'soaks blows, slow to start.' },
  balanced: { name: 'Balanced', line: 'no easy opening.' },
};
const NAMES = ['Crixus', 'Priscus', 'Verus', 'Celadus', 'Triumphus', 'Tetraites', 'Spiculus', 'Attilius', 'Oenomaus', 'Gannicus', 'Pugnax', 'Calamus', 'Asteropaeus'];
const CHAMPIONS = ['Flamma the Unbroken', 'Marcus the Red', 'Varro of Capua', 'Aurelius the Golden'];
// The later arenas' champions, each tied to your reason in his own words: the tie on his card and the line he says. The Twins are one pairs bout,
// Castor first and Pollux waiting.
const NEW_CHAMPS = {
  twins: { name: 'Castor', pair: 'Pollux', title: 'Castor and Pollux, the Twins',
    tie: { revenge: 'Their torches lit your village.', debt: "The moneylender's sons. They collect in pairs.", freedom: 'Freed together. They fight to stay that way.', glory: "Pompeii's darlings, both of them.", promise: "Your sister serves at the Twins' table." },
    line: { revenge: 'One of us lit the fire. Guess which.', debt: 'Two of us, one debt. Pay twice.', freedom: 'Free men fight in pairs. You fight alone.', glory: 'They came to see twins. Not you.', promise: 'She pours for both of us. Twice the work.' } },
  hermes: { name: 'Hermes the Swift',
    tie: { revenge: 'He ran the torch from roof to roof.', debt: "He runs the moneylender's errands.", freedom: 'He ran his way free. Nobody catches him.', glory: 'The fastest blade in Pompeii.', promise: 'Your sister runs his errands now.' },
    line: { revenge: 'I was gone before the roofs fell.', debt: 'I collect. Quickly.', freedom: "You can't win freedom you can't catch.", glory: 'Blink, and you miss your own fall.', promise: 'She runs for me now. Can you catch me?' } },
  aquila: { name: "Aquila, the Emperor's Blade",
    tie: { revenge: "He carried the Emperor's torch.", debt: "The Emperor's purse. Your debt is in it.", freedom: "He holds the wooden sword, by the Emperor's leave.", glory: "Rome's own champion.", promise: "Your sister serves in the Emperor's house." },
    line: { revenge: 'The Emperor ordered it. I obeyed.', debt: 'Your debt bought my armour.', freedom: 'The wooden sword is mine to give. I will not.', glory: 'Rome has one name. Mine.', promise: 'Only the Emperor frees her. Not you.' } },
  // the Colosseum: the Beastmaster fights with his lion waiting at the edge (beast: it steps in when his health falls, TUNING.champs); the Huntress's
  // spear also throws a net (weapon: hers whatever the roll)
  carpophorus: { name: 'Carpophorus the Beastmaster', title: 'Carpophorus and his lion', beast: 'lion',
    tie: { revenge: 'He came with the soldiers, and his cages.', debt: "He feeds the moneylender's beasts.", freedom: "A slave once. Now Rome's beasts obey him.", glory: 'Rome loves his lion more than any man.', promise: 'Your sister feeds his lions.' },
    line: { revenge: 'My lion was a cub that night. Look at him now.', debt: 'Your debt feeds my lion. Every day.', freedom: 'I tamed lions to be free. You are no lion.', glory: 'They came for my lion. Not for you.', promise: 'She feeds my lion. He\'s grown fond of her.' } },
  mevia: { name: 'Mevia the Huntress', weapon: 'spear', female: true,
    tie: { revenge: 'She netted the ones who ran from your village.', debt: 'The moneylender sends her after debtors who run.', freedom: 'She hunts runaways for the bounty.', glory: "The Colosseum's favourite huntress.", promise: 'She caught your sister when she ran.' },
    line: { revenge: 'My net caught your village. It will catch you.', debt: 'Debtors run. I bring them back in a net.', freedom: 'Freedom? I bring runaways back for a living.', glory: 'Rome loves a hunt. Tonight, you are the prey.', promise: 'Your sister ran once. My net was faster.' } },
};
// The beasts: each kind's name, the epithets its card rolls from, and what its tells look like, in one line on its card.
const BEASTS = {
  lion: { name: 'Lion', epithets: ['the Black-Maned', 'of Numidia', 'the Golden', 'of the Atlas', 'the Scarred', 'the Restless'], tell: 'Crouches, then pounces. Lifts a paw, then swipes.' },
  bear: { name: 'Bear', epithets: ['of Dacia', 'the Mountain', 'of the North', 'the Grey-Muzzled', 'the Broad-Backed', 'of Britannia'], tell: 'Rears up, then mauls. Lowers its head, then shoves.' },
};
// a beast's name on its card: "A LION, THE GOLDEN" or "A BEAR OF DACIA"
const beastTitle = (d) => `A ${d.name}${d.epithet.startsWith('of ') ? ' ' : ', '}${d.epithet}`;
// The ladder: one run is one arena. rows = which gauntlet rows its bouts roll from (the Grand Games skip the sparring partner); champs = its champion pool;
// who = how its champion is named on the next arena's lock. Its numbers are TUNING.arenas.
const ARENAS = [
  { id: 'pit', name: 'The Pit', short: 'Pit', who: 'Pit', place: 'Capua', twist: 'The tight ring', rows: [0, 1, 2, 3, 4], champs: CHAMPIONS, champLabel: 'Four champions',
    brutus: 'Everyone starts in the sand. Few leave it.' },
  { id: 'city', name: 'The City arena', short: 'City', who: 'City', place: 'Pompeii', twist: 'Two foes, one at a time', rows: [0, 1, 2, 3, 4], champs: ['twins', 'hermes'], champLabel: 'The Twins or Hermes',
    brutus: 'Pompeii likes a show. Give them one.' },
  { id: 'rome', name: 'The Colosseum', short: 'Colosseum', who: 'Colosseum', place: 'Rome', twist: 'Men and beasts', rows: [0, 1, 2, 3, 4], champs: ['carpophorus', 'mevia'], champLabel: 'Carpophorus or Mevia',
    brutus: "Rome. Fifty thousand eyes. Don't blink." },
  { id: 'games', name: 'The Grand Games', short: 'Games', who: 'Grand Games', place: 'Rome', twist: "The Emperor's thumb", rows: [1, 2, 3, 4], champs: ['aquila'], champLabel: 'Aquila',
    brutus: 'The Emperor himself. I never got this far.' },
];
const ARENA = Object.fromEntries(ARENAS.map((a) => [a.id, a]));
const arena = () => ARENA[state.arena] || ARENAS[0];
const arenaT = () => TUNING.arenas[arena().id];
const bout = () => GAUNTLET[arena().rows[state.rack]] || GAUNTLET[GAUNTLET.length - 1];
// the champion's tie and line: a later arena's champion has his own, the Pit's four share theirs
const champTie = (d, r) => (NEW_CHAMPS[d.ck] ? NEW_CHAMPS[d.ck].tie[r] : CHAMP_TIE[r]);
const champLine = (d, r) => (NEW_CHAMPS[d.ck] ? NEW_CHAMPS[d.ck].line[r] : CHAMP_LINE[r]);

// Your fighter's story. Each origin is one background (its noun), and each background deals its family's start card. Names carry 'f' or 'm' for the epilogue's and the wall's words.
const ORIGINS = {
  gaul: { text: 'a farmer from Gaul', noun: 'farmer' }, thrace: { text: 'a Thracian soldier', noun: 'soldier' }, numidia: { text: 'a Numidian horseman', noun: 'horseman' },
  capua: { text: 'a baker from Capua', noun: 'baker' }, ostia: { text: 'a sailor from Ostia', noun: 'sailor' }, alexandria: { text: 'a scribe from Alexandria', noun: 'scribe' },
  // the barracks' three (the ludus): a gladiatrix is always a woman (rollMe gives her a woman's name)
  sparta: { text: 'a gladiatrix from Sparta', noun: 'gladiatrix', female: true }, egypt: { text: 'a freed slave from Egypt', noun: 'freed slave' },
  circus: { text: 'a chariot driver from the Circus', noun: 'charioteer' },
};
// A background deals a common of its family as its start card (the scribe's is the Trickster's one common, your own feint). While the Trickster or the
// Showman is shut in the ludus, the scribe and the baker start with a common of START_ALT's family instead.
const START_FAM = { soldier: 'wall', horseman: 'dancer', farmer: 'brute', sailor: 'blood', baker: 'show', scribe: 'trick', gladiatrix: 'wall', 'freed slave': 'brute', charioteer: 'dancer' };
const START_ALT = { show: 'brute', trick: 'wall' };
const bg = () => ORIGINS[state.me.origin].noun;
const MY_NAMES = [['Gaius', 'm'], ['Lucia', 'f'], ['Decimus', 'm'], ['Aurelia', 'f'], ['Brennus', 'm'], ['Tullia', 'f'], ['Nikandros', 'm'], ['Iuba', 'm']];
// a woman's name for a fighter whose origin needs one: the same roll, moved to the women's names
function herName(pick) { const F = MY_NAMES.filter((n) => n[1] === 'f'); return F[Math.max(0, MY_NAMES.indexOf(pick)) % F.length]; }
const REASON_NAME = { freedom: 'Freedom', debt: 'Debt', revenge: 'Revenge', glory: 'Glory', promise: 'A promise' };
// Old Brutus, the lanista: three lines per reason, and which one he says at each moment (first intro, later intros, the champion's intro, after a fell, the end of a lost run).
const BRUTUS = {
  freedom: { lines: ['Win the wooden sword and you walk out free.', "Free men don't lose to farmers. Get up.", 'One more, and the gate opens.'], first: 0, intro: 0, champ: 2, won: 0, lost: 1 },
  debt: { lines: ['Your family owes me. Every win pays.', "That one's worth a month of bread.", 'Lose, and the debt grows.'], first: 0, intro: 2, champ: 0, won: 1, lost: 2 },
  revenge: { lines: ["He burned your village. He's waiting at the end.", 'Keep your anger for the champion.', 'Not yet. Him last.'], first: 0, intro: 1, champ: 0, won: 2, lost: 1 },
  glory: { lines: ['Rome wants a name. Make it yours.', "Hear them? They're chanting for you.", 'Glory is loud. Be louder.'], first: 0, intro: 2, champ: 0, won: 1, lost: 2 },
  // the shrine's reason (the ludus): a sister held in the champion's house
  promise: { lines: ['You promised her. Keep it.', "She's waiting in his house. Don't make her wait.", 'One more, and you are at his door.'], first: 0, intro: 1, champ: 2, won: 1, lost: 0 },
};
// a promise climbs: Brutus after each fell
const PROMISE_WON = ["One down. She'll hear of it.", 'Two. His house is closer.', 'Three. Tell her to be ready.', "Next is him. The key's on his belt."];
const brutus = (me, moment) => { const B = BRUTUS[me.reason]; return B.lines[B[moment]]; };
// his line for your background, said before your second bout
const BRUTUS_BG = {
  farmer: 'You plough a field one row at a time. Same here.', soldier: 'Fight like you drilled, soldier. Shield first.', horseman: 'Light feet, horseman. Give him nothing to hit.',
  baker: 'Knead him like dough, baker!', sailor: 'Sea legs, sailor. Let him crash on you.', scribe: 'Read him like a scroll.',
  gladiatrix: 'Sparta sent you. Show him why they fear it.', 'freed slave': "You've broken chains before. Break him.", charioteer: 'No horses here, charioteer. Steer him into the wall.',
};
// revenge climbs: his line before each bout, and after each fell
const REVENGE = {
  intro: ["He burned your village. He's waiting at the end.", null, 'Keep your anger for the champion.', 'Not yet. Him last.', 'There he is. The man with the torch.'],
  won: ["One down. He's still out there.", 'Good. Let it burn in you.', 'Two more. Keep the fire banked.', 'Next is him. Make him remember the village.'],
};
// The champion is tied to your reason: a line on his card, and what he says.
const CHAMP_TIE = { revenge: 'He burned your village.', debt: "He's in the moneylender's pay.", freedom: 'A freed man, back for the money.', glory: "The crowd's darling.", promise: 'Your sister is a slave in his house.' };
const CHAMP_LINE = { revenge: 'I remember the fire. Do you?', debt: "Your family's debt is my purse.", freedom: 'I was free once. Gold brought me back.', glory: 'They will forget you by morning.',
  promise: 'Your sister? She sweeps my floor. Go home.' };
const debtLeft = () => Math.max(0, TUNING.story.debt - TUNING.story.debtPer * state.felled);
const denarii = (n) => n.toLocaleString('en-US');
// Old Brutus before a bout: the arena's opening line first (his reason's first line under it, brutusReason), your background's line before bout 2,
// the champion line last, his reason's line between (revenge climbs)
function brutusIntro() {
  const me = state.me, r = state.rack, champ = state.foe.champion;
  if (r === 0) return arena().brutus;
  if (r === 1) return BRUTUS_BG[bg()];
  if (me.reason === 'revenge') return REVENGE.intro[champ ? 4 : r];
  return brutus(me, r === 0 ? 'first' : champ ? 'champ' : 'intro');
}
const brutusReason = () => (state.me.reason === 'revenge' ? REVENGE.intro[0] : brutus(state.me, 'first'));
// after a fell: the reason's thread
function brutusWon() {
  const me = state.me, n = state.felled;
  if (me.reason === 'revenge') return REVENGE.won[Math.min(n, 4) - 1];
  if (me.reason === 'debt') return `That's ${denarii(TUNING.story.debtPer)} off. ${denarii(debtLeft())} denarii to go.`;
  if (me.reason === 'freedom') return `Another notch on the wooden sword. ${n} now.`;
  if (me.reason === 'promise') return PROMISE_WON[Math.min(n, 4) - 1];
  return `Hear them? They chant ${me.name.toUpperCase()} louder now.`;
}
const EPILOGUE = {
  freedom: (n, f) => `${n} walked out a free ${f ? 'woman' : 'man'}, the wooden sword in hand.`,
  debt: (n, f) => `The debt was paid. ${n} went home to ${f ? 'her' : 'his'} family.`,
  revenge: (n) => `The village was avenged. ${n} finally slept.`,
  glory: (n) => `Rome sang the name ${n} for a generation.`,
  promise: (n, f) => `${n} kept the promise. ${f ? 'Her' : 'His'} sister walked out of the champion's house, free.`,
};
// The City's ending, one per reason: a chapter closed, Rome ahead.
const CITY_END = {
  freedom: (n) => `Pompeii roared for ${n}. The wooden sword waits in Rome.`,
  debt: (n) => `Pompeii paid in silver. ${n}'s family ate meat that winter.`,
  revenge: (n) => `In Pompeii, ${n} learned who gave the order: Rome.`,
  glory: (n) => `Pompeii chanted ${n} until dawn. Rome heard it.`,
  promise: (n) => `In Pompeii, ${n} learned where she had been sold: Rome.`,
};
// The Colosseum's ending, one per reason: Rome has seen you, and the Emperor's games are next.
const ROME_END = {
  freedom: (n) => `${n} walked out past the lions' cages. The wooden sword waits at the Emperor's games.`,
  debt: (n) => `The Colosseum paid ${n} in gold. The moneylender counted it twice.`,
  revenge: (n) => `In the Colosseum, ${n} heard the name at last: Aquila, the Emperor's Blade.`,
  glory: (n) => `Fifty thousand voices learned the name ${n}. The Emperor heard it too.`,
  promise: (n) => `${n} saw her at last, among the Emperor's slaves. One more door.`,
};
// The Grand Games end on the Emperor's thumb: the true ending for your reason at a full meter, a cold nod, or thumbs down.
const TRUE_END = {
  debt: 'The Emperor pays your debt himself. The moneylender bows.',
  revenge: "Aquila burned your village on the Emperor's order. The Emperor looks away first.",
  freedom: 'The Emperor hands you the wooden sword. You are free.',
  glory: 'Rome chants your name. They will sing it for a hundred years.',
  promise: 'The Emperor frees your sister. She runs to you across the sand.',
};
const THUMB_END = ['Free, but forgotten. You walk out to silence.', 'The Emperor nods. Rome will forget you by spring.'];
// the crowd's band: 0 low, 1 middling, 2 full (the top third)
const bandOf = (fav) => { const B = TUNING.crowd.bands, k = fav / TUNING.crowd.max; return k >= B[1] ? 2 : k >= B[0] ? 1 : 0; };
// how a won run ends: the Pit's epilogue, the City's, the Colosseum's, or the Emperor's thumb
function endingOf(arenaId, me, fav) {
  if (arenaId === 'games') { const b = bandOf(fav); return b === 2 ? TRUE_END[me.reason] : THUMB_END[b]; }
  if (arenaId === 'city') return CITY_END[me.reason](me.name, me.female);
  if (arenaId === 'rome') return ROME_END[me.reason](me.name);
  return EPILOGUE[me.reason](me.name, me.female);
}
const storyLine = (me) => `${me.name}, ${ORIGINS[me.origin].text}. Fights for: ${REASON_NAME[me.reason]}.`;

// Brutus's ludus (E): five stations, each unlock one tap for its price in fame (TUNING.ludus.price). Until bought, the armoury's weapons, the barracks'
// origins and the shrine's reason weigh nothing on their wheels (LUDUS_LOCK), and the Trickster's and the Showman's cards are never dealt. The training
// ground's two are the only power. The tailor's are looks: a tap on one you own steps through its styles (TAILOR), then off.
const LUDUS = [
  { id: 'armoury', name: 'The Armoury', line: 'New weapons that can come up on your wheel', brutus: 'Steel is steel. How you hold it is everything.', items: [
    { id: 'trident', name: 'Trident and net', line: 'A new weapon on your weapon wheel. Longest reach, slow. Your first well-timed block each bout nets him and slows him.' },
    { id: 'sica', name: 'The sica', line: 'A new weapon on your weapon wheel. A short curved blade: quick, and its slashes cut deep.' }] },
  { id: 'barracks', name: 'The Barracks', line: 'New fighters and new card families', brutus: 'New blood in the barracks. Make room.', items: [
    { id: 'sparta', name: 'A gladiatrix', line: 'A new fighter on your origin wheel: a Spartan woman. She starts with a Wall card.' },
    { id: 'egypt', name: 'A freed slave', line: 'A new fighter on your origin wheel, from Egypt. Starts with a Brute card.' },
    { id: 'circus', name: 'A chariot driver', line: 'A new fighter on your origin wheel, from the Circus. Starts with a Dancer card.' },
    { id: 'trick', name: 'The Trickster', line: 'New cards in your picks: feints and tricks to fool him.' },
    { id: 'show', name: 'The Showman', line: 'New cards in your picks: win the crowd, and it fights for you.' }] },
  { id: 'training', name: 'The Training Ground', line: 'A card to start with, and a bigger first pick', brutus: 'Sweat here, so you bleed less out there.', items: [
    { id: 'slot', name: 'Start card', line: 'Choose a card you have picked before. Every run starts with it.' },
    { id: 'fourth', name: 'A fourth card', line: 'Your first pick of each run shows 4 cards, not 3.' }] },
  { id: 'shrine', name: 'The Shrine', line: 'A new reason to fight', brutus: 'Every fighter needs a reason. Pick a good one.', items: [
    { id: 'promise', name: 'A promise', line: "A new reason on your reason wheel: free your sister from the champion's house." }] },
  { id: 'tailor', name: 'The Tailor', line: 'Looks only', brutus: 'Look good. Then fight better than you look.', items: [
    { id: 'crest', name: 'A crest', line: 'Looks only. Tap it once bought to change its style.' },
    { id: 'plume', name: 'A plume', line: 'Looks only. Tap it once bought to change its style.' },
    { id: 'paint', name: 'Shield paint', line: 'Looks only. Tap it once bought to change its style.' },
    { id: 'cloak', name: 'A cloak', line: 'Looks only. Tap it once bought to change its style.' }] },
];
const LUDUS_ITEM = Object.fromEntries(LUDUS.flatMap((s) => s.items.map((q) => [q.id, { ...q, station: s.id }])));
const LUDUS_LOCK = new Set(['trident', 'sica', 'sparta', 'egypt', 'circus', 'promise']);
// the tailor's styles: [name, colour]
const TAILOR = { crest: [['Bronze', '#c8963e'], ['Silver', '#d5dce4'], ['Gold', '#ffd24a']], plume: [['Red', '#c8372a'], ['White', '#efe6cf'], ['Black', '#2a2420']],
  paint: [['Wings', '#efe6cf'], ['Bolt', '#ffd24a'], ['Sun', '#f97316']], cloak: [['Red', '#9b2f2f'], ['Blue', '#2f4a8a'], ['Green', '#2f6d3d']] };
// a family the ludus shuts, and the families the war paints belong to; a fighter rolled before the ludus (no `open`) has every family open
const FAM_LOCK = ['trick', 'show'], FIN_FAM = { falseop: 'trick', showstop: 'show' };
const famOpen = (me, f) => !FAM_LOCK.includes(f) || !me || !me.open || me.open.includes(f);
const cardOpen = (me, c) => (c.duo ? c.duo.every((f) => famOpen(me, f)) : famOpen(me, c.fam === 'fin' ? FIN_FAM[c.id] : c.fam));
// a veteran's scar line, after the champion he felled
const SCARS = [(c) => `Scarred by ${c}`, (c) => `${c}'s mark on the brow`, (c) => `A scar from ${c}`];

// The deck: six families, each card one rule and one piece of gear (fam; tier = rarity: 0 common, 1 rare, 2 epic, 3 legendary; key = a keystone, the
// legendary that names its price). slot: where the piece is worn (one piece a slot), gear: its name. needs: a card that is useless without your shield or
// your dodge; bans: what a keystone takes away. Finishers are war paint (TUNING.fin) and a duo is a set bonus; neither takes a slot.
const FAMS = {
  wall: { name: 'The Wall', col: '#7dd3fc' }, blood: { name: 'Blood', col: '#f87171' }, dancer: { name: 'The Dancer', col: '#86efac' }, brute: { name: 'The Brute', col: '#fbbf24' },
  trick: { name: 'The Trickster', col: '#a78bfa' }, show: { name: 'The Showman', col: '#f472b6' },
  fin: { name: 'War paint', col: '#e879f9' }, rare: { name: 'Lone piece', col: '#c4b99a' },
};
const SLOT_NAMES = ['helmet', 'shield', 'weapon', 'chest', 'arms', 'legs', 'cloak', 'belt'];
const DECK = [
  { id: 'riposte', fam: 'wall', tier: 0, slot: 'arms', gear: 'Bronze Bracers', name: 'Riposte', line: 'Block right as his blow lands, and you stab back for free.', needs: 'shield' },
  { id: 'shove', fam: 'wall', tier: 0, slot: 'chest', gear: 'Bronze Phalerae', name: 'Shield Shove', line: "A block right as it lands shoves him back. Against the wall, he's stunned.", needs: 'shield' },
  { id: 'braced', fam: 'wall', tier: 0, slot: 'helmet', gear: 'Bronze Crest', name: 'Braced', line: 'Every block earns Momentum, not just the well-timed ones.', needs: 'shield' },
  { id: 'thorns', fam: 'wall', tier: 2, slot: 'shield', gear: 'Spiked Shield', name: 'Thorns', line: 'Each block chips his weapon. Three chips and he drops it.', needs: 'shield' },
  { id: 'standfast', fam: 'wall', tier: 1, slot: 'legs', gear: 'Bronze Boots', name: 'Stand Fast', line: 'With your back to the wall, every block counts as perfectly timed.', needs: 'shield' },
  { id: 'ironwall', fam: 'wall', tier: 3, key: true, slot: 'shield', gear: 'Tower Shield', name: 'Iron Wall', line: "Twice the time to time a block, and each one opens a gap. You can't dodge.", needs: 'shield', bans: 'dodge' },
  { id: 'serrated', fam: 'blood', tier: 0, slot: 'weapon', gear: 'Saw-toothed Blade', name: 'Serrated Edge', line: 'A stab into a gap makes him bleed.' },
  { id: 'rend', fam: 'blood', tier: 0, slot: 'arms', gear: 'Barbed Bracers', name: 'Rend', line: 'A slash where he has no armour makes him bleed.' },
  { id: 'vein', fam: 'blood', tier: 1, slot: 'helmet', gear: 'Blood Band', name: 'Open Vein', line: 'While he bleeds, his wind-ups are slower and easier to read.' },
  { id: 'bloodlust', fam: 'blood', tier: 1, slot: 'cloak', gear: 'Wolf Pelt', name: 'Bloodlust', line: 'While he bleeds, you get your stamina back faster.' },
  { id: 'cruel', fam: 'blood', tier: 2, slot: 'belt', gear: 'Hook Belt', name: 'Cruel Edge', line: 'The more he bleeds, the harder your stabs into gaps hit.' },
  { id: 'haem', fam: 'blood', tier: 3, key: true, slot: 'weapon', gear: 'Hooked Sica', name: 'Haemorrhage', line: 'His bleeding carries on to the next fighter. Hits on bare skin do nothing.' },
  { id: 'sidestep', fam: 'dancer', tier: 0, slot: 'legs', gear: "Dancer's Sandals", name: 'Sidestep', line: 'Dodge during his wind-up and he stumbles, out of breath.', needs: 'dodge' },
  { id: 'lightfeet', fam: 'dancer', tier: 0, slot: 'belt', gear: 'Ribbon Sash', name: 'Light Feet', line: 'Dodge during his wind-up and the dodge costs no stamina.', needs: 'dodge' },
  { id: 'blur', fam: 'dancer', tier: 1, slot: 'chest', gear: 'Ghost Silk', name: 'Blur', line: 'Step back and he swings at a ghost of you.', needs: 'dodge' },
  { id: 'matador', fam: 'dancer', tier: 2, slot: 'arms', gear: "Matador's Ribbons", name: 'Matador', line: 'Dodge a stab or a shield bash and he stumbles, stunned.', needs: 'dodge' },
  { id: 'slip', fam: 'dancer', tier: 1, slot: 'helmet', gear: 'Ribbon Band', name: 'Slip and Stab', line: 'Dodge his wind-up, then stab quickly: double damage.', needs: 'dodge' },
  { id: 'untouch', fam: 'dancer', tier: 3, key: true, slot: 'cloak', gear: 'Flowing Cape', name: 'Untouchable', line: 'Dodges are free, and a dodge during his wind-up opens every gap. No shield.', needs: 'dodge', bans: 'shield' },
  { id: 'heavy', fam: 'brute', tier: 0, slot: 'weapon', gear: 'Iron Pommel', name: 'Heavy Arm', line: 'Your smashes from above break armour twice as fast.' },
  { id: 'brawler', fam: 'brute', tier: 0, slot: 'belt', gear: 'Chain Belt', name: 'Brawler', line: 'Breaking a piece of his armour earns 2 Momentum.' },
  { id: 'breaker', fam: 'brute', tier: 2, slot: 'helmet', gear: 'Horned Cap', name: 'Plate Breaker', line: 'A smash from above knocks off the armour it hits.' },
  { id: 'bones', fam: 'brute', tier: 1, slot: 'legs', gear: 'Spiked Boots', name: 'Bonebreaker', line: 'A smash on a bare leg or arm cripples it at once.' },
  { id: 'jugg', fam: 'brute', tier: 1, slot: 'arms', gear: 'Iron Pauldrons', name: 'Juggernaut', line: "Lunge through his blow: it hurts half as much and doesn't stop you." },
  { id: 'titan', fam: 'brute', tier: 3, key: true, slot: 'chest', gear: 'Black Plate', name: 'Titan', line: `${TUNING.cards.titan} more hearts, and every smash from above staggers him. You can't dodge.`, bans: 'dodge' },
  { id: 'myfeint', fam: 'trick', tier: 0, slot: 'helmet', gear: 'Dark Hood', name: 'Feint', line: 'Push to lunge, then pull back fast: he guards there, and the other side opens.' },
  { id: 'misdir', fam: 'trick', tier: 1, slot: 'weapon', gear: 'Blackened Blade', name: 'Misdirection', line: 'Stab the gap your fake opened: double damage.' },
  { id: 'mindreader', fam: 'trick', tier: 1, slot: 'chest', gear: 'Eye Amulet', name: 'Mind Reader', line: 'Spot his fake and earn 2 Momentum.' },
  { id: 'bait', fam: 'trick', tier: 1, slot: 'shield', gear: 'Spiral Shield', name: 'Bait', line: 'Lower your shield on purpose: his next wind-up is twice as long.', needs: 'shield' },
  { id: 'unreadable', fam: 'trick', tier: 1, slot: 'legs', gear: 'Soft Boots', name: 'Unreadable', line: 'He never gets used to your fakes.' },
  { id: 'bluff', fam: 'trick', tier: 2, slot: 'arms', gear: 'Knife Bracers', name: 'Double Bluff', line: 'Fake twice in a row and every gap opens.' },
  { id: 'puppet', fam: 'trick', tier: 3, key: true, slot: 'cloak', gear: "Puppeteer's Mantle", name: 'Puppeteer', line: `Every third move of his is a fake, and you see it coming. ${TUNING.cards.puppetHearts} hearts at most.` },
  { id: 'flourish', fam: 'show', tier: 0, slot: 'weapon', gear: 'Gilded Sword', name: 'Flourish', line: 'Draw a fast circle with your sword thumb: the crowd cheers.' },
  { id: 'showboat', fam: 'show', tier: 0, slot: 'cloak', gear: 'Purple Cloak', name: 'Showboat', line: 'The crowd gets bored of you half as fast.' },
  { id: 'playcrowd', fam: 'show', tier: 1, slot: 'arms', gear: 'Gilt Armlets', name: 'Play to the Crowd', line: 'Well-timed blocks and spotting fakes please the crowd twice as much.' },
  { id: 'bread', fam: 'show', tier: 1, slot: 'belt', gear: 'Coin Belt', name: 'Bread and Circuses', line: `With the crowd nearly full, they throw you ${TUNING.cards.bread} hearts, once a bout.` },
  { id: 'encore', fam: 'show', tier: 1, slot: 'legs', gear: 'Gilded Greaves', name: 'Encore', line: 'With the crowd high, finishers cost 1 Momentum less.' },
  { id: 'pleaser', fam: 'show', tier: 2, slot: 'helmet', gear: 'Plumed Helm', name: 'Crowd Pleaser', line: 'With the crowd high, a stab into a gap does triple damage, and uses some of the crowd.' },
  { id: 'darling', fam: 'show', tier: 3, key: true, slot: 'chest', gear: 'Gilded Harness', name: 'Darling of Rome', line: 'The crowd never gets bored, and when full, he freezes in awe. Half gold.' },
  { id: 'exec', fam: 'fin', tier: 1, gear: 'Red Bar', name: 'Execute', line: "3 Momentum, when he's below half health: your next stab into a gap finishes him." },
  { id: 'whirl', fam: 'fin', tier: 1, gear: 'Woad Spiral', name: 'Whirlwind', line: '2 Momentum: your next slash hits every gap it crosses.' },
  { id: 'breath', fam: 'fin', tier: 1, gear: 'Chalk Dots', name: 'Second Breath', line: '2 Momentum: all your stamina back.' },
  { id: 'disarm', fam: 'fin', tier: 1, gear: 'Ochre Zigzag', name: 'Disarm', line: '4 Momentum: his weapon flies, and he fights with his fists for 3 seconds.' },
  { id: 'falseop', fam: 'fin', tier: 1, gear: 'Violet Mask', name: 'False Opening', line: "3 Momentum: his next blow misses, and he's out of breath." },
  { id: 'showstop', fam: 'fin', tier: 1, gear: 'Gold Laurel', name: 'Showstopper', line: '3 Momentum: the crowd roars, and he freezes in awe.' },
  { id: 'unbreak', fam: 'rare', tier: 2, slot: 'cloak', gear: 'Lion Pelt', name: 'Unbreakable', line: 'The first hit you take in each fight does nothing.' },
  { id: 'cape', duo: ['dancer', 'wall'], tier: 2, name: "Matador's Cape", line: 'Every second well-timed block or dodge stuns him.' },
  { id: 'butcher', duo: ['brute', 'blood'], tier: 2, name: 'Butcher', line: 'Breaking his armour makes him bleed badly.' },
  { id: 'spiked', duo: ['wall', 'blood'], tier: 2, name: 'Spiked Boss', line: 'A block right as his blow lands makes him bleed.', needs: 'shield' },
  { id: 'hamstring', duo: ['dancer', 'brute'], tier: 2, name: 'Hamstring', line: 'Dodge his wind-up, then hit quickly: his legs go slow.', needs: 'dodge' },
  { id: 'sucker', duo: ['trick', 'brute'], tier: 2, name: 'Sucker Punch', line: 'Fake, then smash from above: he always staggers.' },
  { id: 'bloodsport', duo: ['show', 'blood'], tier: 2, name: 'Blood Sport', line: 'The crowd loves it while he bleeds.' },
  { id: 'falsestep', duo: ['trick', 'dancer'], tier: 2, name: 'False Step', line: 'Dodging his wind-up works like a fake: a gap opens.', needs: 'dodge' },
  { id: 'salute', duo: ['show', 'wall'], tier: 2, name: 'Salute', line: 'With the crowd high, a well-timed block opens every gap.', needs: 'shield' },
];
for (const c of DECK) { c.fam = c.fam || 'duo'; c.ab = c.name.split(/[ ']/).filter((w) => /^[A-Z]/.test(w)).map((w) => w[0]).join('').slice(0, 2); }
const CARD = Object.fromEntries(DECK.map((c) => [c.id, c]));
// The exact numbers behind each card's plain line, shown on its "?" page (all from TUNING)
const ord = (n) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;
const bleeds = (n) => `Bleeding ${n}: he loses ${TUNING.bleed.dmg * n} health a second for ${TUNING.bleed.dur} s.`;
const topPct = () => Math.round(TUNING.crowd.bands[1] * 100);
const CARD_NUMS = {
  riposte: (T, C) => `The counter stab does ${T.attack.jab.dmg} damage.`,
  shove: (T, C) => `He is pushed back ${C.shove} paces. At his wall he is stunned ${C.shoveStun} s.`,
  braced: (T, C) => `${C.braced} Momentum for each block that is not well-timed.`,
  standfast: () => 'Only with your back to your wall.',
  thorns: (T, C) => `${C.thorns} chips and he drops it for ${C.thornsDur} s. A beast is stunned instead.`,
  ironwall: (T) => `The well-timed window grows from ${T.shield.perfect} s to ${T.shield.perfect * 2} s. No dodging.`,
  serrated: () => bleeds(TUNING.cards.serrated),
  rend: () => bleeds(TUNING.cards.rend),
  vein: (T, C) => `His wind-ups take ${Math.round((C.vein - 1) * 100)}% longer while he bleeds.`,
  bloodlust: (T, C) => `${C.bloodlust} stamina for each bleeding, every second.`,
  cruel: (T, C) => `+${C.cruel} damage for each bleeding on him.`,
  haem: () => 'All his bleeding goes to the next fighter. A hit on bare skin does 0.',
  sidestep: (T, C) => `He is out of breath for ${C.sidestep} s.`,
  lightfeet: (T) => `The dodge's ${T.dodge.cost} stamina comes back.`,
  blur: () => 'The ghost takes his next blow.',
  slip: (T, C) => `A stab within ${C.slipWin} s of the dodge does ${C.slip}x damage.`,
  matador: (T, C) => `He is stunned ${C.matador} s.`,
  untouch: (T, C) => `Dodges cost nothing. Every gap opens for ${C.untouch} s. No shield.`,
  heavy: (T, C) => `Smashes dent armour ${C.heavy}x as much. A piece breaks at ${T.armour.dents} dents.`,
  brawler: (T, C) => `${C.brawler} Momentum for each piece you break.`,
  breaker: () => 'The armour is gone at once, however few dents it had.',
  bones: (T) => `A crippled leg moves at ${Math.round(T.lame.legs * 100)}% speed; a crippled arm swings ${Math.round(T.lame.arm * 100)}% slower.`,
  jugg: (T, C) => `His blow costs ${C.jugg}x, rounded up, while you lunge.`,
  titan: (T, C) => `+${C.titan} hearts. Every smash staggers him. No dodging.`,
  myfeint: (T) => `The other gap opens for ${T.myFeint.open} s. A fake costs ${T.myFeint.cost} stamina.`,
  misdir: (T, C) => `${C.misdir}x damage.`,
  mindreader: (T, C) => `${T.mom.read + C.mind} Momentum for each fake you spot.`,
  bait: (T, C) => `Hold the shield ${C.baitHold} s, then lower it. His next wind-up takes ${C.bait}x as long.`,
  unreadable: (T) => `Without it he learns after ${T.myFeint.learn} fakes in ${T.myFeint.learnWin} s.`,
  bluff: (T, C) => `Two fakes within ${C.bluffWin} s open every gap for ${C.bluff} s.`,
  puppet: (T, C) => `One move in ${C.puppet} is a fake. Your hearts are capped at ${C.puppetHearts}.`,
  flourish: (T, C) => `+${C.flourish} crowd, out of ${T.crowd.max}, for each circle.`,
  showboat: (T, C) => `The crowd drains at ${C.showboat}x speed.`,
  playcrowd: (T, C) => `${C.play}x crowd for each.`,
  bread: (T, C) => `${C.bread} hearts when the crowd is past ${C.breadAt}%.`,
  encore: (T, C) => `${C.encore} Momentum less, with the crowd past ${topPct()}%.`,
  pleaser: (T, C) => `${C.pleaser}x damage, and it uses ${C.pleaserCost} crowd. With the crowd past ${topPct()}%.`,
  darling: (T, C) => `At ${C.aweAt}% crowd he freezes ${C.awe} s before each exchange. Gold x${C.darlingGold}.`,
  exec: (T) => `${T.fin.exec} Momentum. Below ${Math.round(T.fin.below * 100)}% of his health.`,
  whirl: (T) => `${T.fin.whirl} Momentum, for one slash.`,
  breath: (T) => `${T.fin.breath} Momentum.`,
  disarm: (T, C) => `${T.fin.disarm} Momentum. Fists hit for ${C.fist} at most. A beast is stunned ${T.fin.beastStun} s.`,
  falseop: (T) => `${T.fin.falseop} Momentum. His blow takes ${T.fin.falseWind} s to land, and misses.`,
  showstop: (T) => `${T.fin.showstop} Momentum. The crowd gets +${T.fin.showFav}. He freezes ${T.fin.showAwe} s.`,
  unbreak: () => 'Once in each fight.',
  cape: (T, C) => `Every ${ord(C.cape)} one: he is stunned ${C.capeStun} s.`,
  butcher: () => bleeds(TUNING.cards.butcher),
  spiked: () => bleeds(TUNING.cards.spiked),
  hamstring: (T, C) => `Hit within ${C.hamWin} s of the dodge.`,
  sucker: (T, C) => `Smash within ${C.sucker} s of your fake.`,
  bloodsport: (T, C) => `+${C.bloodSport} crowd for each bleeding, every second.`,
  falsestep: (T) => `The gap opens for ${T.myFeint.open} s.`,
  salute: (T, C) => `Every gap opens for ${C.salute} s, with the crowd past ${topPct()}%.`,
};
const cardNums = (c) => CARD_NUMS[c.id](TUNING, TUNING.cards);
// The armourer's wares. Big ones, then the v1 commons, now sold cheap here.
const WARES = [
  { id: 'plate', big: true, name: 'Iron plate', line: 'Your {part} is plated' },
  { id: 'whet', big: true, name: 'Whetstone', line: '+1 damage on every hit' },
  { id: 'heart', big: true, name: 'A heart', line: `+${TUNING.tent.heart} hearts to your max, filled` },
  { id: 'token', big: true, name: 'Lucky token', line: '+1 reroll for a draft' },
  { id: 'forge', big: true, name: 'Forged {weapon}', line: 'Your weapon hits 25% harder' },
  { id: 'hide', name: 'Thick Hide', line: `+${TUNING.cards.hide} heart to your max, filled` },
  { id: 'wind', name: 'Big Lungs', line: '+20% stamina' },
  { id: 'wrist', name: 'Quick Wrist', line: 'quick stabs recover 20% faster' },
  { id: 'steady', name: 'Steady Shield', line: 'blocking costs 25% less' },
  { id: 'grip', name: 'Sandal Grip', line: 'steps 20% faster' },
  { id: 'feet', name: 'Quick Feet', line: 'steps 25% faster' },
  { id: 'deepbreath', name: 'Deep Breath', line: 'stamina regenerates 20% faster' },
  { id: 'edge', name: 'Sharp Edge', line: 'bare hits +1' },
  { id: 'tough', name: 'Tough Shield', line: '2 more shield hits' },
  { id: 'stance', name: 'Wide Stance', line: 'no push-back from a bash' },
];
// Rarity has a colour: the card's border and the glint on the worn piece. A set is gold.
const TIERS = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'], TIER_TINT = ['#c4b99a', '#7dd3fc', '#c084fc', '#fb923c'], DUO_GOLD = '#ffd24a';
const rarCol = (c) => (c.duo ? DUO_GOLD : TIER_TINT[c.tier]);
// the title a card shows: the piece's name, the war paint's pattern, or the set's name
const titleOf = (c) => (c.duo ? `${c.name} set` : c.gear);
// The gear worn: the last piece picked for each slot (a migrated run may still hold two for one slot; the later one shows).
function gearOf(ids) {
  const out = {};
  for (const id of ids) { const c = CARD[id]; if (c && c.slot) out[c.slot] = c; }
  return out;
}
const wornGear = () => gearOf(state.picks);
// the piece a card would replace: the one now worn in its slot
const replaces = (c) => (c.slot ? wornGear()[c.slot] || null : null);
// The gap guards: foe-only pieces, each shutting one joint gap for the bout
const GUARDS = { 'slot-neck': 'Gorget', 'slot-armpit': 'Manica', 'slot-waist': 'Wide Belt', 'slot-elbow': 'Couters', 'slot-knee': 'Knee Guards' };

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
// A beast's body, side view, in its own body units (x forward, y down, origin at its near forepaw). Its parts ride frames set by its pose (poseBeast):
// 'body' (the torso, rearing about the hip), 'head' (the body's, dipped) and the near foreleg 'legF' (from the shoulder joint, like an arm); the hind
// legs stand on the ground. Its gaps are its soft spots: the throat, the foreleg's joint, and the flank (lion) or belly (bear). sh, hp: the shoulders and
// hips (near, far); feet: where each foot stands (fore near, fore far, hind near, hind far); leg: the upper and lower bone of a fore and a hind leg.
const BEAST_BODY = {
  lion: {
    parts: [
      { id: 'head', shape: 'circle', x: 0.17, y: -0.4, r: 0.075, frame: 'head' },
      { id: 'chest', shape: 'rect', x: 0.04, y: -0.3, w: 0.18, h: 0.18, frame: 'body' },
      { id: 'belly', shape: 'rect', x: -0.15, y: -0.29, w: 0.2, h: 0.15, frame: 'body' },
      { id: 'legF', shape: 'rect', x: 0, y: 0.145, w: 0.06, h: 0.29, joint: [0.05, -0.29] },
      { id: 'legs', shape: 'rect', x: -0.27, y: -0.16, w: 0.12, h: 0.32 },
    ],
    slots: [
      { id: 'slot-throat', label: 'THROAT', shape: 'rect', x: 0.12, y: -0.335, w: 0.045, h: 0.06, axis: 0.5, frame: 'body' },
      { id: 'slot-joint', label: 'JOINT', shape: 'rect', x: 0, y: 0.13, w: 0.065, h: 0.035, axis: 0, frame: 'legF' },
      { id: 'slot-flank', label: 'FLANK', shape: 'rect', x: -0.06, y: -0.3, w: 0.035, h: 0.08, axis: 0.35, frame: 'body' },
    ],
    sh: [[0.05, -0.29], [0.08, -0.3]], hp: [[-0.26, -0.27], [-0.22, -0.28]], feet: [0.04, 0.09, -0.27, -0.22], leg: [[0.15, 0.15], [0.15, 0.16]], hip: [-0.25, -0.27],
  },
  bear: {
    parts: [
      { id: 'head', shape: 'circle', x: 0.17, y: -0.42, r: 0.08, frame: 'head' },
      { id: 'chest', shape: 'rect', x: 0.03, y: -0.32, w: 0.2, h: 0.22, frame: 'body' },
      { id: 'belly', shape: 'rect', x: -0.16, y: -0.31, w: 0.2, h: 0.2, frame: 'body' },
      { id: 'legF', shape: 'rect', x: 0, y: 0.15, w: 0.08, h: 0.3, joint: [0.05, -0.3] },
      { id: 'legs', shape: 'rect', x: -0.27, y: -0.18, w: 0.13, h: 0.36 },
    ],
    slots: [
      { id: 'slot-throat', label: 'THROAT', shape: 'rect', x: 0.125, y: -0.345, w: 0.045, h: 0.06, axis: 0.5, frame: 'body' },
      { id: 'slot-joint', label: 'JOINT', shape: 'rect', x: 0, y: 0.14, w: 0.075, h: 0.035, axis: 0, frame: 'legF' },
      { id: 'slot-belly', label: 'BELLY', shape: 'rect', x: -0.13, y: -0.225, w: 0.12, h: 0.035, axis: 0, frame: 'body' },
    ],
    sh: [[0.05, -0.3], [0.08, -0.31]], hp: [[-0.26, -0.28], [-0.22, -0.29]], feet: [0.05, 0.1, -0.27, -0.22], leg: [[0.15, 0.16], [0.15, 0.17]], hip: [-0.25, -0.28],
  },
};
// a beast's parts: every gap open (a beast wears no guard)
function beastParts(kind) {
  const K = BEAST_BODY[kind], out = K.parts.map((d) => mkPart(d, false));
  for (const d of K.slots) { const q = mkPart(d, false); q.slot = true; out.push(q); }
  return out;
}

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
const POSE_NAME = { chop: 'CHOP', slash: 'SLASH', sweep: 'SWEEP', thrust: 'THRUST', bash: 'BASH', net: 'NET', pounce: 'POUNCE', swipe: 'SWIPE', maul: 'MAUL', shove: 'SHOVE' };
const REST_TH = 0.9;

// Your plates follow your rolled set: n of head, chest and legs (the parts the high, mid and low blows land on), heavy also plates the shield arm.
const ZONE_PART = { high: 'head', mid: 'chest', low: 'legs' };
const playerParts = (me) => PARTS.map((d) => mkPart(d, me.plates.includes(d.id)));

// ====== RUN STATE AND SMALL HELPERS ======
const state = {};
const easeOut = (u) => 1 - (1 - u) * (1 - u);
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const ZERO = { ox: 0, oy: 0, rot: 0 };
const pidx = (id) => PARTS.findIndex((q) => q.id === id);
const mkPart = (d, armour) => ({ d, armour, cx: d.x, cy: d.y, slot: false, cut: false, hp: TUNING.part.hp, dents: 0, cracks: [], gashes: [], flash: 0, clang: 0, cool: 0 });
const has = (id) => (!!state.picks && state.picks.includes(id)) || (!!state.wares && state.wares.includes(id));
const count = (id) => (state.picks ? state.picks.filter((q) => q === id).length : 0) + (state.wares ? state.wares.filter((q) => q === id).length : 0);
// what the keystones take away
const noDodge = () => has('ironwall') || has('titan');
const noShield = () => has('untouch');
function pickW(rng, list) { let tot = 0; for (const e of list) tot += e[1]; let r = rng() * tot; for (const e of list) { r -= e[1]; if (r < 0) return e[0]; } return list[list.length - 1][0]; }
const statMul = (k, v) => TUNING.stat[k][0] - TUNING.stat[k][1] * v;
// every shake goes through here: small (TUNING.juice.shake) and switchable
function shake(E, px, sec) { const J = TUNING.juice; if (J.shakeOn) E.shake(px * J.shake, sec); }

// ====== ROLLS: your fighter, the gauntlet, and each run and bout set up from the seed ======
// Your fighter, rolled once at setup on eight weighted wheels (size, three stats, armour, weapon, origin, reason). Each wheel's landing is decided here; the wheels only show it.
// idx follows the wheels' order on screen.
const ME_WHEEL = ['size', 'stat', 'stat', 'stat', 'armour', 'weapon', 'origin', 'reason'];
function platesFor(rng, set) {
  const A = TUNING.me.armour[set], plates = rng.shuffle(['head', 'chest', 'legs']).slice(0, A.n);
  if (A.arm) plates.push('armB');
  return plates;
}
// open: what the ludus has opened (save key `ludus`), kept on the fighter so its wheels and its deal stay as rolled
function rollMe(seed, open = []) {
  const rng = makeRng(seed ^ 0x2545f491), W = TUNING.me.wheels;
  const spin = (list) => pickW(rng, list.map((e, i) => [i, e[1]]));
  // each stat wheel is shaped by your band and the stat before it (wheelList), so they are spun in order
  const idx = [spin(W.size)];
  for (let k = 1; k <= 3; k++) idx.push(spin(wheelList(k, idx)));
  idx.push(spin(W.armour));
  const plates = platesFor(rng, W.armour[idx[4]][0]);
  const origin = spin(wheelList(6, idx, open)), reason = spin(wheelList(7, idx, open)), pick = rng.pick(MY_NAMES);
  const [name, sex] = ORIGINS[W.origin[origin][0]].female && pick[1] !== 'f' ? herName(pick) : pick;
  // the weapon is rolled last, after the name, so adding the wheel did not change what a seed rolls for the rest; then your height inside your band
  const weapon = spin(wheelList(5, idx, open)), mace = rng.chance(TUNING.me.mace), cardRoll = rng.int(0, 9999), vary = rng.range(-1, 1);
  idx.push(weapon, origin, reason);
  return deriveMe({ idx, plates, name, female: sex === 'f', mace, cardRoll, vary, open: open.slice() });
}
// Wheel k's slices for a fighter whose earlier wheels landed at idx: a stat wheel takes its tier's weights (TUNING.me.statTiers); a slice the ludus has
// not opened weighs nothing (open: the fighter's `open`, or null for the plain wheel).
function wheelList(k, idx, open = null) {
  const W = TUNING.me.wheels, key = ME_WHEEL[k];
  if (key !== 'stat') return open ? W[key].map((e) => (LUDUS_LOCK.has(e[0]) && !open.includes(e[0]) ? [e[0], 0, e[2], e[3]] : e)) : W[key];
  const w = TUNING.me.statTiers[statTier(k, idx).tier];
  return W.stat.map((e, i) => [e[0], w[i], e[2]]);
}
// A stat wheel's tier (L8): B, tilted by your band and shifted by the stat wheel before it, within D to S; with its causes, which the roll scene shows.
function statTier(k, idx) {
  const M = TUNING.me, O = M.tierOrder, band = M.wheels.size[idx[0]][0], tilt = M.tilt[band][k - 1];
  const prev = k > 1 && idx[k - 1] != null ? M.chain[M.wheels.stat[idx[k - 1]][0] - 1] : 0;
  return { tier: O[clamp(O.indexOf('B') + tilt + prev, 0, O.length - 1)], tilt, prev, band };
}
// everything that follows from the wheels' landings
// `halves` is the saved name for the whole-heart count (the save shape did not change in 5b)
function deriveMe(me) {
  const M = TUNING.me, v = (k) => wheelList(k, me.idx)[me.idx[k]][0];
  const size = v(0), str = v(1), spd = v(2), sta = v(3), set = v(4), A = M.armour[set];
  const score = str + spd + sta + M.sizes[size].score + A.score;
  const tier = M.tiers.find((t) => score >= t[1])[0], underdog = score < M.underdog;
  return { ...me, size, str, spd, sta, set, weapon: v(5), origin: v(6), reason: v(7), score, tier, underdog, halves: M.sizes[size].hearts * M.heartsPerBase + (underdog ? M.underdogHalves : 0) };
}
// The respin: wheel k rolled again with its own seeded stream, by its odds but never landing where it was. A new armour set re-rolls its plates.
function respinMe(me, k, seed) {
  const rng = makeRng((seed ^ 0x6c8e9cf5) + k * 7919), list = wheelList(k, me.idx, me.open || []);
  const idx = me.idx.slice();
  idx[k] = pickW(rng, list.map((e, j) => [j, j === me.idx[k] ? 0 : e[1]]));
  // a new origin that needs a woman's name moves yours to one
  const nm = k === 6 && ORIGINS[list[idx[k]][0]].female && !me.female ? herName(MY_NAMES.find((n) => n[0] === me.name) || MY_NAMES[0]) : null;
  return deriveMe({ ...me, idx, plates: k === 4 ? platesFor(rng, list[idx[k]][0]) : me.plates.slice(), mace: k === 5 ? rng.chance(TUNING.me.mace) : me.mace, ...(nm ? { name: nm[0], female: true } : {}) });
}
// A veteran from the Wall of Champions: the rolls they cleared their arena with, plus one point on the stat chosen when they were carved (TUNING.ludus.vetUp),
// with their scar line; never more, however often they win again
function vetMe(c, open = [], extra = '') {
  const idx = c.me.idx.slice();
  if (c.up) idx[c.up] = Math.min(TUNING.ludus.vetCap, idx[c.up] + TUNING.ludus.vetUp);
  return deriveMe({ ...c.me, idx, plates: c.me.plates.slice(), open: open.slice(), extra, vid: c.id, up: c.up || 0, scar: c.scar });
}
// A fighter's size: his band's row at his scale (the band's, varied by vary x TUNING.sizeVary), with every effect read off the bands' rows at that
// scale, a straight line between the two rows either side (and past the end rows). Your arm reach and hand lag follow the same way; hearts are by band.
const BAND = (id) => TUNING.sizes.find((z) => z.id === id);
function sizeOf(id, vary = 0) {
  const Z = TUNING.sizes, M = TUNING.me.sizes, b = BAND(id) || BAND('medium'), s = b.scale * (1 + clamp(vary, -1, 1) * TUNING.sizeVary);
  let i = 0;
  while (i < Z.length - 2 && s > Z[i + 1].scale) i++;
  const a = Z[i], c = Z[i + 1], u = (s - a.scale) / (c.scale - a.scale), at = (A, C, k) => A[k] + (C[k] - A[k]) * u;
  return { id: b.id, name: b.name, band: Z.indexOf(b), vary, scale: s, hp: at(a, c, 'hp'), reach: at(a, c, 'reach'), dmg: at(a, c, 'dmg'), wind: at(a, c, 'wind'), step: at(a, c, 'step'),
    arm: at(M[a.id], M[c.id], 'arm'), lag: at(M[a.id], M[c.id], 'lag') };
}
// your size (cached on your band and height), weapon and stat multipliers
let meSz = null;
function meSize() {
  const me = state.me, key = `${me.size}:${me.vary || 0}`;
  if (!meSz || meSz.key !== key) meSz = { ...sizeOf(me.size, me.vary || 0), key };
  return meSz;
}
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

// One fighter of the gauntlet, rolled from the bout's tables: a size band by its weight and his height in it, weapon, armour set, and three 1-5 stats
// from his points and profile (rollStats). tier is his gauntlet row, at his place in the arena's run; a champion is picked from the arena's pool.
function rollFighter(rng, tier, weapon, used, A = ARENAS[0], at = tier) {
  const G = GAUNTLET[tier], T = TUNING;
  let band, set;
  for (let k = 0; k < 20; k++) {
    band = pickW(rng, G.sizes);
    const ai = rng.pick(G.armour);
    set = T.armourSets.find((z) => z.id === ai);
    if (!used.has(`${band}${weapon.id}${set.id}`)) break;
  }
  used.add(`${band}${weapon.id}${set.id}`);
  const size = sizeOf(band, rng.range(-1, 1)), st = rollStats(rng, tier, size, A);
  const pick = G.champion ? rng.pick(A.champs) : rng.pick(NAMES), C = NEW_CHAMPS[pick];
  if (C && C.weapon) weapon = TUNING.weapons.find((z) => z.id === C.weapon);
  return { tier, at, name: C ? C.name : pick, ck: C ? pick : null, title: C ? C.title || null : null, pair: null, champion: !!G.champion, size, prof: st.prof, weapon, set, str: st.v[0], spd: st.v[1], sta: st.v[2],
    shield: rng.chance(weapon.shield), mace: rng.chance(0.5), partSeed: (rng() * 2 ** 32) >>> 0 };
}
// His stats (TUNING.foeStats): the row's points (plus a champion's, plus the arena's shift for each stat), split by a profile rolled with his band's
// weights (a beast's own, w), a little seeded jitter, each 1 to 5. His weakest stat (on a tie, the one his profile gives least) is held to the weakness cap,
// and its spare points go to the others while they have room, so every foe has an opening to read.
function rollStats(rng, tier, size, A, w = null) {
  const F = TUNING.foeStats, P = TUNING.profiles, G = GAUNTLET[tier], cap = G.champion ? F.champWeak : F.weak;
  const prof = pickW(rng, Object.keys(P).map((id) => [id, w ? w[id] : P[id].w[size.band]])), sh = P[prof].share;
  const budget = clamp(F.budget[tier] + (G.champion ? F.champ : 0) + Math.round(3 * TUNING.arenas[A.id].shift), 3, 10 + cap);
  const raw = sh.map((q) => budget * q + rng.range(-F.jitter, F.jitter)), v = raw.map((r) => clamp(Math.floor(r), 1, 5)), I = [0, 1, 2];
  const sum = () => v[0] + v[1] + v[2], left = (i) => raw[i] - v[i];
  while (sum() < budget) { const up = I.filter((i) => v[i] < 5).sort((a, b) => left(b) - left(a)); if (!up.length) break; v[up[0]]++; }
  while (sum() > budget) v[I.filter((i) => v[i] > 1).sort((a, b) => left(a) - left(b))[0]]--;
  const weak = I.slice().sort((a, b) => v[a] - v[b] || sh[a] - sh[b] || raw[a] - raw[b])[0];
  if (v[weak] > cap) {
    let spare = v[weak] - cap;
    v[weak] = cap;
    for (const i of I.filter((j) => j !== weak).sort((a, b) => sh[b] - sh[a] || raw[b] - raw[a])) { const add = Math.min(spare, 5 - v[i]); v[i] += add; spare -= add; }
  }
  return { prof, v };
}
// the profile whose shares sit nearest these stats (a rival saved before profiles)
function profileOf(d) {
  const P = TUNING.profiles, t = d.str + d.spd + d.sta, err = (id) => P[id].share.reduce((e, q, i) => e + (q - [d.str, d.spd, d.sta][i] / t) ** 2, 0);
  return Object.keys(P).sort((a, b) => err(a) - err(b))[0];
}
// A beast of the gauntlet: its kind's band at a seeded height in it, its stats from the row's points split by a profile its kind leans to (the weakness
// rule holds), a seeded epithet. Its "weapon" is its kind's numbers (TUNING.beasts) and its hide is no armour: no plates, no shield, no gear, no guard.
const beastWeapon = (kind) => ({ ...TUNING.beasts[kind], id: kind, name: 'CLAWS', len: 0, combo: [1, 1], shield: 0, drain: 0 });
const beastSet = (kind) => ({ id: 'beast', name: 'HIDE', plates: [0, 0], helmet: false, slots: BEAST_BODY[kind].slots.length });
function rollBeast(rng, tier, kind, A, at, young = false) {
  const B = TUNING.beasts[kind], band = young ? TUNING.sizes[Math.max(0, TUNING.sizes.indexOf(BAND(B.band)) - TUNING.beastYoung)].id : B.band;
  const size = sizeOf(band, rng.range(-1, 1)), st = rollStats(rng, tier, size, A, B.prof);
  return { tier, at, name: young ? `Young ${BEASTS[kind].name.toLowerCase()}` : BEASTS[kind].name, young, ck: null, title: null, pair: null, champion: false, beast: kind, epithet: rng.pick(BEASTS[kind].epithets), size, prof: st.prof,
    weapon: beastWeapon(kind), set: beastSet(kind), str: st.v[0], spd: st.v[1], sta: st.v[2], shield: false, mace: false, partSeed: (rng() * 2 ** 32) >>> 0 };
}
// a fighter from a saved rival record, on the rolled one's place (a beast, the Beastmaster's lion, from its own)
function fromRival(c, rv) {
  if (rv.beast && BEASTS[rv.beast] && BAND(rv.size)) {
    return { ...c, name: BEASTS[rv.beast].name, ck: null, title: null, champion: false, beast: rv.beast, epithet: rv.epithet || BEASTS[rv.beast].epithets[0], size: sizeOf(rv.size, rv.vary || 0), prof: rv.prof || profileOf(rv),
      weapon: beastWeapon(rv.beast), set: beastSet(rv.beast), str: rv.str, spd: rv.spd, sta: rv.sta, shield: false, mace: false, partSeed: rv.partSeed >>> 0, gaps: {} };
  }
  const T = TUNING, weapon = T.weapons.find((z) => z.id === rv.weapon), set = T.armourSets.find((z) => z.id === rv.set);
  if (!BAND(rv.size) || !weapon || !set) return null;
  return { ...c, name: rv.name, ck: rv.ck || null, title: rv.title || null, rival: true, champion: rv.champion != null ? rv.champion : c.champion, size: sizeOf(rv.size, rv.vary || 0), prof: rv.prof || profileOf(rv), weapon, set, str: rv.str, spd: rv.spd, sta: rv.sta, shield: !!rv.shield, mace: !!rv.mace, partSeed: rv.partSeed >>> 0, gaps: rv.gaps || {} };
}

// The arena's gauntlet. A saved rival takes the champion's place: the same man, look and weapon as the one who cut you down (and his partner, in a pair).
// From the arena's pairs bout on, each bout has a second foe waiting, rolled from the same row on his own stream; the Twins' second is Pollux, a champion
// too, and Hermes's partner is an ordinary man from the row below.
function rollGauntlet(seed, rival, A = ARENAS[0]) {
  const rng = makeRng(seed ^ 0x51ed270b), used = new Set(), W = TUNING.weapons, rows = A.rows;
  const order = rng.shuffle(W.map((_, i) => i));
  const g = rows.map((row, i) => rollFighter(rng, row, W[i < order.length ? order[i] : rng.int(0, W.length - 1)], used, A, i));
  const pr = makeRng(seed ^ 0x6a09e667);
  g.forEach((d, i) => {
    if (i < TUNING.arenas[A.id].pairs) return;
    const twin = d.ck === 'twins', row = d.champion && !twin ? d.tier - 1 : d.tier;
    let q;
    for (let k = 0; k < 6 && (!q || g.some((o) => o.name === q.name || (o.pair && o.pair.name === q.name))); k++) q = rollFighter(pr, row, pr.pick(W), used, A, i);
    d.pair = twin ? { ...q, name: NEW_CHAMPS.twins.pair, ck: null, title: null } : { ...q, champion: false, ck: null, title: null };
  });
  // the Colosseum: its beast bouts are a lion or a bear (on their own stream), and the Beastmaster's lion waits at the edge as his partner
  const br = makeRng(seed ^ 0x1f83d9ab), AT = TUNING.arenas[A.id];
  for (const i of AT.beasts || []) if (g[i]) g[i] = rollBeast(br, g[i].tier, br.pick(Object.keys(BEASTS)), A, i, (AT.young || []).includes(i));
  g.forEach((d, i) => { const C = NEW_CHAMPS[d.ck]; if (C && C.beast) { d.pair = rollBeast(pr, d.tier, C.beast, A, i); d.sends = true; } });
  const c = g[g.length - 1], rv = rival && fromRival(c, rival);
  if (rv) {
    // a rival keeps his own partner; one who sends no beast never borrows the rolled Beastmaster's lion
    const C = NEW_CHAMPS[rv.ck], cp = c.pair && c.pair.beast && !(C && C.beast) ? null : c.pair;
    g[g.length - 1] = rv; rv.sends = !!(C && C.beast); rv.pair = rival.pair ? fromRival({ ...(c.pair || c), pair: null }, rival.pair) || cp : cp;
  }
  // his gear and gap guards, on their own stream so the fighters above roll as they always did (a pair's second on another); a rival keeps the gear he wore
  const gr = makeRng(seed ^ 0x2f6b9a17), gp = makeRng(seed ^ 0x3c6ef373);
  const kit = (d, src, rec) => { const gear = rollGear(src, d, d.tier, A), guards = rollGuards(src, d, d.tier, A); d.gear = d.rival && rec && rec.gear ? rec.gear.slice() : gear; d.guards = guards; };
  g.forEach((d) => kit(d, gr, rival));
  g.forEach((d) => { if (d.pair) kit(d.pair, gp, rival && rival.pair); });
  return g;
}
const rivalOf = (d) => ({ name: d.name, ck: d.ck || null, title: d.title || null, champion: !!d.champion, size: d.size.id, vary: d.size.vary, prof: d.prof, weapon: d.weapon.id, set: d.set.id, str: d.str, spd: d.spd, sta: d.sta, shield: d.shield, mace: d.mace, partSeed: d.partSeed,
  gear: (d.gear || []).slice(), gaps: { ...(d.gaps || {}) }, pair: d.pair ? rivalOf(d.pair) : null, ...(d.beast ? { beast: d.beast, epithet: d.epithet } : {}) });
// His gear from the deck: more pieces in later bouts, one a slot, up to the bout's rarity; a champion also wears a legendary. A shield piece only on a
// shield-bearer, and the cape that bans the shield only on a man without one.
function rollGear(rng, d, i, A = ARENAS[0]) {
  if (d.beast) return [];
  const F = TUNING.foeGear, out = [], fams = ['wall', 'blood', 'dancer', 'brute', 'trick', 'show', 'rare'], n = F.n[i] + TUNING.arenas[A.id].gear;
  const ok = (c) => c.slot && !out.some((id) => CARD[id].slot === c.slot) && (c.slot !== 'shield' || d.shield) && !(c.bans === 'shield' && d.shield);
  if (d.champion) { const L = DECK.filter((c) => c.key && ok(c)); out.push(rng.pick(L).id); }
  for (let k = 0; k < 30 && out.length < n; k++) {
    const fam = rng.pick(fams), list = DECK.filter((c) => c.fam === fam && !c.key && c.tier <= F.rar[i] && ok(c));
    if (list.length) out.push(rng.pick(list).id);
  }
  return out;
}
// His gap guards: never in bout 1, at least TUNING.guard.open gaps left open, a chance of one (and then of a second) rising by bout, the champion always one,
// the gorget the most common. A rival first guards the gap you hit most against him.
function rollGuards(rng, d, i, A = ARENAS[0]) {
  if (d.beast) return [];
  const G = TUNING.guard, S = TUNING.arenas[A.id].guard, open = foeParts(makeRng(d.partSeed), d.set).filter((q) => q.slot).map((q) => q.d.id), room = Math.max(0, open.length - G.open), out = [];
  let n = rng.chance(Math.min(1, G.one[i] + S[0])) ? (rng.chance(Math.min(1, G.two[i] + S[1])) ? 2 : 1) : 0;
  if (d.champion) n = Math.max(n, 1);
  if (GAUNTLET[i].spar) n = 0;
  const gaps = d.rival && d.gaps, best = gaps && open.filter((id) => gaps[id] > 0).sort((a, b) => gaps[b] - gaps[a])[0];
  if (best && n > 0) out.push(best);
  while (out.length < Math.min(n, room)) out.push(pickW(rng, open.filter((id) => !out.includes(id)).map((id) => [id, G.w[id]])));
  return out;
}
// the guarded gaps are shut: drawn as their guard, and hit as a guard
function guardParts(parts, guards) { for (const q of parts) if (q.slot && (guards || []).includes(q.d.id)) q.guard = true; return parts; }

// one foe as he stands at the bout's start, from his gauntlet record (a pair's foes each have their own health, stamina, parts and gear)
function makeFoe(d, pair) {
  const FT = TUNING.foe, f = { ...d };
  f.wname = d.weapon.alt && d.mace ? d.weapon.alt : d.weapon.name;
  f.parts = d.beast ? beastParts(d.beast) : guardParts(foeParts(makeRng(d.partSeed), d.set), d.guards); f.look = d.beast ? null : foeLook(d); f.cloak = null; f.bp = null;
  f.maxHp = Math.round(FT.hp * d.size.hp * (1 + FT.tierHp * d.tier) * (d.champion ? FT.champHp : 1) * (pair ? TUNING.pairs.hp : 1)); f.hp = f.maxHp; f.shown = f.hp;
  f.staMax = TUNING.foeSta.base + TUNING.foeSta.per * d.sta; f.sta = f.staMax; f.staT = 9; f.staShown = 1;
  f.home = d.weapon.range + d.size.reach; f.strike = d.weapon.strike + d.size.reach;
  f.th = REST_TH; f.dx = 0; f.dy = 0; f.a = 0; f.fr = {}; f.down = false; f.bleed = []; f.dents = 0; f.shrug = false;
  return f;
}
function newRack(E) {
  const d = state.gauntlet[state.rack];
  state.foe = makeFoe(d, !!d.pair); state.edge = d.pair ? makeFoe(d.pair, true) : null;
  state.swapping = false; state.tauntT = 0; state.taunt = ''; state.sent = false; state.sendT = 0;
  state.rng = makeRng(state.seed + state.rack * 7919);
  state.cover = null; state.step = { x: state.foe.home, tgt: 0, t: 1, dodgeT: 0, dodgeCool: 0 };
  state.pop = 1; state.fallT = 0; state.sw = null; state.move = null; state.plan = null; state.stun = 0; state.stagger = 0; state.kickA = 0; state.kickV = 0;
  state.winded = 0; state.windedMax = 1; state.retreat = 0; state.chase = 0; state.mood = { retreat: false };
  state.mem = { blocks: [], lunges: [], turtle: 0, feints: [] };
  state.gapOpen = null; state.ownT = -9; state.recT = -9; state.baitT = 0; state.puppetN = 0; state.awed = false; state.lng = null; state.foeNet = 0; state.you.drive = 0; state.you.dk = 0; state.burnT = 0;
  state.swingIn = 1.2; state.intro = true; state.introT = 0; state.warm = false;
  if (state.me.reason === 'glory') chant(E);
  saveRun(E);
  settleFeint('none');
  state.bout = { felled: false, shrugged: false, foeShrug: false, bread: false, net: false, gaps: {}, perf: state.perfects, slot: state.slotHits, read: state.feintsRead, pun: state.punishes, taken: state.taken, dodge: state.dodged, lame: state.lamings };
  state.open = 0; state.riposte = 0; state.slowT = 0; state.snapT = 0;
  Object.assign(state, { slowFx: 0, slowMul: 1, zoomT: 0, dropT: 0, ghostT: 0, ghostAt: -9, ghosts: [], paintT: 0, banner: null, shatter: null, steps: { foe: null, me: null } });
  state.sh.hits = shieldMax(); state.sh.broken = false; state.sh.cool = 0; state.sh.blocked = false;
  // both fighters start each bout back on their marks
  Object.assign(state.foot, { pos: 0, tgt: 0, v: 1, wallT: -9, foeWallT: -9 });
  state.mom = 0; state.momT = 0; state.bleed = []; state.bleedT = 0; state.lastTellDodge = -9;
  state.favM = state.m; state.favSum = 0; state.favDur = 0; state.finSel = '';
  state.armed = {}; state.openAll = 0; state.disarm = 0; state.flyW = 0; state.dents = 0; state.cape = 0;
  emit(E, 'start');
}

function nextGap() { const S = TUNING.swing; return S.gap * 0.6 + state.rng.range(0, S.gapSpread); }

function newRound(E, seed, me0, rv, arenaId = 'pit') {
  const M = TUNING.me, me = { ...me0, plates: me0.plates.slice() }, A = ARENA[arenaId] || ARENAS[0], rival = rv !== undefined ? rv : E.save.get('rivals', {})[A.id] || null;
  Object.assign(state, {
    me, maxHp: me.halves, staMax: M.staMax[me.sta - 1], lessons: E.save.get('feintLesson', 0), caption: null, slowT: 0,
    picks: [], grades: [], goods: [], draft: null, token: TUNING.token, tokenUsed: '', epicsSeen: 0, switchReads: 0, hint: false, boutT0: 0, stepsIn: 0, stepsOut: 0, wallHits: 0, foeWall: 0, outReach: 0, dodged: 0, chases: 0, shrugs: 0, rivalBeaten: 0,
    foot: { pos: 0, tgt: 0, v: 1, wallT: -9, foeWallT: -9 },
    seed, arena: A.id, rng: makeRng(seed ^ 0x9e3779b9), gauntlet: rollGauntlet(seed, rival, A), results: [], rack: 0, m: 0, stop: 0, kickA: 0, kickV: 0,
    hp: me.halves, endT: 0, dodgeT: 0, dodgeMax: TUNING.dodge.dur, dodgeCool: 0, away: false, dodgeM: -9, hurt: 0, done: false, exhaust: 0, exMsg: -9, lunging: false, lunges: 0, lungeMiss: false, slotHits: 0, dg: { down: false, id: -1, t: 0 },
    stamina: M.staMax[me.sta - 1], lastAtk: -9, riposte: 0, open: 0, netT: 0, pushT: 0,
    gapHits: 0, clangs: 0, broken: 0, overheads: 0, jabs: 0, slashes: 0, blocks: 0, perfects: 0, dodges: 0, staOuts: 0, counters: 0, counterHits: 0, taken: 0, felled: 0,
    feints: 0, feintsRead: 0, feintsBit: 0, feintsNone: 0, feintLive: false, plateSaves: 0, combos: 0, windeds: 0, punishes: 0, bashes: 0, bashHits: 0, nets: 0, netted: 0, zoneReads: 0, lungeReads: 0, turtleReads: 0, presses: 0, retreats: 0, moveCount: {},
    fx: [], pops: [], streaks: [], trail: [],
    mom: 0, momT: 0, momGained: 0, momSpent: 0, lamings: 0, gold: 0, goldEarned: 0, lastGold: null, bought: [], rerolls: 0, tent: null, tentDone: false, lab: null, labMom: false, labUsed: 0, fins: [], wares: [], carry: 0, capCut: 0, ownFeints: 0, feintsLearned: 0, flourishes: 0, netsCast: 0, foeNet: 0, fl: { acc: 0, t: 0, ang: null, at: -9, fx: 0, fy: 0 }, armed: {}, openAll: 0, disarm: 0, flyW: 0, dents: 0, cape: 0, bleed: [], bleedT: 0, bleeds: 0, bleedDmg: 0,
    you: { lunge: 0, lungeK: 0, drive: 0, dk: 0, a: 0, back: 0, hopY: 0, push: 0, parts: playerParts(me), fr: {} }, drives: 0, driveDist: 0, burn: 0, burnT: 0, spoils: 0, landM: -9,
    foe: {}, edge: null, swapping: false, tauntT: 0, taunt: '',
    fav: 0, favStep: 0, favT: 0, favShown: 0, favM: 0, favSum: 0, favDur: 0, lastHitM: -9, opened: null, finSel: '', finHintT: 0, hintT: 0, hintS: '',
    crowd: [],
    sh: { t: -1, cool: 0, up: 0, hits: TUNING.shield.hits, broken: false, flash: 0, zone: ZONES[1], held: false, hid: -1, heldAt: -9, zy: -0.58, arm: 0, blocked: false, pressT: -9 },
    hand: { down: false, id: -1, fx: 0, fy: 0, tgx: 0, tgy: 0, ux: 0, uy: 0, pux: 0, puy: 0, hx: 0, hy: 0, phx: 0, phy: 0, ex: 0, ey: 0, sx: 0, sy: 0, bx: 1, by: 0, ang: 0, pang: 0, ph: 0, vx: 0, vy: 0, along: 0, hvx: 0, hvy: 0, lock: 0, grip: 0, sp: 0, raisedT: -9, atk: null },
  });
  for (const c of startCards(me)) applyCard(c);
  // the ludus: the fourth card in the first draft (training ground), and the tailor's looks on you
  const L = E.save.get('ludus', []);
  state.fourth = L.includes('fourth'); state.tailor = tailorOf(E);
  const cr = makeRng(seed ^ 0x1234567);
  for (let i = 0; i < 70; i++) state.crowd.push({ x: cr.range(0, 1), y: cr.range(0, 1), r: cr.range(2, 4), c: cr.int(0, 3) });
}
// your background's start card: a common of its family (or START_ALT's while the ludus shuts it), picked by the roll
function startCard(me) {
  const f0 = START_FAM[ORIGINS[me.origin].noun], fam = famOpen(me, f0) ? f0 : START_ALT[f0], list = DECK.filter((c) => c.fam === fam && c.tier === 0);
  return list[(me.cardRoll || 0) % list.length];
}
// every card a run starts with: the background's, then the training ground's slot (me.extra, a card picked before), which takes its slot if both need it
function startCards(me) {
  const sc = startCard(me), x = me.extra && CARD[me.extra];
  if (!x || x.id === sc.id) return [sc];
  return x.slot && x.slot === sc.slot ? [x] : [sc, x];
}
// the tailor's looks you wear: each one bought and switched on, its style's colour
function tailorOf(E) {
  const L = E.save.get('ludus', []), T = E.save.get('tailor', {}), out = {};
  for (const k of Object.keys(TAILOR)) if (L.includes(k) && T[k] != null && T[k] >= 0 && TAILOR[k][T[k]]) out[k] = { i: T[k], col: TAILOR[k][T[k]][1] };
  return out;
}
// The run is saved at the start of each bout (the run's counts, your fighter and the bout reached) and resumed there; the bout itself replays from its seed.
const RUN_KEYS = ['hp', 'maxHp', 'staMax', 'picks', 'grades', 'results', 'token', 'tokenUsed', 'epicsSeen', 'switchReads', 'stepsIn', 'stepsOut', 'wallHits', 'foeWall', 'outReach', 'dodged', 'chases',
  'capCut', 'shrugs', 'gapHits', 'slotHits', 'lunges', 'clangs', 'broken', 'overheads', 'jabs', 'slashes', 'blocks', 'perfects', 'dodges', 'staOuts', 'counters', 'counterHits', 'taken', 'felled',
  'feints', 'feintsRead', 'feintsBit', 'feintsNone', 'combos', 'windeds', 'punishes', 'bashes', 'bashHits', 'nets', 'netted', 'zoneReads', 'lungeReads', 'turtleReads', 'presses', 'retreats', 'plateSaves', 'moveCount',
  'gold', 'goldEarned', 'wares', 'tentDone', 'bought', 'rerolls', 'momGained', 'momSpent', 'lamings', 'bleeds', 'bleedDmg', 'ownFeints', 'feintsLearned', 'flourishes', 'fins', 'carry', 'labUsed', 'fav', 'favStep',
  'fourth', 'netsCast', 'drives', 'driveDist', 'spoils'];
// A deep copy, since the engine flushes the save whenever the page is hidden, long after the live objects have moved on. `rack` is the bout to resume at;
// an open draft is saved too (its card ids), and resumes at the bout just felled with the same cards.
function saveRun(E, rack = state.rack) {
  const c = state.gauntlet[state.gauntlet.length - 1];
  const d = state.draft, draft = d ? { grade: d.grade, tally: d.tally, gold: d.gold, ids: d.cards.map((q) => q.id), priced: d.priced, odds: d.odds, spoil: d.spoil || null } : null;
  E.save.set('run', JSON.parse(JSON.stringify({ seed: state.seed, arena: state.arena, rack, me: state.me, rival: c.rival ? rivalOf(c) : null, draft, ...Object.fromEntries(RUN_KEYS.map((k) => [k, state[k]])) })));
}
function resumeRun(E, run) {
  newRound(E, run.seed, run.me, run.rival, run.arena);
  for (const k of RUN_KEYS) if (k in run) state[k] = run[k];
  state.results = (run.results || []).map((q) => q || undefined);
  // a run saved before whole hearts can hold a half: round it up so no part-heart is drawn
  state.hp = Math.ceil(state.hp); state.maxHp = Math.ceil(state.maxHp);
  state.rack = run.rack; state.you.parts = playerParts(state.me); state.stamina = state.staMax; state.favShown = state.fav;
  const d = run.draft;
  if (d) state.draft = { grade: d.grade, tally: d.tally, gold: d.gold, cards: d.ids.map((id) => CARD[id]), priced: d.priced, odds: d.odds || [], t: 0, btns: [], reroll: null, help: null, helpOn: 0, spoil: d.spoil || null };
}

// ====== FIGHTER MODEL: layout, your body and sword arm, footwork, defence, the foe's body ======
// ----- layout and frames -----
// In a pairs bout the waiting foe takes the screen's right edge, so the frame slides left (by the worst of the two foes in either place) until the one
// fighting keeps clear of him when he gives ground to his wall. A beast is long: in its bout the frame also shrinks (TUNING.beastFit) until it fits with
// a short slide, the beast at its home plus room, or the pair in either place.
function lay(E) {
  const F = TUNING.fighter, f = state.foe, e = state.edge, kMax = Math.max(state.me ? meSize().scale : 1, f && f.size ? (f.beast ? drawK(f) * beastOf(f).tall : f.size.scale) : 1);
  let H = E.h * F.height * Math.min(1, F.fit / kMax);
  // the frame is centred on the space right of the left column (partly, so the foe keeps room too)
  const R = colRect(E), c0 = E.w / 2 + TUNING.col.frame * ((R.x + R.w + (E.w - E.safe.right)) / 2 - E.w / 2), g2 = E.w * F.gap / 2;
  const pair = !!(e && f && f.size && e.size), solo = !pair && !!(f && f.beast), lim = E.w - E.safe.right - (pair ? 4 : 12);
  // how far right of the frame's edge each arrangement reaches (H): the one fighting at his wall, and the one waiting
  const need = pair ? Math.max(reachR(f) + waitW(e), reachR(e) + waitW(f)) : solo ? f.home + TUNING.beastFit.room + rearOf(f) : 0;
  if ((f && f.beast) || (e && e.beast)) { const BF = TUNING.beastFit; H = clamp((lim - c0 - g2) / (F.body + need - BF.slide), H * BF.min, H); }
  const half = g2 + F.body * H, cx = c0 - (pair || solo ? Math.max(0, c0 + half + need * H - lim) : 0);
  return { H, floor: E.h * F.floor, x0: cx - half, x1: cx + half };
}
// a beast's numbers (TUNING.beasts), or null for a man
const beastOf = (f) => (f && f.beast ? TUNING.beasts[f.beast] : null);
// the scale a foe is drawn at: his band's, and a beast's body unit against a man's
const drawK = (f) => f.size.scale * (f.beast ? TUNING.beasts[f.beast].draw : 1);
// how far a foe reaches behind the line a medium man's near edge stands on (H): a man's body, or a beast from nose to rump
function rearOf(f) { const B = beastOf(f), k = drawK(f); return B ? k * (B.front + B.back) - TUNING.fighter.body : (k - 1) * TUNING.fighter.body + TUNING.pairs.fbody * k; }
// the one fighting in a pair, at his wall (his home and the room past it), and the one waiting at the edge: his centre from the edge, and his near half
const reachR = (f) => f.home + TUNING.pairs.room + rearOf(f);
const pairScale = () => ((state.foe && state.foe.beast) || (state.edge && state.edge.beast) ? TUNING.pairs.beastScale : TUNING.pairs.scale);
const edgeX = (f) => (f.beast ? beastOf(f).back + 0.06 : TUNING.pairs.x);
const waitW = (f) => (edgeX(f) + (f.beast ? beastOf(f).front : TUNING.pairs.body)) * drawK(f) * pairScale();
const waitLeft = (E, H, e) => E.w - E.safe.right - waitW(e) * H;
// you are drawn at your rolled size the same way: your near edge stays put
function youF(E) { const L = lay(E), y = state.you, k = meSize().scale; return { x: L.x0 + state.foot.pos * L.H + y.lunge - y.push * L.H - (k - 1) * TUNING.fighter.body * L.H, y: L.floor + y.hopY, a: y.a, dir: 1, H: L.H * k }; }
// The arena's edges, in H from each fighter's mark: how far you can give ground (negative) and how far he can, trimmed so both stay on screen, then
// brought in by the arena's ring (the Pit's tight ring; the sparring bout keeps the full room).
function walls(E) {
  const L = lay(E), T = TUNING.foot, k = state.foe.size ? state.foe.size.scale : 1, ring = bout().spar ? 1 : arenaT().ring;
  const back = Math.min(T.room[0], Math.max(0.1, (L.x0 - 0.2 * L.H * meSize().scale - colRect(E).x - colRect(E).w - T.margin) / L.H));
  const f = state.foe, fore = state.edge && state.edge.size ? Math.min(T.room[1], Math.max(0.1, (waitLeft(E, L.H, state.edge) - 4 - L.x1 - rearOf(f) * L.H) / L.H))
    : Math.min(T.room[1], Math.max(0.1, (E.w - E.safe.right - (f.beast ? 12 : 24) - L.x1 - (f.beast ? rearOf(f) : 0.3 * k) * L.H) / L.H));
  return { back: -back * ring, fore: fore * ring };
}
// the nearest the two can stand: the clear gap between the bodies at the marks, less a little air
const gMin = (E) => -(E.w * TUNING.fighter.gap) / lay(E).H + TUNING.foot.close;
// the gap between you now, in H, measured from where the marks put it
const gapNow = () => state.step.x - state.foot.pos;
// your body's place in the same units: your feet plus the lunge's stride; his reach is measured to it
const bodyPos = () => state.foot.pos + (state.you.lungeK * TUNING.lunge.stride + state.you.drive) * meSize().scale;
const inReach = (extra = 0) => state.step.x - bodyPos() <= state.foe.strike + TUNING.foot.reach + extra;
const myH = (E) => lay(E).H * meSize().scale;
const myArm = (E) => TUNING.arm.len * myH(E) * meSize().arm;
const myBlade = (E) => TUNING.blade.len * myH(E) * meWeapon().reach;
// the foe is drawn at his size: the frame's unit scales, his near edge (a beast's nose) stays where a medium fighter's would be
function foeF(E) {
  const L = lay(E), f = state.foe, k = f.size ? drawK(f) : 1, B = beastOf(f);
  return { x: L.x1 + f.dx + (B ? k * B.front - TUNING.fighter.body : (k - 1) * TUNING.fighter.body) * L.H, y: L.floor + f.dy, a: f.a, dir: -1, H: L.H * k };
}
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

// the guard: a relaxed, half-bent arm in front of the body, in screen px, on the body as it stands now
function guardPt(E) {
  const H = myH(E), [sx, sy] = toScreen(youF(E), SHOULDER[0], SHOULDER[1]), g = TUNING.control.guard;
  return [sx + g[0] * H, sy + g[1] * H];
}
// thumb offset from the anchor, times the gain, px
function relOff() { const h = state.hand, G = TUNING.control.gain; return [(h.fx - h.ax) * G, (h.fy - h.ay) * G]; }
function poseYou(E, dt) {
  const L = { H: myH(E) }, y = state.you, D = TUNING.dodge, h = state.hand, sh = state.sh;
  const LU = TUNING.lunge;
  state.burnT = Math.max(0, state.burnT - dt);
  // lunge: the thumb pushed far past the reach steps the gladiator in, up to a stride; he steps back when the hand relaxes or recoils
  let tk = 0;
  if (h.down && h.lock <= 0 && !state.away && state.exhaust <= 0 && state.endT <= 0 && state.fallT <= 0 && !(state.netT > 0 && TUNING.net.stuck)) {
    const [ox, oy] = relOff(), C = TUNING.control;
    tk = clamp((Math.hypot(ox, oy) / myArm(E) - C.lungeStart) / (C.lungeFull - C.lungeStart), 0, 1);
    if (tk > 0.1 && !state.lunging) {
      const lc = LU.cost;
      if (state.stamina >= lc) {
        state.stamina -= lc; state.lastAtk = state.m; state.lunging = true; state.lunges++; state.mem.lunges.push(state.m); swooshSound(E, 0.1);
        const Fy = youF(E); dust(Fy.x - 0.1 * Fy.H, Fy.y, TUNING.juice.lungeDust);
        if (gapNow() > state.foe.strike + TUNING.foot.reach) chaseIn();
        state.lng = { t0: state.m, pk: tk, d: 0, at: 0, near: 0, committed: !has('myfeint'), hit: false, ly: tipLy(E), dd: beyondLunge(E) ? LU.driveFar : LU.driveNear };
        if (h.atk && !h.atk.done) h.atk.lunge = true;
      }
      else { tk = 0; tiredPop(E); }
    } else if (tk < 0.05) endLunge(E, true);
    if (state.lunging && state.lng) { commitLunge(E, Math.hypot(ox, oy), tk, dt); drive(E, tk, dt); }
  } else endLunge(E);
  y.lungeK += (tk - y.lungeK) * (1 - Math.exp(-dt / (tk > y.lungeK ? LU.tauIn : LU.tauOut)));
  const dOn = driving();
  if (!state.lunging && y.drive > 0) { y.drive *= Math.exp(-dt / LU.driveOut); if (y.drive < 1e-3) y.drive = 0; }
  y.dk += ((dOn ? 1 : 0) - y.dk) * (1 - Math.exp(-dt / (dOn ? LU.tauIn : LU.driveOut)));
  y.lunge = (y.lungeK * LU.stride + y.drive) * L.H;
  const want = state.away ? 1 : 0;
  y.back += (want - y.back) * (1 - Math.exp(-dt / (want ? 0.05 : 0.14)));
  const u = state.dodgeT > 0 ? 1 - state.dodgeT / state.dodgeMax : 1;
  y.hopY = state.dodgeT > 0 ? -D.hop * L.H * Math.sin(Math.PI * u) : 0;
  y.push += ((state.pushT > 0 ? TUNING.moves.bash.push : 0) - y.push) * (1 - Math.exp(-dt / (state.pushT > 0 ? 0.05 : 0.25)));
  const LN = TUNING.lean, a = h.atk;
  // upright, sword leading; lean only on a fast slash whose aim lies past the straight arm's reach
  let leanT = LN.base;
  if (a && a.kind === 'slash' && h.down && h.lock <= 0 && h.sp >= TUNING.hit.mid * LN.fast) leanT += LN.max * clamp((Math.hypot(h.tgx - h.sx, h.tgy - h.sy) / L.H - LN.beyond) / LN.span, 0, 1);
  leanT = Math.min(leanT, LN.max) + LU.driveLean * y.dk - 0.22 * y.back;
  y.a += (leanT - y.a) * (1 - Math.exp(-dt / (leanT > y.a ? LN.tau : LN.back)));
  sh.zy += (sh.zone.sy - sh.zy) * (1 - Math.exp(-dt / 0.05));
  sh.up += ((raised() ? 1 : 0) - sh.up) * (1 - Math.exp(-dt / (raised() ? 0.045 : 0.12)));
  const [cx, cy] = shieldPos();
  y.fr = { armB: { ox: PARTS[4].joint[0], oy: PARTS[4].joint[1], rot: Math.atan2(cy - PARTS[4].joint[1], cx - PARTS[4].joint[0]) - Math.PI / 2 + 0.05 * Math.sin(state.m * 1.9) } };
}
// walking in is the lunge: its recovery plants your feet up to a pace forward, taking back ground you gave, never past your mark. A lunge pulled back with
// the thumb still down may be your own feint.
function endLunge(E, pulled) {
  if (!state.lunging) return;
  state.lunging = false;
  // pulled back with the thumb down it may be a feint; anything else lands what the blade met
  const feint = pulled && ownFeint(E);
  if (!feint && state.lng && !state.lng.committed) commit(E);
  if (!feint && state.lng && !state.lng.hit && state.landM < state.lng.t0 && state.endT <= 0 && state.fallT <= 0 && !E.save.get('driveHint', 0)) state.lungeMiss = true;
  const T = TUNING.foot, ft = state.foot;
  if (ft.pos >= 0) return;
  ft.tgt = Math.min(0, Math.max(ft.tgt, ft.pos) + T.pace); ft.v = T.pace / T.gainDur * gripMul(); state.stepsIn++;
}
// The drive: a committed lunge (never a feint still open) held at full depth presses on in short stamping steps, burning stamina. Drawn back under full
// depth it holds its ground until the lunge ends; what the blade meets, an empty tank or his body ends it for good. The recovery gives the ground back.
const driving = () => !!(state.lunging && state.lng && state.lng.dv && state.lng.dv.on && !state.lng.dEnd && state.lng.full >= state.lng.dd);
function drive(E, tk, dt) {
  const LU = TUNING.lunge, L = state.lng, y = state.you;
  if (!L.committed || L.dEnd) return;
  // what the blade met, in the lunge or the push that launched it, ends it
  if (L.hit || L.pend || state.landM > L.t0 - LU.driveNear) { L.dEnd = true; return; }
  // drawn back under full depth the body stops; going out again re-arms the drive
  if (tk < 1) { L.full = 0; if (L.dv) { L.dv.on = false; L.dv.t = 0; } return; }
  L.full = (L.full || 0) + dt;
  if (L.full < L.dd) return;
  const Fy = youF(E);
  if (!L.dv) L.dv = { t: 0, ph: 0, on: false };
  const D = L.dv, k = meSize().scale;
  D.t += dt; D.ph += dt * LU.driveHz;
  if (D.ph >= 1) { D.ph -= 1; stamp(E, Fy); }
  let v = LU.drive * Math.min(1, D.t / LU.driveRamp) * (1 + LU.driveSurge * Math.sin(TAU * D.ph)) * dt;
  // his body: stop a little short of it
  const room = Math.min(LU.driveMax - y.drive, (state.step.x - bodyPos() - gMin(E)) / k);
  if (v >= room) { v = Math.max(0, room); L.dEnd = true; }
  const cost = LU.driveCost * dt, sta0 = state.stamina;
  if (state.stamina <= cost) { v *= state.stamina / cost; state.stamina = 0; L.dEnd = true; } else state.stamina -= cost;
  if (v > 0 && !D.on) {
    // the body (re)starts moving: it carries the lunge's stab, its blade landing on what it reaches however slow the hand; a stab of its own pays a jab
    D.on = true;
    if (!L.counted) { L.counted = true; state.drives++; }
    state.burn = sta0;
    stamp(E, Fy);
    const h = state.hand;
    if (h.atk && !h.atk.done) h.atk.drive = true;
    else {
      const jc = TUNING.attack.jab.cost * meWeapon().cost;
      h.atk = { kind: 'jab', tired: state.stamina <= 0, done: false, cost: jc, drive: true };
      state.stamina = Math.max(0, state.stamina - jc);
    }
  }
  y.drive += v; state.driveDist += v; state.lastAtk = state.m; state.burnT = LU.driveBurn;
}
// Is he beyond what your plain lunge reaches? The clear air between the two fronts against the stride, your shoulder's lead and the arm and blade
// past it. A drive from beyond it starts at once (driveFar); within it the hold (driveNear) stays.
function beyondLunge(E) {
  const L = lay(E), B = TUNING.fighter.body, clear = (L.x1 - L.x0) + gapNow() * L.H - 2 * B * L.H;
  return clear > (TUNING.lunge.stride + SHOULDER[0] - B) * myH(E) + myArm(E) + myBlade(E);
}
const driveStab = (a) => !!a.drive && driving();
// each step of the drive plants the back foot: a kick of sand behind you and a dull footfall
function stamp(E, Fy) {
  const LU = TUNING.lunge, x = Fy.x - LU.driveFoot * Fy.H;
  sand(x, Fy.y, -1, LU.driveSand); dust(x, Fy.y, LU.driveDust);
  thud(E, LU.driveThud); E.haptic(LU.driveHaptic);
}
// your sword tip's height in his body units (y down, his feet at 0)
const tipLy = (E) => (state.foe && state.foe.size ? toLocal(foeF(E), state.hand.ux, state.hand.uy)[1] : 0);
// With the Feint worn, a lunge commits once the thumb settles at its furthest reach (or hold s after it began): what its blade met on the way (pend) lands
// then; until then its stab is kept (lungeStab). The furthest reach also marks the zone the tip threatened. Without the Feint a lunge commits at once.
function commitLunge(E, d, tk, dt) {
  const F = TUNING.myFeint, L = state.lng, slack = F.slack * myArm(E);
  if (tk > L.pk) L.pk = tk;
  if (d > L.d) { L.d = d; L.ly = tipLy(E); }
  // settled: the thumb has stayed in a slack-wide band at its furthest reach (moving further out or back starts the count again)
  if (d > L.at + slack || d < L.d - slack) { L.at = d; L.near = 0; } else L.near += dt;
  if (!L.committed && (L.near >= F.settle || state.m - L.t0 >= F.hold)) commit(E);
}
function commit(E) {
  const L = state.lng, a = state.hand.atk;
  L.committed = true;
  if (L.pend && a && !a.done) { a.done = true; state.stop = Math.max(state.stop, land(E, a, L.pend)); }
}
// the lunge's stab, kept alive while the lunge has not committed
const lungeStab = (a) => !!a.lunge && !!state.lng && !state.lng.committed;
// Your own feint (the Feint card): a lunge pulled back with the thumb still down before it committed. A blade that met any part or slot means a hit, never a
// feint; one held out until it commits is a lunge, landed or missed; one ended by lifting the thumb, too shallow, too quick (minAge) or while he swings never
// counts. He must be free to guard (not swinging, open, winded or stunned). It is not a lunge to his memory, but it costs a little stamina, and with his
// memory one too many in a while is read and countered (Unreadable: never). Returns whether it was a feint.
function ownFeint(E) {
  const F = TUNING.myFeint, L = state.lng;
  if (!has('myfeint') || !L || L.committed || L.hit || L.pend || L.pk < F.depth || state.m - L.t0 < F.minAge || !guardUp() || state.endT > 0) return false;
  const a = state.hand.atk;
  if (a && !a.done && a.cost) state.stamina = Math.min(state.staMax, state.stamina + a.cost);
  state.hand.atk = null; state.mem.lunges.pop();
  state.stamina = Math.max(0, state.stamina - F.cost); state.lastAtk = state.m;
  const zone = L.ly < F.high ? ZONE.high : L.ly > F.low ? ZONE.low : ZONE.mid, recent = state.mem.feints.filter((t) => state.m - t < F.learnWin).length;
  state.mem.feints.push(state.m); state.recT = state.m;
  if (memoryOn() && !has('unreadable') && recent >= F.learn) { state.feintsLearned++; readPop(E, 'READS YOUR FEINT'); counter(E); return true; }
  state.ownFeints++;
  fakeOut(E, zone);
  return true;
}
// He guards the zone you faked, and the open gap farthest from it opens for a moment (your feint, or a tell dodge with False Step)
function fakeOut(E, zone) {
  const f = state.foe, F = TUNING.myFeint, prev = state.ownT, near = (q) => Math.abs(q.cy - zone.y);
  const body = f.parts.filter((q) => !q.slot && !q.cut).sort((a, b) => near(a) - near(b))[0], p = f.parts.filter((q) => q.slot && !q.guard && !q.cut).sort((a, b) => near(b) - near(a))[0];
  if (body && guardUp()) setCover(body);
  state.ownT = state.m; state.gapOpen = p ? { p, t: F.open } : null;
  const Fy = youF(E); pop(Fy.x + 0.35 * Fy.H, Fy.y - 1.05 * Fy.H, 'FEINT!', '#c4b5fd', 22);
  if (p) { const [x, y] = partCenter(foeF(E), f, p); pop(x, y - 26, `${p.d.label} OPEN`, '#ffd24a', 18); ring(x, y, 44, '#ffd24a'); }
  E.audio.beep({ freq: 520, dur: 0.08, type: 'triangle', slide: 1.6, gain: 0.1 }); E.audio.noise({ dur: 0.04, gain: 0.08 }); E.haptic(10);
  emit(E, 'feint', { p, gap: state.m - prev });
}
// the gap your feint opened, while it is open
const openNow = (p) => !!state.gapOpen && state.gapOpen.p === p && state.gapOpen.t > 0;
// shield centre in body units: hanging at the hip, or raised to the zone
function shieldPos() {
  const sh = state.sh, J = PARTS[4].joint;
  return [lerp(J[0] + 0.3 * Math.cos(1.69), 0.2, sh.up), lerp(J[1] + 0.3 * Math.sin(1.69), sh.zy, sh.up)];
}

// ----- the sword arm: the aim point follows the finger, the arm stays straight on a circle round the shoulder and bends when the finger draws in -----
function solveArm(E, dt) {
  const h = state.hand, A = TUNING.arm, G = TUNING.grip, H = myH(E);
  const [sx, sy] = toScreen(youF(E), SHOULDER[0], SHOULDER[1]);
  const arm = myArm(E), blade = myBlade(E);
  const ax = h.tgx - sx, ay = h.tgy - sy, d = Math.hypot(ax, ay) || 1, dx = ax / d, dy = ay / d;
  const e = clamp((d / H - A.chamberAt) / (A.straightAt - A.chamberAt), 0, 1);
  const r = arm * (A.minFrac + (A.full - A.minFrac) * e);
  h.sx = sx; h.sy = sy; h.ang = Math.atan2(dy, dx);
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
    const [gx, gy] = guardPt(E), [ox, oy] = relOff();
    h.tgx += (clamp(gx + ox, 10, E.w - 10) - h.tgx) * k; h.tgy += (clamp(gy + oy, E.safe.top + 40, E.h - 10) - h.tgy) * k;
    if (h.grip > 0) h.grip -= dt;
  } else {
    const [rx, ry] = guardPt(E);
    const k = 1 - Math.exp(-dt / TUNING.control.back);
    h.tgx += (rx - h.tgx) * k; h.tgy += (ry - h.tgy) * k;
  }
  solveArm(E, dt);
  const iv = Math.max(dt, 0.001), vx = (h.ux - h.pux) / iv, vy = (h.uy - h.puy) / iv, inst = Math.hypot(vx, vy), kv = 1 - Math.exp(-dt / 0.03);
  h.vx += (vx - h.vx) * kv; h.vy += (vy - h.vy) * kv;
  // tip speed straight out from the shoulder
  h.along = h.vx * Math.cos(h.ang) + h.vy * Math.sin(h.ang);
  h.sp = h.down && h.lock <= 0 ? h.sp * 0.5 + inst * 0.5 : 0;
  if (h.hy < guardPt(E)[1] - TUNING.attack.over.raise * L.H) h.raisedT = state.m;
  state.trail.push({ x: h.ux, y: h.uy, life: 0.12 });
  for (const q of state.trail) q.life -= dt;
  state.trail = state.trail.filter((q) => q.life > 0);
}

// An attack is born when the tip gets fast, and is named by how it moves: straight out from the shoulder (jab), down after the hand was above the head (overhead),
// up (a free raise, no blow), or any other arc (slash). The cost is paid then.
function updateAttack(E, dt) {
  const h = state.hand, T = TUNING, AT = T.attack, S = T.stamina, sh = state.sh;
  const live = h.down && h.lock <= 0 && !state.away && state.endT <= 0 && state.fallT <= 0;
  if (h.atk && (!live || (h.sp < T.hit.minSpeed * 0.55 && !lungeStab(h.atk) && !driveStab(h.atk)))) h.atk = null;
  if (!h.atk && live && h.sp >= T.hit.minSpeed) {
    const spv = Math.hypot(h.vx, h.vy) || 1, ux = h.vx / spv, uy = h.vy / spv;
    // a jab is a push forward along the guard line, whatever the arm's aim
    const ga = Math.atan2(TUNING.control.guard[1], TUNING.control.guard[0]), along = (h.vx * Math.cos(ga) + h.vy * Math.sin(ga)) / spv;
    let kind = null;
    if (along > TUNING.control.jabCone) { if (spv >= AT.jab.minSpeed) kind = 'jab'; }
    else if (uy > 0.25 && state.m - h.raisedT < AT.over.window) { if (spv >= AT.over.minSpeed) kind = 'over'; }
    else if (uy < -0.7) kind = 'raise';
    else kind = 'slash';
    // the hand's motion just after your feint is its recovery, not a blow
    if (state.m - state.recT < TUNING.myFeint.recover && kind !== 'raise') kind = 'pull';
    if (kind === 'raise' || kind === 'pull') h.atk = { kind, done: true };
    else if (kind && state.exhaust > 0) tiredPop(E);
    else if (kind) {
      const tired = state.stamina <= 0, cost = AT[kind].cost * meWeapon().cost;
      state.stamina = Math.max(0, state.stamina - cost);
      state.lastAtk = state.m;
      h.atk = { kind, tired, done: false, cost, lunge: !!(state.lunging && state.lng && !state.lng.committed) };
      if (kind === 'over') state.overheads++; else if (kind === 'jab') state.jabs++; else state.slashes++;
    }
  }
  // regen: only when not swinging, holding or dodging; faster when also not blocking
  const RM = TUNING.me.staRegen[state.me.sta - 1] * TUNING.me.armour[state.me.set].regen * Math.pow(TUNING.cards.deepbreath, count('deepbreath'));
  if (state.m - state.lastAtk > S.delay && !sh.held && !state.away) state.stamina = Math.min(state.staMax, state.stamina + S.regen * RM * (raised() ? 1 : S.idleMul) * dt);
}

function checkExhaust(E, dt) {
  state.exhaust = Math.max(0, state.exhaust - dt);
  if (state.stamina <= 0 && state.exhaust <= 0) {
    state.stamina = 0; state.exhaust = TUNING.stamina.exhaust; state.staOuts++; state.hand.atk = null;
    const Fy = youF(E); pop(Fy.x, Fy.y - 1.0 * Fy.H, 'EXHAUSTED', '#fca5a5', 20); E.haptic(20);
  }
}
function tiredPop(E) {
  if (state.m - state.exMsg < 0.8) return;
  state.exMsg = state.m;
  const Fy = youF(E); pop(Fy.x, Fy.y - 1.0 * Fy.H, state.exhaust > 0 ? 'EXHAUSTED' : 'TOO TIRED', '#fca5a5', 16);
}

// ----- your footwork: the backstep and backing off, the wall behind you -----
const gripMul = () => Math.pow(TUNING.cards.grip, count('grip')) * Math.pow(TUNING.cards.feet, count('feet'));
function backToWall(E) {
  const ft = state.foot;
  if (state.m - ft.wallT < TUNING.foot.wallMsg) return;
  ft.wallT = state.m; state.wallHits++;
  const Fy = youF(E); pop(Fy.x + 30, Fy.y - 1.1 * Fy.H, 'Back to the wall!', '#fca5a5', 24); E.haptic(18); shake(E, 3, 0.1);
}
function stepYou(E, dt) {
  const T = TUNING.foot, ft = state.foot, dg = state.dg, k = gripMul(), wl = walls(E), hi = Math.max(wl.back, state.step.x - gMin(E));
  const holding = dg.down && dg.t > TUNING.dodge.dur;
  if (holding) ft.tgt -= T.walkBack * k * dt;
  // idle (no swing, dodge or lunge for drift.idle s) with him within his striking distance and reach: drift back toward your mark, a pace per drift.secs;
  // out of his reach you hold your ground
  else if (ft.tgt < 0 && !dg.down && !state.away && !state.lunging && !state.hand.atk && state.m - state.lastAtk > T.drift.idle && inReach()) {
    const rate = T.pace / T.drift.secs;
    ft.tgt = Math.min(0, ft.tgt + rate * dt); ft.v = Math.max(ft.v, rate);
  }
  ft.tgt = clamp(ft.tgt, wl.back, hi);
  ft.pos = clamp(ft.pos + clamp(ft.tgt - ft.pos, -ft.v * dt, ft.v * dt), wl.back, hi);
  // holding DODGE against the wall: you can give no more ground, and the backed-off guard ends
  if (holding && ft.pos <= wl.back + 0.005) { backToWall(E); dg.down = false; dg.id = -1; }
}
// his bash drives you back half a pace, to the wall at most
function pushYou(E) {
  const FT = TUNING.foot, ft = state.foot, wl = walls(E);
  ft.pos = Math.max(wl.back, ft.pos - FT.push * FT.pace); ft.tgt = Math.min(ft.tgt, ft.pos);
  if (ft.pos <= wl.back + 0.005) backToWall(E);
}

// ----- your defence: the shield and the backstep in time -----
const raised = () => !state.sh.broken && !noShield() && state.sh.arm <= 0 && state.you.lungeK < 0.15 && (state.sh.held || (state.sh.t >= 0 && state.sh.t < TUNING.shield.dur));
const blocks = (zone) => raised() && state.sh.zone === zone;
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
    if (dg.t > D.dur) { state.stamina -= (has('untouch') ? 0 : D.drain) * dt; state.lastAtk = state.m; if (state.stamina <= 0) { state.stamina = 0; dg.down = false; dg.id = -1; } }
  }
  if (state.away && !dg.down && state.dodgeT <= 0) { state.away = false; state.dodgeCool = D.cool; }
}
const steadyMul = () => Math.pow(TUNING.cards.steady, count('steady'));
const shieldMax = () => TUNING.shield.hits + TUNING.cards.tough * count('tough');
// Wide Stance (a tent ware): no push-back from a bash
const noPush = () => has('stance');

// ----- the foe's pose: sway, wind-up, lunge, fall, winded -----
const cockOf = (pose, zone) => POSES[pose].cock + (pose === 'thrust' && zone.id === 'high' ? -0.35 : 0);
function poseFoe(E, dt) {
  if (state.foe.beast) { poseBeast(E, dt); return; }
  const L = lay(E), f = state.foe, sw = state.sw, S = TUNING.swing, FT = TUNING.foe;
  const fall = state.fallT > 0 ? Math.pow(clamp(state.fallT / 0.5, 0, 1), 2) : 0;
  let lean = FT.swayDeg * Math.PI / 180 * Math.sin(state.m * TUNING.swayRate * 1.3) + state.kickA, crouch = 0, lunge = 0;
  // a lamed sword arm droops at rest; a lamed shield arm hangs, his guard dropped; lamed legs limp
  let th = covering() ? clamp(-0.3 + 2.3 * (state.cover.y + 0.8), -0.4, 1.1) + 0.05 * Math.sin(state.m * 3) : REST_TH + 0.08 * Math.sin(state.m * 3) + (lamed('armF') ? 0.35 : 0);
  if (state.winded > 0 && fall === 0) { th = 1.4 + 0.06 * Math.sin(state.m * 2.2); lean += 0.24 + 0.05 * Math.sin(state.m * 6); crouch = 0.05; }
  else if (!sw && state.open > 0 && fall === 0) lean += 0.1;
  if (sw) {
    const P = POSES[sw.pose];
    if (sw.fin > 0) {
      const v = clamp((0.4 - sw.fin) / 0.12, 0, 1), back = clamp(sw.fin / 0.2, 0, 1), c = cockOf(sw.pose, sw.zone);
      th = c + (P.end - c) * v * v;
      lunge = S.lunge * P.lunge * easeOut(v) * back; lean += 0.22 * easeOut(v) * back;
    } else if (sw.fake && !sw.switched) {
      // the fake winds only part of the way and never trembles: the honest tell of a feint
      const FP = POSES[sw.fakePose], u = clamp(sw.t / (sw.switchAt * 0.8), 0, 1), e = easeOut(u) * TUNING.moves.feint.cock * (sw.hesOn ? 0.9 + 0.1 * Math.sin(state.m * 30) : 1);
      th = sw.th0 + (cockOf(sw.fakePose, sw.fake) - sw.th0) * e;
      lean += FP.lean * e; crouch = FP.crouch * e;
    } else {
      const t0 = sw.switched ? sw.realAt : 0, u = clamp((sw.t - t0) / ((sw.wind - t0) * 0.55), 0, 1), e = easeOut(u);
      th = sw.th0 + (cockOf(sw.pose, sw.zone) - sw.th0) * e + (u >= 1 ? Math.sin(sw.t * 55) * 0.035 : 0);
      lean += P.lean * e; crouch = P.crouch * e;
    }
    f.th = th;
  } else {
    f.th += (th - f.th) * (1 - Math.exp(-(dt || 0.016) / 0.1));
    th = f.th;
  }
  f.dx = -(lunge * L.H) + Math.sin(state.m * TUNING.swayRate * 0.8) * FT.swayX * L.H + fall * 0.3 * L.H + state.step.x * L.H;
  const limp = lamed('legs') && fall === 0 ? Math.max(0, Math.sin(state.m * 5)) : 0;
  f.dy = crouch * L.H + Math.abs(Math.sin(state.m * (state.winded > 0 ? 4.5 : 2.4))) * -3 + limp * 0.03 * L.H;
  lean += limp * 0.06;
  f.a = lean - fall * 1.45;
  f.fr = {
    armF: { ox: SHOULDER[0], oy: SHOULDER[1], rot: th - Math.PI / 2 },
    armB: { ox: PARTS[4].joint[0], oy: PARTS[4].joint[1], rot: lamed('armB') ? 0.75 + 0.04 * Math.sin(state.m * 1.7) : sw && sw.pose === 'bash' && sw.fin <= 0 ? -1.2 : 0.14 + 0.08 * Math.sin(state.m * 1.7) },
  };
  for (const p of f.parts) {
    const fr = f.fr[p.d.frame || p.d.id] || ZERO, c = Math.cos(fr.rot), sn = Math.sin(fr.rot);
    p.cx = fr.ox + p.d.x * c - p.d.y * sn; p.cy = fr.oy + p.d.x * sn + p.d.y * c;
  }
}

// Footwork: he drifts around the distance his weapon wants, steps to striking distance just before and while he attacks (and while open),
// backs off when hurt (if this exchange's mood says so), and sidesteps your lunge once he has read it. No randomness here: the drift is a slow wave.
function stepFoe(dt, E) {
  const T = TUNING.step, st = state.step, f = state.foe, limp = (lamed('legs') ? TUNING.lame.legs : 1) * netMul(TUNING.me.net.step), tau = T.tau * statMul('spdStep', f.spd) * f.size.step / limp;
  st.dodgeT = Math.max(0, st.dodgeT - dt); st.dodgeCool = Math.max(0, st.dodgeCool - dt);
  const free = !state.sw && state.winded <= 0 && state.stun <= 0 && state.stagger <= 0 && state.fallT <= 0 && !state.intro && state.endT <= 0;
  if (free && state.you.lungeK > 0.5 && st.dodgeCool <= 0 && (lungeRead() || f.spd >= 5)) {
    st.dodgeT = T.dodgeDur; st.dodgeCool = T.dodgeCool;
    if (lungeRead()) { state.lungeReads++; readPop(E, 'READS YOUR LUNGE'); counter(E, 'thrust'); }
  }
  if (state.fallT > 0 || state.winded > 0 || state.stagger > 0) return;
  // the pounce's spring carries a beast across the ground to where it lands
  const sw = state.sw;
  if (sw && sw.spring && sw.fin <= 0) { st.x = lerp(sw.from, sw.land, ease.inOut(clamp((sw.t - sw.springAt) / Math.max(0.01, sw.wind - sw.springAt), 0, 1))); return; }
  const c = T.circle, wave = (c[0] + c[1]) / 2 + (c[1] - c[0]) / 2 * Math.sin(state.m * 2 * Math.PI / T.period + state.rack);
  // a blow in flight keeps him at striking distance, whatever else he meant to do; a crouching lion gathers itself back, and stays back for a pounce
  const pounce = !!(state.plan && state.plan.q[0] && state.plan.q[0].kind === 'pounce');
  const want = sw ? (sw.pose === 'pounce' ? f.home + TUNING.moves.pounce.back : f.strike) : st.dodgeT > 0 ? f.home + T.dodge : state.retreat > 0 ? f.home + TUNING.retreat.dist
    : state.chase > 0 || state.open > 0 || (!state.intro && state.swingIn < T.lead && !pounce) ? f.strike : f.home + wave;
  // the same footwork rules as yours: he keeps his distance from where you stand, walks no faster than his legs allow
  // (barely at all while winding up a blow), and stops at the wall behind him
  const FT = TUNING.foot, pos = state.foot.pos, wl = walls(E), lo = pos + gMin(E);
  const goal = clamp(want + pos, lo, wl.fore), v = FT.foeV / (statMul('spdStep', f.spd) * f.size.step) * (state.sw && state.sw.fin <= 0 ? FT.commit : state.chase > 0 ? FT.chaseV : 1) * limp;
  st.x = clamp(st.x + clamp((goal - st.x) * (1 - Math.exp(-dt / tau)), -v * dt, v * dt), lo, wl.fore);
}
// your lunge from beyond his reach: he steps in behind its recovery and strikes soon after, so a missed long lunge leaves you open
function chaseIn() {
  if (state.sw || state.winded > 0 || state.stun > 0 || state.stagger > 0 || state.fallT > 0 || state.intro || state.step.dodgeT > 0) return;
  state.chase = TUNING.foot.chase; state.chases++; state.swingIn = Math.min(state.swingIn, TUNING.foot.chaseSwing);
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

// ----- a beast's pose: the lion's crouch and spring and its raised paw, the bear rearing up and lowering its head -----
// A pose is a few numbers (q): the body lowered (y) and risen about the hip (rot, negative is up), the head dipped, the jaw open, each foreleg free at
// an angle (0 hangs down, -PI/2 points at you) or standing, the hind legs trailing or standing, the tail's lash. From it come the body, head and near
// foreleg frames its parts and gaps ride, and its four legs (shoulder or hip, knee, foot), so what is drawn is what is hit.
const beastRestQ = () => ({ y: 0, rot: 0, dip: 0, jaw: 0, fore: [null, null], hind: null, tail: 1 });
function poseBeast(E, dt) {
  const L = lay(E), f = state.foe, sw = state.sw, S = TUNING.swing, M = TUNING.moves, q = beastRestQ();
  const fall = state.fallT > 0 ? Math.pow(clamp(state.fallT / 0.5, 0, 1), 2) : 0;
  let lunge = 0, air = 0;
  q.y = 0.006 * Math.sin(state.m * 2.4); q.dip = 0.01 * Math.sin(state.m * 1.3);
  if (state.winded > 0 && fall === 0) { q.y = 0.035; q.dip = 0.06; q.jaw = 0.45 + 0.2 * Math.sin(state.m * 9); q.tail = 0.3; }
  else if (state.stun > 0) { q.dip = 0.07; q.jaw = 0.25; }
  // a lamed foreleg is held off the sand; lamed hind legs limp
  if (lamed('legF')) q.fore[0] = -0.45;
  if (lamed('legs') && fall === 0) q.y += 0.02 * Math.max(0, Math.sin(state.m * 5));
  if (sw) {
    const P = sw.pose, t = sw.t, w = sw.wind, fin = sw.fin > 0, back = fin ? clamp(sw.fin / 0.2, 0, 1) : 1, v = fin ? clamp((0.4 - sw.fin) / 0.12, 0, 1) : 0;
    const shiver = (u) => (u >= 1 ? Math.sin(t * 55) : 0);
    if (P === 'pounce') {
      const at = sw.springAt;
      if (fin) { q.y = 0.04 * back; q.fore = [-1.1 * back, -1.25 * back]; q.jaw = 0.4 * back; if (back < 0.15) q.fore = [null, null]; }
      else if (t < at) { const u = clamp(t / at, 0, 1), e = easeOut(u); q.y = 0.11 * e + 0.006 * shiver(u); q.rot = 0.09 * e; q.dip = 0.06 * e; q.jaw = 0.2 * e; q.tail = 2.6; }
      else { const u = clamp((t - at) / Math.max(0.01, w - at), 0, 1); q.y = 0.11 * (1 - u) - 0.03 * u; q.rot = 0.06 - 0.18 * u; air = Math.sin(Math.PI * u) * 0.1; q.fore = [0.1 - 1.2 * u, 0.1 - 1.35 * u]; q.hind = 0.7 * u; q.jaw = 0.7 * u; }
    } else if (P === 'swipe') {
      // the paw goes up: high over its head for HIGH, forward at its chest for MID; then it swings forward and down through that height
      const cock = sw.zone.id === 'high' ? -2.55 : -1.85, end = sw.zone.id === 'high' ? -1.45 : -0.85, u = clamp(t / (w * 0.55), 0, 1), e = easeOut(u);
      if (fin) { q.fore[0] = v < 1 ? cock + (end - cock) * v * v : end * back + 0.1 * (1 - back); q.rot = -0.08 * back; lunge = S.lunge * easeOut(v) * back; q.jaw = 0.5 * back; if (back < 0.1) q.fore[0] = null; }
      else { q.fore[0] = 0.1 + (cock - 0.1) * e + 0.05 * shiver(u); q.rot = -0.08 * e; q.jaw = 0.3 * e; q.tail = 2; }
    } else if (P === 'maul') {
      // it rears up about its hips: high with its paws over its head (it will come down on your chest, MID), or half up with its paws low (it rakes LOW)
      const lo = sw.zone.id === 'low', top = lo ? 0.45 : 0.66, up = lo ? [-0.6, -0.75] : [-2.35, -2.6], down = lo ? [-0.3, -0.4] : [-0.9, -1.0];
      const u = clamp(t / (w * M.maul.rear), 0, 1), e = easeOut(u);
      if (fin) { q.rot = -top * (1 - v) * back; q.fore = [up[0] + (down[0] - up[0]) * v, up[1] + (down[1] - up[1]) * v].map((a) => a * back); lunge = S.lunge * 1.2 * easeOut(v) * back; q.jaw = 0.6 * back; if (back < 0.1) q.fore = [null, null]; }
      else { q.rot = -top * e + 0.03 * shiver(u); q.fore = [0.1 + (up[0] - 0.1) * e, 0.1 + (up[1] - 0.1) * e]; q.jaw = 0.9 * e; q.tail = 1.5; }
    } else if (P === 'shove') {
      // the head goes down and it draws back, then it charges in with its shoulder
      const u = clamp(t / (w * 0.55), 0, 1), e = easeOut(u);
      q.dip = 0.08 * (fin ? back : e); q.rot = 0.08 * (fin ? back : e); q.y = 0.03 * (fin ? back : e);
      lunge = fin ? S.lunge * 1.9 * easeOut(v) * back : -0.04 * e - 0.005 * shiver(u); q.jaw = 0.3 * (fin ? back : e);
    }
  }
  if (fall > 0) { q.y = 0.16 * fall; q.rot = 0.05 * fall; q.dip = 0.1 * fall; q.fore = [null, null]; q.hind = null; q.jaw = 0.3 * fall; q.tail = 0; }
  // walking moves the feet: a little stride cycle from the ground he covers
  const wx = state.step.x; f.walk = (f.walk || 0) + Math.abs(wx - (f.walkX == null ? wx : f.walkX)); f.walkX = wx;
  f.dx = -(lunge * L.H) + 0.01 * Math.sin(state.m * TUNING.swayRate * 0.8) * L.H + state.step.x * L.H;
  f.dy = -air * L.H * drawK(f);
  f.a = 0;
  beastFrames(f, q, sw || fall > 0 ? 0 : f.walk);
}
// the waiting beast's (and its card's) pose: standing at rest
function beastRest(f) { beastFrames(f, beastRestQ(), 0); }
// A pose's frames and legs (body units, in the beast's own ground frame), and each part's centre in them.
function beastFrames(f, q, walk) {
  const K = BEAST_BODY[f.beast], [hx, hy] = K.hip, c = Math.cos(q.rot), s = Math.sin(q.rot);
  const ox = hx - hx * c + hy * s, oy = hy + q.y - hx * s - hy * c, T = (p) => [ox + p[0] * c - p[1] * s, oy + p[0] * s + p[1] * c];
  f.fr = { body: { ox, oy, rot: q.rot }, head: { ox: ox - s * q.dip, oy: oy + c * q.dip, rot: q.rot } };
  const anchors = [T(K.sh[0]), T(K.sh[1]), T(K.hp[0]), T(K.hp[1])], free = [q.fore[0], q.fore[1], q.hind, q.hind == null ? null : q.hind * 0.85];
  f.lg = anchors.map((a, i) => {
    const [l1, l2] = K.leg[i < 2 ? 0 : 1], n = l1 + l2;
    const ft = free[i] != null ? [a[0] - Math.sin(free[i]) * n * 0.97, Math.min(0, a[1] + Math.cos(free[i]) * n * 0.97)] : [K.feet[i] + (walk ? 0.022 * Math.sin(walk * 22 + i * 1.7) : 0), Math.min(0, a[1] + n)];
    return [a, knee(a, ft, l1, l2, i < 2 ? -1 : 1), ft];
  });
  const [a, , ft] = f.lg[0];
  f.fr.legF = { ox: a[0], oy: a[1], rot: Math.atan2(-(ft[0] - a[0]), ft[1] - a[1]) };
  f.bq = q;
  for (const p of f.parts) {
    const fr = f.fr[p.d.frame || p.d.id] || ZERO, cc = Math.cos(fr.rot), sn = Math.sin(fr.rot);
    p.cx = fr.ox + p.d.x * cc - p.d.y * sn; p.cy = fr.oy + p.d.x * sn + p.d.y * cc;
  }
}
// a two-bone leg's knee between a and b: side -1 bends it back (a foreleg's elbow), 1 forward (a hind knee); straight when the leg is at full stretch
function knee(a, b, l1, l2, side) {
  const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.max(1e-6, Math.hypot(dx, dy)), k = clamp((l1 * l1 - l2 * l2 + d * d) / (2 * d * d), 0, 1), h = Math.sqrt(Math.max(0, l1 * l1 - (k * d) ** 2));
  return [a[0] + dx * k + side * dy / d * h, a[1] + dy * k - side * dx / d * h];
}

// ====== FOE AI: his cover, memory, move building, exchanges and the swing clock ======
// ----- his cover: the guard he slides over the spot you just hit -----
function guardUp() { return !state.sw && state.open <= 0 && state.stun <= 0 && state.stagger <= 0 && state.fallT <= 0 && state.winded <= 0; }
// The foe's cover: after a blow lands he slides his guard (or shield) over that spot for a few seconds. It is down while he swings, is open, winded or stunned.
const hesitating = () => !!state.sw && !!state.sw.fake && state.sw.hesOn && !state.sw.switched && state.sw.fin <= 0;
const covering = () => !!state.cover && state.cover.t > 0 && guardUp();
const guarded = (p) => covering() && Math.hypot(p.cx - state.cover.x, p.cy - state.cover.y) <= state.cover.r;
const covered = (p) => p.armour || p.guard || (guarded(p) && !(p.slot && (state.openAll > 0 || openNow(p))));
// a piece of his gear that acts for him (TUNING.foeGear)
const foeHas = (id) => !!state.foe.gear && state.foe.gear.includes(id);
// a limb of his lamed for the rest of the bout: armF (sword arm), armB (shield arm), legs
const LIMB = { armF: 'SWORD ARM', armB: 'SHIELD ARM', legs: 'LEGS', legF: 'FORELEG' };
const limbName = (id) => (state.foe.beast && id === 'legs' ? 'HIND LEGS' : LIMB[id]);
const lamed = (id) => !!state.foe.parts && state.foe.parts.some((p) => p.d.id === id && !p.slot && p.cut);
function setCover(p) {
  const c = state.cover, r = state.foe.shield ? TUNING.foe.coverShield : TUNING.foe.coverGuard;
  state.cover = { x: p.cx, y: p.cy, r, t: TUNING.cover.dur, max: TUNING.cover.dur, dx: c ? c.dx : 0.28, dy: c ? c.dy : -0.67 };
}

// ----- the foe's mind: each exchange is planned with the fight RNG when it starts, then played out exactly, so every tell is honest -----
// What he remembers of you.
// his memory: from bout 3 on, or from his first bout in the Eye Amulet
const memoryOn = () => !!bout().memory || foeHas('mindreader');
function blockRun() {
  const R = TUNING.read, b = state.mem.blocks;
  if (!memoryOn() || b.length < R.blockRun || state.m - b[b.length - 1].t > R.memWin) return null;
  const last = b.slice(-R.blockRun);
  return last.every((q) => q.z === last[0].z) ? last[0].z : null;
}
const lungeRead = () => memoryOn() && state.mem.lunges.filter((t) => state.m - t < TUNING.read.lungeWin).length >= TUNING.read.lunges;
const turtling = () => memoryOn() && state.mem.turtle >= TUNING.read.turtle;
const pressing = () => memoryOn() && state.stamina < state.staMax * TUNING.read.lowSta;
function readPop(E, s) { const Ff = foeF(E); pop(Ff.x, Ff.y - 1.12 * Ff.H, s, '#c4b5fd', 14); }
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
    const after = Math.max(M.feint.min, M.feint.after * spd);
    mv.hits.push({ ...blow(real, show + hes + after, M.feint.dmg, ZONE_POSE[real]), fake, fakePose: ZONE_POSE[fake], switchAt: show, hes });
  } else if (kind === 'bash') mv.hits.push(blow('mid', wind(M.bash.wind), 0, 'bash'));
  else if (kind === 'net') mv.hits.push(blow('mid', wind(M.net.wind), 0, 'net'));
  // a beast's: the pounce lands MID, the swipe HIGH or MID, the maul LOW or MID, the shove MID (away from the zone you keep blocking)
  else if (kind === 'pounce') mv.hits.push(blow('mid', wind(M.pounce.wind), M.pounce.dmg, 'pounce'));
  else if (kind === 'swipe') mv.hits.push(blow(beastZone(rng, avoid, 'high', 'mid'), wind(M.swipe.wind), M.swipe.dmg, 'swipe'));
  else if (kind === 'maul') mv.hits.push(blow(beastZone(rng, avoid, 'low', 'mid'), wind(M.maul.wind), M.maul.dmg, 'maul'));
  else if (kind === 'shove') mv.hits.push(blow('mid', wind(M.shove.wind), 0, 'shove'));
  return mv;
}

function beastZone(rng, avoid, a, b) { return avoid === a ? b : avoid === b ? a : rng.chance(beastOf(state.foe).zone) ? a : b; }
// his move weights: his weapon's (a beast's own), and the Huntress's net besides her spear
function movesOf(f) { const C = TUNING.champs[f.ck]; return C && C.net ? { ...f.weapon.moves, net: C.net } : f.weapon.moves; }
// how much further than his striking distance a move may start from: the pounce's leap, shorter on a lamed leg
const leapOf = () => TUNING.moves.pounce.leap * (lamed('legs') || lamed('legF') ? TUNING.lame.legs : 1);
const reachOf = (mv) => (mv && mv.kind === 'pounce' ? leapOf() : 0);
// An exchange: a rhythm (flurry, probe or pause), one to three moves weighted by his weapon and by what he has read of you, his mood if hurt, the pause after.
function planExchange(E) {
  const rng = state.rng, f = state.foe, R = TUNING.read;
  const avoid = blockRun(), turtle = turtling(), press = pressing();
  const rh = pickW(rng, TUNING.rhythm.map((r) => [r, r.w * (press && r.id === 'flurry' ? R.pressMul : 1)]));
  const n = rng.int(rh.n[0], rh.n[1]), wind = rh.wind * (press ? R.pressWind : 1), q = [];
  for (let i = 0; i < n; i++) {
    const w = Object.entries(movesOf(f)).filter(([k]) => k !== 'feint' || bout().feints).map(([k, v]) => [k, v * (k === 'feint' ? rh.feint * arenaT().feint * (turtle ? R.turtleFeint : 1) * (foeHas('myfeint') ? TUNING.foeGear.hood : 1) : k === 'shove' && turtle ? R.turtleBash : 1) * (avoid && MOVE_ZONE[k] === avoid ? R.avoid : 1)]);
    if (f.shield) w.push(['bash', TUNING.moves.bash.w * (turtle ? R.turtleBash : 1)]);
    const kind = pickW(rng, w);
    q.push(buildMove(rng, kind, { avoid, wind }));
    // a combo ends the exchange: he is winded after it
    if (kind === 'combo') break;
  }
  state.mood.retreat = rng.chance(TUNING.retreat.chance);
  if (avoid) { state.zoneReads++; readPop(E, `READS YOUR ${ZONE[avoid].label} GUARD`); }
  else if (turtle) { state.turtleReads++; readPop(E, 'READS YOUR SHIELD'); }
  else if (press) { state.presses++; readPop(E, 'PRESSES YOU'); }
  return { q, gap: rh.gap, after: nextGap() * rh.after, rhythm: rh.id, avoid };
}

function startMove(E, mv, isCounter) {
  const f = state.foe;
  // Puppeteer: every third move of his (never a counter, never a beast's) is a feint, and it shows from its first tell
  if (has('puppet') && !isCounter && !f.beast && ++state.puppetN % C_().puppet === 0) { if (mv.kind !== 'feint') mv = buildMove(state.rng, 'feint', { avoid: blockRun(), wind: 1 }); mv.puppet = true; }
  state.move = mv; mv.idx = 0; mv.counter = !!isCounter;
  f.sta -= mv.cost; f.staT = 0;
  state.moveCount[mv.kind] = (state.moveCount[mv.kind] || 0) + 1;
  if (mv.kind === 'feint') state.feints++; else if (mv.kind === 'combo') state.combos++; else if (mv.kind === 'bash') state.bashes++; else if (mv.kind === 'net') state.nets++;
  startBlow(E);
}
function startBlow(E) {
  const mv = state.move, h = mv.hits[mv.idx], f = state.foe;
  settleFeint('none');
  if (f.beast) beastSound(E, f.beast, h.pose); else windSound(E, f.weapon.id);
  state.feintLive = !!h.fake;
  // a lamed sword arm (a beast's foreleg) slows every wind-up; a beast's lamed leg slows its pounce or charge
  const charge = f.beast && (h.pose === 'pounce' || h.pose === 'shove') && (lamed('legs') || lamed('legF'));
  // Bait: the first blow he starts after you drop a held shield has twice the tell (never a counter)
  const bait = state.baitT > 0 && !mv.counter;
  if (bait) { state.baitT = 0; const Ff = foeF(E); pop(Ff.x, Ff.y - 1.25 * Ff.H, 'TAKES THE BAIT', '#c4b5fd', 18); }
  const k = (1 + (lamed(f.beast ? 'legF' : 'armF') ? TUNING.lame.arm : 0) + (charge ? TUNING.lame.pounce : 0)) * (has('vein') && state.bleed.length ? TUNING.cards.vein : 1) * (bait ? C_().bait : 1) * netMul(1 + TUNING.me.net.wind);
  state.sw = {
    zone: ZONE[h.fake || h.zone], real: ZONE[h.zone], fake: h.fake ? ZONE[h.fake] : null, fakePose: h.fakePose, switchAt: (h.switchAt || 0) * k, switched: false,
    t: 0, wind: h.wind * k, dmg: h.dmg, pose: h.pose, kind: mv.kind, idx: mv.idx, n: mv.hits.length, counter: mv.counter, fin: 0, outcome: null, th0: f.th,
    hes: (h.hes || 0) * k, hesOn: false, realAt: 0, lesson: null, body0: bodyPos(), m0: state.m,
    springAt: h.pose === 'pounce' ? h.wind * k * TUNING.moves.pounce.at : 0, spring: false, from: 0, land: 0, puppet: !!mv.puppet,
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
// the pounce's spring: from where it crouched to its striking distance from you (at most its leap), spraying sand from its hind feet
function spring(E, sw) {
  const f = state.foe, from = state.step.x, lo = state.foot.pos + gMin(E);
  sw.spring = true; sw.from = from; sw.land = clamp(Math.max(bodyPos() + f.strike, from - leapOf()), lo, from);
  const Ff = foeF(E), [hx, hy] = toScreen(Ff, -0.27, 0);
  sand(hx, hy, 1, TUNING.juice.sand); swooshSound(E, 0.16);
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
function spendFoe(E, n) {
  const f = state.foe; f.sta -= n; f.staT = 0;
  if (f.sta <= 0 && !state.sw && state.winded <= 0) windFoe(E, TUNING.foeSta.winded);
}
// winded is the open window: a brief slow, OPEN!, and his slots glow until he recovers
function windFoe(E, dur) {
  if (state.fallT > 0) return;
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
    if (sw.pose === 'pounce' && !sw.spring && sw.t >= sw.springAt) spring(E, sw);
    if (sw.t >= sw.wind) resolveSwing(E);
    return;
  }
  if (state.stagger > 0) return;
  state.swingIn -= dt;
  // a beast plans its exchange as it gets ready, so its feet know whether it springs from where it stands (a pounce) or walks in
  if (f.beast && !state.plan && state.swingIn < TUNING.step.lead && state.endT <= 0) state.plan = planExchange(E);
  // he commits only once you are inside his reach (a pounce's, from further); until then his footwork closes in
  if (state.swingIn <= 0 && state.endT <= 0 && inReach(f.beast && state.plan ? reachOf(state.plan.q[0]) : 0)) {
    if (!state.plan && awed(E)) return;
    if (!state.plan) state.plan = planExchange(E);
    startMove(E, state.plan.q.shift(), false);
  }
}

// Darling of Rome: with the meter at its top he stands in awe a moment before each exchange (a beast, which plans as it gets ready, is never awed)
function awed(E) {
  if (state.awed || !has('darling') || state.fav < C_().aweAt) { state.awed = false; return false; }
  state.awed = true; stunFoe(E, C_().awe, 'IN AWE');
  return true;
}

// ----- the City's pairs: one foe fights, the other waits at the edge -----
// When the one fighting is winded, his partner taunts from the edge in the window's last half second and they swap as it closes; when he is felled, the
// partner taunts and takes over. The one who leaves keeps his health, cuts, lamings and bleed, and gets his breath back at the edge.
// The Colosseum's Beastmaster is the same machinery with his lion: it roars from the edge and steps in once his health falls to half (never on a winding),
// and he comes back if it falls first.
const TAUNT = { winded: 'Now, brother!', fell: 'For my brother!', beast: 'RRROAR!', master: 'My lion! Now you pay.' };
function taunt(E, why) {
  const e = state.edge, sends = !!state.gauntlet[state.rack].sends;
  state.tauntT = TUNING.pairs.taunt; state.taunt = TAUNT[e && e.beast ? 'beast' : sends ? 'master' : why];
  if (e && e.beast) { beastSound(E, e.beast, 'pounce'); return; }
  E.audio.beep({ freq: 300, dur: 0.12, type: 'sawtooth', slide: 1.3, gain: 0.08 }); E.audio.beep({ freq: 420, dur: 0.14, type: 'sawtooth', slide: 0.8, gain: 0.07, delay: 0.12 });
}
function stepIn(E) {
  const out = state.foe, inn = state.edge, fellOut = state.fallT > 0;
  out.bleed = state.bleed; out.dents = state.dents; out.shrug = state.bout.foeShrug; out.down = fellOut; out.sta = out.staMax;
  state.foe = inn; state.edge = out;
  state.bleed = inn.bleed; state.dents = inn.dents; state.bout.foeShrug = inn.shrug;
  state.fallT = 0; state.sw = null; state.move = null; state.plan = null; state.stun = 0; state.stagger = 0; state.winded = 0; state.open = 0; state.retreat = 0; state.chase = 0;
  state.cover = null; state.disarm = 0; state.flyW = 0; state.kickA = 0; state.kickV = 0; state.pop = 1; state.swapping = false; state.tauntT = 0; state.sendT = 0;
  state.step = { x: walls(E).fore, tgt: 0, t: 1, dodgeT: 0, dodgeCool: 0 };
  state.swingIn = Math.max(state.swingIn, TUNING.pairs.enter);
  inn.th = REST_TH;
  poseFoe(E, 0.016);
  if (fellOut && state.carry) { addBleed(E, state.carry); state.carry = 0; }
  const Ff = foeF(E); pop(Ff.x, Ff.y - (inn.beast ? 0.8 : 1.2) * Ff.H, `${inn.name.split(' ')[0].toUpperCase()} STEPS IN`, '#fca5a5', 22);
  dust(Ff.x, Ff.y, 10); shake(E, 4, 0.15); swooshSound(E, 0.14);
  if (inn.beast) { const [hx, hy] = toScreen(Ff, -0.27, 0); sand(hx, hy, 1, TUNING.juice.sand >> 1); }
}
// the swap clock, after his AI each frame (the fell's is in the play scene's fall clock)
function updatePair(E, dt) {
  state.tauntT = Math.max(0, state.tauntT - dt);
  const e = state.edge, P = TUNING.pairs, f = state.foe;
  if (!e || e.down || state.fallT > 0) return;
  if (state.gauntlet[state.rack].sends) {
    if (!state.sent && !f.beast && f.hp <= f.maxHp * TUNING.champs.carpophorus.send) { state.sent = true; state.sendT = P.taunt; taunt(E, 'winded'); dropBlow(); state.swingIn = Math.max(state.swingIn, P.taunt + 0.2); }
    if (state.sendT > 0 && (state.sendT -= dt) <= 0) stepIn(E);
    return;
  }
  if (state.swapping && state.winded > P.taunt) state.swapping = false;
  if (!state.swapping && state.winded > 0 && state.winded <= P.taunt) { state.swapping = true; taunt(E, 'winded'); }
  if (state.swapping && state.winded <= 0) stepIn(E);
}
// the waiting foe at the edge: smaller, dimmer, standing at rest
function edgeF(E, f = state.edge) {
  const L = lay(E), H = L.H * drawK(f) * pairScale();
  return { x: E.w - E.safe.right - edgeX(f) * H, y: L.floor, a: 0, dir: -1, H };
}
function poseEdge(f) {
  if (f.beast) { beastRest(f); return; }
  f.fr = { armF: { ox: SHOULDER[0], oy: SHOULDER[1], rot: REST_TH - Math.PI / 2 }, armB: { ox: PARTS[4].joint[0], oy: PARTS[4].joint[1], rot: 0.14 } };
  for (const p of f.parts) {
    const fr = f.fr[p.d.frame || p.d.id] || ZERO, c = Math.cos(fr.rot), sn = Math.sin(fr.rot);
    p.cx = fr.ox + p.d.x * c - p.d.y * sn; p.cy = fr.oy + p.d.x * sn + p.d.y * c;
  }
}

// A counter is a fresh one-move exchange: a quick thrust or chop, planned now with the fight RNG, its zone glowing like any tell.
function counter(E, kind) {
  if (!bout().counters || state.sw || state.fallT > 0 || state.stun > 0 || state.endT > 0 || state.stagger > 0 || state.winded > 0 || state.intro || !inReach()) return;
  const B = beastOf(state.foe), k = B ? B.counter : kind || (state.rng.chance(0.5) ? 'thrust' : 'chop');
  state.plan = null;
  startMove(E, buildMove(state.rng, k, { avoid: blockRun(), wind: 1, fixed: TUNING.counter.windup * statMul('spdWind', state.foe.spd) }), true);
  state.counters++;
  const Ff = foeF(E); pop(Ff.x, Ff.y - 1.0 * Ff.H, 'COUNTER!', '#ff8a7a', 20);
}
// Every feint ends as exactly one of read, bitten or neither (dodged, out of reach, or cut short by a stun, a winding or a fell).
function settleFeint(how) {
  if (!state.feintLive) return;
  state.feintLive = false;
  if (how === 'none') state.feintsNone++;
}

// ====== INPUT: the left thumb's column (the right thumb is read in moveHand; pointer routing is in the play scene) ======
// ----- the left hand: three shield buttons and one DODGE across the column (tap = the quick backstep, hold = keep backing off) -----
function colRect(E) {
  const C = TUNING.col, x = 10 + E.safe.left, w = Math.max(C.minW, Math.round(E.w * C.frac));
  const bottom = E.h - 10 - E.safe.bottom, dodgeH = Math.max(C.dodgeMinH, Math.round(E.h * C.dodgeFrac)), top = E.safe.top + C.top;
  return { x, w, top, bottom, dodgeH, h: (bottom - top - dodgeH - 3 * C.gap) / 3 };
}
function shieldBtns(E) {
  const C = TUNING.col, R = colRect(E), h = R.h;
  const out = ZONES.map((z, i) => ({ z, x: R.x, y: R.top + i * (h + C.gap), w: R.w, h }));
  out.push({ z: null, dodge: true, x: R.x, y: R.bottom - R.dodgeH, w: R.w, h: R.dodgeH });
  return out;
}

// A button's touch area: 8 px past each drawn edge, but only half the gap toward a neighbour.
function hitRect(E, b) {
  const C = TUNING.col, first = b.z === ZONES[0], last = b.dodge;
  return { x0: b.x - C.reach, x1: b.x + b.w + C.reach, y0: b.y - (first ? C.reach : C.gap / 2), y1: b.y + b.h + (last ? C.reach : C.gap / 2) };
}
function buttonAt(E, p) {
  return shieldBtns(E).find((b) => { const r = hitRect(E, b); return p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1; }) || null;
}
function raiseShield(E, zone, pid) {
  const s = state.sh, Fy = youF(E);
  if (s.broken || noShield()) { pop(Fy.x, Fy.y - 1.0 * Fy.H, 'NO SHIELD', '#94a3b8', 14); return; }
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
  if (pid != null) { if (!s.held) s.heldAt = state.m; s.held = true; s.hid = pid; }
}

// The backstep is a real step back: out of reach for its length, and the ground stays given. At the wall there is none to give.
function dodge(E, pid) {
  const D = TUNING.dodge, Fy = youF(E), s = state.sh, h = state.hand, ft = state.foot, wl = walls(E);
  if (noDodge()) { pop(Fy.x, Fy.y - 1.0 * Fy.H, 'NO DODGE', '#94a3b8', 14); return; }
  if (state.away || state.dodgeCool > 0) return;
  if (ft.pos <= wl.back + 0.01) { backToWall(E); return; }
  const cost = has('untouch') ? 0 : D.cost;
  if (state.stamina < cost) { tiredPop(E); return; }
  state.stamina -= cost; state.lastAtk = state.m;
  const spd = TUNING.me.spdDodge[state.me.spd - 1];
  // Blur: his blow in flight now aims at the ghost left where you stood
  if (has('blur') && state.sw && state.sw.fin <= 0 && !state.sw.ghostX) state.sw.ghostX = Fy.x;
  state.dodges++; state.stepsOut++; state.away = true; state.dodgeM = state.m; state.dodgeT = state.dodgeMax = D.dur * spd; h.atk = null;
  ft.tgt = Math.max(wl.back, Math.min(ft.tgt, ft.pos) - TUNING.foot.back * spd); ft.v = TUNING.foot.back / D.dur * gripMul();
  state.dg.down = true; state.dg.id = pid; state.dg.t = 0;
  s.held = false; s.hid = -1; s.t = -1; s.arm = 0;
  swooshSound(E, 0.16); E.haptic(12);
  // a short ghost trail behind you and a scuff of sand
  dust(Fy.x, Fy.y, TUNING.juice.scuff); E.audio.noise({ dur: 0.07, gain: 0.1, delay: 0.05 }); state.ghostT = TUNING.juice.ghost; state.ghostAt = -9;
}

// ====== HIT RESOLUTION: your blows on him, his blows on you ======
// One hit per swing: the first thing the blade meets decides it (tip first, earliest point of the sweep first; a slot wins over the part it sits on).
function checkHits(E) {
  const h = state.hand, T = TUNING, a = h.atk;
  if (!a || a.done || h.lock > 0 || state.fallT > 0 || state.endT > 0 || state.away) return;
  const need = a.kind === 'jab' ? T.attack.jab.minSpeed : a.kind === 'over' ? T.attack.over.minSpeed : T.hit.minSpeed;
  if (h.sp < need && !lungeStab(a) && !driveStab(a)) return;
  // a lunge that has not committed (the Feint worn) holds what its blade meets until it commits
  const F = foeF(E), fm = state.foe, jab = a.kind === 'jab', pad = (jab ? T.blade.jabPad : T.blade.pad) / F.H, held = state.lunging && state.lng && !state.lng.committed;
  const order = fm.parts.filter((p) => p.slot).concat(fm.parts.filter((p) => !p.slot));
  if (a.kind === 'slash' && state.armed.whirl && !held && whirlwind(E, F, fm, pad)) return;
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
  const hit = { ...first, ang: Math.atan2(h.vy, h.vx), sp: h.sp, slit: first.p.slot && jab && alongSlit(F, fm, first.p) };
  if (held) { if (!state.lng.pend) state.lng.pend = hit; return; }
  a.done = true;
  state.stop = Math.max(state.stop, land(E, a, hit));
}
// what the blade met lands: a clang on a plate, his guard or a gap guard, or a hit (a jab along a slit, or into an opened gap, goes in for a slot hit)
function land(E, a, { p, at, ang, sp, slit }) {
  if (state.lng && state.lunging) state.lng.hit = true;
  state.landM = state.m;
  if (covered(p)) return bounce(E, p, at, ang, sp, a);
  return gapHit(E, p, at, ang, sp, a, p.slot && a.kind === 'jab' && (state.openAll > 0 || openNow(p) || slit));
}

// Whirlwind, armed: this slash goes into every slot its sweep crosses, through his cover, each a slot hit
function whirlwind(E, F, fm, pad) {
  const h = state.hand, hit = new Set();
  for (const f of [0.25, 0.5, 0.75, 1]) {
    const hx = h.phx + (h.hx - h.phx) * f, hy = h.phy + (h.hy - h.phy) * f, tx = h.pux + (h.ux - h.pux) * f, ty = h.puy + (h.uy - h.puy) * f, n = Math.max(1, Math.ceil(Math.hypot(tx - hx, ty - hy) / 8));
    for (let i = 0; i <= n; i++) {
      const [lx, ly] = toLocal(F, hx + (tx - hx) * i / n, hy + (ty - hy) * i / n);
      for (const p of fm.parts) if (p.slot && !p.guard && !p.cut && p.cool <= 0 && !hit.has(p)) { const [qx, qy] = partLocal(p, fm, lx, ly); if (inside(p.d, qx, qy, pad)) hit.add(p); }
    }
  }
  if (!hit.size) return false;
  state.armed.whirl = false; h.atk.done = true;
  pop(E.w / 2, E.h * 0.3, `WHIRLWIND x${hit.size}`, '#e879f9', 26);
  for (const p of hit) {
    if (state.foe.hp <= 0) break;
    const [x, y] = partCenter(F, fm, p);
    state.stop = Math.max(state.stop, gapHit(E, p, { x, y, lx: p.d.x, ly: p.d.y }, Math.atan2(h.vy, h.vx), h.sp, h.atk, true));
  }
  return true;
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
  clangSound(E, 0); shake(E, glance ? 2 : 6, 0.12); E.haptic(glance ? 8 : 24);
  let stop = glance ? 0.01 : J.stopClang + 0.02;
  const breakAt = a.kind === 'over' && meWeapon().overBreak ? meWeapon().overBreak : A.dents;
  if (p.armour && (p.dents >= breakAt || (a.kind === 'over' && has('breaker')))) {
    p.armour = false; state.broken++;
    const [sx, sy] = partCenter(foeF(E), state.foe, p);
    plateBits(sx, sy, 9); ring(sx, sy, 70, '#ffe9a8'); pop(sx, sy - 24, 'PLATE BROKEN', '#ffe9a8', 17); emit(E, 'break', { p });
    E.audio.beep({ freq: 110, dur: 0.25, type: 'sine', slide: 0.4, gain: 0.3 }); shake(E, 8, 0.2); E.haptic(30);
    stop = J.stopBreak + 0.04;
  }
  if (state.cover) state.cover.t = Math.max(state.cover.t, TUNING.cover.dur * 0.5);
  // his cover (a gap guard is not: it shuts its gap and costs him nothing); his Thorns make a blow on his guard cost you, his Riposte answers it
  const onGuard = !p.armour && !p.guard;
  if (a.kind === 'over') { emit(E, 'over', { p, at, clang: true }); if (has('titan')) staggerFoe(E); }
  if (onGuard) spendFoe(E, TUNING.foeSta.block);
  if (onGuard && foeHas('thorns')) { state.stamina = Math.max(0, state.stamina - TUNING.foeGear.thorns); state.lastAtk = state.m; pop(at.x, at.y - 40, 'THORNS', '#fca5a5', 15); }
  if (a.kind === 'over' || (onGuard && (state.foe.shield || foeHas('riposte')))) counter(E);
  return stop;
}

function gapHit(E, p, at, ang, sp, a, thrust) {
  const T = TUNING, J = T.juice, AT = T.attack, kind = a.kind, f = state.foe, slot = p.slot;
  // his Unbreakable (the lion pelt): your first hit each bout is shrugged off
  if (foeHas('unbreak') && !state.bout.foeShrug) {
    state.bout.foeShrug = true; p.cool = T.hit.cool;
    sparks(at.x, at.y, ang + Math.PI, 14); clangSound(E, 0); pop(at.x, at.y - 20, 'SHRUGGED OFF', '#e879f9', 22);
    return J.stopClang;
  }
  const MW = meWeapon();
  let dmg = kind === 'jab' ? AT.jab.dmg : kind === 'over' ? AT.over.dmg : sp >= T.hit.mid ? AT.slash.fastDmg : AT.slash.dmg;
  if (a.tired) dmg = Math.max(1, Math.floor(dmg * T.stamina.tired));
  dmg *= T.me.str[state.me.str - 1] * meSize().dmg;
  // the weapon multiplies after the usual rounding, to the nearest half, so the gladius (1x) adds no rounding of its own; a slot hit uses slotDmg
  const wm = thrust ? MW.slotDmg : MW.dmg * (kind === 'slash' ? MW.slash : 1);
  const rip = state.riposte > 0, winded = state.winded > 0;
  if (rip) dmg *= T.shield.riposteMul;
  // the open window multiplies after rounding, so a punish is exactly 1.5x (health can hold halves)
  // Cruel Edge: +1 a bleed stack on a slot hit; Sharp Edge and the whetstone (tent wares) add to bare hits and every hit
  const raw = Math.max(1, Math.round(thrust ? dmg * MW.slot + (has('cruel') ? T.cards.cruel * state.bleed.length : 0) : dmg + (!slot ? T.cards.edge * count('edge') : 0)) + count('whet'));
  let dealt = Math.max(0.5, Math.round(raw * wm * 2) / 2) * (winded ? T.foeSta.windedDmg : 1) * (has('forge') ? TUNING.tent.forge : 1);
  // Slip and Stab: a jab soon after a dodge in his tell
  const slip = kind === 'jab' && has('slip') && state.m - state.lastTellDodge <= T.cards.slipWin;
  // Haemorrhage's price: a bare hit does nothing
  const numb = !slot && has('haem');
  if (numb) dealt = 0;
  // Misdirection: a slot hit in the gap your feint opened (which closes it); Crowd Pleaser: a slot hit with the crowd in its top third, spending some of it
  const misd = thrust && openNow(p) && has('misdir'), please = thrust && has('pleaser') && topThird();
  if (thrust && openNow(p)) state.gapOpen = null;
  if (please) favour(E, -T.cards.pleaserCost);
  // the multipliers stack up to mulMax
  dealt *= Math.min(T.cards.mulMax, (slip ? T.cards.slip : 1) * (misd ? T.cards.misdir : 1) * (please ? T.cards.pleaser : 1));
  // Execute, armed: a slot hit on a foe below half his health fells him
  const exec = thrust && state.armed.exec && f.hp < f.maxHp * T.fin.below;
  if (exec) { dealt = Math.max(dealt, f.hp); state.armed.exec = false; }
  p.cool = T.hit.cool; p.flash = 0.16; state.gapHits++; if (thrust) { state.slotHits++; state.bout.gaps[p.d.id] = (state.bout.gaps[p.d.id] || 0) + 1; } if (winded) state.punishes++;
  f.hp -= dealt;
  const gl = kind === 'jab' ? 0.03 : 0.06;
  // Bonebreaker: an overhead on a bare limb lames it at once
  if (!slot && kind === 'over' && LIMB[p.d.id] && has('bones')) p.hp = 0;
  if (!slot && !numb) { p.hp -= dmg * wm; p.gashes.push({ a: [at.lx - Math.cos(ang) * gl, at.ly - Math.sin(ang) * gl], b: [at.lx + Math.cos(ang) * gl, at.ly + Math.sin(ang) * gl], t: state.m }); }
  const big = dealt >= 3;
  const n = Math.min(60, J.strawPerDmg * dealt);
  straw(at.x, at.y, ang + Math.PI / 2, 2.6, 260 + dealt * 50, n >> 1);
  straw(at.x, at.y, ang - Math.PI / 2, 2.6, 260 + dealt * 50, n >> 1);
  dust(at.x, at.y, 3 + dealt * 3);
  sliceSound(E, big);
  // a word only for the big moments: a gap hit, an Execute, damage of 2 or more (an ordinary hit gets its flash and sound)
  if (thrust || exec || numb || dealt >= 2) pop(at.x, at.y - 20, exec ? 'EXECUTED!' : numb ? 'NO BITE' : please ? `CROWD PLEASER x${Math.round(dealt)}` : misd ? `MISDIRECTION x${Math.round(dealt)}` : slip ? `SLIP x${Math.round(dealt)}` : rip ? `RIPOSTE x${Math.round(dealt)}` : winded ? `PUNISH x${Math.round(dealt)}` : thrust ? `${p.d.label}!` : kind === 'jab' ? 'STAB' : kind === 'over' ? 'SMASH!' : dealt >= 2 ? 'HARD' : 'HIT', rip || please ? '#ffd24a' : misd ? '#c4b5fd' : thrust ? '#ff6a4a' : big ? '#ffb347' : '#fff0b8', Math.min(34, 15 + dealt * 4));
  state.kickV += T.foe.kick * (Math.cos(ang) > 0 ? -1 : 0.5) * (0.6 + Math.min(dealt, 4) * 0.4);
  shake(E, 2 + Math.min(dealt, 5) * 2.5, 0.1); E.haptic(10 + Math.min(dealt, 5) * 8);
  if (big) E.flash('#fff0b8', 0.07);
  let stop = dealt >= 3 ? J.stop3 : dealt >= 2 ? J.stop2 : J.stop1;
  // a gap hit: a short hit-stop, a bright spark in the gap and a deeper hit
  if (thrust) { stop = Math.max(stop, J.slotStop); sparks(at.x, at.y, ang + Math.PI, J.slotSpark); ring(at.x, at.y, J.slotRing, '#ffffff'); slotSound(E); }
  if (!slot && p.hp <= 0) { disable(E, p, at, ang); stop += 0.04; }
  emit(E, thrust ? 'slot' : 'hit', { p, kind, at, ang });
  if (kind === 'over') emit(E, 'over', { p, at });
  if (kind === 'over' && has('titan') && f.hp > 0) staggerFoe(E);
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
  if (LIMB[p.d.id]) {
    state.lamings++;
    pop(at.x, at.y - 70, `LAMED: ${limbName(p.d.id)}`, '#f87171', 20); E.flash('#7f1d1d', 0.08);
    gainMom(E, TUNING.mom.lame); emit(E, 'lame', { p });
  }
}

// the bout's rival is cleared from this arena's record once he falls
function clearRival(E) { const rv = { ...E.save.get('rivals', {}) }; delete rv[state.arena]; E.save.set('rivals', rv); }
function fell(E) {
  if (state.fallT > 0) return;
  if (state.edge && !state.edge.down) { fellOne(E); return; }
  state.felled++; state.fallT = 0.01; state.sw = null; state.move = null; state.plan = null; state.winded = 0; state.results[state.rack] = 'felled';
  state.hp = Math.min(state.maxHp, state.hp + TUNING.heal);
  state.grades.push(gradeBout()); state.goods.push(boutTally().good);
  state.lastGold = boutGold(); state.gold += state.lastGold.sum; state.goldEarned += state.lastGold.sum;
  if (state.gauntlet[state.rack].rival) { state.rivalBeaten = 1; clearRival(E); pop(E.w * 0.62, E.h * 0.42, 'Rival defeated!', '#f87171', 30); }
  pop(E.w * 0.62, E.h * 0.3, 'FOE DOWN', '#ffd24a', 28); shake(E, 10, 0.3); E.flash('#fff0b8', 0.1); E.audio.play('coin'); fellJuice(E);
  if (boutTally().taken === 0) favour(E, TUNING.crowd.clean);
  emit(E, 'fell');
}
// the pop for hearts gained: "+2 HEARTS"
const heartsPop = (n) => `+${n} HEART${n === 1 ? '' : 'S'}`;
// the first of a pair falls: the bout goes on, his partner taunts from the edge and steps in (stepIn, from the play scene's fall clock)
function fellOne(E) {
  state.fallT = 0.01; state.sw = null; state.move = null; state.plan = null; state.winded = 0; state.swapping = false;
  pop(E.w * 0.62, E.h * 0.3, 'ONE DOWN', '#ffd24a', 26); shake(E, 8, 0.25); E.flash('#fff0b8', 0.08); fellJuice(E);
  E.audio.beep({ freq: 220, dur: 0.2, type: 'triangle', slide: 0.6, gain: 0.2 });
  const was = state.hp; state.hp = Math.min(state.maxHp, state.hp + TUNING.pairs.heal); E.audio.play('coin');
  if (state.hp > was) { const Fy = youF(E); pop(Fy.x, Fy.y - 1.1 * Fy.H, heartsPop(state.hp - was), '#fca5a5', 24); }
  emit(E, 'fell');
}

// A fell: a slow-motion second, the camera punching in on him, the crowd's roar, dust as he goes down and again as he lands
function fellJuice(E) {
  const J = TUNING.juice, Ff = foeF(E);
  slowFx(J.fellSlow, J.fellMul); state.zoomT = J.fellSlow; state.dropT = J.dropAt;
  dust(Ff.x, Ff.y, J.dropDust >> 1); roar(E);
}
// slow motion for sec real seconds at game speed mul (a slower one already running is kept)
function slowFx(sec, mul) { if (state.slowFx > 0 && state.slowMul < mul) return; state.slowFx = sec; state.slowMul = mul; }
function resolveSwing(E) {
  const sw = state.sw, L = lay(E), zy = zoneScreenY(L, sw.zone), Fy = youF(E), Ff = foeF(E), sh = state.sh, SH = TUNING.shield, M = TUNING.moves, W = state.foe.weapon;
  // a beast's shove is its bash; its pounce bounces off your shield and, landing, drives you back; its maul lands with a thud whatever it meets
  const net = sw.pose === 'net', bash = sw.pose === 'bash' || sw.pose === 'shove', BM = sw.pose === 'shove' ? M.shove : M.bash, pounce = sw.pose === 'pounce', feint = !!sw.fake;
  sw.fin = 0.4;
  if (sw.pose === 'maul') maulJuice(E);
  state.streaks.push({ x1: Ff.x - Ff.H * 0.3, y1: zy - 30, x2: Fy.x - L.H * 0.1, y2: zy + 20, life: 0.22, max: 0.22, red: !state.away, net });
  if (sw.ghostX) {
    sw.outcome = 'whiff'; settleFeint('none');
    swooshSound(E, 0.2); pop(sw.ghostX, zy - 30, 'HE HIT YOUR GHOST', '#e879f9', 20); tellDodge(E, sw); return;
  }
  // False Opening, armed: this blow overcommits into the opening you showed him, misses, and leaves him winded
  if (state.armed.falseop) {
    state.armed.falseop = false; sw.outcome = 'whiff'; settleFeint('none');
    swooshSound(E, 0.2); pop(E.w / 2, zy - 30, 'FALSE OPENING!', '#c4b5fd', 24); shimmer(Ff.x, Ff.y - 0.55 * Ff.H, TUNING.juice.readBurst >> 1);
    windFoe(E, TUNING.fin.falseWind); return;
  }
  // a backstep begun during his tell is out of his reach for its length: your dodge
  if (state.away && state.dodgeM >= sw.m0) {
    sw.outcome = 'dodge'; state.dodged++; settleFeint('none');
    swooshSound(E, 0.2); pop(E.w / 2, zy - 30, net ? 'NET DODGED' : feint ? 'FEINT DODGED' : 'OUT OF REACH', '#7de3ff', 18); tellDodge(E, sw); return;
  }
  // range: a blow lands only if your body is within his striking distance (plus a little reach); the net is thrown and always carries.
  // He committed only with you in reach, so a blow that falls short is your dodge when you gave ground during the tell (a step back, a lunge's recoil).
  if (!net && !inReach()) {
    const gave = bodyPos() < sw.body0 - TUNING.foot.give;
    sw.outcome = gave ? 'dodge' : 'whiff'; settleFeint('none');
    if (gave) state.dodged++; else state.outReach++;
    swooshSound(E, 0.2); pop(E.w / 2, zy - 30, 'OUT OF REACH', '#7de3ff', 20); if (gave) tellDodge(E, sw); return;
  }
  if (blocks(sw.zone)) {
    // a read is the shield in the real zone when the real strike lands, however it got there: switching from the fake is the skill
    const perfect = (sh.t <= perfectWin() || (has('standfast') && atWall(E))) && !net && !bash, bx = Fy.x + 0.28 * L.H, by = zy, read = feint;
    sw.outcome = 'block'; state.blocks++; sh.flash = 0.25; sh.blocked = true;
    if (read) { settleFeint('read'); feintRead(E, bx, by); if (sw.sawFake) state.switchReads++; }
    state.mem.blocks.push({ z: sw.zone.id, t: state.m }); if (state.mem.blocks.length > 6) state.mem.blocks.shift();
    // a read of your guard breaks off the rest of this exchange, so his next move already aims elsewhere
    const run = blockRun();
    if (run && state.plan && state.plan.avoid !== run) { state.plan.q = []; state.plan.after = Math.min(state.plan.after, 1.2); }
    sparks(bx, by, 0, perfect ? 30 : 16); ring(bx, by, perfect ? 130 : 70, perfect ? '#ffd24a' : '#ffffff');
    emit(E, 'block', { bx, by, perfect, bash });
    if (net) { pop(bx, by - 40, 'NET BLOCKED', '#ffffff', 22); clangSound(E, 0); return; }
    if (perfect) {
      state.perfects++; state.stagger = SH.stagger; state.riposte = SH.riposte; state.plan = null; if (state.move) state.move.broken = true;
      parrySound(E); ringSound(E); shake(E, TUNING.juice.perfShake, 0.12); E.haptic(35); E.flash('#fff0b8', 0.1); E.audio.play('coin');
      ring(bx, by, TUNING.juice.perfRing, '#ffffff'); ring(bx, by, TUNING.juice.perfRing * 0.6, '#ffffff');
      state.stop = Math.max(state.stop, 0.12);
      pop(bx, by - 40, 'PERFECT BLOCK', '#ffd24a', 28);
      state.kickV += -0.8; pushFoe(E);
      if (has('riposte')) counterJab(E);
      if (has('ironwall')) freeHit(E, 'IRON WALL', true);
      gainMom(E, TUNING.mom.perfect); emit(E, 'perfect', { bx, by });
    } else {
      sh.hits -= bash ? 1 : W.wear;
      const drain = (bash ? BM.drain * BM.blocked : W.drain) * steadyMul();
      if (drain) { state.stamina = Math.max(0, state.stamina - drain); state.lastAtk = state.m; pop(bx, by - 70, 'DRAINED', '#fca5a5', 14); }
      if (bash) { if (!noPush()) state.pushT = 0.2; pushFoe(E); } else if (pounce) pushFoe(E);
      clangSound(E, 0); shake(E, bash || W.wear > 1 ? 9 : 6, 0.15); E.haptic(22); state.stop = Math.max(state.stop, 0.06);
      if (sh.hits <= 0) {
        sh.hits = 0; sh.broken = true; sh.t = -1; sh.up = 0;
        plateBits(bx, by, 12); pop(bx, by - 70, 'SHIELD BROKEN', '#ff9f43', 22); shake(E, 9, 0.2);
        E.audio.beep({ freq: 110, dur: 0.25, type: 'sine', slide: 0.4, gain: 0.3 });
      }
    }
    return;
  }
  state.mem.blocks = [];
  if (feint) { state.feintsBit++; settleFeint('bit'); }
  if (net) {
    sw.outcome = 'net'; state.netT = M.net.dur; state.netted++;
    pop(Fy.x, zy - 40, 'NETTED', '#e2e8f0', 30); shake(E, 6, 0.2); E.haptic(30); E.audio.noise({ dur: 0.25, gain: 0.2 });
    return;
  }
  if (bash) {
    sw.outcome = 'bash'; state.bashHits++;
    if (!noPush()) { state.pushT = 0.35; pushYou(E); }
    state.stamina = Math.max(0, state.stamina - BM.drain); state.lastAtk = state.m;
    pop(Fy.x, zy - 40, sw.pose === 'shove' ? 'SHOVED' : 'BASHED', '#fca5a5', 30); shake(E, 12, 0.25); E.haptic(45); clangSound(E, 0); E.audio.play('boom', 0.5);
    state.hand.lock = Math.max(state.hand.lock, 0.3); state.hand.hvx = -260; state.hand.hvy = 60; state.hand.atk = null;
    return;
  }
  // Unbreakable: the first blow each bout that would hurt you is shrugged off
  if (has('unbreak') && !state.bout.shrugged) {
    state.bout.shrugged = true; state.shrugs++; sw.outcome = 'shrug';
    sparks(Fy.x + 0.2 * L.H, zy, Math.PI, 20); clangSound(E, 0); shake(E, 6, 0.2); E.haptic(30);
    pop(Fy.x, zy - 40, 'UNBREAKABLE', '#e879f9', 28); return;
  }
  // a blow on one of your plates costs half as much, rounded up so it never takes part of a heart
  // disarmed, he hits with his fists; Juggernaut: lunging through it, it costs half (rounded up) and you keep coming
  const part = state.you.parts.find((q) => q.d.id === ZONE_PART[sw.zone.id]), plated = !!(part && part.armour), jugg = has('jugg') && (state.you.lungeK > 0.5 || driving());
  const dmg = Math.ceil((state.disarm > 0 ? Math.min(sw.dmg, TUNING.cards.fist) : sw.dmg) / (plated ? TUNING.me.plateDiv : 1) * (jugg ? TUNING.cards.jugg : 1));
  sw.outcome = 'hit'; state.hp -= dmg; state.taken++; state.hurt = plated ? 0.25 : 0.4; if (sw.counter) state.counterHits++;
  if (pounce && !noPush()) { state.pushT = 0.3; pushYou(E); }
  // you recoil, and the heart that took it shatters on the HUD
  state.you.a -= TUNING.juice.recoil; state.shatter = { i: Math.max(0, Math.ceil(state.hp)), n: Math.min(dmg, Math.ceil(state.hp + dmg)), t: TUNING.juice.shatter };
  // his Bloodlust (the wolf pelt): a blow that lands gives him stamina
  if (foeHas('bloodlust')) { const f = state.foe; f.sta = Math.min(f.staMax, f.sta + TUNING.foeGear.bloodlust); pop(Ff.x, Ff.y - 1.2 * Ff.H, 'HE DRINKS', '#f87171', 15); }
  if (plated) { state.plateSaves++; part.clang = 0.25; const [px, py] = partCenter(Fy, state.you, part); sparks(px, py, Math.PI, 16); clangSound(E, 0); }
  E.flash('#ff2a2a', plated ? 0.15 : 0.3); shake(E, 12 + 4 * sw.dmg, 0.35); E.haptic(50 + 20 * sw.dmg);
  E.audio.play('boom'); E.audio.play('lose', 0.5);
  // his ordinary blow gets its flash and sound; a word for a fake that fooled you, Juggernaut, or 2 or more hearts actually lost
  if (jugg || feint || dmg >= 2) pop(Fy.x, zy - (plated ? 70 : 40), jugg ? 'JUGGERNAUT' : feint ? 'FEINTED!' : plated ? 'PLATE TOOK IT' : `OUCH x${dmg}`, jugg || plated ? '#cbd5e1' : '#ff5a4a', 30 + 4 * dmg);
  if (!jugg) { state.hand.lock = Math.max(state.hand.lock, 0.2); state.hand.hvx = -200; state.hand.hvy = 120; state.hand.atk = null; }
  if (state.hp <= 0) { state.hp = 0; state.endT = 1.0; state.results[state.rack] = 'lost'; }
}
// a dodge in his tell (a backstep begun in it, ground given, or his blow on your ghost)
function tellDodge(E, sw) {
  state.lastTellDodge = state.m;
  gainMom(E, TUNING.mom.dodge); emit(E, 'dodge', { sw });
}
// You held still through the fake and blocked the real strike: he loses a chunk of stamina, often enough to wind him when the blow is done.
function feintRead(E, bx, by) {
  const f = state.foe;
  state.feintsRead++; f.sta -= TUNING.feintRead.drain * f.staMax; f.staT = 0;
  gainMom(E, TUNING.mom.read); emit(E, 'read');
  pop(bx + 20, by - 64, 'Feint read!', '#c4b5fd', 30);
  E.flash('#a78bfa', 0.12); E.haptic(30);
  const Ff = foeF(E); shimmer(Ff.x, Ff.y - 0.55 * Ff.H, TUNING.juice.readBurst); ring(Ff.x, Ff.y - 0.55 * Ff.H, 0.5 * Ff.H, '#c4b5fd'); ooh(E, 0.8);
  E.audio.beep({ freq: 660, dur: 0.12, type: 'triangle', gain: 0.12 }); E.audio.beep({ freq: 990, dur: 0.16, type: 'sine', gain: 0.1, delay: 0.08 });
  if (state.caption && state.sw && state.sw.lesson) state.caption = { lines: ['Spotted his fake! He spent his stamina on it.'], t: 2.2, max: 2.2, good: true };
}
// Riposte: a perfect block sends a free jab into the first bare part he leaves (a body part before a slot), at the riposte's damage
const counterJab = (E) => freeHit(E, 'COUNTER JAB', false);
// A free jab: into the first bare part (or, for a slot hit, the first open slot)
function freeHit(E, label, slot) {
  const f = state.foe, F = foeF(E);
  const open = (q) => q.slot && !q.guard && !q.cut, p = slot ? f.parts.find(open) : f.parts.find((q) => !q.slot && !q.armour && !q.cut) || f.parts.find(open);
  if (!p || f.hp <= 0) return;
  const [x, y] = partCenter(F, f, p);
  state.stop = Math.max(state.stop, gapHit(E, p, { x, y, lx: p.d.x, ly: p.d.y }, Math.PI, TUNING.hit.mid, { kind: 'jab', tired: false }, slot));
  pop(x, y - 46, label, '#7dd3fc', 16);
}

// ====== CARD ENGINE: the events a bout makes, Momentum, Bleed ======
// Cards hook events: start (the bout begins), perfect, block, read (a feint read), dodge (a dodge in his tell), slot (a slot hit), hit (a bare hit),
// over (an overhead that connects), break (a plate broken), lame, tick (a bleed tick), feint (your own feint fooled him), fell. Each hook is (E, ctx) => void;
// the rule lives in its card.
const C_ = () => TUNING.cards;
const HOOKS = {
  shove: { perfect: (E) => { for (let i = 0; i < C_().shove; i++) pushFoe(E); if (state.step.x >= walls(E).fore - 0.005) stunFoe(E, C_().shoveStun, 'STUNNED AT THE WALL'); } },
  braced: { block: (E, c) => { if (!c.perfect) gainMom(E, C_().braced); } },
  thorns: { block: (E, c) => {
    if (state.disarm > 0) return;
    state.dents++; const Ff = foeF(E);
    if (state.dents >= C_().thorns) { state.dents = 0; disarmFoe(E, C_().thornsDur); } else pop(Ff.x, Ff.y - 1.15 * Ff.H, `${state.foe.beast ? 'THORNS' : 'WEAPON DENTED'} ${state.dents}/${C_().thorns}`, '#cbd5e1', 15);
  } },
  serrated: { slot: (E) => addBleed(E, C_().serrated) },
  rend: { hit: (E, c) => { if (c.kind === 'slash') addBleed(E, C_().rend); } },
  bloodlust: { tick: (E, c) => { state.stamina = Math.min(state.staMax, state.stamina + C_().bloodlust * c.n); } },
  haem: { fell: () => { state.carry = state.bleed.length; } },
  sidestep: { dodge: (E) => { const Ff = foeF(E); pop(Ff.x, Ff.y - 1.3 * Ff.H, 'OVERCOMMITTED', '#86efac', 18); windFoe(E, C_().sidestep); } },
  lightfeet: { dodge: (E) => { state.stamina = Math.min(state.staMax, state.stamina + TUNING.dodge.cost); } },
  matador: { dodge: (E, c) => { if (['thrust', 'bash', 'pounce', 'shove'].includes(c.sw.pose)) stunFoe(E, C_().matador, 'STUMBLES!'); } },
  untouch: { dodge: (E) => { state.openAll = C_().untouch; } },
  brawler: { break: (E) => gainMom(E, C_().brawler) },
  cape: { perfect: (E) => capeStep(E), dodge: (E) => capeStep(E) },
  butcher: { break: (E) => addBleed(E, C_().butcher) },
  spiked: { perfect: (E) => addBleed(E, C_().spiked) },
  hamstring: { hit: (E) => hamstring(E), slot: (E) => hamstring(E) },
  mindreader: { read: (E) => gainMom(E, C_().mind) },
  bluff: { feint: (E, c) => { if (c.gap <= C_().bluffWin) { state.openAll = C_().bluff; const Ff = foeF(E); pop(Ff.x, Ff.y - 1.3 * Ff.H, 'DOUBLE BLUFF: ALL OPEN', '#ffd24a', 20); } } },
  playcrowd: { read: (E) => favour(E, TUNING.crowd.read * (C_().play - 1)), perfect: (E) => favour(E, TUNING.crowd.perfect * (C_().play - 1)) },
  sucker: { over: (E) => { if (state.m - state.ownT <= C_().sucker && state.foe.hp > 0) staggerFoe(E); } },
  bloodsport: { tick: (E, c) => favour(E, C_().bloodSport * c.n) },
  falsestep: { dodge: (E, c) => fakeOut(E, c.sw.zone) },
  salute: { perfect: (E) => { if (topThird()) { state.openAll = C_().salute; const Ff = foeF(E); pop(Ff.x, Ff.y - 1.3 * Ff.H, 'SALUTE: ALL OPEN', '#ffd24a', 20); } } },
};
// the crowd in the top third of its meter (Encore, Crowd Pleaser, Salute)
const topThird = () => state.fav >= TUNING.crowd.max * TUNING.crowd.bands[1];
function capeStep(E) { if (++state.cape % C_().cape === 0) stunFoe(E, C_().capeStun, 'CAPED!'); }
function hamstring(E) {
  if (state.m - state.lastTellDodge > C_().hamWin) return;
  const legs = state.foe.parts.find((q) => q.d.id === 'legs');
  if (!legs || legs.cut) return;
  const [x, y] = partCenter(foeF(E), state.foe, legs);
  disable(E, legs, { x, y }, 0);
}
// He is stunned (any blow in the making is dropped, so a feint settles as neither), staggered (the same, shorter, and pushed back) or disarmed (fists only).
function dropBlow() { if (state.sw) { if (state.sw.fin <= 0) settleFeint('none'); state.sw = null; state.move = null; } state.plan = null; }
function stunFoe(E, dur, label) {
  if (state.fallT > 0) return;
  dropBlow(); state.stun = Math.max(state.stun, dur); state.swingIn = Math.max(state.swingIn, 0.6);
  const Ff = foeF(E); pop(Ff.x, Ff.y - 1.25 * Ff.H, label, '#a5b4fc', 20); E.haptic(20);
}
function staggerFoe(E) {
  if (state.fallT > 0 || state.stagger > 0) return;
  dropBlow(); state.stagger = TUNING.shield.stagger; state.swingIn = Math.max(state.swingIn, 0.6); pushFoe(E);
  const Ff = foeF(E); pop(Ff.x, Ff.y - 1.25 * Ff.H, 'STAGGERED!', '#fbbf24', 20);
}
function disarmFoe(E, dur) {
  if (state.fallT > 0) return;
  // a beast has no weapon to lose: it is stunned a moment instead
  if (state.foe.beast) { stunFoe(E, TUNING.fin.beastStun, 'STUNNED'); return; }
  state.disarm = dur; state.flyW = 0.9;
  const Ff = foeF(E); pop(Ff.x, Ff.y - 1.3 * Ff.H, 'DISARMED!', '#e879f9', 26); shake(E, 6, 0.2); E.haptic(30); clangSound(E, 0);
}
// the perfect-block window, doubled by Iron Wall
const perfectWin = () => TUNING.shield.perfect * (has('ironwall') ? 2 : 1);
const atWall = (E) => state.foot.pos <= walls(E).back + 0.01;

// ----- finishers: the button at the bottom right spends Momentum on the costliest one you hold and can use now (an arrow on it cycles to the other) -----
const FIN_OK = {
  exec: () => !state.armed.exec && state.foe.hp < state.foe.maxHp * TUNING.fin.below,
  whirl: () => !state.armed.whirl,
  breath: () => state.stamina < state.staMax || state.exhaust > 0,
  disarm: () => (state.foe.beast ? state.stun <= 0 : state.disarm <= 0),
  falseop: () => !state.armed.falseop,
  showstop: () => state.stun <= 0,
};
// a finisher's cost in pips now: Encore takes one off with the crowd in its top third
const finCost = (c) => Math.max(1, TUNING.fin[c.id] - (has('encore') && topThird() ? C_().encore : 0));
const finList = () => DECK.filter((c) => c.fam === 'fin' && has(c.id) && finCost(c) <= state.mom && FIN_OK[c.id]()).sort((a, b) => finCost(b) - finCost(a));
// the one the button shows: the costliest ready, unless the arrow picked the other
function finReady() { const l = finList(); return l.find((c) => c.id === state.finSel) || l[0] || null; }
function finLive(E) { return !state.intro && !state.draft && !state.tent && state.fallT <= 0 && state.endT <= 0 && !portrait(E); }
// the button's rect (with the arrow chip's width when two are ready, `arrow` its left part), or null when nothing is ready
function finBtn(E) {
  const c = finLive(E) && finReady();
  if (!c) return null;
  const B = TUNING.finBtn, two = finList().length > 1, w = B.w + (two ? B.arrow : 0);
  return { c, two, x: E.w - 16 - E.safe.right - w, y: E.h - 10 - E.safe.bottom - B.h, w, h: B.h, arrow: two ? B.arrow : 0 };
}
function fireFinisher(E, c) {
  const Fy = youF(E);
  const cost = finCost(c);
  state.mom -= cost; state.momSpent += cost; state.fins.push(c.id); state.finSel = ''; state.finHintT = 0;
  if (c.id === 'exec' || c.id === 'whirl' || c.id === 'falseop') state.armed[c.id] = true;
  else if (c.id === 'breath') { state.stamina = state.staMax; state.exhaust = 0; }
  else if (c.id === 'disarm') disarmFoe(E, TUNING.fin.disarmDur);
  else if (c.id === 'showstop') { favour(E, TUNING.fin.showFav); stunFoe(E, TUNING.fin.showAwe, 'IN AWE'); roar(E); coins(E, TUNING.crowd.coins); }
  pop(Fy.x + 0.4 * Fy.H, Fy.y - 1.15 * Fy.H, c.name.toUpperCase() + (state.armed[c.id] ? ' ARMED' : '!'), '#e879f9', 24);
  favour(E, TUNING.crowd.fin);
  E.flash('#e879f9', 0.1); E.haptic(30);
  // the war paint glows, a beat of slow motion, and the finisher's name on a banner
  const J = TUNING.juice; state.paintT = J.paint; slowFx(J.finSlow, J.finMul); state.banner = { s: `${c.name.toUpperCase()}!`, t: J.banner };
  E.audio.beep({ freq: 330, dur: 0.18, type: 'sawtooth', slide: 2, gain: 0.1 }); E.audio.beep({ freq: 990, dur: 0.2, type: 'sine', gain: 0.08, delay: 0.1 });
}
// the button's first appearance ever shows a one-line hint, once (stored in the save)
function updateFinisher(E, dt) {
  state.finHintT = Math.max(0, state.finHintT - dt);
  state.hintT = Math.max(0, state.hintT - dt);
  if (!finBtn(E) || E.save.get('finHint', 0) || state.hintT > 0 || (state.hint && state.m - state.boutT0 < TUNING.hint.dur)) return;
  E.save.set('finHint', 1); state.finHintT = TUNING.finBtn.hintDur;
}
// The first run is every run until the first one ends (finish sets firstRunDone): the HUD names its bars and the DODGE button says how to back off.
// An old save from before the flag counts as done when it already records a finished run (a best, a fallen name, a champion, fame or an arena opened).
const firstRun = (E) => !(E.save.get('firstRunDone', 0) || E.save.get('best2', 0) > 0 || E.save.get('wall', []).length || E.save.get('champs', []).length || E.save.get('fame', 0) > 0 || E.save.get('arenas', 0) > 0);
// first-time hints, each shown once ever (stored in the save), one at a time: the HUD's bars (first run only), the crowd's first third, a full Momentum with no war paint, the
// hearts after your first fell, and the drive after your first lunge that met nothing (state.lungeMiss, set in endLunge)
function updateHints(E) {
  if (state.hintT > 0 || state.finHintT > 0 || !finLive(E) || (state.hint && state.m - state.boutT0 < TUNING.hint.dur)) return;
  const C = TUNING.crowd, M = TUNING.mom;
  if (firstRun(E) && !E.save.get('hudHint', 0)) {
    E.save.set('hudHint', 1); state.hintT = TUNING.hint.hudDur; state.hintS = 'Under your hearts: gold diamonds are Momentum, the green bar is stamina, the tan bar is your shield.';
  } else if (state.fav >= C.bands[0] * C.max && !E.save.get('crowdHint', 0)) {
    E.save.set('crowdHint', 1); state.hintT = C.hintDur; state.hintS = 'The crowd loves style: spotting fakes, well-timed blocks, combos. A happy crowd pays more gold.';
  } else if (state.mom >= M.max && !E.save.get('momHint', 0) && !DECK.some((c) => c.fam === 'fin' && has(c.id))) {
    E.save.set('momHint', 1); state.hintT = M.hintDur; state.hintS = 'Momentum is full. War paint (finishers) spends it.';
  } else if (state.felled > 0 && !E.save.get('heartHint', 0)) {
    E.save.set('heartHint', 1); state.hintT = TUNING.hint.heartDur; state.hintS = `Each fell gives +${TUNING.heal} heart. Your hearts carry through the whole run.`;
  } else if (state.lungeMiss && !E.save.get('driveHint', 0)) {
    E.save.set('driveHint', 1); state.lungeMiss = false; state.hintT = TUNING.hint.driveDur; state.hintS = 'Keep holding a lunge to drive further.';
  }
}
// a touch on the button: the arrow chip cycles to the other ready finisher, anywhere else on it fires the one shown
function finTouch(E, p) {
  const b = finBtn(E), r = TUNING.finBtn.reach;
  if (!b || p.x < b.x - r || p.x > b.x + b.w + r || p.y < b.y - r || p.y > b.y + b.h + r) return false;
  if (b.two && p.x < b.x + b.arrow) {
    const l = finList(); state.finSel = l[(l.findIndex((q) => q.id === b.c.id) + 1) % l.length].id;
    E.audio.play('tap'); E.haptic(8);
  } else fireFinisher(E, b.c);
  return true;
}
function emit(E, ev, ctx = {}) {
  crowdEvent(E, ev);
  if (ev === 'perfect' && meWeapon().net && !state.bout.net) castNet(E);
  for (const id of new Set(state.picks)) { const h = HOOKS[id] && HOOKS[id][ev]; if (h) h(E, ctx); }
}

// the trident's net: your first perfect block each bout throws it over him; for TUNING.me.net.dur s his wind-ups and his footwork slow
function castNet(E) {
  const N = TUNING.me.net, Ff = foeF(E);
  state.bout.net = true; state.foeNet = N.dur; state.netsCast++;
  // under the right HUD plate when he stands beneath it (the pop also drifts up 34 px)
  const r = 16 + E.safe.right, under = Ff.x > E.w - r - 176 - 60, hudBot = 10 + E.safe.top + hudRow().shield + 12 + 34 + 14;
  pop(Ff.x, Ff.y - 1.2 * Ff.H, 'NETTED!', '#e2e8f0', 22, under ? hudBot : 0); swooshSound(E); E.haptic(14);
}
const netMul = (k) => (state.foeNet > 0 ? k : 1);

// ----- the crowd: favour for style (TUNING.crowd), carried through the run; coins arc in the first time it passes each step (favStep is the run's high-water) -----
function favour(E, n) {
  const C = TUNING.crowd;
  state.fav = clamp(state.fav + n, 0, C.max);
  if (n > 0) { state.favT = 0.5; state.favM = state.m; }
  const step = Math.floor(state.fav / C.step);
  if (step > state.favStep) { coins(E, C.coins * (step - state.favStep)); state.favStep = step; }
}
// the events that please them: a feint read, a perfect block, a slot hit, a laming, and two of your hits close together
function crowdEvent(E, ev) {
  const C = TUNING.crowd;
  if (ev === 'read' || ev === 'perfect' || ev === 'slot' || ev === 'lame') favour(E, C[ev]);
  if (ev === 'slot' || ev === 'hit') { if (state.m - state.lastHitM <= C.comboWin) favour(E, C.combo); state.lastHitM = state.m; }
}
// what bores them, each frame of play: turtling (the measure his turtle read uses), backing off with no blow of his coming, and any stretch of idle s
// with nothing stylish (a fill resets it) that drains drain of what is held, a second
// (Showboat halves the drains, Darling of Rome stops them); Bread and Circuses heals you once a bout near the top
function crowdDrain(E, dt) {
  const C = TUNING.crowd, sw = state.sw, k = has('showboat') ? C_().showboat : 1;
  if (state.fallT > 0 || state.endT > 0) return;
  state.favSum += state.fav * dt; state.favDur += dt;
  if (has('bread') && !state.bout.bread && state.fav >= C_().breadAt && state.hp < state.maxHp) {
    const was = state.hp; state.bout.bread = true; state.hp = Math.min(state.maxHp, state.hp + C_().bread); coins(E, C_().breadCoins);
    const Fy = youF(E); pop(Fy.x, Fy.y - 1.1 * Fy.H, `THE CROWD THROWS BREAD: ${heartsPop(state.hp - was)}`, '#fde68a', 18); E.haptic(15);
  }
  if (state.winded > 0 || has('darling')) return;
  if (state.mem.turtle >= TUNING.read.turtle) favour(E, -C.turtle * k * dt);
  if (state.dg.down && state.dg.t > TUNING.dodge.dur && !(sw && sw.fin <= 0)) favour(E, -C.back * k * dt);
  if (state.m - state.favM > C.idle) favour(E, -C.drain * k * state.fav * dt);
}
// A Flourish (the Flourish card): the sword thumb drawing a fast circle (its heading turning one way through a full turn at speed, within flourish.win s),
// once each cool s. The thumb, not the hand: the arm's reach would flatten the hand's loop.
function twirl(E, dt) {
  const T = TUNING.flourish, h = state.hand, fl = state.fl, vx = (h.fx - fl.fx) / Math.max(dt, 0.001), vy = (h.fy - fl.fy) / Math.max(dt, 0.001);
  fl.fx = h.fx; fl.fy = h.fy;
  if (!has('flourish') || !h.down || h.lock > 0 || Math.hypot(vx, vy) < T.speed) { fl.acc = 0; fl.ang = null; return; }
  const a = Math.atan2(vy, vx), d = fl.ang == null ? 0 : wrap(a - fl.ang);
  fl.ang = a;
  if (d * fl.acc < 0 || state.m - fl.t > T.win) { fl.acc = 0; fl.t = state.m; }
  fl.acc += d;
  if (Math.abs(fl.acc) < T.turn || state.m - fl.at < T.cool) return;
  fl.acc = 0; fl.at = state.m; state.flourishes++;
  favour(E, C_().flourish); ring(h.ux, h.uy, 60, '#f472b6'); ring(h.hx, h.hy, 36, '#fde68a');
  pop(h.hx, h.hy - 0.16 * myH(E), 'FLOURISH!', '#f9a8d4', 22); ooh(E, 0.6); E.haptic(10);
}
// Bait (the Bait card): dropping a shield you held for baitHold s, with no blow of his coming, baits his next blow
function baitDrop(E) {
  const s = state.sh;
  if (!has('bait') || state.m - s.heldAt < C_().baitHold || (state.sw && state.sw.fin <= 0)) return;
  state.baitT = C_().baitWin;
  const Fy = youF(E); pop(Fy.x + 0.3 * Fy.H, Fy.y - 0.95 * Fy.H, 'GUARD DOWN...', '#c4b5fd', 16);
}
// what the Emperor reads: the meter's average over the champion's bout (this bout's, as it ends), not where it stands at the end
const thumbFav = () => (state.favDur > 0 ? state.favSum / state.favDur : state.fav);
// a few coins thrown from the stands, arcing into the sand between the fighters (cosmetic)
function coins(E, n) {
  const L = lay(E), y0 = E.h * 0.12;
  let live = 0;
  for (const f of state.fx) if (f.k === 'c') live++;
  n = Math.min(n, Math.max(0, TUNING.crowd.coinCap - live));
  for (let i = 0; i < n; i++) {
    const x = Math.random() * E.w, tx = L.x0 + Math.random() * (L.x1 - L.x0), T = 0.8 + Math.random() * 0.4, g = 900, fl = L.floor - 2 - Math.random() * 8;
    state.fx.push({ k: 'c', x, y: y0, vx: (tx - x) / T, vy: (fl - y0 - 0.5 * g * T * T) / T, g, floor: fl, rot: Math.random() * 6.28, vr: 9 + Math.random() * 6, life: T + 0.9, max: T + 0.9 });
  }
  E.audio.play('coin');
}
function gainMom(E, n) {
  const was = state.mom;
  state.mom = Math.min(TUNING.mom.max, state.mom + n);
  if (state.mom > was) { state.momGained += state.mom - was; state.momT = 0.4; E.audio.beep({ freq: 880 + 110 * state.mom, dur: 0.06, type: 'triangle', gain: 0.07 }); }
}
// stacks on him, each with its own end time; the oldest falls off when a new one would pass the cap
function addBleed(E, n) {
  const B = TUNING.bleed, f = state.foe;
  if (n <= 0 || state.fallT > 0 || f.hp <= 0) return;
  for (let i = 0; i < n; i++) { state.bleed.push(state.m + B.dur); state.bleeds++; }
  state.bleed.sort((a, b) => a - b);
  while (state.bleed.length > B.max) state.bleed.shift();
  const Ff = foeF(E); pop(Ff.x + 0.1 * Ff.H, Ff.y - 0.9 * Ff.H, n > 1 ? `BLEED x${n}` : 'BLEED', '#f87171', 16);
}
function updateBleed(E, dt) {
  const B = TUNING.bleed, f = state.foe;
  state.bleed = state.bleed.filter((t) => t > state.m);
  if (!state.bleed.length || state.fallT > 0 || state.endT > 0) { state.bleedT = 0; return; }
  state.bleedT += dt;
  if (state.bleedT < B.tick) return;
  state.bleedT -= B.tick;
  const n = state.bleed.length, Ff = foeF(E), [x, y] = toScreen(Ff, 0, -0.5);
  f.hp -= n * B.dmg; state.bleedDmg += n * B.dmg;
  for (let i = 0; i < 2 + n; i++) state.fx.push({ k: 'd', x: x + (Math.random() - 0.5) * 0.2 * Ff.H, y: y + (Math.random() - 0.5) * 0.3 * Ff.H, vx: 0, vy: 60 + Math.random() * 60, r: 3 + Math.random() * 2, life: 0.5, max: 0.5, c: '#b91c1c' });
  emit(E, 'tick', { n });
  if (f.hp <= 0) fell(E);
}

// ====== BETWEEN BOUTS: the grade and the draft ======
// The bout's grade from what this bout added to the run's counts.
function boutTally() {
  const b = state.bout;
  const t = { slot: state.slotHits - b.slot, read: state.feintsRead - b.read, pun: state.punishes - b.pun, taken: state.taken - b.taken, perf: state.perfects - b.perf, dodge: state.dodged - b.dodge, lame: state.lamings - b.lame };
  t.good = t.slot + t.read + t.pun + t.perf + t.dodge + t.lame;
  return t;
}
// The hits a grade allows in this bout (a pair bout allows one more)
const hitsAllowed = (g) => TUNING.grade[g].taken + (state.gauntlet[state.rack].pair ? TUNING.grade.pair : 0);
function gradeBout() {
  const G = TUNING.grade, t = boutTally();
  for (const g of ['S', 'A', 'B']) if (t.taken <= hitsAllowed(g) && t.good >= G[g].good) return g;
  return 'C';
}
// The families you wear, counted: each piece for its family, war paint for its own (a set bonus is worn by no family)
const famsOf = (c) => c.duo || [c.fam];
function heldFams() {
  const n = {};
  for (const id of state.picks) { const c = CARD[id]; if (!c.duo) n[c.fam] = (n[c.fam] || 0) + 1; }
  return n;
}
// What can be dealt: each card once; never one your keystone makes useless (a dodge card without a dodge, a shield card without a shield), never a keystone
// that takes away what your keystone lives on, a set bonus only while you wear a piece of both its families, and nothing of a family the ludus shuts.
function dealable() {
  const held = heldFams(), lost = (k) => (k === 'dodge' ? noDodge() : noShield());
  return DECK.filter((c) => !has(c.id) && cardOpen(state.me, c) && !(c.needs && lost(c.needs)) && !(c.bans && DECK.some((k) => k.key && has(k.id) && k.needs === c.bans))
    && !(c.duo && !c.duo.every((f) => held[f])));
}
const priceOf = (c) => (c.duo ? TUNING.draft.duoPrice : TUNING.draft.price[c.tier]);
// Within a tier the family is rolled first (families you wear weighted by pull, each set its own), then a piece inside it, so adding pieces to one family
// never changes another family's share.
function famPick(rng, list, held) {
  const key = (c) => (c.duo ? c.id : c.fam), fams = [...new Set(list.map(key))];
  const f = pickW(rng, fams.map((k) => [k, held[k] ? TUNING.draft.pull : 1]));
  return rng.pick(list.filter((c) => key(c) === f));
}
// The priced slot's cascade (L9), top down: a set bonus, a legendary, an epic, each at its own chance, and otherwise a rare (then a common). A tier with
// nothing left to deal falls through to the next; its chance is never spread over the others. The odds are what this deal could give, as the "?" shows them.
const CASCADE = [['set', 'set'], [3, 'legend'], [2, 'epic'], [1, null], [0, null]];
const inTier = (c, t) => (t === 'set' ? !!c.duo : !c.duo && c.tier === t);
// The tiers this deal can reach, each with its chance key; the last one takes whatever is left.
const cascadeTiers = (left) => CASCADE.filter(([t]) => left.some((c) => inTier(c, t))).map(([t, k], i, a) => [t, i === a.length - 1 ? null : k]);
function cascadeOdds(left) {
  let rest = 1;
  return cascadeTiers(left).map(([t, k]) => { const p = k ? rest * TUNING.draft.cascade[k] : rest; rest -= p; return [t, p]; }).filter((e) => e[1] > 0);
}
// Three seeded cards, dealt when the draft opens (salt 0) or rerolled (salt n, never the cards just shown when the deck allows). Two are free: each one's
// rarity (common or rare) by the grade's odds, then its family, then the piece. The third is priced and cascades. At most perFam cards of one family a draft.
// The training ground's fourth card is a third free one, in the run's first draft.
function dealDraft(grade, salt = 0, not = []) {
  const D = TUNING.draft, rng = makeRng((state.seed ^ 0x7f4a7c15) + state.rack * 104729 + salt * 15485863), all = dealable(), held = heldFams(), out = [];
  const deal = D.deal + (state.fourth && state.rack === 0 ? 1 : 0), fresh = all.filter((c) => !not.includes(c)), pool = fresh.length >= deal ? fresh : all;
  const room = (c) => famsOf(c).every((f) => out.filter((o) => famsOf(o).includes(f)).length < D.perFam);
  for (let i = 0; i < deal - 1; i++) {
    const left = pool.filter((c) => !c.duo && c.tier <= 1 && !out.includes(c) && room(c)), tiers = [0, 1].filter((t) => left.some((c) => c.tier === t));
    if (!tiers.length) break;
    const tier = pickW(rng, tiers.map((t) => [t, D.odds[grade][t]]));
    out.push(famPick(rng, left.filter((c) => c.tier === tier), held));
  }
  const left = pool.filter((c) => !out.includes(c) && room(c));
  let pick = null;
  for (const [t, k] of cascadeTiers(left)) if (!k || rng.chance(D.cascade[k])) { pick = famPick(rng, left.filter((c) => inTier(c, t)), held); break; }
  return { cards: pick ? [...out, pick] : out, priced: pick ? out.length : -1, odds: cascadeOdds(left).map(([t, p]) => [t, Math.round(p * 100)]) };
}
// the bout's gold: a fell, plus style (halved for the Darling of Rome), plus the crowd's share of both
function boutGold() {
  const G = TUNING.gold, t = boutTally(), per = state.perfects - state.bout.perf, k = has('darling') ? C_().darlingGold : 1, c = (n) => Math.round(n * k);
  const raw = [G.fell, t.read * G.read, per * G.perfect, t.slot * G.slot, t.taken === 0 ? G.clean : 0];
  const items = [['fell', G.fell], ['fakes spotted', c(raw[1])], ['well-timed blocks', c(raw[2])], ['gap hits', c(raw[3])], ['no hits', c(raw[4])]];
  // the crowd pays a share of the bout's un-halved gold by its mood as the bout ends; the Darling's halving is applied to it once
  items.push(['crowd', c(raw.reduce((a, v) => a + v, 0) * TUNING.crowd.pay * state.fav / TUNING.crowd.max)]);
  const kept = items.filter((e) => e[1] > 0);
  return { sum: kept.reduce((a, e) => a + e[1], 0), items: kept };
}
function openDraft(E) {
  const grade = state.grades[state.grades.length - 1] || 'C', deal = dealDraft(grade);
  state.draft = { grade, tally: boutTally(), gold: state.lastGold, cards: deal.cards, priced: deal.priced, odds: deal.odds, t: 0, btns: [], reroll: null, help: null, helpOn: 0, spoil: spoilOf() };
  state.epicsSeen += deal.cards.filter((c) => c.tier >= 2).length;
  saveRun(E);
  const h = state.hand; h.down = false; h.id = -1; h.atk = null; state.sh.held = false; state.sh.hid = -1; state.dg.down = false;
  E.audio.play('coin');
}
// The spoils: the weapon of the fighter just felled (the last of a pair), when he is a man and it is not yours; an axe or a mace as he carried it, Mevia's
// spear a plain spear. mine: what you carried, for the swap back.
function spoilOf() {
  const f = state.foe, me = state.me, w = f && !f.beast && f.weapon && f.weapon.id, mace = w === 'axe' && !!f.mace;
  if (!w || !TUNING.me.weapons[w] || (w === me.weapon && (w !== 'axe' || mace === !!me.mace))) return null;
  return { w, mace, mine: [me.weapon, !!me.mace], took: false, her: !!(NEW_CHAMPS[f.ck] && NEW_CHAMPS[f.ck].female) };
}
// your fighter with another weapon, as if the weapon wheel had landed on it
function wield(me, w, mace) {
  const idx = me.idx.slice();
  idx[5] = TUNING.me.wheels.weapon.findIndex((e) => e[0] === w);
  return deriveMe({ ...me, idx, mace });
}
const spoilName = (w, mace) => weaponName({ weapon: w, mace }).toLowerCase();
// a tap takes his weapon, a second gives it back; the choice stands when you leave the card
function swapSpoil(E) {
  const S = state.draft.spoil;
  S.took = !S.took;
  state.me = S.took ? wield(state.me, S.w, S.mace) : wield(state.me, S.mine[0], S.mine[1]);
  state.you.lookSig = null;
  saveRun(E);
  E.audio.play('tap'); clangSound(E, 0); E.haptic(15);
}
// a card joins your picks, and a piece takes its slot: whatever was worn there is gone. Titan's hearts come and go with it.
function applyCard(c, on = true) {
  uncapHearts();
  swapCard(c, on);
  capHearts();
}
function swapCard(c, on) {
  if (on && c.slot) for (const id of state.picks.filter((q) => CARD[q].slot === c.slot)) swapCard(CARD[id], false);
  if (on) state.picks.push(c.id); else state.picks.splice(state.picks.indexOf(c.id), 1);
  if (c.id === 'titan') { const k = on ? 1 : -1; state.maxHp += k * TUNING.cards.titan; state.hp = clamp(state.hp + k * TUNING.cards.titan, 1, state.maxHp); }
}
const uncapHearts = () => { state.maxHp += state.capCut; state.capCut = 0; };
// Puppeteer's price: hearts capped at puppetHearts halves; what the cap took comes back when the mantle goes
function capHearts() {
  if (has('puppet')) { const cut = Math.max(0, state.maxHp - C_().puppetHearts); state.capCut += cut; state.maxHp -= cut; state.hp = Math.min(state.hp, state.maxHp); }
  else uncapHearts();
}
// The tent's three wares, seeded: big ones first (a plate only for a part you have bare, each big ware once), then a cheap common
function openTent(E) {
  const T = TUNING.tent, rng = makeRng(state.seed ^ 0x3c6ef372), me = state.me, bare = ['head', 'chest', 'legs'].filter((q) => !me.plates.includes(q));
  const big = rng.shuffle(WARES.filter((w) => w.big && (w.id !== 'plate' || bare.length))).slice(0, T.big), small = rng.shuffle(WARES.filter((w) => !w.big && !has(w.id))).slice(0, T.small);
  const wares = [...big, ...small].map((w) => {
    const part = w.id === 'plate' ? rng.pick(bare) : null;
    return { id: w.id, price: T.price[w.id], name: w.name.replace('{weapon}', weaponName(me).toLowerCase()), line: w.line.replace('{part}', part), part, sold: false };
  });
  state.tent = { wares, t: 0, btns: [], skip: null };
  saveRun(E, state.rack + 1);
}
function buyWare(E, w) {
  if (w.sold) return;
  if (state.gold < w.price) { E.audio.play('miss'); return; }
  state.gold -= w.price; w.sold = true; state.wares.push(w.id);
  if (w.id === 'plate') { state.me.plates.push(w.part); state.you.parts.find((q) => q.d.id === w.part).armour = true; }
  else if (w.id === 'heart' || w.id === 'hide') { const n = w.id === 'heart' ? TUNING.tent.heart : TUNING.cards.hide; state.maxHp += n; state.hp += n; capHearts(); }
  else if (w.id === 'wind') { const add = state.staMax * (TUNING.cards.wind - 1); state.staMax += add; state.stamina += add; }
  else if (w.id === 'token') state.token++;
  E.audio.play('coin'); E.haptic(15);
}
function leaveTent(E) {
  state.tent = null; state.tentDone = true;
  E.audio.play('tap'); state.rack++; newRack(E); poseFoe(E, 0.016);
}
function pickCard(E, c) {
  const d = state.draft;
  if (d && d.cards.indexOf(c) === d.priced) { if (state.gold < priceOf(c)) { E.audio.play('miss'); return; } state.gold -= priceOf(c); state.bought.push(c.id); E.audio.play('coin'); }
  applyCard(c);
  // every card ever picked can fill the training ground's start-card slot
  const seen = E.save.get('picked', []); if (!c.duo && !seen.includes(c.id)) E.save.set('picked', [...seen, c.id]);
  E.audio.play('tap'); E.haptic(15);
  if (d && d.spoil && d.spoil.took) state.spoils++;
  state.draft = null;
  if (state.rack + 1 === TUNING.tent.after && !state.tentDone) { openTent(E); return; }
  state.rack++; newRack(E); poseFoe(E, 0.016);
}
// the run's one token, spent on the draft: three new cards
function rerollDraft(E) {
  const d = state.draft;
  if (!d || state.token <= 0) return;
  state.token--; state.rerolls++; state.tokenUsed += `${state.tokenUsed ? ',' : ''}reroll-b${state.rack + 1}`;
  const deal = dealDraft(d.grade, state.rerolls, d.cards); d.cards = deal.cards; d.priced = deal.priced; d.odds = deal.odds; d.t = 0;
  state.epicsSeen += d.cards.filter((c) => c.tier >= 2).length;
  saveRun(E);
  E.audio.beep({ freq: 520, dur: 0.12, type: 'triangle', slide: 1.4, gain: 0.12 }); E.haptic(12);
}

// ====== JUICE: particles and sounds ======
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
// sand kicked up from the sand at (x, y), thrown back (dir 1 is away from you, -1 toward you) and up, falling back
const SAND = ['#d8b878', '#c9a466', '#e6cc96', '#b08c52'];
function sand(x, y, dir, n) {
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + dir * (0.3 + Math.random() * 0.9), sp = 160 + Math.random() * 260;
    state.fx.push({ k: 's', x, y: y - 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 900, rot: a, vr: (Math.random() - 0.5) * 6, len: 3 + Math.random() * 5, life: 0.4 + Math.random() * 0.35, max: 0.75, c: SAND[i % 4] });
  }
}
function ring(x, y, r, color) { state.fx.push({ k: 'r', x, y, r0: 10, r, life: 0.3, max: 0.3, c: color }); }
// a new pop stacks above (or, at the HUD, below) a live one near it, so simultaneous texts never overlap
let popTop = 80;
function pop(x, y, s, color, size, minY = 0) {
  const clash = (yy) => state.pops.find((q) => q.life > 0.5 * q.max && Math.abs(q.x - x) < 120 && Math.abs(q.y - yy) < (q.size + size) * 0.6);
  for (let n = 0, q; n < 6 && (q = clash(y)); n++) y = q.y - (q.size + size) * 0.6;
  if (y < Math.max(popTop, minY)) { y = Math.max(popTop, minY); for (let n = 0, q; n < 6 && (q = clash(y)); n++) y = q.y + (q.size + size) * 0.6; }
  state.pops.push({ x, y, s, color, size, life: 0.8, max: 0.8 });
}
function plateBits(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, s = 200 + Math.random() * 360;
    state.fx.push({ k: 'p', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 900, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 20, w: 10 + Math.random() * 12, h: 6 + Math.random() * 8, life: 0.9 + Math.random() * 0.4, max: 1.3 });
  }
}

// his violet shimmer off a read feint: sparks of light bursting from his body
function shimmer(x, y, n) {
  const C = ['#c4b5fd', '#a78bfa', '#f5d0fe', '#ffffff'];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, sp = 120 + Math.random() * 260;
    state.fx.push({ k: 'k', x: x + Math.cos(a) * 12, y: y + Math.sin(a) * 30, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: -60, life: 0.3 + Math.random() * 0.3, max: 0.6, c: C[i % 4] });
  }
}
// the juice that follows the fighters' feet each frame: a Giant's thud as he walks, your dodge's ghosts, the dust as a felled foe lands
function stepJuice(E, dt) {
  const J = TUNING.juice;
  if (state.dropT > 0 && (state.dropT -= dt) <= 0) { const Ff = foeF(E); dust(Ff.x + 0.35 * Ff.H, Ff.y, J.dropDust); thud(E, 1.4); }
  for (const [key, k, x, F] of [['foe', state.foe.size.scale, state.step.x, foeF], ['me', meSize().scale, state.foot.pos, youF]]) {
    if (k < J.giantAt) continue;
    const st = state.steps[key] || (state.steps[key] = { x, acc: 0 });
    st.acc += Math.min(0.1, Math.abs(x - st.x)); st.x = x;
    if (st.acc >= J.giantStep) { st.acc = 0; thud(E, 1); shake(E, J.giantShake, 0.08); const Fq = F(E); dust(Fq.x, Fq.y, 3); }
  }
  if (state.ghostT > 0) {
    state.ghostT -= dt;
    if (state.m - state.ghostAt >= J.ghostEvery) { state.ghostAt = state.m; state.ghosts.push({ x: youF(E).x, life: J.ghost }); }
  }
  for (const g of state.ghosts) g.life -= dt;
  state.ghosts = state.ghosts.filter((g) => g.life > 0);
}
// your war paint glowing while a finisher fires
function paintGlow(ctx, E) {
  const F = youF(E), hp = state.you.parts.find((q) => q.d.id === 'head'), k = state.paintT / TUNING.juice.paint;
  if (!hp) return;
  const [x, y] = partCenter(F, state.you, hp), R = 0.2 * F.H, g = ctx.createRadialGradient(x, y, R * 0.2, x, y, R);
  g.addColorStop(0, `rgba(240,171,252,${0.75 * k})`); g.addColorStop(1, 'rgba(232,121,249,0)');
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, 6.283); ctx.fill(); ctx.restore();
}
// the finisher's name on a banner across the arena, sliding in and out
function drawBanner(ctx, E) {
  const b = state.banner, J = TUNING.juice, u = 1 - b.t / J.banner, a = Math.min(1, u * 6, b.t / 0.2), y = E.h * 0.38, h = 46;
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(76,29,90,0.85)'; ctx.fillRect(0, y - h / 2, E.w, h);
  ctx.fillStyle = '#e879f9'; ctx.fillRect(0, y - h / 2, E.w, 3); ctx.fillRect(0, y + h / 2 - 3, E.w, 3);
  ctx.restore();
  E.text(b.s, E.w / 2 + (1 - Math.min(1, u * 5)) * 60, y + 1, { size: 32, weight: '800', color: '#fde68a', alpha: a });
}
// a heart breaking on the HUD: shards flying out and falling (u: 0 to 1)
function heartShatter(ctx, x, y, u) {
  ctx.save(); ctx.globalAlpha = 1 - u; ctx.fillStyle = '#ef4444';
  for (let q = 0; q < 6; q++) {
    const a = -Math.PI / 2 + (q - 2.5) * 0.7, d = 28 * u, sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d + 50 * u * u;
    ctx.beginPath(); ctx.moveTo(sx, sy - 4); ctx.lineTo(sx + 4, sy + 3); ctx.lineTo(sx - 4, sy + 3); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// ----- sounds -----
// a gap hit's deeper thump under the slice
function slotSound(E) { E.audio.beep({ freq: 72, dur: 0.2, type: 'sine', slide: 0.5, gain: 0.32 }); E.audio.noise({ dur: 0.05, gain: 0.12, delay: 0.01 }); }
// a perfect block's sharp ring
function ringSound(E) { E.audio.beep({ freq: 2093, dur: 0.5, type: 'sine', gain: 0.07 }); E.audio.beep({ freq: 3136, dur: 0.32, type: 'sine', gain: 0.035, delay: 0.01 }); }
// the crowd's roar at a fell: a long swell of noise over low voices
function roar(E) {
  E.audio.noise({ dur: 0.9, gain: 0.16 }); E.audio.noise({ dur: 0.7, gain: 0.1, delay: 0.25 });
  [147, 175, 220].forEach((f, i) => E.audio.beep({ freq: f, dur: 0.8, type: 'sawtooth', slide: 1.15, gain: 0.025, delay: i * 0.03 }));
}
// his wind-up, heard as well as seen: a grunt with the gladius, a shaft's creak with the spear, a heavy grunt and creak with the axe, a hiss with the dagger
function windSound(E, id) {
  const A = E.audio;
  if (id === 'spear') A.beep({ freq: 520, dur: 0.18, type: 'square', slide: 0.6, gain: 0.025 });
  else if (id === 'axe') { A.beep({ freq: 110, dur: 0.22, type: 'sawtooth', slide: 0.6, gain: 0.07 }); A.beep({ freq: 380, dur: 0.16, type: 'square', slide: 0.7, gain: 0.02, delay: 0.05 }); }
  else if (id === 'dagger') { A.noise({ dur: 0.1, gain: 0.07 }); A.beep({ freq: 900, dur: 0.06, type: 'sine', slide: 1.3, gain: 0.025 }); }
  else A.beep({ freq: 150, dur: 0.14, type: 'sawtooth', slide: 0.7, gain: 0.06 });
}
// a beast's tell is heard: the lion roars before a pounce and snarls before a swipe, the bear roars as it rears and grunts before a shove
function beastSound(E, kind, pose) {
  const A = E.audio, g = TUNING.juice.roar, big = pose === 'pounce' || pose === 'maul', f0 = kind === 'bear' ? 92 : 150;
  A.noise({ dur: big ? 0.55 : 0.18, gain: g * (big ? 0.9 : 0.6) });
  A.beep({ freq: f0 * (big ? 1 : 1.3), dur: big ? 0.6 : 0.2, type: 'sawtooth', slide: 0.55, gain: g * 0.7 });
  A.beep({ freq: f0 * 1.5, dur: big ? 0.45 : 0.15, type: 'square', slide: 0.6, gain: g * 0.18, delay: 0.03 });
}
// the bear's maul landing: a heavy thud, a shake and the sand kicked up under its paws
function maulJuice(E) {
  const J = TUNING.juice, Ff = foeF(E), [x, y] = toScreen(Ff, 0.2, 0);
  thud(E, J.maulThud); shake(E, J.maulShake, 0.15); dust(x, y, 12); sand(x, y, -1, J.sand >> 1);
}
// a heavy footfall (k: louder)
function thud(E, k = 1) { E.audio.beep({ freq: 55, dur: 0.14, type: 'sine', slide: 0.7, gain: 0.18 * k }); E.audio.noise({ dur: 0.04, gain: 0.05 * k }); }
function sliceSound(E, big) {
  const A = E.audio, f = 1500 + Math.random() * 500;
  A.noise({ dur: 0.1, gain: 0.26 });
  A.beep({ freq: f, dur: 0.09, type: 'sawtooth', slide: 0.22, gain: 0.07 });
  A.beep({ freq: 150, dur: 0.1, type: 'sine', slide: 0.45, gain: 0.26 });
  A.noise({ dur: 0.03, gain: 0.2, delay: 0.025 });
  A.noise({ dur: 0.03, gain: 0.16, delay: 0.055 });
  if (big) A.beep({ freq: 90, dur: 0.22, type: 'sine', slide: 0.4, gain: 0.3 });
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
// a wheel's ticker on a peg: a click, higher the slower the wheel turns (speed in radians per second)
function tickSound(E, speed) { E.audio.beep({ freq: lerp(1500, 520, clamp(speed / 30, 0, 1)), dur: 0.025, type: 'square', gain: 0.045 }); }
// the crowd's "ooh": a few low voices sliding down together over a breath of noise (k: louder)
function ooh(E, k = 1) {
  [196, 247, 294, 330].forEach((f, i) => E.audio.beep({ freq: f, dur: 0.6, type: i % 2 ? 'triangle' : 'sine', slide: 0.78, gain: 0.035 * k, delay: i * 0.02 }));
  E.audio.noise({ dur: 0.45, gain: 0.05 * k });
}
// the crowd chants your name: a clap for each step of their favour (one at least), louder the more they love you
const chantN = () => 1 + Math.round((TUNING.story.chant.max - 1) * state.fav / TUNING.crowd.max);
function chant(E) {
  const C = TUNING.story.chant, n = chantN(), g = C.gain + C.step * (n - 1);
  for (let i = 0; i < n; i++) {
    E.audio.noise({ dur: 0.06, gain: g, delay: i * C.gap });
    E.audio.beep({ freq: 196, dur: 0.16, type: 'triangle', gain: g * 0.8, delay: i * C.gap + 0.02 });
    E.audio.beep({ freq: 294, dur: 0.12, type: 'sine', gain: g * 0.5, delay: i * C.gap + 0.1 });
  }
}
// the crowd at the Emperor's thumb: a long roar, a murmur, or jeers
function crowdVerdict(E, band) {
  const A = E.audio;
  if (band === 2) { for (let i = 0; i < 6; i++) A.noise({ dur: 0.3, gain: 0.22 - i * 0.02, delay: i * 0.22 }); A.play('win'); }
  else if (band === 1) A.noise({ dur: 0.5, gain: 0.08 });
  else for (let i = 0; i < 4; i++) A.beep({ freq: 140 - i * 10, dur: 0.22, type: 'sawtooth', slide: 0.7, gain: 0.08, delay: i * 0.2 });
}
function swooshSound(E, gain = 0.12) { E.audio.noise({ dur: 0.16, gain }); E.audio.beep({ freq: 700, dur: 0.14, type: 'sine', slide: 0.3, gain: gain * 0.4 }); }

// ====== DRAWING: the fighters, the arena, the HUD, cards and wheels ======
const STRAW = ['#e6c866', '#d4b04a', '#f2dc90', '#b8923a'];
const YOU = { skin: '#c58f5e', tunic: '#2f7d6d', hem: '#1d5448', crest: '#e6c866' };

// ----- the art: images by name through E.art (ADR-0020), with the drawn look as every image's fallback; the kit pilot's switch on the ART screen -----
// An image loads only when E.art has a candidate for its name (dev channel); otherwise the drawn look stays (release ships none yet). Each load and each
// pick bumps artV, which the backdrop's and the sprites' cache keys carry, so they repaint once.
let ART = null, artV = 0;
const KIT = { on: false };
const IMGS = new Map();
function artImg(name) {
  if (!ART || !ART.has(name)) return null;
  let e = IMGS.get(name);
  // the name's file is looked up again only when a load or a pick has bumped artV (images are asked for many times a frame)
  if (e && e.v === artV) return e.ok ? e.im : null;
  const raw = ART.src(name, ''), src = raw ? decodeURIComponent(raw) : raw; // E.art.src encodes the whole manifest value, slashes too: decode it so a subfolder loads
  if (!e || e.src !== src) {
    e = { src, im: new Image(), ok: false, v: artV };
    const en = e;
    en.im.onload = () => { en.ok = true; artV++; };
    en.im.src = src; IMGS.set(name, en);
  }
  e.v = artV;
  return e.ok ? e.im : null;
}
const BACKDROP = { pit: 'arena-pit', city: 'arena-city', rome: 'arena-colosseum', games: 'arena-grand' };
const champPic = (d) => (d && d.champion && !d.beast ? `champ-${d.ck || d.name.split(' ')[0].toLowerCase()}` : null);
const kitOn = () => KIT.on && !!ART && ART.has('kit-base-torso');
// The ART screen is the engine's; the game adds one 44 px switch in its footer row, right of "Copy picks", for the kit pilot (default on, kept in the save as kitPilot).
// It is not drawn, and not tapped, while a thumbnail is held enlarged.
function kitSwitch(E) {
  const sc = E.game.scenes.__art;
  if (!sc || sc.kitSwitch) return;
  const R = sc.render, T = sc.onTap, [bw, bh] = TUNING.kit.sw;
  const btn = () => { const c = sc.copyBtn, cy = c ? c.y + c.h / 2 : E.h - E.safe.bottom - 28; return { x: E.w - E.safe.right - 16 - bw, y: cy - bh / 2, w: bw, h: bh }; };
  sc.kitSwitch = true;
  sc.render = function (ctx) {
    R.call(this, ctx);
    if (this.hold) return;
    const b = btn();
    E.roundRect(b.x, b.y, b.w, b.h, 10, KIT.on ? '#3b82f6' : '#1f2937', KIT.on ? null : '#475569');
    E.text(`KIT ${KIT.on ? 'ON' : 'OFF'}`, b.x + b.w / 2, b.y + b.h / 2, { size: 14, weight: '800', color: KIT.on ? '#fff' : '#cbd5e1' });
  };
  sc.onTap = function (p) {
    if (!this.hold && E.hit(btn(), p)) { KIT.on = !KIT.on; E.save.set('kitPilot', KIT.on); artV++; E.audio.play('tap'); return; }
    T.call(this, p);
  };
}
// the ART screen's plain names, by asset name (the engine shows an unknown name with its dashes as spaces)
const ART_NAMES = {
  'arena-pit': 'Pit backdrop', 'arena-city': 'City backdrop', 'arena-colosseum': 'Colosseum backdrop', 'arena-grand': 'Grand Games backdrop',
  brutus: 'Old Brutus', 'brutus-proud': 'Old Brutus, proud', 'champ-marcus': 'Marcus the Red', 'champ-aurelius': 'Aurelius the Golden', 'champ-flamma': 'Flamma the Unbroken',
  'champ-varro': 'Varro of Capua', 'champ-twins': 'Castor and Pollux', 'champ-hermes': 'Hermes the Swift', 'champ-carpophorus': 'Carpophorus the Beastmaster',
  'champ-mevia': 'Mevia the Huntress', 'champ-aquila': "Aquila, the Emperor's Blade", emperor: 'The Emperor',
  'kit-base-head': 'Head', 'kit-helmet-gallic': 'Gallic helmet', 'kit-shield-round': 'Round shield',
  'kit-helmet-murmillo': 'Murmillo helmet', 'kit-helmet-thraex': 'Thracian helmet', 'kit-helmet-secutor': 'Secutor helmet', 'kit-galerus': 'Shoulder guard (galerus)',
  'kit-shield-scutum': 'Tall shield (scutum)', 'kit-shield-parma': 'Small round shield (parma)', 'kit-plate-chest': 'Chest plate', 'kit-plate-manica': 'Arm guard (manica)',
  'kit-plate-greave': 'Greave', 'kit-wrap-trousers': 'Leg wraps',
  'beast-lion-head': 'Lion, head', 'beast-lion-tail': 'Lion, tail', 'beast-bear-head': 'Bear, head',
};
for (const [k, n] of [['lion', 'Lion'], ['bear', 'Bear']]) for (const [part, pn] of [['body', 'body'], ['upperleg', 'upper leg'], ['lowerleg', 'lower leg']]) {
  ART_NAMES[`beast-${k}-${part}`] = `${n}, ${pn}`; ART_NAMES[`beast-${k}-${part}-young`] = `Young ${k}, ${pn}`;
}
for (const [k, n] of [['torso', 'Torso'], ['upperarm', 'Upper arm'], ['forearm', 'Forearm'], ['thigh', 'Thigh'], ['shin', 'Shin']]) {
  ART_NAMES[`kit-base-${k}`] = `${n}, muscular`; ART_NAMES[`kit-base-${k}-lean`] = `${n}, lean`; ART_NAMES[`kit-base-${k}-avg`] = `${n}, average`;
}
// Step 6c-2 (Pack 20): the one-segment limbs, the card gear by the card's gear name, the draped net
for (const [k, n] of [['upperarm', 'Upper arm'], ['thigh', 'Thigh']]) for (const [t, tn] of [['', 'muscular'], ['-lean', 'lean'], ['-avg', 'average']]) ART_NAMES[`kit-base-${k}${t}-seg`] = `${n}, ${tn}, one segment`;
for (const [k, n] of [['lion', 'Lion'], ['bear', 'Bear']]) { ART_NAMES[`beast-${k}-upperleg-seg`] = `${n}, upper leg, one segment`; ART_NAMES[`beast-${k}-upperleg-young-seg`] = `Young ${k}, upper leg, one segment`; }
// a card's painted piece: its gear name as a file (Matador's Ribbons is the one whose file drops the 's)
const GEAR_FILE = { matador: 'gear-matador-ribbons' };
const gearFile = (c) => GEAR_FILE[c.id] || `gear-${c.gear.toLowerCase().replace(/'/g, '').replace(/\s+/g, '-')}`;
for (const c of DECK) if (c.slot && TUNING.kit.gear[gearFile(c)]) ART_NAMES[gearFile(c)] = `${c.gear} (${c.name} card)`;
ART_NAMES['kit-net-draped'] = 'Net, draped over a netted fighter';
const artLabel = (name) => ART_NAMES[name] || (String(name).replace(/-+/g, ' ').trim().replace(/^./, (c) => c.toUpperCase()));
// a portrait's crop (fractions x0 y0 x1 y1) at w x h px, cached at the screen's pixel ratio; null until it loads
const PICS = new Map();
function picSprite(E, name, crop, w, h) {
  const im = artImg(name);
  if (!im) return null;
  const k = Math.min(E.dpr || 1, TUNING.skin.maxDpr), key = `${name}|${crop.join(',')}|${w}|${h}|${k}|${artV}`;
  let s = PICS.get(key);
  if (!s) {
    const sx = crop[0] * im.width, sy = crop[1] * im.height, sw = (crop[2] - crop[0]) * im.width, sh = (crop[3] - crop[1]) * im.height;
    const cv = canSprite ? new OffscreenCanvas(Math.ceil(w * k), Math.ceil(h * k)) : null;
    if (!cv) return { im, sx, sy, sw, sh };
    const c = cv.getContext('2d');
    c.imageSmoothingQuality = 'high'; c.drawImage(im, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
    s = { im: cv, sx: 0, sy: 0, sw: cv.width, sh: cv.height };
    if (PICS.size > 40) PICS.clear();
    PICS.set(key, s);
  }
  return s;
}
// a portrait in a rounded frame at (x, y), w x h; false when it has not loaded (the caller keeps its drawn layout)
function drawPic(ctx, E, name, crop, x, y, w, h, edge = '#e6c866') {
  const s = picSprite(E, name, crop, w, h);
  if (!s) return false;
  ctx.save(); rrect(ctx, x, y, w, h, Math.min(w, h) * 0.16); ctx.clip();
  ctx.drawImage(s.im, s.sx, s.sy, s.sw, s.sh, x, y, w, h); ctx.restore();
  rrect(ctx, x, y, w, h, Math.min(w, h) * 0.16); ctx.strokeStyle = edge; ctx.lineWidth = 2; ctx.stroke();
  return true;
}
// Lines someone says, centred on cx from y (lh apart); with that speaker's portrait loaded, his face (s px) sits just left of the block. Each line is
// fitted to w px (less the face). Without the portrait it draws exactly as before. o.minTop: the face's top is kept at or below it (the block moves down);
// returns the face's bottom, or null with no face.
function sayLines(ctx, E, lines, cx, y, lh, w, o, pic, s = TUNING.art.face) {
  const on = pic && artImg(pic), gap = on ? 8 : 0, fs = on ? s : 0, wt = o.weight || '700';
  const sizes = lines.map((t) => (o.fit ? fitSize(ctx, t, o.size, w - fs - gap, wt) : o.size));
  const { minTop, ...oo } = o;
  if (!on) { lines.forEach((t, i) => E.text(t, cx, y + i * lh, { ...oo, size: sizes[i] })); return null; }
  const tw = Math.max(...lines.map((t, i) => { ctx.font = `${wt} ${sizes[i]}px system-ui, sans-serif`; return ctx.measureText(t).width; }));
  let mid = y + (lines.length - 1) * lh / 2;
  if (minTop != null && mid - fs / 2 < minTop) { y += minTop - (mid - fs / 2); mid = y + (lines.length - 1) * lh / 2; }
  const x0 = cx - (tw + fs + gap) / 2;
  drawPic(ctx, E, pic, TUNING.art.crop, x0, mid - fs / 2, fs, fs, o.color || '#e6c866');
  lines.forEach((t, i) => E.text(t, x0 + fs + gap + tw / 2, y + i * lh, { ...oo, size: sizes[i] }));
  return { bottom: mid + fs / 2 };
}
const sayLine = (ctx, E, t, cx, y, w, o, pic, s) => sayLines(ctx, E, [t], cx, y, 0, w, o, pic, s);
// Old Brutus's line on a bout card: his face (a card's size) kept TUNING.art.gap clear of the reason's banner above it; returns the y a line below
// him must not go above (the card grows by TUNING.art.cardDrop with his face on, see cardGrow).
const brutusFaceOn = () => !!artImg('brutus');
const cardGrow = () => (brutusFaceOn() ? TUNING.art.cardDrop : 0);
function brutusCardLine(ctx, E, cx, y, tb, w, thread, below) {
  const A = TUNING.art, fb = sayLine(ctx, E, `Old Brutus: \u201c${brutusIntro()}\u201d`, cx, y + tb + 10, w - 28, { size: 14, fit: true, weight: '700', color: '#fde68a', minTop: y + tb + (thread ? A.gap - 3 : -3) }, 'brutus', A.faceCard);
  return fb ? Math.max(below, fb.bottom + A.gap + 9) : below;
}
// The kit: a man's look with the kit on, his muscle tier by Strength, whether he is you, and his painted pieces (step 6b: his type's helmet and shield,
// the leg wraps of the types that wear them), all in the look's id, so his sprites repaint only when one of them changes; cached on the look
const KIT_HELM = { murmillo: 'murmillo', hoplo: 'thraex', open: 'secutor', cap: 'gallic' };
const KIT_SHIELD = { murmillo: 'scutum', hoplo: 'parma', open: 'round', cap: 'round' };
const KIT_WRAP = { hoplo: true };
const KIT_GEAR = { plate: 'kit-plate-chest', manica: 'kit-plate-manica', greave: 'kit-plate-greave', wrap: 'kit-wrap-trousers', galerus: 'kit-galerus' };
function kitTier(str) { const T = TUNING.kit.tier; return str <= T.lean ? 'lean' : str <= T.avg ? 'avg' : ''; }
function lookFor(fm, isFoe) {
  const lk = lookOf(fm, isFoe);
  if (!kitOn() || fm.beast) return lk;
  const tier = kitTier(isFoe ? fm.str : state.me.str), key = `${tier}|${isFoe ? '' : 'y'}|${artV}`;
  if (!lk.kitL || lk.kitL.key !== key) {
    const helm = KIT_HELM[lk.helm] || 'gallic', shield = KIT_SHIELD[lk.helm] || 'round', wrap = !!KIT_WRAP[lk.helm];
    // the worn pieces whose paint has loaded (step 6c-2), so a part repaints when one arrives
    const ga = Object.values(lk.gear || {}).filter((c) => TUNING.kit.gear[gearFile(c)] && artImg(gearFile(c))).map((c) => c.id).join('.');
    lk.kitL = { key, lk: { ...lk, kitL: null, plain: lk, kit: { tier, you: !isFoe, helm, shield, wrap }, id: `${lk.id}|kit${key}|${helm}.${shield}${wrap ? '.wrap' : ''}|ga${ga}` } };
  }
  return lk.kitL.lk;
}
// An image by name with its joints J (px of J.size: an image at another size scales them; one on J.wide's wider canvas takes J.wide). px > 0: a copy
// scaled near px across J.w (or its width), cached, for a part drawn live each frame rather than the full image; dark shades that copy (a far leg).
const KIT_TIERED = ['torso', 'upperarm', 'forearm', 'thigh', 'shin'];
const KIT_LIVE = new Map();
// the file a name loads now, without its folder and extension (kit-base-thigh-A): the key of the joints measured per image
function artStem(name) { const e = IMGS.get(name); return e && e.src ? e.src.replace(/^.*\//, '').replace(/\.\w+$/, '') : ''; }
function artPic(name, J0, px = 0, dark = 0) {
  const im = artImg(name);
  if (!im) return null;
  const st = artStem(name), C = TUNING.kit.crop[st] || TUNING.beastArt.crop[st], J1 = J0.wide && im.width === J0.wide.size[0] ? J0.wide : J0;
  const J = C ? { ...J1, ...C } : J1, sz = J.size;
  if (!px || !canSprite) return { im, J, kx: im.width / sz[0], ky: im.height / sz[1] };
  const f = Math.min(1, TUNING.kit.live * px / ((J.w || sz[0]) * im.width / sz[0])), key = `${name}|${Math.round(px)}|${dark}|${artV}`;
  let L = KIT_LIVE.get(key);
  if (!L) {
    const cv = new OffscreenCanvas(Math.max(1, Math.round(im.width * f)), Math.max(1, Math.round(im.height * f))), c = cv.getContext('2d');
    c.imageSmoothingQuality = 'high'; c.drawImage(im, 0, 0, cv.width, cv.height);
    if (dark) { c.globalCompositeOperation = 'source-atop'; c.fillStyle = `rgba(20,10,4,${dark})`; c.fillRect(0, 0, cv.width, cv.height); }
    if (KIT_LIVE.size > 48) KIT_LIVE.clear();
    L = { im: cv, J, kx: cv.width / sz[0], ky: cv.height / sz[1] };
    KIT_LIVE.set(key, L);
  }
  return L;
}
// parts whose `-seg` image is held back for a repaint: they draw the cropped 6c-1 art instead; entries go when the art chat repaints them
const SEG_HOLD = new Set(['beast-bear-upperleg', 'beast-bear-upperleg-young']);
const segOf = (n) => (ART.has(`${n}-seg`) && !SEG_HOLD.has(n) ? `${n}-seg` : n);
// a kit part's image for a tier: the tier's own when it has one, else the muscular base; its one-segment part (-seg) first when there is one
function kitPic(part, tier, px = 0) {
  const t = tier && KIT_TIERED.includes(part) ? `kit-base-${part}-${tier}` : null, n = t && ART && ART.has(t) ? t : `kit-base-${part}`;
  return artPic(ART ? segOf(n) : n, TUNING.kit[part], px);
}
const helmPic = (lk) => artPic(`kit-helmet-${lk.kit.helm}`, TUNING.kit.helm[lk.kit.helm]);
const gearPic = (piece, px = 0) => artPic(KIT_GEAR[piece], TUNING.kit[piece], px);
const shieldPic = (kind, px = 0) => artPic(`kit-shield-${kind}`, TUNING.kit.shields[kind], px);
// Step 6c-2: the painted piece a kit look wears in a slot (null: the drawn piece stays); px > 0 a live copy
function gearArt(lk, slot, px = 0) {
  const c = lk.kit && lk.gear && lk.gear[slot], f = c && gearFile(c), J = f && TUNING.kit.gear[f];
  return J ? artPic(f, J, px) : null;
}
// a gear piece pinned from A to B, w px across its J.w (none: in its own shape), mirrored when painted facing left (or flip); bare (his unplated
// part): a piece that would read as a plate shows only its rows above J.bare
function wearSeg(c, P, A, B, w, bare = false, flip = false) {
  drawSeg(c, bare && P.J.bare ? { ...P, J: { ...P.J, clip: P.J.bare } } : P, A, B, P.J.w ? w : 0, !!P.J.flip !== flip);
}
// a height along an arm (H from the shoulder, as TUNING.kit.gear's arm pieces) on a live arm from shoulder S through elbow E to fist F
const armAt = (S, E, F, y) => (y <= ARM_LEN / 2 ? lerp2(S, E, y / (ARM_LEN / 2)) : lerp2(E, F, y / (ARM_LEN / 2) - 1));
// Pin a kit image so its joint a lands on A and b on B (canvas px), w px across its J.w (0: the length's scale both ways). flip mirrors the image across
// its own width first (the joints with it); J.clip draws only its rows above that one.
function drawSeg(c, P, A, B, w, flip = false) {
  const J = P.J, iw = P.im.width, ax = (flip ? J.size[0] - J.a[0] : J.a[0]) * P.kx, bx = (flip ? J.size[0] - J.b[0] : J.b[0]) * P.kx, ay = J.a[1] * P.ky, by = J.b[1] * P.ky;
  const L = Math.hypot(B[0] - A[0], B[1] - A[1]), l = Math.hypot(bx - ax, by - ay), sy = L / l, sx = w ? w / (J.w * P.kx) : sy;
  c.save(); c.translate(A[0], A[1]); c.rotate(Math.atan2(B[1] - A[1], B[0] - A[0]) - Math.PI / 2); c.scale(sx, sy); c.rotate(Math.atan2(bx - ax, by - ay)); c.translate(-ax, -ay);
  if (flip) { c.translate(iw, 0); c.scale(-1, 1); }
  if (J.clip) { const ch = Math.round(J.clip * P.ky); c.drawImage(P.im, 0, 0, iw, ch, 0, 0, iw, ch); } else c.drawImage(P.im, 0, 0);
  c.restore();
}
// The torso pinned from y0 to y1, w across, mirrored when painted turned to his left (J.flip). One painted with its upper arms hanging at its sides
// (J.trim: below row r, only columns x0 to x1) has them cut off, since the arms are drawn as their own parts.
function kitTorso(c, P, y0, y1, w) {
  const J = P.J, T = J.trim, f = !!J.flip;
  if (T) {
    const sx = w / J.w, yr = y0 + (T[0] - J.a[1]) * (y1 - y0) / (J.b[1] - J.a[1]), big = 4 * (Math.abs(y1 - y0) + w), x0 = f ? J.a[0] - T[2] : T[1] - J.a[0];
    c.save(); c.beginPath(); c.rect(-big, yr - big, 2 * big, big); c.rect(x0 * sx, yr, (T[2] - T[1]) * sx, big); c.clip();
  }
  drawSeg(c, P, [0, y0], [0, y1], w, f);
  if (T) c.restore();
}
// The chest plate on the torso, w across: the whole plate from the neck to the belt, or (lower, the belly's) its lower half from the waist to y1;
// mirrored with the torso when painted turned to his left
function torsoPlate(c, PL, H, w, lower, y1) {
  const K = TUNING.kit, J = PL.J;
  if (lower) drawSeg(c, { ...PL, J: { ...J, a: [J.a[0], J.abs], b: [J.b[0], J.size[1]] } }, [0, K.cut * H], [0, y1], w, !!J.flip);
  else drawSeg(c, PL, [0, K.neck * H], [0, K.belt * H], w, !!J.flip);
}
// darken what is painted so far (the far leg, before the near one; the far arm's sprite)
function farShade(c, H, b) { c.save(); c.globalCompositeOperation = 'source-atop'; c.fillStyle = `rgba(20,10,4,${TUNING.kit.far})`; c.fillRect(b[0] * H, b[1] * H, (b[2] - b[0]) * H, (b[3] - b[1]) * H); c.restore(); }
// The kit under a part's sprite: the head (none under a closed helmet), the torso cut into the chest and the belly, an arm's two halves in its frame,
// both legs; with the painted plates of the plated parts (the chest plate, its lower half on the belly, the manica, the greaves) and the wraps of the
// types that wear them, so the far arm and leg are shaded with theirs. False when a body image has not loaded (the part is painted procedurally). The
// part's own painter runs after it, kit-aware: the drawn plates only where a plate's image is missing, then the gear and type looks, no skin.
function kitBody(c, p, H, lk) {
  const K = TUNING.kit, id = p.d.id, t = lk.kit.tier;
  if (id === 'cloak') return true;
  if (id === 'head') {
    const hg = gearArt(lk, 'helmet'), P = kitPic('head'), hp = p.armour && !(hg && hg.J.helm) && helmPic(lk);
    if (!P) return false;
    if (!(hp && hp.J.closed)) drawSeg(c, P, [p.d.x * H, K.top * H], [p.d.x * H, K.chin * H], 0);
    return true;
  }
  if (id === 'chest' || id === 'belly') {
    const P = kitPic('torso', t), B = BOX[id], PL = p.armour && gearPic('plate'), w = PARTS[pidx('belly')].w * H;
    if (!P) return false;
    c.save(); c.beginPath();
    if (id === 'chest') c.rect(B[0] * H, B[1] * H, (B[2] - B[0]) * H, (K.cut - B[1]) * H); else c.rect(B[0] * H, K.cut * H, (B[2] - B[0]) * H, (B[3] - K.cut) * H);
    c.clip(); kitTorso(c, P, K.neck * H, K.belt * H, w);
    if (PL) torsoPlate(c, PL, H, w * P.J.k, id === 'belly', (p.d.y + p.d.h / 2) * H);
    // the chest piece, drawn whole into both halves so it runs on across the cut
    const G = gearArt(lk, 'chest'), A = G && G.J.at;
    if (G) wearSeg(c, G, [A[0] * H, A[1] * H], [A[0] * H, A[2] * H], w * P.J.k, !p.armour && !lk.kit.you);
    c.restore();
    return true;
  }
  if (id === 'armF' || id === 'armB') {
    const U = kitPic('upperarm', t), F = kitPic('forearm', t), w = p.d.w * H, el = ARM_LEN / 2 * H, M = p.armour && gearPic('manica');
    if (!U || !F) return false;
    drawSeg(c, U, [0, 0], [0, el], w); drawSeg(c, F, [0, el], [0, ARM_LEN * H], w);
    if (M) drawSeg(c, M, [0, el], [0, el + (ARM_LEN * H - el) * M.J.to], w);
    const G = gearArt(lk, 'arms');
    if (G) wearSeg(c, G, [0, G.J.at[0] * H], [0, G.J.at[1] * H], w);
    if (id === 'armB') farShade(c, H, BOX[id]);
    return true;
  }
  if (id === 'legs') {
    const T = kitPic('thigh', t), S = kitPic('shin', t), w = TUNING.kit.leg * H, Wr = lk.kit.wrap && gearPic('wrap'), G = p.armour && gearPic('greave'), B = gearArt(lk, 'legs');
    if (!T || !S) return false;
    LEGS.forEach(([hip, knee, ank], i) => {
      const P = (q) => [q[0] * H, q[1] * H];
      drawSeg(c, T, P(hip), P(knee), w); drawSeg(c, S, P(knee), P(ank), w);
      if (Wr) drawSeg(c, Wr, P(hip), P(knee), w);
      if (G) drawSeg(c, G, P(lerp2(knee, ank, G.J.from)), P(lerp2(knee, ank, G.J.to)), w);
      if (B) wearSeg(c, B, P(lerp2(knee, ank, B.J.at[0])), P(lerp2(knee, ank, B.J.at[1])), w);
      if (!i) farShade(c, H, BOX.legs);
    });
    return true;
  }
  return false;
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
  // yours only (the ludus's armoury): the trident's net fighter, and the sica's Thracian with a plumed closed helm
  trident: { id: 'retiarius', helm: 'cap', bare: 'band', band: '#c9a43a', galerus: true, net: true, metal: STEEL, trim: '#d6b04a', skin: '#c99568', hair: '#4a2a14', tunic: '#b08c34', hem: '#6e561a', wrap: 'loin' },
  sica: { id: 'thraex', helm: 'hoplo', bare: 'leather', metal: STEEL, trim: '#c9a43a', skin: '#c08a5c', hair: '#2a1a10', tunic: '#7a2e5a', hem: '#4a1838', crest: '#c8372a', wrap: 'tunic' },
};
// Your metal follows your rolled armour set: bronze and leather, steel with bronze trim, polished steel with gold and a red crest.
const MYLOOK = {
  light: { metal: BRONZE, trim: LEATHER.mid },
  medium: { metal: STEEL, trim: BRONZE.lite },
  heavy: { metal: POLISH, trim: '#e6c866', crest: '#d8473a' },
};
const BLACK = { hi: '#a4a4ac', lite: '#62626a', mid: '#3a3a40', dark: '#1d1d22', edge: '#08080a' };
const GOLD = { hi: '#fff4c2', lite: '#f0cf6a', mid: '#c9a43a', dark: '#7a5a14', edge: '#3a2a06' };
const DARKHIDE = { hi: '#8c7b6b', lite: '#5e4e40', mid: '#3d3129', dark: '#221a15', edge: '#0c0907' };
// The family looks, so a build reads at a glance: the Wall bronze, Blood dark red with iron barbs and hooks, the Dancer light cloth and mint ribbons,
// the Brute black iron and spikes, the Trickster dark leather with violet trim (and a hood), the Showman gilt with purple and pink plumes; the lone
// piece (the lion pelt) gold.
const FAM_LOOK = {
  wall: { metal: BRONZE, cloth: '#8a5a24', hi: '#e6c866' },
  blood: { metal: IRON, cloth: '#6e1414', hi: '#b91c1c' },
  dancer: { metal: BRONZE, cloth: '#efe6cf', hi: '#6ee7b7' },
  brute: { metal: BLACK, cloth: '#2a2420', hi: '#77746d' },
  trick: { metal: DARKHIDE, cloth: '#2e2622', hi: '#a78bfa' },
  show: { metal: GOLD, cloth: '#6b21a8', hi: '#f472b6' },
  rare: { metal: GOLD, cloth: '#b8862e', hi: '#f2d88a' },
};
// War paint, one pattern per finisher: its colour
const PAINT_COL = { exec: '#dc2626', whirl: '#3b82f6', breath: '#f8fafc', disarm: '#d97706', falseop: '#8b5cf6', showstop: '#facc15' };
// A look's gear: the pieces by slot, the war paint held, and a signature for the sprite cache. Titan's black plate turns every plate black iron, and the
// Darling of Rome's gilded harness every plate gold.
const PLATE_METAL = { titan: BLACK, darling: GOLD };
function withGear(lk, ids, id) {
  const gear = gearOf(ids), paint = ids.filter((q) => PAINT_COL[q]);
  return { ...lk, gear, paint, metal: (gear.chest && PLATE_METAL[gear.chest.id]) || lk.metal, id: `${id}|${Object.values(gear).map((c) => c.id).join('.')}|${paint.join('.')}` };
}
// Your look: the gladiator type of your rolled weapon, in your own colours (teal tunic) and the metal of your armour set, with the gear you wear and the
// tailor's looks (tailor: a crest, a plume, a shield paint and a cloak, each where no piece of gear is worn).
function myLook(me, ids = [], tailor = {}) {
  const G = GTYPE[me.weapon], A = MYLOOK[me.set], t = Object.entries(tailor).map(([k, v]) => `${k}${v.i}`).join('');
  const lk = withGear({ ...G, metal: A.metal, trim: A.trim, skin: YOU.skin, hair: '#3a2414', tunic: YOU.tunic, hem: YOU.hem,
    crest: A.crest || G.crest || YOU.crest, band: G.band ? YOU.crest : YOU.tunic, beard: G.beard && !me.female }, ids, `you-${me.set}-${me.weapon}${me.female ? 'f' : ''}-${t}`);
  lk.tailor = tailor;
  return lk;
}
// his look: his type's, with his gear (rolled once per bout); the Huntress carries her net at her belt
const foeLook = (d) => withGear({ ...GTYPE[d.weapon.id], ...(TUNING.champs[d.ck] && TUNING.champs[d.ck].net ? { net: true } : {}) }, d.gear || [], GTYPE[d.weapon.id].id);
// yours is rebuilt only when your picks change
function lookOf(fm, isFoe) {
  if (isFoe) return fm.look || GTYPE[fm.weapon.id];
  const sig = `${state.picks.join(',')}|${state.me.weapon}${state.me.mace ? 'm' : ''}`;
  if (state.you.lookSig !== sig) { state.you.look = myLook(state.me, state.picks, state.tailor || {}); state.you.lookSig = sig; }
  return state.you.look;
}
// What shows through each gap, and which sides the plate edges frame it from (top and bottom, or left and right).
const SLOT_ART = { 'slot-neck': ['skin', 'tb'], 'slot-armpit': ['linen', 'lr'], 'slot-waist': ['linen', 'tb'], 'slot-elbow': ['skin', 'tb'], 'slot-knee': ['skin', 'tb'] };
// Sprite bounds in body units (arms in their own frame): room for crests, straps, the fist and the shoulder guards.
const BOX = { head: [-0.17, -1.05, 0.18, -0.66], chest: [-0.17, -0.74, 0.17, -0.5], belly: [-0.19, -0.54, 0.19, -0.24], armF: [-0.14, -0.2, 0.12, 0.42], armB: [-0.14, -0.2, 0.12, 0.42], legs: [-0.21, -0.43, 0.25, 0.04], cloak: [-0.34, -0.86, 0.14, 0.01] };
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
  const K = lk.kit;
  if (!K) { c.fillStyle = skinGrad(c, 0.035 * H, 0, -0.025 * H, 0, shade(lk.skin, 0.85)); c.fillRect(-0.025 * H, -0.745 * H, 0.06 * H, 0.07 * H); }
  const helm = p.armour ? lk.helm : null, closed = helm === 'murmillo' || helm === 'hoplo';
  // the kit: the painted head is under this (none under a closed helmet); a plated head wears his type's painted helmet, or the helmet piece
  // of his gear that covers the skull (step 6c-2)
  const hg = K && p.armour && gearArt(lk, 'helmet'), kh = K && p.armour && (hg && hg.J.helm ? hg : helmPic(lk));
  if (kh) { drawSeg(c, kh, [x, TUNING.kit.top * H], [x, TUNING.kit.chin * H], 0); wear(c, p, H, x, y - r * 0.3, r, () => { c.beginPath(); c.arc(x, y - r * 0.3, r * 0.9, 0, TAU); }); return; }
  if (!closed && !K) face(c, x, y, r, lk, H, !p.armour);
  if (!p.armour) {
    if (K) { tint(c, p, H); return; }
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
  if (!p.armour && lk.kit) { tint(c, p, H); return; }
  // the kit's painted plate is under this: only its dents and cracks go on it
  if (lk.kit && gearPic('plate')) { wear(c, p, H, (x0 + x1) / 2, (y0 + y1) / 2, Math.min(w, h) / 2, () => cuirass(c, x0, y0, x1, y1)); return; }
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
  if (!lk.kit) paintWrap(c, H, lk);
  const d = p.d, w = d.w * H, h = d.h * H, x0 = d.x * H - w / 2, y0 = d.y * H - h / 2, M = lk.metal;
  if (!p.armour && lk.kit) { tint(c, p, H); return; }
  if (lk.kit && gearPic('plate')) wear(c, p, H, x0 + w / 2, y0 + h / 2, Math.min(w, h) / 2, () => rrect(c, x0, y0, w, h, 2));
  else if (!p.armour) {
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
  if (lk.kit) { if (p.armour) { if (gearPic('manica')) wear(c, p, H, 0, (ARM_LEN * 0.75) * H, w / 2, () => rrect(c, x0, ARM_LEN / 2 * H, w, ARM_LEN / 2 * H, 3)); else paintManica(c, p, H, lk, w, h, x0, y0, M); } }
  else if (!p.armour) {
    rrect(c, x0, y0, w, h, w * 0.45); c.fillStyle = skinGrad(c, w / 2, 0, -w / 2, 0, sk); c.fill();
    c.strokeStyle = shade(lk.skin, 0.55); c.lineWidth = lw(H, 0.004); c.lineCap = 'round';
    c.beginPath(); c.moveTo(x0 + w * 0.72, y0 + h * 0.1); c.quadraticCurveTo(x0 + w * 1.0, y0 + h * 0.28, x0 + w * 0.7, y0 + h * 0.44); c.stroke();
    c.beginPath(); c.moveTo(x0 + w * 0.3, y0 + h * 0.58); c.quadraticCurveTo(x0 + w * 0.15, y0 + h * 0.7, x0 + w * 0.35, y0 + h * 0.84); c.stroke();
    line(c, x0 + w * 0.35, y0 + h * 0.5, x0 + w * 0.65, y0 + h * 0.52);
    rrect(c, x0, y0, w, h, w * 0.45); c.strokeStyle = '#3a2414'; c.lineWidth = lw(H, 0.006); c.stroke();
    c.fillStyle = LEATHER.mid; c.fillRect(x0 - 1, y0 + h * 0.82, w + 2, h * 0.09); c.strokeStyle = LEATHER.dark; c.lineWidth = 1; c.strokeRect(x0 - 1, y0 + h * 0.82, w + 2, h * 0.09);
  } else paintManica(c, p, H, lk, w, h, x0, y0, M);
  const fy = ARM_LEN * H, fr = 0.042 * H, fg = c.createRadialGradient(fr * 0.3, fy - fr * 0.3, fr * 0.1, 0, fy, fr);
  fg.addColorStop(0, shade(sk, 1.15)); fg.addColorStop(1, shade(sk, 0.7));
  if (!lk.kit) {
    c.fillStyle = fg; c.beginPath(); c.arc(0, fy, fr, 0, TAU); c.fill(); c.strokeStyle = '#2a1c10'; c.lineWidth = lw(H, 0.006); c.stroke();
    c.strokeStyle = shade(lk.skin, 0.5); c.lineWidth = lw(H, 0.003); for (const k of [-0.4, 0, 0.4]) line(c, fr * k, fy + fr * 0.2, fr * k, fy + fr * 0.75);
  }
  if (!p.armour) tint(c, p, H);
  // (not on a painted man, who has no painted one: drawn lames over his painted shoulder cross his face when his arm is up)
  if (front && lk.pauldron && !lk.kit) {
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
  const gal = !front && lk.galerus && lk.kit && gearPic('galerus');
  if (gal) { const b = TUNING.kit.galerus.box; c.drawImage(gal.im, b[0] * H, b[1] * H, (b[2] - b[0]) * H, (b[3] - b[1]) * H); }
  else if (!front && lk.galerus) {
    // the galerus: a flared shoulder guard rising beside the head
    const g = (i) => { c.beginPath(); c.moveTo(-w * 0.2 + i, 0.04 * H - i); c.lineTo(-w * 1.0 + i, -0.02 * H); c.quadraticCurveTo(-w * 1.25 + i, -0.12 * H + i, -w * 0.9 + i, -0.16 * H + i); c.lineTo(w * 0.35 - i, -0.11 * H + i); c.lineTo(w * 0.6 - i, 0.03 * H - i); c.closePath(); };
    g(0); c.fillStyle = metalGrad(c, w, -0.16 * H, -w, 0.04 * H, BRONZE); c.fill();
    bevel(c, g, BRONZE, H, -0.16 * H, 0.04 * H);
    c.strokeStyle = 'rgba(94,62,21,0.6)'; c.lineWidth = lw(H, 0.004); line(c, -w * 0.5, -0.12 * H, -w * 0.3, 0.02 * H);
  }
}

// the manica: overlapping bands down the arm, a strap along the back
function paintManica(c, p, H, lk, w, h, x0, y0, M) {
  const dn = p.dents / TUNING.armour.dents, n = 6, bh = h / n;
  for (let i = n - 1; i >= 0; i--) {
    const by = y0 + i * bh, hh = i === n - 1 ? bh : bh * 1.3;
    rrect(c, x0 - w * 0.06, by, w * 1.12, hh, hh * 0.35); c.fillStyle = metalGrad(c, w / 2, by, -w / 2, by + hh, M, dn); c.fill();
    c.strokeStyle = M.edge; c.lineWidth = lw(H, 0.005); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = lw(H, 0.003); line(c, x0, by + 1.4, x0 + w, by + 1.4);
  }
  strap(c, x0 + w * 0.22, y0, x0 + w * 0.22, y0 + h, w * 0.16, H, false);
  for (let i = 0; i < n; i++) rivet(c, x0 + w * 0.22, y0 + (i + 0.5) * bh, H, M);
  wear(c, p, H, 0, p.d.y * H, w / 2, () => rrect(c, x0 - w * 0.06, y0, w * 1.12, h, 3));
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
    if (!lk.kit) {
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
    }
    if (!p.armour || (lk.kit && gearPic('greave'))) return;
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
  if (lk.kit && kitPic('head')) { kitSlot(c, p, H); return; }
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

// ----- gear: each piece painted into its part's sprite over the painted part (the shield and weapon pieces are drawn with them, live) -----
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
// a spike; flat (one colour, no gradient) where it is drawn live each frame
function spike(c, x, y, a, len, w, M, flat = false) {
  const nx = -Math.sin(a) * w / 2, ny = Math.cos(a) * w / 2, tx = x + Math.cos(a) * len, ty = y + Math.sin(a) * len;
  c.beginPath(); c.moveTo(x + nx, y + ny); c.lineTo(tx, ty); c.lineTo(x - nx, y - ny); c.closePath();
  c.fillStyle = flat ? M.lite : metalGrad(c, x + nx, y + ny, x - nx, y - ny, M); c.fill(); c.strokeStyle = M.edge; c.lineWidth = 1; c.stroke();
}
// a ribbon or strap along a smooth line through pts, w px wide, with a darker edge
function ribbon(c, pts, w, col) {
  const go = () => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length - 1; i++) { const m = lerp2(pts[i], pts[i + 1], 0.5); c.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); } const e = pts[pts.length - 1]; c.lineTo(e[0], e[1]); };
  c.lineCap = 'round'; c.lineJoin = 'round';
  go(); c.strokeStyle = shade(col, 0.55); c.lineWidth = w + 1.5; c.stroke();
  go(); c.strokeStyle = col; c.lineWidth = w; c.stroke();
  go(); c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = Math.max(0.6, w * 0.25); c.stroke();
}
function disc(c, x, y, r, M) {
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, M.hi); g.addColorStop(0.5, M.lite); g.addColorStop(1, M.dark);
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.strokeStyle = M.edge; c.lineWidth = 1; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.arc(x, y, r * 0.65, Math.PI * 1.1, Math.PI * 1.8); c.stroke();
}
// a band across a part, clipped to the head (or anything)
function clipBand(c, clip, x, y, w, h, fill) { c.save(); clip(); c.clip(); c.fillStyle = fill; c.fillRect(x, y, w, h); c.restore(); }

// The helmet slot rides on the head, plated or bare, and never covers the face. War paint goes on the face first (on the helm, when it is closed).
function paintHeadGear(c, p, H, lk) {
  const d = p.d, x = d.x * H, y = d.y * H, r = d.r * H, g = lk.gear.helmet, closed = p.armour && (lk.helm === 'murmillo' || lk.helm === 'hoplo');
  const head = () => { c.beginPath(); c.arc(x, y, r * 1.04, 0, TAU); };
  (lk.paint || []).forEach((id, i) => {
    const col = PAINT_COL[id];
    c.save(); head(); c.clip(); c.globalAlpha = 0.85; c.fillStyle = col; c.strokeStyle = col; c.lineCap = 'round';
    if (closed) { c.lineWidth = r * 0.18; line(c, x - r * (0.7 - i * 0.3), y - r, x - r * (0.2 - i * 0.3), y + r); }
    else if (id === 'exec') c.fillRect(x + r * 0.2, y - r * 0.24, r * 0.9, r * 0.26);
    else if (id === 'whirl') { c.lineWidth = r * 0.09; c.beginPath(); for (let k = 0; k <= 24; k++) { const a = k * 0.42, rr = r * 0.05 + k * r * 0.012; const px = x + r * 0.32 + Math.cos(a) * rr, py = y + r * 0.42 + Math.sin(a) * rr; if (k) c.lineTo(px, py); else c.moveTo(px, py); } c.stroke(); }
    else if (id === 'breath') for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(x + r * (0.62 - k * 0.08), y + r * (0.18 + k * 0.2), r * 0.08, 0, TAU); c.fill(); }
    else if (id === 'disarm') { c.lineWidth = r * 0.1; c.beginPath(); for (let k = 0; k < 6; k++) c.lineTo(x - r * 0.2 + k * r * 0.18, y - r * (k % 2 ? 0.42 : 0.6)); c.stroke(); }
    else if (id === 'falseop') { c.beginPath(); c.ellipse(x + r * 0.55, y - r * 0.12, r * 0.5, r * 0.2, 0, 0, TAU); c.fill(); c.fillStyle = '#1a1410'; c.beginPath(); c.ellipse(x + r * 0.56, y - r * 0.1, r * 0.1, r * 0.08, 0, 0, TAU); c.fill(); }
    else if (id === 'showstop') for (let k = 0; k < 5; k++) { const a = Math.PI * (1.1 + k * 0.16); c.beginPath(); c.ellipse(x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78, r * 0.13, r * 0.06, a + 1.2, 0, TAU); c.fill(); }
    c.restore();
  });
  if (!g) { if (lk.tailor) tailorHead(c, x, y, r, H, lk.tailor); return; }
  // the painted piece (a helmet that stood in for a plated head's is already on it)
  const G = gearArt(lk, 'helmet');
  if (G) { if (!(p.armour && G.J.helm)) wearSeg(c, G, [x, TUNING.kit.top * H], [x, TUNING.kit.chin * H], 0, !p.armour && !lk.kit.you); return; }
  const L = FAM_LOOK[g.fam], M = L.metal;
  if (g.id === 'braced') {
    // a bronze crest ridge front to back, with a brush of gold horsehair
    clipBand(c, head, x - r * 1.1, y - r * 0.5, r * 2.2, r * 0.17, metalGrad(c, x, y - r * 0.5, x, y - r * 0.33, M));
    c.strokeStyle = L.hi; c.lineWidth = lw(H, 0.004);
    for (let i = 0; i <= 8; i++) { const t = i / 8, bx = x + r * (0.45 - t * 1.35), by = y - r * (0.85 + Math.sin(t * Math.PI) * 0.75); line(c, bx, by, bx - r * 0.12, by - r * 0.32); }
    c.beginPath(); c.moveTo(x + r * 0.55, y - r * 0.8); c.quadraticCurveTo(x + r * 0.1, y - r * 1.75, x - r * 0.95, y - r * 0.55);
    c.lineTo(x - r * 0.75, y - r * 0.48); c.quadraticCurveTo(x, y - r * 1.35, x + r * 0.4, y - r * 0.72); c.closePath();
    c.fillStyle = metalGrad(c, x + r, y - r * 1.6, x - r, y - r * 0.5, M); c.fill(); c.strokeStyle = M.edge; c.lineWidth = lw(H, 0.005); c.stroke();
  } else if (g.id === 'vein') {
    // a dark red band with its tails hanging behind, and an iron hook
    clipBand(c, head, x - r * 1.1, y - r * 0.52, r * 2.2, r * 0.24, L.cloth);
    ribbon(c, [[x - r * 0.92, y - r * 0.4], [x - r * 1.35, y], [x - r * 1.3, y + r * 0.45]], r * 0.16, L.cloth);
    ribbon(c, [[x - r * 0.92, y - r * 0.4], [x - r * 1.6, y - r * 0.2], [x - r * 1.75, y + r * 0.25]], r * 0.14, L.hi);
    c.strokeStyle = IRON.dark; c.lineWidth = lw(H, 0.006); c.beginPath(); c.moveTo(x - r * 0.1, y - r * 0.3); c.lineTo(x - r * 0.1, y - r * 0.05); c.arc(x - r * 0.2, y - r * 0.05, r * 0.1, 0, Math.PI * 0.9); c.stroke();
  } else if (g.id === 'slip') {
    // a light band with two mint ribbons streaming back
    clipBand(c, head, x - r * 1.1, y - r * 0.5, r * 2.2, r * 0.2, L.cloth);
    ribbon(c, [[x - r * 0.95, y - r * 0.4], [x - r * 1.4, y - r * 0.75], [x - r * 1.85, y - r * 0.55]], r * 0.14, L.hi);
    ribbon(c, [[x - r * 0.95, y - r * 0.35], [x - r * 1.45, y - r * 0.1], [x - r * 1.8, y - r * 0.2]], r * 0.12, L.hi);
  } else if (g.id === 'breaker') {
    // a black iron band and two horns
    clipBand(c, head, x - r * 1.1, y - r * 0.55, r * 2.2, r * 0.2, metalGrad(c, x, y - r * 0.55, x, y - r * 0.35, M));
    for (const s of [1, -1]) {
      const bx = x + r * (s > 0 ? 0.4 : -0.55), by = y - r * 0.82, tx = bx + s * r * 0.55, ty = y - r * 1.9;
      c.beginPath(); c.moveTo(bx - r * 0.16, by); c.quadraticCurveTo(bx + s * r * 0.05, y - r * 1.5, tx, ty); c.quadraticCurveTo(bx + s * r * 0.3, y - r * 1.3, bx + r * 0.16, by); c.closePath();
      c.fillStyle = metalGrad(c, bx - r * 0.2, by, bx + r * 0.2, ty, M); c.fill(); c.strokeStyle = M.edge; c.lineWidth = lw(H, 0.004); c.stroke();
    }
  } else if (g.id === 'myfeint') {
    // a dark leather hood over the crown and the back of the head down to the nape, the face left open, a violet hem round the opening
    c.beginPath(); c.moveTo(x + r * 0.62, y - r * 0.78); c.quadraticCurveTo(x + r * 0.2, y - r * 1.5, x - r * 0.75, y - r * 1.18); c.quadraticCurveTo(x - r * 1.5, y - r * 0.6, x - r * 1.38, y + r * 0.55);
    c.lineTo(x - r * 1.05, y + r * 1.2); c.quadraticCurveTo(x - r * 0.55, y + r * 0.55, x - r * 0.3, y - r * 0.05); c.quadraticCurveTo(x, y - r * 0.72, x + r * 0.62, y - r * 0.78); c.closePath();
    const gr = c.createLinearGradient(x, y - r * 1.4, x - r * 1.2, y + r); gr.addColorStop(0, shade(L.cloth, 1.4)); gr.addColorStop(1, shade(L.cloth, 0.7));
    c.fillStyle = gr; c.fill(); c.strokeStyle = M.edge; c.lineWidth = lw(H, 0.005); c.stroke();
    c.strokeStyle = L.hi; c.lineWidth = lw(H, 0.006); c.beginPath(); c.moveTo(x - r * 0.3, y - r * 0.05); c.quadraticCurveTo(x, y - r * 0.72, x + r * 0.62, y - r * 0.78); c.stroke();
  } else if (g.id === 'pleaser') {
    // a gilt band and a tall pink plume
    clipBand(c, head, x - r * 1.1, y - r * 0.55, r * 2.2, r * 0.2, metalGrad(c, x, y - r * 0.55, x, y - r * 0.35, M));
    plume(c, x - r * 0.1, y - r * 0.35, r * 1.2, L.hi, H, 1.5);
  }
}
// The chest slot: a harness, a drape or Titan's black collar and shoulder caps; never a plate on a bare chest.
function paintChestGear(c, p, H, lk) {
  const g = lk.gear.chest; if (!g || gearArt(lk, 'chest')) return;
  const d = p.d, w = d.w * H, h = d.h * H, x0 = d.x * H - w / 2, y0 = d.y * H - h / 2, x1 = x0 + w, y1 = y0 + h, L = FAM_LOOK[g.fam], M = L.metal;
  if (g.id === 'shove') {
    strap(c, x0 + w * 0.12, y0, x1 - w * 0.14, y1 - h * 0.1, 0.018 * H, H, false); strap(c, x1 - w * 0.12, y0, x0 + w * 0.14, y1 - h * 0.1, 0.018 * H, H, false);
    disc(c, x0 + w * 0.5, y0 + h * 0.48, 0.03 * H, M); disc(c, x0 + w * 0.26, y0 + h * 0.25, 0.022 * H, M); disc(c, x0 + w * 0.74, y0 + h * 0.25, 0.022 * H, M);
  } else if (g.id === 'blur') {
    c.save(); c.globalAlpha = 0.6;
    c.beginPath(); c.moveTo(x0 - 0.01 * H, y0 + h * 0.05); c.lineTo(x0 + w * 0.35, y0); c.quadraticCurveTo(x0 + w * 0.7, y0 + h * 0.5, x1 + 0.01 * H, y1); c.lineTo(x1 - w * 0.3, y1 + 0.01 * H); c.quadraticCurveTo(x0 + w * 0.3, y0 + h * 0.6, x0 - 0.01 * H, y0 + h * 0.05); c.closePath();
    c.fillStyle = L.cloth; c.fill(); c.restore();
    c.strokeStyle = L.hi; c.lineWidth = lw(H, 0.004); c.beginPath(); c.moveTo(x0 + w * 0.35, y0); c.quadraticCurveTo(x0 + w * 0.7, y0 + h * 0.5, x1 + 0.01 * H, y1); c.stroke();
    c.strokeStyle = 'rgba(120,110,90,0.35)'; for (const k of [0.3, 0.5]) { c.beginPath(); c.moveTo(x0 + w * k * 0.6, y0 + h * 0.15); c.quadraticCurveTo(x0 + w * (k + 0.2), y0 + h * 0.55, x0 + w * (k + 0.45), y1 - h * 0.05); c.stroke(); }
  } else if (g.id === 'titan') {
    rrect(c, x0 - 0.012 * H, y0 - 0.022 * H, w + 0.024 * H, 0.036 * H, 0.01 * H); c.fillStyle = metalGrad(c, x1, y0 - 0.02 * H, x0, y0 + 0.02 * H, M); c.fill(); c.strokeStyle = M.edge; c.lineWidth = lw(H, 0.005); c.stroke();
    for (let i = 0; i < 5; i++) spike(c, x0 + w * (0.1 + i * 0.2), y0 - 0.02 * H, -Math.PI / 2, 0.028 * H, 0.014 * H, M);
    for (const sx of [x0 + 0.004 * H, x1 - 0.004 * H]) {
      c.beginPath(); c.ellipse(sx, y0 + 0.012 * H, 0.04 * H, 0.03 * H, 0, Math.PI, TAU); c.closePath(); c.fillStyle = metalGrad(c, sx + 0.04 * H, y0 - 0.02 * H, sx - 0.04 * H, y0 + 0.01 * H, M); c.fill(); c.strokeStyle = M.edge; c.stroke();
      spike(c, sx, y0 - 0.012 * H, -Math.PI / 2 - (sx < 0 ? 0.5 : -0.5), 0.03 * H, 0.014 * H, M);
    }
  } else if (g.id === 'mindreader') {
    // a cord round the neck and a bronze amulet with a painted eye
    c.strokeStyle = LEATHER.dark; c.lineWidth = lw(H, 0.004);
    c.beginPath(); c.moveTo(x0 + w * 0.32, y0 - 0.01 * H); c.quadraticCurveTo(x0 + w * 0.4, y0 + h * 0.38, x0 + w * 0.58, y0 + h * 0.4); c.quadraticCurveTo(x0 + w * 0.72, y0 + h * 0.34, x0 + w * 0.78, y0 - 0.01 * H); c.stroke();
    const ax = x0 + w * 0.58, ay = y0 + h * 0.5, ar = 0.022 * H;
    disc(c, ax, ay, ar, BRONZE);
    c.fillStyle = '#f0e6cc'; c.beginPath(); c.ellipse(ax, ay, ar * 0.75, ar * 0.42, 0, 0, TAU); c.fill();
    c.fillStyle = L.hi; c.beginPath(); c.arc(ax, ay, ar * 0.3, 0, TAU); c.fill(); c.fillStyle = '#0b0a10'; c.beginPath(); c.arc(ax, ay, ar * 0.13, 0, TAU); c.fill();
  } else if (g.id === 'darling') {
    // a purple sash across the chest, a gilt collar and two gilt phalerae
    c.save(); path(c, d, H); c.clip(); ribbon(c, [[x0 - 0.01 * H, y0], [x0 + w * 0.5, y0 + h * 0.55], [x1 + 0.01 * H, y1]], 0.032 * H, L.cloth); c.restore();
    rrect(c, x0 - 0.01 * H, y0 - 0.02 * H, w + 0.02 * H, 0.03 * H, 0.01 * H); c.fillStyle = metalGrad(c, x1, y0 - 0.02 * H, x0, y0 + 0.01 * H, M); c.fill(); c.strokeStyle = M.edge; c.lineWidth = lw(H, 0.005); c.stroke();
    disc(c, x0 + w * 0.26, y0 + h * 0.3, 0.022 * H, M); disc(c, x0 + w * 0.76, y0 + h * 0.66, 0.022 * H, M);
  }
}
// The belt slot hangs below your belt, on the tunic, so the waist gap stays as it is.
function paintBeltGear(c, p, H, lk) {
  const g = lk.gear.belt; if (!g) return;
  const G = gearArt(lk, 'belt'), A = G && G.J.at;
  if (G) { wearSeg(c, G, [A[0] * H, A[2] * H], [A[1] * H, A[2] * H], 0); return; }
  const L = FAM_LOOK[g.fam], M = L.metal, y = -0.474 * H;
  if (g.id === 'cruel') {
    rrect(c, -0.112 * H, y - 0.012 * H, 0.224 * H, 0.024 * H, 0.006 * H); c.fillStyle = L.cloth; c.fill(); c.strokeStyle = shade(L.cloth, 0.5); c.lineWidth = 1; c.stroke();
    c.strokeStyle = M.dark; c.lineWidth = lw(H, 0.006); c.lineCap = 'round';
    for (const k of [-0.07, 0, 0.07]) { c.beginPath(); c.moveTo(k * H, y); c.lineTo(k * H, y + 0.035 * H); c.arc(k * H - 0.012 * H, y + 0.035 * H, 0.012 * H, 0, Math.PI * 0.95); c.stroke(); }
  } else if (g.id === 'lightfeet') {
    ribbon(c, [[-0.11 * H, y], [0, y + 0.006 * H], [0.11 * H, y]], 0.018 * H, L.cloth);
    ribbon(c, [[-0.085 * H, y], [-0.105 * H, y + 0.06 * H], [-0.08 * H, y + 0.13 * H]], 0.012 * H, L.hi);
    ribbon(c, [[-0.085 * H, y], [-0.06 * H, y + 0.07 * H], [-0.09 * H, y + 0.15 * H]], 0.01 * H, L.hi);
    c.fillStyle = L.hi; c.beginPath(); c.arc(-0.085 * H, y, 0.013 * H, 0, TAU); c.fill(); c.strokeStyle = shade(L.hi, 0.5); c.lineWidth = 1; c.stroke();
  } else if (g.id === 'brawler') {
    for (let i = 0; i <= 8; i++) {
      const t = i / 8, cx = (-0.1 + t * 0.2) * H, cy = y + 0.004 * H + Math.sin(t * Math.PI) * 0.035 * H;
      c.beginPath(); c.ellipse(cx, cy, i % 2 ? 0.012 * H : 0.006 * H, i % 2 ? 0.006 * H : 0.01 * H, 0, 0, TAU); c.strokeStyle = M.edge; c.lineWidth = lw(H, 0.006); c.stroke(); c.strokeStyle = M.lite; c.lineWidth = lw(H, 0.003); c.stroke();
    }
    rrect(c, -0.018 * H, y - 0.03 * H, 0.036 * H, 0.032 * H, 0.006 * H); c.fillStyle = metalGrad(c, 0.02 * H, y - 0.03 * H, -0.02 * H, y, M); c.fill(); c.strokeStyle = M.edge; c.lineWidth = 1; c.stroke();
    spike(c, 0.018 * H, y - 0.014 * H, 0, 0.02 * H, 0.012 * H, M);
  } else if (g.id === 'bread') {
    // a gilt band with coins hanging from it
    rrect(c, -0.112 * H, y - 0.01 * H, 0.224 * H, 0.02 * H, 0.006 * H); c.fillStyle = metalGrad(c, 0, y - 0.01 * H, 0, y + 0.01 * H, M); c.fill(); c.strokeStyle = M.edge; c.lineWidth = 1; c.stroke();
    for (const k of [-0.075, -0.03, 0.015, 0.06]) { c.strokeStyle = M.dark; c.lineWidth = 1; line(c, k * H, y + 0.01 * H, k * H, y + 0.028 * H); disc(c, k * H, y + 0.04 * H, 0.012 * H, M); }
  }
}
// The arms slot: a bracer near the wrist, or iron pauldrons on the shoulder (in the arm's own frame, the fist at ARM_LEN)
function paintArmGear(c, p, H, lk) {
  const g = lk.gear.arms; if (!g || gearArt(lk, 'arms')) return;
  const d = p.d, w = d.w * H, h = d.h * H, x0 = -w / 2, L = FAM_LOOK[g.fam], M = L.metal;
  if (g.id === 'riposte') {
    const by = h * 0.58, bh = h * 0.22;
    rrect(c, x0 - w * 0.1, by, w * 1.2, bh, w * 0.2); c.fillStyle = metalGrad(c, w / 2, by, -w / 2, by + bh, M); c.fill(); c.strokeStyle = M.edge; c.lineWidth = lw(H, 0.005); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = lw(H, 0.003); line(c, x0, by + 1.5, x0 + w, by + 1.5);
    rivet(c, 0, by + bh * 0.3, H, M); rivet(c, 0, by + bh * 0.75, H, M);
  } else if (g.id === 'rend') {
    const by = h * 0.55, bh = h * 0.25;
    rrect(c, x0 - w * 0.08, by, w * 1.16, bh, w * 0.2); c.fillStyle = L.cloth; c.fill(); c.strokeStyle = '#2a0808'; c.lineWidth = lw(H, 0.004); c.stroke();
    c.strokeStyle = 'rgba(255,190,170,0.4)'; for (let k = 0; k < 3; k++) line(c, x0, by + bh * (0.2 + k * 0.3), x0 + w, by + bh * (0.35 + k * 0.3));
    for (let k = 0; k < 3; k++) spike(c, x0 - w * 0.08, by + bh * (0.2 + k * 0.3), Math.PI + 0.35, 0.03 * H, 0.012 * H, M);
  } else if (g.id === 'matador') {
    for (let k = 0; k < 4; k++) ribbon(c, [[x0 - w * 0.05, h * (0.5 + k * 0.08)], [0, h * (0.53 + k * 0.08)], [x0 + w * 1.05, h * (0.55 + k * 0.08)]], h * 0.035, L.hi);
    ribbon(c, [[x0, h * 0.82], [x0 - w * 0.5, h * 0.92], [x0 - w * 0.9, h * 1.05]], h * 0.035, L.hi);
  } else if (g.id === 'jugg') {
    for (let i = 2; i >= 0; i--) {
      const py = -0.012 * H + i * 0.03 * H;
      c.beginPath(); c.ellipse(0, py, w * 0.95, 0.042 * H, 0, Math.PI, TAU); c.closePath();
      c.fillStyle = metalGrad(c, w, py - 0.04 * H, -w, py, M); c.fill(); c.strokeStyle = M.edge; c.lineWidth = lw(H, 0.005); c.stroke();
    }
    spike(c, 0, -0.05 * H, -Math.PI / 2, 0.04 * H, 0.018 * H, M);
  } else if (g.id === 'bluff') {
    // a dark leather bracer with a violet seam and two knife hilts tucked in it
    const by = h * 0.55, bh = h * 0.26;
    rrect(c, x0 - w * 0.1, by, w * 1.2, bh, w * 0.2); c.fillStyle = L.cloth; c.fill(); c.strokeStyle = M.edge; c.lineWidth = lw(H, 0.004); c.stroke();
    c.strokeStyle = L.hi; c.lineWidth = lw(H, 0.003); line(c, x0 - w * 0.1, by + bh * 0.5, x0 + w * 1.1, by + bh * 0.5);
    for (const k of [0.25, 0.72]) { const kx = x0 + w * k; c.fillStyle = LEATHER.dark; c.fillRect(kx - w * 0.08, by - h * 0.06, w * 0.16, h * 0.08); spike(c, kx, by - h * 0.06, -Math.PI / 2, 0.03 * H, 0.012 * H, STEEL); }
  } else if (g.id === 'playcrowd') {
    // two gilt armlets
    for (const [k, t] of [[0.18, 0.08], [0.62, 0.1]]) { const by = h * k, bh = h * t; rrect(c, x0 - w * 0.08, by, w * 1.16, bh, bh * 0.4); c.fillStyle = metalGrad(c, w / 2, by, -w / 2, by + bh, M); c.fill(); c.strokeStyle = M.edge; c.lineWidth = lw(H, 0.004); c.stroke(); }
  }
}
// The legs slot: boots, sandal ribbons or spiked boots on both shins
function paintLegGear(c, p, H, lk) {
  const g = lk.gear.legs; if (!g || gearArt(lk, 'legs')) return;
  const L = FAM_LOOK[g.fam], M = L.metal, SH = 0.068 * H;
  LEGS.forEach((leg) => {
    const [, knee, ank] = leg.map((q) => [q[0] * H, q[1] * H]);
    if (g.id === 'standfast' || g.id === 'bones') {
      const top = lerp2(knee, ank, 0.45), boot = g.id === 'bones' ? BLACK : null;
      c.beginPath(); quad(c, top, [ank[0], ank[1] + 0.012 * H], SH * 1.22, SH * 1.18);
      c.fillStyle = boot ? metalGrad(c, top[0] - SH, top[1], top[0] + SH, ank[1], boot) : LEATHER.mid; c.fill(); c.strokeStyle = boot ? boot.edge : LEATHER.dark; c.lineWidth = lw(H, 0.005); c.stroke();
      if (boot) { for (const t of [0.25, 0.65]) { const q = lerp2(top, ank, t); spike(c, q[0] + SH * 0.5, q[1], 0.15, 0.03 * H, 0.013 * H, boot); } }
      else {
        c.beginPath(); quad(c, top, lerp2(top, ank, 0.18), SH * 1.3, SH * 1.28); c.fillStyle = metalGrad(c, top[0] - SH, top[1], top[0] + SH, top[1], M); c.fill(); c.strokeStyle = M.edge; c.lineWidth = 1; c.stroke();
        for (const t of [0.45, 0.8]) { const q = lerp2(top, ank, t); rivet(c, q[0] + SH * 0.25, q[1], H, M); }
      }
    } else if (g.id === 'sidestep') {
      const pts = [];
      for (let k = 0; k <= 6; k++) { const q = lerp2(ank, knee, 0.08 + k * 0.13); pts.push([q[0] + (k % 2 ? 1 : -1) * SH * 0.5, q[1]]); }
      ribbon(c, pts, 0.008 * H, L.hi);
      c.fillStyle = L.cloth; c.beginPath(); c.moveTo(ank[0] - SH * 0.4, ank[1] - 0.01 * H); c.lineTo(ank[0] - SH * 1.4, ank[1] - 0.04 * H); c.lineTo(ank[0] - SH * 1.1, ank[1] - 0.005 * H); c.lineTo(ank[0] - SH * 1.5, ank[1] + 0.005 * H); c.lineTo(ank[0] - SH * 0.4, ank[1] + 0.005 * H); c.closePath(); c.fill();
      c.strokeStyle = shade(L.cloth, 0.6); c.lineWidth = 1; c.stroke();
    } else if (g.id === 'unreadable') {
      // soft dark leather wrapped from the ankle to below the knee, its straps criss-crossed in violet
      const top = lerp2(knee, ank, 0.3);
      c.beginPath(); quad(c, top, [ank[0], ank[1] + 0.01 * H], SH * 1.18, SH * 1.12); c.fillStyle = L.cloth; c.fill(); c.strokeStyle = M.edge; c.lineWidth = lw(H, 0.004); c.stroke();
      c.strokeStyle = L.hi; c.lineWidth = lw(H, 0.003);
      for (let k = 0; k < 4; k++) { const a = lerp2(top, ank, 0.1 + k * 0.22), b = lerp2(top, ank, 0.21 + k * 0.22); line(c, a[0] - SH * 0.55, a[1], b[0] + SH * 0.55, b[1]); }
    } else if (g.id === 'encore') {
      // gilded greaves, a pink ribbon tied below the knee
      const top = lerp2(knee, ank, 0.1);
      c.beginPath(); quad(c, top, lerp2(knee, ank, 0.92), SH * 1.3, SH * 1.12); c.fillStyle = metalGrad(c, top[0] - SH, top[1], top[0] + SH, ank[1], M); c.fill(); c.strokeStyle = M.edge; c.lineWidth = lw(H, 0.005); c.stroke();
      const q = lerp2(knee, ank, 0.18); ribbon(c, [[q[0] - SH * 0.6, q[1]], [q[0] - SH * 1.3, q[1] + 0.03 * H], [q[0] - SH * 1.6, q[1] + 0.06 * H]], 0.008 * H, L.hi);
    }
  });
}
// The tailor's looks on your head, where no helmet piece is worn: a metal crest ridge front to back, then a plume of three tall feathers on top
function tailorHead(c, x, y, r, H, T) {
  if (T.crest) {
    const col = T.crest.col;
    c.beginPath(); c.moveTo(x + r * 0.6, y - r * 0.78); c.quadraticCurveTo(x + r * 0.15, y - r * 1.7, x - r * 1.0, y - r * 0.5);
    c.lineTo(x - r * 0.78, y - r * 0.42); c.quadraticCurveTo(x - r * 0.05, y - r * 1.3, x + r * 0.42, y - r * 0.7); c.closePath();
    const gr = c.createLinearGradient(x, y - r * 1.6, x, y - r * 0.5); gr.addColorStop(0, shade(col, 1.35)); gr.addColorStop(1, shade(col, 0.62));
    c.fillStyle = gr; c.fill(); c.strokeStyle = shade(col, 0.35); c.lineWidth = lw(H, 0.005); c.stroke();
  }
  if (T.plume) {
    const col = T.plume.col, by = y - r * (T.crest ? 1.25 : 0.95);
    for (let i = 0; i < 3; i++) {
      c.save(); c.translate(x - r * (0.05 + i * 0.32), by); c.rotate(-0.25 - i * 0.3);
      c.beginPath(); c.ellipse(0, -r * 0.5, r * 0.2, r * 0.58, 0, 0, TAU); c.fillStyle = i === 1 ? shade(col, 0.85) : col; c.fill();
      c.strokeStyle = shade(col, 0.45); c.lineWidth = lw(H, 0.003); c.stroke(); line(c, 0, 0, 0, -r * 1.0);
      c.restore();
    }
  }
}
// The cloak slot: drawn behind the whole body as its own sprite
const CLOAK = { id: 'cloak', shape: 'rect', x: -0.1, y: -0.45, w: 0.2, h: 0.5 };
function paintCloak(c, p, H, lk) {
  const g = lk.gear.cloak, tc = lk.tailor && lk.tailor.cloak; if (!g && !tc) return;
  // the painted cloak or pelt (step 6c-2) hangs from the shoulder line behind the body
  const G = g && gearArt(lk, 'cloak'), A = G && G.J.at;
  if (G) { wearSeg(c, G, [A[0] * H, A[1] * H], [A[2] * H, A[3] * H], A[4] * H); return; }
  const L = g ? FAM_LOOK[g.fam] : null, P = (x, y) => [x * H, y * H];
  const shape = (pts, fill, edge) => { c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath(); c.fillStyle = fill; c.fill(); c.strokeStyle = edge; c.lineWidth = lw(H, 0.005); c.lineJoin = 'round'; c.stroke(); };
  if (!g) {
    // the tailor's cloak: plain wool from the shoulders to below the knee, a bronze brooch, two folds
    const pts = [P(0.04, -0.7), P(-0.06, -0.72), P(-0.13, -0.6), P(-0.19, -0.4), P(-0.23, -0.2), P(-0.22, -0.12), P(-0.12, -0.13), P(-0.03, -0.15), P(0.01, -0.36), P(0.02, -0.55)];
    const gr = c.createLinearGradient(0, -0.7 * H, -0.23 * H, -0.12 * H); gr.addColorStop(0, shade(tc.col, 1.15)); gr.addColorStop(1, shade(tc.col, 0.68));
    shape(pts, gr, shade(tc.col, 0.45));
    c.strokeStyle = 'rgba(0,0,0,0.28)'; c.lineWidth = lw(H, 0.004); for (const k of [0.3, 0.6]) { c.beginPath(); c.moveTo(-0.04 * H, -0.66 * H); c.quadraticCurveTo(-0.12 * H, -0.4 * H, -(0.08 + k * 0.16) * H, -0.13 * H); c.stroke(); }
    disc(c, 0.01 * H, -0.68 * H, 0.016 * H, BRONZE);
  } else if (g.id === 'untouch') {
    const pts = [P(0.04, -0.7), P(-0.05, -0.72), P(-0.12, -0.6), P(-0.2, -0.4), P(-0.27, -0.2), P(-0.31, -0.03), P(-0.22, -0.05), P(-0.16, -0.01), P(-0.08, -0.04), P(-0.02, -0.3), P(0.02, -0.55)];
    const gr = c.createLinearGradient(0, -0.7 * H, -0.3 * H, -0.03 * H); gr.addColorStop(0, L.cloth); gr.addColorStop(1, shade(L.cloth, 0.72));
    shape(pts, gr, shade(L.cloth, 0.5));
    c.strokeStyle = L.hi; c.lineWidth = lw(H, 0.008); c.beginPath(); c.moveTo(-0.31 * H, -0.03 * H); c.lineTo(-0.22 * H, -0.05 * H); c.lineTo(-0.16 * H, -0.01 * H); c.lineTo(-0.08 * H, -0.04 * H); c.stroke();
    c.strokeStyle = 'rgba(90,80,60,0.35)'; c.lineWidth = lw(H, 0.004); for (const k of [0.3, 0.55]) { c.beginPath(); c.moveTo(-0.04 * H, -0.65 * H); c.quadraticCurveTo(-0.14 * H, -0.35 * H, -(0.12 + k * 0.2) * H, -0.05 * H); c.stroke(); }
  } else if (g.id === 'bloodlust' || g.id === 'unbreak') {
    const wolf = g.id === 'bloodlust', fur = wolf ? '#76726c' : '#c08a3e', dark = wolf ? '#3d3a36' : '#7a5222';
    const pts = [P(0.05, -0.71), P(-0.06, -0.74), P(-0.13, -0.62), P(-0.17, -0.48)];
    for (let i = 0; i <= 6; i++) pts.push(P(-0.17 + i * 0.03, -0.34 + (i % 2 ? 0.035 : 0)));
    pts.push(P(0.02, -0.5));
    shape(pts, fur, dark);
    if (wolf) { c.strokeStyle = L.cloth; c.lineWidth = lw(H, 0.008); c.beginPath(); c.moveTo(-0.16 * H, -0.47 * H); c.quadraticCurveTo(-0.08 * H, -0.42 * H, 0.0, -0.36 * H); c.stroke(); }
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1; for (let i = 0; i < 7; i++) line(c, (-0.13 + i * 0.022) * H, -0.6 * H, (-0.15 + i * 0.026) * H, -0.4 * H);
    // the beast's head over the back of the shoulder: the wolf's ears and snout, or the lion's mane
    const hx = -0.05 * H, hy = -0.76 * H;
    if (wolf) {
      shape([[hx - 0.03 * H, hy], [hx - 0.02 * H, hy - 0.05 * H], [hx, hy - 0.02 * H], [hx + 0.02 * H, hy - 0.05 * H], [hx + 0.03 * H, hy - 0.01 * H], [hx + 0.08 * H, hy + 0.01 * H], [hx + 0.03 * H, hy + 0.03 * H], [hx - 0.03 * H, hy + 0.03 * H]], fur, dark);
      c.fillStyle = '#b91c1c'; c.beginPath(); c.arc(hx + 0.02 * H, hy, 0.005 * H, 0, TAU); c.fill();
    } else {
      for (let i = 0; i < 12; i++) { const a = Math.PI * 0.5 + i * 0.26; ribbon(c, [[hx + 0.02 * H, hy + 0.04 * H], [hx + 0.02 * H + Math.cos(a) * 0.06 * H, hy + 0.04 * H + Math.sin(a) * 0.06 * H]], 0.014 * H, i % 2 ? '#a8722e' : '#d9a24e'); }
    }
  } else if (g.id === 'showboat') {
    // a purple cloak swept back to the calves, gold-trimmed
    const pts = [P(0.04, -0.7), P(-0.06, -0.72), P(-0.14, -0.58), P(-0.21, -0.38), P(-0.26, -0.16), P(-0.25, -0.06), P(-0.14, -0.08), P(-0.05, -0.1), P(0, -0.34), P(0.02, -0.55)];
    const gr = c.createLinearGradient(0, -0.7 * H, -0.26 * H, -0.06 * H); gr.addColorStop(0, shade(L.cloth, 1.2)); gr.addColorStop(1, shade(L.cloth, 0.7));
    shape(pts, gr, shade(L.cloth, 0.45));
    c.strokeStyle = GOLD.lite; c.lineWidth = lw(H, 0.008); c.beginPath(); c.moveTo(-0.25 * H, -0.06 * H); c.lineTo(-0.14 * H, -0.08 * H); c.lineTo(-0.05 * H, -0.1 * H); c.stroke();
    c.strokeStyle = 'rgba(30,8,40,0.4)'; c.lineWidth = lw(H, 0.004); for (const k of [0.35, 0.6]) { c.beginPath(); c.moveTo(-0.05 * H, -0.65 * H); c.quadraticCurveTo(-0.14 * H, -0.38 * H, -(0.1 + k * 0.18) * H, -0.09 * H); c.stroke(); }
  } else if (g.id === 'puppet') {
    // a dark mantle to the waist, and the marionette's cross over the shoulder with its violet strings hanging down the back
    shape([P(0.04, -0.71), P(-0.07, -0.74), P(-0.15, -0.62), P(-0.2, -0.47), P(-0.22, -0.36), P(-0.15, -0.38), P(-0.07, -0.35), P(0, -0.4), P(0.02, -0.55)], L.cloth, L.metal.edge);
    c.strokeStyle = L.hi; c.lineWidth = lw(H, 0.005); c.beginPath(); c.moveTo(-0.22 * H, -0.36 * H); c.lineTo(-0.15 * H, -0.38 * H); c.lineTo(-0.07 * H, -0.35 * H); c.stroke();
    c.strokeStyle = 'rgba(196,181,253,0.85)'; c.lineWidth = 1; for (const k of [-0.22, -0.16, -0.1]) line(c, k * H, -0.8 * H, (k - 0.02) * H, -0.5 * H);
    c.strokeStyle = LEATHER.lite; c.lineWidth = lw(H, 0.008); c.lineCap = 'round'; line(c, -0.25 * H, -0.8 * H, -0.07 * H, -0.8 * H); line(c, -0.16 * H, -0.85 * H, -0.16 * H, -0.75 * H);
  }
}
// A gap guard: a polished steel piece with a gold rim over the gap, so it reads shut: the gorget, the manica, the wide belt, the couters, the knee guards.
function paintGuard(c, p, H, lk) {
  if (lk.kit && kitPic('head') && kitGuard(c, p, H)) return;
  const d = p.d, w = d.w * H, h = d.h * H, x = d.x * H, y = d.y * H, M = POLISH, t = 0.016 * H;
  const plate = (fn) => { fn(); c.fillStyle = metalGrad(c, x + w, y - h, x - w, y + h, M); c.fill(); c.strokeStyle = M.edge; c.lineWidth = lw(H, 0.006); c.stroke(); fn(); c.strokeStyle = GOLD.lite; c.lineWidth = lw(H, 0.004); c.stroke(); };
  if (d.id === 'slot-elbow' || d.id === 'slot-knee') {
    const r = Math.max(w, h) * 0.62 + t * 0.4;
    plate(() => { c.beginPath(); c.arc(x, y, r, 0, TAU); });
    c.beginPath(); c.arc(x, y, r * 0.45, 0, TAU); c.fillStyle = GOLD.mid; c.fill(); c.strokeStyle = GOLD.edge; c.lineWidth = 1; c.stroke();
  } else if (d.id === 'slot-neck') {
    plate(() => { c.beginPath(); c.moveTo(x - w / 2 - t, y - h / 2 - t * 0.4); c.lineTo(x + w / 2 + t, y - h / 2 - t * 0.4); c.lineTo(x + w / 2 + t * 1.3, y + h / 2); c.quadraticCurveTo(x, y + h / 2 + t * 1.6, x - w / 2 - t * 1.3, y + h / 2); c.closePath(); });
    c.strokeStyle = 'rgba(30,34,40,0.6)'; c.lineWidth = lw(H, 0.003); for (const k of [0.2, 0.55]) line(c, x - w / 2, y - h / 2 + h * k + t * 0.3, x + w / 2, y - h / 2 + h * k + t * 0.3);
  } else plate(() => rrect(c, x - w / 2 - t * 0.7, y - h / 2 - t * 0.7, w + t * 1.4, h + t * 1.4, t * 0.6));
  rivet(c, x - w * 0.3, y, H, M); rivet(c, x + w * 0.3, y, H, M);
}
// Step 6e, on a painted man (and his card): a gap is a dark opening on the painted body with a warm rim, no drawn padding, strap or metal lips;
// a guarded gap is shut by a band of the painted chest plate's riveted rim (TUNING.kit.guard) laid along the gap's lips, cut to its shape
function kitSlot(c, p, H) {
  const d = p.d, w = d.w * H, h = d.h * H, x0 = d.x * H - w / 2, y0 = d.y * H - h / 2, tb = SLOT_ART[d.id][1] === 'tb';
  const g = tb ? c.createLinearGradient(0, y0, 0, y0 + h) : c.createLinearGradient(x0, 0, x0 + w, 0);
  g.addColorStop(0, 'rgba(48,16,6,0.8)'); g.addColorStop(0.5, 'rgba(6,3,2,0.95)'); g.addColorStop(1, 'rgba(48,16,6,0.8)');
  rrect(c, x0, y0, w, h, Math.min(w, h) * 0.45); c.fillStyle = g; c.fill();
  c.strokeStyle = 'rgba(255,170,90,0.85)'; c.lineWidth = Math.max(1, 0.005 * H); c.stroke();
}
function kitGuard(c, p, H) {
  const PL = gearPic('plate');
  if (!PL) return false;
  const G = TUNING.kit.guard, d = p.d, t = 0.016 * H, tb = SLOT_ART[d.id][1] === 'tb', w = d.w * H + 2 * t, h = d.h * H + 1.4 * t;
  const [bw, bh] = tb ? [w, h] : [h, w], sh = G.y[1] - G.y[0], sw = Math.min(sh * bw / bh, 2 * G.x - 40);
  // the gorget flares over the collarbones, the others are rounded bands
  const shape = () => {
    if (d.id !== 'slot-neck') { rrect(c, -bw / 2, -bh / 2, bw, bh, bh * 0.35); return; }
    c.beginPath(); c.moveTo(-bw / 2, -bh / 2); c.lineTo(bw / 2, -bh / 2); c.lineTo(bw / 2 + t * 0.3, bh / 2 - t * 0.6); c.quadraticCurveTo(0, bh / 2 + t, -bw / 2 - t * 0.3, bh / 2 - t * 0.6); c.closePath();
  };
  c.save(); c.translate(d.x * H, d.y * H); if (!tb) c.rotate(Math.PI / 2);
  c.save(); shape(); c.clip();
  c.drawImage(PL.im, (G.x - sw / 2) * PL.kx, G.y[0] * PL.ky, sw * PL.kx, sh * PL.ky, -bw / 2, -bh / 2 - t * 0.2, bw, bh + t * 1.2);
  c.restore();
  shape(); c.strokeStyle = BRONZE.edge; c.lineWidth = lw(H, 0.005); c.stroke();
  c.restore();
  return true;
}
// A worn piece's rarity: a faint glint now and then, in its colour, at its slot's place on the body (body units; the arms ride the far arm)
const GLINT_AT = { helmet: [0.0, -0.9], chest: [0.07, -0.64], belt: [0.06, -0.47], legs: [0.1, -0.14], cloak: [-0.14, -0.5], arms: [0.03, 0.22] };
function drawGlints(ctx, fm, H, lk) {
  const S = TUNING.skin;
  Object.entries(lk.gear).forEach(([slot, c], i) => {
    const at = GLINT_AT[slot]; if (!at) return;
    const k = Math.pow(Math.max(0, Math.sin((state.m / S.gearGlint + i * 0.37) * TAU)), 6) * S.gearGlintA;
    if (k < 0.02) return;
    ctx.save();
    if (slot === 'arms' && fm.fr.armB) { const fr = fm.fr.armB; ctx.translate(fr.ox * H, fr.oy * H); ctx.rotate(fr.rot); }
    glint(ctx, at[0] * H, at[1] * H, 0.035 * H, rarCol(c), k);
    ctx.restore();
  });
}
function glint(ctx, x, y, s, col, a) {
  ctx.globalAlpha *= a; ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x, y, x + s * 0.5, y); ctx.quadraticCurveTo(x, y, x, y + s); ctx.quadraticCurveTo(x, y, x - s * 0.5, y); ctx.quadraticCurveTo(x, y, x, y - s); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, s * 0.12, 0, TAU); ctx.fill();
}

const PAINT = { head: paintHead, chest: paintChest, belly: paintBelly, armF: paintArm, armB: paintArm, legs: paintLegs, cloak: paintCloak };
const GEAR_PAINT = { head: paintHeadGear, chest: paintChestGear, belly: paintBeltGear, armF: paintArmGear, armB: paintArmGear, legs: paintLegGear };
function paintPart(c, p, H, lk) {
  if (p.slot) { (p.guard ? paintGuard : paintSlot)(c, p, H, lk); return; }
  if (lk.kit && !kitBody(c, p, H, lk)) lk = lk.plain;
  PAINT[p.d.id](c, p, H, lk);
  if (lk.gear && GEAR_PAINT[p.d.id]) GEAR_PAINT[p.d.id](c, p, H, lk);
}
// The part's sprite, repainted only when its look, scale, dents, cracks or damage change. Null without OffscreenCanvas (painted live).
function spriteOf(E, p, H, lk) {
  if (!canSprite) return null;
  const k = Math.min(E.dpr || 1, TUNING.skin.maxDpr), d = p.d;
  const key = `${Math.round(H * k)}|${lk.id}|${p.guard ? 'g' : ''}${p.armour ? 1 : 0}|${p.dents}|${p.cracks.length}|${p.cut ? 1 : 0}|${Math.ceil(p.hp / TUNING.part.hp * 4)}`;
  if (p.spr && p.spr.key === key) return p.spr;
  // a pair's foe is painted at two sizes (waiting at the edge and fighting), so the last two sprites are kept
  if (p.spr2 && p.spr2.key === key) { [p.spr, p.spr2] = [p.spr2, p.spr]; return p.spr; }
  p.spr2 = p.spr;
  const m = p.guard ? 0.05 : 0.03, b = p.slot ? [d.x - d.w / 2 - m, d.y - d.h / 2 - m, d.x + d.w / 2 + m, d.y + d.h / 2 + m] : BOX[d.id];
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

// The joint slots riding on their limbs: all the sprites first, then the live light over them (the open window's gold, the gap your feint opened, or a
// glint when your tip is near).
function drawSlots(ctx, E, F, H, fm, lk, live = true) {
  const slots = fm.parts.filter((q) => q.slot);
  for (const p of slots) drawPart(ctx, E, p, H, lk, p.d.frame ? fm.fr[p.d.frame] : null);
  if (live) for (const p of slots) if (!p.guard) slotLight(ctx, F, p, H, fm);
}
function slotLight(ctx, F, p, H, fm) {
  const d = p.d, fr = d.frame ? fm.fr[d.frame] : null;
  ctx.save();
  if (fr) { ctx.translate(fr.ox * H, fr.oy * H); ctx.rotate(fr.rot); }
  path(ctx, d, H);
  if ((state.winded > 0 || state.openAll > 0 || openNow(p)) && fm === state.foe && p.flash <= 0) {
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

// ----- the fighters on screen: his health bar, limbs, held kit and weapons, the whole body, your sword arm and shield -----
// The right HUD's rows below the hearts (px from the top): Momentum pips, stamina, the shield
const HUD_ROW = { pips: 35, sta: 46, shield: 66 };
// the rows with a second row of hearts (more than hud.perRow of them) pushing each down
const hudRow = () => {
  const d = state.maxHp > TUNING.hud.perRow ? TUNING.hud.rowGap : 0;
  return { pips: HUD_ROW.pips + d, sta: HUD_ROW.sta + d, shield: HUD_ROW.shield + d };
};
// Heart i of your health, drawn on the right of the HUD: a row of up to hud.perRow, the rest on a second row under the first (px)
function heartAt(E, i) {
  const H = TUNING.hud, cols = Math.min(state.maxHp, H.perRow), c = i % H.perRow;
  return [E.w - 16 - E.safe.right - 10 - (cols - 1 - c) * H.heart, 10 + E.safe.top + 14 + Math.floor(i / H.perRow) * H.rowGap];
}
function drawHeart(ctx, x, y, s, col) {
  const u = s / 2;
  ctx.beginPath(); ctx.moveTo(x, y + 0.95 * u);
  ctx.bezierCurveTo(x - 1.35 * u, y - 0.05 * u, x - 0.85 * u, y - 1.05 * u, x, y - 0.4 * u);
  ctx.bezierCurveTo(x + 0.85 * u, y - 1.05 * u, x + 1.35 * u, y - 0.05 * u, x, y + 0.95 * u);
  ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = 'rgba(20,8,8,0.7)'; ctx.lineWidth = 1.2; ctx.stroke();
}
// Momentum: five pips under your hearts, gold when held, the next pip's gain flashing
function drawPips(ctx, E, bx, bw, y) {
  const M = TUNING.mom, n = M.max, s = 5, gap = (bw - 2 * s) / (n - 1);
  for (let i = 0; i < n; i++) {
    const x = bx + s + i * gap, on = i < state.mom, fresh = on && i === state.mom - 1 && state.momT > 0;
    ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath();
    ctx.fillStyle = on ? (fresh ? '#ffffff' : '#ffd24a') : 'rgba(0,0,0,0.45)'; ctx.fill();
    ctx.strokeStyle = on ? '#fff0b8' : 'rgba(255,210,74,0.45)'; ctx.lineWidth = 1.2; ctx.stroke();
  }
  const armed = ['exec', 'whirl', 'falseop'].find((id) => state.armed[id]), fc = finReady();
  if (!armed && !fc) return;
  // 14 px, clear of the foe's slot: a long name falls back to its short form
  const room = bx - 6 - (hudSlot(E).x1 + 4);
  ctx.font = '800 14px system-ui, sans-serif';
  let t = armed ? `${CARD[armed].name.toUpperCase()} ARMED` : 'finisher ready';
  if (ctx.measureText(t).width > room) t = armed ? 'ARMED' : 'ready';
  E.text(t, bx - 6, y, { size: 14, align: 'right', color: '#f5d0fe', weight: '800' });
}
// The HUD's middle: between BOUT on the left and your hearts, stamina and shield on the right, so his bar never meets their labels.
function hudSlot(E) {
  const top = 10 + E.safe.top, l = 16 + E.safe.left, r = 16 + E.safe.right, H = TUNING.hud;
  const x0 = l + 112, x1 = Math.min(E.w - r - 110 - 96, E.w - r - 10 - (Math.min(state.maxHp, H.perRow) - 1) * H.heart - H.size / 2) - 10;
  return { top, x0, x1, cx: (x0 + x1) / 2, w: x1 - x0 };
}
// His name, health and stamina bars in the HUD slot, and under them his flag: OPEN! while winded, your riposte, or his short opening after a move.
// Drawn over the fighters, so the sword never hides it.
function foeHealth(ctx, E) {
  const L = lay(E), f = state.foe, S = hudSlot(E), w = Math.min(0.46 * L.H, S.w - 10), h = 10, x = S.cx - w / 2, y = S.top + 14;
  const k = clamp(f.hp / f.maxHp, 0, 1), ks = clamp(f.shown / f.maxHp, 0, 1), sk = clamp(f.sta / f.staMax, 0, 1);
  // his name only (his size and weapon are on his intro card); a long name (a champion's title) drops its title when the line would pass the slot at 14 px
  let nm = f.name.toUpperCase();
  ctx.font = '800 14px system-ui, sans-serif';
  if (ctx.measureText(nm).width > S.w) nm = f.name.split(/[ ,]/)[0].toUpperCase();
  E.text(nm, S.cx, S.top + 3, { size: fitSize(ctx, nm, 12, S.w), color: f.champion ? '#ffd24a' : '#f0e6cc', weight: '800' });
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - 2, y - 2, w + 4, h + 11);
  ctx.fillStyle = '#f2d88a'; ctx.fillRect(x, y, w * ks, h);
  ctx.fillStyle = k < 0.3 ? '#ef4444' : '#d9483a'; ctx.fillRect(x, y, w * k, h);
  const wd = state.winded > 0, on = Math.floor(state.m * 8) % 2 === 0;
  ctx.fillStyle = wd ? (on ? '#ffd24a' : '#7c5a10') : sk < 0.25 ? '#f59e0b' : '#7dd3fc';
  ctx.fillRect(x, y + h + 2, wd ? w * clamp(1 - state.winded / state.windedMax, 0.04, 1) : w * sk, 5);
  state.bleed.forEach((t, i) => drop(ctx, x + w + 12 + i * 12, y + 8, 5, clamp((t - state.m) / 1, 0.35, 1)));
  Object.keys(LIMB).filter(lamed).forEach((id, i) => lameIcon(ctx, id, x - 14 - i * 21, y + 8));
  if (state.fallT > 0) return;
  const t = wd ? (firstRun(E) ? 'OPEN!  out of breath: stab the glowing gaps' : 'OPEN!') : state.openAll > 0 ? 'ALL GAPS OPEN' : state.disarm > 0 ? 'DISARMED: fists only' : state.riposte > 0 ? 'RIPOSTE x2' : state.open > 0 && !state.sw ? 'OPEN' : null;
  if (!t) return;
  const size = fitSize(ctx, t, 15, S.w - 16), tw = ctx.measureText(t).width * size / 15, fy = y + h + 22, pulse = 0.5 + 0.5 * Math.sin(state.m * 10);
  E.roundRect(S.cx - tw / 2 - 8, fy - 11, tw + 16, 22, 8, 'rgba(20,14,8,0.85)', wd ? `rgba(255,210,74,${0.5 + 0.5 * pulse})` : null);
  E.text(t, S.cx, fy, { size, weight: '800', color: '#ffd24a' });
}

// The crowd meter under BOUT: a bar marked in thirds (the Emperor's thumb reads them) with the word CROWD written on it, gold at the top third,
// flashing as it fills. It fills the HUD's left strip, which ends where the foe's slot (and his flag) begins.
function drawCrowdMeter(ctx, E, x, y) {
  const C = TUNING.crowd, k = clamp(state.favShown / C.max, 0, 1), band = bandOf(state.favShown), bw = (hudSlot(E).x0 - 12 - x) * TUNING.hud.crowdW, bh = TUNING.hud.crowdH, by = y - bh / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - 1, by - 1, bw + 2, bh + 2);
  ctx.fillStyle = band === 2 ? '#ffd24a' : band === 1 ? '#f59e0b' : '#b45309'; ctx.fillRect(x, by, bw * k, bh);
  if (state.favT > 0) { ctx.fillStyle = `rgba(255,255,255,${state.favT})`; ctx.fillRect(x, by, bw * k, bh); }
  ctx.font = '800 14px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(20,12,4,0.9)'; ctx.strokeText('CROWD', x + 6, y + 1);
  ctx.fillStyle = '#fff6dc'; ctx.fillText('CROWD', x + 6, y + 1);
  ctx.fillStyle = 'rgba(240,230,204,0.85)';
  for (const t of C.bands) { ctx.fillRect(x + bw * t - 1, by, 2, 5); ctx.fillRect(x + bw * t - 1, by + bh - 5, 2, 5); }
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(240,230,204,0.5)'; ctx.strokeRect(x - 0.5, by - 0.5, bw + 1, bh + 1);
}
function drawCoin(ctx, x, y, r) {
  ctx.fillStyle = '#fbbf24'; ctx.strokeStyle = '#8a5a12'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 6.28); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, 6.28); ctx.fill();
}
// The waiting foe stands still, so he is painted once into his own sprite (again when his size on screen or his wounds change) and drawn dimmed each
// frame; without OffscreenCanvas he is drawn live.
// The waiting foe's sprite for the foe f, repainted when his size on screen or his wounds change (a number, so the check allocates nothing).
// its box: a man's 0.9 H wide about his feet, a beast's from its nose to its tail (left: from its box's left edge to its feet)
const edgeBox = (f, H) => { const B = beastOf(f); return B ? [(B.front + B.back + 0.14) * H, (B.front + 0.05) * H] : [0.9 * H, 0.45 * H]; };
function edgeSprite(E, f) {
  const F = edgeF(E, f), k = Math.min(E.dpr || 1, TUNING.skin.maxDpr), [w, left] = edgeBox(f, F.H), h = 1.25 * F.H, feet = 1.12 * F.H;
  let key = Math.round(F.H * k);
  for (const p of f.parts) key = (key * 31 + (p.cut ? 1 : 0) + 2 * p.dents + 64 * p.cracks.length) % 2147483647;
  if (kitOn()) key = `${key}|${f.beast ? `${f.beast}${f.young ? 'y' : ''}|${artV}` : lookFor(f, true).id}`;
  if (!f.spr || f.spr.key !== key) {
    const cv = new OffscreenCanvas(Math.ceil(w * k), Math.ceil(h * k)), c = cv.getContext('2d');
    // painting poses him as he waits, so the one fighting keeps his own pose and frames
    const fr = f.fr, lg = f.lg, pc = f.parts.map((p) => [p.cx, p.cy]);
    poseEdge(f); c.scale(k, k); c.translate(left - F.x, feet - F.y);
    drawFighter(c, E, { ...F, a: 0 }, f, 'edge');
    f.fr = fr; f.parts.forEach((p, i) => { p.cx = pc[i][0]; p.cy = pc[i][1]; });
    if (f.beast) f.lg = lg;
    f.spr = { key, cv };
  }
  return f.spr.cv;
}
// The waiting foe stands still, so he is painted once into his own sprite and drawn dimmed each frame; without OffscreenCanvas he is drawn live.
function drawEdge(ctx, E) {
  const f = state.edge, F = edgeF(E), A = TUNING.pairs.alpha;
  if (!canSprite) { poseEdge(f); drawFighter(ctx, E, F, f, 'edge', A); return; }
  const k = Math.min(E.dpr || 1, TUNING.skin.maxDpr), left = edgeBox(f, F.H)[1], feet = 1.12 * F.H, img = edgeSprite(E, f);
  // drawn upright at whole device pixels and the sprite's own size, the cheapest copy there is
  const X = Math.round((F.x - left) * k) / k, Y = Math.round((F.y - feet) * k) / k;
  ctx.save(); ctx.globalAlpha = A; ctx.drawImage(img, X, Y, img.width / k, img.height / k); ctx.restore();
}
// During the intro card both foes' sprites are painted for the swap: the one fighting as he will wait, the one waiting as he will fight.
function warmPair(E) {
  const e = state.edge;
  if (!canSprite || !e || state.warm) return;
  state.warm = true;
  edgeSprite(E, state.foe); edgeSprite(E, e);
  if (e.beast) return;
  const H = lay(E).H * e.size.scale, lk = lookFor(e, true);
  for (const p of e.parts) spriteOf(E, p, H, lk);
}
// The waiting foe's name and health over his head, and his taunt, the tell that he is about to step in: a bubble above them
function drawEdgeTag(ctx, E) {
  const f = state.edge, F = edgeF(E), [hx, hy] = f.beast ? toScreen(F, 0.12, -0.62) : toScreen(F, 0.03, -1.0), r = E.w - 10 - E.safe.right, bw = Math.min(90, 0.5 * F.H), bx = Math.min(hx - bw / 2, r - bw);
  // clear of the right HUD's rows (hearts to the shield bar)
  const hud = 10 + E.safe.top + hudRow().shield + 8, ny = Math.max(hy - 18, hud + 12), nm = f.name.split(/[ ,]/)[0].toUpperCase();
  ctx.font = '800 14px system-ui, sans-serif';
  E.text(nm, Math.min(hx, r - ctx.measureText(nm).width / 2), ny, { size: 14, weight: '800', color: '#f0e6cc', alpha: 0.85 });
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx - 1, ny + 9, bw + 2, 7);
  ctx.fillStyle = '#d9483a'; ctx.fillRect(bx, ny + 10, bw * clamp(f.hp / f.maxHp, 0, 1), 5);
  if (state.tauntT <= 0) return;
  // his taunt above his name and head, at the screen's edge, its tail pointing down at him: clear of both faces and of the right HUD's rows
  const t = state.taunt, tw = ctx.measureText(t).width + 20, th = 28, tx = r - tw, ty = Math.max(ny - 20 - th / 2, hud + th / 2), pulse = 1 + 0.06 * Math.sin(state.m * 30);
  ctx.save(); ctx.translate(tx + tw / 2, ty); ctx.scale(pulse, pulse);
  E.roundRect(-tw / 2, -th / 2, tw, th, 12, '#f0e6cc', '#7f1d1d');
  const ax = clamp(hx - (tx + tw / 2), -tw / 2 + 14, tw / 2 - 14);
  ctx.fillStyle = '#f0e6cc'; ctx.beginPath(); ctx.moveTo(ax - 7, th / 2 - 1); ctx.lineTo(ax, th / 2 + 9); ctx.lineTo(ax + 7, th / 2 - 1); ctx.closePath(); ctx.fill();
  E.text(t, 0, 1, { size: 14, weight: '800', color: '#7f1d1d' });
  ctx.restore();
}

// a blood drop of radius s, point up, centred at (x, y)
function drop(ctx, x, y, s, a = 1) {
  ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = '#ef4444'; ctx.strokeStyle = '#7f1d1d'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y - 1.8 * s); ctx.bezierCurveTo(x + 0.4 * s, y - s, x + s, y - 0.4 * s, x + s, y + 0.2 * s); ctx.arc(x, y + 0.2 * s, s, 0, Math.PI); ctx.bezierCurveTo(x - s, y - 0.4 * s, x - 0.4 * s, y - s, x, y - 1.8 * s); ctx.fill(); ctx.stroke(); ctx.restore();
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
// Bait's painted spiral on a shield's face of radius r, about the current origin
function spiral(ctx, r, col) {
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, r * 0.08); ctx.lineCap = 'round'; ctx.beginPath();
  for (let k = 0; k <= 40; k++) { const a = k * 0.42, rr = r * (0.12 + k * 0.017); if (k) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.moveTo(rr, 0); }
  ctx.stroke();
}
// his shield, with his shield piece: Thorns' spikes round the rim, Iron Wall's tower shield (a scutum, far bigger), or Bait's spiral
// With the kit his type's painted shield (Iron Wall's tower: the scutum, bigger) is drawn at the drawn one's size; dk: the sprites' pixel ratio.
function drawFoeShield(ctx, H, k, lk, dk = 1) {
  const g = lk.gear && lk.gear.shield, tower = g && g.id === 'ironwall', kind = lk.kit ? (tower ? 'scutum' : lk.kit.shield) : null;
  const SC = TUNING.foeShield, px = (kind === 'scutum' ? SC.h : SC.r * 2) * H * k * dk * (tower ? SC.tower[1] : 1), im = kind && shieldPic(kind, px), parma = im ? kind !== 'scutum' : lk.helm === 'hoplo' && !tower;
  // the shield piece painted (step 6c-2): the tower's face is the tall shield, a round face the round shield's or an emblem on a tall one
  const fc = im && gearArt(lk, 'shield', px), emb = fc && !fc.J.h && kind === 'scutum';
  ctx.save();
  if (tower) ctx.scale(SC.tower[0], SC.tower[1]);
  if (!fc && g && g.id === 'thorns') {
    const n = 10, w = 0.17 * H * k, h = 0.32 * H * k, r = 0.1 * H * k;
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n, ex = parma ? Math.cos(a) * r : clamp(Math.cos(a) * w, -w / 2, w / 2), ey = parma ? Math.sin(a) * r : clamp(Math.sin(a) * h, -h / 2, h / 2);
      spike(ctx, ex * 0.95, ey * 0.95, a, 0.035 * H * k, 0.02 * H * k, BRONZE, true);
    }
  }
  const pic = (P, s) => { const w = P.J.size[0] * s, h = P.J.size[1] * s; ctx.drawImage(P.im, -w / 2, -h / 2, w, h); };
  if (im) {
    const S = fc && !emb ? fc : im;
    pic(S, (S.J.h ? SC.h / S.J.h : SC.r / S.J.r) * H * k);
    if (emb) pic(fc, im.J.size[0] / 2 * (SC.h / im.J.h) * TUNING.kit.emblem / fc.J.r * H * k);
  } else (parma ? drawParma : drawScutum)(ctx, H, k);
  if (!fc && g && g.id === 'bait') spiral(ctx, (parma ? 0.1 : 0.085) * H * k, FAM_LOOK.trick.hi);
  if (g) gearGlint(ctx, 0.03 * H * k, -0.06 * H * k, 0.03 * H, g, 0.6);
  ctx.restore();
}
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
// Step 6c-2: the painted net draped over a netted fighter (yours over him, the Huntress's over you), drawn in his frame as he is drawn (a beast's
// in its body's), so it leans, sways and rears with him, under his gaps and their light; k grows it in from the crown as it lands
const netArt = () => kitOn() && !!artImg('kit-net-draped');
const netK = (t) => clamp(t / TUNING.kit.net.grow[0], TUNING.kit.net.grow[1], 1);
function drapeNet(ctx, E, H, fm, k) {
  const N = TUNING.kit.net, B = N[fm.beast || 'man'], P = artPic('kit-net-draped', N, B[4] * H * Math.min(E.dpr || 1, TUNING.skin.maxDpr));
  if (!P) return;
  const fr = fm.beast && fm.fr && fm.fr.body, top = [B[0] * H, B[1] * H];
  ctx.save();
  if (fr) { ctx.translate(fr.ox * H, fr.oy * H); ctx.rotate(fr.rot); }
  drawSeg(ctx, P, top, lerp2(top, [B[2] * H, B[3] * H], k), B[4] * H * k);
  ctx.restore();
}
// The foe's weapon in his arm's frame: the fist at (0, ARM_LEN), the weapon along +y; frame -x is the edge that leads a chop.
function drawWeapon(ctx, f, H) {
  const W = f.weapon, y0 = ARM_LEN * H, len = W.len * H;
  ctx.strokeStyle = '#1b1610'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
  const leaf = (y1, y2, w) => { ctx.beginPath(); ctx.moveTo(-w * 0.8, y1); ctx.lineTo(-w, y1 + (y2 - y1) * 0.3); ctx.lineTo(-w * 0.6, y1 + (y2 - y1) * 0.75); ctx.lineTo(0, y2); ctx.lineTo(w * 0.6, y1 + (y2 - y1) * 0.75); ctx.lineTo(w, y1 + (y2 - y1) * 0.3); ctx.lineTo(w * 0.8, y1); ctx.closePath(); ctx.fillStyle = '#d5dce4'; ctx.fill(); ctx.stroke(); };
  const pole = (a, b, w) => { ctx.fillStyle = '#7a5532'; ctx.fillRect(-w / 2, a, w, b - a); ctx.strokeRect(-w / 2, a, w, b - a); };
  if (W.id === 'spear') { pole(y0 - 0.3 * H, y0 + len, 0.02 * H); leaf(y0 + len, y0 + len + 0.12 * H, 0.026 * H); }
  else if (W.id === 'trident') {
    // the shaft, a crossbar and three barbed prongs
    pole(y0 - 0.3 * H, y0 + len, 0.02 * H);
    ctx.fillStyle = '#c3cbd3'; ctx.fillRect(-0.045 * H, y0 + len - 0.01 * H, 0.09 * H, 0.02 * H); ctx.strokeRect(-0.045 * H, y0 + len - 0.01 * H, 0.09 * H, 0.02 * H);
    for (const k of [-0.035, 0, 0.035]) { ctx.beginPath(); ctx.moveTo(k * H - 0.006 * H, y0 + len); ctx.lineTo(k * H, y0 + len + (k ? 0.1 : 0.13) * H); ctx.lineTo(k * H + 0.006 * H, y0 + len); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  } else if (W.id === 'sica') {
    // a short grip and a blade that bows forward like a crescent
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(-0.012 * H, y0 - 0.05 * H, 0.024 * H, 0.08 * H);
    ctx.beginPath(); ctx.moveTo(-0.014 * H, y0 + 0.03 * H); ctx.quadraticCurveTo(0.07 * H, y0 + 0.03 * H + len * 0.5, -0.01 * H, y0 + 0.03 * H + len);
    ctx.quadraticCurveTo(0.03 * H, y0 + 0.03 * H + len * 0.5, 0.014 * H, y0 + 0.03 * H); ctx.closePath(); ctx.fillStyle = '#d5dce4'; ctx.fill(); ctx.stroke();
  } else if (W.id === 'axe') {
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
  const g = f.look && f.look.gear.weapon;
  if (!g) return;
  if (W.id === 'spear') weaponGear(ctx, g, [0, y0 + len], [0, y0 + len + 0.12 * H], 0.026 * H, [0, y0 - 0.3 * H], H);
  else if (W.id === 'axe') weaponGear(ctx, g, [0, y0 + len - 0.16 * H], [0, y0 + len], 0.016 * H, [0, y0 - 0.06 * H], H);
  else weaponGear(ctx, g, [0, y0 + 0.04 * H], [0, y0 + 0.04 * H + len], W.id === 'dagger' ? 0.018 * H : 0.026 * H, [0, y0 - 0.055 * H], H);
}
// A weapon piece along the weapon's working part, from a to b (px), hw its half-width there, butt the end of the grip: the saw teeth, the sica's hook
// (and its red grip), the spiked iron pommel, the blackened blade, the gilded one with its ribbon.
function weaponGear(ctx, g, a, b, hw, butt, H) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, nx = -uy, ny = ux, s = 0.014 * H;
  if (g.id === 'serrated') {
    for (let i = 0; i < 7; i++) for (const sd of [1, -1]) { const t = 0.12 + i * 0.11, px = a[0] + dx * t + nx * hw * sd * 0.85, py = a[1] + dy * t + ny * hw * sd * 0.85; spike(ctx, px, py, Math.atan2(ny * sd + uy * 0.7, nx * sd + ux * 0.7), s * 0.9, s * 0.8, IRON, true); }
  } else if (g.id === 'haem') {
    const hook = () => { ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.quadraticCurveTo(b[0] + ux * 0.025 * H - nx * 0.05 * H, b[1] + uy * 0.025 * H - ny * 0.05 * H, b[0] - ux * 0.045 * H - nx * 0.055 * H, b[1] - uy * 0.045 * H - ny * 0.055 * H); };
    ctx.lineCap = 'round'; hook(); ctx.strokeStyle = '#1b2026'; ctx.lineWidth = s + 3; ctx.stroke(); hook(); ctx.strokeStyle = '#cfd6de'; ctx.lineWidth = s; ctx.stroke();
    ctx.strokeStyle = '#7f1d1d'; ctx.lineWidth = s * 0.9;
    for (const k of [0.02, 0.045]) { const cx = butt[0] + (a[0] - butt[0]) * 0.5 + ux * k * H * 0.3, cy = butt[1] + (a[1] - butt[1]) * 0.5 + uy * k * H * 0.3; line(ctx, cx + nx * hw, cy + ny * hw, cx - nx * hw, cy - ny * hw); }
  } else if (g.id === 'heavy') {
    for (let i = 0; i < 4; i++) { const an = Math.atan2(-uy, -ux) + (i - 1.5) * 0.9; spike(ctx, butt[0], butt[1], an, 0.034 * H, 0.014 * H, BLACK, true); }
    disc(ctx, butt[0], butt[1], 0.022 * H, BLACK);
  } else if (g.id === 'misdir') {
    // the blade blackened, a violet line along its edge
    ctx.fillStyle = 'rgba(20,16,26,0.72)'; ctx.beginPath(); ctx.moveTo(a[0] + nx * hw * 0.8, a[1] + ny * hw * 0.8); ctx.lineTo(b[0] - ux * hw, b[1] - uy * hw); ctx.lineTo(a[0] - nx * hw * 0.8, a[1] - ny * hw * 0.8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = FAM_LOOK.trick.hi; ctx.lineWidth = 1.5; line(ctx, a[0] + nx * hw * 0.85, a[1] + ny * hw * 0.85, b[0], b[1]);
  } else if (g.id === 'flourish') {
    // a gilt wrap up the blade and a pink ribbon streaming from the pommel
    ctx.strokeStyle = GOLD.lite; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { const t = 0.08 + i * 0.1, px = a[0] + dx * t, py = a[1] + dy * t; line(ctx, px + nx * hw, py + ny * hw, px - nx * hw + ux * s, py - ny * hw + uy * s); }
    ribbon(ctx, [butt, [butt[0] - ux * 0.05 * H + nx * 0.03 * H, butt[1] - uy * 0.05 * H + ny * 0.03 * H], [butt[0] - ux * 0.1 * H - nx * 0.01 * H, butt[1] - uy * 0.1 * H - ny * 0.01 * H]], 0.012 * H, FAM_LOOK.show.hi);
  }
  gearGlint(ctx, b[0] - ux * 0.04 * H, b[1] - uy * 0.04 * H, 0.03 * H, g, 0.45);
}

// who: 'you' or 'foe'. The foe also draws his weapon arm and club; yours is drawn in screen space by drawSwordArm. ga: overall alpha (Blur's ghost).
// a disarm: his weapon spins up and away over his shoulder
function flyingWeapon(ctx, E) {
  const Ff = foeF(E), u = 1 - state.flyW / 0.9;
  ctx.save(); ctx.translate(Ff.x + u * 0.5 * Ff.H, Ff.y - (0.7 + 1.4 * u - 1.3 * u * u) * Ff.H); ctx.rotate(u * 14); ctx.globalAlpha = clamp(state.flyW / 0.3, 0, 1);
  ctx.translate(0, -(ARM_LEN + state.foe.weapon.len / 2) * Ff.H); drawWeapon(ctx, state.foe, Ff.H); ctx.restore();
}
// a red cross on each lamed limb, in its own frame
function markLamed(ctx, fm, H) {
  for (const p of fm.parts) {
    if (p.slot || !p.cut || !LIMB[p.d.id]) continue;
    const fr = fm.fr[p.d.id], d = p.d, s = 0.045 * H, y = (d.id === 'legs' ? -0.24 : d.y) * H;
    ctx.save(); if (fr) { ctx.translate(fr.ox * H, fr.oy * H); ctx.rotate(fr.rot); }
    ctx.lineCap = 'round'; ctx.strokeStyle = '#7f1d1d'; ctx.lineWidth = Math.max(4, 0.026 * H);
    line(ctx, d.x * H - s, y - s, d.x * H + s, y + s); line(ctx, d.x * H + s, y - s, d.x * H - s, y + s);
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = Math.max(2, 0.013 * H);
    line(ctx, d.x * H - s, y - s, d.x * H + s, y + s); line(ctx, d.x * H + s, y - s, d.x * H - s, y + s);
    ctx.restore();
  }
}
// his lamed limbs on his HUD slot: a small red sword, shield or leg
function lameIcon(ctx, id, x, y) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(60,8,8,0.85)'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#ef4444'; ctx.fillStyle = '#ef4444'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.stroke();
  if (id === 'armF') { line(ctx, -4, 4, 4, -4); line(ctx, -4, 0, 0, 4); }
  else if (id === 'legF') { line(ctx, 1, -5, 0, 4); line(ctx, 0, 4, -4, 4); }
  else if (id === 'armB') { ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(4, -4); ctx.lineTo(3.5, 1); ctx.lineTo(0, 5); ctx.lineTo(-3.5, 1); ctx.closePath(); ctx.fill(); }
  else { line(ctx, -1, -5, -2, 4); line(ctx, -2, 4, 2, 4); line(ctx, 2, -5, 2, 1); }
  ctx.restore();
}
// who: 'you', 'foe' (the one fighting, with every live state drawn on him) or 'edge' (a pair's foe waiting: his look and kit only)
function drawFighter(ctx, E, F, fm, who, ga = 1) {
  if (fm.beast) { drawBeast(ctx, E, F, fm, who, ga); return; }
  const H = F.H, L = lay(E), isFoe = who !== 'you', live = who === 'foe', lk = lookFor(fm, isFoe);
  const P = (id) => fm.parts.find((q) => q.d.id === id);
  const fall = live && state.fallT > 0 ? Math.pow(clamp(state.fallT / 0.5, 0, 1), 2) : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(F.x, L.floor + 3, H * 0.22, H * 0.035, 0, 0, 6.28); ctx.fill();
  ctx.save();
  ctx.translate(F.x, F.y); ctx.scale(F.dir, 1); ctx.rotate(F.a);
  if (live && (state.stagger > 0 || state.winded > 0)) {
    const k = state.winded > 0 ? 0.35 + 0.25 * Math.sin(state.m * 9) : 0.45;
    const g = ctx.createRadialGradient(0, -0.5 * H, 10, 0, -0.5 * H, 0.6 * H);
    g.addColorStop(0, `rgba(255,210,74,${k})`); g.addColorStop(1, 'rgba(255,210,74,0)');
    ctx.fillStyle = g; ctx.fillRect(-0.7 * H, -1.1 * H, 1.4 * H, 1.3 * H);
  }
  const sc = live && state.pop < 1 ? 0.85 + 0.15 * (1 - state.pop) : 1;
  ctx.scale(sc, sc);
  ctx.globalAlpha = ga * (live && state.pop < 1 ? 1 - state.pop * 0.7 : 1);
  if (fall > 0) ctx.globalAlpha = 1 - fall * 0.5;
  // far arm and its shield, legs, tunic and belly, chest, head
  const sw = live ? state.sw : null, bashing = sw && sw.pose === 'bash';
  if (lk.gear && (lk.gear.cloak || (lk.tailor && lk.tailor.cloak))) { if (!fm.cloak) fm.cloak = mkPart(CLOAK, false); drawPart(ctx, E, fm.cloak, H, lk, null); }
  drawPart(ctx, E, P('armB'), H, lk, fm.fr.armB);
  if (isFoe && fm.shield && !bashing) offHand(ctx, fm.fr.armB, H, () => drawFoeShield(ctx, H, 0.75, lk, Math.min(E.dpr || 1, TUNING.skin.maxDpr)));
  drawPart(ctx, E, P('legs'), H, lk, null);
  drawPart(ctx, E, P('belly'), H, lk, null);
  if (lk.net && !(sw && sw.pose === 'net' && sw.fin <= 0)) drawBeltNet(ctx, H);
  drawPart(ctx, E, P('chest'), H, lk, null);
  drawPart(ctx, E, P('head'), H, lk, null);
  if (lk.gear) drawGlints(ctx, fm, H, lk);
  // the foe's weapon arm and club
  if (isFoe) {
    const fr = fm.fr.armF;
    drawPart(ctx, E, P('armF'), H, lk, fr);
    ctx.save(); ctx.translate(fr.ox * H, fr.oy * H); ctx.rotate(fr.rot);
    if (live && hesitating()) {
      ctx.save(); ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 24; ctx.strokeStyle = `rgba(167,139,250,${0.5 + 0.4 * Math.sin(state.m * 60)})`; ctx.lineWidth = 0.07 * H; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, ARM_LEN * H); ctx.lineTo(0, (ARM_LEN + fm.weapon.len) * H); ctx.stroke(); ctx.restore();
    }
    if (sw && sw.pose === 'net' && sw.fin <= 0) drawNet(ctx, 0, (ARM_LEN + 0.05) * H, 0.1 * H); else if (!live || state.disarm <= 0) drawWeapon(ctx, fm, H);
    ctx.restore();
    if (live && sw && sw.puppet && sw.fin <= 0) puppetStrings(ctx, fm, H);
    if (live && state.foeNet > 0 && state.fallT <= 0 && netArt()) drapeNet(ctx, E, H, fm, netK(state.foeNet));
    drawSlots(ctx, E, F, H, fm, lk, live);
    if (fm.shield && bashing) { ctx.save(); ctx.translate((0.2 + 0.1 * (sw.fin > 0 ? 1 : clamp(sw.t / sw.wind, 0, 1))) * H, -0.52 * H); drawFoeShield(ctx, H, 1, lk, Math.min(E.dpr || 1, TUNING.skin.maxDpr)); ctx.restore(); }
    markLamed(ctx, fm, H);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  if (live && state.stun > 0) {
    const [sx, sy] = toScreen(F, 0.03, -1.0);
    for (let i = 0; i < 3; i++) {
      const a = state.m * 7 + i * 2.09;
      E.text('*', sx + Math.cos(a) * 0.12 * H, sy + Math.sin(a) * 0.035 * H, { size: 26, color: '#fde68a', weight: '800' });
    }
  }
}

// Puppeteer: while his marked feint winds up, violet strings come down from above to his head, his shoulder and his sword hand
function puppetStrings(ctx, fm, H) {
  const fr = fm.fr.armF, hand = [fr.ox - Math.sin(fr.rot) * ARM_LEN, fr.oy + Math.cos(fr.rot) * ARM_LEN];
  ctx.save(); ctx.strokeStyle = `rgba(196,181,253,${0.55 + 0.35 * Math.sin(state.m * 12)})`; ctx.lineWidth = Math.max(1.5, 0.006 * H);
  for (const [x, y] of [[0.03, -0.88], [SHOULDER[0], SHOULDER[1]], hand]) line(ctx, x * H, -1.7 * H, x * H, y * H);
  ctx.restore();
}
// Your sword arm's arms piece near the wrist (a bracer, barbs or ribbons) and its war paint on the upper arm, drawn with the arm each frame; with the
// kit (aw: its width, px: its live copy's) the painted piece rides the forearm, or the shoulder for the pauldrons, mirrored with that half
function liveArmGear(ctx, h, H, lk, aw = 0, px = 0) {
  const S = [h.sx, h.sy], El = [h.ex, h.ey], Hd = [h.hx, h.hy], g = lk.gear.arms, G = aw && gearArt(lk, 'arms', px);
  const across = (a, b, t, half, col, wd) => { const q = lerp2(a, b, t), dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * half, ny = dx / l * half; ctx.strokeStyle = col; ctx.lineWidth = wd; line(ctx, q[0] + nx, q[1] + ny, q[0] - nx, q[1] - ny); };
  ctx.lineCap = 'butt';
  if (G) {
    const [y0, y1] = G.J.at, A = G.J.up ? [h.sx, h.sy + y0 * H] : armAt(S, El, Hd, y0), B = G.J.up ? [h.sx, h.sy + y1 * H] : armAt(S, El, Hd, y1);
    wearSeg(ctx, G, A, B, aw, false, !G.J.up && !!(y1 <= ARM_LEN / 2 ? h.flipU : h.flipF));
    gearGlint(ctx, B[0], B[1], 0.03 * H, g, 0.8);
  } else if (g && g.id !== 'jugg') {
    const L = FAM_LOOK[g.fam], a = lerp2(El, Hd, 0.55), b = lerp2(El, Hd, 0.85);
    if (g.id === 'matador') for (const t of [0.55, 0.68, 0.81]) across(El, Hd, t, 0.045 * H, L.hi, 0.02 * H);
    else if (g.id === 'playcrowd') { for (const t of [0.62, 0.8]) across(El, Hd, t, 0.047 * H, L.metal.lite, 0.024 * H); across(S, El, 0.55, 0.05 * H, L.metal.mid, 0.02 * H); }
    else {
      ctx.lineCap = 'round'; ctx.strokeStyle = '#1b1610'; ctx.lineWidth = 0.09 * H + 2; line(ctx, a[0], a[1], b[0], b[1]);
      ctx.strokeStyle = g.id === 'riposte' ? L.metal.mid : L.cloth; ctx.lineWidth = 0.09 * H; line(ctx, a[0], a[1], b[0], b[1]);
      ctx.strokeStyle = g.id === 'riposte' ? L.metal.hi : 'rgba(255,190,170,0.4)'; ctx.lineWidth = 0.015 * H; line(ctx, a[0], a[1] - 0.025 * H, b[0], b[1] - 0.025 * H);
      if (g.id === 'bluff') { const an = Math.atan2(a[1] - b[1], a[0] - b[0]); for (const t of [0.3, 0.75]) { const q = lerp2(a, b, t), o = an - Math.PI / 2; spike(ctx, q[0] + Math.cos(o) * 0.045 * H, q[1] + Math.sin(o) * 0.045 * H, an, 0.035 * H, 0.012 * H, STEEL, true); } }
      if (g.id === 'rend') for (const t of [0.3, 0.7]) { const q = lerp2(a, b, t), an = Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2; spike(ctx, q[0] + Math.cos(an) * 0.04 * H, q[1] + Math.sin(an) * 0.04 * H, an, 0.03 * H, 0.012 * H, IRON, true); }
    }
    gearGlint(ctx, b[0], b[1] - 0.03 * H, 0.03 * H, g, 0.8);
  }
  (lk.paint || []).forEach((id, i) => {
    const col = PAINT_COL[id], t0 = 0.3 + i * 0.12;
    if (id === 'exec') { across(S, El, t0, 0.032 * H, col, 0.012 * H); across(S, El, t0 + 0.07, 0.032 * H, col, 0.012 * H); }
    else if (id === 'whirl') { const q = lerp2(S, El, t0 + 0.05); ctx.strokeStyle = col; ctx.lineWidth = 0.008 * H; ctx.beginPath(); ctx.arc(q[0], q[1], 0.02 * H, 0, TAU * 0.85); ctx.stroke(); }
    else if (id === 'breath') { ctx.fillStyle = col; for (let k = 0; k < 3; k++) { const q = lerp2(S, El, t0 + k * 0.06); ctx.beginPath(); ctx.arc(q[0], q[1], 0.008 * H, 0, TAU); ctx.fill(); } }
    else if (id === 'falseop') { across(S, El, t0, 0.032 * H, col, 0.012 * H); across(S, El, t0 + 0.08, 0.02 * H, col, 0.01 * H); }
    else if (id === 'showstop') { ctx.fillStyle = col; for (let k = 0; k < 4; k++) { const q = lerp2(S, El, t0 + k * 0.05); ctx.beginPath(); ctx.ellipse(q[0], q[1], 0.012 * H, 0.006 * H, 0.6, 0, TAU); ctx.fill(); } }
    else if (id === 'disarm') { const dx = El[0] - S[0], dy = El[1] - S[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l; ctx.strokeStyle = col; ctx.lineWidth = 0.008 * H; ctx.beginPath(); for (let k = 0; k < 5; k++) { const q = lerp2(S, El, t0 + k * 0.04), o = (k % 2 ? 1 : -1) * 0.022 * H; ctx.lineTo(q[0] + nx * o, q[1] + ny * o); } ctx.stroke(); }
  });
}
// Your weapon arm, in screen space: a gladius or dagger as a leaf blade (broad, tapering to a point), a spear's shaft and head, an axe or a mace.
function drawSwordArm(ctx, E) {
  const h = state.hand, H = myH(E), locked = h.lock > 0, blade = myBlade(E), wid = state.me.weapon;
  const w = (wid === 'dagger' ? 0.026 : wid === 'sica' ? 0.03 : 0.034) * H, pole = wid === 'spear' || wid === 'axe' || wid === 'trident';
  const bx = h.bx, by = h.by, nx = -by, ny = bx;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (state.trail.length > 1 && h.sp >= TUNING.hit.minSpeed) {
    ctx.strokeStyle = 'rgba(125,227,255,0.35)'; ctx.lineWidth = 8; ctx.beginPath();
    state.trail.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
  }
  const lk = lookFor(state.you, false), G = lk.gear;
  // the kit: the painted upper arm now, the forearm and fist over the grip at the end (with the arm's gear on it)
  const aw = TUNING.kit.arm * H, kpx = aw * Math.min(E.dpr || 1, TUNING.skin.maxDpr), kU = lk.kit && kitPic('upperarm', lk.kit.tier, kpx), kF = lk.kit && kitPic('forearm', lk.kit.tier, kpx), kit = kU && kF;
  // The PNGs face right, their back (-x) to the rear. The arm bends wherever the finger leads, so each half is mirrored when it would face the wrong
  // way: the upper arm's back to the outside of the elbow, the fist's fingers toward the hilt (kept as they were when the arm is straight or the blade
  // runs along the forearm, so they never flicker).
  if (kit) {
    const lu = Math.hypot(h.ex - h.sx, h.ey - h.sy) || 1, lf = Math.hypot(h.hx - h.ex, h.hy - h.ey) || 1, F = TUNING.kit.flip;
    const u = (-(h.ey - h.sy) * (h.ex - (h.sx + h.hx) / 2) + (h.ex - h.sx) * (h.ey - (h.sy + h.hy) / 2)) / (lu * lu), f = (-(h.hy - h.ey) * bx + (h.hx - h.ex) * by) / lf;
    if (Math.abs(u) > F[0]) h.flipU = u < 0;
    if (Math.abs(f) > F[1]) h.flipF = f < 0;
    drawSeg(ctx, kU, [h.sx, h.sy], [h.ex, h.ey], aw, !!h.flipU);
  }
  else {
    limb(ctx, [[h.sx, h.sy], [h.ex, h.ey], [h.hx, h.hy]], 0.075 * H, YOU.skin);
    liveArmGear(ctx, h, H, lk);
    ctx.fillStyle = YOU.tunic; ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(h.sx, h.sy, 0.058 * H, 0, 6.28); ctx.fill(); ctx.stroke();
  }
  // (the painted pauldrons ride the arm with its other pieces, and the painted black plate needs no shoulder)
  if ((G.arms && G.arms.id === 'jugg' && !(kit && gearArt(lk, 'arms'))) || (G.chest && G.chest.id === 'titan' && !(kit && gearArt(lk, 'chest')))) {
    // Juggernaut's iron pauldrons, or Titan's black shoulder: layered black lames and a spike over the weapon shoulder
    for (let i = 2; i >= 0; i--) {
      const r = (0.075 - i * 0.012) * H, cy = h.sy - 0.012 * H + i * 0.024 * H;
      ctx.beginPath(); ctx.ellipse(h.sx, cy, r * 1.15, r * 0.7, 0, Math.PI, TAU); ctx.closePath();
      ctx.fillStyle = metalGrad(ctx, h.sx + r, cy - r, h.sx - r, cy, BLACK); ctx.fill(); ctx.strokeStyle = BLACK.edge; ctx.lineWidth = 1.5; ctx.stroke();
    }
    spike(ctx, h.sx, h.sy - 0.06 * H, -Math.PI / 2, 0.04 * H, 0.018 * H, BLACK, true);
  } else if (lk.pauldron) {
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
    } else if (wid === 'trident') {
      // a crossbar behind the tip and three prongs: the middle one ends at the tip
      const hl = 0.11 * H, cx0 = h.ux - bx * hl, cy0 = h.uy - by * hl, pw = 0.04 * H;
      ctx.strokeStyle = '#1b2026'; ctx.lineWidth = 0.016 * H + 2; line(ctx, cx0 - nx * pw, cy0 - ny * pw, cx0 + nx * pw, cy0 + ny * pw);
      for (const k of [-1, 0, 1]) { const ex = h.ux - bx * (k ? 0.025 * H : 0) + nx * pw * k, ey = h.uy - by * (k ? 0.025 * H : 0) + ny * pw * k; ctx.strokeStyle = '#1b2026'; ctx.lineWidth = 0.012 * H + 2; line(ctx, cx0 + nx * pw * k, cy0 + ny * pw * k, ex, ey); ctx.strokeStyle = steel; ctx.lineWidth = 0.012 * H; line(ctx, cx0 + nx * pw * k, cy0 + ny * pw * k, ex, ey); }
      ctx.strokeStyle = steel; ctx.lineWidth = 0.016 * H; line(ctx, cx0 - nx * pw, cy0 - ny * pw, cx0 + nx * pw, cy0 + ny * pw);
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
    // the sica's blade bows forward (its chord stays the straight blade the hits use); the others are a leaf
    if (wid === 'sica') { const bow = (t) => Math.sin(Math.PI * t) * 2.4; shape([P(0, -0.8), ...[0.25, 0.5, 0.75].map((t) => P(t, bow(t) - 0.9 * (1 - t))), P(1, 0), ...[0.75, 0.5, 0.25].map((t) => P(t, bow(t) + 0.9 * (1 - t))), P(0, 0.8)]); }
    else shape([P(0, -0.8), P(0.3, -1), P(0.72, -0.7), P(1, 0), P(0.72, 0.7), P(0.3, 1), P(0, 0.8)]);
    ctx.fillStyle = steel; ctx.fill(); ctx.strokeStyle = '#1b2026'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(gx + bx * 6, gy + by * 6); ctx.lineTo(h.ux - bx * 6, h.uy - by * 6); ctx.stroke();
  }
  if (G.weapon) {
    const tip = [h.ux, h.uy], back = (k) => [h.ux - bx * k * H, h.uy - by * k * H];
    if (wid === 'spear' || wid === 'trident') weaponGear(ctx, G.weapon, back(0.13), tip, w * 1.1, [h.hx - bx * 0.12 * H, h.hy - by * 0.12 * H], H);
    else if (wid === 'axe') weaponGear(ctx, G.weapon, back(0.2), tip, 0.016 * H, [h.hx - bx * 0.12 * H, h.hy - by * 0.12 * H], H);
    else weaponGear(ctx, G.weapon, [gx, gy], tip, w, [h.hx - bx * 0.08 * H, h.hy - by * 0.08 * H], H);
  }
  if (hot && a.kind === 'jab') { ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(h.ux, h.uy, 6, 0, 6.28); ctx.fill(); }
  if (kit) { drawSeg(ctx, kF, [h.ex, h.ey], [h.hx, h.hy], aw, !!h.flipF); liveArmGear(ctx, h, H, lk, aw, kpx); }
  else {
    ctx.fillStyle = YOU.skin; ctx.beginPath(); ctx.arc(h.hx, h.hy, 0.042 * H, 0, 6.28); ctx.fill();
    ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = 2; ctx.stroke();
  }
  if (h.down) {
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(h.ax, h.ay, 22, 0, 6.28); ctx.stroke();
    ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.moveTo(h.ax, h.ay); ctx.lineTo(h.fx, h.fy); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(h.fx, h.fy, 7, 0, 6.28); ctx.fill();
  }
  if (a && a.kind !== 'raise' && a.kind !== 'pull' && !locked) E.text(a.kind === 'over' ? 'SMASH' : a.kind === 'jab' ? 'STAB' : a.kind.toUpperCase(), h.hx, h.hy - 0.12 * H, { size: 11, color: '#e2e8f0', alpha: 0.7, weight: '700' });
  if (locked) E.text('X', h.ux, h.uy - 22, { size: 22, color: '#ff8a7a', weight: '800' });
}

// Your off arm and the round shield: hanging at the hip when down, up across the chest when raised, cracked as it wears.
function drawShield(ctx, E) {
  const sh = state.sh, Fy = youF(E), H = Fy.H, J = PARTS[4].joint, lk = lookFor(state.you, false), g = lk.gear.shield, tp = !g && lk.tailor && lk.tailor.paint;
  if (sh.broken) return;
  const [hx, hy] = toScreen(Fy, ...shieldPos());
  const [sx, sy] = toScreen(Fy, J[0], J[1]);
  const r = lerp(0.11, 0.2, sh.up) * H, cx = hx, cy = hy, tower = g && g.id === 'ironwall';
  const dk = Math.min(E.dpr || 1, TUNING.skin.maxDpr), apx = TUNING.kit.shArm * H * dk, kU = lk.kit && kitPic('upperarm', lk.kit.tier, apx), kF = lk.kit && kitPic('forearm', lk.kit.tier, apx);
  // the kit: your type's painted shield (Iron Wall's tower: the scutum at the tower's size), the manica on a plated shield arm
  const kind = lk.kit && (tower ? 'scutum' : lk.kit.shield), TL = TUNING.kit.tall, rm = 0.2 * H * dk;
  const spx = kind === 'scutum' ? rm * TL[1] * 2 : rm * 2, kit = kU && kF, kS = kit && shieldPic(kind, spx), tall = tower || (kS && kind === 'scutum');
  // the shield piece painted (step 6c-2): the tower's face is the tall shield, a round face the round shield's or an emblem on a tall one
  const fc = kS && gearArt(lk, 'shield', spx), emb = fc && !fc.J.h && kind === 'scutum';
  if (kit) {
    const mx = (sx + hx) / 2, my = (sy + hy) / 2, aw = TUNING.kit.shArm * H, arm = state.you.parts.find((q) => q.d.id === 'armB'), M = arm && arm.armour && gearPic('manica', aw * dk);
    drawSeg(ctx, kU, [sx, sy], [mx, my], aw); drawSeg(ctx, kF, [mx, my], [hx, hy], aw);
    if (M) drawSeg(ctx, M, [mx, my], lerp2([mx, my], [hx, hy], M.J.to), aw);
  } else limb(ctx, [[sx, sy], [hx, hy]], 0.07 * H, YOU.skin);
  // Untouchable: no shield at all, an empty fist (the kit's forearm ends in one)
  if (noShield() && kit) return;
  if (noShield()) { ctx.fillStyle = YOU.skin; ctx.beginPath(); ctx.arc(hx, hy, 0.042 * H, 0, TAU); ctx.fill(); ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = 2; ctx.stroke(); return; }
  // the round bronze shield, or Iron Wall's tower shield, tall and square
  const tw = tower ? 0.72 : TL[1], th = tower ? 1.2 : TL[0];
  const shape = (k) => (tall ? rrect(ctx, -r * tw * k, -r * th * k, r * tw * 2 * k, r * th * 2 * k, r * 0.2 * k) : (ctx.beginPath(), ctx.arc(0, 0, r * k, 0, TAU)));
  ctx.save(); ctx.translate(cx, cy);
  if (!fc && g && g.id === 'thorns') for (let i = 0; i < 10; i++) { const a = i * TAU / 10, ex = tall ? clamp(Math.cos(a) * r * tw * 2, -r * tw, r * tw) : Math.cos(a) * r * 0.92, ey = tall ? clamp(Math.sin(a) * r * th * 2, -r * th, r * th) : Math.sin(a) * r * 0.92; spike(ctx, ex, ey, a, r * 0.32, r * 0.16, BRONZE, true); }
  const gr = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, tower ? r * 1.3 : r);
  gr.addColorStop(0, '#b9803a'); gr.addColorStop(1, '#6d4519');
  const pic = (P, s) => { const w = P.J.size[0] * s, h = P.J.size[1] * s; ctx.drawImage(P.im, -w / 2, -h / 2, w, h); };
  if (kS) {
    const S = fc && !emb ? fc : kS;
    pic(S, S.J.h ? r * th / S.J.h : r / S.J.r);
    if (emb) pic(fc, r * tw * TUNING.kit.emblem / fc.J.r);
  }
  else {
    shape(1); ctx.fillStyle = gr; ctx.fill();
    ctx.strokeStyle = sh.flash > 0 ? '#ffffff' : '#2a1c10'; ctx.lineWidth = 4; ctx.stroke();
    ctx.strokeStyle = '#d6b04a'; ctx.lineWidth = 3; shape(0.82); ctx.stroke();
  }
  if (tower && !kS) { ctx.lineWidth = 2; line(ctx, 0, -r * 0.95, 0, r * 0.95); for (const k of [-0.6, 0.6]) line(ctx, -r * 0.55, r * k, r * 0.55, r * k); }
  if (tp) shieldPaint(ctx, r, tp);
  if (!fc && g && g.id === 'bait') { spiral(ctx, r * 0.8, FAM_LOOK.trick.hi); ctx.strokeStyle = '#2a1c10'; }
  if (!kS) { ctx.fillStyle = '#c9a43a'; ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, 6.28); ctx.fill(); ctx.stroke(); }
  if (!fc && g && g.id === 'thorns') spike(ctx, 0, 0, -0.6, r * 0.3, r * 0.16, BRONZE, true);
  const worn = shieldMax() - sh.hits;
  ctx.strokeStyle = '#1a120a'; ctx.lineWidth = 2;
  for (let i = 0; i < worn; i++) { const a = i * 1.7 + 0.5; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.25, Math.sin(a) * r * 0.25); ctx.lineTo(Math.cos(a + 0.2) * r * 0.65, Math.sin(a + 0.2) * r * 0.65); ctx.lineTo(Math.cos(a - 0.1) * r * 0.95, Math.sin(a - 0.1) * r * 0.95); ctx.stroke(); }
  if (sh.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${sh.flash / 0.25 * 0.5})`; shape(1); ctx.fill(); }
  if (g) gearGlint(ctx, r * 0.5, -r * 0.5, r * 0.4, g, 0.2);
  ctx.restore();
}
// the tailor's shield paint, inside the rim: a pair of wings, a thunderbolt, or a sun's rays
function shieldPaint(ctx, r, tp) {
  ctx.save(); ctx.fillStyle = tp.col; ctx.strokeStyle = shade(tp.col, 0.45); ctx.lineWidth = 1.2; ctx.globalAlpha = 0.9;
  if (tp.i === 0) for (const sd of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(sd * r * 0.2, 0); ctx.quadraticCurveTo(sd * r * 0.45, -r * 0.62, sd * r * 0.74, -r * 0.3);
    for (let k = 0; k < 3; k++) ctx.lineTo(sd * r * (0.66 - k * 0.14), -r * (0.08 - k * 0.12)), ctx.lineTo(sd * r * (0.6 - k * 0.14), r * (0.08 + k * 0.1));
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (tp.i === 1) {
    ctx.beginPath(); ctx.moveTo(r * 0.12, -r * 0.72); ctx.lineTo(-r * 0.3, r * 0.06); ctx.lineTo(-r * 0.02, r * 0.06); ctx.lineTo(-r * 0.16, r * 0.72); ctx.lineTo(r * 0.32, -r * 0.12); ctx.lineTo(r * 0.04, -r * 0.12); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else for (let k = 0; k < 12; k++) {
    const a = k * TAU / 12, a2 = a + 0.13;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3); ctx.lineTo(Math.cos(a + 0.065) * r * 0.74, Math.sin(a + 0.065) * r * 0.74); ctx.lineTo(Math.cos(a2) * r * 0.3, Math.sin(a2) * r * 0.3); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
// a live piece's glint (the shield and the weapon are drawn each frame)
function gearGlint(ctx, x, y, s, c, ph) {
  const S = TUNING.skin, k = Math.pow(Math.max(0, Math.sin((state.m / S.gearGlint + ph) * TAU)), 6) * S.gearGlintA;
  if (k < 0.02) return;
  ctx.save(); glint(ctx, x, y, s, rarCol(c), k); ctx.restore();
}

// ----- a beast on screen, drawn live from its pose: far legs, tail, torso, near hind leg, head (a mane or a bear's snout), near foreleg, its gaps -----
const BEAST_COL = {
  lion: { body: '#c99a52', dark: '#93672f', light: '#ead0a0', mane: '#7a4a1e', maneHi: '#a86a2c', nose: '#3a2418', line: '#3a2410' },
  bear: { body: '#6e4c2e', dark: '#47311c', light: '#a07c56', mane: '#5a3c21', maneHi: '#82603c', nose: '#17100a', line: '#1e140a' },
};
const inFrame = (ctx, fr, H) => { ctx.translate(fr.ox * H, fr.oy * H); ctx.rotate(fr.rot); };
// one leg of three points (body units): a thick upper bone, a thinner lower one, a paw
function beastLeg(ctx, lg, H, w, col, line) {
  const [a, k, f] = lg, P = (q) => [q[0] * H, q[1] * H];
  const [ax, ay] = P(a), [kx, ky] = P(k), [fx, fy] = P(f);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = line; ctx.lineWidth = w * H + 3; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = w * H; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(kx, ky); ctx.stroke();
  ctx.lineWidth = w * H * 0.72; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
  ctx.fillStyle = col; ctx.strokeStyle = line; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(fx + 0.012 * H, fy - 0.012 * H, 0.03 * H, 0.018 * H, 0, 0, TAU); ctx.fill(); ctx.stroke();
}
// the torso's outline (body units), its frame applied
function beastTorso(ctx, lion, H) {
  const Q = (a, b, c, d) => ctx.quadraticCurveTo(a * H, b * H, c * H, d * H);
  ctx.beginPath();
  if (lion) { ctx.moveTo(0.14 * H, -0.31 * H); Q(0.12, -0.4, 0.04, -0.405); Q(-0.12, -0.375, -0.27, -0.375); Q(-0.36, -0.37, -0.35, -0.28); Q(-0.34, -0.21, -0.27, -0.2); Q(-0.15, -0.195, -0.04, -0.215); Q(0.1, -0.2, 0.14, -0.31); }
  else { ctx.moveTo(0.14 * H, -0.3 * H); Q(0.13, -0.44, 0.02, -0.455); Q(-0.06, -0.465, -0.12, -0.425); Q(-0.26, -0.415, -0.33, -0.38); Q(-0.38, -0.31, -0.33, -0.22); Q(-0.28, -0.19, -0.18, -0.2); Q(-0.06, -0.205, 0.02, -0.2); Q(0.12, -0.19, 0.14, -0.3); }
  ctx.closePath();
}
// a beast's gap: a dark slit under the fur's pale lip, a red line of flesh along it
function beastSlot(ctx, p, H) {
  const d = p.d, w = d.w * H, h = d.h * H, x = d.x * H - w / 2, y = d.y * H - h / 2;
  rrect(ctx, x, y, w, h, Math.min(w, h) * 0.45); ctx.fillStyle = 'rgba(28,8,6,0.95)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,228,186,0.9)'; ctx.lineWidth = Math.max(1.2, 0.006 * H); ctx.stroke();
  ctx.strokeStyle = '#b4413a'; ctx.lineWidth = Math.max(1, 0.004 * H);
  if (w > h) line(ctx, x + w * 0.2, d.y * H, x + w * 0.8, d.y * H); else line(ctx, d.x * H, y + h * 0.2, d.x * H, y + h * 0.8);
}
// a part's cuts and its flash when hit, in its frame
function beastMarks(ctx, fm, p, H) {
  const fr = fm.fr[p.d.frame || p.d.id];
  ctx.save(); if (fr) inFrame(ctx, fr, H);
  cuts(ctx, p, H);
  if (p.flash > 0) { path(ctx, p.d, H); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,240,200,${0.6 * p.flash / 0.16})`; ctx.fill(); }
  ctx.restore();
}
// A beast's face in its head frame: the jaw opening on a roar (a dark mouth with two fangs under the muzzle), then the muzzle, nose and eye; over the
// painted head (painted) the roar is a dark wedge hinged at the painted mouth's corner (`hinge`, `lip`), then only the tell's glint and brow.
function beastFace(ctx, H, hx, hy, q, C, lion, live, painted) {
  // the jaw, open by q.jaw: a dark mouth with two fangs under the muzzle; over the painted head the mouth is a wedge pinned to its muzzle
  const ja = (painted ? TUNING.beastArt.gape : 0.55) * q.jaw;
  if (ja > 0.02 && painted) {
    const A = TUNING.beastArt[lion ? 'lion' : 'bear'].head, EA = TUNING.beastArt.eyeAt, s = A.u * H, ox = hx + EA[0] * H - A.eye[0] * s, oy = hy + EA[1] * H - A.eye[1] * s;
    const jx = ox + A.hinge[0] * s, jy = oy + A.hinge[1] * s, lx = ox + A.lip[0] * s - jx, ly = oy + A.lip[1] * s - jy, ca = Math.cos(ja), sa = Math.sin(ja);
    const dx = lx * ca - ly * sa, dy = lx * sa + ly * ca;
    ctx.fillStyle = '#4a0e0a'; ctx.beginPath(); ctx.moveTo(jx, jy); ctx.lineTo(jx + lx, jy + ly); ctx.lineTo(jx + dx, jy + dy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff8e8'; ctx.beginPath(); ctx.moveTo(jx + lx * 0.9, jy + ly * 0.9); ctx.lineTo(jx + lx * 0.9 + 0.012 * H * sa, jy + ly * 0.9 + 0.016 * H); ctx.lineTo(jx + lx * 0.7, jy + ly * 0.7); ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(jx, jy); ctx.lineTo(jx + dx, jy + dy); ctx.stroke();
  } else if (ja > 0.02) {
    const jx = hx + 0.01 * H, jy = hy + 0.035 * H;
    ctx.save(); ctx.translate(jx, jy); ctx.rotate(ja);
    ctx.fillStyle = '#5a1410'; ctx.beginPath(); ctx.moveTo(0, -0.02 * H); ctx.lineTo(0.085 * H, -0.02 * H); ctx.lineTo(0.075 * H, 0.012 * H); ctx.lineTo(0, 0.012 * H); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.light; ctx.beginPath(); ctx.moveTo(0, 0.004 * H); ctx.lineTo(0.08 * H, 0.004 * H); ctx.lineTo(0.07 * H, 0.022 * H); ctx.lineTo(0.005 * H, 0.024 * H); ctx.closePath(); ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#fff8e8'; for (const fx of [0.06, 0.035]) { ctx.beginPath(); ctx.moveTo(fx * H, 0.004 * H); ctx.lineTo((fx + 0.008) * H, -0.012 * H); ctx.lineTo((fx + 0.016) * H, 0.004 * H); ctx.fill(); }
    ctx.restore();
  }
  if (!painted) {
    ctx.fillStyle = C.light; ctx.beginPath();
    if (lion) ctx.ellipse(hx + 0.05 * H, hy + 0.025 * H, 0.045 * H, 0.032 * H, 0, 0, TAU); else ctx.ellipse(hx + 0.065 * H, hy + 0.02 * H, 0.05 * H, 0.03 * H, 0.1, 0, TAU);
    ctx.fill(); ctx.strokeStyle = C.line; ctx.stroke();
    ctx.fillStyle = C.nose; ctx.beginPath(); ctx.arc(hx + (lion ? 0.086 : 0.108) * H, hy + 0.01 * H, (lion ? 0.012 : 0.015) * H, 0, TAU); ctx.fill();
  }
  // the eye, a brow drawn down over it in a tell (the painted head has its own eye: only the tell's gold glint goes on it)
  const EA = TUNING.beastArt.eyeAt, ex = hx + EA[0] * H, ey = hy + EA[1] * H, tell = live && state.sw && state.sw.fin <= 0;
  if (!painted) { ctx.fillStyle = '#1a0f08'; ctx.beginPath(); ctx.arc(ex, ey, 0.01 * H, 0, TAU); ctx.fill(); }
  if (!painted || tell) { ctx.fillStyle = tell ? '#ffd24a' : '#f6e7c8'; ctx.beginPath(); ctx.arc(ex + 0.003 * H, ey - 0.003 * H, 0.0035 * H, 0, TAU); ctx.fill(); }
  if (tell) { ctx.strokeStyle = C.line; ctx.lineWidth = 2; line(ctx, ex - 0.018 * H, ey - 0.02 * H, ex + 0.016 * H, ey - 0.008 * H); }
}
// the lion's tail tip (its body frame), lashing faster as q.tail rises
function tailTip(q) { const ph = state.m * (1.6 + 1.6 * q.tail); return [-0.43 + 0.02 * Math.sin(ph), -0.47 + 0.03 * Math.cos(ph * 0.8)]; }
// The beast's painted kit (step 6b): each part's image by name (a young beast's -young part where there is one), copies scaled near their size on
// screen, the far legs' shaded; null until every one has loaded, and the drawn beast stays.
function beastKit(E, fm, H) {
  if (!kitOn() || !ART.has(`beast-${fm.beast}-body`)) return null;
  const A = TUNING.beastArt[fm.beast], dk = Math.min(E.dpr || 1, TUNING.skin.maxDpr), dark = TUNING.beastArt.far, lw = TUNING.beastArt.leg * H * dk;
  const nm = (part) => { const b = `beast-${fm.beast}-${part}`, n = fm.young && ART.has(`${b}-young`) ? `${b}-young` : b; return segOf(n); };
  // a one-segment upper leg is drawn whole
  const U = nm('upperleg').endsWith('-seg') ? { ...A.upper, clip: 0 } : A.upper;
  const K = {
    body: artPic(nm('body'), A.body, (A.body.box[2] - A.body.box[0]) * H * dk), head: artPic(nm('head'), A.head, A.head.size[0] * A.head.u * H * dk),
    up: artPic(nm('upperleg'), U, lw), lo: artPic(nm('lowerleg'), A.lower, lw), upD: artPic(nm('upperleg'), U, lw, dark), loD: artPic(nm('lowerleg'), A.lower, lw, dark),
    tail: A.tail ? artPic(nm('tail'), A.tail, A.tail.size[0] * A.head.u * H * dk) : null, pin: TUNING.beastArt.pin[artStem(nm('body'))] || null,
  };
  return K.body && K.head && K.up && K.lo && K.upD && K.loD && (!A.tail || K.tail) ? K : null;
}
// The painted beast, drawn from its pose like the drawn one and in the same order: the far legs (shaded), the tail and the body (mirrored: its PNG
// faces left), the near hind leg, the head pinned by its eye with the tells on it, the near foreleg; each part's cuts and flash on top.
function beastPainted(ctx, fm, H, K, q, live, C, P, fw, hw) {
  const A = TUNING.beastArt[fm.beast], fr = fm.fr, lg = fm.lg, lion = fm.beast === 'lion';
  // the copies are at the screen's pixel ratio, so an unsmoothed draw stays clean and costs far less than a smoothed one
  ctx.imageSmoothingEnabled = false;
  const paw = fm.paw || (fm.paw = [false, false, false, false]), B = A.body.box, BB = BEAST_BODY[fm.beast], bf = fr.body, bc = Math.cos(bf.rot), bs = Math.sin(bf.rot);
  // each leg's top on the painted body's shoulder or hip (body units, in the body's frame), the far one at the rig's offset from the near one
  const top = (i) => {
    if (!K.pin) return lg[i][0];
    const q = K.pin[i < 2 ? 0 : 1], R = i < 2 ? BB.sh : BB.hp, far = i % 2, sz = A.body.size;
    const x = B[2] - q[0] * (B[2] - B[0]) / sz[0] + (far ? R[1][0] - R[0][0] : 0), y = B[1] + q[1] * (B[3] - B[1]) / sz[1] + (far ? R[1][1] - R[0][1] : 0);
    return [bf.ox + x * bc - y * bs, bf.oy + x * bs + y * bc];
  };
  const leg = (i, w, dark) => {
    const [, k, f] = lg[i], S = (p) => [p[0] * H, p[1] * H], kk = S(k), ff = S(f);
    drawSeg(ctx, dark ? K.upD : K.up, S(top(i)), kk, w * H);
    // The paw points the way the beast faces: the PNG's toes (+x) point ahead by the bone's drop share, so the lower leg is mirrored when they point
    // back, past a dead band so a paw swinging through the knee's height never pops.
    const t = (ff[1] - kk[1]) / (Math.hypot(ff[0] - kk[0], ff[1] - kk[1]) || 1);
    if (Math.abs(t) > TUNING.beastArt.pawBand) paw[i] = t < 0;
    drawSeg(ctx, dark ? K.loD : K.lo, kk, ff, w * H, paw[i]);
  };
  leg(1, fw, true); leg(3, hw, true);
  ctx.save(); inFrame(ctx, fr.body, H);
  if (K.tail) { const [tx, ty] = tailTip(q); drawSeg(ctx, K.tail, [A.tail.root[0] * H, A.tail.root[1] * H], [tx * H, ty * H], 0); }
  ctx.save(); ctx.scale(-1, 1); ctx.drawImage(K.body.im, -B[2] * H, B[1] * H, (B[2] - B[0]) * H, (B[3] - B[1]) * H); ctx.restore();
  ctx.restore();
  beastMarks(ctx, fm, P('chest'), H); beastMarks(ctx, fm, P('belly'), H);
  leg(2, hw, false);
  beastMarks(ctx, fm, P('legs'), H);
  ctx.save(); inFrame(ctx, fr.head, H);
  const hd = P('head').d, hx = hd.x * H, hy = hd.y * H, s = A.head.u * H, EA = TUNING.beastArt.eyeAt;
  ctx.drawImage(K.head.im, hx + EA[0] * H - A.head.eye[0] * s, hy + EA[1] * H - A.head.eye[1] * s, A.head.size[0] * s, A.head.size[1] * s);
  beastFace(ctx, H, hx, hy, q, C, lion, live, true);
  ctx.restore();
  beastMarks(ctx, fm, P('head'), H);
  leg(0, fw, false);
  beastMarks(ctx, fm, P('legF'), H);
  ctx.imageSmoothingEnabled = true;
}
function drawBeast(ctx, E, F, fm, who, ga = 1) {
  const H = F.H, live = who === 'foe', lion = fm.beast === 'lion', C = BEAST_COL[fm.beast], fr = fm.fr, lg = fm.lg, q = fm.bq || beastRestQ();
  if (!fr || !lg || !fr.body) return;
  const P = (id) => fm.parts.find((r) => r.d.id === id), fall = live && state.fallT > 0 ? Math.pow(clamp(state.fallT / 0.5, 0, 1), 2) : 0;
  const [sx] = toScreen(F, -0.06, 0);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(sx, F.y - (live ? fm.dy : 0) + 3, H * 0.34, H * 0.035, 0, 0, TAU); ctx.fill();
  ctx.save();
  ctx.translate(F.x, F.y); ctx.scale(F.dir, 1); ctx.rotate(F.a);
  if (live && (state.stagger > 0 || state.winded > 0)) {
    const k = state.winded > 0 ? 0.35 + 0.25 * Math.sin(state.m * 9) : 0.45, g = ctx.createRadialGradient(-0.06 * H, -0.3 * H, 10, -0.06 * H, -0.3 * H, 0.5 * H);
    g.addColorStop(0, `rgba(255,210,74,${k})`); g.addColorStop(1, 'rgba(255,210,74,0)');
    ctx.fillStyle = g; ctx.fillRect(-0.6 * H, -0.8 * H, 1.1 * H, 0.9 * H);
  }
  const sc = live && state.pop < 1 ? 0.85 + 0.15 * (1 - state.pop) : 1;
  ctx.scale(sc, sc);
  ctx.globalAlpha = ga * (live && state.pop < 1 ? 1 - state.pop * 0.7 : 1) * (1 - fall * 0.5);
  const fw = lion ? 0.06 : 0.075, hw = lion ? 0.065 : 0.08, K = beastKit(E, fm, H);
  if (K) beastPainted(ctx, fm, H, K, q, live, C, P, fw, hw);
  else {
    beastLeg(ctx, lg[1], H, fw, C.dark, C.line); beastLeg(ctx, lg[3], H, hw, C.dark, C.line);
    // the body: tail, torso with its shaded belly and lit back, a bear's fur
    ctx.save(); inFrame(ctx, fr.body, H);
    if (lion) {
      const [tx, ty] = tailTip(q);
      ctx.lineCap = 'round'; ctx.strokeStyle = C.line; ctx.lineWidth = 0.018 * H + 3; ctx.beginPath(); ctx.moveTo(-0.33 * H, -0.33 * H); ctx.quadraticCurveTo(-0.45 * H, -0.3 * H, tx * H, ty * H); ctx.stroke();
      ctx.strokeStyle = C.body; ctx.lineWidth = 0.018 * H; ctx.stroke();
      ctx.fillStyle = C.mane; ctx.beginPath(); ctx.ellipse(tx * H, ty * H, 0.022 * H, 0.03 * H, 0.4, 0, TAU); ctx.fill();
    } else { ctx.fillStyle = C.dark; ctx.beginPath(); ctx.ellipse(-0.35 * H, -0.35 * H, 0.03 * H, 0.022 * H, 0, 0, TAU); ctx.fill(); }
    beastTorso(ctx, lion, H); ctx.fillStyle = C.body; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); beastTorso(ctx, lion, H); ctx.clip();
    ctx.fillStyle = 'rgba(40,22,8,0.3)'; ctx.fillRect(-0.4 * H, -0.27 * H, 0.6 * H, 0.1 * H);
    ctx.fillStyle = 'rgba(255,236,200,0.16)'; ctx.fillRect(-0.4 * H, -0.47 * H, 0.6 * H, 0.08 * H);
    if (!lion) { ctx.strokeStyle = 'rgba(20,12,6,0.4)'; ctx.lineWidth = 1.2; for (let i = 0; i < 9; i++) { const x = (-0.3 + i * 0.05) * H, y = (-0.4 + (i % 3) * 0.05) * H; line(ctx, x, y, x - 0.015 * H, y + 0.03 * H); } }
    ctx.restore();
    ctx.restore();
    beastMarks(ctx, fm, P('chest'), H); beastMarks(ctx, fm, P('belly'), H);
    // the near hind leg, its haunch over the hip
    const [ha] = lg[2];
    beastLeg(ctx, lg[2], H, hw, C.body, C.line);
    ctx.fillStyle = C.body; ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(ha[0] * H, (ha[1] + 0.03) * H, 0.075 * H, 0.085 * H, -0.3, 0, TAU); ctx.fill(); ctx.stroke();
    beastMarks(ctx, fm, P('legs'), H);
    // the head: the lion's mane behind it, ears, the muzzle and its nose, an eye, the jaw opening on a roar
    ctx.save(); inFrame(ctx, fr.head, H);
    const hd = P('head').d, hx = hd.x * H, hy = hd.y * H, r = hd.r * H;
    if (lion) {
      ctx.fillStyle = C.mane; ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.beginPath();
      // the mane: a shaggy ring round the head that hangs down over the chest
      for (let i = 0; i < 22; i++) { const a = i * TAU / 22, rr = (i % 2 ? 0.1 : 0.128) * H * (Math.sin(a) > 0 ? 1.12 : 1); ctx.lineTo(hx - 0.045 * H + Math.cos(a) * rr, hy + 0.01 * H + Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = C.maneHi; ctx.beginPath(); ctx.arc(hx - 0.04 * H, hy + 0.005 * H, 0.085 * H, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(60,30,10,0.55)'; ctx.lineWidth = 1.3; for (let i = 0; i < 7; i++) { const a = 0.6 + i * 0.55; line(ctx, hx - 0.045 * H + Math.cos(a) * 0.07 * H, hy + Math.sin(a) * 0.07 * H, hx - 0.045 * H + Math.cos(a) * 0.11 * H, hy + Math.sin(a) * 0.11 * H); }
    } else for (const [ex, ey] of [[-0.035, -0.06], [-0.005, -0.068]]) { ctx.fillStyle = C.dark; ctx.beginPath(); ctx.arc(hx + ex * H, hy + ey * H, 0.022 * H, 0, TAU); ctx.fill(); }
    ctx.fillStyle = C.body; ctx.strokeStyle = C.line; ctx.lineWidth = 1.5;
    if (lion) { ctx.beginPath(); ctx.arc(hx - 0.025 * H, hy - 0.06 * H, 0.02 * H, 0, TAU); ctx.fill(); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(hx, hy, r * (lion ? 0.95 : 0.9), 0, TAU); ctx.fill(); ctx.stroke();
    beastFace(ctx, H, hx, hy, q, C, lion, live, false);
    ctx.restore();
    beastMarks(ctx, fm, P('head'), H);
    // the near foreleg over the chest, a red cross on a lamed leg, then the gaps and their light
    beastLeg(ctx, lg[0], H, fw, C.body, C.line);
    beastMarks(ctx, fm, P('legF'), H);
  }
  if (live && state.foeNet > 0 && state.fallT <= 0 && netArt()) drapeNet(ctx, E, H, fm, netK(state.foeNet));
  markLamed(ctx, fm, H);
  for (const p of fm.parts) if (p.slot) { ctx.save(); inFrame(ctx, fr[p.d.frame], H); beastSlot(ctx, p, H); ctx.restore(); }
  if (live) for (const p of fm.parts) if (p.slot) slotLight(ctx, F, p, H, fm);
  ctx.globalAlpha = 1;
  ctx.restore();
  if (live && state.stun > 0) {
    const [hx2, hy2] = toScreen(F, 0.17, -0.58);
    for (let i = 0; i < 3; i++) { const a = state.m * 7 + i * 2.09; E.text('*', hx2 + Math.cos(a) * 0.1 * H, hy2 + Math.sin(a) * 0.03 * H, { size: 26, color: '#fde68a', weight: '800' }); }
  }
}

// ----- the play screen: the left column, the walls, his cover and tell, the hint, the caption, the background -----
// The shield buttons and DODGE. The shield button matching the foe's tell glows; the raised one is lit; DODGE lights while you are backed off and reddens at the wall.
function drawShieldBtns(ctx, E) {
  const sh = state.sh, sw = state.sw, shown = sw && sw.puppet && sw.fake && !sw.switched, tell = sw && sw.fin <= 0 && !hesitating() && !shown ? sw.zone : null, fakeBtn = hesitating() || shown ? sw.zone : null;
  const pulse = 0.5 + 0.5 * Math.sin(state.m * 14);
  for (const b of shieldBtns(E)) {
    if (b.dodge) { drawDodgeBtn(ctx, E, b); continue; }
    const on = raised() && sh.zone === b.z, hot = tell === b.z, perfect = hot && sw.wind - sw.t <= perfectWin();
    const fill = on ? 'rgba(214,162,74,0.85)' : hot ? `rgba(255,${perfect ? 220 : 120},60,${0.45 + 0.4 * pulse})` : sh.arm > 0 && sh.zone === b.z ? 'rgba(214,162,74,0.35)' : 'rgba(20,16,26,0.55)';
    E.roundRect(b.x, b.y, b.w, b.h, 12, sh.broken || noShield() ? 'rgba(40,40,46,0.6)' : fill, hot ? '#ffd24a' : on ? '#fff0b8' : 'rgba(240,230,204,0.45)');
    if (hot) { ctx.save(); ctx.shadowColor = '#ffb347'; ctx.shadowBlur = 18; E.roundRect(b.x, b.y, b.w, b.h, 12, null, '#ffb347'); ctx.restore(); }
    if (fakeBtn === b.z) E.roundRect(b.x, b.y, b.w, b.h, 12, `rgba(167,139,250,${0.2 + 0.25 * pulse})`, '#c4b5fd');
    if (state.snapT > 0 && hot) { const k = state.snapT / TUNING.moves.feint.snap; ctx.save(); ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 28 * k; E.roundRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6, 14, `rgba(255,255,255,${0.75 * k})`, '#ffffff'); ctx.restore(); }
    E.text(b.z.label, b.x + b.w / 2, b.y + b.h / 2, { size: Math.round(clamp(b.h * 0.26, 15, 22)), weight: '800', color: on ? '#2a1c10' : '#f0e6cc' });
  }
}

function drawDodgeBtn(ctx, E, b) {
  const on = state.away, wall = state.foot.pos <= walls(E).back + 0.01, cd = state.dodgeCool > 0 && !on;
  if (noDodge()) { E.roundRect(b.x, b.y, b.w, b.h, 12, 'rgba(40,40,46,0.6)', 'rgba(160,160,170,0.35)'); E.text('NO DODGE', b.x + b.w / 2, b.y + b.h / 2, { size: 16, weight: '800', color: '#8a8f99' }); return; }
  const fill = on ? 'rgba(125,227,255,0.8)' : wall ? 'rgba(239,68,68,0.45)' : cd ? 'rgba(20,16,26,0.55)' : 'rgba(20,40,52,0.6)';
  E.roundRect(b.x, b.y, b.w, b.h, 12, fill, 'rgba(125,227,255,0.6)');
  const ink = on ? '#0b2530' : '#bff0ff', size = Math.round(clamp(b.h * 0.3, 16, 22)), cy = b.y + b.h * 0.42, s = size * 0.42;
  ctx.font = `800 ${size}px system-ui, sans-serif`;
  const tw = ctx.measureText('DODGE').width, ax = b.x + b.w / 2 - tw / 2 - s - 4;
  ctx.fillStyle = ink; ctx.beginPath(); ctx.moveTo(ax - s * 0.9, cy); ctx.lineTo(ax + s * 0.7, cy - s); ctx.lineTo(ax + s * 0.7, cy + s); ctx.closePath(); ctx.fill();
  E.text('DODGE', b.x + b.w / 2 + s / 2, cy, { size, weight: '800', color: ink });
  const sub = wall ? 'at the wall' : state.dg.down && state.dg.t > TUNING.dodge.dur ? 'backing off' : firstRun(E) ? 'hold: back off' : '';
  if (sub) E.text(sub, b.x + b.w / 2, b.y + b.h * 0.76, { size: 14, weight: '700', color: ink });
}
// The arena's edges: a low timber barrier behind each fighter, where he can give no more ground.
function drawWalls(ctx, E) {
  const L = lay(E), wl = walls(E), H = L.H, f = state.foe, k = f.size ? f.size.scale : 1;
  const xs = [L.x0 + wl.back * H - 0.2 * H * meSize().scale - 6, L.x1 + wl.fore * H + (f.beast ? rearOf(f) : 0.3 * k) * H + 6];
  for (const x of xs) {
    const top = L.floor - 0.34 * H;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x - 6, L.floor - 2, 12, 6);
    ctx.fillStyle = '#5e3e1e'; ctx.fillRect(x - 5, top, 10, L.floor - top);
    ctx.fillStyle = '#8a5f30'; ctx.fillRect(x - 5, top, 3, L.floor - top);
    ctx.fillStyle = '#3e2511'; ctx.fillRect(x - 8, top - 4, 16, 6); ctx.fillRect(x - 8, top + 0.14 * H, 16, 4);
  }
}

// The foe's cover: a shield or guard disc sliding over the part you just hit. His OPEN flags are in the HUD (foeHealth).
function drawGuard(ctx, E) {
  if (state.fallT > 0) return;
  const F = foeF(E), H = F.H, sty = state.foe.shield ? { tint: '#7dd3fc', label: 'SHIELD' } : state.foe.beast ? { tint: '#ead0a0', label: 'PAW' } : { tint: '#fde68a', label: 'GUARD' };
  if (covering()) {
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
  }
}

// The foe's tell: a band at the height of the coming blow. The label says what to do, and turns gold in the perfect-block window.
let zoneLbl = null;
function drawZone(ctx, E) {
  const sw = state.sw;
  zoneLbl = null;
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
    zoneLbl = { t: sw.puppet ? `FEINT: NOT ${sw.fake.label}` : `${sw.fake.label}...?`, y: y - bh - 10, color: '#c4b5fd', alpha: 0.6 + 0.4 * sh };
    return;
  }
  const left = sw.wind - sw.t, inWin = left <= SH.dur, perfect = left <= perfectWin(), shown = sw.puppet && sw.fake && !sw.switched;
  const pulse = 0.5 + 0.5 * Math.sin(sw.t * (10 + 14 * sw.t / sw.wind));
  const rgb = shown ? '196,181,253' : perfect ? '255,236,120' : inWin ? '255,150,60' : '255,70,50';
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
  zoneLbl = shown ? { t: `FEINT: NOT ${sw.fake.label}`, y: y - bh - 10, color: '#c4b5fd', alpha: 1 } : { t: what || (perfect ? `${sw.zone.label} NOW` : inWin ? `SHIELD ${sw.zone.label}` : `${sw.counter ? 'COUNTER ' : ''}${name} ${sw.zone.label}`), y: y - bh - 10, color: `rgb(${rgb})`, alpha: 1 };
}
// The tell's label, drawn after the shield and sword arm so they never cover it: centred over the foe, kept on screen, so it never sits under your arm.
function drawZoneLabel(ctx, E) {
  if (!zoneLbl) return;
  const Ff = foeF(E), z = zoneLbl, w = (ctx.font = '800 18px system-ui, sans-serif', ctx.measureText(z.t).width);
  const x = clamp(Ff.x, w / 2 + 8, E.w - E.safe.right - w / 2 - 8);
  E.text(z.t, x, z.y, { size: 18, weight: '800', color: z.color, alpha: z.alpha });
}

// A bottom-edge box whose right edge reaches the finisher button (or its first-time hint, which runs left of it) sits above it instead: returns the box's top y.
function aboveFin(E, right, h, y) {
  const b = finBtn(E), hs = rightHints(E);
  if (!b && !hs.length) return y;
  const base = b ? b.y : E.h - 10 - E.safe.bottom - TUNING.finBtn.h;
  let left = b ? b.x : Infinity, top = base;
  for (const q of hs) { left = Math.min(left, q.px); top = Math.min(top, q.py); }
  if (right <= left - 8) return y;
  return Math.min(y, top - 8 - h);
}
// The one-line hints at the bottom right, stacked up from the finisher button's slot: the button's own first-time hint (while the button shows) and the
// crowd's or Momentum's (state.hintS). Each sits on a dark plate (px, py, pw, ph), is right-aligned to the screen's edge gutter and wraps to the room right of the left column.
function rightHints(E) {
  const out = [];
  if ((state.finHintT <= 0 && state.hintT <= 0) || !finLive(E)) return out;
  const b = finBtn(E), R = E.w - 16 - E.safe.right, room = R - (colRect(E).x + colRect(E).w + 12), ctx = E.ctx;
  let y = (b ? b.y : E.h - 10 - E.safe.bottom - TUNING.finBtn.h) - 23;
  ctx.font = '800 14px system-ui, sans-serif';
  for (const [s, t] of [[b && state.finHintT > 0 ? 'Tap to spend your Momentum.' : '', state.finHintT], [state.hintT > 0 ? state.hintS : '', state.hintT]]) {
    if (!s) continue;
    const lines = wrapPx(ctx, s, room - 8, 14, '800'), tw = Math.max(...lines.map((l) => ctx.measureText(l).width)), ph = 18 * lines.length + 12;
    out.push({ lines, x: R - tw, y, px: R - tw - 8, py: y - 18 * (lines.length - 1) - 15, pw: tw + 16, ph, a: clamp(t / 1.5, 0, 1) });
    y -= ph + 6;
  }
  return out;
}
function drawRightHints(E) {
  const ctx = E.ctx;
  for (const q of rightHints(E)) {
    ctx.globalAlpha = q.a; E.roundRect(q.px, q.py, q.pw, q.ph, 10, 'rgba(20,12,4,0.72)', null); ctx.globalAlpha = 1;
    q.lines.forEach((l, i) => E.text(l, E.w - 16 - E.safe.right, q.y - 18 * (q.lines.length - 1 - i), { size: 14, align: 'right', weight: '800', color: '#fde68a', alpha: q.a }));
  }
}
// The hint, in a player's first bouts ever: two short lines along the bottom, in the space right of the left thumb's column, fading out.
function drawHint(ctx, E) {
  const t = state.m - state.boutT0, D = TUNING.hint.dur;
  if (t > D) return;
  let y = E.h - 12 - E.safe.bottom;
  const R = colRect(E), x0 = R.x + R.w + 12, cx = (x0 + E.w - E.safe.right - 12) / 2, a = clamp((D - t) / 1.5, 0, 1);
  const lines = ['Left thumb: High / Mid / Low raise the shield  \u00b7  DODGE steps back', 'Right thumb: your weapon (like a trackpad; push far to lunge in)'];
  ctx.font = '700 12px system-ui, sans-serif';
  const hw = Math.max(...lines.map((s) => ctx.measureText(s).width)), hh = (lines.length - 1) * 17 + 14;
  y = aboveFin(E, cx + hw / 2, hh, y + 7 - hh) + hh - 7;
  lines.forEach((s, i) => E.text(s, cx, y - (lines.length - 1 - i) * 17, { size: 12, color: '#f0e6cc', weight: '700', alpha: a }));
}
// The finisher button, bottom right, glowing violet: the finisher's name, its cost in pips, and (with two ready) an arrow chip that cycles to the other.
// The first time it ever shows, a one-line hint sits above it.
function drawFinBtn(ctx, E) {
  const b = finBtn(E);
  if (!b) return;
  const pulse = 0.5 + 0.5 * Math.sin(state.m * 6), nx = b.x + b.arrow, nw = b.w - b.arrow, cy = b.y + b.h / 2, cost = finCost(b.c);
  ctx.save();
  ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 8 + 10 * pulse;
  E.roundRect(b.x, b.y, b.w, b.h, 12, 'rgba(62,20,80,0.92)', '#e879f9');
  ctx.restore();
  E.text(b.c.name.toUpperCase(), nx + nw / 2, b.y + 18, { size: 14, weight: '800', color: '#fdf4ff' });
  const s = 5, gap = 14, x0 = nx + nw / 2 - (cost - 1) * gap / 2;
  for (let i = 0; i < cost; i++) {
    const x = x0 + i * gap, y = b.y + b.h - 15;
    ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath();
    ctx.fillStyle = '#ffd24a'; ctx.fill(); ctx.strokeStyle = '#fff0b8'; ctx.lineWidth = 1.2; ctx.stroke();
  }
  if (b.two) {
    ctx.strokeStyle = 'rgba(232,121,249,0.6)'; ctx.lineWidth = 1.5; line(ctx, nx, b.y + 8, nx, b.y + b.h - 8);
    const ax = b.x + b.arrow / 2;
    ctx.strokeStyle = '#f5d0fe'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(ax - 8, cy - 5); ctx.lineTo(ax + 8, cy - 5); ctx.moveTo(ax + 3, cy - 10); ctx.lineTo(ax + 8, cy - 5); ctx.lineTo(ax + 3, cy);
    ctx.moveTo(ax + 8, cy + 6); ctx.lineTo(ax - 8, cy + 6); ctx.moveTo(ax - 3, cy + 1); ctx.lineTo(ax - 8, cy + 6); ctx.lineTo(ax - 3, cy + 11); ctx.stroke();
  }
}
// The lesson caption: a banner along the bottom edge, over the feet, so it never covers a zone band, its label or the foe's flags.
function drawCaption(ctx, E) {
  const c = state.caption;
  if (!c) return;
  const a = clamp(c.t / 0.4, 0, 1) * clamp((c.max - c.t) / 0.15, 0, 1), w = Math.min(E.w - 220, 540), lh = 18, h = 10 + c.lines.length * lh, x = (E.w - w) / 2, y = aboveFin(E, x + w, h, E.h - E.safe.bottom - h - 4);
  ctx.globalAlpha = a;
  E.roundRect(x, y, w, h, 10, 'rgba(24,16,40,0.88)', c.good ? '#ffd24a' : '#a78bfa');
  c.lines.forEach((t, i) => E.text(t, E.w / 2, y + 5 + lh / 2 + i * lh, { size: i ? 13 : 16, weight: i ? '700' : '800', color: i ? '#ede9fe' : c.good ? '#ffd24a' : '#c4b5fd', alpha: a }));
  if (state.sw && state.sw.lesson === 'slow') E.text('slow motion', x + w - 8, y - 10, { size: 14, align: 'right', color: '#a78bfa', alpha: a });
  ctx.globalAlpha = 1;
}

// The stands, the wall and the sand never move, so they are painted once per screen size and run (the crowd is seeded) and copied each frame.
let bgSpr = null;
function drawBackground(ctx, E) {
  if (!canSprite) { paintBackground(ctx, E); return; }
  const k = Math.min(E.dpr || 1, TUNING.skin.maxDpr), m = 20, bd = artImg(BACKDROP[arena().id]), key = `${E.w}|${E.h}|${k}|${state.seed}|${bd ? `${arena().id}${artV}` : ''}`;
  if (!bgSpr || bgSpr.key !== key) {
    const cv = new OffscreenCanvas(Math.ceil((E.w + 2 * m) * k), Math.ceil((E.h + 2 * m) * k)), c = cv.getContext('2d', { alpha: false });
    c.scale(k, k); c.translate(m, m); paintBackground(c, E);
    bgSpr = { key, cv };
  }
  ctx.drawImage(bgSpr.cv, -m, -m, bgSpr.cv.width / k, bgSpr.cv.height / k);
}
function paintBackground(ctx, E) {
  const L = lay(E), sandTop = L.floor - 0.06 * L.H, wallTop = E.h * 0.2, bd = artImg(BACKDROP[arena().id]);
  // the arena's painted backdrop, scaled to cover, under a dark wash that deepens over the fight band
  if (bd) {
    const A = TUNING.art, s = Math.max((E.w + 40) / bd.width, (E.h + 40) / bd.height), w = bd.width * s, h = bd.height * s;
    ctx.drawImage(bd, (E.w - w) / 2, E.h + 20 - h, w, h);
    ctx.fillStyle = `rgba(16,10,14,${A.wash})`; ctx.fillRect(-20, -20, E.w + 40, E.h + 40);
    const y0 = L.floor - A.band * L.H, g = ctx.createLinearGradient(0, y0, 0, L.floor);
    g.addColorStop(0, 'rgba(16,10,14,0)'); g.addColorStop(0.35, `rgba(16,10,14,${A.bandA})`); g.addColorStop(1, `rgba(16,10,14,${A.bandA * 0.6})`);
    ctx.fillStyle = g; ctx.fillRect(-20, y0, E.w + 40, L.floor - y0 + 20);
    return;
  }
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
// A card's icon: a roundel of radius s at (x, y) ringed in its family's colour (a duo's in gold, a keystone's doubled), with its family's mark,
// or, small, the card's initials so each owned card can be named from the HUD.
function famGlyph(ctx, fam, u) {
  const P = (pts) => { ctx.beginPath(); pts.forEach(([a, b], i) => (i ? ctx.lineTo(a * u, b * u) : ctx.moveTo(a * u, b * u))); ctx.closePath(); ctx.fill(); };
  if (fam === 'wall') P([[-5, -5.5], [5, -5.5], [4.5, 1.5], [0, 6], [-4.5, 1.5]]);
  else if (fam === 'blood') { ctx.beginPath(); ctx.moveTo(0, -6.5 * u); ctx.bezierCurveTo(2 * u, -3 * u, 5 * u, 0, 5 * u, 2 * u); ctx.arc(0, 2 * u, 5 * u, 0, Math.PI); ctx.bezierCurveTo(-5 * u, 0, -2 * u, -3 * u, 0, -6.5 * u); ctx.fill(); }
  else if (fam === 'dancer') { for (const k of [-3.5, 0, 3.5]) { ctx.beginPath(); ctx.moveTo(-6 * u, k * u + 2 * u); ctx.quadraticCurveTo(0, k * u - 4 * u, 6 * u, k * u); ctx.stroke(); } }
  else if (fam === 'brute') { ctx.fillRect(-5 * u, -5.5 * u, 10 * u, 4.5 * u); ctx.fillRect(-1 * u, -1 * u, 2 * u, 7 * u); }
  else if (fam === 'trick') { ctx.beginPath(); ctx.ellipse(0, 0, 6.5 * u, 3.4 * u, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#1a1422'; for (const k of [-1, 1]) { ctx.beginPath(); ctx.ellipse(k * 2.8 * u, -0.3 * u, 1.6 * u, 1.1 * u, 0, 0, TAU); ctx.fill(); } }
  else if (fam === 'show') { for (const k of [-0.55, 0, 0.55]) { ctx.save(); ctx.rotate(k); ctx.beginPath(); ctx.ellipse(0, -2.6 * u, 1.5 * u, 3.6 * u, 0, 0, TAU); ctx.fill(); ctx.restore(); } ctx.fillRect(-2.5 * u, 3 * u, 5 * u, 2.4 * u); }
  else if (fam === 'fin') { for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5, b = a + TAU / 10; P([[0, 0], [Math.cos(a) * 6.5, Math.sin(a) * 6.5], [Math.cos(b) * 2.6, Math.sin(b) * 2.6]]); } }
  else P([[0, -6], [5, 0], [0, 6], [-5, 0]]);
}
function drawIcon(ctx, id, x, y, s) {
  const c = CARD[id], col = c.duo ? DUO_GOLD : FAMS[c.fam].col, u = s / 10;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#1a1422'; ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.2, s * 0.12); ctx.stroke();
  if (c.key) { ctx.beginPath(); ctx.arc(0, 0, s * 0.8, 0, TAU); ctx.lineWidth = Math.max(1, s * 0.06); ctx.stroke(); }
  if (s < 14) { ctx.font = `800 ${Math.round(s * (c.ab.length > 1 ? 0.85 : 1.05))}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = col; ctx.fillText(c.ab, 0, 0.5); }
  else {
    ctx.lineWidth = Math.max(1.2, u * 1.3); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const fams = c.duo || [c.fam];
    fams.forEach((f, i) => { ctx.save(); ctx.fillStyle = ctx.strokeStyle = FAMS[f].col; if (fams.length > 1) { ctx.translate((i ? 3.6 : -3.6) * u, 0); ctx.scale(0.6, 0.6); } famGlyph(ctx, f, u); ctx.restore(); });
  }
  ctx.restore();
}
// A tent ware's icon, in a common's tint: the v1 commons keep their v1 marks
function drawWare(ctx, id, x, y, s) {
  const col = TIER_TINT[0], u = s / 10;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#1a1422'; ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.2, s * 0.12); ctx.stroke();
  ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.2, u * 1.3); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const P = (pts, fill) => { ctx.beginPath(); pts.forEach(([a, b], i) => (i ? ctx.lineTo(a * u, b * u) : ctx.moveTo(a * u, b * u))); if (fill) { ctx.closePath(); ctx.fill(); } else ctx.stroke(); };
  const C = (a, b, r, fill) => { ctx.beginPath(); ctx.arc(a * u, b * u, r * u, 0, TAU); if (fill) ctx.fill(); else ctx.stroke(); };
  if (id === 'hide' || id === 'heart') { ctx.beginPath(); ctx.moveTo(0, 5 * u); ctx.bezierCurveTo(-8 * u, -1 * u, -4 * u, -7 * u, 0, -3 * u); ctx.bezierCurveTo(4 * u, -7 * u, 8 * u, -1 * u, 0, 5 * u); ctx.fill(); }
  else if (id === 'wind') { for (const k of [-3, 0, 3]) { ctx.beginPath(); ctx.moveTo(-5 * u, k * u); ctx.quadraticCurveTo(2 * u, (k - 2.5) * u, 5 * u, k * u); ctx.stroke(); } }
  else if (id === 'wrist') P([[1.5, -6], [-3, 1], [0.5, 1], [-1.5, 6], [3.5, -1], [0, -1]], true);
  else if (id === 'steady') { P([[-5, -5], [5, -5], [5, 1], [0, 6.5], [-5, 1]], true); ctx.strokeStyle = '#1a1422'; P([[-2.5, -1.5], [2.5, -1.5]]); }
  else if (id === 'grip') { ctx.beginPath(); ctx.ellipse(0, 1 * u, 3 * u, 5.5 * u, 0, 0, TAU); ctx.stroke(); line(ctx, -3 * u, -1 * u, 3 * u, -1 * u); line(ctx, -3 * u, 2.5 * u, 3 * u, 2.5 * u); }
  else if (id === 'plate') { ctx.beginPath(); ctx.arc(0, 1 * u, 5.5 * u, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.fillRect(-6.5 * u, 0.5 * u, 13 * u, 2 * u); P([[0, -4.5], [0, -7.5]]); }
  else if (id === 'forge') { P([[0, -7], [1.6, -3], [1.2, 3], [-1.2, 3], [-1.6, -3]], true); ctx.fillRect(-3.5 * u, 3 * u, 7 * u, 1.4 * u); ctx.fillRect(-0.7 * u, 4.4 * u, 1.4 * u, 2.6 * u); }
  else if (id === 'feet') { ctx.beginPath(); ctx.ellipse(1.5 * u, 0, 2.6 * u, 5 * u, 0.3, 0, TAU); ctx.fill(); for (const k of [-3, 0, 3]) P([[-6.5, k], [-3.5, k]]); }
  else if (id === 'deepbreath') { for (const k of [-2.5, 2.5]) { ctx.beginPath(); ctx.ellipse(k * u, 1 * u, 2.4 * u, 4.5 * u, 0, 0, TAU); ctx.stroke(); } P([[0, -6], [0, -2]]); }
  else if (id === 'edge') { P([[-5, 5], [3, -3], [5, -5], [4, -2], [-4, 6]], true); P([[-1, -6], [-1, -3]]); P([[-2.5, -4.5], [0.5, -4.5]]); }
  else if (id === 'tough') { P([[0, -6], [5, -4], [4, 3], [0, 6], [-4, 3], [-5, -4]]); P([[0, -3], [0, 3]]); P([[-3, 0], [3, 0]]); }
  else if (id === 'stance') { P([[-6, 6], [0, -5], [6, 6]]); P([[-7.5, 6], [-4, 6]]); P([[4, 6], [7.5, 6]]); }
  else if (id === 'whet') { ctx.beginPath(); ctx.ellipse(0, 2 * u, 6 * u, 3 * u, 0, 0, TAU); ctx.fill(); P([[-3, -2], [4, -6]]); P([[1, -2], [5, -3]]); }
  else if (id === 'token') { C(0, 0, 6, false); P([[0, -4], [1.2, -1.2], [4, 0], [1.2, 1.2], [0, 4], [-1.2, 1.2], [-4, 0], [-1.2, -1.2]], true); }
  ctx.restore();
}
// short text wrapped to lines of at most n characters
function wrapText(t, n) {
  const out = [];
  for (const w of t.split(' ')) { const l = out.length - 1; if (l >= 0 && (out[l] + ' ' + w).length <= n) out[l] += ' ' + w; else out.push(w); }
  return out;
}
// The draft: the bout's grade and why, Brutus, the gold the bout earned, the grade's odds, and three cards: two free, one priced in gold.
function drawDraft(ctx, E) {
  const d = state.draft, D = TUNING.draft, top = E.safe.top + 18, gc = TIER_COL[d.grade], held = heldFams();
  ctx.fillStyle = 'rgba(10,8,14,0.82)'; ctx.fillRect(0, 0, E.w, E.h);
  const d0 = state.gauntlet[state.rack], who = d0.pair ? `${d0.name.split(/[ ,]/)[0]} AND ${d0.pair.name.split(/[ ,]/)[0]}` : state.foe.name;
  E.text(`${who.toUpperCase()} FELLED  ·  BOUT ${state.rack + 1} OF ${state.gauntlet.length}`, E.w / 2, top, { size: 14, weight: '800', color: '#c4b99a' });
  // the grade, then why in a few words on the same line: "GRADE B · 3 hits · 6 good moves"
  const why = d.tally.good == null ? '' : `  \u00b7  ${d.tally.taken} hit${d.tally.taken === 1 ? '' : 's'}  \u00b7  ${d.tally.good} good move${d.tally.good === 1 ? '' : 's'}`;
  ctx.font = '800 24px system-ui, sans-serif'; const gw = ctx.measureText(`GRADE ${d.grade}`).width;
  ctx.font = '700 14px system-ui, sans-serif'; const ww = ctx.measureText(why).width, gx = (E.w - gw - ww) / 2;
  E.text(`GRADE ${d.grade}`, gx, top + 24, { size: 24, weight: '800', color: gc, align: 'left' });
  if (why) E.text(why, gx + gw, top + 24, { size: 14, weight: '700', color: '#c4b99a', align: 'left' });
  // his line on one line where it fits (the stats, the gold's breakdown, the purse and the deal's odds are on the "?")
  const fw = artImg('brutus-proud') ? TUNING.art.face + 8 : 0, bl = wrapPx(ctx, `Old Brutus: “${brutusWon()}”`, E.w - 32 - E.safe.left - E.safe.right - fw, 14, '700'), ex = (bl.length - 1) * 17;
  sayLines(ctx, E, bl, E.w / 2, top + 50, 17, E.w, { size: 14, weight: '700', color: '#fde68a' }, 'brutus-proud');
  const g = d.gold;
  E.text(g ? `+${g.sum} gold  \u00b7  purse ${state.gold}` : `purse ${state.gold}`, E.w / 2, top + 72 + ex, { size: 14, weight: '700', color: '#fbbf24' });
  const n = d.cards.length, gap = 14, w = Math.min(210, (E.w - 32 - E.safe.left - E.safe.right - gap * (n - 1)) / n), y = top + 88 + ex, h = Math.min(190, E.h - E.safe.bottom - y - 62), x0 = (E.w - (w * n + gap * (n - 1))) / 2;
  const ready = d.t > D.delay;
  d.btns = d.cards.map((c, i) => {
    const x = x0 + i * (w + gap), priced = i === d.priced, price = priceOf(c), short = priced && state.gold < price, col = c.duo ? DUO_GOLD : FAMS[c.fam].col, rc = rarCol(c), old = replaces(c);
    ctx.globalAlpha = !ready ? 0.6 : short ? 0.55 : 1;
    // the border is the rarity's colour; the icon and the bottom line are the family's
    E.roundRect(x, y, w, h, 14, priced ? '#2a2016' : '#221a2b', rc);
    E.roundRect(x + 3, y + 3, w - 6, h - 6, 11, null, priced ? 'rgba(255,210,74,0.55)' : shade(rc, 0.6));
    // everything on the face is 14 px or more. Top: the rarity, and the price (a coin and its gold) on the right. Then the icon if there is room, the effect's
    // name, its plain line, and the footer: the piece, its slot and its family (a line too wide for a narrow card drops its family, then splits)
    const fits = (t, wt) => { ctx.font = `${wt} 14px system-ui, sans-serif`; return ctx.measureText(t).width <= w - 12; };
    const fam = (f) => FAMS[f].name.replace(/^The /, '');
    const foot = c.duo ? `set bonus · ${c.duo.map(fam).join(' + ')}` : c.fam === 'fin' ? `${c.gear} · war paint` : `${c.gear} · ${c.slot} · ${fam(c.fam)}`;
    const bot = [];
    const lines = (t, color) => wrapPx(ctx, t, w - 12, 14, '700').forEach((q) => bot.push([q, color, 700]));
    if (old) { const t = `replaces ${old.gear}`; if (fits(t, 700)) bot.push([t, '#fb923c', 700]); else if (fits(`drops ${old.gear}`, 700)) bot.push([`drops ${old.gear}`, '#fb923c', 700]); else lines(t, '#fb923c'); }
    const opts = c.duo ? [foot, c.duo.map(fam).join(' + ')] : c.fam === 'fin' ? [foot, c.gear] : [foot, `${c.gear} \u00b7 ${c.slot}`, c.gear], at = opts.find((t) => fits(t, 700));
    if (at) bot.push([at, col, 700]); else lines(opts[opts.length - 1], col);
    const cl = cardLine(c), ls = wrapPx(ctx, cl, w - 12, 14, '600'), fy = y + h - 12 - (bot.length - 1) * 16;
    // the icon takes what height is left between the plain line and the footer
    const nsz = fitSize(ctx, c.name, 19, w - 12), nl = wrapPx(ctx, c.name, w - 12, nsz, '800'), xn = (nl.length - 1) * 16;
    const slack = fy - 10 - (y + 36 + xn + 22 + (ls.length - 1) * 16 + 8), r = Math.min(22, slack / 2 - 2), ir = r >= 9 ? r : 0, ny = y + 36 + (ir ? 2 * ir + 4 : 0);
    const rar = c.duo ? 'SET BONUS' : c.fam === 'fin' ? 'WAR PAINT' : c.key ? 'KEYSTONE' : TIERS[c.tier];
    E.text(rar, x + 10, y + 14, { size: 14, weight: '800', align: 'left', color: rc });
    if (priced) {
      E.text(`${price}`, x + w - 10, y + 14, { size: 14, weight: '800', align: 'right', color: short ? '#9aa4b2' : '#ffd24a' });
      ctx.font = '800 14px system-ui, sans-serif'; drawCoin(ctx, x + w - 10 - ctx.measureText(`${price}`).width - 11, y + 14, 6);
    }
    if (ir) drawIcon(ctx, c.id, x + w / 2, y + 28 + ir, ir);
    nl.forEach((q, k) => E.text(q, x + w / 2, ny + k * 16, { size: nsz, weight: '800', color: '#f0e6cc' }));
    ls.forEach((s2, k) => E.text(s2, x + w / 2, ny + xn + 22 + k * 16, { size: 14, weight: '600', color: '#cbd5e1' }));
    bot.forEach(([t, color, wt], k) => E.text(t, x + w / 2, fy + k * 16, { size: 14, weight: String(wt), color }));
    ctx.globalAlpha = 1;
    return { x, y, w, h, card: c };
  });
  const by = Math.min(E.h - E.safe.bottom - 30, y + h + 32);
  // the token's state is drawn (lit or grey); its count is written only when there are two or more
  d.reroll = tokenButton(E, 'Reroll', E.w / 2 - 30, by, state.token, true, state.token > 1 ? `${state.token} left` : '');
  d.help = { x: E.w / 2 + 66, y: by - 24, w: 48, h: 48 };
  E.roundRect(d.help.x, d.help.y, 48, 48, 24, '#1f2937', '#c4b99a');
  E.text('?', d.help.x + 24, by, { size: 22, weight: '800', color: '#f0e6cc' });
  // the spoils, left of "Pick one": take his weapon, or keep yours
  d.spoilBtn = null;
  if (d.spoil) {
    const S = d.spoil, lab = S.took ? `Keep your ${spoilName(S.mine[0], S.mine[1])}` : `Take ${S.her ? 'her' : 'his'} ${spoilName(S.w, S.mace)}`;
    const right = E.w / 2 - 127, left = E.safe.left + 12, fs = fitSize(ctx, lab, 16, right - left - 20), tw = (ctx.font = `800 ${fs}px system-ui, sans-serif`, ctx.measureText(lab).width);
    const bw = Math.min(right - left, Math.max(120, tw + 24)), b = { x: right - bw, y: by - 22, w: bw, h: 44 };
    ctx.globalAlpha = ready ? 1 : 0.5;
    E.roundRect(b.x, b.y, b.w, b.h, 12, S.took ? '#3a2a14' : '#5a3a12', S.took ? '#c4b99a' : '#fbbf24');
    E.text(lab, b.x + b.w / 2, by, { size: fs, weight: '800', color: S.took ? '#e2d6b8' : '#fde68a' });
    ctx.globalAlpha = 1;
    d.spoilBtn = b;
  }
  if (d.helpOn === 1) drawCardHelp(ctx, E, d.cards); else if (d.helpOn === 2) drawDealHelp(ctx, E, held, d.odds); else if (d.helpOn) drawBoutHelp(ctx, E, d);
}
// The "?", first page: each card in this draft with its plain line and, under it, its exact numbers
function drawCardHelp(ctx, E, cards) {
  const w = Math.min(E.w - 32, 620), x = (E.w - w) / 2, tw = w - 72, rows = cards.map((c) => ({ c, ls: wrapPx(ctx, cardLine(c), tw, 14, '600'), ns: wrapPx(ctx, cardNums(c), tw, 14, '600') }));
  const hs = rows.map((q) => 22 + 16 * (q.ls.length + q.ns.length)), h = Math.min(E.h - 16, 58 + hs.reduce((a2, b2) => a2 + b2, 0)), y = (E.h - h) / 2;
  ctx.fillStyle = 'rgba(10,8,14,0.7)'; ctx.fillRect(0, 0, E.w, E.h);
  E.roundRect(x, y, w, h, 16, '#221a2b', '#e6c866');
  E.text('WHAT THESE CARDS DO', E.w / 2, y + 18, { size: 14, weight: '800', color: '#c4b99a' });
  let ry = y + 34;
  rows.forEach(({ c, ls, ns }, i) => {
    drawIcon(ctx, c.id, x + 30, ry + 14, 13);
    E.text(c.name, x + 54, ry + 8, { size: 14, weight: '800', align: 'left', color: c.duo ? DUO_GOLD : FAMS[c.fam].col });
    ls.forEach((t, k) => E.text(t, x + 54, ry + 24 + k * 16, { size: 14, weight: '600', align: 'left', color: '#e2e8f0' }));
    ns.forEach((t, k) => E.text(t, x + 54, ry + 24 + (ls.length + k) * 16, { size: 14, weight: '600', align: 'left', color: '#fde68a' }));
    ry += hs[i];
  });
  E.text('Tap for how the deal works', E.w / 2, y + h - 14, { size: 14, weight: '800', color: '#ffd24a' });
}
// What the next grade up needs, for the "?" page; nothing after an S
function nextUp(g) {
  const up = { C: 'B', B: 'A', A: 'S' }[g];
  if (!up) return '';
  const n = hitsAllowed(up);
  return `${up}: at most ${n} hit${n === 1 ? '' : 's'} and ${TUNING.grade[up].good} good moves.`;
}
// The "?", third page: what the grade card used to carry: the bout's counts, the gold and where it came from, the purse, the deal's odds, your gear and
// what the fight's bars are called
function drawBoutHelp(ctx, E, d) {
  const w = Math.min(E.w - 32, 620), x = (E.w - w) / 2, tw = w - 28, t = d.tally, o = TUNING.draft.odds[d.grade], pct = o.map((v) => Math.round(v / (o[0] + o[1]) * 100)), g = d.gold;
  const thrown = g ? g.items.filter((e) => e[0] !== 'fell') : [], tsum = thrown.reduce((a2, e) => a2 + e[1], 0);
  const rows = [
    [`${t.slot} gap hits  \u00b7  ${t.read} fakes spotted  \u00b7  ${t.pun} punishes  \u00b7  ${t.taken} hits taken`, '#e2e8f0'],
    ...(g ? [[`+${g.sum} gold (fell ${g.sum - tsum}${tsum ? `, the crowd threw ${tsum}: ${thrown.map((e) => `${e[0]} ${e[1]}`).join(', ')}` : ''})`, '#fbbf24']] : []),
    [`Purse ${state.gold}  \u00b7  Grade ${d.grade}: Common ${pct[0]}% \u00b7 Rare ${pct[1]}%`, '#fbbf24'],
    ...(nextUp(d.grade) ? [[nextUp(d.grade), '#fde68a']] : []),
    [`Reroll: ${state.token > 0 ? `${state.token} left` : 'used'}`, '#c4b5fd'],
  ].flatMap(([q, col]) => wrapPx(ctx, q, tw, 14, '700').map((l) => [l, col]));
  const bars = wrapPx(ctx, 'The bars under your hearts: gold diamonds are Momentum, green is stamina, tan is your shield.', tw, 14, '600');
  const n = state.picks.length, gear = n ? 28 : 0, h = 52 + 18 * rows.length + gear + 8 + 18 * bars.length + 12, y = (E.h - h) / 2;
  ctx.fillStyle = 'rgba(10,8,14,0.7)'; ctx.fillRect(0, 0, E.w, E.h);
  E.roundRect(x, y, w, h, 16, '#221a2b', '#e6c866');
  E.text('THIS BOUT', E.w / 2, y + 18, { size: 14, weight: '800', color: '#c4b99a' });
  let ry = y + 42;
  rows.forEach(([l, col]) => { E.text(l, x + 14, ry, { size: 14, weight: '700', align: 'left', color: col }); ry += 18; });
  if (n) {
    ctx.font = '800 14px system-ui, sans-serif';
    const lw = ctx.measureText('Your gear:').width + 10, ip = Math.min(24, (tw - lw) / n);
    E.text('Your gear:', x + 14, ry + 10, { size: 14, weight: '800', align: 'left', color: '#c4b99a' });
    state.picks.forEach((id, i) => drawIcon(ctx, id, x + 14 + lw + ip * i + ip / 2, ry + 10, Math.min(9, ip / 2 - 1)));
    ry += gear;
  }
  ry += 8;
  bars.forEach((l) => { E.text(l, x + 14, ry, { size: 14, weight: '600', align: 'left', color: '#cbd5e1' }); ry += 18; });
  E.text('Tap to close', E.w / 2, y + h - 12, { size: 14, weight: '800', color: '#ffd24a' });
}
const ODDS_NAME = { set: 'Set', 3: 'Legendary', 2: 'Epic', 1: 'Rare', 0: 'Common' };
// The "?": how the deal works, the families you hold, and the duos with what each needs: the ones you can be dealt first, then those sharing a family you
// wear, as many as fit the screen (the rest counted on the last line)
function drawDealHelp(ctx, E, held, odds = []) {
  const near = (c) => c.duo.filter((f) => held[f]).length, all = DECK.filter((c) => c.duo && cardOpen(state.me, c)).sort((a, b) => near(b) - near(a));
  const w = Math.min(E.w - 32, 620), G = wornGear(), wl = SLOT_NAMES.filter((k) => G[k]).map((k) => `${k} ${G[k].gear}`).join(' · ');
  // the gear line wraps to up to three lines (the last clipped); each duo row is its name, then its line wrapped at 14 px
  const wrapped = wl ? wrapPx(ctx, wl, w - 24, 14, '600') : [], gl = wrapped.length > 3 ? [...wrapped.slice(0, 2), clipLine(ctx, `${wrapped.slice(2).join(' ')}`, w - 24, 14, '600')] : wrapped;
  const top = 136 + Math.max(0, gl.length - 1) * 16, avail = E.h - 16 - (top + 22 + 36), rows = [];
  let used = 0;
  for (const c of all) {
    const ls = wrapPx(ctx, c.line, w - 64, 14, '600'), rh = 16 * (1 + ls.length) + 8;
    if (rows.length && used + rh > avail) break;
    rows.push({ c, ls, rh, ty: top + 22 + used }); used += rh;
  }
  const more = all.length - rows.length, last = rows[rows.length - 1], h = Math.min(E.h - 16, rows.length ? last.ty + 16 * last.ls.length + 8 + 28 : top + 40), y = (E.h - h) / 2, x = (E.w - w) / 2;
  ctx.fillStyle = 'rgba(10,8,14,0.7)'; ctx.fillRect(0, 0, E.w, E.h);
  E.roundRect(x, y, w, h, 16, '#221a2b', '#e6c866');
  E.text('HOW THE DEAL WORKS', E.w / 2, y + 18, { size: 14, weight: '800', color: '#c4b99a' });
  const ol = `The gold card: ${odds.map(([t, p]) => `${ODDS_NAME[t]} ${p}%`).join(' · ') || 'nothing left to deal'}`;
  E.text(ol, E.w / 2, y + 40, { size: fitSize(ctx, ol, 15, w - 24), weight: '800', color: '#ffd24a' });
  const rules = [`Families you wear come ${TUNING.draft.pull}x as often; at most ${TUNING.draft.perFam} of one family a draft.`, 'One piece per body part: a new piece replaces the old one.', 'A set bonus is dealt while you wear a piece of both its families.'];
  rules.forEach((t, i) => E.text(t, E.w / 2, y + 62 + i * 17, { size: fitSize(ctx, t, 13, w - 24, '600'), color: '#f0e6cc' }));
  const hl = Object.keys(FAMS).filter((f) => held[f]).map((f) => `${FAMS[f].name} ${held[f]}`).join('  ·  ');
  E.text(`You wear: ${hl || 'no family yet'}`, E.w / 2, y + 118, { size: 14, weight: '800', color: '#86efac' });
  gl.forEach((t, k) => E.text(t, E.w / 2, y + 136 + k * 16, { size: 14, weight: '600', color: '#cbd5e1' }));
  rows.forEach(({ c, ls, ty }) => {
    const ry = y + ty, ok = c.duo.every((f) => held[f]);
    drawIcon(ctx, c.id, x + 30, ry + 8, 13);
    E.text(titleOf(c), x + 50, ry, { size: 14, weight: '800', align: 'left', color: ok ? DUO_GOLD : '#9aa4b2' });
    E.text(`${c.duo.map((f) => FAMS[f].name).join(' + ')}${ok ? '  \u00b7  can be dealt' : ''}`, x + w - 14, ry, { size: 14, weight: '700', align: 'right', color: ok ? '#86efac' : '#8a8f99' });
    ls.forEach((t, k) => E.text(t, x + 50, ry + 16 + k * 16, { size: 14, weight: '600', align: 'left', color: '#cbd5e1' }));
  });
  E.text(more ? `Tap for this bout  \u00b7  ${more} more set${more === 1 ? '' : 's'}` : 'Tap for this bout', E.w / 2, y + h - 12, { size: 14, weight: '800', color: '#ffd24a' });
}
// A card whose rule needs his weapon reads differently when the next bout has a beast in it (a beast has no weapon to lose: it is stunned instead)
const BEAST_LINE = {
  disarm: `${TUNING.fin.disarm} Momentum: a beast has no weapon, so it is stunned instead.`,
  thorns: `Each block chips. ${TUNING.cards.thorns} chips and a beast is stunned.`,
  matador: 'Dodge a stab, bash, pounce or shove and he stumbles, stunned.',
  heavy: 'A beast wears no armour.',
  brawler: 'A beast wears no armour.',
  breaker: 'A beast wears no armour.',
  butcher: 'A beast wears no armour.',
};
function cardLine(c) {
  const d = state.gauntlet && state.gauntlet[state.draft || state.tent ? state.rack + 1 : state.rack];
  return BEAST_LINE[c.id] && d && (d.beast || (d.pair && d.pair.beast)) ? BEAST_LINE[c.id] : c.line;
}
// The armourer's tent: your purse, three wares to buy (tap one), and Skip (Leave once you have bought)
function drawTent(ctx, E) {
  const tt = state.tent, top = E.safe.top + 20, ready = tt.t > TUNING.draft.delay;
  ctx.fillStyle = 'rgba(10,8,14,0.86)'; ctx.fillRect(0, 0, E.w, E.h);
  E.text("THE ARMOURER'S TENT", E.w / 2, top, { size: 22, weight: '800', color: '#e6c866' });
  sayLine(ctx, E, 'Old Brutus: “Spend it here. Gold buys nothing in the sand.”', E.w / 2, top + 26, E.w - 32, { size: 14, weight: '700', color: '#fde68a' }, 'brutus');
  E.text(`Your purse: ${state.gold} gold`, E.w / 2, top + 50, { size: 16, weight: '800', color: '#fbbf24' });
  const n = tt.wares.length, gap = 14, w = Math.min(200, (E.w - 32 - E.safe.left - E.safe.right - gap * (n - 1)) / n), y = top + 68, h = Math.min(170, E.h - E.safe.bottom - y - 70), x0 = (E.w - (w * n + gap * (n - 1))) / 2;
  tt.btns = tt.wares.map((wr, i) => {
    const x = x0 + i * (w + gap), short = !wr.sold && state.gold < wr.price, r = Math.min(24, h * 0.14);
    ctx.globalAlpha = !ready ? 0.6 : short ? 0.5 : 1;
    E.roundRect(x, y, w, h, 14, wr.sold ? '#1d2a22' : '#2a2016', wr.sold ? '#4ade80' : '#c4b99a');
    drawWare(ctx, wr.id, x + w / 2, y + 14 + r, r);
    const ly = y + 30 + 2 * r;
    E.text(wr.name, x + w / 2, ly, { size: fitSize(ctx, wr.name, 17, w - 16), weight: '800', color: '#f0e6cc' });
    wrapPx(ctx, wr.line, w - 16, 14, '600').slice(0, 3).forEach((s2, k) => E.text(s2, x + w / 2, ly + 21 + k * 16, { size: 14, weight: '600', color: '#cbd5e1' }));
    E.text(wr.sold ? 'BOUGHT' : `${wr.price} gold`, x + w / 2, y + h - 14, { size: 14, weight: '800', color: wr.sold ? '#4ade80' : short ? '#9aa4b2' : '#ffd24a' });
    ctx.globalAlpha = 1;
    return { x, y, w, h, ware: wr };
  });
  const any = tt.wares.some((q) => q.sold);
  tt.skip = E.button(any ? 'Leave' : 'Skip', E.w / 2, Math.min(E.h - E.safe.bottom - 30, y + h + 34), { w: 170, h: 48, size: 18, fill: any ? '#b45309' : '#334155' });
}
// ----- the card lab (dev channel only): hold any cards before a bout, start it with full Momentum, add gold -----
const labTab = (E) => ({ x: E.w - E.safe.right - 82, y: E.safe.top + 4, w: 72, h: 44 });
function labLayout(E) {
  const cols = 9, gap = 4, x0 = 16 + E.safe.left, top = E.safe.top + 34, cw = (E.w - 32 - E.safe.left - E.safe.right - gap * (cols - 1)) / cols, rows = Math.ceil(DECK.length / cols);
  const ch = Math.max(44, Math.min(52, (E.h - E.safe.bottom - top - 64) / rows - gap));
  const cells = DECK.map((c, i) => ({ c, x: x0 + (i % cols) * (cw + gap), y: top + Math.floor(i / cols) * (ch + gap), w: cw, h: ch }));
  const by = Math.min(E.h - E.safe.bottom - 28, top + rows * (ch + gap) + 28), bw = Math.min(150, (E.w - 64) / 4);
  const btn = (k, i, label) => ({ k, label, x: E.w / 2 + (i - 1.5) * (bw + 10) - bw / 2, y: by - 22, w: bw, h: 44 });
  return { cells, btns: [btn('mom', 0, state.labMom ? 'Full Momentum: on' : 'Full Momentum: off'), btn('gold', 1, '+100 gold'), btn('clear', 2, 'Clear'), btn('done', 3, 'Done')] };
}
function drawLab(ctx, E) {
  const L = labLayout(E);
  ctx.fillStyle = 'rgba(10,8,14,0.92)'; ctx.fillRect(0, 0, E.w, E.h);
  E.text(`CARD LAB (dev)  ·  tap cards to hold them  ·  ${state.picks.length} held  ·  ${state.gold} gold`, E.w / 2, E.safe.top + 16, { size: 13, weight: '800', color: '#f5d0fe' });
  for (const q of L.cells) {
    const on = has(q.c.id), col = q.c.duo ? DUO_GOLD : FAMS[q.c.fam].col;
    E.roundRect(q.x, q.y, q.w, q.h, 8, on ? 'rgba(232,121,249,0.35)' : 'rgba(34,26,43,0.9)', on ? '#f5d0fe' : col);
    // the name at 14 px: one line with its family under it, else two lines (a word too wide for the cell is clipped)
    const nc = on ? '#ffffff' : '#f0e6cc', cx = q.x + q.w / 2, cy = q.y + q.h / 2, one = wrapPx(ctx, q.c.name, q.w - 8, 14, '800');
    ctx.font = '800 14px system-ui, sans-serif';
    const lines = one.length === 1 && ctx.measureText(one[0]).width <= q.w - 8 ? one : one.map((t) => { let r = t; while (r.length > 2 && ctx.measureText(r).width > q.w - 8) r = `${r.slice(0, -2)}\u2026`; return r; }).slice(0, 2);
    if (lines.length === 1) {
      E.text(lines[0], cx, cy - 6, { size: 14, weight: '800', color: nc });
      E.text(q.c.duo ? 'duo' : q.c.key ? 'keystone' : FAMS[q.c.fam].name.replace('The ', ''), cx, cy + 9, { size: 10, weight: '700', color: col });
    } else lines.forEach((t, k) => E.text(t, cx, cy - 8 + k * 16, { size: 14, weight: '800', color: nc }));
  }
  for (const b of L.btns) { E.roundRect(b.x, b.y, b.w, b.h, 10, b.k === 'done' ? '#b45309' : '#1f2937', '#c4b99a'); E.text(b.label, b.x + b.w / 2, b.y + b.h / 2, { size: fitSize(ctx, b.label, 15, b.w - 10), weight: '800', color: '#f0e6cc' }); }
}
function labTap(E, p) {
  const L = labLayout(E), q = L.cells.find((r) => E.hit(r, p)), b = L.btns.find((r) => E.hit(r, p));
  if (q) applyCard(q.c, !has(q.c.id));
  else if (b && b.k === 'mom') state.labMom = !state.labMom;
  else if (b && b.k === 'gold') state.gold += 100;
  else if (b && b.k === 'clear') for (const id of state.picks.slice()) applyCard(CARD[id], false);
  else if (b && b.k === 'done') { state.lab = null; saveRun(E); }
  E.audio.play('tap');
}
// The run's one token: Respin on the fighter card, Reroll on a draft. Lit with "1 left" while it is unspent, grey once spent (a draft's Reroll writes the count only from two up; the "?" has it).
function tokenButton(E, label, cx, cy, n, on = true, sub = null) {
  const left = n > 0, live = left && on, w = 170, h = 48, x = cx - w / 2, y = cy - h / 2;
  E.roundRect(x, y, w, h, 14, live ? '#7c3aed' : left ? '#3b2d55' : '#2a2a30', live ? '#c4b5fd' : 'rgba(160,160,170,0.35)');
  const sl = sub === '' ? '' : sub || (left ? `${n} left` : 'used');
  E.text(label, cx, sl ? cy - 8 : cy, { size: 17, weight: '800', color: live ? '#ffffff' : '#8a8f99' });
  if (sl) E.text(sl, cx, cy + 13, { size: 14, weight: '700', color: live ? '#ede9fe' : '#6b7280' });
  return { x, y, w, h, live };
}

// ----- fighter cards: the intro before each bout, and the row on the end card -----
const WEAPON_TIP = { gladius: 'fast, loves combos', spear: 'long thrusts, keeps range', axe: 'big smashes crack shields', dagger: 'rushes in, nets slow you' };
// A little body with his plates (grey) and open joint slots (dark), at scale s px per body unit, feet at (x, y). With the kit on and str given (his
// Strength), the painted body of his muscle tier is the body, and each plated part wears its painted piece as in the fight (step 6e): a plated head
// his type's painted helmet (gm: his GTYPE's helm), the chest plate (its lower half on a plated belly), the manica, the greaves; his gaps and guards
// are painted as a painted man's (kitSlot, kitGuard). No flat box or circle is drawn over the painted body.
function kitIcon(ctx, parts, s, str, gm) {
  const K = TUNING.kit, t = kitTier(str), on = (id) => parts.some((q) => q.d.id === id && q.armour), head = parts.find((q) => q.d.id === 'head'), hk = KIT_HELM[gm] || 'gallic';
  const kh = on('head') && artPic(`kit-helmet-${hk}`, K.helm[hk]), Hd = kitPic('head'), T = kitPic('torso', t), U = kitPic('upperarm', t), F = kitPic('forearm', t), Th = kitPic('thigh', t), Sh = kitPic('shin', t);
  if (!Hd || !T || !U || !F || !Th || !Sh) return false;
  const hx = (head ? head.d.x : 0) * s, G = on('legs') && gearPic('greave'), PL = gearPic('plate'), M = gearPic('manica'), B = PARTS[pidx('belly')], bw = B.w * s;
  LEGS.forEach(([hip, knee, ank]) => {
    const P = (q) => [q[0] * s, q[1] * s];
    drawSeg(ctx, Th, P(hip), P(knee), K.leg * s); drawSeg(ctx, Sh, P(knee), P(ank), K.leg * s);
    if (G) drawSeg(ctx, G, P(lerp2(knee, ank, G.J.from)), P(lerp2(knee, ank, G.J.to)), K.leg * s);
  });
  kitTorso(ctx, T, K.neck * s, K.belt * s, bw);
  // the plate cut at the waist as the fight cuts it into the chest's and the belly's sprites
  for (const id of PL ? ['chest', 'belly'] : []) {
    if (!on(id)) continue;
    const big = 4 * s, cut = K.cut * s;
    ctx.save(); ctx.beginPath(); if (id === 'chest') ctx.rect(-big, cut - big, 2 * big, big); else ctx.rect(-big, cut, 2 * big, big); ctx.clip();
    torsoPlate(ctx, PL, s, bw * T.J.k, id === 'belly', (B.y + B.h / 2) * s);
    ctx.restore();
  }
  if (!(kh && kh.J.closed)) drawSeg(ctx, Hd, [hx, K.top * s], [hx, K.chin * s], 0);
  if (kh) drawSeg(ctx, kh, [hx, K.top * s], [hx, K.chin * s], 0);
  for (const q of parts) {
    const p = q.d;
    if (p.id !== 'armF' && p.id !== 'armB') continue;
    const j = p.joint, el = ARM_LEN / 2 * s, x0 = (j[0] + (p.id === 'armF' ? 0.11 : -0.11)) * s;
    ctx.save(); ctx.translate(x0, j[1] * s);
    drawSeg(ctx, U, [0, 0], [0, el], p.w * s); drawSeg(ctx, F, [0, el], [0, ARM_LEN * s], p.w * s);
    if (q.armour && M) drawSeg(ctx, M, [0, el], [0, el + (ARM_LEN * s - el) * M.J.to], p.w * s);
    ctx.restore();
  }
  for (const q of parts) {
    if (!q.slot) continue;
    const j = q.d.frame ? PARTS[pidx(q.d.frame)].joint : [0, 0];
    ctx.save(); ctx.translate((j[0] + (q.d.frame === 'armF' ? 0.11 : 0)) * s, j[1] * s);
    if (!q.guard) kitSlot(ctx, q, s); else if (!kitGuard(ctx, q, s)) paintGuard(ctx, q, s, {});
    ctx.restore();
  }
  return true;
}
// the painted figure, painted once into a sprite per look, size, screen and art version, so a card blits it each frame; null until its art loads
const ICONS = new Map();
function kitIconSprite(E, parts, s, str, gm) {
  const k = Math.min(E.dpr || 1, TUNING.skin.maxDpr), B = TUNING.kit.iconBox;
  const key = `${s}|${kitTier(str)}|${gm}|${k}|${artV}|${parts.map((q) => `${q.d.id}${q.armour ? 1 : 0}${q.guard ? 'g' : ''}`).join(',')}`;
  let sp = ICONS.get(key);
  if (!sp) {
    const x = B[0] * s, y = B[1] * s, w = (B[2] - B[0]) * s, h = (B[3] - B[1]) * s, cv = new OffscreenCanvas(Math.ceil(w * k), Math.ceil(h * k)), c = cv.getContext('2d');
    c.imageSmoothingQuality = 'high'; c.scale(k, k); c.translate(-x, -y);
    if (!kitIcon(c, parts, s, str, gm)) return null;
    sp = { cv, x, y, w, h };
    if (ICONS.size > 24) ICONS.clear();
    ICONS.set(key, sp);
  }
  return sp;
}
function armourIcon(ctx, E, parts, x, y, s, str = 0, gm = null) {
  ctx.save(); ctx.translate(x, y);
  if (str && kitOn()) {
    const sp = canSprite && kitIconSprite(E, parts, s, str, gm);
    if (sp) ctx.drawImage(sp.cv, sp.x, sp.y, sp.w, sp.h);
    if (sp || (!canSprite && kitIcon(ctx, parts, s, str, gm))) { ctx.restore(); return; }
  }
  for (const q of parts) {
    const p = q.d, j = p.joint || (p.frame ? PARTS[pidx(p.frame)].joint : [0, 0]);
    const side = p.id === 'armF' || p.frame === 'armF' ? 0.11 : p.id === 'armB' ? -0.11 : 0, cx = (j[0] + p.x + side) * s, cy = (j[1] + p.y) * s;
    ctx.beginPath();
    if (p.shape === 'circle') ctx.arc(cx, cy, p.r * s, 0, 6.28);
    else ctx.rect(cx - p.w * s / 2, cy - p.h * s / 2, p.w * s, p.h * s);
    ctx.fillStyle = q.guard ? '#e6c866' : q.slot ? '#0b0705' : q.armour ? '#aab3bc' : '#b9835a'; ctx.fill();
    ctx.strokeStyle = q.guard ? '#7a5a14' : q.slot ? 'rgba(255,214,150,0.7)' : '#2a1c10'; ctx.lineWidth = 1; ctx.stroke();
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
// his pieces that act for him (TUNING.foeGear) and what each does, shown red on his intro card; the rest are a look
const FOE_TELL = {
  thorns: () => `hitting his guard costs you ${TUNING.foeGear.thorns} stamina`, bloodlust: () => `a blow of his that lands gives him ${TUNING.foeGear.bloodlust} stamina`,
  riposte: () => 'he counters a blow that hits his guard', unbreak: () => 'he shrugs off your first hit each bout',
  myfeint: () => `he fakes ${TUNING.foeGear.hood}x as often`, mindreader: () => 'he learns your habits from the first exchange',
};
// A rival's taunt: the noun of your origin, or your village on a revenge run.
const tauntOf = (me) => (me.reason === 'revenge' ? 'I remember your village.' : me.reason === 'promise' ? 'Back for your sister again?' : `You again, little ${ORIGINS[me.origin].noun}?`);
// the reason's thread on his card: the debt left, the notches on the wooden sword, or the crowd's banner (revenge climbs in Brutus's lines instead)
function drawThread(ctx, E, cx, cy, w) {
  const me = state.me, n = state.felled;
  if (me.reason === 'debt') E.text(`The debt: ${denarii(debtLeft())} denarii`, cx, cy, { size: 15, weight: '800', color: '#fbbf24' });
  else if (me.reason === 'freedom') {
    const t = n ? `Wooden sword: ${n} notch${n === 1 ? '' : 'es'}` : 'Wooden sword: no notches yet', sw = 72;
    ctx.font = '800 14px system-ui, sans-serif';
    const x0 = cx - (sw + 12 + ctx.measureText(t).width) / 2;
    woodSword(ctx, x0, cy, sw, n);
    E.text(t, x0 + sw + 12, cy, { size: 14, weight: '800', align: 'left', color: '#e6c866' });
  } else if (me.reason === 'promise') {
    // her door: a key, and the fights still between you and it
    const left = Math.max(0, state.gauntlet.length - n), t = left > 1 ? `Your sister: ${left} fights to her door` : 'Your sister: the last door', kw = 30;
    ctx.font = '800 14px system-ui, sans-serif';
    const x0 = cx - (kw + 10 + ctx.measureText(t).width) / 2;
    keyIcon(ctx, x0, cy, kw);
    E.text(t, x0 + kw + 10, cy, { size: 14, weight: '800', align: 'left', color: '#c4b5fd' });
  } else if (me.reason === 'glory') {
    const k = chantN(), t = Array(k).fill(`${me.name.toUpperCase()}!`).join('  '), bw = w - 48, bh = 26;
    ctx.fillStyle = '#7f1d1d'; ctx.fillRect(cx - bw / 2, cy - bh / 2, bw, bh);
    ctx.fillStyle = '#e6c866'; ctx.fillRect(cx - bw / 2, cy - bh / 2, bw, 3); ctx.fillRect(cx - bw / 2, cy + bh / 2 - 3, bw, 3);
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + sx * bw / 2, cy - bh / 2); ctx.lineTo(cx + sx * (bw / 2 + 12), cy - bh / 2); ctx.lineTo(cx + sx * (bw / 2 + 4), cy); ctx.lineTo(cx + sx * (bw / 2 + 12), cy + bh / 2); ctx.lineTo(cx + sx * bw / 2, cy + bh / 2); ctx.closePath(); ctx.fillStyle = '#5f1515'; ctx.fill(); }
    E.text(t, cx, cy + 1, { size: fitSize(ctx, t, 13 + 2 * (k - 1), bw - 16), weight: '800', color: '#fde68a' });
  }
}
// the key to her door, lying flat: a ring bow, the shaft and its bit
function keyIcon(ctx, x, y, len) {
  ctx.save(); ctx.strokeStyle = '#e6c866'; ctx.fillStyle = '#e6c866'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x + len * 0.15, y, len * 0.15, 0, TAU); ctx.stroke();
  line(ctx, x + len * 0.3, y, x + len, y); ctx.fillRect(x + len * 0.78, y, len * 0.08, len * 0.22); ctx.fillRect(x + len * 0.92, y, len * 0.08, len * 0.16);
  ctx.restore();
}
// the wooden sword of freedom, lying flat, with a notch for each fell
function woodSword(ctx, x, y, len, n) {
  ctx.fillStyle = '#8a5a2b'; ctx.fillRect(x, y - 4, len * 0.72, 8);
  ctx.beginPath(); ctx.moveTo(x + len * 0.72, y - 4); ctx.lineTo(x + len * 0.8, y); ctx.lineTo(x + len * 0.72, y + 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5e3e1e'; ctx.fillRect(x - 4, y - 9, 5, 18); ctx.fillRect(x - len * 0.2, y - 3, len * 0.2 - 4, 6);
  ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = 2;
  for (let i = 0; i < n; i++) line(ctx, x + 10 + i * 9, y - 4, x + 13 + i * 9, y + 1);
}
// the font size that fits a line into w px, never larger than size
function fitSize(ctx, t, size, w, weight = '800') {
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  return Math.max(14, Math.floor(size * Math.min(1, w / ctx.measureText(t).width)));
}
// text wrapped to lines no wider than w px at this font
function wrapPx(ctx, t, w, size, weight = '600') {
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  const out = [];
  for (const word of t.split(' ')) { const l = out.length - 1; if (l >= 0 && ctx.measureText(`${out[l]} ${word}`).width <= w) out[l] += ` ${word}`; else out.push(word); }
  return out;
}
// a champion's portrait in his card's top-left corner, beside his name and tie; returns the width it takes (0 with no portrait), which the centred
// title rows keep clear of on both sides
function champBust(ctx, E, d, x, y) {
  const pic = champPic(d), [bw, bh, g] = TUNING.art.bust;
  return pic && drawPic(ctx, E, pic, [0, 0, 1, 1], x + g, y + g, bw, bh, '#ffd24a') ? bw + g : 0;
}
// His card before each bout, in rows that never meet: the bout, his name and (champion) his tie to your reason, his armour on the left, size, weapon,
// its tip and stats on the right, your reason's thread, Brutus, what the champion or your rival says, and the tap.
function drawIntro(ctx, E) {
  if (state.edge) { drawPairIntro(ctx, E); return; }
  if (state.foe.beast) { drawBeastIntro(ctx, E); return; }
  const d = state.foe, me = state.me, champ = d.champion, spar = bout().spar;
  const voice = d.rival ? tauntOf(me) : champ ? champLine(d, me.reason) : null, sub = champ ? champTie(d, me.reason) : spar ? 'Sparring: learn his wind-ups.' : null;
  const gear = (d.gear || []).map((id) => CARD[id]), thread = me.reason !== 'revenge', b = sub ? 88 : 68, bodyH = 152 + ((d.guards || []).length ? 12 : 0), tb = b + bodyH + (thread ? 32 : 6);
  const second = state.rack === 0 && !voice;
  const w = Math.min(E.w - 32, (gear.length ? 640 : 460) + (artImg('brutus') ? TUNING.art.face + 8 : 0)), h = Math.min(E.h - 12, tb + 22 + (voice || second ? 22 : 0) + 34 + cardGrow()), x = (E.w - w) / 2, y = (E.h - h) / 2, cx = E.w / 2;
  ctx.fillStyle = 'rgba(10,8,14,0.6)'; ctx.fillRect(0, 0, E.w, E.h);
  E.roundRect(x, y, w, h, 18, '#221a2b', d.rival ? '#f87171' : champ ? '#ffd24a' : '#e6c866');
  const of = `BOUT ${state.rack + 1} OF ${state.gauntlet.length}`;
  E.text(d.rival ? `YOUR RIVAL  ·  THE CHAMPION  ·  ${of}` : champ ? `THE CHAMPION  ·  ${of}` : `${of}${spar ? '  ·  SPARRING' : ''}`, cx, y + 20, { size: 14, weight: '800', color: champ ? '#ffd24a' : '#c4b99a' });
  const name = d.name.toUpperCase(), bw = champBust(ctx, E, d, x, y);
  E.text(name, cx, y + 46, { size: fitSize(ctx, name, 30, w - 40 - 2 * bw), weight: '800', color: '#f0e6cc' });
  if (sub) E.text(sub, cx, y + 72, { size: bw ? fitSize(ctx, sub, 15, w - 2 * bw - 16) : 15, weight: '800', color: champ ? '#fca5a5' : '#7de3ff' });
  const lx = x + 80, s = 96;
  armourIcon(ctx, E, guardParts(foeParts(makeRng(d.partSeed), d.set), d.guards), lx, y + b + 100, s, d.str, GTYPE[d.weapon.id].helm);
  E.text(`${d.set.name} ARMOUR`, lx, y + b + 118, { size: 14, weight: '800', color: '#aab3bc' });
  const ng = (d.guards || []).length;
  E.text(ng ? `${d.set.slots - ng} open · ${ng} guarded` : `${d.set.slots} gaps open`, lx, y + b + 134, { size: 14, weight: '700', color: '#c4b99a' });
  if (ng) { const gl = `${d.guards.map((id) => GUARDS[id].toUpperCase()).join(', ')}`; E.text(clipLine(ctx, gl, 150), lx, y + b + 150, { size: 14, weight: '700', color: '#ffd24a' }); }
  const rx = x + 164, rw = gear.length ? Math.max(170, w - 164 - 32 - 226) : x + w - 22 - rx;
  // his size and weapon on one line (the size in gold), the weapon drawn at its end, its tip below, then his profile beside the stat bars
  const iw = d.weapon.len * 100 + 10, sz = `${d.size.name} · `, fs = Math.max(14, fitSize(ctx, `${sz}${d.wname}`, 18, rw - iw));
  ctx.font = `800 ${fs}px system-ui, sans-serif`;
  const sw = ctx.measureText(sz).width;
  E.text(sz, rx, y + b + 8, { size: fs, weight: '800', align: 'left', color: '#fde68a' });
  E.text(d.wname, rx + sw, y + b + 8, { size: fs, weight: '800', align: 'left', color: '#f0e6cc' });
  const tw0 = sw + ctx.measureText(d.wname).width, is = Math.min(100, (rw - tw0 - 10) / (d.weapon.len + 0.42));
  if (is >= 24) weaponIcon(ctx, d, rx + rw - (d.weapon.len + 0.12) * is, y + b + 2, is);
  wrapPx(ctx, WEAPON_TIP[d.weapon.id] + (d.shield ? ', with shield' : ''), rw, 14).slice(0, 2).forEach((t, i) => E.text(t, rx, y + b + 30 + i * 16, { size: 14, align: 'left', color: '#9aa4b2' }));
  profLine(ctx, E, d, rx, y + b + 64, rw, 17);
  statBars(ctx, E, d, rx, y + b + 104, rw, 20, 14);
  // his gear in a third column, a tell: the pieces that act for him in red with what each does, the rest a look in grey (14 px, at most 9 or 10 lines)
  if (gear.length) {
    const gx = rx + rw + 16, gw = x + w - 16 - gx, maxL = Math.floor((bodyH - 8) / 16) + 1, rows = [];
    for (const c of gear.filter((q) => FOE_TELL[q.id])) wrapPx(ctx, `${c.gear}: ${FOE_TELL[c.id]()}`, gw, 14, '700').forEach((t, i) => rows.push({ t, head: i ? '' : `${c.gear}:` }));
    const look = gear.filter((q) => !FOE_TELL[q.id]).map((q) => q.gear);
    if (look.length && rows.length < maxL) {
      const ls = wrapPx(ctx, `Looks only: ${look.join(', ')}`, gw, 14, '700'), room = maxL - rows.length;
      ls.slice(0, room).forEach((t, i) => { ctx.font = '700 14px system-ui, sans-serif'; while (i === room - 1 && ls.length > room && ctx.measureText(`${t}\u2026`).width > gw) t = t.slice(0, -1); rows.push({ t: i === room - 1 && ls.length > room ? `${t}\u2026` : t, head: '', dim: true }); });
    }
    rows.slice(0, maxL).forEach((r, i) => {
      const ry = y + b + 8 + i * 16;
      if (r.dim) { E.text(r.t, gx, ry, { size: 14, weight: '700', align: 'left', color: '#9aa4b2' }); return; }
      ctx.font = '700 14px system-ui, sans-serif';
      const hw = r.head ? ctx.measureText(r.head).width : 0;
      if (r.head) E.text(r.head, gx, ry, { size: 14, weight: '700', align: 'left', color: '#f87171' });
      E.text(r.head ? r.t.slice(r.head.length).trimStart() : r.t, gx + (r.head ? hw + 4 : 0), ry, { size: 14, weight: '700', align: 'left', color: '#e2e8f0' });
    });
  }
  if (thread) drawThread(ctx, E, cx, y + b + bodyH + 16, w);
  const vy = brutusCardLine(ctx, E, cx, y, tb, w, thread, y + tb + (voice ? 33 : 31));
  if (voice) { const vl = `${d.name.split(/[ ,]/)[0]}: “${voice}”`; E.text(vl, cx, vy, { size: fitSize(ctx, vl, 15, w - 28), weight: '800', color: '#f87171' }); }
  else if (second) { const sl = `“${brutusReason()}”`; E.text(sl, cx, vy, { size: fitSize(ctx, sl, 14, w - 28, '700'), weight: '700', color: '#fde68a' }); }
  const k = 0.6 + 0.4 * Math.sin(state.introT * 4);
  E.text('Tap to fight', cx, y + h - 18, { size: 16, weight: '800', color: '#ffd24a', alpha: state.introT > 0.35 ? k : 0.3 });
}
// A beast's card: what it is (a lion or a bear, its epithet), no shield and no feints, its body with its gaps on the left, its size and how its tells
// look, its profile and stats on the right, then the thread, Brutus and the tap.
function drawBeastIntro(ctx, E) {
  const d = state.foe, me = state.me, thread = me.reason !== 'revenge', b = 88, bodyH = 160, tb = b + bodyH + (thread ? 32 : 6);
  const w = Math.min(E.w - 32, 520 + (brutusFaceOn() ? TUNING.art.faceCard + 8 : 0)), h = Math.min(E.h - 12, tb + 22 + 34 + cardGrow()), x = (E.w - w) / 2, y = (E.h - h) / 2, cx = E.w / 2;
  ctx.fillStyle = 'rgba(10,8,14,0.6)'; ctx.fillRect(0, 0, E.w, E.h);
  E.roundRect(x, y, w, h, 18, '#221a2b', '#fb923c');
  E.text(`BOUT ${state.rack + 1} OF ${state.gauntlet.length}  ·  A BEAST`, cx, y + 20, { size: 14, weight: '800', color: '#fb923c' });
  const name = beastTitle(d).toUpperCase();
  E.text(name, cx, y + 46, { size: fitSize(ctx, name, 30, w - 40), weight: '800', color: '#f0e6cc' });
  E.text('No shield, no feints: read its body.', cx, y + 72, { size: 15, weight: '800', color: '#7de3ff' });
  const iw = 150, lx = x + 16 + iw / 2, gaps = d.parts.filter((p) => p.slot).map((p) => p.d.label);
  beastIcon(ctx, E, d, lx, y + b + 92, iw);
  E.text(`${gaps.length} gaps open`, lx, y + b + 106, { size: 14, weight: '800', color: '#c4b99a' });
  wrapPx(ctx, gaps.join(', '), iw + 10, 14, '700').slice(0, 2).forEach((t, i) => E.text(t, lx, y + b + 123 + i * 16, { size: 14, weight: '700', color: '#ffd24a' }));
  const rx = x + 32 + iw, rw = x + w - 22 - rx;
  E.text(clipLine(ctx, `${d.size.name} · ${BEASTS[d.beast].name.toUpperCase()}`, rw), rx, y + b + 8, { size: 18, weight: '800', align: 'left', color: '#fde68a' });
  const tl = wrapPx(ctx, BEASTS[d.beast].tell, rw, 14, '700').slice(0, 3);
  tl.forEach((t, i) => E.text(t, rx, y + b + 30 + i * 17, { size: 14, weight: '700', align: 'left', color: '#e2e8f0' }));
  const py = y + b + 38 + tl.length * 17, two = !profFits(ctx, d, rw);
  profLine(ctx, E, d, rx, py, rw, 17);
  statBars(ctx, E, d, rx, py + (two ? 40 : 26), rw, 19, 14);
  if (thread) drawThread(ctx, E, cx, y + b + bodyH + 16, w);
  brutusCardLine(ctx, E, cx, y, tb, w, thread, 0);
  const k = 0.6 + 0.4 * Math.sin(state.introT * 4);
  E.text('Tap to fight', cx, y + h - 18, { size: 16, weight: '800', color: '#ffd24a', alpha: state.introT > 0.35 ? k : 0.3 });
}
// a beast drawn small at rest on its card, w px from nose to tail, its feet at (x, y); its gaps show as on the sand
function beastIcon(ctx, E, d, x, y, w) {
  const B = TUNING.beasts[d.beast], s = w / (B.front + B.back + 0.08), ic = d.icon || (d.icon = { beast: d.beast, young: d.young, parts: beastParts(d.beast) });
  beastRest(ic);
  drawBeast(ctx, E, { x: x - (B.back - B.front) / 2 * s, y, a: 0, dir: -1, H: s }, ic, 'edge');
}
// his profile in one line (14 px): its name in his profile's colour, then what it means, cut to w px
const PROF_COL = { brute: '#fb923c', duelist: '#7de3ff', glass: '#f87171', tank: '#a3e635', balanced: '#e2e8f0' };
// does his whole profile line fit one line of w px?
function profFits(ctx, d, w) {
  const P = PROFILES[d.prof] || PROFILES.balanced;
  ctx.font = '800 14px system-ui, sans-serif';
  const hw = ctx.measureText(`${P.name}:`).width + 5;
  ctx.font = '700 14px system-ui, sans-serif';
  return hw + ctx.measureText(P.line).width <= w;
}
// (wrap: when it does not fit, the words that do not go on a second line, wrap px below)
function profLine(ctx, E, d, x, y, w, wrap = 0) {
  const P = PROFILES[d.prof] || PROFILES.balanced, head = `${P.name}:`;
  ctx.font = '800 14px system-ui, sans-serif';
  const hw = ctx.measureText(head).width + 5;
  E.text(head, x, y, { size: 14, weight: '800', align: 'left', color: PROF_COL[d.prof] || '#e2e8f0' });
  ctx.font = '700 14px system-ui, sans-serif';
  const words = P.line.split(' ');
  let n = words.length;
  while (wrap && n > 1 && ctx.measureText(words.slice(0, n).join(' ')).width > w - hw) n--;
  E.text(clipLine(ctx, words.slice(0, n).join(' '), w - hw), x + hw, y, { size: 14, weight: '700', align: 'left', color: '#e2e8f0' });
  if (n < words.length) E.text(clipLine(ctx, words.slice(n).join(' '), w), x, y + wrap, { size: 14, weight: '700', align: 'left', color: '#e2e8f0' });
}
// A pairs bout's card: both foes side by side, the one who fights first on the left, each with his own health, armour, guarded gaps and gear (at 14 px)
function drawPairIntro(ctx, E) {
  const a = state.foe, q = state.edge, me = state.me, d0 = state.gauntlet[state.rack], champ = a.champion;
  const voice = d0.rival ? tauntOf(me) : champ ? champLine(a, me.reason) : null, sub = champ ? champTie(a, me.reason) : 'Pairs: when one is out of breath or down, the other steps in.';
  const thread = me.reason !== 'revenge', b = 88, cw = (Math.min(E.w - 32, 640) - 48) / 2, ex = profFits(ctx, a, cw - 88) && profFits(ctx, q, cw - 88) ? 0 : 16, bodyH = 150 + ex, tb = b + bodyH + (thread ? 32 : 6);
  const w = Math.min(E.w - 32, 640), h = Math.min(E.h - 12, tb + 22 + (voice ? 22 : 0) + 34 + cardGrow()), x = (E.w - w) / 2, y = (E.h - h) / 2, cx = E.w / 2;
  ctx.fillStyle = 'rgba(10,8,14,0.6)'; ctx.fillRect(0, 0, E.w, E.h);
  E.roundRect(x, y, w, h, 18, '#221a2b', d0.rival ? '#f87171' : champ ? '#ffd24a' : '#e6c866');
  const of = `PAIRS  ·  BOUT ${state.rack + 1} OF ${state.gauntlet.length}`;
  E.text(d0.rival ? `YOUR RIVAL  ·  ${of}` : champ ? `THE CHAMPION  ·  ${of}` : of, cx, y + 20, { size: 14, weight: '800', color: champ ? '#ffd24a' : '#c4b99a' });
  const name = (a.title || `${a.name} and ${q.name}`).toUpperCase(), bw = champBust(ctx, E, a, x, y);
  E.text(name, cx, y + 46, { size: fitSize(ctx, name, 30, w - 150 - 2 * bw), weight: '800', color: '#f0e6cc' });  // clear of the LAB tab
  E.text(sub, cx, y + 72, { size: Math.max(14, fitSize(ctx, sub, 15, w - 28 - 2 * bw)), weight: '800', color: champ ? '#fca5a5' : '#7de3ff' });
  pairCol(ctx, E, a, x + 16, y + b, cw, 'FIGHTS FIRST', ex);
  pairCol(ctx, E, q, x + 32 + cw, y + b, cw, d0.sends ? 'STEPS IN AT HALF HEALTH' : 'WAITS AT THE EDGE', ex);
  ctx.fillStyle = 'rgba(240,230,204,0.18)'; ctx.fillRect(cx - 1, y + b, 2, bodyH - 6);
  if (thread) drawThread(ctx, E, cx, y + b + bodyH + 16, w);
  const vy = brutusCardLine(ctx, E, cx, y, tb, w, thread, y + tb + 33);
  if (voice) { const vl = `${a.name.split(/[ ,]/)[0]}: “${voice}”`; E.text(vl, cx, vy, { size: Math.max(14, fitSize(ctx, vl, 15, w - 28)), weight: '800', color: '#f87171' }); }
  E.text('Tap to fight', cx, y + h - 18, { size: 16, weight: '800', color: '#ffd24a', alpha: state.introT > 0.35 ? 0.6 + 0.4 * Math.sin(state.introT * 4) : 0.3 });
}
// one foe's column on the pairs card: who he is, his health, his armour and guards, his gear (the pieces that act for him in red)
function pairCol(ctx, E, f, x, y, w, tag, ex) {
  E.text(tag, x + w / 2, y + 6, { size: 14, weight: '800', color: '#c4b99a' });
  const nm = (f.beast ? beastTitle(f) : f.name).toUpperCase();
  E.text(nm, x + w / 2, y + 26, { size: Math.max(14, fitSize(ctx, nm, 18, w - 8)), weight: '800', color: f.champion ? '#ffd24a' : '#f0e6cc' });
  if (f.beast) beastIcon(ctx, E, f, x + 40, y + 108 + ex / 2, 76); else armourIcon(ctx, E, f.parts, x + 40, y + 122 + ex / 2, 80, f.str, GTYPE[f.weapon.id].helm);
  const rx = x + 84, rw = w - 88, ng = (f.guards || []).length, T = (t, yy, col = '#e2e8f0', wt = '700') => E.text(t, rx, yy, { size: 14, weight: wt, align: 'left', color: col });
  T(clipLine(ctx, f.beast ? `${f.size.name} · ${BEASTS[f.beast].name.toUpperCase()}` : `${f.size.name} · ${f.wname}`, rw), y + 50, '#fde68a', '800');
  profLine(ctx, E, f, rx, y + 69, rw, ex);
  y += ex;
  ctx.font = '800 14px system-ui, sans-serif';
  const hl = `HEALTH ${f.maxHp}`, hw = ctx.measureText(hl).width + 8;
  T(hl, y + 88, '#f0e6cc', '800');
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(rx + hw, y + 84, rw - hw, 8); ctx.fillStyle = '#d9483a'; ctx.fillRect(rx + hw, y + 84, (rw - hw) * clamp(f.hp / f.maxHp, 0, 1), 8);
  T(clipLine(ctx, ng ? `${f.set.slots - ng} open \u00b7 ${f.guards.map((id) => GUARDS[id]).join(', ')}` : `${f.set.slots} gaps open`, rw), y + 107, ng ? '#ffd24a' : '#c4b99a');
  const gear = (f.gear || []).map((id) => CARD[id]), act = gear.filter((c) => FOE_TELL[c.id]), look = gear.filter((c) => !FOE_TELL[c.id]);
  const rows = f.beast ? wrapPx(ctx, BEASTS[f.beast].tell, rw, 14, '700').map((t) => [t, '#e2e8f0']) : [...act.map((c) => [c.gear, '#f87171']), ...(look.length ? [[`${look.map((c) => c.gear).join(', ')}`, '#9aa4b2']] : [])];
  if (!rows.length) rows.push(['No gear', '#9aa4b2']);
  rows.slice(0, 2).forEach(([t, col], i) => T(clipLine(ctx, t, rw), y + 126 + i * 18, col));
}
// a line cut to w px at 14 px bold, with an ellipsis
function clipLine(ctx, t, w, size = 14, weight = '700') {
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  if (ctx.measureText(t).width <= w) return t;
  while (t.length > 2 && ctx.measureText(`${t}\u2026`).width > w) t = t.slice(0, -1);
  return `${t.trimEnd()}\u2026`;
}
function miniCard(ctx, E, d, x, y, w, h, res) {
  const stroke = res === 'felled' ? '#4ade80' : res === 'lost' ? '#ef4444' : 'rgba(240,230,204,0.25)';
  E.roundRect(x, y, w, h, 12, res ? '#221a2b' : 'rgba(34,26,43,0.5)', stroke);
  const a = res ? 1 : 0.45, cx = x + w / 2;
  ctx.globalAlpha = a;
  E.text(d.champion ? 'CHAMPION' : `BOUT ${d.at + 1}`, cx, y + 12, { size: 14, weight: '800', color: d.champion ? '#ffd24a' : '#c4b99a', alpha: a });
  // a pair: both names when they fit, else the first and "+1"
  const first = d.name.length > 13 ? d.name.split(/[ ,]/)[0].toUpperCase() : d.name.toUpperCase(), both = d.pair ? `${d.name.split(/[ ,]/)[0]} & ${d.pair.name.split(/[ ,]/)[0]}`.toUpperCase() : first;
  ctx.font = '800 14px system-ui, sans-serif';
  const plus = `${d.name.split(/[ ,]/)[0].toUpperCase()} +1`, nm = ctx.measureText(both).width <= w - 8 ? both : d.pair && ctx.measureText(plus).width <= w - 8 ? plus : first;
  E.text(clipLine(ctx, nm, w - 6), cx, y + 27, { size: 14, weight: '800', color: '#f0e6cc', alpha: a });
  // size, weapon and armour on their own 14 px lines, then the stat bars across the card
  const wn = d.beast ? BEASTS[d.beast].name.toUpperCase() : d.weapon.alt && d.mace ? d.weapon.alt : d.weapon.name;
  E.text(d.size.name, cx, y + 42, { size: 14, weight: '700', color: '#fde68a', alpha: a });
  E.text(clipLine(ctx, wn.split(' & ')[0], w - 6), cx, y + 57, { size: 14, weight: '700', color: '#fde68a', alpha: a });
  E.text(d.set.name, cx, y + 72, { size: 14, weight: '700', color: '#aab3bc', alpha: a });
  statBars(ctx, E, d, x + 8, y + 92, w - 16, 15, 14);
  ctx.globalAlpha = 1;
  E.text(res === 'felled' ? 'FELLED' : res === 'lost' ? 'BEAT YOU' : 'NOT MET', cx, y + h - 10, { size: 14, weight: '800', color: res === 'felled' ? '#4ade80' : res === 'lost' ? '#ef4444' : '#6b7280' });
}

// ----- your fighter: the eight wheels, the card, and the end-card mini -----
const TIER_COL = { S: '#ffd24a', A: '#4ade80', B: '#7dd3fc', C: '#c4b99a', D: '#f87171' };
const SIZE_TIP = { runt: 'tiny, quick, short reach', lean: 'quick swing, short reach', medium: 'balanced', big: 'long reach, slow swing', giant: 'huge reach, slow swing' };
const WHEELS = [
  { title: 'SIZE', cols: ['#2f7d6d', '#4a6a8c', '#6b5a8c', '#8c4a6a', '#a8402e'] },
  { title: 'STRENGTH' },
  { title: 'SPEED' },
  { title: 'STAMINA' },
  { title: 'ARMOUR', cols: ['#8a7452', '#6f7c89', '#3f4a5a'] },
  { title: 'WEAPON', cols: ['#9b2f2f', '#38457a', '#5a3b22', '#b08c34', '#2e6a7a', '#7a2e5a'] },
  { title: 'ORIGIN', cols: ['#5f7a3a', '#7a3a3a', '#a07a3a', '#8c5a2e', '#2e5f7a', '#6a4a8c', '#a8402e', '#b8923a', '#3a7a5f'] },
  { title: 'REASON', cols: ['#2f7d6d', '#8a6a2a', '#8b2e2e', '#b8923a', '#6a4a8c'] },
].map((wh, k) => ({ ...wh, k, list: (me) => wheelList(k, me.idx, me.open || []) }));
const STAT_COLS = ['#8b2e2e', '#a8642e', '#9a8c32', '#5f8f3e', '#2f7d6d'];
const shortOf = (e) => (typeof e[0] === 'number' ? `${e[0]}` : e[3] || (e[0].length > 1 ? e[2][0] : e[0]));

// ----- the wheel of fate (L8) -----
// Each slice's start and end, in radians clockwise from the pointer, for these weights (slice size is the odds).
function sliceArcs(w) {
  const tot = w.reduce((a, q) => a + q, 0) || 1;
  let a = 0;
  return w.map((q) => { const s = a; a += q / tot * Math.PI * 2; return [s, a]; });
}
// where the pointer comes to rest on slice i: settle of the way across it from its leading peg (a thin slice, its middle); wheelRest is that turn
function restAt(w, i) { const [s, e] = sliceArcs(w)[i], wd = e - s; return s + wd * (wd < 0.3 ? 0.5 : TUNING.me.roll.settle); }
const wheelRest = (w, i) => -restAt(w, i);
const WHEEL_Q = ['Size?', 'Strength?', 'Speed?', 'Stamina?', 'Armour?', 'Weapon?', 'Origin?', 'Reason?'];
const sliceCol = (wh, i) => (wh.cols || STAT_COLS)[i];
// One wheel, drawn by the game: a bronze rim with gold studs, gradient slices sized by their odds (names on the slices that have room), pegs between
// slices, a hub with the wheel's question and the ticker on top. o: rot (the wheel's turn), w (the slice weights, which may be mid-reshape), landed
// (the landed slice, or -1), names (the slices' names, on a big wheel), pop and flash (0 to 1, the landing), tick (the ticker's flick, radians), grow (per slice: +1 growing, -1 shrinking).
// A small wheel (the card's strip) keeps the rim, slices, pegs and pointer only.
function drawWheel(ctx, E, wh, cx, cy, r, o) {
  const arcs = sliceArcs(o.w), small = r < 40, base = -Math.PI / 2 + o.rot, landed = o.landed == null ? -1 : o.landed;
  ctx.save();
  // the rim
  ctx.fillStyle = '#5a3d17'; ctx.beginPath(); ctx.arc(cx, cy, r * 1.1, 0, 6.283); ctx.fill();
  ctx.strokeStyle = '#c99a3e'; ctx.lineWidth = Math.max(1.5, r * 0.025); ctx.beginPath(); ctx.arc(cx, cy, r * 1.1, 0, 6.283); ctx.stroke();
  if (!small) {
    ctx.fillStyle = '#ffd24a';
    for (let k = 0; k < 24; k++) { const a = base + k * Math.PI / 12; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r * 1.05, cy + Math.sin(a) * r * 1.05, r * 0.022, 0, 6.283); ctx.fill(); }
  }
  // the slices, a light centre shading to the rim; the landed one pops out and flashes, the rest dim
  const shade = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
  shade.addColorStop(0, 'rgba(255,240,200,0.32)'); shade.addColorStop(1, 'rgba(0,0,0,0.25)');
  arcs.forEach(([s, e], i) => {
    if (e - s < 1e-4) return;
    const on = i === landed, mid = base + (s + e) / 2, out = on ? (o.pop || 0) * r * 0.07 : 0, x = cx + Math.cos(mid) * out, y = cy + Math.sin(mid) * out, rr = r * (on ? 1 + (o.pop || 0) * 0.03 : 1);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, rr, base + s, base + e); ctx.closePath();
    ctx.fillStyle = sliceCol(wh, i); ctx.fill();
    ctx.save(); ctx.translate(x - cx, y - cy); ctx.fillStyle = shade; ctx.fill(); ctx.restore();
    if (landed >= 0 && !on) { ctx.fillStyle = 'rgba(10,8,14,0.4)'; ctx.fill(); }
    if (on && o.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${0.75 * o.flash})`; ctx.fill(); }
    ctx.strokeStyle = on ? '#ffd24a' : '#14101a'; ctx.lineWidth = on ? 3 : 1.5; ctx.stroke();
    // a reshaping slice: a green arc on its rim while it grows, red while it shrinks
    const g = o.grow && o.grow[i];
    if (g) { ctx.strokeStyle = g > 0 ? '#4ade80' : '#f87171'; ctx.lineWidth = Math.max(3, r * 0.05); ctx.beginPath(); ctx.arc(cx, cy, r * 0.95, base + s + 0.03, base + e - 0.03); ctx.stroke(); }
    if (!small && o.names) {
      const name = o.names[i];
      ctx.font = '800 14px system-ui, sans-serif';
      if ((e - s) * r * 0.66 > ctx.measureText(name).width + 8 && e - s > 0.42) E.text(name, x + Math.cos(mid) * r * 0.69, y + Math.sin(mid) * r * 0.69, { size: 14, weight: '800', color: '#fff7e0' });
    }
  });
  // pegs between the slices
  ctx.fillStyle = '#f0e6cc'; ctx.strokeStyle = '#3a2a10'; ctx.lineWidth = 1;
  for (const [s, e] of arcs) {
    if (e - s < 1e-4) continue;
    const a = base + s;
    ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r * 0.97, cy + Math.sin(a) * r * 0.97, Math.max(1.6, r * 0.032), 0, 6.283); ctx.fill(); if (!small) ctx.stroke();
  }
  // the hub with the question
  const hr = small ? r * 0.2 : r * 0.38;
  ctx.fillStyle = '#221a2b'; ctx.beginPath(); ctx.arc(cx, cy, hr, 0, 6.283); ctx.fill();
  ctx.strokeStyle = '#e6c866'; ctx.lineWidth = small ? 1.5 : 3; ctx.stroke();
  if (!small) { const q = WHEEL_Q[wh.k]; E.text(q, cx, cy + 1, { size: Math.max(14, fitSize(ctx, q, 17, hr * 1.85)), weight: '800', color: '#ffd24a' }); }
  // the ticker: hinged above the rim, flicked aside by each peg
  const py = cy - r * 1.1 - (small ? 3 : 8), len = small ? r * 0.35 : r * 0.28, wd = small ? 5 : Math.max(8, r * 0.09);
  ctx.translate(cx, py); ctx.rotate(o.tick || 0);
  ctx.fillStyle = '#ffd24a'; ctx.strokeStyle = '#14101a'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-wd, -2); ctx.lineTo(wd, -2); ctx.lineTo(0, len); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (!small) { ctx.fillStyle = '#5a3d17'; ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, 6.283); ctx.fill(); }
  ctx.restore();
}
// The turn of a spin at u (0 to 1) that ends with slice i under the pointer (settle of the way across it, from its leading peg): a fast start easing
// down to the leading peg (the tease: will it slip into the next slice?), then a wobble back that settles.
function spinRot(w, i, u) {
  const R = TUNING.me.roll, [s, e] = sliceArcs(w)[i], fin = restAt(w, i), tease = s + Math.min(R.peg, (e - s) * 0.15);
  const end = -fin + Math.PI * 2 * Math.ceil(R.turns + fin / (Math.PI * 2)), over = fin - tease;
  if (u < R.main) { const p = u / R.main; return (end + over) * (1 - Math.pow(1 - p, 3)); }
  const q = (u - R.main) / (1 - R.main);
  return end + over * Math.cos(q * Math.PI * 2.5) * Math.pow(1 - q, 2);
}
// pegs passed by the pointer between two turns of the wheel
function pegsPassed(w, r0, r1) {
  const T = Math.PI * 2, n = (x, b) => Math.floor((x - b) / T);
  return sliceArcs(w).reduce((c, [s]) => c + Math.abs(n(-r0, s) - n(-r1, s)), 0);
}

// what your weapon is for, in one line
const MY_WEAPON_JOB = { gladius: 'all-rounder: quick stabs, fair reach', spear: 'long reach: stab from range; slashes are weak', axe: 'slow and heavy: smashes break armour', dagger: 'short and fast: stabs into gaps do 4x',
  trident: 'longest reach, slow; a well-timed block nets him', sica: 'short and quick: slashes cut deep' };
// a weapon as the icon draws it: his table's, or your armoury weapon's drawn length
const iconWeapon = (id) => TUNING.weapons.find((q) => q.id === id) || { id, len: TUNING.me.weapons[id].len };
// Your card, in three columns under the story and your start card: your armour, your size, hearts and stats, then your tier and your weapon (its name on its own line, its job wrapped below).
function drawMeCard(ctx, E, me, x, y, w, h) {
  const M = TUNING.me, S = M.sizes[me.size], A = M.armour[me.set], noun = ORIGINS[me.origin].noun, scs = startCards(me), sc = scs[0], cx = x + w / 2;
  E.roundRect(x, y, w, h, 18, '#1d2a2a', me.vid ? '#ffd24a' : '#4ade80');
  // a veteran: the stat they gained and their scar, in gold
  const vt = me.vid ? `VETERAN${me.up ? `  ·  +${TUNING.ludus.vetUp} ${WHEELS[me.up].title}` : ''}  ·  ${me.scar}` : null;
  if (vt) E.text(vt, cx, y + 16, { size: fitSize(ctx, vt, 14, w - 28), weight: '800', color: '#ffd24a' });
  else E.text('YOUR FIGHTER', cx, y + 16, { size: 14, weight: '800', color: '#9fe3c6' });
  const st = storyLine(me);
  E.text(st, cx, y + 36, { size: Math.max(14, fitSize(ctx, st, 15, w - 28)), weight: '800', color: '#f0e6cc' });
  const pk = `${noun[0].toUpperCase()}${noun.slice(1)}: starts with ${scs.length > 1 ? `${sc.name} + ${scs[1].name}` : `${sc.name} (${FAMS[sc.fam].name})`}`;
  E.text(pk, cx, y + 56, { size: Math.max(14, fitSize(ctx, pk, 14, w - 28, '700')), weight: '700', color: '#86efac' });
  const lw = w * 0.3, ax = x + 12 + lw / 2, s = Math.min(84, h * 0.3) * sizeOf(me.size, me.vary || 0).scale;
  armourIcon(ctx, E, playerParts(me), ax, y + 72 + s * 0.95, s, me.str, GTYPE[me.weapon].helm);
  E.text(`${A.name} ARMOUR`, ax, y + 174, { size: 14, weight: '800', color: '#aab3bc' });
  if (me.plates.length) wrapPx(ctx, `plated: ${me.plates.map((q) => (q === 'armB' ? 'shield arm' : q)).join(', ')}`, lw, 14).forEach((t, i) => E.text(t, ax, y + 192 + i * 16, { size: 14, color: '#c4b99a' }));
  const mx = x + 18 + lw, mw = w * 0.36;
  E.text(S.name, mx, y + 84, { size: 20, weight: '800', align: 'left', color: '#fde68a' });
  E.text(SIZE_TIP[me.size], mx, y + 103, { size: 14, align: 'left', color: '#9aa4b2' });
  E.text(`♥ ${me.halves} hearts`, mx, y + 123, { size: 15, weight: '800', align: 'left', color: '#f87171' });
  statBars(ctx, E, me, mx, y + 147, mw, 20, 14);
  // a veteran's gained point glows green on its bar
  if (me.vid && me.up) { const v = me[['', 'str', 'spd', 'sta'][me.up]], seg = (mw - 14 * 2.6) / 5; ctx.fillStyle = '#4ade80'; ctx.fillRect(mx + 14 * 2.6 + (v - 1) * seg, y + 147 + (me.up - 1) * 20 - 14 * 0.35, seg - 3, 14 * 0.7); }
  const tx = mx + mw + 10, tw = x + w - 12 - tx, tc = TIER_COL[me.tier];
  ctx.strokeStyle = tc; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(tx + 24, y + 96, 22, 0, 6.28); ctx.stroke();
  E.text(me.tier, tx + 24, y + 98, { size: 28, weight: '800', color: tc });
  E.text('TIER', tx + 54, y + 88, { size: 14, weight: '800', align: 'left', color: '#c4b99a' });
  if (me.underdog) E.text('Underdog!', tx + 54, y + 105, { size: 14, weight: '800', align: 'left', color: '#ffd24a', alpha: 0.75 + 0.25 * Math.sin(E.time * 6) });
  const WI = iconWeapon(me.weapon), nm = weaponName(me);
  const ws = Math.min(110, (tw - 12) / (WI.len + 0.4));
  weaponIcon(ctx, { weapon: WI, mace: me.mace }, tx + 4 + 0.3 * ws, y + 130, ws);
  E.text(nm, tx, y + 150, { size: fitSize(ctx, nm, 16, tw), weight: '800', align: 'left', color: '#f0e6cc' });
  wrapPx(ctx, MY_WEAPON_JOB[me.weapon], tw, 14).slice(0, 4).forEach((t, i) => E.text(t, tx, y + 168 + i * 16, { size: 14, align: 'left', color: '#c4b99a' }));
}
function meMini(ctx, E, me, x, y, w, h, picks = []) {
  E.roundRect(x, y, w, h, 12, '#1d2a2a', '#4ade80');
  const cx = x + w / 2;
  E.text(clipLine(ctx, me.name.toUpperCase(), w - 10), cx, y + 12, { size: 14, weight: '800', color: '#9fe3c6' });
  E.text(`TIER ${me.tier} \u2665${me.halves}`, cx, y + 27, { size: 14, weight: '800', color: TIER_COL[me.tier] });
  E.text(TUNING.me.sizes[me.size].name, cx, y + 42, { size: 14, weight: '700', color: '#fde68a' });
  E.text(clipLine(ctx, weaponName(me).split(' & ')[0], w - 6), cx, y + 57, { size: 14, weight: '700', color: '#fde68a' });
  E.text(TUNING.me.armour[me.set].name, cx, y + 72, { size: 14, weight: '700', color: '#aab3bc' });
  statBars(ctx, E, me, x + 8, y + 92, w - 16, 15, 14);
  E.text('YOU', cx, y + h - 10, { size: 14, weight: '800', color: '#4ade80' });
  // the set mark: each set bonus you wear (up to two), a small gold roundel either side of YOU
  picks.filter((id) => CARD[id].duo).slice(0, 2).forEach((id, i) => drawIcon(ctx, id, i ? x + w - 16 : x + 16, y + h - 10, 7));
}

// ====== META: fame, the ludus, the Wall of Champions ======
// A run's fame (TUNING.fame, E): every bout won, a champion felled, the arena's first clear, the Emperor's thumbs up, and the gold left over; each with its reason
function fameOf(won, first, thumbUp, gold, bouts = 0) {
  const F = TUNING.fame, g = Math.floor(gold / F.goldPer), items = [];
  if (bouts > 0) items.push(['bouts won', bouts * F.bout]);
  if (won) items.push(['champion', F.champ]);
  if (first) items.push(['first clear', F.clear]);
  if (thumbUp) items.push(['thumbs up', F.thumbUp]);
  if (g > 0) items.push(['gold left', g]);
  return { sum: items.reduce((a, e) => a + e[1], 0), items };
}
// A save from before fame (migrate sets fameCheck; the ledger is the engine's, so it is read here once): each cleared arena's first clear, each won run's
// fame (a cleared arena with no win left in the ledger still counts its champion), its fighters on the Wall of Champions (the ledger kept no names, and
// no rolls, so they cannot return as veterans), and every card picked in a recorded run for the start-card slot
function fameFromLedger(E) {
  const F = TUNING.fame, res = E.ledger.entries.filter((e) => e.k === 'result' && e.d), wins = res.filter((e) => e.d.won === true), cleared = E.save.get('arenas', 0);
  let fame = cleared * F.clear + Math.max(0, cleared - wins.length) * F.champ;
  for (const e of wins) fame += fameOf(true, false, e.d.arena === 'games' && e.d.thumb === 2, e.d.gold || 0).sum;
  const champs = wins.slice().reverse().map((e) => {
    const w = e.d.meWeapon === 'mace' ? 'axe' : e.d.meWeapon;
    return { id: e.t, name: 'Nameless', female: false, origin: ORIGINS[e.d.origin] ? e.d.origin : null, weapon: TUNING.me.weapons[w] ? w : null, mace: e.d.meWeapon === 'mace', arena: ARENA[e.d.arena] ? e.d.arena : 'pit', me: null };
  });
  const picked = new Set(E.save.get('picked', []));
  for (const e of res) for (const id of String(e.d.picks || '').split(',')) if (CARD[id] && !CARD[id].duo) picked.add(id);
  E.save.set('fame', E.save.get('fame', 0) + fame);
  E.save.set('champs', [...E.save.get('champs', []), ...champs].slice(0, TUNING.ludus.wallMax));
  E.save.set('picked', [...picked]); E.save.set('fameCheck', 0);
}
// A won run carves its fighter on the Wall of Champions, newest first: their rolls as the wheels gave them (the tent's plates left off), the stat a veteran
// gains (seeded, one that has room) and a scar line from the champion they felled.
function carveChampion(E, me, arenaId, champName) {
  const L = E.save.get('champs', []), at = (id) => ARENAS.findIndex((a) => a.id === id), old = me.vid != null ? L.find((c) => c.id === me.vid) : null;
  // a veteran who wins again moves their arena up, and keeps the weapon they won with (the spoils)
  if (old) {
    if (at(old.arena) < at(arenaId)) old.arena = arenaId;
    old.weapon = me.weapon; old.mace = me.mace; old.me.idx[5] = me.idx[5]; old.me.mace = me.mace;
    E.save.set('champs', L.slice()); return old;
  }
  const rng = makeRng((state.seed ^ 0x5bd1e995) >>> 0), A = TUNING.me.armour[me.set], ups = [1, 2, 3].filter((k) => me.idx[k] < 4);
  const c = { id: state.seed, name: me.name, female: me.female, origin: me.origin, weapon: me.weapon, mace: me.mace, arena: arenaId,
    me: { idx: me.idx.slice(), plates: me.plates.slice(0, A.n + (A.arm ? 1 : 0)), name: me.name, female: me.female, mace: me.mace, cardRoll: me.cardRoll, vary: me.vary || 0 },
    up: ups.length ? rng.pick(ups) : 0, scar: rng.pick(SCARS)(champName.split(/[ ,]/)[0]) };
  E.save.set('champs', [c, ...L].slice(0, TUNING.ludus.wallMax));
  return c;
}
// the arenas a Wall entry may fight in as a veteran: open, and above the one they cleared
const vetArenas = (E, c) => (c && c.me ? ARENAS.map((a, i) => i).filter((i) => i > ARENAS.findIndex((a) => a.id === c.arena) && i <= openTo(E)) : []);
// what the ludus has opened, and your start-card pick (the training ground's slot, a card you have picked before)
const ludusOf = (E) => E.save.get('ludus', []);
// true while your fame buys at least one unlock you do not own (the menu's gold dot on The Ludus)
const ludusBuys = (E) => { const L = ludusOf(E), fame = E.save.get('fame', 0); return LUDUS.some((st) => st.items.some((q) => !L.includes(q.id) && TUNING.ludus.price[q.id] <= fame)); };
// only a common or a rare card, never a keystone or an epic: the slot is a small step
const startable = (id) => { const c = CARD[id]; return !!c && !c.duo && !c.key && c.tier <= 1; };
const startPick = (E) => { const id = E.save.get('startPick', ''), L = ludusOf(E); return L.includes('slot') && startable(id) && E.save.get('picked', []).includes(id) ? id : ''; };

// ====== SCENES: menu, roll, play, over ======
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

// Old Brutus's short intro, the menu's Story card
const STORY = ['So. Another nobody from the pit.', 'I am Brutus. I make champions out of nobodies.', 'The wheels decide who you are, and what you fight for.',
  'Five bouts stand between you and the end of it. The last is the champion.', 'Win, and Rome remembers you. Fall, and I chalk your name on the wall.'];
// The menu: the title and your fame, Play (Resume when a run was saved, with New run beside the Ludus, Story and Sound), the Story card, and two walls side by
// side: the pit wall of the fallen and the Wall of Champions (a tap opens it).
const menu = {
  enter(E) {
    this.btns = {}; this.story = false;
    // a v6 save's won runs are only in the ledger, which migrate cannot read: checked once here, a won run opens the City
    if (E.save.get('arenasCheck', 0)) {
      if (E.ledger.entries.some((e) => e.k === 'result' && e.d && e.d.won === true)) E.save.set('arenas', Math.max(1, E.save.get('arenas', 0)));
      E.save.set('arenasCheck', 0);
    }
    if (E.save.get('fameCheck', 0)) fameFromLedger(E);
  },
  render(ctx, E) {
    this.btns = {};
    if (portrait(E)) { rotateCard(ctx, E); return; }
    const run = E.save.get('run', null), cx = E.w / 2, top = E.safe.top, bottom = E.h - E.safe.bottom, ty = top + Math.max(44, E.h * 0.15);
    E.text('ARENA', cx, ty, { size: 44, weight: '800', color: '#e6c866' });
    const fame = E.save.get('fame', 0), ft = `${fame} fame`;
    ctx.font = '800 16px system-ui, sans-serif';
    const fw = ctx.measureText(ft).width;
    laurel(ctx, cx - fw / 2 - 12, ty + 36, 8); E.text(ft, cx + 6, ty + 36, { size: 16, weight: '800', color: '#ffd24a' });
    const py = top + E.h * 0.4, ry = py + 64, row = run ? ['new', 'ludus', 'story', 'sound'] : ['ludus', 'story', 'sound'], gap = 12;
    const bw = Math.min(140, (E.w - 32 - E.safe.left - E.safe.right - gap * (row.length - 1)) / row.length);
    this.btns.play = E.button(run ? `Resume: ${(ARENA[run.arena] || ARENAS[0]).short}, bout ${run.rack + 1}` : 'Play', cx, py, { w: 280, h: 56, size: 20 });
    row.forEach((k, i) => {
      const x = cx + (i - (row.length - 1) / 2) * (bw + gap), label = k === 'new' ? 'New run' : k === 'ludus' ? 'The Ludus' : k === 'story' ? 'Story' : E.audio.muted ? 'Sound: off' : 'Sound: on';
      this.btns[k] = E.button(label, x, ry, { w: bw, h: 48, size: 16, fill: k === 'story' ? '#7c2d12' : k === 'ludus' ? '#7a5a14' : '#1f2937' });
    });
    if (ludusBuys(E)) {
      const D = TUNING.ludus.dot, b = this.btns.ludus, dx = b.x + b.w - D.inset, dy = b.y + D.inset;
      ctx.fillStyle = '#ffd24a'; ctx.strokeStyle = '#3a2a08'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(dx, dy, D.r, 0, 6.28); ctx.fill(); ctx.stroke();
    }
    // the pit wall: the last four fallen, newest first, chalked on stone; beside it the Wall of Champions, its newest names carved in gold
    const sw = Math.min(E.w - 40, 620), sx = cx - sw / 2, wy = Math.min(ry + 44, bottom - 82), pw = (sw - 12) / 2, wall = E.save.get('wall', []).slice(0, 4), champs = E.save.get('champs', []);
    E.text('THE PIT WALL', sx + pw / 2, wy, { size: 14, weight: '800', color: '#c4b99a' });
    E.roundRect(sx, wy + 10, pw, 56, 8, '#3a322c', '#5a4e44');
    if (!wall.length) E.text('No names chalked here yet', sx + pw / 2, wy + 38, { size: 14, color: '#8a8f99' });
    wall.forEach((q, i) => E.text(clipLine(ctx, `${q.name} (${q.bout})`, pw / 2 - 8), sx + pw * ((i % 2) + 0.5) / 2, wy + 25 + Math.floor(i / 2) * 26, { size: 14, weight: '700', color: i === 0 ? '#ffffff' : '#d6d0c4', alpha: i === 0 ? 1 : 0.8 }));
    const cx2 = sx + pw + 12;
    E.text(`THE WALL OF CHAMPIONS${champs.length ? ` (${champs.length})` : ''}`, cx2 + pw / 2, wy, { size: 14, weight: '800', color: '#ffd24a' });
    this.btns.champs = { x: cx2, y: wy + 10, w: pw, h: 56 };
    E.roundRect(cx2, wy + 10, pw, 56, 8, '#3a2f22', '#ffd24a');
    if (!champs.length) E.text('Fell a champion to be carved here', cx2 + pw / 2, wy + 38, { size: 14, color: '#c4b99a' });
    champs.slice(0, 4).forEach((q, i) => E.text(clipLine(ctx, q.name, pw / 2 - 8), cx2 + pw * ((i % 2) + 0.5) / 2, wy + 25 + Math.floor(i / 2) * 26, { size: 14, weight: '800', color: '#fde68a' }));
    if (this.story) this.storyCard(ctx, E);
  },
  storyCard(ctx, E) {
    ctx.fillStyle = 'rgba(10,8,14,0.82)'; ctx.fillRect(0, 0, E.w, E.h);
    const w = Math.min(E.w - 32, 560), lh = 24, h = 64 + STORY.length * lh + 34, x = (E.w - w) / 2, y = (E.h - h) / 2;
    E.roundRect(x, y, w, h, 18, '#221a2b', '#e6c866');
    sayLine(ctx, E, 'OLD BRUTUS, YOUR LANISTA', E.w / 2, y + 26, w - 32, { size: 14, weight: '800', color: '#c4b99a' }, 'brutus', TUNING.art.faceBig);
    STORY.forEach((t, i) => E.text(t, E.w / 2, y + 58 + i * lh, { size: fitSize(ctx, t, 16, w - 32, '700'), weight: '700', color: i ? '#f0e6cc' : '#fde68a' }));
    E.text('Tap to close', E.w / 2, y + h - 20, { size: 14, weight: '800', color: '#ffd24a', alpha: 0.6 + 0.4 * Math.sin(E.time * 4) });
  },
  onTap(p, E) {
    if (this.story) { this.story = false; E.audio.play('tap'); return; }
    const b = this.btns, run = E.save.get('run', null), fresh = () => E.setScene('arenas');
    if (b.play && E.hit(b.play, p)) { E.audio.play('tap'); if (run) E.setScene('play', { resume: run }); else fresh(); }
    else if (b.new && E.hit(b.new, p)) { E.audio.play('tap'); E.save.set('run', null); fresh(); }
    else if (b.story && E.hit(b.story, p)) { this.story = true; E.audio.play('tap'); }
    else if (b.ludus && E.hit(b.ludus, p)) { E.audio.play('tap'); E.setScene('ludus'); }
    else if (b.champs && E.hit(b.champs, p)) { E.audio.play('tap'); E.setScene('champs'); }
    else if (b.sound && E.hit(b.sound, p)) { E.audio.toggleMute(); E.audio.play('tap'); }
  },
};

// The arena picker, the ladder in order (principle 11: a card is its name, its state drawn, one line of twist and its champion). An open arena: its name
// (with its place), its twist and its champion (your rival in red when one waits); cleared ones are gilded. The next locked arena: its champion's silhouette and
// what opens it. A tap on a locked card says in one line what opens it; in the dev channel a second tap enters it. With a veteran (from the Wall of
// Champions) only the open arenas above the one they cleared can be picked; the rest are dimmed.
const openTo = (E) => E.save.get('arenas', 0);
function lockLine(i) { return `Fell the ${ARENAS[i - 1].who} champion to open`; }
const pickArena = {
  enter(E, params = {}) { this.cards = []; this.back = null; this.dev = null; this.vet = params.vet || null; },
  layout(E) {
    const n = ARENAS.length, gap = 12, top = E.safe.top + 58, w = Math.min(210, (E.w - 32 - E.safe.left - E.safe.right - gap * (n - 1)) / n);
    const h = Math.min(250, E.h - top - 14 - E.safe.bottom), x0 = (E.w - (w * n + gap * (n - 1))) / 2;
    return ARENAS.map((a, i) => ({ a, i, x: x0 + i * (w + gap), y: top, w, h }));
  },
  render(ctx, E) {
    if (portrait(E)) { this.cards = []; this.back = null; rotateCard(ctx, E); return; }
    const top = E.safe.top, to = openTo(E), rivals = E.save.get('rivals', {}), vet = this.vet, va = vet ? vetArenas(E, vet) : null;
    const head = vet ? `WHERE WILL ${vet.name.toUpperCase()} FIGHT?` : 'CHOOSE YOUR ARENA';
    E.text(head, E.w / 2, top + 28, { size: fitSize(ctx, head, 22, E.w - 260), weight: '800', color: vet ? '#ffd24a' : '#e6c866' });
    this.back = E.button('Back', 16 + E.safe.left + 44, top + 28, { w: 88, h: 44, size: 16, fill: '#1f2937' });
    this.cards = this.layout(E);
    for (const c of this.cards) {
      const { a, i, x, y, w, h } = c, open = i <= to && (!va || va.includes(i)), cleared = i < to, next = !va && !open && i === to, cx = x + w / 2;
      E.roundRect(x, y, w, h, 14, open ? '#2a2016' : 'rgba(34,26,43,0.6)', cleared ? '#ffd24a' : open ? '#e6c866' : 'rgba(240,230,204,0.25)');
      ctx.globalAlpha = open ? 1 : 0.55;
      // the name carries its place ("The City arena, Pompeii"), wrapped onto up to three lines: one item
      wrapPx(ctx, `${a.name}, ${a.place}`.toUpperCase(), w - 12, 14, '800').slice(0, 3).forEach((t, k) => E.text(t, cx, y + 20 + k * 17, { size: 14, weight: '800', color: open ? (cleared ? '#ffd24a' : '#f0e6cc') : '#9aa4b2' }));
      ctx.globalAlpha = 1;
      const sh = Math.min(80, h * 0.31), sy = y + 74 + sh;
      if (cleared) laurel(ctx, cx, sy - sh * 0.5, sh * 0.62);
      silhouette(ctx, cx + (a.id === 'city' ? 12 : a.id === 'rome' ? 16 : 0), sy, sh, open ? '#6b5a44' : '#3a3242');
      if (a.id === 'city') silhouette(ctx, cx - 18, sy + 4, sh * 0.85, open ? '#4e4234' : '#2e2836');
      if (a.id === 'rome') lionSilhouette(ctx, cx - 14, sy, sh * 0.5, open ? '#8a7454' : '#2e2836');
      if (!open && !(va && i <= to)) padlock(ctx, cx, sy - sh * 0.45, '#e6c866');
      // open: the twist (white) and the champion (gold, or your rival in red); locked: what opens it
      const rv = rivals[a.id], wrap = (t) => wrapPx(ctx, t, w - 16, 14, '700').slice(0, 2);
      const shut = va && i <= to ? (i <= ARENAS.findIndex((q) => q.id === vet.arena) ? `${vet.name.split(' ')[0]} cleared it` : 'Not open') : next ? lockLine(i) : 'Locked';
      const lines = open ? [...wrap(a.twist).map((t) => [t, '#f0e6cc']), ...wrap(rv ? `Rival: ${rv.name.split(/[ ,]/)[0]}` : a.champLabel).map((t) => [t, rv ? '#f87171' : '#fde68a'])]
        : wrapPx(ctx, shut, w - 16, 14, '700').slice(0, 3).map((t) => [t, '#c4b99a']);
      const ly = y + h - 14 - (lines.length - 1) * 18;
      lines.forEach(([t, col], k) => E.text(t, cx, ly + k * 18, { size: 14, weight: '700', color: col }));
    }
  },
  onTap(p, E) {
    if (portrait(E)) return;
    if (this.back && E.hit(this.back, p)) { E.audio.play('tap'); E.setScene(this.vet ? 'champs' : 'menu'); return; }
    const c = this.cards.find((q) => E.hit(q, p));
    if (!c) return;
    const to = openTo(E), vet = this.vet, start = () => { E.audio.play('tap'); E.setScene('roll', { seed: (Math.random() * 2 ** 32) >>> 0, arena: c.a.id, vet }); };
    if (vet) { if (vetArenas(E, vet).includes(c.i)) start(); else { E.audio.play('miss'); E.toast(`A veteran fights only above the arena they cleared`); } return; }
    const open = c.i <= to;
    if (open) { start(); return; }
    E.audio.play('miss');
    if (E.channel !== 'release' && this.dev === c.i) { start(); return; }
    this.dev = c.i;
    E.toast(`${lockLine(c.i)}${E.channel !== 'release' ? ' (dev: tap again to enter)' : ''}`);
  },
};
// a dark champion's silhouette standing at (x, y = his feet), h tall: crested helm, shoulders, a shield and a sword
function silhouette(ctx, x, y, h, col) {
  ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y - h * 0.86, h * 0.09, 0, 6.28); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - h * 0.08, y - h * 0.97); ctx.quadraticCurveTo(x, y - h * 1.08, x + h * 0.1, y - h * 0.95); ctx.lineWidth = h * 0.04; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - h * 0.14, y - h * 0.74); ctx.lineTo(x + h * 0.14, y - h * 0.74); ctx.lineTo(x + h * 0.1, y - h * 0.42); ctx.lineTo(x - h * 0.1, y - h * 0.42); ctx.closePath(); ctx.fill();
  ctx.lineWidth = h * 0.07;
  ctx.beginPath(); ctx.moveTo(x - h * 0.06, y - h * 0.44); ctx.lineTo(x - h * 0.1, y); ctx.moveTo(x + h * 0.06, y - h * 0.44); ctx.lineTo(x + h * 0.11, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + h * 0.13, y - h * 0.7); ctx.lineTo(x + h * 0.24, y - h * 0.5); ctx.stroke();
  ctx.lineWidth = h * 0.03; ctx.beginPath(); ctx.moveTo(x + h * 0.24, y - h * 0.5); ctx.lineTo(x + h * 0.34, y - h * 0.86); ctx.stroke();
  rrect(ctx, x - h * 0.3, y - h * 0.72, h * 0.16, h * 0.32, h * 0.03); ctx.fill();
  ctx.restore();
}
// the Colosseum's lion beside its champion: a crouched cat in profile facing left, its feet at (x, y), h its height to the top of its mane
function lionSilhouette(ctx, x, y, h, col) {
  const u = h / 0.5;
  ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.ellipse(x + 0.04 * u, y - 0.29 * u, 0.2 * u, 0.09 * u, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x - 0.15 * u, y - 0.38 * u, 0.1 * u, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x - 0.2 * u, y - 0.37 * u, 0.06 * u, 0, TAU); ctx.fill();
  ctx.lineWidth = 0.05 * u;
  for (const lx of [-0.1, -0.04, 0.12, 0.18]) { ctx.beginPath(); ctx.moveTo(x + lx * u, y - 0.25 * u); ctx.lineTo(x + lx * u, y); ctx.stroke(); }
  ctx.lineWidth = 0.025 * u; ctx.beginPath(); ctx.moveTo(x + 0.23 * u, y - 0.3 * u); ctx.quadraticCurveTo(x + 0.33 * u, y - 0.3 * u, x + 0.3 * u, y - 0.45 * u); ctx.stroke();
  ctx.restore();
}
// a cleared arena's gilding: a gold laurel round its champion
function laurel(ctx, x, y, r) {
  // a small laurel (a badge beside a number) has leaves to its own size
  const small = r < 20, lx2 = small ? r * 0.36 : 6, ly2 = small ? r * 0.17 : 3;
  ctx.save(); ctx.strokeStyle = '#ffd24a'; ctx.fillStyle = '#ffd24a'; ctx.lineWidth = small ? 1.5 : 2.5;
  for (const sd of [-1, 1]) {
    ctx.beginPath(); ctx.arc(x, y, r, Math.PI / 2 + sd * 0.35, Math.PI / 2 + sd * 2.6, sd < 0); ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 2 + sd * (0.6 + i * 0.36), lx = x + Math.cos(a) * r, ly = y + Math.sin(a) * r;
      ctx.beginPath(); ctx.ellipse(lx, ly, lx2, ly2, a + sd * 0.9, 0, 6.28); ctx.fill();
    }
  }
  ctx.restore();
}
function padlock(ctx, x, y, col) {
  ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y - 6, 7, Math.PI, 0); ctx.stroke();
  rrect(ctx, x - 10, y - 6, 20, 16, 3); ctx.fill();
  ctx.fillStyle = '#14101a'; ctx.beginPath(); ctx.arc(x, y + 1, 2.5, 0, 6.28); ctx.fill();
  ctx.restore();
}

// A page that scrolls: rects laid out in cols columns of rows rh tall from y0, shifted by the scroll, and the most it can scroll (the list stops at
// the screen's safe bottom). A drag scrolls it; a tap is a tap (the engine tells them apart).
function scrollGrid(E, n, y0, rh, cols, scroll) {
  const gap = 10, L = 16 + E.safe.left, w = (E.w - 32 - E.safe.left - E.safe.right - gap * (cols - 1)) / cols, bot = E.h - E.safe.bottom - 8;
  const rows = Math.ceil(n / cols), max = Math.max(0, rows * (rh + gap) - gap - (bot - y0));
  const s = clamp(scroll, 0, max);
  return { s, max, y0, bot, rects: Array.from({ length: n }, (_, i) => ({ x: L + (i % cols) * (w + gap), y: y0 + Math.floor(i / cols) * (rh + gap) - s, w, h: rh })) };
}
const SCROLLS = {
  onPointerDown(p) { this.drag = { y: p.y, s: this.scroll }; },
  onPointerMove(p) { if (this.drag) this.scroll = clamp(this.drag.s - (p.y - this.drag.y), 0, this.maxScroll || 0); },
  onPointerUp() { this.drag = null; },
};
// a page's head: its title, Back, your fame at the right, and Brutus's line under it
function pageHead(ctx, E, title, line) {
  const top = E.safe.top, ft = `${E.save.get('fame', 0)} fame`, R = E.w - 16 - E.safe.right;
  E.text(title, E.w / 2, top + 28, { size: fitSize(ctx, title, 22, E.w - 300), weight: '800', color: '#e6c866' });
  const back = E.button('Back', 16 + E.safe.left + 44, top + 28, { w: 88, h: 44, size: 16, fill: '#1f2937' });
  ctx.font = '800 16px system-ui, sans-serif';
  laurel(ctx, R - ctx.measureText(ft).width - 18, top + 28, 8); E.text(ft, R, top + 28, { size: 16, weight: '800', align: 'right', color: '#ffd24a' });
  if (line) sayLine(ctx, E, `Old Brutus: “${line}”`, E.w / 2, top + 60, E.w - 32, { size: 14, fit: true, weight: '700', color: '#fde68a' }, 'brutus');
  return back;
}
// the ludus's courtyard behind its pages: a colonnade of arches over the sand
function drawCourtyard(ctx, E) {
  const g = ctx.createLinearGradient(0, 0, 0, E.h); g.addColorStop(0, '#1c1424'); g.addColorStop(0.62, '#2a2016'); g.addColorStop(0.63, '#5e4a2c'); g.addColorStop(1, '#3e3020');
  ctx.fillStyle = g; ctx.fillRect(0, 0, E.w, E.h);
  ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = '#6b5a44'; ctx.strokeStyle = '#6b5a44'; ctx.lineWidth = 8;
  const aw = 70, ay = E.h * 0.62, ah = E.h * 0.4;
  for (let x = -20; x < E.w + aw; x += aw) { ctx.fillRect(x, ay - ah, 12, ah); ctx.beginPath(); ctx.arc(x + aw / 2 + 6, ay - ah, aw / 2 - 6, Math.PI, 0); ctx.stroke(); }
  ctx.fillRect(0, ay - ah - aw / 2 - 10, E.w, 10);
  ctx.restore();
}
// each station's mark, s px tall, centred at (x, y): a weapon rack, the barracks' roof and door, the training post, the shrine's temple, the tailor's plume
function stationIcon(ctx, id, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = '#e6c866'; ctx.fillStyle = '#e6c866'; ctx.lineWidth = Math.max(2, s * 0.05); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const u = s / 2;
  if (id === 'armoury') {
    line(ctx, -u * 0.8, u * 0.8, u * 0.7, -u * 0.8); line(ctx, u * 0.8, u * 0.8, -u * 0.7, -u * 0.8);
    for (const k of [-0.18, 0, 0.18]) line(ctx, u * 0.7 + k * u, -u * 0.8, u * 0.7 + k * u * 1.6, -u * 1.05);
    line(ctx, -u * 0.55, -u * 0.55, -u * 0.85, -u * 0.25); line(ctx, -u, u * 0.95, u, u * 0.95);
  } else if (id === 'barracks') {
    ctx.beginPath(); ctx.moveTo(-u, -u * 0.15); ctx.lineTo(0, -u * 0.9); ctx.lineTo(u, -u * 0.15); ctx.stroke();
    ctx.strokeRect(-u * 0.8, -u * 0.15, u * 1.6, u * 1.05); ctx.fillRect(-u * 0.2, u * 0.3, u * 0.4, u * 0.6);
    for (const k of [-0.55, 0.35]) ctx.strokeRect(k * u, u * 0.05, u * 0.2, u * 0.2);
  } else if (id === 'training') {
    ctx.fillStyle = '#8a5a2b'; ctx.fillRect(-u * 0.12, -u * 0.6, u * 0.24, u * 1.55); ctx.fillRect(-u * 0.65, -u * 0.25, u * 1.3, u * 0.18);
    ctx.fillStyle = '#e6c866'; ctx.beginPath(); ctx.arc(0, -u * 0.78, u * 0.24, 0, TAU); ctx.fill(); line(ctx, -u * 0.8, u * 0.95, u * 0.8, u * 0.95);
  } else if (id === 'shrine') {
    ctx.beginPath(); ctx.moveTo(-u, -u * 0.45); ctx.lineTo(0, -u * 0.95); ctx.lineTo(u, -u * 0.45); ctx.closePath(); ctx.stroke();
    for (const k of [-0.75, -0.25, 0.25, 0.75]) line(ctx, k * u, -u * 0.35, k * u, u * 0.7);
    ctx.fillRect(-u, u * 0.72, u * 2, u * 0.2);
  } else {
    for (const k of [-0.5, 0, 0.5]) { ctx.save(); ctx.rotate(k); ctx.beginPath(); ctx.ellipse(0, -u * 0.35, u * 0.22, u * 0.62, 0, 0, TAU); ctx.fillStyle = k ? '#c8372a' : '#efe6cf'; ctx.fill(); ctx.restore(); }
    line(ctx, -u * 0.8, u * 0.85, u * 0.6, u * 0.25); ctx.beginPath(); ctx.arc(u * 0.68, u * 0.2, u * 0.08, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}
// an unlock's mark in a roundel of radius r: its weapon, a fighter's shape, its family's mark, the cards, her key, or the tailor's colour
function unlockMark(ctx, q, x, y, r, style) {
  const id = q.id;
  ctx.save(); ctx.fillStyle = id === 'trident' || id === 'sica' ? '#d9cfb4' : '#1a1422'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.strokeStyle = '#e6c866'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  if (id === 'trident') {
    // a bold trident glyph (the drawn weapon's prongs are hairlines at this size)
    ctx.save(); ctx.translate(x, y); ctx.rotate(0.55); ctx.strokeStyle = '#2a1d12'; ctx.fillStyle = '#2a1d12'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2.5, r * 0.15);
    line(ctx, 0, r * 0.8, 0, -r * 0.35); line(ctx, -r * 0.4, -r * 0.35, r * 0.4, -r * 0.35);
    for (const k of [-0.4, 0, 0.4]) { line(ctx, k * r, -r * 0.35, k * r, -r * 0.62); ctx.beginPath(); ctx.moveTo(k * r - r * 0.13, -r * 0.55); ctx.lineTo(k * r, -r * 0.82); ctx.lineTo(k * r + r * 0.13, -r * 0.55); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  } else if (id === 'sica') {
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r - 1, 0, TAU); ctx.clip(); ctx.translate(x, y); ctx.rotate(-0.5);
    weaponIcon(ctx, { weapon: iconWeapon(id) }, -r * 0.55, 0, r * 3.2); ctx.restore();
  }
  else if (FAMS[id]) { ctx.save(); ctx.translate(x, y); ctx.fillStyle = ctx.strokeStyle = FAMS[id].col; ctx.lineWidth = 2; famGlyph(ctx, id, r / 8); ctx.restore(); }
  else if (q.station === 'barracks') silhouette(ctx, x - r * 0.05, y + r * 0.72, r * 1.35, '#c4b99a');
  else if (id === 'slot' || id === 'fourth') {
    const n = id === 'slot' ? 1 : 4, cw = r * 0.5, ch = r * 0.75;
    for (let i = 0; i < n; i++) { const cx = x + (i - (n - 1) / 2) * cw * 0.6; ctx.fillStyle = i === n - 1 ? '#ffd24a' : '#c4b99a'; ctx.strokeStyle = '#1a1422'; ctx.lineWidth = 1.5; rrect(ctx, cx - cw / 2, y - ch / 2, cw, ch, 3); ctx.fill(); ctx.stroke(); }
  } else if (id === 'promise') keyIcon(ctx, x - r * 0.6, y, r * 1.2);
  else {
    const k = Math.max(0, style), col = TAILOR[id][k][1];
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = col; ctx.strokeStyle = shade(col, 0.45); ctx.lineWidth = 1.5;
    if (id === 'crest') { ctx.beginPath(); ctx.ellipse(0, r * 0.15, r * 0.6, r * 0.35, 0, Math.PI, 0); ctx.fill(); ctx.stroke(); }
    else if (id === 'plume') { for (const a of [-0.4, 0, 0.4]) { ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(0, -r * 0.1, r * 0.17, r * 0.55, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore(); } }
    else if (id === 'paint') { ctx.beginPath(); ctx.arc(0, 0, r * 0.66, 0, TAU); ctx.fillStyle = '#9a6a2f'; ctx.fill(); ctx.stroke(); shieldPaint(ctx, r * 0.66, { i: k, col }); }
    else { ctx.beginPath(); ctx.moveTo(-r * 0.25, -r * 0.55); ctx.lineTo(r * 0.25, -r * 0.55); ctx.lineTo(r * 0.5, r * 0.55); ctx.lineTo(-r * 0.5, r * 0.55); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }
}

// Brutus's ludus (E): the courtyard's five stations in a row, each its mark, its name, one line and how much of it you have opened; a station's page,
// its unlocks in two columns, each its mark, its name, one line, and its price (OPEN once bought, or the style you wear); one tap buys one, or steps a
// tailor's look through its styles and off. The training ground's slot opens the cards you have picked before. Principle 11: three text items an element.
const ludus = {
  ...SCROLLS,
  enter(E, params = {}) { this.st = params.station || null; this.pick = false; this.scroll = 0; this.maxScroll = 0; this.drag = null; this.cards = []; this.rows = []; this.back = null; },
  render(ctx, E) {
    this.cards = []; this.rows = []; this.back = null;
    if (portrait(E)) { rotateCard(ctx, E); return; }
    drawCourtyard(ctx, E);
    if (this.pick) { this.drawPick(ctx, E); return; }
    const S = LUDUS.find((q) => q.id === this.st);
    if (S) { this.drawStation(ctx, E, S); return; }
    this.back = pageHead(ctx, E, 'THE LUDUS', 'My school. Your fame pays for it.');
    const L = ludusOf(E), n = LUDUS.length, gap = 10, top = E.safe.top + 80, w = Math.min(180, (E.w - 32 - E.safe.left - E.safe.right - gap * (n - 1)) / n);
    const h = Math.min(240, E.h - top - 12 - E.safe.bottom), x0 = (E.w - (w * n + gap * (n - 1))) / 2, LT = TUNING.ludus;
    const nameL = (S2) => wrapPx(ctx, S2.name.toUpperCase(), w - 12, 14, '800').slice(0, 3), lineL = (S2) => wrapPx(ctx, S2.line, w - 14, 14, '600').slice(0, LT.hubLines);
    // the icon takes what the tallest name and line leave (name, gap, line, then the count at the foot)
    const textH = Math.max(...LUDUS.map((S2) => (nameL(S2).length + lineL(S2).length) * 17 + 6)), ih = Math.max(LT.hubIcon, Math.min(64, h * 0.28, h - 26 - 16 - 22 - textH));
    LUDUS.forEach((S2, i) => {
      const x = x0 + i * (w + gap), cx = x + w / 2, got = S2.items.filter((q) => L.includes(q.id)).length, all = got === S2.items.length;
      E.roundRect(x, top, w, h, 14, 'rgba(34,26,18,0.92)', all ? '#ffd24a' : '#e6c866');
      stationIcon(ctx, S2.id, cx, top + 12 + ih / 2, ih);
      // the name (wrapped, one item), its line (wrapped, one item), how much is open
      let y = top + 26 + ih;
      for (const t of nameL(S2)) { E.text(t, cx, y, { size: 14, weight: '800', color: '#f0e6cc' }); y += 17; }
      y += 6;
      for (const t of lineL(S2)) { E.text(t, cx, y, { size: 14, color: '#cbd5e1' }); y += 17; }
      E.text(all ? 'All open' : `${got} of ${S2.items.length} open`, cx, top + h - 16, { size: 14, weight: '800', color: all ? '#ffd24a' : '#86efac' });
      this.cards.push({ x, y: top, w, h, id: S2.id });
    });
  },
  drawStation(ctx, E, S) {
    this.back = pageHead(ctx, E, S.name.toUpperCase(), S.brutus);
    const L = ludusOf(E), T = E.save.get('tailor', {}), fame = E.save.get('fame', 0), sp = startPick(E), cols = E.w >= 560 ? 2 : 1;
    const LT = TUNING.ludus, lw = (E.w - 32 - E.safe.left - E.safe.right - 10 * (cols - 1)) / cols - 74;
    const rowLines = Math.max(...S.items.map((q) => Math.min(LT.rowLines, wrapPx(ctx, q.line, lw, 14, '600').length)));
    const G = scrollGrid(E, S.items.length, E.safe.top + 80, Math.max(LT.rowMin, LT.rowBase + LT.rowLine * rowLines), cols, this.scroll);
    this.scroll = G.s; this.maxScroll = G.max;
    ctx.save(); ctx.beginPath(); ctx.rect(0, G.y0 - 4, E.w, G.bot - G.y0 + 8); ctx.clip();
    S.items.forEach((q0, i) => {
      const q = LUDUS_ITEM[q0.id], r = G.rects[i], own = L.includes(q.id), price = TUNING.ludus.price[q.id], st = TAILOR[q.id] ? (T[q.id] != null ? T[q.id] : 0) : 0;
      const tag = !own ? `${price} fame` : TAILOR[q.id] ? (st >= 0 ? TAILOR[q.id][st][0] : 'Off') : q.id === 'slot' ? (sp ? CARD[sp].name : 'None') : 'OPEN';
      const tc = !own ? (fame >= price ? '#ffd24a' : '#9aa4b2') : TAILOR[q.id] || q.id === 'slot' ? '#c4b5fd' : '#4ade80';
      E.roundRect(r.x, r.y, r.w, r.h, 12, own ? 'rgba(29,42,34,0.94)' : 'rgba(42,32,22,0.94)', own ? '#4ade80' : fame >= price ? '#e6c866' : 'rgba(240,230,204,0.3)');
      unlockMark(ctx, q, r.x + 32, r.y + r.h / 2, 20, st);
      ctx.font = '800 14px system-ui, sans-serif';
      const tw = ctx.measureText(tag).width, nx = r.x + 62;
      E.text(clipLine(ctx, q.name, r.w - 62 - tw - 22, 16, '800'), nx, r.y + 20, { size: 16, weight: '800', align: 'left', color: '#f0e6cc' });
      E.text(tag, r.x + r.w - 12, r.y + 20, { size: 14, weight: '800', align: 'right', color: tc });
      wrapPx(ctx, q.line, r.w - 74, 14, '600').slice(0, LT.rowLines).forEach((t, k) => E.text(t, nx, r.y + 42 + k * LT.rowLine, { size: 14, align: 'left', color: '#cbd5e1' }));
      if (r.y + r.h > G.y0 && r.y < G.bot) this.rows.push({ ...r, q });
    });
    ctx.restore();
  },
  // the training ground's slot: the cards you have picked before (and none), one a tap
  drawPick(ctx, E) {
    this.back = pageHead(ctx, E, 'YOUR START CARD', 'Pick what you trust. You start every run with it.');
    const ids = ['', ...E.save.get('picked', []).filter(startable)], sp = startPick(E), cols = Math.max(1, Math.floor((E.w - 32) / 190));
    if (ids.length === 1) E.text('Pick cards in your drafts first: they wait here.', E.w / 2, E.safe.top + 96, { size: 14, weight: '700', color: '#c4b99a' });
    const G = scrollGrid(E, ids.length, E.safe.top + (ids.length === 1 ? 120 : 80), 52, cols, this.scroll);
    this.scroll = G.s; this.maxScroll = G.max;
    ctx.save(); ctx.beginPath(); ctx.rect(0, G.y0 - 4, E.w, G.bot - G.y0 + 8); ctx.clip();
    ids.forEach((id, i) => {
      const r = G.rects[i], on = id === sp, c = id ? CARD[id] : null;
      E.roundRect(r.x, r.y, r.w, r.h, 10, on ? 'rgba(124,58,237,0.45)' : 'rgba(34,26,43,0.94)', on ? '#c4b5fd' : c ? FAMS[c.fam].col : '#c4b99a');
      if (c) drawIcon(ctx, id, r.x + 26, r.y + r.h / 2, 15);
      E.text(clipLine(ctx, c ? c.name : 'None', r.w - 60), r.x + (c ? 50 : r.w / 2), r.y + r.h / 2, { size: 14, weight: '800', align: c ? 'left' : 'center', color: on ? '#ffffff' : '#f0e6cc' });
      if (r.y + r.h > G.y0 && r.y < G.bot) this.rows.push({ ...r, card: id });
    });
    ctx.restore();
  },
  buy(E, q, r) {
    const L = ludusOf(E), price = TUNING.ludus.price[q.id], fame = E.save.get('fame', 0);
    if (fame < price) { E.audio.play('miss'); E.toast(`${q.name} needs ${price} fame. You have ${fame}.`); return; }
    E.save.set('fame', fame - price); E.save.set('ludus', [...L, q.id]);
    if (TAILOR[q.id]) E.save.set('tailor', { ...E.save.get('tailor', {}), [q.id]: 0 });
    E.audio.play('coin'); E.haptic(20);
    E.particles.emit({ x: r.x + 32, y: r.y + r.h / 2, count: 30, speed: 240, life: 0.8, size: 4, color: '#ffd24a', gravity: 200 });
  },
  onTap(p, E) {
    if (portrait(E)) return;
    if (this.back && E.hit(this.back, p)) { E.audio.play('tap'); if (this.pick) this.pick = false; else if (this.st) this.st = null; else E.setScene('menu'); this.scroll = 0; return; }
    if (this.pick) {
      const r = this.rows.find((q) => E.hit(q, p)); if (!r) return;
      E.save.set('startPick', r.card); E.audio.play('tap'); this.pick = false; this.scroll = 0; return;
    }
    if (!this.st) { const c = this.cards.find((q) => E.hit(q, p)); if (c) { E.audio.play('tap'); this.st = c.id; this.scroll = 0; } return; }
    const r = this.rows.find((q) => E.hit(q, p)); if (!r) return;
    const q = r.q;
    if (!ludusOf(E).includes(q.id)) { this.buy(E, q, r); return; }
    if (TAILOR[q.id]) {
      const T = E.save.get('tailor', {}), n = TAILOR[q.id].length, cur = T[q.id] != null ? T[q.id] : 0;
      E.save.set('tailor', { ...T, [q.id]: cur + 1 >= n ? -1 : cur + 1 }); E.audio.play('tap'); E.haptic(8);
    } else if (q.id === 'slot') { this.pick = true; this.scroll = 0; E.audio.play('tap'); }
    else E.audio.play('tap');
  },
};

// The Wall of Champions (E): every fighter who cleared an arena, newest first, each a stone plaque: their name, origin and weapon, and the arena they
// cleared. A plaque with an open arena above it is gilded: a tap starts a run with them as a veteran (the arena picker shows where they may fight).
const champs = {
  ...SCROLLS,
  enter() { this.scroll = 0; this.maxScroll = 0; this.drag = null; this.rows = []; this.back = null; },
  render(ctx, E) {
    this.rows = []; this.back = null;
    if (portrait(E)) { rotateCard(ctx, E); return; }
    drawCourtyard(ctx, E);
    this.back = pageHead(ctx, E, 'THE WALL OF CHAMPIONS', 'Every name here walked out of the sand.');
    const L = E.save.get('champs', []), cols = E.w >= 560 ? 2 : 1;
    if (!L.length) { E.text("No champion yet. Fell an arena's champion to be carved here.", E.w / 2, E.h / 2, { size: 16, weight: '700', color: '#c4b99a' }); return; }
    const G = scrollGrid(E, L.length, E.safe.top + 80, 66, cols, this.scroll);
    this.scroll = G.s; this.maxScroll = G.max;
    ctx.save(); ctx.beginPath(); ctx.rect(0, G.y0 - 4, E.w, G.bot - G.y0 + 8); ctx.clip();
    L.forEach((c, i) => {
      const r = G.rects[i], ok = vetArenas(E, c).length > 0, A = ARENA[c.arena] || ARENAS[0];
      E.roundRect(r.x, r.y, r.w, r.h, 10, ok ? 'rgba(58,47,34,0.96)' : 'rgba(58,50,44,0.9)', ok ? '#ffd24a' : '#5a4e44');
      laurel(ctx, r.x + 26, r.y + r.h / 2, 13);
      const org = c.origin && ORIGINS[c.origin] ? ORIGINS[c.origin].text.replace(/^an? /, '') : null, wpn = c.weapon ? (c.weapon === 'axe' && c.mace ? 'Mace' : TUNING.me.wheels.weapon.find((e) => e[0] === c.weapon)[2].replace('Axe/mace', 'Axe')) : null;
      // the weapon always shows: when origin and weapon do not fit, the place goes
      ctx.font = '700 14px system-ui, sans-serif';
      const whoOf = (o) => [o, wpn].filter(Boolean).join(' \u00b7 '), who = (ctx.measureText(whoOf(org)).width > r.w - 60 ? whoOf(org && org.replace(/ from .*$/, '')) : whoOf(org)) || 'A champion of the old days';
      E.text(clipLine(ctx, c.name, r.w - 60, 16, '800'), r.x + 50, r.y + 17, { size: 16, weight: '800', align: 'left', color: '#fde68a' });
      E.text(clipLine(ctx, who, r.w - 60), r.x + 50, r.y + 36, { size: 14, align: 'left', color: '#e2e8f0' });
      E.text(clipLine(ctx, ok ? `${A.short} cleared · tap to fight again` : `${A.short} cleared`, r.w - 60), r.x + 50, r.y + 54, { size: 14, weight: '700', align: 'left', color: ok ? '#ffd24a' : '#c4b99a' });
      if (r.y + r.h > G.y0 && r.y < G.bot) this.rows.push({ ...r, c, ok });
    });
    ctx.restore();
  },
  onTap(p, E) {
    if (portrait(E)) return;
    if (this.back && E.hit(this.back, p)) { E.audio.play('tap'); E.setScene('menu'); return; }
    const r = this.rows.find((q) => E.hit(q, p)); if (!r) return;
    if (r.ok) { E.audio.play('tap'); E.setScene('arenas', { vet: r.c }); return; }
    E.audio.play('miss');
    E.toast(!r.c.me ? 'From before the Wall: no rolls kept to fight with' : r.c.arena === 'games' ? 'They cleared the Grand Games: no arena above' : 'Open the arena above theirs first');
  },
};

// The roll: one big wheel at a time, in the eight wheels' order, with progress pips above it, its odds and what reshaped them beside it, and your fighter's
// card building on the right as each answer lands; then the card with the strip of small wheels (tap one, then Respin rolls it again with the run's one token) and Fight!. Each wheel: its slices grow and
// shrink from the plain wheel (TUNING.me.roll.shape s, or wait when nothing changed), it spins (a tap spins it at once), a tap snaps it to its landing,
// and the answer holds (a tap moves on). The landings were all decided by rollMe; the wheels only show them.
const isRare = (k, v) => { const R = TUNING.me.rare[k === 0 ? 'size' : ME_WHEEL[k]]; return !!R && R.includes(v); };
const roll = {
  // a veteran (params.vet, from the Wall of Champions) keeps their rolls: no wheels, no respin, straight to their card
  enter(E, params) {
    const open = ludusOf(E), extra = startPick(E);
    this.seed = params.seed; this.arena = params.arena || 'pit'; this.vet = params.vet || null; this.cardT = 0; this.landT = [];
    this.me = this.vet ? vetMe(this.vet, open, extra) : { ...rollMe(this.seed, open), extra };
    this.btn = this.respinBtn = null; this.token = TUNING.token; this.used = ''; this.sel = -1; this.spin = null; this.prev = null;
    this.at(this.vet ? WHEELS.length : 0);
  },
  // wheel k, before its spin: its plain weights (a stat wheel's B tier) and the reshaped ones it spins on
  at(k) {
    Object.assign(this, { i: k, ph: 'shape', t: 0, rot: 0, tick: 0, flash: 0, pop: 0, lastTick: -9 });
    if (k >= WHEELS.length) return;
    this.w1 = WHEELS[k].list(this.me).map((e) => e[1]);
    this.w0 = ME_WHEEL[k] === 'stat' ? TUNING.me.statTiers.B.slice() : this.w1.slice();
    this.shaped = this.w0.some((q, j) => q !== this.w1[j]);
  },
  weights() {
    if (this.ph !== 'shape' || !this.shaped) return this.w1;
    const u = ease.inOut(clamp(this.t / TUNING.me.roll.shape, 0, 1));
    return this.w0.map((q, j) => lerp(q, this.w1[j], u));
  },
  // the big wheel's place, its odds column and the card column
  lay(E) {
    const top = E.safe.top, bot = E.h - E.safe.bottom, L = 16 + E.safe.left, Rx = E.w - 16 - E.safe.right, cw = clamp(E.w * 0.27, 180, 250);
    const r = Math.min((bot - top - 130) / 2.2, E.w * 0.42 / 2.2), cx = L + r * 1.1 + 6, cy = top + 50 + r * 1.1 + 10;
    return { top, bot, r, cx, cy, lx: cx + r * 1.1 + 22, lw: Rx - cw - 14 - (cx + r * 1.1 + 22), kx: Rx - cw, kw: cw, ky: top + 44, kh: bot - top - 60 };
  },
  update(dt, E) {
    if (portrait(E)) return;
    const M = TUNING.me, R = M.roll;
    if (this.spin) { this.spin.t += dt; if (this.spin.t >= M.spin) { this.spin = null; this.prev = null; this.sel = -1; E.audio.beep({ freq: 660, dur: 0.1, type: 'triangle', gain: 0.12 }); E.haptic(12); } }
    if (this.i >= WHEELS.length) { this.cardT += dt; return; }
    this.t += dt; this.tick *= Math.exp(-dt * 14); this.flash = Math.max(0, this.flash - dt * 2.5);
    if (this.ph === 'shape') { if (this.t >= (this.shaped ? R.shape : R.wait)) this.go(E); }
    else if (this.ph === 'spin') {
      const u = clamp(this.t / R.spin, 0, 1), r1 = spinRot(this.w1, this.me.idx[this.i], u);
      if (pegsPassed(this.w1, this.rot, r1)) {
        this.tick = -0.5 * Math.sign(r1 - this.rot);
        if (E.time - this.lastTick > R.tickGap) { this.lastTick = E.time; tickSound(E, Math.abs(r1 - this.rot) / Math.max(dt, 1e-3)); }
      }
      this.rot = r1;
      if (u >= 1) this.land(E);
    } else {
      this.pop = Math.min(1, this.pop + dt * 8);
      if (this.t >= R.hold) this.at(this.i + 1);
    }
  },
  go(E) { this.ph = 'spin'; this.t = 0; this.rot = 0; E.audio.beep({ freq: 300, dur: 0.14, type: 'triangle', slide: 1.8, gain: 0.1 }); E.haptic(8); },
  // the landing: the slice flashes and pops out, the answer drops in; a rare sliver bursts and the crowd oohs
  land(E) {
    const k = this.i, j = this.me.idx[k], e = WHEELS[k].list(this.me)[j], L = this.lay(E);
    Object.assign(this, { ph: 'land', t: 0, rot: spinRot(this.w1, j, 1), flash: 1, pop: 0, tick: 0 });
    this.landT[k] = E.time;
    E.audio.beep({ freq: 440 + k * 60, dur: 0.1, type: 'triangle', gain: 0.13 }); E.audio.beep({ freq: 880 + k * 120, dur: 0.16, type: 'sine', gain: 0.07, delay: 0.06 });
    const [s, en] = sliceArcs(this.w1)[j], a = -Math.PI / 2 + this.rot + (s + en) / 2, px = L.cx + Math.cos(a) * L.r * 0.7, py = L.cy + Math.sin(a) * L.r * 0.7;
    if (isRare(k, e[0])) {
      E.particles.emit({ x: px, y: py, count: 46, speed: 340, life: 0.9, size: 5, color: '#ffd24a', gravity: 260 });
      E.particles.emit({ x: px, y: py, count: 24, speed: 220, life: 0.7, size: 4, color: '#ffffff', gravity: 160 });
      ooh(E, 1); E.haptic(30);
    } else { E.particles.emit({ x: px, y: py, count: 12, speed: 160, life: 0.45, size: 3, color: '#fde68a' }); E.haptic(10); }
  },
  // the card stage's strip of small wheels: one column per wheel, the whole column is its tap target
  strip(E) {
    const n = WHEELS.length, top = E.safe.top + 4, cw = (E.w - 32 - E.safe.left - E.safe.right) / n, r = Math.min(cw * 0.26, 15);
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
    const M = TUNING.me, me = this.me;
    if (this.i < WHEELS.length) { this.drawWheels(ctx, E); return; }
    const S = this.strip(E), sp = this.spin, k = clamp(this.cardT / 0.25, 0, 1);
    WHEELS.forEach((wh, j) => {
      const cx = S.x0 + S.cw * (j + 0.5), w = wh.list(me).map((e) => e[1]), u = sp && sp.k === j ? clamp(sp.t / M.spin, 0, 1) : 1;
      if (this.sel === j) E.roundRect(cx - S.cw / 2 + 3, S.top, S.cw - 6, S.bottom - S.top, 10, 'rgba(124,58,237,0.35)', '#c4b5fd');
      drawWheel(ctx, E, wh, cx, S.cy, S.r, { rot: wheelRest(w, me.idx[j]) - M.turns * Math.PI * 2 * Math.pow(1 - u, 3), w, landed: u < 1 ? -1 : me.idx[j] });
      E.text(wh.title, cx, S.cy + S.r + 11, { size: 10, weight: '800', color: this.sel === j ? '#ffffff' : '#c4b99a' });
      const e = wh.list(me)[me.idx[j]];
      if (u >= 1) E.text(typeof e[0] === 'number' ? `${e[0]} ${e[2]}` : e[2], cx, S.cy + S.r + 24, { size: 11, weight: '700', color: '#ffd24a' });
    });
    const shown = this.prev || me, w = Math.min(E.w - 32, 480), y = S.bottom + 4, h = Math.min(E.h - E.safe.bottom - y - 6, 290), x = (E.w - w) / 2;
    ctx.globalAlpha = k;
    drawMeCard(ctx, E, shown, x, y + (1 - k) * 30, w, h);
    ctx.globalAlpha = 1;
    const by = y + h - 32, pick = this.sel >= 0;
    this.respinBtn = this.vet ? null : tokenButton(E, pick ? `Respin ${WHEELS[this.sel].title.toLowerCase()}` : 'Respin', x + 108, by, this.token, pick && !sp, this.token > 0 && !pick ? '1 left · tap a wheel' : null);
    this.btn = E.button('Fight!', x + w - 92, by, { w: 150, h: 48, size: 20, fill: '#b45309' });
  },
  drawWheels(ctx, E) {
    const me = this.me, L = this.lay(E), k = this.i, wh = WHEELS[k], list = wh.list(me), j = me.idx[k], landed = this.ph === 'land', w = this.weights();
    E.text('ROLL YOUR FIGHTER', 16 + E.safe.left, L.top + 20, { size: 16, weight: '800', align: 'left', color: '#e6c866' });
    // progress pips: one per wheel, gold once answered, the current one pulsing
    for (let n = 0; n < WHEELS.length; n++) {
      const px = E.w / 2 + (n - (WHEELS.length - 1) / 2) * 22, done = n < k || (n === k && landed), cur = n === k && !landed;
      ctx.beginPath(); ctx.arc(px, L.top + 20, cur ? 6 + Math.sin(E.time * 8) : 6, 0, 6.283);
      ctx.fillStyle = done ? '#ffd24a' : cur ? '#7c3aed' : 'rgba(240,230,204,0.15)'; ctx.fill();
      ctx.strokeStyle = cur ? '#ffffff' : '#14101a'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    const grow = this.shaped && !landed ? w.map((q, n) => Math.sign(Math.round(this.w1[n] - this.w0[n]))) : null;
    drawWheel(ctx, E, wh, L.cx, L.cy, L.r, { rot: this.rot, w, landed: landed ? j : -1, names: list.map((e) => e[2]), pop: ease.outBack(this.pop), flash: this.flash, tick: this.tick, grow });
    // the answer drops in below the wheel
    const e = list[j], rare = isRare(k, e[0]), ay = L.cy + L.r * 1.1 + 26;
    if (landed) {
      const u = clamp(this.t / 0.22, 0, 1), ans = `${e[2].toUpperCase()}!`, sz = Math.max(14, fitSize(ctx, ans, rare ? 36 : 30, L.r * 2.4));
      E.text(ans, L.cx, ay - (1 - ease.outBack(u)) * 30, { size: sz * (rare ? 1 + 0.06 * Math.sin(E.time * 10) : 1), weight: '800', color: rare ? '#ffd24a' : '#f0e6cc', alpha: u });
    }
    const hint = landed ? (rare ? 'A rare sliver! The crowd loves it.' : 'tap for the next wheel') : this.ph === 'spin' ? 'tap to snap' : 'tap to spin';
    E.text(hint, landed ? L.cx : E.w / 2, L.bot - 12, { size: 14, weight: '700', color: rare && landed ? '#ffd24a' : '#c4b99a', alpha: 0.65 + 0.35 * Math.sin(E.time * 4) });
    this.drawOdds(ctx, E, L, wh, list, w);
    this.drawBuild(ctx, E, L);
  },
  // the odds column: the wheel's name and tier, what reshaped it, then each slice's share now (and its change from the plain wheel)
  drawOdds(ctx, E, L, wh, list, w) {
    const k = this.i, st = ME_WHEEL[k] === 'stat' ? statTier(k, this.me.idx) : null, x = L.lx, lw = L.lw, landed = this.ph === 'land';
    let y = L.cy - L.r * 1.1 + 6;
    const head = `${wh.title}${st ? ` · ${st.tier}-TIER` : ''}`;
    E.text(head, x, y, { size: Math.max(14, fitSize(ctx, head, 17, lw)), weight: '800', align: 'left', color: st ? TIER_COL[st.tier] : '#f0e6cc' });
    y += 22;
    const why = [];
    if (st && st.tilt) why.push([`${TUNING.me.sizes[st.band].name[0]}${TUNING.me.sizes[st.band].name.slice(1).toLowerCase()}: top slices ${st.tilt > 0 ? 'grow' : 'shrink'}`, st.tilt > 0]);
    if (st && st.prev) { const pe = TUNING.me.wheels.stat[this.me.idx[k - 1]]; why.push([`After ${pe[2]} ${WHEELS[k - 1].title.toLowerCase()}: top slices ${st.prev > 0 ? 'grow' : 'shrink'}`, st.prev > 0]); }
    if (st && !why.length) why.push(['A plain wheel', null]);
    for (const [t, up] of why) for (const ln of wrapPx(ctx, t, lw, 14, '700').slice(0, 2)) { E.text(ln, x, y, { size: 14, weight: '700', align: 'left', color: up == null ? '#9aa4b2' : up ? '#86efac' : '#fca5a5' }); y += 17; }
    y += 6;
    // a slice the ludus has not opened is not on the wheel, so not in its odds
    const rows = list.map((e, n) => n).filter((n) => this.w1[n] > 0 || this.w0[n] > 0);
    const tot = w.reduce((a, q) => a + q, 0), t0 = this.w0.reduce((a, q) => a + q, 0), t1 = this.w1.reduce((a, q) => a + q, 0), rh = Math.min(22, (L.bot - 40 - y) / rows.length);
    rows.forEach((n, ri) => {
      const e = list[n], ry = y + ri * rh, hit = landed && n === this.me.idx[k], pct = Math.round(w[n] / tot * 100), d = Math.round(this.w1[n] / t1 * 100) - Math.round(this.w0[n] / t0 * 100);
      if (hit) E.roundRect(x - 4, ry - rh / 2, lw + 4, rh, 6, 'rgba(255,210,74,0.18)', null);
      ctx.fillStyle = sliceCol(wh, n); ctx.fillRect(x, ry - 6, 12, 12);
      E.text(e[2], x + 18, ry, { size: 14, weight: hit ? '800' : '700', align: 'left', color: hit ? '#ffd24a' : '#e2e8f0' });
      E.text(`${pct}%`, x + lw - 40, ry, { size: 14, weight: '800', align: 'right', color: hit ? '#ffd24a' : '#c4b99a' });
      if (this.shaped && d) E.text(`${d > 0 ? '▲' : '▼'}${Math.abs(d)}`, x + lw, ry, { size: 14, weight: '800', align: 'right', color: d > 0 ? '#4ade80' : '#f87171' });
    });
  },
  // your card, building as the answers land: each row slides in and glows gold for a moment
  drawBuild(ctx, E, L) {
    const me = this.me, M = TUNING.me, done = this.i + (this.ph === 'land' ? 1 : 0), x = L.kx, w = L.kw, rh = Math.min(30, (L.kh - 34) / WHEELS.length);
    E.roundRect(x, L.ky, w, 34 + rh * WHEELS.length, 14, '#1d2a2a', '#4ade80');
    E.text(me.name.toUpperCase(), x + w / 2, L.ky + 17, { size: Math.max(14, fitSize(ctx, me.name.toUpperCase(), 16, w - 16)), weight: '800', color: '#9fe3c6' });
    for (let n = 0; n < WHEELS.length; n++) {
      const y = L.ky + 34 + rh * (n + 0.5), e = WHEELS[n].list(me)[me.idx[n]];
      if (n >= done) { E.text(WHEELS[n].title, x + 10, y, { size: 14, weight: '700', align: 'left', color: 'rgba(196,185,154,0.35)' }); continue; }
      const age = this.landT[n] != null ? E.time - this.landT[n] : 9, slide = (1 - clamp(age / 0.2, 0, 1)) * 24, glow = clamp(1 - age / 0.6, 0, 1);
      if (glow > 0) E.roundRect(x + 4, y - rh / 2 + 2, w - 8, rh - 4, 6, `rgba(255,210,74,${0.3 * glow})`, null);
      E.text(WHEELS[n].title, x + 10 + slide, y, { size: 14, weight: '700', align: 'left', color: '#c4b99a' });
      if (ME_WHEEL[n] === 'stat') {
        const seg = Math.min(14, (w - 106) / 5);
        for (let q = 0; q < 5; q++) { ctx.fillStyle = q < e[0] ? '#e6c866' : 'rgba(255,255,255,0.12)'; ctx.fillRect(x + w - 10 - (5 - q) * seg + slide, y - 5, seg - 3, 10); }
      } else {
        const v = n === 0 ? `${e[2]}  ♥${M.sizes[e[0]].hearts * M.heartsPerBase}` : n === 5 ? weaponName(me) : e[2];
        E.text(v, x + w - 10 + slide, y, { size: Math.max(14, fitSize(ctx, v, 15, w - 100)), weight: '800', align: 'right', color: isRare(n, e[0]) ? '#ffd24a' : '#f0e6cc' });
      }
    }
  },
  onTap(p, E) {
    if (portrait(E)) return;
    if (this.i < WHEELS.length) {
      if (this.ph === 'shape') this.go(E); else if (this.ph === 'spin') this.land(E); else this.at(this.i + 1);
      return;
    }
    if (this.cardT <= 0.3 || this.spin) return;
    if (this.btn && E.hit(this.btn, p)) { E.audio.play('tap'); E.setScene('play', { seed: this.seed, arena: this.arena, me: this.me, token: this.token, tokenUsed: this.used }); return; }
    if (this.respinBtn && this.respinBtn.live && E.hit(this.respinBtn, p)) { this.respin(E); return; }
    const S = this.strip(E);
    if (!this.vet && this.token > 0 && p.y <= S.bottom + 4 && p.x >= S.x0 && p.x < S.x0 + S.cw * S.n) {
      const j = Math.floor((p.x - S.x0) / S.cw);
      this.sel = this.sel === j ? -1 : j; E.audio.play('tap'); E.haptic(6);
    }
  },
};

function initHand(E) {
  const h = state.hand, L = lay(E);
  const [sx, sy] = toScreen(youF(E), SHOULDER[0], SHOULDER[1]);
  [h.tgx, h.tgy] = guardPt(E);
  h.pang = Math.atan2(h.tgy - sy, h.tgx - sx);
  solveArm(E, 0);
  h.pux = h.ux; h.puy = h.uy; h.phx = h.hx; h.phy = h.hy; state.you.a = 0.05;
  poseYou(E, 0.016);
  poseFoe(E, 0.016);
}

const play = {
  state, lay, foeF, youF, toScreen, cardNums, newRack, raiseShield, dodge, fell, blockRun, ZONE, TUNING, rollMe, respinMe, solveArm, windFoe, gapHit, bout,
  walls, gapNow, dealDraft, openDraft, pickCard, rerollDraft, CARD, buildMove, startMove, shieldBtns, myBlade, bounce,
  emit, gainMom, addBleed, tellDodge, resolveSwing, HOOKS, lamed, applyCard, finReady, finList, finBtn, thumbFav, updateFinisher, checkHits, disable, noDodge, noShield, perfectWin, DECK, partCenter, updateBleed, ZONES, heldFams, dealable, boutGold, openTent, buyWare, leaveTent, priceOf,
  sizeOf, rollFighter, rollStats, wheelList, statTier, PROFILES, GAUNTLET, meSize,
  ARENAS, rollGauntlet, gradeBout, boutTally, openDraft, newRound, stepIn, updatePair, favour, bandOf, endingOf, edgeF, land, fakeOut, openNow, finCost, fireFinisher, crowdDrain, planExchange, rollGear, memoryOn, feintRead, startCard, foeLook, startCards, castNet, fameOf, carveChampion, vetMe, vetArenas, fameFromLedger, tailorOf, myLook, LUDUS, swapSpoil, spoilOf, wield, driving, saveRun, newRackAt: (E, i) => { state.rack = i; newRack(E); poseFoe(E, 0.016); },
  enter(E, params) {
    if (params.resume) resumeRun(E, params.resume); else newRound(E, params.seed, params.me || rollMe(params.seed), undefined, params.arena);
    newRack(E); initHand(E);
    if (state.draft) { state.intro = false; state.fallT = TUNING.resetDelay; state.foe.hp = 0; state.foe.shown = 0; }
    if (params.token != null && !params.resume) { state.token = params.token; state.tokenUsed = params.tokenUsed || ''; }
  },
  update(dt, E) {
    if (portrait(E)) return;
    popTop = E.safe.top + 80;
    if (state.draft) { state.draft.t += dt; return; }
    if (state.tent) { state.tent.t += dt; return; }
    if (state.caption) { state.caption.t -= dt; if (state.caption.t <= 0) state.caption = null; }
    // the juice's clocks run on real time: the fell's camera, the war paint, the banner, the heart's shatter, and its slow motion
    state.zoomT = Math.max(0, state.zoomT - dt); state.paintT = Math.max(0, state.paintT - dt);
    if (state.banner && (state.banner.t -= dt) <= 0) state.banner = null;
    if (state.shatter && (state.shatter.t -= dt) <= 0) state.shatter = null;
    if (state.slowFx > 0) { state.slowFx -= dt; dt *= state.slowMul; }
    // slow time: the open window's brief slow, and the whole of the first feint ever
    if (state.slowT > 0) { state.slowT -= dt; dt *= TUNING.openWin.slow; } else if (state.sw && state.sw.lesson === 'slow') dt *= TUNING.lesson.slow;
    if (state.intro) {
      state.m += dt; state.introT += dt;
      if (state.pop > 0) state.pop = Math.max(0, state.pop - dt * 4);
      poseFoe(E, dt); poseYou(E, dt); moveHand(E, dt); warmPair(E);
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
    state.chase = Math.max(0, state.chase - dt);
    state.momT = Math.max(0, state.momT - dt); state.openAll = Math.max(0, state.openAll - dt); state.baitT = Math.max(0, state.baitT - dt); state.foeNet = Math.max(0, state.foeNet - dt);
    if (state.gapOpen && (state.gapOpen.t -= dt) <= 0) state.gapOpen = null; state.disarm = Math.max(0, state.disarm - dt); state.flyW = Math.max(0, state.flyW - dt);
    if (state.cover) {
      const c = state.cover, k = 1 - Math.exp(-dt / (TUNING.cover.slide * (lamed('armB') ? TUNING.lame.cover : 1)));
      c.t -= dt; c.dx += (c.x - c.dx) * k; c.dy += (c.y - c.dy) * k;
    }
    stepFoe(dt, E);
    stepYou(E, dt);
    stepJuice(E, dt);

    poseFoe(E, dt);
    poseYou(E, dt);
    moveHand(E, dt);
    updateAttack(E, dt);
    twirl(E, dt);
    checkHits(E);
    updateFoe(dt, E);
    updatePair(E, dt);
    updateBleed(E, dt);
    updateFinisher(E, dt);
    updateHints(E);
    updateDefence(dt, E);
    checkExhaust(E, dt);
    crowdDrain(E, dt);
    state.foe.shown += (Math.max(0, state.foe.hp) - state.foe.shown) * (1 - Math.exp(-dt / 0.25));
    state.favShown += (state.fav - state.favShown) * (1 - Math.exp(-dt / 0.2)); state.favT = Math.max(0, state.favT - dt);
    poseFoe(E, 0);

    if (state.fallT > 0) {
      state.fallT += dt;
      // the first of a pair is down: his partner taunts, then steps in; otherwise the bout is over
      if (state.edge && !state.edge.down) {
        if (state.fallT >= TUNING.resetDelay - TUNING.pairs.taunt && !state.tauntT && !state.swapping) { state.swapping = true; taunt(E, 'fell'); }
        if (state.fallT >= TUNING.resetDelay) stepIn(E);
      } else if (state.fallT >= TUNING.resetDelay) {
        if (state.rack + 1 >= Math.min(TUNING.bouts, state.gauntlet.length)) { this.finish(E); return; }
        openDraft(E); return;
      }
    }
    for (const f of state.fx) {
      f.life -= dt; f.vy += (f.g || 0) * dt; f.x += f.vx * dt || 0; f.y += f.vy * dt || 0;
      if (f.k === 'c') { f.rot += f.vr * dt; if (f.y >= f.floor) { f.y = f.floor; f.vx = 0; f.vy = 0; f.g = 0; f.vr = 0; } }
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
    E.save.set('run', null); E.save.set('firstRunDone', 1);
    settleFeint('none');
    const best = E.save.get('best2', 0), isNew = state.gapHits > best;
    if (isNew) E.save.set('best2', state.gapHits);
    const g = state.gauntlet, won = state.results.filter((r) => r === 'felled').length >= g.length, reached = Math.min(g.length, state.rack + 1);
    const r = { gapHits: state.gapHits, slotHits: state.slotHits, lunges: state.lunges, clangs: state.clangs, broken: state.broken, overheads: state.overheads, jabs: state.jabs, slashes: state.slashes, blocks: state.blocks, perfects: state.perfects, dodges: state.dodges, staOuts: state.staOuts, counters: state.counters, counterHits: state.counterHits, taken: state.taken, felled: state.felled,
      feints: state.feints, feintsRead: state.feintsRead, switchReads: state.switchReads, feintsBit: state.feintsBit, feintsNone: state.feintsNone, combos: state.combos, windeds: state.windeds, punishes: state.punishes, bashes: state.bashes, bashHits: state.bashHits, nets: state.nets, netted: state.netted,
      zoneReads: state.zoneReads, lungeReads: state.lungeReads, turtleReads: state.turtleReads, presses: state.presses, retreats: state.retreats, plateSaves: state.plateSaves,
      momGained: state.momGained, momSpent: state.momSpent, bleeds: state.bleeds, lamings: state.lamings };
    const me = state.me, champ = g[g.length - 1];
    // the champion who cut you down is remembered for the next run; a fall earlier only chalks your name on the wall
    if (!won && state.results[g.length - 1] === 'lost') {
      const gaps = { ...(champ.gaps || {}) }; for (const [k, v] of Object.entries(state.bout.gaps)) gaps[k] = (gaps[k] || 0) + v;
      E.save.set('rivals', { ...E.save.get('rivals', {}), [state.arena]: rivalOf({ ...champ, gaps }) });
    }
    // felling an arena's champion opens the next arena for good
    const ai = ARENAS.indexOf(arena()), was = E.save.get('arenas', 0), opened = won && ai + 1 > was ? ARENAS[ai + 1] || null : null;
    if (won && ai + 1 > was) E.save.set('arenas', ai + 1);
    const wall = won ? E.save.get('wall', []) : E.save.set('wall', [{ name: me.name, bout: reached, female: me.female }, ...E.save.get('wall', [])].slice(0, 8));
    // fame for good, and a won run's fighter on the Wall of Champions
    const thumbUp = won && state.arena === 'games' && bandOf(thumbFav()) === 2, fame = fameOf(won, won && ai + 1 > was, thumbUp, state.gold, state.results.filter((q) => q === 'felled').length);
    E.save.set('fame', E.save.get('fame', 0) + fame.sum);
    if (won) carveChampion(E, me, state.arena, champ.name);
    E.ledger.add('result', { ...r, won, reached, halves: state.hp, sizes: g.map((d) => d.size.id[0]).join(''), profs: g.map((d) => d.prof).join(','), weapons: g.map((d) => d.weapon.id).join(','), armour: g.map((d) => d.set.id[0]).join(''),
      stats: g.map((d) => `${d.str}${d.spd}${d.sta}`).join(','), champ: g[g.length - 1].name, lostTo: won ? '' : `${g[reached - 1].name} ${g[reached - 1].size.id} ${g[reached - 1].weapon.id}`,
      moves: Object.entries(state.moveCount).map(([k, v]) => `${k}${v}`).join(','),
      meSize: me.size, meStats: `${me.str}${me.spd}${me.sta}`, meArmour: me.set, mePlates: me.plates.join(','), meTier: me.tier, underdog: me.underdog ? 1 : 0,
      grades: state.grades.join(''), goods: state.goods.join(','), picks: state.picks.join(','), stepsIn: state.stepsIn, stepsOut: state.stepsOut, wallHits: state.wallHits, foeWall: state.foeWall, outReach: state.outReach, dodged: state.dodged, chases: state.chases,
      shrugs: state.shrugs, gold: state.gold, goldEarned: state.goldEarned, bought: state.bought.join(','), wares: state.wares.join(','), tent: state.tentDone ? 1 : 0, fins: state.fins.join(','), bleedDmg: state.bleedDmg, lab: state.labUsed, meWeapon: me.weapon === 'axe' && me.mace ? 'mace' : me.weapon, token: state.tokenUsed, epicsSeen: state.epicsSeen, origin: me.origin, reason: me.reason, rival: champ.rival ? 1 : 0, rivalBeaten: state.rivalBeaten,
      arena: state.arena, fav: Math.round(state.fav), favAvg: Math.round(thumbFav()), thumb: won && state.arena === 'games' ? bandOf(thumbFav()) : -1,
      meName: me.name, fame: fame.sum, vet: me.vid != null ? 1 : 0, myNets: state.netsCast, drives: state.drives, driveDist: Math.round(state.driveDist * 100) / 100, spoils: state.spoils });
    E.setScene('over', { ...r, won, reached, gauntlet: g, me, results: state.results.slice(), best: Math.max(best, state.gapHits), isNew,
      picks: state.picks.slice(), grades: state.grades.slice(), wall, rivalBeaten: state.rivalBeaten, gold: state.gold, goldEarned: state.goldEarned, wares: state.wares.slice(),
      arena: state.arena, fav: state.arena === 'games' ? thumbFav() : state.fav, opened, fame });
  },
  // two thumbs: a touch that starts in the left third is the shield and dodge thumb (buttons only), one that starts on the finisher button is that button
  // alone (it never moves the sword hand), any other is the sword thumb
  onPointerDown(p, E) {
    if (state.endT > 0 || portrait(E) || state.intro || state.draft || state.tent) return;
    if (p.startX >= E.w / 3 && finTouch(E, p)) return;
    if (p.startX < E.w / 3) {
      const b = buttonAt(E, p);
      if (b && b.dodge) dodge(E, p.id);
      else if (b) raiseShield(E, b.z, p.id);
      return;
    }
    const h = state.hand;
    if (h.down) return;
    h.down = true; h.id = p.id; h.fx = p.x; h.fy = p.y;
    h.ax = p.x; h.ay = p.y;
    if (h.lock <= 0) {
      [h.tgx, h.tgy] = guardPt(E);
      h.grip = 0; solveArm(E, 0);
      h.pux = h.ux; h.puy = h.uy; h.phx = h.hx; h.phy = h.hy; h.sp = 0; h.vx = h.vy = 0;
    }
  },
  onPointerMove(p, E) {
    const h = state.hand;
    if (h.down && h.id === p.id) { h.fx = p.x; h.fy = p.y; }
  },
  onTap(p, E) {
    const tt = state.tent;
    if (tt) {
      if (tt.t < TUNING.draft.delay) return;
      if (tt.skip && E.hit(tt.skip, p)) { leaveTent(E); return; }
      const b = tt.btns.find((q) => E.hit(q, p)); if (b) buyWare(E, b.ware); return;
    }
    const d = state.draft;
    if (d) {
      if (d.helpOn) { d.helpOn = d.helpOn >= 3 ? 0 : d.helpOn + 1; E.audio.play('tap'); return; }
      if (d.help && E.hit(d.help, p)) { d.helpOn = 1; E.audio.play('tap'); return; }
      if (d.reroll && d.reroll.live && E.hit(d.reroll, p)) { rerollDraft(E); return; }
      if (d.spoilBtn && d.t > TUNING.draft.delay && E.hit(d.spoilBtn, p)) { swapSpoil(E); return; }
      const b = d.t > TUNING.draft.delay && d.btns.find((q) => E.hit(q, p)); if (b) pickCard(E, b.card); return;
    }
    // the card lab (dev channel only): a LAB tab on the intro card opens it
    if (state.lab) { labTap(E, p); return; }
    if (state.intro && E.channel !== 'release' && E.hit(labTab(E), p)) { state.lab = { btns: [] }; state.labUsed = 1; E.audio.play('tap'); return; }
    if (state.intro && state.introT > 0.35 && !portrait(E)) {
      state.intro = false; state.swingIn = 1.2; E.audio.play('tap');
      if (state.carry) { addBleed(E, state.carry); state.carry = 0; }
      if (state.labMom) state.mom = TUNING.mom.max;
      const seen = E.save.get('boutsSeen', 0);
      state.hint = seen < TUNING.hint.bouts; state.boutT0 = state.m; E.save.set('boutsSeen', seen + 1);
    }
  },
  onPointerUp(p, E) {
    const s = state.sh, h = state.hand, dg = state.dg;
    if (dg.down && dg.id === p.id) { dg.down = false; dg.id = -1; }
    else if (s.hid === p.id) { s.held = false; s.hid = -1; baitDrop(E); }
    else if (h.down && h.id === p.id) { h.down = false; h.sp = 0; h.atk = null; }
  },
  render(ctx, E) {
    if (portrait(E)) { rotateCard(ctx, E); return; }
    ctx.save();
    if (state.zoomT > 0) {
      const J = TUNING.juice, z = 1 + J.fellZoom * Math.min(1, (J.fellSlow - state.zoomT) / J.zoomIn) * Math.min(1, state.zoomT / 0.3), Ff = foeF(E), fy = Ff.y - 0.5 * Ff.H;
      ctx.translate(Ff.x, fy); ctx.scale(z, z); ctx.translate(-Ff.x, -fy);
    }
    drawBackground(ctx, E);
    drawWalls(ctx, E);
    if (state.sw && state.sw.ghostX) drawFighter(ctx, E, { ...youF(E), x: state.sw.ghostX }, state.you, 'you', 0.3 + 0.1 * Math.sin(state.m * 20));
    for (const g of state.ghosts) drawFighter(ctx, E, { ...youF(E), x: g.x }, state.you, 'you', 0.3 * g.life / TUNING.juice.ghost);
    drawFighter(ctx, E, youF(E), state.you, 'you');
    if (state.paintT > 0) paintGlow(ctx, E);
    if (state.netT > 0) {
      const Fy = youF(E), k = netK(state.netT);
      if (netArt()) { ctx.save(); ctx.translate(Fy.x, Fy.y); ctx.scale(Fy.dir, 1); ctx.rotate(Fy.a); drapeNet(ctx, E, Fy.H, state.you, k); ctx.restore(); } else drawNet(ctx, Fy.x, Fy.y - 0.55 * Fy.H, 0.32 * Fy.H * k);
    }
    if (state.edge && !state.edge.down) drawEdge(ctx, E);
    drawFighter(ctx, E, foeF(E), state.foe, 'foe');
    if (state.foeNet > 0 && state.fallT <= 0 && !netArt()) { const Ff = foeF(E); drawNet(ctx, Ff.x, Ff.y - 0.5 * Ff.H, 0.36 * Ff.H * netK(state.foeNet)); }
    if (state.flyW > 0) flyingWeapon(ctx, E);
    drawGuard(ctx, E);
    drawZone(ctx, E);
    drawShield(ctx, E);
    drawSwordArm(ctx, E);
    drawZoneLabel(ctx, E);

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
      } else if (f.k === 'c') {
        ctx.globalAlpha = Math.min(1, f.life / 0.3); ctx.fillStyle = '#fbbf24'; ctx.strokeStyle = '#8a5a12'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, 1 + 4.5 * Math.abs(Math.cos(f.rot)), 5, 0, 0, 6.28); ctx.fill(); ctx.stroke();
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
    // the left column and the caption stay still while the camera punches in
    drawShieldBtns(ctx, E);
    drawCaption(ctx, E);

    if (state.hurt > 0) {
      const g2 = ctx.createRadialGradient(E.w / 2, E.h / 2, E.h * 0.4, E.w / 2, E.h / 2, E.w * 0.6);
      g2.addColorStop(0, 'rgba(255,0,0,0)'); g2.addColorStop(1, `rgba(255,20,20,${state.hurt / 0.4 * 0.55})`);
      ctx.fillStyle = g2; ctx.fillRect(0, 0, E.w, E.h);
    }
    for (const q of state.pops) {
      const t = q.life / q.max;
      E.text(q.s, q.x, q.y - (1 - t) * 34, { size: q.size * (1 + (1 - t) * 0.2), color: q.color, weight: '800', alpha: Math.min(1, t * 2) });
    }
    if (state.banner) drawBanner(ctx, E);

    // HUD, inside the safe area
    const top = 10 + E.safe.top, l = 16 + E.safe.left, r = 16 + E.safe.right, TS = TUNING.stamina;
    E.text(`BOUT ${state.rack + 1}/${state.gauntlet.length}`, l, top + 12, { size: TUNING.hud.bout, align: 'left', weight: '800', color: state.foe.champion ? '#ffd24a' : '#e6e6e6' });
    drawCrowdMeter(ctx, E, l, top + 31);
    // a dark plate under the right column, so a tall foe's helmet passing behind it never hides a row
    const H2 = hudRow();
    E.roundRect(E.w - r - 176, top - 6, 182, H2.shield + 18, 8, 'rgba(18,12,22,0.72)', null);
    // one heart for each point of health, whole
    for (let i = 0; i < state.maxHp; i++) { const [hx, hy] = heartAt(E, i); drawHeart(ctx, hx, hy, TUNING.hud.size, i < Math.ceil(state.hp) ? '#ef4444' : '#3b3f46'); }
    if (state.shatter) for (let k = 0; k < state.shatter.n; k++) { const [hx, hy] = heartAt(E, Math.min(state.maxHp - 1, state.shatter.i + k)); heartShatter(ctx, hx, hy, 1 - state.shatter.t / TUNING.juice.shatter); }
    const bw = 110, bx = E.w - r - bw, sf = state.stamina / state.staMax;
    drawPips(ctx, E, bx, bw, top + H2.pips);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(bx - 1, top + H2.sta - 1, bw + 2, 11);
    const flashOn = state.exhaust > 0 && Math.floor(state.m * 8) % 2 === 0;
    if (state.exhaust > 0) { ctx.fillStyle = flashOn ? '#ffffff' : '#ef4444'; ctx.fillRect(bx, top + H2.sta, bw * clamp(1 - state.exhaust / TS.exhaust, 0.05, 1), 9); }
    else {
      ctx.fillStyle = sf < 0.25 ? '#f59e0b' : '#4ade80'; ctx.fillRect(bx, top + H2.sta, bw * sf, 9);
      // what the drive burns glows where it was, then fades
      if (state.burnT > 0 && state.burn > state.stamina) { ctx.globalAlpha = Math.min(1, 2 * state.burnT / TUNING.lunge.driveBurn); ctx.fillStyle = '#fde68a'; ctx.fillRect(bx + bw * sf, top + H2.sta, bw * (Math.min(state.burn, state.staMax) - state.stamina) / state.staMax, 9); ctx.globalAlpha = 1; }
    }
    if (state.exhaust > 0) E.text('EXHAUSTED', bx - 6, top + H2.sta + 6, { size: 14, align: 'right', color: '#fca5a5', weight: '800' });
    const sy = top + H2.shield;
    const nsh = shieldMax();
    for (let i = 0; i < nsh; i++) {
      ctx.fillStyle = state.sh.broken || noShield() ? '#3b3f46' : i < state.sh.hits ? '#d6a24a' : '#3b3f46';
      ctx.fillRect(bx + i * (bw / nsh), sy, bw / nsh - 4, 7);
    }
    if (!state.draft && !state.tent) foeHealth(ctx, E);
    if (state.edge && !state.edge.down && !state.intro && !state.draft && !state.tent) drawEdgeTag(ctx, E);
    if (state.netT > 0) E.text('NETTED: slow hand, no lunge', bx + bw, sy + 34, { size: 14, align: 'right', color: '#e2e8f0', weight: '700' });
    if (state.hint && !state.intro && !state.caption) drawHint(ctx, E);
    drawFinBtn(ctx, E);
    drawRightHints(E);
    if (state.intro) { drawIntro(ctx, E); if (E.channel !== 'release') { const t = labTab(E); E.roundRect(t.x, t.y, t.w, t.h, 10, '#1f2937', '#e879f9'); E.text('LAB', t.x + t.w / 2, t.y + t.h / 2, { size: 15, weight: '800', color: '#f5d0fe' }); } }
    if (state.lab) drawLab(ctx, E);
    if (state.draft) drawDraft(ctx, E);
    if (state.tent) drawTent(ctx, E);
  },
};

// The end: an epilogue card first when the champion fell, then the end card (your card and theirs, your upgrades, the pit wall when you fell).
const over = {
  enter(E, params) {
    this.p = params; this.page = params.won ? 0 : 1; this.t = 0; this.details = 0; this.heard = false;
    E.audio.play(params.won ? 'win' : 'lose');
  },
  update(dt) { this.t += dt; },
  epilogue(ctx, E) {
    const p = this.p, me = p.me, w = Math.min(E.w - 32, 620), h = Math.min(E.h - 40, 230), x = (E.w - w) / 2, y = (E.h - h) / 2;
    E.roundRect(x, y, w, h, 18, '#221a2b', '#ffd24a');
    E.text(`CHAMPION FELLED  \u00b7  ${ARENA[p.arena].name.toUpperCase()}`, E.w / 2, y + 30, { size: 15, weight: '800', color: '#ffd24a' });
    if (p.rivalBeaten) E.text('Rival defeated!', E.w / 2, y + 54, { size: 16, weight: '800', color: '#f87171' });
    // a won run: Old Brutus, proud, on the left and the champion felled on the right, the lines between them
    const [pw, ph] = TUNING.art.epi, py = y + (h - ph) / 2 + 8, champ = p.gauntlet[p.gauntlet.length - 1];
    const bl = drawPic(ctx, E, 'brutus-proud', [0, 0, 1, 1], x + 14, py, pw, ph), br = champPic(champ) && drawPic(ctx, E, champPic(champ), [0, 0, 1, 1], x + w - 14 - pw, py, pw, ph, '#ffd24a');
    const tw = bl || br ? w - 2 * (pw + 24) : w - 40, nl = `${me.name}, ${ORIGINS[me.origin].text}.`;
    E.text(nl, E.w / 2, y + h * 0.45, { size: bl || br ? fitSize(ctx, nl, 20, tw) : 20, weight: '800', color: '#f0e6cc' });
    wrapPx(ctx, endingOf(p.arena, me, p.fav), tw, 17, '700').slice(0, 2).forEach((t, i) => E.text(t, E.w / 2, y + h * 0.45 + 32 + i * 22, { size: 17, weight: '700', color: '#fde68a' }));
    if (p.fame && p.fame.sum) E.text(`+${p.fame.sum} fame`, E.w / 2, y + h - 46, { size: 18, weight: '800', color: '#ffd24a' });
    E.text('Tap to continue', E.w / 2, y + h - 22, { size: 14, weight: '800', color: '#ffd24a', alpha: this.t > 0.5 ? 0.6 + 0.4 * Math.sin(E.time * 4) : 0.3 });
  },
  // The Grand Games end on the Emperor's thumb: the imperial box, then his hand rises and the thumb turns by the crowd's meter (up and a roar, a cold
  // nod, or down and jeers), then the ending. All three are a win.
  thumb(ctx, E) {
    const p = this.p, T = TUNING.thumb, b = bandOf(p.fav), t = this.t, w = Math.min(E.w - 32, 620), h = Math.min(E.h - 24, 272), x = (E.w - w) / 2, y = (E.h - h) / 2, cx = E.w / 2;
    E.roundRect(x, y, w, h, 18, '#1c1424', b === 2 ? '#ffd24a' : b === 1 ? '#c4b99a' : '#94a3b8');
    E.text("THE EMPEROR'S THUMB", cx, y + 24, { size: 15, weight: '800', color: '#ffd24a' });
    // the box: a purple-draped balcony between two columns, the Emperor seated under a laurel
    const k = easeOut(clamp(t / T.box, 0, 1)), bw = Math.min(260, w - 60), bh = Math.min(110, h * 0.36), bx = cx - bw / 2, by = y + 40 + (1 - k) * 20;
    ctx.save(); ctx.globalAlpha = k;
    ctx.fillStyle = '#3a2a40'; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#d9c9a0'; ctx.fillRect(bx - 10, by - 6, 14, bh + 6); ctx.fillRect(bx + bw - 4, by - 6, 14, bh + 6); ctx.fillRect(bx - 14, by - 10, bw + 28, 8);
    // the Emperor's portrait sits in the box when it has loaded (the drape and rail over his lap); else the drawn Emperor below
    const emp = picSprite(E, 'emperor', TUNING.art.box, Math.round(bh * 1.25), bh);
    if (emp) { ctx.save(); ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip(); ctx.drawImage(emp.im, emp.sx, emp.sy, emp.sw, emp.sh, cx - bh * 0.625, by, bh * 1.25, bh); ctx.restore(); }
    ctx.fillStyle = '#5b2160'; ctx.beginPath(); ctx.moveTo(bx, by + bh * 0.62);
    for (let i = 0; i <= 6; i++) ctx.quadraticCurveTo(bx + bw * (i - 0.5) / 6, by + bh * 0.82, bx + bw * i / 6, by + bh * 0.62);
    ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx, by + bh); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e6c866'; ctx.fillRect(bx, by + bh * 0.6, bw, 3);
    const nod = b === 1 ? Math.sin(clamp((t - T.box - T.hand) / T.turn, 0, 1) * Math.PI) * 4 : 0, ex = cx, ey = by + bh * 0.3 + nod;
    if (!emp) {
      ctx.fillStyle = '#c9a27a'; ctx.beginPath(); ctx.arc(ex, ey, bh * 0.12, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#f2f0ea'; ctx.beginPath(); ctx.moveTo(ex - bh * 0.22, by + bh * 0.62); ctx.quadraticCurveTo(ex, ey + bh * 0.05, ex + bh * 0.22, by + bh * 0.62); ctx.fill();
      ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ex, ey - bh * 0.02, bh * 0.13, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    }
    ctx.restore();
    // the hand rises over the rail, a fist with the thumb out, and turns
    const kh = easeOut(clamp((t - T.box) / T.hand, 0, 1)), kt = easeOut(clamp((t - T.box - T.hand) / T.turn, 0, 1)), hx = cx + bw * 0.3, hy = by + bh * 0.9 - kh * bh * 0.45;
    if (kh > 0) {
      const ang = kt * (b === 2 ? -Math.PI / 2 : b === 0 ? Math.PI / 2 : 0), r = bh * 0.15;
      ctx.save(); ctx.translate(hx, hy);
      ctx.fillStyle = '#5b2160'; ctx.fillRect(-r * 0.7, r * 0.6, r * 1.4, bh * 0.4);
      ctx.fillStyle = '#d4a77e'; rrect(ctx, -r, -r * 0.8, r * 2, r * 1.6, r * 0.5); ctx.fill();
      ctx.rotate(ang); ctx.fillRect(r * 0.6, -r * 0.28, r * 1.1, r * 0.56); ctx.strokeStyle = '#7a5032'; ctx.lineWidth = 1.5; ctx.strokeRect(r * 0.6, -r * 0.28, r * 1.1, r * 0.56);
      ctx.restore();
    }
    if (t >= T.box + T.hand + T.turn) {
      if (!this.heard) { this.heard = true; crowdVerdict(E, b); }
      const head = b === 2 ? 'Thumbs up. The crowd roars.' : b === 1 ? 'A cold nod.' : 'Thumbs down. The crowd jeers.';
      E.text(head, cx, by + bh + 24, { size: 17, weight: '800', color: b === 2 ? '#ffd24a' : b === 1 ? '#e2e8f0' : '#fca5a5' });
      wrapPx(ctx, endingOf('games', p.me, p.fav), w - 40, 16, '700').slice(0, 2).forEach((s2, i) => E.text(s2, cx, by + bh + 50 + i * 20, { size: 16, weight: '700', color: '#fde68a' }));
      if (p.fame && p.fame.sum) E.text(`+${p.fame.sum} fame`, cx + w / 2 - 20, y + h - 18, { size: 16, weight: '800', align: 'right', color: '#ffd24a' });
    }
    E.text('Tap to continue', cx, y + h - 18, { size: 14, weight: '800', color: '#ffd24a', alpha: t > T.tap ? 0.6 + 0.4 * Math.sin(E.time * 4) : 0.3 });
  },
  render(ctx, E) {
    const p = this.p, g = p.gauntlet;
    if (portrait(E)) { this.btnAgain = this.btnMenu = this.btnDetails = null; rotateCard(ctx, E); return; }
    if (this.page === 0) { this.btnAgain = this.btnMenu = this.btnDetails = null; if (p.arena === 'games') this.thumb(ctx, E); else this.epilogue(ctx, E); return; }
    const last = g[p.reached - 1], me = p.me, by = E.h - 30 - E.safe.bottom, F = p.fame || { sum: 0, items: [] };
    this.btnDetails = E.button(['Details', 'Counts', 'Hide details'][this.details], E.w / 2 - 160, by, { w: 150, h: 48, size: 16, fill: '#1f2937' });
    this.btnAgain = E.button('Again', E.w / 2, by, { w: 150, h: 48, size: 18 });
    this.btnMenu = E.button('Menu', E.w / 2 + 160, by, { w: 150, h: 48, size: 18, fill: '#334155' });
    // Details, page 1: the run (the fighters, gear, gold, fame, the wall); page 2: the counts
    if (this.details === 1) { this.run(ctx, E, E.safe.top + 10, by - 30); return; }
    if (this.details === 2) { this.stats(ctx, E, E.safe.top + 10, by - 30); return; }
    // the card keeps: the headline (with the champion's face), one summary line, then Brutus's line (a win: its ending and what it opened), centred above the buttons
    const c = (E.safe.top + 8 + by - 34) / 2, t = `Reached bout ${p.reached} of ${g.length}${F.sum ? `  ·  +${F.sum} fame` : ''}`;
    sayLine(ctx, E, p.won ? 'CHAMPION FELLED' : `Cut down by ${last.beast ? `a ${last.name.toLowerCase()}` : last.name}`, E.w / 2, c - 44, E.w - 32, { size: 24, weight: '800', color: p.won ? '#ffd24a' : '#ef4444' }, p.won ? null : champPic(last), TUNING.art.faceBig);
    E.text(t, E.w / 2, c - 12, { size: 16, weight: '700', color: '#fbbf24' });
    if (!p.won) sayLine(ctx, E, `Old Brutus: “${brutus(me, 'lost')}”`, E.w / 2, c + 36, E.w - 32, { size: 14, weight: '700', color: '#fde68a' }, 'brutus', TUNING.art.faceCard);
    else {
      const ending = endingOf(p.arena, me, p.fav);
      E.text(ending, E.w / 2, c + 28, { size: fitSize(ctx, ending, 14, E.w - 32, '700'), weight: '700', color: '#fde68a' });
      if (p.opened) E.text(`Opened: ${p.opened.name}, ${p.opened.place}`, E.w / 2, c + 52, { size: 14, weight: '800', color: '#ffd24a' });
    }
  },
  // Details, page 1: your card and every bout's, your gear, the grades, fame and gold, and (a fall) the wall sentence and the pit wall
  run(ctx, E, y0, y1) {
    const p = this.p, g = p.gauntlet, me = p.me, F = p.fame || { sum: 0, items: [] }, room = E.w - 32 - E.safe.left - E.safe.right;
    const n = g.length + 1, gap = 8, w = Math.min(150, (room - gap * (n - 1)) / n), h = 150, x0 = (E.w - (w * n + gap * (n - 1))) / 2;
    meMini(ctx, E, me, x0, y0, w, h, p.picks);
    g.forEach((d, i) => miniCard(ctx, E, d, x0 + (i + 1) * (w + gap), y0, w, h, p.results[i] || null));
    let y = y0 + h + 14;
    if (p.picks.length) {
      // every piece as an icon, then as many names as fit at 14 px (highest rarity first: keystones, sets, epics, war paint), then "+N"
      const n2 = p.picks.length, rank = (id) => (CARD[id].duo ? 2.5 : CARD[id].fam === 'fin' ? 1.5 : CARD[id].tier);
      ctx.font = '800 14px system-ui, sans-serif';
      const lw = ctx.measureText('Gear:').width + 8, ip = Math.min(22, (room - lw) / n2), order = p.picks.map((id, i) => i).sort((a2, b2) => rank(p.picks[b2]) - rank(p.picks[a2]) || a2 - b2);
      ctx.font = '600 14px system-ui, sans-serif';
      const tr = room - lw - ip * n2 - 14, textOf = (k) => `${order.slice(0, k).map((i) => titleOf(CARD[p.picks[i]])).join(', ')}${k < n2 ? ` +${n2 - k}` : ''}`;
      let k = n2;
      while (k > 0 && ctx.measureText(textOf(k)).width > tr) k--;
      const txt = k ? textOf(k) : '', tw = txt ? ctx.measureText(txt).width + 14 : 0;
      let x = E.w / 2 - (lw + ip * n2 + tw) / 2;
      E.text('Gear:', x, y, { size: 14, align: 'left', weight: '800', color: '#c4b99a' });
      x += lw;
      p.picks.forEach((id, i) => drawIcon(ctx, id, x + ip * i + ip / 2, y, Math.min(8, ip / 2 - 1)));
      if (txt) E.text(txt, x + ip * n2 + 14, y, { size: 14, align: 'left', color: '#f0e6cc' });
    } else E.text('No gear picked', E.w / 2, y, { size: 14, color: '#9ca3af' });
    y += 20;
    // the grades and fame, then the run's gold: what is left (it resets with the run), what the crowd's style earned and the tent's wares
    const wn = p.wares.map((id) => WARES.find((q) => q.id === id).name.replace(' {weapon}', ''));
    const lines = [
      [`${p.grades.length ? `Grades ${p.grades.join(' ')}` : ''}${p.grades.length && F.sum ? '  ·  ' : ''}${F.sum ? `+${F.sum} fame (${F.items.map((e) => `${e[0]} ${e[1]}`).join(', ')})` : ''}`, '#fde68a'],
      [`Gold: ${p.gold} left of ${p.goldEarned} earned${wn.length ? `  ·  bought: ${wn.join(', ')}` : ''}`, '#fbbf24'],
      ...(p.won ? [] : [[`${me.name} fell in bout ${p.reached}. Old Brutus chalked ${me.female ? 'her' : 'his'} name on the wall of the pit.`, '#f0e6cc']]),
    ].filter(([t]) => t).flatMap(([t, col]) => wrapPx(ctx, t, room, 14, '700').map((l) => [l, col]));
    lines.forEach(([t, col], k) => E.text(t, E.w / 2, y + k * 18, { size: 14, weight: '700', color: col }));
    y += 18 * lines.length;
    if (!p.won) {
      // the pit wall: the last eight fallen, newest first, chalked on stone
      const names = p.wall.slice(0, 8), sw = Math.min(E.w - 40, 140 * names.length + 20), sx = (E.w - sw) / 2;
      ctx.font = '700 14px system-ui, sans-serif';
      while (names.length > 1 && names.reduce((a2, q) => a2 + ctx.measureText(`${q.name} (${q.bout})`).width + 26, 0) > sw - 20) names.pop();
      const ph = 26;
      E.roundRect(sx, y - 6, sw, ph, 6, '#3a322c', '#5a4e44');
      names.forEach((q, i) => E.text(`${q.name} (${q.bout})`, sx + 10 + (sw - 20) * (i + 0.5) / names.length, y - 6 + ph / 2, { size: 14, weight: '700', color: i === 0 ? '#ffffff' : '#d6d0c4', alpha: i === 0 ? 1 : 0.75 }));
    }
  },
  // Details, page 2: the raw counts of the run, in a grid between the top and the buttons
  stats(ctx, E, y0, y1) {
    const p = this.p, w = Math.min(E.w - 32, 760), x = (E.w - w) / 2;
    const items = [
      ['gap hits', `${p.gapHits}${p.isNew ? ' (new best!)' : ''}`], ['best', p.best], ['joint hits', p.slotHits], ['stabs', p.jabs], ['slashes', p.slashes], ['smashes', p.overheads],
      ['lunges', p.lunges], ['clangs', p.clangs], ['plates broken', p.broken], ['blocks', p.blocks], ['well-timed blocks', p.perfects], ['backsteps', p.dodges],
      ['hits taken', p.taken], ['out of stamina', p.staOuts], ['counters', p.counters], ['counters that hit', p.counterHits], ['fakes', p.feints], ['fakes spotted', p.feintsRead],
      ['spotted by switch', p.switchReads], ['fooled by fakes', p.feintsBit], ['fakes neither', p.feintsNone], ['combos', p.combos], ['out of breath', p.windeds], ['punishes', p.punishes],
      ['bashed', `${p.bashHits}/${p.bashes}`], ['netted', `${p.netted}/${p.nets}`], ['felled', p.felled], ['momentum', p.momGained], ['momentum spent', p.momSpent], ['bleeding', p.bleeds],
      ['cripples', p.lamings],
    ];
    const cols = 3, rows = Math.ceil(items.length / cols), lh = Math.min(22, (y1 - y0 - 16) / rows), cw = w / cols;
    E.roundRect(x, y0, w, rows * lh + 16, 12, 'rgba(34,26,43,0.85)', 'rgba(240,230,204,0.25)');
    items.forEach(([k, v], i) => {
      const cx = x + (i % cols) * cw, cy = y0 + 8 + lh / 2 + Math.floor(i / cols) * lh;
      E.text(k, cx + 10, cy, { size: 14, align: 'left', color: '#9aa4b2' });
      E.text(`${v}`, cx + cw - 10, cy, { size: 14, align: 'right', weight: '700', color: '#f0e6cc' });
    });
  },
  onTap(p, E) {
    if (this.page === 0) { if (this.t > (this.p.arena === 'games' ? TUNING.thumb.tap : 0.5)) { this.page = 1; E.audio.play('tap'); } return; }
    if (this.btnDetails && E.hit(this.btnDetails, p)) { this.details = (this.details + 1) % 3; E.audio.play('tap'); }
    else if (this.btnAgain && E.hit(this.btnAgain, p)) E.setScene('roll', { seed: (Math.random() * 2 ** 32) >>> 0, arena: this.p.arena });
    else if (this.btnMenu && E.hit(this.btnMenu, p)) E.setScene('menu');
  },
};

// ====== GAME OBJECT: save, migrate, TUNE presets ======
const STD = { 'hit.minSpeed': 450, 'stamina.regen': 32, 'attack.over.cost': 28, 'shield.perfect': 0.15, 'shield.hits': 4, 'shield.drain': 6, 'open.dur': 0.8, 'swing.windup': 0.7, 'swing.gap': 2.0, 'counter.windup': 0.55, 'dodge.cost': 18 };

export const game = {
  slug: 'arena',
  title: 'Arena',
  saveVersion: 10,
  // v2 adds the rival champion and the pit wall of fallen names; v3 counts the bouts begun, for the hint, and a player who has fought before has seen it;
  // v4 (v1) adds the run saved at each bout's start and drops the prototypes' old keys (best, runs). The rival, the wall, the feint lesson and boutsSeen carry over.
  // v5 (v2, the new deck): a run saved mid-gauntlet restarts at bout 1 with the same fighter (its picks came from the old deck, and the old perks are gone).
  migrate(data, fromVersion) {
    if (fromVersion < 2) { data.rival = data.rival && data.rival.name ? data.rival : null; data.wall = Array.isArray(data.wall) ? data.wall.slice(0, 8) : []; }
    if (fromVersion < 3) data.boutsSeen = data.best2 > 0 || (data.wall && data.wall.length) || data.feintLesson ? TUNING.hint.bouts : 0;
    if (fromVersion < 4) { delete data.best; delete data.runs; data.run = null; }
    if (fromVersion < 5) {
      const r = data.run;
      if (r && r.me && r.me.idx) {
        // the rolled plates come first; plates bought as old cards (Iron Greaves, Bronze Helm) were pushed after them
        const A = TUNING.me.armour[TUNING.me.wheels.armour[r.me.idx[4]][0]];
        data.run = { seed: r.seed, rack: 0, me: deriveMe({ ...r.me, plates: r.me.plates.slice(0, A.n + (A.arm ? 1 : 0)) }), rival: r.rival || null };
      } else data.run = null;
    }
    // v6 (v2 step 2, gear): the picks keep their card ids, so a saved run goes on as it was and its gear is derived from them (two pieces saved for one
    // slot both stay until a new piece takes that slot); the rival starts with no gear of his own and no gaps counted
    if (fromVersion < 6) {
      for (const rv of [data.rival, data.run && data.run.rival]) if (rv) { rv.gaps = rv.gaps || {}; rv.gear = rv.gear || null; }
      if (data.run && data.run.draft) data.run.draft.odds = data.run.draft.odds || [];
    }
    // v7 (v2 step 3, the arenas): the highest arena open (a won run opens the City; menu.enter reads the ledger once for it), the rival per arena (the
    // Pit's is the old one), and a saved run is a Pit run
    if (fromVersion < 7) {
      data.rivals = data.rival ? { pit: data.rival } : {}; delete data.rival;
      data.arenas = 0; data.arenasCheck = 1;
      if (data.run) data.run.arena = 'pit';
    }
    // v8 (v2 step 3.5, five sizes): the old three sizes map S to Lean, M to Medium and L to Big, for your saved fighter (his size wheel's landing moves up
    // one slice) and every rival and his partner, who gain the profile nearest their stats; both stand at their band's own height
    if (fromVersion < 8) {
      const MAP = { S: 'lean', M: 'medium', L: 'big' }, fix = (rv) => { if (!rv) return; rv.size = MAP[rv.size] || rv.size; rv.vary = rv.vary || 0; rv.prof = rv.prof || profileOf(rv); fix(rv.pair); };
      for (const rv of Object.values(data.rivals || {})) fix(rv);
      const r = data.run;
      if (r && r.me && MAP[r.me.size]) { r.me.idx = r.me.idx.slice(); r.me.idx[0] += 1; r.me.vary = 0; r.me = deriveMe(r.me); }
      if (r) fix(r.rival);
    }
    // v9 (v2 step 3.6, the finisher button): `finHint` is set once the button's first-time hint has been shown
    if (fromVersion < 9) data.finHint = 0;
    // v10 (v2 step 4b, the meta): fame, the ludus's unlocks (a save from before keeps the Trickster and the Showman open), the tailor's styles, the
    // start-card pick and the cards ever picked, the Wall of Champions; menu.enter reads the ledger once (fameCheck) for the fame of past wins and cleared
    // arenas, their fighters on the Wall and their picks. A saved run's fighter has every family open, as before.
    if (fromVersion < 10) Object.assign(data, { fame: 0, ludus: ['trick', 'show'], tailor: {}, startPick: '', picked: [], champs: [], fameCheck: 1 });
    return data;
  },
  TUNING,
  experiments: [
    { key: 'hit.minSpeed', label: 'Min hit speed (px/s)', min: 200, max: 1200, step: 25 },
    { key: 'stamina.regen', label: 'Stamina regen (/s)', min: 10, max: 80, step: 2 },
    { key: 'attack.over.cost', label: 'Smash cost', min: 5, max: 60, step: 1 },
    { key: 'shield.perfect', label: 'Well-timed block window (s)', min: 0.05, max: 0.4, step: 0.01 },
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
  // the art (step 6): E.art where the engine has it (ADR-0020); without it every image keeps its drawn fallback
  init(E) {
    ART = E.art || null;
    if (!ART) return;
    KIT.on = ART.enabled && !!E.save.get('kitPilot', true);
    ART.on(() => { artV++; });
    E.art.label = artLabel;
    kitSwitch(E);
  },
  scenes: { menu, arenas: pickArena, ludus, champs, roll, play, over },
};
