#!/usr/bin/env node
// verify: the plumbing every verifier rewrites, one command each. Compares a BASE tree (default: the main checkout) with a CANDIDATE tree
// (default: the checkout this file sits in, so run it from the builder's worktree, or pass --cand). Arena only for now.
//   node tools/verify.mjs save    --base <dir> --cand <dir> [--bout 3 --arena city --weapon axe --dual --side spear --knives 2 --kit chest,helmet --menu]
//   node tools/verify.mjs replays --base <dir> --cand <dir> [--only pit,city,rome --ignore time,foo --dump <dir>]
//   node tools/verify.mjs strokes --base <dir> --cand <dir> [--weapons spear,axe --strokes JAB,SLASH --rests 0,12 --dual 0,1 --sizes medium --views 667x375]
//   node tools/verify.mjs shots   --base <dir> --cand <dir> [--weapon gladius --frames 60 --stroke JAB --out shots.png]
// `node tools/verify.mjs --help` says more. Everything runs on the fake clock (tools/replay.mjs), so two runs of one command agree.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { replay } from './replay.mjs';
import { boot, bout } from './checks/exact.mjs';
import { VET } from './checks/arena.mjs';
import { loadPlaywright } from './drive.mjs';

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const HELP = `verify: base build against candidate build, in one command each (Arena).

Trees: --base <dir>   the build before the change (default: the main checkout, ${mainCheckout()})
       --cand <dir>   the build with the change (default: the checkout this tool sits in: ${HERE})

save      An old save into the new build. Makes a save on BASE (a run mid-bout, or a plain menu save), loads it in CAND, plays a few
          seconds with input, and reports: the save version on each side, whether the run resumed with the same fighter, bout and
          loadout, and any console or page errors.
  --bout N        the bout the run is at, 1-based (default 3)      --arena pit|city|rome|games (default city)
  --weapon W      gladius, spear, axe, mace, trident, sica, dagger (default gladius)
  --dual          two weapons       --side W   a sidearm       --knives N     --kit chest,helmet,greaves (default chest; none = no armour)
  --gold N        --menu           a plain menu save (no run); the candidate's PLAY button is tapped
  --from <file>   use a stored save instead (the {__v, data} JSON of localStorage "game:arena"); BASE is not booted
  --frames N      frames to play after the resume (default 240)    --size WxH (default 667x375)

replays   The stored replays (tools/checks/replays/*.json) run on both trees from BASE's scripts, and the dumps compared.
  --only pit,city,rome   which ones (default all three; each takes about a minute)
  --ignore a,b           field names left out of the comparison, anywhere in the dump (e.g. time,frame)
  --dump <dir>           write <name>.base.json and <name>.cand.json there, to diff by hand
  Prints per replay: same or DIFFERS, both hashes (and the stored one), the count of differing fields, the first differing fields with
  both values, and the first differing snapshot frame.

strokes   Fresh-touch strokes, six per row, run on both trees; prints what each became: J jab, S slash, O overhead, - nothing,
          p pull (a move that was no blow), with /off for the off hand. A row is marked * where base and candidate differ.
  --weapons spear,axe        (default spear)      --strokes JAB,PUSH,SLASH,OVERHEAD (default JAB,SLASH,OVERHEAD,PUSH)
  --path "0,0,0;6,-12,4;9,30,-4"   adds a CUSTOM stroke: frame,dx,dy keys from where the thumb lands
  --rests 0,6,12,24,40       frames of rest between touches (default 12)     --dual 0,1 (default 0)
  --sizes runt,lean,medium,big,giant (default medium)   --views 667x375,844x390,874x402 (default 667x375)   --touches N (default 6)
  --only <text>              keep only rows whose label contains the text    --jobs N (rows at once, default 4)
  A full table takes minutes: ask only for the rows you need. Each row is two games booted, about 8 seconds a pair.

shots     The same moment at the standard sizes on both trees, in one PNG: base on the left, candidate on the right, one row per size.
  --sizes 874x402,667x375,844x390   --weapon W --dual --side W --kit .. --arena A --bout N   (the moment is a bout on the fake clock)
  --frames N      frames to run before the shot (default 60)       --stroke JAB   a stroke played first (any of the strokes names)
  --out <file>    default verify-shots.png

All commands: exit 1 on a console or page error, or (replays, strokes) on any difference; 0 when base and candidate agree.`;

