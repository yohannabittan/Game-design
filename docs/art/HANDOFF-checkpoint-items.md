# Handoff: Checkpoint item images are final but not in the game (2026-10-04)

For the orchestrator session. From the art session.

## Status

The 56 X-ray item pictures (BRIEF.md Pack 3) have been final since 2026-10-03 in `docs/art/final/checkpoint/`. The game does not use them: `games/checkpoint` has no `assets` folder and draws every item procedurally. PRD v0.2 K says "build after the art pack lands"; it has landed, so the wiring build is ready to dispatch. I never wrote a handoff for this pack (it predates the handoff protocol), so nothing told you it was ready. This note is that.

## The files

- `item-<name>.png`, name with hyphens, 56 files: 15 belt contraband, 31 belt harmless, 10 body-scan items.
- **Belt items (46): 256 x 256. Body-scan items (10): 128 x 128** (hair-clip, glasses, earrings, wristwatch, ring, underwire, belt-buckle, zipper, coins, knee-brace). Transparent, drawn top-down in the v0.2 anchor: translucent fills by material (organic orange, plastic green, metal blue, dense near-black) with darker edges and the internal parts showing through.
- Body contraband reuses belt images (gun, knife, taser, brass-knuckles, lighter); the blade in a boot reuses box-cutter (brief).
- **Size on disk:** 2.72 MB as PNG, over the 1.5 MB cap. Measured as WebP with alpha for all 56: 0.56 MB at quality 75, 0.67 MB at quality 85. Convert at wiring; it fits with room to spare.

## What to know before wiring

- **Every image is trimmed to its opaque box and fitted to the square**, so each item touches the square on its long side. The pixel size says nothing about real size: a banana and a laptop are both 256 px on the long side. Per-item on-screen size (the brief says about 40 to 90 px) is data for the build or the PRD.
- **The hitbox comes from alpha, not the square.** Use the bounding box of pixels above alpha 40 (that is how they were trimmed).
- **Multiply compositing is untested.** The images are flat translucent fills meant for the pale screen `#eef1ee`; I have not seen them multiplied in the game. Check that overlaps darken and dense parts hide what is under them, and that each contraband still reads at 64 px.
- **Tells.** The brief asks each contraband image to declare a tell box. The tell each image was drawn to show (the box coordinates are yours to author by looking):

| Item | Tell |
| --- | --- |
| knife | the long blade and its point |
| scissors | the two finger rings |
| gun | grip, trigger guard and barrel |
| lighter | the hood and flint wheel |
| large-liquid | the big filled bottle |
| batteries | the row of dense cylinders |
| fireworks | tubes on sticks, with fuses |
| taser | the two prongs |
| hammer | the heavy claw head |
| box-cutter | the segmented blade |
| explosives | a bundle of sticks with a fuse and a clock (cartoon dynamite) |
| brass-knuckles | the four finger holes |
| toy-gun | a gun shape, all plastic green, no metal |
| snow-globe | the full sphere of liquid on a base |
| multi-tool | the pliers |

- **Picks.** The designer said the options were equivalent and asked me to choose. I took option A except knife, gun, explosives, tablet and hair-clip (B), by clearest silhouette at 64 px. Explosives is the cartoon dynamite because the provider's safety filter refused a putty-block-with-detonator wording.
- The procedural shapes stay as the fallback, as PRD K says. The home-screen icon is a separate item: see `HANDOFF-home-screen-icons.md`.

Prompts and cost: `docs/assets-ledger.md` (Checkpoint $6.55 in total, including the discarded options).

Line for the designer to paste: "Checkpoint's item pictures are final in docs/art/final/checkpoint; read docs/art/HANDOFF-checkpoint-items.md and build PRD v0.2 K."
