# Handoff: Arena whole limbs cut in two, and legless beast bodies (Pack 21, art, 2026-10-24)

For the orchestrator, wiring step 6d. Files are in `docs/art/candidates/arena/`, listed in `candidates.json` (packs 15 to 21). Contact sheet: `sheet-limbs-whole.png` (every limb pair straight and bent at 90 degrees, then the eight torsos). Nothing is in `docs/art/final/arena/` yet: the designer picks first.

## How the limbs were made

Each limb is **one painting, cut in two in code** at its narrowest point near half way, so both halves always match:
- the painting was resized to a fixed whole-limb height (arm 528 px, leg 624, beast leg 528) and the joint moved to a fixed row (arm 264, leg 296, beast leg 264);
- the upper half keeps 24 px past the cut and the lower half 24 px above it, each masked as a flattened half-disc (an ellipse as wide as the limb at the cut), so the two overlap at the joint and a bent elbow or knee shows no gap;
- every file is on the canvas size the brief gave (arm halves 160 x 288, leg up 192 x 320, leg lo 192 x 352, beast leg halves 160 x 288, torsos 640 x 384).

**Pick halves as a pair.** `-A` and `-B` are two different paintings: an A upper half with a B lower half will mismatch. Pick `up` and `lo` of one limb with the same letter, and keep fore and hind legs and the young and grown sets in step with the torso if the designer prefers one letter.

## Joints in pixels, per file

Coordinates are x, y in the file's own pixels. "Top joint" is the shoulder or hip (centre of the top end), measured; "elbow or knee" is the pivot, where the halves overlap (y = 264 or 296 on an upper half, y = 24 on a lower half); "bottom joint" is the wrist or ankle, estimated at the narrowest row in the lower part of a lower half (the paw for a beast has no true ankle). Treat y values as estimates, x as reliable. Width is the limb's width across at the middle row.

| File | Canvas | Top joint (shoulder or hip) | Elbow or knee pivot | Bottom joint (wrist or ankle) | Width at middle |
| --- | --- | --- | --- | --- | --- |
| `kit-arm-lo-avg-A.png` | 160 x 288 | - | 79.5, 24 | 82.4, 203 | 76 |
| `kit-arm-lo-avg-B.png` | 160 x 288 | - | 80.0, 24 | 91.1, 187 | 77 |
| `kit-arm-lo-lean-A.png` | 160 x 288 | - | 81.5, 24 | 66.4, 190 | 65 |
| `kit-arm-lo-lean-B.png` | 160 x 288 | - | 80.0, 24 | 87.4, 207 | 63 |
| `kit-arm-up-avg-A.png` | 160 x 288 | 95.2, 44 | 79.5, 264 | - | 102 |
| `kit-arm-up-avg-B.png` | 160 x 288 | 87.8, 42 | 80.0, 264 | - | 116 |
| `kit-arm-up-lean-A.png` | 160 x 288 | 69.6, 40 | 79.5, 264 | - | 103 |
| `kit-arm-up-lean-B.png` | 160 x 288 | 91.4, 40 | 80.0, 264 | - | 101 |
| `kit-leg-lo-avg-A.png` | 192 x 352 | - | 87.6, 24 | 72.0, 234 | 72 |
| `kit-leg-lo-avg-B.png` | 192 x 352 | - | 76.9, 24 | 64.5, 227 | 70 |
| `kit-leg-lo-lean-A.png` | 192 x 352 | - | 96.1, 24 | 111.3, 220 | 49 |
| `kit-leg-lo-lean-B.png` | 192 x 352 | - | 95.9, 24 | 116.1, 220 | 60 |
| `kit-leg-up-avg-A.png` | 192 x 320 | 85.6, 69 | 95.6, 296 | - | 124 |
| `kit-leg-up-avg-B.png` | 192 x 320 | 113.1, 70 | 95.9, 296 | - | 120 |
| `kit-leg-up-lean-A.png` | 192 x 320 | 104.1, 57 | 96.1, 296 | - | 96 |
| `kit-leg-up-lean-B.png` | 192 x 320 | 78.5, 64 | 95.9, 296 | - | 134 |
| `beast-bear-fore-lo-A.png` | 160 x 288 | - | 81.1, 24 | 58.5, 178 | 68 |
| `beast-bear-fore-lo-B.png` | 160 x 288 | - | 76.8, 24 | 124.0, 258 | 71 |
| `beast-bear-fore-lo-young-A.png` | 160 x 288 | - | 101.6, 24 | 81.8, 179 | 85 |
| `beast-bear-fore-lo-young-B.png` | 160 x 288 | - | 97.7, 24 | 65.8, 178 | 65 |
| `beast-bear-fore-up-A.png` | 160 x 288 | 90.6, 55 | 80.1, 264 | - | 96 |
| `beast-bear-fore-up-B.png` | 160 x 288 | 67.9, 53 | 79.8, 264 | - | 99 |
| `beast-bear-fore-up-young-A.png` | 160 x 288 | 69.1, 41 | 79.6, 264 | - | 120 |
| `beast-bear-fore-up-young-B.png` | 160 x 288 | 70.9, 43 | 79.7, 264 | - | 107 |
| `beast-bear-hind-lo-A.png` | 160 x 288 | - | 80.1, 24 | 58.4, 178 | 57 |
| `beast-bear-hind-lo-B.png` | 160 x 288 | - | 80.4, 24 | 75.2, 178 | 66 |
| `beast-bear-hind-lo-young-A.png` | 160 x 288 | - | 80.4, 24 | 85.7, 178 | 51 |
| `beast-bear-hind-lo-young-B.png` | 160 x 288 | - | 100.4, 24 | 93.6, 178 | 47 |
| `beast-bear-hind-up-A.png` | 160 x 288 | 83.4, 54 | 88.1, 264 | - | 147 |
| `beast-bear-hind-up-B.png` | 160 x 288 | 83.9, 58 | 77.4, 264 | - | 123 |
| `beast-bear-hind-up-young-A.png` | 160 x 288 | 89.5, 50 | 77.4, 264 | - | 127 |
| `beast-bear-hind-up-young-B.png` | 160 x 288 | 87.1, 40 | 80.4, 264 | - | 110 |
| `beast-lion-fore-lo-A.png` | 160 x 288 | - | 94.3, 24 | 82.5, 178 | 73 |
| `beast-lion-fore-lo-B.png` | 160 x 288 | - | 62.1, 24 | 84.2, 178 | 72 |
| `beast-lion-fore-lo-young-A.png` | 160 x 288 | - | 95.6, 24 | 77.9, 178 | 68 |
| `beast-lion-fore-lo-young-B.png` | 160 x 288 | - | 89.9, 24 | 69.8, 178 | 60 |
| `beast-lion-fore-up-A.png` | 160 x 288 | 65.2, 51 | 80.3, 264 | - | 100 |
| `beast-lion-fore-up-B.png` | 160 x 288 | 77.6, 54 | 80.1, 264 | - | 99 |
| `beast-lion-fore-up-young-A.png` | 160 x 288 | 61.9, 56 | 86.6, 264 | - | 107 |
| `beast-lion-fore-up-young-B.png` | 160 x 288 | 85.9, 47 | 79.9, 264 | - | 86 |
| `beast-lion-hind-lo-A.png` | 160 x 288 | - | 84.4, 24 | 78.6, 190 | 71 |
| `beast-lion-hind-lo-B.png` | 160 x 288 | - | 79.8, 24 | 87.7, 178 | 64 |
| `beast-lion-hind-lo-young-A.png` | 160 x 288 | - | 84.2, 24 | 87.3, 178 | 55 |
| `beast-lion-hind-lo-young-B.png` | 160 x 288 | - | 80.4, 24 | 91.4, 178 | 55 |
| `beast-lion-hind-up-A.png` | 160 x 288 | 90.2, 59 | 80.4, 264 | - | 125 |
| `beast-lion-hind-up-B.png` | 160 x 288 | 91.3, 54 | 81.8, 264 | - | 130 |
| `beast-lion-hind-up-young-A.png` | 160 x 288 | 84.0, 56 | 80.2, 264 | - | 115 |
| `beast-lion-hind-up-young-B.png` | 160 x 288 | 79.6, 58 | 78.4, 264 | - | 129 |

