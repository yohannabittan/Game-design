# Handoff: Arena Pack 27, helmets and head gear painted onto the head (art, 2026-11-04)

For the orchestrator. 12 layers in `docs/art/candidates/arena/` as `<name>-A.png` (old pieces kept as `<name>-old.png`), listed in `candidates.json`. Contact sheet: `sheet-pack27-helmets.png` (old piece, new worn, and worn at 64 px). Nothing is in `docs/art/final/arena/` yet.

## Method, and what differed from the brief

Each piece was a masked edit of `kit-base-head-A.png` (placed at 2x on a 1024 canvas with head room, flat green behind), with `input_fidelity=high`, then cut out. **The edit does not keep the pixels outside the mask:** it redraws the whole head (a first pass without high fidelity moved and rescaled it). So the layers are cut from the result, aligned to the head by the jaw and neck (shift of 0 to 16 px at 2x), and not pixel-identical to the head outside the piece. Two kinds:

- **Overlay (7):** the layer is the piece plus the head parts it covers (hair, brow, cheek), cut at a soft edge on skin; the head's own face, ear and neck show through. Draw it over the head at the head's pins. Layer image = head canvas plus extra room where the piece sticks out (crest, plume, horns, brim, tails).
- **Replaces the head (5: murmillo, thraex, secutor, phalanx, dark hood):** these cover the whole face, and the head's own nose and chin poke out beside them, so the layer is the whole painted head and neck, fading into the head's neck at the bottom. **Draw it instead of the head** (hair, face), not over it. The game must stop applying the head's own hair/face while one is worn.

**The game must stop applying these pieces' separate pins** (the old gear pins and the Pack 22 helm pin): lay each file so that its "head origin" sits on the head canvas's top-left, i.e. draw at (headX - ox, headY - oy) in head pixels (1 px here = 1 px of the head).

| File | Mode | Canvas (px) | Head origin (ox, oy) in the file | Opaque box (x0, y0 to x1, y1) |
| --- | --- | --- | --- | --- |
| kit-helmet-gallic | overlay | 266 x 308 | 10, 52 | 0, 0 to 264, 271 |
| kit-helmet-murmillo | replaces the head | 343 x 455 | 55, 199 | 0, 0 to 343, 455 |
| kit-helmet-thraex | replaces the head | 312 x 439 | 43, 183 | 0, 0 to 312, 439 |
| kit-helmet-secutor | replaces the head | 270 x 363 | 10, 107 | 0, 0 to 270, 363 |
| gear-bronze-crest | overlay | 306 x 405 | 44, 149 | 0, 0 to 306, 368 |
| gear-plumed-helm | overlay | 308 x 451 | 51, 195 | 0, 0 to 308, 414 |
| gear-phalanx-helm | replaces the head | 289 x 357 | 33, 101 | 0, 0 to 286, 357 |
| gear-horned-cap | overlay | 281 x 352 | 25, 96 | 0, 0 to 281, 232 |
| gear-dark-hood | replaces the head | 326 x 327 | 51, 71 | 0, 0 to 326, 327 |
| gear-blood-band | overlay | 296 x 256 | 40, 0 | 0, 36 to 293, 199 |
| gear-ribbon-band | overlay | 312 x 256 | 50, 0 | 0, 36 to 312, 207 |
| gear-laurel-wreath | overlay | 269 x 256 | 10, 0 | 0, 23 to 269, 118 |
## The designer's test

All 12 read as a man wearing the piece on the sheet, much more than the old floating pieces. Judged by eye at 64 px and larger; nothing was redone for it except the Gallic helmet and the horned cap (second try, "cover all the hair").

## Flaws

- Gallic: one small tuft of the head's own hair pokes out above the brow at the front.
- The five replace-the-head layers have a soft, slightly pale seam where the painted neck fades into the head's own neck, and their neck is a little narrower or offset (a few px). Murmillo has a faint green fringe at the neck's left edge. A head wearing one of them is no longer exactly the base head: face, ear and hair under them are hidden.
- Colour: the model made the bronze helmets and skin a little more saturated and glossy than the kit head. Secutor is steel-grey, not bronze as the old one was; thraex is dark steel with gold, murmillo steel with a bronze brim.
- The horned cap's leather is dark brown, close to the hair; the original hair shows under its rim at the back, as intended.
- Murmillo, thraex and plumed are larger than the head (brim, crest), so the layer canvases are bigger than 256.

## Cost

28 images (12 kept, 16 discarded: 14 without high fidelity or in the first test, 2 first tries of the Gallic and horned cap), about US$2.1 by the usage block (an upper bound).

## For the designer to paste

"The Arena Pack 27 helmets and head gear are in docs/art/candidates/arena (HANDOFF-arena-pack27.md, sheet-pack27-helmets.png): 12 pieces painted onto the head. Five closed helmets replace the head; the other seven lay over it."
