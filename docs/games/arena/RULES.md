# Arena: the rules as built

What the game **is today**, build `arena-v68` (save version 19). The code is the authority: where the PRDs (`prd-v0.1.md`, `prd-v0.2.md`, `prd-v0.3.md`) disagree, this file says what the code does, and section 12 lists the disagreement. A new PRD step is a change request against this file (`docs/process.md`, "Guard rails from the 2026-11-14 review", rule 5).

Numbers are named by their `TUNING` path (in `games/arena/src/tuning.js`). Functions and tables are named, never located by line; find them with `node tools/codemap.mjs arena --where <name>`. `arena-v68` is `arena-v67` split into modules with no change in play (CHANGELOG, ADR-0024).

## 1. The game in five lines

- A side-view, landscape, two-thumb gladiator duel. The right thumb is the weapon arm; the left thumb works the shield (HIGH, MID, LOW) and one DODGE.
- A run is one arena: roll a fighter on six wheels, buy kit with a purse, then fight a gauntlet (five bouts; four in the Grand Games), the last one a named champion.
- Between bouts the player drafts one card of three, visits the tent once and the bandage stall before the champion.
- A run is won by felling every foe in the gauntlet; it is lost when the player's hearts reach zero.
- Fame from every run buys lasting unlocks in Brutus's ludus; a won arena opens the next.

## 2. A run, start to end

1. **Story.** A fresh save opens on Old Brutus's five animated cards (`STORY`, `story`; timings in `story`), with a Skip plaque. It can be replayed from the menu.
2. **Menu** (`menu`): Play (or "Resume: arena, bout N" when a run is saved), New run, The Ludus (a gold dot when fame buys something, `ludusBuys`), Story, Sound, Training, and the two walls (champions carved in stone, the fallen in chalk).
3. **Arena picker** (`pickArena`): the arenas opened so far, plus the next one shut with its champion's silhouette. A veteran from the Wall of Champions may be picked instead of a roll, only in an open arena above the one they cleared (`vetArenas`, `vetMe`).
4. **The roll** (`roll`): six wheels, one at a time: size, Strength, Speed, Stamina, origin, reason (`ME_WHEEL`, `rollMe`). Each stat wheel's odds are a named tier tilted by size and by the stat before it (`me.statTiers`, `me.tilt`, `me.chain`, `statTier`). The run's one token (`token`: 1) can Respin one body wheel here (`respinMe`) or Reroll a draft later.
5. **The purse** (`drawPurse`, "THE ARMOURER'S TENT"): 45 gold in every arena (`purse.gold`) buys a weapon, plates by the slot, a sidearm, a second blade and knives (`purseCost`). Gold left over carries into the run.
6. **Training yard** on the first run only, before bout 1 (section 10).
7. **The bouts.** An intro card ("Tap to fight") with the foe's card and Brutus's line (`brutusIntro`), then the fight. A bout ends when the foe (both foes, in a pair) falls, or the player does.
8. **After each fell** except the last: the grade card and the gold, then the draft (section 7). Each fell heals `heal` (1) heart.
9. **The tent** once a run, after bout `tent.after` (3) (`openTent`).
10. **The bandage stall** before the last bout's champion (`bandageDue`, `openBandage`): 1 heart per `tent.bandage` (15) gold, and knives. Skipped when at full health and no knife is affordable. Not before the Grand Games' earlier champions.
11. **The champion** is bout 5 (bout 4 in the Grand Games). A champion who fells the player is saved as that arena's rival and returns in their place next run (`rollGauntlet`, `rivalOf`, key `rivals`).
12. **The ending** (`endingOf`): the Pit's epilogue, the City's or the Colosseum's chapter, or the Emperor's thumb in the Grand Games (section 8). Then the end card (`over`).
13. **Fame and the ludus:** the run's fame is added (`fameOf`), a win carves the fighter on the Wall of Champions (`carveChampion`, the newest `ludus.wallMax` (30)); a loss chalks the name on the wall of the fallen (the newest 8).

The run is saved at the start of every bout and at an open draft, tent or stall, and resumes there (`saveRun`, `resumeRun`).

## 3. Controls

The left third of the screen is the left thumb's (buttons only). Any touch starting elsewhere is the sword thumb, unless it starts on the finisher button or a round button (`play`'s pointer-down: `finTouch`, then `armsTouch`).

**Right thumb: the weapon arm** (`moveHand`, `updateAttack`, `poseYou`). The thumb is a trackpad from wherever it lands: hand offset is thumb offset x `control.gain` (1.6) from the guard (`control.guard`). The hand has weight (`hand.lag`, x `me.spdLag` by Speed, x `hand.tiredLag` at zero stamina). A blow is born when the blade tip passes `hit.minSpeed` (400 px/s) and is named by how it moves:

