# Recoil PRD v0.10: lively zombies, honest range finders, a simple .44

Status: locked 2026-10-07 from the designer's notes after v0.8:
- "the zombie mode has one type of zombie whose head can't be hit, which forces breaking the combo; it might make it more fun to have a random variable of size of the zombies and maybe randomly occurring features to make them look a bit different, and maybe a variable on speed as well";
- "the handgun should have a less long range finder; the sniper should be the only one with a full-length range finder";
- "the challenge to unlock the Make My Day gun is a bit too complex right now; it should be more simple, like a number of stars or unlocking every level".

It builds on v0.9 and is built after v0.9 lands.

## A. The Hunched zombie can be headshot

- The Hunched zombie's body shields its brain, so today every Hunched forces a body shot and breaks the combo.
- Now it **rears up** on a steady rhythm: about every 2 s it straightens for about 0.7 s, and its brain is exposed. The rhythm is set in `TUNING`, and each zombie gets its own phase, seeded at setup.
- A short groan and a shoulder lift give a tell about 0.3 s before it rears.
- A brain hit while it is up is a normal headshot. Body hits still work as before.

## B. Every zombie a little different (seeded at setup, never in play)

- **Size:** each zombie's scale varies within about ±15 percent of its type's size. Its brain, body and legs scale with it, so a small zombie is a smaller target, and the Brute stays the tallest.
- **Speed:** each zombie's speed varies within about ±12 percent of its type's speed. The Runner stays the fastest.
- **Costumes:** zombies are extras in make-up from the other sets. Each one draws a random costume and a feature:
  - costumes: a cowboy hat, a hard hat, a chef's toque, a nurse's cap, an office tie, a surfer's flower shirt, a bandana, a hair-curler set, a single roller skate;
  - features: an eyepatch, a torn sleeve, one shoe missing.
  
  They are cosmetic only, never hiding the brain, and drawn from the seeded wave RNG.
- The variation ranges are in `TUNING`, with a TUNE slider for each of size and speed.

## C. Honest range finders

- The range finder's length becomes its own per-gun value (`finder` in each gun's `TUNING`), separate from `accuracy`.
- Only the Assassin's Scope reaches the full field. The suggested lengths, as shares of the field:

  | Gun | Finder length |
  | --- | --- |
  | Assassin's Scope | 1.0 |
  | Make-My-Day .44 | 0.6 |
  | Buddy-Cop 9mm | 0.5 |
  | Pulse Rifle | 0.45 |
  | One-Man Army SMG | 0.4 |
  | Spin-Lever shotgun | 0.35, ending in its fan |

- The far end still fades out, as now.

## D. The .44 unlocks with stars

- The Make-My-Day .44 opens at **40 total stars**, which is the Stunt Double step of the career. It no longer needs the Blockbuster badge.
- On the Stunt Double card, Big Lou adds a line: "And take the .44. You've earned it." This happens once, alongside the v0.9 turn.
- A save that already owns the .44 keeps it. A save at 40 stars or more without it gets it at load, with one toast: "The .44 is yours."
- The Prop Room shows "Opens at 40 stars (12 to go)" on the locked card.

## E. Re-check the bars

- B changes target sizes and speeds, and C removes some aiming help. Re-run the v0.8 B2 human-pace calibration:
  - on every zombie rung, for every gun;
  - on every rung for the pistol, carbine, SMG, shotgun and .44, because of the shorter finder.
- Lower a 2-star bar where the human median now sits under it. Leave the 3-star bars as they are.
- The B2 table from the designer's export must still hold.

## F. Saves

No shape change is needed beyond any v0.9 has made. The .44's grant at load is idempotent.

## G. Out of scope

New zombie types, new rungs, prices, and the story (v0.9).

## H. Acceptance

- A Hunched zombie can be headshot while it is up, in a scripted run.
- Over 3 seeds, the zombie sizes, speeds and costumes differ, while the waves stay identical in order and type.
- Each gun's finder is drawn at its length, and only the rifle's reaches the edge.
- The .44 unlocks at 40 stars, including for migrated saves.
- The changelog has the re-checked bars, with the B2 table and any bars that moved.
- `npm run smoke` passes. The play frame time is not slower than v0.9 on Zombies 3.
