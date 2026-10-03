# Gravity Golf PRD v0.7: exotic badges, secret slots and a Black Hole tier

Status: locked 2026-10-03 by the designer, revised the same day with the designer's conditions (C). First relayed the art session's note (`docs/art/HANDOFF-gravity-golf-exotic-badges.md`) and asked for it to be written and locked. Builds on v0.6 (the rank ladder), which is built first. The names are the designer's. The conditions below are the orchestrator's final version of the note's proposals, each changed only where the game could not detect the proposal cleanly.

## A. The Black Hole tier

- It is a fifth badge tier above Star, for the rarest acts: `BADGE_TIERS` gains "Black Hole".
- Rim: near-black (#17151c) with a thin glowing orange accretion ring (#fb923c), the same look as the top of the rank ladder.
- Its tile and earned ticket draw the rim with a slow glow pulse, and a deeper chime than the Star tier (principle 16).

## B. Secret badges

- A secret badge shows as a dark medal with "?" in the middle and its tier rim. Its name and condition stay hidden; only the tier shows, as the hint of how rare it is. Earning it reveals the name, the condition and the medal, with the usual ticket.
- Secrets count in the missions total ("3 / 20"), so a player knows something is still hidden.
- **Badges do not move the rank** (v0.6 A: stars only). The note assumed they might; the locked v0.6 rule wins.

## C. The nine badges

New ids are in brackets. "On the sinking shot" means the stroke that holes out, measured during that one flight. "Bent by a body" means that body's pull alone turned the ball's heading by at least `bendTurn` (10°) over the flight. It is measured per body, by adding up the sideways part of that body's pull each physics step. "Gravity bodies" are planets with mass, moons, suns and black holes.

Revised by the designer on 2026-10-03, after the first draft.

| Badge | Condition | Tier | Secret | Medal symbol |
| --- | --- | --- | --- | --- |
| Improbability Drive [improbability] | Hole out on exactly your 42nd stroke on one hole. Penalty strokes count. | Black Hole | yes | a folded towel on a tee, question-mark sparkles |
| Wormhole [wormhole] | A hole in one on a hole whose three stars take two strokes (or more). | Black Hole | no | a glowing tunnel with the cup at the far end |
| Dark Matter [dark-matter] | The sinking shot is bent by two or more different gravity bodies and touches nothing at all on the way: no wall, edge, body, bar or comet. | Planet | yes | an empty dark disc with a faint violet ring |
| Heat Death [heat-death] | Either sink the ball at under `heatSpeed` (set by the harness, about 12% of `sinkSpeed`), the slowest possible roll-in; or hole out after at least `heatMinutes` (10) minutes of play on that hole, counted only while the hole is on screen and the app is visible. | Black Hole | yes | a dim grey ball at a cold blue cup |
| Great Attractor [great-attractor] | The sinking shot is bent by every gravity body on the hole, on a hole with at least three of them. Everything on the hole pulled it in. (Designer confirmed, 2026-10-03.) | Star | no | small galaxies pulled toward one bright point |
| Kessler Cascade [kessler-cascade] | On one hole, touch every wall, including the four field edges, at least once, then still hole out. The strokes can be spread over the hole. Only impacts over `bounceEventSpeed` count. | Planet | no | tumbling fragments round a cup |
| Lagrange Point [lagrange-point] | The ball comes to rest in open space, touching nothing, exactly between two gravity bodies. Each body pulls on it with at least `lagrangePull` (4 times the open-field rest threshold, `restPull()`), the two pulls point at least 150° apart, and the net pull is under the rest threshold, so they cancel. It is earned the moment the ball settles there, sinking or not. | Star | no | a ball balanced on the line between two planets |
| Relativistic [relativistic] | Reach `relSpeed` on any shot. The harness sets it so a good player reaches it on at least three holes, above the full-power launch speed of 820. | Planet | no | a ball stretched into a streak |
| FTL [ftl] | Reach `ftlSpeed`, the fastest any shot in the game goes with a fair window (set by the harness; amended 2026-10-03, see below). | Black Hole | no | a ball ahead of its own light cone |

**Name.** "Improbability Drive" stays, by the designer's call. A short name is not protected by copyright, and the medal art is our own.

**Amendment after the build (2026-10-03).** FTL was "reach the speed cap, 1,400". The build found that no gravity route goes above about 939, and the cap is reached only by a comet pinning the ball on hole 19, with a 0.05° window. So FTL became the game's top fair speed: the highest speed any hole reaches with at least a 1° aim window, kept at least 50 above Relativistic. The Heat Death slow sink was a pinpoint at 45 (0.25°, 1 px), so `heatSpeed` was raised to the lowest speed with a fair window, at most 40 percent of `sinkSpeed`.

**Notes on the revisions.**
- Dark Matter drops from Black Hole to Planet tier. Some designed routes already sink with zero bounces after two planets bend the ball (hole 4's double pass, for one), so many players will find it. It stays secret, so finding it is still a surprise. If the designer wants it rarer, the step up is three bodies.
- Heat Death has two ways in. The 10-minute way rewards stubbornness. The hole-time clock pauses whenever the app is hidden or the player is on another screen, so leaving the phone on the table does not earn it.
- Kessler Cascade counts the four field edges as walls. That way every hole has at least four, and none is impossible. It may take many strokes; the designer chose "still make it in" over par.
- Lagrange Point is about coming to rest, not sinking. The game already lets a ball settle in open field where the pull is weak, so a balanced point between two bodies is a real place the ball can stop.

## D. Reachability (light checks, no exhaustive sweeps)

- **Improbability:** there is no stroke cap today (only `maxFlightSeconds` per flight), so 42 strokes is allowed. The build must not add a cap or a give-up prompt below 50.
- **Wormhole:** with `tools/sim-golf.mjs --sweep`, find at least one hole where an ace exists with an aim window of at least 1°. Name it in the changelog, but not in the game, since the badge is not secret yet its route is the find. If no hole qualifies, the condition becomes "an ace on any hole from hole 11 on", and the changelog says why.
- **Dark Matter, Great Attractor, Lagrange Point, Heat Death (slow sink), Kessler Cascade:** find one route per badge with the harness, on any hole (a targeted search on two or three likely holes, time-boxed). Lagrange Point needs a hole where two bodies' balance point lies in open space within reach of a shot; Great Attractor needs a hole with three or more gravity bodies whose route bends past each. Record the hole and drag in the changelog. If one cannot be found in the time box, the builder keeps the condition and reports the margin closest to it, and the orchestrator retunes the number.
- **Relativistic and FTL:** report the top speed on each hole's three-star route. Set `relSpeed` so at least three holes' routes reach it. Confirm FTL is reached on at least one hole by a route with two or more slingshot passes.

## E. Medals and saves

- The art session makes the nine medals in the showpiece style, two options each, for the designer to pick. They land in `docs/art/final/gravity-golf/medal-<id>.png` at 256 px. The secret "?" medal is drawn on the canvas. Until the art lands, the drawn medal is used: the new tier gets a drawn black-hole icon.
- Save: there is no shape change, because badges are already a map of id to earned. The progress for Great Attractor's sitting is in-memory only, like the existing runs. `saveVersion` stays 8.
- Stats for the conditions are measured from the physics already stepping (speed, nearest surface, heading, bounce count, net pull). They are measured, never stored, and they never change the physics.

## F. Out of scope

- The burst hazard and the alien mode. Both are in `docs/game-ideas.md`.
- Skins for the new badges.
- Any change to holes, physics, stars, par or the rank.

## G. Acceptance

- Each badge is earned by a scripted shot in Playwright (or by an injected state where a 42-stroke run would be slow), with the ticket shown.
- Secrets show "?" until earned, then reveal the name, condition and medal.
- None of the new conditions fires on a normal three-star route unless the table says it should.
- The missions screen fits 20 badges at 390x844, with scrolling if needed. The Black Hole rim reads against the dark background.
- `npm run smoke` passes. The play frame is not more than 5 percent slower than v0.6 with the stats running.
