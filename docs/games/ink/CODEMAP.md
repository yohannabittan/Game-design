# Ink code map

Line ranges are as of the v0.7 build on `cb6193e` (2747 lines) and drift as `games/ink/src/game.js` changes. The anchors are the stable part: run `node tools/codemap-check.mjs` to warn when one disappears. Find a section by its anchor with `grep -n "NAME" games/ink/src/game.js`.

| Lines | Section | What lives there | Anchors |
| --- | --- | --- | --- |
| 1-8 | Header, imports | File comment and engine imports. |  |
| 9-175 | TUNING | Every tunable number: needle speed and inertia, timer multipliers, star percents, `rankAt`, slip rules; `juice` (cosmetic) and `art` (palette, skin, machine, and the v0.7 `cast`, `reveal`, `open`, `rank`, `folio` blocks) are sub-objects. | `TUNING` |
| 176-294 | Aliases and stencil data | T, J, A aliases; circle and rect helpers; REMAP tables (save migration of old stencil order); STENCILS (18, plain data); prepStencil. | `T` `J` `A` `REMAP_TEN` `REMAP_INTERIM` `STENCILS` `prepStencil` |
| 295-330 | The cast (data) | v0.7: CLIENTS (name, face crop), CAST (stencil name to client and line), PATCH (skin patch rectangle per portrait: centre, size, tilt), REACT lines, moodOf, RANKS, rankOf. | `CLIENTS` `CAST` `PATCH` `REACT` `moodOf` `castOf` `RANKS` `rankOf` |
| 331-455 | Timers, daily, badges, skins | Perfect-path timers, the daily stencil (build and record), BADGES and earned/trick badge logic, SKINS and applySkins. | `perfectTime` `timerFor` `buildDaily` `dailyToday` `recordDaily` `BADGES` `earnedBadges` `trickBadges` `SKINS` `applySkins` |
| 456-515 | Geometry | Point-in-shape, nearest edge, and the coverage grid cache. | `pointInShape` `nearestEdge` `gridFor` |
| 516-527 | Play state and view | S (play scene state) and view (design space to screen). | `S` `view` |
| 528-586 | Gap hint | The optional hint that points at an uncovered gap. | `computeHint` `hintStep` `drawHint` |
| 587-715 | Juice and sound | Cosmetic only: fx state, ink spray, slip, part and finish effects with their E.audio calls, fxUpdate. | `newFx` `fxInk` `fxSlip` `fxFinish` `fxUpdate` |
| 716-918 | Mechanic | The needle: attempt state, percent, starsFor, ink coverage (inkAt, checkDone), slips (landing, checkSlip), moveNeedle, holdStep, finish, liftFinger. | `newAttempt` `percent` `starsFor` `inkAt` `checkDone` `landing` `checkSlip` `moveNeedle` `holdStep` `finish` `liftFinger` |
| 919-1162 | Drawing: helpers, body, skin | Path and colour helpers, text, the AC palette, BODY parts and their layers, skin grain and vignette. | `shapePath` `label` `AC` `BODY` `bodyLayer` `grainLayer` |
| 1163-1371 | Drawing: outline, ink, story | Stencil outline, the ink tiles and sync, blush, story decorations for the card. | `outlineFor` `outlineLayer` `inkTile` `syncInk` `blushLayer` `drawStory` |
| 1372-1451 | Drawing: the piece | Slip marks (drawMarks, shared with the reveal), then field, ink, story, outline and slips composed. | `drawMarks` `drawPiece` |
| 1452-1594 | Drawing: machine and glyphs | The tattoo machine, stars, lock, pin, plates and ink buttons. | `drawMachine` `drawStar` `drawLock` `drawPin` `plate` `inkButton` |
| 1595-1698 | Drawing: menu textures | Title image (loaded asset with a brush fallback), board layer, warm step. | `loadTitleImage` `drawTitle` `titleLayer` `boardLayer` `warmStep` |
| 1699-1743 | Save reads and ledger | progress (unlocks and bests), recordResult, the playtest ledger, hint setting. | `progress` `recordResult` `ledger` `presetName` `hintOn` |
| 1744-1948 | Menu scene | Stencil select, daily, hint toggle, rank name under the star count, Story button; plus drawPen, soundButton, hintButton, drawMedal. | `menu` `drawPen` `soundButton` `hintButton` |
| 1949-2045 | Missions scene | Portfolio button, badges and skins screen. | `missions` |
| 2046-2108 | Play HUD pieces | drawHud, drawIntro, drawCallout. | `drawHud` `drawIntro` `drawCallout` |
| 2109-2191 | Play scene | Pointer input to needle, fixed update, render order; `toCard` sends a client's piece to the reveal first. | `play` |
| 2192-2359 | Card helpers and over scene | Card box and view fitting, prepareCard; the tattoo card (stars, badge reveal, retry and next; `go` shows the rank card first when a rank was earned). | `CV` `cardBoxFor` `prepareCard` `over` |
| 2360-2747 | The cast on screen (v0.7) | Portrait loading with drawn fallbacks (`artImg`, `drawFace`, `drawPortrait`), `patchIn` and `stencilInPatch`, the intro plate (`drawCast`), and the scenes `story` (cold open), `reveal`, `rank` (Rita), `folio` (Portfolio). Then the game object: slug, saveVersion 10, migrate (including the stencil remap and v10 `openSeen` / `rankSeen`), init (a fresh save starts on `story`), TUNING, TUNE experiments, `sim`, scenes. | `artImg` `drawPortrait` `patchIn` `stencilInPatch` `drawCast` `story` `reveal` `rank` `folio` `game` `migrate` |

## To change X, read Y

1. **Retune needle or ink feel.** Read the needle keys in `TUNING`, then `moveNeedle`, `holdStep`, `radiusFor`, `stepRadius` in the Mechanic section.
2. **Add or edit a stencil.** Read `STENCILS`, `prepStencil`, `timerFor` (timers use the perfect-path time measured by `node tools/sim-ink.mjs`). Reordering stencils needs a REMAP table and `migrate`.
3. **Change slip rules or penalties.** Read `landing`, `checkSlip`, `fxSlip`, and the slip keys in `TUNING`.
4. **Change stars, the end card or results.** Read `starsFor`, `finish`, `recordResult`, `prepareCard`, then the `over` scene.
5. **Change the daily, badges or a saved field.** Read `buildDaily`, `recordDaily`, `BADGES`, `earnedBadges`, `progress`, and `game` at the end (`saveVersion`, `migrate`).
6. **Change a client, a line or a skin patch.** Read `CLIENTS`, `CAST`, `PATCH` (shares of the portrait; the last number tilts the piece with the limb), then `patchIn` and `reveal`. After editing a patch, redraw the 18-portrait screenshot sheet (`tools/drive.mjs`) and check the tattoo sits on skin.
7. **Change the reveal, the rank card or the Portfolio.** Read `art.reveal`, `art.rank`, `art.folio` in `TUNING`, then the scenes `reveal`, `rank` and `folio` at the end of the file. The Portfolio redraws a perfect fill (the game keeps stars, not ink).
