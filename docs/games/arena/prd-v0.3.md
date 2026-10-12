# Arena PRD v0.3: v2, the road to the Colosseum

| | |
| --- | --- |
| Slug | `arena` |
| Version | 0.3 (v2) |
| Date | 2026-10-12 |
| Status | **draft**, for the designer |

**Basis:** v1 (`prd-v0.2.md`, released as v1.5), its playtest (`playtests/2026-10-12-v1.md`) and the list v0.2 G parked: gold and a market, the arena ladder, injuries that carry over, and art. The designer said: "I think it's time we do the real thing for Arena."

**The idea in one line.** v1 is one gauntlet in the Pit. v2 turns it into a climb: four arenas, each with its own champion, plus gold, a market between bouts and wounds you carry, ending at the Grand Games before the Emperor.

## 0. How v2 is built (cost before rigour)

- **It builds on the v1 code.** The fight is good, and v2 adds the frame around it.
- **Three builds, each reviewed:**
  1. **Ladder and story (Opus):** A and E.
  2. **Gold, market and wounds (Sonnet or Opus):** B and C.
  3. **Art wiring (Sonnet),** after the art chat delivers D.
- **Difficulty is judged by the designer's runs,** not by simulation.

## A. The ladder: four arenas

| Arena | Bouts | Champion | Look |
| --- | --- | --- | --- |
| The Pit (Capua) | 5, as in v1 | the v1 champions | sand, wooden fence, a rough crowd |
| The City arena | 5 | a new champion pool | stone walls, banners |
| The Colosseum (Rome) | 5 | a new champion pool | marble, a full crowd, awnings |
| The Grand Games | 3, then the Emperor's champion | the Emperor's champion | gold, the imperial box, rose petals |

- **A run is one arena.** Runs stay 3 to 6 minutes. Felling an arena's champion opens the next arena for good. The menu's Play becomes a short arena picker showing the open arenas.
- **Each arena raises the foes.** Grades shift up, and move sets and feints come sooner. The numbers live in one per-arena table in TUNING.
- **The rival follows you up.** A champion who beats you remembers you in that arena, as in v1.
- **Simplest option:** you roll a fresh fighter for every run, as now. The fighter is not carried between arenas.

## B. Gold and the market

- **Gold per fell.** Clean bouts pay more, and a feint read or a perfect block adds a bonus. The odds stay visible, in the spirit of the wheels.
- **The market comes after the draft.** One small stall offers three wares, rolled and seeded, each with a price:
  - a bandage (heals a wound, C);
  - a plate (adds armour to one part);
  - a whetstone (+1 damage next bout);
  - a respin token;
  - a heart.
- **Gold is per run (simplest option).** Each run starts at 0, so runs stay fair and there's no grinding. The menu shows lifetime gold as a number only.

## C. Wounds that carry over

- **A heavy hit to a limb leaves a wound** that lasts to the end of the run, unless you buy a bandage at the market:
  - a sword-arm wound slows your swing a little;
  - a shield-arm wound makes the shield cooldown longer;
  - a leg wound shortens the dodge.
- **At most two wounds,** each shown as a small icon on the fighter card and the HUD.
- **A wound never ends a run by itself.** Hearts still decide.

## D. Art (through the art chat; ADR-0015)

The fighters in play stay procedural, because animated rigs from images are a big build. The art goes where it shows most and costs least:
- **4 arena backdrops,** one per arena, behind the sand;
- **Old Brutus,** a portrait for every card;
- **8 champion portraits,** 2 per arena, for the intro cards and the rival;
- **The Emperor,** a portrait for the final card and the epilogue;
- **The menu title art.**

That is about 15 images. I'll add it to `docs/art/BRIEF.md` as Pack 15 after this PRD is locked.

## E. Story

- Each arena is a chapter, and your reason's thread carries through all four:
  - the debt counts down to zero at the Grand Games;
  - the revenge target is the Emperor's champion;
  - for freedom, the wooden sword (the rudis) is handed over by the Emperor;
  - glory ends with the crowd chanting your name in Rome.
- **Brutus gets one line per arena opening.**
- **The epilogue at the Grand Games** replaces the v1 epilogue as the true ending. The v1 epilogue becomes the Pit's ending.
- **Text counts follow principle 11.**

## F. Saves

- `saveVersion` bump.
- **Kept:**
  - the open arenas (a v1 save that felled the Pit champion opens the City);
  - the rival per arena;
  - the pit wall;
  - the feint lesson;
  - lifetime gold.

## G. Out of scope

- a career fighter carried across runs;
- new weapons or a player move set;
- multiplayer;
- animated fighter art;
- voice.

## H. Acceptance

- Each arena plays 3 to 6 minutes.
- The market and draft never overlap at 667x375, 844x390 or 932x430.
- A v1 save migrates with its champion win and its rival kept.
- `npm run smoke` passes.
- Frame time is no worse than arena-v17.
- **The designer's runs judge difficulty.**

## Rough cost

- builds 1 and 2: about $25 to $35;
- art: about $4 to $6 in images;
- wiring: about $5.

## Open questions for the designer

1. **One arena per run, or the whole climb in one long run?** The draft picks one arena per run, to keep runs short.
2. **Gold per run, or saved across runs** to spend on a lasting stable (fighters, gear)? The draft picks per run, to keep runs fair.
