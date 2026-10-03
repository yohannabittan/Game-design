# Handoff: showpiece art gets a richer treatment (designer decision, 2026-10-03)

For the orchestrator session. From the art session.

## Decision

Assets that are purely visual and seen large (titles, home-screen icons, badge medals, rank emblems) are generated with a richer prompt than play objects: that is where the generator earns its keep. Play objects (guns in the rack, Launch's characters inside the procedural world, Checkpoint's X-ray items) stay flat and matched to the procedural drawing.

ADR-0015 keeps one anchor per game. The richness comes from one extra sentence after the anchor, the way sector sentences work for Gravity Golf, so the anchor itself does not change and nothing else needs regenerating.

## Sentences to add to each `docs/games/<slug>/style.md`, after the anchor

- **gravity-golf:** "Showpiece art (title, icon, medals, ranks) is the richest art in the game: layered painterly textures, fine surface detail, glow, embers and particles, dramatic lighting, with the same crisp chunky silhouette."
- **recoil:** "Showpiece art (title, icon) is the richest art in the game: real chrome and brushed metal, neon tube glow and haze, film grain, scuffs and studio wear, dramatic backlot lighting, with the same thick dark outlines and readable silhouette."
- **ink:** "Showpiece art (title, icon) is the richest art in the game: dense hand-inked shading and stipple, layered flourishes, ink texture and worn paper grain, with the same bold even outlines and flat palette."

Launch and Checkpoint get no showpiece sentence for now: their icons stay flat by their anchors.

## What was regenerated this way

`title-backlot88`, `title-ink`, `title-gravity-golf`, `icon-gravity-golf`, `icon-recoil`, and the eleven Gravity Golf `medal-<id>` files. Picked 2026-10-03: every one of the sixteen moved to its rich version under the same file name in `docs/art/final/<slug>/`, so wiring is unchanged. **One change for Recoil:** `title-backlot88.png` now carries only the RECOIL lettering, searchlights and sunburst; the generator misspelled the small tagline, so it was erased, and the game draws "a Backlot 88 production" in canvas text under the image (PRD v0.6 A already describes the card that way). The Gravity Golf ranks (`HANDOFF-gravity-golf-ranks.md`) were already made this way.
