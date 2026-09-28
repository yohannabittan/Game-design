# PRD v0.1: Ink

| | |
| --- | --- |
| Slug | `ink` |
| Version | 0.1 |
| Pattern | P2 Trace and fill (fill form) |
| Date | 2026-09-28 |
| Status | locked for layer 1, from the designer's synthesis session |

This document is the one-shot contract. A builder session gets this, the skeleton, and the layer prompt. If something is not in here, the builder should not invent it. Describe behaviour, not implementation.

## 1. Pitch

Hold the tattoo gun and fill the stencil before the timer runs out. The needle sits ahead of your finger so you can see every drop land. Cross the line three times and the piece is ruined. Fill percentage is the score, and the last few percent are the hardest thing in the game.

## 2. The first ten seconds

The play scene opens on stencil 1, a circle, drawn as a light blue outline on a dark skin-toned field, with a timer and "0%" in the HUD. The player touches anywhere. A small tattoo machine appears: its grip at the finger, its needle a fixed distance straight up from the finger. As the finger moves, black ink fills where the needle passes, inside the stencil only. The percentage climbs. Near the edge the needle crosses the line: a red mark on the skin, a short buzz, "1/3" in the HUD. The player keeps filling. The timer ends. The card shows the percentage, the stars it earned, and Next.

## 3. Core loop and session shape

- Loop: touch down, the needle appears ahead of the finger; hold and move to lay ink inside the stencil; lift and re-place freely; the percentage rises; slips accumulate; the stencil ends at 100 percent, at the timer, or at the third slip. Card. Next stencil.
- A stencil lasts 20 to 45 seconds. The set of 10 is about 5 minutes.
- Closing the app mid-stencil: the stencil restarts on reopen. Highest unlocked, best percentage and stars per stencil persist.

## 4. Controls

Portrait. One thumb.

| Gesture | Where | Does |
| --- | --- | --- |
| Touch down | anywhere | The needle appears `needleOffset` screen pixels straight above the finger. No ink yet unless the needle is inside the stencil. |
| Hold and move | | The needle follows the finger one to one, keeping the offset. Ink is laid where the needle passes while inside the stencil. |
| Lift | | Stops inking. Free. No slip is ever counted on a lift or a touch down. |
| Tap a button | menu, card | Navigation only. |

Keyboard fallback for desktop testing: mouse works as a finger; no keys needed.

Occlusion rule: the needle is always `needleOffset` pixels above the finger, so the ink lands where the player can see it. The thumb is never over the ink. The offset is constant and never changes with speed.

Entering is generous: touching down with the needle outside the stencil counts nothing; the needle simply starts inking when it enters. Slips are counted only on leaving the stencil.

## 5. Skill model

- **Skill axis:** precision near edges under time pressure.
- **Intermediate tips (1 to 3):**
  1. Fill the middle fast, then do the edges slow.
  2. Work along the edge, never across it.
  3. Lift at corners; dragging through a sharp corner is a slip.
- **Expert tips (3 to 5):**
  4. Ride the line: keep the needle a needle's width inside the outline at constant speed; that is where the last 5 percent lives.
  5. Do the edges first while your hand is fresh, then flood the middle with the time left.
  6. Plan a path with no re-crossing, so the timer is spent laying new ink.
- **Legendary:** 99 percent clean at speed on the boss stencils.
- **Naked run:** no equipment in v0.1. Every stencil reaches 99 percent within its timer by the intended path in its data comment.
- **Outsized reward for skill:** stars by percentage, 70/80/90/95/99. Five stars needs near-perfect edge work; three stars needs only the middle. A zero-slip finish is "clean": the card says so and the piece shows no red marks.

## 6. Randomness policy

- Random in setup: nothing. Ten stencils are authored.
- Deterministic in resolution: ink is laid by sampling the needle's path at a fixed spacing along its movement, not per frame, so the same finger path gives the same coverage at any frame rate. Slip detection is a geometric test on the same samples.
- Seed: none in v0.1. Freestyle stencils composed from primitives with a seed are a later mode.

