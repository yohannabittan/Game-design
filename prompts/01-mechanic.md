# Layer 1: Mechanic

Fill in: `SLUG`

---

You are building layer 1 (the mechanic) of the game `SLUG` in this repository.

Read, in this order:
1. `CLAUDE.md`
2. `docs/games/SLUG/prd-v0.1.md` (the spec; it is complete and locked)
3. `skeleton/README.md` (the engine contract)
4. `games/SLUG/src/engine.js` (the engine, read-only)
5. `games/SLUG/src/game.js` (the demo you will replace)
6. `docs/design-principles.md`

Then rewrite `games/SLUG/src/game.js` entirely. Do not create or modify any other file.

## What layer 1 delivers

A grey-box playable version of the core mechanic:

- The verb from PRD section 4, with the exact gestures listed, including the occlusion rule.
- The physics or logic that makes the skill axis (PRD section 5) real. A correct input always produces the correct outcome (ADR-0008).
- One level, wave, or arena: the first one from PRD section 9, the one that teaches the verb.
- Score or progress as described in PRD section 7, shown in the HUD.
- The fail condition, an end screen with the score and best, and a one-tap restart.
- A menu scene with a play button and the mute toggle.
- Every number in `TUNING`, copied from PRD section 16 with the same names.
- Plain shapes and the three colours from PRD section 11. No art beyond that.
- The engine's named sounds on hit and miss only. No further juice yet; that is layer 3.

## What layer 1 must not do

- No additional levels, no progression, no unlocks, no modes, no badges.
- No particles, shake, or tweens beyond what makes the mechanic readable.
- No DOM, no new files, no libraries, no changes to `engine.js`.
- Nothing from the PRD's scope fence (section 14).

## Style

- Scenes are plain objects as in the skeleton demo. Keep `menu`, `play`, `over`.
- Level data is a plain array even if it has one entry, shaped as PRD section 9 describes, so layer 2 only adds entries.
- Any play-affecting randomness uses `makeRng(seed)`; `Math.random` only for cosmetics.
- Short comments where the physics is non-obvious. No comment restating the code.

## Before you say done

- Run `npm run smoke`. It must pass with `games/SLUG` listed as ok.
- Check every item in PRD section 15 that applies to this layer and say which ones you could not verify without a phone.
- Add a line to `docs/games/SLUG/CHANGELOG.md` under v0.1 describing what layer 1 delivered and any PRD open question you resolved, with the option you picked.
- Report the tuning values you changed from the PRD, if any, and why.
