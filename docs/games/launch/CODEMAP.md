# Launch code map

Line ranges are as of commit `919a10b` (2635 lines) and drift as `games/launch/src/game.js` changes. The anchors are the stable part: run `node tools/codemap-check.mjs` to warn when one disappears. Find a section by its anchor with `grep -n "NAME" games/launch/src/game.js`.

| Lines | Section | What lives there | Anchors |
| --- | --- | --- | --- |
| 1-18 | Header, imports | File comment (the whole design in one paragraph) and engine imports. |  |
| 19-308 | TUNING | Every tunable number: aim, gauge, flight, boost, glide, slam, objects, `upgradePrices`, `upgrades`, `birds`, `speedo`, palette, type, `juice`. | `TUNING` |
| 309-335 | Aliases and places | T, STEP, DEG; PLACES (the stretches of ground) and lookup helpers. | `T` `STEP` `PLACES` `placeFrom` `placeIndex` |
| 336-369 | Launch machine (aim and gauge) | ZONES, barrel angle (aimAngle), gauge reading (gaugeOf, gaugeAt, zoneOf), power, launchOf. | `ZONES` `aimAngle` `gaugeOf` `gaugeAt` `zoneOf` `powerOf` `launchOf` |
| 370-505 | Field | The seeded world: FIELD, makeField, ensureField, groundAt, surfaceH, slopeAt, birdX, geyserOn, inCloud. | `FIELD` `makeField` `ensureField` `groundAt` `surfaceH` `birdX` `geyserOn` `inCloud` |
| 506-821 | Flight (physics) | Run state and one fixed step: stats, newRun, queueInput, applyInput, airStep, slam, plainTouch, object hits, stepRun, advance, metres, coinsOf. | `stats` `newRun` `queueInput` `applyInput` `airStep` `slam` `plainTouch` `stepRun` `advance` `metres` `coinsOf` |
| 822-854 | Range finder | rangeArc: the predicted arc. | `rangeArc` |
| 855-892 | Goals | GOALS, activeGoals, settleGoals. | `GOALS` `activeGoals` `settleGoals` |
| 893-926 | Save shape and flight end | The save shape comment (v8) and finishFlight, which writes the results. | `finishFlight` |
| 927-1023 | Shop | UPGRADES, levelsOf, effectText, buy, and the shop scene. | `UPGRADES` `levelsOf` `effectText` `buy` `shop` |
| 1024-1092 | Camera | newCamera, cameraStep, toView, predictLanding. | `newCamera` `cameraStep` `toView` `predictLanding` |
| 1093-1736 | Drawing: world | Sky, motifs, drawWorld, arc, vents, hills, marsh, jelly, mud, geysers, clouds, birds, the mochi. | `skyAt` `drawWorld` `drawArc` `drawVent` `drawHill` `drawJelly` `drawMud` `drawGeyser` `drawBird` `drawMochi` |
| 1737-1914 | Drawing: machine and bakery | The Mochi Maker, gauge, barrel, bakery, daifuku, shopfront. | `drawMachine` `drawGauge` `drawBarrel` `drawBakery` `drawDaifuku` `shopfront` |
| 1915-1967 | Effects | emit, updateFx, drawFx (cosmetic particles and words). | `emit` `updateFx` `drawFx` |
| 1968-2019 | Sound | SFX table (engine synth only, through E.audio so mute holds). | `SFX` |
| 2020-2089 | HUD | pill, drawSpeedo, drawHud. | `pill` `drawSpeedo` `drawHud` |
| 2090-2151 | Scene helpers | newSeed, btn, the journey strip, place icons. | `newSeed` `btn` `JOURNEY` `journeyStrip` `drawJourney` `drawPlaceIcon` |
| 2152-2189 | Menu scene | Title, play, shop, mute. | `menu` |
| 2190-2478 | Play scene | Two-beat launch, gesture handling, per-frame advance, camera, render. | `play` `zoneText` `drawUpArrow` |
| 2479-2565 | Over scene | Result card: distance, goals, sugar, shop and retry. | `over` `fit` `goalRow` |
| 2566-2583 | Landscape wrapper | upright and landscapeOnly (scenes ask for landscape). | `upright` `landscapeOnly` |
| 2584-2635 | Game object (save, migrate, harness hooks) | slug, saveVersion, migrate, TUNING, experiments, presets, `sim` (read by tools/sim-launch.mjs), scenes. | `game` `migrate` |

## To change X, read Y

1. **Change how launch, boost, glide or slam feel.** Read the flight keys in `TUNING`, then `applyInput`, `airStep`, `slam`, `plainTouch`, `stepRun`. Check with `node tools/sim-launch.mjs --must`.
2. **Change what is in the world.** Read `FIELD`, `makeField`, `ensureField`; new objects also need a hit rule in Flight, a draw function in View, and a sound in `SFX`. Check with `--check`.
3. **Change the shop or upgrades.** Read `UPGRADES`, `levelsOf`, `effectText`, `buy`, `TUNING.upgrades` and `upgradePrices`, then the `shop` scene.
4. **Change the camera or HUD.** Read `cameraStep`, `toView`, `drawHud`, `drawSpeedo`.
5. **Change goals, places or the result card.** Read `GOALS`, `settleGoals`, `PLACES`, `finishFlight`, then the `over` scene; saved fields are in the Save comment and `game.migrate`.
