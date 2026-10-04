# Game ideas backlog

Every idea, mapped to the pattern library, with a first-build risk and a one-line kernel. Status moves through: idea, concept, prd, v0.1, evolving, shelved. Shelved ideas keep a note on why so we do not re-argue them.

## Recommended first three

Picked for touch fit, one-shot risk, and how well they exercise the process on different pattern families.

1. **Gravity Golf** (P1). Drag to aim, release, land the ball in the hole past obstacles and gravity wells. Boss holes every five levels. Lowest risk, strongest skill legibility, and levels are pure content, which is exactly what we want to iterate on.
2. **Ink** (P2, the tattoo game). Trace the shape before the timer runs out with a limited number of slips. Extremely touch-native, small, and it tests the finger-occlusion problem early, which every trace game on a phone must solve.
3. **Recoil** (P3). Move only by shooting. Novel, tiny loop, and the gun unlocks are progression that changes play instead of adding power, which makes it a good test of principle 4.

After those three, the process should have had its own v0.2. Then pick from the rest.

## Backlog

| Idea | Pattern | Hook | Touch fit | Risk | v0.1 kernel | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Gravity Golf | P1 + L6 | Gravity wells as slingshots; boss holes | Excellent | Low | 10 levels, shot counter, par | idea |
| Ink (tattoo) | P2 | Fill the shape, limited slips, score gates the next | Excellent | Medium | 10 shapes, timer, slip budget | idea |
| Recoil | P3 | You move by shooting; guns are physics | Good | Medium | 1 arena, 1 gun, targets, timer | idea |
| Arrow Range | P1 | Angle and timed power; challenges | Excellent | Low | 10 targets, wind shown, arrows counted | idea |
| Floaters (sniper puzzle) | P10 | Spot the target, wait for the moment | Excellent | Low | 10 scenes, one shot each | idea |
| Grow (shark or dragon) | P6 + L4 | Eat, grow, evolve features from special foods | Good | Medium | Endless, 3 prey sizes, 1 predator | idea |
| Stampede-like | P5 + L2 | Jump between animals, tame, find shinies | Excellent | Low to medium | Endless, 3 mounts, 2 obstacle heights | idea |
| Dolphin | P5 or P1 | Jump timing for air tricks | Excellent | Low | Endless, trick score | idea |
| Act of God | P11 | Steer a tornado, destroy efficiently | Good | Medium | 1 town, timer, destruction percentage | idea |
| Deep (Motherload-like) | P8 | Dig, sell, upgrade, dig deeper | Good | Medium | 1 mine, 3 ores, fuel, 3 upgrades | idea |
| Samurai platformer (ronin against bandits) | P4 + P10 | One verb for moving and fighting: **swipe to dash-slash**. Each swipe dashes in that direction and cuts whatever is in the path, so platforming (dash up to a ledge, chain off walls) and combat are the same skill. Group fights: bandits telegraph their attacks, archers' arrows can be cut by dashing through them on time, and a perfect chain clears a group without touching the ground. Duels against rival samurai are the bosses: read the tell, parry with a swipe against the blow, break posture for the finisher | Excellent | Medium | 3 short levels (village, rooftops, bamboo forest), 3 bandit types (sword, spear, archer), 1 rival samurai boss, dash-slash plus parry | idea (requested by the designer's best friend, 2026-10-04: a platformer, with group fights; drive: a ronin protecting a village) |
| Swords and Sandals-like (gladiator arena, roguelike) | P9 + L1 | **A run is one gladiator's bid for freedom:** 8 to 10 fights from the village pit to the grand arena, seeded, with a fixed, short run that fits one sitting. Combat is skill: **draw the cut** through a body part the opponent's armour leaves open (the armour is drawn on them). Disabling a part weakens them: an arm hits softer, a leg moves slower, a head stuns. Read the wind-up and draw a parry line across the incoming blade. Longer lines cost stamina. **Gold by the quality of the fight** (designer, 2026-10-04): the purse pays for how you won, not just that you won: clean cuts, parts disabled, damage avoided, speed, and a crowd meter filled by well-timed taunts. Skill buys gear. Between fights, spend it at the **arena market**. Its stock is rolled fresh at each stop from the item pool (seeded, so no shop is ever solved), at fixed, readable prices. **Injuries carry over** (a cut arm stays weak until treated), so every visit is a real choice: heal, repair armour, or buy the new blade. Items stack in deliberate synergies, and you can save gold for the boss fight. A full crowd also earns one free pick. **Born, then trained:** each new gladiator is rolled at birth from the run's seed. Height sets reach (how long and far a cut can go) but makes the head an easier target; build sets health and stamina but makes the body bigger and slower. Every birth trait trades something (principle 13), the roll stays inside a fair band, and the body is drawn to its real proportions, so you see your reach (principle 14). **Spin to be born** (pattern L8) (the presentation, after the designer's TikTok favourites, "Wheel of Fantasy"-style character wheels): the birth is a sequence of wheels you watch spin, covering origin, height, build, temperament and a quirk, so every gladiator arrives with a story and a name. About 90 to 95 percent of gladiators are born playable, and the rest may be a rare legend or a rare disaster (a disaster wins an underdog bonus). One **wild wheel** a run can land an extreme (a giant, a tiny one, a former baker) that trades harder both ways. Between fights, an **event wheel** sets up the next encounter: a patron's offer, a rival's grudge, a crowd favourite's challenge. The wheels only ever set things up (seeded, ADR-0008); fights are always skill. **Starting kit wheels** (designer, 2026-10-04): how many pieces (none to four, weighted), which slot each covers (helmet, chest, either arm, legs), and the quality tier (Rusty to Legendary). A high tier gates a **special power** wheel, using effect primitives under flavour names: a Helmet of Sight widens your parry window, Greaves of Haste quicken your step, a Bracer of Iron keeps that arm from being disabled once. The armour is drawn on your fighter and covers real body parts, so your gaps are visible to you and to the opponent. Opponents spin their kits too, and the result is shown before the bout, so you can plan which gaps to cut. Then you invest a few points deliberately (strength, agility, defence, vitality, charisma). Death ends the run. **Freedom wins it.** The ludus (the gladiator school) keeps unlocks between runs: new weapon types, fighting styles and starting traits. Freed gladiators hang in a hall of champions | Excellent | Medium | 1 arena, 8 fights over 3 tiers of armour, cut plus parry, 4 body parts, 12 items in the pool, 1 unlock track | idea (designer, 2026-10-04: a childhood favourite, then "maybe a roguelike", roguelike mode first and a classic career mode later; rolled birth traits plus invested points; skill over dice; drive: a nobody fighting for freedom, each run a new gladiator's story) |
| Sinjid-like RPG | P9 + L1 | Turn-based combat with a build | Good | Medium | 3 enemies, 3 actions | idea |
| Hold the House | P7 | Tower defense on one map | Good | Medium | 5 waves, 2 towers | idea |
| Bloons-like | P7 | Path defense, tower variety | Good | Medium | Same as above with a path | idea |
| Bag | L3 | Spatial inventory puzzle | Good | High | Needs a host game | idea |
| Thrower (Learn to Fly, Burrito Bison) | P1 + P8 | Launch, boost, upgrade, launch further | Excellent | Low | 1 launch, 2 boosts, distance score | idea |
| Tiny Wings remake | P5 + P1 | Hills as speed: slam into downslopes, fly off upslopes, beat the night; hit harder for better reward when it is perfect | Excellent | Low to medium | Endless seeded hills, one dive gesture, islands as stages, a sunset timer | idea (designer, 2026-10-01; Launch v0.3 tests the slam-and-glide physics first) |
| Fancy Pants-like | P4 | Momentum platforming | Fair | High | 6 courses, timer | idea |
| Spore stages | P6 then P13 | Cell to creature to tribe | Fair | High | Start as Grow; stages are later games | idea |
| Spore creator | L4 | Build a creature from parts | Good | High | Host game needed (Grow) | idea |
| Thing Thing-like | P12 | Arena shooter | Poor on phone | High | Merge into Recoil | idea |
| Gondor / ASOIAF lanes | P13 | Unit lanes and bases | Fair | High | 1 lane, 3 units | idea |
| TSA scanner | P10 | Find the contraband under a timer | Excellent | Low | 10 bags | idea |
| Gravity Golf: alien mode | P1 + L6, plus moving targets | The same gravity shots with saucers as moving bodies or hazards, a tractor beam that bends the ball while it is inside it, and an abduction hole where the cup drifts | Good | Medium | A separate mode, own tone, kept apart from the rank ladder; 5 holes, own badges (First Contact, Probe, Mothership) | idea (designer, 2026-10-03) |
| Gravity Golf: gamma-ray burst hazard | P1 + L6 | A star flares, then a shock front spreads at a fixed, shown speed; the ball must be clear of the zone before it arrives or the shot is lost. Rewards planning the route, not reacting | Good | Low to medium | One sector or a sector of its own, plus a Burst Survivor badge | idea (designer, 2026-10-03; mechanic for a later Gravity Golf PRD) |
| Khan-style badges | L5 | Tiered themed achievements | n/a | Low | Applies to every game in the progression layer | idea |
| Combination game | any | Mash two proven kernels | n/a | High | Only after both kernels shipped | idea |

## How to add an idea

One row in the table. Pattern from `pattern-library.md`. Kernel in one line. If you cannot fill the kernel column, it is not an idea yet, it is a theme.

## Shelved

None yet. When something is shelved, move its row here with one sentence on why.
