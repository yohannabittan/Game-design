// Arena: The scenes: menu, story, the arena pick, the ludus, champions, the roll, play and over.
// Split from game.js by tools/arena-split.mjs (ADR-0024). Only tuning.js and data.js may be read while modules load.

import { clamp, lerp, ease } from './engine.js';
import { TUNING } from './tuning.js';
import { NEW_CHAMPS, ARENAS, ARENA, ORIGINS, brutus, bandOf, endingOf, LUDUS, LUDUS_ITEM, TAILOR, FAMS, CARD, WARES, titleOf, PARTS, ARM_LEN,
  SHOULDER, PLATES, playerParts, mkPart, lenN } from './data.js';
import { camUpdate, lay, youF, foeF, toScreen, guardPt, poseYou, solveArm, moveHand, updateAttack, checkExhaust, stepYou, raised, updateDefence,
  shieldMax, poseFoe, stepFoe, knee, buttonAt, raiseShield, dodge, checkHits, bounce, updateOff, dust, ring, stepJuice, paintGlow, drawBanner,
  heartShatter, ringSound, clangSound, landChime, tickSound, ooh, crowdVerdict } from './fight.js';
import { lamed, guardJab, sigOf, updateFoe, taunt, stepIn, updatePair, settleFeint } from './foe.js';
import { updateFinisher, firstRun, runsDone, updateHints, finTouch, crowdDrain, twirl, baitDrop, thumbFav, addBleed, updateBleed } from './cards.js';
import { weaponKey, weaponArt, picSprite, drawPic, sayLine, KIT_HELM, kitTier, kitPic, manArt, beastArt, dollArt, helmArt, gearPic, drawSeg,
  torsoPlate, TAU, GTYPE, lookOf, LEGS, canSprite, shade, lw, line, face, lerp2, hudRow, heartAt, drawHudHeart, drawPips, foeHealth, drawCrowdMeter,
  crowdBar, drawCoin, drawEdge, warmPair, drawEdgeTag, drop, rrect, drawNet, netArt, netK, drapeNet, drawWeapon, blinkGhosts, capuanGhosts,
  blinkStreaks, readGlow, spearFlight, spearDown, flyingShield, emperorSignal, flyingWeapon, drawFighter, drawSwordArm, drawShield, shieldPaint,
  drawShieldBtns, drawWalls, drawGuard, drawZone, drawZoneLabel, drawRightHints, drawHint, drawFinBtn, drawCaption, drawBackground } from './draw-fight.js';
import { openDraft, swapSpoil, buyWare, leaveTent, buyBandage, pickCard, skipDraft, rerollDraft, famGlyph, drawIcon, tapCard, drawDraft, drawTent,
  drawBandage, labTab, drawLab, labTap, tokenButton, heroArm, heroPose, kitIconSprite, armourIcon, weaponIcon, keyIcon, fitSize, wrapPx, drawIntro,
  clipLine, miniCard, TIER_COL, sliceArcs, wheelRest, sliceCol, drawWheel, spinRot, pegsPassed, iconWeapon, drawMeCard, purseOf, drawPurse, noPlate,
  purseNudge, meMini, fameOf, fameFromLedger, carveChampion, vetArenas, ludusOf, ludusBuys, startable, startPick } from './screens.js';
import { arena, state, easeOut, wrap, pidx, noShield, ME_WHEEL, rollMe, kitMe, wheelList, statTier, deriveMe, respinMe, vetMe, rivalOf, newRack,
  newRound, saveRun, resumeRun, ART, artV, artImg, artState, artSettled, artFade, shippedArt, BACKDROP, champPic, kitOn } from './game.js';
import { yardDue, startYard, endYard, yardFields, yardRelease, updateYard, drawYard } from './features/yard.js';
import { armsTouch, aimDown, aimAt, aimUp, stepArms, bowDown, drawKnives, drawArmsBtns, knifeBuy, lessonDue, startLesson, updateLesson, drawLesson } from './features/ranged.js';

// ====== JUICE (continued) ======
// a new pop stacks above (or, at the HUD, below) a live one near it, so simultaneous texts never overlap
export let popTop = 80;
// ====== DRAWING (continued) ======
// k: the wheel's place in idx (ME_WHEEL); body: the respin may roll it again; at: where it landed
export const WHEELS = [
  { k: 0, title: 'SIZE', q: 'Size?', body: true, cols: ['#2f7d6d', '#4a6a8c', '#6b5a8c', '#8c4a6a', '#a8402e'] },
  { k: 1, title: 'STRENGTH', q: 'Strength?', body: true },
  { k: 2, title: 'SPEED', q: 'Speed?', body: true },
  { k: 3, title: 'STAMINA', q: 'Stamina?', body: true },
  { k: 6, title: 'ORIGIN', q: 'Origin?', cols: ['#5f7a3a', '#7a3a3a', '#a07a3a', '#8c5a2e', '#2e5f7a', '#6a4a8c', '#a8402e', '#b8923a', '#3a7a5f'] },
  { k: 7, title: 'REASON', q: 'Reason?', cols: ['#2f7d6d', '#8a6a2a', '#8b2e2e', '#b8923a', '#6a4a8c'] },
].map((wh) => ({ ...wh, list: (me) => wheelList(wh.k, me.idx, me.open || []), at: (me) => me.idx[wh.k] }));
// ====== SCENES: menu, roll, play, over ======
export const portrait = (E) => E.h > E.w;
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

// Old Brutus's short intro, one line for each of the story's cards (step 17)
const STORY = ['So. Another nobody from the pit.', 'I am Brutus. I make champions out of nobodies.', 'The wheels decide who you are, and what you fight for.',
  'Five bouts stand between you and the end of it. The last is the champion.', 'Win, and Rome remembers you. Fall, and I chalk your name on the wall.'];
