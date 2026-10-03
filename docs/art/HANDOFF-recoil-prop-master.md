# Handoff: Recoil prop master, resting and sold poses (Pack 8), 2026-10-03

For the orchestrator session. From the art session.

## Status: two options generated, waiting for the designer's pick

Two pairs (resting plus sold, each pair the same man) are on one sheet with each at 64 px:
`https://yohannabittan.github.io/Game-design/docs/art/candidates/recoil/sheet-prop-master.png` (Pages lags a minute after the push). Files: `docs/art/candidates/recoil/prop-master-A.png`, `prop-master-sold-A.png`, `prop-master-B.png`, `prop-master-sold-B.png`.

When the designer picks, the pair moves to `docs/art/final/recoil/prop-master.png` and `prop-master-sold.png` (the names PRD v0.6 I and the brief fix), the other pair is deleted, and this note's status line is updated. Wiring can be written now against those names; nothing about the files changes at the pick but which man it is.

## The files

- **Size:** 512 x 768, transparent PNG, about 350 KB each as PNG (WebP will be far smaller; the 1.5 MB per-game cap applies).
- **Character:** original, no real actor or film character: a gruff, friendly 1980s backlot veteran, tweed flat cap, round glasses, big moustache, rolled sleeves, canvas apron with a pencil and tape measure, clipboard, lit by neon pink and teal. Option A has a blue shirt and a checked cap; option B has a cream shirt, a darker apron and a plain brown cap.
- **Poses:** resting is a half smile, one hand at the bottom edge as if on a counter, the other holding the clipboard; sold is a big grin, a clear thumbs-up, the clipboard tucked under the other arm. No other props.
- **Framing:** waist-up, facing slightly right. The figure's box inside the 512 x 768 canvas (x0, y0, x1, y1), measured on alpha above 40:

| File | Box |
| --- | --- |
| prop-master-A | 0, 58, 508, 672 |
| prop-master-sold-A | 10, 73, 504, 662 |
| prop-master-B | 16, 52, 501, 646 |
| prop-master-sold-B | 19, 62, 501, 664 |

Swapping resting for sold moves the head down by 10 to 15 px; draw both at the same canvas position and it reads as a small bounce.

## What wiring must handle

- **The bottom edge is not a clean cut.** The generator draws a sticker-style outlined or flat lower edge, not a frame cut. The game's counter has to cover at least the bottom 16 percent of the canvas (rows from about 645 down); a counter top near row 610 to 640 also makes the resting hand read as resting on it.
- Alpha is clean (under 1 percent semi-transparent inside the figure).
- The procedural figure stays as the fallback, per PRD v0.6 I.

## Prompts and cost

Anchor plus the Recoil showpiece sentence, then the subject; full prompts are in `docs/assets-ledger.md`. Generation took three rounds: the resting poses, a first sold round that invented a fan of cash and dropped the clipboard (discarded), and a second round with the cash cue removed and "no money" added. About $0.66 in total. The sold pose used each resting image as the reference so each pair is the same man; that worked here, unlike on Launch's characters (see `LEARNINGS.md`).

Line for the designer to paste: "The prop master is on a sheet in docs/art/candidates/recoil; pick A or B and tell the art session."
