# Handoff: Arena Pack 34, second probe, the torsos turned to face right (art, 2026-11-22)

For the designer, then the orchestrator. Files are in `docs/art/candidates/arena-turn/` (`candidates.json`, pack "34-turn"). Nothing is in `docs/art/final/arena/` yet: **I stopped after the probe, for your pick.**

**Look at (links once pushed, allow a minute):**
- `https://yohannabittan.github.io/Game-design/docs/art/candidates/arena-turn/sheet-man.jpg`: the average man, today's frontal torso beside (a) three-quarter and (b) near profile, bare and in plate, at game size (120 px), 2x and 4x, guard, sword arm raised and swung, plus a close-up of the near-shoulder joint (about 8x).
- `https://yohannabittan.github.io/Game-design/docs/art/candidates/arena-turn/sheet-her.jpg`: her torso A and B turned three-quarter, beside the man, same poses and sizes (and her frontal A from last round).

**My recommendation: (a) three-quarter.** Both turned options agree with the head (today's frontal one does not). The three-quarter keeps the chest and the abs readable as a target and the plate readable as armour (it is still clearly the same cuirass); the profile is a true side view, so the body is a narrow slab (the torso is 170 px wide at the widest, against 350 for today's, and the plate becomes a thin vest). If you want the most literal match to the head, take (b); expect a narrower body and a smaller thing to aim at. Hers are made in (a) only.

## What was made

