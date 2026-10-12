# Arena PRD v0.3: v2, the road to Rome

| | |
| --- | --- |
| Slug | `arena` |
| Version | 0.3 (v2) |
| Date | 2026-10-12 |
| Status | **draft 2**, for the designer |

**Basis:**
- v1 (`prd-v0.2.md`, released as v1.5) and its playtest (`playtests/2026-10-12-v1.md`);
- the list v0.2 G parked;
- the designer's calls and the roast of draft 1 (below).

**Decisions from the designer (2026-10-12):**
- "One run is one arena."
- "Gold within a run. Often games do some upgrades that last over time and some only for runs."
- The roast's version is liked ("I like this better, yes"). Keep planning before building.

**What the roast changed from draft 1:**
- Each arena changes *how* you fight, not just the numbers.
- The crowd earns your gold.
- The market is folded into the draft, plus one tent stop.
- **Fame** and Brutus's **ludus** give lasting unlocks.
- You cripple *him* instead of carrying wounds yourself.
- The art goes on the fighters first.

## 1. Pitch

You are a nobody from the Pit with a reason to fight. Climb four arenas to the Grand Games before the Emperor:
- each arena asks a new kind of fight;
- the crowd pays for style;
- between runs, Old Brutus's school grows with every champion you fell.

Mastery is the same as v1: read the tell, read the feint, slip the blade into the gap.

## 2. Two loops

| | Lasts | Earned by | Spent on |
| --- | --- | --- | --- |
| **Gold** | one run | the crowd's coins (C) | the draft's priced card and the armourer's tent (D) |
| **Fame** | forever | felling champions, and a first clear of an arena | the ludus (E): new options, not raw power |

**The rule that keeps it a skill game:** a lasting unlock widens your choices or adds flavour. It never makes the same fight easier by more than one small step.

## A. The ladder: four arenas, four kinds of fight

One run is one arena. The menu's Play opens an arena picker showing the arenas you have opened, plus the next one locked with its champion's silhouette. Felling an arena's champion opens the next arena for good.

| Arena | Bouts | Its twist | Built from |
| --- | --- | --- | --- |
| **The Pit** (Capua) | 5 | **The tight ring.** The walls stand closer, so backing off is short, wall play matters, and he can pin you. | the v1 walls, nearer |
| **The City arena** (Pompeii) | 5 | **Pairs.** From bout 3, a second foe waits at the edge. When the first is winded or felled, the second steps in, and felling both fells the bout. You fight one at a time, and his partner's taunts are his tells. | the v1 foe, swapped in |
| **The Colosseum** (Rome) | 5 | **The beast bout.** Bout 3 is a lion or a bear. It has no shield and no feints, just short-tell pounces and a swipe. You read it by its crouch, not a weapon glow. The other bouts are against Rome's best. | a new foe kind with its own move set |
| **The Grand Games** (Rome) | 3, then the Emperor's champion | **The Emperor's thumb.** After the final fell, the crowd meter decides the epilogue (C). | the crowd meter |

- **Each arena also tunes its foes,** in one per-arena table in TUNING: grade shift, feint rate and move set.
- **The arena's twist is the headline,** not the numbers.
- **The champions:**
  - the four v1 champions are now the Pit's champion pool;
  - each later arena has a pool of 2 champions with the same mechanics.
- **The rival** is remembered per arena.
- **The beast bout is the riskiest piece** (a new foe kind), so it is built and played first (H).

## B. Crippling him (replaces wounds on you)

- A gap hit on one of his limbs lames it **for the rest of the bout:**
  - **his sword arm:** his wind-ups take 20% longer;
  - **his shield arm:** his cover is slower to move;
  - **his legs:** his footwork and chase slow down.
- **v1 already has disabled parts.** This builds on them, so the effect reads at once: a limp, a dropped guard, a red mark.
- **At most one laming per limb.** Each is shown on his HUD slot as a small icon.
- **You carry nothing between bouts.** The v1 hearts and plates rules stand.

## C. The crowd

- **A crowd meter** sits small in the HUD, beside the BOUT slot, clear of both thumbs. It fills with style:

  | Style | Favour |
  | --- | --- |
  | a feint read | big |
  | a perfect block | medium |
  | a slot hit | medium |
  | a laming (B) | medium |
  | a bout with no hits taken | big |
  | a combo | small |

  It drains a little when you turtle (the existing turtle read) or run.
- **Coins in the sand.** At each favour step, the crowd throws coins: a cosmetic pop plus a coin sound. The gold is counted at the bout's end, shown as "+34 gold" on the grade card.
- **The Emperor's thumb** (the Grand Games only). After the final fell:
  - **a full meter:** thumbs up. The true epilogue: your reason pays off (E2);
  - **a middling meter:** a cold nod. A short epilogue, and the reason half resolved;
  - **a low meter:** thumbs down. The crowd jeers, and you are freed but forgotten.

  All three count as a win and a champion felled. Only the ending changes, so style matters at the top without making a win feel lost.
- **Glory** (the reason): the chant from v1 is driven by the meter.

## D. Gold: the draft and the armourer's tent

