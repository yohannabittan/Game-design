# Handoff: Arena kit, the muscle tiers and the beasts' build (art, 2026-10-19)

For the orchestrator. Files are in `docs/art/candidates/arena/`, listed in `candidates.json` (packs 15, 17, 18, 19). Nothing is in `docs/art/final/arena/` yet: the designer has not picked the backdrops, faces or gear.

## Decided (the designer)

- "The more muscly is good." The more muscular body is now the default (`-A`) for the five body parts (`kit-base-torso`, `-upperarm`, `-forearm`, `-thigh`, `-shin`). The first muscular version is kept as `-B`.
- The lion and bear body, upper leg and lower leg are the more muscular version as `-A`; the first version is `-B`.
- The lean tier was too thin: the new lean (`kit-base-<part>-lean-A`) is a slim athletic build derived from the average part. The first, very lean one is `-B`.
- Alt convention (2026-10-14): `-A` is the default, `-B` the alternative, so the game can offer both.

## What changed for wiring

- **Two muscular parts are on a wider canvas:** the torso is 488 x 512 (was 384 x 512) and the shin is 272 x 384 (was 192 x 384). The other three keep their canvases (the muscle is wider inside them). The pilot, wired to the first muscular files, will show a stretched torso and shin if it draws these into the old rectangles: draw each image at its own size, **pinned by the top joint axis** (the x column below), not centred in the old rectangle.
- Lean, average and the first muscular (`-B`) keep the old canvases and share one joint axis column per part, within 1 px, so tiers swap in place when pinned by that column.
- The parts are cut-outs on transparent PNG. `kit-base-forearm` has a real hole in the fist; the hole is small.

## Joint points in pixels (measured from the alpha, so treat the y values as estimates)

The top axis x is reliable. Pivot y is the top end's tip plus half its width. The first muscular `-B` parts have the old canvases and axes (torso 188, 52; shin 58, 42; the rest as the average row).

| Part | Tier | Canvas | Width | Top pivot x, y | Other points |
| --- | --- | --- | --- | --- | --- |
| torso | lean | 384 x 512 | 354 | 188, 52 | hips centre 181,512 |
| torso | avg | 384 x 512 | 351 | 186, 46 | hips centre 194,512 |
| torso | muscular | 488 x 512 | 470 | 240, 57 | hips centre 220,512 |
| upperarm | lean | 160 x 320 | 107 | 82, 34 | bottom 48,296 |
| upperarm | avg | 160 x 320 | 100 | 80, 37 | bottom 74,296 |
| upperarm | muscular | 160 x 320 | 120 | 80, 21 | bottom 49,295 |
| forearm | lean | 160 x 320 | 94 | 86, 29 | - |
| forearm | avg | 160 x 320 | 94 | 86, 33 | - |
| forearm | muscular | 160 x 320 | 120 | 86, 39 | grip hole 67,298 |
| thigh | lean | 192 x 352 | 130 | 100, 58 | bottom 96,334 |
| thigh | avg | 192 x 352 | 139 | 100, 60 | bottom 98,329 |
| thigh | muscular | 192 x 352 | 132 | 100, 56 | bottom 92,327 |
| shin | lean | 192 x 384 | 185 | 60, 37 | - |
| shin | avg | 192 x 384 | 187 | 58, 42 | - |
| shin | muscular | 272 x 384 | 186 | 98, 40 | - |

Notes: the upper arm's and thigh's bottom pivot x is the limb's centre at the elbow or knee and moves with the pose of the art, so pin the child part's top pivot to it and let the rig overlap; the torso has no shoulder points measured (its shoulder caps are round stubs on each side at about a quarter of the height, left and right of the bbox).

## Flaws

- The more muscular thigh is lumpy; the more muscular upper arm has a small knob at its top.
- The milder lean's upper arm and forearm have small knobs at the joint ends.
- The bear body is dark and has no visible leg stubs; the lion body is a solid trunk with a short neck stub.
- The first helmet (`kit-helmet-gallic`) has faint ghost lines under the brim.

## Budget

Pack 18 $1.66, Pack 19 $1.65, the muscle redo $2.00 (ledger total $42.98; the account is about $47.80 of $80 with the wedding mock-ups). The provider cap is $50: the designer must raise it before more art.

## For the designer to paste

"The Arena kit is in docs/art/candidates/arena (HANDOFF-arena-kit-muscle.md): the more muscular body parts are the default, the lean tier is milder, the lion and bear are more muscular. Pin each part by its top joint axis, because the torso and shin canvases are wider."
