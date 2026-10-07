# Gravity Golf PRD v0.13: Sector 7, Beyond the Core (the gamma-ray burst)

Status: locked 2026-10-07 ("Yes go for the GG backlog"; the backlog row "gamma-ray burst hazard"). It builds on v0.11. Story fit: after the ending of v0.11, Lumen follows the other probe out past the core. This sector is the first leg of chapter two. Like v0.3 (comets, black holes), this is a mechanic layer first, then content shards (ADR-0012).

## A. The burst star (mechanic layer, one build)

- **A new body: the burst star.**
  - It pulls and penalises on touch exactly like a sun (mass and radius as for suns; sun rules apply, so it is heavier than the planets and lighter than any black hole).
  - It **flares on a fixed cycle**, set in the level data like a mover's period and phase, on the shared hole clock, so a shot's release time decides what it meets.
- **The telegraph.** Through each cycle the star swells and brightens, and a countdown arc around it fills. At the flare it flashes white.
- **The shock front.**
  - At the flare, a ring spreads from the star at a fixed, readable speed (level data, in units per second, about 120 to 220) out to a maximum radius.
  - It is drawn as a bright band, with a faint guide circle showing where it will be in 0.5 s, so the player can plan, not react.
- **Caught by the front.** If the ball is inside the band when it passes, the shot is lost:
  - the ball fizzles and returns to its last rest, plus 1 penalty stroke (`T.burstPenalty`), exactly like a black hole swallow;
  - a ball at rest is safe, because the front only catches a moving ball. This keeps aiming stress-free.
- **Determinism.** The flare is pure clock: no randomness, the same at every frame rate (the fixed step).
- **Harness.** `tools/sim-golf.mjs` models bursts in every command, as it does comets:
  - `--drag` reports burst catches;
  - `--escape` reports catches and treats them as swallows;
  - `--three` and `--windows` count a catch as a miss;
  - `--sweep` and `--two-shot` run at the route's release clocks.

  The README documents the new hole JSON fields.
- **The tutorial hole (31) teaches it naked.** One burst star, a cup on the far side, and a route that works by releasing just after a flare, so the front has passed before the ball crosses its path.

## B. Content: holes 31 to 35 (shards, after A lands)

- **31 Afterglow (tutorial):** release after the flare.
- **32 Outrun:** a fast shot that crosses before the front reaches its line.
- **33 Eclipse Gate:** a planet shadows part of the front, so the front breaks where it meets the planet. The ball hides behind the planet's bend. A planet blocks the front: the band is not drawn, and does not catch, inside a planet's shadow cone from the star.
- **34 Twin Pulse:** two burst stars out of phase, with one safe window between them.
- **35 Pulsar (boss):** a burst star by a black hole, with a quick cycle. The route uses both the flare timing and the black hole's bend.

Every hole meets v0.8 B and the v0.10 ceiling: a noisy-human rate of 60 to about 80 percent on the last shot, and the boss may go lower. Each hole's three-star route has a release window of 30 to 50 percent of the cycle. Shards follow `README.md`, "What a shard delivers per hole". The orchestrator merges them through the merge gate.

### B-lean. Faster hole authoring (designer, 2026-10-07: "you're relying a bit too heavily on algorithms and simulation... there should be some heuristic ways to achieve the same goals way faster")

This replaces the per-hole proving of v0.8 B for holes 32 to 35, and for future sectors unless a playtest shows a problem.
- **Start from a proven hole, not a blank field.**
  - Each new hole is a variation of a hole that already passed: Afterglow (31), or an older hole with the same lesson. The shard moves bodies a little and swaps in the new body type.
  - Most rules then hold by construction.
- **Heuristic checks in place of searches, each a few seconds:**
  - **No straight ace:** a body or a wall blocks the straight line from the tee to the cup, checked as geometry, plus a 60-shot sweep around that line instead of 20,160.
  - **No stuck ball:** rests stay out of mover sweeps and out of burst bands at the route clocks, checked as geometry from the hole data.
  - **The route works:** `--three`, at one frame rate plus the jitter case.
  - **A fair target:** `--windows` on the last shot.
- **Not run per hole any more:** `--two-shot`, the full `--sweep`, the 1500-shot `--escape`, and the 200-trial noisy-human model.
  - The orchestrator runs `--escape` and `--two-shot` once, in the background, across the finished sector at merge. Only a timeout, a stuck ball or a shortcut that beats three stars sends a hole back.
  - The designer's playtest is the difficulty check, as it was for holes 26 to 29.
- **Time-box:** about 15 minutes per hole and 30 for the boss.

## C. Sector 7 dressing

- **Sector name:** "Beyond the Core". A new palette of deep teal and white-hot flares, never green or orange, and a starfield thinning into the dark between galaxies.
- **Arrival log:** "Log: following the signal. It went this way."
- **Sam's pool for holes 31 to 35:**
  - "Stay close to it, Lumen."
  - "Bursts! Time it, time it..."
  - "Our new friend is fast."
- **The Probe Log gains two facts:**
  - burst star: "Gamma-ray bursts are the brightest explosions known in the universe."
  - Sector 7: "The space between galaxies is emptier than any vacuum we can make."
  
  The reviewer checks both, as for C in v0.11.
- **The rank ladder:** 35 holes give up to 140 stars. "More holes coming" moves to above the 150-star rank.

## D. Saves

- `saveVersion` bump only if a new field is needed. Unlocks extend naturally: hole 31 opens when hole 30 is cleared. `migrate` keeps `unlocked` at least at the highest cleared hole plus one.

## E. Out of scope

New badges, alien mode, changes to holes 1 to 30, and any other physics.

## F. Acceptance

- **Mechanic layer:**
  - The burst star draws its telegraph and front.
  - A front catches a moving ball and not a resting one, and the penalty and return work.
  - Harness parity: the game and `sim-golf` agree on a scripted catch.
  - Determinism holds at 30, 60 and 144 fps.
- **Content:** every hole passes the merge gate. The menu grid (v0.12) fits 35 tiles.
- `npm run smoke` passes. Frame time is not slower than v0.12 on a hole with two burst stars.
