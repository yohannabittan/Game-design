# Launch PRD v0.2: a timing launch, a mochi going home, goals that pay, a world that changes

Status: locked 2026-09-30. Builds on v0.1 (its amendments stand unless replaced here). Source: the designer's first playtest (`playtests/2026-09-30-v7.md`) and two decisions in chat: the launch becomes a timing needle with graded zones; the hero is a mochi going home to find his love, with a candy and sweets world.

Two builds, in order, never in parallel: **Build 1** is A, B, C, D and G (the mechanic, the goals, the legibility, the harness). **Build 2** is E and F (the story, the zones, the new objects, the visible upgrades). Build 2 starts after Build 1 passes review.

## A. The needle launch (replaces pull and release)

- Before launch a needle sweeps up and down across a wedge at the launcher, from `needleMin` (10) to `needleMax` (80) degrees, at a constant angular speed (a triangle wave, not a sine, so every angle is on screen for the same time), one full sweep up and back in `needlePeriod` (1.6 s). The needle starts at the bottom of the wedge on every flight.
- The wedge is drawn in graded zones around `sweetAngle` (set by the harness to the angle that flies furthest at base equipment, near 40): **Perfect** within ±`zonePerfect` (3 degrees), **Great** within ±`zoneGreat` (8), **Good** within ±`zoneGood` (15), **Weak** everywhere else. Each zone has a launch power: `zonePower` 1.0 / 0.9 / 0.8 / 0.6 of `launchSpeedMax` (with Band applied). Perfect also gives `perfectFuel` (1) free boost pulse for the flight.
- **Tap anywhere** stops the needle and launches at once, at the needle's angle and its zone's power. The zone's name pops by the launcher ("Perfect!", "Great", "Good", "Weak"), with its own sound pitch and haptic; Perfect gets a flash and a spark ring.
- In flight, taps and holds boost exactly as in v0.1. The launching tap never also fires a boost.
- The pull, the drag dead zone, "Pull further", the drag hint and the dotted 0.6 s arc go. The first-flight hint becomes a pulsing "Tap when the needle is in the gold" under the wedge until the first launch of a fresh save.
- Deterministic: the needle's angle is a function of time since the launcher was ready, sampled at the tap's timestamp, so the same tap time gives the same launch at any frame rate.
- Keyboard fallback: Space stops the needle and boosts in flight.

## B. Goals that pay (replaces the stars)

- The end card drops the stars. It shows distance, best, sugar earned, and the **three active goals** with a tick or progress on each ("Reach 1000 m", "Bounce off 3 birds in one flight: 2/3").
- Goals are data: a list `GOALS` of about 18, each `{ id, text, test, reward }`, in order of difficulty, mixing distance ("Reach 750 m"), skill ("Two Perfect launches in a row", "Chain x3", "Land on a jelly after a boost"), and play ("Fly 10 times"). Three are active at a time; a completed goal pays its reward on the card (a line "+80 sugar: Chain x3") and the next in the list takes its slot. Rewards grow down the list so goals are the main way to afford the next upgrade early on.
- Distance milestones stay (500, 1000, 2000, 3500, 5000 m) with their one-time bonus, and the card says so in words: "New place reached: +50 sugar" (the places are named in E).
- The menu shows the three active goals under the best distance.
- Save: bump `saveVersion` and `migrate` (coins become sugar one for one; upgrades, best, milestones and flight count are kept; goals start at the top of the list, with any distance goal the best already meets completed silently, paying nothing).

## C. Reading the world

- **Birds:** the first bird bounce of a fresh save shows a call-out at the bird, "Bird bounce: up and onward!", with an up arrow, once. Every bird bounce keeps its feather burst.
- **Mud** must read as a trap, never as a target: no ring, pad or highlight shape that resembles a spring. A sticky pit with a dark glossy surface, slow bubbles and strands at the rim (the Build 2 look is caramel, see E). The first mud stop of a fresh save shows "Stuck! Jump mud with a boost", once.
- **Teaching springs:** the springs near the start must look bouncy at rest (an idle wobble) and pay off visibly when hit ("Boing" and a height pop). The playtest found them "useless and confusing": keep the fixed first chunk's promise (a Good launch meets the first spring) and prove it at every Band and Aero level, as in the v4 amendment.
- **Landing marker:** in flight, a small marker on the ground band shows where the critter will land if no more boost is fired (the real physics stepped forward, recomputed at most every 0.1 s, not drawn when the landing is off the far edge of the view). This makes a boost aimable at a spring. It is a prediction for this flight only and never shows beyond the first contact.

## D. Needle upgrade (fifth upgrade)

