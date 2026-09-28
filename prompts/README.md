# Layer prompts

One prompt per layer. Each one is written to be pasted into a fresh Claude Code session opened in this repo, with the placeholders filled. The session reads the PRD and the skeleton contract itself; the prompt tells it exactly what to produce and how it will be judged.

| Layer | File | Rewrites | Prerequisite |
| --- | --- | --- | --- |
| 1 | `01-mechanic.md` | `src/game.js` from the skeleton demo | PRD locked, folder scaffolded |
| 2 | `02-content.md` | the level or wave data and difficulty curve | Layer 1 played and the skill axis felt |
| 3 | `03-juice.md` | feedback, particles, shake, tweens, sound mapping | Layer 2 |
| 4 | `04-progression.md` | stars, unlocks, badges, save shape | Delight test passed |
| 5 | `05-art.md` | palette, shapes with character, or sprites | Delight test passed |
| 6 | `06-audio.md` | a sound identity from the synth, or asset hooks | Delight test passed |
| 7 | `07-modes.md` | daily, endless, time attack, zen, challenges | Delight test passed |

## What makes these land on the first try

- **Closed target.** Each prompt asks for one layer and forbids the others.
- **Fixed contract.** The engine API is in `skeleton/README.md` and does not change mid-build.
- **Spec, not vibes.** The PRD has the numbers, the controls, the scope fence.
- **One file.** The output is always `games/<slug>/src/game.js`. Nothing else is created.
- **Acceptance in the prompt.** The session checks its own work against a list before it says done.
- **Smoke test.** `npm run smoke` runs before the session ends.

## How to run one

1. Fill the placeholders at the top of the prompt file (slug, and for later layers the playtest findings).
2. Open a Claude Code session in the repo. Paste the prompt.
3. When it finishes, play the game on the phone before the next layer.
4. Record tuning changes in the PRD's tuning table, not in chat.

If a layer fails, do not patch in chat. Fix the PRD or the prompt so the next run lands, then re-run the layer. The point is that the documents get better, not just the game.
