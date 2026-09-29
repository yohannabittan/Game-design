# Gravity Golf: notes for content shards

Holes are data in the `LEVELS` array of `games/gravity-golf/src/game.js`. A shard authors holes as JSON files, proves them with `tools/sim-golf.mjs` (which runs the game's real physics through `game.sim`), and hands the JSON and the tool output to the orchestrator, who pastes each entry into the array. PRD: `prd-v0.4.md` (sections A and C: the black hole's influence ring and the power-window rule) on top of `prd-v0.3.md` (sections A, B, E: comets, black holes, holes 11 to 15), `prd-v0.2.md` (sections A to E) and `prd-v0.1.md`.

The tool runs the TUNING defaults, which are the "Heavy" gravity preset (`planetGravity` 4.5e6, `stopSpeed` 50). The tune panel's other presets (Medium, Light, Light+roll) are a playtest experiment (PRD v0.3 D); routes are proven at Heavy only, and are re-proven once the designer picks.

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
  "blackholes": [],
  "movers": []
}
```

The design space is 360 by 640 units, y down. The four field edges are walls the physics adds; do not list them.

| Field | Meaning |
| --- | --- |
| `name` | Shown on the card, the banner and the hole select. |
| `boss` | Boss holes get the banner and boss colours (PRD: holes 5, 10 and 15). |
| `comment` | Teaching goal, the `three` route as drag vectors (and release clocks), and for holes 4 on the sweep result. Ignored by the game and the tool; the orchestrator turns it into the comment above the entry. |
| `stars` | `three`: the fewest strokes you proved with `--three`. `two`: par, a competent route, usually `three + 1`. One star is any finish. The card shows both. |
| `ball`, `hole` | Tee and cup centres. |
| `walls` | Axis-aligned rectangles `{ x, y, w, h }` (top-left corner, size). |
| `planets` | `{ x, y, r, mass }`. Solid, bounce with `wallBounce`, pull `planetGravity * mass / d^2` from outside only. `mass` 1.0 is standard; bosses up to 1.5 if the escape rule holds; `mass` 0 is a bumper (drawn slate, no pull). `r` is raised to `planetMinR` (24) if smaller. |
| `suns` | `{ x, y, r }`. No pull. A touch bounces the ball and costs `sunPenalty` (1) per touch. |
| `blackholes` | `{ x, y, r, mass, reach }`, `r`, `mass` and `reach` optional (defaults `holeR2` 26, `bhMass` 1.4 and `bhReach` 150). Inside the influence ring (`reach`, drawn as a dashed circle) it pulls like a planet: `planetGravity * mass / max(d, bhPullR)^2`, `bhPullR` 26; between `reach` and `bhFade` (1.5) times `reach` the pull fades smoothly to zero, and beyond that it does nothing (PRD v0.4 A). Leave `reach` out unless the hole needs it: the tune panel's reach slider only moves the default. No surface: a ball whose centre crosses the horizon (`r`) is swallowed, costs `bhPenalty` (1) on top of the shot, and goes back to where the shot started (its last rest, not the tee). Optional in the file; leave it out or give `[]`. |
| `movers` | Moving parts on the hole clock, which starts at 0 when the hole starts and restarts at 0 whenever the ball comes to rest. |

Movers:

- `{ "type": "slide", "w": 90, "h": 22, "a": { "x": 100, "y": 286 }, "b": { "x": 170, "y": 286 }, "period": 2.4 }`: a wall that eases from `a` to `b` and back once per `period` seconds (optional, default `moverPeriod` 2.4). At clock 0 it is at `a`.
- `{ "type": "bar", "x": 180, "y": 360, "len": 130, "phase": 0 }`: a bar `len` long and `barW` (8) thick, pivoting at its centre (x, y), spinning clockwise at `barAngularSpeed` (1.2 rad/s). `phase` is its angle in radians at clock 0 (0 is horizontal). It pushes the ball: collisions use its surface velocity.
- `{ "type": "moon", "parent": 0, "orbitR": 72, "period": 3, "r": 12, "mass": 0.4, "phase": 0 }`: a small planet circling `planets[parent]` clockwise at `orbitR`, once per `period` seconds; `phase` is its angle in radians at clock 0 (0 is east of the parent). PRD: `r` 10 to 16, `mass` 0.25 to 0.5 (capped at `moonMassMax`). Its surface and pull move with it.
- `{ "type": "comet", "a": { "x": -20, "y": 300 }, "b": { "x": 380, "y": 360 }, "period": 1.6, "r": 10 }`: a body that travels in a straight line from `a` to `b` at constant speed in `period` seconds, vanishes at `b` and is back at `a` when the clock wraps (at clock 0 it is at `a`). `r` is optional (default `cometR` 10). `a` and `b` may lie outside the field so the comet enters and leaves across an edge. No pull. On contact it kicks the ball once: a `wallBounce` reflection off its surface plus `cometPush` (0.8) times its velocity; if it is still catching the ball after the kick it pushes it on like a moving wall, and it kicks again only once the ball is 9 units clear. Its speed is the path length over `period` (400 units in 2 s is 200 units/s, a kick of 160).

Drags are screen pixels of finger movement (dx right, dy down); the ball flies the opposite way. `dragMax` (150 px) is full power, `dragDead` (12 px) cancels. A release clock is seconds on the hole clock at release; for a shot after the first, the clock counts from the moment the ball came to rest.

## Constraints the physics relies on

These are not enforced by the game; the tool catches most of them. Keep them or the hole will misbehave:

- **Mover sweeps.** A ball never comes to rest where a mover would sweep it (a bar's disc of radius `len / 2 + 4`, a moon's orbit band `orbitR ± r`, a slide's path from `a` to `b`, a comet's path from `a` to `b` widened by its `r`, each widened by the ball radius 9). It keeps rolling until the part knocks it on. So keep the tee, the cup and every other object clear of those zones, and do not put a slide where it can squeeze the ball against a wall (leave at least 18 units).
- **Moon clearance.** `orbitR` at least parent `r` + moon `r` + 18, so a ball resting on the parent is clear of the moon. Keep a moon's whole orbit (plus 18) clear of walls, suns, other planets and the field edges: a ball that lands on a moon rides it, and is carried wherever the moon goes. `--escape` reports a moon surface point beyond the edge as blocked.
- **Suns outside planet pull.** A sun inside a planet's pull gets hit again and again as the ball bounces (every touch after the ball has cleared the surface by 9 units counts), so a slow ball can pick up several penalties. Put suns where a planet does not press the ball into them, unless that is the point of the hole.
- **Black holes (PRD v0.3 A).** Keep every black hole off the straight line from the tee to the cup (the segment must pass at least horizon `r` + 9 from its centre) unless a wall already blocks that line: they punish greed, not first attempts. The tool fails a hole that breaks this. Their pull stops at `bhFade` times `reach` (225 units by default), but a slow ball rests only where the pull is under about 64 units/s^2, so within about 194 units of a default black hole it crawls in and is swallowed. A black hole near the cup turns every soft miss into a penalty, and one within about 200 units of a gap the route goes through swallows every soft shot through it; leave somewhere past the gap outside that distance so a softer shot rests and a two-stroke route is a real fallback, and check the obvious first shots with `--drag`. A black hole has no surface, so it is left out of the escape sweep; `--escape` counts swallows instead (information). Do not put a planet, sun, wall or the tee inside a horizon.
- **Comets (PRD v0.3 A).** A comet's path (the segment `a` to `b`, widened by its `r`) stays at least 18 units clear of the ball on the tee and of the cup's rim (the tool fails a hole that breaks this). A path may cross a planet's pull; that is often the point. Keep the path 18 clear of walls, suns, planets and black holes, so a comet never pins the ball against something. Pick `period` so the comet is readable: the kick is `cometPush` times its speed, and a comet much faster than about 400 units/s is a blur on a phone.
- **Timeouts.** A flight is cut off at `maxFlightSeconds` (12 s). A ball rests in open field only where the pull is below `stopSpeed * -ln(friction)` (about 64 units/s^2); near that edge of a planet's reach it crawls at about 50 units/s, and a bar, moon or comet that keeps nudging a crawling ball can stretch a flight past 12 s. `--escape` must report 0 timeouts.
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
node tools/sim-golf.mjs hole.json --two-shot                         # untimed two-shot sinks from every tee-reachable rest
node tools/sim-golf.mjs hole.json --windows 0,30/-112,73,0.4          # the power-window rule on a route's last shot (PRD v0.4 C)
node tools/sim-golf.mjs hole.json --two-shot --step-deg 1 --step-px 3 # the same on a finer grid (slower)
node tools/sim-golf.mjs --index 2 --three -2,124                     # any command on hole N (0-based) of game.js
```

