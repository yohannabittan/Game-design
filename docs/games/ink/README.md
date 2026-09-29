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

`--timer-from-path` prints the timer as a multiple of the time the path takes to reach 99 percent (PRD section 9): 2.2x for stencils 1 to 4, 1.9x for 6 to 9, 1.7x for boss stencil 5 and 1.6x for boss stencil 10. Use the row for your stencil and round up to a whole second.

## What a shard delivers per stencil

1. The stencil JSON with `name`, `timer`, `boss`, `comment`, `shape`.
2. The intended path JSON. It must be clean (0 slips) and reach 99 percent at 300 units/s.
3. The simulator output for that pair, pasted in the report.
4. A check that a naive path (a plain back-and-forth sweep of the bounding box) does not reach 99 percent clean, so the tips matter.

The intended path should be something a thumb can plausibly do: no turns tighter than the needle radius, lifts at sharp corners.


Needle mode: since v0.4 there is one needle (dynamic with Flowy inertia). Path points may still carry a speed as `[x, y, speed]`, and `{ "hold": seconds }` entries pause the needle in place.
