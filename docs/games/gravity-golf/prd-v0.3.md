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

## C2. Skins (added 2026-09-29, late; from the overnight plan's unlockables rule)

Skins are earned by badges only, never by grind, and are data entries in the art layer: a ball palette (body, seam, shadow tint) and a trail colour. No change to physics, the range finder or the cup.

| Skin | Kind | Earned by |
| --- | --- | --- |
| Comet | ball: ice-blue body, cyan trail | First Orbit |
| Brass | ball: brass body, warm trail | Banker |
| Ember | ball: dark red body, orange trail | Slingshot |
| Moonstone | ball: pale grey body, white trail | Touchdown |
| Solar | ball: yellow body with a corona seam, gold trail | Untouched |
| Nebula | ball: purple body, magenta trail | Binary Star |
| Chrome | ball: mirror grey, silver trail | Clockwork |
| Void | ball: black body with a thin white rim, violet trail | Never Landed |
| Eclipse | ball: white with a black crescent seam, no trail | Eclipse |
| Gold | ball: gold body, gold trail | Perfect Run |
| Under Par | trail only: green | Under Par |

Readability rule: the ball must stay the brightest sphere on the field for every skin (the style anchor says the ball is the only white sphere; for dark skins the rim carries the brightness). Sample the ball against the darkest backdrop band per skin and keep at least 3:1. A Skins row on the missions screen picks the ball and the trail; locked swatches toast their badge; the choice persists with one save bump and a migrate that keeps everything. The skin shows in play, on the card and on the menu.

## C3. Fixes from the v8 review (do in the same build as C and C2)

1. Hole 6: the sun move opened a 21-unit slot between the left wall and the sun where a soft shot stacks three to five penalties (`--index 5 --drag 48.8,48.8` charges four). Keep the 24-unit gain from the planet and leave at least 30 units between the sun and the wall (move it up or down, not sideways); re-run the soft-shot sweep and report doubles and triples.
2. The menu title sits at 9 percent of the height with no safe-area term, so on a notched phone the engine's TUNE tab covers its end ("GRAVITY GOL"). Place the title below `E.safe.top + 42`.
3. Comet kick when the ball is slow: the code reflects, adds 0.8 times the comet's velocity, then reflects again against the comet's velocity, so a ball at rest leaves a 200 u/s comet at 234 instead of 160. Rule, added to A: a comet overtaking a slow ball pushes it on like a moving wall, so the ball leaves at no less than the comet's speed along the comet's direction and the 0.8 kick applies on top only when the ball's approach speed exceeds 0.235 of the comet's. Keep the code, state the rule, and make sure the synthetic-hole numbers still match at 30, 60 and 144 fps.
4. Changelog: the v0.3 line says the cache was not bumped (it is v8), and claims a 2 percent field shrink with a 47 px notch (measured scale 1.037 both ways). Fix both.

## D. Experiment for tomorrow

The review of v0.2 measured that 83 to 90 percent of missed shots on holes 1, 3, 6 and 8 end landed on the planet, and that `planetGravity` 3e6 brings that to 66 to 75 percent, 2e6 to 51 to 60 percent, and `stopSpeed` 80 at 3e6 to about 50 percent. That is the "planet catches me" feel, so the experiment is gravity, not field friction. Presets on the tune panel: "Heavy" (planetGravity 4.5e6, stopSpeed 50, the proven defaults), "Medium" (3e6, 50), "Light" (2e6, 50), "Light and rolling" (3e6, stopSpeed 80); sliders for planetGravity and stopSpeed. The routes are proven at Heavy only; once the designer picks, the routes are re-proven and re-authored where they break, and the pick becomes the default. Field friction presets wait for a later round.

## D2. Fixes from the v0.2 review (do in the same build)

- Hole 7 has a low-skill floor bank ace (an 18.5 degree cluster around drag (-85,-85)); close it with a wall or bumper and re-prove; consider two = 2.
- Hole 6's sun sits inside the planet's pull so a soft miss stacks 3 to 4 penalties; move it 20 to 30 units farther from the planet and re-prove.
- The ring system on mass 1.5 planets is drawn to 1.68 radii and reads solid; draw rings to about 1.35 radii or fade them.
- The Retry button overlaps the field's top-right corner; place it below the HUD from the field top.
- The range finder is orange by 80 percent power; keep white to amber and reserve orange for full power.
- Tint the moon cooler so the ball stays the only white sphere.
- Add `stopSpeed` to the tune panel; fix the changelog (placeholders are gone, cache is v7).
- Hole 7's bumpers are mass 0; the PRD's "mass 0.3" is amended to mass 0 (no gravity route is the point).

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
