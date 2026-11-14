# Arena finding: the crest that faces the wrong way (2026-11-14)

**Contact sheet:** `docs/games/arena/sketches/helmets-crests.png`. Every helmet painting, as drawn on you (facing right) and mirrored (a foe, facing left), plus the tailor's crests and plumes, and six real in-game frames of you wearing them. Green = trails back, red = wrong way.

## Which
Only **your tailor's looks**, never a helmet and never a foe:
- **Wrong way, plainly:** `tailor-plume-red` and `tailor-plume-white` (the "crest of feathers"). The tuft sweeps forward, over the face. Rolled fighters do not change this; it is whichever plume you switched on at the Tailor.
- **Wrong way, less loud:** `tailor-crest-bronze` and `tailor-crest-silver`. Tall pointed end at the front, low tail at the back.
- **Right:** `tailor-plume-black` and `tailor-crest-gold` (gold is exactly the mirror of bronze and silver).
- **All fine:** `kit-helmet-gallic`, `-murmillo`, `-thraex`, `gear-bronze-crest`, `gear-plumed-helm`, `gear-phalanx-helm`, `gear-horned-cap`: each is painted facing right with its crest trailing left, so on a foe (mirrored with the whole man, `draw-fight.js:2636`) it trails right, back. The foe frames agree. `kit-helmet-secutor` has no crest. The drawn-in-code crests (murmillo fin, hoplo plume, `plume()`, `paintHeadGear`) have the right sign.
- Foes and champions never wear tailor pieces (`tailor` is set only on you, `game.js:589`), so no foe or champion crest is wrong.

## Cause
The four paintings were delivered with their tuft or tail leaning the other way from their siblings, and nothing flips them. `tailorHead` draws every tailor file unmirrored: `draw-fight.js:1166` (`pin`, a plain `drawImage`), called at `:1167` and `:1168`. Gear and helmets carry a `flip` in `TUNING.kit` where a painting faces the other way; the tailor entries at `tuning.js:722-724` have none.

## Smallest fix
Add `flip: true` to `tailor-crest-bronze`, `tailor-crest-silver`, `tailor-plume-red` and `tailor-plume-white` in `tuning.js:722-723`. In `pin` (`draw-fight.js:1166`), when `P.J.flip`, draw mirrored about the base point: `c.save(); c.translate(X + w, 0); c.scale(-1, 1);` with the anchor measured from the right edge (`size[0] - a[0]`), then `c.restore()`. Both anchors sit near the base and the mirror keeps the base on the head. Then judge by a frame of each of the six looks on you. (Alternative with no code: mirror the four `.webp` files in `docs/art/final/arena/` and the game folder, and swap the `a[0]` values to `size[0] - a[0]`.)

Check made: assets viewed raw and in game frames (gladius, nogear and gear variants). Not run: the full smoke suite (read-only task).
