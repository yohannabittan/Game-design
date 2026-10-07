# Gravity Golf code map

Line ranges are as of PRD v0.13 A (4277 lines; v0.11 was 4054) and drift as `games/gravity-golf/src/game.js` changes. The anchors are the stable part: run `node tools/codemap-check.mjs` to warn when one disappears. Find a section by its anchor with `grep -n "NAME" games/gravity-golf/src/game.js`.

| Lines | Section | What lives there | Anchors |
| --- | --- | --- | --- |
| 1-7 | Header, imports | File comment and engine imports. |  |
| 8-528 | TUNING | Every tunable number: ball physics (friction, stopSpeed, physicsStep), preview, planets, suns, black holes, burst stars (`burst*`), bars, moons, comets; `juice` (cosmetic timings and haptics), `story` (scene lengths, the story's hole indices, the end card's Mission Control rows) and `art` (palette, type, sectors, the Probe Log page) are sub-objects. | `TUNING` |
| 529-809 | Aliases and hole data | T, J, STEP aliases; the hole-format comment; LEVELS (the 31 holes, plain data); prepareLevel clamps a hole and fills optional fields, a burst star's too (sim-golf uses it too). | `T` `J` `STEP` `LEVELS` `prepareLevel` |
| 810-1246 | Physics | One fixed-step function drives both the flight and the aim preview: movers (slides, moons, comets, bars), wall and mover bounces, gravity pulls (planets, suns, black holes), burst stars (the cycle, planet shadows and the swept catch test, PRD v0.13 A), stepBall, the flight watch (badges), launch from the drag, previewPoints, the cup ring test. | `stepBall` `launchFromDrag` `launchVel` `previewPoints` `pull` `carry` `slideAt` `moonAt` `cometAt` `barAt` `bounceRect` `bhInfluence` `burstAge` `shadowHalf` `inShadow` `burstCatch` `flightEntersRing` |
| 1247-1280 | Helpers and progress | view (design space to screen), starsFor, shots, openHole, and progress (reads of the saved bests and unlocks). | `view` `starsFor` `openHole` `progress` |
| 1281-1386 | Badges and skins | Art palette aliases, BADGES and the progress, saved and event badge logic, the RUN (full run) state, SKINS and applySkins. | `BADGES` `badgeProgress` `savedBadge` `eventBadge` `RUN` `SKINS` `applySkins` |
| 1387-1659 | Draw helpers | Colour helpers, text styles (TX), button styles (BTN), pill buttons, the ranks, gradient caches. | `rgba` `mixHex` `TX` `BTN` `pill` `buildGradients` |
| 1660-1800 | Sky | Parallax star layers, nebulae and the sector features (meteors, whale, sunrise, core, the deep wash of sector 7), seeded per hole. | `buildSky` `drawField` `sectorOf` |
| 1801-2299 | Drawing the objects | Stars and lock, walls and slabs, bars, bumpers, planets, suns, burst stars (telegraph) and their fronts (band, guide circle, shadow gaps), comets, black holes, the cup, the ball and its skins, hole-select badges. | `drawPlanet` `drawSun` `drawBurst` `drawFronts` `shadowedCircle` `drawBlackHole` `drawComet` `drawCup` `drawBall` `drawWall` `drawBadge` |
| 2300-2452 | Play state | S (the play scene state), loadHole, launch, comeToRest, returnToLastRest (after a swallow or a burst catch), finishHole, endRun. This is the game rules layer on top of the physics. | `S` `loadHole` `launch` `comeToRest` `returnToLastRest` `finishHole` `endRun` |
| 2453-2801 | Juice and sound | Cosmetic only: FX state, trail, ghost shot, bursts, and the per-event effects with their E.audio calls (releaseFx, bounceFx, sunFx, fizzleFx, sinkFx), retry, hint, banner. | `FX` `resetFx` `fxUpdate` `releaseFx` `bounceFx` `fizzleFx` `sinkFx` `retry` `drawTrail` `drawGhost` `drawBanner` |
| 2802-2896 | Medals and tickets | drawMedal, drawBigMedal (the showcase and reveal medal: turn, sheen, silhouette) and drawTicket (badge UI pieces). | `drawMedal` `drawBigMedal` `drawTicket` |
| 2897-3024 | Menu scene | Hole select: the scrolling tile grid (clipped, soft edges, opens on the next hole), rank card, pinned Play, Missions, Story (replays the cold open, the turn and the ending once seen) and Sound. | `menu` |
| 3025-3198 | Missions scene | Badges and skins screen (wrapText helper first); a tap on a badge row opens the full-screen showcase (`drawShow`); the Probe Log button opens the log page. | `wrapText` `missions` |
| 3199-3407 | Play scene | shoot, then the play scene: aim input, fixed-step update (sink, swallow, burst catch and its fizzle), render order. | `shoot` `play` |
| 3408-3572 | Over scene | Hole card: stars, badges earned (the big-medal reveal, `drawReveal`, then the ticket), Mission Control's portrait, line and fact (`lay` places the rows), retry and next. | `over` `drawReveal` |
| 3573-4192 | Story (v0.11) | Sam's lines (`SAM`, `SECTOR_LOG`), the Probe Log facts (`FACTS`, `earnedKeys`, `samPick`), the portraits (`drawSam`, `samAt`), the scene toolkit and the ten scenes (cold open, turn, ending: pure functions of time), `cardsScene` (the shared player: tap jumps to the end, next tap advances, auto-advance, Skip), the `story`, `turn` and `ending` scenes, `toPlay` (opens a hole, the turn first at hole 26) and the Probe Log page. | `SAM` `FACTS` `earnedKeys` `samPick` `drawSam` `sceneLab` `drawProbe` `cardsScene` `toPlay` `probeLog` |
| 4193-4277 | Game object (save, migrate, harness hooks) | slug, saveVersion, migrate (save upgrades), TUNING, presets and experiments (TUNE panel), `sim` (read by tools/sim-golf.mjs), scenes. | `game` `migrate` |

## To change X, read Y

1. **Add or retune a hole.** Read the hole-format comment above `LEVELS` and `prepareLevel`, then run `node tools/sim-golf.mjs` on the entry. Star thresholds are `stars: { three, two }` in the hole, applied by `starsFor`.
2. **Change how the ball flies or feels.** Read the physics keys at the top of `TUNING`, then `stepBall`, `launchFromDrag`, `launchVel`. The aim preview reuses them through `previewPoints`, so one change covers both.
3. **Change planets, suns or black holes.** Read `pull`, `bhInfluence`, `sunRestR`, `bhRestR` in Physics; their looks are `drawPlanet`, `drawSun`, `drawBlackHole`.
4. **Change burst stars.** Read `burstAge`, `shadowHalf`, `inShadow`, `burstCatch` and the burst check near the end of `stepBall`; the looks are `drawBurst`, `drawFronts` (with `shadowedCircle`), `A.burst` in TUNING, and `fizzleFx` plus the play scene's `fizzle` phase.
5. **Change badges, skins or the run counter.** Read `BADGES`, `badgeProgress`, `eventBadge`, `SKINS`, `applySkins`, then `drawTicket` and the `over` scene for how they show.
6. **Change a saved field.** Read `progress` (Helpers), the `game` object at the end (`saveVersion`, `migrate`); bump `saveVersion` and extend `migrate`.
7. **Change Sam's lines, a scene or the ending.** Read `SAM`, `OPEN`, `TURN`, `END`, the scene function (each is a pure function of its time `t`), then `cardsScene`. The save flags are in the `game.migrate` comment.
