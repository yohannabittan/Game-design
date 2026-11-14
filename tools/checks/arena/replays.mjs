// ADR-0024's recorded runs (tools/checks/replays/*.json): each plays twice to the same dump, and the dump's hash matches the one stored beside its
// script (<name>.hash). A build meant to change play changes the hashes: run `node tools/checks/run.mjs arena replays --accept` to store the new
// ones, and say so in the changelog. A build that isn't meant to change play never accepts.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { replay } from '../../replay.mjs';
import { ROOT } from '../arena.mjs';

const DIR = join(ROOT, 'tools/checks/replays');
const hash = (d) => createHash('sha256').update(JSON.stringify(d)).digest('hex').slice(0, 16);

export default async function (t) {
  const names = ['pit', 'city', 'rome'];
  const runs = await Promise.all(names.map(async (n) => {
    const script = JSON.parse(readFileSync(join(DIR, `${n}.json`), 'utf8'));
    const [a, b] = await Promise.all([replay(script, { root: ROOT }), replay(script, { root: ROOT })]);
    return { n, a, b };
  }));
  for (const { n, a, b } of runs) {
    const ha = hash(a), hb = hash(b), file = join(DIR, `${n}.hash`), stored = existsSync(file) ? readFileSync(file, 'utf8').trim() : null;
    t.ok(`${n}: plays with no console errors`, !a.errors.length, a.errors.slice(0, 3).join(' | '));
    t.ok(`${n}: two plays give the same dump`, ha === hb, `the dumps differ (${ha} and ${hb}): something in play isn't on the fake clock or the seeded Math.random`);
    if (t.flags.has('--accept') && ha === hb) { writeFileSync(file, ha + '\n'); t.ok(`${n}: hash accepted (${ha})`, true); continue; }
    t.ok(`${n}: the dump matches its stored hash`, stored === ha,
      `stored ${stored}, now ${ha}: this build changed play. If it was meant to, accept with: node tools/checks/run.mjs arena replays --accept`);
  }
}