- A fifth shop item, **Steady** (named in theme in E), three levels: each level slows the needle by `steadySlow` (12 percent of its speed) and widens every zone by `steadyWiden` (1 degree each side). Prices set by the harness so that it is some player's best next buy at some point, as the v0.1 rule for all upgrades.
- The rule "no purchase may make a full pull worse" becomes: **no purchase may make the same needle stop worse.**

## E. The mochi going home (Build 2)

- **Story:** the hero is an apricot mochi (keeps the one orange hero rule) flung from a bakery counter, going home to his love, a strawberry daifuku who waits at 5000 m. No text tutorial and no cutscene: the menu shows a **journey strip** along its top, the bakery at the left, a heart and the daifuku at the right, the five places marked, the best distance as a small mochi on the strip.
- **Places** (the milestones become places, each a zone with its own backdrop, palette and ground, one style sentence each in `style.md` under the anchor "flat round shapes, warm sky, soft shadows, one orange hero"): 0 to 500 m the Bakery; 500 to 1000 Candy Meadow (gumdrop hills); 1000 to 2000 Chocolate River; 2000 to 3500 Soda Springs; 3500 to 5000 Gingerbread Town; 5000 m Home. Crossing into a place names it on screen once per flight.
- **Home:** the first flight past 5000 m shows the daifuku at the roadside as the mochi passes, with hearts, a haptic and a banner "Home! (keep going)"; the flight continues on the tier 3 field. The journey strip then shows the pair together.
- **Reskins, same rules:** springs become mint jellies (good stays teal); birds stay birds, in sugared pastel with a white rim; mud becomes a caramel pit (dark amber, glossy, bubbling, strands, per C); ramps become wafers; coins become sugar cubes; the slingshot becomes a pair of chopsticks with a licorice band.
- **Upgrades in theme, each visible on the mochi or the launcher at every level:** Licorice Band (Band: the band thickens and darkens), Fizz Tank (Fuel: a soda bottle on the back that grows), Cola Rocket (Rocket: a nozzle and a fizz trail on hold), Sugar Glaze (Aero: the mochi gains a shine and a tighter shape), Steady Chopsticks (Steady: plain to lacquered to gold). The shop draws each item as a picture (procedural, canvas) above its name, level pips and the price in the Buy button.

## F. More things further (Build 2)

- Two new objects, each introduced by its place and kept in later ones, each distinguishable with sound off:
  - **Soda geyser** (Soda Springs on): a vent on the ground that erupts for `geyserOn` (0.8 s) every `geyserPeriod` (2.4 s) on the flight clock. Touching the column while it erupts launches the critter up at `geyserLift` (520) keeping horizontal speed; touching the dormant vent is plain ground. A timing object: the landing marker plus a boost lets a player time it.
  - **Cotton-candy cloud** (Gingerbread Town on): a soft cloud in the air; passing through it slows the critter by `cloudDrag` (15 percent of speed) and refills `cloudFuel` (1) boost pulse, once per cloud.
- Chunk templates are extended per place so each place has at least three templates that use its objects; the tier rules of v0.1 (more mud, fewer springs past 2000 m) stand.

## G. Harness (Build 1, extended in Build 2)

- `tools/sim-launch.mjs` models the needle: a player profile is a distribution of tap times (expert: Perfect or Great every time; good: Great or Good; careless: a uniform tap time over the sweep, plus two random boosts).
- Targets, base equipment, 200 seeds each:
  - A Good launch reaches 500 m on at least 90 percent of seeds; a Weak launch reaches it on under 30.
  - The careless profile reaches 500 m on 40 to 70 percent of flights (the designer stalled at 400 to 450 m for 3 or 4 flights under the old model's 99 percent).
  - Each milestone stays reachable by an expert with at most two upgrade levels in total (v0.1 rule).
  - The careless profile's first purchase comes within ten flights including goal rewards.
- Every new object in Build 2 is proven deterministic (same seed, taps and boost times give the same flight at 30, 60 and 120 fps) and the milestone rules re-proven with them.

## G2. Meta screens (both builds)

The goals list, the journey strip, the card and the shop follow design principle 11 (the Ink standard): one headline number on the menu, goals as medal-free cards of name and a short condition with a counter only when counting, rewards as tickets on the result card (at most three), text 14 px or larger in two or three sizes, names in the world's own trade (the candy kitchen).

## H. Out of scope

Other critters, skins, badges, daily seed, leaderboards, generated image assets (all art stays procedural canvas), music, portrait, a text story or dialogue beyond the banners named here, anything that makes the flight longer than the v0.1 amendment's "under 60 s for 90 percent of expert flights".

## Open questions (simplest option until the designer says otherwise)

- Names: the hero is "Mochi" and his love "Daifuku" in any text. The designer may rename them.
- The needle wedge's zone colours: gold for Perfect, then warm to cool toward Weak, all distinct with colour blindness (check with a simulator), never orange (the hero's colour).