function mainCheckout() {
  try { return execSync('git worktree list --porcelain', { cwd: HERE, stdio: ['ignore', 'pipe', 'ignore'] }).toString().split('\n').find((l) => l.startsWith('worktree '))?.slice(9) || HERE; } catch { return HERE; }
}

// ---------- args ----------
const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = {};
for (let i = 1; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  const k = argv[i].slice(2), nx = argv[i + 1];
  if (nx === undefined || nx.startsWith('--')) opt[k] = true; else { opt[k] = nx; i++; }
}
if (!cmd || cmd === '--help' || cmd === 'help' || opt.help) { console.log(HELP); process.exit(cmd ? 0 : 2); }
const BASE = resolve(opt.base || mainCheckout()), CAND = resolve(opt.cand || HERE);
for (const r of [BASE, CAND]) if (!existsSync(join(r, 'games/arena/index.html'))) { console.error(`no Arena at ${r} (games/arena/index.html missing)`); process.exit(2); }
const list = (v, d) => (v === undefined || v === true ? d : String(v).split(',').map((s) => s.trim()).filter(Boolean));
const size = (s) => s.split('x').map(Number);
const tag = (n) => (n === 0 ? 'base' : 'cand');
const short = (v, n = 90) => { const s = typeof v === 'string' ? v : JSON.stringify(v); return s === undefined ? 'undefined' : s.length > n ? s.slice(0, n - 3) + '...' : s; };
const hash = (d) => createHash('sha256').update(JSON.stringify(d)).digest('hex').slice(0, 16);
const t0 = Date.now();
const secs = () => `${((Date.now() - t0) / 1000).toFixed(0)}s`;

// the strokes: keys [frame, dx, dy] from where the thumb lands
const STROKES = {
  JAB: [[0, 0, 0], [6, -12, 4], [9, 30, -4], [14, 30, -4]],
  PUSH: [[0, 0, 0], [3, 40, 0], [6, 40, 0]],
  SLASH: [[0, 0, -40], [6, 20, 30], [10, 20, 30]],
  OVERHEAD: [[0, 0, 0], [5, 0, -70], [10, 5, -140], [18, 5, -140], [20, 10, -40], [22, 15, 60], [26, 15, 60]],
  LONGJAB: [[0, 0, 0], [2, 20, -3], [4, 55, -6], [6, 75, -6], [10, 75, -6]],
};
if (opt.path && opt.path !== true) STROKES.CUSTOM = String(opt.path).split(';').map((k) => k.split(',').map(Number));

// the loadout flags as a bout() option object
const loadout = () => ({
  w: opt.weapon && opt.weapon !== true ? opt.weapon : 'gladius', dual: !!opt.dual, side: opt.side && opt.side !== true ? opt.side : null,
  kit: opt.kit === 'none' ? [] : list(opt.kit, ['chest']), arena: opt.arena && opt.arena !== true ? opt.arena : 'city', rack: Math.max(0, (+opt.bout || 3) - 1),
  gold: +opt.gold || 40, knives: +opt.knives || 0, mace: opt.weapon === 'mace',
});

// ---------- save ----------
const FACTS = () => {
  const E = window.__engine, P = E.game.scenes.play, s = P.state, run = E.save.get('run', null);
  const me = s && s.me;
  return {
    scene: E.sceneName, saveVersion: E.save.version, frame: E.frame, hasRun: !!run,
    arena: s && s.arena && (s.arena.id || s.arena), rack: s && s.rack, hp: s && s.hp, knives: s && s.knives,
    foeAlive: !!(s && s.foe && s.foe.hp > 0), me: me ? { weapon: me.weapon, side: me.side || null, dual: !!me.dual, mace: !!me.mace, kit: me.kit, name: me.name, idx: me.idx } : null,
  };
};
const diffObj = (a, b, path = '') => {
  if (a === b) return [];
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return [`${path || '.'}: ${short(a, 40)} -> ${short(b, 40)}`];
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((k) => diffObj(a[k], b[k], path ? `${path}.${k}` : k));
};

