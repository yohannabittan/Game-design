# Retro inbox

Things agents reported wrong, missing or out of date, and other notes for the next retro (2026-11-28). Add a line when it comes up; clear the list at the retro.

- **`tools/drive.mjs` can't hold or swipe** (first-minute helper, 2026-11-14): its `taps` only tap, so helpers write their own pointer events each time. Arena's `ptr` and `stroke` in `tools/checks/arena.mjs` do this; move them somewhere every game can use.
- **`tools/drive.mjs`'s `save:` couldn't reach a release copy** (release gate helper, 2026-11-14). Fixed the same day: `open(slug, { release: true })`.
- **A brief said Checkpoint scans every body** (first-minute helper, 2026-11-14): the detector gate had already shipped. The orchestrator briefed from a six-week-old playtest note without checking the changelog.
- **A brief named `docs/games/arena/RULES.md` before it existed** (suite builder, 2026-11-14): two agents ran at once and one's output was the other's input.
- **Arena `RECIPES.md`:** "start a run at bout N" and "a lift ends a blow" were added from builders' hunt notes (2026-11-14).
- **The split cost about $6 and the suite about $7,** against $8 to $17 for the builds before the code map. Two data points; check the next five.
