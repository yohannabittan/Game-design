#!/usr/bin/env node
// Records Arena's replay scripts (tools/replay.mjs, ADR-0024): a scripted thumb plays each run in the deterministic harness, deciding from the
// game's state each frame, and every pointer event it sends is written down with its frame. The script it writes replays without the policy.
// The play is not good, only varied: jabs, slashes, overheads and lunges in a cycle, the shield raised to the zone of each blow he starts
// (every third one dodged instead), the intro card tapped, a draft card picked, the tent left, and on the Pit run the purse shopped.
//   node tools/checks/replays/make.mjs [pit|city|rome ...]     writes tools/checks/replays/<name>.json
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from '../../replay.mjs';
import { VET } from '../arena.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SAVE = { ...VET, firstRunDone: 1 };
const RUNS = {
  // the Pit from the wheels: the purse buys a spear, a chest plate and a knife, then bouts until the run ends; bouts are short (foe.hp)
  pit: { seed: 11, tune: { 'foe.hp': 3, hearts: 12 }, start: { scene: 'roll', params: { seed: 4242, arena: 'pit' } }, frames: 9000, every: 600,
    purse: ['tile:spear', 'slot:chest', 'knife', 'fight'], pick: 1 },
  // the City from its third bout (the first pair): resumed there with a gladius and a helmet
  city: { seed: 22, tune: { 'foe.hp': 4, hearts: 12 }, start: { scene: 'play', params: { resume: { seed: 9001, arena: 'city', rack: 2, gold: 40 } }, me: { roll: 515, weapon: 'gladius', kit: ['helmet'] } },
    frames: 7000, every: 600, pick: 0 },
  // the Colosseum from its second bout (a beast), with an axe and greaves
  rome: { seed: 33, tune: { 'foe.hp': 4, hearts: 12 }, start: { scene: 'play', params: { resume: { seed: 7777, arena: 'rome', rack: 1, gold: 60 } }, me: { roll: 321, weapon: 'axe', kit: ['greaves'] } },
    frames: 7000, every: 600, pick: 2 },
};

