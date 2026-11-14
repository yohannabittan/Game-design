# The process

From an idea to a game on your phone, built so that each step can be one-shotted and the iteration happens on content and numbers, not on plumbing.

```
idea ──► synthesis ──► concept card ──► PRD v0.1 ──► scaffold ──► build in layers ──► deploy ──► playtest ──► decide
  │                                                     ▲                                          │
  └──────────────── shelve (with a note) ◄──────────────┴──── evolve (PRD v0.2 delta) ◄────────────┘
```

Roles: you are the designer and the playtester. Claude sessions are the builder. The documents are the interface between the two, which is why they are strict.

## Stage 0. Capture

One row in `docs/game-ideas.md`: name, pattern, hook, kernel. Thirty seconds. If the kernel column will not fill, it stays a theme, not an idea.

## Stage 1. Synthesis and feedback

`templates/synthesis.md`, written by the orchestrator, read by the designer. Half a page: what you do, why it is fun, the mastery ladder, the one hard problem, the minimum lovable version, where it grows, and two to four questions whose answers change the design. The designer reacts in chat. That reaction is the input to the concept card, so a theme, the primary pressure, and the reward object are settled before anything is specified.

## Stage 2. Concept card

`templates/concept-card.md` into `docs/games/<slug>/concept.md`. Half a page. The point of the card is the gate at the bottom:

- Can you describe what happens in the first ten seconds?
- Can you write three tips that would make someone better at it?
- Can you say what a perfect play looks like versus a sloppy one?

Three yeses and it moves on. Any no and it goes back to the backlog with the missing answer noted.

Alongside the card, start `templates/world.md` as `docs/games/<slug>/world.md`, with at least the drive (what you do, why, for whom, how it ends) and the cast's names. It grows with the game. Every story card, voice line, flavour line and portrait brief comes from it, so names and personalities never drift (designer, 2026-10-04).

## Stage 3. PRD v0.1

`templates/prd-v0.1.md` into `docs/games/<slug>/prd-v0.1.md`. This is the one-shot contract. A builder session should be able to produce a playable game from this document plus the skeleton and nothing else. Every section is filled, the scope fence lists what is out, the acceptance criteria are testable, and the tuning table has numbers in it, even if they are guesses.

Rules of thumb for a good PRD:

- Describe behaviour, not implementation. "The ball slows on sand" not "multiply velocity by 0.9".
- Put every number in the tuning table. The builder copies it into `TUNING`.
- If a sentence contains "and also", it is probably two features. Cut one.
- The first three levels are the tutorial. Say what each one teaches.

## Stage 4. Scaffold

```
tools/new-game.sh gravity-golf "Gravity Golf" 22c55e
```

Copies the skeleton to `games/gravity-golf/`, stamps the name, generates placeholder icons, creates the PRD from the template, and registers the game in the launcher. Commit this before building.

## Stage 5. Build in layers

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

Content layers run as parallel shards once the mechanic has been played (ADR-0012): the orchestrator slices the PRD's content plan, several builders each verify their entries with the game's simulation harness, the orchestrator merges, and one reviewer checks the curve.

A PRD is frozen while a builder is running against it. Amendments found during the build (by the orchestrator, a reviewer or a playtest) are queued and applied between rounds, and the reviewer judges the build against the version the builder read. Otherwise a builder is failed for a rule it never saw, which happened once on Ink.

Merging content is a change like any other. Two rules learned from the first fifteen-stencil merge: if content is keyed by index in the save, any insertion or reorder ships with a save version bump and a remap, in the same commit; and a merged set is checked on the shortest supported phone (360 by 640) and on its heaviest entry for frame time before it ships, not only on the designer's device.

Why layers work for one-shots: each prompt has a small, closed target, a fixed contract (the engine), a spec (the PRD), and testable acceptance. The builder is never asked to invent scope, and a failure is contained to one layer.

## Stage 6. Deploy

Push to `main`. GitHub Pages serves the repo root. Open the game URL on the phone once, add it to the home screen, and it works offline from then on. Details, including how updates reach an installed game, in `docs/deploy.md`.

Every deploy-worthy change bumps `CACHE_VERSION` in the game's `sw.js` and adds a line to the game's `CHANGELOG.md`.

## Stage 7. Playtest

