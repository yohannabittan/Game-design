# Ink: notes for content shards

Stencils are data in the `STENCILS` array of `games/ink/src/game.js`. A shard authors stencils as JSON files, proves them with `tools/sim-ink.mjs`, and hands the JSON to the orchestrator, who pastes it into the array.

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
```

Output is the percentage, slips, path length, time, the moment 99 percent is reached and whether that is inside the timer. Exit code 0 means 99 percent within the timer with no ruin; 1 means not. The time counts travel during lifts at the same speed.

`--timer-from-path` prints the timer that leaves the PRD section 9 spare fraction after 99 percent is reached: 15 percent for stencils 1 to 4, 10 percent for 5 to 9, 5 percent for 10. Use the row for your stencil and round up to a whole second.

## What a shard delivers per stencil

1. The stencil JSON with `name`, `timer`, `boss`, `comment`, `shape`.
2. The intended path JSON. It must be clean (0 slips) and reach 99 percent at 300 units/s.
3. The simulator output for that pair, pasted in the report.
4. A check that a naive path (a plain back-and-forth sweep of the bounding box) does not reach 99 percent clean, so the tips matter.

The intended path should be something a thumb can plausibly do: no turns tighter than the needle radius, lifts at sharp corners.
