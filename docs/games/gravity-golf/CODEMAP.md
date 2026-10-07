# Gravity Golf code map

Line ranges are as of PRD v0.12 (3391 lines) and drift as `games/gravity-golf/src/game.js` changes. The anchors are the stable part: run `node tools/codemap-check.mjs` to warn when one disappears. Find a section by its anchor with `grep -n "NAME" games/gravity-golf/src/game.js`.

| Lines | Section | What lives there | Anchors |
| --- | --- | --- | --- |
| 1-7 | Header, imports | File comment and engine imports. |  |
| 8-490 | TUNING | Every tunable number: ball physics (friction, stopSpeed, physicsStep), preview, planets, suns, black holes, bars, moons, comets; `juice` (cosmetic timings and haptics) and `art` (palette, type, sectors) are sub-objects. | `TUNING` |
| 491-758 | Aliases and hole data | T, J, STEP aliases; the hole-format comment; LEVELS (the 25 holes, plain data); prepareLevel clamps a hole and fills optional fields (sim-golf uses it too). | `T` `J` `STEP` `LEVELS` `prepareLevel` |
| 759-1159 | Physics | One fixed-step function drives both the flight and the aim preview: movers (slides, moons, comets, bars), wall and mover bounces, gravity pulls (planets, suns, black holes), stepBall, launch from the drag, previewPoints, the cup ring test. | `stepBall` `launchFromDrag` `launchVel` `previewPoints` `pull` `carry` `slideAt` `moonAt` `cometAt` `barAt` `bounceRect` `bhInfluence` `flightEntersRing` |
| 1160-1193 | Helpers and progress | view (design space to screen), starsFor, shots, openHole, and progress (reads of the saved bests and unlocks). | `view` `starsFor` `openHole` `progress` |
| 1194-1299 | Badges and skins | Art palette aliases, BADGES and the progress, saved and event badge logic, the RUN (full run) state, SKINS and applySkins. | `BADGES` `badgeProgress` `savedBadge` `eventBadge` `RUN` `SKINS` `applySkins` |
| 1300-1564 | Draw helpers | Colour helpers, text styles (TX), button styles (BTN), pill buttons, the ranks, gradient caches. | `rgba` `mixHex` `TX` `BTN` `pill` `buildGradients` |
| 1565-1703 | Sky | Parallax star layers, nebulae and the sector features (meteors, whale, sunrise), seeded per hole. | `buildSky` `drawField` `sectorOf` |
| 1704-2110 | Drawing the objects | Stars and lock, walls and slabs, bars, bumpers, planets, suns, comets, black holes, the cup, the ball and its skins, hole-select badges. | `drawPlanet` `drawSun` `drawBlackHole` `drawComet` `drawCup` `drawBall` `drawWall` `drawBadge` |
| 2111-2261 | Play state | S (the play scene state), loadHole, launch, comeToRest, returnToLastRest, finishHole, endRun. This is the game rules layer on top of the physics. | `S` `loadHole` `launch` `comeToRest` `returnToLastRest` `finishHole` `endRun` |
| 2262-2600 | Juice and sound | Cosmetic only: FX state, trail, ghost shot, bursts, and the per-event effects with their E.audio calls (releaseFx, bounceFx, sunFx, sinkFx), retry, hint, banner. | `FX` `resetFx` `fxUpdate` `releaseFx` `bounceFx` `sinkFx` `retry` `drawTrail` `drawGhost` `drawBanner` |
| 2601-2695 | Medals and tickets | drawMedal, drawBigMedal (the showcase and reveal medal: turn, sheen, silhouette) and drawTicket (badge UI pieces). | `drawMedal` `drawBigMedal` `drawTicket` |
| 2696-2817 | Menu scene | Hole select: the scrolling tile grid (clipped, soft edges, opens on the next hole), rank card, pinned Play, Missions and Sound. | `menu` |
| 2818-2989 | Missions scene | Badges and skins screen (wrapText helper first); a tap on a badge row opens the full-screen showcase (`drawShow`). | `wrapText` `missions` |
| 2990-3190 | Play scene | shoot, then the play scene: aim input, fixed-step update, render order. | `shoot` `play` |
| 3191-3319 | Over scene | Hole card: stars, badges earned (the big-medal reveal, `drawReveal`, then the ticket), retry and next. | `over` `drawReveal` |
| 3320-3391 | Game object (save, migrate, harness hooks) | slug, saveVersion, migrate (save upgrades), TUNING, presets and experiments (TUNE panel), `sim` (read by tools/sim-golf.mjs), scenes. | `game` `migrate` |

## To change X, read Y

1. **Add or retune a hole.** Read the hole-format comment above `LEVELS` and `prepareLevel`, then run `node tools/sim-golf.mjs` on the entry. Star thresholds are `stars: { three, two }` in the hole, applied by `starsFor`.
2. **Change how the ball flies or feels.** Read the physics keys at the top of `TUNING`, then `stepBall`, `launchFromDrag`, `launchVel`. The aim preview reuses them through `previewPoints`, so one change covers both.
3. **Change planets, suns or black holes.** Read `pull`, `bhInfluence`, `sunRestR`, `bhRestR` in Physics; their looks are `drawPlanet`, `drawSun`, `drawBlackHole`.
4. **Change badges, skins or the run counter.** Read `BADGES`, `badgeProgress`, `eventBadge`, `SKINS`, `applySkins`, then `drawTicket` and the `over` scene for how they show.
5. **Change a saved field.** Read `progress` (Helpers), the `game` object at the end (`saveVersion`, `migrate`); bump `saveVersion` and extend `migrate`.
