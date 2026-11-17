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

Two Opus rounds (9 and 16 min) did not finish it; per the escalation rule the step is what needs fixing.

**Kept from the rounds (worth landing with the final fix):** the arm never folds the blade back at you (`solveArm` keeps the aim `arm.front` ahead of the shoulder; it moves the city replay hash); the spear's slide no longer feeds back into the stand-off; the ring sits on his chest; small screens start you back to make room.

**The real finding: the step's two wants barely fit this arm.** At guard the arm is already nearly straight: a push gains only about 0.14 H of reach over the guard tip (gladius, medium). Keeping the tip a quarter blade short of him (about 0.09 H) and landing the push 0.04 H into him uses nearly all of it, so a slightly short or flat push misses (two yard checks fail on exactly that). And a flat push from the high guard lands on his head, not his chest.

**The fork (a feel question, so it goes to the designer as a sketch, not a build):**
1. **A more chambered guard** (the hand held further back, `control.guard[0]` smaller): a push then has room to travel, as a real fighter draws back to jab. It changes the guard pose in every fight.
2. **A smaller gap** (`train.guardOff` about 0.1, `jabIn` about 0.1): the guard stays; the tip sits only just short of him in training.
3. **Keep the guard, let the ghost show a longer push** (close to before, with the fold fix).

## The designer's call (2026-11-17): the guard, the body, then the lunge

"Hold the guard further back and extend the body and then lunge if needed."

This replaces the fork above and the first version's "what the player gets" where they differ. It applies in every fight, not only the yard.

- **The guard is held further back** (chambered): at rest the hand sits nearer the body and the blade's tip is well short of him. A push has room to travel.
- **A push extends the body too:** as the arm straightens, the shoulders and torso lean into the thrust (a real thrust comes from the body, not only the arm), so a push from the chambered guard reaches at least as far as today's jab.
- **Then a lunge if needed:** if the push still doesn't reach him, pushing on steps in, as the lunge does today (`control.lungeStart`, `lunge.stride`). Keep the lunge's cost and rules; retune where it starts so arm, then body, then feet happen in that order as the thumb pushes further.
- In the yard, he stands where your chambered guard is clearly short of him and a plain push (arm and body, no lunge) lands on the chest ring.
- Kept from the first rounds: the arm never folds the blade back at you; the spear's slide doesn't feed back into the stand-off; the ring on his chest; room on small screens.

**Acceptance (added):**
6. At rest, in a fight and in the yard, the tip is short of a foe at striking distance by a clearly visible gap, for gladius, dagger, spear and axe, at every body size.
7. A plain push reaches at least as far as a jab does in `arena-v84` (compare with `node tools/verify.mjs strokes`), with the torso visibly leaning in; a longer push lunges. Jab, slash and overhead still class as in v84 (the `jabs` check), with one or two weapons.
8. A GIF for the designer: guard at rest, a push with the body, a push that becomes a lunge; gladius and spear.

One-way or two-way: **two-way** (dev channel, no save change), but it changes the controls' feel in every fight, so a short kit verifier checks the strokes table.

## Landed as arena-v85 (2026-11-17)

Five rounds in all: two on the first version of the step (unfinished: its wants didn't fit the arm), the build of the designer's call, a finishing round, and a fix round after the verifier's three findings.

- **Built:** `control.guard` [0.24, -0.05]; `TUNING.thrust` (the body's lean into a push); `arm.front` (the blade never folds back at you); the yard's stand-off as one bisection with `train.jabIn` and `train.lean`; the jab ghost always shows the whole plain push.
- **A fast second push counts:** a fresh sword touch that lands in a hit-stop cuts the stop short (`look.stopCut` 0). A first attempt saved the touch and replayed it; the verifier showed the hand falling behind the thumb, so it was replaced.
- **Back-to-back overheads:** a new touch lets go of the last overhead's reach (`h.ovK`), which had read as a slash from the longer guard.
- **Checks kept:** `tools/checks/arena/guard.mjs` (gap at rest, push lands on the ring, no fold, reach against v84) and four in `jabs.mjs` (touches in a stop, knife after a touch in a stop, overheads at six frames' rest).
- **For play to judge:** the lean is subtle (0.2 rad); the hit pause is shorter when you attack fast; in the yard the partner stands a little closer than the first GIFs.
- Before and after: `../sketches/guard-before-after.png`; GIFs `../sketches/guard-thrust-gladius.gif`, `guard-thrust-spear.gif`.
