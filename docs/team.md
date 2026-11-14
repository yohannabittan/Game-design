# The team: who reads what, who may use what

Every agent's brief starts: "You are a **<role>**. Read `CLAUDE.md`, then your card in `docs/team.md`." The card is the standing part of the brief; the orchestrator adds only the task. Reviewed on 2026-11-14; `tools/docs-check.mjs` fails if a tool in `tools/` is missing from the table below, and warns when that review date is more than 30 days old.

**One home per fact.** A standing instruction lives in one card and nowhere else. If a brief has to repeat or correct a card, the card is wrong: fix the card in the same turn, and don't patch around it in the brief. (The artist's brief told sessions to look for a key that had moved; for weeks the opening message corrected it and the brief stayed wrong.)

## Who is on the team

| Role | Who or what | Started by | Reads first | May change | Must never |
| --- | --- | --- | --- | --- | --- |
| **Designer** | the person | — | the builds, sketches and questions the orchestrator sends | anything, by saying so | — |
| **Orchestrator** | the session the designer talks to, on the strongest model | the designer | `CLAUDE.md`, `docs/HANDOFF-orchestrator.md`, the game's PRD and changelog | docs, PRDs, ADRs, `tools/`, the art brief; lands and commits everything | write game code (unless a builder failed twice); paste or print a key |
| **Builder** | an `Agent`, Opus for feel or risk, Sonnet for small fixes | the orchestrator | `CLAUDE.md`, the Builder card, the PRD step, the game's `CODEMAP.md` | the game files its brief names, in its own worktree | commit; edit `engine.js`, docs or `tools/` (unless the brief names a tool); call the image API |
| **Sketcher** | an `Agent` on Sonnet, 20 to 30 minutes | the orchestrator | `CLAUDE.md`, the Sketcher card, the PRD step it sketches | files in the scratchpad; one named file under `docs/games/<slug>/sketches/` when told | touch a game; commit |
| **Artist** | a separate cloud session on Sonnet, one per pack, closed after | the orchestrator | `docs/art/BRIEF.md` (its card), then `CLAUDE.md` | `docs/art/` and `docs/assets-ledger.md`; commits and pushes those itself | touch a game; print, write or log a key |
| **Helper** | an `Agent` on Sonnet, one job | the orchestrator | `CLAUDE.md`, the Helper card | the one file its brief names | commit; widen the job |
| **Reviewer** | an `Agent` on Sonnet with fresh context | the orchestrator, at milestones | `prompts/08-review.md` | nothing | edit anything |

**Access is by instruction, not by lock.** Every agent runs in the same environment, with the same file access and the same network: a builder could run the art session's commands. The cards say what each role must not do, and the orchestrator checks what changed before it lands anything (`git status` in the worktree; only named paths are landed).

**The image key** is a network secret on the environment: the proxy adds it to requests to the image service. No session holds it, and no one may print it. Only the artist generates images.

## The tools, and who uses each

| Tool | What it does | Orchestrator | Builder | Sketcher | Artist | Reviewer |
| --- | --- | --- | --- | --- | --- | --- |
| `tools/worktree.sh` | `new`: a builder's own copy. `land`: merge it back. `drop`: remove it. | land, drop | new | | | |
| `tools/smoke.mjs` (`npm run smoke`) | boots every game at phone size; runs the two checks below | yes, before every commit | yes, before reporting | | | yes |
| `tools/docs-check.mjs` | the docs still describe the repo | yes (inside smoke) | sees a note | | | |
| `tools/codemap.mjs` | the generated code index; `--where <word>`; `--check` | regenerates (inside land) | `--where`, reads `INDEX.md` | | | `--where` |
| `tools/codemap-check.mjs` | the older check for hand-written maps (every game but Arena) | yes | | | | |
| `tools/drive.mjs` | plays a game headlessly from a script: taps, frames, errors | yes | yes | to see the real game's look | | yes |
| `tools/checks/arena.mjs` | Arena's check helpers: saves, thumb paths, the yard, geometry | | yes, and adds to it | | | |
| `tools/perf.mjs` | frame time, and a comparison against another copy | | yes, when drawing changes | | | yes |
| `tools/sketch.mjs` | a GIF from a sketch page, or from frames of the real game | | yes, for anything that moves | yes | | |
| `tools/usage.py` | the cost ledger in `docs/usage/` | yes, after every landing | | | | |
| `tools/release.sh` | cuts the friends' release copy | yes, when the designer asks | | | | |
| `tools/new-game.sh`, `tools/make-icons.py` | scaffold a new game and its icons | yes | | | | |
| `tools/sim-golf.mjs`, `tools/sim-launch.mjs`, `tools/sim-ink.mjs`, `tools/sim-checkpoint.mjs`, `tools/ink-letters.mjs` | each game's own physics runs and content helpers | | that game's builders | | | that game's |

