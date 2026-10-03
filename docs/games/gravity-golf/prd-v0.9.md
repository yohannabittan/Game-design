# Gravity Golf PRD v0.9: the blind fourth star

Status: locked 2026-10-03 by the designer: "3 stars with no or minimal range finder, just to indicate direction". Builds on v0.8.

The idea: every hole you have three-starred can be replayed blind. Beat its three-star count with only a direction pointer, and you earn a fourth star. This is mastery content that makes every existing hole worth replaying. It costs no new holes and no harness proving, because the routes are the same.

## A. Blind mode

- **Unlock:** a hole with three stars offers a blind try. There are two ways in: a "Blind" button on the end card after a three-star finish, and a small blind toggle on that hole's tile in the select grid. Both are 44 px targets.
- **What changes in a blind try:**
  - The trajectory preview is gone, even on holes 1 to 3.
  - The last shot's ghost is hidden.
  - What remains is a short **direction pointer**: a straight arrow from the ball in the aim direction, of fixed length, so it shows neither power nor curve.
  - Power is read only from the drag, as it already is.
  - Everything else is unchanged: physics, hazards, penalties, timing, the HUD stroke count and par.
  - The HUD shows a small "Blind" tag, so the mode is never mistaken for a bug.
- **The fourth star:** hole out within `stars.three` strokes in a blind try, penalties included. A blind try that misses still counts for the hole's normal stars (they can never go down), but it earns no fourth star.
- **Badges:** they fire in blind tries as they would in normal play. No new badge.

## B. Showing it

- The fourth star has its own look: a smaller cyan "comet" star beside the three green ones on the tile and on the end card. It is drawn the same way everywhere and stays dim until earned.
- The end card of a blind three-star finish plays a brighter version of the three-star sound and burst (principle 16).
- The select tiles keep their text counts (principle 11). The fourth star replaces nothing.

## C. The rank

- Fourth stars count toward the rank like any other star. With 30 holes the ladder can reach 120 stars, which is rank 13, Nebula. "More holes coming" now appears above the 130-star rank.
- The hint line ("n left on holes you've played") counts missing fourth stars on holes that already have three.
- The thresholds do not change (10 stars per rank).

## D. Saves

- `saveVersion` 10 adds `blind`, a map from hole index to true when the fourth star is earned. `migrate` adds an empty map and keeps everything else.
- The star total used by the rank and the menu is the sum of the best normal stars plus the count of `blind`.

## E. Out of scope

New holes, new badges, any physics change, timed modes, and blind runs of the whole course.

## F. Acceptance

- In Playwright, a blind try shows the pointer only, with no dots and no ghost.
- The hole 1 route sinks blind and earns the fourth star. A blind miss keeps the earlier stars.
- The tile, the end card and the ladder show the fourth star.
- The rank math is right for a save with 90 stars plus 5 blind (95 stars, Blue Giant, "5 stars to White Dwarf").
- A v9 save migrates.
- The pointer stays clear of the HUD at 390x844. No console errors.
- `npm run smoke` passes. The play frame is not slower than v0.8.
