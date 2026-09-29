# PRD v0.3: Gravity Golf (delta from v0.2)

| | |
| --- | --- |
| Slug | `gravity-golf` |
| Version | 0.3 |
| Date | 2026-09-29 |
| Status | locked for the mechanic delta, content and missions |
| Answers | playtest 2026-09-29: all stars on the planet holes, satisfying; wanted black holes, comets and more moving objects; the designer's brief: more gamification and more content |

Everything in v0.1 and v0.2 stands unless changed here.

## A. New objects

**Comet.** A small fast body (radius `cometR`) that crosses the field along a straight path between two points on the hole clock: it appears at `a`, travels to `b` in `period` seconds, vanishes, and reappears at `a` when the clock wraps. No gravity. Contact bounces the ball hard: the comet's velocity is added to the ball's on impact (`cometPush` times its speed) and `wallBounce` applies. A comet never rests; a ball can never rest inside its path (it is treated as a mover for the rest rule). Drawn with a bright head and a tail trailing its motion.

**Black hole.** A circle of radius `holeR2` with a visible event horizon ring and a pull like a planet of mass `bhMass` outside `bhPullR`. A ball whose centre crosses the horizon is swallowed: one penalty stroke, a short swallow animation, and the ball returns to where the shot started (the last rest), not the tee. There is no surface and no landing. Black holes are announced: a slow inward swirl. Shards keep them out of any straight line from tee to cup unless a wall already blocks it, so they punish greed, not first attempts.

Both are movers or hazards on the existing rules; the physics step gains one contact case and one swallow case.

## B. Content

Holes 11 to 15, sharded, proven by the harness (which gains comet and black hole support):

| # | Name | Teaches | Objects | three / two |
| --- | --- | --- | --- | --- |
| 11 | Comet Lane | time a crossing comet | planet, comet across the approach | 1 / 3 |
| 12 | Event Horizon | skirt a black hole's pull for a bend without crossing the horizon | black hole, walls | 1 / 3 |
| 13 | Meteor Shower | two comets on different periods; find the gap | planet, 2 comets | 2 / 4 |
| 14 | Singularity | slingshot a planet into a black hole's pull and out again | planet, black hole, sun | 2 / 4 |
| 15 | Collapse (boss) | moon, comet and a black hole guarding the cup; three timed shots | planet, moon, comet, black hole | 3 / 5 |

Every hole from 11 on keeps the no-straight-ace rule, the escape rule (black holes excluded: they have no surface), and the timeout rule.

## C. Missions (progression layer)

Badges in four themed tiers: Meteorite, Moon, Planet, Star. Each badge is earned by a skill act, never by time spent:

| Tier | Badge | Earned by |
| --- | --- | --- |
| Meteorite | First Orbit | any three-star hole |
| Meteorite | Banker | ace hole 2 |
| Moon | Slingshot | three stars on hole 3 |
| Moon | Touchdown | land on a planet and sink next shot, any hole |
| Moon | Untouched | finish a hole with a sun without touching it, holes 6, 9, 10 |
| Planet | Binary Star | three stars on hole 5 |
| Planet | Clockwork | three stars on holes 8 and 9 |
| Planet | Never Landed | a full run of 10 holes without resting on a planet |
| Star | Eclipse | three stars on hole 10 |
| Star | Perfect Run | three stars on every hole |
| Star | Under Par | a full run in 20 strokes or fewer |

A missions screen on the menu shows the tiers, earned badges lit, unearned with their condition. Earning a badge pops it on the card. Saved per badge.

## D. Experiment for tomorrow

Field feel presets on the tune panel: "Ice" (friction 0.45, captureStrength 700), "Turf" (current 0.28, 900), "Sand" (0.18, 1100), with sliders for friction and captureStrength. The three-star routes are proven at Turf; the experiment asks which field feels best, not which is fair.

## E. Tuning additions

| Name | Value | Meaning |
| --- | --- | --- |
| cometR | 10 | Comet radius |
| cometPush | 0.8 | Fraction of the comet's velocity added to the ball on contact |
| holeR2 | 26 | Black hole horizon radius |
| bhMass | 1.4 | Pull strength as a planet mass |
| bhPullR | 26 | Distance below which the pull stops growing (equals the horizon) |
| bhPenalty | 1 | Strokes per swallow |

## F. Scope fence

Not in v0.3: sun gravity, portals, moving cups, collectibles, wormholes, more than 15 holes.
