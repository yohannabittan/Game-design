#!/usr/bin/env node
// film: set up an Arena moment and film it. One command makes a PNG of a held moment, or a GIF and a contact sheet of a short script of actions.
//   node tools/film.mjs --weapon spear --foe hermes --tell low --out shot                          -> shot.png (a still, at --view)
//   node tools/film.mjs --weapon spear --dual --knives 1 --bare --script "JAB;JAB;JAB;JAB;throw:neck" --out two-spears   -> two-spears.gif + two-spears-sheet.png
// Importable: film(opts) -> { files, frames, kb, seconds }. Built on tools/checks/scene.mjs (the moment) and tools/sketch.mjs (the GIF); contact sheets by ffmpeg.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, copyFileSync, statSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { boot } from './checks/exact.mjs';
import { VET } from './checks/arena.mjs';
import { scene, stroke, throwKnife, knifeUp, release, holdTell, dropTell, bowUp, STROKES } from './checks/scene.mjs';
import { framesToGif } from './sketch.mjs';

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const HELP = `film: set up an Arena moment, then film it (GIF + contact sheet) or take a still of it.

  node tools/film.mjs [moment flags] [--script "<actions>"] --out <name>

No --script: writes <name>.png, a still of the moment. With --script: plays the actions and writes <name>.gif and <name>-sheet.png.

The moment (every flag optional; fake clock, so a run is the same every time):
  --weapon W         gladius, spear, axe, mace, trident, sica, dagger (default gladius)      --dual            two weapons
  --side W           a sidearm (sica, dagger, bow ...)       --knives N      --kit chest,helmet,greaves | none (default chest)
  --foe NAME         a champion or beast to fight: hermes, twins, carpophorus, mevia, aquila, lion, bear, Flamma ... (found for you, any arena)
  --foe-size S       runt lean medium big giant (his body)      --size S   your body      --bare   no armour or guards on him (so gaps show)
  --arena A          pit, city, rome, games (default pit)      --bout N   1-5      --seed N      --begin   keep the intro card and lessons
  --yard STEP        the training yard (the menu's Training), at a step: hand jab slash over lunge shield dodge hold gap knife read perfect tell go (or 0-13)
  --tell Z           his tell held up: high, mid or low       --tell-kind chop|thrust|sweep|combo|feint      --tell-at 0.7   how far into the wind-up
  --bow out|drawn    the bow raised, or drawn and held        --knife-up   a knife raised and held       --live   he fights back (default: he stands still)
  --view WxH[,WxH]   screen size(s); one file each if several (default 874x402; also 667x375, 844x390)

The script: actions separated by ';', each may end in =caption (default caption: the action as written).
  JAB  SLASH  PUSH  OVERHEAD  LONGJAB     a thumb stroke from the right of the screen      JAB@0.6,0.5   from that point (fractions of the screen)
  path:0,0,0/6,-12,4/9,30,-4              a custom stroke: frame,dx,dy keys
  throw:neck | throw:head | throw:-40     raise a knife and throw it at a part of him (or slide the thumb that many px, negative = up)
  knife   release                         raise a knife and hold it / let go of whatever thumb is held
  tell:low  tell:high  tell:mid  tell:off   start (or end) his tell, held
  bow   draw                              raise the bow / draw it and hold
  wait:30                                 frames of nothing (60 a second)
  Example: --script "JAB=right;JAB=left;JAB=right;JAB=left;throw:neck=knife to the neck gap"

The film:
  --every 3          sim frames per picture (60 sim frames = 1 s)      --slow 1   play it this many times slower (more pictures per second of play)
  --fps N            GIF frames per second (default 60/every/slow, so real time)      --gifw 640   GIF width px (default: the view's width; auto-narrowed under --max-mb)
  --max-mb 3         GIF size limit (it re-encodes narrower until it fits)      --cells 12 --cols 4   the contact sheet: how many pictures, how many across
  --sheetw 1600      contact sheet width px      --no-thumb   no thumb disc      --no-caption   no caption      --keep <dir>   keep the PNG frames there
  --root <dir>       the checkout to drive (default: the one this tool sits in)      --out <name>   file stem (default film; a directory part is created)
  --help             this text
Needs ffmpeg for GIFs and sheets. A film of 5 strokes takes about a minute; a still takes under 10 seconds.`;

const SHORT = ['weapon', 'dual', 'side', 'knives', 'kit', 'foe', 'foe-size', 'size', 'bare', 'arena', 'bout', 'seed', 'begin', 'tell', 'tell-kind', 'tell-at', 'bow', 'knife-up', 'live', 'yard'];

export function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2), nx = argv[i + 1];
    if (nx === undefined || nx.startsWith('--')) o[k] = true; else { o[k] = nx; i++; }
  }
  return o;
}

