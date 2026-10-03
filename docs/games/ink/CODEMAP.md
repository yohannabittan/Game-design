# Ink code map

Line ranges are as of commit `919a10b` (2374 lines) and drift as `games/ink/src/game.js` changes. The anchors are the stable part: run `node tools/codemap-check.mjs` to warn when one disappears. Find a section by its anchor with `grep -n "NAME" games/ink/src/game.js`.

| Lines | Section | What lives there | Anchors |
| --- | --- | --- | --- |
| 1-8 | Header, imports | File comment and engine imports. |  |
| 9-169 | TUNING | Every tunable number: needle speed and inertia, timer multipliers, star percents, slip rules; `juice` (cosmetic) and `art` (palette, skin, machine) are sub-objects. | `TUNING` |
| 170-288 | Aliases and stencil data | T, J, A aliases; circle and rect helpers; REMAP tables (save migration of old stencil order); STENCILS (15, plain data); prepStencil. | `T` `J` `A` `REMAP_TEN` `REMAP_INTERIM` `STENCILS` `prepStencil` |
| 289-413 | Timers, daily, badges, skins | Perfect-path timers, the daily stencil (build and record), BADGES and earned/trick badge logic, SKINS and applySkins. | `perfectTime` `timerFor` `buildDaily` `dailyToday` `recordDaily` `BADGES` `earnedBadges` `trickBadges` `SKINS` `applySkins` |
| 414-473 | Geometry | Point-in-shape, nearest edge, and the coverage grid cache. | `pointInShape` `nearestEdge` `gridFor` |
| 474-485 | Play state and view | S (play scene state) and view (design space to screen). | `S` `view` |
| 486-544 | Gap hint | The optional hint that points at an uncovered gap. | `computeHint` `hintStep` `drawHint` |
| 545-674 | Juice and sound | Cosmetic only: fx state, ink spray, slip, part and finish effects with their E.audio calls, fxUpdate. | `newFx` `fxInk` `fxSlip` `fxFinish` `fxUpdate` |
| 675-876 | Mechanic | The needle: attempt state, percent, starsFor, ink coverage (inkAt, checkDone), slips (landing, checkSlip), moveNeedle, holdStep, finish, liftFinger. | `newAttempt` `percent` `starsFor` `inkAt` `checkDone` `landing` `checkSlip` `moveNeedle` `holdStep` `finish` `liftFinger` |
| 877-1120 | Drawing: helpers, body, skin | Path and colour helpers, text, the AC palette, BODY parts and their layers, skin grain and vignette. | `shapePath` `label` `AC` `BODY` `bodyLayer` `grainLayer` |
| 1121-1328 | Drawing: outline, ink, story | Stencil outline, the ink tiles and sync, blush, story decorations for the card. | `outlineFor` `outlineLayer` `inkTile` `syncInk` `blushLayer` `drawStory` |
| 1329-1404 | Drawing: the piece | Field, ink, story, outline and slips composed. | `drawPiece` |
| 1405-1547 | Drawing: machine and glyphs | The tattoo machine, stars, lock, pin, plates and ink buttons. | `drawMachine` `drawStar` `drawLock` `drawPin` `plate` `inkButton` |
| 1548-1651 | Drawing: menu textures | Title image (loaded asset with a brush fallback), board layer, warm step. | `loadTitleImage` `drawTitle` `titleLayer` `boardLayer` `warmStep` |
| 1652-1696 | Save reads and ledger | progress (unlocks and bests), recordResult, the playtest ledger, hint setting. | `progress` `recordResult` `ledger` `presetName` `hintOn` |
| 1697-1898 | Menu scene | Stencil select, daily, hint toggle, plus drawPen, soundButton, hintButton, drawMedal. | `menu` `drawPen` `soundButton` `hintButton` |
| 1899-1991 | Missions scene | Badges and skins screen. | `missions` |
| 1992-2054 | Play HUD pieces | drawHud, drawIntro, drawCallout. | `drawHud` `drawIntro` `drawCallout` |
| 2055-2135 | Play scene | Pointer input to needle, fixed update, render order. | `play` |
| 2136-2164 | Card helpers | Card box and view fitting, prepareCard. | `CV` `cardBoxFor` `prepareCard` |
| 2165-2301 | Over scene | The tattoo card: stars, badge reveal, retry and next. | `over` |
| 2302-2374 | Game object (save, migrate, harness hooks) | slug, saveVersion, migrate (including the stencil remap), init, TUNING, experiments and presets (TUNE), `sim` (read by tools/sim-ink.mjs), scenes. | `game` `migrate` |

## To change X, read Y

1. **Retune needle or ink feel.** Read the needle keys in `TUNING`, then `moveNeedle`, `holdStep`, `radiusFor`, `stepRadius` in the Mechanic section.
2. **Add or edit a stencil.** Read `STENCILS`, `prepStencil`, `timerFor` (timers use the perfect-path time measured by `node tools/sim-ink.mjs`). Reordering stencils needs a REMAP table and `migrate`.
3. **Change slip rules or penalties.** Read `landing`, `checkSlip`, `fxSlip`, and the slip keys in `TUNING`.
4. **Change stars, the end card or results.** Read `starsFor`, `finish`, `recordResult`, `prepareCard`, then the `over` scene.
5. **Change the daily, badges or a saved field.** Read `buildDaily`, `recordDaily`, `BADGES`, `earnedBadges`, `progress`, and `game` at the end (`saveVersion`, `migrate`).
