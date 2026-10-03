# Gravity Golf PRD v0.7: exotic badges, secret slots and a Black Hole tier

Status: locked 2026-10-03 by the designer, who relayed the art session's note (`docs/art/HANDOFF-gravity-golf-exotic-badges.md`) and asked for it to be written and locked. Builds on v0.6 (the rank ladder), which is built first. The names are the designer's. The conditions below are the orchestrator's final version of the note's proposals, each changed only where the game could not detect the proposal cleanly.

## A. The Black Hole tier

- It is a fifth badge tier above Star, for the rarest acts: `BADGE_TIERS` gains "Black Hole".
- Rim: near-black (#17151c) with a thin glowing orange accretion ring (#fb923c), the same look as the top of the rank ladder.
- Its tile and earned ticket draw the rim with a slow glow pulse, and a deeper chime than the Star tier (principle 16).

## B. Secret badges

- A secret badge shows as a dark medal with "?" in the middle and its tier rim. Its name and condition stay hidden; only the tier shows, as the hint of how rare it is. Earning it reveals the name, the condition and the medal, with the usual ticket.
- Secrets count in the missions total ("3 / 20"), so a player knows something is still hidden.
- **Badges do not move the rank** (v0.6 A: stars only). The note assumed they might; the locked v0.6 rule wins.

## C. The nine badges

New ids are in brackets. "On the sinking shot" means the stroke that holes out, measured during that one flight.

| Badge | Condition | Tier | Secret | Medal symbol |
| --- | --- | --- | --- | --- |
| Improbability [improbability] | Hole out on exactly your 42nd stroke on one hole (penalty strokes count). | Black Hole | yes | a folded towel on a tee, question-mark sparkles |
| Wormhole [wormhole] | A hole in one on a hole whose three stars need 2 or more strokes. | Black Hole | no | a glowing tunnel with the cup at the far end |
| Dark Matter [dark-matter] | On the sinking shot, the ball never comes within `darkMargin` (60) of any planet, moon, sun, black hole, bar, comet or wall surface after leaving the tee, but its heading turns by at least `darkTurn` (35°). Bent by pull alone, with nothing visible nearby. | Black Hole | yes | an empty dark disc with a faint violet ring |
| Heat Death [heat-death] | The ball drops into the cup at under `heatSpeed` (the harness sets it at about 12% of `sinkSpeed`): the slowest possible roll-in. | Black Hole | yes | a dim grey ball at a cold blue cup |
| Great Attractor [great-attractor] | Under par on every hole of one sector (five holes, `sectorSize`) in one sitting, played in order with Next from the sector's first hole. | Star | no | small galaxies pulled toward one bright point |
| Kessler Cascade [kessler-cascade] | One sinking shot that bounces at least `kesslerBounces` (5) times off walls, edges, planets or bumpers, counting only impacts over `bounceEventSpeed`. | Planet | no | tumbling fragments round a cup |
| Lagrange Point [lagrange-point] | On the sinking shot, the ball slows below `lagrangeSpeed` (60) in open space, touching nothing, while the net pull on it is under a quarter of the strongest single pull (two bodies balancing). | Star | no | a ball balanced on the line between two planets |
| Relativistic [relativistic] | Reach `relSpeed` on any shot (the harness sets it so a good player reaches it on at least three holes, above full-power launch speed 820). | Planet | no | a ball stretched into a streak |
| FTL [ftl] | Reach the speed cap, `speedMax` (1,400): the game's light speed. It is reachable only with a slingshot chain. | Black Hole | no | a ball ahead of its own light cone |

**Name change.** "Improbability Drive" is shortened to "Improbability". The repo's parody rule (no quoted phrase from someone else's work, since the repo is a public website) rules out the full phrase. The note itself offered this fallback, and the 42 and the towel keep the wink. The designer can overrule this in one word.

**Changes from the note.**
- Wormhole: holes have one tee each, so "the farthest tee" became "an ace that beats the designed route".
- Kessler: "every wall on a hole" was trivial on one-wall holes and impossible on holes with none, so it became five bounces on one sinking shot.
- Great Attractor: under par on every hole is the same as three stars on most holes, so it became a sector played in one sitting.

## D. Reachability (light checks, no exhaustive sweeps)

- **Improbability:** there is no stroke cap today (only `maxFlightSeconds` per flight), so 42 strokes is allowed. The build must not add a cap or a give-up prompt below 50.
- **Wormhole:** with `tools/sim-golf.mjs --sweep`, find at least one hole where an ace exists with an aim window of at least 1°. Name it in the changelog, but not in the game, since the badge is not secret yet its route is the find. If no hole qualifies, the condition becomes "an ace on any hole from hole 11 on", and the changelog says why.
- **Dark Matter, Lagrange Point, Heat Death, Kessler Cascade:** find one route per badge with the harness, on any hole (a targeted search on two or three likely holes, time-boxed). Record the hole and drag in the changelog. If one cannot be found in the time box, the builder keeps the condition and reports the margin closest to it, and the orchestrator retunes the number.
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
