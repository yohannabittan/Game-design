# ADR-0005: Local-only persistence in localStorage with versioned migrations

- **Date:** 2026-09-28
- **Status:** accepted
- **Scope:** all games

## Context

Games need best scores, unlocks, and sometimes a resumable run. No accounts, no sync, no network are wanted. Saves must survive game updates.

## Decision

Each game stores one JSON object in `localStorage` under `game:<slug>`, wrapped with a version number. `game.js` declares `saveVersion` and a `migrate(data, fromVersion)` function. The engine's `Save` class is the only thing that touches storage. Save is automatic (on every set, and on app background).

## Consequences

- Trivially offline. No backend, ever, for this phase.
- A save shape change requires bumping `saveVersion` and handling the old shape in `migrate`. Builder sessions must not change the shape silently.
- Storage is per origin, so all games on the Pages domain share a quota; keep saves small (kilobytes).
- Cross-device sync, cloud backup, and leaderboards are explicitly out of scope until an ADR supersedes this.

## Alternatives considered

- IndexedDB: more capacity and async, unnecessary for kilobyte saves and more surface for the builder to get wrong.
- A backend: contradicts offline-only and adds accounts.
