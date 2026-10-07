# ADR-0019: The menu's TUNE and EXPORT tabs share one size and one top line

- **Date:** 2026-10-07
- **Status:** accepted (amends the tab geometry from ADR-0013 and ADR-0016)
- **Scope:** `skeleton/src/engine.js`, then each game when it is next worked on (ADR-0006)

## Context

The designer saw this on Gravity Golf's menu: "another button looks awkward because it's up". The engine draws two different tabs:
- EXPORT, top left: 72 x 44, at `safe.top + 4`;
- TUNE, top right: 64 x 32, at `safe.top + 10`.

So they sit on different lines. TUNE is also under the 44 px target rule (ADR-0004).

## Decision

Both tabs are 72 x 44 and sit at `safe.top + 4`, mirrored at 10 px from each side's safe edge, with the same text size. Hit-testing reads the same rectangles, so nothing else changes.

## Consequences

- Games pick this up when their engine is next copied from the skeleton. Gravity Golf takes it now, with v0.12.
- Any game whose own title art was placed against the old 32 px TUNE tab should be checked once in a menu screenshot.
