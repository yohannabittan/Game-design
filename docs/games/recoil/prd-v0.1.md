# PRD v0.1: Recoil

| | |
| --- | --- |
| Slug | `recoil` |
| Version | 0.1 |
| Pattern | P3 Recoil locomotion |
| Date | 2026-09-28 |
| Status | locked for layer 1; the designer's synthesis reaction may amend before layer 2 |

This document is the one-shot contract. Describe behaviour, not implementation.

## 1. Pitch

You are a floating gun. Every shot pushes you the opposite way, so you move by shooting. Hit targets before they vanish and don't run dry. A 45-second round, a score, a combo.

## 2. The first ten seconds

The play scene opens on the arena: a dark field walled on all four sides, a floor at the bottom. The gun (a small body with a visible barrel) rests on the floor. A target ring appears in the upper right. The player touches the screen anywhere: the barrel turns toward the touch and fires. The bullet is instant (a hitscan line that flashes), the target bursts if hit, and the gun is kicked away from the touch direction. Gravity pulls it back down. The player touches below the gun: it fires down and hops up. The HUD shows the timer, score, combo and the magazine as bullets.

## 3. Core loop and session shape

- Loop: touch to fire toward the touch point; recoil moves the gun; targets appear, drift and vanish; hits score and build a combo; the magazine empties and reloads; the round ends at the timer.
- A round is `roundSeconds` (45). Restart is one tap.
- Closing the app mid-round: the round is discarded, which is fine at 45 seconds. Best score persists.

## 4. Controls

Portrait. One thumb.

| Gesture | Where | Does |
| --- | --- | --- |
| Touch down | anywhere | Fires one shot toward the touch point immediately. |
| Hold | | Keeps firing toward the current finger position at `fireRate` shots per second while bullets remain. |
| Move while holding | | Re-aims continuously. |
| Lift | | Stops firing. |
| Tap a button | menu, card | Navigation only. |

Keyboard fallback: mouse works as a finger.

Occlusion rule: the finger is where you aim, which is away from the gun by design. The gun, targets and magazine are never under the finger in normal play; targets never spawn within `noSpawnR` of the gun.

## 5. Skill model

- **Skill axis:** momentum control through fire; every shot is aim and movement at once.
- **Intermediate tips (1 to 3):**
  1. Shoot down to stay up; short bursts, not sprays.
  2. To reach a target, shoot away from it; recoil carries you in.
  3. Watch the magazine; hovering spends the same bullets as hunting. Reload on the floor.
- **Expert tips (3 to 5):**
  4. A fire-rate rhythm holds altitude exactly: two shots down, pause, two shots down.
  5. Wall bounces are free movement; fire into a wall to bounce off it toward a target.
  6. Lead drifting targets; the bullet is instant but the gun is moving, so aim from where you will be.
- **Legendary:** a whole round without touching the floor, every hit in one combo.
- **Naked run:** no equipment in v0.1.
- **Outsized reward for skill:** the combo multiplier. Each consecutive hit without a miss or a floor touch adds one to the multiplier (cap `comboCap`); a miss or a floor touch resets it to 1. Points per hit are `hitPoints` times the multiplier. An "airborne" bonus at the end: seconds spent off the floor times `airPoints`.

## 6. Randomness policy

- Random in setup: target spawn positions, types and timings come from a seeded RNG (`makeRng`), one seed per round; a daily-seed mode is a later layer.
- Deterministic in resolution: shots are instant lines with no spread; a shot that points at a target hits it. Recoil is a fixed impulse. Physics uses a fixed timestep.
- Guaranteed: at least one target is always alive; a new one spawns within `spawnGapMax` seconds of the last one vanishing.

## 7. Goal, fail, score

- The round ends at the timer. There is no fail.
- Score: `hitPoints` times the combo multiplier per hit, plus the airborne bonus at the end.
- A miss is a shot that hits no target. It resets the combo. Shots fired to move are misses too, which is the tension; the player learns to hover with shots that also hit.
- Touching the floor resets the combo but is otherwise free; it is where you reload safely.
- The card shows: score, best, hits, longest combo, airborne seconds, Again, Menu.

## 8. Progression in v0.1

Minimal: best score, best combo, longest airborne time. Deferred: guns (different recoil, fire rate, magazine, spread), attachments, duels, daily seed, badges.

## 9. Content plan

- One arena: the design space 360 by 640 with walls on all sides and the floor as the bottom wall.
- Three target types, as data: `still` (a ring that lasts `targetLife` seconds), `drift` (moves in a straight line at `driftSpeed`, bounces off walls, lasts longer), `pop` (appears for `popLife` seconds, worth double). A spawn table gives each a weight that shifts over the round: still-heavy early, pop-heavy late.
- The physics: the gun is a circle of radius `gunR` with velocity; gravity `gravity`; air drag `airDrag` per second; wall bounce `wallBounce`; floor friction `floorFriction` per second while touching the floor. Each shot applies an impulse of `recoilImpulse` opposite the aim direction. The magazine holds `magSize` shots; when empty, a reload takes `reloadSeconds` during which no shot fires and the magazine refills; the reload cannot be interrupted.
- No level list in v0.1; the round is the content.

