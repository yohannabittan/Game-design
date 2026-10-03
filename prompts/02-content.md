# Layer 2: Content

Fill in: `SLUG`, and the one-line result of playing layer 1: `PLAYTEST_NOTE`

---

You are building layer 2 (content) of the game `SLUG` in this repository. Layer 1, the mechanic, is done and has been played. The designer's note after playing it: "PLAYTEST_NOTE".

Read, in this order:
1. `CLAUDE.md`
2. `docs/games/SLUG/prd-v0.1.md`, especially sections 5 (skill model) and 9 (content plan)
3. `games/SLUG/src/game.js` (the current build; keep its mechanic intact)
4. `docs/design-principles.md`, principles 2, 3 and 10

Then edit `games/SLUG/src/game.js`. Do not create or modify any other file.

## What layer 2 delivers

- The full v0.1 content count from PRD section 9, as entries in the existing data array. No level logic in code paths; if a level needs a new element, add it to the data shape and handle it generically.
- Levels 1 to 3 teach what PRD section 9 says they teach, in that order, and cannot be failed by a player who does the taught thing.
- A difficulty curve where the second half needs a tip from the PRD's intermediate list that the first half did not. Name which level introduces which tip in a comment on that entry.
- The boss beat from PRD section 9 if one is specified for v0.1.
- Level select or sequential unlock as PRD section 8 specifies. Clearing a level unlocks the next; the save stores the highest unlocked. Nothing else in the save yet.
- A par, target, or expected score per level where PRD section 7 defines one, so the naked-run and the outsized-reward rules can be checked.

## Must-pass versus notes

The brief from the orchestrator lists which harness checks must pass and which only print notes (for example an extra two-stroke route that matches the three-star count is a note, not a failure). Do not spend time closing notes. Use the shared search helper in the game's harness when one exists instead of writing your own optimiser.

## Naked run

Every entry you add must be clearable on base equipment by an excellent player. For each entry, write in a comment the intended solution in one line. If you cannot write one, the level is not valid.

## What layer 2 must not do

- No changes to the mechanic's feel or `TUNING` values unless the playtest note asks for it. If it does, change the number and say so.
- No juice, progression beyond unlock-next, art, audio, or modes.
- No DOM, files, libraries, or `engine.js` changes.

## Before you say done

- Run `npm run smoke`.
- List the levels with their teaching goal or tip, and their intended solution, as a table in your final message.
- Add a changelog line under v0.1.