| Gesture | Recognised when | Costs (stamina, x weapon `cost`) | Does |
| --- | --- | --- | --- |
| Guard | thumb down, hand slow | nothing | blade follows the thumb; lifting eases back over `control.back` s |
| Jab | push along the guard line (cosine over `control.jabCone`, 0.68) at `attack.jab.minSpeed` (520) | `attack.jab.cost` 8 | `attack.jab.dmg` 2; the piercing point into a gap is a gap hit |
| Slash | any other arc | `attack.slash.cost` 14 | `attack.slash.dmg` 1, or `attack.slash.fastDmg` 2 at `hit.mid` (950 px/s) |
| Overhead | hand raised `attack.over.raise` (0.14 H) above the guard, then a stroke down (downward share over `attack.over.down`) within `attack.over.window` (0.8 s) at `attack.over.minSpeed` (520) | `attack.over.cost` 20 | `attack.over.dmg` 3, `attack.over.dents` 2; it is planted: no lunge and little lean back (`over.leanBack`) |
| Raise | an upward stroke (hard-coded share, see 12) | nothing | no blow |
| Lunge | thumb offset past `control.lungeStart` (1.3 arm lengths); full at `control.lungeFull` (1.7) | `lunge.cost` 10 | steps in up to `lunge.stride` (0.3 H); the recovery keeps up to a pace of ground (`foot.pace`) |
| Drive | a committed lunge held at full depth for `lunge.driveNear` (0.2 s; `lunge.driveFar` 0 s when the foe stands beyond a plain lunge) | `lunge.driveCost` 25/s, plus one jab's cost as it starts | presses on at `lunge.drive` (0.6 H/s), up to `lunge.driveMax` (0.3 H); ends on a hit, his body or an empty tank (`drive`) |

At zero stamina the player is EXHAUSTED for `stamina.exhaust` (1.5 s): no blows. A blow begun at zero stamina deals x `stamina.tired` (0.5). Stamina: `stamina.max` 100 at Stamina 3 (`me.staMax` by stat), regen `stamina.regen` 45/s after `stamina.delay`, x `stamina.idleMul` when the shield is down.

**Left thumb** (`shieldBtns`, `colRect`): three stacked buttons HIGH, MID, LOW and DODGE below; touch area `col.reach` px past each edge.

| Input | Does | Numbers |
| --- | --- | --- |
| HIGH / MID / LOW tap | raises the shield at that height for `shield.dur` (0.6 s); only the matching zone blocks | perfect within `shield.perfect` (0.25 s) of the raise (`perfectWin`) |
| Hold | keeps it up | drains `shield.drain` 3 stamina/s |
| Slide to another height | moves at once, counts as a fresh raise | no cooldown |
| After a raise that blocked | cooldown | `shield.cool` 0.25 s; exhausted, a raise waits `shield.slow` 0.45 s |
| DODGE tap | a backstep: out of reach for `dodge.dur` (0.35 s x `me.spdDodge`), gives `foot.back` ground | `dodge.cost` 12, then `dodge.cool` 0.2 s |
| DODGE hold | keeps backing off at `foot.walkBack` H/s | `dodge.drain` 14/s |

A dodge at the wall is refused ("Back to the wall!", `backToWall`). A dodge begun while the foe's fake still shows is BAITED (`bitFeint`): the dodge locks for `feintBite.lock` (0.8 s) and the real blow comes on a shorter tell (x `feintBite.wind`). A lunging fighter cannot raise the shield.

**Round buttons, bottom right** (`armsBtns`; radius `sidearm.btn.r` 26 px):
- **⇄** (with a sidearm): `startSwap`, `sidearm.swap` 0.5 s with no block and no swing; a foe in reach strikes within `sidearm.punish` (0.35 s). With the bow: `swapBow`, `bow.swap` 0.7 s.
- **Knife button** (above ⇄; hidden while the bow is out): raises a knife (`startAim`). While raised: no block, no swing. The right thumb moves the aim ring `knives.lift` px above itself; only a drag of `knives.drag` (20 px) then release throws (`aimUp`); a tap only moves the ring. The ring snaps onto a gap within `knives.snap` (14 px), green over a gap, red over plate. Tapping the button again lowers it.
- **The bow** (sidearm): the right thumb draws (`bowDown`) over `bow.draw` (0.6 s); release looses (`bowRelease`). Released early: TOO SOON. Held to `bow.full` (1.2 s): up to x `bow.power` (1.3). Inside his reach: TOO CLOSE. Arrows are unlimited. The shield is slung on the back: no blocks. DODGE works.

**The finisher button** (`finBtn`, bottom right, `finBtn.w` x `finBtn.h`): shows the costliest war paint that is ready; an arrow chip cycles when two are ready; a tap fires it (`fireFinisher`).

## 4. How a hit is decided

