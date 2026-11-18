# Arena step: fame becomes rank, and the ludus a path (locked 2026-11-18)

**The designer:** "Instead of fame to buy things in the ludus we could imagine levelling up and unlocking a standard predefined path, and higher grade bouts give you more exp, to help you level faster."

## What the player gets

Sketch approved (the designer: "Yeah this is pretty exciting"): `../sketches/fame-ranks-runend.png`, `fame-ranks-path.png`.

- **Fame is never spent; it climbs.** Every fame earned counts toward your **rank**. Each rank unlocks the next thing on **one fixed path** that Brutus hands you (no shop, no choosing, no hoarding).
- **The path** is today's ludus items in a set order (the sica, a fighter, a card family, the start card, the tailor's pieces, the vault's scrolls...), with the champion cards (`2026-11-18-champion-trials.md`) slotted in, so there is always a next thing in view.
- **Rank names** from the real gladiators' ladder (looked up, common sense): *tiro* (a recruit), then the *palus* ranks (the fourth up to the first, *primus palus*, the best of a school), then *rudiarius* (freed, given the wooden sword). Each name covers a few ranks.
- **Harder and better bouts give more:** a bout's fame grows with its arena (the Pit, the City, the Colosseum, the Grand Games) and its place in the run (bout 1 to the champion), and its grade (S, A, B) multiplies it. Champion trials and first golds add to it.
- **What you see:** at a run's end, the fame bar fills and, when it crosses a rank, Brutus gives you the unlock ("Rank 7: the Trickster's cards"). The ludus becomes a path you look at: what you have, the next three, what rank each comes at.
- **Your save:** your rank is worked out from all the fame you ever earned (what you hold plus what you spent in the ludus). Everything you bought stays yours. A one-way door: a verifier and an old-save round trip.

## Calls taken (the simplest; the designer can change any)

- **One unlock per rank, 20 ranks** (today's 20 ludus items). Names by band: *Tiro* 1 to 3, *Quartus palus* 4 to 7, *Tertius palus* 8 to 11, *Secundus palus* 12 to 15, *Primus palus* 16 to 19, *Rudiarius* 20.
- **The path's order** (what changes play first, the Tailor's looks as small treats between): 2 the sica, 3 a fourth card, 4 a crest, 5 the Trickster, 6 the trident, 7 a gladiatrix, 8 a plume, 9 the start card, 10 the Showman, 11 a freed slave, 12 shield paint, 13 a promise (the Shrine), 14 a chariot driver, 15 a cloak, 16 to 19 four vault scrolls (Wall, Blood, Dancer, Brute), 20 the Trickster's and the Showman's scrolls. Rank 1 is where every new player starts, with nothing.
- **The pace:** rank 2 after about one good run (a run that reaches the champion), each rank after a little more, so late ranks take three or four good runs; the curve in `TUNING.ranks` (first step and growth), with about 40 good runs to *Rudiarius*.
- **A bout's fame:** a base by arena (`TUNING.fame.bout`, rising from the Pit to the Grand Games), x its grade (S, A, B, none: `TUNING.fame.grade`), the champion bout x `TUNING.fame.champBout`. The champion felled, an arena's first clear, the Emperor's thumb and gold left keep their fame. Champion trials' tiers add fame as `2026-11-18-champion-trials.md` says; champion cards come straight from his trial, not from the path.
- **The run's end** counts the fame in by bout (as the sketch), fills the bar, and if a rank is crossed Brutus hands the unlock; two ranks in one run show both, one after the other.
- **The ludus** becomes the path screen (the sketch): rank and name, the bar, then the path, sideways. Tapping a piece you own that has styles (the Tailor's) still changes its style; the Start card still picks your card.
- **The menu** shows your rank and its name where the fame count is today.
- **Your save** (`saveVersion` 21, `migrate`): lifetime fame = fame held + the prices of everything bought; your rank comes from it; everything bought stays yours, and everything on the path at or below your rank is yours too. `fame` stays as the lifetime count (never spent).

## Acceptance

1. A fresh save is rank 1 with nothing; a run that reaches the champion reaches rank 2 and Brutus hands the sica.
2. An old save (v20) with fame held and items bought gets its rank from all of it, keeps every item, gains the path's items at or below its rank, and loses nothing. A round trip with a real veteran save (`tools/verify.mjs save`).
3. The run's end shows each bout's fame with its grade, the bar, and the unlock (or both, when two ranks are crossed). The ludus shows the path; the menu shows the rank.
4. Every number in `TUNING` (`ranks`, `fame`); nothing in the ludus is bought with fame any more.
5. `npm run check arena` and `npm run smoke` pass; checks that bought ludus items are rewritten for ranks.
6. For the designer: stills of a run's end with a rank-up and of the ludus at 874x402.

One-way or two-way: **one-way** (the save changes): a verifier and an old-save round trip.
