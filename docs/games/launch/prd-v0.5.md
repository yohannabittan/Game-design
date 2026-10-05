# Launch PRD v0.5: Mochi's way home

Status: locked 2026-10-05 from the story plan the designer approved ("Yeah good plan but don't execute until usage refreshes"; `docs/story-plan.md`, Launch). Builds on v0.4 and its A1 round. Cast and canonical lines: `docs/games/launch/world.md`. Drive: love and longing.

## A. The cold open (first launch only)

- Three still cards before the first menu, each one tap to advance, with "Skip" always visible (44 px). Replayable from a "Story" button on the menu.
  1. "Grandma Kiko made Mochi for Daifuku." with `mochi-love` and `daifuku` side by side.
  2. "Then Daifuku was boxed and sent 5 km away." with `daifuku-wave`.
  3. "The Mochi Maker 3000 has one setting: FLING." with `mochi-maker`.
- Cards sit on the bakery's sky colours, large type, one line each.

## B. Mochi is the voice on the result card

- The over scene shows a Mochi portrait beside the distance, about a quarter of the card's height, and one line under it:
  - **a new best:** `mochi-happy`, pool: "Further than ever!", "Daifuku, I'm coming!", "That's my best yet!"
  - **ended in mud or a crash:** `mochi-dizzy`, pool: "Ow. Squishy, but okay.", "Next time, the jelly.", "Which way is up?"
  - **otherwise:** `mochi-determined`, pool: "Again. I'm getting closer.", "One more fling.", "Home is that way."
- The line is cosmetic (`Math.random` is fine). The card's existing contents and buttons do not move or shrink below 44 px.

## C. Arrival lines

- The first time ever a flight crosses into a place, the existing in-flight banner says one line (no card, no pause):
  - Candy Meadow: "Candy Meadow. Daifuku loves these."
  - Chocolate River: "Chocolate River. Don't look down."
  - Soda Springs: "Soda Springs. Fizzy fizzy!"
  - Gingerbread Town: "Gingerbread Town. Almost there."
- Home keeps its existing banner moment and gains section D.

## D. The reunion

- The first flight that reaches Home (the existing `home` save flag) ends on a reunion card before the normal result card: `mochi-love` and `daifuku-wave` together, a few hearts, and "Home! (keep going)". One tap continues to the result card.
- The journey strip's "the two sit together" stays as it is.

## E. Art

- Wire the final Pack 5 art from `docs/art/final/launch/` as webp in `games/launch/assets/` (the layer may add these files and the cache list in `sw.js`). Keep the procedural `drawMochi` and `drawDaifuku`: they stay the in-play sprites and are the fallback for any portrait that fails to load.

## F. Saves

- `saveVersion` 9 adds `openSeen` (the cold open shown) and `placesSeen` (the highest place index whose arrival line has shown).
- `migrate`: a save with any flight marks `openSeen` true and sets `placesSeen` from the best distance, so a veteran sees no cold open and no stale arrival lines. The reunion keys off `home` as now; a veteran who already reached Home is not shown it again.

## G. Out of scope

Physics, prices, goals, new places, sound beyond one soft chime on each story card, and any change to the in-play mochi sprite.

## H. Acceptance

- Text counts per principle 11 on each card and on the result card, in the changelog.
- Every story element skips in one tap and never delays a launch.
- A fresh save sees the cold open once; a v8 save with a 3000 m best migrates with no cold open and `placesSeen` 4 (Gingerbread Town).
- The reunion fires once, on the first Home flight.
- Portraits fail over to the procedural drawings (checked by blocking one asset).
- `npm run smoke` passes; frame time is not worse than launch-v14.
