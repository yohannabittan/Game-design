# Arena playtest, the sica and the bears (2026-11-14, the designer)

**Build:** the dev channel, `arena-v69`, exported 2026-11-14 at 18:40 UTC. Phone, 874x402.

## The designer's words (typed on a phone)

"I think I played sica and could not get a bite. Does that mean it can only be played in one direction? Hit a bear tons of times but no damage on bear skin."

## The runs

- **Sica** (the Games, earlier export): big, 5/2/3, chest + greaves. 60 slashes, 13 jabs, 6 overheads; 25 gap hits; 24 bleeds for 65.5; lost in bout 3 to Carpophorus.
- **Bears** (Rome, new in this export): medium, 4/3/4, gladius, helmet + chest; picks bloodlust, vein, haem, playcrowd. Reached bout 4 and lost to a giant bear.
  - 112 slashes, 31 jabs, 5 overheads, 93 lunges; 70 gap hits; 59 clangs, 5 plates broken.
  - 44 bleeds for 102.5 damage: the most bleed damage in a lost run so far.
  - The bears made 12 mauls and 20 shoves; 11 of your bashes landed.
  - One knife thrown, into a gap (`knifeGaps=1`): the first knife to land in the ledger.

## What the tuning file says (to be confirmed in the running game)

- **Sica:** `strike.sica` has no jab rows, so every sica jab is a haft thud; and `strike.edges.sica` is `[0]`, one edge, where the gladius, dagger and spear have two. So the designer's guess looks right: it cuts one way.
- **Bear hide:** not yet known what a blow on hide does away from a gap. Rome's beasts at bouts 2 and 4 are barded, so much of what can be reached is plate.

A helper is measuring both: `docs/games/arena/steps/2026-11-14-sica-bear-finding.md`.

## Read

- Both complaints are of the same kind as the two-weapon one: **the blow lands, and the game doesn't say why it did nothing.** Design principle 19 (each verb looks and sounds like itself) covers this.
