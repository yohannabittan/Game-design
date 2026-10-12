# Ink code map

Line ranges are as of the v0.8 review fix round (3003 lines) and drift as `games/ink/src/game.js` changes. The anchors are the stable part: run `node tools/codemap-check.mjs` to warn when one disappears. Find a section by its anchor with `grep -n "NAME" games/ink/src/game.js`.

| Lines | Section | What lives there | Anchors |
| --- | --- | --- | --- |
| 1-8 | Header, imports | File comment and engine imports. |  |
| 9-179 | TUNING | Every tunable number: needle speed and inertia, timer multipliers, star percents, `rankAt`, slip rules; `juice` (cosmetic) and `art` (palette, skin, machine, and the v0.7 `cast`, `reveal`, `open`, `rank`, `folio` blocks) are sub-objects. | `TUNING` |
| 180-366 | Aliases and stencil data | T, J, A aliases; circle and rect helpers; REMAP tables (save migration of old stencil order); STENCILS (31; plain data); prepStencil. | `T` `J` `A` `REMAP_TEN` `REMAP_INTERIM` `STENCILS` `prepStencil` |
| 367-453 | The cast (data) | v0.7: CLIENTS (name, face crop; v0.8 adds Ines, Arlo and Rita with stand-in hair), CAST (stencil name to client and line), PATCH (skin patch rectangle per portrait: centre, size, tilt), REACT lines, moodOf, RANKS, rankOf. v0.8: CAST_AT (the appended stencils #19 to #31, keyed by index), FINALE (index 30), the marked PACK16 block (art flags, `portraitFile`), PATCH2 (the second patch per portrait for earlier pieces), `earlierOf`. | `CLIENTS` `CAST` `CAST_AT` `FINALE` `PACK16` `PATCH` `PATCH2` `REACT` `moodOf` `castOf` `earlierOf` `RANKS` `rankOf` |
| 454-575 | Timers, daily, badges, skins | Perfect-path timers, the daily stencil (build and record), BADGES and earned/trick badge logic, SKINS and applySkins. | `perfectTime` `timerFor` `buildDaily` `dailyToday` `recordDaily` `BADGES` `earnedBadges` `trickBadges` `SKINS` `applySkins` |
| 576-635 | Geometry | Point-in-shape, nearest edge, and the coverage grid cache. | `pointInShape` `nearestEdge` `gridFor` |
| 636-664 | Play state and view | S (play scene state) and view (design space to screen). | `S` `view` |
| 665-718 | Gap hint | The optional hint that points at an uncovered gap. | `computeHint` `hintStep` `drawHint` |
| 719-844 | Juice and sound | Cosmetic only: fx state, ink spray, slip, part and finish effects with their E.audio calls, fxUpdate. | `newFx` `fxInk` `fxSlip` `fxFinish` `fxUpdate` |
| 845-1048 | Mechanic | The needle: attempt state, percent, starsFor, ink coverage (inkAt, checkDone), slips (landing, checkSlip), moveNeedle, holdStep, finish, liftFinger. | `newAttempt` `percent` `starsFor` `inkAt` `checkDone` `landing` `checkSlip` `moveNeedle` `holdStep` `finish` `liftFinger` |
| 1049-1328 | Drawing: helpers, body, skin | Path and colour helpers, text, the AC palette, BODY parts and their layers, skin grain and vignette. | `shapePath` `label` `AC` `BODY` `bodyLayer` `grainLayer` |
| 1329-1499 | Drawing: outline, ink, story | Stencil outline, the ink tiles and sync, blush, story decorations for the card. | `outlineFor` `outlineLayer` `inkTile` `syncInk` `blushLayer` `drawStory` |
| 1500-1629 | Drawing: the piece | Slip marks (drawMarks, shared with the reveal), then field, ink, story, outline and slips composed. | `drawMarks` `drawPiece` |
| 1630-1724 | Drawing: machine and glyphs | The tattoo machine, stars, lock, pin, plates and ink buttons. | `drawMachine` `drawStar` `drawLock` `drawPin` `plate` `inkButton` |
| 1725-1830 | Drawing: menu textures | Title image (loaded asset with a brush fallback), board layer, warm step. | `loadTitleImage` `drawTitle` `titleLayer` `boardLayer` `warmStep` |
| 1831-1876 | Save reads and ledger | progress (unlocks and bests), recordResult, the playtest ledger, hint setting. | `progress` `recordResult` `ledger` `presetName` `hintOn` |
| 1877-2082 | Menu scene | Stencil select, daily, hint toggle, rank name under the star count, Story button; plus drawPen, soundButton, hintButton, drawMedal. | `menu` `drawPen` `soundButton` `hintButton` |
| 2083-2179 | Missions scene | Portfolio button, badges and skins screen. | `missions` |
| 2180-2242 | Play HUD pieces | drawHud, drawIntro, drawCallout. | `drawHud` `drawIntro` `drawCallout` |
| 2243-2326 | Play scene | Pointer input to needle, fixed update, render order; `toCard` records the result and opens the `over` card. | `play` |
| 2327-2610 | Card helpers and over scene | Card box and view fitting, `clientLayout` (the client's card: portrait, tickets, tray, buttons), `ticketFit`, prepareCard; the result card `over`: the paper card (the daily, no client: stars, badge reveal, retry and next) and, for a client's stencil, `renderClient` (`drawZoom` the portrait zoom that stays as the hero, `drawTray` line, percent, stars, best, stamp, then the buttons); `go` shows the rank card first when a rank was earned. | `CV` `cardBoxFor` `clientLayout` `ticketFit` `prepareCard` `over` `renderClient` `drawZoom` `drawTray` |
| 2611-3003 | The cast on screen (v0.7) | Portrait loading with drawn fallbacks (`artImg`, `drawFace`, `drawPortrait`), `patchIn` and `stencilInPatch`, `drawEarlier` (earlier pieces in the second patch), the intro plate (`drawCast`), and the scenes `story` (cold open), `route` and `ritaCard` (Rita's two-beat card before the finale), `rank` (Rita), `folio` (Portfolio). Then the game object: slug, saveVersion 11, migrate (including the stencil remap, v10 `openSeen` / `rankSeen` and v11 `ritaSeen` / `shopYours`), init (a fresh save starts on `story`), TUNING, TUNE experiments, `sim`, scenes. | `artImg` `drawPortrait` `patchIn` `stencilInPatch` `drawEarlier` `drawCast` `story` `route` `ritaCard` `rank` `folio` `game` `migrate` |

## To change X, read Y

1. **Retune needle or ink feel.** Read the needle keys in `TUNING`, then `moveNeedle`, `holdStep`, `radiusFor`, `stepRadius` in the Mechanic section.
2. **Add or edit a stencil.** Read `STENCILS`, `prepStencil`, `timerFor` (timers use the perfect-path time measured by `node tools/sim-ink.mjs`). Reordering stencils needs a REMAP table and `migrate`.
3. **Change slip rules or penalties.** Read `landing`, `checkSlip`, `fxSlip`, and the slip keys in `TUNING`.
4. **Change stars, the end card or results.** Read `starsFor`, `finish`, `recordResult`, `prepareCard`, then the `over` scene (a client's stencil takes `renderClient`, the daily the paper card).
5. **Change the daily, badges or a saved field.** Read `buildDaily`, `recordDaily`, `BADGES`, `earnedBadges`, `progress`, and `game` at the end (`saveVersion`, `migrate`).
6. **Change a client, a line or a skin patch.** Read `CLIENTS`, `CAST`, `PATCH` (shares of the portrait; the last number tilts the piece with the limb), then `patchIn` and `drawZoom`. After editing a patch, redraw the 18-portrait screenshot sheet (`tools/drive.mjs`) and check the tattoo sits on skin.
7. **Change the client's result card (the zoom and what stays), the rank card or the Portfolio.** Read `art.reveal` (the client card's numbers), `art.rank`, `art.folio` in `TUNING`, then `clientLayout` and `over` (`renderClient`, `drawZoom`, `drawTray`), and the scenes `rank` and `folio` at the end of the file. The Portfolio redraws a perfect fill (the game keeps stars, not ink).
8. **Add Pack 16 art or a v0.8 stencil.** Paste stencil entries at the end of `STENCILS` in order (#19 to #31, so indices 18 to 30; `CAST_AT` already holds their clients and lines). When the Ines, Arlo or Rita webps land, follow the comment on the `PACK16` block (flags, measured `PATCH` / `PATCH2` / `face` rows) and the matching `PACK16` list in `sw.js`. The finale gate is `finaleOpen` in `progress`; Rita's card is `route` plus `ritaCard`; earlier pieces are `earlierOf` plus `drawEarlier` (used by `drawZoom` and the `folio` tiles).
