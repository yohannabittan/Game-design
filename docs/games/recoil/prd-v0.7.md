# Recoil PRD v0.7: the story of an action career

Status: draft 2026-10-04, waiting for the designer to lock it. Builds on v0.6, sections A to I. Source: the designer: "there's no exposition actually telling the story; we should tell a story more explicitly"; tone "accessible to everyone, including people not alive in the 80s"; career "Extra, Intern, Stunt Double, Action Star".

## A. Tone

- **The 1988 backlot is the look, not the joke.** Neon sets, VHS lines and parody props stay, but no line needs the player to know an 80s film. The humour is universal workplace and movie-set comedy: a shouting director, a weary prop master, an eager newcomer. That is why the career starts as Extra and Intern.
- Every line is short (principle 11): one sentence of at most about 60 characters, and every story card can be skipped with one tap.
- **Names are original:** no real film, actor or studio, the same rule as the guns.

## B. The career: your story's spine

- **One career rank for the player, across all guns:** Extra → Intern → Stunt Double → Action Star.
- It is driven by **total stars across every gun and set**, so a pistol-only player still moves up. Thresholds go in `TUNING.career`: Intern 10, Stunt Double 40, Action Star 100, of 324 possible (6 guns × 54). The harness reports how many runs a good player takes to reach each rank.
- The menu's career line sits under the selected gun's stars: the rank name and "12 stars to Stunt Double".
- **A rank-up card** follows the result card, once per rank, and can be skipped:
  - **Intern:** "The director noticed you. Get coffee, then get on set."
  - **Stunt Double:** "Your agent called: you're doubling the lead."
  - **Action Star:** "Your name is on the poster now."
  - The card shows the director's portrait (section C), and the rank name in large type with a clapperboard snap.
- **The per-gun mastery tiers change names** so that they don't clash with the career: Extra / Stunt Double / Leading Role / Walk of Fame become **Rookie / Trained / Signature / Legendary** ("your signature piece", in the prop master's words). The numbers, unlocks and skins behind them are unchanged.

## C. The cold open (first launch only)

- Three cards over a dark soundstage, each skippable, with "Skip" always visible. It can be replayed from the menu ("Story").
  1. "Backlot 88. A studio that makes action movies."
  2. "You're an extra. Your only line so far was a scream."
  3. "The director needs a new action star. Prove it's you."
- **The director's portrait** sits on cards 2 and 3. He is an original character: a loud, kind-hearted director with a megaphone, a cap and sunglasses pushed up. This needs one art pack from the Artist, two poses: shouting and approving.

## D. Voices on the existing screens

- **The director's note on the result card,** one line picked by stars from a small pool per star count. It is cosmetic, so `Math.random` is fine.
  - 0 stars: "Cut! Again, and this time with feeling."
  - 1: "We can fix it in the edit. Maybe."
  - 2: "Good take. Let's get one more."
  - 3: "Print it! That's the one."
  - The critic quote stays as the newspaper's verdict.
- **The prop master's one-liners** in the Prop Room: one line per gun, shown in a small speech strip when its card is selected. For example: "Pulse Rifle. Three sequels, two lawsuits. Careful." They are written by the builder in this tone, with no real film references, and listed in the changelog for the designer to edit.

## E. Premiere posters (the payoff)

- Three-starring every rung of a set "releases the film": a poster card shows once, then hangs on a **poster wall** reached from the menu, one slot per set (6). Unreleased slots show a "Coming soon" silhouette.
- **Posters are generated art** (Pack 9), one per set, with parody titles that are genre jokes, not references:
  - Accuracy: "Screen Test: The Movie"
  - Speed: "High Noon-ish"
  - Skeet: "Saucers Over Burbank"
  - Boss: "Rubber Suit Rampage"
  - Zombies: "Night of the Extras"
  - Endless: "The Overnight Shoot"
  - The titles are drawn by the game, not baked into the image (the Artist's learnings: generated text misspells).

## F. Saves

`saveVersion` bump with `careerSeen` (the highest career rank whose card has shown), `openSeen` (the cold open shown) and `posters` (released sets). `migrate` gives veterans one card for their current rank, never a cascade, and marks the cold open as seen.

## G. Out of scope

Voice acting, cutscenes beyond still cards, changes to rules, targets, timings or prices, and new guns.

## H. Acceptance

- The text counts per principle 11 on each new card and strip, in the changelog.
- Every story element can be skipped in one tap and never delays input.
- The career math is right for saves at 0, 9, 10, 40 and 100 stars.
- The posters fire once per set.
- A v13 save migrates (or whatever the current version is).
- Fallbacks work while art is missing.
- `npm run smoke` passes, and the frame time is not worse than v0.6.
