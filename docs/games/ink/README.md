# Ink: notes for content shards

Stencils are data in the `STENCILS` array of `games/ink/src/game.js`. A shard authors stencils as JSON files, proves them with `tools/sim-ink.mjs`, and hands the JSON to the orchestrator, who pastes it into the array.

Stencil order is fixed by PRD v0.5 section A (`node tools/sim-ink.mjs --list` prints it). Saves are keyed by index, so a reorder needs a `saveVersion` bump and a remap in `migrate`. Each entry also carries a `tier` (early, mid, boss, final or skull: which timer multiplier retimes it; shards' JSON without one keeps its own timer), a `body` (forearm, shoulder, calf or back: the body part drawn behind it) and optionally a `story` (gem, banner or swirl: a decoration on the card); these are art only and shards do not need to supply them.

## Stencil file

One entry, exactly the shape game.js uses:

```json
{
  "name": "Square",
  "timer": 30,
  "boss": false,
  "comment": "Teaches corners, lift and place. Path: fill rows, lift at each corner.",
  "shape": [ [[100,220],[260,220],[260,380],[100,380]] ]
}
```

- `shape` is a list of closed polygons in the 360x640 design space. Do not repeat the first point at the end. A polygon inside another is a hole (even-odd). Curves are polygons with enough points to look smooth.
- Keep the shape between about y=110 (the HUD) and y=560: the finger is 56 screen pixels below the needle, so on a 640-tall screen the needle cannot reach below y=584.
- `comment` is the teaching goal and the intended path in one line. When pasted into game.js it becomes the comment above the entry.
- `timer` is set from the path with `--timer-from-path` (see below), not by feel.

## Path file

An array of needle positions in design units. The needle offset is irrelevant to scoring, so these are needle points, not finger points. A `null` is a lift; the next point is a new touch down.

A point may carry a third number, the finger speed in units per second for the segment that ENDS at that point (v0.2, PRD section C):

```json
[[180,320,300],[190,320,120],[200,330,120],null,[50,60],[70,60,450]]
```

A point without it uses `--speed`. The first point after a lift has no segment of its own, so its speed is unused. Speed matters to the dynamic needle (it sets the ink radius) and to the clock (time to 99 percent is the sum of segment length over segment speed; a lift travels at `--speed`).

```json
[[180,320],[190,320],[200,330],null,[50,60],[70,60]]
```

The simulator joins consecutive points with straight segments, so put enough points on curves. It feeds them through the real game code (touch down, move, lift), so coverage, the tolerance and once-per-exit slips are exactly what a player gets.

## Commands

```
node tools/sim-ink.mjs stencil.json path.json                  # score a path
node tools/sim-ink.mjs stencil.json path.json --speed 300      # finger speed in units per second (default 300)
node tools/sim-ink.mjs stencil.json path.json --timer-from-path
node tools/sim-ink.mjs --index 0 path.json                     # use stencil N of game.js
node tools/sim-ink.mjs --list                                  # names and timers in game.js
node tools/sim-ink.mjs --index 0 path.json --events 30         # cut finger movement into 30 events per second of path time
```



A path entry `{ "hold": 1.5 }` keeps the finger still for that many seconds: the simulator runs the game's own `update` in frames of 1/60 s (1/HZ with `--events`), so the radius swells in fixed 1/120 s steps, the disc it lays grows with it (never past `needleR * wideScale`) and the timer runs. Example: `[[180,320],{"hold":1}]`.

`--events HZ` changes only how the movement is cut into pointer events (events per second of path time). Coverage and slips must not change with it; if they do, that is a bug. Without it events are cut every `sampleSpacing` units.

The dynamic needle measures speed over the last `speedWindow` units of travel, using the time each path sample would have had on its straight segment, so what matters is where the finger was and how fast, never how the events were cut. Slow ink (at or below `slowSpeed`) is `wideScale` times `needleR` wide, fast ink (at or above `fastSpeed`) `thinScale` times, linear between. Shard paths written for v0.1 carry no speeds; at the default 300 units/s the dynamic radius is about 1.03 times `needleR`, so they score close to classic. A path meant for the dynamic needle should ride edges slowly and cross the middle at a moderate speed.

Output is the percentage, slips, path length, time, the moment 99 percent is reached and whether that is inside the timer. Exit code 0 means 99 percent within the timer with no ruin; 1 means not. The time counts travel during lifts at the same speed.

`--timer-from-path` prints the perfect-path time (the time the path takes to reach 99 percent, to two decimals) and then the timer it gives under each multiplier (PRD section 9): 2.2x for Circle, Diamond, Heart and Star, 1.9x for Bolt, Halo, Clover, Key, Dagger, Anchor, Rose and Swallow, 1.7x for the boss Crescent, 1.6x for the boss Snake and 1.35x for the final boss Skull (the fifteen-stencil order is in PRD v0.5 section A). `--preset Relaxed|Standard|Tight` (default Standard) applies one of the game's timer presets first, so the pass check and these rows use the multipliers that are active. In the game, each stencil stores `perfect` (that time, from its intended path, to two decimals), its `tier`, and its standard `timer`; the timer the player gets is `perfect` times the tier's active multiplier times `timerGlobalMult`, rounded up, and the Standard preset reproduces `timer` exactly. Round the timer up to a whole second and store `perfect` rounded to 0.01.

The fifteen intended paths are in `docs/games/ink/paths/<stencil>.json`, in the game's order (circle, diamond, heart, star, bolt, crescent, halo, clover, dagger, anchor, rose, swallow, snake, key, skull). To re-prove every `perfect` from a checkout, run the simulator on each and compare the `perfect` line with the stencil's `perfect` in `game.js`:

```
i=0; for n in circle diamond heart star bolt crescent halo clover dagger anchor rose swallow snake key skull; do
  node tools/sim-ink.mjs --index $i docs/games/ink/paths/$n.json --timer-from-path | grep -E '^(perfect|slips|result)'; i=$((i+1)); done
```

Every path must show 0 slips and an OK result. The paths are the intended paths (speeds as marked, 300 units per second elsewhere); the tighter edge-riding paths used to check spare time are not kept. The Swallow and Skull paths are for the stencils in parts (next section): they land on each part in turn.

## Stencils in parts (PRD v0.6 section D)

A stencil may be several separate pieces. Instead of `shape` it has `parts`: a list of parts, each part a list of polygons exactly like `shape` (outer polygons and holes, even-odd inside one part). The game makes `shape` from them (all polygons together), so everything that reads `shape` (outline, grid, previews, the daily) keeps working. A stencil without `parts` behaves exactly as before.

```json
{
  "name": "Trinity",
  "timer": 40,
  "boss": false,
  "comment": "Three rings. Path: land on each ring, lap it, lift.",
  "parts": [
    [ [[70,200],[110,200],[110,240],[70,240]], [[80,210],[100,210],[100,230],[80,230]] ],
    [ [[160,300],[200,300],[200,340],[160,340]] ],
    [ [[250,400],[290,400],[290,440],[250,440]] ]
  ]
}
```

(the first part is a square ring: an outer square and a hole inside it.) The simulator (`--index` or a stencil JSON) accepts `parts` and prepares it the way the game does.

Rules the shard must design for:

- Inking a part to 99 percent of its own cells completes it: the rest of the part fills by itself. The piece is done (100 percent, the card) when every part is done. Lifting is free.
- Every touch down is a landing. It is clean when the needle is inside any part's line, or within `landTolerance` (2 units) of one. On bare skin it is a blot: a slip (three ruin the piece) with its own red mark. The simulator prints `landings N clean of M` and the fraction of each part inked. Only stencils with `parts` score landings, so a stencil in one piece never has blots.
- Keep at least 5 units between parts, and put no cell centre exactly on a cut (use .5 coordinates: cells are 3 units, centres at 1.5, 4.5, ...). A gap of 5 units means a stroke that crosses it slips (the slip tolerance is 2), so a path must lift over every gap.
- A part needs at least about 40 cells (a 20 by 20 unit part) so that 99 percent of it is more than the needle's own error; the Skull's teeth are the smallest that work.
- After a lift the radius starts again at `needleR * floorScale` and widens at `growRate`, so a landing costs about a third of a second of thin ink. A path that keeps its old single-piece order and only gets a lift where it crosses a gap loses a lot of coverage this way (the old Swallow path with lifts inserted reached 82 percent, not 100). Write the path per part instead: land, ride the part's outline 5 to 6 units inside at speed 175, then fill it in rows about 15 apart at speed 270, with as few lifts as it takes. The Swallow's and the Skull's paths were made that way.
- The perfect time is the time to the moment the last part is done, lifts included (the finger crosses a lift at `--speed`); `--timer-from-path` prints it as `perfect`. Store it in `perfect` and set `timer` by the same tier rule as any stencil.

### The three new sets (shard work, not yet authored)

Trinity (three rings), Constellation (five small stars joined by nothing) and Bones (two crossed bones) are for content shards under the rules above; the orchestrator merges them. Each is one stencil entry in the shape of the example above, plus the game's own fields, and its intended path is one file in `docs/games/ink/paths/` (`trinity.json`, `constellation.json`, `bones.json`; a `null` between parts is the lift):

```json
{ "name": "Trinity", "timer": 40, "boss": false, "tier": "mid", "perfect": 21.5, "body": "forearm", "story": null,
  "parts": [ [ outer ring polygon, its hole ], [ ... ], [ ... ] ] }
```

- Appending puts them at indices 15, 16 and 17, after the Skull: no save remap. `tier` is `mid` unless the orchestrator says otherwise; `perfect` is what `--timer-from-path` prints; `timer` is `perfect` times the tier's multiplier rounded up; `body` is one of forearm, shoulder, calf, back.
- Trinity: each ring is one part made of an outer polygon and a hole (even-odd inside the part). Constellation: five stars, each at least 20 by 20 units, at least 5 units apart. Bones: parts must not overlap, so one bone is whole and the other is cut in two by a 5 unit slit either side of it (three parts), or both are cut where they cross.
- The badge Set Piece counts every stencil that has `parts`, so it needs no change, but a save that already earned it keeps it. Full Sleeve stays the first fifteen.
- Menu: 18 stencils at five per row is a fourth row of tiles, and the menu then no longer fits 360x640 or 375x667 (the tiles stop at 100 px and the Play button ends at 680 px). Six columns (three rows of 100 px tiles, narrower) or a scrolling grid is a layout change for the merge, not for the shards.

## What a shard delivers per stencil

1. The stencil JSON with `name`, `timer`, `boss`, `comment`, `shape` (or `parts`).
2. The intended path JSON. It must be clean (0 slips, every landing clean) and reach 99 percent (every part done, for stencils in parts) at 300 units/s.
3. The simulator output for that pair, pasted in the report.
4. A check that a naive path (a plain back-and-forth sweep of the bounding box) does not reach 99 percent clean, so the tips matter.

The intended path should be something a thumb can plausibly do: no turns tighter than the needle radius, lifts at sharp corners.


Needle mode: since v0.4 there is one needle (dynamic with Flowy inertia). Path points may still carry a speed as `[x, y, speed]`, and `{ "hold": seconds }` entries pause the needle in place.
