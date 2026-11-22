# Handoff: Arena Pack 34, the full set (art, 2026-11-22)

For the designer, then the orchestrator. Everything is a **candidate** (nothing in `docs/art/final/arena/`): the designer picks in the ART tab or by line. One option each, as briefed. Wiring is the orchestrator's build.

**Look at (links once pushed, allow a minute):**
- `https://yohannabittan.github.io/Game-design/docs/art/candidates/arena-turn/sheet-torsos.jpg`: all six bodies (men avg for comparison, men lean and muscular, her avg, lean, muscular) on the rig at 2x and at game size (120 px), guard and sword arm raised, bare and in plate.
- `.../arena-turn/sheet-plates.jpg`: the kit plate, the black plate and the colossus plate on the average and muscular man and on her; her own plate.
- `.../arena-turn/sheet-joints.jpg`: the near shoulder of each body, about 8x game size, guard and raised (one piece or two).
- `.../arena-women/sheet-faces-full.jpg`: all 17 faces (the 7 from the probe and the 10 new), each at 128 px and on the body at 2x and game size.
- `.../arena-women/sheet-skin.jpg`: the skin-per-origin recommendation, top untinted, bottom tinted.

## Files

All painted **facing right**, three-quarter, so wiring uses no flip (as `HANDOFF-arena-pack34-turn.md`).

