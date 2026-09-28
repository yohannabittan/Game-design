# ADR-0008: Randomness only in setup, never in resolution; all randomness is seeded

- **Date:** 2026-09-28
- **Status:** accepted
- **Scope:** all games

## Context

Design principle 5: the games must be obviously skill-based and never feel random in how skill maps to reward. Design principle 6: they must not feel repetitive, which needs variety. These pull against each other unless randomness is confined.

## Decision

Randomness may decide what the player faces (layouts, orders, offers, announced modifiers). It may never decide whether a correct input succeeds (no damage rolls on clean hits, no scattered perfect shots). All randomness goes through the engine's seeded RNG (`makeRng`) so runs are reproducible and a daily seed is free. `Math.random` is reserved for cosmetic effects (particles, shake).

## Consequences

- Every PRD has a randomness policy section listing what is random and what is deterministic.
- Builder sessions must use `makeRng(seed)` for anything that affects play. The smoke test does not enforce this; code review does.
- Pools that matter get pity rules so no run is unwinnable by draw.
- Daily seed and shareable seeds are available to every game at no extra cost.

## Alternatives considered

- Unconstrained randomness with tuning to make it feel fair: this is what makes games feel unfair. Rejected.
- No randomness, all authored: repetitive, and content-bound. Rejected as a global rule; fine for a specific game's v0.1.
