// Arena: Between bouts and the screens: the draft, the tent, the purse, the inventory, the intro cards, wheels, and the meta (fame, the ludus).
// Split from game.js by tools/arena-split.mjs (ADR-0024). Only tuning.js and data.js may be read while modules load.

import { makeRng, clamp, lerp, ease } from './engine.js';
import { TUNING } from './tuning.js';
import { PROFILES, NEW_CHAMPS, BEASTS, beastTitle, ARENAS, ARENA, champTie, champLine, ORIGINS, TRAITS, DRIVES, REVENGE, denarii, storyLine, LUDUS,
  LUDUS_LOCK, cardOpen, SCARS, FAMS, SLOT_NAMES, DECK, CARD, cardNums, WARES, DUO_GOLD, TIER_TINT, rarCol, titleOf, gearOf, GUARDS, PARTS, ARM_LEN,
  beastParts, PLATES, playerParts, lenN } from './data.js';
import { partCenter, poseFoe, beastRest, knee, clangSound, chantN } from './fight.js';
import { sigOf } from './foe.js';
import { C_, famN, growth, firstRun } from './cards.js';
import { weaponKey, drawPic, sayLines, sayLine, brutusFaceOn, cardGrow, KIT_HELM, KIT_SHIELD, kitTier, kitPic, dollArt, helmArt, gearPic, shieldPic,
  drawSeg, kitTorso, torsoPlate, plateBoth, TAU, GTYPE, LEGS, canSprite, shade, lw, line, lerp2, paintGuard, kitSlot, kitGuard, drawHeart, drawCoin,
  rrect, paintWeapon, zonePic, KIND_WORD, kindSegs, drawWeapon, drawBeast } from './draw-fight.js';
import { WHEELS, openTo, laurel, champs, tapLive, over } from './scenes.js';
import { arena, bout, drives, debtLeft, brutusIntro, brutusWon, wornGear, replaces, state, wrap, pidx, has, noDodge, noShield, pickW, kitMe, deriveMe,
  sizeOf, weaponName, foeParts, dualGaps, guardParts, newRack, startCards, saveRun, artV, artImg, artState, artReady, champPic, kitOn } from './game.js';
import { sideWield, knifeRow, tentKnives, bowAt, rackBow } from './features/ranged.js';

// ====== BETWEEN BOUTS: the grade and the draft ======
// The bout's grade from what this bout added to the run's counts.
export function boutTally() {
  const b = state.bout;
  const t = { slot: state.slotHits - b.slot, read: state.feintsRead - b.read, pun: state.punishes - b.pun, taken: state.taken - b.taken, perf: state.perfects - b.perf, dodge: state.dodged - b.dodge, lame: state.lamings - b.lame, bash: state.bashHits - b.bash };
  t.good = t.slot + t.read + t.pun + t.perf + t.dodge + t.lame + t.bash;
  return t;
}
// The hits a rung allows in this bout (a pair bout allows one more)
const hitsAllowed = (r) => lenN(r.taken + (state.gauntlet[state.rack].pair ? TUNING.grade.pair : 0));
export function gradeBout() {
  const t = boutTally();
  for (const g of ['S', 'A', 'B']) if (TUNING.grade[g].some((r) => t.taken <= hitsAllowed(r) && t.good >= r.good)) return g;
  return 'C';
}
// The families you wear, counted: each piece for its family, war paint for its own (a set bonus is worn by no family)
const famsOf = (c) => c.duo || [c.fam];
export function heldFams() {
  const n = {};
  for (const id of state.picks) { const c = CARD[id]; if (!c.duo) n[c.fam] = (n[c.fam] || 0) + 1; }
  return n;
}
// What can be dealt: each card once; never one your keystone makes useless (a dodge card without a dodge, a shield card without a shield), never a keystone
// that takes away what your keystone lives on, a set bonus only while you wear a piece of both its families, and nothing of a family the ludus shuts.
export function dealable() {
  const held = heldFams(), lost = (k) => (k === 'dodge' ? noDodge() : k === 'feint' ? !has('myfeint') : noShield());
  // (a shield face is never dealt to two blades)
  return DECK.filter((c) => !has(c.id) && cardOpen(state.me, c) && !(c.slot === 'shield' && state.me.dual) && !(c.needs && [].concat(c.needs).some(lost)) && !(c.bans && DECK.some((k) => k.key && has(k.id) && k.needs === c.bans))
    && !(c.duo && !c.duo.every((f) => held[f])));
}
export const priceOf = (c) => (c.duo ? TUNING.draft.duoPrice : TUNING.draft.price[c.tier]);
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
function cascadeOdds(left, cas = TUNING.draft.cascade) {
  let rest = 1;
  return cascadeTiers(left).map(([t, k]) => { const p = k ? rest * cas[k] : rest; rest -= p; return [t, p]; }).filter((e) => e[1] > 0);
}
// Step 9: the bout just won, by its gauntlet row (1 to 5; the Grand Games skip the sparring bout, so they reach each step a bout sooner), and what it adds
// to the deal: each free card's epic chance, whether the grade makes one free card a sure epic, and the priced slot's cascade
export const boutLvl = () => (state.gauntlet ? arena().rows[state.rack] + 1 : 1);
const freeEpic = () => TUNING.draft.boutEpic[boutLvl()] || 0;
const sureEpic = (grade) => grade === 'S' && boutLvl() >= TUNING.draft.sureEpic;
const cascadeNow = () => { const D = TUNING.draft, L = D.boutLegend[boutLvl()]; return L == null ? D.cascade : { ...D.cascade, legend: L }; };
// Three seeded cards, dealt when the draft opens (salt 0) or rerolled (salt n, never the cards just shown when the deck allows). Two are free: each one's
// rarity (common or rare) by the grade's odds (the first `sure` of them rare), then its family, then the piece; from bout 3 each may first roll an epic
// (after an S the first is a sure one). The third is priced and cascades. At most perFam cards of one family a draft. The training ground's fourth card
// is a third free one, in the run's first draft.
export function dealDraft(grade, salt = 0, not = []) {
  const D = TUNING.draft, rng = makeRng((state.seed ^ 0x7f4a7c15) + state.rack * 104729 + salt * 15485863), all = dealable(), held = heldFams(), out = [];
  const deal = D.deal + (state.fourth && state.rack === 0 ? 1 : 0), fresh = all.filter((c) => !not.includes(c)), pool = fresh.length >= deal ? fresh : all;
  const room = (c) => famsOf(c).every((f) => out.filter((o) => famsOf(o).includes(f)).length < D.perFam);
  const ep = freeEpic(), se = sureEpic(grade), cas = cascadeNow();
  for (let i = 0; i < deal - 1; i++) {
    const epics = (ep || se) && pool.filter((c) => !c.duo && c.tier === 2 && !out.includes(c) && room(c));
    if (epics && epics.length && ((se && i === 0) || (ep && rng.chance(ep)))) { out.push(famPick(rng, epics, held)); continue; }
    const left = pool.filter((c) => !c.duo && c.tier <= 1 && !out.includes(c) && room(c)), tiers = [0, 1].filter((t) => left.some((c) => c.tier === t));
    if (!tiers.length) break;
    const tier = i < (D.sure[grade] || 0) && tiers.includes(1) ? 1 : pickW(rng, tiers.map((t) => [t, D.odds[grade][t]]));
    out.push(famPick(rng, left.filter((c) => c.tier === tier), held));
  }
  const left = pool.filter((c) => !out.includes(c) && room(c));
  let pick = null;
  for (const [t, k] of cascadeTiers(left)) if (!k || rng.chance(cas[k])) { pick = famPick(rng, left.filter((c) => inTier(c, t)), held); break; }
  return { cards: pick ? [...out, pick] : out, priced: pick ? out.length : -1, odds: cascadeOdds(left, cas).map(([t, p]) => [t, Math.round(p * 100)]) };
}
// the bout's gold: a fell, plus style (halved for the Darling of Rome), plus the crowd's share of both
export function boutGold() {
  const G = TUNING.gold, t = boutTally(), per = state.perfects - state.bout.perf, k = has('darling') ? C_().darlingGold : 1, c = (n) => Math.round(n * k);
  const raw = [G.fell, t.read * G.read, per * G.perfect, t.slot * G.slot, t.taken === 0 ? G.clean : 0];
  const items = [['fell', G.fell], ['fakes spotted', c(raw[1])], ['well-timed blocks', c(raw[2])], ['gap hits', c(raw[3])], ['no hits', c(raw[4])]];
  // the crowd pays a share of the bout's un-halved gold by its mood as the bout ends; the Darling's halving is applied to it once
  items.push(['crowd', c(raw.reduce((a, v) => a + v, 0) * TUNING.crowd.pay * state.fav / TUNING.crowd.max * growth('idol', 'show', C_().idolGold))]);
  // Every Win Pays: a share more of all of it
  if (drives('debt')) items.push(['every win pays', Math.round(items.reduce((a, e) => a + e[1], 0) * (TUNING.reasons.debt.gold - 1))]);
  const kept = items.filter((e) => e[1] > 0);
  return { sum: kept.reduce((a, e) => a + e[1], 0), items: kept };
}
export function openDraft(E) {
  const grade = state.grades[state.grades.length - 1] || 'C', deal = dealDraft(grade);
  state.draft = { grade, tally: boutTally(), gold: state.lastGold, cards: deal.cards, priced: deal.priced, odds: deal.odds, t: 0, btns: [], reroll: null, help: null, helpOn: 0, view: false, wear: null, spoil: spoilOf(),
    fly: null, press: null, shake: null, need: -1 };
  state.epicsSeen += deal.cards.filter((c) => c.tier >= 2).length;
  saveRun(E);
  const h = state.hand; h.down = false; h.id = -1; h.atk = null; state.sh.held = false; state.sh.hid = -1; state.dg.down = false;
  E.audio.play('coin');
}
// The spoils: the weapon of the fighter just felled (the last of a pair), when he is a man and it is not yours; an axe or a mace as he carried it, Mevia's
// spear a plain spear. mine: what you carried, for the swap back.
export function spoilOf() {
  const f = state.foe, me = state.me, w = f && !f.beast && f.weapon && f.weapon.id, mace = w === 'axe' && !!f.mace;
  if (!w || !TUNING.me.weapons[w] || (w === me.weapon && (w !== 'axe' || mace === !!me.mace))) return null;
  return { w, mace, mine: [me.weapon, !!me.mace], took: false, her: !!(NEW_CHAMPS[f.ck] && NEW_CHAMPS[f.ck].female) };
}
// your fighter with another weapon, as if the weapon wheel had landed on it
export function wield(me, w, mace) {
  const idx = me.idx.slice();
  idx[5] = TUNING.me.wheels.weapon.findIndex((e) => e[0] === w);
  return deriveMe({ ...me, idx, mace });
}
const spoilName = (w, mace) => weaponName({ weapon: w, mace }).toLowerCase();
// a tap takes his weapon, a second gives it back; the choice stands when you leave the card
export function swapSpoil(E) {
  const S = state.draft.spoil;
  S.took = !S.took;
  state.me = S.took ? wield(state.me, S.w, S.mace) : wield(state.me, S.mine[0], S.mine[1]);
  state.you.lookSig = null;
  saveRun(E);
  E.audio.play('tap'); clangSound(E, 0); E.haptic(15);
}
// a card joins your picks, and a piece takes its slot: whatever was worn there is gone. Titan's hearts come and go with it.
export function applyCard(c, on = true) {
  uncapHearts();
  const was = colossusHearts();
  swapCard(c, on);
  const dh = colossusHearts() - was;
  if (dh) { state.maxHp += dh; state.hp = clamp(state.hp + dh, 1, state.maxHp); }
  capHearts();
}
// Colossus: a heart for each Brute card worn (itself among them), coming and going with them
export const colossusHearts = () => (has('colossus') ? C_().colossus * famN('brute') : 0);
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
export function openTent(E) {
  const T = TUNING.tent, rng = makeRng(state.seed ^ 0x3c6ef372), me = state.me, bare = ['head', 'chest', 'legs'].filter((q) => !me.plates.includes(q));
  const big = rng.shuffle(WARES.filter((w) => w.big && (w.id !== 'plate' || bare.length))).slice(0, T.big), small = rng.shuffle(WARES.filter((w) => !w.big && !has(w.id))).slice(0, T.small);
  const wares = [...big, ...small].map((w) => {
    const part = w.id === 'plate' ? rng.pick(bare) : null;
    return { id: w.id, price: T.price[w.id], name: w.name.replace('{weapon}', weaponName(me).toLowerCase()), line: w.line.replace('{part}', part).replace('{n}', lenN(T.heart)), part, sold: false };
  });
  state.tent = { wares, t: 0, btns: [], skip: null };
  saveRun(E, state.rack + 1);
}
export function buyWare(E, w) {
  if (w.sold) return;
  if (state.gold < w.price) { E.audio.play('miss'); return; }
  state.gold -= w.price; w.sold = true; state.wares.push(w.id);
  if (w.id === 'plate') { state.me.plates.push(w.part); state.you.parts.find((q) => q.d.id === w.part).armour = true; }
  else if (w.id === 'heart' || w.id === 'hide') { const n = w.id === 'heart' ? lenN(TUNING.tent.heart) : TUNING.cards.hide; state.maxHp += n; state.hp += n; capHearts(); }
  else if (w.id === 'wind') { const add = state.staMax * (TUNING.cards.wind - 1); state.staMax += add; state.stamina += add; }
  else if (w.id === 'token') state.token++;
  E.audio.play('coin'); E.haptic(15);
}
export function leaveTent(E) {
  const band = state.tent && state.tent.band;
  state.tent = null; if (!band) state.tentDone = true;
  E.audio.play('tap');
  if (!band && bandageDue()) { openBandage(E); return; }
  state.rack++; newRack(E); poseFoe(E, 0.016);
}
// Step 9: before the last bout's champion (step 18: not the Grand Games' others), Brutus sells bandages for gold (1 heart each, up to your max), on a small screen in the tent's look (state.tent with
// `band`; step 22: knives too); it is skipped when you are at full health and can buy no knife. The run is saved at the champion's bout, as the tent's is at the next one.
export const bandageDue = () => { const nx = state.gauntlet[state.rack + 1], K = TUNING.knives; return !!nx && !!nx.champion && state.rack + 2 === state.gauntlet.length && (state.hp < state.maxHp || (state.knives < K.max && state.gold >= K.price)); };
export function openBandage(E) {
  state.tent = { band: true, t: 0, btns: [], skip: null, bought: 0 };
  saveRun(E, state.rack + 1);
}
export function buyBandage(E) {
  const tt = state.tent, price = TUNING.tent.bandage;
  if (state.hp >= state.maxHp || state.gold < price) { E.audio.play('miss'); return; }
  state.gold -= price; state.hp = Math.min(state.maxHp, state.hp + 1); tt.bought++;
  E.audio.play('coin'); E.haptic(15);
}
export function pickCard(E, c) {
  const d = state.draft;
  if (d && d.cards.indexOf(c) === d.priced) { if (state.gold < priceOf(c)) { E.audio.play('miss'); return; } state.gold -= priceOf(c); state.bought.push(c.id); E.audio.play('coin'); }
  applyCard(c);
  // every card ever picked can fill the training ground's start-card slot
  const seen = E.save.get('picked', []); if (!c.duo && !seen.includes(c.id)) E.save.set('picked', [...seen, c.id]);
  E.audio.play('tap'); E.haptic(15);
  afterDraft(E, d);
}
// the draft closes: the tent once, the bandages before the champion, else the next bout
function afterDraft(E, d) {
  if (d && d.spoil && d.spoil.took) state.spoils++;
  state.draft = null;
  if (state.rack + 1 === TUNING.tent.after && !state.tentDone) { openTent(E); return; }
  if (bandageDue()) { openBandage(E); return; }
  state.rack++; newRack(E); poseFoe(E, 0.016);
}
// Step 19, Skip: no card, and gold instead, rising from skip[0] after bout 1 to skip[1] for the run's last draft (the one before the champion)
export const skipPay = () => { const [a, b] = TUNING.draft.skip, n = Math.max(1, state.gauntlet.length - 2); return Math.round(a + (b - a) * clamp(state.rack / n, 0, 1)); };
export function skipDraft(E) {
  const d = state.draft;
  if (!d) return;
  const pay = skipPay();
  state.gold += pay; state.goldEarned += pay; state.skips++;
  E.audio.play('coin'); E.haptic(15);
  afterDraft(E, d);
}
// the run's one token, spent on the draft: three new cards
export function rerollDraft(E) {
  const d = state.draft;
  if (!d || state.token <= 0) return;
  state.token--; state.rerolls++; state.tokenUsed += `${state.tokenUsed ? ',' : ''}reroll-b${state.rack + 1}`;
  const deal = dealDraft(d.grade, state.rerolls, d.cards); d.cards = deal.cards; d.priced = deal.priced; d.odds = deal.odds; d.t = 0; d.shake = null; d.need = -1;
  state.epicsSeen += d.cards.filter((c) => c.tier >= 2).length;
  saveRun(E);
  E.audio.beep({ freq: 520, dur: 0.12, type: 'triangle', slide: 1.4, gain: 0.12 }); E.haptic(12);
}

