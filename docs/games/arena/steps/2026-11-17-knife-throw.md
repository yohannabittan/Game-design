# Arena step: the knife throw, angle and one press (locked 2026-11-17)

**The designer**, after trying the tester (`../sketches/knife-aim.html`): "I like the angle one press knives." Earlier: a line from the hand "like a range finder that doesn't go all the way"; the knife button on the right; no target, no snapping; "I shouldn't have to put my right thumb exactly on the gap ... it should be an angle challenge, like only the y axis"; "make the arm pose of knife throwing more accurate, like pulling the arm back to throw it forward"; failed throws should not happen silently.

The chosen tester settings: **WAY 2 one press, KNIFE button on the right, TARGET none, LINE A (the short range-finder line), AIM angle**: `knife-aim.html?btn=R&tgt=none&way=2&aim=angle`. The tester's `T` numbers (`aR0`, `aR1`, `aTop`, `aBot`, `lift`) are the starting point.

## What the player gets

- **The KNIFE button sits on the right**, where the right thumb rests, clear of the foe and of the swing area's busiest spot. It shows the knives left, as today.
- **One press:** put your thumb on KNIFE and the knife comes up, the arm drawn back. Slide the thumb up or down: a dotted line from the hand shows the throw's angle, about 60% of the way to him, no ring, no snapping. Let go and the arm whips forward and the knife flies.
- **Only height matters.** The thumb's height sets the angle; moving it sideways does nothing. The knife flies along that line and hits whatever it meets on him first: a gap (12), bare skin (4), plate (glances off), or nothing (flies past). Knife damage is unchanged from v71.
- **No silent failures:** a press that lifts without sliding still throws, along the current line. Only sliding the thumb back down onto the button area or off the bottom edge cancels, and a cancel says so.
- **The arm:** the throwing arm draws back while you aim and snaps forward on release, as in the tester.
- While a knife is up: no block and no swing, as today. The ⇄ swap and DODGE are unchanged.
- The yard's knife lesson is rewritten in one or two lines for the new throw.

## Acceptance

1. At 874x402 and 667x375 the KNIFE button is on the right, a 44 px target at least, not over the foe or the HUD.
2. A scripted press on KNIFE, slide to a height, release: the knife flies along the line and hits the gap the line crosses. The same height with the thumb far left or right hits the same gap.
3. Heights over his head and under his knees miss; a height over plate glances; over skin, 4.
4. Each gap has a band of thumb height of at least about 12 px at 874x402.
5. A plain press and release throws (along the current line); no press ends with nothing and no message.
6. The bow, swap, block, dodge and slash controls are unchanged; replay hashes move only if a replay throws knives (named, with why).
7. Old saves load (save version unchanged unless the shape changes: then `saveVersion` and `migrate`, ADR-0005).
8. `npm run check arena` and `npm run smoke` pass; `tools/checks/arena/ranged.mjs` is updated for the new throw, and a permanent check covers 2, 3 and 5.
9. For the designer: a GIF of three throws at three heights, one with the thumb moved sideways, and the arm's draw and release.

## Open, simplest option taken

- **The bow** keeps its own aim (draw with the right thumb, its ring and snap) for now. If the designer wants it to aim by angle too, that is a later step.
- The knife arcs a little at range only in the range trials (Step 27b); in a fight the line is straight.

## Amendment (2026-11-17, after the first build)

- **A plain press aims at his middle** (the designer chose this). Pressing KNIFE starts the line at his chest; sliding up or down moves it from there, by the same amount of thumb per px of line. Only the height of the slide matters; sideways still does nothing. A plain press and release never throws into the sand.
- **The throwing arm** stays the sword hand, but **the sword is hidden while the knife is up and through the throw** (the designer: "We should hide the sword when doing the knife throwing"): the hand holds only the knife, and the sword comes back when the arm returns to guard.
- **A plain press lands on bare skin** (the designer, after the first fix round showed a plain press hitting the armpit gap for 12 on four of five foes: "Nearest bare skin"): the bare skin nearest his chest, for 4; plate if none. Gaps need a slide.
- **Every gap from neck to knee is reachable** by height, on every foe and size (common sense; the first fix round left the knee out of reach). The bottom-edge cancel may go.
