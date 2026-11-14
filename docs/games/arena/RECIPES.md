# Arena recipes

For the common kinds of change, the places to touch, by name. Find a name with `node tools/codemap.mjs arena --where <name>`. Every name below was found that way, except the two `sw.js` constants. A step marked "not verified" was not worked out from the history.

## 1. Add a card to the deck

1. `DECK`: one entry: `id`, `fam`, `tier`, `slot` and `gear` (the piece it paints; a duo has none), `name`, `short` (six words), `line`, and `needs` or `bans`. Its initials and the icon come from the name and `fam`.
2. `CARD_NUMS`: one entry with the exact numbers behind the line. `cardNums` has no fallback, so a card without one breaks its "?" page.
3. `cards` (in `TUNING`): the number or numbers, never inline.
4. `HOOKS`: a block keyed by id, for an effect that fires on an event (`slot`, `hit`, `block`, `perfect`, `dodge`, `feint`, `read`, `fell`, `tick`, `break`, `lame`, `over`, `start`; fired by `emit`). A rule that changes how a blow resolves is read at the spot with `has('<id>')` instead.
5. `drawIcon` and `famGlyph`: only for a new family; add it to `FAMS` too.
6. `BEAST_LINE` and `ARMOUR_CARDS`: only if the rule does nothing against a beast.
7. A card with a `gear` also needs a painted piece: recipe 9.

Check: in a script, `applyCard(CARD.<id>)`, then fire the event with `emit` and read `state`; shoot the draft with `openDraft`.
Watch out: all 73 cards have a `CARD_NUMS` entry; keep it so.

## 2. Add a weapon

1. `me` (in `TUNING`): its row in your weapon table (reach, speed, dmg, slot, len, next to `trident` and `sica`) and its entry in the weapon wheel. The wheel's order is the saved index, so `none` and `fist` stay last.
2. `weapons` (in `TUNING`): his row (range, strike, speed, moves, shield, wear). `rollFighter` and `makeFoe` read it. A weapon only you carry has no row here.
3. `strike`: the rows that strike, for a jab and a swing, in pixels of its painting; `edges` too. Then `STRIKE_WORDS`.
4. `kit`: its `weapon` pins (size, x, pin, tip, blade, hw, edges, clip). The painting is `weaponArt` and the file is recipe 9.
5. `purse`: its price under `weapon`; `purseCost` adds it up and `drawPurse` shows it on the rack. A ludus unlock also needs `LUDUS` and `LUDUS_LOCK`.
6. `drawSwordArm`, `paintWeapon`: only for a special shape (the trident's prongs, the spear's shaft).
7. A sidearm for foes: `sidearm` (in `TUNING`) `foe.carry`; `foeSidearm` does the swap. His use beyond the tables: not verified.

Check: a frame of the purse and of a bout at 667x375 and 844x390 (recipe 11); `tools/perf.mjs` only if the drawing is heavy.
Watch out: `strike` rows and `kit` pins both count in painting pixels and must agree with the same file.

## 3. Add a one-time hint or a Brutus line

1. A hint: a new branch in `updateHints`, as the last `else if`. It sets its save key first (`E.save.set`) so it shows once ever, then `state.hintT` and `state.hintS` (eight words at most).
2. `hint` (in `TUNING`): its duration, next to `heartDur` and `driveDur`.
3. `drawHint` and `rightHints` draw it; no change unless it needs another spot.
4. A Brutus line by reason: `BRUTUS` (three lines each; the numbers pick which is said when). By background: `BRUTUS_BG`. A promise's climb: `PROMISE_WON`. Per arena: the `brutus` field in `ARENAS`. His choice before a bout: `brutusIntro`.
5. A line inside a screen is a plain string in its drawing: `drawPurse`, `drawTent`, `drawBandage`.

Check: open with a fresh save (the fresh save in recipe 11); a veteran save has every hint key set, so it never shows.

## 4. Add a field to the playtest export

1. `newRound`: the counter's starting value, in the big `Object.assign(state, ...)`.
2. Count it where the thing happens (state.<name>++).
3. `RUN_KEYS`: add the key, or the count is lost when a run resumes.
4. `play`, the block that ends a run: add it to the `E.ledger.add('result', ...)` row. A long string goes through a field cap like `yardFields`.

