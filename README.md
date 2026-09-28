# Game Design

A library of small, phone-first, offline-capable skill games, and the process for getting each one from a note to a playable v0.1 in one session per layer.

The idea: the best Flash games had one simple mechanic with real depth. Build that kernel first, with one prompt per layer, deploy it to a home-screen icon, play it on a plane, and only then decide whether to grow it. Iteration goes into content and numbers, not plumbing.

## The loop

```
idea ──► concept card ──► PRD v0.1 ──► scaffold ──► build in layers ──► deploy ──► playtest ──► evolve / pivot / shelve
```

Full description in [`docs/process.md`](docs/process.md).

## Start here

| Want to | Read |
| --- | --- |
| Understand the rules every game follows | [`docs/design-principles.md`](docs/design-principles.md) |
| Know what a v0.1 must contain | [`docs/minimum-lovable-product.md`](docs/minimum-lovable-product.md) |
| Pick a mechanic | [`docs/pattern-library.md`](docs/pattern-library.md) |
| See the backlog and the recommended first three | [`docs/game-ideas.md`](docs/game-ideas.md) |
| Build a game | [`docs/process.md`](docs/process.md), then [`prompts/`](prompts/) |
| Put it on your phone | [`docs/deploy.md`](docs/deploy.md) |
| Know why things are the way they are | [`docs/adr/`](docs/adr/README.md) |
| Know the engine API | [`skeleton/README.md`](skeleton/README.md) |

## Quick start for a new game

```
tools/new-game.sh gravity-golf "Gravity Golf" 22c55e   # scaffold from the skeleton
# fill docs/games/gravity-golf/prd-v0.1.md
# paste prompts/01-mechanic.md into a Claude Code session
npm run smoke                                          # boots every game headlessly, fails on any error
git push                                               # GitHub Pages serves it; add to home screen
```

## Stack

Plain HTML5 Canvas and vanilla JavaScript. No framework, no build step, no runtime dependencies. Each game is a self-contained folder with its own service worker, so it installs to the home screen and plays offline. Saves are local. Decisions are recorded in `docs/adr/`.

## Layout

```
docs/          process, principles, patterns, backlog, ADRs, per-game PRDs and playtests
templates/     concept card, PRD, playtest report, ADR
prompts/       one prompt per build layer
skeleton/      the template every game is copied from (engine + demo game)
games/         one folder per game
tools/         new-game.sh, make-icons.py, smoke.mjs
index.html     the library launcher (GitHub Pages root)
```
