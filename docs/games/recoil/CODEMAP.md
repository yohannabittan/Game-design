# Recoil code map

Line ranges are as of commit `919a10b` (3535 lines) and drift as `games/recoil/src/game.js` changes. The anchors are the stable part: run `node tools/codemap-check.mjs` to warn when one disappears. Find a section by its anchor with `grep -n "NAME" games/recoil/src/game.js`.

| Lines | Section | What lives there | Anchors |
| --- | --- | --- | --- |
| 1-10 | Header, imports | File comment and engine imports. |  |
| 11-363 | TUNING | Every tunable number: sway, star noise, zombies, mastery, `guns` (per-gun stats), `unlockBadges`, `gunPrices`, `art` (palette, set styles). Per-challenge values live in CHALLENGES. | `TUNING` |
| 364-484 | Aliases and challenge data | T, A, STEP aliases, GUN_IDS, GAUNTLET, CHALLENGES (every rung of every ladder, plain data), ENDLESS and its icon mix. | `T` `A` `STEP` `GUN_IDS` `GAUNTLET` `CHALLENGES` `ENDLESS` `chById` |
| 485-757 | Star bars | BARS (generated noisy-bot star bars per gun; regenerate when the sim changes), curveAt, thresholds, LADDERS. | `BARS` `curveAt` `thresholds` `LADDERS` |
| 758-874 | Setup (seeded) | Seeded run setup: legal, pickY, endlessWave, zombieWave, build. | `legal` `pickY` `endlessWave` `zombieWave` `build` |
| 875-989 | Sim core | Fixed-step sim with timestamped input: makeRun, queueInput, posAt, spawn functions per mode, boss core, dodge. | `makeRun` `queueInput` `posAt` `addTarget` `spawnAccuracy` `spawnSpeed` `spawnSkeet` `spawnBoss` `dodge` |
| 990-1011 | Sim: reload | startReload, stepReload, reloadFrac. | `startReload` `stepReload` `reloadFrac` |
| 1012-1104 | Sim: zombies | ZTYPES, layoutZombie, spawnZombie, startWave, killZombie, zombieShot, stepZombie, checkEnd. | `ZTYPES` `spawnZombie` `startWave` `killZombie` `zombieShot` `stepZombie` `checkEnd` |
| 1105-1307 | Sim: fire and step | Shotgun fans, fire (hit test, scoring, combo), stepAccuracy/Speed/Skeet/Boss, step, advance, stamp. | `FANS` `fire` `stepAccuracy` `stepSpeed` `stepSkeet` `stepBoss` `step` `advance` `stamp` `starsFor` |
| 1308-1332 | Save reads and stars | starsFor, bests, bestOf, starsOf, isUnlocked, pointsTotal, frontier, rungsDone. | `bests` `starsOf` `isUnlocked` `frontier` `rungsDone` |
| 1333-1348 | Guns and Prop Room economy | Owned guns, gunUnlocked, box office (boxOf, money), gunId, unlockBadge. | `gunUnlocked` `ownedMap` `boxOf` `money` `gunId` `unlockBadge` |
| 1349-1406 | Badges | BADGES and tiers, newBadges, gauntletStep, badgeMap. | `BADGES` `BADGE_TIERS` `newBadges` `gauntletStep` `badgeMap` |
| 1407-1447 | Gun mastery | Mastery keys and tiers, masteryOf, tierOf, deriveMastery. | `MASTERY_KEYS` `TIER_NAMES` `masteryOf` `tierOf` `deriveMastery` |
| 1448-1475 | Skins | skinById, skinOpen, skinNeed, skinId. | `skinById` `skinOpen` `skinNeed` `skinId` |
| 1476-1650 | Drawing: helpers, guns, cards | view, shape helpers, sprite cache, buildGun, gunArt, drawGun, drawGunTile, flash, casings. | `view` `drawSprite` `buildGun` `gunArt` `drawGun` `drawFlash` |
| 1651-1862 | Drawing: targets | Gun cards (drawCard, paintCard), then posts, trolley, clay, plates, boss core, hit points. | `drawPost` `drawTrolley` `drawClay` `drawPlate` `drawCore` `drawTargetFull` `drawCard` |
| 1863-1947 | Drawing: zombies | paintZombie, drawZombie, drawCorpse, drawFence. | `paintZombie` `drawZombie` `drawCorpse` `drawFence` |
| 1948-1975 | Drawing: reload | Reload button rect and ring. | `reloadRect` `drawReloadRing` |
| 1976-2087 | Drawing: range finder and hits | Range finder, tracer, drop, bursts, clapper, hit ring, pop text. | `drawRangeFinder` `drawTracer` `drawBurst` `burst` `drawClapper` `drawHitRing` `popText` |
| 2088-2269 | Drawing: the sets | Each mode is a soundstage painted once per screen scale into an offscreen image: setOf, prepSet, drawSet, paintWestern and siblings. | `setOf` `prepSet` `drawSet` `paintStage` `paintWestern` |
| 2270-2314 | Drawing: interface pieces | plate, btn, pipRow, paintChip. | `plate` `btn` `pipRow` `paintChip` |
| 2315-2375 | Drawing: the range menu | Ladder lanes: prepMenu, paintRung, drawTicket, drawCallSheet, drawChip. | `prepMenu` `paintRung` `drawTicket` `drawCallSheet` `drawChip` |
| 2376-2526 | Play state, juice and sound | S, newRun, cosmetics (sim events turned into sounds, haptics and effects), pickGun, wearSkin, quitRun, endRun. | `S` `newRun` `cosmetics` `pickGun` `wearSkin` `quitRun` `endRun` `meterText` |
| 2527-2591 | Menu layout | menuLayout and meterText. | `menuLayout` `fitText` |
| 2592-2704 | Menu widgets | fitText, wrapText, rung and rack tiles, mastery bar, menuHint, soundButton, logo and patterns (before the scene objects). | `drawRungTile` `drawMasteryBar` `drawRackSelected` `menuHint` `soundButton` `drawLogo` |
| 2705-2781 | Menu scene | The range menu: gun rack, ladders, play, missions, endless, Prop Room. | `menu` `gauntletReason` |
| 2782-2883 | Missions scene | Badges and the gauntlet. | `missions` |
| 2884-2962 | Gun card scene | Stat rows and the gun card (stats, skins). | `STAT_ROWS` `gunCard` |
| 2963-3058 | Prop Room scene | Buying guns: propsLayout and the props scene. | `PROP_STATS` `propsLayout` `props` |
| 3059-3245 | Play scene | Input to the sim, fixed-step advance, render. | `play` |
| 3246-3369 | Over scene (wrap card) | REVIEWS lines and the wrap card. | `REVIEWS` `over` |
| 3370-3460 | TUNE panel | EXPERIMENTS, PRESETS, TUNE_KEYS and the tune scene. | `EXPERIMENTS` `PRESETS` `TUNE_KEYS` `tune` |
| 3461-3477 | Save migration helper | migrateGuns (moves old unlocks to bought guns). | `migrateGuns` |
| 3478-3535 | Game object (save, migrate, harness hooks) | slug, saveVersion, migrate, init, TUNING, experiments, presets, scenes. | `game` `migrate` |

## To change X, read Y

1. **Add or retune a gun.** Read `TUNING.guns` and `gunPrices`, `fire` (hit test, fan, damage), `buildGun` and `gunArt` for the look, `STAT_ROWS` and `props` for the card.
2. **Add or change a challenge.** Read `CHALLENGES`, `LADDERS`, `build`, the `spawn*` functions; star bars come from `BARS` (regenerate with the harness when the sim changes).
3. **Change target movement or hit rules.** Read `posAt`, `step`, `stepAccuracy`/`stepSpeed`/`stepSkeet`/`stepBoss`, `fire`; looks are `drawTargetFull` and friends.
4. **Change zombies.** Read `ZTYPES`, `spawnZombie`, `stepZombie`, `zombieWave`, `checkEnd`, then `drawZombie` and `drawFence`.
5. **Change save, economy or badges.** Read `stamp`, `BADGES`, `boxOf`, `gunUnlocked`, and `game` at the end (`saveVersion`, `migrate`, `migrateGuns`).
