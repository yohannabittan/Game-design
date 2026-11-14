# What Arena has taught us, and where it goes

Arena is the flagship (the designer, 2026-11-14): "The other ones are more mini games; this is more complex and rich, but I still want us to take learnings from this to past and future games." This file lists what was learned, where each lesson now lives, and what it would mean for the five mini games. It's read when a new game starts and when a mini game is picked up again.

## For the player

| Lesson | Where it lives now | In the mini games today |
| --- | --- | --- |
| The first minute teaches by doing, one verb at a time | `docs/design-principles.md`, 18 | not checked: none has had a newcomer's first minute watched |
| Hints of eight words, cards and tiles of six | principles 18 and 11 | Ink set the tile standard; the others' hints are not audited |
| A try that doesn't count says why | principle 18 | not known |
| Each verb looks and sounds like itself; the best outcome is the loudest | principle 19 | Recoil's shots and Launch's bounces are the likeliest to gain |
| One tap means done | principle 20 | not audited |
| The pull is the measure; read it off the export | principle 21 | every game has the export; none has been read for pull |
| A sensible default and one warning for a newcomer | principle 18 | not audited |
| Painted art, added by inpainting onto the part itself | `docs/art/BRIEF.md`, Packs 26b to 28 | Ink and Recoil have painted art; the method is there for more |

## For how we build

| Lesson | Where it lives now | Works for every game? |
| --- | --- | --- |
| Sketch before build: a still, a GIF or a touchable page | `docs/process.md`; `tools/sketch.mjs` | yes |
| The designer is the first player; fun decides the order | `CLAUDE.md`, "Who this is for" | yes |
| A generated code index and a lookup | `tools/codemap.mjs <slug>` | yes: one command writes any game's index |
| Checks that are kept and re-run on a fake clock | `tools/checks/`, `tools/replay.mjs` | the replay tool takes any game; each game needs its own scripts |
| A verifier who didn't build it | `docs/team.md` | yes |
| A release from the last played build, with old saves loaded | `docs/release-friendlies.md` | yes: v1.6 gated all six |
| The export records each feature's use, the tutorial included | Arena's export fields | the engine's ledger is shared; each game chooses its fields |
| New features in their own module | ADR-0024 | only a game that outgrows one file |

## What it would mean for the mini games (not started; the designer's call)

1. **A first-minute look at each,** by a fresh agent playing a new save and holding it against principles 18 to 21: the three cheapest fixes per game. About a helper's job each.
2. **A lesson helper in the shared skeleton** (steps, a ghost thumb, why-words), so any game can teach its verb the way Arena's yard does. An engine change, so it needs an ADR.
3. **Pull in every export:** runs per sitting and retries after a loss, so the next retro can say which mini game people come back to.

Nothing here is scheduled. When the designer picks a mini game up again, start from this list.
