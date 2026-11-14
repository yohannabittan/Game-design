# The check suite

Each game with scripted checks keeps them here, and every build re-runs all of them (`docs/process.md`, "Guard rails", rule 2).

```
npm run check arena                  # every file in tools/checks/arena/, four at a time (about 70 s)
npm run check arena yard strike      # only those files
node tools/checks/run.mjs arena replays --accept   # store new replay hashes (see below)
```

One line per check, `ok`, `FAIL` (with what was expected and what happened) or `KNOWN`, then a count. It exits 1 on any `FAIL`.

## Exact, not timed

Every check runs on `tools/replay.mjs`'s fake clock (`exact.mjs`): time, frames and `Math.random` are made exact before the game loads, and a check steps frames itself and sends pointer events between them. Nothing waits on real time, so a check gives the same answer every run. Don't use `setTimeout`, `g.wait` or real-time thumb paths here; use `g.frames(n)`, `g.until(() => cond)`, `g.tap`, `g.stroke` (see the top of `exact.mjs`). A thumb that lifts ends the blow, so end a stroke with a few frames of rest, as a thumb does.

## Adding checks

A builder adds its step's key checks in the same build, to the feature's file or a new one (`tools/checks/<slug>/<feature>.mjs`; a name starting with `_` is skipped). A file exports `default async function (t)`:

- `t.boot({ w, h, save, raw })` opens the game (`raw: { __v, data }` writes a save as stored, so `migrate` runs); each one is closed and its console checked for errors at the end;
- `t.ok(what, cond, detail)`, `t.eq(what, got, want)`, `t.is(what, got, pred, want)`;
- `t.known(what, cond, detail)` for a bug reported and not yet fixed: shown as `KNOWN`, not a failure, until it passes.

Keep a handful per feature, the ones that would catch a real regression. Cover the edges as well as the middle: each phone size (667x375, 844x390, 874x402), against a wall, and sloppy input (short, slow, hurried, repeated strokes) beside the clean one. A check that can't be made exact isn't added.

## The replays

`replays` plays the three recorded runs in `tools/checks/replays/` twice each: the two dumps must match, and their hash must match the one stored in `<name>.hash`. A build that isn't meant to change play never touches the hashes. A build that is meant to (a new number, a new rule) runs `--accept` once its other checks pass, and says so in its report and the changelog line. The hashes are of this machine's dumps; text measured by another machine's fonts may differ.
