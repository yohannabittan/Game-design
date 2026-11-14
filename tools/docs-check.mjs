#!/usr/bin/env node
// docs-check: checks that the repo's own documents and tools still describe the repo, so the method does not rot quietly.
//   node tools/docs-check.mjs      prints one line per finding; exits 1 on any FAIL (a WARN does not fail).
// `npm run smoke` runs it (FAILs count in the main checkout; a builder's worktree only gets notes).
// FAIL: a statement that is now false and that a session would act on.
//   - a repo path named in CLAUDE.md, docs/process.md or docs/team.md that does not exist
//   - a tool in tools/ that docs/team.md's table doesn't assign to anyone
//   - an ADR file missing from docs/adr/README.md
//   - a game whose current CACHE_VERSION is not in its CHANGELOG.md (CLAUDE.md rule 11)
// WARN: drift worth a look at the next retro (docs/process.md, "Keep the method alive").
//   - docs/HANDOFF-orchestrator.md names an older version of a game than the one shipped
//   - a tool in tools/ that neither CLAUDE.md, docs/process.md nor its own header comment explains
//   - a process document nobody has touched for 30 days while the games kept changing
//   - docs/team.md's "Reviewed on" date is more than 30 days old
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const has = (p) => existsSync(join(ROOT, p));
const out = [];
const FAIL = (m) => out.push(`FAIL docs-check: ${m}`), WARN = (m) => out.push(`WARN docs-check: ${m}`);

// 1. Paths named in CLAUDE.md and docs/process.md exist (placeholders like <slug> are skipped; a path inside a longer
// command counts too, so `node tools/x.mjs page ...` is checked).
const claude = read('CLAUDE.md');
for (const doc of ['CLAUDE.md', 'docs/process.md', 'docs/team.md']) {
  if (!has(doc)) continue;
  const seen = new Set();
  for (const m of read(doc).matchAll(/`([^`\n]+)`/g)) for (const w of m[1].split(/\s+/)) {
    const t = w.replace(/[,;:.)]+$/, '').replace(/\/$/, '');
    if (!/^(tools|docs|prompts|templates|skeleton|games)\/[A-Za-z0-9_./-]+$/.test(t) || seen.has(t)) continue;
    seen.add(t);
    if (!has(t)) FAIL(`${doc} names \`${t}\`, which does not exist`);
  }
}

// 2. Every ADR is in the index.
const adrIndex = read('docs/adr/README.md');
for (const f of readdirSync(join(ROOT, 'docs/adr'))) if (/^\d{4}-/.test(f) && !adrIndex.includes(f)) FAIL(`docs/adr/${f} is not in docs/adr/README.md`);

// 3. Each game's shipped version is in its changelog; 4. the orchestrator's handoff is not behind it.
const handoff = has('docs/HANDOFF-orchestrator.md') ? read('docs/HANDOFF-orchestrator.md') : '';
for (const slug of readdirSync(join(ROOT, 'games'))) {
  const sw = `games/${slug}/sw.js`, cl = `docs/games/${slug}/CHANGELOG.md`;
  if (!has(sw)) continue;
  const v = (read(sw).match(/CACHE_VERSION\s*=\s*'([^']+)'/) || [])[1];
  if (!v) continue;
  if (has(cl) && !read(cl).includes(v)) FAIL(`${cl} has no line for the shipped ${v}`);
  const base = v.replace(/\d+$/, ''), now = +(v.match(/(\d+)$/) || [0, 0])[1];
  const said = [...handoff.matchAll(new RegExp(base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\d+)', 'g'))].map((m) => +m[1]);
  if (said.length && Math.max(...said) < now) WARN(`docs/HANDOFF-orchestrator.md says ${base}${Math.max(...said)}; the game is at ${v}`);
}

// 5a. Every tool has an owner: docs/team.md's table says which roles use it.
const team = has('docs/team.md') ? read('docs/team.md') : null;
if (team != null) {
  const list = (d) => readdirSync(join(ROOT, d)).flatMap((f) => (statSync(join(ROOT, d, f)).isDirectory() ? (f === 'replays' ? [] : list(`${d}/${f}`)) : [`${d}/${f}`]));
  for (const f of list('tools')) if (!team.includes(f)) FAIL(`${f} is not in docs/team.md's table of tools and who uses them`);
}

// 5. Every tool is explained somewhere.
const process_ = has('docs/process.md') ? read('docs/process.md') : '';
for (const f of readdirSync(join(ROOT, 'tools'))) {
  const p = join(ROOT, 'tools', f);
  if (!statSync(p).isFile()) continue;
  const head = readFileSync(p, 'utf8').split('\n').slice(0, 4).join('\n');
  if (!claude.includes(f) && !process_.includes(f) && !/^\s*(\/\/|#(?!!))\s*\S/m.test(head)) WARN(`tools/${f} is not explained in CLAUDE.md, docs/process.md or its own header`);
}

// 5b. The team file's own review date: the cards are read through at each retro, and the date moved.
if (team != null) {
  const d = (team.match(/Reviewed on (\d{4}-\d{2}-\d{2})/) || [])[1];
  if (!d) WARN('docs/team.md has no "Reviewed on YYYY-MM-DD" date');
  else if ((Date.now() - Date.parse(d)) / 86400000 > 30) WARN(`docs/team.md was last reviewed on ${d}, more than 30 days ago; read the cards through at the next retro`);
}

// 6. Process documents left alone for 30 days while games changed.
const age = (p) => { try { const t = execFileSync('git', ['log', '-1', '--format=%ct', '--', p], { cwd: ROOT }).toString().trim(); return t ? (Date.now() / 1000 - +t) / 86400 : null; } catch { return null; } };
const gamesAge = age('games');
for (const p of ['docs/process.md', 'docs/HANDOFF-orchestrator.md', 'docs/art/BRIEF.md', 'prompts', 'skeleton/README.md']) {
  const a = age(p);
  if (a != null && gamesAge != null && a > 30 && gamesAge < 7) WARN(`${p} was last changed ${Math.round(a)} days ago; check it still describes how the work is done`);
}

console.log(out.length ? out.join('\n') : 'ok   docs-check: the documents and tools still describe the repo');
process.exit(out.some((l) => l.startsWith('FAIL')) ? 1 : 0);
