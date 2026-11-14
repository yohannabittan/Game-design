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

## What was found (`../steps/2026-11-14-sica-bear-finding.md`)

The orchestrator's first guess (a one-edged blade, read from `strike.edges`) was **wrong**: that value only paints the blade. Measured in the running game:

- **"Sica" and "no bite" were the same thing: the Haemorrhage card.** It was bought in the bear run. Its gear turns your weapon into a "Hooked Sica", and its rule is "hits on bare skin do nothing": each one shows NO BITE. The hit still sprays a little blood, makes the slice sound and shakes the screen, so it looks like it should have hurt.
- **A barded bear is almost all plate.** At bout 4 in Rome: about 62% barding, 25% hide (the hind legs only), 12.5% gap. A level slash from the front meets plate on 94% of heights and hide on none. Plate takes no damage, and a slash on it shows sparks and no word.
- **So with Haemorrhage against a barded bear, almost nothing hurts:** only a jab into a gap (6), and bleed carried over.
- **The real sica** (the Games run earlier) has its own fault: any push toward him is read as a jab, and a sica jab is always a thud (0.5, no bleed), where a gladius jab does 2 on skin and 6 in a gap. Its slashes cut in every direction.

## Read

- All of it is the same kind of fault as two weapons: **the blow lands, looks like a hit, and the game doesn't say why it did nothing.** Design principle 19 (each verb looks and sounds like itself).
- Haemorrhage is a card that asks you to play one way (bleed only). Against a barded beast it leaves no way at all, and the draft doesn't warn of that.
