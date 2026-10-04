# Pattern library

Mechanics distilled from the games that held up. Each pattern is a reusable kernel: a new game picks one primary pattern, optionally one layer pattern, and fills in the PRD from there. Do not combine two primary patterns in a v0.1.

For each pattern: the verb, the skill axis, the mastery ladder (what tips get you to intermediate and expert), the v0.1 kernel, where progression and smart randomness hook in, which modes it supports, how it maps to a thumb on a phone, and how risky it is to one-shot.

One-shot risk: **low** means the mechanic is a few hundred lines of clear physics or logic and a first build is usually playable; **medium** means feel tuning will take a second pass; **high** means the fun depends on content or systems that rarely land on the first try.

---

## Primary patterns

### P1. Aim and launch

Sources: gravity golf, ball-to-hole with obstacles, bow and arrow, Learn to Fly, Burrito Bison, the babies-on-floaters sniper game.

- **Verb:** drag back to aim, release to launch. Watch the flight. Try again.
- **Skill axis:** angle and power read against a visible physical system (gravity, wind, bounces, gravity wells).
- **Ladder:** Intermediate: bank off walls; less power than you think; aim at where it stops, not where it lands. Expert: use gravity wells as slingshots; chain bounces; time a launch against a moving obstacle. Legendary: single-shot solutions to levels designed for three.
- **Kernel:** 8 to 12 levels, a shot counter, par per level, one-tap retry. The drag shows a short trajectory preview for the first N levels only.
- **Progression:** stars per level by shot count; later, launch types (heavier ball, bouncier ball) that change the solution space rather than make it easier.
- **Smart randomness:** none in levels. A "daily course" mode assembles levels from obstacle pieces with a seed.
- **Modes:** levels, daily course, minimum-shots challenge, boss holes every 5 levels (a moving target, or a level that needs two launch types).
- **Touch:** drag anywhere on screen, not on the ball, so the thumb never hides the shot. Release to fire. Two-finger tap to cancel.
- **Risk:** low. This is the strongest first build in the library.

### P2. Trace and fill

Sources: the tattoo game, Fruit Ninja's slicing.

- **Verb:** finger down and trace a path or shape while a fill grows behind you.
- **Skill axis:** precision under time pressure with an error budget (number of times you may leave the line).
- **Ladder:** Intermediate: slow on the curves, fast on the straights; lift and re-place at corners. Expert: read the whole shape before starting; trace inward on tight spirals. Legendary: perfect fills at speed on shapes that hide their corners.
- **Kernel:** 10 shapes, a timer, an error counter, a fill percentage. Score unlocks the next shape.
- **Progression:** shape packs; ink colours; a "steady hand" stat that widens the line slightly (small step, per principle 4).
- **Smart randomness:** shapes are authored; a "freestyle" mode generates shapes from a seed by composing primitives.
- **Modes:** career (unlock next by score), timed gauntlet, zen (no timer, no errors, just fill), daily shape.
- **Touch:** the drawing finger covers the line, so the line is drawn ahead of the finger with an offset, or the stroke tolerance is generous below the finger and strict above. Playtest this early.
- **Risk:** medium. The fun lives in stroke tolerance tuning.

### P3. Recoil locomotion

Sources: the gun recoil game (unlock guns with different characteristics, shoot targets, fight other gunhands, vertical gun movement, attachments).

- **Verb:** tap to shoot. Every shot shoves you the opposite way. You move by shooting.
- **Skill axis:** managing momentum through fire rate and aim; using recoil as a jump, brake and dodge.
- **Ladder:** Intermediate: shoot down to hover; shoot away from the target to slow down. Expert: alternate guns mid-air; use wall bounces. Legendary: recoil-only routes through levels built for jetpacks.
- **Kernel:** one arena, one gun, targets that spawn, a timer, a score. Falling off the arena ends the run.
- **Progression:** guns as different physics (heavy recoil and slow, light and fast, shotgun spread that pushes harder); attachments as small modifiers; the gunhand duels as a second mode.
- **Smart randomness:** target spawn order and positions from a seed; duel opponents pick from a behaviour pool.
- **Modes:** target range (score attack), survival, duels, courses (reach the flag using only recoil).
- **Touch:** tap where you want to shoot; the gun aims at the tap. Drag to sweep aim while firing. One thumb.
- **Risk:** medium. Novel, and the fun depends on recoil numbers, but the loop is tiny.

### P4. Momentum platforming

Sources: Fancy Pants, Super Meat Boy, Line Rider, Q.

