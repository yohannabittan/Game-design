# PRD v0.1: Launch

| | |
| --- | --- |
| Slug | `launch` |
| Version | 0.1 |
| Pattern | P1 + P8 |
| Date | 2026-09-30 |
| Status | locked |

This document is the one-shot contract. A builder session gets this, the skeleton, and the layer prompt. If something is not in here, the builder should not invent it.

## 1. Pitch

Slingshot a round critter as far as you can, burning a little fuel and bouncing off the world to keep going. The fantasy: a ridiculous flight engineered to the metre.

## 2. The first ten seconds

The critter sits in a slingshot at the left of a landscape screen. Press anywhere and drag back (left and down); the band stretches from the fork to the critter, the critter follows the thumb up to a maximum pull, and a dotted arc shows the first 0.6 s of flight. Release: the critter flies, the camera follows it (the critter stays in the left third while climbing), the ground scrolls, distance ticks in the top corner. It touches a spring pad and bounces with a boing. It slows to a stop. Card: distance, best, coins earned, and a single Launch Again button.

## 3. Core loop and session shape

- Loop: drag back, release, watch and tap boost during flight, bounce, stop; card; shop between flights; repeat.
- A flight lasts 8 to 40 seconds. A sitting is several flights.
- A flight ends when the critter's speed stays under `stopSpeed` for 0.5 s, or it lands in mud.
- Closing the app mid-flight discards the flight (flights are short).

## 4. Controls

Landscape (ADR-0013: the flight is a long horizontal arc). One thumb.

