# Recoil code map

Line ranges are as of the v0.10 build (4390 lines, on top of `217c9c6`) and drift as `games/recoil/src/game.js` changes. The anchors are the stable part: run `node tools/codemap-check.mjs` to warn when one disappears. Find a section by its anchor with `grep -n "NAME" games/recoil/src/game.js`.

| Lines | Section | What lives there | Anchors |
| --- | --- | --- | --- |
| 1-10 | Header, imports | File comment and engine imports. |  |
| 11-379 | TUNING | Every tunable number: sway, star noise, zombies, mastery, `guns` (per-gun stats), `unlockBadges`, `gunPrices`, `art` (palette, set styles). Per-challenge values live in CHALLENGES. | `TUNING` |
| 380-502 | Aliases and challenge data | T, A, STEP aliases, GUN_IDS, GAUNTLET, CHALLENGES (every rung of every ladder, plain data), ENDLESS and its icon mix. | `T` `A` `STEP` `GUN_IDS` `GAUNTLET` `CHALLENGES` `ENDLESS` `chById` |
| 503-821 | Star bars | BARS (generated noisy-bot star bars per gun; regenerate when the sim changes; v0.8 B2 `h` human-pace medians and `cal` designer runs cap the two-star bar), curveAt, thresholds, LADDERS. | `BARS` `curveAt` `thresholds` `LADDERS` |
| 822-944 | Setup (seeded) | Seeded run setup: legal, pickY, endlessWave, `zombieLook` (v0.10 B: size, speed, rear phase, costume and feature, from a look stream of its own), zombieWave, build. | `legal` `pickY` `endlessWave` `zombieWave` `build` `zombieLook` |
| 945-1070 | Sim core | Fixed-step sim with timestamped input: makeRun, queueInput, closeBurst (an automatic gun's hold is one Accuracy shot), posAt, spawn functions per mode, boss core, dodge. | `makeRun` `queueInput` `closeBurst` `posAt` `addTarget` `spawnAccuracy` `spawnSpeed` `spawnSkeet` `spawnBoss` `dodge` |
| 1071-1092 | Sim: reload | startReload, stepReload, reloadFrac. | `startReload` `stepReload` `reloadFrac` |
| 1093-1194 | Sim: zombies | ZTYPES, layoutZombie (v0.10 A: the Hunched zombie's rear-up rhythm, `z.rise` and `z.tell`), spawnZombie, startWave, killZombie, zombieShot, stepZombie, checkEnd. | `ZTYPES` `spawnZombie` `startWave` `killZombie` `zombieShot` `stepZombie` `checkEnd` |
| 1195-1404 | Sim: fire and step | Shotgun fans, fire (hit test, scoring, combo), stepAccuracy/Speed/Skeet/Boss, step, advance, stamp. | `FANS` `fire` `stepAccuracy` `stepSpeed` `stepSkeet` `stepBoss` `step` `advance` `stamp` `starsFor` |
| 1405-1429 | Save reads and stars | starsFor, bests, bestOf, starsOf, isUnlocked, pointsTotal, frontier, rungsDone. | `bests` `starsOf` `isUnlocked` `frontier` `rungsDone` |
| 1430-1452 | Guns and Prop Room economy | Owned guns, gunUnlocked, `openByStars` (v0.10 D: the .44 at 40 stars, run at load and after every result), `starsLine`, box office (boxOf, money), gunId. | `gunUnlocked` `ownedMap` `boxOf` `money` `gunId` `openByStars` `starsLine` |
| 1453-1510 | Badges | BADGES and tiers, newBadges, gauntletStep, badgeMap. | `BADGES` `BADGE_TIERS` `newBadges` `gauntletStep` `badgeMap` |
| 1511-1530 | Gun mastery | Mastery keys and tiers, masteryOf, tierOf, deriveMastery. | `MASTERY_KEYS` `TIER_NAMES` `masteryOf` `tierOf` |
| 1531-1616 | Career, story text and posters (v0.7, v0.9) | STORY (every line: cold open, Intern, turn, ending, notes by career, Gus's step line), POSTER_SETS, careerInfo and rankFor, `pendingStory` (the one owed career scene), threeStarred and releasePosters, starsInBest. | `STORY` `careerInfo` `rankFor` `threeStarred` `releasePosters` `deriveMastery` |
| 1617-1644 | Skins | skinById, skinOpen, skinNeed, skinId. | `skinById` `skinOpen` `skinNeed` `skinId` |
| 1645-1902 | Drawing: helpers, guns, cards | view, shape helpers, sprite cache, buildGun, gunArt, drawGun, drawGunTile, flash, casings. | `view` `drawSprite` `buildGun` `gunArt` `drawGun` `drawFlash` |
| 1903-2115 | Drawing: targets | Gun cards (drawCard, paintCard), then posts, trolley, clay, plates, boss core, hit points. | `drawPost` `drawTrolley` `drawClay` `drawPlate` `drawCore` `drawTargetFull` `drawCard` |
| 2116-2228 | Drawing: zombies | paintZombie, drawZombie, drawCorpse, drawFence. | `paintZombie` `drawZombie` `drawCorpse` `drawFence` |
| 2229-2256 | Drawing: reload | Reload button rect and ring. | `reloadRect` `drawReloadRing` |
| 2257-2368 | Drawing: range finder and hits | Range finder, tracer, drop, bursts, clapper, hit ring, pop text. | `drawRangeFinder` `drawTracer` `drawBurst` `burst` `drawClapper` `drawHitRing` `popText` |
| 2369-2550 | Drawing: the sets | Each mode is a soundstage painted once per screen scale into an offscreen image: setOf, prepSet, drawSet, paintWestern and siblings. | `setOf` `prepSet` `drawSet` `paintStage` `paintWestern` |
| 2551-2595 | Drawing: interface pieces | plate, btn, pipRow, paintChip. | `plate` `btn` `pipRow` `paintChip` |
| 2596-2656 | Drawing: the range menu | Ladder lanes: prepMenu, paintRung, drawTicket, drawCallSheet, drawChip. | `prepMenu` `paintRung` `drawTicket` `drawCallSheet` `drawChip` |
| 2657-2810 | Play state, juice and sound | S, newRun, cosmetics (sim events turned into sounds, haptics and effects), pickGun, wearSkin, quitRun, endRun. | `S` `newRun` `cosmetics` `pickGun` `wearSkin` `quitRun` `endRun` `meterText` |
| 2811-2862 | Menu layout | menuLayout and meterText. | `menuLayout` |
| 2863-3032 | Menu widgets | fitText, wrapText, rung and rack tiles, mastery bar, menuHint, soundButton, logo and patterns (before the scene objects). | `drawRungTile` `drawMasteryBar` `drawRackSelected` `menuHint` `soundButton` `drawLogo` |
| 3033-3105 | Story drawing (v0.7) | drawDirector (Big Lou, art or drawn fallback), drawPoster and its empty slot, drawStage (the soundstage behind a poster card), drawRankBoard (the clapperboard the Intern scene uses). | `drawDirector` `drawPoster` `drawStage` `drawRankBoard` |
| 3106-3457 | The animated story (v0.9) | The scene toolkit (`storyPic`, `drawPlayer`, `drawDusk`, `forSale`, `sText`), the six scenes as pure functions of time (`sceneLot`, `sceneExtras`, `sceneGus`, `sceneIntern`, `sceneTurn`, `sceneEnding`), `SCENES` (lines, beats, sounds), `CUES`, the seen marks, and the `story` player (cold open, Intern scene, turn, ending, poster cards, Skip, tap to jump to the end). Scene lengths are `TUNING.scenes`. | `storyPic` `SCENES` `CUES` `markScene` `story` `sceneEdge` |
| 3458-3510 | Career screen (v0.7, funds v0.9) | The rank ladder, the poster wall, the studio-funds row (`drawFunds`: FOR SALE or NOT FOR SALE, six segments, box office) and Story replay. | `career` `drawFunds` |
| 3511-3588 | Menu scene | The range menu: gun rack, ladders, play, missions, endless, Prop Room. | `menu` `gauntletReason` |
| 3589-3688 | Missions scene | Badges and the gauntlet. | `missions` |
| 3689-3768 | Gun card scene | Stat rows and the gun card (stats, skins). | `STAT_ROWS` `gunCard` |
| 3769-3893 | Prop Room scene | Buying guns: propsLayout and the props scene. | `PROP_STATS` `propsLayout` `props` |
| 3894-4079 | Play scene | Input to the sim, fixed-step advance, render. | `play` |
| 4080-4201 | Over scene (result card) | The result card (v0.8 D2): six items and the call-sheet row. | `over` |
| 4202-4293 | TUNE panel | EXPERIMENTS, PRESETS, TUNE_KEYS and the tune scene. | `EXPERIMENTS` `PRESETS` `TUNE_KEYS` `tune` |
| 4294-4313 | Save migration helper | migrateGuns (moves old unlocks to bought guns). | `migrateGuns` |
| 4314-4390 | Game object (save, migrate, harness hooks) | slug, saveVersion, migrate, init, TUNING, experiments, presets, scenes. | `game` `migrate` |

## To change X, read Y

1. **Add or retune a gun.** Read `TUNING.guns` and `gunPrices`, `fire` (hit test, fan, damage), `buildGun` and `gunArt` for the look, `STAT_ROWS` and `props` for the card.
2. **Add or change a challenge.** Read `CHALLENGES`, `LADDERS`, `build`, the `spawn*` functions; star bars come from `BARS` (regenerate with the harness when the sim changes).
3. **Change target movement or hit rules.** Read `posAt`, `step`, `stepAccuracy`/`stepSpeed`/`stepSkeet`/`stepBoss`, `fire`; looks are `drawTargetFull` and friends.
4. **Change zombies.** Read `ZTYPES`, `spawnZombie`, `stepZombie`, `zombieWave`, `checkEnd`, then `drawZombie` and `drawFence`.
5. **Change save, economy or badges.** Read `stamp`, `BADGES`, `boxOf`, `gunUnlocked`, and `game` at the end (`saveVersion`, `migrate`, `migrateGuns`).
6. **Change the story, the career or the posters.** Read `STORY` (every line), `careerInfo` and `TUNING.career` (ranks, thresholds), `TUNING.scenes` (scene lengths), `pendingStory` and `releasePosters`, then `story` (the player), `SCENES` and the `scene*` functions (the pictures), `career` and `drawCareerPlate`, `endRun` (where the owed scene and the poster are queued) and `over`'s `go` (where they are shown); the Prop Room's step line is in `props.enter`; art goes in `STORY_ART`.
