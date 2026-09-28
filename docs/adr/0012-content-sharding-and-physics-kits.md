# ADR-0012: Content layers are built in parallel shards; physics lives in per-family kits with a harness

- **Date:** 2026-09-28
- **Status:** accepted
- **Scope:** process, skeleton, all games with authored content

## Context

The first Gravity Golf content run built nine holes sequentially in one builder session, and most of its time went into the builder writing and re-running its own physics simulator to prove each hole's intended solution. Levels are data, not code: once the mechanic and the level entry shape are locked, each level is independent of the others. The designer asked whether levels can be built in parallel. They can, with three supports in place.

Separately, the question came up whether one physics engine can serve every game. It cannot, and ADR-0002 already says each game writes its own physics. But several patterns share a physics family (ball on a table; ballistic flight; platformer; steering), and a game in a family should start from a proven kit, not from zero.

## Decision

**Content sharding.** A content layer (levels, holes, waves, shapes, scenes) is built by several builder sub-agents in parallel, each assigned a slice by the orchestrator from the PRD's content plan: which entries, which teaching goal or tip, which difficulty slot. Each agent returns data entries with a verified intended solution. The orchestrator merges the entries into the game's data array in PRD order, then one reviewer checks the whole sequence for the difficulty curve. Preconditions:

1. The mechanic layer is done and has been played. Shards are never started against physics that may still change.
2. The level entry shape is fixed in `game.js` and described in the PRD.
3. A simulation harness exists for the game's physics kit, so each agent verifies its entries in seconds instead of writing a simulator.

The one-file rule (ADR-0007) is amended: during a content layer, builders return data snippets rather than rewriting `game.js`; the orchestrator does the merge. Everything else in ADR-0007 stands.

**Physics kits.** `skeleton/kits/` holds one small module per physics family, copied into a game like the engine is (ADR-0006), and each kit ships with a matching harness in `tools/sim-<kit>.mjs` that runs a level entry through the kit headlessly and reports the outcome of a given input. The first kit is `ball-table` (circles, axis-aligned walls, bumpers, friction, point gravity wells, hole capture), extracted from Gravity Golf once its v0.1 passes the delight test. Planned kits: `ballistic` (one body, gravity, drag, wind, boosts), `platformer` (tile collision, jump curves, coyote time), `steering` (follow-the-finger with lag, circle overlap). The pattern library names the kit each pattern uses. Patterns with no physics use none.

The shared engine stays physics-free.

## Consequences

- A ten-entry content layer takes about the time of a three-entry one, and the same shape works for waves, shapes and scenes.
- The harness makes reviews faster and more trustworthy: a reviewer checks a claimed solution by running it, not by reading.
- Kits mean the second game in a family starts from tuned, played physics. The cost is keeping kits small and copying them, never importing across games.
- The orchestrator does more: slicing the content plan, merging, and ordering. That is design work and belongs there.
- Mechanic layers stay single-builder. Feel is one set of numbers and splitting it makes it worse.

## Alternatives considered

- One shared physics engine for all games: heavy, a large surface for one-shots to get wrong, and the families genuinely differ. Rejected (see ADR-0002).
- Sequential content forever: simple, and three to five times slower for no quality gain once the harness exists.
- Builders merging into `game.js` themselves in parallel: they would overwrite each other. Rejected.
