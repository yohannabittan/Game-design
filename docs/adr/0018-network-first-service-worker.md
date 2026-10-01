# ADR-0018: Service workers are network first, and games check for updates when they come back to the front

- **Date:** 2026-10-01
- **Status:** accepted (amends ADR-0017 and the skeleton's original cache-first worker)
- **Scope:** skeleton (sw.js, index.html), every game, the release channel

## Context

The designer opened the dev links after a release and still saw 15 Gravity Golf holes and the old Launch, with no update prompt, although every Pages deploy had succeeded. The workers were cache first: every load came from the stored copy, a new build was only fetched by the background worker update, and the one-off "Update ready" toast showed only if that update happened while the page was open. A home-screen app resumed from the background never navigates, so it never even checked. The more often the library ships, the worse this gets.

## Decision

1. Fetches inside a game's scope are **network first**: a same-origin GET goes to the network with `cache: 'no-cache'` (a cheap revalidation); a good response is served and written to the game's cache. If the network fails or takes longer than `NET_TIMEOUT` (3 s) the cache answers (a navigation falls back to `index.html`); a slow response still refreshes the cache for next time.
2. Install fills the cache with `cache: 'reload'` requests, so a new version never stores files from the browser's HTTP cache.
3. Each game's page calls `registration.update()` whenever it becomes visible again, so a suspended home-screen app notices a new worker on resume (the existing "Update ready. Tap to reload." toast then shows).
4. ADR-0017's scoping stands: a worker only deletes caches with its own prefix.

## Consequences

- Online players see a new build on the next open, even when a deploy forgets to bump `CACHE_VERSION` (bumping is still the rule: it refreshes the offline copy at install).
- Offline play is unchanged; on a bad connection a launch waits up to 3 s before the stored copy answers.
- Phones still running the old cache-first worker pick this one up on their next update check, then load fresh from the open after that: a manual reload or a full close and reopen gets them there at once.
- Proven in Chromium: an unbumped deploy shows on the next open; Ink and Gravity Golf both open offline afterwards with their caches side by side.
