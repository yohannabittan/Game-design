# PRD v0.2: Ink (delta from v0.1)

| | |
| --- | --- |
| Slug | `ink` |
| Version | 0.2 |
| Date | 2026-09-28 |
| Status | locked as an experiment |
| Answers | playtest 2026-09-28 (v0.1): "fun; the middle is free and the edges are all the skill; try a needle where slow lays more ink and fast lays less" |

Everything in `prd-v0.1.md` stands unless changed here.

## A. Dynamic needle (experiment, toggleable)

The needle's effective ink radius follows the finger's speed:

- At or below `slowSpeed` the radius is `needleR * wideScale`.
- At or above `fastSpeed` the radius is `needleR * thinScale`.
- Between them it interpolates linearly on speed.
- Speed is measured over the last `speedWindow` units of travel, not per frame, so the result is frame-rate independent (ADR-0008).
- The drawn stroke width follows the same radius, so the rule is visible: slow strokes are fat, fast strokes are thin.
- The slip rule is unchanged: a slip is the needle centre leaving the outline. Width affects coverage only.
- Coverage scoring uses the dynamic radius per path sample.

A menu toggle "Needle: classic / dynamic" switches between the v0.1 fixed radius and this rule. The toggle is saved. Best percentages are recorded per mode so the two can be compared. Default is dynamic.

## B. Intended outcomes (what the experiment should show)

- Edges get faster: riding an edge slowly covers the edge cells from further inside, so the intended path can stay `needleR` or more inside the line and still reach 99 percent.
- The middle gets slower: a fast sweep leaves gaps between rows; the intended middle speed is moderate, or rows are closer.
- Overall time to 99 percent for a perfect path changes by less than 20 percent either way, so the timers stay meaningful; if it changes more, the timers are re-derived by the rule in v0.1 section 9.

## C. Harness

`tools/sim-ink.mjs` path points may carry a third element, the finger speed in units per second for the segment ending at that point: `[x, y, speed]`. Missing speed uses `--speed`. The tool reports results for the current needle mode and accepts `--needle classic|dynamic`.

## D. Verification

- [ ] Same finger positions at the same speeds give the same percentage at 30 and 120 event rates.
- [ ] With the dynamic needle, a path riding every edge at `slowSpeed` from `needleR` inside the outline covers the edge band of every stencil (no edge cell left, checked on the circle, star and snake).
- [ ] With the dynamic needle, a bounding-box sweep at `fastSpeed` on the circle reaches less than 85 percent of the area it sweeps, so speed matters.
- [ ] Every stencil still reaches 99 percent clean by an intended path in the dynamic mode, within its timer; the harness output is recorded per stencil.
- [ ] Classic mode gives exactly the v0.1 numbers.

## E. Tuning additions

| Name | Value | Meaning |
| --- | --- | --- |
| needleMode | dynamic | Default mode; the menu toggle overrides and is saved |
| slowSpeed | 120 | Units per second at or below which the needle is widest |
| fastSpeed | 450 | Units per second at or above which the needle is thinnest |
| wideScale | 1.6 | Radius multiplier when slow |
| thinScale | 0.55 | Radius multiplier when fast |
| speedWindow | 24 | Units of travel over which speed is measured |

## F. Decision rule

After the designer plays both modes on the full set: keep dynamic if it is preferred on at least the snake, the key and one early stencil; otherwise revert to classic and record why. The toggle is removed either way in v0.3.
