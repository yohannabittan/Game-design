# Arena playtest, the second round of Trials (2026-11-18, the designer)

**Build:** the dev channel, `arena-v85` (the chambered guard), exported 2026-11-18 at 10:13 UTC. Phone, 874x402.

## The designer's words

- "Here's my latest play test."

## Trials (six new attempts; the five from 2026-11-17 are in `2026-11-17-trials-first-round.md`)

The stock fighter has 12 health (halves). Fist trials and Rage score the health left when he falls or the last rage ends.

| Trial | Result | Medal | Medals (bronze / silver / gold) |
| --- | --- | --- | --- |
| Bare Knuckles | 10 of 12 left, 20.8 s | **gold, first try** | 1 / 6 / 10 |
| Stagger Him | 17.1 s | silver, first try | 40 / 25 / 15 s |
| Brawl | 7 of 12 left, 46.3 s | silver, first try | 1 / 5 / 9 |
| The Capuan Feint | **0 of 5 reads**, 57.9 s | none | 3 / 4 / 5 reads |
| Weather the Rage | ran out of time (90 s) | none | 1 / 7 / 11 |
| Weather the Rage | 10 of 12 left, 40.3 s | silver, second try | 1 / 7 / 11 |

- **All eight T1 trials are now tried.** Medals so far: gold in Gap Hunter and Bare Knuckles (both first try), silver in Stagger Him, Brawl and Weather the Rage, bronze in Iron Wall and Breaker, none in The Capuan Feint.
- **The designer came back to Trials on their own** the morning after the first round: Trials pull.
- **Bare Knuckles gold on the first try**, like Gap Hunter: both golds are too easy. Fist trials were already suspected of giving way to slash spam.
- **The Capuan Feint: 0 of 5.** No check plays a real read (the trials check sets the score directly), so it is not yet known whether the read is hard or can't happen. The export doesn't say why a read failed (BIT THE FAKE or NOT PERFECT).
- **Weather the Rage's first try timed out:** his rage only comes once he is wounded, so a careful player can run out the clock with no rage at all.
- No fights since v85: the new guard has not been felt in a run yet.

## The Capuan Feint checked (2026-11-18, Sonnet verifier, 3 min)

- **Reads are possible:** a bot with real taps scored 5 of 5 (fakes left alone, the real blow blocked 0.28 s or less before it lands). Now a permanent check, `tools/checks/arena/capuan.mjs` (9 s).
- **Why it is hard:** fake 1 and the real blow wind up for the same time (0.81 s), and a fake can come at the same height. A fake's tell is a violet haze and a violet button, but its button starts orange like the real one's; the real blow's only cue is the gold "HIGH NOW" in its last 0.25 s. Any shield raised on a fake is BIT THE FAKE. Sheet: `../sketches/capuan-exchange-sheet.png`.
- **A feel question for the designer, not a bug:** is it hard in a good way, or unreadable? If unreadable, the cheapest changes are a fake that winds up visibly shorter (`TUNING.champs.varro.fakes`) or the fake's violet from its first frame.

## Next

- `tools/playtest.mjs` reads `trial` lines (done 2026-11-18).
- With the next Trials build: tighten Gap Hunter (about 40 / 25 / 15 s) and Bare Knuckles; fist trials that need skill; trim the trials check.
