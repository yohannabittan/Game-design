# Finding: the sica "no bite" and the bear "no damage" (2026-11-14, a helper, read-only)

Measured in the running game (arena-v69 source, 874x402, Strength 4). Numbers are one blow through `land`/`checkHits`; a slash under 950 px/s does half. Scripts and stills: `/tmp/claude-0/-home-user-Game-design/c932dd82-9e8d-5f8c-a293-93f6599709c5/scratchpad/sica-bear/`.

## Answers in a sentence each
1. **Sica: not "one direction" in the blade, but one in the thumb.** The blade has no edge side (up, down, forward and backhand sweeps all did 2.5 + bleed). But any push within about 47 degrees of straight at him reads as a **jab**, and a sica jab is always a haft THUD (0.5, no bleed). Only steeper downward sweeps cut. Upward strokes are a raise (no blow) for every weapon.
2. **Bear: Haemorrhage, plus plate.** Haem ("Bare hits do nothing", picked in that run) makes every hit on bare hide 0 and says NO BITE. And a barded bear is almost all plate: from the front a level slash meets plate on 94% of heights, a gap on 6%, hide on 0%. Plate does no damage by design.

## Sica (big, Games or Rome), per stroke
| Stroke | Bare skin | Gap | Plate | Shown |
| --- | --- | --- | --- | --- |
| Slash, downward (fwd or straight) | 2.5, 1 bleed | 2.5, 1 bleed (no gap bonus) | 0, 0.5 dent | number, BLEED, HOOKED; plate: scratch and sparks, no word |
| Slash, upward | none: it is a raise, no blow | | | nothing |
| Backhand / forward sweep once it reaches him | 2.5, 1 bleed (same as forward) | same | same | same |
| Jab (any push toward him) | 0.5 | 0.5 (no pierce row) | 0, no dent | THUD (grey word), little push, no blood |
| Overhead | 3.5, 1 bleed | 3.5 | 0, 1 dent | number, BLEED, HOOKED |
Gladius for comparison: jab 2 on skin, **6 in a gap**, GLANCES OFF on plate; slash 2; overhead 3.
Does the game say the sica cuts one way? Partly. The rack and Weapon slot list the sica as "Cut" only (the gladius says Cut and Pierce) and paint one red edge; the purse line says "short and quick: slashes cut deep". Nothing says jabs are thuds, and the red edge is art only: `strike.edges` is read only by `draw-fight.js`, never by a hit.

## Bear (gladius; lion is the same table, flank for belly)
| Blow | Hide (hind legs only) | Gap (throat, joint, belly) | Barding |
| --- | --- | --- | --- |
| Slash | 2, no bleed | 2, no bleed | 0, 0.5 dent (6 to break it); scratch, no word |
| Jab | 2 | **6**, LOUDER | 0, GLANCES OFF, no dent |
| Overhead | 3, lames the hind legs | 3 | 0, 1 dent (3 to break) |
| With Haem | **0, "NO BITE", a few drops, no cut mark, no lame**; gaps and plate unchanged | | |
Hide hit with no damage: yes, only under Haem, and then it still sprays some blood (about 8 drops against 40 to 90), makes the slice sound and shakes the screen, but leaves no cut mark. Hits on plate show sparks, never blood.

**Reach at bout 4, Rome (giant bear, 67-72 health):** of the whole side-on body, about 62% barding, 25% hide (hind legs, behind the belly plate), 12.5% gap. Level slashes from the front: 94% of heights meet plate first, 6% a gap, 0% hide. Lion and young bear are the same (61-62% / 25% / 13%). A man at the same bout in Rome is giant 65-72 or big 53, so the bear is a giant man's health with far more of it behind plate. Bouts 2 and 4 are both barded.

## Cheapest changes
**Sica**
- Give it a pierce row at the point (`strike.sica.jab`, say 0-80, pierce): a push becomes a point stab that finds gaps, and the sica can be played by pushing. One tuning line.
- Or let a jab-angle stroke that reaches him count as a cut for the sica. Bigger change; not needed if the line above lands.
**Bear and plate**
- Say why: a short word on a hide hit under Haem ("HAEM: NO BITE" is there; the card is the only explanation) and "ARMOURED" or a visible dent on plate slashes. Words only.
- Let hide take a little (Haem: a quarter, not 0) or open more bare hide on barded beasts (bard only head and chest). One tuning line each.

## Not measured
- Whether the sica run also carried Haemorrhage (its gear is the "Hooked Sica"); the brief did not say. If so, "no bite" there was NO BITE on skin.
- The backhand with a real thumb: a stroke starting far behind him never reached him, so the backhand was tested by laying the blade and sweeping it (identical result).
- Hit-stop, sound and the purse/weapon card as seen (read from code, not a still). Stills show a single frame, not motion.

## Stills
- `/tmp/claude-0/-home-user-Game-design/c932dd82-9e8d-5f8c-a293-93f6599709c5/scratchpad/sica-bear/1-sica-jab-thud-on-man.png` sica jab: THUD, no blood
- `/tmp/claude-0/-home-user-Game-design/c932dd82-9e8d-5f8c-a293-93f6599709c5/scratchpad/sica-bear/2-bear-barded-slash-on-plate.png` three slashes on barding: sparks only, no number
- `/tmp/claude-0/-home-user-Game-design/c932dd82-9e8d-5f8c-a293-93f6599709c5/scratchpad/sica-bear/3-bear-hind-leg-haem-no-bite.png` NO BITE on a hind leg, a few drops
