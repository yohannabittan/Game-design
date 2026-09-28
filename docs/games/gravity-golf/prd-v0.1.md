# PRD v0.1: Gravity Golf

| | |
| --- | --- |
| Slug | `gravity-golf` |
| Version | 0.1 |
| Pattern | P1 Aim and launch, with L6 boss cadence |
| Date | 2026-09-28 |
| Status | locked; amended 2026-09-28 after review, and again after the first phone playtest (borders, hole capture, friction, well strength, hole 1 well) |

This document is the one-shot contract. A builder session gets this, the skeleton, and the layer prompt. If something is not in here, the builder should not invent it. Describe behaviour, not implementation.

## 1. Pitch

Drag to aim, release to launch, and sink the ball in as few shots as you can through walls, bumpers and gravity wells that bend its path. Space mini golf where you read the physics by eye and call the shot before you let go.

## 2. The first ten seconds

The play scene opens directly on hole 1 (the menu is one tap: Play). A dark field with faint stars. A white ball sits in the lower third, a hole with a green ring sits in the upper third, and a purple gravity well sits to one side of the line between them, close enough that a straight shot bends visibly toward it. The field is walled on all four sides. The player touches anywhere and drags. A dotted preview grows from the ball in the direction opposite the drag and curves as it passes the well, so they can see the pull and aim off to compensate. They release. The ball bends around the well, slows, and is caught by the hole with a green burst and the win chord. A card says "1 shot. Par 2." with three stars popping in and a Next button.

## 3. Core loop and session shape

- Loop: drag to set direction and power, release to launch, watch the ball travel under friction, walls and wells, until it stops or sinks. The field is bordered by walls on all four sides, so the ball never leaves it. If it stopped, aim again from where it lies. Repeat until it sinks. Then the hole card, then the next hole.
- A hole lasts 10 to 60 seconds. The full run of 10 holes is about 5 minutes.
- A hole ends when the ball sinks. There is no shot limit and no fail state on a hole.
- Closing the app mid-hole: the hole restarts from its start on reopen. Highest unlocked hole, best strokes per hole and stars persist. Holes are short, so this is fine.

## 4. Controls

Portrait. One thumb.

| Gesture | Where | Does |
| --- | --- | --- |
| Touch and drag | anywhere on the field, not on the ball | Slingshot aim. The launch direction is opposite the drag direction. Power grows with drag distance up to a maximum. |
| Release | | Launches the ball. |
| Drag back to under a small distance, then release | | Cancels the shot. No stroke counted. |
| Tap while the ball is moving | | Nothing. The ball cannot be interrupted. |
| Tap a button | menu, hole card | Menu navigation only. |
| Tap Retry | small button in the HUD, at least 44 px, away from the aiming area | Restarts the current hole from its start with strokes reset. Available only while the ball is at rest. |

Aiming is only possible while the ball is at rest.

Keyboard fallback for desktop testing: arrow keys rotate the aim and adjust power, space launches.

Occlusion rule: the drag can start anywhere, so the thumb sits wherever the player likes, usually the bottom corner. The aim line and preview draw from the ball, not from the finger. The ball, the hole and the field are never under the thumb during aiming.

## 5. Skill model

- **Skill axis:** reading the field. Choosing angle and power against walls, bumpers and wells whose effect is visible before the shot.
- **Intermediate tips (1 to 3):**
  1. Use less power than you think; the field is slick and the ball keeps rolling.
  2. Bank off walls; they return almost all the speed and a bank is often straighter than a curve.
  3. Wells pull harder up close; aim to one side and let the well bend the path around it.
- **Expert tips (3 to 5):**
  4. Slingshot: pass close to a well with speed and it whips the ball around and out the far side faster than it went in.
  5. Brake on a wall: graze a wall at a shallow angle just before the hole to bleed speed so the ball drops instead of rolling over.
  6. Repulsors push; aim into one to bend away sharply, or use its edge as a soft brake.
- **Legendary:** hole-in-one on every hole, including the boss holes, using well orbits to park the ball.
- **Naked run:** there is no equipment in v0.1. Every hole has an intended solution at or under par with the base ball, written in the level data as a comment.
- **Outsized reward for skill:** three stars for finishing one under par (a hole-in-one on par 2), two stars for par, one star for any finish. Three stars get a larger burst, the win chord and a "Hole in one" or "Under par" line on the card. Star totals are the thing to chase.

## 6. Randomness policy

