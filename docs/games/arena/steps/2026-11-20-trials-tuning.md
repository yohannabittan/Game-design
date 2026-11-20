# Arena step: trial numbers from play (locked 2026-11-20)

**The designer:** "yes you should build" (after `../playtests/2026-11-20-knife-trials.md` and `2026-11-18-trials-second-round.md`). Two-way door: numbers in `TUNING.trials` and one rule.

## What the player gets

A trial's gold is earned, not a first-try gift, and no trial can be run out without its point happening:
- **Knife Work:** the foe takes about three knives into gaps to fall (a gap knife does 12: his health about 30), so gold (3 knives left) means three throws, all into gaps; silver allows one miss.
- **The Knife Board:** medals about 15, 30 and 50 pots (the designer burst 54 in 101 s).
- **The Wheel:** the first wheel turns slower, so a first try lands bronze (the designer got 2 and 3 pots; bronze is 4). Later wheels keep their climb.
- **Gap Hunter:** medals about 40, 25 and 15 s (gold on the first try at 17.7 s).
- **Bare Knuckles:** a first try is bronze or silver, not gold (the designer: gold first try with 10 of 12 left): gold for an untouched win, or a sturdier foe; the builder's choice, said in the report.
- **Weather the Rage:** if he hasn't raged for a while (about 15 s), he rages anyway, so careful play can't run out the 90 s with nothing happening.
- The Capuan Feint is left as it is (the champion trials replace it, `2026-11-18-champion-trials.md`).

## Acceptance

1. Every number in `TUNING.trials.<id>`; the rage-anyway time in `TUNING.trials.rage`.
2. The trials check still passes; a check that Weather the Rage brings a rage within its time with a player who never strikes.
3. `npm run check arena` (the trials and range files at least, the whole suite once) and `npm run smoke` pass; replay hashes unchanged.
