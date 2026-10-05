# Gravity Golf PRD v0.10: tighten holes 26, 28 and 29

Status: locked 2026-10-05 from the v25 playtest (`playtests/2026-10-03-v25.md`): "maybe 26 to 28 are a bit easy". Builds on v0.9. A content-only change: no physics, badges, saves or UI.

## A. The holes

- **26 Fulcrum and 28 Triad:** the ace is a find, not the first try. Move the cup or a body so the three-star last shot's aim window drops toward the 4° and 20 px rule, keeping each hole's lesson and its badge spot (Lagrange Point on 26, Great Attractor on 28).
- **29 Drift Gate:** narrow the release window to about 35 to 45 percent of the comet cycle (from 77), so timing the comet is the lesson again. Keep both walls from the fix round.
- 27 and 30 do not change.

## B. Rules

- Every v0.8 B must-pass rule holds.
- **New ceiling (from this playtest, for every future sector after Sector 1):** the noisy-human rate of the last shot is at least 60 and at most about 80 percent for a normal hole.
- Par and three-star counts do not change, so earned stars and Expert stars keep their meaning. If a hole cannot be tightened without changing a count, report it rather than change it.

## C. Acceptance

- Harness output per hole (route, two-star route, sweep, escape, windows, noisy rate) in the changelog, before and after.
- Hole 26 still allows Lagrange Point, hole 28 still allows Great Attractor (checked with the badge code).
- `npm run smoke` passes; `CACHE_VERSION` bumped.
