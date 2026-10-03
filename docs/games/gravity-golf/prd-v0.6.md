# Gravity Golf PRD v0.6: a rank ladder from Asteroid to Black Hole, plus the generated title and medals

Status: draft 2026-10-03, waiting for the designer to lock it. Builds on v0.5 and its amendments. Source: the designer's decisions in the art chat and in this one:
- an overall progression rank on top of the badges, a ladder of space objects in the spirit of Khan Academy's point levels;
- the sixteen emblems picked in the art chat;
- about one rank every 3 to 5 holes, so a rank feels earned.

Art: the files in `docs/art/final/gravity-golf/` are `rank-01-asteroid.png` to `rank-16-black-hole.png`, `medal-<id>.png` (11) and `title-gravity-golf.png`.

## A. What drives the rank

- **Stars drive it, nothing else.** Every star earned on any hole counts once, best result per hole, as now. Badges stay separate challenges and do not add points: one number to chase, and a player who replays a hole for its third star sees it move.
- **Ten stars per rank** (`TUNING.rank.starsPerRank`). Rank 1, Asteroid, is where everyone starts with 0 stars. Rank n needs 10 × (n − 1) stars.
  - At two or three stars a hole, that is one rank every 3 to 5 holes.
- **Today's 25 holes (75 stars) reach rank 8, Blue Star**, at 70 stars. Ranks 9 to 16 arrive with new sectors: each sector of 5 holes adds 15 stars, so about 1.5 ranks. Black Hole needs 150 stars, which is 50 holes. The thresholds never change when holes are added, so a rank is never taken away.

| Rank | Name | Stars |
| --- | --- | --- |
| 1 | Asteroid | 0 |
| 2 | Moon | 10 |
| 3 | Planet | 20 |
| 4 | Giant Planet | 30 |
| 5 | Brown Dwarf | 40 |
| 6 | Red Dwarf | 50 |
| 7 | Yellow Star | 60 |
| 8 | Blue Star | 70 |
| 9 | Red Giant | 80 |
| 10 | Blue Giant | 90 |
| 11 | White Dwarf | 100 |
| 12 | Supernova | 110 |
| 13 | Nebula | 120 |
| 14 | Neutron Star | 130 |
| 15 | Quasar | 140 |
| 16 | Black Hole | 150 |

## B. Where it shows

- **Menu:** the rank becomes the menu's one headline (principle 11). It shows the emblem (about 72 px), the rank name, and one progress line, "4 stars to Red Dwarf", with a thin bar under it. Tapping it opens the ladder.
- **Ladder:** a scrollable column on the missions screen, above the badges.
  - Ranks reached show in full colour with their name and star count.
  - The next rank shows in full colour with a "next" tag.
  - Ranks after that show as dark silhouettes with their star count.
  - Ranks beyond today's 75 stars carry one small line: "more holes coming".
- **Rank-up:** when a hole's end card adds the star that crosses a threshold, the end card first plays the usual way. Then a rank-up card follows (under 2 s, tap to skip):
  - the new emblem scales up from the old one, with a glow ring and a spark burst in the emblem's own colour;
  - "Rank up: Red Dwarf" and "10 stars to Yellow Star";
  - a rising three-note chime (principle 16).
  - It never delays Retry or Next by more than one tap.
- **Veterans:** a player who already has stars on first boot sees one rank-up card for their current rank on the menu, never a cascade.

## C. Title and medals (pack 6, same build)

- The generated `title-gravity-golf.png` replaces the drawn title on the menu, with the drawn one kept as the fallback if the image fails. In portrait, crop or scale it so the whole wordmark stays inside the safe area.
- Each badge tile on the missions screen shows its `medal-<id>.png` in place of the drawn icon:
  - locked medals greyed at 35 percent;
  - earned medals in full colour;
  - the tier rim already matches the existing tier colours.
- The badge-earned toast or card uses the same medal.

## D. Assets and saves

- Images are for looking at (ADR-0015): the rank and medal art never appears in play.
- Resize the ranks to 256 x 256, the size they are drawn at 3x density. The medals are 256 already. The title is about 1024 px wide.
- Use WebP where it saves more than a third over PNG; iOS 14 and later decode it. The `assets/` folder stays under 1.5 MB in total, with every file in the `sw.js` cache list.
- Save: `saveVersion` 8 adds `rankSeen` (the highest rank whose card has been shown). `migrate` sets it to one below the current rank, so B's single veteran card plays once.
- The rank is computed from stars and is never stored.

## E. Out of scope

- New holes or sectors: this is the next content pass, after the designer plays the ladder.
- Rank rewards (cosmetic balls or trails per rank).
- Points from badges.
- Any change to holes, physics, stars, par or badge conditions.

## F. Acceptance

- The rank, menu line and ladder are correct for saves at 0, 9, 10, 37, 70 and 75 stars. Screenshot each at 390x844 and 844x390.
- A rank-up card plays exactly once when a threshold is crossed. It plays once for a migrated v7 save, and never on a replay that adds no star.
- Every emblem and medal reads at phone size, with no halo on the dark background. The drawn fallbacks work with the images blocked.
- `assets/` is under 1.5 MB, and offline reload shows every image.
- The first menu frame is under 40 ms at 4x CPU throttle (`tools/perf.mjs`).
- `npm run smoke` passes with no console errors.
