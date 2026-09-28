# Layer 6: Audio

Fill in: `SLUG`, `PLAYTEST_NOTE`, `VERSION`

---

You are building layer 6 (audio) of the game `SLUG`. Designer's note: "PLAYTEST_NOTE".

Read:
1. `CLAUDE.md`
2. `docs/games/SLUG/prd-vVERSION.md`, the audio section
3. `skeleton/README.md`, the Audio row, and the `Audio` class in `games/SLUG/src/engine.js` (read-only)
4. `games/SLUG/src/game.js`

Then edit `games/SLUG/src/game.js`. If the PRD calls for music or recorded sounds, you may add files under `games/SLUG/assets/` and must add them to `sw.js`'s `ASSETS`. No other files.

## What layer 6 delivers

- A sound identity: a small set of sounds (6 to 10) composed with `E.audio.beep` and `E.audio.noise` that share a character (a waveform family, a pitch range, an envelope style). Define them in one place as functions in a `SFX` object in `game.js` and call them by name.
- Pitch that carries information: combo or streak raises pitch by a step; bigger hits are lower and longer; the last life sounds different.
- Nothing sounds the same twice in a row when it matters: small random detune on repeated hits (cosmetic, `Math.random` is fine here).
- Silence is used: no sound on UI navigation except a single soft tap; the play scene has room for the important sounds.
- Music, only if the PRD asks: a short loop under 300 KB, started on the first user gesture, paused on `onPause`, respecting mute. If the PRD does not ask, do not add music.
- A mute toggle already exists in the menu; make sure every sound goes through `E.audio` so it is honoured.

## Rules

- Audio never changes outcomes and never blocks the frame. No synchronous decoding.
- iOS starts audio only after a user gesture; the engine already unlocks on the first pointer down. Do not add your own unlock code.
- Keep gain conservative (peaks below 0.3) so stacked sounds do not clip.

## What layer 6 must not do

- No mechanic, content, progression, art, or mode changes.
- No DOM, libraries, or `engine.js` changes.

## Before you say done

- Run `npm run smoke`.
- Bump `CACHE_VERSION` if assets were added.
- Add a changelog line listing the sounds and what triggers each.
