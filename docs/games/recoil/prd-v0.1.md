# PRD v0.1: Recoil

| | |
| --- | --- |
| Slug | `recoil` |
| Version | 0.1 |
| Pattern | P10 with an aim-under-recoil skill axis |
| Date | 2026-09-28, rewritten from the designer's synthesis reaction |
| Status | locked for layer 1 |

This document is the one-shot contract. Describe behaviour, not implementation. Landscape and two thumbs per ADR-0013.

## 1. Pitch

One thumb moves the gun up and down, the other fires. Every shot kicks the barrel up, so the second shot goes high unless you wait or compensate. Targets come at you or appear in sequence, and a hit scores by how close to the centre it lands. Two challenge ladders, Accuracy and Speed, with stars that turn into points that unlock guns.

## 2. The first ten seconds

The play scene opens on Accuracy 1 in landscape. The gun is at the left edge, mid-height, with a dotted range finder from its barrel to the right edge. A ring target appears on the right with three zones. The player drags anywhere on the left half: the gun follows the drag vertically and the range finder moves with it. They tap anywhere on the right half: an instant shot along the range finder, the ring flashes its zone score, the barrel kicks up and the range finder jumps. A second quick tap sails high. The range finder settles. They tap, and the bullseye shows "100" with a combo pip.

## 3. Core loop and session shape

- Loop: line up with the left thumb, fire with the right, read the kick on the range finder, wait or compensate, fire again. Targets score by zone. The challenge ends at its target count, its timer, or when ammo runs out (Accuracy).
- A challenge lasts 20 to 40 seconds. Restart is one tap.
- Closing the app mid-challenge: the challenge restarts on reopen. Best score and stars per challenge, and total points, persist.

## 4. Controls

Landscape, design space 640 by 360. Two thumbs.

| Gesture | Where | Does |
| --- | --- | --- |
| Drag | left half of the screen | Moves the gun vertically by the drag's vertical movement (relative, one to one in screen pixels scaled to design units). The thumb can rest anywhere on the left half. Clamped to the field. |
| Touch down | right half of the screen | Fires one shot along the barrel on the touch, not on the release, so there is no latency and a rolling thumb still fires (amended after review). |
| Hold | right half | Nothing in v0.1 (the starting gun is semi-automatic). Later automatic guns fire at their rate while held. |
| Tap a button | menu, card | Navigation only. |

Both thumbs may be down at once; pointers are tracked by id. A cancelled pointer just ends its gesture.

Keyboard fallback: up and down arrows move the gun, space fires.

Occlusion rule: the drag is relative, so the left thumb rests in the bottom-left corner, below the gun's usual height, and never needs to cover the gun. The right thumb taps in the bottom-right corner, below the targets' lane. Targets never spawn in the bottom `thumbLane` units of the field.

## 5. Skill model

- **Skill axis:** timing and compensation against a deterministic recoil, plus precision on ringed targets.
- **The recoil rule:** each shot adds `kickPerShot` degrees to the barrel angle (upward), up to `kickMax`. The angle recovers toward zero at `kickRecovery` degrees per second. The range finder always shows the true barrel line, so the kick is visible. There is no randomness in the kick.
- **Intermediate tips (1 to 3):**
  1. Wait for the barrel to settle; the range finder shows you when.
  2. Nudge the gun down as you fire to cancel the kick.
  3. Bullseyes are worth five times the outer ring; one calm shot beats three rushed ones.
- **Expert tips (3 to 5):**
  4. Fire on the recovery rhythm: the angle after a shot is predictable, so the next shot can be timed to a known height.
  5. Use the kick: a target above the current line can be hit by firing twice fast, the second shot lands higher on purpose.
  6. In Speed, prioritise the nearest approaching target, not the highest-value one.
