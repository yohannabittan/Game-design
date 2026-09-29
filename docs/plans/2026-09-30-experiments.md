# Experiments for 2026-09-30

Each one takes two to four minutes on the phone. Open the game, tap TUNE, pick the preset, play what the card says, then answer the two questions. Answer with what you saw (the observable) before how it felt; the feel answer is the decision, the observable tells us why. Presets only change the feel knob named; levels, saves and unlocks are untouched, and Reset on the TUNE tab puts everything back.

The presets that ship tonight are marked ready. Anything marked pending depends on a build that is still in flight when this is written; the morning summary says which landed.

## Gravity Golf

### GG-1. How much should a planet catch you (ready when v0.3 lands, else pending)

Why: on single-planet holes, 83 to 90 percent of missed shots end up landed on the planet. That is safe but it may be why the game reads as "the planet hands me the hole".

Presets on TUNE: Heavy (tonight's proven default), Medium, Light, Light and rolling.

Play: holes 2, 4 and 7 once each per preset, aiming to slingshot rather than land. Twelve shots is enough.

Note:
1. Where did your misses end: on a planet, in the void (out of bounds), or off a wall? A rough count per preset.
2. On Light, did a slingshot feel like a choice you made, or like the ball ignoring the planet?

Decision rule: pick the lightest preset where you still landed at least one ball on purpose. Routes get re-proven at that value and it becomes the default.

### GG-2. Sun penalty (ready)

Why: the sun costs one stroke on touch. The review found hole 6 could stack two penalties on one shot, now capped at one per shot.

Slider on TUNE: sunPenalty 0, 1, 2.

Play: hole 3 (Solar Flare) and hole 6 three times each at 0 and at 1.

Note:
1. At 0, did you ever bounce off the sun on purpose?
2. At 1, was the penalty a fair "I chose the risky line" or a surprise?

Decision rule: keep 1 unless at 0 the sun became a deliberate tool and that was more fun than the risk. If so, the sun becomes a hot bouncer and the penalty moves to black holes.

## Ink

### INK-1. Timer feel (ready)

Why: timers are multiples of the perfect-path time (2.2x on early stencils, down to 1.35x on the skull). Nobody has checked yet whether three stars is a first-try result and five stars a real achievement.

Presets on TUNE: Relaxed (2.6x), Standard (rule), Tight (1.6x), plus a global multiplier slider.

Play: Heart, Clover and Snake once each on Standard, then on Tight.

Note:
1. Stars per stencil per preset, and whether the timer ran out.
2. On Tight, where did you lose time: hunting the last gaps, or slow inking?

Decision rule: if you got five stars first try on Standard on two of three, the default drops toward Tight. If Tight ran out on Heart, Standard stays. Stars earned under Relaxed still count, so play Relaxed last if you try it.

### INK-2. Gap hint timing (ready)

Why: above 95 percent the remaining gaps are small clusters. The hint shows them once they are under a share of the remainder.

Sliders on TUNE (the preset row is taken by the timer presets, so set these two by hand): hintPercent and hintShare. Late is 97 and 0.15, Standard is 95 and 0.10, Early is 90 and 0.05, Off is hintPercent 101.

Play: Star and Rose on Standard, then on Off, then on Early.

Note:
1. Seconds between reaching 95 percent and finishing, per preset (the card shows the time).
2. Did the hint ever point at a gap you had already seen?

Decision rule: pick the latest preset where the 95-to-finish time is under about a quarter of the run. Off stays available as a mastery mode if it was fun.

### INK-3. Needle (ready)

Why: Flowy is the needle by your pick. The floor (thinnest line at full speed) and growth rate are still ranges.

Sliders on TUNE: floorScale 0.6 to 1.0, growRate 8 to 20.

Play: Dagger twice at floorScale 0.65 (default) and twice at 0.85.

Note:
1. Clean rate (no slips) at each.
2. Did the thin line at speed feel like control or like a penalty?

Decision rule: keep 0.65 unless 0.85 raised your clean rate without making fast strokes pointless.

## Recoil

### REC-1. How much fight in the gun (ready)

Why: kick per shot and sway per movement are the whole feel of the game. The fire interval is always shorter than the recovery, so holding fire stacks the kick.

Presets on TUNE: Steady, Standard, Wild.

Play: Marksman I and Quick Draw I with the pistol on each preset.

Note:
1. Accuracy percent and score on each (the card shows both).
2. On Wild, did you start tapping in bursts, or did you fight the climb and lose?

Decision rule: Standard stays unless Wild made you change how you shoot and you liked it; then the kick for the pistol moves up and the carbine's recovery stays as the "steady" option.

### REC-2. Shotgun niche (ready)

Why: the review found best-pellet scoring made aim nearly irrelevant. Now only the centre pellet scores on rings, and hordes score per member hit. The question is whether the shotgun still has a job.

No preset. Play: Horde I with the shotgun, then with the carbine. Then Clay I with both.

Note:
1. Score with each gun on each challenge.
2. Which gun did you reach for on the second try of each?

Decision rule: the shotgun should win Horde and lose Clay. If it loses both, its spread tightens (a tuning change, no PRD). If it wins both, the centre-pellet rule stays and clays get smaller.

### REC-3. Skins (pending: skins build in flight)

Why: skins are the first unlockable and they are earned by badges only.

Play: the missions screen, then a challenge with any non-default skin you already have.

Note:
1. Could you tell which badge unlocks a locked swatch without reading this doc?
2. Did the skin show everywhere you expected (menu tile, card, in play)?

Decision rule: this is a look-and-feel check, not a tuning one. Anything you could not find in ten seconds is a finding.

## After the session

Write the answers in the game's playtests folder (docs/games/<slug>/playtests/2026-09-30.md, the template is in templates/). Each decision above becomes a line in the CHANGELOG and, where a default changes, a re-proof of the routes or timers with the harness before deploy.
