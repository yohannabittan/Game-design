# Recoil PRD v0.8: fair for every gun

Status: locked 2026-10-07 ("Go with the recoil plan"). Builds on v0.7.

Source: the designer's playtest export (2026-10-07, 101 entries) and note: "I just had a good time playing Recoil, it's a bit too hard in certain ways, you'll see." This is a balance pass. It adds no new content.

## What the export shows

| Problem | Where | What happened |
| --- | --- | --- |
| Ammo caps punish automatic guns | SMG on Accuracy 1 | 6 hits from 12 shots, 0 stars, out of ammo in 7 s, right after buying the gun for 1,500. The rung's 12-round cap is one squeeze of an SMG (14 rounds a second). |
| The shotgun's bars are off where its slow reload decides the time | Zombies 1, three runs | 100% accuracy, every zombie down, 1 star each time; the pistol 3-starred the same rung. |
| | Speed 1 and 2 | 1 or 2 stars at 100% accuracy. |
| Accuracy 4 and 5 read as failure when played right | | The dodger's bait shot counts as a miss, so a correct run reads 38 to 57 percent (pistol, shotgun), against 79 to 92 percent on Accuracy 3. |
| Some pairs are nearly unplayable | shotgun on Accuracy 5 (small, far targets) | 32 percent, then 5 percent. |
| | carbine on Skeet 2 | 38 to 50 percent, 0 or 1 stars. |

## A. Ammo scales with the gun

- An ammo-capped rung (`accAmmo`) gives each gun its cap times a per-gun multiplier in `TUNING`:
  - pistol: 1.0;
  - carbine: 1.0;
  - shotgun: 1.0;
  - rifle: 1.0;
  - SMG: about 2.5. Size it so that a careful SMG run, in short bursts, has the same slack over the targets as the pistol has.
- The HUD shows the scaled count.
- The multiplier is chosen by the bots (B), not by hand.

## B. Every gun gets bars it can earn

- Regenerate `BARS` for every rung and gun pair whose 100-percent-accuracy bot run earns fewer than 2 stars, with the existing bot and noise process (the v18 to v20 regenerations in the changelog). The rule:
  - a clean run (every target hit, sensible pace, the gun's own reload policy) earns at least 2 stars;
  - a strong run earns 3.
- Report every pair that moved in the changelog, old against new.
- **Recheck these pairs by name:**
  - shotgun on Zombies 1 and on Speed 1 and 2;
  - SMG on every accuracy rung;
  - shotgun on Accuracy 5;
  - carbine on Skeet 2.

## C. Bait shots are not misses

- On dodger rungs (Accuracy 4 and 5), a shot that makes a dodger jump is a **bait**, not a miss:
  - it shows a small "bait" tag at the shot;
  - it does not lower accuracy;
  - it does not break the combo.
- A shot that hits nothing and moves nothing is still a miss.
- The rung intro gets one line: "Shoot near a ringed target to make it jump, then hit it where it lands." The dashed ring pulses on the first dodger.

## D. Tough pairings say so

- If, after B, a rung and gun pair still needs much more skill than the pistol (its 2-star bar above about 90 percent of its perfect run), the rung tile shows a small "tough with this gun" note in the Prop Room's tone.
- This is information only. It does not block the rung.

## D2. A simpler result card (designer, 2026-10-07: "We need to simplify the end screen in Recoil after a challenge")

The v0.7 card carries about eleven text items: "That's a wrap!", rung and gun, score, stars, the critic's quote, hits and bullseyes, "New best · 3 stars saved", the star thresholds line, "Box office +$0", the director's note and three buttons. It becomes six, in this order:
1. **The rung name**, small, at the top: "Accuracy 1". The gun shows as its picture beside the score, not as text.
2. **The score**, large. When it is a new best, a "New best!" tag sits beside it.
3. **The stars**, with one thin bar under them that shows the way to the next star: "200 to ★★★", or "All stars!" at three. This replaces the thresholds line and "3 stars saved".
4. **Big Lou's portrait and his one line.** This replaces the critic's quote; the newspaper verdict goes.
5. **One small stat line:** "8 of 8 hits · 4 bullseyes". Each rung shows the stat that matters for it, for example "Wave 5 · 22 down" for zombies. Box office appears in this line only when it is above zero ("+$120").
6. **The buttons.** "Next" is the large primary button when the run earned at least one star; otherwise "Again" is. Menu stays small.

Rank-up, poster and badge cards still follow the result card as before. Text counts per principle 11 go in the changelog.

## E. Out of scope

New rungs, guns, prices or story.

## F. Saves

- No shape change.
- Earned stars never go down.
- A run that would now earn more stars, by the new bars, upgrades the shown stars at load, since `starsOf` already takes the higher of saved and recomputed.

## G. Acceptance

- The changelog has a bars table (old against new) and the SMG multiplier, with its bot evidence.
- A 100-percent bot run earns at least 2 stars on every rung and gun pair, as a printed check.
- On Accuracy 4 and 5, a correct run reads at least 75 percent accuracy.
- `npm run smoke` passes; play frame time is unchanged.
