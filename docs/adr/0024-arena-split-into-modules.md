# ADR-0024: Arena is split into core modules by layer and feature modules by feature, landed by merge, so builders can run in parallel

- **Date:** 2026-11-14
- **Status:** accepted
- **Scope:** one game (`arena`); amends ADR-0007 for Arena only

## Context

ADR-0007 made `game.js` the unit of a build and said: "If a game outgrows this, split by ADR for that game." Arena has. Its `game.js` is 11,181 lines in 15 sections. Every builder reads its way through code it doesn't need, every change risks touching something unrelated, and new modes (Trials, the range, the Daily run) would make it longer still. The designer: "Sounds like we would benefit from being more modular than monolithic now."

ADR-0002 still holds: no bundler, no build step, no dependencies. Browsers load native ES modules (`import`/`export`) directly, and `game.js` already imports `engine.js` that way.

## What the history says (checked 2026-11-14)

Before fixing the shape, the last ten feature builds were measured: which of the 15 sections each one changed.

| Build | Sections changed (of 15) | Where most lines went |
| --- | --- | --- |
| Step 15 | 7 | fighter 36%, drawing 32%, tuning 18% |
| Step 16 | 6 | drawing 70%, tuning 18% |
| Step 17 | 5 | scenes 94% |
| Step 18 | 12 | drawing 28%, foe 28%, hits 11%, rolls 10% |
| Steps 19 and 20 | 12 | drawing 58%, foe 10%, hits 9% |
| Step 21 | 9 | hits 42%, drawing 36%, tuning 17% |
| Step 22 | 12 | card section 54%, drawing 20%, scenes 12% |
| Step 22b | 6 | scenes 54%, card section 36% |
| Step 23 | 10 | scenes 45%, drawing 27%, data 15% |
| Step 23b | 5 | scenes 90% |

**A feature cuts across the layers.** A typical step changes 6 to 12 sections, and nearly all of them touch tuning, drawing and the scenes. So files cut by layer don't keep two builders apart: both would still edit the tuning, the drawing and the scenes. Two more things show in the table:
- **Features are already scattered.** Step 22's knives and sidearm sit in the middle of the card engine's section, and the training yard sits in the scenes.
- **The steps that stayed in one place** (17, 23b) were the ones working on a self-contained feature.

What lets builders work at once is therefore:
1. **a landing that merges** (done: `tools/worktree.sh land`), and
2. **each feature in its own module**, a vertical slice with its own tuning block, update, drawing and scene, joined to the core at a few named points.

The split by layer is still worth doing for a different reason: the file is 914 KB, far more than a builder can read, and recent builds spent 275,000 to 465,000 tokens each, much of it finding their way around.

## Decision

**1. Split the core into about nine modules by layer, so a builder can read what it works on:**

| Module | Holds | Lines today |
| --- | --- | --- |
| `tuning.js` | TUNING. It imports nothing. | ~770 |
| `data.js` | the gauntlet, story lines, the deck, champions, body parts, zones, poses | ~540 |
| `fight.js` | your fighter's model, input, hit resolution, juice | ~1,450 |
| `foe.js` | the foe AI | ~500 |
| `cards.js` | the card engine | ~510 |
| `draw-fight.js` | drawing the fighters, the arena and the HUD | ~2,000 |
| `screens.js` | between bouts, the purse, the inventory, meta, and drawing those screens | ~2,500 |
| `scenes.js` | the menu, roll, play and over scenes | ~2,000 |
| `game.js` | run state, rolls, the game object, save, migrate, the export fields | ~530 |

