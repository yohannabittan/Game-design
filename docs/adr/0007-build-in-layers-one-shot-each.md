# ADR-0007: Build in layers, one one-shot prompt per layer, game.js is the unit

- **Date:** 2026-09-28
- **Status:** accepted
- **Scope:** all games, process

## Context

The aim is to one-shot aspects of a game so the iteration budget goes to content and feel. A single "build the whole game" prompt fails in ways that are hard to diagnose: mechanic, content, juice, and progression all half-done. A prompt with a small, closed target, a fixed contract, a written spec, and testable acceptance lands far more often.

## Decision

Games are built in ordered layers (mechanic, content, juice, progression, art, audio, modes), each with its own prompt template in `prompts/`. Each layer's output is a rewrite of the single file `games/<slug>/src/game.js`. The PRD is the spec, the skeleton README is the contract, and the layer prompt carries the acceptance list. Layers 1 to 3 constitute a v0.1; later layers wait for the delight test.

## Consequences

- Failures are contained to a layer and a file. Re-running a layer is cheap.
- `game.js` can get long. That is accepted; it is one file to read, one file to replace, and no import graph for the builder to keep straight. If a game outgrows this, split by ADR for that game.
- Builder sessions must not add files, DOM, or dependencies. The engine is extended in `skeleton/` by ADR instead.
- Every tunable number is in `TUNING` so the playtest feedback loop is number edits, not prompts.

## Alternatives considered

- One prompt for the whole game: fails in compound ways; the reason this ADR exists.
- Multiple files per game (scenes, entities, levels): cleaner for humans, worse for one-shots, which have to keep the graph consistent on the first try.
