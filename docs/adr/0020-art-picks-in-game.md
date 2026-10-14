# ADR-0020: Pick art candidates inside the game

- **Date:** 2026-10-14
- **Status:** accepted
- **Scope:** `skeleton/src/engine.js`, `docs/art/BRIEF.md`, and each game when its next art lands (ADR-0006)

## Context

The designer: "Maybe we can make it so when you have alt art we put both, and I can switch them in game to pick them."

Today the art chat makes a contact sheet. The designer picks from it, outside the game, and only then is the art wired in. A picture on a sheet is not the picture on the card, behind the HUD, next to the drawn props. Some picks only make sense in context.

## Decision

1. **A candidates manifest per game.** With each pack, the art chat writes `docs/art/candidates/<slug>/candidates.json`:

   ```json
   { "pack": "13", "assets": { "daifuku-window": ["daifuku-window-A.png", "daifuku-window-B.png"] } }
   ```

   The keys are the asset names the game uses, without extension. The values are candidate files in the same folder, in sheet order.

2. **The engine loads it in the dev channel only.** `E.art` fetches `../../docs/art/candidates/<slug>/candidates.json` with `cache: 'no-store'`. GitHub Pages serves the branch, so `docs/` is on the same origin. A missing manifest is not an error: there are no candidates. Candidates are never added to the service worker's cache.

3. **One lookup for every portrait or image a game loads by name:** `E.art.src(name, fallbackSrc)`.
   - In dev, it returns the chosen candidate's URL when that name has candidates, otherwise `fallbackSrc`.
   - In release, it always returns `fallbackSrc`.

   `E.art.has(name)` tells a game that an asset now has a candidate, even if the game would otherwise draw its procedural fallback, so a pack can be tried before it is final.

4. **An ART tab, dev channel only,** shown on the menu only when the manifest has assets. It is 72 x 44, under the EXPORT tab at the top left (ADR-0019 geometry).
   - It opens an engine screen with one row per asset, each with lettered buttons (A, B, C ...) of at least 44 px, and the picked one highlighted.
   - A tap picks and reloads that image at once.
   - "Copy picks" uses the EXPORT panel's copy mechanism to give a text line to paste into any chat: `Art picks, launch, pack 13: daifuku-window B, mochi-ring A`.
   - Picks are saved under the engine-owned key `__art`, as `__tune` and `__ledger` are, so `migrate` never sees it.
   - The default pick is A.

5. **Finalising is unchanged.** The art chat (or the orchestrator, for a resize) puts the picked files into `docs/art/final/<slug>/`. A wiring step converts them into `games/<slug>/assets/`, as now, and empties the manifest's `assets`. The contact sheet stays, as a quick overview.

## Consequences

- Each game routes its image loads through `E.art.src` when its engine is next refreshed. Launch, for Pack 13, and Ink, for Pack 16, go first.
- The art chat's process gains one file per pack (`docs/art/BRIEF.md`, Process).
- **Dev only:** testers on the release channel never see candidates or the ART tab.
- **Size:** candidate PNGs are large, so they load on demand, one per pick, never all at once and never cached for offline.