- **Verb:** run, jump, keep speed.
- **Skill axis:** timing and rhythm; reading a course at speed.
- **Ladder:** Intermediate: hold jump for height; land on slopes to keep speed. Expert: wall jumps; slide under things; route choice. Legendary: frame-tight lines.
- **Kernel:** auto-run or hold-to-run, tap to jump, 6 short courses with a timer and a best time.
- **Progression:** medals by time; new courses; cosmetic trails.
- **Smart randomness:** courses are authored. An endless mode chunks courses from a seed.
- **Modes:** time trial, endless, one-life gauntlet.
- **Touch:** left half of the screen for something, right half for jump, or just tap anywhere to jump with auto-run. Auto-run is the phone-native choice.
- **Risk:** high. Platformer feel is the hardest thing on this list to one-shot. Do this after two or three others have shipped.

### P5. Lane runner with mount swap

Sources: Rodeo Stampede, the dolphin jumping game.

- **Verb:** auto-run, tap to jump, land on the next animal. Avoid low and high obstacles.
- **Skill axis:** timing jumps against obstacle heights and each mount's behaviour.
- **Ladder:** Intermediate: each animal has its own gait, learn the two you see most; jump early off a fast mount. Expert: chain swaps for a combo; ride the rare one longer for the tame. Legendary: never touch the ground.
- **Kernel:** endless, 3 mount behaviours, 2 obstacle heights, a distance score.
- **Progression:** taming (ride an animal long enough and it joins your collection and can reappear); shiny variants with rare skins; a zoo screen that is just the collection.
- **Smart randomness:** obstacle and mount sequences from a seed with guaranteed spacing; shiny odds with pity.
- **Modes:** endless, daily run, tame hunt (a specific animal is guaranteed to spawn, catch it).
- **Touch:** tap to jump, hold for a longer jump. Nothing else.
- **Risk:** low to medium. The collection layer is what made Rodeo Stampede stick, and it is cheap.

### P6. Eat and grow

Sources: the shark or dragon eating game, Spore's cell stage.

- **Verb:** drag to steer, eat what is smaller, avoid what is bigger, grow.
- **Skill axis:** risk judgment (how close to a predator is worth the prey next to it) and steering.
- **Ladder:** Intermediate: eat the small stuff first, size wins fights. Expert: bait predators into each other; use speed bursts to steal. Legendary: grow on a fixed timer, speed-run style.
- **Kernel:** endless, 3 prey sizes, 1 predator type, size as score.
- **Progression:** evolution points from what you eat; special foods grant special features (a fin for speed, a spike for a bite bonus); a creature that visibly changes.
- **Smart randomness:** spawn tables by depth or zone from a seed; special foods on a pity timer.
- **Modes:** endless, zone runs (reach the next zone in time), boss hunts.
- **Touch:** drag to set a heading. The creature follows the finger with lag. Hold still to glide.
- **Risk:** medium. Growth feel needs a tuning pass.

### P7. Tower defense

Sources: Bloons Tower Defense, protect the house.

- **Verb:** tap to place a tower, watch the wave, adapt.
- **Skill axis:** placement, economy, and prioritisation under pressure.
- **Ladder:** Intermediate: cover the path's longest stretch; save for the wave you know is coming. Expert: chokepoints; sell and rebuild; hold gold across waves. Legendary: fixed-tower challenges.
- **Kernel:** 1 map, 5 waves, 2 tower types, 1 upgrade per tower. Lose when N leak.
- **Progression:** maps; tower types; wave modifiers.
- **Smart randomness:** waves are authored for levels; an endless mode composes waves from a seed with escalation rules.
- **Modes:** levels, endless, fixed budget, one-tower-type challenges.
- **Touch:** tap a slot, tap a tower type. Two taps to place. Pinch is not needed if the map fits the screen.
- **Risk:** medium. The loop is simple; balance is the work.

### P8. Dig, sell, upgrade

Sources: Motherload.

- **Verb:** drag to dig, fill the hold, fly up, sell, upgrade, dig deeper.
- **Skill axis:** route planning and fuel management. Greed versus safety.
- **Ladder:** Intermediate: dig diagonally to save fuel; sell before the hold is full if you are deep. Expert: memorise ore bands; pre-dig a return shaft. Legendary: minimum-trip runs.
- **Kernel:** 1 mine, 3 ore types, fuel, a hold size, 3 upgrades.
- **Progression:** upgrades (this pattern is the grind pattern; keep the naked-run rule by making depth reachable with skill and patience on base gear).
- **Smart randomness:** the mine generates from a seed with ore bands and guaranteed fuel pockets.
- **Modes:** career, daily mine, fixed-fuel challenge.
- **Touch:** drag in a direction to dig that way. Release to stop.
- **Risk:** medium. Simple to build; the loop lands if the numbers do.

