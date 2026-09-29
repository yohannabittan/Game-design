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

Pellet fans are deterministic: the same barrel angle gives the same five lines every time. A pellet scores its own zone; the shot's score is the best pellet's zone (not the sum), so the shotgun is about hitting, not about multiplying points. Each pellet deals damage separately to boss parts, which is the shotgun's reason to exist.

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
