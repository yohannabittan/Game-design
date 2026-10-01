# Launch PRD v0.3: the fun pass (feel first)

Status: locked 2026-10-01. Builds on v0.2 (shipped as launch-v10, release v1.4). Source: the designer's playtest of v0.2 Build 2: "valuable improvements and everything works well, but we're missing some fun factor: the fizz bursts barely modify the trajectory and where you land; it doesn't feel very skill based, the needle is quite easy to hit perfect; you don't fly for very long; the first bouncers are very easy to hit and the next ones much harder; it's pretty but feels grindy; it's missing some juice; the launcher should be a cool steampunk mochi maker machine that is satisfying to shoot, with sounds and lights by the quality of the shot; when the character hits the floor it should bounce, and we should see something when the fizz boost happens." Decisions in chat: a two-beat launch (tap to stop a sweeping barrel where you want it, then a power skill test); three flight actions (parachute slow, condense drop, hold to boost); a range finder instead of a landing point.

**Process rule for this version (feel first):** this is a feel build for the dev channel. It ships with big TUNE knobs and presets so the designer tunes on the phone; the full balance pass (v0.2's rank, pacing and ladder targets) is redone after the feel is right, not now. Only the must-holds in section F gate it.

## A. The Mochi Maker 3000 (launcher)

A steampunk machine replaces the chopsticks: brass body, pipes, a barrel, a row of bulbs, a pressure gauge, steam vents. All procedural canvas.

- **Beat 1, aim:** the barrel sweeps slowly between `aimMin` 12 and `aimMax` 70 degrees (constant angular speed, period `aimPeriod` about 2.4 s). A tap locks it with a ratchet clunk. No angle is penalised: low is a skim, high is a lob.
- **Beat 2, power:** the gauge needle swings fast (`gaugePeriod` about 0.9 s) across graded zones (Perfect gold, Great, Good, Weak, as v0.2's ladder in spirit, tuned fresh). A tap fires: pistons pump, bulbs light green, amber or red by zone; Perfect lights every bulb, shrieks the whistle, blasts steam and gives a 0.2 s slow-motion beat.
- **Perfect streak:** consecutive Perfect launches make the gauge faster (`streakSpeedup` per step, capped) and the launch stronger (`streakPower` per step, capped), shown as a counter on the machine; any non-Perfect resets it. Push your luck.
- Upgrades bolt visible parts onto the machine (bigger spring coil, a fizz tank, a nozzle, a glaze drum, a steadier gauge). Steady becomes **Steady Gauge** (slows the gauge, widens its zones).
- The launch is deterministic from the two tap times, as before.

## B. Three flight actions (one thumb, anywhere on screen)

The first `gestureWindow` (about 0.1 s) of a press decides:

| Thumb | Action | Cost |
|---|---|---|
| Press and hold, no swipe (a quick tap is a short burst) | **Boost**: cola thrust along the flight while held, a fizz trail and a whoosh; the base game has it (Cola Rocket now makes it stronger) | drains fizz |
| Swipe up (more than `swipeMin` px) and keep holding | **Parachute**: the mochi stretches into a dough sail; fall speed capped low, steers by drifting; release closes it | free, but bleeds horizontal speed (it buys control, not distance) |
| Swipe down | **Condense**: the mochi balls up and drops fast; a hard landing on ground or a jelly gives a big bounce scaled by impact speed | free |

The fizz kick must visibly change the path: boost thrust large enough that holding it a second bends the arc obviously (tune; v0.2's 110-unit pulse was a 15 percent nudge). Every action has a visible, audible effect (fizz cloud and trail, sail stretch, squish).

## C. Bounce and flight

- The mochi bounces off plain ground, keeping far more speed (`groundKeep`, `groundBounce` raised) with squash and stretch, a dust puff and a boing; a good flight skips along instead of thudding. Flights last longer without upgrades.
- Condense into the ground or a jelly converts fall speed into a bigger bounce (Tiny Wings and Burrito Bison style).
- The jelly field is made consistent: no free early carpet then a cliff; spacing grows gently with distance, and steering (parachute, condense, boost) is how you reach them.

## D. Range finder

The single landing point becomes a dotted arc ahead of the mochi, recomputed each frame from the real physics with the current action applied, ending in the landing marker, `rangeLook` (about 1.5 s) long. A **Brass Telescope** upgrade lengthens it (visible on the machine).

## E. Juice

Steam, bulbs and whistle on the machine; fizz clouds and trails; speed lines at high speed; screen shake on big bounces and Perfect launches; sugar-pickup sounds rising in pitch through a chain; a bounce-combo counter; squash and stretch everywhere. Sounds through `E.audio` only, conservative gain.

## F. Must-holds (the only gates for this version)

1. Deterministic: the same seed, tap times and gestures give the same flight at 30, 60 and 120 fps.
2. A first-timer can reach 500 m: a careless profile (random barrel and gauge taps, a few random actions) reaches 500 m on at least 40 percent of flights at base.
3. Nothing gets stuck: every flight ends (stop speed or caramel), no flight runs past `maxFlight`.
4. Frame time within 10 percent of v0.2 in flight scenes (4x throttle, alternating rounds, 1-pixel readback).
5. Skim versus lob is a real choice: for the good profile, neither a low (under 30 degrees) nor a high (over 50 degrees) barrel band wins more than about 60 percent of head-to-head seeds.
6. Saves migrate (bump `saveVersion`; owned upgrades kept, Steady becomes Steady Gauge, Cola Rocket levels kept).
7. Text and targets per principle 11 and the 14 px / 44 px rules; smoke passes.

## G. TUNE panel

At most four sliders on screen at once (812x375): bounce, parachute, condense and boost strength, plus two presets **Floaty** and **Punchy** that set the whole feel at once. The designer's numbers become the defaults after the playtest.

## H. Out of scope

New places or objects, new modes, the Cork Popper (later shop item: where you tap relative to the mochi decides the push), generated images, music, a full re-balance of pacing and prices.
