# Gravity Golf PRD v0.8: Sector 6, holes 26 to 30

Status: locked 2026-10-03. The designer said "we're soon going to need more holes" and gave a budget of 10 percent of the weekly plan for this and the work in flight. Builds on v0.7 (exotic badges). This sector opens ranks 9 and 10: 90 stars is reachable once every hole has three stars.

## A. The sector

- **Sector 6, "Galactic Core"** (holes 26 to 30): a denser, warmer star field, with a faint golden glow of the galaxy's core rising from one edge. It is one new entry in `TUNING.art.sectors`, cosmetic only.
- Backdrop contrast stays within the v9 measurements, like every sector. The orchestrator picked the name and look as the simplest option; the designer can rename it.
- Only existing objects: planets (including massless bumpers), moons, heavy suns, black holes, comets, slides and bars. No new mechanic. The burst hazard is a later PRD.
- Shape of the sector:

| Hole | Role | Must include |
| --- | --- | --- |
| 26 | Opener: teaches the sector's idea, the balance between two pulls | two bodies of similar pull with a usable balance point in open space |
| 27 | Moon timing with a heavy sun | a moon, a sun (`mass` set) |
| 28 | Three bodies all bending one shot | three or more gravity bodies on the route |
| 29 | Comets and a black hole | two comets, a black hole |
| 30 | **Boss**: tests the sector | a moon, a sun, a black hole, and at least one comet or slide; the route uses at least three different bodies |

- **Badge-friendly by design, never by requirement.** Hole 26 should have a balance point where Lagrange Point can be earned, and hole 28 should allow Great Attractor. These are finds: no three-star route may earn a new v0.7 badge, except Dark Matter. Per v0.7 C it is a common secret on any zero-touch route bent by two bodies; hole 28's route earns it, which is accepted. Check this with the v0.7 badge code.

## B. Rules (every hole, from v0.3 B, v0.4 C and v0.5)

**Must-pass, harness-checked:**
- A proven three-star route.
- A two-star (par) route.
- `--sweep` reports 0 straight sinks, at the route's release clocks for holes with movers.
- `--escape` reports 0 timeouts.
- `--windows`: the three-star route's last shot has at least 20 px and 4° with the neighbour check (boss: 15 px and 3°), as the harness enforces.
- A noisy-human success rate for the last shot of at least 60 percent, and for the whole route of at least 35 percent. A boss may go to 25 percent for the whole route.
- Suns are heavier than every planet on their hole, and lighter than any black hole on it.

**Delivery:** shards deliver hole JSON plus harness output per `docs/games/gravity-golf/README.md`, "What a shard delivers per hole". The orchestrator merges them into `LEVELS`, and a small build adds the sector entry and the save migration.

**Lean (2026-10-03):**
- `--two-shot`, the 20 to 25 minute search, runs once per hole at the merge gate, not during authoring.
- An extra route that matches the three-star count is a note, not a failure.
- Each shard time-boxes authoring at about 60 minutes per normal hole and 120 minutes for the boss.

## C. Saves

Per v0.5 D2:
- bump `saveVersion` (to 9, or the next free number after v0.7);
- `migrate` so `unlocked` is at least the highest cleared hole plus one;
- drop `prog.runBest` and `prog.lastRun`;
- keep stars and badges.

Badge texts that name hole counts (Never Landed, Under Par, Perfect Run) read `LEVELS.length` and update on their own. Confirm this.

## D. Out of scope

- New objects or mechanics.
- New badges or rank changes.
- Any change to holes 1 to 25.

## E. Acceptance

- Every must-pass in B, with a table in the changelog.
- One fresh review re-runs the windows and one `--three` per hole, and plays holes 26 and 30 on the phone viewport.
- `npm run smoke` passes.
