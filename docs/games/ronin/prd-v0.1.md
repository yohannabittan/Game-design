# PRD v0.1: Ronin

| | |
| --- | --- |
| Slug | `ronin` |
| Version | 0.1 |
| Pattern | P4 + P10 |
| Date | 2026-11-17 |
| Status | locked (an exploration, one-shot) |

The designer: "I'm curious to see what you could one shot on samurai dash slash." Judged by two minutes of their play: "more" or drop it. Idea from `docs/game-ideas.md` (requested by the designer's best friend: a platformer with group fights; a ronin protecting a village).

## 1. Pitch

One verb for moving and fighting: **swipe to dash-slash**. Each swipe dashes you that way and cuts whatever is in the path. Climbing and fighting are the same skill.

## 1b. Context, story, characters, emotion

A ronin climbs through a village the bandits have taken, from the street to the rooftops. The feeling: fast, clean, a little dangerous. A chain of cuts without touching the ground is the high.

## 2. The first ten seconds

Play. You stand on the street; a bandit stands on a ledge up and to the right, and a dotted arc shows one swipe toward him. You swipe: a dash, a cut, he falls, you hang in the air for a breath with your dash refilled. The next bandit is in reach.

## 3. Core loop and session shape

Swipe, dash, cut, land or chain, climb. One climb takes 40 to 90 seconds. Reach the roof bell to win; lose three hearts and you fall. Restart is one tap.

## 4. Controls

- **Swipe anywhere** (portrait, one thumb): the ronin dashes `dash.len` in the swipe's direction, over `dash.time`. The direction is the swipe's direction, not where the thumb is, so the thumb never has to cover him (ADR-0004). A swipe shorter than `swipe.min` px is ignored.
- A dash cuts every bandit and arrow its path crosses (`dash.width`).
- In the air you fall under `gravity`. You have `dash.air` air dashes; landing on a ledge or the ground refills them, and **every kill refills one**, so a chain of kills can stay in the air.
- You land on ledges from above; you pass through them from below while dashing upward.
- No other input. No buttons in play besides pause in the safe area.

## 5. Skill model

- **Floor:** swipe at a bandit, he dies; anyone can climb slowly, landing between dashes.
- **Ceiling:** reading the layout to chain kills without landing; cutting arrows; dashing through a bandit during his wind-up rather than waiting.
- **Timing:** a bandit telegraphs (`bandit.tell` s, a clear flash and raised blade), then strikes the space in front of him (`bandit.reach`). In that space when the strike lands: lose a heart and get knocked back. Dashing through him before it lands kills him. A correct input always wins (ADR-0008).

## 6. Randomness policy

None in resolution. The level is a fixed array. `makeRng` only if cosmetic placement needs a seed.

## 7. Goal, fail, score

- **Goal:** ring the bell on the top roof.
- **Fail:** three hearts lost. Falling off the bottom of the screen costs a heart and puts you back on the last ledge you stood on.
- **Score:** kills, best chain (kills without landing), time. The end card shows all three and the best chain so far.

## 8. Progression in v0.1

None beyond the saved best chain and best time (`E.save`).

## 9. Content plan

One level, about six screens tall, scrolling upward with you (the camera follows, never down past the fall line). In order:
1. The street: two lone sword bandits, each one swipe from the last ledge (teaches dash and cut).
2. A gap that needs a dash across (teaches moving).
3. A bandit above a ledge (teaches dashing up through a ledge).
4. Three bandits in a staircase, each within one dash of the last (teaches the chain: a kill refills the dash).
5. An archer on a far ledge: his arrow flies straight and slow; dash through it to cut it, or avoid it.
6. A group of four with an archer, chainable in one flight by a good player.
7. The roof and the bell.

Two bandit types: **sword** (tell, then strike in front) and **archer** (tell, then one arrow along a shown line, every `archer.every` s).

## 10. Juice list

Layer 1 only: a short slash line along the dash, a bandit that drops, a number for the chain. Hit and miss sounds from the engine. Nothing more.

## 11. Art direction

Plain shapes. Three colours: ink black (the ronin, ledges), paper cream (background), blood red (bandits, the slash). The ronin is a small figure with a straw hat shape so he reads at a glance; bandits are red figures; the tell is a white flash.

## 12. Audio

Engine sounds on cut and on being hit.

## 13. Modes

One.

## 14. Scope fence

No parry, no rival samurai boss, no spear bandits, no wall chains, no upgrades, no extra levels, no story screens beyond the title, no art. Those are the next layers if the designer says "more".

## 15. Acceptance criteria

1. Portrait at 390x844 and 375x667: a swipe anywhere dashes in the swipe's direction; the thumb need not be near the ronin.
2. Every bandit in sections 1 to 4 of the level can be reached and killed by the route shown; the staircase of three can be chained without landing.
3. A bandit's strike after his tell costs a heart if you stand in his reach; dashing through him during the tell kills him and costs nothing.
4. An arrow is cut by a dash through it.
5. The bell ends the run with the end card (kills, best chain, time); three lost hearts ends it with the same card; restart is one tap.
6. A scripted run of fixed swipes rings the bell (proves the level is completable); `npm run smoke` passes with the new game.
7. Every number is in `TUNING`.

## 16. Tuning table

| Name | Start | Meaning |
| --- | --- | --- |
| `dash.len` | 0.28 | dash length, as a share of the screen's width |
| `dash.time` | 0.12 | seconds a dash takes |
| `dash.width` | 0.05 | half-width of the cut along the dash (share of width) |
| `dash.air` | 2 | air dashes before you must land or kill |
| `dash.hang` | 0.18 | seconds of slowed fall after a kill |
| `swipe.min` | 24 | px a swipe must travel |
| `gravity` | 2.2 | fall acceleration, screen heights per s² |
| `hearts` | 3 | |
| `bandit.tell` | 0.7 | seconds of wind-up |
| `bandit.reach` | 0.12 | strike reach in front of him (share of width) |
| `bandit.rest` | 1.2 | seconds between his strikes |
| `archer.every` | 2.4 | seconds between arrows |
| `archer.speed` | 0.45 | arrow speed, widths per s |

The builder may adjust these so the level plays well, and says what it changed.

## 17. Open questions

- None blocking. If something is unclear, take the simplest option and note it in the report.
