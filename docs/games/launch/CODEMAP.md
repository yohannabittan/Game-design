# Launch code map

Line ranges are as of the v0.6 build (3082 lines, cache launch-v16; v0.5 was 2784, earlier commit `919a10b` was 2635) and drift as `games/launch/src/game.js` changes. The anchors are the stable part: run `node tools/codemap-check.mjs` to warn when one disappears. Find a section by its anchor with `grep -n "NAME" games/launch/src/game.js`.

| Lines | Section | What lives there | Anchors |
| --- | --- | --- | --- |
| 1-18 | Header, imports | File comment (the whole design in one paragraph) and engine imports. |  |
| 19-313 | TUNING | Every tunable number: aim, gauge, flight, boost, glide, slam, objects, `upgradePrices`, `upgrades`, `birds`, `speedo`, palette, type, `juice`, `story` (scene lengths, autoGap, story version). | `TUNING` |
| 314-340 | Aliases and places | T, STEP, DEG; PLACES (the stretches of ground; the last is Tea Party) and lookup helpers. | `T` `STEP` `PLACES` `placeFrom` `placeIndex` |
| 341-374 | Launch machine (aim and gauge) | ZONES, barrel angle (aimAngle), gauge reading (gaugeOf, gaugeAt, zoneOf), power, launchOf. | `ZONES` `aimAngle` `gaugeOf` `gaugeAt` `zoneOf` `powerOf` `launchOf` |
| 375-510 | Field | The seeded world: FIELD, makeField, ensureField, groundAt, surfaceH, slopeAt, birdX, geyserOn, inCloud. | `FIELD` `makeField` `ensureField` `groundAt` `surfaceH` `birdX` `geyserOn` `inCloud` |
| 511-826 | Flight (physics) | Run state and one fixed step: stats, newRun, queueInput, applyInput, airStep, slam, plainTouch, object hits, stepRun, advance, metres, coinsOf. | `stats` `newRun` `queueInput` `applyInput` `airStep` `slam` `plainTouch` `stepRun` `advance` `metres` `coinsOf` |
| 827-859 | Range finder | rangeArc: the predicted arc. | `rangeArc` |
| 860-897 | Goals | GOALS, activeGoals, settleGoals. | `GOALS` `activeGoals` `settleGoals` |
| 898-935 | Save shape and flight end | The save shape comment (v10) and finishFlight, which writes the results. | `finishFlight` |
| 936-1032 | Shop | UPGRADES, levelsOf, effectText, buy, and the shop scene. | `UPGRADES` `levelsOf` `effectText` `buy` `shop` |
| 1033-1101 | Camera | newCamera, cameraStep, toView, predictLanding. | `newCamera` `cameraStep` `toView` `predictLanding` |
| 1102-1739 | Drawing: world | Sky, motifs, drawWorld, arc, vents, hills, marsh, jelly, mud, geysers, clouds, birds, the mochi. | `skyAt` `drawWorld` `drawArc` `drawVent` `drawHill` `drawJelly` `drawMud` `drawGeyser` `drawBird` `drawMochi` |
| 1740-1923 | Drawing: machine and bakery | The Mochi Maker, gauge, barrel, bakery, daifuku, shopfront. | `drawMachine` `drawGauge` `drawBarrel` `drawBakery` `drawDaifuku` `shopfront` |
| 1924-1976 | Effects | emit, updateFx, drawFx (cosmetic particles and words). | `emit` `updateFx` `drawFx` |
| 1977-2029 | Sound | SFX table (engine synth only, through E.audio so mute holds). | `SFX` |
| 2030-2099 | HUD | pill, drawSpeedo, drawHud. | `pill` `drawSpeedo` `drawHud` |
| 2100-2178 | Scene helpers | newSeed, btn, the journey strip (Daifuku rides after the proposal), place icons, the gift box. | `newSeed` `btn` `JOURNEY` `journeyStrip` `drawJourney` `drawPlaceIcon` `drawGiftBox` |
| 2179-2221 | Menu scene | Title, play, shop, mute, story (replays the cold open), gift box, Daifuku beside the machine once proposed. | `menu` |
| 2222-2512 | Play scene | Two-beat launch, gesture handling, per-frame advance, camera, render; the gift banners and the proposal trigger (`S.propose`) are in `onEvent`'s milestone branch. | `play` `zoneText` `drawUpArrow` |
| 2513-2612 | Over scene | Result card: distance, Mochi's portrait and rehearsal line (honeymoon pool after the proposal), Daifuku's window inset, goals, sugar, shop and retry. | `over` `fit` `goalRow` |
| 2613-2998 | Story (v0.6) | Pack 5 webp loader and procedural fallbacks (`loadArt`, `drawArt`), the texts (`STORY`, `PROPOSAL`, `GIFTS`, `SAY`, `HONEYMOON`, `WINDOW_SAY`), the scene toolkit (`pic`, `hopOf`, `sparkle`, `burst`, window frame), the four cold-open scenes, the four proposal scenes, `cardsScene` (the shared player), `story` and `proposal`. | `ART_FILES` `loadArt` `drawArt` `STORY` `PROPOSAL` `GIFTS` `SAY` `HONEYMOON` `cardsScene` `story` `proposal` |
| 2999-3016 | Landscape wrapper | upright and landscapeOnly (scenes ask for landscape). | `upright` `landscapeOnly` |
| 3017-3082 | Game object (save, migrate, harness hooks) | slug, saveVersion, migrate, TUNING, experiments, presets, `sim` (read by tools/sim-launch.mjs), scenes. | `game` `migrate` |

## To change X, read Y

1. **Change how launch, boost, glide or slam feel.** Read the flight keys in `TUNING`, then `applyInput`, `airStep`, `slam`, `plainTouch`, `stepRun`. Check with `node tools/sim-launch.mjs --must`.
2. **Change what is in the world.** Read `FIELD`, `makeField`, `ensureField`; new objects also need a hit rule in Flight, a draw function in View, and a sound in `SFX`. Check with `--check`.
3. **Change the shop or upgrades.** Read `UPGRADES`, `levelsOf`, `effectText`, `buy`, `TUNING.upgrades` and `upgradePrices`, then the `shop` scene.
4. **Change the camera or HUD.** Read `cameraStep`, `toView`, `drawHud`, `drawSpeedo`.
5. **Change goals, places or the result card.** Read `GOALS`, `settleGoals`, `PLACES`, `finishFlight`, then the `over` scene; saved fields are in the Save comment and `game.migrate`.
