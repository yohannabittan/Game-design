# Handoff: Recoil frost skin redone as a palette repaint (2026-10-03)

For the orchestrator session. From the art session.

## What changed

`docs/art/final/recoil/gun-make-my-day-frost.png` is replaced. The generated version had come out as a semi-auto pistol, not a revolver. The new file is a palette repaint of the standard `gun-make-my-day.png`, so it is the same revolver: the same silhouette, cylinder, hammer, trigger guard and long barrel.

- **Silhouette:** the alpha channel is copied from the standard picture byte for byte (checked: arrays equal). Any hitbox, recoil or rotation maths that works for the standard works for frost.
- **Palette (the brief's frost values):** body remapped from dark steel `#8ea6c8` through steel `#dbe7f7` to a pale highlight; the blue rib along the barrel is accent `#3f6396`, drawn as two stripes so it still reads at thumbnail size; the grip is dark steel; the pink top rim becomes a pale highlight; near-black outlines and the orange muzzle sight stay.
- **Reads apart at 64 px** from the standard (dark navy with a red grip) and from ivory (white grip, steel barrel): frost is the only all-pale revolver with a blue-banded barrel.
- Same file name, same 512 x 437 size, so wiring is unchanged. About 80 KB.

## Recipe

`docs/art/recolor-gun.py` (Pillow and numpy) rebuilds it: `python3 docs/art/recolor-gun.py docs/art/final/recoil/gun-make-my-day.png out.png`. The rib rows are set for this one gun at the top of the script. It is the same idea as the six earlier palette repaints and the one the skins handoff suggests for canvas at runtime: keep alpha, remap by role and luminance.

## Count after this change

Seven palette repaints with an exact outline (blackout, bronze, carbon, ghost, walnut, tactical, frost) and seven generated skins (nickel, gold, ivory, brass, hazard, arctic, desert). `HANDOFF-recoil-skins.md` is updated to match.

Cost: no generation, so $0. The old generated frost row in `docs/assets-ledger.md` is marked superseded.

Line for the designer to paste: "The frost skin is redone as a palette repaint of the standard revolver; pull and re-run the Recoil check."