- **Legendary:** all bullseyes at speed on the top levels.
- **Naked run:** one gun in v0.1; later, every challenge's three stars stay reachable with the starting gun.
- **Outsized reward for skill:** zone scoring (bullseye 100, inner 50, outer 20) times a combo multiplier that grows with consecutive hits (`comboCap`) and resets on a miss. Three stars need mostly bullseyes.

## 6. Randomness policy

- Random in setup: target positions and timings come from `makeRng` with a fixed seed per challenge level, so a challenge is the same every time and can be learned. Daily seeds are a later mode.
- Deterministic in resolution: shots are instant lines with no spread; the kick is a fixed amount; the recovery is a fixed rate; physics uses a fixed timestep.

## 7. Goal, fail, score

- **Target:** a ring with three zones of radii `zoneR` (bullseye, inner, outer). A shot line crossing the target scores the innermost zone it passes through, measured by the perpendicular distance from the target centre to the shot line. A shot crossing no target is a miss.
- **Accuracy N:** `accTargets` still targets, one at a time, each staying until hit or until `accLife` seconds pass (a miss). Ammo is `accAmmo` shots. Ends when targets are exhausted or ammo is out. Score is zone points times combo.
- **Speed N:** targets approach from the right at `approachSpeed` for `speedSeconds`. A target that reaches `gunLineX` vanishes as a miss and resets the combo. Up to `maxTargets` alive. Score is zone points times combo.
- **Stars:** per challenge, thresholds in its data: `stars: { one, two, three }` as scores.
- **Points:** each challenge's best star count is worth points: 1 star 10, 2 stars 25, 3 stars 50, summed over challenges as the player's points total, shown on the menu. Guns unlock at point thresholds in a later layer; v0.1 shows the total.
- The card shows: score, stars with a pop, best, hits and bullseyes, Again, Next (next level of the same ladder if unlocked), Menu.

## 8. Progression in v0.1

Best score and stars per challenge; the next level of a ladder unlocks at one star on the previous; points total on the menu. Deferred: guns (kick, recovery, rate, magazine, spread as gun properties), attachments, the unlock table, levels 4 and 5 of each ladder, daily seeds, badges.

## 9. Content plan

- Field: 640 by 360, gun at `gunX` from the left edge, targets in the right two thirds, never in the bottom `thumbLane` units.
- Challenges as data: `{ ladder: 'accuracy' | 'speed', level, seed, params..., stars: { one, two, three } }`. v0.1 ships Accuracy 1 to 3 and Speed 1 to 3.
- Accuracy 1: 8 large targets (`zoneR` scale 1.3) at mid distance, `accLife` 6, ammo 12. Teaches the kick: the second shot sails high.
- Accuracy 2: 10 targets, scale 1.0, spread in height, ammo 13. Teaches tip 2.
- Accuracy 3: 12 targets, scale 0.8, at the far edge, ammo 14, some appear high so the kick can be used (tip 5).
- Speed 1: 25 seconds, targets every 2.0 s at `approachSpeed` 60, one at a time. Teaches prioritising.
- Speed 2: 30 seconds, every 1.4 s, speed 80, up to 2 alive.
- Speed 3: 35 seconds, every 1.0 s, speed 100, up to 3 alive, heights vary widely.
- Star thresholds are set from a harness: three stars at 85 percent of the score a scripted perfect run achieves (every shot a bullseye timed to the recovery), two at 55 percent, one at 30 percent. The builder records the perfect-run score per challenge.

## 10. Juice list

| Event | Visual | Sound | Haptic |
| --- | --- | --- | --- |
| Gun moves | The gun body tilts slightly with the drag direction | none | none |
| Shot | Muzzle flash, a tracer along the barrel that fades, the barrel kicks visibly and the range finder jumps | `tap` | 8 ms |
| Hit | The zone flashes, the score number pops in the zone's colour, combo pip | `hit`, pitch rising with the combo | 8 ms |
| Bullseye | Bigger burst and a ring ripple | `coin` then `hit` | 16 ms |
| Miss | Tracer ends in a spark on the right wall; combo shrinks and greys | none | none |
| Target reaches the gun line (Speed) | It shatters at the line, red flash on the left edge | `miss` | 30 ms |
| Out of ammo (Accuracy) | Click, ammo counter flashes | `tap` at 0.3 | none |
| Challenge end | Card slides up, stars pop, points count up | `win` on 1 star or more, `lose` otherwise | 30 ms |

