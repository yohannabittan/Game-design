# Checkpoint code map

Line ranges are as of the v0.4 build (2606 lines; v0.3 was 1843) and drift as `games/checkpoint/src/game.js` changes. The anchors are the stable part: run `node tools/codemap-check.mjs` to warn when one disappears. Find a section by its anchor with `grep -n "NAME" games/checkpoint/src/game.js`.

| Lines | Section | What lives there | Anchors |
| --- | --- | --- | --- |
| 1-14 | Header, imports | File comment (layout, bag and traveller flow, fixed-step shift clock, the v0.4 story layer) and engine imports. |  |
| 15-208 | TUNING | Every tunable number: belt speeds, scoring, SWAT, beeps, burst, opener, cast, lane, lever, `finale` (day 10's two fixed bags), `story` (scene lengths, bubble life, palette), palette, sprites, `juice`. | `TUNING` |
| 209-223 | Aliases and shape helpers | T, DEG and the shape constructors for item outlines. | `T` `DEG` `rect` `ell` `bar` `taper` `arc` `ring` `gear` `crimp` |
| 224-280 | Item table | O and ITEM_DATA: every item with shape, material and rules. | `O` `ITEM_DATA` |
| 281-310 | Body scan data | SILHOUETTE and BODY_DATA. | `SILHOUETTE` `BODY_DATA` |
| 311-392 | Geometry | Point and shape tests, outlines, scaling, ITEMS and BODY tables. | `inPoly` `shapeDist` `inShape` `outlinePoints` `scalePts` `ITEMS` `BODY` |
| 393-454 | Item pictures | PIC table, loader, paintPic. | `PIC` `loadPics` `paintPic` |
| 455-709 | Bag generation (seeded setup) | Packing a bag: commit, tryPlace, packRule, finalOk, `pinFinale` and `schedule` (day 10 pins Vic's and Pat's places), `castBag` (day 10's two fixed bags come from `TUNING.finale`), `castOf`, makeTravellers, genShift, visibility checks. The only place randomness is used. | `CHANS` `commit` `tryPlace` `packRule` `finalOk` `pinFinale` `schedule` `castBag` `castOf` `makeTravellers` `genShift` `visibility` |
| 710-760 | Play state and save reads | S, layout, cleanShifts, readShifts, cleanCareer, multiplier, rankOf. | `S` `layout` `cleanShifts` `readShifts` `cleanCareer` `multiplier` `rankOf` |
| 761-812 | Preparing a shift | prepare, pump, takeShift, startShift. | `prepare` `pump` `takeShift` `startShift` |
| 813-940 | Juice, sound and scoring events | burst, pop, tone, headline, endShift (writes the career save; the result carries `first`), strike, correct, bagDone (a cleared bag speaks), callSwat, catchItem, falseAlarm, missItem, passBag. | `burst` `pop` `tone` `headline` `endShift` `strike` `correct` `callSwat` `catchItem` `falseAlarm` `missItem` `passBag` |
| 941-1153 | The lane and the step | scanOn, stopTraveller, archExit, leaveLane, laneStep, step, tapAt, tapBelt, tapLane, pullLever. | `scanOn` `stopTraveller` `archExit` `leaveLane` `laneStep` `step` `tapAt` `tapBelt` `tapLane` `pullLever` |
| 1154-1401 | Drawing | Item paint, bag sprites, belt, bag (Pat's photo tag), scan, people (Pat's badge), travellers, speech. | `paintItem` `makeBagSprite` `drawBelt` `drawBag` `drawScan` `drawPerson` `drawTravellers` `speech` |
| 1402-1470 | Travellers speak (v0.4 D) | SAY pools, lineFor (Vic by day, Rose, Abernathy, Pat, ordinary), say, wrapText, bubble, drawBubbles. | `hash2` `SAY` `lineFor` `say` `wrapText` `bubble` `drawBubbles` |
| 1471-1587 | Drawing, continued | SWAT, officer, lever, hood, HUD, stamp. | `drawSwat` `officer` `drawLever` `drawHood` `drawHud` `drawStamp` |
| 1588-1695 | Play scene | Input to tapAt, fixed-step advance, bubble clock, render order. | `play` |
| 1696-1712 | Menu helpers | drawStar, button, shapesOf, bodyOf. | `drawStar` `button` `shapesOf` `bodyOf` |
| 1713-1763 | Menu scene | Day select; Sound, Story (replays the cold open, then the turn and ending once seen) and Departures buttons; "Supervisor" after the ending; starts the cold open on a first launch. | `menu` |
| 1764-1843 | Brief scene | The morning card: flight, rank, Pat's line (portrait, sticky note on day 5, empty chair on day 9), what is new, the desk; plays the day 8 turn once. | `patBlock` `brief` |
| 1844-1968 | Over scene | `photo`, the plane strip, Pat's row (her line, or the gift on a first clear), score, stars, Continue (the ending), Departures, Next, Retry. | `photo` `planeStrip` `patRow` `over` |
| 1969-2528 | Story (v0.4) | Art loader and drawn stand-ins (`loadArt`, `drawArt`, `patFace`), the words (`FLIGHTS`, `BRIEF`, `DESK`, `PAT_END`, `patLine`), drawn props (desk objects, lanyard, photo, passenger list, radio), the scene toolkit, the ten scenes, `CHAPTERS`, the `story` player and the departures `board`. | `ART` `loadArt` `drawArt` `patFace` `FLIGHTS` `BRIEF` `DESK` `deskDays` `patLine` `drawDeskStrip` `CHAPTERS` `story` `board` `sceneDawn` `sceneMug` |
| 2529-2606 | Game object (save, migrate, harness hooks) | slug, saveVersion 5, migrate (openSeen, turnSeen, endSeen), TUNING, experiments, presets, scenes, `sim` (read by tools/sim-checkpoint.mjs). | `game` `migrate` |

## To change X, read Y

1. **Add or change an item.** Read `ITEM_DATA`, `ITEMS`, the shape constructors, `packRule`, and `paintItem` for its look.
2. **Change bag generation or difficulty.** Read `schedule`, `castBag`, `genShift`, `makeTravellers` and the `cast` and `opener` keys in `TUNING`; check with `node tools/sim-checkpoint.mjs`.
3. **Change scoring or penalties.** Read `strike`, `correct`, `catchItem`, `missItem`, `falseAlarm`, `scoreMult`, `endShift`.
4. **Change traveller, scan or lane behaviour.** Read `laneStep`, `stopTraveller`, `archExit`, `scanOn`, `tapLane`, `pullLever`.
5. **Change the career, ranks or a saved field.** Read `readShifts`, `cleanCareer`, `multiplier`, `rankOf`, `endShift`, and `game` at the end (`saveVersion`, `migrate`).
6. **Change the story.** Words live in `STORY`-style tables (`CHAPTERS`, `BRIEF`, `DESK`, `PAT_END`, `SAY`); each scene is a `scene*` function of its time `t`; Pat's pictures are drawn by `drawArt` with a drawn stand-in. Day 10's two fixed bags are in `TUNING.finale`; read `pinFinale`, `castBag`, `castOf`.