`templates/playtest-report.md` into `docs/games/<slug>/playtests/YYYY-MM-DD.md`. From the phone, the designer sends the five lines in `templates/playtest-quick.md`; the orchestrator writes the report from them the same hour, before touching a PRD, and every finding in it names the PRD section that answers it. Feedback that never became a report is a process failure (it happened on 2026-09-30). Three sessions minimum before deciding anything, at least one in airplane mode, at least one on a day you did not build. The report has a checklist and a commentary section; the commentary is the part that drives the next version. Write it right after playing, before reading the previous report.

Verification is sized to the risk (designer, 2026-10-02). Balance and pacing are judged with reasoning, heuristics and a few spot checks, not exhaustive sweeps. A harness check that runs longer than about two minutes needs a reason: it guards a hard must-hold (determinism, nothing stuck, no unwinnable level, no instant-loss unfairness) or it hunts a specific reported bug. Exhaustive sweeps become sampled ones (a few hundred cases, not every combination); the long checks that remain (Gravity Golf's two-shot search, Checkpoint's full suite) run once per release gate, not on every iteration.

Feel first (principle 12): a new mechanic or a mechanic rework ships first as a feel build for the dev channel, gated only by its must-holds, with TUNE presets; the designer tunes it on the phone; the balance pass follows and locks the numbers. Feel builds get a quick review (about 25 minutes, dev channel only); the full release gate is for the balance pass.

Experiment variables: when a change is a number nobody can pick by reasoning (a needle width, a gravity strength, a timer multiplier), the builder declares it in the game's `experiments` list with a range, and the build gets a TUNE tab on its menu with a slider per variable. Because raw sliders are hard to reason about, every experiment also ships three or four named presets, whole combinations with a feel name, as buttons above the sliders. The designer compares presets first, fine-tunes second, and reports the values that felt right in the playtest report; the PRD's tuning table takes those values and the experiment entry is removed.

## Stage 8. Decide

One of three:

- **Evolve.** Write `prd-v0.2.md` as a delta: what changes, what is added, what is cut, and which playtest finding each item answers. Build the next layer or re-run a layer with the delta. Repeat from stage 5.
- **Pivot.** The kernel is wrong but something in the build is right. New concept card, note what carries over, reuse the folder or fork it.
- **Shelve.** Move the row in `docs/game-ideas.md` to Shelved with one sentence. The code stays in the repo. No shame in it; this is what the mini-game step is for.

## Cost before rigour (2026-10-07)

The designer called out the Gravity Golf hole pipeline: "relying a bit too heavily on algorithms and simulation... there should be some heuristic ways to achieve the same goals way faster". The arena prototypes showed the other side: 11 rounds for about $16, judged by the designer's playtest.

Before writing an acceptance list, a shard brief or a review focus, the orchestrator asks of every check:

1. **What real failure has this check caught?** Name the bug, the hole or the playtest note. If nothing, it is a candidate to drop.
2. **What is the cheapest check that would catch that failure?** Prefer, in order:
   - **construction:** start from something proven;
   - **a geometric or arithmetic rule:** seconds;
   - **one scripted run:** seconds;
   - **a small sample:** tens of runs;
   - **a full search**, only when nothing above works.
3. **Does it run per attempt, or once?** Heavy checks run once per batch (a sector, a release), in the background, never inside an authoring loop.
4. **Is it judging a feeling?** Fun, difficulty and readability are judged by the designer's playtest and export. A simulation of a human is a guess, used only to set a starting point, as with the star bars in Recoil v0.8 B2.
5. **Is the thing shipped or thrown away?** Prototypes get the smoke test and a few scripted facts. Shipped games get a review. Neither gets proving it does not need.

**Red flags to raise with the designer before dispatching:**
- a per-item time-box over about 20 minutes;
- a check that takes longer than the change it checks;
- more than about 5 must-pass gates on one item;
- a search over thousands of shots or seeds inside a loop;
- a "noisy human" model standing in for a playtest the designer could do in two minutes.

Say the cost in one line, with the cheaper alternative, and let the designer choose.

## Sketch before build (2026-11-14)

The designer: "If we can think of a little way to visualise things before putting them into a full build and playtest, it may be a more efficient way to build." A build plus a playtest costs about an hour and a round trip, and too many Arena rounds were spent finding out that something looked or felt wrong (the double arms, the slash that reads as nothing, the overhead that lunges).

**When:** a step whose open question is *how it will look or feel*: a visual, an effect, an animation, a screen layout, a new weapon's motion. Logic, numbers and economy go straight to the PRD.

**The cheapest form that answers the question:**

