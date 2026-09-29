# PRD v0.5: Ink (delta from v0.4)

| | |
| --- | --- |
| Slug | `ink` |
| Version | 0.5 |
| Date | 2026-09-29 |
| Status | locked for content, missions and the daily mode |
| Answers | the designer's brief: more gamification and more content; personality from story |

## A. Content

Five new stencils from shards (anchor, rose, dagger, swallow, skull boss). The first merge ordered them by perfect-path time alone and the review showed that inverts edge difficulty (thin limbs are hard even when short). Order, decided after the review on time-to-99, edge share and a noise test:

1 Circle, 2 Diamond, 3 Heart, 4 Star, 5 Bolt, 6 Crescent (boss), 7 Halo, 8 Clover, 9 Dagger, 10 Anchor, 11 Rose, 12 Swallow, 13 Snake (boss), 14 Key, 15 Skull (final boss).

Key sits between the two bosses as the beat. The skull's timer is 1.35x its perfect path (39 s) so the final boss is not softer than the mid boss. Other timers unchanged. Each stencil carries a `body` part.

**Saves are keyed by index, so any reorder ships with a saveVersion bump and a remap in `migrate`.** From the ten-stencil layout (v0.4, indices Circle 0, Diamond 1, Heart 2, Star 3, Crescent 4, Bolt 5, Halo 6, Clover 7, Key 8, Snake 9) the map to the new order is [0,1,2,3,5,4,6,7,13,12]. From the interim fifteen-stencil layout that shipped as cache v11 (Circle, Diamond, Heart, Star, Dagger, Crescent, Anchor, Bolt, Halo, Swallow, Rose, Clover, Key, Snake, Skull) the map is [0,1,2,3,8,5,9,4,6,11,10,7,13,12,14]; a v4 save with any key at 10 or above is the interim layout.

## B. Missions

Badge tiers: Apprentice, Artist, Master.

| Tier | Badge | Earned by |
| --- | --- | --- |
| Apprentice | First Ink | any pass |
| Apprentice | Steady Hand | any clean pass |
| Apprentice | Five Stars | five stars on any stencil |
| Artist | Cornered | clean pass on the star |
| Artist | Thin Line | five stars on the crescent |
| Artist | Two Edges | clean pass on the halo |
| Artist | Flash Sheet | three stars or better on every stencil in the first ten |
| Master | Serpent | clean five stars on the snake |
| Master | Bone | clean five stars on the skull |
| Master | Full Sleeve | five stars on every stencil |

Missions screen on the menu; badge pop on the card; saved per badge.

## C. Daily stencil

A "Daily" tile on the menu: the day's stencil is chosen from the set by `hashString(date)`, played with a tighter timer (`dailyTimerMult` 1.4 times the perfect-path time) and one attempt per day recorded (best of the day shown, replays allowed but the first attempt is the daily score). No network; the date comes from the device clock.

## D. Experiment for tomorrow

Timer feel presets: "Relaxed" (all timers 2.6x the perfect path), "Standard" (current rule), "Tight" (1.6x), with a slider for the global multiplier. Question for the designer: which multiplier makes three stars a first-try result and five stars a real achievement.

## E. Tuning additions

| Name | Value | Meaning |
| --- | --- | --- |
| dailyTimerMult | 1.4 | Daily stencil timer as a multiple of its perfect-path time |
| timerGlobalMult | 1.0 | Experiment: scales every timer (presets set it) |
