# Handoff: Arena Pack 34 probe, the gladiatrix and six faces (art, 2026-11-21)

For the designer, then the orchestrator. Files are in `docs/art/candidates/arena-women/`, listed in `candidates.json` (pack 34). Nothing is in `docs/art/final/arena/` yet: **I stopped after the probe, for your pick.**

**Look at:** `sheet.jpg` (her assembled on the rig at 120 px, 240 px and 480 px, bare and in plate, greave, manica and a Gallic helmet, guard pose and arm raised, beside today's man of the same build) and `sheet-parts.jpg` (torsos with the joint rows marked, every limb joined straight and bent 90 degrees, the heads on the kit head's eye and chin lines, the six faces at 256 px and on the body at game size). Links once pushed: `https://yohannabittan.github.io/Game-design/docs/art/candidates/arena-women/sheet.jpg` and `.../sheet-parts.jpg`.

## What was made

| File | What |
| --- | --- |
| `kit-base-torso-avg-f-A.png`, `-B.png` | her torso, 384 x 512 (the man's canvas): A a cream linen chest band (strophium), B a dark leather band; belt, buckle and kilt as his |
| `kit-arm-up-avg-f.png`, `kit-arm-lo-avg-f.png` | one whole arm cut at the elbow, 160 x 288 each (one option) |
| `kit-leg-up-avg-f.png` (192 x 320), `kit-leg-lo-avg-f.png` (192 x 352) | one whole leg cut at the knee (one option) |
| `face-sparta-f-A.png`, `-B.png` | her head, 256 x 256 on the kit head's canvas: A short cropped hair; B hair pulled flat and bound in one short braid |
| `face-gaul-m/-f`, `face-numidia-m/-f`, `face-egypt-m/-f` | the six faces, 256 x 256, one option each |

## The six past mistakes, checked on the sheet

1. **One piece or two.** Each limb is one painting cut in code at the elbow or knee (Pack 21 method: each side resized to a fixed length, one width scale for both so the width at the cut is equal, 24 px overlap with a half-disc mask). Straight and bent 90 degrees on `sheet-parts.jpg`: one outline, one tone, no second bulge. Passed. A redo was needed first: the first arm and leg had the elbow at 40 percent and the knee at 56 percent of the limb, which the rig would have stretched; the second round asked for the joint at the middle, and the cut now puts it on the fixed row.
2. **Joints that meet.** Same canvas as the man's torso; shoulder width, neck and belt row match within a few px (table below). Passed. Leg-lo came back facing left and was mirrored (toes right, as the kit).
3. **Worn, not stuck on.** The chest band, belt and kilt are painted onto her torso, near side only. Today's `kit-plate-chest`, `-greave`, `-manica` and the Gallic `-worn` helmet sit on her on the sheet, drawn with the game's own pins. They sit right, with one finding: **the chest plate is the man's muscled cuirass, so in plate she reads as a woman with a man's chest** (her torso narrows at the waist, and the plate is a little wider there). Your call: keep it (same armour, as the step says), or I paint a plate for her.
4. **Facing the same way.** Head, chest, arm and foot all face right. No second arm in any painting; the far arm on the sheet is the game's own shaded copy. Her torso is painted nearly frontal (the man's is turned a little); the sheet shows it flipped as the game does, and it reads fine. The head is on the kit scale (1 head = 256 px) and nose, eye line and chin were fitted to the kit head: eye lines land within about 8 px of y 125.
5. **Same body family.** Her torso, limbs and Sparta heads had their skin matched to the man's average torso (mean RGB 241, 152, 55); for the limbs and heads a per-channel quantile match as well, because the first limbs came out redder and more saturated than the torso (Pack 20b's mistake again). Visible match on the sheet.
6. **Look it up.** Real gladiatrices (Halicarnassus relief, Amazon and Achillia) fought in the men's kit with a bare chest or a plain band, and the model is a strong, trained athlete: belt, kilt, wrapped forearm, a plain strophium, hair short or bound. Not sexualised, not a costume. No image was refused.

## Joints in px

