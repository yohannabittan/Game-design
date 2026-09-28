# Architecture decision records

Every decision about how games are built gets a short record here. Not decisions about what a game is (those live in the game's PRD), but decisions that constrain every builder session: runtime, delivery, input, persistence, repo shape, process.

Why: builder sessions start fresh. An ADR is how a decision made in one session survives into the next without being re-argued or silently reversed. It is also how you, later, remember why the odd-looking choice was made.

When to write one:

- Changing the engine contract in `skeleton/src/engine.js`
- Adding a dependency, a build step, or a framework
- Changing how games are deployed or installed
- Changing the save format policy
- Changing the process (layers, gates, templates)
- Any time a builder session wants to deviate from an accepted ADR

How: copy `templates/adr.md` to `docs/adr/NNNN-short-title.md` with the next number, fill it in, and link it from the list below. Superseding an ADR means writing a new one and marking the old one superseded, never editing history.

## Index

| # | Decision | Status |
| --- | --- | --- |
| [0001](0001-record-decisions-as-adrs.md) | Record architecture decisions as ADRs | accepted |
| [0002](0002-plain-canvas-and-vanilla-js.md) | Plain HTML5 Canvas and vanilla JavaScript, no engine, no build step | accepted |
| [0003](0003-pwa-offline-first.md) | Deliver as an offline-first web app installed to the home screen | accepted |
| [0004](0004-touch-first-portrait.md) | Touch-first, portrait, one thumb; keyboard is a fallback | accepted, amended by 0013 |
| [0005](0005-local-only-persistence.md) | Local-only persistence in localStorage with versioned migrations | accepted |
| [0006](0006-copy-the-skeleton-per-game.md) | One repo; each game is a copy of the skeleton, not an import | accepted |
| [0007](0007-build-in-layers-one-shot-each.md) | Build in layers, one one-shot prompt per layer, game.js is the unit | accepted |
| [0008](0008-random-setup-deterministic-resolution.md) | Randomness only in setup, never in resolution; all randomness is seeded | accepted |
| [0009](0009-deploy-via-github-pages.md) | Deploy by pushing to main; GitHub Pages serves the repo root | accepted |
| [0010](0010-orchestrator-and-worker-models.md) | A top-tier model plans and reviews; cheaper, faster models build layers as sub-agents | accepted |
| [0011](0011-engine-change-policy.md) | Additive engine changes need a README entry; behavioural changes need an ADR | accepted |
| [0012](0012-content-sharding-and-physics-kits.md) | Content layers are built in parallel shards; physics lives in per-family kits with a harness | accepted |
| [0013](0013-orientation-per-game.md) | Orientation is a per-game PRD decision; portrait is the default | accepted, amends 0004 |
