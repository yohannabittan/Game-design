# Layer 3: Juice

Fill in: `SLUG`, `PLAYTEST_NOTE`

---

You are building layer 3 (juice and feel) of the game `SLUG` in this repository. Mechanic and content are in and have been played. Designer's note: "PLAYTEST_NOTE".

Read:
1. `CLAUDE.md`
2. `docs/games/SLUG/prd-v0.1.md`, sections 10 (juice list), 11 (art direction), 12 (audio)
3. `skeleton/README.md`, the Juice and Audio rows of the API table
4. `games/SLUG/src/game.js`

Then edit `games/SLUG/src/game.js`. Do not create or modify any other file.

## What layer 3 delivers

Every row of the PRD's juice table, implemented with the engine's helpers:

- Input start gets an immediate response (under one frame): a highlight, a scale, a sound.
- Hits and misses are distinguishable with sound off (visual only) and with eyes closed (sound and haptic only). Test both mentally and say how each reads.
- Particles on hits with the object's colour; a different, smaller burst or a flash on misses. `E.shake` on failures and big hits only; small hits do not shake.
- Score changes animate: pop the number with `E.tween` and `ease.outBack`, or count up.
- Level clear and run over have a short, satisfying beat: a tween on the end screen, the `win` or `lose` sound, and the buttons appear after the beat, not before, so a tap during the beat is not swallowed by a button.
- Anticipation where the mechanic has it: a drag shows tension, a charge shows a growing indicator, a spawn telegraphs before it matters.
- Haptics: 8 ms on small hits, 30 ms on fails, nothing on UI taps.
- Sound: map events to the engine's named sounds, or compose new ones with `E.audio.beep` and `E.audio.noise` if the PRD's audio section asks for a distinct identity. Keep them short.

## Rules

- Feel must not change the outcome. No juice may alter hitboxes, timing windows, or physics. Everything is cosmetic.
- All durations and magnitudes go into `TUNING` under a `juice` sub-object so they can be tuned.
- Respect the mute flag: never play audio directly; always through `E.audio`.
- Frame budget: particles are capped (say the cap in `TUNING`); nothing allocates per frame in a loop.

## What layer 3 must not do

- No new mechanics, content, progression, modes.
- No DOM, files, libraries, or `engine.js` changes. If the engine lacks a helper you need, do without and note it in the changelog for a skeleton ADR.

## Before you say done

- Run `npm run smoke`.
- Add a changelog line under v0.1.
- Say which events you think will need tuning first, and why.
