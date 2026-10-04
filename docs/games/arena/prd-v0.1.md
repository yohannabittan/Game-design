# Arena PRD v0.1-proto: training dummy (the cut)

Status: locked 2026-10-04 by the designer: "do the training dummy prototype, extra fast; it's OK if it has issues, since it's a one-time proto". This is a **feel prototype** of the gladiator idea's core verb (the Swords and Sandals-like row in `docs/game-ideas.md`), not a v0.1. Principle 12 applies: feel first. Nothing else from the idea is built: no wheels, market, arenas, opponents or story.

## What it is

- Portrait, one thumb, a dark sand-pit arena.
- A **straw training dummy** stands in the upper half, about 60 percent of the screen width tall.
- **Body parts:** the dummy has six parts, drawn as simple shapes: head, chest, belly, left arm, right arm and legs.
- **Armour:** a randomly chosen, seeded subset of 3 or 4 parts is armoured, drawn as grey metal plates over the straw. The rest are bare straw: those are **the gaps**.
- **The dummy moves:** it turns slowly on its post, a sway of ±25 degrees and a slight bob, so the gaps move. The speed is in `TUNING`.

## The cut

- **Drawing:** touch and drag to draw a cut, then release to strike.
  - The cut is a straight segment from where the line started to where it ended, shown as a bright line while drawing.
  - The cut's length is capped at `TUNING.cut.maxLen` (reach).
  - The cut must be drawn within `TUNING.cut.maxTime` (0.6 s).
- **Hits:** the segment is tested against the parts' shapes at release.
  - **Every bare part it crosses scores:** a straw burst, a satisfying slice sound and a short hit-stop (60 ms). The part goes dark ("disabled").
  - **Armour it crosses clangs:** sparks and a metal sound, and no score.
  - **Combos:** a single cut through two or more bare parts is a combo, with a bigger burst.
- **The three input presets** are a TUNE experiment, to compare on the phone:
  1. **Offset blade** (the default): the line is drawn `offset` px **above** the finger (about 70 px), so the thumb never hides the target, like Ink's needle.
  2. **Flick:** a fast swipe. The cut is the swipe's direction, starting at the swipe's start point, with its length from the swipe's speed up to `maxLen`. Precision comes from aim, not from tracing.
  3. **Slow motion:** while the finger is down, the dummy's motion slows to `slowMo` (0.25×) for up to 0.6 s. The line is drawn under the finger with the offset, as in preset 1.
- **The score:** a running count of gaps cut, clangs and combos. A **round** is 30 seconds. Then the dummy resets with new armour from the next seed, and a result card shows cuts, clangs, combos and the best combo, with Again and Menu.

## Rules

- Touch first. HUD in the safe area. Every tunable number in `TUNING`: dummy sway, bob, part sizes, cut length, time, offset, hit-stop and slow-mo.
- Seeded armour per round (`makeRng`, ADR-0008). `Math.random` only for straw particles.
- No save beyond the engine's default.
- Sounds through the engine's audio. A slice must feel crunchy, and a clang must feel dull.
- No art assets, procedural only: straw dummy, metal plates.

## Out of scope

Opponents, parry, stats, wheels, market, story and progression.

## Acceptance

`npm run smoke` passes. The three presets switch live in TUNE. A cut through a gap scores, and a cut across armour clangs.

## Proto 2 (designer, 2026-10-04, after proto 1): the sword hand, parry, dodge, armour that fights back

The offset blade won proto 1 (`playtests/2026-10-04-proto1.md`). Proto 2 replaces the drawn line with **direct control of your gladiator's sword hand**, and makes armour matter. It is still a one-time feel prototype: Sonnet builds it, with smoke checks only.

- **Your arm.** Your gladiator's shoulder sits at the bottom centre of the screen (off-screen, implied). The sword hand follows your finger with the proto 1 offset (the blade tip sits `offset` px above the finger), with a little weight (`TUNING.hand.lag`) so the swing reads. The blade is drawn as a line from the hand, about `blade.len`.
  - A **hit** happens when the blade's moving edge sweeps through a part with tip speed of at least `hit.minSpeed`. The damage grows with speed. A slow wipe does nothing.
