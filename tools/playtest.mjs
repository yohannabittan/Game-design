#!/usr/bin/env node
// Reads an Arena export (the text the game's export button gives) and prints the runs, the trials and a summary.
// node tools/playtest.mjs <export.txt> [--last N] [--since <time prefix>] [--md]
import { readFileSync } from 'node:fs';
import { TUNING } from '../games/arena/src/tuning.js';

const args = process.argv.slice(2);
if (!args.length || args.includes('--help')) {
  console.log('usage: node tools/playtest.mjs <export.txt> [--last N] [--since <time prefix>] [--md]');
  process.exit(args.length ? 0 : 1);
}
let file = null, last = 5, since = null, md = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--last') last = +args[++i];
  else if (args[i] === '--since') since = args[++i];
  else if (args[i] === '--md') md = true;
  else file = args[i];
}

// Trials: what each score means (games/arena/src/features/trials.js, finish): a count, seconds to beat, or health left. Names are the game's.
const STOCK_HP = 12; // the stock fighter's health, the most a "health left" score can be
const TRIALS = {
  ironwall: { name: 'Iron Wall', unit: 'streak' },
  gaphunter: { name: 'Gap Hunter', unit: 'time' },
  breaker: { name: 'Breaker', unit: 'time' },
  knuckles: { name: 'Bare Knuckles', unit: 'hp' },
  stagger: { name: 'Stagger Him', unit: 'time' },
  brawl: { name: 'Brawl', unit: 'hp' },
  capuan: { name: 'The Capuan Feint', unit: 'reads', of: 5 },
  rage: { name: 'Weather the Rage', unit: 'hp' },
};
const MEDALS = ['none', 'bronze', 'silver', 'gold'];
const tuned = id => TUNING.trials[id];
const trialScore = t => +t.f.score;
const trialFailed = t => trialScore(t) < 0;
const trialResult = t => {
  const id = t.f.id, u = TRIALS[id].unit, v = trialScore(t);
  if (v < 0) return tuned(id).limit && +t.f.time >= tuned(id).limit ? 'ran out of time' : 'fell';
  if (u === 'time') return `${v.toFixed(1)} s`;
  if (u === 'hp') return `${v} of ${STOCK_HP} left`;
  if (u === 'reads') return `${v} of ${TRIALS[id].of} reads`;
  return `${v} in a row`;
};
const trialMedals = id => {
  const M = tuned(id).medals;
  return TRIALS[id].unit === 'time' ? M.map(x => `${x} s`).join(' / ') + ' (beat)' : M.join(' / ');
};
const trialBetter = (id, a, b) => (b === null ? true : TRIALS[id].unit === 'time' ? a < b : a > b);

