# Story plan for the library (draft, 2026-10-04, revised the same day)

The designer asked for more explicit story across the games, starting with Recoil (`docs/games/recoil/prd-v0.7.md`, drafted). Started 2026-10-05 after the usage reset. PRDs: Recoil v0.7, Launch v0.5, Checkpoint v0.3, Ink v0.7, Gravity Golf v0.10 (holes) and v0.11 (story); art Packs 9 to 12 in `docs/art/BRIEF.md`.

## Each game's emotional drive (designer, 2026-10-04)

Each story is short, says why the action happens, and links the player to someone. The narrative supports the drive that makes you play the next level:

| Game | Drive | Who you do it for |
| --- | --- | --- |
| Launch | love and longing | Daifuku, waiting 5 km away |
| Recoil | ambition | yourself: your name on the poster |
| Ink | care and trust | the client who wears your work forever |
| Checkpoint | protection | the passengers on today's flight |
| Gravity Golf | curiosity and discovery | humanity: are we alone? |

## One kit for every game

The same five story pieces, used where they fit, so the games feel like one library and each build is small.

| Piece | What it is | Cost |
| --- | --- | --- |
| **Cold open** | 2 or 3 still cards on first launch, skippable in one tap, replayable from the menu ("Story") | text only |
| **A voice** | one character who comments in one line on the result card, from a small pool per outcome | text, plus one portrait |
| **Career beats** | the game's progression ladder gets a story card at each step (Gravity Golf's rank-up card is the model) | text |
| **A payoff** | something to collect or reach that closes the story: a poster wall, a portfolio, a reunion | varies |
| **Flavour lines** | one line attached to existing things: guns, travellers, clients, sectors | text |

Rules for all of it:
- **Universal tone.** No line needs the player to know a film, an era or a culture.
- **Short.** At most about 60 characters a line (principle 11).
- **Never in the way.** Story never gates play, and never delays input by more than one tap.
- **Original.** Names are original, under the parody rule.
- **Portraits are images.** Characters are generated portraits, which are for looking at (ADR-0015). The procedural fallbacks stay.
- **Saves.** Each game stores what it has shown (`openSeen`, a `…Seen` per beat) through `migrate`, so a veteran sees one catch-up card, never a cascade.

## Per game

### Recoil: "From Extra to Action Star" (PRD v0.7 drafted)

- **Career:** Extra → Intern → Stunt Double → Action Star, by total stars.
- **Voices:** the director on result cards, and the prop master's line per gun.
- **Payoff:** a premiere poster per set, on a poster wall.
- **Art:** the director (2 poses) and 6 posters.

### Launch: "Mochi's way home" (the story exists, but is told only by the journey strip)

The art is already final: Mochi in four expressions, Daifuku twice, and the Mochi Maker, in `docs/art/final/launch/` (Pack 5, never wired).

- **Cold open.**
  1. "Mochi was made for Daifuku." (mochi-love beside daifuku)
  2. "Then Daifuku was boxed and sent 5 km away." (daifuku-wave)
  3. "The Mochi Maker 3000 has one setting: FLING." (mochi-maker)
- **Voice:** Mochi himself, on the result card. Use mochi-happy for a new best, mochi-dizzy for a crash or mud, and mochi-determined otherwise, each with a one-line pool ("Next time, the jelly.").
- **Career beats:** the existing five zones each get one arrival card the first time: "The candy fields. Daifuku loves these."
- **Payoff:** the reunion at 5000 m becomes a real scene: mochi-love and daifuku-wave together, hearts, then "Home! (keep going)". It is already in PRD v0.2 E as a banner; this makes it the story's ending.
- **Art:** none new.
- **Cost:** one Sonnet build plus a review, about $10 to 15. **This is the cheapest and has the strongest emotional hook.**

### Checkpoint: "Get the flight home safe" (revised 2026-10-04)

The drive is **protection**: people fly safely because you were fast and sharp.

- **Cold open.**
  1. "Airport security. Today's flight leaves at dawn."
  2. "Your job: nothing dangerous gets on board."
- **Each day is a flight.** The supervisor's morning briefing names it and gives one tip ("Flight 4 to the coast. Fireworks season: watch the tubes.").
- **The end card is the plane.**
  - **A good day:** "Flight 4 landed. 182 passengers home safe."
  - **A breach:** **"The flight didn't take off."** The plane stays grounded and passengers wait. Nothing violent, no hijacking: the stakes are kind but real.
- **Flavour.** Flagged travellers get a one-line excuse ("It's a gift for my nan!"), and cleared ones a thank-you.
- **The ladder, in the background.** Rookie → Officer → Senior → Chief, by flights landed.
- **Payoff.** Day 7, the holiday rush, ends on a departures board of your week, all green or with the grounded ones marked.
- **Art.** The supervisor (2 poses), plus optionally a plane on the runway for the end card, about $1.
- **Cost.** About $15 to 20.

### Ink: "Someone wears your work forever" (revised 2026-10-04)

The drive is **care and trust**: a tattoo is permanent and means something to the person who wears it, and that is why precision matters.

- **Cold open.**
  1. "A tattoo lasts a lifetime."
  2. "Every client trusts your hand with theirs."
