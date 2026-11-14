// Arena: Drawing the fight: the fighters and their kit, beasts, weapons, the arena and the HUD.
// Split from game.js by tools/arena-split.mjs (ADR-0024). Only tuning.js and data.js may be read while modules load.

import { clamp, lerp } from './engine.js';
import { TUNING } from './tuning.js';
import { bandOf, TAILOR, DECK, CARD, rarCol, gearOf, PARTS, ARM_LEN, SHOULDER, BEAST_BODY, POSE_NAME, mkPart } from './data.js';
import { lay, beastOf, rearOf, youF, walls, myH, myBlade, foeF, toScreen, partCenter, zoneScreenY, openNow, shieldPos, raised, shieldMax, beastRestQ,
  knee, colRect, shieldBtns, myKey, sand } from './fight.js';
import { hesitating, covering, covered, LIMB, lamed, edgeF, poseEdge } from './foe.js';
import { perfectWin, finCost, finReady, finLive, finBtn, firstRun } from './cards.js';
import { fitSize, wrapPx } from './screens.js';
import { ink, over } from './scenes.js';
import { arena, bg, state, easeOut, wrap, pidx, noDodge, noShield, meSize, meWeapon, ART, artV, ENG, IMGS, artImg, artReady, BACKDROP, kitOn } from './game.js';
import { bowShown, armsW, drawBow, drawSlung } from './features/ranged.js';

