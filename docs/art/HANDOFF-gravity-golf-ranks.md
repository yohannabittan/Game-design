# Handoff: Gravity Golf overall progression ranks (designer decision, 2026-10-03)

For the orchestrator session. From the art session.

## Decision

Gravity Golf gets an **overall progression rank** on top of its badges. The eleven badge medals stay as they are: each represents its own challenge (First Orbit, Banker, Slingshot, and so on), and their art is final in `docs/art/final/gravity-golf/medal-<id>.png`.

The rank is separate: a ladder of space objects and events the player climbs by overall progress, in the spirit of Khan Academy's point levels. Each rank has its own illustration, a chunky cartoon celestial object with a face, drawn from the Gravity Golf style anchor. The designer chose the theme and the steps; the rule that advances the rank is yours to design.

## The ladder (proposed order, the designer trims and confirms)

asteroid, moon, planet, giant planet, brown dwarf, red dwarf, yellow star, blue star, red giant, blue giant, white dwarf, supernova, nebula, neutron star, quasar, black hole.

Sixteen steps are drawn; the PRD can use fewer. Names are the designer's; "yellow star" is the plain star, "red giant" is the giant star.

## Art

- Files: `docs/art/final/gravity-golf/rank-NN-<name>.png`, transparent PNG, 512 x 512, numbered in ladder order. They land there once the designer picks from the candidates (two options each are generated); until then they are not final.
- Images are for looking at: a rank-up card, the stats card, the menu. Nothing moving or hit-tested.
- The per-game `assets/` folder stays under 1.5 MB (ADR-0015). Sixteen ranks at 512 px are about 2 MB at the candidate size, so the wiring layer should bring them to 256 px or WebP. The medals are 256 px already.
- Every kept asset goes in `sw.js`'s cache list; bump `CACHE_VERSION`.

## What you do

1. PRD: add the rank to Gravity Golf (what drives it, where it shows, what a rank-up looks like), as a new PRD version, and lock it with the designer.
2. Wiring: the art layer (`prompts/05-art.md`) once the files are in `docs/art/final/gravity-golf/`.
3. The reviewer checks each rank reads at phone size.

Spend and prompts are in `docs/assets-ledger.md`.
