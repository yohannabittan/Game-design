# ADR-0024: Arena is split into about ten native ES modules by lane, so builders can run in parallel

- **Date:** 2026-11-14
- **Status:** accepted
- **Scope:** one game (`arena`); amends ADR-0007 for Arena only

## Context

ADR-0007 made `game.js` the unit of a build and said: "If a game outgrows this, split by ADR for that game." Arena has. Its `game.js` is 11,181 lines in 15 sections. Every builder reads its way through code it doesn't need, every change risks touching something unrelated, and new modes (Trials, the range, the Daily run) would make it longer still. The designer: "Sounds like we would benefit from being more modular than monolithic now."

ADR-0002 still holds: no bundler, no build step, no dependencies. Browsers load native ES modules (`import`/`export`) directly, and `game.js` already imports `engine.js` that way.

## Decision

**Split Arena into about ten modules by lane: the areas that different steps work in.** That's not one file per section. The aim is parallel builds, not tidiness. Two builders can work at once when their steps sit in different lanes, and a three-way landing merges their files.

The sizes below are today's line counts of the sections each module takes:

| Module | Lane | Holds | Lines |
| --- | --- | --- | --- |
| `tuning.js` | shared | TUNING, with one block per lane. It imports nothing. | ~770 |
| `data.js` | content | the gauntlet, story lines, the deck, champions, body parts, zones and poses | ~540 |
| `fight.js` | feel | your fighter's model, input, hit resolution, juice | ~1,450 |
| `foe.js` | foes | the foe AI: cover, memory, moves, champions' signatures | ~500 |
| `cards.js` | builds | the card engine: events, Momentum, Bleed | ~510 |
| `draw-fight.js` | feel | drawing the fighters, the arena and the HUD | ~2,000 |
| `screens.js` | builds | between bouts (the grade, the draft), the purse, the inventory, meta (fame, the ludus, the Wall) and drawing those screens | ~2,500, split in two if it grows |
| `scenes.js` | modes | the menu, roll, play and over scenes | ~2,000 |
| `modes/yard.js` and later `modes/trials.js` | modes | one file per self-contained mode | — |
| `game.js` | shared | run state, rolls, the game object, save, migrate, the export fields | ~530 |

**The rules:**
- **Only `tuning.js` and `data.js` may be read while modules are loading.** Every other cross-module use happens inside functions, so the import cycles game code naturally has are harmless.
- **It's a move, not a rewrite:** the same names and the same code, imported where needed.
- **A module past about 2,000 lines is split within its lane.**

**Working in parallel:**
- **Each PRD step names its lane and the modules it touches.** Two builders may run on Arena at once only if their steps are in different lanes. It's never two on the same mechanic, because a semantic clash isn't something a merge can catch.
- **The shared files are merged, not owned:**
  - a builder adds TUNING numbers in its lane's block;
  - only one in-flight build may change the save shape (`saveVersion`), and the orchestrator says which;
  - **builders don't bump `CACHE_VERSION`:** the orchestrator bumps it once when it lands a build.
- **Landing is a three-way merge:** `tools/worktree.sh land` merges each file against the commit the worktree started from (`git merge-file`), so two builders' edits to the same file both land. A clash on the same lines stops with conflict markers for the orchestrator. `--copy` keeps the old whole-file copy.

## Consequences

- **The split is ten files, not twenty.** Each lane is one or two files a builder reads in full. A builder working on the fight's feel no longer reads the purse.
- **Up to three builders can run** (the "keep it lean" cap): for example one on the feel lane, one on modes, one on builds.
- **ADR-0007 is amended for Arena:** a build layer may edit the modules its step names, never `engine.js`, DOM or dependencies. The other games keep one `game.js`, and they get the three-way landing too.
- **`sw.js` must list every module,** so the game still works offline. The smoke test fails on any failed load.
- **Proving nothing changed:** a **same-seed replay**, the same seeded run and scripted inputs before and after, with the run state and export compared field by field. Also the scripted checks from Steps 21 to 24, perf within 5%, and `npm run smoke`.
- **`tools/release.sh` copies the whole game folder,** so it needs no change.
- **The CODEMAP becomes a module and lane map.**

## Alternatives considered

- **Keep one file:** every future step gets slower and riskier. This is what ADR-0007 said to split on.
- **A bundler or a build step:** breaks ADR-0002, and isn't needed when browsers load modules natively.
- **Classes or a framework for the split:** a rewrite, not a move, and the risk with it.
- **One module per section (about 20):** tidier, but more files for each builder to keep consistent and no extra parallelism. Lanes are what make work parallel, and the designer asked not to overdo it.
- **Keeping one file, with only the three-way landing:** that already allows some parallel work, but every builder still reads 11,000 lines, and the clashes in one file are harder to see.
