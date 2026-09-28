# PRD v0.2: Gravity Golf (delta from v0.1)

| | |
| --- | --- |
| Slug | `gravity-golf` |
| Version | 0.2 |
| Date | 2026-09-28 |
| Status | locked for the mechanic delta and content re-authoring |
| Answers | playtest 2026-09-28 (v3): "way better, but too easy: three stars on almost everything first try; every well caught the ball and handed me the hole" |

Everything in `prd-v0.1.md` stands unless changed here. This delta changes the field objects, the star rule, the content plan and the verification rules.

## A. Field objects

**Removed: gravity wells.** A point attractor the ball can fall into hands the player a known position with a clear line to the hole. Gone entirely.

**Added: planets.** A solid circle with a surface and a gravity field.

- The ball bounces off the surface like a bumper (`wallBounce`).
- Gravity applies only outside the surface: acceleration toward the centre equals `planetGravity` times the planet's mass, divided by distance from the centre squared, with the distance never taken smaller than the radius. There is no interior and no core.
- A slow ball near a planet can land on it: it comes to rest touching the surface. Resting on a planet is allowed and is a normal lie; the next shot has to leave the pull.
- Per-planet data: centre, radius, mass multiplier (1.0 is standard; bosses may use up to 1.5 if the escape rule holds).

**Added: suns.** A hazard circle with a bright field.

- Touching a sun's surface costs `sunPenalty` strokes (1). The ball bounces off (`wallBounce`) and play continues. A sun has no gravity in v0.2 (keep it readable; gravity is what planets do).
- The penalty shows immediately: a stroke pops on the HUD with the `miss` sound and a 30 ms haptic; the sun flares.
- Touching the same sun twice in one flight counts twice.

**Added: moving parts**, all on the hole clock that starts at zero when the hole starts and restarts from zero whenever the ball comes to rest (v0.1 section 6 rule, unchanged):

- Sliding wall (exists): oscillates between two positions on a period.
- Rotating bar: a wall that spins about a pivot at a constant angular speed; collision treats it as a moving segment.
- Orbiting moon: a small planet (radius 10 to 16, mass 0.25 to 0.5) circling a parent planet at a fixed orbital radius and period. Its gravity and surface move with it. Moons are boss material.

Kept: axis-aligned walls, bumpers (a bumper is now simply a planet with mass 0), the four border walls, the cup with capture, friction, the fixed physics step and the speed clamp.

## B. Star rule

Each hole declares `stars: { three: N, two: M }` where `three` is the fewest strokes the designer proved in the harness and `two` is a competent route, usually `three + 1`. One star is any finish. Par on the card is `two`.

- Simple holes: `three` is 1. Complex holes: `three` is 2 or 3. Boss holes: `three` is 2 or 3 and `two` is up to 5.
- The card shows the star thresholds ("3 stars: 2 shots") so the target is known before the player retries.

## C. Content plan (replaces v0.1 section 9's hole list)

Ten holes. Every hole from 4 onward has **no straight-line ace**: a harness sweep of every aim angle at 0.5 degree steps and every power at 5 px steps, with zero bounces and no planet pass closer than 80 units, must sink nothing. Aces on those holes exist only through a bank, a slingshot or a moving part.

| # | Name | Teaches | Objects | three / two |
| --- | --- | --- | --- | --- |
| 1 | First Light | drag, power; one planet beside the line bends the shot | 1 planet | 1 / 2 |
| 2 | Bank Shot | bank off a wall; straight line fully blocked | walls | 1 / 2 |
| 3 | Slingshot | pass close on the correct side and get whipped to the hole; straight line blocked by a wall | 1 planet, wall | 1 / 3 |
| 4 | Landing | land on a planet, then shoot from its surface through a gap the field blocks otherwise | 1 planet, walls | 2 / 3 |
| 5 | Binary (boss) | double slingshot between two planets | 2 planets, walls | 2 / 4 |
| 6 | Solar Flare | a sun guards the tight side of the planet; the safe slingshot is the far side and needs more power | planet, sun, walls | 1 / 3 |
| 7 | Pinball | banks off planets used as bumpers, no gravity route | 3 small planets (mass 0.3), walls | 1 / 3 |
| 8 | Tide | a sliding wall opens the slingshot exit on a rhythm | planet, sliding wall | 1 / 3 |
| 9 | Windmill | a rotating bar in the approach; time the pass or use the planet to curve behind it | planet, rotating bar, sun | 2 / 4 |
| 10 | Eclipse (boss) | orbiting moon around a big planet; the slingshot window moves; a sun on the near side | planet, moon, sun, walls | 3 / 5 |

Each hole's data carries a comment with the teaching goal, the intended `three` route as a concrete drag vector (and release clock for moving parts), and, for holes 4 and up, the result of the no-straight-ace sweep.

## D. Verification (adds to v0.1 section 15)

- [ ] Escape rule: from rest on the surface of every planet on every hole, at 8 points around it, some full-power shot carries the ball at least 250 units from the planet's centre. No trap states; zero timeouts over 1500 random shots per hole.
- [ ] Slingshot observable: a ball at 400 units per second passing a mass-1 planet of radius 40 at 20 units from its surface bends by at least 90 degrees measured 200 units after closest approach, and leaves. Verified in the harness; `planetGravity` is tuned until it holds together with the escape rule.
- [ ] No straight-line ace on holes 4 to 10, by the sweep in section C.
- [ ] Every `three` route sinks from its stated drag vector and release clock, at 30 to 144 fps.
- [ ] A sun touch adds exactly one stroke per touch and the ball continues.
- [ ] Moving parts are deterministic against the hole clock.
- [ ] A first-time player gets two stars on holes 1 to 3 without a tip, and three stars on hole 1 only with a good shot.

## E. Tuning additions

| Name | Value | Meaning |
| --- | --- | --- |
| planetGravity | 4500000 | Acceleration toward a planet is this times mass over distance squared; starting value, tuned to the observables |
| planetMinR | 24 | Smallest planet radius (bumper-planets) |
| sunPenalty | 1 | Strokes added per sun touch |
| landSpeed | 60 | Below this speed, a ball touching a planet comes to rest on it |
| moonMassMax | 0.5 | Cap on moon mass |
| barAngularSpeed | 1.2 | Radians per second for a rotating bar |

Removed: `wellStrength`, `wellMinDist`, `wellR`, `holdAccel`.

## F. Scope fence additions

Not in v0.2: black holes, sun gravity, planets with atmospheres or drag, moving holes, portals, collectibles.
