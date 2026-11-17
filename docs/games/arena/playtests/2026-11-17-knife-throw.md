# Arena playtest note, the knife throw (2026-11-17, the designer)

**Build:** `arena-v82` (live 21:38 UTC).

## The designer's words

- "Yess knife throwing looks amazing, good job."

## What made it work (their calls)

- Angle only: the thumb's height sets the line; sideways does nothing ("it should be an angle challenge, like only the y axis").
- One press on a button on the right; a short range-finder line, no target ring, no snap.
- A plain press lands on bare skin, so a gap needs a slide ("Nearest bare skin").
- The sword leaves the hand while throwing ("We should hide the sword when doing the knife throwing").
- The line shows exactly what the knife will hit (found by the verifier).

## Numbers to move if play says so

`TUNING.knives.gain` [up 1.1, down 0.4] for the slide; `chestK` for where a plain press lands.