## 7. Goal, fail, score

- Coverage: the stencil is rasterised once into a grid of cells of `cellSize` units; cells whose centre is inside the stencil count. A cell is inked when the needle centre passes within `needleR` of the cell centre while the needle is inside the stencil. Percentage is inked cells over inside cells, rounded down to a whole number.
- Slip: the needle centre leaves the stencil by more than `slipTolerance` units. One slip per exit; the needle must re-enter before another can count. A slip leaves a permanent red mark at the exit point for that attempt. While outside, no ink is laid.
- A stencil ends at 100 percent, when the timer reaches zero, or at the third slip.
- Stars from the final percentage: 70 gives 1, 80 gives 2, 90 gives 3, 95 gives 4, 99 gives 5. Below 70 at the timer is a fail with 0 stars. The third slip is a fail with 0 stars regardless of percentage.
- The card shows: percentage, stars with a pop, "Clean" if zero slips on a pass (never on a fail), best percentage on this stencil, then the buttons: Next on a pass (Menu instead on stencil 10), Again on a fail, and a secondary Menu button always. Nothing else.
- The timer starts on the first touch down and runs through lifts. Best percentage updates on a timer end or a 100 percent finish, never on a third-slip fail.

## 8. Progression in v0.1

Minimal: highest unlocked stencil (one star unlocks the next), best percentage and stars per stencil, total stars on the menu, a stencil select grid of 10 tiles showing locked, stars and clean.

Deferred so it is not accidentally built:

- Tattoo machines as unlocks: skins first (identity only), then properties that change how you play (a wider needle that fills faster but slips easier, a steadier tip with a larger slip tolerance, more ink or time). Never raw score bonuses.
- Ink colours, skin tones, shape packs
- The gallery of finished pieces (the collection layer)
- Freestyle seeded stencils, timed gauntlet, zen, daily stencil
- Badges

## 9. Content plan

- Count for v0.1: 10 stencils.
- Authored as: an array of stencil objects in `game.js`. Each has a name, a timer in seconds, and an outline as one or more closed polygons in the 360 by 640 design space (a later polygon inside another is a hole in the shape, even-odd rule). Curves are polygons with enough points to look smooth at phone size. A comment on each states its teaching goal or tip and the intended path in one line. Coordinates are scaled uniformly to the screen and centred.
- Stencils 1 to 3 teach, in order: (1) circle: hold and move, fill the middle, the edge is round and forgiving; (2) square: corners, lift and place; (3) heart: a concave notch, work along the edge.
- Stencils 4 to 10: (4) star, five sharp points, needs tip 3; (5) boss: crescent moon, thin everywhere, needs tip 4; (6) lightning bolt, zigzag edges, needs tips 2 and 3; (7) ring, a shape with a hole, two edges to ride, needs tip 4; (8) four-leaf clover, many curved lobes, needs tip 6; (9) key, thin shaft with teeth, needs tips 4 and 5; (10) boss: snake, a long winding band with a head, needs everything and the timer is tight.
- Timer per stencil is set from its area and edge length so that the intended path reaches 99 percent with about 15 percent of the time to spare on stencils 1 to 4, 10 percent on 5 to 9, and 5 percent on 10.
- Boss beat: stencils 5 and 10 are named as boss stencils on the card and the select grid.

## 10. Juice list

Minimum feel. Each event gets a distinct response.

| Event | Visual | Sound | Haptic |
| --- | --- | --- | --- |
| Touch down | The tattoo machine appears with a small settle | `tap` | none |
| Inking | Ink lays as a soft-edged stroke; the needle tip glints | none in v0.1 (a buzz loop is layer 3) | none |
| Slip | Red mark at the exit point, the stencil outline flashes red once, slip counter ticks | `miss` | 30 ms |
| 100 percent | The piece flashes bright once, outline fades, card slides up | `win` | 30 ms |
| Timer end | Outline fades, card slides up | `win` if 1 star or more, `lose` otherwise | none |
| Third slip | Ink smears grey, card slides up with Again | `lose` | 50 ms |
| Star pop | Each star scales in with `outBack`, staggered | `coin` per star | none |

