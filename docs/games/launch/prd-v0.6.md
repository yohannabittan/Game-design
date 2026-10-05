# Launch PRD v0.6: Mochi's love letter

Status: locked 2026-10-05 by the designer ("this is way better and sweeter"; the cold open's third beat amended the same day). Builds on v0.5 and replaces its story text: v0.5 "makes no sense" and was "too simplistic to be fun"; the brief is "a cute love story that's a bit fun". The v0.5 machinery stays (story scene, Story button, portraits with fallbacks, arrival banner, result-card portrait and line, the 5000 m card); this round changes what it says, adds the gifts and Daifuku's cut-ins, and turns the reunion into a proposal. Cast: `docs/games/launch/world.md` (updated).

## A. The cold open (four cards)

1. "Every morning in the bakery window, Mochi wiggled a little closer to Daifuku." (`mochi-love` and `daifuku` side by side)
2. "Then a little girl bought Daifuku for her grandma's tea party, 5 km away." (`daifuku-wave`)
3. "Mochi's legs are very small. 5 km is very far." (`mochi-determined`)
4. "Then he remembered the bakery's Mochi Maker 3000. It has one setting: FLING." (`mochi-maker`)

Shown once to every save on this version, veterans included, because the story is new; one tap skips it. Replayable from Story.

## B. Gifts for Daifuku

- The first time ever a flight enters a place, Mochi picks up a gift, said by the in-flight banner:
  - Candy Meadow: "A sugar flower for Daifuku!"
  - Chocolate River: "A chocolate heart for Daifuku!"
  - Soda Springs: "A soda bubble... shaped like a ring!"
  - Gingerbread Town: "A gingerbread ribbon, to wrap it all."
- A small gift box beside the journey strip shows the gifts found so far (four simple drawn icons, empty outlines until found).
- The last place is renamed from Home to **Tea Party** (the grandma's cottage; the save key `home` stays internal).

## C. Mochi rehearses (the result card line)

Replaces the v0.5 pools; the portrait choice is unchanged.
- **New best:** "Closer! 'Hi, Daifuku.' No, too casual.", "Daifuku, you're my... um... sweet.", "Nearly there. 'Will you...' Eek!"
- **Mud or a crash:** "Note to self: no mud before the big moment.", "Squished. But my heart is fine.", "Still cute? Still cute."
- **Otherwise:** "'Hello.' Too formal. 'Hey you.' Too cool.", "One more fling. Daifuku is waiting.", "I'll say it when I get there. I will."

## D. Daifuku's side

- On a new best, one time in three, a small inset in a corner of the result card (never over a button) shows Daifuku at the tea-party window (Pack 13 `daifuku-window`; fallback: `daifuku` in a drawn window frame) with one line: "Was that... a mochi in the sky?", "I wish Mochi were here.", "I saved a seat by the window." Cosmetic (`Math.random`).

## E. The proposal (replaces the reunion card)

- The first flight that reaches Tea Party ends on a short sequence before the result card, one tap per beat, Skip visible:
  1. "Mochi landed right by the window." (`mochi-love`, `daifuku`)
  2. "He held out the soda bubble, just like a ring. 'Will you be my sweetheart?'" (Pack 13 `mochi-ring`; fallback `mochi-love` with a drawn bubble ring)
  3. "'Yes!'" with hearts (`mochi-love` and `daifuku-wave` together)
  4. "Now they fly together. How far can love go?"
- It is marked seen only once it has shown (fixes the v0.5 note that backgrounding lost the reunion).

## F. The honeymoon (past Tea Party)

- After the proposal, Daifuku rides along: drawn small beside Mochi on the journey strip and the menu, and the result-card pool for flights after the proposal becomes: "Honeymoon flight! Wheee!", "Daifuku says: higher!", "Best. Date. Ever." (the crash pool still applies to mud or a crash).
- No change to physics or the in-play sprite.

## G. Art

- Pack 13 (`docs/art/BRIEF.md`): `daifuku-window`, `mochi-ring`. Wire what is in `docs/art/final/launch/` as webp; draw the fallbacks above until it lands.

## H. Saves

- `saveVersion` 10: `openSeen` becomes the story version shown (2 for this one; v9's `true` reads as 1, so it shows once); `gifts` reuses `placesSeen`; new `proposed` (the proposal has shown). `migrate` sets `proposed` false for everyone, so a veteran who already reached Home sees the proposal at the end of their next flight, once.

## I. Out of scope

Physics, prices, goals, places beyond the rename, sound beyond the existing chime, villains or rivals.

## J. Acceptance

- Principle 11 counts on every card; every line at most about 80 characters, the cold open's at most two lines at 640x360 and clear of Skip at every landscape size.
- Every story element skips in one tap and never delays a launch.
- A v9 save sees the new cold open once; a v9 save with `home` true sees the proposal once after its next flight.
- Gifts appear once each and fill the box; Daifuku rides along only after the proposal.
- Fallbacks draw while Pack 13 is missing.
- `npm run smoke` passes; frame time is not worse than launch-v15.
