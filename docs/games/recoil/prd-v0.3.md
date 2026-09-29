# PRD v0.3: Recoil (delta from v0.2)

| | |
| --- | --- |
| Slug | `recoil` |
| Version | 0.3 |
| Date | 2026-09-29 |
| Status | locked for progression and missions |
| Answers | the designer's brief: unlock guns over time with points from challenge levels; more gamification |

## A. Unlock table

Guns unlock at points thresholds (points from the v0.1 rule: 10/25/50 per challenge by best stars):

| Gun | Unlock at | Profile | Character |
| --- | --- | --- | --- |
| Service pistol | 0 | v0.2 | the baseline |
| Carbine | 60 | v0.2 | fast, short range finder, hold to fire |
| Shotgun | 150 | damage 1 per pellet, 5 pellets in a fixed deterministic fan of `shotSpread` degrees centred on the barrel, fireRate 2.3 (interval shorter than its kick recovery of 0.47 s, per the v0.2 rule), accuracy 0.4, kick 14, recovery 30, mag 6 | boss parts and hordes; hopeless at far bullseyes |
| Marksman rifle | 300 | damage 3, fireRate 1.5, accuracy 1.0, kick 16, recovery 20, mag 5 | one-shot boss parts, long waits; sway matters most |

Pellet fans are deterministic: the same barrel angle gives the same five lines every time. **Scoring (amended after review):** only the centre pellet scores zone points on ring targets, so the fan never makes aiming easier; the review measured that best-pellet scoring gave a bullseye at 30 units of aim error. The outer pellets exist for damage and for hordes: every pellet deals damage separately to boss parts (the shotgun kills a part in one centred shot), and on horde targets every member a pellet hits is scored (outer points each), so a shotgun sweep through a column pays. Boss 1's per-gun thresholds are set from each gun's true maximum run, not from a five-hit run: for the shotgun 30/55/85 percent of its measured maximum. The marksman rifle's niche is a Boss 2 with 3-hp plates (v0.4); until then it is the accurate slow gun.

**Best per challenge (amended after review):** stars are monotonic. A run never lowers a saved star count; the saved best score and the saved stars are kept separately, so a high score with fewer stars (different gun thresholds) does not regress stars or re-lock a gun.

The gun select shows locked guns with their threshold; the points total on the menu shows progress to the next unlock.

## B. Missions

Badge tiers per ladder, plus a gauntlet:

| Tier | Badge | Earned by |
| --- | --- | --- |
| Bronze | Marksman I | three stars on Accuracy 1 |
| Bronze | Quick Draw I | three stars on Speed 1 |
| Bronze | Clay I | three stars on Skeet 1 |
| Silver | Steady | Accuracy 4 three stars with the carbine |
| Silver | Storm | Speed 4 three stars |
| Silver | Double | both Skeet 2 pairs hit in one run |
| Gold | Boss Killer | Boss 1 three stars with each gun |
| Gold | Gauntlet | one level of each ladder in a row without leaving the menu, all at two stars or better |
| Gold | Legend | three stars on every challenge |

## C. Experiment for tomorrow

Handling presets: "Steady" (kickPerShot 5, swayPerSpeed 0.01), "Standard" (current), "Wild" (kickPerShot 12, swayPerSpeed 0.04), with sliders for both. The question: how much fight in the gun is fun.

## D. Tuning additions

| Name | Value | Meaning |
| --- | --- | --- |
| shotSpread | 10 | Total fan angle of the shotgun's five pellets |
| unlockPoints | 0, 60, 150, 300 | Points thresholds per gun in order |

## E. Skins (added 2026-09-29, late, after the v8 review; source: docs/plans/2026-09-29-overnight.md "Unlockables")

Gun skins are earned by badges only, never by grind, and are data entries in the art layer: a palette override and one flat decoration inside the existing silhouette. Nine skins, one per badge: pistol Nickel (Marksman I), Blackout (Quick Draw I), Gold (Legend); carbine Desert (Clay I), Arctic (Steady); shotgun Walnut (Storm), Tactical (Double); rifle Carbon (Boss Killer), Ghost (Gauntlet). A Skin swatch row on the menu; locked swatches toast their badge; the chosen skin persists per gun (save v5) and a saved skin whose badge is missing renders as default. The skin shows on the tile, in play and on the card; the missions screen shows the skin next to its badge.

Readability rule (from the v8 review): every skin's body must measure at least 3:1 against the sky bands the gun crosses (y 100 to 170); the Standard skin measures about 4:1. Dark skins keep their name and mood by using a lighter body with dark decorations, not a dark body.

## F. Boss star rule amendment (after the v8 review)

Per-gun Boss thresholds come from the gun's maximum over centred shots: the bot aims at the bullseye centre. A route that needs a deliberately off-centre shot (the shotgun's one-outer-pellet trick on Boss 1) never sets the three-star bar, because perfect play must earn three stars (principle: legible cause of loss). Boss 1 shotgun thresholds therefore become 30/55/85 percent of its centred maximum. The same rule applies to Boss 2 in v0.4.