const text = readFileSync(file, 'utf8');
const header = {};
const runs = [], trials = [];
let skipped = 0, lineNo = 0;
for (const line of text.split(/\r?\n/)) {
  lineNo++;
  const h = line.match(/^(Game|Channel|Version|Viewport|Date|Entries):\s*(.*)$/);
  if (h) { header[h[1]] = h[2]; continue; }
  const m = line.match(/^(\S+)\s+(result|trial)\s+(.*)$/);
  if (!m) continue;
  const f = {};
  for (const kv of m[3].matchAll(/(\w+)=("([^"]*)"|\S*)/g)) f[kv[1]] = kv[3] !== undefined ? kv[3] : kv[2];
  if (m[2] === 'trial') { if (TRIALS[f.id]) trials.push({ time: m[1], line: lineNo, f }); continue; }
  if (!('gapHits' in f) && !('reached' in f)) { skipped++; continue; }
  runs.push({ time: m[1], f });
}

const n = (r, k) => (r.f[k] === undefined || r.f[k] === '' ? 0 : +r.f[k]);
const has = (r, k) => r.f[k] !== undefined;
const buyParts = r => (r.f.buy || '').split(',').map(s => s.trim()).filter(Boolean);
const weapon = r => r.f.meWeapon || (buyParts(r)[0] || '').replace(/x2$/, '') || '?';
const dual = r => /x2/.test(buyParts(r)[0] || '');
const armour = r => {
  if (!has(r, 'meArmour')) return '?';
  const a = r.f.meArmour;
  if (a === 'none') return 'none';
  const p = (r.f.mePlates || '').split(',').filter(Boolean).length;
  return `${a} (${p} plate${p === 1 ? '' : 's'})`;
};
const arena = r => r.f.arena || '?';
const reached = r => (has(r, 'reached') ? n(r, 'reached') : null);
const beast = /^(young lion|lion|young bear|bear)\b/i;
const foe = r => {
  const s = r.f.lostTo;
  if (!s) return r.f.won === 'true' ? '(won)' : '?';
  const b = s.match(beast);
  if (b) return b[1][0].toUpperCase() + b[1].slice(1).toLowerCase();
  const w = s.split(' ');
  return w.length > 2 ? w.slice(0, -2).join(' ') : s;
};
const fighter = r => {
  if (!has(r, 'meSize')) return '?';
  return `${r.f.meName || '?'}, ${r.f.meSize}${r.f.meStats ? ' ' + r.f.meStats.split('').join('/') : ''}`;
};
const knives = r => (n(r, 'knives') ? `${n(r, 'knives')} (${n(r, 'knifeGaps')} gap)` : '');
const counts = r => [
  `${n(r, 'jabs')}/${n(r, 'slashes')}/${n(r, 'overheads')} j/s/o`,
  `${n(r, 'blocks')} bl (${n(r, 'perfects')} p)`,
  `${n(r, 'gapHits')} gap`,
  `${n(r, 'taken')} taken`,
  n(r, 'knives') ? `${n(r, 'knives')} knives, ${n(r, 'knifeGaps')} in gaps` : '',
  n(r, 'bleedDmg') ? `${n(r, 'bleedDmg')} bleed` : '',
].filter(Boolean).join(', ');

let sel = runs;
if (since) sel = sel.filter(r => r.time >= since || r.time.startsWith(since));
else sel = sel.slice(-last);

const rows = sel.map(r => ({
  time: r.time,
  arena: arena(r),
  fighter: fighter(r),
  weapon: weapon(r) + (dual(r) ? ' x2' : '') + (n(r, 'knives') ? ` +${n(r, 'knives')} knives` : ''),
  armour: armour(r),
  reach: reached(r) === null ? '?' : `${reached(r)}/5${r.f.won === 'true' ? ' won' : ''}`,
  lost: foe(r),
  counts: counts(r),
}));

let selTrials = trials;
if (since) selTrials = trials.filter(t => t.time >= since || t.time.startsWith(since));
else if (last > 0 && runs.length > last) selTrials = trials.filter(t => t.line > runs[runs.length - last].line);
const trialRows = selTrials.map(t => ({
  time: t.time, trial: TRIALS[t.f.id].name, result: trialResult(t), medal: MEDALS[+t.f.medal || 0], medals: trialMedals(t.f.id),
}));
const trialSummary = Object.keys(TRIALS).map(id => {
  const ts = selTrials.filter(t => t.f.id === id);
  if (!ts.length) return null;
  let best = null, bt = null, bm = 0;
  for (const t of ts) {
    bm = Math.max(bm, +t.f.medal || 0);
    if (!trialFailed(t) && trialBetter(id, trialScore(t), best)) { best = trialScore(t); bt = t; }
  }
  return `${TRIALS[id].name}: ${ts.length} ${ts.length === 1 ? 'try' : 'tries'}, best ${bt ? trialResult(bt) : 'none finished'}, best medal ${MEDALS[bm]}`;
}).filter(Boolean);
const trialHead = `Trials (${selTrials.length} of ${trials.length})`;

const tally = (arr, key) => {
  const m = new Map();
  for (const x of arr) m.set(key(x), (m.get(key(x)) || 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
};
const full = runs.filter(r => reached(r) !== null);
const byArena = new Map();
for (const r of full) (byArena.get(arena(r)) || byArena.set(arena(r), []).get(arena(r))).push(r);

const summary = [];
summary.push(['Runs', `${runs.length} Arena runs (${full.length} with full detail), ${skipped} other result lines skipped`]);
summary.push(['Per arena', [...byArena].map(([a, rs]) => {
  const ends = tally(rs.filter(r => r.f.won !== 'true'), r => reached(r)).sort((x, y) => x[0] - y[0]).map(([b, c]) => `bout ${b}: ${c}`).join(', ');
  const wins = rs.filter(r => r.f.won === 'true').length;
  return `${a}: ${rs.length} runs, ${wins} won; runs end at ${ends || 'none'}`;
})]);
summary.push(['Lost to', tally(full.filter(r => r.f.won !== 'true'), foe).slice(0, 8).map(([k, c]) => `${k} ${c}`).join(', ')]);
summary.push(['Weapon picks', tally(full.filter(r => has(r, 'meWeapon') || has(r, 'buy')), r => weapon(r) + (dual(r) ? ' x2' : '')).map(([k, c]) => `${k} ${c}`).join(', ')]);
summary.push(['Armour picks', tally(full.filter(r => has(r, 'meArmour')), r => r.f.meArmour).map(([k, c]) => `${k} ${c}`).join(', ')]);
const jw = new Map();
for (const r of runs.filter(r => has(r, 'jabs') && (has(r, 'meWeapon') || has(r, 'buy')))) {
  const w = weapon(r), e = jw.get(w) || { j: 0, s: 0, n: 0 };
  e.j += n(r, 'jabs'); e.s += n(r, 'slashes'); e.n++; jw.set(w, e);
}
summary.push(['Jab : slash', [...jw].sort((a, b) => b[1].n - a[1].n).map(([w, e]) => `${w} ${e.j}:${e.s} (${e.s ? (e.j / e.s).toFixed(2) : '-'}, ${e.n} runs)`).join('; ')]);

const head = `${header.Game || 'Arena'}, ${header.Channel || '?'} channel, ${header.Viewport || '?'}, exported ${header.Date || '?'}, ${header.Entries || '?'} entries`;
if (md) {
  console.log(`## Runs (${rows.length} of ${runs.length}; ${head})\n`);
  console.log('| Time | Arena | Fighter | Weapon | Armour | Reached | Lost to | Counts |\n| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const r of rows) console.log(`| ${r.time} | ${r.arena} | ${r.fighter} | ${r.weapon} | ${r.armour} | ${r.reach} | ${r.lost} | ${r.counts} |`);
  console.log('\n## Across the whole export\n');
  for (const [k, v] of summary) {
    if (Array.isArray(v)) { console.log(`- **${k}:**`); v.forEach(x => console.log(`  - ${x}`)); }
    else console.log(`- **${k}:** ${v}`);
  }
  if (trialRows.length) {
    console.log(`\n## ${trialHead}\n`);
    console.log('| Time | Trial | Result | Medal | Medals (bronze / silver / gold) |\n| --- | --- | --- | --- | --- |');
    for (const r of trialRows) console.log(`| ${r.time} | ${r.trial} | ${r.result} | ${r.medal} | ${r.medals} |`);
    console.log('');
    trialSummary.forEach(x => console.log(`- ${x}`));
  }
} else {
  console.log(head + '\n');
  const cols = ['time', 'arena', 'fighter', 'weapon', 'armour', 'reach', 'lost', 'counts'];
  const w = cols.map(c => Math.max(c.length, ...rows.map(r => String(r[c]).length)));
  const fmt = r => cols.map((c, i) => String(r[c]).padEnd(w[i])).join('  ');
  console.log(fmt(Object.fromEntries(cols.map(c => [c, c]))));
  for (const r of rows) console.log(fmt(r));
  console.log('');
  for (const [k, v] of summary) {
    if (Array.isArray(v)) { console.log(k + ':'); v.forEach(x => console.log('  ' + x)); }
    else console.log(`${k}: ${v}`);
  }
  if (trialRows.length) {
    console.log(`\n${trialHead}`);
    const tc = ['time', 'trial', 'result', 'medal', 'medals'];
    const tw = tc.map(c => Math.max(c.length, ...trialRows.map(r => String(r[c]).length)));
    const tf = r => tc.map((c, i) => String(r[c]).padEnd(tw[i])).join('  ');
    console.log(tf(Object.fromEntries(tc.map(c => [c, c]))));
    for (const r of trialRows) console.log(tf(r));
    console.log('');
    trialSummary.forEach(x => console.log(x));
  }
}
