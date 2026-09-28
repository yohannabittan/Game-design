# Per-game documents

One folder per game, matching `games/<slug>/`:

```
docs/games/<slug>/
  concept.md          from templates/concept-card.md
  prd-v0.1.md         from templates/prd-v0.1.md, the one-shot contract
  prd-v0.2.md ...     deltas, one per evolve decision
  CHANGELOG.md        one line per deploy
  playtests/          YYYY-MM-DD.md from templates/playtest-report.md
```

`tools/new-game.sh` creates the folder with the PRD and changelog stubs.