## 10. Juice list

| Event | Visual | Sound | Haptic |
| --- | --- | --- | --- |
| Shot | Muzzle flash, an instant tracer line that fades, the gun kicks (a squash), a shell casing particle | `tap` | 8 ms |
| Hit | Target bursts in its colour, score pops, combo pitch rises | `hit` | 8 ms |
| Miss | Tracer ends in a small wall spark; combo number shrinks and greys | none | none |
| Floor touch | Dust puff, combo resets with a low tone | `miss` at 0.3 | none |
| Empty magazine | Click, magazine flashes, reload bar | `tap` at 0.3 | none |
| Reload complete | Magazine refills with a snap | `coin` at 0.5 | 8 ms |
| Round end | Card slides up, airborne bonus counts up, stars for score thresholds later | `win` | 30 ms |

## 11. Art direction

Shapes only in v0.1. Three semantic colours: the gun in white with an orange barrel tip (player), targets in cyan rings (goal), the floor and walls in slate with the floor slightly warmer so it reads as ground. Tracers white, fading. Pop targets in magenta. The magazine drawn as bullet icons in the HUD.

## 12. Audio

Engine named sounds only: `tap` on shots and clicks, `hit` on hits with a pitch that rises with the combo (use `E.audio.beep` with frequency scaled by the multiplier), `miss` on floor touches, `coin` on reload, `win` at the round end.

## 13. Modes

v0.1 ships the 45-second round. Later: daily seed, survival (targets shoot back), duels, target courses.

## 14. Scope fence

Not in v0.1: guns, attachments, enemies, duels, spread, bullet travel time, ammo pickups, levels, badges, modes, sprites, music, landscape.

## 15. Acceptance criteria

- [ ] Loads from the home-screen icon in airplane mode
- [ ] A first-time player fires and moves within ten seconds without reading anything
- [ ] Hold-to-fire hovers the gun: with the finger held directly below the gun, the gun holds altitude within 40 units over 5 seconds at the default tuning, verified in a harness
- [ ] A full magazine of shots downward from the floor lifts the gun at least 200 units
- [ ] The gun never leaves the arena and never rests inside a wall; zero stuck states over 1500 random rounds of 10 seconds
- [ ] Same seed and same input sequence give the same score at 30 and 120 frames per second
- [ ] Targets never spawn within `noSpawnR` of the gun or inside a wall
- [ ] The round always ends at the timer and the card appears within a second
- [ ] `npm run smoke` passes

## 16. Tuning table

Design-space units unless stated.

| Name | Value | Meaning |
| --- | --- | --- |
| designW | 360 | Design space width |
| designH | 640 | Design space height |
| roundSeconds | 45 | Round length |
| gunR | 14 | Gun body radius |
| gravity | 900 | Downward acceleration |
| airDrag | 0.85 | Fraction of velocity kept per second in the air |
| floorFriction | 0.15 | Fraction of horizontal velocity kept per second on the floor |
| wallBounce | 0.45 | Fraction of speed kept on a wall bounce |
| recoilImpulse | 320 | Velocity added opposite the aim per shot |
| fireRate | 6 | Shots per second while holding |
| magSize | 8 | Shots per magazine |
| reloadSeconds | 0.9 | Reload time when empty |
| speedMax | 1400 | Speed clamp |
| targetR | 18 | Target ring radius |
| targetLife | 4 | Seconds a still target lasts |
| driftSpeed | 90 | Drift target speed |
| driftLife | 7 | Seconds a drift target lasts |
| popLife | 1.4 | Seconds a pop target lasts |
| spawnGapMax | 1.2 | Max seconds with no target alive |
| maxTargets | 3 | Targets alive at once |
| noSpawnR | 90 | No target spawns within this of the gun |
| hitPoints | 10 | Points per hit before the multiplier |
| popMultiplier | 2 | Pop targets are worth this times more |
| comboCap | 8 | Max combo multiplier |
| airPoints | 5 | Points per second airborne, added at the end |
| physicsStep | 1/120 | Fixed physics timestep |
| particleCap | 200 | Max live particles |

Experiments for the tune panel: recoilImpulse (150 to 600), gravity (400 to 1400), fireRate (3 to 10), magSize (4 to 16, step 1), airDrag (0.6 to 0.98).

## 17. Open questions

- Should shots fired while touching the floor count as misses for the combo? Recommendation: yes, keep one rule; the floor is the reload place, not the free-shot place.
- Should the tracer be truly instant or a very fast bullet? Recommendation: instant in v0.1; travel time is a gun property later.
