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

## Proto 9 (designer, 2026-10-07, after proto 8): an opponent who really fights, and fighters who differ

Source: the designer's proto 8 playtest.
- "Proto 8 was good, it's getting better; stabbing the gaps is rewarding."
- "I wish it lasted longer and had a bit more variability; it's getting closer to being a really fun game."
- "The way the enemy fights back is kind of the lamest, most repetitive thing right now."
- "Stats and different sizes and weapons and different armour will provide some good variations."

Note: the phone was sideways. The export only reads portrait because the phone is turned to tap Export.

### The opponent fights with intent (the heart of this proto)

- **A move set per weapon, not one swing.** Each weapon has 4 or 5 moves, each with its own readable tell:
  - an overhead chop;
  - a straight thrust;
  - a low sweep at the legs;
  - a 2 or 3 hit combo, with the zones changing within the chain;
  - a **feint**: a tell that cancels into a different attack.

  The shield styles add a shield bash, which pushes you back and drains your stamina.
- **He has stamina too,** shown as a thin bar under his health. Attacks and blocks cost it. When it runs out he is winded for about 1.5 s: guard down, slow, a big opening. After a combo he must recover, so a combo you survive is your turn to punish.
- **He moves.** He steps in to attack and steps back to recover. He circles a little, keeping the distance his weapon wants: a spear stays long, a dagger rushes in. He sometimes retreats when hurt.
- **He reads you a little.** He keeps a short memory of what you do:
  - if you block one zone three times running, he aims elsewhere;
  - if you lunge often, he sidesteps and punishes the lunge;
  - if you turtle behind the shield, he feints or bashes;
  - if your stamina is low, he presses.
- **Rhythm varies.** His pace mixes quick flurries, pauses and a slower probing phase, so no two exchanges feel the same. All of this is decided by the seeded fight RNG at the start of each exchange, never mid-swing, so the tells stay honest.

### Fighters differ

Each opponent is rolled at setup from seeded tables, and shown on a short intro card before the bout: a name, the size, the weapon, armour icons and three stat bars.
- **Size:** Small (quick, short reach, less health), Medium, or Large (slow, long reach, more health, hits harder). He is drawn at that scale, so the gaps move with him.
- **Weapon:** pick from the following.

  | Weapon | Reach | Speed | Damage | What it does well |
  | --- | --- | --- | --- | --- |
  | gladius | short | fast | | combos |
  | spear | long | | | thrusts; keeps you at range |
  | axe or mace | | slow | big | overheads that break shields |
  | dagger and net | very short | | | the net throw slows you for a moment |

- **Armour sets:** light (1 plate), medium (2 or 3), heavy (4 plates plus a helmet). The joint slots and bare parts follow the set.
- **Stats:** Strength (his damage), Speed (tell length and step speed) and Stamina (bar size), each on a 1 to 5 bar, rolled with the size's bias.

### Longer: a gauntlet

- A run is a gauntlet of 5 opponents rising in tier: the first is small and light, the fifth is a named champion with the best rolls.
- Your 3 hearts carry across the gauntlet. Felling an opponent restores half a heart.
- The round timer goes.
- The end card shows how far you got, with each opponent's card.
- Your weapon stays the sword for this proto.

### Kept

Everything else from proto 8: the trackpad sword, slots and thrusts, one hit per swing, cover, shield buttons, dodge and exhaustion.

## Proto 10 (designer, 2026-10-07, after proto 9): learn the feint, a fair first bout, and your own rolled fighter

Source: the designer's proto 9 playtest. "This proto is better and more fun. I need to understand feinting better. It's still a little bit hard, but I do like this quite a bit. I'd like to have my own character also randomized."

The export, 8 gauntlets:
- **The first bout is the hardest wall.** No gauntlet was won. Five of the eight ended at bout 1, mostly to a small, light opponent.
- **Feints are never read.** Feints read 0, feints bit 3.
- **Punish windows go unused.** Punishes 0 across every gauntlet, winded 0 or 1 per run.
- **Lunges get punished.** The foe reads them 2 to 4 times a run.

