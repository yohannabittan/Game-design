# Handoff: Recoil frost skin redone as a palette repaint (2026-10-03)

For the orchestrator session. From the art session.

## What changed

`docs/art/final/recoil/gun-make-my-day-frost.png` is replaced. The generated version had come out as a semi-auto pistol, not a revolver. The new file is a palette repaint of the standard `gun-make-my-day.png`, so it is the same revolver: the same silhouette, cylinder, hammer, trigger guard and long barrel.

- **Silhouette:** the alpha channel is copied from the standard picture byte for byte (checked: arrays equal). Any hitbox, recoil or rotation maths that works for the standard works for frost.
- **Palette (the brief's frost values):** body remapped from dark steel `#8ea6c8` through steel `#dbe7f7` to a pale highlight; the blue rib along the barrel is accent `#3f6396`, drawn as two stripes so it still reads at thumbnail size; the grip is dark steel; the pink top rim becomes a pale highlight; near-black outlines and the orange muzzle sight stay.
- **Reads apart at 64 px** from the standard (dark navy with a red grip) and from ivory (white grip, steel barrel): frost is the only all-pale revolver with a blue-banded barrel.
- Same file name and size as before (512 x 437, about 80 KB), but see the next section: the game does not read this file.

## Not wired yet: the game still shows the old pistol (found 2026-10-03)

The designer reported the in-game frost still looks automatic, and it does. Recoil loads `games/recoil/assets/gun-make-my-day-frost.webp`, a converted copy made at wiring (commit a04abb2) from the old generated file; replacing the PNG in `docs/art/final/` does not touch it. Decoded, that WebP is the old semi-auto, 372 x 171.

The fix is yours (the art session does not edit `games/`):

1. Convert the new `docs/art/final/recoil/gun-make-my-day-frost.png` into `games/recoil/assets/gun-make-my-day-frost.webp` the same way `gun-make-my-day.webp` was made from the standard PNG. The alpha is identical, so the result is the same 372 x 171 box. Every other skin that shares its standard's silhouette (spin-lever walnut and tactical, assassins-scope carbon, bronze and ghost, buddy-cop blackout) got exactly its standard's size and tip numbers, which confirms the convention.
2. In `GUN_PIC.revolver.files`, change `frost: ['gun-make-my-day-frost.webp', 372, 20.5]` to the standard's numbers, `frost: ['gun-make-my-day-frost.webp', 370, 29.9]`. The 20.5 was the old pistol's tip height; the repaint's barrel tip is the standard's.
3. Per CLAUDE.md rule 11: bump `CACHE_VERSION` in `games/recoil/sw.js` (the installed home-screen copy otherwise keeps the old WebP) and add a CHANGELOG line.
4. Check the frost skin in the shop, the menu rack, the stats card and the gun in the player's hand; the shots should leave from the barrel tip.

## Recipe

`docs/art/recolor-gun.py` (Pillow and numpy) rebuilds it: `python3 docs/art/recolor-gun.py docs/art/final/recoil/gun-make-my-day.png out.png`. The rib rows are set for this one gun at the top of the script. It is the same idea as the six earlier palette repaints and the one the skins handoff suggests for canvas at runtime: keep alpha, remap by role and luminance.

## Count after this change

Seven palette repaints with an exact outline (blackout, bronze, carbon, ghost, walnut, tactical, frost) and seven generated skins (nickel, gold, ivory, brass, hazard, arctic, desert). `HANDOFF-recoil-skins.md` is updated to match.

Cost: no generation, so $0. The old generated frost row in `docs/assets-ledger.md` is marked superseded.

Line for the designer to paste: "The frost skin is redone as a palette repaint of the standard revolver; pull and re-run the Recoil check."
