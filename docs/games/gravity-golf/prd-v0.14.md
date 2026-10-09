# Gravity Golf PRD v0.14: magnetars, and the gamma chase

Status: locked 2026-10-09 by the designer ("go"; "if the chase wave catches you, you restart"). It builds on v0.13.

**What the designer said after playing Sector 7 (2026-10-08):**
- "It seems we're combining the light-dark concept and the gamma burst concept into a planet releasing a deadly burst, which is interesting and like a pulsar, but maybe it should be a magnetic burst that pushes you away."
- "The gamma burst I was thinking is more like: it starts from a corner of the screen behind you as soon as you shoot the ball, and then you need to keep going towards the hole fast. More like forcing it to be a timed trial rather than a time window like a windmill."

**So v0.14 has two parts:**
- Sector 7's burst star becomes a **magnetar**: its ring pushes instead of punishing.
- A new Sector 8 is **the gamma chase**: a straight wall of light that starts at the first shot, chases you to the cup, and restarts the hole if it reaches you.

Like v0.13, each part is a mechanic layer first, then content shards using the lean method (v0.13 B-lean).

## A. The magnetar (replaces the burst star's catch)

- **The same star, the same rhythm.** The body, its pull, its sun touch penalty, its cycle (`period`, `phase`), its ring (`speed`, `maxR`) and the planet shadows all stay as in v0.13.
- **The ring pushes.**
  - When the ring's leading edge passes over a moving ball, the ball gets one kick of `T.magnetKick` units per second (about 150 to 250), directly away from the star's centre.
  - It is one kick per ring per pass, never a continuous force.
  - Nothing else happens to the ball: no penalty, no fizzle, no return.
- **A ball at rest is never pushed,** so aiming stays calm.
- **Planets still shadow the ring.** Inside a planet's shadow cone there is no ring and no kick, so hole 33's lesson becomes "hide from the push".
- **The aim preview shows the push** when the preview's own length reaches it, since it runs the same physics.
- **The look is magnetic violet.**
  - The star is a dense violet-white core with two faint field-line loops (a dipole) that brighten through the cycle.
  - The ring is a violet band with a bright edge, plus the 0.5 s guide circle.
  - At the kick, the ball flashes and gets a short spark trail away from the star.
  - Violet stays clear of the black hole's influence violet, because the ring is a moving band and the black hole's mark is a fixed ring.
- **Removed:** `burstPenalty`, the fizzle phase and its juice. The old ice-blue burst look moves to the gamma chase (B).
- **In code,** the field stays `burst` in the hole data, so the hole format changes as little as possible. TUNING and comments call the body a magnetar.
- **Harness.**
  - `sim-golf` models the kick in every command.
  - `--drag` prints each `KICK`, with where it happened and on which clock.
  - A `--nokick` flag replays a shot with the kick off, so a shard can show that the route needs the push.

## B. The gamma chase (a new hole field)

- **A hole may have a chase:** `chase: { dir, speed }`.
  - `dir` is the sweep direction in degrees.
  - The front is a straight line across the whole field, at right angles to `dir`.
  - It starts at the field corner furthest behind (the corner with the lowest projection on `dir`) and travels at `speed` units per second.
  - Hole data sets `speed`; `T.chaseSpeed` is the default.