- **The client is the voice.** Before each stencil, one line says who they are and why they want it: "An anchor for my first voyage."
- **The reveal (Elaina's idea, the heart of it).** After the fill, the view **zooms out from the skin to the client**. The game draws **your actual work**, slips included, onto the client's arm or shoulder. The client's face reacts: delighted on three stars, polite on one or two, upset on a ruined piece. The tattoo is the player's own result, so the client's reaction is to *your* hand.
- **The ladder, quietly in the background.** Apprentice → Artist → Master, by stars. The shop owner appears only on rank-up cards. At Master: "Your own shop. Your name on the door."
- **Payoff.** The gallery becomes your **portfolio of people**: each piece shown on its client.
- **Art.** About 6 original clients, reused across levels, each with 3 expressions (happy, neutral, sad), waist-up with a clear skin patch where the game draws the tattoo. That is 18 images, about $2 to 3. A small data table gives each portrait its skin-patch rectangle.
- **Cost.** Larger than the others, because of the zoom-out and the tattoo transfer: about $20 to 30.

### Gravity Golf: "A probe looking for life" (revised 2026-10-04)

The drive is **curiosity and discovery**. You are a small probe sent by humanity to explore the galaxy and look for life. Every hole is a **gravity assist**, the real trick spacecraft use to bend their path around planets, which is exactly the game's action.

- **Cold open.**
  1. "Humanity built you to answer one question."
  2. "Are we alone? Ride the gravity. Find out."
- **The voice is mission control,** one line per result: "Clean assist. Data received." For a miss: "We'll call that a scenic route."
- **Sectors are the journey's stops.** Each arrival card is a discovery log:
  - Starfield: "Rocks. No life."
  - Nebula: "Gas, dust, no life. Yet."
  - and so on, up to the Galactic Core.
- **Ranks become what you've learned to bend around**, from Asteroid to Black Hole, with one line each.
- **The hook.** Clearing hole 30, the Galactic Core boss, triggers the cliffhanger: **"A signal. Not natural. It's coming from beyond the core."** That sets up the alien mode in the backlog as the story's next chapter (First Contact, Probe and Mothership badges are already pencilled in).
- **Art.** Mission control as a small screen-and-headset icon, or the probe itself (2 poses). About $0.70.
- **Cost.** About $10 to 15.

## World sheets and a first cast (designer, 2026-10-04)

Every game gets a `docs/games/<slug>/world.md` (template `templates/world.md`): the drive, the setting, the cast with names and voices, and the canonical lines. Each one is written when that game's story PRD is, and the designer edits the names. First-pass cast, all names original:

| Game | Player | Voice | Others |
| --- | --- | --- | --- |
| Launch | Mochi | Mochi himself | Daifuku, his love. The Mochi Maker 3000, the bakery's machine with one setting: FLING. Grandma Kiko, the baker who made them both, seen only in the cold open. |
| Recoil | the newcomer (unnamed, so the player projects) | Director "Big Lou" Marlowe: loud, warm, impatient | Gus, the prop master: weary, proud of every prop. |
| Checkpoint | Officer (the player's rank) | Supervisor Pat Okoye: calm, dry, protective | The travellers: one-line regulars such as Mr Abernathy and his snow globes. |
| Ink | the apprentice | the client of the day | Rita, owner of the Lucky Needle parlour. About 6 recurring clients: Bram the sailor, June the grandmother, Theo the chef, Mina the runner, Kai the musician, Ola the bride. |
| Gravity Golf | the probe, named Lumen | Mission Control, Dr Sam Ito: curious, encouraging, a little nerdy | Humanity, waiting for the answer. Whatever sent the signal. |

## Gravity Golf: the probe log of real space facts (designer, 2026-10-04)

The probe collects **one short, true fact** the first time it meets each kind of body or event. Mission Control says it on the result card, and it is saved to a **Probe Log** on the missions screen. Collecting knowledge for humanity is the drive made visible. About 15 facts:
- the planet, moon, sun, binary stars, black hole, comet, nebula and asteroid;
- each sector;
- every rank object, from brown dwarf to quasar.

Each is at most about 90 characters. For example:
- Black hole: "Not even light escapes past the edge, called the event horizon."
- Comet: "A comet is a dirty snowball; its tail always points away from the Sun."
- Brown dwarf: "Too big to be a planet, too small to shine like a star."

**Accuracy rule:** every fact is checked by the reviewer against a general reference, and none is phrased as a guess. Logged facts are kept in the save.

## Order and total

1. Recoil, as drafted.
2. Launch, which needs no art.
3. Checkpoint.
4. Ink.
5. Gravity Golf.

Two can run in parallel, because they are different games. In total that is about $65 to 90 of API-equivalent (about 4 to 5 percent of a week), and about $3 to 4 of art for 4 portraits and 6 posters.

**Could the kit be shared?** A shared story-card helper in `skeleton/src/engine.js` would make each later game cheaper, but it is an engine change (an ADR, then copied into each game, ADR-0006). Recommendation: build the cards in Recoil's and Launch's `game.js` first, then decide on the engine helper once two games prove the shape.
