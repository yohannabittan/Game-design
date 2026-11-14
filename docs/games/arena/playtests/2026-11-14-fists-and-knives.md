# Arena playtest, bare hands and five knives (2026-11-14, the designer)

**Build:** the dev channel, `arena-v69`, exported 2026-11-14 at 18:44 UTC. Phone.

## The designer's words

- "Rather than just a target that snaps, there should also be a line drawn from the hand showing where the knife is going, and I think it should be like a range finder that doesn't go all the way necessarily."
- "It should be like: if you hold the knife for more than the length of a normal tap then it becomes a hold of the throwing knife, and when you release it fires. Not sure what the current mechanism is, but I failed to throw sometimes."

## The run

The Games, lost in the first bout to Flamma (medium, axe).
- Tullia, lean, 4/3/1, **fists, no armour, five knives** (`buy="fist,none,knives 5"`, 40 of 45 gold).
- Knives: 5 thrown, **2 in gaps, 3 missed** (`knifeMiss`: hit nothing).
- 8 slashes, 7 jabs, 10 gap hits with the fists; 7 hits taken; baited once.

## Why throws failed (from `RULES.md` and `TUNING.knives`)

With a knife raised, only a drag of at least `knives.drag` (20 px) followed by a release throws. A press and release on the spot just moves the ring. A thumb that goes down, holds and lets go throws nothing, and nothing says so.

## Next

A touchable sketch goes to the designer before a build (`../sketches/knife-aim.html`): hold longer than a tap to take the knife and release to throw, with no minimum drag; and a dotted line from the hand, either stopping part of the way or growing as you hold.