## Torsos (legless, facing left, head off)

Near-leg tops are estimates: the shoulder at 26 percent and the hip at 78 percent of the body's width from its left (head) end, 30 percent up from the belly line. Lion torsos keep a short round tail stub at the right; bear torsos have no tail. The belly line is one smooth edge with no leg, stub or paw below it.

| File | Near-leg tops | Body box |
| --- | --- | --- |
| `beast-bear-torso-A.png` | shoulder 166, 249, hip 499, 265 | 0, 0 to 640, 384 |
| `beast-bear-torso-B.png` | shoulder 166, 238, hip 499, 272 | 0, 0 to 640, 384 |
| `beast-bear-torso-young-A.png` | shoulder 166, 242, hip 499, 286 | 0, 0 to 640, 384 |
| `beast-bear-torso-young-B.png` | shoulder 166, 250, hip 499, 282 | 0, 0 to 640, 384 |
| `beast-lion-torso-A.png` | shoulder 166, 261, hip 499, 247 | 0, 0 to 640, 384 |
| `beast-lion-torso-B.png` | shoulder 166, 264, hip 499, 241 | 0, 0 to 640, 384 |
| `beast-lion-torso-young-A.png` | shoulder 166, 259, hip 499, 211 | 0, 0 to 640, 384 |
| `beast-lion-torso-young-B.png` | shoulder 166, 257, hip 499, 217 | 0, 0 to 640, 384 |

## Flaws

- **Colour:** the beast fur drifts warm (the bear and the young animals are red-orange; the young bear is the delivered one); the fighters' arms and legs are a slightly more saturated orange than their lean and average torsos.
- **Paws point left,** the way the torsos face. The older `beast-*-lowerleg` pieces pointed right; do not mix them.
- **Young lion torso A** has a fringe of fur strands at its front end where the neck stub is; **the young bear torso A** has a small dark patch there.
- **The joint** is found automatically, not drawn: check the bent views on the sheet; if a pose needs the cut elsewhere, say so and I will move it.
- The grown lion torsos have no mane (the mane is on the head).

## Cost

Pack 21 cost $3.23 for 39 images (32 kept as candidates, 7 discarded in torso redos). Ledger total 49.82; the account is past the earlier $50 cap and still generating, so the cap has been raised.

## For the designer to paste

"The Arena Pack 21 art is in docs/art/candidates/arena (HANDOFF-arena-limbs.md): whole limbs cut in two (lean and average fighters, lion and bear legs) and legless beast torsos, each in two options. Pick the upper and lower half of a limb with the same letter."