## Amendments after the Build 1 review (2026-09-30)

The review failed release on one blocker that is this document's fault: section A set `sweetAngle` by open-ground range and never required the gold to pay. On the real field a Perfect stop out-flies nothing: burst medians Perfect 641, Great 809, Good 669 m; unboosted Perfect stops end in the first mud at 510 m while Great stops clear it.

1. **Perfect beats Great beats Good beats Weak, on the real field.** For each profile (unboosted, two random taps, burst after two springs, expert), the median distance ranks Perfect > Great > Good > Weak, with Perfect at least 15 percent over Great for the unboosted and burst profiles, and an unboosted Perfect stop never ends in the first mud. Set `sweetAngle` and `zonePower` against the chain field (not open ground), and give Perfect a payoff of its own if the angle alone cannot do it (for example the chain starting at x1.5). Weak has no cliff: distance rises smoothly from the edge of Weak to the edge of Good.
2. **Weak power is 0.55** (replaces 0.6 in A).
3. **The first 500 m asks for input.** The chain of springs stays, but it is not a free ride: an unboosted Good stop reaches 500 m on at most 60 percent of seeds, and a Good stop with a good player's boosts on at least 90 percent (the careless 40 to 70 percent target stands).
4. **Skill goals need skill.** A goal named for a skill (a chain, springs, a boost on a spring) is met by a zero-input Good-or-better launch on at most 20 percent of stops; raise its count or change its condition until it is.
5. **Pacing:** the good profile clears the shop no sooner than flight 40 and every goal no sooner than flight 35 (v0.1's shop took 45); the careless first purchase stays within ten flights.
6. **No dead or harmful purchase:** every upgrade level raises the good profile's median distance (Band 3 at 650 m against Band 2's 849, and Steady and Rocket adding nothing, break this and the v0.1 rule).
7. **Legibility:** card tickets carry the goal's condition under its name (principle 11, rule 6); the needle is thin enough that the gold shows under it; the bird call-out sits clear of the tumbling bird; springs' idle bob is visible at arm's length (at least 3 px).
8. **Input:** taps in the first `readyGrace` (0.3 s) after the launcher is ready are ignored, so a double tap on Launch Again cannot fire a Weak launch.
9. **TUNE fits:** at most four sliders, all inside 812x375 (needlePeriod, sweetAngle, a zone-width scale, and launchSpeedMax).
10. **Hygiene:** `GOAL_SLOTS` and the ticket cap live in TUNING; the changelog carries the text-item counts that prompt 04 requires; `landingMark` stays under 2 ms per call on the highest arcs.

## Decision after Build 1 round 2 (2026-09-30)

Round 2 showed amendments 1 and 3 conflict when Perfect's lead comes from the spring layout: every layout that ranks Perfect 15 percent over Great drops Good-with-boosts to about 48 percent and the careless profile to 6 percent (the designer stalled at 400 to 450 m under the old model; a layout that punishes first-timers is worse). The designer's own wish settles it: "the closer you get to 45 the more boost you get ... there should be levels". Perfect's payoff comes from the launch, not the layout.

1. **Layout serves everyone.** The teaching run goes back to a generous run laid out per the player's current Band and Aero (v0.1 amendment 1), so the first-timer targets of amendment 3 and G hold (Good with boosts at least 90 percent to 500 m; careless 40 to 70 percent; unboosted Good at most 60 percent).
2. **Power carries the ranking.** `zonePower` may exceed 1.0: Perfect launches above full power, then Great, then Good, set by the harness so the medians rank Perfect > Great > Good > Weak for every profile, with Perfect at least 15 percent over Great for the unboosted and burst profiles on that generous layout. `perfectFuel` stays at whatever the harness needs (1 or 2).
3. **No cliff inside Weak.** Weak power ramps linearly with distance from the Good edge (from `weakPowerMin` at the wedge's ends up to `zonePower` Weak at the Good edge) so no one-degree step more than doubles the distance; Weak with a burst still reaches 500 m under 30 percent.
4. **Upgrades never hurt:** with the layout per the player's Band and Aero, every upgrade level raises the good profile's median (amendment 6 stands).
5. **Flight length:** expert flights under 75 s at the 90th percentile (was 60 s; longer Perfect rides are the reward, and the designer has not found flights long).

6. (Clarified after Build 2's review) The 75 s rule is measured at base equipment; upgraded sets may fly longer, which is the reward. Frame time "within 10 percent" is judged on flight scenes, the idle menu and needle within 12 percent.
