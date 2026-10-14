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
// and steps in when the first is winded or felled), the Grand Games ending on the Emperor's thumb; a crowd meter fills with style and drains on turtling,
// throws the gold as coins, drives Glory's chant and decides the thumb. H is the fighter body unit (screen height x fighter.height, scaled by size); body units have x forward, y down,
// origin at the feet. Particles are the game's own, so a hit-stop freezes them. The section map is docs/games/arena/CODEMAP.md.

import { makeRng, clamp, lerp } from './engine.js';

// ====== TUNING: every tunable number ======
const TUNING = {
  hearts: 3,               // drawn as hearts, counted in halves
  heal: 1,                 // half hearts back for each foe felled
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
  fighter: { height: 0.72, floor: 0.92, gap: 0.2, body: 0.12 },   // body unit as a fraction of screen height, feet line, clear gap between the bodies (fraction of width), half body width in H
  lunge: { stride: 0.3, cost: 10, tauIn: 0.06, tauOut: 0.14 },  // stride in H; extra stamina; seconds to step in and back
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
  juice: { stop1: 0.04, stop2: 0.07, stop3: 0.1, stopBreak: 0.05, stopClang: 0.03, strawPerDmg: 14 },
  foe: { swayX: 0.05, swayDeg: 3, kick: 0.9, hp: 22, tierHp: 0.1, champHp: 1.15, dmgCap: 3, coverShield: 0.2, coverGuard: 0.1 },  // hp scaled by size and tier; dmgCap: most half hearts one blow takes; cover radii (H) with and without a shield
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
    // slot = slot-hit multiplier, slotDmg = what multiplies a slot hit in place of dmg (the dagger's slot hits are 4x a bare jab, so 1.33x the gladius's),
    // overBreak = dents at which an overhead breaks a plate (0: the usual armour.dents), mace = chance an axe is a mace
    weapons: {
      gladius: { name: 'GLADIUS', reach: 1, speed: 1, dmg: 1, cost: 1, slash: 1, slot: 3, slotDmg: 1, overBreak: 0 },
      spear: { name: 'SPEAR', reach: 1.35, speed: 0.85, dmg: 1, cost: 1, slash: 0.6, slot: 3, slotDmg: 1, overBreak: 0 },
      axe: { name: 'AXE', alt: 'MACE', reach: 0.9, speed: 0.75, dmg: 1.7, cost: 1.4, slash: 1, slot: 3, slotDmg: 1.7, overBreak: 2 },
      dagger: { name: 'DAGGER', reach: 0.65, speed: 1.4, dmg: 0.75, cost: 1, slash: 1, slot: 4, slotDmg: 1, overBreak: 0 },
    },
    mace: 0.5,
  },
  // the two backgrounds that keep a v1 perk until their families arrive: the bar share Second Wind refills (once per run), seconds of feint shimmer
  perks: { baker: 0.5, scribe: 0.2 },
  // the reason's thread: the debt in denarii and what each fell knocks off it; the crowd's chant (one clap, and one more per share of the crowd meter, up to
  // max, louder with each: gain base + step x claps beyond the first)
  story: { debt: 1000, debtPer: 200, chant: { gain: 0.08, step: 0.04, gap: 0.24, max: 5 } },
  // the one token per run: a Respin on your fighter card or a Reroll on a draft
  token: 1,
  hint: { bouts: 2, dur: 10 },  // the in-play hint shows in this many bouts ever, for this many seconds of each
  // footwork, in H. Yours: a tap of DODGE is the backstep (back x your Speed's dodge length), holding it keeps backing off at walkBack; a lunge's recovery
  // takes back up to pace of the ground you gave, over gainDur s, never past your mark; drift: idle for idle s (no swing, dodge or lunge) you drift back a pace per secs s. Speeds are H per second. close: nearest clear gap between the bodies.
  // room: the most each fighter can give ground before the wall (yours, his), trimmed to the screen; margin: px kept clear at the screen edge.
  // His: walk speed (x Speed and size), commit = speed share while winding up, reach = how far past his striking distance a blow still lands, push = a pace share.
// He commits only with your body (feet plus lunge) inside his striking distance plus reach. A blow that then falls short counts as your dodge when your body gave
// at least give H during his tell. After a lunge launched from beyond his reach he chases for chase s at chaseV x his walk, and strikes within chaseSwing s.
  // the left column: width as a fraction of screen width (never under minW), gap between buttons, top of the column below the safe top, DODGE height (fraction of screen height, never under dodgeMinH), touch reach past a drawn edge, and how much of the way the fighters' frame slides toward the middle of the space the column leaves
  col: { frac: 0.22, minW: 96, gap: 6, top: 70, dodgeFrac: 0.17, dodgeMinH: 64, reach: 8, frame: 0.75 },
  foot: { pace: 0.14, drift: { idle: 0.6, secs: 1.5 }, gainDur: 0.16, back: 0.2, walkBack: 0.42, close: 0.1, room: [0.6, 0.7], margin: 22, foeV: 0.75, commit: 0.3, reach: 0.12, push: 0.5, wallMsg: 0.9, give: 0.02, chase: 1.0, chaseV: 1.6, chaseSwing: 0.5 },
  // the bout's grade: S needs no hits taken and reads + punishes of at least S.skill; A and B allow up to taken hits with slot hits + reads + punishes of at least skill
  grade: { S: { taken: 0, skill: 2 }, A: { taken: 1, skill: 3 }, B: { taken: 3, skill: 1 } },
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
  // Brute: heavy = overhead dents x, brawler = pips per broken plate, jugg = blow cost x while lunging, titan = half hearts. Duos: cape = every nth stuns for capeStun s,
  // butcher = stacks per broken plate, spiked = stacks per perfect block, hamWin = s after a tell dodge. fist = most half hearts a disarmed blow takes.
  cards: {
    hide: 1, wind: 1.2, wrist: 0.8, steady: 0.75, grip: 1.2, feet: 1.25, deepbreath: 1.2, edge: 1, tough: 2,
    shove: 2, shoveStun: 1, thorns: 3, thornsDur: 4,
    serrated: 1, rend: 1, vein: 1.2, bloodlust: 2, cruel: 1,
    sidestep: 1, matador: 1, slip: 2, slipWin: 1, untouch: 1,
    heavy: 2, brawler: 2, jugg: 0.5, titan: 4,
    cape: 2, capeStun: 1, butcher: 2, spiked: 1, hamWin: 1,
    fist: 1,
  },
  // finishers: Momentum each costs; Execute works below this share of his health; Disarm's seconds
  fin: { exec: 3, whirl: 2, breath: 2, disarm: 4, below: 0.5, disarmDur: 3 },
  // Momentum pips, per bout: the most you hold, what each event gives (a perfect block, a feint read, a dodge in his tell, a laming);
  // a finisher fires on a long press of the sword thumb: held within slop px of where it landed for hold s, with no swing in the last still s
  mom: { max: 5, perfect: 1, read: 1, dodge: 1, lame: 1, hold: 0.45, slop: 14, still: 0.3 },
  // bleed on him: at most max stacks, each lasting dur s; every tick s each stack deals dmg
  bleed: { max: 5, dur: 6, tick: 1, dmg: 0.5 },
  // his gear (from the deck, one piece a slot): pieces per bout, the highest rarity each bout deals (a champion also wears one legendary). Four pieces act for
  // him: Thorns (a blow on his guard costs you thorns stamina), Bloodlust (his blow that lands gives him bloodlust stamina), Riposte (he counters a blow off
  // his guard) and Unbreakable (he shrugs off your first hit each bout); the rest are a look and a warning
  foeGear: { n: [0, 1, 1, 2, 3], rar: [0, 1, 1, 2, 2], thorns: 8, bloodlust: 15 },
  // his gap guards: per bout, the chance of one, then of a second; each gap's weight (the gorget the most common); the gaps always left open
  guard: { one: [0, 0.35, 0.5, 0.65, 1], two: [0, 0.15, 0.25, 0.35, 0.4], w: { 'slot-neck': 4, 'slot-armpit': 1.5, 'slot-waist': 1.5, 'slot-elbow': 1.5, 'slot-knee': 1.5 }, open: 2 },
  // crippling him: a lamed sword arm lengthens his wind-ups by arm; a lamed shield arm makes his cover slide cover x slower; lamed legs walk at legs x
  lame: { arm: 0.2, cover: 2.5, legs: 0.55 },
  // each arena's foes: shift = stat levels added to every bout's centre, feint = x his feint weight, guard = added to the chance of a first and a second
  // gap guard (never in bout 1), gear = pieces added to each foe's; ring = x the distance to both walls; pairs = the bout index (0-based) pairs start at
  arenas: {
    pit: { shift: 0, feint: 1, guard: [0, 0], gear: 0, ring: 0.7, pairs: 99 },
    city: { shift: 0.4, feint: 1.15, guard: [0.1, 0.05], gear: 0, ring: 1, pairs: 2 },
    rome: { shift: 0.7, feint: 1.25, guard: [0.15, 0.1], gear: 1, ring: 1, pairs: 99 },
    games: { shift: 0.9, feint: 1.35, guard: [0.2, 0.1], gear: 1, ring: 1, pairs: 99 },
  },
  // the City's pairs: the waiting foe drawn at scale x his size and alpha, his centre x from the screen's edge (in his H), his body's half width (body, in his H);
  // the fighters' frame slides left until the one fighting stays clear of him (room = H his wall gives the one fighting past his mark, fbody = his half width in
  // his H); taunt = s his bubble shows before he steps in; enter = s before the one who steps in may swing; hp = x each pair foe's health
  pairs: { scale: 0.6, alpha: 0.6, x: 0.3, body: 0.2, room: 0.1, fbody: 0.22, taunt: 0.5, enter: 1.2, hp: 1 },
  // the crowd's favour, 0 to max, carried through the run: what each style event gives (a feint read, a perfect block, a slot hit, a laming, a bout with
  // no hits taken, two of your hits within comboWin s, a finisher), what turtling (his turtle read's measure) and backing off with no blow coming drain
  // per second; coins arc in from the stands at each step of favour; the Emperor's thumb reads the meter by thirds (bands)
  crowd: { max: 100, read: 10, perfect: 5, slot: 5, lame: 5, clean: 10, combo: 2, fin: 2, comboWin: 1, turtle: 4, back: 6, step: 20, coins: 5, coinCap: 15, bands: [1 / 3, 2 / 3] },
  // the Emperor's thumb card: s the box takes to show, then the hand to rise, then the thumb to turn; s before a tap continues
  thumb: { box: 0.6, hand: 0.8, turn: 0.4, tap: 2.2 },
};