// ====== DRAWING (continued) ======
// ----- upgrade icons and cards -----
// A card's icon: a roundel of radius s at (x, y) ringed in its family's colour (a duo's in gold, a keystone's doubled), with its family's mark,
// or, small, the card's initials so each owned card can be named from the HUD.
export function famGlyph(ctx, fam, u) {
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
export function drawIcon(ctx, id, x, y, s) {
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
// Step 23, a draft card's face (at x, y, w x h): its slot as a chip and its price (the gold card's) along the top, its icon as large as the room
// allows, its name, and its short line; at the foot the piece it replaces (orange), or "Need N gold" once the gold card was tapped without the gold.
// The border is its rarity's colour. Everything on it is 14 px or more.
function draftCard(ctx, E, d, c, i, x, y, w, h, ready) {
  const priced = i === d.priced, price = priceOf(c), short = priced && state.gold < price, rc = rarCol(c), old = replaces(c);
  ctx.globalAlpha *= !ready ? 0.6 : short && d.need !== i ? 0.55 : 1;
  E.roundRect(x, y, w, h, 14, priced ? '#2a2016' : '#221a2b', rc);
  E.roundRect(x + 3, y + 3, w - 6, h - 6, 11, null, priced ? 'rgba(255,210,74,0.55)' : shade(rc, 0.6));
  const chip = c.slot ? SLOT_WORD[c.slot] : c.duo ? 'Set bonus' : 'War paint';
  ctx.font = '800 14px system-ui, sans-serif';
  const pw = priced ? ctx.measureText(`${price}`).width + 24 : 0, cw = Math.min(ctx.measureText(chip).width + 14, w - 20 - pw);
  E.roundRect(x + 8, y + 7, cw, 22, 11, 'rgba(255,255,255,0.06)', shade(rc, 0.7));
  E.text(clipLine(ctx, chip, cw - 10, 14, '800'), x + 8 + cw / 2, y + 18, { size: 14, weight: '800', color: '#c4b99a' });
  if (priced) {
    E.text(`${price}`, x + w - 10, y + 18, { size: 14, weight: '800', align: 'right', color: short ? '#9aa4b2' : '#ffd24a' });
    drawCoin(ctx, x + w - 10 - ctx.measureText(`${price}`).width - 11, y + 18, 6);
  }
  const bot = [];
  if (priced && d.need === i && short) bot.push([`Need ${price} gold`, '#fca5a5']);
  else if (old) bot.push([clipLine(ctx, `replaces ${old.gear}`, w - 12, 14, '700'), '#fb923c']);
  const nsz = fitSize(ctx, c.name, 19, w - 12), nl = wrapPx(ctx, c.name, w - 12, nsz, '800'), ls = wrapPx(ctx, c.short, w - 14, 15, '700');
  const fy = y + h - 14, top = y + 34, end = bot.length ? fy - 18 : fy + 4, text = nl.length * 21 + ls.length * 18, r = Math.min(34, (end - top - text - 10) / 2), ir = r >= 10 ? r : 0;
  let cy = top + Math.max(0, (end - top - text - (ir ? 2 * ir + 10 : 0)) / 2);
  if (ir) { drawIcon(ctx, c.id, x + w / 2, cy + ir, ir); cy += 2 * ir + 10; }
  nl.forEach((q, k) => E.text(q, x + w / 2, cy + 10 + k * 21, { size: nsz, weight: '800', color: '#f0e6cc' }));
  cy += nl.length * 21;
  ls.forEach((q, k) => E.text(q, x + w / 2, cy + 9 + k * 18, { size: 15, weight: '700', color: '#e2e8f0' }));
  bot.forEach(([t, color]) => E.text(t, x + w / 2, fy, { size: 14, weight: '700', color }));
}
// the long press's box over a card: its name, its full line, its numbers' note for a beast, and its footer (the piece, its slot, its family)
const cardFoot = (c) => { const fam = (f) => FAMS[f].name.replace(/^The /, ''); return c.duo ? `set bonus · ${c.duo.map(fam).join(' + ')}` : c.fam === 'fin' ? `${c.gear} · war paint` : `${c.gear} · ${SLOT_WORD[c.slot].toLowerCase()} · ${fam(c.fam)}`; };
function cardBox(ctx, E, c, x, y, w, h) {
  const bw = Math.min(E.w - 24, w + 60), tw = bw - 20;
  const ls = wrapPx(ctx, cardLine(c), tw, 14, '600'), ns = beastNote(c) ? wrapPx(ctx, beastNote(c), tw, 14, '600') : [], fs = wrapPx(ctx, cardFoot(c), tw, 14, '700');
  const bh = 34 + 17 * (ls.length + ns.length + fs.length) + 8, bx = clamp(x + w / 2 - bw / 2, 12, E.w - 12 - bw), by = clamp(y + h / 2 - bh / 2, 8, E.h - 8 - bh);
  E.roundRect(bx, by, bw, bh, 14, '#14101a', rarCol(c));
  E.text(c.name, bx + bw / 2, by + 17, { size: fitSize(ctx, c.name, 17, tw), weight: '800', color: c.duo ? DUO_GOLD : FAMS[c.fam].col });
  let ly = by + 40;
  for (const [L, col] of [[ls, '#e2e8f0'], [ns, '#8a8f99'], [fs, rarCol(c)]]) L.forEach((t) => { E.text(t, bx + bw / 2, ly, { size: 14, weight: '600', color: col }); ly += 17; });
}
// the small doll in the draft's top left corner, in your plates, that a card taken flies to: returns its feet (x, y) and scale s
function draftDoll(ctx, E) {
  const D = TUNING.draft.doll, s = D / 1.08, x = 16 + E.safe.left + 0.4 * s, y = E.safe.top + 6 + D;
  E.roundRect(x - 0.42 * s, y - D - 4, 0.84 * s, D + 8, 8, 'rgba(31,26,36,0.9)', '#4a4252');
  armourIcon(ctx, E, playerParts({ plates: state.me.plates }), x, y, s, state.me.str, GTYPE[state.me.weapon].helm);
  return { x, y, s };
}
// a tap on a draft card takes it: it flies to the doll (play.update picks it when it lands); the gold card without the gold shakes
export function tapCard(E, d, i) {
  const c = d.cards[i];
  if (i === d.priced && state.gold < priceOf(c)) { d.shake = { i, t0: d.t }; d.need = i; E.audio.play('miss'); E.haptic(20); return; }
  d.fly = { i, card: c, t: 0 }; d.press = null;
  E.audio.beep({ freq: 740, dur: 0.08, type: 'triangle', slide: 1.5, gain: 0.1 }); E.haptic(10);
}
// The draft: the bout's grade and why, Brutus, the gold the bout earned, the grade's odds, and three cards: two free, one priced in gold.
export function drawDraft(ctx, E) {
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
  // (the first draft of the first run: only "Pick one. Tap it.")
  const say = firstRun(E) && state.rack === 0 ? 'Pick one. Tap it.' : brutusWon();
  const fw = artImg('brutus-proud') ? TUNING.art.face + 8 : 0, bl = wrapPx(ctx, `Old Brutus: “${say}”`, E.w - 32 - E.safe.left - E.safe.right - fw, 14, '700').slice(0, 2), ex = (bl.length - 1) * 17;
  sayLines(ctx, E, bl, E.w / 2, top + 50, 17, E.w, { size: 14, weight: '700', color: '#fde68a' }, 'brutus-proud');
  const g = d.gold;
  E.text(g ? `+${g.sum} gold  ·  purse ${state.gold}` : `purse ${state.gold}`, E.w / 2, top + 72 + ex, { size: 14, weight: '700', color: '#fbbf24' });
  const n = d.cards.length, gap = 14, w = Math.min(210, (E.w - 32 - E.safe.left - E.safe.right - gap * (n - 1)) / n), y = top + 88 + ex, h = Math.min(190, E.h - E.safe.bottom - y - 62), x0 = (E.w - (w * n + gap * (n - 1))) / 2;
  const ready = d.t > D.delay, doll = draftDoll(ctx, E);
  d.btns = d.cards.map((c, i) => {
    const x = x0 + i * (w + gap), f = d.fly, sh = d.shake && d.shake.i === i ? d.t - d.shake.t0 : -1;
    // a shaking card (gold it can't take) jitters; the card taken lifts, flashes, and flies to its slot on the doll
    const jx = sh >= 0 && sh < D.shake ? Math.sin(sh * 60) * D.shakePx * (1 - sh / D.shake) : 0;
    if (f && f.i === i) {
      const at = (INV_SLOTS.find((q) => q.card === c.slot) || { at: [0, -0.55] }).at, lift = clamp(f.t / D.lift, 0, 1), k = ease.inOut(clamp((f.t - D.lift) / (D.fly - D.lift), 0, 1));
      const cx = lerp(x + w / 2, doll.x + at[0] * doll.s, k), cy = lerp(y + h / 2, doll.y + at[1] * doll.s, k), sc = lerp(1 + 0.06 * lift, 0.1, k);
      ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-w / 2, -h / 2);
      draftCard(ctx, E, d, c, i, 0, 0, w, h, true);
      if (lift < 1 || k < 0.3) { ctx.globalAlpha = 0.55 * (1 - lift * 0.6); E.roundRect(0, 0, w, h, 14, '#fff6dc', null); }
      ctx.restore(); ctx.globalAlpha = 1;
    } else {
      ctx.save(); ctx.translate(x + jx, y);
      draftCard(ctx, E, d, c, i, 0, 0, w, h, ready);
      ctx.restore(); ctx.globalAlpha = 1;
    }
    return { x, y, w, h, card: c, i };
  });
  // a long press: the card's full line and its footer in a box over it; letting go closes it
  const pr = d.press && !d.fly && E.time - d.press.t0 >= D.long && d.btns[d.press.i];
  if (pr) cardBox(ctx, E, pr.card, pr.x, pr.y, pr.w, pr.h);
  const by = Math.min(E.h - E.safe.bottom - 30, y + h + 32);
  // the row under the cards, centred: the spoils (when there are any), Skip, Reroll, "?" and Wearing
  const [kw, kh] = D.skipBtn, rw = 150, gp = 10, row = kw + rw + 48 + 104 + 3 * gp, room = E.w - 24 - E.safe.left - E.safe.right;
  const S = d.spoil, lab = S ? (S.took ? `Keep your ${spoilName(S.mine[0], S.mine[1])}` : `Take ${S.her ? 'her' : 'his'} ${spoilName(S.w, S.mace)}`) : '';
  const sfs = S ? fitSize(ctx, lab, 16, Math.max(96, room - row - gp - 20)) : 0, sw0 = S ? (ctx.font = `800 ${sfs}px system-ui, sans-serif`, Math.min(Math.max(120, ctx.measureText(lab).width + 24), room - row - gp)) : 0;
  let rx = (E.w - row - (S ? sw0 + gp : 0)) / 2;
  const sx = rx; if (S) rx += sw0 + gp;
  // Skip: no card, its gold on the button
  ctx.globalAlpha = ready ? 1 : 0.5;
  d.skip = { x: rx, y: by - kh / 2, w: kw, h: kh };
  E.roundRect(d.skip.x, d.skip.y, kw, kh, 14, '#3a2a14', '#fbbf24');
  E.text(`Skip +${skipPay()}`, rx + kw / 2, by, { size: fitSize(ctx, `Skip +${skipPay()}`, 17, kw - 12), weight: '800', color: '#fde68a' });
  ctx.globalAlpha = 1;
  rx += kw + gp;
  // the token's state is drawn (lit or grey); its count is written only when there are two or more
  d.reroll = tokenButton(E, 'Reroll', rx + rw / 2, by, state.token, true, state.token > 1 ? `${state.token} left` : '', rw);
  rx += rw + gp;
  d.help = { x: rx, y: by - 24, w: 48, h: 48 };
  E.roundRect(d.help.x, d.help.y, 48, 48, 24, '#1f2937', '#c4b99a');
  E.text('?', d.help.x + 24, by, { size: 22, weight: '800', color: '#f0e6cc' });
  // Wearing: the inventory, what you wear
  d.wear = { x: d.help.x + 48 + gp, y: by - 22, w: 104, h: 44 };
  E.roundRect(d.wear.x, d.wear.y, d.wear.w, d.wear.h, 12, '#1f2937', '#c4b99a');
  E.text('Wearing', d.wear.x + d.wear.w / 2, by, { size: 16, weight: '800', color: '#f0e6cc' });
  // the spoils, leftmost: take his weapon, or keep yours
  d.spoilBtn = null;
  if (S) {
    const fs = sfs, b = { x: sx, y: by - 22, w: sw0, h: 44 };
    ctx.globalAlpha = ready ? 1 : 0.5;
    E.roundRect(b.x, b.y, b.w, b.h, 12, S.took ? '#3a2a14' : '#5a3a12', S.took ? '#c4b99a' : '#fbbf24');
    E.text(lab, b.x + b.w / 2, by, { size: fs, weight: '800', color: S.took ? '#e2d6b8' : '#fde68a' });
    ctx.globalAlpha = 1;
    d.spoilBtn = b;
  }
  if (d.view || d.helpOn === 4) drawWearing(ctx, E);
  else if (d.helpOn === 1) drawCardHelp(ctx, E, d.cards); else if (d.helpOn === 2) drawDealHelp(ctx, E, held, d.odds); else if (d.helpOn === 3) drawBoutHelp(ctx, E, d);
}
// The "?", first page: each card in this draft with its piece, its plain line and, under it, its exact numbers
function drawCardHelp(ctx, E, cards) {
  const w = Math.min(E.w - 32, 620), x = (E.w - w) / 2, tw = w - 72, rows = cards.map((c) => ({ c, ls: wrapPx(ctx, cardLine(c), tw, 14, '600'), ns: wrapPx(ctx, cardNums(c), tw, 14, '600'), bn: beastNote(c) ? wrapPx(ctx, beastNote(c), tw, 14, '600') : [] }));
  const hs = rows.map((q) => 22 + 16 * (q.ls.length + q.ns.length + q.bn.length)), h = Math.min(E.h - 16, 58 + hs.reduce((a2, b2) => a2 + b2, 0)), y = (E.h - h) / 2;
  ctx.fillStyle = 'rgba(10,8,14,0.7)'; ctx.fillRect(0, 0, E.w, E.h);
  E.roundRect(x, y, w, h, 16, '#221a2b', '#e6c866');
  E.text('WHAT THESE CARDS DO', E.w / 2, y + 18, { size: 14, weight: '800', color: '#c4b99a' });
  let ry = y + 34;
  rows.forEach(({ c, ls, ns, bn }, i) => {
    drawIcon(ctx, c.id, x + 30, ry + 14, 13);
    E.text(c.name, x + 54, ry + 8, { size: 14, weight: '800', align: 'left', color: c.duo ? DUO_GOLD : FAMS[c.fam].col });
    // its piece, slot and family after the name (step 23: off the card's face)
    const nw = ctx.measureText(c.name).width + 14;
    if (nw < tw - 40) E.text(clipLine(ctx, cardFoot(c), tw - nw, 14, '700'), x + 54 + nw, ry + 8, { size: 14, weight: '700', align: 'left', color: rarCol(c) });
    ls.forEach((t, k) => E.text(t, x + 54, ry + 24 + k * 16, { size: 14, weight: '600', align: 'left', color: '#e2e8f0' }));
    ns.forEach((t, k) => E.text(t, x + 54, ry + 24 + (ls.length + k) * 16, { size: 14, weight: '600', align: 'left', color: '#fde68a' }));
    bn.forEach((t, k) => E.text(t, x + 54, ry + 24 + (ls.length + ns.length + k) * 16, { size: 14, weight: '600', align: 'left', color: '#8a8f99' }));
    ry += hs[i];
  });
  E.text('Tap for how the deal works', E.w / 2, y + h - 14, { size: 14, weight: '800', color: '#ffd24a' });
}
// What the next grade up needs, for the "?" page; nothing after an S
function nextUp(g) {
  const up = { C: 'B', B: 'A', A: 'S' }[g];
  if (!up) return '';
  const rung = (r) => { const n = hitsAllowed(r), h = n ? `at most ${n} hit${n === 1 ? '' : 's'}` : 'no hits'; return r.good ? `${h} and ${r.good} good moves` : h; };
  return `${up}: ${TUNING.grade[up].map(rung).join(', or ')}.`;
}
// The "?", third page: what the grade card used to carry: the bout's counts, the gold and where it came from, the purse, the deal's odds, your gear and
// what the fight's bars are called
function drawBoutHelp(ctx, E, d) {
  const w = Math.min(E.w - 32, 620), x = (E.w - w) / 2, tw = w - 28, t = d.tally, o = TUNING.draft.odds[d.grade], sure = TUNING.draft.sure[d.grade] || 0, ep = freeEpic(), pct = o.map((v) => Math.round(v / (o[0] + o[1]) * 100)), g = d.gold;
  const thrown = g ? g.items.filter((e) => e[0] !== 'fell' && e[0] !== 'every win pays') : [], tsum = thrown.reduce((a2, e) => a2 + e[1], 0), pays = g ? (g.items.find((e) => e[0] === 'every win pays') || [0, 0])[1] : 0;
  const rows = [
    [`${t.slot} gap hits  \u00b7  ${t.read} fakes spotted  \u00b7  ${t.pun} punishes  \u00b7  ${t.taken} hits taken`, '#e2e8f0'],
    ...(g ? [[`+${g.sum} gold (fell ${g.sum - tsum - pays}${tsum ? `, the crowd threw ${tsum}: ${thrown.map((e) => `${e[0]} ${e[1]}`).join(', ')}` : ''}${pays ? `, Every Win Pays ${pays}` : ''})`, '#fbbf24']] : []),
    [`Purse ${state.gold}  \u00b7  Grade ${d.grade}: Common ${pct[0]}% \u00b7 Rare ${pct[1]}%${ep ? ` \u00b7 Epic ${Math.round(ep * 100)}% a card` : ''}${sureEpic(d.grade) ? ' \u00b7 at least 1 Epic' : sure ? ` \u00b7 at least ${sure} Rare` : ''}`, '#fbbf24'],
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
  E.text('Tap for what you wear', E.w / 2, y + h - 12, { size: 14, weight: '800', color: '#ffd24a' });
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
};
// A card whose rule needs his armour keeps its own line against a beast, with a muted note under it
const ARMOUR_CARDS = ['heavy', 'brawler', 'breaker', 'butcher'];
function beastNext(bare = false) {
  const d = state.gauntlet && state.gauntlet[state.draft || state.tent ? state.rack + 1 : state.rack], is = (q) => !!q && !!q.beast && !(bare && q.armour);
  return !!d && (is(d) || is(d.pair));
}
const cardLine = (c) => (BEAST_LINE[c.id] && beastNext() ? BEAST_LINE[c.id] : c.line);
const beastNote = (c) => (ARMOUR_CARDS.includes(c.id) && beastNext(true) ? 'No use against a beast: it wears no armour.' : '');
// The armourer's tent: your purse, three wares to buy (tap one), and Skip (Leave once you have bought)
export function drawTent(ctx, E) {
  const tt = state.tent, top = E.safe.top + 20, ready = tt.t > TUNING.draft.delay;
  ctx.fillStyle = 'rgba(10,8,14,0.86)'; ctx.fillRect(0, 0, E.w, E.h);
  E.text("THE ARMOURER'S TENT", E.w / 2, top, { size: 22, weight: '800', color: '#e6c866' });
  sayLine(ctx, E, 'Old Brutus: “Spend it here. Gold buys nothing in the sand.”', E.w / 2, top + 26, E.w - 32, { size: 14, weight: '700', color: '#fde68a' }, 'brutus');
  E.text(`Your purse: ${state.gold} gold`, E.w / 2, top + 50, { size: 16, weight: '800', color: '#fbbf24' });
  const KR = TUNING.knives.row[0] + 8, n = tt.wares.length, gap = 14, w = Math.min(200, (E.w - 32 - E.safe.left - E.safe.right - gap * (n - 1)) / n), y = top + 68, h = Math.min(170, E.h - E.safe.bottom - y - 70 - KR), x0 = (E.w - (w * n + gap * (n - 1))) / 2;
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
  const any = tt.wares.some((q) => q.sold) || tt.kn > 0;
  tt.krow = tentKnives(ctx, E, y + h + 8, ready);
  tt.skip = E.button(any ? 'Leave' : 'Skip', E.w / 2, Math.min(E.h - E.safe.bottom - 30, y + h + KR + 34), { w: 170, h: 48, size: 18, fill: any ? '#b45309' : '#334155' });
}
// The bandages before the champion, in the tent's look: Brutus, your purse, your hearts (the missing ones dark), one bandage to tap for each heart, and
// Skip (Fight on once you have bought)
export function drawBandage(ctx, E) {
  const tt = state.tent, top = E.safe.top + 20, ready = tt.t > TUNING.draft.delay, price = TUNING.tent.bandage, full = state.hp >= state.maxHp, short = !full && state.gold < price;
  ctx.fillStyle = 'rgba(10,8,14,0.86)'; ctx.fillRect(0, 0, E.w, E.h);
  E.text('BANDAGES', E.w / 2, top, { size: 22, weight: '800', color: '#e6c866' });
  // step 20: under half your hearts, Brutus nudges you and the bandage row glows (nothing is bought for you)
  const nudge = !full && state.hp < state.maxHp * TUNING.tent.nudge;
  sayLine(ctx, E, nudge ? 'Old Brutus: “Patch yourself up. He won\u2019t wait.”' : `Old Brutus: “The champion is next. Mend first: ${price} gold a heart.”`, E.w / 2, top + 26, E.w - 32, { size: nudge ? 16 : 14, weight: nudge ? '800' : '700', color: '#fde68a', fit: true }, 'brutus');
  E.text(`Your purse: ${state.gold} gold`, E.w / 2, top + 50, { size: 16, weight: '800', color: '#fbbf24' });
  const n = state.maxHp, hs = Math.min(26, (E.w - 64) / n), hy = top + 78;
  for (let i = 0; i < n; i++) drawHeart(ctx, E.w / 2 + (i - (n - 1) / 2) * hs, hy, Math.min(22, hs - 3), i < state.hp ? '#ef4444' : '#3b2a2e');
  const KR = TUNING.knives.row[0] + 8, w = Math.min(240, E.w - 64), h = Math.min(120, E.h - E.safe.bottom - hy - 96 - KR), x = (E.w - w) / 2, y = hy + 22;
  if (nudge && ready) {
    const k = 0.5 + 0.5 * Math.sin(tt.t * 5);
    ctx.save(); ctx.shadowColor = '#ffd24a'; ctx.shadowBlur = 14 + 12 * k; E.roundRect(x - 4, y - 4, w + 8, h + 8, 17, null, `rgba(255,210,74,${0.6 + 0.4 * k})`); ctx.restore();
  }
  ctx.globalAlpha = !ready ? 0.6 : full || short ? 0.5 : 1;
  E.roundRect(x, y, w, h, 14, nudge ? '#3a2a14' : '#2a2016', full ? '#4ade80' : nudge ? '#ffd24a' : '#c4b99a');
  const r = Math.min(20, h * 0.18);
  drawWare(ctx, 'heart', x + w / 2, y + 12 + r, r);
  E.text(full ? 'Mended' : 'A bandage', x + w / 2, y + 26 + 2 * r, { size: 17, weight: '800', color: '#f0e6cc' });
  E.text(full ? 'Your hearts are full' : '+1 heart, up to your max', x + w / 2, y + 46 + 2 * r, { size: 14, weight: '600', color: '#cbd5e1' });
  E.text(full ? `${tt.bought} bought` : `${price} gold`, x + w / 2, y + h - 14, { size: 14, weight: '800', color: full ? '#4ade80' : short ? '#9aa4b2' : '#ffd24a' });
  ctx.globalAlpha = 1;
  tt.btns = [{ x, y, w, h }];
  tt.krow = tentKnives(ctx, E, y + h + 8, ready);
  const any = tt.bought || tt.kn > 0;
  tt.skip = E.button(any ? 'Fight on' : 'Skip', E.w / 2, Math.min(E.h - E.safe.bottom - 30, y + h + KR + 34), { w: 170, h: 48, size: 18, fill: any ? '#b45309' : '#334155' });
}
// ----- the card lab (dev channel only): hold any cards before a bout, start it with full Momentum, add gold -----
export const labTab = (E) => ({ x: E.w - E.safe.right - 82, y: E.safe.top + 4, w: 72, h: 44 });
function labLayout(E) {
  const cols = Math.max(9, Math.ceil(DECK.length / 7)), gap = 4, x0 = 16 + E.safe.left, top = E.safe.top + 34, cw = (E.w - 32 - E.safe.left - E.safe.right - gap * (cols - 1)) / cols, rows = Math.ceil(DECK.length / cols);
  const ch = Math.max(44, Math.min(52, (E.h - E.safe.bottom - top - 64) / rows - gap));
  const cells = DECK.map((c, i) => ({ c, x: x0 + (i % cols) * (cw + gap), y: top + Math.floor(i / cols) * (ch + gap), w: cw, h: ch }));
  const by = Math.min(E.h - E.safe.bottom - 28, top + rows * (ch + gap) + 28), bw = Math.min(150, (E.w - 64) / 4);
  const btn = (k, i, label) => ({ k, label, x: E.w / 2 + (i - 1.5) * (bw + 10) - bw / 2, y: by - 22, w: bw, h: 44 });
  return { cells, btns: [btn('mom', 0, state.labMom ? 'Full Momentum: on' : 'Full Momentum: off'), btn('gold', 1, '+100 gold'), btn('clear', 2, 'Clear'), btn('done', 3, 'Done')] };
}
export function drawLab(ctx, E) {
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
export function labTap(E, p) {
  const L = labLayout(E), q = L.cells.find((r) => E.hit(r, p)), b = L.btns.find((r) => E.hit(r, p));
  if (q) applyCard(q.c, !has(q.c.id));
  else if (b && b.k === 'mom') state.labMom = !state.labMom;
  else if (b && b.k === 'gold') state.gold += 100;
  else if (b && b.k === 'clear') for (const id of state.picks.slice()) applyCard(CARD[id], false);
  else if (b && b.k === 'done') { state.lab = null; saveRun(E); }
  E.audio.play('tap');
}
// The run's one token: Respin on the fighter card, Reroll on a draft. Lit with "1 left" while it is unspent, grey once spent (a draft's Reroll writes the count only from two up; the "?" has it).
export function tokenButton(E, label, cx, cy, n, on = true, sub = null, w = 170) {
  const left = n > 0, live = left && on, h = 48, x = cx - w / 2, y = cy - h / 2;
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
// his type's painted helmet (gm: his GTYPE's helm), the chest plate (its lower half on a plated belly, one plate over both), the manica, the greaves; his gaps and guards
// are painted as a painted man's (kitSlot, kitGuard). No flat box or circle is drawn over the painted body.
function kitIcon(ctx, parts, s, str, gm, pose = null) {
  const K = TUNING.kit, t = kitTier(str), on = (id) => parts.some((q) => q.d.id === id && q.armour), head = parts.find((q) => q.d.id === 'head'), hk = KIT_HELM[gm] || 'gallic';
  const kh = on('head') && helmArt(hk), Hd = kitPic('head'), T = kitPic('torso', t), U = kitPic('upperarm', t), F = kitPic('forearm', t), Th = kitPic('thigh', t), Sh = kitPic('shin', t);
  if (!Hd || !T || !U || !F || !Th || !Sh) return false;
  const hx = (head ? head.d.x : 0) * s, G = on('legs') && gearPic('greave'), PL = gearPic('plate'), M = gearPic('manica'), B = PARTS[pidx('belly')], bw = B.w * s;
  (pose ? pose.legs : LEGS).forEach(([hip, knee, ank]) => {
    const P = (q) => [q[0] * s, q[1] * s];
    drawSeg(ctx, Th, P(hip), P(knee), K.leg * s); drawSeg(ctx, Sh, P(knee), P(ank), K.leg * s);
    if (G) drawSeg(ctx, G, P(lerp2(knee, ank, G.J.from)), P(lerp2(knee, ank, G.J.to)), K.leg * s);
  });
  kitTorso(ctx, T, K.neck * s, K.belt * s, bw);
  // the plate cut at the waist as the fight cuts it into the chest's and the belly's sprites
  if (PL && plateBoth(parts)) torsoPlate(ctx, PL, s, bw * T.J.k, 'both', (B.y + B.h / 2) * s, { P: T, w: bw });
  else for (const id of PL ? ['chest', 'belly'] : []) {
    if (!on(id)) continue;
    const big = 4 * s, cut = K.cut * s;
    ctx.save(); ctx.beginPath(); if (id === 'chest') ctx.rect(-big, cut - big, 2 * big, big); else ctx.rect(-big, cut, 2 * big, big); ctx.clip();
    torsoPlate(ctx, PL, s, bw * T.J.k, id, (B.y + B.h / 2) * s, { P: T, w: bw });
    ctx.restore();
  }
  // the hero pose tips the head back about the chin, chin up
  const ht = pose ? [hx - Math.sin(pose.chin) * (K.chin - K.top) * s, K.chin * s - Math.cos(pose.chin) * (K.chin - K.top) * s] : [hx, K.top * s];
  if (!(kh && kh.J.closed)) drawSeg(ctx, Hd, ht, [hx, K.chin * s], 0);
  if (kh) drawSeg(ctx, kh, ht, [hx, K.chin * s], 0);
  if (pose) { heroArms(ctx, parts, s, pose, U, F, M, gm); return true; }
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
// Step 15, the menu's hero pose (TUNING.menu.hero): each arm's shoulder, elbow and fist (body units) from its two angles off hanging; the shield
// arm's kind of shield is his type's, as in the fight
const heroDir = (a) => [Math.sin(a), Math.cos(a)];
export function heroArm(id, a1, a2) {
  const j = PARTS[pidx(id)].joint, S = [j[0] + (id === 'armF' ? 0.11 : -0.11), j[1]], el = ARM_LEN / 2, d1 = heroDir(a1), d2 = heroDir(a2);
  const El = [S[0] + d1[0] * el, S[1] + d1[1] * el];
  return { S, E: El, F: [El[0] + d2[0] * el, El[1] + d2[1] * el] };
}
const heroShield = (gm) => KIT_SHIELD[gm] || 'round';
export function heroPose(weaponId) {
  const M = TUNING.menu.hero, long = M.longIds.includes(weaponId), w = long ? M.long : M.over;
  return { ...M, id: long ? 'long' : 'over', weapon: w, near: heroArm('armF', w[0], w[1]), farArm: heroArm('armB', M.far[0], M.far[1]) };
}
// the far arm (its manica on the forearm) with the painted shield face on at its fist (none at pose.shield 0), then the weapon arm raised; the weapon is the menu's to draw
function heroArms(ctx, parts, s, pose, U, F, M, gm) {
  const P = (q) => [q[0] * s, q[1] * s], seg = (A, q) => { const w = q.d.w * s; drawSeg(ctx, U, P(A.S), P(A.E), w); drawSeg(ctx, F, P(A.E), P(A.F), w); if (q.armour && M) drawSeg(ctx, M, P(A.E), P(lerp2(A.E, A.F, M.J.to)), w); };
  const fq = parts.find((q) => q.d.id === 'armB'), nq = parts.find((q) => q.d.id === 'armF');
  if (fq) seg(pose.farArm, fq);
  const kind = heroShield(gm), SP = shieldPic(kind), r = pose.shield * s, TL = TUNING.kit.tall;
  if (SP && r > 0) {
    const k = SP.J.h ? r * TL[0] / SP.J.h : r / SP.J.r, w = SP.J.size[0] * k, h = SP.J.size[1] * k, [fx, fy] = P(pose.farArm.F);
    ctx.drawImage(SP.im, fx - w / 2, fy - h / 2, w, h);
  }
  if (nq) seg(pose.near, nq);
}
// the painted figure, painted once into a sprite per look, size, screen and art version, so a card blits it each frame; null until its art loads
const ICONS = new Map();
export function kitIconSprite(E, parts, s, str, gm, pose = null) {
  const k = Math.min(E.dpr || 1, TUNING.skin.maxDpr), B = pose ? TUNING.menu.hero.icon : TUNING.kit.iconBox;
  const key = `${s}|${kitTier(str)}|${gm}|${k}|${artV}|${pose ? pose.id : ''}|${parts.map((q) => `${q.d.id}${q.armour ? 1 : 0}${q.guard ? 'g' : ''}`).join(',')}`;
  let sp = ICONS.get(key);
  if (!sp) {
    const A = dollArt(parts, str, gm);
    if (pose) A.extra.push(`kit-shield-${heroShield(gm)}`);
    if (!artReady(A)) return null;
    const x = B[0] * s, y = B[1] * s, w = (B[2] - B[0]) * s, h = (B[3] - B[1]) * s, cv = new OffscreenCanvas(Math.ceil(w * k), Math.ceil(h * k)), c = cv.getContext('2d');
    c.imageSmoothingQuality = 'high'; c.scale(k, k); c.translate(-x, -y);
    if (!kitIcon(c, parts, s, str, gm, pose)) return null;
    sp = { cv, x, y, w, h };
    if (ICONS.size > 24) ICONS.clear();
    ICONS.set(key, sp);
  }
  return sp;
}
export function armourIcon(ctx, E, parts, x, y, s, str = 0, gm = null) {
  ctx.save(); ctx.translate(x, y);
  // a body part that failed to load leaves the drawn doll
  if (str && kitOn() && !dollArt(parts, str, gm).body.some((n) => artState(n) === 'bad')) {
    const sp = canSprite && kitIconSprite(E, parts, s, str, gm);
    if (sp) ctx.drawImage(sp.cv, sp.x, sp.y, sp.w, sp.h);
    // while the paint loads the card shows no figure for a frame or two, never the flat blocks
    if (!sp && !canSprite) kitIcon(ctx, parts, s, str, gm);
    ctx.restore(); return;
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
export function weaponIcon(ctx, d, x, y, s) {
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
export function keyIcon(ctx, x, y, len) {
  ctx.save(); ctx.strokeStyle = '#e6c866'; ctx.fillStyle = '#e6c866'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x + len * 0.15, y, len * 0.15, 0, TAU); ctx.stroke();
  line(ctx, x + len * 0.3, y, x + len, y); ctx.fillRect(x + len * 0.78, y, len * 0.08, len * 0.22); ctx.fillRect(x + len * 0.92, y, len * 0.08, len * 0.16);
  ctx.restore();
}
// the wooden sword of freedom, lying flat, with a notch for each fell (painted, step 14: cut across its blade)
function woodSword(ctx, x, y, len, n) {
  const J = TUNING.kit.weapon.wooden, L = J.pin * len / J.size[1], blade = paintWeapon(ctx, 'wooden', [x + len * 0.8 - L, y], [1, 0], L, len);
  if (blade) {
    ctx.save(); blade(); ctx.clip(); ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = 2;
    for (let i = 0; i < n; i++) line(ctx, x + 10 + i * 9, y - 6, x + 13 + i * 9, y + 2);
    ctx.restore(); return;
  }
  ctx.fillStyle = '#8a5a2b'; ctx.fillRect(x, y - 4, len * 0.72, 8);
  ctx.beginPath(); ctx.moveTo(x + len * 0.72, y - 4); ctx.lineTo(x + len * 0.8, y); ctx.lineTo(x + len * 0.72, y + 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5e3e1e'; ctx.fillRect(x - 4, y - 9, 5, 18); ctx.fillRect(x - len * 0.2, y - 3, len * 0.2 - 4, 6);
  ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = 2;
  for (let i = 0; i < n; i++) line(ctx, x + 10 + i * 9, y - 4, x + 13 + i * 9, y + 1);
}
// the font size that fits a line into w px, never larger than size
export function fitSize(ctx, t, size, w, weight = '800') {
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  return Math.max(14, Math.floor(size * Math.min(1, w / ctx.measureText(t).width)));
}
// text wrapped to lines no wider than w px at this font
export function wrapPx(ctx, t, w, size, weight = '600') {
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
// ----- step 20, the slim bout card: six things and a "?" -----
// A name in stamped metal: Roman capitals, wide letter spacing, a soft shadow, a dark edge, the metal's gradient and a light edge along its top (as the
// menu's title); painted once per name, size, metal and screen into a sprite
const METAL = { bronze: ['#fff0c4', '#e4b264', '#a8742c', '#6a4516'], gold: ['#fffbe0', '#ffe27a', '#d4a017', '#7a5a08'], blood: ['#ffd6cc', '#f0614f', '#a61b1b', '#4a0a0a'] };
const NAME_SPR = new Map();
const romanFont = (size) => `700 ${size}px Georgia, 'Times New Roman', serif`;
function nameWidth(ctx, t, size) { ctx.font = romanFont(size); return ctx.measureText(t).width + (t.length - 1) * size * TUNING.card.spacing; }
function paintName(c, t, x, y, size, metal) {
  const M = METAL[metal], gap = size * TUNING.card.spacing, ch = [...t];
  c.font = romanFont(size); c.textBaseline = 'middle'; c.textAlign = 'left'; c.lineJoin = 'round';
  const ws = ch.map((q) => c.measureText(q).width), tw = ws.reduce((a, q) => a + q, 0) + gap * (ch.length - 1);
  const each = (fn) => { let xx = x - tw / 2; ch.forEach((q, i) => { fn(q, xx); xx += ws[i] + gap; }); };
  c.save(); c.shadowColor = 'rgba(0,0,0,0.75)'; c.shadowBlur = size * 0.18; c.shadowOffsetY = size * 0.07; c.fillStyle = M[3]; each((q, xx) => c.fillText(q, xx, y)); c.restore();
  c.lineWidth = Math.max(2, size * 0.09); c.strokeStyle = '#1a0f04'; each((q, xx) => c.strokeText(q, xx, y));
  const g = c.createLinearGradient(0, y - size * 0.42, 0, y + size * 0.42);
  g.addColorStop(0, M[0]); g.addColorStop(0.38, M[1]); g.addColorStop(0.62, M[2]); g.addColorStop(1, M[3]);
  c.fillStyle = g; each((q, xx) => c.fillText(q, xx, y));
  c.lineWidth = 1; c.strokeStyle = 'rgba(255,240,200,0.55)'; each((q, xx) => c.strokeText(q, xx, y - 1));
}
// the name centred on (cx, cy), shrunk until it fits maxW; returns the size drawn
function stampName(ctx, E, t, cx, cy, size, metal, maxW) {
  while (size > 16 && nameWidth(ctx, t, size) > maxW) size--;
  if (!canSprite) { paintName(ctx, t, cx, cy, size, metal); return size; }
  const k = Math.min(E.dpr || 1, TUNING.skin.maxDpr), key = `${t}|${size}|${metal}|${k}`;
  let sp = NAME_SPR.get(key);
  if (!sp) {
    const w = Math.ceil(nameWidth(ctx, t, size) + size), h = Math.ceil(size * 1.7), cv = new OffscreenCanvas(Math.ceil(w * k), Math.ceil(h * k)), c = cv.getContext('2d');
    c.scale(k, k); paintName(c, t, w / 2, h / 2, size, metal);
    sp = { cv, w, h };
    if (NAME_SPR.size > 16) NAME_SPR.clear();
    NAME_SPR.set(key, sp);
  }
  ctx.drawImage(sp.cv, cx - sp.w / 2, cy - sp.h / 2, sp.w, sp.h);
  return size;
}
// a line of coloured pieces at x (left, or centred when center), joined by sep, at the largest size from size down to 14 that fits w; past that the last
// piece is cut
function segLine(ctx, E, segs, x, y, w, size, o = {}) {
  const sep = o.sep ?? ' \u00b7 ', wt = o.weight || '800', parts = segs.filter((q) => q && q[0]);
  const width = (sz) => { ctx.font = `${wt} ${sz}px system-ui, sans-serif`; return parts.reduce((a, q, i) => a + ctx.measureText(q[0]).width + (i ? ctx.measureText(sep).width : 0), 0); };
  let sz = size; while (sz > 14 && width(sz) > w) sz--;
  if (width(sz) > w && parts.length) { const last = parts[parts.length - 1], rest = width(sz) - (ctx.font = `${wt} ${sz}px system-ui, sans-serif`, ctx.measureText(last[0]).width); parts[parts.length - 1] = [clipLine(ctx, last[0], Math.max(20, w - rest), sz, wt), last[1]]; }
  let xx = o.center ? x - Math.min(w, width(sz)) / 2 : x;
  ctx.font = `${wt} ${sz}px system-ui, sans-serif`;
  parts.forEach((q, i) => {
    if (i) { E.text(sep, xx, y, { size: sz, weight: wt, align: 'left', color: '#8a8f99' }); xx += ctx.measureText(sep).width; }
    E.text(q[0], xx, y, { size: sz, weight: wt, align: 'left', color: q[1] }); ctx.font = `${wt} ${sz}px system-ui, sans-serif`; xx += ctx.measureText(q[0]).width;
  });
}
const titleCase = (t) => t.toLowerCase().replace(/(^|[\s-])\S/g, (c) => c.toUpperCase());
const SIG_TITLE = { rage: 'Red Rage', capuan: 'Capuan Feint', blink: 'Blink', throw: "Huntress's Throw", twin: 'Two Blades' };
// his weapon as the threat line names it, and his style (his profile's line, without its stop)
const weaponWord = (d) => titleCase(d.beast ? BEASTS[d.beast].name : (d.weapon.alt && d.mace ? d.weapon.alt : d.weapon.name).split(' & ')[0]);
const styleOf = (d) => (PROFILES[d.prof] || PROFILES.balanced).line.replace(/\.$/, '');
// 3. one threat line: size, weapon and style; two blades, a shield or a beast's barding as one word
const threatSegs = (d) => [[titleCase(d.size.name), '#fde68a'], [weaponWord(d), '#f0e6cc'], [d.beast ? (d.armour ? 'Barded' : '') : d.dual ? 'Dual' : d.shield ? 'Shield' : '', '#f0e6cc'], [styleOf(d), '#cbd5e1']];
// 5. the watch-for line: a champion's signature by name only (never how to answer it), else the first of his gear that acts, in red, else nothing
function watchSegs(fs) {
  for (const f of fs) { const C = sigOf(f); if (C) return [['Signature:', '#c4b99a'], [SIG_TITLE[C.sig], '#fca5a5']]; }
  for (const f of fs) { const c = (f.gear || []).map((id) => CARD[id]).find((q) => FOE_TELL[q.id]); if (c) return [[`${c.gear}:`, '#f87171'], [FOE_TELL[c.id](), '#fca5a5']]; }
  return null;
}
// your reason's thread, folded into Brutus's line in a few words (revenge climbs in his lines already)
function threadShort() {
  const me = state.me, n = state.felled, left = Math.max(0, state.gauntlet.length - n);
  if (me.reason === 'debt') return `${denarii(debtLeft())} owed.`;
  if (me.reason === 'freedom') return `Notches: ${n}.`;
  if (me.reason === 'promise') return left > 1 ? `${left} fights to her.` : 'Her door.';
  if (me.reason === 'glory') return `They chant ${me.name.toUpperCase()}!`;
  return state.rack === 0 ? REVENGE.intro[0] : '';
}
// 6. one voice: the champion's or your rival's taunt, else Old Brutus with the thread when it fits one line
function voiceOf(ctx, d0, f, w) {
  const me = state.me;
  if (d0.rival || f.champion) return { who: f.name.split(/[ ,]/)[0], t: d0.rival ? tauntOf(me) : champLine(f, me.reason) };
  const b = brutusIntro(), th = threadShort(), full = th ? `Old Brutus: \u201c${b} ${th}\u201d` : '';
  ctx.font = '700 14px system-ui, sans-serif';
  return { t: full && ctx.measureText(full).width <= w - (brutusFaceOn() ? TUNING.art.faceCard + 8 : 0) ? full : `Old Brutus: \u201c${b}\u201d` };
}
// a figure's open gaps glow and its guarded gaps are ringed in gold, at its centres (cs: [x, y, half width, half height, guarded])
function gapGlow(ctx, cs) {
  const C = TUNING.card, k = 0.65 + 0.35 * Math.sin(state.introT * 5);
  ctx.save();
  for (const [x, y, rw, rh, g] of cs) {
    if (g) { ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(x, y, rw + 3, rh + 3, 0, 0, TAU); ctx.stroke(); continue; }
    const r = Math.max(rw, rh), R = r * C.glow * (0.9 + 0.2 * k), gr = ctx.createRadialGradient(x, y, 0, x, y, R);
    gr.addColorStop(0, `rgba(255,200,100,${0.9 * k})`); gr.addColorStop(0.45, `rgba(255,150,60,${0.45 * k})`); gr.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}
// a man's figure on the card (his plates painted, as the fight's), feet at (x, y), s px a body unit, its gaps lit
function manFigure(ctx, E, f, parts, x, y, s) {
  armourIcon(ctx, E, parts, x, y, s, f.str, GTYPE[f.weapon.id].helm);
  gapGlow(ctx, parts.filter((q) => q.slot).map((q) => {
    const p = q.d, j = p.frame ? PARTS[pidx(p.frame)].joint : [0, 0], side = p.frame === 'armF' ? 0.11 : 0;
    return [x + (j[0] + side + p.x) * s, y + (j[1] + p.y) * s, p.w * s / 2, p.h * s / 2, !!q.guard];
  }));
}
function beastFigure(ctx, E, f, x, y, w) {
  const { F, ic } = beastIcon(ctx, E, f, x, y, w);
  gapGlow(ctx, ic.parts.filter((p) => p.slot).map((p) => { const [px, py] = partCenter(F, ic, p); const r = (p.d.r || Math.max(p.d.w || 0.05, p.d.h || 0) / 2) * F.H; return [px, py, r, r, false]; }));
}
// The slim card (step 20): 1. the header, 2. his name in stamped metal (the champion's bust beside it), 3. the threat line, 4. his figure with its gaps
// lit, 5. the watch-for line, 6. one voice; then "Tap to fight", and the "?" for the full card. A pair shows both men, a beast its body.
function drawSlim(ctx, E) {
  const Cd = TUNING.card, f = state.foe, q = state.edge, d0 = state.gauntlet[state.rack], me = state.me, last = state.rack === state.gauntlet.length - 1;
  const w = Math.min(E.w - 32, Cd.w), h = Math.min(E.h - 12, Cd.h + cardGrow()), x = (E.w - w) / 2, y = (E.h - h) / 2, cx = E.w / 2;
  const champ = f.champion || d0.champion, rival = !!d0.rival, metal = rival ? 'blood' : champ ? 'gold' : 'bronze';
  ctx.fillStyle = 'rgba(10,8,14,0.6)'; ctx.fillRect(0, 0, E.w, E.h);
  E.roundRect(x, y, w, h, 18, '#221a2b', rival ? '#f87171' : champ ? '#ffd24a' : f.beast && !q ? '#fb923c' : '#e6c866');
  // 1
  const of = `BOUT ${state.rack + 1} OF ${state.gauntlet.length}`, extra = q ? 'PAIRS' : f.beast ? 'A BEAST' : bout().spar ? 'SPARRING' : '';
  const head = rival ? (last ? 'YOUR RIVAL' : `YOUR RIVAL  \u00b7  ${of}`) : champ ? (last ? 'THE CHAMPION' : `A CHAMPION  \u00b7  ${of}`) : extra ? `${of}  \u00b7  ${extra}` : of;
  E.text(head, cx, y + 20, { size: 14, weight: '800', color: rival ? '#f87171' : champ ? '#ffd24a' : f.beast && !q ? '#fb923c' : '#c4b99a' });
  // 2
  const name = (q ? f.title || d0.title || `${f.name} and ${q.beast ? beastTitle(q) : q.name}` : f.beast ? beastTitle(f) : f.name).toUpperCase();
  const bw = champ ? champBust(ctx, E, f, x, y) : 0, lr = metal === 'gold' ? Cd.laurel : 0;
  const ns = stampName(ctx, E, name, cx, y + 54, Cd.name, metal, w - 40 - 2 * bw - 4 * lr - 16);
  if (lr) { const nw = nameWidth(ctx, name, ns) / 2 + lr + 10; laurel(ctx, cx - nw, y + 56, lr); laurel(ctx, cx + nw, y + 56, lr); }
  // 4, on the right
  const fw = q ? 196 : f.beast ? Cd.beast + 8 : 150, fx = x + w - 16 - fw / 2, feet = y + 200;
  if (q) {
    for (const [g, gx] of [[f, fx - fw / 4], [q, fx + fw / 4]]) {
      if (g.beast) beastFigure(ctx, E, g, gx, feet - 10, fw / 2 - 6); else manFigure(ctx, E, g, g.parts, gx, feet, Cd.pair * (g === q ? 0.92 : 1));
    }
  } else if (f.beast) beastFigure(ctx, E, f, fx, feet - 8, Cd.beast);
  else manFigure(ctx, E, f, guardParts(foeParts(makeRng(f.partSeed), f.set, f.plus || 0, dualGaps(f)), f.guards), fx, feet, Cd.fig);
  // 3 and 5, left of him
  const tx = x + 24, tw = fx - fw / 2 - 12 - tx;
  const threat = q ? [[`${titleCase(f.size.name)} ${weaponWord(f)}`, '#fde68a'], [`${titleCase(q.size.name)} ${weaponWord(q)}`, '#fde68a'], ['one at a time', '#cbd5e1']] : threatSegs(f);
  const watch = watchSegs(q ? [f, q] : [f]);
  const ty = watch ? y + 116 : y + 132;
  segLine(ctx, E, threat, tx, ty, tw, 18);
  if (watch) segLine(ctx, E, watch, tx, ty + 34, tw, 16, { sep: ' ', weight: '800' });
  // 6
  const v = voiceOf(ctx, d0, f, w - 28), vy = y + h - 64;
  if (v.who) { const vl = `${v.who}: \u201c${v.t}\u201d`; E.text(clipLine(ctx, vl, w - 28, Math.max(14, fitSize(ctx, vl, 15, w - 28)), '800'), cx, vy, { size: Math.max(14, fitSize(ctx, vl, 15, w - 28)), weight: '800', color: '#f87171' }); }
  else sayLine(ctx, E, v.t, cx, vy, w - 28, { size: 14, fit: true, weight: '700', color: '#fde68a' }, 'brutus', TUNING.art.faceCard);
  // the tap, and the "?" in the corner
  E.text('Tap to fight', cx, y + h - 22, { size: 16, weight: '800', color: '#ffd24a', alpha: tapLive() ? 0.6 + 0.4 * Math.sin(state.introT * 4) : 0.3 });
  const r = Cd.help / 2, qx = x + w - 12 - r, qy = y + h - 12 - r;
  state.introQ = { x: qx - r - 2, y: qy - r - 2, w: 2 * r + 4, h: 2 * r + 4 };
  ctx.beginPath(); ctx.arc(qx, qy, r, 0, TAU); ctx.fillStyle = '#1f2937'; ctx.fill(); ctx.strokeStyle = '#c4b99a'; ctx.lineWidth = 2; ctx.stroke();
  E.text('?', qx, qy + 1, { size: 22, weight: '800', color: '#f0e6cc' });
}
// your trait and drive, one line each, on the "?" page
function youLines(ctx, E, cx, y, w) {
  const me = state.me, T = TRAITS[me.origin], D = DRIVES[me.reason];
  segLine(ctx, E, [[`${T.name}:`, '#86efac'], [T.line(), '#e2e8f0']], cx, y, w - 28, 14, { sep: ' ', weight: '700', center: true });
  segLine(ctx, E, [[`${D.name}:`, '#fbbf24'], [D.line(), '#e2e8f0']], cx, y + 19, w - 28, 14, { sep: ' ', weight: '700', center: true });
}
// His card before each bout, in rows that never meet: the bout, his name and (champion) his tie to your reason, his armour on the left, size, weapon,
// its tip and stats on the right, your reason's thread, Brutus, what the champion or your rival says, and the tap.
// Step 20: the bout card is slim (drawSlim); its "?" shows the full card that was (drawIntroFull), with your trait and drive where Brutus stood
export function drawIntro(ctx, E) {
  if (state.introHelp) { drawIntroFull(ctx, E); return; }
  drawSlim(ctx, E);
}
function drawIntroFull(ctx, E) {
  if (state.edge) { drawPairIntro(ctx, E); return; }
  if (state.foe.beast) { drawBeastIntro(ctx, E); return; }
  const d = state.foe, me = state.me, champ = d.champion, spar = bout().spar;
  const sub = champ ? champTie(d, me.reason) : spar ? 'Sparring: learn his wind-ups.' : null;
  const gear = (d.gear || []).map((id) => CARD[id]), thread = me.reason !== 'revenge', b = sub ? 88 : 68, bodyH = 152 + ((d.guards || []).length ? 12 : 0), tb = b + bodyH + (thread ? 32 : 6);
  const w = Math.min(E.w - 32, gear.length ? 640 : 480), h = Math.min(E.h - 12, tb + 22 + 20 + 34), x = (E.w - w) / 2, y = (E.h - h) / 2, cx = E.w / 2;
  ctx.fillStyle = 'rgba(10,8,14,0.6)'; ctx.fillRect(0, 0, E.w, E.h);
  E.roundRect(x, y, w, h, 18, '#221a2b', d.rival ? '#f87171' : champ ? '#ffd24a' : '#e6c866');
  const of = `BOUT ${state.rack + 1} OF ${state.gauntlet.length}`;
  E.text(d.rival ? `YOUR RIVAL  ·  THE CHAMPION  ·  ${of}` : champ ? `THE CHAMPION  ·  ${of}` : `${of}${spar ? '  ·  SPARRING' : ''}`, cx, y + 20, { size: 14, weight: '800', color: champ ? '#ffd24a' : '#c4b99a' });
  const name = d.name.toUpperCase(), bw = champBust(ctx, E, d, x, y);
  E.text(name, cx, y + 46, { size: fitSize(ctx, name, 30, w - 40 - 2 * bw), weight: '800', color: '#f0e6cc' });
  if (sub) E.text(sub, cx, y + 72, { size: bw ? fitSize(ctx, sub, 15, w - 2 * bw - 16) : 15, weight: '800', color: champ ? '#fca5a5' : '#7de3ff' });
  const lx = x + 80, s = 96;
  armourIcon(ctx, E, guardParts(foeParts(makeRng(d.partSeed), d.set, d.plus || 0, dualGaps(d)), d.guards), lx, y + b + 100, s, d.str, GTYPE[d.weapon.id].helm);
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
  wrapPx(ctx, WEAPON_TIP[d.weapon.id] + (d.dual ? ', two blades, no shield' : d.shield ? ', with shield' : ''), rw, 14).slice(0, 2).forEach((t, i) => E.text(t, rx, y + b + 30 + i * 16, { size: 14, align: 'left', color: '#9aa4b2' }));
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
  youLines(ctx, E, cx, y + tb + 12, w);
  E.text('Tap to go back', cx, y + h - 18, { size: 16, weight: '800', color: '#ffd24a' });
}
// A beast's card: what it is (a lion or a bear, its epithet), no shield and no feints, its body with its gaps on the left, its size and how its tells
// look, its profile and stats on the right, then the thread, Brutus and the tap.
function drawBeastIntro(ctx, E) {
  const d = state.foe, me = state.me, thread = me.reason !== 'revenge', b = 88, bodyH = 160, tb = b + bodyH + (thread ? 32 : 6);
  const w = Math.min(E.w - 32, 540), h = Math.min(E.h - 12, tb + 22 + 20 + 34), x = (E.w - w) / 2, y = (E.h - h) / 2, cx = E.w / 2;
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
  youLines(ctx, E, cx, y + tb + 12, w);
  E.text('Tap to go back', cx, y + h - 18, { size: 16, weight: '800', color: '#ffd24a' });
}
// a beast drawn small at rest on its card, w px from nose to tail, its feet at (x, y); its gaps show as on the sand
function beastIcon(ctx, E, d, x, y, w) {
  const B = TUNING.beasts[d.beast], s = w / (B.front + B.back + 0.08), ic = d.icon || (d.icon = { beast: d.beast, young: d.young, parts: beastParts(d.beast, !!d.armour) });
  beastRest(ic);
  const F = { x: x - (B.back - B.front) / 2 * s, y, a: 0, dir: -1, H: s };
  drawBeast(ctx, E, F, ic, 'edge');
  return { F, ic };
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
  const sub = champ ? champTie(a, me.reason) : 'Pairs: when one is out of breath or down, the other steps in.';
  const thread = me.reason !== 'revenge', b = 88, cw = (Math.min(E.w - 32, 640) - 48) / 2, ex = profFits(ctx, a, cw - 88) && profFits(ctx, q, cw - 88) ? 0 : 16, bodyH = 150 + ex, tb = b + bodyH + (thread ? 32 : 6);
  const w = Math.min(E.w - 32, 640), h = Math.min(E.h - 12, tb + 22 + 20 + 34), x = (E.w - w) / 2, y = (E.h - h) / 2, cx = E.w / 2;
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
  youLines(ctx, E, cx, y + tb + 12, w);
  E.text('Tap to go back', cx, y + h - 18, { size: 16, weight: '800', color: '#ffd24a' });
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
export function clipLine(ctx, t, w, size = 14, weight = '700') {
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  if (ctx.measureText(t).width <= w) return t;
  while (t.length > 2 && ctx.measureText(`${t}\u2026`).width > w) t = t.slice(0, -1);
  return `${t.trimEnd()}\u2026`;
}
export function miniCard(ctx, E, d, x, y, w, h, res) {
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

// ----- your fighter: the six wheels, the card, the purse, and the end-card mini -----
export const TIER_COL = { S: '#ffd24a', A: '#4ade80', B: '#7dd3fc', C: '#c4b99a', D: '#f87171' };
const SIZE_TIP = { runt: 'tiny, quick, short reach', lean: 'quick swing, short reach', medium: 'balanced', big: 'long reach, slow swing', giant: 'huge reach, slow swing' };
const STAT_COLS = ['#8b2e2e', '#a8642e', '#9a8c32', '#5f8f3e', '#2f7d6d'];
const shortOf = (e) => (typeof e[0] === 'number' ? `${e[0]}` : e[3] || (e[0].length > 1 ? e[2][0] : e[0]));

// ----- the wheel of fate (L8) -----
// Each slice's start and end, in radians clockwise from the pointer, for these weights (slice size is the odds).
export function sliceArcs(w) {
  const tot = w.reduce((a, q) => a + q, 0) || 1;
  let a = 0;
  return w.map((q) => { const s = a; a += q / tot * Math.PI * 2; return [s, a]; });
}
// where the pointer comes to rest on slice i: settle of the way across it from its leading peg (a thin slice, its middle); wheelRest is that turn
function restAt(w, i) { const [s, e] = sliceArcs(w)[i], wd = e - s; return s + wd * (wd < 0.3 ? 0.5 : TUNING.me.roll.settle); }
export const wheelRest = (w, i) => -restAt(w, i);
export const sliceCol = (wh, i) => (wh.cols || STAT_COLS)[i];
// One wheel, drawn by the game: a bronze rim with gold studs, gradient slices sized by their odds (names on the slices that have room), pegs between
// slices, a hub with the wheel's question and the ticker on top. o: rot (the wheel's turn), w (the slice weights, which may be mid-reshape), landed
// (the landed slice, or -1), names (the slices' names, on a big wheel), pop and flash (0 to 1, the landing), tick (the ticker's flick, radians), grow (per slice: +1 growing, -1 shrinking),
// quiet (no question on the hub).
// A small wheel (the card's strip) keeps the rim, slices, pegs and pointer only.
export function drawWheel(ctx, E, wh, cx, cy, r, o) {
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
  if (!small && !o.quiet) { const q = wh.q; E.text(q, cx, cy + 1, { size: Math.max(14, fitSize(ctx, q, 17, hr * 1.85)), weight: '800', color: '#ffd24a' }); }
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
export function spinRot(w, i, u) {
  const R = TUNING.me.roll, [s, e] = sliceArcs(w)[i], fin = restAt(w, i), tease = s + Math.min(R.peg, (e - s) * 0.15);
  const end = -fin + Math.PI * 2 * Math.ceil(R.turns + fin / (Math.PI * 2)), over = fin - tease;
  if (u < R.main) { const p = u / R.main; return (end + over) * (1 - Math.pow(1 - p, 3)); }
  const q = (u - R.main) / (1 - R.main);
  return end + over * Math.cos(q * Math.PI * 2.5) * Math.pow(1 - q, 2);
}
// pegs passed by the pointer between two turns of the wheel
export function pegsPassed(w, r0, r1) {
  const T = Math.PI * 2, n = (x, b) => Math.floor((x - b) / T);
  return sliceArcs(w).reduce((c, [s]) => c + Math.abs(n(-r0, s) - n(-r1, s)), 0);
}

// what your weapon is for, in one line
const MY_WEAPON_JOB = { fist: 'free: very fast, half the damage; never dents a plate', gladius: 'all-rounder: quick stabs, fair reach', spear: 'long reach: stab from range; slashes are weak', axe: 'slow and heavy: smashes break armour', dagger: 'short and fast: stabs into gaps do 4x',
  trident: 'longest reach, slow; a well-timed block nets him', sica: 'short and quick: slashes cut deep' };
// a weapon as the icon draws it: his table's, or your armoury weapon's drawn length
export const iconWeapon = (id) => TUNING.weapons.find((q) => q.id === id) || { id, len: TUNING.me.weapons[id].len };
// Step 14: a rack weapon (the purse's ids: the mace is its own) as drawn on a card, its painted length from butt to point in card units; and lying flat
// at s px a unit, centred on (x, y), point right, under the rack's names (none until its painting loads)
const rackWeapon0 = (id) => iconWeapon(id === 'mace' ? 'axe' : id);
const rackLen = (id) => { const J = TUNING.kit.weapon[id], W = rackWeapon0(id); return (W.len + J.tip) * J.size[1] / (J.pin - (J.top || 0)); };
// lit: its striking parts lit by kind over a dimmed haft, the painting's box centred on (x, y) (step 21; false while the lit picture is not made)
function rackWeapon(ctx, id, x, y, s, lit = false) {
  const J = TUNING.kit.weapon[id], L = (rackWeapon0(id).len + J.tip) * s, l = rackLen(id) * s, A = [x - l / 2 + l * (1 - J.pin / J.size[1]), y];
  const Z = lit && kitOn() && zonePic(id);
  if (Z) {
    const k = L / (J.pin - (J.top || 0));
    A[1] = y - (J.size[0] / 2 - J.x) * k;
    ctx.save(); ctx.transform(0, k, -k, 0, A[0] + J.pin * k, A[1] - J.x * k); ctx.drawImage(Z, 0, 0, J.size[0], J.size[1]); ctx.restore();
    return;
  }
  ctx.save(); ctx.globalAlpha *= TUNING.kit.weapon.rackA;
  paintWeapon(ctx, id, A, [1, 0], L, s);
  ctx.restore();
}
// Your card, in three columns under the story and your start card: your body as yet unarmed, your size, hearts and stats, then your tier and the purse
// that buys your kit next (gold).
export function drawMeCard(ctx, E, me, x, y, w, h, gold) {
  const M = TUNING.me, S = M.sizes[me.size], noun = ORIGINS[me.origin].noun, scs = startCards(me), sc = scs[0], cx = x + w / 2;
  E.roundRect(x, y, w, h, 18, '#1d2a2a', me.vid ? '#ffd24a' : '#4ade80');
  // a veteran: the stat they gained and their scar, in gold
  const vt = me.vid ? `VETERAN${me.up ? `  ·  +${TUNING.ludus.vetUp} ${WHEELS[me.up].title}` : ''}  ·  ${me.scar}` : null;
  if (vt) E.text(vt, cx, y + 16, { size: fitSize(ctx, vt, 14, w - 28), weight: '800', color: '#ffd24a' });
  else E.text('YOUR FIGHTER', cx, y + 16, { size: 14, weight: '800', color: '#9fe3c6' });
  const st = storyLine(me);
  E.text(st, cx, y + 36, { size: Math.max(14, fitSize(ctx, st, 15, w - 28)), weight: '800', color: '#f0e6cc' });
  const pk = `${noun[0].toUpperCase()}${noun.slice(1)}: starts with ${scs.length > 1 ? `${sc.name} + ${scs[1].name}` : `${sc.name} (${FAMS[sc.fam].name})`}`;
  E.text(pk, cx, y + 56, { size: Math.max(14, fitSize(ctx, pk, 14, w - 28, '700')), weight: '700', color: '#86efac' });
  // step 19: your origin's trait and your reason's drive, a line each
  const TR = TRAITS[me.origin], DR = DRIVES[me.reason];
  segLine(ctx, E, [[`${TR.name}:`, '#86efac'], [TR.line(), '#cbd5e1']], cx, y + 76, w - 28, 14, { sep: ' ', weight: '700', center: true });
  segLine(ctx, E, [[`${DR.name}:`, '#fbbf24'], [DR.line(), '#cbd5e1']], cx, y + 94, w - 28, 14, { sep: ' ', weight: '700', center: true });
  const dy = 30, lw = w * 0.3, ax = x + 12 + lw / 2, s = Math.min(84, h * 0.3) * sizeOf(me.size, me.vary || 0).scale;
  armourIcon(ctx, E, playerParts({ plates: [] }), ax, y + 72 + dy + s * 0.95, s, me.str);
  E.text('NO KIT YET', ax, y + 174 + dy, { size: 14, weight: '800', color: '#aab3bc' });
  const mx = x + 18 + lw, mw = w * 0.36;
  E.text(S.name, mx, y + 84 + dy, { size: 20, weight: '800', align: 'left', color: '#fde68a' });
  ctx.font = '800 20px system-ui, sans-serif';
  E.text(`♥ ${me.halves} hearts`, mx + ctx.measureText(S.name).width + 12, y + 85 + dy, { size: 15, weight: '800', align: 'left', color: '#f87171' });
  E.text(SIZE_TIP[me.size], mx, y + 105 + dy, { size: 14, align: 'left', color: '#9aa4b2' });
  statBars(ctx, E, me, mx, y + 128 + dy, mw, 20, 14);
  // a veteran's gained point glows green on its bar
  if (me.vid && me.up) { const v = me[['', 'str', 'spd', 'sta'][me.up]], seg = (mw - 14 * 2.6) / 5; ctx.fillStyle = '#4ade80'; ctx.fillRect(mx + 14 * 2.6 + (v - 1) * seg, y + 128 + dy + (me.up - 1) * 20 - 14 * 0.35, seg - 3, 14 * 0.7); }
  const tx = mx + mw + 10, tw = x + w - 12 - tx, tc = TIER_COL[me.tier];
  ctx.strokeStyle = tc; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(tx + 24, y + 96 + dy, 22, 0, 6.28); ctx.stroke();
  E.text(me.tier, tx + 24, y + 98 + dy, { size: 28, weight: '800', color: tc });
  E.text('TIER', tx + 54, y + 88 + dy, { size: 14, weight: '800', align: 'left', color: '#c4b99a' });
  if (me.underdog) E.text('Underdog!', tx + 54, y + 105 + dy, { size: 14, weight: '800', align: 'left', color: '#ffd24a', alpha: 0.75 + 0.25 * Math.sin(E.time * 6) });
  E.text('PURSE', tx, y + 136 + dy, { size: 14, weight: '800', align: 'left', color: '#c4b99a' });
  E.text(`${gold} gold`, tx, y + 156 + dy, { size: fitSize(ctx, `${gold} gold`, 20, tw), weight: '800', align: 'left', color: '#fbbf24' });
  E.text(clipLine(ctx, 'for your kit', tw), tx, y + 176 + dy, { size: 14, align: 'left', color: '#c4b99a' });
}
// ----- the inventory (step 11): five slots around a small painted doll, and the Extras row -----
// Each slot: its card gear slot, its plate, the plain kit worn without one, and where its line meets the doll (body units, feet at 0). Head, Arms and
// Legs stand left of the doll, Chest and Weapon right.
const INV_SLOTS = [
  { id: 'head', name: 'HEAD', card: 'helmet', plate: 'helmet', plain: 'Leather cap', at: [0.03, -0.8] },
  { id: 'arms', name: 'ARMS', card: 'arms', plate: 'manica', plain: 'Leather wraps', at: [-0.15, -0.5] },
  { id: 'legs', name: 'LEGS', card: 'legs', plate: 'greaves', plain: 'Cloth wraps', at: [0, -0.2] },
  { id: 'chest', name: 'CHEST', card: 'chest', plate: 'chest', plain: 'Linen tunic', at: [0.04, -0.6] },
  { id: 'weapon', name: 'WEAPON', card: 'weapon', at: [0.16, -0.36] },
];
// the card pieces that keep their own slots, on the Extras row; each card slot's word on a draft card's chip
const EXTRAS = ['belt', 'cloak', 'shield'];
const SLOT_WORD = { helmet: 'Head', chest: 'Chest', arms: 'Arms', legs: 'Legs', weapon: 'Weapon', belt: 'Belt', cloak: 'Cloak', shield: 'Shield face' };
// what each plate does for you, in a few words under the purse's slot (step 23): a plate eases his blows at its height (ZONE_PART); the Arms slot's is
// a reinforced shield (step 24), and none with two blades
const PLATE_SAVES = { helmet: 'eases high blows', chest: 'eases mid blows', greaves: 'eases low blows', manica: 'shield lasts longer' };
// (squeezed beside the second blade's chip, "Reinforced / shield / lasts longer" reads on from the name)
const PLATE_SQUEEZED = { manica: 'lasts longer' };
const plateSaves = (k, me, squeezed = false) => (k === 'manica' && me.dual ? 'no shield' : (squeezed && PLATE_SQUEEZED[k]) || PLATE_SAVES[k]);
// plain kit is grey (Common), a plate a plain bronze; card gear takes its card's tier colour (rarCol)
const PLAIN_COL = '#a8adb5', PLATE_COL = '#d9a35e';
export const weaponTitle = (me) => (me.weapon === 'axe' ? (me.mace ? 'Mace' : 'Axe') : TUNING.me.wheels.weapon.find((e) => e[0] === me.weapon)[2]);
// The inventory in the box x, y, w, h. inv: me (weapon, mace, Strength and plates), gear (the card pieces by slot), buy (the purse: short(plate) when the purse cannot cover it, job: the chosen weapon's line). Returns each
// slot's rect (its plate's tap target in the purse).
function drawInventory(ctx, E, x, y, w, h, inv) {
  const { me, gear, buy } = inv, g = 8, ex = EXTRAS.some((k) => gear[k]), exH = ex ? 30 : 0;
  const rh = (h - exH - (ex ? g : 0) - 2 * g) / 3, dw = clamp(w * (buy && buy.dual ? 0.2 : 0.24), 76, 160), cw = (w - dw - 2 * g) / 2, rx = x + cw + dw + 2 * g, sd = !!(buy || me.side);
  // step 22: the Sidearm slot takes the Weapon slot's lower half, in the purse and whenever you carry one
  const box = { head: [x, y, rh], arms: [x, y + rh + g, rh], legs: [x, y + 2 * (rh + g), rh], chest: [rx, y, rh], weapon: [rx, y + rh + g, sd ? rh : 2 * rh + g], side: [rx, y + 2 * (rh + g), rh] };
  // the doll: your painted figure with the plates you wear, feet at the slots' foot
  const fy = y + 3 * rh + 2 * g - 6, s = Math.min((3 * rh + 2 * g - 12) / 1.08, dw / 0.62), dx = x + cw + g + dw / 2;
  armourIcon(ctx, E, playerParts({ plates: me.plates }), dx, fy, s, me.str, GTYPE[me.weapon].helm);
  // the weapon in its hand, held up as the menu's fighter holds it (step 14); a second blade (step 18) the same in the other hand, leaning the other way
  if (me.weapon !== 'fist') {
    const [hx, lean] = TUNING.kit.weapon.doll;
    for (const [id, sd] of me.dual ? [['armF', 1], ['armB', -1]] : [['armF', 1]]) {
      const A = PARTS[pidx(id)].joint, px = dx + (A[0] + sd * hx) * s, py = fy + (A[1] + ARM_LEN) * s;
      ctx.save(); ctx.translate(px, py); ctx.rotate(Math.PI + sd * lean); ctx.translate(0, -ARM_LEN * s);
      drawWeapon(ctx, { weapon: iconWeapon(me.weapon), mace: me.mace }, s); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.arc(px, py, TUNING.kit.weapon.fist * s, 0, TAU); ctx.clip();
      armourIcon(ctx, E, playerParts({ plates: me.plates }), dx, fy, s, me.str, GTYPE[me.weapon].helm); ctx.restore();
    }
  }
  // the sidearm (step 22) at the hip, hanging back
  const [sw0, sm0] = me.side && me.side !== 'bow' ? sideWield(me.side) : ['fist', false];
  if (me.side === 'bow') { const k = TUNING.sidearm.hip; bowAt(ctx, dx + k[0] * s, fy + k[1] * s, -k[2], TUNING.bow.len * s * k[3]); }
  if (sw0 !== 'fist') {
    const k = TUNING.sidearm.hip;
    ctx.save(); ctx.translate(dx + k[0] * s, fy + k[1] * s); ctx.rotate(k[2]); ctx.translate(0, -ARM_LEN * s * k[3]);
    drawWeapon(ctx, { weapon: iconWeapon(sw0), mace: sm0 }, s * k[3]); ctx.restore();
  }
  const rects = [], lh = Math.min(17, (rh - 6) / 4), tw = cw - 16;
  for (const q of INV_SLOTS) {
    const [bx, by, bh] = box[q.id], plated = !!q.plate && me.plates.includes(PLATES[q.plate].parts[0]), c = gear[q.card], px = dx + q.at[0] * s, py = fy + q.at[1] * s;
    ctx.strokeStyle = ctx.fillStyle = 'rgba(196,185,154,0.4)'; ctx.lineWidth = 1;
    line(ctx, bx < dx ? bx + cw : bx, by + rh / 2, px, py); ctx.beginPath(); ctx.arc(px, py, 2.5, 0, TAU); ctx.fill();
    E.roundRect(bx, by, cw, bh, 10, '#1f1a24', plated ? PLATE_COL : '#4a4252');
    // the Arms row's second blade (step 18): a chip under its price, on its right, its own tap target in the purse
    // (the chip no wider than its words need, so the reinforced shield's words have room beside it)
    const two = q.id === 'arms' && buy && buy.dual, chw = two ? Math.min(Math.round(cw * 0.44), (ctx.font = '800 14px system-ui, sans-serif', Math.ceil(ctx.measureText('BLADE').width) + 8)) : 0, rtw = two ? cw - chw - 14 : tw;
    if (two) {
      const D = buy.dual, cx0 = bx + cw - chw - 4, cy0 = by + lh + 6, chh = bh - lh - 10, col = D.on ? '#ffd24a' : D.none || D.short ? '#6b7280' : '#c4b99a';
      E.roundRect(cx0, cy0, chw, chh, 8, D.on ? '#3a2a10' : '#2a2016', col);
      const mid = cy0 + chh / 2;
      E.text('2ND', cx0 + chw / 2, mid - 17, { size: 14, weight: '800', color: D.on ? '#ffd24a' : '#f0e6cc' });
      E.text('BLADE', cx0 + chw / 2, mid - 1, { size: 14, weight: '800', color: D.on ? '#ffd24a' : '#f0e6cc' });
      const pt = D.none ? 'a weapon first' : D.on ? (ctx.measureText('no shield').width <= chw - 8 ? 'no shield' : 'ON') : `${D.price}`;
      if (D.none || D.on) E.text(clipLine(ctx, pt, chw - 8, 14, '700'), cx0 + chw / 2, mid + 16, { size: 14, weight: '700', color: col });
      else { E.text(pt, cx0 + chw / 2 + 6, mid + 16, { size: 14, weight: '800', color: D.short ? '#6b7280' : '#fbbf24' }); drawCoin(ctx, cx0 + chw / 2 - ctx.measureText(pt).width / 2 - 4, mid + 16, 5.5); }
      rects.push({ id: 'dual', plate: null, x: cx0, y: cy0, w: chw, h: chh });
    }
    const L = bx + 8, put = (t, col, wt = '700') => { E.text(clipLine(ctx, t, rtw, 14, wt), L, ly, { size: 14, weight: wt, align: 'left', color: col }); ly += lh; };
    let ly = by + 4 + lh / 2;
    E.text(q.name, L, ly, { size: 14, weight: '800', align: 'left', color: '#c4b99a' });
    if (buy && q.plate) {
      const pr = `${TUNING.purse.plate[q.plate]}`, R = bx + cw - 8;
      E.text(pr, R, ly, { size: 14, weight: '800', align: 'right', color: plated ? PLATE_COL : buy.short(q.plate) ? '#6b7280' : '#fbbf24' });
      drawCoin(ctx, R - ctx.measureText(pr).width - 9, ly, 5.5);
    }
    ly += lh;
    // the plate or the plain kit under it; the weapon slot, your weapon, its kinds, and its painting with its striking parts lit at the slot's foot
    // (step 21), its job between them in the purse as far as the slot holds it
    // (beside the second blade's chip, step 24's longer Arms words wrap onto the lines below)
    const putW = (t, col, wt) => { const ls = two ? wrapPx(ctx, t, rtw, 14, wt) : [t]; if (ly + (ls.length - 1) * lh < by + bh - lh * 0.4) ls.forEach((l) => put(l, col, wt)); };
    // (unbought beside the chip, what the plate does takes the place of the plain kit's name)
    if (!(two && !plated && !me.dual)) putW(q.id === 'weapon' ? weaponTitle(me) : plated ? PLATES[q.plate].name : q.plain, plated ? PLATE_COL : PLAIN_COL, '700');
    if (buy && q.plate) putW(plateSaves(q.plate, me, two && plated), plated ? '#e9c891' : '#9aa4b2', '600');
    const wk = weaponKey(me.weapon, me.mace), pic = q.id === 'weapon' && wk !== 'fist' && kitOn() && zonePic(wk) ? Math.min(TUNING.strike.slotH, bh - (ly - by) - lh) : 0;
    if (q.id === 'weapon') { segLine(ctx, E, kindSegs(wk), L, ly, rtw, 14, {}); ly += lh; }
    if (pic > 0) {
      const J = TUNING.kit.weapon[wk], s0 = Math.min((cw - 16) / rackLen(wk), pic / (J.size[0] * (rackWeapon0(wk).len + J.tip) / (J.pin - (J.top || 0))));
      rackWeapon(ctx, wk, bx + cw / 2, by + bh - 6 - pic / 2, s0, true);
    }
    if (!buy && q.id === 'arms' && me.dual) put('Second blade', PLATE_COL);
    if (q.id === 'weapon' && buy && buy.job) wrapPx(ctx, buy.job, tw, 14, '600').slice(0, Math.max(0, Math.floor((by + bh - pic - ly - lh) / lh))).forEach((t) => put(t, '#cbd5e1', '600'));
    if (c) put(c.gear, rarCol(c));
    rects.push({ id: q.id, plate: q.plate || null, x: bx, y: by, w: cw, h: bh });
  }
  // the Sidearm slot (step 22): its weapon and kinds; in the purse its price, and a tap makes the rack buy for it (its border pulses gold)
  if (sd) {
    const [bx, by, bh] = box.side, S = buy && buy.side, pk = !!S && S.pick, k = me.side, L = bx + 8, px = dx + TUNING.sidearm.hip[0] * s, py = fy + TUNING.sidearm.hip[1] * s;
    ctx.strokeStyle = ctx.fillStyle = 'rgba(196,185,154,0.4)'; ctx.lineWidth = 1;
    line(ctx, bx, by + rh / 2, px, py); ctx.beginPath(); ctx.arc(px, py, 2.5, 0, TAU); ctx.fill();
    E.roundRect(bx, by, cw, bh, 10, pk ? '#3a2a10' : '#1f1a24', pk ? '#ffd24a' : k ? PLATE_COL : '#4a4252');
    if (pk) { const u = 0.5 + 0.5 * Math.sin(S.t * 6); ctx.save(); ctx.strokeStyle = `rgba(255,210,74,${0.4 + 0.5 * u})`; ctx.lineWidth = 2 + 2 * u; rrect(ctx, bx - 2, by - 2, cw + 4, bh + 4, 11); ctx.stroke(); ctx.restore(); }
    let ly = by + 4 + lh / 2;
    E.text('SIDEARM', L, ly, { size: 14, weight: '800', align: 'left', color: pk ? '#ffd24a' : '#c4b99a' });
    if (buy && k) { const pr = `${sidePrice(k)}`, R = bx + cw - 8; E.text(pr, R, ly, { size: 14, weight: '800', align: 'right', color: PLATE_COL }); drawCoin(ctx, R - ctx.measureText(pr).width - 9, ly, 5.5); }
    ly += lh;
    E.text(clipLine(ctx, k === 'bow' ? 'Bow' : k ? weaponTitle({ weapon: sw0, mace: sm0 }) : 'None', tw, 14, '700'), L, ly, { size: 14, weight: '700', align: 'left', color: k ? PLATE_COL : PLAIN_COL }); ly += lh;
    if (pk) E.text('Pick from the rack', L, ly, { size: 14, weight: '700', align: 'left', color: '#ffd24a' });
    else if (k) segLine(ctx, E, kindSegs(k), L, ly, tw, 14, {});
    else if (buy) E.text('Tap, then a weapon', L, ly, { size: 14, weight: '600', align: 'left', color: '#9aa4b2' });
    rects.push({ id: 'side', plate: null, x: bx, y: by, w: cw, h: bh });
  }
  // the belt, the cloak and the shield's face, on one row
  if (ex) {
    const ey = y + h - exH, my = ey + exH / 2, R = x + w - 8;
    E.roundRect(x, ey, w, exH, 10, '#1f1a24', '#4a4252');
    E.text('EXTRAS', x + 8, my, { size: 14, weight: '800', align: 'left', color: '#c4b99a' });
    let cx = x + 8 + ctx.measureText('EXTRAS').width + 12;
    for (const k of EXTRAS) {
      const p = gear[k];
      if (!p || cx >= R) continue;
      const t = clipLine(ctx, p.gear, R - cx, 14, '800');
      E.text(t, cx, my, { size: 14, weight: '800', align: 'left', color: rarCol(p) });
      cx += ctx.measureText(t).width + 14;
    }
  }
  return rects;
}
// Step 21: the key to the lit weapons, each kind's colour and word, from x on the line at y
function strikeKey(ctx, E, x, y) {
  ctx.font = '800 14px system-ui, sans-serif';
  for (const k of ['cut', 'pierce', 'crush']) {
    ctx.fillStyle = TUNING.strike.col[k]; ctx.fillRect(x, y - 5, 16, 10);
    E.text(KIND_WORD[k], x + 21, y, { size: 14, weight: '800', align: 'left', color: TUNING.strike.col[k] });
    x += 21 + ctx.measureText(KIND_WORD[k]).width + 14;
  }
}
// The inventory over the draft: what you wear, read-only (the Wearing button and the "?"'s last page; a tap closes it)
function drawWearing(ctx, E) {
  const w = Math.min(E.w - 24 - E.safe.left - E.safe.right, 660), x = (E.w - w) / 2, y = E.safe.top + 8, h = E.h - E.safe.top - E.safe.bottom - 16;
  ctx.fillStyle = 'rgba(10,8,14,0.75)'; ctx.fillRect(0, 0, E.w, E.h);
  E.roundRect(x, y, w, h, 16, '#221a2b', '#e6c866');
  E.text('WHAT YOU WEAR', E.w / 2, y + 20, { size: 14, weight: '800', color: '#c4b99a' });
  drawInventory(ctx, E, x + 12, y + 38, w - 24, h - 38 - 32, { me: state.me, gear: wornGear() });
  const by = y + h - 16;
  strikeKey(ctx, E, x + 20, by); E.text('Tap to close', E.w / 2, by, { size: 14, weight: '800', color: '#ffd24a' });
}
// The purse, the inventory's first view (step 11), in the tent's look: Brutus (the first-run hint says what the purse is for), the doll with your
// start cards' pieces (tap a slot to buy its plate, again to sell it back), the weapons in a rack on the right (fists free, the ludus's once bought),
// and what is left with Fight!. P: the roll scene's purse.
// the purse's price for a weapon (twice over with a second blade, step 18) and plates; step 22: a sidearm at its weapon's price, and knives
export const purseCost = (w, kit, dual = false, side = null, kn = 0) => TUNING.purse.weapon[w] * (dual ? 2 : 1) + kit.reduce((a, k) => a + TUNING.purse.plate[k], 0) + (side ? sidePrice(side) : 0) + kn * TUNING.knives.price;
// a sidearm's price: its weapon's, or the bow's (step 24)
const sidePrice = (id) => (id === 'bow' ? TUNING.bow.price : TUNING.purse.weapon[id]);
// the whole purse P as it would be with o changed
export const purseOf = (P, o = {}) => { const q = { ...P, ...o }; return purseCost(q.w, q.kit, q.dual && q.w !== 'fist', q.side, q.knives); };
export function drawPurse(ctx, E, P, me) {
  const T = TUNING.purse, top = E.safe.top + 18, L = 16 + E.safe.left, R = E.w - 16 - E.safe.right, ready = P.t > TUNING.draft.delay, gap = 8;
  const side = P.pick === 'side', left = P.gold - purseOf(P), kit = { ...kitMe(me, P.w, P.kit, P.dual), side: P.side };
  ctx.fillStyle = '#14101a'; ctx.fillRect(0, 0, E.w, E.h);
  E.text("THE ARMOURER'S TENT", E.w / 2, top, { size: 20, weight: '800', color: '#e6c866' });
  const say = P.first ? 'Old Brutus: “I picked you a blade and a chest plate. Change what you like.”'
    : P.hint ? `Old Brutus: “${P.gold} gold. Fists are free. Tap a slot to plate it, and keep some for the tent.”` : `Old Brutus: “${P.gold} gold. Plates or a blade: not all of both.”`;
  sayLine(ctx, E, say, E.w / 2, top + 24, R - L, { size: 14, weight: '700', color: '#fde68a', fit: true }, 'brutus');
  const by = E.h - E.safe.bottom - 30, gy = top + 46, gh = by - 30 - gy, rw = clamp((R - L) * 0.36, 200, 300), rx = R - rw;
  P.slots = drawInventory(ctx, E, L, gy, R - L - rw - 14, gh, { me: kit, gear: gearOf(startCards(me).map((c) => c.id)), buy: { short: (k) => noPlate(P, k) || (!P.kit.includes(k) && purseOf(P, { kit: [...P.kit, k] }) > P.gold), job: MY_WEAPON_JOB[kit.weapon],
    dual: { on: P.dual && P.w !== 'fist', price: P.w === 'fist' ? 0 : T.weapon[P.w], none: P.w === 'fist', short: !P.dual && purseOf(P, { dual: true }) > P.gold }, side: { pick: side, t: P.t } } });
  // the rack: two columns of weapons, each its name and price, its painting (step 14) with its striking parts lit and their kinds (step 21); with the
  // Sidearm slot picked (step 22) it buys the sidearm, never fists or the weapon in hand, and the bow (step 24) takes the fists' place
  const rackLong = Math.max(...Object.keys(T.weapon).filter((id) => id !== 'fist').map(rackLen));
  const ids = Object.keys(T.weapon).filter((id) => !LUDUS_LOCK.has(id) || (me.open || []).includes(id)).map((id) => (side && id === 'fist' ? 'bow' : id)), rows = Math.ceil(ids.length / 2), tw = (rw - gap) / 2, th = Math.min(64, (gh - gap * (rows - 1)) / rows);
  P.tiles = ids.map((id, i) => {
    const x = rx + (i % 2) * (tw + gap), y = gy + Math.floor(i / 2) * (th + gap), on = (side ? P.side : P.w) === id, pr = sidePrice(id);
    const short = side ? id === 'fist' || id === P.w || (!on && purseOf(P, { side: id }) > P.gold) : !on && purseOf(P, { w: id, side: P.side === id ? null : P.side }) > P.gold;
    const nm = id === 'bow' ? 'BOW' : weaponName({ weapon: id === 'mace' ? 'axe' : id, mace: id === 'mace' }).split(' & ')[0];
    ctx.globalAlpha = !ready ? 0.6 : short ? 0.45 : 1;
    E.roundRect(x, y, tw, th, 12, on ? '#3a2a10' : '#2a2016', on ? '#ffd24a' : '#c4b99a');
    const ty = y + 12, pt = pr ? `${pr}` : 'free', pc = on ? '#ffd24a' : short ? '#9aa4b2' : '#fbbf24';
    ctx.font = '800 14px system-ui, sans-serif';
    const pw = ctx.measureText(pt).width + (pr ? 13 : 0), nw = tw - 16 - pw, ns = fitSize(ctx, nm, 16, nw);
    E.text(pt, x + tw - 6, ty, { size: 14, weight: '800', align: 'right', color: pc });
    if (pr) drawCoin(ctx, x + tw - 6 - ctx.measureText(pt).width - 7, ty, 5.5);
    E.text(clipLine(ctx, nm, nw, ns, '800'), x + 7, ty, { size: ns, weight: '800', align: 'left', color: '#f0e6cc' });
    if (id === 'bow') rackBow(ctx, x + tw / 2, y + th / 2 + 2, Math.min(tw * 0.62, th * 2.2));
    else if (id !== 'fist') rackWeapon(ctx, id, x + tw / 2, y + th / 2 + 1, (tw - 12) / rackLong, true);
    // (the bow's two words, a little tighter: they are the rack's longest)
    segLine(ctx, E, kindSegs(id), x + tw / 2, y + th - 11, tw - 8, 14, id === 'bow' ? { center: true, sep: ' \u00b7 ', weight: '700' } : { center: true });
    return { id, x, y, w: tw, h: th };
  });
  ctx.globalAlpha = 1;
  // what is left, and what the plates cost your stamina
  const rg = TUNING.me.armour[kit.set].regen, st = rg < 1 ? `  ·  stamina ${Math.round((1 - rg) * 100)}% slower` : '', K = TUNING.knives, kw = clamp((R - L) * 0.36, 230, 270);
  // step 22: the Knives row, left of Fight!
  ctx.globalAlpha = ready ? 1 : 0.6;
  P.krow = knifeRow(ctx, E, R - 170 - kw, by - K.row[0] / 2, kw, P.knives, P.knives < K.max && purseOf(P, { knives: P.knives + 1 }) <= P.gold, P.knives > 0);
  ctx.globalAlpha = 1;
  E.text(`Left in your purse: ${left} gold${st}`, L, by, { size: fitSize(ctx, `Left in your purse: ${left} gold${st}`, 16, R - L - 180 - kw), weight: '800', align: 'left', color: '#fbbf24' });
  P.fight = E.button('Fight!', R - 80, by, { w: 150, h: 48, size: 20, fill: '#b45309' });
  // Buy a plate: the plate it points at pulses until one is bought
  const pk = purseNudge(P), ps = P.pulse >= 0 && pk && P.slots.find((q) => q.plate === pk);
  if (ps) { const k = 0.5 + 0.5 * Math.sin((P.t - P.pulse) * 8); ctx.save(); ctx.strokeStyle = `rgba(255,210,74,${0.4 + 0.6 * k})`; ctx.lineWidth = 3 + 2 * k; rrect(ctx, ps.x - 3, ps.y - 3, ps.w + 6, ps.h + 6, 12); ctx.stroke(); ctx.restore(); }
  if (P.ask) drawBareAsk(ctx, E, P);
}
// the plate Buy a plate points at: the chest if the purse covers it, else the cheapest it covers; none when no plate is bought, or none is affordable
// step 24: no reinforced shield with two blades
export const noPlate = (P, k) => k === 'manica' && P.dual && P.w !== 'fist';
export function purseNudge(P) {
  if (P.kit.length) return null;
  const ok = Object.keys(PLATES).filter((k) => !noPlate(P, k) && purseOf(P, { kit: [k] }) <= P.gold).sort((a, b) => (b === 'chest') - (a === 'chest') || TUNING.purse.plate[a] - TUNING.purse.plate[b]);
  return ok[0] || null;
}
// Fight! with no plate while one is affordable (step 23): Brutus asks once, Buy a plate or Fight bare
function drawBareAsk(ctx, E, P) {
  const w = Math.min(E.w - 32, 460), h = 150, x = (E.w - w) / 2, y = (E.h - h) / 2;
  ctx.fillStyle = 'rgba(10,8,14,0.75)'; ctx.fillRect(0, 0, E.w, E.h);
  E.roundRect(x, y, w, h, 16, '#221a2b', '#e6c866');
  sayLine(ctx, E, 'Old Brutus: “No plates? Every blow lands on skin.”', E.w / 2, y + 38, w - 24, { size: 17, weight: '800', color: '#fde68a', fit: true }, 'brutus', TUNING.art.faceBig);
  const bw = Math.min(180, (w - 36) / 2);
  P.ask = { buy: E.button('Buy a plate', E.w / 2 - bw / 2 - 6, y + h - 40, { w: bw, h: 48, size: 18, fill: '#b45309' }), bare: E.button('Fight bare', E.w / 2 + bw / 2 + 6, y + h - 40, { w: bw, h: 48, size: 18, fill: '#334155' }) };
}
export function meMini(ctx, E, me, x, y, w, h, picks = []) {
  E.roundRect(x, y, w, h, 12, '#1d2a2a', '#4ade80');
  const cx = x + w / 2;
  E.text(clipLine(ctx, me.name.toUpperCase(), w - 10), cx, y + 12, { size: 14, weight: '800', color: '#9fe3c6' });
  E.text(`TIER ${me.tier} \u2665${me.halves}`, cx, y + 27, { size: 14, weight: '800', color: TIER_COL[me.tier] });
  E.text(TUNING.me.sizes[me.size].name, cx, y + 42, { size: 14, weight: '700', color: '#fde68a' });
  E.text(clipLine(ctx, weaponName(me).split(' & ')[0], w - 6), cx, y + 57, { size: 14, weight: '700', color: '#fde68a' });
  const n = (me.kit || []).length;
  E.text(n ? `${n} PLATE${n > 1 ? 'S' : ''}` : 'NO PLATES', cx, y + 72, { size: 14, weight: '700', color: '#aab3bc' });
  statBars(ctx, E, me, x + 8, y + 92, w - 16, 15, 14);
  E.text('YOU', cx, y + h - 10, { size: 14, weight: '800', color: '#4ade80' });
  // the set mark: each set bonus you wear (up to two), a small gold roundel either side of YOU
  picks.filter((id) => CARD[id].duo).slice(0, 2).forEach((id, i) => drawIcon(ctx, id, i ? x + w - 16 : x + 16, y + h - 10, 7));
}

// ====== META: fame, the ludus, the Wall of Champions ======
// A run's fame (TUNING.fame, E): every bout won, a champion felled, the arena's first clear, the Emperor's thumbs up, and the gold left over; each with its reason
export function fameOf(won, first, thumbUp, gold, bouts = 0) {
  const F = TUNING.fame, g = Math.floor(gold / F.goldPer), items = [];
  if (bouts > 0) items.push(['bouts won', bouts * F.bout]);
  if (won) items.push(['champion', F.champ]);
  if (first) items.push(['first clear', F.clear]);
  if (thumbUp) items.push(['a full crowd', F.thumbUp]);
  if (g > 0) items.push(['gold left', g]);
  return { sum: items.reduce((a, e) => a + e[1], 0), items };
}
// A save from before fame (migrate sets fameCheck; the ledger is the engine's, so it is read here once): each cleared arena's first clear, each won run's
// fame (a cleared arena with no win left in the ledger still counts its champion), its fighters on the Wall of Champions (the ledger kept no names, and
// no rolls, so they cannot return as veterans), and every card picked in a recorded run for the start-card slot
export function fameFromLedger(E) {
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
export function carveChampion(E, me, arenaId, champName) {
  const L = E.save.get('champs', []), at = (id) => ARENAS.findIndex((a) => a.id === id), old = me.vid != null ? L.find((c) => c.id === me.vid) : null;
  // a veteran who wins again moves their arena up, and keeps the weapon they won with (the spoils)
  if (old) {
    if (at(old.arena) < at(arenaId)) old.arena = arenaId;
    old.weapon = me.weapon; old.mace = me.mace; old.me.idx[5] = me.idx[5]; old.me.mace = me.mace;
    E.save.set('champs', L.slice()); return old;
  }
  const rng = makeRng((state.seed ^ 0x5bd1e995) >>> 0), kit = me.kit || [], ups = [1, 2, 3].filter((k) => me.idx[k] < 4);
  const c = { id: state.seed, name: me.name, female: me.female, origin: me.origin, weapon: me.weapon, mace: me.mace, arena: arenaId,
    me: { idx: me.idx.slice(), kit: kit.slice(), plates: kit.flatMap((k) => PLATES[k].parts), name: me.name, female: me.female, mace: me.mace, cardRoll: me.cardRoll, vary: me.vary || 0 },
    up: ups.length ? rng.pick(ups) : 0, scar: rng.pick(SCARS)(champName.split(/[ ,]/)[0]) };
  E.save.set('champs', [c, ...L].slice(0, TUNING.ludus.wallMax));
  return c;
}
// the arenas a Wall entry may fight in as a veteran: open, and above the one they cleared
export const vetArenas = (E, c) => (c && c.me ? ARENAS.map((a, i) => i).filter((i) => i > ARENAS.findIndex((a) => a.id === c.arena) && i <= openTo(E)) : []);
// what the ludus has opened, and your start-card pick (the training ground's slot, a card you have picked before)
export const ludusOf = (E) => E.save.get('ludus', []);
// true while your fame buys at least one unlock you do not own (the menu's gold dot on The Ludus)
export const ludusBuys = (E) => { const L = ludusOf(E), fame = E.save.get('fame', 0); return LUDUS.some((st) => st.items.some((q) => !L.includes(q.id) && (!q.needs || L.includes(q.needs)) && TUNING.ludus.price[q.id] <= fame)); };
// only a common or a rare card, never a keystone or an epic: the slot is a small step
export const startable = (id) => { const c = CARD[id]; return !!c && !c.duo && !c.key && c.tier <= 1; };
export const startPick = (E) => { const id = E.save.get('startPick', ''), L = ludusOf(E); return L.includes('slot') && startable(id) && E.save.get('picked', []).includes(id) ? id : ''; };
