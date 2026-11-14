# Arena playtest, two spears (2026-11-14, the designer)

**Build:** the dev channel on 2026-11-14 at 18:18 UTC (`arena-v69`). Phone, 874x402.

## The designer's words

- "I felt I didn't understand the advantage of double weapon. At first I thought it meant switch to a secondary. I didn't see the point of double, it's just harder blocking. I think it should be at least both weapons are forward and attack together."
- "The range of the spear felt weirdly short."

## The run

One new run: **Rome, lost in the second bout** to a young lion.
- Tullia, a lean Alexandrian (stats 1/5/2, tier C), with **two spears** and a chest plate (`buy=spearx2,chest`, 0 gold left).
- 33 lunges, 38 slashes, 6 jabs, 2 overheads; 16 gap hits; 8 blocks, 5 perfect; 10 hits taken; 1 felled.
- `outReach=1`, `chases=10` (the lion closed on her ten times).
- Picks: myfeint, bloodlust, mindreader.

## What two weapons does today (`TUNING.dual`)

- No shield. A block with crossed weapons lets half a blow through, costs more stamina, and drains faster while held.
- A perfect block ripostes with the off hand.
- A slash that lands is followed 0.14 s later by the off hand for half damage.
- The off hand hangs at the hip, pointing down, the rest of the time.
- The purse sells a second copy of any weapon. `RULES.md` says only gladius and dagger: that line is wrong (the limit applies to foes).

## Read

- **The designer is right about two weapons.** The cost (worse blocking) is plain; the gain (a half-damage flick after a landed slash) is almost invisible, and a spear is mostly jabbed, which gets no follow-up at all. Nothing on the purse says what the second weapon is for, so it read as a spare.
- **Spear reach:** not yet known whether it is short or only feels short. A lean body shortens reach, and foes may simply stand further off. A helper is measuring it (`docs/games/arena/steps/2026-11-14-spear-reach-finding.md`).

## Next

- Sketches of two-weapon options go to the designer before any build (`docs/games/arena/sketches/dual-*.gif`): both together (the designer's idea), left-right in turn, and today's for comparison.
