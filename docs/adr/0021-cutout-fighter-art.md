# ADR-0021: Painted cut-out art on a hit-tested rig (Arena pilot)

- **Date:** 2026-10-15
- **Status:** proposed (a pilot; accepted or dropped after the designer sees it in game)
- **Scope:** Arena; `docs/art/BRIEF.md`; amends ADR-0015's rule "images are never for things you play with" for this case only

## Context

The designer: "The arenas should have art instead of stick men."

ADR-0015 keeps everything hit-tested procedural, because the drawn shape is the hitbox (design principle 14). Arena's fighters are hit-tested, through their gaps, plates and parts, and drawn by a procedural rig.

## Decision

- **A painted cut-out kit pinned to the rig.** Each body part's image is painted to fit that part's rectangle in the rig, with the pivot at the joint end, and drawn where the procedural part was.
- **The hit geometry does not change.** The gaps (joint slots), the plates, the guards and the tells are still drawn by the game, on top of the paint and in the same places, so what you see is still what the hit test uses.
- **A pilot first.** One kit (the player's base body plus one helmet and one shield) and the four arena backdrops are wired behind a dev-only switch. The procedural look stays the fallback and the release default until the designer accepts the pilot.
- **Image sizes:** each part at about 3x its largest on-screen size, in transparent WebP, with the folder kept under its budget.

## Consequences

- If the pilot reads well and stays fair, more kits follow: each gladiator type's body, the beasts, and the gear pieces, which become the painted gear pack.
- If parts don't line up at the joints or hide the tells, the pilot is dropped and the fighters stay procedural, with the backdrops and portraits as the art.
