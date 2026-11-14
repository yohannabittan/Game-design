#!/usr/bin/env node
// arena-split: splits Arena's one game.js into modules (ADR-0024). A move, not a rewrite: every top-level declaration goes, with the comments
// above it, to the module the table below names, in its original order; the import and export lines are generated from the names each module
// uses. Re-run it on a newer one-file game.js if another build lands first; reviewing the split means reading MODULES, FROM and the moves.
//   node tools/arena-split.mjs                       reads games/arena/src/game.js (it must still be one file), writes the modules beside it
//   node tools/arena-split.mjs --from <git-ref>      reads game.js as it is at that commit instead (for a re-run once the split has landed)
//   node tools/arena-split.mjs --out <dir>           writes somewhere else
// It stops, writing nothing, if a module would read another's const while loading (only tuning.js and data.js may be read then), if a `let`
// would be assigned from outside its own module, if data.js or tuning.js would import from a module other than tuning.js, or if a reformatted
// list's tokens differ from the original's.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const a = process.argv.slice(2), opt = (k) => (a.includes(k) ? a[a.indexOf(k) + 1] : null);
const SRC = join(ROOT, 'games/arena/src');
const OUT = resolve(opt('--out') || SRC);
const text = opt('--from') ? execFileSync('git', ['show', `${opt('--from')}:games/arena/src/game.js`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }) : readFileSync(join(SRC, 'game.js'), 'utf8');
if (/^import .* from '\.\/tuning\.js'/m.test(text)) { console.error('game.js is already split: pass --from <git-ref> of a one-file game.js'); process.exit(1); }

