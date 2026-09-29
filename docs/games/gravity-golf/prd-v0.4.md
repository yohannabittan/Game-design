# Gravity Golf PRD v0.4: black hole legibility

Status: locked 2026-09-29 (morning). Builds on v0.3 (cache gravity-golf-v13). Source: the designer's first playtest of holes 11 to 15. Hole 12 Event Horizon took 40 or more shots and was not beaten; the harness shows why: its route sinks only over 145.8 to 150 px of drag (a 4 px power window) and every softer shot past the wall is swallowed for two strokes. The black hole's pull covers the whole upper chamber, so there is no readable throw zone.

## A. Two rings (physics and art)

A black hole has two radii, both in the level data with defaults in TUNING:

- `r` (default 26): the horizon. Cross it and the ball is swallowed (unchanged: shot plus one, back to the last rest).
- `reach` (default 150): the influence ring. Inside it the pull is the current law (mass `bhMass` with the distance floored at `bhPullR`). Between `reach` and `1.5 × reach` the pull fades smoothly to zero. Beyond that the black hole does nothing, so a ball can rest there and the rest of the hole plays like open space.

Art: the influence ring is drawn as a faint dashed circle (at least 3:1 against the field), with the swirl arms reaching to it; the horizon ring stays as it is. The range finder turns violet while the projected path is inside the influence ring, so the player sees "this shot enters the throw zone" before release.

## B. The last shot's ghost (all holes)

After a shot, a faint dotted trail of its path stays on the field until the next release, on every hole. It shows the last 3 s of flight at most, at low alpha, and never the shot in progress. Retry clears it. It is a learning aid, not a preview: the range finder stays at its 0.4 s.

## C. Power windows (shard rule, harness check, re-authoring)

New rule for every hole from v0.4 on: the three-star route's sinking shot must sink over at least 20 px of drag and 4 degrees of aim at the same time (the boss: 15 px and 3 degrees). The harness `--sweep --drag` already prints the drag range; add a `--windows` check that fails a route below the rule, and add the rule to the README's shard deliverables.

Re-author under A and C:

- Hole 12 Event Horizon: same lesson (bend round the hole, straight line walled, greedy line swallowed), but the route must meet the rule and a rest above the wall must be possible so a two-stroke route is a real fallback rather than a swallow-and-retry.
- Hole 14 Singularity: keep the route if it meets the rule under the new pull (it passes 22 from the horizon at 146 px); otherwise re-author the whip.
- Hole 15 Collapse: the last shot's 7 px power window is under the boss rule; widen it (a wider top lane or a softer bank) while keeping both clocks required.
- Holes 11 and 13 have no black hole and keep their proofs; re-run them anyway.

All fifteen routes re-proven (`--three`, `--sweep`, `--escape`, `--two-shot`, `--windows`), with the real-scene drive of 12, 14 and 15 in Chromium.

## D. Tuning additions

`bhReach` (default 150) and `bhFade` (default 1.5) in TUNING and on the TUNE tab as sliders (reach 100 to 250, fade 1.2 to 2.0); `ghostSeconds` (3) and `ghostAlpha`.

## F. Delighter badges (next build after A to D)

| Badge | Earned by |
| --- | --- |
| Double Bank | sink after exactly two wall bounces |
| Whiplash | sink a shot that entered the influence ring |
| Comet Surfer | get kicked by a comet and still sink that shot |
| Moon Walker | rest on a moon, then sink |
| Hole in None | a full run without a single swallow or sun touch |

## E. Out of scope

New objects, new holes, missions changes, gravity preset defaults (still the designer's pick from GG-1).