// ====== DRAWING: the fighters, the arena, the HUD, cards and wheels ======
const YOU = { skin: '#c58f5e', tunic: '#2f7d6d', hem: '#1d5448', crest: '#e6c866' };

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
  'beast-lion-head': 'Lion, head', 'beast-lion-tail': 'Lion, tail', 'beast-bear-head': 'Bear, head', 'kit-base-upperarm-seg': 'Upper arm, muscular, one segment',
};
for (const [k, n] of [['torso', 'Torso'], ['upperarm', 'Upper arm'], ['forearm', 'Forearm'], ['thigh', 'Thigh'], ['shin', 'Shin']]) ART_NAMES[`kit-base-${k}`] = `${n}, muscular`;
ART_NAMES['kit-base-torso-lean'] = 'Torso, lean'; ART_NAMES['kit-base-torso-avg'] = 'Torso, average';
// Step 16: the beasts' barding, the laurel ring
for (const [k, kn] of [['lion', 'Lion'], ['bear', 'Bear']]) for (const [p, pn] of [['head', 'head guard'], ['chest', 'chest plate'], ['back', 'back plate'], ['leg', 'foreleg guard']]) ART_NAMES[`beast-${k}-armour-${p}`] = `${kn}, ${pn}`;
ART_NAMES['laurel-ring'] = "Laurel ring (a cleared arena's)";
// Step 6d (Pack 21): a whole limb is picked by its upper half
for (const [t, tn] of [['lean', 'lean'], ['avg', 'average'], ['musc', 'muscular']]) { ART_NAMES[`kit-arm-up-${t}`] = `Arm, ${tn} (both halves)`; ART_NAMES[`kit-leg-up-${t}`] = `Leg, ${tn} (both halves)`; }
for (const k of ['lion', 'bear']) for (const [y, yn] of [['', k[0].toUpperCase() + k.slice(1)], ['-young', `Young ${k}`]]) {
  ART_NAMES[`beast-${k}-torso${y}`] = `${yn}, torso`;
  ART_NAMES[`beast-${k}-fore-up${y}`] = `${yn}, foreleg (both halves)`; ART_NAMES[`beast-${k}-hind-up${y}`] = `${yn}, hind leg (both halves)`;
}
// Step 6c-2 (Pack 20): the card gear by the card's gear name, the draped net
// a card's painted piece: its gear name as a file (Matador's Ribbons is the one whose file drops the 's)
const GEAR_FILE = { matador: 'gear-matador-ribbons' };
const gearFile = (c) => GEAR_FILE[c.id] || `gear-${c.gear.toLowerCase().replace(/'/g, '').replace(/\s+/g, '-')}`;
for (const c of DECK) if (c.slot && TUNING.kit.gear[gearFile(c)]) ART_NAMES[gearFile(c)] = `${c.gear} (${c.name} card)`;
ART_NAMES['kit-net-draped'] = 'Net, draped over a netted fighter';
// Step 14: a weapon's painting (TUNING.kit.weapon) by its id, the mace by its own
export const weaponKey = (id, mace) => (id === 'axe' && mace ? 'mace' : id);
export const weaponArt = (key) => `weapon-${key === 'wooden' ? 'wooden-sword' : key}`;
// a tailor's look's file
const tailorFile = (item, t) => `tailor-${item}-${TAILOR[item][t.i][0].toLowerCase()}`;
// Step 14 (Packs 22 and 23): the weapons, the title, the tailor's looks
for (const k of Object.keys(TUNING.kit.weapon)) if (TUNING.kit.weapon[k].size) ART_NAMES[weaponArt(k)] = k === 'wooden' ? 'Wooden sword (freedom)' : `Weapon: ${k}`;
ART_NAMES['logo-arena'] = 'Title: ARENA';
Object.assign(ART_NAMES, { 'weapon-bow': 'Weapon: bow, at rest', 'weapon-bow-drawn': 'Weapon: bow, drawn', arrow: 'Arrow' });
for (const [item, sts] of Object.entries(TAILOR)) sts.forEach((q, i) => { ART_NAMES[tailorFile(item, { i })] = `Tailor: ${item}, ${q[0].toLowerCase()}`; });
export const artLabel = (name) => ART_NAMES[name] || (String(name).replace(/-+/g, ' ').trim().replace(/^./, (c) => c.toUpperCase()));
// a portrait's crop (fractions x0 y0 x1 y1) at w x h px, cached at the screen's pixel ratio; null until it loads
const PICS = new Map();
export function picSprite(E, name, crop, w, h) {
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
export function drawPic(ctx, E, name, crop, x, y, w, h, edge = '#e6c866') {
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
export function sayLines(ctx, E, lines, cx, y, lh, w, o, pic, s = TUNING.art.face) {
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
export const sayLine = (ctx, E, t, cx, y, w, o, pic, s) => sayLines(ctx, E, [t], cx, y, 0, w, o, pic, s);
// Old Brutus's face on a bout card (the card grows by TUNING.art.cardDrop with it on, see cardGrow)
export const brutusFaceOn = () => !!artImg('brutus');
export const cardGrow = () => (brutusFaceOn() ? TUNING.art.cardDrop : 0);
// The kit: a man's look with the kit on, his muscle tier by Strength, whether he is you, and his painted pieces (step 6b: his type's helmet and shield,
// the leg wraps of the types that wear them), all in the look's id, so his sprites repaint only when one of them changes; cached on the look
export const KIT_HELM = { murmillo: 'murmillo', hoplo: 'thraex', open: 'secutor', cap: 'gallic' };
export const KIT_SHIELD = { murmillo: 'scutum', hoplo: 'parma', open: 'round', cap: 'round' };
const KIT_WRAP = { hoplo: true };
const KIT_GEAR = { plate: 'kit-plate-chest', manica: 'kit-plate-manica', greave: 'kit-plate-greave', wrap: 'kit-wrap-trousers', galerus: 'kit-galerus' };
export function kitTier(str) { const T = TUNING.kit.tier; return str <= T.lean ? 'lean' : str <= T.avg ? 'avg' : 'musc'; }
export function lookFor(fm, isFoe) {
  const lk = lookOf(fm, isFoe);
  if (!kitOn() || fm.beast) return lk;
  const tier = kitTier(isFoe ? fm.str : state.me.str), wk = isFoe ? fm.weapon && weaponKey(fm.weapon.id, fm.mace) : state.me.weapon !== 'fist' && weaponKey(state.me.weapon, state.me.mace);
  const key = `${tier}|${isFoe ? '' : 'y'}|${wk}|${artV}`;
  if (!lk.kitL || lk.kitL.key !== key) {
    // until all of his paint is in (his weapon too, step 14), he keeps the drawn look whole (step 12)
    if (!artReady(manArt(lk, tier, wk))) { lk.kitL = { key, lk }; return lk; }
    const helm = KIT_HELM[lk.helm] || 'gallic', shield = KIT_SHIELD[lk.helm] || 'round', wrap = !!KIT_WRAP[lk.helm];
    // the worn pieces whose paint has loaded (step 6c-2), so a part repaints when one arrives
    const ga = [...Object.values(lk.gear || {}).filter((c) => TUNING.kit.gear[gearFile(c)] && artImg(gearFile(c))).map((c) => c.id), ...tailorFiles(lk).filter((n) => artImg(n))].join('.');
    lk.kitL = { key, lk: { ...lk, kitL: null, plain: lk, kit: { tier, you: !isFoe, helm, shield, wrap }, id: `${lk.id}|kit${key}|${helm}.${shield}${wrap ? '.wrap' : ''}|ga${ga}` } };
  }
  return lk.kitL.lk;
}
// An image by name with its joints J (px of J.size: an image at another size scales them; one on J.wide's wider canvas takes J.wide). px > 0: a copy
// scaled near px across J.w (or its width), cached, for a part drawn live each frame rather than the full image; dark shades that copy (a far leg).
const KIT_LIVE = new Map();
// the file a name loads now, without its folder and extension (kit-base-thigh-A): the key of the joints measured per image; a shipped file is the A pick
function artStem(name) { const e = IMGS.get(name); return e && e.src ? e.src.replace(/^.*\//, '').replace(/\.\w+$/, '') + (e.src.startsWith('assets/') ? '-A' : '') : ''; }
// a limb half's joints by file (TUNING.kit.half, TUNING.beastArt.half), its shared width w over its limb's wk
function halfJ(st) {
  const T = TUNING.kit.half[st] ? TUNING.kit.half : TUNING.beastArt.half[st] ? TUNING.beastArt.half : null;
  return T && { ...T[st], w: T[st].w / T.wk[/-(arm|leg|fore|hind)-/.exec(st)[1]] };
}
export function artPic(name, J0, px = 0, dark = 0) {
  const im = artImg(name);
  if (!im) return null;
  const st = artStem(name), C = TUNING.kit.crop[st] || halfJ(st), J1 = J0.wide && Math.abs(im.width / im.height - J0.wide.size[0] / J0.wide.size[1]) < 0.03 ? J0.wide : J0; // a wide canvas is told by its shape: a shipped file is scaled down
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
// Step 6d: a lean or average arm or leg is drawn from its two halves of one painting (TUNING.kit.half)
const KIT_HALF = { upperarm: 'kit-arm-up', forearm: 'kit-arm-lo', thigh: 'kit-leg-up', shin: 'kit-leg-lo' };
// a kit part's image for a tier: a limb's half for a lean or average man, the tier's own torso when it has one, else the muscular base (its upper
// arm the Pack 20 one-segment part when there is one)
function kitName(part, tier) {
  const h = tier && KIT_HALF[part], hn = h && `${h}-${tier}`;
  if (hn && ART && ART.has(hn)) return hn;
  const t = tier && part === 'torso' ? `kit-base-torso-${tier}` : null, n = t && ART && ART.has(t) ? t : `kit-base-${part}`;
  return ART && ART.has(`${n}-seg`) ? `${n}-seg` : n;
}
export function kitPic(part, tier, px = 0) {
  const n = kitName(part, tier), h = KIT_HALF[part];
  return artPic(n, h && n.startsWith(h) ? { size: TUNING.kit.half.size[h] } : TUNING.kit[part], px);
}
const KIT_PARTS = ['head', 'torso', 'upperarm', 'forearm', 'thigh', 'shin'];
// a man's paint (step 12): the body of his tier, and the pieces he may wear (his type's helmet and shield, the plates, wraps, his card gear)
export function manArt(lk, tier, wk = null) {
  const gear = [...Object.values(lk.gear || {}).filter((c) => TUNING.kit.gear[gearFile(c)]).map(gearFile), ...tailorFiles(lk), ...(wk && TUNING.kit.weapon[wk] ? [weaponArt(wk)] : [])];
  const tower = lk.gear && lk.gear.shield && lk.gear.shield.id === 'ironwall', wrap = KIT_WRAP[lk.helm] ? [KIT_GEAR.wrap] : [], gal = lk.galerus ? [KIT_GEAR.galerus] : [];
  return { body: KIT_PARTS.map((p) => kitName(p, tier)), extra: [`kit-helmet-${KIT_HELM[lk.helm] || 'gallic'}`, `kit-shield-${tower ? 'scutum' : KIT_SHIELD[lk.helm] || 'round'}`, KIT_GEAR.plate, KIT_GEAR.manica, KIT_GEAR.greave, ...wrap, ...gal, ...gear] };
}
// a beast's paint: every part beastKit pins (a young beast's own where it has one)
export function beastArt(fm) {
  const nm = (part) => { const b = `beast-${fm.beast}-${part}`; return fm.young && ART && ART.has(`${b}-young`) ? `${b}-young` : b; };
  return { body: [], extra: [...['torso', 'head', 'fore-up', 'fore-lo', 'hind-up', 'hind-lo', ...(TUNING.beastArt[fm.beast].tail ? ['tail'] : [])].map(nm),
    ...(fm.parts && fm.parts.some((q) => q.armour) ? Object.keys(BARD).map((k) => `beast-${fm.beast}-armour-${k}`) : [])] };
}
// the painted doll on a card (kitIcon): its body, and the plates it wears
export function dollArt(parts, str, gm) {
  const on = (id) => parts.some((q) => q.d.id === id && q.armour);
  return { body: KIT_PARTS.map((p) => kitName(p, kitTier(str))), extra: [...(on('head') ? [`kit-helmet-${KIT_HELM[gm] || 'gallic'}`] : []), KIT_GEAR.plate, KIT_GEAR.manica, KIT_GEAR.greave] };
}
// Pack 27: a piece painted onto the head is pinned as the head is (by its top and chin, TUNING.kit.head), moved by its head origin o
const headJ = (J) => { const h = TUNING.kit.head, [ox, oy] = J.o; return { ...J, a: [h.a[0] + ox, h.a[1] + oy], b: [h.b[0] + ox, h.b[1] + oy] }; };
export const helmArt = (k) => artPic(`kit-helmet-${k}`, headJ(TUNING.kit.helm[k]));
const helmPic = (lk) => helmArt(lk.kit.helm);
// What a painted head wears: on a plated head, its helmet (his type's, or a gear piece that is one); the head piece of his gear that goes on too (none
// over a closed helmet, no hood over any, and on his unplated head none that reads as a plate, J.bare 0); and whether one of them, closed, is drawn
// instead of the head
function headWear(p, lk) {
  const G = gearArt(lk, 'helmet'), hp = p.armour && helmPic(lk), helm = p.armour ? (G && G.J.helm ? G : hp) : null;
  let piece = G && !(p.armour && G.J.helm) && !(hp && (hp.J.closed || G.J.cover)) ? G : null;
  if (piece && !p.armour && !lk.kit.you && piece.J.bare === 0) piece = null;
  return { helm, piece, hp, closed: !!((helm && helm.J.closed) || (piece && piece.J.closed)) };
}
export const gearPic = (piece, px = 0) => artPic(KIT_GEAR[piece], TUNING.kit[piece], px);
export const shieldPic = (kind, px = 0) => artPic(`kit-shield-${kind}`, TUNING.kit.shields[kind], px);
// Step 6c-2: the painted piece a kit look wears in a slot (null: the drawn piece stays); px > 0 a live copy
function gearArt(lk, slot, px = 0) {
  const c = lk.kit && lk.gear && lk.gear[slot], f = c && gearFile(c), J = f && TUNING.kit.gear[f];
  return J ? artPic(f, J.o ? headJ(J) : J, px) : null;
}
// Step 14: the tailor's looks you wear, painted (TUNING.kit.tailor): their files, and an item's painting on a kit look (null: the drawn look stays)
const tailorFiles = (lk) => Object.entries(lk.tailor || {}).map(([k, t]) => tailorFile(k, t)).filter((n) => TUNING.kit.tailor[n]);
function tailorArt(lk, item, px = 0) {
  const t = lk.kit && lk.tailor && lk.tailor[item], f = t && tailorFile(item, t), J = f && TUNING.kit.tailor[f];
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
// its own width first (the joints with it), and J.mir (a limb half painted facing the other way) mirrors it once more; J.clip draws only its rows
// above that one, J.top only its rows below that one.
export function drawSeg(c, P, A, B, w, flip = false) {
  const J = P.J;
  if (J.mir) flip = !flip;
  const iw = P.im.width, ax = (flip ? J.size[0] - J.a[0] : J.a[0]) * P.kx, bx = (flip ? J.size[0] - J.b[0] : J.b[0]) * P.kx, ay = J.a[1] * P.ky, by = J.b[1] * P.ky;
  const L = Math.hypot(B[0] - A[0], B[1] - A[1]), l = Math.hypot(bx - ax, by - ay), sy = L / l, sx = w ? w / (J.w * P.kx) : sy;
  c.save(); c.translate(A[0], A[1]); c.rotate(Math.atan2(B[1] - A[1], B[0] - A[0]) - Math.PI / 2); c.scale(sx, sy); c.rotate(Math.atan2(bx - ax, by - ay)); c.translate(-ax, -ay);
  if (flip) { c.translate(iw, 0); c.scale(-1, 1); }
  const ih = P.im.height, t = J.top ? Math.round(J.top * P.ky) : 0;
  if (J.clip) { const ch = Math.round(J.clip * P.ky); c.drawImage(P.im, 0, 0, iw, ch, 0, 0, iw, ch); } else if (t) { c.drawImage(P.im, 0, t, iw, ih - t, 0, t, iw, ih - t); if (J.pad) c.drawImage(P.im, 0, t, iw, 1, 0, t - J.pad * P.ky, iw, J.pad * P.ky); } else c.drawImage(P.im, 0, 0);
  c.restore();
}
// The torso pinned from y0 to y1, w across, mirrored when painted turned to his left (J.flip). One painted with its upper arms hanging at its sides
// (J.trim: below row r, only columns x0 to x1, and J.cap's ellipse, outlined) has them cut off, since the arms are drawn as their own parts. mine
// (a fight sprite, yours or his, whose weapon arm hangs from a joint inside the painted front shoulder, with a shoulder of its own) also keeps only
// J.mine's columns [x0, x1], cutting that painted shoulder off under the arm's, and cuts the back shoulder at the far arm (TUNING.kit.back, or
// J.back); over (what is worn on the torso, returning its bottom) is cut with both. A cut inside the image is outlined J.mine[2] px wide as the
// painted edge is (on a sprite only: painted live it would land on what is behind).
export function kitTorso(c, P, y0, y1, w, mine = false, over = null) {
  const J = P.J, f = !!J.flip, M = mine && J.mine, T = J.trim;
  if (!M && !T) { drawSeg(c, P, [0, y0], [0, y1], w, f); if (over) over(); return; }
  const sx = w / J.w, big = 4 * (Math.abs(y1 - y0) + w), col = (x) => (x - J.a[0]) * sx * (f ? -1 : 1), span = (a, b) => [col(a), col(b)].sort((p, q) => p - q);
  const H = y0 / TUNING.kit.neck, Bk = J.back || TUNING.kit.back, bx = Bk[0] * H, by = Bk[1] * H, xs = (Bk[0] - Bk[2]) * H;
  const bk = (a = 0, b = TAU) => c.ellipse(bx, by, Bk[2] * H, Bk[3] * H, 0, a, b);
  const backCut = (plate) => { c.beginPath(); c.rect(bx, -big, big, 2 * big); if (plate) c.rect(xs, by, big, big); else c.rect(-big, Bk[4] * H, 2 * big, big); bk(); c.clip(); };
  c.save();
  if (M) { const [x0, x1] = span(M[0], M[1]); c.beginPath(); c.rect(x0, -big, x1 - x0, 2 * big); c.clip(); }
  c.save();
  if (M) backCut(false);
  const row = (y) => y0 + (y - J.a[1]) * (y1 - y0) / (J.b[1] - J.a[1]), sy = (y1 - y0) / (J.b[1] - J.a[1]), C = J.cap;
  const cap = () => c.ellipse(col(C[0]), row(C[1]), C[2] * sx, C[3] * sy, 0, 0, TAU);
  if (T) {
    const yr = row(T[0]), [x0, x1] = span(T[1], T[2]);
    c.beginPath(); c.rect(-big, yr - big, 2 * big, big); c.rect(x0, yr, x1 - x0, big); if (C) cap(); c.clip();
  }
  drawSeg(c, P, [0, y0], [0, y1], w, f);
  if (T && M && canSprite) {
    // (in the fight the trim's cut runs down his back, so it is outlined too)
    const yr = row(T[0]);
    c.save(); c.globalCompositeOperation = 'source-atop'; c.strokeStyle = TUNING.kit.edge; c.lineWidth = M[2] * sx; c.beginPath();
    for (const x of T.slice(1)) { c.moveTo(col(x), yr); c.lineTo(col(x), big); }
    c.stroke(); c.restore();
  }
  if (T && C && canSprite) {
    const yr = row(T[0]), [x0, x1] = span(T[1], T[2]);
    c.beginPath(); c.rect(-big, yr, x0 + big, big); c.rect(x1, yr, big, big); c.clip();
    c.globalCompositeOperation = 'source-atop'; c.strokeStyle = TUNING.kit.edge; c.lineWidth = C[4] * sx; c.beginPath(); cap(); c.stroke();
  }
  c.restore();
  let ob = 0;
  if (over) { c.save(); if (M) backCut(true); ob = over(); c.restore(); }
  if (M && canSprite) {
    c.globalCompositeOperation = 'source-atop'; c.strokeStyle = TUNING.kit.edge; c.lineWidth = M[2] * sx; c.beginPath();
    for (const x of M.slice(0, 2)) if (x > 0 && x < J.size[0]) { c.moveTo(col(x), -big); c.lineTo(col(x), big); }
    c.stroke();
    c.beginPath(); bk(Math.PI, 1.5 * Math.PI); c.stroke();
    if (ob) { c.beginPath(); c.moveTo(xs + c.lineWidth / 2, by); c.lineTo(xs + c.lineWidth / 2, ob); c.stroke(); }
  }
  c.restore();
}
// The chest plate on the torso, w across, for the plated half (on: 'chest', 'belly' or 'both'): the whole plate from the neck to the belt (the chest's),
// its lower half from the waist to y1 (the belly's), or one whole plate from the neck to y1 (both, each half drawing its own cut of it); mirrored with
// the torso when painted turned to his left. T (the torso under it: its pic and width) fills the plate's armhole (J.hole: an ellipse's centre and
// radii, px) with the torso's own painted shoulder, so the hole shows the arm in it rather than a dark socket.
export function torsoPlate(c, PL, H, w, on, y1, T = null) {
  const K = TUNING.kit, J = PL.J, y0 = K.neck * H, yb = on === 'both' ? y1 : K.belt * H, h = J.hole;
  if (on === 'belly') { drawSeg(c, { ...PL, J: { ...J, a: [J.a[0], J.abs], b: [J.b[0], J.size[1]] } }, [0, K.cut * H], [0, y1], w, !!J.flip); return y1; }
  drawSeg(c, PL, [0, y0], [0, yb], w, !!J.flip);
  if (!T || !h) return yb;
  const sx = w / J.w, sy = (yb - y0) / (J.b[1] - J.a[1]);
  c.save(); c.beginPath(); c.ellipse((h[0] - J.a[0]) * sx * (J.flip ? -1 : 1), y0 + (h[1] - J.a[1]) * sy, h[2] * sx, h[3] * sy, 0, 0, TAU); c.clip();
  drawSeg(c, T.P, [0, y0], [0, K.belt * H], T.w, !!T.P.J.flip);
  c.restore();
  return yb;
}
// the height of the whole plate's bottom rim (J.rim, px) when it runs from the neck to y1 (body units), where a belt is buckled over it
const plateRim = (y1) => { const K = TUNING.kit, J = K.plate; return K.neck + (y1 - K.neck) * (J.rim - J.a[1]) / (J.b[1] - J.a[1]); };
// a body whose chest and belly are both plated (the bought chest plate, step 11) wears one plate over the two; onePlate: a painted part wearing it
export const plateBoth = (parts) => ['chest', 'belly'].every((id) => parts.some((q) => q.d.id === id && q.armour));
const onePlate = (p, lk) => !!(lk.kit && p.both && gearPic('plate'));
// darken what is painted so far (the far leg, before the near one; the far arm's sprite)
function farShade(c, H, b) { c.save(); c.globalCompositeOperation = 'source-atop'; c.fillStyle = `rgba(20,10,4,${TUNING.kit.far})`; c.fillRect(b[0] * H, b[1] * H, (b[2] - b[0]) * H, (b[3] - b[1]) * H); c.restore(); }
// The kit under a part's sprite: the head (none under a closed helmet), the torso cut into the chest and the belly, an arm's two halves in its frame,
// both legs; with the painted plates of the plated parts (the chest plate, its lower half on the belly, one plate over both, the manica, the greaves) and the wraps of the
// types that wear them, so the far arm and leg are shaded with theirs. False when a body image has not loaded (the part is painted procedurally). The
// part's own painter runs after it, kit-aware: the drawn plates only where a plate's image is missing, then the gear and type looks, no skin.
function kitBody(c, p, H, lk) {
  const K = TUNING.kit, id = p.d.id, t = lk.kit.tier;
  if (id === 'cloak') return true;
  if (id === 'head') {
    const P = kitPic('head');
    if (!P) return false;
    if (!headWear(p, lk).closed) drawSeg(c, P, [p.d.x * H, K.top * H], [p.d.x * H, K.chin * H], 0);
    return true;
  }
  if (id === 'chest' || id === 'belly') {
    const P = kitPic('torso', t), B = BOX[id], PL = p.armour && gearPic('plate'), Bd = PARTS[pidx('belly')], w = Bd.w * H;
    if (!P) return false;
    c.save(); c.beginPath();
    // (the chest's sprite runs a pixel past the cut, over the belly's, so no seam shows between them)
    if (id === 'chest') c.rect(B[0] * H, B[1] * H, (B[2] - B[0]) * H, (K.cut - B[1]) * H + 1); else c.rect(B[0] * H, K.cut * H, (B[2] - B[0]) * H, (B[3] - K.cut) * H);
    // the chest piece over the plate, drawn whole into both halves so it runs on across the cut; both cut with the torso's shoulders (kitTorso)
    const G = gearArt(lk, 'chest'), A = G && G.J.at;
    const over = (PL || G) && (() => {
      const yb = PL ? torsoPlate(c, PL, H, w * P.J.k, p.both ? 'both' : id, (Bd.y + Bd.h / 2) * H, { P, w }) : 0;
      if (G) wearSeg(c, G, [A[0] * H, A[1] * H], [A[0] * H, A[2] * H], w * P.J.k, !p.armour && !lk.kit.you);
      return Math.max(yb, G ? A[2] * H : 0);
    });
    // his near shoulder is cut under his weapon arm's, as yours is under your sword arm's
    c.clip(); kitTorso(c, P, K.neck * H, K.belt * H, w, true, over);
    c.restore();
    return true;
  }
  if (id === 'armF' || id === 'armB') {
    const U = kitPic('upperarm', t), F = kitPic('forearm', t), w = p.d.w * H, el = ARM_LEN / 2 * H, M = p.armour && gearPic('manica');
    if (!U || !F) return false;
    // your far arm's forearm goes under its upper arm, as your sword arm's does
    const under = lk.kit.you && id === 'armB', fore = () => drawSeg(c, F, [0, el], [0, ARM_LEN * H], w);
    if (under) fore();
    drawSeg(c, U, [0, 0], [0, el], w);
    if (!under) fore();
    if (M) drawSeg(c, M, [0, el], [0, el + (ARM_LEN * H - el) * M.J.to], w);
    // your arms piece rides your live sword arm
    const G = !(lk.kit.you && id === 'armB') && gearArt(lk, 'arms');
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
export const TAU = Math.PI * 2;
const STEEL = { hi: '#f2f5f8', lite: '#c3cbd3', mid: '#8d97a1', dark: '#49515a', edge: '#1f242a' };
const POLISH = { hi: '#ffffff', lite: '#dfe5eb', mid: '#a7b1bc', dark: '#56606b', edge: '#1c2127' };
const IRON = { hi: '#dcdad4', lite: '#a6a39c', mid: '#77746d', dark: '#3d3a35', edge: '#1a1815' };
const BRONZE = { hi: '#ffe7b0', lite: '#dcae62', mid: '#a9772f', dark: '#5e3e15', edge: '#2b1b08' };
const LEATHER = { lite: '#9a6a3c', mid: '#6e4524', dark: '#3e2511' };
const LINEN = { lite: '#e8dcbc', mid: '#b9aa86', dark: '#6d6248' };
// The foe's weapon sets his type (flavour only). A helmet is drawn only on a plated head, so the art never hides a bare part.
export const GTYPE = {
  gladius: { id: 'murmillo', helm: 'murmillo', bare: 'leather', metal: STEEL, trim: '#c9a43a', skin: '#b9835a', hair: '#2a1a10', tunic: '#9b2f2f', hem: '#5e1818', crest: '#c8372a', wrap: 'tunic' },
  spear: { id: 'hoplomachus', helm: 'hoplo', bare: 'leather', metal: STEEL, trim: '#d6b04a', skin: '#c08a5c', hair: '#3a2414', tunic: '#38457a', hem: '#1f2748', crest: '#efe6cf', wrap: 'tunic' },
  axe: { id: 'brute', helm: 'open', bare: 'hair', beard: true, pauldron: true, metal: IRON, trim: '#8a7a5a', skin: '#a8714a', hair: '#1a120c', tunic: '#5a3b22', hem: '#2e1d10', wrap: 'loin' },
  dagger: { id: 'retiarius', helm: 'cap', bare: 'band', band: '#c9a43a', galerus: true, net: true, metal: STEEL, trim: '#d6b04a', skin: '#c99568', hair: '#4a2a14', tunic: '#b08c34', hem: '#6e561a', wrap: 'loin' },
  // yours only (the ludus's armoury): the trident's net fighter, and the sica's Thracian with a plumed closed helm
  trident: { id: 'retiarius', helm: 'cap', bare: 'band', band: '#c9a43a', galerus: true, net: true, metal: STEEL, trim: '#d6b04a', skin: '#c99568', hair: '#4a2a14', tunic: '#b08c34', hem: '#6e561a', wrap: 'loin' },
  sica: { id: 'thraex', helm: 'hoplo', bare: 'leather', metal: STEEL, trim: '#c9a43a', skin: '#c08a5c', hair: '#2a1a10', tunic: '#7a2e5a', hem: '#4a1838', crest: '#c8372a', wrap: 'tunic' },
  // yours only: fists, a brawler in a plain cap
  fist: { id: 'pugil', helm: 'cap', bare: 'leather', metal: STEEL, trim: '#8a7a5a', skin: '#b9835a', hair: '#2a1a10', tunic: '#5a3b22', hem: '#2e1d10', wrap: 'loin' },
};
// Your metal follows your rolled armour set: bronze and leather, steel with bronze trim, polished steel with gold and a red crest.
const MYLOOK = {
  none: { metal: BRONZE, trim: LEATHER.mid },
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
export function myLook(me, ids = [], tailor = {}) {
  const G = GTYPE[me.weapon], A = MYLOOK[me.set], t = Object.entries(tailor).map(([k, v]) => `${k}${v.i}`).join('');
  const lk = withGear({ ...G, metal: A.metal, trim: A.trim, skin: YOU.skin, hair: '#3a2414', tunic: YOU.tunic, hem: YOU.hem,
    crest: A.crest || G.crest || YOU.crest, band: G.band ? YOU.crest : YOU.tunic, beard: G.beard && !me.female }, ids, `you-${me.set}-${me.weapon}${me.female ? 'f' : ''}-${t}`);
  lk.tailor = tailor;
  return lk;
}
// his look: his type's, with his gear (rolled once per bout); the Huntress carries her net at her belt
export const foeLook = (d) => withGear({ ...GTYPE[d.weapon.id], ...(TUNING.champs[d.ck] && TUNING.champs[d.ck].net ? { net: true } : {}) }, d.gear || [], GTYPE[d.weapon.id].id);
// yours is rebuilt only when your picks change
export function lookOf(fm, isFoe) {
  if (isFoe) return fm.look || GTYPE[fm.weapon.id];
  const sig = `${state.picks.join(',')}|${state.me.weapon}${state.me.mace ? 'm' : ''}`;
  if (state.you.lookSig !== sig) { state.you.look = myLook(state.me, state.picks, state.tailor || {}); state.you.lookSig = sig; }
  return state.you.look;
}
// What shows through each gap, and which sides the plate edges frame it from (top and bottom, or left and right).
const SLOT_ART = { 'slot-neck': ['skin', 'tb'], 'slot-armpit': ['linen', 'lr'], 'slot-waist': ['linen', 'tb'], 'slot-elbow': ['skin', 'tb'], 'slot-knee': ['skin', 'tb'], 'slot-face': ['skin', 'lr'] };
// Sprite bounds in body units (arms in their own frame): room for crests, straps, the fist and the shoulder guards.
const BOX = { head: [-0.17, -1.1, 0.18, -0.66], chest: [-0.17, -0.74, 0.17, -0.5], belly: [-0.19, -0.54, 0.19, -0.24], armF: [-0.14, -0.2, 0.12, 0.42], armB: [-0.14, -0.2, 0.12, 0.42], legs: [-0.21, -0.43, 0.25, 0.04], cloak: [-0.34, -0.86, 0.14, 0.01] };
export const LEGS = [[[-0.02, -0.37], [-0.07, -0.19], [-0.12, -0.02]], [[0.02, -0.37], [0.09, -0.2], [0.12, -0.02]]];
export const canSprite = typeof OffscreenCanvas === 'function';

const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export function shade(h, f) { return '#' + rgbOf(h).map((v) => Math.round(f >= 1 ? v + (255 - v) * Math.min(1, f - 1) : v * f).toString(16).padStart(2, '0')).join(''); }
export const lw = (H, k) => Math.max(1, k * H);
export function line(c, x0, y0, x1, y1) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
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
export function face(c, x, y, r, lk, H, hair) {
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
  const kh = K && headWear(p, lk).helm;
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
  // the leather belt, but not across one plate over the chest and belly, which ends at its own rim
  if (!onePlate(p, lk)) belt(c, H);
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
  if (lk.kit && kitPic('head')) { kitGap(c, p, H); return; }
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
export const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
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
  if (!g) {
    // (on a painted helmet the tailor's crest and plume stand on its dome)
    const hk = p.armour && lk.kit && TUNING.kit.helm[lk.kit.helm], dy = hk ? (hk.crest - TUNING.kit.tailor.crest.at[1]) * r : 0;
    if (lk.tailor) { c.save(); c.translate(0, dy); tailorHead(c, x, y, r, H, lk.tailor, lk); c.restore(); }
    return;
  }
  // the painted piece (a helmet that stood in for a plated head's is already on it); a band is tied under an open helmet's brim, so the helmet goes
  // back on over it
  if (gearArt(lk, 'helmet')) {
    const W = headWear(p, lk), G = W.piece;
    if (!G) return;
    drawSeg(c, G, [x, TUNING.kit.top * H], [x, TUNING.kit.chin * H], 0);
    if (W.hp) drawSeg(c, W.hp, [x, TUNING.kit.top * H], [x, TUNING.kit.chin * H], 0);
    return;
  }
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
  } else if (g.id === 'phalanx') {
    // a bronze brow band, a cheek guard below the eye and a short gold crest
    clipBand(c, head, x - r * 1.1, y - r * 0.58, r * 2.2, r * 0.24, metalGrad(c, x, y - r * 0.58, x, y - r * 0.34, M));
    c.beginPath(); c.moveTo(x + r * 0.12, y + r * 0.02); c.lineTo(x + r * 0.5, y + r * 0.04); c.quadraticCurveTo(x + r * 0.52, y + r * 0.45, x + r * 0.3, y + r * 0.68); c.lineTo(x + r * 0.1, y + r * 0.55); c.closePath();
    c.fillStyle = metalGrad(c, x + r * 0.5, y, x + r * 0.1, y + r * 0.6, M); c.fill(); c.strokeStyle = M.edge; c.lineWidth = lw(H, 0.004); c.stroke();
    c.beginPath(); c.moveTo(x + r * 0.35, y - r * 0.86); c.quadraticCurveTo(x - r * 0.1, y - r * 1.45, x - r * 0.75, y - r * 0.72); c.lineTo(x - r * 0.58, y - r * 0.64); c.quadraticCurveTo(x - r * 0.05, y - r * 1.18, x + r * 0.2, y - r * 0.8); c.closePath();
    c.fillStyle = L.hi; c.fill(); c.strokeStyle = M.edge; c.lineWidth = lw(H, 0.004); c.stroke();
  } else if (g.id === 'gilded') {
    // a gilded laurel: two rows of gold leaves along the crown, tied at the back
    c.strokeStyle = M.dark; c.lineWidth = lw(H, 0.004); c.beginPath(); c.moveTo(x + r * 0.62, y - r * 0.62); c.quadraticCurveTo(x - r * 0.1, y - r * 1.12, x - r * 0.95, y - r * 0.45); c.stroke();
    for (let i = 0; i < 7; i++) {
      const t = i / 6, lx = x + r * (0.6 - t * 1.5), ly = y - r * (0.62 + Math.sin(t * Math.PI) * 0.42 - t * 0.12);
      for (const s of [-1, 1]) { c.beginPath(); c.ellipse(lx + s * r * 0.04, ly + s * r * 0.1, r * 0.17, r * 0.07, 0.5 - t * 0.9 + s * 0.5, 0, TAU); c.fillStyle = metalGrad(c, lx, ly - r * 0.1, lx, ly + r * 0.1, M); c.fill(); c.strokeStyle = M.edge; c.lineWidth = 1; c.stroke(); }
    }
    ribbon(c, [[x - r * 0.95, y - r * 0.45], [x - r * 1.25, y - r * 0.1], [x - r * 1.2, y + r * 0.3]], r * 0.1, L.hi);
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
  } else if (g.id === 'colossus') {
    // a dark iron collar, two broad iron-studded straps crossed over the chest and a great boss where they meet (no plate on a bare chest)
    rrect(c, x0 - 0.012 * H, y0 - 0.024 * H, w + 0.024 * H, 0.04 * H, 0.012 * H); c.fillStyle = metalGrad(c, x1, y0 - 0.02 * H, x0, y0 + 0.02 * H, M); c.fill(); c.strokeStyle = M.edge; c.lineWidth = lw(H, 0.005); c.stroke();
    strap(c, x0 + w * 0.08, y0, x1 - w * 0.1, y1 - h * 0.05, 0.026 * H, H, false); strap(c, x1 - w * 0.08, y0, x0 + w * 0.1, y1 - h * 0.05, 0.026 * H, H, false);
    for (const t of [0.22, 0.78]) { rivet(c, x0 + w * (0.08 + t * 0.82), y0 + h * t * 0.95, H, M); rivet(c, x1 - w * (0.08 + t * 0.82), y0 + h * t * 0.95, H, M); }
    disc(c, x0 + w * 0.5, y0 + h * 0.48, 0.036 * H, M);
  } else if (g.id === 'idol') {
    // a heavy gold torc round the neck and a small gold pectoral hung from it
    c.lineCap = 'round'; c.strokeStyle = M.edge; c.lineWidth = lw(H, 0.02); c.beginPath(); c.moveTo(x0 + w * 0.22, y0 - 0.008 * H); c.quadraticCurveTo(x0 + w * 0.5, y0 + h * 0.34, x0 + w * 0.82, y0 - 0.008 * H); c.stroke();
    c.strokeStyle = M.lite; c.lineWidth = lw(H, 0.014); c.stroke();
    for (const k of [0.22, 0.82]) disc(c, x0 + w * k, y0 - 0.008 * H, 0.012 * H, M);
    c.strokeStyle = M.dark; c.lineWidth = 1; line(c, x0 + w * 0.52, y0 + h * 0.18, x0 + w * 0.52, y0 + h * 0.36);
    c.beginPath(); c.moveTo(x0 + w * 0.52, y0 + h * 0.34); c.lineTo(x0 + w * 0.64, y0 + h * 0.5); c.lineTo(x0 + w * 0.52, y0 + h * 0.7); c.lineTo(x0 + w * 0.4, y0 + h * 0.5); c.closePath();
    c.fillStyle = metalGrad(c, x0 + w * 0.6, y0 + h * 0.34, x0 + w * 0.44, y0 + h * 0.7, M); c.fill(); c.strokeStyle = M.edge; c.stroke();
    c.fillStyle = L.hi; c.beginPath(); c.arc(x0 + w * 0.52, y0 + h * 0.52, 0.007 * H, 0, TAU); c.fill();
  }
}
// The belt slot hangs below your belt, on the tunic, so the waist gap stays as it is. A painted one on a man whose one plate covers his chest and
// belly is buckled over the plate's bottom rim, so the plate shows one top edge and one bottom edge.
function paintBeltGear(c, p, H, lk) {
  const g = lk.gear.belt; if (!g) return;
  const G = gearArt(lk, 'belt'), A = G && G.J.at;
  if (G) { const d = PARTS[pidx('belly')], y = onePlate(p, lk) ? plateRim(d.y + d.h / 2) : A[2]; wearSeg(c, G, [A[0] * H, y * H], [A[1] * H, y * H], 0); return; }
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
  } else if (g.id === 'letter') {
    // a dark red leather belt hung with small hooked knives
    rrect(c, -0.112 * H, y - 0.012 * H, 0.224 * H, 0.024 * H, 0.006 * H); c.fillStyle = L.cloth; c.fill(); c.strokeStyle = shade(L.cloth, 0.5); c.lineWidth = 1; c.stroke();
    for (const k of [-0.08, -0.03, 0.02, 0.07]) {
      c.fillStyle = LEATHER.dark; c.fillRect(k * H - 0.006 * H, y + 0.008 * H, 0.012 * H, 0.012 * H);
      c.beginPath(); c.moveTo(k * H - 0.005 * H, y + 0.02 * H); c.lineTo(k * H + 0.005 * H, y + 0.02 * H); c.quadraticCurveTo(k * H + 0.008 * H, y + 0.05 * H, k * H - 0.01 * H, y + 0.058 * H); c.quadraticCurveTo(k * H + 0.001 * H, y + 0.045 * H, k * H - 0.005 * H, y + 0.02 * H); c.closePath();
      c.fillStyle = metalGrad(c, k * H - 0.01 * H, y + 0.02 * H, k * H + 0.01 * H, y + 0.06 * H, M); c.fill(); c.strokeStyle = M.edge; c.stroke();
    }
  } else if (g.id === 'smoke') {
    // a dark sash with a violet hem, three leather pouches and a wisp of smoke from each
    ribbon(c, [[-0.112 * H, y], [0, y + 0.006 * H], [0.112 * H, y]], 0.022 * H, L.cloth);
    c.strokeStyle = L.hi; c.lineWidth = lw(H, 0.003); line(c, -0.11 * H, y + 0.01 * H, 0.11 * H, y + 0.01 * H);
    for (const k of [-0.07, 0, 0.07]) {
      rrect(c, k * H - 0.014 * H, y + 0.008 * H, 0.028 * H, 0.03 * H, 0.008 * H); c.fillStyle = M.lite; c.fill(); c.strokeStyle = M.edge; c.lineWidth = 1; c.stroke();
      c.fillStyle = 'rgba(196,181,253,0.35)'; for (const [dx, dy, rr] of [[0, -0.004, 0.008], [0.006, -0.014, 0.006]]) { c.beginPath(); c.arc(k * H + dx * H, y + dy * H, rr * H, 0, TAU); c.fill(); }
    }
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
  } else if (g.id === 'winddancer') {
    // pale ribbons wound round the forearm, their ends flying back
    for (let k = 0; k < 3; k++) ribbon(c, [[x0 - w * 0.06, h * (0.56 + k * 0.1)], [0, h * (0.6 + k * 0.1)], [x0 + w * 1.06, h * (0.62 + k * 0.1)]], h * 0.03, L.cloth);
    ribbon(c, [[x0, h * 0.6], [x0 - w * 0.7, h * 0.56], [x0 - w * 1.3, h * 0.66]], h * 0.028, L.hi);
    ribbon(c, [[x0, h * 0.78], [x0 - w * 0.8, h * 0.82], [x0 - w * 1.4, h * 0.76]], h * 0.026, L.hi);
  } else if (g.id === 'crusher') {
    // a heavy black iron gauntlet over the wrist and the fist, studded across the knuckles
    const by = h * 0.68, bh = h * 0.3;
    rrect(c, x0 - w * 0.16, by, w * 1.32, bh, w * 0.24); c.fillStyle = metalGrad(c, w / 2, by, -w / 2, by + bh, M); c.fill(); c.strokeStyle = M.edge; c.lineWidth = lw(H, 0.006); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = lw(H, 0.003); line(c, x0 - w * 0.1, by + bh * 0.3, x0 + w * 1.1, by + bh * 0.3);
    for (const k of [-0.3, 0, 0.3]) rivet(c, k * w, by + bh * 0.72, H, M);
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
    } else if (g.id === 'shadow') {
      // black sandal straps laced from the sole up to the knee, tied with a mint knot
      const pts = [];
      for (let k = 0; k <= 8; k++) { const q = lerp2(ank, knee, 0.04 + k * 0.115); pts.push([q[0] + (k % 2 ? 1 : -1) * SH * 0.55, q[1]]); }
      ribbon(c, pts, 0.01 * H, '#1f1a1e');
      c.fillStyle = '#1f1a1e'; c.fillRect(ank[0] - SH * 0.8, ank[1] - 0.004 * H, SH * 1.9, 0.012 * H);
      const t = pts[pts.length - 1]; c.fillStyle = L.hi; c.beginPath(); c.arc(t[0], t[1], 0.008 * H, 0, TAU); c.fill();
    }
  });
}
// The tailor's looks on your head, where no helmet piece is worn: a metal crest ridge front to back, then a plume of three tall feathers on top
function tailorHead(c, x, y, r, H, T, lk) {
  // painted (step 14): each pinned by its base at (x, y) head radii from the head's centre, its canvas w head radii wide
  const TT = TUNING.kit.tailor, C = tailorArt(lk, 'crest'), Pl = tailorArt(lk, 'plume');
  const pin = (P, at, w) => { const k = w * r / P.J.size[0]; c.drawImage(P.im, x + at[0] * r - P.J.a[0] * k, y + at[1] * r - P.J.a[1] * k, P.J.size[0] * k, P.J.size[1] * k); };
  if (C) pin(C, TT.crest.at, TT.crest.w);
  if (Pl) pin(Pl, T.crest ? [TT.plume.at[0], TT.plume.top] : TT.plume.at, TT.plume.w);
  if (T.crest && !C) {
    const col = T.crest.col;
    c.beginPath(); c.moveTo(x + r * 0.6, y - r * 0.78); c.quadraticCurveTo(x + r * 0.15, y - r * 1.7, x - r * 1.0, y - r * 0.5);
    c.lineTo(x - r * 0.78, y - r * 0.42); c.quadraticCurveTo(x - r * 0.05, y - r * 1.3, x + r * 0.42, y - r * 0.7); c.closePath();
    const gr = c.createLinearGradient(x, y - r * 1.6, x, y - r * 0.5); gr.addColorStop(0, shade(col, 1.35)); gr.addColorStop(1, shade(col, 0.62));
    c.fillStyle = gr; c.fill(); c.strokeStyle = shade(col, 0.35); c.lineWidth = lw(H, 0.005); c.stroke();
  }
  if (T.plume && !Pl) {
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
  const TC = !g && tailorArt(lk, 'cloak'), TA = TC && TC.J.at;
  if (TC) { wearSeg(c, TC, [TA[0] * H, TA[1] * H], [TA[2] * H, TA[3] * H], TA[4] * H); return; }
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
  } else if (g.id === 'tide' || g.id === 'deceiver') {
    // a long cloak to the calves: deep red with its hem dark as if soaked, or dark violet lined with small bronze discs
    const tide = g.id === 'tide', pts = [P(0.04, -0.7), P(-0.06, -0.72), P(-0.14, -0.58), P(-0.21, -0.38), P(-0.26, -0.16), P(-0.25, -0.06), P(-0.14, -0.08), P(-0.05, -0.1), P(0, -0.34), P(0.02, -0.55)];
    const cl = tide ? L.cloth : shade(L.hi, 0.35), gr = c.createLinearGradient(0, -0.7 * H, -0.26 * H, -0.06 * H); gr.addColorStop(0, shade(cl, 1.2)); gr.addColorStop(1, shade(cl, 0.7));
    shape(pts, gr, shade(cl, 0.45));
    if (tide) { c.save(); c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath(); c.clip(); c.fillStyle = 'rgba(40,4,6,0.55)'; c.fillRect(-0.3 * H, -0.2 * H, 0.32 * H, 0.16 * H); c.restore(); }
    else for (const [dx, dy] of [[-0.08, -0.55], [-0.13, -0.42], [-0.18, -0.28], [-0.1, -0.3], [-0.2, -0.14], [-0.12, -0.16]]) disc(c, dx * H, dy * H, 0.011 * H, BRONZE);
    c.strokeStyle = 'rgba(20,4,20,0.4)'; c.lineWidth = lw(H, 0.004); for (const k of [0.35, 0.6]) { c.beginPath(); c.moveTo(-0.05 * H, -0.65 * H); c.quadraticCurveTo(-0.14 * H, -0.38 * H, -(0.1 + k * 0.18) * H, -0.09 * H); c.stroke(); }
  }
}
// A gap guard: a polished steel piece with a gold rim over the gap, so it reads shut: the gorget, the manica, the wide belt, the couters, the knee guards.
export function paintGuard(c, p, H, lk) {
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
export function kitSlot(c, p, H) {
  const d = p.d, w = d.w * H, h = d.h * H, x0 = d.x * H - w / 2, y0 = d.y * H - h / 2, tb = SLOT_ART[d.id][1] === 'tb';
  const g = tb ? c.createLinearGradient(0, y0, 0, y0 + h) : c.createLinearGradient(x0, 0, x0 + w, 0);
  g.addColorStop(0, 'rgba(48,16,6,0.8)'); g.addColorStop(0.5, 'rgba(6,3,2,0.95)'); g.addColorStop(1, 'rgba(48,16,6,0.8)');
  rrect(c, x0, y0, w, h, Math.min(w, h) * 0.45); c.fillStyle = g; c.fill();
  c.strokeStyle = 'rgba(255,170,90,0.85)'; c.lineWidth = Math.max(1, 0.005 * H); c.stroke();
}
// in the fight a painted man's open gap is a soft shadow on the limb, with no rim, so the limb under it still reads as one piece
function kitGap(c, p, H) {
  const d = p.d, a = TUNING.kit.gap, g = c.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, `rgba(40,14,4,${a})`); g.addColorStop(0.55, `rgba(40,14,4,${a * 0.6})`); g.addColorStop(1, 'rgba(40,14,4,0)');
  c.save(); c.translate(d.x * H, d.y * H); c.scale(d.w * H / 2, d.h * H / 2);
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, 1, 0, TAU); c.fill();
  c.restore();
}
export function kitGuard(c, p, H) {
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
  const key = `${Math.round(H * k)}|${lk.id}|${p.guard ? 'g' : ''}${p.armour ? 1 : 0}${p.both ? 'b' : ''}|${p.dents}|${p.cracks.length}|${p.cut ? 1 : 0}|${Math.ceil(p.hp / TUNING.part.hp * 4)}`;
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
  if (state.aim && fm === state.foe && p.flash <= 0 && !covered(p)) {
    // a knife raised: every gap it could find glows bright
    const G = TUNING.knives.glow, k = 0.8 + 0.2 * Math.sin(state.m * 12);
    ctx.fillStyle = `rgba(255,210,74,${G[0] * k})`; ctx.fill();
    ctx.shadowColor = '#ffd24a'; ctx.shadowBlur = G[1]; ctx.strokeStyle = `rgba(255,236,150,${k})`; ctx.lineWidth = 4; ctx.stroke();
  } else if ((state.winded > 0 || state.openAll > 0 || openNow(p)) && fm === state.foe && p.flash <= 0) {
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
// (step 20: one heart and a count, so a giant's hearts take a runt's room)
export const hudRow = () => HUD_ROW;
// your one heart on the HUD's right (px)
export const heartAt = (E) => [E.w - 16 - E.safe.right - 12, 10 + E.safe.top + 14];
function heartPath(ctx, x, y, s) {
  const u = s / 2;
  ctx.beginPath(); ctx.moveTo(x, y + 0.95 * u);
  ctx.bezierCurveTo(x - 1.35 * u, y - 0.05 * u, x - 0.85 * u, y - 1.05 * u, x, y - 0.4 * u);
  ctx.bezierCurveTo(x + 0.85 * u, y - 1.05 * u, x + 1.35 * u, y - 0.05 * u, x, y + 0.95 * u);
}
export function drawHeart(ctx, x, y, s, col) {
  heartPath(ctx, x, y, s);
  ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = 'rgba(20,8,8,0.7)'; ctx.lineWidth = 1.2; ctx.stroke();
}
// Your hearts: one heart whose red drains from the top like a glass as you lose health, and "14 / 18" beside it. A hit shakes the heart and flashes the
// count red; a heal pulses both green (state.heartFx, set as your health moves in play.update).
export function drawHudHeart(ctx, E) {
  const H = TUNING.hud, fx = state.heartFx, u = fx ? fx.t / fx.max : 0, hit = fx && fx.kind === 'hit', heal = fx && fx.kind === 'heal';
  let [x, y] = heartAt(E);
  if (hit) { x += Math.sin(fx.t * 70) * H.shake * u; y += Math.cos(fx.t * 55) * H.shake * 0.5 * u; }
  const s = H.size * (heal ? 1 + 0.18 * Math.sin(u * Math.PI) : 1), k = clamp(state.hp / state.maxHp, 0, 1), top = y - 0.55 * s, bot = y + 0.5 * s;
  heartPath(ctx, x, y, s); ctx.fillStyle = '#3b2a2e'; ctx.fill();
  ctx.save(); heartPath(ctx, x, y, s); ctx.clip();
  const ly = bot - (bot - top) * k, g = ctx.createLinearGradient(0, ly, 0, bot);
  g.addColorStop(0, heal ? '#86efac' : '#f87171'); g.addColorStop(1, '#b91c1c');
  ctx.fillStyle = g; ctx.fillRect(x - s, ly, 2 * s, bot - ly + 2);
  if (k > 0 && k < 1) { ctx.fillStyle = 'rgba(255,220,210,0.55)'; ctx.fillRect(x - s, ly, 2 * s, 1.5); }
  ctx.restore();
  heartPath(ctx, x, y, s); ctx.strokeStyle = heal ? `rgba(134,239,172,${0.5 + 0.5 * u})` : 'rgba(20,8,8,0.8)'; ctx.lineWidth = heal ? 2.5 : 1.4; ctx.stroke();
  const col = hit && u > 0.2 ? (Math.floor(fx.t * 14) % 2 ? '#ffffff' : '#ef4444') : heal ? '#86efac' : '#f0e6cc';
  E.text(`${Math.ceil(state.hp)} / ${state.maxHp}`, x - 0.75 * H.size, y + 1, { size: H.num, weight: '800', align: 'right', color: col });
}
// Momentum: five pips under your hearts, gold when held, the next pip's gain flashing
export function drawPips(ctx, E, bx, bw, y) {
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
  const top = 10 + E.safe.top, l = 16 + E.safe.left, r = 16 + E.safe.right;
  const x0 = l + 112, x1 = E.w - r - 110 - 96 - 10;
  return { top, x0, x1, cx: (x0 + x1) / 2, w: x1 - x0 };
}
// His name, health and stamina bars in the HUD slot, and under them his flag: OPEN! while winded, your riposte, or his short opening after a move.
// Drawn over the fighters, so the sword never hides it.
export function foeHealth(ctx, E) {
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
export function drawCrowdMeter(ctx, E, x, y) {
  crowdBar(ctx, x, y, (hudSlot(E).x0 - 12 - x) * TUNING.hud.crowdW, state.favShown, state.favT);
}
// the bar itself at favour fav (centred on y), white over its fill at flash; the HUD's and the Emperor's thumb card's
export function crowdBar(ctx, x, y, bw, fav, flash) {
  const C = TUNING.crowd, k = clamp(fav / C.max, 0, 1), band = bandOf(fav), bh = TUNING.hud.crowdH, by = y - bh / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - 1, by - 1, bw + 2, bh + 2);
  ctx.fillStyle = band === 2 ? '#ffd24a' : band === 1 ? '#f59e0b' : '#b45309'; ctx.fillRect(x, by, bw * k, bh);
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash})`; ctx.fillRect(x, by, bw * k, bh); }
  ctx.font = '800 14px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(20,12,4,0.9)'; ctx.strokeText('CROWD', x + 6, y + 1);
  ctx.fillStyle = '#fff6dc'; ctx.fillText('CROWD', x + 6, y + 1);
  ctx.fillStyle = 'rgba(240,230,204,0.85)';
  for (const t of C.bands) { ctx.fillRect(x + bw * t - 1, by, 2, 5); ctx.fillRect(x + bw * t - 1, by + bh - 5, 2, 5); }
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(240,230,204,0.5)'; ctx.strokeRect(x - 0.5, by - 0.5, bw + 1, bh + 1);
}
export function drawCoin(ctx, x, y, r) {
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
  for (const p of f.parts) key = (key * 31 + (p.cut ? 1 : 0) + 2 * p.dents + 64 * p.cracks.length + 4096 * (p.armour ? 1 : 0)) % 2147483647;
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
export function drawEdge(ctx, E) {
  const f = state.edge, F = edgeF(E), A = TUNING.pairs.alpha;
  if (!canSprite) { poseEdge(f); drawFighter(ctx, E, F, f, 'edge', A); return; }
  const k = Math.min(E.dpr || 1, TUNING.skin.maxDpr), left = edgeBox(f, F.H)[1], feet = 1.12 * F.H, img = edgeSprite(E, f);
  // drawn upright at whole device pixels and the sprite's own size, the cheapest copy there is
  const X = Math.round((F.x - left) * k) / k, Y = Math.round((F.y - feet) * k) / k;
  ctx.save(); ctx.globalAlpha = A; ctx.drawImage(img, X, Y, img.width / k, img.height / k); ctx.restore();
}
// During the intro card both foes' sprites are painted for the swap: the one fighting as he will wait, the one waiting as he will fight.
export function warmPair(E) {
  const e = state.edge;
  if (!canSprite || !e || state.warm) return;
  state.warm = true;
  edgeSprite(E, state.foe); edgeSprite(E, e);
  if (e.beast) return;
  const H = lay(E).H * e.size.scale, lk = lookFor(e, true);
  for (const p of e.parts) spriteOf(E, p, H, lk);
}
// The waiting foe's name and health over his head, and his taunt, the tell that he is about to step in: a bubble above them
export function drawEdgeTag(ctx, E) {
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
export function drop(ctx, x, y, s, a = 1) {
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
// Bulwark's bossed shield over a shield face of radius r: a ring of iron studs inside the rim and a big iron boss
function bossed(ctx, r) {
  for (let i = 0; i < 12; i++) { const a = i * TAU / 12; disc(ctx, Math.cos(a) * r * 0.84, Math.sin(a) * r * 0.84, r * 0.055, IRON); }
  disc(ctx, 0, 0, r * 0.36, IRON);
  ctx.fillStyle = IRON.edge; ctx.beginPath(); ctx.arc(0, 0, r * 0.1, 0, TAU); ctx.fill();
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
  if (!fc && g && g.id === 'bulwark') bossed(ctx, (parma ? 0.1 : 0.085) * H * k);
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
export function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
export function drawNet(ctx, x, y, r) {
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, 6.28); ctx.fillStyle = 'rgba(200,190,160,0.25)'; ctx.fill(); ctx.clip();
  ctx.strokeStyle = 'rgba(230,220,190,0.85)'; ctx.lineWidth = 1.2;
  for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(x - r + i * r / 2, y - r); ctx.lineTo(x + r + i * r / 2, y + r); ctx.moveTo(x + r - i * r / 2, y - r); ctx.lineTo(x - r - i * r / 2, y + r); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = '#6b5a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.28); ctx.stroke();
}
// Step 6c-2: the painted net draped over a netted fighter (yours over him, the Huntress's over you), drawn in his frame as he is drawn (a beast's
// in its body's), so it leans, sways and rears with him, under his gaps and their light; k grows it in from the crown as it lands
export const netArt = () => kitOn() && !!artImg('kit-net-draped');
export const netK = (t) => clamp(t / TUNING.kit.net.grow[0], TUNING.kit.net.grow[1], 1);
export function drapeNet(ctx, E, H, fm, k) {
  const N = TUNING.kit.net, B = N[fm.beast || 'man'], P = artPic('kit-net-draped', N, B[4] * H * Math.min(E.dpr || 1, TUNING.skin.maxDpr));
  if (!P) return;
  const fr = fm.beast && fm.fr && fm.fr.body, top = [B[0] * H, B[1] * H];
  ctx.save();
  if (fr) { ctx.translate(fr.ox * H, fr.oy * H); ctx.rotate(fr.rot); }
  drawSeg(ctx, P, top, lerp2(top, [B[2] * H, B[3] * H], k), B[4] * H * k);
  ctx.restore();
}
// A painted weapon with its pin at A and its point L px along u (unit), its painted right side to u's left-hand normal, and a card's look g over it;
// red: locked; fx: a striking part lit (zoneFx). Returns its blade as a path; false while it loads (the caller draws the drawn one), with the kit off,
// or where the art has none.
export function paintWeapon(ctx, key, A, u, L, H, g = null, red = false, fx = null) {
  const J = TUNING.kit.weapon[key], k = L / (J.pin - (J.top || 0)), dk = Math.min((ENG && ENG.dpr) || 1, TUNING.skin.maxDpr);
  const P = J && kitOn() && artPic(weaponArt(key), J, Math.ceil(J.size[0] * k * dk / 8) * 8);
  if (!P) return false;
  const n = [-u[1], u[0]], pt = (x, y) => [A[0] + (n[0] * (x - J.x) + u[0] * (J.pin - y)) * k, A[1] + (n[1] * (x - J.x) + u[1] * (J.pin - y)) * k];
  const o = pt(0, 0);
  ctx.save(); ctx.transform(n[0] * k, n[1] * k, -u[0] * k, -u[1] * k, o[0], o[1]); ctx.drawImage(P.im, 0, 0, J.size[0], J.size[1]);
  const lit = fx && zonePic(key, fx.st);
  if (lit) {
    const a0 = ctx.globalAlpha;
    ctx.globalAlpha = a0 * fx.k * TUNING.strike.flashA[0]; ctx.drawImage(lit, 0, 0, J.size[0], J.size[1]);
    ctx.globalAlpha = a0 * fx.k * TUNING.strike.flashA[1]; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(lit, 0, 0, J.size[0], J.size[1]);
  }
  ctx.restore();
  const R = J.ring && pt(J.ring[0], J.ring[1]);
  const clip = () => {
    ctx.beginPath();
    if (R) { ctx.arc(R[0], R[1], J.ring[2] * k, 0, TAU); return; }
    for (const sh of J.clip) { sh.forEach((q, i) => { const c = pt(q[0], q[1]); if (i) ctx.lineTo(c[0], c[1]); else ctx.moveTo(c[0], c[1]); }); ctx.closePath(); }
  };
  if (red) { clip(); ctx.fillStyle = 'rgba(255,90,70,0.5)'; ctx.fill(); }
  if (g) weaponGear(ctx, g, pt(J.x, J.blade[1]), pt(J.x, J.blade[0]), J.hw * k, pt(J.x, J.size[1]), H, R ? [ringPts(R[0], R[1], J.ring[2] * k)] : J.edges.map((e) => e.map((q) => pt(q[0], q[1]))), clip);
  return clip;
}
// Step 21: a weapon's striking parts lit by kind over its dimmed haft (the rack and the Weapon slot), or, with st, the one part a clean hit flashes in
// its kind's colour; each painted once from its picture
const ZONE_PICS = new Map();
export function zonePic(key, st = null) {
  const im = canSprite && artImg(weaponArt(key)), J = TUNING.kit.weapon[key], S = TUNING.strike, Z = S[key], one = st && Z && Z[st.att][st.z];
  if (!im || !J || !Z || (st && !one)) return null;
  const id = `${key}|${st ? st.att + st.z : 'all'}|${artV}`;
  if (ZONE_PICS.has(id)) return ZONE_PICS.get(id);
  const w = im.width, h = im.height, kx = w / J.size[0], ky = h / J.size[1], cv = new OffscreenCanvas(w, h), c = cv.getContext('2d');
  const band = (z, f) => { c.save(); c.beginPath(); c.rect(0, z[0] * ky, w, (z[1] - z[0]) * ky); c.clip(); f(); c.restore(); };
  const tint = (col, a) => { c.globalCompositeOperation = 'source-atop'; c.globalAlpha = a; c.fillStyle = col; c.fillRect(0, 0, w, h); };
  const isK = (z, k) => z[2].split(' ').includes(k);
  if (one) band(one, () => { c.drawImage(im, 0, 0, w, h); tint(S.col[one[2].split(' ')[0]], 1); });
  else {
    const zs = [...Z.jab, ...Z.swing].filter((z, i, all) => all.findIndex((q) => q.join() === z.join()) === i);
    c.globalAlpha = S.haftA; c.drawImage(im, 0, 0, w, h); c.globalAlpha = 1;
    for (const z of zs) band(z, () => c.drawImage(im, 0, 0, w, h));
    for (const k of ['crush', 'cut', 'pierce']) for (const z of zs.filter((q) => isK(q, k))) band(z, () => tint(S.col[k], k === 'cut' ? S.cutTint : S.tint));
    // the cutting edges, a red band inside the blade along each
    for (const z of zs.filter((q) => isK(q, 'cut'))) band(z, () => {
      c.globalCompositeOperation = 'source-atop'; c.strokeStyle = S.col.cut; c.lineWidth = S.edgeW * 2 * J.hw * kx; c.lineJoin = c.lineCap = 'round';
      for (const i of S.edges[key] || []) { c.beginPath(); J.edges[i].forEach((q, j) => (j ? c.lineTo(q[0] * kx, q[1] * ky) : c.moveTo(q[0] * kx, q[1] * ky))); c.stroke(); }
    });
  }
  if (ZONE_PICS.size > 32) ZONE_PICS.clear();
  ZONE_PICS.set(id, cv);
  return cv;
}
// your last clean hit's part, lit while it fades (TUNING.strike.flash)
function zoneFx() {
  const z = state.zfx, k = z ? 1 - (state.m - z.m) / TUNING.strike.flash : 0;
  return k > 0 && z.st.key === myKey() ? { st: z.st, k } : null;
}
// each weapon's kinds in at most two words, for the rack and the Weapon slot, in their colours
const STRIKE_WORDS = { gladius: ['cut', 'pierce'], dagger: ['pierce', 'cut'], spear: ['pierce'], trident: ['pierce'], sica: ['cut'], axe: ['cut', 'crush'], mace: ['crush'], fist: ['crush'] };
export const KIND_WORD = { cut: 'Cut', pierce: 'Pierce', crush: 'Crush' };
export const kindSegs = (key) => (key === 'bow' ? [[KIND_WORD.pierce, TUNING.strike.col.pierce], ['Range', '#cbd5e1']] : (STRIKE_WORDS[key] || []).map((k) => [KIND_WORD[k], TUNING.strike.col[k]]));
// The foe's weapon in his arm's frame: the fist at (0, ARM_LEN), the weapon along +y; frame -x is the edge that leads a chop.
export function drawWeapon(ctx, f, H, paint = true) {
  const W = f.weapon, y0 = ARM_LEN * H, len = W.len * H, key = weaponKey(W.id, f.mace), J = TUNING.kit.weapon[key];
  if (J && paint && paintWeapon(ctx, key, [0, y0], [0, 1], len + J.tip * H, H, f.look && f.look.gear.weapon)) return;
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
  // the cutting edges (the saw teeth's lines) follow each blade or head as drawn above, never the shaft
  const sides = (y1, l, w) => [1, -1].map((sd) => Array.from({ length: 9 }, (_, i) => { const t = 0.05 + i * 0.1; return [sd * w * halfAt(LEAF, t), y1 + l * t]; }));
  const quad = (p0, c, p1) => Array.from({ length: 9 }, (_, i) => { const t = 0.08 + i * 0.105, u = 1 - t; return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]; });
  const top = y0 + len, sy = y0 + 0.03 * H, hy = top - 0.05 * H;
  const edges = W.id === 'spear' ? sides(top, 0.12 * H, 0.026 * H)
    : W.id === 'trident' ? [-1, 1].map((k) => [[k * 0.041 * H, top + 0.01 * H], [k * 0.035 * H, top + 0.1 * H]])
    : W.id === 'sica' ? [quad([-0.014 * H, sy], [0.07 * H, sy + len * 0.5], [-0.01 * H, sy + len]), quad([0.014 * H, sy], [0.03 * H, sy + len * 0.5], [-0.01 * H, sy + len])]
    : W.id === 'axe' && f.mace ? [ringPts(0, top, 0.06 * H)]
    : W.id === 'axe' ? [quad([-0.12 * H, hy - 0.09 * H], [-0.15 * H, hy + 0.02 * H], [-0.12 * H, hy + 0.11 * H])]
    : sides(y0 + 0.04 * H, len, W.id === 'dagger' ? 0.018 * H : 0.026 * H);
  if (W.id === 'spear') weaponGear(ctx, g, [0, top], [0, top + 0.12 * H], 0.026 * H, [0, y0 - 0.3 * H], H, edges);
  else if (W.id === 'axe') weaponGear(ctx, g, [0, top - 0.16 * H], [0, top], 0.016 * H, [0, y0 - 0.06 * H], H, edges);
  else weaponGear(ctx, g, [0, y0 + 0.04 * H], [0, y0 + 0.04 * H + len], W.id === 'dagger' ? 0.018 * H : 0.026 * H, [0, y0 - 0.055 * H], H, edges);
}
// Your second blade (step 18), in your far arm's frame (its rotation rot): the painting of your weapon pinned at the fist, its point along your off
// hand's angle (state.you.offA, in your body's frame), a drawn blade while its paint loads
function offBlade(ctx, H, rot, lk) {
  const a = (state.you.offA == null ? TUNING.dual.down : state.you.offA) - rot, u = [Math.cos(a), Math.sin(a)], A = [0, ARM_LEN * H], L = TUNING.blade.len * H * meWeapon().reach;
  if (paintWeapon(ctx, weaponKey(state.me.weapon, state.me.mace), A, u, L, H, lk.gear && lk.gear.weapon)) return;
  ctx.lineCap = 'round'; ctx.strokeStyle = '#1b2026'; ctx.lineWidth = 0.03 * H + 2; line(ctx, A[0], A[1], A[0] + u[0] * L, A[1] + u[1] * L);
  ctx.strokeStyle = '#dfe6ee'; ctx.lineWidth = 0.03 * H; line(ctx, A[0], A[1], A[0] + u[0] * L, A[1] + u[1] * L);
}
// A blade's outline as [t, half-width] corners from the hilt (0) to the point (1), and its half-width at t
const LEAF = [[0, 0.8], [0.3, 1], [0.72, 0.7], [1, 0]], SPEARHEAD = [[0, 0.6], [0.3, 1.1], [1, 0]];
// how far your sica's blade bows forward of its chord at t, in blade widths
const sicaBow = (t) => Math.sin(Math.PI * t) * 2.4;
function halfAt(pr, t) {
  for (let i = 1; i < pr.length; i++) if (t <= pr[i][0]) { const [t0, w0] = pr[i - 1], [t1, w1] = pr[i]; return w0 + (w1 - w0) * (t - t0) / (t1 - t0); }
  return pr[pr.length - 1][1];
}
// a closed ring of points round (x, y), the edge of a round head; its teeth point out from its centre
function ringPts(x, y, r) { const pts = Array.from({ length: 17 }, (_, i) => [x + Math.cos(i * TAU / 16) * r, y + Math.sin(i * TAU / 16) * r]); pts.c = [x, y]; return pts; }
// Saw teeth spaced evenly along one cutting edge (points in px), each pointing out from the weapon's axis (a, along u), or from the edge's centre c,
// raked toward the point
function sawTeeth(ctx, pts, a, ux, uy, H) {
  const seg = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1])), L = seg.reduce((x, y) => x + y, 0), n = Math.max(2, Math.floor(L / (0.022 * H))), s = 0.014 * H;
  for (let k = 0; k < n; k++) {
    let d = (k + 0.5) * L / n, i = 0;
    while (i < seg.length - 1 && d > seg[i]) d -= seg[i++];
    const p = lerp2(pts[i], pts[i + 1], seg[i] ? d / seg[i] : 0), tx = (pts[i + 1][0] - pts[i][0]) / (seg[i] || 1), ty = (pts[i + 1][1] - pts[i][1]) / (seg[i] || 1);
    const o = pts.c || [a[0] + ux * ((p[0] - a[0]) * ux + (p[1] - a[1]) * uy), a[1] + uy * ((p[0] - a[0]) * ux + (p[1] - a[1]) * uy)];
    let nx = -ty, ny = tx;
    if (nx * (p[0] - o[0]) + ny * (p[1] - o[1]) < 0) { nx = -nx; ny = -ny; }
    const rake = pts.c ? 0 : 0.7;
    spike(ctx, p[0] - nx * s * 0.25, p[1] - ny * s * 0.25, Math.atan2(ny + uy * rake, nx + ux * rake), s * 0.9, s * 0.8, IRON, true);
  }
}
// A weapon piece along the weapon's working part, from a to b (px), hw its half-width there, butt the end of the grip, edges its cutting edges: the saw
// teeth, the sica's hook (and its red grip), the spiked iron pommel, the blackened blade, the gilded one with its ribbon. clip: a painted weapon's blade
// as a path, which the blackened and gilded looks keep inside
function weaponGear(ctx, g, a, b, hw, butt, H, edges, clip = null) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, nx = -uy, ny = ux, s = 0.014 * H;
  if (g.id === 'serrated') {
    for (const e of edges) sawTeeth(ctx, e, a, ux, uy, H);
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
    ctx.fillStyle = 'rgba(20,16,26,0.72)';
    if (clip) { clip(); ctx.fill(); ctx.strokeStyle = FAM_LOOK.trick.hi; ctx.lineWidth = 1.5; ctx.beginPath(); edges[0].forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke(); }
    else {
      ctx.beginPath(); ctx.moveTo(a[0] + nx * hw * 0.8, a[1] + ny * hw * 0.8); ctx.lineTo(b[0] - ux * hw, b[1] - uy * hw); ctx.lineTo(a[0] - nx * hw * 0.8, a[1] - ny * hw * 0.8); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = FAM_LOOK.trick.hi; ctx.lineWidth = 1.5; line(ctx, a[0] + nx * hw * 0.85, a[1] + ny * hw * 0.85, b[0], b[1]);
    }
  } else if (g.id === 'flourish') {
    // a gilt wrap up the blade and a pink ribbon streaming from the pommel
    ctx.save(); if (clip) { clip(); ctx.clip(); }
    ctx.strokeStyle = GOLD.lite; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { const t = 0.08 + i * 0.1, px = a[0] + dx * t, py = a[1] + dy * t; line(ctx, px + nx * hw, py + ny * hw, px - nx * hw + ux * s, py - ny * hw + uy * s); }
    ctx.restore();
    ribbon(ctx, [butt, [butt[0] - ux * 0.05 * H + nx * 0.03 * H, butt[1] - uy * 0.05 * H + ny * 0.03 * H], [butt[0] - ux * 0.1 * H - nx * 0.01 * H, butt[1] - uy * 0.1 * H - ny * 0.01 * H]], 0.012 * H, FAM_LOOK.show.hi);
  }
  gearGlint(ctx, b[0] - ux * 0.04 * H, b[1] - uy * 0.04 * H, 0.03 * H, g, 0.45);
}

// who: 'you' or 'foe'. The foe also draws his weapon arm and club; yours is drawn in screen space by drawSwordArm. ga: overall alpha (Blur's ghost).
// Step 18 on the sand: Hermes's blur (two ghosts of him, either side, through the crouch and the dash), the Huntress's spear in flight and stuck in the
// sand where it fell, Aquila's shield thrown aside, and the Emperor's signal from his box
export function blinkGhosts(ctx, E) {
  const C = TUNING.champs.hermes, Ff = foeF(E), sw = state.sw, k = sw.spring ? 1 : clamp(sw.t / (sw.springAt * 0.6), 0, 1);
  for (const sd of [-1, 1]) drawFighter(ctx, E, { ...Ff, x: Ff.x + sd * C.blur[0] * Ff.H * (0.7 + 0.3 * Math.sin(state.m * 40 + sd)) }, state.foe, 'edge', C.blur[1] * k);
}
// step 20: the Capuan fake's violet ghosts of his wind-up, either side of him; the Blink's white streaks behind his dash; a four-point glint
export function capuanGhosts(ctx, E) {
  const X = TUNING.sigFx, Ff = foeF(E), sw = state.sw, k = clamp(sw.t / (sw.wind * 0.3), 0, 1);
  for (const sd of [-1, 1]) drawFighter(ctx, E, { ...Ff, x: Ff.x + sd * X.ghost[0] * Ff.H * (1 + 0.4 * Math.sin(state.m * 14 + sd)) }, state.foe, 'edge', X.ghost[1] * k);
}
export function blinkStreaks(ctx, E) {
  const X = TUNING.sigFx, Ff = foeF(E), sw = state.sw, u = clamp(1 - (sw.wind - sw.t) / Math.max(0.05, sw.wind - sw.springAt), 0, 1);
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < X.streaks; i++) {
    const y = Ff.y - (0.2 + 0.65 * i / (X.streaks - 1)) * Ff.H, x0 = Ff.x + 0.12 * Ff.H, len = X.len * Ff.H * (0.6 + 0.4 * Math.sin(i * 2.3 + 1)), g = ctx.createLinearGradient(x0, 0, x0 + len, 0);
    g.addColorStop(0, `rgba(255,255,255,${0.95 * (1 - 0.5 * u)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = g; ctx.lineWidth = Math.max(3, 0.022 * Ff.H); line(ctx, x0, y, x0 + len, y);
  }
  ctx.restore();
}
function spearGlint(ctx, x, y, r) {
  if (r <= 1) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,250,220,0.95)';
  for (const [a, b] of [[r, r * 0.16], [r * 0.16, r]]) { ctx.beginPath(); ctx.ellipse(x, y, a, b, 0, 0, TAU); ctx.fill(); }
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 0.7); g.addColorStop(0, 'rgba(255,240,180,0.8)'); g.addColorStop(1, 'rgba(255,240,180,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 0.7, 0, TAU); ctx.fill();
  ctx.restore();
}
// the punish window after an answer, lit: a gold edge round the screen and a draining gold bar over his name, while he is open or unarmed
export function readGlow(ctx, E) {
  if (!(state.readT > 0) || !(state.winded > 0 || state.disarm > 0)) return;
  const k = clamp(state.readT / (state.readMax || 1), 0, 1), a = 0.35 + 0.2 * Math.sin(state.m * 10), S = hudSlot(E), w = Math.min(160, S.w - 20);
  ctx.save(); ctx.strokeStyle = `rgba(255,210,74,${a})`; ctx.lineWidth = 8; ctx.strokeRect(4, 4, E.w - 8, E.h - 8); ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(S.cx - w / 2 - 1, S.top + 33, w + 2, 7);
  ctx.fillStyle = '#ffd24a'; ctx.fillRect(S.cx - w / 2, S.top + 34, w * k, 5);
}
const spearLen = (H) => (TUNING.weapons.find((w) => w.id === 'spear').len + TUNING.kit.weapon.spear.tip) * H;
function drawSpear(ctx, H, tip, u) {
  const L = spearLen(H), A = [tip[0] - u[0] * L, tip[1] - u[1] * L];
  if (paintWeapon(ctx, 'spear', A, u, L, H)) return;
  ctx.lineCap = 'round'; ctx.strokeStyle = '#7a5532'; ctx.lineWidth = 0.02 * H; line(ctx, A[0] - u[0] * 0.3 * H, A[1] - u[1] * 0.3 * H, tip[0], tip[1]);
}
export function spearFlight(ctx, E) {
  const sw = state.sw, MV = TUNING.champs.mevia, v = clamp((sw.t - (sw.wind - MV.flight)) / MV.flight, 0, 1), d = [sw.aim[0] - sw.rel[0], sw.aim[1] - sw.rel[1]], l = Math.hypot(d[0], d[1]) || 1;
  drawSpear(ctx, foeF(E).H, lerp2(sw.rel, sw.aim, v), [d[0] / l, d[1] / l]);
}
export function spearDown(ctx, E) {
  const L = lay(E), H = foeF(E).H, x = L.x0 + state.spearAt * L.H + TUNING.fighter.body * L.H;
  drawSpear(ctx, H, [x, L.floor + 0.02 * H], [-Math.cos(TUNING.champs.mevia.stuck), Math.sin(TUNING.champs.mevia.stuck)]);
}
export function flyingShield(ctx, E) {
  const Ff = foeF(E), u = 1 - state.flyS / 0.9;
  ctx.save(); ctx.translate(Ff.x + u * 0.7 * Ff.H, Ff.y - (0.55 + 0.9 * u - 1.3 * u * u) * Ff.H); ctx.rotate(u * 9); ctx.globalAlpha = clamp(state.flyS / 0.3, 0, 1);
  drawFoeShield(ctx, Ff.H, 0.75, lookFor(state.foe, true), Math.min(E.dpr || 1, TUNING.skin.maxDpr)); ctx.restore();
}
export function emperorSignal(ctx, E) {
  const C = TUNING.champs.aquila, [bw, bh, top] = C.box, u = 1 - state.switchT / C.signal, a = clamp(Math.min(u, 1 - u) * 8, 0, 1), cx = E.w / 2, bx = cx - bw / 2, by = E.safe.top + top;
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = '#3a2a40'; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = '#d9c9a0'; ctx.fillRect(bx - 6, by - 4, 8, bh + 4); ctx.fillRect(bx + bw - 2, by - 4, 8, bh + 4); ctx.fillRect(bx - 9, by - 7, bw + 18, 5);
  const emp = picSprite(E, 'emperor', TUNING.art.box, Math.round(bh * 1.25), bh);
  if (emp) { ctx.save(); ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip(); ctx.drawImage(emp.im, emp.sx, emp.sy, emp.sw, emp.sh, cx - bh * 0.625, by, bh * 1.25, bh); ctx.restore(); }
  ctx.fillStyle = '#5b2160'; ctx.fillRect(bx, by + bh * 0.66, bw, bh * 0.34); ctx.fillStyle = '#e6c866'; ctx.fillRect(bx, by + bh * 0.64, bw, 3);
  // his arm raised from the rail, the hand open: the signal
  const k = easeOut(clamp(u * 3, 0, 1)), hx = bx + bw * 0.8, hy = by + bh * (0.75 - 0.45 * k), r = bh * 0.1;
  ctx.fillStyle = '#5b2160'; ctx.fillRect(hx - r * 0.7, hy + r, r * 1.4, by + bh - hy - r);
  ctx.fillStyle = '#d4a77e'; rrect(ctx, hx - r, hy - r * 1.3, r * 2, r * 2.3, r * 0.6); ctx.fill(); ctx.strokeStyle = '#7a5032'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
}
// a disarm: his weapon spins up and away over his shoulder
export function flyingWeapon(ctx, E) {
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
export function drawFighter(ctx, E, F, fm, who, ga = 1) {
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
  // the Red Rage's roar: a red flush that swells over him
  const rsw = live ? state.sw : null;
  if (rsw && rsw.pre && rsw.fin <= 0 && rsw.t < rsw.pre + 0.15) {
    const k = clamp(rsw.t / (rsw.pre * 0.5), 0, 1) * clamp((rsw.pre + 0.15 - rsw.t) / 0.25, 0, 1) * (0.55 + 0.15 * Math.sin(state.m * 24)), g = ctx.createRadialGradient(0, -0.6 * H, 10, 0, -0.6 * H, 0.65 * H);
    g.addColorStop(0, `rgba(239,48,32,${k})`); g.addColorStop(1, 'rgba(239,48,32,0)');
    ctx.fillStyle = g; ctx.fillRect(-0.7 * H, -1.25 * H, 1.4 * H, 1.45 * H);
  }
  // step 20: a Capuan fake winds up in a violet haze
  if (rsw && rsw.dud && rsw.fin <= 0) {
    const k = 0.6 + 0.15 * Math.sin(state.m * 18), g = ctx.createRadialGradient(0, -0.6 * H, 10, 0, -0.6 * H, 0.62 * H);
    g.addColorStop(0, `rgba(167,139,250,${k})`); g.addColorStop(1, 'rgba(167,139,250,0)');
    ctx.fillStyle = g; ctx.fillRect(-0.7 * H, -1.25 * H, 1.4 * H, 1.45 * H);
  }
  const sc = live && state.pop < 1 ? 0.85 + 0.15 * (1 - state.pop) : 1;
  ctx.scale(sc, sc);
  ctx.globalAlpha = ga * (live && state.pop < 1 ? 1 - state.pop * 0.7 : 1);
  if (fall > 0) ctx.globalAlpha = 1 - fall * 0.5;
  // far arm and its shield, legs, tunic and belly, chest, head
  const sw = live ? state.sw : null, bashing = sw && sw.pose === 'bash', both = plateBoth(fm.parts);
  P('chest').both = both; P('belly').both = both;
  if (lk.gear && (lk.gear.cloak || (lk.tailor && lk.tailor.cloak))) { if (!fm.cloak) fm.cloak = mkPart(CLOAK, false); drawPart(ctx, E, fm.cloak, H, lk, null); }
  // step 24: the bow out, your blade hangs at your hip and the shield is slung on your back
  const slung = !isFoe && bowShown();
  if (slung) drawSlung(ctx, E, H, lk);
  // two blades (step 18): the second is the same painting, gripped in the far fist, drawn under it (his, and yours in the kit)
  if (isFoe ? fm.dual && !(live && state.disarm > 0) : !!state.me.dual && !!lk.kit && !slung) {
    ctx.save(); inFrame(ctx, fm.fr.armB, H);
    if (isFoe) drawWeapon(ctx, fm, H, !!lk.kit); else offBlade(ctx, H, fm.fr.armB.rot, lk);
    ctx.restore();
  }
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
    // (a painted weapon goes under his arm, so his fist closes over its grip)
    const fr = fm.fr.armF, under = !!lk.kit;
    if (!under) drawPart(ctx, E, P('armF'), H, lk, fr);
    ctx.save(); ctx.translate(fr.ox * H, fr.oy * H); ctx.rotate(fr.rot);
    if (live && hesitating()) {
      ctx.save(); ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 24; ctx.strokeStyle = `rgba(167,139,250,${0.5 + 0.4 * Math.sin(state.m * 60)})`; ctx.lineWidth = 0.07 * H; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, ARM_LEN * H); ctx.lineTo(0, (ARM_LEN + fm.weapon.len) * H); ctx.stroke(); ctx.restore();
    }
    // the Huntress's spear turns in her fist as she draws it back over her shoulder, and is gone once thrown
    const thrown = sw && sw.kind === 'throw' && (sw.thrown || sw.fin > 0);
    if (sw && sw.kind === 'throw' && !thrown && sw.grip) { ctx.translate(0, ARM_LEN * H); ctx.rotate(sw.grip); ctx.translate(0, -ARM_LEN * H); }
    if (sw && sw.pose === 'net' && sw.fin <= 0) drawNet(ctx, 0, (ARM_LEN + 0.05) * H, 0.1 * H); else if ((!live || state.disarm <= 0) && !thrown) drawWeapon(ctx, fm, H, under);
    // step 20: the spearhead glints as she draws it back
    if (live && sw && sw.kind === 'throw' && !thrown && sw.fin <= 0) spearGlint(ctx, 0, (ARM_LEN + fm.weapon.len) * H, TUNING.sigFx.glint * clamp(sw.t / (sw.wind * 0.4), 0, 1) * (0.8 + 0.2 * Math.sin(state.m * 30)));
    ctx.restore();
    if (under) drawPart(ctx, E, P('armF'), H, lk, fr);
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
    else if (g.id === 'winddancer') for (const [t, col] of [[0.55, L.cloth], [0.66, L.hi], [0.77, L.cloth]]) across(El, Hd, t, 0.045 * H, col, 0.018 * H);
    else if (g.id === 'playcrowd') { for (const t of [0.62, 0.8]) across(El, Hd, t, 0.047 * H, L.metal.lite, 0.024 * H); across(S, El, 0.55, 0.05 * H, L.metal.mid, 0.02 * H); }
    else {
      ctx.lineCap = 'round'; ctx.strokeStyle = '#1b1610'; ctx.lineWidth = 0.09 * H + 2; line(ctx, a[0], a[1], b[0], b[1]);
      const metal = g.id === 'riposte' || g.id === 'crusher';
      ctx.strokeStyle = metal ? L.metal.mid : L.cloth; ctx.lineWidth = 0.09 * H; line(ctx, a[0], a[1], b[0], b[1]);
      ctx.strokeStyle = metal ? L.metal.hi : 'rgba(255,190,170,0.4)'; ctx.lineWidth = 0.015 * H; line(ctx, a[0], a[1] - 0.025 * H, b[0], b[1] - 0.025 * H);
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
export function drawSwordArm(ctx, E) {
  const h = state.hand, H = myH(E), locked = h.lock > 0, blade = myBlade(E), wid = state.me.weapon, bare = wid === 'fist';
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
    // the forearm under the upper arm, so the muscle at its top runs out of the elbow rather than bulging over it
    drawSeg(ctx, kF, [h.ex, h.ey], [h.hx, h.hy], aw, !!h.flipF);
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
  } else if (lk.pauldron && !lk.kit) {
    // the brute's layered iron pauldron over the weapon shoulder (not on a painted man, who has no painted one)
    for (let i = 2; i >= 0; i--) {
      const r = (0.07 - i * 0.012) * H, cy = h.sy - 0.01 * H + i * 0.022 * H;
      ctx.beginPath(); ctx.ellipse(h.sx, cy, r * 1.15, r * 0.7, 0, Math.PI, TAU); ctx.closePath();
      ctx.fillStyle = metalGrad(ctx, h.sx + r, cy - r, h.sx - r, cy, lk.metal); ctx.fill(); ctx.strokeStyle = lk.metal.edge; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }
  const a = h.atk, hot = a && !a.done && h.sp >= TUNING.hit.minSpeed && !locked;
  const gx = h.hx + bx * 0.05 * H, gy = h.hy + by * 0.05 * H, steel = locked ? '#ff8a7a' : '#dfe6ee';
  // Step 14: fists swing at the fist (its glow round it, its jab spark at the knuckles), never at a blade's length
  const FW = TUNING.me.weapons.fist, fl = Math.hypot(h.hx - h.ex, h.hy - h.ey) || 1, kn = [h.hx + (h.hx - h.ex) / fl * FW.knuckle * H, h.hy + (h.hy - h.ey) / fl * FW.knuckle * H];
  const tip = bare ? kn : [h.ux, h.uy], glow = hot && (a.kind === 'over' ? 'rgba(255,200,90,0.5)' : 'rgba(125,227,255,0.45)');
  if (hot && bare) { ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(h.hx, h.hy, FW.glow * H, 0, TAU); ctx.fill(); }
  else if (hot) { ctx.strokeStyle = glow; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(h.ux, h.uy); ctx.stroke(); }
  const P = (t, s, len = blade, x0 = gx, y0 = gy) => [x0 + bx * len * t + nx * w * s, y0 + by * len * t + ny * w * s];
  const shape = (pts) => { ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); };
  // fists draw no weapon, as his fists when disarmed (the fist is the forearm's, drawn last); a painted one is pinned in the fist (step 14)
  // step 24: the bow in your fist in place of your weapon, from halfway through the swap to it
  const bowUp = bowShown();
  if (bowUp) drawBow(ctx, E);
  const painted = !bowUp && !bare && !!lk.kit && paintWeapon(ctx, weaponKey(wid, state.me.mace), [h.hx, h.hy], [bx, by], blade, H, G.weapon, locked, zoneFx());
  if (painted || bowUp) { /* drawn */ } else if (pole) {
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
  } else if (!bare) {
    // grip, pommel, crossguard, then the leaf blade
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(h.hx - bx * 0.07 * H, h.hy - by * 0.07 * H); ctx.lineTo(h.hx + bx * 0.04 * H, h.hy + by * 0.04 * H); ctx.stroke();
    ctx.fillStyle = '#c9a43a'; ctx.beginPath(); ctx.arc(h.hx - bx * 0.08 * H, h.hy - by * 0.08 * H, 5, 0, 6.28); ctx.fill();
    ctx.strokeStyle = '#c9a43a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(gx - nx * 0.05 * H, gy - ny * 0.05 * H); ctx.lineTo(gx + nx * 0.05 * H, gy + ny * 0.05 * H); ctx.stroke();
    // the sica's blade bows forward (its chord stays the straight blade the hits use); the others are a leaf
    if (wid === 'sica') shape([P(0, -0.8), ...[0.25, 0.5, 0.75].map((t) => P(t, sicaBow(t) - 0.9 * (1 - t))), P(1, 0), ...[0.75, 0.5, 0.25].map((t) => P(t, sicaBow(t) + 0.9 * (1 - t))), P(0, 0.8)]);
    else shape([...LEAF.map(([t, q]) => P(t, -q)), ...LEAF.slice(0, -1).reverse().map(([t, q]) => P(t, q))]);
    ctx.fillStyle = steel; ctx.fill(); ctx.strokeStyle = '#1b2026'; ctx.lineWidth = 2; ctx.stroke();
    // the shine runs down the blade's middle: the sica's follows its bow, so it never cuts across the crescent's hollow
    const mid = wid === 'sica' ? [0.06, 0.2, 0.35, 0.5, 0.65, 0.8, 0.94].map((t) => P(t, sicaBow(t))) : [[gx + bx * 6, gy + by * 6], [h.ux - bx * 6, h.uy - by * 6]];
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); mid.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke();
  }
  if (G.weapon && !bare && !painted && !bowUp) {
    const tip = [h.ux, h.uy], back = (k) => [h.ux - bx * k * H, h.uy - by * k * H], ts = [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85];
    // the cutting edges (the saw teeth's lines) follow each blade or head as drawn above, never the shaft
    const sides = (f) => [1, -1].map((sd) => ts.map((t) => f(t, sd)));
    let edges;
    if (wid === 'spear') { const o = back(0.13); edges = sides((t, sd) => P(t, sd * halfAt(SPEARHEAD, t), 0.13 * H, o[0], o[1])); }
    else if (wid === 'trident') { const pw = 0.04 * H + 0.006 * H; edges = [1, -1].map((k) => [0.11, 0.025].map((q) => [h.ux - bx * q * H + nx * pw * k, h.uy - by * q * H + ny * pw * k])); }
    else if (wid === 'axe' && state.me.mace) edges = [ringPts(h.ux - bx * 0.04 * H, h.uy - by * 0.04 * H, 0.055 * H)];
    else if (wid === 'axe') { const o = back(0.13), k = 0.034 * H / w; edges = [[P(0, k * 3.4, H, o[0], o[1]), P(0.06, k * 4.2, H, o[0], o[1]), P(0.13, k * 3.6, H, o[0], o[1])]]; }
    else if (wid === 'sica') edges = sides((t, sd) => P(t, sicaBow(t) + sd * 0.9 * (1 - t)));
    else edges = sides((t, sd) => P(t, sd * halfAt(LEAF, t)));
    if (wid === 'spear' || wid === 'trident') weaponGear(ctx, G.weapon, back(0.13), tip, w * 1.1, [h.hx - bx * 0.12 * H, h.hy - by * 0.12 * H], H, edges);
    else if (wid === 'axe') weaponGear(ctx, G.weapon, back(0.2), tip, 0.016 * H, [h.hx - bx * 0.12 * H, h.hy - by * 0.12 * H], H, edges);
    else weaponGear(ctx, G.weapon, [gx, gy], tip, w, [h.hx - bx * 0.08 * H, h.hy - by * 0.08 * H], H, edges);
  }
  if (hot && a.kind === 'jab') { ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(tip[0], tip[1], 6, 0, 6.28); ctx.fill(); }
  if (kit) { drawSeg(ctx, { ...kF, J: { ...kF.J, top: kF.J.a[1] + (kF.J.b[1] - kF.J.a[1]) * TUNING.kit.fist } }, [h.ex, h.ey], [h.hx, h.hy], aw, !!h.flipF); liveArmGear(ctx, h, H, lk, aw, kpx); }
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
  if (locked) E.text('X', tip[0], tip[1] - 22, { size: 22, color: '#ff8a7a', weight: '800' });
}

// Your off arm and the round shield: hanging at the hip when down, up across the chest when raised, cracked as it wears.
export function drawShield(ctx, E) {
  const sh = state.sh, Fy = youF(E), H = Fy.H, J = PARTS[4].joint, lk = lookFor(state.you, false);
  if (sh.broken) return;
  const [hx, hy] = toScreen(Fy, ...shieldPos());
  const [sx, sy] = toScreen(Fy, J[0], J[1]);
  const kit = lk.kit && kitPic('upperarm', lk.kit.tier) && kitPic('forearm', lk.kit.tier);
  const fist = () => { ctx.fillStyle = YOU.skin; ctx.beginPath(); ctx.arc(hx, hy, 0.042 * H, 0, TAU); ctx.fill(); ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = 2; ctx.stroke(); };
  // step 24: the bow is out: the shield (or the second blade) is away (drawFighter), the far hand reaches for the string
  if (bowShown()) { if (!kit) { limb(ctx, [[sx, sy], [hx, hy]], 0.07 * H, YOU.skin); fist(); } return; }
  // the painted shield arm is your body's far arm, drawn behind the torso as his is (its fist under the shield), so it is not drawn again here
  // Two blades (step 18): no shield; the painted far arm grips its blade in drawFighter, the drawn one here
  if (state.me.dual) {
    // raised (or following a slash) the painted blade comes in front of you, the far fist copied over its grip
    if (kit) {
      if (sh.up < 0.3 && !(state.offT > 0)) return;
      const fr = state.you.fr.armB, pa = state.you.parts.find((q) => q.d.id === 'armB');
      ctx.save(); ctx.translate(Fy.x, Fy.y); ctx.scale(Fy.dir, 1); ctx.rotate(Fy.a);
      ctx.save(); inFrame(ctx, fr, H); offBlade(ctx, H, fr.rot, lk); ctx.restore();
      const c = Math.cos(fr.rot), sn = Math.sin(fr.rot), fx = (fr.ox - sn * ARM_LEN) * H, fy = (fr.oy + c * ARM_LEN) * H;
      ctx.beginPath(); ctx.arc(fx, fy, TUNING.kit.weapon.fist * 1.4 * H, 0, TAU); ctx.clip();
      drawPart(ctx, E, pa, H, lk, fr);
      ctx.restore();
      return;
    }
    const fr = state.you.fr.armB;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(Fy.a + fr.rot); offBlade(ctx, H, fr.rot, lk); ctx.restore();
    limb(ctx, [[sx, sy], [hx, hy]], 0.07 * H, YOU.skin);
    ctx.fillStyle = YOU.skin; ctx.beginPath(); ctx.arc(hx, hy, 0.042 * H, 0, TAU); ctx.fill(); ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = 2; ctx.stroke();
    return;
  }
  if (!kit) limb(ctx, [[sx, sy], [hx, hy]], 0.07 * H, YOU.skin);
  // Untouchable: no shield at all, an empty fist (the kit's far arm ends in one)
  if (noShield() && kit) return;
  if (noShield()) { fist(); return; }
  ctx.save(); ctx.translate(hx, hy); shieldFace(ctx, E, lerp(0.11, 0.2, sh.up) * H, H, lk, !!kit); ctx.restore();
}
// your shield's face round (0, 0) at radius r (the arm's, or slung on your back): the round bronze shield, or Iron Wall's tower shield, tall and
// square; the kit's painted one; its card face, paint and cracks
export function shieldFace(ctx, E, r, H, lk, kit) {
  const sh = state.sh, g = lk.gear.shield, tp = !g && lk.tailor && lk.tailor.paint, tower = g && g.id === 'ironwall', dk = Math.min(E.dpr || 1, TUNING.skin.maxDpr);
  // the kit: your type's painted shield (Iron Wall's tower: the scutum at the tower's size)
  const kind = lk.kit && (tower ? 'scutum' : lk.kit.shield), TL = TUNING.kit.tall, rm = 0.2 * H * dk;
  const spx = kind === 'scutum' ? rm * TL[1] * 2 : rm * 2, kS = kit && shieldPic(kind, spx), tall = tower || (kS && kind === 'scutum');
  // the shield piece painted (step 6c-2): the tower's face is the tall shield, a round face the round shield's or an emblem on a tall one
  const fc = kS && gearArt(lk, 'shield', spx), emb = fc && !fc.J.h && kind === 'scutum';
  const tw = tower ? 0.72 : TL[1], th = tower ? 1.2 : TL[0];
  const shape = (k) => (tall ? rrect(ctx, -r * tw * k, -r * th * k, r * tw * 2 * k, r * th * 2 * k, r * 0.2 * k) : (ctx.beginPath(), ctx.arc(0, 0, r * k, 0, TAU)));
  ctx.save();
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
  // the tailor's paint painted (step 14) on the kit's shield face, or an emblem's size on a tall one
  const tP = tp && kS && tailorArt(lk, 'paint', spx);
  if (tP) pic(tP, (tall ? r * tw * TUNING.kit.emblem : r * TUNING.kit.tailor.paint) / tP.J.r); else if (tp) shieldPaint(ctx, r, tp);
  if (!fc && g && g.id === 'bait') { spiral(ctx, r * 0.8, FAM_LOOK.trick.hi); ctx.strokeStyle = '#2a1c10'; }
  if (!kS) { ctx.fillStyle = '#c9a43a'; ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, 6.28); ctx.fill(); ctx.stroke(); }
  if (!fc && g && g.id === 'thorns') spike(ctx, 0, 0, -0.6, r * 0.3, r * 0.16, BRONZE, true);
  if (!fc && g && g.id === 'bulwark') bossed(ctx, tall ? r * tw : r);
  const worn = shieldMax() - sh.hits;
  ctx.strokeStyle = '#1a120a'; ctx.lineWidth = 2;
  for (let i = 0; i < worn; i++) { const a = i * 1.7 + 0.5; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.25, Math.sin(a) * r * 0.25); ctx.lineTo(Math.cos(a + 0.2) * r * 0.65, Math.sin(a + 0.2) * r * 0.65); ctx.lineTo(Math.cos(a - 0.1) * r * 0.95, Math.sin(a - 0.1) * r * 0.95); ctx.stroke(); }
  if (sh.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${sh.flash / 0.25 * 0.5})`; shape(1); ctx.fill(); }
  if (g) gearGlint(ctx, r * 0.5, -r * 0.5, r * 0.4, g, 0.2);
  ctx.restore();
}
// the tailor's shield paint, inside the rim: a pair of wings, a thunderbolt, or a sun's rays
export function shieldPaint(ctx, r, tp) {
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
function beastMarks(ctx, fm, p, H, drawn = false) {
  const fr = fm.fr[p.d.frame || p.d.id];
  ctx.save(); if (fr) inFrame(ctx, fr, H);
  // the drawn beast's barding (no painting): its plate's shape in bronze (a lion's) or iron (a bear's)
  if (drawn && p.armour) { const M = fm.beast === 'lion' ? BRONZE : IRON, d = p.d; path(ctx, d, H); ctx.fillStyle = metalGrad(ctx, (d.x - 0.05) * H, (d.y - 0.08) * H, (d.x + 0.05) * H, (d.y + 0.08) * H, M); ctx.fill(); ctx.strokeStyle = M.edge; ctx.lineWidth = 1.5; ctx.stroke(); }
  // a plate's dents and cracks, as a man's (step 16)
  if (p.armour) { const d = p.d, r = d.shape === 'circle' ? d.r : Math.min(d.w, d.h) / 2; wear(ctx, p, H, d.x * H, d.y * H, r * H, () => path(ctx, d, H)); }
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
// screen, the far legs' shaded; null until every one has loaded, and the drawn beast stays. Step 6d: the legless torso, and each leg's two halves
// (fore, hind; up, lo) of one painting.
function beastKit(E, fm, H) {
  if (!kitOn() || !ART.has(`beast-${fm.beast}-torso`)) return null;
  const A = TUNING.beastArt[fm.beast], dk = Math.min(E.dpr || 1, TUNING.skin.maxDpr), dark = TUNING.beastArt.far, lw = TUNING.beastArt.leg * H * dk;
  const nm = (part) => { const b = `beast-${fm.beast}-${part}`; return fm.young && ART.has(`${b}-young`) ? `${b}-young` : b; };
  const LJ = { size: TUNING.beastArt.legSize }, half = (n) => [artPic(nm(n), LJ, lw), artPic(nm(n), LJ, lw, dark)];
  const K = {
    body: artPic(nm('torso'), A.torso, (A.torso.box[2] - A.torso.box[0]) * H * dk), head: artPic(nm('head'), A.head, A.head.size[0] * A.head.u * H * dk),
    legs: [half('fore-up'), half('fore-lo'), half('hind-up'), half('hind-lo')],
    tail: A.tail ? artPic(nm('tail'), A.tail, A.tail.size[0] * A.head.u * H * dk) : null, pin: TUNING.beastArt.pin[artStem(nm('torso'))] || null,
  };
  if (!(K.body && K.head && K.legs.every(([a, b]) => a && b) && (!A.tail || K.tail))) return null;
  // its barding (step 16): each piece fitted to the part it is worn on, while that part's plate holds
  const on = (k) => fm.parts.some((q) => q.d.id === TUNING.beasts.armour.plates[k] && q.armour), lay = (k, P, d = 0) => (on(k) ? bardPic(fm.beast, k, P, nm(BARD[k]), d) : null);
  K.bard = { head: lay('head', K.head), back: lay('back', K.body), chest: lay('chest', K.body), leg: lay('leg', K.legs[0][0]), legFar: lay('leg', K.legs[0][0], dark) };
  // the torso's and the head's pieces are baked into one copy with their part, so each is still one image a frame
  K.bodyB = bardBake(K.body, [K.bard.back, K.bard.chest]); K.headB = bardBake(K.head, [K.bard.head]);
  return K;
}
// a part's copy with the pieces it wears painted over it (cached on the copy by which pieces are on), or the copy itself with none
function bardBake(P, list) {
  const on = list.filter(Boolean);
  if (!on.length || !canSprite || !(P.im instanceof OffscreenCanvas)) return P;
  let C = BARDS.get(P);
  if (!C) BARDS.set(P, (C = {}));
  const key = `bake|${on.map((G) => G.src.src).join('|')}`;
  if (C[key]) return C[key];
  const cv = new OffscreenCanvas(P.im.width, P.im.height), c = cv.getContext('2d');
  c.drawImage(P.im, 0, 0); for (const G of on) c.drawImage(G.im, 0, 0);
  return (C[key] = { ...P, im: cv });
}
// Step 16 (Pack 26b): each barding piece is painted on its -A part's own canvas, so it is drawn with that part's box, pin and mirror. Fitted once
// to the part's copy on screen: moved from the -A part's joints to this part's (a young foreleg's sit elsewhere), cut to its outline, shaded for a
// far leg; cached on the copy, so a new copy (a new size or pick) fits it again.
const BARD = { head: 'head', back: 'torso', chest: 'torso', leg: 'fore-up' };
const BARDS = new WeakMap();
function bardPic(kind, k, P, part, dark) {
  const im = artImg(`beast-${kind}-armour-${k}`);
  if (!im) return null;
  if (!canSprite || !(P.im instanceof OffscreenCanvas)) return { im, J: P.J, kx: im.width / P.J.size[0], ky: im.height / P.J.size[1] };
  let C = BARDS.get(P);
  if (!C) BARDS.set(P, (C = {}));
  const key = `${k}|${dark}`;
  if (C[key] && C[key].src === im) return C[key];
  const cv = new OffscreenCanvas(P.im.width, P.im.height), c = cv.getContext('2d'), grown = k === 'leg' && { size: TUNING.beastArt.legSize, ...halfJ(`beast-${kind}-${BARD[k]}-A`) };
  c.imageSmoothingQuality = 'high';
  if (grown && artStem(part) !== `beast-${kind}-${BARD[k]}-A`) {
    const J = P.J, at = (q) => [q[0] * P.kx, q[1] * P.ky];
    drawSeg(c, { im, J: grown, kx: im.width / grown.size[0], ky: im.height / grown.size[1] }, at(J.a), at(J.b), J.w * P.kx, !!J.mir !== !!grown.mir);
  } else c.drawImage(im, 0, 0, cv.width, cv.height);
  c.globalCompositeOperation = 'destination-in'; c.drawImage(P.im, 0, 0);
  if (dark) { c.globalCompositeOperation = 'source-atop'; c.fillStyle = `rgba(20,10,4,${dark})`; c.fillRect(0, 0, cv.width, cv.height); }
  return (C[key] = { im: cv, J: P.J, kx: P.kx, ky: P.ky, src: im });
}
// The painted beast, drawn from its pose like the drawn one and in the same order: the far legs (shaded), the tail and the torso (mirrored: its PNG
// faces left), the near hind leg over the torso's edge, the head pinned by its eye with the tells on it, the near foreleg; each part's cuts and flash on top.
function beastPainted(ctx, fm, H, K, q, live, C, P, fw, hw) {
  const A = TUNING.beastArt[fm.beast], fr = fm.fr, lg = fm.lg, lion = fm.beast === 'lion';
  // the copies are at the screen's pixel ratio, so an unsmoothed draw stays clean and costs far less than a smoothed one
  ctx.imageSmoothingEnabled = false;
  const paw = fm.paw || (fm.paw = [false, false, false, false]), B = A.torso.box, BB = BEAST_BODY[fm.beast], bf = fr.body, bc = Math.cos(bf.rot), bs = Math.sin(bf.rot);
  // each leg's top on the painted torso's shoulder or hip (body units, in the body's frame), the far one at the rig's offset from the near one
  const top = (i) => {
    if (!K.pin) return lg[i][0];
    const q = K.pin[i < 2 ? 0 : 1], R = i < 2 ? BB.sh : BB.hp, far = i % 2, sz = A.torso.size;
    const x = B[2] - q[0] * (B[2] - B[0]) / sz[0] + (far ? R[1][0] - R[0][0] : 0), y = B[1] + q[1] * (B[3] - B[1]) / sz[1] + (far ? R[1][1] - R[0][1] : 0);
    return [bf.ox + x * bc - y * bs, bf.oy + x * bs + y * bc];
  };
  // (a barding piece is drawn as its part is, straight after it (baked into the torso's and head's copies), washed bright while it clangs)
  const PL = TUNING.beasts.armour.plates, bard = (k, draw, baked = false) => {
    const G = K.bard[k]; if (!G) return;
    if (!baked) draw(G);
    const p = P(PL[k === 'legFar' ? 'leg' : k]), g = p.clang / 0.25 * 0.5;
    if (g > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= g; draw(G); ctx.restore(); }
  };
  const leg = (i, w, dark) => {
    const [, k, f] = lg[i], S = (p) => [p[0] * H, p[1] * H], kk = S(k), ff = S(f), d = dark ? 1 : 0, L = K.legs, j = i < 2 ? 0 : 2;
    // the halves face left as the torso does, so both are mirrored to face ahead
    drawSeg(ctx, L[j][d], S(top(i)), kk, w * H, true);
    // The paw points the way the beast faces: the PNG's toes (-x) point back by the bone's drop share, so the lower leg is mirrored unless they
    // point ahead of it, past a dead band so a paw swinging through the knee's height never pops.
    const t = (ff[1] - kk[1]) / (Math.hypot(ff[0] - kk[0], ff[1] - kk[1]) || 1);
    if (Math.abs(t) > TUNING.beastArt.pawBand) paw[i] = t < 0;
    drawSeg(ctx, L[j + 1][d], kk, ff, w * H, !paw[i]);
    // the foreleg's guard on its upper half, over the knee
    if (i < 2) bard(dark ? 'legFar' : 'leg', (G) => drawSeg(ctx, G, S(top(i)), kk, w * H, true));
  };
  leg(1, fw, true); leg(3, hw, true);
  ctx.save(); inFrame(ctx, fr.body, H);
  if (K.tail) { const [tx, ty] = tailTip(q); drawSeg(ctx, K.tail, [A.tail.root[0] * H, A.tail.root[1] * H], [tx * H, ty * H], 0); }
  ctx.save(); ctx.scale(-1, 1);
  const torso = (G) => ctx.drawImage(G.im, -B[2] * H, B[1] * H, (B[2] - B[0]) * H, (B[3] - B[1]) * H);
  torso(K.bodyB); bard('back', torso, K.bodyB !== K.body); bard('chest', torso, K.bodyB !== K.body);
  ctx.restore();
  ctx.restore();
  beastMarks(ctx, fm, P('chest'), H); beastMarks(ctx, fm, P('belly'), H);
  leg(2, hw, false);
  beastMarks(ctx, fm, P('legs'), H);
  ctx.save(); inFrame(ctx, fr.head, H);
  const hd = P('head').d, hx = hd.x * H, hy = hd.y * H, s = A.head.u * H, EA = TUNING.beastArt.eyeAt;
  const head = (G) => ctx.drawImage(G.im, hx + EA[0] * H - A.head.eye[0] * s, hy + EA[1] * H - A.head.eye[1] * s, A.head.size[0] * s, A.head.size[1] * s);
  head(K.headB); bard('head', head, K.headB !== K.head);
  beastFace(ctx, H, hx, hy, q, C, lion, live, true);
  ctx.restore();
  beastMarks(ctx, fm, P('head'), H);
  leg(0, fw, false);
  beastMarks(ctx, fm, P('legF'), H);
  ctx.imageSmoothingEnabled = true;
}
export function drawBeast(ctx, E, F, fm, who, ga = 1) {
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
    beastMarks(ctx, fm, P('chest'), H, true); beastMarks(ctx, fm, P('belly'), H, true);
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
    beastMarks(ctx, fm, P('head'), H, true);
    // the near foreleg over the chest, a red cross on a lamed leg, then the gaps and their light
    beastLeg(ctx, lg[0], H, fw, C.body, C.line);
    beastMarks(ctx, fm, P('legF'), H, true);
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
export function drawShieldBtns(ctx, E) {
  const sh = state.sh, sw = state.sw, shown = sw && sw.puppet && sw.fake && !sw.switched, tell = tellOn(sw) && !hesitating() && !shown ? sw.zone : null, fakeBtn = hesitating() || shown ? sw.zone : null;
  const tell2 = tell && sw.zone2;
  const pulse = 0.5 + 0.5 * Math.sin(state.m * 14);
  for (const b of shieldBtns(E)) {
    if (b.dodge) { drawDodgeBtn(ctx, E, b); continue; }
    const on = raised() && sh.zone === b.z, hot = tell === b.z || tell2 === b.z, perfect = hot && sw.wind - sw.t <= perfectWin();
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
  const sub = state.bitT > 0 ? 'off balance' : wall ? 'at the wall' : state.dg.down && state.dg.t > TUNING.dodge.dur ? 'backing off' : firstRun(E) ? 'hold: back off' : '';
  if (sub) E.text(sub, b.x + b.w / 2, b.y + b.h * 0.76, { size: 14, weight: '700', color: ink });
}
// The arena's edges: a low timber barrier behind each fighter, where he can give no more ground.
export function drawWalls(ctx, E) {
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
export function drawGuard(ctx, E) {
  if (state.fallT > 0) return;
  const F = foeF(E), H = F.H, f = state.foe, sty = f.shield ? { tint: '#7dd3fc', label: 'SHIELD' } : f.beast ? { tint: '#ead0a0', label: 'PAW' } : f.dual ? { tint: '#fca5a5', label: 'BLADES' } : { tint: '#fde68a', label: 'GUARD' };
  if (covering()) {
    const c = state.cover, r = c.r * H, k = clamp(c.t / c.max, 0, 1);
    ctx.save(); ctx.translate(F.x, F.y); ctx.scale(F.dir, 1); ctx.rotate(F.a);
    ctx.translate(c.dx * H, c.dy * H);
    ctx.globalAlpha = 0.45 + 0.4 * Math.min(1, k * 3);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0, 'rgba(210,225,240,0.75)'); g.addColorStop(1, 'rgba(90,110,130,0.7)');
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.28); ctx.fillStyle = g; ctx.fill();
    ctx.setLineDash([6, 4]); ctx.strokeStyle = sty.tint; ctx.lineWidth = 3.5; ctx.stroke(); ctx.setLineDash([]);
    if (f.dual) {
      // crossed blades: a weaker guard, cracking with each blow it takes
      ctx.lineCap = 'round';
      for (const sd of [-1, 1]) { ctx.strokeStyle = '#1b2026'; ctx.lineWidth = 6; line(ctx, -r * 0.75, sd * r * 0.75, r * 0.75, -sd * r * 0.75); ctx.strokeStyle = '#dfe6ee'; ctx.lineWidth = 3; line(ctx, -r * 0.75, sd * r * 0.75, r * 0.75, -sd * r * 0.75); }
      for (let i = 0; i < state.coverHits; i++) { ctx.strokeStyle = '#7f1d1d'; ctx.lineWidth = 2; const a = 0.6 + i * 2.1; line(ctx, Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2, Math.cos(a + 0.3) * r * 0.9, Math.sin(a + 0.3) * r * 0.9); }
    } else { ctx.beginPath(); ctx.arc(0, 0, r * 0.25, 0, 6.28); ctx.fillStyle = 'rgba(40,50,60,0.7)'; ctx.fill(); }
    ctx.restore();
    const [gx, gy] = toScreen(F, c.dx + 0.02, c.dy - c.r - 0.03);
    E.text(sty.label, gx, gy, { size: 11, color: sty.tint, weight: '700', alpha: 0.95 });
  }
}

// The foe's tell: a band at the height of the coming blow. The label says what to do, and turns gold in the perfect-block window.
let zoneLbl = null;
// (the Red Rage's roar is its own tell: no band until his arm moves; Aquila's two heights each get a band)
const tellOn = (sw) => !!sw && sw.fin <= 0 && !(sw.pre && sw.t < sw.pre);
export function drawZone(ctx, E) {
  const sw = state.sw;
  zoneLbl = null;
  if (!tellOn(sw)) return;
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
  for (const yy of sw.zone2 ? [y, zoneScreenY(L, sw.zone2)] : [y]) {
    const g = ctx.createLinearGradient(0, yy - bh, 0, yy + bh);
    g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.5, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.fillRect(x0, yy - bh, w, bh * 2);
  }
  if (sw.counter) {
    const [gx, gy] = toScreen(Ff, 0.2, sw.zone.y);
    ctx.save(); ctx.shadowColor = '#ff5a3a'; ctx.shadowBlur = 30 + 20 * pulse;
    ctx.strokeStyle = `rgba(255,120,80,${0.6 + 0.4 * pulse})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(gx, gy, 0.16 * L.H, 0, 6.28); ctx.stroke(); ctx.restore();
  }
  const ar = `rgba(${rgb},${0.55 + 0.4 * pulse})`;
  for (const yy of sw.zone2 ? [y, zoneScreenY(L, sw.zone2)] : [y]) {
    ctx.strokeStyle = `rgba(${rgb},${0.5 + 0.4 * pulse})`; ctx.lineWidth = 3; ctx.setLineDash([14, 10]);
    ctx.beginPath(); ctx.moveTo(x1, yy); ctx.lineTo(x0, yy); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = ar; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const ax = x0 + w * 0.18, s = 7;
    ctx.beginPath(); ctx.moveTo(ax - s, yy - s); ctx.lineTo(ax - 2 * s, yy); ctx.lineTo(ax - s, yy + s); ctx.stroke();
  }
  const pose = sw.fake && !sw.switched ? sw.fakePose : sw.pose, name = sw.kind === 'combo' ? `COMBO ${sw.idx + 1}/${sw.n}` : POSE_NAME[pose];
  const what = pose === 'bash' ? 'BASH: DODGE' : pose === 'net' ? 'NET: DODGE' : null, zl = sw.zone2 ? `${sw.zone.label} / ${sw.zone2.label}` : sw.zone.label, ly = (sw.zone2 ? Math.min(y, zoneScreenY(L, sw.zone2)) : y) - bh - 10;
  zoneLbl = shown ? { t: `FEINT: NOT ${sw.fake.label}`, y: y - bh - 10, color: '#c4b5fd', alpha: 1 } : { t: what || (perfect ? `${zl} NOW` : inWin ? `SHIELD ${zl}` : `${sw.counter ? 'COUNTER ' : ''}${name} ${zl}`), y: ly, color: `rgb(${rgb})`, alpha: 1 };
}
// The tell's label, drawn after the shield and sword arm so they never cover it: centred over the foe, kept on screen, so it never sits under your arm.
export function drawZoneLabel(ctx, E) {
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
  const b = finBtn(E), R = E.w - 16 - E.safe.right - armsW(E), room = R - (colRect(E).x + colRect(E).w + 12), ctx = E.ctx;
  let y = (b ? b.y : E.h - 10 - E.safe.bottom - TUNING.finBtn.h) - 23;
  ctx.font = '800 14px system-ui, sans-serif';
  for (const [s, t] of [[b && state.finHintT > 0 ? 'Tap to spend your Momentum.' : '', state.finHintT], [state.hintT > 0 ? state.hintS : '', state.hintT]]) {
    if (!s) continue;
    const lines = wrapPx(ctx, s, room - 8, 14, '800'), tw = Math.max(...lines.map((l) => ctx.measureText(l).width)), ph = 18 * lines.length + 12;
    out.push({ lines, r: R, x: R - tw, y, px: R - tw - 8, py: y - 18 * (lines.length - 1) - 15, pw: tw + 16, ph, a: clamp(t / 1.5, 0, 1) });
    y -= ph + 6;
  }
  return out;
}
export function drawRightHints(E) {
  const ctx = E.ctx;
  for (const q of rightHints(E)) {
    ctx.globalAlpha = q.a; E.roundRect(q.px, q.py, q.pw, q.ph, 10, 'rgba(20,12,4,0.72)', null); ctx.globalAlpha = 1;
    q.lines.forEach((l, i) => E.text(l, q.r, q.y - 18 * (q.lines.length - 1 - i), { size: 14, align: 'right', weight: '800', color: '#fde68a', alpha: q.a }));
  }
}
// The hint, in a player's first bouts ever: two short lines along the bottom, in the space right of the left thumb's column, fading out.
export function drawHint(ctx, E) {
  const t = state.m - state.boutT0, D = TUNING.hint.dur;
  if (t > D) return;
  let y = E.h - 12 - E.safe.bottom;
  const R = colRect(E), x0 = R.x + R.w + 12, cx = (x0 + E.w - E.safe.right - 12) / 2, a = clamp((D - t) / 1.5, 0, 1);
  const lines = ['Left thumb: shield heights, and DODGE.', 'Right thumb: your weapon. Push far: lunge.'];
  ctx.font = '700 12px system-ui, sans-serif';
  const hw = Math.max(...lines.map((s) => ctx.measureText(s).width)), hh = (lines.length - 1) * 17 + 14;
  y = aboveFin(E, cx + hw / 2, hh, y + 7 - hh) + hh - 7;
  lines.forEach((s, i) => E.text(s, cx, y - (lines.length - 1 - i) * 17, { size: 12, color: '#f0e6cc', weight: '700', alpha: a }));
}
// The finisher button, bottom right, glowing violet: the finisher's name, its cost in pips, and (with two ready) an arrow chip that cycles to the other.
// The first time it ever shows, a one-line hint sits above it.
export function drawFinBtn(ctx, E) {
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
export function drawCaption(ctx, E) {
  const c = state.caption;
  if (!c) return;
  // clear of the left column, so DODGE and its line stay in sight
  const R = colRect(E), w0 = Math.min(E.w - 220, 540), x = Math.max((E.w - w0) / 2, R.x + R.w + 8), w = Math.min(w0, E.w - E.safe.right - 8 - x), cx = x + w / 2;
  const a = clamp(c.t / 0.4, 0, 1) * clamp((c.max - c.t) / 0.15, 0, 1), lh = 18, h = 10 + c.lines.length * lh, y = aboveFin(E, x + w, h, E.h - E.safe.bottom - h - 4);
  ctx.globalAlpha = a;
  E.roundRect(x, y, w, h, 10, 'rgba(24,16,40,0.88)', c.good ? '#ffd24a' : '#a78bfa');
  c.lines.forEach((t, i) => E.text(t, cx, y + 5 + lh / 2 + i * lh, { size: i ? 13 : 16, weight: i ? '700' : '800', color: i ? '#ede9fe' : c.good ? '#ffd24a' : '#c4b5fd', alpha: a }));
  if (state.sw && state.sw.lesson === 'slow') E.text('slow motion', x + w - 8, y - 10, { size: 14, align: 'right', color: '#a78bfa', alpha: a });
  ctx.globalAlpha = 1;
}

// The stands, the wall and the sand never move, so they are painted once per screen size and run (the crowd is seeded) and copied each frame.
let bgSpr = null;
export function drawBackground(ctx, E) {
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
