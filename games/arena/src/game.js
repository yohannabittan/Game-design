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
  shield: { dur: 0.6, perfect: 0.25, hits: 6, cool: 0.25, stagger: 1.0, riposte: 1.0, riposteMul: 2, drain: 3, slow: 0.45, btnW: 64, btnH: 56, gap: 6 },  // drain: stamina per second of hold
  juice: { stop1: 0.04, stop2: 0.07, stop3: 0.1, stopBreak: 0.05, stopClang: 0.03, strawPerDmg: 14 },
  foe: { swayX: 0.05, swayDeg: 3, kick: 0.9, hp: 22, tierHp: 0.1, champHp: 1.15, slotMul: 3, dmgCap: 3, coverShield: 0.2, coverGuard: 0.1 },  // hp scaled by size and tier; dmgCap: most half hearts one blow takes; cover radii (H) with and without a shield
  cover: { dur: 3.2, slide: 0.07, jabTol: 0.8 },  // seconds the foe's guard stays on the part you hit; seconds to slide there; radians a jab may stray from the slit's axis
  step: { circle: [-0.05, 0.07], period: 3.4, tau: 0.16, lead: 0.5, dodge: 0.3, dodgeDur: 0.7, dodgeCool: 2.4 },  // footwork (H): a slow drift around his range (period s); lead: seconds before a move he steps to striking distance; his sidestep from a lunge
  // his stamina: base + per Stamina point; costs per move are in moves; block: paid when your blow meets his guard; winded: seconds with guard down at zero; combo: seconds winded after any combo
  foeSta: { base: 40, per: 14, regen: 16, delay: 0.6, block: 8, winded: 1.5, combo: 1.4, windedRegen: 2.5, windedDmg: 1.5, windedStep: 4 },
  // feint: show = fraction of the move's tell spent on the fake zone, cock = how far the fake winds up (an honest, shallower cock), after = seconds of real tell left after the switch
  moves: {
    chop:   { wind: 1.05, cost: 18, dmg: 2 },
    thrust: { wind: 0.85, cost: 12, dmg: 1, high: 0.35 },   // high: a spear's chance to thrust at the face
    sweep:  { wind: 0.95, cost: 14, dmg: 1 },
    combo:  { wind: 0.9, next: 0.6, cost: 10, dmg: 1 },     // cost and damage per hit; next: windup of each later hit as a fraction of the first
    feint:  { show: 0.6, cock: 0.6, after: 0.55, cost: 8, dmg: 1 },
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
const YOU = { skin: '#c58f5e', tunic: '#2f7d6d', hem: '#1d5448', crest: '#e6c866', cap: '#b08a3e' };
const FOE = { skin: '#b9835a', tunic: '#9b2f2f', hem: '#6d1d1d', crest: '#2a2a2a', cap: '#6b6f78' };
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

// Your fighter, rolled once at setup on five weighted wheels. Each wheel's landing is decided here; the wheels only show it.
function rollMe(seed) {
  const rng = makeRng(seed ^ 0x2545f491), M = TUNING.me, W = M.wheels;
  const spin = (list) => pickW(rng, list.map((e, i) => [i, e[1]]));
  const idx = [spin(W.size), spin(W.stat), spin(W.stat), spin(W.stat), spin(W.armour)];
  const size = W.size[idx[0]][0], [str, spd, sta] = [1, 2, 3].map((k) => W.stat[idx[k]][0]), set = W.armour[idx[4]][0], A = M.armour[set];
  const plates = rng.shuffle(['head', 'chest', 'legs']).slice(0, A.n);
  if (A.arm) plates.push('armB');
  const score = str + spd + sta + M.sizes[size].score + A.score;
  const tier = M.tiers.find((t) => score >= t[1])[0], underdog = score < M.underdog;
  return { idx, size, str, spd, sta, set, plates, score, tier, underdog, halves: M.sizes[size].hearts * 2 + (underdog ? M.underdogHalves : 0) };
}
// your size and stat multipliers
const meSize = () => TUNING.me.sizes[state.me.size];
const meLag = () => meSize().lag * TUNING.me.spdLag[state.me.spd - 1];

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

function rollGauntlet(seed) {
  const rng = makeRng(seed ^ 0x51ed270b), used = new Set(), W = TUNING.weapons;
  const order = rng.shuffle(W.map((_, i) => i));
  return GAUNTLET.map((_, i) => rollFighter(rng, i, W[i < order.length ? order[i] : rng.int(0, W.length - 1)], used));
}

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
  state.swingIn = 1.2; state.intro = true; state.introT = 0; state.bout = { felled: false };
  state.open = 0; state.riposte = 0; state.slowT = 0;
  state.sh.hits = TUNING.shield.hits; state.sh.broken = false;
}

function nextGap() { const S = TUNING.swing; return S.gap * 0.6 + state.rng.range(0, S.gapSpread); }

function newRound(E, seed, me) {
  const M = TUNING.me;
  Object.assign(state, {
    me, maxHp: me.halves, staMax: M.staMax[me.sta - 1], lessons: E.save.get('feintLesson', 0), caption: null, slowT: 0,
    seed, rng: makeRng(seed ^ 0x9e3779b9), gauntlet: rollGauntlet(seed), results: [], rack: 0, m: 0, stop: 0, kickA: 0, kickV: 0,
    hp: me.halves, endT: 0, dodgeT: 0, dodgeMax: TUNING.dodge.dur, dodgeCool: 0, away: false, hurt: 0, done: false, exhaust: 0, exMsg: -9, lunging: false, lunges: 0, slotHits: 0, dg: { down: false, id: -1, t: 0 },
    stamina: M.staMax[me.sta - 1], lastAtk: -9, riposte: 0, open: 0, netT: 0, pushT: 0,
    gapHits: 0, clangs: 0, broken: 0, overheads: 0, jabs: 0, slashes: 0, blocks: 0, perfects: 0, dodges: 0, staOuts: 0, counters: 0, counterHits: 0, taken: 0, felled: 0,
    feints: 0, feintsRead: 0, feintsBit: 0, plateSaves: 0, combos: 0, windeds: 0, punishes: 0, bashes: 0, bashHits: 0, nets: 0, netted: 0, zoneReads: 0, lungeReads: 0, turtleReads: 0, presses: 0, retreats: 0, moveCount: {},
    fx: [], pops: [], streaks: [], trail: [],
    you: { dx: 0, lunge: 0, lungeK: 0, a: 0, kick: 0, kickV: 0, back: 0, hopX: 0, hopY: 0, push: 0, parts: playerParts(me), fr: {} },
    foe: {},
    crowd: [],
    sh: { t: -1, cool: 0, up: 0, hits: TUNING.shield.hits, broken: false, flash: 0, zone: ZONES[1], held: false, hid: -1, zy: -0.58, arm: 0 },
    hand: { down: false, id: -1, fx: 0, fy: 0, tgx: 0, tgy: 0, ux: 0, uy: 0, pux: 0, puy: 0, hx: 0, hy: 0, phx: 0, phy: 0, ex: 0, ey: 0, sx: 0, sy: 0, bx: 1, by: 0, ang: 0, pang: 0, ph: 0, e: 1, vx: 0, vy: 0, along: 0, hvx: 0, hvy: 0, lock: 0, grip: 0, sp: 0, hist: [], raisedT: -9, atk: null },
  });
  const cr = makeRng(seed ^ 0x1234567);
  for (let i = 0; i < 70; i++) state.crowd.push({ x: cr.range(0, 1), y: cr.range(0, 1), r: cr.range(2, 4), c: cr.int(0, 3) });
  newRack(E);
}

