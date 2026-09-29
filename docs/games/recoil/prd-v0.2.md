# PRD v0.2: Recoil (delta from v0.1)

| | |
| --- | --- |
| Slug | `recoil` |
| Version | 0.2 |
| Date | 2026-09-28 |
| Status | locked for the mechanic delta and content |
| Answers | playtest 2026-09-28 (layer 1): "too easy; the range finder tells you when to shoot; needs speed, dodging and weaving targets, hordes; guns with damage, fire rate and accuracy; accuracy sets the range finder length; skeet; a boss with weak points then a hard core" |

Everything in `prd-v0.1.md` stands unless changed here.

## A. Gun profile

A gun is data: `{ name, damage, fireRate, accuracy, kickPerShot, kickRecovery, magSize, reloadSeconds, auto }`.

- **damage:** hit points removed per hit. Ordinary targets have 1 hit point; boss parts have more.
- **fireRate:** shots per second while holding, if `auto`; the minimum interval between taps otherwise.
- **accuracy:** 0 to 1. Sets the range finder length: the dotted line extends `accuracy` of the way from the gun to the right edge. At 1 the line reaches the edge; at 0.4 it stops less than halfway and the player extrapolates. Accuracy never adds spread; shots are still exact. Deterministic.
- **kickPerShot, kickRecovery, magSize, reloadSeconds** as in v0.1, now per gun.

v0.2 ships two guns so the profile is exercised: **Service pistol** (damage 1, fireRate 9, accuracy 1.0, kick 8, recovery 32, mag 12, semi-auto) and **Carbine** (damage 1, fireRate 8, accuracy 0.55, kick 5, recovery 24, mag 20, auto: hold to fire). Rule learned in the build: a gun's fire interval must be shorter than the time its recovery takes to undo one kick (kickPerShot / kickRecovery), or the kick can never stack and the mechanic vanishes. Pistol: 0.11 s interval against 0.25 s recovery; carbine: 0.125 s against 0.21 s. The gun is chosen on the menu before a challenge. The unlock table (guns gated by points) is the progression layer; in v0.2 both guns are available and the menu shows which one is selected.

## A2. Barrel sway from movement

Moving the gun moves the barrel too, less than a shot does. While the gun's vertical speed is `v` (design units per second), the barrel angle gains `swayPerSpeed * v` degrees in the direction the barrel lags (moving up tilts the barrel down, moving down tilts it up), capped at `swayMax`. When the gun stops, the sway settles at `swayRecovery` degrees per second. Sway adds to the kick; the range finder shows the sum. Deterministic. The effect: settle the left thumb before firing, or fire while the sway is at a known value.

## B. Target behaviours

Targets are data with a behaviour and hit points:

- **still** (v0.1), **approach** (v0.1).
- **weave:** approaches while oscillating vertically with amplitude `weaveAmp` and period `weavePeriod`; deterministic from spawn time.
- **dodge:** when a shot is fired while the target is within `dodgeRange` of the barrel line, it jumps `dodgeStep` up or down (direction from its seed) once per `dodgeCooldown`. Announced: it flickers before it can dodge again. The counter is to shoot where it will land, or to fire two quick shots.
- **horde:** a group of `hordeCount` small targets spawned together in a loose column drifting left; each is worth outer-ring points only; hits chain the combo fast.
- **skeet:** launched from the bottom right in a parabolic arc with `skeetSpeed` and gravity `skeetGravity`; visible for about 2 seconds; only the bullseye and inner zones count.
- **boss part:** a stationary target with `hp` hit points, part of a sequence: parts are hit in order (the active one is highlighted; hits on inactive parts score outer only and do not damage). When all parts are down the **core** appears, with `coreHp` and a smaller bullseye, and it drifts. The challenge ends when the core is down or the timer ends.

All motion is deterministic from the challenge seed and the shot log; the only randomness is the seed.

## C. Difficulty as data

Each challenge level sets: target scale, speed multiplier, count alive, spawn interval, and which behaviours appear, from the ladder's table. Higher levels are harder only through those numbers and behaviours.

## D. Ladders in v0.2

| Ladder | Levels | What scales | New in v0.2 |
| --- | --- | --- | --- |
| Accuracy | 1 to 3 (v0.1) plus 4 | scale down, `dodge` on level 4 | level 4 |
| Speed | 1 to 3 (v0.1) plus 4 | speed, count, `weave` from level 3, `horde` waves on level 4 | weave on 3, level 4 |
| Skeet | 1 to 2 | launch speed, interval, two at once on level 2 | new |
| Boss | 1 | 3 parts of 2 hp, then a core of 6 hp that drifts | new |

Star thresholds by the v0.1 rule (85/55/30 of a scripted perfect run) per gun: thresholds are computed with the pistol; the carbine plays the same thresholds (it is faster but less accurate, which is the trade).

## E. Verification (adds to v0.1 section 15)

- [ ] A weave target crosses the barrel line at least twice per approach at Speed 3 defaults, so a shot timed by the range finder alone misses about half the time in a harness with a "shoot when the line touches" policy.
- [ ] A dodge target evades a single shot from a static barrel every time within `dodgeRange`, and is hit by the second of two shots fired `dodgeCooldown` apart at the landing spot.
- [ ] Skeet targets are reachable: a scripted shot at the apex scores at least inner on every launch of Skeet 1.
- [ ] The boss sequence enforces order; the core cannot be damaged before all parts are down; both guns can finish Boss 1 within the timer by a scripted run.
- [ ] Range finder length equals accuracy times the distance to the right edge, and a shot lands where the extended line would.
- [ ] Sway: dragging the gun at 200 units per second tilts the barrel 4 degrees at the defaults, a shot fired mid-drag lands on that tilted line, and the barrel is back within 0.1 degree of level 0.2 seconds after the drag stops.
- [ ] Every challenge, both guns: same input log, same score at 30 and 120 fps.

## F. Tuning additions

| Name | Value | Meaning |
| --- | --- | --- |
| swayPerSpeed | 0.02 | Degrees of barrel sway per unit per second of gun movement (a 200 u/s drag sways 4 degrees) |
| swayMax | 6 | Cap on sway in degrees |
| swayRecovery | 40 | Degrees per second the sway settles once the gun stops |
| weaveAmp | 40 | Vertical amplitude of a weave |
| weavePeriod | 1.4 | Seconds per weave cycle |
| dodgeRange | 30 | A shot within this of the target centre triggers a dodge |
| dodgeStep | 60 | Dodge distance |
| dodgeCooldown | 1.2 | Seconds before a target can dodge again (it flickers when ready) |
| hordeCount | 6 | Targets per horde |
| skeetSpeed | 420 | Launch speed |
| skeetGravity | 380 | Gravity on skeet |
| bossPartHp | 2 | Hit points per boss part |
| bossCoreHp | 6 | Hit points of the core |
| bossCoreDrift | 50 | Core drift speed |

Experiments (presets): "Twitchy" (dodgeRange 45, dodgeCooldown 0.8), "Lazy" (dodgeRange 20, dodgeCooldown 1.8), "Fair" (defaults); plus sliders for weaveAmp, skeetSpeed, the carbine's accuracy (0.3 to 1.0), and swayPerSpeed (0 to 0.06) so movement sway can be turned off, felt, or exaggerated.

## G. Scope fence additions

Not in v0.2: the unlock table and points gating, attachments, more than two guns, spread, bullet travel time, enemies that shoot back, duels.
