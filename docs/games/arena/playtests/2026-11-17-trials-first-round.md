# Arena playtest, the first round of Trials (2026-11-17, the designer)

**Build:** the dev channel, `arena-v84`, exported 2026-11-17 at 22:29 UTC. Phone, 874x402. Table made with `tools/playtest.mjs`.

## The designer's words

- "I see v84 now and I enjoyed the first round of trials."

## Trials (five attempts)

| Trial | Result | Medal |
| --- | --- | --- |
| Iron Wall | streak 1 | none |
| Iron Wall | streak 3 | bronze |
| Iron Wall | streak 1 | none |
| Gap Hunter | 17.7 s | **gold, first try** |
| Breaker | 62.8 s | bronze |

- **Gap Hunter's gold (30 s) is too easy** for this player: gold on the first attempt, in 17.7 s. Tighten it (about 40 / 25 / 15 s) with the next Trials build.
- **Iron Wall is a real climb:** three tries, best 3. Right where it should be.
- **Breaker is beatable** (the verifier's bot could not): bronze at 62.8 s.
- Not tried yet: the fist trials, The Capuan Feint, Weather the Rage, Stagger Him.

## Runs since the last export (five)

| Time | Arena | Fighter | Weapon | Armour | Reached | Lost to | Counts |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 986:17:17 | city | Iuba, lean 3/3/3 | axe +1 knives | light (1 plate) | 4/5 | Oenomaus | 17/68/6 j/s/o, 26 bl (19 p), 39 gap, 15 taken, 1 knives, 0 in gaps, 3.5 bleed |
| 987:56:27 | rome | Iuba, lean 2/4/3 | sica x2 | light (2 plates) | 2/5 | Young bear | 4/13/0 j/s/o, 4 bl (1 p), 8 gap, 4 taken, 10 bleed |
| 1032:35:11 | rome | Decimus, medium 5/3/4 | sica | medium (3 plates) | 3/5 | Pugnax | 39/45/6 j/s/o, 18 bl (5 p), 30 gap, 16 taken, 43.5 bleed |
| 1058:32:31 | rome | Tullia, medium 4/3/2 | mace x2 | none | 2/5 | Young bear | 2/35/0 j/s/o, 3 bl (2 p), 10 gap, 4 taken |
| 1059:37:00 | pit | Lucia, lean 3/3/4 | mace x2 +1 knives | none | 5/5 | Marcus the Red | 15/25/19 j/s/o, 11 bl (4 p), 31 gap, 13 taken, 1 knives, 0 in gaps, 15 bleed |

- **Two weapons were played three times** (two sicas, two maces twice). The two-mace run in the Pit reached the champion with **19 overheads** against 25 slashes and 15 jabs: with two maces the designer chops.
- **The young bear in Rome's bout 2** ended two more runs (two sicas; two maces, no armour).
- The single-sica Rome run: 39 jabs to 45 slashes, the most jab-heavy sica run so far (jabs landing since v80).
- One knife thrown in two runs (one hit plate, one missed): the new throw (v82) has barely been used in a run yet.

## Next

- Tighten Gap Hunter's medals with the next Trials build.
- `tools/playtest.mjs` does not read `trial` lines yet; add it the next time the tool is touched.
