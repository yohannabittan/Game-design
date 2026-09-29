# PRD v0.5: Ink (delta from v0.4)

| | |
| --- | --- |
| Slug | `ink` |
| Version | 0.5 |
| Date | 2026-09-29 |
| Status | locked for content, missions and the daily mode |
| Answers | the designer's brief: more gamification and more content; personality from story |

## A. Content

Five new stencils from shards (anchor, rose, dagger, swallow, skull boss), placed in the ladder by measured perfect-path time so the curve stays monotonic; the set becomes 15 with the skull as the final boss and the snake as the mid boss. Timers by the multiplier rule from measured times. Each carries a `body` part.

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
