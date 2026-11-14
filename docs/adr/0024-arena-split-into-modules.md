# ADR-0024: Arena's game.js is split into native ES modules along its existing sections

- **Date:** 2026-11-14
- **Status:** accepted
- **Scope:** one game (`arena`); amends ADR-0007 for Arena only

## Context

ADR-0007 made `game.js` the unit of a build and said: "If a game outgrows this, split by ADR for that game." Arena has. Its `game.js` is 11,181 lines in 15 sections. Every builder reads its way through code it doesn't need, every change risks touching something unrelated, and new modes (Trials, the range, the Daily run) would make it longer still. The designer: "Sounds like we would benefit from being more modular than monolithic now."

ADR-0002 still holds: no bundler, no build step, no dependencies. Browsers load native ES modules (`import`/`export`) directly, and `game.js` already imports `engine.js` that way.

## Decision

Split `games/arena/src/game.js` into native ES modules along the sections it already has, with no change in behaviour. `game.js` stays the entry point and keeps the game object, save and migrate.

| Module | Holds (today's section) |
| --- | --- |
| `tuning.js` | TUNING. It imports nothing, so every module can use it at load. |
| `data.js` | the data tables: the gauntlet, story lines, the deck, body parts, zones, poses |
| `state.js` | the run state and the small helpers (`state` is one exported object, mutated in place) |
| `rolls.js` | the rolls: your fighter, the gauntlet, run and bout set-up from the seed |
| `fighter.js` | the fighter model: layout, body, sword arm, footwork, defence |
| `foe.js` | the foe AI |
| `combat.js` | input and hit resolution |
| `cards.js` | the card engine, and between bouts (the grade and the draft) |
| `fx.js` | juice: particles and sounds |
| `draw/fighter.js`, `draw/arena.js`, `draw/hud.js`, `draw/screens.js` | drawing, split four ways (the figures; the arena and backdrop; the HUD and in-bout UI; cards, wheels, the purse, the inventory and other screens) |
| `meta.js` | fame, the ludus, the Wall of Champions |
| `scenes/menu.js`, `scenes/roll.js`, `scenes/play.js`, `scenes/over.js`, `scenes/yard.js` | the scenes, one each (new scenes such as Trials get their own file) |
| `game.js` | the game object, save, migrate and TUNE presets; it imports the scenes |

**The rules for the modules:**
- **Only `tuning.js` and `data.js` may be read while modules are loading.** Every other cross-module use happens inside functions, so the import cycles that game code naturally has are harmless.
- **No module over about 2,000 lines.** A module that grows past that is split the same way.
- **No new behaviour in the split.** It is a move, not a rewrite: the same names, the same code, re-exported where needed.

## Consequences

- **Builders read only the modules a step touches.** The CODEMAP becomes a module map: which file holds what.
- **ADR-0007 is amended for Arena:** a build layer may edit any file under `games/arena/src/` except `engine.js`, still never DOM or dependencies. The other games keep one `game.js`.
- **`sw.js` must list every module in its asset list,** so the game still works offline. The smoke test catches a missing one: it fails on any failed load.
- **Proving nothing changed:** the split is checked by a **same-seed replay**, the same seeded run and the same scripted inputs before and after, with the run state and export compared field by field. Also all the existing scripted checks from Steps 21 to 24, perf within 5%, and `npm run smoke`.
- **The release copy** (`tools/release.sh`) copies the whole game folder, so it needs no change.
- **More files to keep consistent,** in return for builders who only need to read a few of them.

## Alternatives considered

- **Keep one file:** every future step gets slower and riskier. This is what ADR-0007 said to split on.
- **A bundler or a build step:** breaks ADR-0002, and isn't needed when browsers load modules natively.
- **Classes or a framework for the split:** a rewrite, not a move, and the risk with it.
