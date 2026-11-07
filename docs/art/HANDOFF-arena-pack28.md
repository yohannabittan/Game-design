# Handoff: Arena Pack 28, the axe gets a top spike (art, 2026-11-07)

For the orchestrator. Two options in `docs/art/candidates/arena/`, listed in `candidates.json` under `weapon-axe`: `weapon-axe-A.png` and `weapon-axe-B.png`. The old picture is kept as `weapon-axe-old.png`. Contact sheet: `sheet-pack28-axe.png` (old, A and B, held at guard and at a jab, and at 64 px). Nothing is in `docs/art/final/arena/` yet.

## The canvas changed (decided by necessity)

The old cap touched the top of the 253 x 1024 canvas, so a spike has no room to rise inside it. As the brief says, nothing was shrunk: **the canvas grew by 64 px at the top, to 253 x 1088**, and everything else moved down by exactly 64. The head, the haft, the grip and the butt are the old pixels, only shifted. (The collar's top rim was redrawn a little at the join.)

| | Old | A and B |
| --- | --- | --- |
| Image | 253 x 1024 | 253 x 1088 |
| Pin (hand closes) | 47, 832 | **47, 896** |
| Butt cap | y 965 to 1024 | y 1029 to 1088 |
| Head blade rows | 16 to 304 | 80 to 368 |

## The spike tip (image px, origin top left)

| Option | Tip (x, y) | Spike length above the collar top | Look |
| --- | --- | --- | --- |
| A | **43, 9** | about 100 px | a stubby, rounded spearhead on a thin socket; reads as a pike cap |
| B | **45, 7** | about 100 px | a long, slim four-sided needle on a small flared socket; the sharper silhouette |

The collar top, where the spike's socket sits, is at y 111. Tip distance from the pin, along the haft: A 887 px, B 889 px, against 832 px to the old cap's top, so the reach grows by about 55 px of the old 1024 (5 percent). The game's `weapon.axe` entry has `size [253, 1024]`, `pin 832` and `tip 0.04`: for either option it needs `size [253, 1088]`, `pin 896`, and a `tip` that is the spike (the point is at the top, 7 to 9 px from the edge), and `blade: [16, 304]` becomes `[80, 368]`. I did not touch game code.

## How it was made

Pack 26b's method: one masked edit of the old picture's top (two options from one call), with the mask over the two caps above the collar. As in 26b the model repainted the rest of the picture, darker, with no thick outline, so only the spike and its socket were cut out of the result, scaled to the old collar, given the old thick black outline in code, and laid onto the untouched old axe. Everything below y 52 of the old picture is the old pixels. The first attempt was refused by the safety filter (`violence`, at no cost); the prompt that passed calls the axe a "ceremonial prop" and the spike a "finial".

## Flaws

- The spike's metal is lighter and a little more golden than the old collar's steel.
- The collar's top edge is a touch softer than the old one where the spike sits on it.
- At 64 px (see the sheet) the spike reads as a notch of light on the top of the head, clearer in B.

## Cost

2 images, about $0.16 (1024x1536, medium, one call). Ledger total now $60.13.

## For the designer to paste

"Arena Pack 28 is in docs/art/candidates/arena (HANDOFF-arena-pack28.md): two axes with a top spike, weapon-axe-A and -B, and the contact sheet sheet-pack28-axe.png. The canvas grew 64 px at the top, so the pin moves to (47, 896)."
