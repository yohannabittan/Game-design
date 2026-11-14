#!/usr/bin/env node
// codemap: a generated index of a game's code, so a builder finds its way without reading the whole source.
//   node tools/codemap.mjs <slug>                 writes docs/games/<slug>/INDEX.md: every section, every top-level
//                                                 declaration with its file, line, size and what its comment says, and
//                                                 TUNING's blocks. Generated, never edited: run it after every landing.
//   node tools/codemap.mjs <slug> --where <word>  prints where a word is declared, which TUNING blocks carry it, and
//                                                 which functions use it (with counts), in place of a dozen greps.
//   node tools/codemap.mjs <slug> --check         exits 1 if INDEX.md is out of date, or if RECIPES.md names code that no
//                                                 longer exists. `npm run smoke` runs this for every game with an INDEX.md
//                                                 (in the main checkout; a builder's worktree only gets a note), and
//                                                 `tools/worktree.sh land` regenerates the index, so neither can go stale.
// Reads every .js under games/<slug>/src except engine.js, so it works for one game.js or for modules (ADR-0024).
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const [slug, flag, word] = process.argv.slice(2);
if (!slug) { console.error('usage: node tools/codemap.mjs <slug> [--where <word> | --check]'); process.exit(2); }
const SRC = join(ROOT, 'games', slug, 'src');
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : n.endsWith('.js') && n !== 'engine.js' ? [p] : []; });

// One pass per file: sections (// ====== NAME), top-level declarations, and the two-space keys of the TUNING object.
function scan(file) {
  const rel = relative(SRC, file), lines = readFileSync(file, 'utf8').split('\n');
  const decls = [], tuning = [];
  let section = '(top)', inTuning = false;
  const said = (i) => {
    // the comment block right above a declaration: its first sentence
    let j = i - 1; const c = [];
    while (j >= 0 && /^\/\/ ?/.test(lines[j]) && !/^\/\/ ={4,}/.test(lines[j])) c.unshift(lines[j--].replace(/^\/\/ ?/, ''));
    const t = c.join(' ').trim(), cut = t.search(/[.:;](\s|$)/);
    const s = cut > 20 ? t.slice(0, cut) : t;
    return s.length > 130 ? s.slice(0, 127) + '...' : s;
  };
  lines.forEach((l, i) => {
    const sec = l.match(/^\/\/ ={4,}\s*(.+?)\s*={4,}\s*$/);
    if (sec) { section = sec[1].split(':')[0].trim(); return; }
    const d = l.match(/^(?:export\s+)?(?:async\s+)?(function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/);
    if (d) {
      const fn = d[1].startsWith('function') || /^(?:export\s+)?(?:const|let)\s+[\w$]+\s*=\s*(?:async\s*)?(?:\([^)]*\)|[\w$]+)\s*=>/.test(l);
      decls.push({ file: rel, line: i + 1, name: d[2], kind: d[1] === 'class' ? 'class' : fn ? 'fn' : 'data', section, what: said(i) });
      inTuning = d[2] === 'TUNING';
    }
    if (inTuning) {
      const k = l.match(/^  ([A-Za-z_$][\w$]*):/);
      if (k) {
        const tail = (l.match(/\/\/\s*(.+)$/) || [])[1] || said(i);
        tuning.push({ file: rel, line: i + 1, key: k[1], what: tail.length > 130 ? tail.slice(0, 127) + '...' : tail });
      }
      if (/^};?\s*$/.test(l)) inTuning = false;
    }
  });
  decls.forEach((d, k) => { d.len = (decls[k + 1] ? decls[k + 1].line : lines.length + 1) - d.line; });
  return { rel, lines, decls, tuning };
}

const files = walk(SRC).sort().map(scan);
const decls = files.flatMap((f) => f.decls), tuning = files.flatMap((f) => f.tuning);

if (flag === '--where') {
  if (!word) { console.error('--where needs a word'); process.exit(2); }
  const re = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const out = [];
  const named = decls.filter((d) => re.test(d.name));
  if (named.length) { out.push('Declared:'); named.slice(0, 40).forEach((d) => out.push(`  ${d.file}:${d.line}  ${d.name}  (${d.kind}, ${d.len} lines)  ${d.what}`)); if (named.length > 40) out.push(`  ... and ${named.length - 40} more`); }
  const keys = tuning.filter((t) => re.test(t.key) || re.test(t.what));
  if (keys.length) { out.push('TUNING blocks:'); keys.slice(0, 20).forEach((t) => out.push(`  ${t.file}:${t.line}  TUNING.${t.key}  ${t.what}`)); }
  // uses, grouped by the declaration they sit in
  const uses = new Map();
  for (const f of files) {
    const ds = f.decls; let k = -1;
    f.lines.forEach((l, i) => {
      while (k + 1 < ds.length && ds[k + 1].line <= i + 1) k++;
      if (!re.test(l)) return;
      const d = k >= 0 ? ds[k] : { name: '(header)', line: 1, file: f.rel };
      const id = `${d.file}:${d.line}  ${d.name}`;
      const u = uses.get(id) || { n: 0, first: i + 1 }; u.n++; uses.set(id, u);
    });
  }
  const list = [...uses.entries()].sort((a, b) => b[1].n - a[1].n);
  if (list.length) { out.push(`Used in ${list.length} declarations:`); list.slice(0, 40).forEach(([id, u]) => out.push(`  ${id}  x${u.n}  (first at line ${u.first})`)); if (list.length > 40) out.push(`  ... and ${list.length - 40} more`); }
  console.log(out.length ? out.join('\n') : `nothing matches "${word}"`);
  process.exit(0);
}