- **A gap hit.** The part takes damage; it has health, and after `part.hp` hits it is **disabled**: it goes dark, with a straw burst and a crunchy sound.
  - Disabling the head stuns the dummy for 1.2 s, with stars.
  - Disabling an arm makes the dummy's swings slower.
  - When the chest and belly are both disabled, the dummy collapses: a round point, then a fresh dummy.
- **An armour hit.** The blade **bounces**: a recoil animation, and your hand is locked for `armour.recoil` (0.35 s). The plate **dents**, drawn as a crack. After `armour.dents` (3) dents it **breaks off** and becomes a gap.
- **The dummy swings back.** Every 2 to 3.5 s (seeded) it winds up with a readable tell: its arm rises and a glow marks the zone, high, middle or low. The swing lands `swing.windup` (0.7 s) later.
  - **Parry:** a quick swipe forward (upward on screen, toward the dummy) during the last `parry.window` (0.3 s) before impact blocks it, with a bright clash. A parry inside the first third of that window is **perfect**: it opens a riposte, and the dummy staggers for 1 s so your hits count double.
  - **Dodge:** a quick swipe back (downward) at any time during the wind-up steps you back, so the blow whiffs. There is no riposte.
  - **A swipe during the wind-up is a defence, never a swing.** Outside a wind-up, all motion is the sword.
  - **If the blow lands,** the screen flashes red and shakes, and you lose one of 3 hearts. Losing all 3 ends the round early.
- **The round.** 45 s, or until 3 hearts are lost. The result card shows gap hits, clangs, plates broken, parries (perfect), dodges, hits taken and dummies felled.
- **TUNE.** Expose `offset`, `hand.lag`, `hit.minSpeed`, `parry.window`, `swing.windup` and the swing interval. Presets: Gentle (a slow dummy, a wide parry), Standard, and Brutal.

## Proto 3 (designer, 2026-10-04, after proto 2): two gladiators on screen, sideways

Proto 2's weight, tells and parry and dodge stay (`playtests/2026-10-04-proto2.md`). Proto 3 changes the framing. It is still a one-time feel prototype: Sonnet builds it, with smoke checks only.

- **Landscape** (the designer chose sideways, as Recoil is). Set the manifest orientation to landscape, as Recoil's manifest does. Lay out for 844x390, and keep it working at 640x360.
- **Two full-body gladiators**, side view, facing each other on a sand floor:
  - **Yours** on the left, the **opponent** on the right, each about 60 percent of the screen height.
  - They share one procedural body: head, chest, belly, two arms and legs, with a simple tunic and a gladiator helmet shape.
  - Both have seeded armour plates on 3 or 4 parts, with the same dents, breaking and gaps as before.
- **Your sword arm** is a two-bone arm (shoulder, elbow, hand) on your gladiator, solved each frame so the hand follows the finger with proto 1's offset and proto 2's weight. The hand's reach is limited by the arm's length; beyond that it stretches toward the finger but stops at full reach.
  - The body leans a little toward the hand, so every swing moves the whole fighter.
  - The blade comes from the hand. A hit needs tip speed, as in proto 2.
  - The opponent stands in reach, so a full swing can touch their near half; their far arm needs a step in.
- **The opponent** has proto 2's dummy behaviour on a gladiator body: high, middle or low wind-ups with a glow and a raised weapon arm; the same damage, disabling, stun, stagger and collapse. They also sway and step slightly, so their gaps move.
- **Defence is the same gesture, now with the body:**
  - **Parry:** a quick swipe toward the opponent (rightward) in the window. Your gladiator's blade snaps to the zone and clashes.
  - **Dodge:** a quick swipe away (leftward) during the wind-up. Your gladiator hops back and returns.
  - Outside wind-ups, motion is the sword.
- **Hearts, the round and the result card** stay as in proto 2. A felled opponent is replaced by a fresh one with new armour.
- **The thumb.** The finger is usually over the lower middle of the screen. Keep the opponent's tells and plates readable, using the offset and the fighters' height.