async function save() {
  const [w, h] = size(opt.size && opt.size !== true ? opt.size : '667x375'), L = loadout(), frames = +opt.frames || 240;
  const out = { errors: [] };
  let stored, baseFacts = null, baseRun = null;
  if (opt.from && opt.from !== true) stored = readFileSync(opt.from, 'utf8');
  else {
    const g = await boot({ w, h, save: VET, root: BASE });
    if (!opt.menu) {
      await bout(g, L);
      await g.ev(() => { const E = window.__engine; E.game.scenes.play.saveRun(E); });
    } else await g.ev(() => window.__engine.save.flush());
    stored = await g.ev(() => localStorage.getItem('game:arena'));
    baseRun = JSON.parse(stored).data.run || null;
    // the base build resumes its own save, as the reference
    if (baseRun) { await g.ev(() => { const E = window.__engine; E.setScene('play', { resume: E.save.get('run') }); }); await g.frames(10); }
    baseFacts = await g.ev(FACTS);
    out.errors.push(...g.errors().map((e) => `base: ${e}`));
    await g.close();
  }
  const env = JSON.parse(stored), run0 = env.data.run || null;
  const g = await boot({ w, h, raw: env, root: CAND });
  const loaded = await g.ev(FACTS);
  let after = null;
  const strokes = [STROKES.JAB, STROKES.SLASH, STROKES.OVERHEAD];
  if (run0) {
    await g.ev(() => { const E = window.__engine; E.setScene('play', { resume: E.save.get('run') }); });
    await g.frames(60);
    for (const k of strokes) { await g.stroke(w * 0.7, h * 0.45, k); await g.frames(20); }
    await g.frames(Math.max(0, frames - 60 - strokes.length * 40));
  } else {
    await g.frames(30);
    const r = await g.ev(() => { const b = window.__engine.scene && window.__engine.scene.btns; return b && b.play ? b.play : null; });
    if (r) { await g.tapRect(r); await g.frames(60); }
  }
  after = await g.ev(FACTS);
  out.errors.push(...g.errors().map((e) => `cand: ${e}`));
  await g.close();

  const line = (k, v) => console.log(`  ${k.padEnd(22)}${v}`);
  console.log(`save: ${opt.from ? `stored save ${opt.from}` : opt.menu ? 'plain menu save' : `run mid-bout, ${short(L, 160)}`}`);
  line('save version', `base ${baseFacts ? baseFacts.saveVersion : '(not booted)'}, stored __v ${env.__v}, candidate ${loaded.saveVersion}${env.__v < loaded.saveVersion ? '  (migrated)' : env.__v > loaded.saveVersion ? '  (STORED IS NEWER THAN CANDIDATE)' : ''}`);
  line('save has a run', `${!!run0}${run0 ? ` (arena ${run0.arena}, rack ${run0.rack}, weapon ${run0.me.weapon}, side ${run0.me.side || '-'}, dual ${!!run0.me.dual}, knives ${run0.knives || 0})` : ''}`);
  let bad = out.errors.length > 0;
  if (run0) {
    const want = baseFacts || { me: run0.me, rack: run0.rack, knives: run0.knives || 0 };
    const d = [...diffObj(want.me, after.me, 'me'), ...(want.rack !== after.rack ? [`rack: ${want.rack} -> ${after.rack}`] : []), ...(want.knives !== after.knives ? [`knives: ${want.knives} -> ${after.knives}`] : []),
      ...(baseFacts && baseFacts.arena !== after.arena ? [`arena: ${baseFacts.arena} -> ${after.arena}`] : [])];
    const same = after.scene === 'play' && after.hasRun && !d.length;
    bad = bad || !same;
    line('resumed', `${after.scene === 'play' ? 'yes' : `NO, scene is ${after.scene}`}; bout ${after.rack + 1}, ${after.arena}, ${after.me && after.me.weapon}${after.me && after.me.dual ? ' x2' : ''}${after.me && after.me.side ? ' + ' + after.me.side : ''}, knives ${after.knives}, hp ${after.hp}, foe ${after.foeAlive ? 'standing' : 'NOT standing'}`);
    line('same fighter + bout', same ? `yes (${baseFacts ? 'base resumed the same save' : 'as stored'})` : `NO\n${d.slice(0, 8).map((x) => '      ' + x).join('\n')}`);
    line('played', `${after.frame - loaded.frame} frames with 3 strokes (jab, slash, overhead)`);
  } else {
    line('menu', `scene after PLAY tap: ${after.scene}${after.scene === 'menu' ? '  (PLAY not found or not tapped)' : ''}`);
  }
  line('errors', out.errors.length ? `${out.errors.length}\n${out.errors.slice(0, 6).map((e) => '      ' + e).join('\n')}` : 'none');
  console.log(`${bad ? 'FAIL' : 'ok'} (${secs()})`);
  return bad;
}

