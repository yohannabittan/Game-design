# Art pass brief (for the session that holds the image key)

You are a Claude Code session with `OPENAI_API_KEY` in your environment, opened on this repository to generate image assets for the game library. A separate orchestrator session runs the game builds; this file is your whole handoff. Read it, then `CLAUDE.md`, then `docs/adr/0015-generated-assets.md` (the rules you work under).

## The designer

Yohann, a CPO who does not code. He plays the games on his iPhone from a home-screen icon, offline. He picks; you propose. Show him options before anything is wired in.

## First checks (do these before anything else)

1. Confirm the key without revealing it: `[ -n "$OPENAI_API_KEY" ] && echo present || echo missing`. Never print, log, echo, commit or write the key to any file. If it is missing, say so and stop.
2. Confirm the image host is reachable through the proxy (a tiny, cheap request). If it is blocked, say so and stop; the designer fixes network access in the environment settings.
3. The designer's Claude plan was near its weekly limit on 2026-10-02 (resets Monday evening). Keep your own work lean: write small scripts, no long loops.

## Rules (from ADR-0015, summarised)

- **One style anchor per game:** `docs/games/<slug>/style.md`. Every prompt is the anchor verbatim, then the subject, then the technical spec. Nothing else.
- **Ledger:** append every generation to `docs/assets-ledger.md` (date, game, subject, size, quality, cost estimate, kept or discarded, path, the full prompt). Stop when the ledger reaches the budget below.
- **Budget for this first pass: US$15 total** on the OpenAI account, unless the designer raises it.
- **Images are for things you look at, never for things you play with.** Titles, portraits, backdrops, icons, medals, menu art: yes. Anything moving, hit-tested or physics-driven (the mochi in flight, targets, planets, jellies, items on the X-ray belt): no, those stay procedural canvas (their drawn shape is their hitbox, design principle 14).
- **Technical:** sprites are transparent PNG (or WebP), backgrounds opaque; size each to its on-screen use at 3x phone density, no larger; a game's `assets/` folder stays under 1.5 MB; nothing private or copyrighted in prompts (the repo is a public website). Recoil uses parody names only, no real film titles, actors or logos.
- **Do not edit any `games/<slug>/src/game.js`.** Wiring images into a game is a build layer the orchestrator dispatches (prompt `prompts/05-art.md`, which allows `games/<slug>/assets/` and the `sw.js` cache list). Your job ends at chosen files in the repo plus the ledger.

## What to make first (two packs)

### Pack 1: Recoil "Backlot 88" movie-prop guns

Anchor: `docs/games/recoil/style.md`. Context: `docs/games/recoil/prd-v0.6.md` (the guns and their parody names). One side-view gun per prop, transparent background, facing right, about 512 px wide, matching the procedural silhouettes' proportions:

| File | Gun | Look |
| --- | --- | --- |
| `gun-buddy-cop.png` | Buddy-Cop 9mm | a classic black service pistol |
| `gun-pulse-rifle.png` | Pulse Rifle | a chunky sci-fi rifle with a big ammo counter |
| `gun-spin-lever.png` | Spin-Lever Shotgun | a lever-action shotgun with a big loop lever |
| `gun-assassins-scope.png` | Assassin's Scope | a long marksman rifle with a scope |
| `gun-one-man-army.png` | One-Man Army SMG | a compact submachine gun |
| `gun-make-my-day.png` | Make-My-Day .44 | a long-barrelled revolver |

Plus `title-backlot88.png`: the studio-logo title card "RECOIL, a Backlot 88 production" (about 1024 x 384, transparent).

### Pack 2: Ink title

Anchor: `docs/games/ink/style.md`. Context: `docs/games/ink/prd-v0.6.md` line on the title. `title-ink.png`: the word INK as an ornate tattoo-script logo (blackletter meets calligraphy, flourishes, a banner or swallow or rose allowed), transparent, about 1024 x 512, plus a half-size copy.

## Process

1. Generate **three options** per asset at medium quality (cheap), into `docs/art/candidates/<slug>/` (not under `games/`).
2. Make one **contact sheet** per pack (a single PNG grid with each option labelled, for example "gun-pulse-rifle A / B / C") at `docs/art/candidates/<slug>/sheet.png`, commit and push, and give the designer its link: `https://yohannabittan.github.io/Game-design/docs/art/candidates/<slug>/sheet.png` (the branch is published by GitHub Pages; allow a minute after the push).
3. When he picks, regenerate only the picks at high quality if needed, save them to `docs/art/final/<slug>/` with the file names above, delete the unpicked candidates, update the ledger, commit and push.
4. Tell the designer it is ready for wiring, and that the orchestrator session builds it into the game (he can tell that session: "the art pack for <game> is in docs/art/final/<slug>").

## Git

- Branch: `claude/flash-game-dev-process-v7yrbe` only; never another branch, never a pull request.
- Push with `git push -u origin claude/flash-game-dev-process-v7yrbe`; on a network error retry up to four times with backoff (2, 4, 8, 16 s).
- Commit only `docs/art/` and `docs/assets-ledger.md`. Another session may have uncommitted game work in its own container; you are in a fresh container, so pull first (`git pull origin claude/flash-game-dev-process-v7yrbe`) and keep your commits to those paths.
- End every commit message with:

  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```
  and the `Claude-Session:` line for your own session.