// ----- layout and frames -----
function lay(E) {
  const F = TUNING.fighter, H = E.h * F.height, half = (E.w * F.gap + 2 * F.body * H) / 2;
  return { H, floor: E.h * F.floor, x0: E.w / 2 - half, x1: E.w / 2 + half };
}
// you are drawn at your rolled size the same way: your near edge stays put
function youF(E) { const L = lay(E), y = state.you, k = meSize().scale; return { x: L.x0 + y.dx + y.hopX + y.lunge - y.push * L.H - (k - 1) * TUNING.fighter.body * L.H, y: L.floor + y.hopY, a: y.a, dir: 1, H: L.H * k }; }
const myH = (E) => lay(E).H * meSize().scale;
const myArm = (E) => TUNING.arm.len * myH(E) * meSize().reach;
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
  st.x += (want - st.x) * (1 - Math.exp(-dt / tau));
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
      if (state.stamina >= LU.cost) { state.stamina -= LU.cost; state.lastAtk = state.m; state.lunging = true; state.lunges++; state.mem.lunges.push(state.m); swooshSound(E, 0.1); }
      else { tk = 0; tiredPop(E); }
    } else if (tk < 0.05) state.lunging = false;
  } else state.lunging = false;
  y.lungeK += (tk - y.lungeK) * (1 - Math.exp(-dt / (tk > y.lungeK ? LU.tauIn : LU.tauOut)));
  y.lunge = y.lungeK * LU.stride * L.H;
  const want = state.away ? 1 : 0;
  y.back += (want - y.back) * (1 - Math.exp(-dt / (want ? 0.05 : 0.14)));
  const u = state.dodgeT > 0 ? 1 - state.dodgeT / state.dodgeMax : 1;
  y.hopX = -D.back * L.H * y.back;
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
  const arm = myArm(E), blade = TUNING.blade.len * H;
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
      const tired = state.stamina <= 0, cost = AT[kind].cost;
      state.stamina = Math.max(0, state.stamina - cost);
      state.lastAtk = state.m;
      h.atk = { kind, tired, done: false };
      if (kind === 'over') state.overheads++; else if (kind === 'jab') state.jabs++; else state.slashes++;
    }
  }
  // regen: only when not swinging, holding or dodging; faster when also not blocking
  const RM = TUNING.me.staRegen[state.me.sta - 1] * TUNING.me.armour[state.me.set].regen;
  if (state.m - state.lastAtk > S.delay && !sh.held && !state.away) state.stamina = Math.min(state.staMax, state.stamina + S.regen * RM * (raised() ? 1 : S.idleMul) * dt);
}

