# Review (run after every builder, fresh context, no edits)

Fill in: `SLUG`, `LAYER` (1 to 7), `VERSION`

---

You are reviewing layer LAYER of the game `SLUG` in this repository. A builder session has just rewritten `games/SLUG/src/game.js`. Your job is to find every way it fails the spec, the principles, or the repo rules. You do not edit anything. You report.

Read, in this order:
1. `CLAUDE.md` (the hard rules)
2. `docs/games/SLUG/prd-vVERSION.md` (the spec)
3. `docs/design-principles.md`
4. `prompts/0LAYER-*.md` (what this layer was asked to deliver and forbidden to do)
5. `skeleton/README.md` (the engine contract)
6. `games/SLUG/src/game.js` (the output under review)
7. `git diff --stat` and `git status` for `games/SLUG/` to see what else changed

Then run `npm run smoke` and record the result.

## Check, in this order, and stop listing once you have found the blocking problems

1. **Rule violations.** Files created or changed other than `game.js` (unless the layer allows assets). DOM access. `engine.js` edits. Libraries. `Math.random` in anything that affects play. Numbers outside `TUNING`. Save shape changed without a `saveVersion` bump and `migrate`.
2. **Scope violations.** Anything from the PRD's scope fence. Anything from the layer prompt's "must not do" list. Anything from a later layer.
3. **Spec misses.** Each item the layer prompt says it delivers: present, and matching the PRD's wording? Controls match PRD section 4 exactly, including the occlusion rule? Tuning names match PRD section 16?
4. **Principle violations.** Can a correct input produce a bad outcome? Is a level unclearable on base equipment (read the intended-solution comments and check them against the data)? Is there a hidden random element? Does anything punish closing the app? Do the select, badges and result screens meet principle 11 (count the text items on a tile and a badge card)? Principles 13 to 16: does any verb only cost or only give; does every arc, ring, marker and camera move match the physics on the most extreme case; does a typical player meet every mechanic; is every hazard readable and on the severity ladder; does every upgrade show and every important cue have both a sound and a visual?
5. **Phone problems.** Touch targets under 44 px. HUD outside the safe area. Text under 14 px. Per-frame allocation in loops. Uncapped particle counts. Anything that would scroll or zoom the page.
6. **Correctness.** Read the update and render paths for the mechanic and trace one full play through by hand: first input, physics step, collision, scoring, end condition, restart. Note anything that cannot work as written.

## Report format

Start with one line: `PASS` or `FAIL`, then the smoke test result.

Then findings, most severe first, each as:

- `games/SLUG/src/game.js:LINE` — what is wrong — which rule, PRD section, or principle it breaks — what would fix it (one line).

Then, under "Not blocking", anything worth knowing that should not stop acceptance.

Finish with one line on whether the failure, if any, is the builder's fault or the document's fault (an ambiguous or missing PRD line), because the orchestrator fixes documents, not code.
