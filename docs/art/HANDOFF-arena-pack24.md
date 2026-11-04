# Handoff: Arena muscular arm and leg cut in two (Pack 24, art, 2026-11-04)

For the orchestrator. Files are in `docs/art/candidates/arena/`, listed in `candidates.json` (pack 24). Contact sheet: `sheet-limbs-musc.png`: today's muscular arm and leg (`kit-base-upperarm-seg` + `kit-base-forearm`, `kit-base-thigh-seg` + `kit-base-shin`) beside options A and B, each joined straight and bent 90 degrees. Nothing is in `docs/art/final/arena/` yet: the designer picks first.

## Method

Same as Pack 21 (`HANDOFF-arena-limbs.md`): one whole arm and one whole leg per option, painted once from `kit-base-torso-A.png` as the reference, then cut in code at the narrowest row near half way. The prompt asked for the biceps only above the elbow, the calf only below the knee, and a forearm that tapers to the wrist with no second bulge. The two halves of an option are one painting, so **pick `up` and `lo` of a limb with the same letter**.

Differences from Pack 21: both halves of a limb are scaled by the **same** factor (about 0.35 to 0.38 of the source), so the width at the cut is equal on both sides, and the factor is the largest that keeps each half inside its canvas. The limb is therefore a little shorter than Pack 21's nominal 528 (arm) and 624 (leg) px. The overlap is as before: 24 px past the cut on each half, masked as a flattened half-disc as wide as the limb at the cut.

## The designer's test

"Does this look like one piece of an arm, or like two pieces?" All four joined limbs, straight and bent, read as one piece on the sheet: one outline, one tone through the joint, one bulge above the elbow or below the knee. Small flaws, in bent view only: a lighter patch at the inside of the elbow or knee where the lower half's rounded end shows (arm A and leg A most), because the shading is painted for a straight limb. Nothing I would redo.

## Joints in pixels, per file

x, y in the file's own pixels. "Top joint" is the centre of the shoulder or hip cap, measured about 40 px below the top of the shape; "pivot" is the elbow or knee (y = 264 or 296 on an upper half, y = 24 on a lower half); "bottom joint" is the wrist or ankle, estimated at the narrowest row in the lower half (treat y as an estimate, x as reliable). Width is the limb's width across the middle of the part's shape.

| File | Canvas | Top joint (shoulder or hip) | Elbow or knee pivot | Bottom joint (wrist or ankle) | Width at middle |
| --- | --- | --- | --- | --- | --- |
| `kit-arm-up-musc-A.png` | 160 x 288 | 61.5, 87 | 79.5, 264 | - | 117 |
| `kit-arm-lo-musc-A.png` | 160 x 288 | - | 80.0, 24 | 70.5, 154 | 76 |
| `kit-arm-up-musc-B.png` | 160 x 288 | 94.5, 108 | 79.5, 264 | - | 103 |
| `kit-arm-lo-musc-B.png` | 160 x 288 | - | 79.5, 24 | 86.5, 145 | 61 |
| `kit-leg-up-musc-A.png` | 192 x 320 | 80.5, 99 | 95.0, 296 | - | 95 |
| `kit-leg-lo-musc-A.png` | 192 x 352 | - | 95.0, 24 | 90.0, 170 | 51 |
| `kit-leg-up-musc-B.png` | 192 x 320 | 60.0, 134 | 95.5, 296 | - | 99 |
| `kit-leg-lo-musc-B.png` | 192 x 352 | - | 96.0, 24 | 91.0, 156 | 50 |

## Wiring notes

- The muscular tier today uses `kit-base-upperarm-seg` and `kit-base-forearm` (arm) and `kit-base-thigh-seg` and `kit-base-shin` (leg). These new files replace those four, so the muscular tier joins the lean and average tiers' `kit-arm-up/lo`, `kit-leg-up/lo` path with a `-musc` suffix.
- The leg halves keep the kilt's edge and strap band at the top, as the Pack 21 legs do. The feet point right.
- Colour: the skin is the same warm orange as the muscular torso; the leather wristband is darker brown in arm A than in arm B.

## Cost

4 images, about $0.32 (ledger estimate); ledger total $52.69. No refusals, no redo.

## For the designer to paste

"The Arena Pack 24 art is in docs/art/candidates/arena (HANDOFF-arena-pack24.md): the muscular arm and leg, each painted whole and cut at the elbow or knee, in two options. Pick the upper and lower half with the same letter. Sheet: sheet-limbs-musc.png."
