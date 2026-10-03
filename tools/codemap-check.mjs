#!/usr/bin/env node
// codemap-check: warns when an anchor named in a CODEMAP.md no longer exists in the game's game.js.
//   node tools/codemap-check.mjs [slug ...] [--strict]     (default: every docs/games/*/CODEMAP.md; --strict exits 1 on a warning)
// An anchor is a backticked name in the last column of the map's table. It counts as present when game.js declares it
// (const, let, var, function, class), or has it as a method or object key at the start of a line. It also reports how many
// anchors now sit outside their section's stated line range, which is the signal to refresh the map's line numbers.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const args = process.argv.slice(2);
const strict = args.includes('--strict');
let slugs = args.filter((a) => !a.startsWith('--'));
if (!slugs.length) slugs = readdirSync(resolve(ROOT, 'docs/games'), { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(resolve(ROOT, 'docs/games', d.name, 'CODEMAP.md'))).map((d) => d.name);

let warnings = 0;
for (const slug of slugs) {
  const mapFile = resolve(ROOT, 'docs/games', slug, 'CODEMAP.md');
  const srcFile = resolve(ROOT, 'games', slug, 'src/game.js');
  if (!existsSync(mapFile) || !existsSync(srcFile)) { console.log(`warn ${slug}: missing ${existsSync(mapFile) ? srcFile : mapFile}`); warnings++; continue; }
  const src = readFileSync(srcFile, 'utf8').split('\n');
  const where = (name) => {
    const rx = new RegExp(`^\\s*(?:(?:export\\s+)?(?:const|let|var|function|class)\\s+${name}\\b|(?:async\\s+)?${name}\\s*\\(|${name}\\s*:)`);
    const at = [];
    src.forEach((l, i) => { if (rx.test(l)) at.push(i + 1); });
    return at;
  };
  let total = 0, missing = 0, drifted = 0;
  for (const row of readFileSync(mapFile, 'utf8').split('\n')) {
    const m = row.match(/^\|\s*(\d+)-(\d+)\s*\|.*\|([^|]*)\|\s*$/);
    if (!m) continue;
    const [lo, hi] = [+m[1], +m[2]];
    for (const [, name] of m[3].matchAll(/`([A-Za-z_$][\w$]*)`/g)) {
      total++;
      const at = where(name);
      if (!at.length) { missing++; warnings++; console.log(`warn ${slug}: anchor \`${name}\` (lines ${lo}-${hi}) not found in game.js`); }
      else if (!at.some((n) => n >= lo && n <= hi)) { drifted++; if (args.includes("--verbose")) console.log(`  drift ${slug}: `+"`"+name+"`"+` is at ${at.join(",")}, stated ${lo}-${hi}`); }
    }
  }
  const note = drifted ? `, ${drifted} outside their stated ranges (refresh the line numbers)` : '';
  console.log(`${missing ? 'WARN' : 'ok  '} ${slug}: ${total - missing}/${total} anchors found${note}`);
}
process.exit(strict && warnings ? 1 : 0);
