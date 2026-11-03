# Handoff: Arena Pack 22, the card vault's gear and the tailor's looks (art, 2026-11-03)

For the orchestrator. 24 pieces, one option each (`-A`), in `docs/art/candidates/arena/`, listed in `candidates.json`. Nothing is in `docs/art/final/arena/` yet. Contact sheets: `sheet-vault-gear.png` (12 pieces) and `sheet-tailor.png` (12 looks), each piece also at 64 px.

Every piece is a transparent PNG, drawn alone in side view facing right (shields and paint face-on), made from the kit part that it covers as the style reference (head, torso, forearm, shin, round shield), then trimmed and fitted into the canvas below with a 2 px margin. Canvas sizes follow the Pack 20 gear of the same slot. The box column is the opaque area inside the canvas (x0, y0 to x1, y1); the pin column is where the piece meets the kit part, in canvas px with the origin at the top left.

## A. The card vault's gear (12)

| File | Canvas | Box | Pin |
| --- | --- | --- | --- |
| `gear-bossed-shield` | 320 x 320 | 2, 3 to 318, 317 | disc centre (160, 160) |
| `gear-phalanx-helm` | 256 x 256 | 26, 2 to 229, 254 | overlay 1:1 on the head canvas; helm centre (127, 128), open face area lower right |
| `gear-bloodletters-belt` | 384 x 96 | 88, 2 to 296, 94 | belt line y 48, centre x 192; knives and pouches hang below |
| `gear-crimson-cloak` | 384 x 512 | 9, 2 to 374, 510 | neck pin top centre (192, 2); hangs down |
| `gear-shadow-sandals` | 192 x 384 | 2, 70 to 190, 313 | ankle pin top of the shaft (38, 70); foot points right, toe at x 190 |
| `gear-wind-ribbons` | 160 x 240 | 2, 31 to 158, 208 | forearm axis x 39 at the top, 41 at the bottom; ends fly right |
| `gear-crusher-gauntlets` | 160 x 160 | 2, 7 to 158, 153 | cuff (elbow end) at top (112, 7), fist at the bottom left (74, 152), as the kit forearm |
| `gear-colossus-plate` | 384 x 384 | 2, 20 to 382, 363 | neck pin top centre (186, 20) |
| `gear-smoke-pouch-belt` | 384 x 96 | 97, 3 to 286, 94 | belt line y 48, centre x 191; knives and pouches hang below |
| `gear-mirror-cloak` | 384 x 512 | 2, 33 to 382, 479 | neck pin top centre (187, 33); hangs down |
| `gear-laurel-wreath` | 256 x 256 | 2, 16 to 254, 239 | ring centre (128, 127), open at the back |
| `gear-idols-torc` | 128 x 160 | 2, 4 to 126, 155 | neck pin top centre (64, 4); pectoral hangs to y 155 |

## B. The tailor's looks (12, three styles each)

The three styles of an item share a prompt and differ in colour only, so their shapes are alike, not identical: check the box and the pin per file.

| File | Canvas | Box | Pin |
| --- | --- | --- | --- |
| `tailor-crest-bronze` | 256 x 128 | 48, 2 to 207, 126 | base along the bottom edge, y 126, centre x 127; front (right end) at x 207 |
| `tailor-crest-silver` | 256 x 128 | 45, 2 to 210, 126 | base along the bottom edge, y 126, centre x 127; front (right end) at x 210 |
| `tailor-crest-gold` | 256 x 128 | 25, 2 to 231, 126 | base along the bottom edge, y 126, centre x 128; front (right end) at x 231 |
| `tailor-plume-red` | 256 x 256 | 43, 2 to 212, 254 | socket base at (88, 254); plume sweeps right and up |
| `tailor-plume-white` | 256 x 256 | 20, 2 to 234, 254 | socket base at (73, 254); plume sweeps right and up |
| `tailor-plume-black` | 256 x 256 | 18, 2 to 237, 254 | socket base at (206, 254); plume sweeps right and up |
| `tailor-paint-wings` | 256 x 256 | 2, 2 to 254, 253 | disc centre (128, 127), diameter 252 |
| `tailor-paint-bolt` | 256 x 256 | 2, 3 to 254, 253 | disc centre (128, 128), diameter 252 |
| `tailor-paint-sun` | 256 x 256 | 2, 2 to 254, 253 | disc centre (128, 127), diameter 252 |
| `tailor-cloak-red` | 384 x 512 | 25, 2 to 358, 510 | neck pin top centre (191, 2); hangs down |
| `tailor-cloak-blue` | 384 x 512 | 22, 2 to 361, 510 | neck pin top centre (182, 2); hangs down |
| `tailor-cloak-green` | 384 x 512 | 29, 2 to 355, 510 | neck pin top centre (184, 2); hangs down |

## What wiring must handle

- Belts are short in their wide canvas (the bloodletter's belt box is 208 px of 384, the smoke-pouch sash 189 px), as the Pack 20 belts were: stretch them to the waist width or draw the belt over them.
- Both belts and the crest hang in a small box; the gauntlet is a fist with a cuff, so it covers the hand as well as the forearm.
- The crimson cloak's hem is a near-black maroon, as briefed (a wet look, not red paint). The tailor's cloaks are plain wool with a bronze clasp; the red one is orange-red next to the crimson vault cloak.
- The shadow sandals are a laced boot that climbs about the lower third of the shin. Leave the foot to the shin part.
- The helm and wreath are drawn alone with the face area empty; no face line was drawn. The wreath is open at the back and sits on the hair.
- The paint emblems are full discs with a thin gold rim and no shield or boss, drawn to fill the canvas edge to edge; lay them over the round shield face at its own diameter.

## Flaws

- The colossus plate has a 1.1 percent soft interior (a dark sheen); the rest are fully solid (interior semi-transparency 0.00 to 0.02 percent).
- The crusher gauntlet reads as a fist with a steel cuff, a little plain next to the helm and plate.
- Each piece is one try: nothing was redone, nothing was refused.

## Cost

24 images, about $1.67 by the usage block at $40 per million output tokens (an upper bound). Ledger total now $52.37 of $80, not counting the $4.82 wedding mock-ups, which the account also paid, so the account is near $57.

## For the designer to paste

"The Arena Pack 22 art is in docs/art/candidates/arena (HANDOFF-arena-pack22.md): 12 card vault gear pieces and 12 tailor looks, with pins in px. Contact sheets are sheet-vault-gear.png and sheet-tailor.png."