### Teach the feint
- **A distinct look.** A feint's tell starts like the real one, then the weapon *hesitates*: a short shimmer in a different colour (violet), and the glow jumps to the real zone. The real tell keeps its colour.
- **The first feint is a lesson.**
  - The first feint ever shown runs in slow motion (0.4 speed) with a caption: "FEINT! He faked HIGH. Wait for the glow to settle, then block where it lands."
  - The second feint shows a shorter reminder.
  - After that, feints play at normal speed.
- **Reading a feint is rewarded.** Holding no shield and dodging nothing during the fake, then blocking the real strike, flashes "Feint read!". He loses a chunk of stamina, which often winds him. This counts as `feintsRead`.

### A fair ramp through the gauntlet
- **Bout 1 is a sparring partner.**
  - No feints, no adapting.
  - Long tells (+40%), low stats, and he never counters after a clang.
  - His intro card says "Sparring: learn his tells."
- **Bout 2** adds feints, with the lesson above. **Bout 3** adds his memory of your habits. **Bout 4 and the champion** get everything.
- **The open window.** When he is winded, time slows briefly (0.15 s), "OPEN!" appears, and his open slots glow for the window. A slot hit in the window does 1.5 times damage and counts as a punish.

### Your rolled fighter (the first birth wheel, pattern L8)
- **The roll.** Before a gauntlet, your fighter is rolled on quick wheels shown with their odds and named tiers, as in the backlog's wheel-of-fate idea:
  1. **Size:** S, M or L.
  2. **Strength,** 1 to 5.
  3. **Speed,** 1 to 5.
  4. **Stamina,** 1 to 5.
  5. **Armour set:** light, medium or heavy.

  Each wheel spins about 0.8 s and can be tapped to stop early. A "Your fighter" card follows, with a tier letter (S to D) and "Fight!". The seeded RNG is used at setup only (ADR-0008).
- **What the rolls change.**

  | Roll | Effect |
  | --- | --- |
  | Size | reach and body scale (your gaps move with you), hearts (S 2.5, M 3, L 3.5) and swing speed (S fast, L slow) |
  | Strength | sword damage |
  | Speed | swing and recovery speed, and dodge length |
  | Stamina | bar size and regen |
  | Armour set | where you are plated. A hit on a plated part costs a quarter heart instead of a half. Heavier sets regen stamina more slowly. |

- **The 90 to 95 percent rule.** The odds lean to playable fighters. A rare very weak roll gets an underdog bonus: +1 half heart and "Underdog!" on the card.
- **Visible in play.** Your fighter is drawn at their size with their plates. The end card shows your fighter's card beside the opponents'.
- Your weapon stays the sword this proto. A rolled weapon is next.

### Kept
Everything else from proto 9.

## Proto 11 (designer, 2026-10-07, after proto 10): skin the fighters so the gaps look like gaps

Source: the designer's proto 10 playtest.
- "Latest arena proto is quite fun... missing a bit of narrative to make the character fun, and a bit of skinning so the gaps look like gaps, not just black squares; overall we're getting somewhere good and fun."
- The export: one gauntlet reached the champion (4 felled, 2.5 minutes, 17 plate saves). Feints read are still 0, with 3 bitten.

The narrative is proposed separately, for the designer to pick, and is not part of this build.

### Skin (procedural, canvas only)

- **Plates look like armour.** Draw shaped pieces in place of flat shapes:
  - a curved cuirass with a bevelled rim;
  - segmented arm guards (manica), with overlapping bands;
  - greaves with a knee boss;
  - a helmet with a brim and a visor grille.

  Every piece gets a highlight edge, a shadow edge, rivets and leather straps. Dents show as darker dimples with a scratch, and cracks as jagged lines.
