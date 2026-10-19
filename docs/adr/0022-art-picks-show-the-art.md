# ADR-0022: The ART tab shows the art

- **Date:** 2026-10-19
- **Status:** accepted
- **Scope:** `skeleton/src/engine.js` (the ART tab of ADR-0020), copied into each game that uses `E.art` (Launch, Ink, Arena) per ADR-0006

## Context

The designer: "The art mechanism is not easy for me to use, because I don't know what I'm changing in the art menu. It should at least display what it looks like."

ADR-0020's ART tab lists each asset by its file name, with A, B and C buttons. A name like `arena-colosseum` or `kit-base-torso` doesn't say what you are looking at. The only way to see a choice is to find where the game draws it.

## Decision

1. **Each option is shown as a picture.** Each asset row shows each candidate as a thumbnail, about 72 px tall and its aspect kept, with its letter under it. The current pick is outlined in gold, and a tap on a thumbnail picks it.
2. **The asset's name is said in plain words.** A game may pass `E.art.label(name)` → a string, for example "Colosseum backdrop" or "Torso, lean". Without it, the name is shown with its dashes as spaces.
3. **A tap-and-hold enlarges.** Holding a thumbnail shows it big, centred, over a dark wash, until the finger lifts.
4. **Rows are grouped** by the manifest's order, and the tab scrolls. Assets with a single candidate are listed after the choices, under "Only one option", so the picks come first.
5. **Images load lazily.** Only the rows on screen load their thumbnails, so a pack of 40 images doesn't stall the tab.
6. **The path fix.** `E.art.src` decodes the candidate's path (the `/` encoding issue that Ink and Arena worked around), so a game needs no local decode.
7. **Dev channel only,** as ADR-0020. Release never shows the tab.

## Consequences

- The designer picks by eye, in the game, without the contact sheet.
- Each game's local decode workaround becomes a harmless no-op. The next build of each game may remove it.
- The engine change is copied into Launch, Ink and Arena, with their `CACHE_VERSION` bumped.
