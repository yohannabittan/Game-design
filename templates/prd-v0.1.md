# PRD v0.1: GAME_TITLE

| | |
| --- | --- |
| Slug | `GAME_SLUG` |
| Version | 0.1 |
| Pattern | P? |
| Date | YYYY-MM-DD |
| Status | draft / locked / built / tested |

This document is the one-shot contract. A builder session gets this, the skeleton, and the layer prompt. If something is not in here, the builder should not invent it. Describe behaviour, not implementation.

## 1. Pitch

One sentence. Then the fantasy in one more.

## 1b. Context, story, characters, emotion

From `world.md` (principle 17): the drive in one line, the cast by name, and which story pieces v0.1 carries. Usually that is the cold open and the voice on the result card; career beats and the payoff can come later. List the canonical lines the build copies.

## 2. The first ten seconds

What the player sees, touches, and gets back, from launch to first meaningful feedback. This is also the spec for the first level.

## 3. Core loop and session shape

- Loop: input, feedback, consequence, repeat. Spell it out.
- A session lasts about N seconds to N minutes.
- A session ends when: (fail condition, or level cleared, or timer).
- Closing the app mid-session: run is resumed / run is discarded and that is fine because sessions are short. Pick one.

## 4. Controls

Portrait. One thumb unless stated.

| Gesture | Where | Does |
| --- | --- | --- |
| Tap | anywhere | |
| Drag | anywhere | |
| Release | | |
| Hold | | |

Keyboard fallback for desktop testing: (keys).

Occlusion rule: the thumb must never hide the thing the player is judging. Say how.

## 5. Skill model

- **Skill axis:** the one thing you get better at.
- **Intermediate tips (1 to 3):**
  1.
- **Expert tips (3 to 5):**
  1.
- **Legendary:** what a legendary player does that the game never explains.
- **Naked run:** how every level is clearable on base equipment by an excellent player.
- **Outsized reward for skill:** what a perfect play gets that a sloppy one does not (multiplier, tier, shortcut).

## 6. Randomness policy

- Random in setup: (list what).
- Deterministic in resolution: (state that a correct input always produces the correct outcome, and name the inputs).
- Seed: per run / daily / none for v0.1.

## 7. Goal, fail, score

- Win a level / round when:
- Fail when:
- Score formula, in words:
- End screen shows: score, best, one-tap retry, and nothing else in v0.1.

## 8. Progression in v0.1

Minimal: best score, unlock next level by clearing the previous. Everything else is deferred to the progression layer. List what is deferred so it is not accidentally built:

-

## 9. Content plan

- Count for v0.1: N levels / waves / shapes.
- Authored as: a data array in `game.js` (say the shape of one entry in words).
- Levels 1 to 3 teach, in order: (a) (b) (c).
- Difficulty curve: the second half requires which tip from section 5?
- Boss beat: every X levels, what changes shape? (Or: none in v0.1.)

## 10. Juice list

Minimum feel. Each event gets a distinct response.

| Event | Visual | Sound | Haptic |
| --- | --- | --- | --- |
| Input start | | | |
| Hit / success | | `hit` | 8 ms |
| Miss / fail | | `miss` | 30 ms |
| Level clear | | `win` | |
| Run over | | `lose` | |

## 11. Art direction

Shapes and colour for v0.1. Name three colours and what each means (player, goal, danger). What must read at a glance from arm's length.

## 12. Audio

Which engine sound names map to which events (see the juice list). Music: none in v0.1.

## 13. Modes

v0.1 ships one mode: (which). Planned later: (list).

## 14. Scope fence

Explicitly not in v0.1. Be generous here.

-

## 15. Acceptance criteria

Every item is testable by playing.

- [ ] Loads from the home-screen icon in airplane mode
- [ ] First-time player understands the verb within ten seconds without reading anything
- [ ] Fail to playing again in one tap, under one second
- [ ] All N levels are clearable on base equipment
- [ ] Hit and miss are distinguishable with sound off, and with eyes closed
- [ ] No text smaller than 14 px; touch targets at least 44 px
- [ ] Runs at a steady frame rate on a mid-range phone with all effects on
- [ ] `npm run smoke` passes
- [ ] (game-specific)

## 16. Tuning table

Every number the builder needs. Guesses are fine; they go straight into `TUNING` and get tuned in playtests.

| Name | Value | Meaning |
| --- | --- | --- |
| | | |

## 17. Open questions

Things you are unsure about. The builder picks the simplest option and notes it in the changelog.

-