Every report starts with a line naming the hole, and flags a tee that overlaps something or sits in a mover sweep. It ends with `RESULT: PASS` or `RESULT: FAIL`. Exit code 0 is a pass, 1 is a failed check, and 2 is a usage error.

- `--drag`: where the ball rests (or `SINK`, `TIMEOUT`, or `SWALLOWED` with where it crossed the horizon and the last rest it went back to), strokes charged (1 plus sun penalties plus `bhPenalty` per swallow), bounces (impacts over 40 units/s; a comet kick counts as one), comet hits when the hole has comets, the closest pass of the ball centre to each pulling body's surface (a black hole's horizon; negative when it crossed), and flight time.
- `--sweep`: every aim angle at 0.5 degree steps and every drag from 15 to 150 px at 5 px steps (20,160 shots from the tee, released at `--clock`, default 0). It counts straight sinks: shots that sink with zero bounces and never pass within 80 units of a planet, moon or black hole surface. The count must be 0 for holes 4 to 15. It also prints a stricter count (within 80 of a centre) and, for information, every one-shot sink with any number of bounces and no penalty, with the widest run of sinking aims at one drag length (the cluster a player finds by feel; compare it with the route's own aim window). With `--drag` it prints the aim window (0.05 degree steps at that drag length) and the drag-length window (0.5 px steps). For holes with movers, run the sweep at the release clocks your route uses too: a straight line through a gap a slide opens is still a straight ace.
- `--escape`: for every planet with mass and every moon (black holes have no surface and are skipped), it takes 8 surface points (every 45 degrees clockwise from east) and fires a full-power shot in each whole degree. The best reach from the body's centre must be at least 250 units; points inside a wall, sun, black hole or edge are reported as blocked. Moon points start riding the moon at clock 0. Then it plays 1500 chained random shots from the tee, at random release clocks when there are movers. It reports sinks, timeouts, rests overlapping anything, rests in a sweep zone, rests a mover would touch in 10 s of aiming, landings and moon rides, and, when the hole has them, swallows (the ball goes back to its last rest and play goes on) and comet hits. Timeouts, overlaps, sweep-zone rests and mover touches must all be 0.
- `--two-shot`: finds shortcuts a player gets without timing. First shots from the tee over a grid of drags (every `--step-deg` 2 degrees, 15 to 150 px every `--step-px` 6 px) and, when the hole has movers, `--clocks` 8 release clocks spread over the longest mover cycle, give the tee-reachable rests, one per `--cell` 10-unit square; each rest also records how many clocks its best first drag reaches it on. From every rest, every second drag on the same grid is tried at every clock. A second shot that sinks on more than half the clocks is untimed; if its rest was also reached on more than half the clocks, the whole route is untimed. It prints the counts and, per rest, the widest run of untimed aims at one drag length (the window a player finds by feel), the clocks it sinks on and the strokes (2 plus penalties). It fails when an untimed two-shot route beats `stars.three`, and notes when one matches it on a hole with movers. It uses every core (`--workers N` to limit); the default grid takes from seconds (no movers) to a few minutes.
- `--windows`: the power-window rule (PRD v0.4 C) on a route given as for `--three`. The earlier shots are played to their rest; the last shot's aim window (at its drag length, 0.05 degree steps) and drag-length window (along its aim, 0.5 px steps, up to full power at 150 px, since a longer drag is the same shot) must be at least 4 degrees and 20 px at the same time, 3 degrees and 15 px on a boss hole, for the drag and for each of its 8 whole-pixel neighbours (a lucky line through a ragged sink region does not pass). Sun and swallow penalties count as misses. It prints the route's windows and the neighbours' minimum, and every neighbour under the rule.
- `--three`: plays the route at 30, 60 and 144 fps and with jittery frames (1/144 to 1/20 s). It fails unless the route and its last shot's 8 whole-pixel neighbours all sink within `stars.three` strokes, sun and swallow penalties included. For multi-shot routes, earlier shots are nudged too and the tool reports how many still finish; that line is for information. The clock on each shot is its release time after the previous rest. A swallowed shot costs its penalty and the route plays on from the last rest, as in the game.

## What a shard delivers per hole

1. The hole JSON, with `comment` holding the teaching goal, the `three` route (drags and release clocks) and the sweep result.
2. `--three` output for the `three` route: PASS.
3. `--sweep --drag` output: 0 straight sinks for holes 4 to 15, with the aim window of the route's last shot. If the widest any-bounce cluster is wider than the route's window and is not the lesson, close it (a wall or a bumper) or say why it stays.
4. `--escape` output: PASS.
5. A competent `two` route checked with `--drag` (or `--three` against a copy with `three` set to the `two` value).
6. For holes with a black hole: a `--drag` of the obvious straight shot at the cup, showing it is not swallowed (or that a wall stops it first).
7. `--two-shot` output: PASS (no untimed two-shot route beats `stars.three`). On a hole whose lesson is timing, no fully untimed route should match `stars.three` either; if one does, close the rest it starts from (a lip or a fin that keeps 18 from the comet paths) or say why it stays.
8. `--windows` output for the `three` route: PASS (PRD v0.4 C, every hole from v0.4 on). The last shot sinks over at least 20 px of drag and 4 degrees of aim at the same time (boss holes: 15 px and 3 degrees), and so do its 8 whole-pixel neighbours. A shot that only sinks at or near full power usually fails: shorten the route (the tee closer, the cup nearer the bend) until it sinks from well below 150 px.
