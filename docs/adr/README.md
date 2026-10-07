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
| [0014](0014-tune-panel-persistence.md) | The tune panel restores only declared keys, prunes the rest; Reset restores every declared key | accepted |
| [0015](0015-generated-assets.md) | Generated image assets carry one style anchor per game and a cost ledger | accepted |
| [0016](0016-release-channel-and-playtest-ledger.md) | A release channel beside the dev channel, and a local playtest ledger with export | accepted |
| [0017](0017-scoped-cache-cleanup-and-passive-toasts.md) | Service workers clean up only their own game's channel; a toast without an action lets touches through | accepted |
| [0018](0018-network-first-service-worker.md) | Service workers are network first, and games check for updates when they come back to the front | accepted |
| [0019](0019-matched-menu-tabs.md) | The menu's TUNE and EXPORT tabs share one size and one top line | accepted |
