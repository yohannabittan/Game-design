# ADR-0006: One repo; each game is a copy of the skeleton, not an import

- **Date:** 2026-09-28
- **Status:** accepted
- **Scope:** all games

## Context

A shared engine can be referenced by every game (one file, fixes propagate) or copied into each game (each game freezes its engine). One-shot builds want a stable, local, self-contained target. Games diverge over time, and an engine change that improves one game can break another that nobody replays for a month.

## Decision

One repository. `skeleton/` is the template. `tools/new-game.sh` copies it into `games/<slug>/`. Each game owns its copy of `engine.js`, `sw.js`, manifest, and icons. Engine improvements land in `skeleton/` first, with an ADR if the contract changes, and are copied into a specific game only when that game is being worked on.

## Consequences

- Every game folder is self-contained and deployable on its own. The service worker cache list is per game and simple.
- Engine fixes do not propagate automatically. A `tools/` script to sync a game's engine from the skeleton can be added when it is first needed.
- Duplication across games is accepted. It is the cost of isolation and it is small.
- The PWA scope is per game, which ADR-0003 needs anyway.

## Alternatives considered

- Shared `engine.js` at the repo root imported by all games: propagation is nice, but it couples every game's service worker cache to a file outside its scope and lets a change break unrelated games.
- One repo per game: too much overhead for a library of mini games and loses the shared docs.
