# Gravity Golf PRD v0.16: read the gravity

Status: locked 2026-10-19 by the designer ("Go for it"). It builds on v0.15.

**What the designer said:** "GG is still too easy." The export (2026-10-19) shows holes 41 to 44 taken in about a minute in all, with Corridor and Sliding Door three-starred at the first attempt; only the Minotaur fought back.

**Why:**
- The aim line shows 0.4 s of the flight, curve included, so the shot is lined up rather than read.
- The Labyrinth's three-star shots have wide windows: Corridor's last shot works across 36°.
- Few holes punish a near miss.

## A. A shorter aim line (one build, Sonnet)

- **Holes 1 to 3** keep the full 2 s preview, as now.
- **From hole 4 on,** the preview is `T.previewShortSeconds` 0.2 s (was 0.4).
- **The last two holes of every sector** (the 4th and 5th of each five) show no preview at all. They draw the blind try's straight pointer: its direction, and its length for the power.
  - The range finder's violet black-hole warning stays.
  - The blind fourth star on those holes is unchanged.
  - On the card, those holes are marked "Read it" (a small eye-off icon on the menu tile).
- **Physics is untouched,** and sim-golf is unaffected.

## B. Tighter Labyrinth holes (two content shards, Sonnet)

Holes 41 to 45 are re-tuned with the lean method, not re-authored: the same idea and walls, with the cup, a body or a wall moved.

- **Every shot of the three-star route** has a window of at most about 5° of aim and 30 px of drag (`--windows` on each shot, not just the last). The boss is at most about 3° and 20 px.
- **A hazard near the route on every hole** (a sun, a black hole or a magnetar), so a near miss costs strokes. Hole 41 stays the gentlest, as the tutorial.
- **The three-star counts stay:** 2, 2, 2, 2, 3.
- **The lean checks** as v0.15 D, plus `--windows` on every shot.

## C. The authoring rule from now on

New holes follow B's window and hazard rule.

## D. Out of scope

- holes 1 to 40's layouts;
- star counts;
- saves (no change).

## E. Acceptance

- The preview follows A on every hole, and the menu tiles mark the "Read it" holes.
- Holes 41 to 45 meet B's windows on every three-star shot, with a hazard by the route.
- `npm run smoke` passes.
- Difficulty and feel are judged by the designer's playtest.

**Rough cost:** about $12 to $15, and about 1½ hours. The build and the two shards run in parallel, since the preview is drawing only.
