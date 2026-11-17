# Arena step: the training partner stands where your jab lands (locked 2026-11-17)

**The designer** (screenshots `../playtests/2026-11-17-yard-guard.png`, `2026-11-17-yard-jab.png`, v81, the jab lesson, gladius): "In training there's still an issue of how close we are: look at the natural arm position and the arm position I have to find to jab."

**What the screenshots show:**
- At guard, your blade's tip is already at his face. He stands inside your natural reach.
- To jab the lesson's target (the ring on his chest), the hand has to go to a cramped spot right at his face, and the arm folds so the blade points back at your own neck.

**Cause (found in the code):** `yardStand` in `features/yard.js` draws him in until your plain straight-arm jab reaches `train.jabIn` into his front, so at guard (arm bent, blade forward) the tip is already on him.

## What the player gets (common sense)

- In the yard, he stands where **your guard tip is a little short of him** and **a natural push from guard lands** on the lesson's target. You never have to pull back to find room.
- The lesson's target ring sits where that natural push lands.
- **An arm never folds so the blade points back at you**: if the thumb asks for a hand position the arm can't reach sensibly, the hand stops at the nearest sensible one with the blade forward. This applies in fights too.
- His blows still reach you in the lessons that need them (block, dodge).

## Acceptance

1. At 874x402 and 667x375, for a runt, a medium and a giant you, with gladius, dagger and spear: at guard the tip is short of his body by a visible gap (about a quarter of the blade), and a plain push from guard lands on the lesson's target; the yard's jab and gap steps complete with plain human pushes (`tools/verify.mjs strokes` or a check).
2. No frame in the yard's lessons, or in a fight, shows the blade pointing back toward your body (a check sweeping hand targets around the guard).
3. The block and dodge lessons still work: his blows reach you.
4. `npm run check arena` and `npm run smoke` pass; replay hashes named if they move (the fold fix may move them).
5. For the designer: the same two moments as the screenshots, before and after, side by side.

## After two build rounds (2026-11-17, parked for the designer)

Two Opus rounds (9 and 16 min) did not finish it; per the escalation rule the step is what needs fixing. Unlanded work is in the worktree `/home/user/wt-arena-yarddist` (probes in the scratchpad folder `arena-yarddist/`).

**Kept from the rounds (worth landing with the final fix):** the arm never folds the blade back at you (`solveArm` keeps the aim `arm.front` ahead of the shoulder; it moves the city replay hash); the spear's slide no longer feeds back into the stand-off; the ring sits on his chest; small screens start you back to make room.

**The real finding: the step's two wants barely fit this arm.** At guard the arm is already nearly straight: a push gains only about 0.14 H of reach over the guard tip (gladius, medium). Keeping the tip a quarter blade short of him (about 0.09 H) and landing the push 0.04 H into him uses nearly all of it, so a slightly short or flat push misses (two yard checks fail on exactly that). And a flat push from the high guard lands on his head, not his chest.

**The fork (a feel question, so it goes to the designer as a sketch, not a build):**
1. **A more chambered guard** (the hand held further back, `control.guard[0]` smaller): a push then has room to travel, as a real fighter draws back to jab. It changes the guard pose in every fight.
2. **A smaller gap** (`train.guardOff` about 0.1, `jabIn` about 0.1): the guard stays; the tip sits only just short of him in training.
3. **Keep the guard, let the ghost show a longer push** (close to before, with the fold fix).
