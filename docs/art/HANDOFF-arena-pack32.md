# Handoff: Pack 32, Arena rank emblems (all twenty, style B)

Status: **done.** Twenty emblems in the designer's pick, style B (the painted coin with relief).

Contact sheet (all twenty in order, each at 160 px and 56 px on `#0f1320`): `docs/art/candidates/arena-ranks/sheet.png`
Link: https://yohannabittan.github.io/Game-design/docs/art/candidates/arena-ranks/sheet.png (allow a minute after the push)
Finals: `docs/art/final/arena/rank-01.png` to `rank-20.png`, 512 x 512 transparent PNG, the coin filling the canvas, no text. The unpicked probe candidates (A, C and the first B) are deleted.

## How the rules were applied
- **Emblem stands out from the coin:** every prompt asks for a darker field, a thick dark edge line round the emblem, a lighter emblem. Worked well for 4 to 16 and 18 to 20.
- **The metal climbs:** iron with rope rim (1 to 3), bronze (4 to 9), deep bronze with a red enamel ring (10 to 14), silver (15 to 17), gold (18, 19), plain worn wood with a laurel (20).
- Emblems: 1 broken shackles, 2 meat on a hook, 3 rat on sand, 4 plain helmet, 5 wrapped fist with red stains, 6 studded knuckle guard, 7 crossed gladii, 8 thrown rose, 9 scarred crested helmet, 10 cleaver, 11 riveted bracer, 12 heart between palm branches, 13 helmet with a shadow copy, 14 sword through a laurel, 15 lion's head, 16 scorpion, 17 laurel and roses, 18 thumbs-up with purple cuff, 19 carved stone face with laurel, 20 rudis and laurel.

## Where it is weakest (designer's call, a redo costs $0.06 each)
- **1 Chained** is the dullest at 56 px: iron on iron. Two tries; lighter shackles on a dark field is the best. It reads as shackles at 160 px.
- **17 Darling of Rome** has an empty silver centre inside the wreath, with the roses at its foot; the wreath reads at 56 px, the roses are small. Two tries at a bold rose in the middle both came back with a stray number, so I kept the clean one.
- **14 Champion Slayer** reads as a sword in a laurel wreath more than a snapped crown.
- **5 Bloodied** and **6 Brawler** are bronze fists on bronze coins: legible, close in colour to each other and to 4.
- Bronze coins 4 to 9 are fairly alike in tone; the emblems tell them apart, not the metal.

## What I learned
- Putting "rank 17 of 20" in the prompt makes the model paint the number on the coin (17 twice). The kept 01 and 17 were made without that wording.
- A strong "much lighter than the field, thick black outline" sentence fixed 5 and 6 (bronze on bronze) and 3 (dark rat); it was not enough for iron on iron.

## For the wiring build
- Each file is about 470 KB (9.4 MB for the set). Convert to WebP at 160 px x3 density (about 192 to 256 px) before they go into `games/arena/assets/`, or the 1.5 MB assets limit is gone at once. The 56 px menu use can share the same file.

## Cost and files
- 27 images (20 kept, 7 discarded redos), medium, US$1.62. Ledger total US$64.26 of the US$80 budget. Ledger rows written. Nothing under `games/` touched.

## The brief
- Pack 32 text is accurate. Note for the brief: "rank N of 20" in a prompt can print the number on the image; word the metal tier instead.