// "JAB=right;throw:neck" -> [{ cmd, arg, cap }]
export function parseScript(text) {
  return String(text).split(';').map((s) => s.trim()).filter(Boolean).map((s) => {
    const [body, ...c] = s.split('='); const cap = c.join('=').trim() || null, b = body.trim();
    const m = b.match(/^([A-Za-z]+)(?::([^@]*))?(?:@(.+))?$/);
    if (!m) throw new Error(`film: can't read the action "${s}"`);
    const cmd = m[1].toUpperCase() === m[1] && STROKES[m[1]] ? 'stroke' : m[1].toLowerCase();
    return { cmd, name: m[1], arg: m[2] === undefined ? null : m[2], at: m[3] ? m[3].split(',').map(Number) : null, cap, text: b };
  });
}

const num = (v, d) => (v === undefined || v === true || Number.isNaN(+v) ? d : +v);
const sceneOpts = (o) => ({
  weapon: o.weapon, dual: !!o.dual, side: o.side, knives: num(o.knives, 0), kit: o.kit === 'none' ? 'none' : o.kit ? String(o.kit).split(',') : undefined,
  foe: o.foe, foeSize: o['foe-size'], size: o.size, bare: !!o.bare, arena: o.arena, bout: num(o.bout, 1), seed: o.seed ? +o.seed : undefined, begin: !!o.begin,
  yard: o.yard === true ? undefined : o.yard, tell: o.tell, tellKind: o['tell-kind'], tellAt: num(o['tell-at'], 0.7), bow: o.bow, knifeUp: !!o['knife-up'], still: o.live ? false : true,
});

const OVERLAY = () => {
  const mk = (id, css) => { const d = document.createElement('div'); d.id = id; d.style.cssText = css + ';position:fixed;pointer-events:none;z-index:99'; document.body.append(d); return d; };
  mk('film-cap', 'left:50%;transform:translateX(-50%);bottom:6px;max-width:70%;text-align:center;font:700 16px system-ui,sans-serif;color:#fff6c8;background:rgba(20,12,6,0.75);padding:4px 10px;border-radius:6px;display:none');
  window.__thumbs = new Map();
  window.__thumb = (id, x, y) => {
    let d = window.__thumbs.get(id);
    if (x == null) { if (d) d.remove(); window.__thumbs.delete(id); return; }
    if (!d) { d = document.createElement('div'); d.style.cssText = 'position:fixed;pointer-events:none;z-index:98;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(248,241,228,0.42);border:2px solid rgba(59,47,36,0.8)'; document.body.append(d); window.__thumbs.set(id, d); }
    d.style.left = x + 'px'; d.style.top = y + 'px';
  };
};

