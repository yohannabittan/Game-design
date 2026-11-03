# Handoff: Arena Pack 23, the weapons and the ARENA title (art, 2026-11-03)

For the orchestrator. 8 weapons and 3 logo options in `docs/art/candidates/arena/`, listed in `candidates.json`. Nothing is in `docs/art/final/arena/` yet. Contact sheets: `sheet-weapons.png` (all eight at their relative lengths, with a ruler of one kit head per tick) and `sheet-logo.png` (the three logos on a dark ground).

## The weapons (8)

Each is a transparent PNG, straight up, point or head at the top and the end of the grip at the bottom, side view, nothing else in the picture. Each was made from the round kit shield as the style reference, then trimmed to its opaque box (no margin) and scaled so its height is the brief's length at **256 px per kit head** (the kit head part is 256 px tall): gladius, sica and rudis 640 px, dagger 384, axe and mace 1024, spear and trident 1792. Width follows the painting. To use a weapon at its current `len`, scale it by `len` over its height and rotate it about the pin.

All coordinates are image px, origin top left, y down.

| File | Image | Heads | Grip axis x | Grip from y to y | Grip width | Hand closes at (x, y) | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `weapon-gladius` | 96 x 640 | 2.5 | 48.0 | 452 to 582 | 41 | 48.0, 517 | pommel ball below the grip (y 582 to 640), guard above |
| `weapon-spear` | 95 x 1792 | 7 | 45.5 | shaft, see notes | 44 | 45.5, 1072 | shaft straight from about y 250 to 1730; butt spike y 1735 to 1792; leaf head y 0 to 250 at the top |
| `weapon-dagger` | 69 x 384 | 1.5 | 34.3 | 252 to 323 | 27 | 34.5, 287 | short: the grip is 72 px, a hand covers it |
| `weapon-sica` | 136 x 640 | 2.5 | 61.2 | 461 to 576 | 41 | 61.0, 518 | blade curves to the right and forward; the sharp edge is the inner curve |
| `weapon-axe` | 253 x 1024 | 4 | 47.0 | haft, see notes | 57 | 47.0, 832 | haft straight from about y 185 to 965; butt cap y 965 to 1024; head faces right |
| `weapon-mace` | 211 x 1024 | 4 | 106.0 | haft, see notes | 52 | 106.0, 832 | haft straight from about y 190 to 965; butt cap y 965 to 1024 |
| `weapon-trident` | 240 x 1792 | 7 | 121.0 | shaft, see notes | 37 | 121.0, 1072 | shaft straight from about y 355 to 1760; butt y 1760 to 1792; prongs y 0 to 355 |
| `weapon-wooden-sword` | 93 x 640 | 2.5 | 45.9 | 454 to 583 | 51 | 46.0, 518 | leather-wrapped grip; round wooden pommel below |

**Grip and hand.** For the four swords the grip is the straight run between the guard and the pommel, measured from the alpha, and the hand closes at its middle (the pin), with the grip axis at the x shown. For the axe, mace, spear and trident, the whole haft is straight, so the grip is not marked on the picture: the pin is a proposal, 192 px (three quarters of a head) above the butt for the axe and mace, and 720 px (2.8 heads, about 40 percent of the length) above the butt for the spear and trident, at the shaft's centre x. Move it if the reach feels wrong: the shaft is straight and clear over the whole run listed in the notes, so any point on it works. The shaft widths shown for the four are the haft's own width.

## The title (3 options)

`logo-arena-A`, `-B` and `-C`, transparent, native size from the generator (no downscale):

| File | Size | Ratio | Spelling | Look |
| --- | --- | --- | --- | --- |
| `logo-arena-A` | 1208 x 397 | 3.0 : 1 | ARENA, correct | gold letters with a dark stamped edge, a green and gold laurel curving under the word and rising at both ends |
| `logo-arena-B` | 1038 x 505 | 2.1 : 1 | ARENA, correct | a full laurel wreath circling behind the word on a dark plate; the tallest, and the one that least fits a wide title bar |
| `logo-arena-C` | 1289 x 321 | 4.0 : 1 | ARENA, correct | taller chiselled letters with a gold line under them and leaf sprigs at both ends; the widest and flattest |

I checked each by eye, letter by letter: all three read A R E N A, no extra letters. The A pick ships at about 3 : 1 as briefed; B is not 3 : 1 and C is wider. The letters are gold with a bronze edge rather than dull bronze. Ship as WebP at the title's on-screen width at 3x.

## Flaws

- The weapons came out with steel blades (gladius, dagger) where the brief said nothing about the metal: they read as iron, not bronze, next to a bronze kit.
- The sica is an S-curve: it bulges back near the guard and hooks forward at the tip, a more wavy blade than a plain crescent.
- The rudis is a pale yellow wood, brighter than the kit's wood.
- Nothing was redone and nothing was refused. Interior soft alpha is under 0.1 percent for every file.

## Cost

11 images, about $0.88 by the usage block. Pack 22 and Pack 23 together: 35 images, $2.55. Ledger total now $52.37 of $80, not counting the $4.82 wedding mock-ups, so the account is near $57.

## For the designer to paste

"The Arena Pack 23 art is in docs/art/candidates/arena (HANDOFF-arena-pack23.md): 8 painted weapons with their grips in px, and three ARENA logo options. Contact sheets: sheet-weapons.png and sheet-logo.png."
