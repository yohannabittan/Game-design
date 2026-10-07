# Recoil code map

Line ranges are as of the v0.9 build (4316 lines, on top of `c0c4000`) and drift as `games/recoil/src/game.js` changes. The anchors are the stable part: run `node tools/codemap-check.mjs` to warn when one disappears. Find a section by its anchor with `grep -n "NAME" games/recoil/src/game.js`.

| Lines | Section | What lives there | Anchors |
| --- | --- | --- | --- |
| 1-10 | Header, imports | File comment and engine imports. |  |
| 11-373 | TUNING | Every tunable number: sway, star noise, zombies, mastery, `guns` (per-gun stats), `unlockBadges`, `gunPrices`, `art` (palette, set styles). Per-challenge values live in CHALLENGES. | `TUNING` |
| 374-496 | Aliases and challenge data | T, A, STEP aliases, GUN_IDS, GAUNTLET, CHALLENGES (every rung of every ladder, plain data), ENDLESS and its icon mix. | `T` `A` `STEP` `GUN_IDS` `GAUNTLET` `CHALLENGES` `ENDLESS` `chById` |
| 497-812 | Star bars | BARS (generated noisy-bot star bars per gun; regenerate when the sim changes; v0.8 B2 `h` human-pace medians and `cal` designer runs cap the two-star bar), curveAt, thresholds, LADDERS. | `BARS` `curveAt` `thresholds` `LADDERS` |
| 813-929 | Setup (seeded) | Seeded run setup: legal, pickY, endlessWave, zombieWave, build. | `legal` `pickY` `endlessWave` `zombieWave` `build` |
| 930-1055 | Sim core | Fixed-step sim with timestamped input: makeRun, queueInput, closeBurst (an automatic gun's hold is one Accuracy shot), posAt, spawn functions per mode, boss core, dodge. | `makeRun` `queueInput` `closeBurst` `posAt` `addTarget` `spawnAccuracy` `spawnSpeed` `spawnSkeet` `spawnBoss` `dodge` |
| 1056-1077 | Sim: reload | startReload, stepReload, reloadFrac. | `startReload` `stepReload` `reloadFrac` |
| 1078-1170 | Sim: zombies | ZTYPES, layoutZombie, spawnZombie, startWave, killZombie, zombieShot, stepZombie, checkEnd. | `ZTYPES` `spawnZombie` `startWave` `killZombie` `zombieShot` `stepZombie` `checkEnd` |
| 1171-1380 | Sim: fire and step | Shotgun fans, fire (hit test, scoring, combo), stepAccuracy/Speed/Skeet/Boss, step, advance, stamp. | `FANS` `fire` `stepAccuracy` `stepSpeed` `stepSkeet` `stepBoss` `step` `advance` `stamp` `starsFor` |
| 1381-1405 | Save reads and stars | starsFor, bests, bestOf, starsOf, isUnlocked, pointsTotal, frontier, rungsDone. | `bests` `starsOf` `isUnlocked` `frontier` `rungsDone` |
| 1406-1421 | Guns and Prop Room economy | Owned guns, gunUnlocked, box office (boxOf, money), gunId, unlockBadge. | `gunUnlocked` `ownedMap` `boxOf` `money` `gunId` `unlockBadge` |
| 1422-1479 | Badges | BADGES and tiers, newBadges, gauntletStep, badgeMap. | `BADGES` `BADGE_TIERS` `newBadges` `gauntletStep` `badgeMap` |
| 1480-1499 | Gun mastery | Mastery keys and tiers, masteryOf, tierOf, deriveMastery. | `MASTERY_KEYS` `TIER_NAMES` `masteryOf` `tierOf` `deriveMastery` |
| 1500-1585 | Career, story text and posters (v0.7, v0.9) | STORY (every line: cold open, Intern, turn, ending, notes by career, Gus's step line), POSTER_SETS, careerInfo and rankFor, `pendingStory` (the one owed career scene), threeStarred and releasePosters, starsInBest. | `STORY` `careerInfo` `rankFor` `threeStarred` `releasePosters` |
| 1586-1613 | Skins | skinById, skinOpen, skinNeed, skinId. | `skinById` `skinOpen` `skinNeed` `skinId` |
| 1614-1871 | Drawing: helpers, guns, cards | view, shape helpers, sprite cache, buildGun, gunArt, drawGun, drawGunTile, flash, casings. | `view` `drawSprite` `buildGun` `gunArt` `drawGun` `drawFlash` |
| 1872-2084 | Drawing: targets | Gun cards (drawCard, paintCard), then posts, trolley, clay, plates, boss core, hit points. | `drawPost` `drawTrolley` `drawClay` `drawPlate` `drawCore` `drawTargetFull` `drawCard` |
| 2085-2169 | Drawing: zombies | paintZombie, drawZombie, drawCorpse, drawFence. | `paintZombie` `drawZombie` `drawCorpse` `drawFence` |
| 2170-2197 | Drawing: reload | Reload button rect and ring. | `reloadRect` `drawReloadRing` |
| 2198-2309 | Drawing: range finder and hits | Range finder, tracer, drop, bursts, clapper, hit ring, pop text. | `drawRangeFinder` `drawTracer` `drawBurst` `burst` `drawClapper` `drawHitRing` `popText` |
| 2310-2491 | Drawing: the sets | Each mode is a soundstage painted once per screen scale into an offscreen image: setOf, prepSet, drawSet, paintWestern and siblings. | `setOf` `prepSet` `drawSet` `paintStage` `paintWestern` |
| 2492-2536 | Drawing: interface pieces | plate, btn, pipRow, paintChip. | `plate` `btn` `pipRow` `paintChip` |
| 2537-2597 | Drawing: the range menu | Ladder lanes: prepMenu, paintRung, drawTicket, drawCallSheet, drawChip. | `prepMenu` `paintRung` `drawTicket` `drawCallSheet` `drawChip` |
| 2598-2750 | Play state, juice and sound | S, newRun, cosmetics (sim events turned into sounds, haptics and effects), pickGun, wearSkin, quitRun, endRun. | `S` `newRun` `cosmetics` `pickGun` `wearSkin` `quitRun` `endRun` `meterText` |
| 2751-2802 | Menu layout | menuLayout and meterText. | `menuLayout` `fitText` |
| 2803-2972 | Menu widgets | fitText, wrapText, rung and rack tiles, mastery bar, menuHint, soundButton, logo and patterns (before the scene objects). | `drawRungTile` `drawMasteryBar` `drawRackSelected` `menuHint` `soundButton` `drawLogo` |
| 2973-3045 | Story drawing (v0.7) | drawDirector (Big Lou, art or drawn fallback), drawPoster and its empty slot, drawStage (the soundstage behind a poster card), drawRankBoard (the clapperboard the Intern scene uses). | `drawDirector` `drawPoster` `drawStage` `drawRankBoard` |
| 3046-3389 | The animated story (v0.9) | The scene toolkit (`storyPic`, `drawPlayer`, `drawDusk`, `forSale`, `sText`), the six scenes as pure functions of time (`sceneLot`, `sceneExtras`, `sceneGus`, `sceneIntern`, `sceneTurn`, `sceneEnding`), `SCENES` (lines, beats, sounds), `CUES`, the seen marks, and the `story` player (cold open, Intern scene, turn, ending, poster cards, Skip, tap to jump to the end). Scene lengths are `TUNING.scenes`. | `storyPic` `SCENES` `CUES` `markScene` `story` |
| 3390-3442 | Career screen (v0.7, funds v0.9) | The rank ladder, the poster wall, the studio-funds row (`drawFunds`: FOR SALE or NOT FOR SALE, six segments, box office) and Story replay. | `career` `drawFunds` |
| 3443-3520 | Menu scene | The range menu: gun rack, ladders, play, missions, endless, Prop Room. | `menu` `gauntletReason` |
| 3521-3621 | Missions scene | Badges and the gauntlet. | `missions` |
| 3622-3701 | Gun card scene | Stat rows and the gun card (stats, skins). | `STAT_ROWS` `gunCard` |
| 3702-3823 | Prop Room scene | Buying guns: propsLayout and the props scene. | `PROP_STATS` `propsLayout` `props` |
| 3824-4009 | Play scene | Input to the sim, fixed-step advance, render. | `play` |
| 4010-4131 | Over scene (result card) | The result card (v0.8 D2): six items and the call-sheet row. | `over` |
| 4132-4221 | TUNE panel | EXPERIMENTS, PRESETS, TUNE_KEYS and the tune scene. | `EXPERIMENTS` `PRESETS` `TUNE_KEYS` `tune` |
| 4222-4241 | Save migration helper | migrateGuns (moves old unlocks to bought guns). | `migrateGuns` |
| 4242-4316 | Game object (save, migrate, harness hooks) | slug, saveVersion, migrate, init, TUNING, experiments, presets, scenes. | `game` `migrate` |

## To change X, read Y

1. **Add or retune a gun.** Read `TUNING.guns` and `gunPrices`, `fire` (hit test, fan, damage), `buildGun` and `gunArt` for the look, `STAT_ROWS` and `props` for the card.
2. **Add or change a challenge.** Read `CHALLENGES`, `LADDERS`, `build`, the `spawn*` functions; star bars come from `BARS` (regenerate with the harness when the sim changes).
3. **Change target movement or hit rules.** Read `posAt`, `step`, `stepAccuracy`/`stepSpeed`/`stepSkeet`/`stepBoss`, `fire`; looks are `drawTargetFull` and friends.
4. **Change zombies.** Read `ZTYPES`, `spawnZombie`, `stepZombie`, `zombieWave`, `checkEnd`, then `drawZombie` and `drawFence`.
5. **Change save, economy or badges.** Read `stamp`, `BADGES`, `boxOf`, `gunUnlocked`, and `game` at the end (`saveVersion`, `migrate`, `migrateGuns`).
6. **Change the story, the career or the posters.** Read `STORY` (every line), `careerInfo` and `TUNING.career` (ranks, thresholds), `TUNING.scenes` (scene lengths), `pendingStory` and `releasePosters`, then `story` (the player), `SCENES` and the `scene*` functions (the pictures), `career` and `drawCareerPlate`, `endRun` (where the owed scene and the poster are queued) and `over`'s `go` (where they are shown); the Prop Room's step line is in `props.enter`; art goes in `STORY_ART`.
