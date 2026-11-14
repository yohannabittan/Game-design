# Handoff: Arena Pack 30, the range and the show trials (art, 2026-11-14)

For the orchestrator. Files are in `docs/art/candidates/arena/` (`-A` for the single ones, `-A/-B/-C` for the three options) and listed in `candidates.json`. My picks are copied to `docs/art/final/arena/` under the brief's names. Sheets: `sheet-pack30.png` (the options, each also at 64 px) and `sheet-pack30-game.png` (everything at game size on sand, the man's place marked in green on the board and the wheel).

**Proposed picks:** `range-target` **B**, `knife-wheel` **C**, `fruit-seller` **A**. The designer can still choose others; the fruits, pots and board were made from range-target B as the style reference (plus the round shield), so they match B. The three styles are close enough that another pick still fits.

## Why these

- **range-target B:** the heaviest dark outline, clean straw coils, no ground shadow (C had one).
- **knife-wheel C:** the four straps sit at the diagonals where a spread-eagled man's wrists and ankles go; the rim has iron studs; the outline is clean. A has thin plain wood; B has straps at 12, 3, 6 and 9 o'clock.
- **fruit-seller A:** the biggest, clearest face and the pineapple's lattice reads at 64 px.

## The files (image px, origin top left, y down)

Scale: 1 kit head = 256 px, as briefed, except the two big props (below).

| File | Size | Notes |
| --- | --- | --- |
| `range-target` | 491 x 640 | 2.5 heads tall. A round straw butt on a three-legged wooden easel (not a plain post) |
| `fruit-pumpkin` | 256 x 223 | 1 head wide |
| `fruit-watermelon` | 205 x 198 | 0.8 head |
| `fruit-pineapple` | 140 x 260 | 0.55 head wide, crown included |
| `fruit-pomegranate` | 85 x 96 | a third of a head |
| `fruit-apple` | 64 x 81 | a quarter of a head |
| `pot-clay` | 67 x 144 | rope loop included |
| `pot-wineskin` | 83 x 144 | rope loop included |
| `knife-board` | 468 x 1457 | panel 468 x 1131, legs below. **Native size: 192 px per head**, so 5.7 heads tall, not 8. The game should scale it up to the 8 heads wanted (about 1.4x) |
| `knife-wheel` | 920 x 920 | **Native: about 115 px per head**, so 8 heads across means scaling up 2.2x; the paint will be soft at that size. Scale it to the on-screen width instead |
| `fruit-seller` | 512 x 512 | bust cut off at the chest, sits at the bottom of the canvas |

The generator tops out at 1536 px, so painting the board and wheel at 2048 was not possible.

## Pins (measured from the pixels; ring radii by eye on one row, so about 5 px)

- **Fruit bases** (where it sits on the head: bottom centre): pumpkin (128, 222); watermelon (102, 197); pineapple (70, 259); pomegranate (43, 95); apple (30, 80). Fruits are a little wider than tall, so they rest on the crown of the head.
- **range-target:** ring centre **(246, 226)**. Radii: gold centre 38 (an orange ring inside the red to about 75), red 110, black 140, white 178, straw rim to 245 (the whole disc). The easel's legs run from about y 470 to 640; the foot centre is (246, 639).
- **knife-board:** man's area **x 100 to 368, y 30 to 1131** (a 268 px wide column on the 468 px panel); his feet go at the panel's bottom edge y 1131, in front of the legs. The two iron crossbars are at about y 70 to 105 and y 880 to 915, so pots can hang between and beside them.
- **knife-wheel:** hub (centre) **(460, 460)**, hub radius about 125, inner rim radius about 415, outer 460. The man's area is the ellipse of half-width 175 and half-height 360 round the hub (the green ellipse on the sheet). The four straps are at **(245, 140), (675, 140), (130, 690), (790, 690)** (upper pair and lower pair, eyeballed from the picture), plus a decorative strap at the bottom (460, 855). The wheel turns about the hub.
- **Pot hanging points** (top of the rope loop): `pot-clay` (32, 0); `pot-wineskin` (41, 0). The body hangs 62 to 144 px below.

## Flaws

- The target stands on a three-legged easel, not a "short post". It reads as a target stand, and the game can crop the legs.
- The apple has a thin dark sliver of its shadow under it; the watermelon a very faint glow. Both are a few px.
- The fruit images have no stable "flat base" except the pumpkin and watermelon; the pomegranate and apple are round, so they will look like they balance on a point. Sit them a few px into the head.
- Several first tries painted a ground shadow or a gold plinth under the fruit; those were redone or cleaned in code (a floating shadow on the pomegranate was cut out, the others cut by colour).
- The wheel's straps hang a little outside the rim, and the man's area is my proposal, not drawn. The wheel's iron is bronze-brown, not grey.
- The fruit seller's tunic is busy and his sash reads a little like a bandolier.

## Cost

17 images (9 options, 8 singles, 6 discarded among them), about $1.40. Ledger total now $62.10 of $80.

## For the designer to paste

"Arena Pack 30 is in docs/art/candidates/arena (HANDOFF-arena-pack30.md): the target, wheel and fruit seller in three options, plus fruits, pots and the knife board. Sheets: sheet-pack30.png and sheet-pack30-game.png. I propose range-target B, knife-wheel C, fruit-seller A; they are in docs/art/final/arena."
