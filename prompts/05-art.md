# Layer 5: Art

Fill in: `SLUG`, `PLAYTEST_NOTE`, `VERSION`

---

You are building layer 5 (art) of the game `SLUG`. The kernel is proven. Designer's note: "PLAYTEST_NOTE".

Read:
1. `CLAUDE.md`
2. `docs/games/SLUG/prd-vVERSION.md`, the art direction section (it names the look, the palette, and whether sprites are in)
3. `docs/design-principles.md`, principle 7
4. `games/SLUG/src/game.js`

Then edit `games/SLUG/src/game.js`. If the PRD says sprites are in, you may also add image files under `games/SLUG/assets/` and must add them to the `ASSETS` list in `games/SLUG/sw.js`. No other files.

## What layer 5 delivers

- A palette object in `TUNING` (background, three semantic colours, two accents, text) and every draw call using it. No literal colours elsewhere.
- Shapes with character: the player object, the goal, and the danger are each recognisable by silhouette at arm's length. Use Canvas paths, gradients, and simple procedural detail (eyes, stripes, glow) before reaching for images.
- Consistent line weight, corner radius, and shadow or glow rules, stated as constants.
- A background that reads as a place without competing with play: subtle gradient, parallax bands, or a repeated motif. Never busier than the play objects.
- HUD typography from `E.text` with a size scale (three sizes) and one weight rule.
- If sprites are in: a tiny loader in `init` (images from `assets/`), drawn with `drawImage`, with a shape fallback while loading. Keep total assets under 500 KB.

## Rules

- Art must not change hitboxes or readability. If a shape gets a decoration, the collision stays the same.
- The three semantic colours from the PRD keep their meaning everywhere: the goal colour never appears on a danger.
- Contrast: text and play objects pass at a glance against the background in daylight. Say what you did to make that true.
- No fonts loaded from the network. System fonts only, or a font file under `assets/` added to the cache list.

## What layer 5 must not do

- No mechanic, content, progression, audio, or mode changes.
- No DOM, libraries, or `engine.js` changes.

## Before you say done

- Run `npm run smoke`. If you added assets, confirm they are in `sw.js` and bump `CACHE_VERSION`.
- Add a changelog line.
- Regenerate the icons if the palette changed: `python3 tools/make-icons.py games/SLUG <hex> <letter>`.