| File (in `candidates/arena-turn/`) | What |
| --- | --- |
| `kit-base-torso-lean-3q.png` (384 x 512), `kit-base-torso-3q.png` (488 x 512, the muscular man's wide canvas) | the men's lean and muscular torsos |
| `kit-base-torso-lean-f-3q.png`, `kit-base-torso-f-3q.png` (384 x 512) | her lean and muscular torsos, leather band (B) |
| `kit-arm-up-lean-f` / `-lo-lean-f` (160 x 288), `kit-leg-up-lean-f` (192 x 320) / `-lo-lean-f` (192 x 352) | her lean limbs, one whole limb painted once and cut in code |
| the same four with `musc` for `lean` | her muscular limbs |
| `kit-plate-chest-f-3q.png` (320 x 320) | her chest plate: a cuirass cut for a woman (waist in, a sculpted bust and a gentle abdomen), same bronze, rim and rivets |
| `gear-black-plate-3q.png`, `gear-colossus-plate-3q.png` (384 x 384) | the champions' chest gear turned three-quarter |

In `candidates/arena-women/`: `face-<origin>-m.png` and `-f.png`, 256 x 256, for `thrace`, `capua`, `ostia`, `alexandria`, `circus` (10 new; the Sparta women and Gaul, Numidia and Egypt were done). Sparta is women only (done, B picked). Faces: Thrace m a bearded man with hair tied back, f a knot and a dotted cheek tattoo (real Thracian custom); Capua m a scarred veteran, f a high ponytail and a scar; Ostia m weathered and grey-bearded, f short sun-bleached hair; Alexandria m curls and a curled beard, f a waved, low coiled knot (kohl on both); Circus m shaved head, waxed moustache, painted cheek stripe, f a wild topknot and a red stripe across the eyes. `candidates.json` in both folders lists every asset.

## The six past mistakes, checked on the sheets

1. **One piece or two.** Each limb was painted whole and straight, then cut at the narrowest row near the middle in code with the Pack 24 half-disc joint ends (24 px overlap, one width scale for both halves). Straight and bent: one outline, one tone. `sheet-joints.jpg`: round shoulder cap, one outline, no second arm. Passed. Three limbs were redone (below).
2. **Joints that meet.** Same canvas, neck row and belt row as the probe's torsos (tables below); head and legs meet on `sheet-torsos.jpg`. Passed.
3. **Worn, not stuck on.** The band, belt and kilt are painted onto her torsos; plates are turned, with the near armhole and strap on the left. Her plate and both champion plates sit on the torso on `sheet-plates.jpg`. Passed, with the flag on the kilt below.
4. **Facing the same way.** Head, torso, plate, arms and feet all face right on every sheet. The muscular man's painted upper-arm stub was cut in code (as in the probe): plain flank below the round cap, outlined. No second arm in any painting.
5. **Same body family.** Torsos matched in skin to the man's three-quarter torso, limbs matched to the probe's orange (`kit-arm-up-avg-f`, per-channel quantile match). My first match to the torso made her limbs yellower than her body (the old mistake); the sheet is after the fix. Faces keep their own skin: see the recommendation.
6. **Look it up.** No change from the probe: strong trained athlete, the men's kit, a plain band, hair bound or short. Her muscular build is a powerful athlete, not a costume. No image was refused.

## Joints and pins in px

**Torsos** (axis `a` = (178, 0), `b` = (178, 298), `w` 291, no tilt; for the muscular man's 488 canvas `a` = (228, 0), `b` = (228, 298), the existing `wide` joints). Neck top row 0, belt row 298, the belt centre fitted to row 298 and the neck column sheared over the belt column (as the probe).

| | neck stub x, rows 0 to 5 | widest row, x range | waist row 200 | belt row 298 | near shoulder (arm pin) |
| --- | --- | --- | --- | --- | --- |
| man lean | 155 to 194 | row 107, 36 to 285 | 99 to 264 | 94 to 266 | about (72, 100) |
| man muscular (488) | 201 to 252 | row 115, 63 to 364 | 112 to 339 | 128 to 329 | about (118, 112) |
| her lean | 155 to 195 | row 119, 55 to 295 | 132 to 265 | 85 to 273 | about (80, 100) |
| her muscular | 153 to 200 | row 120, 43 to 300 | 118 to 272 | 88 to 276 | about (80, 100) |

Her average B (probe): same `a` and `b`, pin about (80, 100). The shoulder pins are where the sheet pins the arm (the round painted cap under the arm's own cap); the builder re-tunes `SHOULDER`, `mine`, `back`, `cap` and `hole` against the sheet, as the probe handoff said.

**Limbs** (the file's own px; shoulder about 40 px below the shape's top, as Pack 24; `w` = painted width at the cut, then the tuning `w` is that over 0.9 as for her average):

| File | `a` | `b` | painted `w` | note |
| --- | --- | --- | --- | --- |
| `kit-arm-up-lean-f` | shoulder (65.5, 40) | elbow (64.1, 264) | 56 | |
| `kit-arm-lo-lean-f` | elbow (64.1, 24) | fist grip (115.0, 244) | 56 | |
| `kit-arm-up-musc-f` | shoulder (56.5, 40) | elbow (52.1, 264) | 72 | |
| `kit-arm-lo-musc-f` | elbow (52.1, 24) | fist grip (114.5, 244) | 72 | |
| `kit-leg-up-lean-f` | hip (93.0, 69) | knee (95.6, 296) | 68 | painted hem ends row 165: `top` 170 |
| `kit-leg-lo-lean-f` | knee (90.6, 24) | ankle (96.0, 293) | 68 | |
| `kit-leg-up-musc-f` | hip (94.0, 69) | knee (95.7, 296) | 80 | painted hem ends row 103: `top` 108 |
| `kit-leg-lo-musc-f` | knee (85.7, 24) | ankle (102.0, 293) | 80 | |

No `mir`: all painted facing right. The two halves' pivots are at different x (the lower half's knee or elbow column is not the upper's): pin `a` of the lower half to `b` of the upper, the offset is in the numbers. Cut widths were capped so the foot and fist fit the fixed canvas; the muscular painting is 80 px at the knee against her average's 78, the lean 68.

**Plates.** Her plate: 320 x 320, neck row 0, bottom rim row about 315, bbox x 48 to 272 at the widest; `a` (160, 0), `b` (160, 300) as today's. The sheet draws it with its top at the torso's row 0 and its column placed by the chest centre (the plate's left edge at torso column): man avg 35, man lean 12, man muscular 24 (plate widened 1.18), her average 15, her lean 34 (narrowed 0.95), her muscular 8 (widened 1.1). The 3q plates have the near armhole oval at about (30..105, 40..150) of the probe plate; her plate is the same turn. Champions' plates: scaled 0.82 on the sheet (black 384 x 384 bbox x 94 to 353, rows 0 to 382; colossus x 58 to 327, rows 36 to 346, the pauldrons set 36 px below the canvas top: drop it 30 px so they sit on the shoulders), neck opening at the torso's row 0, near pauldron left.

**Heads** (all 256 x 256): same pins as the kit head, `a` (128, 0), `b` (128, 222); eye line about y 125 to 133, within the probe's tolerance. The three-quarter torsos are narrower in the neck (about 40 to 50 px) than the head's neck stub, as in the probe.

## Skin per origin: recommendation

**One body painting per build, tinted in code per origin (multiply on skin pixels only).** Separate paintings would be about 6 builds x 8 origins and drift apart. The tint is a per-channel multiplier on the skin pixels of the torso, arms and legs (hue test: r > g > b, r minus g above 40, g under 195; belts, kilts, outlines and straps untouched), measured as the median skin of each face over the median skin of the man's three-quarter torso (245, 167, 65):

| face | R | G | B | face | R | G | B |
| --- | --- | --- | --- | --- | --- | --- | --- |
| gaul-m | 1.02 | 0.94 | 1.38 | capua-f | 1.01 | 0.91 | 0.95 |
| gaul-f | 1.02 | 1.07 | 1.68 | ostia-m | 0.99 | 0.83 | 1.00 |
| numidia-m | 0.82 | 0.49 | 0.37 | ostia-f | 0.98 | 0.81 | 0.91 |
| numidia-f | 0.84 | 0.55 | 0.55 | alexandria-m | 1.01 | 0.84 | 0.86 |
| egypt-m | 0.91 | 0.69 | 0.46 | alexandria-f | 0.95 | 0.80 | 0.85 |
| egypt-f | 0.98 | 0.80 | 0.72 | circus-m | 1.00 | 0.85 | 1.09 |
| sparta-f-B | 1.03 | 0.95 | 0.91 | circus-f | 0.93 | 0.72 | 0.75 |
| thrace-m | 1.00 | 0.85 | 0.91 | capua-m | 0.97 | 0.86 | 1.15 |
| thrace-f | 1.00 | 0.79 | 0.71 | | | | |

`sheet-skin.jpg` shows it working on eight faces: the Numidian body goes deep brown and the heads agree; Gaul is the weak case (a multiply cannot lighten a highlight past white, so a pale Gaul body reads slightly flat; a "screen" blend for the pale origins fixes it). The numbers are a starting point: skin is taste, so the designer's eye on `sheet-skin.jpg` decides, and each ratio is one number to nudge. If a tint ever costs too much frame time, bake each tinted body once at load into the game's part cache.

## Findings and flags

- **Three redos in group 1 and three in group 2** (cost below): her lean leg came back slanted (hip left of the knee by 44 px), her muscular arm with a pale glow, her muscular leg with the toes cut by the picture's edge; three faces (Thracian woman, Capuan man, Circus man) had no outline at the back of the head. All are redone and checked.
- **The thigh's top edge shows on the kilt.** The leg painting is drawn over the torso's long kilt, so its cut top (rows above `top` removed) shows as a faint rectangle on the kilt, at the front. The probe's average leg does the same. The sheet fades 10 rows. Better: draw the torso's kilt over the thigh, or fade the top rows in the game.
- **Her limbs carry a faint wavy texture** at 8x (the skin match); invisible at game size and 2x.
- **The champions' plates on her** are the men's muscle plates: a flag, as with the kit plate in the probe. Her own plate is for the kit chest plate only; a champion plate for a woman would be another pack if wanted.
- **Man muscular on the sheet** uses the average man's legs (the muscular thigh is a cropped painting with tuning I could not reproduce schematically); the lean man uses his own limbs.
- **Circus man** lost his grin in the redo: he is a scowl with the moustache (the first take, a grin, had no outline at the back of the head). Taste: say if you want the grin back, a redo is US$0.06.
- **Sheets are a schematic rig, not the game's**, as the probe. Same pins and poses (guard and raised), my PIL assembly; the game's cuts (`mine`, `back`, `cap`, `hole`) need re-tuning at wiring.

## Cost

Group 1: 14 images (11 kept, 3 discarded) about US$1.1; group 2: 13 images (10 kept, 3 discarded) US$0.78; code steps free. **About US$1.9 in total for this pack**, well inside the US$4. Ledger total **US$69.63**.

## The brief

- "PIL is broken in the cloud container" is out of date again: Pillow 12.3 and numpy work; scipy is not installed (I used numpy only).
- The budget line says US$80; the earlier handoffs said US$100.
- Pack 34's table in the brief lists `face-sparta-f` as done; `face-sparta-f-B` is the pick, and the three-quarter torso is `-f-B-3q` (`kit-base-torso-avg-f-B-3q.png`).

## For the designer to paste

"The Arena Pack 34 full set is in docs/art/candidates/arena-turn and arena-women (HANDOFF-arena-pack34-full.md): the men's and her lean and muscular torsos turned three-quarter with her whole limbs (sheet-torsos.jpg), her own chest plate and the two champion plates (sheet-plates.jpg), the near shoulder close-ups (sheet-joints.jpg), ten more faces (sheet-faces-full.jpg) and the skin tint idea (sheet-skin.jpg). Say what to keep, and whether the orchestrator should wire it."
