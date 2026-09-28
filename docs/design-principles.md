# Design principles

These are the rules every game in this library is held to. They come from what made the old Flash favourites good, written down so a one-shot prompt can be checked against them. When a PRD or a build contradicts one of these, the PRD is wrong or the principle needs an ADR.

## 1. Obviously skill-based

A new player must be able to tell, within one attempt, that the outcome was theirs. The verb is legible: aim, trace, jump, time. If someone cannot say "I lost because I did X wrong", the mechanic is not ready.

Test: watch a first-timer for 30 seconds. They should be able to name what they are trying to get better at.

## 2. A mastery ladder with named rungs

Depth is measured in tips. The PRD must list them.

| Rung | Tips needed | What it feels like |
| --- | --- | --- |
| Intermediate | 1 to 3 | "Oh, I can bank it off the wall." |
| Expert | 3 to 5 | "Hold shorter on downhill, tap twice for a hop." |
| Legendary | more, and practice | Tricks the game never tells you, discovered by playing. |

If you cannot write three tips, the mechanic has no ladder. Do not build it yet. If the tips are all about memorising layouts rather than technique, that is content depth, not skill depth, and it wears out.

## 3. Outsized rewards for skill, and skill beats gear

Being good must pay more than being equipped. Concretely:

- A "naked run" is always possible. Every level can be finished with starting equipment by an excellent player. Gear lowers the skill needed, it never replaces it.
- Skill gets visible, disproportionate rewards: combo multipliers, perfect bonuses, a gold tier, a shorter route. A perfect play should feel like it earned three times a sloppy one, not ten percent more.

Test: can the strongest upgrade path carry a player who is not improving? If yes, the balance is off.

## 4. Grind that is valuable, and balanced against skill

Progress should be worth having and never mandatory. Unlocks change how you play (a new gun's recoil, a new animal's behaviour) more than how strong you are. Where gear does add power, it should feel like time invested, not a wall.

Rule of thumb: an unlock either opens a new way to play, or reduces the skill needed by a small step. Never both at once, and never a large step.

## 5. Deterministic resolution, random setup

Randomness decides what you face. It never decides whether what you did worked.

- Allowed: layout, enemy order, which items are offered, wind that is shown before you shoot.
- Not allowed: damage rolls on a clean hit, a jump that sometimes fails, a shot that scatters after a perfect release.

If a perfect input can produce a bad outcome, the player cannot learn, and principle 1 breaks.

## 6. Smart randomness

Variety without unfairness. This is what keeps a simple mechanic from feeling repetitive, the way The Binding of Isaac or All Who Wander give many different runs through one world.

- Seeded. Every run has a seed. A daily seed makes runs comparable; sharing a seed is a free feature.
- Combinatorial. Variety comes from combining a small set of parts (obstacles, modifiers, items) rather than authoring endless content.
- Guaranteed. Pools have pity rules: something useful appears within N picks, no run is unwinnable by draw.
- Announced. Modifiers are shown before play starts, so the player plans instead of suffers.

## 7. Cohesive vibe

One palette, one audio identity, one feel. Programmer-art shapes are fine if they are consistent. Feedback is everywhere: every hit has a sound, a particle and a flash; every miss has a distinct one. Achievements and badges carry a theme, the way Khan Academy's badges climbed from meteorite to moon to sun and were named after Kepler and Newton. Theme makes progress feel like a story rather than a counter.

## 8. Several modes on one mechanic

Once a mechanic works, modes multiply content for almost no cost. Standard set: levels, endless, time attack, daily seed, boss rush, zen (no fail). Ship one mode in v0.1 and add modes before adding mechanics.

## 9. Plane-proof

Every game must be fully playable with the phone in airplane mode, from a home-screen icon, in portrait, with one thumb.

- Sessions are 30 seconds to 5 minutes. Closing the app mid-run is never punished; a run can be resumed or is cheap to restart.
- Nothing requires a network, an account, or a clock.
- Save happens automatically. There is no save button.

## 10. Pacing beats

The ball-to-hole game had a boss every few levels and the rest was map design. That cadence works: a run of normal levels teaching one idea, then a bigger test of everything so far. Plan the beat in the PRD: every X levels something changes shape.
