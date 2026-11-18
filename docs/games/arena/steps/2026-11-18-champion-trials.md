# Arena step: champion trials are rematches with less kit (locked 2026-11-18)

**The designer:** "I think you only unlock the trial after winning the arena so you can't practice it. I also think perhaps the champion trials should be different, like beat the champion with no kit or no armor or fists, you know. Just practicing their signature move and owning it doesn't make much sense to me."

## What the player gets

- **The Champions tab holds one card per champion:** the Pit's four (Marcus the Red, Varro of Capua, Flamma the Unbroken, Aurelius the Golden), the City's two (the Twins, Hermes the Swift), the Colosseum's two (Carpophorus and his lion, Mevia the Huntress) and the Grand Games' Aquila.
- **A card opens when you beat that champion in a run** (the designer, 2026-11-18: "Yes, better to beat him to unlock"). Each arena picks its champion from a pool (the Pit from four, the City and the Colosseum from two each, the Grand Games always Aquila), so winning the Pit opens only the one you beat. Until then the card shows his name and portrait dimmed and "Beat him in the Pit to unlock" (the City, the Colosseum, the Grand Games). Nothing in the trial is playable before you have beaten him. The save already lists the champions beaten (`champs`).
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

1. A fresh save: the Champions tab shows nine dimmed cards with the right "Beat him in ... to unlock". A save that has beaten Varro only: Varro's card open, the other eight dimmed (the other three of the Pit too).
2. Each open card starts his fight at each tier with the right kit (no armour; no shield; fists), his signature move and his companion as in a run.
3. Winning records the tier as the medal (the best kept), a first gold gives fame once, Retry restarts the same tier.
4. Old saves (v20, with Capuan and Rage records) load; the two old trials are gone from the grid, nothing else in the save changes.
5. `npm run check arena` and `npm run smoke` pass; `trials.mjs` and `capuan.mjs` are updated (Capuan's read check moves to a fight check or goes with the trial).
6. Sketch approved in shape (`../sketches/champion-trials-tab.png`, `champion-trials-pick.png`); unlock per champion beaten, not per arena. Winning a tier also marks the easier tiers as beaten. For the designer after the build: a still of the tab and of a picker.

One-way or two-way: **one-way** (the save changes): a verifier and an old-save round trip.

## Rewards (the designer, 2026-11-18: "more fame, more ludus stuff, the champion's card, and then a title if you get gold"; draft, not locked)

- **Fame for each tier, the first time:** bronze 10, silver 15, gold 25 (`TUNING.trials.champFame`); this replaces the trials' flat first-gold 5 for champion trials.
- **His card in the ludus:** beating his trial at any tier puts **his card** on sale in a new ludus station, the Hall of Champions, for fame (`TUNING.ludus.price`). Bought, it can be dealt in runs' drafts like any card.
- **A title for gold:** "Bane of Varro" and so on, shown under your name on the menu and carved with you on the Wall of Champions; the newest gold's title is worn.
- **The nine cards (proposals, the designer's to change):**

| Champion | Card | What it does |
| --- | --- | --- |
| Marcus the Red | Red Rage | Below half hearts, your next three blows (high, mid, low) come fast and hit harder |
| Varro of Capua | Capuan Feint | Your feint shows two fakes; a block on either leaves him open |
| Flamma the Unbroken | Unbroken | Once a bout, a blow that would take your last heart leaves you half a heart |
| Aurelius the Golden | Golden | The crowd's favour fills faster and its gold doubles |
| Castor and Pollux | Brothers | After you fell the first of a pair, the second starts winded |
| Hermes the Swift | Blink | A dodge just after his blow dashes in and strikes |
| Carpophorus | Beastmaster | Beasts hesitate before their first blow; your blows on beasts hit harder |
| Mevia the Huntress | Huntress's Throw | Once a bout, throw your spear from range |
| Aquila | The Emperor's Blade | At half health, draw a second gladius |
