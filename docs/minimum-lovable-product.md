# Minimum lovable product

The smallest combination of features that produces delight. Not the smallest thing that runs. Delight is the bar because a mini game that is merely functional teaches nothing in a playtest: you cannot tell whether the mechanic is dull or the build is unfinished.

## The delight test

After three minutes of play, the tester wants one more go and can say why. If either half fails, the v0.1 is not done.

## Anatomy of a lovable v0.1

Every kernel has these five parts. Nothing else is required.

1. **One verb.** Aim, trace, jump, swipe, tap. Exactly one.
2. **One skill axis.** The thing you get better at. Timing, precision, route choice, resource pacing. One.
3. **Immediate feedback.** Within 100 ms of the input: sound, particle, screen reaction. The player must feel the hit and the miss differently.
4. **A goal and a score.** A reason to try again that is visible on the end screen: a number to beat, a level to clear, a star to earn.
5. **One-tap restart.** From fail to playing again in under a second.

Plus three non-negotiables from the design principles: naked run possible, deterministic resolution, playable offline on the phone.

## What is deliberately not in v0.1

- More than one mode
- Unlocks, currencies, shops
- Tutorials with text (the first level is the tutorial)
- Settings beyond mute
- Sprites, music, custom fonts
- Bosses (unless the boss is the mechanic)
- Any menu deeper than one screen

These arrive in later layers only after the delight test passes. If the kernel is not fun bare, none of these will save it, and they cost more to build on a wrong kernel than to add to a right one.

## Kernels by pattern

What "minimum lovable" means depends on the concept, so here is the kernel per mechanic family. See `pattern-library.md` for the full patterns.

| Pattern | Kernel that delights | Content needed for v0.1 |
| --- | --- | --- |
| Aim and launch | Drag to aim, release to fire, watch it fly, land it in fewer tries | 8 to 12 hand-made levels, first three teach |
| Trace and fill | Finger down, trace the shape, the fill grows behind you, error budget shown | 10 shapes ordered by difficulty |
| Recoil locomotion | Each shot shoves you; you steer by shooting | 1 arena, targets that spawn, a timer |
| Momentum platforming | Hold to run, tap to jump, speed is the reward | 6 short courses with a timer |
| Lane runner with mount swap | Auto-run, tap to jump, land on the next mount | Endless, 3 mount behaviours, 2 obstacle heights |
| Eat and grow | Drag to steer, eat smaller, avoid bigger, grow | Endless, 3 prey sizes, 1 predator |
| Tower defense | Tap to place, waves come, hold the line | 5 waves, 2 tower types, 1 map |
| Dig and upgrade | Drag to dig, sell at surface, buy depth | 1 mine, 3 ore types, 3 upgrades |
| Turn-based combat | Tap an action, watch the exchange | 3 enemies, 3 actions, no inventory |
| Spot and time | Look, find, tap at the right moment | 10 scenes |

## How to size the content column

Enough that the second half of the content requires a tip from the mastery ladder the first half did not. Not more. Content is the cheapest thing to add later and the most expensive thing to throw away when the kernel changes.
