# Arena step: What's new shows the last few builds at once (locked 2026-11-17)

**The designer:** "Since I am sometimes testing more than one version at once, maybe we need to display it in a way where it's not paginated per version, and I can easily see the last 2–4 updates."

## What the player gets

- Tapping the build plaque opens one card listing the **newest builds together, newest first**, each with its build number and date as a small heading and its lines under it. No paging with ›.
- It shows **every build since you last opened the card** (at least the last 2, at most 5). Builds you haven't seen yet are marked (a small dot or "new" by the number).
- If they don't all fit, the list scrolls with a thumb drag inside the card; the card never runs off screen at 874x402 or 667x375.
- Closing it is as today.

## Acceptance

1. With three unseen builds, the card shows all three at once, marked new, plus nothing older; with none unseen, it shows the last 2.
2. Five builds of up to five lines each fit or scroll cleanly at both sizes; no text overflows the card; 44 px close target.
3. The plaque's NEW marker behaves as today. The last-seen build is in the save; if that changes the save's shape, `saveVersion` and `migrate` (ADR-0005).
4. `tools/checks/arena/notes.mjs` updated; `npm run check arena` and `npm run smoke` pass.
5. A still of the card with three new builds at 874x402 for the designer.