**The player's blow** (`checkHits`, `land`). One hit per stroke: the first thing the weapon meets, a joint gap before the part it sits on. Each weapon has striking rows for a jab and for a swing (`strike.<weapon>`); the rest is haft.

| Result | When | Effect |
| --- | --- | --- |
| Gap hit | a piercing jab into a gap along its slit (within `cover.jabTol` rad; x `strike.trident.wide`), or a gap opened by a feint | damage x the weapon's `slot` (`gapHit`); a deep sound and ring |
| Hit | bare flesh, or a gap struck the wrong way | damage x `dmg` x the part's multiplier; cuts bleed |
| Clang | plate, a gap guard, his guard or shield (`covered`) | no damage; dents by kind (`bounce`); recoil `attack.<kind>.recoil` |
| Thud | the haft meets him (`shaftHit`) | x `strike.thud` (0.25), a push of `strike.push`; no gap, bleed or dent |

Damage (`gapHit`): the blow's base x `me.str` x size `dmg`, rounded, then x the weapon, to the half heart; x `foeSta.windedDmg` (1.5) when he is winded (PUNISH); x `shield.riposteMul` (2) within `shield.riposte` (1 s) of a perfect block (RIPOSTE); card multipliers capped at `cards.mulMax` (4).

**Kinds** (`strikeOf`): **cut** bleeds bare skin (`strike.cut.bleed` 0.5 of a stack per cut, `cutBleed`) and dents a plate only x `strike.cut.dent`; **pierce** is the gap hit and never dents; **crush** dents fully and every `strike.crush.stagger` (3rd) crush that lands staggers him (`crushLands`). The sica's cut hooks: x `strike.hook.bleed` bleed and a pull of `strike.hook.pull` H.

