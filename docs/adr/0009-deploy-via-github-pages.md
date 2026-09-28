# ADR-0009: Deploy by pushing to main; GitHub Pages serves the repo root

- **Date:** 2026-09-28
- **Status:** accepted
- **Scope:** all games

## Context

No build step (ADR-0002), self-contained game folders (ADR-0006), and a need for an HTTPS origin so service workers and home-screen install work (ADR-0003). Cost and ceremony should be near zero.

## Decision

GitHub Pages serves the `main` branch from the repository root. `index.html` at the root is the library launcher, reading `games/index.json`. Each game lives at `games/<slug>/`. A `.nojekyll` file disables Jekyll processing. Pushing to `main` is the deploy; `npm run smoke` must pass first.

## Consequences

- HTTPS for free, custom domain possible later, no CI needed.
- Everything on `main` is live. Work on branches; merge when the smoke test passes and the game has been played once.
- All games share one origin, so localStorage is shared; the `game:<slug>` namespace handles this.
- The repository must stay public, or Pages must be enabled on a plan that serves private repos.

## Alternatives considered

- Netlify or Vercel: also free and fine, but one more account and no benefit at this size.
- A `gh-pages` branch or `docs/` folder: extra steps for no gain since there is no build output to separate.
