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

## Proto 4 (designer, 2026-10-05, after proto 3): a real sword arm, a shield, and aiming that beats spamming

From `playtests/2026-10-05-proto3.md` and the designer's notes. It is still a one-time feel prototype (Sonnet, smoke checks only).

**Two thumbs** (landscape, ADR-0013, as in Recoil), so attack and defence never fight over one gesture:
- the **right thumb** drives the sword arm;
- the **left thumb** drives the shield and the dodge.

**The sword arm** (the designer: "the arm mostly straight, the elbow bends if I draw back"):
- **The arm is straight by default.** The hand sits on a circle of nearly full arm length around the shoulder, at the finger's angle, with the offset and the weight. **Drawing the finger back** toward your own body bends the elbow and chambers the sword.
- **A gladius,** a short broad blade, held in a natural grip. The blade's angle follows the arm and the swing direction, so a swing reads as a slash, not a rapier lunge.
- **Three attacks fall out of the motion.** All are judged by the blade's real path, with no gesture menus:
  - **Overhead swing:** raise the hand above the head, then bring it down fast. **Strong**: it hits hard, dents a plate twice, and breaks plates fast. It mostly lands on helmets and shoulders, so it often **hits metal and bounces**, with a big recoil.
  - **Jab:** chamber, by drawing back, then push the finger straight out fast. The **tip** stabs along that line, and only the tip hits. It is precise and cheap on stamina, and it does strong damage in a gap. Aimed from below upward, straight out, or from above downward, it lets you **pick a gap**. A jab into armour glances, with a small recoil.
  - **Slash:** any other fast arc. Medium damage along the edge.
- **Stamina:** every attack costs stamina (overhead the most, jab the least), shown as a bar under your hearts. It refills while you are not swinging. At zero, your arm slows and attacks deal half damage. Flailing runs you dry.
- **Armour now punishes.** A clang recoils your arm for 0.5 s (0.7 s on an overhead), and **the opponent immediately counters**: a fast blow with a short tell that you must block or dodge.

**The left thumb: shield and dodge** (the designer: "the parry swipe forward would bring up the shield"):
- **A swipe forward,** to the right, **raises the shield** on your gladiator's off arm for 0.6 s.
  - A blow that lands on the raised shield is **blocked**: it costs shield durability (shown as a bar; 4 blocks break it, and it recovers between opponents).
  - A **perfect block,** raised within the last 0.15 s before impact, costs **no durability**, staggers them, and opens a **riposte**: hits count double for 1 s.
- **A swipe back,** to the left, **dodges**: a hop back out of reach. It costs a good chunk of stamina and has a 1.2 s cooldown, and you must step back in, by holding the left thumb forward briefly, before you can hit again. Safe, but it costs tempo.

**The opponent:**
- **Guard:** between attacks they hold their club or arm across one zone, high, middle or low, chosen from the seed. That covers those parts like armour.
- **Openings:** for 0.8 s after each of their attacks they **recover**, with their guard down. That is the moment for a jab into a gap. Read them, don't hack.
- The tells, hearts, damage, disabling and felling stay as in proto 3.

**The result card adds** overheads, jabs, slashes, blocks (perfect), dodges, stamina-outs and counters taken.

## Proto 5 (designer, 2026-10-05, after proto 4): the sword leads, a three-button shield

From `playtests/2026-10-05-proto4.md`. It is still a one-time feel prototype (Sonnet, smoke checks only). Keep everything in proto 4 except:

- **Stance.** The body stays **upright** by default; **the sword leads**. The torso leans only during a fast slash whose target sits beyond the straight arm's reach, up to `lean.max` (12°), and returns at once. Otherwise the shoulder stays put.
  - The hand can travel **low**: the arm's circle reaches the opponent's knees and shins without pulling back.
  - The fighters stand close enough that a straight arm reaches the opponent's chest, belly, legs and near arm.
- **Shield: three buttons** stacked on the left edge, inside the safe area: **High**, **Mid** and **Low**, each at least 56 px.
  - A **tap raises the shield to that zone** for 0.6 s; a **hold keeps it up**, draining stamina slowly.
  - A block in the matching zone works as in proto 4 (durability, a perfect block in the last 0.15 s, a riposte).
  - A wrong-zone shield doesn't block.
  - A **swipe back** (leftward) that starts anywhere on the left third stays the **dodge**.
  - The buttons glow in the zone of the current tell, so first-timers learn the match.
- **Softer counters.** A clang only triggers a counter after an **overhead** clang, or after **two clangs in a row**. The counter's tell is 0.45 s, and its zone glows like any tell.
- **Jab tip radius** of 10 px, so a jab aimed at a visible gap lands.
- **Portrait guard.** If the screen is taller than it is wide, show a "Turn your phone sideways" card instead of the fight.
- **TUNE presets:** Forgiving (slow tells, long perfect window), Standard and Brutal.

## Proto 6 (designer, 2026-10-05, after proto 5): space to aim, fewer plates, a dodge button, exhaustion

The designer struggled with proto 5:
- "We're standing too close, which still makes it hard to aim for gaps."
- "The other player's ripostes are killing me."
- "Sometimes the other player is too armoured."
- "Dodge should be like the shield: tap for a quick dodge, tap and hold for a longer dodge that burns stamina."
- "No stamina should mean no sword swings for a bit."

It is still a one-time feel prototype (Sonnet, smoke checks only). Keep proto 5 except:

- **Space and size.** The fighters stand **apart**, with a clear gap of about 20 percent of the screen width between them. The camera frames them a little larger, so each body part is a bigger target.
- **The lunge.** At rest your straight arm reaches the opponent's near edge (the front arm and the chest's front). To reach deeper gaps or the far side, push the hand past your reach toward them. Your gladiator **steps in with the swing**, a lunge of up to one stride, then steps back. A lunge costs extra stamina, and while lunging you can't raise the shield, so a lunge is a commitment.
- **Fewer plates.** Each opponent wears **2 or 3 plates** (seeded), never a full set. At least one of chest or belly, and at least one leg, is always bare.
- **Gentler counters.** The opponent counters only after an **overhead** clang. Ordinary clangs just recoil you. A counter's tell is 0.55 s, and its zone glows. **Forgiving** is the default preset.
- **A dodge button.** A fourth left-thumb button, **Dodge**, sits below Low, at least 56 px.
  - **A tap** is a quick sidestep back (0.35 s, small stamina cost).
  - **A hold** keeps you backed off out of reach while it is held, burning stamina steadily. Release to step back in.
  - The leftward swipe dodge is removed.
- **Exhaustion.** At zero stamina your gladiator is **exhausted** for 1.5 s: there are no sword swings and the shield is slow to raise, and the stamina bar flashes. Stamina refills faster when you are not swinging, blocking or dodging.
- **A real definition of gaps** (designer, 2026-10-05, added before the proto 6 build). There are three kinds of target, all drawn so the player can see which is which:
  1. **Joint slots:** small unarmoured slits **between** pieces of armour that stay open even under a full set. These are the neck (between helmet and chest plate), the armpit, the waist (between chest and belly plates), the inside of the elbow and behind the knee. They are drawn as dark slits with a faint rim. They are small, but a jab or slash through one deals **high damage**. This is the precise, expert target.
  2. **Bare parts:** whole body parts with no plate. Large targets, normal damage.
  3. **Plates:** they protect. A hit recoils and dents, and three dents break the plate, as now. **Breaking plates is optional**: a strategy, never a requirement.
- **Winning without breaking anything.** Each opponent has one health bar, shown above them. Hits on joint slots and bare parts take it down: joint slots for about 3 times a bare-part hit. Plates take no health. A clean, aimed fight that never cracks a plate fells the opponent fastest. Disabling individual parts still works as before (arm, legs, head).

## Proto 7 (designer, 2026-10-05, after proto 6): one hit per swing, and an opponent who fights back

Source: the designer's proto 6 playtest: "It feels a bit repetitive and now there's not really a challenge because you can hit multiple gaps in one hit and just wreck the character." The export agrees: the last three bouts felled 7 or 8 opponents each, with 34 or 35 slashes, 21 to 31 slot hits, and 0 to 2 hits taken.

- **One hit per swing.** The first thing the blade meets decides the swing. A plate clangs and the swing stops there. A slot or a bare part takes the damage and the swing ends. A slash can no longer rake across several targets.
- **Slots take a thrust.** A joint slot is a thin slit, so only a jab whose tip goes in roughly along the slit counts as a slot hit, at 3x damage. A slash across a slot counts as a bare hit. The jab is the precision tool; the slash is the safe, low-reward one.
- **More health.** The foe's health goes up, so a clean fight takes several good hits: about 4 slot jabs, or 10 or more bare cuts.
- **The opponent defends.** When a part is hit, he moves his guard or shield to cover it for a few seconds, so the same spot twice in a row is blocked and you must vary your target. His shield blocks the zone where he holds it, which is drawn clearly. Between his attacks he steps in and out of your reach.
- **Three fighting styles, seeded,** one per opponent in the sequence:
  - **Shield wall:** a big shield, slow, counters after a blocked swing.
  - **Duelist:** no shield, a quick sidestep away from your lunge, fast tells.
  - **Brute:** heavy plates and few gaps, slow big swings that drain your stamina when you block them.
  
  The name of the style shows above his health bar.
- Everything else from proto 6 stays.

## Proto 8 (designer, 2026-10-06, after proto 7): the sword thumb works like a trackpad

Source: the designer's proto 7 playtest. "A number of things are better, but I think I learned the major problem. Holding the phone sideways, the comfortable place for the thumb to sit is near the right side of the screen, which means the comfortable action is the lunge strike and hold close to the enemy. To avoid that I have to push my thumb to the middle of the screen and then pull it back to move the sword and stab." The cause: the sword hand follows the thumb's position on screen, so the resting thumb, at the right edge, means full reach.

- **Relative control (trackpad), the new default.**
  - Wherever the right thumb touches down, the sword hand is at its guard: a relaxed, half-bent arm in front of the body.
  - Moving the thumb moves the hand by that offset times a gain of about 1.6 (TUNE), so a small, comfortable thumb movement covers the whole reach.
  - Lifting the thumb returns the hand smoothly to guard, and the next touch re-anchors.
- **Strikes keep their gestures, measured from the anchor.**
  - A jab is a quick push forward from the anchor.
  - A slash is a quick sweep across.
  - An overhead is up, then down.
  - A **lunge** needs a deliberate push past the full reach from the anchor, about 1.3 times the reach in thumb movement after the gain (TUNE). The comfortable resting thumb never lunges.
- **A faint ring** shows where the thumb anchored, and a line runs from it to the current thumb position, so the player can see the offset.
- **TUNE switch "Sword control":** Relative (default) or Absolute (proto 7), so the designer can compare in one session.
- Everything else from proto 7 stays.