- **Gaps look like gaps.** A joint slot is the place where two plates don't meet. The plate edges frame it, and inside it you see what is underneath: padded linen or bare skin with a strap crossing, in shadow. It is no longer a black rectangle.
  - To keep it readable at a glance, give it a faint warm rim light along the inner edges.
  - When the sword tip is within range of it, add a subtle glint.
  - It must still read at 375 px wide.
- **Bare parts look like bodies.** Skin with soft shading and a few muscle lines; a tunic or loincloth with folds and a belt.
- **The weapon sets the gladiator type** (flavour only, no new rules):

  | Weapon | Type | Look |
  | --- | --- | --- |
  | gladius | murmillo | big helmet with a fish crest, rectangular shield |
  | spear | hoplomachus | crested helmet, small round shield |
  | axe or mace | brute | open helmet, heavy pauldron |
  | dagger and net | retiarius | no helmet, a shoulder guard (galerus), the net hanging from the belt |

  The player fighter gets its own look from its rolled armour set.
- **Hit marks.** A bare-part hit leaves a small red cut line that fades over a few seconds, while plate hits spark as now. Nothing gory.
- **Shading.** All of this is drawn once per fighter into an offscreen sprite per part, and redrawn only on a dent, a crack or a break, so the frame time stays as it is.

### Kept

Everything from proto 10. Hit areas do not change: the art is drawn over the existing part geometry.

## Proto 12 (designer, 2026-10-07): a story for your fighter, upgrades between bouts, and footwork

Source: the designer, on the narrative proposal:
- "This direction does feel good, but one thing that's missing is being able to choose upgrades between rounds."
- "How would you feel about making the characters able to move side to side?"

Build this after proto 11 lands, on top of it.

### Your fighter's story (flavour wheels, pattern L8: flavour wheels vs function wheels)

- **Two more wheels after the stat wheels, flavour only:**
  - **Origin:** "a farmer from Gaul", "a Thracian soldier", "a Numidian horseman", "a baker from Capua", "a sailor from Ostia" or "a scribe from Alexandria".
  - **Reason to fight:** Freedom, Debt, Revenge or Glory.
- **Your name.** It is rolled from a short list (Gaius, Lucia, Decimus, Aurelia, Brennus, Tullia, Nikandros, Iuba). It shows on the fighter card as "Gaius, a baker from Capua. Fights for: Freedom."
- **Old Brutus, the lanista, speaks on each intro and result card.** One line per reason and moment. A few per reason, each 60 characters or fewer:
  - **Freedom:**
    - "Win the wooden sword and you walk out free."
    - "Free men don't lose to farmers. Get up."
    - "One more, and the gate opens."
  - **Debt:**
    - "Your family owes me. Every win pays."
    - "That one's worth a month of bread."
    - "Lose, and the debt grows."
  - **Revenge:**
    - "He burned your village. He's waiting at the end."
    - "Keep your anger for the champion."
    - "Not yet. Him last."
  - **Glory:**
    - "Rome wants a name. Make it yours."
    - "Hear them? They're chanting for you."
    - "Glory is loud. Be louder."
