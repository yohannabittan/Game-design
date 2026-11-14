# Runt zones: finding (2026-11-14, arena-v71, 874x402, read-only)

**What the designer saw.** The HIGH/MID/LOW tell glow, the blow's impact ring and its streak are placed at fixed heights for a medium body (`zoneScreenY` = floor + `ZONES.y` x `L.H`, the camera's medium-body unit). Your raised shield, however, is drawn in your own body's frame (`sh.zy` x `youF.H`, which is `L.H` x your size scale), so it shrinks with a runt. On a runt the shield sits at his head, chest and legs, but the tell and the clash happen 40 to 45 px above them for HIGH and MID. A runt's MID glow lands on his head, and his HIGH glow floats above it. The three buttons are a fixed column and match no size's body.

**Heights (screen y, px; 874x402, floor y 370; foe medium; frames in `/tmp/.../runt-zones/`)**

| size (body H) | zone | glow = where blow lands | shield raised | your body part (centre) | button centre |
| --- | --- | --- | --- | --- | --- |
| runt (185) | HIGH | 178 | 222 | head 222 | 109 |
| runt | MID | 217 | 263 | chest 259 | 194 |
| runt | LOW | 326 | 318 | legs 335 | 279 |
| medium (246) | HIGH | 178 | 173 | head 173 | 109 |
| medium | MID | 217 | 227 | chest 222 | 194 |
| medium | LOW | 326 | 301 | legs 323 | 279 |
| giant (283; camera zoomed out, L.H 210) | HIGH | 206 | 143 | head 143 | 109 |
| giant | MID | 240 | 206 | chest 200 | 194 |
| giant | LOW | 332 | 291 | legs 316 | 279 |

Lean is between runt and medium (HIGH glow 178 vs head 197, MID 217 vs chest 240); big is like medium with the glow 37 px below the head (180 vs 143). So the glow is right for a medium only, too high on a runt or lean, too low on a big or giant (a giant's HIGH glow lands on his chest).

**Drawn, judged, or lining up?** Mostly drawn. The glow, ring, sparks and streak (`drawZone`, `resolveOne`'s `bx/by`) use the medium unit; the shield uses yours. Judged: not wrong. `blocks(zone)` compares the zone identity, never a height, so all nine right-zone blocks succeeded, in every size. A wrong zone cannot block (by the same code; I did not run a wrong-zone case). Buttons: never line up with the body at any size (centres 109/194/279 are thirds of the column; a medium's head/chest/legs are 173/222/323). That is a separate, smaller thing; the tell lights the button, which is what teaches the mapping.

**Cheapest fixes**
1. Put the tell, ring and streak at the defender's height: `zoneScreenY` takes `youF(E).H` instead of `L.H`, so the glow, impact and your shield agree for every size. Cost: for a runt the foe's weapon (posed on the foe's own scale) comes down at his own height while the glow sits lower, so the blow looks aimed below its swing; a giant's glow rises above a medium foe's head. Changes `drawZone`, `resolveOne` (streak/sparks), `fight.js:133`. A feel change, so wants a sketch or a build for the designer to try.
2. Leave zones, and show the mapping on the buttons: a short coloured tick or silhouette (head, chest, legs) in each button. Cost: no change to play, more detail in a column the designer wants quiet; does not fix the glow floating above a runt's head.

**Not measured.** The foe's weapon tip height numerically (my estimate was wrong, so I used stills only: in the runt HIGH landing the chop's streak and ring sit above the shield at y178); big and giant foes (their own scale vs `L.H` was not tested, foe was medium throughout); a thumb on real hardware; no lean/big stills (numbers only); the four-key-frame landing was taken at the blow's resolve with time frozen, not in motion.

Stills: contact sheet of the nine tells (cyan lines = button centres) `docs/games/arena/sketches/runt-zones.png`. Scripts: `/tmp/claude-0/-home-user-Game-design/c932dd82-9e8d-5f8c-a293-93f6599709c5/scratchpad/runt-zones/run.mjs`.