All painted **facing right**, so wiring uses them with no flip (today's torsos and plate are painted facing left and the game mirrors them with `flip: true`).

| File | What |
| --- | --- |
| `kit-base-torso-avg-3q.png` | the man, three-quarter, 384 x 512 |
| `kit-base-torso-avg-profile.png` | the man, near profile, 384 x 512 |
| `kit-plate-chest-3q.png`, `-profile.png` | the chest plate for each, 320 x 320 |
| `kit-base-torso-avg-f-A-3q.png`, `-f-B-3q.png` | her torso (A cream band, B leather band), three-quarter, 384 x 512 |

## Joints in px

Torsos (384 x 512). Same neck-top row and belt row as today's; the axis column is the same for neck top and belt: **`a` = (178, 0), `b` = (178, 298), `w` 291, no tilt.** (The generator leaned the chest forward of the belt, so the upper part was sheared sideways to put the neck-top column over the belt column; the shear is 26 to 38 px over 298 rows and does not show.)

| | today (as stored) | (a) 3/4 | (b) profile | her A 3/4 | her B 3/4 |
| --- | --- | --- | --- | --- | --- |
| neck stub x range, rows 0 to 5 | 156 to 226 | 153 to 201 | 156 to 198 | 153 to 201 | 147 to 206 |
| widest row, x range | row 119, 28 to 370 | row 107, 24 to 306 | row 141, 86 to 268 | row 131, 38 to 300 | row 127, 36 to 298 |
| waist row 200, x range | 72 to 298 | 85 to 280 | 100 to 256 | 105 to 279 | 102 to 277 |
| belt row 298, x range | 56 to 302 | 76 to 283 | 96 to 262 | 82 to 282 | 83 to 281 |

The neck stub is narrower than today's (48 against 70 px), which suits the turned neck and the head's own neck; the head and helmets use the same `a` and `b`.

**The near shoulder (the arm's pin) moves.** Today the rig pins the arm at `SHOULDER` = (0.05, -0.67) body units, which on the torso canvas is about **(236, 88)**: forward of the axis, on the chest. Turned, the near shoulder is behind the chest, so the pin is:
- (a) three-quarter: about **(72, 100)**, so 164 px left (back) of today's, 12 lower;
- (b) near profile: about **(155, 98)**, 81 px left of today's, 10 lower;
- her A and B three-quarter: about **(80, 100)**.
In `TUNING.kit` that means `SHOULDER` (data.js) moves with the art, or the arm is pinned on the painted cap; the sheet pins it at those points. Same ball-and-socket as today: the arm's round shoulder cap covers the painted cap (see the close-up row of `sheet-man.jpg`), one piece, one outline, no second arm (the painted near arm of the first three-quarter draft was cut in code: see Flags).

Chest plate (320 x 320): same rows as today's (neck top row 0, bottom rim row about 315), centred on column 160. Three-quarter: x 65 to 266 at the chest (row 150), 121 to 249 at the bottom rim; profile: 78 to 245 and 107 to 239. Today's `a` (160, 0), `b` (160, 300), `w` 270 still hold; the plate is **worn**: it wraps the body, the near armhole is on the left (back) with its riveted strap, and the far side curves away. `hole` (the armhole, today (291, 94, 21, 58)) moves: the 3/4 armhole is an oval at about x 30 to 105, y 40 to 150 (centre (70, 95), radii 38 x 55), the profile's is an oval at about x 10 to 75, y 20 to 125.

## The six past mistakes, checked on the sheets

1. **One piece or two.** The arm is one whole painting cut at the elbow, as today; the close-up shows the shoulder end round and one outline. Passed (the limbs are today's, only the torso changed).
2. **Joints that meet.** Neck top, belt and axis as above; the head and legs meet on the sheet. Passed, to the extent a schematic rig can show.
3. **Worn, not stuck on.** Chest band, belt and kilt are painted onto her torso; the plate is painted turned, with its strap over the near shoulder, and sits on the turned torso on the sheets. Her chest band is turned with her body. Passed. Her plate is still the man's cuirass (muscled chest and abs); the plate for her is a call for you, as in the first probe.
4. **Facing the same way.** This is the point of the round: head, chest, arm and feet all face right, no second arm. Passed (see the flag on the stub).
5. **Same body family.** Skin matched to today's torso (mean RGB 233, 143, 51 against 235, 145, 53). The profile's shaded side still reads redder than the rest (a deep red-orange shadow). Judge it on the sheet; it can be repainted or tinted at wiring.
6. **Look it up.** No change: the same plain band and kit, hair for a helmet.

## Flags

- **The sheets are a schematic rig, not the game's.** I could not render the real fighter with these files without editing `games/` (not mine), and the film tool's fighter wears other art. The sheets are my own PIL assembly with today's limbs, head, the `SHOULDER` pin from `data.js` and my pins above. The game's own cuts for a painted man (`mine`, `back`, `cap` and `hole` in `TUNING.kit`) were tuned for the frontal torsos and will need retuning at wiring: the builder reads the pins above and the sheet.
- **Three-quarter man: arm stub removed in code.** The generator painted a deltoid and upper-arm stub hanging from the near shoulder; I cut it, leaving a rounded cap. A second draft that avoided the stub came out turned only about 30 degrees, so I kept the first and cut it. The cut edge under the cap is plain (no outline); the arm covers it in play.
- **Her A has a kilt slit** where the orange of the hip shows through the front of the kilt; B has none. Another reason to prefer B, or a fix at the full set.
- **The profile plate** shows the dark inside of its far side through the armhole; the torso's shoulder fills it in play.

## Cost

8 images, **$0.64** by the ledger estimate (6 kept, 2 discarded: a three-quarter plate that faced left, and a man's draft turned too little). Ledger total **$67.31** of the $100 budget. Pillow and the image calls worked in this container (the brief's "PIL is broken" line is out of date: the orchestrator fixes the brief, as the first probe's handoff said).

## After your pick (the full set, about 8 more images, about US$1)

The lean and muscular men's torsos, her lean and muscular torsos, her chest plate, and the gear that covers the chest (`gear-black-plate`, `gear-colossus-plate`), all turned the same way as the option you pick. Wiring is the orchestrator's build.

## For the designer to paste

"The Arena Pack 34 turn probe is in docs/art/candidates/arena-turn (HANDOFF-arena-pack34-turn.md): the man's torso and chest plate turned three-quarter or near profile on the rig beside today's frontal one (sheet-man.jpg), and her A and B turned three-quarter (sheet-her.jpg). Pick three-quarter or profile, and her A or B, and say whether to go on with the full set."