## 11. Art direction

Shapes only in v0.1. The field is a dark warm skin tone. The stencil outline is light blue, like a real transfer stencil. Ink is near-black with a slight blue sheen. Slips are red. The tattoo machine is a small dark shape from the finger point to the needle tip, drawn so the tip is obvious. Three semantic colours: stencil blue (the goal), ink black (progress), slip red (danger). The percentage and timer are the largest HUD elements.

## 12. Audio

Engine named sounds only: `tap` on touch down, `miss` on slip, `win` on a finish with stars, `lose` on a fail, `coin` on stars. No music in v0.1.

## 13. Modes

v0.1 ships the career of 10 stencils. Planned later: timed gauntlet, zen (no timer, no slips), freestyle seeded stencils, daily stencil.

## 14. Scope fence

Explicitly not in v0.1:

- Needle sizes, ink colours, skin tones, packs
- Gallery, badges, currency
- Any mode beyond the career
- A needle buzz loop, music, sprites, custom fonts
- Undo, hints, outline highlighting of unfilled areas
- Landscape support

## 15. Acceptance criteria

- [ ] Loads from the home-screen icon in airplane mode
- [ ] First-time player understands the verb within ten seconds without reading anything
- [ ] From the card to inking the next stencil in one tap, under one second
- [ ] All 10 stencils reach 99 percent within their timer by the intended path, verified in a harness with a scripted path
- [ ] The same sequence of pointer positions gives the same percentage and slip count however it is split into events (30 or 120 per second); a curve sampled at different rates is a different polyline and may differ by a percent
- [ ] A slip is counted once per exit, never on touch down or lift
- [ ] The needle and the ink are never under the finger
- [ ] Ink and slip are distinguishable with sound off, and with eyes closed
- [ ] No text smaller than 14 px; select tiles and buttons at least 44 px
- [ ] Steady frame rate on a mid-range phone on stencil 10
- [ ] `npm run smoke` passes

## 16. Tuning table

Design-space units unless stated.

| Name | Value | Meaning |
| --- | --- | --- |
| designW | 360 | Design space width |
| designH | 640 | Design space height |
| needleOffset | 56 | Screen pixels from the finger to the needle tip, straight up |
| needleR | 7 | Needle radius; ink is laid within this of the needle centre |
| cellSize | 3 | Coverage grid cell size |
| sampleSpacing | 2 | Distance between path samples along the needle's movement |
| slipTolerance | 2 | The needle centre may be this far outside the outline before a slip counts |
| maxSlips | 3 | Third slip ruins the piece |
| starPercents | 70, 80, 90, 95, 99 | Percentage thresholds for 1 to 5 stars |
| passPercent | 70 | Below this at the timer is a fail |
| timerSpareEarly | 0.15 | Fraction of the timer left after the intended path on stencils 1 to 4 |
| timerSpareMid | 0.10 | Same for stencils 5 to 9 |
| timerSpareBoss | 0.05 | Same for stencil 10 |
| inkStrokeWidth | 14 | Drawn ink stroke width, twice the needle radius |
| outlineWidth | 2 | Stencil outline width |
| particleCap | 200 | Max live particles |

## 17. Open questions

- Should the ink be drawn from the coverage grid (honest, blocky at 3 units) or as smooth strokes along the sampled path with the grid only for scoring? Recommendation: smooth strokes for the look, grid for the score; the builder should confirm the two never visibly disagree at the edge.
- Should stencil 1's timer be generous enough that 99 percent is easy, so the first card shows five stars? Recommendation: yes, the first stencil is the tutorial and its job is to show the full star row once.
