# Arena: building Trials in two builds (2026-11-17)

**The designer:** "I think we should make the trials." This builds Steps 27 and 27b in `../prd-v0.3.md` (13 trials, tabs Range, Blades, Fists, Champions), to the approved sketches `../sketches/trials-grid.png` and `trials-end.png`.

## Calls taken (the designer can still change any)

- **The range sketch's numbers** (`../sketches/range.html`: the shrink, three misses, the sway, the wheel's speed) are taken as they are. The designer's play judges them once built.
- **Art Pack 30 picks:** the artist's proposals, `range-target` B, `knife-wheel` C, `fruit-seller` A (`docs/art/HANDOFF-arena-pack30.md`).
- **Knives in trials** use the new throw (`2026-11-17-knife-throw.md`: angle, one press). So the knife trials wait for that build.

## T1: the Trials screen and eight non-range trials

- The **Trials** button on the menu; the grid with its four tabs, each card with name, one-line goal, medal and best; the end card with medal, best and one-tap retry.
- The trial runner: fixed loadout, seeded set-up, no purse, no cards, no run at stake; medals at thresholds in `TUNING.trials.<id>`; a first gold gives fame once (`TUNING.trials.fame`); each attempt logged to the export (id, score, time, medal); bests and medals in the save (`saveVersion` and `migrate`, ADR-0005).
- Trials: **Iron Wall, The Capuan Feint, Gap Hunter, Breaker, Weather the Rage** (Step 27) and **Bare Knuckles, Stagger Him, Brawl** (Step 27b).
- The Range tab shows its cards as "soon" until T2.
- Acceptance: Step 27's and 27b's for these eight; frames of the grid (each tab) and each trial's first moments at 667x375 and 844x390; old saves load; the verifier tries to break the save and the menu.

## T2: the range (after the knife throw lands)

- **Shrinking Target: knives** and **: bow** at three ranges, **Knife Work**, **The Apple Shot**, **The Knife Board**, **The Wheel**, wired to Pack 30's art (`docs/art/final/arena/`).
- Acceptance: Step 27b's; a GIF of the Wheel.
