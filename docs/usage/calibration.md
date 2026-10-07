# Plan calibration

Readings of the designer's Claude Max usage page, against the ledger's API-equivalent total at the same moment. The
ratio turns ledger dollars into share of the weekly allowance for planning. Readings include any non-project use of
the account, so the ratio is an upper bound on what the project uses.

| When | Weekly all models | Weekly Fable only | 5-hour session | Ledger since the week began | ≈ ledger $ per 1% of the week |
| --- | --- | --- | --- | --- | --- |
| 2026-09-30 23:02 (week began Mon 2026-09-28 20:00) | 52% | 57% | 7% | ~$895 | ~$17 |
| 2026-10-07 21:05 (week began Mon 2026-10-05 18:00) | 19% | 25% | n/a | ~$122 (sub-agents $91, orchestrator about $31, all Sonnet and Opus) | ~$6.4 |

Rules of thumb at that ratio: a fresh review about 0.25% of a week, a Sonnet layer 1 to 2%, a large Opus layer about
3.5%, a round of content shards about 4%, a long builder resumed across several rounds 9% or more. Fable is only the
orchestrator conversation; if its weekly cap nears 100%, move the orchestrator to Opus (`/model`).

Reading of 2026-10-07: the project used no Fable this week (the orchestrator is on Opus), yet the Fable-only meter reads 25%, so a good part of the week's usage is outside this project. The $6.4 per 1% is therefore a floor for the project, not a rate: the project's own share of the 19% is unknown and smaller. Pace: 2.1 of 7 days gone (30%) at 19%, on course for about 60% by the reset if the pace holds.
