# ADR-0013: Orientation is a per-game PRD decision; portrait is the default

- **Date:** 2026-09-28
- **Status:** accepted; amends ADR-0004
- **Scope:** all games, skeleton

## Context

ADR-0004 fixed every game to portrait and one thumb. Recoil, as the designer describes it, is a shooting range: the gun on one side, targets coming from the other, one thumb moving the gun and the other firing. That is landscape held like a controller, and forcing it into portrait would put the targets on top of the gun. The engine never depended on orientation; only the manifest and the design space did.

## Decision

Each game's PRD states its orientation and its thumb count in the controls section. Portrait and one thumb remain the default and the burden of proof is on the PRD to justify landscape or two thumbs. A landscape game locks landscape in its manifest, uses a 640 by 360 design space, and keeps its HUD inside the left and right safe-area insets as well as top and bottom. The engine exposes all four insets.

## Consequences

- Recoil ships landscape with two thumbs. Gravity Golf and Ink stay portrait.
- The skeleton's manifest still says portrait; `tools/new-game.sh` output is edited by hand for a landscape game.
- The smoke test's phone viewport is portrait; a landscape game is still exercised (the engine resizes), but a landscape-specific check is a later tool change.
- Reviewers check that a landscape game's controls do not require reaching across the screen.

## Alternatives considered

- Keep everything portrait: Recoil would be a worse game for a rule that existed to prevent lazy ports, not to prevent good landscape designs.
- Support both orientations per game: doubles layout work; rejected as in ADR-0004.
