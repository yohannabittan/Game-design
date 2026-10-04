# Story plan for the library (draft, 2026-10-04)

The designer asked for more explicit story across the games, starting with Recoil (`docs/games/recoil/prd-v0.7.md`, drafted). Nothing in this plan is built until the weekly usage resets and the designer locks each game's PRD.

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

### Checkpoint: "Your first week on the line"

- **Cold open.**
  1. "Day one at the airport checkpoint."
  2. "Your supervisor has one rule: nothing dangerous flies."
- **Voice:** the supervisor gives a one-line **morning briefing** before each day. That is one tip plus flavour, for example "Intel says fireworks season. Watch the tubes." It ties the story to the day's new contraband. On a breach, the supervisor's line explains what was missed.
- **Flavour:** flagged travellers get a one-line excuse ("It's a gift for my nan!"), and cleared ones a thank-you. This is cosmetic.
- **Career beats:** Rookie → Officer → Senior Officer → Chief of Security, by days survived and stars, with a card each.
- **Payoff:** day 7 is the "holiday rush" finale with a results card: your week in numbers, and the supervisor's verdict.
- **Art:** the supervisor (2 poses, briefing and stern), about $0.70.
- **Cost:** about $15 to 20.

### Ink: "From apprentice to your own shop"

- **Cold open.**
  1. "A tattoo parlour. A steady hand wanted."
  2. "The owner hands you a stencil: 'Show me.'"
- **Voice:** the shop owner, a mentor, gives a one-line note on the result card ("Clean lines. Customers will come back.").
- **Flavour:** each stencil becomes a client's **commission**, with one line of who asked for it: "A sailor wants an anchor for his first voyage." The level select stays the same, with a client line under each tile's art.
- **Career beats:** Apprentice → Artist → Master, by stars.
- **Payoff:** the existing gallery becomes **your portfolio**. At Master, a final card reads "Your own shop. Your name on the door."
- **Art:** the mentor (2 poses), about $0.70.
- **Cost:** about $15 to 20.

### Gravity Golf: "A pebble that wanted to be a black hole"

The rank ladder already tells a growth story: you start as an asteroid and gain mass.

- **Cold open.**
  1. "Space is mostly empty. You're mostly rock."
  2. "Every hole you sink, you gather mass."
- **Voice:** a small **comet caddie** with one line per result ("Nice bend. Physics approves."). Keep it light: it is a puzzle game.
- **Career beats:** each rank-up card gets one story line, for example Moon: "Something finally orbits you." These are 16 lines.
- **Flavour:** each sector gets an arrival card ("The Galactic Core. Everything here is heavy.").
- **Payoff:** Black Hole is the ending card: "Nothing escapes you now. Not even par."
- **Art:** the comet caddie (2 poses), about $0.70.
- **Cost:** about $10 to 15.

## Order and total

1. Recoil, as drafted.
2. Launch, which needs no art.
3. Checkpoint.
4. Ink.
5. Gravity Golf.

Two can run in parallel, because they are different games. In total that is about $65 to 90 of API-equivalent (about 4 to 5 percent of a week), and about $3 to 4 of art for 4 portraits and 6 posters.

**Could the kit be shared?** A shared story-card helper in `skeleton/src/engine.js` would make each later game cheaper, but it is an engine change (an ADR, then copied into each game, ADR-0006). Recommendation: build the cards in Recoil's and Launch's `game.js` first, then decide on the engine helper once two games prove the shape.
