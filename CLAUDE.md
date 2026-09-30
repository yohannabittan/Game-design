# CLAUDE.md

This repository is a library of small, touch-first, offline-capable skill games and the process for building them one layer at a time. Read this before touching anything.

## What is where

| Path | Purpose |
| --- | --- |
| `docs/process.md` | The pipeline: idea, concept, PRD, scaffold, layered build, deploy, playtest, decide |
| `docs/design-principles.md` | The rules every game is held to. A build that breaks one is wrong. |
| `docs/minimum-lovable-product.md` | What a v0.1 must and must not contain |
| `docs/pattern-library.md` | Reusable mechanic kernels with skill ladders and MLP scopes |
| `docs/game-ideas.md` | Backlog with pattern mapping and status |
| `docs/adr/` | Architecture decisions. Read the index. Do not deviate from an accepted ADR without writing a new one. |
| `docs/games/<slug>/` | Per-game concept, PRDs, changelog, playtests |
| `templates/` | Concept card, PRD, playtest report, ADR |
| `prompts/` | One prompt per build layer |
| `skeleton/` | The template every game is copied from. `skeleton/README.md` is the engine contract. |
| `games/<slug>/` | One folder per game, self-contained and deployable |
| `tools/` | `new-game.sh`, `make-icons.py`, `smoke.mjs`, `usage.py` (token ledger) |
| `docs/usage/` | Token ledger: API-equivalent cost by game, role, model and day (`tools/usage.py`) |

## Hard rules for builder sessions

1. **Plain Canvas and vanilla JavaScript.** No frameworks, bundlers, transpilers, or runtime dependencies (ADR-0002).
2. **One file per layer.** A build layer rewrites `games/<slug>/src/game.js` and nothing else, unless the layer prompt explicitly allows assets (ADR-0007).
3. **Never edit a game's `engine.js`.** Engine changes go in `skeleton/src/engine.js` with an ADR, then get copied into the game being worked on (ADR-0006).
4. **No DOM from games.** Everything is drawn on the canvas. The toast is the one exception, via `E.toast`.
5. **Every tunable number lives in `TUNING`.** Level and wave data are plain arrays in `game.js`.
6. **Randomness only in setup, never in resolution, always seeded** through `makeRng` (ADR-0008). `Math.random` is for cosmetics only.
7. **Touch first, portrait, one thumb.** 44 px targets, HUD in the safe area, thumb never hides the judged object (ADR-0004).
8. **Saves go through `E.save`.** Changing the save shape means bumping `saveVersion` and writing `migrate` (ADR-0005).
9. **Stay inside the PRD.** If it is not in the PRD it is not built. Open questions get the simplest option, noted in the changelog.
10. **Smoke test before done.** `npm run smoke` must pass. It boots every game at phone size and fails on any console error, missing asset, or service worker failure.
11. **Deploy hygiene.** Any deploy-worthy change bumps `CACHE_VERSION` in that game's `sw.js` and adds a line to `docs/games/<slug>/CHANGELOG.md`.

## Orchestration (ADR-0010)

The session the designer talks to is the orchestrator. It writes and reviews documents and dispatches builds; it does not write `game.js` itself unless a builder has failed twice.

- **Builder:** an `Agent` on `sonnet` by default, `opus` for feel-critical or high-risk layers. Prompt is the layer file from `prompts/` with placeholders filled, verbatim. Builders read the repo themselves.
- **Reviewer:** an `Agent` on `sonnet` with fresh context running `prompts/08-review.md`. Reports, never edits.
- **Escalation:** builder retry with findings, then next model up, then fix the PRD or prompt.
- **Parallelism:** across games, and within a content layer as data shards merged by the orchestrator (ADR-0012). Never two builders on one game's mechanic.
- **Log it:** each changelog line names the model that built the layer and whether it passed review first time.
- **Count it:** after a build or review lands, run `python3 tools/usage.py` and commit `docs/usage/` with it, so the ledger outlives the container.

## Starting a new game

```
tools/new-game.sh <slug> "<Title>" [hex-color]
```

Then fill `docs/games/<slug>/prd-v0.1.md` from the concept card, lock it, and run `prompts/01-mechanic.md`.

## Running things

```
npm install          # once, for the smoke test's Playwright (this cloud environment has it globally already)
npm run smoke        # boots skeleton and every game headlessly; exits non-zero on any error
npm run serve        # static server on :8080 for playing on a phone over wifi
```

## Style

- Scenes are plain objects: `{ enter, exit, update, render, onTap, ... }`. See `skeleton/src/game.js`.
- Short comments only where the physics or a rule is non-obvious.
- No comment that restates the code. No dead code. No console output in shipped games.
- Commit messages say what changed for the player or the process, one line, then details if needed.

## When in doubt

The PRD beats your taste. The design principles beat the PRD. An ADR beats both on how, never on what.
