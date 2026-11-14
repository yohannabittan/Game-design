# Arena code map

The hand-written map that was here went stale (it described v36; the game is past v66, and 513 of its 553 anchors had moved). It is replaced by three things, used in this order:

1. **`RECIPES.md`** (hand-written, short): for the common kinds of change (a card, a weapon, a hint, an export field, a purse item, a yard step), the places to touch, by name. Start here.
2. **`node tools/codemap.mjs arena --where <word>`**: where a word is declared, which TUNING blocks carry it, and which functions use it. Use it in place of a run of greps.
3. **`INDEX.md`** (generated, never edited): every section and every top-level declaration, with its line, size and what its comment says, and TUNING's blocks. Regenerate it with `node tools/codemap.mjs arena`.

**Keeping them true, by machine:**
- `tools/worktree.sh land` regenerates `INDEX.md` whenever a build's source lands.
- `npm run smoke` fails in the main checkout if `INDEX.md` is out of date, or if `RECIPES.md` names code that no longer exists (a renamed or removed function). In a builder's worktree it only prints a note.

**Keeping them useful, by habit:**
- Every builder's report ends with "what I had to hunt for" (`prompts/README.md`); the orchestrator adds that to `RECIPES.md`.
- A function's first comment line is what the index shows, so write it as "what this is for".
