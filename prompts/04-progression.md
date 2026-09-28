# Layer 4: Progression

Fill in: `SLUG`, `PLAYTEST_NOTE`, and the version this becomes: `VERSION` (usually 0.2)

---

You are building layer 4 (progression) of the game `SLUG`. The v0.1 kernel passed the delight test. Designer's note: "PLAYTEST_NOTE". This layer makes it vVERSION.

Read:
1. `CLAUDE.md`
2. `docs/games/SLUG/prd-vVERSION.md` (the delta PRD; it says what progression is in)
3. `docs/games/SLUG/prd-v0.1.md` sections 5 and 8 (the naked-run rule and what was deferred)
4. `docs/design-principles.md`, principles 3, 4 and 7
5. `docs/pattern-library.md`, layer pattern L5 (tiered badges) and any layer the delta PRD names
6. `games/SLUG/src/game.js`

Then edit `games/SLUG/src/game.js`. Do not create or modify any other file.

## What layer 4 delivers

Only what the delta PRD lists, from this menu:

- Stars or medals per level from score or shot count, shown on level select.
- Unlocks that change how you play (a new ball, gun, animal, tool) rather than raw power. If an unlock adds power, it lowers the skill needed by a small step only, and the intended solutions from layer 2 must still work without it.
- Badges in themed tiers (L5): a name scheme, 3 tiers, 4 to 8 badges, shown on one screen. Each badge is earned by a skill act, not by time spent.
- A run-resume if the PRD's session shape says runs are resumed on reopen: save the run in `onPause`, restore in `enter`.
- A save shape for all of the above. Bump `saveVersion`, implement `migrate` from the previous shape, and keep the whole save under a few kilobytes.

## Rules

- Naked run stays true. Add a comment on each level's intended solution confirming it still holds with base equipment.
- Skill gets outsized rewards: the best tier should be worth visibly more than the middle tier.
- No currencies or shops unless the delta PRD explicitly asks. Unlocks gate on achievements, not grind counters, by default.
- Progress is never lost by closing the app.

## What layer 4 must not do

- No new mechanics, levels, art, audio, or modes.
- No DOM, files, libraries, or `engine.js` changes.

## Before you say done

- Run `npm run smoke`.
- Describe the save shape in the changelog under vVERSION, plus the migration.
- List the unlocks and badges as a table with what earns each.