| Form | For | Time |
| --- | --- | --- |
| **a still mock frame** (one PNG of the screen) | layouts, cards, HUD, text amounts | about 10 min |
| **a GIF of the moment** (`node tools/sketch.mjs page <file.html> <out.gif>` records a sketch page; `frames <dir> <out.gif>` encodes frames of the real game) | motion, effects, animation, "what does a slash look like" | about 20 min |
| **a tiny interactive page** the designer touches on the phone | control feel: gestures, timing, aiming | about 30 min |

**How:**
- **Who:** a Sonnet agent, working in the scratchpad, as a throwaway. It's never shipped and never reviewed; it isn't the game.
- **The flow:** draft the PRD step, sketch, send it to the designer, take the reaction, lock the step, build.
- **The handoff:** the builder's brief carries the picked sketch as the target ("make it look like this"). A kept sketch goes in `docs/games/<slug>/sketches/` (small files only; the repo is public).
- **Time-box:** a sketch is 20 to 30 minutes. One that needs more means the question is too big; split it.
- **Built work:** for something already built, record a GIF of the real game (frames from a check script, then `node tools/sketch.mjs frames`) instead of stills whenever the thing in question moves.
- **Which proof for which question** (the designer, 2026-11-14: "I like that you can use images, GIFs or full playtests to test things"):

  | The question | The proof |
  | --- | --- |
  | Does it look right, standing still? (a layout, a card, art) | a still |
  | Does it move and land right? (a blow, an effect, a swap) | a GIF |
  | Does it feel right in the hand? (aim, timing, a gesture) | a touchable page, then the designer's playtest |
  | Is it fun, fair, the right length? | the designer's playtest and its export; nothing else answers this |
  | Did anything change that shouldn't have? | a scripted check, or a replay (the replay tool of ADR-0024, once it lands) |

  Use the cheapest one that answers the question, and say which one was used when reporting a build.

## Keep the method alive (2026-11-14)

The designer: "How can we improve this in the future and not let the tools and methods go out of date?" Arena's hand-written code map sat stale for 30 builds, and the orchestrator's handoff sat 18 versions behind, because keeping them true was a chore someone had to remember.

