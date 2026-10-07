# Gravity Golf code map

Line ranges are as of PRD v0.11 (4054 lines; v0.12 was 3391) and drift as `games/gravity-golf/src/game.js` changes. The anchors are the stable part: run `node tools/codemap-check.mjs` to warn when one disappears. Find a section by its anchor with `grep -n "NAME" games/gravity-golf/src/game.js`.

| Lines | Section | What lives there | Anchors |
| --- | --- | --- | --- |
| 1-7 | Header, imports | File comment and engine imports. |  |
| 8-502 | TUNING | Every tunable number: ball physics (friction, stopSpeed, physicsStep), preview, planets, suns, black holes, bars, moons, comets; `juice` (cosmetic timings and haptics), `story` (scene lengths, the story's hole indices, the end card's Mission Control rows) and `art` (palette, type, sectors, the Probe Log page) are sub-objects. | `TUNING` |
| 503-770 | Aliases and hole data | T, J, STEP aliases; the hole-format comment; LEVELS (the 25 holes, plain data); prepareLevel clamps a hole and fills optional fields (sim-golf uses it too). | `T` `J` `STEP` `LEVELS` `prepareLevel` |
| 771-1171 | Physics | One fixed-step function drives both the flight and the aim preview: movers (slides, moons, comets, bars), wall and mover bounces, gravity pulls (planets, suns, black holes), stepBall, launch from the drag, previewPoints, the cup ring test. | `stepBall` `launchFromDrag` `launchVel` `previewPoints` `pull` `carry` `slideAt` `moonAt` `cometAt` `barAt` `bounceRect` `bhInfluence` `flightEntersRing` |
| 1172-1205 | Helpers and progress | view (design space to screen), starsFor, shots, openHole, and progress (reads of the saved bests and unlocks). | `view` `starsFor` `openHole` `progress` |
| 1206-1311 | Badges and skins | Art palette aliases, BADGES and the progress, saved and event badge logic, the RUN (full run) state, SKINS and applySkins. | `BADGES` `badgeProgress` `savedBadge` `eventBadge` `RUN` `SKINS` `applySkins` |
| 1312-1577 | Draw helpers | Colour helpers, text styles (TX), button styles (BTN), pill buttons, the ranks, gradient caches. | `rgba` `mixHex` `TX` `BTN` `pill` `buildGradients` |
| 1578-1719 | Sky | Parallax star layers, nebulae and the sector features (meteors, whale, sunrise), seeded per hole. | `buildSky` `drawField` `sectorOf` |
| 1720-2128 | Drawing the objects | Stars and lock, walls and slabs, bars, bumpers, planets, suns, comets, black holes, the cup, the ball and its skins, hole-select badges. | `drawPlanet` `drawSun` `drawBlackHole` `drawComet` `drawCup` `drawBall` `drawWall` `drawBadge` |
| 2129-2281 | Play state | S (the play scene state), loadHole, launch, comeToRest, returnToLastRest, finishHole, endRun. This is the game rules layer on top of the physics. | `S` `loadHole` `launch` `comeToRest` `returnToLastRest` `finishHole` `endRun` |
| 2282-2620 | Juice and sound | Cosmetic only: FX state, trail, ghost shot, bursts, and the per-event effects with their E.audio calls (releaseFx, bounceFx, sunFx, sinkFx), retry, hint, banner. | `FX` `resetFx` `fxUpdate` `releaseFx` `bounceFx` `sinkFx` `retry` `drawTrail` `drawGhost` `drawBanner` |
| 2621-2715 | Medals and tickets | drawMedal, drawBigMedal (the showcase and reveal medal: turn, sheen, silhouette) and drawTicket (badge UI pieces). | `drawMedal` `drawBigMedal` `drawTicket` |
| 2716-2843 | Menu scene | Hole select: the scrolling tile grid (clipped, soft edges, opens on the next hole), rank card, pinned Play, Missions, Story (replays the cold open, the turn and the ending once seen) and Sound. | `menu` |
| 2844-3017 | Missions scene | Badges and skins screen (wrapText helper first); a tap on a badge row opens the full-screen showcase (`drawShow`); the Probe Log button opens the log page. | `wrapText` `missions` |
| 3018-3217 | Play scene | shoot, then the play scene: aim input, fixed-step update, render order. | `shoot` `play` |
| 3218-3379 | Over scene | Hole card: stars, badges earned (the big-medal reveal, `drawReveal`, then the ticket), Mission Control's portrait, line and fact (`lay` places the rows), retry and next. | `over` `drawReveal` |
| 3380-3969 | Story (v0.11) | Sam's lines (`SAM`, `SECTOR_LOG`), the Probe Log facts (`FACTS`, `earnedKeys`, `samPick`), the portraits (`drawSam`, `samAt`), the scene toolkit and the ten scenes (cold open, turn, ending: pure functions of time), `cardsScene` (the shared player: tap jumps to the end, next tap advances, auto-advance, Skip), the `story`, `turn` and `ending` scenes, `toPlay` (opens a hole, the turn first at hole 26) and the Probe Log page. | `SAM` `FACTS` `earnedKeys` `samPick` `drawSam` `sceneLab` `drawProbe` `cardsScene` `toPlay` `probeLog` |
| 3970-4054 | Game object (save, migrate, harness hooks) | slug, saveVersion, migrate (save upgrades), TUNING, presets and experiments (TUNE panel), `sim` (read by tools/sim-golf.mjs), scenes. | `game` `migrate` |

## To change X, read Y

1. **Add or retune a hole.** Read the hole-format comment above `LEVELS` and `prepareLevel`, then run `node tools/sim-golf.mjs` on the entry. Star thresholds are `stars: { three, two }` in the hole, applied by `starsFor`.
2. **Change how the ball flies or feels.** Read the physics keys at the top of `TUNING`, then `stepBall`, `launchFromDrag`, `launchVel`. The aim preview reuses them through `previewPoints`, so one change covers both.
3. **Change planets, suns or black holes.** Read `pull`, `bhInfluence`, `sunRestR`, `bhRestR` in Physics; their looks are `drawPlanet`, `drawSun`, `drawBlackHole`.
4. **Change badges, skins or the run counter.** Read `BADGES`, `badgeProgress`, `eventBadge`, `SKINS`, `applySkins`, then `drawTicket` and the `over` scene for how they show.
5. **Change a saved field.** Read `progress` (Helpers), the `game` object at the end (`saveVersion`, `migrate`); bump `saveVersion` and extend `migrate`.
6. **Change Sam's lines, a scene or the ending.** Read `SAM`, `OPEN`, `TURN`, `END`, the scene function (each is a pure function of its time `t`), then `cardsScene`. The save flags are in the `game.migrate` comment.
