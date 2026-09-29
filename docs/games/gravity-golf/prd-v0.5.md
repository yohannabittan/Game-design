# Gravity Golf PRD v0.5: a run you can read, heavier suns, sectors and more holes

Status: locked 2026-09-30. Builds on v0.4. Source: the designer's second playtest (full stars on all fifteen holes; two badges unexplained; retry not found; wants bigger holes, more content, cooler backdrops, modes).

## A. Legibility of the run and the badges

- Retry: the button under the HUD gets a label ("Retry") and reads as a button at rest; the end card gains Retry beside Next and Menu.
- Run counter: during a full run the HUD shows "Run: 14 strokes" and, on the missions screen, Under Par shows "best run 31, need 29 or fewer". Never Landed shows a live mark on the HUD during a run ("no landings yet" turning to "landed on hole 4") and its missions tile says exactly what counts: resting on a planet or moon at any point in the run.
- Rule for every badge: its tile shows progress toward it (a count, a best, or the hole where it was lost).

## A2. From the v15 gate (build with B)

- The card's Retry ends a full run while the HUD's Retry keeps it: say so on the card button when a run is live ("Retry (ends run)"), or make the card Retry keep the run too; pick keeping the run.
- The first-run hint shows until the first shot is released (not on a timer), and a drag under the cancel threshold shows a short "Drag further" call-out.
- A ball resting on a planet that has been shot three times without leaving it shows "More power to leave the planet" once per hole.
- The Run counter and landed mark appear only after hole 1 is finished (a run is a thing only once the player has chained a hole); the first landing that breaks Never Landed shows a one-line toast.
- Hole 5 (boss) sinks for a noisy human 70.7 percent of the time on the route, the worst after D0: widen its drag window to at least 25 px with the boss lesson kept.
- The hole 15 route's first shot is clock-sensitive (released within 0.02 s of clock 0): make shot 1 clock-free (a landing that works at any clock), keeping shots 2 and 3 timed.
- Cosmetics: the Never Landed progress line's orphan wrap, `landedOn=0` in the ledger reads "none", the file header, a stray TUNING comment.

## B. Suns have mass

A sun pulls like a planet of mass `sunMass` (default 1.6, above the heaviest planet's 1.2 and below the black hole's 1.4 pull at its floor; tune so the whip past a sun is felt but never captures), with the distance floored at `sunPullR`. Touching still costs a stroke. Every sun hole (6, 9, 10, 14) re-proved with --three, --sweep, --escape, --two-shot and --windows; routes re-authored where the pull breaks them; the soft-shot sweep on hole 6 re-run.

## C. Sectors (art)

Holes are grouped in sectors of five with their own backdrop and palette, one style sentence each under the game's fixed anchor: Sector 1 (holes 1 to 5) the current starfield; Sector 2 (6 to 10) a nebula in the game's purples; Sector 3 (11 to 15) a meteor shower (faint streaks on a period, cosmetic only); Sector 4 (16 to 20) "deep space" with a distant space whale silhouette drifting once a minute; Sector 5 (21 to 25) a binary sunrise. Backdrops never change contrast numbers below the v9 measurements.

## D0. Holes 3, 7, 8 and 11 re-authored to the power-window rule

The v0.4 build found their routes' drag windows at 20, 14.6, 12 and 11.5 px against the 20 px rule (with the neighbour check). The rule applies to every hole: re-author each so its three-star route meets 20 px and 4 degrees with the neighbour check, keeps its lesson, and passes --three, --sweep, --escape, --two-shot and --windows. Holes without a black hole otherwise stay byte-identical.

## D. Content: holes 16 to 25 (shards)

Ten holes under every rule from v0.3 B and v0.4 C (power windows, --two-shot, escape), using all objects including heavy suns: at least two with a moon, two with two black holes, one with three comets, and bosses at 20 and 25. Sector 4 and 5 themes as above.

## E. Modes (after D)

- Driving Range: one shot from a tee on a long field that scrolls with the ball; distance is the score; planets and comets along the way; a daily seed and a best.
- Putting: ten one-stroke holes with strong gravity and no walls, three stars for a sink, two for a rest within a cup radius, one for anything else; a separate ladder with its own badge.
- Versus a ghost: play any hole against a recorded bot run drawn as a ghost ball, stroke by stroke; three bot levels (the route, the two route, a noisy route). Not in this version's build unless D lands early.

## F. Out of scope

Camera changes on the ladder holes (they stay one screen); new physics beyond B.