### P9. Turn-based build and sequence

Sources: Sinjid.

- **Verb:** pick an action from a short list, watch the exchange.
- **Skill axis:** sequencing and resource timing; building toward a plan.
- **Ladder:** Intermediate: defend before the big hit; never waste a buff turn. Expert: read the enemy's pattern and pre-empt it. Legendary: minimal-turn kills.
- **Kernel:** 3 enemies in sequence, 3 actions, health and one resource. No inventory yet.
- **Progression:** skills, gear, the inventory. This pattern carries a lot of progression naturally; hold it back until the combat is fun with three actions.
- **Smart randomness:** enemy order and modifiers from a seed. Never in damage: a hit is a hit.
- **Modes:** campaign, gauntlet, boss rush, draft (pick 3 of 6 actions).
- **Touch:** big action buttons along the bottom. Portrait suits this well.
- **Risk:** medium. Easy to build; hard to make feel like anything without theme and juice.

### P10. Spot and time

Sources: TSA bag scanner, the sniper version of the floaters game.

- **Verb:** look, find, and tap at the right moment.
- **Skill axis:** observation under a timer, then a precise timed input.
- **Ladder:** Intermediate: scan in a pattern; wait for the target to be still. Expert: identify by silhouette; lead a moving target. Legendary: no-miss streaks at top speed.
- **Kernel:** 10 authored scenes, a timer, a miss limit.
- **Progression:** scene packs; harder disguises; a scope upgrade that trades zoom for field of view (a change, not a boost).
- **Smart randomness:** scene composition from parts and a seed once the authored set is fun.
- **Modes:** career, timed rush, one-miss.
- **Touch:** tap. Optionally drag to move a scope.
- **Risk:** low. Content-bound.

### P11. Physics destruction

Sources: Act of God tornado game.

- **Verb:** drag to steer a force, watch things break.
- **Skill axis:** efficiency: cause maximum damage with a limited resource (time, energy, size).
- **Ladder:** Intermediate: heavy things hit harder, pick up the truck first. Expert: chain collapses. Legendary: one-pass levels.
- **Kernel:** 1 town, a timer, a destruction percentage, a score.
- **Progression:** disaster types with different physics; town packs.
- **Smart randomness:** town layouts from parts and a seed.
- **Modes:** levels, time attack, sandbox.
- **Touch:** drag to move the storm. Simple.
- **Risk:** medium. Satisfaction depends entirely on the physics and particles.

### P12. Arena shooter

Sources: Thing Thing.

- **Verb:** move and shoot in a small arena.
- **Skill axis:** aim and positioning under pressure.
- **Kernel:** one arena, waves, one gun. Twin-stick on a phone means two thumbs, which conflicts with one-thumb play. Prefer auto-aim with manual movement, or manual aim with auto-movement.
- **Risk:** high on phone. Park unless it merges with P3.

### P13. Lane strategy

Sources: Games of Gondor style unit battles, the A Song of Ice and Fire idea.

- **Verb:** spend resources to send units down lanes; overwhelm the other base.
- **Skill axis:** timing and composition against what the opponent sends.
- **Kernel:** one lane, 3 unit types, a resource that ticks up, one AI opponent.
- **Risk:** high. Balance-heavy. The theme is what you want; build it on P7 or P9 first.

---

## Layer patterns

These are not games. They sit on top of a primary pattern and are added in later layers.

### L1. Run structure (roguelike meta)

Sources: The Binding of Isaac, All Who Wander.

A run is a sequence of encounters from a seed, with choices between encounters (pick one of three items, one of two paths) that combine into a build. Death ends the run; the meta layer (unlocks that widen the pool) persists. This is the strongest anti-repetition tool available and it fits P1, P3, P5, P6, P7, P8, P9.

Rules: pools have pity, modifiers are announced, synergies exist on purpose (two items that are better together than apart), and the run length is fixed and short (10 to 15 encounters) so a plane-mode session can finish one.

### L2. Collection and taming

Sources: Rodeo Stampede.

Things you meet can be kept. Keeping requires doing something skilful (ride it long enough, catch it under a condition). Rare variants (shiny) exist with visible odds. A collection screen shows what is missing. Cheap to build, and it converts repetition into hunting.

### L3. Spatial inventory

Sources: the inventory bag idea, Backpack Hero style.

