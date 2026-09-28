# Skeleton

The starting point for every game. Do not edit games in here; run `tools/new-game.sh <slug> "<Title>"` and it copies this folder to `games/<slug>/`.

| File | What it is | Who touches it |
| --- | --- | --- |
| `index.html` | Canvas, viewport, PWA hooks, service worker registration | Rarely. Only the title placeholders. |
| `src/engine.js` | Loop, input, scenes, save, audio synth, particles, RNG, drawing helpers | Nobody, per game. Engine changes go in `skeleton/` with an ADR. |
| `src/game.js` | The whole game. This is the file a one-shot prompt writes. | Every layer prompt. |
| `sw.js` | Offline cache. Bump `CACHE_VERSION` on every deploy. | Each deploy. |
| `manifest.webmanifest` | Home-screen name, icon, portrait lock | Once. |
| `icons/` | Placeholder PNGs from `tools/make-icons.py` | Art layer. |

## The game.js contract

```js
export const game = {
  slug: 'gravity-golf',      // matches the folder name; namespaces the save
  title: 'Gravity Golf',
  saveVersion: 1,            // bump when the save shape changes
  migrate(data, fromVersion) { return data; },
  TUNING: { /* every number a designer might tweak */ },
  init(E) {},                // optional, runs once
  start: 'menu',             // first scene
  scenes: { menu, play, over },
};
```

Optional: `experiments: [{ key: 'juice.bigHitSpeed', label: 'Big hit speed', min: 300, max: 900, step: 10 }]`. When present, the engine shows a TUNE tab on the menu that opens a slider panel. Keys are paths into `TUNING`; values apply live, persist per game, and are shown so a tester can report what felt right. Use it for playtest ranges; remove the entry once a value is decided.

A scene is a plain object. Every method is optional:

```js
const play = {
  enter(E, params) {},   // scene shown
  exit(E) {},
  update(dt, E) {},      // dt in seconds, clamped to 50 ms
  render(ctx, E) {},     // 2D context, CSS-pixel coordinates, E.w x E.h
  resize(E) {},
  onPointerDown(p, E) {}, onPointerMove(p, E) {},
  onPointerUp(p, E) {}, // check p.cancelled: a palm or system gesture ends the pointer too, and must not count as a release
  onTap(p, E) {},        // p.x p.y; fired on quick, still release
  onSwipe(p, E) {},      // p.swipeDir: 'left' | 'right' | 'up' | 'down'; p.dx p.dy
  onKey(key, E) {},      // desktop fallback only
  onPause(E) {},         // app backgrounded: persist a resumable run here
};
```

What the engine gives you (`E`):

| Area | API |
| --- | --- |
| Size and time | `E.w`, `E.h`, `E.time`, `E.frame`, `E.safe.top`, `E.safe.bottom`, `E.safe.left`, `E.safe.right` |
| Scenes | `E.setScene(name, params)` |
| Save | `E.save.get(k, def)`, `E.save.set(k, v)`, `E.save.update(k, fn, def)`, `E.save.reset()` |
| Audio | `E.audio.play(name, vol = 1)` with names `tap hit miss win lose coin boom` (`vol` 0.3 for a quiet version), `E.audio.beep({freq,dur,type,slide,gain})`, `E.audio.noise()`, `E.audio.toggleMute()` |
| Juice | `E.shake(px, sec)`, `E.flash(color, sec)`, `E.tween(sec, fn, ease.outBack, done)`, `E.haptic(ms)`, `E.particles.emit({x,y,count,color,speed,life,size,gravity})` |
| RNG | `E.rng()` plus `makeRng(seed)` with `.range .int .pick .chance .shuffle`, `E.dailySeed()`, `hashString(s)` |
| Drawing | `E.text(str, x, y, {size,color,align,weight})`, `E.roundRect(x,y,w,h,r,fill,stroke)`, `E.button(label, cx, cy, opts)` returns a rect, `E.hit(rect, p)` |
| Toast | `E.toast(msg, onTap)` |
| Tune panel | declare `experiments` on the game; the engine adds the `tune` scene and the menu tab |
| Pointers | `E.pointers` (Map of active pointers, for drag and multi-touch), `E.keys` (Set) |

Imports available from `./engine.js`: `makeRng`, `hashString`, `ease`, `clamp`, `lerp`, `dist`.

## Rules that keep one-shots landing

- All tunable numbers live in `TUNING`. Iteration is number tweaking before it is code.
- Level and wave data are plain arrays in `game.js`, not code paths.
- No DOM, no new files, no libraries. If the engine lacks something, add it to `skeleton/src/engine.js` (an additive helper or field needs only an entry in the table above; a change to existing behaviour needs an ADR, see ADR-0011) and copy it into the game being worked on.
- Portrait, one thumb, 44 px minimum touch targets, HUD inside the safe area.
- Randomness only decides what you face, never whether your input worked.
