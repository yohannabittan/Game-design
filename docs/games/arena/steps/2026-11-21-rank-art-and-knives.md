# Arena steps: the rank coins wired in, and knives after every bout (locked 2026-11-21)

**The designer** (after a session on v88): "We need the art for the ranks still. Knives are good, I just played fists and knives and it was interesting, but it makes me think we should probably be able to get knives between each bout."

## A. The rank coins (Art Pack 32, `docs/art/HANDOFF-arena-pack32.md`)

- The twenty painted coins (`docs/art/final/arena/rank-01.png` to `rank-20.png`) replace the drawn numbered medallion everywhere `rankEmblem` draws it: the menu beside your rank, the run's end at a rank-up, the ludus's header. Same sizes as today (`TUNING.ranks.emblem`); no number drawn over the coin.
- Shipped as the game ships its art (WebP in `games/arena/assets/`, listed so the service worker caches them).
- Acceptance: stills of the menu, a rank-up and the ludus at 874x402 with a real coin; smoke passes (no missing asset).

## B. Knives after every bout

- Today knives are sold in the opening purse, the armourer's tent (once, after bout 3) and the bandage stall (before the champion). **After every won bout before the champion**, the screen between bouts also offers knives: one tap buys one at the usual price (`TUNING.knives.price`), up to the carried limit (`knives.max`), with the gold and the count shown; skipping costs nothing.
- It never blocks the draft: buying knives and picking a card are both on the way to the next bout.
- Acceptance: after bout 1 with gold, a knife can be bought and is carried into bout 2; at the limit or without gold the offer says why; the purse, tent and stall still sell knives as before; the export's run line counts knives bought between bouts. Two-way door: no save change (the run's knives are already saved).