Items have shapes; the bag has a grid; placement matters (adjacency bonuses). It turns loot into a puzzle. Pairs with P9 or L1. Do not put it in a v0.1.

### L4. Creature creator

Sources: Spore's creature creator.

Expression, not skill. Parts snap to a body; the result is visible in play. Pairs with P6 (your evolution points buy parts). Expensive to make feel good; hold for a game that has already proven its kernel.

### L5. Tiered badges

Sources: Khan Academy's meteorite, moon, earth, sun tiers and the Kepler and Newton names.

Achievements arranged in themed tiers with a naming scheme. Cheap, and it gives the grind a story. Every game gets a tier set in the progression layer.

### L6. Boss cadence

Sources: the ball-to-hole game.

Every X normal levels, one level that changes shape: a moving goal, a second mechanic, a bigger enemy. The normal levels teach one thing each; the boss tests all of them. Plan X in the PRD.

### L7. Modes

Every mechanic supports a standard set. Add them in this order once the kernel is fun: daily seed (free, adds comparison), endless (free if content is chunked), time attack, zen, boss rush, challenge (a constraint like naked run or one life).

### L8. Wheel of fate (randomness you watch)

Sources: the "Wheel of Fantasy" style of character-wheel videos (spinner apps such as Tiny Decisions), shared by the designer on 2026-10-04.

Seeded setup randomness (ADR-0008) shown as a sequence of wheels, so a roll becomes a reveal and a story. What makes the format work:
- **A question, then the answer.** Each wheel is a question in a header ("Origin?", "Trait?", "What now?"). The landed slice is the big answer below it.
- **Slice size is the odds, and the player sees them.** A huge "No Notable Trait" slice keeps most results normal. Thin slivers ("Blessed", "Cursed") are the rare extremes, and landing one is the thrill.
- **Tiered stat wheels.** A stat wheel runs Average to Mythic, with the weights shown by the slices.
- **Nested wheels add depth.** Race leads to a sub-race; realm leads to a region.
- **Every outcome carries a perk and a weakness,** shown on a card (claws and darkvision, but an allergy and sensitive hearing). That is principle 13 for free.
- **An action wheel for the story.** "What now?" offers context options (train a stat, gain a companion, you are attacked, a visitor arrives, interact with a named character). Named characters persist and return, which is what makes it a serial.

Rules for our games:
- Setup only: wheels never decide a skill moment.
- At most about 5 wheels before play, about 2 seconds each. The player taps to spin, and a second tap snaps to the result.
- Slices are readable at phone size (about 12 per wheel, 14 px text). Larger wheels zoom on the result.
- The tone stays universal: dark slices from the source format (killers, bodies) are swapped for comic ones (a baker, a former goat herder).
- The rarest slivers are shown on a one-time "you were born ..." card worth screenshotting.
- **Earlier wheels reshape later ones** (designer, 2026-10-04). Odds are conditional, so characters come out coherent but can still surprise. A giant's strength wheel has larger strong slices and its speed wheel smaller fast slices, but the fast sliver is still there: a fast, weak giant is possible, just rare. **Show the reshaping**: before each spin the slices visibly grow and shrink from the last result, so the player sees the cause before the effect, and an unlikely hit reads as luck worth celebrating. **Modular, never per combination** (designer, 2026-10-04). Each outcome carries a few **tags with nudges**, for example Giant: strength +2, speed -2, reach +2. A later wheel's slice weights are its base weights shifted by the sum of the nudges so far. The data grows with the number of outcomes, not with the number of combinations, and nothing is precomputed or hand-authored per character. Perks and weaknesses are small traits that stack, and the birth card's sentence is a template with slots ({name}, a {height} {origin} who {quirk}). About 90 to 95 percent of births land inside the fair band (playable by a good player), and **the rest may be extreme on purpose**: a rare legend or a rare disaster, with its own birth card. A disaster run pays an **underdog bonus** (the crowd's favourite, extra purse and fame if they win), so a terrible roll is a story and a challenge, not a dead run. The harness checks the split by **sampling** 10,000 seeded births, which takes seconds, rather than by enumerating combinations. Invested points can lean into or against the roll.
- **Modifier wheels** (the tabletop-style variant: armour class, +1, +2, -1, -2 to attack or defence). In the source format they decide hits. In ours they are **set before the fight and shown**, and they change the size of a skill window, never a die roll. For example: "Sand in your eyes: parry window -1", "Crowd loves you: +1 reach", "Old wound: left arm armour -1". The player always knows the modifiers before they act.