## 11. Art direction

Shapes only in v0.1. The gun is a simple silhouette with an obvious barrel, white with an orange barrel tip. Targets are three concentric rings: outer slate, inner cyan, bullseye white. The range finder is dotted white, fading with distance. The field is dark with a horizon line so the height reads. Three semantic colours: cyan for targets (goal), orange for the gun and shots (player), red for a target that reaches the line (danger).

## 12. Audio

Engine named sounds only: `tap` on shots and clicks, `hit` with `E.audio.beep` pitch scaled by the combo, `coin` on bullseyes, `miss` when a target reaches the line, `win`/`lose` at the end.

## 13. Modes

v0.1 ships the two ladders, three levels each. Later: levels 4 and 5, daily seed, duels, survival.

## 14. Scope fence

Not in v0.1: guns, attachments, the unlock table, automatic fire, spread, bullet travel time, enemies that shoot back, duels, levels 4 and 5, badges, sprites, music, portrait.

## 15. Acceptance criteria

- [ ] Loads from the home-screen icon in airplane mode, in landscape
- [ ] A first-time player moves the gun and fires within ten seconds without reading anything
- [ ] The second of two quick shots lands measurably higher than the first at the default tuning (by at least one outer-zone radius at mid distance), verified in a harness
- [ ] A shot timed after full recovery lands exactly where the first did
- [ ] Same challenge, same input sequence: same score at 30 and 120 frames per second
- [ ] Both thumbs down at once work: dragging with one while tapping with the other
- [ ] Targets never spawn in the thumb lane or under the gun
- [ ] Every challenge's three-star threshold is reachable by the scripted perfect run
- [ ] Text at least 14 px, buttons at least 44 px, HUD inside all four safe insets
- [ ] `npm run smoke` passes

## 16. Tuning table

Design-space units unless stated.

| Name | Value | Meaning |
| --- | --- | --- |
| designW | 640 | Design space width |
| designH | 360 | Design space height |
| gunX | 70 | Gun centre from the left edge |
| gunLineX | 110 | Approaching targets vanish as a miss at this x |
| thumbLane | 70 | Bottom band with no targets |
| gunMinY | 60 | Highest gun position (raised from 40 after review so the HUD never covers the gun or the range finder) |
| gunMaxY | 300 | Lowest gun position |
| dragGain | 1.0 | Design units of gun movement per design unit of drag |
| kickPerShot | 8 | Degrees of barrel climb per shot (7 failed the one-ring kick check in section 15) |
| kickMax | 28 | Cap on the barrel angle |
| kickRecovery | 32 | Degrees per second the barrel settles |
| zoneR | 6, 14, 24 | Bullseye, inner, outer radii at scale 1 |
| zonePoints | 100, 50, 20 | Points per zone |
| comboStep | 0.5 | Multiplier added per consecutive hit |
| comboCap | 4 | Max multiplier |
| rangeDots | 28 | Dots on the range finder |
| approachSpeed | 60 | Base approach speed in Speed 1 |
| physicsStep | 1/120 | Fixed timestep |
| particleCap | 200 | Max live particles |

Experiments for the tune panel: kickPerShot (2 to 15), kickRecovery (10 to 80), dragGain (0.5 to 2), approachSpeed (30 to 160).

## 17. Open questions

- Should the drag zone be the left half or the left third? Recommendation: left half; the field's right two thirds holds targets, the finger is below them anyway.
- Should Accuracy targets vanish on a miss or stay until hit? Recommendation: stay until `accLife`, so one bad shot is not a lost target.
