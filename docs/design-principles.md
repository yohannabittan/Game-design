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

## 11. Meta screens: the Ink standard

The level select and the badges screen are read between plays, in a second. Ink got them right (designer's playtest, 2026-09-30); every game follows it.

1. **A tile is identity, state and one result.** A number or a small picture, its stars (or one best), at most two short tags (BOSS, CLEAN), and no more than three text items. Names, timers, attempts and badge hints live one tap away, never on the tile.
2. **State is drawn, not written.** Locked, open, cleared and mastered look different through the object's own art (ghosted and padlocked, outlined, filled, gilded). A tap on a locked tile says in one line what opens it.
3. **One unlock rule per ladder, and a resume button.** "One star opens the next" (per gun, per mode, where there are several ladders). A Play N button goes to the frontier, and the grid opens scrolled to it; a tile whose result improved pops once on return.
4. **One headline number, detail one tap away.** The menu shows one total (stars, or the game's one currency) and a button to the badges screen. Skins live on the badges screen, each locked swatch naming the badge that opens it. A small dot on that button marks a badge earned and not yet seen.
5. **A badge card is medal, name, condition.** The condition is about six words and always visible. A counter ("6/10") shows only on an unearned badge that counts something. Cards are grouped in three or four named tiers, each headed with "earned / total". Earned cards look earned (bright, bordered); unearned ones are shaded, never hidden.
6. **Rewards arrive where they were earned.** Badges and unlocks earned on a play appear as tickets on its result card, at most three (highest tier first, then "+n"). Toasts are for taps on locked things, not for rewards.
7. **Few sizes, nothing small.** Text is 14 px or larger in two or three size classes (for example 14, 20, 34). Tiles have no secondary line.
8. **Named in the game's own trade.** Tiers and badges speak the game's world (the tattoo trade in Ink: Apprentice, Artist, Master; Steady Hand, Full Sleeve). The fun is in the name; the condition stays plain.

Test: count the text items on the select screen and on one badge card, and time a first-timer finding "what do I do next" and "what did I just earn". Under two seconds each.
