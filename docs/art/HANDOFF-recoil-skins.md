# Handoff: Recoil gun skins (Pack 7), what the files are (2026-10-03)

For the orchestrator session. From the art session.

The fourteen skins are final in `docs/art/final/recoil/gun-<gun>-<skin>.png`, 512 px wide, transparent, facing right, each fitted into the exact pixel box of its standard `gun-<gun>.png`. They come in two kinds, and the designer chose the mix (seven palette repaints, seven generated):

- **Palette repaints (outline exact):** `make-my-day-frost` (redone 2026-10-03, see `HANDOFF-recoil-frost-skin.md`), `buddy-cop-blackout`, `assassins-scope-bronze`, `assassins-scope-carbon`, `assassins-scope-ghost`, `spin-lever-walnut`, `spin-lever-tactical`. These are the standard picture with its body tones remapped onto the skin's palette; outlines, neon rim light and the orange tip are untouched. Their silhouette is identical to the standard, so any hitbox or recoil math that works for the standard works for them.
- **Generated repaints (own silhouette, same box):** `buddy-cop-nickel`, `buddy-cop-gold`, `make-my-day-ivory`, `one-man-army-brass`, `one-man-army-hazard`, `pulse-rifle-arctic`, `pulse-rifle-desert`. The generator redraws rather than repaints, so these are the same gun type in the skin's finish with the details the brief asked for (plates, stripes, tape, bars), but the silhouette inside the box differs from the standard by 10 to 25 percent. Nothing extends past the standard's box. If the gun picture's own pixels are ever hit-tested, these need their own outline; if only the targets are hit-tested, nothing changes.

The game's own skin palettes (the hex values in the brief) are what the palette repaints use. If the orchestrator prefers one mechanism for all skins, the palette repaint is reproducible in canvas at runtime from the one standard picture per gun: remap luminance onto (dark steel, steel, highlight), keep saturated pixels and near-black outlines.

Spend and prompts are in `docs/assets-ledger.md`.