// The scripted thumb, in the page: called once per frame with the frame number, returns the events to send on it.
function policy(cfg) {
  const E = window.__engine, P = E.game.scenes.play, T = P.TUNING;
  const later = [];
  const at = (f, type, x, y, id) => later.push([f, type, Math.round(x), Math.round(y), id]);
  const tap = (f, x, y) => { at(f, 'down', x, y, 9); at(f + 2, 'up', x, y, 9); };
  const mid = (r) => [r.x + r.w / 2, r.y + r.h / 2];
  // right-thumb strokes: [frame offset, dx, dy] keys from where the thumb lands
  const STROKES = {
    jab: [[0, 0, 0], [2, 20, -3], [4, 55, -6], [6, 75, -6], [10, 75, -6]],
    slash: [[0, -20, -70], [1, -20, -70], [2, -5, -20], [3, 10, 30], [4, 20, 70], [8, 20, 70]],
    over: [[0, 0, 0], [5, 0, -70], [10, 5, -140], [18, 5, -140], [20, 10, -40], [22, 15, 60], [26, 15, 60]],
    lunge: [[0, 0, 0], [6, 70, 0], [12, 150, -5], [18, 200, -5], [40, 200, -5]],
  };
  const CYCLE = ['jab', 'slash', 'over', 'jab', 'lunge', 'slash', 'jab', 'over'];
  let busyTo = -1, cyc = 0, lastTap = -99, purseI = 0, blowSeen = null, blows = 0, shieldUp = false;
  const stroke = (f, name) => {
    const k = STROKES[name], x0 = E.w * 0.7, y0 = E.h * 0.42;
    at(f, 'down', x0 + k[0][1], y0 + k[0][2], 7);
    for (let i = 1; i < k.length; i++) {
      const [a, ax, ay] = k[i - 1], [b, bx, by] = k[i];
      for (let t = a + 1; t <= b; t++) { const u = (t - a) / (b - a); at(f + t, 'move', x0 + ax + (bx - ax) * u, y0 + ay + (by - ay) * u, 7); }
    }
    const [e, ex, ey] = k[k.length - 1];
    at(f + e + 1, 'up', x0 + ex, y0 + ey, 7);
    busyTo = f + e + 6;
  };
  return (f) => {
    const sc = E.sceneName, s = P.state;
    if (sc === 'roll') {
      const R = E.scene, Pu = R.purse;
      if (f - lastTap < 24) { /* wait */ } else if (Pu) {
        if (Pu.t > T.draft.delay + 0.2) {
          if (Pu.ask) { if (Pu.ask.bare) tap(f, ...mid(Pu.ask.bare)); }
          else {
            const a = cfg.purse[Math.min(purseI++, cfg.purse.length - 1)];
            let r = null;
            if (a.startsWith('tile:')) r = Pu.tiles.find((q) => q.id === a.slice(5));
            else if (a.startsWith('slot:')) r = Pu.slots.find((q) => q.plate && q.plate.startsWith(a.slice(5, 9)));
            else if (a === 'knife') r = Pu.krow && Pu.krow.plus;
            else r = Pu.fight;
            if (r) tap(f, ...mid(r));
          }
          lastTap = f;
        }
      } else if (R.btn && R.cardT > 0.6) { tap(f, ...mid(R.btn)); lastTap = f; }
      else if (!R.btn) { tap(f, E.w * 0.5, E.h * 0.5); lastTap = f; }
    } else if (sc === 'play' && s.me) {
      const d = s.draft, tt = s.tent;
      if (tt) { if (tt.t > T.draft.delay + 0.3 && f - lastTap > 30 && tt.skip) { tap(f, ...mid(tt.skip)); lastTap = f; } }
      else if (d) { if (!d.fly && d.btns.length && d.t > T.draft.delay + 0.4 && f - lastTap > 30) { tap(f, ...mid(d.btns[cfg.pick % d.btns.length])); lastTap = f; } }
      else if (s.train) { if (s.train.skip && f - lastTap > 30) { tap(f, ...mid(s.train.skip)); lastTap = f; } }
      else if (s.intro) {
        if (s.introT > 0.6 && f - lastTap > 30) { tap(f, E.w * 0.42, E.h * 0.7); lastTap = f; }
      } else if (s.endT <= 0 && !(s.fallT > 0)) {
        // his blow: the shield to its zone, held while it lasts; every third, a dodge
        const sw = s.sw;
        if (sw && sw !== blowSeen && !sw.outcome) {
          blowSeen = sw; blows++;
          const btns = P.shieldBtns(E);
          const b = blows % 3 === 0 ? btns.find((q) => q.dodge) : btns.find((q) => q.z && q.z.id === (sw.zone && sw.zone.id));
          if (b) { at(f, 'down', ...mid(b), 8); shieldUp = true; }
        }
        if (shieldUp && (!s.sw || s.sw.outcome)) { const b = P.shieldBtns(E)[1]; at(f, 'up', ...mid(b), 8); shieldUp = false; }
        if (f >= busyTo && !s.hand.down) stroke(f, CYCLE[cyc++ % CYCLE.length]);
      }
    }
    const now = later.filter((e) => e[0] === f);
    for (let i = later.length - 1; i >= 0; i--) if (later[i][0] <= f) later.splice(i, 1);
    return now.map((e) => e.slice(1));
  };
}

async function make(name) {
  const R = RUNS[name];
  const script = { name: `arena-${name}`, slug: 'arena', w: 844, h: 390, seed: R.seed, save: SAVE, tune: R.tune, start: R.start, frames: R.frames, every: R.every, events: [] };
  const h = await launch(script);
  try {
    await h.page.evaluate(([src, cfg]) => { window.__pol = eval(`(${src})`)(cfg); window.__rec = []; }, [policy.toString(), R]);
    let f = 0;
    while (f < R.frames) {
      const ran = await h.page.evaluate(([f0, n]) => {
        let i = 0;
        for (; i < n; i++) {
          const evs = window.__pol(f0 + i);
          for (const e of evs) window.__rec.push([f0 + i, ...e]);
          const before = window.__imgPending;
          window.__replay.frame(evs);
          if (window.__imgPending > before) { i++; break; }
        }
        return i;
      }, [f, Math.min(120, R.frames - f)]);
      f += ran;
      await h.settle(100);
    }
    script.events = await h.page.evaluate(() => window.__rec);
    const end = await h.final();
    const st = end.state || {};
    console.error(`${name}: ${script.events.length} events, scene ${end.scene}, rack ${st.rack}, felled ${st.felled}, picks ${(st.picks || []).length}, jabs ${st.jabs} slashes ${st.slashes} overheads ${st.overheads} lunges ${st.lunges} blocks ${st.blocks} dodges ${st.dodges} hp ${st.hp} buy ${st.buy} knives ${st.knivesThrown} pair ${!!st.edge} beast ${!!(st.foe && st.foe.beast)} results ${JSON.stringify(st.results)}; errors ${h.errors().length}`);
  } finally { await h.close(); }
  writeFileSync(join(HERE, `${name}.json`), JSON.stringify(script) + '\n');
}

for (const n of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(RUNS)) await make(n);