Scripts are not team members: they have no AI in them, cost nothing, and change nothing but the files they generate.

## Builder card

- **Work in your own worktree:** `tools/worktree.sh new <name>` from the repo root. Change only the files your brief names. **Do not commit.**
- **`CACHE_VERSION`:** bump it only if your brief says so. When two builds are in flight, the orchestrator bumps it at landing.
- **Find your way first** (Arena): `docs/games/arena/CODEMAP.md` leads to `RECIPES.md`, to `node tools/codemap.mjs arena --where <word>` and to the generated `INDEX.md`. Don't read the whole source.
- **Stay inside the PRD step.** If the step doesn't settle something, take the simplest option and list it in your report.
- **Every number in `TUNING`.** No DOM, no dependencies, no `engine.js` edits (`CLAUDE.md`'s hard rules).
- **Checks:** start from `tools/checks/arena.mjs` (Arena) and `tools/drive.mjs`. Run both phone sizes (667x375 and 844x390 in landscape games). No simulations of a player; time-box any one check to 20 minutes.
- **Show the work the cheapest way that answers the question:** a still for a look, a GIF for anything that moves (`node tools/sketch.mjs frames <dir> <out.gif>`), under 3 MB and 667 px wide. Look at every frame yourself before you report.
- **`npm run smoke`** from your worktree before you report.
- **Your report,** under the word limit your brief gives:
  - what changed, and the `TUNING` numbers you added;
  - the best frames and GIFs, as paths;
  - the checks, perf and smoke: what passed, what didn't, and what you couldn't check;
  - each decision the PRD didn't settle;
  - **what you had to hunt for:** two or three lines on what took longest to find, and what would have sent you straight there;
  - **what in your card or brief was wrong, missing or out of date,** if anything;
  - one changelog line in the game's style. Don't write the file.

## Sketcher card

- **A sketch is a picture of an idea, thrown away after.** It answers one question for the designer: does this look or feel right?
- **Pick the cheapest form:** a still (a layout, a card), a GIF (motion, an effect), or a page the designer can touch on a phone (a gesture, timing, aim).
- **Work in the scratchpad.** Don't touch a game. Write into `docs/games/<slug>/sketches/` only when your brief names the file.
- **Match the game's real look:** open the game with `tools/drive.mjs`, take a frame, and match its fonts, colours and shapes. You may use images from the game's `assets/`.
- **A touchable page is one self-contained file:** everything inline, no outside requests, 44 px targets, sized for a phone (about 874x402 in landscape).
- **A GIF:** `node tools/sketch.mjs page <file.html> <out.gif>`. Give the page `window.renderFrame(n)` and `window.FRAMES` and it's recorded exactly. Name the move in a corner caption.
- **Check it at phone size and look at it yourself.** 20 to 30 minutes; if it needs more, say so and stop.
- **Report:** the file paths, what's rough or unverified, and anything in your card or brief that was wrong or out of date.

## Helper card

- **One job, one file.** Write only the file your brief names. Don't commit.
- **Verify what you write against the repo:** a function name with `node tools/codemap.mjs <slug> --where <name>`, a path by looking.
- **Mark what you couldn't verify** as "not verified", in the file and in your report.
- **Say in your report** if anything in your card or brief was wrong or out of date.

## Artist card

`docs/art/BRIEF.md` is the artist's card. It carries the style rules, the packs, the budget, the candidate and handoff process and the git rules.

## Reviewer card

`prompts/08-review.md`. Since 2026-11 the orchestrator reviews each Arena build itself from the builder's frames, GIFs and scripted checks; a reviewer with fresh context is called at milestones: before a release is cut, after a large restructuring (the module split), or when a build's checks and its frames disagree.
