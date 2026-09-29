# ADR-0015: Generated image assets carry one style anchor per game and a cost ledger

- **Date:** 2026-09-29
- **Status:** accepted
- **Scope:** all games, art layers

## Context

The designer is providing an image-generation API key with a spending cap, so games can have real logos, sprites and backgrounds instead of only procedural shapes. Generated images drift in style from prompt to prompt unless something holds them together. Assets also cost money and disk, and offline install limits how much a game folder can carry.

## Decision

- **One style anchor per game.** `docs/games/<slug>/style.md` holds a single style sentence (palette, medium, line quality, mood, what to avoid). Every image prompt for that game is the anchor verbatim, then the subject, then the technical spec (transparent background, size). Nothing else. Changing the anchor means regenerating every asset of that game.
- **A ledger.** `docs/assets-ledger.md` records every generation: date, game, subject, size and quality, cost, kept or discarded, and the file path if kept. Generation stops when the ledger total reaches the designer's budget, whatever the provider's cap says.
- **Technical rules.** Sprites are transparent PNG or WebP, backgrounds are opaque; a game folder's assets stay under 1.5 MB in total; every kept asset is listed in that game's `sw.js` cache list; the source prompt is kept in the ledger so an asset can be regenerated.
- **Quality gate.** An asset is kept only if it reads at phone size in a screenshot of the game; the art layer's reviewer checks that, not the generating step.
- **Keys** are never written to the repo or to any file; they live in the environment's settings as `OPENAI_API_KEY`, and a key that has appeared in a chat is rotated.

## Consequences

- Cohesion comes from the anchor, not from luck; a new asset a month later still matches.
- Cost is visible and bounded in the repo, not only on a billing page.
- Procedural drawing stays the default; generated assets are used where shapes cannot do the job (a logo, a gun silhouette, a texture, a background).

## Alternatives considered

- Free-form prompts per asset: what produces a mixed set. Rejected.
- Reference images instead of a style sentence: useful later once one asset is chosen as the reference; the anchor still applies.
