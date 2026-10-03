# Checkpoint code map

Line ranges are as of commit `919a10b` (1775 lines) and drift as `games/checkpoint/src/game.js` changes. The anchors are the stable part: run `node tools/codemap-check.mjs` to warn when one disappears. Find a section by its anchor with `grep -n "NAME" games/checkpoint/src/game.js`.

| Lines | Section | What lives there | Anchors |
| --- | --- | --- | --- |
| 1-12 | Header, imports | File comment (layout, bag and traveller flow, fixed-step shift clock) and engine imports. |  |
| 13-188 | TUNING | Every tunable number: belt speeds, scoring, SWAT, beeps, burst, opener, cast, lane, lever, palette, sprites, `juice`. | `TUNING` |
| 189-203 | Aliases and shape helpers | T, DEG and the shape constructors for item outlines (rect, ell, bar, taper, arc, ring, gear, crimp). | `T` `DEG` `rect` `ell` `bar` `taper` `arc` `ring` `gear` `crimp` |
| 204-260 | Item table | O and ITEM_DATA: every item with shape, material and rules. | `O` `ITEM_DATA` |
| 261-290 | Body scan data | SILHOUETTE and BODY_DATA. | `SILHOUETTE` `BODY_DATA` |
| 291-372 | Geometry | Point and shape tests, outlines, scaling, ITEMS and BODY tables, xform, instance. | `inPoly` `shapeDist` `inShape` `outlinePoints` `scalePts` `ITEMS` `BODY` |
| 373-609 | Bag generation (seeded setup) | Packing a bag: CHANS, commit, tryPlace, packRule, finalOk, schedule, castBag, makeTravellers, genShift, visibility checks. The only place randomness is used. | `CHANS` `commit` `tryPlace` `packRule` `finalOk` `schedule` `castBag` `makeTravellers` `genShift` `visibility` `xform` `instance` |
| 610-660 | Play state and save reads | S, layout, and the save readers and cleaners: cleanShifts, readShifts, cleanCareer, multiplier, rankOf. | `S` `layout` `cleanShifts` `readShifts` `cleanCareer` `multiplier` `rankOf` |
| 661-712 | Preparing a shift | prepare, pump, takeShift, startShift (generation while a card is on screen). | `prepare` `pump` `takeShift` `startShift` |
| 713-838 | Juice, sound and scoring events | burst, pop, tone, headline, endShift (writes the career save), strike, correct, callSwat, catchItem, falseAlarm, missItem, passBag. | `burst` `pop` `tone` `headline` `endShift` `strike` `correct` `callSwat` `catchItem` `falseAlarm` `missItem` `passBag` |
| 839-1047 | The lane and the step | scanOn, stopTraveller, archExit, leaveLane, laneStep, step (fixed step), tapAt, tapBelt, tapLane, pullLever. | `scanOn` `stopTraveller` `archExit` `leaveLane` `laneStep` `step` `tapAt` `tapBelt` `tapLane` `pullLever` |
| 1048-1409 | Drawing | Item paint, bag sprites, belt, bag, scan, people, travellers, SWAT, lever, hood, HUD, stamp. | `paintItem` `makeBagSprite` `drawBelt` `drawBag` `drawScan` `drawPerson` `drawTravellers` `drawSwat` `drawLever` `drawHud` `drawStamp` |
| 1410-1515 | Play scene | Input to tapAt, fixed-step advance, render order. | `play` |
| 1516-1532 | Menu helpers | drawStar, button, shapesOf, bodyOf. | `drawStar` `button` `shapesOf` `bodyOf` |
| 1533-1574 | Menu scene | Day select, mute. | `menu` |
| 1575-1651 | Brief scene | The morning briefing card shown before a shift (with photo helper). | `brief` `photo` |
| 1652-1707 | Over scene | Shift result: score, stars, rank, next. | `over` |
| 1708-1775 | Game object (save, migrate, harness hooks) | slug, saveVersion, migrate, TUNING, experiments, presets, scenes, `sim` (read by tools/sim-checkpoint.mjs). | `game` `migrate` |

## To change X, read Y

1. **Add or change an item.** Read `ITEM_DATA`, `ITEMS`, the shape constructors, `packRule`, and `paintItem` for its look.
2. **Change bag generation or difficulty.** Read `schedule`, `castBag`, `genShift`, `makeTravellers` and the `cast` and `opener` keys in `TUNING`; check with `node tools/sim-checkpoint.mjs`.
3. **Change scoring or penalties.** Read `strike`, `correct`, `catchItem`, `missItem`, `falseAlarm`, `scoreMult`, `endShift`.
4. **Change traveller, scan or lane behaviour.** Read `laneStep`, `stopTraveller`, `archExit`, `scanOn`, `tapLane`, `pullLever`.
5. **Change the career, ranks or a saved field.** Read `readShifts`, `cleanCareer`, `multiplier`, `rankOf`, `endShift`, and `game` at the end (`saveVersion`, `migrate`).
