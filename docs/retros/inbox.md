# Retro inbox

Things agents reported wrong, missing or out of date, and other notes for the next retro (2026-11-28). Add a line when it comes up; clear the list at the retro.

- **`tools/drive.mjs` can't hold or swipe** (first-minute helper, 2026-11-14): its `taps` only tap, so helpers write their own pointer events each time. Arena's `ptr` and `stroke` in `tools/checks/arena.mjs` do this; move them somewhere every game can use.
- **`tools/drive.mjs`'s `save:` couldn't reach a release copy** (release gate helper, 2026-11-14). Fixed the same day: `open(slug, { release: true })`.
- **A brief said Checkpoint scans every body** (first-minute helper, 2026-11-14): the detector gate had already shipped. The orchestrator briefed from a six-week-old playtest note without checking the changelog.
- **A brief named `docs/games/arena/RULES.md` before it existed** (suite builder, 2026-11-14): two agents ran at once and one's output was the other's input.
- **Arena `RECIPES.md`:** "start a run at bout N" and "a lift ends a blow" were added from builders' hunt notes (2026-11-14).
- **The split cost about $6 and the suite about $7,** against $8 to $17 for the builds before the code map. Two data points; check the next five.
- **Arena `RECIPES.md` is missing where effects are drawn** (Step 26 builder, 2026-11-14): particles render in `scenes.js`, and `Math.random` feeds the cracks. Add a recipe for "add a hit effect".
- **`RULES.md` wasn't updated by the Step 26 landing** beyond its version line; rule 5 says every landing updates it. Do it with the 26b fix build.
- 2026-11-14: `RULES.md` says two blades are gladius or dagger only; the purse sells a second copy of any weapon (the limit is for foes). Found when the designer bought two spears. Fix `RULES.md` in the next Arena build.
- 2026-11-14: an accidental interrupt from the designer's phone killed three running agents, and killed agents cannot be resumed. Fresh agents picked up the uncommitted worktrees and it cost a few minutes. Worth knowing: a worktree outlives its builder, so nothing was lost.
- 2026-11-14: the spear build ran 37 minutes on Opus for a one-number change, because the step carried eight acceptance items with pixel targets and was bundled with the helmet work. The designer asked why. For a change that is only a number: a quick build (change it, one still at two phone sizes, the suite once), then the designer's play judges it. Keep the checks that catch silent breakage (the camera fit, the yard); drop exact pixel targets.

- 2026-11-14, crests: the crest finding judged direction from the raw paintings and called the wrong one right, and I approved the build from a still without comparing it to a helmet known to be right. The designer caught it from the still. For a look question, the still should sit next to a known-good reference. Also: I pushed v76 before reading the smoke result (only the generated index was stale); read the exit before pushing.

- 2026-11-14, two weapons: the Opus builder reported running about 2 hours against a 40-minute time-box; its log says 33 minutes. I repeated its figure to the designer without checking the ledger. Agents' own durations are not to be trusted; `docs/usage/agents.csv` has the real start and end. A time-box in the brief is not enough on its own; the orchestrator should check in at the box (a send_later at dispatch) and decide whether to let it run. Its "what I had to hunt for": RECIPES.md needs an entry for the hand and arm (`solveArm`, the arm drawing) and one saying the play update runs nothing during hit-stop.

- 2026-11-17, the knife arm: the sword whipped forward with the thrown knife in the builder's frames; I offered "throw from the off hand" as an option instead of the obvious fix (put the sword away). The designer named it ("I'm surprised you didn't think of that"; "that's a good learning"). Added to "The designer's taste" in `docs/team.md`: ask "would a real person do this?" before showing or asking about a frame.

- 2026-11-17, tools: eight reusable tools (verify kit, land, film and scene, film --yard, playtest reader, sketch kit) cost about 20 minutes of Sonnet in all; the first verifier with the kit took 5 minutes against 10 to 11 before, and the land command stopped a bad push on its first real use. The designer: "reusable tools are very worthwhile". New standing habit on the Orchestrator card: a chore that shows up in two agents' hunt lists becomes a tool at once.
