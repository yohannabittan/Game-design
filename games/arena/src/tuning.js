// Arena: TUNING: every tunable number. It imports nothing, and may be read while modules load.
// Split from game.js by tools/arena-split.mjs (ADR-0024). Only tuning.js and data.js may be read while modules load.


// ====== TUNING: every tunable number ======
export const TUNING = {
  hearts: 6,               // the base for a medium fighter; health is counted in whole hearts, two to the base number (a medium shows 12; step 15 doubled it)
  heal: 1,                 // hearts back for each foe felled
  bouts: 5,                // opponents in the gauntlet
  resetDelay: 0.9,         // seconds after a foe falls before the next intro card
  swayRate: 1.3,           // radians per second of the foe's sway
  // the bout-length setting (a TUNE preset, dev only): x your hearts, his health (pairs and beasts too), the grade's hits allowed (rounded), Bread and
  // Circuses' hearts and the tent's heart ware; damage, stamina, the crowd and finisher costs stay as they are
  boutLength: 1,
  // the sword thumb is a trackpad: gain = hand px per thumb px; guard = the hand at touch-down, from the shoulder (H); the lunge starts and is full at
  // these thumb offsets x gain, in arm lengths; back = seconds to ease to guard on lift; jabCone = cosine of the widest push angle off the guard line that is still a jab
  control: { gain: 1.6, guard: [0.38, -0.08], lungeStart: 1.3, lungeFull: 1.7, back: 0.12, jabCone: 0.68 },
  hand: {
    lag: 0.035,            // seconds of weight in the hand
    regrip: 0.12,          // lag while the hand recovers from a bounce
    tiredLag: 2.4,         // lag multiplier at zero stamina
  },
  arm: { len: 0.45, minFrac: 0.35, full: 0.97, chamberAt: 0.16, straightAt: 0.5 },  // arm in H; finger distance (H) at which the arm is chambered and at which it is straight
  blade: { len: 0.36, pad: 5, jabPad: 10 },   // gladius length in H, hit pad px, the pad px of a jab's striking part (TUNING.strike)
  grip: { straight: -0.25, chamber: -0.6, tau: 0.045, trail: 0.018 },  // blade angle from the arm (radians, up is negative), smoothing, trail per rad/s of arm swing
  // body unit as a fraction of screen height, feet line, clear gap between the bodies (fraction of width), half body width in H; fit = the largest scale
  // drawn at full frame: a bigger fighter (a Giant) shrinks the whole frame so his head stays as high as that scale's would, clear of the HUD
  fighter: { height: 0.72, floor: 0.92, gap: 0.2, body: 0.12, fit: 1.15 },
  // Step 15, the fight camera: the frame at rest is rest x the size above; it zooms out further, to min at most, until it shows both back feet, your
  // blade at full reach (with the lunge) and his weapon's tip, margin px clear of the left column and the screen's edge; it eases to a change over ease s
  camera: { rest: 0.85, min: 0.6, margin: 12, ease: 0.25 },
  // stride in H; extra stamina; seconds to step in and back. The drive: a committed lunge held at full depth for driveNear s (driveFar s when the foe stands beyond your plain lunge's reach as it starts) presses on at drive H/s for
  // driveCost stamina/s (and one jab's cost when it starts moving), up to driveMax H past the stride; it reaches full pace over driveRamp s, in stamping steps driveHz a second whose pace swings by
  // driveSurge; the body leans driveLean rad into it, eases back over driveOut s, each stamp kicks driveSand grains; the stamina it burns glows for driveBurn s;
  // each stamp: a thud at driveThud gain, a haptic of driveHaptic, driveDust puffs driveFoot H behind the foot
  lunge: { stride: 0.3, cost: 10, tauIn: 0.06, tauOut: 0.14, drive: 0.6, driveCost: 25, driveMax: 0.3, driveNear: 0.2, driveFar: 0, driveRamp: 0.1, driveHz: 6, driveSurge: 0.55,
    driveLean: 0.13, driveOut: 0.2, driveSand: 8, driveBurn: 0.5,
    driveThud: 0.45, driveHaptic: 6, driveFoot: 0.1, driveDust: 2 },
  lean: { base: 0.03, max: 0.21, beyond: 0.6, span: 0.2, fast: 0.7, tau: 0.06, back: 0.05 },  // radians (max = 12 degrees); aim distance (H) past which a fast slash leans, over span; fast = fraction of hit.mid
  // Step 24c, a planted overhead: leanBack = the most you lean back (rad) while your hand is above the overhead line; lead = the blade's angle ahead of
  // the arm (rad) as an overhead comes down, with the arm's reach set so the middle of its striking part comes down on his head; tau = s it eases in
  over: { leanBack: 0.035, lead: 0.1, tau: 0.03 },
  dodge: { dur: 0.35, back: 0.32, hop: 0.1, cost: 12, cool: 0.2, drain: 14 },  // dur: a tap's sidestep; a hold stays back and drains stamina per second
  hit: { minSpeed: 400, mid: 950, cool: 0.2 },   // tip px/s: slash threshold, slash damage 2; seconds before a part can be hit again
  attack: {
    jab: { cost: 8, minSpeed: 520, dmg: 2, recoil: 0.18, dents: 1 },  // dents: a crush jab's (step 21)
    slash: { cost: 14, dmg: 1, fastDmg: 2, recoil: 0.5, dents: 1 },
    // raise: the hand this far (H) above the guard (about the top of your head); window: seconds it counts after; down: the stroke's downward share that makes it a chop
    over: { cost: 20, minSpeed: 520, dmg: 3, recoil: 0.7, dents: 2, raise: 0.14, window: 0.8, down: 0.25 },
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
  // juice (principle 16). Hit-stops (s); shake = x every shake, shakeOn = 0 turns shake off (the engine does not expose the system's
  // reduced motion). A slot hit: its hit-stop and ring (px). A fell: s of slow motion at fellMul game speed, the camera punching in by fellZoom
  // over zoomIn s, dust as he drops (dropAt s after, dropDust motes). A perfect block: its white ring (px) and tiny shake (px). A feint read: the violet
  // burst off him. A lunge: dust at your back foot. A dodge: s of ghost trail, one ghost each ghostEvery s, sand scuff motes. A finisher: s of slow motion
  // at finMul, the banner's s, the war paint's glow s. A Giant (scale giantAt and up) thuds each giantStep H he walks, with a shake (px). Getting hit:
  // your recoil (radians of lean back) and the heart's shatter (s).
  juice: { stop1: 0.04, stop2: 0.07, stop3: 0.1, stopBreak: 0.05, stopClang: 0.03, shake: 0.5, shakeOn: 1,
    slotStop: 0.06, slotRing: 34, fellSlow: 1, fellMul: 0.35, fellZoom: 0.06, zoomIn: 0.2, dropAt: 0.35, dropDust: 18,
    perfRing: 150, perfShake: 2, readBurst: 28, lungeDust: 7, ghost: 0.22, ghostEvery: 0.05, scuff: 7, finSlow: 0.35, finMul: 0.4, banner: 0.9, paint: 1.2,
    giantAt: 1.25, giantStep: 0.12, giantShake: 1.5, recoil: 0.14, shatter: 0.6,
    // a beast: its roar on the tell (gain), the sand its pounce sprays from its hind feet (motes), the bear's maul landing (a thud x, a shake px)
    roar: 0.12, sand: 22, maulThud: 1.7, maulShake: 4,
    // blood from a hit on bare skin or in a gap (a plate or a block throws sparks): drops, plus perDmg a heart of damage, at most max; a slot hit's extra,
    // a limb downed; the drops' speed (px/s) and spread (radians) along the blow, and the red flash's radius (px)
    blood: { drops: 8, perDmg: 6, max: 34, slot: 14, down: 26, speed: 330, spread: 1.1, flash: 20 },
    // a hit's damage number (step 9a): px from min at 1 to max at top and up, drawn up px above the hit, rising rise px over life s; a number that would
    // cross his face (his head's radius x face) is lifted gap px above his head
    num: { min: 15, max: 32, top: 6, up: 18, rise: 12, life: 0.6, face: 1.35, gap: 4 } },
  foe: { swayX: 0.05, swayDeg: 3, kick: 0.9, hp: 22, tierHp: 0.1, champHp: 1.15, dmgCap: 3, coverShield: 0.2, coverGuard: 0.1, jabRun: 3, jabRead: 0.05 },  // hp scaled by size and tier; dmgCap: most hearts one blow takes; cover radii (H) with and without a shield
  // (step 23: from bout 2 on, after jabRun of your jabs in a row met his guard, his guard is over the next jab's mark jabRead s after it starts)
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
    // Step 16, barding (the Colosseum's arenas.*.armour bouts): each piece's part, a plate like a man's with the beast's gaps open round it, broken by
    // dents blows (a man's TUNING.armour.dents); its painting is beastArt.armour
    armour: { plates: { head: 'head', chest: 'chest', back: 'belly', leg: 'legF' }, dents: 3 },
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
  // biting his feint (step 10): a dodge begun while his fake shows is a stumble; your dodge locked lock s, the real blow's tell left x wind, the hint's s
  feintBite: { lock: 0.8, wind: 0.6, cap: 4, lean: 0.5 },
  openWin: { dur: 0.15, slow: 0.25 },  // when he is winded: seconds of slow time, and the game speed during it
  // your rolled fighter. Wheels: [value, weight, tier name]. Per size band: arm reach multiplier, hearts, hand lag (swing speed) multiplier and tier score
  // (your scale and damage follow TUNING.sizes, like his). Per stat value 1-5: Strength damage, Speed hand lag / recoil and dodge length, Stamina bar and regen.
  // Armour: the plates you bought (step 11, by the slot) set your stamina regen by their count.
  me: {
    wheels: {
      size: [['runt', 7, 'Runt'], ['lean', 22, 'Lean'], ['medium', 38, 'Medium'], ['big', 25, 'Big'], ['giant', 8, 'Giant']],
      stat: [[1, 8, 'Feeble'], [2, 20, 'Fair'], [3, 34, 'Solid'], [4, 26, 'Strong'], [5, 12, 'Mighty']],  // the B-tier wheel; statTiers holds every tier's weights
      // armour and weapon are no longer spun (step 9a: the purse buys them); their order is the saved index, so 'none' and 'fist' come last
      armour: [['light', 35, 'Light'], ['medium', 45, 'Medium'], ['heavy', 20, 'Heavy'], ['none', 0, 'None']],
      weapon: [['gladius', 35, 'Gladius', 'GL'], ['spear', 25, 'Spear', 'SP'], ['axe', 20, 'Axe/mace', 'AX'], ['dagger', 20, 'Dagger', 'DG'], ['trident', 20, 'Trident', 'TR'], ['sica', 20, 'Sica', 'SI'], ['fist', 0, 'Fists', 'FI']],
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
      runt: { name: 'RUNT', arm: 0.9, hearts: 4, lag: 0.75, score: 0 },
      lean: { name: 'LEAN', arm: 0.95, hearts: 5, lag: 0.85, score: 0.25 },
      medium: { name: 'MEDIUM', arm: 1, hearts: 6, lag: 1, score: 0.5 },
      big: { name: 'BIG', arm: 1.05, hearts: 7, lag: 1.15, score: 0.75 },
      giant: { name: 'GIANT', arm: 1.1, hearts: 9, lag: 1.3, score: 1 },
    },
    str: [0.75, 0.9, 1, 1.15, 1.3],
    spdLag: [1.35, 1.15, 1, 0.88, 0.76], spdDodge: [0.8, 0.9, 1, 1.12, 1.25],
    staMax: [70, 85, 100, 115, 130], staRegen: [0.8, 0.9, 1, 1.1, 1.2],
    // stamina regen by the plates you bought: plateSets names the band for 0, 1, 2 and 3 or more (step 11). n and arm: the old rolled sets' plates,
    // read only by a save from before (migrate)
    plateSets: ['none', 'light', 'medium', 'heavy'],
    armour: {
      light: { name: 'LIGHT', n: 1, regen: 1 },
      medium: { name: 'MEDIUM', n: 2, regen: 0.92 },
      heavy: { name: 'HEAVY', n: 3, regen: 0.82, arm: true },
      none: { name: 'NO', n: 0, regen: 1 },
    },
    plateDiv: 2,                          // a hit on a plated part costs the hit divided by this, rounded up, so never part of a heart
    tiers: [['S', 12.5], ['A', 10.5], ['B', 8.5], ['C', 6.5], ['D', -1]],  // score = STR + SPD + STA + size: the body only (step 9a; each cut is the old one less a medium armour's 0.5)
    underdog: 6.5, underdogHalves: 1,     // a score below this gets +1 heart
    heartsPerBase: 2,                     // a size's base hearts times this is its whole hearts (a medium's 6 shows 12)
    // your weapon: reach = blade length, speed divides hand lag and recoil, dmg and cost multiply every blow (how each part of it hits: TUNING.strike),
    // slot = slot-hit multiplier, slotDmg = what multiplies a slot hit in place of dmg (the dagger's slot hits are 4x a bare jab, so 1.33x the gladius's),
    // overBreak = dents at which an overhead breaks a plate (0: the usual armour.dents), noDent: its slashes and smashes never dent a plate
    weapons: {
      // fists (step 11): free, very fast, half the damage (step 21: they crush, so a stab into a gap is a plain hit)
      // (Step 14: a fist's swing glow is glow H round the fist, its jab spark knuckle H past it, art only)
      fist: { name: 'FISTS', reach: 0.5, speed: 1.6, dmg: 0.5, cost: 1, slot: 2, slotDmg: 0.5, overBreak: 0, noDent: true, glow: 0.05, knuckle: 0.035 },
      gladius: { name: 'GLADIUS', reach: 1, speed: 1, dmg: 1, cost: 1, slot: 3, slotDmg: 1, overBreak: 0 },
      spear: { name: 'SPEAR', reach: 1.35, speed: 0.85, dmg: 1, cost: 1, slot: 3, slotDmg: 1, overBreak: 0 },
      axe: { name: 'AXE', alt: 'MACE', reach: 0.9, speed: 0.75, dmg: 1.7, cost: 1.4, slot: 3, slotDmg: 1.7, overBreak: 2 },
      dagger: { name: 'DAGGER', reach: 0.65, speed: 1.4, dmg: 0.75, cost: 1, slot: 4, slotDmg: 1, overBreak: 0 },
      // the ludus's armoury (len: the length drawn on your card, H). The trident: the longest reach and the slowest hand, weak slashes, its net cast by
      // your first perfect block each bout (net). The sica: short and quick, its curved edge makes every slash cut deep.
      trident: { name: 'TRIDENT & NET', reach: 1.5, speed: 0.8, dmg: 1, cost: 1.1, slot: 3, slotDmg: 1.15, overBreak: 0, net: true, len: 0.8 },
      sica: { name: 'SICA', reach: 0.8, speed: 1.2, dmg: 1, cost: 1, slot: 3, slotDmg: 1, overBreak: 0, len: 0.3 },
    },
    // your net (the trident): it holds him dur s, his wind-ups wind x longer, his footwork at step x its speed
    net: { dur: 3, wind: 0.3, step: 0.5 },
  },
  // fame, kept for good (E): a champion felled, an arena's first clear, the Emperor's thumbs up, bout fame for every bout won (a lost run too), and 1 for each goldPer gold left when a run ends
  fame: { champ: 10, clear: 25, thumbUp: 10, goldPer: 50, bout: 3 },
  // Brutus's ludus: each unlock's price in fame (the vault's six family scrolls too); the Wall of Champions keeps the newest wallMax fighters; a veteran gains vetUp on one stat
  ludus: { price: { trident: 30, sica: 30, sparta: 25, egypt: 25, circus: 25, trick: 40, show: 40, slot: 60, fourth: 50, promise: 30, crest: 15, plume: 15, paint: 15, cloak: 20,
    'vault-wall': 45, 'vault-blood': 45, 'vault-dancer': 45, 'vault-brute': 45, 'vault-trick': 45, 'vault-show': 45 },
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
  // Step 17, Old Brutus's five story cards: dur = each scene's s; autoGap = s after a scene before the card goes on by itself; tapGap = s a card ignores a
  // second tap; skip = the Skip plaque (px); back = each card's backdrop; kit = the plates on after each drop (card 2), drops = when each piece lands (s);
  // bowed = the head's tip (rad, - bows it) and the arms' two angles off hanging; hang = the hanging gladius's angle (rad); spin = the first wheel's
  // start and the gap between wheels (s); lit = when each plaque lights (s); champ = the bust behind the fifth; gate = s the gate takes to rise on the menu
  story: { debt: 1000, debtPer: 200, chant: { gain: 0.08, step: 0.04, gap: 0.24, max: 5 },
    dur: [3, 3.6, 3.9, 3.2, 4], autoGap: 1, tapGap: 0.25, skip: [96, 44], back: ['pit', 'pit', 'city', 'pit', 'rome'],
    kit: [[], ['head'], ['head', 'chest', 'belly'], ['head', 'chest', 'belly', 'legs']], drops: [0.7, 1.2, 1.7, 2.2],
    bowed: { chin: -0.42, near: [0.12, 0.04], far: [-0.08, -0.04] }, hang: -0.45, spin: [0.25, 0.7], lit: [0.3, 0.65, 1.0, 1.35, 1.9], champ: 'marcus', gate: 0.7 },
  // the one token per run: a Respin on your fighter card or a Reroll on a draft
  token: 1,
  hint: { bouts: 2, dur: 10, heartDur: 6, driveDur: 6, hudDur: 8, spamDur: 6 },  // the in-play hint shows in this many bouts ever, for this many seconds of each; heartDur, driveDur: the heart hint after your first fell, the drive hint after your first missed lunge
  // Step 20: your hearts are one heart (size px) that drains like a glass, and the count beside it (num px); a hit shakes it (shake px for hit s) and
  // flashes the count red, a heal pulses it green (heal s)
  hud: { size: 26, num: 18, shake: 4, hit: 0.45, heal: 0.6, bout: 17, crowdH: 15, crowdW: 0.82 },  // bout: the BOUT line's size; crowdH, crowdW: the crowd bar's height and its share of the left strip
  // footwork, in H. Yours: a tap of DODGE is the backstep (back x your Speed's dodge length), holding it keeps backing off at walkBack; a lunge's recovery
  // takes back up to pace of the ground you gave, over gainDur s, never past your mark; drift: idle for idle s (no swing, dodge or lunge) you drift back a pace per secs s. Speeds are H per second. close: nearest clear gap between the bodies.
  // room: the most each fighter can give ground before the wall (yours, his), trimmed to the screen; margin: px kept clear at the screen edge.
  // His: walk speed (x Speed and size), commit = speed share while winding up, reach = how far past his striking distance a blow still lands, push = a pace share.
// He commits only with your body (feet plus lunge) inside his striking distance plus reach. A blow that then falls short counts as your dodge when your body gave
// at least give H during his tell. After a lunge launched from beyond his reach he chases for chase s at chaseV x his walk, and strikes within chaseSwing s.
  // the left column: width as a fraction of screen width (never under minW), gap between buttons, top of the column below the safe top, DODGE height (fraction of screen height, never under dodgeMinH), touch reach past a drawn edge, and how much of the way the fighters' frame slides toward the middle of the space the column leaves
  col: { frac: 0.22, minW: 96, gap: 6, top: 70, dodgeFrac: 0.17, dodgeMinH: 64, reach: 8, frame: 0.75 },
  foot: { pace: 0.14, drift: { idle: 0.6, secs: 1.5 }, gainDur: 0.16, back: 0.2, walkBack: 0.42, close: 0.1, room: [0.6, 0.7], margin: 22, foeV: 0.75, commit: 0.3, reach: 0.12, push: 0.5, wallMsg: 0.9, give: 0.02, chase: 1.0, chaseV: 1.6, chaseSwing: 0.5 },
  // the bout's grade: a grade is met by any of its rungs, each allowing up to `taken` hits this bout (a pair bout allows `pair` more) with at least `good`
  // good moves (gap hits, fakes read, punishes, perfect blocks, swings dodged, limbs lamed, shield bashes that land)
  grade: { S: [{ taken: 0, good: 3 }], A: [{ taken: 2, good: 4 }], B: [{ taken: 4, good: 0 }], pair: 1 },
  // the draft: cards dealt (the last is priced), weights per grade for the free cards (common, rare), how many free cards a grade makes sure are rare, the
  // pull on a family you wear, at most perFam cards of one family a draft; the priced slot's cascade, each tier's own chance (a set bonus you qualify for,
  // else a legendary, else an epic, else a rare);
  // prices by rarity (common, rare, epic, legendary) and a set's; delay before a pick counts (s). Step 9, by the bout just won (its gauntlet row, 1 to 5):
  // boutEpic = each free card's chance to be an epic, sureEpic = from this bout an S makes one free card a sure epic, boutLegend = the cascade's legendary chance
  draft: { deal: 3, odds: { S: [0, 100], A: [35, 65], B: [55, 45], C: [75, 25] }, sure: { A: 1 }, pull: 3, perFam: 2, cascade: { set: 0.6, legend: 0.15, epic: 0.3 }, price: [0, 30, 45, 60], duoPrice: 50, delay: 0.45,
    boutEpic: { 3: 0.1, 4: 0.2 }, sureEpic: 3, boutLegend: { 4: 0.3 },
    // Step 19: Skip takes no card and pays gold, skip[0] after bout 1 rising evenly to skip[1] for the last draft; its button's w x h px
    skip: [10, 20], skipBtn: [112, 48],
    // Step 23: a tapped card lifts for lift s, then flies to the doll for fly s in all; a press held long s shows the card's full line; an unaffordable
    // gold card shakes for shake s by shakePx; the doll in the corner is doll px tall
    lift: 0.12, fly: 0.4, long: 0.4, shake: 0.4, shakePx: 7, doll: 50 },
  // Step 23, the training yard before the first run's bout 1: jabs (that land), slashes, overheads and lunges to do; move = px the sword thumb travels
  // in step 1; wind = s each scripted blow winds up, gap = s between them; hold = s past a dodge's length that DODGE is held; next = s the tick shows
  // before the next step; go = s "Now fight." shows. spam: jabs in a row with no other move before Brutus's nudge, in the first spamRuns runs.
  // ghost: the ghost thumb's loop (s), its size (px w x h) and alpha, and where the sword thumb's ghost touches (x the screen's width, height)
  // Step 23b. path: the ghost's paths, fitted to the fight: reach = the most a stroke's hand aim strays from the guard (arm lengths, short of a
  // lunge), lunge = a lunge's push (arm lengths), chamber = how near the shoulder a jab is drawn in first (H), over = how far (H, his) above his head the
  // overhead's tip starts, up = the least the hand rises above the raise line (H), through = the chop's follow-through past his head (H, his),
  // slash = where the slash starts and ends on him (his H above his feet, near then far side), front = a jab's point on his chest, its front (his H
  // toward you from the middle), tip = the dotted trail's dots;
  // why = s between two "why it didn't count" words, slow = a stroke too slow to count: tip px/s and the least H it travels; field = the export's
  // characters per yard field (the ledger keeps 80). Step 24: knife = practice knives the knife step gives (not your own)
  train: { jabIn: 0.1, jabs: 2, slashes: 2, overs: 1, lunges: 1, perfects: 1, knife: 1, move: 60, wind: 1.6, gap: 0.9, hold: 0.05, next: 0.8, go: 1.2, spam: 6, spamRuns: 2,
    ghost: { loop: 1.6, w: 30, h: 40, alpha: 0.55, at: [0.58, 0.8] },
    path: { reach: 1.1, lunge: 1.85, chamber: 0.2, over: 0.3, up: 0.06, through: 0.12, slash: [0.88, 0.3, 0.06, -0.06], front: 0.1, tip: 9 },
    why: 0.7, slow: { sp: 200, len: 0.25 }, field: 80 },
  // gold, per run: a fell, each feint read, perfect block and slot hit in the bout, and a bout with no hits taken
  gold: { fell: 20, read: 4, perfect: 2, slot: 2, clean: 15 },
  // the armourer's tent, once a run after bout `after`: big wares and cheap ones (the old commons) shown, each ware's price; forge = your weapon's damage x;
  // bandage = gold for each heart healed before the champion's bout
  // nudge: below this share of your hearts at the bandages before the champion, Brutus says so and the bandage row glows
  tent: { after: 3, big: 2, small: 1, forge: 1.25, heart: 2, bandage: 15, nudge: 0.5,
    price: { plate: 40, whet: 50, heart: 35, token: 25, forge: 60, hide: 15, wind: 15, wrist: 12, steady: 12, grip: 12, feet: 15, deepbreath: 15, edge: 20, tough: 15, stance: 12 } },
  // the starting purse (step 9a; step 11: fists free, kit by the slot): gold per arena, then each weapon's price (the axe and the mace are two buys; the
  // trident and the sica once the ludus has them) and each plate's, in the armourer's tent before bout 1; hint = purses with the first-run hint
  purse: { gold: { pit: 45, city: 45, rome: 45, games: 45 }, weapon: { fist: 0, gladius: 15, spear: 15, dagger: 15, sica: 15, axe: 20, mace: 20, trident: 20 },
    plate: { helmet: 10, chest: 15, manica: 10, greaves: 10 }, hint: 1,
    // Step 24: the Arms slot's plate is a reinforced shield: x its blows before it breaks (never with two blades)
    reinforce: 1.5,
    // step 23: the first run's purse opens with this kit chosen
    first: { w: 'gladius', kit: ['chest'] } },
  // Step 22, the sidearm: a second weapon on your belt, bought in the purse's Sidearm slot at its weapon's price. swap = s the ⇄ swap takes, with no
  // block and no swing; punish = s at most before his next blow when you start one within his reach; btn = the round buttons' radius and gap (px),
  // bottom right. His (foe): his chance per arena of a sidearm (never a champion's, a rival's or two blades'), which weapon carries which, and the gap
  // (H, past his size's reach) at which he draws it (near) and goes back to his long weapon (far); swap = s he holds off a blow while he swaps
  // hip: where the inventory doll wears it (body units right of and below its middle, its lean in rad, its scale)
  sidearm: { swap: 0.5, punish: 0.35, btn: { r: 26, gap: 10 }, hip: [0.06, -0.5, 0.45, 0.8],
    foe: { chance: { pit: 0, city: 0.3, rome: 0.35, games: 0.4 }, carry: { spear: 'gladius' }, near: 0.12, far: 0.3, swap: 0.5 } },
  // Step 22, throwing knives: a consumable bought one at a time (price gold) in the purse, the tent and the bandage stall, at most max carried, kept
  // for the run. aim = s to raise the knife (open: no block, no swing) before a release throws it; lift = px the aim point sits above the thumb;
  // speed = flight in H per s; dmg = a knife in a gap; pad = px of give round a part; len = the knife's drawn length (H); fall = s a spent knife
  // lies in the sand; row = the Knives row's height and its - and + buttons' width (px)
  // Step 22b: drag = px the aiming thumb must travel from where it went down before its release throws (less is a tap, which only moves the aim);
  // snap = px from a gap's edge within which the aim snaps onto the gap (0: off); ring = the aim ring's radius (px); rest = where the ring sits
  // before a thumb is down (H above his feet); raise = where your hand holds the raised knife (H from the shoulder, forward and down), held = its drawn size there (x len);
  // glow = his open gaps' fill alpha and blur (px) while a knife is up; ghost = where the first-knife lesson's ghost thumb starts its drag (x the
  // screen's width, y its height)
  knives: { price: 8, max: 6, aim: 0.25, lift: 50, speed: 5, dmg: 5, pad: 4, len: 0.13, fall: 1.2, row: [44, 44],
    drag: 20, snap: 14, ring: 10, rest: 0.6, raise: [-0.06, -0.3], held: 1.4, glow: [0.4, 22], ghost: [0.56, 0.84] },
  // Step 24, the bow: a sidearm bought in the purse's Sidearm slot at price gold. swap = s the swap to it or back takes (no block, no swing), the shield
  // going to your back (or back to your arm) and the blade away (or back) halfway. While it is out the right thumb works it: down starts the draw, full
  // after draw s; a release sooner looses nothing (TOO SOON) and the draw starts again. Held on to full s the arrow flies and hits up to power x
  // harder. speed = its flight (H per s); gap = x the ordinary gap hit (a gladius jab's in a gap, at your Strength); skin = its damage on bare skin,
  // with a stagger; rush = x his step while it is out (he closes to striking distance), pounce = s at most to a beast's next blow once it is up.
  // The look: follow = s the arm stays out toward the ring after a loose; len = the bow tip to tip (H); rest = the hand's place with no thumb down (H from the shoulder, forward and down); ring = the aim ring's
  // radius at the draw's start and at full power (px); fall = s a spent arrow lies in the sand; back = where the slung shield sits on your back
  // (body units from your feet), its radius (H), its turn (rad) and its squash across; hip = where the put-away blade hangs (body units, its lean
  // back in rad, its scale); the painted bow (Pack 29): its canvas, the grip pin, the
  // string's ends at rest and drawn, the drawn point's x (on the grip's row), the rest-to-drawn crossfade (share of the draw); the arrow's canvas,
  // its nock and tip, and x its thickness drawn
  bow: { price: 20, swap: 0.7, draw: 0.6, full: 1.2, power: 1.3, speed: 9, gap: 2, skin: 1, rush: 1.8, pounce: 0.6, follow: 0.3,
    len: 0.55, rest: [0.28, 0.16], ring: [16, 8], fall: 1.2, back: [-0.14, -0.62, 0.15, 0.25, 0.42], hip: [-0.1, -0.52, 0.75, 0.8],
    art: { size: [454, 1024], grip: [397, 514], rest: [[302, 38], [302, 987]], drawn: [[173, 38], [175, 987]], nock: 44, fade: [0.25, 0.7] },
    arrow: { size: [410, 32], nock: [0, 12], tip: [409, 14], thick: 1.8 } },
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
  // Step 9, the vault. Epics: bulwark = blocks in a row (no hit taken between) that wind him for bulwarkWind s, letter = his bleeding's length x, shadowWin = s
  // after a tell dodge your next blow goes through his guard, crusher = a fast slash's dents x on a plate, smoke = his stamina bar's share a fooling Feint drains,
  // gildedAt = crowd for the free finisher. Legendaries, per card of their family worn: phalanx = the well-timed window +x, tide = most hearts healed,
  // windDodge = the dodge's length +x, windOpen = his open window +x after a blow that misses, colossus = hearts, colossusOver = smash damage +x,
  // deceiveFake = his fake's tell shown this share of its wind-up sooner (at most deceiveMax), deceiveOpen = your Feint's gap +x, idolFav = crowd gained +x,
  // idolGold = the crowd's gold +x. Sets: counterWin = s after a block a dodge is free, anvilWin = s after a perfect block the smash breaks, cuts = stacks,
  // cutsWin = s after a backstep, lie = stacks, acrobat = favour, spectacle = favour, illusion = read favour x, illusionGold = gold a read.
  cards: {
    hide: 1, wind: 1.2, wrist: 0.8, steady: 0.75, grip: 1.2, feet: 1.25, deepbreath: 1.2, edge: 1, tough: 2,
    shove: 2, shoveStun: 1, thorns: 3, thornsDur: 4,
    serrated: 1, rend: 1, vein: 1.2, bloodlust: 2, cruel: 1,
    sidestep: 1, matador: 1, slip: 2, slipWin: 1, untouch: 1,
    heavy: 2, brawler: 2, jugg: 0.5, titan: 4,
    misdir: 2, mind: 1, bait: 2, baitHold: 0.5, baitWin: 3, bluff: 1, bluffWin: 1.5, puppet: 3, puppetHearts: 8,
    flourish: 6, showboat: 0.5, play: 2, bread: 2, breadAt: 80, breadCoins: 3, mulMax: 4, encore: 1, pleaser: 3, pleaserCost: 30, aweAt: 90, awe: 0.7, darlingGold: 0.5,
    cape: 2, capeStun: 1, butcher: 2, spiked: 1, hamWin: 1, sucker: 1.2, bloodSport: 0.5, salute: 1,
    fist: 1, braced: 1,
    bulwark: 3, bulwarkWind: 1.5, letter: 2, shadowWin: 2, crusher: 2, smoke: 0.3, gildedAt: 90,
    phalanx: 0.15, tide: 3, windDodge: 0.15, windOpen: 0.25, colossus: 1, colossusOver: 0.15, deceiveFake: 0.1, deceiveMax: 0.5, deceiveOpen: 0.25, idolFav: 0.15, idolGold: 0.15,
    counterWin: 1, anvilWin: 3, cuts: 1, cutsWin: 1, lie: 1, acrobat: 6, spectacle: 30, illusion: 2, illusionGold: 3,
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
  // Step 21, how each weapon hits (you and every foe alike). Each part of a weapon that strikes, for a jab and for a swing (a slash or an overhead): its
  // rows on its Pack 23 painting (the axe's on Pack 28's; fists on a scale of pin rows from knuckle to wrist), its kinds and its damage multiplier.
  // Anywhere else on the weapon is the haft: a thud (thud x the blow, a little push of push paces, no gap bonus, no bleed, no dent).
  // cut: bare skin bleeds (bleed stacks a cut, kept as a part until whole), a plate dents only dent x; pierce: a jab into a gap is the gap hit, a plate never
  // dents; crush: dents a plate fully (fists never dent), and every stagger-th crush that lands, plate or flesh, staggers him. hook (the sica): its cuts bleed
  // hook.bleed x and pull him in hook.pull H. wide (the trident): its jab's pad and slit tolerance x wide. flash: s a clean hit lights its part (painted
  // in its kind's colour at flashA[0], then brightened at flashA[1]); his
  // blows: his point passes you by his striking distance less the gap, and the part that lands is the one that far down his weapon
  strike: {
    thud: 0.25, push: 0.25, flash: 0.22, flashA: [0.8, 0.5],
    cut: { bleed: 0.5, dent: 0.5 }, crush: { stagger: 3 }, hook: { bleed: 2, pull: 0.04 },
    gladius: { jab: [[0, 96, 'pierce', 1], [96, 360, 'cut', 0.5]], swing: [[0, 360, 'cut', 1]] },
    dagger: { jab: [[0, 80, 'pierce', 1], [80, 205, 'cut', 0.5]], swing: [[0, 205, 'cut', 1]] },
    spear: { jab: [[0, 224, 'pierce', 1]], swing: [[0, 224, 'cut', 0.6]] },
    trident: { jab: [[0, 256, 'pierce', 1]], swing: [[0, 256, 'pierce', 0.5]], wide: 1.6 },
    sica: { jab: [], swing: [[0, 408, 'cut', 1.2]], hook: true },
    axe: { jab: [[7, 111, 'pierce', 1], [111, 368, 'crush', 0.5]], swing: [[80, 368, 'cut crush', 1], [7, 80, 'pierce', 0.5]] },
    mace: { jab: [[0, 224, 'crush', 1]], swing: [[0, 224, 'crush', 1]] },
    fist: { pin: 100, jab: [[0, 100, 'crush', 1]], swing: [[0, 100, 'crush', 1]] },
    // the rack's and the Weapon slot's look: each kind's colour (cut along the edges, pierce at the point, crush on the head), its tint's alpha, the
    // edge line (x the blade's half width) and the haft's alpha; each weapon's edges that cut (TUNING.kit.weapon edges, by index)
    col: { cut: '#ef4444', pierce: '#fbbf24', crush: '#7cb4f0' }, tint: 0.5, cutTint: 0.22, edgeW: 0.35, haftA: 0.4,
    edges: { gladius: [0, 1], dagger: [0, 1], spear: [0, 1], sica: [0], axe: [0] }, slotH: 26,  // slotH: the lit painting's most px across in the Weapon slot
  },
  // each arena's foes: shift = stat levels added to every bout's centre, feint = x his feint weight, guard = added to the chance of a first and a second
  // gap guard (never in bout 1), gear = pieces added to each foe's; ring = x the distance to both walls; pairs = the bout index (0-based) pairs start at.
  // Step 15: size = x each band's roll weight (runt, lean, medium, big, giant), so later foes lean big; plates = plates added to each man's set.
  // Step 18: dual = each man's chance (never a champion's) of two blades, when his weapon is one (TUNING.dual.weapons)
  // Step 16: pairs may instead list the bouts that are pairs; beasts: the bouts (0-based) a beast fights, young: those of them that bring a young one,
  // armour: those of them whose beast wears barding (TUNING.beasts.armour)
  arenas: {
    pit: { shift: 0, feint: 1, guard: [0, 0], gear: 0, ring: 0.7, pairs: 99, size: [1, 1, 1, 1, 1], plates: 0, dual: 0 },
    city: { shift: 0.4, feint: 1.15, guard: [0.1, 0.05], gear: 0, ring: 1, pairs: 2, size: [0.5, 0.8, 1, 1.5, 1.5], plates: 0, dual: 0.2 },
    rome: { shift: 0.7, feint: 1.25, guard: [0.15, 0.1], gear: 1, ring: 1, pairs: [2], size: [0.4, 0.7, 1, 1.8, 1.8], plates: 1, dual: 0.25, beasts: [1, 3], young: [1], armour: [1, 3] },
    games: { shift: 0.9, feint: 1.35, guard: [0.2, 0.1], gear: 1, ring: 1, pairs: 99, size: [0.3, 0.6, 1, 2, 2], plates: 1, dual: 0.3 },
  },
  // x every foe's health by arena (men, beasts, pairs, champions; step 10), on top of the bout length
  arenaHp: { pit: 1, city: 1.25, rome: 1.5, games: 1.75 },
  // the City's pairs: the waiting foe drawn at scale x his size and alpha, his centre x from the screen's edge (in his H), his body's half width (body, in his H);
  // the fighters' frame slides left until the one fighting stays clear of him (room = H his wall gives the one fighting past his mark, fbody = his half width in
  // his H); taunt = s his bubble shows before he steps in; enter = s before the one who steps in may swing; hp = x each pair foe's health
  pairs: { scale: 0.6, alpha: 0.6, x: 0.3, body: 0.2, room: 0.1, fbody: 0.22, taunt: 0.5, enter: 1.2, hp: 1, beastScale: 0.6, heal: 2 },  // beastScale: the waiting one's scale when a beast is in the pair; heal = hearts back when the first of a pair falls
  // the crowd's favour, 0 to max, carried through the run: what each style event gives (a feint read, a perfect block, a slot hit, a laming, a bout with
  // no hits taken, two of your hits within comboWin s, a finisher), what turtling (his turtle read's measure) and backing off with no blow coming drain
  // per second; with nothing stylish for idle s the meter drains drain of itself per second (0.03: a high meter eases down, a low one barely moves); coins arc in from the stands at each step of favour; the Emperor's
  // thumb reads the average of the meter over the champion's bout, by thirds (bands)
  crowd: { max: 100, read: 5, perfect: 2.5, slot: 2.5, lame: 2.5, clean: 5, combo: 1, fin: 1, comboWin: 1, turtle: 4, back: 6, idle: 3, drain: 0.02, pay: 0.5, hintDur: 6, step: 20, coins: 5, coinCap: 15, bands: [1 / 3, 2 / 3] },
  // the champions' own: Carpophorus sends in his lion when his health falls to send x his own; Mevia's spear also throws a net (its weight).
  // Step 18, the signature moves (sig): each one waits every exchanges after the last (and from the bout's start), then takes an exchange at chance;
  // its name is a banner the first time in a bout. Wind-ups are x the base wind-up (TUNING.swing.windup, by his weapon, size and Speed).
  // Marcus's Red Rage, below below x his health: a roar of roar s (a red flush, a stamp at its end), then HIGH, MID, LOW at wind each; all three
  // blocked: winded s. Varro's Capuan Feint: two fake wind-ups (fakes: each one's wind, the second quicker), each ending in hes s of violet
  // hesitation, then the real blow at real; that one blocked: winded s. Hermes's Blink: he drops low and blurs for crouch of a wind tell, dashes in
  // from start H past his home and as far as leap H to close H from you (whatever his weapon), strikes and darts back (back s); a well-timed block on the dash: off balance (winded off s). Mevia's Huntress's Throw,
  // from range H out or more: the spear drawn back over her shoulder for wind (turning grip rad in her fist), flying for flight s, dmg if it lands;
  // dodged or blocked, she is unarmed for unarmed s (it sticks in the sand at stuck rad); she fights with her dagger until she picks it up pick s after the throw. Aquila's Two Blades, at
  // at x his health: the Emperor signals for signal s (the shield thrown aside at toss of it), then a second gladius, no shield, his guards and his
  // shield arm's plate off; his combos weigh combo x and come at two heights at once, wound up fast x quicker. The tells drawn: the roar rears Marcus
  // back rear rad; Hermes drops low H and leans lean rad, his ghosts blur[0] H either side at alpha blur[1]; the Emperor's box is box[0] x box[1] px,
  // box[2] px under the safe top.
  champs: {
    carpophorus: { send: 0.5 },
    mevia: { net: 2.4, sig: 'throw', every: 1, chance: 0.6, sure: 3, range: 0.25, wind: 1.15, grip: 2.4, flight: 0.28, dmg: 2, unarmed: 3, pick: 8, stuck: 1.1 },
    marcus: { sig: 'rage', below: 0.9, every: 1, chance: 0.6, sure: 3, roar: 0.8, wind: 0.85, winded: 2.2, rear: 0.14 },
    varro: { sig: 'capuan', every: 1, chance: 0.6, sure: 3, fakes: [0.8, 0.5], hes: 0.2, real: 0.8, winded: 2 },
    hermes: { sig: 'blink', every: 1, chance: 0.6, sure: 3, wind: 1.2, crouch: 0.6, leap: 0.7, start: 0.25, close: -0.1, back: 0.9, off: 2, low: 0.08, lean: 0.16, blur: [0.07, 0.38] },
    aquila: { sig: 'twin', at: 0.5, signal: 1.8, toss: 0.45, combo: 3, fast: 0.8, box: [112, 70, 4], every: 1, chance: 0.6, sure: 3, winded: 2 },
  },
  // Step 20, each signature's own show: sure = after this many exchanges since the last it comes whatever its chance (a Huntress too close backs off
  // for it); Aquila's, once he has two blades, is a combo at two heights (answered when none lands). Its tell's beat: beat s of real time at mul speed.
  // An answer: READ! (read px) with the punish window lit in gold; a blow that lands shows only the move's name (miss px). The looks: the Capuan
  // ghosts (ghost[0] H either side at alpha ghost[1]), the Blink's white streaks (streaks of them, len H), the spear's glint (glint px), the gold flash (s)
  sigFx: { beat: 0.25, mul: 0.4, read: 34, miss: 26, ghost: [0.06, 0.3], streaks: 5, len: 0.5, glint: 16, flash: 0.22 },
  // Step 19, the innate trait of each origin (always on, never a card; names and lines in TRAITS). gaul, Ox-Strong: stamina regen x. thrace, Shield
  // Drill: every nth block wears the shield nothing (a quarter less). numidia, Light Feet: a dodge's stamina x. capua, Kneading: each hit within
  // TUNING.crowd.comboWin s of the last adds step to the next, at most max. ostia, Sea Legs: shoves and knockback move you x as far. alexandria,
  // Reads the Scroll: a feint's tell shows this share of its wind-up sooner. sparta, Spartan Guard: the perfect-block window x. egypt, Broken Chains:
  // once a run, a killing blow leaves you on hearts. circus, Steer Him: your shoves drive him x as far, and one into his wall costs him wall x his stamina
  origins: { gaul: { regen: 1.15 }, thrace: { every: 4 }, numidia: { dodge: 0.75 }, capua: { step: 0.1, max: 0.3 }, ostia: { push: 0.5 },
    alexandria: { sooner: 0.2 }, sparta: { perfect: 1.3 }, egypt: { hearts: 1 }, circus: { push: 1.3, wall: 0.25 } },
  // the drive of each reason (DRIVES). freedom, Nothing to Lose: at or below below x your hearts, your blows x dmg. debt, Every Win Pays: a bout's
  // gold x. revenge, Him Last: blows on the champion (and your rival) x. glory, Louder: the crowd's favour x. promise, She's Waiting: hearts more a fell
  reasons: { freedom: { below: 0.25, dmg: 1.25 }, debt: { gold: 1.25 }, revenge: { dmg: 1.2 }, glory: { fav: 1.25 }, promise: { heal: 1 } },
  // a trait's or drive's tag in play: s before the same one shows again, its px
  tag: { gap: 6, size: 16 },
  // Step 20, the slim bout card: its w x h px (at most), the name's px and letter spacing (x its size), the figure's px a body unit (pair: pair), a beast's
  // px nose to tail, the laurel's radius either side of a champion's name, the "?" button's px, and the open gaps' glow on the figure (x a gap's size)
  card: { w: 600, h: 280, name: 34, spacing: 0.12, fig: 100, pair: 78, beast: 172, laurel: 11, help: 44, glow: 2.4 },
  // Step 18, two blades and no shield. His (from the City on, at TUNING.arenas.*.dual for a man with a weapon in weapons): gaps more
  // open gaps; his far arm held at rest rad from hanging and following his weapon arm's swing x follow; his cover is his crossed blades (cover H
  // across), each blow on them costing him drain x a guard's stamina, broken by breakAt of them for broken s. Yours (the purse's Arms row, at your
  // weapon's price): crossed blades let through x a blow's hearts (rounded down), cost cost stamina a block and drain holdDrain x to hold; a
  // well-timed block ripostes with the off hand; each slash that lands is followed after follow s by the off hand for part x its damage, its arm
  // swinging for swing s. Your off hand's blade points down rad (at the hip) and, raised, guard rad for HIGH, MID and LOW (0 points ahead, down is
  // positive), easing over tau s; its follow-up reaches its fist to reach (body units), the blade thrust rad
  dual: { weapons: ['gladius', 'dagger'], gaps: 1, rest: -1.3, follow: 0.8, cover: 0.12, drain: 2, breakAt: 3, broken: 2.5,
    through: 0.5, cost: 6, holdDrain: 1.6, after: 0.14, part: 0.5, swing: 0.24, down: 1.1, guard: [-0.25, -1.3, 0.55], tau: 0.06, reach: [0.32, -0.62], thrust: 0.1 },
  // the Emperor's thumb card: s the box takes to show, then the crowd meter to fill to the bout's average, then the hand to rise, then the thumb to
  // turn; s before a tap continues; then coins and petals fall, rain[band] of them, each fall s from top to bottom
  thumb: { box: 0.6, meter: 1.1, hand: 0.8, turn: 0.4, tap: 3.3, rain: [14, 22, 34], fall: 2.6 },
  // Step 6, the art (ADR-0020, ADR-0021). Backdrops: each arena's image covers the screen behind the fighters, under a dark wash (alpha over the whole
  // screen, then a band from band H above the floor down to the floor at bandA), so the fighters and their tells read first. Portraits: face = the px of
  // a speaker's face beside his line (big for a headline), crop = the face's box in a portrait (fractions x0 y0 x1 y1), bust = a champion's on his card
  // (w, h px, gap from the card's corner), box = the Emperor's crop in the imperial box.
  // loading (step 12): par images in flight at once in the background; the boot card waits up to boot s for the menu's paintings and shows only after
  // show s; a bout's intro card holds a tap up to hold s for its paintings; a painting landing on screen fades in over fade s; the boot bar's w x h px
  load: { par: 4, boot: 3, show: 0.15, hold: 2, fade: 0.2, bar: [180, 4] },
  // the menu (step 12): seed = the fresh roll's look shown before any run; col = the centre column (share of the width, least, most px), gap px to the
  // sides; title px (least, most, share of the height); backdrop wash and vignette alphas; torches at dx px either side of the title's centre, glow r
  // px, flicker share; dust motes, their px/s drift; the fighter's height (share of the height), the cut at his hips (body units), breath (rise as a share of s, rad/s), cloak sway (body units, rad/s)
  // and colour; Brutus's face px; names per wall; wall height px (most); the painted logo's box (title px, step 14); plaques' heights px; repaints a second of what moves (your fighter, the flames, the dust); the crowd murmur's gain, low-pass Hz, loop s and swells a loop
  menu: { seed: 20261103, col: [0.4, 270, 340], gap: 12, title: [40, 56, 0.12], wash: 0.22, vignette: 0.8, torchDx: 118, torchR: 64, flicker: 0.22,
    dust: 16, dustV: [6, 16], fighter: 0.6, hips: -0.45, breath: [0.012, 1.7], sway: [0.05, 1.2], cloak: '#8e2a26', face: 52, names: 3, wallH: 100,
    logo: [3.8, 1.25], play: 56, small: 46, fps: 5, figBox: [-0.5, -1.8, 0.58, -0.03], murmur: 0.05, murmurHz: 600, murmurLoop: 3, swells: 2,
    // Step 15, the fighter's hero pose: legs = hip, knee and ankle of each leg (body units, wide); chin = rad the head tips back; far = the shield arm's
    // upper arm and forearm (rad from hanging, + forward), its shield's radius (body units) at the fist; over = the weapon arm's two angles and the
    // weapon's lean back from upright (rad), a raised fist for fists; long = the same for the weapons in longIds, held up and back; icon = its sprite's box
    hero: { legs: [[[-0.02, -0.37], [-0.12, -0.21], [-0.19, -0.04]], [[0.02, -0.37], [0.12, -0.21], [0.19, -0.04]]], chin: 0.12, far: [0.1, -2.7], shield: 0.14,
      over: [2.4, 3.0, 0.3], long: [1.7, 2.4, 0.6], longIds: ['spear', 'trident'], icon: [-0.55, -1.2, 0.5, 0.12] } },
  // Step 13, the arena picker: the plaque's margin and rim (px), the painting's horizontal focus, its dark top and bottom (alpha, and where the clear middle runs, 0-1), the room kept for the name above the champion and for his lines below, and how dark a shut arena is
  // ring: the painted laurel (laurel-ring, Pack 26) round a cleared arena's portrait, centred on it: its canvas (w, h) and the portrait height it was
  // painted round (px; HANDOFF-arena-pack26: a 180 x 240 portrait in a 300 x 400 ring)
  pick: { m: 6, rim: 7, focus: 0.5, shade: [0.7, 0.9], fade: [0.28, 0.6], top: 62, bot: 82, lock: 0.5, ring: [300, 400, 240] },
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
    // Step 16 (Pack 27): each helmet is painted onto the head itself, 1 px of it to 1 px of the head: o = the head canvas's top-left corner in its
    // file (headJ lays it there); closed: it is the whole head painted wearing it, drawn instead of the head; otherwise it lies over the head.
    // crest: the height of the tailor's crest's base on it (head radii from the head's centre, as TUNING.kit.tailor.crest.at; the plume moves with it)
    helm: {
      gallic: { size: [266, 308], o: [10, 52], crest: -0.81 },
      murmillo: { size: [343, 455], o: [55, 199], closed: true, crest: -1.41 },
      thraex: { size: [312, 439], o: [43, 183], closed: true, crest: -1.35 },
      secutor: { size: [270, 363], o: [10, 107], closed: true, crest: -1.42 },
    },
    // hole: its armhole (an ellipse's centre and radii, px), filled with the torso's painted shoulder; rim: the row of its bottom rim, where a
    // belt card is buckled when the plate covers the belly too
    plate: { size: [320, 320], a: [160, 0], b: [160, 300], w: 270, abs: 150, flip: true, hole: [291, 94, 21, 58], rim: 303 },
    // Step 6e: a guarded gap on a painted man is shut by a band of the chest plate's riveted rim: its centre column and rows (px of plate.size)
    guard: { x: 160, y: [284, 312] },
    manica: { size: [160, 320], a: [72, 10], b: [60, 305], w: 125, to: 0.86 },
    greave: { size: [192, 384], a: [97, 10], b: [105, 350], w: 105, from: 0.05, to: 0.95 },
    wrap: { size: [192, 352], a: [92, 30], b: [86, 330], w: 114 },
    galerus: { size: [192, 256], box: [-0.105, -0.17, 0.045, 0.03] },
    shields: { round: { size: [320, 320], r: 160 }, parma: { size: [224, 224], r: 112 }, scutum: { size: [224, 448], h: 224 } },
    neck: -0.745, belt: -0.49, cut: -0.51, edge: '#3a1a0a', top: -0.9, chin: -0.71, far: 0.22, arm: 0.075,
    // Step 17: every torso and the chest plate are painted turned towards us, so their big near shoulder (and the plate's armhole) lands on the back,
    // where the far arm hangs behind. In the fight that shoulder ends at the far arm: behind column back[0] (body units) only the ellipse centred
    // there at row back[1], radii back[2] and back[3], is kept above row back[4], its edge outlined as the painted one is; what is worn on the torso
    // keeps the ellipse and, below its centre, all in front of its back edge, so a plate's side runs on straight down past the far arm
    back: [0, -0.58, 0.095, 0.16, -0.54],
    // an open gap on a painted man in the fight: a soft shadow on the limb, its alpha at the centre (fading to none at the gap's edge)
    gap: 0.5,
    // your painted shield: a scutum's half height and half width per its rim radius r
    tall: [1.2, 0.6],
    // your sword arm's halves are mirrored only past this much elbow bend (the elbow's offset per upper arm length) or hilt angle (its sine across the
    // forearm), so they never flicker when straight
    flip: [0.08, 0.2],
    // your sword arm's forearm is drawn under its upper arm, and again over the grip from this fraction of the way from its elbow to its fist
    fist: 0.4,
    // a part drawn live each frame is drawn from a copy this many times its size on screen (headroom for the rig's stretch, little to downscale)
    live: 1.25,
    // Joints and cuts by file. The muscular thigh shows a whole leg, so it is drawn cropped to its own segment: a the hip, b the knee (pinned to the
    // rig's), clip the last row drawn (just above the knee cap).
    crop: {
      'kit-base-thigh-A': { a: [100, 60], b: [101, 205], clip: 192 }, 'kit-base-thigh-B': { a: [100, 60], b: [100, 190], clip: 178 },
      // the muscular torso is painted with both upper arms hanging at its sides: below row trim[0] only columns trim[1] to trim[2] are drawn. In the
      // fight it also keeps only columns mine[0] to mine[1] (the cut outlined mine[2] px wide, see kitTorso): the painted shoulder under the weapon
      // arm goes. cap: an ellipse (centre, radii, its outline's px) kept below that row too, so that shoulder ends round off the fight, not cut flat.
      // It is painted turned to its left as the others are (step 17: flip, so its chest faces where his head does); back: its own back cut, whose
      // ellipse meets the trim's column at the trim's row (see TUNING.kit.back)
      'kit-base-torso-A': { flip: true, trim: [150, 100, 335], cap: [68, 135, 52, 42, 8], mine: [90, 488, 8], back: [0, -0.617, 0.075, 0.13, -0.617] },
      // Step 6e: these torsos are painted turned to their left (the sternum and neck left of centre, the right flank showing), against the head
      // and limbs painted facing right, so they are drawn mirrored to face where the head faces (their near shoulder is on the image's left)
      'kit-base-torso-lean-A': { flip: true, mine: [40, 384, 8] }, 'kit-base-torso-avg-A': { flip: true, mine: [40, 384, 8] },
      'kit-base-torso-B': { flip: true, mine: [40, 384, 8] }, 'kit-base-torso-lean-B': { flip: true, mine: [40, 384, 8] },
      // the Pack 20 one-segment muscular upper arm, drawn whole: a the shoulder, b the elbow (its end runs on under the forearm's top)
      'kit-base-upperarm-seg-A': { a: [107, 50], b: [30, 294] },
    },
    // Step 6d (Pack 21, HANDOFF-arena-limbs): a lean or average arm or leg is one painting cut at its elbow or knee, in two halves (kit-arm-up and
    // -lo, kit-leg-up and -lo, each on its size's canvas). Per file: a the shoulder or hip (an upper half) or the pivot (a lower half), b the pivot or
    // the fist's grip or the heel (under the ankle, so the sole meets the ground as the muscular shin's does); w the limb's px across at the cut,
    // which both halves share so they meet at the joint, drawn wk times the part's hit width (wk by limb); mir: painted facing the other way (the
    // fist's fingers to the right, the toes to the left), so both halves are mirrored; top: an upper leg's first row under its painted skirt, which
    // would show under the tunic; pad: px above it filled with that row's pixels, so the leg still meets the tunic's hem.
    half: {
      wk: { arm: 0.7, leg: 0.8 }, size: { 'kit-arm-up': [160, 288], 'kit-arm-lo': [160, 288], 'kit-leg-up': [192, 320], 'kit-leg-lo': [192, 352] },
      'kit-arm-up-lean-A': { a: [69.6, 40], b: [79.5, 264], w: 76 }, 'kit-arm-lo-lean-A': { a: [81.5, 24], b: [59, 238], w: 76 },
      'kit-arm-up-lean-B': { a: [91.4, 40], b: [80, 264], w: 75, mir: true }, 'kit-arm-lo-lean-B': { a: [80, 24], b: [94, 247], w: 75, mir: true },
      'kit-arm-up-avg-A': { a: [95.2, 44], b: [79.5, 264], w: 83, mir: true }, 'kit-arm-lo-avg-A': { a: [79.5, 24], b: [90, 245], w: 83, mir: true },
      'kit-arm-up-avg-B': { a: [87.8, 42], b: [80, 264], w: 94, mir: true }, 'kit-arm-lo-avg-B': { a: [80, 24], b: [98, 237], w: 94, mir: true },
      'kit-leg-up-lean-A': { a: [104.1, 57], b: [96.1, 296], w: 63, top: 130, mir: true }, 'kit-leg-lo-lean-A': { a: [96.1, 24], b: [111.3, 292], w: 63, mir: true },
      'kit-leg-up-lean-B': { a: [78.5, 64], b: [95.9, 296], w: 70, top: 140, mir: true }, 'kit-leg-lo-lean-B': { a: [95.9, 24], b: [116.1, 292], w: 70, mir: true },
      'kit-leg-up-avg-A': { a: [85.6, 69], b: [95.6, 296], w: 80, top: 118 }, 'kit-leg-lo-avg-A': { a: [87.6, 24], b: [72, 292], w: 80 },
      'kit-leg-up-avg-B': { a: [113.1, 70], b: [95.9, 296], w: 82, top: 138 }, 'kit-leg-lo-avg-B': { a: [76.9, 24], b: [64.5, 292], w: 82 },
      // Pack 24: the muscular arm and leg, painted facing right (a lower half's b: the fist's grip, the sole's heel)
      'kit-arm-up-musc-A': { a: [61.5, 87], b: [79.5, 264], w: 88 }, 'kit-arm-lo-musc-A': { a: [80, 24], b: [50, 225], w: 88 },
      'kit-arm-up-musc-B': { a: [94.5, 108], b: [79.5, 264], w: 70 }, 'kit-arm-lo-musc-B': { a: [79.5, 24], b: [95, 238], w: 70 },
      'kit-leg-up-musc-A': { a: [92, 128], b: [95, 296], w: 59, top: 188, pad: 9 }, 'kit-leg-lo-musc-A': { a: [95, 24], b: [90, 262], w: 59 },
      'kit-leg-up-musc-B': { a: [60, 134], b: [95.5, 296], w: 57, top: 196, pad: 14 }, 'kit-leg-lo-musc-B': { a: [96, 24], b: [91, 250], w: 57 },
    },
    // Step 6c-2, the card gear painted (Pack 20, `gear-<name>`), each piece's pins in its own PNG: a and b land on the rig's points at, w = the px
    // across that spans the part's width (none: drawn in its own shape). arms: at = two heights in the arm's frame (H from the shoulder: the forearm
    // runs from ARM_LEN / 2 to the fist at ARM_LEN), so they follow your live arm too (up: there it sits upright on the shoulder, as the drawn one);
    // helmet: o, as TUNING.kit.helm's (Pack 27: painted onto the head; helm: a helmet, standing in for a plated head's painted helmet; closed: drawn
    // instead of the head); chest: at =
    // x, then the top and bottom height (body units; flip: painted turned to his left, so mirrored to face where his head faces); legs: at = fractions from the knee to the ankle (flip: painted facing left); belt: at = x0, x1
    // and the height of the waist; cloak: at = the shoulder point, the hem point and the width (body units), behind the body; shield: its rim radius
    // r or, for the tower, its half height h. bare: on an unplated part of his, a piece that would read as a plate shows only its rows above this
    // one (a cuirass's collar and straps; 0: none of it, as a helmet painted onto the head), so you never aim at a plate that is not there; yours is worn whole.
    gear: {
      'gear-bronze-bracers': { size: [160, 160], a: [80, 22], b: [80, 138], w: 160, at: [0.19, 0.265] },
      'gear-barbed-bracers': { size: [160, 160], a: [90, 22], b: [82, 138], w: 130, at: [0.19, 0.27] },
      'gear-matador-ribbons': { size: [160, 240], a: [88, 20], b: [88, 100], w: 90, at: [0.2, 0.25] },
      'gear-knife-bracers': { size: [160, 160], a: [0, 88], b: [160, 88], w: 100, at: [0.19, 0.27] },
      'gear-gilt-armlets': { size: [160, 160], a: [80, 37], b: [80, 124], w: 160, at: [0.19, 0.265] },
      'gear-iron-pauldrons': { size: [224, 192], a: [105, 5], b: [105, 185], w: 180, at: [-0.055, 0.05], up: true },
      'gear-bronze-crest': { size: [306, 405], o: [44, 149], helm: true, bare: 0 },
      'gear-blood-band': { size: [296, 256], o: [40, 0] },
      'gear-ribbon-band': { size: [312, 256], o: [50, 0] },
      'gear-horned-cap': { size: [281, 352], o: [25, 96], helm: true, bare: 0 },
      'gear-dark-hood': { size: [326, 327], o: [51, 71], cover: true, closed: true },
      'gear-plumed-helm': { size: [308, 451], o: [51, 195], helm: true, bare: 0 },
      'gear-bronze-phalerae': { size: [384, 384], a: [160, 25], b: [160, 375], w: 300, at: [0, -0.745, -0.49], bare: 70, flip: true },
      'gear-ghost-silk': { size: [384, 384], a: [200, 0], b: [200, 384], w: 380, at: [0, -0.74, -0.45] },
      'gear-black-plate': { size: [384, 384], a: [190, 12], b: [190, 372], w: 300, at: [0, -0.745, -0.48], bare: 95, flip: true },
      'gear-eye-amulet': { size: [128, 160], a: [64, 0], b: [64, 160], at: [0.03, -0.745, -0.6] },
      'gear-gilded-harness': { size: [384, 384], a: [192, 20], b: [192, 355], w: 340, at: [0, -0.745, -0.49], flip: true },
      'gear-bronze-boots': { size: [192, 384], a: [62, 82], b: [58, 262], at: [0.38, 1] },
      'gear-dancers-sandals': { size: [192, 384], a: [62, 55], b: [66, 288], at: [0.1, 1] },
      'gear-spiked-boots': { size: [192, 384], a: [48, 88], b: [50, 262], at: [0.35, 1] },
      'gear-soft-boots': { size: [192, 384], a: [130, 102], b: [120, 265], at: [0.35, 1], flip: true },
      'gear-gilded-greaves': { size: [192, 384], a: [95, 22], b: [100, 365], w: 135, at: [0.02, 0.97] },
      'gear-hook-belt': { size: [384, 96], a: [118, 18], b: [266, 18], at: [-0.11, 0.11, -0.48] },
      'gear-ribbon-sash': { size: [384, 96], a: [112, 18], b: [272, 18], at: [-0.11, 0.11, -0.48] },
      'gear-chain-belt': { size: [384, 96], a: [0, 40], b: [384, 40], at: [-0.115, 0.115, -0.47] },
      'gear-coin-belt': { size: [384, 96], a: [0, 15], b: [384, 15], at: [-0.115, 0.115, -0.48] },
      'gear-wolf-pelt': { size: [384, 512], a: [192, 10], b: [192, 480], w: 308, at: [-0.05, -0.74, -0.13, -0.2, 0.26] },
      'gear-flowing-cape': { size: [384, 512], a: [192, 20], b: [192, 500], w: 384, at: [-0.05, -0.73, -0.14, -0.08, 0.27] },
      'gear-puppeteers-mantle': { size: [384, 512], a: [192, 40], b: [192, 500], w: 384, at: [-0.05, -0.72, -0.13, -0.12, 0.27] },
      'gear-purple-cloak': { size: [384, 512], a: [192, 20], b: [192, 500], w: 384, at: [-0.05, -0.73, -0.14, -0.08, 0.27] },
      'gear-lion-pelt': { size: [384, 512], a: [192, 10], b: [192, 480], w: 384, at: [-0.05, -0.74, -0.13, -0.2, 0.26] },
      'gear-spiked-shield': { size: [320, 320], r: 122 }, 'gear-spiral-shield': { size: [320, 320], r: 158 }, 'gear-tower-shield': { size: [224, 448], h: 224 },
      // Step 14, the vault's gear (art Pack 22, HANDOFF-arena-pack22): each file's own pins. The helm and the wreath are Pack 27's, painted onto the
      // head; the belts' a and b are their belt line's ends, stretched to the waist; the sandal is a tall laced boot, so it starts near the knee
      'gear-bossed-shield': { size: [320, 320], r: 158 }, 'gear-phalanx-helm': { size: [289, 357], o: [33, 101], helm: true, closed: true, bare: 0 },
      'gear-laurel-wreath': { size: [269, 256], o: [10, 0] },
      'gear-bloodletters-belt': { size: [384, 96], a: [88, 48], b: [296, 48], at: [-0.11, 0.11, -0.48] }, 'gear-smoke-pouch-belt': { size: [384, 96], a: [97, 48], b: [286, 48], at: [-0.11, 0.11, -0.48] },
      'gear-crimson-cloak': { size: [384, 512], a: [192, 2], b: [192, 510], w: 384, at: [-0.05, -0.73, -0.14, -0.08, 0.27] },
      'gear-mirror-cloak': { size: [384, 512], a: [187, 33], b: [187, 479], w: 384, at: [-0.05, -0.73, -0.14, -0.08, 0.27] },
      'gear-shadow-sandals': { size: [192, 384], a: [41, 70], b: [40, 312], at: [0.09, 1] },
      'gear-wind-ribbons': { size: [160, 240], a: [39, 31], b: [41, 208], w: 64, at: [0.155, 0.29] }, 'gear-crusher-gauntlets': { size: [160, 160], a: [112, 7], b: [74, 152], w: 100, at: [0.21, 0.3] },
      'gear-colossus-plate': { size: [384, 384], a: [186, 36], b: [186, 363], w: 300, at: [0, -0.745, -0.48], bare: 95 },
      'gear-idols-torc': { size: [128, 160], a: [64, 4], b: [64, 155], at: [0.03, -0.745, -0.6] },
    },
    // a round shield face on a tall shield: its rim radius per the tall shield's half width
    emblem: 0.85,
    // Step 14, the tailor's looks painted (Pack 22, `tailor-<item>-<style>`), each file's pin (px): the crest's base and the plume's socket, set on
    // your head at (x, y) head radii from its centre with the canvas w head radii wide; the paint's disc (r its radius), laid on the round shield's face
    // at paint of its rim radius; the cloak hung as a card cloak (TUNING.kit.gear's a, b, w and at)
    tailor: {
      crest: { at: [-0.15, -0.62], w: 3.1 }, plume: { at: [-0.2, -0.68], top: -1.25, w: 1.9 }, paint: 0.84,
      'tailor-crest-bronze': { size: [256, 128], a: [127, 126] }, 'tailor-crest-silver': { size: [256, 128], a: [127, 126] }, 'tailor-crest-gold': { size: [256, 128], a: [128, 126] },
      'tailor-plume-red': { size: [256, 256], a: [88, 254] }, 'tailor-plume-white': { size: [256, 256], a: [73, 254] }, 'tailor-plume-black': { size: [256, 256], a: [206, 254] },
      'tailor-paint-wings': { size: [256, 256], r: 126 }, 'tailor-paint-bolt': { size: [256, 256], r: 126 }, 'tailor-paint-sun': { size: [256, 256], r: 126 },
      'tailor-cloak-red': { size: [384, 512], a: [191, 2], b: [191, 510], w: 384, at: [-0.05, -0.73, -0.14, -0.08, 0.27] },
      'tailor-cloak-blue': { size: [384, 512], a: [182, 2], b: [182, 510], w: 384, at: [-0.05, -0.73, -0.14, -0.08, 0.27] },
      'tailor-cloak-green': { size: [384, 512], a: [184, 2], b: [184, 510], w: 384, at: [-0.05, -0.73, -0.14, -0.08, 0.27] },
    },
    // Step 14, the weapons painted (Pack 23, HANDOFF-arena-pack23), each straight up with its point at row 0 (or row top): its canvas, the grip's axis x and the row
    // the hand closes on (pin), px. Drawn about the pin at the fist, its point where the drawn point was (yours at your blade's reach, his `len` plus
    // tip H past his fist), the side painted right (the axe's bit, the sica's hollow) leading. The spear's and the trident's pins sit 392 px above the
    // butt (the handoff's proposal put 0.6 H of shaft behind his hand). For the card looks: the blade's or head's rows (blade, top and bottom), its
    // half width hw, its cutting edges, and clip, the shapes the blackened and gilded looks and the red of a locked blade are kept inside (ring: the
    // mace's ball, x, y and r, both at once).
    weapon: {
      gladius: { size: [96, 640], x: 48, pin: 517, tip: 0.04, blade: [0, 360], hw: 33,
        edges: [[[48, 0], [32, 32], [21, 64], [15, 96], [15, 360]], [[48, 0], [64, 32], [75, 64], [81, 96], [81, 360]]],
        clip: [[[48, 0], [32, 32], [21, 64], [15, 96], [15, 360], [81, 360], [81, 96], [75, 64], [64, 32]]] },
      dagger: { size: [69, 384], x: 34.3, pin: 287, tip: 0.04, blade: [0, 205], hw: 23,
        edges: [[[35, 0], [19, 32], [12, 64], [11, 96], [14, 160], [11, 200]], [[35, 0], [50, 32], [57, 64], [58, 96], [55, 160], [58, 200]]],
        clip: [[[35, 0], [19, 32], [12, 64], [11, 96], [14, 160], [11, 205], [58, 205], [55, 160], [58, 96], [57, 64], [50, 32]]] },
      sica: { size: [136, 640], x: 61.2, pin: 518, tip: 0.04, blade: [0, 408], hw: 26,
        edges: [[[132, 0], [115, 32], [94, 64], [78, 96], [67, 128], [62, 160], [62, 192], [68, 224], [79, 256], [89, 288], [95, 320], [96, 352], [93, 384], [91, 404]],
          [[128, 0], [72, 32], [40, 64], [20, 96], [8, 128], [2, 160], [1, 192], [5, 224], [17, 256], [32, 288], [42, 320], [44, 352], [40, 384], [35, 404]]],
        clip: [[[132, 0], [115, 32], [94, 64], [78, 96], [67, 128], [62, 160], [62, 192], [68, 224], [79, 256], [89, 288], [95, 320], [96, 352], [93, 384], [91, 408],
          [35, 408], [40, 384], [44, 352], [42, 320], [32, 288], [17, 256], [5, 224], [1, 192], [2, 160], [8, 128], [20, 96], [40, 64], [72, 32], [128, 0]]] },
      spear: { size: [95, 1792], x: 45.5, pin: 1400, tip: 0.12, blade: [0, 224], hw: 46,
        edges: [[[47, 0], [27, 32], [16, 64], [8, 96], [3, 128], [0, 160], [5, 192], [19, 224]], [[47, 0], [66, 32], [77, 64], [86, 96], [91, 128], [93, 160], [89, 192], [74, 224]]],
        clip: [[[47, 0], [27, 32], [16, 64], [8, 96], [3, 128], [0, 160], [5, 192], [19, 224], [74, 224], [89, 192], [93, 160], [91, 128], [86, 96], [77, 64], [66, 32]]] },
      trident: { size: [240, 1792], x: 121, pin: 1400, tip: 0.13, blade: [0, 240], hw: 60,
        edges: [[[13, 48], [8, 112], [2, 144], [5, 224]], [[227, 48], [231, 112], [237, 144], [235, 224]]],
        clip: [[[13, 46], [2, 144], [5, 240], [47, 240], [44, 160], [59, 144], [27, 64]], [[120, 0], [100, 64], [87, 112], [104, 128], [104, 240], [136, 240], [136, 128], [152, 112], [138, 64]],
          [[227, 46], [238, 144], [235, 240], [193, 240], [196, 160], [181, 144], [212, 64]]] },
      // (Pack 28: the axe's top spike, its point at row top; the canvas grew 64 px at the top, so its point sits top px below row 0)
      axe: { size: [253, 1088], x: 47, pin: 896, top: 7, tip: 0.04, blade: [80, 368], hw: 28,
        edges: [[[237, 80], [249, 128], [252, 192], [248, 240], [237, 288], [215, 336], [187, 368]]],
        clip: [[[91, 80], [192, 96], [237, 80], [246, 112], [252, 176], [250, 224], [241, 272], [224, 320], [203, 352], [187, 368], [181, 320], [178, 288], [168, 256], [145, 224], [124, 208], [91, 208]],
          [[45, 7], [50, 12], [53, 24], [56, 40], [59, 56], [62, 72], [64, 80], [64, 111], [26, 111], [26, 80], [28, 72], [31, 56], [34, 40], [37, 24], [40, 12]]] },
      mace: { size: [211, 1024], x: 106, pin: 832, tip: 0.07, blade: [20, 210], hw: 50, ring: [105, 120, 92] },
      // the weapon in the inventory doll's hand (its fist's x past the shoulder joint, body units, the menu's too, and its lean, rad), and the purse rack's weapons, lying
      // flat at their lengths against the longest's, under the names at alpha rackA
      doll: [0.095, 0.1], rackA: 0.5,
      // the doll's fist (the menu's and the inventory's), body units round the hand, copied again over the grip
      fist: 0.045,
      // the wooden sword of freedom on his card, lying flat (not held), its notches cut across the blade
      wooden: { size: [93, 640], x: 45.9, pin: 518, blade: [0, 424], hw: 34, clip: [[[46, 0], [25, 32], [13, 64], [11, 96], [12, 424], [80, 424], [80, 96], [77, 64], [66, 32]]] },
    },
    // the draped net (kit-net-draped): its crown a and hem b (px), w its px across; over a man, a lion or a bear in its body's frame: the crown's x and
    // y, the hem's x and y and the width (body units); grow: the s it takes to land, and the size it lands from
    net: { size: [512, 512], a: [256, 84], b: [256, 428], w: 512, grow: [0.3, 0.6], man: [0.02, -1.0, 0, -0.3, 0.55], lion: [0, -0.6, -0.02, -0.1, 0.8], bear: [-0.02, -0.64, -0.04, -0.12, 0.82] },
  },
  // his shield (H x its scale): a round one's radius, a scutum's half height, Iron Wall's tower stretch (x, y)
  foeShield: { r: 0.1, h: 0.16, tower: [1.25, 1.45] },
  // Step 6b, the beasts painted from their kits (Pack 19; a young beast takes the -young parts where they exist), in its own body units: the head's eye
  // (px) pinned at eyeAt from the head's centre at u body units per px, the lion's tail from its root to its tuft; head hinge and lip (px) pin the
  // roar's jaw to the painted muzzle; far = the shade of the far legs, leg = the copies' width in body units, gape = the painted jaw's opening per unit
  // of the pose's jaw (rad), pawBand = how far the toe must point back or ahead (its forward share) before a lower leg is mirrored.
  // Step 6d (Pack 21): the legless torso's box (x0 y0 x1 y1; the PNG faces left, so it is mirrored), set so its painted shoulder and hip fall on the
  // rig's; each leg (fore, hind) one painting cut at its elbow or knee into an upper and a lower half on the leg canvas.
  beastArt: {
    lion: {
      torso: { size: [640, 384], box: [-0.37, -0.47, 0.19, -0.18] }, head: { size: [320, 320], eye: [245, 121], u: 0.00094, hinge: [255, 172], lip: [303, 187] },
      tail: { size: [320, 160], a: [8, 78], b: [300, 80], root: [-0.33, -0.33] },
    },
    bear: {
      torso: { size: [640, 384], box: [-0.38, -0.49, 0.19, -0.19] }, head: { size: [320, 320], eye: [215, 108], u: 0.00088, hinge: [238, 160], lip: [296, 172] },
    },
    eyeAt: [0.02, -0.018], far: 0.28, leg: 0.08, pawBand: 0.2, gape: 1.1, legSize: [160, 288],
    // each torso's near shoulder and hip (px in its left-facing PNG, HANDOFF-arena-limbs), where the near legs' tops are pinned; the far legs' keep
    // the rig's offset from the near ones (BEAST_BODY sh, hp)
    pin: {
      'beast-lion-torso-A': [[166, 261], [499, 247]], 'beast-lion-torso-B': [[166, 264], [499, 241]],
      'beast-lion-torso-young-A': [[166, 259], [499, 211]], 'beast-lion-torso-young-B': [[166, 257], [499, 217]],
      'beast-bear-torso-A': [[166, 249], [499, 265]], 'beast-bear-torso-B': [[166, 238], [499, 272]],
      'beast-bear-torso-young-A': [[166, 242], [499, 286]], 'beast-bear-torso-young-B': [[166, 250], [499, 282]],
    },
    // each leg half's joints by file, as TUNING.kit.half (b on a lower half: the paw's sole under its leg); painted facing left, so drawn mirrored
    // (mir: this limb's paw faces right)
    half: {
      wk: { fore: 1.25, hind: 1.25 },
      'beast-lion-fore-up-A': { a: [65.2, 51], b: [80.3, 264], w: 81 }, 'beast-lion-fore-lo-A': { a: [94.3, 24], b: [82.5, 282], w: 81 },
      'beast-lion-fore-up-B': { a: [77.6, 54], b: [80.1, 264], w: 88, mir: true }, 'beast-lion-fore-lo-B': { a: [62.1, 24], b: [84.2, 282], w: 88, mir: true },
      'beast-lion-fore-up-young-A': { a: [61.9, 56], b: [86.6, 264], w: 87 }, 'beast-lion-fore-lo-young-A': { a: [95.6, 24], b: [77.9, 282], w: 87 },
      'beast-lion-fore-up-young-B': { a: [85.9, 47], b: [79.9, 264], w: 77 }, 'beast-lion-fore-lo-young-B': { a: [89.9, 24], b: [69.8, 282], w: 77 },
      'beast-lion-hind-up-A': { a: [90.2, 59], b: [80.4, 264], w: 97 }, 'beast-lion-hind-lo-A': { a: [84.4, 24], b: [78.6, 282], w: 97 },
      'beast-lion-hind-up-B': { a: [91.3, 54], b: [81.8, 264], w: 94 }, 'beast-lion-hind-lo-B': { a: [79.8, 24], b: [87.7, 282], w: 94 },
      'beast-lion-hind-up-young-A': { a: [84, 56], b: [80.2, 264], w: 72 }, 'beast-lion-hind-lo-young-A': { a: [84.2, 24], b: [87.3, 282], w: 72 },
      'beast-lion-hind-up-young-B': { a: [79.6, 58], b: [78.4, 264], w: 74 }, 'beast-lion-hind-lo-young-B': { a: [80.4, 24], b: [91.4, 282], w: 74 },
      'beast-bear-fore-up-A': { a: [90.6, 55], b: [80.1, 264], w: 83 }, 'beast-bear-fore-lo-A': { a: [81.1, 24], b: [58.5, 282], w: 83 },
      'beast-bear-fore-up-B': { a: [67.9, 53], b: [79.8, 264], w: 84, mir: true }, 'beast-bear-fore-lo-B': { a: [76.8, 24], b: [98, 282], w: 84, mir: true },
      'beast-bear-fore-up-young-A': { a: [69.1, 41], b: [79.6, 264], w: 93 }, 'beast-bear-fore-lo-young-A': { a: [101.6, 24], b: [81.8, 282], w: 93 },
      'beast-bear-fore-up-young-B': { a: [70.9, 43], b: [79.7, 264], w: 80 }, 'beast-bear-fore-lo-young-B': { a: [97.7, 24], b: [65.8, 282], w: 80 },
      'beast-bear-hind-up-A': { a: [83.4, 54], b: [88.1, 264], w: 82, mir: true }, 'beast-bear-hind-lo-A': { a: [80.1, 24], b: [58.4, 282], w: 82, mir: true },
      'beast-bear-hind-up-B': { a: [83.9, 58], b: [77.4, 264], w: 77, mir: true }, 'beast-bear-hind-lo-B': { a: [80.4, 24], b: [75.2, 282], w: 77, mir: true },
      'beast-bear-hind-up-young-A': { a: [89.5, 50], b: [77.4, 264], w: 80 }, 'beast-bear-hind-lo-young-A': { a: [80.4, 24], b: [85.7, 282], w: 80 },
      'beast-bear-hind-up-young-B': { a: [87.1, 40], b: [80.4, 264], w: 67 }, 'beast-bear-hind-lo-young-B': { a: [100.4, 24], b: [93.6, 282], w: 67 },
    },
  },
};