// The menu (step 12), built from the art that ships: the arena you last fought in behind, darkened at its edges, two torches flickering either side of
// the bronze title and dust drifting; your last fighter (or a fresh roll's look) on the sand at the left, breathing, cloak swaying, Old Brutus beside
// them with one line for your progress; Play a bronze gate plaque (Resume when a run was saved), the Ludus (its dot), Story and Sound stone plaques (New
// run beside them with a run); the Wall of Champions a carved stone tablet (a tap opens it) and the Pit Wall a chalked board at the right, three names
// each; a low crowd murmur with the sound on. Before the first menu (or the story) a boot card waits for its paintings (TUNING.load).
const BOOT = { done: false, t0: -1, bar: 0 };
// the boot card's clock: its bar follows the paintings that have landed, and it is done once they all have (or TUNING.load.boot s have passed)
function bootStep(E, names, dt) {
  if (BOOT.t0 < 0) BOOT.t0 = E.time;
  const n = names.filter((q) => artState(q) !== '').length, ready = artListed(E) && n === names.length;
  BOOT.bar += (n / Math.max(1, names.length) - BOOT.bar) * Math.min(1, dt * 8);
  if (ready || E.time - BOOT.t0 >= TUNING.load.boot) { BOOT.done = true; artFade(); MENU_BIG.key = MENU_BIG.cv = null; }
  return BOOT.done;
}
// the fighter and arena on the menu: a saved run's, else the last one sent out, else the newest champion's, else a fresh roll's look in the Pit
function menuFighter(E) {
  const run = E.save.get('run', null), last = E.save.get('last', null), c = E.save.get('champs', [])[0], q = (run && run.me && run) || (last && last.me && last);
  if (q) return { me: q.me, arena: ARENA[q.arena] ? q.arena : 'pit' };
  if (c && c.me) return { me: deriveMe({ ...c.me }), arena: ARENA[c.arena] ? c.arena : 'pit' };
  return { me: rollMe(TUNING.menu.seed), arena: 'pit' };
}
// Old Brutus's line for your progress: your reason's line with a run saved, his first words before any run, the next arena's opening line, and
// once every arena is cleared, who he is; proud once a champion is carved
function menuBrutus(E) {
  const run = E.save.get('run', null), to = openTo(E), champs = E.save.get('champs', []).length, fought = (run && run.me) || E.save.get('wall', []).length || champs || to;
  const line = run && run.me ? brutus(run.me, 'intro') : !fought ? STORY[0] : to >= ARENAS.length ? STORY[1] : ARENAS[to].brutus;
  return { line, pic: champs ? 'brutus-proud' : 'brutus' };
}
// the menu's own paintings, which the boot card waits for: the backdrop, the fighter's paint (and weapon) and Brutus, and the title
function menuArt(m) {
  const D = dollArt(m.parts, m.me.str, m.gm), wk = m.weapon && weaponKey(m.weapon.weapon.id, m.weapon.mace);
  return [BACKDROP[m.arena], m.say.pic, 'logo-arena', ...(kitOn() ? [...D.body, ...D.extra, ...(wk && TUNING.kit.weapon[wk] ? [weaponArt(wk)] : [])] : [])];
}
// a dev build waits for its art manifest, unless the fetch came back empty-handed
function artListed(E) {
  if (!ART || ART === shippedArt || ART.names.length) return true;
  try { return performance.getEntriesByType('resource').some((r) => /\/candidates\.json$/.test(r.name) && r.responseStatus >= 400); } catch (e) { return false; }
}
function menuLay(E, run) {
  const M = TUNING.menu, T = E.safe.top, B = E.h - E.safe.bottom, L = 16 + E.safe.left, R = E.w - 16 - E.safe.right, cx = E.w / 2;
  const cw = clamp(E.w * M.col[0], M.col[1], M.col[2]), side = (R - L - cw) / 2 - M.gap, ts = Math.round(clamp(E.h * M.title[2], M.title[0], M.title[1]));
  const ty = T + 10 + ts * 0.55, fy = ty + ts * 0.5 + 14, py = fy + 22 + M.play / 2;
  const r1 = py + M.play / 2 + M.gap + M.small / 2, r2 = r1 + M.small + M.gap, btn = {};
  // (step 23: Training, the yard again, on the second row)
  (run ? [['new', 'ludus'], ['story', 'sound', 'train']] : [['ludus', 'story'], ['sound', 'train']]).forEach((row, j) => {
    const n = row.length, gw = (cw - 10 - (n - 1) * M.gap) / n;
    row.forEach((k, i) => { const x = cx + (i - (n - 1) / 2) * (gw + M.gap); btn[k] = { x: x - gw / 2, y: (j ? r2 : r1) - M.small / 2, w: gw, h: M.small }; });
  });
  btn.play = { x: cx - (cw - 10) / 2, y: py - M.play / 2, w: cw - 10, h: M.play };
  const wt = T + 56, wh = Math.min(M.wallH, (B - 8 - wt - 10) / 2), wy = wt + Math.max(0, (B - 8 - wt - 2 * wh - 10) / 2), wx = R - side;
  const s = Math.min(M.fighter * E.h / 1.08, side / 0.75);
  return { T, B, L, R, cx, cw, side, ts, ty, fy, btn, champs: { x: wx, y: wy, w: side, h: wh }, pit: { x: wx, y: wy + wh + 10, w: side, h: wh },
    fig: { x: L + side / 2, y: B - 14, s }, say: { x: cx - cw / 2, y: r2 + M.small / 2 + 8, w: cw, h: B - 8 - (r2 + M.small / 2 + 8) } };
}
// a painted piece of the menu, kept as a sprite per key at the screen's pixel ratio (drawn live without OffscreenCanvas)
const MENU_SPR = new Map(), MENU_BIG = { key: null, cv: null };
function menuBlit(ctx, E, key, x, y, w, h, paint) {
  if (!canSprite) { ctx.save(); ctx.translate(x, y); paint(ctx); ctx.restore(); return; }
  // a screen-sized one (the layer, the boot card) is kept alone, the small ones up to 48
  const k = Math.min(E.dpr || 1, TUNING.skin.maxDpr), kk = `${key}|${w}|${h}|${k}`, big = w * h >= E.w * E.h / 2;
  let sp = big ? (MENU_BIG.key === kk ? MENU_BIG.cv : null) : MENU_SPR.get(kk);
  if (!sp) {
    const cv = new OffscreenCanvas(Math.max(1, Math.ceil(w * k)), Math.max(1, Math.ceil(h * k))), c = cv.getContext('2d', { alpha: !big });
    c.scale(k, k); paint(c); sp = cv;
    if (big) Object.assign(MENU_BIG, { key: kk, cv });
    else { if (MENU_SPR.size > 48) MENU_SPR.clear(); MENU_SPR.set(kk, sp); }
  }
  ctx.drawImage(sp, x, y, w, h);
}
export function ink(c, t, x, y, size, weight, color, align = 'center') {
  c.font = `${weight} ${size}px system-ui, sans-serif`; c.textAlign = align; c.textBaseline = 'middle'; c.fillStyle = color; c.fillText(t, x, y);
}
// the backdrop: the painted arena scaled to cover (the drawn dusk and sand without it), a wash, and dark edges
function paintMenuBack(c, E, bd) {
  const M = TUNING.menu, w = E.w, h = E.h;
  if (bd) {
    const s = Math.max(w / bd.width, h / bd.height);
    c.drawImage(bd, (w - bd.width * s) / 2, h - bd.height * s, bd.width * s, bd.height * s);
  } else {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1a1420'); g.addColorStop(0.5, '#3a2a28'); g.addColorStop(0.56, '#8a6a42'); g.addColorStop(1, '#4e3d26');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }
  c.fillStyle = `rgba(16,10,14,${M.wash})`; c.fillRect(0, 0, w, h);
  const v = c.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.3, w / 2, h * 0.45, Math.hypot(w, h) * 0.6);
  v.addColorStop(0, 'rgba(8,5,6,0)'); v.addColorStop(1, `rgba(8,5,6,${M.vignette})`);
  c.fillStyle = v; c.fillRect(0, 0, w, h);
}
// the dark sand behind the boot card
function paintBootBack(c, E) {
  const g = c.createLinearGradient(0, 0, 0, E.h);
  g.addColorStop(0, '#120d0a'); g.addColorStop(0.55, '#241a12'); g.addColorStop(1, '#3a2b1c');
  c.fillStyle = g; c.fillRect(0, 0, E.w, E.h);
}
// "ARENA" in stamped bronze: a soft shadow, a dark rim, a bronze gradient and a light edge along its top; step 14: the designer's pick of the painted
// logo (logo-arena) once it has loaded, fitted inside TUNING.menu.logo title sizes wide and high
function paintTitle(c, ts, w, h, im = null) {
  if (im) {
    const [bw, bh] = TUNING.menu.logo, k = Math.min(bw * ts / im.width, bh * ts / im.height), lw = im.width * k, lh = im.height * k;
    c.imageSmoothingQuality = 'high'; c.drawImage(im, (w - lw) / 2, (h - lh) / 2, lw, lh); return;
  }
  const x = w / 2, y = h / 2, t = 'ARENA';
  c.font = `900 ${ts}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  c.save(); c.shadowColor = 'rgba(0,0,0,0.75)'; c.shadowBlur = ts * 0.2; c.shadowOffsetY = ts * 0.08; c.fillStyle = '#2b1b08'; c.fillText(t, x, y); c.restore();
  c.lineWidth = Math.max(2, ts * 0.09); c.strokeStyle = '#2b1b08'; c.strokeText(t, x, y);
  const g = c.createLinearGradient(0, y - ts * 0.42, 0, y + ts * 0.42);
  g.addColorStop(0, '#fff0c4'); g.addColorStop(0.38, '#e4b264'); g.addColorStop(0.62, '#a8742c'); g.addColorStop(1, '#6a4516');
  c.fillStyle = g; c.fillText(t, x, y);
  c.lineWidth = 1; c.strokeStyle = 'rgba(255,240,200,0.6)'; c.strokeText(t, x, y - 1);
}
// A plaque w x h at (m, m): bronze (a gate's: rivets and bars) or stone, with its rim, a highlight along the top and the label stamped in; pressed, it
// sits 2 px lower and darker on a shorter shadow
const PLAQUE = {
  bronze: { hi: '#f2c477', mid: '#b47c2e', lo: '#6b4314', edge: '#2b1b08', line: 'rgba(255,236,190,0.6)', ink: '#2a1606', lift: 'rgba(255,228,170,0.55)' },
  stone: { hi: '#8f887c', mid: '#6a645a', lo: '#48433c', edge: '#1f1c18', line: 'rgba(240,232,214,0.35)', ink: '#f3ead6', lift: 'rgba(0,0,0,0.6)' },
};
function paintPlaque(c, kind, label, w, h, down, size, m) {
  const P = PLAQUE[kind], r = Math.min(12, h * 0.26), d = down ? 2 : 0, y = m + d;
  c.fillStyle = 'rgba(0,0,0,0.5)'; rrect(c, m + 1, m + (down ? 3 : 5), w - 2, h, r); c.fill();
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, down ? P.mid : P.hi); g.addColorStop(0.45, P.mid); g.addColorStop(1, P.lo);
  rrect(c, m, y, w, h, r); c.fillStyle = g; c.fill(); c.lineWidth = 2; c.strokeStyle = P.edge; c.stroke();
  rrect(c, m + 3.5, y + 3.5, w - 7, h - 7, Math.max(2, r - 3)); c.lineWidth = 1; c.strokeStyle = P.line; c.stroke();
  if (kind === 'bronze') {
    c.fillStyle = 'rgba(43,27,8,0.18)';
    for (let i = 1; i < 8; i++) c.fillRect(m + i * w / 8 - 1.5, y + 7, 3, h - 14);
    for (const [rx, ry] of [[9, 9], [w - 9, 9], [9, h - 9], [w - 9, h - 9]]) {
      c.fillStyle = P.edge; c.beginPath(); c.arc(m + rx, y + ry, 3, 0, TAU); c.fill();
      c.fillStyle = P.hi; c.beginPath(); c.arc(m + rx - 0.8, y + ry - 0.8, 1.4, 0, TAU); c.fill();
    }
  }
  const fs = fitSize(c, label, size, w - 20), cy = y + h / 2;
  ink(c, label, m + w / 2, cy + (kind === 'bronze' ? 1 : -1), fs, '800', P.lift);
  ink(c, label, m + w / 2, cy, fs, '800', P.ink);
}
function plaque(ctx, E, b, kind, label, down, size) {
  const m = 6;
  menuBlit(ctx, E, `plq|${kind}|${label}|${down ? 1 : 0}|${size}`, b.x - m, b.y - m, b.w + 2 * m, b.h + 2 * m + 2, (c) => paintPlaque(c, kind, label, b.w, b.h, down, size, m));
}
// The walls: a carved stone tablet (the champions, gilded in its grooves) or a chalked slate in a wooden frame (the fallen), its head and up to
// TUNING.menu.names names, or a short prompt when empty
function paintWall(c, w, h, head, names, empty, carved) {
  if (carved) {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#7a7366'); g.addColorStop(1, '#4c473f');
    rrect(c, 0, 0, w, h, 6); c.fillStyle = g; c.fill(); c.lineWidth = 2; c.strokeStyle = '#25211c'; c.stroke();
    c.strokeStyle = 'rgba(255,248,230,0.28)'; c.lineWidth = 1; c.beginPath(); c.moveTo(6, 2.5); c.lineTo(w - 6, 2.5); c.stroke();
    rrect(c, 6, 6, w - 12, h - 12, 4); c.strokeStyle = 'rgba(20,16,12,0.45)'; c.stroke();
  } else {
    rrect(c, 0, 0, w, h, 5); c.fillStyle = '#5a3b22'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = '#2b1b0d'; c.stroke();
    const g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#2c3230'); g.addColorStop(1, '#1d2220');
    c.fillStyle = g; c.fillRect(6, 6, w - 12, h - 12);
    // old chalk wiped off the slate
    c.strokeStyle = 'rgba(235,230,215,0.04)'; c.lineWidth = 6; c.lineCap = 'round';
    for (const [a, b, e, f] of [[0.12, 0.3, 0.55, 0.42], [0.4, 0.75, 0.85, 0.62], [0.2, 0.86, 0.5, 0.8]]) { c.beginPath(); c.moveTo(a * w, b * h); c.lineTo(e * w, f * h); c.stroke(); }
  }
  const tw = w - 20, groove = (t, x, y, size, col) => { if (carved) ink(c, t, x, y - 1, size, '800', 'rgba(20,14,8,0.75)'); else ink(c, t, x + 0.6, y + 0.6, size, '800', 'rgba(235,230,215,0.25)'); ink(c, t, x, y, size, '800', col); };
  groove(head, w / 2, 18, fitSize(c, head, 14, tw), carved ? '#ffd24a' : '#e8e2d4');
  if (!names.length) { wrapPx(c, empty, tw, 14, '700').slice(0, 2).forEach((t, i) => ink(c, t, w / 2, 46 + i * 18, 14, '700', carved ? '#e2d8c0' : '#a9b0ad')); return; }
  names.forEach((t, i) => groove(clipLine(c, t, tw, 14, '800'), w / 2, 42 + i * 20, 14, carved ? '#fde68a' : i ? 'rgba(232,226,212,0.82)' : '#f5f2ea'));
}
// a torch on its bracket at (x, y), drawn into the menu's layer with its glow; its flame flickers over it each frame (cosmetic: Math.random)
function paintTorch(c, x, y) {
  const r = TUNING.menu.torchR, g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, 'rgba(255,176,80,0.7)'); g.addColorStop(0.35, 'rgba(255,120,40,0.28)'); g.addColorStop(1, 'rgba(255,90,20,0)');
  c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r);
  c.fillStyle = '#2a1a0e'; c.fillRect(x - 2.5, y + 4, 5, 22); c.fillStyle = '#4a3220'; c.fillRect(x - 5, y + 2, 10, 6);
}
// both torches' flames, flickering (cosmetic: Math.random), in three fills: their halo, the flames, their hearts
function menuFlames(ctx, E, xs, y) {
  const t = E.time, F = xs.map((x, i) => {
    const ph = i ? 1 : -1, f = 1 - TUNING.menu.flicker * (0.5 + 0.3 * Math.sin(t * 13 + ph) + 0.2 * Math.sin(t * 7.3 + ph * 2) + 0.25 * (Math.random() - 0.5));
    return { x, f, fh: 24 * f, sw: 2.5 * Math.sin(t * 9 + ph) };
  });
  ctx.fillStyle = `rgba(255,150,60,${0.22 * (F[0].f + F[1].f) / 2})`; ctx.beginPath();
  for (const { x, f, fh } of F) { const r = 13 + 5 * f; ctx.moveTo(x + r, y - fh * 0.45); ctx.arc(x, y - fh * 0.45, r, 0, TAU); }
  ctx.fill();
  const flame = (col, w, h, k) => {
    ctx.fillStyle = col; ctx.beginPath();
    for (const { x, fh, sw } of F) { ctx.moveTo(x - w, y + 3); ctx.quadraticCurveTo(x - w * 1.45, y - fh * h, x + sw * k, y - fh * k); ctx.quadraticCurveTo(x + w * 1.45, y - fh * h, x + w, y + 3); ctx.closePath(); }
    ctx.fill();
  };
  flame('#ff8a2a', 6, 0.4, 1); flame('#ffe08a', 3.5, 0.3, 0.62);
}
// The menu's still layer: the backdrop, the torches' brackets and glow, your fighter's shadow, the title and the fame laurel, the plaques (the Ludus's dot), the two walls and
// Old Brutus with his line
function paintMenu(c, E, o) {
  const { Ly, m, bd, face, fame, champs, wall, labels, dot } = o, M = TUNING.menu, B = Ly.btn;
  paintMenuBack(c, E, bd);
  for (const sd of [-1, 1]) paintTorch(c, Ly.cx + sd * M.torchDx, Ly.ty - 4);
  // your fighter's shadow on the sand
  c.fillStyle = 'rgba(0,0,0,0.4)'; c.beginPath(); c.ellipse(Ly.fig.x, Ly.fig.y + 2, 0.26 * Ly.fig.s, 0.035 * Ly.fig.s, 0, 0, TAU); c.fill();
  menuBlit(c, E, `title|${Ly.ts}|${o.logo ? artV : '-'}`, Ly.cx - Ly.ts * 2, Ly.ty - Ly.ts * 0.8, Ly.ts * 4, Ly.ts * 1.6, (q) => paintTitle(q, Ly.ts, Ly.ts * 4, Ly.ts * 1.6, o.logo));
  const ft = `${fame} fame`;
  c.font = '800 16px system-ui, sans-serif';
  const fw = fame ? c.measureText(ft).width : -12;
  laurel(c, Ly.cx - fw / 2 - 12, Ly.fy, 8);
  if (fame) liftInk(c, ft, Ly.cx + 6, Ly.fy, 16, '800', '#ffd24a');
  for (const k of Object.keys(B)) plaque(c, E, B[k], k === 'play' ? 'bronze' : 'stone', labels[k], false, k === 'play' ? 22 : 16);
  if (dot) {
    const D = TUNING.ludus.dot, b = B.ludus;
    c.fillStyle = '#ffd24a'; c.strokeStyle = '#3a2a08'; c.lineWidth = 2;
    c.beginPath(); c.arc(b.x + b.w - D.inset, b.y + D.inset, D.r, 0, TAU); c.fill(); c.stroke();
  }
  c.font = '800 14px system-ui, sans-serif';
  const C = Ly.champs, P = Ly.pit, head = c.measureText('WALL OF CHAMPIONS').width <= C.w - 20 ? 'WALL OF CHAMPIONS' : 'CHAMPIONS';
  c.save(); c.translate(C.x, C.y); paintWall(c, C.w, C.h, head, champs, 'Fell a champion to be carved here', true); c.restore();
  c.save(); c.translate(P.x, P.y); paintWall(c, P.w, P.h, 'THE PIT WALL', wall, 'No names chalked here yet', false); c.restore();
  const S = Ly.say, fs = face ? M.face : 0, lw = S.w - (fs ? fs + 10 : 0), ls = wrapPx(c, `\u201c${m.say.line}\u201d`, lw, 14, '700').slice(0, 2);
  const my = S.y + Math.min(S.h, fs + 4) / 2, x0 = S.x + (fs ? fs + 10 : 0);
  if (fs) drawPic(c, E, m.say.pic, TUNING.art.crop, S.x, my - fs / 2, fs, fs);
  ls.forEach((t, i) => liftInk(c, t, fs ? x0 : x0 + lw / 2, my + (i - (ls.length - 1) / 2) * 18, 14, '700', '#fde68a', fs ? 'left' : 'center'));
}
// Your fighter on the sand, feet at (x, y), s px per body unit: the painted doll, a cloak swaying behind and the weapon held up; nothing until the
// doll's paint is in (the drawn blocks once it has failed, or with the kit off); the weapon stays in the still hand. The doll is copied at whole device pixels, the cheapest copy there is,
// in two pieces cut at the hips: the body above rises and falls a few pixels as he breathes, its lower rows covering the seam. d: the target's pixel
// ratio; box: only what lies in it is drawn (the cloak always does).
function menuFigure(ctx, E, m, x, y, s, d = E.dpr || 1, box = null) {
  const M = TUNING.menu, t = E.time, pose = heroPose(m.me.weapon), sp = kitOn() && canSprite ? kitIconSprite(E, m.parts, s, m.me.str, m.gm, pose) : null;
  if (!sp) { armourIcon(ctx, E, m.parts, x, y, s, m.me.str, m.gm); return; }
  const k = Math.min(E.dpr || 1, TUNING.skin.maxDpr), cv = sp.cv, amp = Math.max(1, Math.round(M.breath[0] * s * k));
  const lift = Math.round(amp * (0.5 + 0.5 * Math.sin(t * M.breath[1]))), up = lift / k, sw = M.sway[0] * Math.sin(t * M.sway[1]);
  const X = Math.round((x + sp.x) * d) / d, Y = Math.round((y + sp.y) * d) / d, cut = clamp(Math.round((M.hips * s - sp.y) * k), 1, cv.height - 1);
  ctx.save(); ctx.translate(x, y - up);
  ctx.fillStyle = M.cloak; ctx.strokeStyle = '#3a0f0d'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(0.05 * s, -0.75 * s); ctx.quadraticCurveTo(-0.08 * s, -0.8 * s, -0.17 * s, -0.71 * s);
  ctx.quadraticCurveTo((-0.26 + sw * 0.5) * s, -0.42 * s, (-0.31 + sw) * s, -0.12 * s + up);
  ctx.quadraticCurveTo((-0.17 + sw) * s, -0.06 * s + up, (-0.04 + sw * 0.6) * s, -0.13 * s + up);
  ctx.lineTo(0.02 * s, -0.5 * s); ctx.closePath(); ctx.fill();
  ctx.moveTo(-0.12 * s, -0.68 * s); ctx.quadraticCurveTo((-0.2 + sw * 0.4) * s, -0.4 * s, (-0.2 + sw * 0.8) * s, -0.12 * s + up); ctx.stroke();
  ctx.restore();
  const ext = Math.min(cv.height - cut, amp + 2);
  // a piece of the doll (source rows sy to sy + sh at dy), only as much of it as lies in the box
  const piece = (sy, sh, dy) => {
    let x0 = 0, y0 = sy, x1 = cv.width, y1 = sy + sh;
    if (box) {
      x0 = Math.max(x0, Math.floor(box.x * k - X * k)); x1 = Math.min(x1, Math.ceil((box.x + box.w) * k - X * k));
      y0 = Math.max(y0, sy + Math.floor(box.y * k - dy * k)); y1 = Math.min(y1, sy + Math.ceil((box.y + box.h) * k - dy * k));
      if (x1 <= x0 || y1 <= y0) return;
    }
    ctx.drawImage(cv, x0, y0, x1 - x0, y1 - y0, X + x0 / k, dy + (y0 - sy) / k, (x1 - x0) / k, (y1 - y0) / k);
  };
  piece(0, cut + ext, Y - up); piece(cut, cv.height - cut, Y + cut / k);
  if (!m.weapon) return;
  if (box) { ctx.save(); ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip(); }
  // the hero pose's raised fist (it rises with the breath), the weapon leaning back from upright by the pose's lean
  const hx = x + pose.near.F[0] * s, hy = y + pose.near.F[1] * s - up;
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(Math.PI - pose.weapon[2]); ctx.translate(0, -ARM_LEN * s);
  drawWeapon(ctx, m.weapon, s); ctx.restore();
  // (step 14: the doll's fist is copied again over the grip, so it closes on it)
  ctx.save(); ctx.beginPath(); ctx.arc(hx, hy, TUNING.kit.weapon.fist * s, 0, TAU); ctx.clip(); piece(0, cut + ext, Y - up); piece(cut, cv.height - cut, Y + cut / k); ctx.restore();
  if (box) ctx.restore();
}
// the menu's look of your fighter: their rolls, plates and weapon (fists hold nothing)
function menuLook(E) {
  const f = menuFighter(E), me = f.me, W = TUNING.weapons.find((q) => q.id === me.weapon) || (TUNING.me.weapons[me.weapon] && TUNING.me.weapons[me.weapon].len ? { id: me.weapon, ...TUNING.me.weapons[me.weapon] } : null);
  return { ...f, parts: playerParts(me), gm: (GTYPE[me.weapon] || GTYPE.gladius).helm, weapon: W && { weapon: W, mace: !!me.mace }, say: menuBrutus(E) };
}
// The low crowd under the menu: a looping swell of filtered brown noise, its gain re-armed every half second so it dies away by itself when the menu
// stops drawing (a hidden tab), cut on leaving or muting (cosmetic: Math.random)
const MURMUR = { src: null, g: null, next: 0 };
function murmur(E, on) {
  const A = E.audio.ctx, M = TUNING.menu;
  if (!A) return;
  const now = A.currentTime;
  if (on && !E.audio.muted) {
    if (!MURMUR.src) {
      const n = Math.floor(A.sampleRate * M.murmurLoop), buf = A.createBuffer(1, n, A.sampleRate), d = buf.getChannelData(0), edge = A.sampleRate * 0.05;
      let br = 0;
      for (let i = 0; i < n; i++) {
        br = (br + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        d[i] = br * 3.5 * (0.65 + 0.35 * Math.sin(i / n * TAU * M.swells)) * Math.min(1, i / edge, (n - i) / edge);
      }
      const src = A.createBufferSource(), lp = A.createBiquadFilter(), g = A.createGain();
      src.buffer = buf; src.loop = true; lp.type = 'lowpass'; lp.frequency.value = M.murmurHz; g.gain.value = 0;
      src.connect(lp).connect(g).connect(A.destination); src.start();
      Object.assign(MURMUR, { src, g, next: 0 });
    }
    if (now >= MURMUR.next) {
      const g = MURMUR.g.gain;
      g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(M.murmur, now + 0.5); g.setValueAtTime(M.murmur, now + 1.2); g.linearRampToValueAtTime(0, now + 2);
      MURMUR.next = now + 0.5;
    }
  } else if (MURMUR.src) {
    const g = MURMUR.g.gain;
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(0, now + 0.3);
    MURMUR.src.stop(now + 0.35); MURMUR.src = null;
  }
}
// what moves on the menu, drawn whole: the dust on the open sand, the flames, your fighter
function menuMoving(c, E, o, dust, d) {
  const { Ly } = o, M = TUNING.menu, off = dustOff(Ly);
  c.fillStyle = 'rgba(232,204,150,0.35)'; c.beginPath();
  for (const q of dust) { const r = moteBox(E, q); q.at = off.some((b) => hitsBox(r, b)) ? null : r; if (q.at) { c.moveTo(r.cx + q.r, r.cy); c.arc(r.cx, r.cy, q.r, 0, TAU); } }
  c.fill();
  menuFlames(c, E, [Ly.cx - M.torchDx, Ly.cx + M.torchDx], Ly.ty - 4);
  menuFigure(c, E, o.m, Ly.fig.x, Ly.fig.y, Ly.fig.s, d);
}
// where no dust is drawn: in front of your fighter, the plaques, the walls and Brutus's line
const dustOff = (Ly) => [figBox(Ly), ...Object.values(Ly.btn), Ly.champs, Ly.pit, Ly.say];
// the boxes the menu repaints: what moves of your fighter (his cloak and the body above his hips; TUNING.menu.figBox, body units), each torch's
// flame, a mote of dust
const figBox = (Ly) => { const { x, y, s } = Ly.fig, B = TUNING.menu.figBox; return { x: x + B[0] * s, y: y + B[1] * s, w: (B[2] - B[0]) * s, h: (B[3] - B[1]) * s }; };
const flameBox = (Ly, sd) => ({ x: Ly.cx + sd * TUNING.menu.torchDx - 22, y: Ly.ty - 4 - 40, w: 44, h: 50 });
const moteBox = (E, q) => { const cx = q.x * E.w, cy = q.y * E.h; return { cx, cy, x: cx - q.r - 1, y: cy - q.r - 1, w: 2 * q.r + 2, h: 2 * q.r + 2 }; };
const hitsBox = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
// The menu as one screen-sized layer, copied to the screen each frame at whole pixels (the cheapest copy there is). Its still parts are painted once
// (S); the boxes that move (your fighter, the flames, the dust) are put back from S and repainted together at TUNING.menu.fps, not every frame.
const MENU_L = { key: null, S: null, L: null, tf: 0 };
function menuLayer(ctx, E, key, o, dust) {
  const k = Math.min(E.dpr || 1, TUNING.skin.maxDpr), W = Math.ceil(E.w * k), H = Math.ceil(E.h * k), Z = MENU_L, M = TUNING.menu, full = `${key}|${k}`;
  const back = (c, r) => { const x = Math.max(0, Math.floor(r.x * k)), y = Math.max(0, Math.floor(r.y * k)), w = Math.min(W, Math.ceil((r.x + r.w) * k)) - x, h = Math.min(H, Math.ceil((r.y + r.h) * k)) - y; if (w > 0 && h > 0) c.drawImage(Z.S, x, y, w, h, x / k, y / k, w / k, h / k); };
  if (Z.key !== full) {
    if (!Z.S || Z.S.width !== W || Z.S.height !== H) { Z.S = new OffscreenCanvas(W, H); Z.L = new OffscreenCanvas(W, H); }
    const c = Z.S.getContext('2d', { alpha: false }), l = Z.L.getContext('2d', { alpha: false });
    c.setTransform(k, 0, 0, k, 0, 0); paintMenu(c, E, o);
    l.setTransform(1, 0, 0, 1, 0, 0); l.drawImage(Z.S, 0, 0); l.setTransform(k, 0, 0, k, 0, 0);
    menuMoving(l, E, o, dust, k);
    Object.assign(Z, { key: full, tf: E.time });
  } else {
    const l = Z.L.getContext('2d', { alpha: false }), Ly = o.Ly;
    if (E.time - Z.tf >= 1 / M.fps) {
      const F = figBox(Ly);
      back(l, F); menuFigure(l, E, o.m, Ly.fig.x, Ly.fig.y, Ly.fig.s, k, F);
      for (const sd of [-1, 1]) back(l, flameBox(Ly, sd));
      menuFlames(l, E, [Ly.cx - M.torchDx, Ly.cx + M.torchDx], Ly.ty - 4);
      for (const q of dust) if (q.at) back(l, q.at);
      l.fillStyle = 'rgba(232,204,150,0.35)'; l.beginPath();
      const off = dustOff(Ly);
      for (const q of dust) { const r = moteBox(E, q); q.at = off.some((b) => hitsBox(r, b)) ? null : r; if (q.at) { l.moveTo(r.cx + q.r, r.cy); l.arc(r.cx, r.cy, q.r, 0, TAU); } }
      l.fill();
      Z.tf = E.time;
    }
  }
  ctx.drawImage(Z.L, 0, 0, W / k, H / k);
}
// a line over the painted backdrop, lifted off it by a dark copy under it
function liftInk(c, t, x, y, size, weight, color, align = 'center') { ink(c, t, x + 1, y + 1.5, size, weight, 'rgba(8,5,4,0.8)', align); ink(c, t, x, y, size, weight, color, align); }
const MENU_KEYS = ['play', 'new', 'ludus', 'story', 'sound', 'train', 'champs'];
export const menu = {
  enter(E) {
    this.btns = {}; this.press = null;
    // a v6 save's won runs are only in the ledger, which migrate cannot read: checked once here, a won run opens the City
    if (E.save.get('arenasCheck', 0)) {
      if (E.ledger.entries.some((e) => e.k === 'result' && e.d && e.d.won === true)) E.save.set('arenas', Math.max(1, E.save.get('arenas', 0)));
      E.save.set('arenasCheck', 0);
    }
    if (E.save.get('fameCheck', 0)) fameFromLedger(E);
    this.look = menuLook(E);
    if (BOOT.t0 < 0) BOOT.t0 = E.time;
    const M = TUNING.menu;
    this.dust = Array.from({ length: M.dust }, () => ({ x: Math.random(), y: 0.55 + Math.random() * 0.45, v: M.dustV[0] + Math.random() * (M.dustV[1] - M.dustV[0]), r: 0.8 + Math.random() * 1.4, ph: Math.random() * TAU }));
  },
  exit(E) { murmur(E, false); },
  update(dt, E) {
    if (!BOOT.done && !bootStep(E, menuArt(this.look), dt)) return;
    murmur(E, !portrait(E));
    for (const d of this.dust) { d.x += d.v * dt / E.w; d.y += Math.sin(E.time * 0.7 + d.ph) * 2 * dt / E.h; if (d.x > 1.02) { d.x = -0.02; d.y = 0.55 + Math.random() * 0.45; } }
  },
  render(ctx, E) {
    this.btns = {};
    if (portrait(E)) { rotateCard(ctx, E); return; }
    if (!BOOT.done) { this.bootCard(ctx, E); gateUp(ctx, E); return; }
    const run = E.save.get('run', null), M = TUNING.menu, Ly = menuLay(E, run), m = this.look, B = Ly.btn, bd = artImg(BACKDROP[m.arena]), face = !!artImg(m.say.pic), logo = artImg('logo-arena');
    const fame = E.save.get('fame', 0), champs = E.save.get('champs', []).slice(0, M.names).map((q) => q.name), wall = E.save.get('wall', []).slice(0, M.names).map((q) => `${q.name} (${q.bout})`);
    const labels = { play: run ? `Resume: ${(ARENA[run.arena] || ARENAS[0]).short}, bout ${run.rack + 1}` : 'Play', new: 'New run', ludus: 'The Ludus', story: 'Story', sound: E.audio.muted ? 'Sound: off' : 'Sound: on', train: 'Training' };
    const dot = ludusBuys(E), key = `menu|${E.w}|${E.h}|${m.arena}|${bd ? artV : '-'}|${face ? artV : '-'}|${logo ? artV : '-'}|${Object.keys(B).map((k) => labels[k]).join('|')}|${fame}|${dot ? 1 : 0}|${champs.join(',')}|${wall.join(',')}|${m.say.line}`;
    const o = { Ly, m, bd, face, logo, fame, champs, wall, labels, dot };
    if (canSprite) menuLayer(ctx, E, key, o, this.dust);
    else { paintMenu(ctx, E, o); menuMoving(ctx, E, o, this.dust, E.dpr || 1); }
    if (this.press && this.press !== 'champs') plaque(ctx, E, B[this.press], this.press === 'play' ? 'bronze' : 'stone', labels[this.press], true, this.press === 'play' ? 22 : 16);
    this.btns = { ...B, champs: Ly.champs };
    gateUp(ctx, E);
  },
  // the boot card: the dark sand, then (after TUNING.load.show) the bronze title and a thin bronze bar filling as the menu's paintings land
  bootCard(ctx, E) {
    menuBlit(ctx, E, `boot|${E.w}|${E.h}`, 0, 0, E.w, E.h, (c) => paintBootBack(c, E));
    if (E.time - BOOT.t0 < TUNING.load.show) return;
    const ts = Math.round(clamp(E.h * TUNING.menu.title[2], TUNING.menu.title[0], TUNING.menu.title[1])), cy = E.h / 2 - 12, [bw, bh] = TUNING.load.bar;
    const lg = artImg('logo-arena');
    menuBlit(ctx, E, `title|${ts}|${lg ? artV : '-'}`, E.w / 2 - ts * 2, cy - ts * 0.8, ts * 4, ts * 1.6, (c) => paintTitle(c, ts, ts * 4, ts * 1.6, lg));
    const x = E.w / 2 - bw / 2, y = cy + ts * 0.7;
    ctx.fillStyle = 'rgba(120,80,30,0.45)'; ctx.fillRect(x - 1, y - 1, bw + 2, bh + 2);
    const g = ctx.createLinearGradient(0, y, 0, y + bh); g.addColorStop(0, '#f2c477'); g.addColorStop(1, '#8a5a1c');
    ctx.fillStyle = g; ctx.fillRect(x, y, bw * clamp(BOOT.bar, 0, 1), bh);
  },
  onPointerDown(p, E) { this.press = !BOOT.done ? null : MENU_KEYS.find((k) => this.btns[k] && E.hit(this.btns[k], p)) || null; },
  onPointerUp() { this.press = null; },
  onTap(p, E) {
    if (!BOOT.done || portrait(E)) return;
    const b = this.btns, run = E.save.get('run', null), fresh = () => E.setScene('arenas');
    if (b.play && E.hit(b.play, p)) { E.audio.play('tap'); if (run) E.setScene('play', { resume: run }); else fresh(); }
    else if (b.new && E.hit(b.new, p)) { E.audio.play('tap'); E.save.set('run', null); fresh(); }
    else if (b.story && E.hit(b.story, p)) { E.audio.play('tap'); E.setScene('story', { replay: true }); }
    else if (b.ludus && E.hit(b.ludus, p)) { E.audio.play('tap'); E.setScene('ludus'); }
    else if (b.champs && E.hit(b.champs, p)) { E.audio.play('tap'); E.setScene('champs'); }
    else if (b.sound && E.hit(b.sound, p)) { E.audio.toggleMute(); E.audio.play('tap'); }
    else if (b.train && E.hit(b.train, p)) { E.audio.play('tap'); E.setScene('play', { drill: true, seed: TUNING.menu.seed }); }
  },
};

// ----- the story (step 17) -----
// Old Brutus's five cards, as Launch's cold open: each a short scene drawn as a pure function of its time t from the art that ships (so a tap can jump
// to its end), its line fading in on a panel under it. A tap in a scene jumps to its end and the next goes on; a card goes on by itself
// TUNING.story.autoGap s after its scene; Skip ends it, and the gate rises on the menu. A fresh save opens on it once (storySeen, set as it opens);
// the menu's Story button replays it. Its sounds are the clang, the wheels' tick and the chimes, each fired as the clock passes its beat.
const beat = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
// a fixed pseudo-random 0 to 1 for particle i (cosmetic), so a burst is the same at every t
const h01 = (i, k = 0) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
// the story's fighter: the menu's (their body, size and name) in a murmillo's kit with a gladius, bare and then plated by TUNING.story.kit; bowed, or
// in the menu's hero pose with no shield
function storyLook(E) {
  const f = menuFighter(E), Y = TUNING.story, B = Y.bowed, W = TUNING.weapons.find((q) => q.id === 'gladius');
  const me = f.me.idx ? f.me : rollMe(TUNING.menu.seed);
  return {
    me, gm: GTYPE.gladius.helm, weapon: { weapon: W, mace: false },
    parts: Y.kit.map((ids) => PARTS.map((d) => mkPart(d, ids.includes(d.id)))),
    bowed: { legs: LEGS, chin: B.chin, shield: 0, id: 'bowed', near: heroArm('armF', B.near[0], B.near[1]), farArm: heroArm('armB', B.far[0], B.far[1]) },
    hero: { ...heroPose('gladius'), shield: 0, id: 'bare-hero' },
  };
}
// what the story draws, which the boot card waits for (with the menu's own, so the menu after it is ready too)
function storyArt(E, S) {
  const D = dollArt(S.parts[3], S.me.str, S.gm);
  return [...new Set([...TUNING.story.back.map((k) => BACKDROP[k]), 'brutus', 'brutus-proud', `champ-${TUNING.story.champ}`, ...D.body, ...D.extra,
    weaponArt('gladius'), ...menuArt(menuLook(E))])];
}
// the fighter at (x, y), s px a unit: the painted doll (the drawn one until it loads) tilted about the feet by rot, squashed by sx and sy, faded by
// alpha; with weapon (rad) the gladius in the near fist at that angle, the fist copied again over its grip
function storyFig(ctx, E, S, parts, pose, x, y, s, o = {}) {
  const sp = kitOn() && canSprite ? kitIconSprite(E, parts, s, S.me.str, S.gm, pose) : null;
  ctx.save(); ctx.globalAlpha *= o.alpha ?? 1; ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot); ctx.scale(o.sx ?? 1, o.sy ?? 1);
  if (!sp) { armourIcon(ctx, E, parts, 0, 0, s, S.me.str, S.gm); ctx.restore(); return; }
  ctx.drawImage(sp.cv, sp.x, sp.y, sp.w, sp.h);
  if (o.weapon != null) {
    const fx = pose.near.F[0] * s, fy = pose.near.F[1] * s;
    storyBlade(ctx, S, fx, fy, o.weapon, s);
    ctx.save(); ctx.beginPath(); ctx.arc(fx, fy, TUNING.kit.weapon.fist * s, 0, TAU); ctx.clip(); ctx.drawImage(sp.cv, sp.x, sp.y, sp.w, sp.h); ctx.restore();
  }
  ctx.restore();
}
function storyBlade(ctx, S, fx, fy, a, s) { ctx.save(); ctx.translate(fx, fy); ctx.rotate(a); ctx.translate(0, -ARM_LEN * s); drawWeapon(ctx, S.weapon, s); ctx.restore(); }
// one piece of kit alone in the fighter's frame, as kitIcon wears it (k: 0 the helmet, 1 the plate, 2 the greaves, 3 the gladius)
function storyPiece(ctx, S, k, s, pose) {
  const K = TUNING.kit, t = kitTier(S.me.str);
  if (k === 0) {
    const kh = helmArt(KIT_HELM[S.gm] || 'gallic'), hx = PARTS[pidx('head')].x * s, len = (K.chin - K.top) * s;
    if (kh) drawSeg(ctx, kh, [hx - Math.sin(pose.chin) * len, K.chin * s - Math.cos(pose.chin) * len], [hx, K.chin * s], 0);
  } else if (k === 1) {
    const PL = gearPic('plate'), T = kitPic('torso', t), B = PARTS[pidx('belly')];
    if (PL && T) torsoPlate(ctx, PL, s, B.w * s * T.J.k, 'both', (B.y + B.h / 2) * s);
  } else if (k === 2) {
    const G = gearPic('greave'), P = (q) => [q[0] * s, q[1] * s];
    if (G) for (const [, knee, ank] of pose.legs) drawSeg(ctx, G, P(lerp2(knee, ank, G.J.from)), P(lerp2(knee, ank, G.J.to)), K.leg * s);
  } else storyBlade(ctx, S, pose.near.F[0] * s, pose.near.F[1] * s, TUNING.story.hang, s);
}
// a burst of n sparks from (x, y) out to R px over u (0 to 1), falling as they fade
function storySparks(ctx, x, y, u, n, R, col, up = 1) {
  if (u <= 0 || u >= 1) return;
  ctx.save(); ctx.globalAlpha *= 1 - u; ctx.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * (up ? h01(i, 1) : 2 * h01(i, 1)), d = R * ease.outCubic(u) * (0.45 + 0.55 * h01(i, 2)), z = 1.5 + 1.5 * h01(i, 3);
    ctx.fillRect(x + Math.cos(a) * d - z, y + Math.sin(a) * d + R * 0.6 * u * u - z, 2 * z, 2 * z);
  }
  ctx.restore();
}
// a puff of dust on the sand at (x, y), r px, over u
function storyPuff(ctx, x, y, u, r, col = '232,204,150') {
  if (u <= 0 || u >= 1) return;
  ctx.fillStyle = `rgba(${col},${0.45 * (1 - u)})`; ctx.beginPath();
  for (let i = 0; i < 5; i++) { const dx = (i - 2) * r * 0.5 * (0.6 + u), rr = r * (0.35 + 0.5 * u) * (0.7 + 0.3 * h01(i, 5)); ctx.moveTo(x + dx + rr, y - rr * 0.6 - u * r * 0.4); ctx.arc(x + dx, y - rr * 0.6 - u * r * 0.4, rr, 0, TAU); }
  ctx.fill();
}
// The portcullis, its bottom edge at y: iron bars on a grid, spiked at their feet
function drawGate(ctx, E, y) {
  if (y <= 0) return;
  const sp = 46, n = Math.ceil(E.w / sp) + 1, x0 = (E.w - (n - 1) * sp) / 2, top = y - E.h - 30;
  ctx.save();
  ctx.fillStyle = 'rgba(8,6,6,0.35)'; ctx.fillRect(0, top, E.w, y - top);
  for (let yy = y - 34; yy > top; yy -= 72) {
    const g = ctx.createLinearGradient(0, yy - 6, 0, yy + 6); g.addColorStop(0, '#6b6258'); g.addColorStop(1, '#2a2622');
    ctx.fillStyle = g; ctx.fillRect(0, yy - 6, E.w, 12); ctx.fillStyle = '#16120f'; ctx.fillRect(0, yy + 5, E.w, 2);
  }
  for (let i = 0; i < n; i++) {
    const x = x0 + i * sp, g = ctx.createLinearGradient(x - 6, 0, x + 6, 0);
    g.addColorStop(0, '#2a2622'); g.addColorStop(0.4, '#7a6f62'); g.addColorStop(1, '#1e1b18');
    ctx.fillStyle = g; ctx.fillRect(x - 6, top, 12, y - top - 14);
    ctx.beginPath(); ctx.moveTo(x - 6, y - 14); ctx.lineTo(x + 6, y - 14); ctx.lineTo(x, y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#120f0c'; ctx.lineWidth = 1; ctx.stroke();
  }
  ctx.restore();
}
// the gate rising on the menu after the story (GATE.at: when it began)
const GATE = { at: -1 };
function gateUp(ctx, E) {
  if (GATE.at < 0) return;
  const k = (E.time - GATE.at) / TUNING.story.gate;
  if (k >= 1) { GATE.at = -1; return; }
  drawGate(ctx, E, E.h * (1 - ease.inOut(k)));
}

// 1. The Pit: a bare fighter, head bowed, is shoved stumbling onto the sand; Brutus's face slides in, unimpressed (a slow shake of the head).
function sceneShove(g) {
  const { ctx, E, t, L, S } = g, s = L.s, xF = L.l + L.aw * 0.36, p = ease.outCubic(beat(t, 0.05, 0.85)), x = lerp(L.l - s * 0.8, xF, p);
  const st = beat(t, 0.05, 1.15), hop = Math.abs(Math.sin(st * Math.PI * 3)) * (1 - st) * s * 0.06;
  const rot = 0.34 * (1 - ease.inOut(beat(t, 0.3, 1.4))) + 0.04 * Math.sin(t * 13) * (1 - beat(t, 0.5, 1.3));
  storyPuff(ctx, L.l + 10, L.floor, beat(t, 0, 0.7), s * 0.16);
  for (const k of [0.4, 0.62, 0.85]) storyPuff(ctx, lerp(L.l - s * 0.8, xF, ease.outCubic(beat(k, 0.05, 0.85))) + s * 0.1, L.floor, beat(t, k, k + 0.6), s * 0.1);
  storyFig(ctx, E, S, S.parts[0], S.bowed, x, L.floor - hop, s, { rot });
  const no = t > 1.9 ? Math.sin((t - 1.9) * 9) * 6 * (1 - beat(t, 1.9, 2.8)) : 0, bx = lerp(E.w + 12, L.pic.x, ease.outBack(beat(t, 1.0, 1.5))) + no;
  drawPic(ctx, E, 'brutus', [0, 0, 1, 1], bx, L.pic.y, L.pic.w, L.pic.h);
}
// 2. Brutus, proud: kit drops onto the fighter piece by piece (helmet, plate, greaves, a gladius), each with a clang and sparks; he straightens up
// into the menu's hero pose.
const KIT_AT = [[0.03, -0.85], [0, -0.55], [0.1, -0.12]];
function sceneKit(g) {
  const { ctx, E, t, L, S } = g, s = L.s, x = L.l + L.aw * 0.36, y = L.floor, D = TUNING.story.drops, n = D.filter((d) => t >= d).length, fall = 0.35;
  const q = n ? t - D[n - 1] : 9, sq = q < 0.22 ? 0.04 * Math.sin(q / 0.22 * Math.PI) : 0, up = ease.inOut(beat(t, 2.6, 3.0));
  drawPic(ctx, E, 'brutus-proud', [0, 0, 1, 1], L.pic.x + (1 - ease.outCubic(beat(t, 0, 0.45))) * 40, L.pic.y, L.pic.w, L.pic.h);
  if (up < 1) storyFig(ctx, E, S, S.parts[Math.min(n, 3)], S.bowed, x, y, s, { sx: 1 + sq * 0.5, sy: 1 - sq, alpha: 1 - up, weapon: n >= 4 ? TUNING.story.hang : null });
  if (up > 0) storyFig(ctx, E, S, S.parts[3], S.hero, x, y, s, { alpha: up, sy: lerp(0.95, 1, up), weapon: Math.PI - S.hero.weapon[2] });
  D.forEach((d, k) => {
    const u = beat(t, d - fall, d);
    if (u > 0 && u < 1) { ctx.save(); ctx.translate(x, y - (1 - u * u) * (y + s * 0.3)); storyPiece(ctx, S, k, s, S.bowed); ctx.restore(); }
    const at = k < 3 ? KIT_AT[k] : S.bowed.near.F;
    storySparks(ctx, x + at[0] * s, y + at[1] * s, beat(t, d, d + 0.45), 12, s * 0.32, '#ffd24a');
  });
  const gl = beat(t, 3.0, 3.5);
  if (gl > 0 && gl < 1) {
    const F = S.hero.near.F, fx = x + F[0] * s, fy = y + F[1] * s, r = s * 0.5 * gl, gr = ctx.createRadialGradient(fx, fy, 0, fx, fy, r);
    gr.addColorStop(0, `rgba(255,236,170,${0.6 * (1 - gl)})`); gr.addColorStop(1, 'rgba(255,236,170,0)'); ctx.fillStyle = gr; ctx.fillRect(fx - r, fy - r, 2 * r, 2 * r);
  }
}
// 3. The body wheels spin, tick and stop, one after another, on your fighter's own landings
const STORY_WHEELS = WHEELS.filter((wh) => wh.body);
function storyWheel(S, i, t) {
  const wh = STORY_WHEELS[i], list = wh.list(S.me), w = list.map((e) => e[1]), j = wh.at(S.me), sp = TUNING.me.roll.spin, a = TUNING.story.spin[0] + i * TUNING.story.spin[1];
  return { wh, w, j, a, end: a + sp, rot: (u) => (u > 0 ? spinRot(w, j, u) : 0), u: beat(t, a, a + sp) };
}
function sceneWheels(g) {
  const { ctx, E, t, L, S } = g, n = STORY_WHEELS.length, cw = L.aw / n, r = Math.round(Math.min(L.H * 0.3, cw / 2.5)), cy = L.top + L.H * 0.5;
  ctx.fillStyle = 'rgba(10,8,14,0.5)'; ctx.fillRect(0, 0, E.w, E.h);
  for (let i = 0; i < n; i++) {
    const W = storyWheel(S, i, t), cx = L.l + cw * (i + 0.5), rot = W.rot(W.u), done = t >= W.end, k = ease.outBack(beat(t, i * 0.08, i * 0.08 + 0.3));
    const tick = W.u > 0 && !done && pegsPassed(W.w, W.rot(Math.max(0, W.u - 0.03)), rot) ? -0.5 : 0;
    if (k <= 0) continue;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy);
    drawWheel(ctx, E, W.wh, cx, cy, r, { rot, w: W.w, landed: done ? W.j : -1, pop: done ? ease.outBack(beat(t, W.end, W.end + 0.15)) : 0, flash: done ? 1 - beat(t, W.end, W.end + 0.4) : 0, tick, quiet: true });
    ctx.restore();
  }
}
// the wheels' ticks between two times of the card, as the roll's (one tick a TUNING.me.roll.tickGap at most)
function wheelTicks(E, S, t0, t1, self) {
  for (let i = 0; i < STORY_WHEELS.length; i++) {
    const A = storyWheel(S, i, t0), B = storyWheel(S, i, t1), r0 = A.rot(A.u), r1 = B.rot(B.u);
    if (B.u > 0 && A.u < 1 && pegsPassed(A.w, r0, r1) && E.time - self.lastTick > TUNING.me.roll.tickGap) { self.lastTick = E.time; tickSound(E, Math.abs(r1 - r0) / Math.max(t1 - t0, 1e-3)); }
  }
}
// 4. Five plaques light up one by one along the sand; the fifth flares, and a champion's bust rises behind it
function scenePlaques(g) {
  const { ctx, E, t, L } = g, Y = TUNING.story, pw = Math.round(Math.min(104, L.aw / 5 - 22)), ph = 46, py = L.floor - ph - 4, cw = L.aw / 5;
  const xs = [0, 1, 2, 3, 4].map((i) => L.l + cw * (i + 0.5)), lit = Y.lit.map((a) => beat(t, a, a + 0.25)), fl = beat(t, Y.lit[4], Y.lit[4] + 0.6);
  const bh = Math.round(L.H * 0.6), bw = Math.round(bh * 0.75), rise = ease.outCubic(beat(t, Y.lit[4] + 0.1, Y.lit[4] + 0.8));
  if (fl > 0) {
    const x = xs[4], yy = py + ph / 2, r = pw * (1.4 + 1.4 * ease.outCubic(fl)), gr = ctx.createRadialGradient(x, yy - ph, 0, x, yy - ph, r);
    gr.addColorStop(0, `rgba(255,200,90,${0.55 - 0.25 * fl})`); gr.addColorStop(1, 'rgba(255,160,60,0)'); ctx.fillStyle = gr; ctx.fillRect(x - r, yy - ph - r, 2 * r, 2 * r);
  }
  if (rise > 0) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, E.w, py + 6); ctx.clip();
    drawPic(ctx, E, `champ-${Y.champ}`, [0, 0, 1, 1], xs[4] - bw / 2, py + 6 - (bh + 10) * rise, bw, bh, '#ffd24a');
    ctx.restore();
  }
  xs.forEach((x, i) => {
    const b = { x: x - pw / 2, y: py, w: pw, h: ph }, on = lit[i], last = i === 4;
    if (on > 0) { const gr = ctx.createRadialGradient(x, py + ph / 2, 0, x, py + ph / 2, pw * 0.9); gr.addColorStop(0, `rgba(255,190,90,${0.6 * on})`); gr.addColorStop(1, 'rgba(255,190,90,0)'); ctx.fillStyle = gr; ctx.fillRect(x - pw, py + ph / 2 - pw, 2 * pw, 2 * pw); }
    plaque(ctx, E, b, last && on > 0 ? 'bronze' : 'stone', '', false, 16);
    if (on > 0 && !last) { ctx.strokeStyle = `rgba(255,210,74,${0.85 * on})`; ctx.lineWidth = 2; rrect(ctx, b.x + 1, b.y + 1, b.w - 2, b.h - 2, Math.min(12, ph * 0.26) - 1); ctx.stroke(); }
    if (on < 1) { ctx.fillStyle = `rgba(8,6,10,${0.5 * (1 - on)})`; rrect(ctx, b.x, b.y, b.w, b.h, Math.min(12, ph * 0.26)); ctx.fill(); }
    const col = on > 0.5 ? (last ? '#2a1606' : '#ffd24a') : 'rgba(30,26,22,0.8)', cy = py + ph / 2;
    if (last) { ctx.save(); ctx.globalAlpha *= on > 0.5 ? 1 : 0.3; laurel(ctx, x, cy + 2, 12); ctx.restore(); }
    else { ctx.save(); ctx.translate(x, cy); ctx.rotate(-0.6); ctx.fillStyle = col; ctx.fillRect(-1.5, -13, 3, 19); ctx.fillRect(-6, 5, 12, 3); ctx.fillRect(-1.5, 8, 3, 5); ctx.restore(); }
    if (on > 0 && on < 1) { ctx.strokeStyle = `rgba(255,210,74,${1 - on})`; ctx.lineWidth = 3; rrect(ctx, b.x - 4 * on, b.y - 4 * on, b.w + 8 * on, b.h + 8 * on, 12); ctx.stroke(); }
  });
  storySparks(ctx, xs[4], py, fl, 22, pw * 1.1, '#ffd24a');
}
// 5. Split: a name carved into the stone tablet with chips flying, and the same name scrawled on the chalk board with dust; then the gate drops
function sceneWalls(g) {
  const { ctx, E, t, L, S } = g, w = Math.round(Math.min(L.aw * 0.4, 320)), h = Math.round(Math.min(L.H * 0.5, 150)), y = Math.round(L.top + 24 + (L.H - 24 - h) / 2), gap = 28;
  ctx.fillStyle = 'rgba(10,8,14,0.4)'; ctx.fillRect(0, 0, E.w, E.h);
  const name = S.me.name, xl = lerp(-w - 20, L.cx - gap / 2 - w, ease.outCubic(beat(t, 0, 0.4))), xr = lerp(E.w + 20, L.cx + gap / 2, ease.outCubic(beat(t, 0, 0.4)));
  // one wall's name revealed left to right over u, the tool at its edge throwing chips (stone) or dust (chalk)
  const wall = (x0, carved, a, b) => {
    const u = beat(t, a, b), size = fitSize(ctx, name, 36, w - 40);
    ctx.save(); ctx.translate(x0, y); paintWall(ctx, w, h, '', [], '', carved);
    ctx.font = `800 ${size}px system-ui, sans-serif`;
    const tw = ctx.measureText(name).width, nx = (w - tw) / 2, ny = h / 2, ex = nx + tw * u;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, ex, h); ctx.clip();
    if (carved) { ink(ctx, name, w / 2, ny - 1.5, size, '800', 'rgba(20,14,8,0.8)'); ink(ctx, name, w / 2, ny, size, '800', '#fde68a'); }
    else { ctx.save(); ctx.globalAlpha *= 0.9; ink(ctx, name, w / 2 + 0.8, ny + 0.8, size, '800', 'rgba(235,230,215,0.3)'); ink(ctx, name, w / 2, ny, size, '800', '#f5f2ea'); ctx.restore(); }
    ctx.restore();
    // the tablet's laurel once the name is cut; old tallies of the fallen on the slate
    if (carved && u >= 1) laurel(ctx, w / 2, ny - size * 0.95, 10 * ease.outBack(beat(t, b, b + 0.3)));
    if (!carved) { ctx.strokeStyle = 'rgba(235,230,215,0.18)'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 9; i++) { const tx = 22 + i * 9 + (i > 4 ? 10 : 0); ctx.moveTo(tx, h - 34); ctx.lineTo(tx + 2, h - 16); } ctx.moveTo(14, h - 20); ctx.lineTo(70, h - 30); ctx.stroke(); }
    for (let i = 0; i < 16; i++) {
      const tb = a + (b - a) * i / 16, p = beat(t, tb, tb + 0.5), bx = nx + tw * beat(tb, a, b);
      if (p <= 0 || p >= 1) continue;
      const ang = -Math.PI * (0.15 + 0.7 * h01(i, carved ? 7 : 8)), d = (carved ? 46 : 18) * ease.outCubic(p) * (0.5 + 0.5 * h01(i, 9));
      const px = bx + Math.cos(ang) * d, py = ny - size * 0.2 + Math.sin(ang) * d * (carved ? 1 : 0.3) + (carved ? 60 : 34) * p * p;
      ctx.fillStyle = carved ? `rgba(226,216,192,${1 - p})` : `rgba(240,236,224,${0.6 * (1 - p)})`;
      if (carved) ctx.fillRect(px - 2.5, py - 2.5, 4 + 3 * h01(i, 4), 4 + 3 * h01(i, 6)); else { ctx.beginPath(); ctx.arc(px, py, 2 + 4 * p, 0, TAU); ctx.fill(); }
    }
    if (u > 0 && u < 1) {
      ctx.save(); ctx.translate(ex, ny - size * 0.1);
      if (carved) { ctx.rotate(0.5 + 0.12 * Math.sin(t * 40)); ctx.fillStyle = '#9aa1a8'; ctx.fillRect(-2, -26, 4, 22); ctx.fillStyle = '#6a4a2a'; ctx.fillRect(-3.5, -44, 7, 20); }
      else { ctx.rotate(0.6 + 0.1 * Math.sin(t * 25)); ctx.fillStyle = '#f5f2ea'; ctx.fillRect(-3, -22, 6, 20); }
      ctx.restore();
    }
    ctx.restore();
  };
  wall(xl, true, 0.5, 1.7); wall(xr, false, 1.6, 2.7);
  const drop = beat(t, 3.0, 3.4), bounce = t > 3.4 ? Math.sin((t - 3.4) * 22) * 10 * Math.exp(-(t - 3.4) * 9) : 0;
  if (drop > 0) drawGate(ctx, E, E.h * ease.inQuad(drop) - Math.abs(bounce));
  if (t > 3.4) storyPuff(ctx, L.cx, E.h, beat(t, 3.4, 4), E.w * 0.06);
}
// each card: its scene, and the sounds on its beats (at: s into the card; fn) or between two times of it (run)
const STORY_CARDS = [
  { draw: sceneShove, cues: [] },
  { draw: sceneKit, cues: [...TUNING.story.drops.map((d, k) => [d, (E) => clangSound(E, 0)]), [3.0, (E) => ringSound(E)]] },
  { draw: sceneWheels, cues: STORY_WHEELS.map((_, i) => [TUNING.story.spin[0] + i * TUNING.story.spin[1] + TUNING.me.roll.spin, (E) => landChime(E, i)]), run: wheelTicks },
  { draw: scenePlaques, cues: [...TUNING.story.lit.slice(0, 4).map((a) => [a, (E) => tickSound(E, 0)]), [TUNING.story.lit[4], (E) => ringSound(E)]] },
  { draw: sceneWalls, cues: [...[0, 1, 2, 3, 4, 5, 6].map((i) => [0.55 + i * 0.17, (E) => tickSound(E, 30)]), [3.4, (E) => clangSound(E, 0)]] },
];
export const story = {
  enter(E, p = {}) {
    if (!p.replay) E.save.set('storySeen', 1);
    this.S = storyLook(E); this.art = storyArt(E, this.S); this.i = 0; this.t0 = E.time; this.lt = 0; this.tapT = -9; this.lastTick = -9; this.skip = null; this.on = false;
  },
  dur(i) { return TUNING.story.dur[i]; },
  // the card's clock (held while the boot card waits or the phone is upright)
  begin(E) { this.on = true; this.t0 = E.time; this.lt = 0; landChime(E, 0); },
  advance(E) {
    if (this.i + 1 >= STORY.length) { this.finish(E); return; }
    this.i++; this.begin(E);
  },
  finish(E) { GATE.at = E.time; E.setScene('menu'); },
  update(dt, E) {
    if (!BOOT.done && !bootStep(E, this.art, dt)) return;
    if (portrait(E)) { this.t0 += dt; return; }
    if (!this.on) { this.begin(E); return; }
    const d = this.dur(this.i), t = Math.min(E.time - this.t0, d), c = STORY_CARDS[this.i];
    for (const [at, fn] of c.cues) if (this.lt < at && t >= at) fn(E);
    if (c.run && t > this.lt) c.run(E, this.S, this.lt, t, this);
    this.lt = t;
    if (E.time - this.t0 >= d + TUNING.story.autoGap) this.advance(E);
  },
  lay(E) {
    const sf = E.safe, l = sf.left + 16, r = E.w - sf.right - 16, top = sf.top + 8, capH = 40, capTop = E.h - sf.bottom - 8 - capH, floor = capTop - 6, H = floor - top;
    const ph = Math.round(H * 0.58), pw = Math.round(ph * 0.75);
    return { l, r, aw: r - l, cx: (l + r) / 2, top, capTop, capH, floor, H, s: Math.round(H * 0.62), pic: { x: r - pw - 24, y: top + 52, w: pw, h: ph } };
  },
  render(ctx, E) {
    this.skip = null;
    if (portrait(E)) { rotateCard(ctx, E); return; }
    if (!this.on) { menu.bootCard(ctx, E); return; }
    const Y = TUNING.story, L = this.lay(E), d = this.dur(this.i), t = Math.min(E.time - this.t0, d), bd = artImg(BACKDROP[Y.back[this.i]]);
    menuBlit(ctx, E, `story|${Y.back[this.i]}|${bd ? artV : '-'}`, 0, 0, E.w, E.h, (c) => paintMenuBack(c, E, bd));
    ctx.save(); STORY_CARDS[this.i].draw({ ctx, E, t, L, S: this.S }); ctx.restore();
    const fade = beat(t, 0.5, 1.1), line = STORY[this.i];
    if (fade > 0) {
      const size = fitSize(ctx, line, 20, L.aw - 100), y = L.capTop + (1 - fade) * 6;
      ctx.font = `800 ${size}px system-ui, sans-serif`;
      const tw = ctx.measureText(line).width;
      ctx.save(); ctx.globalAlpha = fade;
      rrect(ctx, L.cx - tw / 2 - 18, y, tw + 36, L.capH, 12); ctx.fillStyle = 'rgba(26,20,32,0.92)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#e6c866'; ctx.stroke();
      ink(ctx, line, L.cx, y + L.capH / 2, size, '800', '#f0e6cc');
      ctx.restore();
    }
    for (let k = 0; k < STORY.length; k++) {
      ctx.globalAlpha = k === this.i ? 1 : 0.4; ctx.fillStyle = k <= this.i ? '#ffd24a' : '#f0e6cc';
      ctx.beginPath(); ctx.arc(L.cx + (k - (STORY.length - 1) / 2) * 18, E.safe.top + 22, k === this.i ? 5 : 4, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (E.time - this.t0 >= d) {
      const k = 1 + 0.15 * Math.sin(E.time * 6), x = L.r - 14, y = L.capTop + L.capH / 2;
      ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.moveTo(x - 7 * k, y - 9 * k); ctx.lineTo(x + 9 * k, y); ctx.lineTo(x - 7 * k, y + 9 * k); ctx.closePath(); ctx.fill();
    }
    const [sw, sh] = Y.skip;
    this.skip = { x: L.r - sw, y: E.safe.top + 8, w: sw, h: sh };
    plaque(ctx, E, this.skip, 'stone', 'Skip', false, 16);
  },
  onTap(p, E) {
    if (portrait(E) || !this.on) return;
    if (this.skip && E.hit(this.skip, p)) { E.audio.play('tap'); this.finish(E); return; }
    if (E.time - this.tapT < TUNING.story.tapGap) return;
    this.tapT = E.time;
    if (E.time - this.t0 < this.dur(this.i)) { this.t0 = E.time - this.dur(this.i); this.lt = this.dur(this.i); return; }
    this.advance(E);
  },
};

// The arena picker, the ladder in order (principle 11: a card is its name, its state drawn, one line of twist and its champion). An open arena: its name
// (with its place), its twist and its champion (your rival in red when one waits); cleared ones are gilded. The next locked arena: its champion's silhouette and
// what opens it. A tap on a locked card says in one line what opens it; in the dev channel a second tap enters it. With a veteran (from the Wall of
// Champions) only the open arenas above the one they cleared can be picked; the rest are dimmed.
export const openTo = (E) => E.save.get('arenas', 0);
function lockLine(i) { return `Fell the ${ARENAS[i - 1].who} champion to open`; }
// Step 13: one arena's card as a sprite: the bronze (open) or stone (shut) plaque of the menu as its frame, the arena's painting cropped inside it, darkened
// at the top and bottom for the words, the champion's bust (your rival's with a rival) standing on it, a gold ring and laurel once cleared. A shut arena
// is desaturated and dimmed. Before a painting has landed the card is the plain one (a flat fill, the drawn champion).
function paintPickCard(c, E, o) {
  const P = TUNING.pick, { a, w, h, open, cleared, shown, bd, face } = o, m = P.m, ix = m + P.rim, iy = m + P.rim, iw = w - 2 * P.rim, ih = h - 2 * P.rim, ir = Math.max(2, Math.min(12, h * 0.26) - 3);
  paintPlaque(c, open ? 'bronze' : 'stone', '', w, h, false, 16, m);
  c.save(); rrect(c, ix, iy, iw, ih, ir); c.clip();
  if (bd) {
    const s = Math.max(iw / bd.width, ih / bd.height);
    c.drawImage(bd, ix + (iw - bd.width * s) * P.focus, iy + ih - bd.height * s, bd.width * s, bd.height * s);
  } else { c.fillStyle = open ? '#2a2016' : '#221a2b'; c.fillRect(ix, iy, iw, ih); }
  const g = c.createLinearGradient(0, iy, 0, iy + ih);
  g.addColorStop(0, `rgba(8,5,4,${P.shade[0]})`); g.addColorStop(P.fade[0], 'rgba(8,5,4,0)'); g.addColorStop(P.fade[1], 'rgba(8,5,4,0)'); g.addColorStop(1, `rgba(8,5,4,${P.shade[1]})`);
  c.fillStyle = g; c.fillRect(ix, iy, iw, ih);
  const cx = m + w / 2, ph = Math.max(40, h - P.top - P.bot), pw = Math.min(ph * 0.75, iw - 10), py = m + P.top;
  if (shown) {
    // a cleared arena's laurel: the painted ring over the portrait (step 16, Pack 26: TUNING.pick.ring), else the drawn one behind it
    const ring = cleared && artImg('laurel-ring'), R = P.ring;
    if (cleared && !ring) laurel(c, cx, py + ph / 2, Math.min(ph * 0.62, iw / 2 - 6));
    if (!face || !drawPic(c, E, face, [0, 0, 1, 1], cx - pw / 2, py, pw, ph, cleared ? '#ffd24a' : '#e6c866')) {
      const fy = py + ph, fh = ph * 0.9;
      silhouette(c, cx + (a.id === 'city' ? 12 : a.id === 'rome' ? 16 : 0), fy, fh, open ? '#6b5a44' : '#3a3242');
      if (a.id === 'city') silhouette(c, cx - 18, fy + 4, fh * 0.85, open ? '#4e4234' : '#2e2836');
      if (a.id === 'rome') lionSilhouette(c, cx - 14, fy, fh * 0.5, open ? '#8a7454' : '#2e2836');
    }
    if (ring) { const k = ph / R[2]; c.drawImage(ring, cx - R[0] * k / 2, py + ph / 2 - R[1] * k / 2, R[0] * k, R[1] * k); }
  }
  if (!open) {
    if (bd) { c.globalCompositeOperation = 'saturation'; c.fillStyle = '#000'; c.fillRect(ix, iy, iw, ih); c.globalCompositeOperation = 'source-over'; }
    c.fillStyle = `rgba(10,8,14,${P.lock})`; c.fillRect(ix, iy, iw, ih);
  }
  c.restore();
  if (cleared) { rrect(c, m + 1.5, m + 1.5, w - 3, h - 3, Math.min(12, h * 0.26)); c.lineWidth = 3; c.strokeStyle = '#ffd24a'; c.stroke(); }
}
export const pickArena = {
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
      const rv = rivals[a.id], shown = open || !!(va && i <= to), P = TUNING.pick, ink0 = open ? (cleared ? '#ffd24a' : '#f0e6cc') : '#b4bcc8';
      const pic = shown ? champPic(rv) || champPic({ champion: true, name: a.champs[0], ck: NEW_CHAMPS[a.champs[0]] ? a.champs[0] : undefined }) : null;
      const bd = artImg(BACKDROP[a.id]), face = pic && artImg(pic) ? pic : null;
      const o = { a, w, h, open, cleared, shown, bd, face };
      menuBlit(ctx, E, `pick|${a.id}|${open ? 1 : 0}|${cleared ? 1 : 0}|${shown ? 1 : 0}|${bd ? artV : '-'}|${face ? `${face}${artV}` : '-'}|${cleared && artImg('laurel-ring') ? artV : '-'}`, x - P.m, y - P.m, w + 2 * P.m, h + 2 * P.m + 2, (c) => paintPickCard(c, E, o));
      // the name carries its place ("The City arena, Pompeii"), wrapped onto up to three lines: one item
      wrapPx(ctx, `${a.name}, ${a.place}`.toUpperCase(), w - 12, 14, '800').slice(0, 3).forEach((t, k) => liftInk(ctx, t, cx, y + 20 + k * 17, 14, '800', ink0));
      if (!shown) padlock(ctx, cx, y + P.top + (h - P.top - P.bot) / 2, '#e6c866');
      // open: the twist (white) and the champion (gold, or your rival in red); locked: what opens it
      const wrap = (t) => wrapPx(ctx, t, w - 16, 14, '700').slice(0, 2);
      const shut = va && i <= to ? (i <= ARENAS.findIndex((q) => q.id === vet.arena) ? `${vet.name.split(' ')[0]} cleared it` : 'Not open') : next ? lockLine(i) : 'Locked';
      const lines = open ? [...wrap(a.twist).map((t) => [t, '#f0e6cc']), ...wrap(rv ? `Rival: ${rv.name.split(/[ ,]/)[0]}` : a.champLabel).map((t) => [t, rv ? '#f87171' : '#fde68a'])]
        : wrapPx(ctx, shut, w - 16, 14, '700').slice(0, 3).map((t) => [t, '#c4b99a']);
      const ly = y + h - 14 - (lines.length - 1) * 18;
      lines.forEach(([t, col], k) => liftInk(ctx, t, cx, ly + k * 18, 14, '700', col));
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
export function laurel(ctx, x, y, r) {
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
// each station's mark, s px tall, centred at (x, y): a weapon rack, the barracks' roof and door, the training post, the shrine's temple, the vault's
// strongbox, the tailor's plume
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
  } else if (id === 'vault') {
    ctx.strokeRect(-u * 0.85, -u * 0.35, u * 1.7, u * 1.2); line(ctx, -u * 0.85, u * 0.05, u * 0.85, u * 0.05);
    ctx.beginPath(); ctx.moveTo(-u * 0.85, -u * 0.35); ctx.quadraticCurveTo(0, -u * 1.0, u * 0.85, -u * 0.35); ctx.stroke();
    ctx.fillRect(-u * 0.16, -u * 0.05, u * 0.32, u * 0.36); ctx.fillStyle = '#2a2016'; ctx.beginPath(); ctx.arc(0, u * 0.1, u * 0.07, 0, TAU); ctx.fill();
  } else {
    for (const k of [-0.5, 0, 0.5]) { ctx.save(); ctx.rotate(k); ctx.beginPath(); ctx.ellipse(0, -u * 0.35, u * 0.22, u * 0.62, 0, 0, TAU); ctx.fillStyle = k ? '#c8372a' : '#efe6cf'; ctx.fill(); ctx.restore(); }
    line(ctx, -u * 0.8, u * 0.85, u * 0.6, u * 0.25); ctx.beginPath(); ctx.arc(u * 0.68, u * 0.2, u * 0.08, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}
// an unlock's mark in a roundel of radius r: its weapon, a fighter's shape, its family's mark, a vault scroll, the cards, her key, or the tailor's colour
function unlockMark(ctx, q, x, y, r, style) {
  const id = q.id;
  ctx.save(); ctx.fillStyle = id === 'trident' || id === 'sica' ? '#d9cfb4' : '#1a1422'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.strokeStyle = '#e6c866'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  if (id === 'trident' && !(kitOn() && artImg(weaponArt('trident')))) {
    // a bold trident glyph (the drawn weapon's prongs are hairlines at this size)
    ctx.save(); ctx.translate(x, y); ctx.rotate(0.55); ctx.strokeStyle = '#2a1d12'; ctx.fillStyle = '#2a1d12'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2.5, r * 0.15);
    line(ctx, 0, r * 0.8, 0, -r * 0.35); line(ctx, -r * 0.4, -r * 0.35, r * 0.4, -r * 0.35);
    for (const k of [-0.4, 0, 0.4]) { line(ctx, k * r, -r * 0.35, k * r, -r * 0.62); ctx.beginPath(); ctx.moveTo(k * r - r * 0.13, -r * 0.55); ctx.lineTo(k * r, -r * 0.82); ctx.lineTo(k * r + r * 0.13, -r * 0.55); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  } else if (id === 'sica' || id === 'trident') {
    // (the trident painted, step 14: its prongs read at this size)
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r - 1, 0, TAU); ctx.clip(); ctx.translate(x, y); ctx.rotate(-0.5);
    weaponIcon(ctx, { weapon: iconWeapon(id) }, -r * 0.55, 0, r * (id === 'trident' ? 1.2 : 3.2)); ctx.restore();
  }
  else if (FAMS[id]) { ctx.save(); ctx.translate(x, y); ctx.fillStyle = ctx.strokeStyle = FAMS[id].col; ctx.lineWidth = 2; famGlyph(ctx, id, r / 8); ctx.restore(); }
  else if (q.station === 'vault') {
    // a rolled scroll, its family's mark on it
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#e8d9b0'; ctx.strokeStyle = '#7a5a2c'; ctx.lineWidth = 1.5;
    rrect(ctx, -r * 0.62, -r * 0.5, r * 1.24, r * 1.0, r * 0.08); ctx.fill(); ctx.stroke();
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * r * 0.64, 0, r * 0.12, r * 0.56, 0, 0, TAU); ctx.fillStyle = '#c9b27a'; ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = ctx.strokeStyle = shade(FAMS[q.fam].col, 0.6); ctx.lineWidth = 2; famGlyph(ctx, q.fam, r / 13); ctx.restore();
  }
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

// Brutus's ludus (E): the courtyard's six stations in a row, each its mark, its name, one line and how much of it you have opened; a station's page,
// its unlocks in two columns, each its mark, its name, one line, and its price (OPEN once bought, or the style you wear); one tap buys one, or steps a
// tailor's look through its styles and off. The training ground's slot opens the cards you have picked before. Principle 11: three text items an element.
export const ludus = {
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
      const wait = !own && q.needs && !L.includes(q.needs), can = fame >= price && !wait;
      const tag = wait ? 'Barracks first' : !own ? `${price} fame` : TAILOR[q.id] ? (st >= 0 ? TAILOR[q.id][st][0] : 'Off') : q.id === 'slot' ? (sp ? CARD[sp].name : 'None') : 'OPEN';
      const tc = !own ? (can ? '#ffd24a' : '#9aa4b2') : TAILOR[q.id] || q.id === 'slot' ? '#c4b5fd' : '#4ade80';
      E.roundRect(r.x, r.y, r.w, r.h, 12, own ? 'rgba(29,42,34,0.94)' : 'rgba(42,32,22,0.94)', own ? '#4ade80' : can ? '#e6c866' : 'rgba(240,230,204,0.3)');
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
    if (q.needs && !L.includes(q.needs)) { E.audio.play('miss'); E.toast(`Open ${FAMS[q.needs].name} in the Barracks first.`); return; }
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
export const champs = {
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

// The roll: one big wheel at a time, in the six wheels' order, with progress pips above it, its odds and what reshaped them beside it, and your fighter's
// card building on the right as each answer lands; then the card with the strip of small wheels (tap a body wheel, then Respin rolls it again with the run's one token) and Buy kit,
// which opens the purse (drawPurse: a weapon and plates by the slot bought with the arena's starting gold, then Fight!). Each wheel: its slices grow and
// shrink from the plain wheel (TUNING.me.roll.shape s, or wait when nothing changed), it spins (a tap spins it at once), a tap snaps it to its landing,
// and the answer holds (a tap moves on). The landings were all decided by rollMe; the wheels only show them.
const isRare = (k, v) => { const R = TUNING.me.rare[k === 0 ? 'size' : ME_WHEEL[k]]; return !!R && R.includes(v); };
export const roll = {
  // a veteran (params.vet, from the Wall of Champions) keeps their rolls: no wheels, no respin, straight to their card
  enter(E, params) {
    const open = ludusOf(E), extra = startPick(E);
    this.seed = params.seed; this.arena = params.arena || 'pit'; this.vet = params.vet || null; this.cardT = 0; this.landT = [];
    this.me = this.vet ? vetMe(this.vet, open, extra) : { ...rollMe(this.seed, open), extra };
    this.btn = this.respinBtn = null; this.token = TUNING.token; this.used = ''; this.sel = -1; this.spin = null; this.prev = null; this.purse = null;
    this.at(this.vet ? WHEELS.length : 0);
  },
  // the purse: the arena's starting gold, your fists and no plates; on the first run (step 23) a kit already chosen (TUNING.purse.first). ask: the
  // "No plates?" card is up; bare: this run chose to fight bare; pulse: when Buy a plate sent you back (a plate slot pulses). Step 22: side, the sidearm
  // bought (a purse weapon id, or none); pick, which of Weapon and Sidearm the rack buys for; knives, how many bought
  openPurse(E) {
    const F = TUNING.purse.first, first = firstRun(E);
    this.purse = { gold: TUNING.purse.gold[this.arena], w: first ? F.w : 'fist', kit: first ? F.kit.slice() : [], dual: false, side: null, pick: 'main', knives: 0, krow: null, t: 0, tiles: [], slots: [], fight: null, first,
      hint: E.save.get('purseHint', 0) < TUNING.purse.hint, ask: null, bare: false, pulse: -1 };
  },
  // wheel k, before its spin: its plain weights (a stat wheel's B tier) and the reshaped ones it spins on
  at(k) {
    Object.assign(this, { i: k, ph: 'shape', t: 0, rot: 0, tick: 0, flash: 0, pop: 0, lastTick: -9 });
    if (k >= WHEELS.length) return;
    this.w1 = WHEELS[k].list(this.me).map((e) => e[1]);
    this.w0 = ME_WHEEL[WHEELS[k].k] === 'stat' ? TUNING.me.statTiers.B.slice() : this.w1.slice();
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
    if (this.purse) { this.purse.t += dt; return; }
    if (this.spin) { this.spin.t += dt; if (this.spin.t >= M.spin) { this.spin = null; this.prev = null; this.sel = -1; E.audio.beep({ freq: 660, dur: 0.1, type: 'triangle', gain: 0.12 }); E.haptic(12); } }
    if (this.i >= WHEELS.length) { this.cardT += dt; return; }
    this.t += dt; this.tick *= Math.exp(-dt * 14); this.flash = Math.max(0, this.flash - dt * 2.5);
    if (this.ph === 'shape') { if (this.t >= (this.shaped ? R.shape : R.wait)) this.go(E); }
    else if (this.ph === 'spin') {
      const u = clamp(this.t / R.spin, 0, 1), r1 = spinRot(this.w1, WHEELS[this.i].at(this.me), u);
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
    const k = this.i, j = WHEELS[k].at(this.me), e = WHEELS[k].list(this.me)[j], L = this.lay(E);
    Object.assign(this, { ph: 'land', t: 0, rot: spinRot(this.w1, j, 1), flash: 1, pop: 0, tick: 0 });
    this.landT[k] = E.time;
    landChime(E, k);
    const [s, en] = sliceArcs(this.w1)[j], a = -Math.PI / 2 + this.rot + (s + en) / 2, px = L.cx + Math.cos(a) * L.r * 0.7, py = L.cy + Math.sin(a) * L.r * 0.7;
    if (isRare(WHEELS[k].k, e[0])) {
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
    this.prev = this.me; this.me = respinMe(this.me, WHEELS[k].k, this.seed); this.spin = { k, t: 0 };
    this.token--; this.used = `respin-${WHEELS[k].title.toLowerCase()}`;
    E.audio.beep({ freq: 520, dur: 0.12, type: 'triangle', slide: 1.4, gain: 0.12 }); E.haptic(12);
  },
  render(ctx, E) {
    if (portrait(E)) { this.btn = this.respinBtn = null; rotateCard(ctx, E); return; }
    const M = TUNING.me, me = this.me;
    if (this.purse) { drawPurse(ctx, E, this.purse, me); return; }
    if (this.i < WHEELS.length) { this.drawWheels(ctx, E); return; }
    const S = this.strip(E), sp = this.spin, k = clamp(this.cardT / 0.25, 0, 1);
    WHEELS.forEach((wh, j) => {
      const cx = S.x0 + S.cw * (j + 0.5), w = wh.list(me).map((e) => e[1]), u = sp && sp.k === j ? clamp(sp.t / M.spin, 0, 1) : 1;
      if (this.sel === j) E.roundRect(cx - S.cw / 2 + 3, S.top, S.cw - 6, S.bottom - S.top, 10, 'rgba(124,58,237,0.35)', '#c4b5fd');
      drawWheel(ctx, E, wh, cx, S.cy, S.r, { rot: wheelRest(w, wh.at(me)) - M.turns * Math.PI * 2 * Math.pow(1 - u, 3), w, landed: u < 1 ? -1 : wh.at(me) });
      E.text(wh.title, cx, S.cy + S.r + 11, { size: 10, weight: '800', color: this.sel === j ? '#ffffff' : '#c4b99a' });
      const e = wh.list(me)[wh.at(me)];
      if (u >= 1) E.text(typeof e[0] === 'number' ? `${e[0]} ${e[2]}` : e[2], cx, S.cy + S.r + 24, { size: 11, weight: '700', color: '#ffd24a' });
    });
    const shown = this.prev || me, w = Math.min(E.w - 32, 480), y = S.bottom + 4, h = Math.min(E.h - E.safe.bottom - y - 6, 290), x = (E.w - w) / 2;
    ctx.globalAlpha = k;
    drawMeCard(ctx, E, shown, x, y + (1 - k) * 30, w, h, TUNING.purse.gold[this.arena]);
    ctx.globalAlpha = 1;
    const by = y + h - 32, pick = this.sel >= 0;
    this.respinBtn = this.vet ? null : tokenButton(E, pick ? `Respin ${WHEELS[this.sel].title.toLowerCase()}` : 'Respin', x + 108, by, this.token, pick && !sp, this.token > 0 && !pick ? '1 left · tap a body wheel' : null);
    this.btn = E.button('Buy kit', x + w - 92, by, { w: 150, h: 48, size: 20, fill: '#b45309' });
  },
  drawWheels(ctx, E) {
    const me = this.me, L = this.lay(E), k = this.i, wh = WHEELS[k], list = wh.list(me), j = wh.at(me), landed = this.ph === 'land', w = this.weights();
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
    const e = list[j], rare = isRare(wh.k, e[0]), ay = L.cy + L.r * 1.1 + 26;
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
    const k = wh.k, st = ME_WHEEL[k] === 'stat' ? statTier(k, this.me.idx) : null, x = L.lx, lw = L.lw, landed = this.ph === 'land';
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
      const e = list[n], ry = y + ri * rh, hit = landed && n === wh.at(this.me), pct = Math.round(w[n] / tot * 100), d = Math.round(this.w1[n] / t1 * 100) - Math.round(this.w0[n] / t0 * 100);
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
      const wh = WHEELS[n], y = L.ky + 34 + rh * (n + 0.5), e = wh.list(me)[wh.at(me)];
      if (n >= done) { E.text(WHEELS[n].title, x + 10, y, { size: 14, weight: '700', align: 'left', color: 'rgba(196,185,154,0.35)' }); continue; }
      const age = this.landT[n] != null ? E.time - this.landT[n] : 9, slide = (1 - clamp(age / 0.2, 0, 1)) * 24, glow = clamp(1 - age / 0.6, 0, 1);
      if (glow > 0) E.roundRect(x + 4, y - rh / 2 + 2, w - 8, rh - 4, 6, `rgba(255,210,74,${0.3 * glow})`, null);
      E.text(WHEELS[n].title, x + 10 + slide, y, { size: 14, weight: '700', align: 'left', color: '#c4b99a' });
      if (ME_WHEEL[wh.k] === 'stat') {
        const seg = Math.min(14, (w - 106) / 5);
        for (let q = 0; q < 5; q++) { ctx.fillStyle = q < e[0] ? '#e6c866' : 'rgba(255,255,255,0.12)'; ctx.fillRect(x + w - 10 - (5 - q) * seg + slide, y - 5, seg - 3, 10); }
      } else {
        const v = n === 0 ? `${e[2]}  ♥${lenN(M.sizes[e[0]].hearts * M.heartsPerBase)}` : e[2];
        E.text(v, x + w - 10 + slide, y, { size: Math.max(14, fitSize(ctx, v, 15, w - 100)), weight: '800', align: 'right', color: isRare(wh.k, e[0]) ? '#ffd24a' : '#f0e6cc' });
      }
    }
  },
  onTap(p, E) {
    if (portrait(E)) return;
    if (this.i < WHEELS.length) {
      if (this.ph === 'shape') this.go(E); else if (this.ph === 'spin') this.land(E); else this.at(this.i + 1);
      return;
    }
    if (this.purse) { this.purseTap(p, E); return; }
    if (this.cardT <= 0.3 || this.spin) return;
    if (this.btn && E.hit(this.btn, p)) { E.audio.play('tap'); this.openPurse(E); return; }
    if (this.respinBtn && this.respinBtn.live && E.hit(this.respinBtn, p)) { this.respin(E); return; }
    const S = this.strip(E);
    if (!this.vet && this.token > 0 && p.y <= S.bottom + 4 && p.x >= S.x0 && p.x < S.x0 + S.cw * S.n) {
      const j = Math.floor((p.x - S.x0) / S.cw);
      if (!WHEELS[j].body) { E.audio.play('miss'); return; }
      this.sel = this.sel === j ? -1 : j; E.audio.play('tap'); E.haptic(6);
    }
  },
  // a weapon from the rack, or a slot's plate (a second tap sells it back), is bought if the purse covers it with the rest; Fight! with what is left
  // the Arms row's second blade (step 18) toggles the same weapon in your off hand, at its price, in place of the shield (never with fists)
  purseTap(p, E) {
    const P = this.purse;
    if (P.t <= TUNING.draft.delay) return;
    if (P.ask) {
      if (P.ask.buy && E.hit(P.ask.buy, p)) { E.audio.play('tap'); P.ask = null; P.pulse = P.t; }
      else if (P.ask.bare && E.hit(P.ask.bare, p)) { P.ask = null; P.bare = true; this.fight(E); }
      return;
    }
    // step 22: the Knives row, one at a time up to the most; the Sidearm slot (and the Weapon slot) say which the rack buys for
    const K = TUNING.knives;
    if (P.krow && (E.hit(P.krow.plus, p) || E.hit(P.krow.minus, p))) {
      const more = E.hit(P.krow.plus, p), n = P.knives + (more ? 1 : -1);
      if (n < 0 || n > K.max || purseOf(P, { knives: n }) > P.gold) { E.audio.play('miss'); return; }
      P.knives = n; E.audio.play(more ? 'coin' : 'tap'); E.haptic(10);
      return;
    }
    const pick = P.slots.find((q) => (q.id === 'side' || q.id === 'weapon') && E.hit(q, p));
    if (pick) { P.pick = pick.id === 'side' && P.pick !== 'side' ? 'side' : 'main'; E.audio.play('tap'); E.haptic(6); return; }
    const tile = P.tiles.find((q) => E.hit(q, p)), two = P.slots.find((q) => q.id === 'dual' && E.hit(q, p)), slot = !two && P.slots.find((q) => q.plate && E.hit(q, p));
    if (tile && P.pick === 'side') {
      const sd = P.side === tile.id ? null : tile.id;
      if (sd && (sd === 'fist' || sd === P.w || purseOf(P, { side: sd }) > P.gold)) { E.audio.play('miss'); return; }
      P.side = sd; E.audio.play(sd ? 'coin' : 'tap'); E.haptic(12);
      return;
    }
    if (tile || slot || two) {
      const w = tile ? tile.id : P.w, dual = w !== 'fist' && (two ? !P.dual : P.dual), side = P.side === w ? null : P.side;
      const kit = (slot ? Object.keys(PLATES).filter((k) => (k === slot.plate ? !P.kit.includes(k) : P.kit.includes(k))) : P.kit).filter((k) => !(dual && k === 'manica'));
      if ((two && w === 'fist') || (slot && noPlate({ ...P, w, dual }, slot.plate)) || purseOf(P, { w, kit, dual, side }) > P.gold) { E.audio.play('miss'); return; }
      P.w = w; P.kit = kit; P.dual = dual; P.side = side; E.audio.play('coin'); E.haptic(12);
      return;
    }
    if (!P.fight || !E.hit(P.fight, p)) return;
    if (!P.bare && purseNudge(P)) { E.audio.play('tap'); P.ask = true; return; }
    this.fight(E);
  },
  fight(E) {
    const P = this.purse, me = { ...kitMe(this.me, P.w, P.kit, P.dual), side: P.side };
    if (P.hint) E.save.set('purseHint', E.save.get('purseHint', 0) + 1);
    E.audio.play('tap');
    E.setScene('play', { seed: this.seed, arena: this.arena, me, token: this.token, tokenUsed: this.used, buy: `${P.w}${P.dual ? 'x2' : ''},${P.kit.join('+') || 'none'}${P.side ? `,side ${P.side}` : ''}${P.knives ? `,knives ${P.knives}` : ''}`,
      gold: P.gold - purseOf(P), knives: P.knives });
  },
};

export function initHand(E) {
  const h = state.hand, L = lay(E);
  const [sx, sy] = toScreen(youF(E), SHOULDER[0], SHOULDER[1]);
  [h.tgx, h.tgy] = guardPt(E);
  h.pang = Math.atan2(h.tgy - sy, h.tgx - sx);
  solveArm(E, 0);
  h.pux = h.ux; h.puy = h.uy; h.phx = h.hx; h.phy = h.hy; state.you.a = 0.05;
  poseYou(E, 0.016);
  poseFoe(E, 0.016);
}

// The bout begins (the intro card's tap): his bleed carried over, the card lab's Momentum, the first bouts' hint
export function beginBout(E) {
  if (yardDue(E)) { startYard(E); return; }
  state.intro = false; state.introGo = -1; state.swingIn = 1.2;
  if (state.carry) { addBleed(E, state.carry); state.carry = 0; }
  if (state.labMom) state.mom = TUNING.mom.max;
  const seen = E.save.get('boutsSeen', 0);
  state.hint = seen < TUNING.hint.bouts && !(firstRun(E) && state.rack === 0); state.boutT0 = state.m; E.save.set('boutsSeen', seen + 1);
  if (lessonDue(E)) startLesson();
}
// No fight starts half painted (step 12): the tap waits, up to TUNING.load.hold, for the bout's paintings (the backdrop, both fighters' paint with
// their worn gear, a beast's, a pair's second foe, Brutus and the champion's portrait on the card)
export function introReady(E) {
  const C = sigOf(state.foe), names = [BACKDROP[arena().id], 'brutus', champPic(state.foe), C && C.sig === 'twin' ? 'emperor' : null, C && C.sig === 'throw' ? weaponArt('dagger') : null].filter(Boolean);
  if (kitOn()) {
    for (const [f, foe] of [[state.foe, true], [state.you, false], [state.edge, true]]) {
      if (!f) continue;
      const A = f.beast ? beastArt(f) : manArt(lookOf(f, foe), kitTier(foe ? f.str : state.me.str));
      names.push(...A.body, ...A.extra);
    }
  }
  return artSettled(names);
}
// "Tap to fight" pulses once the card takes a tap, and dims again while a tap waits for the paint
export const tapLive = () => state.introT > 0.35 && !(state.introGo >= 0);
export const play = {
  enter(E, params) {
    // the menu's Training (step 23): the yard alone, with a stock fighter in the first run's kit against the Pit's sparring partner, saving nothing
    state.drill = !!params.drill; state.train = null;
    if (state.drill) {
      const P = TUNING.purse.first;
      newRound(E, params.seed, kitMe(rollMe(TUNING.menu.seed), P.w, P.kit), null, 'pit', null); newRack(E); initHand(E); startYard(E, true);
      return;
    }
    if (params.resume) resumeRun(E, params.resume); else newRound(E, params.seed, params.me || rollMe(params.seed), undefined, params.arena);
    newRack(E); initHand(E);
    if (state.draft) { state.intro = false; state.fallT = TUNING.resetDelay; state.foe.hp = 0; state.foe.shown = 0; }
    if (params.token != null && !params.resume) { state.token = params.token; state.tokenUsed = params.tokenUsed || ''; }
    if (params.buy && !params.resume) { state.buy = params.buy; state.gold = state.purseLeft = params.gold; state.knives = params.knives || 0; saveRun(E); }
  },
  update(dt, E) {
    if (portrait(E)) return;
    popTop = E.safe.top + 80;
    camUpdate(E, dt);
    if (state.draft) {
      const d = state.draft; d.t += dt;
      if (d.fly && (d.fly.t += dt) >= TUNING.draft.fly) pickCard(E, d.fly.card);
      return;
    }
    if (state.tent) { state.tent.t += dt; return; }
    if (state.caption) { state.caption.t -= dt; if (state.caption.t <= 0) state.caption = null; }
    // the juice's clocks run on real time: the fell's camera, the war paint, the banner, the heart's shatter, and its slow motion
    state.zoomT = Math.max(0, state.zoomT - dt); state.paintT = Math.max(0, state.paintT - dt);
    if (state.banner && (state.banner.t -= dt) <= 0) state.banner = null;
    if (state.shatter && (state.shatter.t -= dt) <= 0) state.shatter = null;
    // your heart shakes as your health falls and pulses as it rises, whatever moved it
    if (state.heartFx && (state.heartFx.t -= dt) <= 0) state.heartFx = null;
    if (state.hpSeen != null && state.hp !== state.hpSeen) { const hit = state.hp < state.hpSeen, t = hit ? TUNING.hud.hit : TUNING.hud.heal; state.heartFx = { kind: hit ? 'hit' : 'heal', t, max: t }; }
    state.hpSeen = state.hp;
    state.readT = Math.max(0, (state.readT || 0) - dt);
    if (state.slowFx > 0) { state.slowFx -= dt; dt *= state.slowMul; }
    // slow time: the open window's brief slow, and the whole of the first feint ever
    if (state.slowT > 0) { state.slowT -= dt; dt *= TUNING.openWin.slow; } else if (state.sw && state.sw.lesson === 'slow') dt *= TUNING.lesson.slow;
    if (state.intro) {
      if (state.introGo >= 0 && (introReady(E) || E.time - state.introGo >= TUNING.load.hold)) { beginBout(E); return; }
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
    if (state.jabGuard > 0 && (state.jabGuard -= dt) <= 0) guardJab(E);
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
    state.flyS = Math.max(0, state.flyS - dt); state.gbreak = Math.max(0, state.gbreak - dt);
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
    updateOff(E, dt);
    stepArms(E, dt);
    if (state.kLesson) updateLesson(E, dt);
    updateFoe(dt, E);
    updatePair(E, dt);
    updateBleed(E, dt);
    updateFinisher(E, dt);
    updateHints(E);
    updateDefence(dt, E);
    checkExhaust(E, dt);
    if (state.train) { updateYard(E, dt); if (E.scene !== this) return; }
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
    E.save.set('runsDone', runsDone(E) + 1);
    E.save.set('run', null); E.save.set('firstRunDone', 1);
    settleFeint('none');
    const best = E.save.get('best2', 0), isNew = state.gapHits > best;
    if (isNew) E.save.set('best2', state.gapHits);
    const g = state.gauntlet, won = state.results.filter((r) => r === 'felled').length >= g.length, reached = Math.min(g.length, state.rack + 1);
    const r = {
      gapHits: state.gapHits,
      slotHits: state.slotHits,
      lunges: state.lunges,
      clangs: state.clangs,
      broken: state.broken,
      overheads: state.overheads,
      jabs: state.jabs,
      slashes: state.slashes,
      blocks: state.blocks,
      perfects: state.perfects,
      dodges: state.dodges,
      staOuts: state.staOuts,
      counters: state.counters,
      counterHits: state.counterHits,
      taken: state.taken,
      felled: state.felled,
      feints: state.feints,
      feintsRead: state.feintsRead,
      switchReads: state.switchReads,
      feintsBit: state.feintsBit,
      feintsNone: state.feintsNone,
      baited: state.baited,
      combos: state.combos,
      windeds: state.windeds,
      punishes: state.punishes,
      bashes: state.bashes,
      bashHits: state.bashHits,
      nets: state.nets,
      netted: state.netted,
      zoneReads: state.zoneReads,
      lungeReads: state.lungeReads,
      turtleReads: state.turtleReads,
      presses: state.presses,
      retreats: state.retreats,
      plateSaves: state.plateSaves,
      momGained: state.momGained,
      momSpent: state.momSpent,
      bleeds: state.bleeds,
      lamings: state.lamings
    };
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
    E.ledger.add('result', {
      ...r,
      won,
      reached,
      halves: state.hp,
      sizes: g.map((d) => d.size.id[0]).join(''),
      profs: g.map((d) => d.prof).join(','),
      weapons: g.map((d) => d.weapon.id).join(','),
      armour: g.map((d) => d.set.id[0]).join(''),
      stats: g.map((d) => `${d.str}${d.spd}${d.sta}`).join(','),
      champ: g[g.length - 1].name,
      lostTo: won ? '' : `${g[reached - 1].name} ${g[reached - 1].size.id} ${g[reached - 1].weapon.id}`,
      moves: Object.entries(state.moveCount).map(([k, v]) => `${k}${v}`).join(','),
      specials: Object.entries(state.specials).map(([k, v]) => `${k}${v[0]}/${v[1]}`).join(','),
      skips: state.skips,
      chains: state.chains,
      meSize: me.size,
      meStats: `${me.str}${me.spd}${me.sta}`,
      meArmour: me.set,
      mePlates: me.plates.join(','),
      meTier: me.tier,
      underdog: me.underdog ? 1 : 0,
      grades: state.grades.join(''),
      goods: state.goods.join(','),
      picks: state.picks.join(','),
      stepsIn: state.stepsIn,
      stepsOut: state.stepsOut,
      wallHits: state.wallHits,
      foeWall: state.foeWall,
      outReach: state.outReach,
      dodged: state.dodged,
      chases: state.chases,
      shrugs: state.shrugs,
      gold: state.gold,
      goldEarned: state.goldEarned,
      bought: state.bought.join(','),
      wares: state.wares.join(','),
      tent: state.tentDone ? 1 : 0,
      fins: state.fins.join(','),
      bleedDmg: state.bleedDmg,
      lab: state.labUsed,
      meWeapon: me.weapon === 'axe' && me.mace ? 'mace' : me.weapon,
      token: state.tokenUsed,
      epicsSeen: state.epicsSeen,
      origin: me.origin,
      reason: me.reason,
      rival: champ.rival ? 1 : 0,
      rivalBeaten: state.rivalBeaten,
      arena: state.arena,
      fav: Math.round(state.fav),
      favAvg: Math.round(thumbFav()),
      thumb: won && state.arena === 'games' ? bandOf(thumbFav()) : -1,
      meName: me.name,
      fame: fame.sum,
      vet: me.vid != null ? 1 : 0,
      myNets: state.netsCast,
      drives: state.drives,
      driveDist: Math.round(state.driveDist * 100) / 100,
      spoils: state.spoils,
      buy: state.buy,
      purseLeft: state.purseLeft,
      knives: state.knivesThrown,
      knifeGaps: state.knifeGaps,
      knifePlate: state.knifePlate,
      knifeSkin: state.knifeSkin,
      knifeMiss: state.knifeMiss,
      swaps: state.mySwaps,
      foeSwaps: state.foeSwaps,
      ...yardFields(),
      arrows: state.arrows,
      arrowGaps: state.arrowGaps,
      arrowSkin: state.arrowSkin,
      arrowPlate: state.arrowPlate,
      arrowMiss: state.arrowMiss,
      bowTime: Math.round(state.bowTime)
    });
    E.setScene('over', { ...r, won, reached, gauntlet: g, me, results: state.results.slice(), best: Math.max(best, state.gapHits), isNew,
      picks: state.picks.slice(), grades: state.grades.slice(), wall, rivalBeaten: state.rivalBeaten, gold: state.gold, goldEarned: state.goldEarned, wares: state.wares.slice(),
      arena: state.arena, fav: state.arena === 'games' ? thumbFav() : state.fav, opened, fame });
  },
  // two thumbs: a touch that starts in the left third is the shield and dodge thumb (buttons only), one that starts on the finisher button is that button
  // alone (it never moves the sword hand), any other is the sword thumb
  onPointerDown(p, E) {
    // a press on a draft card (step 23): held TUNING.draft.long s it shows the card's full line
    const d = state.draft;
    if (d && !d.fly && !d.view && !d.helpOn && d.t > TUNING.draft.delay) { const b = d.btns.find((q) => E.hit(q, p)); d.press = b ? { i: b.i, t0: E.time } : null; }
    if (state.endT > 0 || portrait(E) || state.intro || state.draft || state.tent) return;
    if (p.startX >= E.w / 3 && finTouch(E, p)) return;
    if (p.startX >= E.w / 3 && armsTouch(E, p)) return;
    // a raised knife: the right thumb aims it (the sword hand stays put), and a dragged thumb's release throws it; in the first-knife lesson the
    // sword thumb waits for the knife
    if (state.aim && p.startX >= E.w / 3) { if (state.aim.id < 0) aimDown(E, p); return; }
    // step 24: with the bow out the right thumb draws and aims it (never the sword hand); not while it comes up or goes down
    if (state.bowOut && p.startX >= E.w / 3) { if (state.swapT <= 0) bowDown(E, p); return; }
    if (state.kLesson && p.startX >= E.w / 3) return;
    if (p.startX < E.w / 3) {
      const b = buttonAt(E, p);
      if (b && b.dodge) { dodge(E, p.id); if (state.train) state.train.press = { id: p.id, t0: state.m }; }
      else if (b) raiseShield(E, b.z, p.id);
      return;
    }
    const h = state.hand;
    if (h.down) return;
    h.down = true; h.id = p.id; h.fx = p.x; h.fy = p.y;
    // (a raise before the thumb lifted makes no overhead of this touch's first stroke)
    h.ax = p.x; h.ay = p.y; h.raisedT = -9;
    if (h.lock <= 0) {
      [h.tgx, h.tgy] = guardPt(E);
      h.grip = 0; solveArm(E, 0);
      h.pux = h.ux; h.puy = h.uy; h.phx = h.hx; h.phy = h.hy; h.sp = 0; h.vx = h.vy = 0;
    }
  },
  onPointerMove(p, E) {
    const h = state.hand;
    if (state.aim && state.aim.id === p.id) aimAt(E, p);
    if (h.down && h.id === p.id) { h.fx = p.x; h.fy = p.y; }
  },
  onTap(p, E) {
    if (state.train && state.train.skip && E.hit(state.train.skip, p)) { E.audio.play('tap'); endYard(E, true); return; }
    const tt = state.tent;
    if (tt) {
      if (tt.t < TUNING.draft.delay) return;
      if (tt.skip && E.hit(tt.skip, p)) { leaveTent(E); return; }
      if (tt.krow && (E.hit(tt.krow.plus, p) || E.hit(tt.krow.minus, p))) { knifeBuy(E, tt, E.hit(tt.krow.plus, p)); return; }
      const b = tt.btns.find((q) => E.hit(q, p)); if (b) { if (tt.band) buyBandage(E); else buyWare(E, b.ware); } return;
    }
    const d = state.draft;
    if (d) {
      if (d.helpOn) { d.helpOn = d.helpOn >= 4 ? 0 : d.helpOn + 1; E.audio.play('tap'); return; }
      if (d.fly) return;
      // the inventory over the draft: a tap closes it
      if (d.view) { d.view = false; E.audio.play('tap'); return; }
      if (d.help && E.hit(d.help, p)) { d.helpOn = 1; E.audio.play('tap'); return; }
      if (d.wear && E.hit(d.wear, p)) { d.view = true; E.audio.play('tap'); return; }
      if (d.reroll && d.reroll.live && E.hit(d.reroll, p)) { rerollDraft(E); return; }
      if (d.skip && d.t > TUNING.draft.delay && E.hit(d.skip, p)) { skipDraft(E); return; }
      if (d.spoilBtn && d.t > TUNING.draft.delay && E.hit(d.spoilBtn, p)) { swapSpoil(E); return; }
      const b = d.t > TUNING.draft.delay && d.btns.find((q) => E.hit(q, p)); if (b) tapCard(E, d, b.i); return;
    }
    // the card lab (dev channel only): a LAB tab on the intro card opens it
    if (state.lab) { labTap(E, p); return; }
    if (state.intro && E.channel !== 'release' && E.hit(labTab(E), p)) { state.lab = { btns: [] }; state.labUsed = 1; E.audio.play('tap'); return; }
    // the card's "?" opens the full card, and any tap closes it again
    if (state.intro && state.introHelp) { state.introHelp = false; E.audio.play('tap'); return; }
    if (state.intro && state.introT > 0.35 && state.introQ && !(state.introGo >= 0) && E.hit(state.introQ, p)) { state.introHelp = true; E.audio.play('tap'); return; }
    if (state.intro && state.introT > 0.35 && !portrait(E) && !(state.introGo >= 0)) {
      E.audio.play('tap');
      if (introReady(E)) beginBout(E); else state.introGo = E.time;
    }
  },
  onPointerUp(p, E) {
    if (state.draft) state.draft.press = null;
    if (state.train && state.train.press && state.train.press.id === p.id) { yardRelease(E, state.train.press); state.train.press = null; }
    if (state.aim && state.aim.id === p.id) { aimUp(E); return; }
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
    if (state.spearAt != null) spearDown(ctx, E);
    if (state.sw && state.sw.ghostX) drawFighter(ctx, E, { ...youF(E), x: state.sw.ghostX }, state.you, 'you', 0.3 + 0.1 * Math.sin(state.m * 20));
    for (const g of state.ghosts) drawFighter(ctx, E, { ...youF(E), x: g.x }, state.you, 'you', 0.3 * g.life / TUNING.juice.ghost);
    drawFighter(ctx, E, youF(E), state.you, 'you');
    if (state.paintT > 0) paintGlow(ctx, E);
    if (state.netT > 0) {
      const Fy = youF(E), k = netK(state.netT);
      if (netArt()) { ctx.save(); ctx.translate(Fy.x, Fy.y); ctx.scale(Fy.dir, 1); ctx.rotate(Fy.a); drapeNet(ctx, E, Fy.H, state.you, k); ctx.restore(); } else drawNet(ctx, Fy.x, Fy.y - 0.55 * Fy.H, 0.32 * Fy.H * k);
    }
    if (state.edge && !state.edge.down) drawEdge(ctx, E);
    if (state.sw && state.sw.kind === 'blink' && state.sw.fin <= 0) { blinkGhosts(ctx, E); if (state.sw.spring) blinkStreaks(ctx, E); }
    if (state.sw && state.sw.dud && state.sw.fin <= 0) capuanGhosts(ctx, E);
    drawFighter(ctx, E, foeF(E), state.foe, 'foe');
    if (state.sw && state.sw.kind === 'throw' && state.sw.thrown && state.sw.fin <= 0) spearFlight(ctx, E);
    if (state.flyS > 0) flyingShield(ctx, E);
    if (state.foeNet > 0 && state.fallT <= 0 && !netArt()) { const Ff = foeF(E); drawNet(ctx, Ff.x, Ff.y - 0.5 * Ff.H, 0.36 * Ff.H * netK(state.foeNet)); }
    if (state.flyW > 0) flyingWeapon(ctx, E);
    drawGuard(ctx, E);
    drawZone(ctx, E);
    drawShield(ctx, E);
    drawSwordArm(ctx, E);
    drawKnives(ctx, E);
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
      } else if (f.k === 'b') {
        ctx.globalAlpha = Math.min(1, t * 3); ctx.fillStyle = f.c; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.28); ctx.fill();
      } else if (f.k === 'h') {
        ctx.globalAlpha = t * 0.7; ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1.3 - 0.5 * t), 0, 6.28); ctx.fill();
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
      E.text(q.s, q.x, q.y - (1 - t) * q.rise, { size: q.size * (1 + (1 - t) * 0.2), color: q.color, weight: '800', alpha: Math.min(1, t * 2) });
    }
    if (state.switchT > 0) emperorSignal(ctx, E);
    readGlow(ctx, E);
    if (state.banner) drawBanner(ctx, E);

    // HUD, inside the safe area
    const top = 10 + E.safe.top, l = 16 + E.safe.left, r = 16 + E.safe.right, TS = TUNING.stamina;
    if (!state.train && !state.kLesson) {
      E.text(`BOUT ${state.rack + 1}/${state.gauntlet.length}`, l, top + 12, { size: TUNING.hud.bout, align: 'left', weight: '800', color: state.foe.champion ? '#ffd24a' : '#e6e6e6' });
      drawCrowdMeter(ctx, E, l, top + 31);
    }
    // a dark plate under the right column, so a tall foe's helmet passing behind it never hides a row
    const H2 = hudRow();
    E.roundRect(E.w - r - 176, top - 6, 182, H2.shield + 18, 8, 'rgba(18,12,22,0.72)', null);
    drawHudHeart(ctx, E);
    if (state.shatter) { const [hx, hy] = heartAt(E); heartShatter(ctx, hx, hy, 1 - state.shatter.t / TUNING.juice.shatter); }
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
    // crossed blades (step 18) never wear out, so their row stays empty
    const nsh = state.me.dual ? 0 : shieldMax();
    for (let i = 0; i < nsh; i++) {
      ctx.fillStyle = state.sh.broken || noShield() ? '#3b3f46' : i < state.sh.hits ? '#d6a24a' : '#3b3f46';
      ctx.fillRect(bx + i * (bw / nsh), sy, bw / nsh - 4, 7);
    }
    if (!state.draft && !state.tent && !state.train && !state.kLesson) foeHealth(ctx, E);
    if (state.edge && !state.edge.down && !state.intro && !state.draft && !state.tent) drawEdgeTag(ctx, E);
    if (state.netT > 0) E.text('NETTED: slow hand, no lunge', bx + bw, sy + 34, { size: 14, align: 'right', color: '#e2e8f0', weight: '700' });
    if (state.hint && !state.intro && !state.caption) drawHint(ctx, E);
    drawFinBtn(ctx, E);
    drawArmsBtns(ctx, E);
    drawRightHints(E);
    if (state.train) drawYard(ctx, E);
    if (state.kLesson) drawLesson(ctx, E);
    if (state.intro) { drawIntro(ctx, E); if (E.channel !== 'release') { const t = labTab(E); E.roundRect(t.x, t.y, t.w, t.h, 10, '#1f2937', '#e879f9'); E.text('LAB', t.x + t.w / 2, t.y + t.h / 2, { size: 15, weight: '800', color: '#f5d0fe' }); } }
    if (state.lab) drawLab(ctx, E);
    if (state.draft) drawDraft(ctx, E);
    if (state.tent) (state.tent.band ? drawBandage : drawTent)(ctx, E);
  },
};

// coins and petals falling over the screen, n of them, each fall s from top to bottom, t s since they began (cosmetic: placed by index, no state)
function rain(ctx, E, t, n, fall) {
  const u = (i, k) => { const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
  for (let i = 0; i < n; i++) {
    const ph = t / fall - u(i, 1);
    if (ph < 0) continue;
    const px = u(i, 2) * E.w + Math.sin(t * 2 + i) * 10, py = -10 + (ph % 1) * (E.h + 20);
    if (i % 2) { drawCoin(ctx, px, py, 5); continue; }
    ctx.save(); ctx.translate(px, py); ctx.rotate(t * 3 + i); ctx.fillStyle = i % 4 ? '#f472b6' : '#e11d48';
    ctx.beginPath(); ctx.ellipse(0, 0, 6, 3, 0, 0, 6.28); ctx.fill(); ctx.restore();
  }
}
// The end: an epilogue card first when the champion fell, then the end card (your card and theirs, your upgrades, the pit wall when you fell).
export const over = {
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
  // The Grand Games end on the Emperor's thumb: the imperial box, the crowd meter filling to the champion bout's average, then his hand rises and the
  // thumb turns up (a nod as well at a middling meter), the crowd roars, coins and petals fall, and the ending is as grand as the meter.
  thumb(ctx, E) {
    const p = this.p, T = TUNING.thumb, b = bandOf(p.fav), t = this.t, t0 = T.box + T.meter, w = Math.min(E.w - 32, 620), h = Math.min(E.h - 24, 272), x = (E.w - w) / 2, y = (E.h - h) / 2, cx = E.w / 2;
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
    const nod = b === 1 ? Math.sin(clamp((t - t0 - T.hand) / T.turn, 0, 1) * Math.PI) * 4 : 0, ex = cx, ey = by + bh * 0.3 + nod;
    if (!emp) {
      ctx.fillStyle = '#c9a27a'; ctx.beginPath(); ctx.arc(ex, ey, bh * 0.12, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#f2f0ea'; ctx.beginPath(); ctx.moveTo(ex - bh * 0.22, by + bh * 0.62); ctx.quadraticCurveTo(ex, ey + bh * 0.05, ex + bh * 0.22, by + bh * 0.62); ctx.fill();
      ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ex, ey - bh * 0.02, bh * 0.13, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    }
    ctx.restore();
    // the crowd meter under the box fills to what the Emperor reads, before his hand moves
    const km = easeOut(clamp((t - T.box) / T.meter, 0, 1)), my = by + bh + 16, fav = p.fav * km;
    if (t > T.box) { crowdBar(ctx, cx - bw / 2, my, bw, fav, km >= 1 ? 0 : 0.25); E.text(`${Math.round(fav / TUNING.crowd.max * 100)}%`, cx + bw / 2 + 8, my, { size: 14, weight: '800', align: 'left', color: '#fde68a' }); }
    // the hand rises over the rail, a fist with the thumb out, and turns up
    const kh = easeOut(clamp((t - t0) / T.hand, 0, 1)), kt = easeOut(clamp((t - t0 - T.hand) / T.turn, 0, 1)), hx = cx + bw * 0.3, hy = by + bh * 0.9 - kh * bh * 0.45;
    if (kh > 0) {
      const ang = -kt * Math.PI / 2, r = bh * 0.15;
      ctx.save(); ctx.translate(hx, hy);
      ctx.fillStyle = '#5b2160'; ctx.fillRect(-r * 0.7, r * 0.6, r * 1.4, bh * 0.4);
      ctx.fillStyle = '#d4a77e'; rrect(ctx, -r, -r * 0.8, r * 2, r * 1.6, r * 0.5); ctx.fill();
      ctx.rotate(ang); ctx.fillRect(r * 0.6, -r * 0.28, r * 1.1, r * 0.56); ctx.strokeStyle = '#7a5032'; ctx.lineWidth = 1.5; ctx.strokeRect(r * 0.6, -r * 0.28, r * 1.1, r * 0.56);
      ctx.restore();
    }
    const tu = t0 + T.hand + T.turn;
    if (t >= tu) {
      if (!this.heard) { this.heard = true; crowdVerdict(E); }
      E.text('Thumbs up. The crowd roars.', cx, my + 26, { size: 17, weight: '800', color: '#ffd24a' });
      wrapPx(ctx, endingOf('games', p.me, p.fav), w - 40, 16, '700').slice(0, 2).forEach((s2, i) => E.text(s2, cx, my + 50 + i * 20, { size: 16, weight: '700', color: '#fde68a' }));
      if (p.fame && p.fame.sum) E.text(`+${p.fame.sum} fame`, cx + w / 2 - 20, y + h - 18, { size: 16, weight: '800', align: 'right', color: '#ffd24a' });
      rain(ctx, E, t - tu, T.rain[b], T.fall);
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