**Plates.** A plate breaks at `armour.dents` (3) dents (the axe's overhead at `me.weapons.axe.overBreak` 2; barding at `beasts.armour.dents`). A broken helmet opens his face as a gap (`FACE_SLOT`). His **gaps** are the neck, armpit, waist, elbow and knee (`SLOTS`); his armour set opens 3, 4 or 5 of them (`armourSets`), and gap guards shut some (`GUARDS`, `rollGuards`).

**His cover** (`setCover`): after a blow lands he slides his guard (`foe.coverGuard`) or shield (`foe.coverShield`) over that spot for `cover.dur` (3.2 s). It drops while he swings, is open, winded or stunned. A blow on it costs him `foeSta.block` stamina.

**Bare-part damage and laming** (`disable`): a bare part takes `part.hp` (3) damage and goes DOWN. The head: stunned `stun` (1.2 s). A limb is lamed for the bout (`lame`): sword arm wind-ups +`lame.arm`; shield arm cover x `lame.cover` slower; legs x `lame.legs`.

**Bleed** (`addBleed`, `updateBleed`): at most `bleed.max` (5) stacks, each `bleed.dur` (6 s), each tick (`bleed.tick` 1 s) dealing `bleed.dmg` (0.5).

**Stagger and stun** (`staggerFoe`, `stunFoe`): either drops his blow in the making; a stagger lasts `shield.stagger` (1 s) and pushes him back.

**His blow on the player** (`resolveOne`). In order: a dodge begun in his tell, or a blow out of reach after giving ground (`foot.give`), is a dodge; a raised shield at the right height blocks; otherwise it lands.
- **Block:** wears the shield by his weapon's `wear` (a bash 1) and drains his weapon's `drain` (the axe 18). The shield breaks at `shield.hits` (6) (`shieldMax`).
- **Perfect block:** within the window and not a net or bash: no wear, he staggers (unless the move is a chain), a riposte window opens, Momentum `mom.perfect`, and he is pushed back.
- **Landing:** hearts = his blow (`blowDmg`, at most `foe.dmgCap` 3) x his striking part. On a plated part it is divided by `me.plateDiv` (2), rounded up, unless it crushes. High hits the head, MID the chest, LOW the legs (`ZONE_PART`). His haft is a thud (`shaftOnYou`).
- **Bash and shove:** drain `moves.bash.drain` (30) stamina and push the player back; blocked, x `moves.bash.blocked`. **Net:** slowed for `moves.net.dur` (2.2 s), hand lag x `moves.net.slow`, no lunges (`net.stuck`).

## 5. The player's fighter

**Size** (`me.wheels.size`, `me.sizes`, `sizes`): hearts are the band's `hearts` x `me.heartsPerBase` (2), plus `me.underdogHalves` (1) when the body score is under `me.underdog` (6.5) (`deriveMe`). Health is whole hearts.

| Band | Hearts | Arm | Hand lag | Damage (`sizes`) |
| --- | --- | --- | --- | --- |
| Runt | 8 | 0.9 | 0.75 | 0.8 |
| Lean | 10 | 0.95 | 0.85 | 0.9 |
| Medium | 12 | 1 | 1 | 1 |
| Big | 14 | 1.05 | 1.15 | 1.2 |
| Giant | 18 | 1.1 | 1.3 | 1.4 |

**Stats** 1 to 5 (Feeble to Mighty): Strength `me.str` (damage 0.75 to 1.3); Speed `me.spdLag` and `me.spdDodge`; Stamina `me.staMax` (70 to 130) and `me.staRegen`. The tier S to D is the body score (`me.tiers`).

**Origins** (`ORIGINS`, `TRAITS`, `origins`) deal a start card of their family (`START_FAM`, `startCard`) and carry one always-on trait:

| Origin | Background, start family | Trait (number) |
| --- | --- | --- |
| Gaul | farmer, Brute | Ox-Strong: regen x `origins.gaul.regen` (1.15) |
| Thrace | soldier, Wall | Shield Drill: every `origins.thrace.every` (4th) block wears nothing |
| Numidia | horseman, Dancer | Light Feet: dodge cost x `origins.numidia.dodge` (0.75) |
| Capua | baker, Showman | Kneading: quick hits +`origins.capua.step` each, up to `origins.capua.max` |
| Ostia | sailor, Blood | Sea Legs: pushes x `origins.ostia.push` (0.5) |
| Alexandria | scribe, Trickster | Reads the Scroll: fakes show `origins.alexandria.sooner` (20%) sooner |
| Sparta (ludus) | gladiatrix, Wall | Spartan Guard: perfect window x `origins.sparta.perfect` (1.3) |
| Egypt (ludus) | freed slave, Brute | Broken Chains: once a run, a killing blow leaves `origins.egypt.hearts` (1) |
| Circus (ludus) | charioteer, Dancer | Steer Him: shoves x `origins.circus.push`, the wall costs him `origins.circus.wall` |

While the Trickster or Showman is shut, the scribe and the baker start with `START_ALT`'s family.

**Reasons** (`DRIVES`, `reasons`): Freedom, Nothing to Lose (at or under `reasons.freedom.below` of hearts, x `reasons.freedom.dmg`); Debt, Every Win Pays (gold x `reasons.debt.gold`); Revenge, Him Last (x `reasons.revenge.dmg` on the champion and the rival); Glory, Louder (favour x `reasons.glory.fav`); A promise (ludus), She's Waiting (+`reasons.promise.heal` heart a fell). The reason also picks Brutus's lines and the champion's tie and ending.

**Weapons** (`me.weapons`; price `purse.weapon`; striking rows `strike`):

| Weapon | Price | Reach | Speed | Dmg | Cost | Gap x (`slot`) | Strikes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Fists | 0 | 0.5 | 1.6 | 0.5 | 1 | 2 | crush, never dents (`me.weapons.fist.noDent`) |
| Gladius | 15 | 1 | 1 | 1 | 1 | 3 | point pierce, edges cut |
| Spear | 15 | 1.35 | 0.85 | 1 | 1 | 3 | head pierce; swing cut x 0.6 |
| Axe | 20 | 0.9 | 0.75 | 1.7 | 1.4 | 3 (x `me.weapons.axe.slotDmg` 1.7) | spike pierce; blade cut and crush; overhead breaks at 2 |
| Mace (an axe) | 20 | as the axe | | | | | crush |
| Dagger | 15 | 0.65 | 1.4 | 0.75 | 1 | 4 | point pierce, edges cut |
| Trident (ludus) | 20 | 1.5 | 0.8 | 1 | 1.1 | 3 | prongs pierce, wide; first perfect block a bout nets him (`me.net`) |
| Sica (ludus) | 15 | 0.8 | 1.2 | 1 | 1 | 3 | hooking cut x 1.2; no jab rows (see 12) |

**Plates** (`PLATES`, `purse.plate`): helmet 10 (head), chest plate 15 (chest and belly), greaves 10 (legs). The plate count sets stamina regen (`me.plateSets`, `me.armour`: none or 1 x1, 2 x0.92, 3+ x0.82).

**The reinforced shield** (the Arms slot's `manica`, 10 gold): the shield takes x `purse.reinforce` (1.5) blows, 9 for 6 (`reinforced`). Not with two blades.

**Two blades** (Arms slot, gladius or dagger, `dual.weapons`, at the weapon's price again): no shield. Crossed blades block, letting through x `dual.through` of a blow and costing `dual.cost` stamina; holding drains x `dual.holdDrain`. A perfect block ripostes with the off hand. A slash that lands is followed by the off hand for x `dual.part`.

**Sidearm** (purse's Sidearm slot, at its weapon's price, or the bow at `bow.price` 20; not fists, not the weapon in hand): a melee sidearm keeps the shield on the arm.

**Knives** (`knives`): `knives.price` 8 each, at most `knives.max` 6, bought in the purse, the tent and the stall (`knifeRow`, `knifeBuy`), kept for the run. In a gap: `knives.dmg` 5 (`knifeGap`); on plate or skin: nothing; flight `knives.speed` H/s.

**The bow's arrows** (`arrowLands`): a gap takes `bow.gap` (2) x a gladius jab's gap hit (`plainGap`) x the draw's power; bare skin `bow.skin` (1) and a stagger; plate nothing. Raising it makes him rush in (x `bow.rush`) and a beast strike within `bow.pounce` s.

## 6. Foes

**The gauntlet** (`GAUNTLET`, `rollGauntlet`, `rollFighter`). Five rows; the Grand Games use rows 2 to 5.

| Row | Sizes lean | Armour | Adds |
| --- | --- | --- | --- |
| 1 | runt to medium | light | a sparring partner with a slow tell |
| 2 | all | light, medium | feints, counters, jab read |
| 3 | medium to big | medium | memory |
| 4 | big | medium, heavy | |
| 5 | big, giant | heavy | the champion |

Each bout's weapon is a different one of the four foe weapons where it can be. His health (`makeFoe`): `foe.hp` (22) x his size's `hp` (`sizes`) x (1 + `foe.tierHp` x tier) x `foe.champHp` for a champion x `arenaHp` x the bout length. His stats split a budget (`foeStats.budget` by bout, plus `arenas.<id>.shift`) by a profile (`profiles`, `PROFILES`: Brute, Duelist, Glass cannon, Tank, Balanced), weighted by size. Size scales damage, reach, wind-up and footwork (`sizes`).

**Foe weapons** (`weapons`):

| Weapon | Shield chance | Drain a block | Wear a block | Leans to |
| --- | --- | --- | --- | --- |
| Gladius | 0.7 | 0 | 1 | combos |
| Spear | 0.5 | 0 | 1 | thrusts (`moves.thrust.high` at the face) |
| Axe or mace | 0.3 | 18 | 2 | chops |
| Dagger and net | 0 | 0 | 1 | thrusts, feints, the net |

**What he does** (`planExchange`, `buildMove`, `startBlow`). Each exchange is planned with the seeded fight RNG and played out exactly: a rhythm (`rhythm`: flurry, probe, pause), then one to three moves (`moves`: chop, thrust, sweep, combo, feint, bash with a shield, net with a net). Every blow has an honest tell: a wind-up glow on its zone (`swing.windup` scaled). He steps to striking distance just before he strikes (`stepFoe`) and commits only with the player in reach.
- **Feints** (from row 2): the fake zone shows for `moves.feint.show` of the tell, then the glow jumps to the real zone. Blocking the real one is a read: he loses `feintRead.drain` of his stamina bar. The first two feints ever are slowed and captioned (`lesson`, save key `feintLesson`).
- **Combos:** several blows; he is winded after (`foeSta.combo`).
- **Stamina:** a bar of `foeSta.base` + `foeSta.per` x Stamina; at zero he is winded `foeSta.winded` (1.5 s), guard down. After each move he is open `open.dur` (1.1 s).
- **Counters** (from row 2): after an overhead clang, or any clang on a shield-bearer (`counter`).
- **Memory** (from row 3, or with the Eye Amulet; `memoryOn`): three same-zone blocks make him avoid that zone; two lunges in `read.lungeWin` make him sidestep; turtling makes him feint and bash more; low stamina makes him press.
- **The jab read** (from row 2): after `foe.jabRun` (3) jabs in a row met his guard, his guard is over the next jab's mark `foe.jabRead` s after it starts (`jabsRead`, `readJab`).
- **Retreat:** hurt below `retreat.hurt`, he may back off (`retreat`).
- **Gear** (`rollGear`, `foeGear`): pieces from the deck; six act (Thorns, Bloodlust, Riposte, Unbreakable, Dark Hood, Eye Amulet), the rest are a look.
- **Sidearm** (City on, `sidearm.foe`): a spearman may carry a gladius, drawn when the player closes (`foeSidearm`).
- **Two blades** (City on, `arenas.<id>.dual`): no shield, one more gap (`dual.gaps`), crossed blades that break after `dual.breakAt` blows.

**Pairs** (`pairAt`, `updatePair`, `stepIn`): a second foe waits at the edge. When the first is winded or felled, the second steps in; both must fall. The first falling heals `pairs.heal` (2) hearts.

**Beasts** (`BEASTS`, `beasts`, `rollBeast`): a lion (crouch then pounce, raised paw then swipe) and a bear (rear then maul, head down then shove). No shield, gear, guards or feints. Their gaps are the throat, a foreleg joint and the flank or belly (`BEAST_BODY`). A young beast is a band smaller (`beastYoung`); a barded beast wears plates (`beasts.armour`).

**Champions** (`CHAMPIONS`, `NEW_CHAMPS`; signatures in `champs`, `SIG_NAME`, `buildSig`). A signature waits `champs.<key>.every` exchanges, then comes at `champs.<key>.chance` (0.6), and surely after `champs.<key>.sure` (3):

| Arena | Champion | Signature |
| --- | --- | --- |
| Pit | Flamma the Unbroken, Aurelius the Golden | none |
| Pit | Marcus the Red | Red Rage (below `champs.marcus.below` of his health) |
| Pit | Varro of Capua | Capuan Feint |
| City | Castor and Pollux, the Twins (a pair) | none |
| City | Hermes the Swift | Blink |
| Colosseum | Carpophorus the Beastmaster | sends his lion at `champs.carpophorus.send` of his health |
| Colosseum | Mevia the Huntress | Huntress's Throw; her spear also nets |
| Grand Games | Aquila, the Emperor's Blade | Two Blades (at `champs.aquila.at` of his health) |

## 7. Cards

73 cards in `DECK` (`data.js`), each with numbers in `CARD_NUMS` and effects in `HOOKS` or read with `has`. Families (`FAMS`): **the Wall** (blocks), **Blood** (bleed), **the Dancer** (dodges), **the Brute** (plates and overheads), **the Trickster** (the player's own Feint: a lunge pulled back, `myFeint`) and **the Showman** (the crowd). Plus **war paint** (six finishers), one lone rare (Unbreakable), and **sets** (duos, `duo`: two families).

- **Rarity** (`tier`): common, rare, epic, legendary (`TIERS`). Each family's legendary is a keystone (`key`) that names its price, for example Iron Wall ("Easy blocks open gaps. No dodge.") and Titan ("No dodge").
- **Slots** (`SLOT_NAMES`): every non-set, non-paint card is a piece of gear in one of eight slots; a new piece replaces the one worn there (`applyCard`, `replaces`).
- **The vault** (`vault`): 20 cards (an epic and a legendary per family, eight sets) dealt only once that family's scroll is bought. Vault legendaries grow with each card of the family worn (`growth`).
- **Examples:** Riposte (a perfect block stabs back), Serrated Edge (gap stabs bleed), Sidestep (dodging his wind-up winds him), Heavy Arm (overheads dent twice), Feint, Flourish (a fast thumb circle pleases the crowd, `flourish`), Butcher (set: broken plates bleed).
- **Rules on dealing** (`dealable`): each card once; never one the player's keystone makes useless (`needs`, `bans`); a set only while both families are worn; nothing of a family the ludus shuts; no shield card with two blades.

**Momentum and finishers** (`mom`, `fin`): pips 0 to `mom.max` (5) a bout, from a perfect block, a feint read, a dodge in his tell and a laming (1 each). The finisher button spends them: Execute 3 (a gap stab fells him below `fin.below` of his health), Whirlwind 2 (the next slash hits every gap it crosses), Second Breath 2 (all stamina), Disarm 4 (`fin.disarmDur` s of fists), False Opening 3 (his next blow misses and winds him), Showstopper 3 (favour and awe).

**The draft** (`openDraft`, `dealDraft`): three cards (`draft.deal`; four in the run's first draft with the ludus's fourth card).
- Two free, common or rare by the grade's odds (`draft.odds`); an A makes one sure rare (`draft.sure`). From bout 3 each may be an epic (`draft.boutEpic`); after an S from bout 3, one is a sure epic (`draft.sureEpic`).
- The third is priced and cascades: a set at `draft.cascade.set`, else a legendary, else an epic, else a rare (`CASCADE`). Prices `draft.price` (rare 30, epic 45, legendary 60), a set `draft.duoPrice` 50. An unaffordable card shakes.
- Families worn pull x `draft.pull`; at most `draft.perFam` of a family in one draft.
- A tap takes a card after `draft.delay` s; a long press (`draft.long`) shows its full line.
- **Skip** pays gold from `draft.skip` 10 after bout 1 to 20 before the champion (`skipPay`). **Reroll** spends the token (`rerollDraft`).
- **Spoils:** the felled man's weapon can be taken in place of the player's (`spoilOf`, `swapSpoil`).

**The tent's wares** (`WARES`, `tent.price`): two big (an iron plate 40, Whetstone +1 damage 50, a heart 35, Lucky token 25, a forged weapon x `tent.forge` 60) and one small (the old commons, 12 to 20: Thick Hide, Big Lungs, Quick Wrist, Steady Shield, Sandal Grip, Quick Feet, Deep Breath, Sharp Edge, Tough Shield, Wide Stance), plus knives (`buyWare`).

## 8. The crowd, gold and fame

**The crowd** (`crowd`, `favour`, `crowdEvent`, `crowdDrain`): favour 0 to `crowd.max` (100), carried through the run. It fills with a feint read (`crowd.read` 5), a perfect block, a gap hit and a laming (2.5 each), a clean bout (`crowd.clean` 5), two hits within `crowd.comboWin` s (`crowd.combo` 1) and a finisher (`crowd.fin`). It drains with turtling (`crowd.turtle`), backing off with no blow coming (`crowd.back`), and idling past `crowd.idle` s. Coins fly in at each `crowd.step` (20). **The Emperor's thumb** (Grand Games) reads the average favour over Aquila's bout (`thumbFav`) by thirds (`crowd.bands`): always thumbs up; the top third gives the reason's true ending (`TRUE_END`), the others `THUMB_END`.

**Gold** (per run, `boutGold`): a fell `gold.fell` 20, each read `gold.read` 4, perfect block `gold.perfect` 2, gap hit `gold.slot` 2, a clean bout `gold.clean` 15, plus the crowd's share (x `crowd.pay` x favour). Gold buys draft cards, wares, bandages and knives.

**Grade** (`gradeBout`): S, no hits taken and 3 good moves; A, at most 2 hits and 4 good; B, at most 4 hits; else C (`grade`; a pair bout allows `grade.pair` more hits). Good moves: gap hits, reads, punishes, perfect blocks, dodges in his tell, lamings, landed bashes (`boutTally`).

**Fame** (forever, `fame`): each bout won `fame.bout` 3, a champion `fame.champ` 10, an arena's first clear `fame.clear` 25, the thumbs-up ending `fame.thumbUp` 10, 1 per `fame.goldPer` (50) gold left.

**The ludus** (`LUDUS`, `ludus.price`): one tap per unlock.

| Station | Unlocks (fame) |
| --- | --- |
| Armoury | trident 30, sica 30 (sold in the purse) |
| Barracks | Sparta, Egypt, Circus origins 25 each; the Trickster and the Showman families 40 each |
| Training Ground | a start card, any common or rare picked before (`startable`) 60; a fourth card in the first draft 50 |
| Shrine | the promise reason 30 |
| Tailor | crest, plume, shield paint 15, cloak 20 (looks; a tap cycles `TAILOR` styles) |
| Vault | a scroll per family 45 (the Trickster's and Showman's need their family first) |

A champion on the Wall can return as a veteran with +`ludus.vetUp` on one stat (at most `ludus.vetCap`).

## 9. Arenas

One run is one arena (`ARENAS`, `arenas`). Each adds stat shift, feint rate, gap guards, gear, plates and size weights to its foes, and x `arenaHp` to their health.

| Arena | Rule | Bouts | Numbers |
| --- | --- | --- | --- |
| The Pit (Capua) | the tight ring: walls at x `arenas.pit.ring` (0.7) | 5 | no shift, no pairs |
| The City (Pompeii) | pairs from bout 3 (`arenas.city.pairs`) | 5 | health x 1.25, two blades 0.2, sidearms 0.3 |
| The Colosseum (Rome) | men and beasts: beasts at bouts 2 and 4 (2 young, both barded), a pair at bout 3 | 5 | health x 1.5, +1 gear, +1 plate |
| The Grand Games (Rome) | every champion: one from each arena's pool (the player's Pit rival first if one waits), then Aquila | 4 | health x 1.75 |

Felling an arena's champion opens the next for good (save key `arenas`).

## 10. First run and teaching

- **Training yard** (`YARD`, `startYard`, `updateYard`): on the first run before bout 1 (`yardDue`; `trainDone` in the save), and from the menu's Training. Bout 1's sparring partner stands in; nobody loses hearts. Each step: one Brutus line, a ghost thumb fitted to the fight (`ghostPath`), no timer, a tick and chime when done, a "why it didn't count" word (`WHY`). Skip training ends it.
- **Steps:** hand, jab x `train.jabs` (2), slash x `train.slashes` (2), overhead x `train.overs` (1), lunge, shield at HIGH, MID, LOW, dodge tap, dodge hold, a gap, a knife throw (one practice knife, `train.knife`), a read, a perfect block, a dodge in his tell, "Now fight."
- **First-run kit:** the purse opens with a gladius and a chest plate (`purse.first`). Fight! with no plate while one is affordable asks once: Buy a plate or Fight bare.
- **One-time hints** (`updateHints`, each once ever): Brutus's jab nudge after `train.spam` (6) jabs in a row in the first `train.spamRuns` runs; then, never in the first run's bout 1: the HUD's bars (first run), the crowd's first third, full Momentum with no war paint, hearts after the first fell, the drive after a lunge that met nothing. Also the finisher button's first appearance (`updateFinisher`), the first bitten feint, and the first draft's "Pick one. Tap it."
- **The knife lesson** (`KNIFE_LESSON`, `lessonDue`): the first bout ever begun with knives, once (`knifeHint`): tap to raise, drag onto a glowing gap, let go. The foe holds still.

## 11. Saves and the export

**Save version 19** (`game.saveVersion`, `game.migrate`). Keys: `run` (the saved run), `last` (the menu's fighter), `rivals` (per arena), `arenas`, `wall` (fallen), `champs` (Wall of Champions), `fame`, `ludus`, `tailor`, `startPick`, `picked`, `best2`, `runsDone`, `firstRunDone`, `trainDone`, `storySeen`, and the hint flags (`feintLesson`, `baitHint`, `finHint`, `jabHint`, `hudHint`, `crowdHint`, `momHint`, `heartHint`, `driveHint`, `knifeHint`, `purseHint`, `boutsSeen`).

**A run save** (`saveRun`): seed, arena, the bout to resume at, the fighter, the rival, the Grand Games' first rival, an open draft's cards, and every key in `RUN_KEYS` (hearts, picks, grades, gold, token, wares, knives, favour and the run's counters). The bout itself replays from its seed.

**The export** (`E.ledger.add('result', ...)` in `play`'s `finish`):
- **Outcome:** won, reached, halves (hearts left), arena, grades, goods, fame, gold, goldEarned.
- **The player:** meName, meSize, meStats, meArmour, mePlates, meTier, underdog, meWeapon, origin, reason, vet, buy, purseLeft.
- **The foes:** sizes, profs, weapons, armour, stats, champ, lostTo, rival.
- **Blows:** gapHits, slotHits, lunges, drives, driveDist, clangs, broken, overheads, jabs, slashes, lamings, bleeds, bleedDmg.
- **Defence:** blocks, perfects, dodges, dodged, staOuts, taken, plateSaves, shrugs, counters, counterHits, outReach, stepsIn, stepsOut, wallHits, foeWall, chases.
- **His play:** feints, feintsRead, switchReads, feintsBit, feintsNone, baited, combos, windeds, punishes, bashes, bashHits, nets, netted, zoneReads, lungeReads, turtleReads, presses, retreats, moves, specials.
- **Cards and money:** picks, bought, wares, tent, fins, momGained, momSpent, token, epicsSeen, skips, spoils, chains, myNets, lab, fav, favAvg, thumb.
- **Arms:** knives, knifeGaps, knifePlate, knifeSkin, knifeMiss, swaps, foeSwaps, arrows, arrowGaps, arrowSkin, arrowPlate, arrowMiss, bowTime.
- **Yard:** yard (and yard2 past `train.field` characters), yardSkip (`yardFields`).

## 12. Known gaps and oddities

**Code and PRD disagree** (the code is what is written above):
1. `prd-v0.3.md` K6 says a new save starts with only the Wall, Dancer and Brute, with Blood locked. The code locks only the Trickster and the Showman (`FAM_LOCK`); Blood is open from the start, and the barracks sells no Blood unlock.
2. Step 24, part 1, says the bow swap is "the same 0.5 s"; part 4 says 0.7 s. The code uses `bow.swap` 0.7.
3. Step 22 says "a card may give one or two" knives. No card gives knives.
4. Step 23b quotes the overhead as 0.2 H above the shoulder, a 0.6 s window and 750 px/s. The code is `attack.over.raise` 0.14 H above the guard, `attack.over.window` 0.8, `attack.over.minSpeed` 520.
5. Section D's tent sells "a respin or reroll token" and "a weapon one tier up". The code's token rerolls a draft only, and the weapon ware is a forge (x `tent.forge`).
6. Section C says a low meter gets thumbs down. Step 10 made the thumb always up, and so does the code.
7. Step 23 says every card of 67 gets a `short`; there are 73, all with one.
8. Steps 25 to 27b (the range, blows that look like themselves, Trials) are locked or drafted but not built.

**Oddities:**
- `TUNING.hearts` (6) is read nowhere; hearts come from `me.sizes` and `me.heartsPerBase`.
- `me.wheels.armour` and `me.wheels.weapon` are not spun; they record the purse's buy. `me.armour`'s `n` and `arm` are read only by `migrate`.
- The sica has no jab rows (`strike.sica.jab` is empty), so every sica jab is a haft thud.
- In `updateAttack`, the raise's upward share (0.7) and the blow's keep-alive speed (x 0.55) are inline numbers, not in `TUNING`.
- The tent's iron plate offers only head, chest or legs, never the Arms slot.
- A knife on bare skin does no damage, while an arrow on skin does.
- Flamma, Aurelius and the Twins have no signature move.
- `LUDUS`'s comment says five stations; there are six (the vault).
- The file header's comment still says eight wheels and five opponents.
- The card lab (`state.lab`) and the bout-length presets (`boutLength`) are dev-only. Not verified how they are reached.

**Not verified:** what tier value `makeFoe` multiplies by `foe.tierHp`; the exact gap count `dual.gaps` adds in play; how the in-play hint `hint.bouts` is shown.
