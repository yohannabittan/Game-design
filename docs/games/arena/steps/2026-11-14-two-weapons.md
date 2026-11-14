# Arena step: two weapons strike left, right (locked 2026-11-14)

**The designer** (two-spears playtest): "I didn't understand the advantage of double weapon. At first I thought it meant switch to a secondary. I didn't see the point of double, it's just harder blocking. I think it should be at least both weapons are forward and attack together." Shown three sketches (`../sketches/dual.html`, `dual-a.gif`, `dual-b.gif`, `dual-today.gif`), they picked **B: "Left right feels more natural."**

## What the player gets

With two of a weapon (bought in the Arms slot), you fight with both:
- **Both weapons are held forward**, one in each hand, ready. You can see you have two.
- **Your blows go hand to hand:** right, left, right, left. The gesture is the same as today (slash, jab, overhead); which hand strikes is automatic, in turn.
- **That is faster:** the free hand is already up, so the next blow can start before the last hand has finished coming back. Two alternating blows take clearly less time than two blows with one weapon. This is the advantage you pay for with no shield and one more gap.
- **Each blow is a whole blow** by the weapon in that hand: the same damage, the same jab, slash and overhead rules, plate and gaps, and for spears and tridents the same reach and sliding grip as the main hand.
- After a pause, the next blow starts again with your main (right) hand.
- **Blocking is unchanged:** crossed blades, as today.

## Acceptance

1. With two of each weapon (gladius, dagger, spear, axe or mace, sica, trident), both are drawn held forward at guard and both visible, at 874x402 and 667x375, for a runt, a medium and a giant.
2. Consecutive blows alternate main, off, main, off. After `dual.reset` s with no blow (about 0.8), the next one is the main hand's.
3. An off-hand blow is classed, judged and damaged exactly as the same gesture with that weapon in the main hand (jab, slash, overhead; gap, plate, skin; the spear's slide).
4. Two alternating blows, gesture to gesture as fast as allowed, finish in at most about 0.7 x the time of the same two blows with one weapon (the overlap is one number in `TUNING.dual`).
5. The old off-hand flick (the second hit that followed a landed slash at `dual.after` for `dual.part` damage) is gone.
6. Crossed-blade blocks, their stamina cost and breaking are unchanged.
7. Foes with two blades behave as today. Single-weapon play is unchanged: the replay hashes do not move unless a replay holds a two-weapon player; any that moves is named, with why.
8. Old saves load: no change to the save shape is expected. If one is needed, `saveVersion` and `migrate` (ADR-0005).
9. `npm run check arena` and `npm run smoke` pass, with a permanent check of 2 to 5.
10. For the designer: a GIF of right, left, right, left with two spears and one with two gladii, on a real foe.

## Open, simplest option taken

- Foes with two blades keep today's behaviour; making them alternate is a later step if the designer wants it.
- No new button or tutorial line: the yard's two-weapon text, if any, says "blows go hand to hand" in one line.
- RULES.md's Two blades paragraph is rewritten to match.
