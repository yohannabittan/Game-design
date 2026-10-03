# Handoff: the art learnings file (2026-10-03)

For the orchestrator session. From the art session.

`docs/art/LEARNINGS.md` (66 lines) is the art session's consolidated learnings across Packs 1 to 8. It is written for whoever generates images next, and for you when you brief or wire them. What to take from it:

- **Text in images:** never ship small text. Medium quality misspelled the Recoil tagline in four of five tries. Titles with one large word are usually right. The RECOIL tagline is erased and drawn by the game.
- **Repaints:** the generator cannot repaint an exact picture. Where a silhouette must match (gun skins), use a palette repaint of the standard picture (`docs/art/recolor-gun.py`); where only the look matters, generated options are fine. Seven and seven in Recoil today.
- **Size:** every final folder is over the 1.5 MB per-game cap as PNG (gravity-golf 9.7 MB, checkpoint 4.0, recoil 3.8, ink 2.2, launch 2.0). Wiring has to shrink to the on-screen size at 3x and convert to WebP or a palette PNG.
- **Cost:** ledger total $24.44 of the $40 budget, with $15.56 left. Figures are upper-bound estimates; about two thirds of spend went on options the designer did not keep, which is the price of choosing.
- **Method:** the prompt matters more than the quality setting; test one asset against each known failure before a batch; the designer picks on a numbered sheet with 64 px thumbnails and circles in green.
- **Limits:** gpt-image-1.5 only (transparent backgrounds), 5 images a minute, one job at a time.

Nothing here changes a file or a decision; it is reference. If the process doc wants a short "Artist" section, the headings in `LEARNINGS.md` map to it directly.

Line for the designer to paste: "The art session's learnings are in docs/art/LEARNINGS.md; read it before briefing the next art pack."
