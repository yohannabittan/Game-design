# Gravity Golf: notes for content shards

Holes are data in the `LEVELS` array of `games/gravity-golf/src/game.js`. A shard authors holes as JSON files, proves them with `tools/sim-golf.mjs` (which runs the game's real physics through `game.sim`), and hands the JSON and the tool output to the orchestrator, who pastes each entry into the array. PRD: `prd-v0.2.md` (sections A to E) on top of `prd-v0.1.md`.

## Hole file

One entry, exactly the shape game.js uses (JSON is valid inside the JavaScript array, so it pastes in unchanged):

```json
{
  "name": "Slingshot",
  "boss": false,
  "comment": "Teaches the slingshot. three: drag (-2, 124), one shot, passing 21 from the surface. Sweep: 0 straight sinks.",
  "stars": { "three": 1, "two": 3 },
  "ball": { "x": 300, "y": 560 },
  "hole": { "x": 125, "y": 225 },
  "walls": [ { "x": 0, "y": 330, "w": 200, "h": 22 } ],
  "planets": [ { "x": 220, "y": 300, "r": 48, "mass": 1 } ],
  "suns": [],
  "movers": []
}
```

The design space is 360 by 640 units, y down. The four field edges are walls the physics adds; do not list them.

| Field | Meaning |
| --- | --- |
| `name` | Shown on the card, the banner and the hole select. |
| `boss` | Boss holes get the banner and boss colours (PRD: holes 5 and 10). |
| `comment` | Teaching goal, the `three` route as drag vectors (and release clocks), and for holes 4 to 10 the sweep result. Ignored by the game and the tool; the orchestrator turns it into the comment above the entry. |
| `stars` | `three`: the fewest strokes you proved with `--three`. `two`: par, a competent route, usually `three + 1`. One star is any finish. The card shows both. |
| `ball`, `hole` | Tee and cup centres. |
| `walls` | Axis-aligned rectangles `{ x, y, w, h }` (top-left corner, size). |
| `planets` | `{ x, y, r, mass }`. Solid, bounce with `wallBounce`, pull `planetGravity * mass / d^2` from outside only. `mass` 1.0 is standard; bosses up to 1.5 if the escape rule holds; `mass` 0 is a bumper (drawn slate, no pull). `r` is raised to `planetMinR` (24) if smaller. |
| `suns` | `{ x, y, r }`. No pull. A touch bounces the ball and costs `sunPenalty` (1) per touch. |
| `movers` | Moving parts on the hole clock, which starts at 0 when the hole starts and restarts at 0 whenever the ball comes to rest. |

Movers:

- `{ "type": "slide", "w": 90, "h": 22, "a": { "x": 100, "y": 286 }, "b": { "x": 170, "y": 286 }, "period": 2.4 }`: a wall that eases from `a` to `b` and back once per `period` seconds (optional, default `moverPeriod` 2.4). At clock 0 it is at `a`.
- `{ "type": "bar", "x": 180, "y": 360, "len": 130, "phase": 0 }`: a bar `len` long and `barW` (8) thick, pivoting at its centre (x, y), spinning clockwise at `barAngularSpeed` (1.2 rad/s). `phase` is its angle in radians at clock 0 (0 is horizontal). It pushes the ball: collisions use its surface velocity.
- `{ "type": "moon", "parent": 0, "orbitR": 72, "period": 3, "r": 12, "mass": 0.4, "phase": 0 }`: a small planet circling `planets[parent]` clockwise at `orbitR`, once per `period` seconds; `phase` is its angle in radians at clock 0 (0 is east of the parent). PRD: `r` 10 to 16, `mass` 0.25 to 0.5 (capped at `moonMassMax`). Its surface and pull move with it.

Drags are screen pixels of finger movement (dx right, dy down); the ball flies the opposite way. `dragMax` (150 px) is full power, `dragDead` (12 px) cancels. A release clock is seconds on the hole clock at release; for a shot after the first, the clock counts from the moment the ball came to rest.

## Constraints the physics relies on

These are not enforced by the game; the tool catches most of them. Keep them or the hole will misbehave:

- **Mover sweeps.** A ball never comes to rest where a mover would sweep it (a bar's disc of radius `len / 2 + 4`, a moon's orbit band `orbitR ± r`, a slide's path from `a` to `b`, each widened by the ball radius 9). It keeps rolling until the part knocks it on. So keep the tee, the cup and every other object clear of those zones, and do not put a slide where it can squeeze the ball against a wall (leave at least 18 units).
- **Moon clearance.** `orbitR` at least parent `r` + moon `r` + 18, so a ball resting on the parent is clear of the moon. Keep a moon's whole orbit (plus 18) clear of walls, suns, other planets and the field edges: a ball that lands on a moon rides it, and is carried wherever the moon goes. `--escape` reports a moon surface point beyond the edge as blocked.
- **Suns outside planet pull.** A sun inside a planet's pull gets hit again and again as the ball bounces (every touch after the ball has cleared the surface by 9 units counts), so a slow ball can pick up several penalties. Put suns where a planet does not press the ball into them, unless that is the point of the hole.
- **Timeouts.** A flight is cut off at `maxFlightSeconds` (12 s). A ball rests in open field only where the pull is below `stopSpeed * -ln(friction)` (about 64 units/s^2); near that edge of a planet's reach it crawls at about 50 units/s, and a bar or moon that keeps nudging a crawling ball can stretch a flight past 12 s. `--escape` must report 0 timeouts.
- **Landing.** Under friction a slow ball within about `sqrt(planetGravity * mass / 64)` units of a planet (about 266 for mass 1) rolls back and lands on it. Most missed shots near a planet end on its surface; the next shot has to leave the pull. Design the second shot from the surface, not from mid-field.
- **Slingshot.** A pass bent 90 degrees or more is always close to being captured, so big whips are narrow. Bends of 60 to 90 degrees, with the cup within about 150 units after the pass, are the forgiving ones. Hole 3 is the worked example.

## Commands

```
node tools/sim-golf.mjs --list                                       # holes in game.js: index, name, three / two, boss
node tools/sim-golf.mjs hole.json --drag DX,DY                       # one shot from the tee
node tools/sim-golf.mjs hole.json --drag DX,DY --clock 0.5 --fps 30  # released at clock 0.5, stepped as 30 fps frames
node tools/sim-golf.mjs hole.json --sweep                            # no-straight-ace sweep (PRD v0.2 C)
node tools/sim-golf.mjs hole.json --sweep --drag DX,DY               # the sweep, plus the aim and drag windows around a drag
node tools/sim-golf.mjs hole.json --escape                           # escape sweep and 1500 chained random shots (PRD v0.2 D)
node tools/sim-golf.mjs hole.json --three DX,DY[,CLOCK]              # verify a one-shot three-star route
node tools/sim-golf.mjs hole.json --three 0,30/-112,73,0.4           # a two-shot route: shots separated by '/'
node tools/sim-golf.mjs --index 2 --three -2,124                     # any command on hole N (0-based) of game.js
```

Every report starts with a line naming the hole, and flags a tee that overlaps something or sits in a mover sweep. It ends with `RESULT: PASS` or `RESULT: FAIL`. Exit code 0 is a pass, 1 is a failed check, and 2 is a usage error.

- `--drag`: where the ball rests (or `SINK`, or `TIMEOUT`), strokes charged (1 plus sun penalties), bounces (impacts over 40 units/s), the closest pass of the ball centre to each pulling body's surface, and flight time.
- `--sweep`: every aim angle at 0.5 degree steps and every drag from 15 to 150 px at 5 px steps (20,160 shots from the tee, released at `--clock`, default 0). It counts straight sinks: shots that sink with zero bounces and never pass within 80 units of a planet or moon surface. The count must be 0 for holes 4 to 10. It also prints a stricter count (within 80 of a centre) for information. With `--drag` it prints the aim window (0.05 degree steps at that drag length) and the drag-length window (0.5 px steps). For holes with movers, run the sweep at the release clocks your route uses too: a straight line through a gap a slide opens is still a straight ace.
- `--escape`: for every planet with mass and every moon, it takes 8 surface points (every 45 degrees clockwise from east) and fires a full-power shot in each whole degree. The best reach from the body's centre must be at least 250 units; points inside a wall, sun or edge are reported as blocked. Moon points start riding the moon at clock 0. Then it plays 1500 chained random shots from the tee, at random release clocks when there are movers. It reports sinks, timeouts, rests overlapping anything, rests in a sweep zone, rests a mover would touch in 10 s of aiming, landings and moon rides. Timeouts, overlaps, sweep-zone rests and mover touches must all be 0.
- `--three`: plays the route at 30, 60 and 144 fps and with jittery frames (1/144 to 1/20 s). It fails unless the route and its last shot's 8 whole-pixel neighbours all sink within `stars.three` strokes, sun penalties included. For multi-shot routes, earlier shots are nudged too and the tool reports how many still finish; that line is for information. The clock on each shot is its release time after the previous rest.

## What a shard delivers per hole

1. The hole JSON, with `comment` holding the teaching goal, the `three` route (drags and release clocks) and the sweep result.
2. `--three` output for the `three` route: PASS.
3. `--sweep --drag` output: 0 straight sinks for holes 4 to 10, with the aim window of the route's last shot.
4. `--escape` output: PASS.
5. A competent `two` route checked with `--drag` (or `--three` against a copy with `three` set to the `two` value).
