# Handoff: Arena Pack 29, a bow (art, 2026-11-14)

For the orchestrator. Three options of `weapon-bow` in `docs/art/candidates/arena/` (`-A`, `-B`, `-C`), listed in `candidates.json` with `weapon-bow-drawn` and `arrow`. Contact sheet: `sheet-pack29-bow.png` (the three options beside the gladius at game size, each also at 64 px; then the pick at rest, drawn, and with the arrow nocked). **Proposed pick: A**, copied to `docs/art/final/arena/` as `weapon-bow.png`, `weapon-bow-drawn.png` and `arrow.png`. The designer can still choose B or C; then the drawn pose and arrow must be redone from it (about $0.3).

## Why A

A has the heaviest dark outline of the three, the same orange leather-wrapped grip as the gladius and shield rim, and brass nocks. B has a thin outline and a thin brown string that vanishes at 64 px; C is pale horn with a very thin gold string and a thinner outline, the least like Pack 23's weapons.

## The files (image px, origin top left, y down; 1 kit head = 256 px)

| File | Size | Notes |
| --- | --- | --- |
| `weapon-bow` | 454 x 1024 | 4 heads tall. Strung, at rest, upright. The bow sits at the right; the left 295 px is empty so the drawn picture shares the canvas |
| `weapon-bow-drawn` | 454 x 1024 | **the same canvas**: limbs bent back to the left, string pulled to a V |
| `arrow` | 410 x 32 | 1.6 heads long, horizontal, iron head to the right, wooden shaft, three pale feathers on the left |

### On both bow canvases

- **Grip centre (where the hand closes): (397, 514).** The grip is the orange wrap, about y 432 to 597 and 43 px wide at the middle (x 375 to 418). Grip pixels are the same in both files: rows 432 to 597, x 330 to 453 are byte-identical, so it does not move when you swap pictures.
- The bow's belly bulges to the **right** and the string is on the **left**. Hold it with the string toward the archer. Rotate it as the game needs; the pin stays (397, 514).

### The string

| | Rest (`weapon-bow`) | Drawn (`weapon-bow-drawn`) |
| --- | --- | --- |
| Upper end (at the upper tip's nock) | (302, 38) | (173, 38) |
| Lower end (at the lower tip's nock) | (302, 987) | (175, 987) |
| Drawn point (where the nock and fingers go) | none (a straight line, x 296 to 307) | **(44, 514)**, the V's point; the string is about 12 px wide |

The drawn string runs straight from each end to (44, 514). The tips swing about 130 px left of where they were at rest.

### The arrow

- 410 x 32. **Tip (the point): (409, 14). Nock (the back end): (0, 12).** The shaft's centre line is about y 13.
- To show it on the string, put the arrow at (44, 501) on the drawn canvas so the nock lands on the drawn point (44, 514); the tip then reaches x 453, past the grip and the right edge of the canvas. The sheet shows this. The arrow is a separate picture because it leaves the bow when shot.

## How it was made (what differs from the brief)

- **Three options** came from one edit call with the round shield and the gladius as the style references (1024 x 1536, medium), trimmed and scaled to 1024 px high.
- **The drawn pose is not an inpainting result.** I tried the masked edit as Pack 26b did, with the grip masked as kept: the model ignored the mask, redrew the whole bow facing the other way and moved the grip (discarded, $0.16). So the drawn picture is made in code from the pick's own pixels: the old string is removed, each row of the limbs is shifted left by a smooth curve (nothing moves within the grip's 220 px), and a new string is drawn in the same pale colour with a tan edge. That keeps the grip, outline, wood and light exactly as in the pick, which is what the brief's "so all three match" wanted.
- **The arrow** was one edit with the pick as the style reference (1536 x 1024, medium, two options); the iron-headed option was kept, the other (a bronze-pink head, bolder outline) discarded. It is not painted on the bow's canvas.

## Flaws

- The bent limbs are a shear, not a repaint: the bend is smooth and the outline stays even, but the limb has no new foreshortening or tension shading.
- A small nick or two on the lower limb's left outline near the lower tip, left where the old string touched it (a few px; the drawn string covers most of it).
- The drawn string is a little thicker than "a thin pale line" (about 12 px, to match the rest string's 12 px).
- The dark wood is darker and the orange wrap more saturated than the gladius's wood.
- The arrow is thin (32 px high): at 64 px of bow height it is a hairline.

## Cost

3 + 2 + 2 images, about $0.57 (the options $0.25, the discarded masked try $0.16, the arrow pair $0.16). Ledger total now $60.70 of $80.

## For the designer to paste

"Arena Pack 29 is in docs/art/candidates/arena (HANDOFF-arena-pack29.md): a bow in three options, sheet-pack29-bow.png. I propose A; its rest and drawn pictures and the arrow are in docs/art/final/arena. The grip is at (397, 514) on both bow pictures."
