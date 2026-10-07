# Handoff: Launch Pack 13, Daifuku at the window and Mochi with the bubble ring (2026-10-07)

For the orchestrator session. From the art session.

## Status

Two options each are generated and pushed as candidates with one sheet; the designer has not picked. **Nothing is final.** When he picks, the art session writes `daifuku-window.png` and `mochi-ring.png` into `docs/art/final/launch/`, deletes the other options and updates this note. Wiring can be written now against those names.

Sheet (Pages lags a minute after the push): `https://yohannabittan.github.io/Game-design/docs/art/candidates/launch/sheet-pack13.png`
Candidates: `docs/art/candidates/launch/daifuku-window-{A,B}.png` and `mochi-ring-{A,B}.png`.

## The files

| File | Size | Background | Used in (PRD v0.6) |
| --- | --- | --- | --- |
| `daifuku-window.png` | 768 x 768 | transparent outside the window frame; all four corners checked | D: a small inset in a corner of the result card, one time in three, never over a button |
| `mochi-ring.png` | 512 x 512 | transparent | E beat 2: the proposal, "He held out the soda bubble, just like a ring" |

- **Daifuku at the window:** the Pack 5 Daifuku (same shape, strawberry, face and curled hand lines) sitting on the sill of a cream-painted arched cottage window with tied-back rose curtains, a cream teacup on a saucer on one side and a whole strawberry on the other, a soft pink sky with small clouds behind; no shutters, no orange anywhere. Option A fits Daifuku larger in the frame, which reads better at inset size; option B has more room round Daifuku.
- **Mochi with the ring:** the Pack 5 Mochi blushing, with big round shining eyes (not the heart eyes of `mochi-love`) and a shy smile, and a translucent pink soda-bubble ring in front of him at chin height with a tiny sparkle, face fully visible. Option A shows two small dough stubs holding the ring and keeps Mochi's colour close to Pack 5; option B shows the ring floating with a stronger rainbow sheen and a slightly deeper orange.
- Mochi has no arms in Pack 5. Option A gives him two tiny stubs where the ring is held; if the sequence needs him armless everywhere, pick B.
- The 64 px preview of the window inset is on the sheet: the cup and strawberry read as shapes, the curtains as a pink frame.

## Notes for wiring

- The fallbacks the PRD describes stay until the files land (the `daifuku` image in a drawn window frame; `mochi-love` with a drawn bubble ring).
- Each file is about 0.7 MB (window) and 0.25 MB (ring) as PNG; WebP will be far smaller.
- Both were made with the Pack 5 images as references. On this pair it worked once the prompt described the new scene fully and asked for the transparent edge in words ("cut out like a sticker"); see `LEARNINGS.md`.

## Prompts and cost

Prompts are in `docs/assets-ledger.md`. Two rounds: the first showed an opaque window with no teacup and a starry sky, and a ring beside Mochi, and was discarded. Cost for Pack 13: about $0.48 in total, ledger now $33.94 of the $40 budget.

Line for the designer to paste into the art chat once he has picked: "Finalise Pack 13: daifuku window A, mochi ring B."