// ---------- replays ----------
const strip = (v, skip) => {
  if (Array.isArray(v)) return v.map((x) => strip(x, skip));
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) if (!skip.has(k)) o[k] = strip(v[k], skip); return o; }
  return v;
};
const leaves = (a, b, path, out) => {
  if (a === b) return;
  if (a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) leaves(a[k], b[k], Array.isArray(a) ? `${path}[${k}]` : path ? `${path}.${k}` : k, out);
    return;
  }
  out.push([path, a, b]);
};

async function replays() {
  const names = list(opt.only, ['pit', 'city', 'rome']), skip = new Set(list(opt.ignore, []));
  const dir = opt.dump && opt.dump !== true ? resolve(opt.dump) : null;
  if (dir) mkdirSync(dir, { recursive: true });
  const stored = (root, n) => { const f = join(root, 'tools/checks/replays', `${n}.hash`); return existsSync(f) ? readFileSync(f, 'utf8').trim() : '-'; };
  const jobs = names.flatMap((n) => {
    const f = join(BASE, 'tools/checks/replays', `${n}.json`), script = JSON.parse(readFileSync(existsSync(f) ? f : join(HERE, 'tools/checks/replays', `${n}.json`), 'utf8'));
    return [0, 1].map((side) => replay(script, { root: side ? CAND : BASE }).then((d) => ({ n, side, d })));
  });
  const done = await Promise.all(jobs);
  console.log(`replays: ${names.join(', ')}; scripts from base${skip.size ? `; ignoring ${[...skip].join(', ')}` : ''}`);
  let bad = false;
  for (const n of names) {
    const [A, B] = [0, 1].map((s) => done.find((x) => x.n === n && x.side === s).d);
    if (dir) for (const [d, s] of [[A, 'base'], [B, 'cand']]) writeFileSync(join(dir, `${n}.${s}.json`), JSON.stringify(d, null, 1) + '\n');
    const a = strip(A, skip), b = strip(B, skip), diffs = [];
    leaves(a, b, '', diffs);
    const errs = [...A.errors.map((e) => `base: ${e}`), ...B.errors.map((e) => `cand: ${e}`)];
    const same = !diffs.length;
    bad = bad || !same || errs.length > 0;
    console.log(`\n${same ? 'same   ' : 'DIFFERS'} ${n}   hash base ${hash(A)} (stored ${stored(BASE, n)})  cand ${hash(B)} (stored ${stored(CAND, n)})`);
    if (!same) {
      const snaps = (x) => x.snapshots.concat([x.final]);
      const sa = snaps(a), sb = snaps(b), first = sa.findIndex((s, i) => JSON.stringify(s) !== JSON.stringify(sb[i]));
      console.log(`  ${diffs.length} differing fields; first differing snapshot at frame ${first >= 0 && sa[first] ? sa[first].frame : '?'} (of ${sa.length - 1} snapshots plus the final)`);
      const topOf = (p) => p.replace(/^(snapshots\[\d+\]|final)\.?/, '$1 ').split(/[.[]/)[0].trim();
      const by = {}; for (const [p] of diffs) { const t = topOf(p) + ' ' + (p.split('.').slice(-1)[0].replace(/\[\d+\]/g, '[]')); by[t] = (by[t] || 0) + 1; }
      console.log(`  most common fields: ${Object.entries(by).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([k, v]) => `${k.split(' ').pop()} x${v}`).join(', ')}`);
      for (const [p, x, y] of diffs.slice(0, 6)) console.log(`    ${p}: ${short(x, 36)} -> ${short(y, 36)}`);
    }
    if (errs.length) console.log(`  errors: ${errs.slice(0, 3).join(' | ')}`);
  }
  console.log(`\n${bad ? 'DIFFERENCES' : 'ok'} (${secs()})`);
  return bad;
}

// ---------- strokes ----------
// In the page: a size and a weapon set up as the existing cmp scripts did (an immortal, unarmoured, still foe), and a log of every blow born
const SETUP = ([wp, dual, sz, side]) => {
  const E = window.__engine, P = E.game.scenes.play, T = P.TUNING;
  let me = P.rollMe(777, []); me.idx = me.idx.slice(); me.idx[0] = T.me.wheels.size.findIndex((e) => e[0] === sz);
  me = { ...P.kitMe(me, wp, ['chest'], dual), str: 3, side: side || null, origin: 'capua' };
  E.setScene('play', { seed: 777, arena: 'rome', me, buy: 'x', gold: 0 }); P.newRackAt(E, 0);
  const s = P.state; s.intro = false; s.bout.foeShrug = true; const f = s.foe; f.hp = f.maxHp = 999; for (const p of f.parts) { p.armour = false; p.guard = false; }
  window.__log = []; window.__mark = 0;
  const raf = window.requestAnimationFrame; let atk = null;
  const lp = () => {
    const s = P.state, h = s.hand; Object.assign(s, { swingIn: 99, sw: null, plan: null, cover: null, stamina: s.staMax, hp: 99, maxHp: 99 }); s.step.x = s.step.tgt = s.foe.home; s.foe.hp = 999;
    if (h.atk !== atk) { if (h.atk && (h.atk.cost != null || h.atk.kind === 'pull')) window.__log.push([window.__mark, h.atk.kind, !!h.off]); atk = h.atk; }
    raf(lp);
  };
  raf(lp);
};
const CODE = { jab: 'J', slash: 'S', over: 'O', pull: 'p' };

async function strokeRow(root, row) {
  const g = await boot({ w: row.w, h: row.h, save: VET, root });
  try {
    await g.ev(SETUP, [row.wp, row.dual, row.sz, row.side]);
    await g.frames(40);
    const keys = STROKES[row.k];
    for (let i = 0; i < row.touches; i++) {
      await g.ev((i) => { window.__mark = i + 1; }, i);
      await g.stroke(row.w * 0.7, row.h * 0.45, keys); await g.frames(row.rest);
    }
    const log = await g.ev(() => window.__log);
    const cells = [];
    for (let i = 1; i <= row.touches; i++) {
      const ev = log.filter((e) => e[0] === i), blows = ev.filter((e) => e[1] !== 'pull'), c = blows.length ? blows : ev;
      cells.push(c.length ? c.map((e) => (CODE[e[1]] || e[1]) + (e[2] ? '/off' : '')).join('+') : '-');
    }
    return { cells, errors: g.errors() };
  } finally { await g.close(); }
}

async function strokes() {
  const wps = list(opt.weapons, ['spear']), ks = list(opt.strokes, ['JAB', 'SLASH', 'OVERHEAD', 'PUSH']), rests = list(opt.rests, ['12']).map(Number), duals = list(opt.dual, ['0']).map((x) => x === '1' || x === 'true'),
    szs = list(opt.sizes, ['medium']), views = list(opt.views, ['667x375']), touches = +opt.touches || 6, jobs = +opt.jobs || 4;
  for (const k of ks) if (!STROKES[k]) { console.error(`unknown stroke ${k} (have ${Object.keys(STROKES).join(', ')}; add one with --path)`); process.exit(2); }
  let rows = [];
  for (const v of views) for (const sz of szs) for (const wp of wps) for (const dual of duals) for (const k of ks) for (const rest of rests) {
    const [w, h] = size(v);
    rows.push({ w, h, wp, dual, sz, k, rest, touches, side: opt.side && opt.side !== true ? opt.side : null, label: `${wp}${dual ? ' dual' : ''} ${k} rest${rest} ${sz} ${v}` });
  }
  if (opt.only && opt.only !== true) rows = rows.filter((r) => r.label.includes(opt.only));
  if (!rows.length) { console.error('no rows'); process.exit(2); }
  console.log(`strokes: ${rows.length} rows, ${touches} fresh touches each; J jab, S slash, O overhead, p pull, - nothing, /off off hand`);
  const results = new Array(rows.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(jobs, rows.length) }, async () => {
    while (next < rows.length) {
      const i = next++;
      const [a, b] = await Promise.all([strokeRow(BASE, rows[i]), strokeRow(CAND, rows[i])]);
      results[i] = { a, b };
    }
  }));
  const W = Math.max(...rows.map((r) => r.label.length)), cw = Math.max(1, ...results.flatMap((r) => [...r.a.cells, ...r.b.cells].map((c) => c.length)));
  let nDiff = 0, errs = 0;
  console.log(`${'row'.padEnd(W)}  ${'base'.padEnd(touches * (cw + 1))}  cand`);
  rows.forEach((r, i) => {
    const { a, b } = results[i], A = a.cells.map((c) => c.padEnd(cw)).join(' ').trimEnd(), B = b.cells.map((c) => c.padEnd(cw)).join(' ').trimEnd(), d = A !== B;
    if (d) nDiff++;
    errs += a.errors.length + b.errors.length;
    console.log(`${r.label.padEnd(W)}  ${A.padEnd(touches * (cw + 1))}  ${B}${d ? '   *' : ''}${a.errors.length + b.errors.length ? `   ERRORS ${short([...a.errors, ...b.errors][0], 60)}` : ''}`);
  });
  console.log(`${nDiff} of ${rows.length} rows differ${errs ? `, ${errs} errors` : ''} (${secs()})`);
  return nDiff > 0 || errs > 0;
}