Check: finish a run in a script and read the last `result` in `E.ledger.entries`.
Watch out: step 23b added fields to `RUN_KEYS` with no `saveVersion` bump, because `resumeRun` only copies keys the saved run has. Bump only if old runs need a changed value (recipe 10).

## 5. Add something to buy (purse, tent, bandage stall)

1. The tent: a row in `WARES` (`big` or small), its price in `tent` (in `TUNING`, `price`), its effect in `buyWare`, its icon in `drawWare`. A small ware is read with `has(<id>)`, and its number lives in `cards`.
2. `openTent` picks the three wares; `drawTent` lays them out; the taps are in `play`.
3. The bandage stall: `buyBandage`, `drawBandage`, `bandageDue` (it skips the stall when nothing can be bought).
4. The purse: `purse` (in `TUNING`) prices, `purseCost` and `purseOf` add them up, `drawPurse` draws it, `roll` takes the taps and starts the bout. What you buy reaches the run through `newRound`'s caller in `play`.
5. A thing sold in all three places (knives): `knifeRow` draws the row and `knifeBuy` buys it; `knives` (in `TUNING`) holds price and max.

Check: open the screen in a script with gold set in `state`, tap the item, read `state.gold` and the effect.
Watch out: the purse's price total and the run's carried count (the knives) are two places; keep `purseCost` in step with `play`'s start.

## 6. Add a step to the training yard

