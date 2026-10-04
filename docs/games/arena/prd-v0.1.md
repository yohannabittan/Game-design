# Arena PRD v0.1-proto: training dummy (the cut)

Status: locked 2026-10-04 by the designer: "do the training dummy prototype, extra fast; it's OK if it has issues, since it's a one-time proto". This is a **feel prototype** of the gladiator idea's core verb (the Swords and Sandals-like row in `docs/game-ideas.md`), not a v0.1. Principle 12 applies: feel first. Nothing else from the idea is built: no wheels, market, arenas, opponents or story.

## What it is

- Portrait, one thumb, a dark sand-pit arena.
- A **straw training dummy** stands in the upper half, about 60 percent of the screen width tall.
- **Body parts:** the dummy has six parts, drawn as simple shapes: head, chest, belly, left arm, right arm and legs.
- **Armour:** a randomly chosen, seeded subset of 3 or 4 parts is armoured, drawn as grey metal plates over the straw. The rest are bare straw: those are **the gaps**.
- **The dummy moves:** it turns slowly on its post, a sway of ±25 degrees and a slight bob, so the gaps move. The speed is in `TUNING`.

## The cut

- **Drawing:** touch and drag to draw a cut, then release to strike.
  - The cut is a straight segment from where the line started to where it ended, shown as a bright line while drawing.
  - The cut's length is capped at `TUNING.cut.maxLen` (reach).
  - The cut must be drawn within `TUNING.cut.maxTime` (0.6 s).
- **Hits:** the segment is tested against the parts' shapes at release.
  - **Every bare part it crosses scores:** a straw burst, a satisfying slice sound and a short hit-stop (60 ms). The part goes dark ("disabled").
  - **Armour it crosses clangs:** sparks and a metal sound, and no score.
  - **Combos:** a single cut through two or more bare parts is a combo, with a bigger burst.
- **The three input presets** are a TUNE experiment, to compare on the phone:
  1. **Offset blade** (the default): the line is drawn `offset` px **above** the finger (about 70 px), so the thumb never hides the target, like Ink's needle.
  2. **Flick:** a fast swipe. The cut is the swipe's direction, starting at the swipe's start point, with its length from the swipe's speed up to `maxLen`. Precision comes from aim, not from tracing.
  3. **Slow motion:** while the finger is down, the dummy's motion slows to `slowMo` (0.25×) for up to 0.6 s. The line is drawn under the finger with the offset, as in preset 1.
- **The score:** a running count of gaps cut, clangs and combos. A **round** is 30 seconds. Then the dummy resets with new armour from the next seed, and a result card shows cuts, clangs, combos and the best combo, with Again and Menu.

## Rules

- Touch first. HUD in the safe area. Every tunable number in `TUNING`: dummy sway, bob, part sizes, cut length, time, offset, hit-stop and slow-mo.
- Seeded armour per round (`makeRng`, ADR-0008). `Math.random` only for straw particles.
- No save beyond the engine's default.
- Sounds through the engine's audio. A slice must feel crunchy, and a clang must feel dull.
- No art assets, procedural only: straw dummy, metal plates.

## Out of scope

Opponents, parry, stats, wheels, market, story and progression.

## Acceptance

`npm run smoke` passes. The three presets switch live in TUNE. A cut through a gap scores, and a cut across armour clangs.