// ---------- shots ----------
async function shots() {
  const sizes = list(opt.sizes, ['874x402', '667x375', '844x390']), L = loadout(), frames = +opt.frames || 60, out = resolve(opt.out && opt.out !== true ? opt.out : 'verify-shots.png');
  const pngs = [];
  let bad = false;
  for (const v of sizes) {
    const [w, h] = size(v);
    for (const root of [BASE, CAND]) {
      const g = await boot({ w, h, save: VET, root });
      await bout(g, { ...L, begin: !!opt.begin });
      await g.frames(frames);
      if (opt.stroke && opt.stroke !== true) { await g.stroke(w * 0.7, h * 0.45, STROKES[opt.stroke] || STROKES.JAB); await g.frames(+opt.after || 4); }
      pngs.push({ v, w, h, side: root === BASE ? 'base' : 'cand', b64: (await g.page.screenshot({ type: 'png' })).toString('base64') });
      if (g.errors().length) { bad = true; console.log(`errors at ${v} ${root === BASE ? 'base' : 'cand'}: ${g.errors().slice(0, 2).join(' | ')}`); }
      await g.close();
    }
  }
  const { chromium } = await loadPlaywright();
  const br = await chromium.launch(), pg = await br.newPage();
  const pad = 10, lab = 18, totalH = pngs.filter((p) => p.side === 'base').reduce((s, p) => s + p.h + lab + pad, pad), totalW = Math.max(...sizes.map((v) => size(v)[0])) * 2 + pad * 3;
  const data = await pg.evaluate(async ([pngs, totalW, totalH, pad, lab]) => {
    const c = document.createElement('canvas'); c.width = totalW; c.height = totalH; const x = c.getContext('2d');
    x.fillStyle = '#222'; x.fillRect(0, 0, totalW, totalH); x.font = '13px sans-serif'; x.fillStyle = '#fff';
    const load = (b) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + b; });
    let y = pad;
    for (let i = 0; i < pngs.length; i += 2) {
      let xx = pad;
      for (const p of [pngs[i], pngs[i + 1]]) { x.fillText(`${p.side}  ${p.v}`, xx, y + 13); x.drawImage(await load(p.b64), xx, y + lab); xx += (totalW - pad * 3) / 2 + pad; }
      y += pngs[i].h + lab + pad;
    }
    return c.toDataURL('image/png').split(',')[1];
  }, [pngs, totalW, totalH, pad, lab]);
  await br.close();
  writeFileSync(out, Buffer.from(data, 'base64'));
  console.log(`shots: ${sizes.join(', ')}, base left, candidate right, ${frames} frames in${opt.stroke ? `, after a ${opt.stroke}` : ''}\n  ${out} (${totalW}x${totalH}) (${secs()})`);
  return bad;
}

const run = { save, replays, strokes, shots }[cmd];
if (!run) { console.error(`unknown command "${cmd}" (save, replays, strokes, shots; --help)`); process.exit(2); }
console.log(`base ${BASE}\ncand ${CAND}`);
const failed = await run();
process.exit(failed ? 1 : 0);