// ----- the table -----
// Each module and the line that heads it.
const MODULES = {
  'tuning.js': 'TUNING: every tunable number. It imports nothing, and may be read while modules load.',
  'data.js': 'The data tables: the gauntlet, story lines, the deck, champions, body parts, zones, poses. It imports only TUNING, and may be read while modules load.',
  'fight.js': 'Your fighter: the model and layout, footwork and defence, input, hit resolution and the juice.',
  'foe.js': 'The foe AI: his cover, his mind, his moves and the pair\'s second foe.',
  'cards.js': 'The card engine: the hooks, finishers, hints, the crowd, Momentum and Bleed.',
  'draw-fight.js': 'Drawing the fight: the fighters and their kit, beasts, weapons, the arena and the HUD.',
  'screens.js': 'Between bouts and the screens: the draft, the tent, the purse, the inventory, the intro cards, wheels, and the meta (fame, the ludus).',
  'scenes.js': 'The scenes: menu, story, the arena pick, the ludus, champions, the roll, play and over.',
  'game.js': 'The run state, the rolls, the art loader, the game object (save, migrate, the TUNE presets), and the play scene\'s names for the checks.',
  'features/yard.js': 'Feature: the training yard (step 23). Hooks: play.enter (startYard for the drill), beginBout (yardDue, startYard), play.update (updateYard), play.onTap/onPointerUp (endYard, yardRelease), play.render (drawYard).',
  'features/ranged.js': 'Feature: the sidearm, throwing knives and the bow (steps 22 and 24), with the first-knife lesson. Hooks: play.onPointerDown (armsTouch, aimDown, bowDown), play.update (stepArms, updateLesson), the HUD (drawArmsBtns, drawKnives), the tent and the purse (knifeRow, knifeBuy, rackBow).',
};
// By section (the file's `// ====== NAME ======` headers), the module a declaration goes to.
const BY_SECTION = {
  '(top)': 'game.js', TUNING: 'tuning.js', 'DATA TABLES': 'data.js', 'RUN STATE AND SMALL HELPERS': 'game.js', ROLLS: 'game.js',
  'FIGHTER MODEL': 'fight.js', 'FOE AI': 'foe.js', INPUT: 'fight.js', 'HIT RESOLUTION': 'fight.js', 'CARD ENGINE': 'cards.js', 'BETWEEN BOUTS': 'screens.js',
  JUICE: 'fight.js', DRAWING: 'draw-fight.js', META: 'screens.js', SCENES: 'scenes.js', 'GAME OBJECT': 'game.js',
};
// Runs that go elsewhere: from this declaration up to (not including) the `to` one, in the original order.
const FROM = [
  { from: 'ART', to: 'ART_NAMES', module: 'game.js', why: 'the art loader: `let ART, artV, ENG` are assigned by game.init, artEntry and kitSwitch, and an import cannot be assigned' },
  { from: 'famGlyph', to: null, section: 'DRAWING', module: 'screens.js', why: 'the screens\' drawing: cards, the draft, the tent, intros, wheels, the purse and the inventory' },
  { from: 'sideWield', to: 'emit', module: 'features/ranged.js', why: 'the sidearm, knives and bow (step 22, 24)' },
  { from: 'YARD_BLOW', to: 'KNIFE_LESSON', module: 'features/yard.js', why: 'the training yard (step 23)' },
  { from: 'KNIFE_LESSON', to: 'initHand', module: 'features/ranged.js', why: 'the first-knife lesson (step 22b)' },
];
// Single declarations that go elsewhere.
const ONE = {
  bowShown: ['features/ranged.js', 'whether the bow is in your hand (step 24)'],
  tentKnives: ['features/ranged.js', 'the tent\'s knives row'],
  bowAt: ['features/ranged.js', 'the purse rack\'s bow'],
  rackBow: ['features/ranged.js', 'the purse rack\'s bow'],
  popTop: ['scenes.js', 'assigned by play.update: a `let` lives where it is assigned'],
  // data.js stays a leaf (it imports only TUNING): the small helpers the data calls move in, and the data's helpers that read the run state move out
  lenN: ['data.js', 'DECK and CARD_NUMS count hearts with it; it reads only TUNING'],
  mkPart: ['data.js', 'beastParts and playerParts build parts with it; it reads nothing'],
  arena: ['game.js', 'reads the run state'], arenaT: ['game.js', 'reads the run state'], bout: ['game.js', 'reads the run state'], bg: ['game.js', 'reads the run state'],
  trait: ['game.js', 'reads the run state'], drives: ['game.js', 'reads the run state'], debtLeft: ['game.js', 'reads the run state'],
  brutusIntro: ['game.js', 'reads the run state'], brutusWon: ['game.js', 'reads the run state'], wornGear: ['game.js', 'reads the run state'], replaces: ['game.js', 'reads the run state'],
  WHEELS: ['scenes.js', 'the load rule: STORY_WHEELS (and through it STORY_CARDS) filters it while loading, so it sits next to them'],
};
// The play scene's list of names for the scripted checks reads a hundred names from every module, so it cannot run while scenes.js loads:
// it moves to game.js (the entry, which loads last) as an Object.assign onto play.
const PLAY_NAMES = { chunk: 'play', from: /^const play = \{$/, until: /^ {2}enter\(E, params\) \{$/ };
// Lists every feature adds to, written one item per line (ADR-0024): [declaration, the line that opens the list].
const ONE_PER_LINE = [
  ['RUN_KEYS', /^const RUN_KEYS = \[/],
  ['newRound', /^ {2}Object\.assign\(state, \{$/],
  ['play', /^ {4}const r = \{ gapHits:/],
  ['play', /^ {4}E\.ledger\.add\('result', \{/],
];
const ENGINE_NAMES = ['makeRng', 'clamp', 'lerp', 'ease'];

// ----- a tokenizer: enough of JavaScript to find identifiers, brackets and arrows, skipping strings, templates' text, regexes and comments -----
const KW = new Set('break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new return super switch this throw try typeof var void while with yield await async of get set null true false undefined static'.split(' '));
function tokenize(src) {
  const out = [], tpl = [];
  let i = 0;
  const prevSig = () => out[out.length - 1];
  const regexOk = () => { const p = prevSig(); if (!p) return true; if (p.t === 'p') return !/^[)\]}]$/.test(p.v); if (p.t === 'id') return KW.has(p.v) && !['this', 'super', 'null', 'true', 'false', 'undefined'].includes(p.v); return false; };
  const template = () => { // scans template text from i (after ` or }) to the closing ` or a ${
    while (i < src.length) {
      const c = src[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { i++; out.push({ t: 's', v: '`', i }); return; }
      if (c === '$' && src[i + 1] === '{') { i += 2; tpl.push(0); out.push({ t: 'p', v: '(', i }); return; }
      i++;
    }
  };
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 2; continue; }
    if (c === '"' || c === "'") { const s = i; i++; while (src[i] !== c) { if (src[i] === '\\') i++; i++; } i++; out.push({ t: 's', v: src.slice(s, i), i: s }); continue; }
    if (c === '`') { i++; template(); continue; }
    if (/[A-Za-z_$]/.test(c)) { const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(i, i + 80)); out.push({ t: 'id', v: m[0], i }); i += m[0].length; continue; }
    if (/\d/.test(c) || (c === '.' && /\d/.test(src[i + 1]))) { const m = /^(0[xX][\da-fA-F_]+|[\d_]*\.?[\d_]*(e[+-]?\d+)?n?)/.exec(src.slice(i, i + 40)); out.push({ t: 'n', v: m[0], i }); i += m[0].length || 1; continue; }
    if (c === '/' && regexOk()) {
      const s = i; i++; let cls = false;
      while (i < src.length) { const d = src[i]; if (d === '\\') { i += 2; continue; } if (d === '[') cls = true; else if (d === ']') cls = false; else if (d === '/' && !cls) break; i++; }
      i++; while (/[a-z]/.test(src[i])) i++;
      out.push({ t: 'r', v: src.slice(s, i), i: s }); continue;
    }
    const three = src.slice(i, i + 3), two = src.slice(i, i + 2);
    if (three === '...' || three === '===' || three === '!==' || three === '**=' || three === '>>>' || three === '&&=' || three === '||=' || three === '??=') { out.push({ t: 'p', v: three, i }); i += 3; continue; }
    if (['=>', '?.', '==', '!=', '<=', '>=', '&&', '||', '??', '++', '--', '+=', '-=', '*=', '/=', '%=', '**', '<<', '>>', '|=', '&=', '^='].includes(two) && !(two === '?.' && /\d/.test(src[i + 2]))) { out.push({ t: 'p', v: two, i }); i += 2; continue; }
    if (c === '{' && tpl.length) tpl[tpl.length - 1]++;
    if (c === '}' && tpl.length) { if (tpl[tpl.length - 1] === 0) { tpl.pop(); out.push({ t: 'p', v: ')', i }); i++; template(); continue; } tpl[tpl.length - 1]--; }
    out.push({ t: 'p', v: c, i }); i++;
  }
  return out;
}
// identifiers a piece of code refers to: not after a dot, not an object key or a keyword
function refs(toks) {
  const s = new Set();
  toks.forEach((k, j) => {
    if (k.t !== 'id' || KW.has(k.v)) return;
    const p = toks[j - 1], n = toks[j + 1];
    if (p && p.t === 'p' && (p.v === '.' || p.v === '?.')) return;
    if (n && n.t === 'p' && n.v === ':' && p && p.t === 'p' && (p.v === '{' || p.v === ',')) return;
    if (methodName(toks, j)) return;
    s.add(k.v);
  });
  return s;
}
// a method's or getter's own name in an object literal: name(...) { or get name() {
function methodName(toks, j) {
  const p = toks[j - 1], n = toks[j + 1];
  if (!n || n.v !== '(') return false;
  if (p && p.t === 'id' && (p.v === 'get' || p.v === 'set' || p.v === 'async') && toks[j - 2] && (toks[j - 2].v === '{' || toks[j - 2].v === ',')) return true;
  if (!p || !(p.v === '{' || p.v === ',')) return false;
  let d = 0, i = j + 1;
  for (; i < toks.length; i++) { if (toks[i].v === '(') d++; else if (toks[i].v === ')' && --d === 0) break; }
  return !!toks[i + 1] && toks[i + 1].v === '{';
}
// the identifiers a declaration reads while its module loads: everything outside function bodies, arrow bodies and method bodies
function eager(toks) {
  const out = [];
  const OPEN = { '(': ')', '[': ']', '{': '}' };
  const skipBlock = (j) => { let d = 0; for (; j < toks.length; j++) { const v = toks[j].t === 'p' ? toks[j].v : ''; if (OPEN[v]) d++; else if (v === ')' || v === ']' || v === '}') { d--; if (d === 0) return j + 1; } } return j; };
  const skipExpr = (j) => { let d = 0; for (; j < toks.length; j++) { const v = toks[j].t === 'p' ? toks[j].v : ''; if (OPEN[v]) d++; else if (v === ')' || v === ']' || v === '}') { if (d === 0) return j; d--; } else if (d === 0 && (v === ',' || v === ';')) return j; } return j; };
  let j = 0;
  while (j < toks.length) {
    const k = toks[j];
    if (k.t === 'id' && k.v === 'function') { while (j < toks.length && !(toks[j].t === 'p' && toks[j].v === '{')) j++; j = skipBlock(j); continue; }
    if (k.t === 'p' && k.v === '=>') { j++; j = toks[j] && toks[j].t === 'p' && toks[j].v === '{' ? skipBlock(j) : skipExpr(j); continue; }
    if (k.t === 'p' && k.v === ')' && toks[j + 1] && toks[j + 1].t === 'p' && toks[j + 1].v === '{') { j = skipBlock(j + 1); continue; }
    if (k.t === 'id') {
      const p = toks[j - 1], n = toks[j + 1];
      const key = n && n.t === 'p' && n.v === ':' && p && p.t === 'p' && (p.v === '{' || p.v === ',');
      const prop = p && p.t === 'p' && (p.v === '.' || p.v === '?.');
      // a method's name: name( ... ) {
      if (!KW.has(k.v) && !key && !prop) out.push(k.v);
    }
    j++;
  }
  return out;
}

// ----- the chunks: each top-level declaration with the comments and section header above it -----
const lines = text.split('\n');
if (lines[lines.length - 1] === '') lines.pop();
const DECL = /^(?:export\s+)?(?:async\s+)?(function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/;
const head = [];
let k0 = 0;
while (k0 < lines.length && !/^\/\/ ={4,}/.test(lines[k0])) head.push(lines[k0++]);
const chunks = [];
let section = '(top)';
for (let i = k0; i < lines.length; i++) {
  const sec = lines[i].match(/^\/\/ ={4,}\s*(.+?)\s*={4,}\s*$/);
  if (sec) section = sec[1].split(':')[0].trim();
  const d = lines[i].match(DECL);
  if (!d) continue;
  let s = i;
  while (s > k0 && /^\/\//.test(lines[s - 1])) s--;
  chunks.push({ start: s, decl: i, kind: d[1], name: d[2], section });
}
chunks.forEach((c, j) => { c.end = j + 1 < chunks.length ? chunks[j + 1].start : lines.length; c.lines = lines.slice(c.start, c.end); });
const headImport = head.findIndex((l) => /^import .* from '\.\/engine\.js';$/.test(l));
if (headImport < 0) throw new Error('no engine import in the header');
const headComment = head.slice(0, headImport).concat(head.slice(headImport + 1)).join('\n').replace(/\n+$/, '');
if (chunks[0].start !== k0) throw new Error('code between the header and the first declaration');

// the names each chunk declares (a const or let may declare several, comma-separated at the top level)
for (const c of chunks) {
  c.toks = tokenize(c.lines.join('\n'));
  if (c.kind !== 'const' && c.kind !== 'let') { c.names = [c.name]; continue; }
  const t = c.toks, at = t.findIndex((q) => q.t === 'id' && q.v === c.kind);
  c.names = [t[at + 1].v];
  let d = 0;
  for (let j = at + 2; j < t.length; j++) {
    const v = t[j].t === 'p' ? t[j].v : '';
    if (v === '(' || v === '[' || v === '{') d++; else if (v === ')' || v === ']' || v === '}') d--;
    else if (d === 0 && v === ';') break;
    else if (d === 0 && v === ',' && t[j + 1] && t[j + 1].t === 'id' && t[j + 2] && t[j + 2].v === '=') c.names.push(t[j + 1].v);
  }
}

// ----- the table applied -----
const byName = new Map(chunks.map((c, j) => [c.name, j]));
for (const c of chunks) c.module = BY_SECTION[c.section] || (() => { throw new Error(`no module for section ${c.section}`); })();
for (const r of FROM) {
  if (!byName.has(r.from)) throw new Error(`FROM: no declaration ${r.from}`);
  let j = byName.get(r.from);
  const stop = r.to ? byName.get(r.to) : null;
  if (r.to && stop == null) throw new Error(`FROM: no declaration ${r.to}`);
  for (; j < chunks.length && (stop == null ? chunks[j].section === r.section : j < stop); j++) chunks[j].module = r.module;
}
for (const [n, [m]] of Object.entries(ONE)) { if (!byName.has(n)) throw new Error(`ONE: no declaration ${n}`); chunks[byName.get(n)].module = m; }

const declaredIn = () => { const m = new Map(); for (const c of chunks) for (const n of c.names) m.set(n, c); return m; };
// data.js stays a leaf: a data declaration may refer only to TUNING and the data (move it in ONE otherwise)
{
  const where = declaredIn();
  const bad = [];
  for (const c of chunks) {
    if (c.module !== 'data.js') continue;
    const out = [...refs(c.toks)].filter((n) => where.has(n) && !['data.js', 'tuning.js'].includes(where.get(n).module));
    if (out.length) bad.push(`${c.name} (data.js) refers to ${out.map((n) => `${n} (${where.get(n).module})`).join(', ')}`);
  }
  if (bad.length) { console.error('data.js would not be a leaf:\n  ' + bad.join('\n  ')); process.exit(1); }
}

// ----- edits, all of them whitespace or a move: one item per line, and the play scene's names moved to game.js -----
function onePerLine(c, re) {
  const li = c.lines.findIndex((l) => re.test(l));
  if (li < 0) throw new Error(`one-per-line: ${re} not found in ${c.name}`);
  const body = c.lines.join('\n');
  const m0 = re.exec(c.lines[li])[0], open = c.lines.slice(0, li).join('\n').length + (li ? 1 : 0) + Math.max(m0.lastIndexOf('{'), m0.lastIndexOf('['));
  const toks = tokenize(body);
  let ti = toks.findIndex((q) => q.i === open);
  if (ti < 0) throw new Error(`one-per-line: no bracket at the end of ${c.lines[li]}`);
  const close = { '[': ']', '{': '}' }[body[open]];
  let d = 0, end = -1;
  const commas = [];
  for (let j = ti; j < toks.length; j++) {
    const v = toks[j].t === 'p' ? toks[j].v : '';
    if (v === '(' || v === '[' || v === '{') d++;
    else if (v === ')' || v === ']' || v === '}') { d--; if (d === 0) { end = toks[j].i; break; } }
    else if (d === 1 && v === ',') commas.push(toks[j].i);
  }
  if (body[end] !== close) throw new Error('one-per-line: unbalanced');
  const ind = ' '.repeat(c.lines[li].search(/\S/) + 2);
  const cuts = [open + 1, ...commas.map((q) => q + 1)], items = cuts.map((s, j) => body.slice(s, j + 1 < cuts.length ? cuts[j + 1] : end));
  const outItems = [];
  items.forEach((it, j) => {
    const last = j === items.length - 1, t = it.replace(/^\s+|\s+$/g, '');
    if (!t) return;
    const parts = t.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const p of parts) outItems.push(ind + p);
    if (!last && !outItems[outItems.length - 1].endsWith(',')) outItems[outItems.length - 1] += ',';
  });
  const after = body.slice(end).split('\n'), before = body.slice(0, open + 1);
  const closeInd = ' '.repeat(c.lines[li].search(/\S/));
  const next = `${before}\n${outItems.join('\n')}\n${closeInd}${after[0]}${after.length > 1 ? '\n' + after.slice(1).join('\n') : ''}`;
  const sig = (s) => tokenize(s).map((q) => q.v).join(' '), comments = (s) => (s.match(/\/\/.*$/gm) || []).map((x) => x.trim()).join('\n');
  if (sig(next) !== sig(body) || comments(next) !== comments(body)) throw new Error(`one-per-line changed the code of ${c.name}`);
  c.lines = next.split('\n');
}
for (const [n, re] of ONE_PER_LINE) onePerLine(chunks[byName.get(n)], re);

const playC = chunks[byName.get(PLAY_NAMES.chunk)];
const pf = playC.lines.findIndex((l) => PLAY_NAMES.from.test(l)), pu = playC.lines.findIndex((l) => PLAY_NAMES.until.test(l));
if (pf < 0 || pu < 0 || pu < pf) throw new Error('the play scene\'s names were not found');
const playNames = playC.lines.slice(pf + 1, pu);
playC.lines.splice(pf + 1, pu - pf - 1);
const gameC = chunks[byName.get('STD')];
gameC.lines = [
  '// The play scene\'s names, for the scripted checks (window.__engine.game.scenes.play). They are read from every module, so they are put on play',
  '// here, in the entry module, which loads last (ADR-0024: only tuning.js and data.js may be read while modules load).',
  'Object.assign(play, {', ...playNames, '});', ...gameC.lines];

// ----- imports, exports, and the checks -----
const where = declaredIn();
const mods = Object.keys(MODULES).map((m) => ({ m, chunks: chunks.filter((c) => c.module === m) }));
const unknown = [...new Set(chunks.map((c) => c.module))].filter((m) => !MODULES[m]);
if (unknown.length) throw new Error(`modules not in MODULES: ${unknown}`);
const problems = [];
const imports = new Map(), exported = new Set();
for (const M of mods) {
  const own = new Set(M.chunks.flatMap((c) => c.names)), want = new Map();
  for (const c of M.chunks) {
    c.toks = tokenize(c.lines.join('\n'));
    for (const n of refs(c.toks)) {
      if (own.has(n)) continue;
      if (ENGINE_NAMES.includes(n)) { if (!want.has('engine.js')) want.set('engine.js', new Set()); want.get('engine.js').add(n); continue; }
      const src = where.get(n);
      if (!src) continue;
      if (!want.has(src.module)) want.set(src.module, new Set());
      want.get(src.module).add(n); exported.add(n);
    }
  }
  imports.set(M.m, want);
  if ((M.m === 'data.js' || M.m === 'tuning.js') && [...want.keys()].some((m) => m !== 'tuning.js' && m !== 'engine.js')) problems.push(`${M.m} imports from ${[...want.keys()].join(', ')}`);
  if (M.m === 'tuning.js' && want.size) problems.push(`tuning.js imports ${[...want.keys()]}`);
}
// the load rule: a declaration's eager reads of another module's const, let or class (function declarations are hoisted, so they are safe)
const loadReads = [];
for (const c of chunks) {
  if (c.kind === 'function' || c.kind === 'function*') continue;
  for (const n of new Set(eager(c.toks.slice(c.toks.findIndex((q) => q.v === c.kind) + 2)))) {
    const src = where.get(n);
    // game.js is the entry, so it loads last and may read every module (its game object lists the scenes)
    if (!src || c.module === 'game.js' || src.module === c.module || src.kind === 'function' || ['tuning.js', 'data.js'].includes(src.module)) continue;
    loadReads.push(`${c.module} ${c.name} reads ${n} (${src.module}) while loading`);
  }
}
problems.push(...loadReads);
// a let assigned outside its own module
for (const c of chunks.filter((q) => q.kind === 'let')) for (const n of c.names) {
  const re = new RegExp(`(^|[^.\\w$])${n.replace('$', '\\$')}\\s*(=(?!=|>)|\\+\\+|--|[-+*/%|&^]=|\\?\\?=|\\|\\|=|&&=)|(\\+\\+|--)${n}\\b`);
  for (const o of chunks) if (o.module !== c.module && o.lines.some((l) => !/^\s*\/\//.test(l) && re.test(l.replace(/'[^']*'|"[^"]*"/g, '')))) problems.push(`let ${n} (${c.module}) is assigned in ${o.name} (${o.module})`);
}
if (problems.length) { console.error('Not written:\n  ' + problems.join('\n  ')); process.exit(1); }

// ----- write -----
const rel = (from, to) => { const up = from.includes('/') ? '../' : './'; return `${up}${to}`; };
const wrap = (names, lead, tail) => {
  const out = []; let line = lead;
  for (const [j, n] of names.entries()) {
    const piece = n + (j < names.length - 1 ? ',' : '');
    if (line.length + piece.length + 1 > 150 && line !== lead) { out.push(line.replace(/\s+$/, '')); line = '  '; }
    line += (line.endsWith('{ ') || line === '  ' ? '' : ' ') + piece;
  }
  out.push(line + tail);
  return out;
};
const ORDER = Object.keys(MODULES);
const report = [];
for (const M of mods) {
  const want = imports.get(M.m);
  const out = [];
  if (M.m === 'game.js') out.push(headComment, '// The modules (ADR-0024): ' + ORDER.join(', ') + '. Only tuning.js and data.js may be read while they load.');
  else out.push(`// Arena: ${MODULES[M.m]}`, '// Split from game.js by tools/arena-split.mjs (ADR-0024). Only tuning.js and data.js may be read while modules load.');
  out.push('');
  const srcs = [...want.keys()].sort((x, y) => (x === 'engine.js' ? -1 : y === 'engine.js' ? 1 : ORDER.indexOf(x) - ORDER.indexOf(y)));
  for (const s of srcs) {
    const names = [...want.get(s)].sort((x, y) => (s === 'engine.js' ? ENGINE_NAMES.indexOf(x) - ENGINE_NAMES.indexOf(y) : where.get(x).decl - where.get(y).decl || x.localeCompare(y)));
    out.push(...wrap(names, 'import { ', ` } from '${rel(M.m, s)}';`));
  }
  out.push('');
  if (M.m.startsWith('features/')) out.push(`// ====== ${M.m === 'features/yard.js' ? 'YARD: the training yard' : 'RANGED: the sidearm, knives and the bow'} ======`);
  let sec = M.m.startsWith('features/') ? '(feature)' : null;
  for (const c of M.chunks) {
    // a run of declarations from another section of the old file gets that section's header, so the index groups them truly
    if (sec !== '(feature)' && c.section !== sec && !c.lines.some((l) => /^\/\/ ={4,}/.test(l))) out.push(`// ====== ${c.section} (continued) ======`);
    if (sec !== '(feature)') sec = c.section;
    const ls = c.lines.slice();
    const di = ls.findIndex((l) => DECL.test(l));
    if (c.names.some((n) => exported.has(n)) && !/^export /.test(ls[di])) ls[di] = 'export ' + ls[di];
    out.push(...ls);
  }
  while (out[out.length - 1] === '') out.pop();
  const file = join(OUT, M.m);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, out.join('\n') + '\n');
  report.push([M.m, out.length, M.chunks.length]);
}
for (const [m, n, d] of report) console.log(`${m.padEnd(20)} ${String(n).padStart(6)} lines  ${String(d).padStart(4)} declarations`);
