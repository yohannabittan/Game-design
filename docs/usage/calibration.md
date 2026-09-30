# Plan calibration

Readings of the designer's Claude Max usage page, against the ledger's API-equivalent total at the same moment. The
ratio turns ledger dollars into share of the weekly allowance for planning. Readings include any non-project use of
the account, so the ratio is an upper bound on what the project uses.

| When | Weekly all models | Weekly Fable only | 5-hour session | Ledger since the week began | ≈ ledger $ per 1% of the week |
| --- | --- | --- | --- | --- | --- |
| 2026-09-30 23:02 (week began Mon 2026-09-28 20:00) | 52% | 57% | 7% | ~$895 | ~$17 |

Rules of thumb at that ratio: a fresh review about 0.25% of a week, a Sonnet layer 1 to 2%, a large Opus layer about
3.5%, a round of content shards about 4%, a long builder resumed across several rounds 9% or more. Fable is only the
orchestrator conversation; if its weekly cap nears 100%, move the orchestrator to Opus (`/model`).
