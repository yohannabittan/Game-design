# Arena step: champion trials are rematches with less kit (draft, 2026-11-18)

**The designer:** "I think you only unlock the trial after winning the arena so you can't practice it. I also think perhaps the champion trials should be different, like beat the champion with no kit or no armor or fists, you know. Just practicing their signature move and owning it doesn't make much sense to me."

## What the player gets

- **The Champions tab holds one card per champion:** the Pit's four (Marcus the Red, Varro of Capua, Flamma the Unbroken, Aurelius the Golden), the City's two (the Twins, Hermes the Swift), the Colosseum's two (Carpophorus and his lion, Mevia the Huntress) and the Grand Games' Aquila.
- **A card opens when you win its arena** (you beat that arena's champion in a run). Until then it shows his name dimmed and "Win the Pit to unlock" (the City, the Colosseum, the Grand Games). Nothing in the trial is playable before you have won his arena, so a champion's moves are never practised before they're beaten.
- **The trial is a rematch:** his full fight, as in his arena's fifth bout (his health, armour, signature move, and his lion or his twin), against the trials' stock fighter at full hearts, with **less kit**.
- **The medal is the kit you beat him with.** The card shows three tiers; you pick one and fight:
  - **bronze:** your weapon and shield, no armour;
  - **silver:** your weapon alone, no shield, no armour;
  - **gold:** fists only.
  The best tier won is the card's medal. A first gold gives fame once, as other trials.
- **The Capuan Feint and Weather the Rage go.** Their signature moves stay in the champions' fights.

## Calls taken (simplest; the designer can change any)

- **One stock weapon per champion trial: the gladius** (the trials' stock fighter's, like Iron Wall). The fists tier uses `TUNING.trials.fist`.
- **Medals and bests already won** in The Capuan Feint and Weather the Rage are dropped from the save (the fame they gave stays). This changes the save's shape: `saveVersion` 21 and `migrate` (ADR-0005).
- **Score:** win or lose; the end card shows the tier and hearts left. The export line names the champion and the tier.

## Acceptance

1. A fresh save: the Champions tab shows nine dimmed cards with the right "Win ... to unlock". A save that has won the Pit: the Pit's four open, the rest dimmed.
2. Each open card starts his fight at each tier with the right kit (no armour; no shield; fists), his signature move and his companion as in a run.
3. Winning records the tier as the medal (the best kept), a first gold gives fame once, Retry restarts the same tier.
4. Old saves (v20, with Capuan and Rage records) load; the two old trials are gone from the grid, nothing else in the save changes.
5. `npm run check arena` and `npm run smoke` pass; `trials.mjs` and `capuan.mjs` are updated (Capuan's read check moves to a fight check or goes with the trial).
6. For the designer: a still of the Champions tab (locked and open cards) and of a tier picker, before the build.

One-way or two-way: **one-way** (the save changes): a verifier and an old-save round trip.