**1. If it can rot, generate it or test it.** A fact about the repo is never kept by hand when a tool can produce it or check it:
- **generated:** the code index (`tools/codemap.mjs`), the usage ledger (`tools/usage.py`);
- **checked:** `tools/docs-check.mjs` (paths named in `CLAUDE.md` exist, every ADR is indexed, every shipped version is in its changelog, the handoff isn't behind the games, every tool is explained) and the recipes' names. Both run inside `npm run smoke`.
- **A new document that states facts about the code gets its check in the same change,** or it isn't written.

**2. A retro every ten builds or two weeks, whichever comes first,** fifteen minutes, written to `docs/retros/<date>.md` from `templates/retro.md`:
- **The numbers** from the ledger: tokens per build, builds that passed review first time, rounds per step. Better or worse than the last retro?
- **The docs check's warnings,** and what the builders "had to hunt for".
- **What the designer had to say twice.** A thing repeated is a missing rule or a missing check.
- **Out of it come at most three changes, and at least one removal.**

**2b. The people who use an instruction report on it.** A check can tell when a document names something that's gone; it can't tell when an instruction is simply wrong. So:
- every agent's report says what in its card or brief was wrong, missing or out of date (`docs/team.md`);
- **one home per fact:** a brief that has to repeat or correct a card means the card gets fixed in the same turn;
- at each retro the cards are read through once against how the last builds were actually run, and the team file's review date is moved. The docs check warns when that date is more than 30 days old.

**3. Rules retire.** Every rule in `CLAUDE.md` and this file carries the date it was made. At a retro, a rule that didn't matter since the last one is cut or folded into another. A longer rulebook is read less.

**4. When the model changes, question the scaffolding.** Much of the method exists to make up for what a model couldn't do: narrow briefs, one file per layer, heavy checks. A stronger model may not need a guard, and a guard nobody needs is cost. At the first retro after a model change, name one guard to try without, and say what would bring it back.

**5. The designer's friction is the trigger.** "Builders are slow", "I can't tell what a slash is", "it got stuck" start a method change the same day; they don't wait for a retro.

## Guard rails from the 2026-11-14 review

The orchestrator listed the process's weaknesses and the designer said: "I like all of these; you should do them." Each rule below answers one weakness, with the evidence for it.

**1. A build that changes how the game is played is verified by someone who didn't build it.**
- **Why:** builders wrote their own checks and chose their own frames, and the orchestrator reviewed from those. Four bugs got through builds that "passed review first time": the double arms (twice), a stuck training step, knives nobody could learn, a jab that fell short on the designer's phone.
- **The rule:** any build that changes controls, the first run, or the save gets a **Verifier** (`docs/team.md`): a fresh agent that writes its own checks from the PRD's acceptance list without reading the builder's, tries to break the build, and watches it move. The build lands when the verifier's report is clean, or the orchestrator says in the changelog what it accepted and why.
- **The number that counts** at a retro is bugs the designer found in play, not builds that passed first time.

**2. Checks are kept and re-run.**
- **Why:** each build's scripted checks lived in a temporary folder and never ran again, so nothing re-tested the training yard when the bow went in.
- **The rule:** each game with scripted checks keeps a permanent suite under `tools/checks/`. Every build adds its step's key checks to the suite, and the whole suite passes before a build lands. A replay of recorded runs (ADR-0024) is part of it.

**3. New eyes on every release.**
- **Why:** the designer is the only regular tester and is now skilled (24 of 31 blocks perfect in the v66 run). The one newcomer lost by bout 4 and couldn't read the cards.
- **The rule:** each friends' release gets at least one session from someone new, filed under `docs/playtests-external/`. A difficulty or price change cites a newcomer's export, or says it's a guess.

**4. A playtest gate on new features.**
- **Why:** six features landed between two playtests, about fifteen more were queued, and the sidearm went unused for three runs.
- **The rules:**
  - **At most two feature builds may be landed and unplaytested.** After that, only fixes and work on the core (feel, onboarding, polish) start until the designer has played.
  - **A feature is done when it shows up in a playtest's export,** not when it lands.
  - **A feature unused in three playtests** goes to the retro: fold it into something, change it, or cut it.
  - **The queue shows the next five steps.** Everything else lives in an ideas list, unordered.

**5. One document says what the game is today.**
- **Why:** Arena's PRD is 2,368 lines and 45 steps, later ones overriding earlier ones.
- **The rule:** `docs/games/<slug>/RULES.md` states the game as it stands: the controls, the systems, the numbers that matter, the modes. Every landing updates it. PRD steps are change requests against it, and from now on each new step is its own short file under `docs/games/<slug>/steps/`.

**6. A stable copy always exists.**
- **Why:** every push went straight to the build the designer plays, and the friends' release sat a month and dozens of versions old.
- **The rule:** a friends' release is cut from the last playtested build after each playtested milestone, and at least every two weeks. The release gate includes loading a save from the previous release through every migration since.

**7. The flagship is a decision, written down.**
- **Why:** the repo's aim is small games built a layer at a time; Arena is 11,000 lines and the other five games haven't moved since mid-October.
- **The rule:** `docs/HANDOFF-orchestrator.md` says which game is the flagship and what state the others are in (frozen, maintained, or next), by the designer's word. It's revisited at each retro.

**8. The process stops changing until it's measured.**
- **Why:** seven process changes landed on 2026-11-14 and none is proven.
- **The rules:**
  - **No new process tools or rules until the next retro** (2026-11-28), except a fix for friction the designer names.
  - **Before saying yes to an idea, the orchestrator says its cost or its risk in one line.** A plain yes is not an answer.

**9. Decisions waiting on the designer are few and in one place.**
- **Why:** open questions piled up at the bottom of long messages.
- **The rule:** the open decisions live in the handoff's "Waiting on the designer". The orchestrator asks at most three at a time, at the top of a message, each with its recommended answer.

## Always

- **ADRs.** Any decision about how games are built, not what a game is, gets an ADR in `docs/adr/`. Changing the engine contract, adding a dependency, changing the deploy path, changing the save format policy. See `docs/adr/README.md`.
- **Changelog per game.** `docs/games/<slug>/CHANGELOG.md`, one line per deploy.
- **Smoke test.** `npm run smoke` passes before every push. It loads every game at phone size and fails on any console error, missing asset, or service worker failure.

## Cadence that works

One game per week at v0.1 is realistic: a concept card and PRD in one sitting, layers 1 to 3 in one or two sessions, a few days of playing it at odd moments, then a decision. Do not start a second game's layer 4 before the first game's decision. Progression built on an unproven kernel is the most common waste in this kind of project.
