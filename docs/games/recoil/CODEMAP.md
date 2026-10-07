# Recoil code map

Line ranges are as of the v0.8 build (3916 lines, on top of `34275cc`) and drift as `games/recoil/src/game.js` changes. The anchors are the stable part: run `node tools/codemap-check.mjs` to warn when one disappears. Find a section by its anchor with `grep -n "NAME" games/recoil/src/game.js`.

| Lines | Section | What lives there | Anchors |
| --- | --- | --- | --- |
| 1-8 | Header, imports | File comment and engine imports. |  |
| 9-367 | TUNING | Every tunable number: sway, star noise, zombies, mastery, `guns` (per-gun stats), `unlockBadges`, `gunPrices`, `art` (palette, set styles). Per-challenge values live in CHALLENGES. | `TUNING` |
| 368-488 | Aliases and challenge data | T, A, STEP aliases, GUN_IDS, GAUNTLET, CHALLENGES (every rung of every ladder, plain data), ENDLESS and its icon mix. | `T` `A` `STEP` `GUN_IDS` `GAUNTLET` `CHALLENGES` `ENDLESS` `chById` |
| 489-764 | Star bars | BARS (generated noisy-bot star bars per gun; regenerate when the sim changes; v0.8 B2 `h` human-pace medians and `cal` designer runs cap the two-star bar), curveAt, thresholds, LADDERS. | `BARS` `curveAt` `thresholds` `LADDERS` |
| 765-880 | Setup (seeded) | Seeded run setup: legal, pickY, endlessWave, zombieWave, build. | `legal` `pickY` `endlessWave` `zombieWave` `build` |
| 881-996 | Sim core | Fixed-step sim with timestamped input: makeRun, queueInput, closeBurst (an automatic gun's hold is one Accuracy shot), posAt, spawn functions per mode, boss core, dodge. | `makeRun` `queueInput` `closeBurst` `posAt` `addTarget` `spawnAccuracy` `spawnSpeed` `spawnSkeet` `spawnBoss` `dodge` |
| 997-1018 | Sim: reload | startReload, stepReload, reloadFrac. | `startReload` `stepReload` `reloadFrac` |
| 1019-1108 | Sim: zombies | ZTYPES, layoutZombie, spawnZombie, startWave, killZombie, zombieShot, stepZombie, checkEnd. | `ZTYPES` `spawnZombie` `startWave` `killZombie` `zombieShot` `stepZombie` `checkEnd` |
| 1109-1315 | Sim: fire and step | Shotgun fans, fire (hit test, scoring, combo), stepAccuracy/Speed/Skeet/Boss, step, advance, stamp. | `FANS` `fire` `stepAccuracy` `stepSpeed` `stepSkeet` `stepBoss` `step` `advance` `stamp` `starsFor` |
| 1316-1340 | Save reads and stars | starsFor, bests, bestOf, starsOf, isUnlocked, pointsTotal, frontier, rungsDone. | `bests` `starsOf` `isUnlocked` `frontier` `rungsDone` |
| 1341-1359 | Guns and Prop Room economy | Owned guns, gunUnlocked, box office (boxOf, money), gunId, unlockBadge. | `gunUnlocked` `ownedMap` `boxOf` `money` `gunId` `unlockBadge` |
| 1360-1414 | Badges | BADGES and tiers, newBadges, gauntletStep, badgeMap. | `BADGES` `BADGE_TIERS` `newBadges` `gauntletStep` `badgeMap` |
| 1415-1434 | Gun mastery | Mastery keys and tiers, masteryOf, tierOf, deriveMastery. | `MASTERY_KEYS` `TIER_NAMES` `masteryOf` `tierOf` `deriveMastery` |
| 1435-1500 | Career, story text and posters (v0.7) | STORY (every line of the story), POSTER_SETS, careerInfo and rankFor (rank from total stars), threeStarred and releasePosters (one poster per finished set), starsInBest (the migration reads saved bests with it). | `STORY` `careerInfo` `rankFor` `threeStarred` `releasePosters` |
| 1501-1535 | Skins | skinById, skinOpen, skinNeed, skinId. | `skinById` `skinOpen` `skinNeed` `skinId` |
| 1536-1790 | Drawing: helpers, guns, cards | view, shape helpers, sprite cache, buildGun, gunArt, drawGun, drawGunTile, flash, casings. | `view` `drawSprite` `buildGun` `gunArt` `drawGun` `drawFlash` |
| 1791-2004 | Drawing: targets | Gun cards (drawCard, paintCard), then posts, trolley, clay, plates, boss core, hit points. | `drawPost` `drawTrolley` `drawClay` `drawPlate` `drawCore` `drawTargetFull` `drawCard` |
| 2005-2085 | Drawing: zombies | paintZombie, drawZombie, drawCorpse, drawFence. | `paintZombie` `drawZombie` `drawCorpse` `drawFence` |
| 2086-2114 | Drawing: reload | Reload button rect and ring. | `reloadRect` `drawReloadRing` |
| 2115-2226 | Drawing: range finder and hits | Range finder, tracer, drop, bursts, clapper, hit ring, pop text. | `drawRangeFinder` `drawTracer` `drawBurst` `burst` `drawClapper` `drawHitRing` `popText` |
| 2227-2407 | Drawing: the sets | Each mode is a soundstage painted once per screen scale into an offscreen image: setOf, prepSet, drawSet, paintWestern and siblings. | `setOf` `prepSet` `drawSet` `paintStage` `paintWestern` |
| 2408-2467 | Drawing: interface pieces | plate, btn, pipRow, paintChip. | `plate` `btn` `pipRow` `paintChip` |
| 2468-2512 | Drawing: the range menu | Ladder lanes: prepMenu, paintRung, drawTicket, drawCallSheet, drawChip. | `prepMenu` `paintRung` `drawTicket` `drawCallSheet` `drawChip` |
| 2513-2668 | Play state, juice and sound | S, newRun, cosmetics (sim events turned into sounds, haptics and effects), pickGun, wearSkin, quitRun, endRun. | `S` `newRun` `cosmetics` `pickGun` `wearSkin` `quitRun` `endRun` `meterText` |
| 2669-2744 | Menu layout | menuLayout and meterText. | `menuLayout` `fitText` |
| 2745-2866 | Menu widgets | fitText, wrapText, rung and rack tiles, mastery bar, menuHint, soundButton, logo and patterns (before the scene objects). | `drawRungTile` `drawMasteryBar` `drawRackSelected` `menuHint` `soundButton` `drawLogo` |
| 2867-3049 | Story cards and career screen (v0.7) | drawDirector, drawPoster, drawStage, drawRankBoard (art or drawn fallback), the `story` scene (cold open, rank and poster cards, Skip) and the `career` scene (rank ladder, poster wall, Story replay); drawCareerPlate is the menu plate. | `drawDirector` `drawPoster` `drawCareerPlate` `story` `career` |
| 3050-3130 | Menu scene | The range menu: gun rack, ladders, play, missions, endless, Prop Room. | `menu` `gauntletReason` |
| 3131-3232 | Missions scene | Badges and the gauntlet. | `missions` |
| 3233-3311 | Gun card scene | Stat rows and the gun card (stats, skins). | `STAT_ROWS` `gunCard` |
| 3312-3426 | Prop Room scene | Buying guns: propsLayout and the props scene. | `PROP_STATS` `propsLayout` `props` |
| 3427-3612 | Play scene | Input to the sim, fixed-step advance, render. | `play` |
| 3613-3735 | Over scene (result card) | The result card (v0.8 D2): six items and the call-sheet row. | `over` |
| 3736-3827 | TUNE panel | EXPERIMENTS, PRESETS, TUNE_KEYS and the tune scene. | `EXPERIMENTS` `PRESETS` `TUNE_KEYS` `tune` |
| 3828-3843 | Save migration helper | migrateGuns (moves old unlocks to bought guns). | `migrateGuns` |
| 3844-3916 | Game object (save, migrate, harness hooks) | slug, saveVersion, migrate, init, TUNING, experiments, presets, scenes. | `game` `migrate` |

## To change X, read Y

1. **Add or retune a gun.** Read `TUNING.guns` and `gunPrices`, `fire` (hit test, fan, damage), `buildGun` and `gunArt` for the look, `STAT_ROWS` and `props` for the card.
2. **Add or change a challenge.** Read `CHALLENGES`, `LADDERS`, `build`, the `spawn*` functions; star bars come from `BARS` (regenerate with the harness when the sim changes).
3. **Change target movement or hit rules.** Read `posAt`, `step`, `stepAccuracy`/`stepSpeed`/`stepSkeet`/`stepBoss`, `fire`; looks are `drawTargetFull` and friends.
4. **Change zombies.** Read `ZTYPES`, `spawnZombie`, `stepZombie`, `zombieWave`, `checkEnd`, then `drawZombie` and `drawFence`.
5. **Change save, economy or badges.** Read `stamp`, `BADGES`, `boxOf`, `gunUnlocked`, and `game` at the end (`saveVersion`, `migrate`, `migrateGuns`).
6. **Change the story, the career or the posters.** Read `STORY` (every line), `careerInfo` and `TUNING.career` (ranks, thresholds), `releasePosters`, then `story`, `career`, `drawCareerPlate` and `endRun` (where the rank card and the poster are queued) and `over`'s `go` (where they are shown); art goes in `STORY_ART`.
