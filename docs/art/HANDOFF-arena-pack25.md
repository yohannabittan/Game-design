# Handoff: Arena Pack 25, gear repainted as the near side only (art, 2026-11-04)

For the orchestrator. 20 pieces repainted, one option each, replacing the `-A` files in `docs/art/candidates/arena/`; the previous paintings are kept as `<name>-old.png`. Contact sheet: `sheet-pack25-gear-worn.png` (each piece before and after, worn on its body part at game size; the "before" column shows the holes). Nothing is in `docs/art/final/arena/`. Canvases are unchanged. Each new painting was trimmed and fitted (aspect kept) into the old piece's opaque box, so the pins in `games/arena/src/game.js` (`a`, `b`, `w`, `at`) still land on the same relative place; the table lists where the box moved enough that a pin sits off the piece's edge. Wiring only needs a re-wire (copy to `games/arena/assets/` as for Pack 20), no change to a pin unless the last column says so.

Every piece is the outer face only: no opening, no inside, no back wall, no cut edge end-on. Checks: interior semi-transparency 0.00 to 0.04 percent, enclosed transparent area 0.00 to 0.01 percent (none is a hole).

## Repainted (the 17 briefed, then 3 more)

| File | Canvas | New box (x0, y0 to x1, y1) | Old box | Pins |
| --- | --- | --- | --- | --- |
| `gear-bronze-bracers` | 160 x 160 | 11, 18 to 149, 141 | 0, 18 to 160, 141 | unchanged (now one band, was two halves with a gap) |
| `gear-barbed-bracers` | 160 x 160 | 0, 23 to 158, 138 | 0, 0 to 160, 160 | a and b were at y 22 and 150: now top edge y 23, bottom edge y 138; move b to y 138 |
| `gear-knife-bracers` | 160 x 160 | 0, 29 to 158, 131 | 0, 17 to 160, 143 | unchanged (axis left to right; a flat panel, handles up) |
| `gear-gilt-armlets` | 160 x 160 | 0, 37 to 158, 124 | 0, 20 to 160, 140 | band is 87 px tall, was 120: a y 22 and b y 138 now sit off the band; use a y 37, b y 124 |
| `gear-crusher-gauntlets` | 160 x 160 | 2, 10 to 158, 151 | 2, 7 to 158, 153 | unchanged (cuff top (112, 10), fist bottom-left (74, 150)) |
| `gear-iron-pauldrons` | 224 x 192 | 0, 10 to 222, 182 | 0, 0 to 224, 192 | unchanged (now a plain dome shell, no hollow underside) |
| `kit-plate-manica` | 160 x 320 | 0, 1 to 158, 318 | 0, 0 to 160, 320 | unchanged |
| `gear-bronze-boots` | 192 x 384 | 0, 74 to 190, 310 | 0, 74 to 192, 310 | unchanged (shaft top rim y 74) |
| `gear-spiked-boots` | 192 x 384 | 0, 84 to 190, 298 | 0, 74 to 192, 309 | a y 88 is on the rim; b y 262 still inside: unchanged |
| `gear-soft-boots` | 192 x 384 | 0, 102 to 190, 283 | 0, 75 to 192, 309 | boot is shorter (181 px, was 234): shaft top now y 102, so a y 95 sits above it; use a y 102. Faces left, `flip` as before |
| `gear-gilded-greaves` | 192 x 384 | 7, 0 to 185, 382 | 0, 0 to 192, 384 | unchanged |
| `kit-plate-greave` | 192 x 384 | 34, 0 to 159, 382 | 25, 0 to 167, 384 | unchanged |
| `gear-black-plate` | 384 x 384 | 20, 0 to 364, 382 | 0, 0 to 384, 384 | now a **front view**, symmetric, centre x 192: a (190, 12) unchanged, b (190, 372) unchanged; plate is 344 wide in 384 |
| `gear-colossus-plate` | 384 x 384 | 2, 36 to 382, 346 | 2, 20 to 382, 363 | neck pin top centre moves from y 20 to y 36 |
| `gear-bronze-phalerae` | 384 x 384 | 1, 0 to 382, 382 | 0, 0 to 384, 384 | unchanged (front view; the shoulder straps are now part of the solid plate) |
| `kit-plate-chest` | 320 x 320 | 6, 0 to 315, 318 | 0, 0 to 320, 320 | unchanged (front view) |
| `gear-wolf-pelt` | 384 x 512 | 38, 0 to 346, 510 | 0, 0 to 384, 512 | now a solid fur cape 308 wide, was a full-width inverted U: a (192, 10) and b (192, 480) unchanged, but the game's `w: 384` makes it 25 percent wider than the fur, so use w 308 to keep the old size |
| `kit-wrap-trousers` | 192 x 352 | 9, 0 to 184, 350 | 0, 0 to 192, 352 | unchanged (hollow top is gone) |
| `gear-shadow-sandals` | 192 x 384 | 2, 73 to 190, 309 | 2, 70 to 190, 313 | unchanged (the dark opening at the top of the shaft is gone) |
| `gear-dancers-sandals` | 192 x 384 | 0, 52 to 190, 330 | 0, 46 to 192, 337 | unchanged |

The last three are not in the brief's list: I checked `sheet-card-gear.png`, `sheet-vault-gear.png` and the kit sheets and repainted those showing a hollow top. Left as they are, on purpose: the helmets, hood and wreath (drawn alone over the head, the face area is open by design), the cloaks and capes (they hang behind the body and show a lining by design; the crimson cloak's maroon inside is the briefed wet look), `kit-galerus`, `gear-wind-ribbons` and `gear-gilded-harness` (no hollow showing).

## What wiring must handle

- **The chest plates are front views, not side views.** The brief said "seen from the side", but the kit torso (`kit-base-torso-A.png`) is drawn front-on with the arms hanging, and a side-view plate on it looked wrong. A side-view first try came back with a round neck hole and the dark inside again. The four plates now match the torso's front, with a solid closed collar line.
- The four chest plates' top edge is a scooped collar line, not a hole: the colossus and phalerae necklines are painted in plate material; the neck above them is the torso's.
- The knife bracers keep a rounded left end (a hint of a tube); it is solid, not a hole.
- `gear-wolf-pelt` is a solid fur skirt, narrower than before (308 of 384).

## Flaws

- Black plate: the first three tries kept drawing an armhole ring or a dark neck. The last used the new bronze chest plate's shape as a second reference and came out solid, with a small dark inner rim at the neck line.
- Pauldrons are a plain crescent dome; they read as a shell but are plainer than before.
- Both colour and size of some pieces drifted a little from the old ones (the bronze chest plate is brighter orange).
- A reference of the arm or the torso made the generator paint the limb or skin inside the gear (bracers and gauntlet drew an arm; the pelt a skin patch). Those pieces were redone from the old piece alone, with "no arm, no skin" in the prompt: worth remembering.

## Cost

39 images, about $2.51 by the usage block at $40 per million output tokens (an upper bound): 20 kept ($1.34), 19 discarded in redo rounds ($1.17; two of those prompts were overwritten, so those two rows are an estimate). Ledger total now $55.20 of $80, plus the $4.82 wedding mock-ups on the account.

## For the designer to paste

"The Arena Pack 25 repaints are in docs/art/candidates/arena (HANDOFF-arena-pack25.md): 20 gear pieces painted as the near side only, old ones kept as -old. Contact sheet: sheet-pack25-gear-worn.png. The chest plates are now front views to match the torso."