- **The draft deals three cards, as in v1, but one of them has a price.** It is drawn from a tier above the other two and costs gold. If you can't afford it, it shows its price greyed out. A gold card is a clear step stronger, so a stylish run earns a better run.
- **The armourer's tent, once per run after bout 3.** It offers three wares, rolled and seeded, each with a price:
  - a plate for one part;
  - a whetstone (+1 damage for the rest of the run);
  - a heart;
  - a respin or reroll token;
  - a better weapon swap (one weapon tier up, from your arena's pool).
  
  Skip is one tap. It shows only once a run, so it never slows the bout-to-bout pace.
- **Gold resets at the end of a run.** Any gold left over turns into a little fame (1 fame per 50 gold), so saving it is never wasted.

## E. Fame and the ludus

**Earning fame:**
- felling a champion: 10;
- a first clear of an arena: 25;
- a thumbs-up ending: 10;
- leftover gold: as in D.

**The ludus** is Brutus's school: a new menu page, a courtyard with five stations. Each unlock is one tap with a price and one line saying what it does:

| Station | Unlocks (examples, all in data) | Kind |
| --- | --- | --- |
| **The armoury** | new weapons on your wheel: the trident and net (the existing net, now yours), and the curved sica | options |
| **The barracks** | new origins and backgrounds on the wheels, each with a perk: a gladiatrix from Sparta, a freed slave from Egypt, a chariot driver | options |
| **The training ground** | one starting-card slot (choose any card you have picked before); a 4th card in your first draft | small power, capped at these two |
| **The shrine** | new reasons with a face (e.g. *a promise*: to free a sister in the champion's house), each with its thread and epilogue | story |
| **The tailor** | crests, helmet plumes, shield paints, a cloak | cosmetic |

- **The Wall of Champions,** beside the pit wall: every fighter who cleared an arena, with their name, origin, weapon and arena.
- **A veteran.** From the Wall, you may start a run with a past champion instead of rolling. They keep their rolls, with +1 to one stat and a scar line, but only in an arena above the one they cleared. It is the lasting attachment the designer asked about, with a hard cap so it never snowballs.

## E2. Story

- **Each arena is a chapter.** Brutus has one opening line per arena, and your reason's thread climbs across the four:
  - **debt:** it reaches zero at the Grand Games;
  - **revenge:** the target is the Emperor's champion;
  - **freedom:** the Emperor himself hands over the wooden sword;
  - **glory:** Rome chants your name.
- **The thumb sets the tone of the ending** (C).
- **The v1 epilogue** becomes the Pit's ending.
- Text counts follow principle 11. Lines are written in the build and checked by the reviewer.

## F. Art (art chat, ADR-0015; Pack 15 written after this PRD is locked)

In order of what you look at:
1. **Gear on the fighters.** Painted helmets (one per gladiator type), shields, each weapon (gladius, spear, axe, dagger, trident and net, sica), and armour plates. Each is a sprite pinned to the existing skeleton (v1 already paints parts once into sprites), with the procedural look kept as the fallback. About 20 small images.
2. **The beast:** a lion, in 3 poses (crouch, pounce and swipe) on the same pinned-sprite rig. 3 images.
3. **Portraits:** Brutus, 8 champions (2 per later arena plus 2 new Pit faces), and the Emperor. 10 images.
4. **Backdrops:** one per arena behind the sand, kept soft so the fighters read. 4 images.

That is about 37 images, at about $6 to $10. Each step ships on its own, so step 1 can land before the portraits.

## G. Saves

`saveVersion` bump. `migrate` keeps the rival, the pit wall, the feint lesson and the bouts seen, and adds:
- the arenas opened (a v1 save that felled a champion opens the City);
- fame (a v1 champion felled gives its 10, and so does each won run on the wall);
- the ludus unlocks;
- the Wall of Champions (the v1 wins become its first entries);
- the veteran roster.

The run resume stays at bout start, now with the arena and the gold.

## H. How v2 is built (cost before rigour)

Each build is reviewed, played by the designer, then the next one starts.
1. **The beast bout and crippling** (Opus). The two new fight feels, playable in the Pit as a dev preset, so the designer judges them first.
2. **The ladder and the crowd** (Opus): A, C and E2 (the arena picker, the four twists, the crowd meter and coins, the Emperor's thumb, the arena chapters).
3. **Gold, fame and the ludus** (Sonnet): D, E and G.
4. **Art wiring** (Sonnet), step by step as each part of Pack 15 lands.

Rough cost: about $30 to $40 for builds 1 to 3, plus $6 to $10 for images and about $5 for wiring.

## I. Out of scope (v3 and later)

- **The editor's wheel:** before each bout, a wheel spins a rule ("sand in your eyes: shorter tells", "the crowd wants blood: double gold, no shield"). It reuses the wheel of fate.
- multiplayer;
- animated art beyond pinned sprites;
- voice;
- a market screen between every bout.

## J. Acceptance

- One run is one arena, 3 to 6 minutes.
- Each arena's twist reads in its first bout without a tutorial longer than one caption.
- The crowd meter, gold card, tent and ludus never overlap at 667x375, 844x390 or 932x430.
- A lasting unlock never changes a fight by more than the two training-ground items allow.
- A v1 save migrates with its wins on the Wall and its fame.
- `npm run smoke` passes.
- Frame time is no worse than arena-v17 (with two fighters and the crowd).
- **The designer's runs judge difficulty and feel.**

## Open questions for the designer

1. **The City's twist.** Pairs (a tag-team foe) or something else? Alternatives:
   - *the night games:* torchlight, so his tell glows only when he is close;
   - *the chariot:* he circles, and you strike as he passes.
2. **The beast:** a lion, a bear, or both (one per Colosseum run, rolled)?
3. **The veteran:** keep it (lasting attachment, capped), or drop it so every run is a fresh roll?
