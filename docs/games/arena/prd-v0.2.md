# Arena PRD v0.2: v1, the game graduates from prototype mode

| | |
| --- | --- |
| Slug | `arena` |
| Version | 0.2 (the first real version, v1) |
| Pattern | a two-thumb duel, with L8 (wheel of fate) for the fighter and the draft |
| Date | 2026-10-08 |
| Status | draft: the designer approves the summary, then it is locked |

**Basis:** proto 13 (arena-v15), which the designer won twice; the 13 prototype sections of `prd-v0.1.md`; the playtests in `playtests/`; `concept.md` and `world.md`.

**Decisions in chat (2026-10-08):**
- "We don't need the walk around so much."
- "If we fix distance, difficulty is going to be good."

## 0. How v1 is built (cost before rigour)

v1 **promotes the proto 13 code** rather than rewriting it. Proto 13 is fun and has been won; a rewrite would risk losing the feel the prototypes found, and would cost several large builds. So v1 is two builds, each reviewed:

1. **A cleanup build (Opus).**
   - Remove dead prototype code: the old modes, absolute sword control, unused TUNE knobs and old ledger fields.
   - Keep the TUNE presets that the playtests still use.
   - Group `game.js` into clear sections, and write `docs/games/arena/CODEMAP.md`.
   - Behaviour is unchanged: a scripted bout plays the same before and after.
2. **A feature build (Sonnet or Opus).** Sections A to F below.

**Release channel.** `games/arena` becomes a normal game on the library's home page. It gets a release copy once the designer has played the v1 build.

## 1. Pitch

Roll a gladiator on the wheels of fate, then fight a gauntlet of five rolled opponents with a sword you aim like a trackpad. Read their tells, slip your blade into the gaps in their armour, and pick upgrades between bouts. You are a nobody from the pit, and mastery is reading a feint without flinching and answering with one clean thrust.

## 1b. Context, story, characters, emotion

These come from `world.md`, including its 2026-10-08 note.
- **The drive:** the underdog's grit, with the reason to fight rolled each run.
- **The cast:** your rolled fighter, Old Brutus the lanista, and the champion who becomes your rival.
- **What v1 carries:**
  - the wheels and the fighter card;
  - Brutus on every card;
  - a reason thread through each gauntlet (section C);
  - the rival who remembers you;
  - the epilogue or the pit wall.

## 2. The first ten seconds

As in `concept.md`:
1. The wheels spin.
2. The fighter card shows: "Lucia, a baker from Capua. Fights for: Debt."
3. Brutus speaks.
4. You tap Fight!
5. A sparring partner raises a glow high, you tap HIGH, the blade rings off your shield, you flick forward, and the tip goes in at his armpit.

Bout 1 is always the sparring partner from proto 10. The hint line shows in the first two bouts ever, as in proto 13.

## 3. Core loop and session shape

- **The loop:**
  1. Roll.
  2. Fight up to five bouts: read the tell, block or dodge, find the gap, thrust, and punish when he is winded.
  3. After each fell, draft one of three upgrades.
  4. End on the epilogue or the wall.
- **Length:** a run lasts about 3 to 6 minutes, and a bout about 30 to 90 seconds.
- **Closing the app mid-run:** the run is saved at the start of each bout and resumed there. The bout in progress is restarted, which is fair because a bout is short.

## A. Distance: the foe closes before he strikes (the difficulty fix)

- **He closes first.** The foe commits to an attack only when the player's body is within his weapon's reach at the moment of the strike. While out of range, he steps in to his weapon's preferred range, then winds up.
- **"Out of reach" means you dodged.** It shows only when the player moved out of range *during* his tell, by dodging back or by the recoil of a lunge. It then counts as a dodge, and the foe gets no free penalty.
- **A long lunge has a cost.** When the player lunges from far range, the foe steps in behind the lunge's recovery, so a missed long lunge leaves the player open.
- **The check, two cheap facts.** In a scripted run where the player stands at lunge range for 30 s, the foe makes 0 "out of reach" swings. If the player backs off during the tell, the strike reads "OUT OF REACH" and is logged as a dodge.

## B. The left thumb, simplified

- **Remove the step rocker.** The left column becomes HIGH, MID and LOW, plus one large **DODGE** at the bottom: tap for the quick backstep, hold to keep backing off while burning stamina (the proto 6 rule).
- **The DODGE button** spans the column width and is at least 64 px tall.
- **Walking in is the lunge,** as now. The arena walls stay: backing into one stops the dodge, with "Back to the wall!".

## C. Reasons with a face, and background perks

From `world.md`, the 2026-10-08 note.

- **Each reason ties the champion to it, and runs a thread through the gauntlet:**

  | Reason | The champion | The thread | The epilogue |
  | --- | --- | --- | --- |
  | Revenge | the man who burned your village | Brutus's lines escalate | (unchanged) |
  | Debt | in the moneylender's pay | a sum knocked off the debt per fell, shown as a number | (unchanged) |
  | Freedom | a freed man back for the money | a notch on the wooden sword per fell | (unchanged) |
  | Glory | the crowd's darling | the crowd chants your name louder each bout, with a banner and a sound | (unchanged) |

  The champion's intro card names his tie, for example "Marcus the Red. He burned your village."
- **Each background gives one perk,** shown on the fighter card in one line:

  | Background | Perk |
  | --- | --- |
  | Farmer | +½ heart |
  | Soldier | +1 shield hit |
  | Horseman | dodges 20% quicker |
  | Baker | Second Wind once per run |
  | Sailor | no push-back from a bash |
  | Scribe | feint shimmer 0.2 s longer |

  Origins map to backgrounds as rolled. Each background also gets one line in Brutus's pool.

## D. Weapons, fixed

- **The dagger's slot hits do 4x the bare-hit damage of a dagger hit,** so they are 1.33 times the gladius's slot damage, not equal to it. The dagger trades reach for the best gaps.
- **The weapon's job line** shows in full on the fighter card. Proto 13's line overlaps it, so it wraps, and the weapon name sits on its own line.

## E. Polish for a new player

- **Keep proto 13's clean end card,** with Details.
- **No overlapping text at 667x375, 844x390 or 932x430.** The fixes include:
  - the weapon line on the fighter card;
  - the intro-card descriptions;
  - the "WINDED" label behind the sword;
  - the foe health bar against the stamina label.
- **The menu** gets the title, Play, Story (Brutus's short intro as one card), Sound, and the pit wall of names.

## F. Saves

- `saveVersion` bump.
- **Kept:**
  - the rival;
  - the pit wall;
  - the feint lesson;
  - the bouts seen;
  - the run resume, at bout start.
- **Dropped:** old prototype keys, handled in migrate.

## G. Out of scope (later versions)

Gold and a market between bouts, the arena ladder (Pit, City, Colosseum, Grand), injuries that carry over, more weapons, a player weapon move set beyond the stat changes, and art packs (the fighters stay procedural).

## H. Naked run

A plain rolled fighter with no upgrades, average rolls and a gladius can fell the champion by reading his tells and thrusting into the gaps. The designer has shown this in play.

## I. Acceptance

- **Cleanup build:** a scripted bout gives identical results before and after; the CODEMAP is written; the smoke test passes; frame time is not worse than arena-v15.
- **Feature build:**
  - A's two facts;
  - B's layout at the three sizes;
  - C's ties, thread, perks and lines (text counts per principle 11);
  - D's dagger damage;
  - E's no-overlap screenshots;
  - F's migrate from a proto 13 save;
  - the smoke test passes.
- **Difficulty is judged by the designer's next runs,** not by a simulation.