1. `YARD`: a row (`id`, `line`, `ghost`, `got`, `need`; `want` for a sword stroke), before `go`.
2. `train` (in `TUNING`): its counts and timings.
3. `startYard`: the new counter on the `train` object. `nextYard`: reset it when the step starts.
4. A sword step: `yardStrokes` and `yardLand` count it; its ghost path is `ghostPath`.
5. A step where he swings: add its id to the list in `updateYard`, and to `yardBlow` and `yardOutcome` (the blow's height is `YARD_BLOW`).
6. `drawYard`: which button the ghost thumb touches. A new "why it didn't count" word goes in `WHY` and `yardMiss`.

Check: the yard helper in recipe 11 puts a fresh save at your step; read `train.log`.
Watch out: `yardEntry` writes each step into the export string; a long yard runs on into `yard2` (`yardFields`).

## 7. Add a button to the fight's HUD

1. Layout: `armsBtns` (the round buttons, bottom right; `armsLive` says when they show). A new one stacks above the others.
2. `armsW`: the room taken from the hints. `rightHints` and `finBtn` use it, so a wider stack must be counted here.
3. Touch: `armsTouch` (routing by `onRound`). In `play`'s pointer-down it runs after `finTouch` and before the sword thumb; a touch that starts in the left third is the shield thumb.
4. Drawing: `drawArmsBtns`; called from `play`'s render after `drawFinBtn`.
5. The first-use lesson, if any: a `lessonDue` style check and a hint (recipe 3). Not verified.

Check: shoot at 667x375 and 844x390 with the thumb's hand down; tap it with the pointer helper (recipe 11) and read `state`.
Watch out: the 44 px target is `onRound` plus `finBtn.reach`; the yard and the lab hide these buttons on purpose.

## 8. Add a champion's signature move

1. `champs` (in `TUNING`): an entry keyed by his first name or `ck`, with `sig`, `every`, `chance`, `sure` and its own numbers. `sigFx` holds the shared show.
2. `NEW_CHAMPS`: the champion himself (a later one); a Pit champion is in `CHAMPIONS`. `ARENAS` lists him in `champs` or `pools`.
3. `SIG_NAME` and `SIG_TITLE`: the banner and the card's "Signature:" line (`watchSegs`).
4. `buildSig`: a branch that builds his blows. `plansEarly` if he strikes from where he stands.
5. `sigStart`: its sound and flash. `sigRead` shows READ! for an answer.
6. What counts as answered: `resolveOne` (a block) and `endBlow` (opens him). The pose: `poseFoe`; footwork: `stepFoe`.

Check: a script starts the bout with him (set `state.rack`, then `newRack`) and reads `state.specials`; shoot the tell.
Watch out: his painting `champ-<key>` is recipe 9.

## 9. Add a painted asset

1. The final goes in `docs/art/final/arena/`, and a `.webp` copy in `games/arena/assets/` (3x its largest size on screen, quality 85).
2. `SHIPPED`: add the name (it needs its file and an `sw.js` entry, says the comment above it).
3. `WORN`: a head piece or helmet ships as `<name>-worn.webp`, so list it here too.
4. `kit` (in `TUNING`), `gear`: the pins under `gear-<name>`. Weapons are under `weapon`, limbs under `half` and `crop`.
5. `sw.js`: the file in `ART`, and bump `CACHE_VERSION`. These two are not in the index (`sw.js` is not indexed).
6. `ART_NAMES`: a plain name for the ART tab; optional.

Check: `node tools/drive.mjs arena --shot out.png`, then a close-up in a script; `npm run smoke` catches a missing file.
Watch out: the file, `SHIPPED` and `sw.js` must agree, or the release channel shows the drawn fallback or fails offline. Dev-channel listing: not verified.

## 10. Change the save's shape

1. `game`, the object at the bottom (the index lists only `game`; its members are `saveVersion` and `migrate`): raise `saveVersion` by one and add `if (fromVersion < N) ...` to `migrate`, with a one-line comment saying what the step was.
2. Fix every place an old fighter lives: `data.run`, `data.run.me` and `data.last.me` (v15 and v18 did all three), and `data.rivals` when a rival changes.
3. `RUN_KEYS`: a per-run field is added here (and in `newRound`).
4. `saveRun` and `resumeRun` copy it; read new keys with a default (`E.save.get(key, default)`).
5. Add the line to `docs/games/arena/CHANGELOG.md` and bump `CACHE_VERSION` in `sw.js`.

Check: a script opens with a save written at the old version (`save: { __v: N-1, data: ... }` in `tools/drive.mjs`'s `open`) and reads it back.
Watch out: a save given to `open` as plain data skips `migrate` (it is wrapped with a huge version); wrap it as `{ __v, data }` to test migration.

## 11. Write a scripted check and capture frames

1. Work in a worktree (`tools/worktree.sh`). Start from `tools/checks/arena.mjs`: `open`, the `VET` and `FRESH` saves, `ptr`, `stroke`, `yardAt`, `logAtk`, `geo`. Add a helper there when you write one worth keeping.
2. Saves: a veteran one (all unlocks, every hint key set, so no hints) and a fresh one (`{ storySeen: 1 }`, so the yard, hints and first-run purse show).
3. Sizes: 667x375 and 844x390 landscape. Always run both.
4. Reach the game from inside the page: `window.__engine`, `E.game.scenes.play` (the helpers `play` exports), `P.state`. Start a bout: `E.setScene('play', { seed, arena, me, buy: 'x', gold: 0 })`, then `P.beginBout(E)`; for the yard, `P.nextYard` until the step.
5. Input: `g.tap` for a plain tap; for holds and moves, dispatch `PointerEvent`s on the canvas (a `ptr` helper), and for a thumb path step them every 16 ms (a `stroke` helper); the last builders kept these, with a `yardAt` helper, in a small file beside their checks. Find button positions from `P.shieldBtns(E)` and `P.armsBtns(E)`.
6. Pin the state you need (`state.swingIn = 99`, `state.step.x`, set from a timer) so a frame is the same each time; wait for his blow with a poll on `state.sw`.
7. Capture with `g.shot(path)`; `g.errors()` must be empty; close with `g.close()`. A contact sheet of the frames helps to review.

8. To start partway through a run, resume a saved one: `resumeRun` and the `play` scene's `enter` take a saved run (its rack says which bout). The painted art loads in the background in real time, so let the loads settle before you compare frames.
9. To prove a change left play alone: `node tools/replay.mjs tools/checks/replays/pit.json > before.json`, make the change, run it again, and compare. The three scripts there cover the Pit, a City pair bout and a beast bout.

Check: `npm run smoke` at the end, then `python3 tools/usage.py`.