- Random in setup: nothing. All 10 holes are authored.
- Deterministic in resolution: the same drag vector from the same ball position always produces the same flight. Physics uses a fixed timestep so frame rate does not change outcomes. Moving elements (the boss hole's wall) move on a clock that starts at zero when the hole starts and restarts from zero each time the ball comes to rest, so the shot's outcome depends only on when the player releases relative to that clock, which is visible. Ball speed is clamped to `speedMax` so a well slingshot can never make the ball skip through a wall.
- Seed: none in v0.1. The daily course mode later will use `E.dailySeed()`.

## 7. Goal, fail, score

- The hole catches the ball like a real cup: within `captureR` of the hole centre, the ball is pulled toward the centre with a constant acceleration `captureStrength`, so a slow ball that grazes the rim curls in instead of sliding past. A hole is cleared when the ball's centre is within the hole radius while its speed is below the sink speed. Above the sink speed the ball passes over the hole. This is deterministic and shown: the hole ring brightens when the ball is slow enough to sink.
- There is no fail and no out of bounds in v0.1. Every hole is walled on all four sides. The ball stops within about two seconds of a full-power shot on open field.
- Score per hole is strokes. Stars per hole: 3 for strokes at or under par minus one, 2 for par, 1 for more.
- The hole card shows: strokes, par, stars with a pop, best strokes on this hole, Next (or Menu on hole 10). Nothing else.

## 8. Progression in v0.1

Minimal: highest unlocked hole, best strokes per hole, stars per hole, total stars on the menu. Clearing a hole unlocks the next. A hole select grid of 10 tiles on the menu shows locked, cleared and stars.

Deferred so it is not accidentally built:

- Ball types with different mass or bounce
- Badges and tiers
- Daily course, minimum-shot challenge, boss rush
- Any currency

## 9. Content plan

- Count for v0.1: 10 holes.
- Authored as: an array of hole objects in `game.js`. Each has a name, a par, a ball start, a hole position, and lists of walls (axis-aligned rectangles), bumpers (circles the ball bounces off), wells (circles with a strength; negative strength is a repulsor), and optionally one mover (a wall that oscillates between two positions on a fixed period). All coordinates are in a fixed design space of 360 by 640 units that the game scales uniformly to fit the screen, centred, with letterboxing in the background colour. A comment on each hole states its teaching goal or tip and its intended solution in one line.
- Holes 1 to 3 teach, in order: (1) drag, power and release, with one well beside the line so the very first shot bends and the preview shows why; the sinking window must stay at least 6 degrees wide; (2) a bank shot, a wall fully blocks the straight line; (3) a well between ball and hole, go around it.
- Holes 4 to 10: (4) a corridor of two walls; (5) boss: a big well dead centre, the slingshot hole, needs tip 4; (6) a repulsor guarding the hole, needs tip 6; (7) bumper field, three bumpers; (8) two wells in a figure-of-eight, needs tips 3 and 4; (9) a narrow gap at the top with a well below it, needs tip 5 to drop in; (10) boss: a mover wall sweeping across the approach, one well, one bumper, needs timing plus everything before.
- Difficulty curve: the second half requires tips 4, 5 and 6. The first half is clearable with tips 1 to 3.
- Field borders: every hole has walls on all four edges of the design space, drawn as part of the field and always visible on screen at any phone aspect ratio. Hole data does not list them; the physics adds them.
- No trap anywhere: from rest at any reachable point on any hole, including inside a well's core, a full-power shot must be able to carry the ball at least 200 units away from that well, and a ball at rest never jitters. The pull inside `wellMinDist` falls off toward the centre (no constant-force pit). The builder verifies with an escape sweep on every hole that has a well.
- Well strength is set by an observable, not by taste: a ball passing a well at 40 units of closest approach at 500 units per second must whip around by more than 90 degrees and leave the well uncaptured. A ball passing at 100 units at 400 units per second bends visibly (about 15 degrees by closest approach) and is then captured; that is accepted, because the whip is what makes the slingshot holes work. Measured on 2026-09-28 after the escape rule, by the reviewer's harness with friction: a 500 u/s pass at 24 to 28 units closest approach is turned 52 to 60 degrees by the time it leaves a 61-unit radius, and passes that stay near the well longer are captured. The builder's 96.5 degree figure used a different exit radius. Either way the boss slingshot solution on hole 5 holds, and the escape rule (below) is the binding constraint, so this observable is now descriptive, not a gate. Per-hole wells carry a strength multiplier between 0.45 and 1.0; boss holes differ by layout, not by well size, because a stronger well cannot satisfy the escape rule.
- Boss beat: holes 5 and 10 are named as boss holes on the card and the hole select.

## 10. Juice list

Minimum feel. Each event gets a distinct response.

| Event | Visual | Sound | Haptic |
| --- | --- | --- | --- |
| Drag start | Ball glows, aim line and dotted preview appear, power shown by line length and colour warming from white to orange | none | none |
| Release | Ball flashes, aim line vanishes, small puff behind the ball | `tap` | 8 ms |
| Wall or bumper bounce | Small spark burst at the contact point in slate | `hit` at low gain | none |
| Entering a well's pull | Ball leaves a faint trail that bends | none | none |
| Sink | Green burst from the hole, ball shrinks into it, card slides up | `win` (bigger burst and `coin` first on 3 stars) | 30 ms |
| Ball comes to rest far from the hole (more than 3 shots on a hole) | A soft slate pulse on the ball | none | none |
| Star pop on card | Each star scales in with `outBack`, staggered | `coin` per star | none |

## 11. Art direction

Shapes only in v0.1. Dark navy field with faint static stars. Three semantic colours: green for the goal (hole ring, sink burst, stars), purple for wells (soft glowing disc with two thin rings that suggest pull), orange for repulsors (same shape, rings pointing outward). Walls are flat slate rectangles with a slightly lighter edge. Bumpers are slate circles. The ball is white with a small darker shadow offset so it reads as sitting on the field. Aim line is white dots. Everything must read from arm's length: the hole, the ball and each well are the three largest shapes on screen.

## 12. Audio

Engine named sounds only: `tap` on release, `hit` on bounces at volume 0.3, `win` on sink, `coin` on stars. No music in v0.1.

## 13. Modes

v0.1 ships the campaign of 10 holes. Planned later: daily course from authored pieces, minimum-shot challenge, boss rush.

## 14. Scope fence

Explicitly not in v0.1:

- Ball types, equipment, upgrades, currency, shop
- Badges, achievements, tiers
- Any mode beyond the campaign
- Moving holes, portals, wind, sand, water
- Undo, shot replay, hints beyond the preview
- Sprites, music, custom fonts
- A level editor
- Landscape support

## 15. Acceptance criteria

- [ ] Loads from the home-screen icon in airplane mode
- [ ] First-time player understands the verb within ten seconds without reading anything
- [ ] From a sunk ball to aiming the next hole in one tap, under one second
- [ ] All 10 holes are clearable at or under par by the intended solution in their comment
- [ ] Hole 1 can be a hole-in-one at moderate power, the well visibly bends the flight, and the window of aim angles that sink it is at least 6 degrees wide, since it is the tutorial hole
- [ ] A full-power shot on open field comes to rest within about two seconds
- [ ] The ball never leaves the field, and all four walls are visible on a 390 by 844 screen and a 390 by 664 screen
- [ ] Escape sweep: from rest inside every well's core on every hole, some full-power shot carries the ball at least 200 units from the well
- [ ] Hole 4's sink window is at least 6 degrees and its intended path runs through the corridor
- [ ] A bounce and a sink are distinguishable with sound off, and with eyes closed
- [ ] The same drag vector produces the same flight every time, at 30 and at 120 frames per second
- [ ] No text smaller than 14 px; hole select tiles and buttons at least 44 px
- [ ] Steady frame rate on a mid-range phone on hole 8 (two wells, trail, particles)
- [ ] `npm run smoke` passes
- [ ] The preview never shows the whole flight after hole 3; after hole 3 it shows only the first short segment

## 16. Tuning table

Design-space units unless stated. The builder copies these names into `TUNING`.

| Name | Value | Meaning |
| --- | --- | --- |
| designW | 360 | Design space width |
| designH | 640 | Design space height |
| ballR | 9 | Ball radius |
| holeR | 18 | Hole radius, ball centre must be inside |
| sinkSpeed | 380 | Max speed (units per second) at which the ball can sink |
| captureR | 44 | Within this distance of the hole centre the cup pulls the ball |
| captureStrength | 900 | Constant acceleration toward the hole centre inside captureR |
| friction | 0.28 | Fraction of speed kept per second on the open field; a full-power shot stops in about two seconds |
| stopSpeed | 50 | Below this speed the ball is at rest; with friction 0.28 this is what makes a full shot rest in about 2.2 s |
| holdAccel | 250 | A slow ball only comes to rest where the net well pull is below this, so it cannot freeze mid-arc inside a well's pull |
| dragMax | 150 | Drag distance (screen px) that gives full power |
| dragDead | 12 | Drag shorter than this cancels the shot |
| powerMax | 820 | Launch speed at full drag |
| wallBounce | 0.85 | Fraction of speed kept on a wall or bumper bounce |
| wellStrength | 7000000 | Acceleration toward a well is strength divided by distance squared, times the hole's per-well multiplier (never above 1.0, or the escape rule fails); tuned to the observables in section 9 |
| wellMinDist | 44 | Inside this distance the pull falls off linearly to zero at the centre (soft core), so a ball can always be shot back out |
| wellR | 22 | Visual radius of a well disc |
| previewFullHoles | 3 | Holes 1 to this show the full preview |
| previewFullSeconds | 2.0 | Length of the full preview in simulated seconds |
| previewShortSeconds | 0.4 | Length of the preview after the full-preview holes |
| previewDotEvery | 0.05 | Simulated seconds between preview dots |
| physicsStep | 1/120 | Fixed physics timestep in seconds |
| maxFlightSeconds | 12 | Safety: a ball still moving after this is stopped where it is |
| moverPeriod | 2.4 | Seconds for the boss hole's wall to complete one sweep and return |
| speedMax | 1400 | Ball speed is clamped here so wells cannot cause tunnelling |
| keyPowerStart | 0.5 | Starting power fraction for the keyboard fallback |
| trailLength | 18 | Points kept in the ball's trail |
| particleCap | 200 | Max live particles |

## 17. Open questions

- Should the preview curve through wells (simulate the real physics) or be a straight line? Recommendation: simulate, using the same physics function, so the preview is honest. The builder should do this unless it costs more than a day of tuning.
- Should the hole ring show "sinkable" by brightening when the ball is slow enough? Recommendation: yes, it makes tip 5 discoverable.
