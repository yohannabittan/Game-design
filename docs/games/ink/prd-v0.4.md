# PRD v0.4: Ink (delta from v0.3)

| | |
| --- | --- |
| Slug | `ink` |
| Version | 0.4 |
| Date | 2026-09-29 |
| Status | locked |
| Answers | playtest 2026-09-29: Flowy chosen; "above 95 percent it gets hard to find what you need to fill in at the edges; highlight what is missing if it is more than about 10 percent of what is left" |

## A. Needle experiments closed

Flowy is the needle: growRate 14, shrinkRate 30, floorScale 0.8, with the v0.2 playtested speed and width values. The presets and the needle sliders are removed from the tune panel. The classic/dynamic toggle is removed; dynamic with inertia is the game. Bests recorded under the dynamic mode are kept as the bests; classic bests are dropped by the migration.

## B. Gap hint

Once the fill percentage reaches `hintPercent`, the unfilled cells inside the stencil are grouped into connected clusters (4-neighbour adjacency on the coverage grid). Every cluster holding at least `hintShare` of the remaining unfilled cells is highlighted: a soft pulsing glow in stencil blue drawn over the cluster's cells, alpha breathing between `hintAlphaMin` and `hintAlphaMax` on `hintPeriod`. Clusters below the share are not shown. The hint updates every `hintEvery` seconds, not every frame, and disappears from a cluster as it is inked. The hint never changes scoring, slips or the timer.

- Default `hintPercent` 95, `hintShare` 0.10.
- The hint is visible over ink-free skin and readable against the outline; it must not obscure the outline itself.

## C. Tune panel

Presets: "Late" (hintPercent 97, hintShare 0.15), "Standard" (95, 0.10), "Early" (90, 0.05), "Off" (101, 1). Sliders: hintPercent (85 to 100, step 1), hintShare (0.02 to 0.5, step 0.01).

## D. Verification

- [ ] At 95 percent on the star with two remaining slivers of 60 and 6 cells (out of 66 left), only the 60-cell sliver is highlighted at the defaults.
- [ ] Clustering cost: on the snake at 96 percent the hint update takes under 2 ms on a mid-range phone estimate (measure in headless Chromium at 4x CPU throttle); it runs at most every `hintEvery` seconds.
- [ ] The hint draws over skin, under the outline, and vanishes from a cluster once inked.
- [ ] Simulator numbers unchanged for every stencil (the hint is cosmetic).
- [ ] Migration: a v0.3 save keeps dynamic bests and stars and unlocks; classic bests are dropped.

## E. Tuning additions

| Name | Value | Meaning |
| --- | --- | --- |
| hintPercent | 95 | Fill percentage at which the gap hint turns on |
| hintShare | 0.10 | A cluster is shown when it holds at least this share of the remaining unfilled cells |
| hintEvery | 0.25 | Seconds between hint recomputations |
| hintAlphaMin | 0.15 | Pulse floor |
| hintAlphaMax | 0.45 | Pulse peak |
| hintPeriod | 1.2 | Pulse period in seconds |