function checkExhaust(E, dt) {
  state.exhaust = Math.max(0, state.exhaust - dt);
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
  const dn = p.armour && !glance ? AT.dents : 0;
  p.dents += dn;
  const rv = glance ? clamp(sp * 0.3, 200, 420) : clamp(sp * A.kick, 450, 1300);
  h.hvx = -Math.cos(ang) * rv; h.hvy = -Math.sin(ang) * rv; h.lock = AT.recoil * TUNING.me.spdLag[state.me.spd - 1]; h.grip = 0; h.atk = null;
  const d = p.d, sz = d.shape === 'circle' ? d.r : Math.min(d.w, d.h) / 2;
  for (let c = 0; c < dn; c++) {
    const a0 = Math.random() * 6.28, pts = [[Math.cos(a0) * 0.1 * sz, Math.sin(a0) * 0.1 * sz]];
    for (let k = 1; k <= 4; k++) { const b = a0 + (Math.random() - 0.5) * 0.9; pts.push([pts[0][0] + Math.cos(b) * sz * 0.5 * k * (0.8 + Math.random() * 0.4), pts[0][1] + Math.sin(b) * sz * 0.5 * k * (0.8 + Math.random() * 0.4)]); }
    p.cracks.push(pts);
  }
  sparks(at.x, at.y, ang + Math.PI, glance ? 8 : 24); ring(at.x, at.y, glance ? 24 : 44, '#cbd5e1');
  clangSound(E, 0); E.shake(glance ? 2 : 6, 0.12); E.haptic(glance ? 8 : 24);
  let stop = glance ? 0.01 : J.stopClang + 0.02;
  if (p.armour && p.dents >= A.dents) {
    p.armour = false; state.broken++;
    const [sx, sy] = partCenter(foeF(E), state.foe, p);
    plateBits(sx, sy, 9); ring(sx, sy, 70, '#ffe9a8'); pop(sx, sy - 24, 'PLATE BROKEN', '#ffe9a8', 17);
    E.audio.beep({ freq: 110, dur: 0.25, type: 'sine', slide: 0.4, gain: 0.3 }); E.shake(8, 0.2); E.haptic(30);
    stop = J.stopBreak + 0.04;
  } else pop(at.x, at.y - 18, glance ? 'GLANCE' : !p.armour ? 'GUARDED' : p.dents >= A.dents - 1 ? 'DENT!' : 'CLANG', '#9aa4b2', glance ? 13 : 16);
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
  let dmg = kind === 'jab' ? AT.jab.dmg : kind === 'over' ? AT.over.dmg : sp >= T.hit.mid ? AT.slash.fastDmg : AT.slash.dmg;
  if (a.tired) dmg = Math.max(1, Math.floor(dmg * T.stamina.tired));
  dmg *= T.me.str[state.me.str - 1];
  const rip = state.riposte > 0, winded = state.winded > 0;
  if (rip) dmg *= T.shield.riposteMul;
  // the open window multiplies after rounding, so a punish is exactly 1.5x (health can hold halves)
  const dealt = Math.max(1, Math.round(thrust ? dmg * T.foe.slotMul : dmg)) * (winded ? T.foeSta.windedDmg : 1);
  p.cool = T.hit.cool; p.flash = 0.16; state.gapHits++; if (thrust) state.slotHits++; if (winded) state.punishes++;
  f.hp -= dealt;
  const gl = kind === 'jab' ? 0.03 : 0.06;
  if (!slot) { p.hp -= dmg; p.gashes.push([[at.lx - Math.cos(ang) * gl, at.ly - Math.sin(ang) * gl], [at.lx + Math.cos(ang) * gl, at.ly + Math.sin(ang) * gl]]); }
  const big = dealt >= 3;
  const n = Math.min(60, J.strawPerDmg * dealt);
  straw(at.x, at.y, ang + Math.PI / 2, 2.6, 260 + dealt * 50, n >> 1);
  straw(at.x, at.y, ang - Math.PI / 2, 2.6, 260 + dealt * 50, n >> 1);
  dust(at.x, at.y, 3 + dealt * 3);
  sliceSound(E, delay, big);
  pop(at.x, at.y - 20, rip ? `RIPOSTE x${Math.round(dealt)}` : winded ? `PUNISH x${Math.round(dealt)}` : thrust ? `${p.d.label}!` : kind === 'jab' ? 'STAB' : kind === 'over' ? 'SMASH!' : dealt >= 2 ? 'HARD' : 'HIT', rip ? '#ffd24a' : thrust ? '#ff6a4a' : big ? '#ffb347' : '#fff0b8', Math.min(34, 15 + dealt * 4));
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
  state.hp = Math.min(state.maxHp, state.hp + TUNING.heal);
  pop(E.w * 0.62, E.h * 0.3, 'FOE DOWN', '#ffd24a', 28); E.shake(10, 0.3); E.flash('#fff0b8', 0.1); E.audio.play('coin');
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
    const fake = avoid || pickZone(rng, null), real = pickZone(rng, avoid, fake), show = base * M.feint.show, hes = TUNING.lesson.hes;
    mv.hits.push({ ...blow(real, show + hes + M.feint.after * spd, M.feint.dmg, ZONE_POSE[real]), fake, fakePose: ZONE_POSE[fake], switchAt: show, hes });
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
  const k = 1 + TUNING.armSlow * f.parts.filter((p) => (p.d.id === 'armF' || p.d.id === 'armB') && p.cut).length;
  state.sw = {
    zone: ZONE[h.fake || h.zone], real: ZONE[h.zone], fake: h.fake ? ZONE[h.fake] : null, fakePose: h.fakePose, switchAt: (h.switchAt || 0) * k, switched: false,
    t: 0, wind: h.wind * k, dmg: h.dmg, pose: h.pose, kind: mv.kind, idx: mv.idx, n: mv.hits.length, counter: mv.counter, fin: 0, outcome: null, th0: f.th,
    hes: (h.hes || 0) * k, hesOn: false, realAt: 0, dirty: false, lesson: null,
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
function feintSwitch(E) {
  const sw = state.sw;
  sw.switched = true; sw.th0 = state.foe.th; sw.zone = sw.real; sw.realAt = sw.t;
  const Ff = foeF(E); pop(Ff.x - 0.3 * Ff.H, zoneScreenY(lay(E), sw.real) + 0.16 * lay(E).H, 'FEINT!', '#c4b5fd', 20);
  E.audio.beep({ freq: 520, dur: 0.06, type: 'square', slide: 1.6, gain: 0.06 });
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
    if (sw.fake && !sw.switched) {
      // a read needs you to hold still through the fake: no shield, no dodge until the glow jumps
      if (raised() || state.sh.arm > 0 || state.away) sw.dirty = true;
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

// ----- the left hand: three shield buttons and a dodge button (tap = quick sidestep, hold = stay backed off) -----
function shieldBtns(E) {
  const S = TUNING.shield, w = S.btnW, h = S.btnH, tot = 4 * h + 3 * S.gap;
  const y0 = Math.max(E.safe.top + 70, (E.h - tot) / 2 + 20), x = 10 + E.safe.left;
  const out = ZONES.map((z, i) => ({ z, x, y: y0 + i * (h + S.gap), w, h }));
  out.push({ z: null, dodge: true, x, y: y0 + 3 * (h + S.gap), w, h });
  return out;
}

function raiseShield(E, zone, pid) {
  const s = state.sh, Fy = youF(E);
  if (s.broken) { pop(Fy.x, Fy.y - 1.0 * Fy.H, 'NO SHIELD', '#94a3b8', 14); return; }
  if (state.away || state.you.lungeK >= 0.15) return;
  if (!raised() && !(s.arm > 0)) {
    if (s.cool > 0) return;
    s.zone = zone; s.zy = zone.sy;
    if (state.exhaust > 0) { s.arm = TUNING.shield.slow; s.t = -1; } else s.t = 0;
    E.audio.beep({ freq: 260, dur: 0.07, type: 'triangle', slide: 1.5, gain: 0.12 }); E.haptic(8);
  } else if (s.zone !== zone) { s.zone = zone; E.audio.beep({ freq: 330, dur: 0.05, type: 'triangle', gain: 0.08 }); }
  if (pid != null) { s.held = true; s.hid = pid; }
}

function dodge(E, pid) {
  const D = TUNING.dodge, Fy = youF(E), s = state.sh, h = state.hand;
  if (state.away || state.dodgeCool > 0) return;
  if (state.stamina < D.cost) { tiredPop(E); return; }
  state.stamina -= D.cost; state.lastAtk = state.m;
  state.dodges++; state.away = true; state.dodgeT = state.dodgeMax = D.dur * TUNING.me.spdDodge[state.me.spd - 1]; h.atk = null;
  state.dg.down = true; state.dg.id = pid; state.dg.t = 0;
  s.held = false; s.hid = -1; s.t = -1; s.arm = 0;
  pop(Fy.x, Fy.y - 1.0 * Fy.H, 'DODGE', '#7de3ff', 26); swooshSound(E, 0.16); E.haptic(12);
  dust(Fy.x, Fy.y, 8);
}

function updateDefence(dt, E) {
  const s = state.sh, D = TUNING.dodge, S = TUNING.shield, dg = state.dg;
  if (s.held) { state.stamina -= S.drain * dt; state.lastAtk = state.m; if (state.stamina <= 0) { state.stamina = 0; s.held = false; s.hid = -1; s.t = -1; s.cool = S.cool; } }
  if (s.arm > 0) { s.arm -= dt; if (s.arm <= 0) s.t = 0; }
  if (s.t >= 0) { s.t += dt; if (s.t >= S.dur && !s.held) { s.t = -1; s.cool = S.cool; } }
  s.cool = Math.max(0, s.cool - dt); s.flash = Math.max(0, s.flash - dt);
  state.dodgeCool = Math.max(0, state.dodgeCool - dt);
  if (dg.down) {
    dg.t += dt;
    if (dg.t > D.dur) { state.stamina -= D.drain * dt; state.lastAtk = state.m; if (state.stamina <= 0) { state.stamina = 0; dg.down = false; dg.id = -1; } }
  }
  if (state.away && !dg.down && state.dodgeT <= 0) {
    state.away = false; state.dodgeCool = D.cool;
    const Fy = youF(E); pop(Fy.x + 20, Fy.y - 1.0 * Fy.H, 'IN', '#7de3ff', 18); dust(Fy.x, Fy.y, 5);
  }
}

function resolveSwing(E) {
  const sw = state.sw, L = lay(E), zy = zoneScreenY(L, sw.zone), Fy = youF(E), Ff = foeF(E), sh = state.sh, SH = TUNING.shield, M = TUNING.moves, W = state.foe.weapon;
  const net = sw.pose === 'net', bash = sw.pose === 'bash', feint = !!sw.fake;
  sw.fin = 0.4;
  state.streaks.push({ x1: Ff.x - Ff.H * 0.3, y1: zy - 30, x2: Fy.x - L.H * 0.1, y2: zy + 20, life: 0.22, max: 0.22, red: !state.away, net });
  if (state.away) {
    sw.outcome = 'whiff';
    swooshSound(E, 0.2); pop(E.w / 2, zy - 30, net ? 'NET DODGED' : feint ? 'FEINT DODGED' : 'OUT OF REACH', '#7de3ff', 18); return;
  }
  if (blocks(sw.zone)) {
    const perfect = sh.t <= SH.perfect && !net && !bash, bx = Fy.x + 0.28 * L.H, by = zy, read = feint && !sw.dirty;
    sw.outcome = 'block'; state.blocks++; sh.flash = 0.25;
    if (read) feintRead(E, bx, by);
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
      state.kickV += -0.8;
    } else {
      sh.hits -= bash ? 1 : W.wear;
      const drain = bash ? M.bash.drain * M.bash.blocked : W.drain;
      if (drain) { state.stamina = Math.max(0, state.stamina - drain); state.lastAtk = state.m; pop(bx, by - 70, 'DRAINED', '#fca5a5', 14); }
      if (bash) state.pushT = 0.2;
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
  if (feint) state.feintsBit++;
  if (net) {
    sw.outcome = 'net'; state.netT = M.net.dur; state.netted++;
    pop(Fy.x, zy - 40, 'NETTED', '#e2e8f0', 30); E.shake(6, 0.2); E.haptic(30); E.audio.noise({ dur: 0.25, gain: 0.2 });
    return;
  }
  if (bash) {
    sw.outcome = 'bash'; state.bashHits++; state.pushT = 0.35;
    state.stamina = Math.max(0, state.stamina - M.bash.drain); state.lastAtk = state.m;
    pop(Fy.x, zy - 40, 'BASHED', '#fca5a5', 30); E.shake(12, 0.25); E.haptic(45); clangSound(E, 0); E.audio.play('boom', 0.5);
    state.you.kickV -= 8; state.hand.lock = Math.max(state.hand.lock, 0.3); state.hand.hvx = -260; state.hand.hvy = 60; state.hand.atk = null;
    return;
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

// ----- drawing: one procedural body for both fighters -----
function path(ctx, d, H, inset = 0) {
  ctx.beginPath();
  if (d.shape === 'circle') { ctx.arc(d.x * H, d.y * H, (d.r - inset) * H, 0, Math.PI * 2); return; }
  const w = (d.w - inset * 2) * H, h = (d.h - inset * 2) * H, x = d.x * H - w / 2, y = d.y * H - h / 2, r = Math.min(w, h) * 0.18;
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function drawPart(ctx, p, H, st, fr) {
  const d = p.d;
  ctx.save();
  if (fr) { ctx.translate(fr.ox * H, fr.oy * H); ctx.rotate(fr.rot); }
  if (d.id !== 'legs') {
    path(ctx, d, H);
    ctx.fillStyle = p.cut ? '#2b2217' : st.skin; ctx.fill();
    ctx.save(); ctx.clip();
    if (!p.cut && p.hp < TUNING.part.hp) { ctx.fillStyle = `rgba(60,20,10,${(1 - p.hp / TUNING.part.hp) * 0.5})`; ctx.fillRect(-H, -2 * H, 2 * H, 3 * H); }
    for (const g of p.gashes) {
      ctx.strokeStyle = '#0a0705'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(g[0][0] * H, g[0][1] * H); ctx.lineTo(g[1][0] * H, g[1][1] * H); ctx.stroke();
      ctx.strokeStyle = '#a05a3c'; ctx.lineWidth = 1.1; ctx.stroke();
    }
    ctx.restore();
    path(ctx, d, H);
    ctx.strokeStyle = p.cut ? '#120d08' : '#5a3a22'; ctx.lineWidth = 2; ctx.stroke();
    if (p.flash > 0) { path(ctx, d, H); ctx.fillStyle = `rgba(255,250,220,${p.flash / 0.16})`; ctx.fill(); }
  }
  if (p.armour) {
    ctx.save();
    const sh = p.clang > 0 ? p.clang / 0.25 : 0;
    if (sh > 0) ctx.translate((Math.random() - 0.5) * 7 * sh, (Math.random() - 0.5) * 7 * sh);
    const dn = p.dents / TUNING.armour.dents;
    path(ctx, d, H, 0.008 + 0.004 * p.dents);
    const top = (d.y - (d.r || d.h / 2)) * H, bot = (d.y + (d.r || d.h / 2)) * H;
    const g = ctx.createLinearGradient(0, top, 0, bot);
    const dk = (c) => `rgb(${Math.round(c[0] * (1 - dn * 0.35))},${Math.round(c[1] * (1 - dn * 0.35))},${Math.round(c[2] * (1 - dn * 0.3))})`;
    g.addColorStop(0, sh > 0 ? '#e6ebf0' : dk([170, 179, 188])); g.addColorStop(1, sh > 0 ? '#b8c0c8' : dk([89, 97, 106]));
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#2c3238'; ctx.lineWidth = 3; ctx.stroke();
    path(ctx, d, H, 0.026); ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.save(); path(ctx, d, H); ctx.clip();
    for (const c of p.cracks) {
      ctx.fillStyle = 'rgba(20,24,30,0.3)'; ctx.beginPath(); ctx.arc(d.x * H + c[0][0] * H, d.y * H + c[0][1] * H, 0.035 * H, 0, 6.28); ctx.fill();
      ctx.strokeStyle = '#14181e'; ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
      ctx.beginPath(); c.forEach((q, i) => (i ? ctx.lineTo((d.x + q[0]) * H, (d.y + q[1]) * H) : ctx.moveTo((d.x + q[0]) * H, (d.y + q[1]) * H))); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.8; ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#2c3238';
    const rv = (x, y) => { ctx.beginPath(); ctx.arc(x * H, y * H, 2, 0, 6.28); ctx.fill(); };
    if (d.shape === 'circle') ctx.fillRect((d.x - d.r * 0.2) * H, (d.y - 0.01) * H, d.r * 1.2 * H, 0.025 * H);
    else { rv(d.x - d.w * 0.3, d.y - d.h * 0.3); rv(d.x + d.w * 0.3, d.y - d.h * 0.3); rv(d.x - d.w * 0.3, d.y + d.h * 0.3); rv(d.x + d.w * 0.3, d.y + d.h * 0.3); }
    ctx.restore();
  }
  ctx.restore();
}

// A joint slot: a dark slit with a faint rim, riding on its limb.
function drawSlot(ctx, p, H, fm) {
  const d = p.d, fr = d.frame ? fm.fr[d.frame] : null;
  ctx.save();
  if (fr) { ctx.translate(fr.ox * H, fr.oy * H); ctx.rotate(fr.rot); }
  path(ctx, d, H);
  ctx.fillStyle = '#0b0705'; ctx.fill();
  if (state.winded > 0 && fm === state.foe && p.flash <= 0) {
    const k = 0.6 + 0.4 * Math.sin(state.m * 12);
    ctx.save(); ctx.shadowColor = '#ffd24a'; ctx.shadowBlur = 16; ctx.strokeStyle = `rgba(255,210,74,${k})`; ctx.lineWidth = 3.5; ctx.stroke(); ctx.restore();
  } else { ctx.strokeStyle = p.flash > 0 ? '#fff0b8' : 'rgba(255,214,150,0.55)'; ctx.lineWidth = p.flash > 0 ? 3 : 1.5; ctx.stroke(); }
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
}

// Something held in the off hand (far arm), drawn in that arm's frame at the fist.
function offHand(ctx, fr, H, fn) { ctx.save(); ctx.translate(fr.ox * H, fr.oy * H); ctx.rotate(fr.rot); ctx.translate(0, 0.3 * H); fn(); ctx.restore(); }
function drawScutum(ctx, H, k) {
  const w = 0.17 * H * k, h = 0.32 * H * k;
  rrect(ctx, -w / 2, -h / 2, w, h, 0.04 * H * k);
  ctx.fillStyle = '#8f2a24'; ctx.fill(); ctx.strokeStyle = '#e6c866'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#c9a43a'; ctx.beginPath(); ctx.arc(0, 0, 0.03 * H * k, 0, 6.28); ctx.fill();
  ctx.strokeStyle = 'rgba(230,200,102,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -h / 2 + 6); ctx.lineTo(0, h / 2 - 6); ctx.stroke();
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

// who: 'you' or 'foe'. The foe also draws his weapon arm and club; yours is drawn in screen space by drawSwordArm.
function drawFighter(ctx, E, F, fm, st, who) {
  const H = F.H, L = lay(E), isFoe = who === 'foe';
  const P = (id) => fm.parts.find((q) => q.d.id === id);
  const fall = isFoe && state.fallT > 0 ? Math.pow(clamp(state.fallT / 0.5, 0, 1), 2) : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(F.x + (isFoe ? 0 : 0), L.floor + 3, H * 0.22, H * 0.035, 0, 0, 6.28); ctx.fill();
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
  ctx.globalAlpha = isFoe && state.pop < 1 ? 1 - state.pop * 0.7 : 1;
  if (fall > 0) ctx.globalAlpha = 1 - fall * 0.5;
  // far arm
  const armB = P('armB'), sw = isFoe ? state.sw : null, bashing = sw && sw.pose === 'bash';
  drawPart(ctx, armB, H, st, fm.fr.armB);
  if (isFoe && fm.shield && !bashing) offHand(ctx, fm.fr.armB, H, () => drawScutum(ctx, H, 0.75));
  if (isFoe && fm.weapon.id === 'dagger' && !(sw && sw.pose === 'net' && sw.fin <= 0)) offHand(ctx, fm.fr.armB, H, () => drawNet(ctx, 0, 0.03 * H, 0.07 * H));
  // legs, two segments each, a stance that shifts with the sway
  const legs = P('legs'), lc = legs.cut ? '#2b2217' : st.skin, wob = Math.sin(state.m * 2.1) * 0.015;
  limb(ctx, [[-0.02 * H, -0.37 * H], [-0.07 * H, -0.19 * H], [(-0.12 + wob) * H, -0.02 * H]], 0.075 * H, lc);
  limb(ctx, [[0.02 * H, -0.37 * H], [0.09 * H, -0.2 * H], [(0.12 - wob) * H, -0.02 * H]], 0.075 * H, lc);
  ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = 0.055 * H; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo((-0.12 + wob) * H, -0.012 * H); ctx.lineTo((-0.07 + wob) * H, -0.012 * H); ctx.moveTo((0.12 - wob) * H, -0.012 * H); ctx.lineTo((0.17 - wob) * H, -0.012 * H); ctx.stroke();
  if (legs.armour) drawPart(ctx, legs, H, st, null);
  // tunic
  ctx.fillStyle = st.tunic; ctx.strokeStyle = st.hem; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-0.11 * H, -0.42 * H); ctx.lineTo(0.11 * H, -0.42 * H); ctx.lineTo(0.15 * H, -0.27 * H); ctx.lineTo(-0.14 * H, -0.27 * H); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = st.hem; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-0.01 * H, -0.4 * H); ctx.lineTo(0.0 * H, -0.28 * H); ctx.stroke();
  drawPart(ctx, P('belly'), H, st, null);
  ctx.fillStyle = '#3a2a1a'; ctx.fillRect(-0.105 * H, -0.5 * H, 0.21 * H, 0.03 * H);
  ctx.fillStyle = '#d6b04a'; ctx.fillRect(0.0 * H, -0.505 * H, 0.04 * H, 0.04 * H);
  drawPart(ctx, P('chest'), H, st, null);
  if (!P('chest').armour) { ctx.strokeStyle = '#4a2f1a'; ctx.lineWidth = 0.025 * H; ctx.beginPath(); ctx.moveTo(-0.09 * H, -0.68 * H); ctx.lineTo(0.09 * H, -0.54 * H); ctx.stroke(); }
  // neck and head with a gladiator helm
  ctx.fillStyle = P('head').cut ? '#2b2217' : st.skin; ctx.fillRect(-0.025 * H, -0.74 * H, 0.06 * H, 0.06 * H);
  const head = P('head'), hx = head.d.x * H, hy = head.d.y * H, hr = head.d.r * H;
  drawPart(ctx, head, H, st, null);
  if (!head.armour) {
    ctx.fillStyle = st.cap; ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(hx, hy, hr * 1.06, Math.PI * 0.92, Math.PI * 2.04); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = head.cut ? '#6a6a6a' : '#1a1410'; ctx.beginPath(); ctx.arc(hx + hr * 0.45, hy - hr * 0.05, 0.012 * H + 1, 0, 6.28); ctx.fill();
  }
  ctx.fillStyle = st.crest; ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(hx + hr * 0.7, hy - hr * 0.8); ctx.quadraticCurveTo(hx, hy - hr * 2.0, hx - hr * 1.5, hy - hr * 0.5); ctx.lineTo(hx - hr * 0.9, hy - hr * 0.55); ctx.quadraticCurveTo(hx, hy - hr * 1.45, hx + hr * 0.4, hy - hr * 0.95); ctx.closePath(); ctx.fill(); ctx.stroke();
  // the foe's weapon arm and club
  if (isFoe) {
    const arm = P('armF'), fr = fm.fr.armF;
    drawPart(ctx, arm, H, st, fr);
    ctx.save(); ctx.translate(fr.ox * H, fr.oy * H); ctx.rotate(fr.rot);
    ctx.fillStyle = st.skin; ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, ARM_LEN * H, 0.042 * H, 0, 6.28); ctx.fill(); ctx.stroke();
    if (hesitating()) {
      ctx.save(); ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 24; ctx.strokeStyle = `rgba(167,139,250,${0.5 + 0.4 * Math.sin(state.m * 60)})`; ctx.lineWidth = 0.07 * H; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, ARM_LEN * H); ctx.lineTo(0, (ARM_LEN + fm.weapon.len) * H); ctx.stroke(); ctx.restore();
    }
    if (sw && sw.pose === 'net' && sw.fin <= 0) drawNet(ctx, 0, (ARM_LEN + 0.05) * H, 0.1 * H); else drawWeapon(ctx, fm, H);
    ctx.restore();
    for (const q of fm.parts) if (q.slot) drawSlot(ctx, q, H, fm);
    if (fm.shield && bashing) { ctx.save(); ctx.translate((0.2 + 0.1 * (sw.fin > 0 ? 1 : clamp(sw.t / sw.wind, 0, 1))) * H, -0.52 * H); drawScutum(ctx, H, 1); ctx.restore(); }
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

// Your sword arm and gladius, in screen space. The blade is a leaf: broad, tapering to a point.
function drawSwordArm(ctx, E) {
  const h = state.hand, H = myH(E), locked = h.lock > 0, blade = TUNING.blade.len * H, w = 0.034 * H;
  const bx = h.bx, by = h.by, nx = -by, ny = bx;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (state.trail.length > 1 && h.sp >= TUNING.hit.minSpeed) {
    ctx.strokeStyle = 'rgba(125,227,255,0.35)'; ctx.lineWidth = 8; ctx.beginPath();
    state.trail.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
  }
  limb(ctx, [[h.sx, h.sy], [h.ex, h.ey], [h.hx, h.hy]], 0.075 * H, YOU.skin);
  ctx.fillStyle = YOU.tunic; ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(h.sx, h.sy, 0.058 * H, 0, 6.28); ctx.fill(); ctx.stroke();
  // grip, pommel, crossguard
  ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(h.hx - bx * 0.07 * H, h.hy - by * 0.07 * H); ctx.lineTo(h.hx + bx * 0.04 * H, h.hy + by * 0.04 * H); ctx.stroke();
  ctx.fillStyle = '#c9a43a'; ctx.beginPath(); ctx.arc(h.hx - bx * 0.08 * H, h.hy - by * 0.08 * H, 5, 0, 6.28); ctx.fill();
  const gx = h.hx + bx * 0.05 * H, gy = h.hy + by * 0.05 * H;
  ctx.strokeStyle = '#c9a43a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(gx - nx * 0.05 * H, gy - ny * 0.05 * H); ctx.lineTo(gx + nx * 0.05 * H, gy + ny * 0.05 * H); ctx.stroke();
  const a = h.atk, hot = a && !a.done && h.sp >= TUNING.hit.minSpeed && !locked;
  const P = (t, s) => [gx + bx * blade * t + nx * w * s, gy + by * blade * t + ny * w * s];
  const poly = [P(0, -0.8), P(0.3, -1), P(0.72, -0.7), P(1, 0), P(0.72, 0.7), P(0.3, 1), P(0, 0.8)];
  const draw = () => { ctx.beginPath(); poly.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); };
  if (hot) { ctx.strokeStyle = a.kind === 'over' ? 'rgba(255,200,90,0.5)' : 'rgba(125,227,255,0.45)'; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(h.ux, h.uy); ctx.stroke(); }
  draw(); ctx.fillStyle = locked ? '#ff8a7a' : '#dfe6ee'; ctx.fill(); ctx.strokeStyle = '#1b2026'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(gx + bx * 6, gy + by * 6); ctx.lineTo(h.ux - bx * 6, h.uy - by * 6); ctx.stroke();
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
  const worn = TUNING.shield.hits - sh.hits;
  ctx.strokeStyle = '#1a120a'; ctx.lineWidth = 2;
  for (let i = 0; i < worn; i++) { const a = i * 1.7 + 0.5; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.25, Math.sin(a) * r * 0.25); ctx.lineTo(Math.cos(a + 0.2) * r * 0.65, Math.sin(a + 0.2) * r * 0.65); ctx.lineTo(Math.cos(a - 0.1) * r * 0.95, Math.sin(a - 0.1) * r * 0.95); ctx.stroke(); }
  if (sh.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${sh.flash / 0.25 * 0.5})`; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.28); ctx.fill(); }
  ctx.restore();
}

// The shield buttons and the dodge button. The shield button matching the foe's tell glows; the raised one is lit; Dodge lights while you are backed off.
function drawShieldBtns(ctx, E) {
  const sh = state.sh, sw = state.sw, tell = sw && sw.fin <= 0 && !hesitating() ? sw.zone : null, fakeBtn = hesitating() ? sw.zone : null;
  const pulse = 0.5 + 0.5 * Math.sin(state.m * 14);
  for (const b of shieldBtns(E)) {
    if (b.dodge) {
      const on = state.away, cd = state.dodgeCool > 0 && !on;
      E.roundRect(b.x, b.y, b.w, b.h, 12, on ? 'rgba(125,227,255,0.8)' : cd ? 'rgba(20,16,26,0.3)' : 'rgba(20,40,52,0.6)', on ? '#d7f6ff' : 'rgba(125,227,255,0.6)');
      E.text('DODGE', b.x + b.w / 2, b.y + b.h / 2 - (state.dg.down ? 6 : 0), { size: 13, weight: '800', color: on ? '#0b2530' : '#bff0ff' });
      if (state.dg.down) E.text('hold', b.x + b.w / 2, b.y + b.h / 2 + 10, { size: 10, color: '#0b2530' });
      continue;
    }
    const on = raised() && sh.zone === b.z, hot = tell === b.z, perfect = hot && sw.wind - sw.t <= TUNING.shield.perfect;
    const fill = on ? 'rgba(214,162,74,0.85)' : hot ? `rgba(255,${perfect ? 220 : 120},60,${0.45 + 0.4 * pulse})` : sh.arm > 0 && sh.zone === b.z ? 'rgba(214,162,74,0.35)' : 'rgba(20,16,26,0.55)';
    E.roundRect(b.x, b.y, b.w, b.h, 12, sh.broken ? 'rgba(40,40,46,0.6)' : fill, hot ? '#ffd24a' : on ? '#fff0b8' : 'rgba(240,230,204,0.45)');
    if (hot) { ctx.save(); ctx.shadowColor = '#ffb347'; ctx.shadowBlur = 18; E.roundRect(b.x, b.y, b.w, b.h, 12, null, '#ffb347'); ctx.restore(); }
    if (fakeBtn === b.z) E.roundRect(b.x, b.y, b.w, b.h, 12, `rgba(167,139,250,${0.2 + 0.25 * pulse})`, '#c4b5fd');
    E.text(b.z.label, b.x + b.w / 2, b.y + b.h / 2, { size: 15, weight: '800', color: on ? '#2a1c10' : '#f0e6cc' });
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
function drawIntro(ctx, E) {
  const d = state.foe, w = Math.min(E.w - 32, 460), h = Math.min(E.h - 40, 300), x = (E.w - w) / 2, y = (E.h - h) / 2;
  ctx.fillStyle = 'rgba(10,8,14,0.6)'; ctx.fillRect(0, 0, E.w, E.h);
  E.roundRect(x, y, w, h, 18, '#221a2b', d.champion ? '#ffd24a' : '#e6c866');
  E.text(d.champion ? `THE CHAMPION  \u00b7  BOUT ${state.rack + 1} OF ${state.gauntlet.length}` : `BOUT ${state.rack + 1} OF ${state.gauntlet.length}${bout().spar ? '  \u00b7  SPARRING' : ''}`, E.w / 2, y + 22, { size: 13, weight: '800', color: d.champion ? '#ffd24a' : '#c4b99a' });
  E.text(d.name.toUpperCase(), E.w / 2, y + 52, { size: d.name.length > 14 ? 24 : 30, weight: '800', color: '#f0e6cc' });
  const col = x + 28, s = Math.min(110, h * 0.42);
  armourIcon(ctx, foeParts(makeRng(d.partSeed), d.set), col + 40, y + 96 + s * 0.92, s);
  E.text(`${d.set.name} ARMOUR`, col + 40, y + h - 58, { size: 12, weight: '800', color: '#aab3bc' });
  E.text(`${d.set.slots} gaps open`, col + 40, y + h - 42, { size: 11, color: '#c4b99a' });
  const rx = x + w * 0.38, rw = w * 0.56;
  E.text(`${d.size.name}`, rx, y + 92, { size: 18, weight: '800', align: 'left', color: '#fde68a' });
  E.text(d.weapon.alt && d.mace ? d.weapon.alt : d.weapon.name, rx, y + 120, { size: 18, weight: '800', align: 'left', color: '#f0e6cc' });
  weaponIcon(ctx, d, rx + rw - 14 - d.weapon.len * 110, y + 112, 110);
  E.text(WEAPON_TIP[d.weapon.id] + (d.shield ? ', carries a shield' : ''), rx, y + 142, { size: 12, align: 'left', color: '#9aa4b2' });
  statBars(ctx, E, d, rx, y + 172, rw, 24, 13);
  if (bout().spar) E.text('Sparring: learn his tells.', rx, y + h - 50, { size: 15, weight: '800', align: 'left', color: '#7de3ff' });
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
];
const STAT_COLS = ['#8b2e2e', '#a8642e', '#9a8c32', '#5f8f3e', '#2f7d6d'];
const shortOf = (e) => (typeof e[0] === 'number' ? `${e[0]}` : e[0].length > 1 ? e[2][0] : e[0]);
const halvesText = (n) => `${Math.floor(n / 2)}${n % 2 ? '½' : ''}`;

// One wheel: segments sized by their odds, a pointer on top. rot turns the wheel; the landed segment sits under the pointer.
function drawWheel(ctx, E, wh, cx, cy, r, rot, landed, dim) {
  const list = wh.list(), tot = list.reduce((a, e) => a + e[1], 0);
  let a0 = -Math.PI / 2 + rot;
  list.forEach((e, i) => {
    const a1 = a0 + e[1] / tot * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, a0, a1); ctx.closePath();
    ctx.fillStyle = (wh.cols || STAT_COLS)[i]; ctx.globalAlpha = dim * (landed == null || landed === i ? 1 : 0.45); ctx.fill(); ctx.globalAlpha = dim;
    ctx.strokeStyle = '#14101a'; ctx.lineWidth = 2; ctx.stroke();
    const am = (a0 + a1) / 2;
    E.text(shortOf(e), cx + Math.cos(am) * r * 0.66, cy + Math.sin(am) * r * 0.66, { size: 15, weight: '800', color: '#fff7e0', alpha: dim });
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
function drawMeCard(ctx, E, me, x, y, w, h) {
  const M = TUNING.me, S = M.sizes[me.size], A = M.armour[me.set];
  E.roundRect(x, y, w, h, 18, '#1d2a2a', '#4ade80');
  E.text('YOUR FIGHTER', x + w / 2, y + 22, { size: 13, weight: '800', color: '#9fe3c6' });
  const s = Math.min(120, h * 0.42) * S.scale;
  armourIcon(ctx, meParts(me), x + 78, y + h - 66, s);
  E.text(`${A.name} ARMOUR`, x + 78, y + h - 44, { size: 12, weight: '800', color: '#aab3bc' });
  E.text(me.plates.length ? `plated: ${me.plates.map((q) => (q === 'armB' ? 'shield arm' : q)).join(', ')}` : '', x + 78, y + h - 28, { size: 10, color: '#c4b99a' });
  const rx = x + w * 0.36, rw = w * 0.42;
  E.text(S.name, rx, y + 56, { size: 22, weight: '800', align: 'left', color: '#fde68a' });
  E.text(SIZE_TIP[me.size], rx, y + 78, { size: 12, align: 'left', color: '#9aa4b2' });
  E.text(`♥ ${halvesText(me.halves)} hearts${me.underdog ? '  (+½ underdog)' : ''}`, rx, y + 102, { size: 15, weight: '800', align: 'left', color: '#f87171' });
  statBars(ctx, E, me, rx, y + 130, rw, 24, 13);
  const tx = x + w - 54, ty = y + 78, tc = TIER_COL[me.tier];
  ctx.strokeStyle = tc; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(tx, ty, 34, 0, 6.28); ctx.stroke();
  E.text(me.tier, tx, ty + 2, { size: 44, weight: '800', color: tc });
  E.text('TIER', tx, ty + 48, { size: 11, weight: '800', color: '#c4b99a' });
  if (me.underdog) {
    const k = 0.75 + 0.25 * Math.sin(E.time * 6);
    E.text('Underdog!', tx, ty + 76, { size: 18, weight: '800', color: '#ffd24a', alpha: k });
  }
}
function meMini(ctx, E, me, x, y, w, h) {
  E.roundRect(x, y, w, h, 12, '#1d2a2a', '#4ade80');
  E.text('YOU', x + w / 2, y + 13, { size: 10, weight: '800', color: '#9fe3c6' });
  E.text(`TIER ${me.tier}`, x + w / 2, y + 30, { size: 14, weight: '800', color: TIER_COL[me.tier] });
  E.text(`${me.size} · ♥ ${halvesText(me.halves)}${me.underdog ? ' · UNDERDOG' : ''}`, x + w / 2, y + 47, { size: 10, weight: '700', color: '#fde68a' });
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
    E.text(relative() ? 'Right thumb: sword, anywhere on the right. Move it like a trackpad: push to jab, sweep to slash, up then down to overhead. Push far past your reach to lunge.' : 'Right thumb: sword. Jab out, slash, overhead. Aim for the dark slits. Push past your reach to lunge.', E.w / 2, E.h * 0.22 + 40, { size: 14, color: '#9aa4b2' });
    E.text('Left thumb: High, Mid, Low = shield (hold to keep it up); Dodge = tap to sidestep, hold to stay back.', E.w / 2, E.h * 0.22 + 62, { size: 14, color: '#9aa4b2' });
    E.text('Roll your own fighter, then face a gauntlet of five. Your hearts carry over; each one felled gives half a heart back.', E.w / 2, E.h * 0.22 + 84, { size: 14, color: '#c4b99a' });
    E.text(`Best: ${E.save.get('best2', 0)} gap hits`, E.w / 2, E.h * 0.22 + 108, { size: 17, color: '#fbbf24' });
    this.btnPlay = E.button('Play', E.w / 2, E.h * 0.62);
    this.btnMute = E.button(E.audio.muted ? 'Sound: off' : 'Sound: on', E.w / 2, Math.min(E.h * 0.62 + 66, E.h - 30 - E.safe.bottom), { fill: '#1f2937', w: 160, h: 44, size: 16 });
  },
  onTap(p, E) {
    if (this.btnPlay && E.hit(this.btnPlay, p)) { E.audio.play('tap'); E.setScene('roll', { seed: (Math.random() * 2 ** 32) >>> 0 }); }
    else if (this.btnMute && E.hit(this.btnMute, p)) { E.audio.toggleMute(); E.audio.play('tap'); }
  },
};

// Before the gauntlet: your fighter's five wheels, one after another (tap stops the spinning one), then your card and Fight!
const roll = {
  enter(E, params) { this.seed = params.seed; this.me = rollMe(this.seed); this.i = 0; this.t = 0; this.landed = false; this.cardT = 0; this.btn = null; },
  update(dt, E) {
    if (portrait(E)) return;
    const M = TUNING.me;
    if (this.i >= WHEELS.length) { this.cardT += dt; return; }
    this.t += dt;
    if (!this.landed && this.t >= M.spin) this.land(E);
    if (this.t >= M.spin + M.pause) { this.i++; this.t = 0; this.landed = false; }
  },
  land(E) {
    this.landed = true; this.t = Math.max(this.t, TUNING.me.spin);
    E.audio.beep({ freq: 440 + this.i * 90, dur: 0.08, type: 'triangle', gain: 0.12 }); E.haptic(10);
  },
  render(ctx, E) {
    if (portrait(E)) { this.btn = null; rotateCard(ctx, E); return; }
    const M = TUNING.me, me = this.me, top = E.safe.top + 22, n = WHEELS.length;
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
        E.text(`${shortOf(e)}  ${e[2]}  ${Math.round(e[1] / tot * 100)}%`, cx, cy + r + 34 + j * 14, { size: hit ? 12 : 11, weight: hit ? '800' : '600', color: hit ? '#ffd24a' : '#8a8f99' });
      });
    });
    if (this.i < n) E.text('tap to stop the wheel', E.w / 2, E.h - 14 - E.safe.bottom, { size: 12, color: '#c4b99a', alpha: 0.6 + 0.4 * Math.sin(E.time * 4) });
    else {
      const k = clamp(this.cardT / 0.25, 0, 1), w = Math.min(E.w - 32, 480), h = Math.min(E.h - 30, 290), x = (E.w - w) / 2, y = (E.h - h) / 2 - 8 + (1 - k) * 30;
      ctx.fillStyle = `rgba(10,8,14,${0.65 * k})`; ctx.fillRect(0, 0, E.w, E.h);
      ctx.globalAlpha = k;
      drawMeCard(ctx, E, me, x, y, w, h);
      ctx.globalAlpha = 1;
      this.btn = E.button('Fight!', x + w - 92, y + h - 36, { w: 140, h: 46, size: 20, fill: '#b45309' });
    }
  },
  onTap(p, E) {
    if (portrait(E)) return;
    if (this.i < WHEELS.length) {
      if (!this.landed) this.land(E); else { this.i++; this.t = 0; this.landed = false; }
      return;
    }
    if (this.cardT > 0.3 && this.btn && E.hit(this.btn, p)) { E.audio.play('tap'); E.setScene('play', { seed: this.seed, me: this.me }); }
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
  state, lay, foeF, youF, toScreen, newRack, raiseShield, dodge, fell, blockRun, ZONE, TUNING, rollMe, solveArm, windFoe, gapHit, bout,
  enter(E, params) { newRound(E, params.seed, params.me || rollMe(params.seed)); initHand(E); },
  update(dt, E) {
    if (portrait(E)) return;
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
    state.netT = Math.max(0, state.netT - dt); state.pushT = Math.max(0, state.pushT - dt);
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
        state.rack++; newRack(E); poseFoe(E, 0.016);
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
    const best = E.save.get('best2', 0), isNew = state.gapHits > best;
    if (isNew) E.save.set('best2', state.gapHits);
    const g = state.gauntlet, won = state.results.filter((r) => r === 'felled').length >= g.length, reached = Math.min(g.length, state.rack + 1);
    const r = { gapHits: state.gapHits, slotHits: state.slotHits, lunges: state.lunges, clangs: state.clangs, broken: state.broken, overheads: state.overheads, jabs: state.jabs, slashes: state.slashes, blocks: state.blocks, perfects: state.perfects, dodges: state.dodges, staOuts: state.staOuts, counters: state.counters, counterHits: state.counterHits, taken: state.taken, felled: state.felled,
      feints: state.feints, feintsRead: state.feintsRead, feintsBit: state.feintsBit, combos: state.combos, windeds: state.windeds, punishes: state.punishes, bashes: state.bashes, bashHits: state.bashHits, nets: state.nets, netted: state.netted,
      zoneReads: state.zoneReads, lungeReads: state.lungeReads, turtleReads: state.turtleReads, presses: state.presses, retreats: state.retreats, plateSaves: state.plateSaves };
    const me = state.me;
    E.ledger.add('result', { ...r, won, reached, halves: state.hp, sizes: g.map((d) => d.size.id).join(''), weapons: g.map((d) => d.weapon.id).join(','), armour: g.map((d) => d.set.id[0]).join(''),
      stats: g.map((d) => `${d.str}${d.spd}${d.sta}`).join(','), champ: g[g.length - 1].name, lostTo: won ? '' : `${g[reached - 1].name} ${g[reached - 1].size.id} ${g[reached - 1].weapon.id}`,
      moves: Object.entries(state.moveCount).map(([k, v]) => `${k}${v}`).join(','),
      meSize: me.size, meStats: `${me.str}${me.spd}${me.sta}`, meArmour: me.set, mePlates: me.plates.join(','), meTier: me.tier, underdog: me.underdog ? 1 : 0, bout1Loss: !won && reached === 1 ? 1 : 0 });
    E.setScene('over', { ...r, won, reached, hp: state.hp, gauntlet: g, me, results: state.results.slice(), best: Math.max(best, state.gapHits), isNew });
  },
  // two thumbs: a touch that starts in the left third is the shield and dodge thumb (buttons only), any other is the sword thumb
  onPointerDown(p, E) {
    if (state.endT > 0 || portrait(E) || state.intro) return;
    if (p.startX < E.w / 3) {
      const b = shieldBtns(E).find((q) => p.x >= q.x - 6 && p.x <= q.x + q.w + 6 && p.y >= q.y - 4 && p.y <= q.y + q.h + 4);
      if (b && b.dodge) dodge(E, p.id);
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
    const h = state.hand;
    if (h.down && h.id === p.id) { h.fx = p.x; h.fy = p.y; }
  },
  onTap(p, E) {
    if (state.intro && state.introT > 0.35 && !portrait(E)) { state.intro = false; state.swingIn = 1.2; E.audio.play('tap'); }
  },
  onPointerUp(p) {
    const s = state.sh, h = state.hand, dg = state.dg;
    if (dg.down && dg.id === p.id) { dg.down = false; dg.id = -1; }
    else if (s.hid === p.id) { s.held = false; s.hid = -1; }
    else if (h.down && h.id === p.id) { h.down = false; h.hist = []; h.sp = 0; h.atk = null; }
  },
  render(ctx, E) {
    if (portrait(E)) { rotateCard(ctx, E); return; }
    ctx.save();
    drawBackground(ctx, E);
    drawFighter(ctx, E, youF(E), state.you, YOU, 'you');
    if (state.netT > 0) { const Fy = youF(E); drawNet(ctx, Fy.x, Fy.y - 0.55 * Fy.H, 0.32 * Fy.H * clamp(state.netT / 0.3, 0.6, 1)); }
    drawFighter(ctx, E, foeF(E), state.foe, FOE, 'foe');
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
    const top = 10 + E.safe.top, l = 16 + E.safe.left, r = 16 + E.safe.right, TS = TUNING.stamina, SHD = TUNING.shield;
    E.text(`BOUT ${state.rack + 1}/${state.gauntlet.length}`, l, top + 14, { size: 20, align: 'left', weight: '800', color: state.foe.champion ? '#ffd24a' : '#e6e6e6' });
    E.text(`${state.felled} felled`, l, top + 38, { size: 12, align: 'left', color: '#c4b99a' });
    E.text(`${state.gapHits}`, E.w / 2, top + 14, { size: 34, weight: '800', color: '#ffd24a' });
    E.text('gap hits', E.w / 2, top + 38, { size: 11, color: '#c4b99a' });
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
    for (let i = 0; i < SHD.hits; i++) {
      ctx.fillStyle = state.sh.broken ? '#3b3f46' : i < state.sh.hits ? '#d6a24a' : '#3b3f46';
      ctx.fillRect(bx + i * (bw / SHD.hits), top + 60, bw / SHD.hits - 4, 7);
    }
    E.text(state.sh.broken ? 'shield broken' : 'shield', bx - 6, top + 66, { size: 10, align: 'right', color: state.sh.broken ? '#ef4444' : '#c4b99a' });
    if (state.away) E.text(state.dg.down && state.dg.t > TUNING.dodge.dur ? 'backed off (burning stamina)' : 'dodge', bx + bw, top + 80, { size: 10, align: 'right', color: '#7de3ff' });
    if (state.riposte > 0) E.text('RIPOSTE x2', E.w / 2, top + 62, { size: 16, weight: '800', color: '#ffd24a' });
    if (state.netT > 0) E.text('NETTED: slow hand, no lunge', bx + bw, top + 94, { size: 11, align: 'right', color: '#e2e8f0', weight: '700' });
    if (state.rack === 0 && !state.intro && state.m < 10) E.text('left: High / Mid / Low = shield, Dodge  |  right thumb: sword (' + (relative() ? 'trackpad, push far to lunge' : 'push past reach to lunge') + ')', E.w / 2, E.h - 8 - E.safe.bottom, { size: 12, color: '#f0e6cc', alpha: clamp((10 - state.m) / 1.5, 0, 1) });
    if (state.intro) drawIntro(ctx, E);
  },
  onPause() {},
};

const over = {
  enter(E, params) {
    this.p = params; this.k = 0;
    E.audio.play(params.won ? 'win' : 'lose');
    E.tween(0.5, (t) => { this.k = t; });
  },
  render(ctx, E) {
    const p = this.p, g = p.gauntlet, top = E.safe.top + 26;
    if (portrait(E)) { rotateCard(ctx, E); return; }
    const last = g[p.reached - 1];
    E.text(p.won ? 'CHAMPION FELLED' : `Cut down by ${last.name}`, E.w / 2, top, { size: 26, weight: '800', color: p.won ? '#ffd24a' : '#ef4444' });
    E.text(`Reached bout ${p.reached} of ${g.length}  \u00b7  ${p.felled} felled  \u00b7  ${Math.round(p.gapHits * this.k)} gap hits  \u00b7  ${p.isNew ? 'new best!' : `best ${p.best}`}`, E.w / 2, top + 26, { size: 14, color: '#fbbf24' });
    const n = g.length + 1, gap = 8, w = Math.min(150, (E.w - 32 - E.safe.left - E.safe.right - gap * (n - 1)) / n), h = 150, x0 = (E.w - (w * n + gap * (n - 1))) / 2, y0 = top + 44;
    meMini(ctx, E, p.me, x0, y0, w, h);
    g.forEach((d, i) => miniCard(ctx, E, d, x0 + (i + 1) * (w + gap), y0, w, h, p.results[i] || null));
    const lines = [
      `${p.jabs} jabs | ${p.slashes} slashes | ${p.overheads} overheads | ${p.slotHits} joint hits | ${p.lunges} lunges | ${p.clangs} clangs | ${p.broken} plates`,
      `${p.blocks} blocks (${p.perfects} perfect) | ${p.dodges} dodges | ${p.taken} hits taken | ${p.staOuts} stamina-outs | ${p.counters} counters (${p.counterHits} hit)`,
      `feints read ${p.feintsRead} of ${p.feints} (${p.feintsBit} bit) | ${p.combos} combos | winded ${p.windeds}x, ${p.punishes} punishes | bashed ${p.bashHits}/${p.bashes} | netted ${p.netted}/${p.nets}`,
    ];
    lines.forEach((s, i) => E.text(s, E.w / 2, y0 + h + 16 + i * 18, { size: 12, color: '#cbd5e1' }));
    const by = Math.min(E.h - 30 - E.safe.bottom, y0 + h + 94);
    this.btnAgain = E.button('Again', E.w / 2 - 80, by, { w: 140, h: 46, size: 19 });
    this.btnMenu = E.button('Menu', E.w / 2 + 80, by, { w: 140, h: 46, size: 19, fill: '#334155' });
  },
  onTap(p, E) {
    if (this.btnAgain && E.hit(this.btnAgain, p)) E.setScene('roll', { seed: (Math.random() * 2 ** 32) >>> 0 });
    else if (this.btnMenu && E.hit(this.btnMenu, p)) E.setScene('menu');
  },
};

const STD = { offset: 50, 'hand.lag': 0.035, 'hit.minSpeed': 450, 'stamina.regen': 32, 'attack.over.cost': 28, 'shield.perfect': 0.15, 'shield.hits': 4, 'shield.drain': 6, 'open.dur': 0.8, 'swing.windup': 0.7, 'swing.gap': 2.0, 'counter.windup': 0.55, 'dodge.cost': 18 };

export const game = {
  slug: 'arena',
  title: 'Arena',
  saveVersion: 1,
  migrate(data, fromVersion) { return data; },
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