- **It starts at the first shot.** Its clock is its own (the hole clock restarts at every rest, so it can't be used).
  - The chase clock starts at the first release.
  - It keeps running while you aim, so every second spent aiming counts.
  - Before the first shot the front waits at the corner, drawn faintly.
- **Caught means restart.** When the front's band passes the ball's centre, whether the ball is moving or at rest, the hole restarts:
  - strokes go back to 0;
  - the ball goes back to the tee;
  - the front goes back to its corner and waits for the first shot again.
  
  A short white flash and "Caught by the burst!" (about 0.8 s) come first. It is the same restart as Retry.
- **The cup is safe.** A sink ends the chase.
- **Readable, not a surprise:**
  - The front is a bright white band with the ice-blue glow (the v0.13 burst look). It has a faint guide line where it will be in 1 s.
  - A thin edge light on the screen side the front is coming from pulses faster as the front nears the ball.
  - A light haptic tick comes in the last 1.5 s before it reaches a resting ball.
  - There is no number timer: the front itself is the clock.
- **Determinism.** The front is pure clock from the first release, with no randomness.
- **Harness.**
  - `sim-golf` models the chase.
  - Multi-shot commands (`--three`, `--drag` chains) take `--aim <s>`: the seconds of aiming before each shot after the first (default 3).
  - `--three` reports the **margin**: the least time, over the whole route, between the front and the ball.
  - A catch counts as a miss.
- **How fast (the authoring rule).** With 3 s of aim before each later shot, the three-star route keeps a margin of 2 to 5 s.
  - With 3 s of aim, the two-star route is caught or nearly caught.
  - The par route must be safe with 3 s of aim; the boss may be tighter.
  - The designer's playtest sets the final speeds. `T.chaseSpeed` and each hole's `speed` are easy to change.

## C. Content

### Sector 7, "Beyond the Core": holes 31 to 35 re-authored for the push

Start from each hole's current layout (lean method). Each route must use the push: the same release with `--nokick` misses.

- **31 Repulse (tutorial, renamed from Afterglow).** One magnetar. Release so that the ring kicks the ball onto the cup's line.
- **32 Tailwind (renamed from Outrun).** The magnetar sits behind the tee. A soft shot gets kicked up the field by the ring, so you ride the push.
- **33 Eclipse Gate.** Hide in a planet's shadow so the push does not knock you off the line, or use the push on purpose.
- **34 Twin Pulse.** Two magnetars out of phase: one kick, then the other.
- **35 Magnetar (boss, renamed from Pulsar).** A quick magnetar beside a black hole. The kick is what carries the ball past the black hole's pull.

### Sector 8, "The Burst": holes 36 to 40 (new)

- **36 First Light (tutorial).** One planet and a slow front. Three-star is 2 strokes, and dawdling loses.
- **37 Shortcut.** A short, risky route past a sun beats the front. The long, safe way round is caught.
- **38 Sprint.** A sun's whip, or a comet, gives the speed to stay ahead.
- **39 Push Ahead.** A magnetar and the chase together: the push is what puts you ahead of the front.
- **40 Supernova (boss).** A long multi-shot route with a black hole and a fast front.

### The lean checks

Per hole:
- the straight line blocked as geometry, with a 60-shot sweep;
- rests clear of the bands at the route's clocks;
- `--three` at one frame rate plus jitter;
- `--windows` on the last shot.

Added:
- Sector 7: the `--nokick` miss.
- Sector 8: the margin rule (B).

Once per sector at merge, in the background: `--escape`. Skip `--two-shot` wherever three-star is 1 stroke.

Time-box: about 15 minutes per hole and 30 for a boss.

## D. Dressing and story

- **Sector 7.** The name and arrival log stay. Sam's pool becomes:
  - "Stay close to it, Lumen."
  - "A magnetar! Ride the push."
  - "Our new friend is fast."
- **Sector 8, "The Burst".**
  - A deep indigo field, the starfield streaked as if by speed, and never green or orange.
  - Arrival log: "Log: a star exploded far behind us. Its light is coming. Run."
  - Sam's pool:
    - "Run, Lumen, run!"
    - "That light's catching up!"
    - "Don't stop to admire it."
- **Probe Log.** The reviewer checks each fact against a general reference.
  - `burst` (now earned by a magnetar): "A magnetar's magnetic field is about a thousand trillion times Earth's."
  - New `chase` (the first chase hole finished): "Gamma-ray bursts are the brightest explosions known in the universe."
  - New Sector 8 fact: "In seconds, a gamma-ray burst can release more energy than our Sun will in its whole life."
- **Menu tiles:**
  - Sector 7 tiles show a magnetar;
  - Sector 8 tiles show a slanted bright band.
  
  The grid fits 40 tiles.
- **Ranks.** 40 holes give up to 160 stars, and "more holes coming" follows `LEVELS.length`.

## E. Saves

No new field, so there is no `saveVersion` bump. Bests on 31 to 35 are kept, even though the holes change, which is the simplest option. Hole 36 opens when hole 35 is cleared.

## F. Out of scope

- shadows on the gamma front;
- a chase that pauses;
- a time display;
- new badges;
- changes to holes 1 to 30;
- the big-room camera;
- the rescue beat.

## G. Acceptance

- **Magnetar:**
  - a ring kicks a moving ball once and never a resting one;
  - a shadow blocks it;
  - the game and `sim-golf` agree on a scripted kick at 30, 60 and 144 fps.
- **Chase:**
  - the front starts at the first release;
  - it catches a resting ball and restarts the hole, with strokes 0 and the front reset;
  - a sink ends it;
  - the game and `sim-golf` agree on a scripted catch time.
- **Content:** every hole passes the lean checks above.
- The menu fits 40 tiles at 375x667.
- `npm run smoke` passes.
- Frame time is no worse than v0.13 on a hole with two magnetars, and on a chase hole.
- **Difficulty and feel are judged by the designer's playtest.**

## H. How it is built (cost before rigour)

1. **One mechanic build (Opus).** A and B, plus D's dressing, the `sim-golf` changes, hole 31 re-authored and hole 36. Each part is finished before the next starts. It is reviewed, then held (not pushed) until step 2 lands, so the live Sector 7 is never half-converted.
2. **Content shards (Sonnet, at most three at once):**
   - 32 and 33;
   - 34 and 35;
   - 37 and 38;
   - then 39 and 40.
   
   The orchestrator merges each through the lean gate.
3. **Pushes:**
   - first push: Sector 7 re-authored plus hole 36;
   - second push: 37 to 40.

Rough cost: about $20 to $25 in all.