// The index: sections in file order, each a table of its declarations; then TUNING's blocks.
const esc = (s) => String(s).replace(/\|/g, '\\|');
const total = files.reduce((a, f) => a + f.lines.length, 0);
const md = [`# ${slug}: code index`, '',
  `Generated by \`node tools/codemap.mjs ${slug}\`. Never edit it: run the tool again after every landing. ${files.length} file${files.length > 1 ? 's' : ''}, ${total} lines, ${decls.length} top-level declarations.`, '',
  `**To find something:** \`node tools/codemap.mjs ${slug} --where <word>\` prints where it is declared, the TUNING blocks that carry it, and the functions that use it.`, '',
  '## Sections', '', '| File | Section | From line | Declarations |', '| --- | --- | --- | --- |'];
const groups = [];
for (const d of decls) { const g = groups[groups.length - 1]; if (g && g.file === d.file && g.section === d.section) g.items.push(d); else groups.push({ file: d.file, section: d.section, items: [d] }); }
for (const g of groups) md.push(`| \`${g.file}\` | ${esc(g.section)} | ${g.items[0].line} | ${g.items.length} |`);
md.push('', '## TUNING blocks', '', '| Line | Block | What |', '| --- | --- | --- |');
for (const t of tuning) md.push(`| ${t.file === 'game.js' ? '' : t.file + ':'}${t.line} | \`${t.key}\` | ${esc(t.what)} |`);
for (const g of groups) {
  md.push('', `## ${g.file}: ${g.section}`, '', '| Line | Name | Kind | Lines | What |', '| --- | --- | --- | --- | --- |');
  for (const d of g.items) md.push(`| ${d.line} | \`${d.name}\` | ${d.kind} | ${d.len} | ${esc(d.what)} |`);
}
const out = md.join('\n') + '\n', dest = join(ROOT, 'docs', 'games', slug, 'INDEX.md');
// Names the recipes give in backticks must still exist: declared, a TUNING block, or a word in the game's source, its
// sw.js, the check helpers or tools/drive.mjs. Paths, commands and anything with a space are not names and are skipped.
function deadRecipeNames() {
  const rec = join(ROOT, 'docs', 'games', slug, 'RECIPES.md');
  if (!existsSync(rec)) return [];
  const extra = [join(ROOT, 'games', slug, 'sw.js'), join(ROOT, 'tools', 'checks', `${slug}.mjs`), join(ROOT, 'tools', 'drive.mjs')].filter(existsSync).map((f) => readFileSync(f, 'utf8'));
  const text = files.map((f) => f.lines.join('\n')).concat(extra).join('\n');
  const dead = new Set();
  for (const m of readFileSync(rec, 'utf8').matchAll(/`([^`\n]+)`/g)) {
    const t = m[1].replace(/\(\)$/, '');
    if (!/^[A-Za-z_$][\w$.]*$/.test(t)) continue;
    const last = t.split('.').pop();
    if (!text.includes(t) && !new RegExp(`\\b${last.replace(/\$/g, '\\$')}\\b`).test(text)) dead.add(m[1]);
  }
  return [...dead];
}
if (flag === '--check') {
  const fresh = existsSync(dest) && readFileSync(dest, 'utf8') === out, dead = deadRecipeNames();
  if (!fresh) console.log(`STALE ${slug}: INDEX.md is out of date; run node tools/codemap.mjs ${slug}`);
  if (dead.length) console.log(`STALE ${slug}: RECIPES.md names code that no longer exists: ${dead.join(', ')}`);
  if (fresh && !dead.length) console.log(`ok   ${slug}: INDEX.md is up to date, and every name in RECIPES.md exists`);
  process.exit(fresh && !dead.length ? 0 : 1);
}
writeFileSync(dest, out);
console.log(`wrote ${relative(ROOT, dest)}: ${groups.length} sections, ${decls.length} declarations, ${tuning.length} TUNING blocks, ${Math.round(out.length / 1024)} KB`);
const dead = deadRecipeNames();
if (dead.length) console.log(`WARN ${slug}: RECIPES.md names code that no longer exists: ${dead.join(', ')}`);
