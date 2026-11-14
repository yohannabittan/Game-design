# Handoff: the orchestrator session (2026-11-03)

For a new Claude Code session taking over as the orchestrator. Read `CLAUDE.md` first; it holds the roles, the hard rules and the orchestration rules (ADR-0010). This page is what that file doesn't say: where things stand, what is waiting, and how this designer likes to work.

## Working rules this session followed

- **Branch:** work and push only on `claude/flash-game-dev-process-v7yrbe`. Push with `git push -u origin claude/flash-game-dev-process-v7yrbe`. On a rejected push, run `git pull --no-rebase` and push again. Open no pull requests unless asked.
- **GitHub Pages** serves this branch, so never push half-built or unreviewed game files.
- **The repo is public.** Nothing copyrighted or private goes in. No model names go in pushed files, beyond the commit trailer.
- **Commit messages end with:**
  - `Co-Authored-By: <your model> <noreply@anthropic.com>`;
  - your own `Claude-Session:` line.
- **The image key** (OpenAI) lives in the art chat's environment settings. Never write it to the repo, print it, log it, or ask the designer to paste a key or password in chat.
- **Builds:**
  - The orchestrator writes PRDs, ADRs and docs. It dispatches builders and reviewers as Agents, each in its own worktree (`tools/worktree.sh new|land|drop`), with no more than three heavy agents at a time.
  - After each landed build, the orchestrator runs `npm run smoke`, adds a changelog line naming the builder's model, commits, runs `python3 tools/usage.py`, commits `docs/usage`, and pushes.
  - The orchestrator never writes `game.js` itself.
- **Engine changes** go in `skeleton/src/engine.js` with an ADR, then get copied into the games, but only with the designer's OK.
- **Cost before rigour** (`docs/process.md`): question every heavy check. The designer judges feel and difficulty by playtest.
- **Talking to the designer:**
  - Show the designer a first version before acting on anything outward-facing. Their standing preference: "Always show me at least a first version before generating a draft in Gmail."
  - Use plain words, short tables, and a clear list of what is waiting on them.
  - Send screenshots of each landed build, before and after.
  - The designer is Yohann. Use they/them.
- **Art** is made by a separate, long-lived art chat (ADR-0015):
  - the orchestrator writes a pack into `docs/art/BRIEF.md` and gives the designer one line to paste into the art chat;
  - the art chat pushes candidates to `docs/art/candidates/<slug>/` and a `docs/art/HANDOFF-*.md`;
  - the orchestrator then dispatches a wiring build.
- **The environment:** PIL is broken in the cloud container. Build contact sheets in the browser through `tools/drive.mjs`, and GIFs with `/usr/bin/ffmpeg`. Arena's check helpers are kept in `tools/checks/arena.mjs`.

## Where each game stands

| Game | Dev build | Notes |
| --- | --- | --- |
| Arena | `arena-v68` | PRD `docs/games/arena/prd-v0.3.md`, built through Step 24 with 24c (the training yard, the one-tap draft, the sidearm, throwing knives, the bow, the reinforced shield, planted overheads). The most active game. **Next, in this order** (the PRD's "Build order"): Step 26 (each blow's look, built to `sketches/*.gif`); Steps 27 and 27b (Trials; art Pack 30 is in `docs/art/final/arena/`). The reuse pack (a Daily run, the Hall, Legend cards, decrees) is queued in the PRD. |
| Gravity Golf | `gravity-golf-v36` | PRD v0.16. A design discussion is open: Trials (below). |
| Ink | `ink-v33` | Quiet. |
| Recoil | `recoil-v33` | Quiet. |
| Launch | `launch-v18` | Quiet. |
| Checkpoint | `checkpoint-v12` | Quiet. |

Each game's history is in `docs/games/<slug>/CHANGELOG.md`. To find code in Arena, start from `docs/games/arena/CODEMAP.md`: the recipes, `node tools/codemap.mjs arena --where <word>`, and the generated `INDEX.md`. `node tools/docs-check.mjs` says when this document has fallen behind the games.

## Waiting on the designer

1. **Friends features (ADR-0023, proposed):** a share card, a daily seed and "beat my run" codes, with no server. Two questions are open:
   - Does the plan match what the designer imagined?
   - Does it replace the opt-in feedback form, or do both go ahead?

   Once approved, it is one engine change plus a small layer per game.
2. **Gravity Golf Trials:** five-hole runs (never more than 10) under one rule (no landing, one shot per hole, no aim line, beat par, a stroke budget, a timer), with medals. Open question: a separate menu mode, or at the end of each sector?
   - If Trials go ahead, the "Read it" holes in the main course go and "no aim line" becomes a Trial rule. That settles the open "Read it vs Expert" question as option 1.
   - Trials need a PRD (v0.17).
3. **Arena, the designer's open calls** (2026-11-14):
   - the trial art picks from Pack 30 (suggested: target B, wheel C, fruit seller A);
   - how the range sketch felt (`docs/games/arena/sketches/range.html`): the shrink, the three misses, the sway, the wheel's speed. The answers set Step 27's numbers.
4. **The friendlies launch** (`docs/release-friendlies.md`). Still open:
   - the Gravity Golf "Read it" question (settled by item 2);
   - the feedback build (settled by item 1);
   - the release gate: `tools/release.sh v1.6`, smoke the release copies, and look at each game's first run.

## Later ideas the designer liked (not yet planned)

- **Arena:**
  - **Fall scenes when you lose:** spared, executed, or mauled by a beast, chosen by crowd favour and foe type. Needs art.
  - **Visuals to the next level:** hit feel, then light and colour per arena, then painted menus, then a living crowd, then more animation poses.
- **Fellowship across all games:** see item 1.
- **Expression:** thin outside Arena. For example, Ink colours, Launch critter looks, Recoil gun skins.
- **Before a public launch** (`docs/release-friendlies.md`, last section):
  - a clean public home, with the working repo made private;
  - the image-terms and trademark checks;
  - a privacy line;
  - a collection name.

## Spend so far

The token ledger (`docs/usage/README.md`) reads about US$2,080 API-equivalent. Art is in `docs/assets-ledger.md`, about US$50.
