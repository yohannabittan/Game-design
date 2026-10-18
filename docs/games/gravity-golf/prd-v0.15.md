# Gravity Golf PRD v0.15: every stroke counts, and the Labyrinth

Status: locked 2026-10-18 by the designer ("Go for gg"), all at once. It builds on v0.14 with A2.

**Draft 2, the designer:**
- "I think you should be able to return to tee for an extra stroke, and that you can only retry from zero strokes after sinking it, on the score screen."
- "We kind of need to use more mechanics, like maybe walls that the ball can't go through, to make mazes you need to shoot into."

**What the designer said:** "It's too easy. It feels like it's just about finding the angle, and I can always do it in 1 shot." And: "The whole game feels too easy, to be honest."

**What the export shows (2026-10-18, 200 entries):**
- The usual pattern is a shot, Retry, a shot, Retry, then a hole-in-one. For example: hole 1 blind took 8 retries; hole 31 took 18 retries over two sittings; hole 38 took 7 retries.
- A Retry costs nothing, so the three stars only ask you to find the angle eventually.
- 20 of the 40 holes give three stars for 1 stroke.
- The cup is generous: it pulls a ball in from 44 units at up to 380 units per second. So a near miss often drops.

## A. Every stroke counts (the designer's rule)

- **"Back to tee" replaces the HUD's Retry.**
  - It puts the ball back on the tee for one penalty stroke (`T.teePenalty` 1).
  - The strokes already played stay on the count.
  - The button reads "Tee +1".
- **A fresh start from 0 strokes is only on the score screen,** after you have sunk the hole: the end card's Retry, as now.
- **Leaving for the menu keeps the count.** An unfinished hole's strokes are saved and still there when you come back, so quitting is never a free restart (the simplest way to keep the rule whole).
- **The HUD shows the strokes so far,** and the end card adds "(including 2 tee penalties)" when there were any.
- **Blind tries:** the same rule, with their own count.
- **Runs (the full-run counter):** unchanged, since a run already counts every stroke. "Tee +1" adds its stroke there too.
- **Stars and bests already earned stay** (they can never go down), and the rank ladder is unchanged.

## B. A tighter cup

- `captureR` goes from 44 to about 32, and `sinkSpeed` from 380 to about 320 (both in TUNING), so a near miss no longer drops and the line must be true.
- **The lean check, once for all 40 holes:** `sim-golf --three` at one frame rate plus jitter.
  - Any hole whose three-star route then fails is nudged: its cup moves a few units, or a body moves.
  - It is never re-authored.

## C. Angled walls

- **A wall may now be a segment at any angle:** `{ type: 'seg', a: { x, y }, b: { x, y }, w }`, a bar of width `w` with round ends.
  - The ball bounces off it with `wallBounce`, as off the existing rectangle walls.
  - The aim preview and `sim-golf` run the same physics.
  - It is drawn in the walls' slate.
- **Why:** mazes need diagonal corridors and banks, not only boxes.

## D. Sector 9, "The Labyrinth": holes 41 to 45 (new)

The cup sits inside walls with few ways in, so you plan a route, often with a rest on the way. Three stars always take at least 2 strokes.

- **41 The Door (tutorial).** The cup is in a walled pocket with one opening, facing away from the tee. Bank in, or curve in round a planet.
- **42 Corridor.** A long bent corridor with a planet at the bend. Its pull carries the ball round the corner if the speed is right.
- **43 Two Rooms.** The cup's room is reached only from a second room. Rest in the first room, then shoot through the door.
- **44 Sliding Door.** A mover opens and shuts the maze's only door.
- **45 Minotaur (boss).** A full maze around a sun. The sun's pull is the way through, and its touch is the danger.

**Dressing:**
- the arrival log: "Log: walls out here. Someone built them.";
- Sam's pool:
  - "Find the way in, Lumen."
  - "Patience. One room at a time."
  - "Who builds walls in space?"
- **Probe Log fact:** the reviewer checks it against a general reference.
- **Menu tiles:** they show a small maze, and the grid fits 45.

**The lean checks per hole:** as v0.14 C, with `--three` showing the route needs every one of its strokes (a 1-stroke sweep of 60 shots never sinks).

## E. Saves

`saveVersion` 12 adds `visit` per hole (the strokes of an unfinished hole). `migrate` sets every hole's to 0.

## F. Out of scope

- the aim preview (the blind fourth star already hides it);
- star counts for holes 1 to 40;
- the zones on the roadmap.

## G. Acceptance

- "Tee +1" adds a stroke and keeps the count; leaving and coming back keeps it; only the end card's Retry starts from 0.
- Angled walls bounce as rectangle walls do, and the game and `sim-golf` agree at 30, 60 and 144 fps.
- Every new hole passes the lean checks.
- The menu fits 45 tiles at 375x667.
- Every hole's three-star route still sinks with the tighter cup (`sim-golf --three`).
- `npm run smoke` passes.
- Difficulty and feel are judged by the designer's playtest.

## H. How it is built

1. **One mechanic build (Opus,** since it touches the physics). It covers A, B and C, hole 41, the dressing and `sim-golf`. It also runs the 40-hole check for B.
2. **Two content shards (Sonnet):** 42 and 43, then 44 and 45.
3. **One push** once all five holes are in.

**Rough cost:** about $20 to $25 in all.