// Film one view size. Returns the files written.
async function filmOne(o, w, h, stem, say) {
  const t0 = Date.now(), actions = o.script ? parseScript(o.script) : [];
  const g = await boot({ w, h, save: VET, root: resolve(o.root || HERE) });
  const info = await scene(g, sceneOpts(o));
  say(`scene: ${info.foe} (${info.foeSize}, ${info.foeWeapon}) in the ${info.arena}, bout ${info.bout}; you ${info.weapon}${info.dual ? ' x2' : ''}${info.side ? ' + ' + info.side : ''}, ${info.you.size}${info.tell ? `; tell ${info.tell.zone} (${info.tell.kind})` : ''}`);
  const files = [];
  const dir = mkdtempSync(join(tmpdir(), 'film-'));
  if (!actions.length) {
    const f = `${stem}.png`; mkdirSync(dirname(resolve(f)), { recursive: true });
    await g.page.screenshot({ path: f }); files.push(f);
    await finish(g, dir, info);
    say(`${f}: ${w}x${h} still (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    return { files, info, frames: 1 };
  }
  // overlays, and the wrappers that take a picture as frames go by and track the thumb
  await g.ev(OVERLAY);
  const every = Math.max(1, num(o.every, 3)); let sim = 0, n = 0; const keys = [];
  const cap = (t) => g.ev((t) => { const d = document.getElementById('film-cap'); d.textContent = t || ''; d.style.display = t ? 'block' : 'none'; }, o['no-caption'] ? '' : t);
  const shot = async () => { await g.page.screenshot({ path: join(dir, `${String(n++).padStart(5, '0')}.png`) }); };
  const framesRaw = g.frames, downRaw = g.down, moveRaw = g.move, upRaw = g.up;
  g.frames = async (k) => { for (let i = 0; i < k; i++) { await framesRaw(1); if (sim++ % every === 0) await shot(); } };
  const thumbOn = !o['no-thumb'];
  g.down = async (x, y, id = 7) => { if (thumbOn) await g.ev(([i, x, y]) => window.__thumb(i, x, y), [id, x, y]); return downRaw(x, y, id); };
  g.move = async (x, y, id = 7) => { if (thumbOn) await g.ev(([i, x, y]) => window.__thumb(i, x, y), [id, x, y]); return moveRaw(x, y, id); };
  g.up = async (x, y, id = 7) => { if (thumbOn) await g.ev(([i]) => window.__thumb(i, null), [id]); return upRaw(x, y, id); };
  await g.frames(every); // a first picture of the moment before anything moves
  for (const a of actions) {
    const first = n, label = a.cap || a.text;
    await cap(label);
    if (a.cmd === 'stroke') await stroke(g, STROKES[a.name], a.at ? { x: a.at[0], y: a.at[1] } : {});
    else if (a.cmd === 'path') await stroke(g, String(a.arg).split('/').map((k) => k.split(',').map(Number)));
    else if (a.cmd === 'throw') { const t = a.arg == null ? 0 : Number.isNaN(+a.arg) ? a.arg : +a.arg; const r = await throwKnife(g, t); if (r) say(`  throw ${a.arg}: aim saw ${r.part || 'nothing'} (${r.over})`); }
    else if (a.cmd === 'knife') await knifeUp(g);
    else if (a.cmd === 'release') await release(g);
    else if (a.cmd === 'tell') { if (a.arg === 'off') await dropTell(g); else { await holdTell(g, a.arg, null, num(o['tell-at'], 0.7)); await g.frames(30); } }
    else if (a.cmd === 'bow') await bowUp(g, false);
    else if (a.cmd === 'draw') await bowUp(g, true);
    else if (a.cmd === 'wait') await g.frames(num(a.arg, 30));
    else throw new Error(`film: unknown action "${a.text}" (see --help)`);
    await g.frames(every * 2);
    keys.push([first, n - 1]);
  }
  await cap('');
  const total = n;
  // the GIF: real time unless --slow; narrowed until it is under --max-mb
  const fps = num(o.fps, Math.max(1, Math.round(60 / every / num(o.slow, 1))));
  const gif = `${stem}.gif`; mkdirSync(dirname(resolve(gif)), { recursive: true });
  const maxKb = num(o['max-mb'], 3) * 1024; let width = num(o.gifw, w), res;
  for (;;) { res = framesToGif(dir, gif, fps, width < w ? width : 0); if (res.kb <= maxKb || width <= 320) break; width = Math.round(width * 0.8 / 2) * 2; }
  files.push(gif);
  // the contact sheet: the middle of each action first, then evenly spaced pictures to fill the cells, in order, tiled by ffmpeg
  const cells = Math.max(1, num(o.cells, 12)), cols = Math.max(1, num(o.cols, 4));
  const pick = new Set(keys.map(([a, b]) => Math.floor(a + (b - a) * 0.45)));
  for (let i = 0; pick.size < Math.min(cells, total) && i < 4 * cells; i++) pick.add(Math.min(total - 1, Math.floor(((i + 0.5) * total) / cells)));
  const chosen = [...pick].sort((x, y) => x - y).slice(0, cells);
  const sd = mkdtempSync(join(tmpdir(), 'film-sheet-'));
  chosen.forEach((idx, i) => copyFileSync(join(dir, `${String(idx).padStart(5, '0')}.png`), join(sd, `${String(i).padStart(3, '0')}.png`)));
  const sheet = `${stem}-sheet.png`, sw = num(o.sheetw, 1600), cw = Math.floor(sw / cols);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', '1', '-i', join(sd, '%03d.png'), '-vf', `scale=${cw}:-1:flags=lanczos,tile=${cols}x${Math.ceil(chosen.length / cols)}:padding=4:color=0x20140a`, '-frames:v', '1', sheet]);
  files.push(sheet); rmSync(sd, { recursive: true, force: true });
  await finish(g, dir, info, o.keep && o.keep !== true ? resolve(o.keep) : null);
  say(`${gif}: ${total} pictures at ${fps} fps, ${width < w ? width : w} px wide, ${res.kb} KB (${(total / fps).toFixed(1)} s)\n${sheet}: ${chosen.length} cells (${((Date.now() - t0) / 1000).toFixed(0)} s to make)`);
  return { files, info, frames: total, kb: res.kb };
}

async function finish(g, dir, info, keep) {
  const errs = g.errors();
  if (errs.length) console.error(`page errors: ${errs.slice(0, 5).join('; ')}`);
  await g.close();
  if (keep) { mkdirSync(keep, { recursive: true }); for (const f of readdirSync(dir)) copyFileSync(join(dir, f), join(keep, f)); }
  rmSync(dir, { recursive: true, force: true });
}

export async function film(o, say = console.log) {
  const views = String(o.view && o.view !== true ? o.view : '874x402').split(',').map((v) => v.split('x').map(Number));
  const stem = String(o.out && o.out !== true ? o.out : 'film'), out = { files: [] };
  for (const [w, h] of views) { const r = await filmOne(o, w, h, views.length > 1 ? `${stem}-${w}x${h}` : stem, say); out.files.push(...r.files); out.info = r.info; out.frames = r.frames; out.kb = r.kb; }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const o = parseArgs(process.argv.slice(2));
  if (o.help || o.h) { console.log(HELP); process.exit(0); }
  const known = new Set([...SHORT, 'script', 'view', 'every', 'slow', 'fps', 'gifw', 'max-mb', 'cells', 'cols', 'sheetw', 'no-thumb', 'no-caption', 'keep', 'root', 'out', 'help']);
  const bad = Object.keys(o).filter((k) => !known.has(k));
  if (bad.length) { console.error(`unknown flag --${bad[0]} (node tools/film.mjs --help)`); process.exit(2); }
  try { await film(o); } catch (e) { console.error(`film: ${e.message}`); process.exit(1); }
}
