#!/usr/bin/env node
// The permanent check suite (docs/process.md, "Guard rails", rule 2): runs every check file in tools/checks/<slug>/, a line per check, then a count.
//   node tools/checks/run.mjs arena               every file, a few at a time
//   node tools/checks/run.mjs arena <name> ...    only those files (strike, yard, ...)
//   node tools/checks/run.mjs arena replays --accept    store the replays' new hashes (a build meant to change play)
// Exits 1 on any failure. A check file exports `default async function (t)`; see tools/checks/README.md.
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { boot } from './exact.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const jobsAt = args.indexOf('--jobs');
const JOBS = jobsAt >= 0 ? +args[jobsAt + 1] : 4;
const flags = new Set(args.filter((a) => a.startsWith('--')));
const [slug, ...names] = args.filter((a, i) => !a.startsWith('--') && !(jobsAt >= 0 && i === jobsAt + 1));
if (!slug) { console.error('usage: node tools/checks/run.mjs <slug> [file ...] [--accept] [--jobs N]'); process.exit(2); }
const dir = join(HERE, slug);
const all = readdirSync(dir).filter((f) => f.endsWith('.mjs') && !f.startsWith('_')).map((f) => f.slice(0, -4)).sort();
const files = names.length ? names : all;
for (const n of files) if (!all.includes(n)) { console.error(`no check file ${slug}/${n}.mjs (have: ${all.join(', ')})`); process.exit(2); }

const show = (v) => { const s = JSON.stringify(v); return s === undefined ? String(v) : s.length > 160 ? s.slice(0, 157) + '...' : s; };

async function runFile(name) {
  const lines = [], games = [];
  let pass = 0, fail = 0, known = 0;
  const say = (ok, what, detail) => { if (ok) pass++; else fail++; lines.push(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${what}${ok || !detail ? '' : `\n       ${detail}`}`); };
  const t = {
    flags,
    // a game on the fake clock; closed, and its console checked for errors, when the file ends
    async boot(o) { const g = await boot(o); games.push(g); return g; },
    ok: (what, cond, detail = '') => say(!!cond, what, detail),
    eq: (what, got, want) => say(isDeepStrictEqual(got, want), what, `expected ${show(want)}, got ${show(got)}`),
    // a predicate on a value, with the value shown when it fails: t.is('x is small', v, (v) => v < 3, 'under 3')
    is: (what, got, pred, want) => say(!!pred(got), what, `expected ${want}, got ${show(got)}`),
    // a bug reported and not yet fixed: listed as KNOWN while it fails (not a failure), and flagged once it passes, to be made a plain t.ok
    known: (what, cond, detail = '') => {
      if (cond) { pass++; lines.push(`ok   ${name}: ${what} (a known bug that now passes: make it t.ok)`); }
      else { known++; lines.push(`KNOWN ${name}: ${what}\n       ${detail}`); }
    },
  };
  const t0 = Date.now();
  try {
    const mod = await import(pathToFileURL(join(dir, `${name}.mjs`)).href);
    await mod.default(t);
  } catch (e) {
    say(false, 'ran to the end', (e && e.stack || String(e)).split('\n').slice(0, 4).join('\n       '));
  }
  for (const g of games) {
    const errs = g.errors();
    say(!errs.length, `no console errors (${g.w}x${g.h})`, errs.slice(0, 3).join(' | '));
    await g.close().catch(() => {});
  }
  return { name, lines, pass, fail, known, s: (Date.now() - t0) / 1000 };
}

const t0 = Date.now(), results = new Array(files.length);
let next = 0;
await Promise.all(Array.from({ length: Math.min(JOBS, files.length) }, async () => {
  while (next < files.length) { const i = next++; results[i] = await runFile(files[i]); }
}));
let pass = 0, fail = 0, known = 0;
for (const r of results) {
  for (const l of r.lines) console.log(l);
  pass += r.pass; fail += r.fail; known += r.known;
}
const secs = ((Date.now() - t0) / 1000).toFixed(0);
console.log(`\n${slug}: ${pass} ok, ${fail} failed${known ? `, ${known} known bugs` : ''}, in ${secs} s (${results.map((r) => `${r.name} ${r.s.toFixed(0)} s`).join(', ')})`);
process.exit(fail ? 1 : 0);