// ====== DATA TABLES: the gauntlet, story lines, the upgrade deck, body parts, zones and poses ======
// The gauntlet: what each bout may roll (sizes, armour sets) and the stat level it centres on. The fifth is the named champion.
// The ramp: bout 1 is a sparring partner (no feints, no memory, no counters, tells x tell); feints from bout 2, memory from bout 3.
const GAUNTLET = [
  { sizes: ['S'], armour: ['light'], stat: 1, spar: true, tell: 1.4 },
  { sizes: ['S', 'M'], armour: ['light', 'medium'], stat: 1.9, feints: true, counters: true },
  { sizes: ['M', 'L'], armour: ['medium'], stat: 2.6, feints: true, memory: true, counters: true },
  { sizes: ['S', 'M', 'L'], armour: ['medium', 'heavy'], stat: 3.2, feints: true, memory: true, counters: true },
  { sizes: ['M', 'L'], armour: ['heavy'], stat: 4, champion: true, feints: true, memory: true, counters: true },
];
const NAMES = ['Crixus', 'Priscus', 'Verus', 'Celadus', 'Triumphus', 'Tetraites', 'Spiculus', 'Attilius', 'Oenomaus', 'Gannicus', 'Pugnax', 'Calamus', 'Asteropaeus'];
const CHAMPIONS = ['Flamma the Unbroken', 'Marcus the Red', 'Varro of Capua', 'Aurelius the Golden'];
// The later arenas' champions, each tied to your reason in his own words: the tie on his card and the line he says. The Twins are one pairs bout,
// Castor first and Pollux waiting.
const NEW_CHAMPS = {
  twins: { name: 'Castor', pair: 'Pollux', title: 'Castor and Pollux, the Twins',
    tie: { revenge: 'Their torches lit your village.', debt: "The moneylender's sons. They collect in pairs.", freedom: 'Freed together. They fight to stay that way.', glory: "Pompeii's darlings, both of them." },
    line: { revenge: 'One of us lit the fire. Guess which.', debt: 'Two of us, one debt. Pay twice.', freedom: 'Free men fight in pairs. You fight alone.', glory: 'They came to see twins. Not you.' } },
  hermes: { name: 'Hermes the Swift',
    tie: { revenge: 'He ran the torch from roof to roof.', debt: "He runs the moneylender's errands.", freedom: 'He ran his way free. Nobody catches him.', glory: 'The fastest blade in Pompeii.' },
    line: { revenge: 'I was gone before the roofs fell.', debt: 'I collect. Quickly.', freedom: "You can't win freedom you can't catch.", glory: 'Blink, and you miss your own fall.' } },
  aquila: { name: "Aquila, the Emperor's Blade",
    tie: { revenge: "He carried the Emperor's torch.", debt: "The Emperor's purse. Your debt is in it.", freedom: "He holds the wooden sword, by the Emperor's leave.", glory: "Rome's own champion." },
    line: { revenge: 'The Emperor ordered it. I obeyed.', debt: 'Your debt bought my armour.', freedom: 'The wooden sword is mine to give. I will not.', glory: 'Rome has one name. Mine.' } },
};
// The ladder: one run is one arena. rows = which gauntlet rows its bouts roll from (the Grand Games skip the sparring partner); champs = its champion pool;
// who = how its champion is named on the next arena's lock; soon = shown locked, not built yet. Its numbers are TUNING.arenas.
const ARENAS = [
  { id: 'pit', name: 'The Pit', short: 'Pit', who: 'Pit', place: 'Capua', twist: 'The tight ring', rows: [0, 1, 2, 3, 4], champs: CHAMPIONS, champLabel: 'Four champions',
    brutus: 'Everyone starts in the sand. Few leave it.' },
  { id: 'city', name: 'The City arena', short: 'City', who: 'City', place: 'Pompeii', twist: 'Two foes, one at a time', rows: [0, 1, 2, 3, 4], champs: ['twins', 'hermes'], champLabel: 'The Twins or Hermes',
    brutus: 'Pompeii likes a show. Give them one.' },
  { id: 'rome', name: 'The Colosseum', short: 'Colosseum', who: 'Colosseum', place: 'Rome', twist: 'Men and beasts', rows: [0, 1, 2, 3, 4], champs: [], champLabel: 'Carpophorus or Mevia', soon: true,
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

// Your fighter's story. Each origin is one background (its noun), and each background gives one perk. Names carry 'f' or 'm' for the epilogue's and the wall's words.
const ORIGINS = {
  gaul: { text: 'a farmer from Gaul', noun: 'farmer' }, thrace: { text: 'a Thracian soldier', noun: 'soldier' }, numidia: { text: 'a Numidian horseman', noun: 'horseman' },
  capua: { text: 'a baker from Capua', noun: 'baker' }, ostia: { text: 'a sailor from Ostia', noun: 'sailor' }, alexandria: { text: 'a scribe from Alexandria', noun: 'scribe' },
};
// A background deals its family's start card; the baker and the scribe keep their v1 perk until their families arrive.
const PERKS = {
  baker: { name: 'Baker', line: 'Second Wind once per run (up before dawn)' },
  scribe: { name: 'Scribe', line: 'feint shimmer 0.2 s longer (reads people)' },
};
const START_FAM = { soldier: 'wall', horseman: 'dancer', farmer: 'brute', sailor: 'blood' };
const bg = () => ORIGINS[state.me.origin].noun;
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
// his line for your background, said before your second bout
const BRUTUS_BG = {
  farmer: 'You plough a field one row at a time. Same here.', soldier: 'Fight like you drilled, soldier. Shield first.', horseman: 'Light feet, horseman. Give him nothing to hit.',
  baker: 'Knead him like dough, baker!', sailor: 'Sea legs, sailor. Let him crash on you.', scribe: 'Read him like a scroll.',
};
// revenge climbs: his line before each bout, and after each fell
const REVENGE = {
  intro: ["He burned your village. He's waiting at the end.", null, 'Keep your anger for the champion.', 'Not yet. Him last.', 'There he is. The man with the torch.'],
  won: ["One down. He's still out there.", 'Good. Let it burn in you.', 'Two more. Keep the fire banked.', 'Next is him. Make him remember the village.'],
};
// The champion is tied to your reason: a line on his card, and what he says.
const CHAMP_TIE = { revenge: 'He burned your village.', debt: "He's in the moneylender's pay.", freedom: 'A freed man, back for the money.', glory: "The crowd's darling." };
const CHAMP_LINE = { revenge: 'I remember the fire. Do you?', debt: "Your family's debt is my purse.", freedom: 'I was free once. Gold brought me back.', glory: 'They will forget you by morning.' };
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
  return `Hear them? They chant ${me.name.toUpperCase()} louder now.`;
}
const EPILOGUE = {
  freedom: (n, f) => `${n} walked out a free ${f ? 'woman' : 'man'}, the wooden sword in hand.`,
  debt: (n, f) => `The debt was paid. ${n} went home to ${f ? 'her' : 'his'} family.`,
  revenge: (n) => `The village was avenged. ${n} finally slept.`,
  glory: (n) => `Rome sang the name ${n} for a generation.`,
};
// The City's ending, one per reason: a chapter closed, Rome ahead.
const CITY_END = {
  freedom: (n) => `Pompeii roared for ${n}. The wooden sword waits in Rome.`,
  debt: (n) => `Pompeii paid in silver. ${n}'s family ate meat that winter.`,
  revenge: (n) => `In Pompeii, ${n} learned who gave the order: Rome.`,
  glory: (n) => `Pompeii chanted ${n} until dawn. Rome heard it.`,
};
// The Grand Games end on the Emperor's thumb: the true ending for your reason at a full meter, a cold nod, or thumbs down.
const TRUE_END = {
  debt: 'The Emperor pays your debt himself. The moneylender bows.',
  revenge: "Aquila burned your village on the Emperor's order. The Emperor looks away first.",
  freedom: 'The Emperor hands you the wooden sword. You are free.',
  glory: 'Rome chants your name. They will sing it for a hundred years.',
};
const THUMB_END = ['Free, but forgotten. You walk out to silence.', 'The Emperor nods. Rome will forget you by spring.'];
// the crowd's band: 0 low, 1 middling, 2 full (the top third)
const bandOf = (fav) => { const B = TUNING.crowd.bands, k = fav / TUNING.crowd.max; return k >= B[1] ? 2 : k >= B[0] ? 1 : 0; };
// how a won run ends: the Pit's epilogue, the City's, or the Emperor's thumb
function endingOf(arenaId, me, fav) {
  if (arenaId === 'games') { const b = bandOf(fav); return b === 2 ? TRUE_END[me.reason] : THUMB_END[b]; }
  if (arenaId === 'city') return CITY_END[me.reason](me.name, me.female);
  return EPILOGUE[me.reason](me.name, me.female);
}
const storyLine = (me) => `${me.name}, ${ORIGINS[me.origin].text}. Fights for: ${REASON_NAME[me.reason]}.`;

// The deck: four families, each card one rule and one piece of gear (fam; tier = rarity: 0 common, 1 rare, 2 epic, 3 legendary; key = a keystone, the
// legendary that names its price). slot: where the piece is worn (one piece a slot), gear: its name. needs: a card that is useless without your shield or
// your dodge; bans: what a keystone takes away. Finishers are war paint (TUNING.fin) and a duo is a set bonus; neither takes a slot.
const FAMS = {
  wall: { name: 'The Wall', col: '#7dd3fc' }, blood: { name: 'Blood', col: '#f87171' }, dancer: { name: 'The Dancer', col: '#86efac' }, brute: { name: 'The Brute', col: '#fbbf24' },
  fin: { name: 'War paint', col: '#e879f9' }, rare: { name: 'Lone piece', col: '#c4b99a' },
};
const SLOT_NAMES = ['helmet', 'shield', 'weapon', 'chest', 'arms', 'legs', 'cloak', 'belt'];
const DECK = [
  { id: 'riposte', fam: 'wall', tier: 0, slot: 'arms', gear: 'Bronze Bracers', name: 'Riposte', line: 'A perfect block gives a free counter jab', needs: 'shield' },
  { id: 'shove', fam: 'wall', tier: 0, slot: 'chest', gear: 'Bronze Phalerae', name: 'Shield Shove', line: 'A perfect block shoves him; at his wall he is stunned 1 s', needs: 'shield' },
  { id: 'braced', fam: 'wall', tier: 0, slot: 'helmet', gear: 'Bronze Crest', name: 'Braced', line: 'Every block gives 1 Momentum, not only perfect ones', needs: 'shield' },
  { id: 'thorns', fam: 'wall', tier: 2, slot: 'shield', gear: 'Spiked Shield', name: 'Thorns', line: 'Each block dents his weapon; 3 dents disarm him', needs: 'shield' },
  { id: 'standfast', fam: 'wall', tier: 1, slot: 'legs', gear: 'Bronze Boots', name: 'Stand Fast', line: 'With your back to the wall, every block is perfect', needs: 'shield' },
  { id: 'ironwall', fam: 'wall', tier: 3, key: true, slot: 'shield', gear: 'Tower Shield', name: 'Iron Wall', line: 'Perfect window x2, each a free slot hit; but no dodge', needs: 'shield', bans: 'dodge' },
  { id: 'serrated', fam: 'blood', tier: 0, slot: 'weapon', gear: 'Saw-toothed Blade', name: 'Serrated Edge', line: 'Slot hits make him bleed 1' },
  { id: 'rend', fam: 'blood', tier: 0, slot: 'arms', gear: 'Barbed Bracers', name: 'Rend', line: 'A slash on a bare part makes him bleed 1' },
  { id: 'vein', fam: 'blood', tier: 1, slot: 'helmet', gear: 'Blood Band', name: 'Open Vein', line: 'While he bleeds, his tells are 20% slower' },
  { id: 'bloodlust', fam: 'blood', tier: 1, slot: 'cloak', gear: 'Wolf Pelt', name: 'Bloodlust', line: 'Each bleed tick gives you 2 stamina per stack' },
  { id: 'cruel', fam: 'blood', tier: 2, slot: 'belt', gear: 'Hook Belt', name: 'Cruel Edge', line: 'Slot hits do +1 for each bleed on him' },
  { id: 'haem', fam: 'blood', tier: 3, key: true, slot: 'weapon', gear: 'Hooked Sica', name: 'Haemorrhage', line: 'His bleed passes to the next foe; but bare hits do nothing' },
  { id: 'sidestep', fam: 'dancer', tier: 0, slot: 'legs', gear: "Dancer's Sandals", name: 'Sidestep', line: 'A dodge in his tell makes him overcommit: winded', needs: 'dodge' },
  { id: 'lightfeet', fam: 'dancer', tier: 0, slot: 'belt', gear: 'Ribbon Sash', name: 'Light Feet', line: 'A dodge in his tell gives back its stamina', needs: 'dodge' },
  { id: 'blur', fam: 'dancer', tier: 1, slot: 'chest', gear: 'Ghost Silk', name: 'Blur', line: 'A backstep leaves a ghost he attacks instead', needs: 'dodge' },
  { id: 'matador', fam: 'dancer', tier: 2, slot: 'arms', gear: "Matador's Ribbons", name: 'Matador', line: 'A dodged thrust or bash: he stumbles, stunned 1 s', needs: 'dodge' },
  { id: 'slip', fam: 'dancer', tier: 1, slot: 'helmet', gear: 'Ribbon Band', name: 'Slip and Stab', line: 'A jab within 1 s of a tell dodge does 2x', needs: 'dodge' },
  { id: 'untouch', fam: 'dancer', tier: 3, key: true, slot: 'cloak', gear: 'Flowing Cape', name: 'Untouchable', line: 'Free dodges; a tell dodge opens all slots 1 s; but no shield', needs: 'dodge', bans: 'shield' },
  { id: 'heavy', fam: 'brute', tier: 0, slot: 'weapon', gear: 'Iron Pommel', name: 'Heavy Arm', line: 'Your overheads dent plates twice as much' },
  { id: 'brawler', fam: 'brute', tier: 0, slot: 'belt', gear: 'Chain Belt', name: 'Brawler', line: 'Breaking a plate gives 2 Momentum' },
  { id: 'breaker', fam: 'brute', tier: 2, slot: 'helmet', gear: 'Horned Cap', name: 'Plate Breaker', line: 'An overhead strips the plate it hits' },
  { id: 'bones', fam: 'brute', tier: 1, slot: 'legs', gear: 'Spiked Boots', name: 'Bonebreaker', line: 'An overhead on a bare limb lames it at once' },
  { id: 'jugg', fam: 'brute', tier: 1, slot: 'arms', gear: 'Iron Pauldrons', name: 'Juggernaut', line: 'Lunging, his blow costs half and does not stop you' },
  { id: 'titan', fam: 'brute', tier: 3, key: true, slot: 'chest', gear: 'Black Plate', name: 'Titan', line: "+2 hearts; every overhead staggers him; but you can't dodge", bans: 'dodge' },
  { id: 'exec', fam: 'fin', tier: 1, gear: 'Red Bar', name: 'Execute', line: '3 pips, him below half: your next slot hit fells him' },
  { id: 'whirl', fam: 'fin', tier: 1, gear: 'Woad Spiral', name: 'Whirlwind', line: '2 pips: your next slash hits every slot it crosses' },
  { id: 'breath', fam: 'fin', tier: 1, gear: 'Chalk Dots', name: 'Second Breath', line: '2 pips: refill all your stamina' },
  { id: 'disarm', fam: 'fin', tier: 1, gear: 'Ochre Zigzag', name: 'Disarm', line: '4 pips: his weapon flies; 3 s of fists only' },
  { id: 'unbreak', fam: 'rare', tier: 2, slot: 'cloak', gear: 'Lion Pelt', name: 'Unbreakable', line: 'The first hit each bout is ignored' },
  { id: 'cape', duo: ['dancer', 'wall'], tier: 2, name: "Matador's Cape", line: 'Every 2nd perfect block or tell dodge stuns him 1 s' },
  { id: 'butcher', duo: ['brute', 'blood'], tier: 2, name: 'Butcher', line: 'A broken plate makes him bleed 2' },
  { id: 'spiked', duo: ['wall', 'blood'], tier: 2, name: 'Spiked Boss', line: 'A perfect block makes him bleed 1', needs: 'shield' },
  { id: 'hamstring', duo: ['dancer', 'brute'], tier: 2, name: 'Hamstring', line: 'A hit within 1 s of a tell dodge lames his legs', needs: 'dodge' },
];
for (const c of DECK) { c.fam = c.fam || 'duo'; c.ab = c.name.split(/[ ']/).filter((w) => /^[A-Z]/.test(w)).map((w) => w[0]).join('').slice(0, 2); }
const CARD = Object.fromEntries(DECK.map((c) => [c.id, c]));
// The armourer's wares. Big ones, then the v1 commons, now sold cheap here.
const WARES = [
  { id: 'plate', big: true, name: 'Iron plate', line: 'Your {part} is plated' },
  { id: 'whet', big: true, name: 'Whetstone', line: '+1 damage on every hit' },
  { id: 'heart', big: true, name: 'A heart', line: '+1 heart, and healed' },
  { id: 'token', big: true, name: 'Lucky token', line: '+1 reroll for a draft' },
  { id: 'forge', big: true, name: 'Forged {weapon}', line: 'Your weapon hits 25% harder' },
  { id: 'hide', name: 'Thick Hide', line: '+\u00bd heart' },
  { id: 'wind', name: 'Big Lungs', line: '+20% stamina' },
  { id: 'wrist', name: 'Quick Wrist', line: 'jab recovery \u221220%' },
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
const tierName = (c) => (c.duo ? 'SET BONUS' : c.fam === 'fin' ? `WAR PAINT \u00b7 ${TUNING.fin[c.id]} PIPS` : `${TIERS[c.tier]}${c.key ? ' KEYSTONE' : ''} \u00b7 ${c.slot.toUpperCase()}`);
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

// ====== ROLLS: your fighter, the gauntlet, and each run and bout set up from the seed ======
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
  // the weapon is rolled last, after the name, so adding the wheel did not change what a seed rolls for the rest
  const weapon = spin(W.weapon), mace = rng.chance(TUNING.me.mace), cardRoll = rng.int(0, 9999);
  idx.push(weapon, origin, reason);
  return deriveMe({ idx, plates, name, female: sex === 'f', mace, cardRoll });
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

// One fighter of the gauntlet, rolled from the bout's tables: size, weapon, armour set, three 1-5 stats with the size's bias (shifted by the arena).
// tier is his gauntlet row, at his place in the arena's run; a champion is picked from the arena's pool.
function rollFighter(rng, tier, weapon, used, A = ARENAS[0], at = tier) {
  const G = GAUNTLET[tier], T = TUNING, shift = T.arenas[A.id].shift;
  let size, set;
  for (let k = 0; k < 20; k++) {
    const si = rng.pick(G.sizes), ai = rng.pick(G.armour);
    size = T.sizes.find((z) => z.id === si); set = T.armourSets.find((z) => z.id === ai);
    if (!used.has(`${size.id}${weapon.id}${set.id}`)) break;
  }
  used.add(`${size.id}${weapon.id}${set.id}`);
  const roll = (b) => clamp(Math.round(G.stat + shift + b + rng.range(-1, 1)), 1, 5);
  const best = (b) => (G.champion ? Math.max(roll(b), roll(b)) : roll(b));
  const stats = size.bias.map(best);
  const pick = G.champion ? rng.pick(A.champs) : rng.pick(NAMES), C = NEW_CHAMPS[pick];
  return { tier, at, name: C ? C.name : pick, ck: C ? pick : null, title: C ? C.title || null : null, pair: null, champion: !!G.champion, size, weapon, set, str: stats[0], spd: stats[1], sta: stats[2],
    shield: rng.chance(weapon.shield), mace: rng.chance(0.5), partSeed: (rng() * 2 ** 32) >>> 0 };
}
// a fighter from a saved rival record, on the rolled one's place
function fromRival(c, rv) {
  const T = TUNING, size = T.sizes.find((z) => z.id === rv.size), weapon = T.weapons.find((z) => z.id === rv.weapon), set = T.armourSets.find((z) => z.id === rv.set);
  if (!size || !weapon || !set) return null;
  return { ...c, name: rv.name, ck: rv.ck || null, title: rv.title || null, rival: true, champion: rv.champion != null ? rv.champion : c.champion, size, weapon, set, str: rv.str, spd: rv.spd, sta: rv.sta, shield: !!rv.shield, mace: !!rv.mace, partSeed: rv.partSeed >>> 0, gaps: rv.gaps || {} };
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
  const c = g[g.length - 1], rv = rival && fromRival(c, rival);
  if (rv) { g[g.length - 1] = rv; rv.pair = rival.pair ? fromRival({ ...(c.pair || c), pair: null }, rival.pair) || c.pair : c.pair; }
  // his gear and gap guards, on their own stream so the fighters above roll as they always did (a pair's second on another); a rival keeps the gear he wore
  const gr = makeRng(seed ^ 0x2f6b9a17), gp = makeRng(seed ^ 0x3c6ef373);
  const kit = (d, src, rec) => { const gear = rollGear(src, d, d.tier, A), guards = rollGuards(src, d, d.tier, A); d.gear = d.rival && rec && rec.gear ? rec.gear.slice() : gear; d.guards = guards; };
  g.forEach((d) => kit(d, gr, rival));
  g.forEach((d) => { if (d.pair) kit(d.pair, gp, rival && rival.pair); });
  return g;
}
const rivalOf = (d) => ({ name: d.name, ck: d.ck || null, title: d.title || null, champion: !!d.champion, size: d.size.id, weapon: d.weapon.id, set: d.set.id, str: d.str, spd: d.spd, sta: d.sta, shield: d.shield, mace: d.mace, partSeed: d.partSeed,
  gear: (d.gear || []).slice(), gaps: { ...(d.gaps || {}) }, pair: d.pair ? rivalOf(d.pair) : null });
// His gear from the deck: more pieces in later bouts, one a slot, up to the bout's rarity; a champion also wears a legendary. A shield piece only on a
// shield-bearer, and the cape that bans the shield only on a man without one.
function rollGear(rng, d, i, A = ARENAS[0]) {
  const F = TUNING.foeGear, out = [], fams = ['wall', 'blood', 'dancer', 'brute', 'rare'], n = F.n[i] + TUNING.arenas[A.id].gear;
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
  f.parts = guardParts(foeParts(makeRng(d.partSeed), d.set), d.guards); f.look = foeLook(d); f.cloak = null;
  f.maxHp = Math.round(FT.hp * d.size.hp * (1 + FT.tierHp * d.tier) * (d.champion ? FT.champHp : 1) * (pair ? TUNING.pairs.hp : 1)); f.hp = f.maxHp; f.shown = f.hp;
  f.staMax = TUNING.foeSta.base + TUNING.foeSta.per * d.sta; f.sta = f.staMax; f.staT = 9; f.staShown = 1;
  f.home = d.weapon.range + d.size.reach; f.strike = d.weapon.strike + d.size.reach;
  f.th = REST_TH; f.dx = 0; f.dy = 0; f.a = 0; f.fr = {}; f.down = false; f.bleed = []; f.dents = 0; f.shrug = false;
  return f;
}
function newRack(E) {
  const d = state.gauntlet[state.rack];
  state.foe = makeFoe(d, !!d.pair); state.edge = d.pair ? makeFoe(d.pair, true) : null;
  state.swapping = false; state.tauntT = 0; state.taunt = '';
  state.rng = makeRng(state.seed + state.rack * 7919);
  state.cover = null; state.step = { x: state.foe.home, tgt: 0, t: 1, dodgeT: 0, dodgeCool: 0 };
  state.pop = 1; state.fallT = 0; state.sw = null; state.move = null; state.plan = null; state.stun = 0; state.stagger = 0; state.kickA = 0; state.kickV = 0;
  state.winded = 0; state.windedMax = 1; state.retreat = 0; state.chase = 0; state.mood = { retreat: false };
  state.mem = { blocks: [], lunges: [], turtle: 0 };
  state.swingIn = 1.2; state.intro = true; state.introT = 0; state.warm = false;
  if (state.me.reason === 'glory') chant(E);
  saveRun(E);
  settleFeint('none');
  state.bout = { felled: false, shrugged: false, foeShrug: false, gaps: {}, perf: state.perfects, slot: state.slotHits, read: state.feintsRead, pun: state.punishes, taken: state.taken };
  state.open = 0; state.riposte = 0; state.slowT = 0; state.snapT = 0;
  state.sh.hits = shieldMax(); state.sh.broken = false; state.sh.cool = 0; state.sh.blocked = false;
  // both fighters start each bout back on their marks
  Object.assign(state.foot, { pos: 0, tgt: 0, v: 1, wallT: -9, foeWallT: -9 });
  state.mom = 0; state.momT = 0; state.bleed = []; state.bleedT = 0; state.lastTellDodge = -9;
  state.armed = {}; state.openAll = 0; state.disarm = 0; state.flyW = 0; state.dents = 0; state.cape = 0;
  emit(E, 'start');
}

function nextGap() { const S = TUNING.swing; return S.gap * 0.6 + state.rng.range(0, S.gapSpread); }

function newRound(E, seed, me0, rv, arenaId = 'pit') {
  const M = TUNING.me, me = { ...me0, plates: me0.plates.slice() }, A = ARENA[arenaId] || ARENAS[0], rival = rv !== undefined ? rv : E.save.get('rivals', {})[A.id] || null;
  Object.assign(state, {
    me, maxHp: me.halves, staMax: M.staMax[me.sta - 1], lessons: E.save.get('feintLesson', 0), caption: null, slowT: 0,
    picks: [], grades: [], draft: null, token: TUNING.token, tokenUsed: '', epicsSeen: 0, switchReads: 0, hint: false, boutT0: 0, stepsIn: 0, stepsOut: 0, wallHits: 0, foeWall: 0, outReach: 0, dodged: 0, chases: 0, bakerWind: false, shrugs: 0, rivalBeaten: 0,
    foot: { pos: 0, tgt: 0, v: 1, wallT: -9, foeWallT: -9 },
    seed, arena: A.id, rng: makeRng(seed ^ 0x9e3779b9), gauntlet: rollGauntlet(seed, rival, A), results: [], rack: 0, m: 0, stop: 0, kickA: 0, kickV: 0,
    hp: me.halves, endT: 0, dodgeT: 0, dodgeMax: TUNING.dodge.dur, dodgeCool: 0, away: false, dodgeM: -9, hurt: 0, done: false, exhaust: 0, exMsg: -9, lunging: false, lunges: 0, slotHits: 0, dg: { down: false, id: -1, t: 0 },
    stamina: M.staMax[me.sta - 1], lastAtk: -9, riposte: 0, open: 0, netT: 0, pushT: 0,
    gapHits: 0, clangs: 0, broken: 0, overheads: 0, jabs: 0, slashes: 0, blocks: 0, perfects: 0, dodges: 0, staOuts: 0, counters: 0, counterHits: 0, taken: 0, felled: 0,
    feints: 0, feintsRead: 0, feintsBit: 0, feintsNone: 0, feintLive: false, plateSaves: 0, combos: 0, windeds: 0, punishes: 0, bashes: 0, bashHits: 0, nets: 0, netted: 0, zoneReads: 0, lungeReads: 0, turtleReads: 0, presses: 0, retreats: 0, moveCount: {},
    fx: [], pops: [], streaks: [], trail: [],
    mom: 0, momT: 0, momGained: 0, momSpent: 0, lamings: 0, gold: 0, goldEarned: 0, lastGold: null, bought: [], rerolls: 0, tent: null, tentDone: false, lab: null, labMom: false, labUsed: 0, fins: [], wares: [], carry: 0, armed: {}, openAll: 0, disarm: 0, flyW: 0, dents: 0, cape: 0, bleed: [], bleedT: 0, bleeds: 0, bleedDmg: 0,
    you: { lunge: 0, lungeK: 0, a: 0, back: 0, hopY: 0, push: 0, parts: playerParts(me), fr: {} },
    foe: {}, edge: null, swapping: false, tauntT: 0, taunt: '',
    fav: 0, favStep: 0, favT: 0, favShown: 0, lastHitM: -9, opened: null,
    crowd: [],
    sh: { t: -1, cool: 0, up: 0, hits: TUNING.shield.hits, broken: false, flash: 0, zone: ZONES[1], held: false, hid: -1, zy: -0.58, arm: 0, blocked: false, pressT: -9 },
    hand: { down: false, id: -1, fx: 0, fy: 0, tgx: 0, tgy: 0, ux: 0, uy: 0, pux: 0, puy: 0, hx: 0, hy: 0, phx: 0, phy: 0, ex: 0, ey: 0, sx: 0, sy: 0, bx: 1, by: 0, ang: 0, pang: 0, ph: 0, vx: 0, vy: 0, along: 0, hvx: 0, hvy: 0, lock: 0, grip: 0, sp: 0, raisedT: -9, atk: null },
  });
  const sc = startCard(me);
  if (sc) applyCard(sc);
  const cr = makeRng(seed ^ 0x1234567);
  for (let i = 0; i < 70; i++) state.crowd.push({ x: cr.range(0, 1), y: cr.range(0, 1), r: cr.range(2, 4), c: cr.int(0, 3) });
}
// your background's start card: a common of its family, picked by the roll (none for the baker and the scribe)
function startCard(me) {
  const fam = START_FAM[ORIGINS[me.origin].noun];
  if (!fam) return null;
  const list = DECK.filter((c) => c.fam === fam && c.tier === 0);
  return list[(me.cardRoll || 0) % list.length];
}
// The run is saved at the start of each bout (the run's counts, your fighter and the bout reached) and resumed there; the bout itself replays from its seed.
const RUN_KEYS = ['hp', 'maxHp', 'staMax', 'picks', 'grades', 'results', 'token', 'tokenUsed', 'epicsSeen', 'switchReads', 'stepsIn', 'stepsOut', 'wallHits', 'foeWall', 'outReach', 'dodged', 'chases',
  'bakerWind', 'shrugs', 'gapHits', 'slotHits', 'lunges', 'clangs', 'broken', 'overheads', 'jabs', 'slashes', 'blocks', 'perfects', 'dodges', 'staOuts', 'counters', 'counterHits', 'taken', 'felled',
  'feints', 'feintsRead', 'feintsBit', 'feintsNone', 'combos', 'windeds', 'punishes', 'bashes', 'bashHits', 'nets', 'netted', 'zoneReads', 'lungeReads', 'turtleReads', 'presses', 'retreats', 'plateSaves', 'moveCount',
  'gold', 'goldEarned', 'wares', 'tentDone', 'bought', 'rerolls', 'momGained', 'momSpent', 'lamings', 'bleeds', 'bleedDmg', 'fins', 'carry', 'labUsed', 'fav', 'favStep'];
// A deep copy, since the engine flushes the save whenever the page is hidden, long after the live objects have moved on. `rack` is the bout to resume at;
// an open draft is saved too (its card ids), and resumes at the bout just felled with the same cards.
function saveRun(E, rack = state.rack) {
  const c = state.gauntlet[state.gauntlet.length - 1];
  const d = state.draft, draft = d ? { grade: d.grade, tally: d.tally, gold: d.gold, ids: d.cards.map((q) => q.id), priced: d.priced, odds: d.odds } : null;
  E.save.set('run', JSON.parse(JSON.stringify({ seed: state.seed, arena: state.arena, rack, me: state.me, rival: c.rival ? rivalOf(c) : null, draft, ...Object.fromEntries(RUN_KEYS.map((k) => [k, state[k]])) })));
}
function resumeRun(E, run) {
  newRound(E, run.seed, run.me, run.rival, run.arena);
  for (const k of RUN_KEYS) if (k in run) state[k] = run[k];
  state.results = (run.results || []).map((q) => q || undefined);
  state.rack = run.rack; state.you.parts = playerParts(state.me); state.stamina = state.staMax; state.favShown = state.fav;
  const d = run.draft;
  if (d) state.draft = { grade: d.grade, tally: d.tally, gold: d.gold, cards: d.ids.map((id) => CARD[id]), priced: d.priced, odds: d.odds || [], t: 0, btns: [], reroll: null, help: null, helpOn: false };
}

// ====== FIGHTER MODEL: layout, your body and sword arm, footwork, defence, the foe's body ======
// ----- layout and frames -----
function lay(E) {
  const F = TUNING.fighter, H = E.h * F.height, half = (E.w * F.gap + 2 * F.body * H) / 2;
  // the frame is centred on the space right of the left column (partly, so the foe keeps room too)
  const R = colRect(E), c0 = E.w / 2 + TUNING.col.frame * ((R.x + R.w + (E.w - E.safe.right)) / 2 - E.w / 2), cx = c0 - pairShift(E, H, half, c0);
  return { H, floor: E.h * F.floor, x0: cx - half, x1: cx + half };
}
// In a pairs bout the waiting foe takes the screen's right edge, so the frame slides left (by the worst of the two foes in either place) until the one
// fighting keeps clear of him when he gives ground to his wall.
const waitLeft = (E, H, e) => E.w - E.safe.right - (TUNING.pairs.x + TUNING.pairs.body) * H * e.size.scale * TUNING.pairs.scale;
const foeRight = (H, f) => (f.home + TUNING.pairs.room + (f.size.scale - 1) * TUNING.fighter.body + TUNING.pairs.fbody * f.size.scale) * H;
function pairShift(E, H, half, cx) {
  const f = state.foe, e = state.edge;
  if (!e || !f || !f.size || !e.size) return 0;
  const x1 = cx + half;
  return Math.max(0, x1 + foeRight(H, f) - waitLeft(E, H, e) + 4, x1 + foeRight(H, e) - waitLeft(E, H, f) + 4);
}
// you are drawn at your rolled size the same way: your near edge stays put
function youF(E) { const L = lay(E), y = state.you, k = meSize().scale; return { x: L.x0 + state.foot.pos * L.H + y.lunge - y.push * L.H - (k - 1) * TUNING.fighter.body * L.H, y: L.floor + y.hopY, a: y.a, dir: 1, H: L.H * k }; }
// The arena's edges, in H from each fighter's mark: how far you can give ground (negative) and how far he can, trimmed so both stay on screen, then
// brought in by the arena's ring (the Pit's tight ring; the sparring bout keeps the full room).
function walls(E) {
  const L = lay(E), T = TUNING.foot, k = state.foe.size ? state.foe.size.scale : 1, ring = bout().spar ? 1 : arenaT().ring;
  const back = Math.min(T.room[0], Math.max(0.1, (L.x0 - 0.2 * L.H * meSize().scale - colRect(E).x - colRect(E).w - T.margin) / L.H));
  const fore = state.edge && state.edge.size ? Math.min(T.room[1], Math.max(0.1, (waitLeft(E, L.H, state.edge) - 4 - L.x1 - ((k - 1) * TUNING.fighter.body + TUNING.pairs.fbody * k) * L.H) / L.H))
    : Math.min(T.room[1], Math.max(0.1, (E.w - E.safe.right - 24 - L.x1 - 0.3 * L.H * k) / L.H));
  return { back: -back * ring, fore: fore * ring };
}
// the nearest the two can stand: the clear gap between the bodies at the marks, less a little air
const gMin = (E) => -(E.w * TUNING.fighter.gap) / lay(E).H + TUNING.foot.close;
// the gap between you now, in H, measured from where the marks put it
const gapNow = () => state.step.x - state.foot.pos;
// your body's place in the same units: your feet plus the lunge's stride; his reach is measured to it
const bodyPos = () => state.foot.pos + state.you.lungeK * TUNING.lunge.stride * meSize().scale;
const inReach = () => state.step.x - bodyPos() <= state.foe.strike + TUNING.foot.reach;
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
  // lunge: the thumb pushed far past the reach steps the gladiator in, up to a stride; he steps back when the hand relaxes or recoils
  let tk = 0;
  if (h.down && h.lock <= 0 && !state.away && state.exhaust <= 0 && state.endT <= 0 && state.fallT <= 0 && !(state.netT > 0 && TUNING.net.stuck)) {
    const [ox, oy] = relOff(), C = TUNING.control;
    tk = clamp((Math.hypot(ox, oy) / myArm(E) - C.lungeStart) / (C.lungeFull - C.lungeStart), 0, 1);
    if (tk > 0.1 && !state.lunging) {
      const lc = LU.cost;
      if (state.stamina >= lc) {
        state.stamina -= lc; state.lastAtk = state.m; state.lunging = true; state.lunges++; state.mem.lunges.push(state.m); swooshSound(E, 0.1);
        if (gapNow() > state.foe.strike + TUNING.foot.reach) chaseIn();
      }
      else { tk = 0; tiredPop(E); }
    } else if (tk < 0.05) endLunge();
  } else endLunge();
  y.lungeK += (tk - y.lungeK) * (1 - Math.exp(-dt / (tk > y.lungeK ? LU.tauIn : LU.tauOut)));
  y.lunge = y.lungeK * LU.stride * L.H;
  const want = state.away ? 1 : 0;
  y.back += (want - y.back) * (1 - Math.exp(-dt / (want ? 0.05 : 0.14)));
  const u = state.dodgeT > 0 ? 1 - state.dodgeT / state.dodgeMax : 1;
  y.hopY = state.dodgeT > 0 ? -D.hop * L.H * Math.sin(Math.PI * u) : 0;
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
// walking in is the lunge: its recovery plants your feet up to a pace forward, taking back ground you gave, never past your mark
function endLunge() {
  if (!state.lunging) return;
  state.lunging = false;
  const T = TUNING.foot, ft = state.foot;
  if (ft.pos >= 0) return;
  ft.tgt = Math.min(0, Math.max(ft.tgt, ft.pos) + T.pace); ft.v = T.pace / T.gainDur * gripMul(); state.stepsIn++;
}
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
  if (h.atk && (!live || h.sp < T.hit.minSpeed * 0.55)) h.atk = null;
  if (live && h.sp >= T.hit.minSpeed) h.swingT = state.m;
  if (!h.atk && live && h.sp >= T.hit.minSpeed) {
    const spv = Math.hypot(h.vx, h.vy) || 1, ux = h.vx / spv, uy = h.vy / spv;
    // a jab is a push forward along the guard line, whatever the arm's aim
    const ga = Math.atan2(TUNING.control.guard[1], TUNING.control.guard[0]), along = (h.vx * Math.cos(ga) + h.vy * Math.sin(ga)) / spv;
    let kind = null;
    if (along > TUNING.control.jabCone) { if (spv >= AT.jab.minSpeed) kind = 'jab'; }
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
  const RM = TUNING.me.staRegen[state.me.sta - 1] * TUNING.me.armour[state.me.set].regen * Math.pow(TUNING.cards.deepbreath, count('deepbreath'));
  if (state.m - state.lastAtk > S.delay && !sh.held && !state.away) state.stamina = Math.min(state.staMax, state.stamina + S.regen * RM * (raised() ? 1 : S.idleMul) * dt);
}

function checkExhaust(E, dt) {
  state.exhaust = Math.max(0, state.exhaust - dt);
  if (state.stamina <= 0 && state.exhaust <= 0 && bg() === 'baker' && !state.bakerWind) {
    state.bakerWind = true; state.stamina = state.staMax * TUNING.perks.baker;
    const Fy = youF(E); pop(Fy.x, Fy.y - 1.0 * Fy.H, 'SECOND WIND', '#7dd3fc', 20); E.haptic(15);
    return;
  }
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
  const Fy = youF(E); pop(Fy.x + 30, Fy.y - 1.1 * Fy.H, 'Back to the wall!', '#fca5a5', 24); E.haptic(18); E.shake(3, 0.1);
}
function stepYou(E, dt) {
  const T = TUNING.foot, ft = state.foot, dg = state.dg, k = gripMul(), wl = walls(E), hi = Math.max(wl.back, state.step.x - gMin(E));
  const holding = dg.down && dg.t > TUNING.dodge.dur;
  if (holding) ft.tgt -= T.walkBack * k * dt;
  // idle (no swing, dodge or lunge for drift.idle s): drift back toward your mark, a pace per drift.secs
  else if (ft.tgt < 0 && !dg.down && !state.away && !state.lunging && !state.hand.atk && state.m - state.lastAtk > T.drift.idle) {
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
  const T = TUNING.step, st = state.step, f = state.foe, limp = lamed('legs') ? TUNING.lame.legs : 1, tau = T.tau * statMul('spdStep', f.spd) * f.size.step / limp;
  st.dodgeT = Math.max(0, st.dodgeT - dt); st.dodgeCool = Math.max(0, st.dodgeCool - dt);
  const free = !state.sw && state.winded <= 0 && state.stun <= 0 && state.stagger <= 0 && state.fallT <= 0 && !state.intro && state.endT <= 0;
  if (free && state.you.lungeK > 0.5 && st.dodgeCool <= 0 && (lungeRead() || f.spd >= 5)) {
    st.dodgeT = T.dodgeDur; st.dodgeCool = T.dodgeCool;
    if (lungeRead()) { state.lungeReads++; readPop(E, 'READS YOUR LUNGE'); counter(E, 'thrust'); }
  }
  if (state.fallT > 0 || state.winded > 0 || state.stagger > 0) return;
  const c = T.circle, wave = (c[0] + c[1]) / 2 + (c[1] - c[0]) / 2 * Math.sin(state.m * 2 * Math.PI / T.period + state.rack);
  // a blow in flight keeps him at striking distance, whatever else he meant to do
  const want = state.sw ? f.strike : st.dodgeT > 0 ? f.home + T.dodge : state.retreat > 0 ? f.home + TUNING.retreat.dist
    : state.chase > 0 || state.open > 0 || (!state.intro && state.swingIn < T.lead) ? f.strike : f.home + wave;
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

// ====== FOE AI: his cover, memory, move building, exchanges and the swing clock ======
// ----- his cover: the guard he slides over the spot you just hit -----
function guardUp() { return !state.sw && state.open <= 0 && state.stun <= 0 && state.stagger <= 0 && state.fallT <= 0 && state.winded <= 0; }
// The foe's cover: after a blow lands he slides his guard (or shield) over that spot for a few seconds. It is down while he swings, is open, winded or stunned.
const hesitating = () => !!state.sw && !!state.sw.fake && state.sw.hesOn && !state.sw.switched && state.sw.fin <= 0;
const covering = () => !!state.cover && state.cover.t > 0 && guardUp();
const guarded = (p) => covering() && Math.hypot(p.cx - state.cover.x, p.cy - state.cover.y) <= state.cover.r;
const covered = (p) => p.armour || p.guard || (guarded(p) && !(p.slot && state.openAll > 0));
// a piece of his gear that acts for him (TUNING.foeGear)
const foeHas = (id) => !!state.foe.gear && state.foe.gear.includes(id);
// a limb of his lamed for the rest of the bout: armF (sword arm), armB (shield arm), legs
const LIMB = { armF: 'SWORD ARM', armB: 'SHIELD ARM', legs: 'LEGS' };
const lamed = (id) => !!state.foe.parts && state.foe.parts.some((p) => p.d.id === id && !p.slot && p.cut);
function setCover(p) {
  const c = state.cover, r = state.foe.shield ? TUNING.foe.coverShield : TUNING.foe.coverGuard;
  state.cover = { x: p.cx, y: p.cy, r, t: TUNING.cover.dur, max: TUNING.cover.dur, dx: c ? c.dx : 0.28, dy: c ? c.dy : -0.67 };
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
    const fake = avoid || pickZone(rng, null), real = pickZone(rng, avoid, fake), show = base * M.feint.show, hes = TUNING.lesson.hes + (bg() === 'scribe' ? TUNING.perks.scribe : 0);
    const after = Math.max(M.feint.min, M.feint.after * spd);
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
    const w = Object.entries(f.weapon.moves).filter(([k]) => k !== 'feint' || bout().feints).map(([k, v]) => [k, v * (k === 'feint' ? rh.feint * arenaT().feint * (turtle ? R.turtleFeint : 1) : 1) * (avoid && MOVE_ZONE[k] === avoid ? R.avoid : 1)]);
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
  const k = (1 + (lamed('armF') ? TUNING.lame.arm : 0)) * (has('vein') && state.bleed.length ? TUNING.cards.vein : 1);
  state.sw = {
    zone: ZONE[h.fake || h.zone], real: ZONE[h.zone], fake: h.fake ? ZONE[h.fake] : null, fakePose: h.fakePose, switchAt: (h.switchAt || 0) * k, switched: false,
    t: 0, wind: h.wind * k, dmg: h.dmg, pose: h.pose, kind: mv.kind, idx: mv.idx, n: mv.hits.length, counter: mv.counter, fin: 0, outcome: null, th0: f.th,
    hes: (h.hes || 0) * k, hesOn: false, realAt: 0, lesson: null, body0: bodyPos(), m0: state.m,
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
    if (sw.t >= sw.wind) resolveSwing(E);
    return;
  }
  if (state.stagger > 0) return;
  state.swingIn -= dt;
  // he commits only once you are inside his reach; until then his footwork closes in
  if (state.swingIn <= 0 && state.endT <= 0 && inReach()) {
    if (!state.plan) state.plan = planExchange(E);
    startMove(E, state.plan.q.shift(), false);
  }
}

// ----- the City's pairs: one foe fights, the other waits at the edge -----
// When the one fighting is winded, his partner taunts from the edge in the window's last half second and they swap as it closes; when he is felled, the
// partner taunts and takes over. The one who leaves keeps his health, cuts, lamings and bleed, and gets his breath back at the edge.
const TAUNT = { winded: 'Now, brother!', fell: 'For my brother!' };
function taunt(E, why) {
  state.tauntT = TUNING.pairs.taunt; state.taunt = TAUNT[why];
  E.audio.beep({ freq: 300, dur: 0.12, type: 'sawtooth', slide: 1.3, gain: 0.08 }); E.audio.beep({ freq: 420, dur: 0.14, type: 'sawtooth', slide: 0.8, gain: 0.07, delay: 0.12 });
}
function stepIn(E) {
  const out = state.foe, inn = state.edge, fellOut = state.fallT > 0;
  out.bleed = state.bleed; out.dents = state.dents; out.shrug = state.bout.foeShrug; out.down = fellOut; out.sta = out.staMax;
  state.foe = inn; state.edge = out;
  state.bleed = inn.bleed; state.dents = inn.dents; state.bout.foeShrug = inn.shrug;
  state.fallT = 0; state.sw = null; state.move = null; state.plan = null; state.stun = 0; state.stagger = 0; state.winded = 0; state.open = 0; state.retreat = 0; state.chase = 0;
  state.cover = null; state.disarm = 0; state.flyW = 0; state.kickA = 0; state.kickV = 0; state.pop = 1; state.swapping = false; state.tauntT = 0;
  state.step = { x: walls(E).fore, tgt: 0, t: 1, dodgeT: 0, dodgeCool: 0 };
  state.swingIn = Math.max(state.swingIn, TUNING.pairs.enter);
  inn.th = REST_TH;
  poseFoe(E, 0.016);
  if (fellOut && state.carry) { addBleed(E, state.carry); state.carry = 0; }
  const Ff = foeF(E); pop(Ff.x, Ff.y - 1.2 * Ff.H, `${inn.name.split(' ')[0].toUpperCase()} STEPS IN`, '#fca5a5', 22);
  dust(Ff.x, Ff.y, 10); E.shake(4, 0.15); swooshSound(E, 0.14);
}
// the swap clock, after his AI each frame (the fell's is in the play scene's fall clock)
function updatePair(E, dt) {
  state.tauntT = Math.max(0, state.tauntT - dt);
  const e = state.edge, P = TUNING.pairs;
  if (!e || e.down || state.fallT > 0) return;
  if (state.swapping && state.winded > P.taunt) state.swapping = false;
  if (!state.swapping && state.winded > 0 && state.winded <= P.taunt) { state.swapping = true; taunt(E, 'winded'); }
  if (state.swapping && state.winded <= 0) stepIn(E);
}
// the waiting foe at the edge: smaller, dimmer, standing at rest
function edgeF(E, f = state.edge) {
  const L = lay(E), P = TUNING.pairs, H = L.H * f.size.scale * P.scale;
  return { x: E.w - E.safe.right - P.x * H, y: L.floor, a: 0, dir: -1, H };
}
function poseEdge(f) {
  f.fr = { armF: { ox: SHOULDER[0], oy: SHOULDER[1], rot: REST_TH - Math.PI / 2 }, armB: { ox: PARTS[4].joint[0], oy: PARTS[4].joint[1], rot: 0.14 } };
  for (const p of f.parts) {
    const fr = f.fr[p.d.frame || p.d.id] || ZERO, c = Math.cos(fr.rot), sn = Math.sin(fr.rot);
    p.cx = fr.ox + p.d.x * c - p.d.y * sn; p.cy = fr.oy + p.d.x * sn + p.d.y * c;
  }
}

// A counter is a fresh one-move exchange: a quick thrust or chop, planned now with the fight RNG, its zone glowing like any tell.
function counter(E, kind) {
  if (!bout().counters || state.sw || state.fallT > 0 || state.stun > 0 || state.endT > 0 || state.stagger > 0 || state.winded > 0 || state.intro || !inReach()) return;
  const k = kind || (state.rng.chance(0.5) ? 'thrust' : 'chop');
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
  if (pid != null) { s.held = true; s.hid = pid; }
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
  pop(Fy.x, Fy.y - 1.0 * Fy.H, 'BACK', '#7de3ff', 24); swooshSound(E, 0.16); E.haptic(12);
  dust(Fy.x, Fy.y, 8);
}

// ====== HIT RESOLUTION: your blows on him, his blows on you ======
// One hit per swing: the first thing the blade meets decides it (tip first, earliest point of the sweep first; a slot wins over the part it sits on).
function checkHits(E) {
  const h = state.hand, T = TUNING, a = h.atk;
  if (!a || a.done || h.lock > 0 || state.fallT > 0 || state.endT > 0 || state.away) return;
  const need = a.kind === 'jab' ? T.attack.jab.minSpeed : a.kind === 'over' ? T.attack.over.minSpeed : T.hit.minSpeed;
  if (h.sp < need) return;
  const F = foeF(E), fm = state.foe, jab = a.kind === 'jab', pad = (jab ? T.blade.jabPad : T.blade.pad) / F.H;
  const order = fm.parts.filter((p) => p.slot).concat(fm.parts.filter((p) => !p.slot));
  if (a.kind === 'slash' && state.armed.whirl && whirlwind(E, F, fm, pad)) return;
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
  else stop = gapHit(E, p, at, ang, sp, a, p.slot && jab && (state.openAll > 0 || alongSlit(F, fm, p)));
  a.done = true;
  state.stop = Math.max(state.stop, stop);
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
  clangSound(E, 0); E.shake(glance ? 2 : 6, 0.12); E.haptic(glance ? 8 : 24);
  let stop = glance ? 0.01 : J.stopClang + 0.02;
  const breakAt = a.kind === 'over' && meWeapon().overBreak ? meWeapon().overBreak : A.dents;
  if (p.armour && (p.dents >= breakAt || (a.kind === 'over' && has('breaker')))) {
    p.armour = false; state.broken++;
    const [sx, sy] = partCenter(foeF(E), state.foe, p);
    plateBits(sx, sy, 9); ring(sx, sy, 70, '#ffe9a8'); pop(sx, sy - 24, 'PLATE BROKEN', '#ffe9a8', 17); emit(E, 'break', { p });
    E.audio.beep({ freq: 110, dur: 0.25, type: 'sine', slide: 0.4, gain: 0.3 }); E.shake(8, 0.2); E.haptic(30);
    stop = J.stopBreak + 0.04;
  } else pop(at.x, at.y - 18, p.guard ? GUARDS[p.d.id].toUpperCase() : glance ? 'GLANCE' : !p.armour ? 'GUARDED' : p.dents >= breakAt - 1 ? 'DENT!' : 'CLANG', p.guard ? '#ffd24a' : '#9aa4b2', glance ? 13 : 16);
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
  dmg *= T.me.str[state.me.str - 1];
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
  if (slip) dealt *= T.cards.slip;
  // Haemorrhage's price: a bare hit does nothing
  const numb = !slot && has('haem');
  if (numb) dealt = 0;
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
  pop(at.x, at.y - 20, exec ? 'EXECUTED!' : numb ? 'NO BITE' : slip ? `SLIP x${Math.round(dealt)}` : rip ? `RIPOSTE x${Math.round(dealt)}` : winded ? `PUNISH x${Math.round(dealt)}` : thrust ? `${p.d.label}!` : kind === 'jab' ? 'STAB' : kind === 'over' ? 'SMASH!' : dealt >= 2 ? 'HARD' : 'HIT', rip ? '#ffd24a' : thrust ? '#ff6a4a' : big ? '#ffb347' : '#fff0b8', Math.min(34, 15 + dealt * 4));
  state.kickV += T.foe.kick * (Math.cos(ang) > 0 ? -1 : 0.5) * (0.6 + Math.min(dealt, 4) * 0.4);
  E.shake(2 + Math.min(dealt, 5) * 2.5, 0.1); E.haptic(10 + Math.min(dealt, 5) * 8);
  if (big) E.flash('#fff0b8', 0.07);
  let stop = dealt >= 3 ? J.stop3 : dealt >= 2 ? J.stop2 : J.stop1;
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
    pop(at.x, at.y - 70, `LAMED: ${LIMB[p.d.id]}`, '#f87171', 20); E.flash('#7f1d1d', 0.08);
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
  state.grades.push(gradeBout());
  state.lastGold = boutGold(); state.gold += state.lastGold.sum; state.goldEarned += state.lastGold.sum;
  if (state.gauntlet[state.rack].rival) { state.rivalBeaten = 1; clearRival(E); pop(E.w * 0.62, E.h * 0.42, 'Rival defeated!', '#f87171', 30); }
  pop(E.w * 0.62, E.h * 0.3, 'FOE DOWN', '#ffd24a', 28); E.shake(10, 0.3); E.flash('#fff0b8', 0.1); E.audio.play('coin');
  if (boutTally().taken === 0) favour(E, TUNING.crowd.clean);
  emit(E, 'fell');
}
// the first of a pair falls: the bout goes on, his partner taunts from the edge and steps in (stepIn, from the play scene's fall clock)
function fellOne(E) {
  state.fallT = 0.01; state.sw = null; state.move = null; state.plan = null; state.winded = 0; state.swapping = false;
  pop(E.w * 0.62, E.h * 0.3, 'ONE DOWN', '#ffd24a', 26); E.shake(8, 0.25); E.flash('#fff0b8', 0.08);
  E.audio.beep({ freq: 220, dur: 0.2, type: 'triangle', slide: 0.6, gain: 0.2 });
  emit(E, 'fell');
}

function resolveSwing(E) {
  const sw = state.sw, L = lay(E), zy = zoneScreenY(L, sw.zone), Fy = youF(E), Ff = foeF(E), sh = state.sh, SH = TUNING.shield, M = TUNING.moves, W = state.foe.weapon;
  const net = sw.pose === 'net', bash = sw.pose === 'bash', feint = !!sw.fake;
  sw.fin = 0.4;
  state.streaks.push({ x1: Ff.x - Ff.H * 0.3, y1: zy - 30, x2: Fy.x - L.H * 0.1, y2: zy + 20, life: 0.22, max: 0.22, red: !state.away, net });
  if (sw.ghostX) {
    sw.outcome = 'whiff'; settleFeint('none');
    swooshSound(E, 0.2); pop(sw.ghostX, zy - 30, 'HE HIT YOUR GHOST', '#e879f9', 20); tellDodge(E, sw); return;
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
      parrySound(E); E.shake(10, 0.2); E.haptic(35); E.flash('#fff0b8', 0.1); E.audio.play('coin');
      state.stop = Math.max(state.stop, 0.12);
      pop(bx, by - 40, 'PERFECT BLOCK', '#ffd24a', 28); if (!read) pop(bx + 30, by - 70, 'RIPOSTE!', '#ffd24a', 18);
      state.kickV += -0.8; pushFoe(E);
      if (has('riposte')) counterJab(E);
      if (has('ironwall')) freeHit(E, 'IRON WALL', true);
      gainMom(E, TUNING.mom.perfect); emit(E, 'perfect', { bx, by });
    } else {
      sh.hits -= bash ? 1 : W.wear;
      const drain = (bash ? M.bash.drain * M.bash.blocked : W.drain) * steadyMul();
      if (drain) { state.stamina = Math.max(0, state.stamina - drain); state.lastAtk = state.m; pop(bx, by - 70, 'DRAINED', '#fca5a5', 14); }
      if (bash) { if (!noPush()) state.pushT = 0.2; pushFoe(E); }
      clangSound(E, 0); E.shake(bash || W.wear > 1 ? 9 : 6, 0.15); E.haptic(22); state.stop = Math.max(state.stop, 0.06);
      if (!read) pop(bx, by - 40, feint ? 'FEINT BLOCKED' : bash ? 'BASH BLOCKED' : W.wear > 1 ? 'SHIELD CRACKS' : 'BLOCK', '#ffffff', 24);
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
  if (net) {
    sw.outcome = 'net'; state.netT = M.net.dur; state.netted++;
    pop(Fy.x, zy - 40, 'NETTED', '#e2e8f0', 30); E.shake(6, 0.2); E.haptic(30); E.audio.noise({ dur: 0.25, gain: 0.2 });
    return;
  }
  if (bash) {
    sw.outcome = 'bash'; state.bashHits++;
    if (!noPush()) { state.pushT = 0.35; pushYou(E); }
    state.stamina = Math.max(0, state.stamina - M.bash.drain); state.lastAtk = state.m;
    pop(Fy.x, zy - 40, 'BASHED', '#fca5a5', 30); E.shake(12, 0.25); E.haptic(45); clangSound(E, 0); E.audio.play('boom', 0.5);
    state.hand.lock = Math.max(state.hand.lock, 0.3); state.hand.hvx = -260; state.hand.hvy = 60; state.hand.atk = null;
    return;
  }
  // Unbreakable: the first blow each bout that would hurt you is shrugged off
  if (has('unbreak') && !state.bout.shrugged) {
    state.bout.shrugged = true; state.shrugs++; sw.outcome = 'shrug';
    sparks(Fy.x + 0.2 * L.H, zy, Math.PI, 20); clangSound(E, 0); E.shake(6, 0.2); E.haptic(30);
    pop(Fy.x, zy - 40, 'UNBREAKABLE', '#e879f9', 28); return;
  }
  // a blow on one of your plates costs half as much (a quarter heart for a light blow)
  // disarmed, he hits with his fists; Juggernaut: lunging through it, it costs half and you keep coming
  const part = state.you.parts.find((q) => q.d.id === ZONE_PART[sw.zone.id]), plated = !!(part && part.armour), jugg = has('jugg') && state.you.lungeK > 0.5;
  const dmg = (state.disarm > 0 ? Math.min(sw.dmg, TUNING.cards.fist) : sw.dmg) * (plated ? TUNING.me.plateMul : 1) * (jugg ? TUNING.cards.jugg : 1);
  sw.outcome = 'hit'; state.hp -= dmg; state.taken++; state.hurt = plated ? 0.25 : 0.4; if (sw.counter) state.counterHits++;
  // his Bloodlust (the wolf pelt): a blow that lands gives him stamina
  if (foeHas('bloodlust')) { const f = state.foe; f.sta = Math.min(f.staMax, f.sta + TUNING.foeGear.bloodlust); pop(Ff.x, Ff.y - 1.2 * Ff.H, 'HE DRINKS', '#f87171', 15); }
  if (plated) { state.plateSaves++; part.clang = 0.25; const [px, py] = partCenter(Fy, state.you, part); sparks(px, py, Math.PI, 16); clangSound(E, 0); }
  E.flash('#ff2a2a', plated ? 0.15 : 0.3); E.shake(12 + 4 * sw.dmg, 0.35); E.haptic(50 + 20 * sw.dmg);
  E.audio.play('boom'); E.audio.play('lose', 0.5);
  pop(Fy.x, zy - 40, jugg ? 'JUGGERNAUT' : feint ? 'FEINTED!' : plated ? 'PLATE TOOK IT' : sw.dmg >= 2 ? `OUCH x${sw.dmg}` : 'OUCH', jugg || plated ? '#cbd5e1' : '#ff5a4a', 30 + 4 * sw.dmg);
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
  E.audio.beep({ freq: 660, dur: 0.12, type: 'triangle', gain: 0.12 }); E.audio.beep({ freq: 990, dur: 0.16, type: 'sine', gain: 0.1, delay: 0.08 });
  if (state.caption && state.sw && state.sw.lesson) state.caption = { lines: ['Feint read! He spent his stamina on the fake.'], t: 2.2, max: 2.2, good: true };
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
// over (an overhead that connects), break (a plate broken), lame, tick (a bleed tick), fell. Each hook is (E, ctx) => void; the rule lives in its card.
const C_ = () => TUNING.cards;
const HOOKS = {
  shove: { perfect: (E) => { for (let i = 0; i < C_().shove; i++) pushFoe(E); if (state.step.x >= walls(E).fore - 0.005) stunFoe(E, C_().shoveStun, 'STUNNED AT THE WALL'); } },
  braced: { block: (E, c) => { if (!c.perfect) gainMom(E, 1); } },
  thorns: { block: (E, c) => {
    if (state.disarm > 0) return;
    state.dents++; const Ff = foeF(E);
    if (state.dents >= C_().thorns) { state.dents = 0; disarmFoe(E, C_().thornsDur); } else pop(Ff.x, Ff.y - 1.15 * Ff.H, `WEAPON DENTED ${state.dents}/${C_().thorns}`, '#cbd5e1', 15);
  } },
  serrated: { slot: (E) => addBleed(E, C_().serrated) },
  rend: { hit: (E, c) => { if (c.kind === 'slash') addBleed(E, C_().rend); } },
  bloodlust: { tick: (E, c) => { state.stamina = Math.min(state.staMax, state.stamina + C_().bloodlust * c.n); } },
  haem: { fell: () => { state.carry = state.bleed.length; } },
  sidestep: { dodge: (E) => { const Ff = foeF(E); pop(Ff.x, Ff.y - 1.3 * Ff.H, 'OVERCOMMITTED', '#86efac', 18); windFoe(E, C_().sidestep); } },
  lightfeet: { dodge: (E) => { state.stamina = Math.min(state.staMax, state.stamina + TUNING.dodge.cost); } },
  matador: { dodge: (E, c) => { if (c.sw.pose === 'thrust' || c.sw.pose === 'bash') stunFoe(E, C_().matador, 'STUMBLES!'); } },
  untouch: { dodge: (E) => { state.openAll = C_().untouch; } },
  brawler: { break: (E) => gainMom(E, C_().brawler) },
  cape: { perfect: (E) => capeStep(E), dodge: (E) => capeStep(E) },
  butcher: { break: (E) => addBleed(E, C_().butcher) },
  spiked: { perfect: (E) => addBleed(E, C_().spiked) },
  hamstring: { hit: (E) => hamstring(E), slot: (E) => hamstring(E) },
};
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
  state.disarm = dur; state.flyW = 0.9;
  const Ff = foeF(E); pop(Ff.x, Ff.y - 1.3 * Ff.H, 'DISARMED!', '#e879f9', 26); E.shake(6, 0.2); E.haptic(30); clangSound(E, 0);
}
// the perfect-block window, doubled by Iron Wall
const perfectWin = () => TUNING.shield.perfect * (has('ironwall') ? 2 : 1);
const atWall = (E) => state.foot.pos <= walls(E).back + 0.01;

// ----- finishers: a long press on the sword thumb spends Momentum on the costliest one you hold and can use now -----
const FIN_OK = {
  exec: () => !state.armed.exec && state.foe.hp < state.foe.maxHp * TUNING.fin.below,
  whirl: () => !state.armed.whirl,
  breath: () => state.stamina < state.staMax || state.exhaust > 0,
  disarm: () => state.disarm <= 0,
};
function finReady() {
  return DECK.filter((c) => c.fam === 'fin' && has(c.id) && TUNING.fin[c.id] <= state.mom && FIN_OK[c.id]()).sort((a, b) => TUNING.fin[b.id] - TUNING.fin[a.id])[0] || null;
}
function fireFinisher(E, c) {
  const Fy = youF(E);
  state.mom -= TUNING.fin[c.id]; state.momSpent += TUNING.fin[c.id]; state.fins.push(c.id);
  if (c.id === 'exec' || c.id === 'whirl') state.armed[c.id] = true;
  else if (c.id === 'breath') { state.stamina = state.staMax; state.exhaust = 0; }
  else if (c.id === 'disarm') disarmFoe(E, TUNING.fin.disarmDur);
  pop(Fy.x + 0.4 * Fy.H, Fy.y - 1.15 * Fy.H, c.name.toUpperCase() + (state.armed[c.id] ? ' ARMED' : '!'), '#e879f9', 24);
  favour(E, TUNING.crowd.fin);
  E.flash('#e879f9', 0.1); E.haptic(30);
  E.audio.beep({ freq: 330, dur: 0.18, type: 'sawtooth', slide: 2, gain: 0.1 }); E.audio.beep({ freq: 990, dur: 0.2, type: 'sine', gain: 0.08, delay: 0.1 });
}
// the sword thumb held still: once it has rested hold s, the press fires (once per press)
function updateFinisher(E) {
  const h = state.hand;
  if (!h.down || h.moved || h.finDone || state.fallT > 0 || state.endT > 0 || state.m - h.pressT < TUNING.mom.hold || state.m - h.swingT < TUNING.mom.still) return;
  h.finDone = true;
  const c = finReady();
  if (c) fireFinisher(E, c);
}
function emit(E, ev, ctx = {}) {
  crowdEvent(E, ev);
  for (const id of new Set(state.picks)) { const h = HOOKS[id] && HOOKS[id][ev]; if (h) h(E, ctx); }
}

// ----- the crowd: favour for style (TUNING.crowd), carried through the run; coins arc in the first time it passes each step (favStep is the run's high-water) -----
function favour(E, n) {
  const C = TUNING.crowd;
  state.fav = clamp(state.fav + n, 0, C.max);
  if (n > 0) state.favT = 0.5;
  const step = Math.floor(state.fav / C.step);
  if (step > state.favStep) { coins(E, C.coins * (step - state.favStep)); state.favStep = step; }
}
// the events that please them: a feint read, a perfect block, a slot hit, a laming, and two of your hits close together
function crowdEvent(E, ev) {
  const C = TUNING.crowd;
  if (ev === 'read' || ev === 'perfect' || ev === 'slot' || ev === 'lame') favour(E, C[ev]);
  if (ev === 'slot' || ev === 'hit') { if (state.m - state.lastHitM <= C.comboWin) favour(E, C.combo); state.lastHitM = state.m; }
}
// what bores them, each frame of play: turtling (the measure his turtle read uses) and backing off with no blow of his coming
function crowdDrain(E, dt) {
  const C = TUNING.crowd, sw = state.sw;
  if (state.fallT > 0 || state.endT > 0 || state.winded > 0) return;
  if (state.mem.turtle >= TUNING.read.turtle) favour(E, -C.turtle * dt);
  if (state.dg.down && state.dg.t > TUNING.dodge.dur && !(sw && sw.fin <= 0)) favour(E, -C.back * dt);
}
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
  return { slot: state.slotHits - b.slot, read: state.feintsRead - b.read, pun: state.punishes - b.pun, taken: state.taken - b.taken };
}
function gradeBout() {
  const G = TUNING.grade, t = boutTally(), skill = t.slot + t.read + t.pun;
  if (t.taken <= G.S.taken && t.read + t.pun >= G.S.skill) return 'S';
  if (t.taken <= G.A.taken && skill >= G.A.skill) return 'A';
  if (t.taken <= G.B.taken && skill >= G.B.skill) return 'B';
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
// that takes away what your keystone lives on, and a set bonus only while you wear a piece of both its families.
function dealable() {
  const held = heldFams(), lost = (k) => (k === 'dodge' ? noDodge() : noShield());
  return DECK.filter((c) => !has(c.id) && !(c.needs && lost(c.needs)) && !(c.bans && DECK.some((k) => k.key && has(k.id) && k.needs === c.bans))
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
function dealDraft(grade, salt = 0, not = []) {
  const D = TUNING.draft, rng = makeRng((state.seed ^ 0x7f4a7c15) + state.rack * 104729 + salt * 15485863), all = dealable(), held = heldFams(), out = [];
  const fresh = all.filter((c) => !not.includes(c)), pool = fresh.length >= D.deal ? fresh : all;
  const room = (c) => famsOf(c).every((f) => out.filter((o) => famsOf(o).includes(f)).length < D.perFam);
  for (let i = 0; i < D.deal - 1; i++) {
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
// the bout's gold: a fell, plus style
function boutGold() {
  const G = TUNING.gold, t = boutTally(), per = state.perfects - state.bout.perf;
  const items = [['fell', G.fell], ['reads', t.read * G.read], ['perfects', per * G.perfect], ['slot hits', t.slot * G.slot], ['no hits', t.taken === 0 ? G.clean : 0]].filter((e) => e[1] > 0);
  return { sum: items.reduce((a, e) => a + e[1], 0), items };
}
function openDraft(E) {
  const grade = state.grades[state.grades.length - 1] || 'C', deal = dealDraft(grade);
  state.draft = { grade, tally: boutTally(), gold: state.lastGold, cards: deal.cards, priced: deal.priced, odds: deal.odds, t: 0, btns: [], reroll: null, help: null, helpOn: false };
  state.epicsSeen += deal.cards.filter((c) => c.tier >= 2).length;
  saveRun(E);
  const h = state.hand; h.down = false; h.id = -1; h.atk = null; state.sh.held = false; state.sh.hid = -1; state.dg.down = false;
  E.audio.play('coin');
}
// a card joins your picks, and a piece takes its slot: whatever was worn there is gone. Titan's hearts come and go with it.
function applyCard(c, on = true) {
  if (on && c.slot) for (const id of state.picks.filter((q) => CARD[q].slot === c.slot)) applyCard(CARD[id], false);
  if (on) state.picks.push(c.id); else state.picks.splice(state.picks.indexOf(c.id), 1);
  if (c.id === 'titan') { const k = on ? 1 : -1; state.maxHp += k * TUNING.cards.titan; state.hp = clamp(state.hp + k * TUNING.cards.titan, 1, state.maxHp); }
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
  else if (w.id === 'heart' || w.id === 'hide') { const n = w.id === 'heart' ? TUNING.tent.heart : TUNING.cards.hide; state.maxHp += n; state.hp += n; }
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
  E.audio.play('tap'); E.haptic(15);
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
function ring(x, y, r, color) { state.fx.push({ k: 'r', x, y, r0: 10, r, life: 0.3, max: 0.3, c: color }); }
function pop(x, y, s, color, size) { state.pops.push({ x, y, s, color, size, life: 0.8, max: 0.8 }); }
function plateBits(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, s = 200 + Math.random() * 360;
    state.fx.push({ k: 'p', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 900, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 20, w: 10 + Math.random() * 12, h: 6 + Math.random() * 8, life: 0.9 + Math.random() * 0.4, max: 1.3 });
  }
}

// ----- sounds -----
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
const BLACK = { hi: '#a4a4ac', lite: '#62626a', mid: '#3a3a40', dark: '#1d1d22', edge: '#08080a' };
const GOLD = { hi: '#fff4c2', lite: '#f0cf6a', mid: '#c9a43a', dark: '#7a5a14', edge: '#3a2a06' };
// The family looks, so a build reads at a glance: the Wall bronze, Blood dark red with iron barbs and hooks, the Dancer light cloth and mint ribbons,
// the Brute black iron and spikes; the lone piece (the lion pelt) gold.
const FAM_LOOK = {
  wall: { metal: BRONZE, cloth: '#8a5a24', hi: '#e6c866' },
  blood: { metal: IRON, cloth: '#6e1414', hi: '#b91c1c' },
  dancer: { metal: BRONZE, cloth: '#efe6cf', hi: '#6ee7b7' },
  brute: { metal: BLACK, cloth: '#2a2420', hi: '#77746d' },
  rare: { metal: GOLD, cloth: '#b8862e', hi: '#f2d88a' },
};
// War paint, one pattern per finisher: its colour
const PAINT_COL = { exec: '#dc2626', whirl: '#3b82f6', breath: '#f8fafc', disarm: '#d97706' };
// A look's gear: the pieces by slot, the war paint held, and a signature for the sprite cache. Titan's black plate turns every plate black iron.
function withGear(lk, ids, id) {
  const gear = gearOf(ids), paint = ids.filter((q) => PAINT_COL[q]);
  return { ...lk, gear, paint, metal: gear.chest && gear.chest.id === 'titan' ? BLACK : lk.metal, id: `${id}|${Object.values(gear).map((c) => c.id).join('.')}|${paint.join('.')}` };
}
// Your look: the gladiator type of your rolled weapon, in your own colours (teal tunic) and the metal of your armour set, with the gear you wear.
function myLook(me, ids = []) {
  const G = GTYPE[me.weapon], A = MYLOOK[me.set];
  return withGear({ ...G, metal: A.metal, trim: A.trim, skin: YOU.skin, hair: '#3a2414', tunic: YOU.tunic, hem: YOU.hem,
    crest: A.crest || G.crest || YOU.crest, band: G.band ? YOU.crest : YOU.tunic, beard: G.beard && !me.female }, ids, `you-${me.set}-${me.weapon}${me.female ? 'f' : ''}`);
}
// his look: his type's, with his gear (rolled once per bout)
const foeLook = (d) => withGear(GTYPE[d.weapon.id], d.gear || [], GTYPE[d.weapon.id].id);
// yours is rebuilt only when your picks change
function lookOf(fm, isFoe) {
  if (isFoe) return fm.look || GTYPE[fm.weapon.id];
  const sig = state.picks.join(',');
  if (state.you.lookSig !== sig) { state.you.look = myLook(state.me, state.picks); state.you.lookSig = sig; }
  return state.you.look;
}
// What shows through each gap, and which sides the plate edges frame it from (top and bottom, or left and right).
const SLOT_ART = { 'slot-neck': ['skin', 'tb'], 'slot-armpit': ['linen', 'lr'], 'slot-waist': ['linen', 'tb'], 'slot-elbow': ['skin', 'tb'], 'slot-knee': ['skin', 'tb'] };
// Sprite bounds in body units (arms in their own frame): room for crests, straps, the fist and the shoulder guards.
const BOX = { head: [-0.17, -1.05, 0.18, -0.66], chest: [-0.15, -0.74, 0.16, -0.5], belly: [-0.19, -0.54, 0.19, -0.24], armF: [-0.14, -0.2, 0.12, 0.42], armB: [-0.14, -0.2, 0.12, 0.42], legs: [-0.21, -0.43, 0.25, 0.04], cloak: [-0.34, -0.86, 0.14, 0.01] };
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
    c.restore();
  });
  if (!g) return;
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
  }
}
// The chest slot: a harness, a drape or Titan's black collar and shoulder caps; never a plate on a bare chest.
function paintChestGear(c, p, H, lk) {
  const g = lk.gear.chest; if (!g) return;
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
  }
}
// The belt slot hangs below your belt, on the tunic, so the waist gap stays as it is.
function paintBeltGear(c, p, H, lk) {
  const g = lk.gear.belt; if (!g) return;
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
  }
}
// The arms slot: a bracer near the wrist, or iron pauldrons on the shoulder (in the arm's own frame, the fist at ARM_LEN)
function paintArmGear(c, p, H, lk) {
  const g = lk.gear.arms; if (!g) return;
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
  }
}
// The legs slot: boots, sandal ribbons or spiked boots on both shins
function paintLegGear(c, p, H, lk) {
  const g = lk.gear.legs; if (!g) return;
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
    }
  });
}
// The cloak slot: drawn behind the whole body as its own sprite
const CLOAK = { id: 'cloak', shape: 'rect', x: -0.1, y: -0.45, w: 0.2, h: 0.5 };
function paintCloak(c, p, H, lk) {
  const g = lk.gear.cloak; if (!g) return;
  const L = FAM_LOOK[g.fam], P = (x, y) => [x * H, y * H];
  const shape = (pts, fill, edge) => { c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath(); c.fillStyle = fill; c.fill(); c.strokeStyle = edge; c.lineWidth = lw(H, 0.005); c.lineJoin = 'round'; c.stroke(); };
  if (g.id === 'untouch') {
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
  }
}
// A gap guard: a polished steel piece with a gold rim over the gap, so it reads shut: the gorget, the manica, the wide belt, the couters, the knee guards.
function paintGuard(c, p, H, lk) {
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

// The joint slots riding on their limbs: all the sprites first, then the live light over them (the open window's gold, or a glint when your tip is near).
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
  if ((state.winded > 0 || state.openAll > 0) && fm === state.foe && p.flash <= 0) {
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
// The right HUD's rows below the hearts (px from the top): Momentum pips, stamina, your cards, the shield (with and without cards)
const HUD_ROW = { pips: 35, sta: 46, icons: 70, shield: 88, shield0: 66 };
// Momentum: five pips under your hearts, gold when held, the next pip's gain flashing
function drawPips(ctx, E, bx, bw, y) {
  const M = TUNING.mom, n = M.max, s = 5, gap = (bw - 2 * s) / (n - 1);
  for (let i = 0; i < n; i++) {
    const x = bx + s + i * gap, on = i < state.mom, fresh = on && i === state.mom - 1 && state.momT > 0;
    ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath();
    ctx.fillStyle = on ? (fresh ? '#ffffff' : '#ffd24a') : 'rgba(0,0,0,0.45)'; ctx.fill();
    ctx.strokeStyle = on ? '#fff0b8' : 'rgba(255,210,74,0.45)'; ctx.lineWidth = 1.2; ctx.stroke();
  }
  const armed = ['exec', 'whirl'].find((id) => state.armed[id]), fc = finReady();
  const t = armed ? `${CARD[armed].name.toUpperCase()} ARMED` : fc ? `hold: ${fc.name}` : 'momentum';
  E.text(t, bx - 6, y, { size: 10, align: 'right', color: armed || fc ? '#f5d0fe' : '#c4b99a', weight: armed || fc ? '800' : '400' });
}
// The HUD's middle: between BOUT on the left and your hearts, stamina and shield on the right, so his bar never meets their labels.
function hudSlot(E) {
  const top = 10 + E.safe.top, l = 16 + E.safe.left, r = 16 + E.safe.right, nh = Math.ceil(state.maxHp / 2);
  const x0 = l + 112, x1 = Math.min(E.w - r - 110 - 96, E.w - r - 23 - (nh - 1) * 26) - 10;
  return { top, x0, x1, cx: (x0 + x1) / 2, w: x1 - x0 };
}
// His name, health and stamina bars in the HUD slot, and under them his flag: OPEN! while winded, your riposte, or his short opening after a move.
// Drawn over the fighters, so the sword never hides it.
function foeHealth(ctx, E) {
  const L = lay(E), f = state.foe, S = hudSlot(E), w = Math.min(0.46 * L.H, S.w - 10), h = 10, x = S.cx - w / 2, y = S.top + 14;
  const k = clamp(f.hp / f.maxHp, 0, 1), ks = clamp(f.shown / f.maxHp, 0, 1), sk = clamp(f.sta / f.staMax, 0, 1);
  const nm = `${f.name.toUpperCase()}  ${f.size.id} · ${f.wname}`;
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
  const t = wd ? 'OPEN!  winded: stab the glowing slots' : state.openAll > 0 ? 'ALL SLOTS OPEN' : state.disarm > 0 ? 'DISARMED: fists only' : state.riposte > 0 ? 'RIPOSTE x2' : state.open > 0 && !state.sw ? 'OPEN' : null;
  if (!t) return;
  const size = fitSize(ctx, t, 15, S.w - 16), tw = ctx.measureText(t).width * size / 15, fy = y + h + 22, pulse = 0.5 + 0.5 * Math.sin(state.m * 10);
  E.roundRect(S.cx - tw / 2 - 8, fy - 11, tw + 16, 22, 8, 'rgba(20,14,8,0.85)', wd ? `rgba(255,210,74,${0.5 + 0.5 * pulse})` : null);
  E.text(t, S.cx, fy, { size, weight: '800', color: '#ffd24a' });
}

// The crowd meter beside BOUT: three little heads, then the bar marked in thirds (the Emperor's thumb reads them), gold at the top third, flashing as it fills
function drawCrowdMeter(ctx, E, x, y) {
  const C = TUNING.crowd, k = clamp(state.favShown / C.max, 0, 1), band = bandOf(state.favShown), bx = x + 22, bw = 74, bh = 9;
  ctx.fillStyle = '#c4b99a';
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + 3 + i * 7, y + (i === 1 ? -1 : 1), 3, 0, 6.28); ctx.fill(); }
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx - 1, y - bh / 2 - 1, bw + 2, bh + 2);
  ctx.fillStyle = band === 2 ? '#ffd24a' : band === 1 ? '#f59e0b' : '#b45309'; ctx.fillRect(bx, y - bh / 2, bw * k, bh);
  if (state.favT > 0) { ctx.fillStyle = `rgba(255,255,255,${state.favT})`; ctx.fillRect(bx, y - bh / 2, bw * k, bh); }
  ctx.fillStyle = 'rgba(240,230,204,0.7)';
  for (const t of C.bands) ctx.fillRect(bx + bw * t - 1, y - bh / 2 - 2, 2, bh + 4);
}
function drawCoin(ctx, x, y, r) {
  ctx.fillStyle = '#fbbf24'; ctx.strokeStyle = '#8a5a12'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 6.28); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, 6.28); ctx.fill();
}
// The waiting foe stands still, so he is painted once into his own sprite (again when his size on screen or his wounds change) and drawn dimmed each
// frame; without OffscreenCanvas he is drawn live.
// The waiting foe's sprite for the foe f, repainted when his size on screen or his wounds change (a number, so the check allocates nothing).
function edgeSprite(E, f) {
  const F = edgeF(E, f), k = Math.min(E.dpr || 1, TUNING.skin.maxDpr), w = 0.9 * F.H, h = 1.25 * F.H, feet = 1.12 * F.H;
  let key = Math.round(F.H * k);
  for (const p of f.parts) key = (key * 31 + (p.cut ? 1 : 0) + 2 * p.dents + 64 * p.cracks.length) % 2147483647;
  if (!f.spr || f.spr.key !== key) {
    const cv = new OffscreenCanvas(Math.ceil(w * k), Math.ceil(h * k)), c = cv.getContext('2d');
    // painting poses him as he waits, so the one fighting keeps his own pose and frames
    const fr = f.fr, pc = f.parts.map((p) => [p.cx, p.cy]);
    poseEdge(f); c.scale(k, k); c.translate(w / 2 - F.x, feet - F.y);
    drawFighter(c, E, { ...F, a: 0 }, f, 'edge');
    f.fr = fr; f.parts.forEach((p, i) => { p.cx = pc[i][0]; p.cy = pc[i][1]; });
    f.spr = { key, cv };
  }
  return f.spr.cv;
}
// The waiting foe stands still, so he is painted once into his own sprite and drawn dimmed each frame; without OffscreenCanvas he is drawn live.
function drawEdge(ctx, E) {
  const f = state.edge, F = edgeF(E), A = TUNING.pairs.alpha;
  if (!canSprite) { poseEdge(f); drawFighter(ctx, E, F, f, 'edge', A); return; }
  const k = Math.min(E.dpr || 1, TUNING.skin.maxDpr), w = 0.9 * F.H, feet = 1.12 * F.H, img = edgeSprite(E, f);
  // drawn upright at whole device pixels and the sprite's own size, the cheapest copy there is
  const X = Math.round((F.x - w / 2) * k) / k, Y = Math.round((F.y - feet) * k) / k;
  ctx.save(); ctx.globalAlpha = A; ctx.drawImage(img, X, Y, img.width / k, img.height / k); ctx.restore();
}
// During the intro card both foes' sprites are painted for the swap: the one fighting as he will wait, the one waiting as he will fight.
function warmPair(E) {
  const e = state.edge;
  if (!canSprite || !e || state.warm) return;
  state.warm = true;
  edgeSprite(E, state.foe); edgeSprite(E, e);
  const H = lay(E).H * e.size.scale, lk = lookOf(e, true);
  for (const p of e.parts) spriteOf(E, p, H, lk);
}
// The waiting foe's name and health over his head, and his taunt, the tell that he is about to step in: a bubble above them
function drawEdgeTag(ctx, E) {
  const f = state.edge, F = edgeF(E), [hx, hy] = toScreen(F, 0.03, -1.0), r = E.w - 10 - E.safe.right, bw = Math.min(90, 0.5 * F.H), bx = Math.min(hx - bw / 2, r - bw);
  // clear of the right HUD's rows (hearts to the shield bar)
  const hud = 10 + E.safe.top + (state.picks.length ? HUD_ROW.shield : HUD_ROW.shield0) + 8, ny = Math.max(hy - 18, hud + 12), nm = f.name.split(/[ ,]/)[0].toUpperCase();
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
// his shield, with his shield piece: Thorns' spikes round the rim, or Iron Wall's tower shield (a scutum, far bigger)
function drawFoeShield(ctx, H, k, lk) {
  const g = lk.gear && lk.gear.shield, tower = g && g.id === 'ironwall', parma = lk.helm === 'hoplo' && !tower;
  ctx.save();
  if (tower) ctx.scale(1.25, 1.45);
  if (g && g.id === 'thorns') {
    const n = 10, w = 0.17 * H * k, h = 0.32 * H * k, r = 0.1 * H * k;
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n, ex = parma ? Math.cos(a) * r : clamp(Math.cos(a) * w, -w / 2, w / 2), ey = parma ? Math.sin(a) * r : clamp(Math.sin(a) * h, -h / 2, h / 2);
      spike(ctx, ex * 0.95, ey * 0.95, a, 0.035 * H * k, 0.02 * H * k, BRONZE, true);
    }
  }
  (parma ? drawParma : drawScutum)(ctx, H, k);
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
  const g = f.look && f.look.gear.weapon;
  if (!g) return;
  if (W.id === 'spear') weaponGear(ctx, g, [0, y0 + len], [0, y0 + len + 0.12 * H], 0.026 * H, [0, y0 - 0.3 * H], H);
  else if (W.id === 'axe') weaponGear(ctx, g, [0, y0 + len - 0.16 * H], [0, y0 + len], 0.016 * H, [0, y0 - 0.06 * H], H);
  else weaponGear(ctx, g, [0, y0 + 0.04 * H], [0, y0 + 0.04 * H + len], W.id === 'dagger' ? 0.018 * H : 0.026 * H, [0, y0 - 0.055 * H], H);
}
// A weapon piece along the weapon's working part, from a to b (px), hw its half-width there, butt the end of the grip: the saw teeth, the sica's hook
// (and its red grip), the spiked iron pommel.
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
  else if (id === 'armB') { ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(4, -4); ctx.lineTo(3.5, 1); ctx.lineTo(0, 5); ctx.lineTo(-3.5, 1); ctx.closePath(); ctx.fill(); }
  else { line(ctx, -1, -5, -2, 4); line(ctx, -2, 4, 2, 4); line(ctx, 2, -5, 2, 1); }
  ctx.restore();
}
// who: 'you', 'foe' (the one fighting, with every live state drawn on him) or 'edge' (a pair's foe waiting: his look and kit only)
function drawFighter(ctx, E, F, fm, who, ga = 1) {
  const H = F.H, L = lay(E), isFoe = who !== 'you', live = who === 'foe', lk = lookOf(fm, isFoe);
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
  if (lk.gear && lk.gear.cloak) { if (!fm.cloak) fm.cloak = mkPart(CLOAK, false); drawPart(ctx, E, fm.cloak, H, lk, null); }
  drawPart(ctx, E, P('armB'), H, lk, fm.fr.armB);
  if (isFoe && fm.shield && !bashing) offHand(ctx, fm.fr.armB, H, () => drawFoeShield(ctx, H, 0.75, lk));
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
    drawSlots(ctx, E, F, H, fm, lk, live);
    if (fm.shield && bashing) { ctx.save(); ctx.translate((0.2 + 0.1 * (sw.fin > 0 ? 1 : clamp(sw.t / sw.wind, 0, 1))) * H, -0.52 * H); drawFoeShield(ctx, H, 1, lk); ctx.restore(); }
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

// Your sword arm's arms piece near the wrist (a bracer, barbs or ribbons) and its war paint on the upper arm, drawn with the arm each frame
function liveArmGear(ctx, h, H, lk) {
  const S = [h.sx, h.sy], El = [h.ex, h.ey], Hd = [h.hx, h.hy], g = lk.gear.arms;
  const across = (a, b, t, half, col, wd) => { const q = lerp2(a, b, t), dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * half, ny = dx / l * half; ctx.strokeStyle = col; ctx.lineWidth = wd; line(ctx, q[0] + nx, q[1] + ny, q[0] - nx, q[1] - ny); };
  ctx.lineCap = 'butt';
  if (g && g.id !== 'jugg') {
    const L = FAM_LOOK[g.fam], a = lerp2(El, Hd, 0.55), b = lerp2(El, Hd, 0.85);
    if (g.id === 'matador') for (const t of [0.55, 0.68, 0.81]) across(El, Hd, t, 0.045 * H, L.hi, 0.02 * H);
    else {
      ctx.lineCap = 'round'; ctx.strokeStyle = '#1b1610'; ctx.lineWidth = 0.09 * H + 2; line(ctx, a[0], a[1], b[0], b[1]);
      ctx.strokeStyle = g.id === 'riposte' ? L.metal.mid : L.cloth; ctx.lineWidth = 0.09 * H; line(ctx, a[0], a[1], b[0], b[1]);
      ctx.strokeStyle = g.id === 'riposte' ? L.metal.hi : 'rgba(255,190,170,0.4)'; ctx.lineWidth = 0.015 * H; line(ctx, a[0], a[1] - 0.025 * H, b[0], b[1] - 0.025 * H);
      if (g.id === 'rend') for (const t of [0.3, 0.7]) { const q = lerp2(a, b, t), an = Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2; spike(ctx, q[0] + Math.cos(an) * 0.04 * H, q[1] + Math.sin(an) * 0.04 * H, an, 0.03 * H, 0.012 * H, IRON, true); }
    }
    gearGlint(ctx, b[0], b[1] - 0.03 * H, 0.03 * H, g, 0.8);
  }
  (lk.paint || []).forEach((id, i) => {
    const col = PAINT_COL[id], t0 = 0.3 + i * 0.12;
    if (id === 'exec') { across(S, El, t0, 0.032 * H, col, 0.012 * H); across(S, El, t0 + 0.07, 0.032 * H, col, 0.012 * H); }
    else if (id === 'whirl') { const q = lerp2(S, El, t0 + 0.05); ctx.strokeStyle = col; ctx.lineWidth = 0.008 * H; ctx.beginPath(); ctx.arc(q[0], q[1], 0.02 * H, 0, TAU * 0.85); ctx.stroke(); }
    else if (id === 'breath') { ctx.fillStyle = col; for (let k = 0; k < 3; k++) { const q = lerp2(S, El, t0 + k * 0.06); ctx.beginPath(); ctx.arc(q[0], q[1], 0.008 * H, 0, TAU); ctx.fill(); } }
    else if (id === 'disarm') { const dx = El[0] - S[0], dy = El[1] - S[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l; ctx.strokeStyle = col; ctx.lineWidth = 0.008 * H; ctx.beginPath(); for (let k = 0; k < 5; k++) { const q = lerp2(S, El, t0 + k * 0.04), o = (k % 2 ? 1 : -1) * 0.022 * H; ctx.lineTo(q[0] + nx * o, q[1] + ny * o); } ctx.stroke(); }
  });
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
  const lk = lookOf(state.you, false), G = lk.gear;
  limb(ctx, [[h.sx, h.sy], [h.ex, h.ey], [h.hx, h.hy]], 0.075 * H, YOU.skin);
  liveArmGear(ctx, h, H, lk);
  ctx.fillStyle = YOU.tunic; ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(h.sx, h.sy, 0.058 * H, 0, 6.28); ctx.fill(); ctx.stroke();
  if ((G.arms && G.arms.id === 'jugg') || (G.chest && G.chest.id === 'titan')) {
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
  if (G.weapon) {
    const tip = [h.ux, h.uy], back = (k) => [h.ux - bx * k * H, h.uy - by * k * H];
    if (wid === 'spear') weaponGear(ctx, G.weapon, back(0.13), tip, w * 1.1, [h.hx - bx * 0.12 * H, h.hy - by * 0.12 * H], H);
    else if (wid === 'axe') weaponGear(ctx, G.weapon, back(0.2), tip, 0.016 * H, [h.hx - bx * 0.12 * H, h.hy - by * 0.12 * H], H);
    else weaponGear(ctx, G.weapon, [gx, gy], tip, w, [h.hx - bx * 0.08 * H, h.hy - by * 0.08 * H], H);
  }
  if (hot && a.kind === 'jab') { ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(h.ux, h.uy, 6, 0, 6.28); ctx.fill(); }
  ctx.fillStyle = YOU.skin; ctx.beginPath(); ctx.arc(h.hx, h.hy, 0.042 * H, 0, 6.28); ctx.fill();
  ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = 2; ctx.stroke();
  if (h.down) {
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(h.ax, h.ay, 22, 0, 6.28); ctx.stroke();
    ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.moveTo(h.ax, h.ay); ctx.lineTo(h.fx, h.fy); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(h.fx, h.fy, 7, 0, 6.28); ctx.fill();
    // a finisher you can fire: a violet ring round the thumb fills while it rests, wide enough to show past it
    const fc = !h.moved && !h.finDone && finReady();
    if (fc) {
      const k = clamp(Math.min((state.m - h.pressT) / TUNING.mom.hold, (state.m - h.swingT) / TUNING.mom.still), 0, 1);
      ctx.strokeStyle = 'rgba(232,121,249,0.35)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(h.ax, h.ay, 40, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#e879f9'; ctx.beginPath(); ctx.arc(h.ax, h.ay, 40, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
      E.text(fc.name.toUpperCase(), h.ax, h.ay - 54, { size: 14, weight: '800', color: '#f5d0fe' });
    }
  }
  if (a && a.kind !== 'raise' && !locked) E.text(a.kind === 'over' ? 'OVERHEAD' : a.kind.toUpperCase(), h.hx, h.hy - 0.12 * H, { size: 11, color: '#e2e8f0', alpha: 0.7, weight: '700' });
  if (locked) E.text('X', h.ux, h.uy - 22, { size: 22, color: '#ff8a7a', weight: '800' });
}

// Your off arm and the round shield: hanging at the hip when down, up across the chest when raised, cracked as it wears.
function drawShield(ctx, E) {
  const sh = state.sh, Fy = youF(E), H = Fy.H, J = PARTS[4].joint, g = lookOf(state.you, false).gear.shield;
  if (sh.broken) return;
  const [hx, hy] = toScreen(Fy, ...shieldPos());
  const [sx, sy] = toScreen(Fy, J[0], J[1]);
  const r = lerp(0.11, 0.2, sh.up) * H, cx = hx, cy = hy, tower = g && g.id === 'ironwall';
  limb(ctx, [[sx, sy], [hx, hy]], 0.07 * H, YOU.skin);
  // Untouchable: no shield at all, an empty fist
  if (noShield()) { ctx.fillStyle = YOU.skin; ctx.beginPath(); ctx.arc(hx, hy, 0.042 * H, 0, TAU); ctx.fill(); ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = 2; ctx.stroke(); return; }
  // the round bronze shield, or Iron Wall's tower shield, tall and square
  const shape = (k) => (tower ? rrect(ctx, -r * 0.72 * k, -r * 1.2 * k, r * 1.44 * k, r * 2.4 * k, r * 0.2 * k) : (ctx.beginPath(), ctx.arc(0, 0, r * k, 0, TAU)));
  ctx.save(); ctx.translate(cx, cy);
  if (g && g.id === 'thorns') for (let i = 0; i < 10; i++) { const a = i * TAU / 10; spike(ctx, Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92, a, r * 0.32, r * 0.16, BRONZE, true); }
  const gr = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, tower ? r * 1.3 : r);
  gr.addColorStop(0, '#b9803a'); gr.addColorStop(1, '#6d4519');
  shape(1); ctx.fillStyle = gr; ctx.fill();
  ctx.strokeStyle = sh.flash > 0 ? '#ffffff' : '#2a1c10'; ctx.lineWidth = 4; ctx.stroke();
  ctx.strokeStyle = '#d6b04a'; ctx.lineWidth = 3; shape(0.82); ctx.stroke();
  if (tower) { ctx.lineWidth = 2; line(ctx, 0, -r * 0.95, 0, r * 0.95); for (const k of [-0.6, 0.6]) line(ctx, -r * 0.55, r * k, r * 0.55, r * k); }
  ctx.fillStyle = '#c9a43a'; ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, 6.28); ctx.fill(); ctx.stroke();
  if (g && g.id === 'thorns') spike(ctx, 0, 0, -0.6, r * 0.3, r * 0.16, BRONZE, true);
  const worn = shieldMax() - sh.hits;
  ctx.strokeStyle = '#1a120a'; ctx.lineWidth = 2;
  for (let i = 0; i < worn; i++) { const a = i * 1.7 + 0.5; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.25, Math.sin(a) * r * 0.25); ctx.lineTo(Math.cos(a + 0.2) * r * 0.65, Math.sin(a + 0.2) * r * 0.65); ctx.lineTo(Math.cos(a - 0.1) * r * 0.95, Math.sin(a - 0.1) * r * 0.95); ctx.stroke(); }
  if (sh.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${sh.flash / 0.25 * 0.5})`; shape(1); ctx.fill(); }
  if (g) gearGlint(ctx, r * 0.5, -r * 0.5, r * 0.4, g, 0.2);
  ctx.restore();
}
// a live piece's glint (the shield and the weapon are drawn each frame)
function gearGlint(ctx, x, y, s, c, ph) {
  const S = TUNING.skin, k = Math.pow(Math.max(0, Math.sin((state.m / S.gearGlint + ph) * TAU)), 6) * S.gearGlintA;
  if (k < 0.02) return;
  ctx.save(); glint(ctx, x, y, s, rarCol(c), k); ctx.restore();
}

// ----- the play screen: the left column, the walls, his cover and tell, the hint, the caption, the background -----
// The shield buttons and DODGE. The shield button matching the foe's tell glows; the raised one is lit; DODGE lights while you are backed off and reddens at the wall.
function drawShieldBtns(ctx, E) {
  const sh = state.sh, sw = state.sw, tell = sw && sw.fin <= 0 && !hesitating() ? sw.zone : null, fakeBtn = hesitating() ? sw.zone : null;
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
  E.text(wall ? 'at the wall' : state.dg.down && state.dg.t > TUNING.dodge.dur ? 'backing off' : 'hold: back off', b.x + b.w / 2, b.y + b.h * 0.76, { size: 12, weight: '700', color: ink });
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

// The foe's cover: a shield or guard disc sliding over the part you just hit. His OPEN flags are in the HUD (foeHealth).
function drawGuard(ctx, E) {
  if (state.fallT > 0) return;
  const F = foeF(E), H = F.H, sty = state.foe.shield ? { tint: '#7dd3fc', label: 'SHIELD' } : { tint: '#fde68a', label: 'GUARD' };
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
  const left = sw.wind - sw.t, inWin = left <= SH.dur, perfect = left <= perfectWin();
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
  const lines = ['Left thumb: High / Mid / Low raise the shield  \u00b7  DODGE steps back', 'Right thumb: your weapon (like a trackpad; push far to lunge in)'];
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

// The stands, the wall and the sand never move, so they are painted once per screen size and run (the crowd is seeded) and copied each frame.
let bgSpr = null;
function drawBackground(ctx, E) {
  if (!canSprite) { paintBackground(ctx, E); return; }
  const k = Math.min(E.dpr || 1, TUNING.skin.maxDpr), m = 20, key = `${E.w}|${E.h}|${k}|${state.seed}`;
  if (!bgSpr || bgSpr.key !== key) {
    const cv = new OffscreenCanvas(Math.ceil((E.w + 2 * m) * k), Math.ceil((E.h + 2 * m) * k)), c = cv.getContext('2d', { alpha: false });
    c.scale(k, k); c.translate(m, m); paintBackground(c, E);
    bgSpr = { key, cv };
  }
  ctx.drawImage(bgSpr.cv, -m, -m, bgSpr.cv.width / k, bgSpr.cv.height / k);
}
function paintBackground(ctx, E) {
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
// A card's icon: a roundel of radius s at (x, y) ringed in its family's colour (a duo's in gold, a keystone's doubled), with its family's mark,
// or, small, the card's initials so each owned card can be named from the HUD.
function famGlyph(ctx, fam, u) {
  const P = (pts) => { ctx.beginPath(); pts.forEach(([a, b], i) => (i ? ctx.lineTo(a * u, b * u) : ctx.moveTo(a * u, b * u))); ctx.closePath(); ctx.fill(); };
  if (fam === 'wall') P([[-5, -5.5], [5, -5.5], [4.5, 1.5], [0, 6], [-4.5, 1.5]]);
  else if (fam === 'blood') { ctx.beginPath(); ctx.moveTo(0, -6.5 * u); ctx.bezierCurveTo(2 * u, -3 * u, 5 * u, 0, 5 * u, 2 * u); ctx.arc(0, 2 * u, 5 * u, 0, Math.PI); ctx.bezierCurveTo(-5 * u, 0, -2 * u, -3 * u, 0, -6.5 * u); ctx.fill(); }
  else if (fam === 'dancer') { for (const k of [-3.5, 0, 3.5]) { ctx.beginPath(); ctx.moveTo(-6 * u, k * u + 2 * u); ctx.quadraticCurveTo(0, k * u - 4 * u, 6 * u, k * u); ctx.stroke(); } }
  else if (fam === 'brute') { ctx.fillRect(-5 * u, -5.5 * u, 10 * u, 4.5 * u); ctx.fillRect(-1 * u, -1 * u, 2 * u, 7 * u); }
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
  const d = state.draft, D = TUNING.draft, top = E.safe.top + 18, t = d.tally, gc = TIER_COL[d.grade], held = heldFams();
  ctx.fillStyle = 'rgba(10,8,14,0.82)'; ctx.fillRect(0, 0, E.w, E.h);
  const d0 = state.gauntlet[state.rack], who = d0.pair ? `${d0.name.split(/[ ,]/)[0]} AND ${d0.pair.name.split(/[ ,]/)[0]}` : state.foe.name;
  E.text(`${who.toUpperCase()} FELLED  ·  BOUT ${state.rack + 1} OF ${state.gauntlet.length}`, E.w / 2, top, { size: 13, weight: '800', color: '#c4b99a' });
  E.text(`GRADE ${d.grade}`, E.w / 2, top + 28, { size: 24, weight: '800', color: gc });
  E.text(`${t.slot} slot hits · ${t.read} feints read · ${t.pun} punishes · ${t.taken} hits taken`, E.w / 2, top + 52, { size: 12, color: '#e2e8f0' });
  // his line stays left of the faint HUD's shield label under the overlay (wraps to two lines on a short, narrow screen)
  const bl = wrapPx(ctx, `Old Brutus: “${brutusWon()}”`, 2 * (E.w - 16 - E.safe.right - 110 - 6 - 72 - E.w / 2), 14, '700'), ex = (bl.length - 1) * 17;
  bl.forEach((s2, k) => E.text(s2, E.w / 2, top + 72 + k * 17, { size: 14, weight: '700', color: '#fde68a' }));
  const o = D.odds[d.grade], pct = o.map((v) => Math.round(v / (o[0] + o[1]) * 100)), g = d.gold;
  // the style bonuses are the crowd's coins: what they threw is shown apart from the fell's purse
  const thrown = g ? g.items.filter((e) => e[0] !== 'fell') : [], tsum = thrown.reduce((a2, e) => a2 + e[1], 0);
  const gl = `${g ? `+${g.sum} gold (fell ${g.sum - tsum}${tsum ? `, the crowd threw ${tsum}: ${thrown.map((e) => `${e[0]} ${e[1]}`).join(', ')}` : ''})  ·  ` : ''}purse ${state.gold}  ·  Grade ${d.grade}: Common ${pct[0]}% · Rare ${pct[1]}%`;
  E.text(gl, E.w / 2, top + 92 + ex, { size: fitSize(ctx, gl, 12, E.w - 32, '700'), weight: '700', color: '#fbbf24' });
  const n = d.cards.length, gap = 14, w = Math.min(210, (E.w - 32 - E.safe.left - E.safe.right - gap * (n - 1)) / n), y = top + 108 + ex, h = Math.min(190, E.h - E.safe.bottom - y - 62), x0 = (E.w - (w * n + gap * (n - 1))) / 2;
  const ready = d.t > D.delay;
  d.btns = d.cards.map((c, i) => {
    const x = x0 + i * (w + gap), priced = i === d.priced, price = priceOf(c), short = priced && state.gold < price, col = c.duo ? DUO_GOLD : FAMS[c.fam].col, rc = rarCol(c), old = replaces(c);
    ctx.globalAlpha = !ready ? 0.6 : short ? 0.55 : 1;
    // the border is the rarity's colour; the icon and the bottom line are the family's
    E.roundRect(x, y, w, h, 14, priced ? '#2a2016' : '#221a2b', rc);
    E.roundRect(x + 3, y + 3, w - 6, h - 6, 11, null, priced ? 'rgba(255,210,74,0.55)' : shade(rc, 0.6));
    E.text(tierName(c), x + w / 2, y + 14, { size: fitSize(ctx, tierName(c), 10, w - 16), weight: '800', color: rc });
    // the bottom lines, each 14 px or more: the price, the piece it replaces (on its own line, split in two when it is too wide), or the family
    const bot = [], fits = (t, wt) => { ctx.font = `${wt} 14px system-ui, sans-serif`; return ctx.measureText(t).width <= w - 16; };
    if (priced) {
      const have = `${price} gold \u00b7 you have ${state.gold}`;
      bot.push([short && fits(have, 800) ? have : `${price} gold`, short ? '#9aa4b2' : '#ffd24a', 800]);
    }
    if (old) {
      const t = `replaces ${old.gear}`;
      if (fits(t, 700)) bot.push([t, '#fb923c', 700]); else bot.push(['replaces', '#fb923c', 700], [old.gear, '#fb923c', 700]);
    } else if (!priced) bot.push([c.duo ? c.duo.map((f) => FAMS[f].name).join(' + ') : `${FAMS[c.fam].name}${held[c.fam] ? ` \u00b7 you wear ${held[c.fam]}` : ''}`, col, 800]);
    const bh = 8 + 16 * bot.length, r = Math.min(24, h * 0.13, Math.max(14, (h - 130 - bh) * 0.5));
    drawIcon(ctx, c.id, x + w / 2, y + 22 + r, r);
    const ly = y + 34 + 2 * r, title = titleOf(c), sub = c.duo ? 'takes no slot' : c.fam === 'fin' ? 'war paint, takes no slot' : c.name;
    E.text(title, x + w / 2, ly, { size: fitSize(ctx, title, 17, w - 16), weight: '800', color: '#f0e6cc' });
    E.text(sub, x + w / 2, ly + 17, { size: fitSize(ctx, sub, 12, w - 16, '700'), weight: '700', color: col });
    // the rule's line, a size smaller when three lines would meet the bottom lines
    let fs = 13, ls = wrapPx(ctx, c.line, w - 18, fs, '600');
    if (ly + 35 + (ls.length - 1) * 15 > y + h - bh - 6) { fs = 11; ls = wrapPx(ctx, c.line, w - 14, fs, '600'); }
    ls.slice(0, 3).forEach((s2, k) => E.text(s2, x + w / 2, ly + 35 + k * (fs + 2), { size: fs, color: '#cbd5e1' }));
    bot.forEach(([t, color, wt], k) => E.text(t, x + w / 2, y + h - 13 - (bot.length - 1 - k) * 16, { size: 14, weight: String(wt), color }));
    ctx.globalAlpha = 1;
    return { x, y, w, h, card: c };
  });
  const by = Math.min(E.h - E.safe.bottom - 30, y + h + 32);
  E.text('Pick one', E.w / 2 - 70, by, { size: 15, weight: '800', color: '#ffd24a', alpha: ready ? 0.6 + 0.4 * Math.sin(E.time * 4) : 0.3 });
  d.reroll = tokenButton(E, 'Reroll', E.w / 2 + 90, by, state.token);
  d.help = { x: E.w / 2 + 186, y: by - 24, w: 48, h: 48 };
  E.roundRect(d.help.x, d.help.y, 48, 48, 24, '#1f2937', '#c4b99a');
  E.text('?', d.help.x + 24, by, { size: 22, weight: '800', color: '#f0e6cc' });
  if (d.helpOn) drawDealHelp(ctx, E, held, d.odds);
}
const ODDS_NAME = { set: 'Set', 3: 'Legendary', 2: 'Epic', 1: 'Rare', 0: 'Common' };
// The "?": how the deal works, the families you hold, and each duo with what it needs
function drawDealHelp(ctx, E, held, odds = []) {
  const duos = DECK.filter((c) => c.duo), w = Math.min(E.w - 32, 620), rh = 34, h = Math.min(E.h - 16, 166 + duos.length * rh), x = (E.w - w) / 2, y = (E.h - h) / 2;
  ctx.fillStyle = 'rgba(10,8,14,0.7)'; ctx.fillRect(0, 0, E.w, E.h);
  E.roundRect(x, y, w, h, 16, '#221a2b', '#e6c866');
  E.text('HOW THE DEAL WORKS', E.w / 2, y + 18, { size: 14, weight: '800', color: '#c4b99a' });
  const ol = `The gold card: ${odds.map(([t, p]) => `${ODDS_NAME[t]} ${p}%`).join(' · ') || 'nothing left to deal'}`;
  E.text(ol, E.w / 2, y + 40, { size: fitSize(ctx, ol, 15, w - 24), weight: '800', color: '#ffd24a' });
  const rules = [`Families you wear come ${TUNING.draft.pull}x as often; at most ${TUNING.draft.perFam} of one family a draft.`, 'One piece a slot: a new piece replaces the one you wear there.', 'A set bonus is dealt while you wear a piece of both its families.'];
  rules.forEach((t, i) => E.text(t, E.w / 2, y + 62 + i * 17, { size: fitSize(ctx, t, 13, w - 24, '600'), color: '#f0e6cc' }));
  const hl = Object.keys(FAMS).filter((f) => held[f]).map((f) => `${FAMS[f].name} ${held[f]}`).join('  ·  ');
  E.text(`You wear: ${hl || 'no family yet'}`, E.w / 2, y + 118, { size: 14, weight: '800', color: '#86efac' });
  const G = wornGear(), wl = SLOT_NAMES.filter((k) => G[k]).map((k) => `${k} ${G[k].gear}`).join(' · ');
  if (wl) E.text(wl, E.w / 2, y + 136, { size: fitSize(ctx, wl, 12, w - 24, '600'), color: '#cbd5e1' });
  duos.forEach((c, i) => {
    const ry = y + 158 + i * rh, ok = c.duo.every((f) => held[f]);
    drawIcon(ctx, c.id, x + 30, ry, 13);
    E.text(titleOf(c), x + 50, ry - 7, { size: 14, weight: '800', align: 'left', color: ok ? DUO_GOLD : '#9aa4b2' });
    E.text(`${c.duo.map((f) => FAMS[f].name).join(' + ')}${ok ? '  \u00b7  can be dealt' : ''}`, x + w - 14, ry - 7, { size: 12, weight: '700', align: 'right', color: ok ? '#86efac' : '#8a8f99' });
    E.text(c.line, x + 50, ry + 9, { size: fitSize(ctx, c.line, 12, w - 64, '600'), align: 'left', color: '#cbd5e1' });
  });
  E.text('Tap to close', E.w / 2, y + h - 10, { size: 12, weight: '800', color: '#ffd24a' });
}
// The armourer's tent: your purse, three wares to buy (tap one), and Skip (Leave once you have bought)
function drawTent(ctx, E) {
  const tt = state.tent, top = E.safe.top + 20, ready = tt.t > TUNING.draft.delay;
  ctx.fillStyle = 'rgba(10,8,14,0.86)'; ctx.fillRect(0, 0, E.w, E.h);
  E.text("THE ARMOURER'S TENT", E.w / 2, top, { size: 22, weight: '800', color: '#e6c866' });
  E.text('Old Brutus: “Spend it here. Gold buys nothing in the sand.”', E.w / 2, top + 26, { size: 14, weight: '700', color: '#fde68a' });
  E.text(`Your purse: ${state.gold} gold`, E.w / 2, top + 50, { size: 16, weight: '800', color: '#fbbf24' });
  const n = tt.wares.length, gap = 14, w = Math.min(200, (E.w - 32 - E.safe.left - E.safe.right - gap * (n - 1)) / n), y = top + 68, h = Math.min(170, E.h - E.safe.bottom - y - 70), x0 = (E.w - (w * n + gap * (n - 1))) / 2;
  tt.btns = tt.wares.map((wr, i) => {
    const x = x0 + i * (w + gap), short = !wr.sold && state.gold < wr.price, r = Math.min(24, h * 0.14);
    ctx.globalAlpha = !ready ? 0.6 : short ? 0.5 : 1;
    E.roundRect(x, y, w, h, 14, wr.sold ? '#1d2a22' : '#2a2016', wr.sold ? '#4ade80' : '#c4b99a');
    drawWare(ctx, wr.id, x + w / 2, y + 14 + r, r);
    const ly = y + 30 + 2 * r;
    E.text(wr.name, x + w / 2, ly, { size: fitSize(ctx, wr.name, 17, w - 16), weight: '800', color: '#f0e6cc' });
    wrapPx(ctx, wr.line, w - 18, 13, '600').slice(0, 2).forEach((s2, k) => E.text(s2, x + w / 2, ly + 21 + k * 15, { size: 13, color: '#cbd5e1' }));
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
  const cols = 7, gap = 4, x0 = 16 + E.safe.left, top = E.safe.top + 34, cw = (E.w - 32 - E.safe.left - E.safe.right - gap * (cols - 1)) / cols, rows = Math.ceil(DECK.length / cols);
  const ch = Math.max(44, Math.min(52, (E.h - E.safe.bottom - top - 64) / rows - gap));
  const cells = DECK.map((c, i) => ({ c, x: x0 + (i % cols) * (cw + gap), y: top + Math.floor(i / cols) * (ch + gap), w: cw, h: ch }));
  const by = Math.min(E.h - E.safe.bottom - 28, top + rows * (ch + gap) + 28), bw = Math.min(150, (E.w - 64) / 4);
  const btn = (k, i, label) => ({ k, label, x: E.w / 2 + (i - 1.5) * (bw + 10) - bw / 2, y: by - 22, w: bw, h: 44 });
  return { cells, btns: [btn('mom', 0, state.labMom ? 'Full pips: on' : 'Full pips: off'), btn('gold', 1, '+100 gold'), btn('clear', 2, 'Clear'), btn('done', 3, 'Done')] };
}
function drawLab(ctx, E) {
  const L = labLayout(E);
  ctx.fillStyle = 'rgba(10,8,14,0.92)'; ctx.fillRect(0, 0, E.w, E.h);
  E.text(`CARD LAB (dev)  ·  tap cards to hold them  ·  ${state.picks.length} held  ·  ${state.gold} gold`, E.w / 2, E.safe.top + 16, { size: 13, weight: '800', color: '#f5d0fe' });
  for (const q of L.cells) {
    const on = has(q.c.id), col = q.c.duo ? DUO_GOLD : FAMS[q.c.fam].col;
    E.roundRect(q.x, q.y, q.w, q.h, 8, on ? 'rgba(232,121,249,0.35)' : 'rgba(34,26,43,0.9)', on ? '#f5d0fe' : col);
    E.text(q.c.name, q.x + q.w / 2, q.y + q.h / 2 - 6, { size: fitSize(ctx, q.c.name, 12, q.w - 8), weight: '800', color: on ? '#ffffff' : '#f0e6cc' });
    const sub = q.c.duo ? 'duo' : q.c.key ? 'keystone' : FAMS[q.c.fam].name.replace('The ', '');
    E.text(sub, q.x + q.w / 2, q.y + q.h / 2 + 9, { size: 10, weight: '700', color: col });
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
};
// A rival's taunt: the noun of your origin, or your village on a revenge run.
const tauntOf = (me) => (me.reason === 'revenge' ? 'I remember your village.' : `You again, little ${ORIGINS[me.origin].noun}?`);
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
  } else if (me.reason === 'glory') {
    const k = chantN(), t = Array(k).fill(`${me.name.toUpperCase()}!`).join('  '), bw = w - 48, bh = 26;
    ctx.fillStyle = '#7f1d1d'; ctx.fillRect(cx - bw / 2, cy - bh / 2, bw, bh);
    ctx.fillStyle = '#e6c866'; ctx.fillRect(cx - bw / 2, cy - bh / 2, bw, 3); ctx.fillRect(cx - bw / 2, cy + bh / 2 - 3, bw, 3);
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + sx * bw / 2, cy - bh / 2); ctx.lineTo(cx + sx * (bw / 2 + 12), cy - bh / 2); ctx.lineTo(cx + sx * (bw / 2 + 4), cy); ctx.lineTo(cx + sx * (bw / 2 + 12), cy + bh / 2); ctx.lineTo(cx + sx * bw / 2, cy + bh / 2); ctx.closePath(); ctx.fillStyle = '#5f1515'; ctx.fill(); }
    E.text(t, cx, cy + 1, { size: fitSize(ctx, t, 13 + 2 * (k - 1), bw - 16), weight: '800', color: '#fde68a' });
  }
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
  return Math.max(10, Math.floor(size * Math.min(1, w / ctx.measureText(t).width)));
}
// text wrapped to lines no wider than w px at this font
function wrapPx(ctx, t, w, size, weight = '600') {
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  const out = [];
  for (const word of t.split(' ')) { const l = out.length - 1; if (l >= 0 && ctx.measureText(`${out[l]} ${word}`).width <= w) out[l] += ` ${word}`; else out.push(word); }
  return out;
}
// His card before each bout, in rows that never meet: the bout, his name and (champion) his tie to your reason, his armour on the left, size, weapon,
// its tip and stats on the right, your reason's thread, Brutus, what the champion or your rival says, and the tap.
function drawIntro(ctx, E) {
  if (state.edge) { drawPairIntro(ctx, E); return; }
  const d = state.foe, me = state.me, champ = d.champion, spar = bout().spar;
  const voice = d.rival ? tauntOf(me) : champ ? champLine(d, me.reason) : null, sub = champ ? champTie(d, me.reason) : spar ? 'Sparring: learn his tells.' : null;
  const gear = (d.gear || []).map((id) => CARD[id]), thread = me.reason !== 'revenge', b = sub ? 88 : 68, bodyH = 140 + ((d.guards || []).length ? 18 : 0), tb = b + bodyH + (thread ? 32 : 6);
  const second = state.rack === 0 && !voice;
  const w = Math.min(E.w - 32, gear.length ? 640 : 460), h = Math.min(E.h - 12, tb + 22 + (voice || second ? 22 : 0) + 34), x = (E.w - w) / 2, y = (E.h - h) / 2, cx = E.w / 2;
  ctx.fillStyle = 'rgba(10,8,14,0.6)'; ctx.fillRect(0, 0, E.w, E.h);
  E.roundRect(x, y, w, h, 18, '#221a2b', d.rival ? '#f87171' : champ ? '#ffd24a' : '#e6c866');
  const of = `BOUT ${state.rack + 1} OF ${state.gauntlet.length}`;
  E.text(d.rival ? `YOUR RIVAL  ·  THE CHAMPION  ·  ${of}` : champ ? `THE CHAMPION  ·  ${of}` : `${of}${spar ? '  ·  SPARRING' : ''}`, cx, y + 20, { size: 13, weight: '800', color: champ ? '#ffd24a' : '#c4b99a' });
  const name = d.name.toUpperCase();
  E.text(name, cx, y + 46, { size: fitSize(ctx, name, 30, w - 40), weight: '800', color: '#f0e6cc' });
  if (sub) E.text(sub, cx, y + 72, { size: 15, weight: '800', color: champ ? '#fca5a5' : '#7de3ff' });
  const lx = x + 80, s = 96;
  armourIcon(ctx, guardParts(foeParts(makeRng(d.partSeed), d.set), d.guards), lx, y + b + 100, s);
  E.text(`${d.set.name} ARMOUR`, lx, y + b + 118, { size: 12, weight: '800', color: '#aab3bc' });
  const ng = (d.guards || []).length;
  E.text(`${d.set.slots - ng} gaps open${ng ? ` · ${ng} guarded` : ''}`, lx, y + b + 134, { size: fitSize(ctx, 'x 4 gaps open · 2 guarded', 12, 150, '400'), color: '#c4b99a' });
  if (ng) { const gl = `${d.guards.map((id) => GUARDS[id].toUpperCase()).join(', ')}`; E.text(gl, lx, y + b + 150, { size: fitSize(ctx, gl, 12, 150), weight: '800', color: '#ffd24a' }); }
  const rx = x + 164, rw = gear.length ? Math.max(170, w - 164 - 32 - 226) : x + w - 22 - rx;
  E.text(d.size.name, rx, y + b + 10, { size: 18, weight: '800', align: 'left', color: '#fde68a' });
  E.text(d.wname, rx, y + b + 36, { size: 18, weight: '800', align: 'left', color: '#f0e6cc' });
  weaponIcon(ctx, d, rx + rw - d.weapon.len * 100, y + b + 28, 100);
  wrapPx(ctx, WEAPON_TIP[d.weapon.id] + (d.shield ? ', carries a shield' : ''), rw, 12).slice(0, 2).forEach((t, i) => E.text(t, rx, y + b + 58 + i * 14, { size: 12, align: 'left', color: '#9aa4b2' }));
  statBars(ctx, E, d, rx, y + b + 96, rw, 20, 13);
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
  const bl = `Old Brutus: “${brutusIntro()}”`;
  E.text(bl, cx, y + tb + 10, { size: fitSize(ctx, bl, 13, w - 28, '700'), weight: '700', color: '#fde68a' });
  if (voice) { const vl = `${d.name.split(/[ ,]/)[0]}: “${voice}”`; E.text(vl, cx, y + tb + 33, { size: fitSize(ctx, vl, 15, w - 28), weight: '800', color: '#f87171' }); }
  else if (second) { const sl = `“${brutusReason()}”`; E.text(sl, cx, y + tb + 31, { size: fitSize(ctx, sl, 14, w - 28, '700'), weight: '700', color: '#fde68a' }); }
  const k = 0.6 + 0.4 * Math.sin(state.introT * 4);
  E.text('Tap to fight', cx, y + h - 18, { size: 16, weight: '800', color: '#ffd24a', alpha: state.introT > 0.35 ? k : 0.3 });
}
// A pairs bout's card: both foes side by side, the one who fights first on the left, each with his own health, armour, guarded gaps and gear (at 14 px)
function drawPairIntro(ctx, E) {
  const a = state.foe, q = state.edge, me = state.me, d0 = state.gauntlet[state.rack], champ = a.champion;
  const voice = d0.rival ? tauntOf(me) : champ ? champLine(a, me.reason) : null, sub = champ ? champTie(a, me.reason) : 'Pairs: when one is winded or down, the other steps in.';
  const thread = me.reason !== 'revenge', b = 88, bodyH = 150, tb = b + bodyH + (thread ? 32 : 6);
  const w = Math.min(E.w - 32, 640), h = Math.min(E.h - 12, tb + 22 + (voice ? 22 : 0) + 34), x = (E.w - w) / 2, y = (E.h - h) / 2, cx = E.w / 2;
  ctx.fillStyle = 'rgba(10,8,14,0.6)'; ctx.fillRect(0, 0, E.w, E.h);
  E.roundRect(x, y, w, h, 18, '#221a2b', d0.rival ? '#f87171' : champ ? '#ffd24a' : '#e6c866');
  const of = `PAIRS  ·  BOUT ${state.rack + 1} OF ${state.gauntlet.length}`;
  E.text(d0.rival ? `YOUR RIVAL  ·  ${of}` : champ ? `THE CHAMPION  ·  ${of}` : of, cx, y + 20, { size: 14, weight: '800', color: champ ? '#ffd24a' : '#c4b99a' });
  const name = (a.title || `${a.name} and ${q.name}`).toUpperCase();
  E.text(name, cx, y + 46, { size: fitSize(ctx, name, 30, w - 40), weight: '800', color: '#f0e6cc' });
  E.text(sub, cx, y + 72, { size: Math.max(14, fitSize(ctx, sub, 15, w - 28)), weight: '800', color: champ ? '#fca5a5' : '#7de3ff' });
  const cw = (w - 48) / 2;
  pairCol(ctx, E, a, x + 16, y + b, cw, 'FIGHTS FIRST');
  pairCol(ctx, E, q, x + 32 + cw, y + b, cw, 'WAITS AT THE EDGE');
  ctx.fillStyle = 'rgba(240,230,204,0.18)'; ctx.fillRect(cx - 1, y + b, 2, bodyH - 6);
  if (thread) drawThread(ctx, E, cx, y + b + bodyH + 16, w);
  const bl = `Old Brutus: “${brutusIntro()}”`;
  E.text(bl, cx, y + tb + 10, { size: Math.max(14, fitSize(ctx, bl, 14, w - 28, '700')), weight: '700', color: '#fde68a' });
  if (voice) { const vl = `${a.name.split(/[ ,]/)[0]}: “${voice}”`; E.text(vl, cx, y + tb + 33, { size: Math.max(14, fitSize(ctx, vl, 15, w - 28)), weight: '800', color: '#f87171' }); }
  E.text('Tap to fight', cx, y + h - 18, { size: 16, weight: '800', color: '#ffd24a', alpha: state.introT > 0.35 ? 0.6 + 0.4 * Math.sin(state.introT * 4) : 0.3 });
}
// one foe's column on the pairs card: who he is, his health, his armour and guards, his gear (the pieces that act for him in red)
function pairCol(ctx, E, f, x, y, w, tag) {
  E.text(tag, x + w / 2, y + 6, { size: 14, weight: '800', color: '#c4b99a' });
  const nm = f.name.toUpperCase();
  E.text(nm, x + w / 2, y + 26, { size: Math.max(14, fitSize(ctx, nm, 18, w - 8)), weight: '800', color: f.champion ? '#ffd24a' : '#f0e6cc' });
  armourIcon(ctx, f.parts, x + 40, y + 122, 80);
  const rx = x + 84, rw = w - 88, ng = (f.guards || []).length, T = (t, yy, col = '#e2e8f0', wt = '700') => E.text(t, rx, yy, { size: 14, weight: wt, align: 'left', color: col });
  T(clipLine(ctx, `${f.size.name} · ${f.wname}`, rw), y + 50, '#fde68a', '800');
  T(`HEALTH ${f.maxHp}`, y + 70, '#f0e6cc', '800');
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(rx, y + 80, rw, 8); ctx.fillStyle = '#d9483a'; ctx.fillRect(rx, y + 80, rw * clamp(f.hp / f.maxHp, 0, 1), 8);
  T(clipLine(ctx, ng ? `${f.set.slots - ng} open \u00b7 ${f.guards.map((id) => GUARDS[id]).join(', ')}` : `${f.set.slots} gaps open`, rw), y + 102, ng ? '#ffd24a' : '#c4b99a');
  const gear = (f.gear || []).map((id) => CARD[id]), act = gear.filter((c) => FOE_TELL[c.id]), look = gear.filter((c) => !FOE_TELL[c.id]);
  const rows = [...act.map((c) => [c.gear, '#f87171']), ...(look.length ? [[`${look.map((c) => c.gear).join(', ')}`, '#9aa4b2']] : [])];
  if (!rows.length) rows.push(['No gear', '#9aa4b2']);
  rows.slice(0, 2).forEach(([t, col], i) => T(clipLine(ctx, t, rw), y + 122 + i * 18, col));
}
// a line cut to w px at 14 px bold, with an ellipsis
function clipLine(ctx, t, w) {
  ctx.font = '700 14px system-ui, sans-serif';
  if (ctx.measureText(t).width <= w) return t;
  while (t.length > 2 && ctx.measureText(`${t}\u2026`).width > w) t = t.slice(0, -1);
  return `${t.trimEnd()}\u2026`;
}
function miniCard(ctx, E, d, x, y, w, h, res) {
  const stroke = res === 'felled' ? '#4ade80' : res === 'lost' ? '#ef4444' : 'rgba(240,230,204,0.25)';
  E.roundRect(x, y, w, h, 12, res ? '#221a2b' : 'rgba(34,26,43,0.5)', stroke);
  const a = res ? 1 : 0.45;
  ctx.globalAlpha = a;
  E.text(d.champion ? 'CHAMPION' : `BOUT ${d.at + 1}`, x + w / 2, y + 13, { size: 10, weight: '800', color: d.champion ? '#ffd24a' : '#c4b99a', alpha: a });
  // a pair: both names when they fit, else the first and "+1"
  const first = d.name.length > 13 ? d.name.split(/[ ,]/)[0].toUpperCase() : d.name.toUpperCase(), both = d.pair ? `${d.name.split(/[ ,]/)[0]} & ${d.pair.name.split(/[ ,]/)[0]}`.toUpperCase() : first;
  ctx.font = '800 14px system-ui, sans-serif';
  const plus = `${d.name.split(/[ ,]/)[0].toUpperCase()} +1`, nm = ctx.measureText(both).width <= w - 8 ? both : d.pair && ctx.measureText(plus).width <= w - 8 ? plus : first;
  E.text(nm, x + w / 2, y + 30, { size: 14, weight: '800', color: '#f0e6cc', alpha: a });
  E.text(`${d.size.id} \u00b7 ${d.weapon.alt && d.mace ? d.weapon.alt : d.weapon.name}`, x + w / 2, y + 47, { size: 10, weight: '700', color: '#fde68a', alpha: a });
  ctx.globalAlpha = a;
  armourIcon(ctx, guardParts(foeParts(makeRng(d.partSeed), d.set), d.guards), x + w * 0.28, y + 104, 54);
  statBars(ctx, E, d, x + w * 0.5, y + 70, w * 0.46, 15, 9);
  E.text(d.set.name, x + w * 0.72, y + 118, { size: 9, color: '#aab3bc', alpha: a });
  ctx.globalAlpha = 1;
  E.text(res === 'felled' ? 'FELLED' : res === 'lost' ? 'CUT YOU DOWN' : 'NOT REACHED', x + w / 2, y + h - 14, { size: 11, weight: '800', color: res === 'felled' ? '#4ade80' : res === 'lost' ? '#ef4444' : '#6b7280' });
}

// ----- your fighter: the eight wheels, the card, and the end-card mini -----
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

// what your weapon is for, in one line
const MY_WEAPON_JOB = { gladius: 'all-rounder: quick jabs, fair reach', spear: 'long reach: jab from range; slashes are weak', axe: 'slow and heavy: overheads crack plates', dagger: 'short and fast: slot hits do 4x' };
// Your card, in three columns under the story and your perk: your armour, your size, hearts and stats, then your tier and your weapon (its name on its own line, its job wrapped below).
function drawMeCard(ctx, E, me, x, y, w, h) {
  const M = TUNING.me, S = M.sizes[me.size], A = M.armour[me.set], noun = ORIGINS[me.origin].noun, P = PERKS[noun], sc = startCard(me), cx = x + w / 2;
  E.roundRect(x, y, w, h, 18, '#1d2a2a', '#4ade80');
  E.text('YOUR FIGHTER', cx, y + 16, { size: 12, weight: '800', color: '#9fe3c6' });
  const st = storyLine(me);
  E.text(st, cx, y + 36, { size: fitSize(ctx, st, 15, w - 28), weight: '800', color: '#f0e6cc' });
  const pk = P ? `${P.name}: ${P.line}` : `${noun[0].toUpperCase()}${noun.slice(1)}: starts with ${sc.name} (${FAMS[sc.fam].name})`;
  E.text(pk, cx, y + 56, { size: fitSize(ctx, pk, 13, w - 28, '700'), weight: '700', color: '#86efac' });
  const lw = w * 0.3, ax = x + 12 + lw / 2, s = Math.min(84, h * 0.3) * S.scale;
  armourIcon(ctx, playerParts(me), ax, y + 72 + s * 0.95, s);
  E.text(`${A.name} ARMOUR`, ax, y + 180, { size: 11, weight: '800', color: '#aab3bc' });
  if (me.plates.length) wrapPx(ctx, `plated: ${me.plates.map((q) => (q === 'armB' ? 'shield arm' : q)).join(', ')}`, lw, 10).forEach((t, i) => E.text(t, ax, y + 194 + i * 12, { size: 10, color: '#c4b99a' }));
  const mx = x + 18 + lw, mw = w * 0.36;
  E.text(S.name, mx, y + 84, { size: 20, weight: '800', align: 'left', color: '#fde68a' });
  E.text(SIZE_TIP[me.size], mx, y + 103, { size: 12, align: 'left', color: '#9aa4b2' });
  E.text(`♥ ${halvesText(me.halves)} hearts`, mx, y + 123, { size: 15, weight: '800', align: 'left', color: '#f87171' });
  statBars(ctx, E, me, mx, y + 147, mw, 20, 13);
  const tx = mx + mw + 10, tw = x + w - 12 - tx, tc = TIER_COL[me.tier];
  ctx.strokeStyle = tc; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(tx + 24, y + 96, 22, 0, 6.28); ctx.stroke();
  E.text(me.tier, tx + 24, y + 98, { size: 28, weight: '800', color: tc });
  E.text('TIER', tx + 54, y + 88, { size: 11, weight: '800', align: 'left', color: '#c4b99a' });
  if (me.underdog) E.text('Underdog!', tx + 54, y + 105, { size: 13, weight: '800', align: 'left', color: '#ffd24a', alpha: 0.75 + 0.25 * Math.sin(E.time * 6) });
  const WI = TUNING.weapons.find((q) => q.id === me.weapon), nm = weaponName(me);
  const ws = Math.min(110, (tw - 12) / (WI.len + 0.4));
  weaponIcon(ctx, { weapon: WI, mace: me.mace }, tx + 4 + 0.3 * ws, y + 134, ws);
  E.text(nm, tx, y + 156, { size: fitSize(ctx, nm, 16, tw), weight: '800', align: 'left', color: '#f0e6cc' });
  wrapPx(ctx, MY_WEAPON_JOB[me.weapon], tw, 12).slice(0, 3).forEach((t, i) => E.text(t, tx, y + 175 + i * 14, { size: 12, align: 'left', color: '#c4b99a' }));
}
function meMini(ctx, E, me, x, y, w, h, picks = []) {
  E.roundRect(x, y, w, h, 12, '#1d2a2a', '#4ade80');
  // the set mark: each set bonus you wear, a small gold roundel under your armour
  picks.filter((id) => CARD[id].duo).forEach((id, i) => drawIcon(ctx, id, x + 16 + i * 19, y + 117, 8));
  E.text(me.name.toUpperCase(), x + w / 2, y + 13, { size: 10, weight: '800', color: '#9fe3c6' });
  E.text(`TIER ${me.tier}`, x + w / 2, y + 30, { size: 14, weight: '800', color: TIER_COL[me.tier] });
  E.text(`${me.size} · ${weaponName(me)} · ♥ ${halvesText(me.halves)}`, x + w / 2, y + 47, { size: 10, weight: '700', color: '#fde68a' });
  armourIcon(ctx, playerParts(me), x + w * 0.28, y + 104, 54 * TUNING.me.sizes[me.size].scale);
  statBars(ctx, E, me, x + w * 0.5, y + 70, w * 0.46, 15, 9);
  E.text(TUNING.me.armour[me.set].name, x + w * 0.72, y + 118, { size: 9, color: '#aab3bc' });
  E.text('YOUR FIGHTER', x + w / 2, y + h - 14, { size: 11, weight: '800', color: '#4ade80' });
}

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
// The menu: the title, Play (Resume when a run was saved, with New run beside Story and Sound), the Story card, and the pit wall of the fallen.
const menu = {
  enter(E) {
    this.btns = {}; this.story = false;
    // a v6 save's won runs are only in the ledger, which migrate cannot read: checked once here, a won run opens the City
    if (E.save.get('arenasCheck', 0)) {
      if (E.ledger.entries.some((e) => e.k === 'result' && e.d && e.d.won === true)) E.save.set('arenas', Math.max(1, E.save.get('arenas', 0)));
      E.save.set('arenasCheck', 0);
    }
  },
  render(ctx, E) {
    this.btns = {};
    if (portrait(E)) { rotateCard(ctx, E); return; }
    const run = E.save.get('run', null), cx = E.w / 2, top = E.safe.top, bottom = E.h - E.safe.bottom;
    E.text('ARENA', cx, top + Math.max(44, E.h * 0.15), { size: 44, weight: '800', color: '#e6c866' });
    const py = top + E.h * 0.4, ry = py + 64, row = run ? ['new', 'story', 'sound'] : ['story', 'sound'], bw = 140, gap = 12;
    this.btns.play = E.button(run ? `Resume: ${(ARENA[run.arena] || ARENAS[0]).short}, bout ${run.rack + 1}` : 'Play', cx, py, { w: 280, h: 56, size: 20 });
    row.forEach((k, i) => {
      const x = cx + (i - (row.length - 1) / 2) * (bw + gap), label = k === 'new' ? 'New run' : k === 'story' ? 'Story' : E.audio.muted ? 'Sound: off' : 'Sound: on';
      this.btns[k] = E.button(label, x, ry, { w: bw, h: 48, size: 16, fill: k === 'story' ? '#7c2d12' : '#1f2937' });
    });
    // the pit wall: the last eight fallen, newest first, chalked on stone in two rows of four
    const wall = E.save.get('wall', []).slice(0, 8), sw = Math.min(E.w - 40, 560), sx = cx - sw / 2, wy = Math.min(ry + 44, bottom - 82);
    E.text('THE PIT WALL', cx, wy, { size: 13, weight: '800', color: '#c4b99a' });
    E.roundRect(sx, wy + 10, sw, 56, 8, '#3a322c', '#5a4e44');
    if (!wall.length) E.text('No names chalked here yet', cx, wy + 38, { size: 14, color: '#8a8f99' });
    wall.forEach((q, i) => E.text(`${q.name} (${q.bout})`, sx + sw * ((i % 4) + 0.5) / 4, wy + 25 + Math.floor(i / 4) * 26, { size: 14, weight: '700', color: i === 0 ? '#ffffff' : '#d6d0c4', alpha: i === 0 ? 1 : 0.8 }));
    if (this.story) this.storyCard(ctx, E);
  },
  storyCard(ctx, E) {
    ctx.fillStyle = 'rgba(10,8,14,0.82)'; ctx.fillRect(0, 0, E.w, E.h);
    const w = Math.min(E.w - 32, 560), lh = 24, h = 64 + STORY.length * lh + 34, x = (E.w - w) / 2, y = (E.h - h) / 2;
    E.roundRect(x, y, w, h, 18, '#221a2b', '#e6c866');
    E.text('OLD BRUTUS, YOUR LANISTA', E.w / 2, y + 26, { size: 14, weight: '800', color: '#c4b99a' });
    STORY.forEach((t, i) => E.text(t, E.w / 2, y + 58 + i * lh, { size: fitSize(ctx, t, 16, w - 32, '700'), weight: '700', color: i ? '#f0e6cc' : '#fde68a' }));
    E.text('Tap to close', E.w / 2, y + h - 20, { size: 14, weight: '800', color: '#ffd24a', alpha: 0.6 + 0.4 * Math.sin(E.time * 4) });
  },
  onTap(p, E) {
    if (this.story) { this.story = false; E.audio.play('tap'); return; }
    const b = this.btns, run = E.save.get('run', null), fresh = () => E.setScene('arenas');
    if (b.play && E.hit(b.play, p)) { E.audio.play('tap'); if (run) E.setScene('play', { resume: run }); else fresh(); }
    else if (b.new && E.hit(b.new, p)) { E.audio.play('tap'); E.save.set('run', null); fresh(); }
    else if (b.story && E.hit(b.story, p)) { this.story = true; E.audio.play('tap'); }
    else if (b.sound && E.hit(b.sound, p)) { E.audio.toggleMute(); E.audio.play('tap'); }
  },
};

// The arena picker, the ladder in order (principle 11: a card is its name, its state drawn, one line of twist and its champion). An open arena: its name
// (with its place), its twist and its champion (your rival in red when one waits); cleared ones are gilded. The next locked arena: its champion's silhouette and
// what opens it. The Colosseum: coming soon. A tap on a locked card says in one line what opens it; in the dev channel a second tap enters a built one.
const openTo = (E) => E.save.get('arenas', 0);
function lockLine(i) { return `Fell the ${ARENAS[i - 1].who} champion to open`; }
const pickArena = {
  enter() { this.cards = []; this.back = null; this.dev = null; },
  layout(E) {
    const n = ARENAS.length, gap = 12, top = E.safe.top + 58, w = Math.min(210, (E.w - 32 - E.safe.left - E.safe.right - gap * (n - 1)) / n);
    const h = Math.min(250, E.h - top - 14 - E.safe.bottom), x0 = (E.w - (w * n + gap * (n - 1))) / 2;
    return ARENAS.map((a, i) => ({ a, i, x: x0 + i * (w + gap), y: top, w, h }));
  },
  render(ctx, E) {
    if (portrait(E)) { this.cards = []; this.back = null; rotateCard(ctx, E); return; }
    const top = E.safe.top, to = openTo(E), rivals = E.save.get('rivals', {});
    E.text('CHOOSE YOUR ARENA', E.w / 2, top + 28, { size: 22, weight: '800', color: '#e6c866' });
    this.back = E.button('Back', 16 + E.safe.left + 44, top + 28, { w: 88, h: 44, size: 16, fill: '#1f2937' });
    this.cards = this.layout(E);
    for (const c of this.cards) {
      const { a, i, x, y, w, h } = c, open = i <= to && !a.soon, cleared = i < to && !a.soon, next = !open && !a.soon && i === to, cx = x + w / 2;
      E.roundRect(x, y, w, h, 14, open ? '#2a2016' : 'rgba(34,26,43,0.6)', cleared ? '#ffd24a' : open ? '#e6c866' : 'rgba(240,230,204,0.25)');
      ctx.globalAlpha = open ? 1 : 0.55;
      // the name carries its place ("The City arena, Pompeii"), wrapped onto up to three lines: one item
      wrapPx(ctx, `${a.name}, ${a.place}`.toUpperCase(), w - 12, 14, '800').slice(0, 3).forEach((t, k) => E.text(t, cx, y + 20 + k * 17, { size: 14, weight: '800', color: open ? (cleared ? '#ffd24a' : '#f0e6cc') : '#9aa4b2' }));
      ctx.globalAlpha = 1;
      const sh = Math.min(80, h * 0.31), sy = y + 74 + sh;
      if (cleared) laurel(ctx, cx, sy - sh * 0.5, sh * 0.62);
      silhouette(ctx, cx + (a.id === 'city' ? 12 : 0), sy, sh, open ? '#6b5a44' : '#3a3242');
      if (a.id === 'city') silhouette(ctx, cx - 18, sy + 4, sh * 0.85, open ? '#4e4234' : '#2e2836');
      if (!open) padlock(ctx, cx, sy - sh * 0.45, a.soon ? '#9aa4b2' : '#e6c866');
      // open: the twist (white) and the champion (gold, or your rival in red); locked: what opens it
      const rv = rivals[a.id], wrap = (t) => wrapPx(ctx, t, w - 16, 14, '700').slice(0, 2);
      const lines = open ? [...wrap(a.twist).map((t) => [t, '#f0e6cc']), ...wrap(rv ? `Rival: ${rv.name.split(/[ ,]/)[0]}` : a.champLabel).map((t) => [t, rv ? '#f87171' : '#fde68a'])]
        : wrapPx(ctx, a.soon ? 'Coming soon' : next ? lockLine(i) : 'Locked', w - 16, 14, '700').slice(0, 3).map((t) => [t, '#c4b99a']);
      const ly = y + h - 14 - (lines.length - 1) * 18;
      lines.forEach(([t, col], k) => E.text(t, cx, ly + k * 18, { size: 14, weight: '700', color: col }));
    }
  },
  onTap(p, E) {
    if (portrait(E)) return;
    if (this.back && E.hit(this.back, p)) { E.audio.play('tap'); E.setScene('menu'); return; }
    const c = this.cards.find((q) => E.hit(q, p));
    if (!c) return;
    const to = openTo(E), open = c.i <= to && !c.a.soon, start = () => { E.audio.play('tap'); E.setScene('roll', { seed: (Math.random() * 2 ** 32) >>> 0, arena: c.a.id }); };
    if (open) { start(); return; }
    E.audio.play('miss');
    if (c.a.soon) { E.toast('The Colosseum is coming soon'); return; }
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
// a cleared arena's gilding: a gold laurel round its champion
function laurel(ctx, x, y, r) {
  ctx.save(); ctx.strokeStyle = '#ffd24a'; ctx.fillStyle = '#ffd24a'; ctx.lineWidth = 2.5;
  for (const sd of [-1, 1]) {
    ctx.beginPath(); ctx.arc(x, y, r, Math.PI / 2 + sd * 0.35, Math.PI / 2 + sd * 2.6, sd < 0); ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 2 + sd * (0.6 + i * 0.36), lx = x + Math.cos(a) * r, ly = y + Math.sin(a) * r;
      ctx.beginPath(); ctx.ellipse(lx, ly, 6, 3, a + sd * 0.9, 0, 6.28); ctx.fill();
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

// Before the gauntlet: your fighter's six function wheels and two flavour wheels, one after another (tap stops the spinning one), then your card.
// On the card the wheels sit in a strip above it: tap one, then Respin to roll it again with the run's one token, then Fight!
const roll = {
  enter(E, params) {
    this.seed = params.seed; this.arena = params.arena || 'pit'; this.me = rollMe(this.seed); this.i = 0; this.t = 0; this.landed = false; this.cardT = 0;
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
    if (this.btn && E.hit(this.btn, p)) { E.audio.play('tap'); E.setScene('play', { seed: this.seed, arena: this.arena, me: this.me, token: this.token, tokenUsed: this.used }); return; }
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
  [h.tgx, h.tgy] = guardPt(E);
  h.pang = Math.atan2(h.tgy - sy, h.tgx - sx);
  solveArm(E, 0);
  h.pux = h.ux; h.puy = h.uy; h.phx = h.hx; h.phy = h.hy; state.you.a = 0.05;
  poseYou(E, 0.016);
  poseFoe(E, 0.016);
}

const play = {
  state, lay, foeF, youF, toScreen, newRack, raiseShield, dodge, fell, blockRun, ZONE, TUNING, rollMe, respinMe, solveArm, windFoe, gapHit, bout,
  walls, gapNow, dealDraft, openDraft, pickCard, rerollDraft, CARD, buildMove, startMove, shieldBtns, myBlade, bounce,
  emit, gainMom, addBleed, tellDodge, resolveSwing, HOOKS, lamed, applyCard, finReady, updateFinisher, checkHits, disable, noDodge, noShield, perfectWin, DECK, partCenter, updateBleed, ZONES, heldFams, dealable, boutGold, openTent, buyWare, leaveTent, priceOf,
  ARENAS, rollGauntlet, newRound, stepIn, updatePair, favour, bandOf, endingOf, edgeF, newRackAt: (E, i) => { state.rack = i; newRack(E); poseFoe(E, 0.016); },
  enter(E, params) {
    if (params.resume) resumeRun(E, params.resume); else newRound(E, params.seed, params.me || rollMe(params.seed), undefined, params.arena);
    newRack(E); initHand(E);
    if (state.draft) { state.intro = false; state.fallT = TUNING.resetDelay; state.foe.hp = 0; state.foe.shown = 0; }
    if (params.token != null && !params.resume) { state.token = params.token; state.tokenUsed = params.tokenUsed || ''; }
  },
  update(dt, E) {
    if (portrait(E)) return;
    if (state.draft) { state.draft.t += dt; return; }
    if (state.tent) { state.tent.t += dt; return; }
    if (state.caption) { state.caption.t -= dt; if (state.caption.t <= 0) state.caption = null; }
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
    state.momT = Math.max(0, state.momT - dt); state.openAll = Math.max(0, state.openAll - dt); state.disarm = Math.max(0, state.disarm - dt); state.flyW = Math.max(0, state.flyW - dt);
    if (state.cover) {
      const c = state.cover, k = 1 - Math.exp(-dt / (TUNING.cover.slide * (lamed('armB') ? TUNING.lame.cover : 1)));
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
    updatePair(E, dt);
    updateBleed(E, dt);
    updateFinisher(E);
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
    E.save.set('run', null);
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
    E.ledger.add('result', { ...r, won, reached, halves: state.hp, sizes: g.map((d) => d.size.id).join(''), weapons: g.map((d) => d.weapon.id).join(','), armour: g.map((d) => d.set.id[0]).join(''),
      stats: g.map((d) => `${d.str}${d.spd}${d.sta}`).join(','), champ: g[g.length - 1].name, lostTo: won ? '' : `${g[reached - 1].name} ${g[reached - 1].size.id} ${g[reached - 1].weapon.id}`,
      moves: Object.entries(state.moveCount).map(([k, v]) => `${k}${v}`).join(','),
      meSize: me.size, meStats: `${me.str}${me.spd}${me.sta}`, meArmour: me.set, mePlates: me.plates.join(','), meTier: me.tier, underdog: me.underdog ? 1 : 0,
      grades: state.grades.join(''), picks: state.picks.join(','), stepsIn: state.stepsIn, stepsOut: state.stepsOut, wallHits: state.wallHits, foeWall: state.foeWall, outReach: state.outReach, dodged: state.dodged, chases: state.chases,
      shrugs: state.shrugs, gold: state.gold, goldEarned: state.goldEarned, bought: state.bought.join(','), wares: state.wares.join(','), tent: state.tentDone ? 1 : 0, fins: state.fins.join(','), bleedDmg: state.bleedDmg, lab: state.labUsed, meWeapon: me.weapon === 'axe' && me.mace ? 'mace' : me.weapon, token: state.tokenUsed, epicsSeen: state.epicsSeen, origin: me.origin, reason: me.reason, rival: champ.rival ? 1 : 0, rivalBeaten: state.rivalBeaten,
      arena: state.arena, fav: Math.round(state.fav), thumb: won && state.arena === 'games' ? bandOf(state.fav) : -1 });
    E.setScene('over', { ...r, won, reached, gauntlet: g, me, results: state.results.slice(), best: Math.max(best, state.gapHits), isNew,
      picks: state.picks.slice(), grades: state.grades.slice(), wall, rivalBeaten: state.rivalBeaten, gold: state.gold, goldEarned: state.goldEarned, wares: state.wares.slice(),
      arena: state.arena, fav: state.fav, opened });
  },
  // two thumbs: a touch that starts in the left third is the shield and dodge thumb (buttons only), any other is the sword thumb
  onPointerDown(p, E) {
    if (state.endT > 0 || portrait(E) || state.intro || state.draft || state.tent) return;
    if (p.startX < E.w / 3) {
      const b = buttonAt(E, p);
      if (b && b.dodge) dodge(E, p.id);
      else if (b) raiseShield(E, b.z, p.id);
      return;
    }
    const h = state.hand;
    if (h.down) return;
    h.down = true; h.id = p.id; h.fx = p.x; h.fy = p.y;
    h.ax = p.x; h.ay = p.y; h.pressT = state.m; h.swingT = -9; h.moved = false; h.finDone = false;
    if (h.lock <= 0) {
      [h.tgx, h.tgy] = guardPt(E);
      h.grip = 0; solveArm(E, 0);
      h.pux = h.ux; h.puy = h.uy; h.phx = h.hx; h.phy = h.hy; h.sp = 0; h.vx = h.vy = 0;
    }
  },
  onPointerMove(p, E) {
    const h = state.hand;
    if (h.down && h.id === p.id) { h.fx = p.x; h.fy = p.y; if (Math.hypot(p.x - h.ax, p.y - h.ay) > TUNING.mom.slop) h.moved = true; }
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
      if (d.helpOn) { d.helpOn = false; E.audio.play('tap'); return; }
      if (d.help && E.hit(d.help, p)) { d.helpOn = true; E.audio.play('tap'); return; }
      if (d.reroll && d.reroll.live && E.hit(d.reroll, p)) { rerollDraft(E); return; }
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
  onPointerUp(p) {
    const s = state.sh, h = state.hand, dg = state.dg;
    if (dg.down && dg.id === p.id) { dg.down = false; dg.id = -1; }
    else if (s.hid === p.id) { s.held = false; s.hid = -1; }
    else if (h.down && h.id === p.id) { h.down = false; h.sp = 0; h.atk = null; }
  },
  render(ctx, E) {
    if (portrait(E)) { rotateCard(ctx, E); return; }
    ctx.save();
    drawBackground(ctx, E);
    drawWalls(ctx, E);
    if (state.sw && state.sw.ghostX) drawFighter(ctx, E, { ...youF(E), x: state.sw.ghostX }, state.you, 'you', 0.3 + 0.1 * Math.sin(state.m * 20));
    drawFighter(ctx, E, youF(E), state.you, 'you');
    if (state.netT > 0) { const Fy = youF(E); drawNet(ctx, Fy.x, Fy.y - 0.55 * Fy.H, 0.32 * Fy.H * clamp(state.netT / 0.3, 0.6, 1)); }
    if (state.edge && !state.edge.down) drawEdge(ctx, E);
    drawFighter(ctx, E, foeF(E), state.foe, 'foe');
    if (state.flyW > 0) flyingWeapon(ctx, E);
    drawGuard(ctx, E);
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
    drawCrowdMeter(ctx, E, l, top + 34);
    drawCoin(ctx, l + 6, top + 53, 6);
    E.text(`${state.gold}`, l + 17, top + 53, { size: 14, align: 'left', weight: '800', color: '#fbbf24' });
    // hearts in quarters: a plated hit takes a quarter
    const nh = Math.ceil(state.maxHp / 2);
    for (let i = 0; i < nh; i++) {
      const hx = E.w - r - 10 - (nh - 1 - i) * 26, have = clamp((state.hp - i * 2) / 2, 0, 1);
      E.text('\u2665', hx, top + 14, { size: 26, color: have >= 1 ? '#ef4444' : '#3b3f46' });
      if (have > 0 && have < 1) { ctx.save(); ctx.beginPath(); ctx.rect(hx - 13, top - 4, 26 * have, 36); ctx.clip(); E.text('\u2665', hx, top + 14, { size: 26, color: '#ef4444' }); ctx.restore(); }
    }
    const bw = 110, bx = E.w - r - bw, sf = state.stamina / state.staMax, H2 = HUD_ROW;
    drawPips(ctx, E, bx, bw, top + H2.pips);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(bx - 1, top + H2.sta - 1, bw + 2, 11);
    const flashOn = state.exhaust > 0 && Math.floor(state.m * 8) % 2 === 0;
    if (state.exhaust > 0) { ctx.fillStyle = flashOn ? '#ffffff' : '#ef4444'; ctx.fillRect(bx, top + H2.sta, bw * clamp(1 - state.exhaust / TS.exhaust, 0.05, 1), 9); }
    else { ctx.fillStyle = sf < 0.25 ? '#f59e0b' : '#4ade80'; ctx.fillRect(bx, top + H2.sta, bw * sf, 9); }
    E.text(state.exhaust > 0 ? 'EXHAUSTED' : 'stamina', bx - 6, top + H2.sta + 6, { size: 10, align: 'right', color: state.exhaust > 0 ? '#fca5a5' : '#c4b99a', weight: state.exhaust > 0 ? '800' : '400' });
    // your upgrades, under the bars
    state.picks.forEach((id, i) => drawIcon(ctx, id, E.w - r - 9 - (state.picks.length - 1 - i) * 22, top + H2.icons, 9));
    const sy = top + (state.picks.length ? H2.shield : H2.shield0);
    const nsh = shieldMax();
    for (let i = 0; i < nsh; i++) {
      ctx.fillStyle = state.sh.broken || noShield() ? '#3b3f46' : i < state.sh.hits ? '#d6a24a' : '#3b3f46';
      ctx.fillRect(bx + i * (bw / nsh), sy, bw / nsh - 4, 7);
    }
    E.text(noShield() ? 'no shield' : state.sh.broken ? 'shield broken' : 'shield', bx - 6, sy + 6, { size: 10, align: 'right', color: state.sh.broken || noShield() ? '#ef4444' : '#c4b99a' });
    if (!state.draft && !state.tent) foeHealth(ctx, E);
    if (state.edge && !state.edge.down && !state.intro && !state.draft && !state.tent) drawEdgeTag(ctx, E);
    if (state.netT > 0) E.text('NETTED: slow hand, no lunge', bx + bw, sy + 34, { size: 11, align: 'right', color: '#e2e8f0', weight: '700' });
    if (state.hint && !state.intro && !state.caption) drawHint(ctx, E);
    if (state.intro) { drawIntro(ctx, E); if (E.channel !== 'release') { const t = labTab(E); E.roundRect(t.x, t.y, t.w, t.h, 10, '#1f2937', '#e879f9'); E.text('LAB', t.x + t.w / 2, t.y + t.h / 2, { size: 15, weight: '800', color: '#f5d0fe' }); } }
    if (state.lab) drawLab(ctx, E);
    if (state.draft) drawDraft(ctx, E);
    if (state.tent) drawTent(ctx, E);
  },
};

// The end: an epilogue card first when the champion fell, then the end card (your card and theirs, your upgrades, the pit wall when you fell).
const over = {
  enter(E, params) {
    this.p = params; this.page = params.won ? 0 : 1; this.t = 0; this.details = false; this.heard = false;
    E.audio.play(params.won ? 'win' : 'lose');
  },
  update(dt) { this.t += dt; },
  epilogue(ctx, E) {
    const p = this.p, me = p.me, w = Math.min(E.w - 32, 620), h = Math.min(E.h - 40, 230), x = (E.w - w) / 2, y = (E.h - h) / 2;
    E.roundRect(x, y, w, h, 18, '#221a2b', '#ffd24a');
    E.text(`CHAMPION FELLED  \u00b7  ${ARENA[p.arena].name.toUpperCase()}`, E.w / 2, y + 30, { size: 15, weight: '800', color: '#ffd24a' });
    if (p.rivalBeaten) E.text('Rival defeated!', E.w / 2, y + 54, { size: 16, weight: '800', color: '#f87171' });
    E.text(`${me.name}, ${ORIGINS[me.origin].text}.`, E.w / 2, y + h * 0.45, { size: 20, weight: '800', color: '#f0e6cc' });
    wrapPx(ctx, endingOf(p.arena, me, p.fav), w - 40, 17, '700').slice(0, 2).forEach((t, i) => E.text(t, E.w / 2, y + h * 0.45 + 32 + i * 22, { size: 17, weight: '700', color: '#fde68a' }));
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
    ctx.fillStyle = '#5b2160'; ctx.beginPath(); ctx.moveTo(bx, by + bh * 0.62);
    for (let i = 0; i <= 6; i++) ctx.quadraticCurveTo(bx + bw * (i - 0.5) / 6, by + bh * 0.82, bx + bw * i / 6, by + bh * 0.62);
    ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx, by + bh); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e6c866'; ctx.fillRect(bx, by + bh * 0.6, bw, 3);
    const nod = b === 1 ? Math.sin(clamp((t - T.box - T.hand) / T.turn, 0, 1) * Math.PI) * 4 : 0, ex = cx, ey = by + bh * 0.3 + nod;
    ctx.fillStyle = '#c9a27a'; ctx.beginPath(); ctx.arc(ex, ey, bh * 0.12, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#f2f0ea'; ctx.beginPath(); ctx.moveTo(ex - bh * 0.22, by + bh * 0.62); ctx.quadraticCurveTo(ex, ey + bh * 0.05, ex + bh * 0.22, by + bh * 0.62); ctx.fill();
    ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ex, ey - bh * 0.02, bh * 0.13, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
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
    }
    E.text('Tap to continue', cx, y + h - 18, { size: 14, weight: '800', color: '#ffd24a', alpha: t > T.tap ? 0.6 + 0.4 * Math.sin(E.time * 4) : 0.3 });
  },
  render(ctx, E) {
    const p = this.p, g = p.gauntlet, top = E.safe.top + 22;
    if (portrait(E)) { this.btnAgain = this.btnMenu = this.btnDetails = null; rotateCard(ctx, E); return; }
    if (this.page === 0) { this.btnAgain = this.btnMenu = this.btnDetails = null; if (p.arena === 'games') this.thumb(ctx, E); else this.epilogue(ctx, E); return; }
    const last = g[p.reached - 1], me = p.me, by = E.h - 30 - E.safe.bottom;
    E.text(p.won ? 'CHAMPION FELLED' : `Cut down by ${last.name}`, E.w / 2, top, { size: 24, weight: '800', color: p.won ? '#ffd24a' : '#ef4444' });
    E.text(`Reached bout ${p.reached} of ${g.length}${p.grades.length ? `  \u00b7  grades ${p.grades.join(' ')}` : ''}`, E.w / 2, top + 22, { size: 13, color: '#fbbf24' });
    this.btnDetails = E.button(this.details ? 'Hide details' : 'Details', E.w / 2 - 160, by, { w: 150, h: 48, size: 16, fill: '#1f2937' });
    this.btnAgain = E.button('Again', E.w / 2, by, { w: 150, h: 48, size: 18 });
    this.btnMenu = E.button('Menu', E.w / 2 + 160, by, { w: 150, h: 48, size: 18, fill: '#334155' });
    if (this.details) { this.stats(ctx, E, top + 36, by - 32); return; }
    const n = g.length + 1, gap = 8, w = Math.min(150, (E.w - 32 - E.safe.left - E.safe.right - gap * (n - 1)) / n), h = 150, x0 = (E.w - (w * n + gap * (n - 1))) / 2, y0 = top + 36;
    meMini(ctx, E, me, x0, y0, w, h, p.picks);
    g.forEach((d, i) => miniCard(ctx, E, d, x0 + (i + 1) * (w + gap), y0, w, h, p.results[i] || null));
    let y = y0 + h + 14;
    // your upgrades, icon and name
    if (p.picks.length) {
      // every piece as an icon, then as many names as fit at 14 px (highest rarity first: keystones, sets, epics, war paint), then "+N"
      const n = p.picks.length, room = E.w - 32 - E.safe.left - E.safe.right, rank = (id) => (CARD[id].duo ? 2.5 : CARD[id].fam === 'fin' ? 1.5 : CARD[id].tier);
      ctx.font = '800 14px system-ui, sans-serif';
      const lw = ctx.measureText('Gear:').width + 8, ip = Math.min(22, (room - lw) / n), order = p.picks.map((id, i) => i).sort((a2, b2) => rank(p.picks[b2]) - rank(p.picks[a2]) || a2 - b2);
      ctx.font = '600 14px system-ui, sans-serif';
      const tr = room - lw - ip * n - 14, textOf = (k) => `${order.slice(0, k).map((i) => titleOf(CARD[p.picks[i]])).join(', ')}${k < n ? ` +${n - k}` : ''}`;
      let k = n;
      while (k > 0 && ctx.measureText(textOf(k)).width > tr) k--;
      const txt = k ? textOf(k) : '', tw = txt ? ctx.measureText(txt).width + 14 : 0;
      let x = E.w / 2 - (lw + ip * n + tw) / 2;
      E.text('Gear:', x, y, { size: 14, align: 'left', weight: '800', color: '#c4b99a' });
      x += lw;
      p.picks.forEach((id, i) => drawIcon(ctx, id, x + ip * i + ip / 2, y, Math.min(8, ip / 2 - 1)));
      if (txt) E.text(txt, x + ip * n + 14, y, { size: 14, align: 'left', color: '#f0e6cc' });
    } else E.text('No gear picked', E.w / 2, y, { size: 14, color: '#9ca3af' });
    y += 18;
    // the run's gold: what is left (it resets with the run) and what the crowd's style earned, and the tent's wares
    const wn = p.wares.map((id) => WARES.find((q) => q.id === id).name.replace(' {weapon}', '')), gl = `Gold: ${p.gold} left of ${p.goldEarned} earned${wn.length ? `  \u00b7  bought: ${wn.join(', ')}` : ''}`;
    E.text(gl, E.w / 2, y, { size: fitSize(ctx, gl, 12, E.w - 32, '700'), weight: '700', color: '#fbbf24' });
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
      const ending = endingOf(p.arena, me, p.fav);
      E.text(ending, E.w / 2, y, { size: fitSize(ctx, ending, 14, E.w - 32, '700'), weight: '700', color: '#fde68a' });
      if (p.opened) { const t = `Opened: ${p.opened.name}${p.opened.soon ? ' (coming soon)' : `, ${p.opened.place}`}`; E.text(t, E.w / 2, y + 20, { size: 14, weight: '800', color: '#ffd24a' }); }
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
      ['momentum', `${p.momGained} (${p.momSpent} spent)`], ['bleeds', p.bleeds], ['lamings', p.lamings],
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
    if (this.page === 0) { if (this.t > (this.p.arena === 'games' ? TUNING.thumb.tap : 0.5)) { this.page = 1; E.audio.play('tap'); } return; }
    if (this.btnDetails && E.hit(this.btnDetails, p)) { this.details = !this.details; E.audio.play('tap'); }
    else if (this.btnAgain && E.hit(this.btnAgain, p)) E.setScene('roll', { seed: (Math.random() * 2 ** 32) >>> 0, arena: this.p.arena });
    else if (this.btnMenu && E.hit(this.btnMenu, p)) E.setScene('menu');
  },
};

// ====== GAME OBJECT: save, migrate, TUNE presets ======
const STD = { 'hit.minSpeed': 450, 'stamina.regen': 32, 'attack.over.cost': 28, 'shield.perfect': 0.15, 'shield.hits': 4, 'shield.drain': 6, 'open.dur': 0.8, 'swing.windup': 0.7, 'swing.gap': 2.0, 'counter.windup': 0.55, 'dodge.cost': 18 };

export const game = {
  slug: 'arena',
  title: 'Arena',
  saveVersion: 7,
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
    return data;
  },
  TUNING,
  experiments: [
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
  scenes: { menu, arenas: pickArena, roll, play, over },
};