- **A rival who remembers.** The champion who beats you is saved (name, look, weapon). The next run's champion is the same man, with a taunt on his intro card:
  - "You again, little baker?" (the origin's noun);
  - Revenge runs: "I remember your village."
  
  Beating him clears the rival and flashes "Rival defeated!"
- **The ending pays off the reason.**
  - **Beating the champion:** an epilogue card in two lines:
    - Freedom: "Gaius walked out a free man, the wooden sword in hand."
    - Debt: "The debt was paid. Lucia went home to her family."
    - Revenge: "The village was avenged. Brennus finally slept."
    - Glory: "Rome sang the name Aurelia for a generation."
  - **Falling earlier:** "Gaius fell in bout 3. Old Brutus chalked his name on the wall of the pit." The end card shows a small wall of past fighters' names (the last 8).

### Upgrades between bouts (a pick of three)

- **The draft.** After each felled opponent, before the next intro card, three upgrade cards are dealt from the seeded deck. Pick one. Each card has a name, an icon and one line.
- **Fight quality sets the odds**, which are shown, as the wheel-of-fate rule wants.
  - **The bout's grade** comes from slot hits, feints read, punishes and hits taken:
    - **S:** no hits taken and at least 2 reads or punishes.
    - **A**, **B** and **C** for progressively weaker bouts.
  - **The grade sets the rarity odds** for the three cards: C is mostly common; S guarantees one epic.
- **The deck, about 12 cards:**

  | Tier | Card | Effect |
  | --- | --- | --- |
  | Common | Thick Hide | +½ heart |
  | Common | Second Wind | +20% stamina |
  | Common | Quick Wrist | jab recovery −20% |
  | Common | Steady Shield | blocking costs 25% less |
  | Common | Sandal Grip | steps 20% faster |
  | Rare | Iron Greaves | your legs are plated |
  | Rare | Bronze Helm | your head is plated |
  | Rare | Heavy Arm | overheads dent twice |
  | Rare | Keen Eye | feint shimmer shows 0.3 s longer |
  | Rare | Riposte | a perfect block gives a free counter jab |
  | Epic | Champion's Blade | slot hits do 3.5x |
  | Epic | Crowd's Favourite | +1 heart after each fell |
  | Epic | Unbreakable | the first hit each bout is ignored |

- **Visible and remembered.** Chosen upgrades show as small icons under your hearts. They last for the run, and the end card lists them.

### Footwork: stepping in and out (orchestrator's recommendation, see below)

- **The Dodge button becomes a step rocker,** the same size, split in two:
  - **◀ Back:** a tap is the quick backstep, which is the old dodge. Holding it keeps backing off, burning stamina as before.
  - **▶ In:** a tap steps in one pace; holding it keeps walking forward slowly.
- **The arena has edges.** With your back to the wall you cannot retreat, and it flashes "Back to the wall!"
- **Range becomes the skill:**
  - stay outside a spear's reach, then step in after his thrust;
  - keep a dagger fighter at bay;
  - step in to reach a winded opponent's open slots.
  
  The lunge stays as the long reach on the sword thumb.
- **The foe uses the same footwork rules.** He can be pushed to the wall: a shield bash or a strong block pushes him back half a pace.

## Proto 12.1 (designer, 2026-10-07): bigger left-thumb buttons

The designer asked: "Can we get bigger back and forward buttons? Right now it's too hard to hit. Maybe you can also make the shield buttons bigger."

- **The left thumb column grows to about 22% of the screen width,** and never less than 96 px wide. The fighters' framing shifts right to keep the gap between them.
- **High, Mid and Low** each take an equal share of the column's height above the step row, with 6 px between them. They are about 72 px tall at 390 px of height.
- **The step row sits at the bottom, where the thumb rests.** It has two separate buttons side by side, ◀ back and in ▶, each half the column width, at least 64 px tall and 96 px wide in total.
  - Each button's tap area extends 8 px beyond its drawn edge, but never into its neighbour.
  - A press that slides from one step button to the other switches to the other.
- **Labels and warning glows** scale with the buttons.
- **Size checks** are at 667x375, 844x390 and 932x430.
- Nothing else changes.

## Proto 13 (designer, 2026-10-08): fairer feint switches, more upgrades, your own rolled weapon, a respin, and a clean screen

Source: the designer.
- "Arena's gotten quite good. How much time do we have to switch block during a feint? Still feels a bit hard."
- "We're getting close to finishing prototype mode."
- "We need a bit more upgrade content. I haven't reached anything more than rare yet, but it's been fun."
- "There should be a randomly assigned weapon to the character."
- "We should be able to get maybe one reroll or respin."
- "We will also need a bit of cleanup to hide all the information that would be superfluous to a true new player."

The export: 5 gauntlets on proto 12, about 15 feints, **0 read** and 13 bitten. Grades were mostly C and B with one A. Picks never included an epic.

### The feint switch window (orchestrator's diagnosis)

**What it is now:** after the glow jumps to the real zone, the real tell lasts 0.55 s (`TUNING.moves.feint.after`), shortened further by the foe's speed and by flurry pacing.

**Why reads fail:** a player who tapped the fake zone also waits out the shield cooldown (`shield.cool` 0.25 s). That leaves roughly 0.3 s to see the jump and tap the right button.

**Fix:**
- **Switching zones is instant.** Tapping another zone while the shield is up moves it at once, with no cooldown. The cooldown applies only after a block ends.
- **A longer real tell.** It becomes 0.85 s at base, and never shorter than 0.6 s at the foe's top speed. Keen Eye adds 0.3 s.
- **A clearer jump.** It gets a crisp "snap" sound and a quick flash on the real zone's button, so the jump is heard and seen at the thumb, not only on the foe.

### More upgrades, and epics you can reach

- **Odds that reward good fights, not only flawless ones:**

  | Grade | Common | Rare | Epic |
  | --- | --- | --- | --- |
  | C | 60% | 35% | 5% |
  | B | 40% | 45% | 15% |
  | A | 20% | 50% | 30% |
  | S | — | — | one epic guaranteed |

  The odds stay visible on the draft screen.
- **The deck doubles,** from 13 cards to about 26. Same tiers, each a single line of effect, all in `TUNING`. Examples:
  - **Common:**
    - Quick Feet: steps 25% faster.
    - Deep Breath: stamina regenerates 20% faster.
    - Sharp Edge: bare hits +1.
    - Tough Shield: 2 more shield hits.
    - Wide Stance: no push-back from a bash.
  - **Rare:**
    - Counter Stance: a block within 0.15 s of the strike staggers him.
    - Second Wind: once per bout, at zero stamina, refill half the bar.
    - Hunter's Eye: his open slots glow 0.5 s longer.
    - Net Cutter: never netted.
    - Lunge Master: lunges cost half the stamina.
    - Iron Gut: the first body hit each bout costs nothing.
  - **Epic:**
    - Executioner: below a quarter health, slot hits fell him.
    - Lion's Heart: +1 heart now and +½ per fell.
    - Mirror Shield: perfect blocks reflect a half-heart.
    - Blur: a dodge leaves a ghost he attacks instead.

### Your rolled weapon

- **A sixth wheel** after Armour, before the flavour wheels: **Weapon**, with visible odds.
  - Gladius 35%;
  - Spear 25%;
  - Axe or mace 20%;
  - Dagger 20%.
- **What each does** (`TUNING`):

  | Weapon | Reach | Speed | Damage | Stamina cost | Special |
  | --- | --- | --- | --- | --- | --- |
  | Gladius | baseline | baseline | baseline | baseline | the current sword |
  | Spear | +35% | 0.85x | — | — | jabs stay strong; slashes do less |
  | Axe or mace | −10% | 0.75x | 1.7x | +40% | overheads crack plates in 2 dents |
  | Dagger | −35% | 1.4x | 0.75x | — | slot hits do 4x instead of 3x |

- **Its look** comes from the gladiator types already drawn for the foes.
- **The fighter card** shows the weapon with its one-line job.

### One respin per run

- **On the fighter card,** before "Fight!", a single **Respin** button (at least 48 px) rerolls one wheel of the player's choice: tap a wheel, then Respin. It is greyed out once used.
- **Or, once per run instead,** a **Reroll** on the upgrade draft deals 3 new cards. The respin and the reroll share one token: the player spends it where they want. Both show "1 left".

### A clean screen for a new player

- **Hide by default:** the raw stat lines on the end card (jabs, slashes, overheads, joint hits and so on, and the feint counts), the debug-like labels, and any number a player does not act on. They move behind a small "Details" toggle on the end card.
- **Keep:** the opponent cards, how far you got, the picked upgrades, the grades, Brutus's line, the epilogue or the wall, and Again and Menu.
- **The in-play hint line** shows only during a player's first two bouts ever. It must sit clear of the step buttons, since it currently overlaps them.
- **Leave the export ledger and the dev-channel EXPORT and TUNE tabs as they are.** The release channel already hides them.
