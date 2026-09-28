# ADR-0003: Deliver as an offline-first web app installed to the home screen

- **Date:** 2026-09-28
- **Status:** accepted
- **Scope:** all games

## Context

The end goal includes playing on a plane with no network. App Store distribution is wanted eventually, but only once games are proven fun enough to share widely. Until then, the cost of native packaging and store review is not justified per iteration.

## Decision

Each game is a Progressive Web App: a web manifest, a service worker that caches every file cache-first, and the iOS and Android home-screen meta tags. Installing means "Add to Home Screen". Updates are picked up by bumping `CACHE_VERSION` in `sw.js`.

## Consequences

- Zero-cost deploys and installs. Playable offline after one online launch.
- Each game folder must be self-contained (its own `sw.js`, manifest, icons), so service worker scope stays per game and one game's update cannot break another.
- iOS restrictions apply: Safari only for install, no push, storage can be evicted if the app is unused for weeks. Acceptable for now; saves are small and local.
- Native packaging later can wrap the same folder (Capacitor or similar) without changing the game. That is a future ADR.

## Alternatives considered

- Native apps now: slow iteration, store review per build, and premature.
- A single app shell hosting all games: one service worker for everything makes per-game updates riskier and installs a launcher rather than a game. Rejected; a library page links to each game instead.