**2. Features live in their own modules,** under `features/`:
- **Moved out during the split,** because they're recent and self-contained: `features/yard.js` (the training yard) and `features/ranged.js` (the sidearm, knives and the bow).
- **Every new feature from now on** gets its own module: `features/trials.js`, `features/daily.js` and so on.
- **A feature module holds its own tuning block** (merged into TUNING at load), its data, its update and drawing, and its scene if it has one.
- **It joins the core at named hook points** (for example: the play scene's update and draw, the right thumb's input, the menu's buttons, the export fields). The split adds only the hooks those two features need.
- **Older features stay where they are** (the story, champions' moves, beasts) until a step works on them. Nothing is moved for tidiness.

**3. The rules:**
- **Only `tuning.js` and `data.js` may be read while modules are loading.** Every other cross-module use happens inside functions, so import cycles are harmless. A module-level `const` used across a cycle at load time throws, and the smoke test catches that.
- **It's a move, not a rewrite,** and it's done by a script (a table of which top-level declaration goes to which module, with the imports generated), not by hand. The script can be re-run if another build lands first, and reviewing it means reading the table.
- **A module past about 2,000 lines is split.**

**4. Working in parallel:**
- **Two builders may run on Arena at once when their steps are different features,** one of them mostly in its own feature module. It's never two on the same mechanic, and never anyone alongside the split itself.
- **Landing is a three-way merge** (`tools/worktree.sh land`): edits to different lines of one file both land; the same lines, or the same new file from two builders, stop as a conflict for the orchestrator.
- **Shared spots are kept merge-friendly:** lists that every feature adds to (the state's starting fields, the export fields, the offline asset list) are written one item per line.
- **Only one in-flight build may change the save shape,** and the orchestrator bumps `CACHE_VERSION` once at landing; builders don't.

## Consequences

- **Honest size of the gain:** about two Arena builders at once when the steps are separable (for example the look of each blow beside Trials), not three or more. The designer's playtest stays serial, and two builds at once cost twice as much per hour.
- **Builders read one or two modules,** not a 914 KB file.
- **Proving nothing changed needs a deterministic replay, which doesn't exist yet.** The engine steps on real time, and today's scripted checks run in real time, so two runs of the same script differ. `tools/replay.mjs` (new, before the split) loads the game with a fake clock, a manual frame queue and a seeded `Math.random`, injected by the test harness with no change to the game. It plays a recorded input script and dumps the run state and export. The split passes when the dump is identical before and after, over at least three runs (a Pit win, a City loss, a beasts bout).
- **Also for the split:** every scripted check from Steps 21 to 24, perf within 5%, and `npm run smoke`.
- **ADR-0007 is amended for Arena:** a build layer may edit the modules its step names, never `engine.js`, DOM or dependencies. The other games keep one `game.js`, and they get the merging landing too.
- **`sw.js` lists every module;** `tools/codemap-check.mjs` reads every module under `src/`; `tools/release.sh` copies the whole folder and needs no change.
- **The CODEMAP becomes a module map** with the hook points.

## Alternatives considered

- **Keep one file:** every future step gets slower and riskier. This is what ADR-0007 said to split on.
- **A bundler or a build step:** breaks ADR-0002, and isn't needed when browsers load modules natively.
- **Classes or a framework for the split:** a rewrite, not a move, and the risk with it.
- **One module per section (about 20):** tidier, but more files for each builder to keep consistent and no extra parallelism. The designer asked not to overdo it.
- **Lanes by layer as the way to work in parallel** (this ADR's first draft): the history shows a feature changes 6 to 12 sections, so layers don't separate builders. Feature modules do.
- **Keeping one file, with only the three-way landing:** that already allows some parallel work, but every builder still reads 11,000 lines, and the clashes in one file are harder to see.

## As built (2026-11-14, `arena-v68`)

- **Proved identical:** three replays (the Pit, a City pair bout, a beast bout) give byte-identical dumps before and after, run by the builder and again by the orchestrator. 998 of the 999 top-level declarations are in the modules verbatim; the 999th, the play scene, differs only by the list of names the checks use (moved to `game.js`) and the export's fields written one per line. The frame time is 3.8% better.
- **Sizes:** tuning 790, data 521, fight 1,491, foe 508, cards 308, draw-fight 2,831, screens 1,617, scenes 2,059, game 1,038, features/yard 384, features/ranged 474.
- **Over the 2,000-line limit:** `draw-fight.js`. The kit painting (`paintHead` to `paintCloak`) splits out cleanly, and is the next move, by the same script.
- **Hooks are plain calls:** the core calls the feature modules' functions at call sites named in each module's header. No registry was added.
- **Left in the core:** the features' `TUNING` blocks (moving them would change the key order), `foeSidearm` (the foe's own decision), and the bow and knife branches inside `drawSwordArm`, `resolveOne` and the HUD (moving them would mean rewriting those functions).
