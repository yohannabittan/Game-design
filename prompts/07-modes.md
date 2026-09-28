# Layer 7: Modes

Fill in: `SLUG`, `PLAYTEST_NOTE`, `VERSION`, and the modes to add: `MODES`

---

You are building layer 7 (modes) of the game `SLUG`. Designer's note: "PLAYTEST_NOTE". Modes to add in this pass: MODES.

Read:
1. `CLAUDE.md`
2. `docs/games/SLUG/prd-vVERSION.md`, the modes section
3. `docs/pattern-library.md`, layer pattern L7 (modes) and L1 (run structure) if a roguelike mode is listed
4. `docs/design-principles.md`, principles 6 and 8
5. `games/SLUG/src/game.js`

Then edit `games/SLUG/src/game.js`. No other files.

## What layer 7 delivers

The listed modes, each reusing the play scene with a mode config rather than a copy of it:

- **Daily seed:** `E.dailySeed()` drives all play-affecting randomness; one attempt per day is recorded with its score; the menu shows today's best and yesterday's.
- **Endless:** content chunks (levels, waves, segments) are drawn from the existing data with a seeded RNG and escalation rules; distance or waves survived is the score.
- **Time attack:** fixed content, fastest clear wins; a running timer replaces the score in the HUD.
- **Zen:** no fail state, no timer, same mechanic; nothing is recorded except time played.
- **Boss rush:** only the boss entries, back to back.
- **Challenge:** a named constraint (naked run, one life, no retries) applied to the campaign; completing it earns a badge.
- **Run (roguelike):** a fixed-length sequence (10 to 15) of content chunks with a choice between chunks (pick one of three modifiers or items), announced modifiers, pity in the pools, and a meta unlock that widens the pool. Only if listed.

Each mode gets a menu entry, its own best score in the save (bump `saveVersion` and migrate), and its own end screen line.

## Rules

- One mechanic, many sessions. A mode must not introduce a new verb.
- Seeds: every mode that has randomness shows or stores its seed so a run can be repeated.
- Modes must not bloat the play scene with branching. Use a `mode` config object with the few flags and numbers each mode needs.

## What layer 7 must not do

- No new mechanics, art, audio.
- No DOM, files, libraries, or `engine.js` changes.

## Before you say done

- Run `npm run smoke`.
- Add a changelog line naming the modes and the save changes.
- Say which mode you expect to be the most played, and why.
