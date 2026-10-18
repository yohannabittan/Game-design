# Gravity Golf PRD v0.15: every stroke counts

Status: draft 1, 2026-10-18, for the designer. It builds on v0.14 with A2.

**What the designer said:** "It's too easy. It feels like it's just about finding the angle, and I can always do it in 1 shot." And: "The whole game feels too easy, to be honest."

**What the export shows (2026-10-18, 200 entries):**
- The usual pattern is a shot, Retry, a shot, Retry, then a hole-in-one. For example: hole 1 blind took 8 retries; hole 31 took 18 retries over two sittings; hole 38 took 7 retries.
- A Retry costs nothing, so the three stars only ask you to find the angle eventually.
- 20 of the 40 holes give three stars for 1 stroke.
- The cup is generous: it pulls a ball in from 44 units at up to 380 units per second. So a near miss often drops.

## A. Every stroke counts

- **The strokes of a visit add up.**
  - A visit is every attempt at a hole until you sink it.
  - Retry sends the ball back to the tee, but the strokes already played stay on the count.
  - Leaving for the menu keeps them too: they are saved per hole and still there when you come back.
- **The hole's score is the visit's total,** so a hole-in-one on your third try counts as 3.
- **The HUD shows the visit's strokes,** and the end card adds "(2 retries)" when there were any.
- **Blind tries:** the same rule, with their own count.
- **Runs (the full-run counter):** unchanged, since a run already counts every stroke.
- **Stars and bests already earned stay** (they can never go down), and the rank ladder is unchanged.

## B. A tighter cup

- `captureR` goes from 44 to about 32, and `sinkSpeed` from 380 to about 320 (both in TUNING), so a near miss no longer drops and the line must be true.
- **The lean check, once for all 40 holes:** `sim-golf --three` at one frame rate plus jitter.
  - Any hole whose three-star route then fails is nudged: its cup moves a few units, or a body moves.
  - It is never re-authored.

## C. For the next zone

- From hole 41 on, three stars always take at least 2 strokes.
- The direct line is blocked, so you land and play from where you rest.
- This is an authoring rule for the zone's content shards, not part of this build.

## D. Saves

`saveVersion` 12 adds `visit` per hole (the strokes of an unfinished visit). `migrate` sets every hole's to 0.

## E. Out of scope

- new holes;
- the aim preview (the blind fourth star already hides it);
- star counts per hole.

## F. Acceptance

- A Retry keeps the strokes, and so does leaving and coming back.
- A sink ends the visit and resets it.
- Every hole's three-star route still sinks with the tighter cup (`sim-golf --three`).
- `npm run smoke` passes.
- Difficulty and feel are judged by the designer's playtest.

**Rough cost:** one Sonnet build plus the 40-hole check, about $8 to $10.
