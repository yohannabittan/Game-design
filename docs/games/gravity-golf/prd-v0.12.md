# Gravity Golf PRD v0.12: menu fit, badges you can enjoy, and power in Expert

Status: locked 2026-10-07 from the designer's notes:
- "we have 30 levels now, which has pushed one of the buttons too far below, and there's another button that looks awkward because it's up";
- "we worked hard on the art badges and currently they display too small to really enjoy";
- "expert mode has only direction, not direction and power; I think both would be good".

Builds on v0.10. v0.11, the probe story, waits for a rewrite, which is why this one is numbered v0.12.

## A. The menu fits every phone

- At 402x812 (the designer's phone) the Missions and Sound buttons sit below the screen. Cause: 30 tiles in 6 rows, plus the title, the rank card and Play.
- Fix: the hole grid scrolls inside its own area, between the rank card and the buttons, with a soft fade at the edges. Play, Missions and Sound stay pinned at the bottom inside the safe area.
- The grid opens scrolled so the next hole to play (or the last unlocked one) is in view.
- Tiles keep their size, at least 44 px, and their contents. A tap that turns into a drag scrolls the grid and selects nothing.
- It must fit from 375x667 to 430x932, and hold up when more sectors are added.
- The dev-channel EXPORT and TUNE buttons get the same size and the same top line. On the 402x812 menu, EXPORT sits higher than TUNE.

## B. Badges big enough to enjoy

- **The badge list:** each medal on the Missions screen is drawn at about twice its current radius, so a row of the list is mostly medal.
- **A showcase:** tapping any badge, earned or not, opens a full-screen card.
  - **Earned:** the medal art at about 60 percent of the screen width, turning slowly with a light sheen sweeping across it, then the name, the tier, and the line that says how it was earned. One tap closes it.
  - **Not earned:** a dark silhouette at the same size, with its "how" line. Secret badges keep "???" until found.
- **Earning one:** the end-card badge reveal plays the same big medal for about 1.2 s, with the existing sound, before it settles to its slot. A tap skips it.
- The art is unchanged; it is just drawn larger, from the source images at their full resolution.

## C. Expert shows direction and power

- The Expert pointer's length now follows the drag's power, exactly as the normal aim's power does: a short arrow for a soft shot, up to a full-length arrow at full power. Draw a faint full-power length marker behind it so the scale reads.
- It still shows no curve, no dots and no ghost. Everything else in Expert (v0.9) is unchanged, including the fourth-star rule.
- Update the v0.9 line in TUNING's comment, which currently says "never power".

## D. Out of scope

Physics, holes, badges themselves, the rank ladder and the story.

## E. Acceptance

- Screenshots of the menu at 375x667, 390x844, 402x812 and 430x932, with every button on screen and at least 44 px.
- The grid scrolls, and the next hole is in view on open.
- The badge showcase, earned and unearned, at 402x812.
- The Expert pointer at a soft shot and at full power.
- `npm run smoke` passes. The menu and play frames are not slower than gravity-golf-v27. CACHE_VERSION is bumped.