Torso (384 x 512; the man's avg is the reference; `w` stays 291, her shoulders are as wide as his):

| | man (today) | her A | her B |
| --- | --- | --- | --- |
| axis column (belt row centre), `a` and `b` x | 178 (tuning), 179 measured | **181.5** | **182.5** |
| `a` y (neck top) / `b` y (belt) | 0 / 298 | 0 / 298 | 0 / 298 |
| neck stub at the top rows, x range | 163 to 222 | 157 to 227 | 159 to 226 |
| widest (shoulder) row, x range | row 119, 25 to 374 | row 106, 26 to 374 | row 105, 27 to 377 |
| belt row 298, x range | 51 to 307 | 62 to 301 | 67 to 298 |

The waist (row 200) is 235 px for him, 213 (A) and 201 (B) for her. The torso was squeezed vertically above the belt (belt centre from about row 318 to 298) and the kilt stretched to the canvas bottom.

Limbs (x, y in the file's own px; shoulder = about 40 px below the top of the shape, as Pack 24; `w` = painted width at the cut):

| File | Canvas | `a` | `b` | painted `w` at the cut |
| --- | --- | --- | --- | --- |
| `kit-arm-up-avg-f` | 160 x 288 | shoulder 90.0, 40 | elbow 79.5, 264 | 64 |
| `kit-arm-lo-avg-f` | 160 x 288 | elbow 79.5, 24 | fist grip 117.0, 244 | 64 |
| `kit-leg-up-avg-f` | 192 x 320 | hip 90.0, 69 | knee 95.5, 296 | 78 |
| `kit-leg-lo-avg-f` | 192 x 352 | knee 95.5, 24 | ankle 68.0, 293 | 78 |

`kit-leg-up-avg-f`: the painted kilt hem ends at row 126; set `top: 131` as the man's avg leg uses `top: 118`. Fist grip and ankle y follow the man's convention (16.3 percent and 17.8 percent of the lower half up from its bottom). No `mir`: all painted facing right.

**Width.** The rig draws a half at its hit width however thick it is painted, so a thin painting would draw as thick as his. On the sheet she is drawn at **90 percent of his limb width**: in tuning that is `w` = painted width / 0.9, so **arm 71, leg 87** (the sheet's setting; tell me if you want her as thick as he is, or thinner, and it is one number). Her arm is 64 against his 83 painted: she is a trained athlete but not as heavy as the man at the same build; the lean and muscular builds come after your pick.

Heads (`face-*`, 256 x 256): same pins as `kit-base-head` (`a` 128, 0; `b` 128, 222), eye line y 125, chin y 222; helmets lie over them with the existing `TUNING.kit.helm` offsets. Gallic helmet on her: fits, the braid of B hangs behind the neck, and the helm sits on the head, not on the hair. The closed helmets (murmillo, thraex) are the whole painted head and hide the face, so they are unchanged.

## What to judge, and flags

- **Taste (you pick):** torso A (cream band) or B (leather band, darker and more armoured); Sparta A (cropped) or B (braid); and whether the six faces read as Gaul, Numidia and Egypt. Faces: Gaul has red-blond hair, freckles, pale skin (the man a drooping moustache, the woman a tight braid); Numidia deep brown skin (the man tight curls and a short beard and a gold hoop, the woman cornrows); Egypt olive skin, kohl, black hair (the man a straight fringe, the woman a low knot).
- **Skin versus the body (not yet decided):** the faces keep their own skin; on the man's orange body (see the bottom row of `sheet-parts.jpg`) the Numidian neck is darker than the chest and the Gaul paler. A skin tint on the body per origin would be a wiring decision; or the heads are given a body-matching neck.
- **Outline:** her torso and limbs have a brown-red outline like the man's limbs; the Sparta heads have the black outline of the kit head (as does his). Same family as today.
- **Plate on her:** see mistake 3.

## Cost

18 images, **$1.15** by the ledger estimate (11 kept, 7 discarded: one long torso, the first arm and leg, three heads with a weak outline or a grey halo). Ledger total **$66.67** of the $100 budget. Pillow worked in this container (the brief's "PIL is broken" line is out of date: tell the orchestrator); no browser was needed.

## For the designer to paste

"The Arena Pack 34 probe is in docs/art/candidates/arena-women (HANDOFF-arena-pack34.md): a gladiatrix of average build on the rig beside today's man (sheet.jpg), her parts and the six faces (sheet-parts.jpg). Pick her torso A or B and head A or B, and say whether to go on with the other builds and the remaining faces."
