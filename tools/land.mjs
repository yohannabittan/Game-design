#!/usr/bin/env node
// land: lands a builder's worktree in one command, the steps in order, stopping at the first failure.
//   node tools/land.mjs <slug> <worktree-name> --paths a,b,c --msg "Arena v82: ..." --change "changelog text"
//        [--note "line" ...] [--trailer-file f] [--accept-replays] [--estimate "<agent description>"]
//        [--live-from <ISO time>] [--recipe "line" ...] [--dry-run]
// Steps: merge the paths (tools/worktree.sh land) -> git rm what the builder deleted -> bump CACHE_VERSION in
// games/<slug>/sw.js -> notes.js entry and RULES.md line 3 (games that have them) -> changelog line -> HANDOFF version ->
// RECIPES line -> codemap -> replays --accept (if asked) -> npm run check <slug> -> npm run smoke -> estimates.csv ->
// usage.py -> drop the worktree -> stage ONLY the landed paths and the files above -> commit -> push.
// --note: a line of the notes.js entry (a thing to try, in plain words); repeat it for two to five lines.
// --live-from: when the work was dispatched, so the estimates row gets its minutes to live. --dry-run changes nothing.
// Plain Node, no dependencies. Run it from the repo root's tools/ (the root is this file's parent's parent).
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { values: o, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    paths: { type: 'string' }, msg: { type: 'string' }, change: { type: 'string' },
    note: { type: 'string', multiple: true }, recipe: { type: 'string', multiple: true },
    'trailer-file': { type: 'string' }, 'accept-replays': { type: 'boolean' },
    estimate: { type: 'string' }, 'live-from': { type: 'string' }, 'dry-run': { type: 'boolean' },
  },
});
const [slug, wtName] = positionals;
const DRY = !!o['dry-run'];
const die = (m) => { console.error(`STOP: ${m}`); process.exit(1); };
if (!slug || !wtName || !o.paths || !o.msg || !o.change) {
  die('usage: node tools/land.mjs <slug> <worktree-name> --paths a,b --msg "..." --change "..." [--note "..."]... [--trailer-file f] [--accept-replays] [--estimate "..."] [--live-from ISO] [--recipe "..."]... [--dry-run]');
}
const WT = path.join(path.dirname(ROOT), `wt-${wtName}`);
const rel = (p) => p.replace(/^\.\//, '').replace(/\/+$/, '');
const paths = o.paths.split(',').map((s) => rel(s.trim())).filter(Boolean);
const abs = (p) => path.join(ROOT, p);
const exists = (p) => fs.existsSync(abs(p));
const read = (p) => fs.readFileSync(abs(p), 'utf8');
const write = (p, s) => { if (!DRY) fs.writeFileSync(abs(p), s); };

function run(cmd, args, opt = {}) {
  const r = spawnSync(cmd, args, { cwd: opt.cwd || ROOT, encoding: 'utf8', maxBuffer: 1 << 28, timeout: opt.timeout || 0 });
  return { code: r.status ?? 1, out: (r.stdout || '') + (r.stderr || ''), stdout: r.stdout || '', stderr: r.stderr || '' };
}
const git = (...a) => run('git', a);
const lastLine = (s) => s.trim().split('\n').filter(Boolean).pop() || '';
const tail = (s, n = 40) => s.trim().split('\n').slice(-n).join('\n');

let stepNo = 0;
const step = (label, detail = '') => console.log(`${String(++stepNo).padStart(2)}. ${DRY ? '[dry] ' : ''}${label}${detail ? ': ' + detail : ''}`);
const warnings = [];
const touched = new Set();   // files this command changes, besides the landed paths
const touch = (...f) => f.forEach((x) => touched.add(x));

// ---- facts ----
const swPath = `games/${slug}/sw.js`;
if (!exists(swPath)) die(`no ${swPath}`);
const swNow = read(swPath);
const mv = swNow.match(/const CACHE_VERSION = '([a-z0-9-]+)-v(\d+)'/);
if (!mv) die(`cannot read CACHE_VERSION in ${swPath}`);
const oldN = +mv[2], newN = oldN + 1, newVer = `${mv[1]}-v${newN}`;
const notesPath = `games/${slug}/src/notes.js`, rulesPath = `docs/games/${slug}/RULES.md`;
const changelogPath = `docs/games/${slug}/CHANGELOG.md`, recipesPath = `docs/games/${slug}/RECIPES.md`;
const handoffPath = 'docs/HANDOFF-orchestrator.md', estPath = 'docs/usage/estimates.csv', indexPath = `docs/games/${slug}/INDEX.md`;
const hasNotes = exists(notesPath);
if (hasNotes && !(o.note || []).length) die(`${slug} has a notes.js: give one to five --note lines`);
if (!fs.existsSync(WT)) die(`no worktree ${WT}`);
if (!exists(changelogPath)) die(`no ${changelogPath}`);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const now = new Date(), dateStr = `${now.getDate()} ${MON[now.getMonth()]}`;
const branch = git('branch', '--show-current').stdout.trim();
if (!branch && !DRY) die('detached HEAD: check out the branch to push first');
let trailer = '';
if (o['trailer-file']) { try { trailer = fs.readFileSync(o['trailer-file'], 'utf8').trim(); } catch { die(`cannot read ${o['trailer-file']}`); } }
const liveFrom = o['live-from'] ? new Date(o['live-from']) : null;
if (liveFrom && isNaN(liveFrom)) die(`bad --live-from: ${o['live-from']}`);

// ---- 0. a clean start: nothing this command edits may already be dirty ----
const dirty = () => git('status', '--porcelain', '-z', '--untracked-files=all').stdout.split('\0').filter(Boolean).map((l) => l.slice(3));
const willEdit = [swPath, changelogPath, handoffPath, estPath, indexPath, 'docs/usage'];
if (hasNotes) willEdit.push(notesPath);
if (exists(rulesPath)) willEdit.push(rulesPath);
if (o.recipe) willEdit.push(recipesPath);
const under = (f, p) => f === p || f.startsWith(p + '/');
const before = dirty();
const clash = before.filter((f) => [...willEdit, ...paths].some((p) => under(f, p)));
if (clash.length) {
  const m = `uncommitted changes in files this landing edits (commit or stash them first): ${clash.join(', ')}`;
  if (DRY) console.log(`0. [dry] !! would stop: ${m}`); else die(m);
} else console.log(`0. ${DRY ? '[dry] ' : ''}clean start on ${branch || '(detached HEAD: a real run would stop)'}; building ${newVer} (was ${mv[1]}-v${oldN})`);

// ---- 1. land the paths ----
const base = run('git', ['rev-parse', 'HEAD'], { cwd: WT }).stdout.trim();
const gone = run('git', ['diff', '--name-only', '--diff-filter=D', base, '--', ...paths], { cwd: WT }).stdout.split('\n').filter(Boolean);
const goneSet = new Set(gone);
const keep = paths.filter((p) => fs.existsSync(path.join(WT, p)));
const deletedPaths = paths.filter((p) => !fs.existsSync(path.join(WT, p)) && git('ls-files', '--', p).stdout.trim());
deletedPaths.forEach((p) => goneSet.add(p));
if (DRY) {
  step('merge the worktree', `${keep.length} path(s), three-way against ${base.slice(0, 8)}`);
  for (const p of keep) {
    const ch = run('git', ['diff', '--name-status', base, '--', p], { cwd: WT }).stdout.trim();
    const nw = run('git', ['ls-files', '-o', '--exclude-standard', '--', p], { cwd: WT }).stdout.trim();
    const lines = [ch, nw && nw.split('\n').map((f) => `A?\t${f}`).join('\n')].filter(Boolean).join('\n');
    console.log(lines ? lines.split('\n').map((l) => `      ${l}`).join('\n') : `      (no change in ${p})`);
  }
} else {
  step('merge the worktree', `tools/worktree.sh land ${wtName} ${keep.join(' ')}`);
  if (!keep.length) die('no path exists in the worktree');
  const r = run('bash', [abs('tools/worktree.sh'), 'land', wtName, ...keep]);
  console.log(r.out.trim().split('\n').filter(Boolean).map((l) => `      ${l}`).join('\n'));
  if (r.code !== 0) die('worktree.sh land failed (a CONFLICT needs resolving by hand; nothing was committed)');
}
// ---- 2. deletions ----
if (goneSet.size) {
  step('remove what the builder deleted', [...goneSet].join(', '));
  for (const f of goneSet) {
    if (DRY) continue;
    const r = git('rm', '-q', '-f', '--', f);
    if (r.code !== 0 && exists(f)) fs.rmSync(abs(f), { recursive: true, force: true });
  }
} else step('deleted files', 'none');

// ---- 3. cache version ----
step('bump CACHE_VERSION', `${swPath}: ${mv[1]}-v${oldN} -> ${newVer}`);
touch(swPath);
write(swPath, swNow.replace(mv[0], `const CACHE_VERSION = '${newVer}'`));

// ---- 4. notes.js and RULES.md ----
if (hasNotes) {
  const q = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const entry = `  { v: ${newN}, date: '${dateStr}', lines: [${o.note.map(q).join(', ')}] },`;
  const src = read(notesPath), head = 'export const NOTES = [\n';
  if (!src.includes(head)) die(`${notesPath}: cannot find "export const NOTES = ["`);
  step('notes.js entry on top', entry.trim().slice(0, 110) + (entry.length > 112 ? '...' : ''));
  write(notesPath, src.replace(head, head + entry + '\n'));
  touch(notesPath);
} else step('notes.js', `${slug} has none; skipped`);
if (exists(rulesPath)) {
  const ls = read(rulesPath).split('\n'), re = new RegExp(`build \`${slug}-v\\d+\``);
  if (ls[2] && re.test(ls[2])) {
    ls[2] = ls[2].replace(re, `build \`${newVer}\``);
    step('RULES.md line 3', `build \`${newVer}\``);
    write(rulesPath, ls.join('\n')); touch(rulesPath);
  } else warnings.push(`${rulesPath} line 3 has no build \`${slug}-vN\`; left alone`);
}

// ---- 5. changelog, handoff, recipes ----
{
  const cl = read(changelogPath);
  step('changelog line', `- ${o.change}`.slice(0, 110));
  write(changelogPath, cl + (cl.endsWith('\n') ? '' : '\n') + `- ${o.change}\n`); touch(changelogPath);
}
if (exists(handoffPath)) {
  const h = read(handoffPath), re = new RegExp(`^(\\|[^|]*\\|\\s*)\`${slug}-v\\d+\``, 'm');
  if (re.test(h)) { step('HANDOFF version', `${newVer}`); write(handoffPath, h.replace(re, `$1\`${newVer}\``)); touch(handoffPath); }
  else warnings.push(`${handoffPath}: no versions-table row for ${slug}; not updated`);
}
if (o.recipe && o.recipe.length) {
  if (exists(recipesPath)) {
    let r = read(recipesPath);
    const hd = '## Found while building';
    if (!r.includes(hd)) r = r.replace(/\s*$/, '\n') + `\n${hd}\n\n`;
    r = r.replace(/\s*$/, '\n') + o.recipe.map((x) => `- ${x}\n`).join('');
    step('RECIPES lines', `${o.recipe.length} under "${hd}"`);
    write(recipesPath, r); touch(recipesPath);
  } else warnings.push(`${recipesPath} does not exist; --recipe lines not saved`);
}

// ---- 6. the index, the replays, the checks, the smoke test ----
const quiet = (label, cmd, args, ok) => {
  step(label, `${cmd} ${args.join(' ')}`);
  if (DRY) return;
  const r = run(cmd, args, { timeout: 25 * 60 * 1000 });
  if (r.code !== 0) { console.error(tail(r.out)); die(`${label} failed (exit ${r.code}); nothing was committed or pushed`); }
  console.log(`      ${lastLine(r.out) || 'ok'}`);
};
if (exists(indexPath)) { quiet('code index', 'node', ['tools/codemap.mjs', slug]); touch(indexPath); }
else step('code index', `no ${indexPath}; skipped`);
if (o['accept-replays']) { quiet('store the new replay hashes', 'node', ['tools/checks/run.mjs', slug, 'replays', '--accept']); touch('tools/checks/replays'); }
quiet(`checks (${slug})`, 'npm', ['run', 'check', slug]);
quiet('smoke test', 'npm', ['run', 'smoke']);

// ---- 7. estimates and the ledger ----
let minutes = null;
if (liveFrom) minutes = Math.max(0, Math.round((Date.now() - liveFrom.getTime()) / 60000));
if (o.estimate) {
  if (!exists(estPath)) warnings.push(`${estPath} missing; estimate not updated`);
  else {
    const split = (l) => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((t) => t.replace(/,$/, '')).slice(0, -1);
    const lines = read(estPath).split('\n');
    let hit = -1;
    lines.forEach((l, i) => { if (i && l.trim() && split(l)[1] === o.estimate) hit = i; });
    if (hit < 0) warnings.push(`no estimates.csv row for agent "${o.estimate}"`);
    else {
      const f = split(lines[hit]);
      while (f.length < 9) f.push('');
      f[5] = 'yes';
      if (minutes !== null) f[7] = String(minutes);
      lines[hit] = f.join(',');
      step('estimates.csv', `row "${o.estimate}": done${minutes !== null ? `, ${minutes} min to live` : ''}`);
      write(estPath, lines.join('\n')); touch(estPath);
    }
  }
}
quiet('token ledger', 'python3', ['tools/usage.py']); touch('docs/usage');

// ---- 8. drop the worktree ----
step('drop the worktree', `tools/worktree.sh drop ${wtName}`);
if (!DRY) { const r = run('bash', [abs('tools/worktree.sh'), 'drop', wtName]); if (r.code !== 0) warnings.push(`worktree drop failed: ${lastLine(r.out)}`); }

// ---- 9. stage only what is ours ----
const ours = [...paths, ...touched];
const isOurs = (f) => ours.some((p) => under(f, p)) || goneSet.has(f) || [...goneSet].some((g) => under(f, g));
if (DRY) {
  step('stage', `only: ${ours.join(', ')}`);
} else {
  const stray = dirty().filter((f) => !isOurs(f));
  const add = ours.filter((p) => exists(p) || git('ls-files', '--', p).stdout.trim());
  const r = git('add', '--', ...add);
  if (r.code !== 0) die(`git add failed: ${r.out.trim()}`);
  const staged = git('diff', '--cached', '--name-only').stdout.split('\n').filter(Boolean);
  step('stage', `${staged.length} file(s); never git add -A`);
  if (stray.length) warnings.push(`left alone (not part of this landing): ${stray.join(', ')}`);
  if (!staged.length) die('nothing staged');
}

// ---- 10. commit ----
step('commit', o.msg.slice(0, 100));
let hash = '(dry run)';
if (!DRY) {
  const f = path.join(os.tmpdir(), `land-msg-${process.pid}.txt`);
  fs.writeFileSync(f, `${o.msg}\n${trailer ? `\n${trailer}\n` : ''}`);
  const r = git('commit', '-q', '-F', f);
  fs.rmSync(f, { force: true });
  if (r.code !== 0) die(`git commit failed: ${r.out.trim()}`);
  hash = git('rev-parse', '--short', 'HEAD').stdout.trim();
  console.log(`      ${hash}`);
}

// ---- 11. push ----
step('push', `git push -u origin ${branch}`);
if (!DRY) {
  const sleep = (s) => spawnSync('sleep', [String(s)]);
  const NET = /could not resolve|connection|timed out|unable to access|rpc failed|early eof|remote end hung up|temporarily|http 5|returned error: 5/i;
  let pulled = false, done = false, net = 0;
  for (let i = 0; i < 12 && !done; i++) {
    const r = git('push', '-u', 'origin', branch);
    if (r.code === 0) { done = true; break; }
    if (/rejected|non-fast-forward|fetch first|failed to push some refs/i.test(r.out) && !NET.test(r.out) && !pulled) {
      console.log('      rejected: git pull --no-rebase, then push again');
      const p = git('pull', '--no-rebase', '--no-edit');
      if (p.code !== 0) die(`git pull --no-rebase failed (resolve by hand, then push): ${tail(p.out, 10)}`);
      pulled = true; continue;
    }
    if (NET.test(r.out) && net < 4) { const w = 2 ** (net + 1); console.log(`      network error, retry ${net + 1} of 4 in ${w}s`); sleep(w); net++; pulled = false; continue; }
    die(`push failed (the commit ${hash} is made locally): ${tail(r.out, 10)}`);
  }
  if (!done) die(`push did not go through (commit ${hash} is local)`);
}

// ---- done ----
if (warnings.length) console.log('\nWarnings:\n' + warnings.map((w) => `  - ${w}`).join('\n'));
console.log(`\n${DRY ? 'DRY RUN, nothing changed. Would land' : 'Landed'}: ${newVer}, commit ${hash}, ${minutes !== null ? `${minutes} min to live` : 'minutes to live not set (no --live-from)'}`);
