# Handoff: Arena Pack 26, armoured beasts and a painted laurel (art, 2026-11-04)

For the orchestrator, Step 16. 8 barding pieces (lion and bear) and the laurel in two options, in `docs/art/candidates/arena/`, listed in `candidates.json` (pack 26). Contact sheets: `sheet-pack26-beasts-worn.png` (each beast bare and wearing all four pieces, 1x and 0.4x, and the pieces alone) and `sheet-pack26-laurel.png` (the laurel round a champion portrait, at 3x and at game size). Nothing is in `docs/art/final/arena/`: the designer picks first.

## How the barding is delivered

Each piece is one option (`-A`), painted as the near side only (one solid plate, no opening, no inside, no cut edge end-on), and **placed on the canvas of the beast part it sits on, at that part's own scale.** So wiring draws it exactly as it draws the part, with the part's own box, pin and mirror, and needs no pin of its own:

| Piece | Canvas (same as) | Orientation | Drawn like |
| --- | --- | --- | --- |
| `beast-<kind>-armour-head-A.png` | 320 x 320 (`beast-<kind>-head-A`) | faces **right**, like the head file | the head, same eye, hinge and `u` |
| `beast-<kind>-armour-chest-A.png` | 640 x 384 (`beast-<kind>-torso-A`) | faces left, like the torso | the torso, same `box`, mirrored with it |
| `beast-<kind>-armour-back-A.png` | 640 x 384 (the torso) | faces left | the torso |
| `beast-<kind>-armour-leg-A.png` | 160 x 288 (`beast-<kind>-fore-up-A`) | faces left | the near fore-up half: same `a`, `b`, `w`, and `mir` |

The brief said "facing left" for all; the head files are painted facing right (the game's head `eye`, `hinge` and `lip` are in that frame), so the head guard follows its part. Every other piece follows the torso and leg files.

## Pins in px against the part (painted box x0, y0 to x1, y1 on the canvas)

| File | Painted box | Sits on |
| --- | --- | --- |
| `beast-lion-armour-head-A` | 152, 28 to 272, 102 | the brow, above the eye (245, 121) and clear of the jaw (hinge 255, 172; lip 303, 187); tilted down toward the nose |
| `beast-bear-armour-head-A` | 145, 23 to 264, 90 | the brow, above the eye (215, 108) and clear of the jaw (hinge 238, 160; lip 296, 172) |
| `beast-lion-armour-chest-A` | 30, 112 to 220, 359 | the chest and the front of the shoulder; the shoulder pin (166, 261) sits at its middle |
| `beast-bear-armour-chest-A` | 102, 140 to 214, 316 | the chest and the front of the shoulder; the shoulder pin (166, 249) sits inside it |
| `beast-lion-armour-back-A` | 220, 66 to 510, 190 | the back, from behind the shoulder to the haunch; its hanging straps reach y 190 |
| `beast-bear-armour-back-A` | 200, 47 to 500, 177 | the back, from the shoulder hump to the haunch |
| `beast-lion-armour-leg-A` | 38, 46 to 126, 255 | the foreleg's upper half (`a` 65, 51; `b` 80, 264) |
| `beast-bear-armour-leg-A` | 41, 39 to 129, 261 | the foreleg's upper half (`a` 91, 55; `b` 80, 264) |

The plates were fitted to the `-A` torsos and legs. The torso `-B`, the young torsos and the hind legs are the same canvas with the same pins, so the plates land close to the right place on them; the young beasts use the same files scaled with their parts. A young beast's fore-up `a` sits up to 30 px from the grown one's, so check the leg guard on the young bear (`a` 69, 41) and the young lion (`a` 62, 56).

Colours: lion bronze (#c8782a with #d6a23a trim); bear dark iron (#6f7782) with bronze trim, so the plates stay readable on the red-brown fur.

## The laurel

| File | Canvas | Notes |
| --- | --- | --- |
| `laurel-ring-A.png` | 300 x 400 (3x of 100 x 133) | slender pointed leaves like the logo's; ring bbox 3, 8 to 297, 392 |
| `laurel-ring-B.png` | 300 x 400 | fuller leaves with berries; ring bbox 3, 16 to 297, 383 |

Both are gold, face-on, a tall oval, open at the bottom (the leaf tips end with a gap) and tied at the top with a small knot. Centre the ring on the portrait's centre (150, 200 on the canvas). Opening width, in canvas px: A 206 at the middle row (y 200), 147 at y 80 and 320; B 195 at the middle, 117 at y 80 and 320. A 60 x 80 portrait at 3x is 180 x 240, so with **A the portrait's four corners just tuck behind the leaves (about 5 px at 1x)**; with B draw the ring at about 1.15x, or round the portrait's corners. Draw the portrait first and the ring over it. `sheet-pack26-laurel.png` shows both round Marcus and Mevia.

Extras, not in `candidates.json`: `laurel-ring-tied-A.png` and `-B.png` (300 x 400), a classic wreath **tied at the bottom and open at the top**, from my first try before I re-read "open at the bottom". Two rows in the sheet show them; they lap over the portrait's lower edge and would need the portrait pushed up. Delete them if unwanted.

## The designer's test, piece by piece

- **Chest plates and leg guards (both beasts): slotted.** Solid, outline closed, the beast's shoulder and leg run on above and below them.
- **Back plates: mostly slotted.** They are an arch of bands with a strap at each end, sitting on the back like a saddle blanket. The left end shows a strap loop at the arch; it is leather, not a hollow.
- **Head guards: weakest.** A plain curved band across the brow; on the lion it reads as a headband or crown more than a chamfron, on the bear as a hat band. They are solid with no inside and keep the eye clear, but do not follow the muzzle.

## Flaws

- Head guards are bands, not muzzle plates. Three tries at a plate with an eye notch and a tapering nose all showed a dark inside under the notch or at the nose tip (a recolour edit added it even to the clean original), and a head silhouette as a reference was painted into the picture. The band was the one that passed; a muzzle plate would be a longer job (separate muzzle and brow pieces).
- The bear chest plate is a tall flat panel with two strap tabs, more a tower shield than a chest cap, and on the bear it sits partly over the leg guard.
- The back and chest plates sit on the body's surface: they do not wrap its outline, and the lion's back plate stands a little proud of the back line at its left end.
- Lion and bear plates are different paintings (the bear's chest and head were generated separately), so a lion-to-bear scale of the same piece will not match.
- Method note for `LEARNINGS.md`: a part as a style reference pulls the shape (an iron bear back with a greave as the style reference came out as a greave, twice); the lion back recoloured to iron with "change only the colours, keep every band, rivet and strap" worked first time. A silhouette reference gets painted into the result; extract the plate by colour afterwards.

## Cost

27 images in 25 calls, about $1.93 by the usage block at $40 per million output tokens (an upper bound): 10 kept as candidates plus 2 extras ($1.07 kept, counting the 2 tied wreaths) and 15 discarded in redo rounds. The brief estimated $1.00 for 10 images; the heads and the bear back took four redo rounds. Ledger total now $57.13 of $80, plus the $4.82 wedding mock-ups on the account.

## For the designer to paste

"The Arena Pack 26 art is in docs/art/candidates/arena (HANDOFF-arena-pack26.md): armour for the lion and the bear (head, chest, back, foreleg) and a gold laurel ring in two options. Sheets: sheet-pack26-beasts-worn.png and sheet-pack26-laurel.png. The head guards are plain bands, the weakest part."
