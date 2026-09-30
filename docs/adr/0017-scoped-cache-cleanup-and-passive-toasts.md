# ADR-0017: Service workers clean up only their own game's channel, and a toast without an action lets touches through

- **Date:** 2026-09-30
- **Status:** accepted
- **Scope:** skeleton (sw.js, engine.js), every game, tools/release.sh

## Context

All games share one origin (the Pages site). Each game's service worker deleted every cache that was not its own on activation, so opening a second game wiped the first game's offline copy; with the network off the first game then failed to open. The Gravity Golf v17 gate reproduced it for Ink and Gravity Golf and it was already true of release v1.1. Separately, the engine's toast element took pointer events whenever it showed, so a 2.5 s informational toast at the bottom centre swallowed the start of a drag or tap.

## Decision

1. Each `sw.js` declares `CACHE_PREFIX` beside `CACHE_VERSION`: `<slug>-v` in the dev channel, `<slug>-release-` in the release channel (rewritten by `tools/release.sh`). On activation a worker deletes only caches that start with its own prefix and are not its current version. Other games and the other channel are never touched.
2. `E.toast(msg, onTap)` sets the toast's pointer events to `auto` only when an action callback is given; informational toasts pass touches through to the canvas.

## Consequences

- Every game's cache is bumped in the same commit so phones pick up the new worker; the release is rebuilt so its copies carry the fix.
- Old caches from other games that an earlier worker created under a different scheme are left alone; they are harmless and small.
- `tools/new-game.sh` inherits both through the skeleton.
