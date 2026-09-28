# The process

From an idea to a game on your phone, built so that each step can be one-shotted and the iteration happens on content and numbers, not on plumbing.

```
idea ──► concept card ──► PRD v0.1 ──► scaffold ──► build in layers ──► deploy ──► playtest ──► decide
  │                                                     ▲                                          │
  └──────────────── shelve (with a note) ◄──────────────┴──── evolve (PRD v0.2 delta) ◄────────────┘
```

Roles: you are the designer and the playtester. Claude sessions are the builder. The documents are the interface between the two, which is why they are strict.

## Stage 0. Capture

One row in `docs/game-ideas.md`: name, pattern, hook, kernel. Thirty seconds. If the kernel column will not fill, it stays a theme, not an idea.

## Stage 1. Concept card

`templates/concept-card.md` into `docs/games/<slug>/concept.md`. Half a page. The point of the card is the gate at the bottom:

- Can you describe what happens in the first ten seconds?
- Can you write three tips that would make someone better at it?
- Can you say what a perfect play looks like versus a sloppy one?

Three yeses and it moves on. Any no and it goes back to the backlog with the missing answer noted.

## Stage 2. PRD v0.1

`templates/prd-v0.1.md` into `docs/games/<slug>/prd-v0.1.md`. This is the one-shot contract. A builder session should be able to produce a playable game from this document plus the skeleton and nothing else. Every section is filled, the scope fence lists what is out, the acceptance criteria are testable, and the tuning table has numbers in it, even if they are guesses.

Rules of thumb for a good PRD:

- Describe behaviour, not implementation. "The ball slows on sand" not "multiply velocity by 0.9".
- Put every number in the tuning table. The builder copies it into `TUNING`.
- If a sentence contains "and also", it is probably two features. Cut one.
- The first three levels are the tutorial. Say what each one teaches.

## Stage 3. Scaffold

```
tools/new-game.sh gravity-golf "Gravity Golf" 22c55e
```

Copies the skeleton to `games/gravity-golf/`, stamps the name, generates placeholder icons, creates the PRD from the template, and registers the game in the launcher. Commit this before building.

## Stage 4. Build in layers

Each layer is one prompt, one session, one file (`src/game.js`). Between layers you play it on the phone. Layers 1 to 3 are what v0.1 usually needs; the rest come after the delight test passes.

| Layer | Prompt | Produces | Done when |
| --- | --- | --- | --- |
| 1. Mechanic | `prompts/01-mechanic.md` | Grey-box playable: the verb, the physics, one level, score, restart | You can feel the skill axis |
| 2. Content | `prompts/02-content.md` | The v0.1 level or wave set as data, the difficulty curve, boss beats | Second half needs a tip the first half did not |
| 3. Juice | `prompts/03-juice.md` | Hit and miss feedback, particles, shake, tweens, sound mapping | Hits feel good with eyes closed and sound off, separately |
| 4. Progression | `prompts/04-progression.md` | Stars, unlocks, badges, save shape, the naked-run guarantee | A reason to replay a cleared level |
| 5. Art | `prompts/05-art.md` | Palette, shapes with character, or sprites if the game earned them | It looks like one thing |
| 6. Audio | `prompts/06-audio.md` | Synth sound set with identity, or asset hooks | You can name the game from the sounds |
| 7. Modes | `prompts/07-modes.md` | Daily seed, endless, time attack, zen, challenges | Same mechanic, different session |

How the prompts are used (ADR-0010): the orchestrator session, the one you talk to, hands the layer prompt to a builder sub-agent on a cheaper, faster model (Sonnet by default, Opus for feel-critical layers). The builder reads the PRD and skeleton itself, writes `game.js`, and runs the smoke test. A reviewer sub-agent with fresh context then checks the output against the PRD, the principles and the repo rules using `prompts/08-review.md`, and reports. The orchestrator accepts, sends the findings back to the builder, or fixes the document. Then you play it on the phone. Builders for different games can run in parallel; layers on one game are sequential because they rewrite one file. You can also run a prompt by hand in a session if you want to watch.

Why layers work for one-shots: each prompt has a small, closed target, a fixed contract (the engine), a spec (the PRD), and testable acceptance. The builder is never asked to invent scope, and a failure is contained to one layer.

## Stage 5. Deploy

Push to `main`. GitHub Pages serves the repo root. Open the game URL on the phone once, add it to the home screen, and it works offline from then on. Details, including how updates reach an installed game, in `docs/deploy.md`.

Every deploy-worthy change bumps `CACHE_VERSION` in the game's `sw.js` and adds a line to the game's `CHANGELOG.md`.

## Stage 6. Playtest

`templates/playtest-report.md` into `docs/games/<slug>/playtests/YYYY-MM-DD.md`. Three sessions minimum before deciding anything, at least one in airplane mode, at least one on a day you did not build. The report has a checklist and a commentary section; the commentary is the part that drives the next version. Write it right after playing, before reading the previous report.

## Stage 7. Decide

One of three:

- **Evolve.** Write `prd-v0.2.md` as a delta: what changes, what is added, what is cut, and which playtest finding each item answers. Build the next layer or re-run a layer with the delta. Repeat from stage 4.
- **Pivot.** The kernel is wrong but something in the build is right. New concept card, note what carries over, reuse the folder or fork it.
- **Shelve.** Move the row in `docs/game-ideas.md` to Shelved with one sentence. The code stays in the repo. No shame in it; this is what the mini-game step is for.

## Always

- **ADRs.** Any decision about how games are built, not what a game is, gets an ADR in `docs/adr/`. Changing the engine contract, adding a dependency, changing the deploy path, changing the save format policy. See `docs/adr/README.md`.
- **Changelog per game.** `docs/games/<slug>/CHANGELOG.md`, one line per deploy.
- **Smoke test.** `npm run smoke` passes before every push. It loads every game at phone size and fails on any console error, missing asset, or service worker failure.

## Cadence that works

One game per week at v0.1 is realistic: a concept card and PRD in one sitting, layers 1 to 3 in one or two sessions, a few days of playing it at odd moments, then a decision. Do not start a second game's layer 4 before the first game's decision. Progression built on an unproven kernel is the most common waste in this kind of project.