| Gesture | Where | Does |
| --- | --- | --- |
| Press and drag | anywhere, before launch | pulls the slingshot; angle and power from the drag vector (opposite direction), power capped at full pull |
| Release | | launches; a drag shorter than `dragDead` cancels |
| Tap | anywhere, in flight | fires one boost pulse (costs fuel) |
| Hold | anywhere, in flight | continuous boost while fuel lasts (the shop's Rocket upgrade unlocks hold; base is tap pulses only) |

Keyboard fallback: arrows set angle and power, Space launches and boosts.

Occlusion: the pull is measured from where the thumb lands, anywhere on screen, so the thumb never covers the critter or the arc preview. In flight the critter sits in the upper left third and taps can be anywhere.

## 5. Skill model

- **Skill axis:** launch angle and boost timing.
- **Intermediate tips:** launch around 38 to 42 degrees; boost while rising.
- **Expert tips:** aim the first landing onto a spring; skim birds (a bird bounce keeps horizontal speed and adds lift); save a pulse to clear a mud patch.
- **Legendary:** chaining springs at speed so the critter never touches plain ground.
- **Naked run:** the first milestone (500 m) is reachable with no upgrades: a clean launch plus two spring hits clears it. Every milestone after that is reachable by an expert with at most two upgrade levels (proven by the harness).
- **Outsized reward for skill:** a spring hit at high speed multiplies vertical speed; consecutive springs or birds without touching plain ground build a chain multiplier on coins (x1, x1.5, x2, x3).

## 6. Randomness policy

- Random in setup: the field (positions of springs, birds, mud, ramps) from a seed per flight, placed in chunks so the density is fair (no two mud patches without a spring between, a spring within reach of every 150 m).
- Deterministic in resolution: the same seed, launch vector and boost times give the same flight at any frame rate (fixed step).
- Seed: per flight for v0.1, shown on the card; a daily seed is deferred.

## 7. Goal, fail, score

- A flight ends as in section 3. There is no fail, only distance.
- Score: distance in metres (1 m = 10 design units). Coins: 1 per 10 m times the chain multiplier at the time, plus 5 per bird bounce.
- Milestones: 500, 1000, 2000, 3500, 5000 m; each pays a one-time coin bonus and a star on the card.
- End card: distance, best, coins earned (with chain), Launch Again. Shop button beside it.

## 8. Progression in v0.1

Coins persist. A shop between flights with four upgrades, three levels each, prices rising: Band (launch power), Fuel (boost tank), Rocket (level 1 unlocks hold-to-boost, then thrust), Aero (less drag). Upgrades raise the ceiling but the milestones are set so skill matters at every level (section 5). Deferred: skins, badges, missions, daily seed, other critters.

## 9. Content plan

- One endless field generated in 300 m chunks from a data table of chunk templates (each: a list of objects with x offset, y, kind).
- Objects: ground (plain, loses speed), spring pad (bounces, multiplies vertical speed), bird (moving at a height; a hit from above bounces the critter up and keeps horizontal speed), mud (stops the flight), ramp (redirects along its slope).
- The first chunk is fixed and teaches: a spring at the natural first landing of a clean launch, then a bird, then the first mud patch with a spring before it.
- Difficulty: chunk templates are tiered by distance (more mud and fewer springs past 2000 m).

## 10. Juice list

| Event | Visual | Sound | Haptic |
| --- | --- | --- | --- |
| Pull | band stretches, critter squashes, arc preview | rising creak | none |
| Launch | band snap, dust puff, camera kick | `hit` (low) | 12 ms |
| Boost | flame puff behind the critter, fuel gauge ticks | short whoosh | 6 ms |
| Spring | pad compresses and pops, speed lines, "Boing" | `hit` (high) | 10 ms |
| Bird | feather burst, the bird tumbles off screen | squawk (synth) | 8 ms |
| Chain step | chain call-out grows (x1.5, x2, x3) | rising tone | none |
| Mud | splat, critter sticks | `miss` | 30 ms |
| Milestone | banner "500 m!" with a star | `win` | 20 ms |
| Stop | critter settles, card slides up | `lose` (soft) if no milestone | none |

## 11. Art direction

Flat shapes, a warm sky gradient, a ground band with parallax hills. Player: the orange critter (the only orange thing). Good: springs and birds in teal. Danger: mud in dark brown with a glossy top. The critter must read at arm's length against every sky band. Style sentence for later layers: "flat round shapes, warm sky, soft shadows, one orange hero".

## 12. Audio

Engine synth sounds per the juice list. No music.

## 13. Modes

One mode (endless flight with the shop). Later: daily seed, challenges (land exactly at 1000 m), other critters.

## 14. Scope fence

Not in v0.1: skins, badges, missions, daily, multiple critters, obstacles that hurt, weather, a map, leaderboards, ads, anything portrait.

## 15. Acceptance criteria

- [ ] Loads from the home-screen icon in airplane mode; locks landscape
- [ ] A first-time player launches within ten seconds without reading anything
- [ ] Card to next launch in one tap, under one second
- [ ] 500 m reachable with no upgrades (harness shows a clean launch and the fixed first chunk)
- [ ] Each milestone reachable by an expert bot with at most two upgrade levels in total (harness)
- [ ] Same seed and inputs give the same distance at 30, 60 and 120 fps
- [ ] Spring, bird, mud and plain ground are distinguishable with sound off
- [ ] No text under 14 px, targets at least 44 px, HUD inside all four safe insets
- [ ] `npm run smoke` passes

## 16. Tuning table

| Name | Value | Meaning |
| --- | --- | --- |
| pullMax | 140 | drag distance (screen px) for full pull |
| dragDead | 14 | shorter drags cancel |
| launchSpeedMax | 700 | launch speed at full pull, base Band (units/s) |
| gravity | 520 | units/s² |
| airDrag | 0.035 | fraction of speed lost per second in air, base Aero |
| groundFriction | 0.35 | fraction of horizontal speed lost per ground touch |
| groundBounce | 0.35 | vertical speed kept on a plain ground touch |
| springBounce | 1.25 | vertical speed multiplier on a spring (min launch 380) |
| birdLift | 320 | upward speed given by a bird bounce |
| boostPulse | 110 | speed added per tap along the flight direction |
| fuelMax | 5 | pulses in a full tank, base Fuel |
| stopSpeed | 25 | below this for 0.5 s ends the flight |
| unitsPerMetre | 10 | |
| coinPer10m | 1 | |
| chainSteps | 1, 1.5, 2, 3 | coin multiplier by consecutive springs or birds |
| upgradePrices | 50, 150, 400 | per level, per upgrade |

## 17. Open questions

- Does the camera zoom out at great heights? Simplest: no zoom in v0.1; a height marker at the top edge when the critter is above the screen.
- Hold-to-boost at base or only with Rocket 1? PRD says Rocket 1; builder notes feel in the changelog.

## Amendments after layer 1 (2026-09-30)

- `airDrag` is 0.025 (was 0.035): at 0.035 no expert with two upgrade levels could reach 5000 m even on an ideal field. `rampKeep` 1 (a ramp keeps all speed) is added to TUNING.
- Springs are single-use per flight (a critter could otherwise bounce on one spring forever).
- Camera (resolves open question 1, reversing the layer 1 default): the camera zooms out smoothly with height and speed, down to 0.45x, so the landing zone of the current arc is always on screen by the top of the arc; the ground band and HUD keep their screen size. Landings must be aimable by a human; the layer 1 harness showed late arcs land 300 m or more ahead of a 45 m view.
- Flight length: expert flights run 36 s median with no upgrades and up to 70 s; the 8 to 40 s target in section 3 is relaxed to "under 60 s for 90 percent of expert flights" and checked again after the camera change.
- For layer 4 (shop): Fuel dominates in the harness (Fuel 2 alone reaches 5000 m on 95 of 200 seeds; Rocket 1 adds nothing because it only unlocks hold). Price and effect of each upgrade must be balanced so each is some expert's best next buy at some point; the harness reports the best next buy from every upgrade state.

## Amendments after the layer 1 review (2026-09-30, build before layer 2)

1. Camera zoom as amended above is required before any later layer; after it, re-measure the share of flight time the critter is off screen (target: never, for flights under 600 m up) and the share of expert arcs whose landing is on screen at the arc's top (target: at least 90 percent).
2. The HUD never covers the pulled critter: the fuel gauge moves off the sling pocket (top left under the distance, or drawn only in flight), checked at 812x375 and 844x390 with 44 px side insets.
3. Mud reads at a glance: a light rim or top edge so its contrast against sky and ground is at least 3:1; springs and ramps keep theirs.
4. The result card ignores taps for 400 ms after it appears (boost taps must not dismiss it).
5. Pull affordance: on the first launch of a fresh save, a faint animated hand-drag hint behind the critter until the first pull begins; a drag under the dead zone shows "Pull further"; a pull at full power shows the band taut (a colour change) so the saturation point is visible.
6. Power window: the first spring should be reachable from about 0.85 power at 40 degrees, not only 0.97 to 1; move or widen the teaching chunk's first spring accordingly and re-prove the naked 500 m.
7. Layer hygiene: the unreachable upgrade code stays (it is the harness's upgrade model) but is grouped and commented as the layer 4 shop's model; the extra named sounds stay (the juice layer will own them).

## Decisions after the v2 round (2026-09-30)

- Camera floor stays 0.45x: a 0.39x floor (needed for 90 percent at 844x390) and 0.32x (at 640x360) shrink the world too far to read. The landing-on-screen target is 80 percent of expert arcs at 844x390 (measured 83); above the zoom, the sky pans with the critter while the ground band stays pinned, with a drop line and height label.
- The first milestone at 500 m is a tutorial beat: a sloppy full-pull player reaches it (198 of 200) and does not reach 1000 m (6 of 200) where an expert always does.

## Amendments after the release-gate review of v4 (2026-09-30)

1. No purchase may make a habitual full pull worse: the teaching chunk's springs are placed relative to the player's current full-pull range (with Band and Aero applied), so a clean full pull always meets the first and middle springs whatever the upgrades. The harness proves the naked 500 m at every Band and Aero level, and the pacing model stops compensating power (a full pull is a full pull).
2. Teach the boost: on the first flight of a fresh save, "Tap to boost" shows at the top of the first arc, with the fuel pips pulsing once. The ghost thumb's stroke reaches at least 0.9 power.
3. "Pull further" clears the moment a valid pull starts.
4. Pacing is measured with the reviewer's careless profile too (pull length 90 plus or minus 40 px, angle 40 plus or minus 15 degrees, two taps); target the careless player's first purchase within ten flights.
5. Springs at ground level keep 3:1 or better against every sky band (a light halo on the pad, as on birds).
6. Backgrounding mid-flight ends the flight (logged once, as a quit); returning shows the menu.
7. Cosmetics: tumbling birds stop at the ground band; the card never overshoots the top edge; ground labels sit above the bottom inset.
8. Section 16 prices are now Band 300/450/650, Aero 300/500/700, Rocket 380/550/750, Fuel 1100/1300/1500; Rocket 1 makes a hold twice a tap's push per fuel.
